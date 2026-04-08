#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const READINESS_REPORT_PATTERN = /^implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/i;
const DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/;
const REGISTER_FILE_NAME = 'deferred-gap-register.yaml';
const JOURNEY_LEDGER_FILES = ['journey-ledger.yaml', 'journey-ledger.yml', 'journey-ledger.md'];
const INVARIANT_LEDGER_FILES = ['invariant-ledger.yaml', 'invariant-ledger.yml', 'invariant-ledger.md'];
const TRACE_MAP_FILES = ['trace-map.json'];
const CLOSURE_NOTES_DIR = 'closure-notes';
const RESOLUTION_KEYWORDS = [
  'resolved',
  'resolution evidence',
  'closed',
  'verified',
  '已解决',
  '已关闭',
  '验证通过',
  '解决证明',
];

const COLUMN_ALIASES = {
  gap_id: ['gap id', 'gap_id', 'id', 'gap'],
  description: ['描述', 'description', 'desc'],
  reason: ['原因', 'reason'],
  resolution_target: ['解决时机', '解决目标', 'resolution target', 'resolution_target', 'target sprint', '目标 sprint'],
  owner: ['owner', '负责人', '责任人'],
  status_checkpoint: ['状态检查点', 'status checkpoint', 'status_checkpoint', 'checkpoint'],
  status: ['状态', 'status'],
  current_risk: ['当前风险', 'current risk', 'current_risk', 'risk'],
  planned_work_items: ['planned work items', 'planned_work_items', 'planned stories', 'planned_story_keys'],
  explicit_reason: ['explicit reason', 'explicit_reason', 'rationale', 'defer reason', '延期原因'],
};
function normalizeText(value) {
  return String(value || '')
    .replace(/`/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeSlashes(value) {
  return typeof value === 'string' ? value.replace(/\\/g, '/') : value;
}

function resolveProjectPath(projectRoot, candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  return path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);
}

function collectSections(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const sections = new Map();
  let current = null;
  let buffer = [];

  for (const line of lines) {
    const match = /^(#{2,4})\s+(.*)$/.exec(line);
    if (match) {
      if (current) {
        sections.set(current, buffer.join('\n').trim());
      }
      current = match[2].trim();
      buffer = [];
      continue;
    }
    if (current) {
      buffer.push(line);
    }
  }

  if (current) {
    sections.set(current, buffer.join('\n').trim());
  }

  return sections;
}

function mapColumn(header) {
  const normalized = normalizeKey(header);
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(normalized)) {
      return key;
    }
  }
  return null;
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => normalizeText(cell));
}

function parseMarkdownTable(sectionContent) {
  const lines = String(sectionContent || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index];
    const separator = lines[index + 1];
    if (!header.includes('|') || !separator.includes('|')) {
      continue;
    }
    if (!/^\|?[\s:-|]+\|?$/u.test(separator)) {
      continue;
    }

    const headers = splitMarkdownRow(header);
    const mapped = headers.map(mapColumn);
    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex];
      if (!row.includes('|')) {
        break;
      }
      if (/^(#{2,4})\s+/.test(row)) {
        break;
      }
      const cells = splitMarkdownRow(row);
      if (cells.length === 0) {
        continue;
      }
      const item = {};
      mapped.forEach((key, cellIndex) => {
        if (!key) return;
        const value = normalizeText(cells[cellIndex] || '');
        if (value) {
          item[key] = value;
        }
      });
      if (item.gap_id) {
        rows.push(item);
      }
    }
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

function parseIndentedKeyValueLine(line) {
  const match = /^\s*[-*]?\s*([A-Za-z0-9 _-]+)\s*:\s*(.+?)\s*$/.exec(line);
  if (!match) return null;
  return {
    key: normalizeKey(match[1]),
    value: normalizeText(match[2]),
  };
}

function parseDeferredGapBullets(sectionContent) {
  const lines = String(sectionContent || '').split(/\r?\n/);
  const items = [];
  let current = null;

  for (const line of lines) {
    const indent = (line.match(/^\s*/) || [''])[0].length;
    const topLevelMatch = /^\s*[-*]\s+`?([A-Za-z0-9._-]+)`?\s*(?:[:|-]\s*(.+))?$/.exec(line);
    if (topLevelMatch && indent <= 1) {
      if (current && current.gap_id) {
        items.push(current);
      }
      current = {
        gap_id: normalizeText(topLevelMatch[1]),
      };
      const remainder = normalizeText(topLevelMatch[2] || '');
      if (remainder) {
        current.description = remainder;
      }
      continue;
    }

    if (!current) {
      continue;
    }

    const kv = parseIndentedKeyValueLine(line);
    if (!kv) {
      continue;
    }

    if (COLUMN_ALIASES.reason.includes(kv.key)) current.reason = kv.value;
    if (COLUMN_ALIASES.owner.includes(kv.key)) current.owner = kv.value;
    if (COLUMN_ALIASES.status.includes(kv.key)) current.status = kv.value;
    if (COLUMN_ALIASES.current_risk.includes(kv.key)) current.current_risk = kv.value;
    if (COLUMN_ALIASES.resolution_target.includes(kv.key)) current.resolution_target = kv.value;
    if (COLUMN_ALIASES.status_checkpoint.includes(kv.key)) current.status_checkpoint = kv.value;
    if (COLUMN_ALIASES.description.includes(kv.key) && !current.description) current.description = kv.value;
  }

  if (current && current.gap_id) {
    items.push(current);
  }

  return items;
}

function mergeGapRecords(trackingRows, deferredRows, sourcePath) {
  const merged = new Map();

  for (const row of [...deferredRows, ...trackingRows]) {
    if (!row || !row.gap_id) continue;
    const key = normalizeText(row.gap_id);
    const existing = merged.get(key) || {
      gap_id: key,
      status: 'deferred',
      source_path: sourcePath || null,
    };
    merged.set(key, {
      ...existing,
      ...Object.fromEntries(
        Object.entries(row)
          .filter(([, value]) => normalizeText(value))
          .map(([field, value]) => [field, normalizeText(value)])
      ),
      gap_id: key,
      source_path: sourcePath || null,
    });
  }

  return [...merged.values()].sort((left, right) => left.gap_id.localeCompare(right.gap_id));
}

function extractDeferredGapsFromMarkdown(markdown, sourcePath) {
  const sections = collectSections(markdown);
  const trackingRows = parseMarkdownTable(sections.get('Deferred Gaps Tracking') || '');
  const deferredRows = [
    ...parseMarkdownTable(sections.get('Deferred Gaps') || ''),
    ...parseDeferredGapBullets(sections.get('Deferred Gaps') || ''),
  ];
  const gaps = mergeGapRecords(trackingRows, deferredRows, sourcePath);
  const deferredSectionRaw = normalizeText(sections.get('Deferred Gaps') || '');
  const explicit =
    sections.has('Deferred Gaps') &&
    deferredSectionRaw !== '' &&
    deferredSectionRaw !== '{{placeholder}}';

  return {
    gaps,
    explicit,
    sections,
  };
}

function readDeferredGapsFromReport(reportPath) {
  const markdown = fs.readFileSync(reportPath, 'utf8');
  const extracted = extractDeferredGapsFromMarkdown(markdown, reportPath);
  return {
    report_path: reportPath,
    markdown,
    gaps: extracted.gaps,
    explicit: extracted.explicit,
    sections: extracted.sections,
  };
}

function extractDateToken(value) {
  const match = DATE_PATTERN.exec(String(value || ''));
  return match ? match[1] : null;
}

function reportSortValue(reportPath) {
  const dateToken = extractDateToken(path.basename(reportPath));
  if (dateToken) {
    const time = Date.parse(`${dateToken}T00:00:00Z`);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  try {
    return fs.statSync(reportPath).mtimeMs;
  } catch {
    return 0;
  }
}

function listReadinessReports(projectRoot) {
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  const found = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (READINESS_REPORT_PATTERN.test(entry.name)) {
        found.push(fullPath);
      }
    }
  }

  walk(planningRoot);
  return found.sort((left, right) => reportSortValue(right) - reportSortValue(left));
}

function findPreviousReadinessReport(currentReportPath) {
  const directory = path.dirname(currentReportPath);
  if (!fs.existsSync(directory)) return null;
  const candidates = fs
    .readdirSync(directory)
    .filter((entry) => READINESS_REPORT_PATTERN.test(entry))
    .map((entry) => path.join(directory, entry))
    .filter((fullPath) => path.resolve(fullPath) !== path.resolve(currentReportPath))
    .sort((left, right) => reportSortValue(right) - reportSortValue(left));
  return candidates[0] || null;
}

function hasResolutionEvidence(markdown, gapId) {
  const text = String(markdown || '');
  const evidencePattern = new RegExp(
    `${gapId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,80}(?:${RESOLUTION_KEYWORDS
      .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})`,
    'i'
  );
  const reversePattern = new RegExp(
    `(?:${RESOLUTION_KEYWORDS
      .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})[\\s\\S]{0,80}${gapId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'i'
  );
  return evidencePattern.test(text) || reversePattern.test(text);
}

function compareDeferredGapReports(currentReportPath, previousReportPath) {
  if (!previousReportPath) {
    const current = readDeferredGapsFromReport(currentReportPath);
    return {
      current,
      previous: null,
      new_gaps: current.gaps,
      retained_gaps: [],
      removed_without_evidence: [],
      updated_resolution_targets: [],
      missing_owner: current.gaps.filter((gap) => !normalizeText(gap.owner)),
    };
  }

  const current = readDeferredGapsFromReport(currentReportPath);
  const previous = readDeferredGapsFromReport(previousReportPath);
  const currentById = new Map(current.gaps.map((gap) => [gap.gap_id, gap]));
  const previousById = new Map(previous.gaps.map((gap) => [gap.gap_id, gap]));

  const removedWithoutEvidence = [];
  const retained = [];
  const updatedTargets = [];

  for (const [gapId, previousGap] of previousById.entries()) {
    const currentGap = currentById.get(gapId);
    if (!currentGap) {
      if (!hasResolutionEvidence(current.markdown, gapId)) {
        removedWithoutEvidence.push({
          gap_id: gapId,
          previous: previousGap,
        });
      }
      continue;
    }
    retained.push(currentGap);
    if (
      normalizeText(previousGap.resolution_target) &&
      normalizeText(currentGap.resolution_target) &&
      normalizeText(previousGap.resolution_target) !== normalizeText(currentGap.resolution_target)
    ) {
      updatedTargets.push({
        gap_id: gapId,
        previous_target: normalizeText(previousGap.resolution_target),
        current_target: normalizeText(currentGap.resolution_target),
      });
    }
  }

  const newGaps = current.gaps.filter((gap) => !previousById.has(gap.gap_id));

  return {
    current,
    previous,
    new_gaps: newGaps,
    retained_gaps: retained,
    removed_without_evidence: removedWithoutEvidence,
    updated_resolution_targets: updatedTargets,
    missing_owner: current.gaps.filter((gap) => !normalizeText(gap.owner)),
  };
}

function deriveReadinessRemediationArtifactPath(reportPath) {
  return reportPath.replace(/implementation-readiness-report-/i, 'implementation-readiness-remediation-');
}

function parseYamlModule() {
  const candidates = [
    'js-yaml',
    path.join(process.cwd(), 'node_modules', 'js-yaml'),
    path.join(process.cwd(), '..', 'BMAD-Speckit-SDD-Flow', 'node_modules', 'js-yaml'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'js-yaml'),
    path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'js-yaml'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // continue
    }
  }
  throw new Error('Cannot resolve js-yaml for deferred gap governance');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function normalizeGapLifecycleStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (['open', 'deferred', 'in_progress', 'resolved', 'expired', 'carried_forward'].includes(normalized)) {
    return normalized;
  }
  return normalized || 'open';
}

