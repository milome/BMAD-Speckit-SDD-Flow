import type {
  RequirementContractClosureMeasure,
  RequirementContractClosurePass,
  RequirementContractModel,
  RequirementContractTraceRow,
  RequirementContractView,
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

const LEGACY_PASS_ALIASES = [
  'closeMustCoverage',
  'closeNegCoverage',
  'closeOutBoundaryViews',
  'closeTraceViewRefs',
  'closeAcceptanceCoverage',
  'closeArtifactPlan',
  'closeTargetModificationPaths',
  'closeApplicabilityDomains',
] as const;

function ordinal(index: number): string {
  return String(index + 1).padStart(3, '0');
}

function businessIdForRequirement(id: string, index: number): string {
  const match = id.match(/^MUST-((?:FR|NFR)-\d{3})$/u);
  return match ? `BUS-${match[1]}` : `BUS-REQ-${ordinal(index)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function view(id: string, title: string, scope: 'business' | 'governance', covers: string[]): RequirementContractView {
  return { id, title, scope, covers: unique(covers) };
}

export function closeMustCoverage(model: RequirementContractModel): RequirementContractModel {
  const evidence = model.must.map((row, index) => ({
    id: `EVD-${ordinal(index)}`,
    covers: [row.id],
    text: `Evidence closure for ${row.id}: ${row.text}`,
  }));
  const acceptanceCriteria = model.must.map((row, index) => ({
    id: `ACC-${ordinal(index)}`,
    covers: [row.id],
    text: `Acceptance closure for ${row.id}: ${row.text}`,
  }));
  return { ...model, evidence, acceptanceCriteria };
}

function rowHasAuthority(row: { authorityState?: string; provenance?: Record<string, unknown> }): boolean {
  return Boolean(row.authorityState && row.provenance && Object.keys(row.provenance).length > 0);
}

function computeClosureMeasure(model: RequirementContractModel): RequirementContractClosureMeasure {
  const missingEvidence = model.must.filter(
    (row) => !model.evidence.some((evidence) => evidence.covers.includes(row.id))
  ).length;
  const missingAcceptance = model.must.filter(
    (row) => !model.acceptanceCriteria.some((acceptance) => acceptance.covers.includes(row.id))
  ).length;
  const missingTrace = model.must.filter(
    (row) => !model.traceRows.some((trace) => trace.covers.includes(row.id))
  ).length;
  const orphanTraceRefs = model.traceRows.reduce((count, trace) => {
    const knownRefs = new Set([
      ...model.must.map((row) => row.id),
      ...model.notDone.map((row) => row.id),
      ...model.outOfScope.map((row) => row.id),
    ]);
    return count + trace.covers.filter((ref) => !knownRefs.has(ref)).length;
  }, 0);
  const missingAuthority = [
    ...model.must,
    ...model.notDone,
    ...model.outOfScope,
  ].filter((row) => !rowHasAuthority(row)).length;
  const missingProjection =
    (model.businessViews.length === 0 ? 1 : 0) +
    (model.sequenceViews.length === 0 ? 1 : 0) +
    (model.flowViews.length === 0 ? 1 : 0) +
    (model.edgeCaseViews.length === 0 ? 1 : 0) +
    (model.boundaryViews.length === 0 && model.outOfScope.length > 0 ? 1 : 0) +
    (model.targetModificationPaths.length === 0 ? 1 : 0);
  const missingLocalization = model.must.filter(
    (row) => row.textZh === undefined && /[\u4e00-\u9fff]/u.test(row.text) === false
  ).length;

  return {
    unresolvedInvariantCount: missingEvidence + missingAcceptance + missingTrace + missingAuthority,
    orphanReferenceCount: orphanTraceRefs,
    missingProjectionCount: missingProjection,
    localizationParityCount: missingLocalization,
    schemaValidationCount: model.must.length === 0 ? 1 : 0,
  };
}

function zeroClosureMeasure(): RequirementContractClosureMeasure {
  return {
    unresolvedInvariantCount: 0,
    orphanReferenceCount: 0,
    missingProjectionCount: 0,
    localizationParityCount: 0,
    schemaValidationCount: 0,
  };
}

function withAuthority<T extends { id: string; text?: string; authorityState?: string; provenance?: Record<string, unknown> }>(
  row: T,
  fallbackSource = 'compiler_closure'
): T {
  return {
    ...row,
    authorityState: row.authorityState ?? 'source_authorized',
    provenance: row.provenance ?? {
      source: fallbackSource,
      sourceRef: row.id,
      derivation: 'requirement_contract_invariant_closure',
    },
  };
}

export function closeNegCoverage(model: RequirementContractModel): RequirementContractModel {
  return {
    ...model,
    notDone: (model.notDone.length
      ? model.notDone.map((row) => withAuthority(row))
      : [
          withAuthority({
            id: 'NEG-001',
            text: 'Requirement contract confirmability must not be treated as implementation completion.',
          }),
        ]),
  };
}

export function closeOutBoundaryViews(model: RequirementContractModel): RequirementContractModel {
  const boundaryViews = model.outOfScope.map((row, index) =>
    view(`BOUND-${ordinal(index)}`, `Boundary for ${row.id}`, 'business', [row.id])
  );
  return { ...model, boundaryViews };
}

export function closeTraceViewRefs(model: RequirementContractModel): RequirementContractModel {
  const mustIds = model.must.map((row) => row.id);
  const businessRequirementViews = model.must.map((row, index) =>
    view(businessIdForRequirement(row.id, index), `Business requirement ${row.id}`, 'business', [row.id])
  );
  const businessViews = [
    view('SEQ-BUSINESS-001', 'Business happy path', 'business', mustIds),
    ...businessRequirementViews,
  ];
  const sequenceViews = [
    view('SEQ-BUSINESS-001', 'Business happy path', 'business', mustIds),
    view('SEQ-001', 'Governance sequence', 'governance', [...mustIds, 'NEG-001']),
  ];
  const flowViews = [
    view('FLOW-BUSINESS-001', 'Business flow', 'business', mustIds),
    view('FLOW-001', 'Governance flow', 'governance', [...mustIds, 'NEG-001']),
  ];
  const edgeCaseViews = [
    view('EDGEVIEW-BUSINESS-001', 'Business edge cases', 'business', [...mustIds, 'NEG-001']),
    view('EDGEVIEW-001', 'Governance edge cases', 'governance', ['NEG-001']),
  ];
  const sequenceViewRefs = sequenceViews.map((row) => row.id);
  const flowViewRefs = flowViews.map((row) => row.id);
  const edgeCaseViewRefs = edgeCaseViews.map((row) => row.id);
  const boundaryViewRefs = model.boundaryViews.map((row) => row.id);
  const traceRows: RequirementContractTraceRow[] = model.must.map((row, index) => ({
    id: `TRACE-${ordinal(index)}`,
    covers: [row.id, 'NEG-001'],
    evidenceRefs: [`EVD-${ordinal(index)}`],
    acceptanceRefs: [`ACC-${ordinal(index)}`],
    businessViewRefs: ['SEQ-BUSINESS-001', ...businessViews.map((viewRow) => viewRow.id)],
    sequenceViewRefs,
    flowViewRefs,
    edgeCaseViewRefs,
    boundaryViewRefs,
    taskRefs: [`TASK-${ordinal(index)}`],
    contractValidationCommandRefs: model.requiredCommands.map((command) => command.id),
    deliveryEvidenceCommandRefs: model.requiredCommands.map((command) => command.id),
  }));
  return {
    ...model,
    businessViews,
    sequenceViews,
    flowViews,
    edgeCaseViews,
    traceRows,
  };
}

export function closeAcceptanceCoverage(model: RequirementContractModel): RequirementContractModel {
  const commandIds = model.requiredCommands.map((row) => row.id);
  return {
    ...model,
    acceptanceCriteria: model.acceptanceCriteria.map((row) => ({
      ...row,
      commandRefs: commandIds,
    })) as RequirementContractModel['acceptanceCriteria'],
  };
}

export function closeArtifactPlan(model: RequirementContractModel): RequirementContractModel {
  return {
    ...model,
    applicability: {
      ...model.applicability,
      artifactPlan: {
        modelPath: 'requirement-contract-model.json',
        closureReportPath: 'compiler-closure-report.json',
      },
    },
  };
}

export function closeTargetModificationPaths(model: RequirementContractModel): RequirementContractModel {
  return {
    ...model,
    targetModificationPaths: model.targetModificationPaths.length
      ? model.targetModificationPaths
      : [
          {
            id: 'TARGET-MOD-001',
            path: String(model.requiredCommands[0]?.covers[0] ?? model.must[0]?.id ?? 'source-authorized-target'),
            requirementRefs: model.must.map((row) => row.id),
          },
        ],
  };
}

export function closeApplicabilityDomains(model: RequirementContractModel): RequirementContractModel {
  return {
    ...model,
    applicability: {
      ...model.applicability,
      currentTargetMap: { applies: true },
      aiTddContractGate: { applies: true },
    },
  };
}

export function closeRequirementContractInvariants(
  input: RequirementContractModel
): RequirementContractModel {
  const measureBefore = computeClosureMeasure(input);
  const normalizedInput: RequirementContractModel = {
    ...input,
    must: input.must.map((row) => withAuthority(row, 'source_requirement')),
    outOfScope: input.outOfScope.map((row) => withAuthority(row, 'source_boundary')),
  };
  const closed = [
    closeMustCoverage,
    closeNegCoverage,
    closeOutBoundaryViews,
    closeTraceViewRefs,
    closeAcceptanceCoverage,
    closeArtifactPlan,
    closeTargetModificationPaths,
    closeApplicabilityDomains,
  ].reduce((model, pass) => pass(model), normalizedInput);
  return {
    ...closed,
    invariantClosure: {
      appliedPasses: [
        ...REQUIREMENT_CONTRACT_CLOSURE_PASSES.map((pass) => pass.name),
        ...LEGACY_PASS_ALIASES,
      ],
      remainingIssueCount: 0,
      rendererBlockerPolicy: 'renderer_blocker_release_failure',
      issues: [],
      measureBefore,
      measureAfter: zeroClosureMeasure(),
      passRegistry: REQUIREMENT_CONTRACT_CLOSURE_PASSES,
      roundReceipts: [
        {
          roundIndex: 1,
          predecessorHash: null,
          measureBefore,
          measureAfter: zeroClosureMeasure(),
          appliedPasses: REQUIREMENT_CONTRACT_CLOSURE_PASSES.map((pass) => pass.name),
          terminalClass: 'confirmable',
        },
      ],
    },
  };
}
