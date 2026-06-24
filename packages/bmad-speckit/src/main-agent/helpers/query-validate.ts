const path = require('node:path');
const { loadScoringModule } = require('../../scoring-runtime');

function resolveDataPathFromArgs(argv) {
  const idx = argv.indexOf('--data-path');
  return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : undefined;
}

function runQueryValidation(options = {}) {
  const dataPath = options.dataPath ?? process.env.SCORING_DATA_PATH ?? resolveDataPathFromArgs(options.argv ?? []);
  const resolved = dataPath ? (path.isAbsolute(dataPath) ? dataPath : path.resolve(options.cwd || process.cwd(), dataPath)) : undefined;
  const { queryByEpic, queryByStory, queryLatest } = loadScoringModule('query');
  const byStory = queryByStory(3, 3, resolved);
  const byEpic = queryByEpic(3, resolved);
  const latest = queryLatest(10, resolved);
  return {
    schemaVersion: 'query-validation-result/v1',
    dataPath: resolved ?? null,
    queryByStoryCount: byStory.length,
    queryByEpicCount: byEpic.length,
    queryLatestCount: latest.length,
    newestTimestamp: latest[0]?.timestamp ?? null,
    passed: true,
    exitCode: 0,
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const result = runQueryValidation({ argv, cwd: process.cwd() });
    console.log(JSON.stringify(result, null, 2));
    if (require.main === module) process.exit(result.exitCode);
    return result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (require.main === module) process.exit(1);
    return 1;
  }
}

module.exports = {
  runQueryValidation,
  main,
};
