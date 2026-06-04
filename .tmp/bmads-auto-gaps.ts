export type GapStatus =
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'closed'
  | 'reopened'
  | 'waived'
  | 'invalidated'
  | 'superseded';

export interface GapLedgerEntry {
  event: string;
  at: string;
  artifact?: string;
  reason?: string;
  trigger?: string;
}

export interface RuntimeGap {
  gapId: string;
  sourceGapId: string;
  affectedRequirementIds: string[];
  originType: 'root' | 'derived' | 'runtime-instance' | 'regression' | 'change-control';
  resolutionType: 'requirement' | 'implementation' | 'verification' | 'drift' | 'hygiene';
  severity: 'blocker' | 'high' | 'medium' | 'low';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: GapStatus;
  instanceKey?: string;
  closureArtifact?: string;
  verificationRefs: string[];
  regressionGuardRefs: string[];
  residualRiskRefs: string[];
  reopenOn: string[];
  waiverExpiresAt?: string;
  supersededBy?: string;
  provenanceRunId?: string;
  manifestVersion?: number;
  contractHash?: string;
  adoptionReceiptArtifact?: string;
  adoptedEvidenceRefs?: string[];
  invalidationReason?: string;
  invalidatedByArtifact?: string;
  waiverRejectedReason?: string;
  ledger?: GapLedgerEntry[];
}

export interface GapRegistry {
  schemaVersion: 'bmads_auto_gap_registry/v1';
  runId: string;
  manifestVersion?: number;
  contractHash?: string;
  gaps: RuntimeGap[];
}

