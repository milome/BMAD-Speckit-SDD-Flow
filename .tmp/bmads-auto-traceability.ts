export interface TraceabilityRow {
  requirementId: string;
  gapRefs: string[];
  fixtureRefs: string[];
  implementationTarget: string;
  testTarget: string;
  evidenceTarget: string;
  status: 'planned' | 'implemented' | 'verified' | 'missing' | 'invalidated';
  provenanceRunId?: string;
  manifestVersion?: number;
  contractHash?: string;
}

export interface FixtureRegistryEntry {
  fixtureId: string;
  requirementRefs: string[];
  gapRefs: string[];
  evidenceMode: 'mock' | 'real_host_cli' | 'real_delivery' | 'mock_or_real_host_cli';
  claimMode: 'none' | 'baseline_delivery' | 'real_8h_claim';
}

function hasText(value?: string): boolean {
  return Boolean(value?.trim());
}

function normalizeRefs(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function validateTraceability(rows: TraceabilityRow[]): {
  resultCode: 'OK' | 'BLOCKED_TRACEABILITY_INCOMPLETE';
  blockers: string[];
} {
  const blockers = rows.flatMap((row) => {
    const missing: string[] = [];
    if (!/^REQ-\d{3}(?:\.\d+)?$/.test(row.requirementId)) missing.push(`${row.requirementId}:requirementId`);
    if (!hasText(row.implementationTarget)) missing.push(`${row.requirementId}:implementationTarget`);
    if (!hasText(row.testTarget)) missing.push(`${row.requirementId}:testTarget`);
    if (!hasText(row.evidenceTarget)) missing.push(`${row.requirementId}:evidenceTarget`);
    if (normalizeRefs(row.fixtureRefs).length === 0 && normalizeRefs(row.gapRefs).length === 0) {
      missing.push(`${row.requirementId}:fixtureOrGapRef`);
    }
    if (!hasText(row.provenanceRunId)) missing.push(`${row.requirementId}:provenanceRunId`);
    if (!Number.isInteger(row.manifestVersion) || (row.manifestVersion ?? 0) <= 0) {
      missing.push(`${row.requirementId}:manifestVersion`);
    }
    if (!hasText(row.contractHash)) missing.push(`${row.requirementId}:contractHash`);
    return missing;
  });
  return {
    resultCode: blockers.length === 0 ? 'OK' : 'BLOCKED_TRACEABILITY_INCOMPLETE',
    blockers,
  };
}

export function validateTraceabilityCoverage(input: {
  rows: TraceabilityRow[];
  requiredRequirementIds: string[];
  fixtureIds: string[];
  expectedGapRefs?: string[];
  runId?: string;
  expectedManifestVersion?: number;
  expectedContractHash?: string;
}): {
  resultCode:
    | 'OK'
    | 'BLOCKED_TRACEABILITY_INCOMPLETE'
    | 'BLOCKED_FIXTURE_ORPHAN'
    | 'BLOCKED_PROVENANCE_DRIFT';
  blockers: string[];
} {
  const blockers = [...validateTraceability(input.rows).blockers];
  const rowRequirementCounts = new Map<string, number>();
  for (const row of input.rows) {
    rowRequirementCounts.set(row.requirementId, (rowRequirementCounts.get(row.requirementId) ?? 0) + 1);
    if (['missing', 'planned', 'invalidated'].includes(row.status)) {
      blockers.push(`${row.requirementId}:status_${row.status}`);
    }
  }
  for (const requirementId of input.requiredRequirementIds) {
    const count = rowRequirementCounts.get(requirementId) ?? 0;
    if (count === 0) blockers.push(`${requirementId}:missing`);
    if (count > 1) blockers.push(`${requirementId}:duplicate`);
  }
  const knownFixtures = new Set(input.fixtureIds);
  const referencedFixtures = new Set(input.rows.flatMap((row) => row.fixtureRefs));
  for (const fixtureId of input.fixtureIds) {
    if (!referencedFixtures.has(fixtureId)) blockers.push(`${fixtureId}:orphan`);
  }
  for (const row of input.rows) {
    for (const fixtureId of normalizeRefs(row.fixtureRefs)) {
      if (!knownFixtures.has(fixtureId)) blockers.push(`${fixtureId}:unknown_fixture_ref`);
    }
  }
  const knownGapRefs = new Set(input.expectedGapRefs ?? []);
  if (input.expectedGapRefs) {
    const referencedGapRefs = new Set(input.rows.flatMap((row) => row.gapRefs));
    for (const gapRef of input.expectedGapRefs) {
      if (!referencedGapRefs.has(gapRef)) blockers.push(`${gapRef}:orphan`);
    }
    for (const row of input.rows) {
      for (const gapRef of normalizeRefs(row.gapRefs)) {
        if (!knownGapRefs.has(gapRef)) blockers.push(`${gapRef}:unknown_gap_ref`);
      }
    }
  }
  for (const row of input.rows) {
    if (input.runId && row.provenanceRunId !== input.runId) {
      blockers.push(`${row.requirementId}:run_provenance_mismatch`);
    }
    if (
      input.expectedManifestVersion &&
      row.manifestVersion !== input.expectedManifestVersion
    ) {
      blockers.push(`${row.requirementId}:manifest_version_drift`);
    }
    if (input.expectedContractHash && row.contractHash !== input.expectedContractHash) {
      blockers.push(`${row.requirementId}:contract_hash_drift`);
    }
  }
  return {
    resultCode:
      blockers.length === 0
        ? 'OK'
        : blockers.some(
              (blocker) =>
                blocker.includes('contract_hash_drift') ||
                blocker.includes('manifest_version_drift') ||
                blocker.includes('run_provenance_mismatch')
            )
          ? 'BLOCKED_PROVENANCE_DRIFT'
          : blockers.some(
                (blocker) =>
                  blocker.includes(':orphan') ||
                  blocker.includes('unknown_fixture_ref')
              )
            ? 'BLOCKED_FIXTURE_ORPHAN'
            : 'BLOCKED_TRACEABILITY_INCOMPLETE',
    blockers,
  };
}

export function validateFixtureRegistry(entries: FixtureRegistryEntry[]): {
  resultCode: 'OK' | 'BLOCKED_FIXTURE_ORPHAN' | 'BLOCKED_8H_OPTIONALITY_LEAK';
  blockers: string[];
} {
  const blockers: string[] = [];
  const seenFixtureIds = new Set<string>();
  for (const entry of entries) {
    if (seenFixtureIds.has(entry.fixtureId)) {
      blockers.push(`${entry.fixtureId}:duplicate_fixture_id`);
    }
    seenFixtureIds.add(entry.fixtureId);
    if (normalizeRefs(entry.requirementRefs).length === 0 && normalizeRefs(entry.gapRefs).length === 0) {
      blockers.push(`${entry.fixtureId}:orphan`);
    }
    if (
      entry.fixtureId === 'E2E-28-baseline-closeout-without-8h' &&
      (entry.claimMode !== 'baseline_delivery' || entry.evidenceMode === 'real_delivery')
    ) {
      blockers.push(`${entry.fixtureId}:baseline_must_not_require_real_8h`);
    }
    if (
      entry.fixtureId === 'E2E-18-delivery-truth-real-8h' &&
      (entry.claimMode !== 'real_8h_claim' || entry.evidenceMode !== 'real_delivery')
    ) {
      blockers.push(`${entry.fixtureId}:must_be_optional_real_8h_claim`);
    }
    if (
      entry.fixtureId !== 'E2E-18-delivery-truth-real-8h' &&
      entry.claimMode === 'real_8h_claim'
    ) {
      blockers.push(`${entry.fixtureId}:real_8h_claim_reserved_for_E2E_18`);
    }
  }
  return {
    resultCode:
      blockers.length === 0
        ? 'OK'
        : blockers.some((item) => item.includes('8h') || item.includes('real_8h'))
          ? 'BLOCKED_8H_OPTIONALITY_LEAK'
          : 'BLOCKED_FIXTURE_ORPHAN',
    blockers,
  };
}

export function baselineFixtureRegistry(): FixtureRegistryEntry[] {
  return [
    {
      fixtureId: 'E2E-28-baseline-closeout-without-8h',
      requirementRefs: ['REQ-013', 'REQ-014', 'REQ-022'],
      gapRefs: ['G29', 'G30'],
      evidenceMode: 'mock_or_real_host_cli',
      claimMode: 'baseline_delivery',
    },
    {
      fixtureId: 'E2E-18-delivery-truth-real-8h',
      requirementRefs: ['REQ-022'],
      gapRefs: ['G51'],
      evidenceMode: 'real_delivery',
      claimMode: 'real_8h_claim',
    },
    {
      fixtureId: 'E2E-29-contract-index-and-verify-design',
      requirementRefs: ['REQ-026', 'REQ-027'],
      gapRefs: ['G54', 'G55'],
      evidenceMode: 'mock',
      claimMode: 'none',
    },
    {
      fixtureId: 'E2E-30-verify-run-fail-close',
      requirementRefs: ['REQ-026', 'REQ-027'],
      gapRefs: ['G54', 'G55', 'G43', 'G44', 'G45'],
      evidenceMode: 'mock',
      claimMode: 'none',
    },
  ];
}
