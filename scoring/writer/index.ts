/**
 * Story 1.2 eval-system-storage-writer: write one score record by mode.
 * Modes: single_file (overwrite {run_id}.json), jsonl (append scores.jsonl), both.
 */
export type { RunScoreRecord, CheckItem, IterationRecord, WriteMode, WriteScoreRecordOptions } from './types';
export { validateRunScoreRecord, validateScenarioConstraints } from './validate';
export {
  ensureDataDir,
  writeSingleFile,
  appendJsonl,
  writeScoreRecordSync,
} from './write-score';

import { writeScoreRecordSync } from './write-score';
import type { RunScoreRecord, WriteMode, WriteScoreRecordOptions } from './types';

export async function writeScoreRecord(
  record: RunScoreRecord,
  mode: WriteMode,
  options?: WriteScoreRecordOptions
): Promise<void> {
  writeScoreRecordSync(record, mode, options);
}
