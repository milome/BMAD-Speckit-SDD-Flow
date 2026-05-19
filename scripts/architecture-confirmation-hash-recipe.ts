import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

export type JsonObject = Record<string, unknown>;

export interface ResolvedArchitectureConfirmationHashRecipe {
  schemaVersion: string;
  recipeVersion: string;
  configPath: string;
  canonicalization: JsonObject;
  pathNormalization: JsonObject;
  fixedCategoryOrder: JsonObject;
  volatileFieldsExcludedFromArtifactHash: string[];
  stateTransitionHashCoverage: JsonObject;
  controlledIngestRules: JsonObject;
  resolvedRecipeHash: string;
}

const EXPECTED_SCHEMA_VERSION = 'architecture-confirmation-hash-recipe.contract/v1';
const EXPECTED_RECIPE_VERSION = 'architecture-confirmation-hash/v1';
const DEFAULT_CONFIG_PATH = '_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const input = value as JsonObject;
  return `{${Object.keys(input)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`)
    .join(',')}}`;
}

export function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function normalizeArchitecturePath(value: string, repoRoot = process.cwd()): string {
  const raw = value.replace(/\\/gu, '/').trim();
  const root = repoRoot.replace(/\\/gu, '/').replace(/\/$/u, '');
  const withoutRoot = raw.startsWith(`${root}/`) ? raw.slice(root.length + 1) : raw;
  const normalized = path.posix.normalize(withoutRoot.replace(/^[a-zA-Z]:\//u, (drive) => drive.toLowerCase()));
  return normalized.replace(/^\.\//u, '').replace(/\/$/u, '');
}

export function resolveArchitectureConfirmationHashRecipe(
  configPath = DEFAULT_CONFIG_PATH
): ResolvedArchitectureConfirmationHashRecipe {
  const absoluteConfigPath = path.resolve(configPath);
  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`ArchitectureConfirmationHashRecipe missing: ${configPath}`);
  }
  const parsed = yaml.load(fs.readFileSync(absoluteConfigPath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ArchitectureConfirmationHashRecipe must be a YAML object');
  }
  const config = parsed as JsonObject;
  const schemaVersion = text(config.schemaVersion);
  const recipeVersion = text(config.recipeVersion);
  if (schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(`ArchitectureConfirmationHashRecipe schemaVersion invalid: ${schemaVersion || '<missing>'}`);
  }
  if (recipeVersion !== EXPECTED_RECIPE_VERSION) {
    throw new Error(`ArchitectureConfirmationHashRecipe recipeVersion invalid: ${recipeVersion || '<missing>'}`);
  }
  const volatileFields = strings(config.volatileFieldsExcludedFromArtifactHash);
  const requiredStateHashFields = strings(object(config.stateTransitionHashCoverage).requiredHashFields);
  if (volatileFields.length === 0) throw new Error('ArchitectureConfirmationHashRecipe volatile fields missing');
  if (requiredStateHashFields.length === 0) {
    throw new Error('ArchitectureConfirmationHashRecipe stateTransition hash coverage missing');
  }

  const resolvedWithoutHash = {
    schemaVersion,
    recipeVersion,
    configPath: normalizeArchitecturePath(absoluteConfigPath),
    canonicalization: object(config.canonicalization),
    pathNormalization: object(config.pathNormalization),
    fixedCategoryOrder: object(config.fixedCategoryOrder),
    volatileFieldsExcludedFromArtifactHash: volatileFields,
    stateTransitionHashCoverage: object(config.stateTransitionHashCoverage),
    controlledIngestRules: object(config.controlledIngestRules),
  };
  return {
    ...resolvedWithoutHash,
    resolvedRecipeHash: sha256Text(stableStringify(resolvedWithoutHash)),
  };
}

export function architectureConfirmationHashFor(
  confirmation: JsonObject,
  recipe: ResolvedArchitectureConfirmationHashRecipe
): string {
  const volatile = new Set([
    ...recipe.volatileFieldsExcludedFromArtifactHash,
    'artifactHash',
    'architectureConfirmationArtifactHash',
    'confirmationPhrase',
    'architectureConfirmationArtifactRef',
  ]);
  const semantic: JsonObject = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!volatile.has(key)) semantic[key] = value;
  }
  return sha256Text(stableStringify(semantic));
}
