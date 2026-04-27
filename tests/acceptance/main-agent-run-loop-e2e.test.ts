import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function writeCodexImplementationWorker(root: string): void {
  fs.mkdirSync(path.join(root, '.codex', 'agents'), { recursive: true });
  for (const name of [
    'implementation-worker',
    'code-reviewer',
    'remediation-worker',
    'document-worker',
  ]) {
    fs.writeFileSync(
      path.join(root, '.codex', 'agents', `${name}.toml`),
      [
        `name = "${name}"`,
        `description = "Test ${name}"`,
        'sandbox_mode = "workspace-write"',
        'developer_instructions = """Follow dispatch packet instructions."""',
        '',
      ].join('\n'),
      'utf8'
    );
  }
}

function writeFakeCodexBinary(root: string, validationPrefix: string): string {
  const fakeCodexPath = path.join(root, `${validationPrefix}.cjs`);
  fs.writeFileSync(
    fakeCodexPath,
    [
      "const fs = require('fs');",
      "const path = require('path');",
      "const input = fs.readFileSync(0, 'utf8');",
      "const reportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();",
      "const packetId = input.match(/Packet ID: (.+)/i)?.[1]?.trim();",
      "const packetPath = input.match(/Read dispatch packet: (.+)/i)?.[1]?.trim();",
      "let taskType = 'unknown';",
      "if (packetPath && fs.existsSync(packetPath)) taskType = JSON.parse(fs.readFileSync(packetPath, 'utf8')).taskType || taskType;",
      "if (!reportPath || !packetId) process.exit(2);",
      "fs.mkdirSync(path.dirname(reportPath), { recursive: true });",
      `fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['${validationPrefix}-' + taskType], evidence: ['${validationPrefix}-adapter'], downstreamContext: ['fake codex ' + taskType + ' completed'] }, null, 2) + '\\n', 'utf8');`,
      "process.exit(0);",
      '',
    ].join('\n'),
    'utf8'
  );
  const fakeCodexBin =
    process.platform === 'win32'
      ? path.join(root, `${validationPrefix}.cmd`)
      : path.join(root, validationPrefix);
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
  return fakeCodexBin;
}

