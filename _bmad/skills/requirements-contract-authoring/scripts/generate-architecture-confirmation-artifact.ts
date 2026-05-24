#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('./load-js-yaml');

const RECIPE_PATH = '_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml';
const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeRepoPath(value, repoRoot = process.cwd()) {
  const raw = String(value || '').replace(/\\/gu, '/').trim();
  const root = repoRoot.replace(/\\/gu, '/').replace(/\/$/u, '');
  const withoutRoot = raw.startsWith(`${root}/`) ? raw.slice(root.length + 1) : raw;
  return path.posix.normalize(withoutRoot).replace(/^\.\//u, '').replace(/\/$/u, '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonOption(value, label) {
  if (!value) throw new Error(`missing ${label}`);
  const maybePath = path.resolve(value);
  const raw = fs.existsSync(maybePath) ? fs.readFileSync(maybePath, 'utf8') : value;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array`);
  return parsed;
}

function extractImplementationConfirmation(sourceText) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation block');
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText);
  if (!parsed?.implementationConfirmation) throw new Error('implementationConfirmation block is not valid YAML');
  return { blockText, confirmation: parsed.implementationConfirmation };
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(semanticConfirmationForHash(confirmation))}`;
  return sha256Text(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return sha256Text(stableStringify(semanticConfirmationForHash(confirmation)));
}

function resolveRecipe(configPath = RECIPE_PATH) {
  const absolute = path.resolve(configPath);
  const config = yaml.load(fs.readFileSync(absolute, 'utf8'));
  const resolvedWithoutHash = {
    schemaVersion: text(config.schemaVersion),
    recipeVersion: text(config.recipeVersion),
    configPath: normalizeRepoPath(absolute),
    canonicalization: object(config.canonicalization),
    pathNormalization: object(config.pathNormalization),
    fixedCategoryOrder: object(config.fixedCategoryOrder),
    volatileFieldsExcludedFromArtifactHash: array(config.volatileFieldsExcludedFromArtifactHash).map(text).filter(Boolean),
    stateTransitionHashCoverage: object(config.stateTransitionHashCoverage),
    controlledIngestRules: object(config.controlledIngestRules),
  };
  if (resolvedWithoutHash.recipeVersion !== 'architecture-confirmation-hash/v1') {
    throw new Error(`invalid architecture hash recipe: ${resolvedWithoutHash.recipeVersion || '<missing>'}`);
  }
  return { ...resolvedWithoutHash, resolvedRecipeHash: sha256Text(stableStringify(resolvedWithoutHash)) };
}

function architectureHashFor(confirmation, recipe) {
  const volatile = new Set([
    ...recipe.volatileFieldsExcludedFromArtifactHash,
    'artifactHash',
    'architectureConfirmationArtifactHash',
    'confirmationPhrase',
    'architectureConfirmationArtifactRef',
  ]);
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!volatile.has(key)) semantic[key] = value;
  }
  return sha256Text(stableStringify(semantic));
}

function requireConfirmedSource(sourcePath, recordPath) {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  const confirmation = extracted.confirmation;
  const record = readJson(recordPath);
  if (text(confirmation.status) !== 'user_confirmed') throw new Error('implementationConfirmation is not user_confirmed');
  if (text(record.status) !== 'user_confirmed') throw new Error('requirement record is not user_confirmed');
  const sourceHash = sourceDocumentHashFor(sourceText, extracted.blockText, confirmation);
  const implementationHash = implementationConfirmationHashFor(confirmation);
  const mismatches = [];
  if (text(record.sourceDocumentHash) !== sourceHash) mismatches.push('record_source_hash_mismatch');
  if (text(record.implementationConfirmationHash) !== implementationHash) {
    mismatches.push('record_implementation_confirmation_hash_mismatch');
  }
  if (text(confirmation.sourceDocumentHash) && text(confirmation.sourceDocumentHash) !== sourceHash) {
    mismatches.push('source_bookkeeping_source_hash_mismatch');
  }
  if (text(confirmation.implementationConfirmationHash) && text(confirmation.implementationConfirmationHash) !== implementationHash) {
    mismatches.push('source_bookkeeping_implementation_confirmation_hash_mismatch');
  }
  if (mismatches.length) throw new Error(mismatches.join(','));
  return { confirmation, record, sourceHash, implementationHash };
}

