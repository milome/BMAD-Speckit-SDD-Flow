const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const runDir = path.resolve(
  root,
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-037/run-TRACE037-current-20260521T042000Z'
);

const commands = [
  {
    commandId: 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION',
    args: ['npx', 'vitest', 'run', 'tests/acceptance/parallel-mission-evidence-integration.test.ts'],
    outputPath: path.join(runDir, 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION.output.txt'),
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

function quote(part) {
  return /[^\w@%+=:,./-]/.test(part) ? JSON.stringify(part) : part;
}

fs.mkdirSync(runDir, { recursive: true });
const runs = [];

for (const command of commands) {
  const commandLine = command.args.map(quote).join(' ');
  const startedAt = new Date().toISOString();
  const result = spawnSync(commandLine, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });
  const completedAt = new Date().toISOString();
  const lines = [
    `COMMAND: ${commandLine}`,
    `STARTED_AT: ${startedAt}`,
    `COMPLETED_AT: ${completedAt}`,
    `EXIT_CODE: ${result.status ?? 1}`,
    'STDOUT:',
  ];
  if (result.stdout) lines.push(result.stdout.trimEnd());
  lines.push('STDERR:');
  if (result.stderr) lines.push(result.stderr.trimEnd());
  if (result.error) lines.push(`SPAWN_ERROR: ${result.error.message}`);
  fs.writeFileSync(command.outputPath, `${lines.join('\n')}\n`, 'utf8');
  runs.push({
    commandId: command.commandId,
    command: commandLine,
    startedAt,
    completedAt,
    exitCode: result.status ?? 1,
    outputPath: path.relative(root, command.outputPath).replace(/\\/g, '/'),
  });
  fs.writeFileSync(path.join(runDir, 'trace037-command-runs.json'), `${JSON.stringify(runs, null, 2)}\n`, 'utf8');
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(JSON.stringify({ ok: true, runDir: path.relative(root, runDir).replace(/\\/g, '/'), commandRuns: runs }, null, 2));
