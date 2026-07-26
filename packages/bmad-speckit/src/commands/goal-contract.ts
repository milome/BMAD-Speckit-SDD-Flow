const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

export type GoalContractCommandModule = never;

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PARTITION_ASSET_ROOT = __filename.endsWith('.ts') ? SOURCE_ROOT : PACKAGE_ROOT;

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function loadDistModule(relativePath) {
  return require(path.join(PACKAGE_ROOT, 'dist', relativePath));
}

function loadPartitionModule(relativePath) {
  const sourceBase = path.join(PACKAGE_ROOT, 'src', relativePath);
  const distBase = path.join(PACKAGE_ROOT, 'dist', relativePath);
  const candidates = __filename.endsWith('.ts')
    ? [
        `${sourceBase}.ts`,
        path.join(sourceBase, 'index.ts'),
        `${distBase}.js`,
        path.join(distBase, 'index.js'),
      ]
    : [
        `${distBase}.js`,
        path.join(distBase, 'index.js'),
        `${sourceBase}.ts`,
        path.join(sourceBase, 'index.ts'),
      ];
  return require(firstExistingPath(candidates));
}

function loadWholeSourceDependencies() {
  const { safeWriteText, sha256File } = loadDistModule('utils/large-document-writer');
  const { extractSourceObligations } = loadDistModule(
    'utils/goal-contract/source-obligation-extractor'
  );
  const { buildSlotData } = loadDistModule('utils/goal-contract/slot-data-builder');
  const { resolveEntryScenario, validateEntryAuthority } = loadDistModule(
    'utils/goal-contract/entry-scenarios'
  );
  const { defaultReceiptPaths, writeCoverageReceipt, writeGenerationReceipt } = loadDistModule(
    'utils/goal-contract/goal-contract-receipts'
  );
  const { resolveAuditProfile, runStandaloneDeterministicPreflight } = loadDistModule(
    'utils/goal-contract/standalone-audit-controller'
  );
  return {
    buildSlotData,
    defaultReceiptPaths,
    extractSourceObligations,
    resolveAuditProfile,
    resolveEntryScenario,
    runStandaloneDeterministicPreflight,
    safeWriteText,
    sha256File,
    validateEntryAuthority,
    writeCoverageReceipt,
    writeGenerationReceipt,
  };
}

function take(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('-')) return fallback;
  return value;
}

function has(args, name) {
  return args.includes(name);
}

function takeAll(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (value && !value.startsWith('-')) values.push(value);
  }
  return values;
}

function emitJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function normalize(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function loadRenderer() {
  return require(
    firstExistingPath([
      path.join(
        SOURCE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'render-goal-contract.js'
      ),
      path.join(
        PACKAGE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'render-goal-contract.js'
      ),
    ])
  );
}

function loadCommandPortabilityChecker() {
  return require(
    firstExistingPath([
      path.join(
        SOURCE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'check-contract-command-portability.js'
      ),
      path.join(
        PACKAGE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'check-contract-command-portability.js'
      ),
    ])
  );
}

function failurePayload(failureClass, error, extra = {}) {
  const payload = {
    ok: false,
    schemaVersion: 'goal-contract-generation-receipt/v1',
    failureClass,
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  };
  for (const field of [
    'sourceId',
    'lineStart',
    'lineEnd',
    'matchedPhrase',
    'sourceExcerpt',
    'repairHint',
  ]) {
    if (error && Object.prototype.hasOwnProperty.call(error, field)) {
      payload[field] = error[field];
    }
  }
  return payload;
}

function rendererIssues(audit) {
  const issues = [];
  for (const [field, code] of [
    ['missingRequiredSlots', 'required_slot_missing'],
    ['missingRequiredSections', 'required_section_missing'],
    ['missingInvariantFragments', 'invariant_fragment_missing'],
  ]) {
    for (const location of audit?.[field] || []) {
      issues.push({ code, location });
    }
  }
  return issues;
}

function assertPartitionGenerationArgsComplete(args) {
  const manifestFlag = has(args, '--partition-manifest');
  const partitionIdFlag = has(args, '--partition-id');
  const manifestPath = take(args, '--partition-manifest');
  const partitionId = take(args, '--partition-id');
  if (manifestFlag !== partitionIdFlag || (manifestFlag && (!manifestPath || !partitionId))) {
    throw Object.assign(new Error('partition_generation_arguments_incomplete'), {
      failureClass: 'partition_generation_arguments_incomplete',
      missingArguments: [
        ...(!manifestPath ? ['--partition-manifest'] : []),
        ...(!partitionId ? ['--partition-id'] : []),
      ],
    });
  }
}

function generate(args) {
  assertPartitionGenerationArgsComplete(args);
  const {
    buildSlotData,
    defaultReceiptPaths,
    extractSourceObligations,
    resolveAuditProfile,
    resolveEntryScenario,
    runStandaloneDeterministicPreflight,
    safeWriteText,
    sha256File,
    validateEntryAuthority,
    writeCoverageReceipt,
    writeGenerationReceipt,
  } = loadWholeSourceDependencies();
  const entry = resolveEntryScenario(takeAll(args, '--entry'));
  if (entry.entryScenario !== 'standalone_goal_contract') {
    throw Object.assign(new Error('entry_route_mismatch'), {
      failureClass: 'entry_route_mismatch',
      entryScenario: entry.entryScenario,
      expectedEntryScenario: 'standalone_goal_contract',
    });
  }
  const sourcePath = take(args, '--source');
  const outPath = take(args, '--out');
  const entryAuthority = validateEntryAuthority({
    entryScenario: entry.entryScenario,
    sourceAuthority: sourcePath ? entry.sourceAuthority : null,
    requestedOutputs: outPath ? [path.basename(outPath)] : [],
  });
  if (entryAuthority.decision !== 'pass') {
    throw Object.assign(new Error(entryAuthority.failureClass), entryAuthority);
  }
  if (!fs.existsSync(sourcePath)) {
    throw Object.assign(new Error(`source plan missing: ${sourcePath}`), {
      failureClass: 'source_plan_missing',
    });
  }

  const resolvedOut = path.resolve(outPath);
  const receipts = defaultReceiptPaths(resolvedOut);
  const coverageReceiptPath = path.resolve(
    take(args, '--coverage-receipt', receipts.coverageReceiptPath)
  );
  const generationReceiptPath = path.resolve(
    take(args, '--generation-receipt', receipts.generationReceiptPath)
  );
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const source = extractSourceObligations({ sourcePath: normalize(sourcePath), sourceText });
  const profilePath = firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
  ]);
  const templatePath = firstExistingPath([
    path.join(
      SOURCE_ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-execution-contract-template.md'
    ),
    path.join(
      PACKAGE_ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-execution-contract-template.md'
    ),
  ]);
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const templateText = fs.readFileSync(templatePath, 'utf8');
  const { slotData, registries, implementationProofAudit } = buildSlotData({
    source,
    profile,
    outPath: normalize(resolvedOut),
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
  });
  const { renderGoalContract } = loadRenderer();
  const rendered = renderGoalContract({
    templateText,
    profile,
    slotData,
    validateHashes: true,
    coverageReceipt: {
      sourcePlanHash: source.sourcePlanHash,
      sourceObligations: registries.sourceObligations,
      unmappedSourceObligations: [],
    },
    generationMode: 'source_plan_strict',
  });
  const { auditCommandPortability } = loadCommandPortabilityChecker();
  const preflightStartedAt = new Date().toISOString();
  const commandPortabilityAudit = auditCommandPortability({
    content: rendered.document,
    targetPath: resolvedOut,
    shell: 'pwsh',
  });
  const deterministicPreflight = runStandaloneDeterministicPreflight({
    checks: [
      {
        id: 'renderer_structure',
        run: () => {
          const issues = rendererIssues(rendered.audit);
          return {
            decision: issues.length === 0 ? 'pass' : 'block',
            issues,
          };
        },
      },
      {
        id: 'source_coverage',
        run: () => ({
          decision:
            rendered.audit.coverageDecision === 'pass' &&
            implementationProofAudit.decision === 'pass'
              ? 'pass'
              : 'block',
          issues: [],
        }),
      },
      {
        id: 'command_portability',
        run: () => ({
          decision: commandPortabilityAudit.status === 'PASS' ? 'pass' : 'block',
          issues: (commandPortabilityAudit.issues || []).map((item) => ({
            code: item.code || 'command_not_portable',
            location: item.location || item.line || item.command || normalize(resolvedOut),
          })),
        }),
      },
    ],
    startedAt: preflightStartedAt,
    completedAt: new Date().toISOString(),
  });
  const auditMetrics = {
    schemaVersion: 'standalone-audit-metrics/v1',
    sequence: ['deterministic_preflight'],
    deterministicCheckCount: deterministicPreflight.checkCount,
    deterministicIssueCount: deterministicPreflight.issueCount,
    auditEpochOpened: false,
    persistedTransientViews: 0,
  };
  const auditProfile = resolveAuditProfile(entry.entryScenario);
  if (deterministicPreflight.decision !== 'pass') {
    throw Object.assign(
      new Error(
        `goal-contract deterministic preflight failed with ${deterministicPreflight.issueCount} issue(s)`
      ),
      {
        failureClass:
          commandPortabilityAudit.status === 'PASS'
            ? 'deterministic_preflight_failed'
            : 'command_portability_failed',
        commandPortabilityAudit,
        deterministicPreflight,
        auditMetrics,
      }
    );
  }
  const writeReceipt = safeWriteText(resolvedOut, rendered.document, {
    mode: fs.existsSync(resolvedOut) ? 'replace' : 'create',
  });
  const goalContractHash = sha256File(resolvedOut);
  const coverageReceipt = {
    schemaVersion: 'goal-contract-source-coverage-receipt/v1',
    entryScenario: entry.entryScenario,
    sourcePlanPath: source.sourcePlanPath,
    sourcePlanHash: source.sourcePlanHash,
    sourceBytes: source.sourceBytes,
    sourceLines: source.sourceLines,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    sourceObligations: registries.sourceObligations,
    unmappedSourceObligations: [],
    orphanGeneratedRefs: [],
    blockingReasons: [],
    decision: 'pass',
  };
  writeCoverageReceipt(coverageReceiptPath, coverageReceipt);
  const generationReceipt = {
    ok: true,
    schemaVersion: 'goal-contract-generation-receipt/v1',
    entryScenario: entry.entryScenario,
    sourcePlanPath: source.sourcePlanPath,
    sourcePlanHash: source.sourcePlanHash,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
    sourceObligationCount: registries.sourceObligations.length,
    unmappedSourceObligations: 0,
    rendererAudit: rendered.audit,
    coverageAudit: { decision: 'pass', unmappedSourceObligations: [] },
    implementationProofAudit,
    commandPortabilityAudit,
    deterministicPreflight,
    auditMetrics,
    auditProfile,
    writeReceipt,
  };
  writeGenerationReceipt(generationReceiptPath, generationReceipt);
  return generationReceipt;
}

