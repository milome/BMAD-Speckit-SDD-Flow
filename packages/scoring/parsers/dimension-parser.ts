/**
 * Dimension parser: extract dimension scores from report content.
 * Uses code-reviewer-config modes.{mode}.dimensions for weights.
 */
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

/** Single dimension score entry. */
export interface DimensionScore {
  dimension: string;
  weight: number;
  score: number;
}

export type DimensionMode = 'code' | 'prd' | 'arch' | 'pr';

const DIMENSION_SCORE_PATTERN = /^(?:[-*]\s*|\d+\.\s*)?(.+?)\s*[：:]\s*(\d+)\s*[/／]\s*100\s*$/;

function getConfigPath(configPath?: string): string {
  return configPath ?? path.join(process.cwd(), '_bmad', '_config', 'code-reviewer-config.yaml');
}

function loadModeWeights(mode: DimensionMode, configPath?: string): Map<string, number> {
  const resolved = getConfigPath(configPath);
  if (!fs.existsSync(resolved)) return new Map();

  const content = fs.readFileSync(resolved, 'utf-8');
  const parsed = yaml.load(content) as {
    modes?: Partial<Record<DimensionMode, { dimensions?: Array<{ name?: unknown; weight?: unknown }> }>>;
  };
  const dimensions = parsed?.modes?.[mode]?.dimensions;
  if (!Array.isArray(dimensions)) return new Map();

  const map = new Map<string, number>();
  for (const item of dimensions) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const nameEn =
      typeof (item as { name_en?: unknown }).name_en === 'string'
        ? (item as { name_en: string }).name_en.trim()
        : '';
    const weight = typeof item?.weight === 'number' ? item.weight : Number(item?.weight);
    if (!name || !Number.isFinite(weight)) continue;
    map.set(name, weight);
    if (nameEn) {
      map.set(nameEn, weight);
    }
  }
  return map;
}

/**
 * Map audit stage to dimension mode for weight lookup.
 * @param {string} stage - Audit stage string
 * @returns {DimensionMode} DimensionMode (prd, arch, code, or pr)
 */
export function stageToMode(stage: string): DimensionMode {
  switch (stage) {
    case 'prd':
    case 'spec':
    case 'plan':
    case 'gaps':
    case 'tasks':
      return 'prd';
    case 'arch':
      return 'arch';
    case 'story':
    case 'implement':
    case 'post_impl':
      return 'code';
    case 'pr_review':
      return 'pr';
    default:
      return 'code';
  }
}

/**
 * Parse dimension scores from report content. Format: "dimension: score/100".
 * Uses mode weights from code-reviewer-config; returns only dimensions with configured weights.
 * @param {string} content - Report text
 * @param {DimensionMode} mode - Dimension mode for weight lookup
 * @param {string} [configPath] - Optional path to code-reviewer-config.yaml
 * @returns {DimensionScore[]} DimensionScore array
 */
export function parseDimensionScores(
  content: string,
  mode: DimensionMode,
  configPath?: string
): DimensionScore[] {
  try {
    const weights = loadModeWeights(mode, configPath);
    if (weights.size === 0) return [];

    const results: DimensionScore[] = [];
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      const match = line.match(DIMENSION_SCORE_PATTERN);
      if (!match) continue;
      const dimension = match[1].trim();
      const score = Number(match[2]);
      let weight = weights.get(dimension);
      if (weight == null) {
        const lower = dimension.toLowerCase();
        for (const [k, w] of weights) {
          if (k.toLowerCase() === lower) {
            weight = w;
            break;
          }
        }
      }
      if (weight == null || !Number.isFinite(score)) continue;
      results.push({ dimension, weight, score });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * English dimension labels from code-reviewer-config `name_en` (TB.6 WARN / diagnostics).
 * @param mode - Dimension mode
 * @param configPath - Optional config path
 * @returns Ordered list of name_en values (skips entries without name_en)
 */
export function listDimensionNamesEn(mode: DimensionMode, configPath?: string): string[] {
  const resolved = getConfigPath(configPath);
  if (!fs.existsSync(resolved)) return [];

  const content = fs.readFileSync(resolved, 'utf-8');
  const parsed = yaml.load(content) as {
    modes?: Partial<Record<DimensionMode, { dimensions?: Array<{ name_en?: unknown }> }>>;
  };
  const dimensions = parsed?.modes?.[mode]?.dimensions;
  if (!Array.isArray(dimensions)) return [];

  const out: string[] = [];
  for (const item of dimensions) {
    const nameEn = typeof item?.name_en === 'string' ? item.name_en.trim() : '';
    if (nameEn) out.push(nameEn);
  }
  return out;
}
