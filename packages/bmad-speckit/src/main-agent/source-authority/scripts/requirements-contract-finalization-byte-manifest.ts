import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  sameSet,
  stableHash,
  text,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractFinalizationByteManifest {
  schemaVersion: 'requirements-contract-finalization-byte-manifest/v1';
  candidateId: string;
  originClosureHashes: string[];
  mandatoryCommandIdentityHashes: string[];
  sealedFileHashes: string[];
  finalizationByteManifestHash: string;
  decision: 'pass';
}

export class RequirementsContractFinalizationByteManifestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractFinalizationByteManifestError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractFinalizationByteManifestError(code);
}

export function compileRequirementsContractFinalizationByteManifest(
  input: unknown
): RequirementsContractFinalizationByteManifest {
  if (!isRecord(input)) fail('finalization_byte_manifest_input_invalid');
  const candidateId = requireText(
    input,
    'candidateId',
    'finalization_byte_manifest_candidate_invalid'
  );
  const originClosureHashes = requireNonEmptyUniqueStrings(
    input.originClosureHashes,
    'finalization_byte_manifest_origin_missing'
  );
  const mandatoryCommandIdentityHashes = requireNonEmptyUniqueStrings(
    input.mandatoryCommandIdentityHashes,
    'finalization_byte_manifest_command_missing'
  );
  const sealedFileHashes = requireNonEmptyUniqueStrings(
    input.sealedFileHashes,
    'finalization_byte_manifest_seal_missing'
  );
  for (const hash of [
    ...originClosureHashes,
    ...mandatoryCommandIdentityHashes,
    ...sealedFileHashes,
  ]) {
    requireHash({ hash }, 'hash', 'finalization_byte_manifest_hash_invalid');
  }
  const payload = {
    schemaVersion: 'requirements-contract-finalization-byte-manifest/v1' as const,
    candidateId,
    originClosureHashes,
    mandatoryCommandIdentityHashes,
    sealedFileHashes,
    decision: 'pass' as const,
  };
  return {
    ...payload,
    finalizationByteManifestHash: stableHash(payload),
  };
}

export function validateRequirementsContractFinalizationByteManifest(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractFinalizationByteManifest {
  if (!isRecord(value) || !isRecord(currentAuthority)) {
    fail('finalization_byte_manifest_invalid');
  }
  const manifest = value as unknown as RequirementsContractFinalizationByteManifest;
  const { finalizationByteManifestHash, ...payload } = manifest;
  if (finalizationByteManifestHash !== stableHash(payload)) {
    fail('finalization_byte_manifest_hash_mismatch');
  }
  if (
    manifest.schemaVersion !== 'requirements-contract-finalization-byte-manifest/v1' ||
    manifest.decision !== 'pass'
  ) {
    fail('finalization_byte_manifest_invalid');
  }
  if (
    text(manifest.candidateId) !== text(currentAuthority.candidateId) ||
    manifest.finalizationByteManifestHash !==
      requireHash(
        currentAuthority,
        'finalizationByteManifestHash',
        'finalization_byte_manifest_stale'
      )
  ) {
    fail('finalization_byte_manifest_stale');
  }
  if (
    !sameSet(
      manifest.originClosureHashes,
      requireNonEmptyUniqueStrings(
        currentAuthority.originClosureHashes,
        'finalization_byte_manifest_stale'
      )
    ) ||
    !sameSet(
      manifest.mandatoryCommandIdentityHashes,
      requireNonEmptyUniqueStrings(
        currentAuthority.mandatoryCommandIdentityHashes,
        'finalization_byte_manifest_stale'
      )
    ) ||
    !sameSet(
      manifest.sealedFileHashes,
      requireNonEmptyUniqueStrings(
        currentAuthority.sealedFileHashes,
        'finalization_byte_manifest_stale'
      )
    )
  ) {
    fail('finalization_byte_manifest_stale');
  }
  manifest.originClosureHashes = uniqueSorted(manifest.originClosureHashes);
  manifest.mandatoryCommandIdentityHashes = uniqueSorted(manifest.mandatoryCommandIdentityHashes);
  manifest.sealedFileHashes = uniqueSorted(manifest.sealedFileHashes);
  return manifest;
}