function normalizeGapRegisterRecord(gap) {
  const specIntake = gap && typeof gap.spec_intake === 'object' ? gap.spec_intake : {};
  const planMapping = gap && typeof gap.plan_mapping === 'object' ? gap.plan_mapping : {};
  const gapAnalysis = gap && typeof gap.gap_analysis === 'object' ? gap.gap_analysis : {};
  const taskBinding = gap && typeof gap.task_binding === 'object' ? gap.task_binding : {};
  const implementation = gap && typeof gap.implementation === 'object' ? gap.implementation : {};
  const audit = gap && typeof gap.audit === 'object' ? gap.audit : {};

  return {
    gap_id: normalizeText(gap?.gap_id || gap?.id),
    title: normalizeText(gap?.title || gap?.description),
    description: normalizeText(gap?.description || gap?.title),
    source_type: normalizeText(gap?.source_type || 'inherited').toLowerCase() || 'inherited',
    source_stage: normalizeText(gap?.source_stage || ''),
    lifecycle_status: normalizeGapLifecycleStatus(gap?.lifecycle_status || gap?.status),
    owner: normalizeText(gap?.owner),
    resolution_target: normalizeText(gap?.resolution_target),
    current_risk: normalizeText(gap?.current_risk),
    inherited_from: normalizeText(gap?.inherited_from),
    journey_refs: normalizeArray(gap?.journey_refs),
    prod_path_refs: normalizeArray(gap?.prod_path_refs),
    smoke_test_refs: normalizeArray(gap?.smoke_test_refs),
    full_e2e_refs: normalizeArray(gap?.full_e2e_refs),
    closure_note_refs: normalizeArray(gap?.closure_note_refs),
    spec_intake: {
      status: normalizeText(specIntake.status).toLowerCase(),
      section_refs: normalizeArray(specIntake.section_refs),
      notes: normalizeText(specIntake.notes),
    },
    plan_mapping: {
      status: normalizeText(planMapping.status).toLowerCase(),
      architecture_refs: normalizeArray(planMapping.architecture_refs),
      work_item_refs: normalizeArray(planMapping.work_item_refs),
      journey_refs: normalizeArray(planMapping.journey_refs),
      prod_path_refs: normalizeArray(planMapping.prod_path_refs),
    },
    gap_analysis: {
      classification: normalizeText(gapAnalysis.classification).toLowerCase(),
      notes: normalizeText(gapAnalysis.notes),
    },
    task_binding: {
      status: normalizeText(taskBinding.status).toLowerCase(),
      task_ids: normalizeArray(taskBinding.task_ids),
      smoke_task_ids: normalizeArray(taskBinding.smoke_task_ids),
      closure_task_id: normalizeText(taskBinding.closure_task_id),
      explicit_defer_reason: normalizeText(taskBinding.explicit_defer_reason || taskBinding.rationale),
    },
    implementation: {
      status: normalizeGapLifecycleStatus(implementation.status || gap?.implementation_status || gap?.lifecycle_status),
      closure_evidence: normalizeArray(implementation.closure_evidence),
      carry_forward_evidence: normalizeArray(implementation.carry_forward_evidence),
      production_path_evidence: normalizeArray(implementation.production_path_evidence),
      smoke_e2e_evidence: normalizeArray(implementation.smoke_e2e_evidence),
      full_e2e_evidence: normalizeArray(implementation.full_e2e_evidence),
      full_e2e_defer_reason: normalizeText(implementation.full_e2e_defer_reason),
      acceptance_evidence: normalizeArray(implementation.acceptance_evidence),
    },
    audit: {
      last_verified_stage: normalizeText(audit.last_verified_stage),
      last_verified_at: normalizeText(audit.last_verified_at),
      notes: normalizeText(audit.notes),
    },
  };
}

