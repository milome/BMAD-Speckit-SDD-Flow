/**
 * Runtime Governance — unified `RuntimePolicy` for flow/stage (production).
 *
 * ## 文档互链
 *
 * - **术语**：[`docs/reference/runtime-governance-terms.md`](../docs/reference/runtime-governance-terms.md)
 * - **母文档 policy 表**：[`docs/plans/UNIFIED_RUNTIME_2026-03-19.md`](../docs/plans/UNIFIED_RUNTIME_2026-03-19.md)
 *
 * `shouldAudit` / `shouldValidate` / `getStrictness` / `shouldGenerateDoc` 经 `bmad-config` 中 `callResolveRuntimePolicy()` 委托本模块。
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-returns */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type { RuntimeConfig, StageName, ValidationLevel, StrictnessLevel } from './bmad-config';
import type { AuditConvergenceConfig } from './bmad-config';
import { loadConfig, getAuditConvergence, getStageConfig } from './bmad-config';
import { scoringEnabledForTriggerStage } from '../packages/scoring/trigger/trigger-loader';
import { parseRuntimePolicyTemplatesYaml } from './runtime-governance-template-schema';
import { applyRegisteredAugmenters } from './runtime-governance-registry';

/** 流程类型（扩展时可与 orchestrator 枚举对齐） */
export type RuntimeFlowId = 'story' | 'bugfix' | 'standalone_tasks' | 'epic' | 'unknown';

/** 策略结果来源；`BMAD_RUNTIME_SHADOW=1` 时本模块产出 `shadow` 供对照测试观测 */
export type CompatibilitySource = 'legacy' | 'shadow' | 'governance';

export interface RuntimePolicyIdentity {
  flow: RuntimeFlowId;
  stage: StageName;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
  contextSource?: string;
}

export interface RuntimePolicyControl {
  auditRequired: boolean;
  validationLevel: ValidationLevel;
  strictness: StrictnessLevel;
  generateDoc: boolean;
  convergence: AuditConvergenceConfig;
  mandatoryGate: boolean;
  granularityGoverned: boolean;
  skipAllowed: boolean;
  scoringEnabled: boolean;
  triggerStage: string;
  reason: string;
}

export interface RuntimePolicyLanguage {
  preserveMachineKeys: true;
  preserveParserAnchors: true;
  preserveTriggerStage: true;
}

export interface RuntimePolicy {
  flow: RuntimeFlowId;
  stage: StageName;
  auditRequired: boolean;
  validationLevel: ValidationLevel;
  strictness: StrictnessLevel;
  generateDoc: boolean;
  convergence: AuditConvergenceConfig;
  mandatoryGate: boolean;
  granularityGoverned: boolean;
  skipAllowed: boolean;
  scoringEnabled: boolean;
  triggerStage: string;
  compatibilitySource: CompatibilitySource;
  reason: string;
  identity: RuntimePolicyIdentity;
  control: RuntimePolicyControl;
  language: RuntimePolicyLanguage;
}

/** Optional YAML paths for Vitest or alternate config roots */
export interface GovernanceYamlPaths {
  stageMapping?: string;
  mandatoryGates?: string;
  granularityStages?: string;
  policyTemplates?: string;
  scoringTriggerModes?: string;
}

export interface ResolveRuntimePolicyInput {
  flow: RuntimeFlowId;
  stage: StageName;
  config?: RuntimeConfig;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
  contextSource?: string;
  /** Default `real_dev` */
  scenario?: 'real_dev' | 'eval_question';
  /** When set, merge allowed fields from `runtime-policy-templates.yaml` after base policy */
  templateId?: string;
  governanceYamlPaths?: GovernanceYamlPaths;
}

function defaultConfigDir(): string {
  return path.resolve(process.cwd(), '_bmad', '_config');
}

function resolvePath(override: string | undefined, name: string): string {
  if (override) {
    return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
  }
  return path.join(defaultConfigDir(), name);
}

interface MandatoryGatesYaml {
  gates: Array<{ id: string; flow: string; stage: string }>;
}

interface GranularityYaml {
  granularity_governed_stages: string[];
}

interface StageMappingYaml {
  runtime_flow_stage_to_trigger_stage: Record<string, Record<string, string>>;
}

function readYamlFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content) as T;
}

