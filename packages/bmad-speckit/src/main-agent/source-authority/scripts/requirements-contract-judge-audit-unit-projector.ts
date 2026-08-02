import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonObject = Readonly<Record<string, unknown>>;
type UnitKind = 'must' | 'standalone';
type RequirementKind = 'functional' | 'nonfunctional' | 'negative';
type ApplicabilityDecision = 'applicable' | 'not_applicable' | 'unresolved' | 'invalid';

export interface JudgeAuditApplicability {
  decision: ApplicabilityDecision;
  reasonCode: string;
  proofRefs: readonly string[];
}

export interface JudgeAuditCanonicalRequirementRoot {
  rootRef: string;
  requirementKind: RequirementKind;
  payloadHash: string;
  sourceSpanRefs: readonly string[];
  applicability: JudgeAuditApplicability;
  authorityProofRefs: readonly string[];
}

export interface JudgeAuditCanonicalAcceptanceRoot {
  rootRef: string;
  payloadHash: string;
  sourceSpanRefs: readonly string[];
  requirementRefs: readonly string[];
  applicability: JudgeAuditApplicability;
  authorityProofRefs: readonly string[];
}

export interface JudgeAuditCanonicalRootUniverse {
  semanticConservationManifestHash: string;
  acceptanceRootProofManifestHash: string;
  requirementRoots: readonly JudgeAuditCanonicalRequirementRoot[];
  acceptanceRoots: readonly JudgeAuditCanonicalAcceptanceRoot[];
}

export interface JudgeAuditRootBinding {
  rootRef: string;
  sourceSpanRefs: readonly string[];
  testRefs: readonly string[];
  fixtureRefs: readonly string[];
  assertionRefs: readonly string[];
  changedPathRefs: readonly string[];
  observedSequenceRefs: readonly string[];
  deterministicReportRefs: readonly string[];
  evidenceRefs: readonly string[];
  proofRefs: readonly string[];
}

export interface JudgeAuditUnitProjectionInput {
  requirementSetId: string;
  sourceAuthorityHash: string;
  semanticModelHash: string;
  canonicalTraceGraphHash: string;
  canonicalRootUniverse: JudgeAuditCanonicalRootUniverse;
  semanticModel: JsonObject;
  compactTraceMatrix: JsonObject;
  rootBindings: readonly JudgeAuditRootBinding[];
}

export interface JudgeAuditUnit {
  unitId: string;
  unitKind: UnitKind;
  requirementRef: string;
  rootRefs: string[];
  sourceSpanRefs: string[];
  traceRowRefs: string[];
  targetRefs: string[];
  sequenceStepRefs: string[];
  redRefs: string[];
  oracleRefs: string[];
  changedPathRefs: string[];
  commandRefs: string[];
  evidenceRefs: string[];
  testRefs: string[];
  fixtureRefs: string[];
  assertionRefs: string[];
  observedSequenceRefs: string[];
  deterministicReportRefs: string[];
  proofRefs: string[];
  unitHash: string;
}

export interface JudgeAuditUnitProjectionResult {
  schemaVersion: 'requirements-contract-judge-audit-unit-set/v1';
  authority: 'none';
  requirementSetId: string;
  sourceAuthorityHash: string;
  semanticModelHash: string;
  canonicalTraceGraphHash: string;
  canonicalRootUniverse: JudgeAuditCanonicalRootUniverse;
  judgeAuditUniverseHash: string;
  judgeAuditUnitSetHash: string;
  rootUniverse: {
    requirementRootRefs: string[];
    negativeRootRefs: string[];
    acceptanceRootRefs: string[];
    allRootRefs: string[];
  };
  rootToUnit: Array<{ rootRef: string; unitId: string }>;
  unitToRoot: Array<{ unitId: string; rootRefs: string[] }>;
  units: JudgeAuditUnit[];
  coverage: {
    applicableRootCount: number;
    unitCount: number;
    mustUnitCount: number;
    standaloneUnitCount: number;
    missingRootCount: number;
    extraRootCount: number;
    orphanRootCount: number;
    duplicateRootCount: number;
    missingRootBindingCount: number;
    rootPayloadMismatchCount: number;
    semanticRootMismatchCount: number;
    acceptanceRootMismatchCount: number;
    invalidAssociationEdgeCount: number;
    unitEvidenceCompleteness: 0 | 1;
    mustUnitCoverage: 0 | 1;
    negativeRootCoverage: 0 | 1;
    acceptanceRootCoverage: 0 | 1;
  };
  blockingReasons: string[];
  decision: 'pass' | 'block';
}

interface MutableUnit {
  unitId: string;
  unitKind: UnitKind;
  requirementRef: string;
  rootRefs: Set<string>;
  sourceSpanRefs: Set<string>;
  traceRowRefs: Set<string>;
  targetRefs: Set<string>;
  sequenceStepRefs: Set<string>;
  redRefs: Set<string>;
  oracleRefs: Set<string>;
  changedPathRefs: Set<string>;
  commandRefs: Set<string>;
  evidenceRefs: Set<string>;
  testRefs: Set<string>;
  fixtureRefs: Set<string>;
  assertionRefs: Set<string>;
  observedSequenceRefs: Set<string>;
  deterministicReportRefs: Set<string>;
  proofRefs: Set<string>;
}