function resolveFeatureArtifactRoot(projectRoot, options = {}) {
  const candidates = [];
  const explicitRoot = resolveProjectPath(projectRoot, options.artifactRoot);
  const explicitArtifact = resolveProjectPath(projectRoot, options.artifactPath);
  const explicitRegister = resolveProjectPath(projectRoot, options.registerPath);

  if (explicitRoot) candidates.push(explicitRoot);
  if (explicitArtifact) candidates.push(path.dirname(explicitArtifact));
  if (explicitRegister) candidates.push(path.dirname(explicitRegister));

  const unique = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (!unique.includes(resolved)) unique.push(resolved);
  }

  return unique[0] || projectRoot;
}

function resolveDeferredGapRegisterLocation(projectRoot, options = {}) {
  const featureRoot = resolveFeatureArtifactRoot(projectRoot, options);
  return {
    feature_root: featureRoot,
    register_path: path.join(featureRoot, REGISTER_FILE_NAME),
  };
}

function loadDeferredGapRegister(projectRoot, options = {}) {
  const yaml = parseYamlModule();
  const resolved = resolveDeferredGapRegisterLocation(projectRoot, options);
  if (!fs.existsSync(resolved.register_path)) {
    return {
      ...resolved,
      exists: false,
      document: null,
      gaps: [],
    };
  }
  const document = yaml.load(fs.readFileSync(resolved.register_path, 'utf8')) || {};
  const gaps = Array.isArray(document.gaps)
    ? document.gaps.map((gap) => normalizeGapRegisterRecord(gap)).filter((gap) => gap.gap_id)
    : [];
  return {
    ...resolved,
    exists: true,
    document,
    gaps,
  };
}

