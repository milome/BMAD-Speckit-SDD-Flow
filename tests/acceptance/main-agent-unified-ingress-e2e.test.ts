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
import { readOrchestrationState } from '../../scripts/orchestration-state';

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
      expect(receipt.hostRecovery).toMatchObject({
        degradation_cleared_at: null,
        recovery_probe_count: 0,
        recovered_host_mode: null,
        recovered_orchestration_entry: null,
      });
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
      expect(receipt.degradationReason?.detected_at).toEqual(expect.any(String));
      expect(receipt.degradationReason?.failed_capability).toBe('runtime_policy_hook');
      expect(receipt.degradationReason?.fallback_entry).toBe('cli_ingress');
      expect(receipt.degradationReason?.expected_behavior_change).toContain('CLI ingress');
      expect(receipt.hostRecovery.degradation_cleared_at).toBeNull();
      expect(receipt.hostRecovery.recovery_probe_count).toBeGreaterThanOrEqual(
        receipt.hostRecovery.required_probe_count
      );
      expect(receipt.hostRecovery.recovered_host_mode).toBeNull();
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBeNull();
      expect(receipt.hostRecovery.parity_diff.degradationCleared).toBe(false);
      expect(receipt.hostRecovery.before_parity_snapshot.inspect?.status).toBe('completed');
      expect(receipt.hostRecovery.after_parity_snapshot.inspect).toBeNull();
      expect(receipt.hostRecovery.recovery_log_path).toEqual(expect.any(String));
      expect(fs.existsSync(receipt.hostRecovery.recovery_log_path as string)).toBe(true);
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('completed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits S3f recovery/back-switch fields when forced cli ingress can recover hooks', () => {
    const root = prepareRoot('cursor', true);
    try {
      const receipt = runUnifiedIngress({
        projectRoot: root,
        hostKind: 'cursor',
        flow: 'story',
        stage: 'implement',
        forceNoHooks: true,
      });

      expect(receipt.degradationLevel).toBe('cli_forced');
      expect(receipt.degradationReason?.failed_capability).toBe('operator_override');
      expect(receipt.hostRecovery.recovery_probe_count).toBeGreaterThanOrEqual(
        receipt.hostRecovery.required_probe_count
      );
      expect(receipt.hostRecovery.recovered_host_mode).toBe('hooks_enabled');
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBe('hook_ingress');
      expect(receipt.hostRecovery.degradation_cleared_at).toEqual(expect.any(String));
      expect(receipt.hostRecovery.before_parity_snapshot.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.hostRecovery.after_parity_snapshot.orchestrationEntry).toBe('hook_ingress');
      expect(receipt.hostRecovery.before_parity_snapshot.inspect?.resolvedHost).toBe('cursor');
      expect(receipt.hostRecovery.after_parity_snapshot.inspect?.pendingPacketStatus).toBe(
        'completed'
      );
      expect(receipt.hostRecovery.before_parity_snapshot.inspect).not.toBe(
        receipt.hostRecovery.after_parity_snapshot.inspect
      );
      expect(receipt.hostRecovery.parity_diff).toMatchObject({
        hostModeChanged: true,
        orchestrationEntryChanged: true,
        degradationCleared: true,
      });
      expect(receipt.hostRecovery.recovery_log_path).toEqual(expect.any(String));
      expect(fs.existsSync(receipt.hostRecovery.recovery_log_path as string)).toBe(true);
      const state = readOrchestrationState(root, receipt.runLoop.sessionId!);
      expect(state?.hostRecovery).toMatchObject({
        degradation_level: 'cli_forced',
        active_host_mode: 'no_hooks',
        orchestration_entry: 'cli_ingress',
        recovered_host_mode: 'hooks_enabled',
        recovered_orchestration_entry: 'hook_ingress',
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not back-switch when hook health probe fails despite hook file existing', () => {
    const root = prepareRoot('cursor', true);
    try {
      fs.writeFileSync(path.join(root, '.cursor', 'hooks.json'), '{not-json}\n', 'utf8');
      const receipt = runUnifiedIngress({
        projectRoot: root,
        hostKind: 'cursor',
        flow: 'story',
        stage: 'implement',
        forceNoHooks: true,
      });

      expect(receipt.degradationLevel).toBe('cli_forced');
      expect(receipt.hostRecovery.recovered_host_mode).toBeNull();
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBeNull();
      expect(receipt.hostRecovery.parity_diff.degradationCleared).toBe(false);
      const log = JSON.parse(
        fs.readFileSync(receipt.hostRecovery.recovery_log_path as string, 'utf8')
      ) as { probes: Array<{ hookAvailable: boolean; hookExecutable: boolean }> };
      expect(log.probes.every((probe) => probe.hookAvailable)).toBe(true);
      expect(log.probes.every((probe) => probe.hookExecutable)).toBe(false);
      const state = readOrchestrationState(root, receipt.runLoop.sessionId!);
      expect(state?.hostRecovery?.degradation_level).toBe('cli_forced');
      expect(state?.hostRecovery?.recovered_host_mode).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits host_partial and transport_degraded degradation branches', () => {
    const hostPartialRoot = prepareRoot('codex', false);
    const transportRoot = prepareRoot('cursor', true);
    try {
      const hostPartial = runUnifiedIngress({
        projectRoot: hostPartialRoot,
        hostKind: 'codex',
        flow: 'story',
        stage: 'implement',
        forceHostPartial: true,
      });
      expect(hostPartial.degradationLevel).toBe('host_partial');
      expect(hostPartial.degradationReason?.failed_capability).toBe('host_capability');
      expect(hostPartial.hostRecovery.parity_diff.degradationCleared).toBe(false);

      const transport = runUnifiedIngress({
        projectRoot: transportRoot,
        hostKind: 'cursor',
        flow: 'story',
        stage: 'implement',
        forceTransportDegraded: true,
      });
      expect(transport.degradationLevel).toBe('transport_degraded');
      expect(transport.degradationReason?.failed_capability).toBe('transport');
      expect(transport.hostRecovery.recovery_log_path).toEqual(expect.any(String));
    } finally {
      fs.rmSync(hostPartialRoot, { recursive: true, force: true });
      fs.rmSync(transportRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when host recovery cannot write orchestration state', () => {
    const root = prepareRoot('cursor', true);
    try {
      expect(() =>
        runUnifiedIngress({
          projectRoot: root,
          hostKind: 'cursor',
          flow: 'story',
          stage: 'implement',
          forceNoHooks: true,
          forceStateWriteFailure: true,
        })
      ).toThrow(/host recovery state write failed/u);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks S3f back-switch when inspect parity does not match the recovering host', () => {
    const root = prepareRoot('cursor', true);
    try {
      const receipt = runUnifiedIngress({
        projectRoot: root,
        hostKind: 'cursor',
        flow: 'story',
        stage: 'implement',
        forceNoHooks: true,
        recoveryInspectHostOverride: 'codex',
      });
      expect(receipt.hostRecovery.recovered_host_mode).toBeNull();
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBeNull();
      expect(receipt.hostRecovery.degradation_cleared_at).toBeNull();
      expect(receipt.hostRecovery.parity_diff.degradationCleared).toBe(false);

      const logPath = receipt.hostRecovery.recovery_log_path as string;
      const log = JSON.parse(fs.readFileSync(logPath, 'utf8')) as {
        inspect_parity_passed: boolean;
        back_switch_allowed: boolean;
      };
      expect(log.inspect_parity_passed).toBe(false);
      expect(log.back_switch_allowed).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports codex as a native no-hooks cli_ingress branch with non-smoke worker execution', () => {
    const root = prepareRoot('codex', false);
    const previous = process.env.CODEX_WORKER_ADAPTER_BIN;
    const previousAllow = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
    try {
      process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = 'true';
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
      if (previousAllow === undefined) {
        delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
      } else {
        process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = previousAllow;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
