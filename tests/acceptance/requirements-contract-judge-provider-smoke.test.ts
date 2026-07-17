import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { requirementsContractJudgeProviderSmokeCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-smoke';

const roots: string[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe('requirements contract Judge Provider smoke', () => {
  it('publishes current-attempt capability and selection receipts without credential leakage', async () => {
    const token = `token-${randomUUID()}`;
    const providerRef = `provider-${randomUUID()}`;
    const phaseAuditAttemptId = `AUD-${randomUUID()}`;
    const server = createServer((request, response) => {
      expect(request.url).toBe('/chat/completions');
      expect(request.headers.authorization).toBe(`Bearer ${token}`);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        model: 'judge-model',
        choices: [{ message: { content: '{"decision":"pass"}' } }],
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server_address_missing');
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-smoke-'));
    roots.push(root);
    try {
      mkdirSync(path.join(root, 'private'), { recursive: true });
      writeFileSync(
        path.join(root, 'config.yaml'),
        [
          'judgeRuntime:',
          '  enabled: true',
          `  activeProviderRef: ${providerRef}`,
          '  selectionPolicy:',
          '    mode: contract_locked',
          '    runtimeFallbackAllowed: false',
          '  credentialConfig:',
          '    path: private/credentials.yaml',
          '  providers:',
          `    ${providerRef}:`,
          '      transport: openai-compatible',
          '      apiStyle: chat_completions',
          '      model: judge-model',
          '      credentialRef: active',
          `      endpoint: { baseUrl: "http://127.0.0.1:${address.port}" }`,
          '      authentication: { type: bearer }',
          '      auditPolicy:',
          '        independenceClass: different_provider_different_model',
          '        allowPassAuthority: false',
          '',
        ].join('\n')
      );
      writeFileSync(
        path.join(root, 'private/credentials.yaml'),
        `credentials:\n  active:\n    value: ${token}\n`
      );
      const phaseRoot = path.join(root, 'audit', phaseAuditAttemptId);
      mkdirSync(phaseRoot, { recursive: true });
      writeFileSync(
        path.join(phaseRoot, 'audit-context.json'),
        `${JSON.stringify({ phase: 'pre-candidate', phaseAuditAttemptId })}\n`
      );
      const result = await requirementsContractJudgeProviderSmokeCommand({
        cwd: root,
        config: 'config.yaml',
        phase: 'pre-candidate',
        phaseRoot,
        phaseAuditAttemptId,
        auditContext: path.join(phaseRoot, 'audit-context.json'),
        capabilityReceipt: path.join(phaseRoot, 'capability.json'),
        selectionReceipt: path.join(phaseRoot, 'selection.json'),
        securityParity: path.join(phaseRoot, 'security.json'),
        projectionMode: 'final-only',
        json: false,
      });

      expect(result.decision).toBe('pass');
      expect(result.providerRef).toBe(providerRef);
      expect(result.phaseAuditAttemptId).toBe(phaseAuditAttemptId);
      expect(readFileSync(path.join(phaseRoot, 'selection.json'), 'utf8')).not.toContain(token);
      expect(JSON.parse(readFileSync(path.join(phaseRoot, 'capability.json'), 'utf8'))).toMatchObject({
        reachable: true,
        decision: 'pass',
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
