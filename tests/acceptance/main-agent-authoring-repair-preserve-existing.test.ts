import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyRequirementAuthoringResume,
  type RequirementAuthoringResumeClassification,
  type RequirementAuthoringResumeTrigger,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-repair-registry';
import {
  prepareRequirementsContractCp04FreezeStage,
  publishRequirementsContractCp04FreezeStage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';
import {
  ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
  activeAuthoringAttemptPointerHash,
  type ActiveAuthoringAttemptPointer,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-active-authoring-attempt-pointer';
import {
  createRequirementsContractDecisionReceipt,
  publishRequirementsContractDecisionReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-session';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function filePointerCas(root: string) {
  return (
    targetPath: typeof ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
    expectedHash: string | null,
    pointer: ActiveAuthoringAttemptPointer,
    pointerHash: string
  ) => {
    const absolute = path.join(root, ...targetPath.split('/'));
    const currentHash = existsSync(absolute)
      ? activeAuthoringAttemptPointerHash(readJson<ActiveAuthoringAttemptPointer>(absolute))
      : null;
    if (currentHash !== expectedHash) return false;
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(pointer, null, 2)}\n`, 'utf8');
    return activeAuthoringAttemptPointerHash(readJson<ActiveAuthoringAttemptPointer>(absolute)) ===
      pointerHash;
  };
}

type ExpectedResume = Omit<
  RequirementAuthoringResumeClassification,
  'schemaVersion' | 'trigger'
>;

const RESUME_CASES = [
  {
    trigger: 'frozen_ir_reentry',
    expected: {
      earliestAffectedStage: 'cp05',
      latestValidPredecessorCheckpoint: 'cp04',
      resumeAction: 'resume_projection_from_frozen_ir',
      reopenGrill: false,
      rerunJudge: false,
      preserveFrozenSemanticRevision: true,
      preserveDecisionReceipts: true,
    },
  },
  {
    trigger: 'decision_projection_gap',
    expected: {
      earliestAffectedStage: 'cp01',
      latestValidPredecessorCheckpoint: 'cp00',
      resumeAction: 'recompile_from_existing_decision_receipt',
      reopenGrill: false,
      rerunJudge: true,
      preserveFrozenSemanticRevision: false,
      preserveDecisionReceipts: true,
    },
  },
  {
    trigger: 'compiler_decision_loss',
    expected: {
      earliestAffectedStage: 'cp01',
      latestValidPredecessorCheckpoint: 'cp00',
      resumeAction: 'recompile_from_existing_decision_receipt',
      reopenGrill: false,
      rerunJudge: true,
      preserveFrozenSemanticRevision: false,
      preserveDecisionReceipts: true,
    },
  },
  {
    trigger: 'technical_planning_pending',
    expected: {
      earliestAffectedStage: 'cp02',
      latestValidPredecessorCheckpoint: 'cp01',
      resumeAction: 'resume_after_technical_capability_change',
      reopenGrill: false,
      rerunJudge: false,
      preserveFrozenSemanticRevision: false,
      preserveDecisionReceipts: true,
    },
  },
  {
    trigger: 'projection_drift',
    expected: {
      earliestAffectedStage: 'cp05',
      latestValidPredecessorCheckpoint: 'cp04',
      resumeAction: 'rebuild_projection_from_frozen_ir',
      reopenGrill: false,
      rerunJudge: true,
      preserveFrozenSemanticRevision: true,
      preserveDecisionReceipts: true,
    },
  },
  {
    trigger: 'semantic_revision_stale',
    expected: {
      earliestAffectedStage: 'cp00',
      latestValidPredecessorCheckpoint: null,
      resumeAction: 'compile_semantic_successor',
      reopenGrill: false,
      rerunJudge: true,
      preserveFrozenSemanticRevision: false,
      preserveDecisionReceipts: true,
    },
  },
  {
    trigger: 'citation_binding_stale',
    expected: {
      earliestAffectedStage: 'binding_refresh',
      latestValidPredecessorCheckpoint: 'cp04',
      resumeAction: 'refresh_binding_and_citations_only',
      reopenGrill: false,
      rerunJudge: false,
      preserveFrozenSemanticRevision: true,
      preserveDecisionReceipts: true,
    },
  },
] as const satisfies readonly {
  trigger: RequirementAuthoringResumeTrigger;
  expected: ExpectedResume;
}[];

describe('requirements authoring repair resume registry', () => {
  it.each(RESUME_CASES)(
    'classifies $trigger at its earliest affected stage',
    ({ trigger, expected }) => {
      expect(classifyRequirementAuthoringResume(trigger)).toEqual({
        schemaVersion: 'requirements-authoring-repair-resume-classification/v1',
        trigger,
        ...expected,
      });
    }
  );

  it('reuses existing decision receipts for compiler and Judge projection gaps', () => {
    const judgeGap = classifyRequirementAuthoringResume('decision_projection_gap');
    const compilerLoss = classifyRequirementAuthoringResume('compiler_decision_loss');

    expect(judgeGap).toMatchObject({
      resumeAction: 'recompile_from_existing_decision_receipt',
      reopenGrill: false,
      preserveDecisionReceipts: true,
    });
    expect(compilerLoss).toMatchObject({
      resumeAction: 'recompile_from_existing_decision_receipt',
      reopenGrill: false,
      preserveDecisionReceipts: true,
    });
  });

  it('separates semantic successor compilation from citation-only binding refresh', () => {
    expect(classifyRequirementAuthoringResume('semantic_revision_stale')).toMatchObject({
      earliestAffectedStage: 'cp00',
      latestValidPredecessorCheckpoint: null,
      preserveFrozenSemanticRevision: false,
      rerunJudge: true,
    });
    expect(classifyRequirementAuthoringResume('citation_binding_stale')).toMatchObject({
      earliestAffectedStage: 'binding_refresh',
      latestValidPredecessorCheckpoint: 'cp04',
      preserveFrozenSemanticRevision: true,
      rerunJudge: false,
    });
  });

  it('preserves frozen staging bytes through pending and drift before publishing a successor', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-repair-runtime-'));
    try {
      const publishAttempt = (
        authoringAttemptId: string,
        semanticMarker: string,
        expectedCurrentPointerHash: string | null
      ) => {
        const stage = prepareRequirementsContractCp04FreezeStage({
          semanticIr: {
            schemaVersion: 'requirements-contract-semantic-ir/v1',
            requirementSetId: 'REQ-REPAIR-RUNTIME-SET',
            mustIds: [`MUST-${semanticMarker}`],
          },
          sourceBinding: {
            schemaVersion: 'requirements-contract-source-binding/v1',
            snapshotSetHash: sha256Stable(`snapshot-${semanticMarker}`),
            sourceSpanRegistryHash: sha256Stable(`span-${semanticMarker}`),
            evidenceClaimRegistryHash: sha256Stable(`claims-${semanticMarker}`),
          },
          resolvedEvidenceIndex: {
            schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
            claimRefs: [`CLAIM-${semanticMarker}`],
          },
        });
        return publishRequirementsContractCp04FreezeStage({
          recordRootPath: root,
          stage,
          authoringRequestId: 'REQUEST-REPAIR-RUNTIME',
          authoringAttemptId,
          inputManifestHash: sha256Stable(`input-${semanticMarker}`),
          previousCheckpointManifestRef: {
            checkpointId: 'cp03',
            checkpointOrdinal: 3,
            path: `authoring/staging/${authoringAttemptId}/manifests/3-cp03.json`,
            hash: sha256Stable(`cp03-${semanticMarker}`),
          },
          compilerIdentity: 'requirements-contract-compiler/v1',
          decisionReceiptRefs: [],
          baseAuthorityRef: null,
          expectedCurrentPointerHash,
          compareAndSwapAttemptPointer: filePointerCas(root),
        });
      };
      const attemptA = publishAttempt('ATTEMPT-A', 'A', null);
      const pointerPath = path.join(root, ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/'));
      const frozenPaths = [...Object.values(attemptA.paths), pointerPath];
      const frozenBytes = new Map(frozenPaths.map((filePath) => [filePath, readFileSync(filePath)]));

      expect(classifyRequirementAuthoringResume('frozen_ir_reentry')).toMatchObject({
        preserveFrozenSemanticRevision: true,
        latestValidPredecessorCheckpoint: 'cp04',
      });
      expect(classifyRequirementAuthoringResume('technical_planning_pending')).toMatchObject({
        earliestAffectedStage: 'cp02',
        rerunJudge: false,
      });
      expect(classifyRequirementAuthoringResume('projection_drift')).toMatchObject({
        earliestAffectedStage: 'cp05',
        preserveFrozenSemanticRevision: true,
      });
      for (const filePath of frozenPaths) {
        expect(readFileSync(filePath), filePath).toEqual(frozenBytes.get(filePath));
      }

      const attemptB = publishAttempt(
        'ATTEMPT-B',
        'B',
        attemptA.attemptPointer.pointerHash
      );
      expect(attemptB.paths.semanticIr).not.toBe(attemptA.paths.semanticIr);
      expect(attemptB.paths.sourceBinding).not.toBe(attemptA.paths.sourceBinding);
      expect(attemptB.paths.resolvedEvidenceIndex).not.toBe(
        attemptA.paths.resolvedEvidenceIndex
      );
      expect(attemptB.paths.checkpointManifest).not.toBe(attemptA.paths.checkpointManifest);
      for (const [filePath, bytes] of frozenBytes) {
        if (filePath === pointerPath) continue;
        expect(existsSync(filePath), filePath).toBe(true);
        expect(readFileSync(filePath), filePath).toEqual(bytes);
      }

      const receipt = createRequirementsContractDecisionReceipt({
        authoringRequestId: 'REQUEST-REPAIR-RUNTIME',
        grillSessionId: 'SESSION-REPAIR-RUNTIME',
        questionId: 'QUESTION-REPAIR-RUNTIME',
        questionVersion: 'v1',
        affectedFieldIds: ['FIELD-REPAIR-RUNTIME'],
        authorityPremiseHashes: [sha256Stable('repair-runtime-premise')],
        answerValue: 'preserve',
        answerSchemaHash: sha256Stable({ type: 'string' }),
        affectedNodeIds: ['NODE-REPAIR-RUNTIME'],
        userInputProvenance: { authorityOrigin: 'requesting_user' },
      });
      const firstReceipt = publishRequirementsContractDecisionReceipt({ recordRoot: root, receipt });
      const receiptPath = path.join(root, ...firstReceipt.receiptPath.split('/'));
      const receiptBytes = readFileSync(receiptPath);
      const receiptMtime = statSync(receiptPath).mtimeMs;
      const replayReceipt = publishRequirementsContractDecisionReceipt({ recordRoot: root, receipt });
      expect(replayReceipt.status).toBe('grill_answers_reused');
      expect(readFileSync(receiptPath)).toEqual(receiptBytes);
      expect(statSync(receiptPath).mtimeMs).toBe(receiptMtime);
      for (const filePath of [
        ...Object.values(attemptA.paths),
        ...Object.values(attemptB.paths),
        receiptPath,
      ]) {
        expect(existsSync(filePath), filePath).toBe(true);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
