import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { packetArtifactPath } from '../../scripts/orchestration-dispatch-contract';
import { readOrchestrationState } from '../../scripts/orchestration-state';
import { runAuditorHost } from '../../scripts/run-auditor-host';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

function readSingleOrchestrationState(root: string) {
  const stateDir = path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'orchestration-state'
  );
  const files = fs.readdirSync(stateDir).filter((file) => file.endsWith('.json'));
  expect(files).toHaveLength(1);
  const sessionId = files[0].replace(/\.json$/i, '');
  const state = readOrchestrationState(root, sessionId);
  return { sessionId, state };
}

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

function makeBugfixImplementBlockedRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-bugfix-impl-block-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, {
    flow: 'bugfix',
    stage: 'implement',
    runId: 'run-bugfix-01',
    artifactRoot: '_bmad-output/implementation-artifacts/_orphan',
  });
  return tempRoot;
}

function writeGovernanceExecutionConfig(root: string): void {
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    [
      'version: 2',
      'primaryHost: cursor',
      'packetHosts:',
      '  - cursor',
      'provider:',
      '  mode: stub',
      '  id: implementation-entry-governance-stub',
      'execution:',
      '  enabled: true',
      '  interactiveMode: main-agent',
      '  fallbackAutonomousMode: true',
      '  authoritativeHost: cursor',
      '  fallbackHosts: []',
    ].join('\n'),
    'utf8'
  );
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
  it('fails closed for story implementation but hands control back to the main agent through orchestration state and packet', () => {
    const tempRoot = makeImplementBlockedRoot();
    try {
      writeGovernanceExecutionConfig(tempRoot);
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
      expect(out.systemMessage).toContain('Main Agent');
      expect(out.systemMessage).toContain('orchestration_state');
      expect(out.systemMessage).toContain('pending_packet');

      const { sessionId, state } = readSingleOrchestrationState(tempRoot);
      expect(state?.currentPhase).toBe('implement');
      expect(state?.nextAction).toBe('dispatch_remediation');
      expect(sessionId).toContain('story-');
      expect(state?.latestGate?.decision).toBe('auto_repairable_block');
      expect(state?.pendingPacket?.status).toBe('ready_for_main_agent');
      expect(state?.pendingPacket?.packetKind).toBe('recommendation');

      const packetPath = packetArtifactPath(tempRoot, sessionId, state?.pendingPacket?.packetId || '');
      expect(packetPath).toBe(state?.pendingPacket?.packetPath);
      const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8')) as {
        recommendedTaskType?: string;
        recommendedRole?: string;
        originalPromptText?: string;
      };
      expect(packet.recommendedTaskType).toBe('remediate');
      expect(packet.recommendedRole).toBe('remediation-worker');
      expect(packet.originalPromptText).toContain('Execute Dev Story implementation now.');

      const queueDir = path.join(
        tempRoot,
        '_bmad-output',
        'runtime',
        'governance',
        'queue',
        'pending'
      );
      expect(fs.existsSync(queueDir)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails closed for bugfix implementation but hands control back to the main agent through orchestration state and packet', () => {
    const tempRoot = makeBugfixImplementBlockedRoot();
    try {
      writeGovernanceExecutionConfig(tempRoot);
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          prompt: 'Execute BUGFIX implementation now.',
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
      expect(out.continue).toBe(false);
      expect(out.stopReason).toContain('Implementation Entry Gate');
      expect(out.systemMessage).toContain('Main Agent');

      const { sessionId, state } = readSingleOrchestrationState(tempRoot);
      expect(state?.flow).toBe('bugfix');
      expect(state?.currentPhase).toBe('implement');
      expect(state?.nextAction).toBe('dispatch_remediation');
      expect(sessionId).toContain('bugfix-');
      expect(state?.pendingPacket?.status).toBe('ready_for_main_agent');

      const packet = JSON.parse(
        fs.readFileSync(state?.pendingPacket?.packetPath || '', 'utf8')
      ) as {
        flow?: string;
        recommendedTaskType?: string;
        originalPromptText?: string;
      };
      expect(packet.flow).toBe('bugfix');
      expect(packet.recommendedTaskType).toBe('remediate');
      expect(packet.originalPromptText).toContain('Execute BUGFIX implementation now.');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('auto-repairs standalone readiness evidence but still hands implement control back to the main agent', async () => {
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
          'score_trigger_present: false',
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
      expect(out.continue).toBe(false);
      expect(out.systemMessage ?? '').toContain('Main Agent');
      expect(out.systemMessage ?? '').toContain('orchestration_state');
      expect(out.systemMessage ?? '').toContain('pending_packet');
      expect(out.systemMessage ?? '').toContain('next_action: `dispatch_implement`');

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

      const { state } = readSingleOrchestrationState(tempRoot);
      expect(state?.flow).toBe('standalone_tasks');
      expect(state?.nextAction).toBe('dispatch_implement');
      expect(state?.pendingPacket?.status).toBe('ready_for_main_agent');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
