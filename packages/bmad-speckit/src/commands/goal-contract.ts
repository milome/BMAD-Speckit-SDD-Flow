const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

export type GoalContractCommandModule = never;

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PARTITION_ASSET_ROOT = __filename.endsWith('.ts')
  ? SOURCE_ROOT
  : PACKAGE_ROOT;

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
  const { safeWriteText, sha256File } = loadDistModule(
    'utils/large-document-writer'
  );
  const { extractSourceObligations } = loadDistModule(
    'utils/goal-contract/source-obligation-extractor'
  );
  const { buildSlotData } = loadDistModule(
    'utils/goal-contract/slot-data-builder'
  );
  const {
    resolveEntryScenario,
    validateEntryAuthority,
  } = loadDistModule('utils/goal-contract/entry-scenarios');
  const {
    defaultReceiptPaths,
    writeCoverageReceipt,
    writeGenerationReceipt,
  } = loadDistModule('utils/goal-contract/goal-contract-receipts');
  const {
    resolveAuditProfile,
    runStandaloneDeterministicPreflight,
  } = loadDistModule('utils/goal-contract/standalone-audit-controller');
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
  return require(firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'scripts', 'render-goal-contract.js'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'scripts', 'render-goal-contract.js'),
  ]));
}

function loadCommandPortabilityChecker() {
  return require(firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'scripts', 'check-contract-command-portability.js'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'scripts', 'check-contract-command-portability.js'),
  ]));
}

