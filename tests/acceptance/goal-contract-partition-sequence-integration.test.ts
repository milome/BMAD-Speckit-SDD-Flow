import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const cli = path.join(
  repoRoot,
  'packages',
  'bmad-speckit',
  'bin',
  'bmad-speckit.js'
);
const roots: string[] = [];

function run(args: string[], timeout = 300_000) {
  return spawnSync(process.execPath, [cli, 'goal-contract', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout,
    windowsHide: true,
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe('goal-contract partition Sequence integration', () => {
  it('cold-compiles and generates Judge partitions without a Sequence producer', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'goal-contract-sequence-cold-')
    );
    roots.push(root);
    const source = path.join(
      repoRoot,
      'docs',
      'plans',
      '2026-07-25-judge-role-separation-implementation-task-list.md'
    );
    const manifestPath = path.join(root, 'partition-manifest.json');
    const receiptsDir = path.join(root, 'receipts');
    const compiled = run([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      manifestPath,
      '--receipts-dir',
      receiptsDir,
      '--sequence-mode',
      'auto',
      '--json',
    ]);

    expect(compiled.status, compiled.stderr || compiled.stdout).toBe(0);
    const payload = JSON.parse(compiled.stdout);
    expect(payload).toMatchObject({
      ok: true,
      sequenceMode: 'auto',
      sequenceApplicability: 'not_applicable_with_proof',
      sequenceCoverage: 'not_applicable',
      sequenceClosureStatus: 'not_required',
      childContractAuthority: 'full',
      semanticProviderCallCount: 0,
    });
    expect(payload.sequenceApplicabilityReceipt).toMatchObject({
      schemaVersion: 'goal-contract-sequence-applicability-receipt/v1',
      decision: 'not_applicable_with_proof',
    });
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.topologicalOrder).toHaveLength(manifest.partitionCount);
    expect(manifest.partitionCount).toBeGreaterThan(1);
    expect(manifest).toMatchObject({
      sequenceMode: 'auto',
      sequenceApplicability: 'not_applicable_with_proof',
      sequenceCoverage: 'not_applicable',
      sequenceClosureStatus: 'not_required',
      childContractAuthority: 'full',
    });

    const partitions = manifest.partitions as Array<{
      partitionId: string;
      primaryTaskIds: string[];
      acceptanceIds: string[];
      commandIds: string[];
      evidenceContractIds: string[];
    }>;
    expect(
      partitions.every(
        (partition) =>
          partition.primaryTaskIds.length > 0 &&
          partition.acceptanceIds.length > 0 &&
          partition.commandIds.length > 0 &&
          partition.evidenceContractIds.length > 0
      )
    ).toBe(true);
    const splitPartition = partitions.find((partition) =>
      partition.primaryTaskIds.some((taskId) => taskId.endsWith('-A01'))
    );
    expect(splitPartition).toBeDefined();
    const representativePartitionIds = [
      ...new Set([
        manifest.topologicalOrder[0],
        splitPartition?.partitionId,
        manifest.topologicalOrder.at(-1),
      ]),
    ].filter((partitionId): partitionId is string => Boolean(partitionId));
    expect(representativePartitionIds).toHaveLength(3);

    for (const partitionId of representativePartitionIds) {
      const index = manifest.topologicalOrder.indexOf(partitionId);
      const childPath = path.join(
        root,
        `child-${index + 1}-goal-execution-plan.md`
      );
      const generated = run([
        'generate',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--partition-manifest',
        manifestPath,
        '--partition-id',
        partitionId,
        '--receipts-dir',
        receiptsDir,
        '--out',
        childPath,
        '--sequence-mode',
        'auto',
        '--json',
      ]);
      expect(generated.status, generated.stderr || generated.stdout).toBe(0);
      const generation = JSON.parse(generated.stdout);
      expect(generation).toMatchObject({
        partitionId,
        sequenceMode: 'auto',
        sequenceApplicability: 'not_applicable_with_proof',
        sequenceCoverage: 'not_applicable',
        sequenceClosureStatus: 'not_required',
        childContractAuthority: 'full',
      });
      expect(fs.existsSync(childPath)).toBe(true);
    }
  }, 900_000);
});
