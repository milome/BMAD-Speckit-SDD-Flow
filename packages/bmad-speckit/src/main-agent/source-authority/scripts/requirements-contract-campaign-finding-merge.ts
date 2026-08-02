import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  text,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

const ACTOR_CLASSES = ['bounded_code_reviewer', 'final_acceptance_judge'] as const;
const FINAL_DISPOSITIONS = [
  'accepted',
  'rejected',
  'remediated',
  'not_applicable',
  'deferred_open_issue',
] as const;

export type RequirementsContractCampaignFindingActorClass = (typeof ACTOR_CLASSES)[number];
export type RequirementsContractCampaignFindingDisposition = (typeof FINAL_DISPOSITIONS)[number];

export interface RequirementsContractCampaignFindingOrigin {
  originId: string;
  actorClass: RequirementsContractCampaignFindingActorClass;
  sourceLedgerHash: string;
  sourceLineageHash: string;
  findingId: string;
}

export interface RequirementsContractCampaignFindingPreservationRow extends RequirementsContractCampaignFindingOrigin {
  mergedFindingId: string;
  disposition: RequirementsContractCampaignFindingDisposition;
  dispositionRef: string;
}

export interface RequirementsContractMergedCampaignFinding {
  mergedFindingId: string;
  canonicalObservationHash: string;
  origins: RequirementsContractCampaignFindingOrigin[];
}

export interface RequirementsContractCampaignRemediationLedger {
  schemaVersion: 'requirements-contract-campaign-remediation-ledger/v1';
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  blindReviewAggregateHash: string;
  originCount: number;
  completeOriginSetHash: string;
  permutationHashes: string[];
  mergedFindings: RequirementsContractMergedCampaignFinding[];
  originPreservationMatrix: RequirementsContractCampaignFindingPreservationRow[];
  decision: 'pass';
  ledgerHash: string;
}

export class RequirementsContractCampaignFindingMergeError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractCampaignFindingMergeError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractCampaignFindingMergeError(code);
}

function isActorClass(value: unknown): value is RequirementsContractCampaignFindingActorClass {
  return ACTOR_CLASSES.includes(value as RequirementsContractCampaignFindingActorClass);
}

function requireActorClass(value: unknown): RequirementsContractCampaignFindingActorClass {
  if (!isActorClass(value)) fail('campaign_finding_origin_invalid');
  return value;
}

function requireDisposition(value: unknown): RequirementsContractCampaignFindingDisposition {
  if (value === 'fixer_waiver') fail('campaign_finding_fixer_waiver_forbidden');
  if (!FINAL_DISPOSITIONS.includes(value as RequirementsContractCampaignFindingDisposition)) {
    fail('campaign_finding_disposition_invalid');
  }
  return value as RequirementsContractCampaignFindingDisposition;
}

function originIdentity(origin: {
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  actorClass: string;
  sourceLedgerHash: string;
  sourceLineageHash: string;
  findingId: string;
}): string {
  return stableHash({
    campaignId: origin.campaignId,
    campaignLineageKey: origin.campaignLineageKey,
    initialReviewAttemptKey: origin.initialReviewAttemptKey,
    actorClass: origin.actorClass,
    sourceLedgerHash: origin.sourceLedgerHash,
    sourceLineageHash: origin.sourceLineageHash,
    findingId: origin.findingId,
  });
}

function requireOrigin(value: unknown, authority: JsonRecord) {
  if (!isRecord(value)) fail('campaign_finding_origin_invalid');
  const origin = {
    campaignId: requireText(value, 'campaignId', 'campaign_finding_origin_invalid'),
    campaignLineageKey: requireHash(value, 'campaignLineageKey', 'campaign_finding_origin_invalid'),
    initialReviewAttemptKey: requireHash(
      value,
      'initialReviewAttemptKey',
      'campaign_finding_origin_invalid'
    ),
    actorClass: requireActorClass(value.actorClass),
    sourceLedgerHash: requireHash(value, 'sourceLedgerHash', 'campaign_finding_origin_invalid'),
    sourceLineageHash: requireHash(value, 'sourceLineageHash', 'campaign_finding_origin_invalid'),
    findingId: requireText(value, 'findingId', 'campaign_finding_origin_invalid'),
    canonicalObservationHash: requireHash(
      value,
      'canonicalObservationHash',
      'campaign_finding_message_identity_forbidden'
    ),
  };
  if (
    origin.campaignId !== authority.campaignId ||
    origin.campaignLineageKey !== authority.campaignLineageKey ||
    origin.initialReviewAttemptKey !== authority.initialReviewAttemptKey
  ) {
    fail('campaign_finding_origin_replay');
  }
  return {
    ...origin,
    originId: originIdentity(origin),
  };
}

function requireDispositionRecord(value: unknown) {
  if (!isRecord(value)) fail('campaign_finding_disposition_invalid');
  return {
    originId: requireHash(value, 'originId', 'campaign_finding_disposition_invalid'),
    disposition: requireDisposition(value.disposition),
    dispositionRef: requireText(value, 'dispositionRef', 'campaign_finding_disposition_invalid'),
  };
}

function sortOrigin(
  left: RequirementsContractCampaignFindingOrigin,
  right: RequirementsContractCampaignFindingOrigin
): number {
  return left.originId.localeCompare(right.originId);
}

