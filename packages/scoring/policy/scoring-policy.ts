import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { LEVEL_RANGES } from '../constants/weights';

type JsonObject = Record<string, unknown>;

export interface ScoringPolicyRuleRef {
  stage: string;
  kind: string;
  path: string;
  hash: string;
}

export interface ResolvedScoringPolicy {
  schemaVersion: 'resolved-scoring-policy/v1';
  policyId: string;
  contractPath: string;
  contractHash: string;
  scoringPolicyHash: string;
  scoreMaterializationPolicy: JsonObject;
  scoreEvaluationPolicy: JsonObject;
  passThresholds: JsonObject;
  levelRanges: Array<{ level: string; min: number; max: number }>;
  dimensionVetoPolicy: JsonObject;
  iterationPenaltyPolicy: JsonObject;
  severityOverridePolicy: JsonObject;
  stageRuleRefs: ScoringPolicyRuleRef[];
  requiredScoreArtifactKinds: string[];
}

export interface ResolveScoringPolicyOptions {
  root?: string;
  contractPath?: string;
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sha256Buffer(value: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: JsonObject = {};
  for (const key of Object.keys(value as JsonObject).sort()) {
    out[key] = sortKeysDeep((value as JsonObject)[key]);
  }
  return out;
}

function stableHash(value: unknown): string {
  return sha256Buffer(JSON.stringify(sortKeysDeep(value)));
}

function readYamlObject(file: string): JsonObject {
  const parsed = yaml.load(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`scoring policy YAML object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function asObject(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`scoring policy field must be object: ${field}`);
  }
  return value as JsonObject;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`scoring policy field must be string array: ${field}`);
  }
  return value.map((item) => item.trim());
}

function resolveContractPath(root: string, contractPath?: string): string {
  const raw = contractPath?.trim() || path.join('_bmad', '_config', 'scoring-policy.contract.yaml');
  return path.isAbsolute(raw) ? raw : path.resolve(root, raw);
}

function relativeFromRoot(root: string, file: string): string {
  return normalizePath(path.relative(root, file));
}

function resolvePolicyPath(root: string, file: string): string {
  return path.isAbsolute(file) ? file : path.resolve(root, file);
}

function validateLevelRanges(value: unknown): Array<{ level: string; min: number; max: number }> {
  const raw = Array.isArray(value) && value.length > 0 ? value : LEVEL_RANGES;
  return raw.map((item, index) => {
    const obj = asObject(item, `levelRanges[${index}]`);
    const level = typeof obj.level === 'string' ? obj.level.trim() : '';
    if (!level || typeof obj.min !== 'number' || typeof obj.max !== 'number') {
      throw new Error(`invalid scoring policy level range at index ${index}`);
    }
    return { level, min: obj.min, max: obj.max };
  });
}

function resolveRuleRefs(root: string, contract: JsonObject): ScoringPolicyRuleRef[] {
  const refs = Array.isArray(contract.stageRuleRefs) ? contract.stageRuleRefs : [];
  if (refs.length === 0) throw new Error('scoring policy stageRuleRefs missing');
  return refs.map((item, index) => {
    const ref = asObject(item, `stageRuleRefs[${index}]`);
    const stage = typeof ref.stage === 'string' ? ref.stage.trim() : '';
    const kind = typeof ref.kind === 'string' ? ref.kind.trim() : '';
    const refPath = typeof ref.path === 'string' ? ref.path.trim() : '';
    if (!stage || !kind || !refPath) throw new Error(`invalid scoring policy stageRuleRefs[${index}]`);
    const absolute = resolvePolicyPath(root, refPath);
    if (!fs.existsSync(absolute)) throw new Error(`scoring policy rule fragment missing: ${refPath}`);
    return {
      stage,
      kind,
      path: normalizePath(refPath),
      hash: sha256Buffer(fs.readFileSync(absolute)),
    };
  });
}

export function resolveScoringPolicy(options?: ResolveScoringPolicyOptions): ResolvedScoringPolicy {
  const root = path.resolve(options?.root ?? process.cwd());
  const contractAbsolute = resolveContractPath(root, options?.contractPath);
  if (!fs.existsSync(contractAbsolute)) {
    throw new Error(`scoring policy contract missing: ${relativeFromRoot(root, contractAbsolute)}`);
  }
  const contract = readYamlObject(contractAbsolute);
  if (contract.schemaVersion !== 'scoring-policy.contract/v1') {
    throw new Error('scoring policy contract schemaVersion invalid');
  }
  const policyId = typeof contract.policyId === 'string' && contract.policyId.trim()
    ? contract.policyId.trim()
    : 'default-scoring-policy';
  const resolvedWithoutHash = {
    schemaVersion: 'resolved-scoring-policy/v1' as const,
    policyId,
    contractPath: relativeFromRoot(root, contractAbsolute),
    contractHash: sha256Buffer(fs.readFileSync(contractAbsolute)),
    scoreMaterializationPolicy: asObject(contract.scoreMaterializationPolicy, 'scoreMaterializationPolicy'),
    scoreEvaluationPolicy: asObject(contract.scoreEvaluationPolicy, 'scoreEvaluationPolicy'),
    passThresholds: asObject(contract.passThresholds, 'passThresholds'),
    levelRanges: validateLevelRanges(contract.levelRanges),
    dimensionVetoPolicy: asObject(contract.dimensionVetoPolicy, 'dimensionVetoPolicy'),
    iterationPenaltyPolicy: asObject(contract.iterationPenaltyPolicy, 'iterationPenaltyPolicy'),
    severityOverridePolicy: asObject(contract.severityOverridePolicy, 'severityOverridePolicy'),
    stageRuleRefs: resolveRuleRefs(root, contract),
    requiredScoreArtifactKinds: asStringArray(contract.requiredScoreArtifactKinds, 'requiredScoreArtifactKinds'),
  };
  return {
    ...resolvedWithoutHash,
    scoringPolicyHash: stableHash(resolvedWithoutHash),
  };
}
