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

function writePartitionSource(root: string): string {
  const source = path.join(root, 'judge-partition-source.md');
  fs.writeFileSync(
    source,
    [
      '# Judge Partition Fixture',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Task J01-T01: Implement Judge Request Authority',
      '',
      '- Dependencies: none.',
      '- Target modification paths:',
      '  - `packages/bmad-speckit/src/judge/request-authority-01.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-02.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-03.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-04.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-05.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-06.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-07.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-08.ts`',
      '  - `packages/bmad-speckit/src/judge/request-authority-09.ts`',
      '- Requirements:',
      '  - MUST implement Judge request authority across all declared write scopes.',
      '- Acceptance refs: `AC-J01-T01-01`.',
      '- Evidence refs: `EVD-J01-T01-01`.',
      '- Command refs: `CMD-J01-T01-01`.',
      '',
      '- AC-J01-T01-01: MUST validate Judge request authority.',
      '- EVD-J01-T01-01: MUST bind Judge request authority evidence.',
      '- CMD-J01-T01-01: Run `node --version`.',
      '',
      '### Task J01-T02: Implement Judge Provider Authority',
      '',
      '- Dependencies: J01-T01.',
      '- Target modification paths:',
      '  - `packages/bmad-speckit/src/judge/provider-authority.ts`',
      '- Requirements:',
      '  - MUST implement Judge provider authority.',
      '- Acceptance refs: `AC-J01-T02-01`.',
      '- Evidence refs: `EVD-J01-T02-01`.',
      '- Command refs: `CMD-J01-T02-01`.',
      '',
      '- AC-J01-T02-01: MUST validate Judge provider authority.',
      '- EVD-J01-T02-01: MUST bind Judge provider authority evidence.',
      '- CMD-J01-T02-01: Run `node --version`.',
      '',
      '### Task J01-T03: Implement Judge Receipt Authority',
      '',
      '- Dependencies: J01-T02.',
      '- Target modification paths:',
      '  - `packages/bmad-speckit/src/judge/receipt-authority.ts`',
      '- Requirements:',
      '  - MUST implement Judge receipt authority.',
      '- Acceptance refs: `AC-J01-T03-01`.',
      '- Evidence refs: `EVD-J01-T03-01`.',
      '- Command refs: `CMD-J01-T03-01`.',
      '',
      '- AC-J01-T03-01: MUST validate Judge receipt authority.',
      '- EVD-J01-T03-01: MUST bind Judge receipt authority evidence.',
      '- CMD-J01-T03-01: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
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
    const source = writePartitionSource(root);
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
    expect(manifest.partitionCount).toBeGreaterThanOrEqual(3);
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
