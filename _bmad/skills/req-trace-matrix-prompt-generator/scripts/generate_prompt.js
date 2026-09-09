#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('./load-js-yaml');
const {
  requireBmadSpeckit,
  requireLargeDocumentWriter,
} = require('./resolve-bmad-runtime');
const {
  classifyConfirmationDrift,
  STALE_BOOKKEEPING_REPAIR_REQUIRED,
  PROJECTION_REFRESH_REQUIRED,
} = require('../../requirements-contract-authoring/scripts/confirmation_drift_classifier');

const { safeWriteJson, safeWriteText, stableStringify: serializeArtifactJson } = requireLargeDocumentWriter();
const { publishArtifactSet } = require('./publish-artifact-set');

const SKILL_LINE = '$executing-plans $verification-before-completion';
const COMMAND_PREFIXES = [
  'npm ',
  'npx ',
  'node ',
  'python ',
  'py ',
  'pnpm ',
  'yarn ',
  'rg ',
  'Get-ChildItem ',
  'pwsh ',
  'powershell ',
];
const GOAL_COMMAND_MAX_CHARS = 4000;
const GOAL_COMMAND_SAFE_MAX_CHARS = 3800;
const GOAL_DOCUMENT_FILENAME = 'goal_execution.md';
const GOAL_CONTRACT_PROFILE_PATH = '_bmad/shared/goal-contract/goal-contract-profile.json';
const FORBIDDEN_SEMANTIC_INPUT_KEYS = [
  'dualViewPayload',
  'implementationView',
  'acceptanceEvidenceView',
  'standaloneSource',
];
const CONTROLLED_EXECUTION_ARG_KEYS = [
  'requirementSetId',
  'transactionId',
  'implementationAttemptId',
  'architectureAuditAttemptId',
  'activePhaseAuditAttemptId',
  'contractHash',
  'inputSnapshotHash',
  'commandCwd',
  'commandReceiptRoot',
];
const SHA256_REF_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CONTRACT_MANIFEST_BUILDER_RELATIVE_PATH = path.join(
  'contract-execution-manifest',
  'build-contract-execution-manifest.js'
);

function requireContractExecutionManifestBuilder() {
  const candidates = [
    path.resolve(process.cwd(), '_bmad', 'shared', CONTRACT_MANIFEST_BUILDER_RELATIVE_PATH),
    path.resolve(__dirname, '..', 'references', CONTRACT_MANIFEST_BUILDER_RELATIVE_PATH),
    path.resolve(__dirname, '..', '..', '..', 'shared', CONTRACT_MANIFEST_BUILDER_RELATIVE_PATH),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `ContractExecutionManifest shared builder not found. Checked: ${candidates.join(', ')}`
    );
  }
  return require(found);
}

const { buildDerivedContractExecutionManifest } = requireContractExecutionManifestBuilder();

function requireVerifiedSixModelStatusFacade() {
  return requireBmadSpeckit(
    'dist/main-agent/source-authority/scripts/requirements-contract-runtime-status-authority-core.cjs'
  );
}

const { resolveVerifiedSixModelStatus } = requireVerifiedSixModelStatusFacade();

class BlockedInput extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.message = message;
  }
}

function parseArgs(argv) {
  const args = {
    finalGate: [],
    extraRule: [],
    autoCommit: false,
    noAutoCommit: false,
    json: false,
    executionHost: 'codex',
    promptLanguage: 'auto',
    humanPromptProfile: 'full',
    goalCommandAvailable: 'auto',
    packetId: null,
    taskReportPath: null,
    entry: null,
    entryExplicit: false,
    entryValues: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--auto-commit') {
      args.autoCommit = true;
      continue;
    }
    if (arg === '--no-auto-commit') {
      args.noAutoCommit = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    if (key === 'finalGate' || key === 'extraRule') {
      args[key].push(value);
    } else if (key === 'entry') {
      args.entryValues.push(value);
      args.entry = value;
      args.entryExplicit = true;
    } else {
      args[key] = value;
    }
    index += 1;
  }

  const sourceInputs = [args.sourceDocument, args.contract, args.sourceFile].filter(Boolean);
  if (sourceInputs.length !== 1) {
    throw new Error('Provide exactly one of --source-document, --contract, or --source-file');
  }
  normalizeArgs(args);
  return args;
}

function normalizeArgs(args) {
  const allowedHosts = new Set(['codex', 'claude-code', 'claude', 'cursor-ide', 'cursor-cli', 'cursor', 'generic']);
  const allowedLanguages = new Set(['zh-CN', 'en-US', 'bilingual', 'auto']);
  const allowedProfiles = new Set(['full', 'compact']);
  const allowedGoalAvailability = new Set(['true', 'false', 'auto']);

  if (args.entryValues.length > 1) {
    throw new BlockedInput(
      'BLOCK: ENTRY_DUPLICATED',
      'Provide exactly one --entry value.'
    );
  }
  if (!args.entry) {
    throw new BlockedInput(
      'BLOCK: ENTRY_REQUIRED',
      'Provide exactly one explicit --entry value.'
    );
  }
  if (!allowedHosts.has(args.executionHost)) {
    throw new Error(`Unsupported --execution-host: ${args.executionHost}`);
  }
  if (!allowedLanguages.has(args.promptLanguage)) {
    throw new Error(`Unsupported --prompt-language: ${args.promptLanguage}`);
  }
  if (!allowedProfiles.has(args.humanPromptProfile)) {
    throw new Error(`Unsupported --human-prompt-profile: ${args.humanPromptProfile}`);
  }
  args.goalCommandAvailable = String(args.goalCommandAvailable ?? 'auto');
  if (!allowedGoalAvailability.has(args.goalCommandAvailable)) {
    throw new Error(`Unsupported --goal-command-available: ${args.goalCommandAvailable}`);
  }
  if (args.goalCommandAvailable === 'true' && args.outDir && !String(args.taskReportPath || '').trim()) {
    throw new BlockedInput(
      'BLOCK: TASK_REPORT_PATH_REQUIRED',
      'Native /goal generation requires --task-report-path so main-agent can import the execution TaskReport.'
    );
  }
  if (args.taskReportPath) {
    args.taskReportPath = normalizePathSafe(path.resolve(args.taskReportPath));
  }
  const presentControlledExecutionArgs = CONTROLLED_EXECUTION_ARG_KEYS.filter((key) =>
    String(args[key] ?? '').trim()
  );
  if (
    presentControlledExecutionArgs.length > 0 &&
    presentControlledExecutionArgs.length !== CONTROLLED_EXECUTION_ARG_KEYS.length
  ) {
    const missing = CONTROLLED_EXECUTION_ARG_KEYS.filter(
      (key) => !presentControlledExecutionArgs.includes(key)
    );
    throw new BlockedInput(
      'BLOCK: CONTROLLED_EXECUTION_CONTEXT_INCOMPLETE',
      `Controlled command execution context requires all nine parameters. Missing: ${missing.join(', ')}`
    );
  }
  if (presentControlledExecutionArgs.length === CONTROLLED_EXECUTION_ARG_KEYS.length) {
    for (const key of CONTROLLED_EXECUTION_ARG_KEYS) {
      args[key] = String(args[key]).trim();
    }
    for (const key of ['contractHash', 'inputSnapshotHash']) {
      if (!SHA256_REF_PATTERN.test(args[key])) {
        throw new BlockedInput(
          'BLOCK: CONTROLLED_EXECUTION_CONTEXT_INVALID',
          `Controlled command execution context ${key} must be a sha256 reference.`
        );
      }
    }
    args.commandCwd = normalizePathSafe(path.resolve(args.commandCwd));
    args.commandReceiptRoot = normalizePathSafe(path.resolve(args.commandReceiptRoot));
  }
}

