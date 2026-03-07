/**
 * Story 9.1 T6: Story 完成自检 - 检查指定 epic/story 是否有评分记录
 * CLI: npx ts-node scripts/check-story-score-written.ts --epic N --story N [--dataPath path]
 */
import { loadAndDedupeRecords } from '../scoring/query/loader';
import { parseEpicStoryFromRecord } from '../scoring/query/parse-epic-story';

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--') && i + 1 < process.argv.length) {
      const key = arg.slice(2);
      const val = process.argv[i + 1];
      if (!val.startsWith('--')) {
        args[key] = val;
        i++;
      }
    }
  }
  return args;
}

function main(): void {
  const args = parseArgs();
  const epicRaw = args.epic;
  const storyRaw = args.story;
  const dataPath = args.dataPath;

  if (!epicRaw || !storyRaw) {
    console.error('Usage: npx ts-node scripts/check-story-score-written.ts --epic N --story N [--dataPath path]');
    process.exit(1);
  }

  const epicId = parseInt(epicRaw, 10);
  const storyId = parseInt(storyRaw, 10);
  if (isNaN(epicId) || isNaN(storyId)) {
    console.error('epic and story must be valid integers');
    process.exit(1);
  }

  const records = loadAndDedupeRecords(dataPath);
  const realDev = records.filter((r) => r.scenario !== 'eval_question');

  const matching = realDev.filter((r) => {
    const parsed = parseEpicStoryFromRecord(r);
    return parsed != null && parsed.epicId === epicId && parsed.storyId === storyId;
  });

  if (matching.length > 0) {
    console.log('STORY_SCORE_WRITTEN:yes');
    console.log(`Found ${matching.length} record(s) for epic=${epicId} story=${storyId}`);
  } else {
    console.log('STORY_SCORE_WRITTEN:no');
    console.log(`No records for epic=${epicId} story=${storyId}`);
  }
}

main();