export function compileRequirementsContractCampaignRemediationLedger(
  input: unknown
): RequirementsContractCampaignRemediationLedger {
  if (!isRecord(input)) fail('campaign_finding_input_invalid');
  const authority = {
    campaignId: requireText(input, 'campaignId', 'campaign_finding_identity_invalid'),
    campaignLineageKey: requireHash(
      input,
      'campaignLineageKey',
      'campaign_finding_identity_invalid'
    ),
    initialReviewAttemptKey: requireHash(
      input,
      'initialReviewAttemptKey',
      'campaign_finding_identity_invalid'
    ),
  };
  const blindReviewAggregateHash = requireHash(
    input,
    'blindReviewAggregateHash',
    'campaign_finding_identity_invalid'
  );
  const sourceFindings = Array.isArray(input.sourceFindings)
    ? input.sourceFindings.map((candidate) => requireOrigin(candidate, authority))
    : [];
  if (sourceFindings.length === 0) fail('campaign_finding_origin_missing');
  const originIds = sourceFindings.map((origin) => origin.originId);
  if (new Set(originIds).size !== originIds.length) fail('campaign_finding_origin_duplicate');

  const dispositions = Array.isArray(input.finalDispositions)
    ? input.finalDispositions.map(requireDispositionRecord)
    : [];
  const dispositionIds = dispositions.map((disposition) => disposition.originId);
  if (new Set(dispositionIds).size !== dispositionIds.length) {
    fail('campaign_finding_disposition_duplicate');
  }
  const originIdSet = new Set(originIds);
  if (dispositionIds.some((originId) => !originIdSet.has(originId))) {
    fail('campaign_finding_disposition_unknown_origin');
  }
  if (originIds.some((originId) => !dispositionIds.includes(originId))) {
    fail('campaign_finding_disposition_missing');
  }
  const dispositionByOrigin = new Map(dispositions.map((item) => [item.originId, item]));
  const originsByObservation = new Map<string, typeof sourceFindings>();
  for (const origin of sourceFindings) {
    const current = originsByObservation.get(origin.canonicalObservationHash) ?? [];
    current.push(origin);
    originsByObservation.set(origin.canonicalObservationHash, current);
  }
  const mergedFindings = [...originsByObservation.entries()]
    .map(([canonicalObservationHash, origins]) => {
      const publicOrigins = origins
        .map(({ originId, actorClass, sourceLedgerHash, sourceLineageHash, findingId }) => ({
          originId,
          actorClass,
          sourceLedgerHash,
          sourceLineageHash,
          findingId,
        }))
        .sort(sortOrigin);
      return {
        mergedFindingId: stableHash({
          blindReviewAggregateHash,
          canonicalObservationHash,
          originIds: publicOrigins.map((origin) => origin.originId),
        }),
        canonicalObservationHash,
        origins: publicOrigins,
      };
    })
    .sort(
      (left, right) =>
        right.origins.length - left.origins.length ||
        left.canonicalObservationHash.localeCompare(right.canonicalObservationHash)
    );
  const mergedIdByOrigin = new Map<string, string>();
  for (const finding of mergedFindings) {
    for (const origin of finding.origins)
      mergedIdByOrigin.set(origin.originId, finding.mergedFindingId);
  }
  const originPreservationMatrix = sourceFindings
    .map(({ originId, actorClass, sourceLedgerHash, sourceLineageHash, findingId }) => {
      const disposition = dispositionByOrigin.get(originId);
      if (!disposition) fail('campaign_finding_disposition_missing');
      return {
        originId,
        actorClass,
        sourceLedgerHash,
        sourceLineageHash,
        findingId,
        mergedFindingId: requireText(
          { mergedFindingId: mergedIdByOrigin.get(originId) },
          'mergedFindingId',
          'campaign_finding_origin_missing'
        ),
        disposition: disposition.disposition,
        dispositionRef: disposition.dispositionRef,
      };
    })
    .sort(sortOrigin);
  const completeOriginSetHash = stableHash({
    originIds: [...originIds].sort((left, right) => left.localeCompare(right)),
  });
  const payload = {
    schemaVersion: 'requirements-contract-campaign-remediation-ledger/v1' as const,
    campaignId: authority.campaignId,
    campaignLineageKey: authority.campaignLineageKey,
    initialReviewAttemptKey: authority.initialReviewAttemptKey,
    blindReviewAggregateHash,
    originCount: sourceFindings.length,
    completeOriginSetHash,
    permutationHashes: [
      stableHash({
        sourceFindings: [...sourceFindings]
          .sort((left, right) => left.originId.localeCompare(right.originId))
          .map(({ originId, canonicalObservationHash }) => ({
            originId,
            canonicalObservationHash,
          })),
      }),
      stableHash({
        finalDispositions: [...dispositions].sort((left, right) =>
          left.originId.localeCompare(right.originId)
        ),
      }),
    ],
    mergedFindings,
    originPreservationMatrix,
    decision: 'pass' as const,
  };
  return { ...payload, ledgerHash: stableHash(payload) };
}

export function validateRequirementsContractCampaignRemediationLedger(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractCampaignRemediationLedger {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('campaign_finding_ledger_invalid');
  const ledger = value as unknown as RequirementsContractCampaignRemediationLedger;
  const { ledgerHash, ...payload } = ledger;
  if (ledgerHash !== stableHash(payload)) fail('campaign_finding_ledger_hash_mismatch');
  if (
    ledger.decision !== 'pass' ||
    ledger.schemaVersion !== 'requirements-contract-campaign-remediation-ledger/v1'
  ) {
    fail('campaign_finding_ledger_invalid');
  }
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'initialReviewAttemptKey',
    'ledgerHash',
  ] as const) {
    if (text(ledger[field]) !== text(currentAuthority[field])) {
      fail('campaign_finding_ledger_stale');
    }
  }
  return ledger;
}
