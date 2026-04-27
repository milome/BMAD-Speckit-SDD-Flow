import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runUnifiedIngress,
  type MainAgentHostKind,
} from '../../scripts/main-agent-unified-ingress';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function prepareRoot(hostKind: MainAgentHostKind, hookAvailable: boolean): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `main-agent-ingress-${hostKind}-`));
  writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
  writeRuntimeContext(
    root,
    defaultRuntimeContextFile({
      flow: 'story',
      stage: 'implement',
      sourceMode: 'full_bmad',
      contextScope: 'story',
      storyId: `S-${hostKind}`,
      runId: `ingress-${hostKind}`,
    })
  );
  if (hookAvailable && hostKind === 'cursor') {
    fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(root, '.cursor', 'hooks.json'), '{"version":1}\n', 'utf8');
  }
  if (hookAvailable && hostKind === 'claude') {
    fs.mkdirSync(path.join(root, '_bmad', 'claude', 'hooks'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs'),
      'module.exports = {};\n',
      'utf8'
    );
  }
  if (hostKind === 'codex') {
    fs.mkdirSync(path.join(root, '.codex', 'agents'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.codex', 'agents', 'implementation-worker.toml'),
      [
        'name = "implementation-worker"',
        'description = "Ingress Codex worker"',
        'sandbox_mode = "workspace-write"',
        'developer_instructions = """Follow dispatch packet instructions."""',
        '',
      ].join('\n'),
      'utf8'
    );
  }
  return root;
}

function writeFakeCodexBinary(root: string): string {
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
      "fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['fake-codex-unified-ingress'], evidence: ['fake-codex-unified-ingress'], downstreamContext: ['codex cli ingress completed'] }, null, 2) + '\\n', 'utf8');",
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
  return fakeCodexBin;
}

describe('main-agent unified ingress e2e', () => {
  it('routes hooks-enabled cursor through hook_ingress and the shared control plane', () => {
    const root = prepareRoot('cursor', true);
    try {
      const receipt = runUnifiedIngress({
        projectRoot: root,
        hostKind: 'cursor',
        flow: 'story',
        stage: 'implement',
      });

      expect(receipt.hostMode).toBe('hooks_enabled');
      expect(receipt.orchestrationEntry).toBe('hook_ingress');
      expect(receipt.degradationLevel).toBe('none');
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('completed');
      expect(receipt.runLoop.pendingPacketStatus).toBe('completed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('degrades missing hooks to cli_ingress without changing the control plane', () => {
    const root = prepareRoot('claude', false);
    try {
      const receipt = runUnifiedIngress({
        projectRoot: root,
        hostKind: 'claude',
        flow: 'story',
        stage: 'implement',
      });

      expect(receipt.hostMode).toBe('no_hooks');
      expect(receipt.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.degradationLevel).toBe('hook_lost');
      expect(receipt.degradationReason?.code).toBe('hook_unavailable');
      expect(receipt.degradationReason?.reason).toContain('hook unavailable');
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('completed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports codex as a native no-hooks cli_ingress branch with non-smoke worker execution', () => {
    const root = prepareRoot('codex', false);
    const previous = process.env.CODEX_WORKER_ADAPTER_BIN;
    try {
      process.env.CODEX_WORKER_ADAPTER_BIN = writeFakeCodexBinary(root);
      const receipt = runUnifiedIngress({
        projectRoot: root,
        hostKind: 'codex',
        flow: 'story',
        stage: 'implement',
      });

      expect(receipt.hostMode).toBe('no_hooks');
      expect(receipt.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.degradationLevel).toBe('none');
      expect(receipt.degradationReason).toBeNull();
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('completed');
      expect(receipt.runLoop.resolvedHost).toBe('codex');
      expect(receipt.runLoop.pendingPacketStatus).toBe('completed');
      expect(receipt.sameControlPlane).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.CODEX_WORKER_ADAPTER_BIN;
      } else {
        process.env.CODEX_WORKER_ADAPTER_BIN = previous;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
