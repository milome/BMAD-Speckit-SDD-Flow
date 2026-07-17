import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'5'.repeat(64)}`;
const classifierPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-artifact-role-classifier.ts'
);
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-artifact-role.schema.json'
);

async function classifier() {
  return import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-artifact-role-classifier');
}

function schemaValidator() {
  return new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(schemaPath, 'utf8'))
  );
}

it('publishes the inactive artifact-role classifier and schema boundaries', () => {
  expect(existsSync(classifierPath)).toBe(true);
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(classifierPath) && existsSync(schemaPath))(
  'requirements-contract artifact-role classification',
  () => {
    it('classifies an explicitly requested Product PRD without implementation authority', async () => {
      const { classifyRequirementsContractArtifactRole } = await classifier();
      const result = classifyRequirementsContractArtifactRole({
        requestedArtifactRole: 'product_prd',
      });

      expect(result.ok).toBe(true);
      expect(result.classification).toEqual(
        expect.objectContaining({
          artifactRole: 'product_prd',
          activationState: 'inactive_schema_boundary',
          outputPolicy: expect.objectContaining({
            authorityClass: 'product_background',
            rendererRef: 'registered_product_prd_renderer',
            implementationConfirmationPolicy: 'forbidden',
            finalImplementationAuthority: 'none',
          }),
        })
      );
      const validate = schemaValidator();
      expect(validate(result.classification), JSON.stringify(validate.errors)).toBe(true);
    });

    it('accepts registered workflow and immutable Decision Receipt authority', async () => {
      const { classifyRequirementsContractArtifactRole } = await classifier();
      const requirementSource = classifyRequirementsContractArtifactRole({
        registeredWorkflowAuthority: {
          artifactRole: 'requirement_source_prd',
          ref: '_bmad/workflows/create-requirement-source-prd.yaml',
          hash: HASH,
        },
      });
      const discovery = classifyRequirementsContractArtifactRole({
        decisionReceiptAuthority: {
          artifactRole: 'discovery_envelope',
          ref: '_bmad-output/runtime/decisions/artifact-role.json',
          hash: HASH,
        },
      });

      expect(requirementSource.classification?.outputPolicy).toEqual(
        expect.objectContaining({
          authorityClass: 'implementation_semantic_authority',
          rendererRef: 'canonical_source_prd_renderer',
          implementationConfirmationPolicy: 'required',
          stableRequirementSetIdPolicy: 'required',
          requirementRecordRegistrationPolicy: 'required',
          finalImplementationAuthority: 'source_authority',
        })
      );
      expect(discovery.classification?.outputPolicy).toEqual(
        expect.objectContaining({
          authorityClass: 'none',
          rendererRef: 'discovery_envelope_renderer',
          finalImplementationAuthority: 'none',
        })
      );
    });

    it('allows multiple explicit authorities only when they select the same role', async () => {
      const { classifyRequirementsContractArtifactRole } = await classifier();
      const result = classifyRequirementsContractArtifactRole({
        requestedArtifactRole: 'requirement_source_prd',
        registeredWorkflowAuthority: {
          artifactRole: 'requirement_source_prd',
          ref: '_bmad/workflows/create-requirement-source-prd.yaml',
          hash: HASH,
        },
      });

      expect(result.ok).toBe(true);
      expect(result.classification?.classificationAuthority.sources).toHaveLength(2);
    });

    it('rejects filename, branch, heading, mtime, existing-file, and confidence inference', async () => {
      const { classifyRequirementsContractArtifactRole } = await classifier();
      const result = classifyRequirementsContractArtifactRole({
        heuristicSignals: {
          filename: 'prd.md',
          basename: 'prd',
          branch: 'requirements/new-checkout',
          headingKeywords: ['Product Requirements'],
          modifiedAt: '2026-07-13T00:00:00.000Z',
          existingPrdPath: '_bmad-output/planning-artifacts/dev/prd.md',
          modelConfidence: 1,
        },
      });

      expect(result.ok).toBe(false);
      expect(result.classification).toBeUndefined();
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'artifact_role_authority_missing' })
      );
    });

    it('rejects conflicting authority and unsupported roles without guessing', async () => {
      const { classifyRequirementsContractArtifactRole } = await classifier();
      const conflict = classifyRequirementsContractArtifactRole({
        requestedArtifactRole: 'product_prd',
        registeredWorkflowAuthority: {
          artifactRole: 'requirement_source_prd',
          ref: '_bmad/workflows/create-requirement-source-prd.yaml',
          hash: HASH,
        },
      });
      const invalid = classifyRequirementsContractArtifactRole({
        requestedArtifactRole: 'prd_from_filename' as never,
      });

      expect(conflict.issues).toContainEqual(
        expect.objectContaining({ code: 'artifact_role_authority_conflict' })
      );
      expect(invalid.issues).toContainEqual(
        expect.objectContaining({ code: 'artifact_role_invalid' })
      );
    });
  }
);
