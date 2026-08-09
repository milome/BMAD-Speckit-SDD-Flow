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

function legacyRegistries(obligations) {
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
    projectionMode: 'legacy',
    sourceObligations,
    tasks: sourceObligations.map((obligation) => obligation.goalTaskRefs[0]),
    acceptance: sourceObligations.map((obligation) => obligation.acceptanceRefs[0]),
    commands: [...new Set(sourceObligations.map((obligation) => obligation.commandRefs[0]))],
    evidence: sourceObligations.map((obligation) => obligation.evidenceRefs[0]),
  };
}

function declaredRecordId(obligation) {
  if (typeof obligation.declaredSourceId === 'string') {
    return obligation.declaredSourceId;
  }
  return obligation.declaredId ? obligation.id : null;
}

function isExplicitTaskHeading(obligation) {
  const declaredId = declaredRecordId(obligation);
  if (!declaredId) return false;
  const escapedId = declaredId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const sourceText = String(obligation.exactText || obligation.text || '').trim();
  return new RegExp(`^(?:#{1,6}\\s+)?Task\\s+${escapedId}\\b`, 'u').test(sourceText);
}

function headingPathStartsWith(candidate, prefix) {
  return (
    prefix.length > 0 &&
    prefix.length <= candidate.length &&
    prefix.every((heading, index) => heading === candidate[index])
  );
}

function taskOwners(obligation, tasks) {
  const declaredId = declaredRecordId(obligation);
  const scoped = tasks
    .filter(
      (task) =>
        task.headingPath.some((heading) => heading.includes(task.id)) &&
        headingPathStartsWith(obligation.headingPath || [], task.headingPath)
    )
    .sort((left, right) => right.headingPath.length - left.headingPath.length);
  if (scoped.length > 0) return [scoped[0].id];
  const referenced = tasks
    .filter(
      (task) =>
        declaredId === task.id ||
        (declaredId &&
          new RegExp(`(?:^|-)${task.id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?:-|$)`, 'u').test(
            declaredId
          ))
    )
    .map((task) => task.id);
  if (referenced.length > 0) return referenced;
  const sliceId =
    [...(obligation.headingPath || [])]
      .reverse()
      .map((heading) =>
        /^([A-Z][A-Z0-9]*)\s+(?:required\s+tests|required\s+commands|exit\s+gate)\b/iu.exec(
          String(heading)
        )
      )
      .find(Boolean)?.[1]
      ?.toUpperCase() || null;
  const sliceTasks = sliceId
    ? tasks.filter((task) => task.id.startsWith(`${sliceId}-`)).map((task) => task.id)
    : [];
  return sliceTasks.length > 0 ? sliceTasks : tasks.length > 0 ? [tasks[0].id] : [];
}

function makeStructuredRegistries(obligations, taskObligations) {
  const tasks = taskObligations.map((obligation) => ({
    id: declaredRecordId(obligation),
    headingPath: [...(obligation.headingPath || [])],
  }));
  const typed = (kind) =>
    obligations.filter((obligation) => obligation.kind === kind && declaredRecordId(obligation));
  const acceptanceObligations = typed('acceptance_condition');
  const commandObligations = typed('verification_command');
  const evidenceObligations = typed('evidence_contract');
  const ownersBySourceId = new Map(
    obligations.map((obligation) => [obligation.id, taskOwners(obligation, tasks)])
  );
  const ownedIds = (records, ownerIds) =>
    records
      .filter((record) =>
        ownersBySourceId.get(record.id)?.some((ownerId) => ownerIds.includes(ownerId))
      )
      .map(declaredRecordId);
  const sourceObligations = obligations.map((obligation) => {
    const goalTaskRefs = ownersBySourceId.get(obligation.id) || [];
    return {
      ...obligation,
      goalTaskRefs,
      acceptanceRefs: ownedIds(acceptanceObligations, goalTaskRefs),
      commandRefs: ownedIds(commandObligations, goalTaskRefs),
      evidenceRefs: ownedIds(evidenceObligations, goalTaskRefs),
    };
  });
  return {
    projectionMode: 'typed',
    sourceObligations,
    tasks: tasks.map(({ id }) => id),
    acceptance: acceptanceObligations.map(declaredRecordId),
    commands: commandObligations.map(declaredRecordId),
    evidence: evidenceObligations.map(declaredRecordId),
  };
}

