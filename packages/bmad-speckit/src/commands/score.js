/**
 * Score subcommand: parse audit report and write scoring record.
 * Ported from scripts/parse-and-write-score.ts to JS for CLI integration.
 *
 * Exit codes: 0=success, 1=param/validation error, 3=trigger disabled
 */
const { parseAndWriteScore } = require('@bmad-speckit/scoring/orchestrator');
const { shouldWriteScore } = require('@bmad-speckit/scoring/trigger/trigger-loader');

function parseEpicStoryFromPath(reportPath) {
  if (!reportPath) return {};
  const fileMatch = reportPath.match(/[Ee](\d+)[-_]?[Ss](\d+)/);
  if (fileMatch) return { epic: fileMatch[1], story: fileMatch[2] };
  const dirMatch = reportPath.match(/story-(\d+)-(\d+)/);
  if (dirMatch) return { epic: dirMatch[1], story: dirMatch[2] };
  return {};
}

async function scoreCommand(opts) {
  const reportPath = opts.reportPath;
  const stage = opts.stage || 'prd';
  const epic = opts.epic;
  const story = opts.story;

  let runId = opts.runId;
  if (!runId) {
    if (epic && story) {
      runId = `dev-e${epic}-s${story}-${stage}-${Date.now()}`;
    } else {
      const parsed = parseEpicStoryFromPath(reportPath);
      if (parsed.epic && parsed.story) {
        runId = `dev-e${parsed.epic}-s${parsed.story}-${stage}-${Date.now()}`;
      } else {
        runId = `cli-${Date.now()}`;
      }
    }
  }

  const scenario = opts.scenario || 'real_dev';
  const writeMode = opts.writeMode || 'single_file';
  const dataPath = opts.dataPath;
  const baseCommitHash = opts.baseCommitHash;
  const sourceHashFilePath = opts.sourceHashFilePath;
  const artifactDocPath = opts.artifactDocPath;
  const event = opts.event || 'user_explicit_request';
  const agent = opts.agent;
  const source = opts.source;
  const skipTriggerCheck = opts.skipTriggerCheck === true || opts.skipTriggerCheck === 'true';
  const triggerStage = opts.triggerStage || stage;
  const questionVersion = opts.questionVersion;

  const iterationCountRaw = opts.iterationCount;
  const iterationCountParsed =
    iterationCountRaw != null ? parseInt(iterationCountRaw, 10) : undefined;
  const iterationCount =
    iterationCountParsed != null && !isNaN(iterationCountParsed) ? iterationCountParsed : undefined;

  const iterationReportPathsRaw = opts.iterationReportPaths;
  const iterationReportPaths =
    iterationReportPathsRaw != null && String(iterationReportPathsRaw).trim().length > 0
      ? String(iterationReportPathsRaw)
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

  if (!reportPath) {
    console.error(
      'Error: --reportPath is required.\n' +
        'Usage: bmad-speckit score --reportPath <path> [--stage prd|arch|story|spec|plan|gaps|tasks|implement] [--runId <id>] [--epic N] [--story N]'
    );
    process.exit(1);
  }

  if (agent != null && !['cursor', 'claude-code'].includes(agent)) {
    console.error(`Unsupported --agent value: ${agent}`);
    process.exit(1);
  }

  if (source != null && !['cursor_command', 'claude_agent', 'claude_hook'].includes(source)) {
    console.error(`Unsupported --source value: ${source}`);
    process.exit(1);
  }

  let effectiveWriteMode = writeMode;
  if (!skipTriggerCheck) {
    const decision = shouldWriteScore(event, triggerStage, scenario);
    if (!decision.write) {
      console.error(`Trigger check failed: ${decision.reason}`);
      process.exit(3);
    }
    effectiveWriteMode = decision.writeMode;
  }

  await parseAndWriteScore({
    reportPath,
    stage,
    runId,
    scenario,
    writeMode: effectiveWriteMode,
    dataPath,
    baseCommitHash,
    sourceHashFilePath,
    artifactDocPath,
    question_version: questionVersion,
    iteration_count: iterationCount,
    triggerStage: triggerStage !== stage ? triggerStage : undefined,
    iterationReportPaths: iterationReportPaths.length > 0 ? iterationReportPaths : undefined,
  });
  console.log(`parseAndWriteScore: wrote record for runId=${runId}, stage=${stage}`);
}

module.exports = { scoreCommand };