describe('main-agent automatic run-loop', () => {
  it('executes inspect dispatch claim dispatch report complete and final inspect from one call', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop',
          runId: 'run-loop-test',
        })
      );

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        executor: ({ projectRoot, instruction, args }) => {
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(result.status).toBe('completed');
      expect(result.steps.map((step) => step.step)).toEqual([
        'inspect.initial',
        'dispatch-plan',
        'claim',
        'long-run-policy.attach',
        'dispatch',
        'task-report.ingest',
        'inspect.final',
      ]);
      expect(result.finalSurface.pendingPacketStatus).toBe('completed');
      expect(result.finalSurface.orchestrationState?.longRun?.policyHash).toBeTruthy();
      expect(result.finalSurface.orchestrationState?.longRun?.active_host_mode).toBe('cursor');
      expect(result.finalSurface.orchestrationState?.lastTaskReport?.status).toBe('done');
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_review');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks instead of synthesizing completion when no real task report is provided', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-no-report-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop-blocked',
          runId: 'run-loop-blocked-test',
        })
      );

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(result.status).toBe('blocked');
      expect(result.steps.at(-1)).toMatchObject({
        step: 'task-report.load',
        status: 'fail',
      });
      expect(result.finalSurface.pendingPacketStatus).toBe('dispatched');
      expect(result.finalSurface.orchestrationState?.lastTaskReport ?? null).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves codex as the host through dispatch state and final inspect', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-codex-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop-codex',
          runId: 'run-loop-codex-test',
        })
      );

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        executor: ({ projectRoot, instruction, args }) => {
          expect(instruction.host).toBe('codex');
          expect(instruction.route.tool).toBe('codex');
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(result.status).toBe('completed');
      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.finalSurface.orchestrationState?.host).toBe('codex');
      expect(result.finalSurface.orchestrationState?.longRun?.active_host_mode).toBe('codex');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses the Codex worker adapter by default for codex host run-loop instead of synthetic TaskReport', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-codex-adapter-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop-codex-adapter',
          runId: 'run-loop-codex-adapter-test',
        })
      );
      writeCodexImplementationWorker(root);

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        args: { codexSmoke: 'true' },
      });

      expect(result.status).toBe('completed');
      expect(result.steps.some((step) => step.step === 'codex-worker-adapter')).toBe(true);
      expect(result.taskReport?.validationsRun).toContain('codex-worker-adapter-smoke');
      expect(result.taskReport?.validationsRun).not.toContain('main-agent:run-loop-task-report');
      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.finalSurface.pendingPacketStatus).toBe('completed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs Codex worker adapter in non-smoke mode through run-loop when a Codex binary is available', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-codex-exec-'));
    const previous = process.env.CODEX_WORKER_ADAPTER_BIN;
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop-codex-exec',
          runId: 'run-loop-codex-exec-test',
        })
      );
      writeCodexImplementationWorker(root);
      const fakeCodexBin = writeFakeCodexBinary(root, 'fake-codex-exec');
      process.env.CODEX_WORKER_ADAPTER_BIN = fakeCodexBin;

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
      });

      expect(result.status).toBe('completed');
      expect(result.steps.find((step) => step.step === 'codex-worker-adapter')?.summary).toContain(
        'mode=codex_exec'
      );
      expect(result.taskReport?.validationsRun).toContain('fake-codex-exec-implement');
      expect(result.taskReport?.validationsRun).not.toContain('codex-worker-adapter-smoke');
      expect(result.taskReport?.validationsRun).not.toContain('main-agent:run-loop-task-report');
    } finally {
      if (previous === undefined) {
        delete process.env.CODEX_WORKER_ADAPTER_BIN;
      } else {
        process.env.CODEX_WORKER_ADAPTER_BIN = previous;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializes a review dispatch instruction after rerun_gate', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-rerun-gate-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-rerun-gate',
          runId: 'rerun-gate-test',
        })
      );

      const remediate = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        executor: ({ projectRoot, instruction, args }) => {
          expect(instruction.taskType).toBe('implement');
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, {
            ...args,
            reportStatus: 'done',
          });
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });
      expect(remediate.finalSurface.mainAgentNextAction).toBe('dispatch_review');

      const review = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        executor: ({ projectRoot, instruction, args }) => {
          expect(instruction.taskType).toBe('audit');
          expect(instruction.nextAction).toBe('dispatch_review');
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(review.status).toBe('completed');
      expect(review.dispatchInstruction?.host).toBe('codex');
      expect(review.finalSurface.orchestrationState?.host).toBe('codex');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('continues rerun_gate remediation and review through the Codex worker adapter', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-rerun-gate-codex-adapter-'));
    const previous = process.env.CODEX_WORKER_ADAPTER_BIN;
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-rerun-gate-codex-adapter',
          runId: 'rerun-gate-codex-adapter-test',
        })
      );
      writeCodexImplementationWorker(root);
      process.env.CODEX_WORKER_ADAPTER_BIN = writeFakeCodexBinary(root, 'fake-rerun-codex');

      const remediate = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
      });
      expect(remediate.status).toBe('completed');
      expect(remediate.dispatchInstruction?.taskType).toBe('implement');
      expect(remediate.taskReport?.validationsRun).toContain('fake-rerun-codex-implement');
      expect(remediate.finalSurface.mainAgentNextAction).toBe('dispatch_review');

      const review = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
      });
      expect(review.status).toBe('completed');
      expect(review.dispatchInstruction?.taskType).toBe('audit');
      expect(review.dispatchInstruction?.nextAction).toBe('dispatch_review');
      expect(review.taskReport?.validationsRun).toContain('fake-rerun-codex-audit');
      expect(review.steps.find((step) => step.step === 'codex-worker-adapter')?.summary).toContain(
        'mode=codex_exec'
      );
      expect(review.finalSurface.orchestrationState?.host).toBe('codex');
    } finally {
      if (previous === undefined) {
        delete process.env.CODEX_WORKER_ADAPTER_BIN;
      } else {
        process.env.CODEX_WORKER_ADAPTER_BIN = previous;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('CLI --taskReportPath ingests an existing report without overwriting it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-cli-report-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop-cli-report',
          runId: 'run-loop-cli-report-test',
        })
      );

      const dispatchOutput = execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          'tsconfig.node.json',
          '--transpile-only',
          'scripts/main-agent-orchestration.ts',
          '--cwd',
          root,
          '--action',
          'dispatch-plan',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      const dispatch = JSON.parse(dispatchOutput) as { packetId: string };
      const reportPath = path.join(root, '_bmad-output', 'runtime', 'evidence', 'external-task-report.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(
        reportPath,
        JSON.stringify(
          {
            packetId: dispatch.packetId,
            status: 'done',
            filesChanged: ['tests/external-real-report.test.ts'],
            validationsRun: ['external-real-validation'],
            evidence: ['external-real-evidence'],
            downstreamContext: ['external task report must not be overwritten'],
          },
          null,
          2
        ) + '\n',
        'utf8'
      );

      const output = execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          'tsconfig.node.json',
          '--transpile-only',
          'scripts/main-agent-orchestration.ts',
          '--cwd',
          root,
          '--action',
          'run-loop',
          '--taskReportPath',
          reportPath,
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      const result = JSON.parse(output) as {
        status: string;
        taskReport: { validationsRun: string[]; evidence: string[] };
      };
      const after = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        validationsRun: string[];
        evidence: string[];
      };

      expect(result.status).toBe('completed');
      expect(result.taskReport.validationsRun).toEqual(['external-real-validation']);
      expect(result.taskReport.evidence).toEqual(['external-real-evidence']);
      expect(after.validationsRun).toEqual(['external-real-validation']);
      expect(after.evidence).toEqual(['external-real-evidence']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
