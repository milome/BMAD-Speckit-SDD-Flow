/**
 * Story 3.3 T3.2: CLI 入口
 * B04: 支持 --event、--skipTriggerCheck、--sourceHashFilePath、--questionVersion
 */
import * as path from 'path';
import { parseAndWriteScore } from '../scoring/orchestrator';
import { shouldWriteScore } from '../scoring/trigger/trigger-loader';
import type { AuditStage } from '../scoring/parsers';

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

async function main() {
  const args = parseArgs();
  const reportPath = args.reportPath;
  const stage = (args.stage ?? 'prd') as AuditStage;
  const runId = args.runId ?? `cli-${Date.now()}`;
  const scenario = (args.scenario ?? 'real_dev') as 'real_dev' | 'eval_question';
  const writeMode = (args.writeMode ?? 'single_file') as 'single_file' | 'jsonl' | 'both';
  const dataPath = args.dataPath;

  const baseCommitHash = args.baseCommitHash;
  const skipAutoHash = args.skipAutoHash === 'true';
  const sourceHashFilePath = args.sourceHashFilePath;
  const event = args.event ?? 'user_explicit_request';
  const skipTriggerCheck = args.skipTriggerCheck === 'true';
  const triggerStage = args.triggerStage ?? stage;
  const questionVersion = args.questionVersion;

  if (!reportPath) {
    console.error('Usage: npx ts-node scripts/parse-and-write-score.ts --reportPath <path> [--stage prd|arch|story|spec|plan|tasks] [--runId <id>] [--scenario real_dev|eval_question] [--writeMode single_file|jsonl|both] [--dataPath <path>] [--baseCommitHash <hash>] [--skipAutoHash true] [--sourceHashFilePath <path>] [--event <event>] [--triggerStage <stage>] [--skipTriggerCheck true] [--questionVersion <ver>]');
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
    question_version: questionVersion,
  });
  console.log(`parseAndWriteScore: wrote record for runId=${runId}, stage=${stage}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