function loadMandatoryGates(filePath: string): MandatoryGatesYaml {
  const raw = readYamlFile<unknown>(filePath);
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as MandatoryGatesYaml).gates)) {
    throw new Error(`Invalid mandatory gates YAML: ${filePath}`);
  }
  return raw as MandatoryGatesYaml;
}

function loadGranularityStages(filePath: string): GranularityYaml {
  const raw = readYamlFile<unknown>(filePath);
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as GranularityYaml).granularity_governed_stages)
  ) {
    throw new Error(`Invalid granularity stages YAML: ${filePath}`);
  }
  return raw as GranularityYaml;
}

function loadRuntimeStageMapping(filePath: string): StageMappingYaml {
  const raw = readYamlFile<unknown>(filePath);
  if (
    !raw ||
    typeof raw !== 'object' ||
    !(raw as StageMappingYaml).runtime_flow_stage_to_trigger_stage ||
    typeof (raw as StageMappingYaml).runtime_flow_stage_to_trigger_stage !== 'object'
  ) {
    throw new Error(`stage-mapping.yaml missing runtime_flow_stage_to_trigger_stage: ${filePath}`);
  }
  return raw as StageMappingYaml;
}

function readLegacyStagePolicyFields(
  stage: StageName,
  cfg: RuntimeConfig
): {
  auditRequired: boolean;
  validationLevel: ValidationLevel;
  strictness: StrictnessLevel;
  generateDoc: boolean;
} {
  const stageConfig = getStageConfig(stage, cfg);
  return {
    auditRequired: stageConfig?.audit ?? true,
    validationLevel: stageConfig?.validation ?? null,
    strictness: stageConfig?.strictness ?? 'standard',
    generateDoc: stageConfig?.generate_doc ?? true,
  };
}

function findMandatoryGateRule(
  flow: RuntimeFlowId,
  stage: StageName,
  mandatoryPath: string
): { id: string } | null {
  const doc = loadMandatoryGates(mandatoryPath);
  const hit = doc.gates.find((g) => g.flow === flow && g.stage === stage);
  return hit ? { id: hit.id } : null;
}

function granularityGovernedForStage(stage: StageName, granPath: string): boolean {
  const doc = loadGranularityStages(granPath);
  return doc.granularity_governed_stages.includes(stage);
}

function resolveTriggerStage(
  flow: RuntimeFlowId,
  stage: StageName,
  mappingPath: string
): { triggerStage: string; mappingDescriptor: string } {
  const doc = loadRuntimeStageMapping(mappingPath);
  const flowMap = doc.runtime_flow_stage_to_trigger_stage[flow];
  const mapped = flowMap?.[stage];
  if (mapped !== undefined && mapped !== '') {
    return { triggerStage: mapped, mappingDescriptor: `${flow}/${stage}→${mapped}` };
  }
  const unmapped = `unmapped_${stage}`;
  return { triggerStage: unmapped, mappingDescriptor: `${flow}/${stage}→${unmapped}` };
}

function mergeRuntimePolicyTemplate(
  base: RuntimePolicy,
  templateId: string,
  templatesPath: string,
  cfg: RuntimeConfig
): RuntimePolicy {
  const content = fs.readFileSync(templatesPath, 'utf8');
  const parsed = parseRuntimePolicyTemplatesYaml(yaml.load(content) as unknown);
  const patch = parsed.templates[templateId];
  if (!patch) {
    throw new Error(`Unknown runtime policy templateId: ${templateId}`);
  }
  const merged: RuntimePolicy = { ...base };
  const mergedRec = merged as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    mergedRec[k] = v;
  }
  if (patch.strictness !== undefined && patch.convergence === undefined) {
    merged.convergence = getAuditConvergence(merged.strictness, cfg);
  }
  merged.reason = `${base.reason} | template:${templateId}`;
  return merged;
}

function resolveRuntimeStageForPolicy(stage: StageName): StageName {
  if (stage === ('constitution' as StageName)) {
    return 'specify';
  }
  return stage;
}

/**
 * 解析当前 flow/stage 下的统一 policy（生产路径）。
 */
