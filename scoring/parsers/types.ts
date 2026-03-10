/**
 * Story 2.1: 环节 2/3/4、gaps、iteration-tier 的 YAML 类型定义
 * Architecture §9、plan-E2-S1 §2
 */

export interface PhaseScoringItem {
  id: string;
  ref: string;
  deduct: number;
}

export interface PhaseScoringVetoItem {
  id: string;
  ref: string;
  consequence: string;
}

export interface PhaseScoringYaml {
  version: string;
  stage: string;
  link_stage: string[];
  link_环节: number;
  weights: { base: Record<string, number>; bonus?: Record<string, number> };
  items: PhaseScoringItem[];
  veto_items?: PhaseScoringVetoItem[];
}

export interface GapsScoringYaml {
  version: string;
  stage: string;
  link_stage: string[];
  link_环节: number;
  weights: {
    base: Record<string, number>;
    post_implement?: Record<string, number>;
    post_post_impl?: Record<string, number>;
  };
  veto_items?: PhaseScoringVetoItem[];
}

export interface IterationTierYaml {
  iteration_tier: Record<number, number>;
  severity_override?: Record<string, number>;
}

export interface ResolvedItem {
  item_id: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export class RefResolutionError extends Error {
  constructor(
    public readonly ref: string,
    public readonly itemId: string,
    public readonly configPath?: string
  ) {
    super(`Ref resolution failed: ${ref} (item_id=${itemId}) not found in config${configPath ? ` at ${configPath}` : ''}`);
    this.name = 'RefResolutionError';
  }
}
