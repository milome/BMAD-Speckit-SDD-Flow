const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SOURCE_COMMAND = path.join(PACKAGE_ROOT, 'src', 'commands', 'goal-contract.ts');
const SOURCE_OBLIGATION_EXTRACTOR = path.join(
  PACKAGE_ROOT,
  'src',
  'utils',
  'goal-contract',
  'source-obligation-extractor.ts'
);
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const {
  loadPartitionMethodologyProfile,
} = require('../src/utils/goal-contract/partition-methodology-profile.ts');
const { loadRepositoryFacts } = require('../src/utils/goal-contract/repository-facts.ts');
const {
  createGoalContractSemanticProvider,
} = require('../src/utils/goal-contract/semantic-provider-registry.ts');
const { buildPartitionSlotData } = require('../src/utils/goal-contract/slot-data-builder.ts');
const {
  extractSourceObligations,
} = require('../src/utils/goal-contract/source-obligation-extractor.ts');
const {
  goalContractAuthorityWriterBinding,
  loadCanonicalPartitionAuthorityForRelease,
  semanticPartitionManifestHash,
} = require('../src/utils/goal-contract/control-plane/partition-output-paths.ts');
const {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  compileSourceCompositionPolicy,
} = require('../src/utils/goal-contract/control-plane/source-composition-policy.ts');
const {
  compileOrderedSourceSnapshotSet,
} = require('../src/utils/goal-contract/control-plane/source-snapshot.ts');
const {
  loadGoalContractSchema,
  validateGoalContractSchema,
} = require('../src/utils/goal-contract/control-plane/schema-registry.ts');
const {
  compileTaskFileScopeAuthority,
  validateTaskFileScopeCells,
} = require('../src/utils/goal-contract/control-plane/partition-compiler.ts');
const {
  buildPartitionPlanGlobalCoverageReceipt,
  buildPartitionPlanSelectionReceipt,
} = require('../src/utils/goal-contract/partition-selector.ts');
const {
  serializeValidatedPartitionReceipt,
} = require('../src/utils/goal-contract/partition-receipts.ts');
const {
  currentPartitionCompilerIdentityHash,
  partitionCompilerIdentityAssetPaths,
} = require('../src/commands/goal-contract.ts');

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

