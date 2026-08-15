import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { implementationReadinessGateAction } from '../../packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
import * as controlStore from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';
import { assertRuntimeBuildAuthorityCurrent } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-build-authority';
import {
  materializeImplementationReadinessFixture,
  readinessActionContext,
} from '../helpers/implementation-readiness-fixture';

function snapshot(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const target = path.join(current, name);
      const relative = path.relative(root, target).replace(/\\/gu, '/');
      const stat = statSync(target);
      if (stat.isDirectory()) visit(target);
      else result[relative] = `${stat.mtimeMs}:${readFileSync(target).toString('base64')}`;
    }
  };
  visit(root);
  return result;
}

function waitForExisting(paths: string[], timeoutMs = 10_000): string {
  const waitCell = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = paths.find((candidate) => existsSync(candidate));
    if (found) return found;
    Atomics.wait(waitCell, 0, 0, 10);
  }
  throw new Error(`timed_out_waiting_for:${paths.join(',')}`);
}

const PACKAGE_ROOT = path.join(process.cwd(), 'packages', 'bmad-speckit');
const DIST_READINESS_MODULE = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'main-agent-implementation-readiness-gate.js'
);

function assertCurrentDistBuild(): void {
  const receiptPath = path.join(
    PACKAGE_ROOT,
    'dist',
    'main-agent',
    'runtime-build-authority-receipt.json'
  );
  assertRuntimeBuildAuthorityCurrent({
    receipt: JSON.parse(readFileSync(receiptPath, 'utf8')),
    packageRoot: PACKAGE_ROOT,
    runtimeAssetManifestPath: path.join(
      PACKAGE_ROOT,
      'dist',
      'main-agent',
      'runtime-asset-manifest.json'
    ),
    buildScriptPath: path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs'),
    dependencyLockPath: path.join(process.cwd(), 'package-lock.json'),
  });
}

assertCurrentDistBuild();

