import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { requirementsContractJudgeCredentialsInitCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-credential-initializer';

function config(providerRef: string, sensitivity: string, arbitrary: boolean) {
  return [
    'judgeRuntime:',
    '  enabled: true',
    `  activeProviderRef: ${providerRef}`,
    '  credentialConfig:',
    '    path: private/judge.credentials.yaml',
    '    schemaVersion: requirements-contract-judge-credentials/v1',
    '    allowedRoot: private',
    '  providers:',
    `    ${providerRef}:`,
    '      credentialRef: active',
    '      authentication:',
    '        type: bearer',
    `        sensitivity: ${sensitivity}`,
    `        arbitraryNonEmptyValueAllowed: ${arbitrary}`,
    '',
  ].join('\n');
}

describe('requirements contract Judge credential initializer', () => {
  it('initializes only a placeholder credential without leaking its value', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-credentials-'));
    const providerRef = `provider-${randomUUID()}`;
    try {
      writeFileSync(path.join(root, 'config.yaml'), config(providerRef, 'placeholder', true));
      const receipt = await requirementsContractJudgeCredentialsInitCommand({
        cwd: root,
        config: 'config.yaml',
        json: false,
      });
      const credentialPath = path.join(root, 'private/judge.credentials.yaml');
      const credential = yaml.load(readFileSync(credentialPath, 'utf8')) as {
        credentials: { active: { value: string } };
      };
      const serializedReceipt = JSON.stringify(receipt);

      expect(existsSync(credentialPath)).toBe(true);
      expect(receipt.providerRef).toBe(providerRef);
      expect(receipt.targetPreexisted).toBe(false);
      expect(receipt.redactionDecision).toBe('pass');
      expect(receipt.platformPermissionDecision).toBe('pass');
      expect(receipt.decision).toBe('pass');
      expect(serializedReceipt).not.toContain(credential.credentials.active.value);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses to synthesize a real secret credential', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-real-credentials-'));
    try {
      mkdirSync(root, { recursive: true });
      writeFileSync(
        path.join(root, 'config.yaml'),
        config(`provider-${randomUUID()}`, 'secret', false)
      );
      await expect(
        requirementsContractJudgeCredentialsInitCommand({
          cwd: root,
          config: 'config.yaml',
          json: false,
        })
      ).rejects.toThrow('judge_credential_auto_initialization_forbidden');
      expect(existsSync(path.join(root, 'private/judge.credentials.yaml'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
