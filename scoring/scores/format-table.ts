/**
 * Story 6.4: 评分记录格式化为 Markdown 表格
 */
import { parseEpicStoryFromRecord } from '../query';
import type { RunScoreRecord } from '../writer/types';

export type ScoresTableMode = 'all' | 'epic' | 'story';

export function formatScoresToTable(
  records: RunScoreRecord[],
  mode: ScoresTableMode
): string {
  if (records.length === 0) return '';
  const sorted = [...records].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return tb - ta;
  });

  if (mode === 'all') {
    const header =
      '| run_id | epic | story | stage | phase_score | phase_weight | timestamp |';
    const sep =
      '|-------|------|-------|-------|-------------|--------------|-----------|';
    const rows = sorted.map((r) => {
      const parsed = parseEpicStoryFromRecord(r);
      const epic = parsed ? String(parsed.epicId) : '-';
      const story = parsed ? String(parsed.storyId) : '-';
      return `| ${r.run_id} | ${epic} | ${story} | ${r.stage} | ${r.phase_score} | ${r.phase_weight} | ${r.timestamp} |`;
    });
    return [header, sep, ...rows].join('\n');
  }

  if (mode === 'epic') {
    const header =
      '| story | stage | phase_score | phase_weight | timestamp |';
    const sep = '|-------|-------|-------------|--------------|-----------|';
    const rows = sorted.map((r) => {
      const parsed = parseEpicStoryFromRecord(r);
      const story = parsed ? `${parsed.epicId}.${parsed.storyId}` : '-';
      return `| ${story} | ${r.stage} | ${r.phase_score} | ${r.phase_weight} | ${r.timestamp} |`;
    });
    return [header, sep, ...rows].join('\n');
  }

  const header =
    '| stage | phase_score | phase_weight | check_items_summary | timestamp |';
  const sep =
    '|-------|-------------|--------------|---------------------|-----------|';
  const rows = sorted.map((r) => {
    let summary = '-';
    if (r.check_items && r.check_items.length > 0) {
      const passed = r.check_items.filter((c) => c.passed).length;
      summary = `${passed}/${r.check_items.length} passed`;
    }
    return `| ${r.stage} | ${r.phase_score} | ${r.phase_weight} | ${summary} | ${r.timestamp} |`;
  });
  return [header, sep, ...rows].join('\n');
}
