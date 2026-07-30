const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { evaluatePartitionSequenceRelease } = require('../src/utils/goal-contract/release-gate.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  compileTypedCommandRecord,
  currentPartitionCompilerIdentityHash,
  partitionCompilerIdentityAssetPaths,
  selectCommandStructuredBindings,
} = require('../src/commands/goal-contract.ts');
const { makeRegistries } = require('../src/utils/goal-contract/slot-data-builder.ts');

const BIN = path.join(__dirname, '..', 'bin', 'bmad-speckit.js');
const SOURCE_COMMAND = path.join(__dirname, '..', 'src', 'commands', 'goal-contract.ts');
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');
const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-cli-'));
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN, 'goal-contract', ...args], {
    cwd: options.cwd || path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function runSourceCommand(args) {
  return spawnSync(process.execPath, ['-e', SOURCE_RUNNER, SOURCE_COMMAND, ...args], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function standaloneGenerateArgs(args) {
  return ['generate', '--entry', 'standalone_goal_contract', ...args];
}

describe('partition compiler identity', () => {
  it('binds every byte-producing and authority-validating supersession asset', () => {
    const assetPaths = partitionCompilerIdentityAssetPaths();
    const normalized = assetPaths.map((assetPath) =>
      path.relative(path.join(__dirname, '..', '..', '..'), assetPath).replace(/\\/gu, '/')
    );
    for (const requiredPath of [
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/authority-supersession.ts',
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/campaign-activation.ts',
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/campaign-closure.ts',
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/campaign-receipt-store.ts',
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/subcontract-closure.ts',
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/subcontract-evidence.ts',
      'packages/bmad-speckit/src/utils/goal-contract/goal-contract-receipts.ts',
      'packages/bmad-speckit/src/utils/goal-contract/partition-receipts.ts',
      'packages/bmad-speckit/src/utils/goal-contract/partition-selector.ts',
      'packages/bmad-speckit/src/utils/goal-contract/release-gate.ts',
      '_bmad/shared/goal-contract/scripts/render-goal-contract.js',
      '_bmad/shared/goal-contract/scripts/check-contract-command-portability.js',
      '_bmad/shared/goal-contract/goal-contract-campaign-activation-receipt.schema.json',
      '_bmad/shared/goal-contract/goal-contract-campaign-closure-receipt.schema.json',
      '_bmad/shared/goal-contract/goal-contract-profile.json',
      '_bmad/shared/goal-contract/goal-contract-partition-release-gate-receipt.schema.json',
      '_bmad/shared/goal-contract/goal-contract-subcontract-closure-receipt.schema.json',
      '_bmad/shared/goal-contract/goal-contract-subcontract-evidence.schema.json',
      '_bmad/shared/goal-contract/goal-contract-subcontract-execution-lease.schema.json',
      '_bmad/shared/goal-contract/goal-execution-contract-template.md',
      '_bmad/shared/goal-contract/goal-contract-partition-plan.schema.json',
      '_bmad/shared/goal-contract/goal-contract-execution-projection.schema.json',
      '_bmad/shared/goal-contract/goal-contract-partition-manifest.schema.json',
      '_bmad/shared/goal-contract/goal-contract-authority-supersession-receipt.schema.json',
      '_bmad/shared/goal-contract/goal-contract-source-grounded-coverage-receipt.schema.json',
    ]) {
      assert.ok(normalized.includes(requiredPath), `compiler identity is missing ${requiredPath}`);
    }
    assert.equal(
      currentPartitionCompilerIdentityHash(),
      hashControlPlaneValue(
        assetPaths
          .map((assetPath) => ({
            path: path.resolve(assetPath).replace(/\\/gu, '/'),
            sha256: hash(fs.readFileSync(assetPath)),
          }))
          .sort((left, right) => left.path.localeCompare(right.path))
      )
    );
  });

  it('resolves compiler identity assets from the built runtime', () => {
    const builtCommand = require('../dist/commands/goal-contract.js');
    const assetPaths = builtCommand.partitionCompilerIdentityAssetPaths();

    assert.ok(assetPaths.length > 0);
    assert.ok(assetPaths.every((assetPath) => fs.existsSync(assetPath)));
    assert.match(builtCommand.currentPartitionCompilerIdentityHash(), /^sha256:[0-9a-f]{64}$/u);
  });
});

describe('typed command classification', () => {
  const obligation = (overrides) => ({
    id: 'SRC-TEST',
    kind: 'command_block',
    declaredId: false,
    applicabilityState: 'applicable',
    exactText: 'not executable',
    sourcePlanPath: 'docs/plans/source.md',
    lineStart: 10,
    lineEnd: 10,
    textHash: hash('not executable'),
    specSpanRefs: [],
    ...overrides,
  });

  it('uses explicit command authority without merging heuristic blocks', () => {
    const declaredCommandId = 'FIXTURE-CMD17';
    const declared = obligation({
      id: declaredCommandId,
      kind: 'verification_command',
      declaredId: true,
      exactText: `- [ ] ${declaredCommandId}: Run \`node --test compiler.test.js\`.`,
    });
    const selected = selectCommandStructuredBindings([
      declared,
      obligation({
        id: 'SRC-YAML',
        exactText: '```yaml\nmode: composite_required\n```',
      }),
      obligation({
        id: 'SRC-PATH',
        exactText: '`packages/example.test.js`',
      }),
    ]);

    assert.deepEqual(
      selected.commands.map(({ id }) => id),
      [declared.id]
    );
    assert.deepEqual(compileTypedCommandRecord(declared), {
      id: declared.id,
      literal: 'node --test compiler.test.js',
      commandTextHash: hash('node --test compiler.test.js'),
      workingDirectory: '.',
      shell: 'host_shell',
      runtime: 'node',
      sourceBinding: {
        sourcePlanPath: 'docs/plans/source.md',
        lineStart: 10,
        lineEnd: 10,
        textHash: hash('not executable'),
        specSpanRefs: [],
      },
    });
  });

  it('accepts only executable shell fences when no explicit registry exists', () => {
    const selected = selectCommandStructuredBindings([
      obligation({
        id: 'SRC-POWERSHELL',
        exactText: '```powershell\nnode --test compiler.test.js\n```',
        lineStart: 20,
        lineEnd: 22,
      }),
      obligation({
        id: 'SRC-YAML',
        exactText: '```yaml\nmode: composite_required\n```',
      }),
      obligation({
        id: 'SRC-SCALAR',
        exactText: '`$LASTEXITCODE`',
      }),
    ]);

    assert.deepEqual(
      selected.commands.map(({ id }) => id),
      ['SRC-POWERSHELL']
    );
    assert.equal(compileTypedCommandRecord(selected.commands[0]).shell, 'powershell');
  });
});

describe('typed goal registry projection', () => {
  it('keeps legacy checklist task records on the legacy projection path', () => {
    const sourceObligations = [
      {
        id: 'SRC001',
        kind: 'declared_execution_task',
        declaredSourceId: 'PRIMARY-TASK',
        headingPath: ['Primary Authority', 'PRIMARY-TASK'],
        exactText: '- PRIMARY-TASK: MUST preserve canonical source authority.',
        text: '- PRIMARY-TASK: MUST preserve canonical source authority.',
      },
      {
        id: 'SRC002',
        kind: 'completion_criteria',
        declaredSourceId: 'PRIMARY-EVIDENCE',
        headingPath: ['Primary Authority', 'Completion Evidence'],
        exactText: '- PRIMARY-EVIDENCE: MUST record deterministic compilation evidence.',
        text: '- PRIMARY-EVIDENCE: MUST record deterministic compilation evidence.',
      },
    ];

    const registries = makeRegistries(sourceObligations);

    assert.equal(registries.projectionMode, 'legacy');
    assert.deepEqual(registries.tasks, ['G001', 'G002']);
    assert.deepEqual(registries.acceptance, ['ACC001', 'ACC002']);
  });

  it('preserves declared task records without synthesizing one task per obligation', () => {
    const taskHeading = ['Judge Plan', 'Task J01-T01: Implement actor authority'];
    const sourceObligations = [
      {
        id: 'SRC001',
        kind: 'declared_execution_task',
        declaredSourceId: 'J01-T01',
        headingPath: taskHeading,
        exactText: 'Task J01-T01: Implement actor authority',
        text: 'Task J01-T01: Implement actor authority',
      },
      {
        id: 'SRC002',
        kind: 'heading_requirement',
        declaredSourceId: null,
        headingPath: taskHeading,
        text: '- Preserve actor authority.',
      },
      {
        id: 'SRC003',
        kind: 'acceptance_condition',
        declaredSourceId: 'AC-J01-T01-01',
        headingPath: taskHeading,
        text: '- AC-J01-T01-01: Actor authority is deterministic.',
      },
      {
        id: 'SRC004',
        kind: 'evidence_contract',
        declaredSourceId: 'EVD-J01-T01-01',
        headingPath: taskHeading,
        text: '- EVD-J01-T01-01: Actor authority receipt.',
      },
      {
        id: 'SRC005',
        kind: 'verification_command',
        declaredSourceId: 'CMD-J01-T01-01',
        headingPath: taskHeading,
        text: '- CMD-J01-T01-01: Run `node --version`.',
      },
    ];

    const registries = makeRegistries(sourceObligations);

    assert.deepEqual(registries.tasks, ['J01-T01']);
    assert.deepEqual(registries.acceptance, ['AC-J01-T01-01']);
    assert.deepEqual(registries.evidence, ['EVD-J01-T01-01']);
    assert.deepEqual(registries.commands, ['CMD-J01-T01-01']);
    assert.equal(
      registries.sourceObligations.every(
        (obligation) =>
          obligation.goalTaskRefs.length === 1 && obligation.goalTaskRefs[0] === 'J01-T01'
      ),
      true
    );
  });
});

describe('partition Sequence release authority', () => {
  it('allows explicit disabled core-only authority while blocking unresolved active modes', () => {
    const cases = [
      {
        state: {
          sequenceMode: 'disabled',
          sequenceApplicability: 'not_applicable_with_proof',
          sequenceCoverage: 'not_applicable',
          sequenceClosureStatus: 'not_required',
          childContractAuthority: 'full',
        },
        expectedDecision: 'pass',
      },
      {
        state: {
          sequenceMode: 'disabled',
          sequenceApplicability: 'required',
          sequenceCoverage: 'excluded',
          sequenceClosureStatus: 'not_requested',
          childContractAuthority: 'core_only',
        },
        expectedDecision: 'pass',
      },
      {
        state: {
          sequenceMode: 'auto',
          sequenceApplicability: 'unresolved',
          sequenceCoverage: 'unresolved',
          sequenceClosureStatus: 'not_requested',
          childContractAuthority: 'core_only',
        },
        expectedDecision: 'blocked',
        expectedReason: 'partition_sequence_applicability_unresolved',
      },
      {
        state: {
          sequenceMode: 'auto',
          sequenceApplicability: 'required',
          sequenceCoverage: 'complete',
          sequenceClosureStatus: 'compiled',
          childContractAuthority: 'full',
        },
        expectedDecision: 'pass',
      },
    ];

    for (const { state, expectedDecision, expectedReason } of cases) {
      const result = evaluatePartitionSequenceRelease({
        binding: state,
        childGeneration: state,
        currentManifest: state,
        projectionBinding: {
          sequenceMode: state.sequenceMode,
          applicabilityDecision: state.sequenceApplicability,
          sequenceCoverage: state.sequenceCoverage,
          sequenceClosureStatus: state.sequenceClosureStatus,
          childContractAuthority: state.childContractAuthority,
        },
      });

      assert.equal(result.decision, expectedDecision);
      assert.equal(result.componentDecision, expectedDecision);
      if (expectedReason) {
        assert.ok(result.blockingReasons.includes(expectedReason));
      } else {
        assert.deepEqual(result.blockingReasons, []);
      }
    }
  });
});

function writeSourcePlan(root) {
  const sourcePath = path.join(root, 'source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Source Plan',
      '',
      '## Problem Statement',
      '',
      'The generator must prove source coverage.',
      '',
      '## File Map',
      '',
      '- Create `packages/bmad-speckit/src/commands/goal-contract.ts`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Add package CLI',
      '',
      '- [ ] TASK-CMD: MUST parse `--source`, `--out`, and `--json`.',
      '',
      'Run:',
      '',
      '```powershell',
      'npx --no-install bmad-speckit goal-contract generate --source docs/plans/source.md --out docs/plans/goal.md --json',
      '```',
      '',
      '## Completion Evidence Packet',
      '',
      '- Coverage receipt and generation receipt must exist.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-CMD: MUST prove the public command result.',
      '',
      '## Decision',
      '',
      'This repair blocks release until coverage passes.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function writePartitionSourcePlan(root) {
  const sourcePath = path.join(root, 'partition-source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Partition Source Plan',
      '',
      '## Implementation Task Breakdown',
      '',
      '- [ ] TASK-PARTITION: MUST compile one execution projection.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-PARTITION: MUST reach the optimizer boundary.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-PARTITION: MUST bind the current source roots.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-PARTITION: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

describe('bmad-speckit goal-contract command', () => {
  it('atomically supersedes a legacy partition authority with current v2 children', () => {
    const root = tempRoot();
    const source = writePartitionSourcePlan(root);
    const oldManifestPath = path.join(root, 'legacy-manifest.json');
    const partitionResult = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      oldManifestPath,
      '--sequence-mode',
      'disabled',
      '--json',
    ]);
    assert.equal(partitionResult.status, 0, partitionResult.stderr || partitionResult.stdout);
    const oldManifest = JSON.parse(fs.readFileSync(oldManifestPath, 'utf8'));
    const children = oldManifest.partitions.map((partition, index) => {
      const outputPath = path.join(root, 'legacy-children', `p${index + 1}-goal-execution-plan.md`);
      const generated = runSourceCommand([
        'generate',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--partition-manifest',
        oldManifestPath,
        '--partition-id',
        partition.partitionId,
        '--out',
        outputPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ]);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      const outputHash = hash(fs.readFileSync(outputPath));
      return {
        ordinal: index + 1,
        partitionId: partition.partitionId,
        primaryTaskIds: partition.primaryTaskIds,
        outputPath,
        outputHash,
        goalContractHash: outputHash,
        decision: 'pass',
      };
    });
    oldManifest.partitions[0].commandIds = [];
    fs.writeFileSync(oldManifestPath, `${JSON.stringify(oldManifest, null, 2)}\n`, 'utf8');
    const oldManifestHash = hash(fs.readFileSync(oldManifestPath));
    const childrenSummaryPath = path.join(root, 'children-summary.json');
    fs.writeFileSync(
      childrenSummaryPath,
      `${JSON.stringify(
        {
          schemaVersion: 'goal-contract-partition-children-summary/v1',
          ok: true,
          expectedCount: children.length,
          generatedCount: children.length,
          sourceHash: hash(fs.readFileSync(source)),
          manifestPath: oldManifestPath,
          manifestHash: oldManifestHash,
          partitionSetHash: oldManifest.partitionSetHash,
          failures: [],
          children,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    const oldChildHashes = children.map(({ outputPath }) => hash(fs.readFileSync(outputPath)));
    const authorityRoot = path.join(root, 'authority-v2');
    const superseded = runSourceCommand([
      'supersede-authority',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--superseded-parent-hash',
      hash(fs.readFileSync(source)),
      '--superseded-manifest',
      oldManifestPath,
      '--superseded-manifest-hash',
      oldManifestHash,
      '--superseded-partition-set-hash',
      oldManifest.partitionSetHash,
      '--children-summary',
      childrenSummaryPath,
      '--children-summary-hash',
      hash(fs.readFileSync(childrenSummaryPath)),
      '--attempt-id',
      'bootstrap-supersession-test',
      '--supersession-mode',
      'source_grounded_hard_cut',
      '--out-root',
      authorityRoot,
      '--sequence-mode',
      'disabled',
      '--json',
    ]);
    assert.equal(superseded.status, 0, superseded.stderr || superseded.stdout);
    const payload = JSON.parse(superseded.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.partitionCount, children.length);
    assert.equal(payload.atomicPromotion, true);
    assert.equal(payload.supersessionMode, 'source_grounded_hard_cut');
    assert.equal(payload.activationMode, 'successor_only');
    assert.equal(payload.supersededDisposition, 'superseded_non_executable');
    assert.equal(
      fs.existsSync(path.join(authorityRoot, 'receipts', 'source-grounded-coverage.receipt.json')),
      true
    );
    assert.equal(hash(fs.readFileSync(oldManifestPath)), oldManifestHash);
    assert.deepEqual(
      children.map(({ outputPath }) => hash(fs.readFileSync(outputPath))),
      oldChildHashes
    );
    const finalManifest = JSON.parse(fs.readFileSync(payload.partitionManifestPath, 'utf8'));
    assert.equal(finalManifest.schemaVersion, 'goal-contract-partition-manifest/v2');
    assert.equal(finalManifest.partitionCount, children.length);
    assert.ok(fs.existsSync(path.join(authorityRoot, 'authority-supersession.receipt.json')));
    for (const partition of finalManifest.partitions) {
      const childPath = path.join(authorityRoot, partition.childContractPath);
      const text = fs.readFileSync(childPath, 'utf8');
      assert.match(text, /^partitionPlanHash: sha256:/mu);
      assert.doesNotMatch(text, /^partitionManifestHash:/mu);
      assert.doesNotMatch(text, /\bundefined\b/u);
    }
  });

  it('generates a source-covered goal contract with coverage and generation receipts', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', source, '--out', out, '--json']));

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.unmappedSourceObligations, 0);
    assert.ok(payload.sourceObligationCount > 0);
    assert.match(payload.sourcePlanHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(payload.goalContractHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(Object.hasOwn(payload, 'partitionId'), false);
    assert.equal(Object.hasOwn(payload, 'partitionManifestPath'), false);
    assert.ok(fs.existsSync(out));
    assert.ok(fs.existsSync(payload.coverageReceiptPath));
    assert.ok(fs.existsSync(payload.generationReceiptPath));

    const goalText = fs.readFileSync(out, 'utf8');
    assert.match(goalText, /sourceBytes: \d+/u);
    assert.match(goalText, /sourceLines: \d+/u);
    assert.match(goalText, /goalContractProfileVersion: 2\.1\.0/u);
    assert.match(goalText, /entryScenario: standalone_goal_contract/u);
    assert.match(goalText, /finalArtifactAuthority: standalone_goal_execution_plan_markdown/u);
    assert.match(goalText, /coverageReceiptPath:/u);
    assert.match(goalText, /generationReceiptPath:/u);
    assert.match(goalText, /unmappedSourceObligations: 0/u);
    assert.match(goalText, /## Source Coverage Matrix/u);
    assert.match(goalText, /\| SRC001 \|/u);
    assert.match(
      goalText,
      /npx --no-install bmad-speckit goal-contract generate --source docs\/plans\/source\.md --out docs\/plans\/goal\.md --json/u
    );
    assert.doesNotMatch(goalText, /rg -n -F 'SRC001' -- '.*source-plan\.md'/u);
    assert.doesNotMatch(goalText, /rg -n -F 'SRC\d{3}'.*coverage\.json/u);
    assert.match(goalText, /sourceTextHash=sha256:[0-9a-f]{64}/u);
    assert.match(goalText, /standalone Markdown contract is the frozen execution authority/u);

    const coverage = JSON.parse(fs.readFileSync(payload.coverageReceiptPath, 'utf8'));
    const generation = JSON.parse(fs.readFileSync(payload.generationReceiptPath, 'utf8'));
    assert.equal(coverage.decision, 'pass');
    assert.deepEqual(coverage.unmappedSourceObligations, []);
    assert.equal(coverage.sourcePlanHash, payload.sourcePlanHash);
    assert.equal(coverage.goalContractHash, payload.goalContractHash);
    assert.equal(generation.coverageReceiptPath, payload.coverageReceiptPath);
    assert.equal(generation.goalContractHash, payload.goalContractHash);
    assert.equal(payload.implementationProofAudit.decision, 'pass');
    assert.equal(generation.implementationProofAudit.decision, 'pass');
    assert.equal(
      generation.implementationProofAudit.coverageOnlyCommandAllowedForCodeObligations,
      false
    );
    assert.equal(payload.deterministicPreflight.decision, 'pass');
    assert.equal(payload.deterministicPreflight.auditEpochAllowed, true);
    assert.equal(payload.auditMetrics.auditEpochOpened, false);
    assert.deepEqual(payload.auditMetrics.sequence, ['deterministic_preflight']);
    assert.equal(payload.auditProfile.finalDocsReviewRequired, false);
    assert.deepEqual(generation.deterministicPreflight, payload.deterministicPreflight);
    assert.equal(generation.writeReceipt.schemaVersion, 'large-document-writer-safe-write/v1');
  });

  it('generates typed parent projections from explicit structured records', () => {
    const root = tempRoot();
    const source = path.join(root, 'structured-goal-source.md');
    const out = path.join(root, 'structured-goal-execution-plan.md');
    fs.writeFileSync(
      source,
      [
        '# Structured Goal Source',
        '',
        '## Implementation Tasks',
        '',
        '### Task J01-T01: Implement actor authority',
        '',
        '- Target modification paths:',
        '  - `src/runtime/actor.ts`',
        '- Requirements:',
        '  - Preserve actor authority.',
        '- AC-J01-T01-01: Actor authority is deterministic.',
        '- EVD-J01-T01-01: Actor authority receipt.',
        '- CMD-J01-T01-01: Run `node --version`.',
        '',
        '### Task J02-T01: Implement judge transport',
        '',
        '- Dependencies: J01-T01.',
        '- Target modification paths:',
        '  - `src/runtime/judge.ts`',
        '- Requirements:',
        '  - Preserve judge transport.',
        '- AC-J02-T01-01: Judge transport is deterministic.',
        '- EVD-J02-T01-01: Judge transport receipt.',
        '- CMD-J02-T01-01: Run `node --version`.',
        '',
      ].join('\n'),
      'utf8'
    );

    const result = runSourceCommand(
      standaloneGenerateArgs(['--source', source, '--out', out, '--json'])
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    const goalText = fs.readFileSync(out, 'utf8');
    const taskHeadings = [...goalText.matchAll(/^### (J\d{2}-T\d+[A-Z]?)\b/gmu)].map(
      (match) => match[1]
    );
    assert.deepEqual(taskHeadings, ['J01-T01', 'J02-T01']);
    assert.doesNotMatch(goalText, /^### G\d+/gmu);
    assert.match(goalText, /^projectionMode: typed$/mu);
    assert.match(goalText, /^taskRange: J01-T01\.\.J02-T01$/mu);
    assert.match(goalText, /^acceptanceRange: AC-J01-T01-01\.\.AC-J02-T01-01$/mu);

    const acceptanceSection = goalText
      .split('## Strict Acceptance Checklist')[1]
      .split('## Acceptance Traceability Matrix')[0];
    assert.deepEqual(
      [...acceptanceSection.matchAll(/^- \[ \] (AC-[A-Z0-9-]+):/gmu)].map((match) => match[1]),
      ['AC-J01-T01-01', 'AC-J02-T01-01']
    );

    const traceSection = goalText
      .split('## Acceptance Traceability Matrix')[1]
      .split('## Source Coverage Matrix')[0];
    assert.deepEqual(
      [...traceSection.matchAll(/^\| (AC-[A-Z0-9-]+) \|/gmu)].map((match) => match[1]),
      ['AC-J01-T01-01', 'AC-J02-T01-01']
    );

    const commandSection = goalText
      .split('## Required Test Commands')[1]
      .split('## Manual Verification Scenarios')[0];
    assert.deepEqual(
      [...commandSection.matchAll(/^### \d+\. COMMAND (CMD-[A-Z0-9-]+)$/gmu)].map(
        (match) => match[1]
      ),
      ['CMD-J01-T01-01', 'CMD-J02-T01-01']
    );
    assert.equal([...commandSection.matchAll(/^node --version$/gmu)].length, 2);
    assert.match(goalText, /EVD-J01-T01-01/u);
    assert.match(goalText, /EVD-J02-T01-01/u);

    const coverage = JSON.parse(fs.readFileSync(payload.coverageReceiptPath, 'utf8'));
    const uniqueRefs = (field) =>
      [
        ...new Set(coverage.sourceObligations.flatMap((obligation) => obligation[field] || [])),
      ].sort();
    assert.deepEqual(uniqueRefs('goalTaskRefs'), ['J01-T01', 'J02-T01']);
    assert.deepEqual(uniqueRefs('acceptanceRefs'), ['AC-J01-T01-01', 'AC-J02-T01-01']);
    assert.deepEqual(uniqueRefs('evidenceRefs'), ['EVD-J01-T01-01', 'EVD-J02-T01-01']);
    assert.deepEqual(uniqueRefs('commandRefs'), ['CMD-J01-T01-01', 'CMD-J02-T01-01']);
  });

  it('keeps standalone compilation byte-identical and authority-derived', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'deterministic-goal-execution-plan.md');
    const args = standaloneGenerateArgs(['--source', source, '--out', out, '--json']);

    const firstResult = runSourceCommand(args);
    assert.equal(firstResult.status, 0, firstResult.stderr || firstResult.stdout);
    const firstPayload = JSON.parse(firstResult.stdout);
    const firstBytes = fs.readFileSync(out);

    const secondResult = runSourceCommand(args);
    assert.equal(secondResult.status, 0, secondResult.stderr || secondResult.stdout);
    const secondPayload = JSON.parse(secondResult.stdout);
    const secondBytes = fs.readFileSync(out);

    assert.equal(Buffer.compare(firstBytes, secondBytes), 0);
    for (const field of [
      'goalContractSemanticHash',
      'goalContractHash',
      'goalContractDocumentHash',
      'sourceCompositionPolicyHash',
      'orderedSourceSnapshotSetHash',
      'sourceAuthorityBundleHash',
      'canonicalIntentSemanticHash',
      'canonicalIntentBundleHash',
      'authorityAttestationHash',
      'compilePolicyHash',
      'compilerIdentityHash',
    ]) {
      assert.match(firstPayload[field], /^sha256:[0-9a-f]{64}$/u);
      assert.equal(firstPayload[field], secondPayload[field]);
    }
    assert.equal(
      firstPayload.runtimeRecordId,
      `GOAL-CONTRACT-${firstPayload.goalContractHash.slice(7)}`
    );
    assert.equal(firstPayload.runtimeRecordId, secondPayload.runtimeRecordId);
    assert.equal(firstPayload.sourceCompositionMode, 'single_source');
    assert.deepEqual(firstPayload.subordinateSourceCoverageReceiptHashes, []);
    assert.match(firstBytes.toString('utf8'), /generatedAt: 1970-01-01T00:00:00\.000Z/u);
    assert.match(
      firstBytes.toString('utf8'),
      new RegExp(`runtimeRecordId: ${firstPayload.runtimeRecordId}`, 'u')
    );
    assert.doesNotMatch(
      firstBytes.toString('utf8'),
      new RegExp(firstPayload.compilationReceipt.compiledAt, 'u')
    );
    assert.equal(
      firstPayload.compilationReceipt.goalContractDocumentHash,
      firstPayload.goalContractDocumentHash
    );
  });

  it('assigns each command block its own command reference', () => {
    const root = tempRoot();
    const sourcePath = path.join(root, 'multi-command-source-plan.md');
    fs.writeFileSync(
      sourcePath,
      [
        '# Multi Command Plan',
        '',
        '## File Map',
        '',
        '- Modify `packages/bmad-speckit/src/commands/goal-contract.ts`.',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task 1: First command',
        '',
        '- MUST run the first command block.',
        '',
        '```powershell',
        'node --test packages/bmad-speckit/tests/goal-contract-command.test.js',
        '```',
        '',
        '### Task 2: Second command',
        '',
        '- MUST run the second command block.',
        '',
        '```powershell',
        'node --test packages/bmad-speckit/tests/goal-contract-implementation-proof.test.js',
        '```',
      ].join('\n'),
      'utf8'
    );
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', sourcePath, '--out', out, '--json']));

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const goalText = fs.readFileSync(out, 'utf8');
    const commandHeadings = [...goalText.matchAll(/### \d+\. COMMAND (CMD\d{3})/gu)].map(
      (match) => match[1]
    );

    assert.equal(commandHeadings.length, 2);
    assert.notEqual(commandHeadings[0], commandHeadings[1]);
    assert.match(
      goalText,
      /node --test packages\/bmad-speckit\/tests\/goal-contract-command\.test\.js/u
    );
    assert.match(
      goalText,
      /node --test packages\/bmad-speckit\/tests\/goal-contract-implementation-proof\.test\.js/u
    );
  });

  it('returns a stable JSON failure when the source path is missing', () => {
    const root = tempRoot();
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(
      standaloneGenerateArgs(['--source', path.join(root, 'missing.md'), '--out', out, '--json'])
    );

    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.failureClass, 'source_plan_missing');
  });

  it('awaits async partition promotion and emits exactly one JSON object', () => {
    const root = tempRoot();
    const source = writePartitionSourcePlan(root);
    const out = path.join(root, 'partition-manifest.json');
    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      out,
      '--json',
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, '');
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.globalCoverageDecision, 'pass');
    assert.equal(payload.selectionReceiptCount, payload.partitionCount);
    assert.equal(result.stdout.trim().startsWith('{'), true);
    assert.equal(result.stdout.trim().endsWith('}'), true);
    assert.equal(fs.existsSync(out), true);
  });

  it('fails closed before writing a contract with non-portable PowerShell Git revisions', () => {
    const root = tempRoot();
    const sourcePath = path.join(root, 'non-portable-command-plan.md');
    const out = path.join(root, 'goal-execution-plan.md');
    fs.writeFileSync(
      sourcePath,
      [
        '# Non-Portable Command Plan',
        '',
        '## File Map',
        '',
        '- Modify `packages/bmad-speckit/src/commands/goal-contract.ts`.',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task 1: Capture the tree hash',
        '',
        '- MUST capture the current Git tree hash.',
        '',
        '```powershell',
        'git rev-parse HEAD^{tree}',
        '```',
      ].join('\n'),
      'utf8'
    );

    const result = runCli(standaloneGenerateArgs(['--source', sourcePath, '--out', out, '--json']));

    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.failureClass, 'command_portability_failed');
    assert.equal(payload.commandPortabilityAudit.status, 'FAIL');
    assert.ok(payload.commandPortabilityAudit.issueCount >= 1);
    assert.equal(payload.deterministicPreflight.decision, 'block');
    assert.equal(payload.deterministicPreflight.auditEpochAllowed, false);
    assert.ok(
      payload.deterministicPreflight.issues.some((issue) => issue.checkId === 'command_portability')
    );
    assert.equal(fs.existsSync(out), false);
  });

  it('fails closed when entry selection is missing, unknown, or duplicated', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'goal-execution-plan.md');
    const cases = [
      {
        args: ['generate', '--source', source, '--out', out, '--json'],
        failureClass: 'entry_missing',
      },
      {
        args: ['generate', '--entry', 'unknown', '--source', source, '--out', out, '--json'],
        failureClass: 'entry_unknown',
      },
      {
        args: [
          'generate',
          '--entry',
          'standalone_goal_contract',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--out',
          out,
          '--json',
        ],
        failureClass: 'entry_duplicated',
      },
    ];

    for (const testCase of cases) {
      const result = runCli(testCase.args);
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stdout).failureClass, testCase.failureClass);
      assert.equal(fs.existsSync(out), false);
    }
  });

  it('rejects incompatible entry routes, output sets, and missing authority', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const cases = [
      {
        args: [
          'generate',
          '--entry',
          'req_trace_direct',
          '--source',
          source,
          '--out',
          path.join(root, 'goal-execution-plan.md'),
          '--json',
        ],
        failureClass: 'entry_route_mismatch',
      },
      {
        args: standaloneGenerateArgs([
          '--source',
          source,
          '--out',
          path.join(root, 'model_packet.json'),
          '--json',
        ]),
        failureClass: 'entry_output_set_mismatch',
      },
      {
        args: standaloneGenerateArgs([
          '--out',
          path.join(root, 'goal-execution-plan.md'),
          '--json',
        ]),
        failureClass: 'entry_source_authority_missing',
      },
    ];

    for (const testCase of cases) {
      const result = runCli(testCase.args);
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stdout).failureClass, testCase.failureClass);
    }
  });
});
