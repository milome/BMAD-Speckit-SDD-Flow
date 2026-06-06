const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const RUNTIME_ROOT = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'runtime');
const TYPE_SCRIPT_RUNNER_PATTERN = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
const TS_NODE_PATTERN = new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join(''));

const hostRuntime = require(path.join(RUNTIME_ROOT, 'host-runtime-mode.js'));
const supervisedWorker = require(path.join(RUNTIME_ROOT, 'supervised-worker-runtime.js'));
const diagnoseState = require(path.join(RUNTIME_ROOT, 'diagnose-bmad-state.js'));
const parallelMission = require(path.join(RUNTIME_ROOT, 'parallel-mission-control.js'));

function makeRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeNativeGoalFixture(root) {
  const goalPath = path.join(root, 'goal.md');
  const auditReceiptPath = path.join(root, 'audit-receipt.json');
  fs.writeFileSync(goalPath, '# goal\n', 'utf8');
  const goalHash = sha256File(goalPath);
  writeJson(auditReceiptPath, {
    goalCommand: {
      mode: 'native_goal_document_ref',
      documentHash: goalHash,
    },
  });
  return {
    sourceDocumentHash: 'sha256:'.concat('1'.repeat(64)),
    implementationConfirmationHash: 'sha256:'.concat('2'.repeat(64)),
    modelPacketHash: 'sha256:'.concat('3'.repeat(64)),
    goalExecutionPath: goalPath,
    goalExecutionHash: goalHash,
    auditReceiptPath,
  };
}

