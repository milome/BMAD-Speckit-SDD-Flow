/**
 * T3: 从 coach-diagnose 的 weak_areas、weakness_clusters 自动生成 eval_question 题目
 * 用法：
 *   npx ts-node scripts/eval-question-generate.ts --run-id <id> [--version v1|v2] [--outputDir <dir>]
 *   npx ts-node scripts/eval-question-generate.ts --input <coach-diagnose JSON 路径> [--version v1|v2] [--outputDir <dir>]
 */
import * as fs from 'fs';
import * as path from 'path';
import { coachDiagnose } from '../scoring/coach';
import { getScoringDataPath } from '../scoring/constants/path';
import {
  generateQuestionTemplate,
  addQuestionToManifest,
  generateSlugFromTitle,
} from '../scoring/eval-questions/template-generator';
import type { EvalQuestionEntry } from '../scoring/eval-questions/manifest-loader';
import type { WeaknessCluster } from '../scoring/analytics/cluster-weaknesses';

const DEFAULT_VERSION = 'v1';
const EVAL_ROOT = path.resolve(process.cwd(), 'scoring', 'eval-questions');

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    const key = eqIdx >= 0 ? arg.slice(2, eqIdx) : arg.slice(2);
    const value = eqIdx >= 0 ? arg.slice(eqIdx + 1) : argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      if (eqIdx < 0) i++;
    }
  }
  return args;
}

function getOutputDir(version: string, outputDirArg?: string): string {
  if (outputDirArg) {
    return path.isAbsolute(outputDirArg)
      ? outputDirArg
      : path.resolve(process.cwd(), outputDirArg);
  }
  return path.join(EVAL_ROOT, version);
}

function ensureManifestExists(dir: string): void {
  const manifestPath = path.join(dir, 'manifest.yaml');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(
      manifestPath,
      'questions: []\n',
      'utf-8'
    );
  }
}

interface CoachReportInput {
  weak_areas?: string[];
  weakness_clusters?: WeaknessCluster[];
}

async function loadReport(runId?: string, inputPath?: string): Promise<CoachReportInput> {
  if (inputPath) {
    const resolved = path.isAbsolute(inputPath)
      ? inputPath
      : path.resolve(process.cwd(), inputPath);
    if (!fs.existsSync(resolved)) {
      console.error(`Input file not found: ${resolved}`);
      process.exit(1);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    const parsed = JSON.parse(content) as CoachReportInput;
    return parsed;
  }
  if (runId) {
    const dataPath = getScoringDataPath();
    const result = await coachDiagnose(runId, { dataPath });
    if ('error' in result && result.error === 'run_not_found') {
      console.error('run 不存在');
      process.exit(1);
    }
    return result as CoachReportInput;
  }
  console.error('Usage: --run-id <id> or --input <coach-diagnose JSON path> required');
  process.exit(1);
}

function buildQuestionsFromReport(report: CoachReportInput): { title: string }[] {
  const questions: { title: string }[] = [];
  const weakAreas = report.weak_areas ?? [];
  const clusters = report.weakness_clusters ?? [];

  for (const stage of weakAreas) {
    questions.push({ title: `如何改进 ${stage} 阶段的短板` });
  }
  for (const c of clusters) {
    const stages = (c.affected_stages ?? []).join(',') || '多阶段';
    const keywords = (c.keywords ?? []).join(',') || '短板';
    questions.push({ title: `如何提升 ${stages} 的 ${keywords}` });
  }
  return questions;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runId = args['run-id'] ?? args.runId;
  const inputPath = args.input;
  const version = args.version ?? DEFAULT_VERSION;
  const outputDirArg = args.outputDir ?? args['output-dir'];

  if (!runId && !inputPath) {
    console.error('Usage: npx ts-node scripts/eval-question-generate.ts --run-id <id> | --input <path> [--version v1|v2] [--outputDir <dir>]');
    process.exit(1);
  }

  const report = await loadReport(runId, inputPath);
  const questions = buildQuestionsFromReport(report);

  if (questions.length === 0) {
    console.log('无短板数据，无法生成题目');
    process.exit(0);
  }

  const outputDir = getOutputDir(version, outputDirArg);
  ensureManifestExists(outputDir);

  const timestamp = Date.now().toString();
  const date = new Date().toISOString().slice(0, 10);

  for (let seq = 0; seq < questions.length; seq++) {
    const q = questions[seq];
    const id = `gen-${timestamp}-${seq}`;
    const slug = generateSlugFromTitle(q.title);
    const fileName = `${id}-${slug}.md`;
    const filePath = path.join(outputDir, fileName);

    const content = generateQuestionTemplate({
      id,
      title: q.title,
      date,
    });
    fs.writeFileSync(filePath, content, 'utf-8');

    const entry: EvalQuestionEntry = {
      id,
      title: q.title,
      path: fileName,
    };
    addQuestionToManifest(outputDir, entry);
    console.log(`Created: ${path.relative(process.cwd(), filePath)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
