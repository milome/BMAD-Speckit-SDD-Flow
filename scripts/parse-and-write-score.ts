/**
 * Story 3.3 T3.2: CLI 入口
 * B04: 支持 --event、--skipTriggerCheck、--sourceHashFilePath、--questionVersion
 */
import { parseAndWriteScore } from '../scoring/orchestrator';
import { shouldWriteScore } from '../scoring/trigger/trigger-loader';
import type { AuditStage } from '../scoring/parsers';

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx >= 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key && val !== undefined) args[key] = val;
    } else {
      const key = arg.slice(2);
      const val = i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
      if (val != null && !val.startsWith('--')) {
        args[key] = val;
        i++;
      }
    }
  }
  return args;
}

/** 从 reportPath 解析 epic/story：正则 E6-S3 / e6-s3 或目录 story-6-3- */
function parseEpicStoryFromPath(reportPath: string): { epic?: string; story?: string } {
  if (!reportPath) return {};
  const fileMatch = reportPath.match(/[Ee](\d+)[-_]?[Ss](\d+)/);
  if (fileMatch) return { epic: fileMatch[1], story: fileMatch[2] };
  const dirMatch = reportPath.match(/story-(\d+)-(\d+)/);
  if (dirMatch) return { epic: dirMatch[1], story: dirMatch[2] };
  return {};
}

async function main() {
  const args = parseArgs();
  const reportPath = args.reportPath;
  const stage = (args.stage ?? 'prd') as AuditStage;
  const epic = args.epic;
  const story = args.story;

  let runId = args.runId ?? args.runGroupId;
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
  const scenario = (args.scenario ?? 'real_dev') as 'real_dev' | 'eval_question';
  const writeMode = (args.writeMode ?? 'single_file') as 'single_file' | 'jsonl' | 'both';
  const dataPath = args.dataPath;

  const baseCommitHash = args.baseCommitHash;
  const skipAutoHash = args.skipAutoHash === 'true';
  const sourceHashFilePath = args.sourceHashFilePath;
  const artifactDocPath = args.artifactDocPath;
  const event = args.event ?? 'user_explicit_request';
  const skipTriggerCheck = args.skipTriggerCheck === 'true';
  const triggerStage = args.triggerStage ?? stage;
  const questionVersion = args.questionVersion;
  const iterationCountRaw = args['iteration-count'] ?? args.iterationCount;
  const iterationCountParsed =
    iterationCountRaw != null ? parseInt(iterationCountRaw, 10) : undefined;
  const iterationCount =
    iterationCountParsed != null && !isNaN(iterationCountParsed)
      ? iterationCountParsed
      : undefined;

  const iterationReportPathsRaw = args.iterationReportPaths;
  const iterationReportPaths: string[] =
    iterationReportPathsRaw != null && iterationReportPathsRaw.trim().length > 0
      ? iterationReportPathsRaw.split(',').map((p) => p.trim()).filter(Boolean)
      : [];

  if (!reportPath) {
    console.error('Usage: npx ts-node scripts/parse-and-write-score.ts --reportPath <path> [--stage prd|arch|story|spec|plan|tasks|implement] [--runId <id>] [--epic N] [--story N] [--scenario real_dev|eval_question] [--writeMode single_file|jsonl|both] [--dataPath <path>] [--baseCommitHash <hash>] [--skipAutoHash true] [--sourceHashFilePath <path>] [--artifactDocPath <path>] [--event <event>] [--triggerStage <stage>] [--skipTriggerCheck true] [--questionVersion <ver>] [--iteration-count N] [--iterationReportPaths path1,path2,...]\n  --epic, --story: 可选；用于生成 runId=dev-e{epic}-s{story}-{stage}-{ts}；未传时尝试从 reportPath 解析（E6-S3、story-6-3- 等）\n  --iteration-count: 该 stage 审计未通过（fail）次数，0 表示一次通过；执行审计循环的 Agent 在 pass 时传入当前累计值\n  --iterationReportPaths: 逗号分隔的失败轮报告路径列表（不含验证轮）；仅 scenario=real_dev 时生效，pass 时一次性解析并写入 iteration_records');
    process.exit(1);
  }

  let effectiveWriteMode = writeMode;
  if (!skipTriggerCheck) {
    const decision = shouldWriteScore(event, triggerStage, scenario);
    if (!decision.write) {
      console.error(`Trigger check failed: ${decision.reason}`);
      process.exit(1);
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
    skipAutoHash,
    sourceHashFilePath,
    artifactDocPath,
    question_version: questionVersion,
    iteration_count: iterationCount,
    triggerStage: triggerStage !== stage ? triggerStage : undefined,
    iterationReportPaths: iterationReportPaths.length > 0 ? iterationReportPaths : undefined,
  });
  console.log(`parseAndWriteScore: wrote record for runId=${runId}, stage=${stage}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
