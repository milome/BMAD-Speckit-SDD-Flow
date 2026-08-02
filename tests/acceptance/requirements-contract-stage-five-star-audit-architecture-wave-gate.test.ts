import { createHash, randomUUID } from 'node:crypto';
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
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_STAGE_REGISTRY } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import { requirementsContractStageFiveStarAuditCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-stage-five-star-auditor';

const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

function writeJson(root: string, relativePath: string, value: unknown) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
}

describe('requirements contract stage five-star architecture wave gate', () => {
  it('blocks architecture, revokes pre-candidate, and grants authority only to fresh final evidence', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-stage-audit-'));
    const contract = 'contract.md';
    const requirementSetId = `req-${randomUUID()}`;
    const transactionId = `TX-${randomUUID()}`;
    const implementationAttemptId = `IMP-${randomUUID()}`;
    const auditIds = {
      architecture: `AUDIT-${randomUUID()}`,
      'pre-candidate': `AUDIT-${randomUUID()}`,
      final: `AUDIT-${randomUUID()}`,
    } as const;
    const contractText = [
      '| CMD-24 | `node -e "process.exit(0)"` | Repository root | pass | AC-01 |',
      '| CMD-25 | `node -e "process.exit(0)"` | Repository root | pass | AC-01 |',
      '',
    ].join('\n');
    try {
      writeFileSync(path.join(root, contract), contractText, 'utf8');
      writeJson(root, 'recovery.json', {
        schemaVersion: 'requirements-contract-recovery-lineage-receipt/v1',
        contractHash: sha256(contractText),
        frozenUniverseHash: sha256('universe'),
        requirementSetId,
        transactionId,
        implementationAttemptId,
        architectureAuditAttemptId: auditIds.architecture,
        preCandidateAuditAttemptId: auditIds['pre-candidate'],
        finalAuditAttemptId: auditIds.final,
      });
      mkdirSync(path.join(root, 'consumer'), { recursive: true });
      for (const phase of ['architecture', 'pre-candidate', 'final'] as const) {
        const auditAttemptId = auditIds[phase];
        const phaseRoot = `audit/${transactionId}/${implementationAttemptId}/${phase}/${auditAttemptId}`;
        const complete = phase !== 'architecture';
        const stageEvidence = REQUIREMENTS_CONTRACT_STAGE_REGISTRY.map((stage) => {
          const ref = (kind: string) =>
            complete ? [`${phaseRoot}/evidence/${stage.stageId}-${kind}-${auditAttemptId}.json`] : [];
          return {
            stageId: stage.stageId,
            auditAttemptId,
            contractRefs: ref('contract'),
            sourceObligationRefs: ref('source'),
            acceptanceRefs: ref('acceptance'),
            traceRefs: ref('trace'),
            commandReceiptRefs: ref('command'),
            artifactRefs: ref('artifact'),
            independentEvidenceRefs: ref('independent'),
            consumerJourneyEvidenceRefs: ref('consumer'),
          };
        });
        const writeBinding = (name: string, content: string) => {
          const target = path.join(root, phaseRoot, name);
          mkdirSync(path.dirname(target), { recursive: true });
          writeFileSync(target, content, 'utf8');
          return {
            path: `${phaseRoot}/${name}`,
            hash: sha256(content),
          };
        };
        const judgeRuntimeBindings = complete
          ? {
              schemaVersion: 'requirements-contract-stage-judge-runtime-bindings/v1',
              judgeAuditUnitSetRef: {
                ...writeBinding('judge-audit-unit-set.json', '{"schemaVersion":"fixture"}\n'),
                schemaVersion: 'requirements-contract-judge-audit-unit-set/v1',
              },
              rubricRef: writeBinding('rubric.json', '{}\n'),
              systemPromptRef: writeBinding('system-prompt.txt', 'fixture\n'),
              sourceRef: writeBinding('source.md', '# Source\n'),
              traceRef: writeBinding('trace.json', '{}\n'),
              redRef: writeBinding('red.json', '{}\n'),
              baseEvidenceRef: writeBinding('base-evidence.json', '{}\n'),
              authorizedChallengeDerivationProtocolRef: writeBinding(
                'challenge-protocol.json',
                '{}\n'
              ),
            }
          : undefined;
        writeJson(root, `${phaseRoot}/audit-context.json`, {
          schemaVersion: 'requirements-contract-stage-audit-context/v1',
          phase,
          phaseAuditAttemptId: auditAttemptId,
          requirementSetId,
          transactionId,
          implementationAttemptId,
          frozenUniverseHash: sha256('universe'),
          sourceHashes: { source: sha256('source') },
          semanticModelHashes: { semantic: sha256('semantic') },
          consumerIdentityHash: sha256('consumer'),
          stageEvidence,
          ...(judgeRuntimeBindings ? { judgeRuntimeBindings } : {}),
        });
        const result = await requirementsContractStageFiveStarAuditCommand({
          cwd: root,
          contract,
          recovery: 'recovery.json',
          consumerRoot: 'consumer',
          phase,
          phaseRoot,
          phaseAuditAttemptId: auditAttemptId,
          auditContext: `${phaseRoot}/audit-context.json`,
          matrix: `${phaseRoot}/cmd34/stage-five-star-audit-matrix.json`,
          gapLedger: `${phaseRoot}/cmd34/stage-gap-ledger.json`,
          finalGate: `${phaseRoot}/cmd34/stage-anti-fabrication-and-final-gate-report.json`,
          candidateReceipt: `${phaseRoot}/cmd34/candidate.receipt.json`,
          candidateRevocationReceipt: `${phaseRoot}/cmd34/candidate-revocation.receipt.json`,
          downstreamInvalidationSet: `${phaseRoot}/cmd34/downstream-invalidation-set.json`,
          projectionMode: 'final-only',
          json: false,
        });
        if (phase === 'architecture') {
          expect(result).toMatchObject({
            decision: 'block',
            passAuthority: false,
            stageFiveStarCount: 0,
          });
          expect(result.openGapCount).toBeGreaterThan(0);
        } else if (phase === 'pre-candidate') {
          expect(result).toMatchObject({
            decision: 'revoked_candidate',
            passAuthority: false,
            stageFiveStarCount: 11,
          });
          const candidateReceiptPath = path.join(
            root,
            `${phaseRoot}/cmd34/candidate.receipt.json`
          );
          expect(existsSync(candidateReceiptPath)).toBe(true);
          expect(JSON.parse(readFileSync(candidateReceiptPath, 'utf8')).decision).toBe(
            'provisional_pass_candidate'
          );
          const candidateRevocationReceiptPath = path.join(
            root,
            `${phaseRoot}/cmd34/candidate-revocation.receipt.json`
          );
          expect(existsSync(candidateRevocationReceiptPath)).toBe(true);
          expect(JSON.parse(readFileSync(candidateRevocationReceiptPath, 'utf8'))).toMatchObject({
            schemaVersion: 'requirements-contract-stage-candidate-revocation-receipt/v1',
            passAuthority: false,
            reason: 'mandatory_pre_candidate_revocation',
            decision: 'revoked_candidate',
          });
        } else {
          expect(result).toMatchObject({
            decision: 'preterminal_pass_candidate',
            passAuthority: true,
            stageFiveStarCount: 11,
            openGapCount: 0,
          });
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
