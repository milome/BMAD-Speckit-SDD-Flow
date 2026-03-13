/**
 * Story 2.1: YAML 规则解析器，支持 ref 解析并关联 code-reviewer-config
 * Architecture §2、§9，plan-E2-S1 §3
 */
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import type {
  PhaseScoringYaml,
  GapsScoringYaml,
  IterationTierYaml,
  ResolvedItem,
} from './types';
import { RefResolutionError } from './types';

const REF_PATTERN = /^code-reviewer-config#([a-zA-Z0-9_]+)$/;

function getRulesDir(options?: { rulesDir?: string }): string {
  const root = process.cwd();
  return options?.rulesDir ?? path.join(root, 'scoring', 'rules');
}

function getConfigPath(options?: { configPath?: string }): string {
  const root = process.cwd();
  return options?.configPath ?? path.join(root, 'config', 'code-reviewer-config.yaml');
}

/**
 * 加载并解析 code-reviewer-config.yaml
 * @param {string} configPath - Config path
 * @returns {object} Config object with items and veto_items
 */
function loadCodeReviewerConfig(configPath: string): {
  items?: Record<string, { name?: string; description?: string; [k: string]: unknown }>;
  veto_items?: Record<string, { name?: string; consequence?: string; [k: string]: unknown }>;
} {
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(content) as Record<string, unknown>;
  return {
    items: config.items as Record<string, { name?: string; description?: string }> | undefined,
    veto_items: config.veto_items as Record<string, { name?: string; consequence?: string }> | undefined,
  };
}

/**
 * Resolve ref (code-reviewer-config#item_id) to ResolvedItem from code-reviewer-config.
 * @param {string} ref - Reference string, e.g. code-reviewer-config#item_id
 * @param {string} [configPath] - Optional path to code-reviewer-config.yaml
 * @returns {ResolvedItem} ResolvedItem with item_id, name, description
 * @throws {RefResolutionError} If item_id not found in config
 */
export function resolveRef(ref: string, configPath?: string): ResolvedItem {
  const m = ref.match(REF_PATTERN);
  if (!m) {
    throw new RefResolutionError(ref, ref, configPath);
  }
  const itemId = m[1];
  const cfgPath = configPath ?? getConfigPath();
  const config = loadCodeReviewerConfig(cfgPath);

  // veto_* 查 veto_items，否则查 items
  if (itemId.startsWith('veto_')) {
    const v = config.veto_items?.[itemId];
    if (!v) {
      throw new RefResolutionError(ref, itemId, cfgPath);
    }
    return { item_id: itemId, name: v.name, ...v };
  }
  const item = config.items?.[itemId];
  if (!item) {
    throw new RefResolutionError(ref, itemId, cfgPath);
  }
  return { item_id: itemId, name: item.name, description: item.description, ...item };
}

/**
 * 加载环节 2/3/4 的 YAML
 * @param {2 | 3 | 4} phase - Phase number
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @param {string} [options.configPath] - Config path
 * @returns {PhaseScoringYaml} PhaseScoringYaml
 */
export function loadPhaseScoringYaml(
  phase: 2 | 3 | 4,
  options?: { rulesDir?: string; configPath?: string }
): PhaseScoringYaml {
  const rulesDir = getRulesDir(options);
  const files: Record<number, string> = {
    2: 'implement-scoring.yaml',
    3: 'test-scoring.yaml',
    4: 'bugfix-scoring.yaml',
  };
  const filePath = path.join(rulesDir, 'default', files[phase]);
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content) as PhaseScoringYaml;
  validatePhaseScoringYaml(parsed, options?.configPath);
  return parsed;
}

/**
 * Load spec/plan/tasks stage scoring YAML (Story 5.2 B03).
 * @param {'spec' | 'plan' | 'tasks'} stage - spec, plan, or tasks
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @param {string} [options.configPath] - Config path
 * @returns {PhaseScoringYaml} PhaseScoringYaml
 * @throws {Error} If file invalid
 */
export function loadStageScoringYaml(
  stage: 'spec' | 'plan' | 'tasks',
  options?: { rulesDir?: string; configPath?: string }
): PhaseScoringYaml {
  const rulesDir = getRulesDir(options);
  const files: Record<'spec' | 'plan' | 'tasks', string> = {
    spec: 'spec-scoring.yaml',
    plan: 'plan-scoring.yaml',
    tasks: 'tasks-scoring.yaml',
  };
  const filePath = path.join(rulesDir, files[stage]);
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content) as PhaseScoringYaml;
  validatePhaseScoringYaml(parsed, options?.configPath);
  return parsed;
}

/**
 * Load gaps-scoring.yaml from rules directory.
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @returns {GapsScoringYaml} GapsScoringYaml
 * @throws {Error} If version, stage, or weights missing
 */
export function loadGapsScoringYaml(options?: { rulesDir?: string }): GapsScoringYaml {
  const rulesDir = getRulesDir(options);
  const filePath = path.join(rulesDir, 'gaps-scoring.yaml');
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content) as GapsScoringYaml;
  if (!parsed.version || !parsed.stage || !parsed.weights) {
    throw new Error('Invalid gaps-scoring.yaml: missing version, stage, or weights');
  }
  return parsed;
}

/**
 * Load iteration-tier.yaml from rules directory.
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @returns {IterationTierYaml} IterationTierYaml
 * @throws {Error} If iteration_tier missing
 */
export function loadIterationTierYaml(options?: { rulesDir?: string }): IterationTierYaml {
  const rulesDir = getRulesDir(options);
  const filePath = path.join(rulesDir, 'iteration-tier.yaml');
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content) as IterationTierYaml;
  if (!parsed.iteration_tier || typeof parsed.iteration_tier !== 'object') {
    throw new Error('Invalid iteration-tier.yaml: missing iteration_tier');
  }
  return parsed;
}

/**
 * 校验环节 2/3/4 YAML 并解析所有 ref（确保 item_id 存在）
 * @param {PhaseScoringYaml} y - Phase scoring YAML
 * @param {string} [configPath] - Config path
 */
function validatePhaseScoringYaml(y: PhaseScoringYaml, configPath?: string): void {
  if (!y.version || !y.stage || !y.link_stage || !y.weights || !y.items) {
    throw new Error('Invalid phase scoring YAML: missing version, stage, link_stage, weights, or items');
  }
  for (const item of y.items) {
    if (!item.id || !item.ref || typeof item.deduct !== 'number') {
      throw new Error(`Invalid item: missing id, ref, or deduct`);
    }
    if (!REF_PATTERN.test(item.ref)) {
      throw new Error(`Invalid ref format: ${item.ref}, expected code-reviewer-config#item_id`);
    }
    resolveRef(item.ref, configPath);
  }
  for (const v of y.veto_items ?? []) {
    if (!v.id || !v.ref || !v.consequence) {
      throw new Error(`Invalid veto_item: missing id, ref, or consequence`);
    }
    if (!REF_PATTERN.test(v.ref)) {
      throw new Error(`Invalid ref format: ${v.ref}`);
    }
    resolveRef(v.ref, configPath);
  }
}

