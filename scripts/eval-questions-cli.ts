/**
 * Story 8.2: 题库 list / add 命令入口
 * Story 8.3: 题库 run 命令
 * 用法：
 *   npx ts-node scripts/eval-questions-cli.ts list [--version v1|v2]
 *   npx ts-node scripts/eval-questions-cli.ts add --title "xxx" [--version v1|v2]
 *   npx ts-node scripts/eval-questions-cli.ts run --id q001 --version v1 [--reportPath <path>]
 */
import * as path from 'path';
import * as fs from 'fs';
import { loadManifest } from '../scoring/eval-questions/manifest-loader';
import {
  generateSlugFromTitle,
  generateNextQuestionId,
  generateQuestionTemplate,
  addQuestionToManifest,
} from '../scoring/eval-questions/template-generator';
import { generateEvalRunId, validateQuestionVersionForEval } from '../scoring/eval-questions/run-core';
import { parseAndWriteScore } from '../scoring/orchestrator';

const EVAL_ROOT = path.resolve(process.cwd(), 'scoring', 'eval-questions');
const ALLOWED_VERSIONS = ['v1', 'v2'] as const;
const DEFAULT_VERSION = 'v1';
const EMPTY_LIST_MESSAGE = '当前版本无题目';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/^([^=]+)=.*/, '$1');
      const eqIdx = arg.indexOf('=');
      const value = eqIdx >= 0 ? arg.slice(eqIdx + 1) : argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        if (eqIdx < 0) i++;
      }
    }
  }
  return args;
}

function getVersionDir(version: string): string {
  const v = version || DEFAULT_VERSION;
  if (!ALLOWED_VERSIONS.includes(v as (typeof ALLOWED_VERSIONS)[number])) {
    throw new Error(`Invalid --version: ${v}. Allowed: v1, v2`);
  }
  return path.join(EVAL_ROOT, v);
}

function cmdList(version: string): void {
  const versionDir = getVersionDir(version);
  const manifest = loadManifest(versionDir);

  if (manifest.questions.length === 0) {
    console.log(EMPTY_LIST_MESSAGE);
    return;
  }

  for (const q of manifest.questions) {
    console.log(`${q.id}\t${q.title}\t${q.path}`);
  }
}

function cmdAdd(title: string, version: string): void {
  if (!title || !String(title).trim()) {
    console.error('Error: --title 必填');
    console.error('Usage: npx ts-node scripts/eval-questions-cli.ts add --title "题目标题" [--version v1|v2]');
    process.exit(1);
  }

  const versionDir = getVersionDir(version);
  const manifestPath = path.join(versionDir, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: manifest not found at ${versionDir}`);
    process.exit(1);
  }

  const manifest = loadManifest(versionDir);
  const nextId = generateNextQuestionId(manifest.questions);
  const slug = generateSlugFromTitle(title);
  const fileName = `${nextId}-${slug}.md`;
  const filePath = path.join(versionDir, fileName);

  if (fs.existsSync(filePath)) {
    console.error(`Error: 文件已存在: ${fileName}，请选择不同 title 或手动处理`);
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const content = generateQuestionTemplate({
    id: nextId,
    title: title.trim(),
    date,
  });

  fs.writeFileSync(filePath, content, 'utf-8');
  addQuestionToManifest(versionDir, {
    id: nextId,
    title: title.trim(),
    path: fileName,
  });

  console.log(`Created: ${path.relative(process.cwd(), filePath)}`);
}

async function cmdRun(id: string, version: string, reportPathArg?: string): Promise<void> {
  if (!id || !String(id).trim()) {
    console.error('Error: --id 必填');
    printRunUsage();
    process.exit(1);
  }
  if (!version || !String(version).trim()) {
    console.error('Error: --version 必填');
    printRunUsage();
    process.exit(1);
  }
  if (!ALLOWED_VERSIONS.includes(version as (typeof ALLOWED_VERSIONS)[number])) {
    console.error(`Error: --version 必须为 v1 或 v2，当前值: ${version}`);
    printRunUsage();
    process.exit(1);
  }

  const versionDir = getVersionDir(version);
  let manifest;
  try {
    manifest = loadManifest(versionDir);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  const entry = manifest.questions.find((q) => q.id === id.trim());
  if (!entry) {
    console.error(`题目 ${id} 在版本 ${version} 中不存在`);
    process.exit(1);
  }

  const reportPath = reportPathArg
    ? (path.isAbsolute(reportPathArg) ? reportPathArg : path.resolve(process.cwd(), reportPathArg))
    : path.join(versionDir, entry.path);

  if (!fs.existsSync(reportPath)) {
    console.error(`报告文件不存在：${reportPath}`);
    process.exit(1);
  }

  validateQuestionVersionForEval('eval_question', version);

  const runId = generateEvalRunId(id.trim(), version);

  try {
    await parseAndWriteScore({
      reportPath,
      stage: 'prd',
      runId,
      scenario: 'eval_question',
      writeMode: 'single_file',
      question_version: version,
    });
    console.log(`run 完成: runId=${runId}, scenario=eval_question, question_version=${version}`);
  } catch (e) {
    console.error(`题目解析失败：${(e as Error).message}`);
    process.exit(1);
  }
}

function printRunUsage(): void {
  console.error(
    'Usage: npx ts-node scripts/eval-questions-cli.ts run --id <questionId> --version v1|v2 [--reportPath <path>]'
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const subcommand = argv[0];
  const args = parseArgs(argv.slice(1));

  if (!subcommand || (subcommand !== 'list' && subcommand !== 'add' && subcommand !== 'run')) {
    console.error('Usage:');
    console.error('  npx ts-node scripts/eval-questions-cli.ts list [--version v1|v2]');
    console.error('  npx ts-node scripts/eval-questions-cli.ts add --title "xxx" [--version v1|v2]');
    console.error('  npx ts-node scripts/eval-questions-cli.ts run --id <id> --version v1|v2 [--reportPath <path>]');
    process.exit(1);
  }

  const version = args.version || DEFAULT_VERSION;

  if (subcommand === 'list') {
    cmdList(version);
  } else if (subcommand === 'add') {
    cmdAdd(args.title || '', version);
  } else if (subcommand === 'run') {
    await cmdRun(args.id || '', args.version || '', args.reportPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
