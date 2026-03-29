export type CoachRunMode = 'manual_or_post_impl' | 'manual_only' | 'post_impl_only';

export interface CoachConfig {
  required_skill_path: string;
  auto_trigger_post_impl: boolean;
  run_mode: CoachRunMode;
}

import type { RunScoreRecord } from '../writer/types';

export interface CoachDiagnoseOptions {
  dataPath?: string;
  rulesDir?: string;
  configPath?: string;
  forbiddenWordsPath?: string;
  personaManifestPath?: string;
  personaPath?: string;
  requiredSkillPath?: string;
  forceSkillLoadError?: boolean;
  epicStoryCount?: number;
  passedStoryCount?: number;
  testStats?: { passed: number; total: number };
  /** Story 6.2: 预筛选 records，非空时跳过 loadRunRecords */
  records?: RunScoreRecord[];
}

import type { WeaknessCluster } from '../analytics/cluster-weaknesses';
import type { JourneyContractRemediationHint } from '../analytics/journey-contract-remediation';

export interface CoachDiagnosisReport {
  summary: string;
  phase_scores: Record<string, number>;
  phase_iteration_counts?: Record<string, number>;
  /** Story 9.4: 各 stage 的评分演进轨迹，如 "第1轮 C → 第2轮 B → 第3轮 A" */
  stage_evolution_traces?: Record<string, string>;
  weak_areas: string[];
  recommendations: string[];
  iteration_passed: boolean;
  weakness_clusters?: WeaknessCluster[];
  journey_contract_hints?: JourneyContractRemediationHint[];
}

export interface CoachRunNotFound {
  error: 'run_not_found';
  run_id: string;
}

export type CoachDiagnoseResult = CoachDiagnosisReport | CoachRunNotFound;