function taskReportPathRequired(args) {
  return (
    args.goalCommandAvailable === 'true' &&
    args.outDir &&
    !String(args.taskReportPath || '').trim()
  );
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readOptionalJson(file) {
  if (!file) return null;
  if (!fs.existsSync(file)) {
    throw new BlockedInput(
      'BLOCK: EXECUTION_DISCIPLINE_PROFILE_REF_MISSING',
      `Execution discipline profile ref does not exist: ${file}`
    );
  }
  return readJson(file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  safeWriteJson(file, value, { mode: 'upsert' });
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  safeWriteText(file, value, { mode: 'upsert' });
}

function publishBlockedReceipt(outDir, receipt) {
  const hasPriorArtifacts = ['model_packet.json', 'human_prompt.txt', 'audit_receipt.json', GOAL_DOCUMENT_FILENAME]
    .some((name) => fs.existsSync(path.join(outDir, name)));
  const hasPendingPublication = fs.existsSync(path.join(outDir, '.compiler-publication.lock'));
  const target = hasPriorArtifacts || hasPendingPublication
    ? path.join(outDir, '.compiler-rejections', `${receipt.receiptHash.slice(7)}.json`)
    : path.join(outDir, 'audit_receipt.json');
  writeJson(target, receipt);
  return normalizePathSafe(target);
}

function checkArtifactBudgets(artifacts, context) {
  const { measureJudgePayload } = requireBmadSpeckit(
    'dist/main-agent/source-authority/scripts/requirements-contract-judge-payload-budget.js'
  );
  return Object.entries(artifacts).map(([name, content]) => {
    try {
      const measured = measureJudgePayload({ serializedPayload: content,
        stage: `req_trace_artifact:${path.basename(name)}`, sourceHash: context.sourceDocumentHash });
      return { artifact: path.basename(name), bytes: measured.serializedPayloadBytes,
        hash: measured.serializedPayloadHash, limit: measured.transportByteLimit, unit: 'utf8_bytes' };
    } catch (error) {
      throw error;
    }
  });
}

function displayPath(file) {
  return file.split(path.sep).join('/');
}

function unique(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function commandish(value) {
  const normalized = String(value ?? '').trim();
  return COMMAND_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function objects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function strings(value) {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => String(item ?? '').trim()));
}

function block(code, message) {
  return `${code}\n${message}`;
}

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function stableStringify(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? 'null').join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .flatMap((key) => {
      const serialized = stableStringify(value[key]);
      return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
    })
    .join(',')}}`;
}

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function normalizeTextForHash(value) {
  const text = String(value);
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/gu, '\n').normalize('NFC');
}

function normalizeCanonicalObjectValue(value) {
  if (typeof value === 'string') return normalizeTextForHash(value);
  if (Array.isArray(value)) return value.map(normalizeCanonicalObjectValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalizeCanonicalObjectValue(child)])
  );
}

function canonicalObjectHash(value) {
  return sha256(JSON.stringify(normalizeCanonicalObjectValue(value)));
}

function compilerIdentity() {
  return {
    path: path.resolve(__filename).replace(/\\/gu, '/'),
    hash: sha256(fs.readFileSync(__filename, 'utf8')),
  };
}

function resolveCompilerEntryProfile(args) {
  const profile = readGoalContractProfile(args);
  const entryProfile = profile.entryProfiles?.[args.entry];
  if (
    !entryProfile ||
    entryProfile.compilerRoute !== 'shared_goal_execution_ir_compiler' ||
    entryProfile.dualViewPolicy !== 'forbidden'
  ) {
    throw new BlockedInput(
      'BLOCK: ENTRY_ROUTE_MISMATCH',
      `Unsupported --entry: ${args.entry}`
    );
  }
  const forbiddenSemanticInputs = FORBIDDEN_SEMANTIC_INPUT_KEYS.filter(
    (key) => String(args[key] ?? '').trim()
  );
  if (forbiddenSemanticInputs.length > 0) {
    throw new BlockedInput(
      'BLOCK: ENTRY_AUTHORITY_VIOLATION',
      `Entry ${args.entry} rejects semantic derivation payloads: ${forbiddenSemanticInputs.join(', ')}`
    );
  }
  args.resolvedGoalContractProfile = profile;
  args.resolvedEntryProfile = entryProfile;
}

function entryMetadata(args) {
  const profile = args.resolvedGoalContractProfile;
  const entryProfile = args.resolvedEntryProfile;
  const metadata = {
    entryScenario: args.entry,
    entryExplicit: args.entryExplicit,
    compilerIdentity: compilerIdentity(),
  };
  if (!profile || !entryProfile) return metadata;
  return {
    ...metadata,
    entryCompatibility: {
      compilerRoute: entryProfile.compilerRoute,
      dualViewPolicy: entryProfile.dualViewPolicy,
      profileHash: profile.profileHash,
      profileVersion: profile.profileVersion,
      sourceAuthority: entryProfile.sourceAuthority,
    },
    finalArtifactAuthority: entryProfile.finalArtifactAuthority,
    artifactRoles: { ...entryProfile.artifactRoles },
  };
}

function profileHashFor(profile) {
  const clone = { ...(profile ?? {}) };
  delete clone.profileHash;
  return sha256(stableStringify(clone));
}

const PROJECTION_HASH_BOOKKEEPING_FIELDS = new Set([
  'derivedFromPacketHash',
  'projectionStatus',
]);

function stripProjectionHashBookkeeping(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripProjectionHashBookkeeping(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PROJECTION_HASH_BOOKKEEPING_FIELDS.has(key))
      .map(([key, child]) => [key, stripProjectionHashBookkeeping(child)])
  );
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) {
      semantic[key] = stripProjectionHashBookkeeping(value);
    }
  }
  normalizePreConfirmationDrilldownForHash(semantic);
  return semantic;
}

function legacyProjectionInclusiveConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) {
      semantic[key] = value;
    }
  }
  normalizePreConfirmationDrilldownForHash(semantic);
  return semantic;
}

function normalizePreConfirmationDrilldownForHash(semantic) {
  if (
    !semantic.preConfirmationDrilldown ||
    typeof semantic.preConfirmationDrilldown !== 'object' ||
    Array.isArray(semantic.preConfirmationDrilldown)
  ) {
    return;
  }
  const drilldown = { ...semantic.preConfirmationDrilldown };
  if (
    drilldown.semanticKernelRef &&
    typeof drilldown.semanticKernelRef === 'object' &&
    !Array.isArray(drilldown.semanticKernelRef)
  ) {
    const semanticKernelRef = { ...drilldown.semanticKernelRef };
    delete semanticKernelRef.hash;
    drilldown.semanticKernelRef = semanticKernelRef;
  }
  if (
    drilldown.mustDecompositionPacketRef &&
    typeof drilldown.mustDecompositionPacketRef === 'object' &&
    !Array.isArray(drilldown.mustDecompositionPacketRef)
  ) {
    const mustDecompositionPacketRef = { ...drilldown.mustDecompositionPacketRef };
    delete mustDecompositionPacketRef.hash;
    drilldown.mustDecompositionPacketRef = mustDecompositionPacketRef;
  }
  if (
    drilldown.criticalAuditor &&
    typeof drilldown.criticalAuditor === 'object' &&
    !Array.isArray(drilldown.criticalAuditor)
  ) {
    const criticalAuditor = { ...drilldown.criticalAuditor };
    delete criticalAuditor.consecutiveNoNewGapRounds;
    delete criticalAuditor.latestReceiptHash;
    delete criticalAuditor.convergenceVerdict;
    drilldown.criticalAuditor = criticalAuditor;
  }
  semantic.preConfirmationDrilldown = drilldown;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  const normalizedSource = normalizeTextForHash(sourceText);
  const normalizedOriginalBlock = normalizeTextForHash(blockText);
  const blockStart = normalizedSource.indexOf(normalizedOriginalBlock);
  if (blockStart < 0) {
    throw new BlockedInput(
      'BLOCK: SOURCE_DOCUMENT_HASH_INVALID',
      'implementationConfirmation block is missing from the normalized source document.'
    );
  }
  if (normalizedSource.indexOf(normalizedOriginalBlock, blockStart + 1) >= 0) {
    throw new BlockedInput(
      'BLOCK: SOURCE_DOCUMENT_HASH_INVALID',
      'implementationConfirmation block is ambiguous in the normalized source document.'
    );
  }
  return sha256(
    `${normalizedSource.slice(0, blockStart)}${normalizedBlock}${normalizedSource.slice(
      blockStart + normalizedOriginalBlock.length
    )}`
  );
}

function implementationConfirmationHashFor(confirmation) {
  return canonicalObjectHash(semanticConfirmationForHash(confirmation));
}

function legacyProjectionInclusiveHashesFor(sourceText, blockText, confirmation) {
  const semantic = legacyProjectionInclusiveConfirmationForHash(confirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256(sourceText.replace(blockText, normalizedBlock)),
    implementationConfirmationHash: sha256(stableStringify(semantic)),
  };
}

function extractConfirmationBlock(text) {
  const lines = text.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    throw new BlockedInput(
      'BLOCK: SOURCE_DOCUMENT_REQUIRED',
      'Need a PRD / BUGFIX / TASKS implementation source document with inline implementationConfirmation.'
    );
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function parseConfirmation(blockText) {
  const parsed = yaml.load(blockText, { schema: yaml.JSON_SCHEMA });
  if (!parsed || typeof parsed !== 'object') {
    return { implementationConfirmation: {} };
  }
  return parsed;
}

function latestConfirmationEvent(record) {
  const history = record.confirmationHistory;
  if (!Array.isArray(history) || history.length === 0) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_REQUIRED',
      'requirement-record.json must contain confirmationHistory[] before generating an implementation prompt.'
    );
  }
  const event = history.at(-1);
  if (!event || typeof event !== 'object' || event.eventType !== 'confirmation_recorded') {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_REQUIRED',
      'The latest requirement-record.json confirmationHistory[] event must be confirmation_recorded.'
    );
  }
  return event;
}

function validateRequirementRecord(args, sourceText, blockText, confirmation) {
  if (!args.requirementRecord) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_REQUIRED',
      '--requirement-record is required; source status alone is not sufficient authority.'
    );
  }

  const record = readJson(args.requirementRecord);
  const event = latestConfirmationEvent(record);
  const sourceHash = sourceDocumentHashFor(sourceText, blockText, confirmation);
  const confirmationHash = implementationConfirmationHashFor(confirmation);
  const mismatchesFor = (candidateSourceHash, candidateConfirmationHash) => {
    const mismatches = [];
    if (event.sourceDocumentHash !== candidateSourceHash) mismatches.push('sourceDocumentHash');
    if (event.implementationConfirmationHash !== candidateConfirmationHash) {
      mismatches.push('implementationConfirmationHash');
    }
    if (record.sourceDocumentHash !== candidateSourceHash) {
      mismatches.push('record.sourceDocumentHash');
    }
    if (
      record.implementationConfirmationHash !== candidateConfirmationHash
    ) {
      mismatches.push('record.implementationConfirmationHash');
    }
    return mismatches;
  };
  const mismatches = mismatchesFor(sourceHash, confirmationHash);

  if (mismatches.length > 0) {
    const legacyHashes = legacyProjectionInclusiveHashesFor(sourceText, blockText, confirmation);
    const legacyMismatches = mismatchesFor(
      legacyHashes.sourceDocumentHash,
      legacyHashes.implementationConfirmationHash
    );
    if (
      legacyMismatches.length === 0 &&
      (legacyHashes.sourceDocumentHash !== sourceHash ||
        legacyHashes.implementationConfirmationHash !== confirmationHash)
    ) {
      return {
        record,
        event,
        sourceDocumentHash: legacyHashes.sourceDocumentHash,
        implementationConfirmationHash: legacyHashes.implementationConfirmationHash,
        confirmationHashAuthority: {
          recipe: 'legacy_projection_bookkeeping_inclusive/v1',
          compatibilityDecision: 'accepted_existing_confirmation',
          canonicalSourceDocumentHash: sourceHash,
          canonicalImplementationConfirmationHash: confirmationHash,
        },
      };
    }
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH',
      `Latest confirmationHistory[] hash does not match current source document: ${mismatches.join(', ')}`
    );
  }
  return {
    record,
    event,
    sourceDocumentHash: sourceHash,
    implementationConfirmationHash: confirmationHash,
    confirmationHashAuthority: {
      recipe: 'canonical_projection_bookkeeping_excluded/v2',
      compatibilityDecision: 'current_recipe',
      canonicalSourceDocumentHash: sourceHash,
      canonicalImplementationConfirmationHash: confirmationHash,
    },
  };
}

function ids(items) {
  if (!Array.isArray(items)) return new Set();
  return new Set(items.filter((item) => item && item.id).map((item) => String(item.id)));
}

function typedSourceRuntime() {
  return requireBmadSpeckit(
    'dist/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics.js'
  );
}

function confirmedAuthorityRuntime() {
  return requireBmadSpeckit(
    'dist/main-agent/source-authority/scripts/requirements-contract-confirmed-authority-adapter.js'
  );
}

function confirmedRequirementsGoalCompilerRuntime() {
  return requireBmadSpeckit(
    'dist/utils/goal-contract/control-plane/confirmed-requirements-goal-compiler.js'
  );
}

function compileSharedConfirmedRequirementsGoal(context, args) {
  if (!['req_trace_direct', 'main_agent_compile'].includes(args.entry)) {
    throw new BlockedInput(
      'BLOCK: ENTRY_ROUTE_MISMATCH',
      `Entry ${args.entry} cannot invoke the confirmed Requirements Goal compiler.`
    );
  }
  if (!context.authority) {
    throw new BlockedInput(
      'BLOCK: CANONICAL_CONFIRMED_AUTHORITY_REQUIRED',
      `Entry ${args.entry} requires a resolved canonical confirmed Requirements authority.`
    );
  }
  const compilation =
    confirmedRequirementsGoalCompilerRuntime().compileConfirmedRequirementsGoalSemantics({
      authority: context.authority,
    });
  if (sha256(compilation.projection.markdown) !== compilation.projection.bytesHash) {
    throw new BlockedInput(
      'BLOCK: SHARED_GOAL_PROJECTION_HASH_MISMATCH',
      'The shared confirmed Requirements Goal projection failed its byte-hash binding.'
    );
  }
  context.sharedGoalProjection = Object.freeze({
    markdown: compilation.projection.markdown,
    bytesHash: compilation.projection.bytesHash,
  });
  return Object.freeze({
    schemaVersion: 'ConfirmedRequirementsGoalCompilationRef/v1',
    compilerRoute: 'shared_goal_execution_ir_compiler',
    compilerModule:
      'dist/utils/goal-contract/control-plane/confirmed-requirements-goal-compiler.js',
    canonicalRequirementGraphRef: Object.freeze({
      schemaVersion: compilation.canonicalRequirementGraph.schemaVersion,
      graphHash: compilation.canonicalRequirementGraph.graphHash,
      semanticHash: compilation.canonicalRequirementGraph.semanticHash,
    }),
    canonicalRequirementGraphHash: compilation.canonicalRequirementGraph.graphHash,
    canonicalRequirementSemanticHash: compilation.canonicalRequirementGraph.semanticHash,
    canonicalGraphLintHash: compilation.canonicalGraphLint.receiptHash,
    goalExecutionIrRef: Object.freeze({
      schemaVersion: compilation.goalExecutionIr.schemaVersion,
      hash: compilation.goalExecutionIr.goalExecutionIRHash,
    }),
    goalExecutionIRHash: compilation.goalExecutionIr.goalExecutionIRHash,
    goalExecutionClosureRef: Object.freeze({
      schemaVersion: compilation.closure.schemaVersion,
      hash: compilation.closure.goalExecutionClosureHash,
    }),
    goalExecutionClosureHash: compilation.closure.goalExecutionClosureHash,
    goalExecutionProjectionRef: Object.freeze({
      kind: 'deterministic_markdown',
      hash: compilation.projection.bytesHash,
    }),
    goalExecutionProjectionHash: compilation.projection.bytesHash,
  });
}

function resolveCanonicalConfirmedContext(args, sourcePath) {
  if (!args.requirementRecord) return null;
  const record = readJson(args.requirementRecord);
  if (record.schemaVersion !== 'requirements-contract-record/v1') return null;
  let authority;
  try {
    authority = confirmedAuthorityRuntime().resolveConfirmedRequirementsAuthority({
      projectRoot: process.cwd(),
      requirementRecordPath: path.resolve(args.requirementRecord),
    });
  } catch (error) {
    throw new BlockedInput(
      'BLOCK: CONFIRMED_AUTHORITY_INVALID',
      `Canonical confirmed Requirements authority failed validation: ${String(error.message).slice(0, 300)}`
    );
  }
  const sourceText = readText(sourcePath);
  const identityValues = [
    authority.requestId,
    authority.semanticIr.semanticRevisionId,
    authority.semanticIr.scopeSemanticHash,
  ];
  if (identityValues.some((value) => !sourceText.includes(value))) {
    throw new BlockedInput(
      'BLOCK: SOURCE_PRESENTATION_IDENTITY_MISMATCH',
      'The source presentation does not identify the confirmed record, semantic revision, and scope hash.'
    );
  }
  const sourceDocumentHash = authority.lineage.finalMarkdownHash;
  const implementationConfirmationHash = authority.lineage.implementationConfirmationHash;
  return {
    authorityMode: 'canonical_record',
    authority,
    sourcePath: authority.sourceDocumentPath,
    sourcePresentationPath: sourcePath,
    sourceText,
    blockText: '',
    confirmation: authority.implementationConfirmation,
    record: {
      ...authority.architectureContext.record,
      status: 'user_confirmed',
      sourceDocumentHash,
      implementationConfirmationHash,
    },
    latestConfirmationEvent: {
      ...authority.architectureContext.confirmationEvent,
      eventType: 'confirmation_recorded',
      confirmedAt: null,
      confirmationPageHash: authority.lineage.finalMarkdownHash,
    },
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationHashAuthority: {
      recipe: 'canonical_confirmed_requirements_authority/v1',
      compatibilityDecision: 'validated_cp08_to_cp05_lineage',
      ...authority.lineage,
    },
    criticalAuditorReceiptRefs: [],
  };
}

function typedPacketValidation(packet, receipt, confirmation) {
  return requireBmadSpeckit(
    'dist/main-agent/source-authority/scripts/requirements-contract-typed-model-packet.js'
  ).validateTypedModelPacket(packet, receipt, confirmation);
}

function typedPacketProjectionRuntime() {
  return requireBmadSpeckit(
    'dist/main-agent/source-authority/scripts/requirements-contract-typed-packet-projection.js'
  );
}

function packetRequiredCommands(packet) {
  return typedPacketProjectionRuntime().requiredCommandsFromTypedModelPacket(packet);
}

function packetErrorCaseCoverage(packet) {
  return typedPacketProjectionRuntime().errorCaseCoverageFromTypedModelPacket(packet);
}

function typedPacketPublicationOracle(packet, receipt, confirmation) {
  return requireBmadSpeckit(
    'dist/main-agent/source-authority/scripts/requirements-contract-typed-model-packet.js'
  ).validateTypedModelPacketPublication(packet, receipt, confirmation);
}

function validateTypedSourceFormat(sourceText, confirmation) {
  if (!confirmation?.typedSourceAuthority) return;
  try {
    const { extractRequirementsContractImplementationConfirmation } = requireBmadSpeckit(
      'dist/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec.js'
    );
    const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
    if (stableStringify(extracted.value.typedSourceAuthority) !== stableStringify(confirmation.typedSourceAuthority)) {
      throw new Error('typed_source_parse_mismatch');
    }
  } catch (error) {
    throw new BlockedInput('BLOCK: TYPED_SOURCE_AUTHORITY_INVALID',
      `Typed source requires canonical inline confirmation: ${String(error.message).slice(0, 200)}`);
  }
}

function validateConfirmedTypedSource(confirmation) {
  if (confirmation.typedSourceAuthority === undefined && confirmation.typedCoverage === undefined) return;
  try {
    const runtime = typedSourceRuntime();
    runtime.resolveTypedSourceAuthority(confirmation.typedSourceAuthority);
    runtime.assertTypedConfirmationProjection(confirmation);
  } catch (error) {
    throw new BlockedInput('BLOCK: TYPED_SOURCE_AUTHORITY_INVALID',
      `Confirmed typed source validation failed: ${String(error.message).slice(0, 240)}`);
  }
}

function projectTypedConfirmationTasks(confirmation) {
  if (!confirmation.typedSourceAuthority) return confirmation;
  const tasks = objects(confirmation.implementationTasks);
  const projection = {
    atomicImplementationTaskList: tasks,
    mustToAtomicTaskMap: Object.fromEntries(objects(confirmation.must).map((row) => [
      String(row.id), tasks.filter((task) => strings(task.requirementRefs).includes(String(row.id)))
        .map((task) => String(task.id)),
    ])),
    atomicTaskToTraceMap: Object.fromEntries(tasks.map((task) => [String(task.id), strings(task.traceRefs)])),
  };
  for (const [key, value] of Object.entries(projection)) {
    if (confirmation[key] !== undefined && stableStringify(confirmation[key]) !== stableStringify(value)) {
      throw new BlockedInput('BLOCK: TYPED_SOURCE_TASK_PROJECTION_CONFLICT',
        `Confirmed ${key} conflicts with implementationTasks.`);
    }
  }
  return { ...confirmation, ...projection };
}

function validateConfirmation(parsed, driftClassification = null) {
  const confirmation = parsed.implementationConfirmation;
  if (!confirmation || typeof confirmation !== 'object') {
    throw new BlockedInput(
      'BLOCK: SOURCE_DOCUMENT_REQUIRED',
      'Need a PRD / BUGFIX / TASKS implementation source document with inline implementationConfirmation.'
    );
  }

  if (confirmation.status !== 'user_confirmed') {
    if (driftClassification?.kind === STALE_BOOKKEEPING_REPAIR_REQUIRED) {
      throw new BlockedInput(
        'BLOCK: STALE_BOOKKEEPING_REPAIR_REQUIRED',
        `implementationConfirmation status/bookkeeping is stale but semantic confirmation hashes match: ${(driftClassification.repairableReasons ?? []).join(', ')}`
      );
    }
    if (driftClassification?.kind === PROJECTION_REFRESH_REQUIRED) {
      throw new BlockedInput(
        'BLOCK: PROJECTION_REFRESH_REQUIRED',
        'confirmation projection hash changed without semantic confirmation drift; record projection refresh before prompt generation.'
      );
    }
    throw new BlockedInput(
      'BLOCK: EXECUTION_READY_AUTHORITY_MISSING',
      'issueCode=execution_ready_authority_missing; implementationConfirmation.status is not user_confirmed; draft and diagnostic authoring artifacts are not execution-ready authority.'
    );
  }

  const openQuestions = Array.isArray(confirmation.openQuestions) ? confirmation.openQuestions : [];
  if (openQuestions.some((item) => item?.blocksImplementation === true)) {
    throw new BlockedInput(
      'BLOCK: BLOCKING_QUESTIONS',
      'implementationConfirmation.openQuestions contains blocksImplementation=true.'
    );
  }

  validateConfirmedTypedSource(confirmation);
  const mustIds = ids(confirmation.must);
  const notDoneIds = ids(confirmation.notDone);
  const evidenceIds = ids(confirmation.evidence);
  const mustNotIds = ids(confirmation.mustNot);
  const allowedCoverIds = new Set([...mustIds, ...notDoneIds]);
  const traceRows = Array.isArray(confirmation.traceRows) ? confirmation.traceRows : [];
  if (traceRows.length === 0) {
    throw new BlockedInput('BLOCK: TRACE_REFERENCE_INVALID', 'implementationConfirmation.traceRows is missing or empty.');
  }

  const invalid = [];
  const semanticKeys = new Set(['text', 'scenario', 'expected', 'expectedBehavior', 'requirement', 'description']);
  const semanticRows = [];

  for (const row of traceRows) {
    const rowId = String(row?.id ?? 'TRACE-UNKNOWN');
    const covers = Array.isArray(row?.covers) ? row.covers : [];
    const evidenceRefs = Array.isArray(row?.evidenceRefs) ? row.evidenceRefs : [];
    for (const coverId of covers) {
      if (!allowedCoverIds.has(coverId)) {
        if (mustNotIds.has(coverId) || String(coverId).startsWith('OUT-')) {
          invalid.push(`${rowId}.covers:${coverId} (mustNot boundary IDs belong in boundaryViews or boundaryRefs)`);
        } else {
          invalid.push(`${rowId}.covers:${coverId}`);
        }
      }
    }
    for (const evidenceRef of evidenceRefs) {
      if (!evidenceIds.has(evidenceRef)) invalid.push(`${rowId}.evidenceRefs:${evidenceRef}`);
    }
    if (Object.keys(row ?? {}).some((key) => semanticKeys.has(key))) {
      semanticRows.push(rowId);
    }
  }

  if (invalid.length > 0) {
    throw new BlockedInput(
      'BLOCK: TRACE_REFERENCE_INVALID',
      `traceRows reference missing must/notDone/evidence IDs: ${invalid.join(', ')}`
    );
  }

  if (semanticRows.length > 0) {
    throw new BlockedInput(
      'BLOCK: TRACE_RESTATES_REQUIREMENTS',
      `traceRows contain new requirement semantics instead of references only: ${semanticRows.join(', ')}`
    );
  }

  return projectTypedConfirmationTasks(confirmation);
}

function renderFinalGates(commands) {
  return commands.map((command) => `    - ${command}`).join('\n');
}

function renderExtraRules(rules) {
  if (!rules.length) return '';
  return rules.map((rule, index) => `\n${index + 4}. ${rule}`).join('');
}

function commandId(command) {
  return String(command?.id ?? command?.commandId ?? '').trim();
}

function commandText(command) {
  return String(command?.command ?? command?.gate ?? '').trim();
}

function controlledExecutionContextFromArgs(args) {
  if (!CONTROLLED_EXECUTION_ARG_KEYS.every((key) => String(args[key] ?? '').trim())) {
    return null;
  }
  return {
    requirementSetId: args.requirementSetId,
    transactionId: args.transactionId,
    implementationAttemptId: args.implementationAttemptId,
    architectureAuditAttemptId: args.architectureAuditAttemptId,
    activePhaseAuditAttemptId: args.activePhaseAuditAttemptId,
    contractHash: args.contractHash,
    inputSnapshotHash: args.inputSnapshotHash,
  };
}

function commandArgv(command) {
  const explicit = strings(command?.argv);
  if (explicit.length > 0) return explicit;
  const text = commandText(command);
  const argv = [];
  let token = '';
  let quote = null;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote) {
        quote = null;
        continue;
      }
      if (
        character === '\\' &&
        index + 1 < text.length &&
        (text[index + 1] === quote || text[index + 1] === '\\')
      ) {
        token += text[index + 1];
        index += 1;
        continue;
      }
      token += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (/\s/u.test(character)) {
      if (token) {
        argv.push(token);
        token = '';
      }
      continue;
    }
    token += character;
  }
  if (quote) {
    throw new BlockedInput(
      'BLOCK: COMMAND_ARGV_INVALID',
      `Required command ${commandId(command) || '<missing>'} contains an unterminated quote.`
    );
  }
  if (token) argv.push(token);
  return argv;
}

function traceRowsForCommand(confirmation, command) {
  const directTraceRefs = strings(command?.traceRows);
  const rows = objects(confirmation.traceRows);
  const referencedTraceRefs = rows
    .filter((row) => {
      const refs = [
        ...strings(row.contractValidationCommandRefs),
        ...strings(row.deliveryEvidenceCommandRefs),
      ];
      return refs.includes(commandId(command));
    })
    .map((row) => String(row.id ?? '').trim())
    .filter(Boolean);
  const traceRefs =
    directTraceRefs.length > 0 ? directTraceRefs : unique(referencedTraceRefs);
  const traceRefSet = new Set(traceRefs);
  return {
    traceRefs,
    rows: rows.filter((row) => traceRefSet.has(String(row.id ?? '').trim())),
  };
}

function controlledRequiredCommandDescriptor(confirmation, command, args) {
  const id = commandId(command);
  const text = commandText(command);
  const { traceRefs, rows } = traceRowsForCommand(confirmation, command);
  const confirmedRequirementIds = ids(confirmation.must);
  const requirementRefs = unique(
    rows
      .flatMap((row) => strings(row.covers))
      .filter((ref) => confirmation.typedSourceAuthority
        ? confirmedRequirementIds.has(ref) : ref.startsWith('MUST-'))
  );
  const acceptanceRefs = unique(
    rows.flatMap((row) => [
      ...strings(row.acceptanceRefs),
      ...strings(row.e2eRefs),
    ])
  );
  return {
    id,
    command: text,
    normalizedCommand: text.replace(/\s+/gu, ' '),
    argv: commandArgv(command),
    cwd: args.commandCwd,
    receiptPath: normalizePathSafe(path.join(args.commandReceiptRoot, `${id}.json`)),
    requirementRefs,
    acceptanceRefs,
    traceRefs,
    traceRows: traceRefs,
    evidenceRefs: strings(command.evidenceRefs),
    oracle: command.oracle ?? command.purpose ?? '',
  };
}

function validateRequiredCommandDefinitions(confirmation) {
  const invalid = [];
  const duplicates = [];
  const seen = new Set();
  objects(confirmation.requiredCommands).forEach((command, index) => {
    const location = `requiredCommands[${index}]`;
    const id = commandId(command);
    if (!id) {
      invalid.push(`${location}.id`);
      return;
    }
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
    if (!commandText(command)) invalid.push(`${id}.command`);
  });
  if (invalid.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_DEFINITION_INVALID',
      `implementationConfirmation requiredCommands[] entries must include id and runnable command text: ${invalid.join(', ')}`
    );
  }
  if (duplicates.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_DEFINITION_INVALID',
      `implementationConfirmation requiredCommands[] IDs must be unique: ${unique(duplicates).join(', ')}`
    );
  }
}

function commandRegistry(confirmation) {
  const registry = new Map();
  for (const command of objects(confirmation.requiredCommands)) {
    const id = commandId(command);
    const text = commandText(command);
    if (id) registry.set(id, { id, command: text, source: 'required' });
  }
  for (const command of objects(confirmation.suggestedCommands)) {
    const id = commandId(command);
    const text = commandText(command);
    if (id && !registry.has(id)) registry.set(id, { id, command: text, source: 'suggested' });
  }
  return registry;
}

function validateCommandReferences(confirmation, registry) {
  const missing = [];
  const invalid = [];
  const requiredCommandIds = new Set(objects(confirmation.requiredCommands).map((command) => commandId(command)).filter(Boolean));
  const requireCommand = (ref, location) => {
    const command = registry.get(ref);
    if (!command || !requiredCommandIds.has(ref)) {
      missing.push(`${location}:${ref}`);
      return;
    }
    if (!command.command) invalid.push(`${location}:${ref}`);
  };
  const traceRows = Array.isArray(confirmation.traceRows) ? confirmation.traceRows : [];
  for (const row of traceRows) {
    const rowId = String(row?.id ?? 'TRACE-UNKNOWN');
    for (const ref of strings(row?.contractValidationCommandRefs)) {
      requireCommand(ref, `${rowId}.contractValidationCommandRefs`);
    }
    for (const ref of strings(row?.deliveryEvidenceCommandRefs)) {
      requireCommand(ref, `${rowId}.deliveryEvidenceCommandRefs`);
    }
  }
  for (const ref of strings(confirmation.closeoutReadinessPreview?.requiredCommands)) {
    requireCommand(ref, 'closeoutReadinessPreview.requiredCommands');
  }
  if (missing.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_REFERENCE_INVALID',
      `implementationConfirmation command references are missing from requiredCommands[]: ${missing.join(', ')}`
    );
  }
  if (invalid.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_DEFINITION_INVALID',
      `implementationConfirmation requiredCommands[] entries must include runnable command text: ${invalid.join(', ')}`
    );
  }
}

function parseCommands(confirmation, extraGates, registry) {
  const commands = [];
  const previewCommandRefs = strings(confirmation.closeoutReadinessPreview?.requiredCommands);
  if (previewCommandRefs.length > 0) {
    for (const ref of previewCommandRefs) {
      const command = registry.get(ref);
      if (command?.command) commands.push(command.command);
    }
  } else {
    for (const command of objects(confirmation.requiredCommands)) {
      const text = commandText(command);
      if (text) commands.push(text);
    }
  }
  const evidence = Array.isArray(confirmation.evidence) ? confirmation.evidence : [];
  for (const item of evidence) {
    const gate = String(item?.gate ?? '').trim();
    if (gate && commandish(gate)) commands.push(gate);
  }
  commands.push(...extraGates);
  return unique(commands);
}

function renderRefs(values) {
  const refs = strings(values);
  return refs.length > 0 ? refs.join(', ') : '(none)';
}

function renderTraceRows(traceRows) {
  return traceRows
    .map((row) => {
      const rowId = String(row?.id ?? 'TRACE-UNKNOWN');
      return `${rowId}
