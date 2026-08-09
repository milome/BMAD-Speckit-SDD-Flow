'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { load } = require('js-yaml');

const { fail } = require('./canonical-artifact.cjs');
const { verifyReleaseWorkflowAuthority } = require('./verify-release-evidence-parity.cjs');

const EXPECTED_JOB_IDS = Object.freeze(['classify', 'execute-shard', 'evidence-join', 'ci-result']);
const EXECUTION_ALLOWED_OUTPUT = '${{ steps.selection-gate.outputs.execution_allowed }}';
const EXECUTION_ALLOWED_IF = "needs.classify.outputs.execution_allowed == 'true'";
const EVIDENCE_JOIN_IF = `always() && ${EXECUTION_ALLOWED_IF}`;

function parseWorkflow(source, code) {
  let workflow;
  try {
    workflow = load(source);
  } catch {
    fail(code);
  }
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) fail(code);
  return workflow;
}

function jobSteps(job) {
  return Array.isArray(job?.steps) ? job.steps : [];
}

function runText(job) {
  return jobSteps(job)
    .map((step) => String(step?.run || ''))
    .join('\n');
}

function countCommand(text, pattern) {
  return (text.match(pattern) || []).length;
}

function inspectCiWorkflow({ workflowSource }) {
  const workflow = parseWorkflow(workflowSource, 'CI_WORKFLOW_INVALID');
  const jobs = workflow.jobs || {};
  const allRunText = Object.values(jobs).map(runText).join('\n');
  const matrix = jobs['execute-shard']?.strategy?.matrix;
  const matrixText = JSON.stringify(matrix ?? null);
  const planningCommands = [
    'ci:catalog',
    'ci:timing-bootstrap',
    'ci:freeze-core',
    'ci:coverage-gap',
    'ci:select',
    'ci:shard-plan',
    'ci:semantic-index',
  ];
  const planningSteps = jobSteps(jobs.classify).filter((step) => {
    const source = String(step?.run || '');
    return planningCommands.every((scriptName) => source.includes(`npm run ${scriptName}`));
  });
  const planningStep = planningSteps.length === 1 ? planningSteps[0] : null;
  const planningRun = String(planningStep?.run || '');
  const prFastPlanningBudgetSeconds = Number(planningStep?.env?.PR_FAST_PLANNING_BUDGET_SECONDS);
  const evidenceJoinSteps = jobSteps(jobs['evidence-join']);
  const diagnosticsSummarySteps = evidenceJoinSteps.filter(
    (step) =>
      step?.if === 'always()' &&
      String(step?.run || '').includes('six-model-ci-diagnostics.md') &&
      String(step?.run || '').includes('$GITHUB_STEP_SUMMARY')
  );
  const diagnosticsUploads = evidenceJoinSteps.filter(
    (step) =>
      String(step?.uses || '').startsWith('actions/upload-artifact@') &&
      String(step?.with?.name || '').startsWith('ci-final-') &&
      String(step?.with?.path || '').includes('.artifacts/test-portfolio/final/')
  );
  const tolerantEvidenceDownloads = evidenceJoinSteps.filter(
    (step) =>
      String(step?.uses || '').startsWith('actions/download-artifact@') &&
      step?.['continue-on-error'] === true &&
      (String(step?.with?.name || '').startsWith('ci-plan-') ||
        String(step?.with?.pattern || '') === 'ci-lane-*')
  );
  const blockedDiagnosticsSteps = jobSteps(jobs.classify).filter(
    (step) =>
      step?.if === "steps.selection-gate.outputs.execution_allowed != 'true'" &&
      String(step?.run || '').includes('npm run ci:diagnostics') &&
      String(step?.run || '').includes('--mode planning')
  );
  const blockedDiagnosticsSummarySteps = jobSteps(jobs.classify).filter(
    (step) =>
      step?.if === "steps.selection-gate.outputs.execution_allowed != 'true'" &&
      String(step?.run || '').includes('six-model-ci-diagnostics.md') &&
      String(step?.run || '').includes('$GITHUB_STEP_SUMMARY')
  );
  return {
    workflow,
    catalogProducerCount: countCommand(allRunText, /\bnpm\s+run\s+ci:catalog\b/gu),
    selectionProducerCount: countCommand(allRunText, /\bnpm\s+run\s+ci:select\b/gu),
    semanticIndexProducerCount: countCommand(
      allRunText,
      /\bnpm\s+run\s+ci:semantic-index\b/gu
    ),
    manifestProducerCount: countCommand(allRunText, /\bnpm\s+run\s+ci:manifest\b/gu),
    packagePrepareAuthorityCount: countCommand(allRunText, /\bnpm\s+run\s+ci:prepare-package\b/gu),
    serialAllTestsJobCount: countCommand(
      allRunText,
      /\bnpm\s+(?:test\b|run\s+(?:test:ci|test:vitest:default)\b)/gu
    ),
    oldSelectionFallbackCount: countCommand(allRunText, /\btest:ci\b/gu),
    matrixTestPathFieldCount: countCommand(matrixText, /testPath|testPaths|identityKeys/gu),
    pullRequestProfilePinned: /pull_request\)\s+profile=pr-fast\s+;;/u.test(allRunText),
    planningAuthorityStepCount: planningSteps.length,
    prFastPlanningBudgetSeconds,
    semanticIndexAfterShardPlan:
      planningRun.indexOf('npm run ci:semantic-index') >
      planningRun.indexOf('npm run ci:shard-plan'),
    joinSemanticIndexBound: runText(jobs['evidence-join']).includes(
      '--semantic-index .artifacts/test-portfolio/ci-shard-semantic-index.json'
    ),
    diagnosticsSummaryStepCount: diagnosticsSummarySteps.length,
    diagnosticsUploadCount: diagnosticsUploads.length,
    tolerantEvidenceDownloadCount: tolerantEvidenceDownloads.length,
    blockedDiagnosticsStepCount: blockedDiagnosticsSteps.length,
    blockedDiagnosticsSummaryStepCount: blockedDiagnosticsSummarySteps.length,
    prFastPlanningTimeoutEnforced:
      /timeout\s+--foreground\s+--signal=TERM\s+--kill-after=10s\s+\\?\s*"\$\{PR_FAST_PLANNING_BUDGET_SECONDS\}s"\s+bash\s+-c\s+'set -euo pipefail; run_planning'/u.test(
        planningRun
      ),
    classifyTimeoutMinutes: jobs.classify?.['timeout-minutes'],
    modelInvocationCount: countCommand(
      workflowSource,
      /OPENAI_API_KEY|ANTHROPIC_API_KEY|AZURE_OPENAI|ollama|(?:^|\s)(?:codex|claude)(?:\s|$)/gimu
    ),
  };
}

