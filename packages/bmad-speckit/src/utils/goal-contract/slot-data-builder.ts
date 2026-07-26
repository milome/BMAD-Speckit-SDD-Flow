const { buildSourceCoverageMatrix, validateSourceCoverage } = require(
  __filename.endsWith('.ts') ? './source-coverage-matrix.ts' : './source-coverage-matrix'
);
const { resolveEntryProfileOverlay, validateEntryProfile } = require(
  __filename.endsWith('.ts') ? './entry-scenarios.ts' : './entry-scenarios'
);
const { projectEvidenceDimensions } = require(
  __filename.endsWith('.ts') ? './evidence-projections.ts' : './evidence-projections'
);

export type GoalContractSlotDataBuilderModule = never;

type GoalContractBuilderError = Error & {
  code?: string;
  implementationProofAudit?: unknown;
  coverageAudit?: unknown;
  failureClass?: string;
  invalidFields?: string[];
};

function repoPath(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function makeRegistries(obligations) {
  const commandObligations = obligations.filter(
    (obligation) => obligation.kind === 'command_block'
  );
  const sourceObligations = obligations.map((obligation, index) => {
    const number = String(index + 1).padStart(3, '0');
    const commandIndex =
      obligation.kind === 'command_block' ? index : obligations.indexOf(commandObligations[0]);
    const commandRef =
      commandObligations.length === 0
        ? `CMD${number}`
        : `CMD${String(commandIndex + 1).padStart(3, '0')}`;
    return {
      ...obligation,
      goalTaskRefs: [`G${number}`],
      acceptanceRefs: [`ACC${number}`],
      commandRefs: [commandRef],
      evidenceRefs: [`EVD${number}`],
    };
  });
  return {
    sourceObligations,
    tasks: sourceObligations.map((obligation) => obligation.goalTaskRefs[0]),
    acceptance: sourceObligations.map((obligation) => obligation.acceptanceRefs[0]),
    commands: [...new Set(sourceObligations.map((obligation) => obligation.commandRefs[0]))],
    evidence: sourceObligations.map((obligation) => obligation.evidenceRefs[0]),
  };
}

function isCodeObligation(obligation) {
  const text = `${obligation.headingPath?.join(' ') || ''} ${obligation.text || ''} ${obligation.summary || ''}`;
  return /packages\/|_bmad\/|tests\/|\.js|\.ts|script|CLI|command|seam|receipt|safeWriteText|copyFileAtomic/u.test(
    text
  );
}

function commandTextFromFence(text) {
  const lines = String(text || '').split(/\r?\n/u);
  return lines
    .filter((line) => !/^(```|~~~)/u.test(line.trim()))
    .join('\n')
    .trim();
}

function implementationProofAudit(sourceObligations) {
  const commandBlocks = sourceObligations.filter(
    (obligation) => obligation.kind === 'command_block'
  );
  const codeObligations = sourceObligations.filter(isCodeObligation);
  const blockingReasons = [];
  if (codeObligations.length > 0 && commandBlocks.length === 0) {
    blockingReasons.push(
      'code obligations require behavior, static seam, receipt field, or CLI output commands'
    );
  }
  return {
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    codeObligationCount: codeObligations.length,
    commandBlockCount: commandBlocks.length,
    codeObligationEvidenceKinds: [
      'behavior_test',
      'source_seam_static_assertion',
      'receipt_field_assertion',
      'cli_output_assertion',
    ],
    coverageOnlyCommandAllowedForCodeObligations: false,
    blockingReasons,
  };
}

function frontMatter(metadata) {
  return [
    '---',
    'goalContractVersion: goal-execution-contract/v1',
    `goalContractProfileVersion: ${metadata.profile.profileVersion}`,
    `goalContractProfileHash: ${metadata.profile.profileHash}`,
    `entryScenario: ${metadata.entryProfile.entryScenario}`,
    `finalArtifactAuthority: ${metadata.entryProfile.finalArtifactAuthority}`,
    'contractMode: frozen',
    'rewritePolicy: forbidden',
    'executionMode: execute_only',
    `sourcePlanPath: ${metadata.source.sourcePlanPath}`,
    `sourcePlanHash: ${metadata.source.sourcePlanHash}`,
    `sourceBytes: ${metadata.source.sourceBytes}`,
    `sourceLines: ${metadata.source.sourceLines}`,
    `coverageReceiptPath: ${repoPath(metadata.coverageReceiptPath)}`,
    `generationReceiptPath: ${repoPath(metadata.generationReceiptPath)}`,
    'unmappedSourceObligations: 0',
    `runtimeRecordId: GOAL-CONTRACT-GENERATE-${Date.now()}`,
    'entryFlow: goal_contract_generate',
    `taskRange: G001-${metadata.lastTaskId}`,
    `acceptanceRange: ACC001-${metadata.lastAcceptanceId}`,
    'completionGate: all_acceptance_items_and_required_commands_pass',
    'repairPolicy: execute_declared_tasks_only_and_stop_on_scope_or_semantic_gap',
    'stopPolicy: stop_on_contract_gap_scope_expansion_source_coverage_gap_or_hash_mismatch',
    'generatedBy: bmad-speckit goal-contract generate',
    `generatedAt: ${metadata.generatedAt}`,
    '---',
  ].join('\n');
}

function buildImplementationTasks(sourceObligations) {
  return sourceObligations
    .map((obligation, index) => {
      const taskId = obligation.goalTaskRefs[0];
      const commandId = obligation.commandRefs[0];
      const acceptanceId = obligation.acceptanceRefs[0];
      return [
        `### ${taskId} Implement source obligation ${obligation.id}`,
        '',
        `**Purpose:** Preserve source obligation ${obligation.id} from ${obligation.sourcePlanPath}:${obligation.lineStart}-${obligation.lineEnd}.`,
        '',
        '**Files:**',
        `- ${obligation.sourcePlanPath}`,
        '',
        '**Steps:**',
        `- Implement ${obligation.id} using sourceRef=${obligation.sourcePlanPath}:${obligation.lineStart}-${obligation.lineEnd} and sourceTextHash=${obligation.textHash}.`,
        `- Keep generated semantic rows linked to ${obligation.id}, ${taskId}, ${acceptanceId}, ${commandId}, and ${obligation.evidenceRefs[0]}.`,
        '',
        '**Validation:**',
        `- COMMAND ${commandId} MUST prove ${obligation.id} remains mapped to ${taskId} and ${acceptanceId}.`,
        '',
        '**Acceptance:**',
        `- ${acceptanceId} MUST have direct evidence from COMMAND ${commandId}.`,
        '',
        `<!-- source-order:${index + 1} -->`,
      ].join('\n');
    })
    .join('\n\n');
}

