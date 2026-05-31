import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  NO_ACTIVE_REQUIREMENT,
  requirementRecordIndexPath,
  requirementRecordsRoot,
  resolveActiveRequirement,
} from '../../scripts/resolve-active-requirement';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { mainMainAgentOrchestration } from '../../scripts/main-agent-orchestration';

let root: string;

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolved-runtime-context-'));
  fs.cpSync(path.join(process.cwd(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function writeRequirementRecord(overrides: Record<string, unknown> = {}): {
  recordPath: string;
  indexPath: string;
} {
  const requirementSetId = String(overrides.requirementSetId ?? 'REQSET-ACTIVE-001');
  const sourcePath = 'tests/fixtures/requirements/active-requirement.md';
  const base = path.join(requirementRecordsRoot(root), requirementSetId);
  fs.mkdirSync(path.join(base, 'recovery'), { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  const shouldWriteSnapshot = overrides.writeRuntimePolicySnapshot !== false;
  const runtimePolicySnapshot = {
    kind: 'runtime-policy-snapshot',
    schemaVersion: 'runtime-policy-snapshot/v1',
    flow: overrides.flow ?? 'story',
    stage: overrides.stage ?? 'implement',
    policy: {
      flow: overrides.flow ?? 'story',
      stage: overrides.stage ?? 'implement',
    },
  };
  const runtimePolicySnapshotText = `${JSON.stringify(runtimePolicySnapshot, null, 2)}\n`;
  const runtimePolicySnapshotPath = `_bmad-output/runtime/requirement-records/${requirementSetId}/recovery/runtime-policy-snapshot.json`;
  const record = {
    recordId: 'REQ-ACTIVE-001',
    requirementSetId,
    status: 'user_confirmed',
    flow: 'story',
    stage: 'implement',
    entryFlow: 'story',
    entryFlowClass: 'full_story_entry',
    workflowAdapter: 'bmad',
    sourceMode: 'full_bmad',
    sourcePath,
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationPageHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-ACTIVE-001',
        requirementSetId,
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'test-fixture',
        sourcePath,
        sourceDocumentHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        sourceDocumentHashScope: 'semantic_source_excluding_confirmation_bookkeeping',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        implementationConfirmationHashScope:
          'semantic_implementation_confirmation_excluding_bookkeeping',
        confirmationPageHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmationText:
          'confirmed sourceDocumentHash=sha256:1111111111111111111111111111111111111111111111111111111111111111 implementationConfirmationHash=sha256:2222222222222222222222222222222222222222222222222222222222222222 confirmationPageHash=sha256:3333333333333333333333333333333333333333333333333333333333333333',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQ-ACTIVE-001/confirmation/confirmation-render-report.json',
        htmlPath:
          '_bmad-output/runtime/requirement-records/REQ-ACTIVE-001/confirmation/confirmation.html',
        entryFlow: 'story',
        entryFlowClass: 'full_story_entry',
        workflowAdapter: 'bmad',
        contractAuthoringRequired: true,
      },
    ],
    epicId: 'epic-01',
    storyId: '1.1',
    runId: 'run-active-001',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-01/story-1.1',
    artifactPath: '_bmad-output/implementation-artifacts/epic-01/story-1.1/story.md',
    runtimePolicySnapshotRef: {
      artifactType: 'runtime_policy_snapshot',
      sourceOfTruthRole: 'projection',
      path: runtimePolicySnapshotPath,
      contentHash: sha256Text(runtimePolicySnapshotText),
      producer: 'resolve-active-requirement.test',
      purpose: 'exercise requirement-scoped runtime policy resolution',
      relatedRequirementIds: [requirementSetId],
      status: 'active',
      inputVersion: 'resolve-active-requirement-fixture-v1',
      outputVersion: 'runtime-policy-snapshot/v1',
    },
    recoveryContextRef: {
      path: `_bmad-output/runtime/requirement-records/${requirementSetId}/recovery/recovery-context.json`,
    },
    implementationEntryGate: {
      gateName: 'implementation-readiness',
      requestedFlow: 'story',
      recommendedFlow: 'story',
      decision: 'pass',
      readinessStatus: 'ready_clean',
      blockerCodes: [],
      blockerSummary: [],
      rerouteRequired: false,
      rerouteReason: null,
      evidenceSources: {
        readinessReportPath: null,
        remediationArtifactPath: null,
        executionRecordPath: null,
        authoritativeAuditReportPath: null,
      },
      semanticFingerprint: 'story.md',
      evaluatedAt: '2026-05-19T00:00:00.000Z',
    },
    ...overrides,
  };
  for (const source of [record.sourcePath, record.artifactPath]) {
    if (typeof source !== 'string' || source.length === 0) continue;
    const absolute = path.resolve(root, source);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    if (!fs.existsSync(absolute)) {
      fs.writeFileSync(absolute, `# Fixture source for ${record.recordId}\n`, 'utf8');
    }
  }
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  if (shouldWriteSnapshot) {
    fs.writeFileSync(
      path.join(base, 'recovery', 'runtime-policy-snapshot.json'),
      runtimePolicySnapshotText,
      'utf8'
    );
  }
  fs.writeFileSync(
    path.join(base, 'recovery', 'recovery-context.json'),
    '{"kind":"recovery-context"}\n',
    'utf8'
  );

  const indexPath = requirementRecordIndexPath(root);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    `${JSON.stringify(
      {
        version: 1,
        active: {
          recordId: record.recordId,
          requirementSetId,
          runId: record.runId,
        },
        records: [
          {
            recordId: record.recordId,
            requirementSetId,
            runId: record.runId,
            recordPath: path.relative(root, recordPath).replace(/\\/g, '/'),
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { recordPath, indexPath };
}

function captureStdout(fn: () => number): { code: number; stdout: string; stderr: string } {
  const chunks: string[] = [];
  const errors: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  const origError = console.error;
  process.stdout.write = (msg: string | Uint8Array) => {
    chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
    return true;
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(' '));
  };
  try {
    return { code: fn(), stdout: chunks.join(''), stderr: errors.join('\n') };
  } finally {
    process.stdout.write = origWrite;
    console.error = origError;
  }
}

function writeFakeReqTraceSkill(projectRoot: string): void {
  const scriptPath = path.join(
    projectRoot,
    '_bmad',
    'skills',
    'req-trace-matrix-prompt-generator',
    'scripts',
    'generate_prompt.js'
  );
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(
    scriptPath,
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const crypto = require('node:crypto');",
      'function arg(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; }',
      "function sha(value) { return 'sha256:' + crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }",
      "const outDir = arg('--out-dir');",
      "const recordPath = arg('--requirement-record');",
      "const profilePath = arg('--execution-discipline-profile-ref');",
      "if (!outDir || !recordPath) { console.log('BLOCK: missing args'); process.exit(3); }",
      'fs.mkdirSync(outDir, { recursive: true });',
      "const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));",
      "const profile = profilePath && fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : { profileId: 'test-profile', profileHash: 'sha256:test' };",
      "const modelPacket = { artifactRole: 'execution_authority', sourceDocumentHash: record.sourceDocumentHash, implementationConfirmationHash: record.implementationConfirmationHash, executionDisciplineProfile: profile };",
      "fs.writeFileSync(path.join(outDir, 'model_packet.json'), JSON.stringify(modelPacket, null, 2) + '\\n', 'utf8');",
      "fs.writeFileSync(path.join(outDir, 'human_prompt.txt'), `Execution Discipline Profile\\nprofileId: ${profile.profileId}\\nprofileHash: ${profile.profileHash}\\ncompiled direct body\\n`, 'utf8');",
      "const goalPath = path.join(outDir, 'goal_execution.md');",
      "fs.writeFileSync(goalPath, `## Execution Discipline Profile\\nprofileId: ${profile.profileId}\\nprofileHash: ${profile.profileHash}\\n`, 'utf8');",
      "const receipt = { decision: 'pass', goalCommand: { mode: 'native_goal_document_ref', documentHash: sha(fs.readFileSync(goalPath, 'utf8')) }, executionHost: arg('--execution-host'), humanPromptProfile: arg('--human-prompt-profile'), humanPromptLanguage: arg('--prompt-language'), continuationDirective: { strategy: 'test' }, humanPromptRequiredFragmentsPassed: true, executionDisciplineProfile: { profileId: profile.profileId, profileHash: profile.profileHash, humanPromptProfileRendered: true, goalExecutionProfileRendered: true } };",
      "fs.writeFileSync(path.join(outDir, 'audit_receipt.json'), JSON.stringify(receipt, null, 2) + '\\n', 'utf8');",
      'process.exit(0);',
      '',
    ].join('\n'),
    'utf8'
  );
}

describe('Active Requirement Resolver / ResolvedRuntimeContext', () => {
  it('fails closed with NO_ACTIVE_REQUIREMENT when no active requirement exists', () => {
    expect(() => resolveActiveRequirement({ root })).toThrow(NO_ACTIVE_REQUIREMENT);
    expect(fs.existsSync(requirementRecordIndexPath(root))).toBe(false);
  });

  it('resolves active requirement from requirement-records index without legacy project context', () => {
    const { recordPath, indexPath } = writeRequirementRecord();
    expect(
      fs.existsSync(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'))
    ).toBe(false);

    const resolved = resolveActiveRequirement({ root });
    expect(resolved).toMatchObject({
      kind: 'ResolvedRuntimeContext',
      recordId: 'REQ-ACTIVE-001',
      requirementSetId: 'REQSET-ACTIVE-001',
      flow: 'story',
      stage: 'implement',
      runId: 'run-active-001',
      resolutionSource: 'index_active',
      runtimePolicySnapshotExists: true,
      recoveryContextExists: true,
    });
    expect(resolved.indexPath).toBe(indexPath);
    expect(resolved.recordPath).toBe(recordPath);
  });

  it('CLI fails closed on explicit record miss with repair projection', () => {
    writeRequirementRecord();
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/ts-node/dist/bin.js',
        '--project',
        'tsconfig.node.json',
        '--transpile-only',
        'scripts/resolve-active-requirement.ts',
        '--cwd',
        root,
        '--record-id',
        'REQ-NOT-FOUND',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('resolve-active-requirement:');
    expect(result.stderr).toContain('blocked_missing_active_requirement');
    expect(result.stderr).toContain('index-repair-projection.json');
  });

  it('emit-runtime-policy reads flow/stage from ResolvedRuntimeContext, not legacy context', () => {
    writeRequirementRecord();
    const result = captureStdout(() => mainEmitRuntimePolicy(['--cwd', root]));

    expect(result.code, result.stderr).toBe(0);
    const policy = JSON.parse(result.stdout);
    expect(policy.flow).toBe('story');
    expect(policy.stage).toBe('implement');
    expect(policy.identity.storyId).toBe('1.1');
    expect(policy.identity.runId).toBe('run-active-001');
  });

  it('resolves stage from requirement-scoped runtimePolicySnapshot when record omits legacy stage fields', () => {
    writeRequirementRecord({ stage: undefined });
    const resolved = resolveActiveRequirement({ root });

    expect(resolved).toMatchObject({
      flow: 'story',
      stage: 'implement',
      runtimePolicySnapshotExists: true,
    });
  });

  it('bootstraps standalone task implement stage from confirmed record without legacy context or snapshot', () => {
    writeRequirementRecord({
      flow: undefined,
      stage: undefined,
      entryFlow: 'standalone_tasks',
      entryFlowClass: 'task_packet_entry',
      workflowAdapter: 'direct',
      sourceMode: undefined,
      epicId: undefined,
      storyId: undefined,
      artifactRoot: undefined,
      artifactPath: 'docs/design/example.md',
      runtimePolicySnapshotRef: undefined,
      writeRuntimePolicySnapshot: false,
      implementationEntryGate: undefined,
      architectureConfirmationState: {
        status: 'active',
        currentArchitectureConfirmationHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      },
    });

    const resolved = resolveActiveRequirement({ root });

    expect(resolved).toMatchObject({
      flow: 'standalone_tasks',
      stage: 'implement',
      runtimePolicySnapshotExists: false,
    });
    expect(
      fs.existsSync(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'))
    ).toBe(false);
  });

  it('main-agent inspect uses requirement record implementation gate and orchestration hints', () => {
    writeRequirementRecord({
      architectureConfirmationState: {
        status: 'active',
        currentArchitectureConfirmationHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
    });
    const result = captureStdout(() =>
      mainMainAgentOrchestration(['--cwd', root, '--action', 'inspect'])
    );

    expect(result.code, result.stderr).toBe(0);
    const surface = JSON.parse(result.stdout);
    expect(surface.source).toBe('requirement_record');
    expect(surface.latestGate).toMatchObject({
      gateId: 'implementation-readiness',
      decision: 'pass',
    });
    expect(surface.mainAgentNextAction).toBe('dispatch_implement');
    expect(surface.mainAgentReady).toBe(true);
  });

  it('main-agent inspect uses latest controlled gate and rerun lifecycle records', () => {
    writeRequirementRecord({
      architectureConfirmationState: {
        status: 'active',
        currentArchitectureConfirmationHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
      rerunLoops: [
        {
          rerunLoopId: 'rerun-stale-hash',
          status: 'in_progress',
          sourceRefs: [{ sourceType: 'gate_check', id: 'delivery-closeout:old' }],
        },
        {
          rerunLoopId: 'rerun-stale-hash',
          status: 'resolved',
          sourceRefs: [{ sourceType: 'gate_check', id: 'delivery-closeout:old' }],
          recheckRefs: [{ sourceType: 'execution_iteration', id: 'iteration-current' }],
        },
      ],
      gateChecks: [
        {
          checkId: 'delivery-closeout:old',
          gate: 'Delivery Closeout Gate',
          decision: 'blocked',
          closeoutAttemptId: 'old-attempt',
        },
        {
          checkId: 'delivery-closeout:current',
          gate: 'Delivery Closeout Gate',
          decision: 'pass',
          closeoutAttemptId: 'current-attempt',
        },
      ],
    });

    const result = captureStdout(() =>
      mainMainAgentOrchestration(['--cwd', root, '--action', 'inspect'])
    );

    expect(result.code, result.stderr).toBe(0);
    const surface = JSON.parse(result.stdout);
    expect(surface.mainAgentNextAction).toBe('dispatch_implement');
    expect(surface.mainAgentReady).toBe(true);
    expect(surface.runtimeResumeProjection.blockingReasonRefs).toEqual([
      {
        sourceType: 'compiled_prompt_ref',
        id: 'missing_current_hash_compiledPromptRef',
      },
    ]);
  });

  it('dispatch-plan hydrates requirement-scoped state when explicit record args bypass a stale legacy state', () => {
    const { recordPath, indexPath } = writeRequirementRecord({
      requirementSetId: 'REQSET-EXPLICIT-001',
      architectureConfirmationState: {
        status: 'active',
        currentArchitectureConfirmationHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
    });
    writeFakeReqTraceSkill(root);
    fs.writeFileSync(
      indexPath,
      `${JSON.stringify(
        {
          version: 1,
          updatedAt: '2026-05-21T00:00:00.000Z',
          items: [
            {
              requirementId: 'REQ-OTHER-LEGACY',
              flow: 'story',
              status: 'planned',
              allowedWriteScope: ['scripts/**', 'tests/**', 'docs/**', '_bmad-output/**'],
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    const legacyStateDir = path.join(
      root,
      '_bmad-output',
      'runtime',
      'governance',
      'orchestration-state'
    );
    fs.mkdirSync(legacyStateDir, { recursive: true });
    fs.writeFileSync(
      path.join(legacyStateDir, 'story-old-session.json'),
      `${JSON.stringify(
        {
          version: 1,
          sessionId: 'story-old-session',
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'await_user',
          pendingPacket: {
            packetId: 'old-packet',
            packetPath: path.join(
              root,
              '_bmad-output',
              'runtime',
              'governance',
              'packets',
              'old.json'
            ),
            packetKind: 'execution',
            status: 'completed',
            createdAt: '2026-05-20T00:00:00.000Z',
            claimOwner: null,
          },
          originalExecutionPacketId: null,
          gatesLoop: {
            retryCount: 0,
            maxRetries: 3,
            noProgressCount: 0,
            circuitOpen: false,
            rerunGate: null,
            activePacketId: 'old-packet',
            lastResult: 'task-report:done',
          },
          closeout: {
            invoked: false,
            approved: false,
            scoreWriteResult: null,
            handoffPersisted: false,
            resultCode: null,
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const result = captureStdout(() =>
      mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'dispatch-plan',
        '--record-id',
        'REQ-ACTIVE-001',
        '--requirement-set-id',
        'REQSET-EXPLICIT-001',
      ])
    );

    expect(result.code, result.stderr).toBe(0);
    const instruction = JSON.parse(result.stdout);
    const expectedStatePath = path.join(
      path.dirname(recordPath),
      'orchestration',
      'orchestration-state',
      'REQSET-EXPLICIT-001.json'
    );
    expect(instruction.sessionId).toBe('REQSET-EXPLICIT-001');
    expect(instruction.packetPath.replace(/\\/g, '/')).toContain(
      '_bmad-output/runtime/requirement-records/REQSET-EXPLICIT-001/prompts/prompt-packets'
    );
    expect(fs.existsSync(expectedStatePath)).toBe(true);

    const inspectResult = captureStdout(() =>
      mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'inspect',
        '--record-id',
        'REQ-ACTIVE-001',
        '--requirement-set-id',
        'REQSET-EXPLICIT-001',
      ])
    );
    expect(inspectResult.code, inspectResult.stderr).toBe(0);
    const surface = JSON.parse(inspectResult.stdout);
    expect(surface.source).toBe('requirement_record');
    expect(surface.sessionId).toBe('REQSET-EXPLICIT-001');
    expect(surface.orchestrationStatePath).toBe(expectedStatePath);
    expect(surface.pendingPacketStatus).toBe('ready_for_main_agent');
    expect(surface.runtimeResumeProjection.observedLegacyState).toMatchObject({
      path: expectedStatePath,
      pendingPacketStatus: 'ready_for_main_agent',
    });
  });

  it('dispatch-plan replaces stale pending packet when lifecycle now requires implement', () => {
    const { recordPath } = writeRequirementRecord({
      requirementSetId: 'REQSET-STALE-PACKET-001',
      architectureConfirmationState: {
        status: 'active',
        currentArchitectureConfirmationHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
      rerunLoops: [
        {
          rerunLoopId: 'rerun-stale',
          status: 'resolved',
          sourceRefs: [{ sourceType: 'gate_check', id: 'delivery-closeout:old' }],
        },
      ],
      gateChecks: [
        {
          checkId: 'delivery-closeout:old',
          gate: 'Delivery Closeout Gate',
          decision: 'pass',
          closeoutAttemptId: 'current-attempt',
        },
      ],
    });
    writeFakeReqTraceSkill(root);
    const stateDir = path.join(path.dirname(recordPath), 'orchestration', 'orchestration-state');
    const packetDir = path.join(path.dirname(recordPath), 'prompts', 'prompt-packets');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.mkdirSync(packetDir, { recursive: true });
    const stalePacketPath = path.join(packetDir, 'remediate-stale.json');
    fs.writeFileSync(
      stalePacketPath,
      `${JSON.stringify(
        {
          packetId: 'remediate-stale',
          parentSessionId: 'REQSET-STALE-PACKET-001',
          flow: 'standalone_tasks',
          phase: 'implement',
          taskType: 'remediate',
          role: 'remediation-worker',
          inputArtifacts: [recordPath],
          allowedWriteScope: ['scripts/**'],
          expectedDelta: 'stale remediation',
          successCriteria: ['stale'],
          stopConditions: ['stale'],
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(stateDir, 'REQSET-STALE-PACKET-001.json'),
      `${JSON.stringify(
        {
          version: 1,
          sessionId: 'REQSET-STALE-PACKET-001',
          host: 'cursor',
          flow: 'standalone_tasks',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: 'remediate-stale',
            packetPath: stalePacketPath,
            packetKind: 'execution',
            status: 'ready_for_main_agent',
            createdAt: '2026-05-20T00:00:00.000Z',
            claimOwner: null,
          },
          originalExecutionPacketId: null,
          gatesLoop: {
            retryCount: 0,
            maxRetries: 3,
            noProgressCount: 0,
            circuitOpen: false,
            rerunGate: null,
            activePacketId: 'remediate-stale',
            lastResult: null,
          },
          closeout: {
            invoked: false,
            approved: false,
            scoreWriteResult: null,
            handoffPersisted: false,
            resultCode: null,
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const result = captureStdout(() =>
      mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'dispatch-plan',
        '--record-id',
        'REQ-ACTIVE-001',
        '--requirement-set-id',
        'REQSET-STALE-PACKET-001',
      ])
    );

    expect(result.code, result.stderr).toBe(0);
    const instruction = JSON.parse(result.stdout);
    const packet = JSON.parse(fs.readFileSync(instruction.packetPath, 'utf8'));
    expect(instruction.nextAction).toBe('dispatch_implement');
    expect(instruction.taskType).toBe('implement');
    expect(instruction.packetId).not.toBe('remediate-stale');
    expect(instruction.role).toBe('implementation-worker');
    expect(packet.taskType).toBe('implement');
  });
});
