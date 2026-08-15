import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CLI = join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const TSX = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_COMMAND = join(ROOT, 'packages', 'bmad-speckit', 'src', 'commands', 'goal-contract.ts');
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'const hash=(digit)=>`sha256:${digit.repeat(64)}`;',
  'const prepareStandaloneGoalJudgeInvocation=async()=>({',
  "configPath:'test',judgeRuntime:{},providerRef:'test-goal-judge',",
  "provider:{transport:'openai-compatible',apiStyle:'responses',model:'test-model',requestPolicy:{}},",
  "providerRegistryHash:hash('7'),credentialProviderRef:'test-goal-judge',credentialRevision:1,",
  'invoke:async({request})=>({',
  "schemaVersion:'requirements-contract-normalized-judge-response/v1',",
  "providerRef:'test-goal-judge',transport:'openai-compatible',configuredModel:'test-model',returnedModel:'test-model',",
  "decision:'pass',findings:[],challengeRequests:[],evidenceRefs:request.requiredCoverageRefs,",
  "providerRequestId:'request-1',requestHash:hash('8'),responseHash:hash('9'),",
  '}),});',
  'Promise.resolve(goalContractCommand({prepareStandaloneGoalJudgeInvocation}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');
const fakePartitionId = `partition-${'f'.repeat(64)}`;

function run(args: string[]) {
  return spawnSync(process.execPath, [CLI, 'goal-contract', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function runSource(args: string[]) {
  return spawnSync(process.execPath, [TSX, '-e', SOURCE_RUNNER, SOURCE_COMMAND, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [
      key,
      canonical((value as Record<string, unknown>)[key]),
    ])
  );
}

function stable(value: unknown): string {
  return `${JSON.stringify(canonical(value))}\n`;
}

function replaceCanonicalField(
  targetPath: string,
  fieldName: string,
  currentValue: string,
  nextValue: string
) {
  const current = readFileSync(targetPath, 'utf8');
  const replaced = current.replace(
    new RegExp(
      `("${fieldName}"\\s*:\\s*")${currentValue}(")`,
      'u'
    ),
    `$1${nextValue}$2`
  );
  expect(replaced).not.toBe(current);
  writeFileSync(targetPath, replaced, 'utf8');
}

function prepare() {
  const root = mkdtempSync(join(tmpdir(), 'partition-release-'));
  const source = join(root, 'source.md');
  const frozenGoal = join(root, 'frozen-goal-execution-plan.md');
  writeFileSync(source, [
    '# Plan', '', `Fixture root: ${root}`, '', '## File Map', '',
    '- Modify `src/partition-target.ts`.', '', '## Implementation Task Breakdown', '',
    '- [ ] TASK-1: MUST compile one selected child.', '',
    '## Acceptance Criteria', '', '- [ ] AC-1: MUST pass.', '',
    '## Required Test Commands', '', '- [ ] CMD-1: Run node --version.', '',
    '## Completion Evidence Packet', '', '- [ ] EVD-1: MUST bind current bytes.', '',
  ].join('\n'), 'utf8');
  const frozen = runSource(['generate', '--entry', 'standalone_goal_contract',
    '--source', source, '--out', frozenGoal, '--json']);
  expect(frozen.status, frozen.stderr || frozen.stdout).toBe(0);
  const governed = run(['partition', '--governed', '--entry', 'standalone_goal_contract',
    '--source', source, '--goal-contract', frozenGoal, '--json']);
  expect(governed.status, governed.stderr || governed.stdout).toBe(0);
  const governedPayload = JSON.parse(governed.stdout);
  const manifest = governedPayload.partitionManifestPath;
  const manifestObject = governedPayload.partitionManifest;
  const partitionId = manifestObject.topologicalOrder[0];
  const partition = manifestObject.partitions.find(
    (candidate: { partitionId: string }) => candidate.partitionId === partitionId
  );
  const child = join(ROOT, partition.childContractPath);
  return {
    root,
    source,
    manifest,
    child,
    partitionId,
    authorityRoot: governedPayload.authorityRoot,
    selectionReceiptPath: join(
      governedPayload.unitRoot,
      partition.selectionReceiptPath
    ),
    coverageReceiptPath: join(
      governedPayload.unitRoot,
      'receipts',
      'children',
      `${partitionId}.coverage.json`
    ),
    generationReceiptPath: join(
      governedPayload.unitRoot,
      'receipts',
      'children',
      `${partitionId}.generation.json`
    ),
  };
}

function cleanup(state: ReturnType<typeof prepare>) {
  rmSync(state.root, { recursive: true, force: true });
  rmSync(state.authorityRoot, { recursive: true, force: true });
}

function gate(runState: ReturnType<typeof prepare>) {
  return run(['release-gate', '--source', runState.source, '--goal', runState.child,
    '--coverage', runState.coverageReceiptPath, '--generation',
    runState.generationReceiptPath, '--partition-manifest', runState.manifest, '--release-receipt',
    join(runState.root, 'release.receipt.json'), '--json']);
}

describe('partition-aware public release gate', () => {
  it('passes a current child and auto-routes it away from whole-source validation', () => {
    const state = prepare();
    try {
      const result = gate(state);
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(JSON.parse(result.stdout).decision).toBe('pass');
    } finally {
      cleanup(state);
    }
  }, 60_000);

  it.each([
    ['partition_manifest_hash_mismatch', (s: ReturnType<typeof prepare>) => {
      const value = JSON.parse(readFileSync(s.manifest, 'utf8'));
      value.partitionSetHash = `sha256:${'e'.repeat(64)}`;
      writeFileSync(s.manifest, stable(value), 'utf8');
    }],
    ['partition_selection_binding_mismatch', (s: ReturnType<typeof prepare>) => {
      replaceCanonicalField(
        s.selectionReceiptPath,
        'partitionId',
        s.partitionId,
        fakePartitionId
      );
    }],
    ['partition_child_coverage_binding_mismatch', (s: ReturnType<typeof prepare>) => {
      replaceCanonicalField(
        s.coverageReceiptPath,
        'partitionId',
        s.partitionId,
        fakePartitionId
      );
    }],
    ['partition_child_generation_binding_mismatch', (s: ReturnType<typeof prepare>) => {
      replaceCanonicalField(
        s.generationReceiptPath,
        'partitionId',
        s.partitionId,
        fakePartitionId
      );
    }],
    ['partition_child_contract_hash_mismatch', (s: ReturnType<typeof prepare>) =>
      writeFileSync(s.child, `${readFileSync(s.child, 'utf8')}\nchanged\n`, 'utf8')],
  ] as const)(
    'blocks %s tampering with a structured reason',
    (reason, tamper) => {
      const state = prepare();
      try {
        tamper(state);
        const result = gate(state);
        expect(result.status).toBe(1);
        const payload = JSON.parse(result.stdout);
        const structuredReasons = [
          ...(Array.isArray(payload.blockingReasons)
            ? payload.blockingReasons
            : []),
          payload.failureClass,
        ].filter(Boolean);
        expect(
          structuredReasons,
          result.stderr || result.stdout
        ).toContain(reason);
      } finally {
        cleanup(state);
      }
    },
    60_000
  );
});
