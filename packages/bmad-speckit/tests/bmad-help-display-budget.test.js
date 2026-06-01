const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DISPLAY_BUDGETS, resolveDisplayBudget } = require('../src/runtime/ai-tdd/display-budget');
const { buildBmadsOutput, renderBmads } = require('../src/runtime/bmads-renderer');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-budget-'));
  fs.cpSync(path.join(PROJECT_ROOT, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
    '{"flow":"story","stage":"prd"}\n',
    'utf8'
  );
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  fs.mkdirSync(recordsRoot, { recursive: true });
  const records = ['REQ-PRIMARY', 'REQ-SECONDARY-1', 'REQ-SECONDARY-2'].map((id, index) => ({
    recordId: id,
    title: id,
    currentMentalModel: index === 0 ? 'delivery_confirmation' : 'implementation_readiness',
    sourceDocumentHash: `sha256:source-${index}`,
    implementationConfirmationHash: `sha256:confirmation-${index}`,
    sixModelResults:
      index === 0
        ? { delivery_confirmation: { status: 'awaiting_user_acceptance' } }
        : { implementation_readiness: { status: 'pass' } },
    closeout:
      index === 0
        ? {
            status: 'awaiting_user_acceptance',
            currentAttemptId: 'attempt-budget',
            deliveryCloseoutReportHash: 'sha256:budget',
            acceptanceRequest: {
              status: 'pending',
              exactInstruction: 'confirm-closeout-acceptance',
            },
          }
        : undefined,
    updatedAt: `2026-06-01T00:0${index}:00.000Z`,
  }));
  for (const record of records) {
    const dir = path.join(recordsRoot, record.recordId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'requirement-record.json'), JSON.stringify(record), 'utf8');
  }
  fs.writeFileSync(
    path.join(recordsRoot, 'index.json'),
    JSON.stringify({
      active: { recordId: 'REQ-SECONDARY-2' },
      records: records.map((record) => ({ recordId: record.recordId })),
    }),
    'utf8'
  );
  return root;
}

describe('AI-TDD display budget', () => {
  it('defines compact, route, expanded, and full budgets', () => {
    assert.deepEqual(DISPLAY_BUDGETS, ['compact', 'route', 'expanded', 'full']);
    for (const budget of DISPLAY_BUDGETS) {
      const resolved = resolveDisplayBudget(budget);
      assert.equal(resolved.name, budget);
      assert.equal(resolved.preservesPrimaryOutput, true);
      assert.equal(resolved.preservesPrimarySafetyRoute, true);
    }
  });

  it('never hides the owning bmads primary safety route in any budget', () => {
    const root = makeRoot();
    try {
      for (const budget of DISPLAY_BUDGETS) {
        const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget }));

        assert.match(text, /recordId: REQ-PRIMARY \(primary\)/);
        assert.match(text, /Next Safe Action: confirm-closeout-acceptance/);
        assert.match(text, /Primary because: awaiting_user_acceptance/);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses budget only for secondary records and projection details, not physical wrapping', () => {
    const root = makeRoot();
    try {
      const compact = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'compact' }));
      const full = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'full' }));

      assert.match(compact, /secondary record\(s\) hidden by compact budget/);
      assert.match(full, /recordId: REQ-SECONDARY-1/);
      assert.match(full, /recordId: REQ-SECONDARY-2/);
      assert.ok(full.split(/\r?\n/).some((line) => line.length > 80));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
