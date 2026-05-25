import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mainMainAgentOrchestration,
  resolveMainAgentOrchestrationSurface,
  runMainAgentPreConfirmationDrilldown,
} from '../../scripts/main-agent-orchestration';

function writeDraftSource(root: string, name = 'source.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Draft Requirement',
      '',
      'The main agent must prepare a confirmation page only after atomic drilldown converges.',
      'The lane must not claim delivery readiness before controlled confirmation ingest.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function unwrapArtifact(value: any): any {
  return value.semanticKernel ?? value.must_decomposition_packet ?? value.criticalAuditorReceipt ?? value;
}

function expectArtifactContract(file: string, recordId: string): void {
  const artifact = unwrapArtifact(readJson(file));
  expect(artifact.schemaVersion, `${file} schemaVersion`).toBeTruthy();
  expect(artifact.recordId, `${file} recordId`).toBe(recordId);
  expect(artifact.sourceDocumentHash, `${file} sourceDocumentHash`).toMatch(/^sha256:/);
  expect(artifact.implementationConfirmationHash, `${file} implementationConfirmationHash`).toMatch(/^sha256:/);
  expect(
    artifact.contentHash ?? artifact.receiptHash ?? artifact.kernelHash ?? artifact.packetHash,
    `${file} content or receipt hash`
  ).toMatch(/^sha256:/);
  expect(artifact.createdBy, `${file} createdBy`).toBeTruthy();
  expect(artifact.createdAt, `${file} createdAt`).toBeTruthy();
  expect(Array.isArray(artifact.inputRefs), `${file} inputRefs`).toBe(true);
  expect(artifact.inputRefs.length, `${file} inputRefs length`).toBeGreaterThan(0);
}

function artifacts(root: string, recordId: string) {
  const authoring = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
  const confirmation = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'confirmation');
  return {
    authoring,
    confirmation,
    semanticKernel: path.join(authoring, 'semantic-kernel.json'),
    packet: path.join(authoring, 'must_decomposition_packet.json'),
    receipt1: path.join(authoring, 'critical-auditor-receipt-round-1.json'),
    receipt2: path.join(authoring, 'critical-auditor-receipt-round-2.json'),
    receipt3: path.join(authoring, 'critical-auditor-receipt-round-3.json'),
    reconciliation: path.join(authoring, 'must_packet_source_reconciliation_report.json'),
    progress: path.join(authoring, 'semantic-checkpoint-progress.json'),
    mustGate: path.join(authoring, 'pre-render-must-decomposition-gate-report.json'),
    globalGate: path.join(authoring, 'pre-render-global-consistency-report.json'),
    html: path.join(confirmation, 'confirmation.html'),
    summary: path.join(confirmation, 'confirmation-summary.json'),
    renderReport: path.join(confirmation, 'confirmation-render-report.json'),
  };
}

