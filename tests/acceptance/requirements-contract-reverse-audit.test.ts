import { createHash, randomUUID } from 'node:crypto';
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
import { describe, expect, it } from 'vitest';
import { requirementsContractReverseAuditCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-reverse-audit';

const hash = (filePath: string) =>
  `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;

describe('requirements contract reverse audit', () => {
  it('runs the two-round blind protocol and publishes challenge evidence first', async () => {
    let requestCount = 0;
    const server = createServer((_request, response) => {
      requestCount += 1;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        model: 'judge-model',
        choices: [{
          message: {
            content: JSON.stringify({
              decision: 'pass',
              findings: [],
              challengeRequests: [],
            }),
          },
        }],
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server_address_missing');
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-reverse-audit-'));
    try {
      const providerRef = `provider-${randomUUID()}`;
      const phaseAuditAttemptId = `AUD-${randomUUID()}`;
      const phaseRoot = path.join(root, 'phase', phaseAuditAttemptId);
      mkdirSync(path.join(root, 'private'), { recursive: true });
      mkdirSync(phaseRoot, { recursive: true });
      writeFileSync(path.join(root, 'contract.md'), '# Contract\n');
      writeFileSync(
        path.join(root, 'config.yaml'),
        `judgeRuntime:\n  enabled: true\n  activeProviderRef: ${providerRef}\n  credentialConfig: { path: private/credentials.yaml }\n  providers:\n    ${providerRef}:\n      transport: openai-compatible\n      apiStyle: chat_completions\n      model: judge-model\n      credentialRef: active\n      endpoint: { baseUrl: "http://127.0.0.1:${address.port}" }\n      auditPolicy: { allowPassAuthority: false }\n`
      );
      writeFileSync(path.join(root, 'private/credentials.yaml'), 'credentials:\n  active:\n    value: token\n');
      writeFileSync(
        path.join(phaseRoot, 'context.json'),
        `${JSON.stringify({ phase: 'pre-candidate', phaseAuditAttemptId })}\n`
      );
      writeFileSync(
        path.join(phaseRoot, 'capability.json'),
        `${JSON.stringify({ phase: 'pre-candidate', phaseAuditAttemptId, providerRef, model: 'judge-model', decision: 'pass' })}\n`
      );
      writeFileSync(
        path.join(phaseRoot, 'selection.json'),
        `${JSON.stringify({
          phase: 'pre-candidate',
          phaseAuditAttemptId,
          providerRef,
          model: 'judge-model',
          capabilityReceiptRef: {
            path: path.join(phaseRoot, 'capability.json'),
            hash: hash(path.join(phaseRoot, 'capability.json')),
          },
          decision: 'pass',
        })}\n`
      );

      const result = await requirementsContractReverseAuditCommand({
        cwd: root,
        contract: 'contract.md',
        judgeConfig: 'config.yaml',
        phase: 'pre-candidate',
        phaseRoot,
        phaseAuditAttemptId,
        auditContext: path.join(phaseRoot, 'context.json'),
        capabilityReceipt: path.join(phaseRoot, 'capability.json'),
        selectionReceipt: path.join(phaseRoot, 'selection.json'),
        outTestSourceAudit: path.join(phaseRoot, 'test-source-audit.json'),
        outChallengeTests: path.join(phaseRoot, 'challenge-tests.json'),
        outInitialJudge: path.join(phaseRoot, 'initial-judge.json'),
        outFinalJudge: path.join(phaseRoot, 'final-judge.json'),
        projectionMode: 'final-only',
        json: false,
      });

      expect(requestCount).toBe(2);
      expect(result.decision).toBe('pass');
      expect(JSON.parse(readFileSync(path.join(phaseRoot, 'challenge-tests.json'), 'utf8'))).toMatchObject({
        writeSequence: 2,
        decision: 'not_requested',
      });
      expect(JSON.parse(readFileSync(path.join(phaseRoot, 'test-source-audit.json'), 'utf8'))).toMatchObject({
        writeSequence: 4,
        judgeDecision: 'pass',
        blockerCount: 0,
        inconclusiveCount: 0,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(root, { recursive: true, force: true });
    }
  });
});
