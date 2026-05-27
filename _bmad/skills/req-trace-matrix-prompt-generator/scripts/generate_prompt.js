#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('./load-js-yaml');
const {
  classifyConfirmationDrift,
  STALE_BOOKKEEPING_REPAIR_REQUIRED,
  PROJECTION_REFRESH_REQUIRED,
} = require('../../requirements-contract-authoring/scripts/confirmation_drift_classifier');

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
const GOAL_CONTRACT_TEMPLATE_PATH = '_bmad/shared/goal-contract/goal-execution-contract-template.md';
const GOAL_CONTRACT_PROFILE_PATH = '_bmad/shared/goal-contract/goal-contract-profile.json';
const GOAL_CONTRACT_RENDERER_PATH = '_bmad/shared/goal-contract/scripts/render-goal-contract.js';
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
    noAutoCommit: false,
    json: false,
    executionHost: 'codex',
    promptLanguage: 'auto',
    humanPromptProfile: 'full',
    goalCommandAvailable: 'auto',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
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
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  return sha256(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return sha256(stableStringify(semanticConfirmationForHash(confirmation)));
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
  const parsed = yaml.load(blockText);
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
  const confirmations = history.filter(
    (item) => item && typeof item === 'object' && item.eventType === 'confirmation_recorded'
  );
  if (confirmations.length === 0) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_REQUIRED',
      'requirement-record.json confirmationHistory[] has no confirmation_recorded event.'
    );
  }
  return confirmations.at(-1);
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
  const mismatches = [];

  if (event.sourceDocumentHash !== sourceHash) mismatches.push('sourceDocumentHash');
  if (event.implementationConfirmationHash !== confirmationHash) {
    mismatches.push('implementationConfirmationHash');
  }
  if (record.sourceDocumentHash && record.sourceDocumentHash !== sourceHash) {
    mismatches.push('record.sourceDocumentHash');
  }
  if (record.implementationConfirmationHash && record.implementationConfirmationHash !== confirmationHash) {
    mismatches.push('record.implementationConfirmationHash');
  }

  if (mismatches.length > 0) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH',
      `Latest confirmationHistory[] hash does not match current source document: ${mismatches.join(', ')}`
    );
  }
  return { record, event, sourceDocumentHash: sourceHash, implementationConfirmationHash: confirmationHash };
}

function ids(items) {
  if (!Array.isArray(items)) return new Set();
  return new Set(items.filter((item) => item && item.id).map((item) => String(item.id)));
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
    throw new BlockedInput('BLOCK: CONFIRMATION_REQUIRED', 'implementationConfirmation.status is not user_confirmed.');
  }

  const openQuestions = Array.isArray(confirmation.openQuestions) ? confirmation.openQuestions : [];
  if (openQuestions.some((item) => item?.blocksImplementation === true)) {
    throw new BlockedInput(
      'BLOCK: BLOCKING_QUESTIONS',
      'implementationConfirmation.openQuestions contains blocksImplementation=true.'
    );
  }

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

  return confirmation;
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

function goalDocumentAuditFragments(sourceDocument) {
  return [
    SKILL_LINE,
    `Only ${sourceDocument}#implementationConfirmation is authoritative`,
    'goalContractVersion: goal-execution-contract/v1',
    'goalContractProfileVersion:',
    'goalContractProfileHash:',
    'model_packet.json is the machine-readable execution authority',
    'goal_execution.md is not execution authority',
    '/goal completion is not closeout proof',
    'Trace order:',
    'Acceptance Traceability Matrix',
    'Required Test Commands',
    'Runtime write targets:',
    'reconfirm_required',
    'Strict Acceptance Checklist',
    'Completion Evidence Packet',
  ];
}

function auditGoalDocument(documentText, sourceDocument) {
  const fragments = goalDocumentAuditFragments(sourceDocument);
  const missing = fragments.filter((fragment) => !documentText.includes(fragment));
  return { fragments, missing, passed: missing.length === 0 };
}

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function repoPath(relativePath) {
  return path.join(repoRoot(), ...relativePath.split('/'));
}