describe('main-agent requirement_confirmation.pre_confirmation_drilldown lane', () => {
  it('drives a draft source to user_confirmable without leaving requirement_confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-'));
    try {
      const source = writeDraftSource(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-E2E',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-E2E',
        confirmationLanguage: 'zh-CN',
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-E2E');
      expect(result.currentMentalModel).toBe('requirement_confirmation');
      expect(result.lane).toBe('pre_confirmation_drilldown');
      expect(result.substate).toBe('user_confirmable');
      expect(result.nextMentalModel).toBeNull();
      expect(result.deliveryReadiness.ready).toBe(false);
      expect(result.finalStandards).toMatchObject({
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: true,
        singlePassCannotSkipAtomicDecompositionLoop: true,
        threeConsecutiveNoNewValidGapRoundsRequired: true,
        mustDecompositionPacketSynchronizedBeforeMaterialization: true,
        sourceRowsMaterializedOnlyFromPacketProjections: true,
        packetSourceReconciliationPassesBidirectionally: true,
        preRenderGateBlocksMissingCoreSurfaces: true,
        rendererShowsFullDrilldownInteraction: true,
        confirmabilityBlocksOnMissingDrilldownSurfaces: true,
        controlledIngestRequiredBeforeMentalModelProgression: true,
      });

      for (const file of [
        paths.semanticKernel,
        paths.packet,
        paths.receipt1,
        paths.receipt2,
        paths.receipt3,
        paths.reconciliation,
        paths.progress,
        paths.mustGate,
        paths.globalGate,
        paths.html,
        paths.summary,
        paths.renderReport,
      ]) {
        expect(existsSync(file), file).toBe(true);
      }

      for (const file of [
        paths.semanticKernel,
        paths.packet,
        paths.receipt1,
        paths.receipt2,
        paths.receipt3,
        paths.reconciliation,
        paths.progress,
        paths.mustGate,
        paths.globalGate,
        paths.summary,
        paths.renderReport,
      ]) {
        expectArtifactContract(file, 'REQ-PRE-CONFIRMATION-E2E');
      }

      const packet = readJson(paths.packet).must_decomposition_packet;
      const mustGate = readJson(paths.mustGate);
      const globalGate = readJson(paths.globalGate);
      const reconciliation = readJson(paths.reconciliation);
      const renderReport = readJson(paths.renderReport);
      const html = readFileSync(paths.html, 'utf8');

      expect(packet.status).toBe('synchronized');
      expect(packet.lifecycle.atomicDecompositionLoopEnteredBeforeMaterialization).toBe(true);
      expect(packet.lifecycle.singlePassBypassPrevented).toBe(true);
      expect(packet.lifecycle.materializedAfterStatus).toBe('synchronized');
      expect(packet.consecutiveNoNewValidGapRounds).toBe(3);
      expect(packet.mustPackets[0].mustAtomicTasks.length).toBeGreaterThanOrEqual(2);
      expect(mustGate.verdict).toBe('PASS');
      expect(mustGate.confirmability).toBe('confirmable');
      expect(mustGate.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);
      expect(globalGate.verdict).toBe('PASS');
      expect(reconciliation.verdict).toBe('pass');
      expect(renderReport.confirmability).toBe('confirmable');
      expect(renderReport.deliveryReadiness.ready).toBe(false);
      expect(renderReport.renderedSections).toContain('pre-confirmation-semantic-drilldown');
      expect(html).toContain('Pre-Confirmation Semantic Drilldown');
      expect(html).toContain('Semantic Kernel Summary');
      expect(html).toContain('MUST Decomposition Packet');
      expect(html).toContain('Critical Auditor Convergence');

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId: 'REQ-PRE-CONFIRMATION-E2E',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-E2E',
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(surface.preConfirmationDrilldownLane).toMatchObject({
        currentMentalModel: 'requirement_confirmation',
        lane: 'pre_confirmation_drilldown',
        substate: 'user_confirmable',
        controlledIngestRequiredBeforeProgression: true,
      });
      expect(surface.preConfirmationDrilldownLane?.nextMentalModel).toBeNull();
      expect(surface.mainAgentNextAction).toBe('await_user');
      expect(surface.mainAgentReady).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects single_pass because it would skip the atomic decomposition loop', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-single-pass-'));
    try {
      const source = writeDraftSource(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-SINGLE-PASS',
        mode: 'single_pass',
      });

      expect(result.substate).toBe('blocked_by_under_split_task');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain('single_pass_cannot_skip_atomic_decomposition_loop');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a controlled confirmation_recorded event before mental model progression', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-controlled-ingest-'));
    try {
      const source = writeDraftSource(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST',
        confirmationLanguage: 'zh-CN',
      });
      expect(result.substate).toBe('user_confirmable');

      const recordPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        'requirement-record.json'
      );
      const record = readJson(recordPath);
      writeFileSync(recordPath, `${JSON.stringify({ ...record, status: 'user_confirmed' }, null, 2)}\n`, 'utf8');

      const forgedSurface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId: 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST',
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(forgedSurface.preConfirmationDrilldownLane?.currentSubstate).toBe('user_confirmable');
      expect(forgedSurface.preConfirmationDrilldownLane?.nextMentalModel).toBeNull();
      expect(forgedSurface.preConfirmationDrilldownLane?.controlledIngestRequiredBeforeProgression).toBe(true);

      writeFileSync(
        recordPath,
        `${JSON.stringify(
          {
            ...record,
            status: 'user_confirmed',
            confirmationHistory: [
              {
                eventType: 'confirmation_recorded',
                sourceDocumentHash: record.sourceDocumentHash,
                implementationConfirmationHash: record.implementationConfirmationHash,
              },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      const controlledSurface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId: 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST',
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(controlledSurface.preConfirmationDrilldownLane?.currentSubstate).toBe('user_confirmed');
      expect(controlledSurface.preConfirmationDrilldownLane?.nextMentalModel).toBe('architecture_confirmation');
      expect(controlledSurface.preConfirmationDrilldownLane?.controlledIngestRequiredBeforeProgression).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when drilldown surfaces are missing and exposes the CLI action through main-agent orchestration', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-cli-'));
    try {
      const source = writeDraftSource(root);
      const missing = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-MISSING-SURFACES',
        skipDrilldownArtifacts: true,
      });
      expect(missing.substate).toBe('blocked_by_render_gate');
      expect(missing.confirmability).toBe('blocked');
      expect(missing.blockingIssues.map((issue) => issue.code)).toContain('missing_semantic_kernel');

      const exitCode = mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'pre-confirmation-drilldown',
        '--source',
        source,
        '--record-id',
        'REQ-PRE-CONFIRMATION-CLI',
        '--requirement-set-id',
        'REQSET-PRE-CONFIRMATION-CLI',
        '--confirmation-language',
        'zh-CN',
      ]);
      expect(exitCode).toBe(0);
      expect(readJson(artifacts(root, 'REQ-PRE-CONFIRMATION-CLI').renderReport).confirmability).toBe('confirmable');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
