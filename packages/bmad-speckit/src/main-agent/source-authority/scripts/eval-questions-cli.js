"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Eval-questions-cli: 评测题库管理（list/add/run）。
 *
 * 用途：list 列出题目；add 新建题目；run 执行题目（Agent 作答 + parseAndWriteScore）。
 *
 * CLI 参数：list [--version v1|v2]; add --title "xxx" [--version]; run --id q001 --version v1 [--reportPath] [--no-agent]
 *
 * 示例：npx ts-node scripts/eval-questions-cli.ts run --id q001 --version v1
 *
 * 退出码：0=成功，1=参数错误
 */
const path = require("path");
const fs = require("fs");
const manifest_loader_1 = require("../packages/scoring/eval-questions/manifest-loader");
const template_generator_1 = require("../packages/scoring/eval-questions/template-generator");
const run_core_1 = require("../packages/scoring/eval-questions/run-core");
const agent_answer_1 = require("../packages/scoring/eval-questions/agent-answer");
const orchestrator_1 = require("../packages/scoring/orchestrator");
const EVAL_ROOT = path.resolve(process.cwd(), 'packages', 'scoring', 'eval-questions');
const ALLOWED_VERSIONS = ['v1', 'v2'];
const DEFAULT_VERSION = 'v1';
const EMPTY_LIST_MESSAGE = '当前版本无题目';
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const eqIdx = arg.indexOf('=');
            const key = eqIdx >= 0 ? arg.slice(2, eqIdx) : arg.slice(2);
            const value = eqIdx >= 0 ? arg.slice(eqIdx + 1) : argv[i + 1];
            if (eqIdx >= 0) {
                args[key] = value;
            }
            else if (value && !value.startsWith('--')) {
                args[key] = value;
                i++;
            }
            else {
                args[key] = '1';
            }
        }
    }
    return args;
}
function getVersionDir(version) {
    const v = version || DEFAULT_VERSION;
    if (!ALLOWED_VERSIONS.includes(v)) {
        throw new Error(`Invalid --version: ${v}. Allowed: v1, v2`);
    }
    return path.join(EVAL_ROOT, v);
}
function cmdList(version) {
    const versionDir = getVersionDir(version);
    const manifest = (0, manifest_loader_1.loadManifest)(versionDir);
    if (manifest.questions.length === 0) {
        console.log(EMPTY_LIST_MESSAGE);
        return;
    }
    for (const q of manifest.questions) {
        console.log(`${q.id}\t${q.title}\t${q.path}`);
    }
}
function cmdAdd(title, version) {
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
    const manifest = (0, manifest_loader_1.loadManifest)(versionDir);
    const nextId = (0, template_generator_1.generateNextQuestionId)(manifest.questions);
    const slug = (0, template_generator_1.generateSlugFromTitle)(title);
    const fileName = `${nextId}-${slug}.md`;
    const filePath = path.join(versionDir, fileName);
    if (fs.existsSync(filePath)) {
        console.error(`Error: 文件已存在: ${fileName}，请选择不同 title 或手动处理`);
        process.exit(1);
    }
    const date = new Date().toISOString().slice(0, 10);
    const content = (0, template_generator_1.generateQuestionTemplate)({
        id: nextId,
        title: title.trim(),
        date,
    });
    fs.writeFileSync(filePath, content, 'utf-8');
    (0, template_generator_1.addQuestionToManifest)(versionDir, {
        id: nextId,
        title: title.trim(),
        path: fileName,
    });
    console.log(`Created: ${path.relative(process.cwd(), filePath)}`);
}
async function cmdRun(id, version, reportPathArg, useAgent = true) {
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
    if (!ALLOWED_VERSIONS.includes(version)) {
        console.error(`Error: --version 必须为 v1 或 v2，当前值: ${version}`);
        printRunUsage();
        process.exit(1);
    }
    const versionDir = getVersionDir(version);
    let manifest;
    try {
        manifest = (0, manifest_loader_1.loadManifest)(versionDir);
    }
    catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
    }
    const entry = manifest.questions.find((q) => q.id === id.trim());
    if (!entry) {
        console.error(`题目 ${id} 在版本 ${version} 中不存在`);
        process.exit(1);
    }
    let reportPath;
    if (reportPathArg) {
        reportPath = path.isAbsolute(reportPathArg)
            ? reportPathArg
            : path.resolve(process.cwd(), reportPathArg);
    }
    else if (useAgent) {
        const questionPath = path.join(versionDir, entry.path);
        if (!fs.existsSync(questionPath)) {
            console.error(`题目文件不存在：${questionPath}`);
            process.exit(1);
        }
        const questionContent = fs.readFileSync(questionPath, 'utf-8');
        try {
            console.log('正在调用 Agent 生成回答...');
            const answer = await (0, agent_answer_1.generateEvalAnswer)(questionContent);
            const answersDir = path.resolve(process.cwd(), '_bmad-output', 'eval-answers');
            if (!fs.existsSync(answersDir)) {
                fs.mkdirSync(answersDir, { recursive: true });
            }
            const ts = Date.now();
            const answerFile = path.join(answersDir, `${id.trim()}-${version}-${ts}.md`);
            fs.writeFileSync(answerFile, answer, 'utf-8');
            reportPath = answerFile;
            console.log(`Agent 回答已保存: ${path.relative(process.cwd(), answerFile)}`);
        }
        catch (e) {
            if (e instanceof agent_answer_1.EvalAgentError) {
                console.error(`Agent 作答失败: ${e.message}`);
                console.error('提示: 设置 SCORING_LLM_API_KEY 后重试，或使用 --no-agent 直接解析题目文件');
            }
            else {
                console.error(`Agent 作答失败: ${e.message}`);
            }
            process.exit(1);
        }
    }
    else {
        reportPath = path.join(versionDir, entry.path);
    }
    if (!fs.existsSync(reportPath)) {
        console.error(`报告文件不存在：${reportPath}`);
        process.exit(1);
    }
    (0, run_core_1.validateQuestionVersionForEval)('eval_question', version);
    const runId = (0, run_core_1.generateEvalRunId)(id.trim(), version);
    try {
        await (0, orchestrator_1.parseAndWriteScore)({
            reportPath,
            stage: 'prd',
            runId,
            scenario: 'eval_question',
            writeMode: 'single_file',
            dataPath: path.resolve(process.cwd(), 'packages', 'scoring', 'data'),
            question_version: version,
        });
        console.log(`run 完成: runId=${runId}, scenario=eval_question, question_version=${version}`);
    }
    catch (e) {
        console.error(`题目解析失败：${e.message}`);
        process.exit(1);
    }
}
function printRunUsage() {
    console.error('Usage: npx ts-node scripts/eval-questions-cli.ts run --id <questionId> --version v1|v2 [--reportPath <path>] [--no-agent]');
    console.error('  --no-agent: 不调用 Agent，直接解析题目文件（默认：先 Agent 作答再 parseAndWriteScore）');
}
async function main() {
    const argv = process.argv.slice(2);
    const subcommand = argv[0];
    const args = parseArgs(argv.slice(1));
    if (!subcommand || (subcommand !== 'list' && subcommand !== 'add' && subcommand !== 'run')) {
        console.error('Usage:');
        console.error('  npx ts-node scripts/eval-questions-cli.ts list [--version v1|v2]');
        console.error('  npx ts-node scripts/eval-questions-cli.ts add --title "xxx" [--version v1|v2]');
        console.error('  npx ts-node scripts/eval-questions-cli.ts run --id <id> --version v1|v2 [--reportPath <path>] [--no-agent]');
        process.exit(1);
    }
    const version = args.version || DEFAULT_VERSION;
    if (subcommand === 'list') {
        cmdList(version);
    }
    else if (subcommand === 'add') {
        cmdAdd(args.title || '', version);
    }
    else if (subcommand === 'run') {
        const useAgent = !args['no-agent'] && !args['noAgent'];
        await cmdRun(args.id || '', args.version || '', args.reportPath, useAgent);
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
