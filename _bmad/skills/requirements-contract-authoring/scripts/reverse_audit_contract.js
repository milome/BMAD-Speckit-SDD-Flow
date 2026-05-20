#!/usr/bin/env node
const fs = require('node:fs');

const target = process.argv[2];

function fail(message, details = {}) {
  console.error(JSON.stringify({ verdict: 'FAIL', message, ...details }, null, 2));
  process.exit(1);
}

if (!target || target === '--help' || target === '-h') {
  console.log('Usage: node reverse_audit_contract.js <source-document.md>');
  process.exit(target ? 0 : 2);
}

if (!fs.existsSync(target)) {
  fail('source document file not found', { target });
}

const text = fs.readFileSync(target, 'utf8');
const mermaidBlocks = [...text.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((match) => match[1]);
const nonDiagramText = text.replace(/```mermaid\r?\n[\s\S]*?```/g, '\n');
const diagramIdPattern = /\b(?:MUST|NEG|OUT|EVD|TRACE|Q|MAIN|FAIL|IDEMP|REC|CONC|STATE|INV)-[A-Z]?\d+\b/g;
const confirmationIdPattern = /\b(?:MUST|NEG|OUT|EVD|TRACE|Q)-\d+\b/g;

function unique(values) {
  return [...new Set(values)];
}

function addRangeCoverage(body, covered) {
  const fullRange = /\b((?:MUST|NEG|OUT|EVD|TRACE|Q|MAIN|FAIL|IDEMP|REC|CONC|STATE|INV)-[A-Z]?)(\d+)\.\.((?:MUST|NEG|OUT|EVD|TRACE|Q|MAIN|FAIL|IDEMP|REC|CONC|STATE|INV)-[A-Z]?)(\d+)\b/g;
  for (const match of body.matchAll(fullRange)) {
    const [, startStem, startRaw, endStem, endRaw] = match;
    if (startStem !== endStem) continue;
    const start = Number(startRaw);
    const end = Number(endRaw);
    for (let value = Math.min(start, end); value <= Math.max(start, end); value += 1) {
      covered.add(`${startStem}${value}`);
    }
  }

  const compactRange = /\b((?:MUST|NEG|OUT|EVD|TRACE|Q|MAIN|FAIL|IDEMP|REC|CONC|STATE|INV)-([A-Z]?))(\d+)\.\.([A-Z]?)(\d+)\b/g;
  for (const match of body.matchAll(compactRange)) {
    const [, stem, stemLetter, startRaw, endLetter, endRaw] = match;
    if (endLetter && stemLetter && endLetter !== stemLetter) continue;
    const start = Number(startRaw);
    const end = Number(endRaw);
    for (let value = Math.min(start, end); value <= Math.max(start, end); value += 1) {
      covered.add(`${stem}${value}`);
    }
  }
}

const diagramIds = unique(
  mermaidBlocks.flatMap((block) => [...block.matchAll(diagramIdPattern)].map((match) => match[0]))
).sort();

const coveredIds = new Set([...nonDiagramText.matchAll(diagramIdPattern)].map((match) => match[0]));
addRangeCoverage(nonDiagramText, coveredIds);

const requiredSections = [
  'implementationConfirmation',
  'Reverse Audit Report',
  'Definition of Done',
];

const missingSections = requiredSections.filter((section) => !text.includes(section));
const missingDiagramCoverage = diagramIds.filter((id) => !coveredIds.has(id));
const hasConfirmation = /^implementationConfirmation:\s*$/m.test(text);
const hasUserConfirmed = /^ {2}status:\s*user_confirmed\s*$/m.test(text);
const hasReconfirmRequired = /^ {2}status:\s*reconfirm_required\s*$/m.test(text);
const hasContractAuthoringRequired = /^ {2}contractAuthoringRequired:\s*true\s*$/m.test(text);
const hasConfirmationRender = /^ {2}confirmationRender:\s*$/m.test(text);
const hasConfirmationHtmlPath = /^ {4}htmlPath:\s*(?!null\s*$).+/m.test(text);
const hasConfirmationReportPath = /^ {4}reportPath:\s*(?!null\s*$).+/m.test(text);
const hasConfirmationHtmlHash = /^ {4}htmlHash:\s*(?!null\s*$).+/m.test(text);
const hasReconfirmationRequest = /^ {2}reconfirmationRequest:\s*$/m.test(text);
const hasReconfirmationRequiredFlag = /^ {4}required:\s*true\s*$/m.test(text);
const hasReconfirmationPreviousSourceHash = /^ {4}previousSourceDocumentHash:\s*(?!null\s*$).+/m.test(text);
const hasReconfirmationCurrentSourceHash = /^ {4}currentSourceDocumentHash:\s*(?!null\s*$).+/m.test(text);
const hasReconfirmationPreviousImplementationHash = /^ {4}previousImplementationConfirmationHash:\s*(?!null\s*$).+/m.test(text);
const hasReconfirmationCurrentImplementationHash = /^ {4}currentImplementationConfirmationHash:\s*(?!null\s*$).+/m.test(text);
const hasReconfirmationDiffSummary = /^ {4}diffSummary:\s*$/m.test(text);
const hasReconfirmationImpactedIds = /^ {4}impactedIds:\s*$/m.test(text);
const hasReconfirmationAllowedActions = /^ {4}allowedUserActions:\s*$/m.test(text);
const hasManualHashEditInstruction = /(?:manually|手工|手动).{0,40}(?:sourceDocumentHash|implementationConfirmationHash|confirmationPageHash|confirmationHistory|status)/i.test(text);
const hasSequenceViews = /^ {2}sequenceViews:\s*$/m.test(text);
const hasFlowViews = /^ {2}flowViews:\s*$/m.test(text);
const hasArtifactAutomationPlan = /^ {2}artifactAutomationPlan:\s*$/m.test(text);
const hasArtifactPlanRows =
  /^ {4}- (?:id|artifactId):\s*ART-[A-Z0-9-]+/m.test(text) ||
  /Artifact And Automation Plan View/i.test(text);
const hasBlockingQuestion = /^ {6}blocksImplementation:\s*true\s*$/m.test(text);
const confirmationIds = new Set([...text.matchAll(confirmationIdPattern)].map((match) => match[0]));
const traceRows = [...text.matchAll(/^ {4}- id:\s*(TRACE-\d+)\s*$/gm)].map((match) => match[1]);
const hasTraceRows = traceRows.length > 0;
const hasReferenceIds = confirmationIds.has('MUST-001') || confirmationIds.has('NEG-001') || [...confirmationIds].some((id) => id.startsWith('MUST-') || id.startsWith('NEG-'));
const hasSmokeOnlyWarning =
  /Must Not Count As/.test(text) &&
  /exit code only|stdout|HTTP 200|page render|mock calls?/i.test(text);
const hasReverseVerdict = /##\s+(?:\d+\.\s+)?Reverse Audit Report[\s\S]*?Verdict:\s*(PASS|FAIL)/.test(text);

const failedChecks = [];
if (!hasConfirmation) failedChecks.push('missing_implementation_confirmation');
if (hasConfirmation && !hasUserConfirmed) failedChecks.push('confirmation_not_user_confirmed');
if (hasConfirmation && hasReconfirmRequired) {
  failedChecks.push('reconfirmation_required_unresolved');
  if (!hasReconfirmationRequest) failedChecks.push('missing_reconfirmation_request');
  if (!hasReconfirmationRequiredFlag) failedChecks.push('missing_reconfirmation_required_flag');
  if (!hasReconfirmationPreviousSourceHash) failedChecks.push('missing_reconfirmation_previous_source_hash');
  if (!hasReconfirmationCurrentSourceHash) failedChecks.push('missing_reconfirmation_current_source_hash');
  if (!hasReconfirmationPreviousImplementationHash) failedChecks.push('missing_reconfirmation_previous_implementation_hash');
  if (!hasReconfirmationCurrentImplementationHash) failedChecks.push('missing_reconfirmation_current_implementation_hash');
  if (!hasReconfirmationDiffSummary) failedChecks.push('missing_reconfirmation_diff_summary');
  if (!hasReconfirmationImpactedIds) failedChecks.push('missing_reconfirmation_impacted_ids');
  if (!hasReconfirmationAllowedActions) failedChecks.push('missing_reconfirmation_allowed_actions');
}
if (hasManualHashEditInstruction) failedChecks.push('manual_hash_or_confirmation_state_edit_instruction');
if (hasConfirmation && !hasContractAuthoringRequired) failedChecks.push('contract_authoring_not_required');
if (hasConfirmation && !hasConfirmationRender) failedChecks.push('missing_confirmation_render');
if (hasConfirmation && !hasConfirmationHtmlPath) failedChecks.push('missing_confirmation_html_path');
if (hasConfirmation && !hasConfirmationReportPath) failedChecks.push('missing_confirmation_render_report_path');
if (hasConfirmation && !hasConfirmationHtmlHash) failedChecks.push('missing_confirmation_html_hash');
if (hasConfirmation && !hasSequenceViews) failedChecks.push('missing_sequence_views');
if (hasConfirmation && !hasFlowViews) failedChecks.push('missing_flow_views');
if (hasConfirmation && !hasArtifactAutomationPlan) failedChecks.push('missing_artifact_automation_plan');
if (hasConfirmation && !hasArtifactPlanRows) failedChecks.push('missing_artifact_plan_rows');
if (hasBlockingQuestion) failedChecks.push('blocking_open_questions');
if (!hasTraceRows) failedChecks.push('missing_trace_rows');
if (!hasReferenceIds) failedChecks.push('missing_confirmation_ids');
if (missingSections.length > 0) failedChecks.push('missing_required_sections');
if (mermaidBlocks.length > 0 && diagramIds.length === 0) failedChecks.push('no_numbered_diagram_ids');
if (mermaidBlocks.length > 0 && missingDiagramCoverage.length > 0) failedChecks.push('missing_diagram_id_coverage');
if (!hasSmokeOnlyWarning) failedChecks.push('missing_e2e_anti_smoke_assertion');
if (!hasReverseVerdict) failedChecks.push('missing_reverse_audit_verdict');

const report = {
  verdict: failedChecks.length === 0 ? 'PASS' : 'FAIL',
  target,
  diagramBlockCount: mermaidBlocks.length,
  diagramIdCount: diagramIds.length,
  hasImplementationConfirmation: hasConfirmation,
  hasUserConfirmed,
  hasReconfirmRequired,
  hasContractAuthoringRequired,
  hasConfirmationRender,
  hasReconfirmationRequest,
  hasReconfirmationRequiredFlag,
  hasConfirmationHtmlPath,
  hasConfirmationReportPath,
  hasConfirmationHtmlHash,
  hasSequenceViews,
  hasFlowViews,
  hasArtifactAutomationPlan,
  hasTraceRows,
  missingSections,
  missingDiagramCoverage,
  failedChecks,
};

console.log(JSON.stringify(report, null, 2));
process.exit(failedChecks.length === 0 ? 0 : 1);
