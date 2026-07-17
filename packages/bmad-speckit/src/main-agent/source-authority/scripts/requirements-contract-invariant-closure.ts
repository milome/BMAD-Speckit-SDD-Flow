import type {
  RequirementContractClosureMeasure,
  RequirementContractClosurePass,
  RequirementContractClosurePassReceipt,
  RequirementContractModel,
} from './requirements-contract-model';

export const REQUIREMENT_CONTRACT_CLOSURE_PASSES: RequirementContractClosurePass[] = [
  {
    name: 'normalizeSourceStructure',
    family: 'source_shape_normalization',
    applicability: 'source AST contains noncanonical headings, IDs, paths, commands, tables, lists, or stale projection boundaries',
    regressionTest: 'requirements-contract-authoring-source-normalization.test.ts',
  },
  {
    name: 'canonicalizeStableIds',
    family: 'canonical_id_sync',
    applicability: 'FR/NFR or source-bound IDs are missing, narrow, renamed, duplicated, or stale',
    regressionTest: 'requirements-contract-id-namespace-sync.test.ts',
  },
  {
    name: 'classifyRequirementSemantics',
    family: 'semantic_classification',
    applicability: 'AST nodes lack MUST, MUST NOT, NOT DONE, OUT, evidence, command, path, view, or applicability kind',
    regressionTest: 'requirements-contract-authoring-compiler-invariant-closure.test.ts',
  },
  {
    name: 'splitAtomicRequirements',
    family: 'atomic_requirement_split',
    applicability: 'one source row contains multiple independently confirmable obligations',
    regressionTest: 'requirements-contract-authoring-compiler-invariant-closure.test.ts',
  },
  {
    name: 'resolveSourceProvenance',
    family: 'source_provenance',
    applicability: 'a model row lacks source kind, span, hash, heading path, original ID, canonical ID, or derivation rule',
    regressionTest: 'requirements-contract-authoring-authority-grounding.test.ts',
  },
  {
    name: 'resolveTargetAuthority',
    family: 'target_authority',
    applicability: 'target files, directories, package surfaces, or controlled target decisions are unresolved after repository grounding',
    regressionTest: 'requirements-contract-consumer-target-authority.test.ts',
  },
  {
    name: 'resolveValidationAuthority',
    family: 'validation_authority',
    applicability: 'required commands or test paths are unresolved after repository grounding',
    regressionTest: 'requirements-contract-validation-authority.test.ts',
  },
  {
    name: 'groundCurrentStateFromRepository',
    family: 'current_state_grounding',
    applicability: 'current-state rows lack repository evidence refs',
    regressionTest: 'requirements-contract-authoring-authority-grounding.test.ts',
  },
  {
    name: 'deriveTargetState',
    family: 'target_state_derivation',
    applicability: 'target-state rows are entailed by source and current state but absent from the model',
    regressionTest: 'requirements-contract-authoring-compiler-invariant-closure.test.ts',
  },
  {
    name: 'closeNegativeAndFailureCoverage',
    family: 'negative_failure_coverage',
    applicability: 'MUST rows lack derived failure paths or forbidden behavior coverage',
    regressionTest: 'requirements-contract-authoring-compiler-invariant-closure.test.ts',
  },
  {
    name: 'closeAcceptanceAndEvidenceCoverage',
    family: 'acceptance_evidence_coverage',
    applicability: 'requirements lack acceptance rows, evidence rows, or validation command links',
    regressionTest: 'requirements-contract-authoring-business-coverage.test.ts',
  },
  {
    name: 'closeTraceCoverage',
    family: 'trace_coverage',
    applicability: 'requirements, evidence, acceptance, commands, views, and target paths lack reciprocal trace rows',
    regressionTest: 'requirements-contract-authoring-business-coverage.test.ts',
  },
  {
    name: 'closeVisualReciprocity',
    family: 'visual_view_reciprocity',
    applicability: 'sequence, flow, edge-case, business, or governance views lack reciprocal source and trace refs',
    regressionTest: 'requirements-contract-authoring-business-view-materialization.test.ts',
  },
  {
    name: 'closeBoundaryCoverage',
    family: 'boundary_coverage',
    applicability: 'OUT or must-not rows lack boundary views and trace refs',
    regressionTest: 'requirements-contract-authoring-business-view-materialization.test.ts',
  },
  {
    name: 'closeCurrentTargetMap',
    family: 'current_target_map',
    applicability: 'current state, target state, modification path, and artifact rows are not mutually linked',
    regressionTest: 'requirements-contract-authoring-compiler-invariant-closure.test.ts',
  },
  {
    name: 'closeArtifactPlan',
    family: 'artifact_plan',
    applicability: 'generated receipts, reports, HTML, source, or package artifacts lack producer, hash, and consuming gate',
    regressionTest: 'requirements-contract-authoring-auto-repair-loop.test.ts',
  },
  {
    name: 'closeApplicabilityDomains',
    family: 'applicability_domain',
    applicability: 'rows lack deterministic scope such as trader, chart, package, renderer, host, or consumer',
    regressionTest: 'requirements-contract-authoring-business-coverage.test.ts',
  },
  {
    name: 'materializeLocalization',
    family: 'localization_materialization',
    applicability: 'zh-CN or bilingual confirmation fields are missing, stale, wrong-language, or parity-unknown',
    regressionTest: 'requirements-contract-authoring-localization-materialization.test.ts',
  },
  {
    name: 'validateSemanticParity',
    family: 'semantic_parity',
    applicability: 'localized and source-language rows lack matching semantic hashes or parity receipts',
    regressionTest: 'requirements-contract-authoring-localization-materialization.test.ts',
  },
  {
    name: 'validateCompleteModel',
    family: 'complete_model_validation',
    applicability: 'schema, instance, semantic, reciprocal-ref, localization, or authority invariant remains nonzero',
    regressionTest: 'requirements-contract-authoring-compiler-invariant-closure.test.ts',
  },
];

