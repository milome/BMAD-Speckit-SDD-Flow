'use strict';

const SCHEMA_VERSION = 'test-minimal-cover/v1';
const APPLICABILITY_VALUES = new Set(['applicable', 'not_applicable']);
const EVIDENCE_VALUES = new Set(['direct', 'indirect', 'ambiguous']);
const MINIMUM_EVIDENCE_VALUES = new Set(['direct', 'indirect']);
const ORACLE_INDEPENDENCE_VALUES = new Set(['independent', 'dependent']);
const TIMING_FRESHNESS_VALUES = new Set(['fresh', 'stale', 'fallback']);
const COVERAGE_STATUS_VALUES = new Set([
  'covered',
  'indirectly_covered',
  'ambiguous',
  'missing_test',
  'not_applicable',
]);

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function fail(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  throw error;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function addIssue(issues, path, reason) {
  issues.push({ path, reason });
}

function effectiveCostMs(grossCostMs, directEvidenceQualityBonusMs, independentOracleBonusMs) {
  const effective =
    BigInt(grossCostMs) - BigInt(directEvidenceQualityBonusMs) - BigInt(independentOracleBonusMs);
  return effective > 0n ? Number(effective) : 0;
}

function normalizeInput(input) {
  const issues = [];
  if (!isRecord(input)) {
    fail('MINIMAL_TEST_COVER_INPUT_INVALID', {
      issues: [{ path: '$', reason: 'must be an object' }],
    });
  }

  if (!Array.isArray(input.obligations)) {
    addIssue(issues, 'obligations', 'must be an array');
  }
  if (!Array.isArray(input.candidates)) {
    addIssue(issues, 'candidates', 'must be an array');
  }
  if (!isNonNegativeInteger(input.defaultDurationMs)) {
    addIssue(issues, 'defaultDurationMs', 'must be a non-negative safe integer');
  }

  const obligationIds = new Set();
  const obligations = (Array.isArray(input.obligations) ? input.obligations : []).map(
    (raw, index) => {
      const path = `obligations[${index}]`;
      if (!isRecord(raw)) {
        addIssue(issues, path, 'must be an object');
        return null;
      }
      if (!isNonEmptyString(raw.obligationId)) {
        addIssue(issues, `${path}.obligationId`, 'must be a non-empty trimmed string');
      } else if (obligationIds.has(raw.obligationId)) {
        addIssue(issues, `${path}.obligationId`, 'must be unique');
      } else {
        obligationIds.add(raw.obligationId);
      }
      if (!APPLICABILITY_VALUES.has(raw.applicability)) {
        addIssue(issues, `${path}.applicability`, 'must be applicable or not_applicable');
      }
      if (!MINIMUM_EVIDENCE_VALUES.has(raw.minimumEvidenceKind)) {
        addIssue(issues, `${path}.minimumEvidenceKind`, 'must be direct or indirect');
      }
      return {
        obligationId: raw.obligationId,
        applicability: raw.applicability,
        minimumEvidenceKind: raw.minimumEvidenceKind,
      };
    }
  );

  const candidateIds = new Set();
  const candidates = (Array.isArray(input.candidates) ? input.candidates : []).map((raw, index) => {
    const path = `candidates[${index}]`;
    if (!isRecord(raw)) {
      addIssue(issues, path, 'must be an object');
      return null;
    }
    if (!isNonEmptyString(raw.identityKey)) {
      addIssue(issues, `${path}.identityKey`, 'must be a non-empty trimmed string');
    } else if (candidateIds.has(raw.identityKey)) {
      addIssue(issues, `${path}.identityKey`, 'must be unique');
    } else {
      candidateIds.add(raw.identityKey);
    }
    if (!isRecord(raw.obligationEvidence)) {
      addIssue(issues, `${path}.obligationEvidence`, 'must be an object');
    }
    if (!ORACLE_INDEPENDENCE_VALUES.has(raw.oracleIndependence)) {
      addIssue(issues, `${path}.oracleIndependence`, 'must be independent or dependent');
    }
    if (!isNonEmptyString(raw.timingProvenance)) {
      addIssue(issues, `${path}.timingProvenance`, 'must be a non-empty trimmed string');
    }
    if (!TIMING_FRESHNESS_VALUES.has(raw.timingFreshness)) {
      addIssue(issues, `${path}.timingFreshness`, 'must be fresh, stale, or fallback');
    }

    const numericFields = [
      'flakePenaltyMs',
      'fragileFixturePenaltyMs',
      'redundancyPenaltyMs',
      'directEvidenceQualityBonusMs',
      'independentOracleBonusMs',
      'stabilityScore',
    ];
    for (const field of numericFields) {
      if (raw[field] !== undefined && !isNonNegativeInteger(raw[field])) {
        addIssue(issues, `${path}.${field}`, 'must be a non-negative safe integer');
      }
    }
    if (raw.estimatedDurationMs !== undefined && !isNonNegativeInteger(raw.estimatedDurationMs)) {
      addIssue(
        issues,
        `${path}.estimatedDurationMs`,
        'must be a non-negative safe integer when present'
      );
    }

    const evidenceEntries = [];
    if (isRecord(raw.obligationEvidence)) {
      for (const obligationId of Object.keys(raw.obligationEvidence).sort(compareText)) {
        const evidenceKind = raw.obligationEvidence[obligationId];
        if (!obligationIds.has(obligationId)) {
          addIssue(
            issues,
            `${path}.obligationEvidence.${obligationId}`,
            'references an unknown obligation'
          );
        }
        if (!EVIDENCE_VALUES.has(evidenceKind)) {
          addIssue(
            issues,
            `${path}.obligationEvidence.${obligationId}`,
            'must be direct, indirect, or ambiguous'
          );
        }
        evidenceEntries.push([obligationId, evidenceKind]);
      }
    }
    const obligationEvidence = Object.fromEntries(evidenceEntries);
    const oracleEntries = [];
    if (
      raw.obligationOracleIndependence !== undefined &&
      !isRecord(raw.obligationOracleIndependence)
    ) {
      addIssue(issues, `${path}.obligationOracleIndependence`, 'must be an object when present');
    }
    if (isRecord(raw.obligationOracleIndependence)) {
      for (const obligationId of Object.keys(raw.obligationOracleIndependence).sort(compareText)) {
        const oracleIndependence = raw.obligationOracleIndependence[obligationId];
        if (!Object.prototype.hasOwnProperty.call(obligationEvidence, obligationId)) {
          addIssue(
            issues,
            `${path}.obligationOracleIndependence.${obligationId}`,
            'must reference candidate obligationEvidence'
          );
        }
        if (!ORACLE_INDEPENDENCE_VALUES.has(oracleIndependence)) {
          addIssue(
            issues,
            `${path}.obligationOracleIndependence.${obligationId}`,
            'must be independent or dependent'
          );
        }
        oracleEntries.push([obligationId, oracleIndependence]);
      }
    }
    const obligationOracleIndependence = Object.fromEntries(oracleEntries);

    const duration =
      raw.estimatedDurationMs === undefined ? input.defaultDurationMs : raw.estimatedDurationMs;
    const flakePenaltyMs = raw.flakePenaltyMs ?? 0;
    const fragileFixturePenaltyMs = raw.fragileFixturePenaltyMs ?? 0;
    const redundancyPenaltyMs = raw.redundancyPenaltyMs ?? 0;
    const directEvidenceQualityBonusMs = raw.directEvidenceQualityBonusMs ?? 0;
    const independentOracleBonusMs = raw.independentOracleBonusMs ?? 0;
    const grossParts = [duration, flakePenaltyMs, fragileFixturePenaltyMs, redundancyPenaltyMs];
    const grossCostMs = grossParts.every(isNonNegativeInteger)
      ? grossParts.reduce((sum, value) => sum + value, 0)
      : Number.NaN;
    if (!Number.isSafeInteger(grossCostMs)) {
      addIssue(issues, path, 'gross cost must be a non-negative safe integer');
    }
    const totalCostMs =
      Number.isSafeInteger(grossCostMs) &&
      isNonNegativeInteger(directEvidenceQualityBonusMs) &&
      isNonNegativeInteger(independentOracleBonusMs)
        ? effectiveCostMs(grossCostMs, directEvidenceQualityBonusMs, independentOracleBonusMs)
        : Number.NaN;

    return {
      identityKey: raw.identityKey,
      obligationEvidence,
      obligationOracleIndependence,
      oracleIndependence: raw.oracleIndependence,
      estimatedDurationMs: duration,
      timingProvenance: raw.timingProvenance,
      timingFreshness: raw.timingFreshness,
      flakePenaltyMs,
      fragileFixturePenaltyMs,
      redundancyPenaltyMs,
      directEvidenceQualityBonusMs,
      independentOracleBonusMs,
      stabilityScore: raw.stabilityScore ?? 0,
      grossCostMs,
      totalCostMs,
    };
  });

  if (issues.length > 0) {
    fail('MINIMAL_TEST_COVER_INPUT_INVALID', { issues });
  }

  return {
    obligations: obligations.sort((left, right) =>
      compareText(left.obligationId, right.obligationId)
    ),
    candidates: candidates.sort((left, right) => compareText(left.identityKey, right.identityKey)),
  };
}

function evidenceMeetsMinimum(evidenceKind, minimumEvidenceKind) {
  return (
    evidenceKind === 'direct' || (minimumEvidenceKind === 'indirect' && evidenceKind === 'indirect')
  );
}

function oracleIndependenceForObligation(candidate, obligationId) {
  return candidate.obligationOracleIndependence?.[obligationId] ?? candidate.oracleIndependence;
}

function candidateCovers(candidate, obligation) {
  return (
    obligation.applicability === 'applicable' &&
    oracleIndependenceForObligation(candidate, obligation.obligationId) === 'independent' &&
    evidenceMeetsMinimum(
      candidate.obligationEvidence[obligation.obligationId],
      obligation.minimumEvidenceKind
    )
  );
}

function candidateMetrics(candidate, obligations) {
  const coveredObligations = obligations.filter((obligation) =>
    candidateCovers(candidate, obligation)
  );
  return {
    candidate,
    newlyCoveredObligationIds: coveredObligations.map((item) => item.obligationId),
    newlyCoveredCount: coveredObligations.length,
    directEvidenceCount: coveredObligations.filter(
      (item) => candidate.obligationEvidence[item.obligationId] === 'direct'
    ).length,
    independentOracle:
      coveredObligations.length > 0 &&
      coveredObligations.every(
        (item) => oracleIndependenceForObligation(candidate, item.obligationId) === 'independent'
      )
        ? 1
        : 0,
    freshTiming: candidate.timingFreshness === 'fresh' ? 1 : 0,
  };
}

function compareCandidatePriority(left, right) {
  const leftRatio = BigInt(left.candidate.totalCostMs) * BigInt(right.newlyCoveredCount);
  const rightRatio = BigInt(right.candidate.totalCostMs) * BigInt(left.newlyCoveredCount);
  if (leftRatio !== rightRatio) return leftRatio < rightRatio ? -1 : 1;
  if (left.directEvidenceCount !== right.directEvidenceCount) {
    return right.directEvidenceCount - left.directEvidenceCount;
  }
  if (left.newlyCoveredCount !== right.newlyCoveredCount) {
    return right.newlyCoveredCount - left.newlyCoveredCount;
  }
  if (left.independentOracle !== right.independentOracle) {
    return right.independentOracle - left.independentOracle;
  }
  if (left.candidate.stabilityScore !== right.candidate.stabilityScore) {
    return right.candidate.stabilityScore - left.candidate.stabilityScore;
  }
  if (left.freshTiming !== right.freshTiming) {
    return right.freshTiming - left.freshTiming;
  }
  if (left.candidate.estimatedDurationMs !== right.candidate.estimatedDurationMs) {
    return left.candidate.estimatedDurationMs - right.candidate.estimatedDurationMs;
  }
  return compareText(left.candidate.identityKey, right.candidate.identityKey);
}

function evidenceDiagnostics(obligation, candidates) {
  return candidates
    .filter((candidate) =>
      Object.prototype.hasOwnProperty.call(candidate.obligationEvidence, obligation.obligationId)
    )
    .map((candidate) => {
      const evidenceKind = candidate.obligationEvidence[obligation.obligationId];
      return {
        identityKey: candidate.identityKey,
        evidenceKind,
        oracleIndependence: oracleIndependenceForObligation(candidate, obligation.obligationId),
        meetsMinimumEvidenceKind: evidenceMeetsMinimum(
          evidenceKind,
          obligation.minimumEvidenceKind
        ),
        eligibleForCoverage: candidateCovers(candidate, obligation),
      };
    });
}

function coverageStatus(obligation, diagnostics, selectedEvidence) {
  if (obligation.applicability === 'not_applicable') return 'not_applicable';
  if (selectedEvidence.some((item) => item.evidenceKind === 'direct')) return 'covered';
  if (selectedEvidence.length > 0) return 'indirectly_covered';
  if (diagnostics.some((item) => item.evidenceKind === 'ambiguous')) return 'ambiguous';
  return 'missing_test';
}

function projectCoverage(obligations, candidates, selected, availabilityMode = false) {
  const selectedIds = new Set(selected.map((candidate) => candidate.identityKey));
  return obligations.map((obligation) => {
    const diagnostics = evidenceDiagnostics(obligation, candidates);
    const selectedEvidence = diagnostics
      .filter(
        (item) =>
          item.eligibleForCoverage && (availabilityMode || selectedIds.has(item.identityKey))
      )
      .map(({ identityKey, evidenceKind }) => ({ identityKey, evidenceKind }));
    return {
      obligationId: obligation.obligationId,
      applicability: obligation.applicability,
      minimumEvidenceKind: obligation.minimumEvidenceKind,
      status: coverageStatus(obligation, diagnostics, selectedEvidence),
      selectedEvidence: availabilityMode ? [] : selectedEvidence,
      evidenceDiagnostics: diagnostics,
    };
  });
}

function coversAll(selected, obligations) {
  return obligations.every((obligation) =>
    selected.some((candidate) => candidateCovers(candidate, obligation))
  );
}

function eliminateRedundancy(selected, obligations) {
  const metrics = new Map(
    selected.map((candidate) => [candidate.identityKey, candidateMetrics(candidate, obligations)])
  );
  const worstFirst = selected
    .slice()
    .sort((left, right) =>
      compareCandidatePriority(metrics.get(right.identityKey), metrics.get(left.identityKey))
    );
  let reduced = selected.slice();
  for (const candidate of worstFirst) {
    const withoutCandidate = reduced.filter((item) => item.identityKey !== candidate.identityKey);
    if (coversAll(withoutCandidate, obligations)) reduced = withoutCandidate;
  }
  return reduced;
}

function countRedundantSelected(selected, obligations) {
  return selected.filter((candidate) =>
    coversAll(
      selected.filter((item) => item.identityKey !== candidate.identityKey),
      obligations
    )
  ).length;
}

function projectCandidateEvidence(candidate) {
  return {
    identityKey: candidate.identityKey,
    obligationEvidence: candidate.obligationEvidence,
    obligationOracleIndependence: candidate.obligationOracleIndependence,
    oracleIndependence: candidate.oracleIndependence,
  };
}

function projectSelected(candidate, obligations) {
  return {
    identityKey: candidate.identityKey,
    obligationEvidence: candidate.obligationEvidence,
    obligationOracleIndependence: candidate.obligationOracleIndependence,
    oracleIndependence: candidate.oracleIndependence,
    estimatedDurationMs: candidate.estimatedDurationMs,
    timingProvenance: candidate.timingProvenance,
    timingFreshness: candidate.timingFreshness,
    flakePenaltyMs: candidate.flakePenaltyMs,
    fragileFixturePenaltyMs: candidate.fragileFixturePenaltyMs,
    redundancyPenaltyMs: candidate.redundancyPenaltyMs,
    directEvidenceQualityBonusMs: candidate.directEvidenceQualityBonusMs,
    independentOracleBonusMs: candidate.independentOracleBonusMs,
    stabilityScore: candidate.stabilityScore,
    grossCostMs: candidate.grossCostMs,
    totalCostMs: candidate.totalCostMs,
    coveredObligationIds: obligations
      .filter((obligation) => candidateCovers(candidate, obligation))
      .map((obligation) => obligation.obligationId),
  };
}

function selectMinimalTestCover(input, options = {}) {
  const allowUnmapped = options.allowUnmapped === true;
  const { obligations, candidates } = normalizeInput(input);
  const applicableObligations = obligations.filter(
    (obligation) => obligation.applicability === 'applicable'
  );
  const unmappedObligations = applicableObligations.filter(
    (obligation) => !candidates.some((candidate) => candidateCovers(candidate, obligation))
  );

  if (unmappedObligations.length > 0 && !allowUnmapped) {
    const coverage = projectCoverage(obligations, candidates, [], true);
    fail('SEMANTIC_OBLIGATION_UNMAPPED', {
      coverage,
      gates: {
        unmappedApplicableObligationCount: unmappedObligations.length,
        selectionDuplicateCount: 0,
        redundantSelectedTestCount: 0,
      },
    });
  }

  const unmappedIds = new Set(unmappedObligations.map((item) => item.obligationId));
  const selectableObligations = applicableObligations.filter(
    (obligation) => !unmappedIds.has(obligation.obligationId)
  );
  const remaining = new Set(selectableObligations.map((item) => item.obligationId));
  const selected = [];
  const selectedIds = new Set();
  while (remaining.size > 0) {
    const remainingObligations = selectableObligations.filter((item) =>
      remaining.has(item.obligationId)
    );
    const ranked = candidates
      .filter((candidate) => !selectedIds.has(candidate.identityKey))
      .map((candidate) => candidateMetrics(candidate, remainingObligations))
      .filter((metrics) => metrics.newlyCoveredCount > 0)
      .sort(compareCandidatePriority);
    if (ranked.length === 0) {
      fail('SEMANTIC_OBLIGATION_UNMAPPED', {
        coverage: projectCoverage(obligations, candidates, selected),
      });
    }
    const winner = ranked[0];
    selected.push(winner.candidate);
    selectedIds.add(winner.candidate.identityKey);
    for (const obligationId of winner.newlyCoveredObligationIds) remaining.delete(obligationId);
  }

  const reduced = eliminateRedundancy(selected, selectableObligations).sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  const result = {
    schemaVersion: SCHEMA_VERSION,
    candidateEvidence: candidates.map(projectCandidateEvidence),
    selected: reduced.map((candidate) => projectSelected(candidate, applicableObligations)),
    coverage: projectCoverage(obligations, candidates, reduced),
    gates: {
      unmappedApplicableObligationCount: unmappedObligations.length,
      selectionDuplicateCount:
        reduced.length - new Set(reduced.map((item) => item.identityKey)).size,
      redundantSelectedTestCount: countRedundantSelected(reduced, selectableObligations),
    },
  };

  return validateMinimalTestCoverResult(result, { allowUnmapped });
}

function sameOrderedValues(values, expected) {
  return (
    values.length === expected.length && values.every((value, index) => value === expected[index])
  );
}

function deriveCoveredObligationIds(selectedItem, coverage) {
  if (!isRecord(selectedItem) || !isRecord(selectedItem.obligationEvidence)) {
    return [];
  }
  return coverage
    .filter(
      (item) =>
        isRecord(item) &&
        item.applicability === 'applicable' &&
        MINIMUM_EVIDENCE_VALUES.has(item.minimumEvidenceKind) &&
        oracleIndependenceForObligation(selectedItem, item.obligationId) === 'independent' &&
        evidenceMeetsMinimum(
          selectedItem.obligationEvidence[item.obligationId],
          item.minimumEvidenceKind
        )
    )
    .map((item) => item.obligationId);
}

function expectedSelectedEvidence(coverageItem, selected, derivedCoverageByIdentity) {
  if (!isRecord(coverageItem)) return [];
  return selected
    .filter(
      (item) =>
        isRecord(item) &&
        derivedCoverageByIdentity.get(item.identityKey)?.includes(coverageItem.obligationId)
    )
    .map((item) => ({
      identityKey: item.identityKey,
      evidenceKind: item.obligationEvidence[coverageItem.obligationId],
    }));
}

function sameSelectedEvidence(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every(
      (entry, index) =>
        isRecord(entry) &&
        entry.identityKey === expected[index].identityKey &&
        entry.evidenceKind === expected[index].evidenceKind
    )
  );
}