function isActiveGap(gap) {
  const status = normalizeGapLifecycleStatus(gap?.lifecycle_status || gap?.implementation?.status || gap?.status);
  return status !== 'resolved' && status !== 'closed';
}

function findFirstExistingFile(baseDir, candidates) {
  for (const fileName of candidates) {
    const fullPath = path.join(baseDir, fileName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function findTasksArtifact(baseDir, explicitArtifactPath) {
  if (explicitArtifactPath && /^tasks/i.test(path.basename(explicitArtifactPath))) {
    return explicitArtifactPath;
  }
  if (!fs.existsSync(baseDir)) return null;
  const matches = fs
    .readdirSync(baseDir)
    .filter((entry) => /^tasks.*\.md$/i.test(entry))
    .map((entry) => path.join(baseDir, entry))
    .sort((left, right) => left.localeCompare(right));
  return matches[0] || null;
}

function parseSharedPathReferences(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const refs = {
    journey_ledger: '',
    invariant_ledger: '',
    trace_map: '',
  };
  for (const line of lines) {
    const journeyMatch = /Shared Journey Ledger Path\s*[:：]\s*(.+)\s*$/i.exec(line);
    if (journeyMatch) refs.journey_ledger = normalizeText(journeyMatch[1]);
    const invariantMatch = /Shared Invariant Ledger Path\s*[:：]\s*(.+)\s*$/i.exec(line);
    if (invariantMatch) refs.invariant_ledger = normalizeText(invariantMatch[1]);
    const traceMatch = /Shared Trace Map Path\s*[:：]\s*(.+)\s*$/i.exec(line);
    if (traceMatch) refs.trace_map = normalizeText(traceMatch[1]);
  }
  return refs;
}

function collectJourneyArtifacts(projectRoot, options = {}) {
  const resolved = resolveDeferredGapRegisterLocation(projectRoot, options);
  const featureRoot = resolved.feature_root;
  const explicitArtifactPath = resolveProjectPath(projectRoot, options.artifactPath);
  const tasksPath = findTasksArtifact(featureRoot, explicitArtifactPath);
  const tasksMarkdown = tasksPath && fs.existsSync(tasksPath) ? fs.readFileSync(tasksPath, 'utf8') : '';
  const tasksSections = collectSections(tasksMarkdown);

  const standalone = {
    journey_ledger: findFirstExistingFile(featureRoot, JOURNEY_LEDGER_FILES),
    invariant_ledger: findFirstExistingFile(featureRoot, INVARIANT_LEDGER_FILES),
    trace_map: findFirstExistingFile(featureRoot, TRACE_MAP_FILES),
    closure_notes_dir: fs.existsSync(path.join(featureRoot, CLOSURE_NOTES_DIR))
      ? path.join(featureRoot, CLOSURE_NOTES_DIR)
      : null,
  };

  const closureNoteFiles = standalone.closure_notes_dir
    ? fs.readdirSync(standalone.closure_notes_dir)
      .filter((entry) => /\.md$/i.test(entry))
      .map((entry) => path.join(standalone.closure_notes_dir, entry))
    : [];

  return {
    feature_root: featureRoot,
    tasks_path: tasksPath,
    tasks_markdown: tasksMarkdown,
    tasks_sections: tasksSections,
    standalone,
    closure_note_files: closureNoteFiles,
    embedded: {
      journey_ledger: tasksSections.has('P0 Journey Ledger'),
      invariant_ledger: tasksSections.has('Invariant Ledger'),
      journey_trace_closure:
        tasksSections.has('Journey -> Task -> Test -> Closure') ||
        tasksSections.has('Journey -> Task -> Test -> Closure 映射'),
      closure_notes: tasksSections.has('Closure Notes'),
    },
    shared_path_refs: parseSharedPathReferences(tasksMarkdown),
  };
}

function validateJourneyArtifactPrecedence(artifacts) {
  const failures = [];
  const hasStandalone = Object.values(artifacts.standalone).some((value) => Boolean(value));
  if (!hasStandalone) {
    return failures;
  }

  if (
    artifacts.standalone.journey_ledger &&
    artifacts.embedded.journey_ledger &&
    !normalizeText(artifacts.shared_path_refs.journey_ledger)
  ) {
    failures.push('journey_artifact_precedence: standalone journey-ledger exists but tasks.md does not declare Shared Journey Ledger Path');
  }
  if (
    artifacts.standalone.invariant_ledger &&
    artifacts.embedded.invariant_ledger &&
    !normalizeText(artifacts.shared_path_refs.invariant_ledger)
  ) {
    failures.push('journey_artifact_precedence: standalone invariant-ledger exists but tasks.md does not declare Shared Invariant Ledger Path');
  }
  if (
    artifacts.standalone.trace_map &&
    artifacts.embedded.journey_trace_closure &&
    !normalizeText(artifacts.shared_path_refs.trace_map)
  ) {
    failures.push('journey_artifact_precedence: standalone trace-map exists but tasks.md does not declare Shared Trace Map Path');
  }

  const compareRef = (declaredPath, actualPath, label) => {
    if (!declaredPath || !actualPath) return;
    const declaredBase = path.basename(normalizeSlashes(declaredPath)).toLowerCase();
    const actualBase = path.basename(normalizeSlashes(actualPath)).toLowerCase();
    if (declaredBase !== actualBase) {
      failures.push(`journey_artifact_precedence: ${label} mismatch between tasks.md and standalone artifact`);
    }
  };

  compareRef(artifacts.shared_path_refs.journey_ledger, artifacts.standalone.journey_ledger, 'Shared Journey Ledger Path');
  compareRef(artifacts.shared_path_refs.invariant_ledger, artifacts.standalone.invariant_ledger, 'Shared Invariant Ledger Path');
  compareRef(artifacts.shared_path_refs.trace_map, artifacts.standalone.trace_map, 'Shared Trace Map Path');

  return failures;
}

function resolveInheritedDeferredGapInputs(projectRoot) {
  const sprintPlan = readSprintDeferredGapPlan(projectRoot);
  if (sprintPlan.items.size > 0) {
    return {
      source: 'sprint-status',
      gaps: [...sprintPlan.items.values()],
    };
  }

  const latestReadinessReport = listReadinessReports(projectRoot)[0];
  if (latestReadinessReport) {
    return {
      source: 'readiness',
      gaps: readDeferredGapsFromReport(latestReadinessReport).gaps,
    };
  }

  return {
    source: 'none',
    gaps: [],
  };
}

function validateDeferredGapStageContract(projectRoot, input) {
  const failures = [];
  const register = loadDeferredGapRegister(projectRoot, input);
  const stage = normalizeText(input.stage || '').toLowerCase();
  const sections = input.sections || new Map();
  const activeGaps = register.gaps.filter((gap) => isActiveGap(gap));
  const inheritedSource = resolveInheritedDeferredGapInputs(projectRoot);

  if (!register.exists) {
    failures.push(`deferred_gap_register_missing: missing ${REGISTER_FILE_NAME}`);
    return { failures, register, journeyArtifacts: null };
  }

  for (const sourceGap of inheritedSource.gaps) {
    const sourceGapId = normalizeText(sourceGap.gap_id || sourceGap.id);
    if (!sourceGapId) continue;
    if (!register.gaps.find((gap) => gap.gap_id === sourceGapId)) {
      failures.push(`deferred_gap_register_consistency: inherited gap ${sourceGapId} is missing from ${REGISTER_FILE_NAME}`);
    }
  }

  const requireSection = (sectionName, code) => {
    if (!sections.has(sectionName)) {
      failures.push(`${code}: missing section content: ${sectionName}`);
    }
  };

  if (stage === 'specify') {
    requireSection('Inherited Deferred Gaps', 'deferred_gap_intake');
    requireSection('Deferred Gap Intake Mapping', 'deferred_gap_intake');
    for (const gap of activeGaps.filter((gap) => gap.source_type !== 'new')) {
      if (gap.spec_intake.status !== 'acknowledged') {
        failures.push(`deferred_gap_intake: gap ${gap.gap_id} is not acknowledged in spec_intake`);
      }
    }
    return { failures, register, journeyArtifacts: null };
  }

  if (stage === 'plan') {
    requireSection('Deferred Gap Architecture Mapping', 'deferred_gap_plan_mapping');
    for (const gap of activeGaps) {
      const mapped = gap.plan_mapping.status === 'mapped';
      const hasRefs =
        gap.plan_mapping.architecture_refs.length > 0 ||
        gap.plan_mapping.work_item_refs.length > 0;
      if (!mapped || !hasRefs) {
        failures.push(`deferred_gap_plan_mapping: gap ${gap.gap_id} is not fully mapped`);
      }
      if (gap.journey_refs.length === 0 && gap.plan_mapping.journey_refs.length === 0) {
        failures.push(`deferred_gap_plan_mapping: gap ${gap.gap_id} is missing journey_refs`);
      }
      if (gap.prod_path_refs.length === 0 && gap.plan_mapping.prod_path_refs.length === 0) {
        failures.push(`deferred_gap_plan_mapping: gap ${gap.gap_id} is missing prod_path_refs`);
      }
    }
    return { failures, register, journeyArtifacts: null };
  }

  if (stage === 'gaps') {
    requireSection('Deferred Gap Lifecycle Classification', 'deferred_gap_lifecycle');
    for (const gap of register.gaps) {
      const classification = normalizeText(gap.gap_analysis.classification).toLowerCase();
      if (!classification) {
        failures.push(`deferred_gap_lifecycle: gap ${gap.gap_id} is missing lifecycle classification`);
        continue;
      }
      if (gap.source_type === 'new' && classification !== 'new_gap') {
        failures.push(`deferred_gap_lifecycle: gap ${gap.gap_id} must classify as new_gap`);
      }
      if (gap.source_type !== 'new' && !['inherited_open', 'inherited_resolved_candidate', 'inherited_redeferred'].includes(classification)) {
        failures.push(`deferred_gap_lifecycle: gap ${gap.gap_id} has invalid inherited classification ${classification}`);
      }
    }
    return { failures, register, journeyArtifacts: null };
  }

  const journeyArtifacts = collectJourneyArtifacts(projectRoot, input);
  failures.push(...validateJourneyArtifactPrecedence(journeyArtifacts));

  const hasJourneyLedger =
    Boolean(journeyArtifacts.standalone.journey_ledger) || journeyArtifacts.embedded.journey_ledger;
  const hasTraceMap =
    Boolean(journeyArtifacts.standalone.trace_map) || journeyArtifacts.embedded.journey_trace_closure;
  const hasClosureNotes =
    journeyArtifacts.closure_note_files.length > 0 || journeyArtifacts.embedded.closure_notes;

  if (stage === 'tasks') {
    requireSection('Deferred Gap Task Binding', 'deferred_gap_task_binding');
    requireSection('P0 Journey Ledger', 'journey_runnable_task_chain');
    if (!journeyArtifacts.embedded.journey_trace_closure) {
      failures.push('journey_runnable_task_chain: missing section content: Journey -> Task -> Test -> Closure');
    }
    if (!journeyArtifacts.tasks_markdown.includes('Smoke Task Chain')) {
      failures.push('journey_runnable_task_chain: missing keyword: Smoke Task Chain');
    }
    if (!journeyArtifacts.tasks_markdown.includes('Closure Task ID')) {
      failures.push('journey_runnable_task_chain: missing keyword: Closure Task ID');
    }
    if (!hasJourneyLedger) {
      failures.push('journey_runnable_task_chain: missing journey-ledger source');
    }
    if (!hasTraceMap) {
      failures.push('journey_runnable_task_chain: missing trace-map source');
    }
    for (const gap of activeGaps) {
      const hasTaskIds = gap.task_binding.task_ids.length > 0;
      const hasExplicitDefer = normalizeText(gap.task_binding.explicit_defer_reason) !== '';
      if (!hasTaskIds && !hasExplicitDefer) {
        failures.push(`deferred_gap_task_binding: gap ${gap.gap_id} has neither task_ids nor explicit_defer_reason`);
      }
      if (hasTaskIds && gap.journey_refs.length > 0) {
        if (gap.task_binding.smoke_task_ids.length === 0) {
          failures.push(`journey_runnable_task_chain: gap ${gap.gap_id} is missing smoke_task_ids`);
        }
        if (!normalizeText(gap.task_binding.closure_task_id)) {
          failures.push(`journey_runnable_task_chain: gap ${gap.gap_id} is missing closure_task_id`);
        }
      }
    }
    return { failures, register, journeyArtifacts };
  }

  if (stage === 'implement') {
    if (!hasJourneyLedger) {
      failures.push('journey_runnable_proof_gate: missing journey-ledger source');
    }
    if (!hasTraceMap) {
      failures.push('journey_runnable_proof_gate: missing trace-map source');
    }
    if (!hasClosureNotes) {
      failures.push('journey_runnable_proof_gate: missing closure-note source');
    }

    for (const gap of register.gaps) {
      const implementation = gap.implementation || {};
      const implementationStatus = normalizeGapLifecycleStatus(implementation.status || gap.lifecycle_status);
      if (implementationStatus === 'resolved') {
        if (implementation.closure_evidence.length === 0) {
          failures.push(`deferred_gap_resolution_or_carry_forward: gap ${gap.gap_id} is resolved without closure evidence`);
        }
        if (implementation.production_path_evidence.length === 0 && gap.prod_path_refs.length === 0) {
          failures.push(`production_path_integration_gate: gap ${gap.gap_id} is resolved without production path evidence`);
        }
        if (implementation.smoke_e2e_evidence.length === 0 && gap.smoke_test_refs.length === 0) {
          failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without smoke proof`);
        }
        if (
          implementation.full_e2e_evidence.length === 0 &&
          normalizeText(implementation.full_e2e_defer_reason) === '' &&
          gap.full_e2e_refs.length === 0
        ) {
          failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without full E2E proof or defer reason`);
        }
        if (implementation.acceptance_evidence.length === 0) {
          failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without acceptance evidence`);
        }
        if (gap.journey_refs.length === 0) {
          failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without journey_refs`);
        }
      } else if (isActiveGap(gap)) {
        if (implementation.carry_forward_evidence.length === 0) {
          failures.push(`deferred_gap_resolution_or_carry_forward: gap ${gap.gap_id} remains active without carry-forward evidence`);
        }
      }
    }
    return { failures, register, journeyArtifacts };
  }

  return { failures, register, journeyArtifacts };
}

function readSprintDeferredGapPlan(projectRoot) {
  const sprintPath = path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
  if (!fs.existsSync(sprintPath)) {
    return {
      sprint_path: sprintPath,
      items: new Map(),
    };
  }

  const yaml = parseYamlModule();
  const doc = yaml.load(fs.readFileSync(sprintPath, 'utf8')) || {};
  const rawPlan = doc.deferred_gap_plan || {};
  const items = new Map();
  const rawItems = rawPlan.items || {};

  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      const gapId = normalizeText(item?.gap_id || item?.id);
      if (!gapId) continue;
      items.set(gapId, {
        gap_id: gapId,
        status: normalizeText(item.status),
        resolution_target: normalizeText(item.resolution_target),
        owner: normalizeText(item.owner),
        explicit_reason: normalizeText(item.explicit_reason || item.rationale),
        planned_work_items: Array.isArray(item.planned_work_items)
          ? item.planned_work_items.map((value) => normalizeText(value)).filter(Boolean)
          : [],
      });
    }
  } else if (rawItems && typeof rawItems === 'object') {
    for (const [gapId, item] of Object.entries(rawItems)) {
      const normalizedGapId = normalizeText(gapId);
      if (!normalizedGapId) continue;
      items.set(normalizedGapId, {
        gap_id: normalizedGapId,
        status: normalizeText(item?.status),
        resolution_target: normalizeText(item?.resolution_target),
        owner: normalizeText(item?.owner),
        explicit_reason: normalizeText(item?.explicit_reason || item?.rationale),
        planned_work_items: Array.isArray(item?.planned_work_items)
          ? item.planned_work_items.map((value) => normalizeText(value)).filter(Boolean)
          : Array.isArray(item?.planned_story_keys)
            ? item.planned_story_keys.map((value) => normalizeText(value)).filter(Boolean)
            : [],
      });
    }
  }

  return {
    sprint_path: sprintPath,
    items,
  };
}

