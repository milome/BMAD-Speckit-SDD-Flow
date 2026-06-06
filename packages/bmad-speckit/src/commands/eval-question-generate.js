const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_VERSION = 'v1';
const RUN_ID_UNRESOLVED = 'EVAL_QUESTION_RUN_ID_UNRESOLVED';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const eqIndex = arg.indexOf('=');
    const key = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const value = eqIndex >= 0 ? arg.slice(eqIndex + 1) : argv[index + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      if (eqIndex < 0) index += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function resolveOutputDir(version, outputDirArg) {
  if (outputDirArg) {
    return path.isAbsolute(outputDirArg) ? outputDirArg : path.resolve(process.cwd(), outputDirArg);
  }
  return path.resolve(process.cwd(), 'eval-questions', version);
}

function ensureManifestExists(dir) {
  const manifestPath = path.join(dir, 'manifest.yaml');
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, 'questions: []\n', 'utf8');
  }
}

function loadReportFromInput(inputPath) {
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolved)) {
    const error = new Error(`Input file not found: ${resolved}`);
    error.code = 'EVAL_QUESTION_INPUT_NOT_FOUND';
    throw error;
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

async function loadReportFromRunId(runId, dataPath) {
  const { coachDiagnose } = require('@bmad-speckit/scoring/coach');
  const result = await coachDiagnose(runId, { dataPath });
  if (result && result.error === 'run_not_found') {
    const error = new Error(`${RUN_ID_UNRESOLVED}: ${runId}`);
    error.code = RUN_ID_UNRESOLVED;
    throw error;
  }
  return result;
}

function buildQuestionsFromReport(report) {
  const questions = [];
  for (const stage of report?.weak_areas ?? []) {
    questions.push({ title: `如何改进 ${stage} 阶段的短板` });
  }
  for (const cluster of report?.weakness_clusters ?? []) {
    const stages = (cluster.affected_stages ?? []).join(',') || '多阶段';
    const keywords = (cluster.keywords ?? []).join(',') || '短板';
    questions.push({ title: `如何提升 ${stages} 的 ${keywords}` });
  }
  return questions;
}

async function evalQuestionGenerateCommand(opts = {}) {
  const argvArgs = Array.isArray(opts.argv) ? parseArgs(opts.argv) : {};
  const runId = opts.runId ?? opts['run-id'] ?? argvArgs.runId ?? argvArgs['run-id'];
  const inputPath = opts.input ?? argvArgs.input;
  const version = opts.version ?? argvArgs.version ?? DEFAULT_VERSION;
  const outputDirArg = opts.outputDir ?? opts['output-dir'] ?? argvArgs.outputDir ?? argvArgs['output-dir'];
  const dataPath = opts.dataPath ?? argvArgs.dataPath ?? process.env.SCORING_DATA_PATH;

  if (!runId && !inputPath) {
    const error = new Error(
      'Usage: bmad-speckit eval-question-generate --run-id <id> | --input <path> [--version v1|v2] [--outputDir <dir>]'
    );
    error.code = 'EVAL_QUESTION_INPUT_REQUIRED';
    throw error;
  }

  const templateGenerator = require('@bmad-speckit/scoring/eval-questions/template-generator');
  const { loadManifest } = require('@bmad-speckit/scoring/eval-questions/manifest-loader');
  const report = inputPath ? loadReportFromInput(inputPath) : await loadReportFromRunId(runId, dataPath);
  const questions = buildQuestionsFromReport(report);
  const outputDir = resolveOutputDir(version, outputDirArg);

  ensureManifestExists(outputDir);

  const created = [];
  const timestamp = String(Date.now());
  const date = new Date().toISOString().slice(0, 10);
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const id = `gen-${timestamp}-${index}`;
    const slug = templateGenerator.generateSlugFromTitle(question.title);
    const fileName = `${id}-${slug}.md`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(
      filePath,
      templateGenerator.generateQuestionTemplate({ id, title: question.title, date }),
      'utf8'
    );
    templateGenerator.addQuestionToManifest(outputDir, { id, title: question.title, path: fileName });
    created.push(filePath);
  }

  const manifest = loadManifest(outputDir);
  return {
    schemaVersion: 'eval-question-generate-result/v1',
    status: 'ok',
    version,
    outputDir,
    created: created.map((filePath) => path.relative(process.cwd(), filePath).replace(/\\/g, '/')),
    manifestPath: path.join(outputDir, 'manifest.yaml'),
    manifestQuestionCount: manifest.questions.length,
  };
}

function writeResult(result) {
  for (const filePath of result.created) {
    console.log(`Created: ${filePath}`);
  }
  console.log(`Manifest: ${path.relative(process.cwd(), result.manifestPath).replace(/\\/g, '/')}`);
}

async function main(argv = process.argv.slice(2)) {
  try {
    const result = await evalQuestionGenerateCommand({ argv });
    writeResult(result);
    return 0;
  } catch (error) {
    const code = error && error.code ? `${error.code}: ` : '';
    console.error(`${code}${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

async function evalQuestionGenerateCli(opts = {}) {
  try {
    const result = await evalQuestionGenerateCommand(opts);
    writeResult(result);
    return 0;
  } catch (error) {
    const code = error && error.code ? `${error.code}: ` : '';
    console.error(`${code}${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

module.exports = {
  evalQuestionGenerateCommand,
  evalQuestionGenerateCli,
  writeResult,
  main,
  parseArgs,
  RUN_ID_UNRESOLVED,
};
