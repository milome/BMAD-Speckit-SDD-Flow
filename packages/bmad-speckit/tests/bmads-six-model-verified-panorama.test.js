const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildBmadsOutput, renderBmads } = require('../dist/runtime/bmads-renderer');
const {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
} = require('../dist/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function sha256(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function materializeRoot(record) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-verified-panorama-'));
  fs.cpSync(path.join(PROJECT_ROOT, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  const recordRoot = path.join(recordsRoot, record.recordId);
  fs.mkdirSync(recordRoot, { recursive: true });
  fs.writeFileSync(
    path.join(recordRoot, 'requirement-record.json'),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(recordsRoot, 'index.json'),
    `${JSON.stringify(
      {
        active: {
          recordId: record.recordId,
          recordPath: `_bmad-output/runtime/requirement-records/${record.recordId}/requirement-record.json`,
        },
        records: [
          {
            recordId: record.recordId,
            recordPath: `_bmad-output/runtime/requirement-records/${record.recordId}/requirement-record.json`,
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return root;
}

function verifiedRecord({
  effectiveStatus = 'pass',
  decision = effectiveStatus === 'stale' ? 'stale' : effectiveStatus === 'blocked' ? 'block' : 'pass',
  blockerRefs = [],
} = {}) {
  let record = {
    recordId: 'REQ-VERIFIED-PANORAMA',
    requirementSetId: 'REQ-VERIFIED-PANORAMA-SET',
    status: 'user_confirmed',
    currentMentalModel: 'implementation_readiness',
    currentAttemptId: 'IMP-VERIFIED-PANORAMA',
    sourceDocumentHash: sha256('verified-panorama-source'),
    implementationConfirmationHash: sha256('verified-panorama-confirmation'),
    semanticModelHash: sha256('verified-panorama-semantic-model'),
    updatedAt: '2026-07-15T00:00:00.000Z',
  };
  const update = createRuntimeStatusProjectionUpdate({
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    modelId: 'implementation_readiness',
    implementationAttemptId: record.currentAttemptId,
    sourceDocumentHash: record.sourceDocumentHash,
    implementationConfirmationHash: record.implementationConfirmationHash,
    semanticModelHash: record.semanticModelHash,
    stageInputs: [
      {
        role: 'implementation_readiness_input',
        path: 'runtime/implementation-readiness/input.json',
        hash: sha256('verified-panorama-input'),
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'implementation_readiness_gate',
        path: 'runtime/implementation-readiness/gate.json',
        hash: sha256('verified-panorama-gate'),
      },
    ],
    blockerRefs,
    evidenceRefs: ['runtime/implementation-readiness/gate.json'],
    authorityClass: 'deterministic_gate',
    decision,
    effectiveStatus,
    createdAt: '2026-07-15T00:00:00.000Z',
    receiptPath: 'runtime/status/implementation-readiness.json',
    projection: {
      status: effectiveStatus,
      blockingReasons: blockerRefs,
    },
  });
  record = {
    ...record,
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'implementation_readiness',
      update,
    }),
  };
  return record;
}

function render(record) {
  const root = materializeRoot(record);
  try {
    return renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe('BMADS verified six-model panorama', () => {
  it('renders valid effective and projection authority separately', () => {
    const text = render(verifiedRecord());

    assert.match(text, /Effective status: pass/);
    assert.match(text, /Projection status: pass/);
    assert.match(text, /Projection integrity: valid/);
    assert.match(text, /Authority class: deterministic_gate/);
    assert.match(text, /Decision receipt: runtime\/status\/implementation-readiness\.json/);
    assert.match(text, /Decision receipt hash: sha256:[a-f0-9]{64}/);
    assert.match(text, /Blocker refs: none/);
    assert.match(text, /Evidence refs: runtime\/implementation-readiness\/gate\.json/);
  });

  it('keeps a raw PASS projection non-authoritative when its receipt is missing', () => {
    const record = verifiedRecord();
    record.runtimeStatusDecisionReceipts = [];
    const text = render(record);

    assert.match(text, /Effective status: not_established/);
    assert.match(text, /Projection status: pass/);
    assert.match(text, /Projection integrity: missing/);
    assert.match(text, /Authority class: none/);
    assert.match(text, /Blocker refs: runtime_status_decision_receipt_missing/);
  });

  it('renders a cross-attempt receipt as stale', () => {
    const record = verifiedRecord();
    record.currentAttemptId = 'IMP-NEWER';
    const text = render(record);

    assert.match(text, /Effective status: stale/);
    assert.match(text, /Projection status: pass/);
    assert.match(text, /Projection integrity: stale/);
    assert.match(text, /Blocker refs: runtime_status_receipt_attempt_stale/);
  });

  it('renders projection mismatch as blocked', () => {
    const record = verifiedRecord();
    record.sixModelResults.implementation_readiness.status = 'blocked';
    const text = render(record);

    assert.match(text, /Effective status: blocked/);
    assert.match(text, /Projection status: blocked/);
    assert.match(text, /Projection integrity: mismatch/);
    assert.match(text, /Blocker refs: runtime_status_projection_decision_mismatch/);
  });

  it('preserves controlled blockers and evidence for a blocked receipt', () => {
    const text = render(
      verifiedRecord({
        effectiveStatus: 'blocked',
        decision: 'block',
        blockerRefs: ['readiness_gate_failed'],
      })
    );

    assert.match(text, /Effective status: blocked/);
    assert.match(text, /Projection status: blocked/);
    assert.match(text, /Projection integrity: valid/);
    assert.match(text, /Blocker refs: readiness_gate_failed/);
    assert.match(text, /Evidence refs: runtime\/implementation-readiness\/gate\.json/);
  });
});
