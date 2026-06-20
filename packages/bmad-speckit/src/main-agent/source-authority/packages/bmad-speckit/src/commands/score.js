/**
 * Score subcommand: parse audit report and write scoring record.
 * Ported from scripts/parse-and-write-score.ts to JS for CLI integration.
 *
 * Exit codes: 0=success, 1=param/validation error, 3=trigger disabled
 */
const { loadScoringModule } = require('../scoring-runtime');
const scoringOrchestrator = loadScoringModule('orchestrator');
const { shouldWriteScore } = loadScoringModule('trigger/trigger-loader');
const runtimeClientModule = require('../runtime-client');

function parseEpicStoryFromPath(reportPath) {
  if (!reportPath) return {};
  const fileMatch = reportPath.match(/[Ee](\d+)[-_]?[Ss](\d+)/);
  if (fileMatch) return { epic: fileMatch[1], story: fileMatch[2] };
  const dirMatch = reportPath.match(/story-(\d+)-(\d+)/);
  if (dirMatch) return { epic: dirMatch[1], story: dirMatch[2] };
  return {};
}

function isAuditPassedEvent(event, triggerStage) {
  const candidates = [event, triggerStage]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return candidates.some((value) =>
    value === 'stage_audit_complete' ||
    value === 'post_audit_passed' ||
    value.endsWith('_audit_passed') ||
    value.endsWith('_passed')
  );
}

function shouldAutoWriteScopedBundle({ scenario, stage, phaseScore, reportPath, artifactDocPath, event, triggerStage }) {
  if (scenario !== 'real_dev') return false;
  if (stage !== 'implement' && stage !== 'post_audit' && stage !== 'post_impl') return false;
  if (typeof phaseScore !== 'number' || phaseScore < 90) return false;
  if (!isAuditPassedEvent(event, triggerStage)) return false;
  return Boolean(artifactDocPath || reportPath);
}

async function maybeWriteScopedBundle({
  scenario,
  stage,
  phaseScore,
  reportPath,
  artifactDocPath,
  dataPath,
  event,
  triggerStage,
  createRuntimeClient,
  deriveSourceScopeFromPath,
}) {
  if (!shouldAutoWriteScopedBundle({ scenario, stage, phaseScore, reportPath, artifactDocPath, event, triggerStage })) {
    return null;
  }

  const scopeSource = artifactDocPath || reportPath;
  const sourceScope = deriveSourceScopeFromPath(scopeSource);
  if (!sourceScope || sourceScope.scope_type === 'global') {
    return null;
  }

  const client = createRuntimeClient({ cwd: process.cwd(), dataPath });
  return client.request('writeSftBundle', {
    dataPath,
    target: 'openai_chat',
    minScore: 90,
    bundleDir: '_bmad-output/datasets',
    sourceScope,
  });
}

async function scoreCommand(opts, deps = {}) {
  const parseAndWriteScore = deps.parseAndWriteScore || scoringOrchestrator.parseAndWriteScore;
  const createRuntimeClient = deps.createRuntimeClient || runtimeClientModule.createRuntimeClient;
  const deriveSourceScopeFromPath = deps.deriveSourceScopeFromPath || runtimeClientModule.deriveSourceScopeFromPath;
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
  const host = opts.host;
  const hostKind = opts.hostKind;
  const providerId = opts.providerId;
  const providerMode = opts.providerMode;
  const toolTraceRef = opts.toolTraceRef;
  const toolTracePath = opts.toolTracePath;
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

  const parsedRecord = await Promise.resolve(parseAndWriteScore({
    reportPath,
    stage,
    runId,
    scenario,
    writeMode: effectiveWriteMode,
    dataPath,
    baseCommitHash,
    sourceHashFilePath,
    artifactDocPath,
    host,
    host_kind: hostKind,
    provider_id: providerId,
    provider_mode: providerMode,
    tool_trace_ref: toolTraceRef,
    tool_trace_path: toolTracePath,
    question_version: questionVersion,
    iteration_count: iterationCount,
    triggerStage: triggerStage !== stage ? triggerStage : undefined,
    iterationReportPaths: iterationReportPaths.length > 0 ? iterationReportPaths : undefined,
  }));

  const effectivePhaseScore =
    parsedRecord && typeof parsedRecord.phase_score === 'number'
      ? parsedRecord.phase_score
      : undefined;

  if (effectivePhaseScore == null) {
    console.warn(`WARN: parseAndWriteScore did not return phase_score; got ${JSON.stringify(parsedRecord)}; skipping auto scoped bundle export.`);
  }

  const bundleResult = await maybeWriteScopedBundle({
    scenario,
    stage,
    phaseScore: effectivePhaseScore,
    reportPath,
    artifactDocPath,
    dataPath,
    event,
    triggerStage,
    createRuntimeClient,
    deriveSourceScopeFromPath,
  });

  console.log(`parseAndWriteScore: wrote record for runId=${runId}, stage=${stage}`);
  if (bundleResult) {
    console.log(`sft-bundle: wrote scoped bundle ${bundleResult.bundle_id}`);
  }

  return {
    runId,
    stage,
    parsedRecord,
    bundleResult: bundleResult || null,
  };
}

module.exports = { scoreCommand };