function buildAcceptance(sourceObligations) {
  return sourceObligations
    .map(
      (obligation) =>
        `- [ ] ${obligation.acceptanceRefs[0]}: ${obligation.id} MUST map to ${obligation.goalTaskRefs[0]}, ${obligation.commandRefs[0]}, and ${obligation.evidenceRefs[0]}. Evidence MUST come from ${obligation.commandRefs[0]}.`
    )
    .join('\n');
}

function buildTrace(sourceObligations) {
  return [
    '| Acceptance ID | Task IDs | Evidence command and artifact | Pass condition |',
    '| --- | --- | --- | --- |',
    ...sourceObligations.map(
      (obligation) =>
        `| ${obligation.acceptanceRefs[0]} | ${obligation.goalTaskRefs[0]} | ${obligation.commandRefs[0]}; ${obligation.evidenceRefs[0]} | ${obligation.id} has task, acceptance, command, and evidence mappings. |`
    ),
  ].join('\n');
}

function buildCommands(sourceObligations, coverageReceiptPath) {
  const commandObligations = sourceObligations.filter(
    (obligation) => obligation.kind === 'command_block'
  );
  const commandsToRender = commandObligations.length > 0 ? commandObligations : sourceObligations;
  return commandsToRender
    .map((obligation, index) =>
      [
        `### ${index + 1}. COMMAND ${obligation.commandRefs[0]}`,
        '',
        '```powershell',
        obligation.kind === 'command_block'
          ? commandTextFromFence(obligation.text)
          : `pwsh.exe -NoLogo -NoProfile -Command "& { node -e \\"const fs=require('fs'); const receipt=JSON.parse(fs.readFileSync('${repoPath(coverageReceiptPath)}','utf8')); if (!receipt.sourceObligations.some((item)=>item.id==='${obligation.id}')) process.exit(1);\\" }"`,
        '```',
        '',
        obligation.kind === 'command_block'
          ? 'Expected pass condition: Command exits `0` and proves the source plan command block behavior.'
          : `Expected pass condition: Command exits \`0\` and proves ${obligation.id} remains source-covered without serving as code implementation proof.`,
      ].join('\n')
    )
    .join('\n\n');
}

