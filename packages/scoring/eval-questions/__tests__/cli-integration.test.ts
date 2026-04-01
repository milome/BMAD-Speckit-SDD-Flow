/**
 * Story 8.2: CLI list/add 集成测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { loadManifest } from '../manifest-loader';

const EVAL_ROOT = path.resolve(process.cwd(), 'packages', 'scoring', 'eval-questions');
const FIXTURES = path.join(EVAL_ROOT, '__tests__', 'fixtures');
const CLI_SCRIPT = path.resolve(process.cwd(), 'scripts', 'eval-questions-cli.ts');

function runCli(args: string[], cwd = process.cwd()): string {
  const cmd = `node --require ts-node/register "${CLI_SCRIPT}" ${args.join(' ')}`;
  return execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
}

describe(
  'eval-questions-cli 集成',
  /** ts-node cold start under parallel vitest + heavy acceptance (e.g. pack) can exceed 15s */
  { timeout: 60_000 },
  () => {
  let tmpRoot: string;
  let origCwd: string;

  beforeEach(() => {
    origCwd = process.cwd();
    tmpRoot = path.join(FIXTURES, `tmp-cli-${Date.now()}`);
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v1'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v2'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v1', 'manifest.yaml'),
      'questions: []\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v2', 'manifest.yaml'),
      'questions: []\n',
      'utf-8'
    );
    process.chdir(tmpRoot);
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true });
  });

  it('list 空 manifest 输出「当前版本无题目」', () => {
    const out = runCli(['list']);
    expect(out.trim()).toBe('当前版本无题目');
  });

  it('add 生成文件且 list 可列出', () => {
    runCli(['add', '--title', 'my-question']);
    const out = runCli(['list']);
    expect(out).toContain('q001');
    expect(out).toContain('my-question');
  });

  it('add 生成的文件可被 loadManifest 解析', () => {
    runCli(['add', '--title', 'parser-check']);
    const v1Dir = path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v1');
    const m = loadManifest(v1Dir);
    expect(m.questions).toHaveLength(1);
    expect(m.questions[0].id).toBe('q001');
    expect(m.questions[0].path).toContain('q001-parser-check.md');
  });

  it('add --version v2 写入 v2 目录', () => {
    runCli(['add', '--title', 'v2-test', '--version', 'v2']);
    const v2Dir = path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v2');
    expect(fs.existsSync(path.join(v2Dir, 'q001-v2-test.md'))).toBe(true);
  });

  it('add 无 --title 时退出码非 0', () => {
    try {
      runCli(['add']);
    } catch (e: unknown) {
      expect((e as { status?: number }).status).not.toBe(0);
    }
  });

  describe('run (Story 8.3)', () => {
    it('run 题目不存在时输出明确错误', () => {
      try {
        runCli(['run', '--id', 'q999', '--version', 'v1']);
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: string; stdout?: string };
        expect(err.status).not.toBe(0);
        const out = (err.stderr || err.stdout || '').toString();
        expect(out).toContain('题目 q999 在版本 v1 中不存在');
      }
    });

    it('run 缺 --id 时输出用法', () => {
      try {
        runCli(['run', '--version', 'v1']);
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: string };
        expect(err.status).not.toBe(0);
        expect((err.stderr || '').toString()).toContain('--id 必填');
      }
    });

    it('run 缺 --version 时输出用法', () => {
      try {
        runCli(['run', '--id', 'q001']);
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: string };
        expect(err.status).not.toBe(0);
        expect((err.stderr || '').toString()).toContain('--version 必填');
      }
    });

    it('run 使用 --reportPath 与有效报告时写入评分', () => {
      const projRoot = path.resolve(__dirname, '..', '..', '..', '..');
      fs.cpSync(
        path.join(projRoot, 'packages', 'scoring', 'rules'),
        path.join(tmpRoot, 'packages', 'scoring', 'rules'),
        { recursive: true }
      );
      fs.mkdirSync(path.join(tmpRoot, '_bmad', '_config'), { recursive: true });
      fs.copyFileSync(
        path.join(projRoot, '_bmad', '_config', 'code-reviewer-config.yaml'),
        path.join(tmpRoot, '_bmad', '_config', 'code-reviewer-config.yaml')
      );
      fs.mkdirSync(path.join(tmpRoot, 'packages', 'scoring', 'schema'), { recursive: true });
      fs.copyFileSync(
        path.join(projRoot, 'packages', 'scoring', 'schema', 'run-score-schema.json'),
        path.join(tmpRoot, 'packages', 'scoring', 'schema', 'run-score-schema.json')
      );
      const sampleReport = path.resolve(
        __dirname,
        '../../parsers/__tests__/fixtures/sample-eval-question-report.md'
      );
      fs.writeFileSync(
        path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v1', 'manifest.yaml'),
        `questions:
  - id: q001
    title: eval-sample
    path: q001-eval-sample.md
`,
        'utf-8'
      );
      fs.copyFileSync(
        sampleReport,
        path.join(tmpRoot, 'packages', 'scoring', 'eval-questions', 'v1', 'q001-eval-sample.md')
      );
      const out = runCli(['run', '--id', 'q001', '--version', 'v1', '--no-agent']);
      expect(out).toContain('run 完成');
      expect(out).toMatch(/runId=eval-q001-v1-\d+/);
      expect(out).toContain('scenario=eval_question');
      expect(out).toContain('question_version=v1');

      const dataDir = path.join(tmpRoot, 'packages', 'scoring', 'data');
      expect(fs.existsSync(dataDir)).toBe(true);
      const files = fs.readdirSync(dataDir);
      const runFile = files.find((f) => f.startsWith('eval-q001-v1-') && f.endsWith('.json'));
      expect(runFile).toBeDefined();
      const record = JSON.parse(
        fs.readFileSync(path.join(dataDir, runFile!), 'utf-8')
      );
      expect(record.scenario).toBe('eval_question');
      expect(record.question_version).toBe('v1');
      expect(record.run_id).toMatch(/^eval-q001-v1-\d+$/);
    });
  });
});
