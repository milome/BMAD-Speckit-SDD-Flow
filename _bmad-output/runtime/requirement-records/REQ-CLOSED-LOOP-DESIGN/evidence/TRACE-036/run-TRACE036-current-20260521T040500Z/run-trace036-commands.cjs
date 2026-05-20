const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const runDir = path.resolve(
  root,
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-036/run-TRACE036-current-20260521T040500Z'
);
const recordPath =
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json';
const envelopePath =
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-035/run-TRACE035-current-20260521T031700Z/accepted-subagent-evidence-envelope.json';
const revalidationReportPath =
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/subagents/subagent-current-attempt-revalidation-report.json';

const commands = [
  {
    commandId: 'CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION',
    args: [
      'npx',
      'ts-node',
      '--project',
      'tsconfig.node.json',
      '--transpile-only',
      'scripts/subagent-current-attempt-revalidation.ts',
      '--envelope',
      envelopePath,
      '--requirement-record',
      recordPath,
      '--report-out',
      revalidationReportPath,
      '--project-root',
      '.',
      '--json',
    ],
    outputPath: path.join(runDir, 'CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION.output.txt'),
  },
  {
    commandId: 'CMD-RENDER-CONFIRMATION',
    args: [
      'node',
      '_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
      '--source',
      'docs/design/需求实现完整性门禁与重跑闭环设计.md',
      '--out',
      '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/confirmation/confirmation.html',
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-CLOSED-LOOP-DESIGN',
      '--requirement-set-id',
      'REQ-CLOSED-LOOP-DESIGN',
      '--entry-flow',
      'standalone_tasks',
      '--entry-flow-class',
      'task_packet_entry',
      '--workflow-adapter',
      'direct',
      '--theme',
      'audit',
      '--json',
    ],
    outputPath: path.join(runDir, 'CMD-RENDER-CONFIRMATION.output.txt'),
  },
  {
    commandId: 'CMD-TRACE-BINDING-ACCEPTANCE',
    args: ['npx', 'vitest', 'run', 'tests/acceptance/render-requirements-confirmation-html.test.ts'],
    outputPath: path.join(runDir, 'CMD-TRACE-BINDING-ACCEPTANCE.output.txt'),
  },
  {
    commandId: 'CMD-ENCODING-GATE',
    args: ['node', '_bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js'],
    outputPath: path.join(runDir, 'CMD-ENCODING-GATE.output.txt'),
  },
];

fs.mkdirSync(runDir, { recursive: true });
const runs = [];

for (const command of commands) {
  const commandLine = command.args.map((part) => (/[^\w@%+=:,./-]/.test(part) ? JSON.stringify(part) : part)).join(' ');
  const startedAt = new Date().toISOString();
  const result = spawnSync(commandLine, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });
  const completedAt = new Date().toISOString();
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const output = [
    `COMMAND: ${commandLine}`,
    `STARTED_AT: ${startedAt}`,
    `COMPLETED_AT: ${completedAt}`,
    `EXIT_CODE: ${result.status ?? 1}`,
    'STDOUT:',
    stdout,
    'STDERR:',
    stderr,
    result.error ? `SPAWN_ERROR: ${result.error.message}` : '',
  ].join('\n');
  fs.writeFileSync(command.outputPath, output.endsWith('\n') ? output : `${output}\n`, 'utf8');
  runs.push({
    commandId: command.commandId,
    command: commandLine,
    startedAt,
    completedAt,
    exitCode: result.status ?? 1,
    outputPath: path.relative(root, command.outputPath).replace(/\\/g, '/'),
  });
  if (result.status !== 0) {
    fs.writeFileSync(path.join(runDir, 'trace036-command-runs.json'), `${JSON.stringify(runs, null, 2)}\n`, 'utf8');
    process.exit(result.status ?? 1);
  }
}

fs.writeFileSync(path.join(runDir, 'trace036-command-runs.json'), `${JSON.stringify(runs, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, runDir: path.relative(root, runDir).replace(/\\/g, '/'), commandRuns: runs }, null, 2));