function readGoalContractTemplate() {
  const templatePath = repoPath(GOAL_CONTRACT_TEMPLATE_PATH);
  if (!fs.existsSync(templatePath)) {
    throw new BlockedInput(
      'BLOCK: GOAL_CONTRACT_PROFILE_MISSING',
      `${GOAL_CONTRACT_TEMPLATE_PATH} is required for native /goal document rendering.`
    );
  }
  return readText(templatePath);
}

function readGoalContractProfile() {
  const profilePath = repoPath(GOAL_CONTRACT_PROFILE_PATH);
  if (!fs.existsSync(profilePath)) {
    throw new BlockedInput(
      'BLOCK: GOAL_CONTRACT_PROFILE_MISSING',
      `${GOAL_CONTRACT_PROFILE_PATH} is required for native /goal document rendering.`
    );
  }
  return readJson(profilePath);
}

function loadGoalContractRenderer() {
  const localRendererPath = path.resolve(__dirname, '..', '..', '..', 'shared', 'goal-contract', 'scripts', 'render-goal-contract.js');
  const repoRendererPath = repoPath(GOAL_CONTRACT_RENDERER_PATH);
  const rendererPath = fs.existsSync(localRendererPath) ? localRendererPath : repoRendererPath;
  if (!fs.existsSync(rendererPath)) {
    throw new BlockedInput(
      'BLOCK: GOAL_CONTRACT_PROFILE_MISSING',
      `${GOAL_CONTRACT_RENDERER_PATH} is required for native /goal document rendering.`
    );
  }
  return require(rendererPath);
}

