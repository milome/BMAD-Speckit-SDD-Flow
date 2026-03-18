/**
 * Check-score subcommand: check if epic/story has scoring records.
 * Ported from scripts/check-story-score-written.ts to JS for CLI integration.
 *
 * Exit codes: 0=has records, 1=no records or param error
 */
const { loadAndDedupeRecords } = require('@bmad-speckit/scoring/query/loader');
const { parseEpicStoryFromRecord } = require('@bmad-speckit/scoring/query/parse-epic-story');

function checkScoreCommand(opts) {
  const epicRaw = opts.epic;
  const storyRaw = opts.story;
  const dataPath = opts.dataPath;
  const stageFilter = opts.stage;

  if (!epicRaw || !storyRaw) {
    console.error(
      'Usage: bmad-speckit check-score --epic N --story N [--dataPath path] [--stage story|implement]'
    );
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

  let matching = realDev.filter((r) => {
    const parsed = parseEpicStoryFromRecord(r);
    return parsed != null && parsed.epicId === epicId && parsed.storyId === storyId;
  });

  if (stageFilter === 'story') {
    matching = matching.filter(
      (r) => r.stage === 'story' || r.trigger_stage === 'bmad_story_stage2'
    );
  } else if (stageFilter === 'implement') {
    matching = matching.filter(
      (r) => r.stage === 'implement' || r.trigger_stage === 'bmad_story_stage4'
    );
  }

  if (matching.length > 0) {
    console.log('STORY_SCORE_WRITTEN:yes');
    console.log(`Found ${matching.length} record(s) for epic=${epicId} story=${storyId}`);
    const hasMissingDimensions = matching.some(
      (r) =>
        r.stage === 'implement' &&
        (!r.dimension_scores || r.dimension_scores.length === 0)
    );
    if (hasMissingDimensions) {
      console.log('DIMENSION_SCORES_MISSING:yes');
    }
  } else {
    console.log('STORY_SCORE_WRITTEN:no');
    console.log(`No records for epic=${epicId} story=${storyId}`);
  }
}

module.exports = { checkScoreCommand };
