const path = require('node:path');
const { buildSourceCoverageMatrix, validateSourceCoverage } = require('./source-coverage-matrix');

function repoPath(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function makeRegistries(obligations) {
  const sourceObligations = obligations.map((obligation, index) => {
    const number = String(index + 1).padStart(3, '0');
    return {
      ...obligation,
      goalTaskRefs: [`G${number}`],
      acceptanceRefs: [`ACC${number}`],
      commandRefs: [`CMD${number}`],
      evidenceRefs: [`EVD${number}`],
    };
  });
  return {
    sourceObligations,
    tasks: sourceObligations.map((obligation) => obligation.goalTaskRefs[0]),
    acceptance: sourceObligations.map((obligation) => obligation.acceptanceRefs[0]),
    commands: sourceObligations.map((obligation) => obligation.commandRefs[0]),
    evidence: sourceObligations.map((obligation) => obligation.evidenceRefs[0]),
  };
}

function frontMatter(metadata) {
  return [
    '---',
    'goalContractVersion: goal-execution-contract/v1',
    `goalContractProfileVersion: ${metadata.profile.profileVersion}`,
    `goalContractProfileHash: ${metadata.profile.profileHash}`,
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
        `- Implement the behavior described by ${obligation.id}: ${obligation.summary}.`,
        `- Keep generated semantic rows linked to ${obligation.id}.`,
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
    .map((obligation) => `- [ ] ${obligation.acceptanceRefs[0]}: ${obligation.id} MUST map to ${obligation.goalTaskRefs[0]}, ${obligation.commandRefs[0]}, and ${obligation.evidenceRefs[0]}. Evidence MUST come from ${obligation.commandRefs[0]}.`)
    .join('\n');
}

function buildTrace(sourceObligations) {
  return [
    '| Acceptance ID | Task IDs | Evidence command or artifact | Pass condition |',
    '| --- | --- | --- | --- |',
    ...sourceObligations.map((obligation) => `| ${obligation.acceptanceRefs[0]} | ${obligation.goalTaskRefs[0]} | ${obligation.commandRefs[0]}; ${obligation.evidenceRefs[0]} | ${obligation.id} has task, acceptance, command, and evidence mappings. |`),
  ].join('\n');
}

function buildCommands(sourceObligations, coverageReceiptPath) {
  return sourceObligations
    .map((obligation, index) => [
      `### ${index + 1}. COMMAND ${obligation.commandRefs[0]}`,
      '',
      '```powershell',
      `pwsh.exe -NoLogo -NoProfile -Command "& { rg -n -F '${obligation.id}' -- '${repoPath(coverageReceiptPath)}' }"`,
      '```',
      '',
      `Expected pass condition: Command exits \`0\` and the coverage receipt contains ${obligation.id}.`,
    ].join('\n'))
    .join('\n\n');
}

function buildSlotData({ source, profile, outPath, coverageReceiptPath, generationReceiptPath, generatedAt = new Date().toISOString() }) {
  const registries = makeRegistries(source.sourceObligations);
  const coverageAudit = validateSourceCoverage({
    sourceObligations: registries.sourceObligations,
    registries,
  });
  if (coverageAudit.decision !== 'pass') {
    const error = new Error('source_coverage_unmapped');
    error.code = 'source_coverage_unmapped';
    error.coverageAudit = coverageAudit;
    throw error;
  }
  const lastTaskId = registries.tasks.at(-1);
  const lastAcceptanceId = registries.acceptance.at(-1);
  const slotData = {
    frontMatter: frontMatter({
      profile,
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
      '- `model_packet.json is the machine-readable execution authority` only when a req-trace model packet exists for the same implementation run.',
      '- `goal_execution.md is not execution authority`; this generated contract is the frozen execution source for this goal.',
      '- `/goal completion is not closeout proof`; completion requires command evidence and receipt evidence.',
    ].join('\n'),
    rootCause: [
      'The source plan requires source-plan-faithful goal execution generation with deterministic coverage proof.',
      'The generator must fail closed when any source obligation lacks generated task, acceptance, command, or evidence mapping.',
    ].join('\n\n'),
    domainAddenda: [
      '### Source coverage contract',
      '',
      '- Every `SRC` row MUST map to at least one `G`, one `ACC`, one `CMD`, and one `EVD` row.',
      '- Coverage receipt rows MUST match the Markdown `Source Coverage Matrix` rows.',
      '- `unmappedSourceObligations` MUST equal `0`.',
    ].join('\n'),
    implementationTasks: buildImplementationTasks(registries.sourceObligations),
    strictAcceptanceChecklist: buildAcceptance(registries.sourceObligations),
    acceptanceTraceabilityMatrix: buildTrace(registries.sourceObligations),
    sourceCoverageMatrix: buildSourceCoverageMatrix({ sourceObligations: registries.sourceObligations }),
    requiredTestCommands: buildCommands(registries.sourceObligations, coverageReceiptPath),
    manualVerificationScenarios: '- MV001: Inspect the coverage receipt and confirm `decision` is `pass` and `unmappedSourceObligations` is empty.',
    completionEvidencePacket: [
      `- \`sourcePlanPath\`: \`${source.sourcePlanPath}\`.`,
      `- \`sourcePlanHash\`: \`${source.sourcePlanHash}\`.`,
      `- \`coverageReceiptPath\`: \`${repoPath(coverageReceiptPath)}\`.`,
      `- \`generationReceiptPath\`: \`${repoPath(generationReceiptPath)}\`.`,
      '- `residualRisks`: `none` only when all required commands pass.',
    ].join('\n'),
    stopConditions: [
      '- STOP001: If source hash differs from the front matter source hash, stop with `contract_amendment_required:source_plan_hash_mismatch`.',
      '- STOP002: If any source obligation is unmapped, stop with `source_coverage_unmapped`.',
      '- STOP003: If coverage receipt is missing, stop with `coverage_receipt_missing`.',
    ].join('\n'),
  };
  return { slotData, registries, coverageAudit };
}

module.exports = {
  buildSlotData,
  makeRegistries,
};
