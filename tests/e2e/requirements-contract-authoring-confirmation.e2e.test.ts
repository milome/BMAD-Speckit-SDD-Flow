import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startOpenAICompatibleJudgeProvider } from './helpers/openai-compatible-judge-provider';
import {
  advanceToUserConfirmable,
  createRequirementsConsumerRoot,
  installJudgeRuntime,
  removeRequirementsConsumerRoot,
  spawnMainAgent,
} from './helpers/requirements-contract-production-harness';

const temporaryRoots: string[] = [];

function createConsumerRoot(): string {
  const root = createRequirementsConsumerRoot();
  temporaryRoots.push(root);
  return root;
}

describe('Requirements production-entry confirmation', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      removeRequirementsConsumerRoot(root);
    }
  });

  it('reaches confirmation through the Requirements-only production CLI chain', async () => {
    const consumerRoot = createConsumerRoot();
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(consumerRoot, provider.baseUrl);
    try {
      const envelope = await advanceToUserConfirmable(consumerRoot, provider);

      expect(provider.requests).toHaveLength(1);
      expect(envelope.status).toBe('user_confirmable');
      expect(envelope.data.unresolvedDecisionCount).toBe(0);
      const requestId = envelope.data.requestId as string;
      const exactConfirmationText = envelope.data.confirmation.exactConfirmationText as string;
      const recordRoot = path.join(
        consumerRoot,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requestId
      );
      const record = JSON.parse(
        fs.readFileSync(path.join(recordRoot, 'record', 'requirement-record.json'), 'utf8')
      );
      const buildManifest = JSON.parse(fs.readFileSync(
        path.join(recordRoot, ...record.activeAuthority.activeBuildManifestPath.split('/')), 'utf8'
      ));
      const checkpointStates = Array.from({ length: 9 }, (_, ordinal) => {
        const checkpointId = `cp${String(ordinal).padStart(2, '0')}`;
        return JSON.parse(fs.readFileSync(path.join(
          recordRoot,
          'authoring',
          'operations',
          record.activeOperationId,
          'checkpoints',
          `${checkpointId}.json`
        ), 'utf8'));
      });
      expect(checkpointStates.map((state) => state.checkpointId)).toEqual(
        Array.from({ length: 9 }, (_, ordinal) => `cp${String(ordinal).padStart(2, '0')}`)
      );
      expect(checkpointStates.every((state) => state.decision === 'passed')).toBe(true);
      expect(checkpointStates[3].completedUnits[0].outputRefs).toHaveLength(3);
      expect(buildManifest.checkpointSummary.terminalStateHashes).toEqual(
        [...checkpointStates.map((state) => state.stateHash)].sort()
      );
      expect(JSON.stringify(checkpointStates)).not.toContain('projection payload stored once');
      const entry = (role: string) => buildManifest.artifactEntries.find(
        (candidate: Record<string, unknown>) => candidate.role === role
      );
      const semanticEntry = entry('semantic_ir');
      const semanticIr = JSON.parse(
        fs.readFileSync(
          path.join(recordRoot, ...semanticEntry.contentRef.recordRelativePath.split('/')),
          'utf8'
        )
      );
      const judgePacketEntry = entry('judge_audit_packet');
      const judgePacketDescriptor = JSON.parse(fs.readFileSync(
        path.join(recordRoot, ...judgePacketEntry.contentRef.recordRelativePath.split('/')),
        'utf8'
      ));
      expect(judgePacketDescriptor.semanticIrRef).toEqual(semanticEntry.contentRef);
      const artifactRoleById: Record<string, string> = {
        'confirmation-projection': 'confirmation_projection',
        'final-markdown': 'final_markdown',
        'execution-manifest': 'execution_manifest',
        'per-must-bundle': 'per_must_bundle',
        'trace-matrix': 'trace_matrix',
        'diagram-set': 'diagram_set',
        'projection-reconciliation-report': 'projection_reconciliation_report',
        'authority-resolution-report': 'authority_resolution_report',
        'renderability-probe-report': 'renderability_probe_report',
      };
      for (const slice of judgePacketDescriptor.semanticAuditSliceRefs) {
        if (slice.role === 'judge_metadata') continue;
        expect(slice.contentRef).toEqual(entry(artifactRoleById[slice.role]).contentRef);
      }
      const metadataSlice = judgePacketDescriptor.semanticAuditSliceRefs.find(
        (slice: Record<string, unknown>) => slice.role === 'judge_metadata'
      );
      expect(metadataSlice).toBeDefined();
      const metadataBody = fs.readFileSync(
        path.join(recordRoot, ...metadataSlice.contentRef.recordRelativePath.split('/')),
        'utf8'
      );
      expect(metadataBody).not.toContain('artifactPayloadGroups');
      const reviewCandidate = JSON.parse(fs.readFileSync(
        path.join(recordRoot, 'confirmation', 'current-promotion.json'), 'utf8'
      ));
      const markdown = fs.readFileSync(path.join(
        recordRoot, ...reviewCandidate.candidateRef.recordRelativePath.split('/')
      ), 'utf8');
      for (const requirement of semanticIr.semanticPayload.semantics.requirements) {
        expect(markdown).toContain(requirement.id);
        expect(markdown).toContain(requirement.text);
        expect(markdown).toContain(requirement.oracle);
      }
      for (const decision of semanticIr.semanticPayload.semantics.decisions) {
        expect(markdown).toContain(decision.questionId);
        expect(markdown).toContain(
          typeof decision.answerValue === 'string'
            ? decision.answerValue
            : JSON.stringify(decision.answerValue)
        );
      }
      expect(fs.existsSync(path.join(recordRoot, 'goal'))).toBe(false);
      expect(fs.existsSync(path.join(recordRoot, 'partition'))).toBe(false);
      expect(fs.existsSync(path.join(recordRoot, 'child-workloads'))).toBe(false);
      const confirmed = await spawnMainAgent(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        exactConfirmationText,
      ]);

      expect(confirmed).toMatchObject({
        schemaVersion: 'main-agent-package-runtime/v1',
        action: 'confirm-scope',
        status: 'user_confirmed',
        exitCode: 0,
        errors: [],
        data: {
          requestId,
          semanticRevisionId: expect.any(String),
          confirmationEventId: expect.any(String),
        },
      });
      expect(provider.requests).toHaveLength(1);

      const sourceBindingEntry = entry('source_binding');
      const sourceBinding = JSON.parse(
        fs.readFileSync(
          path.join(recordRoot, ...sourceBindingEntry.contentRef.recordRelativePath.split('/')),
          'utf8'
        )
      );
      expect(sourceBinding.sourceArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceArtifactId: 'repo-refund-architecture-premise',
            role: 'repository_authority',
            immutableBlobRef: 'architecture/repository-premise-authority.json',
          }),
          expect.objectContaining({
            sourceArtifactId: 'policy-refund-architecture-premise',
            role: 'policy_authority',
            immutableBlobRef: 'policy/architecture-premise-authority.json',
          }),
        ])
      );
      const semanticIrPath = path.join(
        recordRoot,
        ...semanticEntry.contentRef.recordRelativePath.split('/')
      );
      const semanticIrBeforeArchitecture = fs.readFileSync(semanticIrPath, 'utf8');
      const prepared = await spawnMainAgent(consumerRoot, 'prepare-architecture-confirmation', [
        '--request-id',
        requestId,
      ]);
      expect(prepared).toMatchObject({
        action: 'prepare-architecture-confirmation',
        status: 'user_confirmable',
        exitCode: 0,
        data: {
          result: {
            status: 'user_confirmable',
            architectureConfirmationCandidateHash: expect.any(String),
          },
        },
      });
      const architectureResult = prepared.data.result as Record<string, any>;
      const architectureCandidate = JSON.parse(
        fs.readFileSync(
          path.join(consumerRoot, ...architectureResult.candidateRef.path.split('/')),
          'utf8'
        )
      );
      expect(architectureCandidate).toMatchObject({
        logicalScope: { targetPaths: ['src/refunds/batch-refund-service.ts'] },
        isolation: { mode: 'consumer_worktree' },
        ownership: [
          {
            targetPath: 'src/refunds/batch-refund-service.ts',
            owner: 'refund_platform_owner',
            basisRefs: expect.any(Array),
          },
        ],
      });
      expect(fs.readFileSync(semanticIrPath, 'utf8')).toBe(semanticIrBeforeArchitecture);
      expect(fs.existsSync(path.join(recordRoot, 'implementation-readiness'))).toBe(false);
      expect(fs.existsSync(path.join(recordRoot, 'goal'))).toBe(false);
    } finally {
      await provider.close();
    }
  });
});
