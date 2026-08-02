import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  sameSet,
  stableHash,
  strings,
  text,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';
import {
  validateRequirementsContractJudgeReviewCampaignController,
  type RequirementsContractJudgeReviewCampaignController,
} from './requirements-contract-judge-review-campaign';

export interface RequirementsContractJudgeFinalIntegrationLineageByteRef {
  path: string;
  hash: string;
}

export interface RequirementsContractJudgeFinalIntegrationLineageReceipt {
  schemaVersion: 'requirements-contract-judge-final-integration-lineage/v1';
  partitionId: string;
  partitionPlanHash: string;
  partitionSetHash: string;
  selectionSetHash: string;
  sourceAuthorityBundleHash: string;
  sourceCompositionPolicyHash: string;
  campaignId: string;
  campaignLineageKey: string;
  controllerHash: string;
  installedJourneyReceiptHash: string;
  installedSemanticCounts: { clean: 2; remediated: 3 };
  requirementsCallCountPerUnchangedSnapshot: 1;
  checkoutFallbackUsed: false;
  finalJudgeRole: 'final_acceptance_judge';
  governedBytes: RequirementsContractJudgeFinalIntegrationLineageByteRef[];
  governedByteManifestHash: string;
  lineageHash: string;
  decision: 'pass';
}

export class RequirementsContractJudgeFinalIntegrationLineageError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractJudgeFinalIntegrationLineageError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractJudgeFinalIntegrationLineageError(code);
}

function rejectAuthorityInjection(input: JsonRecord): void {
  for (const key of Object.keys(input)) {
    const normalized = key.replace(/[-_]/gu, '').toLowerCase();
    if (
      normalized.includes('callerverdict') ||
      normalized.includes('callerfinding') ||
      normalized.includes('callereffectivepass') ||
      normalized.includes('callercloseoutauthority') ||
      normalized.includes('kerneloverride')
    ) {
      fail('judge_final_integration_lineage_authority_injection');
    }
  }
}

function byteRefs(value: unknown, governedPathAllowlist: string[]): RequirementsContractJudgeFinalIntegrationLineageByteRef[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('judge_final_integration_lineage_governed_bytes_missing');
  }
  const refs = value.map((entry) => {
    if (!isRecord(entry)) fail('judge_final_integration_lineage_governed_byte_invalid');
    const path = requireText(
      entry,
      'path',
      'judge_final_integration_lineage_governed_byte_invalid'
    ).replace(/\\/gu, '/');
    if (!governedPathAllowlist.includes(path)) {
      fail(`judge_final_integration_lineage_non_governed_product_change:${path}`);
    }
    return {
      path,
      hash: requireHash(entry, 'hash', 'judge_final_integration_lineage_governed_byte_invalid'),
    };
  });
  if (new Set(refs.map((ref) => ref.path)).size !== refs.length) {
    fail('judge_final_integration_lineage_governed_byte_duplicate');
  }
  if (new Set(refs.map((ref) => ref.hash)).size !== refs.length) {
    fail('judge_final_integration_lineage_governed_byte_replayed');
  }
  return [...refs].sort((left, right) => left.path.localeCompare(right.path));
}

function validateInstalledJourney(input: JsonRecord): {
  hash: string;
  semanticCounts: { clean: 2; remediated: 3 };
} {
  const installed = isRecord(input.installedJourneyReceipt) ? input.installedJourneyReceipt : null;
  if (!installed || installed.decision !== 'pass') {
    fail('judge_final_integration_lineage_installed_journey_missing');
  }
  const semanticCounts = isRecord(installed.semanticCounts) ? installed.semanticCounts : {};
  if (semanticCounts.clean !== 2 || semanticCounts.remediated !== 3) {
    fail('judge_final_integration_lineage_semantic_counts_invalid');
  }
  if (installed.requirementsCallCountPerUnchangedSnapshot !== 1) {
    fail('judge_final_integration_lineage_requirements_call_count_invalid');
  }
  if (installed.checkoutFallbackUsed !== false) {
    fail('judge_final_integration_lineage_checkout_fallback_forbidden');
  }
  return {
    hash: requireHash(installed, 'receiptHash', 'judge_final_integration_lineage_installed_journey_missing'),
    semanticCounts: { clean: 2, remediated: 3 },
  };
}

function currentAuthority(input: JsonRecord): JsonRecord {
  const authority = isRecord(input.currentAuthority) ? input.currentAuthority : null;
  if (!authority || authority.current !== true || authority.decision !== 'pass') {
    fail('judge_final_integration_lineage_authority_missing');
  }
  if (authority.stale === true) fail('judge_final_integration_lineage_stale');
  return authority;
}