function sameObligationEvidence(left, right) {
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  return (
    sameOrderedValues(leftIds, rightIds) &&
    leftIds.every((obligationId) => left[obligationId] === right[obligationId])
  );
}

function sameObligationOracleIndependence(left, right) {
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  return (
    sameOrderedValues(leftIds, rightIds) &&
    leftIds.every((obligationId) => left[obligationId] === right[obligationId])
  );
}

function expectedEvidenceDiagnostics(coverageItem, candidateEvidence) {
  if (!isRecord(coverageItem)) return [];
  return candidateEvidence
    .filter(
      (candidate) =>
        isRecord(candidate) &&
        isRecord(candidate.obligationEvidence) &&
        Object.prototype.hasOwnProperty.call(
          candidate.obligationEvidence,
          coverageItem.obligationId
        )
    )
    .map((candidate) => {
      const evidenceKind = candidate.obligationEvidence[coverageItem.obligationId];
      const meetsMinimumEvidenceKind = evidenceMeetsMinimum(
        evidenceKind,
        coverageItem.minimumEvidenceKind
      );
      return {
        identityKey: candidate.identityKey,
        evidenceKind,
        oracleIndependence: oracleIndependenceForObligation(candidate, coverageItem.obligationId),
        meetsMinimumEvidenceKind,
        eligibleForCoverage:
          coverageItem.applicability === 'applicable' &&
          oracleIndependenceForObligation(candidate, coverageItem.obligationId) === 'independent' &&
          meetsMinimumEvidenceKind,
      };
    });
}