type ClosureIssue = RequirementContractModel['invariantClosure']['issues'][number];
type MeasureDimension = keyof RequirementContractClosureMeasure;

interface MeasuredClosure {
  measure: RequirementContractClosureMeasure;
  issues: ClosureIssue[];
}

export type RequirementContractClosureProfile = 'full' | 'pre_checkpoint';

export interface RequirementContractClosureOptions {
  profile?: RequirementContractClosureProfile;
}

const PRE_CHECKPOINT_PASS_IDS = new Set<RequirementContractClosurePass['name']>([
  'canonicalizeStableIds',
  'classifyRequirementSemantics',
  'resolveSourceProvenance',
  'resolveTargetAuthority',
  'resolveValidationAuthority',
  'validateCompleteModel',
]);

const PASS_APPLICABILITY: Record<
  RequirementContractClosurePass['name'],
  (model: RequirementContractModel) => boolean
> = {
  normalizeSourceStructure: () => false,
  canonicalizeStableIds: () => true,
  classifyRequirementSemantics: () => true,
  splitAtomicRequirements: () => false,
  resolveSourceProvenance: () => true,
  resolveTargetAuthority: () => true,
  resolveValidationAuthority: () => true,
  groundCurrentStateFromRepository: (model) => Boolean(model.applicability.currentState),
  deriveTargetState: () => true,
  closeNegativeAndFailureCoverage: () => true,
  closeAcceptanceAndEvidenceCoverage: () => true,
  closeTraceCoverage: () => true,
  closeVisualReciprocity: () => true,
  closeBoundaryCoverage: (model) => model.notDone.length > 0 || model.outOfScope.length > 0,
  closeCurrentTargetMap: () => true,
  closeArtifactPlan: (model) => Boolean(model.applicability.artifactPlan),
  closeApplicabilityDomains: (model) => Object.keys(model.applicability).length > 0,
  materializeLocalization: localizationApplies,
  validateSemanticParity: localizationApplies,
  validateCompleteModel: () => true,
};

function localizationApplies(model: RequirementContractModel): boolean {
  const localization = model.applicability.localization;
  return Boolean(
    localization &&
      typeof localization === 'object' &&
      'applies' in localization &&
      localization.applies === true
  );
}

function rowHasAuthority(row: {
  authorityState?: string;
  provenance?: Record<string, unknown>;
}): boolean {
  return Boolean(
    row.authorityState &&
      row.provenance &&
      Object.keys(row.provenance).length > 0
  );
}