function record(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(text)
        .filter(Boolean)
    : [];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function objectEntries(value: unknown): Array<[string, JsonObject]> {
  return Object.entries(record(value)).filter(
    (entry): entry is [string, JsonObject] => Boolean(entry[1]) && typeof entry[1] === 'object'
  );
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function applicableNode(node: JsonObject): boolean {
  const applicability = record(node.applicability);
  return applicability.decision === undefined || applicability.decision === 'applicable';
}

function semanticBody(semanticBodies: JsonObject, node: JsonObject): JsonObject {
  const bodyHash = text(node.bodyHash);
  return bodyHash ? record(semanticBodies[bodyHash]) : {};
}

function semanticRequirementKind(
  semanticBodies: JsonObject,
  node: JsonObject
): RequirementKind | null {
  const kind = semanticBody(semanticBodies, node).kind;
  return kind === 'functional' || kind === 'nonfunctional' || kind === 'negative' ? kind : null;
}

function dimensionRefs(row: JsonObject, dimensionName: string): string[] {
  const dimension = record(record(row.dimensions)[dimensionName]);
  return dimension.state === 'bound' ? strings(dimension.refs) : [];
}

function dimensionProofRefs(row: JsonObject, dimensionName: string): string[] {
  const dimension = record(record(row.dimensions)[dimensionName]);
  return dimension.state === 'bound' ? strings(dimension.proofRefs) : [];
}

function unitKey(kind: UnitKind, requirementRef: string): string {
  return `${kind}:${requirementRef}`;
}

function unitId(kind: UnitKind, requirementRef: string): string {
  return `JUDGE-AUDIT-UNIT-${kind.toUpperCase()}-${requirementRef}`;
}

function newUnit(kind: UnitKind, requirementRef: string): MutableUnit {
  return {
    unitId: unitId(kind, requirementRef),
    unitKind: kind,
    requirementRef,
    rootRefs: new Set(),
    sourceSpanRefs: new Set(),
    traceRowRefs: new Set(),
    targetRefs: new Set(),
    sequenceStepRefs: new Set(),
    redRefs: new Set(),
    oracleRefs: new Set(),
    changedPathRefs: new Set(),
    commandRefs: new Set(),
    evidenceRefs: new Set(),
    testRefs: new Set(),
    fixtureRefs: new Set(),
    assertionRefs: new Set(),
    observedSequenceRefs: new Set(),
    deterministicReportRefs: new Set(),
    proofRefs: new Set(),
  };
}

function addRefs(target: Set<string>, values: Iterable<string>): void {
  for (const value of values) target.add(value);
}

function duplicateRefs(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return uniqueSorted(
    [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value)
  );
}

function stableApplicability(applicability: JudgeAuditApplicability): JudgeAuditApplicability {
  return {
    decision: applicability.decision,
    reasonCode: applicability.reasonCode,
    proofRefs: uniqueSorted(applicability.proofRefs),
  };
}

function stableCanonicalRootUniverse(
  universe: JudgeAuditCanonicalRootUniverse
): JudgeAuditCanonicalRootUniverse {
  return {
    semanticConservationManifestHash: universe.semanticConservationManifestHash,
    acceptanceRootProofManifestHash: universe.acceptanceRootProofManifestHash,
    requirementRoots: [...universe.requirementRoots]
      .map((root) => ({
        rootRef: root.rootRef,
        requirementKind: root.requirementKind,
        payloadHash: root.payloadHash,
        sourceSpanRefs: uniqueSorted(root.sourceSpanRefs),
        applicability: stableApplicability(root.applicability),
        authorityProofRefs: uniqueSorted(root.authorityProofRefs),
      }))
      .sort((left, right) => left.rootRef.localeCompare(right.rootRef)),
    acceptanceRoots: [...universe.acceptanceRoots]
      .map((root) => ({
        rootRef: root.rootRef,
        payloadHash: root.payloadHash,
        sourceSpanRefs: uniqueSorted(root.sourceSpanRefs),
        requirementRefs: uniqueSorted(root.requirementRefs),
        applicability: stableApplicability(root.applicability),
        authorityProofRefs: uniqueSorted(root.authorityProofRefs),
      }))
      .sort((left, right) => left.rootRef.localeCompare(right.rootRef)),
  };
}

function bindingMissingFields(binding: JudgeAuditRootBinding): string[] {
  const fields = [
    'sourceSpanRefs',
    'testRefs',
    'fixtureRefs',
    'assertionRefs',
    'changedPathRefs',
    'observedSequenceRefs',
    'deterministicReportRefs',
    'evidenceRefs',
    'proofRefs',
  ] as const;
  return fields.filter((field) => binding[field].length === 0);
}

function stableUnit(unit: MutableUnit): Omit<JudgeAuditUnit, 'unitHash'> {
  return {
    unitId: unit.unitId,
    unitKind: unit.unitKind,
    requirementRef: unit.requirementRef,
    rootRefs: uniqueSorted(unit.rootRefs),
    sourceSpanRefs: uniqueSorted(unit.sourceSpanRefs),
    traceRowRefs: uniqueSorted(unit.traceRowRefs),
    targetRefs: uniqueSorted(unit.targetRefs),
    sequenceStepRefs: uniqueSorted(unit.sequenceStepRefs),
    redRefs: uniqueSorted(unit.redRefs),
    oracleRefs: uniqueSorted(unit.oracleRefs),
    changedPathRefs: uniqueSorted(unit.changedPathRefs),
    commandRefs: uniqueSorted(unit.commandRefs),
    evidenceRefs: uniqueSorted(unit.evidenceRefs),
    testRefs: uniqueSorted(unit.testRefs),
    fixtureRefs: uniqueSorted(unit.fixtureRefs),
    assertionRefs: uniqueSorted(unit.assertionRefs),
    observedSequenceRefs: uniqueSorted(unit.observedSequenceRefs),
    deterministicReportRefs: uniqueSorted(unit.deterministicReportRefs),
    proofRefs: uniqueSorted(unit.proofRefs),
  };
}

function addRootBinding(unit: MutableUnit, binding: JsonObject): void {
  addRefs(unit.sourceSpanRefs, strings(binding.sourceSpanRefs));
  addRefs(unit.testRefs, strings(binding.testRefs));
  addRefs(unit.fixtureRefs, strings(binding.fixtureRefs));
  addRefs(unit.assertionRefs, strings(binding.assertionRefs));
  addRefs(unit.changedPathRefs, strings(binding.changedPathRefs));
  addRefs(unit.observedSequenceRefs, strings(binding.observedSequenceRefs));
  addRefs(unit.deterministicReportRefs, strings(binding.deterministicReportRefs));
  addRefs(unit.evidenceRefs, strings(binding.evidenceRefs));
  addRefs(unit.proofRefs, strings(binding.proofRefs));
}

function addTraceRow(unit: MutableUnit, row: JsonObject): void {
  const traceId = text(row.traceId);
  if (traceId) unit.traceRowRefs.add(traceId);
  addRefs(unit.targetRefs, dimensionRefs(row, 'target'));
  addRefs(unit.sequenceStepRefs, dimensionRefs(row, 'sequenceStep'));
  addRefs(unit.redRefs, dimensionRefs(row, 'red'));
  addRefs(unit.oracleRefs, dimensionRefs(row, 'oracle'));
  addRefs(unit.commandRefs, dimensionRefs(row, 'command'));
  addRefs(unit.evidenceRefs, dimensionRefs(row, 'evidenceRequirement'));
  addRefs(unit.proofRefs, strings(row.proofRefs));
  for (const dimensionName of [
    'target',
    'sequenceStep',
    'red',
    'oracle',
    'command',
    'evidenceRequirement',
  ]) {
    addRefs(unit.proofRefs, dimensionProofRefs(row, dimensionName));
  }
}

export function projectRequirementsContractJudgeAuditUnitSet(
  input: JudgeAuditUnitProjectionInput
): JudgeAuditUnitProjectionResult {
  const blockingReasons: string[] = [];
  const canonicalRootUniverse = stableCanonicalRootUniverse(input.canonicalRootUniverse);
  const applicableRequirementRoots = canonicalRootUniverse.requirementRoots.filter(
    (root) => root.applicability.decision === 'applicable'
  );
  const applicableAcceptanceRoots = canonicalRootUniverse.acceptanceRoots.filter(
    (root) => root.applicability.decision === 'applicable'
  );
  for (const root of [
    ...canonicalRootUniverse.requirementRoots,
    ...canonicalRootUniverse.acceptanceRoots,
  ]) {
    if (root.applicability.decision === 'unresolved' || root.applicability.decision === 'invalid') {
      blockingReasons.push(`root_applicability_${root.applicability.decision}:${root.rootRef}`);
    }
  }

  const requirementRootRefs = uniqueSorted(applicableRequirementRoots.map((root) => root.rootRef));
  const negativeRootRefs = uniqueSorted(
    applicableRequirementRoots
      .filter((root) => root.requirementKind === 'negative')
      .map((root) => root.rootRef)
  );
  const mustRootRefs = new Set(
    applicableRequirementRoots
      .filter(
        (root) => root.requirementKind === 'functional' || root.requirementKind === 'nonfunctional'
      )
      .map((root) => root.rootRef)
  );
  const acceptanceRootRefs = uniqueSorted(applicableAcceptanceRoots.map((root) => root.rootRef));
  const canonicalDeclaredRootRefs = [
    ...applicableRequirementRoots.map((root) => root.rootRef),
    ...applicableAcceptanceRoots.map((root) => root.rootRef),
  ];
  const duplicateRootRefs = duplicateRefs(canonicalDeclaredRootRefs);
  for (const rootRef of duplicateRootRefs) blockingReasons.push(`duplicate_root:${rootRef}`);
  const allRootRefs = uniqueSorted(canonicalDeclaredRootRefs);
  const rootSet = new Set(allRootRefs);
  const canonicalRootByRef = new Map<
    string,
    JudgeAuditCanonicalRequirementRoot | JudgeAuditCanonicalAcceptanceRoot
  >();
  for (const root of [...applicableRequirementRoots, ...applicableAcceptanceRoots]) {
    if (!canonicalRootByRef.has(root.rootRef)) canonicalRootByRef.set(root.rootRef, root);
  }

  const semanticModel = record(input.semanticModel);
  const semanticBodies = record(semanticModel.semanticBodies);
  const nodes = objectEntries(semanticModel.nodes);
  const semanticRequirementNodes = nodes.filter(
    ([, node]) => node.nodeType === 'requirement' && applicableNode(node)
  );
  const semanticRelevantRoots = semanticRequirementNodes
    .map(([rootRef, node]) => ({
      rootRef,
      node,
      requirementKind: semanticRequirementKind(semanticBodies, node),
    }))
    .filter(
      (
        root
      ): root is {
        rootRef: string;
        node: JsonObject;
        requirementKind: RequirementKind;
      } => root.requirementKind !== null
    );
  const semanticRootByRef = new Map(
    semanticRelevantRoots.map((root) => [root.rootRef, root] as const)
  );
  let rootPayloadMismatchCount = 0;
  let semanticRootMismatchCount = 0;
  for (const canonicalRoot of applicableRequirementRoots) {
    const semanticRoot = semanticRootByRef.get(canonicalRoot.rootRef);
    if (!semanticRoot) {
      semanticRootMismatchCount += 1;
      blockingReasons.push(`missing_semantic_root:${canonicalRoot.rootRef}`);
      continue;
    }
    if (semanticRoot.requirementKind !== canonicalRoot.requirementKind) {
      semanticRootMismatchCount += 1;
      blockingReasons.push(`root_kind_mismatch:${canonicalRoot.rootRef}`);
    }
    const body = semanticBody(semanticBodies, semanticRoot.node);
    if (
      text(semanticRoot.node.bodyHash) !== canonicalRoot.payloadHash ||
      sha256Stable(body) !== canonicalRoot.payloadHash
    ) {
      rootPayloadMismatchCount += 1;
      blockingReasons.push(`root_payload_hash_mismatch:${canonicalRoot.rootRef}`);
    }
  }
  for (const semanticRoot of semanticRelevantRoots) {
    if (requirementRootRefs.includes(semanticRoot.rootRef)) continue;
    semanticRootMismatchCount += 1;
    blockingReasons.push(`extra_semantic_root:${semanticRoot.rootRef}`);
  }

  const compactTraceMatrix = record(input.compactTraceMatrix);
  const acceptanceRootIds = strings(compactTraceMatrix.acceptanceRootIds);
  const duplicateAcceptanceRootRefs = duplicateRefs(acceptanceRootIds);
  for (const rootRef of duplicateAcceptanceRootRefs) {
    blockingReasons.push(`duplicate_root:${rootRef}`);
  }
  const allDuplicateRootRefs = uniqueSorted([...duplicateRootRefs, ...duplicateAcceptanceRootRefs]);
  const projectedAcceptanceRootSet = new Set(acceptanceRootIds);
  const canonicalAcceptanceRootSet = new Set(acceptanceRootRefs);
  const missingAcceptanceRootRefs = acceptanceRootRefs.filter(
    (rootRef) => !projectedAcceptanceRootSet.has(rootRef)
  );
  const extraAcceptanceRootRefs = uniqueSorted(
    acceptanceRootIds.filter((rootRef) => !canonicalAcceptanceRootSet.has(rootRef))
  );
  for (const rootRef of missingAcceptanceRootRefs) {
    blockingReasons.push(`missing_acceptance_root_projection:${rootRef}`);
  }
  for (const rootRef of extraAcceptanceRootRefs) {
    blockingReasons.push(`extra_acceptance_root_projection:${rootRef}`);
  }
  let acceptanceRootMismatchCount =
    missingAcceptanceRootRefs.length +
    extraAcceptanceRootRefs.length +
    duplicateAcceptanceRootRefs.length;

  const negativeToMustRefs = new Map<string, Set<string>>();
  let invalidAssociationEdgeCount = 0;
  for (const [edgeId, edge] of objectEntries(semanticModel.edges)) {
    if (!applicableNode(edge)) continue;
    const fromRef = text(edge.fromRef);
    const toRef = text(edge.toRef);
    const fromIsMust = mustRootRefs.has(fromRef);
    const toIsNegative = negativeRootRefs.includes(toRef);
    const touchesMustNegative =
      (fromIsMust && toIsNegative) ||
      (mustRootRefs.has(toRef) && negativeRootRefs.includes(fromRef));
    if (edge.edgeType !== 'requirement_to_negative') {
      if (touchesMustNegative) {
        invalidAssociationEdgeCount += 1;
        blockingReasons.push(`unregistered_negative_association_edge:${edgeId}`);
      }
      continue;
    }
    if (!fromIsMust || !toIsNegative) {
      invalidAssociationEdgeCount += 1;
      blockingReasons.push(`invalid_negative_association_edge:${edgeId}`);
      continue;
    }
    const fromRoot = canonicalRootByRef.get(fromRef);
    const toRoot = canonicalRootByRef.get(toRef);
    if (
      !fromRoot ||
      !toRoot ||
      text(edge.fromHash) !== fromRoot.payloadHash ||
      text(edge.toHash) !== toRoot.payloadHash
    ) {
      invalidAssociationEdgeCount += 1;
      blockingReasons.push(`association_edge_hash_mismatch:${edgeId}`);
      continue;
    }
    const mustRefs = negativeToMustRefs.get(toRef) ?? new Set<string>();
    mustRefs.add(fromRef);
    negativeToMustRefs.set(toRef, mustRefs);
  }

  const rootAnchor = new Map<string, { kind: UnitKind; requirementRef: string }>();
  for (const root of applicableRequirementRoots) {
    if (root.requirementKind === 'functional' || root.requirementKind === 'nonfunctional') {
      rootAnchor.set(root.rootRef, { kind: 'must', requirementRef: root.rootRef });
      continue;
    }
    const mustMatches = uniqueSorted(negativeToMustRefs.get(root.rootRef) ?? []);
    if (mustMatches.length > 1) {
      blockingReasons.push(`root_multiple_must_associations:${root.rootRef}`);
      rootAnchor.set(root.rootRef, {
        kind: 'standalone',
        requirementRef: root.rootRef,
      });
    } else if (mustMatches.length === 1) {
      rootAnchor.set(root.rootRef, { kind: 'must', requirementRef: mustMatches[0] });
    } else {
      rootAnchor.set(root.rootRef, {
        kind: 'standalone',
        requirementRef: root.rootRef,
      });
    }
  }

  const traceRows = objects(compactTraceMatrix.atomicRows);
  const traceToRoot = new Map<string, string>();
  for (const row of traceRows) {
    const traceId = text(row.traceId);
    const requirementRef = text(row.requirementRef);
    if (!traceId || !requirementRef) {
      blockingReasons.push('trace_row_identity_missing');
      continue;
    }
    if (traceToRoot.has(traceId)) blockingReasons.push(`duplicate_trace:${traceId}`);
    traceToRoot.set(traceId, requirementRef);
    if (!rootSet.has(requirementRef))
      blockingReasons.push(`orphan_trace_requirement:${requirementRef}`);
  }

  const acceptanceBindingMap = new Map<string, JsonObject>();
  for (const binding of objects(compactTraceMatrix.acceptanceRootBindings)) {
    const acceptanceRef = text(binding.acceptanceRootRef);
    if (!acceptanceRef) {
      blockingReasons.push('acceptance_root_binding_identity_missing');
      acceptanceRootMismatchCount += 1;
      continue;
    }
    if (acceptanceBindingMap.has(acceptanceRef)) {
      blockingReasons.push(`duplicate_acceptance_root_binding:${acceptanceRef}`);
      acceptanceRootMismatchCount += 1;
    }
    acceptanceBindingMap.set(acceptanceRef, binding);
    if (!canonicalAcceptanceRootSet.has(acceptanceRef)) {
      blockingReasons.push(`extra_acceptance_root_binding:${acceptanceRef}`);
      acceptanceRootMismatchCount += 1;
    }
  }

  const acceptanceAnchor = new Map<string, { kind: UnitKind; requirementRef: string }>();
  for (const acceptanceRoot of applicableAcceptanceRoots) {
    const acceptanceRef = acceptanceRoot.rootRef;
    const binding = acceptanceBindingMap.get(acceptanceRef);
    if (!binding) {
      blockingReasons.push(`missing_acceptance_root_binding:${acceptanceRef}`);
      acceptanceRootMismatchCount += 1;
    }
    const referencedRequirementRefs = [
      ...acceptanceRoot.requirementRefs,
      ...strings(binding?.traceRefs)
        .map((traceRef) => traceToRoot.get(traceRef))
        .filter((rootRef): rootRef is string => Boolean(rootRef)),
    ];
    for (const requirementRef of referencedRequirementRefs) {
      if (!rootAnchor.has(requirementRef)) {
        blockingReasons.push(
          `acceptance_requirement_ref_unknown:${acceptanceRef}:${requirementRef}`
        );
      }
    }
    const anchors = uniqueSorted(
      referencedRequirementRefs
        .map((requirementRef) => rootAnchor.get(requirementRef))
        .filter((anchor): anchor is { kind: UnitKind; requirementRef: string } => Boolean(anchor))
        .map((anchor) => `${anchor.kind}:${anchor.requirementRef}`)
    );
    if (anchors.length > 1) {
      blockingReasons.push(`acceptance_multiple_units:${acceptanceRef}`);
      acceptanceAnchor.set(acceptanceRef, { kind: 'standalone', requirementRef: acceptanceRef });
    } else if (anchors.length === 1) {
      const [kind, requirementRef] = anchors[0].split(':', 2) as [UnitKind, string];
      acceptanceAnchor.set(acceptanceRef, { kind, requirementRef });
    } else {
      acceptanceAnchor.set(acceptanceRef, { kind: 'standalone', requirementRef: acceptanceRef });
    }
  }

  const unitsByKey = new Map<string, MutableUnit>();
  const ensureUnit = (anchor: { kind: UnitKind; requirementRef: string }): MutableUnit => {
    const key = unitKey(anchor.kind, anchor.requirementRef);
    const existing = unitsByKey.get(key);
    if (existing) return existing;
    const created = newUnit(anchor.kind, anchor.requirementRef);
    unitsByKey.set(key, created);
    return created;
  };
  const rootToUnit = new Map<string, string>();

  for (const rootRef of requirementRootRefs) {
    const anchor = rootAnchor.get(rootRef) ?? { kind: 'standalone', requirementRef: rootRef };
    const unit = ensureUnit(anchor);
    unit.rootRefs.add(rootRef);
    const canonicalRoot = canonicalRootByRef.get(rootRef);
    if (canonicalRoot) {
      addRefs(unit.sourceSpanRefs, canonicalRoot.sourceSpanRefs);
      addRefs(unit.proofRefs, canonicalRoot.authorityProofRefs);
      addRefs(unit.proofRefs, canonicalRoot.applicability.proofRefs);
    }
    rootToUnit.set(rootRef, unit.unitId);
  }
  for (const acceptanceRef of acceptanceRootRefs) {
    const anchor = acceptanceAnchor.get(acceptanceRef) ?? {
      kind: 'standalone',
      requirementRef: acceptanceRef,
    };
    const unit = ensureUnit(anchor);
    unit.rootRefs.add(acceptanceRef);
    const canonicalRoot = canonicalRootByRef.get(acceptanceRef);
    if (canonicalRoot) {
      addRefs(unit.sourceSpanRefs, canonicalRoot.sourceSpanRefs);
      addRefs(unit.proofRefs, canonicalRoot.authorityProofRefs);
      addRefs(unit.proofRefs, canonicalRoot.applicability.proofRefs);
    }
    rootToUnit.set(acceptanceRef, unit.unitId);
  }

  const rootBindingEntries = input.rootBindings.map(
    (binding) => [binding.rootRef, binding] as const
  );
  const rootBindingMap = new Map<string, JudgeAuditRootBinding>();
  let rootBindingEvidenceCompleteness: 0 | 1 = 1;
  for (const [rootRef, binding] of rootBindingEntries) {
    if (rootBindingMap.has(rootRef)) blockingReasons.push(`duplicate_root_binding:${rootRef}`);
    rootBindingMap.set(rootRef, binding);
    if (!rootSet.has(rootRef)) blockingReasons.push(`extra_root:${rootRef}`);
    for (const field of bindingMissingFields(binding)) {
      rootBindingEvidenceCompleteness = 0;
      blockingReasons.push(`root_binding_field_missing:${rootRef}:${field}`);
    }
    const canonicalRoot = canonicalRootByRef.get(rootRef);
    if (canonicalRoot) {
      const boundSourceSpans = new Set(binding.sourceSpanRefs);
      if (!canonicalRoot.sourceSpanRefs.every((ref) => boundSourceSpans.has(ref))) {
        blockingReasons.push(`root_binding_source_span_mismatch:${rootRef}`);
      }
      const boundProofRefs = new Set(binding.proofRefs);
      if (
        ![...canonicalRoot.authorityProofRefs, ...canonicalRoot.applicability.proofRefs].every(
          (ref) => boundProofRefs.has(ref)
        )
      ) {
        blockingReasons.push(`root_binding_proof_mismatch:${rootRef}`);
      }
    }
  }
  const missingRootBindingRefs = allRootRefs.filter((rootRef) => !rootBindingMap.has(rootRef));
  if (missingRootBindingRefs.length > 0) rootBindingEvidenceCompleteness = 0;
  for (const rootRef of missingRootBindingRefs) {
    blockingReasons.push(`missing_root_binding:${rootRef}`);
  }
  for (const [rootRef, unitIdValue] of rootToUnit) {
    const unit = [...unitsByKey.values()].find((candidate) => candidate.unitId === unitIdValue);
    if (!unit) {
      blockingReasons.push(`orphan_root:${rootRef}`);
      continue;
    }
    const binding = rootBindingMap.get(rootRef);
    if (binding) addRootBinding(unit, binding as unknown as JsonObject);
  }

  for (const row of traceRows) {
    const requirementRef = text(row.requirementRef);
    const unitIdValue = rootToUnit.get(requirementRef);
    const unit = [...unitsByKey.values()].find((candidate) => candidate.unitId === unitIdValue);
    if (unit) addTraceRow(unit, row);
  }

  const requiredUnitEvidenceFields = [
    'sourceSpanRefs',
    'traceRowRefs',
    'targetRefs',
    'sequenceStepRefs',
    'redRefs',
    'oracleRefs',
    'changedPathRefs',
    'commandRefs',
    'evidenceRefs',
    'testRefs',
    'fixtureRefs',
    'assertionRefs',
    'observedSequenceRefs',
    'deterministicReportRefs',
    'proofRefs',
  ] as const;
  let unitEvidenceCompleteness: 0 | 1 = rootBindingEvidenceCompleteness;
  const units = [...unitsByKey.values()]
    .map((unit) => {
      const stable = stableUnit(unit);
      for (const field of requiredUnitEvidenceFields) {
        if (stable[field].length > 0) continue;
        unitEvidenceCompleteness = 0;
        blockingReasons.push(`unit_evidence_missing:${stable.unitId}:${field}`);
      }
      return { ...stable, unitHash: sha256Stable(stable) };
    })
    .sort((left, right) => left.unitId.localeCompare(right.unitId));
  const unitToRoot = units.map((unit) => ({
    unitId: unit.unitId,
    rootRefs: [...unit.rootRefs],
  }));
  const rootToUnitRows = [...rootToUnit.entries()]
    .map(([rootRef, unitIdValue]) => ({ rootRef, unitId: unitIdValue }))
    .sort((left, right) => left.rootRef.localeCompare(right.rootRef));
  const assignedRootRefs = new Set(rootToUnit.keys());
  const missingRootRefs = allRootRefs.filter((rootRef) => !assignedRootRefs.has(rootRef));
  const orphanRootRefs = units.flatMap((unit) =>
    unit.rootRefs.filter((rootRef) => !rootSet.has(rootRef))
  );
  const extraRootRefs = uniqueSorted(
    input.rootBindings.map((binding) => binding.rootRef).filter((rootRef) => !rootSet.has(rootRef))
  );
  const missingRootCount = missingRootRefs.length;
  const extraRootCount = extraRootRefs.length;
  const orphanRootCount = uniqueSorted(orphanRootRefs).length;
  const duplicateRootCount = allDuplicateRootRefs.length;
  const missingRootBindingCount = missingRootBindingRefs.length;
  const mustUnitCount = units.filter((unit) => unit.unitKind === 'must').length;
  const standaloneUnitCount = units.filter((unit) => unit.unitKind === 'standalone').length;
  const mustUnitCoverage: 0 | 1 =
    mustRootRefs.size === 0 ||
    requirementRootRefs
      .filter((rootRef) => mustRootRefs.has(rootRef))
      .every((rootRef) => rootToUnit.get(rootRef) === unitId('must', rootRef))
      ? 1
      : 0;
  const negativeRootCoverage: 0 | 1 =
    negativeRootRefs.length === 0 || negativeRootRefs.every((rootRef) => rootToUnit.has(rootRef))
      ? 1
      : 0;
  const acceptanceRootCoverage: 0 | 1 =
    acceptanceRootRefs.length === 0 ||
    acceptanceRootRefs.every((rootRef) => rootToUnit.has(rootRef))
      ? 1
      : 0;
  const coverage = {
    applicableRootCount: allRootRefs.length,
    unitCount: units.length,
    mustUnitCount,
    standaloneUnitCount,
    missingRootCount,
    extraRootCount,
    orphanRootCount,
    duplicateRootCount,
    missingRootBindingCount,
    rootPayloadMismatchCount,
    semanticRootMismatchCount,
    acceptanceRootMismatchCount,
    invalidAssociationEdgeCount,
    unitEvidenceCompleteness,
    mustUnitCoverage,
    negativeRootCoverage,
    acceptanceRootCoverage,
  } as const;
  if (missingRootCount > 0) {
    for (const rootRef of missingRootRefs) blockingReasons.push(`missing_root:${rootRef}`);
  }
  if (orphanRootCount > 0) {
    for (const rootRef of uniqueSorted(orphanRootRefs))
      blockingReasons.push(`orphan_root:${rootRef}`);
  }
  if (mustUnitCoverage === 0) blockingReasons.push('must_unit_coverage_incomplete');
  if (negativeRootCoverage === 0) blockingReasons.push('negative_root_coverage_incomplete');
  if (acceptanceRootCoverage === 0) blockingReasons.push('acceptance_root_coverage_incomplete');

  const rootUniverse = {
    requirementRootRefs,
    negativeRootRefs,
    acceptanceRootRefs,
    allRootRefs,
  };
  const judgeAuditUniverseHash = sha256Stable({
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: input.sourceAuthorityHash,
    semanticModelHash: input.semanticModelHash,
    canonicalTraceGraphHash: input.canonicalTraceGraphHash,
    canonicalRootUniverse,
    rootUniverse,
  });
  const judgeAuditUnitSetHash = sha256Stable({
    judgeAuditUniverseHash,
    rootToUnit: rootToUnitRows,
    unitToRoot,
    units,
  });
  const finalBlockingReasons = uniqueSorted(blockingReasons);
  return {
    schemaVersion: 'requirements-contract-judge-audit-unit-set/v1',
    authority: 'none',
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: input.sourceAuthorityHash,
    semanticModelHash: input.semanticModelHash,
    canonicalTraceGraphHash: input.canonicalTraceGraphHash,
    canonicalRootUniverse,
    judgeAuditUniverseHash,
    judgeAuditUnitSetHash,
    rootUniverse,
    rootToUnit: rootToUnitRows,
    unitToRoot,
    units,
    coverage,
    blockingReasons: finalBlockingReasons,
    decision: finalBlockingReasons.length === 0 ? 'pass' : 'block',
  };
}

export interface JudgeAuditUnitSetValidation {
  ok: boolean;
  issues: string[];
}

export function validateRequirementsContractJudgeAuditUnitSet(
  input: JudgeAuditUnitProjectionResult
): JudgeAuditUnitSetValidation {
  const issues: string[] = [];
  if (input.schemaVersion !== 'requirements-contract-judge-audit-unit-set/v1') {
    issues.push('schema_version_mismatch');
  }
  if (input.authority !== 'none') {
    issues.push('authority_mismatch');
  }
  const expectedRootRefs = uniqueSorted([
    ...input.canonicalRootUniverse.requirementRoots
      .filter((root) => root.applicability.decision === 'applicable')
      .map((root) => root.rootRef),
    ...input.canonicalRootUniverse.acceptanceRoots
      .filter((root) => root.applicability.decision === 'applicable')
      .map((root) => root.rootRef),
  ]);
  const expectedRootSet = new Set(expectedRootRefs);
  if (uniqueSorted(input.rootUniverse.allRootRefs).join('|') !== expectedRootRefs.join('|')) {
    issues.push('root_universe_parity_mismatch');
  }

  const rootToUnitByRef = new Map<string, string>();
  for (const edge of input.rootToUnit) {
    if (rootToUnitByRef.has(edge.rootRef)) {
      issues.push(`duplicate_root_to_unit:${edge.rootRef}`);
    }
    rootToUnitByRef.set(edge.rootRef, edge.unitId);
  }
  const unitById = new Map<string, JudgeAuditUnit>();
  for (const unit of input.units) {
    if (unitById.has(unit.unitId)) issues.push(`duplicate_unit:${unit.unitId}`);
    unitById.set(unit.unitId, unit);
  }
  for (const rootRef of expectedRootRefs) {
    const unitIdValue = rootToUnitByRef.get(rootRef);
    const unit = unitIdValue ? unitById.get(unitIdValue) : undefined;
    if (!unit || !unit.rootRefs.includes(rootRef)) {
      issues.push(`root_to_unit_parity_mismatch:${rootRef}`);
    }
  }
  for (const [rootRef, unitIdValue] of rootToUnitByRef) {
    if (!expectedRootSet.has(rootRef) || !unitById.has(unitIdValue)) {
      issues.push(`root_to_unit_extra_or_missing_target:${rootRef}`);
    }
  }

  const unitToRootById = new Map<string, string[]>();
  for (const edge of input.unitToRoot) {
    if (unitToRootById.has(edge.unitId)) issues.push(`duplicate_unit_to_root:${edge.unitId}`);
    unitToRootById.set(edge.unitId, uniqueSorted(edge.rootRefs));
  }
  for (const unit of input.units) {
    const projectedRootRefs = unitToRootById.get(unit.unitId) ?? [];
    if (projectedRootRefs.join('|') !== uniqueSorted(unit.rootRefs).join('|')) {
      issues.push(`unit_to_root_parity_mismatch:${unit.unitId}`);
    }
  }

  const requiredUnitEvidenceFields = [
    'sourceSpanRefs',
    'traceRowRefs',
    'targetRefs',
    'sequenceStepRefs',
    'redRefs',
    'oracleRefs',
    'changedPathRefs',
    'commandRefs',
    'evidenceRefs',
    'testRefs',
    'fixtureRefs',
    'assertionRefs',
    'observedSequenceRefs',
    'deterministicReportRefs',
    'proofRefs',
  ] as const;
  for (const unit of input.units) {
    const { unitHash, ...stable } = unit;
    if (sha256Stable(stable) !== unitHash) {
      issues.push(`unit_hash_mismatch:${unit.unitId}`);
    }
    for (const field of requiredUnitEvidenceFields) {
      if (unit[field].length === 0) issues.push(`unit_evidence_missing:${unit.unitId}:${field}`);
    }
  }

  const expectedUniverseHash = sha256Stable({
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: input.sourceAuthorityHash,
    semanticModelHash: input.semanticModelHash,
    canonicalTraceGraphHash: input.canonicalTraceGraphHash,
    canonicalRootUniverse: input.canonicalRootUniverse,
    rootUniverse: input.rootUniverse,
  });
  if (expectedUniverseHash !== input.judgeAuditUniverseHash) {
    issues.push('judge_audit_universe_hash_mismatch');
  }
  const expectedUnitSetHash = sha256Stable({
    judgeAuditUniverseHash: input.judgeAuditUniverseHash,
    rootToUnit: input.rootToUnit,
    unitToRoot: input.unitToRoot,
    units: input.units,
  });
  if (expectedUnitSetHash !== input.judgeAuditUnitSetHash) {
    issues.push('judge_audit_unit_set_hash_mismatch');
  }

  const expectedCoverage = {
    applicableRootCount: expectedRootRefs.length,
    unitCount: input.units.length,
    mustUnitCount: input.units.filter((unit) => unit.unitKind === 'must').length,
    standaloneUnitCount: input.units.filter((unit) => unit.unitKind === 'standalone').length,
    missingRootCount: expectedRootRefs.filter((rootRef) => !rootToUnitByRef.has(rootRef)).length,
    extraRootCount: input.rootToUnit.filter((edge) => !expectedRootSet.has(edge.rootRef)).length,
    orphanRootCount: uniqueSorted(
      input.units.flatMap((unit) =>
        unit.rootRefs.filter((rootRef) => !expectedRootSet.has(rootRef))
      )
    ).length,
    duplicateRootCount:
      duplicateRefs([
        ...input.canonicalRootUniverse.requirementRoots
          .filter((root) => root.applicability.decision === 'applicable')
          .map((root) => root.rootRef),
        ...input.canonicalRootUniverse.acceptanceRoots
          .filter((root) => root.applicability.decision === 'applicable')
          .map((root) => root.rootRef),
      ]).length + duplicateRefs(input.rootUniverse.acceptanceRootRefs).length,
    missingRootBindingCount: input.blockingReasons.filter((reason) =>
      reason.startsWith('missing_root_binding:')
    ).length,
    rootPayloadMismatchCount: input.blockingReasons.filter((reason) =>
      reason.startsWith('root_payload_hash_mismatch:')
    ).length,
    semanticRootMismatchCount: input.blockingReasons.filter(
      (reason) =>
        reason.startsWith('missing_semantic_root:') ||
        reason.startsWith('extra_semantic_root:') ||
        reason.startsWith('root_kind_mismatch:')
    ).length,
    acceptanceRootMismatchCount: input.blockingReasons.filter(
      (reason) =>
        reason.startsWith('missing_acceptance_root_projection:') ||
        reason.startsWith('extra_acceptance_root_projection:') ||
        reason.startsWith('duplicate_acceptance_root_binding:') ||
        reason.startsWith('missing_acceptance_root_binding:') ||
        reason.startsWith('extra_acceptance_root_binding:') ||
        reason.startsWith('acceptance_requirement_ref_unknown:') ||
        reason.startsWith('acceptance_multiple_units:')
    ).length,
    invalidAssociationEdgeCount: input.blockingReasons.filter(
      (reason) =>
        reason.startsWith('unregistered_negative_association_edge:') ||
        reason.startsWith('invalid_negative_association_edge:') ||
        reason.startsWith('association_edge_hash_mismatch:')
    ).length,
    unitEvidenceCompleteness:
      input.blockingReasons.some(
        (reason) =>
          reason.startsWith('missing_root_binding:') ||
          reason.includes(':sourceSpanRefs') ||
          reason.includes(':testRefs') ||
          reason.includes(':fixtureRefs') ||
          reason.includes(':assertionRefs') ||
          reason.includes(':changedPathRefs') ||
          reason.includes(':observedSequenceRefs') ||
          reason.includes(':deterministicReportRefs') ||
          reason.includes(':evidenceRefs') ||
          reason.includes(':proofRefs')
      ) ||
      input.units.some((unit) =>
        requiredUnitEvidenceFields.some((field) => unit[field].length === 0)
      )
        ? 0
        : 1,
    mustUnitCoverage: input.rootUniverse.requirementRootRefs
      .filter((rootRef) => input.rootUniverse.requirementRootRefs.includes(rootRef))
      .every((rootRef) => {
        const canonicalRoot = input.canonicalRootUniverse.requirementRoots.find(
          (root) => root.rootRef === rootRef
        );
        return (
          (canonicalRoot?.requirementKind !== 'functional' &&
            canonicalRoot?.requirementKind !== 'nonfunctional') ||
          rootToUnitByRef.get(rootRef) === unitId('must', rootRef)
        );
      })
      ? 1
      : 0,
    negativeRootCoverage: input.rootUniverse.negativeRootRefs.every((rootRef) =>
      rootToUnitByRef.has(rootRef)
    )
      ? 1
      : 0,
    acceptanceRootCoverage: input.rootUniverse.acceptanceRootRefs.every((rootRef) =>
      rootToUnitByRef.has(rootRef)
    )
      ? 1
      : 0,
  };
  for (const [field, expected] of Object.entries(expectedCoverage)) {
    if (input.coverage[field as keyof typeof input.coverage] !== expected) {
      issues.push(`coverage_mismatch:${field}`);
    }
  }
  const expectedDecision = input.blockingReasons.length === 0 ? 'pass' : 'block';
  if (input.decision !== expectedDecision) issues.push('decision_consistency_mismatch');

  const finalIssues = uniqueSorted(issues);
  return { ok: finalIssues.length === 0, issues: finalIssues };
}
