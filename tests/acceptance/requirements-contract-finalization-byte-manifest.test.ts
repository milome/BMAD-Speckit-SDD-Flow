import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractFinalizationByteManifest,
  validateRequirementsContractFinalizationByteManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-finalization-byte-manifest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

describe('requirements contract finalization byte manifest', () => {
  it('seals origin closures, command identities, and final bytes into a stable manifest', () => {
    const manifest = compileRequirementsContractFinalizationByteManifest({
      candidateId: 'candidate-a',
      originClosureHashes: [hash('origin-b'), hash('origin-a')],
      mandatoryCommandIdentityHashes: [hash('command-a')],
      sealedFileHashes: [hash('file-b'), hash('file-a')],
    });
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-finalization-byte-manifest.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(manifest), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(manifest.originClosureHashes).toEqual([hash('origin-a'), hash('origin-b')]);
    expect(manifest.sealedFileHashes).toEqual(
      [hash('file-a'), hash('file-b')].sort((left, right) => left.localeCompare(right))
    );
    expect(
      validateRequirementsContractFinalizationByteManifest(manifest, {
        candidateId: 'candidate-a',
        originClosureHashes: manifest.originClosureHashes,
        mandatoryCommandIdentityHashes: manifest.mandatoryCommandIdentityHashes,
        sealedFileHashes: manifest.sealedFileHashes,
        finalizationByteManifestHash: manifest.finalizationByteManifestHash,
      })
    ).toBe(manifest);
  });

  it('rejects missing seal evidence and stale post-seal authority', () => {
    expect(() =>
      compileRequirementsContractFinalizationByteManifest({
        candidateId: 'candidate-a',
        originClosureHashes: [hash('origin-a')],
        mandatoryCommandIdentityHashes: [hash('command-a')],
        sealedFileHashes: [],
      })
    ).toThrow('finalization_byte_manifest_seal_missing');

    const manifest = compileRequirementsContractFinalizationByteManifest({
      candidateId: 'candidate-a',
      originClosureHashes: [hash('origin-a')],
      mandatoryCommandIdentityHashes: [hash('command-a')],
      sealedFileHashes: [hash('file-a')],
    });

    expect(() =>
      validateRequirementsContractFinalizationByteManifest(manifest, {
        candidateId: 'candidate-a',
        originClosureHashes: manifest.originClosureHashes,
        mandatoryCommandIdentityHashes: manifest.mandatoryCommandIdentityHashes,
        sealedFileHashes: [hash('file-mutated')],
        finalizationByteManifestHash: manifest.finalizationByteManifestHash,
      })
    ).toThrow('finalization_byte_manifest_stale');
  });
});
