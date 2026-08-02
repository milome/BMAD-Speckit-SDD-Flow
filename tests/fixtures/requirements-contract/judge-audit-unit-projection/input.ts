import { sha256Stable } from '../../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const HASH_E = `sha256:${'e'.repeat(64)}`;
const HASH_F = `sha256:${'f'.repeat(64)}`;
const HASH_ZERO = `sha256:${'0'.repeat(64)}`;
const MUST_BODY = { kind: 'functional', text: 'Checkout must return a stable result.' };
const ASSOCIATED_NEGATIVE_BODY = {
  kind: 'negative',
  text: 'Checkout must not leak credentials.',
};
const STANDALONE_NEGATIVE_BODY = {
  kind: 'negative',
  text: 'An unassociated negative root remains auditable.',
};
const MUST_BODY_HASH = sha256Stable(MUST_BODY);
const ASSOCIATED_NEGATIVE_BODY_HASH = sha256Stable(ASSOCIATED_NEGATIVE_BODY);
const STANDALONE_NEGATIVE_BODY_HASH = sha256Stable(STANDALONE_NEGATIVE_BODY);

export const JUDGE_AUDIT_FIXTURE_IDS = {
  mustRoot: 'MUST-FR-001',
  associatedNegativeRoot: 'NEG-001',
  standaloneNegativeRoot: 'NEG-002',
  firstAcceptanceRoot: 'ACCEPTANCE-ROOT-001',
  secondAcceptanceRoot: 'ACCEPTANCE-ROOT-002',
  standaloneAcceptanceRoot: 'ACCEPTANCE-ROOT-003',
  mustTrace: 'TRACE-MUST-001',
  negativeTrace: 'TRACE-NEG-001',
  standaloneTrace: 'TRACE-NEG-002',
} as const;

export const JUDGE_AUDIT_FIXTURE_HASHES = {
  driftedPayloadHash: HASH_ZERO,
} as const;

