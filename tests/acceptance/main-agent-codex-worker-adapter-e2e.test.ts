import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  runMainAgentAutomaticLoop,
} from '../../scripts/main-agent-orchestration';
import { main, runCodexWorkerAdapter } from '../../scripts/main-agent-codex-worker-adapter';
import {
  governanceEventTypeRegistryPolicyHash,
  governanceEventTypeRegistryHash,
} from '../../scripts/governance-transport-envelope';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function writeTestRequirementRecord(root: string): void {
  const requirementSetId = 'REQ-CODEX-WORKER';
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', requirementSetId);
  fs.mkdirSync(path.join(base, 'recovery'), { recursive: true });
  const record = {
    recordId: requirementSetId,
    requirementSetId,
    status: 'user_confirmed',
    flow: 'story',
    stage: 'implement',
    entryFlow: 'story',
    entryFlowClass: 'full_story_entry',
    workflowAdapter: 'bmad',
    sourceMode: 'full_bmad',
    sourcePath: 'docs/prd.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        decision: 'pass',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        confirmationPageHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'test',
      },
    ],
    runId: 'codex-worker-run',
    epicId: 'epic-01',
    storyId: 'S-codex-worker',
    runtimePolicySnapshotRef: {
      path: `_bmad-output/runtime/requirement-records/${requirementSetId}/recovery/runtime-policy-snapshot.json`,
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
    taskBindings: [
      {
        taskRef: 'TASK-CODEX-WORKER-SMOKE',
        status: 'planned',
        epicId: 'epic-01',
        storyId: 'S-codex-worker',
        sprintId: 'sprint-01',
        allowedWriteScope: [
          'src/**',
          'tests/**',
          `_bmad-output/runtime/requirement-records/${requirementSetId}/artifacts/**`,
        ],
        acceptanceRefs: ['EVD-CODEX-WORKER-SMOKE'],
      },
    ],
  };
  fs.writeFileSync(path.join(base, 'requirement-record.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(base, 'recovery', 'runtime-policy-snapshot.json'),
    `${JSON.stringify({ kind: 'runtime-policy-snapshot', flow: 'story', stage: 'implement', policy: { flow: 'story', stage: 'implement' } }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(base, 'recovery', 'recovery-context.json'), '{"kind":"recovery-context"}\n', 'utf8');
  const indexPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
  fs.writeFileSync(
    indexPath,
    `${JSON.stringify(
      {
        version: 1,
        active: {
          recordId: requirementSetId,
          requirementSetId,
          runId: 'codex-worker-run',
        },
        records: [
          {
            recordId: requirementSetId,
            requirementSetId,
            runId: 'codex-worker-run',
            recordPath: `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`,
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function writeTestCodexAgentSpec(
  root: string,
  agentsRoot: '.codex/agents' | '_bmad/codex/agents'
): void {
  fs.mkdirSync(path.join(root, agentsRoot), { recursive: true });
  fs.writeFileSync(
    path.join(root, agentsRoot, 'implementation-worker.toml'),
    [
      'name = "implementation-worker"',
      'description = "Test implementation worker"',
      'sandbox_mode = "workspace-write"',
      'developer_instructions = """Follow BMAD implementation worker test instructions."""',
      '',
    ].join('\n'),
    'utf8'
  );
}

const GOVERNANCE_EVENT_TYPE_REGISTRY = [
  {
    eventType: 'execution_iteration_recorded',
    payloadKind: 'status',
    writesControlFields: ['executionIterations'],
    allowedStatusValues: ['done', 'partial', 'blocked'],
    payloadContract: {
      requiredFields: ['eventType', 'status'],
      forbiddenFields: ['result', 'decision'],
      requiredSourceRefs: true,
      allowedControlWriteMode: 'control',
    },
  },
];
const GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY = {
  controlFieldVocabulary: ['executionIterations'],
  payloadKindContracts: [
    {
      payloadKind: 'status',
      requiredFields: ['eventType', 'status'],
      forbiddenFields: ['result', 'decision'],
      allowedControlWriteModes: ['control'],
    },
  ],
  controlWriteModePolicies: [
    {
      allowedControlWriteMode: 'control',
      allowedWritesControlFields: ['executionIterations'],
    },
  ],
  eventSpecificRequirements: [
    {
      eventType: 'execution_iteration_recorded',
      payloadKind: 'status',
      requiredSourceRefs: true,
      requiredFields: ['eventType', 'status'],
      forbiddenFields: ['result', 'decision'],
      allowedControlWriteMode: 'control',
    },
  ],
};
const REGISTRY_BINDING = {
  governanceEventTypeRegistryPolicy: GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY,
  governanceEventTypeRegistryPolicyHash: governanceEventTypeRegistryPolicyHash(GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY),
  governanceEventTypeRegistry: GOVERNANCE_EVENT_TYPE_REGISTRY,
  governanceEventTypeRegistryHash: governanceEventTypeRegistryHash(GOVERNANCE_EVENT_TYPE_REGISTRY),
  architectureConfirmationHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

type CodexWorkerAdapterInput = Parameters<typeof runCodexWorkerAdapter>[0];

function runBoundCodexWorkerAdapter(input: CodexWorkerAdapterInput) {
  return runCodexWorkerAdapter({
    ...REGISTRY_BINDING,
    ...input,
  });
}

function writeRegistryBindingFile(root: string): string {
  const registryPath = path.join(root, 'governance-event-type-registry.json');
  fs.writeFileSync(registryPath, `${JSON.stringify(GOVERNANCE_EVENT_TYPE_REGISTRY, null, 2)}\n`, 'utf8');
  return registryPath;
}

function writeRegistryPolicyBindingFile(root: string): string {
  const policyPath = path.join(root, 'governance-event-type-registry-policy.json');
  fs.writeFileSync(policyPath, `${JSON.stringify(GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY, null, 2)}\n`, 'utf8');
  return policyPath;
}

function prepareCodexRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-codex-worker-'));
  writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
  writeRuntimeContext(
    root,
    defaultRuntimeContextFile({
      flow: 'story',
      stage: 'implement',
      sourceMode: 'full_bmad',
      contextScope: 'story',
      storyId: 'S-codex-worker',
      runId: 'codex-worker-run',
    })
  );
  writeTestRequirementRecord(root);
  writeTestCodexAgentSpec(root, '.codex/agents');
  return root;
}

function codexSmokeArtifactPath(packetId: string): string {
  return `_bmad-output/runtime/requirement-records/REQ-CODEX-WORKER/artifacts/codex/${packetId}.md`;
}

describe('main-agent codex worker adapter e2e', () => {
  it('runs codex no-hooks smoke, writes scoped changes, emits TaskReport, and lets run-loop ingest it', () => {
    const root = prepareCodexRoot();
    const previousAllow = process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
    try {
      process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT = 'true';
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      expect(instruction).not.toBeNull();
      const taskReportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'codex',
        'task-reports',
        `${instruction!.packetId}.json`
      );

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        recordId: 'REQ-CODEX-WORKER',
        requirementSetId: 'REQ-CODEX-WORKER',
        runId: 'run-codex-worker',
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: true,
        smokeTargetPath: codexSmokeArtifactPath(instruction!.packetId),
      });

      expect(adapter.exitCode).toBe(0);
      expect(adapter.scopePassed).toBe(true);
      expect(adapter.runtimeGovernanceStatus).toBe('resolved');
      expect(adapter.agentRole).toBe('implementation-worker');
      expect(adapter.agentSpecPath).toContain('implementation-worker.toml');
      expect(adapter.taskReport.status).toBe('done');
      expect(adapter.transportEnvelopeValidation.ok).toBe(true);
      expect(adapter.transportEnvelope).toMatchObject({
        hostKind: 'codex',
        hostMode: 'no_hook',
        entry: 'main-agent-codex-worker-adapter',
        runId: 'run-codex-worker',
        recordId: 'REQ-CODEX-WORKER',
        requirementSetId: 'REQ-CODEX-WORKER',
        eventType: 'execution_iteration_recorded',
        payloadKind: 'status',
        status: 'done',
      });
      expect(JSON.stringify(adapter.transportEnvelope)).not.toContain('"result"');
      expect(adapter.subagentEvidenceEnvelopeValidation.ok).toBe(false);
      expect(adapter.subagentEvidenceEnvelopeValidation.mismatches).toContain(
        'subagent_envelope_traceRows_empty'
      );
      expect(adapter.subagentEvidenceEnvelopeValidation.mismatches).toContain(
        'subagent_envelope_coveredRequirementIds_empty'
      );
      expect(adapter.subagentEvidenceEnvelopeValidation.mismatches).toContain(
        'subagent_envelope_taskRefs_empty'
      );
      expect(fs.existsSync(path.join(root, codexSmokeArtifactPath(instruction!.packetId)))).toBe(true);
      expect(adapter.codexCommand).toEqual(['codex', 'worker-adapter-smoke']);

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        args: { taskReportPath },
      });

      expect(result.status).toBe('completed');
      expect(result.taskReport?.packetId).toBe(instruction!.packetId);
      expect(result.finalSurface.pendingPacketStatus).toBe('completed');
      expect(result.finalSurface.orchestrationState?.lastTaskReport?.evidence).toContain(
        `codex-smoke:${codexSmokeArtifactPath(instruction!.packetId)}`
      );
    } finally {
      if (previousAllow === undefined) {
        delete process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
      } else {
        process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT = previousAllow;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits accepted subagentEvidenceEnvelope when hash and trace bindings are provided', () => {
    const root = prepareCodexRoot();
    try {
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      expect(instruction).not.toBeNull();
      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        recordId: 'REQ-CODEX-WORKER',
        requirementSetId: 'REQ-CODEX-WORKER',
        runId: 'run-codex-worker',
        parentCloseoutAttemptId: 'closeout-codex-worker',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        architectureConfirmationHash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        traceRows: ['TRACE-035'],
        coveredRequirementIds: ['MUST-044', 'MUST-046', 'NEG-034', 'NEG-035', 'OUT-027'],
        taskRefs: ['TASK-SUBAGENT-EVIDENCE-ENVELOPE-GOVERNANCE'],
        packetPath: instruction!.packetPath,
        smoke: true,
        smokeTargetPath: codexSmokeArtifactPath(instruction!.packetId),
      });

      expect(adapter.exitCode).toBe(0);
      expect(adapter.subagentEvidenceEnvelopeValidation.ok).toBe(true);
      expect(adapter.subagentEvidenceEnvelope).toMatchObject({
        envelopeVersion: 'subagent-evidence-envelope/v1',
        recordId: 'REQ-CODEX-WORKER',
        requirementSetId: 'REQ-CODEX-WORKER',
        decisionAuthority: 'none',
        traceRows: ['TRACE-035'],
        coveredRequirementIds: ['MUST-044', 'MUST-046', 'NEG-034', 'NEG-035', 'OUT-027'],
        parentCloseoutAttemptId: 'closeout-codex-worker',
        status: 'accepted',
      });
      expect(JSON.stringify(adapter.subagentEvidenceEnvelope)).not.toContain('"decision"');
      expect(JSON.stringify(adapter.subagentEvidenceEnvelope)).not.toContain('"result"');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when runtime governance cannot resolve even in smoke mode', () => {
    const root = prepareCodexRoot();
    try {
      fs.rmSync(path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'), { force: true });
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'policy-blocked-task-report.json');

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: true,
      });

      expect(adapter.exitCode).toBe(1);
      expect(adapter.scopePassed).toBe(false);
      expect(adapter.runtimeGovernanceStatus).toBe('blocked');
      expect(adapter.runtimeGovernanceError).toBeTruthy();
      expect(adapter.taskReport.status).toBe('blocked');
      expect(adapter.taskReport.validationsRun).toContain(
        'codex-worker-adapter-runtime-governance'
      );
      expect(fs.existsSync(path.join(root, codexSmokeArtifactPath(instruction!.packetId)))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs non-smoke codex exec through a controlled Codex binary and ingests TaskReport', () => {
    const root = prepareCodexRoot();
    const previousAllow = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
    try {
      process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = 'true';
      const fakeCodexPath = path.join(root, 'fake-codex.cjs');
      fs.writeFileSync(
        fakeCodexPath,
        [
          "const fs = require('fs');",
          "const input = fs.readFileSync(0, 'utf8');",
          'const reportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();',
          'const packetId = input.match(/Packet ID: (.+)/i)?.[1]?.trim();',
          'if (!reportPath || !packetId) process.exit(2);',
          "fs.mkdirSync(require('path').dirname(reportPath), { recursive: true });",
          "fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['fake-codex-exec'], evidence: ['fake-codex-task-report'], downstreamContext: ['fake codex exec completed'] }, null, 2) + '\\n', 'utf8');",
          'process.exit(0);',
          '',
        ].join('\n'),
        'utf8'
      );
      const fakeCodexBin =
        process.platform === 'win32'
          ? path.join(root, 'fake-codex.cmd')
          : path.join(root, 'fake-codex');
      fs.writeFileSync(
        fakeCodexBin,
        process.platform === 'win32'
          ? `@echo off\r\n"${process.execPath}" "${fakeCodexPath}" %*\r\n`
          : `#!/usr/bin/env sh\n"${process.execPath}" "${fakeCodexPath}" "$@"\n`,
        'utf8'
      );
      if (process.platform !== 'win32') {
        fs.chmodSync(fakeCodexBin, 0o755);
      }
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'fake-codex-task-report.json');
      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: false,
        codexBinary: fakeCodexBin,
        timeoutMs: 30_000,
      });

      expect(adapter.mode).toBe('codex_exec');
      expect(adapter.codexCommand[0]).toBe(fakeCodexBin);
      expect(adapter.exitCode).toBe(0);
      expect(adapter.scopePassed).toBe(true);
      expect(adapter.taskReport.status).toBe('done');
      expect(adapter.taskReport.validationsRun).toContain('fake-codex-exec');
      expect(adapter.stdinPath).toBeTruthy();
      expect(fs.readFileSync(adapter.stdinPath!, 'utf8')).toContain('Runtime Governance JSON');
    } finally {
      if (previousAllow === undefined) {
        delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
      } else {
        process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = previousAllow;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when Codex binary override is not explicitly authorized', () => {
    const root = prepareCodexRoot();
    const previousAllow = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
    try {
      delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        hydratePacket: true,
      });
      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath: path.join(root, 'override-denied-task-report.json'),
        smoke: false,
        codexBinary: path.join(root, 'fake-codex'),
      });

      expect(adapter.exitCode).toBe(1);
      expect(adapter.scopePassed).toBe(false);
      expect(adapter.taskReport.status).toBe('blocked');
      expect(adapter.taskReport.driftFlags).toContain('codex-binary-override-denied');
    } finally {
      if (previousAllow === undefined) {
        delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
      } else {
        process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = previousAllow;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a dispatch role has no installed Codex agent spec', () => {
    const root = prepareCodexRoot();
    try {
      fs.rmSync(path.join(root, '.codex', 'agents'), { recursive: true, force: true });
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'missing-agent-task-report.json');

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: true,
      });

      expect(adapter.exitCode).toBe(1);
      expect(adapter.scopePassed).toBe(false);
      expect(adapter.agentSpecPath).toBeNull();
      expect(adapter.taskReport.status).toBe('blocked');
      expect(adapter.taskReport.evidence).toContain(
        'missing codex agent spec for role=implementation-worker'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves canonical Codex agent specs when runtime .codex agents are not installed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-codex-canonical-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-codex-worker',
          runId: 'codex-worker-run',
        })
      );
      writeTestRequirementRecord(root);
      writeTestCodexAgentSpec(root, '_bmad/codex/agents');
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'canonical-agent-task-report.json');

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: true,
      });

      expect(adapter.exitCode).toBe(0);
      expect(adapter.scopePassed).toBe(true);
      expect(adapter.agentSpecPath).toContain(
        path.join('_bmad', 'codex', 'agents', 'implementation-worker.toml')
      );
      expect(adapter.taskReport.status).toBe('done');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('injects Runtime Governance JSON into real codex exec prompts', () => {
    const root = prepareCodexRoot();
    try {
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        hydratePacket: true,
      });

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath: path.join(root, 'policy-injected-task-report.json'),
        smoke: false,
        timeoutMs: 1,
      });

      expect(adapter.mode).toBe('codex_exec');
      expect(adapter.stdinPath).toBeTruthy();
      const prompt = fs.readFileSync(adapter.stdinPath!, 'utf8');
      expect(prompt).toContain('--- Runtime Governance JSON ---');
      expect(prompt).toContain('"implementationEntryGate"');
      expect(prompt).toContain('"stage":"implement"');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts UTF-8 BOM dispatch packets written by Windows tooling', () => {
    const root = prepareCodexRoot();
    try {
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const raw = fs.readFileSync(instruction!.packetPath, 'utf8');
      fs.writeFileSync(instruction!.packetPath, `\uFEFF${raw}`, 'utf8');

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath: path.join(root, 'bom-packet-task-report.json'),
        smoke: true,
      });

      expect(adapter.exitCode).toBe(0);
      expect(adapter.agentSpecPath).toContain('implementation-worker.toml');
      expect(adapter.taskReport.status).toBe('done');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when Codex reports a file outside allowedWriteScope', () => {
    const root = prepareCodexRoot();
    try {
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'bad-task-report.json');
      fs.writeFileSync(
        taskReportPath,
        JSON.stringify(
          {
            packetId: instruction!.packetId,
            status: 'done',
            filesChanged: ['outside/scope.md'],
            validationsRun: ['bad-smoke'],
            evidence: ['bad'],
            downstreamContext: ['bad'],
          },
          null,
          2
        ) + '\n',
        'utf8'
      );

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: false,
        timeoutMs: 1,
      });

      expect(adapter.scopePassed).toBe(false);
      const rewritten = JSON.parse(fs.readFileSync(taskReportPath, 'utf8')) as { status: string };
      expect(rewritten.status).toBe('blocked');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when TaskReport is not strict UTF-8 no-BOM JSON', () => {
    const root = prepareCodexRoot();
    try {
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'utf16-task-report.json');
      const report = JSON.stringify(
        {
          packetId: instruction!.packetId,
          status: 'completed',
          filesChanged: ['src/codex/proof.md'],
          validationsRun: ['external-real-validation'],
          evidence: ['external-real-evidence'],
          downstreamContext: ['utf16 report should be normalized'],
        },
        null,
        2
      );
      fs.writeFileSync(
        taskReportPath,
        Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(report, 'utf16le')])
      );

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: false,
        timeoutMs: 1,
      });

      expect(adapter.taskReport.status).toBe('blocked');
      expect(adapter.scopePassed).toBe(false);
      const rewrittenRaw = fs.readFileSync(taskReportPath);
      expect([...rewrittenRaw.subarray(0, 2)]).not.toEqual([0xff, 0xfe]);
      const rewritten = JSON.parse(rewrittenRaw.toString('utf8')) as { status: string };
      expect(rewritten.status).toBe('blocked');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when Codex modifies an actual file outside allowedWriteScope without reporting it', () => {
    const root = prepareCodexRoot();
    const previousAllow = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
    try {
      process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = 'true';
      const fakeCodexPath = path.join(root, 'fake-codex-hidden-write.cjs');
      fs.writeFileSync(
        fakeCodexPath,
        [
          "const fs = require('fs');",
          "const path = require('path');",
          "const input = fs.readFileSync(0, 'utf8');",
          'const reportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();',
          'const packetId = input.match(/Packet ID: (.+)/i)?.[1]?.trim();',
          'if (!reportPath || !packetId) process.exit(2);',
          'fs.mkdirSync(path.dirname(reportPath), { recursive: true });',
          "fs.mkdirSync('outside', { recursive: true });",
          "fs.writeFileSync('outside/hidden.md', 'hidden out-of-scope write\\n', 'utf8');",
          "fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['fake-codex-hidden-write'], evidence: ['reported clean'], downstreamContext: [] }, null, 2) + '\\n', 'utf8');",
          'process.exit(0);',
          '',
        ].join('\n'),
        'utf8'
      );
      const fakeCodexBin =
        process.platform === 'win32'
          ? path.join(root, 'fake-codex-hidden-write.cmd')
          : path.join(root, 'fake-codex-hidden-write');
      fs.writeFileSync(
        fakeCodexBin,
        process.platform === 'win32'
          ? `@echo off\r\n"${process.execPath}" "${fakeCodexPath}" %*\r\n`
          : `#!/usr/bin/env sh\n"${process.execPath}" "${fakeCodexPath}" "$@"\n`,
        'utf8'
      );
      if (process.platform !== 'win32') {
        fs.chmodSync(fakeCodexBin, 0o755);
      }

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'hidden-write-task-report.json');

      const adapter = runBoundCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: false,
        codexBinary: fakeCodexBin,
      });

      expect(adapter.exitCode).toBe(0);
      expect(adapter.scopePassed).toBe(false);
      expect(adapter.actualFilesChanged).toContain('outside/hidden.md');
      expect(adapter.taskReport.status).toBe('blocked');
      expect(adapter.taskReport.evidence.join('\n')).toContain(
        'actual file outside allowedWriteScope: outside/hidden.md'
      );
    } finally {
      if (previousAllow === undefined) {
        delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
      } else {
        process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = previousAllow;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts --smoke as a boolean CLI flag while still reading --packetPath correctly', () => {
    const root = prepareCodexRoot();
    try {
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const reportPath = path.join(root, 'adapter-report.json');
      const taskReportPath = path.join(root, 'task-report.json');
      const registryPath = writeRegistryBindingFile(root);
      const policyPath = writeRegistryPolicyBindingFile(root);
      const exitCode = main([
        '--cwd',
        root,
        '--packetPath',
        instruction!.packetPath,
        '--smoke',
        '--taskReportPath',
        taskReportPath,
        '--reportPath',
        reportPath,
        '--governanceEventTypeRegistryPolicyPath',
        policyPath,
        '--governanceEventTypeRegistryPolicyHash',
        REGISTRY_BINDING.governanceEventTypeRegistryPolicyHash,
        '--governanceEventTypeRegistryPath',
        registryPath,
        '--governanceEventTypeRegistryHash',
        REGISTRY_BINDING.governanceEventTypeRegistryHash,
        '--architectureConfirmationHash',
        REGISTRY_BINDING.architectureConfirmationHash,
      ]);

      expect(exitCode).toBe(0);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        packetPath: string;
        mode: string;
      };
      expect(report.packetPath).toBe(instruction!.packetPath);
      expect(report.mode).toBe('smoke');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
