import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractDetachedTestRerunCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-detached-test-runner';

const hash = (value: string | Buffer) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

function write(root: string, relativePath: string, value: string) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

describe('requirements contract detached test rerun', () => {
  it('materializes and executes the frozen candidate without prior evidence', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-detached-rerun-'));
    try {
      const transactionId = `TX-${randomUUID()}`;
      const implementationAttemptId = `IMP-${randomUUID()}`;
      write(root, 'candidate/value.txt', 'candidate\n');
      write(
        root,
        'contract.md',
        [
          '# Contract',
          '## Required Test Commands',
          '| ID | Command | CWD | Expected | Acceptance |',
          '|---|---|---|---|---|',
          "| CMD-02 | `node -e \"require('fs').writeFileSync('run-one.txt','one')\"` | Repository root | pass | AC-01 |",
          "| CMD-03 | `node -e \"process.stdout.write(require('fs').readFileSync('candidate/value.txt','utf8'))\"` | Repository root | pass | AC-01 |",
          '',
        ].join('\n')
      );
      const candidateFileIndex = ['candidate/value.txt', 'contract.md'].map((relativePath) => ({
        path: relativePath,
        pathRole: relativePath === 'contract.md' ? 'documentation' : 'implementation',
        tracked: true,
        bytes: readFileSync(path.join(root, relativePath)).length,
        hash: hash(readFileSync(path.join(root, relativePath))),
      }));
      const candidateFileIndexHash = hash(JSON.stringify(candidateFileIndex));
      write(
        root,
        'changed.json',
        `${JSON.stringify({
          schemaVersion: 'requirements-contract-changed-path-manifest/v1',
          transactionId,
          implementationAttemptId,
          candidateSnapshotHash: hash(candidateFileIndexHash),
          candidateFileIndex,
          candidateFileIndexHash,
          unauthorizedPathCount: 0,
          decision: 'pass',
        })}\n`
      );
      write(
        root,
        'baseline.json',
        `${JSON.stringify({
          schemaVersion: 'requirements-contract-g00-baseline-fixture/v1',
          implementationAttemptId,
          implementationEnvironmentFingerprint: hash('environment'),
        })}\n`
      );

      const report = await requirementsContractDetachedTestRerunCommand({
        cwd: root,
        contract: 'contract.md',
        changedPathManifest: 'changed.json',
        baseline: 'baseline.json',
        commandRange: 'CMD-02:CMD-03',
        workspaceMode: 'isolated-snapshot',
        artifactRoot: `audit/${randomUUID()}`,
        out: 'audit/detached-test-rerun.json',
        json: false,
      });

      expect(report.schemaVersion).toBe('requirements-contract-detached-test-rerun/v1');
      expect(report.auditAttemptId).not.toBe(report.implementationAttemptId);
      expect(report.executorClass).toBe('controlled_detached_executor');
      expect(report.priorEvidenceConsumed).toBe(false);
      expect(report.materializationMismatchCount).toBe(0);
      expect(report.environmentCompatibilityDecision).toBe('pass');
      expect(report.commandRuns.map((run) => [run.commandId, run.exitCode])).toEqual([
        ['CMD-02', 0],
        ['CMD-03', 0],
      ]);
      expect(report.commandRuns[1].stdoutHash).toBe(hash('candidate\n'));
      expect(existsSync(path.join(root, report.workspacePath, 'run-one.txt'))).toBe(true);
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
