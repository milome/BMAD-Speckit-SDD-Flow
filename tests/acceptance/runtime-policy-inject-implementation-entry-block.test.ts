import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';
import { runAuditorHost } from '../../scripts/run-auditor-host';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

const repoRoot = process.cwd();

function makeImplementBlockedRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-impl-block-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, {
    flow: 'story',
    stage: 'implement',
    epicId: 'epic-14',
    storyId: '14.1',
    runId: 'run-14-1',
  });
  return tempRoot;
}

function makeStandaloneAutoRepairRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-standalone-auto-repair-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);

  const artifactPath = '_bmad-output/implementation-artifacts/_orphan/TASKS_checkout_hardening.md';
  writeRuntimeContextRegistry(tempRoot, defaultRuntimeContextRegistry(tempRoot));
  writeRuntimeContext(
    tempRoot,
    defaultRuntimeContextFile({
      flow: 'standalone_tasks',
      stage: 'implement',
      sourceMode: 'standalone_story',
      contextScope: 'project',
      artifactPath,
      updatedAt: new Date().toISOString(),
    })
  );
  return tempRoot;
}

describe('runtime-policy-inject implementation-entry block', () => {
  it('fails closed for implementation-like preToolUse when implementation-entry gate is blocked', () => {
    const tempRoot = makeImplementBlockedRoot();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        tool_name: 'Agent',
        tool_input: {
          subagent_type: 'general-purpose',
          prompt: 'Execute Dev Story implementation now.',
        },
      });
      const result = spawnSync(process.execPath, [inject], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(out.continue).toBe(false);
      expect(out.stopReason).toContain('Implementation Entry Gate');
      expect(out.systemMessage).toContain('Implementation Entry Gate blocked');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('auto-repairs standalone implementation-entry evidence and does not hard-stop the implement subagent', async () => {
    const tempRoot = makeStandaloneAutoRepairRoot();
    try {
      const tasksPath = path.join(
        tempRoot,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'TASKS_checkout_hardening.md'
      );
      fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
      fs.writeFileSync(tasksPath, '# TASKS\n\n- [ ] T001 Harden checkout flow\n', 'utf8');

      const auditReportPath = tasksPath.replace(/\.md$/i, '.audit.md');
      fs.writeFileSync(
        auditReportPath,
        [
          'status: PASS',
          'stage: standalone_tasks',
          `reportPath: ${auditReportPath.replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${tasksPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );
      await runAuditorHost({
        projectRoot: tempRoot,
        reportPath: auditReportPath,
        stage: 'document',
        artifactPath: tasksPath,
        iterationCount: '1',
      });

      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          prompt: '按 TASKS 文档执行 checkout hardening 实施。',
        },
      });
      const result = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(out.continue).not.toBe(false);
      expect(out.stopReason ?? '').not.toContain('Implementation Entry Gate');
      expect(out.systemMessage ?? '').not.toContain('Implementation Entry Gate blocked');

      const planningRoot = path.join(
        tempRoot,
        '_bmad-output',
        'planning-artifacts',
        'standalone_tasks'
      );
      const generatedReports: string[] = [];
      const walk = (dir: string): void => {
        if (!fs.existsSync(dir)) {
          return;
        }
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
            continue;
          }
          if (/implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/i.test(entry.name)) {
            generatedReports.push(fullPath);
          }
        }
      };
      walk(planningRoot);

      expect(generatedReports.length).toBeGreaterThan(0);
      const reportText = fs.readFileSync(generatedReports[0], 'utf8');
      expect(reportText).toContain(
        'Auto-generated implementation-entry evidence report for `standalone_tasks`'
      );
      expect(reportText).toContain('### Overall Readiness Status');
      expect(reportText).toContain('READY');
      expect(reportText).toContain('- Blocker count: 0');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
