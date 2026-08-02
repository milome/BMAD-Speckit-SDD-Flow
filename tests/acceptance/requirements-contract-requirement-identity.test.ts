import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateRequirementSourceIdentity,
  validateRequirementSourceIdentitySet,
  type RequirementSourceIdentity,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile';

const HASH = `sha256:${'b'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-source-identity.schema.json'
);

function identity(overrides: Partial<RequirementSourceIdentity> = {}): RequirementSourceIdentity {
  return {
    schemaVersion: 'requirements-contract-source-identity/v1',
    recordId: 'REQ-ORDER-FLOW',
    requirementSetId: 'order-flow',
    branch: 'dev',
    entrySource: 'create_prd_session',
    sourceKind: 'requirement_source_prd',
    sourcePath: '_bmad-output/planning-artifacts/dev/requirements/order-flow/prd.md',
    sourceHash: HASH,
    identityAuthority: {
      kind: 'discovery_session_receipt',
      ref: '_bmad-output/runtime/discovery/order-flow/session-receipt.json',
      hash: HASH,
    },
    ...overrides,
  };
}

describe('stable requirement source identity', () => {
  it('validates the source identity schema and preserves requirementSetId across path changes', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const before = identity();
    const after = identity({
      branch: 'release',
      sourcePath: '_bmad-output/planning-artifacts/release/requirements/order-flow/prd.md',
    });

    expect(validate(before), JSON.stringify(validate.errors)).toBe(true);
    expect(validateRequirementSourceIdentity(before)).toEqual({ ok: true, issues: [] });
    expect(validateRequirementSourceIdentity(after)).toEqual({ ok: true, issues: [] });
    expect(after.requirementSetId).toBe(before.requirementSetId);
  });

  it('rejects basename authority, duplicate requirement sets, and authoritative path collisions', () => {
    const basename = identity({
      identityAuthority: {
        kind: 'basename',
        ref: 'prd.md',
        hash: HASH,
      } as never,
    });
    const duplicate = identity({ recordId: 'REQ-ORDER-FLOW-DUPLICATE' });
    const pathCollision = identity({
      recordId: 'REQ-PAYMENT-FLOW',
      requirementSetId: 'payment-flow',
    });

    const result = validateRequirementSourceIdentitySet([
      identity(),
      basename,
      duplicate,
      pathCollision,
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'basename_derived_identity',
        'duplicate_requirement_set_identity',
        'source_path_collision',
      ])
    );
  });
});
