import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  runMainAgentAutomaticLoop,
} from '../../scripts/main-agent-orchestration';
import { main, runCodexWorkerAdapter } from '../../scripts/main-agent-codex-worker-adapter';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

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
  return root;
}

describe('main-agent codex worker adapter e2e', () => {
  it('runs codex no-hooks smoke, writes scoped changes, emits TaskReport, and lets run-loop ingest it', () => {
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
      const taskReportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'codex',
        'task-reports',
        `${instruction!.packetId}.json`
      );

      const adapter = runCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: true,
        smokeTargetPath: `src/codex/${instruction!.packetId}.md`,
      });

      expect(adapter.exitCode).toBe(0);
      expect(adapter.scopePassed).toBe(true);
      expect(adapter.taskReport.status).toBe('done');
      expect(fs.existsSync(path.join(root, `src/codex/${instruction!.packetId}.md`))).toBe(true);

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
        `codex-smoke:src/codex/${instruction!.packetId}.md`
      );
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

      const adapter = runCodexWorkerAdapter({
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
