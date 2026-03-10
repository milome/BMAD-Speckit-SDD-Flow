/**
 * Story 6.3: epic_id/story_id 解析
 * run_id 正则匹配 -eN-sN- 或 -eN-sN 结尾
 * source_path fallback: story 路径优先，epic 路径次之（见 RUN_ID_CONVENTION）
 */
import type { RunScoreRecord } from '../writer/types';

const RUN_ID_RE = /-e(\d+)-s(\d+)(?:-|$)/;
const SOURCE_PATH_STORY_RE = /story-(\d+)-(\d+)-/;
const SOURCE_PATH_EPIC_RE = /epic-(\d+)-[^/]*\/story-(\d+)-/;

/**
 * 从 record 解析 epicId、storyId。
 * 优先 run_id 正则，其次 source_path fallback（story 路径优先、epic 路径次之）。
 */
export function parseEpicStoryFromRecord(
  record: RunScoreRecord
): { epicId: number; storyId: number } | null {
  const fromRunId = record.run_id.match(RUN_ID_RE);
  if (fromRunId) {
    return {
      epicId: parseInt(fromRunId[1]!, 10),
      storyId: parseInt(fromRunId[2]!, 10),
    };
  }
  if (record.source_path) {
    let m = record.source_path.match(SOURCE_PATH_STORY_RE);
    if (m) {
      return {
        epicId: parseInt(m[1], 10),
        storyId: parseInt(m[2], 10),
      };
    }
    m = record.source_path.match(SOURCE_PATH_EPIC_RE);
    if (m) {
      return {
        epicId: parseInt(m[1], 10),
        storyId: parseInt(m[2], 10),
      };
    }
  }
  return null;
}