function buildProjectionSlotData(evidenceGraph) {
  const projections = projectEvidenceDimensions(evidenceGraph);
  const projectionById = new Map<string, (typeof projections)[number]>(
    projections.map((projection) => [projection.projectionId, projection])
  );
  function markdown(projectionId) {
    return projectionById.get(projectionId)?.markdown || '';
  }
  return {
    traceSliceTrackingMatrix: markdown('projection.trace_slices'),
    strictAcceptanceChecklist: markdown('projection.strict_acceptance'),
    acceptanceTraceabilityMatrix: markdown('projection.acceptance_traceability'),
    sourceCoverageMatrix: markdown('projection.source_coverage'),
    manualVerificationScenarios: markdown('projection.manual_scenarios'),
    completionEvidencePacket: markdown('projection.completion_evidence'),
    stopConditions: markdown('projection.stop_conditions'),
    projectionReceipt: {
      schemaVersion: 'goal-contract-projection-receipt/v1',
      graphHash: evidenceGraph.graphHash,
      projectionIds: projections.map((projection) => projection.projectionId),
      requiredSectionCount: projections.length,
      runtimeEvidenceAuthority: false,
    },
  };
}

function buildExpectedEvidenceFreezeSlot(registry) {
  if (!registry?.immutable || !Array.isArray(registry.items)) return '';
  return [
    `- Registry hash: \`${registry.registryHash}\``,
    `- Contract hash: \`${registry.contractHash}\``,
    `- Frozen at: \`${registry.frozenAt}\``,
    `- Expected evidence count: \`${registry.itemCount}\``,
    '',
    '| Evidence ID | Producer | Command | Production Entry | Admissible Types | Minimum Strength | Required Fields | Freshness | Failure Class |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...registry.items.map(
      (item) =>
        `| ${item.id} | ${item.producer} | ${item.commandId} | ${
          item.productionEntryPoint
        } | ${(item.admissibleObservedEvidenceTypes || []).join(', ')} | ${
          item.minimumStrength
        } | ${(item.requiredFields || []).join(', ')} | maxAgeMs=${
          item.freshness.maxAgeMs
        } | ${item.failureClass} |`
    ),
  ].join('\n');
}

