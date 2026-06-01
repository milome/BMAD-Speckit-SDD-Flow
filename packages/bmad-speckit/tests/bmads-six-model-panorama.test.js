const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildBmadsOutput, renderBmads } = require('../src/runtime/bmads-renderer');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function makeRoot(records, activeRecordId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-six-model-'));
  fs.cpSync(path.join(PROJECT_ROOT, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
    '{"flow":"story","stage":"prd"}\n',
    'utf8'
  );
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  fs.mkdirSync(recordsRoot, { recursive: true });
  for (const record of records) {
    const recordDir = path.join(recordsRoot, record.recordId);
    fs.mkdirSync(recordDir, { recursive: true });
    fs.writeFileSync(
      path.join(recordDir, 'requirement-record.json'),
      `${JSON.stringify(record, null, 2)}\n`,
      'utf8'
    );
  }
  fs.writeFileSync(
    path.join(recordsRoot, 'index.json'),
    `${JSON.stringify(
      {
        version: 1,
        active: {
          recordId: activeRecordId,
          recordPath: `_bmad-output/runtime/requirement-records/${activeRecordId}/requirement-record.json`,
        },
        records: records.map((record) => ({
          recordId: record.recordId,
          recordPath: `_bmad-output/runtime/requirement-records/${record.recordId}/requirement-record.json`,
        })),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return root;
}

function makeConsumerLikeRoot(records, activeRecordId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-consumer-like-'));
  fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
    '{"flow":"story","stage":"prd"}\n',
    'utf8'
  );
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  fs.mkdirSync(recordsRoot, { recursive: true });
  for (const record of records) {
    const recordDir = path.join(recordsRoot, record.recordId);
    fs.mkdirSync(recordDir, { recursive: true });
    fs.writeFileSync(
      path.join(recordDir, 'requirement-record.json'),
      `${JSON.stringify(record, null, 2)}\n`,
      'utf8'
    );
  }
  fs.writeFileSync(
    path.join(recordsRoot, 'index.json'),
    `${JSON.stringify(
      {
        active: {
          recordId: activeRecordId,
          recordPath: `_bmad-output/runtime/requirement-records/${activeRecordId}/requirement-record.json`,
        },
        records: records.map((record) => ({
          recordId: record.recordId,
          recordPath: `_bmad-output/runtime/requirement-records/${record.recordId}/requirement-record.json`,
        })),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return root;
}

function awaitingCloseoutRecord(id = 'REQ-AWAIT-CLOSEOUT') {
  return {
    recordId: id,
    title: 'Awaiting closeout acceptance',
    currentMentalModel: 'delivery_confirmation',
    sourceDocumentHash: 'sha256:source-a',
    implementationConfirmationHash: 'sha256:confirmation-a',
    sixModelResults: {
      delivery_confirmation: { status: 'awaiting_user_acceptance' },
    },
    closeout: {
      status: 'awaiting_user_acceptance',
      currentAttemptId: 'attempt-42',
      confirmationPagePath:
        '_bmad-output/runtime/requirement-records/REQ-AWAIT-CLOSEOUT/closeout-confirmation-current.html',
      renderReportPath:
        '_bmad-output/runtime/requirement-records/REQ-AWAIT-CLOSEOUT/closeout-render-report.json',
      deliveryCloseoutReportHash: 'sha256:delivery-closeout-report',
      acceptanceRequest: {
        status: 'pending',
        exactInstruction: 'confirm-closeout-acceptance with sha256:delivery-closeout-report',
      },
    },
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function implementationReadyRecord(id = 'REQ-READY') {
  return {
    recordId: id,
    title: 'Ready requirement',
    currentMentalModel: 'implementation_readiness',
    sourceDocumentHash: 'sha256:source-ready',
    implementationConfirmationHash: 'sha256:confirmation-ready',
    sixModelResults: {
      implementation_readiness: { status: 'pass' },
    },
    updatedAt: '2026-06-01T00:01:00.000Z',
  };
}

describe('bmads Six Mental Models panorama', () => {
  it('runs from a consumer project without a local _bmad source tree', () => {
    const root = makeConsumerLikeRoot([implementationReadyRecord()], 'REQ-READY');
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'route' }));

      assert.equal(fs.existsSync(path.join(root, '_bmad')), false);
      assert.match(text, /View Mode: AI-TDD Runtime Six-Model Panorama/);
      assert.match(text, /recordId: REQ-READY/);
      assert.match(text, /Six Mental Model Panorama/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('renders required runtime sections and all active record fields', () => {
    const root = makeRoot([awaitingCloseoutRecord(), implementationReadyRecord()], 'REQ-READY');
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));

      for (const fragment of [
        'View Mode: AI-TDD Runtime Six-Model Panorama',
        '## Status Summary',
        '## Recommended Next Steps',
        '## Active Requirement Records',
        '## Six Mental Model Panorama',
        '## Runtime Workflow Guidance',
        '## Command Hints',
        '## See also: bmad-help',
      ]) {
        assert.match(text, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      for (const fragment of [
        'recordId: REQ-AWAIT-CLOSEOUT (primary)',
        'source/title: Awaiting closeout acceptance',
        'current mental model: delivery_confirmation',
        'schema model status: awaiting_user_acceptance',
        'display state: awaiting_user_acceptance',
        'blocker summary: none',
        'next safe action: confirm-closeout-acceptance',
        'updatedAt/current: 2026-06-01T00:00:00.000Z',
      ]) {
        assert.match(text, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.match(text, /Primary because: awaiting_user_acceptance/);
      assert.match(text, /closeout-confirmation-current\.html/);
      assert.match(text, /closeout-render-report\.json/);
      assert.match(text, /sha256:delivery-closeout-report/);
      assert.match(text, /attempt-42/);
      assert.match(text, /confirm-closeout-acceptance with sha256:delivery-closeout-report/);
      assert.doesNotMatch(text, /Next Safe Action: record_closed/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not let explicit user selection override safety blockers', () => {
    const root = makeRoot([awaitingCloseoutRecord(), implementationReadyRecord()], 'REQ-READY');
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'route' });

      assert.equal(output.aiTdd.primaryRecord.recordId, 'REQ-AWAIT-CLOSEOUT');
      assert.equal(output.aiTdd.primaryBecause, 'awaiting_user_acceptance');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('recommends req-trace for /goal only when the active record is current and safe', () => {
    const root = makeRoot([implementationReadyRecord()], 'REQ-READY');
    try {
      const output = buildBmadsOutput({ projectRoot: root });

      assert.equal(output.aiTdd.goalRoute.skill, 'req-trace-matrix-prompt-generator');
      assert.equal(output.aiTdd.goalRoute.reason, 'active_requirement_record_current');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes /goal back to current next safe action when reconfirmation is open', () => {
    const record = implementationReadyRecord('REQ-RECONFIRM');
    record.reconfirmation = {
      required: true,
      triggerId: 'SOURCE_SEMANTIC_HASH_CHANGED',
    };
    const root = makeRoot([record], 'REQ-RECONFIRM');
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));

      assert.match(text, /Primary because: open_reconfirmation/);
      assert.match(text, /requirements-contract-authoring authoring-repair-preserve-existing/);
      assert.match(text, /source hash drift/);
      assert.match(text, /post-close defect/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('recommends independent goal contract generation when no active record exists', () => {
    const root = makeRoot([], '');
    try {
      const output = buildBmadsOutput({ projectRoot: root });

      assert.equal(output.aiTdd.goalRoute.skill, 'goal-execution-contract-generator');
      assert.equal(output.aiTdd.goalRoute.reason, 'no_active_requirement_record');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
