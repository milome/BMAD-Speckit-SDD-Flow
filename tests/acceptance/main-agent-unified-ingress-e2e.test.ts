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
  return root;
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
      expect(receipt.degradationReason).toContain('hook unavailable');
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('completed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports codex as a no-hooks cli_ingress branch on the shared control plane', () => {
    const root = prepareRoot('codex', false);
    try {
      const receipt = runUnifiedIngress({
        projectRoot: root,
        hostKind: 'codex',
        flow: 'story',
        stage: 'implement',
      });

      expect(receipt.hostMode).toBe('no_hooks');
      expect(receipt.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.degradationReason).toBe('codex has no hook adapter');
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('completed');
      expect(receipt.sameControlPlane).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
