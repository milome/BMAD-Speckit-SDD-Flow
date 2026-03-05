/**
 * BUGFIX: item_id 映射解析
 * 从 config/audit-item-mapping.yaml 查找报告问题描述对应的标准 item_id；
 * 无匹配时返回 fallback。
 */
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

export type AuditStage = 'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks';

interface MappingCheck {
  text?: string;
  item_id: string;
  patterns?: string[];
}

interface StageMapping {
  empty_overall?: string;
  empty_dimensions?: string;
  checks: Array<{ patterns: string[]; item_id: string }>;
}

let cachedMapping: Record<string, StageMapping> | null = null;

function getMappingPath(): string {
  const root = process.cwd();
  return path.join(root, 'config', 'audit-item-mapping.yaml');
}

function loadMapping(): Record<string, StageMapping> {
  if (cachedMapping) return cachedMapping;
  const filePath = getMappingPath();
  if (!fs.existsSync(filePath)) {
    cachedMapping = {
      prd: { checks: [] },
      arch: { checks: [] },
      story: { checks: [] },
      spec: { checks: [] },
      plan: { checks: [] },
      tasks: { checks: [] },
    };
    return cachedMapping;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const doc = yaml.load(content) as Record<string, unknown>;
  const result: Record<string, StageMapping> = {};

  for (const stage of ['prd', 'arch', 'story', 'spec', 'plan', 'tasks']) {
    const stageDoc = doc[stage] as Record<string, unknown> | undefined;
    const checks: Array<{ patterns: string[]; item_id: string }> = [];

    if (stageDoc?.dimensions && Array.isArray(stageDoc.dimensions)) {
      for (const dim of stageDoc.dimensions) {
        const d = dim as { checks?: MappingCheck[] };
        if (d.checks) {
          for (const c of d.checks) {
            const patterns: string[] = [];
            if (c.text) patterns.push(c.text);
            if (c.patterns) patterns.push(...c.patterns);
            if (patterns.length > 0) {
              checks.push({ patterns, item_id: c.item_id });
            }
          }
        }
      }
    }

    if (stageDoc?.checks && Array.isArray(stageDoc.checks)) {
      for (const c of stageDoc.checks as MappingCheck[]) {
        const patterns: string[] = [];
        if (c.text) patterns.push(c.text);
        if (c.patterns) patterns.push(...c.patterns);
        if (patterns.length > 0) {
          checks.push({ patterns, item_id: c.item_id });
        }
      }
    }

    result[stage] = {
      empty_overall: (stageDoc as { empty_overall?: string })?.empty_overall,
      empty_dimensions: (stageDoc as { empty_dimensions?: string })?.empty_dimensions,
      checks,
    };
  }

  cachedMapping = result;
  return result;
}

/**
 * 根据问题描述 note 查找标准 item_id，无匹配时返回 fallback。
 * 匹配规则：note 包含任一 patterns 时使用对应 item_id；按顺序尝试，先匹配优先。
 */
export function resolveItemId(stage: AuditStage, note: string, fallback: string): string {
  const mapping = loadMapping();
  const stageMap = mapping[stage];
  if (!stageMap || stageMap.checks.length === 0) return fallback;

  for (const { patterns, item_id } of stageMap.checks) {
    for (const p of patterns) {
      if (note.includes(p)) return item_id;
    }
  }
  return fallback;
}

/**
 * 获取空清单/从维度评分时的 item_id（若映射表有定义则用映射，否则用传入的 fallback）。
 */
export function resolveEmptyItemId(
  stage: AuditStage,
  type: 'overall' | 'dimensions',
  fallback: string
): string {
  const mapping = loadMapping();
  const stageMap = mapping[stage];
  if (!stageMap) return fallback;

  if (type === 'overall' && stageMap.empty_overall) return stageMap.empty_overall;
  if (type === 'dimensions' && stageMap.empty_dimensions) return stageMap.empty_dimensions;
  return fallback;
}