describe('Main Agent implementation readiness replay and recovery', () => {
  it('reuses a published aggregate with zero command execution and zero writes', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;
      const bundleRoot = path.dirname(
        path.join(fixture.root, ...first.result.candidateRef.path.split('/'))
      );
      const before = snapshot(bundleRoot);
      const second = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(second).toMatchObject({
        status: 'implementation_readiness_reused',
        exitCode: 0,
        result: {
          status: 'implementation_readiness_reused',
          commandExecutionCount: 0,
          writeCount: 0,
        },
      });
      expect(snapshot(bundleRoot)).toEqual(before);
    } finally {
      fixture.cleanup();
    }
  });

  it('reruns the bounded command set after a pre-publication crash without publishing a receipt', () => {
    const fixture = materializeImplementationReadinessFixture({ duplicateCommand: true });
    let executions = 0;
    try {
      expect(() =>
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            onCommandExecuted: () => {
              executions += 1;
            },
            beforePublish: () => {
              throw new Error('simulated_pre_publication_crash');
            },
          }
        )
      ).toThrow('simulated_pre_publication_crash');
      expect(executions).toBe(1);
      const evaluationsRoot = path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations');
      expect(
        existsSync(evaluationsRoot)
          ? readdirSync(evaluationsRoot).filter((name) => !name.startsWith('.staging-'))
          : []
      ).toEqual([]);

      const recovered = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        {
          onCommandExecuted: () => {
            executions += 1;
          },
        }
      );
      expect(recovered).toMatchObject({
        status: 'implementation_readiness_pass',
        commandExecutionCount: 1,
      });
      expect(executions).toBe(2);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns the committed pass when a post-publication observer throws', () => {
    const fixture = materializeImplementationReadinessFixture();
    let executions = 0;
    try {
      const committed = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        {
          onCommandExecuted: () => {
            executions += 1;
          },
          afterAtomicPublish: () => {
            throw new Error('simulated_post_publication_failure');
          },
        }
      );
      expect(committed).toMatchObject({
        status: 'implementation_readiness_pass',
        commandExecutionCount: 1,
        writeCount: 5,
      });
      expect(executions).toBe(1);
      const interrupted = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      expect(interrupted.sixModelResults.implementation_readiness.status).toBe('pass');

      const recovered = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        {
          onCommandExecuted: () => {
            executions += 1;
          },
        }
      );
      expect(recovered).toMatchObject({
        status: 'implementation_readiness_reused',
        commandExecutionCount: 0,
        writeCount: 0,
      });
      expect(executions).toBe(1);
      const promoted = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      expect(promoted.sixModelResults.implementation_readiness.status).toBe('pass');

      expect(
        produceImplementationReadiness({
          projectRoot: fixture.root,
          requestId: fixture.requestId,
        })
      ).toMatchObject({
        status: 'implementation_readiness_reused',
        commandExecutionCount: 0,
        writeCount: 0,
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('counts the stale transition before publishing a replacement readiness pass', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'pending' }; // scoped input changed\n",
        'utf8'
      );

      const replacement = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });

      expect(replacement).toMatchObject({
        status: 'implementation_readiness_pass',
        commandExecutionCount: 1,
        writeCount: first.writeCount + 1,
      });
    } finally {
      fixture.cleanup();
    }
  });

  it.each(['before_commit_boundary', 'after_transaction_promotion'])(
    'recovers an uncommitted readiness publication after a real child-process crash at %s',
    (boundary) => {
      const fixture = materializeImplementationReadinessFixture();
      const childPath = path.join(fixture.root, 'crash-readiness-publication.cjs');
      writeFileSync(
        childPath,
        [
          "'use strict';",
          'const [modulePath, projectRoot, requestId, boundary] = process.argv.slice(2);',
          'const { produceImplementationReadiness } = require(modulePath);',
          'produceImplementationReadiness(',
          '  { projectRoot, requestId },',
          '  {',
          '    controlStoreCommitDeps: {',
          '      beforeBoundary(current) {',
          '        if (current === boundary) process.exit(86);',
          '      },',
          '    },',
          '  }',
          ');',
          '',
        ].join('\n'),
        'utf8'
      );
      try {
        const crashed = spawnSync(
          process.execPath,
          [childPath, DIST_READINESS_MODULE, fixture.root, fixture.requestId, boundary],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            shell: false,
            timeout: 120_000,
            env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
          }
        );
        expect(crashed.status, `${crashed.stdout}\n${crashed.stderr}`).toBe(86);
        expect(
          JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8')).sixModelResults
            .implementation_readiness.status
        ).toBe('pass');

        let executions = 0;
        const recovered = produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            onCommandExecuted: () => {
              executions += 1;
            },
          }
        );

        expect(recovered).toMatchObject({
          status: 'implementation_readiness_pass',
          commandExecutionCount: 1,
        });
        expect(executions).toBe(1);
        expect(existsSync(path.join(fixture.recordRoot, 'events', 'control-store', '.lock'))).toBe(
          false
        );
      } finally {
        fixture.cleanup();
      }
    }
  );

  it('recovers an uncommitted pass before entering an authoritative read callback', () => {
    const fixture = materializeImplementationReadinessFixture();
    const childPath = path.join(fixture.root, 'race-readiness-publication.cjs');
    writeFileSync(
      childPath,
      [
        "'use strict';",
        'const [modulePath, projectRoot, requestId] = process.argv.slice(2);',
        'const { produceImplementationReadiness } = require(modulePath);',
        'produceImplementationReadiness(',
        '  { projectRoot, requestId },',
        '  {',
        '    controlStoreCommitDeps: {',
        "      beforeBoundary(current) { if (current === 'after_transaction_promotion') process.exit(86); },",
        '    },',
        '  }',
        ');',
        '',
      ].join('\n'),
      'utf8'
    );
    try {
      const readAuthoritatively = (
        controlStore as typeof controlStore & {
          readControlStoreAuthoritatively?: <T>(recordPath: string, read: () => T) => T;
        }
      ).readControlStoreAuthoritatively;
      expect(typeof readAuthoritatively).toBe('function');
      if (!readAuthoritatively) return;

      const crashed = spawnSync(
        process.execPath,
        [childPath, DIST_READINESS_MODULE, fixture.root, fixture.requestId],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          shell: false,
          timeout: 120_000,
          env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
        }
      );
      expect(crashed.status, `${crashed.stdout}\n${crashed.stderr}`).toBe(86);
      expect(
        JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8')).sixModelResults
          .implementation_readiness.status
      ).toBe('pass');

      let readAttempts = 0;
      const finalStatus = readAuthoritatively(fixture.runtimeRecordPath, () => {
        readAttempts += 1;
        const record = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
        return record.sixModelResults?.implementation_readiness?.status ?? 'absent';
      });

      expect(readAttempts).toBe(1);
      expect(finalStatus).not.toBe('pass');
      expect(existsSync(path.join(fixture.recordRoot, 'events', 'control-store', '.lock'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('prevents a writer rollback from exposing a transient pass to an authoritative read', () => {
    const fixture = materializeImplementationReadinessFixture();
    const childPath = path.join(fixture.root, 'rollback-readiness-publication.cjs');
    const readyPath = path.join(fixture.root, 'rollback-writer-ready');
    const releasePath = path.join(fixture.root, 'rollback-writer-release');
    const donePath = path.join(fixture.root, 'rollback-writer-done.json');
    writeFileSync(
      childPath,
      [
        "'use strict';",
        "const fs = require('node:fs');",
        'const [modulePath, projectRoot, requestId, readyPath, releasePath, donePath] = process.argv.slice(2);',
        'const { produceImplementationReadiness } = require(modulePath);',
        'const waitCell = new Int32Array(new SharedArrayBuffer(4));',
        'try {',
        '  produceImplementationReadiness(',
        '    { projectRoot, requestId },',
        '    {',
        '      controlStoreCommitDeps: {',
        '        beforeBoundary(current) {',
        "          if (current !== 'before_commit_boundary') return;",
        "          fs.writeFileSync(readyPath, 'ready', 'utf8');",
        '          const deadline = Date.now() + 10000;',
        '          while (!fs.existsSync(releasePath) && Date.now() < deadline) {',
        '            Atomics.wait(waitCell, 0, 0, 10);',
        '          }',
        "          throw new Error('simulated_controlled_rollback');",
        '        },',
        '      },',
        '    }',
        '  );',
        '} catch (error) {',
        "  fs.writeFileSync(donePath, JSON.stringify({ error: String(error && error.message) }), 'utf8');",
        '}',
        '',
      ].join('\n'),
      'utf8'
    );
    try {
      const readAuthoritatively = (
        controlStore as typeof controlStore & {
          readControlStoreAuthoritatively?: <T>(recordPath: string, read: () => T) => T;
        }
      ).readControlStoreAuthoritatively;
      expect(typeof readAuthoritatively).toBe('function');
      if (!readAuthoritatively) return;

      const finalStatus = readAuthoritatively(fixture.runtimeRecordPath, () => {
        spawn(
          process.execPath,
          [
            childPath,
            DIST_READINESS_MODULE,
            fixture.root,
            fixture.requestId,
            readyPath,
            releasePath,
            donePath,
          ],
          {
            cwd: process.cwd(),
            windowsHide: true,
            stdio: 'ignore',
            env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
          }
        );
        const firstSignal = waitForExisting([readyPath, donePath]);
        const record = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
        const status = record.sixModelResults?.implementation_readiness?.status ?? 'absent';
        if (firstSignal === readyPath) {
          writeFileSync(releasePath, 'release', 'utf8');
          waitForExisting([donePath]);
        }
        return status;
      });

      const childResult = JSON.parse(readFileSync(donePath, 'utf8')) as { error: string };
      expect(finalStatus).not.toBe('pass');
      expect(childResult.error).toMatch(/control_store_lock_held|simulated_controlled_rollback/u);
      expect(existsSync(path.join(fixture.recordRoot, 'events', 'control-store', '.lock'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('does not recover a transient pass from a competing writer before commit', () => {
    const fixture = materializeImplementationReadinessFixture();
    const childPath = path.join(fixture.root, 'transient-readiness-publication.cjs');
    const readyPath = path.join(fixture.root, 'transient-writer-ready');
    const donePath = path.join(fixture.root, 'transient-writer-done.json');
    writeFileSync(
      childPath,
      [
        "'use strict';",
        "const fs = require('node:fs');",
        'const [modulePath, projectRoot, requestId, readyPath, donePath] = process.argv.slice(2);',
        'const { produceImplementationReadiness } = require(modulePath);',
        'const waitCell = new Int32Array(new SharedArrayBuffer(4));',
        'try {',
        '  produceImplementationReadiness(',
        '    { projectRoot, requestId },',
        '    {',
        '      controlStoreCommitDeps: {',
        '        beforeBoundary(current) {',
        "          if (current !== 'before_commit_boundary') return;",
        "          fs.writeFileSync(readyPath, 'ready', 'utf8');",
        '          Atomics.wait(waitCell, 0, 0, 5000);',
        "          throw new Error('simulated_transient_pass_rollback');",
        '        },',
        '      },',
        '    }',
        '  );',
        '} catch (error) {',
        "  fs.writeFileSync(donePath, JSON.stringify({ error: String(error && error.message) }), 'utf8');",
        '}',
        '',
      ].join('\n'),
      'utf8'
    );
    let childStarted = false;
    let result: Record<string, any> | undefined;
    let failure: unknown;
    try {
      try {
        result = produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            beforePublish: () => {
              if (childStarted) return;
              childStarted = true;
              spawn(
                process.execPath,
                [
                  childPath,
                  DIST_READINESS_MODULE,
                  fixture.root,
                  fixture.requestId,
                  readyPath,
                  donePath,
                ],
                {
                  cwd: process.cwd(),
                  windowsHide: true,
                  stdio: 'ignore',
                  env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
                }
              );
              expect(waitForExisting([readyPath, donePath])).toBe(readyPath);
            },
          }
        ) as Record<string, any>;
      } catch (error) {
        failure = error;
      }
      waitForExisting([donePath]);

      expect(result).toBeUndefined();
      expect(failure).toMatchObject({ issueCode: 'control_store_lock_held', writeCount: 0 });
      expect(
        JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8')).sixModelResults
          .implementation_readiness
      ).toMatchObject({ status: 'not_established' });
    } finally {
      fixture.cleanup();
    }
  });
});
