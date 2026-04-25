import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, resolveBmadHelpRuntimePolicy } from '../../scripts/bmad-config';
import {
  createGovernancePacketExecutionRecord,
  updateGovernancePacketExecutionRecord,
} from '../../scripts/governance-packet-execution-store';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { runAuditorHost } from '../../scripts/run-auditor-host';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

function buildStoryCloseout(root: string, artifactPath: string) {
  return {
    updatedAt: new Date().toISOString(),
    runner: 'runAuditorHost' as const,
    profile: 'story_audit',
    stage: 'story',
    artifactPath,
    reportPath: path.join(root, '_bmad-output', 'implementation-artifacts', 'AUDIT_story.md'),
    auditStatus: 'PASS' as const,
    closeoutApproved: true,
    governanceClosure: {
      implementationReadinessStatusRequired: true,
      implementationReadinessGateName: 'implementation-readiness',
      gatesLoopRequired: true,
      rerunGatesRequired: true,
      packetExecutionClosureRequired: true,
    },
    closeoutEnvelope: {
      resultCode: 'approved',
      requiredFixes: [],
      requiredFixesDetail: [],
      rerunDecision: 'none',
      scoringFailureMode: 'not_run',
      packetExecutionClosureStatus: 'gate_passed',
    },
  };
}

function writeMinimalReadinessReport(
  reportPath: string,
  status: 'READY' | 'NEEDS WORK' | 'NOT READY'
): void {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(
    reportPath,
    [
      '# Implementation Readiness Report',
      '',
      '## Summary and Recommendations',
      '',
      '### Overall Readiness Status',
      '',
      status,
      '',
      '### Readiness Metrics',
      '',
      `- Blocker count: ${status === 'READY' ? 0 : 2}`,
      '',
      '## Blockers Requiring Immediate Action',
      '',
      status === 'READY'
        ? '- none'
        : '- IR-BLK-001: Missing smoke E2E proof for the critical journey',
      '',
      '## Deferred Gaps',
      '',
      '- J04-Smoke-E2E: P0 Journey J04 缺少 Smoke E2E',
      '  - Reason: P2 优先级',
      '  - Resolution Target: Sprint 2+',
      '  - Owner: Dev Team',
      '',
      '## Deferred Gaps Tracking',
      '',
      '| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |',
      '|--------|------|------|----------|-------|-----------|',
      '| J04-Smoke-E2E | P0 Journey J04 缺少 Smoke E2E | P2 优先级 | Sprint 2+ | Dev Team | Sprint Planning |',
      '',
    ].join('\n'),
    'utf8'
  );
}

function captureStdout(run: () => number): { code: number; output: string } {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  (process.stdout as { write: typeof process.stdout.write }).write = (
    chunk: string | Uint8Array
  ) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  };

  try {
    const code = run();
    return { code, output: chunks.join('') };
  } finally {
    (process.stdout as { write: typeof process.stdout.write }).write = originalWrite;
  }
}