export function compileRequirementsContractJudgeFinalIntegrationLineage(
  input: unknown
): RequirementsContractJudgeFinalIntegrationLineageReceipt {
  if (!isRecord(input)) fail('judge_final_integration_lineage_invalid');
  rejectAuthorityInjection(input);
  const authority = currentAuthority(input);
  const governedPathAllowlist = requireNonEmptyUniqueStrings(
    authority.governedPathAllowlist,
    'judge_final_integration_lineage_governed_bytes_missing'
  );
  const governedBytes = byteRefs(input.governedBytes, governedPathAllowlist);
  if (!sameSet(governedBytes.map((ref) => ref.path), governedPathAllowlist)) {
    fail('judge_final_integration_lineage_governed_bytes_missing');
  }
  const controller = validateRequirementsContractJudgeReviewCampaignController(
    input.judgeReviewCampaignController,
    {
      campaignId: requireText(authority, 'campaignId', 'judge_final_integration_lineage_identity'),
      campaignLineageKey: requireHash(
        authority,
        'campaignLineageKey',
        'judge_final_integration_lineage_identity'
      ),
      initialReviewAttemptKey: requireHash(
        authority,
        'initialReviewAttemptKey',
        'judge_final_integration_lineage_identity'
      ),
      controllerHash: requireHash(authority, 'controllerHash', 'judge_final_integration_lineage_stale'),
    }
  ) as RequirementsContractJudgeReviewCampaignController;
  const installed = validateInstalledJourney(input);
  if (input.finalJudgeRole !== 'final_acceptance_judge') {
    fail('judge_final_integration_lineage_final_judge_role_invalid');
  }
  const governedByteManifestHash = stableHash({
    partitionId: requireText(authority, 'partitionId', 'judge_final_integration_lineage_identity'),
    governedBytes,
  });
  if (
    governedByteManifestHash !==
    requireHash(authority, 'governedByteManifestHash', 'judge_final_integration_lineage_stale')
  ) {
    fail('judge_final_integration_lineage_stale');
  }
  const payload = {
    schemaVersion: 'requirements-contract-judge-final-integration-lineage/v1' as const,
    partitionId: requireText(authority, 'partitionId', 'judge_final_integration_lineage_identity'),
    partitionPlanHash: requireHash(
      authority,
      'partitionPlanHash',
      'judge_final_integration_lineage_identity'
    ),
    partitionSetHash: requireHash(
      authority,
      'partitionSetHash',
      'judge_final_integration_lineage_identity'
    ),
    selectionSetHash: requireHash(
      authority,
      'selectionSetHash',
      'judge_final_integration_lineage_identity'
    ),
    sourceAuthorityBundleHash: requireHash(
      authority,
      'sourceAuthorityBundleHash',
      'judge_final_integration_lineage_identity'
    ),
    sourceCompositionPolicyHash: requireHash(
      authority,
      'sourceCompositionPolicyHash',
      'judge_final_integration_lineage_identity'
    ),
    campaignId: controller.campaignId,
    campaignLineageKey: controller.campaignLineageKey,
    controllerHash: controller.controllerHash,
    installedJourneyReceiptHash: installed.hash,
    installedSemanticCounts: installed.semanticCounts,
    requirementsCallCountPerUnchangedSnapshot: 1 as const,
    checkoutFallbackUsed: false as const,
    finalJudgeRole: 'final_acceptance_judge' as const,
    governedBytes,
    governedByteManifestHash,
    decision: 'pass' as const,
  };
  return {
    ...payload,
    lineageHash: stableHash(payload),
  };
}

export function validateRequirementsContractJudgeFinalIntegrationLineage(
  value: unknown,
  current: unknown
): RequirementsContractJudgeFinalIntegrationLineageReceipt {
  if (!isRecord(value) || !isRecord(current)) {
    fail('judge_final_integration_lineage_invalid');
  }
  const receipt = value as unknown as RequirementsContractJudgeFinalIntegrationLineageReceipt;
  const { lineageHash, ...payload } = receipt;
  if (
    receipt.schemaVersion !== 'requirements-contract-judge-final-integration-lineage/v1' ||
    receipt.decision !== 'pass' ||
    receipt.finalJudgeRole !== 'final_acceptance_judge' ||
    receipt.checkoutFallbackUsed !== false ||
    lineageHash !== stableHash(payload)
  ) {
    fail('judge_final_integration_lineage_hash_mismatch');
  }
  for (const field of [
    'partitionId',
    'partitionPlanHash',
    'partitionSetHash',
    'selectionSetHash',
    'sourceAuthorityBundleHash',
    'sourceCompositionPolicyHash',
    'campaignId',
    'campaignLineageKey',
    'controllerHash',
    'lineageHash',
  ] as const) {
    if (text(receipt[field]) !== text(current[field])) {
      fail('judge_final_integration_lineage_stale');
    }
  }
  if (
    !sameSet(
      receipt.governedBytes.map((ref) => `${ref.path}:${ref.hash}`),
      strings(current.governedByteRefs)
    )
  ) {
    fail('judge_final_integration_lineage_stale');
  }
  return receipt;
}