function resolveGapLifecycleStatus(gap, planItem) {
  const explicitStatus = normalizeText(planItem?.status || gap.status).toLowerCase();
  if (['open', 'deferred', 'in_progress', 'resolved', 'expired'].includes(explicitStatus)) {
    return explicitStatus;
  }
  if (planItem?.planned_work_items?.length) {
    return 'in_progress';
  }
  return 'deferred';
}

function isExpiredByDate(resolutionTarget) {
  const dateToken = extractDateToken(resolutionTarget);
  if (!dateToken) return false;
  const target = Date.parse(`${dateToken}T23:59:59Z`);
  if (Number.isNaN(target)) return false;
  return Date.now() > target;
}

function buildDeferredGapStatusItems(projectRoot) {
  const reports = listReadinessReports(projectRoot);
  const grouped = new Map();

  for (const reportPath of reports) {
    const key = path.dirname(reportPath);
    const list = grouped.get(key) || [];
    list.push(reportPath);
    grouped.set(key, list);
  }

  const sprintPlan = readSprintDeferredGapPlan(projectRoot);
  const statusItems = [];
  const removedWithoutEvidence = [];
  const alerts = [];

  for (const reportGroup of grouped.values()) {
    const ordered = [...reportGroup].sort((left, right) => reportSortValue(left) - reportSortValue(right));
    for (let index = 1; index < ordered.length; index += 1) {
      const comparison = compareDeferredGapReports(ordered[index], ordered[index - 1]);
      for (const removed of comparison.removed_without_evidence) {
        removedWithoutEvidence.push({
          gap_id: removed.gap_id,
          previous_report: ordered[index - 1],
          current_report: ordered[index],
        });
        alerts.push(`Gap ${removed.gap_id} was removed without resolution evidence between ${path.basename(ordered[index - 1])} and ${path.basename(ordered[index])}`);
      }
    }

    const latestReportPath = ordered[ordered.length - 1];
    const latest = readDeferredGapsFromReport(latestReportPath);
    for (const gap of latest.gaps) {
      const planItem = sprintPlan.items.get(gap.gap_id) || null;
      let status = resolveGapLifecycleStatus(gap, planItem);
      if (status !== 'resolved' && isExpiredByDate(planItem?.resolution_target || gap.resolution_target)) {
        status = 'expired';
      }

      const owner = normalizeText(planItem?.owner || gap.owner);
      const resolutionTarget = normalizeText(planItem?.resolution_target || gap.resolution_target);
      const plannedWorkItems = planItem?.planned_work_items || [];
      const explicitReason = normalizeText(planItem?.explicit_reason);

      let currentRisk = gap.current_risk || '';
      if (!currentRisk) {
        if (status === 'expired') {
          currentRisk = '高风险';
        } else if (!owner) {
          currentRisk = '高风险';
        } else if (status === 'in_progress') {
          currentRisk = '低风险';
        } else if (!plannedWorkItems.length && !explicitReason) {
          currentRisk = '可能漂移';
        } else {
          currentRisk = '低风险';
        }
      }

      if (!owner) {
        alerts.push(`Gap ${gap.gap_id} is missing an owner in the latest readiness/sprint plan state`);
      }
      if (status === 'expired') {
        alerts.push(`Gap ${gap.gap_id} exceeded resolution_target ${resolutionTarget || '(missing target)'}`);
      }

      statusItems.push({
        gap_id: gap.gap_id,
        description: gap.description || '',
        reason: gap.reason || '',
        resolution_target: resolutionTarget,
        owner,
        status_checkpoint: gap.status_checkpoint || '',
        status,
        current_risk: currentRisk,
        planned_work_items: plannedWorkItems,
        explicit_reason: explicitReason,
        source_report: latestReportPath,
      });
    }
  }

  statusItems.sort((left, right) => left.gap_id.localeCompare(right.gap_id));

  return {
    sprint_plan_path: sprintPlan.sprint_path,
    status_items: statusItems,
    removed_without_evidence: removedWithoutEvidence,
    alert_messages: [...new Set(alerts)],
    readiness_report_count: reports.length,
  };
}