covers: ${renderRefs(row?.covers)}
evidenceRefs: ${renderRefs(row?.evidenceRefs)}
taskRefs: ${renderRefs(row?.taskRefs)}
contract gates: ${renderRefs(row?.contractValidationCommandRefs)}
delivery gates: ${renderRefs(row?.deliveryEvidenceCommandRefs)}`;
    })
    .join('\n\n');
}

function renderRequiredCommands(confirmation) {
  const requiredCommands = objects(confirmation.requiredCommands).filter(
    (command) => commandId(command) || commandText(command)
  );
  if (requiredCommands.length === 0) return '(none declared; legacy evidence gates and --final-gate remain the only final gates)';
  return requiredCommands
    .map((command) => {
      const id = commandId(command) || 'CMD-UNKNOWN';
      const text = commandText(command) || '(missing command text; referenced commands are blocked before prompt generation)';
      return `${id}:
${text}`;
    })
    .join('\n\n');
}

function renderSuggestedCommands(confirmation) {
  const suggested = objects(confirmation.suggestedCommands).filter((command) => commandText(command));
  if (suggested.length === 0) return '';
  return `\nSuggested smoke only, not acceptance by itself:\n${suggested
    .map((command) => commandText(command))
    .join('\n')}\n`;
}

function auditPrompt(prompt) {
  const requiredFragments = [
    SKILL_LINE,
    '#implementationConfirmation',
    'Only ',
    'Do not implement prose, diagrams, or conversation content',
    'traceRows',
    'confirmed source traceRows are contract projection only',
    'Runtime closure authority is the requirement-record/control store',
    'must not rewrite confirmed source traceRows.status',
    'requirementClosures',
    'PASS requires evidence for covered must, notDone, and evidence IDs',
    'MISSING_EVIDENCE',
    'reconfirm_required',
    'Trace order:',
    '执行切片:',
    'Required commands:',
    'Completion Evidence Packet',
  ];
  return requiredFragments.filter((fragment) => !prompt.includes(fragment));
}

function promptAuditFragments(sourceDocument, profile = 'full') {
  const authorityFragments = [
    SKILL_LINE,
    `Only ${sourceDocument}#implementationConfirmation is authoritative`,
    'model_packet.json is the machine-readable execution authority',
    'confirmed source traceRows are contract projection only',
    'Runtime closure authority is the requirement-record/control store',
    'Required commands:',
    'PASS requires evidence for covered must, notDone, and evidence IDs',
    'MISSING_EVIDENCE',
    'reconfirm_required',
    'Completion Evidence Packet',
  ];
  if (profile === 'compact') return authorityFragments;
  return authorityFragments;
}

function auditHumanPrompt(prompt, sourceDocument, profile) {
  const fragments = promptAuditFragments(sourceDocument, profile);
  const missing = fragments.filter((fragment) => !prompt.includes(fragment));
  return { fragments, missing, passed: missing.length === 0 };
}

function goalDocumentAuditFragments() {
  return [
    'goal-execution-projection-envelope/v1',
    '# Goal Execution Contract',
    'Goal Execution IR:',
    '## Obligations',
    '## Atomic Tasks',
  ];
}

function auditGoalDocument(documentText) {
  const fragments = goalDocumentAuditFragments();
  const missing = fragments.filter((fragment) => !documentText.includes(fragment));
  return { fragments, missing, passed: missing.length === 0 };
}

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function repoPath(relativePath) {
  return path.join(repoRoot(), ...relativePath.split('/'));
}

function readGoalContractProfile(args = {}) {
  const profilePath = args.goalContractProfile
    ? path.resolve(args.goalContractProfile)
    : repoPath(GOAL_CONTRACT_PROFILE_PATH);
  if (!fs.existsSync(profilePath)) {
    throw new BlockedInput(
      'BLOCK: GOAL_CONTRACT_PROFILE_MISSING',
      `${normalizePathSafe(profilePath)} is required for native /goal document rendering.`
    );
  }
  return readJson(profilePath);
}

function objectById(items) {
  const result = new Map();
  for (const item of objects(items)) {
    if (item.id) result.set(String(item.id), item);
  }
  return result;
}

function failIf(condition, reasons, code) {
  if (condition) reasons.push(code);
}

function refValue(value, pathKey = 'path') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return String(value[pathKey] ?? value.reportPath ?? value.ref ?? '').trim();
  return '';
}

function drilldownReceiptRefs(drilldown) {
  const direct = strings(drilldown?.criticalAuditorReceiptRefs);
  if (direct.length > 0) return direct;
  const minimum = Number(drilldown?.criticalAuditor?.minimumRounds ?? 0);
  const consecutive = Number(drilldown?.criticalAuditor?.consecutiveNoNewGapRounds ?? 0);
  if (minimum >= 3 && consecutive >= 3) {
    return Array.from({ length: consecutive }, (_, index) => `criticalAuditor.consecutiveNoNewGapRounds:${index + 1}`);
  }
  return [];
}

function governedCriticalAuditorReceiptRefs(
  requirementRecordPath,
  record,
  sourceDocumentHash,
  implementationConfirmationHash
) {
  const recordId = String(record?.recordId ?? '').trim();
  if (!requirementRecordPath || !recordId) return [];
  const authoringDir = path.join(path.dirname(path.resolve(requirementRecordPath)), 'authoring');
  const refs = [];
  for (const roundIndex of [1, 2, 3]) {
    const receiptPath = path.join(
      authoringDir,
      `critical-auditor-receipt-round-${roundIndex}.json`
    );
    if (!fs.existsSync(receiptPath)) return [];
    let root;
    try {
      root = readJson(receiptPath);
    } catch {
      return [];
    }
    const receipt = root?.criticalAuditorReceipt ?? root;
    const verdict = String(receipt?.convergenceDecision?.verdict ?? '').trim();
    if (
      !receipt ||
      typeof receipt !== 'object' ||
      Array.isArray(receipt) ||
      receipt.schemaVersion !== 'critical-auditor-receipt/v1' ||
      String(receipt.recordId ?? '').trim() !== recordId ||
      Number(receipt.roundIndex) !== roundIndex ||
      String(receipt.sourceDocumentHash ?? '').trim() !== sourceDocumentHash ||
      String(receipt.implementationConfirmationHash ?? '').trim() !==
        implementationConfirmationHash ||
      !['no_new_valid_gap', 'no_new_confirmation_blocking_gap'].includes(verdict) ||
      objects(receipt.validatedGaps).length > 0
    ) {
      return [];
    }
    refs.push(normalizePathSafe(receiptPath));
  }
  return refs;
}

function resolvedDrilldownReceiptRefs(drilldown, governedReceiptRefs = []) {
  const declaredRefs = drilldownReceiptRefs(drilldown);
  return declaredRefs.length >= 3 ? declaredRefs : governedReceiptRefs;
}

function reconciliationRef(drilldown) {
  return refValue(drilldown?.reconciliationReportRef) || refValue(drilldown?.packetSourceReconciliation, 'reportPath');
}

function reconciliationPassed(drilldown) {
  const verdict = String(drilldown?.packetSourceReconciliation?.verdict ?? '').toLowerCase();
  return !verdict || verdict === 'pass';
}

function preRenderGateRef(drilldown) {
  return refValue(drilldown?.preRenderGateReportRef) || refValue(drilldown?.preRenderGateReportPath);
}

function setFromIds(items) {
  return new Set(objects(items).map((item) => String(item.id ?? '')).filter(Boolean));
}

function hasAny(values) {
  return strings(values).length > 0;
}

function architectureConfirmationRequired(confirmation) {
  return objects(confirmation?.architectureImpacts).length > 0;
}

function latestArchitectureConfirmationEvent(record) {
  return objects(record?.architectureConfirmations)
    .filter((item) => item.eventType === 'architecture_confirmation_recorded')
    .at(-1);
}