function requiredTriggers(workflow) {
  const triggers = workflow.on || workflow.true || {};
  return ['pull_request', 'merge_group', 'schedule', 'workflow_dispatch', 'workflow_call'].every(
    (name) => Object.prototype.hasOwnProperty.call(triggers, name)
  );
}

function verifyCiAuthorityHardCut({ ciSource, releaseSource, publishSource, packageJson }) {
  const inspection = inspectCiWorkflow({ workflowSource: ciSource });
  const { workflow } = inspection;
  const jobs = workflow.jobs || {};
  const jobIds = Object.keys(jobs);
  if (
    jobIds.length !== EXPECTED_JOB_IDS.length ||
    jobIds.some((jobId, index) => jobId !== EXPECTED_JOB_IDS[index])
  ) {
    fail('CI_DAG_INVALID');
  }
  if (!requiredTriggers(workflow)) fail('CI_TRIGGER_PROFILE_INVALID');
  if (inspection.matrixTestPathFieldCount > 0) fail('CI_MATRIX_TEST_PATH_FORBIDDEN');
  if (
    jobs['execute-shard']?.strategy?.matrix !== '${{ fromJSON(needs.classify.outputs.matrix) }}'
  ) {
    fail('CI_MATRIX_AUTHORITY_INVALID');
  }
  if (jobs.classify?.outputs?.execution_allowed !== EXECUTION_ALLOWED_OUTPUT) {
    fail('CI_SELECTION_EXECUTION_GATE_INVALID');
  }
  if (jobs['execute-shard']?.if !== EXECUTION_ALLOWED_IF) {
    fail('CI_SHARD_EXECUTION_GATE_INVALID');
  }
  if (jobs['evidence-join']?.if !== EVIDENCE_JOIN_IF) fail('CI_EVIDENCE_JOIN_NOT_ALWAYS');
  const joinNeeds = jobs['evidence-join']?.needs;
  if (
    !Array.isArray(joinNeeds) ||
    joinNeeds.length !== 2 ||
    joinNeeds[0] !== 'classify' ||
    joinNeeds[1] !== 'execute-shard'
  ) {
    fail('CI_EVIDENCE_JOIN_AUTHORITY_INVALID');
  }
  const resultNeeds = jobs['ci-result']?.needs;
  if (
    !Array.isArray(resultNeeds) ||
    resultNeeds.length !== 2 ||
    resultNeeds[0] !== 'classify' ||
    resultNeeds[1] !== 'evidence-join'
  ) {
    fail('CI_RESULT_AUTHORITY_INVALID');
  }
  for (const [field, code] of [
    ['catalogProducerCount', 'CI_CATALOG_AUTHORITY_COUNT'],
    ['selectionProducerCount', 'CI_SELECTION_AUTHORITY_COUNT'],
    ['semanticIndexProducerCount', 'CI_SEMANTIC_INDEX_AUTHORITY_COUNT'],
    ['manifestProducerCount', 'CI_MANIFEST_AUTHORITY_COUNT'],
    ['packagePrepareAuthorityCount', 'CI_PACKAGE_AUTHORITY_COUNT'],
  ]) {
    if (inspection[field] !== 1) fail(code);
  }
  if (inspection.oldSelectionFallbackCount > 0) fail('CI_OLD_SELECTION_FALLBACK');
  if (inspection.serialAllTestsJobCount > 0) fail('CI_SERIAL_ALL_TESTS_FORBIDDEN');
  if (!inspection.pullRequestProfilePinned) fail('CI_CONTRIBUTOR_PROFILE_DOWNGRADE');
  if (inspection.planningAuthorityStepCount !== 1) {
    fail('CI_PLANNING_AUTHORITY_COUNT');
  }
  if (!inspection.semanticIndexAfterShardPlan) fail('CI_SEMANTIC_INDEX_ORDER_INVALID');
  if (!inspection.joinSemanticIndexBound) fail('CI_SEMANTIC_INDEX_JOIN_BINDING_REQUIRED');
  if (inspection.diagnosticsSummaryStepCount !== 1) {
    fail('CI_DIAGNOSTICS_SUMMARY_REQUIRED');
  }
  if (
    inspection.blockedDiagnosticsStepCount !== 1 ||
    inspection.blockedDiagnosticsSummaryStepCount !== 1
  ) {
    fail('CI_BLOCKED_DIAGNOSTICS_REQUIRED');
  }
  if (inspection.diagnosticsUploadCount !== 1) fail('CI_DIAGNOSTICS_UPLOAD_REQUIRED');
  if (inspection.tolerantEvidenceDownloadCount !== 2) {
    fail('CI_DIAGNOSTICS_INGESTION_PATH_REQUIRED');
  }
  if (inspection.prFastPlanningBudgetSeconds !== 90 || !inspection.prFastPlanningTimeoutEnforced) {
    fail('CI_PR_FAST_PLANNING_BUDGET_REQUIRED');
  }
  if (inspection.classifyTimeoutMinutes !== 5) fail('CI_CLASSIFY_TIMEOUT_INVALID');
  if (inspection.modelInvocationCount > 0) fail('CI_MODEL_INVOCATION_FORBIDDEN');
  if (!runText(jobs['execute-shard']).includes('npm run ci:run-shard')) {
    fail('CI_SHARD_EXECUTOR_AUTHORITY_INVALID');
  }
  if (!runText(jobs['evidence-join']).includes('npm run ci:join')) {
    fail('CI_EVIDENCE_JOIN_AUTHORITY_INVALID');
  }
  const scripts = packageJson?.scripts || {};
  for (const scriptName of [
    'ci:catalog',
    'ci:select',
    'ci:shard-plan',
    'ci:semantic-index',
    'ci:diagnostics',
    'ci:manifest',
    'ci:run-shard',
    'ci:prepare-package',
    'ci:run-consumer',
    'ci:join',
    'ci:verify-hard-cut',
    'ci:verify-release-parity',
  ]) {
    if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].trim() === '') {
      fail('CI_PACKAGE_SCRIPT_MISSING', { scriptName });
    }
  }
  const release = verifyReleaseWorkflowAuthority({ releaseSource, publishSource });
  return {
    ...inspection,
    ...release,
  };
}

