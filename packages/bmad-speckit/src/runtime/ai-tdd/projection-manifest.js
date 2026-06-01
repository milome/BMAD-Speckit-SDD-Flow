const fs = require('node:fs');
const path = require('node:path');

const MODEL_IDS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
];

const SCHEMA_STATUSES = [
  '',
  'pass',
  'awaiting_user_acceptance',
  'blocked',
  'fail',
  'stale',
  'not_established',
];

const RUNTIME_NEXT_ACTIONS = [
  '',
  'enter_architecture_confirmation',
  'prepare_architecture_confirmation',
  'recompute_current_model_gate',
  'run_implementation_readiness_gate',
  'dispatch_implement',
  'run_execution_closure_gate',
  'dispatch_review',
  'dispatch_remediation',
  'run_closeout',
  'run_pre_confirmation_drilldown',
  'await_user_acceptance',
  'await_user',
  'record_closed',
];

const TERMINAL_EVENTS = ['', 'record_closed'];
const BOOLEANS = ['true', 'false'];
const DETECT_AT_VALUES = ['any', 'closed', ...MODEL_IDS];

const REQUIRED_HEADERS = {
  sixModelManifest: [
    'modelId',
    'sequence',
    'displayName',
    'question',
    'entryCondition',
    'passCondition',
    'blockedCondition',
    'primaryRecordFields',
    'canonicalArtifacts',
    'nextModel',
    'terminalEvent',
    'canWriteControlState',
  ],
  actionMatrix: [
    'actionId',
    'modelId',
    'schemaStatus',
    'displayState',
    'condition',
    'runtimeNextAction',
    'displayRouteAlias',
    'nextModel',
    'allowedTaskType',
    'blockedIf',
    'userFacingPrompt',
    'canSuggestTransition',
    'canWriteControlState',
    'controlledIngestWritesState',
    'terminalEvent',
  ],
  skillRoutes: [
    'routeId',
    'modelId',
    'condition',
    'skill',
    'mode',
    'inputAuthority',
    'outputs',
    'runtimeNextAction',
    'displayRouteAlias',
    'canSuggestTransition',
    'canWriteControlState',
    'controlledIngestWritesState',
    'blockedIf',
    'terminalEvent',
  ],
  reconfirmationRoutes: [
    'triggerId',
    'detectAt',
    'ownerModel',
    'condition',
    'routeAction',
    'skill',
    'mode',
    'runtimeNextAction',
    'displayRouteAlias',
    'blocksUntil',
    'forbiddenFallback',
    'originRecordMutable',
    'targetCarrier',
  ],
};

const KIND_BY_BASENAME = {
  'ai-tdd-six-model-manifest.csv': 'sixModelManifest',
  'ai-tdd-six-model-action-matrix.csv': 'actionMatrix',
  'ai-tdd-six-model-skill-routes.csv': 'skillRoutes',
  'ai-tdd-reconfirmation-route-matrix.csv': 'reconfirmationRoutes',
};

