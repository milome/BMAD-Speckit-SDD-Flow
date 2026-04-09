import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGovernanceRemediationConfig } from '../../scripts/governance-remediation-config';

describe('governance packet execution config', () => {
  it('parses execution closure config and keeps backward compatibility', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-packet-exec-config-'));
    try {
      const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
      mkdirSync(path.dirname(configPath), { recursive: true });

      writeFileSync(
        configPath,
        [
          'version: 2',
          'primaryHost: claude',
          'packetHosts:',
          '  - cursor',
          'provider:',
          '  mode: stub',
          '  id: test-provider',
          'execution:',
          '  enabled: true',
          '  authoritativeHost: cursor',
          '  fallbackHosts:',
          '    - claude',
          '    - codex',
          '  dispatch:',
          '    leaseTimeoutSeconds: 1200',
          '    heartbeatIntervalSeconds: 45',
          '    maxDispatchAttempts: 4',
          '  execution:',
          '    timeoutMinutes: 15',
          '    maxExecutionAttempts: 3',
          '  rerunGate:',
          '    required: true',
          '    autoSchedule: false',
          '    maxGateRetries: 5',
          '  escalation:',
          '    afterDispatchFailures: 4',
          '    afterExecutionFailures: 3',
          '    afterGateFailures: 5',
          '  projections:',
          '    emitNonAuthoritativePackets: false',
          '    archivePath: custom/archive',
        ].join('\n'),
        'utf8'
      );

      const config = readGovernanceRemediationConfig(root);
      expect(config.version).toBe(2);
      expect(config.execution?.enabled).toBe(true);
      expect(config.execution?.authoritativeHost).toBe('cursor');
      expect(config.execution?.fallbackHosts).toEqual(['claude', 'codex']);
      expect(config.execution?.dispatch.maxDispatchAttempts).toBe(4);
      expect(config.execution?.rerunGate.autoSchedule).toBe(false);
      expect(config.execution?.projections.emitNonAuthoritativePackets).toBe(false);

      rmSync(configPath);
      const fallback = readGovernanceRemediationConfig(root);
      expect(fallback.version).toBe(1);
      expect(fallback.execution?.enabled).toBe(false);
      expect(fallback.primaryHost).toBe('cursor');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