function architectureConfirmationActiveForCurrentHashes(record, sourceHash, confirmationHash) {
  const state = record?.architectureConfirmationState;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const currentHash = String(state.currentArchitectureConfirmationHash ?? '').trim();
  const staleInputs = state.staleInputs && typeof state.staleInputs === 'object' && !Array.isArray(state.staleInputs)
    ? state.staleInputs
    : {};
  if (state.status !== 'active' || !currentHash) return false;
  if (staleInputs.sourceDocumentHash !== sourceHash) return false;
  if (staleInputs.implementationConfirmationHash !== confirmationHash) return false;
  if (staleInputs.currentArtifactHash && staleInputs.currentArtifactHash !== currentHash) return false;

  const event = latestArchitectureConfirmationEvent(record);
  if (!event) return false;
  if (event.sourceDocumentHash !== sourceHash) return false;
  if (event.implementationConfirmationHash !== confirmationHash) return false;
  if (event.architectureConfirmationArtifactHash !== currentHash) return false;

  const verifiedStatus = resolveVerifiedSixModelStatus({
    record,
    modelId: 'architecture_confirmation',
    currentImplementationAttemptId: String(
      record?.currentAttemptId ?? record?.implementationAttemptId ?? ''
    ).trim(),
  });
  return verifiedStatus.effectiveStatus === 'pass';
}

function requirementClosureFor(confirmation, id) {
  const traceRows = objects(confirmation.traceRows).filter((row) => strings(row.covers).includes(id));
  const evidenceRows = objects(confirmation.evidence).filter(
    (row) => strings(row.covers).includes(id) || strings(row.derivedFromMustRef).includes(id)
  );
  const acceptanceRows = [...objects(confirmation.acceptanceTests), ...objects(confirmation.e2eSuites)].filter((row) =>
    strings(row.covers).includes(id)
  );
  const commandRows = objects(confirmation.requiredCommands).filter(
    (row) =>
      acceptanceRows.some((acceptance) => strings(acceptance.commandRefs).includes(commandId(row))) ||
      evidenceRows.some((evidence) => strings(evidence.requiredCommandRefs).includes(commandId(row))) ||
      traceRows.some((trace) =>
        [...strings(trace.contractValidationCommandRefs), ...strings(trace.deliveryEvidenceCommandRefs)].includes(
          commandId(row)
        )
      )
  );
  return { traceRows, evidenceRows, acceptanceRows, commandRows };
}

function validateCompilerContract(confirmation, record = {}, options = {}) {
  const reasons = [];
  const manifest = confirmation.aiTddContractExecutionManifestProjection;
  const requiredSections = strings(manifest?.requiredSections);
  const drilldown = confirmation.preConfirmationDrilldown;
  const sourceHash = String(record?.sourceDocumentHash ?? '').trim();
  const confirmationHash = String(record?.implementationConfirmationHash ?? '').trim();
  const traceRows = objects(confirmation.traceRows);
  const acceptanceRows = [...objects(confirmation.acceptanceTests), ...objects(confirmation.e2eSuites)];
  const taskRows = objects(confirmation.atomicImplementationTaskList);
  const requiredMaps = manifest?.atomicImplementationTaskLineage?.requiredMaps;
  const applicability = confirmation.applicability;
  const acceptanceIds = new Set([
    ...objects(confirmation.acceptanceTests).map((row) => String(row.id)),
    ...objects(confirmation.e2eSuites).map((row) => String(row.id)),
  ]);
  const failureIds = setFromIds(confirmation.failurePaths);
  const edgeIds = setFromIds(confirmation.edgeCases);
  const evidenceIds = setFromIds(confirmation.evidence);
  const negIds = setFromIds(confirmation.notDone);

  failIf(!drilldown || typeof drilldown !== 'object', reasons, 'PRE_CONFIRMATION_DRILLDOWN_REQUIRED');
  failIf(!refValue(drilldown?.semanticKernelRef), reasons, 'PRE_CONFIRMATION_DRILLDOWN_REQUIRED');
  failIf(!refValue(drilldown?.mustDecompositionPacketRef), reasons, 'PRE_CONFIRMATION_DRILLDOWN_REQUIRED');
  failIf(
    resolvedDrilldownReceiptRefs(drilldown, options.criticalAuditorReceiptRefs).length < 3,
    reasons,
    'CRITICAL_AUDITOR_THREE_ROUNDS_REQUIRED'
  );
  failIf(!reconciliationRef(drilldown) || !reconciliationPassed(drilldown), reasons, 'PACKET_SOURCE_RECONCILIATION_REQUIRED');
  failIf(!preRenderGateRef(drilldown), reasons, 'PRE_RENDER_GATE_REPORT_REQUIRED');
  failIf(
    architectureConfirmationRequired(confirmation) &&
      !architectureConfirmationActiveForCurrentHashes(record, sourceHash, confirmationHash),
    reasons,
    'ARCHITECTURE_CONFIRMATION_REQUIRED'
  );

  failIf(taskRows.length === 0, reasons, 'ATOMIC_TASK_LINEAGE_REQUIRED');
  failIf(!confirmation.mustToAtomicTaskMap || typeof confirmation.mustToAtomicTaskMap !== 'object', reasons, 'ATOMIC_TASK_LINEAGE_REQUIRED');
  failIf(!confirmation.atomicTaskToTraceMap || typeof confirmation.atomicTaskToTraceMap !== 'object', reasons, 'ATOMIC_TASK_LINEAGE_REQUIRED');
  failIf(strings(requiredMaps).some((field) => !confirmation[field]), reasons, 'ATOMIC_TASK_LINEAGE_REQUIRED');

  failIf(!applicability || typeof applicability !== 'object', reasons, 'MISSING_APPLICABILITY_DECLARATION');
  failIf(applicability?.aiTddContractGate?.applies !== true, reasons, 'AI_TDD_APPLICABILITY_REQUIRED');
  failIf(applicability?.currentTargetMap?.applies !== true, reasons, 'CURRENT_TARGET_MAP_APPLICABILITY_REQUIRED');
  failIf(!manifest || typeof manifest !== 'object' || manifest.applies !== true, reasons, 'AI_TDD_MANIFEST_REQUIRED');
  for (const section of [
    'preConfirmationDrilldownInputs',
    'atomicImplementationTaskLineage',
    'errorCaseCoverage',
    'commandTargets',
    'traceClosureAssertions',
    'currentTargetMap',
    'canonicalSurfaceReconciliation',
    'legacyDenial',
    'finalGateMatrix',
    'executionLoopProtocol',
    'semanticGapPolicy',
    'hostExecutionHints',
    'closeoutProof',
    'evidenceTrustStates',
  ]) {
    failIf(!requiredSections.includes(section), reasons, `MANIFEST_SECTION_REQUIRED:${section}`);
  }
  failIf(!manifest?.finalGateMatrix, reasons, 'FINAL_GATE_MATRIX_REQUIRED');
  failIf(!manifest?.executionLoopProtocol, reasons, 'EXECUTION_LOOP_PROTOCOL_REQUIRED');
  failIf(!manifest?.semanticGapPolicy, reasons, 'SEMANTIC_GAP_POLICY_REQUIRED');
  failIf(!manifest?.hostExecutionHints, reasons, 'HOST_EXECUTION_HINTS_REQUIRED');
  failIf(!confirmation.currentTargetMap, reasons, 'CURRENT_TARGET_MAP_REQUIRED');
  failIf(objects(confirmation.acceptanceTests).length === 0, reasons, 'ACCEPTANCE_TESTS_REQUIRED');
  failIf(objects(confirmation.e2eSuites).length === 0, reasons, 'E2E_SUITES_REQUIRED');

  failIf(objects(confirmation.failurePaths).length === 0, reasons, 'ERROR_CASE_COVERAGE_REQUIRED');
  failIf(objects(confirmation.edgeCases).length === 0, reasons, 'ERROR_CASE_COVERAGE_REQUIRED');
  for (const row of traceRows) {
    const rowId = String(row.id ?? 'TRACE-UNKNOWN');
    failIf(strings(row.acceptanceRefs).length === 0, reasons, `ACCEPTANCE_BINDING_REQUIRED:${rowId}`);
    failIf(strings(row.failurePathRefs).length === 0, reasons, `FAILURE_PATH_BINDING_REQUIRED:${rowId}`);
    failIf(strings(row.edgeCaseRefs).length === 0, reasons, `EDGE_CASE_BINDING_REQUIRED:${rowId}`);
    for (const ref of strings(row.acceptanceRefs)) {
      failIf(!acceptanceIds.has(ref), reasons, `TRACE_ACCEPTANCE_REF_INVALID:${rowId}:${ref}`);
    }
    for (const ref of strings(row.failurePathRefs)) {
      failIf(!failureIds.has(ref), reasons, `TRACE_FAILURE_REF_INVALID:${rowId}:${ref}`);
    }
    for (const ref of strings(row.edgeCaseRefs)) {
      failIf(!edgeIds.has(ref), reasons, `TRACE_EDGE_REF_INVALID:${rowId}:${ref}`);
    }
  }
  for (const row of acceptanceRows) {
    const rowId = String(row.id ?? 'ACC-UNKNOWN');
    failIf(row.expectedPreImplementationState !== 'expected_red', reasons, `PRE_IMPLEMENTATION_RED_PROOF_PLAN_REQUIRED:${rowId}`);
    failIf(!String(row.redProofPlan ?? '').trim(), reasons, `PRE_IMPLEMENTATION_RED_PROOF_PLAN_REQUIRED:${rowId}`);
    for (const ref of strings(row.failurePathRefs)) {
      failIf(!failureIds.has(ref), reasons, `ACCEPTANCE_FAILURE_REF_INVALID:${rowId}:${ref}`);
    }
    for (const ref of strings(row.edgeCaseRefs)) {
      failIf(!edgeIds.has(ref), reasons, `ACCEPTANCE_EDGE_REF_INVALID:${rowId}:${ref}`);
    }
  }

  for (const row of [...objects(confirmation.must), ...objects(confirmation.notDone)]) {
    const rowId = String(row.id);
    const closure = requirementClosureFor(confirmation, rowId);
    failIf(closure.traceRows.length === 0, reasons, `REQUIREMENT_COVERAGE_INCOMPLETE:${rowId}:TRACE`);
    failIf(!hasAny(row.evidenceRefs) && closure.evidenceRows.length === 0, reasons, `REQUIREMENT_COVERAGE_INCOMPLETE:${rowId}:EVD`);
    failIf(closure.acceptanceRows.length === 0, reasons, `REQUIREMENT_COVERAGE_INCOMPLETE:${rowId}:ACC_OR_E2E`);
    failIf(closure.commandRows.length === 0, reasons, `REQUIREMENT_COVERAGE_INCOMPLETE:${rowId}:CMD`);
  }

  for (const row of objects(confirmation.failurePaths)) {
    const rowId = String(row.id);
    failIf(!strings(row.linkedNegIds).some((id) => negIds.has(id)), reasons, `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:NEG`);
    failIf(!strings(row.linkedEvidenceIds).some((id) => evidenceIds.has(id)), reasons, `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:EVD`);
    failIf(!traceRows.some((trace) => strings(trace.failurePathRefs).includes(rowId)), reasons, `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:TRACE`);
    failIf(!acceptanceRows.some((acceptance) => strings(acceptance.failurePathRefs).includes(rowId)), reasons, `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:ACC_OR_E2E`);
  }
  for (const row of objects(confirmation.edgeCases)) {
    const rowId = String(row.id);
    failIf(
      !strings(row.linkedFailurePathIds).some((id) => failureIds.has(id)),
      reasons,
      `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:FAIL`
    );
    failIf(!strings(row.linkedEvidenceIds).some((id) => evidenceIds.has(id)), reasons, `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:EVD`);
    failIf(!traceRows.some((trace) => strings(trace.edgeCaseRefs).includes(rowId)), reasons, `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:TRACE`);
    failIf(!acceptanceRows.some((acceptance) => strings(acceptance.edgeCaseRefs).includes(rowId)), reasons, `ERROR_CASE_CLOSURE_INCOMPLETE:${rowId}:ACC_OR_E2E`);
  }

  for (const row of objects(confirmation.targetModificationPaths)) {
    if (isValidationOnlyTarget(row)) continue;
    const rowId = String(row.id ?? row.path ?? 'TARGET-MOD-UNKNOWN');
    failIf(!hasAny(row.traceRows) && !hasAny(row.traceRefs), reasons, `TARGET_MODIFICATION_TRACE_BINDING_REQUIRED:${rowId}`);
    failIf(!hasAny(row.evidenceRefs), reasons, `TARGET_MODIFICATION_EVIDENCE_BINDING_REQUIRED:${rowId}`);
  }

  const allowedAuthorities = strings(manifest?.closeoutProof?.allowedAuthorities);
  const invalidAuthorities = new Set([
    'audit_receipt_json',
    'completion_packet_self_certification',
    'exitCode_only',
    'stdout_only',
    'prompt_text',
    'goal_completion',
    'continuation_text',
    'stale_attempt',
    'mock_only',
    'smoke_only',
  ]);
  for (const authority of allowedAuthorities) {
    failIf(invalidAuthorities.has(authority), reasons, `INVALID_CLOSEOUT_PROOF_POLICY:${authority}`);
  }
  failIf(!record.controlStore || typeof record.controlStore !== 'object', reasons, 'CONTROL_STORE_NOT_READY');

  return unique(reasons);
}

function normalizeRefPath(sourcePath, ref) {
  const value = String(ref ?? '').trim();
  if (!value) return value;
  if (path.isAbsolute(value)) return normalizePathSafe(value);
  return normalizePathSafe(path.resolve(path.dirname(path.resolve(sourcePath)), value));
}

function normalizePathSafe(file) {
  return file.split(path.sep).join('/');
}

function targetModificationPathValue(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.path ?? row.targetPath ?? row.file ?? row.glob ?? '').trim();
}

function isValidationOnlyTarget(row) {
  if (!row || typeof row !== 'object') return false;
  return [row.changeType, row.coverageRole].some(
    (value) => String(value ?? '').trim().toLowerCase() === 'validation_only'
  );
}

function deriveAllowedWriteScope(confirmation) {
  const directTargets = Array.isArray(confirmation.targetModificationPaths)
    ? confirmation.targetModificationPaths.flatMap((item) =>
        typeof item === 'string'
          ? [item]
          : isValidationOnlyTarget(item)
            ? []
            : [targetModificationPathValue(item)].filter(Boolean)
      )
    : [];
  const taskTargets = objects(confirmation.atomicImplementationTaskList).flatMap((task) =>
    Array.isArray(task.targetModificationPaths)
      ? task.targetModificationPaths.flatMap((item) =>
          typeof item === 'string'
            ? [item]
            : isValidationOnlyTarget(item)
              ? []
              : [targetModificationPathValue(item)].filter(Boolean)
        )
      : []
  );
  return unique([...directTargets, ...taskTargets])
    .map((item) => normalizePathSafe(item))
    .filter(Boolean);
}

function optionalArtifactRef(sourcePath, ref) {
  const normalized = normalizeRefPath(sourcePath, ref);
  if (!normalized) return null;
  const diskPath = path.resolve(normalized);
  if (!fs.existsSync(diskPath)) return { ref, path: normalized, exists: false };
  const content = readText(diskPath);
  return { ref, path: normalized, exists: true, contentHash: sha256(content) };
}

