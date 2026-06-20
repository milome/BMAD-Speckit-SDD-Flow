"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Eval-question-generate: 从 coach 诊断输出自动生成 eval 题目。
 *
 * 用途：基于 weak_areas、weakness_clusters 生成题目模板并追加到 manifest。
 *
 * CLI 参数：--run-id, --input (coach JSON), --version, --outputDir
 *
 * 示例：npx ts-node scripts/eval-question-generate.ts --run-id r1 --version v1
 *
 * 退出码：0=成功，1=错误
 */
const fs = require("fs");
const path = require("path");
const coach_1 = require("../packages/scoring/coach");
const path_1 = require("../packages/scoring/constants/path");
const template_generator_1 = require("../packages/scoring/eval-questions/template-generator");
const DEFAULT_VERSION = 'v1';
const EVAL_ROOT = path.resolve(process.cwd(), 'packages', 'scoring', 'eval-questions');
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--'))
            continue;
        const eqIdx = arg.indexOf('=');
        const key = eqIdx >= 0 ? arg.slice(2, eqIdx) : arg.slice(2);
        const value = eqIdx >= 0 ? arg.slice(eqIdx + 1) : argv[i + 1];
        if (value && !value.startsWith('--')) {
            args[key] = value;
            if (eqIdx < 0)
                i++;
        }
    }
    return args;
}
function getOutputDir(version, outputDirArg) {
    if (outputDirArg) {
        return path.isAbsolute(outputDirArg) ? outputDirArg : path.resolve(process.cwd(), outputDirArg);
    }
    return path.join(EVAL_ROOT, version);
}
function ensureManifestExists(dir) {
    const manifestPath = path.join(dir, 'manifest.yaml');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(manifestPath)) {
        fs.writeFileSync(manifestPath, 'questions: []\n', 'utf-8');
    }
}
async function loadReport(runId, inputPath) {
    if (inputPath) {
        const resolved = path.isAbsolute(inputPath)
            ? inputPath
            : path.resolve(process.cwd(), inputPath);
        if (!fs.existsSync(resolved)) {
            console.error(`Input file not found: ${resolved}`);
            process.exit(1);
        }
        const content = fs.readFileSync(resolved, 'utf-8');
        const parsed = JSON.parse(content);
        return parsed;
    }
    if (runId) {
        const dataPath = (0, path_1.getScoringDataPath)();
        const result = await (0, coach_1.coachDiagnose)(runId, { dataPath });
        if ('error' in result && result.error === 'run_not_found') {
            console.error('run 不存在');
            process.exit(1);
        }
        return result;
    }
    console.error('Usage: --run-id <id> or --input <coach-diagnose JSON path> required');
    process.exit(1);
}
function buildQuestionsFromReport(report) {
    const questions = [];
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
async function main() {
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
        const slug = (0, template_generator_1.generateSlugFromTitle)(q.title);
        const fileName = `${id}-${slug}.md`;
        const filePath = path.join(outputDir, fileName);
        const content = (0, template_generator_1.generateQuestionTemplate)({
            id,
            title: q.title,
            date,
        });
        fs.writeFileSync(filePath, content, 'utf-8');
        const entry = {
            id,
            title: q.title,
            path: fileName,
        };
        (0, template_generator_1.addQuestionToManifest)(outputDir, entry);
        console.log(`Created: ${path.relative(process.cwd(), filePath)}`);
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