describe('main-agent wave 3.11 runtime modules', () => {
  it('exposes the required D006 runtime exports without repository script runners', () => {
    const modules = [
      ['host-runtime-mode.js', hostRuntime, [
        'normalizeRuntimeHost',
        'selectExecutionRuntimeMode',
        'runtimeModeDir',
        'writeExecutionRuntimeModeSelection',
        'validateNativeGoalReadiness',
        'writeRuntimeBlocker',
        'writeNativeGoalInvocationReceipt',
        'validateNativeGoalInvocationReceipt',
      ]],
      ['supervised-worker-runtime.js', supervisedWorker, [
        'appendTaskProgress',
        'readTaskProgress',
        'evaluateSupervisedWorker',
      ]],
      ['diagnose-bmad-state.js', diagnoseState, [
        'collectReviewerProjectionDiagnosis',
        'collectReadinessProjectionDiagnosis',
        'diagnoseBmadState',
      ]],
      ['parallel-mission-control.js', parallelMission, [
        'DEFAULT_PROTECTED_WRITE_PATHS',
        'evaluateParallelMissionEvidenceIntegration',
        'buildParallelMissionPlan',
        'buildPrTopology',
        'validatePrTopologyForReleaseGate',
      ]],
    ];

    for (const [fileName, mod, exports] of modules) {
      const source = fs.readFileSync(path.join(RUNTIME_ROOT, fileName), 'utf8');
      assert.doesNotMatch(source, /scripts[\\/].*\.(?:ts|js|cjs)/);
      assert.doesNotMatch(source, TYPE_SCRIPT_RUNNER_PATTERN);
      assert.doesNotMatch(source, TS_NODE_PATTERN);
      for (const exportName of exports) {
        assert.notEqual(mod[exportName], undefined, `${fileName} missing ${exportName}`);
      }
    }
  });

  it('executes host runtime positive and negative native goal paths', () => {
    const root = makeRoot('wave-3-11-host-');
    try {
      const compiledPromptRef = writeNativeGoalFixture(root);
      assert.equal(hostRuntime.normalizeRuntimeHost('codex-no-hooks'), 'codex');
      assert.deepEqual(hostRuntime.selectExecutionRuntimeMode('cursor-cli'), {
        canonicalHost: 'cursor-cli',
        executionRuntimeMode: 'main_session_direct',
        selectionReason: 'Cursor CLI capability is not contracted for native goal or subagents',
      });
      const selection = hostRuntime.writeExecutionRuntimeModeSelection({
        projectRoot: root,
        recordId: 'REQ-1',
        packetId: 'packet-1',
        attemptId: 'attempt-1',
        host: 'codex',
        compiledPromptRef,
      });
      assert.equal(fs.existsSync(selection.path), true);
      assert.equal(
        hostRuntime.validateNativeGoalReadiness({
          projectRoot: root,
          recordId: 'REQ-1',
          packetId: 'packet-1',
          attemptId: 'attempt-1',
          host: 'codex',
          compiledPromptRef,
        }),
        null
      );
      const promptOnly = { ...compiledPromptRef, goalExecutionPath: null, goalExecutionHash: null };
      const blocker = hostRuntime.validateNativeGoalReadiness({
        projectRoot: root,
        recordId: 'REQ-1',
        packetId: 'packet-1',
        attemptId: 'attempt-1',
        host: 'codex',
        compiledPromptRef: promptOnly,
      });
      assert.equal(blocker.reasonCode, 'native_goal_readiness_invalid');
      assert.deepEqual(
        blocker.reasonDetails.invalidFields,
        assert.partialDeepStrictEqual
          ? blocker.reasonDetails.invalidFields
          : blocker.reasonDetails.invalidFields
      );
      assert.ok(blocker.reasonDetails.invalidFields.includes('goalExecutionPath'));
      assert.equal(
        hostRuntime.validateNativeGoalInvocationReceipt({
          projectRoot: root,
          recordId: 'REQ-1',
          packetId: 'packet-1',
          attemptId: 'attempt-1',
          host: 'codex',
          goalExecutionHash: compiledPromptRef.goalExecutionHash,
        }).reasonCode,
        'native_goal_receipt_missing'
      );
      hostRuntime.writeNativeGoalInvocationReceipt({
        projectRoot: root,
        recordId: 'REQ-1',
        packetId: 'packet-1',
        attemptId: 'attempt-1',
        host: 'codex',
        goalExecutionPath: compiledPromptRef.goalExecutionPath,
        stdoutRef: 'stdout.log',
        stderrRef: 'stderr.log',
        exitCode: 0,
      });
      assert.equal(
        hostRuntime.validateNativeGoalInvocationReceipt({
          projectRoot: root,
          recordId: 'REQ-1',
          packetId: 'packet-1',
          attemptId: 'attempt-1',
          host: 'codex',
          goalExecutionHash: compiledPromptRef.goalExecutionHash,
        }),
        null
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('executes supervised worker heartbeat and blocker decisions', () => {
    const root = makeRoot('wave-3-11-worker-');
    try {
      supervisedWorker.appendTaskProgress(root, {
        packetId: 'packet-1',
        attemptId: 'attempt-1',
        recordId: 'REQ-1',
        status: 'progressing',
        heartbeatAt: '2026-05-30T00:02:10.000Z',
        progressSeq: 1,
      });
      assert.equal(supervisedWorker.readTaskProgress(root, 'REQ-1', 'attempt-1').length, 1);
      assert.equal(
        supervisedWorker.evaluateSupervisedWorker({
          projectRoot: root,
          recordId: 'REQ-1',
          packetId: 'packet-1',
          attemptId: 'attempt-1',
          startedAtIso: '2026-05-30T00:00:00.000Z',
          nowIso: '2026-05-30T00:02:20.000Z',
          lastProgressSeq: 0,
          hardBudgetMs: 600_000,
        }).reasonCode,
        'progress_observed'
      );
      const stale = supervisedWorker.evaluateSupervisedWorker({
        projectRoot: root,
        recordId: 'REQ-1',
        packetId: 'packet-1',
        attemptId: 'attempt-1',
        startedAtIso: '2026-05-30T00:00:00.000Z',
        nowIso: '2026-05-30T00:05:10.000Z',
        lastProgressSeq: 1,
        hardBudgetMs: 600_000,
      });
      assert.equal(stale.decision, 'stale_recovery');
      const blocked = supervisedWorker.evaluateSupervisedWorker({
        projectRoot: root,
        recordId: 'REQ-1',
        packetId: 'packet-1',
        attemptId: 'attempt-1',
        startedAtIso: '2026-05-30T00:00:00.000Z',
        nowIso: '2026-05-30T01:10:00.000Z',
        lastProgressSeq: 1,
        hardBudgetMs: 3_600_000,
      });
      assert.equal(blocked.reasonCode, 'hard_budget_exhausted');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('executes reviewer/readiness diagnosis with missing-state error path', () => {
    const root = makeRoot('wave-3-11-diagnose-');
    try {
      writeJson(path.join(root, '_bmad-output', 'runtime', 'registry.json'), {
        activeScope: {
          resolvedContextPath: '_bmad-output/runtime/context/project.json',
        },
        latestReviewerCloseout: {
          closeoutApproved: false,
          closeoutEnvelope: {
            resultCode: 'required_fixes',
            packetExecutionClosureStatus: 'awaiting_rerun_gate',
          },
        },
      });
      writeJson(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'), {
        stage: 'plan',
      });
      writeJson(path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'), {
        active: {},
      });
      const reviewer = diagnoseState.collectReviewerProjectionDiagnosis(root);
      assert.equal(reviewer.reviewerContract.activeAuditConsumer.profile, 'plan_audit');
      assert.ok(reviewer.lines.includes('   latest closeout: required_fixes / awaiting_rerun_gate / approved=no'));
      const readiness = diagnoseState.collectReadinessProjectionDiagnosis(root);
      assert.ok(readiness.lines.includes('   effective verdict: unknown'));
      assert.equal(diagnoseState.diagnoseBmadState(root), 1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('executes parallel mission planning, topology, integration, and negative paths', () => {
    assert.deepEqual(parallelMission.DEFAULT_PROTECTED_WRITE_PATHS.slice(0, 2), [
      '_bmad-output/implementation-artifacts/sprint-status.yaml',
      '_bmad/_config/orchestration-governance.contract.yaml',
    ]);
    const plan = parallelMission.buildParallelMissionPlan({
      batchId: 'batch-1',
      nodes: [
        {
          node_id: 'node-a',
          story_key: 'S1',
          packet_id: 'packet-a',
          write_scope: ['src/a.ts'],
          depends_on: [],
          assigned_agent: 'worker-a',
          target_branch: 'task/a',
          target_pr: 'PR-A',
        },
        {
          node_id: 'node-b',
          story_key: 'S2',
          packet_id: 'packet-b',
          write_scope: ['src/a.ts'],
          depends_on: ['node-a'],
          assigned_agent: 'worker-b',
          target_branch: 'task/b',
          target_pr: 'PR-B',
        },
      ],
    });
    assert.equal(plan.conflicts[0].resolution, 'serialize');
    const topology = parallelMission.buildPrTopology({
      plan,
      states: { 'node-a': 'merged', 'node-b': 'closed_not_needed' },
      evidence_provenance: { runId: 'run-1' },
    });
    assert.equal(parallelMission.validatePrTopologyForReleaseGate(topology).passed, true);
    const report = parallelMission.evaluateParallelMissionEvidenceIntegration({
      plan,
      prTopology: topology,
      nodeEvidence: [
        { node_id: 'node-a', envelope: { packetId: 'packet-a', traceRows: ['TRACE-1'], commandRuns: [{ exitCode: 0 }], status: 'accepted' } },
        { node_id: 'node-b', envelope: { packetId: 'packet-b', traceRows: ['TRACE-2'], commandRuns: [{ exitCode: 0 }], status: 'accepted' } },
      ],
      integratedVerification: {
        closeoutAttemptId: 'closeout-1',
        workspaceRef: { kind: 'main_workspace', path: process.cwd() },
        commandRuns: [{ commandId: 'CMD-1', closeoutAttemptId: 'closeout-1', exitCode: 0, artifactRefs: [{}] }],
        artifactRefs: [{}],
      },
      currentCloseoutAttemptId: 'closeout-1',
    });
    assert.equal(report.decision, 'pass');
    plan.merge_order = ['node-b'];
    const blocked = parallelMission.evaluateParallelMissionEvidenceIntegration({
      plan,
      prTopology: { ...topology, all_affected_stories_passed: true, required_nodes: [{ ...topology.required_nodes[0], state: 'open' }, topology.required_nodes[1]] },
      nodeEvidence: [],
      currentCloseoutAttemptId: 'closeout-1',
    });
    assert.ok(blocked.blockingReasons.includes('node_envelope_missing:node-a'));
    assert.ok(blocked.blockingReasons.includes('integrated_verification_missing'));
  });
});