function makeRegistries(obligations) {
  const taskObligations = obligations.filter(
    (obligation) =>
      obligation.kind === 'declared_execution_task' && isExplicitTaskHeading(obligation)
  );
  return taskObligations.length > 0
    ? makeStructuredRegistries(obligations, taskObligations)
    : legacyRegistries(obligations);
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
    (obligation) =>
      obligation.kind === 'command_block' || obligation.kind === 'verification_command'
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
  const authorityBindings = metadata.authorityBindings || {};
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
    ...[
      'sourceCompositionPolicyHash',
      'orderedSourceSnapshotSetHash',
      'sourceAuthorityBundleHash',
      'canonicalIntentSemanticHash',
      'canonicalIntentBundleHash',
      'authorityAttestationHash',
      'goalContractSemanticHash',
      'goalContractHash',
    ]
      .filter((field) => authorityBindings[field])
      .map((field) => `${field}: ${authorityBindings[field]}`),
    `runtimeRecordId: ${metadata.runtimeRecordId}`,
    'entryFlow: goal_contract_generate',
    `projectionMode: ${metadata.projectionMode}`,
    `taskRange: ${
      metadata.projectionMode === 'typed'
        ? `${metadata.firstTaskId}..${metadata.lastTaskId}`
        : `G001-${metadata.lastTaskId}`
    }`,
    `acceptanceRange: ${
      metadata.projectionMode === 'typed'
        ? `${metadata.firstAcceptanceId}..${metadata.lastAcceptanceId}`
        : `ACC001-${metadata.lastAcceptanceId}`
    }`,
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
      const provenance = obligation.canonicalIntentRecordId
        ? [
            `- Canonical intent: \`${obligation.canonicalIntentRecordId}\`.`,
            `- Declared source ID: \`${obligation.declaredSourceId || 'none'}\`.`,
            `- Source authority: \`${obligation.sourceArtifactId}\` in namespace \`${obligation.namespace}\`.`,
            `- Parent task refs: \`${(obligation.parentTaskRefs || []).join(', ') || 'none'}\`.`,
            `- SpecSpan refs: \`${(obligation.specSpanRefs || []).join(', ')}\`.`,
          ]
        : [];
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
        ...provenance,
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function declaredRecordDescription(obligation, declaredId, prefix = '') {
  const text = String(obligation?.exactText || obligation?.text || '')
    .replace(/^[-*]\s+/u, '')
    .trim();
  const declaration = new RegExp(
    `^${prefix ? `${escapeRegExp(prefix)}\\s+` : ''}${escapeRegExp(declaredId)}\\b\\s*[:：]?\\s*`,
    'u'
  );
  return text.replace(declaration, '').trim() || declaredId;
}

function typedRecord(registries, recordId, kind) {
  return registries.sourceObligations.find(
    (obligation) => obligation.kind === kind && declaredRecordId(obligation) === recordId
  );
}

function typedTaskRefs(registries, taskId, field) {
  return [
    ...new Set(
      registries.sourceObligations
        .filter((obligation) => (obligation.goalTaskRefs || []).includes(taskId))
        .flatMap((obligation) => obligation[field] || [])
    ),
  ];
}

function taskMetadataValue(registries, taskId, fieldName) {
  const escapedFieldName = escapeRegExp(fieldName);
  const pattern = new RegExp(
    `^\\*{0,2}${escapedFieldName}\\s*[:：]\\*{0,2}\\s*(.+?)\\s*$`,
    'iu'
  );
  const values = [
    ...new Set(
      registries.sourceObligations
        .filter((obligation) => (obligation.goalTaskRefs || []).includes(taskId))
        .map((obligation) =>
          pattern.exec(String(obligation.exactText || obligation.text || '').trim())?.[1]?.trim()
        )
        .filter(Boolean)
    ),
  ];
  if (values.length > 1) {
    const error = new Error('source_task_execution_role_ambiguous') as GoalContractBuilderError;
    error.failureClass = 'source_task_execution_role_ambiguous';
    throw error;
  }
  return values[0] || null;
}

function parseMetadataIdentifiers(value) {
  return [
    ...new Set(
      [...String(value || '').matchAll(/`([^`\r\n]+)`/gu)].map((match) => match[1])
    ),
  ];
}

function typedTaskExecutionRole(registries, taskId, commandRefs) {
  const executionClassValue = taskMetadataValue(registries, taskId, 'Execution Class');
  if (!executionClassValue) return null;
  const executionClass = parseMetadataIdentifiers(executionClassValue)[0] || executionClassValue;
  const ownedProductionPaths = taskMetadataValue(
    registries,
    taskId,
    'Owned Production Paths'
  );
  const aggregateGatePhaseValue = taskMetadataValue(
    registries,
    taskId,
    'Aggregate Gate Phase'
  );
  const aggregateGatePhase =
    parseMetadataIdentifiers(aggregateGatePhaseValue)[0] || aggregateGatePhaseValue;
  const aggregateValidationCommandsValue = taskMetadataValue(
    registries,
    taskId,
    'Aggregate Validation Commands'
  );
  const aggregateValidationCommands = parseMetadataIdentifiers(
    aggregateValidationCommandsValue
  );

  if (!['executable_child', 'aggregate_only'].includes(executionClass)) {
    const error = new Error('source_task_execution_role_invalid') as GoalContractBuilderError;
    error.failureClass = 'source_task_execution_role_invalid';
    throw error;
  }
  if (
    executionClass === 'executable_child' &&
    (!ownedProductionPaths || ownedProductionPaths === '`none`' || commandRefs.length === 0)
  ) {
    const error = new Error('source_executable_task_contract_invalid') as GoalContractBuilderError;
    error.failureClass = 'source_executable_task_contract_invalid';
    throw error;
  }
  if (
    executionClass === 'aggregate_only' &&
    (ownedProductionPaths !== '`none`' ||
      !['post_child_execution', 'final_aggregate'].includes(aggregateGatePhase) ||
      aggregateValidationCommands.length === 0 ||
      aggregateValidationCommands.some((commandId) => !commandRefs.includes(commandId)))
  ) {
    const error = new Error('source_aggregate_task_contract_invalid') as GoalContractBuilderError;
    error.failureClass = 'source_aggregate_task_contract_invalid';
    throw error;
  }
  return {
    executionClass,
    ownedProductionPaths,
    aggregateGatePhase,
    aggregateValidationCommandsValue,
  };
}

function buildTypedImplementationTasks(registries) {
  return registries.tasks
    .map((taskId, index) => {
      const task = typedRecord(registries, taskId, 'declared_execution_task');
      const acceptanceRefs = typedTaskRefs(registries, taskId, 'acceptanceRefs');
      const commandRefs = typedTaskRefs(registries, taskId, 'commandRefs');
      const evidenceRefs = typedTaskRefs(registries, taskId, 'evidenceRefs');
      const executionRole = typedTaskExecutionRole(registries, taskId, commandRefs);
      if (executionRole?.executionClass === 'aggregate_only') {
        return [
          `### ${taskId} ${declaredRecordDescription(task, taskId, 'Task')}`,
          '',
          `**Execution Class:** \`${executionRole.executionClass}\``,
          `**Owned Production Paths:** ${executionRole.ownedProductionPaths}`,
          `**Aggregate Gate Phase:** \`${executionRole.aggregateGatePhase}\``,
          `**Aggregate Validation Commands:** ${executionRole.aggregateValidationCommandsValue}`,
          '',
          `**Purpose:** Evaluate the source-declared aggregate gate \`${taskId}\` only after all executable children are closed.`,
          '',
          '**Files:**',
          '- No production files.',
          '',
          '**Steps:**',
          `- Execute only the aggregate validation commands bound to \`${taskId}\` and its Source Coverage Matrix rows.`,
          '- This task MUST NOT enter the executable child manifest.',
          '- This task MUST NOT create an atomic child commit.',
          `- Resolve the task declaration through SpecSpan refs \`${(task.specSpanRefs || []).join(', ')}\`.`,
          '',
          '**Validation:**',
          `- Required commands: \`${commandRefs.join(', ')}\`.`,
          '',
          '**Acceptance:**',
          `- Acceptance: \`${acceptanceRefs.join(', ')}\`.`,
          `- Evidence: \`${evidenceRefs.join(', ')}\`.`,
          '',
          `<!-- source-order:${index + 1} -->`,
        ].join('\n');
      }
      return [
        `### ${taskId} ${declaredRecordDescription(task, taskId, 'Task')}`,
        '',
        ...(executionRole
          ? [
              `**Execution Class:** \`${executionRole.executionClass}\``,
              `**Owned Production Paths:** ${executionRole.ownedProductionPaths}`,
              '',
            ]
          : []),
        `**Purpose:** Execute the source-declared task \`${taskId}\` without splitting its task-owned obligations into synthetic tasks.`,
        '',
        '**Files:**',
        `- Use only the target modification paths declared by \`${taskId}\` in \`${task.sourcePlanPath}\`.`,
        '',
        '**Steps:**',
        `- Implement the exact task semantics bound to \`${taskId}\` and its Source Coverage Matrix rows.`,
        `- Resolve the task declaration through SpecSpan refs \`${(task.specSpanRefs || []).join(', ')}\`.`,
        '',
        '**Validation:**',
        `- Required commands: \`${commandRefs.join(', ')}\`.`,
        '',
        '**Acceptance:**',
        `- Acceptance: \`${acceptanceRefs.join(', ')}\`.`,
        `- Evidence: \`${evidenceRefs.join(', ')}\`.`,
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
        `- [ ] ${obligation.acceptanceRefs[0]}: ${obligation.id} MUST map to ${obligation.goalTaskRefs[0]}, ${obligation.commandRefs[0]}, and ${obligation.evidenceRefs[0]}. Evidence MUST come from ${obligation.commandRefs[0]}.${
          obligation.canonicalIntentRecordId
            ? ` Provenance MUST preserve intent=${obligation.canonicalIntentRecordId}; source=${obligation.sourceArtifactId}; namespace=${obligation.namespace}; parentTaskRefs=${(obligation.parentTaskRefs || []).join(',') || 'none'}; specSpanRefs=${obligation.specSpanRefs.join(',')}.`
            : ''
        }`
    )
    .join('\n');
}

function buildTypedAcceptance(registries) {
  return registries.acceptance
    .map((acceptanceId) => {
      const acceptance = typedRecord(registries, acceptanceId, 'acceptance_condition');
      return `- [ ] ${acceptanceId}: ${declaredRecordDescription(
        acceptance,
        acceptanceId
      )} Tasks: ${(acceptance.goalTaskRefs || []).join(', ')}. Evidence: ${(
        acceptance.evidenceRefs || []
      ).join(', ')}. Commands: ${(acceptance.commandRefs || []).join(', ')}.`;
    })
    .join('\n');
}

function buildTrace(sourceObligations) {
  return [
    '| Acceptance ID | Task IDs | Evidence command and artifact | Pass condition |',
    '| --- | --- | --- | --- |',
    ...sourceObligations.map(
      (obligation) =>
        `| ${obligation.acceptanceRefs[0]} | ${obligation.goalTaskRefs[0]} | ${obligation.commandRefs[0]}; ${obligation.evidenceRefs[0]} | ${obligation.id} has task, acceptance, command, and evidence mappings.${
          obligation.canonicalIntentRecordId
            ? ` intent=${obligation.canonicalIntentRecordId}; source=${obligation.sourceArtifactId}; namespace=${obligation.namespace}; specSpanRefs=${obligation.specSpanRefs.join(',')}.`
            : ''
        } |`
    ),
  ].join('\n');
}

function buildTypedTrace(registries) {
  return [
    '| Acceptance ID | Task IDs | Evidence command and artifact | Pass condition |',
    '| --- | --- | --- | --- |',
    ...registries.acceptance.map((acceptanceId) => {
      const acceptance = typedRecord(registries, acceptanceId, 'acceptance_condition');
      return `| ${acceptanceId} | ${(acceptance.goalTaskRefs || []).join(
        ', '
      )} | ${(acceptance.commandRefs || []).join(', ')}; ${(acceptance.evidenceRefs || []).join(
        ', '
      )} | ${declaredRecordDescription(acceptance, acceptanceId)} |`;
    }),
  ].join('\n');
}

function buildCanonicalSourceCoverageMatrix(sourceObligations) {
  return [
    '| Source ID | Intent Record | Declared ID | Source Artifact | Namespace | SpecSpan Refs | Parent Tasks | Goal Tasks | Acceptance | Commands | Evidence |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...sourceObligations.map(
      (obligation) =>
        `| ${obligation.id} | ${obligation.canonicalIntentRecordId || 'none'} | ${
          obligation.declaredSourceId || 'none'
        } | ${obligation.sourceArtifactId} | ${obligation.namespace} | ${obligation.specSpanRefs.join(
          ', '
        )} | ${(obligation.parentTaskRefs || []).join(', ') || 'none'} | ${(
          obligation.goalTaskRefs || []
        ).join(', ')} | ${(obligation.acceptanceRefs || []).join(', ')} | ${(
          obligation.commandRefs || []
        ).join(', ')} | ${(obligation.evidenceRefs || []).join(', ')} |`
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

function commandTextFromInlineRun(text) {
  return /\bRun\s+`([^`\r\n]+)`/u.exec(String(text || ''))?.[1]?.trim() || '';
}

function buildTypedCommands(registries) {
  return registries.commands
    .map((commandId, index) => {
      const command = typedRecord(registries, commandId, 'verification_command');
      const executable = commandTextFromInlineRun(command?.exactText || command?.text);
      if (!executable) {
        const error = new Error(
          'verification_command_executable_missing'
        ) as GoalContractBuilderError;
        error.code = 'verification_command_executable_missing';
        error.failureClass = 'verification_command_executable_missing';
        throw error;
      }
      return [
        `### ${index + 1}. COMMAND ${commandId}`,
        '',
        '```powershell',
        executable,
        '```',
        '',
        `Expected pass condition: Command exits \`0\` and proves ${declaredRecordDescription(
          command,
          commandId
        )}`,
      ].join('\n');
    })
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

