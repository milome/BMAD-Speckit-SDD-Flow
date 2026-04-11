import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { runAuditorHost } from '../../scripts/run-auditor-host';

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
  ])(
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
      expect(registry.auditIndex.bugfix[path.normalize(artifactDocPath)]?.status).toBe('PASS');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps standalone task document audits to tasks scoring and registry without requiring local auditor scripts', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-host-document-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));

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
      expect(registry.auditIndex.standalone_tasks[path.normalize(artifactDocPath)]?.status).toBe(
        'PASS'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