describe('bmad-help runtime policy consumers', () => {
  it('prefers the current story-scoped readiness report and execution record over newer unrelated artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-scope-isolation-'));
    try {
      const currentReportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'epic-14',
        'story-14.1',
        'implementation-readiness-report-2026-04-10.md'
      );
      const unrelatedReportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'epic-99',
        'story-99.9',
        'implementation-readiness-report-2026-04-11.md'
      );
      writeMinimalReadinessReport(currentReportPath, 'NEEDS WORK');
      writeMinimalReadinessReport(unrelatedReportPath, 'READY');

      const unrelatedRemediationPath = unrelatedReportPath.replace(
        'implementation-readiness-report-',
        'implementation-readiness-remediation-'
      );
      writeFileSync(unrelatedRemediationPath, '# Remediation Attempt\n', 'utf8');
      createGovernancePacketExecutionRecord({
        projectRoot: root,
        loopStateId: 'loop-unrelated',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: unrelatedRemediationPath,
        packetPaths: {},
        authoritativeHost: 'cursor',
      });
      updateGovernancePacketExecutionRecord(root, 'loop-unrelated', 1, (record) => ({
        ...record,
        status: 'gate_passed',
        lastRerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'unrelated blockers resolved',
          observedAt: new Date().toISOString(),
        },
      }));

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'story',
        stage: 'implement',
        runtimeContext: {
          version: 1,
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          epicId: 'epic-14',
          storyId: '14.1',
          runId: 'run-14-1',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.1',
          updatedAt: new Date().toISOString(),
        },
      });

      expect(policy.implementationReadinessStatus).toBe('blocked');
      expect(policy.implementationEntryRecommended).toBe(false);
      expect(policy.helpRouting.evidenceSources.readinessReportPath).toBe(currentReportPath);
      expect(policy.helpRouting.executionRecordId).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('normalizes bugfix document-audit facts instead of defaulting to blocked when authoritative audit passed', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-bugfix-audit-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'bugfix',
          stage: 'implement',
          sourceMode: 'seeded_solutioning',
          contextScope: 'project',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_login_loop.md',
          updatedAt: new Date().toISOString(),
        })
      );
      const reportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'bugfix-login-loop',
        'implementation-readiness-report-2026-04-11.md'
      );
      writeMinimalReadinessReport(reportPath, 'READY');
      const bugfixPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_login_loop.md'
      );
      mkdirSync(path.dirname(bugfixPath), { recursive: true });
      writeFileSync(
        bugfixPath,
        '# BUGFIX\n\n## Audit\n\nauditor-bugfix: PASS\nRandom PASS text should not be the canonical source.\n',
        'utf8'
      );
      const bugfixAuditReportPath = bugfixPath.replace(/\.md$/i, '.audit.md');
      writeFileSync(
        bugfixAuditReportPath,
        [
          'status: PASS',
          'stage: bugfix',
          `reportPath: ${bugfixAuditReportPath.replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${bugfixPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );
      await runAuditorHost({
        projectRoot: root,
        reportPath: bugfixAuditReportPath,
        stage: 'bugfix',
        artifactPath: bugfixPath,
      }, {
        scoreCommand: async () => ({ parsedRecord: { effective_verdict: 'approved' } }),
      });

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'bugfix',
        stage: 'implement',
        runtimeContext: {
          version: 1,
          flow: 'bugfix',
          stage: 'implement',
          sourceMode: 'seeded_solutioning',
          contextScope: 'project',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_login_loop.md',
          updatedAt: new Date().toISOString(),
        },
      });

      expect(policy.implementationReadinessStatus).toBe('ready_clean');
      expect(policy.implementationEntryRecommended).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('projects canMainAgentContinue from runtime context / active scope reading side', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-continue-state-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.1',
          runId: 'run-14-1',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14-1',
          latestReviewerCloseout: {
            updatedAt: new Date().toISOString(),
            runner: 'runAuditorHost',
            profile: 'story_audit',
            stage: 'story',
            artifactPath: 'story.md',
            reportPath: 'story.audit.md',
            auditStatus: 'PASS',
            closeoutApproved: false,
            governanceClosure: {
              implementationReadinessStatusRequired: true,
              implementationReadinessGateName: 'implementation-readiness',
              gatesLoopRequired: true,
              rerunGatesRequired: true,
              packetExecutionClosureRequired: true,
            },
            closeoutEnvelope: {
              resultCode: 'blocked',
              requiredFixes: ['closeout blocked'],
              requiredFixesDetail: [],
              rerunDecision: 'rerun_required',
              scoringFailureMode: 'not_run',
              packetExecutionClosureStatus: 'retry_pending',
            },
            canMainAgentContinue: false,
            scoreWriteResult: 'failed',
            handoffPersisted: true,
          },
          updatedAt: new Date().toISOString(),
        })
      );

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'story',
        stage: 'implement',
      });

      expect(policy.mainAgentCanContinue).toBe(false);
      expect(policy.continueStateSource).toBe('runtimeContext');
      expect(policy.continueDecision).toBe('rerun');
      expect(policy.mainAgentNextAction).toBe('dispatch_remediation');
      expect(policy.mainAgentReady).toBe(true);
      expect(policy.helpRouting.mainAgentCanContinue).toBe(false);
      expect(policy.helpRouting.continueStateSource).toBe('runtimeContext');
      expect(policy.helpRouting.continueDecision).toBe('rerun');
      expect(policy.helpRouting.mainAgentNextAction).toBe('dispatch_remediation');
      expect(policy.helpRouting.mainAgentReady).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('upgrades standalone_tasks + high complexity into real consumer routing state', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-standalone-upgrade-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'standalone_tasks',
          stage: 'implement',
          sourceMode: 'standalone_story',
          contextScope: 'project',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/TASKS_checkout_hardening.md',
          updatedAt: new Date().toISOString(),
        })
      );
      const tasksPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'TASKS_checkout_hardening.md'
      );
      mkdirSync(path.dirname(tasksPath), { recursive: true });
      writeFileSync(
        tasksPath,
        '# TASKS\n\nauditor-tasks-doc: PASS\nThis document may contain PASS tokens, but the audit report is canonical.\n',
        'utf8'
      );
      const tasksAuditReportPath = tasksPath.replace(/\.md$/i, '.audit.md');
      writeFileSync(
        tasksAuditReportPath,
        [
          'status: PASS',
          'stage: standalone_tasks',
          `reportPath: ${tasksAuditReportPath.replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${tasksPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );
      await runAuditorHost({
        projectRoot: root,
        reportPath: tasksAuditReportPath,
        stage: 'document',
        artifactPath: tasksPath,
        iterationCount: '1',
      }, {
        scoreCommand: async () => ({ parsedRecord: { effective_verdict: 'approved' } }),
      });

      const reportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'implementation-readiness-report-2026-04-11.md'
      );
      writeMinimalReadinessReport(reportPath, 'READY');

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'standalone_tasks',
        stage: 'implement',
        runtimeContext: {
          version: 1,
          flow: 'standalone_tasks',
          stage: 'implement',
          sourceMode: 'standalone_story',
          contextScope: 'project',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/TASKS_checkout_hardening.md',
          updatedAt: new Date().toISOString(),
        },
        complexityFactors: {
          impactSurface: 2,
          sharedContract: 2,
          verificationCost: 2,
          uncertainty: 1,
          rollbackDifficulty: 1,
        },
      });

      expect(policy.complexity).toBe('high');
      expect(policy.helpRouting.shouldUpgradeStandaloneTasks).toBe(true);
      expect(policy.helpRouting.recommendedFlow).toBe('story');
      expect(policy.helpRouting.recommendationLabel).toBe('blocked');
      expect(policy.helpRouting.rerouteRequired).toBe(true);
      expect(policy.helpRouting.implementationEntryDecision).toBe('reroute');
      expect(policy.implementationEntryDecision).toBe('reroute');
      expect(policy.mainAgentNextAction).toBe('await_user');
      expect(policy.mainAgentReady).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat stray PASS text in BUGFIX/TASKS docs as canonical audit truth without a structured audit report', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-audit-source-negative-'));
    try {
      const bugfixPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_false_positive.md'
      );
      mkdirSync(path.dirname(bugfixPath), { recursive: true });
      writeFileSync(
        bugfixPath,
        '# BUGFIX\n\nThis text says PASS, but there is no structured audit report.\n',
        'utf8'
      );

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'bugfix',
        stage: 'implement',
        runtimeContext: {
          version: 1,
          flow: 'bugfix',
          stage: 'implement',
          sourceMode: 'seeded_solutioning',
          contextScope: 'project',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_false_positive.md',
          updatedAt: new Date().toISOString(),
        },
      });

      expect(policy.implementationReadinessStatus).toBe('blocked');
      expect(policy.implementationEntryRecommended).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat a structured orphan audit report as authoritative when runAuditorHost closeout never completed', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-missing-closeout-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      const bugfixPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_closeout_missing.md'
      );
      mkdirSync(path.dirname(bugfixPath), { recursive: true });
      writeFileSync(bugfixPath, '# BUGFIX\n', 'utf8');

      const bugfixAuditReportPath = bugfixPath.replace(/\.md$/i, '.audit.md');
      writeFileSync(
        bugfixAuditReportPath,
        [
          'status: PASS',
          'stage: bugfix',
          `reportPath: ${bugfixAuditReportPath.replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${bugfixPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      const reportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'implementation-readiness-report-2026-04-11.md'
      );
      writeMinimalReadinessReport(reportPath, 'READY');

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'bugfix',
        stage: 'implement',
        runtimeContext: {
          version: 1,
          flow: 'bugfix',
          stage: 'implement',
          sourceMode: 'seeded_solutioning',
          contextScope: 'project',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_closeout_missing.md',
          updatedAt: new Date().toISOString(),
        },
      });

      expect(policy.implementationReadinessStatus).toBe('blocked');
      expect(policy.implementationEntryRecommended).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps orphan routing blocked when authoritative registration stage mismatches the flow', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-stage-mismatch-'));
    try {
      const registry = defaultRuntimeContextRegistry(root);
      const bugfixPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_stage_mismatch.md'
      );
      const bugfixAuditReportPath = bugfixPath.replace(/\.md$/i, '.audit.md');
      registry.auditIndex.bugfix[path.normalize(bugfixPath)] = {
        artifactDocPath: bugfixPath,
        reportPath: bugfixAuditReportPath,
        status: 'PASS',
        stage: 'standalone_tasks',
        closeoutApproved: true,
        updatedAt: new Date().toISOString(),
      };
      writeRuntimeContextRegistry(root, registry);

      const reportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'implementation-readiness-report-2026-04-11.md'
      );
      writeMinimalReadinessReport(reportPath, 'READY');

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'bugfix',
        stage: 'implement',
        runtimeContext: {
          version: 1,
          flow: 'bugfix',
          stage: 'implement',
          sourceMode: 'seeded_solutioning',
          contextScope: 'project',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_stage_mismatch.md',
          updatedAt: new Date().toISOString(),
        },
      });

      expect(policy.implementationReadinessStatus).toBe('blocked');
      expect(policy.implementationEntryRecommended).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exposes state-aware help routing through the bmad-config facade', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-runtime-policy-'));
    try {
      writeMinimalRegistryAndProjectContext(root, {
        flow: 'story',
        stage: 'implement',
        epicId: 'epic-14',
        storyId: '14.1',
        latestReviewerCloseout: buildStoryCloseout(
          root,
          '_bmad-output/implementation-artifacts/epic-14/14.1/story.md'
        ),
      });
      const reportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'implementation-readiness-report-2026-04-11.md'
      );
      writeMinimalReadinessReport(reportPath, 'READY');

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        config: loadConfig(),
        flow: 'story',
        stage: 'implement',
        runtimeContext: {
          version: 1,
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          epicId: 'epic-14',
          storyId: '14.1',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/14.1',
          updatedAt: new Date().toISOString(),
        },
      });

      expect(policy.contextMaturity).toBe('full');
      expect(policy.complexity).toBe(policy.helpRouting.complexity);
      expect(policy.implementationReadinessStatus).toBe('ready_clean');
      expect(policy.implementationEntryRecommended).toBe(true);
      expect(policy.implementationEntryDecision).toBe('pass');
      expect(policy.helpRouting.canonicalImplementationGate).toBe('implementation-readiness');
      expect(policy.helpRouting.sourceMode).toBe('full_bmad');
      expect(policy.helpRouting.evidenceSources.readinessReportPath).toBe(reportPath);
      expect(policy.helpRouting.evidenceSources.authoritativeAuditReportPath).toContain('AUDIT_story.md');
      expect(policy.helpRouting.evidence.implementationReadiness.readinessReportPresent).toBe(true);
      expect(policy.helpRouting.recommendedFlow).toBe('story');
      expect(policy.helpRouting.recommendationLabel).toBe('recommended');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits repair_closed help routing fields from readiness artifacts and execution closure', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-help-runtime-emit-'));
    try {
      const configSource = path.join(process.cwd(), '_bmad', '_config');
      const configTarget = path.join(root, '_bmad', '_config');
      mkdirSync(path.dirname(configTarget), { recursive: true });
      cpSync(configSource, configTarget, { recursive: true });

      writeMinimalRegistryAndProjectContext(root, {
        flow: 'story',
        stage: 'implement',
        epicId: 'epic-14',
        storyId: '14.1',
        latestReviewerCloseout: buildStoryCloseout(
          root,
          '_bmad-output/implementation-artifacts/epic-14/14.1/story.md'
        ),
      });

      const reportPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'implementation-readiness-report-2026-04-11.md'
      );
      const remediationPath = reportPath.replace(
        'implementation-readiness-report-',
        'implementation-readiness-remediation-'
      );
      writeMinimalReadinessReport(reportPath, 'NOT READY');
      writeFileSync(remediationPath, '# Remediation Attempt\n', 'utf8');

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        loopStateId: 'loop-14-1',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: remediationPath,
        packetPaths: {},
        authoritativeHost: 'cursor',
      });
      updateGovernancePacketExecutionRecord(root, 'loop-14-1', 1, (record) => ({
        ...record,
        status: 'gate_passed',
        lastRerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'all blockers resolved',
          observedAt: new Date().toISOString(),
        },
        history: [
          ...record.history,
          {
            at: new Date().toISOString(),
            kind: 'rerun-gate-result',
            note: 'all blockers resolved',
          },
        ],
      }));

      const { code, output } = captureStdout(() => mainEmitRuntimePolicy(['--cwd', root]));
      expect(code).toBe(0);

      const policy = JSON.parse(output) as {
        implementationReadinessStatus: string;
        implementationEntryRecommended: boolean;
        implementationEntryDecision: string;
        helpRouting: {
          implementationReadinessStatus: string;
          executionRecordId: string | null;
          canonicalImplementationGate: string;
        };
      };

      expect(policy.implementationReadinessStatus).toBe('repair_closed');
      expect(policy.implementationEntryRecommended).toBe(true);
      expect(policy.implementationEntryDecision).toBe('pass');
      expect(policy.helpRouting.implementationReadinessStatus).toBe('repair_closed');
      expect(policy.helpRouting.executionRecordId).toBe('gov-exec-loop-14-1-0001');
      expect(policy.helpRouting.canonicalImplementationGate).toBe('implementation-readiness');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