function authoritySupersessionTexts(registries) {
  return [
    ...new Set(
      registries.sourceObligations
        .filter((obligation) =>
          /\bE04\b/iu.test(String(obligation.exactText || obligation.text || ''))
        )
        .filter((obligation) =>
          /supersed|historical evidence|latest-hash|执行效力|历史证据|不得继续作为|不得继续授权/iu.test(
            String(obligation.exactText || obligation.text || '')
          )
        )
        .map((obligation) => String(obligation.exactText || obligation.text || '').trim())
        .filter(Boolean)
    ),
  ];
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
  runtimeRecordId = `GOAL-CONTRACT-GENERATE-${Date.now()}`,
  authorityBindings = null,
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
  const firstTaskId = registries.tasks.at(0);
  const lastTaskId = registries.tasks.at(-1);
  const firstAcceptanceId = registries.acceptance.at(0);
  const lastAcceptanceId = registries.acceptance.at(-1);
  const typedProjection = registries.projectionMode === 'typed';
  const supersessionTexts = authoritySupersessionTexts(registries);
  const projectionSlots = evidenceGraph ? buildProjectionSlotData(evidenceGraph) : null;
  const slotData = {
    frontMatter: frontMatter({
      profile,
      entryProfile,
      source,
      coverageReceiptPath,
      generationReceiptPath,
      projectionMode: registries.projectionMode,
      firstTaskId,
      lastTaskId,
      firstAcceptanceId,
      lastAcceptanceId,
      generatedAt,
      runtimeRecordId,
      authorityBindings,
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
      ...supersessionTexts.map((text) => `- Readiness supersession authority: ${text}`),
    ].join('\n'),
    rootCause: [
      'The source plan requires source-plan-faithful goal execution generation with deterministic coverage proof.',
      'The generator must fail closed when any source obligation lacks generated task mapping, acceptance mapping, command mapping, evidence mapping.',
    ].join('\n\n'),
    domainAddenda: [
      '### Source coverage contract',
      '',
      `- Every source row MUST map to at least one ${
        typedProjection ? 'declared Task' : '`G`'
      }, one acceptance, one command, and one evidence record.`,
      '- Coverage receipt rows MUST match the Markdown `Source Coverage Matrix` rows.',
      '- `unmappedSourceObligations` MUST equal `0`.',
    ].join('\n'),
    implementationTasks: typedProjection
      ? buildTypedImplementationTasks(registries)
      : buildImplementationTasks(registries.sourceObligations),
    traceSliceTrackingMatrix:
      projectionSlots?.traceSliceTrackingMatrix ||
      (typedProjection ? buildTypedTrace(registries) : buildTrace(registries.sourceObligations)),
    strictAcceptanceChecklist:
      projectionSlots?.strictAcceptanceChecklist ||
      (typedProjection
        ? buildTypedAcceptance(registries)
        : buildAcceptance(registries.sourceObligations)),
    acceptanceTraceabilityMatrix:
      projectionSlots?.acceptanceTraceabilityMatrix ||
      (typedProjection ? buildTypedTrace(registries) : buildTrace(registries.sourceObligations)),
    sourceCoverageMatrix:
      projectionSlots?.sourceCoverageMatrix ||
      (registries.sourceObligations.some(({ canonicalIntentRecordId }) => canonicalIntentRecordId)
        ? buildCanonicalSourceCoverageMatrix(registries.sourceObligations)
        : buildSourceCoverageMatrix({
            sourceObligations: registries.sourceObligations,
          })),
    requiredTestCommands: typedProjection
      ? buildTypedCommands(registries)
      : buildCommands(registries.sourceObligations, coverageReceiptPath),
    manualVerificationScenarios:
      projectionSlots?.manualVerificationScenarios ||
      '- MV001: Inspect the coverage receipt and confirm `decision` is `pass` and `unmappedSourceObligations` is empty.',
    completionEvidencePacket:
      projectionSlots?.completionEvidencePacket ||
      [
        `- \`sourcePlanPath\`: \`${source.sourcePlanPath}\`.`,
        `- \`sourcePlanHash\`: \`${source.sourcePlanHash}\`.`,
        ...(authorityBindings
          ? Object.entries(authorityBindings).map(
              ([field, value]) => `- \`${field}\`: \`${value}\`.`
            )
          : []),
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
        ...supersessionTexts.map(
          (text, index) =>
            `- STOP-E04-${String(index + 1).padStart(2, '0')}: Stop with \`superseded_readiness_authority_rejected\` unless this latest-hash readiness condition is satisfied: ${text}`
        ),
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

function buildLegacyPartitionSlotData({ source, profile, selection }) {
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

function selectedPartitionRegistries(selectedScope) {
  const taskIds = selectedScope.primaryAtomicTasks.map((task) => task.taskId);
  const acceptanceIds = selectedScope.completionPredicates.map(
    (predicate) => predicate.predicateId
  );
  const commandIds = selectedScope.commands.map((command) => command.commandId);
  const evidenceIds = selectedScope.evidenceContracts.map(
    (contract) => contract.evidenceContractId
  );
  const sourceObligations = selectedScope.primarySourceObligations.map((source) => {
    const goalTaskRefs = selectedScope.primaryAtomicTasks
      .filter((task) => task.sourceIds.includes(source.id))
      .map((task) => task.taskId);
    const acceptanceRefs = selectedScope.completionPredicates
      .filter((predicate) => predicate.sourceIds.includes(source.id))
      .map((predicate) => predicate.predicateId);
    return {
      ...source,
      goalTaskRefs: goalTaskRefs.length > 0 ? goalTaskRefs : taskIds,
      acceptanceRefs: acceptanceRefs.length > 0 ? acceptanceRefs : acceptanceIds,
      commandRefs: commandIds,
      evidenceRefs: evidenceIds,
    };
  });
  return {
    sourceObligations,
    tasks: taskIds,
    acceptance: acceptanceIds,
    commands: commandIds,
    evidence: evidenceIds,
  };
}

function assertSelectedPartitionScope(selectedScope) {
  const requiredArrays = [
    'primarySourceObligations',
    'primaryAtomicTasks',
    'completionPredicates',
    'evidenceContracts',
    'commands',
    'inheritedConstraints',
  ];
  const invalidFields = requiredArrays.filter((field) => !Array.isArray(selectedScope?.[field]));
  if (
    !selectedScope?.partition?.partitionId ||
    invalidFields.length > 0 ||
    selectedScope.primarySourceObligations.length === 0 ||
    selectedScope.primaryAtomicTasks.length === 0 ||
    selectedScope.completionPredicates.length === 0 ||
    selectedScope.evidenceContracts.length === 0 ||
    selectedScope.commands.length === 0
  ) {
    const error = new Error('partition_selection_invalid') as GoalContractBuilderError;
    error.failureClass = 'partition_selection_invalid';
    error.invalidFields = invalidFields;
    throw error;
  }
  const sourceIds = new Set(selectedScope.primarySourceObligations.map((item) => item.id));
  if (
    selectedScope.primaryAtomicTasks.some(
      (task) =>
        !task.taskId ||
        !Array.isArray(task.sourceIds) ||
        task.sourceIds.some((sourceId) => !sourceIds.has(sourceId))
    ) ||
    selectedScope.completionPredicates.some(
      (predicate) =>
        !predicate.predicateId ||
        !Array.isArray(predicate.sourceIds) ||
        predicate.sourceIds.some((sourceId) => !sourceIds.has(sourceId))
    ) ||
    selectedScope.commands.some((command) => !command.commandId)
  ) {
    const error = new Error('partition_selection_invalid') as GoalContractBuilderError;
    error.failureClass = 'partition_selection_invalid';
    throw error;
  }
}

function partitionFrontMatter({
  source,
  profile,
  selectedScope,
  receiptPaths,
  bindings,
  generatedAt,
}) {
  const partition = selectedScope.partition;
  const planBound = Boolean(bindings.partitionPlanHash);
  const primarySourceObligations = selectedScope.primarySourceObligations || [];
  const namespacedObligations =
    bindings.namespacedObligations ||
    selectedScope.namespacedObligations ||
    partition.namespacedObligations ||
    [];
  const uniqueStrings = (values) => [...new Set((values || []).filter(Boolean).map(String))].sort();
  const obligationRefs = uniqueStrings(
    bindings.obligationRefs || [
      ...(selectedScope.primarySourceObligations || []).map(({ id }) => id),
      ...namespacedObligations.map(({ declaredSourceId }) => declaredSourceId),
    ]
  );
  const namespaceRefs = uniqueStrings(
    bindings.namespaceRefs || namespacedObligations.map(({ namespace }) => namespace)
  );
  const sourceArtifactRefs = uniqueStrings(
    bindings.sourceArtifactRefs ||
      namespacedObligations.map(({ sourceArtifactId }) => sourceArtifactId)
  );
  const specSpanRefs = uniqueStrings([
    ...(bindings.specSpanRefs || []),
    ...primarySourceObligations.flatMap(({ specSpanRefs: refs }) => refs || []),
    ...namespacedObligations.flatMap(({ specSpanRefs: refs }) => refs || []),
  ]);
  const governedPaths = uniqueStrings(bindings.governedPaths || partition.ownedArtifactPaths || []);
  const finalAuthorityLines = planBound
    ? [
        `sourceCompositionPolicyHash: ${bindings.sourceCompositionPolicyHash}`,
        `partitionPlanHash: ${bindings.partitionPlanHash}`,
        `goalContractHash: ${bindings.goalContractHash}`,
        `orderedSourceSnapshotSetHash: ${bindings.orderedSourceSnapshotSetHash}`,
        `sourceAuthorityBundleHash: ${bindings.sourceAuthorityBundleHash}`,
        `subordinateCoverageReceiptHashes: ${JSON.stringify(
          bindings.subordinateCoverageReceiptHashes || []
        )}`,
        ...(bindings.displayOrdinal ? [`displayOrdinal: ${bindings.displayOrdinal}`] : []),
        `obligationRefs: ${JSON.stringify(obligationRefs)}`,
        `namespaceRefs: ${JSON.stringify(namespaceRefs)}`,
        `sourceArtifactRefs: ${JSON.stringify(sourceArtifactRefs)}`,
        `specSpanRefs: ${JSON.stringify(specSpanRefs)}`,
        `governedPaths: ${JSON.stringify(governedPaths)}`,
      ]
    : [
        `partitionManifestPath: ${repoPath(bindings.partitionManifestPath)}`,
        `partitionManifestHash: ${bindings.partitionManifestHash}`,
      ];
  const selectionAuthorityLines = planBound
    ? [
        ...(bindings.selectionReceiptPath
          ? [`selectionReceiptPath: ${repoPath(bindings.selectionReceiptPath)}`]
          : []),
        ...(bindings.selectionReceiptHash
          ? [`selectionReceiptHash: ${bindings.selectionReceiptHash}`]
          : []),
        ...(bindings.globalCoverageReceiptPath
          ? [`globalCoverageReceiptPath: ${repoPath(bindings.globalCoverageReceiptPath)}`]
          : []),
        ...(bindings.globalCoverageReceiptHash
          ? [`globalCoverageReceiptHash: ${bindings.globalCoverageReceiptHash}`]
          : []),
      ]
    : [
        `selectionReceiptPath: ${repoPath(bindings.selectionReceiptPath)}`,
        `selectionReceiptHash: ${bindings.selectionReceiptHash}`,
        `globalCoverageReceiptPath: ${repoPath(bindings.globalCoverageReceiptPath)}`,
        `globalCoverageReceiptHash: ${bindings.globalCoverageReceiptHash}`,
      ];
  return [
    '---',
    'goalContractVersion: goal-execution-contract/v1',
    `goalContractProfileVersion: ${profile.profileVersion}`,
    `goalContractProfileHash: ${profile.profileHash}`,
    'entryScenario: standalone_goal_contract',
    'finalArtifactAuthority: standalone_goal_execution_plan_markdown',
    'contractMode: frozen',
    'rewritePolicy: forbidden',
    'executionMode: execute_only',
    `sourcePlanPath: ${source.sourcePlanPath}`,
    `sourcePlanHash: ${source.sourcePlanHash}`,
    `sourceBytes: ${source.sourceBytes}`,
    `sourceLines: ${source.sourceLines}`,
    `masterSourcePath: ${source.sourcePlanPath}`,
    `masterSourceHash: ${source.sourcePlanHash}`,
    `sourceSnapshotHash: ${bindings.sourceSnapshotHash}`,
    `methodologyProfileHash: ${bindings.methodologyProfileHash}`,
    `methodologyProfileArtifactHash: ${bindings.methodologyProfileArtifactHash}`,
    `executionProjectionHash: ${bindings.executionProjectionHash}`,
    `taskDagHash: ${bindings.taskDagHash}`,
    `sequenceMode: ${bindings.sequenceMode}`,
    `sequenceApplicability: ${bindings.sequenceApplicability}`,
    `sequenceCoverage: ${bindings.sequenceCoverage}`,
    `sequenceClosureStatus: ${bindings.sequenceClosureStatus}`,
    `childContractAuthority: ${bindings.childContractAuthority}`,
    `partitionPolicyHash: ${bindings.partitionPolicyHash}`,
    `partitionPolicyArtifactHash: ${bindings.partitionPolicyArtifactHash}`,
    ...finalAuthorityLines,
    `partitionAnalysisReceiptHash: ${bindings.partitionAnalysisReceiptHash}`,
    `partitionSetHash: ${bindings.partitionSetHash}`,
    `partitionId: ${partition.partitionId}`,
    `partitionRole: ${partition.partitionRole}`,
    `selectionSetHash: ${partition.selectionSetHash || bindings.selectionSetHash}`,
    `dependencyPartitionIds: ${JSON.stringify(partition.dependencyPartitionIds || [])}`,
    ...selectionAuthorityLines,
    `coverageReceiptPath: ${repoPath(receiptPaths.coverageReceiptPath)}`,
    `generationReceiptPath: ${repoPath(receiptPaths.generationReceiptPath)}`,
    'unmappedSourceObligations: 0',
    `runtimeRecordId: GOAL-CONTRACT-PARTITION-${partition.partitionId}`,
    'entryFlow: goal_contract_partition_generate',
    `generatedAt: ${generatedAt}`,
    '---',
  ].join('\n');
}

function buildPartitionSlotData({
  source,
  profile,
  selection,
  selectedScope,
  receiptPaths,
  bindings,
  generatedAt = new Date().toISOString(),
}) {
  if (!selectedScope) {
    return buildLegacyPartitionSlotData({ source, profile, selection });
  }
  assertSelectedPartitionScope(selectedScope);
  const registries = selectedPartitionRegistries(selectedScope);
  const partition = selectedScope.partition;
  const taskRows = selectedScope.primaryAtomicTasks
    .map((task) =>
      [
        `### ${task.taskId} ${task.title || task.taskId}`,
        '',
        `- Source obligations: ${task.sourceIds.map((id) => `\`${id}\``).join(', ')}.`,
        `- Dependencies: ${
          (task.dependencyIds || []).map((id) => `\`${id}\``).join(', ') || 'none'
        }.`,
      ].join('\n')
    )
    .join('\n\n');
  const acceptanceRows = selectedScope.completionPredicates
    .map(
      (predicate) =>
        `- [ ] **${predicate.predicateId}:** ${
          predicate.statement || predicate.passCondition || predicate.predicateId
        }`
    )
    .join('\n');
  const traceRows = selectedScope.primaryAtomicTasks
    .map(
      (task) =>
        `| ${task.taskId} | ${(task.sourceIds || []).join(', ')} | ${
          (task.dependencyIds || []).join(', ') || 'none'
        } |`
    )
    .join('\n');
  const acceptanceTraceRows = selectedScope.completionPredicates
    .map(
      (predicate) =>
        `| ${predicate.predicateId} | ${(predicate.sourceIds || []).join(', ')} | ${(
          predicate.taskIds ||
          predicate.goalIds ||
          registries.tasks
        ).join(', ')} | ${(
          predicate.evidenceContractIds ||
          predicate.expectedEvidenceIds ||
          []
        ).join(', ')} |`
    )
    .join('\n');
  const sourceRows = registries.sourceObligations
    .map(
      (item) =>
        `| ${item.id} | ${(item.goalTaskRefs || []).join(', ')} | ${(
          item.acceptanceRefs || []
        ).join(', ')} | ${(item.commandRefs || []).join(', ')} | ${(item.evidenceRefs || []).join(
          ', '
        )} | ${(item.specSpanRefs || []).join(', ')} |`
    )
    .join('\n');
  const commandRows = selectedScope.commands
    .map(
      (command) =>
        `- \`${command.commandId}\`: \`${String(
          command.literal || command.command || command.commandId
        ).replace(/`/gu, '\\`')}\``
    )
    .join('\n');
  const evidenceRows = selectedScope.evidenceContracts
    .map(
      (contract) =>
        `- \`${contract.evidenceContractId}\`: producers=${(contract.producerTaskIds || []).join(
          ', '
        )}; freshness=${contract.freshnessRule || 'current'}.`
    )
    .join('\n');
  const inheritedRows =
    selectedScope.inheritedConstraints.length === 0
      ? '- None.'
      : selectedScope.inheritedConstraints
          .map(
            (constraint) =>
              `- \`${constraint.constraintId}\`: non-executable inherited constraint from the validated Execution Projection.`
          )
          .join('\n');
  const completionEvidencePacket = bindings.partitionPlanHash
    ? [
        `- \`partitionPlanHash\`: \`${bindings.partitionPlanHash}\`.`,
        `- \`sourceCompositionPolicyHash\`: \`${bindings.sourceCompositionPolicyHash}\`.`,
        `- \`sourceAuthorityBundleHash\`: \`${bindings.sourceAuthorityBundleHash}\`.`,
        `- \`partitionSetHash\`: \`${bindings.partitionSetHash}\`.`,
        `- \`selectionSetHash\`: \`${partition.selectionSetHash || bindings.selectionSetHash}\`.`,
        `- \`coverageReceiptPath\`: \`${repoPath(receiptPaths.coverageReceiptPath)}\`.`,
        `- \`generationReceiptPath\`: \`${repoPath(receiptPaths.generationReceiptPath)}\`.`,
      ]
    : [
        `- \`partitionManifestPath\`: \`${repoPath(bindings.partitionManifestPath)}\`.`,
        `- \`partitionManifestHash\`: \`${bindings.partitionManifestHash}\`.`,
        `- \`selectionReceiptPath\`: \`${repoPath(bindings.selectionReceiptPath)}\`.`,
        `- \`selectionReceiptHash\`: \`${bindings.selectionReceiptHash}\`.`,
        `- \`globalCoverageReceiptPath\`: \`${repoPath(bindings.globalCoverageReceiptPath)}\`.`,
        `- \`globalCoverageReceiptHash\`: \`${bindings.globalCoverageReceiptHash}\`.`,
        `- \`coverageReceiptPath\`: \`${repoPath(receiptPaths.coverageReceiptPath)}\`.`,
        `- \`generationReceiptPath\`: \`${repoPath(receiptPaths.generationReceiptPath)}\`.`,
      ];
  return {
    slotData: {
      frontMatter: partitionFrontMatter({
        source,
        profile,
        selectedScope,
        receiptPaths,
        bindings,
        generatedAt,
      }),
      goalEntry: `\`\`\`text\n/goal ${repoPath(receiptPaths.outPath)}\n\`\`\``,
      authorityModel: [
        `- \`${repoPath(receiptPaths.outPath)}\` is the frozen authority for partition \`${partition.partitionId}\`.`,
        ...(bindings.partitionPlanHash
          ? [
              `- The active partition plan hash is \`${bindings.partitionPlanHash}\`; the final manifest is resolved only through package-owned finalization.`,
            ]
          : [
              `- The active partition manifest is \`${repoPath(bindings.partitionManifestPath)}\`.`,
            ]),
        '- Only selected primary records are executable in this child contract.',
        '- Inherited constraints are preserved as non-executable authority.',
        '- The standalone Markdown contract is the frozen execution authority.',
        '- `model_packet.json is the machine-readable execution authority` only for the two four-artifact compilation entries.',
        '- `goal_execution.md is not execution authority`; this generated contract is the frozen execution source for this partition.',
        '- `/goal completion is not closeout proof`; completion requires current command and receipt evidence.',
      ].join('\n'),
      rootCause:
        'The master goal must be closed through one manifest-bound child scope without importing excluded work.',
      domainAddenda: [
        '### Partition selection contract',
        '',
        `- Partition: \`${partition.partitionId}\` (${partition.partitionRole}).`,
        `- Dependencies: ${
          (partition.dependencyPartitionIds || []).map((id) => `\`${id}\``).join(', ') || 'none'
        }.`,
        '',
        '### Inherited partition constraints',
        '',
        inheritedRows,
      ].join('\n'),
      traceSliceTrackingMatrix: [
        '| Task ID | Source IDs | Dependencies |',
        '| --- | --- | --- |',
        traceRows,
      ].join('\n'),
      implementationTasks: taskRows,
      strictAcceptanceChecklist: acceptanceRows,
      acceptanceTraceabilityMatrix: [
        '| Acceptance ID | Source IDs | Tasks | Evidence |',
        '| --- | --- | --- | --- |',
        acceptanceTraceRows,
      ].join('\n'),
      sourceCoverageMatrix: [
        '| Source ID | Tasks | Acceptance | Commands | Evidence | SpecSpan Refs |',
        '| --- | --- | --- | --- | --- | --- |',
        sourceRows,
      ].join('\n'),
      requiredTestCommands: commandRows,
      manualVerificationScenarios: `- Verify partition \`${partition.partitionId}\` against its current selection and global coverage receipts.`,
      completionEvidencePacket: completionEvidencePacket.join('\n'),
      expectedEvidenceFreeze: evidenceRows,
      stopConditions: [
        '- Stop if the active manifest differs from the current canonical compilation.',
        '- Stop if global coverage or selection receipt bytes are stale, missing, or non-canonical.',
        '- Stop if any excluded record appears as a local executable item.',
      ].join('\n'),
    },
    registries,
    coverageAudit: {
      decision: 'pass',
      unmappedSourceObligations: [],
    },
    implementationProofAudit: {
      decision: 'pass',
      selectedAtomicTaskCount: registries.tasks.length,
      selectedCommandCount: registries.commands.length,
      blockingReasons: [],
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