function buildArtifact(args) {
  const sourcePath = path.resolve(args.source);
  const recordPath = path.resolve(args.requirementRecord);
  const outPath = path.resolve(args.out);
  const targetPaths = readJsonOption(args.targetPaths, 'targetPaths').map((item) => normalizeRepoPath(item));
  const consumerImpactScan = readJsonOption(args.consumerImpactScan, 'consumerImpactScan');
  const governanceImpactScan = readJsonOption(args.governanceImpactScan, 'governanceImpactScan');
  const fullArchitectureTriggerMatrix = readJsonOption(args.fullArchitectureTriggerMatrix, 'fullArchitectureTriggerMatrix');
  if (targetPaths.length === 0) throw new Error('targetPaths must not be empty');
  if (consumerImpactScan.length === 0) throw new Error('consumerImpactScan must not be empty');
  if (governanceImpactScan.length === 0) throw new Error('governanceImpactScan must not be empty');
  const { confirmation, record, sourceHash, implementationHash } = requireConfirmedSource(sourcePath, recordPath);
  const recipe = resolveRecipe(args.recipe);
  const runId = text(args.runId) || `arch-confirm-${Date.now()}`;
  const evidenceRefs = args.evidenceRefs ? readJsonOption(args.evidenceRefs, 'evidenceRefs') : ['EVD-036', 'EVD-037'];
  const relatedRequirementIds = args.relatedRequirementIds
    ? readJsonOption(args.relatedRequirementIds, 'relatedRequirementIds')
    : ['MUST-035', 'MUST-036', 'MUST-037', ...evidenceRefs];
  const targetPathsHash = sha256Text(stableStringify(targetPaths));
  const consumerImpactScanHash = sha256Text(stableStringify(consumerImpactScan));
  const governanceImpactScanHash = sha256Text(stableStringify(governanceImpactScan));
  const artifact = {
    schemaVersion: 'architecture-confirmation/v1',
    recordId: text(confirmation.recordId) || text(record.recordId),
    requirementSetId: text(confirmation.requirementSetId) || text(record.requirementSetId),
    runId,
    status: 'draft',
    entryFlow: text(confirmation.entryFlow),
    entryFlowClass: text(confirmation.entryFlowClass),
    workflowAdapter: text(confirmation.workflowAdapter),
    decision: text(args.decision) || 'full_architecture_confirmed',
    outcome: text(args.outcome) || text(args.decision) || 'full_architecture_confirmed',
    sourceDocumentHash: sourceHash,
    implementationConfirmationHash: implementationHash,
    architectureConfirmationHashRecipe: recipe,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    targetPaths,
    targetPathsHash,
    consumerImpactScan,
    consumerImpactScanHash,
    governanceImpactScan,
    governanceImpactScanHash,
    fullArchitectureTriggerMatrix,
    riskStatement: text(args.riskStatement) || 'Architecture confirmation risk statement must be reviewed in the source confirmation context.',
    rollbackPlan: text(args.rollbackPlan) || 'Rollback by rejecting this architecture confirmation and regenerating a new requirement-scoped artifact.',
    evidenceRefs,
    staleInputs: {
      sourceDocumentHash: sourceHash,
      implementationConfirmationHash: implementationHash,
      targetPathsHash,
      consumerImpactScanHash,
      governanceImpactScanHash,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
    },
    architectureConfirmationArtifactRef: {
      artifactType: 'architecture_confirmation',
      sourceOfTruthRole: 'evidence',
      path: normalizeRepoPath(outPath),
      producer: 'requirements-contract-authoring/generate-architecture-confirmation-artifact',
      purpose: 'requirement-scoped architecture confirmation artifact',
      relatedRequirementIds,
      status: 'draft',
      inputVersion: sourceHash,
      outputVersion: 'architecture-confirmation-v1',
    },
  };
  const artifactHash = architectureHashFor(artifact, recipe);
  artifact.artifactHash = artifactHash;
  artifact.architectureConfirmationArtifactHash = artifactHash;
  artifact.confirmationPhrase = [
    '确认架构确认进入实施准备',
    `sourceDocumentHash=${sourceHash}`,
    `implementationConfirmationHash=${implementationHash}`,
    `resolvedRecipeHash=${recipe.resolvedRecipeHash}`,
    `architectureConfirmationArtifactHash=${artifactHash}`,
  ].join('\n');
  artifact.architectureConfirmationArtifactRef.hash = artifactHash;
  return { artifact, outPath };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node generate-architecture-confirmation-artifact.ts --source <source.md> --requirement-record <record.json> --out <architecture-confirmation.json> --target-paths <json|file> --consumer-impact-scan <json|file> --governance-impact-scan <json|file> --full-architecture-trigger-matrix <json|file> [--run-id <id>] [--json]');
    return 0;
  }
  for (const key of ['source', 'requirementRecord', 'out', 'targetPaths', 'consumerImpactScan', 'governanceImpactScan', 'fullArchitectureTriggerMatrix']) {
    if (!args[key]) throw new Error(`missing required arg: ${key}`);
  }
  const { artifact, outPath } = buildArtifact(args);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  const result = {
    ok: true,
    architectureConfirmationPath: normalizeRepoPath(outPath),
    architectureConfirmationArtifactHash: artifact.architectureConfirmationArtifactHash,
    sourceDocumentHash: artifact.sourceDocumentHash,
    implementationConfirmationHash: artifact.implementationConfirmationHash,
    resolvedRecipeHash: artifact.resolvedRecipeHash,
  };
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `architecture_confirmation=${result.architectureConfirmationPath}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