function mapGoalContractError(error) {
  const code = String(error?.code ?? '');
  if (code === 'GOAL_CONTRACT_PROFILE_MISSING') return code;
  if (code === 'GOAL_CONTRACT_PROFILE_HASH_MISMATCH') return code;
  if (code === 'GOAL_CONTRACT_PROFILE_UNSUPPORTED') return code;
  if (code === 'GOAL_CONTRACT_INCOMPLETE') return code;
  if (/GOAL_CONTRACT_PROFILE_HASH_MISMATCH/u.test(error?.message ?? '')) return 'GOAL_CONTRACT_PROFILE_HASH_MISMATCH';
  if (/GOAL_CONTRACT_PROFILE_UNSUPPORTED/u.test(error?.message ?? '')) return 'GOAL_CONTRACT_PROFILE_UNSUPPORTED';
  return 'GOAL_CONTRACT_INCOMPLETE';
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

function validateCompilerContract(confirmation, record = {}) {
  const reasons = [];
  const manifest = confirmation.aiTddContractExecutionManifestProjection;
  const requiredSections = strings(manifest?.requiredSections);
  const drilldown = confirmation.preConfirmationDrilldown;
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
  failIf(drilldownReceiptRefs(drilldown).length < 3, reasons, 'CRITICAL_AUDITOR_THREE_ROUNDS_REQUIRED');
  failIf(!reconciliationRef(drilldown) || !reconciliationPassed(drilldown), reasons, 'PACKET_SOURCE_RECONCILIATION_REQUIRED');
  failIf(!preRenderGateRef(drilldown), reasons, 'PRE_RENDER_GATE_REPORT_REQUIRED');

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
  const sourceText = readText(sourcePath);
  const blockText = extractConfirmationBlock(sourceText);
  const parsed = parseConfirmation(blockText);
  const confirmationCandidate = parsed.implementationConfirmation;
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
  return {
    sourcePath,
    sourceText,
    blockText,
    confirmation,
    record: recordValidation.record,
    latestConfirmationEvent: recordValidation.event,
    sourceDocumentHash: recordValidation.sourceDocumentHash,
    implementationConfirmationHash: recordValidation.implementationConfirmationHash,
    registry,
    gates,
  };
}

function buildTraceSlices(confirmation) {
  const acceptance = objectById(confirmation.acceptanceTests);
  const e2e = objectById(confirmation.e2eSuites);
  return objects(confirmation.traceRows).map((row) => {
    const acceptanceRefs = strings(row.acceptanceRefs);
    const tddRows = acceptanceRefs.map((ref) => acceptance.get(ref) ?? e2e.get(ref)).filter(Boolean);
    return {
      traceId: String(row.id ?? 'TRACE-UNKNOWN'),
      covers: strings(row.covers),
      requirementRefs: strings(row.covers).filter((id) => String(id).startsWith('MUST-')),
      negativeRequirementRefs: strings(row.covers).filter((id) => !String(id).startsWith('MUST-')),
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

function buildPreConfirmationDrilldown(sourcePath, confirmation) {
  const drilldown = confirmation.preConfirmationDrilldown ?? {};
  return {
    ...drilldown,
    semanticKernel: optionalArtifactRef(sourcePath, refValue(drilldown.semanticKernelRef)),
    mustDecompositionPacket: optionalArtifactRef(sourcePath, refValue(drilldown.mustDecompositionPacketRef)),
    reconciliationReport: optionalArtifactRef(sourcePath, reconciliationRef(drilldown)),
    preRenderGateReport: optionalArtifactRef(sourcePath, preRenderGateRef(drilldown)),
    criticalAuditorReceipts: drilldownReceiptRefs(drilldown).map((ref) => optionalArtifactRef(sourcePath, ref)),
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
  const legacyGoalAllowed = hints.codexCapable?.goalModeAllowed === true;
  const legacyObjective = goalObjectiveFromHints(hints.codexCapable ?? hints, recordId);
  const legacyNonCodex = String(
    hints.nonCodex?.instruction ??
      'Use model_packet.json as execution authority; continue repair/rerun loops without goal-mode commands.'
  ).replace(/\/goal/gu, 'goal-mode');

  return {
    ...hints,
    codex: {
      strategy: 'goal_if_available_else_continue_nonstop',
      goalModeAllowed: hints.codex?.goalModeAllowed ?? legacyGoalAllowed,
      goalObjectiveTemplate: goalObjectiveFromHints(hints.codex ?? hints.codexCapable, recordId),
      fallbackDirective: hints.codex?.fallbackDirective ?? 'continue nonstop',
      ...(hints.codex ?? {}),
    },
    claudeCode: {
      strategy: 'goal_if_available_else_prompt_loop',
      goalModeAllowed: hints.claudeCode?.goalModeAllowed ?? legacyGoalAllowed,
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
  const sourceLabel = args.sourceLabel || displayPath(context.sourcePath);
  const manifest = confirmation.aiTddContractExecutionManifestProjection ?? {};
  const recordId = context.record.recordId ?? confirmation.recordId ?? 'unknown';
  const hostExecutionHints = normalizeHostExecutionHints(manifest.hostExecutionHints, recordId);
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
  });
  return {
    schemaVersion: 'req-trace-ai-tdd-model-packet/v1',
    artifactRole: 'execution_authority',
    recordId,
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
    preConfirmationDrilldown: buildPreConfirmationDrilldown(context.sourcePath, confirmation),
    contractExecutionManifest,
    requiredCommands: objects(confirmation.requiredCommands).map((command) => ({
      id: commandId(command),
      command: commandText(command),
      traceRows: strings(command.traceRows),
      evidenceRefs: strings(command.evidenceRefs),
      oracle: command.oracle ?? command.purpose ?? '',
    })),
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

function ensureGoalDocumentPrepared(promptMeta, packet, artifactPaths, outputs, outputHashes) {
  if (promptMeta.hostDirective.goalCommand?.mode !== 'native_goal_document_ref') {
    promptMeta.goalDocumentAudit = { fragments: [], missing: [], passed: true };
    promptMeta.goalContractTemplate = null;
    return;
  }
  const goalDocumentResult = renderGoalExecutionDocumentFromPacket(packet, artifactPaths);
  const goalDocument = goalDocumentResult.document;
  writeText(artifactPaths.goalDocumentDiskPath, goalDocument);
  const goalDocumentHash = sha256(readText(artifactPaths.goalDocumentDiskPath));
  promptMeta.hostDirective.goalCommand.documentHash = goalDocumentHash;
  promptMeta.goalDocumentAudit = auditGoalDocument(goalDocument, packet.sourceDocument);
  promptMeta.goalContractTemplate = goalDocumentResult.audit;
  outputs.goalDocument = artifactPaths.goalDocument;
  outputHashes.goalDocumentHash = goalDocumentHash;
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
  if (!packet.requiredCommands.length) return '(none)';
  return packet.requiredCommands
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

function renderFullHumanPromptFromPacket(packet, args, hostDirective, language) {
  const labels = languageLabels(language);
  const sourceAuthority = `${packet.sourceDocument}#implementationConfirmation`;
  return `${SKILL_LINE}

${renderHostDirectiveText(hostDirective)}

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

Only ${sourceAuthority} is authoritative. model_packet.json is the machine-readable execution authority.
Human prompt role: projection-only over model_packet.json. Do not introduce requirements absent from the packet.
Trace order: ${packet.traceOrder.join(' -> ')}
Required commands: ${packet.requiredCommands.map((command) => command.id).join(', ') || '(none)'}
confirmed source traceRows are contract projection only.
Runtime closure authority is the requirement-record/control store.
PASS requires evidence for covered must, notDone, and evidence IDs.
Missing evidence remains open/PENDING or MISSING_EVIDENCE.
Semantic gaps require reconfirm_required; non-semantic failures require repair and rerun.
Completion Evidence Packet must include ${packet.completionEvidencePacketSchema.requiredFields.join(', ')}.
Full details are in model_packet.json.
`;
}

function renderGoalFrontMatter(packet, profile, artifactPaths) {
  const sourcePlanHash = packet.sourceDocumentHash || 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  return `\`\`\`yaml
goalContractVersion: ${profile.contractVersion}
goalContractProfileVersion: ${profile.profileVersion}
goalContractProfileHash: ${profile.profileHash}
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: ${artifactPaths.modelPacket}
sourcePlanHash: ${sourcePlanHash}
runtimeRecordId: ${packet.recordId}
entryFlow: req_trace_compiled_execution
taskRange: G00-G${String(packet.traceSlices.length + 1).padStart(2, '0')}
acceptanceRange: AC-01-AC-${String(Math.max(packet.traceSlices.length, 1)).padStart(2, '0')}
completionGate: required
repairPolicy: fix_in_place
stopPolicy: stop_only_on_success_or_true_blocker
generatedBy: req-trace-matrix-prompt-generator
generatedAt: ${new Date().toISOString()}
\`\`\``;
}

function renderGoalEntry(packet, artifactPaths) {
  return `\`\`\`text
/goal Execute ${packet.recordId} by following ${artifactPaths.goalDocument}; use ${artifactPaths.modelPacket} as authority; stop only on final pass or reconfirm_required.
\`\`\``;
}

function renderGoalAuthorityModel(packet, artifactPaths) {
  const sourceAuthority = `${packet.sourceDocument}#implementationConfirmation`;
  return `${SKILL_LINE}

Source of authority:
Only ${sourceAuthority} is authoritative.
model_packet.json is the machine-readable execution authority.
goal_execution.md is not execution authority.
human_prompt.txt is a host-specific projection only.
audit_receipt.json is generator self-audit only and not delivery proof.

Authoritative artifacts:
- model_packet.json: ${artifactPaths.modelPacket}
- human_prompt.txt: ${artifactPaths.humanPrompt}
- audit_receipt.json: ${artifactPaths.auditReceipt}
- goal_execution.md: ${artifactPaths.goalDocument}

Runtime closure authority is the requirement-record/control store.
Confirmed source traceRows.status must not be rewritten as runtime PASS or MISSING_EVIDENCE.`;
}

function renderGoalRootCause(packet) {
  return `Current behavior to avoid:
- Prompt-only or goal-document-only execution can drift from the synchronized model packet.
- Generated entry text can be mistaken for closeout proof.

Required behavior:
- Execute only trace rows and IDs present in model_packet.json.
- Keep semantic gaps as reconfirm_required.
- Repair non-semantic execution gaps and rerun the same trace slice.

Failure mode to prevent:
- Do not treat goal_execution.md, human_prompt.txt, audit_receipt.json, stdout, exitCode=0, or /goal completion as delivery or closeout proof.`;
}

function renderGoalDomainAddenda(packet) {
  return `### Req-Trace Compiled Execution Contract

- Record ID: ${packet.recordId}
- Trace order: ${packet.traceOrder.join(' -> ')}
- Required manifest sections: ${packet.contractExecutionManifest.requiredSections.join(', ') || '(none)'}
- Runtime write targets: ${packet.runtimeWritePolicy.allowedRuntimeWriteTargets.join(', ')}
- Missing evidence behavior: ${packet.runtimeWritePolicy.missingEvidenceBehavior}
- Semantic gap action: reconfirm_required
- Non-semantic gap action: repair_and_rerun_same_trace_slice

AI-TDD protocol:
Use RED -> GREEN -> REFACTOR -> CLOSEOUT per trace slice. RED proof must precede GREEN when expectedPreImplementationState is expected_red. Unexpected GREEN must be blocked and investigated before closeout.

Runtime write policy:
Allowed runtime write targets: ${packet.runtimeWritePolicy.allowedRuntimeWriteTargets.join(', ')}.
Source traceRows writable: ${packet.runtimeWritePolicy.sourceTraceRowsWritable}.
Missing evidence behavior: ${packet.runtimeWritePolicy.missingEvidenceBehavior}.

Strict final acceptance checklist:
1. Execute only trace rows and IDs present in model_packet.json.
2. Do not shrink, reinterpret, or replace confirmed source scope.
3. Run required commands for every covered trace slice.
4. PASS requires evidence for covered must, notDone, and evidence IDs.
5. Missing evidence remains open/PENDING or records MISSING_EVIDENCE.
6. Write runtime closure evidence only to the requirement-record/control store or governed equivalent fields.
7. Do not rewrite confirmed source traceRows.status as runtime PASS or MISSING_EVIDENCE.
8. Final closeout requires deterministic current-attempt gate evidence.

### Proof Boundary

- /goal completion is not closeout proof.
- Not delivery proof: ${packet.proofBoundary.notDeliveryProof.join(', ')}.
- Closeout authorities: ${packet.proofBoundary.closeoutAuthorities.join(', ')}.`;
}

function renderGoalImplementationTasks(packet) {
  const traceTasks = packet.traceSlices
    .map((row, index) => {
      const taskId = `G${String(index + 1).padStart(2, '0')}`;
      return `### ${taskId} Execute ${row.traceId}

**Purpose:** Implement and close the confirmed trace slice without changing requirement semantics.

**Files:**

- Modify: only files required by model_packet.json trace and target bindings.
- Evidence: requirement-record/control store or governed equivalent runtime fields.

**Steps:**

1. Read ${row.traceId} from model_packet.json.
2. Implement only covered IDs: ${row.covers.join(', ') || '(none)'}.
3. Produce evidence for evidenceRefs: ${row.evidenceRefs.join(', ') || '(none)'}.
4. Run contract and delivery commands for this slice.
5. Record runtime closure evidence without rewriting confirmed source traceRows.status.

**Validation:**

${renderCommandsForRefs(packet, [...row.commandRefs, ...row.deliveryCommandRefs])}

**Acceptance:**

- PASS requires evidence for covered must, notDone, and evidence IDs.
- Semantic gaps stop as reconfirm_required.
- Mapped acceptance: \`AC-${String(index + 1).padStart(2, '0')}\`.`;
    })
    .join('\n\n');
  return `### G00 Baseline Packet Audit

**Purpose:** Confirm the synchronized execution packet and proof boundary before implementation.

**Files:**

- Read: model_packet.json
- Read: goal_execution.md
- Read: human_prompt.txt
- Read: audit_receipt.json
- Modify: none

**Steps:**

1. Confirm model_packet.json is present.
2. Confirm trace order is ${packet.traceOrder.join(' -> ')}.
3. Confirm goal_execution.md is not execution authority.
4. Confirm audit_receipt.json is generator self-audit only.

**Validation:**

\`\`\`powershell
Get-Content ${packet.recordId ? 'model_packet.json' : 'model_packet.json'}
\`\`\`

**Acceptance:**

- model_packet.json is the machine-readable execution authority.
- /goal completion is not closeout proof.
- Mapped acceptance: \`AC-01\`.

${traceTasks}`;
}

function renderCommandsForRefs(packet, refs) {
  const refSet = new Set(refs.filter(Boolean));
  const commands = packet.requiredCommands.filter((command) => refSet.has(command.id));
  if (commands.length === 0) return '```powershell\n# No command refs declared for this slice; use required final commands from model_packet.json.\n```';
  return commands
    .map((command) => `\`\`\`powershell\n${command.command}\n\`\`\``)
    .join('\n\n');
}

function renderGoalAcceptanceChecklist(packet) {
  return packet.traceSlices
    .map((row, index) => {
      const acId = `AC-${String(index + 1).padStart(2, '0')}`;
      return `- [ ] \`${acId}\` ${row.traceId} has governed evidence for covers ${row.covers.join(', ') || '(none)'} and evidenceRefs ${row.evidenceRefs.join(', ') || '(none)'}.`;
    })
    .join('\n');
}

function renderGoalAcceptanceMatrix(packet) {
  const rows = packet.traceSlices
    .map((row, index) => {
      const acId = `AC-${String(index + 1).padStart(2, '0')}`;
      const commands = [...row.commandRefs, ...row.deliveryCommandRefs].join(', ') || '(none)';
      return `| ${acId} | Close ${row.traceId} with trace, evidence, runtime write policy, and closeout authority respected. | G${String(index + 1).padStart(2, '0')} | \`${commands}\` |`;
    })
    .join('\n');
  return `| AC ID | Requirement | Owning Task | Evidence Command |
| --- | --- | --- | --- |
${rows}`;
}

function renderGoalRequiredCommands(packet) {
  return packet.requiredCommands
    .map((command) => `\`\`\`powershell\n${command.command}\n\`\`\``)
    .join('\n\n');
}

function renderGoalManualScenarios(packet) {
  return `### Scenario A: Confirmed Packet Happy Path

- Setup: Valid model_packet.json for ${packet.recordId}.
- Expected: Execute every trace row and required command until final gates pass.
- Forbidden: Treat goal_execution.md as machine-readable execution authority.

### Scenario B: Semantic Gap

- Setup: Implementation requires changing confirmed must/notDone/mustNot/evidence/traceRows semantics.
- Expected: Stop with reconfirm_required.
- Forbidden: Shrink or reinterpret confirmed source scope.

### Scenario C: Non-Semantic Execution Gap

- Setup: A test, build, audit, or delivery command fails without changing semantics.
- Expected: Repair and rerun the same trace slice.
- Forbidden: Stop solely because a declared validation command failed.`;
}

function renderGoalCompletionEvidencePacket(packet) {
  return `artifactRole: ${packet.completionEvidencePacketSchema.artifactRole}
requiredFields: ${packet.completionEvidencePacketSchema.requiredFields.join(', ')}
forbiddenAuthorities: ${packet.completionEvidencePacketSchema.forbiddenAuthorities.join(', ') || '(none)'}

Final evidence must include closed IDs, open IDs, command results, E2E evidence, audit evidence, residual risks, and scope changes.`;
}

function renderGoalStopConditions(packet) {
  return `Stop and ask the user only if:

- A required semantic decision cannot be derived from ${packet.sourceDocument}#implementationConfirmation.
- The required write scope must expand outside model_packet.json.
- A destructive Git or filesystem operation is required.
- A shared contract/schema migration is unavoidable and has multiple valid incompatible designs.
- A required validation command is unavailable and no equivalent command exists in model_packet.json.

Do not stop merely because:

- Existing implementation is partial.
- Tests need fixtures.
- Generated artifacts are stale.
- A validation command fails inside declared scope.
- Non-semantic execution gaps require repair and rerun.

In those cases, repair inside the declared scope and rerun the same validation command.`;
}

function buildGoalSlotData(packet, artifactPaths, profile) {
  return {
    frontMatter: renderGoalFrontMatter(packet, profile, artifactPaths),
    goalEntry: renderGoalEntry(packet, artifactPaths),
    authorityModel: renderGoalAuthorityModel(packet, artifactPaths),
    rootCause: renderGoalRootCause(packet),
    domainAddenda: renderGoalDomainAddenda(packet),
    implementationTasks: renderGoalImplementationTasks(packet),
    strictAcceptanceChecklist: renderGoalAcceptanceChecklist(packet),
    acceptanceTraceabilityMatrix: renderGoalAcceptanceMatrix(packet),
    requiredTestCommands: renderGoalRequiredCommands(packet),
    manualVerificationScenarios: renderGoalManualScenarios(packet),
    completionEvidencePacket: renderGoalCompletionEvidencePacket(packet),
    stopConditions: renderGoalStopConditions(packet),
  };
}

function renderGoalExecutionDocumentFromPacket(packet, artifactPaths) {
  const templateText = readGoalContractTemplate();
  const profile = readGoalContractProfile();
  try {
    const { renderGoalContract } = loadGoalContractRenderer();
    return renderGoalContract({
      templateText,
      profile,
      slotData: buildGoalSlotData(packet, artifactPaths, profile),
    });
  } catch (error) {
    throw new BlockedInput(`BLOCK: ${mapGoalContractError(error)}`, error.message);
  }
}

function renderHumanPromptFromPacket(packet, args, context) {
  const language = resolvePromptLanguage(context.confirmation, args);
  const hostDirective = buildHostContinuationDirective(packet, args, context.artifactPaths);
  const profile = args.humanPromptProfile || 'full';
  const prompt =
    profile === 'compact'
      ? renderCompactHumanPromptFromPacket(packet, args, hostDirective, language)
      : renderFullHumanPromptFromPacket(packet, args, hostDirective, language);
  const audit = auditHumanPrompt(prompt, packet.sourceDocument, profile);
  return { prompt, language, profile, hostDirective, audit };
}

function receiptHashFor(receipt) {
  const clone = { ...receipt };
  delete clone.receiptHash;
  return sha256(stableStringify(clone));
}

function buildPassReceipt(args, context, packet, outputHashes, outputs, promptMeta) {
  const validationReasons = [
    ...validateCompilerContract(context.confirmation, context.record),
    ...promptMeta.audit.missing.map((fragment) => `HUMAN_PROMPT_REQUIRED_FRAGMENT_MISSING:${fragment}`),
    ...(promptMeta.goalDocumentAudit?.missing ?? []).map(
      (fragment) => `GOAL_DOCUMENT_REQUIRED_FRAGMENT_MISSING:${fragment}`
    ),
  ];
  const receipt = {
    schemaVersion: 'req-trace-ai-tdd-compiler-audit-receipt/v1',
    recordId: packet.recordId,
    decision: validationReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: validationReasons,
    sourceDocumentHash: context.sourceDocumentHash,
    implementationConfirmationHash: context.implementationConfirmationHash,
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
    humanPromptRequiredFragmentsPassed: promptMeta.audit.passed,
    humanPromptRequiredFragments: promptMeta.audit.fragments,
    humanPromptMissingRequiredFragments: promptMeta.audit.missing,
    goalDocumentRequiredFragmentsPassed: promptMeta.goalDocumentAudit?.passed ?? null,
    goalDocumentRequiredFragments: promptMeta.goalDocumentAudit?.fragments ?? [],
    goalDocumentMissingRequiredFragments: promptMeta.goalDocumentAudit?.missing ?? [],
    goalContractTemplate: promptMeta.goalContractTemplate,
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
    outputs,
    outputHashes,
    proofBoundary: packet.proofBoundary,
  };
  receipt.receiptHash = receiptHashFor(receipt);
  return receipt;
}

function buildBlockedReceipt(args, context, blockingReasons, message) {
  const recordId = context?.record?.recordId ?? context?.confirmation?.recordId ?? 'unknown';
  const receipt = {
    schemaVersion: 'req-trace-ai-tdd-compiler-audit-receipt/v1',
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
    context = compilerInputContext(args);
    const blockingReasons = validateCompilerContract(context.confirmation, context.record);
    if (blockingReasons.length > 0) {
      const receipt = buildBlockedReceipt(
        args,
        context,
        blockingReasons,
        'Compiler contract validation failed before writing execution packet artifacts.'
      );
      writeJson(path.join(outDir, 'audit_receipt.json'), receipt);
      return {
        status: 3,
        summary: {
          decision: 'blocked',
          blockingReasons,
          outputs: { auditReceipt: normalizePathSafe(path.join(outDir, 'audit_receipt.json')) },
          outputHashes: { auditReceiptHash: sha256(stableStringify(receipt)) },
        },
      };
    }

    const packet = buildModelPacket(context, args);
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
    writeJson(packetPath, packet);
    const modelPacketHash = sha256(readText(packetPath));

    const promptMeta = renderHumanPromptFromPacket(packet, args, context);
    writeText(promptPath, promptMeta.prompt);
    const humanPromptHash = sha256(readText(promptPath));

    const outputs = {
      modelPacket: normalizePathSafe(packetPath),
      humanPrompt: normalizePathSafe(promptPath),
      auditReceipt: normalizePathSafe(receiptPath),
    };
    const outputHashes = { modelPacketHash, humanPromptHash };
    ensureGoalDocumentPrepared(promptMeta, packet, context.artifactPaths, outputs, outputHashes);
    const receipt = buildPassReceipt(args, context, packet, outputHashes, outputs, promptMeta);
    writeJson(receiptPath, receipt);
    outputHashes.auditReceiptHash = sha256(readText(receiptPath));
    const summary = {
      decision: receipt.decision,
      blockingReasons: receipt.blockingReasons,
      outputs,
      outputHashes,
    };
    return { status: receipt.decision === 'pass' ? 0 : 3, summary };
  } catch (error) {
    if (!(error instanceof BlockedInput)) throw error;
    const receipt = buildBlockedReceipt(args, context, [error.code.replace(/^BLOCK:\s*/u, '')], error.message);
    writeJson(path.join(outDir, 'audit_receipt.json'), receipt);
    return {
      status: 3,
      summary: {
        decision: 'blocked',
        blockingReasons: receipt.blockingReasons,
        outputs: { auditReceipt: normalizePathSafe(path.join(outDir, 'audit_receipt.json')) },
        outputHashes: { auditReceiptHash: sha256(stableStringify(receipt)) },
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

  const sourcePath = args.sourceDocument || args.contract;
  const sourceText = readText(sourcePath);
  const blockText = extractConfirmationBlock(sourceText);
  const parsed = parseConfirmation(blockText);
  const confirmationCandidate = parsed.implementationConfirmation;
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
  const sourceLabel = args.sourceLabel || displayPath(sourcePath);
  const sourceAuthority = `${sourceLabel}#implementationConfirmation`;

  const traceRows = Array.isArray(confirmation.traceRows) ? confirmation.traceRows : [];
  const traceIds = traceRows.filter((row) => row?.id).map((row) => String(row.id));
  const traceText = traceIds.join(' -> ');
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
  const commitRule = args.noAutoCommit
    ? '不要自动提交；只有用户明确要求提交时才提交，并且禁止 push。'
    : '改为 PASS 后立即本地提交一次，禁止 push。若源文档或用户指定 commit message 格式，严格使用该格式；否则使用仓库提交规范。';

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
6. ${commitRule}
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

if (require.main === module) {
  process.exitCode = main();
}