function failurePayload(failureClass, error, extra = {}) {
  const payload = {
    ok: false,
    schemaVersion: 'goal-contract-generation-receipt/v1',
    failureClass,
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  };
  for (const field of ['sourceId', 'lineStart', 'lineEnd', 'matchedPhrase', 'sourceExcerpt', 'repairHint']) {
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
  if (
    manifestFlag !== partitionIdFlag ||
    (manifestFlag && (!manifestPath || !partitionId))
  ) {
    throw Object.assign(
      new Error('partition_generation_arguments_incomplete'),
      {
        failureClass: 'partition_generation_arguments_incomplete',
        missingArguments: [
          ...(!manifestPath ? ['--partition-manifest'] : []),
          ...(!partitionId ? ['--partition-id'] : []),
        ],
      }
    );
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
    throw Object.assign(new Error(`source plan missing: ${sourcePath}`), { failureClass: 'source_plan_missing' });
  }

  const resolvedOut = path.resolve(outPath);
  const receipts = defaultReceiptPaths(resolvedOut);
  const coverageReceiptPath = path.resolve(take(args, '--coverage-receipt', receipts.coverageReceiptPath));
  const generationReceiptPath = path.resolve(take(args, '--generation-receipt', receipts.generationReceiptPath));
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const source = extractSourceObligations({ sourcePath: normalize(sourcePath), sourceText });
  const profilePath = firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
  ]);
  const templatePath = firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-execution-contract-template.md'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-execution-contract-template.md'),
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
          decision:
            commandPortabilityAudit.status === 'PASS' ? 'pass' : 'block',
          issues: (commandPortabilityAudit.issues || []).map((item) => ({
            code: item.code || 'command_not_portable',
            location:
              item.location ||
              item.line ||
              item.command ||
              normalize(resolvedOut),
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
  const writeReceipt = safeWriteText(resolvedOut, rendered.document, { mode: fs.existsSync(resolvedOut) ? 'replace' : 'create' });
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
  const forbiddenFlags = [
    '--partition-count',
    '--task',
    '--selected-candidate',
    '--decision',
    '--selection-receipt',
    '--partition-policy-hash',
    '--policy-hash',
  ];
  const forbidden = forbiddenFlags.filter((flag) =>
    args.some((arg) => arg === flag || arg.startsWith(`${flag}=`))
  );
  if (forbidden.length > 0) {
    throw Object.assign(
      new Error('partition_authority_argument_forbidden'),
      {
        failureClass: 'partition_authority_argument_forbidden',
        forbidden,
      }
    );
  }
}

function requireExistingSource(args) {
  const sourcePath = take(args, '--source');
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw Object.assign(
      new Error(`source plan missing: ${sourcePath || ''}`),
      {
        failureClass: 'source_plan_missing',
      }
    );
  }
  return path.resolve(sourcePath);
}

function buildApplicabilityInput({ snapshot, obligations, methodology }) {
  const semanticModel = obligations.sourceObligations.map((obligation) => ({
    id: obligation.id,
    kind: obligation.kind,
    normativeStrength: obligation.normativeStrength,
    dependencyRefs: obligation.dependencyRefs,
    evidenceRefs: obligation.evidenceRefs,
  }));
  const traceGraph = {
    nodes: semanticModel.map(({ id, kind }) => ({ id, kind })),
    edges: semanticModel.flatMap((obligation) =>
      obligation.dependencyRefs.map((dependencyId) => ({
        from: obligation.id,
        to: dependencyId,
      }))
    ),
  };
  return {
    sourceSnapshotHash: snapshot.aggregateHash,
    semanticModelHash: sha256Text(stableStringify(semanticModel)),
    traceGraphHash: sha256Text(stableStringify(traceGraph)),
    architectureFacts: {},
    policyVersion: methodology.profile.profileVersion,
  };
}

function partition(args): never {
  assertNoForbiddenPartitionAuthorityArgs(args);
  const { resolveEntryScenario } = loadPartitionModule(
    'utils/goal-contract/entry-scenarios'
  );
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
  const { buildSourceSnapshot } = loadPartitionModule(
    'utils/goal-contract/dual-view-derivation'
  );
  const { loadPartitionMethodologyProfile } = loadPartitionModule(
    'utils/goal-contract/partition-methodology-profile'
  );
  const { extractSourceObligations } = loadPartitionModule(
    'utils/goal-contract/source-obligation-extractor'
  );
  const { loadPartitionPolicy } = loadPartitionModule(
    'utils/goal-contract/partition-policy'
  );
  const { decideSequenceApplicability } = loadPartitionModule(
    'utils/goal-contract/sequence-applicability'
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
  const obligations = extractSourceObligations({ snapshot });
  const applicability = decideSequenceApplicability(
    buildApplicabilityInput({ snapshot, obligations, methodology })
  );
  throw Object.assign(
    new Error('execution_projection_not_implemented'),
    {
      failureClass: 'execution_projection_not_implemented',
      sourceSnapshotHash: snapshot.aggregateHash,
      methodologyProfileHash: methodology.methodologyProfileHash,
      partitionPolicyHash: policyBinding.partitionPolicyHash,
      partitionPolicyArtifactHash:
        policyBinding.partitionPolicyArtifactHash,
      policyPath: policyBinding.policyPath,
      policyBytes: policyBinding.policyBytes,
      semanticDerivationAllowance:
        policyBinding.policy.semanticDerivationAllowance,
      sequenceApplicabilityReceipt: applicability,
    }
  );
}

function goalContractCommand(
  _opts: { json?: boolean } = {},
  forwardedArgs: string[] = []
) {
  const args = [...forwardedArgs];
  const subcommand = args.shift();
  const json = has(args, '--json') || _opts.json;
  try {
    if (subcommand === 'release-gate') {
      const { goalContractReleaseGateCommand } = loadDistModule(
        'utils/goal-contract/release-gate'
      );
      return goalContractReleaseGateCommand(_opts, args);
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
    const result = subcommand === 'partition' ? partition(args) : generate(args);
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
      ...(error.requestedOutputs
        ? { requestedOutputs: error.requestedOutputs }
        : {}),
      ...(error.requiredOutputs
        ? { requiredOutputs: error.requiredOutputs }
        : {}),
      ...(error.coverageAudit ? { coverageAudit: error.coverageAudit } : {}),
      ...(error.implementationProofAudit ? { implementationProofAudit: error.implementationProofAudit } : {}),
      ...(error.commandPortabilityAudit
        ? { commandPortabilityAudit: error.commandPortabilityAudit }
        : {}),
      ...(error.deterministicPreflight
        ? { deterministicPreflight: error.deterministicPreflight }
        : {}),
      ...(error.auditMetrics ? { auditMetrics: error.auditMetrics } : {}),
      ...(error.forbidden ? { forbidden: error.forbidden } : {}),
      ...(error.missingArguments
        ? { missingArguments: error.missingArguments }
        : {}),
      ...(error.sourceSnapshotHash
        ? { sourceSnapshotHash: error.sourceSnapshotHash }
        : {}),
      ...(error.methodologyProfileHash
        ? { methodologyProfileHash: error.methodologyProfileHash }
        : {}),
      ...(error.partitionPolicyHash
        ? { partitionPolicyHash: error.partitionPolicyHash }
        : {}),
      ...(error.partitionPolicyArtifactHash
        ? {
            partitionPolicyArtifactHash:
              error.partitionPolicyArtifactHash,
          }
        : {}),
      ...(error.policyPath ? { policyPath: error.policyPath } : {}),
      ...(Number.isInteger(error.policyBytes)
        ? { policyBytes: error.policyBytes }
        : {}),
      ...(typeof error.semanticDerivationAllowance === 'boolean'
        ? {
            semanticDerivationAllowance:
              error.semanticDerivationAllowance,
          }
        : {}),
      ...(error.sequenceApplicabilityReceipt
        ? {
            sequenceApplicabilityReceipt:
              error.sequenceApplicabilityReceipt,
          }
        : {}),
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