function sameEvidenceDiagnostics(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every(
      (item, index) =>
        isRecord(item) &&
        item.identityKey === expected[index].identityKey &&
        item.evidenceKind === expected[index].evidenceKind &&
        item.oracleIndependence === expected[index].oracleIndependence &&
        item.meetsMinimumEvidenceKind === expected[index].meetsMinimumEvidenceKind &&
        item.eligibleForCoverage === expected[index].eligibleForCoverage
    )
  );
}

function validateMinimalTestCoverResult(result, options = {}) {
  const allowUnmapped = options.allowUnmapped === true;
  const issues = [];
  if (!isRecord(result)) {
    fail('MINIMAL_TEST_COVER_RESULT_INVALID', {
      issues: [{ path: '$', reason: 'must be an object' }],
    });
  }
  if (result.schemaVersion !== SCHEMA_VERSION) {
    addIssue(issues, 'schemaVersion', `must equal ${SCHEMA_VERSION}`);
  }
  if (!Array.isArray(result.selected)) addIssue(issues, 'selected', 'must be an array');
  if (!Array.isArray(result.coverage)) addIssue(issues, 'coverage', 'must be an array');
  if (!isRecord(result.gates)) addIssue(issues, 'gates', 'must be an object');

  const coverage = Array.isArray(result.coverage) ? result.coverage : [];
  const coverageIds = coverage.map((item) => item?.obligationId);
  const canonicalCoverageIds = coverageIds.slice().sort(compareText);
  if (
    coverageIds.some((obligationId) => !isNonEmptyString(obligationId)) ||
    new Set(coverageIds).size !== coverageIds.length ||
    !sameOrderedValues(coverageIds, canonicalCoverageIds)
  ) {
    addIssue(issues, 'coverage', 'must use unique canonical obligationId order');
  }
  const coverageById = new Map(
    coverage
      .filter((item) => isRecord(item) && isNonEmptyString(item.obligationId))
      .map((item) => [item.obligationId, item])
  );

  const candidateEvidence = Array.isArray(result.candidateEvidence) ? result.candidateEvidence : [];
  if (!Array.isArray(result.candidateEvidence)) {
    addIssue(issues, 'candidateEvidence', 'must be an array');
  }
  const candidateEvidenceIds = candidateEvidence.map((item) => item?.identityKey);
  if (
    candidateEvidenceIds.some((identityKey) => !isNonEmptyString(identityKey)) ||
    new Set(candidateEvidenceIds).size !== candidateEvidenceIds.length ||
    !sameOrderedValues(candidateEvidenceIds, candidateEvidenceIds.slice().sort(compareText))
  ) {
    addIssue(issues, 'candidateEvidence', 'must use unique canonical identityKey order');
  }
  const candidateEvidenceById = new Map();
  for (const [index, item] of candidateEvidence.entries()) {
    const path = `candidateEvidence[${index}]`;
    if (!isRecord(item)) {
      addIssue(issues, path, 'must be an object');
      continue;
    }
    if (!isNonEmptyString(item.identityKey)) {
      addIssue(issues, `${path}.identityKey`, 'must be a non-empty trimmed string');
    } else {
      candidateEvidenceById.set(item.identityKey, item);
    }
    if (!ORACLE_INDEPENDENCE_VALUES.has(item.oracleIndependence)) {
      addIssue(issues, `${path}.oracleIndependence`, 'is invalid');
    }
    if (!isRecord(item.obligationEvidence)) {
      addIssue(issues, `${path}.obligationEvidence`, 'must be an object');
      continue;
    }
    const obligationIds = Object.keys(item.obligationEvidence);
    if (!sameOrderedValues(obligationIds, obligationIds.slice().sort(compareText))) {
      addIssue(issues, `${path}.obligationEvidence`, 'must use canonical obligationId order');
    }
    for (const obligationId of obligationIds) {
      if (!coverageById.has(obligationId)) {
        addIssue(
          issues,
          `${path}.obligationEvidence.${obligationId}`,
          'references an unknown obligation'
        );
      }
      if (!EVIDENCE_VALUES.has(item.obligationEvidence[obligationId])) {
        addIssue(issues, `${path}.obligationEvidence.${obligationId}`, 'contains invalid evidence');
      }
    }
    if (!isRecord(item.obligationOracleIndependence)) {
      addIssue(issues, `${path}.obligationOracleIndependence`, 'must be an object');
    } else {
      const oracleIds = Object.keys(item.obligationOracleIndependence);
      if (!sameOrderedValues(oracleIds, oracleIds.slice().sort(compareText))) {
        addIssue(
          issues,
          `${path}.obligationOracleIndependence`,
          'must use canonical obligationId order'
        );
      }
      for (const obligationId of oracleIds) {
        if (!Object.prototype.hasOwnProperty.call(item.obligationEvidence, obligationId)) {
          addIssue(
            issues,
            `${path}.obligationOracleIndependence.${obligationId}`,
            'must reference candidate obligationEvidence'
          );
        }
        if (!ORACLE_INDEPENDENCE_VALUES.has(item.obligationOracleIndependence[obligationId])) {
          addIssue(
            issues,
            `${path}.obligationOracleIndependence.${obligationId}`,
            'contains invalid Oracle independence'
          );
        }
      }
    }
  }

  const selected = Array.isArray(result.selected) ? result.selected : [];
  const selectedIds = selected.map((item) => item?.identityKey);
  const selectedById = new Map(
    selected
      .filter((item) => isRecord(item) && isNonEmptyString(item.identityKey))
      .map((item) => [item.identityKey, item])
  );
  const canonicalSelectedIds = selectedIds.slice().sort(compareText);
  if (
    selectedIds.some((identityKey) => !isNonEmptyString(identityKey)) ||
    !sameOrderedValues(selectedIds, canonicalSelectedIds)
  ) {
    addIssue(issues, 'selected', 'must use canonical identityKey order');
  }
  const selectionDuplicateCount = selectedIds.length - new Set(selectedIds).size;
  const derivedCoverageByIdentity = new Map();

  for (const [index, item] of selected.entries()) {
    const path = `selected[${index}]`;
    if (!isRecord(item)) {
      addIssue(issues, path, 'must be an object');
      continue;
    }
    if (!ORACLE_INDEPENDENCE_VALUES.has(item.oracleIndependence)) {
      addIssue(issues, `${path}.oracleIndependence`, 'is invalid');
    }
    if (!isNonEmptyString(item.timingProvenance)) {
      addIssue(issues, `${path}.timingProvenance`, 'must be a non-empty trimmed string');
    }
    if (!TIMING_FRESHNESS_VALUES.has(item.timingFreshness)) {
      addIssue(issues, `${path}.timingFreshness`, 'must be fresh, stale, or fallback');
    }

    for (const field of [
      'estimatedDurationMs',
      'flakePenaltyMs',
      'fragileFixturePenaltyMs',
      'redundancyPenaltyMs',
      'directEvidenceQualityBonusMs',
      'independentOracleBonusMs',
      'stabilityScore',
      'grossCostMs',
      'totalCostMs',
    ]) {
      if (!isNonNegativeInteger(item[field])) {
        addIssue(issues, `${path}.${field}`, 'must be a non-negative safe integer');
      }
    }

    const grossParts = [
      item.estimatedDurationMs,
      item.flakePenaltyMs,
      item.fragileFixturePenaltyMs,
      item.redundancyPenaltyMs,
    ];
    const expectedGrossCostMs = grossParts.every(isNonNegativeInteger)
      ? grossParts.reduce((sum, value) => sum + value, 0)
      : Number.NaN;
    if (!Number.isSafeInteger(expectedGrossCostMs) || item.grossCostMs !== expectedGrossCostMs) {
      addIssue(issues, `${path}.grossCostMs`, 'must equal duration plus penalties');
    }
    if (
      isNonNegativeInteger(item.grossCostMs) &&
      isNonNegativeInteger(item.directEvidenceQualityBonusMs) &&
      isNonNegativeInteger(item.independentOracleBonusMs) &&
      item.totalCostMs !==
        effectiveCostMs(
          item.grossCostMs,
          item.directEvidenceQualityBonusMs,
          item.independentOracleBonusMs
        )
    ) {
      addIssue(issues, `${path}.totalCostMs`, 'must equal clamped gross cost minus bonuses');
    }

    if (!isRecord(item.obligationEvidence)) {
      addIssue(issues, `${path}.obligationEvidence`, 'must be an object');
    } else {
      const evidenceIds = Object.keys(item.obligationEvidence);
      if (!sameOrderedValues(evidenceIds, evidenceIds.slice().sort(compareText))) {
        addIssue(issues, `${path}.obligationEvidence`, 'must use canonical obligationId order');
      }
      for (const obligationId of evidenceIds) {
        if (!coverageById.has(obligationId)) {
          addIssue(
            issues,
            `${path}.obligationEvidence.${obligationId}`,
            'references an unknown obligation'
          );
        }
        if (!EVIDENCE_VALUES.has(item.obligationEvidence[obligationId])) {
          addIssue(
            issues,
            `${path}.obligationEvidence.${obligationId}`,
            'contains invalid evidence'
          );
        }
      }
    }
    if (!isRecord(item.obligationOracleIndependence)) {
      addIssue(issues, `${path}.obligationOracleIndependence`, 'must be an object');
    } else {
      const oracleIds = Object.keys(item.obligationOracleIndependence);
      if (!sameOrderedValues(oracleIds, oracleIds.slice().sort(compareText))) {
        addIssue(
          issues,
          `${path}.obligationOracleIndependence`,
          'must use canonical obligationId order'
        );
      }
      for (const obligationId of oracleIds) {
        if (
          !isRecord(item.obligationEvidence) ||
          !Object.prototype.hasOwnProperty.call(item.obligationEvidence, obligationId)
        ) {
          addIssue(
            issues,
            `${path}.obligationOracleIndependence.${obligationId}`,
            'must reference selected obligationEvidence'
          );
        }
        if (!ORACLE_INDEPENDENCE_VALUES.has(item.obligationOracleIndependence[obligationId])) {
          addIssue(
            issues,
            `${path}.obligationOracleIndependence.${obligationId}`,
            'contains invalid Oracle independence'
          );
        }
      }
    }
    const authoritativeCandidate = candidateEvidenceById.get(item.identityKey);
    if (
      !authoritativeCandidate ||
      authoritativeCandidate.oracleIndependence !== item.oracleIndependence ||
      !sameObligationEvidence(authoritativeCandidate.obligationEvidence, item.obligationEvidence) ||
      !sameObligationOracleIndependence(
        authoritativeCandidate.obligationOracleIndependence,
        item.obligationOracleIndependence
      )
    ) {
      addIssue(issues, path, 'must exactly match a candidateEvidence authority entry');
    }

    const derivedCoveredObligationIds = deriveCoveredObligationIds(item, coverage);
    if (isNonEmptyString(item.identityKey)) {
      derivedCoverageByIdentity.set(item.identityKey, derivedCoveredObligationIds);
    }
    if (!Array.isArray(item.coveredObligationIds)) {
      addIssue(issues, `${path}.coveredObligationIds`, 'must be an array');
      continue;
    }
    const canonicalIds = item.coveredObligationIds.slice().sort(compareText);
    if (
      new Set(item.coveredObligationIds).size !== item.coveredObligationIds.length ||
      !sameOrderedValues(item.coveredObligationIds, canonicalIds)
    ) {
      addIssue(issues, `${path}.coveredObligationIds`, 'must be unique and canonical');
    }
    if (!sameOrderedValues(item.coveredObligationIds, derivedCoveredObligationIds)) {
      addIssue(
        issues,
        `${path}.coveredObligationIds`,
        'must exactly match coverage derived from obligationEvidence'
      );
    }
  }

  const expectedStatusByObligation = new Map();
  for (const [index, item] of coverage.entries()) {
    const path = `coverage[${index}]`;
    if (!isRecord(item)) {
      addIssue(issues, path, 'must be an object');
      continue;
    }
    if (!APPLICABILITY_VALUES.has(item.applicability)) {
      addIssue(issues, `${path}.applicability`, 'is invalid');
    }
    if (!MINIMUM_EVIDENCE_VALUES.has(item.minimumEvidenceKind)) {
      addIssue(issues, `${path}.minimumEvidenceKind`, 'is invalid');
    }
    if (!COVERAGE_STATUS_VALUES.has(item.status)) {
      addIssue(issues, `${path}.status`, 'is invalid');
    }

    const diagnostics = Array.isArray(item.evidenceDiagnostics) ? item.evidenceDiagnostics : [];
    if (!Array.isArray(item.evidenceDiagnostics)) {
      addIssue(issues, `${path}.evidenceDiagnostics`, 'must be an array');
    }
    const diagnosticIds = diagnostics.map((entry) => entry?.identityKey);
    if (
      diagnosticIds.some((identityKey) => !isNonEmptyString(identityKey)) ||
      new Set(diagnosticIds).size !== diagnosticIds.length ||
      !sameOrderedValues(diagnosticIds, diagnosticIds.slice().sort(compareText))
    ) {
      addIssue(
        issues,
        `${path}.evidenceDiagnostics`,
        'must use unique canonical candidate identity order'
      );
    }
    const authoritativeDiagnostics = expectedEvidenceDiagnostics(item, candidateEvidence);
    if (!sameEvidenceDiagnostics(diagnostics, authoritativeDiagnostics)) {
      addIssue(
        issues,
        `${path}.evidenceDiagnostics`,
        'must exactly match diagnostics derived from candidateEvidence'
      );
    }
    const validDiagnostics = [];
    const diagnosticByIdentity = new Map();
    for (const [diagnosticIndex, diagnostic] of diagnostics.entries()) {
      const diagnosticPath = `${path}.evidenceDiagnostics[${diagnosticIndex}]`;
      if (!isRecord(diagnostic)) {
        addIssue(issues, diagnosticPath, 'must be an object');
        continue;
      }
      if (!isNonEmptyString(diagnostic.identityKey)) {
        addIssue(issues, `${diagnosticPath}.identityKey`, 'must be a non-empty trimmed string');
      }
      if (!EVIDENCE_VALUES.has(diagnostic.evidenceKind)) {
        addIssue(issues, `${diagnosticPath}.evidenceKind`, 'is invalid');
      }
      if (!ORACLE_INDEPENDENCE_VALUES.has(diagnostic.oracleIndependence)) {
        addIssue(issues, `${diagnosticPath}.oracleIndependence`, 'is invalid');
      }
      const expectedMeetsMinimum = evidenceMeetsMinimum(
        diagnostic.evidenceKind,
        item.minimumEvidenceKind
      );
      const expectedEligible =
        item.applicability === 'applicable' &&
        diagnostic.oracleIndependence === 'independent' &&
        expectedMeetsMinimum;
      if (diagnostic.meetsMinimumEvidenceKind !== expectedMeetsMinimum) {
        addIssue(
          issues,
          `${diagnosticPath}.meetsMinimumEvidenceKind`,
          `must equal ${expectedMeetsMinimum}`
        );
      }
      if (diagnostic.eligibleForCoverage !== expectedEligible) {
        addIssue(issues, `${diagnosticPath}.eligibleForCoverage`, `must equal ${expectedEligible}`);
      }
      if (isNonEmptyString(diagnostic.identityKey)) {
        diagnosticByIdentity.set(diagnostic.identityKey, diagnostic);
      }
      validDiagnostics.push(diagnostic);
    }

    for (const selectedItem of selectedById.values()) {
      const hasEvidence =
        isRecord(selectedItem.obligationEvidence) &&
        Object.prototype.hasOwnProperty.call(selectedItem.obligationEvidence, item.obligationId);
      const diagnostic = diagnosticByIdentity.get(selectedItem.identityKey);
      if (
        hasEvidence &&
        (!diagnostic ||
          diagnostic.evidenceKind !== selectedItem.obligationEvidence[item.obligationId] ||
          diagnostic.oracleIndependence !==
            oracleIndependenceForObligation(selectedItem, item.obligationId))
      ) {
        addIssue(
          issues,
          `${path}.evidenceDiagnostics`,
          `must contain exact evidence for selected test ${selectedItem.identityKey}`
        );
      }
      if (!hasEvidence && diagnostic) {
        addIssue(
          issues,
          `${path}.evidenceDiagnostics`,
          `must not invent evidence for selected test ${selectedItem.identityKey}`
        );
      }
    }

    const selectedEvidence = Array.isArray(item.selectedEvidence) ? item.selectedEvidence : [];
    if (!Array.isArray(item.selectedEvidence)) {
      addIssue(issues, `${path}.selectedEvidence`, 'must be an array');
    }
    const selectedEvidenceIds = selectedEvidence.map((entry) => entry?.identityKey);
    if (
      selectedEvidenceIds.some((identityKey) => !isNonEmptyString(identityKey)) ||
      new Set(selectedEvidenceIds).size !== selectedEvidenceIds.length ||
      !sameOrderedValues(selectedEvidenceIds, selectedEvidenceIds.slice().sort(compareText))
    ) {
      addIssue(
        issues,
        `${path}.selectedEvidence`,
        'must reference unique selected tests canonically'
      );
    }
    for (const [evidenceIndex, entry] of selectedEvidence.entries()) {
      const evidencePath = `${path}.selectedEvidence[${evidenceIndex}]`;
      if (!isRecord(entry)) {
        addIssue(issues, evidencePath, 'must be an object');
        continue;
      }
      if (!selectedById.has(entry.identityKey)) {
        addIssue(issues, `${evidencePath}.identityKey`, 'must reference a selected test');
      }
      if (!['direct', 'indirect'].includes(entry.evidenceKind)) {
        addIssue(issues, `${evidencePath}.evidenceKind`, 'is invalid');
      }
    }

    const expectedEvidence = expectedSelectedEvidence(item, selected, derivedCoverageByIdentity);
    if (!sameSelectedEvidence(selectedEvidence, expectedEvidence)) {
      addIssue(
        issues,
        `${path}.selectedEvidence`,
        'must exactly match evidence derived from selected tests'
      );
    }
    for (const entry of expectedEvidence) {
      const diagnostic = diagnosticByIdentity.get(entry.identityKey);
      if (
        !diagnostic ||
        diagnostic.evidenceKind !== entry.evidenceKind ||
        diagnostic.oracleIndependence !== 'independent' ||
        diagnostic.eligibleForCoverage !== true
      ) {
        addIssue(
          issues,
          `${path}.evidenceDiagnostics`,
          `must justify selected evidence for ${entry.identityKey}`
        );
      }
    }

    const expectedStatus = coverageStatus(item, authoritativeDiagnostics, expectedEvidence);
    expectedStatusByObligation.set(item.obligationId, expectedStatus);
    if (item.status !== expectedStatus) {
      addIssue(issues, `${path}.status`, `must equal ${expectedStatus}`);
    }
  }

  const applicableIds = coverage
    .filter(
      (item) =>
        item?.applicability === 'applicable' &&
        ['covered', 'indirectly_covered'].includes(
          expectedStatusByObligation.get(item.obligationId)
        )
    )
    .map((item) => item.obligationId);
  const validSelected = selected.filter(
    (item) => isRecord(item) && isNonEmptyString(item.identityKey)
  );
  const redundantSelectedTestCount = validSelected.filter((removed) =>
    applicableIds.every((obligationId) =>
      validSelected
        .filter((item) => item !== removed)
        .some((item) => derivedCoverageByIdentity.get(item.identityKey)?.includes(obligationId))
    )
  ).length;
  const unmappedApplicableObligationCount = coverage.filter(
    (item) =>
      item?.applicability === 'applicable' &&
      !['covered', 'indirectly_covered'].includes(expectedStatusByObligation.get(item.obligationId))
  ).length;

  const expectedGates = {
    unmappedApplicableObligationCount,
    selectionDuplicateCount,
    redundantSelectedTestCount,
  };
  for (const [gate, expected] of Object.entries(expectedGates)) {
    if (!isRecord(result.gates) || result.gates[gate] !== expected) {
      addIssue(issues, `gates.${gate}`, `must equal ${expected}`);
    }
    if (expected !== 0 && !(allowUnmapped && gate === 'unmappedApplicableObligationCount')) {
      addIssue(issues, `gates.${gate}`, 'must be zero');
    }
  }

  if (issues.length > 0) fail('MINIMAL_TEST_COVER_RESULT_INVALID', { issues });
  return result;
}

module.exports = {
  selectMinimalTestCover,
  validateMinimalTestCoverResult,
};
