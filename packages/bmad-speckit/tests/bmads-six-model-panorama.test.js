const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { buildBmadsOutput, renderBmads } = require('../dist/runtime/bmads-renderer');
const {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
} = require('../dist/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt');

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

function sha256Value(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function withVerifiedModelStatuses(record, statuses) {
  let next = {
    ...record,
    requirementSetId: record.requirementSetId || `${record.recordId}-SET`,
    currentAttemptId:
      record.currentAttemptId || record.closeout?.currentAttemptId || `IMP-${record.recordId}`,
    sourceDocumentHash: sha256Value(`${record.recordId}:source`),
    implementationConfirmationHash: sha256Value(`${record.recordId}:confirmation`),
    semanticModelHash: sha256Value(`${record.recordId}:semantic-model`),
  };
  for (const [modelId, value] of Object.entries(statuses)) {
    const descriptor = typeof value === 'string' ? { status: value } : value;
    const status = descriptor.status;
    const blockerRefs = descriptor.blockerRefs || [];
    const update = createRuntimeStatusProjectionUpdate({
      recordId: next.recordId,
      requirementSetId: next.requirementSetId,
      modelId,
      implementationAttemptId: next.currentAttemptId,
      sourceDocumentHash: next.sourceDocumentHash,
      implementationConfirmationHash: next.implementationConfirmationHash,
      semanticModelHash: next.semanticModelHash,
      stageInputs: [
        {
          role: `${modelId}_input`,
          path: `runtime/${next.recordId}/${modelId}/input.json`,
          hash: sha256Value(`${next.recordId}:${modelId}:input`),
        },
      ],
      deterministicGateOutputs: [
        {
          role: `${modelId}_decision`,
          path: `runtime/${next.recordId}/${modelId}/decision.json`,
          hash: sha256Value(`${next.recordId}:${modelId}:decision`),
        },
      ],
      blockerRefs,
      evidenceRefs: [`runtime/${next.recordId}/${modelId}/decision.json`],
      authorityClass:
        modelId === 'delivery_confirmation'
          ? 'controlled_closeout'
          : ['requirement_confirmation', 'architecture_confirmation'].includes(modelId)
            ? 'controlled_confirmation'
            : 'deterministic_gate',
      decision:
        descriptor.decision ||
        (status === 'stale' ? 'stale' : status === 'blocked' ? 'block' : 'pass'),
      effectiveStatus: status,
      createdAt: '2026-07-15T00:00:00.000Z',
      receiptPath: `runtime/status/${next.recordId}/${modelId}.json`,
      projection: {
        status,
        blockingReasons: blockerRefs,
      },
    });
    next = {
      ...next,
      ...runtimeStatusProjectionRecordPatch({
        record: next,
        modelId,
        update,
      }),
    };
  }
  return next;
}

function awaitingCloseoutRecord(id = 'REQ-AWAIT-CLOSEOUT') {
  return withVerifiedModelStatuses({
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
  }, {
    delivery_confirmation: 'awaiting_user_acceptance',
  });
}

function implementationReadyRecord(id = 'REQ-READY') {
  return withVerifiedModelStatuses({
    recordId: id,
    requirementSetId: `${id}-SET`,
    title: 'Ready requirement',
    status: 'user_confirmed',
    currentMentalModel: 'implementation_readiness',
    sourceDocumentHash: 'sha256:source-ready',
    implementationConfirmationHash: 'sha256:confirmation-ready',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        sourceDocumentHash: 'sha256:source-ready',
        implementationConfirmationHash: 'sha256:confirmation-ready',
      },
    ],
    sixModelResults: {
      implementation_readiness: { status: 'pass' },
    },
    updatedAt: '2026-06-01T00:01:00.000Z',
  }, {
    requirement_confirmation: 'pass',
    architecture_confirmation: 'pass',
    implementation_readiness: 'pass',
  });
}