function compilerInputContext(args) {
  if (args.sourceFile) {
    throw new BlockedInput(
      'BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT',
      'Conversation-only requirements must first be written into an implementation source document with implementationConfirmation.status=draft and then explicitly confirmed by the user.'
    );
  }
  const sourcePath = args.sourceDocument || args.contract;
  const canonicalContext = resolveCanonicalConfirmedContext(args, sourcePath);
  if (canonicalContext) {
    const confirmation = validateConfirmation({
      implementationConfirmation: canonicalContext.confirmation,
    });
    enforceNoOutDirGoalLength(args, confirmation);
    validateRequiredCommandDefinitions(confirmation);
    const registry = commandRegistry(confirmation);
    validateCommandReferences(confirmation, registry);
    const gates = parseCommands(confirmation, args.finalGate, registry);
    if (gates.length === 0) {
      throw new BlockedInput(
        'BLOCK: FINAL_GATES_REQUIRED',
        'Final gate commands must be derived from confirmed requiredCommands or --final-gate before PASS.'
      );
    }
    return {
      ...canonicalContext,
      confirmation,
      registry,
      gates,
      executionDisciplineProfile: validateExecutionDisciplineProfile(
        readOptionalJson(args.executionDisciplineProfileRef)
      ),
    };
  }
  const sourceText = readText(sourcePath);
  const blockText = extractConfirmationBlock(sourceText);
  const parsed = parseConfirmation(blockText);
  const confirmationCandidate = parsed.implementationConfirmation;
  validateTypedSourceFormat(sourceText, confirmationCandidate);
  if (!args.requirementRecord) {
    validateConfirmation(parsed, null);
  }
  const recordValidation = validateRequirementRecord(args, sourceText, blockText, confirmationCandidate);
  enforceNoOutDirGoalLength(args, confirmationCandidate);
  const driftClassification = classifyConfirmationDrift({
    confirmation: confirmationCandidate,
    requirementRecord: recordValidation.record,
    renderReport: null,
    currentHashes: {
      sourceDocumentHash: recordValidation.sourceDocumentHash,
      implementationConfirmationHash: recordValidation.implementationConfirmationHash,
    },
  });
  const confirmation = validateConfirmation(parsed, driftClassification);
  validateRequiredCommandDefinitions(confirmation);
  const registry = commandRegistry(confirmation);
  validateCommandReferences(confirmation, registry);
  const gates = parseCommands(confirmation, args.finalGate, registry);
  if (gates.length === 0) {
    throw new BlockedInput(
      'BLOCK: FINAL_GATES_REQUIRED',
      'Final gate commands must be derived from implementationConfirmation.requiredCommands, closeoutReadinessPreview.requiredCommands, evidence, or --final-gate before PASS.'
    );
  }
  const executionDisciplineProfile = validateExecutionDisciplineProfile(
    readOptionalJson(args.executionDisciplineProfileRef)
  );
  const criticalAuditorReceiptRefs = governedCriticalAuditorReceiptRefs(
    args.requirementRecord,
    recordValidation.record,
    recordValidation.sourceDocumentHash,
    recordValidation.implementationConfirmationHash
  );
  return {
    sourcePath,
    sourceText,
    blockText,
    confirmation,
    record: recordValidation.record,
    latestConfirmationEvent: recordValidation.event,
    sourceDocumentHash: recordValidation.sourceDocumentHash,
    implementationConfirmationHash: recordValidation.implementationConfirmationHash,
    confirmationHashAuthority: recordValidation.confirmationHashAuthority,
    registry,
    gates,
    executionDisciplineProfile,
    criticalAuditorReceiptRefs,
  };
}

function validateExecutionDisciplineProfile(profile) {
  if (!profile) return null;
  const blockingReasons = [];
  if (String(profile.authority ?? '') !== 'discipline_profile_only') {
    blockingReasons.push('EXECUTION_DISCIPLINE_PROFILE_AUTHORITY_INVALID');
  }
  const declaredHash = String(profile.profileHash ?? '').trim();
  const computedHash = profileHashFor(profile);
  if (!declaredHash) {
    blockingReasons.push('EXECUTION_DISCIPLINE_PROFILE_HASH_MISSING');
  } else if (declaredHash !== computedHash) {
    blockingReasons.push('EXECUTION_DISCIPLINE_PROFILE_HASH_MISMATCH');
  }
  const forbiddenFields = [
    'traceRows',
    'covers',
    'requiredCommands',
    'taskList',
    'section7Tasks',
    'legacyPromptBody',
    'sourcePathAuthority',
  ];
  const scan = (value, prefix = '') => {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) return value.flatMap((item, index) => scan(item, `${prefix}[${index}]`));
    return Object.entries(value).flatMap(([key, item]) => {
      const current = prefix ? `${prefix}.${key}` : key;
      const own = forbiddenFields.includes(key) ? [current] : [];
      return [...own, ...scan(item, current)];
    });
  };
  const forbidden = scan(profile);
  blockingReasons.push(...forbidden.map((field) => `EXECUTION_DISCIPLINE_PROFILE_FORBIDDEN_FIELD:${field}`));
  if (blockingReasons.length > 0) {
    throw new BlockedInput(
      `BLOCK: ${blockingReasons[0]}`,
      `Execution discipline profile validation failed: ${blockingReasons.join(', ')}`
    );
  }
  return {
    profileId: String(profile.profileId ?? ''),
    profileHash: declaredHash,
    flow: String(profile.flow ?? ''),
    authority: String(profile.authority ?? ''),
    dimensionContractSelector: String(profile.dimensionContractSelector ?? ''),
    sourceReferences: strings(profile.sourceReferences),
    rules: strings(profile.rules),
    requiredEvidence: strings(profile.requiredEvidence),
    forbiddenOverrides: strings(profile.forbiddenOverrides),
  };
}

function buildTraceSlices(confirmation) {
  const acceptance = objectById(confirmation.acceptanceTests);
  const e2e = objectById(confirmation.e2eSuites);
  const mustIds = ids(confirmation.must);
  const notDoneIds = ids(confirmation.notDone);
  return objects(confirmation.traceRows).map((row) => {
    const acceptanceRefs = strings(row.acceptanceRefs);
    const tddRows = acceptanceRefs.map((ref) => acceptance.get(ref) ?? e2e.get(ref)).filter(Boolean);
    return {
      ...(confirmation.typedSourceAuthority ? row : {}),
      traceId: String(row.id ?? 'TRACE-UNKNOWN'),
      covers: strings(row.covers),
      requirementRefs: strings(row.covers).filter((id) => confirmation.typedSourceAuthority
        ? mustIds.has(id) : String(id).startsWith('MUST-')),
      negativeRequirementRefs: strings(row.covers).filter((id) => confirmation.typedSourceAuthority
        ? notDoneIds.has(id) : !String(id).startsWith('MUST-')),
      taskRefs: strings(row.taskRefs),
      evidenceRefs: strings(row.evidenceRefs),
      acceptanceRefs,
      e2eRefs: strings(row.e2eRefs).length > 0 ? strings(row.e2eRefs) : acceptanceRefs.filter((id) => String(id).startsWith('E2E-')),
      failurePathRefs: strings(row.failurePathRefs),
      edgeCaseRefs: strings(row.edgeCaseRefs),
      commandRefs: unique([
        ...strings(row.contractValidationCommandRefs),
        ...strings(row.deliveryEvidenceCommandRefs),
      ]),
      deliveryCommandRefs: strings(row.deliveryEvidenceCommandRefs),
      artifactRefs: strings(row.artifactRefs),
      targetModificationPaths: strings(row.targetModificationPaths),
      currentTargetMapRefs: strings(row.currentTargetMapRefs),
      canonicalSurfaceRefs: strings(row.canonicalSurfaceRefs),
      legacyDenialRefs: strings(row.legacyDenialRefs),
      expectedRedProofs: strings(row.expectedRedProofs),
      greenExitCriteria: row.greenExitCriteria ?? '',
      refactorGuards: row.refactorGuards ?? '',
      allowedRuntimeWrites: strings(row.allowedRuntimeWrites),
      forbiddenProofTypes: strings(row.forbiddenProofTypes),
      tddProtocol: {
        states: ['RED', 'GREEN', 'REFACTOR', 'CLOSEOUT'],
        redRequiredBeforeGreen: true,
        expectedPreImplementationState: 'expected_red',
        redProofPlans: tddRows.map((item) => ({
          id: item.id,
          redProofPlan: item.redProofPlan,
          oracle: item.oracle,
        })),
        unexpectedGreenAction: 'block_and_investigate_before_green',
        currentAttemptEvidenceRequired: true,
      },
    };
  });
}

function buildPreConfirmationDrilldown(sourcePath, confirmation, governedReceiptRefs = []) {
  const drilldown = confirmation.preConfirmationDrilldown ?? {};
  return {
    ...drilldown,
    semanticKernel: optionalArtifactRef(sourcePath, refValue(drilldown.semanticKernelRef)),
    mustDecompositionPacket: optionalArtifactRef(sourcePath, refValue(drilldown.mustDecompositionPacketRef)),
    reconciliationReport: optionalArtifactRef(sourcePath, reconciliationRef(drilldown)),
    preRenderGateReport: optionalArtifactRef(sourcePath, preRenderGateRef(drilldown)),
    criticalAuditorReceipts: resolvedDrilldownReceiptRefs(drilldown, governedReceiptRefs).map(
      (ref) => optionalArtifactRef(sourcePath, ref)
    ),
    artifactProofPolicy: 'input_lineage_only_not_delivery_or_closeout_proof',
  };
}

function goalObjectiveFromHints(hints, recordId) {
  return String(
    hints?.goalObjectiveTemplate ??
      hints?.codexCapable?.goalObjectiveTemplate ??
      `Execute ${recordId} confirmed traceRows until governed evidence closeout or semantic gap reconfirm_required.`
  );
}

function normalizeHostExecutionHints(rawHints, recordId) {
  const hints = rawHints && typeof rawHints === 'object' ? rawHints : {};
  const legacyGoalAllowed =
    typeof hints.codexCapable?.goalModeAllowed === 'boolean'
      ? hints.codexCapable.goalModeAllowed
      : undefined;
  const legacyObjective = goalObjectiveFromHints(hints.codexCapable ?? hints, recordId);
  const legacyNonCodex = String(
    hints.nonCodex?.instruction ??
      'Use model_packet.json as execution authority; continue repair/rerun loops without goal-mode commands.'
  ).replace(/\/goal/gu, 'goal-mode');

  return {
    ...hints,
    codex: {
      strategy: 'goal_if_available_else_continue_nonstop',
      goalModeAllowed: hints.codex?.goalModeAllowed ?? legacyGoalAllowed ?? true,
      goalObjectiveTemplate: goalObjectiveFromHints(hints.codex ?? hints.codexCapable, recordId),
      fallbackDirective: hints.codex?.fallbackDirective ?? 'continue nonstop',
      ...(hints.codex ?? {}),
    },
    claudeCode: {
      strategy: 'goal_if_available_else_prompt_loop',
      goalModeAllowed: hints.claudeCode?.goalModeAllowed ?? legacyGoalAllowed ?? true,
      goalObjectiveTemplate: goalObjectiveFromHints(hints.claudeCode ?? hints.codexCapable, recordId),
      fallbackDirective:
        hints.claudeCode?.fallbackDirective ??
        'Continue autonomously until all final gates pass or semantic gap requires reconfirm_required.',
      ...(hints.claudeCode ?? {}),
    },
    cursorIde: {
      strategy: 'agent_panel_autonomous_prompt',
      nativeGoalCommandAvailable: false,
      preferredSurface: 'Cursor IDE Agent mode',
      fallbackDirective:
        hints.cursorIde?.fallbackDirective ??
        'Continue autonomously within Cursor IDE Agent mode until all final gates pass or semantic gap requires reconfirm_required.',
      ...(hints.cursorIde ?? {}),
    },
    cursorCli: {
      strategy: 'headless_command_with_external_supervisor_loop',
      nativeGoalCommandAvailable: false,
      preferredCommandTemplate:
        hints.cursorCli?.preferredCommandTemplate ??
        'cursor-agent -p --force --output-format stream-json <prompt>',
      externalSupervisorRequired: true,
      fallbackDirective: hints.cursorCli?.fallbackDirective ?? legacyNonCodex,
      ...(hints.cursorCli ?? {}),
    },
    generic: {
      strategy: 'prompt_contract_only',
      fallbackDirective:
        hints.generic?.fallbackDirective ??
        'Continue until all final gates pass or semantic gap requires reconfirm_required.',
      ...(hints.generic ?? {}),
    },
  };
}

function buildModelPacket(context, args) {
  const confirmation = context.confirmation;
  validateConfirmedTypedSource(confirmation);
  const sourceLabel = args.sourceLabel || displayPath(context.sourcePath);
  const manifest = confirmation.aiTddContractExecutionManifestProjection ?? {};
  const recordId = context.record.recordId ?? confirmation.recordId ?? 'unknown';
  const packetId = args.packetId || recordId;
  const taskReportPath = args.taskReportPath ? normalizePathSafe(path.resolve(args.taskReportPath)) : '';
  const allowedWriteScope = deriveAllowedWriteScope(confirmation);
  const hostExecutionHints = normalizeHostExecutionHints(manifest.hostExecutionHints, recordId);
  const controlledExecutionContext = controlledExecutionContextFromArgs(args);
  const requiredCommands = objects(confirmation.requiredCommands).map((command) =>
    controlledExecutionContext
      ? controlledRequiredCommandDescriptor(confirmation, command, args)
        : {
          ...(confirmation.typedSourceAuthority ? command : {}),
          id: commandId(command),
          command: commandText(command),
          traceRows: strings(command.traceRows),
          evidenceRefs: strings(command.evidenceRefs),
          oracle: command.oracle ?? command.purpose ?? '',
        }
  );
  const contractExecutionManifest = buildDerivedContractExecutionManifest({
    confirmation,
    manifest: {
      ...manifest,
      currentTargetMap: confirmation.currentTargetMap,
      canonicalSurfaceReconciliation: manifest.canonicalSurfaceReconciliation ?? {
        source: 'implementationConfirmation.currentTargetMap.canonicalArtifacts',
        canonicalArtifacts: objects(confirmation.currentTargetMap?.canonicalArtifacts),
      },
      hostExecutionHints,
    },
    record: context.record,
    sourcePath: normalizePathSafe(path.resolve(context.sourcePath)),
    recordPath: normalizePathSafe(path.resolve(args.requirementRecord)),
    sourceDocumentHash: context.sourceDocumentHash,
    implementationConfirmationHash: context.implementationConfirmationHash,
    confirmationHashAuthority: context.confirmationHashAuthority,
  });
  return {
    schemaVersion: confirmation.typedSourceAuthority
      ? 'req-trace-ai-tdd-model-packet/v2' : 'req-trace-ai-tdd-model-packet/v1',
    ...(confirmation.typedSourceAuthority ? {
      typedSourceAuthority: confirmation.typedSourceAuthority,
      typedCoverage: {
        schemaVersion: 'requirements-contract-typed-source-coverage-ref/v2',
        graphHash: confirmation.typedCoverage.graphHash,
        coverageHash: confirmation.typedCoverage.coverageHash,
      },
      boundaryViews: objects(confirmation.boundaryViews),
    } : {}),
    artifactRole: 'execution_authority',
    ...entryMetadata(args),
    recordId,
    packetId,
    sourceDocument: sourceLabel,
    sourceDocumentHash: context.sourceDocumentHash,
    implementationConfirmationHash: context.implementationConfirmationHash,
    requirementRecordPath: normalizePathSafe(path.resolve(args.requirementRecord)),
    latestConfirmationEvent: {
      eventType: context.latestConfirmationEvent.eventType,
      confirmedAt: context.latestConfirmationEvent.confirmedAt,
      confirmationPageHash: context.latestConfirmationEvent.confirmationPageHash,
    },
    authorityPolicy: {
      primaryAuthority: 'model_packet.json',
      humanPromptRole: 'projection_only',
      auditReceiptRole: 'generator_self_audit_only_not_delivery_proof',
      sourceTraceMutationPolicy: 'confirmed_source_traceRows_status_must_not_be_rewritten',
    },
    sharedGoalCompilation: context.sharedGoalCompilation,
    executionDisciplineProfile: context.executionDisciplineProfile,
    traceOrder: objects(confirmation.traceRows).map((row) => String(row.id)),
    traceSlices: buildTraceSlices(confirmation),
    atomicImplementationTaskList: objects(confirmation.atomicImplementationTaskList),
    mustToAtomicTaskMap: confirmation.mustToAtomicTaskMap,
    atomicTaskToTraceMap: confirmation.atomicTaskToTraceMap,
    requirements: {
      must: objects(confirmation.must),
      notDone: objects(confirmation.notDone),
      mustNot: objects(confirmation.mustNot),
      evidence: objects(confirmation.evidence),
    },
    errorCaseCoverage: {
      failurePaths: objects(confirmation.failurePaths),
      edgeCases: objects(confirmation.edgeCases),
      acceptanceTests: objects(confirmation.acceptanceTests),
      e2eSuites: objects(confirmation.e2eSuites),
    },
    runtimeWritePolicy: {
      sourceTraceRowsWritable: false,
      sourceEvidenceWritable: false,
      requirementRecordRequired: true,
      allowedRuntimeWriteTargets: [
        'executionIterations',
        'requirementClosures',
        'gateChecks',
        'contractChecks',
        'deliveryEvidence.requiredCommands',
        'artifactIndex',
      ],
      missingEvidenceBehavior: 'remain_open_or_record_MISSING_EVIDENCE',
    },
    executionHandoff: {
      packetId,
      taskReportPath,
      allowedWriteScope,
      taskReportSchema:
        'TaskReport schema: { packetId, status, filesChanged, validationsRun, evidence, downstreamContext, driftFlags? }',
      ...(controlledExecutionContext
        ? { requiredValidationCommandRefs: requiredCommands.map((command) => command.id) }
        : {
            requiredValidationCommands: objects(confirmation.requiredCommands).map((command) => ({
              id: commandId(command),
              command: commandText(command),
            })),
          }),
      completionEvidenceFields: [
        'packetId',
        'status',
        'filesChanged',
        'validationsRun',
        'evidence',
        'downstreamContext',
        'driftFlags?',
      ],
      stopConditions: [
        'reconfirm_required_on_semantic_gap',
        'scope_expansion_requires_reconfirmation',
        'validation_unavailable_requires_blocked_TaskReport',
        'write_strict_TaskReport_before_returning_to_main_agent',
      ],
    },
    preConfirmationDrilldown: buildPreConfirmationDrilldown(
      context.sourcePath,
      confirmation,
      context.criticalAuditorReceiptRefs
    ),
    contractExecutionManifest,
    ...(controlledExecutionContext ? { controlledExecutionContext } : {}),
    requiredCommands,
    finalGateMatrix: manifest.finalGateMatrix,
    executionLoopProtocol: manifest.executionLoopProtocol,
    semanticGapPolicy: manifest.semanticGapPolicy,
    hostExecutionHints,
    blockingDecisionTable: [
      { code: 'SEMANTIC_GAP_RECONFIRM_REQUIRED', action: 'halt_for_reconfirmation', source: 'semanticGapPolicy' },
      { code: 'NON_SEMANTIC_GAP_REPAIR_AND_RERUN', action: 'repair_and_rerun_same_trace_slice', source: 'semanticGapPolicy' },
      { code: 'FINAL_GATE_MATRIX_BLOCKED', action: 'continue_repair_loop', source: 'finalGateMatrix' },
      { code: 'INVALID_PROOF_TYPE', action: 'block_closeout', source: 'closeoutProof' },
    ],
    completionEvidencePacketSchema: {
      artifactRole: 'evidence_index_only_not_closeout_authority',
      requiredFields: ['closedIds', 'openIds', 'commandResults', 'e2eEvidence', 'auditEvidence', 'residualRisks', 'scopeChanges'],
      forbiddenAuthorities: manifest.closeoutProof?.forbiddenAuthorities ?? [],
    },
    proofBoundary: {
      notDeliveryProof: ['model_packet.json', 'human_prompt.txt', 'audit_receipt.json', 'exitCode_0', 'stdout', 'goal_completion'],
      closeoutAuthorities: manifest.closeoutProof?.allowedAuthorities ?? [
        'AI_TDD_gate_report',
        'delivery_verification_report',
        'closeout_integrity_report',
      ],
    },
  };
}

