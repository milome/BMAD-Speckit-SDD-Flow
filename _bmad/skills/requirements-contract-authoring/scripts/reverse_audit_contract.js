#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {
  asArray,
  buildDefinitionOnlyReport,
  collectDefinitionDrilldownIssues,
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  normalizePathForReport,
  sourceDocumentHashFor,
  stableStringify,
  stringList,
  unique,
} = require('./pre_render_definition_drilldown_lib');
const {
  classifyConfirmationDrift,
  SEMANTIC_RECONFIRMATION_REQUIRED,
  STALE_BOOKKEEPING_REPAIR_REQUIRED,
  PROJECTION_REFRESH_REQUIRED,
} = require('./confirmation_drift_classifier');

const CORE_REPORT_SECTIONS = [
  'implementationConfirmation Findings',
  'HTML Confirmation Findings',
  'Reconfirmation Findings',
  'ID Reference Findings',
  'Diagram And Step Findings',
  'Artifact Automation Plan Findings',
  'traceRows Findings',
  'Row Quality Findings',
  'E2E Anti-Smoke Findings',
  'Open Findings',
];

function usage(exitCode = 0) {
  console.log(`Usage:
  node reverse_audit_contract.js <source-document.md> [options]
  node reverse_audit_contract.js --source <source-document.md> [options]

Options:
  --render-report <path>      Use an explicit confirmation-render-report.json.
  --drilldown-gate-report <path>
                              Use an explicit pre-render MUST decomposition gate report.
  --confirmation-dir <dir>    Discover confirmation-render-report.json in this directory.
  --record-id <id>            Discover report under _bmad-output runtime records.
  --mode <implementation|readiness>
                              In readiness mode, deliveryReadiness.ready=false fails.
  --definition-only           Run only deterministic pre-render definition drilldown.
  --grill-report <path>       Merge a prior grill/definition audit JSON report.
  --json                      Emit JSON output.
  --help                      Show this help.

Reverse audit uses confirmation-render-report.json as the structured renderer authority.
It adds confirmation-state, traceability, anti-smoke, report-shape, and deterministic
definition drilldown checks on top.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    source: '',
    renderReport: '',
    confirmationDir: '',
    recordId: '',
    mode: 'implementation',
    grillReport: '',
    drilldownGateReport: '',
    definitionOnly: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--definition-only') {
      args.definitionOnly = true;
      continue;
    }
    if (arg === '--render-report') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        return { error: 'missing value for --render-report' };
      }
      args.renderReport = next;
      i += 1;
      continue;
    }
    if (arg === '--source') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        return { error: 'missing value for --source' };
      }
      args.source = next;
      i += 1;
      continue;
    }
    if (arg === '--confirmation-dir') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        return { error: 'missing value for --confirmation-dir' };
      }
      args.confirmationDir = next;
      i += 1;
      continue;
    }
    if (arg === '--record-id') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        return { error: 'missing value for --record-id' };
      }
      args.recordId = next;
      i += 1;
      continue;
    }
    if (arg === '--mode') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        return { error: 'missing value for --mode' };
      }
      if (!['implementation', 'readiness'].includes(next)) {
        return { error: '--mode must be implementation or readiness' };
      }
      args.mode = next;
      i += 1;
      continue;
    }
    if (arg === '--grill-report') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        return { error: 'missing value for --grill-report' };
      }
      args.grillReport = next;
      i += 1;
      continue;
    }
    if (arg === '--drilldown-gate-report' || arg === '--must-decomposition-gate-report') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        return { error: `missing value for ${arg}` };
      }
      args.drilldownGateReport = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      return { error: `unknown option ${arg}` };
    }
    if (args.source) {
      return { error: `unexpected positional argument ${arg}` };
    }
    args.source = arg;
  }

  if (!args.source) return { error: 'missing source document path' };
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function issue(code, message, refs = [], severity = 'blocker', source = 'reverse_audit') {
  return { code, message, refs, severity, source };
}

function authoringRepairIssue(sourcePath, message, refs = []) {
  return {
    ...issue(
      'missing_pre_confirmation_semantic_drilldown_gate_report',
      message,
      refs,
      'blocker',
      'pre_confirmation_semantic_drilldown'
    ),
    repairAction: 'run_authoring_repair_preserve_existing',
    repairCommand: `main-agent-orchestration --action authoring-repair --mode preserve-existing --source ${sourcePath || '<source>'} --json`,
  };
}

function reportPathCandidates(sourcePath, confirmation, args) {
  const candidates = [];
  if (args.confirmationDir) {
    candidates.push(path.join(args.confirmationDir, 'confirmation-render-report.json'));
  }
  const configured = confirmation?.confirmationRender?.reportPath;
  if (configured && configured !== 'null') candidates.push(configured);

  const htmlPath = confirmation?.confirmationRender?.htmlPath;
  if (htmlPath && htmlPath !== 'null') {
    candidates.push(path.join(path.dirname(htmlPath), 'confirmation-render-report.json'));
  }

  candidates.push(path.join(path.dirname(sourcePath), 'confirmation-render-report.json'));
  const recordId = args.recordId || confirmation?.recordId;
  if (recordId) {
    candidates.push(
      path.join(
        process.cwd(),
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'confirmation',
        'confirmation-render-report.json'
      )
    );
  }
  return unique(candidates);
}

function resolveRenderReportPath(sourcePath, confirmation, args) {
  const candidates = args.renderReport ? [args.renderReport] : reportPathCandidates(sourcePath, confirmation, args);
  for (const candidate of candidates) {
    const absolute = path.resolve(candidate);
    if (fs.existsSync(absolute)) return absolute;
  }
  return { missing: candidates.map((candidate) => normalizePathForReport(candidate)) };
}

function normalizeRendererIssue(raw) {
  if (!raw || typeof raw !== 'object') {
    return issue('renderer_blocking_issue', String(raw), [], 'blocker', 'renderer');
  }
  return {
    code: raw.code ?? 'renderer_blocking_issue',
    message: raw.message ?? raw.reason ?? raw.code ?? 'renderer blocking issue',
    refs: stringList(raw.refs),
    severity: raw.severity ?? 'blocker',
    source: 'renderer',
    ...(raw.legacyCode ? { legacyCode: raw.legacyCode } : {}),
    ...(raw.repairAction ? { repairAction: raw.repairAction } : {}),
    ...(raw.repairCommand ? { repairCommand: raw.repairCommand } : {}),
  };
}

function collectRenderReportShapeIssues(renderReport) {
  const findings = [];
  const requiredFields = [
    'recordId',
    'requirementSetId',
    'sourcePath',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'confirmationPageHash',
    'actualHtmlFileHash',
    'generatedAt',
    'language',
    'confirmability',
    'deliveryReadiness',
    'blockingIssues',
    'warnings',
    'diagramCoverage',
    'traceCoverage',
    'artifactAutomationCoverage',
    'confirmInstruction',
    'artifactRef',
  ];
  for (const field of requiredFields) {
    if (renderReport?.[field] === undefined || renderReport?.[field] === null || renderReport?.[field] === '') {
      findings.push(
        issue('render_report_missing_required_field', `render report lacks required field ${field}`, [field], 'blocker', 'renderer')
      );
    }
  }
  if (renderReport && !Array.isArray(renderReport.blockingIssues)) {
    findings.push(issue('render_report_blocking_issues_not_array', 'render report blockingIssues must be an array', ['blockingIssues'], 'blocker', 'renderer'));
  }
  if (renderReport && !Array.isArray(renderReport.warnings)) {
    findings.push(issue('render_report_warnings_not_array', 'render report warnings must be an array', ['warnings'], 'blocker', 'renderer'));
  }
  if (renderReport?.deliveryReadiness && typeof renderReport.deliveryReadiness.ready !== 'boolean') {
    findings.push(issue('render_report_delivery_readiness_shape', 'deliveryReadiness.ready must be boolean', ['deliveryReadiness.ready'], 'blocker', 'renderer'));
  }
  return findings;
}

function collectRendererIssues(renderReport) {
  const findings = [];
  if (!renderReport || typeof renderReport !== 'object') {
    findings.push(issue('render_report_invalid', 'confirmation-render-report.json is not a JSON object'));
    return findings;
  }
  if (renderReport.confirmability !== 'confirmable') {
    findings.push(
      issue(
        'render_report_not_confirmable',
        `render report confirmability is ${renderReport.confirmability ?? 'missing'}`,
        ['confirmability'],
        'blocker',
        'renderer'
      )
    );
  }
  for (const item of asArray(renderReport.blockingIssues)) {
    findings.push(normalizeRendererIssue(item));
  }
  return findings;
}

function collectReportIntegrityIssues({ sourcePath, sourceText, blockText, confirmation, renderReport, renderReportPath }) {
  const findings = [];
  const currentSourceHash = sourceDocumentHashFor(sourceText, blockText, confirmation);
  const currentImplementationHash = implementationConfirmationHashFor(confirmation);
  const reportSourcePath = renderReport?.sourcePath ? path.resolve(renderReport.sourcePath) : '';
  const currentSourcePath = path.resolve(sourcePath);
  const confirmInstruction = String(renderReport?.confirmInstruction ?? '');

  if (!renderReportPath || typeof renderReportPath !== 'string') {
    findings.push(issue('missing_confirmation_render_report', 'confirmation-render-report.json was not found'));
  }
  if (renderReport?.sourceDocumentHash !== currentSourceHash) {
    findings.push(
      issue('render_report_source_hash_mismatch', 'render report sourceDocumentHash does not match current source document', [
        'sourceDocumentHash',
      ])
    );
  }
  if (renderReport?.implementationConfirmationHash !== currentImplementationHash) {
    findings.push(
      issue(
        'render_report_implementation_hash_mismatch',
        'render report implementationConfirmationHash does not match current implementationConfirmation',
        ['implementationConfirmationHash']
      )
    );
  }
  if (reportSourcePath && reportSourcePath !== currentSourcePath) {
    findings.push(
      issue('render_report_source_path_mismatch', 'render report sourcePath does not match audited source document', [
        renderReport.sourcePath,
      ])
    );
  }
  if (!renderReport?.confirmationPageHash) {
    findings.push(issue('render_report_missing_confirmation_page_hash', 'render report lacks confirmationPageHash'));
  }
  if (!renderReport?.confirmInstruction) {
    findings.push(issue('render_report_missing_confirm_instruction', 'render report lacks confirmInstruction'));
  } else {
    for (const [field, value] of [
      ['sourceDocumentHash', renderReport?.sourceDocumentHash],
      ['implementationConfirmationHash', renderReport?.implementationConfirmationHash],
      ['confirmationPageHash', renderReport?.confirmationPageHash],
    ]) {
      if (value && !confirmInstruction.includes(`${field}=${value}`)) {
        findings.push(
          issue(
            'render_report_confirm_instruction_hash_mismatch',
            `confirmInstruction does not contain current ${field}`,
            [field],
            'blocker',
            'renderer'
          )
        );
      }
    }
  }
  const artifactHash = renderReport?.artifactRef?.hash;
  if (artifactHash && renderReport?.confirmationPageHash && artifactHash !== renderReport.confirmationPageHash) {
    findings.push(
      issue('render_report_artifact_hash_mismatch', 'artifactRef.hash must match confirmationPageHash', [
        'artifactRef.hash',
        'confirmationPageHash',
      ])
    );
  }
  return {
    findings,
    currentSourceHash,
    currentImplementationHash,
  };
}

function collectConfirmationStateIssues(confirmation, currentHashes) {
  const findings = [];
  if (confirmation.status !== 'user_confirmed') {
    findings.push(
      issue(
        'confirmation_not_user_confirmed',
        `implementationConfirmation.status must be user_confirmed before readiness; actual=${confirmation.status ?? 'missing'}`,
        ['implementationConfirmation.status']
      )
    );
  }
  if (confirmation.contractAuthoringRequired !== true) {
    findings.push(
      issue('contract_authoring_not_required', 'contractAuthoringRequired must be true', [
        'implementationConfirmation.contractAuthoringRequired',
      ])
    );
  }
  if (confirmation.status === 'user_confirmed') {
    if (!confirmation.sourceDocumentHash || confirmation.sourceDocumentHash === 'null') {
      findings.push(issue('missing_confirmed_source_document_hash', 'user_confirmed source must record sourceDocumentHash'));
    } else if (confirmation.sourceDocumentHash !== currentHashes.sourceDocumentHash) {
      findings.push(
        issue('confirmed_source_hash_stale', 'user_confirmed sourceDocumentHash does not match current source hash', [
          'implementationConfirmation.sourceDocumentHash',
        ])
      );
    }
    if (!confirmation.implementationConfirmationHash || confirmation.implementationConfirmationHash === 'null') {
      findings.push(
        issue('missing_confirmed_implementation_hash', 'user_confirmed source must record implementationConfirmationHash')
      );
    } else if (confirmation.implementationConfirmationHash !== currentHashes.implementationConfirmationHash) {
      findings.push(
        issue(
          'confirmed_implementation_hash_stale',
          'user_confirmed implementationConfirmationHash does not match current implementationConfirmation hash',
          ['implementationConfirmation.implementationConfirmationHash']
        )
      );
    }
  }
  for (const question of asArray(confirmation.openQuestions)) {
    if (question?.blocksImplementation === true) {
      findings.push(
        issue('blocking_open_question', `${question.id ?? 'Q-UNKNOWN'} blocks implementation`, [
          question.id ?? 'openQuestions',
        ])
      );
    }
  }
  if (!confirmation.confirmationRender || typeof confirmation.confirmationRender !== 'object') {
    findings.push(issue('missing_confirmation_render', 'implementationConfirmation.confirmationRender is required'));
    return findings;
  }
  for (const [field, code] of [
    ['htmlPath', 'missing_confirmation_html_path'],
    ['summaryPath', 'missing_confirmation_summary_path'],
    ['reportPath', 'missing_confirmation_render_report_path'],
    ['htmlHash', 'missing_confirmation_html_hash'],
    ['confirmationPhrase', 'missing_confirmation_phrase'],
  ]) {
    if (!confirmation.confirmationRender[field] || confirmation.confirmationRender[field] === 'null') {
      findings.push(issue(code, `confirmationRender.${field} is required`, [`confirmationRender.${field}`]));
    }
  }
  return findings;
}

function collectReconfirmationRequestIssues(text, confirmation, currentHashes, driftClassification, renderReport) {
  const findings = [];
  if (driftClassification?.kind === STALE_BOOKKEEPING_REPAIR_REQUIRED) {
    findings.push(
      issue(
        'stale_bookkeeping_repair_required',
        'source confirmation bookkeeping is stale but semantic hashes match the latest controlled confirmation',
        driftClassification.repairableReasons ?? [],
        'warning',
        'reverse_audit'
      )
    );
    return findings;
  }
  if (driftClassification?.kind === PROJECTION_REFRESH_REQUIRED) {
    findings.push(
      issue(
        'confirmation_projection_refresh_required',
        'confirmation projection hash changed without semantic hash drift',
        driftClassification.repairableReasons ?? [],
        'warning',
        'reverse_audit'
      )
    );
    return findings;
  }
  if (driftClassification?.kind !== SEMANTIC_RECONFIRMATION_REQUIRED) {
    return findings;
  }
  const request = confirmation.reconfirmationRequest;
  if (!request || typeof request !== 'object') {
    findings.push(issue('missing_reconfirmation_request', 'semantic drift requires reconfirmationRequest'));
    return findings;
  }
  if (request.required !== true) {
    findings.push(issue('missing_reconfirmation_required_flag', 'reconfirmationRequest.required must be true'));
  }
  for (const [field, code] of [
    ['reasonCode', 'missing_reconfirmation_reason_code'],
    ['userFacingSummary', 'missing_reconfirmation_user_facing_summary'],
  ]) {
    if (!request[field] || request[field] === 'null') {
      findings.push(issue(code, `reconfirmationRequest.${field} is required`, [`reconfirmationRequest.${field}`]));
    }
  }
  const rationale = request.persuasiveRationale && typeof request.persuasiveRationale === 'object'
    ? request.persuasiveRationale
    : {};
  for (const field of ['whyReconfirmNow', 'riskIfSkipped', 'whyEvidenceIsSufficient']) {
    if (!rationale[field] || rationale[field] === 'null') {
      findings.push(
        issue(
          `missing_reconfirmation_${field}`,
          `reconfirmationRequest.persuasiveRationale.${field} is required`,
          [`reconfirmationRequest.persuasiveRationale.${field}`]
        )
      );
    }
  }
  const evidenceBundle = request.evidenceBundle && typeof request.evidenceBundle === 'object'
    ? request.evidenceBundle
    : {};
  if (evidenceBundle.sufficiencyVerdict !== 'sufficient') {
    findings.push(
      issue(
        'reconfirmation_evidence_not_sufficient',
        'reconfirmationRequest.evidenceBundle.sufficiencyVerdict must be sufficient',
        ['reconfirmationRequest.evidenceBundle.sufficiencyVerdict']
      )
    );
  }
  if (!Array.isArray(evidenceBundle.items) || evidenceBundle.items.length === 0) {
    findings.push(
      issue(
        'missing_reconfirmation_evidence_items',
        'reconfirmationRequest.evidenceBundle.items[] is required',
        ['reconfirmationRequest.evidenceBundle.items']
      )
    );
  }
  for (const [field, code] of [
    ['previousSourceDocumentHash', 'missing_reconfirmation_previous_source_hash'],
    ['currentSourceDocumentHash', 'missing_reconfirmation_current_source_hash'],
    ['previousImplementationConfirmationHash', 'missing_reconfirmation_previous_implementation_hash'],
    ['currentImplementationConfirmationHash', 'missing_reconfirmation_current_implementation_hash'],
  ]) {
    if (!request[field] || request[field] === 'null') {
      findings.push(issue(code, `reconfirmationRequest.${field} is required`, [`reconfirmationRequest.${field}`]));
    }
  }
  if (request.currentSourceDocumentHash && request.currentSourceDocumentHash !== currentHashes.sourceDocumentHash) {
    findings.push(issue('reconfirmation_current_source_hash_stale', 'reconfirmationRequest currentSourceDocumentHash is stale'));
  }
  if (
    request.currentImplementationConfirmationHash &&
    request.currentImplementationConfirmationHash !== currentHashes.implementationConfirmationHash
  ) {
    findings.push(
      issue('reconfirmation_current_implementation_hash_stale', 'reconfirmationRequest currentImplementationConfirmationHash is stale')
    );
  }
  if (!request.diffSummary || typeof request.diffSummary !== 'object') {
    findings.push(issue('missing_reconfirmation_diff_summary', 'reconfirmationRequest.diffSummary is required'));
  }
  if (!Array.isArray(request.impactedIds) || request.impactedIds.length === 0) {
    findings.push(issue('missing_reconfirmation_impacted_ids', 'reconfirmationRequest.impactedIds must be non-empty'));
  }
  if (!Array.isArray(request.allowedUserActions) || request.allowedUserActions.length === 0) {
    findings.push(issue('missing_reconfirmation_allowed_actions', 'reconfirmationRequest.allowedUserActions must be non-empty'));
  }
  const sectionOrder = Array.isArray(renderReport?.renderedSectionOrder)
    ? renderReport.renderedSectionOrder
    : [];
  if (sectionOrder.length) {
    const reconfirmationIndex = sectionOrder.indexOf('reconfirmation-request');
    const coreDesignIndex = sectionOrder.indexOf('core-design');
    if (reconfirmationIndex < 0 || coreDesignIndex < 0 || reconfirmationIndex > coreDesignIndex) {
      findings.push(
        issue(
          'reconfirmation_request_not_before_core_design',
          'reconfirmation-request must be rendered before core-design',
          ['renderedSectionOrder']
        )
      );
    }
  } else {
    findings.push(
      issue(
        'missing_rendered_section_order',
        'render report must include renderedSectionOrder[] for reconfirmation placement audit',
        ['renderedSectionOrder']
      )
    );
  }
  if (/(?:manually|manual|手工|手动).{0,60}(?:sourceDocumentHash|implementationConfirmationHash|confirmationPageHash|confirmationHistory|status)/iu.test(text)) {
    findings.push(
      issue('manual_hash_or_confirmation_state_edit_instruction', 'source must not instruct users to hand-edit hashes, status, or confirmationHistory')
    );
  }
  return findings;
}

function collectConfirmationRenderBookkeepingIssues(confirmation, renderReportPath, renderReport) {
  const findings = [];
  const render = confirmation?.confirmationRender;
  if (!render || typeof render !== 'object') return findings;

  if (renderReportPath && render.reportPath && render.reportPath !== 'null') {
    const configured = path.resolve(render.reportPath);
    if (configured !== path.resolve(renderReportPath)) {
      findings.push(
        issue('confirmation_render_report_path_mismatch', 'confirmationRender.reportPath does not point to the consumed render report', [
          'confirmationRender.reportPath',
        ])
      );
    }
  }

  if (renderReport?.confirmationPageHash && render.htmlHash && render.htmlHash !== 'null' && render.htmlHash !== renderReport.confirmationPageHash) {
    findings.push(
      issue('confirmation_render_html_hash_mismatch', 'confirmationRender.htmlHash does not match render report confirmationPageHash', [
        'confirmationRender.htmlHash',
        'confirmationPageHash',
      ])
    );
  }

  const normalizeConfirmationPhrase = (value) =>
    String(value ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\s+$/u, '');
  if (
    renderReport?.confirmInstruction &&
    render.confirmationPhrase &&
    render.confirmationPhrase !== 'null' &&
    normalizeConfirmationPhrase(render.confirmationPhrase) !== normalizeConfirmationPhrase(renderReport.confirmInstruction)
  ) {
    findings.push(
      issue('confirmation_render_phrase_mismatch', 'confirmationRender.confirmationPhrase does not match render report confirmInstruction', [
        'confirmationRender.confirmationPhrase',
        'confirmInstruction',
      ])
    );
  }

  return findings;
}

function collectReportShapeIssues(text) {
  const findings = [];
  const missingSections = ['implementationConfirmation', 'Reverse Audit Report', 'Definition of Done'].filter(
    (section) => !text.includes(section)
  );
  if (missingSections.length) {
    findings.push(
      issue('missing_required_sections', `required sections missing: ${missingSections.join(', ')}`, missingSections)
    );
  }

  const hasReverseVerdict = /##\s+(?:\d+\.\s+)?Reverse Audit Report[\s\S]*?Verdict:\s*(PASS|FAIL)/u.test(text);
  if (!hasReverseVerdict) {
    findings.push(issue('missing_reverse_audit_verdict', 'Reverse Audit Report must include Verdict: PASS|FAIL'));
  }

  const reverseAuditText = /###\s+Reverse Audit Report([\s\S]*?)(?:\n###\s+Definition of Done|\n##\s+Definition of Done|\n#\s+)/u.exec(text)?.[1] ?? text;
  const equivalentSectionGroups = new Map([
    ['implementationConfirmation Findings', ['implementationConfirmation Findings', 'Source confirmation readiness']],
    ['HTML Confirmation Findings', ['HTML Confirmation Findings', 'confirmation HTML renderer', 'confirmation page language']],
    ['Reconfirmation Findings', ['Reconfirmation Findings', 'reconfirmation']],
    ['ID Reference Findings', ['ID Reference Findings', 'declared IDs', 'traceRows']],
    ['Diagram And Step Findings', ['Diagram And Step Findings', 'Mermaid diagrams']],
    ['Artifact Automation Plan Findings', ['Artifact Automation Plan Findings', 'Artifact Automation Plan View', 'artifact automation plan', 'artifact plan separates control records']],
    ['traceRows Findings', ['traceRows Findings', 'traceRows']],
    ['Row Quality Findings', ['Row Quality Findings', 'current_pass']],
    ['E2E Anti-Smoke Findings', ['E2E Anti-Smoke Findings', 'Smoke-only']],
    ['Open Findings', ['Open Findings', 'Implementation readiness']],
  ]);
  const hasEquivalentSection = (section) => {
    const terms = equivalentSectionGroups.get(section) ?? [section];
    return terms.some((term) => reverseAuditText.includes(term) || text.includes(term));
  };
  const missingReportSections = CORE_REPORT_SECTIONS.filter((section) => !hasEquivalentSection(section));
  if (missingReportSections.length) {
    findings.push(
      issue(
        'missing_reverse_audit_report_shape',
        `Reverse Audit Report sections missing: ${missingReportSections.join(', ')}`,
        missingReportSections
      )
    );
  }
  return findings;
}

function collectTraceabilityIssues(text, confirmation) {
  const findings = [];
  const mermaidBlocks = [...text.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((match) => match[1]);
  const nonDiagramText = text.replace(/```mermaid\r?\n[\s\S]*?```/g, '\n');
  const diagramIdPattern = /\b(?:MUST|NEG|OUT|EVD|TRACE|ACC|E2E|Q|MAIN|FAIL|IDEMP|REC|CONC|STATE|INV)-[A-Z0-9_.:-]+\b/g;
  const confirmationIdPattern = /\b(?:MUST|NEG|OUT|EVD|TRACE|ACC|E2E|Q)-[A-Za-z0-9_.:-]+\b/g;
  const diagramIds = unique(
    mermaidBlocks.flatMap((block) => [...block.matchAll(diagramIdPattern)].map((match) => match[0]))
  ).sort();
  const coveredIds = new Set([...nonDiagramText.matchAll(diagramIdPattern)].map((match) => match[0]));
  addRangeCoverage(nonDiagramText, coveredIds);
  const missingDiagramCoverage = diagramIds.filter((id) => !coveredIds.has(id));
  const confirmationIds = new Set([...text.matchAll(confirmationIdPattern)].map((match) => match[0]));
  const hasReferenceIds =
    confirmationIds.has('MUST-001') ||
    confirmationIds.has('NEG-001') ||
    [...confirmationIds].some((id) => id.startsWith('MUST-') || id.startsWith('NEG-'));

  if (!hasReferenceIds) findings.push(issue('missing_confirmation_ids', 'source has no MUST/NEG confirmation IDs'));
  if (mermaidBlocks.length > 0 && diagramIds.length === 0) {
    findings.push(issue('no_numbered_diagram_ids', 'Mermaid diagrams exist but do not reference numbered IDs'));
  }
  if (missingDiagramCoverage.length > 0) {
    findings.push(
      issue('missing_diagram_id_coverage', 'diagram IDs are not covered in non-diagram source text', missingDiagramCoverage)
    );
  }

  const mustIds = new Set(asArray(confirmation.must).map((item) => item.id));
  const negIds = new Set(asArray(confirmation.notDone).map((item) => item.id));
  const evidenceIds = new Set(asArray(confirmation.evidence).map((item) => item.id));
  const traceIds = new Set(asArray(confirmation.traceRows).map((row) => row.id));
  const acceptanceRows = normalizeAcceptanceSuites(confirmation);
  const acceptanceIds = new Set(acceptanceRows.map((row) => row.id));
  const commandIds = new Set([
    ...asArray(confirmation.requiredCommands).map((item) => item.id ?? item.commandId).filter(Boolean),
    ...asArray(confirmation.suggestedCommands).map((item) => item.id ?? item.commandId).filter(Boolean),
  ]);
  const allowedCoverIds = new Set([...mustIds, ...negIds]);
  const allConfirmationIds = new Set([
    ...mustIds,
    ...negIds,
    ...asArray(confirmation.mustNot).map((item) => item.id),
    ...evidenceIds,
    ...traceIds,
    ...acceptanceIds,
  ]);

  const knownTraceRows = new Set(asArray(confirmation.traceRows).map((row) => row.id));
  for (const row of asArray(confirmation.traceRows)) {
    const rowId = row.id ?? 'TRACE-UNKNOWN';
    if (!row.id) findings.push(issue('trace_row_missing_id', 'traceRows[] item is missing id'));
    const covers = stringList(row.covers);
    for (const coverId of covers) {
      if (!allowedCoverIds.has(coverId)) {
        findings.push(
          issue('trace_row_unknown_cover_ref', `${rowId} covers unknown or non-executable requirement ${coverId}`, [
            rowId,
            coverId,
          ])
        );
      }
    }
    for (const evidenceId of stringList(row.evidenceRefs)) {
      if (!evidenceIds.has(evidenceId)) {
        findings.push(issue('trace_row_unknown_evidence_ref', `${rowId} references unknown evidence ${evidenceId}`, [rowId, evidenceId]));
      }
    }
    for (const acceptanceId of stringList(row.acceptanceRefs)) {
      if (!acceptanceIds.has(acceptanceId)) {
        findings.push(issue('trace_row_unknown_acceptance_ref', `${rowId} references unknown acceptance/e2e row ${acceptanceId}`, [rowId, acceptanceId]));
      }
    }
    for (const taskRef of stringList(row.taskRefs)) {
      if (/^(?:MUST|NEG|OUT|EVD|TRACE)-/u.test(taskRef) && !allConfirmationIds.has(taskRef)) {
        findings.push(issue('trace_row_unknown_task_contract_ref', `${rowId} taskRefs includes unknown contract ID ${taskRef}`, [rowId, taskRef]));
      }
    }
    for (const traceRef of stringList(row.sequenceViewRefs ?? row.diagramRefs)) {
      if (/^TRACE-/u.test(traceRef) && !knownTraceRows.has(traceRef)) {
        findings.push(issue('trace_row_unknown_trace_ref', `${rowId} references unknown ${traceRef}`));
      }
    }
  }

  for (const id of [...mustIds, ...negIds]) {
    if (!acceptanceRows.some((row) => row.covers.includes(id))) {
      findings.push(issue('requirement_missing_acceptance_or_e2e_coverage', `${id} has no ACC/E2E coverage`, [id]));
    }
  }

  for (const row of acceptanceRows) {
    if (!/^(ACC|E2E)-/u.test(row.id)) {
      findings.push(issue('acceptance_invalid_id', `${row.id} must start with ACC- or E2E-`, [row.id]));
    }
    if (!row.files.length) {
      findings.push(issue('acceptance_missing_file', `${row.id} must declare file/files`, [row.id]));
    }
    for (const file of row.files) {
      const absolute = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
      if (!fs.existsSync(absolute)) {
        findings.push(issue('acceptance_test_file_missing', `${row.id} references missing file ${file}`, [row.id, file]));
      }
    }
    for (const cover of row.covers) {
      if (!allowedCoverIds.has(cover)) {
        findings.push(issue('acceptance_unknown_requirement_ref', `${row.id} covers unknown ${cover}`, [row.id, cover]));
      }
    }
    for (const traceId of row.traceRows) {
      if (!traceIds.has(traceId)) findings.push(issue('acceptance_unknown_trace_ref', `${row.id} references unknown ${traceId}`, [row.id, traceId]));
    }
    for (const evidenceId of row.evidenceRefs) {
      if (!evidenceIds.has(evidenceId)) findings.push(issue('acceptance_unknown_evidence_ref', `${row.id} references unknown ${evidenceId}`, [row.id, evidenceId]));
    }
    for (const commandId of row.commandRefs) {
      if (!commandIds.has(commandId)) findings.push(issue('acceptance_unknown_command_ref', `${row.id} references unknown ${commandId}`, [row.id, commandId]));
    }
    if (!row.oracle) findings.push(issue('acceptance_missing_oracle', `${row.id} lacks oracle`, [row.id]));
    if (row.mockOnly) findings.push(issue('acceptance_mock_only_invalid', `${row.id} is mock-only`, [row.id]));
  }

  return {
    findings,
    diagramBlockCount: mermaidBlocks.length,
    diagramIdCount: diagramIds.length,
    missingDiagramCoverage,
  };
}

function normalizeAcceptanceSuites(confirmation) {
  const sections = [
    ['acceptanceTests', 'acceptance', 'ACC'],
    ['acceptanceTestSuites', 'acceptance', 'ACC'],
    ['integrationTests', 'integration', 'ACC'],
    ['contractTests', 'contract', 'ACC'],
    ['e2eSuites', 'e2e', 'E2E'],
    ['e2eTests', 'e2e', 'E2E'],
  ];
  const rows = [];
  for (const [section, suiteType, prefix] of sections) {
    asArray(confirmation?.[section]).forEach((item, index) => {
      rows.push({
        id: String(item?.id ?? item?.testId ?? `${prefix}-${String(index + 1).padStart(3, '0')}`).trim(),
        suiteType: String(item?.suiteType ?? item?.kind ?? suiteType),
        files: unique([
          String(item?.file ?? item?.path ?? item?.testFile ?? item?.testPath ?? '').trim(),
          ...stringList(item?.files),
          ...stringList(item?.testFiles),
        ]).filter(Boolean),
        covers: unique([
          ...stringList(item?.covers),
          ...stringList(item?.requirementRefs),
          ...stringList(item?.linkedRequirementIds),
          ...stringList(item?.mustRefs),
          ...stringList(item?.negRefs),
        ]),
        traceRows: unique([...stringList(item?.traceRows), ...stringList(item?.traceRefs)]),
        evidenceRefs: unique([...stringList(item?.evidenceRefs), ...stringList(item?.linkedEvidenceIds)]),
        commandRefs: unique([
          ...stringList(item?.commandRefs),
          ...stringList(item?.requiredCommandRefs),
          ...stringList(item?.requiredCommandIds),
        ]),
        oracle: String(item?.oracle ?? item?.expectedBehavior ?? item?.assertion ?? '').trim(),
        mockOnly: item?.mockOnly === true,
      });
    });
  }
  return rows.filter((row) => row.id);
}

function addRangeCoverage(body, covered) {
  const prefixes = 'MUST|NEG|OUT|EVD|TRACE|Q|MAIN|FAIL|IDEMP|REC|CONC|STATE|INV';
  const fullRange = new RegExp(`\\b((?:${prefixes})-[A-Z]?)(\\d+)\\.\\.((?:${prefixes})-[A-Z]?)(\\d+)\\b`, 'g');
  for (const match of body.matchAll(fullRange)) {
    const [, startStem, startRaw, endStem, endRaw] = match;
    if (startStem !== endStem) continue;
    const start = Number(startRaw);
    const end = Number(endRaw);
    for (let value = Math.min(start, end); value <= Math.max(start, end); value += 1) {
      covered.add(`${startStem}${value}`);
    }
  }
}

function collectAntiSmokeIssues(text, confirmation) {
  const findings = [];
  const hasSmokeOnlyWarning =
    /Must Not Count As|must not count|cannot satisfy|cannot substitute|cannot count|不能算作|不得算作|不计为完成|不能满足|不能替代/u.test(text) &&
    /exit code only|exit code|stdout|HTTP 200|page render|mock calls?|command exit code|smoke-only proof|smoke-level acceptance|仅退出码|标准输出|页面渲染|mock/u.test(text);
  if (!hasSmokeOnlyWarning) {
    findings.push(
      issue(
        'missing_e2e_anti_smoke_assertion',
        'source must explicitly reject smoke-only evidence such as exit code, stdout, HTTP 200, page render, or mock calls'
      )
    );
  }

  for (const evidence of asArray(confirmation.evidence)) {
    const oracle = String(evidence.oracle ?? '').trim();
    const gate = String(evidence.gate ?? '').trim();
    if (!oracle) {
      findings.push(issue('evidence_missing_independent_oracle', `${evidence.id ?? 'EVD-UNKNOWN'} lacks oracle`));
    }
    if (/^(exit code|stdout|http 200|page render|mock calls?)$/iu.test(oracle)) {
      findings.push(
        issue('evidence_oracle_smoke_only', `${evidence.id ?? 'EVD-UNKNOWN'} uses a smoke-only oracle`, [
          evidence.id ?? 'EVD-UNKNOWN',
        ])
      );
    }
    if (!gate) {
      findings.push(issue('evidence_missing_gate', `${evidence.id ?? 'EVD-UNKNOWN'} lacks gate command or manual proof`));
    }
  }
  for (const row of normalizeAcceptanceSuites(confirmation)) {
    if (/^(exit code|stdout|http 200|page render|mock calls?)$/iu.test(row.oracle)) {
      findings.push(issue('acceptance_oracle_smoke_only', `${row.id} uses a smoke-only oracle`, [row.id]));
    }
  }
  return findings;
}

function collectReadinessModeIssues(renderReport, mode) {
  if (mode !== 'readiness') return [];
  if (renderReport?.deliveryReadiness?.ready === true) return [];
  return [
    issue(
      'delivery_readiness_not_ready',
      `deliveryReadiness.ready must be true in readiness mode; status=${renderReport?.deliveryReadiness?.status ?? 'missing'}`,
      ['deliveryReadiness'],
      'blocker',
      'renderer'
    ),
  ];
}

function collectPreConfirmationSemanticDrilldownIssues(args, renderReport, hashes) {
  const embedded = renderReport?.preConfirmationSemanticDrilldown ?? null;
  const reportPath = args.drilldownGateReport || embedded?.reportPath || '';
  const findings = [];
  if (!reportPath) {
    findings.push(
      authoringRepairIssue(
        args.source,
        'pre-render MUST decomposition gate report is required for contract confirmability audit',
        ['preConfirmationSemanticDrilldown']
      )
    );
    return { summary: { status: 'missing', reportPath: null }, findings };
  }
  let report = args.drilldownGateReport ? null : embedded?.report ?? null;
  try {
    if (!report && fs.existsSync(path.resolve(reportPath))) report = readJson(path.resolve(reportPath));
  } catch (error) {
    findings.push(
      issue(
        'pre_confirmation_semantic_drilldown_gate_report_parse_failed',
        error instanceof Error ? error.message : String(error),
        [reportPath],
        'blocker',
        'pre_confirmation_semantic_drilldown'
      )
    );
  }
  if (!report) {
    findings.push(
      authoringRepairIssue(
        args.source,
        'pre-render MUST decomposition gate report path does not exist',
        [reportPath]
      )
    );
    return { summary: { status: 'missing', reportPath: normalizePathForReport(reportPath) }, findings };
  }
  if (report.sourceDocumentHash !== hashes.currentSourceHash) {
    findings.push(
      issue(
        'pre_confirmation_semantic_drilldown_gate_source_hash_stale',
        'drilldown gate sourceDocumentHash does not match current source',
        ['sourceDocumentHash'],
        'blocker',
        'pre_confirmation_semantic_drilldown'
      )
    );
  }
  if (report.implementationConfirmationHash !== hashes.currentImplementationHash) {
    findings.push(
      issue(
        'pre_confirmation_semantic_drilldown_gate_implementation_hash_stale',
        'drilldown gate implementationConfirmationHash does not match current source',
        ['implementationConfirmationHash'],
        'blocker',
        'pre_confirmation_semantic_drilldown'
      )
    );
  }
  if (report.verdict !== 'PASS' || report.confirmability === 'blocked') {
    const failedChecks = asArray(report.failedChecks);
    if (!failedChecks.length) {
      findings.push(
        issue(
          'pre_confirmation_semantic_drilldown_gate_failed',
          'drilldown gate verdict is not PASS',
          [reportPath],
          'blocker',
          'pre_confirmation_semantic_drilldown'
        )
      );
    }
    for (const code of failedChecks) {
      findings.push(
        issue(
          `pre_confirmation_semantic_drilldown_${code}`,
          `drilldown gate failed: ${code}`,
          [code],
          'blocker',
          'pre_confirmation_semantic_drilldown'
        )
      );
    }
  }
  if ((report.criticalAuditor?.consecutiveNoNewGapRounds ?? 0) < 3) {
    findings.push(
      issue(
        'missing_critic_convergence',
        'Critical Auditor convergence must have three consecutive no-new-gap rounds',
        ['criticalAuditor.consecutiveNoNewGapRounds'],
        'blocker',
        'pre_confirmation_semantic_drilldown'
      )
    );
  }
  if (report.packetSourceReconciliation?.verdict !== 'pass') {
    findings.push(
      issue(
        'missing_packet_source_reconciliation',
        'packet/source reconciliation must pass before contract confirmability',
        ['packetSourceReconciliation.verdict'],
        'blocker',
        'pre_confirmation_semantic_drilldown'
      )
    );
  }
  if (!asArray(renderReport?.renderedSections).includes('pre-confirmation-semantic-drilldown')) {
    findings.push(
      issue(
        'renderer_missing_pre_confirmation_drilldown_sections',
        'renderer did not show the pre-confirmation semantic drilldown sections',
        ['renderedSections'],
        'blocker',
        'pre_confirmation_semantic_drilldown'
      )
    );
  }
  return {
    summary: {
      status: findings.length ? 'blocked' : 'pass',
      reportPath: normalizePathForReport(reportPath),
      verdict: report.verdict ?? null,
      failedChecks: report.failedChecks ?? [],
    },
    findings,
  };
}

function collectGrillReportIssues(grillReportPath, currentHashes) {
  if (!grillReportPath) {
    return {
      summary: null,
      findings: [],
    };
  }
  const absolute = path.resolve(grillReportPath);
  if (!fs.existsSync(absolute)) {
    return {
      summary: { path: normalizePathForReport(absolute), status: 'missing' },
      findings: [
        issue('grill_report_missing', 'grill definition audit report not found', [normalizePathForReport(absolute)]),
      ],
    };
  }
  let report;
  try {
    report = readJson(absolute);
  } catch (error) {
    return {
      summary: { path: normalizePathForReport(absolute), status: 'parse_failed' },
      findings: [
        issue(
          'grill_report_parse_failed',
          error instanceof Error ? error.message : String(error),
          [normalizePathForReport(absolute)]
        ),
      ],
    };
  }
  const hashFindings = [];
  if (!report.sourceDocumentHash) {
    hashFindings.push(
      issue('grill_report_missing_source_hash', 'grill definition audit report must include sourceDocumentHash', [
        'sourceDocumentHash',
      ])
    );
  } else if (currentHashes?.sourceDocumentHash && report.sourceDocumentHash !== currentHashes.sourceDocumentHash) {
    hashFindings.push(
      issue('grill_report_source_hash_stale', 'grill definition audit report sourceDocumentHash is stale', [
        'sourceDocumentHash',
      ])
    );
  }
  if (!report.implementationConfirmationHash) {
    hashFindings.push(
      issue(
        'grill_report_missing_implementation_hash',
        'grill definition audit report must include implementationConfirmationHash',
        ['implementationConfirmationHash']
      )
    );
  } else if (
    currentHashes?.implementationConfirmationHash &&
    report.implementationConfirmationHash !== currentHashes.implementationConfirmationHash
  ) {
    hashFindings.push(
      issue(
        'grill_report_implementation_hash_stale',
        'grill definition audit report implementationConfirmationHash is stale',
        ['implementationConfirmationHash']
      )
    );
  }
  const openBlockingFindings = asArray(report.findings).filter((item) => {
    const severity = String(item?.severity ?? '').toLowerCase();
    const status = String(item?.status ?? 'open').toLowerCase();
    return ['blocking', 'blocker'].includes(severity) && status !== 'resolved';
  });
  return {
    summary: {
      path: normalizePathForReport(absolute),
      status: report.status ?? report.verdict ?? 'unknown',
      sourceDocumentHash: report.sourceDocumentHash ?? null,
      implementationConfirmationHash: report.implementationConfirmationHash ?? null,
      hashStatus: hashFindings.length ? 'stale_or_incomplete' : 'current',
      openBlockingCount: openBlockingFindings.length,
      findingCount: asArray(report.findings).length,
    },
    findings: [
      ...hashFindings,
      ...openBlockingFindings.map((item) =>
        issue(
          item.code ?? 'grill_open_blocking_finding',
          item.summary ?? item.message ?? 'open blocking grill finding',
          stringList(item.requirementIds ?? item.refs ?? item.docRefs),
          'blocker',
          'grill_definition_audit'
        )
      ),
    ],
  };
}


function buildReport({
  target,
  renderReportPath,
  mode,
  grillReportSummary,
  text,
  confirmation,
  renderReport,
  integrity,
  traceability,
  definitionDrilldown,
  preConfirmationSemanticDrilldown,
  findings,
}) {
  const blockerFindings = findings.filter((item) => item.severity !== 'warning');
  const warningFindings = findings.filter((item) => item.severity === 'warning');
  return {
    verdict: blockerFindings.length === 0 ? 'PASS' : 'FAIL',
    target: normalizePathForReport(target),
    renderReportPath: renderReportPath ? normalizePathForReport(renderReportPath) : null,
    mode,
    rendererAuthority: {
      confirmability: renderReport?.confirmability ?? null,
      blockingIssueCount: asArray(renderReport?.blockingIssues).length,
      deliveryReadiness: renderReport?.deliveryReadiness ?? null,
    },
    grillReport: grillReportSummary,
    currentHashes: {
      sourceDocumentHash: integrity.currentSourceHash,
      implementationConfirmationHash: integrity.currentImplementationHash,
      reportSourceDocumentHash: renderReport?.sourceDocumentHash ?? null,
      reportImplementationConfirmationHash: renderReport?.implementationConfirmationHash ?? null,
      reportConfirmationPageHash: renderReport?.confirmationPageHash ?? null,
    },
    reverseAuditChecks: {
      hasImplementationConfirmation: Boolean(confirmation),
      hasUserConfirmed: confirmation?.status === 'user_confirmed',
      hasContractAuthoringRequired: confirmation?.contractAuthoringRequired === true,
      hasConfirmationRender: Boolean(confirmation?.confirmationRender),
      hasReverseAuditReport: /##\s+(?:\d+\.\s+)?Reverse Audit Report/u.test(text),
      hasDefinitionOfDone: text.includes('Definition of Done'),
      diagramBlockCount: traceability.diagramBlockCount,
      diagramIdCount: traceability.diagramIdCount,
      missingDiagramCoverage: traceability.missingDiagramCoverage,
    },
    definitionDrilldown,
    preConfirmationSemanticDrilldown,
    failedChecks: blockerFindings.map((item) => item.code),
    warningChecks: warningFindings.map((item) => item.code),
    findings,
  };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: args.error }, null, 2));
    return 2;
  }

  const target = path.resolve(args.source);
  if (!fs.existsSync(target)) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: 'source document file not found', target }, null, 2));
    return 1;
  }

  let text;
  let confirmation;
  let blockText;
  try {
    text = fs.readFileSync(target, 'utf8');
    const extracted = extractImplementationConfirmation(text);
    confirmation = extracted.confirmation;
    blockText = extracted.blockText;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          verdict: 'FAIL',
          target: normalizePathForReport(target),
          failedChecks: ['source_parse_failed'],
          findings: [issue('source_parse_failed', error instanceof Error ? error.message : String(error))],
        },
        null,
        2
      )
    );
    return 1;
  }

  if (args.definitionOnly) {
    const hashes = {
      sourceDocumentHash: sourceDocumentHashFor(text, blockText, confirmation),
      implementationConfirmationHash: implementationConfirmationHashFor(confirmation),
    };
    const definitionDrilldown = collectDefinitionDrilldownIssues({
      confirmation,
      renderReport: null,
      rootDir: process.cwd(),
      sourcePath: target,
    });
    const report = buildDefinitionOnlyReport({ target, confirmation, hashes, definitionDrilldown });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.verdict === 'PASS' ? 0 : 1;
  }

  const resolvedReportPath = resolveRenderReportPath(target, confirmation, args);
  let renderReport = null;
  let renderReportPath = '';
  const findings = [];
  if (typeof resolvedReportPath === 'string') {
    renderReportPath = resolvedReportPath;
    try {
      renderReport = readJson(renderReportPath);
    } catch (error) {
      findings.push(
        issue('render_report_parse_failed', error instanceof Error ? error.message : String(error), [renderReportPath])
      );
    }
  } else {
    findings.push(
      issue(
        'missing_confirmation_render_report',
        `confirmation-render-report.json not found; checked ${resolvedReportPath.missing.join(', ')}`,
        resolvedReportPath.missing
      )
    );
  }

  findings.push(...collectRenderReportShapeIssues(renderReport));
  findings.push(...collectRendererIssues(renderReport));
  findings.push(...collectReadinessModeIssues(renderReport, args.mode));
  const integrity = collectReportIntegrityIssues({
    sourcePath: target,
    sourceText: text,
    blockText,
    confirmation,
    renderReport,
    renderReportPath,
  });
  findings.push(...integrity.findings);
  const driftClassification = classifyConfirmationDrift({
    confirmation,
    requirementRecord: null,
    renderReport,
    currentHashes: {
      sourceDocumentHash: integrity.currentSourceHash,
      implementationConfirmationHash: integrity.currentImplementationHash,
    },
  });
  findings.push(
    ...collectConfirmationStateIssues(confirmation, {
      sourceDocumentHash: integrity.currentSourceHash,
      implementationConfirmationHash: integrity.currentImplementationHash,
    })
  );
  findings.push(
    ...collectReconfirmationRequestIssues(text, confirmation, {
      sourceDocumentHash: integrity.currentSourceHash,
      implementationConfirmationHash: integrity.currentImplementationHash,
    }, driftClassification, renderReport)
  );
  findings.push(...collectConfirmationRenderBookkeepingIssues(confirmation, renderReportPath, renderReport));
  findings.push(...collectReportShapeIssues(text));
  const traceability = collectTraceabilityIssues(text, confirmation);
  findings.push(...traceability.findings);
  findings.push(...collectAntiSmokeIssues(text, confirmation));
  const definitionDrilldown = collectDefinitionDrilldownIssues({
    confirmation,
    renderReport,
    rootDir: process.cwd(),
    sourcePath: target,
  });
  findings.push(...definitionDrilldown.blockers, ...definitionDrilldown.warnings);
  const preConfirmationSemanticDrilldown = collectPreConfirmationSemanticDrilldownIssues(args, renderReport, {
    currentSourceHash: integrity.currentSourceHash,
    currentImplementationHash: integrity.currentImplementationHash,
  });
  findings.push(...preConfirmationSemanticDrilldown.findings);
  const grillReport = collectGrillReportIssues(args.grillReport, {
    sourceDocumentHash: integrity.currentSourceHash,
    implementationConfirmationHash: integrity.currentImplementationHash,
  });
  findings.push(...grillReport.findings);

  const report = buildReport({
    target,
    renderReportPath,
    mode: args.mode,
    grillReportSummary: grillReport.summary,
    text,
    confirmation,
    renderReport,
    integrity,
    traceability,
    definitionDrilldown,
    preConfirmationSemanticDrilldown: preConfirmationSemanticDrilldown.summary,
    findings,
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(output);
  return report.verdict === 'PASS' ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