export function resolveRuntimePolicy(input: ResolveRuntimePolicyInput): RuntimePolicy {
  const cfg = input.config ?? loadConfig();
  const flow = input.flow;
  const stage = resolveRuntimeStageForPolicy(input.stage);
  const scenario = input.scenario ?? 'real_dev';
  const paths = input.governanceYamlPaths ?? {};
  const identitySummaryParts = [
    input.epicId ? `epicId=${input.epicId}` : null,
    input.storyId ? `storyId=${input.storyId}` : null,
    input.storySlug ? `storySlug=${input.storySlug}` : null,
    input.runId ? `runId=${input.runId}` : null,
    input.artifactRoot ? `artifactRoot=${input.artifactRoot}` : null,
    input.contextSource ? `contextSource=${input.contextSource}` : null,
  ].filter(Boolean);

  const mandatoryPath = resolvePath(paths.mandatoryGates, 'runtime-mandatory-gates.yaml');
  const granPath = resolvePath(paths.granularityStages, 'runtime-granularity-stages.yaml');
  const mappingPath = resolvePath(paths.stageMapping, 'stage-mapping.yaml');
  const templatesPath = resolvePath(paths.policyTemplates, 'runtime-policy-templates.yaml');
  const scoringModesPath = resolvePath(paths.scoringTriggerModes, 'scoring-trigger-modes.yaml');

  const legacy = readLegacyStagePolicyFields(stage, cfg);
  const { auditRequired, validationLevel, strictness, generateDoc } = legacy;
  const convergence = getAuditConvergence(strictness, cfg);
  const stageCfg = getStageConfig(stage, cfg);
  const skipAllowed = stageCfg?.optional === true;

  const mandatoryHit = findMandatoryGateRule(flow, stage, mandatoryPath);
  const mandatoryGate = mandatoryHit !== null;
  const granularityGoverned = granularityGovernedForStage(stage, granPath);

  if (mandatoryGate && granularityGoverned) {
    throw new Error(
      `Illegal runtime governance: mandatoryGate and granularityGoverned both true for ${flow}/${stage}`
    );
  }

  const { triggerStage, mappingDescriptor } = resolveTriggerStage(flow, stage, mappingPath);
  const scoring = scoringEnabledForTriggerStage(triggerStage, scenario, scoringModesPath);

  const mandatoryPart = mandatoryHit ? `${mandatoryPath}#${mandatoryHit.id}` : 'mandatory:none';
  const granPart = `${granPath}:granularityGoverned=${granularityGoverned}`;
  const legacyPart = `legacy:auditRequired=${auditRequired},validationLevel=${validationLevel},strictness=${strictness},generateDoc=${generateDoc}`;
  const scoringPart = `scoringEnabled=${scoring.enabled}(${scoring.reason})`;
  const identityPart =
    identitySummaryParts.length > 0
      ? `identity:${identitySummaryParts.join(',')}`
      : 'identity:none';

  const reason = `${legacyPart}; convergence:${strictness}; ${mandatoryPart}; ${granPart}; trigger:${mappingDescriptor}; ${scoringPart}; ${identityPart}`;

  const compatibilitySource: CompatibilitySource =
    process.env.BMAD_RUNTIME_SHADOW === '1' ? 'shadow' : 'governance';

  let policy: RuntimePolicy = {
    flow,
    stage,
    auditRequired,
    validationLevel,
    strictness,
    generateDoc,
    convergence,
    mandatoryGate,
    granularityGoverned,
    skipAllowed,
    scoringEnabled: scoring.enabled,
    triggerStage,
    compatibilitySource,
    reason,
    identity: {
      flow,
      stage,
      ...(input.epicId ? { epicId: input.epicId } : {}),
      ...(input.storyId ? { storyId: input.storyId } : {}),
      ...(input.storySlug ? { storySlug: input.storySlug } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.artifactRoot ? { artifactRoot: input.artifactRoot } : {}),
      ...(input.contextSource ? { contextSource: input.contextSource } : {}),
    },
    control: {
      auditRequired,
      validationLevel,
      strictness,
      generateDoc,
      convergence,
      mandatoryGate,
      granularityGoverned,
      skipAllowed,
      scoringEnabled: scoring.enabled,
      triggerStage,
      reason,
    },
    language: {
      preserveMachineKeys: true,
      preserveParserAnchors: true,
      preserveTriggerStage: true,
    },
  };

  if (input.templateId) {
    policy = mergeRuntimePolicyTemplate(policy, input.templateId, templatesPath, cfg);
  }

  policy = applyRegisteredAugmenters(policy, input);

  return policy;
}
