/**
 * Story 4.1 T4.1: Epic 8 项判定接口
 */
import type { CheckItem, IterationRecord } from '../writer/types';

export interface EpicStoryRecord {
  veto_triggered: boolean;
  phase_score: number;
  iteration_count: number;
  first_pass: boolean;
  iteration_records: IterationRecord[];
  check_items: CheckItem[];
}

export interface EpicVetoInput {
  storyRecords: EpicStoryRecord[];
  epicStoryCount: number;
  passedStoryCount?: number;
  testStats?: { passed: number; total: number };
}