const DRIFT_INVALIDATION_TRIGGERS = new Set([
  'source_hash_changed',
  'contract_hash_changed',
  'manifest_version_changed',
  'artifact_hash_changed',
]);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRefs(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeRequirementIds(values: string[]): string[] {
  return normalizeRefs(values).sort();
}

function nextRuntimeGapId(registry: GapRegistry): string {
  const highestId = registry.gaps.reduce((max, gap) => {
    const match = /^RG-(\d+)$/.exec(gap.gapId);
    if (!match) return max;
    return Math.max(max, Number.parseInt(match[1], 10));
  }, 0);
  return `RG-${String(highestId + 1).padStart(3, '0')}`;
}

function buildInstanceKey(input: {
  sourceGapId: string;
  affectedRequirementIds: string[];
  resolutionType: RuntimeGap['resolutionType'];
}): string {
  return [
    input.sourceGapId.trim(),
    normalizeRequirementIds(input.affectedRequirementIds).join(','),
    input.resolutionType,
  ].join('::');
}

function appendLedger(
  gap: RuntimeGap,
  entry: GapLedgerEntry
): GapLedgerEntry[] {
  return [...(gap.ledger ?? []), entry];
}

export function instantiateRuntimeGap(input: {
  registry: GapRegistry;
  sourceGapId: string;
  affectedRequirementIds: string[];
  severity: RuntimeGap['severity'];
  priority: RuntimeGap['priority'];
  resolutionType: RuntimeGap['resolutionType'];
  reopenOn?: string[];
  originType?: RuntimeGap['originType'];
  manifestVersion?: number;
  contractHash?: string;
}): RuntimeGap {
  const requirementIds = normalizeRequirementIds(input.affectedRequirementIds);
  const instanceKey = buildInstanceKey({
    sourceGapId: input.sourceGapId,
    affectedRequirementIds: requirementIds,
    resolutionType: input.resolutionType,
  });
  const existingIndex = input.registry.gaps.findIndex(
    (gap) => gap.instanceKey === instanceKey && gap.status !== 'superseded'
  );
  if (existingIndex >= 0) {
    const existing = {
      ...input.registry.gaps[existingIndex],
      affectedRequirementIds: requirementIds,
      ledger: appendLedger(input.registry.gaps[existingIndex], {
        event: 'instantiation.reused',
        at: nowIso(),
      }),
    };
    input.registry.gaps[existingIndex] = existing;
    return existing;
  }
  const gap: RuntimeGap = {
    gapId: nextRuntimeGapId(input.registry),
    sourceGapId: input.sourceGapId,
    affectedRequirementIds: requirementIds,
    originType: input.originType ?? 'runtime-instance',
    resolutionType: input.resolutionType,
    severity: input.severity,
    priority: input.priority,
    status: 'open',
    instanceKey,
    verificationRefs: [],
    regressionGuardRefs: [],
    residualRiskRefs: [],
    reopenOn:
      normalizeRefs(input.reopenOn ?? ['source_hash_changed', 'contract_hash_changed']) || [],
    provenanceRunId: input.registry.runId,
    manifestVersion: input.manifestVersion ?? input.registry.manifestVersion,
    contractHash: input.contractHash ?? input.registry.contractHash,
    ledger: [{ event: 'instantiated', at: nowIso() }],
  };
  input.registry.gaps.push(gap);
  return gap;
}

export function closeRuntimeGap(input: {
  gap: RuntimeGap;
  closureArtifact: string;
  verificationRefs: string[];
  regressionGuardRefs: string[];
  residualRiskRefs: string[];
}): RuntimeGap {
  const verificationRefs = normalizeRefs(input.verificationRefs);
  const regressionGuardRefs = normalizeRefs(input.regressionGuardRefs);
  const residualRiskRefs = normalizeRefs(input.residualRiskRefs);
  if (
    !input.closureArtifact.trim() ||
    input.gap.affectedRequirementIds.length === 0 ||
    verificationRefs.length === 0 ||
    regressionGuardRefs.length === 0 ||
    residualRiskRefs.length === 0 ||
    ['invalidated', 'superseded'].includes(input.gap.status)
  ) {
    return {
      ...input.gap,
      status: 'blocked',
      ledger: appendLedger(input.gap, {
        event: 'close.rejected',
        at: nowIso(),
        artifact: input.closureArtifact,
      }),
    };
  }
  return {
    ...input.gap,
    status: 'closed',
    closureArtifact: input.closureArtifact.trim(),
    verificationRefs,
    regressionGuardRefs,
    residualRiskRefs,
    ledger: appendLedger(input.gap, {
      event: 'closed',
      at: nowIso(),
      artifact: input.closureArtifact.trim(),
    }),
  };
}

export function invalidateRuntimeGap(input: {
  gap: RuntimeGap;
  artifact: string;
  reason: string;
}): RuntimeGap {
  return {
    ...input.gap,
    status: 'invalidated',
    invalidationReason: input.reason,
    invalidatedByArtifact: input.artifact,
    waiverExpiresAt: undefined,
    adoptionReceiptArtifact: undefined,
    adoptedEvidenceRefs: [],
    ledger: appendLedger(input.gap, {
      event: 'invalidated',
      at: nowIso(),
      artifact: input.artifact,
      reason: input.reason,
    }),
  };
}

export function waiveRuntimeGap(input: {
  gap: RuntimeGap;
  expiresAt: string;
  waiverArtifact: string;
}): RuntimeGap {
  const waiverRejected =
    ['blocker', 'high'].includes(input.gap.severity) ||
    ['P0', 'P1'].includes(input.gap.priority) ||
    Number.isNaN(Date.parse(input.expiresAt)) ||
    !input.waiverArtifact.trim();
  if (waiverRejected) {
    return {
      ...input.gap,
      status: 'blocked',
      waiverRejectedReason:
        ['blocker', 'high'].includes(input.gap.severity) || ['P0', 'P1'].includes(input.gap.priority)
          ? 'blocking_gaps_cannot_be_waived'
          : 'invalid_waiver_request',
      ledger: appendLedger(input.gap, {
        event: 'waiver.rejected',
        at: nowIso(),
        artifact: input.waiverArtifact,
      }),
    };
  }
  return {
    ...input.gap,
    status: 'waived',
    waiverExpiresAt: input.expiresAt,
    closureArtifact: input.waiverArtifact.trim(),
    ledger: appendLedger(input.gap, {
      event: 'waived',
      at: nowIso(),
      artifact: input.waiverArtifact.trim(),
    }),
  };
}

export function supersedeRuntimeGap(input: {
  gap: RuntimeGap;
  supersededBy: string;
  artifact: string;
}): RuntimeGap {
  if (!input.supersededBy.trim() || !input.artifact.trim()) {
    return {
      ...input.gap,
      status: 'blocked',
      ledger: appendLedger(input.gap, {
        event: 'supersede.rejected',
        at: nowIso(),
        artifact: input.artifact,
      }),
    };
  }
  return {
    ...input.gap,
    status: 'superseded',
    supersededBy: input.supersededBy.trim(),
    ledger: appendLedger(input.gap, {
      event: 'superseded',
      at: nowIso(),
      artifact: input.artifact.trim(),
    }),
  };
}

export function expireWaivers(registry: GapRegistry, now: string): GapRegistry {
  const nowTime = Date.parse(now);
  return {
    ...registry,
    gaps: registry.gaps.map((gap) => {
      if (gap.status !== 'waived' || !gap.waiverExpiresAt) return gap;
      if (Date.parse(gap.waiverExpiresAt) > nowTime) return gap;
      return {
        ...gap,
        status: 'reopened',
        ledger: appendLedger(gap, { event: 'waiver.expired', at: now }),
      };
    }),
  };
}

export function reopenGapsOnTrigger(registry: GapRegistry, trigger: string): GapRegistry {
  return {
    ...registry,
    gaps: registry.gaps.map((gap) => {
      if (!['closed', 'waived'].includes(gap.status) || !gap.reopenOn.includes(trigger)) {
        return gap;
      }
      if (DRIFT_INVALIDATION_TRIGGERS.has(trigger)) {
        return {
          ...gap,
          status: 'invalidated',
          invalidationReason: `trigger:${trigger}`,
          ledger: appendLedger(gap, {
            event: `invalidated:${trigger}`,
            at: nowIso(),
            trigger,
          }),
        };
      }
      return {
        ...gap,
        status: 'reopened',
        ledger: appendLedger(gap, {
          event: `reopened:${trigger}`,
          at: nowIso(),
          trigger,
        }),
      };
    }),
  };
}

export function adoptPreservedGapEvidence(input: {
  gap: RuntimeGap;
  adoptionReceiptArtifact: string;
  adoptedEvidenceRefs: string[];
  runId: string;
  manifestVersion: number;
  contractHash: string;
}): RuntimeGap {
  const adoptedEvidenceRefs = normalizeRefs(input.adoptedEvidenceRefs);
  if (
    !input.adoptionReceiptArtifact.trim() ||
    adoptedEvidenceRefs.length === 0 ||
    !input.runId.trim() ||
    !input.contractHash.trim() ||
    input.manifestVersion <= 0 ||
    input.gap.status === 'superseded'
  ) {
    return {
      ...input.gap,
      status: 'blocked',
      ledger: appendLedger(input.gap, {
        event: 'adoption.rejected',
        at: nowIso(),
        artifact: input.adoptionReceiptArtifact,
      }),
    };
  }
  return {
    ...input.gap,
    status: input.gap.status === 'invalidated' ? 'reopened' : input.gap.status,
    provenanceRunId: input.runId.trim(),
    manifestVersion: input.manifestVersion,
    contractHash: input.contractHash.trim(),
    adoptionReceiptArtifact: input.adoptionReceiptArtifact.trim(),
    adoptedEvidenceRefs,
    ledger: appendLedger(input.gap, {
      event: 'adopted',
      at: nowIso(),
      artifact: input.adoptionReceiptArtifact.trim(),
    }),
  };
}

export function releaseBlockedByGaps(registry: GapRegistry): boolean {
  const blockingStates: GapStatus[] = [
    'open',
    'in_progress',
    'blocked',
    'reopened',
    'waived',
    'invalidated',
  ];
  return registry.gaps.some(
    (gap) =>
      blockingStates.includes(gap.status) &&
      (['blocker', 'high'].includes(gap.severity) || ['P0', 'P1'].includes(gap.priority))
  );
}

export function createRequirementRepairTask(input: {
  runId: string;
  gap: RuntimeGap;
}): {
  schemaVersion: 'bmads_auto_requirement_repair_task/v1';
  runId: string;
  gapId: string;
  sourceGapId: string;
  affectedRequirementIds: string[];
  userReconfirmationRequired: boolean;
  manifestVersion?: number;
  contractHash?: string;
} {
  return {
    schemaVersion: 'bmads_auto_requirement_repair_task/v1',
    runId: input.runId,
    gapId: input.gap.gapId,
    sourceGapId: input.gap.sourceGapId,
    affectedRequirementIds: input.gap.affectedRequirementIds,
    userReconfirmationRequired: true,
    manifestVersion: input.gap.manifestVersion,
    contractHash: input.gap.contractHash,
  };
}

export function createPreservedEvidenceAdoptionReceipt(input: {
  runId: string;
  manifestVersion: number;
  contractHash: string;
  affectedRequirementIds: string[];
  unaffectedRequirementIds?: string[];
  traceabilityMatrixPath?: string;
  reason: string;
  adoptedEvidenceHashes: Record<string, string>;
}): {
  schemaVersion: 'bmads_auto_preserved_evidence_adoption/v1';
  runId: string;
  manifestVersion: number;
  contractHash: string;
  affectedRequirementIds: string[];
  unaffectedRequirementIds: string[];
  traceabilityMatrixPath: string;
  reason: string;
  adoptedEvidenceHashes: Record<string, string>;
  sameRunProvenance: boolean;
  provenanceAdopted: boolean;
  adoptedAt: string;
} {
  return {
    schemaVersion: 'bmads_auto_preserved_evidence_adoption/v1',
    runId: input.runId,
    manifestVersion: input.manifestVersion,
    contractHash: input.contractHash,
    affectedRequirementIds: normalizeRequirementIds(input.affectedRequirementIds),
    unaffectedRequirementIds: normalizeRequirementIds(input.unaffectedRequirementIds ?? []),
    traceabilityMatrixPath: input.traceabilityMatrixPath ?? '',
    reason: input.reason,
    adoptedEvidenceHashes: input.adoptedEvidenceHashes,
    sameRunProvenance:
      input.manifestVersion > 0 &&
      Boolean(input.runId.trim()) &&
      Boolean(input.contractHash.trim()),
    provenanceAdopted: Object.keys(input.adoptedEvidenceHashes).length > 0,
    adoptedAt: nowIso(),
  };
}