function compactTypedPacketForPublication(packet) {
  if (packet.schemaVersion !== 'req-trace-ai-tdd-model-packet/v2') return packet;
  const { requiredCommands, errorCaseCoverage, ...compact } = packet;
  return {
    ...compact,
    projectionRefs: {
      requiredCommands: 'contractExecutionManifest.requiredCommands',
      errorCaseCoverage: 'contractExecutionManifest.errorCaseCoverage',
      acceptanceTests: 'contractExecutionManifest.acceptanceTests',
      e2eSuites: 'contractExecutionManifest.e2eSuites',
    },
  };
}

function normalizeExecutionHost(executionHost) {
  const host = executionHost || 'codex';
  if (host === 'cursor') return { host: 'cursor-ide', aliasUsed: 'cursor' };
  if (host === 'claude') return { host: 'claude-code', aliasUsed: 'claude' };
  return { host, aliasUsed: null };
}

function resolvePromptLanguage(confirmation, args) {
  if (args.promptLanguage && args.promptLanguage !== 'auto') return args.promptLanguage;
  return confirmation.promptLanguage || confirmation.confirmationLanguage || 'zh-CN';
}

function goalCommandLength(text) {
  return Array.from(String(text ?? '')).length;
}

function goalCommandFromPayload(payload) {
  return `/goal ${payload}`;
}

function goalCommandMeta(mode, commandText, extra = {}) {
  return {
    mode,
    chars: goalCommandLength(commandText),
    maxChars: GOAL_COMMAND_MAX_CHARS,
    safeMaxChars: GOAL_COMMAND_SAFE_MAX_CHARS,
    ...extra,
  };
}

function goalDocumentRefPayload(packet, artifactPaths) {
  return `Execute ${packet.recordId} by following ${artifactPaths.goalDocument}; use ${artifactPaths.modelPacket} as authority; stop only on final pass or reconfirm_required.`;
}

function buildGoalDirective(packet, hints, artifactPaths) {
  const inlinePayload = goalObjectiveFromHints(hints, packet.recordId);
  const inlineCommand = goalCommandFromPayload(inlinePayload);
  const inlineChars = goalCommandLength(inlineCommand);

  if (!artifactPaths?.goalDocument || !artifactPaths?.modelPacket) {
    throw new BlockedInput(
      'BLOCK: GOAL_DOCUMENT_REQUIRED',
      `Native /goal requires --out-dir so ${GOAL_DOCUMENT_FILENAME} and model_packet.json can be written and referenced; refusing to emit a short goal-only objective.`
    );
  }

  const documentPayload = goalDocumentRefPayload(packet, artifactPaths);
  const documentCommand = goalCommandFromPayload(documentPayload);
  const documentChars = goalCommandLength(documentCommand);
  if (documentChars > GOAL_COMMAND_MAX_CHARS) {
    throw new BlockedInput(
      'BLOCK: GOAL_COMMAND_TOO_LONG',
      `/goal document reference command is ${documentChars} chars, exceeding hard limit ${GOAL_COMMAND_MAX_CHARS}.`
    );
  }
  return {
    directive: documentCommand,
    goalCommand: goalCommandMeta('native_goal_document_ref', documentCommand, {
      originalInlineChars: inlineChars,
      documentPath: artifactPaths.goalDocument,
      documentHash: null,
      taskReportPath: packet.executionHandoff?.taskReportPath || null,
      packetId: packet.packetId,
      recordId: packet.recordId,
    }),
  };
}

function fallbackGoalCommandMeta(directive) {
  return goalCommandMeta('fallback_prompt_contract', directive, {
    documentPath: null,
    documentHash: null,
  });
}

function buildHostContinuationDirective(packet, args, artifactPaths = {}) {
  const { host, aliasUsed } = normalizeExecutionHost(args.executionHost);
  const hints = packet.hostExecutionHints ?? {};
  const goalAvailable = args.goalCommandAvailable === 'true';

  if (host === 'codex') {
    const codex = hints.codex ?? {};
    if (goalAvailable && codex.goalModeAllowed === true) {
      const goalDirective = buildGoalDirective(packet, codex, artifactPaths);
      return {
        host,
        aliasUsed,
        strategy: 'goal_if_available_else_continue_nonstop',
        nativeGoalCommandUsed: true,
        directive: goalDirective.directive,
        goalCommand: goalDirective.goalCommand,
        proofText: '/goal completion',
      };
    }
    const directive = codex.fallbackDirective ?? 'continue nonstop';
    return {
      host,
      aliasUsed,
      strategy: 'goal_if_available_else_continue_nonstop',
      nativeGoalCommandUsed: false,
      directive,
      goalCommand: fallbackGoalCommandMeta(directive),
      proofText: goalAvailable ? '/goal completion' : 'prompt completion',
    };
  }

  if (host === 'claude-code') {
    const claude = hints.claudeCode ?? {};
    if (goalAvailable && claude.goalModeAllowed === true) {
      const goalDirective = buildGoalDirective(packet, claude, artifactPaths);
      return {
        host,
        aliasUsed,
        strategy: 'goal_if_available_else_prompt_loop',
        nativeGoalCommandUsed: true,
        directive: goalDirective.directive,
        cliCommand: `claude -p --permission-mode auto --output-format stream-json "${goalDirective.directive}"`,
        goalCommand: goalDirective.goalCommand,
        proofText: '/goal completion',
      };
    }
    const directive =
      claude.fallbackDirective ??
      'Continue autonomously until all final gates pass or semantic gap requires reconfirm_required.';
    return {
      host,
      aliasUsed,
      strategy: 'goal_if_available_else_prompt_loop',
      nativeGoalCommandUsed: false,
      directive,
      cliCommand: 'claude -p --permission-mode auto --output-format stream-json "<full prompt>"',
      goalCommand: fallbackGoalCommandMeta(directive),
      proofText: 'prompt completion',
    };
  }

  if (host === 'cursor-ide') {
    const cursorIde = hints.cursorIde ?? {};
    return {
      host,
      aliasUsed,
      strategy: 'agent_panel_autonomous_prompt',
      nativeGoalCommandUsed: false,
      directive:
        cursorIde.fallbackDirective ??
        'Continue autonomously within Cursor IDE Agent mode until all final gates pass or semantic gap requires reconfirm_required.',
      userInstruction:
        'Open Cursor IDE Agent mode, paste this full prompt, and allow the Agent to continue repairing and rerunning gates until all final gates pass or a semantic gap requires reconfirm_required.',
      goalCommand: fallbackGoalCommandMeta(cursorIde.fallbackDirective ?? 'Cursor IDE Agent mode prompt contract'),
      proofText: 'Cursor Agent prompt completion',
    };
  }

  if (host === 'cursor-cli') {
    const cursorCli = hints.cursorCli ?? {};
    return {
      host,
      aliasUsed,
      strategy: 'headless_command_with_external_supervisor_loop',
      nativeGoalCommandUsed: false,
      directive:
        'Use cursor-agent headless automation only with an external deterministic supervisor loop; do not treat cursor-agent output as closeout proof.',
      cliCommand: cursorCli.preferredCommandTemplate ?? 'cursor-agent -p --force --output-format stream-json <prompt>',
      externalSupervisorLoop: [
        'Run cursor-agent with the full prompt.',
        'Run deterministic gates from model_packet.json.',
        'If final gates pass, stop.',
        'If a semantic gap is detected, mark reconfirm_required and stop.',
        'If only non-semantic failures remain, run a repair continuation prompt and rerun the same trace slice.',
      ],
      goalCommand: fallbackGoalCommandMeta(cursorCli.fallbackDirective ?? 'cursor-agent external supervisor loop contract'),
      proofText: 'cursor-agent output',
    };
  }

  const generic = hints.generic ?? {};
  const directive = generic.fallbackDirective ?? 'Continue until all final gates pass or semantic gap requires reconfirm_required.';
  return {
    host: 'generic',
    aliasUsed,
    strategy: 'prompt_contract_only',
    nativeGoalCommandUsed: false,
    directive,
    goalCommand: fallbackGoalCommandMeta(directive),
    proofText: 'prompt completion',
  };
}

function enforceNoOutDirGoalLength(args, confirmation) {
  if (args.goalCommandAvailable !== 'true') return;
  if (args.outDir) return;
  const { host } = normalizeExecutionHost(args.executionHost);
  if (host !== 'codex' && host !== 'claude-code') return;
  const manifest = confirmation.aiTddContractExecutionManifestProjection ?? {};
  const hints = normalizeHostExecutionHints(manifest.hostExecutionHints, confirmation.recordId ?? 'unknown');
  const hostHints = host === 'codex' ? hints.codex : hints.claudeCode;
  if (hostHints?.goalModeAllowed !== true) return;
  throw new BlockedInput(
    'BLOCK: GOAL_DOCUMENT_REQUIRED',
    `Native /goal requires --out-dir so ${GOAL_DOCUMENT_FILENAME} and model_packet.json can be written and referenced; rerun with --out-dir or set --goal-command-available false to emit a non-goal full prompt.`
  );
}

function renderSharedGoalExecutionDocument(packet, artifactPaths, sharedGoalProjection) {
  const markdown = sharedGoalProjection?.markdown;
  const contractBodyHash = sharedGoalProjection?.bytesHash;
  if (
    typeof markdown !== 'string' ||
    !SHA256_REF_PATTERN.test(String(contractBodyHash)) ||
    sha256(markdown) !== contractBodyHash
  ) {
    throw new BlockedInput(
      'BLOCK: SHARED_GOAL_PROJECTION_HASH_MISMATCH',
      'Native goal rendering requires the exact hash-bound shared compiler projection.'
    );
  }
  const contractBodyLengthBytes = Buffer.byteLength(markdown, 'utf8');
  const envelopePayload = {
    schemaVersion: 'goal-execution-projection-envelope/v1',
    contractBodyRef: {
      kind: 'shared_confirmed_requirements_goal_projection',
      hash: contractBodyHash,
      lengthBytes: contractBodyLengthBytes,
    },
    modelPacketRef: { path: artifactPaths.modelPacket },
    taskReportRef: { path: packet.executionHandoff?.taskReportPath || null },
    sourceAuthorityRef: {
      recordId: packet.recordId,
      sourceDocumentHash: packet.sourceDocumentHash,
    },
  };
  const envelope = `<!-- goal-execution-projection-envelope/v1\n${stableStringify(
    envelopePayload
  )}\n-->\n`;
  const document = `${envelope}${markdown}`;
  const contractBodyOffsetBytes = Buffer.byteLength(envelope, 'utf8');
  const documentBytes = Buffer.from(document, 'utf8');
  const bodyBytes = documentBytes.subarray(
    contractBodyOffsetBytes,
    contractBodyOffsetBytes + contractBodyLengthBytes
  );
  if (sha256(bodyBytes) !== contractBodyHash || bodyBytes.toString('utf8') !== markdown) {
    throw new BlockedInput(
      'BLOCK: SHARED_GOAL_PROJECTION_COMPOSITION_MISMATCH',
      'The emitted native goal document does not preserve the shared projection as its only contract body.'
    );
  }
  return {
    document,
    binding: Object.freeze({
      schemaVersion: 'GoalExecutionProjectionDocumentRef/v1',
      compositionRecipe: 'utf8_concat(envelope,contractBody)',
      contractBodyHash,
      contractBodyOffsetBytes,
      contractBodyLengthBytes,
      envelopeHash: sha256(envelope),
      documentHash: sha256(documentBytes),
    }),
  };
}

function ensureGoalDocumentPrepared(
  args,
  promptMeta,
  packet,
  artifactPaths,
  outputs,
  outputHashes,
  sharedGoalProjection
) {
  if (promptMeta.hostDirective.goalCommand?.mode !== 'native_goal_document_ref') {
    promptMeta.goalDocumentAudit = { fragments: [], missing: [], passed: true };
    promptMeta.goalContractTemplate = null;
    return;
  }
  const goalDocumentResult = renderSharedGoalExecutionDocument(
    packet,
    artifactPaths,
    sharedGoalProjection
  );
  const goalDocument = goalDocumentResult.document;
  const goalDocumentHash = goalDocumentResult.binding.documentHash;
  packet.sharedGoalCompilation = Object.freeze({
    ...packet.sharedGoalCompilation,
    goalExecutionDocumentRef: goalDocumentResult.binding,
  });
  promptMeta.hostDirective.goalCommand.documentHash = goalDocumentHash;
  promptMeta.hostDirective.goalCommand.taskReportPath = packet.executionHandoff?.taskReportPath || null;
  promptMeta.hostDirective.goalCommand.packetId = packet.packetId;
  promptMeta.hostDirective.goalCommand.recordId = packet.recordId;
  packet.executionHandoff.goalExecutionPath = artifactPaths.goalDocument;
  packet.executionHandoff.goalExecutionHash = goalDocumentHash;
  packet.executionHandoff.modelPacketPath = artifactPaths.modelPacket;
  packet.executionHandoff.returnAction = 'import-native-goal-task-report';
  packet.executionHandoff.resumeAction = 'import-native-goal-task-report';
  packet.executionHandoff.ingestPolicy = 'strict_task_report_controlled_ingest';
  promptMeta.goalDocumentAudit = auditGoalDocument(goalDocument);
  promptMeta.goalContractTemplate = {
    schemaVersion: 'GoalExecutionProjectionEnvelopeAudit/v1',
    compatibilityDecision: promptMeta.goalDocumentAudit.passed ? 'pass' : 'blocked',
    sharedProjectionHash: goalDocumentResult.binding.contractBodyHash,
    envelopeHash: goalDocumentResult.binding.envelopeHash,
    documentHash: goalDocumentHash,
  };
  outputs.goalDocument = artifactPaths.goalDocument;
  outputHashes.sharedGoalProjectionHash = goalDocumentResult.binding.contractBodyHash;
  outputHashes.goalDocumentEnvelopeHash = goalDocumentResult.binding.envelopeHash;
  outputHashes.goalDocumentHash = goalDocumentHash;
  return goalDocument;
}

