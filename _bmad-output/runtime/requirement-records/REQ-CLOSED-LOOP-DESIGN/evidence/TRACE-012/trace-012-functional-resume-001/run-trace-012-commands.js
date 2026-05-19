const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const evidenceRoot = __dirname;
const projectRoot = path.resolve(evidenceRoot, '../../../../../../..');
const resumeOutDir =
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-012/trace-012-functional-resume-001/resume';

const commands = [
  {
    commandId: 'CMD-TRACE-012-FUNCTIONAL-RESUME-CHECK',
    command:
      'npx ts-node --project tsconfig.node.json --transpile-only scripts/main-agent-functional-resume-check.ts --requirement-record _bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json --out-dir ' +
      resumeOutDir +
      ' --checkpoint-id checkpoint-trace-012-001 --expected-source-document-hash sha256:426b56bec964e275600935e5dee293985c61483e34f523b66f3b705247ad2294 --expected-implementation-confirmation-hash sha256:e5e8b680fa4e1d273c29bea5a613ef595486868e8e57dae0fa48ac47016909ec --expected-architecture-confirmation-hash sha256:fe98c301cf8479be934a8258ad584575e146e2d5cc2e846bf6ccec1a1e6909f1 --generated-at 2026-05-19T21:15:00.000+08:00 --generated-by codex --json',
  },
  {
    commandId: 'CMD-TRACE-012-FUNCTIONAL-RESUME-TEST',
    command:
      'npx vitest run tests/acceptance/main-agent-functional-resume-check.test.ts tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts',
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
    runId: 'trace-012-functional-resume-001',
    closeoutAttemptId: 'trace-012-functional-resume-001',
    exitCode: result.status ?? 1,
    startedAt,
    completedAt,
    outputSummary: body.slice(0, 1000).replace(/\s+/g, ' ').trim(),
    logPath: logPath.replace(/\\/g, '/'),
  });
  if ((result.status ?? 1) !== 0) {
    fs.writeFileSync(path.join(evidenceRoot, 'command-runs.json'), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    console.error(JSON.stringify({ ok: false, failed: item.commandId, logPath }, null, 2));
    process.exit(result.status ?? 1);
  }
}

fs.writeFileSync(path.join(evidenceRoot, 'command-runs.json'), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, evidenceRoot: evidenceRoot.replace(/\\/g, '/'), commandRuns: records.length }, null, 2));