function buildSlotData({
  source,
  profile,
  outPath,
  coverageReceiptPath,
  generationReceiptPath,
  evidenceGraph = null,
  expectedEvidenceRegistry = null,
  generatedAt = new Date().toISOString(),
}) {
  const entryProfileValidation = validateEntryProfile(profile, 'standalone_goal_contract');
  if (entryProfileValidation.decision !== 'pass') {
    const error = new Error(entryProfileValidation.failureClass);
    Object.assign(error, entryProfileValidation);
    throw error;
  }
  const entryProfile = resolveEntryProfileOverlay(profile, 'standalone_goal_contract');
  const registries = makeRegistries(source.sourceObligations);
  const proofAudit = implementationProofAudit(registries.sourceObligations);
  if (proofAudit.decision !== 'pass') {
    const error = new Error('implementation_proof_missing') as GoalContractBuilderError;
    error.code = 'implementation_proof_missing';
    error.implementationProofAudit = proofAudit;
    throw error;
  }
  const coverageAudit = validateSourceCoverage({
    sourceObligations: registries.sourceObligations,
    registries,
  });
  if (coverageAudit.decision !== 'pass') {
    const error = new Error('source_coverage_unmapped') as GoalContractBuilderError;
    error.code = 'source_coverage_unmapped';
    error.coverageAudit = coverageAudit;
    throw error;
  }
  const lastTaskId = registries.tasks.at(-1);
  const lastAcceptanceId = registries.acceptance.at(-1);
  const projectionSlots = evidenceGraph ? buildProjectionSlotData(evidenceGraph) : null;
  const slotData = {
    frontMatter: frontMatter({
      profile,
      entryProfile,
      source,
      coverageReceiptPath,
      generationReceiptPath,
      lastTaskId,
      lastAcceptanceId,
      generatedAt,
    }),
    goalEntry: `\`\`\`text\n/goal ${repoPath(outPath)}\n\`\`\``,
    authorityModel: [
      `- \`${repoPath(outPath)}\` is the frozen human and model execution authority for this generated goal contract.`,
      `- \`${source.sourcePlanPath}\` is the source plan for this generated goal contract.`,
      `- \`sourcePlanHash=${source.sourcePlanHash}\` binds this contract to source bytes.`,
      `- \`entryScenario=${entryProfile.entryScenario}\` selects the standalone authority profile.`,
      `- \`finalArtifactAuthority=${entryProfile.finalArtifactAuthority}\` binds authority to one Markdown contract.`,
      '- The standalone Markdown contract is the frozen execution authority and does not defer to a nonexistent model packet.',
      '- `model_packet.json is the machine-readable execution authority` only for the two four-artifact compilation entries.',
      '- `goal_execution.md is not execution authority`; this generated contract is the frozen execution source for this goal.',
      '- `/goal completion is not closeout proof`; completion requires command evidence and receipt evidence.',
    ].join('\n'),
    rootCause: [
      'The source plan requires source-plan-faithful goal execution generation with deterministic coverage proof.',
      'The generator must fail closed when any source obligation lacks generated task mapping, acceptance mapping, command mapping, evidence mapping.',
    ].join('\n\n'),
    domainAddenda: [
      '### Source coverage contract',
      '',
      '- Every `SRC` row MUST map to at least one `G`, one `ACC`, one `CMD`, and one `EVD` row.',
      '- Coverage receipt rows MUST match the Markdown `Source Coverage Matrix` rows.',
      '- `unmappedSourceObligations` MUST equal `0`.',
    ].join('\n'),
    implementationTasks: buildImplementationTasks(registries.sourceObligations),
    traceSliceTrackingMatrix:
      projectionSlots?.traceSliceTrackingMatrix || buildTrace(registries.sourceObligations),
    strictAcceptanceChecklist:
      projectionSlots?.strictAcceptanceChecklist || buildAcceptance(registries.sourceObligations),
    acceptanceTraceabilityMatrix:
      projectionSlots?.acceptanceTraceabilityMatrix || buildTrace(registries.sourceObligations),
    sourceCoverageMatrix:
      projectionSlots?.sourceCoverageMatrix ||
      buildSourceCoverageMatrix({
        sourceObligations: registries.sourceObligations,
      }),
    requiredTestCommands: buildCommands(registries.sourceObligations, coverageReceiptPath),
    manualVerificationScenarios:
      projectionSlots?.manualVerificationScenarios ||
      '- MV001: Inspect the coverage receipt and confirm `decision` is `pass` and `unmappedSourceObligations` is empty.',
    completionEvidencePacket:
      projectionSlots?.completionEvidencePacket ||
      [
        `- \`sourcePlanPath\`: \`${source.sourcePlanPath}\`.`,
        `- \`sourcePlanHash\`: \`${source.sourcePlanHash}\`.`,
        `- \`coverageReceiptPath\`: \`${repoPath(coverageReceiptPath)}\`.`,
        `- \`generationReceiptPath\`: \`${repoPath(generationReceiptPath)}\`.`,
        '- `residualRisks`: `none` only when all required commands pass.',
      ].join('\n'),
    expectedEvidenceFreeze: buildExpectedEvidenceFreezeSlot(expectedEvidenceRegistry),
    stopConditions:
      projectionSlots?.stopConditions ||
      [
        '- STOP001: If source hash differs from the front matter source hash, stop with `contract_amendment_required:source_plan_hash_mismatch`.',
        '- STOP002: If any source obligation is unmapped, stop with `source_coverage_unmapped`.',
        '- STOP003: If coverage receipt is missing, stop with `coverage_receipt_missing`.',
      ].join('\n'),
  };
  return {
    slotData,
    registries,
    coverageAudit,
    implementationProofAudit: proofAudit,
    entryProfile,
    entryProfileValidation,
    projectionReceipt: projectionSlots?.projectionReceipt || null,
  };
}

