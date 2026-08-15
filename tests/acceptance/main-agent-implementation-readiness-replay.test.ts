import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { implementationReadinessGateAction } from '../../packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
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

  it('reuses the complete atomic publication after the caller crashes before receiving it', () => {
    const fixture = materializeImplementationReadinessFixture();
    let executions = 0;
    try {
      expect(() =>
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            onCommandExecuted: () => {
              executions += 1;
            },
            afterAtomicPublish: () => {
              throw new Error('simulated_post_publication_crash');
            },
          } as any
        )
      ).toThrow('simulated_post_publication_crash');
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
});
