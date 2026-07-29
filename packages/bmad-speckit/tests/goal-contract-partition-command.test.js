const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SOURCE_COMMAND = path.join(PACKAGE_ROOT, 'src', 'commands', 'goal-contract.ts');
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');
const {
  buildSourceSnapshot,
} = require('../src/utils/goal-contract/dual-view-derivation.ts');
const {
  loadPartitionMethodologyProfile,
} = require('../src/utils/goal-contract/partition-methodology-profile.ts');
const {
  loadRepositoryFacts,
} = require('../src/utils/goal-contract/repository-facts.ts');
const {
  createGoalContractSemanticProvider,
} = require('../src/utils/goal-contract/semantic-provider-registry.ts');
const {
  buildPartitionSlotData,
} = require('../src/utils/goal-contract/slot-data-builder.ts');
const {
  extractSourceObligations,
} = require('../src/utils/goal-contract/source-obligation-extractor.ts');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-partition-cli-'));
}

function writeSourcePlan(root) {
  const sourcePath = path.join(root, 'source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Partition Source Plan',
      '',
      '## Implementation Task Breakdown',
      '',
      '- [ ] TASK-001: MUST create deterministic partition input.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-001: MUST prove exact source coverage.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-001: MUST bind the exact source bytes.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-001: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function writeSemanticSourcePlan(root) {
  const sourcePath = path.join(root, 'semantic-source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Semantic Partition Source Plan',
      '',
      '## Implementation Task Breakdown',
      '',
      '- [ ] TASK-SEM: MUST derive implementation semantics.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-SEM: MUST prove semantic completion.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-SEM: MUST bind semantic provider receipts.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function writeCanonicalRegressionPlan(root) {
  const sourcePath = path.join(root, 'canonical-regression-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Canonical-Shaped Partition Source Plan',
      '',
      '> Workers may inspect evidence, but they must not modify repository files.',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Task P01-T01: Publish and Load the Partition Methodology Profile',
      '',
      '```json',
      '{',
      '  "rules": [',
      '    {"ruleId":"PM-001","normativeRule":"Preserve complete requirement coverage."},',
      '    {"ruleId":"PM-002","normativeRule":"Validate dependency direction."}',
      '  ]',
      '}',
      '```',
      '',
      'The schema must constrain classification to the three allowed values.',
      '',
      'Add optional `--release-receipt`; otherwise use the default receipt path.',
      '',
      '### Task P04-T04: Bind Shared-Artifact Changes to Dependency Compatibility Receipts',
      '',
      '- [ ] P05-T01: Dependencies: P04-T04; mention PM-001 as evidence.',
      '',
      '## P03 Slice Gate',
      '',
      '- Different source shapes can produce different counts.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-P03: MUST preserve canonical source coverage.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-P03: Run `node --version`.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-P03: MUST preserve the canonical regression evidence.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function runSourceCommand(args, options = {}) {
  const sourceCommand = options.sourceCommand || SOURCE_COMMAND;
  return spawnSync(process.execPath, ['-e', SOURCE_RUNNER, sourceCommand, ...args], {
    cwd: options.cwd || PACKAGE_ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) },
  });
}

function hash(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function writeProviderFixture(root) {
  const providerRoot = path.join(root, 'provider-root');
  const directory = path.join(providerRoot, '_bmad', 'shared', 'goal-contract');
  const invocationLog = path.join(providerRoot, 'provider-invocations.jsonl');
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(
    path.join(
      REPO_ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-contract-semantic-provider-registry.schema.json'
    ),
    path.join(directory, 'goal-contract-semantic-provider-registry.schema.json')
  );
  const script = path.join(providerRoot, 'provider.cjs');
  fs.writeFileSync(
    script,
    String.raw`
const fs=require('node:fs');let raw='';process.stdin.on('data',c=>raw+=c);process.stdin.on('end',()=>{const q=JSON.parse(raw);fs.appendFileSync(${JSON.stringify(invocationLog)},q.roleContract+'\n','utf8');
const sourceRecords=q.sourceObligationGraph.obligations;const sourceIds=sourceRecords.map(o=>o.id);const sourceRecord=sourceRecords[0];const crypto=require('node:crypto');const literal='node --version';const commandTextHash='sha256:'+crypto.createHash('sha256').update(literal).digest('hex');const commandId='command-'+crypto.createHash('sha256').update(sourceRecord.id+'\0'+literal).digest('hex').slice(0,16);const command={id:commandId,literal,commandTextHash,workingDirectory:'.',shell:'host_shell',runtime:'node',sourceBinding:{sourcePlanPath:sourceRecord.sourcePlanPath,lineStart:sourceRecord.lineStart,lineEnd:sourceRecord.lineEnd,textHash:sourceRecord.textHash,specSpanRefs:sourceRecord.specSpanRefs||[]},expectedExitBehavior:'exits zero',productionEntryPoint:'goalContractCommand',evidenceType:'behavior',provenanceFields:['argv','cwd','exitCode'],freshnessRule:'current source roots'};
const implementation={tasks:[{id:'semantic-task',title:'Semantic task',sourceIds}],traceSlices:[{id:'semantic-slice',goalIds:['semantic-task'],sourceIds,acceptanceIds:['semantic-acceptance'],evidenceIds:['semantic-evidence'],productionSymbols:['goalContractCommand'],allowedPaths:['packages/bmad-speckit/src/commands/goal-contract.ts'],directCommands:[commandId],impactedCommands:[commandId],dependencies:[],commitPolicy:'exactly_one_atomic_commit',closeCondition:'Semantic task is observable.'}],productionSymbols:['goalContractCommand'],allowedPaths:['packages/bmad-speckit/src/commands/goal-contract.ts'],commands:{direct:[command],impacted:[command],integration:[command],regression:[command]},dependencies:[],commitPolicy:'exactly_one_atomic_commit',closeConditions:['Semantic task is observable.'],synchronizationObligations:['package-source'],commandEvidenceStrength:{[commandId]:'behavior'}};
const acceptance={acceptanceItems:[{id:'semantic-acceptance',sourceIds,goalIds:['semantic-task'],traceIds:['semantic-slice'],requiredCommands:[commandId],expectedEvidenceIds:['semantic-evidence'],requiredEvidenceStrength:'behavior',passCondition:'Semantic completion passes.'}],negativeControls:['Missing semantics block.'],productionEntryPoints:['goalContractCommand'],manualScenarios:['Run the public command.'],expectedEvidence:[{id:'semantic-evidence',sourceIds,producer:commandId,admissibleTypes:['behavior'],freshnessRule:'current source roots'}],antiCheatRules:['No fixture authority.'],stopConditions:['Semantic conflict blocks.']};
const result=q.roleContract.includes('implementation')?implementation:acceptance;process.stdout.write(JSON.stringify({roleContract:q.roleContract,requestHash:'sha256:'+require('node:crypto').createHash('sha256').update(raw).digest('hex'),sessionIdentity:q.roleContract,result,providerIdentity:'local-process',modelIdentity:'fixture'}));});`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(directory, 'goal-contract-semantic-provider-registry.json'),
    `${JSON.stringify(
      {
        schemaVersion: 'goal-contract-semantic-provider-registry/v1',
        enabled: true,
        activeProviderRef: 'local',
        providers: {
          local: {
            providerType: 'process',
            command: process.execPath,
            args: [script],
            credentialEnvRefs: [],
          },
        },
        roleContracts: {
          implementation_view: 'goal_contract_implementation_view/v1',
          acceptance_evidence_view: 'goal_contract_acceptance_evidence_view/v1',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { invocationLog, providerRoot };
}

function writeSourcePackageFixture(root) {
  const providerRoot = path.join(root, 'provider-root');
  fs.cpSync(
    path.join(REPO_ROOT, '_bmad', 'shared', 'goal-contract'),
    path.join(providerRoot, '_bmad', 'shared', 'goal-contract'),
    { recursive: true }
  );
  const fixture = writeProviderFixture(root);
  const packageRoot = path.join(providerRoot, 'packages', 'bmad-speckit');
  fs.mkdirSync(path.join(packageRoot, 'src', 'commands'), { recursive: true });
  fs.copyFileSync(
    SOURCE_COMMAND,
    path.join(packageRoot, 'src', 'commands', 'goal-contract.ts')
  );
  fs.cpSync(
    path.join(PACKAGE_ROOT, 'src', 'utils', 'goal-contract'),
    path.join(packageRoot, 'src', 'utils', 'goal-contract'),
    { recursive: true }
  );
  fs.mkdirSync(path.join(packageRoot, 'src', 'utils', 'large-document-writer'), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(PACKAGE_ROOT, 'src', 'utils', 'large-document-writer', 'receipts.ts'),
    path.join(packageRoot, 'src', 'utils', 'large-document-writer', 'receipts.ts')
  );
  return {
    ...fixture,
    packageRoot,
    sourceCommand: path.join(packageRoot, 'src', 'commands', 'goal-contract.ts'),
  };
}

function semanticRequestForSource(sourcePath) {
  const snapshot = buildSourceSnapshot({
    sourceType: 'source_plan',
    sourcePath: path.resolve(sourcePath).replace(/\\/gu, '/'),
    rawBytes: fs.readFileSync(sourcePath),
  });
  const extracted = extractSourceObligations({ snapshot });
  const methodology = loadPartitionMethodologyProfile({
    packageRoot: REPO_ROOT,
  });
  const repositoryFacts = loadRepositoryFacts({
    factsPath: null,
    expectedRepositoryTreeHash: hash('not-provided'),
    allowlistedAnalyzers: ['repository-analyzer@1.0.0'],
  });
  return {
    sourceSnapshot: snapshot,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligationGraph: extracted.sourceObligationGraph,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfile: methodology.semantic,
    methodologyProfileHash: methodology.methodologyProfileHash,
    repositoryFacts,
    repositoryFactsHash: repositoryFacts.repositoryFactsHash,
  };
}

function parsePayload(result) {
  assert.equal(result.signal, null, result.stderr || result.stdout);
  assert.notEqual(result.stdout.trim(), '', result.stderr);
  return JSON.parse(result.stdout);
}

describe('bmad-speckit goal-contract partition command', () => {
  it('promotes one active manifest only after global coverage and selections pass', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
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
    const payload = parsePayload(result);
    assert.equal(payload.ok, true);
    assert.match(payload.runId, /^partition-run-[0-9a-f]{64}$/u);
    assert.match(payload.partitionPlanHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(payload.partitionManifestHash, /^sha256:[0-9a-f]{64}$/u);
    assert.ok(payload.partitionCount >= 1);
    assert.equal(payload.globalCoverageDecision, 'pass');
    assert.equal(payload.selectionReceiptCount, payload.partitionCount);
    assert.equal(fs.existsSync(out), true);
    assert.equal(fs.existsSync(payload.partitionPlanPath), true);
    const partitionPlanBytes = fs.readFileSync(payload.partitionPlanPath);
    assert.equal(
      hash(partitionPlanBytes),
      payload.partitionPlanDocumentHash
    );
    const partitionPlan = JSON.parse(partitionPlanBytes);
    assert.equal(
      partitionPlan.partitionSetHash,
      payload.partitionPlanPartitionSetHash
    );
    assert.equal(
      partitionPlan.sourceCompositionPolicyHash,
      payload.sourceCompositionPolicyHash
    );
    assert.doesNotMatch(
      partitionPlanBytes.toString('utf8'),
      /childContractHash|partitionManifestHash/u
    );
    const manifestBytes = fs.readFileSync(out);
    assert.equal(hash(manifestBytes), payload.partitionManifestHash);
    const manifest = JSON.parse(manifestBytes);
    assert.match(manifest.manifestId, /^partition-manifest-[0-9a-f]{64}$/u);
    assert.equal(manifest.partitionCount, payload.partitionCount);
    assert.equal(manifest.partitionSetHash, payload.partitionSetHash);
  });

  it('rejects an active output path that overlaps the receipts directory', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'partition-manifest.json');

    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      out,
      '--receipts-dir',
      out,
      '--json',
    ]);

    assert.notEqual(result.status, 0);
    assert.equal(parsePayload(result).failureClass, 'partition_output_path_overlap');
    assert.equal(fs.existsSync(out), false);
  });

  it('promotes canonical-shaped task headings and descriptive dependency prose', () => {
    const root = tempRoot();
    const source = writeCanonicalRegressionPlan(root);
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
    const payload = parsePayload(result);
    assert.equal(payload.ok, true);
    assert.equal(fs.existsSync(out), true);
  });

  it('splits structured source tasks that exceed the write-scope owner limit', () => {
    const root = tempRoot();
    const source = path.join(root, 'wide-source-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    fs.writeFileSync(
      source,
      [
        '# Wide Structured Plan',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task PLAN-T01: Update the governed runtime surface',
        '',
        ...Array.from(
          { length: 10 },
          (_, index) => `- Modify: \`src/runtime/file-${index + 1}.ts\``
        ),
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] AC-001: MUST preserve deterministic runtime behavior.',
        '',
        '## Completion Evidence Packet',
        '',
        '- [ ] EVD-001: MUST bind the current source snapshot.',
        '',
        '## Required Test Commands',
        '',
        '- [ ] CMD-001: Run `node --version`.',
        '',
      ].join('\n'),
      'utf8'
    );

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
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.ok(
      manifest.partitions.flatMap((partition) => partition.primaryTaskIds)
        .length > 1
    );
    assert.equal(
      manifest.partitions.every(
        (partition) => partition.primaryWriteScopeOwnerCount <= 8
      ),
      true
    );
    assert.equal(
      manifest.partitions.every((partition) =>
        partition.commandIds.includes('CMD-001')
      ),
      true
    );
  });

  it('binds block-style task write paths into the execution projection', () => {
    const root = tempRoot();
    const source = path.join(root, 'block-write-scope-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    fs.writeFileSync(
      source,
      [
        '# Block Write Scope Plan',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task PLAN-T01: Update the first runtime surface',
        '',
        '**Create or modify:**',
        '',
        '- `src/runtime/first.ts`',
        '- `tests/runtime/first.test.ts`',
        '',
        '### Task PLAN-T02: Update the second runtime surface',
        '',
        '**Modify:**',
        '',
        '- `src/runtime/second.ts`',
        '',
        '**Dependencies:** PLAN-T01',
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] AC-001: MUST preserve deterministic runtime behavior.',
        '',
        '## Completion Evidence Packet',
        '',
        '- [ ] EVD-001: MUST bind the current source snapshot.',
        '',
        '## Required Test Commands',
        '',
        '- [ ] CMD-001: Run `node --version`.',
        '',
      ].join('\n'),
      'utf8'
    );

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
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(
      manifest.partitions.reduce(
        (total, partition) =>
          total + partition.primaryWriteScopeOwnerCount,
        0
      ),
      3
    );
    const firstPartitionIndex = manifest.partitions.findIndex((partition) =>
      partition.primaryTaskIds.includes('PLAN-T01')
    );
    const secondPartitionIndex = manifest.partitions.findIndex((partition) =>
      partition.primaryTaskIds.includes('PLAN-T02')
    );
    assert.ok(firstPartitionIndex >= 0);
    assert.ok(secondPartitionIndex >= firstPartitionIndex);
  });

  it('derives an inspect-only terminal task as final integration', () => {
    const root = tempRoot();
    const source = path.join(
      REPO_ROOT,
      'docs',
      'plans',
      '2026-07-28-canonical-intent-control-plane-kernel-implementation-plan.md'
    );
    const out = path.join(root, 'partition-manifest.json');

    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      out,
      '--sequence-mode',
      'disabled',
      '--json',
    ]);
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    const integrationPartitions = manifest.partitions.filter(
      (partition) =>
        partition.ownedArtifactPaths.length === 0 &&
        partition.dependencyPartitionIds.length > 0
    );
    assert.equal(integrationPartitions.length, 1);
    const [integrationPartition] = integrationPartitions;
    assert.equal(integrationPartition.partitionRole, 'final_integration');
    assert.equal(
      manifest.topologicalOrder.at(-1),
      integrationPartition.partitionId
    );
  });

  it('rejects an unmarked task path list instead of silently dropping write scope', () => {
    const root = tempRoot();
    const source = path.join(root, 'unmarked-write-scope-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    fs.writeFileSync(
      source,
      [
        '# Unmarked Write Scope Plan',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task PLAN-T01: Update the runtime surface',
        '',
        '- `src/runtime/entry.ts`',
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] AC-001: MUST preserve deterministic runtime behavior.',
        '',
        '## Completion Evidence Packet',
        '',
        '- [ ] EVD-001: MUST bind the current source snapshot.',
        '',
        '## Required Test Commands',
        '',
        '- [ ] CMD-001: Run `node --version`.',
        '',
      ].join('\n'),
      'utf8'
    );

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
    const payload = parsePayload(result);

    assert.notEqual(result.status, 0);
    assert.equal(
      payload.failureClass,
      'source_obligation_write_scope_unbound'
    );
    assert.equal(fs.existsSync(out), false);
  });

  it('binds escaped fenced commands declared at trace-slice scope', () => {
    const root = tempRoot();
    const source = path.join(root, 'escaped-command-fence-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    fs.writeFileSync(
      source,
      [
        '# Escaped Command Fence Plan',
        '',
        '## Trace Slice PLAN: Runtime',
        '',
        '### PLAN-T01: Update the runtime',
        '',
        '**Modify:**',
        '',
        '- `src/runtime/entry.ts`',
        '',
        '### PLAN Required Tests',
        '',
        '\\`\\`\\`powershell',
        'node --version',
        '\\`\\`\\`',
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] AC-001: MUST preserve deterministic runtime behavior.',
        '',
        '## Completion Evidence Packet',
        '',
        '- [ ] EVD-001: MUST bind the current source snapshot.',
        '',
      ].join('\n'),
      'utf8'
    );

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
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(
      manifest.partitions.every(
        (partition) => partition.commandIds.length > 0
      ),
      true
    );
  });

  it('preserves suffixed task dependencies in the projected partition DAG', () => {
    const root = tempRoot();
    const source = path.join(root, 'suffixed-task-dependency-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    const firstTaskPaths = Array.from(
      { length: 8 },
      (_, index) => `- \`src/runtime/first-${index + 1}.ts\``
    );
    const secondTaskPaths = Array.from(
      { length: 8 },
      (_, index) => `- \`src/runtime/second-${index + 1}.ts\``
    );
    fs.writeFileSync(
      source,
      [
        '# Suffixed Task Dependency Plan',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task PLAN-T01A: Publish the first runtime surface',
        '',
        '**Modify:**',
        '',
        ...firstTaskPaths,
        '',
        '### Task PLAN-T02: Publish the dependent runtime surface',
        '',
        '**Modify:**',
        '',
        ...secondTaskPaths,
        '',
        '**Dependencies:** PLAN-T01A',
        '',
        '### PLAN Required Tests',
        '',
        '```powershell',
        'node --version',
        '```',
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] AC-001: MUST preserve deterministic runtime behavior.',
        '',
        '## Completion Evidence Packet',
        '',
        '- [ ] EVD-001: MUST bind the current source snapshot.',
        '',
      ].join('\n'),
      'utf8'
    );

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
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    const firstPartition = manifest.partitions.find((partition) =>
      partition.primaryTaskIds.includes('PLAN-T01A')
    );
    const secondPartition = manifest.partitions.find((partition) =>
      partition.primaryTaskIds.includes('PLAN-T02')
    );
    assert.ok(firstPartition);
    assert.ok(secondPartition);
    assert.deepEqual(secondPartition.dependencyPartitionIds, [
      firstPartition.partitionId,
    ]);
  });

  it('projects an unscoped command to every structured task partition', () => {
    const root = tempRoot();
    const source = path.join(root, 'global-command-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    const taskPaths = (prefix) =>
      Array.from(
        { length: 8 },
        (_, index) => `- \`src/runtime/${prefix}-${index + 1}.ts\``
      );
    fs.writeFileSync(
      source,
      [
        '# Global Command Plan',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task PLAN-T01: Publish the first runtime surface',
        '',
        '**Modify:**',
        '',
        ...taskPaths('first'),
        '',
        '### Task PLAN-T02: Publish the second runtime surface',
        '',
        '**Modify:**',
        '',
        ...taskPaths('second'),
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] AC-001: MUST preserve deterministic runtime behavior.',
        '',
        '## Completion Evidence Packet',
        '',
        '- [ ] EVD-001: MUST bind the current source snapshot.',
        '',
        '## Required Test Commands',
        '',
        '- [ ] CMD-001: Run `node --version`.',
        '',
      ].join('\n'),
      'utf8'
    );

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
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.ok(manifest.partitions.length > 1);
    assert.equal(
      manifest.partitions.every((partition) =>
        partition.commandIds.includes('CMD-001')
      ),
      true
    );
  });

  it('rejects caller-authored partition authority before reading source or writing output', () => {
    const root = tempRoot();
    const missingSource = path.join(root, 'missing-source.md');
    const out = path.join(root, 'must-not-exist.json');
    const cases = [
      ['--partition-count', '2'],
      ['--task', 'TASK-001'],
      ['--selected-candidate', 'candidate-1'],
      ['--decision', 'accept'],
      ['--selection-receipt', path.join(root, 'selection-receipt.json')],
    ];

    for (const authorityArgs of cases) {
      const result = runSourceCommand([
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        missingSource,
        '--out',
        out,
        '--json',
        ...authorityArgs,
      ]);

      assert.notEqual(result.status, 0);
      assert.equal(parsePayload(result).failureClass, 'partition_authority_argument_forbidden');
      assert.equal(fs.existsSync(out), false);
    }
  });

  it('rejects caller-authored policy identities and objects before reading source', () => {
    const root = tempRoot();
    const missingSource = path.join(root, 'missing-source.md');
    const out = path.join(root, 'must-not-exist.json');
    const cases = [
      ['--partition-policy-hash', `sha256:${'a'.repeat(64)}`],
      ['--policy-hash', `sha256:${'b'.repeat(64)}`],
      ['--partition-policy-bytes', '123'],
      ['--partition-policy-json', '{"schemaVersion":"goal-contract-partition-policy/v1"}'],
    ];

    for (const authorityArgs of cases) {
      const result = runSourceCommand([
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        missingSource,
        '--out',
        out,
        '--json',
        ...authorityArgs,
      ]);

      assert.notEqual(result.status, 0);
      assert.equal(
        parsePayload(result).failureClass,
        'partition_policy_authority_override_forbidden'
      );
      assert.equal(fs.existsSync(out), false);
    }
  });

  it('rejects an explicit substitute policy path before entering P02', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'partition-manifest.json');
    const policyPath = path.join(root, 'explicit-policy.json');
    fs.copyFileSync(
      path.join(
        REPO_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'goal-contract-partition-policy.json'
      ),
      policyPath
    );

    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--policy',
      policyPath,
      '--out',
      out,
      '--json',
    ]);

    assert.notEqual(result.status, 0);
    const payload = parsePayload(result);
    assert.equal(payload.failureClass, 'partition_policy_binding_mismatch');
    assert.deepEqual(payload.mismatchedFields, ['policyPath']);
    assert.equal(fs.existsSync(out), false);
  });

  it('uses two isolated real provider processes for semantic completion', () => {
    const root = tempRoot();
    const source = writeSemanticSourcePlan(root);
    const out = path.join(root, 'partition-manifest.json');
    const fixture = writeSourcePackageFixture(root);

    const result = runSourceCommand(
      [
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--out',
        out,
        '--json',
      ],
      {
        cwd: fixture.packageRoot,
        sourceCommand: fixture.sourceCommand,
        env: {
          NODE_PATH: [path.join(REPO_ROOT, 'node_modules'), process.env.NODE_PATH]
            .filter(Boolean)
            .join(path.delimiter),
        },
      }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    assert.equal(payload.ok, true);
    assert.deepEqual(
      fs.readFileSync(fixture.invocationLog, 'utf8').trim().split(/\r?\n/u).sort(),
      [
        'goal_contract_acceptance_evidence_view/v1',
        'goal_contract_implementation_view/v1',
      ]
    );
    assert.equal(fs.existsSync(out), true);
  });

  it('ignores caller-controlled provider roots and prewritten trusted envelopes', async () => {
    const root = tempRoot();
    const source = writeSemanticSourcePlan(root);
    const out = path.join(root, 'partition-manifest.json');
    const { invocationLog, providerRoot } = writeProviderFixture(root);
    const receiptsDir = path.join(root, 'provider-receipts');
    const provider = createGoalContractSemanticProvider({
      packageRoot: providerRoot,
      receiptsDir,
    });
    const request = semanticRequestForSource(source);

    await Promise.all([
      provider.deriveImplementationView(request),
      provider.deriveAcceptanceEvidenceView(request),
    ]);
    const receiptNames = fs
      .readdirSync(receiptsDir)
      .filter((name) => name.endsWith('.json'))
      .sort();
    assert.equal(receiptNames.length, 2);
    const receiptHashesBefore = receiptNames.map((name) =>
      hash(fs.readFileSync(path.join(receiptsDir, name)))
    );
    fs.rmSync(invocationLog, { force: true });

    const result = runSourceCommand(
      [
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--out',
        out,
        '--json',
      ],
      {
        env: {
          GOAL_CONTRACT_SEMANTIC_PROVIDER_RECEIPTS_DIR: receiptsDir,
          GOAL_CONTRACT_SEMANTIC_PROVIDER_ROOT: providerRoot,
        },
      }
    );

    assert.notEqual(result.status, 0);
    const payload = parsePayload(result);
    assert.equal(payload.failureClass, 'semantic_provider_unavailable');
    assert.equal(fs.existsSync(invocationLog), false);
    assert.deepEqual(
      receiptNames.map((name) => hash(fs.readFileSync(path.join(receiptsDir, name)))),
      receiptHashesBefore
    );
    assert.equal(fs.existsSync(out), false);
  });

  it('does not infer Sequence applicability from source prose', () => {
    for (const prose of [
      'The workflow MUST use bounded retry.',
      'Sequence applicability is unresolved.',
    ]) {
      const root = tempRoot();
      const source = writeSourcePlan(root);
      fs.appendFileSync(
        source,
        `\n## Sequence Requirements\n\n${prose}\n`,
        'utf8'
      );
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
      const payload = parsePayload(result);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(
        payload.sequenceApplicability,
        'not_applicable_with_proof'
      );
      assert.equal(payload.sequenceMode, 'auto');
      assert.equal(payload.sequenceCoverage, 'not_applicable');
      assert.equal(payload.sequenceClosureStatus, 'not_required');
      assert.equal(payload.childContractAuthority, 'full');
      assert.match(payload.partitionManifestHash, /^sha256:[0-9a-f]{64}$/u);
      assert.equal(fs.existsSync(out), true);
    }
  });

  it('routes disabled mode and rejects invalid mode inputs', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const disabled = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--sequence-mode',
      'disabled',
      '--out',
      path.join(root, 'disabled.json'),
      '--json',
    ]);
    const disabledPayload = parsePayload(disabled);

    assert.equal(disabled.status, 0, disabled.stderr || disabled.stdout);
    assert.equal(disabledPayload.sequenceMode, 'disabled');
    assert.equal(disabledPayload.sequenceCoverage, 'excluded');
    assert.equal(disabledPayload.sequenceClosureStatus, 'not_requested');
    assert.equal(disabledPayload.childContractAuthority, 'core_only');

    for (const [extraArgs, failureClass] of [
      [
        ['--sequence-mode', 'disabled', '--sequence-constraints', source],
        'sequence_constraints_forbidden_when_disabled',
      ],
      [['--sequence-mode', 'skip'], 'sequence_mode_invalid'],
    ]) {
      const result = runSourceCommand([
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        ...extraArgs,
        '--out',
        path.join(root, `${failureClass}.json`),
        '--json',
      ]);

      assert.notEqual(result.status, 0);
      assert.equal(parsePayload(result).failureClass, failureClass);
    }
  });

  it('fails required mode before projection when the producer is unavailable', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'required.json');
    const receiptsDir = path.join(root, 'receipts');
    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--sequence-mode',
      'required',
      '--receipts-dir',
      receiptsDir,
      '--out',
      out,
      '--json',
    ]);
    const payload = parsePayload(result);

    assert.notEqual(result.status, 0);
    assert.equal(
      payload.failureClass,
      'sequence_closure_required_unavailable'
    );
    assert.equal(payload.sequenceMode, 'required');
    assert.equal(payload.sequenceApplicability, 'not_applicable_with_proof');
    assert.equal(fs.existsSync(out), false);
    assert.equal(
      fs.existsSync(payload.sequenceApplicabilityReceiptPath),
      true
    );
  });

  it('does not misclassify the real judge-role plan as Sequence-required', () => {
    const root = tempRoot();
    const source = path.join(
      REPO_ROOT,
      'docs',
      'plans',
      '2026-07-25-judge-role-separation-implementation-task-list.md'
    );
    const out = path.join(root, 'judge-role-manifest.json');
    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--sequence-mode',
      'auto',
      '--out',
      out,
      '--json',
    ]);
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    assert.equal(payload.ok, true);
    assert.equal(payload.sequenceMode, 'auto');
    assert.equal(payload.sequenceApplicability, 'not_applicable_with_proof');
    assert.equal(payload.sequenceCoverage, 'not_applicable');
    assert.equal(payload.sequenceClosureStatus, 'not_required');
    assert.equal(payload.childContractAuthority, 'full');
    assert.ok(payload.partitionCount > 1);
    assert.equal(fs.existsSync(out), true);
    assert.equal(fs.existsSync(payload.sequenceApplicabilityReceiptPath), true);
    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          payload.sequenceApplicabilityReceiptPath,
          'utf8'
        )
      ),
      payload.sequenceApplicabilityReceipt
    );
  });

  it('changes authority identity by mode without changing equivalent topology', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const runs = {};
    for (const mode of ['auto', 'disabled']) {
      const modeRoot = path.join(root, mode);
      fs.mkdirSync(modeRoot);
      const out = path.join(modeRoot, 'manifest.json');
      const result = runSourceCommand([
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--sequence-mode',
        mode,
        '--out',
        out,
        '--json',
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const payload = parsePayload(result);
      const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.equal(payload.executionProjectionHash, manifest.executionProjectionHash);
      runs[mode] = { payload, manifest };
    }

    assert.notEqual(
      runs.auto.payload.executionProjectionHash,
      runs.disabled.payload.executionProjectionHash
    );
    assert.notEqual(
      runs.auto.payload.partitionManifestHash,
      runs.disabled.payload.partitionManifestHash
    );
    assert.equal(
      runs.auto.payload.partitionCount,
      runs.disabled.payload.partitionCount
    );
  });

  it('builds partition slots only from a validated canonical selection', () => {
    const result = buildPartitionSlotData({
      source: { sourcePlanHash: hash('source') },
      profile: { profileVersion: '1.0.0' },
      selection: {
        primarySourceObligations: [{ id: 'source-alpha', summary: 'Source alpha.' }],
        atomicTasks: [
          {
            taskId: 'task-alpha',
            title: 'Implement alpha.',
            sourceIds: ['source-alpha'],
          },
        ],
        completionPredicates: [
          {
            predicateId: 'predicate-alpha',
            statement: 'Alpha passes.',
            sourceIds: ['source-alpha'],
          },
        ],
        evidenceContracts: [
          {
            evidenceContractId: 'evidence-alpha',
            producerTaskIds: ['task-alpha'],
            freshnessRule: 'current source roots',
          },
        ],
        inheritedConstraints: [{ constraintId: 'constraint-alpha' }],
      },
    });

    assert.match(result.slotData.implementationTasks, /task-alpha/u);
    assert.match(result.slotData.strictAcceptanceChecklist, /predicate-alpha/u);
    assert.match(result.slotData.completionEvidencePacket, /evidence-alpha/u);
    assert.equal(result.selectionReceipt.atomicTaskCount, 1);
    assert.doesNotMatch(result.slotData.implementationTasks, /\bG\d{3}\b/u);
  });

  it('rejects incomplete partition-bound generation arguments before source access', () => {
    const root = tempRoot();
    const missingSource = path.join(root, 'missing-source.md');
    const out = path.join(root, 'must-not-exist.md');
    const cases = [
      ['--partition-manifest', path.join(root, 'manifest.json')],
      ['--partition-id', 'PARTITION-001'],
    ];

    for (const selectorArgs of cases) {
      const result = runSourceCommand([
        'generate',
        '--entry',
        'standalone_goal_contract',
        '--source',
        missingSource,
        '--out',
        out,
        '--json',
        ...selectorArgs,
      ]);

      assert.notEqual(result.status, 0);
      assert.equal(parsePayload(result).failureClass, 'partition_generation_arguments_incomplete');
      assert.equal(fs.existsSync(out), false);
    }
  });
});
