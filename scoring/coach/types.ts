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

export interface CoachDiagnosisReport {
  summary: string;
  phase_scores: Record<string, number>;
  weak_areas: string[];
  recommendations: string[];
  iteration_passed: boolean;
  weakness_clusters?: WeaknessCluster[];
}

export interface CoachRunNotFound {
  error: 'run_not_found';
  run_id: string;
}

export type CoachDiagnoseResult = CoachDiagnosisReport | CoachRunNotFound;