function measureModel(
  model: RequirementContractModel,
  profile: RequirementContractClosureProfile
): MeasuredClosure {
  const issues: ClosureIssue[] = [];
  const issueKeys = new Set<string>();
  const measure: RequirementContractClosureMeasure = {
    unresolvedInvariantCount: 0,
    orphanReferenceCount: 0,
    missingProjectionCount: 0,
    localizationParityCount: 0,
    schemaValidationCount: 0,
  };
  const add = (dimension: MeasureDimension, code: string, message: string): void => {
    const key = `${code}\u0000${message}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    measure[dimension] += 1;
    issues.push({ code, message });
  };

  measureRequiredSemantics(model, add, profile);
  measureAuthority(model, add);
  if (profile === 'full') {
    measureCoverage(model, add);
    measureProjection(model, add);
  }
  measureReferenceIntegrity(model, add);
  if (profile === 'full') {
    measureLocalization(model, add);
  }
  measureSchemaIntegrity(model, add);

  return { measure, issues };
}

function measureRequiredSemantics(
  model: RequirementContractModel,
  add: (dimension: MeasureDimension, code: string, message: string) => void,
  profile: RequirementContractClosureProfile
): void {
  if (model.must.length === 0) {
    add('schemaValidationCount', 'missing_requirement_authority', 'No MUST requirement exists.');
  }
  if (model.notDone.length === 0) {
    add(
      'unresolvedInvariantCount',
      'missing_negative_requirement_authority',
      'No source-authorized negative requirement exists.'
    );
  }
  if (model.outOfScope.length === 0) {
    add(
      'unresolvedInvariantCount',
      'missing_out_of_scope_authority',
      'No source-authorized out-of-scope boundary exists.'
    );
  }
  if (profile === 'full' && model.requiredCommands.length === 0) {
    add(
      'unresolvedInvariantCount',
      'missing_validation_authority',
      'No source-authorized validation command binding exists.'
    );
  }
}

function measureAuthority(
  model: RequirementContractModel,
  add: (dimension: MeasureDimension, code: string, message: string) => void
): void {
  model.must.forEach((row) => {
    if (!rowHasAuthority(row)) {
      add(
        'unresolvedInvariantCount',
        'missing_requirement_source_authority',
        `Requirement ${row.id || '<missing-id>'} has no source or decision authority.`
      );
    }
  });
  model.notDone.forEach((row) => {
    if (!rowHasAuthority(row)) {
      add(
        'unresolvedInvariantCount',
        'missing_negative_source_authority',
        `Negative requirement ${row.id || '<missing-id>'} has no source or decision authority.`
      );
    }
  });
  model.outOfScope.forEach((row) => {
    if (!rowHasAuthority(row)) {
      add(
        'unresolvedInvariantCount',
        'missing_boundary_source_authority',
        `Boundary ${row.id || '<missing-id>'} has no source or decision authority.`
      );
    }
  });
}

function measureCoverage(
  model: RequirementContractModel,
  add: (dimension: MeasureDimension, code: string, message: string) => void
): void {
  const requirements = [...model.must, ...model.notDone];
  requirements.forEach((row) => {
    if (!model.evidence.some((evidence) => evidence.covers.includes(row.id))) {
      add(
        'unresolvedInvariantCount',
        'missing_evidence_coverage',
        `Requirement ${row.id} has no source-authorized evidence binding.`
      );
    }
    if (!model.acceptanceCriteria.some((acceptance) => acceptance.covers.includes(row.id))) {
      add(
        'unresolvedInvariantCount',
        'missing_acceptance_coverage',
        `Requirement ${row.id} has no source-authorized acceptance binding.`
      );
    }
    if (!model.traceRows.some((trace) => trace.covers.includes(row.id))) {
      add(
        'unresolvedInvariantCount',
        'missing_trace_coverage',
        `Requirement ${row.id} has no source-authorized trace binding.`
      );
    }
  });
}

function measureProjection(
  model: RequirementContractModel,
  add: (dimension: MeasureDimension, code: string, message: string) => void
): void {
  const requiredViews: Array<{
    rows: unknown[];
    code: string;
    label: string;
    applies: boolean;
  }> = [
    {
      rows: model.businessViews,
      code: 'missing_business_view_projection',
      label: 'business view',
      applies: model.must.length > 0,
    },
    {
      rows: model.sequenceViews,
      code: 'missing_sequence_view_projection',
      label: 'sequence view',
      applies: model.must.length > 0,
    },
    {
      rows: model.flowViews,
      code: 'missing_flow_view_projection',
      label: 'flow view',
      applies: model.must.length > 0,
    },
    {
      rows: model.edgeCaseViews,
      code: 'missing_edge_case_view_projection',
      label: 'edge-case view',
      applies: model.notDone.length > 0,
    },
    {
      rows: model.boundaryViews,
      code: 'missing_boundary_view_projection',
      label: 'boundary view',
      applies: model.outOfScope.length > 0,
    },
  ];
  requiredViews.forEach(({ rows, code, label, applies }) => {
    if (applies && rows.length === 0) {
      add(
        'missingProjectionCount',
        code,
        `No source-authorized ${label} projection exists.`
      );
    }
  });
  if (model.must.length > 0 && model.targetModificationPaths.length === 0) {
    add(
      'missingProjectionCount',
      'missing_target_authority',
      'No source-authorized target binding exists.'
    );
  }
}

function measureReferenceIntegrity(
  model: RequirementContractModel,
  add: (dimension: MeasureDimension, code: string, message: string) => void
): void {
  const requirementIds = new Set([...model.must, ...model.notDone].map((row) => row.id));
  const semanticIds = new Set([...requirementIds, ...model.outOfScope.map((row) => row.id)]);
  const evidenceIds = new Set(model.evidence.map((row) => row.id));
  const acceptanceIds = new Set(model.acceptanceCriteria.map((row) => row.id));
  const commandIds = new Set(model.requiredCommands.map((row) => row.id));
  const viewSets = {
    businessViewRefs: new Set(model.businessViews.map((row) => row.id)),
    sequenceViewRefs: new Set(model.sequenceViews.map((row) => row.id)),
    flowViewRefs: new Set(model.flowViews.map((row) => row.id)),
    edgeCaseViewRefs: new Set(model.edgeCaseViews.map((row) => row.id)),
    boundaryViewRefs: new Set(model.boundaryViews.map((row) => row.id)),
  };

  model.evidence.forEach((row) =>
    addUnknownRefs(row.covers, requirementIds, 'orphan_evidence_reference', row.id, add)
  );
  model.acceptanceCriteria.forEach((row) =>
    addUnknownRefs(row.covers, requirementIds, 'orphan_acceptance_reference', row.id, add)
  );
  model.requiredCommands.forEach((row) =>
    addUnknownRefs(row.covers, requirementIds, 'orphan_validation_reference', row.id, add)
  );
  model.targetModificationPaths.forEach((row) =>
    addUnknownRefs(row.requirementRefs, requirementIds, 'orphan_target_reference', row.id, add)
  );
  [
    ...model.businessViews,
    ...model.sequenceViews,
    ...model.flowViews,
    ...model.edgeCaseViews,
    ...model.boundaryViews,
  ].forEach((row) =>
    addUnknownRefs(row.covers, semanticIds, 'orphan_view_reference', row.id, add)
  );
  model.traceRows.forEach((row) => {
    addUnknownRefs(row.covers, requirementIds, 'orphan_trace_requirement_reference', row.id, add);
    addUnknownRefs(row.evidenceRefs, evidenceIds, 'orphan_trace_evidence_reference', row.id, add);
    addUnknownRefs(
      row.acceptanceRefs,
      acceptanceIds,
      'orphan_trace_acceptance_reference',
      row.id,
      add
    );
    Object.entries(viewSets).forEach(([field, known]) => {
      addUnknownRefs(
        row[field as keyof typeof viewSets],
        known,
        `orphan_trace_${field.replace(/Refs$/u, '')}_reference`,
        row.id,
        add
      );
    });
    addUnknownRefs(
      [
        ...(row.contractValidationCommandRefs ?? []),
        ...(row.deliveryEvidenceCommandRefs ?? []),
      ],
      commandIds,
      'orphan_trace_command_reference',
      row.id,
      add
    );
  });
}

function addUnknownRefs(
  refs: string[],
  known: Set<string>,
  code: string,
  ownerId: string,
  add: (dimension: MeasureDimension, code: string, message: string) => void
): void {
  refs.forEach((ref) => {
    if (!known.has(ref)) {
      add(
        'orphanReferenceCount',
        code,
        `${ownerId || '<missing-id>'} references unknown identity ${ref || '<empty-ref>'}.`
      );
    }
  });
}

function measureLocalization(
  model: RequirementContractModel,
  add: (dimension: MeasureDimension, code: string, message: string) => void
): void {
  if (!localizationApplies(model)) return;
  [...model.must, ...model.notDone].forEach((row) => {
    if (!row.textZh?.trim()) {
      add(
        'localizationParityCount',
        'missing_localization_projection',
        `Requirement ${row.id} has no required localized text.`
      );
    }
  });
}

function measureSchemaIntegrity(
  model: RequirementContractModel,
  add: (dimension: MeasureDimension, code: string, message: string) => void
): void {
  const rows = [
    ...model.must,
    ...model.notDone,
    ...model.outOfScope,
    ...model.evidence,
    ...model.acceptanceCriteria,
    ...model.requiredCommands,
    ...model.traceRows,
    ...model.businessViews,
    ...model.sequenceViews,
    ...model.flowViews,
    ...model.edgeCaseViews,
    ...model.boundaryViews,
    ...model.targetModificationPaths,
  ];
  const seen = new Set<string>();
  rows.forEach((row) => {
    if (!row.id?.trim()) {
      add('schemaValidationCount', 'empty_model_identity', 'A model row has an empty identity.');
      return;
    }
    if (seen.has(row.id)) {
      add(
        'schemaValidationCount',
        'duplicate_model_identity',
        `Model identity ${row.id} is duplicated.`
      );
    }
    seen.add(row.id);
  });
}

function findingsForPass(passId: string, issues: ClosureIssue[]): ClosureIssue[] {
  if (passId === 'validateCompleteModel') return issues;
  const predicates: Record<string, (code: string) => boolean> = {
    canonicalizeStableIds: (code) => code.includes('identity'),
    classifyRequirementSemantics: (code) => code === 'missing_requirement_authority',
    resolveSourceProvenance: (code) => code.includes('source_authority'),
    resolveTargetAuthority: (code) => code.includes('target'),
    resolveValidationAuthority: (code) => code.includes('validation'),
    deriveTargetState: (code) => code.includes('target'),
    closeNegativeAndFailureCoverage: (code) =>
      code.includes('negative') || code.includes('out_of_scope'),
    closeAcceptanceAndEvidenceCoverage: (code) =>
      code.includes('acceptance') || code.includes('evidence'),
    closeTraceCoverage: (code) => code.includes('trace'),
    closeVisualReciprocity: (code) => code.includes('view'),
    closeBoundaryCoverage: (code) => code.includes('boundary'),
    closeCurrentTargetMap: (code) => code.includes('target'),
    materializeLocalization: (code) => code.includes('localization'),
    validateSemanticParity: (code) => code.includes('localization'),
  };
  const predicate = predicates[passId];
  return predicate ? issues.filter((issue) => predicate(issue.code)) : [];
}

function executePasses(
  model: RequirementContractModel,
  measured: MeasuredClosure,
  profile: RequirementContractClosureProfile
): RequirementContractClosurePassReceipt[] {
  return REQUIREMENT_CONTRACT_CLOSURE_PASSES.filter(
    (pass) =>
      (profile === 'full' || PRE_CHECKPOINT_PASS_IDS.has(pass.name)) &&
      PASS_APPLICABILITY[pass.name](model)
  ).map((pass) => ({
    passId: pass.name,
    executed: true,
    inputs: {
      recordId: model.recordId,
      requirementSetId: model.requirementSetId,
    },
    outputs: {
      changedFields: [],
    },
    findings: findingsForPass(pass.name, measured.issues),
    measureBefore: { ...measured.measure },
    measureAfter: { ...measured.measure },
  }));
}

export function closeRequirementContractInvariants(
  input: RequirementContractModel,
  options: RequirementContractClosureOptions = {}
): RequirementContractModel {
  const profile = options.profile ?? 'full';
  const measureBefore = measureModel(input, profile);
  const receipts = executePasses(input, measureBefore, profile);
  const measureAfter = measureModel(input, profile);
  const terminalState = measureAfter.issues.length === 0 ? 'confirmable' : 'blocked';

  return {
    ...input,
    invariantClosure: {
      appliedPasses: receipts.map((receipt) => receipt.passId),
      remainingIssueCount: measureAfter.issues.length,
      rendererBlockerPolicy: 'renderer_blocker_release_failure',
      issues: measureAfter.issues,
      terminalState,
      measureBefore: measureBefore.measure,
      measureAfter: measureAfter.measure,
      passRegistry: REQUIREMENT_CONTRACT_CLOSURE_PASSES,
      roundReceipts: receipts,
    },
  };
}
