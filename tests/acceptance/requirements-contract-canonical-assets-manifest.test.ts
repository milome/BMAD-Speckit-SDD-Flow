import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

interface CanonicalAssetsManifest {
  schemaVersion: string;
  owner: {
    path: string;
    hash: string;
  };
  manifestHash: string;
  assets: Array<{
    assetId: string;
    version: string;
    path: string;
    sha256: string;
    role: string;
    assetKind:
      | 'schema'
      | 'parser'
      | 'registry'
      | 'facade'
      | 'template'
      | 'renderer'
      | 'profile'
      | 'resolver'
      | 'adapter'
      | 'producer'
      | 'validator'
      | 'projector'
      | 'reference'
      | 'codec';
    symbolRef?: string;
    authorityClass:
      | 'deterministic_contract'
      | 'product_background'
      | 'implementation_semantic_authority'
      | 'execution_contract_authority'
      | 'none';
  }>;
  authority: 'none';
}

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(
  ROOT,
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-canonical-assets-manifest.json'
);
const SCHEMA_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-canonical-assets-manifest.schema.json'
);
const REQUIRED_DSA16_ASSETS = [
  ['judge_runtime_schema', 'schemas/requirements-contract-judge-runtime.schema.json', 'schema'],
  [
    'judge_credentials_schema',
    'schemas/requirements-contract-judge-credentials.schema.json',
    'schema',
  ],
  [
    'normalized_judge_response_schema',
    'schemas/requirements-contract-normalized-judge-response.schema.json',
    'schema',
  ],
  [
    'judge_capability_receipt_schema',
    'schemas/requirements-contract-judge-capability-receipt.schema.json',
    'schema',
  ],
  [
    'judge_selection_receipt_schema',
    'schemas/requirements-contract-judge-selection-receipt.schema.json',
    'schema',
  ],
  [
    'judge_provider_registry_schema',
    'schemas/requirements-contract-judge-provider-registry.schema.json',
    'schema',
  ],
  [
    'judge_challenge_tests_schema',
    'schemas/requirements-contract-judge-challenge-tests.schema.json',
    'schema',
  ],
  ['judge_response_schema', 'schemas/requirements-contract-judge-response.schema.json', 'schema'],
  [
    'judge_runtime_security_parity_schema',
    'schemas/requirements-contract-judge-runtime-security-parity.schema.json',
    'schema',
  ],
  [
    'judge_provider_smoke_input_schema',
    'schemas/requirements-contract-judge-provider-smoke-input.schema.json',
    'schema',
  ],
  [
    'judge_credential_initialization_input_schema',
    'schemas/requirements-contract-judge-credential-initialization-input.schema.json',
    'schema',
  ],
  [
    'judge_credential_initialization_receipt_schema',
    'schemas/requirements-contract-judge-credential-initialization-receipt.schema.json',
    'schema',
  ],
  [
    'judge_audit_unit_projection_input_schema',
    'schemas/requirements-contract-judge-audit-unit-projection-input.schema.json',
    'schema',
  ],
  [
    'judge_audit_unit_set_schema',
    'schemas/requirements-contract-judge-audit-unit-set.schema.json',
    'schema',
  ],
  [
    'judge_provider_registry_projection',
    '_bmad/shared/requirements-contract/requirements-contract-judge-provider-registry.json',
    'registry',
  ],
  [
    'judge_credential_resolver',
    'scripts/requirements-contract-judge-credential-resolver.ts',
    'resolver',
  ],
  [
    'judge_provider_registry',
    'scripts/requirements-contract-judge-provider-registry.ts',
    'registry',
  ],
  [
    'openai_compatible_judge_adapter',
    'scripts/requirements-contract-openai-compatible-judge-adapter.ts',
    'adapter',
  ],
  [
    'anthropic_compatible_judge_adapter',
    'scripts/requirements-contract-anthropic-compatible-judge-adapter.ts',
    'adapter',
  ],
  ['judge_provider_smoke', 'scripts/requirements-contract-judge-provider-smoke.ts', 'producer'],
  [
    'judge_credential_initializer',
    'scripts/requirements-contract-judge-credential-initializer.ts',
    'producer',
  ],
  [
    'judge_audit_unit_projector',
    'scripts/requirements-contract-judge-audit-unit-projector.ts',
    'producer',
  ],
  [
    'judge_runtime_bindings_resolver',
    'scripts/requirements-contract-judge-runtime-bindings.ts',
    'resolver',
  ],
  ['reverse_audit_validator', 'scripts/requirements-contract-reverse-audit.ts', 'validator'],
] as const;
const SOURCE_AUTHORITY_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority/';
const REQUIRED_AMEND13_ASSETS = [
  [
    'discovery_envelope_template',
    '_bmad/shared/requirements-contract/templates/discovery-prd-envelope-template.md',
    'template',
  ],
  [
    'product_prd_template',
    '_bmad/shared/requirements-contract/templates/product-prd-template.md',
    'template',
  ],
  [
    'product_prd_renderer',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-prd-render-write-seam.ts`,
    'renderer',
    'renderProductPrd',
  ],
  [
    'source_prd_template',
    `${SOURCE_AUTHORITY_ROOT}templates/requirements-contract-source-prd-template.md`,
    'template',
  ],
  [
    'source_prd_renderer',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-prd-render-write-seam.ts`,
    'renderer',
    'renderCanonicalRequirementSourcePrd',
  ],
  [
    'implementation_confirmation_schema',
    `${SOURCE_AUTHORITY_ROOT}schemas/requirements-contract-implementation-confirmation.schema.json`,
    'schema',
  ],
  [
    'implementation_confirmation_projector',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-implementation-confirmation-projector.ts`,
    'projector',
    'projectRequirementsContractImplementationConfirmation',
  ],
  [
    'implementation_confirmation_validator',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-implementation-confirmation-validator.ts`,
    'validator',
    'validateRequirementsContractImplementationConfirmation',
  ],
  [
    'implementation_confirmation_codec',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-implementation-confirmation-codec.ts`,
    'codec',
  ],
  [
    'implementation_confirmation_reference',
    '_bmad/skills/requirements-contract-authoring/references/implementation-confirmation-reference.md',
    'reference',
  ],
  [
    'confirmation_render_input_schema',
    `${SOURCE_AUTHORITY_ROOT}schemas/requirements-confirmation-render-input-v2.schema.json`,
    'schema',
  ],
  [
    'confirmation_render_input_projector',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-confirmation-render-input.ts`,
    'projector',
    'createRequirementsConfirmationRenderInput',
  ],
  [
    'confirmation_renderer',
    '_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
    'renderer',
  ],
  [
    'confirmation_renderer_specification',
    '_bmad/skills/requirements-contract-authoring/references/html-confirmation-renderer-spec.md',
    'reference',
  ],
  [
    'goal_contract_template',
    '_bmad/shared/goal-contract/goal-execution-contract-template.md',
    'template',
  ],
  [
    'goal_contract_profile',
    '_bmad/shared/goal-contract/goal-contract-profile.json',
    'profile',
  ],
  [
    'goal_contract_renderer',
    '_bmad/shared/goal-contract/scripts/render-goal-contract.js',
    'renderer',
  ],
  [
    'closeout_packet_schema',
    `${SOURCE_AUTHORITY_ROOT}schemas/requirements-contract-terminal-closeout-packet.schema.json`,
    'schema',
  ],
  [
    'closeout_renderer',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-terminal-closeout.ts`,
    'renderer',
    'renderRequirementsContractTerminalCloseout',
  ],
  [
    'closeout_readback_receipt_schema',
    `${SOURCE_AUTHORITY_ROOT}schemas/requirements-contract-artifact-readback-receipt.schema.json`,
    'schema',
  ],
  [
    'closeout_final_response_projector',
    `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-terminal-closeout.ts`,
    'projector',
    'projectRequirementsContractTerminalCloseout',
  ],
] as const;

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract canonical assets manifest', () => {
  it('publishes one tracked schema-valid manifest without evidence-path authority', () => {
    expect(existsSync(MANIFEST_PATH), 'canonical assets manifest is missing').toBe(true);
    expect(existsSync(SCHEMA_PATH), 'canonical assets schema is missing').toBe(true);
    if (!existsSync(MANIFEST_PATH) || !existsSync(SCHEMA_PATH)) return;

    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as CanonicalAssetsManifest;
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(manifest), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain('docs/plans/evidence');
    expect(existsSync(path.resolve(ROOT, manifest.owner.path))).toBe(true);
    expect(manifest.owner.hash).toBe(fileHash(path.resolve(ROOT, manifest.owner.path)));
    expect(manifest.manifestHash).toBe(
      sha256Stable({
        schemaVersion: manifest.schemaVersion,
        assets: manifest.assets,
      })
    );
  });

  it('binds every canonical role to one existing immutable asset path and hash', () => {
    expect(existsSync(MANIFEST_PATH), 'canonical assets manifest is missing').toBe(true);
    if (!existsSync(MANIFEST_PATH)) return;

    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as CanonicalAssetsManifest;
    expect(new Set(manifest.assets.map((asset) => asset.assetId)).size).toBe(
      manifest.assets.length
    );
    expect(new Set(manifest.assets.map((asset) => asset.role)).size).toBe(manifest.assets.length);
    expect(
      new Set(
        manifest.assets.map(
          (asset) => `${asset.path}#${asset.symbolRef ?? '<whole-file>'}`
        )
      ).size
    ).toBe(manifest.assets.length);
    expect(manifest.authority).toBe('none');

    for (const asset of manifest.assets) {
      const resolved = path.resolve(ROOT, asset.path);
      expect(existsSync(resolved), `canonical asset is missing: ${asset.path}`).toBe(true);
      if (existsSync(resolved)) expect(asset.sha256).toBe(fileHash(resolved));
    }
  });

  it('registers every implemented DSA-16 Judge schema and production owner', () => {
    expect(existsSync(MANIFEST_PATH), 'canonical assets manifest is missing').toBe(true);
    if (!existsSync(MANIFEST_PATH)) return;

    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as CanonicalAssetsManifest;
    const assets = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));

    for (const [assetId, relativePath, assetKind] of REQUIRED_DSA16_ASSETS) {
      expect(assets.get(assetId)).toMatchObject({
        assetId,
        path: relativePath.startsWith('_bmad/')
          ? relativePath
          : `${SOURCE_AUTHORITY_ROOT}${relativePath}`,
        assetKind,
        authorityClass: 'deterministic_contract',
      });
    }
  });

  it('registers the AMEND-13 compositions without transitional template authority', () => {
    expect(existsSync(MANIFEST_PATH), 'canonical assets manifest is missing').toBe(true);
    if (!existsSync(MANIFEST_PATH)) return;

    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as CanonicalAssetsManifest;
    const assets = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));

    for (const [assetId, assetPath, assetKind, symbolRef] of REQUIRED_AMEND13_ASSETS) {
      expect(assets.get(assetId)).toMatchObject({
        assetId,
        role: assetId,
        path: assetPath,
        assetKind,
        ...(symbolRef ? { symbolRef } : {}),
      });
    }
    expect(
      manifest.assets.some(
        (asset) =>
          asset.path ===
          '_bmad/skills/requirements-contract-authoring/references/contract-template.md'
      )
    ).toBe(false);

    const sharedPathAssets = manifest.assets.filter(
      (asset) =>
        asset.path ===
        `${SOURCE_AUTHORITY_ROOT}scripts/requirements-contract-terminal-closeout.ts`
    );
    expect(sharedPathAssets.map((asset) => asset.symbolRef).sort()).toEqual([
      'projectRequirementsContractTerminalCloseout',
      'renderRequirementsContractTerminalCloseout',
    ]);
  });
});
