import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { runAuditorHost } from '../../scripts/run-auditor-host';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';

describe('auditor host runner', () => {
  it.each([
    {
      stage: 'story',
      expectedScoreStage: 'story',
      expectedTriggerStage: 'bmad_story_stage2',
      expectedEvent: 'story_status_change',
    },
    {
      stage: 'spec',
      expectedScoreStage: 'spec',
      expectedTriggerStage: 'speckit_1_2',
      expectedEvent: 'stage_audit_complete',
    },
    {
      stage: 'plan',
      expectedScoreStage: 'plan',
      expectedTriggerStage: 'speckit_2_2',
      expectedEvent: 'stage_audit_complete',
    },
    {
      stage: 'gaps',
      expectedScoreStage: 'gaps',
      expectedTriggerStage: 'speckit_3_2',
      expectedEvent: 'stage_audit_complete',
    },
    {
      stage: 'tasks',
      expectedScoreStage: 'tasks',
      expectedTriggerStage: 'speckit_4_2',
      expectedEvent: 'stage_audit_complete',
    },
    {
      stage: 'implement',
      expectedScoreStage: 'implement',
      expectedTriggerStage: 'speckit_5_2',
      expectedEvent: 'stage_audit_complete',
    },
  ] as const)(
    'maps stage=$stage to the correct score + trigger stage when the report is already persisted',
    async ({ stage, expectedScoreStage, expectedTriggerStage, expectedEvent }) => {
      const root = mkdtempSync(path.join(os.tmpdir(), `auditor-host-${stage}-`));
      try {
        writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));

        const artifactDocPath = path.join(root, 'specs', 'demo', `${stage}.md`);
        const reportPath = path.join(root, 'specs', 'demo', `${stage}.audit.md`);
        mkdirSync(path.dirname(reportPath), { recursive: true });
        writeFileSync(
          reportPath,
          [
            'status: PASS',
            `reportPath: ${reportPath.replace(/\\/g, '/')}`,
            'iteration_count: 0',
            'required_fixes_count: 0',
            'score_trigger_present: true',
            `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
            'converged: true',
          ].join('\n'),
          'utf8'
        );

        const scoreCommand = vi.fn().mockResolvedValue(undefined);
        const executeAuditorScript = vi.fn();

        const result = await runAuditorHost(
          {
            projectRoot: root,
            reportPath,
            stage,
            artifactPath: artifactDocPath,
            iterationCount: '0',
          },
          { scoreCommand, executeAuditorScript }
        );

        expect(result.status).toBe('PASS');
        expect(executeAuditorScript).not.toHaveBeenCalled();
        expect(scoreCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            reportPath,
            stage: expectedScoreStage,
            triggerStage: expectedTriggerStage,
            event: expectedEvent,
            iterationCount: '0',
            sourceHashFilePath: artifactDocPath.replace(/\\/g, '/'),
          })
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('auto-runs post actions after report persistence for bugfix auditor', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-runner-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'bugfix',
          stage: 'implement',
          sourceMode: 'seeded_solutioning',
          contextScope: 'project',
          updatedAt: '2026-04-14T00:00:00.000Z',
        })
      );

      const artifactDocPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_login_loop.md'
      );
      const reportPath = artifactDocPath.replace(/\.md$/i, '.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          'stage: bugfix',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      const scoreCommand = vi.fn().mockResolvedValue(undefined);
      const executeAuditorScript = vi.fn();

      const result = await runAuditorHost(
        {
          projectRoot: root,
          reportPath,
          stage: 'bugfix',
          artifactPath: artifactDocPath,
        },
        { scoreCommand, executeAuditorScript }
      );

      expect(result.status).toBe('PASS');
      expect(executeAuditorScript).not.toHaveBeenCalled();
      expect(scoreCommand).toHaveBeenCalledTimes(1);
      expect(scoreCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          reportPath,
          stage: 'implement',
          triggerStage: 'speckit_5_2',
          artifactDocPath: artifactDocPath.replace(/\\/g, '/'),
        })
      );
      const registry = readRuntimeContextRegistry(root);
      expect(registry.auditIndex.bugfix[path.normalize(artifactDocPath)]).toMatchObject({
        status: 'PASS',
        stage: 'bugfix',
        closeoutApproved: true,
      });
      const projectContext = JSON.parse(
        readFileSync(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'), 'utf8')
      );
      expect(projectContext.latestReviewerCloseout).toMatchObject({
        stage: 'bugfix',
        artifactPath: artifactDocPath.replace(/\\/g, '/'),
        closeoutApproved: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps standalone task document audits to tasks scoring and registry without requiring local auditor scripts', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-document-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'standalone_tasks',
          stage: 'implement',
          sourceMode: 'standalone_story',
          contextScope: 'project',
          updatedAt: '2026-04-14T00:00:00.000Z',
        })
      );

      const artifactDocPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'standalone_tasks_login_cleanup.md'
      );
      const reportPath = artifactDocPath.replace(/\.md$/i, '.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          'stage: standalone_tasks',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 2',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      const scoreCommand = vi.fn().mockResolvedValue(undefined);
      const executeAuditorScript = vi.fn();

      const result = await runAuditorHost(
        {
          projectRoot: root,
          reportPath,
          stage: 'document',
          artifactPath: artifactDocPath,
          iterationCount: '2',
        },
        { scoreCommand, executeAuditorScript }
      );

      expect(result.status).toBe('PASS');
      expect(executeAuditorScript).not.toHaveBeenCalled();
      expect(scoreCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          reportPath,
          stage: 'tasks',
          triggerStage: 'speckit_4_2',
          iterationCount: '2',
        })
      );
      const registry = readRuntimeContextRegistry(root);
      expect(registry.auditIndex.standalone_tasks[path.normalize(artifactDocPath)]).toMatchObject({
        status: 'PASS',
        stage: 'standalone_tasks',
        closeoutApproved: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for orphan closeout when the structured report is missing the required stage field', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-orphan-stage-missing-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));

      const artifactDocPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_missing_stage.md'
      );
      const reportPath = artifactDocPath.replace(/\.md$/i, '.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      await expect(
        runAuditorHost(
          {
            projectRoot: root,
            reportPath,
            stage: 'bugfix',
            artifactPath: artifactDocPath,
          },
          { scoreCommand: vi.fn().mockResolvedValue(undefined), executeAuditorScript: vi.fn() }
        )
      ).rejects.toThrow(/missing required fields/i);

      const registry = readRuntimeContextRegistry(root);
      expect(registry.auditIndex.bugfix[path.normalize(artifactDocPath)]?.closeoutApproved).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('projects drift blocking into runAuditorHost closeout truth for critical implement drift', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-drift-closeout-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          updatedAt: '2026-04-13T12:00:00.000Z',
        })
      );

      const artifactDocPath = path.join(root, 'specs', 'demo', 'implement.md');
      const reportPath = path.join(root, 'specs', 'demo', 'implement.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 0',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
          '',
          '## Required Fixes',
          '- Fix the missing smoke task chain before closeout.',
        ].join('\n'),
        'utf8'
      );

      const scoreCommand = vi.fn().mockResolvedValue({
        parsedRecord: {
          effective_verdict: 'blocked',
          blocking_reason: 'Critical readiness drift detected against the current implementation baseline.',
          re_readiness_required: true,
          drift_severity: 'critical',
        },
      });

      const result = await runAuditorHost(
        {
          projectRoot: root,
          reportPath,
          stage: 'implement',
          artifactPath: artifactDocPath,
        },
        { scoreCommand, executeAuditorScript: vi.fn() }
      );

      expect(result.status).toBe('PASS');
      expect(result.governanceClosure).toMatchObject({
        implementationReadinessStatusRequired: true,
        packetExecutionClosureRequired: true,
      });
      expect(result.closeoutEnvelope).toMatchObject({
        resultCode: 'blocked',
        rerunDecision: 'rerun_required',
        packetExecutionClosureStatus: 'retry_pending',
        scoringFailureMode: 'succeeded',
        requiredFixes: [
          'Critical readiness drift detected against the current implementation baseline.',
        ],
      });
      const registry = readRuntimeContextRegistry(root);
      expect(registry.latestReviewerCloseout).toMatchObject({
        profile: 'implement_audit',
        stage: 'implement',
        closeoutApproved: false,
        canMainAgentContinue: false,
        scoreWriteResult: 'ok',
        handoffPersisted: true,
        driftSeverity: 'critical',
        reReadinessRequired: true,
        blockingReason: 'Critical readiness drift detected against the current implementation baseline.',
        effectiveVerdict: 'blocked',
        closeoutEnvelope: expect.objectContaining({
          resultCode: 'blocked',
          rerunDecision: 'rerun_required',
        }),
      });
      const projectContext = JSON.parse(
        readFileSync(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'), 'utf8')
      );
      expect(projectContext.latestReviewerCloseout).toMatchObject({
        closeoutApproved: false,
        canMainAgentContinue: false,
        scoreWriteResult: 'ok',
        handoffPersisted: true,
        driftSeverity: 'critical',
        reReadinessRequired: true,
        blockingReason: 'Critical readiness drift detected against the current implementation baseline.',
        effectiveVerdict: 'blocked',
        closeoutEnvelope: expect.objectContaining({
          resultCode: 'blocked',
          packetExecutionClosureStatus: 'retry_pending',
        }),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closeout when score write fails, even if the audit body passed', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-score-failure-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));

      const artifactDocPath = path.join(root, 'specs', 'demo', 'implement.md');
      const reportPath = path.join(root, 'specs', 'demo', 'implement.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 0',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      const result = await runAuditorHost(
        {
          projectRoot: root,
          reportPath,
          stage: 'implement',
          artifactPath: artifactDocPath,
        },
        {
          scoreCommand: vi.fn().mockRejectedValue(new Error('score write boom')),
          executeAuditorScript: vi.fn(),
        }
      );

      expect(result.status).toBe('PASS');
      expect(result.scoreError).toContain('score write boom');
      expect(result.closeoutEnvelope).toMatchObject({
        resultCode: 'blocked',
        rerunDecision: 'rerun_required',
        scoringFailureMode: 'non_blocking_failure',
        packetExecutionClosureStatus: 'retry_pending',
        requiredFixes: ['Score write failed: score write boom'],
      });

      const registry = readRuntimeContextRegistry(root);
      expect(registry.latestReviewerCloseout).toMatchObject({
        closeoutApproved: false,
        canMainAgentContinue: false,
        scoreWriteResult: 'failed',
        handoffPersisted: true,
        closeoutEnvelope: expect.objectContaining({
          resultCode: 'blocked',
          packetExecutionClosureStatus: 'retry_pending',
        }),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for story-flow spec closeout when storyPath is missing', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-spec-storypath-missing-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));

      const artifactDocPath = path.join(
        root,
        'specs',
        'epic-1-demo',
        'story-1-login',
        'spec-E1-S1.md'
      );
      const reportPath = path.join(
        root,
        'specs',
        'epic-1-demo',
        'story-1-login',
        'AUDIT_spec-E1-S1.md'
      );
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          'stage: spec',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 0',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      await expect(
        runAuditorHost(
          {
            projectRoot: root,
            reportPath,
            stage: 'spec',
            artifactPath: artifactDocPath,
          },
          { scoreCommand: vi.fn().mockResolvedValue(undefined), executeAuditorScript: vi.fn() }
        )
      ).rejects.toThrow(/storyPath/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks story-flow spec closeout when Story→Spec source_hash lock detects drift', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-spec-version-lock-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));

      const artifactDocPath = path.join(
        root,
        'specs',
        'epic-1-demo',
        'story-1-login',
        'spec-E1-S1.md'
      );
      const storyPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        'epic-1-demo',
        'story-1-login',
        '1-1-login.md'
      );
      const reportPath = path.join(
        root,
        'specs',
        'epic-1-demo',
        'story-1-login',
        'AUDIT_spec-E1-S1.md'
      );
      mkdirSync(path.dirname(reportPath), { recursive: true });
      mkdirSync(path.dirname(storyPath), { recursive: true });
      writeFileSync(storyPath, '# story\n', 'utf8');
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          'stage: spec',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          `storyPath: ${storyPath.replace(/\\/g, '/')}`,
          'iteration_count: 0',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      const scoreCommand = vi.fn().mockResolvedValue(undefined);
      const loadLatestRecordByStage = vi.fn().mockReturnValue({
        source_hash: 'sha256:stale',
      });
      const checkPreconditionHash = vi.fn().mockReturnValue({
        passed: false,
        action: 'block',
        actual_hash: 'sha256:current',
        expected_hash: 'sha256:stale',
        preconditionFile: storyPath,
        reason: 'hash mismatch',
      });

      const result = await runAuditorHost(
        {
          projectRoot: root,
          reportPath,
          stage: 'spec',
          artifactPath: artifactDocPath,
        },
        {
          scoreCommand,
          executeAuditorScript: vi.fn(),
          loadLatestRecordByStage,
          checkPreconditionHash,
        }
      );

      expect(result.status).toBe('PASS');
      expect(loadLatestRecordByStage).toHaveBeenCalledWith(
        'story',
        undefined,
        storyPath.replace(/\\/g, '/')
      );
      expect(checkPreconditionHash).toHaveBeenCalledWith(
        'spec',
        storyPath.replace(/\\/g, '/'),
        'sha256:stale'
      );
      expect(scoreCommand).not.toHaveBeenCalled();
      expect(result.closeoutEnvelope).toMatchObject({
        resultCode: 'blocked',
        rerunDecision: 'rerun_required',
        packetExecutionClosureStatus: 'retry_pending',
        scoringFailureMode: 'not_run',
      });
      expect(result.closeoutEnvelope.requiredFixes[0]).toContain('Story→Spec source_hash lock blocked');
      expect(result.closeoutEnvelope.requiredFixes[0]).toContain('storyPath drift detected');
      const registry = readRuntimeContextRegistry(root);
      expect(registry.latestReviewerCloseout?.closeoutApproved).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