function readSources(repoRoot) {
  const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  return {
    ciSource: read('.github/workflows/ci.yml'),
    releaseSource: read('.github/workflows/release.yml'),
    publishSource: read('.github/workflows/publish-npm.yml'),
    packageJson: JSON.parse(read('package.json')),
  };
}

function main() {
  const result = verifyCiAuthorityHardCut(readSources(process.cwd()));
  process.stdout.write(
    `${JSON.stringify({
      catalogProducerCount: result.catalogProducerCount,
      selectionProducerCount: result.selectionProducerCount,
      semanticIndexProducerCount: result.semanticIndexProducerCount,
      packagePrepareAuthorityCount: result.packagePrepareAuthorityCount,
      planningAuthorityStepCount: result.planningAuthorityStepCount,
      diagnosticsSummaryStepCount: result.diagnosticsSummaryStepCount,
      diagnosticsUploadCount: result.diagnosticsUploadCount,
      tolerantEvidenceDownloadCount: result.tolerantEvidenceDownloadCount,
      blockedDiagnosticsStepCount: result.blockedDiagnosticsStepCount,
      blockedDiagnosticsSummaryStepCount: result.blockedDiagnosticsSummaryStepCount,
      prFastPlanningBudgetSeconds: result.prFastPlanningBudgetSeconds,
      classifyTimeoutMinutes: result.classifyTimeoutMinutes,
      serialAllTestsJobCount: result.serialAllTestsJobCount,
      oldSelectionFallbackCount: result.oldSelectionFallbackCount,
      modelInvocationCount: result.modelInvocationCount,
      independentPublishAuthorityCount: result.independentPublishAuthorityCount,
    })}\n`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  inspectCiWorkflow,
  main,
  verifyCiAuthorityHardCut,
};
