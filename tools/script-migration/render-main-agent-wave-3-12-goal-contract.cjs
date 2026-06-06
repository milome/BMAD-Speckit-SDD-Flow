#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderGoalContract } = require('../../_bmad/shared/goal-contract/scripts/render-goal-contract');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.12';
const SOURCE_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md';
const AUDIT_PATH =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/full-physical-script-closure-audit.json';
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const TARGET_PATH =
  'docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md';
const DRAFT_PATH =
  'docs/plans/.2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md.draft';
const SLOT_DATA_PATH =
  'docs/plans/.2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.slot-data.json';

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function sha256(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function bullet(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function fenced(text, lang = 'text') {
  return `\`\`\`${lang}\n${text}\n\`\`\``;
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function pathsFor(records, category) {
  return records
    .filter((record) => record.recommendation.category === category)
    .map((record) => record.originalPath)
    .sort((a, b) => a.localeCompare(b));
}

function groupedList(label, items) {
  return [`${label} (${items.length})`, ...items.map((item) => `  - ${item}`)].join('\n');
}

function taskBlock(id, title, purpose, files, steps, validation, acceptance) {
  return [
    `### ${id} ${title}`,
    '',
    `Purpose: ${purpose}`,
    '',
    'Files:',
    bullet(files.map((file) => `PATH ${file}`)),
    '',
    'Steps:',
    bullet(steps.map((step, index) => `STEP ${id}.${String(index + 1).padStart(2, '0')} ${step}`)),
    '',
    'Validation:',
    bullet(validation.map((item) => `COMMAND ${item}`)),
    '',
    'Acceptance:',
    bullet(acceptance.map((item) => `ACCEPTANCE ${item}`)),
  ].join('\n');
}

function commandBlock(id, command, cwd, pass, acceptance) {
  return [`#### ${id}`, '', `- COMMAND: ${command}`, `- CWD: ${cwd}`, `- PASS: ${pass}`, `- ACCEPTANCE: ${acceptance}`].join('\n');
}

function ledgerSchemaCheckCommand(queueHash) {
  return `node -e "const fs=require('node:fs'); const p='repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); const required=['callerSwitchPlan','runnerApi','cliProbeCommand','buildCopyPlan','testPaths','workspacePackage','targetExistenceProof','rootScriptDependencyForbidden']; const errors=[]; const obj=v=>v&&typeof v==='object'&&!Array.isArray(v); const arr=v=>Array.isArray(v); const nonEmpty=v=>typeof v==='string'&&v.length>0; if(!j||!Array.isArray(j.entries)) errors.push('entries_missing'); else if(j.entries.length!==102) errors.push('entry_count:'+j.entries.length); if(j.queueHash!=='${queueHash}') errors.push('queue_hash:'+j.queueHash); for(const e of j.entries||[]){ const id=e.originalPath||'<unknown>'; for(const k of required){ if(!(k in e)) errors.push(id+':missing:'+k); } if(!Array.isArray(e.targetPaths)||e.targetPaths.length===0) errors.push(id+':targetPaths_empty'); if(!arr(e.callerSwitchPlan)) errors.push(id+':callerSwitchPlan_not_array'); else { if(e.callerSwitchPlan.length===0&&!(e.callerSwitchStatus==='not_applicable'&&nonEmpty(e.callerSwitchNotApplicableReason))) errors.push(id+':callerSwitchPlan_empty_without_reason'); for(const [i,plan] of e.callerSwitchPlan.entries()){ if(!obj(plan)||!nonEmpty(plan.targetPath)||!nonEmpty(plan.action)||!nonEmpty(plan.status)||!arr(plan.proofCommandIds)) errors.push(id+':callerSwitchPlan_shape:'+i); }} if(!obj(e.runnerApi)||!nonEmpty(e.runnerApi.moduleFormat)||!nonEmpty(e.runnerApi.exportName)||!nonEmpty(e.runnerApi.cwdPolicy)||!nonEmpty(e.runnerApi.argumentPolicy)||!nonEmpty(e.runnerApi.stdoutPolicy)||!nonEmpty(e.runnerApi.stderrPolicy)||!nonEmpty(e.runnerApi.exitCodePolicy)) errors.push(id+':runnerApi_shape'); if(e.cliProbeCommand!==null&&e.cliProbeCommand!==undefined&&(!obj(e.cliProbeCommand)||!nonEmpty(e.cliProbeCommand.command)||!nonEmpty(e.cliProbeCommand.cwd)||!('expectedExitCode' in e.cliProbeCommand)||!('provesCommandAvailability' in e.cliProbeCommand))) errors.push(id+':cliProbeCommand_shape'); if(!arr(e.buildCopyPlan)) errors.push(id+':buildCopyPlan_not_array'); else { if(e.buildCopyPlan.length===0&&!nonEmpty(e.buildCopyNotApplicableReason)) errors.push(id+':buildCopyPlan_empty_without_reason'); for(const [i,plan] of e.buildCopyPlan.entries()){ if(!obj(plan)||!nonEmpty(plan.sourcePath)||!nonEmpty(plan.targetPath)||!nonEmpty(plan.copyCommandId)) errors.push(id+':buildCopyPlan_shape:'+i); }} if(!arr(e.testPaths)) errors.push(id+':testPaths_not_array'); else if(e.testPaths.length===0&&!nonEmpty(e.testNotApplicableReason)) errors.push(id+':testPaths_empty_without_reason'); if(!obj(e.workspacePackage)||!nonEmpty(e.workspacePackage.name)||!nonEmpty(e.workspacePackage.path)||!nonEmpty(e.workspacePackage.packageJsonPath)||!nonEmpty(e.workspacePackage.buildCommandId)||!(nonEmpty(e.workspacePackage.testCommandId)||nonEmpty(e.workspacePackage.testNotApplicableReason))) errors.push(id+':workspacePackage_shape'); if(!obj(e.targetExistenceProof)||!arr(e.targetExistenceProof.sourcePaths)||e.targetExistenceProof.sourcePaths.length===0||!arr(e.targetExistenceProof.distPaths)||!arr(e.targetExistenceProof.proofCommandIds)) errors.push(id+':targetExistenceProof_shape'); if(!obj(e.rootScriptDependencyForbidden)||!nonEmpty(e.rootScriptDependencyForbidden.originalPath)||!arr(e.rootScriptDependencyForbidden.scanScopes)||!arr(e.rootScriptDependencyForbidden.forbiddenDependencyForms)||!arr(e.rootScriptDependencyForbidden.proofCommandIds)) errors.push(id+':rootScriptDependencyForbidden_shape'); } if(errors.length){console.error(JSON.stringify({errors},null,2)); process.exit(1);} console.log(JSON.stringify({entries:j.entries.length,queueHash:j.queueHash,requiredFields:required.length,shape:'passed'}))"`;
}

function contractTestCommand(phase, extraTestPaths = []) {
  const tests = ['tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts', ...extraTestPaths].join(' ');
  return `node -e "process.env.BMAD_WAVE_3_12_CONTRACT_TEST_PHASE='${phase}'; require('node:child_process').execSync('npx vitest run ${tests}',{stdio:'inherit'})"`;
}

function packageCommand(kind, packagePath, targetPrefix, command) {
  return `node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind ${kind} --package ${packagePath} --target-prefix ${targetPrefix} --command "${command}"`;
}

function main() {
  const summaryText = readText(SOURCE_PATH);
  const audit = readJson(AUDIT_PATH);
  const templateText = readText('_bmad/shared/goal-contract/goal-execution-contract-template.md');
  const profile = readJson('_bmad/shared/goal-contract/goal-contract-profile.json');
  const sourceHash = sha256(summaryText);

  const queueRecords = audit.entries
    .filter((record) => audit.consumerReachableMigrationQueue.includes(record.originalPath))
    .sort((a, b) => a.originalPath.localeCompare(b.originalPath));
  const queuePaths = queueRecords.map((record) => record.originalPath);
  const queueHash = sha256(queuePaths.join('\n'));

  const consumerRuntime = pathsFor(queueRecords, 'consumer_runtime_reachable');
  const packageHelpers = pathsFor(queueRecords, 'package_runtime_helper');
  const publicCli = pathsFor(queueRecords, 'public_cli');

  const settledRows = audit.proposedWave.entries
    .filter((entry) => entry.validationStatus === 'passed')
    .sort((a, b) => a.originalPath.localeCompare(b.originalPath))
    .map((entry) => [
      entry.originalPath,
      entry.originalClassBeforeMigration,
      entry.migrationStrategy,
      entry.validationStatus,
    ]);

  const frontMatter = [
    '---',
    'goalContractVersion: goal-execution-contract/v1',
    `goalContractProfileVersion: ${profile.profileVersion}`,
    `goalContractProfileHash: ${profile.profileHash}`,
    'contractMode: frozen',
    'rewritePolicy: forbidden',
    'executionMode: execute_only',
    `sourcePlanPath: ${SOURCE_PATH}`,
    `sourcePlanHash: ${sourceHash}`,
    `runtimeRecordId: ${WAVE_ID}`,
    'entryFlow: full_physical_script_closure_migration_wave_3_12',
    'taskRange: G001-G012',
    'acceptanceRange: ACC001-ACC014',
    'completionGate: all_acceptance_items_and_required_commands_pass',
    'repairPolicy: execute_declared_tasks_only_and_stop_on_scope_semantic_or_validation_gap',
    'stopPolicy: stop_on_contract_gap_scope_expansion_root_script_deletion_consumer_root_ts_dependency_tsx_ts_node_dependency_compiled_fallback_claim_registry_gap_or_unresolved_script_semantics',
    'generatedBy: goal-execution-contract-generator',
    'generatedAt: 2026-06-06T12:55:00+08:00',
    '---',
  ].join('\n');

  const goalEntry = fenced(`/goal ${TARGET_PATH}`);

  const authorityModel = [
    `- \`${SOURCE_PATH}\` is the human summary source for this Wave 3.12 execution contract.`,
    `- \`sourcePlanHash=${sourceHash}\` binds this contract to the source summary content that declared 240 physical scripts, 129 new registrations, 102 planned pending migration records, and 27 validated non-migration records.`,
    `- \`${AUDIT_PATH}\` is the machine-readable audit input for the 102-item migration queue, category counts, target paths, and validated non-migration records.`,
    `- \`${REGISTRY_PATH}\` is the machine-readable migration registry authority for original paths, migration strategies, target paths, caller switch status, validation status, evidence refs, deletion approval fields, and the Wave 3.12 \`contractPath\` after G010 finalization.`,
    '- The registry Wave 3.12 `contractPath` currently identifies the full physical closure audit contract; this document is the runtime migration execution contract, and G010 MUST set Wave 3.12 `contractPath` to `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md` before final completion.',
    '- The previous audit contract path `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md` MUST remain recorded in `evidence.json.auditContractPath` and the Wave 3.12 summary after G010 and G011.',
    `- \`repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json\` is the per-script execution ledger artifact that G001 MUST produce before migration edits.`,
    `- \`repo-governance/script-migrations/${WAVE_ID}/evidence.json\` is the command evidence artifact that G009 MUST create after build and install validation commands run and that G010 MUST append with registry-finalization evidence.`,
    `- \`repo-governance/script-migrations/${WAVE_ID}/summary.md\` is the human projection that G011 MUST update after registry and evidence updates.`,
    `- \`repo-governance/script-migrations/${WAVE_ID}/safe-write-receipts.json\` is the large-document and governance-artifact write receipt authority for \`${REGISTRY_PATH}\`, \`repo-governance/script-migrations/${WAVE_ID}/summary.md\`, and any large Markdown/YAML/JSON artifact promoted during this wave.`,
    '- `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs`, `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts`, `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs`, `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs`, and `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` are controlled validation and writer surfaces that G002 MUST create before any G003-G012 task invokes them.',
    '- `packages/bmad-speckit/src/main-agent/actions/**` is the package source authority for records whose migration strategy is `package_runtime_module`.',
    '- `packages/bmad-speckit/src/main-agent/helpers/**` is the package source authority for records whose migration strategy is `durable_helper_copy` and whose target path is under `packages/bmad-speckit/src/main-agent/helpers/`.',
    '- `packages/bmad-speckit/src/commands/**` and `packages/bmad-speckit/bin/bmad-speckit.js` are the package source authority for records whose migration strategy is `public_cli_de_surface`.',
    '- A package target path outside `packages/bmad-speckit/**` is package source authority only for ledger rows whose `targetPaths` field names that path.',
    '- `packages/bmad-speckit/dist/**` and workspace `dist/**` directories are consumer runtime outputs after build commands run.',
    '- model_packet.json is the machine-readable execution authority only when a generated Main Agent execution packet exists for this contract.',
    '- goal_execution.md is not execution authority; this Markdown document is the frozen `/goal` contract and must not be rewritten by `/goal` during execution.',
    '- `/goal completion is not closeout proof`; closeout proof requires ledger rows for 102 queue entries, registry updates, evidence artifacts, package/runtime tests, install-surface proof, final encoding gate, and no root-script deletion evidence.',
  ].join('\n');

  const rootCause = [
    'Wave 3.12 closed the registry visibility gap for the physical `scripts/` universe. The audit established that `rg --files scripts` contains 240 files, that 129 physical scripts were previously unregistered, and that registry coverage is now 240 registered scripts with 0 unregistered scripts. The same audit did not complete runtime migration for the 102 records whose status remains `planned/pending`.',
    '',
    'The remaining defect is the package-consumer execution gap for the 102 queue entries. Those entries are classified as `consumer_runtime_reachable`, `package_runtime_helper`, or `public_cli`, and each entry needs package source authority, consumer runtime output, caller-switch proof, registry validation, and evidence that the installed package does not dispatch to any original root `scripts/**` queue path. TypeScript root scripts, `tsx`, and `ts-node` are separate hazards that require explicit false evidence.',
    '',
    'The 27 `validated/passed` records are frozen as non-queue records for this contract. The 9 Ralph entries are package runtime helper aliases, `scripts/bmad-speckit-cli.js` is a root package bin compatibility alias, the 4 i18n entries are source generation and bilingual Skill maintenance tooling, and 13 records are evidence-backed repo internal, fixture, documentation, or test harness records. This contract MUST NOT reinterpret those 27 records as completed runtime migrations.',
  ].join('\n');

  const domainAddenda = [
    '### D001 physical script universe addendum',
    '',
    '- `rg --files scripts` MUST return exactly 240 paths before completion is claimed.',
    `- \`${AUDIT_PATH}\` MUST report \`physicalScriptsTotal\` equal to \`240\`.`,
    `- \`${AUDIT_PATH}\` MUST report \`currentRegistryCoverage.unregistered\` equal to \`0\`.`,
    `- The Wave 3.12 queue hash MUST equal \`${queueHash}\` for the 102 original paths unless this contract is amended.`,
    '',
    '### D002 queue classification addendum',
    '',
    '- The execution queue MUST contain exactly 102 entries before migration edits begin.',
    '- The execution queue MUST contain exactly 28 entries with `originalClassBeforeMigration=consumer_runtime_reachable`.',
    '- The execution queue MUST contain exactly 65 entries with `originalClassBeforeMigration=package_runtime_helper`.',
    '- The execution queue MUST contain exactly 9 entries with `originalClassBeforeMigration=public_cli`.',
    '- Every queue entry MUST have `migrationStatus=planned` and `validationStatus=pending` before the task that migrates the entry starts.',
    '- Every queue entry MUST have `deletionAllowed=false` before and after migration.',
    '- Every queue entry MUST retain the original root script path unless a separate user-approved deletion contract is supplied.',
    '- Every ledger entry MUST include `callerSwitchPlan`, `runnerApi`, `cliProbeCommand`, `buildCopyPlan`, `testPaths`, `workspacePackage`, `targetExistenceProof`, and `rootScriptDependencyForbidden` before G003 starts.',
    '- `callerSwitchPlan` MUST be an array. Each item MUST include non-empty `targetPath`, `action`, `status`, and `proofCommandIds` fields. Empty arrays are allowed only when `callerSwitchStatus=not_applicable` and `callerSwitchNotApplicableReason` is non-empty.',
    '- `runnerApi` MUST be an object with non-empty `moduleFormat`, `exportName`, `cwdPolicy`, `argumentPolicy`, `stdoutPolicy`, `stderrPolicy`, and `exitCodePolicy` fields.',
    '- `cliProbeCommand` MUST be `null` only for entries with no public or installed command probe. Non-null values MUST include `command`, `cwd`, `expectedExitCode`, and `provesCommandAvailability`.',
    '- `buildCopyPlan` MUST be an array. Each item MUST include non-empty `sourcePath`, `targetPath`, and `copyCommandId` fields. Empty arrays are allowed only when the target workspace package has no build copy step and `buildCopyNotApplicableReason` is non-empty.',
    '- `testPaths` MUST be a non-empty array unless `testNotApplicableReason` is non-empty and cites the package.json script inspection that proves no package-local test exists.',
    '- `workspacePackage` MUST include non-empty `name`, `path`, `packageJsonPath`, `buildCommandId`, and `testCommandId` or `testNotApplicableReason`.',
    '- `targetExistenceProof` MUST include `sourcePaths`, `distPaths`, and `proofCommandIds` arrays. Each migrated entry MUST have at least one source path; dist paths are required when that entry is part of consumer runtime or package dist output.',
    '- `rootScriptDependencyForbidden` MUST include `originalPath`, `scanScopes`, `forbiddenDependencyForms`, and `proofCommandIds` arrays.',
    '- A ledger entry without enough source or registry evidence to fill those fields MUST stop with `blocked_by_contract_ambiguity:ledger_original_path` before migration edits for that entry.',
    '',
    'Queue groups:',
    '',
    fenced(
      [
        groupedList('consumer_runtime_reachable', consumerRuntime),
        groupedList('package_runtime_helper', packageHelpers),
        groupedList('public_cli', publicCli),
      ].join('\n')
    ),
    '',
    '### D003 target surface addendum',
    '',
    '- A `package_runtime_module` queue entry MUST produce package source under `packages/bmad-speckit/src/main-agent/actions/**` or another exact target path declared by the registry ledger.',
    '- A `durable_helper_copy` queue entry MUST produce package source under the exact `targetPaths` declared by the registry ledger.',
    '- A `public_cli_de_surface` queue entry MUST update `packages/bmad-speckit/bin/bmad-speckit.js` and MUST produce the exact command source path declared by the registry ledger.',
    '- A target path outside `packages/bmad-speckit/**` MUST be validated by the workspace package build or test command listed in G008.',
    '- No target path may be moved outside the ledger-declared package or workspace target without `scope_amendment_required:ledger_original_path`.',
    '- Allowed write paths are the union of each ledger entry `targetPaths`, `callerSwitchPlan[].targetPath`, `buildCopyPlan[].targetPath`, `testPaths`, this wave directory, `repo-governance/script-migration-registry.yaml`, `package.json`, `packages/bmad-speckit/package.json`, `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs`, `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs`, `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs`, `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`, and `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts`.',
    '- A broad `packages/**` write grant does not exist in this contract.',
    '- Large Markdown, YAML, CSV, TOML, README, AGENTS, registry, summary, or generated governance rewrites MUST be promoted through `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`; small localized `apply_patch` edits are allowed only when the target remains present after every step and the edit is not a large rewrite.',
    '- This D003 large-document rule is the controlling refinement of the template-level manual-edit rule for registry, summary, and generated governance artifacts.',
    '- Safe-write promotion MUST create a timestamped backup when replacing an existing file, write a same-directory draft or temp file with UTF-8, validate required text or keys, record byte length and SHA256, promote atomically, read back the target, and append a passed receipt to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json`.',
    '',
    '### D004 registry state addendum',
    '',
    '- Every migrated queue entry MUST end with `migrationStatus=validated`.',
    '- Every migrated queue entry MUST end with `validationStatus=passed`.',
    `- Every migrated queue entry MUST include \`repo-governance/script-migrations/${WAVE_ID}/evidence.json\` in \`evidenceRefs\`.`,
    '- Every migrated queue entry MUST keep `deletionAllowed=false`.',
    '- `callerSwitchStatus` MUST be `switched`, `compatibility_alias_retained`, or `not_applicable` only when direct evidence in `evidence.json` proves that state for the entry.',
    '',
    '### D005 consumer runtime boundary addendum',
    '',
    '- Forbidden root script dependency means importing, requiring, spawning, shelling out to, or otherwise dispatching any original root `scripts/**` queue path from package source, package dist, package bin, installed CLI probes, or installed helper probes.',
    '- Package runtime and CLI dispatch for migrated entries MUST NOT import, require, spawn, shell out to, or otherwise dispatch any original root `scripts/**` queue path from `packages/bmad-speckit/src/**`, `packages/bmad-speckit/dist/**`, `packages/bmad-speckit/bin/**`, or installed package probes.',
    '- Package runtime and CLI dispatch for migrated entries MUST NOT import root `scripts/*.ts`; this TypeScript-specific rule is a subset of the forbidden root script dependency rule.',
    '- Package runtime and CLI dispatch for migrated entries MUST NOT require `tsx` in consumer runtime.',
    '- Package runtime and CLI dispatch for migrated entries MUST NOT require `ts-node` in consumer runtime.',
    '- Package runtime and CLI dispatch for migrated entries MUST NOT use compiled fallback as completion proof for covered behavior.',
    '- The install matrix MUST prove package execution from an installed package context without a source repository checkout assumption.',
    '',
    '### D006 settled non-queue boundary addendum',
    '',
    '- The 27 validated non-migration records MUST remain outside the 102 migration queue unless this contract is amended.',
    '- The 4 records with `repo_source_generation_i18n_bilingual_tooling` MUST remain classified as source-generation and bilingual Skill maintenance tooling, not consumer runtime bilingual support.',
    '- Runtime bilingual support MUST remain covered by the i18n package runtime helper queue and install-surface/runtime-emit closure records.',
    '- The 13 evidence-backed repo internal, fixture, documentation, and test harness records MUST NOT be described as consumer runtime migrated entries.',
    '',
    'Validated non-queue records:',
    '',
    table(['Original path', 'Class', 'Strategy', 'Validation'], settledRows),
    '',
    '### D007 execution evidence order addendum',
    '',
    '- Command IDs are stable evidence labels and MUST NOT be treated as numeric execution order.',
    '- The executor MUST run command evidence in this dependency order: physical and registry baseline, ledger schema, bootstrap validation, implementation phase validators, ledger-aware package build and test commands, target-existence validation, caller-switch source/bin validation, install matrix, evidence validation, registry finalization, summary update and audit, final validator, final contract test, root-retention checks, and encoding gate.',
    '- Any command whose PASS condition permits `not_applicable` MUST be implemented as a ledger-aware wrapper command that exits 0 only after writing or printing the exact ledger query and package.json script evidence that proves the command is not applicable.',
    '- The Wave 3.12 acceptance test MUST support `BMAD_WAVE_3_12_CONTRACT_TEST_PHASE=bootstrap` and `BMAD_WAVE_3_12_CONTRACT_TEST_PHASE=final`. Bootstrap mode MUST NOT require evidence.json, install-matrix.json, or finalized registry rows. Final mode MUST require evidence.json, install-matrix.json when G008 applies, safe-write receipts, and finalized registry rows.',
  ].join('\n');

  const tasks = [
    taskBlock(
      'G001',
      'Build the 102-entry migration ledger',
      'Freeze the exact queue entries, categories, target paths, owner class, and evidence obligations before implementation starts.',
      [AUDIT_PATH, REGISTRY_PATH, `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`, `repo-governance/script-migrations/${WAVE_ID}/summary.md`],
      [
        'Read `consumerReachableMigrationQueue` from the Wave 3.12 audit JSON and verify it contains exactly 102 paths.',
        'For each queue path, read the matching Wave 3.12 registry entry and copy `originalPath`, `entryId`, `originalClassBeforeMigration`, `migrationStrategy`, `targetPaths`, `publicCommandsBeforeMigration`, `publicCommandsAfterMigration`, `callerSwitchStatus`, `migrationStatus`, `validationStatus`, `deletionAllowed`, and `evidenceRefs` into `migration-ledger.json`.',
        'For each queue path, derive `callerSwitchPlan`, `runnerApi`, `cliProbeCommand`, `buildCopyPlan`, `testPaths`, `workspacePackage`, `targetExistenceProof`, and `rootScriptDependencyForbidden` from the registry entry, source script, package target path, and existing package command surfaces.',
        'Stop with `blocked_by_contract_ambiguity:ledger_original_path` when any required ledger field cannot be derived without inventing behavior.',
        'Write `migration-ledger.json` with top-level fields `schemaVersion`, `waveId`, `sourcePlanPath`, `sourcePlanHash`, `queueHash`, `counts`, `entries`, `generatedAt`, and `queueOrderProof`.',
        `Set \`queueHash\` to \`${queueHash}\` for the newline-joined original paths from the source summary order.`,
        'Set each ledger entry `implementationState` to `pending` before any migration edits for that entry.',
      ],
      [
        'node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty',
        'node tools/script-migration/validate-registry.cjs',
        ledgerSchemaCheckCommand(queueHash),
      ],
      ['ACC001', 'ACC002', 'ACC003']
    ),
    taskBlock(
      'G002',
      'Create Wave 3.12 validation surfaces',
      'Create the Wave 3.12 validator, acceptance test, package-command wrapper, safe-write helper, and install-matrix runner before any migration task invokes them.',
      [
        'tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs',
        'tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs',
        'tools/script-migration/run-main-agent-wave-3-12-package-command.cjs',
        'tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs',
        'tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts',
        `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`,
      ],
      [
        'Create `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs` with phases `bootstrap`, `actions`, `helpers`, `public-cli`, `target-existence`, `caller-switch`, `builds`, `install`, `evidence`, `root-retention`, and `final`.',
        'Create `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts` with `bootstrap` and `final` modes keyed by `BMAD_WAVE_3_12_CONTRACT_TEST_PHASE`.',
        'In bootstrap mode, the acceptance test MUST check only validation-surface existence, ledger schema, and root-retention/deletion-denial invariants that exist after G002.',
        'In final mode, the acceptance test MUST check target existence proof, forbidden root script dependency checks, evidence coverage, registry finalization, safe-write receipts, and no deletion approval.',
        'Create `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs` so it reads `migration-ledger.json`, packs the package under test, runs installed package probes, and writes `install-matrix.json`.',
        'Create `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs` so each package build or test command inspects `migration-ledger.json`, runs the command when ledger targets touch its target prefix, or emits a validated `not_applicable` row when the ledger query proves the package is untouched or the package has no relevant script.',
        'Create `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` so registry, summary, evidence, install matrix, safe-write receipt, and generated governance artifact writes use UTF-8 draft, backup, SHA256, required-marker, readback, and receipt validation.',
        'Make the `bootstrap` validator phase pass after G002 only when all five validation/writer surfaces exist and `migration-ledger.json` has the required schema fields and shapes from G001.',
        'Do not run `actions`, `helpers`, `public-cli`, `target-existence`, `caller-switch`, `builds`, `install`, `evidence`, `root-retention`, or `final` phases until the task that produces the corresponding evidence has completed.',
      ],
      ['node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase bootstrap', contractTestCommand('bootstrap')],
      ['ACC002', 'ACC004', 'ACC005', 'ACC008', 'ACC009']
    ),
    taskBlock(
      'G003',
      'Migrate consumer runtime reachable actions',
      'Move the 28 consumer runtime reachable entries into package runtime modules with consumer-safe CommonJS behavior and entry-specific tests.',
      ['packages/bmad-speckit/src/main-agent/actions/**', 'packages/bmad-speckit/src/main-agent/runtime.js', 'packages/bmad-speckit/scripts/build-main-agent-dist.cjs', 'packages/bmad-speckit/tests/main-agent-wave-3-12-runtime-actions.test.js', `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`],
      [
        'For each ledger entry with `migrationStrategy=package_runtime_module`, create or update the exact package source file listed in `targetPaths`.',
        'Convert root script side effects into exported CommonJS runner functions with deterministic argument, cwd, stdout, stderr, and exit-code behavior.',
        'Update package runtime dispatch only for entries whose `callerSwitchPlan` identifies a consumer-visible Main Agent action command.',
        'Update `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` so every migrated runtime action is copied to `packages/bmad-speckit/dist/main-agent/actions/**`.',
        'Create package tests that import package source or dist modules and do not import, require, spawn, or execute any original root `scripts/**` queue path.',
        'Update each migrated ledger entry `implementationState` to `implemented` and store the package source path, dist path, and test path.',
      ],
      ['node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase actions'],
      ['ACC004', 'ACC005', 'ACC006', 'ACC007']
    ),
    taskBlock(
      'G004',
      'Migrate package runtime helpers',
      'Move the 65 package runtime helper entries into durable package helper surfaces or declared workspace package target paths.',
      [
        'migration-ledger entries[].targetPaths under packages/bmad-speckit/src/main-agent/helpers/**',
        'migration-ledger entries[].targetPaths under packages/scoring/**',
        'migration-ledger entries[].targetPaths under packages/runtime-context/**',
        'packages/bmad-speckit/scripts/build-main-agent-dist.cjs',
        'packages/bmad-speckit/tests/main-agent-wave-3-12-helpers.test.js',
        `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`,
      ],
      [
        'For each ledger entry with `migrationStrategy=durable_helper_copy`, implement the exact `targetPaths` listed in the ledger.',
        'For each helper target under `packages/bmad-speckit/src/main-agent/helpers/**`, export deterministic CommonJS APIs and avoid root repository path assumptions.',
        'For each helper target under `packages/scoring/**` or `packages/runtime-context/**`, preserve that package public API and package file inclusion rules.',
        'Do not write `packages/runtime-emit/**`, `packages/ralph-method/**`, or `packages/schema/**` from G004 unless a ledger entry target path names that exact package path and this contract is amended to include it.',
        'Update build scripts so helper targets required by consumer package runtime are copied to the corresponding dist directory.',
        'Create package tests for helper API behavior and import package helper files only from package source or dist paths.',
        'Run the ledger-aware package command wrapper for `packages/scoring` tests when `migration-ledger.json` contains a target path under `packages/scoring/**`; the wrapper may emit `not_applicable` only when its ledger query proves no scoring target path exists.',
        'Record `not_applicable` for `packages/runtime-context`, `packages/runtime-emit`, `packages/ralph-method`, or `packages/schema` package-local tests only through the ledger-aware package command wrapper, with package.json script inspection and touched-target query evidence.',
        'Update each migrated ledger entry `implementationState` to `implemented` and store the package source path, dist path, and test path.',
      ],
      ['node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase helpers'],
      ['ACC004', 'ACC005', 'ACC006', 'ACC007', 'ACC010']
    ),
    taskBlock(
      'G005',
      'Migrate public CLI package actions',
      'Expose the 9 public CLI entries through installed package CLI commands without root script dispatch.',
      ['packages/bmad-speckit/bin/bmad-speckit.js', 'packages/bmad-speckit/src/commands/**', 'packages/bmad-speckit/tests/main-agent-wave-3-12-public-cli.test.js', `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`],
      [
        'For each ledger entry with `migrationStrategy=public_cli_de_surface`, create or update the exact package command source file listed in `targetPaths`.',
        'Update `packages/bmad-speckit/bin/bmad-speckit.js` so each public CLI command loads package-local command code and does not dispatch to the original root script.',
        'Preserve documented root package bin compatibility aliases only through package CLI forwarding, not direct root TypeScript execution.',
        'Create package CLI tests that invoke `packages/bmad-speckit/bin/bmad-speckit.js` and prove command availability plus a deterministic smoke path for each public CLI entry.',
        'Update each migrated ledger entry `implementationState` to `implemented` and store the command source path, CLI command name, and test path.',
      ],
      ['node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase public-cli'],
      ['ACC004', 'ACC005', 'ACC006', 'ACC007']
    ),
    taskBlock(
      'G006',
      'Switch callers and preserve root script retention',
      'Switch package and consumer-facing callers to package surfaces while retaining original root scripts and deletion denial state.',
      ['package.json', 'packages/bmad-speckit/package.json', 'packages/bmad-speckit/bin/bmad-speckit.js', 'migration-ledger entries[].callerSwitchPlan[].targetPath', `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`, REGISTRY_PATH],
      [
        'For each migrated queue entry, update source-repository package scripts or package CLI callers only when the ledger identifies that caller as consumer-facing or install-surface-facing.',
        'Retain every original `scripts/**` file in the working tree.',
        'Keep every Wave 3.12 registry entry `deletionAllowed=false`.',
        'Record pre-evidence caller switch proof in `migration-ledger.json` fields only; do not set final registry `callerSwitchStatus` in G006.',
        'Prove package source and package bin files do not import, require, spawn, shell out to, or otherwise dispatch any original root `scripts/**` queue path. Dist and installed probe proof is produced later by G007, G008, G009, and G010.',
        'Do not describe root script retention as deletion-ready.',
      ],
      [`node -e "const fs=require('node:fs'); const j=JSON.parse(fs.readFileSync('repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json','utf8')); const missing=j.entries.map(e=>e.originalPath).filter(p=>!fs.existsSync(p)); if(missing.length){console.error(JSON.stringify({missing})); process.exit(1);} console.log(JSON.stringify({checked:j.entries.length}))"`, 'git status --short -- scripts'],
      ['ACC005', 'ACC006', 'ACC008']
    ),
    taskBlock(
      'G007',
      'Run package builds and targeted package tests',
      'Produce package source and dist proof for every migrated entry and every touched workspace package.',
      [
        'ledger buildCopyPlan[].targetPath under packages/bmad-speckit/dist/**',
        'ledger buildCopyPlan[].targetPath under packages/scoring/dist/**',
        'ledger buildCopyPlan[].targetPath under packages/runtime-context/dist/**',
        'ledger-aware wrapper build outputs under packages/runtime-emit/dist/** only when wrapper ledger query proves touched targets',
        'ledger-aware wrapper build outputs under packages/ralph-method/dist/** only when wrapper ledger query proves touched targets',
        `repo-governance/script-migrations/${WAVE_ID}/evidence.json`,
      ],
      [
        'Run the ledger-aware build sequence in this order: scoring, runtime-context, runtime-emit, ralph-method, bmad-speckit main-agent dist.',
        'Run package tests after package source and dist outputs exist.',
        'Run the ledger-aware package command wrapper for every package build and test command. The wrapper MUST run the real command when ledger targets touch the target prefix and MUST emit `not_applicable` only with exact ledger query evidence when the package is untouched or with package.json evidence when the package has no relevant script.',
        'Record command, working directory, exit code, stdout hash, stderr hash, and produced artifact hashes in `evidence.json`.',
        'If a workspace package is not touched by any ledger target path, record `not_applicable` for that workspace package in `evidence.json` with the exact ledger query that proves no target path touches it.',
      ],
      [packageCommand('build', 'packages/scoring', 'packages/scoring', 'npm run build --prefix packages/scoring'), packageCommand('build', 'packages/runtime-context', 'packages/runtime-context', 'npm run build --prefix packages/runtime-context'), packageCommand('build', 'packages/runtime-emit', 'packages/runtime-emit', 'npm run build --prefix packages/runtime-emit'), packageCommand('build', 'packages/ralph-method', 'packages/ralph-method', 'npm run build --prefix packages/ralph-method'), packageCommand('build', 'packages/bmad-speckit', 'packages/bmad-speckit', 'npm run build:main-agent-dist --prefix packages/bmad-speckit'), packageCommand('test', 'packages/scoring', 'packages/scoring', 'npm run test --prefix packages/scoring'), packageCommand('test', 'packages/bmad-speckit', 'packages/bmad-speckit', 'npm run test --prefix packages/bmad-speckit'), 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase builds'],
      ['ACC004', 'ACC007', 'ACC010']
    ),
    taskBlock(
      'G008',
      'Run install matrix proof',
      'Prove installed package behavior for migrated queue entries from consumer-style install modes without source repository root script execution.',
      [`tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs`, `repo-governance/script-migrations/${WAVE_ID}/install-matrix.json`, `repo-governance/script-migrations/${WAVE_ID}/evidence.json`, 'packages/bmad-speckit/package.json'],
      [
        'Create or update an install-matrix runner for Wave 3.12 that reads `migration-ledger.json`.',
        `Create \`repo-governance/script-migrations/${WAVE_ID}/package-under-test.tgz\` from the current package build before install probes run.`,
        `Prove \`npm install --save-dev repo-governance/script-migrations/${WAVE_ID}/package-under-test.tgz\` for one migrated action, one helper, and one CLI entry.`,
        `Prove \`npx --package repo-governance/script-migrations/${WAVE_ID}/package-under-test.tgz bmad-speckit ...\` for every public CLI entry that exposes an installed command.`,
        `Prove \`npm install --no-save repo-governance/script-migrations/${WAVE_ID}/package-under-test.tgz\` followed by \`npx --no-install bmad-speckit ...\` for every public CLI entry that exposes an installed command.`,
        'Record `usedRootScript=false`, `usedTsx=false`, `usedTsNode=false`, and `usedCompiledFallback=false` for every covered installed-package probe.',
        'If a queue helper has no direct CLI command, prove installed package `require` resolution for its package target path and record the helper probe in `install-matrix.json`.',
      ],
      ['node tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs --write', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase install'],
      ['ACC006', 'ACC007', 'ACC010', 'ACC011']
    ),
    taskBlock(
      'G009',
      'Write evidence packet',
      'Write the Wave 3.12 evidence artifact that binds command results, install-matrix proof, ledger state, registry state, and artifact hashes.',
      [
        `repo-governance/script-migrations/${WAVE_ID}/evidence.json`,
        `repo-governance/script-migrations/${WAVE_ID}/install-matrix.json`,
        `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`,
        `repo-governance/script-migrations/${WAVE_ID}/safe-write-receipts.json`,
      ],
      [
        'Write `evidence.json` through `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` with top-level fields `waveId`, `sourcePlanPath`, `sourcePlanHash`, `executionContractPath`, `auditContractPath`, `queueHash`, `validatedAt`, `commands`, `entries`, `installMatrixEvidence`, `safeWriteReceiptRefs`, `artifactHashes`, and `residualRisks`.',
        'For each queue entry, write one `entries[]` row with `entryId`, `originalPath`, `targetPaths`, `callerSwitchStatus`, `validationStatus`, `evidenceCommandIds`, `installMatrixProbeIds`, and `result`.',
        'For every command row, write exact `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, and `provesAcceptanceIds`.',
        'For every produced artifact, write exact relative path and SHA256 hash.',
        `Require ` + '`safe-write-receipts.json`' + ` to include passed receipts for \`repo-governance/script-migrations/${WAVE_ID}/evidence.json\` and \`repo-governance/script-migrations/${WAVE_ID}/install-matrix.json\` when those files are created or replaced; \`evidence.json.safeWriteReceiptRefs\` may cite receipt IDs or target paths and is validated after promotion, not before promotion.`,
        'Set each queue entry evidence `validationStatus` to `passed` only after the commands proving that entry have exit code 0.',
        'Set `residualRisks` to an empty array only when every acceptance item has direct evidence.',
      ],
      ['node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase evidence', `node -e "const fs=require('node:fs'); const e=JSON.parse(fs.readFileSync('repo-governance/script-migrations/${WAVE_ID}/evidence.json','utf8')); if((e.entries||[]).length!==102) process.exit(1); if(e.queueHash!=='${queueHash}') process.exit(2); if(e.executionContractPath!=='${TARGET_PATH}') process.exit(3); if(e.auditContractPath!=='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md') process.exit(4); console.log(JSON.stringify({entries:e.entries.length,queueHash:e.queueHash}))"`],
      ['ACC009', 'ACC010', 'ACC011', 'ACC012']
    ),
    taskBlock(
      'G010',
      'Finalize registry Wave 3.12 entries',
      'Move all 102 queue entries from planned pending to validated passed only after implementation evidence exists.',
      [REGISTRY_PATH, `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`, `repo-governance/script-migrations/${WAVE_ID}/evidence.json`, `repo-governance/script-migrations/${WAVE_ID}/safe-write-receipts.json`],
      [
        `Promote the \`${REGISTRY_PATH}\` update through \`tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs\`, with required-key checks for the Wave 3.12 record, backup path when replacing, byte length, target SHA256, readback SHA256, and a passed receipt in \`repo-governance/script-migrations/${WAVE_ID}/safe-write-receipts.json\`.`,
        `Set Wave 3.12 \`contractPath\` in \`${REGISTRY_PATH}\` to \`${TARGET_PATH}\` and preserve the previous audit contract path in \`evidence.json.auditContractPath\`.`,
        'For each of the 102 queue entries, update `migrationStatus` to `validated` only after its package source, build output, caller switch, and tests are recorded in `migration-ledger.json` and `evidence.json`.',
        'For each of the 102 queue entries, update `validationStatus` to `passed` only after `evidence.json` contains passing command rows for that entry.',
        'For each of the 102 queue entries, set final registry `callerSwitchStatus` to `switched`, `compatibility_alias_retained`, or `not_applicable` only after `evidence.json.entries[]` contains the direct proof command IDs for that state.',
        `For each of the 102 queue entries, set \`evidenceRefs\` to include \`repo-governance/script-migrations/${WAVE_ID}/evidence.json\`.`,
        'For each of the 102 queue entries, keep `deletionAllowed=false` and `deletionApprovalRef=null`.',
        'Do not change the 27 validated non-queue records except to correct evidence wording that remains within their existing classification.',
      ],
      ['node tools/script-migration/validate-registry.cjs', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase final', 'npx vitest run tests/acceptance/script-migration-registry-contract.test.ts tests/acceptance/script-migration-full-physical-closure.test.ts'],
      ['ACC003', 'ACC008', 'ACC009', 'ACC014']
    ),
    taskBlock(
      'G011',
      'Update summary and human projection',
      'Update the Wave 3.12 summary so it reports completed migrations, remaining queue count, settled non-queue boundaries, audit contract path, execution contract path, evidence paths, and residual risks without overclaiming consumer direct script execution.',
      [`repo-governance/script-migrations/${WAVE_ID}/summary.md`, `repo-governance/script-migrations/${WAVE_ID}/evidence.json`, `repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json`],
      [
        'Promote `summary.md` through `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`, with required headings for queue counts, audit contract path, execution contract path, evidence paths, residual risks, backup path when replacing, byte length, target SHA256, readback SHA256, and a passed receipt in `safe-write-receipts.json`.',
        'Update `summary.md` so the queue section reports `completed` and `remaining` counts from `migration-ledger.json`.',
        `State that the Wave 3.12 audit contract path is \`docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md\` and the runtime migration execution contract path is \`${TARGET_PATH}\`.`,
        'Keep the validated non-migration grouping from the source summary unless direct amended evidence changes it.',
        'State that consumer reachable entries are migrated only when registry and evidence rows are validated.',
        'State that original root scripts are retained and not deletion-approved.',
        'State that root package `files` including `scripts/` remains a risk signal until a separate packaging cleanup contract changes it.',
      ],
      ['node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty', 'node tools/script-migration/validate-registry.cjs', 'npx vitest run tests/acceptance/script-migration-full-physical-closure.test.ts tests/acceptance/script-migration-registry-contract.test.ts'],
      ['ACC001', 'ACC003', 'ACC008', 'ACC012']
    ),
    taskBlock(
      'G012',
      'Final verification and closeout',
      'Run final gates and produce the completion evidence packet without claiming unsupported runtime scope.',
      [`repo-governance/script-migrations/${WAVE_ID}/evidence.json`, `repo-governance/script-migrations/${WAVE_ID}/summary.md`, REGISTRY_PATH, TARGET_PATH],
      [
        'Run all required commands in the dependency order defined by D007; command IDs are stable evidence labels and are not numeric execution order.',
        'Record final command results in `evidence.json` or cite their exact command IDs from `evidence.json`.',
        `Validate \`repo-governance/script-migrations/${WAVE_ID}/safe-write-receipts.json\` contains passed receipts for registry, evidence, install matrix when created, and summary promotions.`,
        'Run the ledger root-retention command and `git status --short -- scripts` and prove no root script deletion occurred.',
        'Run the encoding integrity gate after all Markdown, YAML, JSON, package, or generated-surface edits.',
        'Prepare final response with generated evidence paths, command summary, remaining risks, and exact scripts still pending if any ledger entry remains unvalidated.',
      ],
      ['node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js', 'git status --short -- scripts', `git status --short -- ${REGISTRY_PATH} repo-governance/script-migrations/${WAVE_ID}`],
      ['ACC001', 'ACC002', 'ACC009', 'ACC012', 'ACC013', 'ACC014']
    ),
  ].join('\n\n');

  const acceptanceRows = [
    ['ACC001', 'The physical script universe remains visible.', 'MUST prove `rg --files scripts` equals 240 and Wave 3.12 current unregistered count equals 0.', 'G001,G011,G012', 'CMD001,CMD002,CMD030'],
    ['ACC002', 'The 102-entry queue is frozen before edits.', `MUST produce \`migration-ledger.json\` with 102 entries, required per-entry fields, required per-entry shapes, and queue hash \`${queueHash}\`.`, 'G001,G002,G012', 'CMD003,CMD005,CMD026'],
    ['ACC003', 'Registry state remains valid.', 'MUST keep registry schema valid and update Wave 3.12 entries only after direct evidence exists.', 'G001,G010,G011', 'CMD004,CMD027,CMD028,CMD029,CMD030'],
    ['ACC004', 'Package source targets exist.', 'MUST produce every ledger-declared package source and dist target for migrated entries and prove existence directly from `migration-ledger.json`.', 'G002,G003,G004,G005,G007', 'CMD005,CMD007,CMD008,CMD009,CMD010,CMD018,CMD020'],
    ['ACC005', 'Forbidden root script dependency is removed for covered package runtime.', 'MUST prove package runtime, CLI files, dist files, and installed probes do not dispatch migrated entries through any original root `scripts/**` queue path.', 'G002,G003,G004,G005,G006,G008', 'CMD005,CMD007,CMD008,CMD009,CMD011,CMD023,CMD024'],
    ['ACC006', '`tsx` and `ts-node` are absent from consumer runtime for covered entries.', 'MUST prove installed package probes and static guards report `usedTsx=false` and `usedTsNode=false`.', 'G002,G003,G004,G005,G006,G008', 'CMD011,CMD023,CMD024'],
    ['ACC007', 'Compiled fallback is not completion proof.', 'MUST prove covered installed-package probes report `usedCompiledFallback=false` and migrated package source plus dist output exist.', 'G003,G004,G005,G007,G008,G009', 'CMD010,CMD023,CMD024,CMD025'],
    ['ACC008', 'Root scripts are retained.', 'MUST prove every original queue `scripts/**` path remains present and all Wave 3.12 entries keep `deletionAllowed=false` and `deletionApprovalRef=null`.', 'G006,G010,G011,G012', 'CMD012,CMD013,CMD027,CMD028'],
    ['ACC009', 'Evidence file covers every queue entry.', 'MUST produce `evidence.json` with 102 entry rows and command evidence for every validated entry, plus safe-write receipt linkage for promoted governance artifacts.', 'G009,G010,G012', 'CMD025,CMD026,CMD028,CMD029'],
    ['ACC010', 'Package builds and tests pass.', 'MUST pass package builds and package tests for touched package surfaces through ledger-aware wrapper commands and record `not_applicable` only when wrapper evidence proves no touched target or no relevant package script.', 'G004,G007,G008,G009', 'CMD014,CMD015,CMD016,CMD017,CMD018,CMD019,CMD020,CMD021,CMD022'],
    ['ACC011', 'Install matrix passes.', 'MUST produce install-matrix proof for installed package CLI, runtime action, and helper probes.', 'G008,G009', 'CMD023,CMD024,CMD026'],
    ['ACC012', 'Summary projection is narrow and evidence-backed.', 'MUST update summary without claiming direct consumer execution for all source scripts and must distinguish the audit contract path from this execution contract path.', 'G009,G010,G011,G012', 'CMD026,CMD030'],
    ['ACC013', 'Encoding integrity passes.', 'MUST run encoding gate after all text edits and record findings equal 0.', 'G012', 'CMD031'],
    ['ACC014', 'No forbidden scope expansion occurred.', 'MUST report no root script deletion, no registry deletion approval, no broad package write grant, and no unamended queue membership changes.', 'G006,G010,G012', 'CMD010,CMD012,CMD013,CMD027,CMD028'],
  ];

  const strictAcceptanceChecklist = acceptanceRows
    .map(([id, title, requirement, tasks, evidence]) => `- [ ] ${id} ${title}: ${requirement} Tasks=${tasks}. Evidence=${evidence}.`)
    .join('\n');

  const acceptanceTraceabilityMatrix = table(
    ['Acceptance ID', 'Tasks', 'Evidence command IDs or artifact paths', 'Pass condition'],
    acceptanceRows.map(([id, title, requirement, tasks, evidence]) => [id, tasks, evidence, requirement])
  );

  const commands = [
    ['CMD001', 'pwsh.exe -NoLogo -NoProfile -Command "& { rg --files scripts | Measure-Object | Select-Object -ExpandProperty Count }"', ROOT, 'stdout integer equals 240', 'ACC001'],
    ['CMD002', 'node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty', ROOT, 'exit code 0 and JSON status equals passed', 'ACC001,ACC003'],
    ['CMD003', ledgerSchemaCheckCommand(queueHash), ROOT, 'exit code 0 and stdout reports 102 entries, expected queueHash, all required per-entry ledger fields, and ledger field shapes passed', 'ACC002'],
    ['CMD004', 'node tools/script-migration/validate-registry.cjs', ROOT, 'exit code 0 and JSON status equals passed', 'ACC003'],
    ['CMD005', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase bootstrap', ROOT, 'exit code 0 and bootstrap phase reports validation surfaces plus ledger schema are present', 'ACC002,ACC004,ACC005,ACC008,ACC009'],
    ['CMD006', contractTestCommand('bootstrap'), ROOT, 'exit code 0 in bootstrap mode and test does not require evidence.json, install-matrix.json, or finalized registry rows', 'ACC002'],
    ['CMD007', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase actions', ROOT, 'exit code 0 and action phase reports 28 consumer runtime reachable entries implemented', 'ACC004,ACC005'],
    ['CMD008', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase helpers', ROOT, 'exit code 0 and helper phase reports 65 package runtime helper entries implemented', 'ACC004,ACC005'],
    ['CMD009', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase public-cli', ROOT, 'exit code 0 and public-cli phase reports 9 public CLI entries implemented', 'ACC004,ACC005'],
    ['CMD010', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase target-existence', ROOT, 'exit code 0 and every ledger-declared package source plus dist target exists', 'ACC004,ACC007,ACC014'],
    ['CMD011', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase caller-switch', ROOT, 'exit code 0 and package source plus package bin report no forbidden root script dependency, no tsx, and no ts-node before install proof exists', 'ACC005,ACC006'],
    ['CMD012', `node -e "const fs=require('node:fs'); const j=JSON.parse(fs.readFileSync('repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json','utf8')); const missing=j.entries.map(e=>e.originalPath).filter(p=>!fs.existsSync(p)); if(missing.length){console.error(JSON.stringify({missing})); process.exit(1);} console.log(JSON.stringify({checked:j.entries.length}))"`, ROOT, 'exit code 0 and stdout reports 102 retained original root script paths', 'ACC008,ACC014'],
    ['CMD013', 'git status --short -- scripts', ROOT, 'stdout contains no deleted path marker for `scripts/**`', 'ACC008,ACC014'],
    ['CMD014', packageCommand('build', 'packages/scoring', 'packages/scoring', 'npm run build --prefix packages/scoring'), ROOT, 'exit code 0 and wrapper either ran scoring build for touched `packages/scoring/**` targets or emitted validated not_applicable evidence with ledger query', 'ACC010'],
    ['CMD015', packageCommand('build', 'packages/runtime-context', 'packages/runtime-context', 'npm run build --prefix packages/runtime-context'), ROOT, 'exit code 0 and wrapper either ran runtime-context build for touched `packages/runtime-context/**` targets or emitted validated not_applicable evidence with ledger query', 'ACC010'],
    ['CMD016', packageCommand('build', 'packages/runtime-emit', 'packages/runtime-emit', 'npm run build --prefix packages/runtime-emit'), ROOT, 'exit code 0 and wrapper either ran runtime-emit build for touched `packages/runtime-emit/**` targets or emitted validated not_applicable evidence with ledger query', 'ACC010'],
    ['CMD017', packageCommand('build', 'packages/ralph-method', 'packages/ralph-method', 'npm run build --prefix packages/ralph-method'), ROOT, 'exit code 0 and wrapper either ran ralph-method build for touched `packages/ralph-method/**` targets or emitted validated not_applicable evidence with ledger query', 'ACC010'],
    ['CMD018', packageCommand('build', 'packages/bmad-speckit', 'packages/bmad-speckit', 'npm run build:main-agent-dist --prefix packages/bmad-speckit'), ROOT, 'exit code 0 and wrapper runs bmad-speckit main-agent dist build for touched package targets', 'ACC004,ACC010'],
    ['CMD019', packageCommand('test', 'packages/scoring', 'packages/scoring', 'npm run test --prefix packages/scoring'), ROOT, 'exit code 0 and wrapper either ran scoring tests for touched `packages/scoring/**` targets or emitted validated not_applicable evidence with ledger query', 'ACC010'],
    ['CMD020', packageCommand('test', 'packages/bmad-speckit', 'packages/bmad-speckit', 'npm run test --prefix packages/bmad-speckit'), ROOT, 'exit code 0 and wrapper runs bmad-speckit tests for touched package targets', 'ACC004,ACC010'],
    ['CMD021', 'node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind test-not-applicable --package packages/runtime-context --target-prefix packages/runtime-context --package packages/runtime-emit --target-prefix packages/runtime-emit --package packages/ralph-method --target-prefix packages/ralph-method --package packages/schema --target-prefix packages/schema', ROOT, 'exit code 0 and stdout or evidence records package.json script inspection plus touched-target query evidence for workspace package test not_applicable rows', 'ACC010'],
    ['CMD022', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase builds', ROOT, 'exit code 0 and builds phase maps package build and test evidence to touched ledger targets', 'ACC010'],
    ['CMD023', 'node tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs --write', ROOT, 'exit code 0 and install-matrix rows report usedRootScript=false usedTsx=false usedTsNode=false usedCompiledFallback=false', 'ACC005,ACC006,ACC007,ACC011'],
    ['CMD024', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase install', ROOT, 'exit code 0 and install phase verifies installed CLI, action, and helper probes', 'ACC005,ACC006,ACC007,ACC011'],
    ['CMD025', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase evidence', ROOT, 'exit code 0 and evidence phase reports every queue entry has direct command or artifact evidence and safe-write receipt linkage exists for promoted artifacts', 'ACC007,ACC009,ACC010'],
    ['CMD026', `node -e "const fs=require('node:fs'); const e=JSON.parse(fs.readFileSync('repo-governance/script-migrations/${WAVE_ID}/evidence.json','utf8')); const r=JSON.parse(fs.readFileSync('repo-governance/script-migrations/${WAVE_ID}/safe-write-receipts.json','utf8')); if((e.entries||[]).length!==102) process.exit(1); if(e.queueHash!=='${queueHash}') process.exit(2); if(e.executionContractPath!=='${TARGET_PATH}') process.exit(3); if(e.auditContractPath!=='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md') process.exit(4); const receipts=r.receipts||[]; for(const target of ['repo-governance/script-migrations/${WAVE_ID}/evidence.json']){ if(!receipts.some(x=>x.targetPath===target&&x.status==='passed')){console.error(JSON.stringify({missingReceipt:target})); process.exit(5);} } console.log(JSON.stringify({entries:e.entries.length,queueHash:e.queueHash,executionContractPath:e.executionContractPath,auditContractPath:e.auditContractPath,safeWriteReceipts:receipts.length}))"`, ROOT, 'exit code 0 and evidence reports 102 entries, expected queueHash, execution contract path, audit contract path, and safe-write receipt linkage', 'ACC002,ACC009,ACC011,ACC012'],
    ['CMD027', 'node tools/script-migration/validate-registry.cjs', ROOT, 'exit code 0 after Wave 3.12 registry finalization', 'ACC003,ACC008,ACC014'],
    ['CMD028', 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase final', ROOT, 'exit code 0 and final phase verifies registry finalization, deletionAllowed=false, deletionApprovalRef=null, and no unamended queue membership changes', 'ACC003,ACC008,ACC009,ACC014'],
    ['CMD029', contractTestCommand('final', ['tests/acceptance/script-migration-full-physical-closure.test.ts', 'tests/acceptance/script-migration-registry-contract.test.ts']), ROOT, 'exit code 0 in final mode and tests validate evidence coverage, registry finalization, safe-write receipts, deletion denial, and full physical closure', 'ACC003,ACC009,ACC012'],
    ['CMD030', 'node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty', ROOT, 'exit code 0 after summary update', 'ACC001,ACC003,ACC012'],
    ['CMD031', 'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js', ROOT, 'exit code 0 and stdout contains findings=0', 'ACC013'],
  ];

  const requiredTestCommands = commands
    .map(([id, command, cwd, pass, acceptance]) => commandBlock(id, command, cwd, pass, acceptance))
    .join('\n\n');

  const manualVerificationScenarios = [
    `- MANUAL MS001: Inspect \`repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json\` and verify that the first and last queue entries match the source summary queue order. Evidence artifact: \`migration-ledger.json\` field \`queueOrderProof\`.`,
    `- MANUAL MS002: Inspect \`repo-governance/script-migrations/${WAVE_ID}/summary.md\` and verify it states that Wave 3.12 does not claim all source repository scripts are directly executable in consumer projects. Evidence artifact: summary paragraph under \`Residual Risk\` or its closeout successor section.`,
    `- MANUAL MS003: Inspect \`repo-governance/script-migrations/${WAVE_ID}/install-matrix.json\` and verify at least one installed package probe covers each queue category \`consumer_runtime_reachable\`, \`package_runtime_helper\`, and \`public_cli\`. Evidence artifact: \`install-matrix.json\` field \`categoryCoverage\`.`,
    '- MANUAL MS004: Inspect `git status --short -- scripts` output and verify no line begins with `D ` for a root script. Evidence command: CMD013.',
  ].join('\n');

  const completionEvidencePacket = [
    `- EVD001: Final response MUST include \`sourcePlanPath=${SOURCE_PATH}\` and \`sourcePlanHash=${sourceHash}\`.`,
    `- EVD002: Final response MUST include \`queueHash=${queueHash}\` and the final count of validated queue entries from \`evidence.json\`.`,
    `- EVD003: Final response MUST include \`repo-governance/script-migrations/${WAVE_ID}/migration-ledger.json\` SHA256.`,
    `- EVD004: Final response MUST include \`repo-governance/script-migrations/${WAVE_ID}/evidence.json\` SHA256.`,
    `- EVD005: Final response MUST include \`repo-governance/script-migrations/${WAVE_ID}/install-matrix.json\` SHA256 when G008 creates that file.`,
    `- EVD006: Final response MUST include \`repo-governance/script-migrations/${WAVE_ID}/summary.md\` SHA256.`,
    '- EVD007: Final response MUST list every required command ID, command line, exit code, and pass or fail state.',
    '- EVD008: Final response MUST list remaining pending scripts when any ledger entry has `validationStatus` not equal to `passed`.',
    '- EVD009: Final response MUST state `root script deletion approval: false for all Wave 3.12 entries` when registry validation proves it.',
    '- EVD010: Final response MUST include encoding gate output summary from CMD031.',
  ].join('\n');

  const stopConditions = [
    `- STOP \`contract_amendment_required:queue_membership_changed\` when the Wave 3.12 queue is not exactly the 102 paths from the source summary and queue hash \`${queueHash}\`.`,
    '- STOP `blocked_by_contract_ambiguity:ledger_original_path` when a queue entry target path, public command, package owner, runner API, caller switch plan, build copy plan, test path, workspace package, or validation command cannot be derived from the registry entry, source script, and package target path.',
    '- STOP `scope_amendment_required:ledger_original_path` when a queue entry requires a write outside the union of ledger `targetPaths`, ledger `callerSwitchPlan[].targetPath`, ledger `buildCopyPlan[].targetPath`, ledger `testPaths`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/**`, `repo-governance/script-migration-registry.yaml`, `package.json`, `packages/bmad-speckit/package.json`, `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs`, `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs`, `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs`, `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`, and `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts`.',
    '- STOP `root_script_deletion_forbidden:ledger_original_path` before deleting, moving, renaming, or marking deletion-approved any file under `scripts/**`.',
    '- STOP `consumer_runtime_root_script_dependency:ledger_original_path` when package runtime, package CLI, package dist, installed CLI probe, installed action probe, or installed helper probe imports, requires, spawns, shells out to, or otherwise dispatches any original root `scripts/**` queue path.',
    '- STOP `consumer_runtime_root_ts_dependency:ledger_original_path` when package runtime for a migrated entry imports or executes root `scripts/*.ts`; this condition is a TypeScript-specific subset of `consumer_runtime_root_script_dependency`.',
    '- STOP `consumer_runtime_tsx_dependency:ledger_original_path` when installed package proof requires `tsx`.',
    '- STOP `consumer_runtime_ts_node_dependency:ledger_original_path` when installed package proof requires `ts-node`.',
    '- STOP `compiled_fallback_completion_claim:ledger_original_path` when covered behavior is proven only by compiled fallback instead of migrated package source and dist output.',
    '- STOP `registry_validation_failed` when `node tools/script-migration/validate-registry.cjs` exits non-zero.',
    '- STOP `install_matrix_failed` when `node tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs --write` exits non-zero or omits required false flags.',
    '- STOP `encoding_integrity_failed` when `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` exits non-zero or reports findings greater than 0.',
    '- STOP `docs_plan_rewrite_forbidden` when `/goal` attempts to rewrite this contract instead of executing tasks.',
  ].join('\n');

  const slotData = {
    frontMatter,
    goalEntry,
    authorityModel,
    rootCause,
    domainAddenda,
    implementationTasks: tasks,
    strictAcceptanceChecklist,
    acceptanceTraceabilityMatrix,
    requiredTestCommands,
    manualVerificationScenarios,
    completionEvidencePacket,
    stopConditions,
  };

  const rendered = renderGoalContract({ templateText, profile, slotData });
  fs.mkdirSync(path.dirname(repoPath(DRAFT_PATH)), { recursive: true });
  fs.writeFileSync(repoPath(DRAFT_PATH), rendered.document, 'utf8');
  fs.writeFileSync(repoPath(SLOT_DATA_PATH), `${JSON.stringify(slotData, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        draftPath: DRAFT_PATH,
        slotDataPath: SLOT_DATA_PATH,
        targetPath: TARGET_PATH,
        sourcePlanHash: sourceHash,
        queueHash,
        bytes: Buffer.byteLength(rendered.document, 'utf8'),
        audit: rendered.audit,
      },
      null,
      2
    )}\n`
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
}
