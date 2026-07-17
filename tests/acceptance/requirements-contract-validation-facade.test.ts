import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import {
  type RequirementContractModelV2,
  type RequirementContractRequirementV2,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateRequirementsContractDocument } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-validation-facade';

const validationFacadePath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-validation-facade.ts'
);

it('publishes the canonical requirements-contract validation facade production entry', () => {
  expect(existsSync(validationFacadePath)).toBe(true);
});

function unresolvedModel(): RequirementContractModelV2 {
  const requirement: RequirementContractRequirementV2 = {
    id: 'MUST-FR-001',
    kind: 'functional',
    schemaVersion: 'requirement-contract-requirement/v2',
    text: 'The source-bound operation remains unresolved until authority supplies its actor.',
    source: {
      sourcePath: 'docs/requirements/source.md',
      sourceSpan: { startLine: 4, endLine: 4 },
      sourceHash: `sha256:${'a'.repeat(64)}`,
      sourceRequirementId: 'FR-001',
      headingPath: ['Requirements'],
    },
    semantics: {
      actor: null,
      trigger: 'the source-bound operation is requested',
      preconditions: [],
      action: 'perform the source-bound operation',
      postconditions: [],
      invariants: [],
      thresholds: [],
    },
    authority: {
      authorityState: 'unresolved',
      derivation: 'source_field_missing',
      decisionReceiptRef: null,
    },
    applicability: { state: 'unresolved', reasonCode: 'actor_missing' },
    unresolved: [
      {
        id: 'UNRESOLVED-MUST-FR-001-01',
        field: 'semantics.actor',
        question: 'Which source-authorized actor performs this operation?',
        blocking: true,
      },
    ],
    verification: {
      method: 'behavior_test',
      oracleRef: null,
      commandRefs: [],
      expectedObservationRefs: [],
    },
    bindings: { targetRefs: [], artifactRefs: [], traceEdgeRefs: [] },
  };
  const bodyHash = sha256Stable(requirement);
  const preimage: Omit<RequirementContractModelV2, 'semanticModelHash'> = {
    schemaVersion: 'requirement-contract-model/v2',
    activationState: 'inactive_schema_boundary',
    recordId: 'REQ-VALIDATION-FACADE',
    requirementSetId: 'validation-facade',
    sourceAuthorityHash: `sha256:${'b'.repeat(64)}`,
    edgeTypeRegistryHash: sha256Stable([]),
    authority: 'none',
    semanticBodies: { [bodyHash]: { ...requirement } },
    nodes: {
      [requirement.id]: {
        nodeType: 'requirement',
        bodySchemaVersion: requirement.schemaVersion,
        bodyHash,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofBindings: ['PROOF-SOURCE-001'],
      },
    },
    edges: {},
  };
  return { ...preimage, semanticModelHash: sha256Stable(preimage) };
}

it('permits blocking unresolved decisions only in draft mode', () => {
  const model = unresolvedModel();

  expect(validateRequirementsContractDocument(model, 'draft')).toMatchObject({
    ok: true,
    decision: 'pass',
    mode: 'draft',
    metrics: { blockingUnresolvedCount: 1 },
  });
  const confirmationReady = validateRequirementsContractDocument(model, 'confirmation-ready');
  expect(confirmationReady).toMatchObject({
    ok: false,
    decision: 'block',
    mode: 'confirmation-ready',
    metrics: { blockingUnresolvedCount: 1 },
  });
  expect(confirmationReady.issues.map((issue) => issue.code)).toContain(
    'blocking_unresolved_decision'
  );
});