const KNOWN_STABLE_TOKENS = new Set([
  'none',
  'record_created',
  'confirmation_recorded',
  'confirmation_missing_or_hash_mismatch',
  'architecture_confirmation_active',
  'architecture_stale_or_missing',
  'readiness_passed',
  'readiness_blocked',
  'all_trace_slices_current_pass',
  'missing_evidence_or_semantic_gap',
  'execution_closure_pass',
  'audit_review_pass',
  'open_audit_finding_or_rerun',
  'closeout_acceptance_confirmed',
  'delivery_closeout_blocked_or_awaiting_user_acceptance',
  'draft',
  'draft_ready_and_language_selected',
  'render_requirement_confirmation',
  'render_confirmation',
  'html_render_failed',
  'awaiting_user_confirmation',
  'user_exact_phrase_and_hashes_match',
  'ingest_requirement_confirmation',
  'controlled_ingest',
  'hash_mismatch',
  'stale_or_missing',
  'architecture_confirmation_required',
  'render_architecture_confirmation',
  'missing_impact_scan_or_hash_mismatch',
  'ready_to_check',
  'confirmed_source_and_architecture_active',
  'run_readiness_gate',
  'readiness_gate',
  'ready',
  'dispatch_implementation_trace',
  'implement_trace_slice',
  'model_packet_missing_or_stale',
  'dispatch_audit_review',
  'audit_review',
  'open_execution_gap',
  'audit_review_pass_and_current_closeout_evidence',
  'run_delivery_closeout',
  'delivery_closeout',
  'open_blocker_or_stale_evidence',
  'closeout_pass',
  'delivery_closeout_gate_passed',
  'render_closeout_confirmation_page',
  'render_closeout_review',
  'missing_closeout_report_or_renderer_failed',
  'awaiting_user_acceptance',
  'delivery_confirmation_user_acceptance_requested',
  'await_closeout_acceptance',
  'confirmation_page_hash_stale',
  'confirm_closeout_acceptance',
  'closeout_acceptance_hash_mismatch_or_request_missing',
  'no_source_or_no_implementation_confirmation',
  'author_requirement_contract',
  'source_semantics_missing',
  'architecture_input_missing_or_stale',
  'user_confirmed_and_readiness_pass',
  'compile_trace_packet',
  'confirmation_record_hash_mismatch',
  'goal_contract_requested',
  'generate_goal_execution_contract',
  'contract_ambiguity_or_docs_review_gap',
  'audit_review_pass_and_current_evidence',
  'open_blocker_or_missing_current_evidence',
  'renderer_failed_or_closeout_report_hash_mismatch',
  'acceptance_request_missing_or_hash_mismatch',
  'source_document_hash_or_implementation_confirmation_hash_changed',
  'reconfirm_required',
  'regenerate_confirmation',
  'current_reconfirmation_hashes_match',
  'do_not_dispatch_from_stale_packet',
  'req_trace_detects_hash_mismatch',
  'await_user_exact_confirmation',
  'do_not_compile_prompt',
  'targets_or_impact_scan_changed',
  'architecture_reconfirmation_required',
  'await_architecture_confirmation',
  'current_architecture_confirmation_active',
  'do_not_run_readiness',
  'worker_finds_requirement_semantics_must_change',
  'stop_execution_and_reconfirm',
  'do_not_patch_tracerows_runtime',
  'closeout_page_hash_or_attempt_hash_mismatch',
  'rerender_closeout_confirmation_page',
  'current_attempt_hashes_match',
  'do_not_confirm_closeout_from_stale_page',
  'acceptance_request_missing_or_not_current_attempt',
  'run_closeout_again',
  'current_delivery_confirmation_user_acceptance_requested',
  'do_not_write_record_closed',
  'defect_found_after_record_closed',
  'create_linked_bugfix_requirement',
  'post_close_defect_intake',
  'bugfix_requirement_record_linked',
  'do_not_reopen_closed_record_by_default',
  'same_requirement_record',
  'linked_bugfix_requirement',
  'closure_integrity_incident',
]);

const STABLE_TOKEN_COLUMNS = new Set([
  'entryCondition',
  'passCondition',
  'blockedCondition',
  'displayState',
  'condition',
  'displayRouteAlias',
  'allowedTaskType',
  'blockedIf',
  'routeAction',
  'blocksUntil',
  'forbiddenFallback',
  'targetCarrier',
]);

const BOOLEAN_COLUMNS = new Set([
  'canSuggestTransition',
  'canWriteControlState',
  'controlledIngestWritesState',
  'originRecordMutable',
]);

const LOCAL_PATH_COLUMNS = new Set(['canonicalArtifacts', 'outputs']);
const STABLE_TOKEN_PATTERN = /^[a-z][a-z0-9_]*$/u;
const STABLE_ID_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function splitCsv(text) {
  const normalized = String(text || '').replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n');
  return normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
}

function diagnostic(filePath, row, column, code, message) {
  return {
    file: path.normalize(filePath).replace(/\\/g, '/'),
    row,
    column,
    code,
    message,
  };
}

function normalizeKind(kind, filePath) {
  if (kind) return kind;
  const detected = KIND_BY_BASENAME[path.basename(filePath)];
  if (!detected) throw new Error(`Unknown AI-TDD projection manifest kind for ${filePath}`);
  return detected;
}