function renderTraceSliceRows(packet) {
  return packet.traceSlices
    .map(
      (row) => `${row.traceId}
covers: ${row.covers.join(', ') || '(none)'}
evidenceRefs: ${row.evidenceRefs.join(', ') || '(none)'}
taskRefs: ${row.taskRefs.join(', ') || '(none)'}
acceptanceRefs: ${row.acceptanceRefs.join(', ') || '(none)'}
e2eRefs: ${row.e2eRefs.join(', ') || '(none)'}
failurePathRefs: ${row.failurePathRefs.join(', ') || '(none)'}
edgeCaseRefs: ${row.edgeCaseRefs.join(', ') || '(none)'}
required command refs: ${row.commandRefs.join(', ') || '(none)'}
delivery command refs: ${row.deliveryCommandRefs.join(', ') || '(none)'}
artifactRefs: ${row.artifactRefs.join(', ') || '(none)'}`
    )
    .join('\n\n');
}

function renderAtomicRows(packet) {
  return packet.atomicImplementationTaskList
    .map((task) => `- ${task.id}: ${task.title ?? ''} -> traces=${strings(task.traceRefs).join(', ')}`)
    .join('\n');
}

function renderPacketRequiredCommands(packet) {
  const requiredCommands = packetRequiredCommands(packet);
  if (!requiredCommands.length) return '(none)';
  return requiredCommands
    .map(
      (command) => `${command.id}:
${command.command}
traceRows: ${command.traceRows.join(', ') || '(none)'}
evidenceRefs: ${command.evidenceRefs.join(', ') || '(none)'}
oracle: ${command.oracle || '(none)'}`
    )
    .join('\n\n');
}

function renderHostDirectiveText(directive) {
  const lines = [`Continuation strategy: ${directive.strategy}`, directive.directive];
  if (directive.goalCommand?.mode === 'native_goal_document_ref') {
    lines.push('The /goal command is an entry pointer only, not the full task scope.');
    lines.push(
      'The /goal command is the execution entrypoint for Codex and Claude Code CLI native goal mode.'
    );
    lines.push('Execution scope is goal_execution.md + model_packet.json.');
  }
  if (directive.userInstruction) lines.push(`User surface: ${directive.userInstruction}`);
  if (directive.cliCommand) lines.push(`CLI command: ${directive.cliCommand}`);
  if (directive.externalSupervisorLoop) {
    lines.push('External supervisor loop:');
    directive.externalSupervisorLoop.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }
  return lines.join('\n');
}

function renderExecutionDisciplineProfile(profile) {
  if (!profile) return 'Execution Discipline Profile: none';
  return `Execution Discipline Profile:
profileId: ${profile.profileId}
profileHash: ${profile.profileHash}
authority: ${profile.authority}
flow: ${profile.flow}
dimensionContractSelector: ${profile.dimensionContractSelector}
requiredEvidence: ${profile.requiredEvidence.join(', ') || '(none)'}
rules:
${profile.rules.map((rule) => `- ${rule}`).join('\n') || '- (none)'}`;
}

function languageLabels(language) {
  if (language === 'en-US') {
    return {
      task: 'Task',
      start: 'Start now and do not stop until final acceptance closes or a real blocker is reached.',
      scope: 'Scope and intent lock',
      rules: 'Mandatory execution rules',
    };
  }
  if (language === 'bilingual') {
    return {
      task: '任务 / Task',
      start:
        '现在开始执行，不要等待中途确认，直到最终验收闭环或触发真实阻塞条件。 / Start now and do not stop until final acceptance closes or a real blocker is reached.',
      scope: '范围与意图锁定 / Scope and intent lock',
      rules: '强制执行规则 / Mandatory execution rules',
    };
  }
  return {
    task: '任务',
    start: '现在开始执行，不要等待中途确认，直到最终验收闭环或触发真实阻塞条件。',
    scope: '范围与意图锁定',
    rules: '强制执行规则',
  };
}

function renderCommitRule(args, language = 'zh-CN') {
  const autoCommitEnabled = args.autoCommit && !args.noAutoCommit;
  const zhRule = autoCommitEnabled
    ? '改为 PASS 后立即本地提交一次，禁止 push。若源文档或用户指定 commit message 格式，严格使用该格式；否则使用仓库提交规范。'
    : '不要自动提交；只有用户明确要求提交时才提交，并且禁止 push。';
  const enRule = autoCommitEnabled
    ? 'After PASS, create one local commit immediately and never push. Use the source document or user-specified commit message format when present; otherwise use the repository convention.'
    : 'Do not commit automatically. Commit only when the user explicitly requests it, and never push.';
  if (language === 'en-US') return enRule;
  if (language === 'bilingual') return `${zhRule} / ${enRule}`;
  return zhRule;
}

function renderFullHumanPromptFromPacket(packet, args, hostDirective, language) {
  const labels = languageLabels(language);
  const sourceAuthority = `${packet.sourceDocument}#implementationConfirmation`;
  return `${SKILL_LINE}

${renderHostDirectiveText(hostDirective)}

${renderExecutionDisciplineProfile(packet.executionDisciplineProfile)}

${labels.task}: Strictly execute confirmed traceRows from ${sourceAuthority} until governed evidence closeout or semantic gap reconfirm_required.

Source of authority:
Only ${sourceAuthority} is authoritative.
Primary authority: model_packet.json.
model_packet.json is the machine-readable execution authority.
Human prompt role: projection-only over model_packet.json. Do not introduce requirements absent from the packet.
Do not implement prose, diagrams, or conversation content unless it is referenced by implementationConfirmation IDs.

Trace closure authority:
confirmed source traceRows are contract projection only.
Runtime closure authority is the requirement-record/control store: record closure evidence through executionIterations, requirementClosures, gateChecks, contractChecks, deliveryEvidence.requiredCommands, artifactIndex, or project-equivalent governed fields.
The executor must not rewrite confirmed source traceRows.status or source evidence fields to represent runtime PASS/MISSING_EVIDENCE.

Trace order:
${packet.traceOrder.join(' -> ')}

Atomic implementation task lineage:
${renderAtomicRows(packet)}

Trace slices:
${renderTraceSliceRows(packet)}

Required commands:
${renderPacketRequiredCommands(packet)}

AI-TDD protocol:
Use RED -> GREEN -> REFACTOR -> CLOSEOUT per trace slice. RED proof must precede GREEN when expectedPreImplementationState is expected_red. Unexpected GREEN must be blocked and investigated before closeout.

Runtime write policy:
Allowed runtime write targets: ${packet.runtimeWritePolicy.allowedRuntimeWriteTargets.join(', ')}.
Source traceRows writable: ${packet.runtimeWritePolicy.sourceTraceRowsWritable}.
Missing evidence behavior: ${packet.runtimeWritePolicy.missingEvidenceBehavior}.

Semantic gap policy:
semantic gaps -> reconfirm_required.
non-semantic execution gaps -> repair_and_rerun_same_trace_slice.

Final gate matrix:
Stop only when all required current-attempt gates pass, including AI-TDD gate, delivery verification, closeout integrity, and post-closeout review when applicable.
Required final authorities: ${packet.proofBoundary.closeoutAuthorities.join(', ')}.

Commit policy:
${renderCommitRule(args, language)}

${labels.scope}:
1. Only implement IDs present in model_packet.json and confirmed implementationConfirmation projections.
2. Do not reduce, replace, reinterpret, or shrink confirmed scope.
3. No MVP downgrade, stub, mock-only, happy-path-only, representative-only, later-batch, seed-only, or partial sample proof may close a requirement.

${labels.rules}:
1. Use traceRows as the only primary execution slices and follow the declared Trace order.
2. Each trace slice may close only its referenced covers, evidenceRefs, taskRefs, acceptanceRefs, failurePathRefs, edgeCaseRefs, and required command refs.
3. taskRefs completion does not equal requirement PASS.
4. PASS requires evidence for covered must, notDone, and evidence IDs.
5. Every trace slice must record governed runtime closure evidence in the requirement-record/control store.
6. Without evidence, runtime closure must remain open/PENDING or record MISSING_EVIDENCE.
7. If implementation requires semantic changes to must/notDone/mustNot/evidence/failurePaths/edgeCases/traceRows/acceptanceTests/e2eSuites/requiredCommands/currentTargetMap/aiTddContractExecutionManifestProjection, set reconfirm_required and stop.
8. On non-semantic gate failure, repair and rerun the same trace slice until it passes or a semantic gap is proven.
9. Final closeout requires deterministic current-attempt gate evidence; ${hostDirective.proofText}, stdout, exitCode=0, prompt completion, and audit_receipt.json are not closeout authorities.

Proof boundary:
audit_receipt.json is generator self-audit only and not delivery or closeout proof.
Not delivery proof: ${packet.proofBoundary.notDeliveryProof.join(', ')}.
Closeout authorities: ${packet.proofBoundary.closeoutAuthorities.join(', ')}.
Confirmed source traceRows.status must not be rewritten as runtime PASS or MISSING_EVIDENCE.

Completion Evidence Packet:
artifactRole: ${packet.completionEvidencePacketSchema.artifactRole}
requiredFields: ${packet.completionEvidencePacketSchema.requiredFields.join(', ')}
forbiddenAuthorities: ${packet.completionEvidencePacketSchema.forbiddenAuthorities.join(', ') || '(none)'}

${labels.start}
`;
}

function renderCompactHumanPromptFromPacket(packet, args, hostDirective, language) {
  const sourceAuthority = `${packet.sourceDocument}#implementationConfirmation`;
  return `${SKILL_LINE}

${renderHostDirectiveText(hostDirective)}

${renderExecutionDisciplineProfile(packet.executionDisciplineProfile)}

Only ${sourceAuthority} is authoritative. model_packet.json is the machine-readable execution authority.
Human prompt role: projection-only over model_packet.json. Do not introduce requirements absent from the packet.
Trace order: ${packet.traceOrder.join(' -> ')}
Required commands: ${packetRequiredCommands(packet).map((command) => command.id).join(', ') || '(none)'}
confirmed source traceRows are contract projection only.
Runtime closure authority is the requirement-record/control store.
PASS requires evidence for covered must, notDone, and evidence IDs.
Missing evidence remains open/PENDING or MISSING_EVIDENCE.
Semantic gaps require reconfirm_required; non-semantic failures require repair and rerun.
Commit policy: ${renderCommitRule(args, language)}
Completion Evidence Packet must include ${packet.completionEvidencePacketSchema.requiredFields.join(', ')}.
Full details are in model_packet.json.
`;
}

function renderHumanPromptFromPacket(packet, args, context) {
  const language = resolvePromptLanguage(context.confirmation, args);
  const hostDirective = buildHostContinuationDirective(packet, args, context.artifactPaths);
  const profile = args.humanPromptProfile || 'full';
  const prompt = (
    profile === 'compact'
      ? renderCompactHumanPromptFromPacket(packet, args, hostDirective, language)
      : renderFullHumanPromptFromPacket(packet, args, hostDirective, language)
  ) + renderTypedSourceAuthorityProtocol(packet);
  const audit = auditHumanPrompt(prompt, packet.sourceDocument, profile);
  return { prompt, language, profile, hostDirective, audit };
}

function renderTypedSourceAuthorityProtocol(packet) {
  if (!packet.typedSourceAuthority) return '';
  const { GOAL_SEMANTIC_DICTIONARY_PROTOCOL } = requireBmadSpeckit(
    'dist/utils/goal-contract/control-plane/goal-semantic-dictionary.js'
  );
  return `\n\nTyped source authority:\nRead model_packet.json#/typedSourceAuthority in full; graphHash=${packet.typedSourceAuthority.graphHash}.
Resolve model_packet.json#/typedCoverage from the complete typedSourceAuthority graph and verify coverageHash=${packet.typedCoverage.coverageHash}.
The complete decoded source graph is confirmed authority, including every non-action requirement, boundary, condition, scope and relation.
Do not treat the legacy action list as the full requirement set or turn non-action nodes into invented tasks.
Typed authority or coverage changes require reconfirm_required; unsupported v2 readers must stop.
${GOAL_SEMANTIC_DICTIONARY_PROTOCOL}\n`;
}

function receiptHashFor(receipt) {
  const clone = { ...receipt };
  delete clone.receiptHash;
  return sha256(stableStringify(clone));
}

function manifestAliasBlockingReasons(packet) {
  return strings(packet?.contractExecutionManifest?.aliasAudit?.blockingReasons);
}

function validateCanonicalAuthorityContext(context) {
  const reasons = [];
  const authority = context.confirmationHashAuthority ?? {};
  if (authority.recipe !== 'canonical_confirmed_requirements_authority/v1') {
    reasons.push('CANONICAL_CONFIRMED_AUTHORITY_REQUIRED');
  }
  if (context.record?.lifecycle !== 'user_confirmed') {
    reasons.push('CANONICAL_CONFIRMED_LIFECYCLE_INVALID');
  }
  if (context.latestConfirmationEvent?.eventType !== 'confirmation_recorded') {
    reasons.push('CANONICAL_CONFIRMATION_EVENT_INVALID');
  }
  if (
    authority.finalMarkdownHash !== context.sourceDocumentHash ||
    authority.implementationConfirmationHash !== context.implementationConfirmationHash
  ) {
    reasons.push('CANONICAL_CONFIRMED_HASH_BINDING_INVALID');
  }
  return reasons;
}

