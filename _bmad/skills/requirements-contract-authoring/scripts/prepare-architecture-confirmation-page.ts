#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '..');
const PRODUCER = path.join(SKILL_DIR, 'scripts', 'generate-architecture-confirmation-artifact.ts');
const RENDERER = path.join(SKILL_DIR, 'scripts', 'render-architecture-confirmation-html.ts');
const INGEST = path.resolve('scripts/ingest-architecture-confirmation.ts');
const TSX_CLI = path.resolve('node_modules/tsx/dist/cli.cjs');

function parseArgs(argv) {
  const args = { language: 'zh-CN', theme: 'audit' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--skip-state-check') {
      args.skipStateCheck = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function normalize(value) {
  return String(value || '').replace(/\\/gu, '/');
}

function runNode(script, args, label, allowNonZero = false) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (!allowNonZero && result.status !== 0) {
    throw new Error(`${label} failed: ${result.stdout}\n${result.stderr}`);
  }
  return {
    label,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runTsNode(script, args, label, allowNonZero = false) {
  const result = spawnSync(process.execPath, [TSX_CLI, script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (!allowNonZero && result.status !== 0) {
    throw new Error(`${label} failed: ${result.stdout}\n${result.stderr}`);
  }
  return {
    label,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseJsonOutput(step) {
  const text = String(step.stdout || '').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseOptionalJsonOutput(step) {
  try {
    return parseJsonOutput(step);
  } catch {
    return {};
  }
}

function deriveBase(recordPath, runId) {
  return path.join(path.dirname(path.resolve(recordPath)), 'architecture', `architecture-confirmation-${runId}`);
}

function requireArgs(args) {
  const required = [
    'source',
    'requirementRecord',
    'runId',
    'targetPaths',
    'consumerImpactScan',
    'governanceImpactScan',
    'fullArchitectureTriggerMatrix',
  ];
  const missing = required.filter((key) => !args[key]);
  if (missing.length) throw new Error(`missing required args: ${missing.join(', ')}`);
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node prepare-architecture-confirmation-page.ts --source <source.md> --requirement-record <record.json> --run-id <id> --target-paths <json|file> --consumer-impact-scan <json|file> --governance-impact-scan <json|file> --full-architecture-trigger-matrix <json|file> [--out <html>] [--json]');
    return 0;
  }
  requireArgs(args);

  const base = args.out
    ? path.resolve(args.out).replace(/\.html?$/iu, '')
    : deriveBase(args.requirementRecord, args.runId);
  const architecturePath = path.resolve(args.architectureConfirmation || `${base}.json`);
  const htmlPath = path.resolve(args.out || `${base}.html`);
  const prepareReportPath = path.resolve(args.prepareReport || `${base}.prepare-report.json`);
  const steps = [];

  if (!args.skipStateCheck) {
    const stateCheckStep = runTsNode(
      INGEST,
      [
        '--action',
        'check-state',
        '--requirement-record',
        args.requirementRecord,
        '--confirmed-by',
        args.checkedBy || 'architecture-confirmation-prepare',
        '--json',
      ],
      'architecture_confirmation_state_checked',
      true
    );
    const stateCheckOutput = parseOptionalJsonOutput(stateCheckStep);
    if (!stateCheckOutput.event || stateCheckStep.status === 2 || stateCheckStep.status === null) {
      throw new Error(`architecture_confirmation_state_checked did not record a controlled state check: ${stateCheckStep.stdout}\n${stateCheckStep.stderr}`);
    }
    stateCheckStep.controlEvent = stateCheckOutput.event;
    steps.push(stateCheckStep);
  }

  const producerArgs = [
    '--source',
    args.source,
    '--requirement-record',
    args.requirementRecord,
    '--out',
    architecturePath,
    '--run-id',
    args.runId,
    '--target-paths',
    args.targetPaths,
    '--consumer-impact-scan',
    args.consumerImpactScan,
    '--governance-impact-scan',
    args.governanceImpactScan,
    '--full-architecture-trigger-matrix',
    args.fullArchitectureTriggerMatrix,
    '--json',
  ];
  for (const passthrough of ['decision', 'outcome', 'riskStatement', 'rollbackPlan', 'evidenceRefs', 'relatedRequirementIds']) {
    if (args[passthrough]) producerArgs.push(`--${passthrough.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`, args[passthrough]);
  }
  const producerStep = runNode(PRODUCER, producerArgs, 'generate_architecture_confirmation_artifact');
  steps.push(producerStep);

  const renderStep = runNode(
    RENDERER,
    [
      '--architecture-confirmation',
      architecturePath,
      '--out',
      htmlPath,
      '--language',
      args.language,
      '--theme',
      args.theme,
      '--json',
    ],
    'render_architecture_confirmation_html'
  );
  steps.push(renderStep);
  const producer = parseJsonOutput(producerStep);
  const render = parseJsonOutput(renderStep);
  const renderReport = readJson(render.reportPath);
  const report = {
    ok: true,
    userFacingNextStep: 'open_architecture_confirmation_html_and_confirm_hashes',
    internalSteps: steps.map((step) => ({
      label: step.label,
      status: step.status,
      ok: step.status === 0 || (step.label === 'architecture_confirmation_state_checked' && Boolean(step.controlEvent)),
      eventType: step.controlEvent?.eventType,
      decision: step.controlEvent?.decision,
      stateTransition: step.controlEvent?.stateTransition,
    })),
    architectureConfirmationPath: normalize(architecturePath),
    htmlPath: normalize(htmlPath),
    renderReportPath: normalize(render.reportPath),
    summaryPath: normalize(render.summaryPath),
    confirmInstruction: renderReport.confirmInstruction,
    architectureConfirmationArtifactHash: producer.architectureConfirmationArtifactHash,
    sourceDocumentHash: producer.sourceDocumentHash,
    implementationConfirmationHash: producer.implementationConfirmationHash,
    resolvedRecipeHash: producer.resolvedRecipeHash,
  };
  fs.mkdirSync(path.dirname(prepareReportPath), { recursive: true });
  fs.writeFileSync(prepareReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = { ...report, prepareReportPath: normalize(prepareReportPath) };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `architecture_confirmation_html=${normalize(htmlPath)}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