function buildDeferredGapAudit(projectRoot) {
  const built = buildDeferredGapStatusItems(projectRoot);
  const explicitCount = built.status_items.length;
  return {
    project_root: projectRoot,
    generated_at: new Date().toISOString(),
    readiness_report_count: built.readiness_report_count,
    deferred_gap_count: explicitCount,
    deferred_gaps_explicit: explicitCount > 0,
    sprint_plan_path: built.sprint_plan_path,
    gaps: built.status_items,
    removed_without_evidence: built.removed_without_evidence,
    alerts: built.alert_messages,
    alert_count: built.alert_messages.length,
    status: built.alert_messages.length > 0 ? 'alert' : 'ok',
  };
}

function renderDeferredGapMarkdownTable(audit) {
  const lines = ['## Deferred Gaps Status', ''];
  if (!audit.gaps || audit.gaps.length === 0) {
    lines.push('暂无 Deferred Gaps。');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Gap ID | 状态 | 目标 Sprint / Resolution Target | 当前风险 | Owner |');
  lines.push('|--------|------|-------------------------------|----------|-------|');
  for (const gap of audit.gaps) {
    lines.push(
      `| ${gap.gap_id} | ${gap.status || 'deferred'} | ${gap.resolution_target || '(none)'} | ${gap.current_risk || '(none)'} | ${gap.owner || '(missing)'} |`
    );
  }
  lines.push('');
  if (audit.alert_count > 0) {
    lines.push('### Deferred Gap Alerts');
    lines.push('');
    for (const alert of audit.alerts) {
      lines.push(`- ${alert}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function resolveDeferredGapRegisterPath(projectRoot, artifactPath) {
  return resolveDeferredGapRegisterLocation(projectRoot, { artifactPath }).register_path;
}

module.exports = {
  collectSections,
  extractDeferredGapsFromMarkdown,
  readDeferredGapsFromReport,
  listReadinessReports,
  findPreviousReadinessReport,
  compareDeferredGapReports,
  deriveReadinessRemediationArtifactPath,
  readSprintDeferredGapPlan,
  buildDeferredGapAudit,
  renderDeferredGapMarkdownTable,
  resolveDeferredGapRegisterPath,
  loadDeferredGapRegister,
  collectJourneyArtifacts,
  validateJourneyArtifactPrecedence,
  validateDeferredGapStageContract,
  isActiveGap,
};