function assertNoForbiddenPartitionAuthorityArgs(args) {
  const forbiddenPolicyFlags = [
    '--partition-policy-hash',
    '--policy-hash',
    '--partition-policy-bytes',
    '--partition-policy-json',
  ];
  const forbiddenPolicy = forbiddenPolicyFlags.filter((flag) =>
    args.some((arg) => arg === flag || arg.startsWith(`${flag}=`))
  );
  if (forbiddenPolicy.length > 0) {
    throw Object.assign(new Error('partition_policy_authority_override_forbidden'), {
      failureClass: 'partition_policy_authority_override_forbidden',
      forbidden: forbiddenPolicy,
    });
  }
  const forbiddenFlags = [
    '--partition-count',
    '--task',
    '--selected-candidate',
    '--decision',
    '--selection-receipt',
  ];
  const forbidden = forbiddenFlags.filter((flag) =>
    args.some((arg) => arg === flag || arg.startsWith(`${flag}=`))
  );
  if (forbidden.length > 0) {
    throw Object.assign(new Error('partition_authority_argument_forbidden'), {
      failureClass: 'partition_authority_argument_forbidden',
      forbidden,
    });
  }
}

function requireExistingSource(args) {
  const sourcePath = take(args, '--source');
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw Object.assign(new Error(`source plan missing: ${sourcePath || ''}`), {
      failureClass: 'source_plan_missing',
    });
  }
  return path.resolve(sourcePath);
}