function assertValidatedPartitionSelection(selection) {
  const requiredArrays = [
    'primarySourceObligations',
    'atomicTasks',
    'completionPredicates',
    'evidenceContracts',
    'inheritedConstraints',
  ];
  const invalidFields = requiredArrays.filter((field) => !Array.isArray(selection?.[field]));
  if (
    invalidFields.length > 0 ||
    selection.primarySourceObligations.length === 0 ||
    selection.atomicTasks.length === 0 ||
    selection.completionPredicates.length === 0 ||
    selection.evidenceContracts.length === 0
  ) {
    const error = new Error('partition_selection_invalid') as GoalContractBuilderError;
    error.failureClass = 'partition_selection_invalid';
    error.invalidFields = invalidFields;
    throw error;
  }
  const sourceIds = new Set(selection.primarySourceObligations.map((source) => source.id));
  const taskIds = selection.atomicTasks.map((task) => task.taskId);
  const predicateIds = selection.completionPredicates.map((predicate) => predicate.predicateId);
  const evidenceIds = selection.evidenceContracts.map((evidence) => evidence.evidenceContractId);
  if (
    new Set(taskIds).size !== taskIds.length ||
    new Set(predicateIds).size !== predicateIds.length ||
    new Set(evidenceIds).size !== evidenceIds.length ||
    selection.atomicTasks.some(
      (task) =>
        !task.taskId ||
        !Array.isArray(task.sourceIds) ||
        task.sourceIds.some((sourceId) => !sourceIds.has(sourceId))
    )
  ) {
    const error = new Error('partition_selection_invalid') as GoalContractBuilderError;
    error.failureClass = 'partition_selection_invalid';
    throw error;
  }
}

function buildPartitionSlotData({ source, profile, selection }) {
  assertValidatedPartitionSelection(selection);
  const implementationTasks = selection.atomicTasks
    .map((task) =>
      [
        `### ${task.taskId} ${task.title}`,
        '',
        `- Source obligations: ${task.sourceIds.map((id) => `\`${id}\``).join(', ')}.`,
        `- Dependencies: ${
          (task.dependencyIds || []).map((id) => `\`${id}\``).join(', ') || 'none'
        }.`,
      ].join('\n')
    )
    .join('\n\n');
  const strictAcceptanceChecklist = selection.completionPredicates
    .map((predicate) => `- [ ] **${predicate.predicateId}:** ${predicate.statement}`)
    .join('\n');
  const completionEvidencePacket = selection.evidenceContracts
    .map(
      (contract) =>
        `- \`${contract.evidenceContractId}\`: producers=${contract.producerTaskIds.join(
          ', '
        )}; freshness=${contract.freshnessRule}.`
    )
    .join('\n');
  const sourceRows = selection.primarySourceObligations
    .map(
      (item) =>
        `| ${item.id} | ${String(item.summary || item.text || item.id).replace(/\|/gu, '\\|')} |`
    )
    .join('\n');
  const inheritedConstraints =
    selection.inheritedConstraints.length === 0
      ? '- None.'
      : selection.inheritedConstraints
          .map(
            (constraint) =>
              `- \`${constraint.constraintId}\`: inherited from the validated Execution Projection.`
          )
          .join('\n');
  return {
    slotData: {
      implementationTasks,
      strictAcceptanceChecklist,
      sourceCoverageMatrix: [
        '| Source ID | Selected obligation |',
        '| --- | --- |',
        sourceRows,
      ].join('\n'),
      completionEvidencePacket,
      domainAddenda: ['### Inherited partition constraints', '', inheritedConstraints].join('\n'),
    },
    selectionReceipt: {
      schemaVersion: 'goal-contract-partition-slot-selection-receipt/v1',
      sourcePlanHash: source?.sourcePlanHash || null,
      profileVersion: profile?.profileVersion || null,
      primarySourceObligationCount: selection.primarySourceObligations.length,
      atomicTaskCount: selection.atomicTasks.length,
      completionPredicateCount: selection.completionPredicates.length,
      evidenceContractCount: selection.evidenceContracts.length,
      inheritedConstraintCount: selection.inheritedConstraints.length,
    },
  };
}

module.exports = {
  buildExpectedEvidenceFreezeSlot,
  buildPartitionSlotData,
  buildProjectionSlotData,
  buildSlotData,
  implementationProofAudit,
  makeRegistries,
};
