import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canonicalObjectHash,
  confirmationProjectionHash,
  distManifestHash,
  installedRuntimeHash,
  normalizedTextHash,
  projectionSetHash,
  requirementsContractHashDomainRegistry,
  semanticModelHash,
  sourceAuthorityHash,
  sourceBytesHash,
  sourceDocumentHash,
  tarballBytesHash,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

const confirmation = {
  status: 'confirmed',
  confirmedAt: '2026-07-17T00:00:00.000Z',
  confirmedBy: 'user',
  sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
  implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
  confirmationProjectionHash: `sha256:${'3'.repeat(64)}`,
  reconfirmationRequest: null,
  confirmationRender: { html: '<section>confirmed</section>' },
  bundleBinding: { path: 'bundle-manifest.json', hash: `sha256:${'4'.repeat(64)}` },
  acceptanceBinding: { path: 'acceptance-contracts.json', hash: `sha256:${'5'.repeat(64)}` },
};

const source = {
  title: 'Requirement source',
  requirements: [{ id: 'MUST-FR-001', text: 'Preserve semantics.' }],
  implementationConfirmation: confirmation,
};

describe('requirements-contract-hash-domains/v2', () => {
  it('freezes field-specific versioned hash recipes across source and release surfaces', () => {
    expect(requirementsContractHashDomainRegistry()).toEqual({
      schemaVersion: 'requirements-contract-hash-domains/v2',
      sourceAuthority: 'requirements-source-authority/v1',
      confirmationProjection: 'requirements-confirmation-projection/v1',
      sourceDocument: 'requirements-source-document/v1',
      recipes: {
        sourceBytesHash: {
          domain: 'requirements-source-bytes/v1',
          recipe: 'sha256_raw_bytes',
        },
        normalizedTextHash: {
          domain: 'requirements-normalized-text/v1',
          recipe: 'strip_utf8_bom_lf_nfc_then_sha256_utf8',
        },
        canonicalObjectHash: {
          domain: 'requirements-canonical-object/v1',
          recipe: 'recursive_string_lf_nfc_sorted_json_then_sha256_utf8',
        },
        semanticModelHash: {
          domain: 'requirements-semantic-model/v1',
          recipe: 'canonical_object_hash',
        },
        projectionSetHash: {
          domain: 'requirements-projection-set/v1',
          recipe: 'canonical_object_hash',
        },
        distManifestHash: {
          domain: 'bmad-speckit-dist-manifest/v1',
          recipe: 'canonical_object_hash',
        },
        tarballBytesHash: {
          domain: 'bmad-speckit-tarball-bytes/v1',
          recipe: 'sha256_raw_bytes',
        },
        installedRuntimeHash: {
          domain: 'bmad-speckit-installed-runtime/v1',
          recipe: 'canonical_object_hash',
        },
      },
    });
  });

  it('separates raw bytes from normalized text and canonical object recipes', () => {
    const decomposedCrLf = '\uFEFFCafe\u0301\r\n';
    const composedLf = 'Caf\u00E9\n';

    expect(sourceBytesHash(Buffer.from(decomposedCrLf, 'utf8'))).toBe(
      sha256(decomposedCrLf)
    );
    expect(sourceBytesHash(Buffer.from(decomposedCrLf, 'utf8'))).not.toBe(
      sourceBytesHash(Buffer.from(composedLf, 'utf8'))
    );
    expect(normalizedTextHash(decomposedCrLf)).toBe(sha256(composedLf));
    expect(normalizedTextHash(decomposedCrLf)).toBe(normalizedTextHash(composedLf));
    expect(
      canonicalObjectHash({
        z: 'Cafe\u0301\r\n',
        a: { second: 2, first: 1 },
      })
    ).toBe(
      canonicalObjectHash({
        a: { first: 1, second: 2 },
        z: 'Caf\u00E9\n',
      })
    );
  });

  it('binds semantic, projection, dist, tarball, and installed fields to explicit recipes', () => {
    const payload = { z: 'last', a: 'first' };
    const canonicalHash = sha256('{"a":"first","z":"last"}');
    const bytes = Buffer.from('runtime-bytes\r\n', 'utf8');

    expect(semanticModelHash(payload)).toBe(canonicalHash);
    expect(projectionSetHash(payload)).toBe(canonicalHash);
    expect(distManifestHash(payload)).toBe(canonicalHash);
    expect(tarballBytesHash(bytes)).toBe(
      `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    );
    expect(installedRuntimeHash(payload)).toBe(canonicalHash);

    const recipes = requirementsContractHashDomainRegistry().recipes;
    expect(new Set([
      recipes.semanticModelHash.domain,
      recipes.projectionSetHash.domain,
      recipes.distManifestHash.domain,
      recipes.tarballBytesHash.domain,
      recipes.installedRuntimeHash.domain,
    ]).size).toBe(5);
  });

  it('excludes the complete confirmation block from source authority', () => {
    const expectedPayload =
      '{"requirements":[{"id":"MUST-FR-001","text":"Preserve semantics."}],"title":"Requirement source"}\n';

    expect(sourceAuthorityHash(source)).toBe(
      sha256(`requirements-source-authority/v1\n${expectedPayload}`)
    );
    expect(
      sourceAuthorityHash({
        ...source,
        implementationConfirmation: { ...confirmation, status: 'blocked' },
      })
    ).toBe(sourceAuthorityHash(source));
  });

  it('excludes only confirmation bookkeeping while preserving Bundle and Acceptance refs', () => {
    const changedBookkeeping = {
      ...confirmation,
      status: 'blocked',
      confirmedAt: '2026-07-17T01:00:00.000Z',
      sourceDocumentHash: `sha256:${'9'.repeat(64)}`,
      confirmationRender: { html: '<section>blocked</section>' },
    };
    const changedBundle = {
      ...confirmation,
      bundleBinding: { ...confirmation.bundleBinding, hash: `sha256:${'8'.repeat(64)}` },
    };

    expect(confirmationProjectionHash(changedBookkeeping)).toBe(
      confirmationProjectionHash(confirmation)
    );
    expect(confirmationProjectionHash(changedBundle)).not.toBe(
      confirmationProjectionHash(confirmation)
    );
  });

  it('excludes only sourceDocumentHash from the complete source document domain', () => {
    const changedStoredConfirmation = {
      ...source,
      implementationConfirmation: {
        ...confirmation,
        status: 'blocked',
      },
    };
    const changedSelfHash = {
      ...source,
      sourceDocumentHash: `sha256:${'f'.repeat(64)}`,
    };

    expect(sourceDocumentHash(changedStoredConfirmation)).not.toBe(sourceDocumentHash(source));
    expect(sourceDocumentHash(changedSelfHash)).toBe(sourceDocumentHash(source));
  });

  it('routes production semantic and projection hashing through the canonical recipes', () => {
    const root = process.cwd();
    const orchestration = readFileSync(
      path.join(
        root,
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
      ),
      'utf8'
    );
    const semanticPipeline = readFileSync(
      path.join(
        root,
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline.ts'
      ),
      'utf8'
    );

    expect(orchestration).toContain(
      'sourceDocumentHashFor as sourceDocumentHashForContract'
    );
    expect(orchestration).toContain(
      'implementationConfirmationHashFor as implementationConfirmationHashForContract'
    );
    expect(orchestration).toContain('projectionSetHash as projectionSetHashForContract');
    expect(orchestration).not.toContain(
      'return sha256Text(sourceText.replace(blockText, normalizedBlock));'
    );
    expect(semanticPipeline).toContain(
      'semanticModelHash as semanticModelHashForContract'
    );
    expect(semanticPipeline).not.toContain(
      'semanticModelHash: sha256Stable(canonicalModelPreimage(preimage))'
    );
  });
});
