import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsCloseoutRender,
  createRequirementsConfirmationRender,
  createRequirementsConfirmationRenderInput,
  validateRequirementsConfirmationRenderInput,
  validateRequirementsRenderSeparation,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-render-input';
import {
  evaluateRequirementsContractLintProfile,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-lint-profile-registry';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const semanticModelHash = sha256Stable({
  requirementSetId: 'requirements-confirmation-render',
  requirements: {
    summary: 'Bounded checkout retry.',
    retryLimit: 3,
  },
});

const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-confirmation-render-input-v2.schema.json'
);

function field(
  fieldRef: string,
  value: unknown,
  overrides: Record<string, unknown> = {}
) {
  return {
    fieldRef,
    value,
    semanticModelHash,
    authorityClass: 'source_grounded',
    provenanceRefs: [`source:${fieldRef}`],
    applicability: 'applicable',
    derivationRule: null,
    synthetic: false,
    ...overrides,
  };
}

function renderInput(unresolved = false) {
  return createRequirementsConfirmationRenderInput({
    requirementSetId: 'requirements-confirmation-render',
    semanticModelHash,
    requiredFieldRefs: ['requirements.summary', 'requirements.retryLimit'],
    fields: [
      field('requirements.summary', 'Bounded checkout retry.'),
      unresolved
        ? field('requirements.retryLimit', null, {
            authorityClass: 'none',
            applicability: 'unresolved',
            provenanceRefs: ['issue:retry-limit-unresolved'],
          })
        : field('requirements.retryLimit', 3, {
            authorityClass: 'human_confirmed',
            provenanceRefs: ['decision:retry-limit'],
          }),
    ],
  });
}

describe('requirements confirmation render input', () => {
  it('binds one provenance-complete record per required field to the semantic model hash', () => {
    const input = renderInput();
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(schemaPath, 'utf8')) as object
    );

    expect(validate(input), validate.errors?.map(String).join('\n')).toBe(true);
    expect(input.schemaVersion).toBe('requirements-confirmation-render-input/v2');
    expect(input.requiredRenderFieldCount).toBe(2);
    expect(input.coveredFieldCount).toBe(2);
    expect(input.fields.map((row) => row.fieldRef)).toEqual([
      'requirements.retryLimit',
      'requirements.summary',
    ]);
    expect(input.fields.every((row) => row.semanticModelHash === semanticModelHash)).toBe(true);
    expect(input.fields.every((row) => row.provenanceRefs.length > 0)).toBe(true);
  });

  it('allows unresolved fields only in draft lint and requires zero confirmation blockers', () => {
    const unresolved = renderInput(true);
    expect(evaluateRequirementsContractLintProfile(unresolved, 'draft')).toMatchObject({
      decision: 'pass',
      profile: 'draft',
      metrics: {
        blockingUnresolvedCount: 1,
        syntheticFieldCount: 0,
        authorityInvalidCount: 0,
        coveredFieldCount: 2,
        requiredRenderFieldCount: 2,
      },
    });
    expect(
      evaluateRequirementsContractLintProfile(unresolved, 'confirmation-ready')
    ).toMatchObject({
      decision: 'block',
      profile: 'confirmation-ready',
      metrics: { blockingUnresolvedCount: 1 },
    });

    const resolved = renderInput();
    expect(evaluateRequirementsContractLintProfile(resolved, 'confirmation-ready')).toMatchObject({
      decision: 'pass',
      metrics: {
        blockingUnresolvedCount: 0,
        syntheticFieldCount: 0,
        authorityInvalidCount: 0,
        coveredFieldCount: 2,
        requiredRenderFieldCount: 2,
      },
    });
  });

  it('keeps confirmation authorization and closeout execution evidence non-authoritative', () => {
    const input = renderInput();
    const confirmation = createRequirementsConfirmationRender(input);
    const closeout = createRequirementsCloseoutRender({
      requirementSetId: input.requirementSetId,
      semanticModelHash: input.semanticModelHash,
      executionEvidenceRefs: [
        {
          path: 'command-runs/checkout-retry.json',
          hash: sha256Stable('checkout-retry-command-run'),
        },
      ],
    });

    expect(confirmation).toMatchObject({
      authority: 'none',
      proofRole: 'semantic_authorization_projection',
      semanticModelHash,
    });
    expect(closeout).toMatchObject({
      authority: 'none',
      proofRole: 'execution_evidence_projection',
      semanticModelHash,
    });
    expect(validateRequirementsRenderSeparation(confirmation, closeout)).toBe(true);
    expect(JSON.stringify(confirmation)).not.toContain('executionEvidenceRefs');
    expect(JSON.stringify(closeout)).not.toContain('fields');
    expect(validateRequirementsRenderSeparation(confirmation, {
      ...closeout,
      semanticModelHash: sha256Stable('stale-model'),
    })).toBe(false);
    expect(validateRequirementsRenderSeparation({
      ...confirmation,
      authority: 'semantic_authority',
    } as never, closeout)).toBe(false);

    const { renderInputHash: _renderInputHash, ...renderInputPayload } = input;
    const forgedRenderInputPayload = {
      ...renderInputPayload,
      executionEvidenceRefs: [],
    };
    expect(validateRequirementsConfirmationRenderInput({
      ...forgedRenderInputPayload,
      renderInputHash: sha256Stable(forgedRenderInputPayload),
    })).toBe(false);

    const { renderHash: _closeoutHash, ...closeoutPayload } = closeout;
    const forgedCloseoutPayload = {
      ...closeoutPayload,
      fields: input.fields,
    };
    expect(validateRequirementsRenderSeparation(confirmation, {
      ...forgedCloseoutPayload,
      renderHash: sha256Stable(forgedCloseoutPayload),
    } as never)).toBe(false);
  });
});
