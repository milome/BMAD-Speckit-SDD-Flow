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
        '## Current Actionable Requirement Records',
        '## Six Mental Model Panorama',
        '## Runtime Workflow Guidance',
        '## See also: bmad-help',
      ]) {
        assert.match(text, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      for (const fragment of [
        'You are looking at the AI-TDD runtime state for REQ-AWAIT-CLOSEOUT.',
        'The system is waiting for user delivery acceptance.',
        'Do not continue implementation, audit dispatch, or record closure until controlled closeout acceptance ingest completes.',
        'Next safe action: confirm-closeout-acceptance.',
        'What is blocking progress',
        'What to do now',
        'What not to do',
        'Open the closeout confirmation page and run confirm-closeout-acceptance, because delivery_confirmation is waiting for controlled user acceptance.',
        'View Mode: BMAD Upstream Workflow Panorama',
        'Related upstream workflow/skill: bmad-help',
        'To see the BMAD Method workflow panorama and catalog, run `bmad-speckit bmad-help`.',
      ]) {
        assert.match(text, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      for (const forbidden of [
        '## Project State',
        '## Decision Card',
        '## Upstream BMAD Artifacts',
        'Product briefs:',
        'PRDs:',
        'Architectures:',
        'Epics:',
        '## Completed Layer Artifacts',
        '## Implementation Readiness',
        '## Current Route',
        '## Main Agent',
        '## Contract Status',
        '## Stage Evidence',
        '## Command Hints',
        '## BMAD Method Advisory',
      ]) {
        assert.doesNotMatch(text, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.doesNotMatch(text, /你现在看到什么/);
      for (const fragment of [
        'recordId: REQ-AWAIT-CLOSEOUT (first safe action)',
        'source/title: Awaiting closeout acceptance',
        'first safe-action reason: awaiting_user_acceptance',
        'activity state: current_actionable',
        'runtime index pointer status: not_index_pointer',
        'current mental model: delivery_confirmation',
        'schema model status: awaiting_user_acceptance',
        'display state: awaiting_user_acceptance',
        'blocker summary: none',
        'next safe action: confirm-closeout-acceptance',
        'updatedAt/current: 2026-06-01T00:00:00.000Z',
      ]) {
        assert.match(text, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.match(text, /closeout-confirmation-current\.html/);
      assert.match(text, /closeout-render-report\.json/);
      assert.match(text, /sha256:delivery-closeout-report/);
      assert.match(text, /attempt-42/);
      assert.match(text, /confirm-closeout-acceptance with sha256:delivery-closeout-report/);
      assert.match(text, /6\/6\. Delivery Confirmation \(delivery_confirmation\)/);
      assert.match(text, /Question: Can the work be safely called complete, shipped, and closed\?/);
      assert.match(text, /Route basis: current RequirementRecord model/);
      assert.doesNotMatch(text, /60\. Delivery Confirmation/);
      assert.doesNotMatch(text, /Next Safe Action: record_closed/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports zh-CN decision copy when explicitly requested', () => {
    const root = makeRoot([awaitingCloseoutRecord(), implementationReadyRecord()], 'REQ-READY');
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded', lang: 'zh-CN' }));

      for (const fragment of [
        '你正在查看 REQ-AWAIT-CLOSEOUT 的 AI-TDD runtime 状态。',
        '系统在等用户交付验收。',
        '下一安全动作：confirm-closeout-acceptance。',
        '系统在等什么',
        '为什么这很重要',
        '你现在要做什么',
        '不要做什么',
        '## 运行时工作流指引',
        'CSV manifest 只是显示投影；它们永远不会写入 RequirementRecord 控制状态。',
        '安全优先级高于 explicit selection',
        '用户问题: 工作能安全地称为完成、交付并关闭吗？',
        '相关 upstream workflow/skill：bmad-help',
        '如需查看 BMAD 方法学全景和 catalog，运行 `bmad-speckit bmad-help`。',
      ]) {
        assert.match(text, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.doesNotMatch(text, /Why this matters/);
      assert.doesNotMatch(text, /## Runtime Workflow Guidance/);
      assert.doesNotMatch(text, /CSV manifests are display projections only/);
      assert.doesNotMatch(text, /用户问题: Can the work be safely called complete/);
      assert.doesNotMatch(text, /60\. Delivery Confirmation/);
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
    const record = {
      ...implementationReadyRecord('REQ-RECONFIRM'),
      reconfirmation: {
      required: true,
      triggerId: 'SOURCE_SEMANTIC_HASH_CHANGED',
      },
    };
    const root = makeRoot([record], 'REQ-RECONFIRM');
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));

      assert.match(text, /The system is waiting for reconfirmation: SOURCE_SEMANTIC_HASH_CHANGED/);
      assert.match(text, /requirements-contract-authoring authoring-repair-preserve-existing/);
      assert.match(text, /source hash drift/);
      assert.match(text, /post-close defect/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores index recordPath values outside the runtime requirement-records tree', () => {
    const root = makeRoot([implementationReadyRecord('REQ-SAFE-PATH')], 'REQ-SAFE-PATH');
    try {
      const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
      const outside = path.join(root, 'outside-record.json');
      fs.writeFileSync(
        outside,
        `${JSON.stringify(implementationReadyRecord('REQ-OUTSIDE-PATH'), null, 2)}\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(recordsRoot, 'index.json'),
        `${JSON.stringify(
          {
            active: {
              recordId: 'REQ-OUTSIDE-PATH',
              recordPath: '../outside-record.json',
            },
            records: [
              {
                recordId: 'REQ-SAFE-PATH',
                recordPath:
                  '_bmad-output/runtime/requirement-records/REQ-SAFE-PATH/requirement-record.json',
              },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const output = buildBmadsOutput({ projectRoot: root, budget: 'expanded' });

      assert.equal(output.aiTdd.inventory.loadableRecords, 1);
      assert.equal(output.aiTdd.activeRecords[0].recordId, 'REQ-SAFE-PATH');
      assert.doesNotMatch(renderBmads(output), /REQ-OUTSIDE-PATH/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes stale delivery blockers before closeout acceptance confirmation', () => {
    const stale = {
      ...awaitingCloseoutRecord('REQ-STALE-CLOSEOUT'),
      blockers: ['stale_attempt'],
      closeout: {
        ...awaitingCloseoutRecord('REQ-STALE-CLOSEOUT').closeout,
        staleAttempt: true,
      },
    };
    const root = makeRoot([stale], 'REQ-STALE-CLOSEOUT');
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'expanded' });

      assert.equal(output.aiTdd.primaryRecord.primaryReasonToken, 'stale_attempt');
      assert.equal(
        output.aiTdd.primaryRecord.nextSafeAction,
        'requirements-contract-authoring authoring-repair-preserve-existing'
      );
      assert.notEqual(output.aiTdd.primaryRecord.nextSafeAction, 'confirm-closeout-acceptance');
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

  it('renders architecture confirmation prompt fallback without false skill affordance', () => {
    const root = makeRoot([implementationReadyRecord('REQ-ARCH-PROMPT')], 'REQ-ARCH-PROMPT');
    const recordPath = path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      'REQ-ARCH-PROMPT',
      'requirement-record.json'
    );
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    record.currentMentalModel = 'architecture_confirmation';
    delete record.sixModelResults;
    fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'route' }));

      assert.match(text, /## Available Next Actions/);
      assert.match(text, /### Recommended Now/);
      assert.match(text, /Current route: architecture_confirmation/);
      assert.match(text, /Next safe action: prepare_architecture_confirmation/);
      assert.match(text, /This route has no dedicated public skill\. Use the suggested prompt below\./);
      assert.match(text, /Do not proceed to implementation until architecture confirmation is complete\./);
      assert.doesNotMatch(text, /^- Skill: `prepare_architecture_confirmation`/m);
      assert.doesNotMatch(text, /^- Skill: `author-confirmation-ready-source`/m);
      assert.doesNotMatch(text, /^- Skill: `confirm-closeout-acceptance`/m);
      assert.doesNotMatch(text, /`record_closed`/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses nested active index records as indexed active requirements, not user explicit selection', () => {
    const root = makeRoot([implementationReadyRecord('REQ-CI-GOVERNANCE-MAPPING-FIXTURE')], 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE');
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'route' });
      const text = renderBmads(output);

      assert.equal(output.aiTdd.activeRecords.length, 1);
      assert.equal(output.aiTdd.primaryRecord.recordId, 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE');
      assert.equal(output.aiTdd.primaryBecause, 'indexed_active_record');
      assert.equal(output.orchestration.source, 'requirement_record');
      assert.equal(output.orchestration.sessionId, 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE');
      assert.equal(output.quickStart, null);
      assert.match(text, /You are looking at the AI-TDD runtime state for REQ-CI-GOVERNANCE-MAPPING-FIXTURE\./);
      assert.match(text, /recordId: REQ-CI-GOVERNANCE-MAPPING-FIXTURE \(first safe action\)/);
      assert.match(text, /first safe-action reason: indexed_active_record/);
      assert.match(text, /selected by user: no/);
      assert.match(text, /runtime index pointer: yes/);
      assert.doesNotMatch(text, /Source: requirement_record/);
      assert.doesNotMatch(text, /Source: no_active_requirement/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('discovers real record directories beyond stale index.records and ranks them without fake explicit selection', () => {
    const root = makeRoot([implementationReadyRecord('REQ-STALE-INDEX')], 'REQ-STALE-INDEX');
    const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
    const newer = implementationReadyRecord('REQ-NEWER-REAL-RECORD');
    newer.updatedAt = '2026-06-02T00:00:00.000Z';
    const newerDir = path.join(recordsRoot, newer.recordId);
    fs.mkdirSync(newerDir, { recursive: true });
    fs.writeFileSync(
      path.join(newerDir, 'requirement-record.json'),
      `${JSON.stringify(newer, null, 2)}\n`,
      'utf8'
    );
    const indexPath = path.join(recordsRoot, 'index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    index.updatedAt = '2026-04-30T00:00:00.000Z';
    index.active.updatedAt = '2026-04-30T00:00:00.000Z';
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'expanded' });
      const text = renderBmads(output);
      const recordIds = output.aiTdd.activeRecords.map((record) => record.recordId);

      assert.ok(recordIds.includes('REQ-STALE-INDEX'));
      assert.ok(recordIds.includes('REQ-NEWER-REAL-RECORD'));
      assert.equal(output.aiTdd.primaryBecause, 'active_record');
      assert.equal(output.aiTdd.primaryRecord.recordId, 'REQ-NEWER-REAL-RECORD');
      assert.equal(output.aiTdd.primaryRecord.isExplicitSelection, false);
      assert.equal(output.aiTdd.primaryRecord.isIndexedActive, false);
      assert.match(text, /runtime index pointer is older than another current-actionable record/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not count terminal closed records as active/actionable records', () => {
    const closed = implementationReadyRecord('REQ-CLOSED-HISTORY');
    closed.status = 'closed';
    closed.lastEventType = 'record_closed';
    closed.currentMentalModel = 'delivery_confirmation';
    closed.closeoutAcceptance = { status: 'user_accepted_closeout' };
    const active = implementationReadyRecord('REQ-ACTIONABLE');
    const root = makeRoot([closed, active], 'REQ-CLOSED-HISTORY');
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'expanded' });
      const text = renderBmads(output);

      assert.equal(output.aiTdd.inventory.loadableRecords, 2);
      assert.equal(output.aiTdd.inventory.currentActionableRecords, 1);
      assert.equal(output.aiTdd.inventory.closedOrHistoricalRecords, 1);
      assert.deepEqual(
        output.aiTdd.activeRecords.map((record) => record.recordId),
        ['REQ-ACTIONABLE']
      );
      assert.equal(output.aiTdd.primaryRecord.recordId, 'REQ-ACTIONABLE');
      assert.match(text, /Record inventory: 2 loadable record\(s\), 1 current-actionable record\(s\), 1 closed\/history record\(s\)/);
      assert.doesNotMatch(text, /Warning: /);
      assert.match(text, /recordId: REQ-ACTIONABLE \(first safe action\)/);
      assert.doesNotMatch(text, /recordId: REQ-CLOSED-HISTORY/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats fixture runtime index pointers as warnings, not user choices or first safe action overrides', () => {
    const root = makeRoot([implementationReadyRecord('REQ-CI-GOVERNANCE-MAPPING-FIXTURE')], 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE');
    const indexPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    index.items = [
      {
        requirementId: 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE',
        sourceType: 'ci_fixture',
        updatedAt: '2026-04-30T00:00:00.000Z',
      },
    ];
    index.updatedAt = '2026-04-30T00:00:00.000Z';
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'route', lang: 'zh-CN' }));

      assert.match(text, /runtime index 指针状态: ignored_fixture_pointer/);
      assert.match(text, /它不会被当成用户选择，也不会被当成最新需求/);
      assert.match(text, /第一安全动作/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('renders six-model panorama statuses from inferred record evidence instead of pending fallback', () => {
    const record = implementationReadyRecord('REQ-INFERRED-MODEL-STATUS');
    delete record.currentMentalModel;
    delete record.sixModelResults;
    record.architectureConfirmationHash = 'sha256:architecture-ready';
    const root = makeRoot([record], 'REQ-INFERRED-MODEL-STATUS');
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));

      assert.match(text, /1\/6\. Requirement Confirmation \(requirement_confirmation\)/);
      assert.match(text, /Status: pass/);
      assert.match(text, /Evidence source: inferred from sourceDocumentHash \+ implementationConfirmationHash/);
      assert.match(text, /2\/6\. Architecture Confirmation \(architecture_confirmation\)/);
      assert.match(text, /Evidence source: inferred from architectureConfirmationHash/);
      assert.match(text, /3\/6\. Implementation Readiness \(implementation_readiness\)/);
      assert.match(text, /Status: current \(not_established; missing readiness gate evidence\)/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('shows diagnostic upstream and machine details only in full budget', () => {
    const root = makeRoot([implementationReadyRecord('REQ-FULL-DIAGNOSTICS')], 'REQ-FULL-DIAGNOSTICS');
    try {
      const defaultText = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'route' }));
      const fullText = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'full' }));

      for (const diagnostic of [
        '## Upstream BMAD Artifacts',
        'PRDs:',
        '## Stage Evidence',
        '## Contract Status',
        '## Main Agent',
        'Source: requirement_record',
      ]) {
        assert.doesNotMatch(defaultText, new RegExp(diagnostic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(fullText, new RegExp(diagnostic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