function writeStructuredDependencySourcePlan(root) {
  const sourcePath = path.join(root, 'structured-source-plan.md');
  const tasks = [
    ['FIX-T01', 'Freeze source authority', 'packages/example/src/freeze.ts'],
    ['FIX-T02', 'Normalize source obligations', 'packages/example/src/normalize.ts'],
    ['FIX-T03', 'Compile impact graph', 'packages/example/src/impact.ts'],
    ['FIX-T04', 'Prove closure feasibility', 'packages/example/src/feasibility.ts'],
    ['FIX-T05', 'Finalize partition authority', 'packages/example/src/manifest.ts'],
  ];
  fs.writeFileSync(
    sourcePath,
    [
      '# Structured Partition Source Plan',
      '',
      '## Task Dependency DAG and File Ownership',
      '',
      '```text',
      'FIX-T01 -> FIX-T02 -> FIX-T03 -> FIX-T04 -> FIX-T05',
      '```',
      '',
      ...tasks.flatMap(([taskId, title, governedPath]) => [
        `### ${taskId}: ${title}`,
        '',
        '**Files**',
        '',
        `- Modify \`${governedPath}\`.`,
        '',
        `Acceptance: ${taskId} produces its declared observable outcome.`,
        '',
      ]),
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-FIX-001: MUST bind the exact source bytes.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-FIX-001: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return {
    sourcePath,
    tasks,
  };
}

function writeRoleAwareSourcePlan(root) {
  const sourcePath = path.join(root, 'role-aware-source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Role-aware Partition Source Plan',
      '',
      '### Task PLAN-T01: Deliver runtime capability [Dependencies: none]',
      '',
      '**Execution Class:** `executable_child`',
      '**Owned Production Paths:** the task\'s explicit Files section',
      '',
      '**Files**',
      '',
      '- Modify `src/runtime.ts`.',
      '',
      '**Run**',
      '',
      '- CMD-PLAN-T01-01: Run `node --version`.',
      '',
      'AC-PLAN-T01: MUST satisfy the runtime capability acceptance oracle.',
      '',
      'EVD-PLAN-T01: MUST bind PLAN-T01 to CMD-PLAN-T01-01.',
      '',
      '### Task PLAN-T02: Verify aggregate evidence [Dependencies: PLAN-T01]',
      '',
      '**Execution Class:** `aggregate_only`',
      '**Owned Production Paths:** `none`',
      '**Aggregate Gate Phase:** `final_aggregate`',
      '**Aggregate Validation Commands:** `CMD-PLAN-T02-01`',
      '',
      '**Files**',
      '',
      '- No production files.',
      '',
      '**Run**',
      '',
      '- CMD-PLAN-T02-01: Run `node --help`.',
      '',
      'AC-PLAN-T02: MUST satisfy the aggregate evidence acceptance oracle.',
      '',
      'EVD-PLAN-T02: MUST bind PLAN-T02 to CMD-PLAN-T02-01.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function writeExecutableBoundarySourcePlan(
  root,
  { sharedOwnedPath = false } = {}
) {
  const sourcePath = path.join(
    root,
    'executable-boundary-source-plan.md'
  );
  const tasks = [
    [
      'PLAN-T01',
      'Unsafe inputs fail before side effects',
      'none',
      'src/preflight.ts',
    ],
    [
      'PLAN-T02',
      'Source authority resolves one canonical identity',
      'PLAN-T01',
      sharedOwnedPath
        ? 'src/preflight.ts'
        : 'src/source-authority.ts',
    ],
    [
      'PLAN-T03',
      'Certified partitions preserve execution topology',
      'PLAN-T02',
      'src/partition-runtime.ts',
    ],
  ];
  fs.writeFileSync(
    sourcePath,
    [
      '# Executable Boundary Source Plan',
      '',
      ...tasks.flatMap(
        ([taskId, title, dependency, ownedPath]) => [
          `### Task ${taskId}: ${title} [Dependencies: ${dependency}]`,
          '',
          '**Execution Class:** `executable_child`',
          '**Owned Production Paths:** the task\'s explicit Files section',
          '',
          '**Files**',
          '',
          `- Modify \`${ownedPath}\`.`,
          '',
          '**Run**',
          '',
          `- CMD-${taskId}-01: Run \`node --version\`.`,
          '',
          `AC-${taskId}: MUST satisfy the ${taskId} acceptance oracle.`,
          '',
          `EVD-${taskId}: MUST bind ${taskId} to CMD-${taskId}-01.`,
          '',
        ]
      ),
      '### Task PLAN-T04: Aggregate certified child evidence [Dependencies: PLAN-T03]',
      '',
      '**Execution Class:** `aggregate_only`',
      '**Owned Production Paths:** `none`',
      '**Aggregate Gate Phase:** `final_aggregate`',
      '**Aggregate Validation Commands:** `CMD-PLAN-T04-01`',
      '',
      '**Files**',
      '',
      '- No production files.',
      '',
      '**Run**',
      '',
      '- CMD-PLAN-T04-01: Run `node --help`.',
      '',
      'AC-PLAN-T04: MUST satisfy the aggregate acceptance oracle.',
      '',
      'EVD-PLAN-T04: MUST bind PLAN-T04 to CMD-PLAN-T04-01.',
      '',
    ].join('\n'),
    'utf8'
  );
  return { sourcePath, tasks };
}

function writeSharedDependencySourcePlan(root) {
  const sourcePath = path.join(root, 'shared-source-plan.md');
  const tasks = [
    [
      'FIX-T01',
      'Freeze source authority',
      ['src/shared.ts', ...Array.from({ length: 7 }, (_, index) => `src/freeze-${index + 1}.ts`)],
    ],
    [
      'FIX-T02',
      'Normalize source obligations',
      [
        'src/shared.ts',
        ...Array.from({ length: 7 }, (_, index) => `src/normalize-${index + 1}.ts`),
      ],
    ],
    ['FIX-T03', 'Compile impact graph', ['src/impact.ts']],
    ['FIX-T04', 'Prove closure feasibility', ['src/feasibility.ts']],
    ['FIX-T05', 'Finalize partition authority', ['src/manifest.ts']],
  ];
  fs.writeFileSync(
    sourcePath,
    [
      '# Shared Partition Source Plan',
      '',
      '## Task Dependency DAG and File Ownership',
      '',
      '```text',
      'FIX-T01 -> FIX-T02 -> FIX-T03 -> FIX-T04 -> FIX-T05',
      '```',
      '',
      ...tasks.flatMap(([taskId, title, paths]) => [
        `### ${taskId}: ${title}`,
        '',
        '**Modify:**',
        '',
        ...paths.map((filePath) => `- \`${filePath}\``),
        '',
        `Acceptance: ${taskId} produces its declared observable outcome.`,
        '',
      ]),
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-FIX-001: MUST bind the exact source bytes.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-FIX-001: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return { sourcePath, tasks };
}

function standaloneSourceCompositionPolicyHash(sourcePlanHash) {
  const requiredSubordinateBindings = [];
  const authoritySourceId = `standalone-source-authority:${sourcePlanHash}`;
  return compileSourceCompositionPolicy({
    authorityRecord: {
      authorityKind: 'deterministic_source_authority_adapter',
      authoritySourceId,
      declaredMode: 'single_source',
      requiredSubordinateBindings,
      declaredRequiredBindingsHash: hashControlPlaneValue(
        requiredSubordinateBindings
      ),
      authorityEvidenceHash: hashControlPlaneValue({
        authoritySourceId,
        mode: 'single_source',
        requiredSubordinateBindings,
      }),
    },
  }).sourceCompositionPolicyHash;
}

function writeFrozenSuccessorContract(
  root,
  sourcePlanPath,
  { slotWrappedFrontMatter = false } = {}
) {
  const sourcePlanHash = hash(fs.readFileSync(sourcePlanPath));
  const goalContractPath = path.join(root, 'frozen-goal-contract.md');
  const coverageReceiptPath = path.join(root, 'coverage.json');
  const generationReceiptPath = path.join(root, 'generation.json');
  const frontMatter = [
    '---',
    'goalContractVersion: goal-execution-contract/v1',
    'contractMode: frozen',
    'rewritePolicy: forbidden',
    `sourcePlanPath: ${sourcePlanPath.replace(/\\/gu, '/')}`,
    `sourcePlanHash: ${sourcePlanHash}`,
    `coverageReceiptPath: ${coverageReceiptPath.replace(/\\/gu, '/')}`,
    `generationReceiptPath: ${generationReceiptPath.replace(/\\/gu, '/')}`,
    '---',
  ];
  const contract = [
    ...(slotWrappedFrontMatter
      ? [
          '# Goal Execution Contract',
          '',
          '<!-- goal-slot:frontMatter required dynamic=frontMatter -->',
          ...frontMatter,
          '<!-- /goal-slot:frontMatter -->',
        ]
      : frontMatter),
    '',
    '# Frozen Goal Contract',
    '',
  ].join('\n');
  fs.writeFileSync(goalContractPath, contract, 'utf8');
  const goalContractDocumentHash = hash(fs.readFileSync(goalContractPath));
  fs.writeFileSync(
    coverageReceiptPath,
    `${JSON.stringify(
      {
        schemaVersion: 'goal-contract-source-coverage-receipt/v1',
        decision: 'pass',
        sourcePlanPath: sourcePlanPath.replace(/\\/gu, '/'),
        sourcePlanHash,
        goalContractDocumentHash,
        unmappedSourceObligations: [],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  fs.writeFileSync(
    generationReceiptPath,
    `${JSON.stringify(
      {
        schemaVersion: 'goal-contract-generation-receipt/v1',
        sourcePlanPath: sourcePlanPath.replace(/\\/gu, '/'),
        sourcePlanHash,
        goalContractDocumentHash,
        ...(slotWrappedFrontMatter
          ? {
              sourceCompositionPolicyHash:
                standaloneSourceCompositionPolicyHash(sourcePlanHash),
            }
          : {}),
        compilationReceipt: {
          profileBytesHash: hash(
            fs.readFileSync(
              path.join(
                REPO_ROOT,
                '_bmad',
                'shared',
                'goal-contract',
                'goal-contract-profile.json'
              )
            )
          ),
          templateBytesHash: hash(
            fs.readFileSync(
              path.join(
                REPO_ROOT,
                '_bmad',
                'shared',
                'goal-contract',
                'goal-execution-contract-template.md'
              )
            )
          ),
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return {
    coverageReceiptPath,
    generationReceiptPath,
    goalContractPath,
    sourcePlanHash,
  };
}

function writeRequirementRecord(
  root,
  sourceHash,
  { authorized = true } = {}
) {
  const recordId = 'REQ-GH-004';
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'requirement-record.json'
  );
  const sourceDocumentHash = hash('requirement-source');
  const implementationConfirmationHash = hash('requirement-confirmation');
  const architectureConfirmationHash = hash(
    'requirement-architecture-confirmation'
  );
  const writerRegistrySourceHash = hash(
    'goal-contract-writer-registry-source'
  );
  const controlledIngestWriterRegistry = authorized
    ? [
        goalContractAuthorityWriterBinding({
          registryHash: writerRegistrySourceHash,
          architectureConfirmationHash,
        }),
      ]
    : [];
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirement-record/v1',
        recordId,
        requirementSetId: recordId,
        status: 'user_confirmed',
        sourcePath: 'docs/design/requirement-source.md',
        sourceDocumentHash,
        implementationConfirmationHash,
        semanticModelHash: hash('requirement-semantics'),
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            recordId,
            requirementSetId: recordId,
            confirmedAt: '2026-08-01T00:00:00.000Z',
            confirmedBy: 'user',
            sourcePath: 'docs/design/requirement-source.md',
            sourceDocumentHash,
            implementationConfirmationHash,
            confirmationPageHash: hash('confirmation-page'),
            confirmationText: 'confirmed',
            renderReportPath: 'confirmation/render-report.json',
            htmlPath: 'confirmation/confirmation.html',
          },
        ],
        controlledIngestWriterRegistryRequired: true,
        controlledIngestWriterRegistry,
        controlledIngestWriterRegistryHash: hash(
          JSON.stringify({
            schemaVersion: 'controlled-ingest-writer-registry/v1',
            sourceDocumentHash,
            implementationConfirmationHash,
            writers: controlledIngestWriterRegistry,
          })
        ),
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash:
            architectureConfirmationHash,
        },
        nativeGoalHandoff: {
          masterImplementationPlanHash: sourceHash,
        },
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return recordPath;
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
  fs.copyFileSync(SOURCE_COMMAND, path.join(packageRoot, 'src', 'commands', 'goal-contract.ts'));
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

function writeCanonicalJson(filePath, value) {
  fs.writeFileSync(
    filePath,
    `${stableControlPlaneStringify(value)}\n`,
    'utf8'
  );
}

function writeValidatedReceipt(filePath, schemaId, value) {
  fs.writeFileSync(
    filePath,
    serializeValidatedPartitionReceipt({
      schemaId,
      payload: value,
    }),
    'utf8'
  );
}

function withReceiptHash(value) {
  const semantic = structuredClone(value);
  delete semantic.receiptHash;
  return {
    ...semantic,
    receiptHash: hashControlPlaneValue(semantic),
  };
}

function stageCanonicalReleaseFixture() {
  const root = tempRoot();
  const source = writeSourcePlan(root);
  const frozen = writeFrozenSuccessorContract(root, source, {
    slotWrappedFrontMatter: true,
  });
  const partitionResult = runSourceCommand(
    [
      'partition',
      '--governed',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--goal-contract',
      frozen.goalContractPath,
      '--sequence-mode',
      'disabled',
      '--json',
    ],
    { cwd: root }
  );
  assert.equal(
    partitionResult.status,
    0,
    partitionResult.stderr || partitionResult.stdout
  );
  const payload = parsePayload(partitionResult);
  const child = payload.partitionManifest.partitions[0];
  return {
    root,
    source,
    payload,
    child,
    childPath: path.resolve(root, child.childContractPath),
  };
}

function rewriteFirstChildAsUnitRelative(fixture) {
  const { payload, root } = fixture;
  const manifest = JSON.parse(
    fs.readFileSync(payload.partitionManifestPath, 'utf8')
  );
  const partition = manifest.partitions[0];
  const partitionId = partition.partitionId;
  const childPath = path.resolve(root, partition.childContractPath);
  const unitRelativeChildPath = path
    .relative(payload.unitRoot, childPath)
    .replace(/\\/gu, '/');
  const receiptRoot = path.join(payload.unitRoot, 'receipts', 'children');
  const compilationPath = path.join(
    receiptRoot,
    `${partitionId}.compilation.json`
  );
  const coveragePath = path.join(
    receiptRoot,
    `${partitionId}.coverage.json`
  );
  const generationPath = path.join(
    receiptRoot,
    `${partitionId}.generation.json`
  );
  const membershipPath = path.join(
    receiptRoot,
    `${partitionId}.membership.json`
  );
  const renderEvidencePath = path.join(
    payload.unitRoot,
    'evidence',
    'render-evidence.json'
  );
  const partitionPlan = JSON.parse(
    fs.readFileSync(payload.partitionPlanPath, 'utf8')
  );
  const compilation = JSON.parse(
    fs.readFileSync(compilationPath, 'utf8')
  );
  compilation.childContractPath = unitRelativeChildPath;
  const nextCompilation = withReceiptHash(compilation);
  writeCanonicalJson(compilationPath, nextCompilation);

  partition.childContractPath = unitRelativeChildPath;
  partition.childCompilationReceiptHash =
    nextCompilation.receiptHash;
  delete partition.childMembershipHash;
  partition.childMembershipHash =
    hashControlPlaneValue(partition);
  manifest.partitionManifestHash =
    semanticPartitionManifestHash(manifest);
  const manifestBytes =
    `${stableControlPlaneStringify(manifest)}\n`;
  const manifestDocumentHash = hash(manifestBytes);
  fs.writeFileSync(
    payload.partitionManifestPath,
    manifestBytes,
    'utf8'
  );

  const globalCoveragePath = path.join(
    payload.unitRoot,
    manifest.globalCoverageReceiptPath
  );
  writeValidatedReceipt(
    globalCoveragePath,
    'goal-contract-partition-global-coverage-receipt/v1',
    buildPartitionPlanGlobalCoverageReceipt({
      partitionPlan,
      candidateManifest: manifest,
    })
  );
  const selectionPath = path.join(
    payload.unitRoot,
    partition.selectionReceiptPath
  );
  writeValidatedReceipt(
    selectionPath,
    'goal-contract-partition-selection-receipt/v1',
    buildPartitionPlanSelectionReceipt({
      partitionPlan,
      partitionManifest: manifest,
      partitionId,
    })
  );
  const globalCoverageHash = hash(
    fs.readFileSync(globalCoveragePath)
  );
  const selectionHash = hash(
    fs.readFileSync(selectionPath)
  );

  const coverage = JSON.parse(
    fs.readFileSync(coveragePath, 'utf8')
  );
  coverage.partitionManifestHash = manifestDocumentHash;
  coverage.globalCoverageReceiptHash =
    globalCoverageHash;
  coverage.selectionReceiptHash = selectionHash;
  writeValidatedReceipt(
    coveragePath,
    'goal-contract-partition-child-coverage-receipt/v1',
    coverage
  );
  const coverageHash = hash(fs.readFileSync(coveragePath));

  const generation = JSON.parse(
    fs.readFileSync(generationPath, 'utf8')
  );
  generation.partitionManifestHash = manifestDocumentHash;
  generation.globalCoverageReceiptHash =
    globalCoverageHash;
  generation.selectionReceiptHash = selectionHash;
  generation.coverageReceiptHash = coverageHash;
  writeValidatedReceipt(
    generationPath,
    'goal-contract-partition-child-generation-receipt/v1',
    generation
  );

  const membership = JSON.parse(
    fs.readFileSync(membershipPath, 'utf8')
  );
  membership.childContractPath = unitRelativeChildPath;
  membership.childCompilationReceiptHash =
    nextCompilation.receiptHash;
  membership.partitionManifestHash =
    manifest.partitionManifestHash;
  writeCanonicalJson(
    membershipPath,
    withReceiptHash(membership)
  );
  const renderEvidence = JSON.parse(
    fs.readFileSync(renderEvidencePath, 'utf8')
  );
  renderEvidence.partitionManifestHash =
    manifest.partitionManifestHash;
  renderEvidence.partitionManifestDocumentHash =
    manifestDocumentHash;
  writeCanonicalJson(renderEvidencePath, renderEvidence);

  const pointer = JSON.parse(
    fs.readFileSync(payload.activePointerPath, 'utf8')
  );
  pointer.partitionManifestHash =
    manifest.partitionManifestHash;
  pointer.partitionManifestDocumentHash =
    manifestDocumentHash;
  const changedReceiptPaths = new Map(
    [
      compilationPath,
      globalCoveragePath,
      selectionPath,
      coveragePath,
      generationPath,
      membershipPath,
      renderEvidencePath,
    ].map((targetPath) => [
      path
        .relative(payload.unitRoot, targetPath)
        .replace(/\\/gu, '/'),
      hash(fs.readFileSync(targetPath)),
    ])
  );
  pointer.requiredReceiptHashes =
    pointer.requiredReceiptHashes.map((record) => ({
      ...record,
      hash: changedReceiptPaths.get(record.path) || record.hash,
    }));
  writeCanonicalJson(payload.activePointerPath, pointer);
  fixture.child = partition;
  fixture.childPath = childPath;
}

describe('bmad-speckit goal-contract partition command', () => {
  it('binds governed command bytes into the partition compiler identity', () => {
    const baseline = currentPartitionCompilerIdentityHash();
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = (filePath, ...args) => {
      const bytes = originalReadFileSync(filePath, ...args);
      if (path.resolve(filePath) !== SOURCE_COMMAND) return bytes;
      return Buffer.concat([
        Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
        Buffer.from('\n// compiler identity mutation\n'),
      ]);
    };
    try {
      assert.notEqual(currentPartitionCompilerIdentityHash(), baseline);
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
  });

  it('binds source obligation extractor bytes into the partition compiler identity', () => {
    assert.equal(
      partitionCompilerIdentityAssetPaths().some(
        (assetPath) => path.resolve(assetPath) === SOURCE_OBLIGATION_EXTRACTOR
      ),
      true
    );
    const baseline = currentPartitionCompilerIdentityHash();
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = (filePath, ...args) => {
      const bytes = originalReadFileSync(filePath, ...args);
      if (path.resolve(filePath) !== SOURCE_OBLIGATION_EXTRACTOR) return bytes;
      return Buffer.concat([
        Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
        Buffer.from('\n// source extractor identity mutation\n'),
      ]);
    };
    try {
      assert.notEqual(currentPartitionCompilerIdentityHash(), baseline);
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
  });

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
      '--out-root',
      root,
      '--out',
      out,
      '--json',
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.authorityMode, 'raw_non_authoritative');
    assert.equal(
      payload.rawContainmentRoot.replace(/\\/gu, '/'),
      root.replace(/\\/gu, '/')
    );
    assert.match(payload.runId, /^partition-run-[0-9a-f]{64}$/u);
    assert.match(payload.partitionPlanHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(payload.partitionManifestHash, /^sha256:[0-9a-f]{64}$/u);
    assert.ok(payload.partitionCount >= 1);
    assert.equal(payload.globalCoverageDecision, 'pass');
    assert.equal(payload.selectionReceiptCount, payload.partitionCount);
    assert.equal(fs.existsSync(out), true);
    assert.equal(fs.existsSync(payload.partitionPlanPath), true);
    const partitionPlanBytes = fs.readFileSync(payload.partitionPlanPath);
    assert.equal(hash(partitionPlanBytes), payload.partitionPlanDocumentHash);
    const partitionPlan = JSON.parse(partitionPlanBytes);
    assert.equal(partitionPlan.partitionSetHash, payload.partitionPlanPartitionSetHash);
    assert.equal(partitionPlan.sourceCompositionPolicyHash, payload.sourceCompositionPolicyHash);
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

  it('blocks governed partitioning when the frozen successor contract is missing', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--json',
      ],
      { cwd: root }
    );

    assert.notEqual(result.status, 0);
    assert.equal(
      parsePayload(result).failureClass,
      'blocked_by_frozen_successor_goal_contract'
    );
    assert.equal(
      fs.existsSync(path.join(root, '_bmad-output')),
      false
    );
  });

  it('rejects every absolute and relative raw output override in governed mode', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source);
    const variants = [
      ['--out', path.join(root, 'absolute-manifest.json')],
      ['--out', 'relative-manifest.json'],
      ['--out-root', path.join(root, 'absolute-root')],
      ['--out-root', 'relative-root'],
      ['--receipts-dir', path.join(root, 'absolute-receipts')],
      ['--receipts-dir', 'relative-receipts'],
    ];

    for (const [flag, value] of variants) {
      const result = runSourceCommand(
        [
          'partition',
          '--governed',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--goal-contract',
          frozen.goalContractPath,
          flag,
          value,
          '--json',
        ],
        { cwd: root }
      );

      assert.notEqual(result.status, 0, `${flag} ${value}`);
      const payload = parsePayload(result);
      assert.equal(
        payload.failureClass,
        'partition_governed_raw_output_override_rejected'
      );
      assert.deepEqual(payload.forbidden, [flag]);
    }
    assert.equal(fs.existsSync(path.join(root, '_bmad-output')), false);
  });

  it('rejects stale source contract coverage and generation authority before writing output', () => {
    const cases = [
      {
        name: 'source',
        mutate({ source }) {
          fs.appendFileSync(source, '\nsource drift\n', 'utf8');
        },
      },
      {
        name: 'contract',
        mutate({ frozen }) {
          fs.appendFileSync(
            frozen.goalContractPath,
            '\ncontract drift\n',
            'utf8'
          );
        },
      },
      {
        name: 'coverage receipt',
        mutate({ frozen }) {
          const receipt = JSON.parse(
            fs.readFileSync(frozen.coverageReceiptPath, 'utf8')
          );
          receipt.sourcePlanHash = hash('stale coverage source');
          fs.writeFileSync(
            frozen.coverageReceiptPath,
            `${JSON.stringify(receipt, null, 2)}\n`,
            'utf8'
          );
        },
      },
      {
        name: 'generation receipt',
        mutate({ frozen }) {
          const receipt = JSON.parse(
            fs.readFileSync(frozen.generationReceiptPath, 'utf8')
          );
          receipt.goalContractDocumentHash = hash(
            'stale generation contract'
          );
          fs.writeFileSync(
            frozen.generationReceiptPath,
            `${JSON.stringify(receipt, null, 2)}\n`,
            'utf8'
          );
        },
      },
    ];

    for (const testCase of cases) {
      const root = tempRoot();
      const source = writeSourcePlan(root);
      const frozen = writeFrozenSuccessorContract(root, source);
      testCase.mutate({ frozen, source });

      const result = runSourceCommand(
        [
          'partition',
          '--governed',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--goal-contract',
          frozen.goalContractPath,
          '--sequence-mode',
          'disabled',
          '--json',
        ],
        { cwd: root }
      );

      assert.notEqual(result.status, 0, testCase.name);
      assert.equal(
        parsePayload(result).failureClass,
        'blocked_by_frozen_successor_goal_contract',
        testCase.name
      );
      assert.equal(fs.existsSync(path.join(root, '_bmad-output')), false);
    }
  });

  it('uses current generation inputs without rejecting compiler-dependent frozen provenance', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source, {
      slotWrappedFrontMatter: true,
    });
    const receipt = JSON.parse(
      fs.readFileSync(frozen.generationReceiptPath, 'utf8')
    );
    Object.assign(receipt.compilationReceipt, {
      profileBytesHash: hash('frozen profile bytes'),
      templateBytesHash: hash('frozen template bytes'),
      canonicalIntentSemanticHash: hash('frozen canonical intent semantic'),
      canonicalIntentBundleHash: hash('frozen canonical intent bundle'),
      authorityAttestationHash: hash('frozen authority attestation'),
      goalContractSemanticHash: hash('frozen goal contract semantic'),
      goalContractHash: hash('frozen goal contract'),
      compilerIdentityHash: hash('frozen compiler identity'),
      compilePolicyHash: hash('frozen compile policy'),
    });
    fs.writeFileSync(
      frozen.generationReceiptPath,
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8'
    );

    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    assert.equal(payload.authorityMode, 'standalone_bootstrap');
    assert.equal(payload.sourceHash, frozen.sourcePlanHash);
    assert.match(payload.generationKey, /^sha256:[0-9a-f]{64}$/u);
  });

  it('reports the bounded offending value for governed impact path escapes', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source, {
      slotWrappedFrontMatter: true,
    });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src', 'escape.ts'),
      "import '../../outside';\n",
      'utf8'
    );

    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.notEqual(result.status, 0);
    const payload = parsePayload(result);
    assert.equal(payload.failureClass, 'partition_impact_path_escape');
    assert.equal(payload.value, '../outside');
    assert.equal(fs.existsSync(path.join(root, '_bmad-output')), false);
  });

  it('keeps a baseline consumer in impact evidence without changing child membership', () => {
    const root = tempRoot();
    const { sourcePath } = writeStructuredDependencySourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    fs.mkdirSync(path.join(root, 'packages', 'example', 'src'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, 'packages', 'example', 'src', 'freeze.ts'),
      'export const frozen = true;\n',
      'utf8'
    );
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src', 'baseline.ts'),
      "import { frozen } from '../packages/example/src/freeze';\nexport { frozen };\n",
      'utf8'
    );

    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const impactGraphPath = path.join(
      payload.unitRoot,
      payload.partitionManifest.partitionImpactGraphPath
    );
    const impactGraph = JSON.parse(
      fs.readFileSync(impactGraphPath, 'utf8')
    );
    const baselineArtifact = impactGraph.artifactNodes.find(
      ({ path: artifactPath }) => artifactPath === 'src/baseline.ts'
    );
    const governedPaths = new Set(
      payload.partitionManifest.partitions.flatMap(
        (partition) => partition.governedPaths
      )
    );

    assert.equal(baselineArtifact.ownerPartitionId, 'baseline');
    assert.equal(baselineArtifact.mutable, false);
    assert.equal(governedPaths.has('src/baseline.ts'), false);
    assert.equal(fs.existsSync(payload.activePointerPath), true);
  });

  it('materializes a frozen governed standalone generation with manifest v2 and children', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    assert.equal(payload.authorityMode, 'standalone_bootstrap');
    assert.equal(payload.sourceHash, frozen.sourcePlanHash);
    assert.match(payload.generationKey, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(payload.partitionManifest.schemaVersion, 'goal-contract-partition-manifest/v2');
    assert.equal(
      fs.existsSync(payload.activePointerPath),
      true
    );
    assert.equal(
      fs.existsSync(path.join(payload.unitRoot, 'contracts')),
      false
    );
    const pointer = JSON.parse(
      fs.readFileSync(payload.activePointerPath, 'utf8')
    );
    assert.equal(
      pointer.partitionManifestHash,
      payload.partitionManifestHash
    );
    assert.equal(
      pointer.partitionManifestDocumentHash,
      payload.partitionManifestDocumentHash
    );
    assert.equal(
      hash(fs.readFileSync(payload.partitionManifestPath)),
      payload.partitionManifestDocumentHash
    );
    for (const receipt of pointer.requiredReceiptHashes) {
      const receiptPath = path.join(payload.unitRoot, receipt.path);
      assert.equal(fs.existsSync(receiptPath), true, receipt.path);
      assert.equal(hash(fs.readFileSync(receiptPath)), receipt.hash);
    }
    assert.equal(
      payload.partitionManifest.partitionPlanPath,
      'partition-plan.json'
    );
    assert.equal(
      payload.partitionManifest.globalCoverageReceiptPath,
      'receipts/global-coverage.receipt.json'
    );
    assert.equal(
      payload.partitionManifest.partitionAnalysisReceiptPath,
      'receipts/partition-analysis.receipt.json'
    );
    assert.notEqual(
      payload.partitionManifest.partitionAnalysisReceiptPath,
      payload.partitionManifest.partitionPlanPath
    );
    const partitionPlan = JSON.parse(
      fs.readFileSync(payload.partitionPlanPath, 'utf8')
    );
    const analysisReceiptPath = path.join(
      payload.unitRoot,
      payload.partitionManifest.partitionAnalysisReceiptPath
    );
    const analysisReceiptBytes = fs.readFileSync(analysisReceiptPath);
    const analysisReceipt = JSON.parse(analysisReceiptBytes);
    assert.equal(
      hash(analysisReceiptBytes),
      payload.partitionManifest.partitionAnalysisReceiptHash
    );
    assert.equal(
      analysisReceipt.partitionPlanHash,
      payload.partitionPlanHash
    );
    assert.equal(
      analysisReceipt.partitionImpactGraphHash,
      payload.partitionManifest.partitionImpactGraphHash
    );
    const impactGraphPath = path.join(
      payload.unitRoot,
      payload.partitionManifest.partitionImpactGraphPath
    );
    const impactGraphBytes = fs.readFileSync(impactGraphPath);
    const impactGraph = JSON.parse(impactGraphBytes);
    assert.equal(
      impactGraph.impactGraphHash,
      payload.partitionManifest.partitionImpactGraphHash
    );
    assert.equal(
      hash(impactGraphBytes),
      payload.partitionManifest.partitionImpactGraphDocumentHash
    );
    const feasibilityPath = path.join(
      payload.unitRoot,
      payload.partitionManifest.partitionClosureFeasibilityReceiptPath
    );
    const feasibilityBytes = fs.readFileSync(feasibilityPath);
    const feasibility = JSON.parse(feasibilityBytes);
    assert.equal(
      hash(feasibilityBytes),
      payload.partitionManifest.partitionClosureFeasibilityReceiptHash
    );
    assert.equal(feasibility.decision, 'pass');
    assert.equal(
      payload.partitionManifest.partitionClosureFeasibilityDecision,
      'pass'
    );
    const driftPath = path.join(
      payload.unitRoot,
      payload.partitionManifest.partitionImpactDriftReceiptPath
    );
    const driftBytes = fs.readFileSync(driftPath);
    const drift = JSON.parse(driftBytes);
    assert.equal(
      hash(driftBytes),
      payload.partitionManifest.partitionImpactDriftReceiptHash
    );
    assert.equal(drift.mode, 'generation_baseline');
    assert.equal(drift.decision, 'baseline_frozen');
    assert.equal(drift.driftHash, payload.partitionManifest.driftHash);
    for (const field of [
      'repositoryTreeHash',
      'partitionImpactPolicyHash',
      'partitionImpactAnalyzerIdentityHash',
      'partitionImpactGraphHash',
      'partitionImpactGraphDocumentHash',
      'partitionClosureFeasibilityReceiptHash',
      'partitionImpactDriftReceiptHash',
      'driftHash',
    ]) {
      assert.equal(
        partitionPlan[field],
        payload.partitionManifest[field],
        field
      );
    }
    const requiredReceiptPaths = new Set(
      pointer.requiredReceiptHashes.map(({ path: receiptPath }) => receiptPath)
    );
    for (const receiptPath of [
      payload.partitionManifest.partitionAnalysisReceiptPath,
      payload.partitionManifest.partitionImpactGraphPath,
      payload.partitionManifest.partitionClosureFeasibilityReceiptPath,
      payload.partitionManifest.partitionImpactDriftReceiptPath,
    ]) {
      assert.equal(requiredReceiptPaths.has(receiptPath), true, receiptPath);
    }
    assert.equal(
      fs.existsSync(
        path.join(payload.unitRoot, 'receipts', 'global-coverage.receipt.json')
      ),
      true
    );
    const globalCoverage = JSON.parse(
      fs.readFileSync(
        path.join(
          payload.unitRoot,
          'receipts',
          'global-coverage.receipt.json'
        ),
        'utf8'
      )
    );
    assert.equal(
      globalCoverage.partitionManifestHash,
      payload.partitionManifestDocumentHash
    );
    for (const partition of payload.partitionManifest.partitions) {
      const feasibilityRecord = feasibility.partitionRecords.find(
        ({ partitionId }) => partitionId === partition.partitionId
      );
      assert.ok(feasibilityRecord, partition.partitionId);
      assert.equal(
        partition.partitionClosureFeasibilityHash,
        feasibilityRecord.partitionClosureFeasibilityHash
      );
      assert.deepEqual(
        partition.closureRelevantArtifactIds,
        feasibilityRecord.closureRelevantArtifactIds
      );
      assert.deepEqual(
        partition.closureRelevantCommandIds,
        feasibilityRecord.closureRelevantCommandIds
      );
      assert.equal(
        fs.existsSync(path.join(root, partition.childContractPath)),
        true
      );
      assert.equal(
        partition.selectionReceiptPath,
        `receipts/partitions/${partition.partitionId}/selection.receipt.json`
      );
      const selectionReceipt = JSON.parse(
        fs.readFileSync(
          path.join(payload.unitRoot, partition.selectionReceiptPath),
          'utf8'
        )
      );
      assert.equal(
        selectionReceipt.partitionManifestHash,
        payload.partitionManifestDocumentHash
      );
      assert.equal(
        selectionReceipt.selectionSetHash,
        partition.selectionSetHash
      );
      assert.equal(
        fs.existsSync(
          path.join(
            payload.unitRoot,
            'receipts',
            'children',
            `${partition.partitionId}.coverage.json`
          )
        ),
        true
      );
      assert.equal(
        fs.existsSync(
          path.join(
            payload.unitRoot,
            'receipts',
            'children',
            `${partition.partitionId}.generation.json`
          )
        ),
        true
      );
      const compilationReceipt = JSON.parse(
        fs.readFileSync(
          path.join(
            payload.unitRoot,
            'receipts',
            'children',
            `${partition.partitionId}.compilation.json`
          ),
          'utf8'
        )
      );
      const generationReceipt = JSON.parse(
        fs.readFileSync(
          path.join(
            payload.unitRoot,
            'receipts',
            'children',
            `${partition.partitionId}.generation.json`
          ),
          'utf8'
        )
      );
      const coverageReceipt = JSON.parse(
        fs.readFileSync(
          path.join(
            payload.unitRoot,
            'receipts',
            'children',
            `${partition.partitionId}.coverage.json`
          ),
          'utf8'
        )
      );
      assert.equal(
        coverageReceipt.partitionManifestHash,
        payload.partitionManifestDocumentHash
      );
      assert.equal(
        generationReceipt.partitionManifestHash,
        payload.partitionManifestDocumentHash
      );
      for (const receipt of [compilationReceipt, generationReceipt]) {
        assert.equal(
          receipt.partitionImpactGraphHash,
          payload.partitionManifest.partitionImpactGraphHash
        );
        assert.equal(
          receipt.partitionClosureFeasibilityHash,
          partition.partitionClosureFeasibilityHash
        );
        assert.equal(receipt.driftHash, payload.partitionManifest.driftHash);
      }
    }
  });

  it('releases a governed child from the canonical immutable generation without a supersession bundle', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source, {
      slotWrappedFrontMatter: true,
    });
    const partitionResult = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(
      partitionResult.status,
      0,
      partitionResult.stderr || partitionResult.stdout
    );
    const partitionPayload = parsePayload(partitionResult);
    const child = partitionPayload.partitionManifest.partitions[0];
    const childPath = [
      path.resolve(root, child.childContractPath),
      path.resolve(partitionPayload.unitRoot, child.childContractPath),
    ].find((candidate) => fs.existsSync(candidate));
    assert.ok(childPath, child.childContractPath);
    assert.equal(
      fs.existsSync(path.join(partitionPayload.unitRoot, 'bundle-manifest.json')),
      false
    );

    const releaseResult = runSourceCommand(
      [
        'release-gate',
        '--goal',
        childPath,
        '--source',
        source,
        '--partition-manifest',
        partitionPayload.partitionManifestPath,
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(
      releaseResult.status,
      0,
      releaseResult.stderr || releaseResult.stdout
    );
    const releasePayload = parsePayload(releaseResult);
    assert.equal(releasePayload.ok, true);
    assert.equal(releasePayload.decision, 'pass');
    assert.deepEqual(releasePayload.blockingReasons, []);
  });

  it('rejects a self-consistent canonical manifest that uses a unit-relative child path', () => {
    const fixture = stageCanonicalReleaseFixture();
    rewriteFirstChildAsUnitRelative(fixture);

    assert.throws(
      () =>
        loadCanonicalPartitionAuthorityForRelease({
          repositoryRoot: fixture.root,
          partitionManifestPath:
            fixture.payload.partitionManifestPath,
          goalPath: fixture.childPath,
          expectedPartitionPlanHash:
            fixture.payload.partitionPlanHash,
        }),
      (error) =>
        error.failureClass ===
        'canonical_partition_child_path_invalid'
    );
  });

  it('anchors canonical release authority to the governed repository root', () => {
    const fixture = stageCanonicalReleaseFixture();

    assert.throws(
      () =>
        loadCanonicalPartitionAuthorityForRelease({
          repositoryRoot: path.join(fixture.root, 'wrong-root'),
          partitionManifestPath:
            fixture.payload.partitionManifestPath,
          goalPath: fixture.childPath,
          expectedPartitionPlanHash:
            fixture.payload.partitionPlanHash,
        }),
      (error) =>
        error.failureClass ===
        'canonical_partition_authority_root_invalid'
    );
  });

  it('rejects an active pointer that changes during canonical release validation', () => {
    const fixture = stageCanonicalReleaseFixture();
    const activePointerPath = path.resolve(
      fixture.payload.activePointerPath
    );
    const originalReadFileSync = fs.readFileSync;
    let pointerReadCount = 0;
    fs.readFileSync = (filePath, ...args) => {
      const bytes = originalReadFileSync(filePath, ...args);
      if (path.resolve(filePath) !== activePointerPath) {
        return bytes;
      }
      pointerReadCount += 1;
      if (pointerReadCount !== 2) return bytes;
      return typeof bytes === 'string'
        ? `${bytes}\n`
        : Buffer.concat([bytes, Buffer.from('\n')]);
    };
    try {
      assert.throws(
        () =>
          loadCanonicalPartitionAuthorityForRelease({
            repositoryRoot: fixture.root,
            partitionManifestPath:
              fixture.payload.partitionManifestPath,
            goalPath: fixture.childPath,
            expectedPartitionPlanHash:
              fixture.payload.partitionPlanHash,
          }),
        (error) =>
          error.failureClass ===
          'canonical_partition_active_pointer_changed'
      );
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
  });

  it('rejects canonical authority artifacts reached through a junction', () => {
    const fixture = stageCanonicalReleaseFixture();
    const childrenPath = path.join(
      fixture.payload.unitRoot,
      'children'
    );
    const externalChildrenPath = path.join(
      fixture.root,
      'external-children'
    );
    fs.renameSync(childrenPath, externalChildrenPath);
    fs.symlinkSync(
      externalChildrenPath,
      childrenPath,
      'junction'
    );

    assert.throws(
      () =>
        loadCanonicalPartitionAuthorityForRelease({
          repositoryRoot: fixture.root,
          partitionManifestPath:
            fixture.payload.partitionManifestPath,
          goalPath: fixture.childPath,
          expectedPartitionPlanHash:
            fixture.payload.partitionPlanHash,
        }),
      (error) =>
        error.failureClass ===
        'canonical_partition_authority_symlink_rejected'
    );
  });

  it('allows a repository-root junction without allowing authority-subtree redirects', () => {
    const fixture = stageCanonicalReleaseFixture();
    const aliasRoot = `${fixture.root}-alias`;
    fs.symlinkSync(
      fixture.root,
      aliasRoot,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    const manifestPath = path.join(
      aliasRoot,
      path.relative(
        fixture.root,
        fixture.payload.partitionManifestPath
      )
    );
    const goalPath = path.join(
      aliasRoot,
      path.relative(fixture.root, fixture.childPath)
    );

    const authority =
      loadCanonicalPartitionAuthorityForRelease({
        repositoryRoot: aliasRoot,
        partitionManifestPath: manifestPath,
        goalPath,
        expectedPartitionPlanHash:
          fixture.payload.partitionPlanHash,
      });

    assert.equal(authority.authorityMode, 'canonical_governed');
    assert.equal(
      authority.partitionPlanHash,
      fixture.payload.partitionPlanHash
    );
  });

  it('routes every supersession-specific marker to fail-closed successor verification', () => {
    const fixture = stageCanonicalReleaseFixture();
    const unrelatedPath = path.join(
      fixture.payload.unitRoot,
      'unrelated-extra-file.json'
    );
    fs.writeFileSync(unrelatedPath, '{}\n', 'utf8');
    const unrelatedResult = runSourceCommand(
      [
        'release-gate',
        '--goal',
        fixture.childPath,
        '--source',
        fixture.source,
        '--partition-manifest',
        fixture.payload.partitionManifestPath,
        '--json',
      ],
      { cwd: fixture.root }
    );
    assert.equal(
      unrelatedResult.status,
      0,
      unrelatedResult.stderr || unrelatedResult.stdout
    );
    fs.rmSync(unrelatedPath);

    const markers = [
      'receipts/source-grounded-coverage.receipt.json',
      'receipts/legacy-comparison.diagnostic.json',
      'receipts/equivalence.receipt.json',
      'receipts/checkpoint-mappings.json',
      'receipts/render-evidence.json',
      'receipts/pending/partial.receipt.json',
      'receipts/membership/partial.receipt.json',
    ];
    for (const relativePath of markers) {
      const markerPath = path.join(
        fixture.payload.unitRoot,
        relativePath
      );
      fs.mkdirSync(path.dirname(markerPath), {
        recursive: true,
      });
      fs.writeFileSync(markerPath, '{}\n', 'utf8');
      const result = runSourceCommand(
        [
          'release-gate',
          '--goal',
          fixture.childPath,
          '--source',
          fixture.source,
          '--partition-manifest',
          fixture.payload.partitionManifestPath,
          '--json',
        ],
        { cwd: fixture.root }
      );
      assert.equal(
        result.status,
        1,
        `${relativePath}\n${result.stderr || result.stdout}`
      );
      fs.rmSync(markerPath);
      for (const markerDirectory of [
        'receipts/pending',
        'receipts/membership',
      ]) {
        const directoryPath = path.join(
          fixture.payload.unitRoot,
          markerDirectory
        );
        if (
          fs.existsSync(directoryPath) &&
          fs.readdirSync(directoryPath).length === 0
        ) {
          fs.rmdirSync(directoryPath);
        }
      }
    }
  });

  it('projects source task outcomes into functional child display titles', () => {
    const root = tempRoot();
    const { sourcePath } = writeStructuredDependencySourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const titles = payload.partitionManifest.partitions.map(
      ({ displayTitle }) => displayTitle
    );
    const projectedTitles = titles.join('; ');

    assert.match(projectedTitles, /Freeze source authority/u);
    assert.match(projectedTitles, /Normalize source obligations/u);
    assert.match(projectedTitles, /Finalize partition authority/u);
    assert.ok(titles.every((title) => !/^Partition \d+(?::|$)/u.test(title)));
  });

  it('publishes standalone governed child paths relative to the repository root', () => {
    const root = tempRoot();
    const { sourcePath } = writeStructuredDependencySourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const unitRootPath = path.relative(root, payload.unitRoot).replace(/\\/gu, '/');

    for (const partition of payload.partitionManifest.partitions) {
      assert.match(
        partition.childContractPath,
        new RegExp(`^${unitRootPath.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/children/`, 'u')
      );
      assert.equal(
        fs.existsSync(path.join(root, partition.childContractPath)),
        true,
        partition.childContractPath
      );
    }
  });

  it('preserves a frozen source-plan DAG and Files ownership in governed children', () => {
    const root = tempRoot();
    const { sourcePath, tasks } = writeStructuredDependencySourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const manifest = payload.partitionManifest;
    const partitionByTaskId = new Map(
      manifest.partitions.flatMap((partition) =>
        partition.primaryTaskIds.map((taskId) => [taskId, partition])
      )
    );
    const governedPaths = [
      ...new Set(
        manifest.partitions.flatMap((partition) => partition.governedPaths)
      ),
    ].sort();

    assert.deepEqual(
      governedPaths,
      tasks.map(([, , governedPath]) => governedPath).sort()
    );
    for (const [taskId] of tasks) {
      assert.ok(partitionByTaskId.has(taskId), taskId);
    }
    for (let index = 1; index < tasks.length; index += 1) {
      const predecessor = partitionByTaskId.get(tasks[index - 1][0]);
      const dependent = partitionByTaskId.get(tasks[index][0]);
      if (predecessor.partitionId !== dependent.partitionId) {
        assert.ok(
          dependent.dependencyPartitionIds.includes(predecessor.partitionId),
          `${tasks[index][0]} must depend on ${tasks[index - 1][0]}`
        );
        assert.ok(
          manifest.topologicalOrder.indexOf(predecessor.partitionId) <
            manifest.topologicalOrder.indexOf(dependent.partitionId),
          `${predecessor.partitionId} must precede ${dependent.partitionId}`
        );
      }
    }
    assert.ok(
      manifest.partitions.some(
        (partition) => partition.dependencyPartitionIds.length > 0
      )
    );
  });

  it('excludes aggregate-only tasks from child membership and binds ordered aggregate validation', () => {
    const root = tempRoot();
    const sourcePath = writeRoleAwareSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const manifest = payload.partitionManifest;
    assert.deepEqual(
      manifest.partitions.flatMap((partition) => partition.primaryTaskIds),
      ['PLAN-T01']
    );
    assert.deepEqual(manifest.aggregateValidation.taskOrder, ['PLAN-T02']);
    assert.deepEqual(manifest.aggregateValidation.commandOrder, ['CMD-PLAN-T02-01']);
    assert.deepEqual(
      manifest.aggregateValidation.tasks[0].dependencyTaskIds,
      ['PLAN-T01']
    );
    assert.match(
      manifest.aggregateValidation.aggregateValidationHash,
      /^sha256:[0-9a-f]{64}$/u
    );
    assert.equal(
      manifest.partitions.some((partition) =>
        partition.primaryTaskIds.includes('PLAN-T02')
      ),
      false
    );
    for (const field of [
      'taskExecutionRoleAuthorityHash',
      'aggregateValidation',
    ]) {
      const partialManifest = structuredClone(manifest);
      delete partialManifest[field];
      assert.throws(
        () =>
          validateGoalContractSchema(
            'goal-contract-partition-manifest.schema.json',
            partialManifest
          ),
        (error) => error.failureClass === 'canonical_schema_invalid'
      );
    }
  });

  it('exposes one strict Main Agent source-authority certification schema', () => {
    const manifestSchema = loadGoalContractSchema(
      'goal-contract-partition-manifest.schema.json'
    ).schema;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateCertification = ajv.compile({
      $schema: manifestSchema.$schema,
      $defs: manifestSchema.$defs,
      $ref: '#/$defs/mainAgentGoalSourceAuthorityCertification',
    });
    const certification = {
      schemaVersion: 'main-agent-goal-source-authority-certification/v1',
      authorityProfile: 'main_agent_compiled',
      sourceAuthorityCompilationReceipt: {
        sourceAuthorityHash: hash('source-authority'),
        sourceSnapshotHash: hash('source-snapshot'),
      },
      goalContractBundleHash: hash('goal-contract-bundle'),
      partitionManifestHash: hash('partition-manifest'),
      partitionCoverageReceiptHash: hash('partition-coverage'),
      currentDispatchPointerHash: hash('dispatch-pointer'),
      transactionManifestHash: hash('transaction-manifest'),
      requirementRecordBinding: {
        status: 'present',
        recordId: 'record-1',
        requirementSetId: 'set-1',
        recordPathHash: hash('record-path'),
      },
      runtimeBundleBinding: {
        runtimeBundleHash: hash('runtime-bundle'),
      },
      semanticAuthorityBinding: {
        canonicalIntentBundleHash: hash('canonical-intent-bundle'),
      },
      modelPacketBinding: {
        modelPacketHash: hash('model-packet'),
      },
      goalProjectionBinding: {
        goalProjectionHash: hash('goal-projection'),
      },
      viewReconciliationBinding: {
        reconciledViewsHash: hash('reconciled-views'),
      },
      certifiedAt: '2026-08-05T00:00:00.000Z',
      certificationHash: hash('certification'),
    };

    assert.equal(
      validateCertification(certification),
      true,
      JSON.stringify(validateCertification.errors)
    );
    const missingField = structuredClone(certification);
    delete missingField.partitionManifestHash;
    assert.equal(validateCertification(missingField), false);
    const unknownField = { ...certification, lifecycleStatus: 'closed' };
    assert.equal(validateCertification(unknownField), false);
  });

  it('preserves explicit executable task boundaries, dependencies, commands, and functional titles', () => {
    const root = tempRoot();
    const { sourcePath, tasks } =
      writeExecutableBoundarySourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const manifest = payload.partitionManifest;
    assert.equal(manifest.partitionCount, tasks.length);
    assert.equal(manifest.partitions.length, tasks.length);

    const partitions = tasks.map(([taskId]) => {
      const partition = manifest.partitions.find(
        (candidate) =>
          candidate.primaryTaskIds.length === 1 &&
          candidate.primaryTaskIds[0] === taskId
      );
      assert.ok(partition, taskId);
      return partition;
    });
    for (let index = 0; index < tasks.length; index += 1) {
      const [taskId, title] = tasks[index];
      const partition = partitions[index];
      assert.equal(partition.displayTitle, title);
      assert.deepEqual(
        partition.commandIds,
        [`CMD-${taskId}-01`]
      );
      assert.deepEqual(
        partition.dependencyPartitionIds,
        index === 0
          ? []
          : [partitions[index - 1].partitionId]
      );
    }
    assert.deepEqual(
      manifest.topologicalOrder,
      partitions.map(({ partitionId }) => partitionId)
    );
  });

  it('does not activate a standalone generation before explicit child readiness passes', () => {
    const root = tempRoot();
    const { sourcePath } = writeExecutableBoundarySourcePlan(root, {
      sharedOwnedPath: true,
    });
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 1, result.stderr || result.stdout);
    const payload = parsePayload(result);
    assert.equal(
      payload.failureClass,
      'partition_readiness_empty_ownership'
    );
    const forbiddenArtifacts = [];
    const visit = (directory) => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, {
        withFileTypes: true,
      })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        if (
          entry.isFile() &&
          (entry.name === 'active-generation.json' ||
            entry.name === 'partition-manifest.json' ||
            target
              .replace(/\\/gu, '/')
              .includes('/children/'))
        ) {
          forbiddenArtifacts.push(
            path.relative(root, target).replace(/\\/gu, '/')
          );
        }
      }
    };
    visit(path.join(root, '_bmad-output'));
    assert.deepEqual(forbiddenArtifacts, []);
  });

  it('keeps shared task paths governed by every declaring child while retaining one owner', () => {
    const root = tempRoot();
    const { sourcePath } = writeSharedDependencySourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, sourcePath, {
      slotWrappedFrontMatter: true,
    });
    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        sourcePath,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const manifest = payload.partitionManifest;
    const sharedPath = 'src/shared.ts';
    const partitionByTaskId = new Map(
      manifest.partitions.flatMap((partition) =>
        partition.primaryTaskIds.map((taskId) => [taskId, partition])
      )
    );
    const ownerPartition = partitionByTaskId.get('FIX-T01');
    const consumerPartition = partitionByTaskId.get('FIX-T02');

    assert.ok(ownerPartition);
    assert.ok(consumerPartition);
    assert.notEqual(ownerPartition.partitionId, consumerPartition.partitionId);
    assert.deepEqual(
      manifest.partitions.filter((partition) =>
        partition.ownedArtifactPaths.includes(sharedPath)
      ).map(({ partitionId }) => partitionId),
      [ownerPartition.partitionId]
    );
    assert.equal(ownerPartition.governedPaths.includes(sharedPath), true);
    assert.equal(consumerPartition.governedPaths.includes(sharedPath), true);
    const ownerConsumerRecord = manifest.partitions
      .flatMap((partition) => partition.ownerConsumerRecords || [])
      .find((record) => record.artifactPath === sharedPath);
    assert.deepEqual(ownerConsumerRecord, {
      artifactPath: sharedPath,
      ownerPartitionId: ownerPartition.partitionId,
      consumerPartitionIds: [consumerPartition.partitionId],
    });

    for (const partition of [ownerPartition, consumerPartition]) {
      const childBytes = fs.readFileSync(
        path.join(root, partition.childContractPath),
        'utf8'
      );
      const governedLine = childBytes
        .split(/\r?\n/u)
        .find((line) => line.startsWith('governedPaths: '));
      assert.equal(
        JSON.parse(governedLine.slice('governedPaths: '.length)).includes(sharedPath),
        true
      );
      const compilationReceipt = JSON.parse(
        fs.readFileSync(
          path.join(
            payload.unitRoot,
            'receipts',
            'children',
            `${partition.partitionId}.compilation.json`
          ),
          'utf8'
        )
      );
      assert.equal(compilationReceipt.governedPaths.includes(sharedPath), true);
    }
  });

  it('preserves a legacy contracts tree byte-for-byte during governed generation', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source);
    const legacyPath = path.join(
      root,
      '_bmad-output',
      'runtime',
      'goal-contract-partition-bootstrap',
      frozen.sourcePlanHash.slice('sha256:'.length),
      'contracts',
      'legacy-child-goal-execution-plan.md'
    );
    const legacyBytes = Buffer.from('# legacy child\n\nimmutable bytes\n');
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(legacyPath, legacyBytes);

    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--goal-contract',
        frozen.goalContractPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.readFileSync(legacyPath).equals(legacyBytes), true);
    const payload = parsePayload(result);
    assert.equal(fs.existsSync(path.join(payload.unitRoot, 'contracts')), false);
  });

  it('fails closed instead of recreating a retained receipt that disappears from an active generation', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source);
    const args = [
      'partition',
      '--governed',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--goal-contract',
      frozen.goalContractPath,
      '--sequence-mode',
      'disabled',
      '--json',
    ];
    const first = runSourceCommand(args, { cwd: root });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const firstPayload = parsePayload(first);
    const missingReceipt = path.join(
      firstPayload.unitRoot,
      'receipts',
      'global-coverage.receipt.json'
    );
    fs.rmSync(missingReceipt);

    const second = runSourceCommand(args, { cwd: root });

    assert.notEqual(second.status, 0);
    assert.equal(
      parsePayload(second).failureClass,
      'partition_generation_incomplete'
    );
    assert.equal(fs.existsSync(missingReceipt), false);
  });

  it('fails closed when an immutable governed artifact already has different bytes', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source);
    const args = [
      'partition',
      '--governed',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--goal-contract',
      frozen.goalContractPath,
      '--sequence-mode',
      'disabled',
      '--json',
    ];
    const first = runSourceCommand(args, { cwd: root });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const firstPayload = parsePayload(first);
    fs.writeFileSync(
      firstPayload.partitionManifestPath,
      '{"tampered":true}\n',
      'utf8'
    );

    const second = runSourceCommand(args, { cwd: root });

    assert.notEqual(second.status, 0);
    assert.equal(
      parsePayload(second).failureClass,
      'partition_immutable_bytes_conflict'
    );
    assert.equal(
      fs.readFileSync(firstPayload.partitionManifestPath, 'utf8'),
      '{"tampered":true}\n'
    );
  });

  it('commits a governed RequirementRecord-scoped partition run through the controlled writer', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source);
    const recordPath = writeRequirementRecord(root, frozen.sourcePlanHash);

    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--goal-contract',
        frozen.goalContractPath,
        '--requirement-record',
        recordPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = parsePayload(result);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    assert.equal(payload.authorityMode, 'requirement_record');
    assert.equal(
      record.lastEventType,
      'goal_contract_partition_authority_superseded'
    );
    assert.equal(
      record.nativeGoalHandoff.goalContractPartitionAuthority.partitionRunId,
      payload.partitionManifest.partitionRunId
    );
    assert.equal(fs.existsSync(payload.activePointerPath), true);
    assert.equal(
      fs.existsSync(
        path.join(
          root,
          '_bmad-output',
          'runtime',
          'goal-contract-partition-bootstrap',
          frozen.sourcePlanHash.slice('sha256:'.length),
          'active-generation.json'
        )
      ),
      false
    );
  });

  it('rejects an unauthorized RequirementRecord before writing partition run bytes', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const frozen = writeFrozenSuccessorContract(root, source);
    const recordPath = writeRequirementRecord(
      root,
      frozen.sourcePlanHash,
      { authorized: false }
    );
    const authorityRoot = path.join(
      path.dirname(recordPath),
      'goal-contract'
    );

    const result = runSourceCommand(
      [
        'partition',
        '--governed',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--goal-contract',
        frozen.goalContractPath,
        '--requirement-record',
        recordPath,
        '--sequence-mode',
        'disabled',
        '--json',
      ],
      { cwd: root }
    );

    assert.notEqual(result.status, 0);
    assert.equal(
      parsePayload(result).failureClass,
      'partition_authority_writer_not_authorized'
    );
    assert.equal(fs.existsSync(authorityRoot), false);
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

  it('rejects raw path escape authority-root overlap and cross-requirement placement', () => {
    const cases = [
      {
        name: 'output path escape',
        failureClass: 'partition_raw_output_path_escape',
        paths(root) {
          return {
            outRoot: path.join(root, 'raw'),
            out: path.join(root, 'escaped-manifest.json'),
            receipts: path.join(root, 'raw', 'receipts'),
          };
        },
      },
      {
        name: 'receipt path escape',
        failureClass: 'partition_raw_output_path_escape',
        paths(root) {
          return {
            outRoot: path.join(root, 'raw'),
            out: path.join(root, 'raw', 'partition-manifest.json'),
            receipts: path.join(root, 'escaped-receipts'),
          };
        },
      },
      {
        name: 'authority root overlap',
        failureClass: 'partition_raw_authority_root_overlap',
        paths(root) {
          const outRoot = path.join(
            root,
            '_bmad-output',
            'runtime',
            'goal-contract-partition-bootstrap',
            'diagnostic'
          );
          return {
            outRoot,
            out: path.join(outRoot, 'partition-manifest.json'),
            receipts: path.join(outRoot, 'receipts'),
          };
        },
      },
      {
        name: 'cross requirement placement',
        failureClass: 'partition_raw_cross_requirement_placement',
        paths(root) {
          const outRoot = path.join(
            root,
            '_bmad-output',
            'runtime',
            'requirement-records',
            'REQ-OTHER',
            'diagnostic'
          );
          return {
            outRoot,
            out: path.join(outRoot, 'partition-manifest.json'),
            receipts: path.join(outRoot, 'receipts'),
          };
        },
      },
    ];

    for (const testCase of cases) {
      const root = tempRoot();
      const source = writeSourcePlan(root);
      const paths = testCase.paths(root);
      const result = runSourceCommand(
        [
          'partition',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--out-root',
          paths.outRoot,
          '--out',
          paths.out,
          '--receipts-dir',
          paths.receipts,
          '--json',
        ],
        { cwd: root }
      );

      assert.notEqual(result.status, 0, testCase.name);
      assert.equal(
        parsePayload(result).failureClass,
        testCase.failureClass,
        testCase.name
      );
      assert.equal(fs.existsSync(paths.out), false);
      assert.equal(fs.existsSync(paths.receipts), false);
    }
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

  it('partitions only explicit Task headings when AC EVD and CMD records are nested', () => {
    const root = tempRoot();
    const source = path.join(root, 'nested-typed-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    fs.writeFileSync(
      source,
      [
        '# Nested Typed Plan',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task J01-T01: Implement actor authority',
        '',
        '- Modify: `src/runtime/actor.ts`',
        '- AC-J01-T01-01: Actor authority is deterministic.',
        '- EVD-J01-T01-01: Actor authority receipt.',
        '- CMD-J01-T01-01: Run `node --version`.',
        '- J01-J05 exported symbols remain reachable.',
        '',
        '### Task J02-T01: Implement judge transport',
        '',
        '- Modify: `src/runtime/judge.ts`',
        '- AC-J02-T01-01: Judge transport is deterministic.',
        '- EVD-J02-T01-01: Judge transport receipt.',
        '- CMD-J02-T01-01: Run `node --version`.',
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
      '--sequence-mode',
      'disabled',
      '--json',
    ]);
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(manifest.partitions.flatMap((partition) => partition.primaryTaskIds).sort(), [
      'J01-T01',
      'J02-T01',
    ]);
    assert.equal(manifest.partitionCount <= 2, true);
    assert.equal(
      manifest.partitions.some((partition) =>
        partition.primaryTaskIds.some((taskId) => /^(?:AC|EVD|CMD)-/u.test(taskId))
      ),
      false
    );
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
    assert.ok(manifest.partitions.flatMap((partition) => partition.primaryTaskIds).length > 1);
    assert.equal(
      manifest.partitions.every((partition) => partition.primaryWriteScopeOwnerCount <= 8),
      true
    );
    assert.equal(
      manifest.partitions.every((partition) => partition.commandIds.includes('CMD-001')),
      true
    );
  });

  it('preserves a wide task when its split rule declares one atomic owner', () => {
    const root = tempRoot();
    const source = path.join(root, 'atomic-wide-source-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    fs.writeFileSync(
      source,
      [
        '# Atomic Wide Structured Plan',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task PLAN-T01: Update one atomic runtime authority',
        '',
        '- Target modification paths:',
        ...Array.from({ length: 10 }, (_, index) => `  - \`src/runtime/file-${index + 1}.ts\``),
        '- Split rule: all runtime files remain one atomic authority owner.',
        '- AC-PLAN-T01-01: Runtime authority remains deterministic.',
        '- EVD-PLAN-T01-01: Runtime authority receipt.',
        '- CMD-PLAN-T01-01: Run `node --version`.',
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
      '--sequence-mode',
      'disabled',
      '--json',
    ]);
    const payload = parsePayload(result);

    assert.equal(result.status, 0, payload.failureClass || result.stderr);
    const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(
      manifest.partitions.flatMap((partition) => partition.primaryTaskIds),
      ['PLAN-T01']
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
        (total, partition) => total + partition.primaryWriteScopeOwnerCount,
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
        partition.ownedArtifactPaths.length === 0 && partition.dependencyPartitionIds.length > 0
    );
    assert.equal(integrationPartitions.length, 1);
    const [integrationPartition] = integrationPartitions;
    assert.equal(integrationPartition.partitionRole, 'final_integration');
    assert.equal(manifest.topologicalOrder.at(-1), integrationPartition.partitionId);
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
    assert.equal(payload.failureClass, 'source_obligation_write_scope_unbound');
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
      manifest.partitions.every((partition) => partition.commandIds.length > 0),
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
        '- Dependencies: PLAN-T01A.',
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
    assert.deepEqual(secondPartition.dependencyPartitionIds, [firstPartition.partitionId]);
  });

  it('projects an unscoped command to every structured task partition', () => {
    const root = tempRoot();
    const source = path.join(root, 'global-command-plan.md');
    const out = path.join(root, 'partition-manifest.json');
    const taskPaths = (prefix) =>
      Array.from({ length: 8 }, (_, index) => `- \`src/runtime/${prefix}-${index + 1}.ts\``);
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
      manifest.partitions.every((partition) => partition.commandIds.includes('CMD-001')),
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
    assert.deepEqual(fs.readFileSync(fixture.invocationLog, 'utf8').trim().split(/\r?\n/u).sort(), [
      'goal_contract_acceptance_evidence_view/v1',
      'goal_contract_implementation_view/v1',
    ]);
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
      fs.appendFileSync(source, `\n## Sequence Requirements\n\n${prose}\n`, 'utf8');
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
      assert.equal(payload.sequenceApplicability, 'not_applicable_with_proof');
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
    assert.equal(payload.failureClass, 'sequence_closure_required_unavailable');
    assert.equal(payload.sequenceMode, 'required');
    assert.equal(payload.sequenceApplicability, 'not_applicable_with_proof');
    assert.equal(fs.existsSync(out), false);
    assert.equal(fs.existsSync(payload.sequenceApplicabilityReceiptPath), true);
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
      JSON.parse(fs.readFileSync(payload.sequenceApplicabilityReceiptPath, 'utf8')),
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
    assert.equal(runs.auto.payload.partitionCount, runs.disabled.payload.partitionCount);
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

describe('goal-contract task file-scope authority', () => {
  function snapshotSet(source) {
    return compileOrderedSourceSnapshotSet({
      sources: [
        {
          sourceKind: 'source_plan',
          sourceArtifactId: 'primary-source',
          sourceRole: 'primary_implementation_authority',
          namespace: 'PRIMARY',
          sourceOrder: 0,
          pathOrSegmentId: 'docs/plans/source.md',
          rawBytes: Buffer.from(source, 'utf8'),
        },
      ],
    });
  }

  it('accepts only repository paths, declared classes, or the no-files sentinel', () => {
    const result = validateTaskFileScopeCells({
      taskId: 'GH-T05',
      declaredPathFamilies: ['goal-contract-runtime'],
      declaredGeneratedSurfaceClasses: ['host-projections'],
      cells: [
        {
          fieldName: 'Files',
          tokens: [
            'packages/bmad-speckit/src/commands/goal-contract.ts',
            'package.json',
            'goal-contract-runtime',
            'host-projections',
          ],
        },
        {
          fieldName: 'Modify',
          tokens: ['_bmad/shared/goal-contract'],
        },
      ],
    });

    assert.equal(result.decision, 'pass');
    assert.deepEqual(result.normalizedCells[0].tokens, [
      'goal-contract-runtime',
      'host-projections',
      'package.json',
      'packages/bmad-speckit/src/commands/goal-contract.ts',
    ]);
    assert.equal(
      validateTaskFileScopeCells({
        taskId: 'GH-T11',
        cells: [
          {
            fieldName: 'Files',
            tokens: ['No production files'],
          },
        ],
      }).decision,
      'pass'
    );
  });

  it('rejects task IDs, prose, path escape, absolute paths, and repository wildcards', () => {
    const cases = [
      ['Files', 'GH-T05'],
      ['Files', 'update all generated surfaces'],
      ['Create', '../escape.ts'],
      ['Modify', 'C:\\temp\\escape.ts'],
      ['Delete', '/etc/passwd'],
      ['Files', '**/*'],
    ];

    for (const [fieldName, offendingToken] of cases) {
      assert.throws(
        () =>
          validateTaskFileScopeCells({
            taskId: 'GH-T05',
            cells: [{ fieldName, tokens: [offendingToken] }],
          }),
        (error) =>
          error.failureClass === 'task_file_scope_invalid' &&
          error.errorCode === 'ER-GH-001' &&
          error.taskId === 'GH-T05' &&
          error.fieldName === fieldName &&
          error.offendingToken === offendingToken &&
          error.substitutePath === undefined
      );
    }
  });

  it('does not combine the no-files sentinel with writable paths', () => {
    assert.throws(
      () =>
        validateTaskFileScopeCells({
          taskId: 'GH-T11',
          cells: [
            {
              fieldName: 'Files',
              tokens: [
                'No production files',
                'packages/bmad-speckit/src/index.ts',
              ],
            },
          ],
        }),
      (error) =>
        error.failureClass === 'task_file_scope_invalid' &&
        error.reasonCode === 'no_production_files_mixed' &&
        error.offendingToken === 'No production files'
    );
  });

  it('rejects an invalid token directly from verified frozen source bytes', () => {
    const source = [
      '# Source Plan',
      '',
      '### GH-T05: Compile manifest',
      '',
      '**Files**',
      '',
      '- Modify: GH-T05',
      '',
      'Steps: compile the manifest.',
      '',
    ].join('\n');

    assert.throws(
      () =>
        compileTaskFileScopeAuthority({
          orderedSourceSnapshotSet: snapshotSet(source),
          reconciledGraph: {
            tasks: [{ id: 'GH-T05' }],
            traceSlices: [
              {
                goalIds: ['GH-T05'],
                allowedPaths: ['GH-T05'],
              },
            ],
          },
        }),
      (error) =>
        error.failureClass === 'task_file_scope_invalid' &&
        error.taskId === 'GH-T05' &&
        error.fieldName === 'Modify' &&
        error.offendingToken === 'GH-T05' &&
        error.sourceArtifactId === 'primary-source' &&
        error.lineStart === 7
    );
  });

  it('emits complete task file-scope failure details from the CLI', () => {
    const root = tempRoot();
    const { sourcePath } = writeStructuredDependencySourcePlan(root);
    const source = fs
      .readFileSync(sourcePath, 'utf8')
      .replace(
        '- Modify `packages/example/src/manifest.ts`.',
        '- Modify: FIX-T05.'
      );
    fs.writeFileSync(sourcePath, source, 'utf8');
    const out = path.join(root, 'manifest.json');
    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      sourcePath,
      '--sequence-mode',
      'disabled',
      '--out',
      out,
      '--json',
    ]);
    const payload = parsePayload(result);

    assert.notEqual(result.status, 0);
    assert.equal(payload.failureClass, 'task_file_scope_invalid');
    assert.equal(payload.errorCode, 'ER-GH-001');
    assert.equal(payload.taskId, 'FIX-T05');
    assert.equal(payload.fieldName, 'Modify');
    assert.equal(payload.offendingToken, 'FIX-T05');
    assert.equal(payload.reasonCode, 'task_id');
    assert.equal(payload.sourceArtifactId, sourcePath.replace(/\\/gu, '/'));
    assert.ok(Number.isInteger(payload.lineStart));
    assert.equal(payload.lineEnd, payload.lineStart);
    assert.equal(payload.substitutePath, undefined);
    assert.equal(fs.existsSync(out), false);
  });
});
