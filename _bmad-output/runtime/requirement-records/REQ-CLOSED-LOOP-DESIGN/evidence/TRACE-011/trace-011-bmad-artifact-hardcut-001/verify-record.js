const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../../../../..');
const recordPath = path.join(root, '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json');
const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
const closedIds = ['MUST-018', 'MUST-019', 'EVD-001', 'EVD-005', 'EVD-020'];
const exec = (record.executionIterations || []).filter(
  (item) => item.executionIterationId === 'exec-trace-011-bmad-artifact-hardcut-001'
);
const latestById = new Map();
for (const item of record.requirementClosures || []) {
  if (closedIds.includes(item.requirementId)) latestById.set(item.requirementId, item);
}
const gates = (record.gateChecks || []).filter((item) =>
  String(item.checkId || '').startsWith('trace-011')
);
const summary = {
  ok:
    exec.length === 1 &&
    closedIds.every((id) => latestById.get(id)?.status === 'pass') &&
    gates.length === 2 &&
    gates.every((item) => item.decision === 'pass'),
  executionIterationId: exec.at(-1)?.executionIterationId,
  closed: Object.fromEntries(closedIds.map((id) => [id, latestById.get(id)?.status || null])),
  gates: gates.map((item) => ({ checkId: item.checkId, gate: item.gate, decision: item.decision })),
};
fs.writeFileSync(path.join(__dirname, 'record-verification.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.ok ? 0 : 1;