function sha256File(filePath) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeUsableCompiledImplementPacket(root, record) {
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    record.recordId
  );
  const traceRoot = path.join(recordRoot, 'trace-execution', 'implement-ready');
  const packetRoot = path.join(recordRoot, 'prompts', 'prompt-packets');
  fs.mkdirSync(traceRoot, { recursive: true });
  fs.mkdirSync(packetRoot, { recursive: true });

  const manifestHash = 'sha256:manifest-ready';
  const sourceProjectionHash = 'sha256:source-projection-ready';
  const modelPacketPath = path.join(traceRoot, 'model_packet.json');
  const humanPromptPath = path.join(traceRoot, 'human_prompt.txt');
  const auditReceiptPath = path.join(traceRoot, 'audit_receipt.json');
  const goalExecutionPath = path.join(traceRoot, 'goal_execution.md');
  fs.writeFileSync(
    modelPacketPath,
    `${JSON.stringify(
      {
        artifactRole: 'execution_authority',
        sourceDocumentHash: record.sourceDocumentHash,
        implementationConfirmationHash: record.implementationConfirmationHash,
        contractExecutionManifest: {
          schemaVersion: 'contract-execution-manifest/v1',
          builderVersion: 'contract-execution-manifest-builder/v1',
          manifestHash,
          sourceProjectionHash,
          implementationConfirmationHash: record.implementationConfirmationHash,
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  fs.writeFileSync(humanPromptPath, 'compiled implementation prompt\n', 'utf8');
  fs.writeFileSync(goalExecutionPath, '# Goal Execution\n', 'utf8');
  fs.writeFileSync(
    auditReceiptPath,
    `${JSON.stringify(
      {
        decision: 'pass',
        sourceDocumentHash: record.sourceDocumentHash,
        implementationConfirmationHash: record.implementationConfirmationHash,
        contractExecutionManifest: {
          schemaVersion: 'contract-execution-manifest/v1',
          builderVersion: 'contract-execution-manifest-builder/v1',
          manifestHash,
          sourceProjectionHash,
        },
        goalCommand: {
          mode: 'native_goal_document_ref',
          documentPath: goalExecutionPath,
          documentHash: sha256File(goalExecutionPath),
        },
        humanPromptRequiredFragmentsPassed: true,
        goalDocumentRequiredFragmentsPassed: true,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const packetPath = path.join(packetRoot, 'implement-ready.json');
  fs.writeFileSync(
    packetPath,
    `${JSON.stringify(
      {
        packetId: 'implement-ready',
        parentSessionId: record.requirementSetId || record.recordId,
        phase: 'implement',
        taskType: 'implement',
        authorityMode: 'compiled_implementation_confirmation',
        compilerBlock: null,
        compiledPromptRef: {
          modelPacketPath,
          modelPacketHash: sha256File(modelPacketPath),
          humanPromptPath,
          humanPromptHash: sha256File(humanPromptPath),
          auditReceiptPath,
          auditReceiptHash: sha256File(auditReceiptPath),
          goalExecutionPath,
          goalExecutionHash: sha256File(goalExecutionPath),
          sourceDocumentHash: record.sourceDocumentHash,
          implementationConfirmationHash: record.implementationConfirmationHash,
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function executionClosurePassedRecord(id = 'REQ-EXECUTION-CLOSED') {
  return withVerifiedModelStatuses({
    recordId: id,
    title: 'Execution closure passed requirement',
    currentMentalModel: 'execution_closure',
    sourceDocumentHash: 'sha256:source-execution-closed',
    implementationConfirmationHash: 'sha256:confirmation-execution-closed',
    sixModelResults: {
      requirement_confirmation: { status: 'pass' },
      architecture_confirmation: { status: 'pass' },
      implementation_readiness: { status: 'pass' },
      execution_closure: { status: 'pass' },
    },
    updatedAt: '2026-06-01T00:02:00.000Z',
  }, {
    requirement_confirmation: 'pass',
    architecture_confirmation: 'pass',
    implementation_readiness: 'pass',
    execution_closure: 'pass',
  });
}

function sectionBetween(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  assert.notEqual(start, -1, `missing section start ${startHeading}`);
  const end = text.indexOf(endHeading, start + startHeading.length);
  assert.notEqual(end, -1, `missing section end ${endHeading}`);
  return text.slice(start, end);
}

describe('bmads Six Mental Models panorama', () => {
  it('does not infer requirement confirmation pass from hashes on a draft record', () => {
    const record = {
      recordId: 'REQ-DRAFT-HASHES',
      requirementSetId: 'REQ-DRAFT-HASHES-SET',
      status: 'draft',
      sourceDocumentHash: 'sha256:source-draft',
      implementationConfirmationHash: 'sha256:confirmation-draft',
      preConfirmationDrilldownLane: {
        currentMentalModel: 'requirement_confirmation',
        controlledIngestRequiredBeforeProgression: true,
      },
      architectureConfirmationState: {
        status: 'missing',
        reasonCode: 'blocked_until_controlled_requirement_confirmation_ingest',
      },
      updatedAt: '2026-07-11T00:00:00.000Z',
    };
    const root = makeRoot([record], record.recordId);
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));

      assert.match(text, /current mental model: requirement_confirmation/);
      assert.match(text, /schema model status: not_established/);
      assert.match(
        text,
        /Evidence source: six_model_projection_missing/
      );
      assert.doesNotMatch(text, /Requirement Confirmation \(requirement_confirmation\)[\s\S]*?Effective status: pass/);
      assert.doesNotMatch(text, /current mental model: architecture_confirmation/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

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
      assert.match(text, /Route basis: current effective runtime route/);
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

  it('advances effective model and next action from the six-model matrices', () => {
    const root = makeRoot([executionClosurePassedRecord()], 'REQ-EXECUTION-CLOSED');
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'route' });
      const text = renderBmads(output);
      const recommendedNow = sectionBetween(text, '### Recommended Now', '### Core Skills');

      assert.equal(output.aiTdd.primaryRecord.currentMentalModel, 'execution_closure');
      assert.equal(output.aiTdd.primaryRecord.effectiveCurrentModel, 'audit_review');
      assert.equal(
        output.aiTdd.primaryRecord.effectiveModelReason,
        'manifest_next_model_after_all_trace_slices_current_pass'
      );
      assert.equal(output.aiTdd.primaryRecord.matrixActionId, 'AUDIT_DISPATCH');
      assert.equal(output.aiTdd.primaryRecord.matrixCondition, 'execution_closure_pass');
      assert.equal(output.aiTdd.primaryRecord.nextSafeAction, 'dispatch_review');
      assert.equal(output.orchestration.nextAction, 'dispatch_review');
      assert.match(output.orchestration.stageSummary.userFacingMessage, /primary route is audit_review/);
      assert.doesNotMatch(output.orchestration.stageSummary.userFacingMessage, /primary route is execution_closure/);
      assert.match(recommendedNow, /Current route: audit_review/);
      assert.match(recommendedNow, /Next safe action: dispatch_review/);
      assert.doesNotMatch(recommendedNow, /req-trace-matrix-prompt-generator/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires controlled dispatch-plan before implementation when readiness passes without compiled artifacts', () => {
    const record = implementationReadyRecord('REQ-DISPATCH-PLAN-REQUIRED');
    const root = makeRoot([record], record.recordId);
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'expanded' });
      const text = renderBmads(output);
      const recommended = sectionBetween(
        text,
        '## Recommended Next Steps',
        '## Available Next Actions'
      );
      const recommendedNow = sectionBetween(text, '### Recommended Now', '### Core Skills');

      assert.equal(output.aiTdd.primaryRecord.currentMentalModel, 'implementation_readiness');
      assert.equal(
        output.aiTdd.primaryRecord.requirementSetId,
        'REQ-DISPATCH-PLAN-REQUIRED-SET'
      );
      assert.equal(output.aiTdd.primaryRecord.effectiveCurrentModel, 'implementation_readiness');
      assert.equal(output.aiTdd.primaryRecord.compiledPacket.status, 'missing');
      assert.equal(output.aiTdd.primaryRecord.nextSafeAction, 'dispatch-plan');
      assert.equal(output.orchestration.nextAction, 'dispatch-plan');
      assert.equal(output.orchestration.pendingPacketStatus, 'missing_compiled_packet');
      assert.match(
        recommended,
        /Run controlled dispatch-plan to compile model_packet\.json, human_prompt\.txt, audit_receipt\.json, and goal_execution\.md/
      );
      assert.match(
        recommended,
        /Only run dispatch_implement after the synchronized artifacts, hashes, and contract manifest validate/
      );
      assert.match(recommendedNow, /Current route: implementation_readiness/);
      assert.match(recommendedNow, /Next safe action: dispatch-plan/);
      assert.doesNotMatch(
        recommendedNow,
        /Please inspect the current RequirementRecord route/
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows dispatch_implement only after compiled artifacts, hashes, and contract manifest validate', () => {
    const record = implementationReadyRecord('REQ-DISPATCH-IMPLEMENT-READY');
    const root = makeRoot([record], record.recordId);
    writeUsableCompiledImplementPacket(root, record);
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'expanded' });
      const text = renderBmads(output);
      const recommendedNow = sectionBetween(text, '### Recommended Now', '### Core Skills');

      assert.equal(output.aiTdd.primaryRecord.compiledPacket.status, 'usable');
      assert.equal(output.aiTdd.primaryRecord.effectiveCurrentModel, 'execution_closure');
      assert.equal(output.aiTdd.primaryRecord.nextSafeAction, 'dispatch_implement');
      assert.equal(output.orchestration.pendingPacketStatus, 'compiled_packet_ready');
      assert.match(recommendedNow, /Current route: execution_closure/);
      assert.match(recommendedNow, /Next safe action: dispatch_implement/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores an uninvoked plan-only native goal handoff after compiled artifacts validate', () => {
    const record = implementationReadyRecord('REQ-DISPATCH-IMPLEMENT-PLAN-ONLY-HANDOFF');
    record.nativeGoalHandoff = {
      schemaVersion: 'native-goal-handoff/v1',
      packetId: 'implement-plan-only',
      taskReportPath: '_bmad-output/runtime/governance/task-reports/plan-only.json',
      imported: false,
      importStatus: 'awaiting_task_report',
    };
    const root = makeRoot([record], record.recordId);
    writeUsableCompiledImplementPacket(root, record);
    try {
      const output = buildBmadsOutput({ projectRoot: root, budget: 'expanded' });

      assert.equal(output.aiTdd.primaryRecord.compiledPacket.status, 'usable');
      assert.equal(output.aiTdd.primaryRecord.effectiveCurrentModel, 'execution_closure');
      assert.equal(output.aiTdd.primaryRecord.nextSafeAction, 'dispatch_implement');
      assert.equal(output.aiTdd.primaryRecord.nativeGoalHandoff, null);
      assert.equal(output.orchestration.nextAction, 'dispatch_implement');
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
    delete record.sixModelResults.architecture_confirmation;
    record.runtimeStatusDecisionReceipts = record.runtimeStatusDecisionReceipts.filter(
      (entry) => entry.receipt.modelId !== 'architecture_confirmation'
    );
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
      assert.equal(output.orchestration.source, 'ai_tdd_runtime_decision');
      assert.equal(output.orchestration.sessionId, 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE-SET');
      assert.equal(output.quickStart, null);
      assert.match(text, /You are looking at the AI-TDD runtime state for REQ-CI-GOVERNANCE-MAPPING-FIXTURE\./);
      assert.match(text, /recordId: REQ-CI-GOVERNANCE-MAPPING-FIXTURE \(first safe action\)/);
      assert.match(text, /first safe-action reason: indexed_active_record/);
      assert.match(text, /selected by user: no/);
      assert.match(text, /runtime index pointer: yes/);
      assert.doesNotMatch(text, /Source: ai_tdd_runtime_decision/);
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

  it('renders six-model panorama statuses from controlled confirmation evidence', () => {
    const record = withVerifiedModelStatuses({
      recordId: 'REQ-INFERRED-MODEL-STATUS',
      requirementSetId: 'REQ-INFERRED-MODEL-STATUS-SET',
      status: 'user_confirmed',
      updatedAt: '2026-06-01T00:01:00.000Z',
    }, {
      requirement_confirmation: 'pass',
      architecture_confirmation: 'pass',
    });
    const root = makeRoot([record], 'REQ-INFERRED-MODEL-STATUS');
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));

      assert.match(text, /1\/6\. Requirement Confirmation \(requirement_confirmation\)/);
      assert.match(text, /Effective status: pass/);
      assert.match(
        text,
        /Evidence source: verified runtime status receipt \(controlled_confirmation\)/
      );
      assert.match(text, /2\/6\. Architecture Confirmation \(architecture_confirmation\)/);
      assert.match(text, /Projection integrity: valid/);
      assert.match(text, /3\/6\. Implementation Readiness \(implementation_readiness\)/);
      assert.match(text, /Effective status: not_established/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not grant architecture confirmation pass from canonical active state alone', () => {
    const record = implementationReadyRecord('REQ-CANONICAL-ARCHITECTURE-STATE');
    delete record.sixModelResults.architecture_confirmation;
    record.architectureConfirmationState = {
      status: 'active',
      currentArchitectureConfirmationRunId: 'ARCH-READY-001',
      currentArchitectureConfirmationHash: 'sha256:architecture-ready',
      lastEventType: 'architecture_confirmation_recorded',
    };
    record.architectureConfirmations = [
      {
        eventType: 'architecture_confirmation_recorded',
        decision: 'full_architecture_confirmed',
        architectureConfirmationArtifactHash: 'sha256:architecture-ready',
        confirmedBy: 'user',
      },
    ];
    const root = makeRoot([record], record.recordId);
    try {
      const text = renderBmads(buildBmadsOutput({ projectRoot: root, budget: 'expanded' }));
      const panorama = sectionBetween(
        text,
        '## Six Mental Model Panorama',
        '## Runtime Workflow Guidance'
      );
      const architectureRow = sectionBetween(
        panorama,
        '- 2/6. Architecture Confirmation (architecture_confirmation)',
        '- 3/6. Implementation Readiness (implementation_readiness)'
      );

      assert.match(
        architectureRow,
        /Effective status: not_established/
      );
      assert.match(
        architectureRow,
        /Blocker refs: six_model_projection_missing/
      );
      assert.doesNotMatch(architectureRow, /Effective status: pass/);
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
        'Source: ai_tdd_runtime_decision',
      ]) {
        assert.doesNotMatch(defaultText, new RegExp(diagnostic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(fullText, new RegExp(diagnostic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