function partitionFailure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...extra,
  });
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function commandLiteral(obligation) {
  const text = String(obligation.exactText || obligation.text || '');
  const fenced = /`([^`\r\n]+)`/u.exec(text);
  return fenced?.[1] || text.replace(/^[-*]\s+\[[ xX]\]\s*[^:]+:\s*/u, '').trim();
}

function sourceAuthorizedPaths({ snapshot, extracted, repositoryFacts }) {
  const factPaths = (repositoryFacts.facts || []).map((fact) => fact.filePath).filter(Boolean);
  const declaredPaths = extracted.sourceObligations.flatMap((obligation) =>
    [...String(obligation.exactText || '').matchAll(/`([^`]+[\\/][^`]+)`/gu)]
      .map((match) => match[1])
      .filter((candidate) => !/\s/u.test(candidate))
  );
  return uniqueStrings([...factPaths, ...declaredPaths, snapshot.sourcePath]);
}

function assertValidDerivedView(view, validate) {
  const validation = validate(view);
  if (validation.decision !== 'pass') {
    throw partitionFailure(validation.failureClass, validation);
  }
  return validation;
}

function deriveStructuredViews({ snapshot, extracted, repositoryFacts, validators }) {
  const applicable = extracted.sourceObligations.filter(
    (obligation) => obligation.applicabilityState === 'applicable'
  );
  const sourceIds = uniqueStrings(applicable.map((obligation) => obligation.id));
  const declaredTasks = applicable.filter(
    (obligation) => obligation.kind === 'declared_execution_task'
  );
  const declaredAcceptance = applicable.filter(
    (obligation) => obligation.kind === 'acceptance_condition'
  );
  const declaredCommands = applicable.filter(
    (obligation) => obligation.kind === 'verification_command'
  );
  const declaredEvidence = applicable.filter(
    (obligation) => obligation.kind === 'evidence_contract'
  );
  const taskIds = new Set(declaredTasks.map((obligation) => obligation.id));
  const tasks = declaredTasks.map((obligation, index) => ({
    id: obligation.id,
    title: String(obligation.exactText || obligation.text || obligation.id),
    sourceIds: index === 0 ? sourceIds : [obligation.id],
    dependencies: uniqueStrings(
      (obligation.dependencyRefs || []).filter((dependencyId) => taskIds.has(dependencyId))
    ),
    atomicGroupRefs: uniqueStrings(obligation.atomicGroupRefs || []),
  }));
  const commandRecords = declaredCommands.map((obligation) => ({
    id: obligation.id,
    literal: commandLiteral(obligation),
    expectedExitBehavior: 'exits with the declared expected status',
    productionEntryPoint: 'goalContractCommand',
    evidenceType: 'behavior',
    provenanceFields: ['argv', 'cwd', 'exitCode'],
    freshnessRule: 'current source roots',
  }));
  const commandIds = commandRecords.map((command) => command.id);
  const acceptanceIds = declaredAcceptance.map((obligation) => obligation.id);
  const evidenceIds = declaredEvidence.map((obligation) => obligation.id);
  const allowedPaths = sourceAuthorizedPaths({
    snapshot,
    extracted,
    repositoryFacts,
  });
  const traceSlices = tasks.map((task, index) => ({
    id: `TRACE-${task.id}`,
    goalIds: [task.id],
    sourceIds: task.sourceIds,
    acceptanceIds: index === 0 ? acceptanceIds : [],
    evidenceIds: index === 0 ? evidenceIds : [],
    productionSymbols: ['goalContractCommand'],
    allowedPaths,
    directCommands: commandIds,
    impactedCommands: commandIds,
    integrationCommands: commandIds,
    regressionCommands: commandIds,
    dependencies: task.dependencies,
    commitPolicy: 'exactly_one_atomic_commit',
    closeCondition: `The observable outcome for ${task.id} is verified.`,
    stopConditionIds: index === 0 ? ['STOP-STRUCTURED-001'] : [],
  }));
  const primaryTask = tasks[0];
  const primaryTrace = traceSlices[0];
  const acceptanceItems = declaredAcceptance.map((obligation, index) => ({
    id: obligation.id,
    statement: String(obligation.exactText || obligation.text || obligation.id),
    sourceIds: index === 0 ? sourceIds : [obligation.id],
    goalIds: [primaryTask.id],
    traceIds: [primaryTrace.id],
    requiredCommands: commandIds,
    expectedEvidenceIds: evidenceIds,
    requiredEvidenceStrength: 'behavior',
    passCondition: String(obligation.exactText || obligation.text || obligation.id),
  }));
  const expectedEvidence = declaredEvidence.map((obligation) => ({
    id: obligation.id,
    sourceIds: [obligation.id],
    producer: commandIds[0],
    admissibleTypes: ['behavior'],
    requiredProvenanceFields: ['argv', 'cwd', 'exitCode'],
    freshnessRule: 'current source roots',
    expectedResult: String(obligation.exactText || obligation.text || obligation.id),
  }));
  const implementationView = {
    tasks,
    traceSlices,
    productionSymbols: ['goalContractCommand'],
    allowedPaths,
    commands: Object.fromEntries(
      ['direct', 'impacted', 'integration', 'regression'].map((kind) => [
        kind,
        commandRecords.map((command) => ({ ...command })),
      ])
    ),
    dependencies: tasks.flatMap((task) =>
      task.dependencies.map((dependencyId) => ({
        from: task.id,
        to: dependencyId,
      }))
    ),
    commitPolicy: 'exactly_one_atomic_commit',
    closeConditions: ['Every typed source obligation has observable closure.'],
    synchronizationObligations: ['source-snapshot', 'evidence-graph'],
    commandEvidenceStrength: Object.fromEntries(
      commandIds.map((commandId) => [commandId, 'behavior'])
    ),
  };
  const acceptanceEvidenceView = {
    acceptanceItems,
    negativeControls: ['Missing or stale evidence fails closed.'],
    productionEntryPoints: ['goalContractCommand'],
    manualScenarios: [
      {
        id: 'MV-STRUCTURED-001',
        title: 'Invoke the public partition command.',
        steps: ['Run the production command with the current source snapshot.'],
        commandIds,
        evidenceIds,
        productionEntryPoints: ['goalContractCommand'],
        expectedResult: 'The command reaches the next unimplemented boundary.',
      },
    ],
    expectedEvidence,
    antiCheatRules: ['Caller-authored partition authority cannot replace derived semantics.'],
    stopConditions: [
      {
        id: 'STOP-STRUCTURED-001',
        condition: 'A required semantic or evidence binding is unavailable.',
        failureClass: 'BLOCKED_ENVIRONMENT',
        sourceIds,
        traceIds: [primaryTrace.id],
      },
    ],
  };
  const implementationValidation = assertValidDerivedView(
    implementationView,
    validators.validateImplementationView
  );
  const acceptanceValidation = assertValidDerivedView(
    acceptanceEvidenceView,
    validators.validateAcceptanceEvidenceView
  );
  const receipt = (viewType, validation) =>
    Object.freeze({
      schemaVersion: 'goal-contract-structured-view-receipt/v1',
      viewType,
      inputHash: snapshot.aggregateHash,
      sourceSnapshotHash: snapshot.aggregateHash,
      sessionIdentity: `structured:${viewType}:${snapshot.aggregateHash}`,
      persistedViewAuthorityFiles: 0,
      validation,
    });
  return Object.freeze({
    mode: 'structured_fast_path',
    implementation: Object.freeze({
      view: Object.freeze(implementationView),
      validation: implementationValidation,
      receipt: receipt('implementation', implementationValidation),
    }),
    acceptanceEvidence: Object.freeze({
      view: Object.freeze(acceptanceEvidenceView),
      validation: acceptanceValidation,
      receipt: receipt('acceptance_evidence', acceptanceValidation),
    }),
  });
}

async function deriveSemanticViews({
  snapshot,
  extracted,
  methodology,
  repositoryFacts,
  providerFactory,
  validators,
}) {
  const provider = providerFactory({
    packageRoot: PARTITION_ASSET_ROOT,
  });
  const request = Object.freeze({
    sourceSnapshot: snapshot,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligationGraph: extracted.sourceObligationGraph,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfile: methodology.semantic,
    methodologyProfileHash: methodology.methodologyProfileHash,
    repositoryFacts,
    repositoryFactsHash: repositoryFacts.repositoryFactsHash,
  });
  const [implementation, acceptanceEvidence] = await Promise.all([
    provider.deriveImplementationView(request),
    provider.deriveAcceptanceEvidenceView(request),
  ]);
  const implementationValidation = assertValidDerivedView(
    implementation.view,
    validators.validateImplementationView
  );
  const acceptanceValidation = assertValidDerivedView(
    acceptanceEvidence.view,
    validators.validateAcceptanceEvidenceView
  );
  return Object.freeze({
    mode: 'semantic_completion',
    implementation: Object.freeze({
      ...implementation,
      validation: implementationValidation,
      receipt: Object.freeze({
        ...implementation.receipt,
        persistedViewAuthorityFiles: 0,
      }),
    }),
    acceptanceEvidence: Object.freeze({
      ...acceptanceEvidence,
      validation: acceptanceValidation,
      receipt: Object.freeze({
        ...acceptanceEvidence.receipt,
        persistedViewAuthorityFiles: 0,
      }),
    }),
  });
}

function currentRepositoryTreeHash() {
  try {
    const index = execFileSync('git', ['ls-files', '-s'], {
      cwd: SOURCE_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return sha256Text(index.replace(/\r\n/gu, '\n'));
  } catch (error) {
    throw partitionFailure('partition_repository_facts_stale', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildApplicabilityInput({ snapshot, graph, methodology }) {
  const sourceText = snapshot.segments
    .map((segment) => segment.content)
    .join('\n')
    .toLowerCase();
  const unresolved = /sequence applicability is unresolved\./u.test(sourceText);
  const signalPatterns = {
    crossParticipantInteraction: /\bcross[- ]participant\b|\bmultiple participants?\b/u,
    interfaceBoundary: /\binterface (?:boundary|contract)\b/u,
    observableOrdering: /\bobservable order(?:ing)?\b/u,
    stateTransition: /\bstate transition\b/u,
    branchCoverage: /\bbranch (?:coverage|constraint)\b/u,
    boundedRetry: /\bbounded retry\b/u,
    compensation: /\bcompensation constraint\b|\bcompensating action\b/u,
    temporalConstraint: /\btemporal constraint\b|\btime ordering\b/u,
    integrationFanIn: /\bintegration fan[- ]in\b|\bintegration join\b/u,
  };
  const architectureFacts: Record<string, boolean | string[]> = unresolved
    ? {}
    : (Object.fromEntries(
        Object.entries(signalPatterns).map(([signal, pattern]) => [
          signal,
          pattern.test(sourceText),
        ])
      ) as Record<string, boolean | string[]>);
  if (!unresolved) {
    architectureFacts.evidenceRefs = uniqueStrings(
      (graph.nodes || []).filter((node) => node.nodeType === 'source').map((node) => node.id)
    );
  }
  return {
    sourceSnapshotHash: snapshot.aggregateHash,
    semanticModelHash: graph.semanticModelHash,
    traceGraphHash: graph.traceGraphHash,
    architectureFacts,
    policyVersion: methodology.profile.profileVersion,
  };
}

function assertSequencePacketHashes(packet) {
  const staleFields = [];
  if (packet?.schemaVersion !== 'goal-contract-sequence-constraint-input/v1') {
    staleFields.push('schemaVersion');
  }
  for (const [valueField, hashField] of [
    ['sequenceContract', 'sequenceContractHash'],
    ['interfaceContractSet', 'interfaceContractSetHash'],
    ['sequenceClosureBundle', 'sequenceClosureBundleHash'],
  ]) {
    if (
      !packet?.[valueField] ||
      packet[hashField] !== sha256Text(stableStringify(packet[valueField]))
    ) {
      staleFields.push(hashField);
    }
  }
  if (staleFields.length > 0) {
    throw partitionFailure('sequence_constraint_hash_mismatch', {
      staleFields,
    });
  }
}

function resolveSequenceConstraintBranch({ applicability, args, validateSequenceConstraintInput }) {
  const constraintPath = take(args, '--sequence-constraints', null);
  let sequenceConstraintInput = null;
  const producerAvailable = Boolean(constraintPath && fs.existsSync(path.resolve(constraintPath)));
  if (producerAvailable) {
    try {
      sequenceConstraintInput = JSON.parse(fs.readFileSync(path.resolve(constraintPath), 'utf8'));
    } catch {
      throw partitionFailure('sequence_constraint_hash_mismatch', {
        staleFields: ['packet'],
      });
    }
    assertSequencePacketHashes(sequenceConstraintInput);
  }
  return validateSequenceConstraintInput({
    applicabilityReceipt: applicability,
    producerAvailable,
    sequenceConstraintInput,
    currentSourceSnapshotHash: applicability.sourceSnapshotHash,
    currentSemanticModelHash: applicability.semanticModelHash,
    currentTraceGraphHash: applicability.traceGraphHash,
    currentPolicyVersion: applicability.policyVersion,
  });
}

async function partition(args): Promise<never> {
  assertNoForbiddenPartitionAuthorityArgs(args);
  const {
    assertNoForbiddenPartitionAuthorityArgs: assertNoForbiddenSemanticAuthorityArgs,
    createGoalContractSemanticProvider,
  } = loadPartitionModule('utils/goal-contract/semantic-provider-registry');
  assertNoForbiddenSemanticAuthorityArgs(args);
  const { resolveEntryScenario } = loadPartitionModule('utils/goal-contract/entry-scenarios');
  const entry = resolveEntryScenario(takeAll(args, '--entry'));
  if (entry.entryScenario !== 'standalone_goal_contract') {
    throw Object.assign(new Error('entry_route_mismatch'), {
      failureClass: 'entry_route_mismatch',
      entryScenario: entry.entryScenario,
      expectedEntryScenario: 'standalone_goal_contract',
    });
  }
  const sourcePath = requireExistingSource(args);
  const rawBytes = fs.readFileSync(sourcePath);
  const { buildSourceSnapshot } = loadPartitionModule('utils/goal-contract/dual-view-derivation');
  const {
    buildCanonicalSemanticModel,
    selectSemanticDerivationMode,
    validateAcceptanceEvidenceView,
    validateImplementationView,
  } = loadPartitionModule('utils/goal-contract/dual-view-derivation');
  const { loadPartitionMethodologyProfile } = loadPartitionModule(
    'utils/goal-contract/partition-methodology-profile'
  );
  const { extractSourceObligations } = loadPartitionModule(
    'utils/goal-contract/source-obligation-extractor'
  );
  const { assertCurrentPartitionPolicyBinding, loadPartitionPolicy } = loadPartitionModule(
    'utils/goal-contract/partition-policy'
  );
  const { buildPartitionComponents } = loadPartitionModule(
    'utils/goal-contract/partition-components'
  );
  const { optimizePartitions } = loadPartitionModule(
    'utils/goal-contract/partition-optimizer'
  );
  const { compilePartitionManifest, stagePartitionSolution } = loadPartitionModule(
    'utils/goal-contract/partition-manifest'
  );
  const { loadRepositoryFacts } = loadPartitionModule('utils/goal-contract/repository-facts');
  const { reconcileGoalContractViews } = loadPartitionModule(
    'utils/goal-contract/view-reconciliation'
  );
  const { buildEvidenceGraph } = loadPartitionModule('utils/goal-contract/evidence-graph');
  const { decideSequenceApplicability, validateSequenceConstraintInput } = loadPartitionModule(
    'utils/goal-contract/sequence-applicability'
  );
  const { compileExecutionProjection } = loadPartitionModule(
    'utils/goal-contract/execution-projection'
  );
  const snapshot = buildSourceSnapshot({
    sourceType: 'source_plan',
    sourcePath: normalize(sourcePath),
    rawBytes,
  });
  const methodology = loadPartitionMethodologyProfile({
    packageRoot: PARTITION_ASSET_ROOT,
  });
  const policyBinding = loadPartitionPolicy({
    packageRoot: PARTITION_ASSET_ROOT,
    policyPath: take(args, '--policy', null),
  });
  const extracted = extractSourceObligations({ snapshot });
  const repositoryFactsPath = take(args, '--repository-facts', null);
  const repositoryFacts = loadRepositoryFacts({
    factsPath: repositoryFactsPath,
    expectedRepositoryTreeHash: repositoryFactsPath
      ? currentRepositoryTreeHash()
      : sha256Text('repository-facts:not-provided'),
    allowlistedAnalyzers: ['repository-analyzer@1.0.0'],
  });
  const derivationMode = selectSemanticDerivationMode({
    sourceSnapshot: snapshot,
    sourceObligations: extracted.sourceObligations,
    semanticDerivationAllowed: policyBinding.policy.semanticDerivationAllowance,
  });
  const validators = {
    validateAcceptanceEvidenceView,
    validateImplementationView,
  };
  const derivation =
    derivationMode.mode === 'structured_fast_path'
      ? deriveStructuredViews({
          snapshot,
          extracted,
          repositoryFacts,
          validators,
        })
      : await deriveSemanticViews({
          snapshot,
          extracted,
          methodology,
          repositoryFacts,
          providerFactory: createGoalContractSemanticProvider,
          validators,
        });
  const semantic = buildCanonicalSemanticModel({
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    derivation,
  });
  const reconciliation = reconcileGoalContractViews({
    sourceSnapshot: snapshot,
    sourceObligationGraph: extracted.sourceObligationGraph,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    semanticModelHash: semantic.semanticModelHash,
    derivation,
  });
  const graph = buildEvidenceGraph(reconciliation);
  const applicability = decideSequenceApplicability(
    buildApplicabilityInput({ snapshot, graph, methodology })
  );
  const boundaryContext = {
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    partitionPolicyHash: policyBinding.partitionPolicyHash,
    partitionPolicyArtifactHash: policyBinding.partitionPolicyArtifactHash,
    policyPath: policyBinding.policyPath,
    policyBytes: policyBinding.policyBytes,
    semanticDerivationAllowance: policyBinding.policy.semanticDerivationAllowance,
    semanticModelHash: semantic.semanticModelHash,
    traceGraphHash: graph.traceGraphHash,
    semanticDerivationMode: derivationMode.mode,
    semanticProviderCallCount: derivationMode.semanticProviderCallCount,
    sequenceApplicability: applicability.decision,
    sequenceApplicabilityReceipt: applicability,
  };
  let sequenceConstraintInput;
  try {
    sequenceConstraintInput = resolveSequenceConstraintBranch({
      applicability,
      args,
      validateSequenceConstraintInput,
    });
  } catch (error) {
    Object.assign(error, boundaryContext);
    throw error;
  }
  let projection;
  const projectionAuthority = {
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    semanticModelHash: semantic.semanticModelHash,
    traceGraphHash: graph.traceGraphHash,
    reconciledGraph: reconciliation.graphInput,
    reconciledGraphHash: reconciliation.graphInputHash,
    sequenceApplicabilityReceipt: applicability,
    sequenceConstraintInput,
  };
  try {
    projection = compileExecutionProjection(projectionAuthority);
  } catch (error) {
    Object.assign(error, boundaryContext);
    throw error;
  }
  let optimizerPolicyBinding;
  try {
    optimizerPolicyBinding = assertCurrentPartitionPolicyBinding({
      policyBinding,
      sourceSnapshotHash: snapshot.aggregateHash,
      semanticModelHash: semantic.semanticModelHash,
      executionProjectionHash: projection.executionProjectionHash,
    });
  } catch (error) {
    Object.assign(error, boundaryContext, {
      executionProjectionHash: projection.executionProjectionHash,
      taskDagHash: projection.taskDagHash,
      integrationJoinGraphHash: projection.integrationJoinGraphHash,
    });
    throw error;
  }
  const componentGraph = buildPartitionComponents({
    executionProjection: projection,
    policy: optimizerPolicyBinding.policy,
  });
  const optimization = optimizePartitions({
    componentGraph,
    executionProjection: projection,
    policyBinding: optimizerPolicyBinding,
    projectionAuthority,
  });
  const compiled = compilePartitionManifest({
    sourceSnapshot: snapshot,
    sourceObligationGraph: extracted.sourceObligationGraph,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    reconciledGraph: reconciliation.graphInput,
    reconciledGraphHash: reconciliation.graphInputHash,
    reconciliationReceiptHash: sha256Text(
      stableStringify({
        graphInputHash: reconciliation.graphInputHash,
        issues: reconciliation.issues,
        metrics: reconciliation.metrics,
        outputInventory: reconciliation.outputInventory,
      })
    ),
    executionProjection: projection,
    projectionAuthority,
    policyBinding: optimizerPolicyBinding,
    semanticDerivationMode: derivationMode.mode,
    implementationViewReceipt: derivation.implementation.receipt,
    acceptanceEvidenceViewReceipt: derivation.acceptanceEvidence.receipt,
    componentGraph,
    optimization,
  });
  const requestedOut = take(args, '--out');
  if (!requestedOut) {
    throw partitionFailure('partition_output_missing');
  }
  const receiptsDir = take(
    args,
    '--receipts-dir',
    path.join(path.dirname(path.resolve(requestedOut)), '.goal-contract-receipts')
  );
  const staged = stagePartitionSolution({
    compiled,
    receiptsDir,
    activeManifestPath: requestedOut,
  });
  throw partitionFailure('partition_selection_not_implemented', {
    ...boundaryContext,
    partitionPolicyHash: optimizerPolicyBinding.partitionPolicyHash,
    partitionPolicyArtifactHash: optimizerPolicyBinding.partitionPolicyArtifactHash,
    policyPath: optimizerPolicyBinding.policyPath,
    policyBytes: optimizerPolicyBinding.policyBytes,
    executionProjectionHash: projection.executionProjectionHash,
    taskDagHash: projection.taskDagHash,
    integrationJoinGraphHash: projection.integrationJoinGraphHash,
    partitionRunId: staged.partitionRunId,
    partitionAnalysisReceiptPath: staged.analysisReceiptPath,
    partitionAnalysisReceiptHash: staged.analysisReceiptHash,
    stagedManifestPath: staged.manifestPath,
    partitionManifestHash: staged.partitionManifestHash,
    partitionCount: staged.manifest.partitionCount,
    selectedCandidateId: optimization.selectedCandidateId,
    activeManifestWritten: false,
  });
}

async function goalContractCommand(_opts: { json?: boolean } = {}, forwardedArgs: string[] = []) {
  const args = [...forwardedArgs];
  const subcommand = args.shift();
  const json = has(args, '--json') || _opts.json;
  try {
    if (subcommand === 'release-gate') {
      const { goalContractReleaseGateCommand } = loadDistModule('utils/goal-contract/release-gate');
      return await goalContractReleaseGateCommand(_opts, args);
    }
    if (!['generate', 'partition'].includes(subcommand)) {
      throw Object.assign(
        new Error(
          'Usage: bmad-speckit goal-contract <generate|partition> --entry standalone_goal_contract --source <plan.md> --out <artifact> --json'
        ),
        {
          failureClass: 'invalid_subcommand',
        }
      );
    }
    const result = subcommand === 'partition' ? await partition(args) : generate(args);
    if (json) emitJson(result);
    else if (result?.goalContractPath) {
      process.stdout.write(`${result.goalContractPath}\n`);
    }
    return 0;
  } catch (error) {
    const failureClass = error.failureClass || error.code || 'goal_contract_generation_failed';
    const payload = failurePayload(failureClass, error, {
      ...(error.entryScenario ? { entryScenario: error.entryScenario } : {}),
      ...(error.expectedEntryScenario
        ? { expectedEntryScenario: error.expectedEntryScenario }
        : {}),
      ...(error.requestedOutputs ? { requestedOutputs: error.requestedOutputs } : {}),
      ...(error.requiredOutputs ? { requiredOutputs: error.requiredOutputs } : {}),
      ...(error.coverageAudit ? { coverageAudit: error.coverageAudit } : {}),
      ...(error.implementationProofAudit
        ? { implementationProofAudit: error.implementationProofAudit }
        : {}),
      ...(error.commandPortabilityAudit
        ? { commandPortabilityAudit: error.commandPortabilityAudit }
        : {}),
      ...(error.deterministicPreflight
        ? { deterministicPreflight: error.deterministicPreflight }
        : {}),
      ...(error.auditMetrics ? { auditMetrics: error.auditMetrics } : {}),
      ...(error.forbidden ? { forbidden: error.forbidden } : {}),
      ...(error.missingArguments ? { missingArguments: error.missingArguments } : {}),
      ...(error.sourceSnapshotHash ? { sourceSnapshotHash: error.sourceSnapshotHash } : {}),
      ...(error.sourceObligationGraphHash
        ? {
            sourceObligationGraphHash: error.sourceObligationGraphHash,
          }
        : {}),
      ...(error.methodologyProfileHash
        ? { methodologyProfileHash: error.methodologyProfileHash }
        : {}),
      ...(error.partitionPolicyHash ? { partitionPolicyHash: error.partitionPolicyHash } : {}),
      ...(error.partitionPolicyArtifactHash
        ? {
            partitionPolicyArtifactHash: error.partitionPolicyArtifactHash,
          }
        : {}),
      ...(error.policyPath ? { policyPath: error.policyPath } : {}),
      ...(Number.isInteger(error.policyBytes) ? { policyBytes: error.policyBytes } : {}),
      ...(typeof error.semanticDerivationAllowance === 'boolean'
        ? {
            semanticDerivationAllowance: error.semanticDerivationAllowance,
          }
        : {}),
      ...(error.semanticModelHash ? { semanticModelHash: error.semanticModelHash } : {}),
      ...(error.traceGraphHash ? { traceGraphHash: error.traceGraphHash } : {}),
      ...(error.semanticDerivationMode
        ? {
            semanticDerivationMode: error.semanticDerivationMode,
          }
        : {}),
      ...(Number.isInteger(error.semanticProviderCallCount)
        ? {
            semanticProviderCallCount: error.semanticProviderCallCount,
          }
        : {}),
      ...(error.sequenceApplicability
        ? {
            sequenceApplicability: error.sequenceApplicability,
          }
        : {}),
      ...(error.sequenceApplicabilityReceipt
        ? {
            sequenceApplicabilityReceipt: error.sequenceApplicabilityReceipt,
          }
        : {}),
      ...(error.executionProjectionHash
        ? {
            executionProjectionHash: error.executionProjectionHash,
          }
        : {}),
      ...(error.taskDagHash ? { taskDagHash: error.taskDagHash } : {}),
      ...(error.integrationJoinGraphHash
        ? {
            integrationJoinGraphHash: error.integrationJoinGraphHash,
          }
        : {}),
      ...(error.partitionRunId ? { partitionRunId: error.partitionRunId } : {}),
      ...(error.partitionAnalysisReceiptPath
        ? {
            partitionAnalysisReceiptPath: error.partitionAnalysisReceiptPath,
          }
        : {}),
      ...(error.partitionAnalysisReceiptHash
        ? {
            partitionAnalysisReceiptHash: error.partitionAnalysisReceiptHash,
          }
        : {}),
      ...(error.stagedManifestPath
        ? { stagedManifestPath: error.stagedManifestPath }
        : {}),
      ...(error.partitionManifestHash
        ? { partitionManifestHash: error.partitionManifestHash }
        : {}),
      ...(Number.isInteger(error.partitionCount)
        ? { partitionCount: error.partitionCount }
        : {}),
      ...(error.selectedCandidateId
        ? { selectedCandidateId: error.selectedCandidateId }
        : {}),
      ...(typeof error.activeManifestWritten === 'boolean'
        ? { activeManifestWritten: error.activeManifestWritten }
        : {}),
      ...(error.staleFields ? { staleFields: error.staleFields } : {}),
      ...(error.mismatchedFields
        ? { mismatchedFields: error.mismatchedFields }
        : {}),
      ...(error.invalidFields ? { invalidFields: error.invalidFields } : {}),
      ...(error.expected ? { expected: error.expected } : {}),
      ...(error.actual ? { actual: error.actual } : {}),
    });
    if (json) emitJson(payload);
    else console.error(payload.message);
    return 1;
  }
}

module.exports = {
  generate,
  goalContractCommand,
  partition,
};
