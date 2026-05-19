const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const evidenceRoot = __dirname;
const projectRoot = path.resolve(evidenceRoot, '../../../../../../..');
const runId = 'trace-018-trace-status-policy-001';
const reportPath =
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-018/trace-018-trace-status-policy-001/trace-status-policy-check.json';

const commands = [
  {
    commandId: 'CMD-TRACE-018-ENTRYFLOW-TRACEABILITY-CHECK',
    command:
      'npx ts-node --project tsconfig.node.json --transpile-only scripts/main-agent-trace-status-policy-check.ts --requirement-record _bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json --source docs/design/需求实现完整性门禁与重跑闭环设计.md --report-path ' +
      reportPath +
      ' --evaluated-at 2026-05-19T22:44:00.000+08:00 --evaluated-by codex --json',
  },
  {
    commandId: 'CMD-TRACE-018-ENTRYFLOW-TRACEABILITY-TEST',
    command:
      'npx vitest run tests/acceptance/main-agent-trace-status-policy-check.test.ts tests/acceptance/implementation-evidence-ingest.test.ts tests/acceptance/requirement-record-schema.test.ts tests/acceptance/requirements-confirmation-ingest.test.ts tests/acceptance/resolve-active-requirement.test.ts',
  },
  {
    commandId: 'CMD-RENDER-CONFIRMATION',
    command:
      'node _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts --source docs/design/需求实现完整性门禁与重跑闭环设计.md --out _bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/confirmation/confirmation.html --language zh-CN --record-id REQ-CLOSED-LOOP-DESIGN --requirement-set-id REQ-CLOSED-LOOP-DESIGN --entry-flow standalone_tasks --entry-flow-class task_packet_entry --workflow-adapter direct --theme audit --json',
  },
  {
    commandId: 'CMD-TRACE-BINDING-ACCEPTANCE',
    command: 'npx vitest run tests/acceptance/render-requirements-confirmation-html.test.ts',
  },
  {
    commandId: 'CMD-ENCODING-GATE',
    command: 'node .codex/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js',
  },
];

const records = [];

for (const item of commands) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(item.command, {
    shell: true,
    encoding: 'utf8',
    cwd: projectRoot,
    env: process.env,
  });
  const completedAt = new Date().toISOString();
  const logPath = path.join(evidenceRoot, `${item.commandId}.log`);
  const body = [
    `$ ${item.command}`,
    `startedAt=${startedAt}`,
    `completedAt=${completedAt}`,
    `exitCode=${result.status ?? 1}`,
    '',
    '--- stdout ---',
    result.stdout || '',
    '--- stderr ---',
    result.stderr || '',
  ].join('\n');
  fs.writeFileSync(logPath, body, 'utf8');
  records.push({
    commandId: item.commandId,
    command: item.command,
    runId,
    closeoutAttemptId: runId,
    exitCode: result.status ?? 1,
    startedAt,
    completedAt,
    outputSummary: body.slice(0, 1000).replace(/\s+/g, ' ').trim(),
    logPath: path.relative(projectRoot, logPath).replace(/\\/g, '/'),
  });
  if ((result.status ?? 1) !== 0) {
    fs.writeFileSync(path.join(evidenceRoot, 'command-runs.json'), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    console.error(JSON.stringify({ ok: false, failed: item.commandId, logPath }, null, 2));
    process.exit(result.status ?? 1);
  }
}

fs.writeFileSync(path.join(evidenceRoot, 'command-runs.json'), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, evidenceRoot: path.relative(projectRoot, evidenceRoot).replace(/\\/g, '/'), commandRuns: records.length }, null, 2));
