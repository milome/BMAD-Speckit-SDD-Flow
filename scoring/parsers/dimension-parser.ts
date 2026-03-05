import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

export interface DimensionScore {
  dimension: string;
  weight: number;
  score: number;
}

export type DimensionMode = 'code' | 'prd' | 'arch' | 'pr';

const DIMENSION_SCORE_PATTERN = /^(?:[-*]\s*|\d+\.\s*)?(.+?)\s*[：:]\s*(\d+)\s*[\/／]\s*100\s*$/;

function getConfigPath(configPath?: string): string {
  return configPath ?? path.join(process.cwd(), 'config', 'code-reviewer-config.yaml');
}

function loadModeWeights(mode: DimensionMode, configPath?: string): Map<string, number> {
  const resolved = getConfigPath(configPath);
  if (!fs.existsSync(resolved)) return new Map();

  const content = fs.readFileSync(resolved, 'utf-8');
  const parsed = yaml.load(content) as Record<string, any>;
  const dimensions = parsed?.modes?.[mode]?.dimensions;
  if (!Array.isArray(dimensions)) return new Map();

  const map = new Map<string, number>();
  for (const item of dimensions) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const weight = typeof item?.weight === 'number' ? item.weight : Number(item?.weight);
    if (!name || !Number.isFinite(weight)) continue;
    map.set(name, weight);
  }
  return map;
}

export function stageToMode(stage: string): DimensionMode {
  switch (stage) {
    case 'prd':
    case 'spec':
    case 'plan':
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
      const weight = weights.get(dimension);
      if (weight == null || !Number.isFinite(score)) continue;
      results.push({ dimension, weight, score });
    }

    return results;
  } catch {
    return [];
  }
}