function isLocalAbsolutePath(value) {
  return /^[A-Za-z]:[\\/]/u.test(value) || /^\\\\/u.test(value) || /^\//u.test(value);
}

function listValues(value) {
  return String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateEnum(report, row, column, value, allowed, label) {
  if (!allowed.includes(value)) {
    report.errors.push(
      diagnostic(report.filePath, row, column, `illegal_${label}`, `${column} has illegal value ${value}`)
    );
  }
}

function validateStableToken(report, row, column, value) {
  if (!value) return;
  if (value === 'none') return;
  if (!STABLE_TOKEN_PATTERN.test(value)) {
    report.errors.push(
      diagnostic(report.filePath, row, column, 'invalid_stable_token', `${column} must be a stable token`)
    );
    return;
  }
  if (!KNOWN_STABLE_TOKENS.has(value)) {
    report.warnings.push(
      diagnostic(report.filePath, row, column, 'unknown_stable_token', `${column} is not in the known route token set`)
    );
  }
}

function validateStableId(report, row, column, value) {
  if (!value || STABLE_ID_PATTERN.test(value)) return;
  report.errors.push(
    diagnostic(report.filePath, row, column, 'invalid_stable_id', `${column} must be UPPER_SNAKE_CASE`)
  );
}

function validateLocalPaths(report, row, column, value) {
  for (const item of listValues(value)) {
    if (isLocalAbsolutePath(item)) {
      report.errors.push(
        diagnostic(report.filePath, row, column, 'absolute_local_path', `${column} must not contain absolute local path ${item}`)
      );
    }
  }
}

function validateControlledIngest(report, row, record) {
  if (record.controlledIngestWritesState !== 'true') return;
  if (record.canWriteControlState !== 'false') {
    report.errors.push(
      diagnostic(
        report.filePath,
        row,
        'canWriteControlState',
        'controlled_ingest_projection_write_violation',
        'controlled ingest display rows must keep canWriteControlState=false'
      )
    );
  }
  if (
    ('skill' in record || 'mode' in record) &&
    (!String(record.skill || '').trim() || !String(record.mode || '').trim())
  ) {
    report.errors.push(
      diagnostic(
        report.filePath,
        row,
        'skill',
        'controlled_ingest_route_missing',
        'controlled ingest display rows must bind an existing skill and mode'
      )
    );
  }
  if (record.runtimeNextAction === 'record_closed') {
    report.errors.push(
      diagnostic(
        report.filePath,
        row,
        'runtimeNextAction',
        'record_closed_primary_route_forbidden',
        'record_closed cannot be a runtimeNextAction on controlled ingest display rows'
      )
    );
  }
}

function validateRecord(report, row, record) {
  if ('actionId' in record) validateStableId(report, row, 'actionId', record.actionId);
  if ('routeId' in record) validateStableId(report, row, 'routeId', record.routeId);
  if ('triggerId' in record) validateStableId(report, row, 'triggerId', record.triggerId);

  if ('modelId' in record) validateEnum(report, row, 'modelId', record.modelId, MODEL_IDS, 'enum');
  if ('ownerModel' in record) validateEnum(report, row, 'ownerModel', record.ownerModel, MODEL_IDS, 'enum');
  if ('nextModel' in record && record.nextModel) {
    validateEnum(report, row, 'nextModel', record.nextModel, MODEL_IDS, 'enum');
  }
  if ('detectAt' in record) {
    validateEnum(report, row, 'detectAt', record.detectAt, DETECT_AT_VALUES, 'enum');
  }
  if ('schemaStatus' in record) {
    validateEnum(report, row, 'schemaStatus', record.schemaStatus, SCHEMA_STATUSES, 'enum');
  }
  if ('runtimeNextAction' in record) {
    validateEnum(
      report,
      row,
      'runtimeNextAction',
      record.runtimeNextAction,
      RUNTIME_NEXT_ACTIONS,
      'enum'
    );
  }
  if ('terminalEvent' in record) {
    validateEnum(report, row, 'terminalEvent', record.terminalEvent, TERMINAL_EVENTS, 'enum');
  }

  for (const column of BOOLEAN_COLUMNS) {
    if (column in record) {
      validateEnum(report, row, column, record[column], BOOLEANS, 'boolean');
    }
  }
  if (record.canWriteControlState === 'true') {
    report.errors.push(
      diagnostic(
        report.filePath,
        row,
        'canWriteControlState',
        'projection_control_write_forbidden',
        'AI-TDD projection manifests cannot write control state'
      )
    );
  }
  for (const column of STABLE_TOKEN_COLUMNS) {
    if (column in record) validateStableToken(report, row, column, record[column]);
  }
  for (const column of LOCAL_PATH_COLUMNS) {
    if (column in record) validateLocalPaths(report, row, column, record[column]);
  }
  validateControlledIngest(report, row, record);
}

function parseProjectionCsv(filePath, kind) {
  const resolvedKind = normalizeKind(kind, filePath);
  const requiredHeaders = REQUIRED_HEADERS[resolvedKind];
  if (!requiredHeaders) throw new Error(`Unsupported AI-TDD projection manifest kind: ${resolvedKind}`);

  const lines = splitCsv(fs.readFileSync(filePath, 'utf8'));
  const headers = parseCsvLine(lines[0] || '').map((item) => item.trim());
  const report = {
    kind: resolvedKind,
    filePath,
    headers,
    rows: [],
    warnings: [],
    errors: [],
  };

  const headerSet = new Set(headers);
  for (const requiredHeader of requiredHeaders) {
    if (!headerSet.has(requiredHeader)) {
      report.errors.push(
        diagnostic(
          filePath,
          1,
          requiredHeader,
          'missing_required_header',
          `Missing required header ${requiredHeader}`
        )
      );
    }
  }
  for (const header of headers) {
    if (!requiredHeaders.includes(header)) {
      report.warnings.push(
        diagnostic(filePath, 1, header, 'unknown_column', `Unknown column ${header}`)
      );
    }
  }

  for (let index = 1; index < lines.length; index += 1) {
    const rowNumber = index + 1;
    const values = parseCsvLine(lines[index]);
    const record = {};
    headers.forEach((header, valueIndex) => {
      record[header] = values[valueIndex] == null ? '' : values[valueIndex].trim();
    });
    report.rows.push(record);
    validateRecord(report, rowNumber, record);
  }

  delete report.filePath;
  return report;
}

function packageAssetRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function repoAssetRoot() {
  return path.resolve(__dirname, '..', '..', '..', '..', '..');
}

function manifestPath(assetRoot, basename) {
  return path.join(assetRoot, '_bmad', '_config', basename);
}

function hasManifestAssets(assetRoot) {
  return Object.keys(KIND_BY_BASENAME).every((basename) =>
    fs.existsSync(manifestPath(assetRoot, basename))
  );
}

function resolveProjectionAssetRoot(projectRoot, explicitAssetRoot) {
  const candidates = [
    explicitAssetRoot,
    projectRoot,
    packageAssetRoot(),
    repoAssetRoot(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (hasManifestAssets(resolved)) return resolved;
  }
  return path.resolve(explicitAssetRoot || projectRoot || packageAssetRoot());
}

function loadAiTddProjectionManifests(projectRoot, options = {}) {
  const assetRoot = resolveProjectionAssetRoot(projectRoot, options.assetRoot);
  const files = Object.entries(KIND_BY_BASENAME).map(([basename, kind]) => ({
    basename,
    kind,
    path: manifestPath(assetRoot, basename),
  }));
  const result = {};
  const diagnostics = { warnings: [], errors: [] };
  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      diagnostics.errors.push(
        diagnostic(file.path, 1, 'file', 'manifest_file_missing', `${file.basename} is missing`)
      );
      result[file.kind] = [];
      continue;
    }
    const parsed = parseProjectionCsv(file.path, file.kind);
    result[file.kind] = parsed.rows;
    diagnostics.warnings.push(...parsed.warnings);
    diagnostics.errors.push(...parsed.errors);
  }
  result.diagnostics = diagnostics;
  return result;
}

module.exports = {
  REQUIRED_HEADERS,
  MODEL_IDS,
  SCHEMA_STATUSES,
  RUNTIME_NEXT_ACTIONS,
  TERMINAL_EVENTS,
  parseProjectionCsv,
  loadAiTddProjectionManifests,
  resolveProjectionAssetRoot,
};
