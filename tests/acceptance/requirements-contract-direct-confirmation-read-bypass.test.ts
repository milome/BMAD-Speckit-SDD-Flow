import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { auditRequirementsContractDirectConfirmationReads } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-direct-confirmation-read-bypass-audit';

describe('requirements contract direct confirmation read bypass audit', () => {
  it('accepts production consumers that read only through RequirementsContractReadFacade', () => {
    const result = auditRequirementsContractDirectConfirmationReads({
      files: [
        {
          path: `src/consumer-${randomUUID()}.ts`,
          source:
            "import { readRequirementsContract } from './requirements-contract-read-facade';\n" +
            'export const read = readRequirementsContract;\n',
        },
      ],
    });

    expect(result.decision).toBe('pass');
    expect(result.findings).toEqual([]);
  });

  it('blocks physical confirmation fields, direct logical-model objects, and Bundle paths', () => {
    const physicalFieldPath = `src/legacy-reader-${randomUUID()}.ts`;
    const logicalModelPath = `src/logical-reader-${randomUUID()}.ts`;
    const bundlePath = `src/bundle-reader-${randomUUID()}.ts`;
    const result = auditRequirementsContractDirectConfirmationReads({
      files: [
        {
          path: physicalFieldPath,
          source: 'const rows = confirmation.currentTargetMap;\n',
        },
        {
          path: logicalModelPath,
          source: 'const bodies = logicalModel.semanticBodies;\n',
        },
        {
          path: bundlePath,
          source:
            "const physical = '_bmad-output/runtime/requirement-records/x/authoring/revisions/r/semantic-ir.json';\n",
        },
      ],
    });
    const findingsByPath = Object.fromEntries(
      result.findings.map((finding) => [finding.path, finding.code])
    );

    expect(result.decision).toBe('block');
    expect(findingsByPath).toMatchObject({
      [physicalFieldPath]: 'direct_legacy_confirmation_field_read',
      [logicalModelPath]: 'direct_v2_logical_model_read',
      [bundlePath]: 'direct_physical_bundle_path_read',
    });
  });
});
