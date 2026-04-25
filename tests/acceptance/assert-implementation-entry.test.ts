import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainAssertImplementationEntry } from '../../scripts/assert-implementation-entry';
import { runAuditorHost } from '../../scripts/run-auditor-host';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

describe('assert-implementation-entry', () => {
  it('returns non-zero when the current implementation-entry gate is blocked', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-assert-impl-entry-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeMinimalRegistryAndProjectContext(root, {
      flow: 'story',
      stage: 'implement',
      epicId: 'epic-14',
      storyId: '14.1',
      runId: 'run-14-1',
    });

    const stdoutChunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: typeof process.stdout.write }).write = (
      chunk: string | Uint8Array
    ) => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };

    try {
      const code = mainAssertImplementationEntry(['--cwd', root]);
      expect(code).toBe(2);
      const gate = JSON.parse(stdoutChunks.join(''));
      expect(gate.decision).toBe('block');
      expect(gate.gateName).toBe('implementation-readiness');
    } finally {
      (process.stdout as { write: typeof process.stdout.write }).write = originalWrite;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reuses emit-runtime-policy auto-repair path for standalone implementation-entry checks', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-assert-impl-entry-standalone-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
    writeRuntimeContext(
      root,
      defaultRuntimeContextFile({
        flow: 'standalone_tasks',
        stage: 'implement',
        sourceMode: 'standalone_story',
        contextScope: 'project',
        artifactPath: '_bmad-output/implementation-artifacts/_orphan/TASKS_checkout_hardening.md',
        updatedAt: new Date().toISOString(),
      })
    );

    const tasksPath = path.join(
      root,
      '_bmad-output',
      'implementation-artifacts',
      '_orphan',
      'TASKS_checkout_hardening.md'
    );
    fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
    fs.writeFileSync(tasksPath, '# TASKS\n\n- [ ] T001 Harden checkout flow\n', 'utf8');

    const auditReportPath = tasksPath.replace(/\.md$/i, '.audit.md');
    fs.writeFileSync(
      auditReportPath,
      [
        'status: PASS',
        'stage: standalone_tasks',
        `reportPath: ${auditReportPath.replace(/\\/g, '/')}`,
        'iteration_count: 1',
        'required_fixes_count: 0',
        'score_trigger_present: false',
        `artifactDocPath: ${tasksPath.replace(/\\/g, '/')}`,
        'converged: true',
      ].join('\n'),
      'utf8'
    );
    await runAuditorHost({
      projectRoot: root,
      reportPath: auditReportPath,
      stage: 'document',
      artifactPath: tasksPath,
      iterationCount: '1',
    });

    const stdoutChunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: typeof process.stdout.write }).write = (
      chunk: string | Uint8Array
    ) => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };

    try {
      const code = mainAssertImplementationEntry(['--cwd', root]);
      expect(code).toBe(0);
      const gate = JSON.parse(stdoutChunks.join(''));
      expect(gate.decision).toBe('pass');
      expect(gate.gateName).toBe('implementation-readiness');
    } finally {
      (process.stdout as { write: typeof process.stdout.write }).write = originalWrite;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