function buildPassReceipt(args, context, packet, outputHashes, outputs, promptMeta) {
  const validationReasons = [
    ...typedPacketValidation(packet, undefined, context.confirmation),
    ...(context.authorityMode === 'canonical_record'
      ? validateCanonicalAuthorityContext(context)
      : validateCompilerContract(context.confirmation, context.record, {
          criticalAuditorReceiptRefs: context.criticalAuditorReceiptRefs,
        })),
    ...promptMeta.audit.missing.map((fragment) => `HUMAN_PROMPT_REQUIRED_FRAGMENT_MISSING:${fragment}`),
    ...(promptMeta.goalDocumentAudit?.missing ?? []).map(
      (fragment) => `GOAL_DOCUMENT_REQUIRED_FRAGMENT_MISSING:${fragment}`
    ),
  ];
  const receipt = {
    schemaVersion: packet.typedSourceAuthority
      ? 'req-trace-ai-tdd-compiler-audit-receipt/v2' : 'req-trace-ai-tdd-compiler-audit-receipt/v1',
    ...(packet.typedSourceAuthority ? {
      typedSourceAuthorityHash: packet.typedSourceAuthority.graphHash,
      typedCoverageHash: packet.typedCoverage.coverageHash,
    } : {}),
    ...entryMetadata(args),
    recordId: packet.recordId,
    decision: validationReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: validationReasons,
    sourceDocumentHash: context.sourceDocumentHash,
    implementationConfirmationHash: context.implementationConfirmationHash,
    confirmationHashAuthority: context.confirmationHashAuthority,
    createdBy: 'req-trace-matrix-prompt-generator',
    createdAt: new Date().toISOString(),
    inputRefs: {
      sourceDocument: normalizePathSafe(path.resolve(context.sourcePath)),
      requirementRecord: normalizePathSafe(path.resolve(args.requirementRecord)),
    },
    inputValidation: {
      sourceConfirmed: context.confirmation.status === 'user_confirmed',
      requirementRecordConfirmed: context.latestConfirmationEvent.eventType === 'confirmation_recorded',
      hashesMatch: true,
      commandReferencesValid: true,
      preConfirmationDrilldownPassed: validationReasons.every((reason) => !reason.includes('DRILLDOWN') && !reason.includes('GATE') && !reason.includes('RECONCILIATION')),
      aiTddManifestComplete: validationReasons.every((reason) => !reason.startsWith('MANIFEST_SECTION_REQUIRED') && reason !== 'AI_TDD_MANIFEST_REQUIRED'),
      atomicTaskLineageComplete: !validationReasons.includes('ATOMIC_TASK_LINEAGE_REQUIRED'),
      finalGateMatrixPresent: !validationReasons.includes('FINAL_GATE_MATRIX_REQUIRED'),
      semanticGapPolicyPresent: !validationReasons.includes('SEMANTIC_GAP_POLICY_REQUIRED'),
    },
    executionHost: promptMeta.hostDirective.host,
    executionHostAliasUsed: promptMeta.hostDirective.aliasUsed,
    humanPromptProfile: promptMeta.profile,
    humanPromptLanguage: promptMeta.language,
    continuationDirective: {
      strategy: promptMeta.hostDirective.strategy,
      nativeGoalCommandUsed: promptMeta.hostDirective.nativeGoalCommandUsed,
      directive: promptMeta.hostDirective.directive,
      cliCommand: promptMeta.hostDirective.cliCommand,
      externalSupervisorRequired: Boolean(promptMeta.hostDirective.externalSupervisorLoop),
    },
    goalCommand: promptMeta.hostDirective.goalCommand,
    goalExecutionPath:
      promptMeta.hostDirective.goalCommand?.mode === 'native_goal_document_ref'
        ? outputs.goalDocument ?? null
        : null,
    goalExecutionHash:
      promptMeta.hostDirective.goalCommand?.mode === 'native_goal_document_ref'
        ? outputHashes.goalDocumentHash ?? null
        : null,
    mainAgentHandoff:
      promptMeta.hostDirective.goalCommand?.mode === 'native_goal_document_ref'
        ? {
            recordId: packet.recordId,
            packetId: packet.packetId,
            modelPacketPath: outputs.modelPacket,
            goalExecutionPath: outputs.goalDocument ?? null,
            goalExecutionHash: outputHashes.goalDocumentHash ?? null,
            taskReportPath: packet.executionHandoff?.taskReportPath || null,
            returnAction: 'import-native-goal-task-report',
          }
        : null,
    humanPromptRequiredFragmentsPassed: promptMeta.audit.passed,
    humanPromptRequiredFragments: promptMeta.audit.fragments,
    humanPromptMissingRequiredFragments: promptMeta.audit.missing,
    goalDocumentRequiredFragmentsPassed: promptMeta.goalDocumentAudit?.passed ?? null,
    goalDocumentRequiredFragments: promptMeta.goalDocumentAudit?.fragments ?? [],
    goalDocumentMissingRequiredFragments: promptMeta.goalDocumentAudit?.missing ?? [],
    goalContractTemplate: promptMeta.goalContractTemplate,
    executionDisciplineProfile: packet.executionDisciplineProfile
      ? {
          profileId: packet.executionDisciplineProfile.profileId,
          profileHash: packet.executionDisciplineProfile.profileHash,
          authority: packet.executionDisciplineProfile.authority,
          flow: packet.executionDisciplineProfile.flow,
          humanPromptProfileRendered: promptMeta.prompt.includes(packet.executionDisciplineProfile.profileHash),
          goalExecutionProfileRendered:
            promptMeta.hostDirective.goalCommand?.mode === 'native_goal_document_ref'
              ? promptMeta.goalDocumentAudit?.passed === true
              : null,
        }
      : null,
    coverageLedger: {
      traceRows: packet.traceOrder,
      atomicTasks: packet.atomicImplementationTaskList.map((task) => task.id),
      mustIds: packet.requirements.must.map((item) => item.id),
      evidenceIds: packet.requirements.evidence.map((item) => item.id),
      requiredManifestSections: packet.contractExecutionManifest.requiredSections,
    },
    contractExecutionManifest: {
      schemaVersion: packet.contractExecutionManifest.schemaVersion,
      builderVersion: packet.contractExecutionManifest.builderVersion,
      manifestHash: packet.contractExecutionManifest.manifestHash,
      sourceProjectionHash: packet.contractExecutionManifest.sourceProjectionHash,
      aliasAudit: packet.contractExecutionManifest.aliasAudit,
    },
    sharedGoalCompilation: packet.sharedGoalCompilation,
    outputs,
    outputHashes,
    proofBoundary: packet.proofBoundary,
  };
  receipt.receiptHash = receiptHashFor(receipt);
  return receipt;
}

function buildBlockedReceipt(args, context, blockingReasons, message, extra = {}) {
  const recordId = context?.record?.recordId ?? context?.confirmation?.recordId ?? 'unknown';
  const receipt = {
    schemaVersion: 'req-trace-ai-tdd-compiler-audit-receipt/v1',
    ...entryMetadata(args),
    recordId,
    decision: 'blocked',
    blockingReasons: unique(blockingReasons),
    message,
    sourceDocumentHash: context?.sourceDocumentHash ?? null,
    implementationConfirmationHash: context?.implementationConfirmationHash ?? null,
    createdBy: 'req-trace-matrix-prompt-generator',
    createdAt: new Date().toISOString(),
    inputRefs: {
      sourceDocument: args.sourceDocument || args.contract || args.sourceFile || null,
      requirementRecord: args.requirementRecord || null,
    },
    inputValidation: {
      sourceConfirmed: context?.confirmation?.status === 'user_confirmed',
      requirementRecordConfirmed: context?.latestConfirmationEvent?.eventType === 'confirmation_recorded',
      preConfirmationDrilldownPassed: false,
      aiTddManifestComplete: false,
      atomicTaskLineageComplete: false,
    },
    ...extra,
    outputs: {},
    outputHashes: {},
    proofBoundary: {
      auditReceiptRole: 'generator_self_audit_only_not_delivery_proof',
    },
  };
  receipt.receiptHash = receiptHashFor(receipt);
  return receipt;
}

function compileArtifacts(args) {
  let context;
  const outDir = path.resolve(args.outDir);
  try {
    resolveCompilerEntryProfile(args);
    context = compilerInputContext(args);
    const blockingReasons = context.authorityMode === 'canonical_record'
      ? validateCanonicalAuthorityContext(context)
      : validateCompilerContract(context.confirmation, context.record, {
          criticalAuditorReceiptRefs: context.criticalAuditorReceiptRefs,
        });
    if (blockingReasons.length > 0) {
      const receipt = buildBlockedReceipt(
        args,
        context,
        blockingReasons,
        'Compiler contract validation failed before writing execution packet artifacts.'
      );
      const auditReceipt = publishBlockedReceipt(outDir, receipt);
      return {
        status: 3,
        summary: {
          decision: 'blocked',
          blockingReasons,
          outputs: { auditReceipt },
          outputHashes: { auditReceiptHash: sha256(serializeArtifactJson(receipt)) },
        },
      };
    }

    context.sharedGoalCompilation = compileSharedConfirmedRequirementsGoal(context, args);
    const packet = buildModelPacket(context, args);
    const aliasBlockingReasons = manifestAliasBlockingReasons(packet);
    if (aliasBlockingReasons.length > 0) {
      const receipt = buildBlockedReceipt(
        args,
        context,
        aliasBlockingReasons,
        'ContractExecutionManifest alias audit failed before writing execution packet artifacts.',
        {
          contractExecutionManifest: {
            aliasAudit: packet.contractExecutionManifest.aliasAudit,
          },
        }
      );
      const auditReceipt = publishBlockedReceipt(outDir, receipt);
      return {
        status: 3,
        summary: {
          decision: 'blocked',
          blockingReasons: receipt.blockingReasons,
          outputs: { auditReceipt },
          outputHashes: { auditReceiptHash: sha256(serializeArtifactJson(receipt)) },
        },
      };
    }

    const packetPath = path.join(outDir, 'model_packet.json');
    const promptPath = path.join(outDir, 'human_prompt.txt');
    const receiptPath = path.join(outDir, 'audit_receipt.json');
    const goalDocumentPath = path.join(outDir, GOAL_DOCUMENT_FILENAME);
    context.artifactPaths = {
      modelPacket: normalizePathSafe(packetPath),
      humanPrompt: normalizePathSafe(promptPath),
      auditReceipt: normalizePathSafe(receiptPath),
      goalDocument: normalizePathSafe(goalDocumentPath),
      goalDocumentDiskPath: goalDocumentPath,
    };
    const promptMeta = renderHumanPromptFromPacket(packet, args, context);

    const outputs = {
      modelPacket: normalizePathSafe(packetPath),
      humanPrompt: normalizePathSafe(promptPath),
      auditReceipt: normalizePathSafe(receiptPath),
    };
    const outputHashes = { humanPromptHash: sha256(promptMeta.prompt) };
    const goalDocument = ensureGoalDocumentPrepared(
      args,
      promptMeta,
      packet,
      context.artifactPaths,
      outputs,
      outputHashes,
      context.sharedGoalProjection
    );
    const publishedPacket = compactTypedPacketForPublication(packet);
    const packetContent = `${stableStringify(publishedPacket)}\n`;
    outputHashes.modelPacketHash = sha256(packetContent);
    if (
      promptMeta.hostDirective.goalCommand?.mode === 'native_goal_document_ref' &&
      !outputHashes.goalDocumentHash
    ) {
      throw new BlockedInput(
        'BLOCK: GOAL_EXECUTION_REF_NOT_BOUND',
        'goal_execution.md was generated without binding goalExecutionHash to audit_receipt.json.'
      );
    }
    const receipt = buildPassReceipt(args, context, publishedPacket, outputHashes, outputs, promptMeta);
    if (receipt.decision !== 'pass') {
      const auditReceipt = publishBlockedReceipt(outDir, buildBlockedReceipt(
        args, context, receipt.blockingReasons, 'Rendered artifact validation failed before publication.'
      ));
      return { status: 3, summary: { decision: 'blocked', blockingReasons: receipt.blockingReasons,
        outputs: { auditReceipt }, outputHashes: { auditReceiptHash: sha256(readText(auditReceipt)) } } };
    }
    const artifacts = {
      ...(goalDocument === undefined ? {} : { [goalDocumentPath]: goalDocument }),
      [promptPath]: promptMeta.prompt,
      [packetPath]: packetContent,
    };
    receipt.payloadBudgets = checkArtifactBudgets({ ...artifacts,
      'contract_execution_manifest.json': serializeArtifactJson(packet.contractExecutionManifest) }, context);
    receipt.sourceMeasurement = { bytes: Buffer.byteLength(context.sourceText, 'utf8'),
      rawTextHash: sha256(context.sourceText), unit: 'utf8_bytes' };
    receipt.receiptHash = receiptHashFor(receipt);
    const receiptContent = serializeArtifactJson(receipt);
    artifacts[receiptPath] = receiptContent;
    const payloadBudgets = checkArtifactBudgets(artifacts, context);
    const publicationIssues = typedPacketPublicationOracle(
      publishedPacket,
      JSON.parse(receiptContent),
      context.confirmation
    );
    if (publicationIssues.length > 0) {
      throw new BlockedInput(
        'BLOCK: TYPED_SOURCE_PUBLICATION_ORACLE_FAILED',
        JSON.stringify({ issues: publicationIssues.slice(0, 50), sourceHash: context.sourceDocumentHash })
      );
    }
    try {
      publishArtifactSet(outDir, artifacts);
    } catch (error) {
      if (!String(error.code).startsWith('REQ_TRACE_PUBLICATION_')) throw error;
      throw new BlockedInput(`BLOCK: ${error.code}`, JSON.stringify({
        stage: 'artifact_publication', journalPath: error.journalPath ?? null,
        sourceHash: context.sourceDocumentHash,
      }));
    }
    outputHashes.auditReceiptHash = sha256(receiptContent);
    const summary = {
      decision: receipt.decision,
      blockingReasons: receipt.blockingReasons,
      ...entryMetadata(args),
      outputs,
      outputHashes,
      payloadBudgets,
    };
    return { status: receipt.decision === 'pass' ? 0 : 3, summary };
  } catch (error) {
    if (!(error instanceof BlockedInput)) throw error;
    const receipt = buildBlockedReceipt(args, context, [error.code.replace(/^BLOCK:\s*/u, '')], error.message);
    const auditReceipt = publishBlockedReceipt(outDir, receipt);
    return {
      status: 3,
      summary: {
        decision: 'blocked',
        blockingReasons: receipt.blockingReasons,
        outputs: { auditReceipt },
        outputHashes: { auditReceiptHash: sha256(serializeArtifactJson(receipt)) },
      },
    };
  }
}

function buildPrompt(args) {
  if (args.sourceFile) {
    throw new BlockedInput(
      'BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT',
      'Conversation-only requirements must first be written into an implementation source document with implementationConfirmation.status=draft and then explicitly confirmed by the user.'
    );
  }
  resolveCompilerEntryProfile(args);
  const context = compilerInputContext(args);
  const confirmation = context.confirmation;
  const sourceLabel = args.sourceLabel || displayPath(context.sourcePath);
  const sourceAuthority = context.authorityMode === 'canonical_record'
    ? `${sourceLabel} (confirmed semantic authority ${context.confirmationHashAuthority.semanticRevisionId})`
    : `${sourceLabel}#implementationConfirmation`;

  const traceRows = Array.isArray(confirmation.traceRows) ? confirmation.traceRows : [];
  const traceIds = traceRows.filter((row) => row?.id).map((row) => String(row.id));
  const traceText = traceIds.join(' -> ');
  const gates = context.gates;
  const prompt = `${SKILL_LINE}

continue nonstop

任务：严格执行 ${sourceAuthority} 的 confirmed traceRows，直到闭环验收完成。

Source of authority:
Only ${sourceAuthority} is authoritative.
Do not implement prose, diagrams, or conversation content unless it is referenced by implementationConfirmation IDs.

Trace order:
${traceText}

Trace closure authority:
confirmed source traceRows are contract projection only.
Runtime closure authority is the requirement-record/control store: record closure evidence through executionIterations, requirementClosures, gateChecks, contractChecks, deliveryEvidence.requiredCommands, artifactIndex, or project-equivalent governed fields.
The executor must not rewrite confirmed source traceRows.status or source evidence fields to represent runtime PASS/MISSING_EVIDENCE.

范围与意图锁定：
1. 只能实施 implementationConfirmation 中的 must/notDone/evidence/traceRows IDs，禁止实现未被确认块引用的 prose、diagram 或会话内容。
2. 禁止缩减范围、替换范围、改变原始需求、禁止把原始需求解释成更小交付。
3. 禁止 MVP downgrade、stub、mock-only、happy-path-only、representative-only coverage、later-batch coverage、seed-only coverage 或局部样例冒充完整交付。${renderExtraRules(args.extraRule)}

执行切片:
${renderTraceRows(traceRows)}

Required commands:
${renderRequiredCommands(confirmation)}
${renderSuggestedCommands(confirmation)}
强制执行规则：
1. 以 traceRows 为唯一主执行切片，按 ${traceText} 顺序推进。
2. 每个 TRACE 切片只能关闭其 covers/evidenceRefs 引用的 confirmed IDs。
3. taskRefs 完成不等于 requirement PASS。
4. PASS requires evidence for covered must, notDone, and evidence IDs.
5. 每完成一个 TRACE 切片，必须通过受控 runtime/control-store 记录 closure evidence；confirmed source traceRows.status 不得作为运行时 PASS/MISSING_EVIDENCE 回写目标。
6. ${renderCommitRule(args)}
7. 没有证据时 runtime closure 必须保持 open/PENDING 或记录 MISSING_EVIDENCE。
8. 严禁虚构验证结果、证据路径或 PASS 状态。
9. 如果需要改变 must/notDone/mustNot/evidence/traceRows 语义，必须把源文档状态改为 reconfirm_required 并停止。
10. 遇到测试失败、构建失败、审计失败、E2E 失败或 gate 失败时，自动使用 systematic-debugging 思路定位并修复；不要立刻停止询问。
11. 仅在真实阻塞时停止：缺少用户决策、需要语义变更、需要改 shared contract/schema/根配置且超出确认块、依赖无法安装或运行、外部约束与确认块冲突、或连续系统化修复后仍无法定位根因。
12. 每个 TRACE 切片结束必须运行该切片对应 gate。
13. 最终必须运行并记录结果：
${renderFinalGates(gates)}
14. 全部完成后输出 Completion Evidence Packet，至少包含关闭 IDs、开放 IDs、命令结果、E2E 证据、审计证据、残留风险和 scope changes。

现在开始执行，不要等待中途确认，直到最终验收闭环或触发真实阻塞条件。`;

  const missing = auditPrompt(prompt);
  if (missing.length > 0) {
    console.error(`Prompt audit failed. Missing fragments: ${missing.join(', ')}`);
    process.exit(2);
  }
  return prompt;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.outDir) {
      const result = compileArtifacts(args);
      if (args.json) process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
      else process.stdout.write(`${result.summary.decision.toUpperCase()}: ${JSON.stringify(result.summary)}\n`);
      return result.status;
    }
    process.stdout.write(`${buildPrompt(args)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof BlockedInput) {
      process.stdout.write(`${block(error.code, error.message)}\n`);
      return 3;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

module.exports = {
  controlledRequiredCommandDescriptor,
};

if (require.main === module) {
  process.exitCode = main();
}