export function judgeAuditUnitProjectionFixture() {
  return {
    requirementSetId: 'checkout',
    sourceAuthorityHash: HASH_A,
    semanticModelHash: HASH_B,
    canonicalTraceGraphHash: HASH_C,
    canonicalRootUniverse: {
      semanticConservationManifestHash: HASH_D,
      acceptanceRootProofManifestHash: HASH_E,
      requirementRoots: [
        {
          rootRef: JUDGE_AUDIT_FIXTURE_IDS.mustRoot,
          requirementKind: 'functional',
          payloadHash: MUST_BODY_HASH,
          sourceSpanRefs: ['SOURCE-SPAN-MUST-001'],
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-SOURCE-001'],
          },
          authorityProofRefs: ['PROOF-SOURCE-001'],
        },
        {
          rootRef: JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot,
          requirementKind: 'negative',
          payloadHash: ASSOCIATED_NEGATIVE_BODY_HASH,
          sourceSpanRefs: ['SOURCE-SPAN-NEG-001'],
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-SOURCE-002'],
          },
          authorityProofRefs: ['PROOF-SOURCE-002'],
        },
        {
          rootRef: JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot,
          requirementKind: 'negative',
          payloadHash: STANDALONE_NEGATIVE_BODY_HASH,
          sourceSpanRefs: ['SOURCE-SPAN-NEG-002'],
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-SOURCE-003'],
          },
          authorityProofRefs: ['PROOF-SOURCE-003'],
        },
      ],
      acceptanceRoots: [
        {
          rootRef: JUDGE_AUDIT_FIXTURE_IDS.firstAcceptanceRoot,
          payloadHash: HASH_D,
          sourceSpanRefs: ['SOURCE-SPAN-ACCEPTANCE-001'],
          requirementRefs: [JUDGE_AUDIT_FIXTURE_IDS.mustRoot],
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-ACCEPTANCE-001'],
          },
          authorityProofRefs: ['PROOF-ACCEPTANCE-001'],
        },
        {
          rootRef: JUDGE_AUDIT_FIXTURE_IDS.secondAcceptanceRoot,
          payloadHash: HASH_E,
          sourceSpanRefs: ['SOURCE-SPAN-ACCEPTANCE-002'],
          requirementRefs: [JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot],
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-ACCEPTANCE-002'],
          },
          authorityProofRefs: ['PROOF-ACCEPTANCE-002'],
        },
        {
          rootRef: JUDGE_AUDIT_FIXTURE_IDS.standaloneAcceptanceRoot,
          payloadHash: HASH_F,
          sourceSpanRefs: ['SOURCE-SPAN-ACCEPTANCE-003'],
          requirementRefs: [JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot],
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-ACCEPTANCE-003'],
          },
          authorityProofRefs: ['PROOF-ACCEPTANCE-003'],
        },
      ],
    },
    semanticModel: {
      semanticBodies: {
        [MUST_BODY_HASH]: MUST_BODY,
        [ASSOCIATED_NEGATIVE_BODY_HASH]: ASSOCIATED_NEGATIVE_BODY,
        [STANDALONE_NEGATIVE_BODY_HASH]: STANDALONE_NEGATIVE_BODY,
      },
      nodes: {
        [JUDGE_AUDIT_FIXTURE_IDS.mustRoot]: {
          nodeType: 'requirement',
          bodySchemaVersion: 'requirement-contract-requirement/v2',
          bodyHash: MUST_BODY_HASH,
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-SOURCE-001'],
          },
          proofBindings: ['PROOF-SOURCE-001'],
        },
        [JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot]: {
          nodeType: 'requirement',
          bodySchemaVersion: 'requirement-contract-requirement/v2',
          bodyHash: ASSOCIATED_NEGATIVE_BODY_HASH,
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-SOURCE-002'],
          },
          proofBindings: ['PROOF-SOURCE-002'],
        },
        [JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot]: {
          nodeType: 'requirement',
          bodySchemaVersion: 'requirement-contract-requirement/v2',
          bodyHash: STANDALONE_NEGATIVE_BODY_HASH,
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-SOURCE-003'],
          },
          proofBindings: ['PROOF-SOURCE-003'],
        },
      },
      edges: {
        'EDGE-MUST-NEG-001': {
          edgeType: 'requirement_to_negative',
          fromRef: JUDGE_AUDIT_FIXTURE_IDS.mustRoot,
          fromHash: MUST_BODY_HASH,
          toRef: JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot,
          toHash: ASSOCIATED_NEGATIVE_BODY_HASH,
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['PROOF-SOURCE-001'],
          },
          proofBindings: ['PROOF-SOURCE-001'],
          edgeHash: HASH_D,
        },
      },
    },
    compactTraceMatrix: {
      acceptanceRootIds: [
        JUDGE_AUDIT_FIXTURE_IDS.firstAcceptanceRoot,
        JUDGE_AUDIT_FIXTURE_IDS.secondAcceptanceRoot,
        JUDGE_AUDIT_FIXTURE_IDS.standaloneAcceptanceRoot,
      ],
      acceptanceRootBindings: [
        {
          acceptanceRootRef: JUDGE_AUDIT_FIXTURE_IDS.firstAcceptanceRoot,
          decision: 'trace_bound',
          traceRefs: [JUDGE_AUDIT_FIXTURE_IDS.mustTrace],
          proofRefs: ['PROOF-SOURCE-001'],
        },
        {
          acceptanceRootRef: JUDGE_AUDIT_FIXTURE_IDS.secondAcceptanceRoot,
          decision: 'trace_bound',
          traceRefs: [JUDGE_AUDIT_FIXTURE_IDS.negativeTrace],
          proofRefs: ['PROOF-SOURCE-002'],
        },
        {
          acceptanceRootRef: JUDGE_AUDIT_FIXTURE_IDS.standaloneAcceptanceRoot,
          decision: 'trace_bound',
          traceRefs: [JUDGE_AUDIT_FIXTURE_IDS.standaloneTrace],
          proofRefs: ['PROOF-SOURCE-003'],
        },
      ],
      atomicRows: [
        {
          traceId: JUDGE_AUDIT_FIXTURE_IDS.mustTrace,
          requirementRef: JUDGE_AUDIT_FIXTURE_IDS.mustRoot,
          proofRefs: ['PROOF-SOURCE-001'],
          dimensions: {
            target: {
              state: 'bound',
              refs: ['TARGET-CHECKOUT-001'],
              proofRefs: ['PROOF-SOURCE-001'],
            },
            sequenceStep: {
              state: 'bound',
              refs: ['STEP-CHECKOUT-001'],
              proofRefs: ['PROOF-SOURCE-001'],
            },
            red: { state: 'bound', refs: ['RED-CHECKOUT-001'], proofRefs: ['PROOF-SOURCE-001'] },
            oracle: {
              state: 'bound',
              refs: ['ORACLE-CHECKOUT-001'],
              proofRefs: ['PROOF-SOURCE-001'],
            },
            command: { state: 'bound', refs: ['CMD-01'], proofRefs: ['PROOF-SOURCE-001'] },
            evidenceRequirement: {
              state: 'bound',
              refs: ['EVIDENCE-CHECKOUT-001'],
              proofRefs: ['PROOF-SOURCE-001'],
            },
          },
        },
        {
          traceId: JUDGE_AUDIT_FIXTURE_IDS.negativeTrace,
          requirementRef: JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot,
          proofRefs: ['PROOF-SOURCE-002'],
          dimensions: {
            target: {
              state: 'bound',
              refs: ['TARGET-CHECKOUT-002'],
              proofRefs: ['PROOF-SOURCE-002'],
            },
            red: { state: 'bound', refs: ['RED-CHECKOUT-002'], proofRefs: ['PROOF-SOURCE-002'] },
            oracle: {
              state: 'bound',
              refs: ['ORACLE-CHECKOUT-002'],
              proofRefs: ['PROOF-SOURCE-002'],
            },
            command: { state: 'bound', refs: ['CMD-02'], proofRefs: ['PROOF-SOURCE-002'] },
            evidenceRequirement: {
              state: 'bound',
              refs: ['EVIDENCE-CHECKOUT-002'],
              proofRefs: ['PROOF-SOURCE-002'],
            },
          },
        },
        {
          traceId: JUDGE_AUDIT_FIXTURE_IDS.standaloneTrace,
          requirementRef: JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot,
          proofRefs: ['PROOF-SOURCE-003'],
          dimensions: {
            target: {
              state: 'bound',
              refs: ['TARGET-CHECKOUT-003'],
              proofRefs: ['PROOF-SOURCE-003'],
            },
            sequenceStep: {
              state: 'bound',
              refs: ['STEP-CHECKOUT-003'],
              proofRefs: ['PROOF-SOURCE-003'],
            },
            red: { state: 'bound', refs: ['RED-CHECKOUT-003'], proofRefs: ['PROOF-SOURCE-003'] },
            oracle: {
              state: 'bound',
              refs: ['ORACLE-CHECKOUT-003'],
              proofRefs: ['PROOF-SOURCE-003'],
            },
            command: { state: 'bound', refs: ['CMD-03'], proofRefs: ['PROOF-SOURCE-003'] },
            evidenceRequirement: {
              state: 'bound',
              refs: ['EVIDENCE-CHECKOUT-003'],
              proofRefs: ['PROOF-SOURCE-003'],
            },
          },
        },
      ],
    },
    rootBindings: [
      {
        rootRef: JUDGE_AUDIT_FIXTURE_IDS.mustRoot,
        sourceSpanRefs: ['SOURCE-SPAN-MUST-001'],
        testRefs: ['TEST-CHECKOUT-001'],
        fixtureRefs: ['FIXTURE-CHECKOUT-001'],
        assertionRefs: ['ASSERTION-CHECKOUT-001'],
        changedPathRefs: ['PATH-CHECKOUT-001'],
        observedSequenceRefs: ['OBSERVED-SEQUENCE-CHECKOUT-001'],
        deterministicReportRefs: ['REPORT-CHECKOUT-001'],
        evidenceRefs: ['EVIDENCE-CHECKOUT-001'],
        proofRefs: ['PROOF-SOURCE-001'],
      },
      {
        rootRef: JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot,
        sourceSpanRefs: ['SOURCE-SPAN-NEG-001'],
        testRefs: ['TEST-CHECKOUT-002'],
        fixtureRefs: ['FIXTURE-CHECKOUT-002'],
        assertionRefs: ['ASSERTION-CHECKOUT-002'],
        changedPathRefs: ['PATH-CHECKOUT-002'],
        observedSequenceRefs: ['OBSERVED-SEQUENCE-CHECKOUT-002'],
        deterministicReportRefs: ['REPORT-CHECKOUT-002'],
        evidenceRefs: ['EVIDENCE-CHECKOUT-002'],
        proofRefs: ['PROOF-SOURCE-002'],
      },
      {
        rootRef: JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot,
        sourceSpanRefs: ['SOURCE-SPAN-NEG-002'],
        testRefs: ['TEST-CHECKOUT-003'],
        fixtureRefs: ['FIXTURE-CHECKOUT-003'],
        assertionRefs: ['ASSERTION-CHECKOUT-003'],
        changedPathRefs: ['PATH-CHECKOUT-003'],
        observedSequenceRefs: ['OBSERVED-SEQUENCE-CHECKOUT-003'],
        deterministicReportRefs: ['REPORT-CHECKOUT-003'],
        evidenceRefs: ['EVIDENCE-CHECKOUT-003'],
        proofRefs: ['PROOF-SOURCE-003'],
      },
      {
        rootRef: JUDGE_AUDIT_FIXTURE_IDS.firstAcceptanceRoot,
        sourceSpanRefs: ['SOURCE-SPAN-ACCEPTANCE-001'],
        testRefs: ['TEST-ACCEPTANCE-001'],
        fixtureRefs: ['FIXTURE-ACCEPTANCE-001'],
        assertionRefs: ['ASSERTION-ACCEPTANCE-001'],
        changedPathRefs: ['PATH-ACCEPTANCE-001'],
        observedSequenceRefs: ['OBSERVED-SEQUENCE-ACCEPTANCE-001'],
        deterministicReportRefs: ['REPORT-ACCEPTANCE-001'],
        evidenceRefs: ['EVIDENCE-ACCEPTANCE-001'],
        proofRefs: ['PROOF-ACCEPTANCE-001'],
      },
      {
        rootRef: JUDGE_AUDIT_FIXTURE_IDS.secondAcceptanceRoot,
        sourceSpanRefs: ['SOURCE-SPAN-ACCEPTANCE-002'],
        testRefs: ['TEST-ACCEPTANCE-002'],
        fixtureRefs: ['FIXTURE-ACCEPTANCE-002'],
        assertionRefs: ['ASSERTION-ACCEPTANCE-002'],
        changedPathRefs: ['PATH-ACCEPTANCE-002'],
        observedSequenceRefs: ['OBSERVED-SEQUENCE-ACCEPTANCE-002'],
        deterministicReportRefs: ['REPORT-ACCEPTANCE-002'],
        evidenceRefs: ['EVIDENCE-ACCEPTANCE-002'],
        proofRefs: ['PROOF-ACCEPTANCE-002'],
      },
      {
        rootRef: JUDGE_AUDIT_FIXTURE_IDS.standaloneAcceptanceRoot,
        sourceSpanRefs: ['SOURCE-SPAN-ACCEPTANCE-003'],
        testRefs: ['TEST-ACCEPTANCE-003'],
        fixtureRefs: ['FIXTURE-ACCEPTANCE-003'],
        assertionRefs: ['ASSERTION-ACCEPTANCE-003'],
        changedPathRefs: ['PATH-ACCEPTANCE-003'],
        observedSequenceRefs: ['OBSERVED-SEQUENCE-ACCEPTANCE-003'],
        deterministicReportRefs: ['REPORT-ACCEPTANCE-003'],
        evidenceRefs: ['EVIDENCE-ACCEPTANCE-003'],
        proofRefs: ['PROOF-ACCEPTANCE-003'],
      },
    ],
  } as const;
}
