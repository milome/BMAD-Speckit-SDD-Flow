import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import { createGovernanceHostDispatchAdapter } from '../../scripts/governance-host-dispatch-adapter';
import { readGovernanceRemediationConfig } from '../../scripts/governance-remediation-config';
import { fallbackAllowed } from '../../scripts/orchestration-dispatch-contract';
import {
  createAutonomousFallbackDisabledFixture,
  writePendingGovernanceQueueItem,
} from '../helpers/autonomous-fallback-disabled-fixture';

describe('fallback autonomous dispatch mode', () => {
  it('hard-disables fallback routing in every dispatch scenario', () => {
    expect(
      fallbackAllowed({
        interactive: true,
        transportAvailable: true,
        explicitFallbackRequested: false,
      })
    ).toBe(false);
    expect(
      fallbackAllowed({
        interactive: true,
        transportAvailable: false,
        explicitFallbackRequested: false,
      })
    ).toBe(false);
    expect(
      fallbackAllowed({
        interactive: true,
        transportAvailable: true,
        explicitFallbackRequested: true,
      })
    ).toBe(false);
  });

  it('normalizes config to main-agent mode with autonomous fallback disabled', () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-fallback-mode-');
    try {
      const config = readGovernanceRemediationConfig(fixture.root);
      expect(config.execution?.interactiveMode).toBe('main-agent');
      expect(config.execution?.fallbackAutonomousMode).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects host dispatch even when an explicit fallback env flag is supplied', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-fallback-adapter-');
    try {
      const adapter = createGovernanceHostDispatchAdapter({
        env: {
          BMAD_GOVERNANCE_ALLOW_AUTONOMOUS_FALLBACK: '1',
        },
      });
      const result = await adapter.launch({
        executionId: 'exec-01',
        authoritativeHost: 'cursor',
        packetPath: path.join(fixture.root, 'missing-packet.md'),
        leaseOwner: 'worker',
        timeoutMs: 1000,
        projectRoot: fixture.root,
      });

      expect(result.kind).toBe('rejected');
      expect(result.reason).toContain('disabled');
    } finally {
      fixture.cleanup();
    }
  });

  it('keeps queue consumption inactive even when callers still request autonomous fallback', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-fallback-worker-block-');
    try {
      const queuePath = writePendingGovernanceQueueItem(fixture.root, 'queue-item-01');
      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(existsSync(fixture.currentRunPath)).toBe(false);
      expect(existsSync(queuePath)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
