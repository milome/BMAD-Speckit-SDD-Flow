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
  fs.mkdirSync(path.join(root, '.codex', 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.codex', 'agents', 'implementation-worker.toml'),
    [
      'name = "implementation-worker"',
      'description = "Test implementation worker"',
      'sandbox_mode = "workspace-write"',
      'developer_instructions = """Follow BMAD implementation worker test instructions."""',
      '',
    ].join('\n'),
    'utf8'
  );
  return root;
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

      const adapter = runCodexWorkerAdapter({
        projectRoot: root,
        packetPath: instruction!.packetPath,
        taskReportPath,
        smoke: true,
        smokeTargetPath: `src/codex/${instruction!.packetId}.md`,
      });

      expect(adapter.exitCode).toBe(0);
      expect(adapter.scopePassed).toBe(true);
      expect(adapter.runtimeGovernanceStatus).toBe('resolved');
      expect(adapter.agentRole).toBe('implementation-worker');
      expect(adapter.agentSpecPath).toContain('implementation-worker.toml');
      expect(adapter.taskReport.status).toBe('done');
      expect(fs.existsSync(path.join(root, `src/codex/${instruction!.packetId}.md`))).toBe(true);
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
        `codex-smoke:src/codex/${instruction!.packetId}.md`
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

  it('fails closed when runtime governance cannot resolve even in smoke mode', () => {
    const root = prepareCodexRoot();
    try {
      fs.rmSync(path.join(root, '_bmad-output', 'runtime', 'registry.json'), { force: true });
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });
      const taskReportPath = path.join(root, 'policy-blocked-task-report.json');

      const adapter = runCodexWorkerAdapter({
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
      expect(adapter.taskReport.validationsRun).toContain('codex-worker-adapter-runtime-governance');
      expect(fs.existsSync(path.join(root, `src/codex/${instruction!.packetId}.md`))).toBe(false);
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
          "const reportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();",
          "const packetId = input.match(/Packet ID: (.+)/i)?.[1]?.trim();",
          "if (!reportPath || !packetId) process.exit(2);",
          "fs.mkdirSync(require('path').dirname(reportPath), { recursive: true });",
          "fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['fake-codex-exec'], evidence: ['fake-codex-task-report'], downstreamContext: ['fake codex exec completed'] }, null, 2) + '\\n', 'utf8');",
          "process.exit(0);",
          '',
        ].join('\n'),
        'utf8'
      );
      const fakeCodexBin =
        process.platform === 'win32' ? path.join(root, 'fake-codex.cmd') : path.join(root, 'fake-codex');
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
      const adapter = runCodexWorkerAdapter({
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
      const adapter = runCodexWorkerAdapter({
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

      const adapter = runCodexWorkerAdapter({
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

      const adapter = runCodexWorkerAdapter({
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

      const adapter = runCodexWorkerAdapter({
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
      fs.writeFileSync(taskReportPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(report, 'utf16le')]));

      const adapter = runCodexWorkerAdapter({
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
          "const reportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();",
          "const packetId = input.match(/Packet ID: (.+)/i)?.[1]?.trim();",
          "if (!reportPath || !packetId) process.exit(2);",
          "fs.mkdirSync(path.dirname(reportPath), { recursive: true });",
          "fs.mkdirSync('outside', { recursive: true });",
          "fs.writeFileSync('outside/hidden.md', 'hidden out-of-scope write\\n', 'utf8');",
          "fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['fake-codex-hidden-write'], evidence: ['reported clean'], downstreamContext: [] }, null, 2) + '\\n', 'utf8');",
          "process.exit(0);",
          '',
        ].join('\n'),
        'utf8'
      );
      const fakeCodexBin =
        process.platform === 'win32' ? path.join(root, 'fake-codex-hidden-write.cmd') : path.join(root, 'fake-codex-hidden-write');
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

      const adapter = runCodexWorkerAdapter({
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
