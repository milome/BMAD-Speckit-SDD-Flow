#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('./load-js-yaml');
const {
  evaluateTargetModificationPathCoverage,
} = require('./target_modification_path_coverage');
const {
  classifyConfirmationDrift,
  SEMANTIC_RECONFIRMATION_REQUIRED,
  STALE_BOOKKEEPING_REPAIR_REQUIRED,
  PROJECTION_REFRESH_REQUIRED,
} = require('./confirmation_drift_classifier');

const VALID_LANGUAGES = new Set(['zh-CN', 'en-US', 'bilingual']);
const VALID_ENTRY_FLOWS = new Set(['bugfix', 'standalone_tasks', 'story']);
const VALID_ENTRY_FLOW_CLASSES = new Set([
  'corrective_entry',
  'task_packet_entry',
  'full_story_entry',
]);
const VALID_WORKFLOW_ADAPTERS = new Set(['direct', 'legacy', 'bmad', 'speckit']);
const VALID_THEMES = new Set(['readable', 'compact', 'audit']);
const VALID_RENDER_MODES = new Set(['confirmation', 'closeout-review']);
const ID_PATTERN = /\b(MUST|NEG|OUT|EVD|TRACE|ACC|E2E|FAIL|EDGE|ART|CMD|TASK|SEQ|FLOW|BOUNDARY|Q)-[A-Za-z0-9_.:-]+\b/g;
const SELF_PAGE_HASH_PLACEHOLDER = 'sha256:SELF_CONFIRMATION_PAGE_HASH';
const SELF_CLOSEOUT_PAGE_HASH_PLACEHOLDER = 'sha256:SELF_CLOSEOUT_CONFIRMATION_PAGE_HASH';
const GENERATED_AT_HASH_PLACEHOLDER = 'CONFIRMATION_GENERATED_AT_HASH_PLACEHOLDER';
const CURRENT_TARGET_SCHEMA_VERSION = 'current-target-map/v1';
const CURRENT_TARGET_DISPLAY_PROFILE = 'closed_loop_current_target_map';
const CURRENT_TARGET_REQUIRED_VIEW_PACK = 'currentTargetMap';
const CURRENT_TARGET_MINIMUM_COVERAGE = {
  currentSummary: 1,
  targetSummary: 1,
  diffRows: 3,
  process: 1,
  artifactPaths: 1,
};
const REQUIRED_PRE_CONFIRMATION_DRILLDOWN_SECTIONS = [
  'Pre-Confirmation Semantic Drilldown',
  'Semantic Kernel Summary',
  'MUST Decomposition Packet',
  'Atomicity Drivers',
  'Atomic Task Baseline',
  'Projection Coverage',
  'Critical Auditor Convergence',
  'Gap History',
  'Packet-To-Source Reconciliation',
];
const DEFAULT_CONFIRMATION_PROFILE = 'implementation_confirmation';
const REQUIRED_APPLICABILITY_DOMAINS = [
  'governanceEvents',
  'runtimeRecovery',
  'scoringDashboardSft',
  'currentTargetMap',
  'scriptsAndHooks',
  'aiTddContractGate',
];
const CORE_VIEW_PACKS = [
  'coreDesign',
  'decisionSummary',
  'confirmationInstruction',
  'requirements',
  'businessVisuals',
  'resumeFailureCases',
  'traceMatrix',
  'targetModificationPaths',
  'artifactAutomationPlan',
  'architectureImpact',
  'entryFlow',
  'scoringDashboardSft',
  'closeoutPreview',
  'issues',
  'eightQuestions',
];
const GOVERNANCE_VIEW_PACKS = ['currentTargetMap', 'sixMentalModels', 'doubleGates'];
const KNOWN_VIEW_PACKS = new Set([...CORE_VIEW_PACKS, ...GOVERNANCE_VIEW_PACKS]);
const SKILL_MERMAID_BUNDLE_PATH = path.join(
  __dirname,
  '..',
  'assets',
  'mermaid',
  'mermaid.min.js'
);
const PROJECT_MERMAID_BUNDLE_PATH = path.join(
  process.cwd(),
  'node_modules',
  'mermaid',
  'dist',
  'mermaid.min.js'
);
const BUSINESS_EDGE_PATTERN =
  /^\s*(?:[A-Za-z0-9_()[\]\s-]+(?:->>|-->>|->|-->|-\)|-\]|\)|\])|[A-Za-z0-9_()[\]\s-]+--[A-Za-z0-9_()[\]\s-]+:|[A-Za-z0-9_()[\]\s-]+-->|[A-Za-z0-9_()[\]\s-]+:)\s*(.+)$/;

const CURRENT_TARGET_TABLE_PROFILES = {
  sourceReferences: {
    title: '来源',
    className: 'compact-map-table profile-source-references',
    emptyStateText: '源文档未提供 sourceReferences[]。',
    fields: [
      { key: 'path', header: '来源路径', cell: 'code', width: '34%', required: true },
      { key: 'description', header: '说明', cell: 'text', width: '46%', required: true },
      { key: 'sourceOfTruthRole', header: '事实源角色', cell: 'tag', width: '20%', required: false },
    ],
  },
  metrics: {
    title: '指标',
    className: 'compact-map-table profile-metrics',
    emptyStateText: '源文档未提供 metrics[]。',
    fields: [
      { key: 'value', header: '值', cell: 'text', width: '24%', required: true },
      { key: 'label', header: '指标', cell: 'text', width: '56%', required: true },
      { key: 'tone', header: '强调', cell: 'tag', width: '20%', required: false },
    ],
  },
  currentSummary: {
    title: '当前现状',
    className: 'compact-map-table profile-current-summary',
    emptyStateText: '源文档未提供 currentSummary[]。',
    fields: [
      { key: 'title', header: '标题', cell: 'text', width: '30%', required: true },
      { key: 'detail', header: '说明', cell: 'text', width: '58%', required: true },
      { key: 'tone', header: '强调', cell: 'tag', width: '12%', required: false },
    ],
  },
  targetSummary: {
    title: '目标态',
    className: 'compact-map-table profile-target-summary',
    emptyStateText: '源文档未提供 targetSummary[]。',
    fields: [
      { key: 'title', header: '标题', cell: 'text', width: '30%', required: true },
      { key: 'detail', header: '说明', cell: 'text', width: '58%', required: true },
      { key: 'tone', header: '强调', cell: 'tag', width: '12%', required: false },
    ],
  },
  diffRows: {
    title: '核心差异',
    className: 'compact-map-table profile-diff-rows',
    emptyStateText: '源文档未提供 diffRows[]。',
    fields: [
      { key: 'id', header: 'ID', cell: 'code', width: '12%', required: false },
      { key: 'dimension', header: '维度', cell: 'text', width: '18%', required: true },
      { key: 'currentState', header: '当前', cell: 'text', width: '27%', required: true },
      { key: 'targetState', header: '目标', cell: 'text', width: '27%', required: true },
      { key: 'action', header: '动作', cell: 'tag', width: '16%', required: true },
    ],
  },
  targetFlow: {
    title: '目标流',
    className: 'compact-map-table profile-target-flow',
    emptyStateText: '源文档未提供 targetFlow[]。',
    fields: [
      { key: 'stepTitle', header: '步骤', cell: 'text', width: '24%', required: true },
      { key: 'description', header: '说明', cell: 'text', width: '48%', required: true },
      { key: 'output', header: '输出', cell: 'code', width: '16%', required: false },
      { key: 'ownerModel', header: 'ownerModel', cell: 'tag', width: '12%', required: false },
    ],
  },
  mentalModels: {
    title: '六个心智模型',
    className: 'compact-map-table profile-mental-models',
    emptyStateText: '源文档未提供 mentalModels[]。',
    fields: [
      { key: 'name', header: '模型', cell: 'text', width: '24%', required: true },
      { key: 'question', header: '用户问题', cell: 'text', width: '48%', required: true },
      { key: 'status', header: '状态', cell: 'code', width: '28%', required: true },
    ],
  },
  canonicalArtifacts: {
    title: '目标 canonical 工件',
    className: 'compact-map-table profile-canonical-artifacts',
    emptyStateText: '源文档未提供 canonicalArtifacts[]。',
    fields: [
      { key: 'targetPathOrField', header: '目标路径 / 字段', cell: 'code', width: '34%', required: true },
      { key: 'functionDescription', header: '功能描述', cell: 'text', width: '44%', required: true },
      { key: 'controlPlaneRole', header: '控制层角色', cell: 'tag', width: '22%', required: true },
    ],
  },
  pathRegistry: {
    title: '目标态运行追踪工件路径冻结注册表',
    className: 'compact-map-table profile-path-registry',
    emptyStateText: '源文档未提供 pathRegistry[]。',
    fields: [
      { key: 'category', header: '类别', cell: 'text', width: '20%', required: true },
      { key: 'fixedPath', header: '固定路径', cell: 'code', width: '40%', required: true },
      { key: 'sourceOfTruthRole', header: 'sourceOfTruthRole', cell: 'tag', width: '18%', required: true },
      { key: 'description', header: '说明', cell: 'text', width: '22%', required: true },
    ],
  },
  existingArtifacts: {
    title: '现有工件地图与目标处理方式',
    className: 'compact-map-table profile-existing-artifacts',
    emptyStateText: '源文档未提供 existingArtifacts[]。',
    fields: [
      { key: 'currentPath', header: '现有路径', cell: 'code', width: '32%', required: true },
      { key: 'currentFunction', header: '当前功能', cell: 'text', width: '22%', required: true },
      { key: 'targetTreatment', header: '目标处理', cell: 'text', width: '30%', required: true },
      { key: 'completionProofPolicy', header: '完成证明策略', cell: 'tag', width: '16%', required: true },
    ],
  },
  scriptConvergence: {
    title: '脚本与配置：当前地图 -> 目标收敛',
    className: 'compact-map-table profile-script-convergence',
    emptyStateText: '源文档未提供 scriptConvergence[]。',
    fields: [
      { key: 'scriptOrConfigPath', header: '脚本 / 配置路径', cell: 'code', width: '26%', required: true },
      { key: 'currentFunction', header: '当前功能描述', cell: 'text', width: '24%', required: true },
      { key: 'targetOwnerModel', header: '目标 ownerModel', cell: 'tag', width: '18%', required: true },
      { key: 'targetWritesOrOutputs', header: '目标写入 / 输出', cell: 'code', width: '20%', required: true },
      { key: 'completionAuthority', header: '完成权限', cell: 'tag', width: '12%', required: true },
    ],
  },
  hookConvergence: {
    title: 'Hooks 与 no-hook：路径、职责和收敛目标',
    className: 'compact-map-table profile-hook-convergence',
    emptyStateText: '源文档未提供 hookConvergence[]。',
    fields: [
      { key: 'layer', header: '层级', cell: 'text', width: '16%', required: true },
      { key: 'hostHookPaths', header: 'Claude / Cursor / Codex 路径', cell: 'code', width: '24%', required: true },
      { key: 'sharedCore', header: '共享核心', cell: 'code', width: '22%', required: true },
      { key: 'responsibility', header: '职责', cell: 'text', width: '18%', required: true },
      { key: 'targetBoundary', header: '目标边界', cell: 'tag', width: '10%', required: true },
      { key: 'fallbackPolicy', header: 'fallback', cell: 'text', width: '10%', required: true },
    ],
  },
  noHookTargets: {
    title: '目标 no-hook 等价与边界',
    className: 'compact-map-table profile-no-hook-targets',
    emptyStateText: '源文档未提供 noHookTargets[]。',
    fields: [
      { key: 'title', header: '目标', cell: 'text', width: '30%', required: true },
      { key: 'detail', header: '说明', cell: 'text', width: '70%', required: true },
    ],
  },
  retainedScriptTypes: {
    title: '目标收敛后应保留 / 新增 / 降级的脚本类型',
    className: 'compact-map-table profile-retained-script-types',
    emptyStateText: '源文档未提供 retainedScriptTypes[]。',
    fields: [
      { key: 'category', header: '类别', cell: 'tag', width: '18%', required: true },
      { key: 'representativePaths', header: '代表路径', cell: 'code', width: '30%', required: true },
      { key: 'targetTreatment', header: '目标处理', cell: 'text', width: '30%', required: true },
      { key: 'reason', header: '原因', cell: 'text', width: '22%', required: true },
    ],
  },
  requirementGeneration: {
    title: '需求生成方式',
    className: 'compact-map-table profile-requirement-generation',
    emptyStateText: '源文档未提供 requirementGeneration[]。',
    fields: [
      { key: 'dimension', header: '维度', cell: 'text', width: '24%', required: true },
      { key: 'currentState', header: '当前现状', cell: 'text', width: '38%', required: true },
      { key: 'targetState', header: '目标态', cell: 'text', width: '38%', required: true },
    ],
  },
  facts: {
    title: '事实源',
    className: 'compact-map-table profile-facts',
    emptyStateText: '源文档未提供 facts[]。',
    fields: [
      { key: 'currentState', header: '当前现状', cell: 'text', width: '50%', required: true },
      { key: 'targetState', header: '目标态', cell: 'text', width: '50%', required: true },
    ],
  },
  process: {
    title: '流程',
    className: 'compact-map-table profile-process',
    emptyStateText: '源文档未提供 process[]。',
    fields: [
      { key: 'id', header: 'ID', cell: 'code', width: '12%', required: false },
      { key: 'phase', header: '阶段', cell: 'text', width: '20%', required: true },
      { key: 'currentState', header: '当前', cell: 'text', width: '34%', required: true },
      { key: 'targetState', header: '目标', cell: 'text', width: '34%', required: true },
    ],
  },
  artifactPaths: {
    title: '产物路径：当前路径 -> 目标角色',
    className: 'compact-map-table profile-artifact-paths',
    emptyStateText: '源文档未提供 artifactPaths[]。',
    fields: [
      { key: 'path', header: '路径', cell: 'code', width: '56%', required: true },
      { key: 'targetRole', header: '目标角色', cell: 'tag', width: '44%', required: true },
    ],
  },
  architecture: {
    title: '架构对比',
    className: 'compact-map-table profile-architecture',
    emptyStateText: '源文档未提供 architecture[]。',
    fields: [
      { key: 'dimension', header: '维度', cell: 'text', width: '24%', required: true },
      { key: 'currentState', header: '当前', cell: 'text', width: '38%', required: true },
      { key: 'targetState', header: '目标', cell: 'text', width: '38%', required: true },
    ],
  },
  doubleGateFields: {
    title: '双唯一门禁字段',
    className: 'compact-map-table profile-double-gates',
    emptyStateText: '源文档未提供 doubleGates.gates[]。',
    fields: [
      { key: 'gate', header: '门禁', cell: 'text', width: '24%', required: true },
      { key: 'uniqueness', header: '唯一性', cell: 'tag', width: '20%', required: true },
      { key: 'inputs', header: '输入', cell: 'text', width: '28%', required: true },
      { key: 'outputs', header: '输出', cell: 'code', width: '28%', required: true },
    ],
  },
  envelopeRules: {
    title: 'typed envelope 规则',
    className: 'compact-map-table profile-envelope-rules',
    emptyStateText: '源文档未提供 doubleGates.envelopeRules[]。',
    fields: [
      { key: 'title', header: '规则', cell: 'text', width: '28%', required: true },
      { key: 'text', header: '说明', cell: 'text', width: '72%', required: true },
    ],
  },
};

function parseArgs(argv) {
  const args = { strict: true, json: false, mode: 'confirmation', theme: 'readable' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--require-mermaid-runtime') {
      args.requireMermaidRuntime = true;
      continue;
    }
    if (arg === '--allow-mermaid-fallback') {
      args.allowMermaidFallback = true;
      continue;
    }
    if (arg === '--strict') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.strict = !['false', '0', 'no'].includes(String(next).toLowerCase());
        i += 1;
      } else {
        args.strict = true;
      }
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function hashObject(value) {
  return sha256(stableStringify(value));
}

const CONFIRMATION_BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!CONFIRMATION_BOOKKEEPING_FIELDS.has(key)) {
      semantic[key] = value;
    }
  }
  return semantic;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  return sha256(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return hashObject(semanticConfirmationForHash(confirmation));
}

function confirmationPageHashFor(htmlWithSelfHashPlaceholder, generatedAt) {
  return sha256(htmlWithSelfHashPlaceholder.replaceAll(generatedAt, GENERATED_AT_HASH_PLACEHOLDER));
}

function closeoutConfirmationPageHashFor(htmlWithSelfHashPlaceholder, generatedAt) {
  return sha256(
    htmlWithSelfHashPlaceholder
      .replaceAll(generatedAt, GENERATED_AT_HASH_PLACEHOLDER)
      .replaceAll(SELF_CLOSEOUT_PAGE_HASH_PLACEHOLDER, SELF_PAGE_HASH_PLACEHOLDER)
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function inlineCode(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function extractPathRefs(value) {
  const refs = new Set();
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
  const matches = normalized.matchAll(
    /(?<![A-Za-z0-9_@.-])((?:[A-Za-z]:)?[./\\A-Za-z0-9_-][A-Za-z0-9_./\\-]*\.(?:test|spec)\.(?:tsx|ts|jsx|js|mjs|cjs)|[./\\A-Za-z0-9_-][A-Za-z0-9_./\\-]*\.(?:tsx|ts|jsx|json|mjs|cjs|js|ya?ml|md))(?=$|[^A-Za-z0-9_.-])/giu
  );
  for (const match of matches) refs.add(match[1]);
  return [...refs];
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value ?? {}, key);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeViewPackList(value) {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return unique(stringList(value).map((item) => item.trim()));
}

function resolveConfirmationProfile(confirmation) {
  const confirmationProfile =
    String(confirmation?.confirmationProfile ?? DEFAULT_CONFIRMATION_PROFILE).trim() ||
    DEFAULT_CONFIRMATION_PROFILE;
  const declaredRequired = normalizeViewPackList(confirmation?.requiredViewPacks);
  const declaredOptional = normalizeViewPackList(confirmation?.optionalViewPacks);
  const requiredViewPacks = unique([...CORE_VIEW_PACKS, ...declaredRequired]);
  const optionalViewPacks = unique(declaredOptional);
  const enabledViewPacks = unique([...requiredViewPacks, ...optionalViewPacks]);
  const unknownViewPacks = enabledViewPacks.filter((item) => !KNOWN_VIEW_PACKS.has(item));
  return {
    confirmationProfile,
    requiredViewPacks,
    optionalViewPacks,
    enabledViewPacks,
    enabledViewPackSet: new Set(enabledViewPacks),
    optionalViewPacksSkipped: [...KNOWN_VIEW_PACKS].filter(
      (item) => !enabledViewPacks.includes(item) && !CORE_VIEW_PACKS.includes(item)
    ),
    unknownViewPacks,
  };
}

function viewPackEnabled(profile, pack) {
  return profile?.enabledViewPackSet?.has(pack) === true;
}

function viewPackRequired(profile, pack) {
  return asArray(profile?.requiredViewPacks).includes(pack);
}

function extractIds(value) {
  return unique(String(value ?? '').match(ID_PATTERN) ?? []);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readDataFile(filePath) {
  const raw = readText(filePath);
  if (/\.ya?ml$/iu.test(filePath)) return yaml.load(raw);
  return JSON.parse(raw);
}

function readJsonSafe(filePath) {
  try {
    if (!filePath || !fs.existsSync(path.resolve(filePath))) return { ok: false, missing: true, path: filePath };
    return { ok: true, value: readDataFile(path.resolve(filePath)), path: path.resolve(filePath) };
  } catch (error) {
    return {
      ok: false,
      missing: false,
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function defaultRequirementRecordPath(recordId) {
  return path.resolve('_bmad-output', 'runtime', 'requirement-records', recordId, 'requirement-record.json');
}

function readRequirementRecord(args, recordId) {
  const requestedPath = args.requirementRecord
    ? path.resolve(args.requirementRecord)
    : defaultRequirementRecordPath(recordId);
  if (!recordId || recordId === 'unrecorded') {
    return {
      path: requestedPath,
      found: false,
      record: null,
      loadError: null,
      source: args.requirementRecord ? 'explicit' : 'default',
    };
  }
  if (!fs.existsSync(requestedPath)) {
    return {
      path: requestedPath,
      found: false,
      record: null,
      loadError: null,
      source: args.requirementRecord ? 'explicit' : 'default',
    };
  }
  try {
    return {
      path: requestedPath,
      found: true,
      record: readDataFile(requestedPath),
      loadError: null,
      source: args.requirementRecord ? 'explicit' : 'default',
    };
  } catch (error) {
    return {
      path: requestedPath,
      found: false,
      record: null,
      loadError: error instanceof Error ? error.message : String(error),
      source: args.requirementRecord ? 'explicit' : 'default',
    };
  }
}

function defaultAuthoringDir(recordId) {
  return path.resolve('_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
}

function defaultPreRenderMustGateReportPath(recordId) {
  return path.join(defaultAuthoringDir(recordId), 'pre-render-must-decomposition-gate-report.json');
}

function authoringRepairIssue(message, refs = []) {
  return {
    ...blocking('pre_confirmation_authoring_repair_required', message, refs),
    legacyCode: 'missing_pre_confirmation_semantic_drilldown_gate_report',
    repairAction: 'run_authoring_repair_preserve_existing',
    repairCommand: 'main-agent-orchestration --action authoring-repair --mode preserve-existing --source <source> --json',
  };
}

function loadPreConfirmationSemanticDrilldown(args, confirmation, hashes) {
  const explicitPath =
    args.drilldownGateReport ??
    args.mustDecompositionGateReport ??
    args.preRenderMustDecompositionGateReport ??
    confirmation.preConfirmationDrilldown?.preRenderGateReportPath ??
    confirmation.preConfirmationDrilldown?.mustDecompositionGateReportPath;
  const reportPath = explicitPath || (confirmation.recordId ? defaultPreRenderMustGateReportPath(confirmation.recordId) : '');
  const issues = [];
  if (!reportPath) {
    issues.push(authoringRepairIssue('pre-render MUST decomposition gate report is required before confirmation HTML'));
    return {
      status: 'missing',
      reportPath: '',
      report: null,
      blockingIssues: issues,
      warnings: [],
      requiredSections: REQUIRED_PRE_CONFIRMATION_DRILLDOWN_SECTIONS,
    };
  }
  const read = readJsonSafe(reportPath);
  if (!read.ok) {
    issues.push(
      read.missing
        ? authoringRepairIssue(
            read.error ?? 'pre-render MUST decomposition gate report is missing or unreadable',
            [normalizePathForReport(path.resolve(reportPath))]
          )
        : blocking(
        'pre_confirmation_semantic_drilldown_gate_report_parse_failed',
        read.error ?? 'pre-render MUST decomposition gate report is missing or unreadable',
        [normalizePathForReport(path.resolve(reportPath))]
      )
    );
    return {
      status: 'blocked',
      reportPath: normalizePathForReport(path.resolve(reportPath)),
      report: null,
      blockingIssues: issues,
      warnings: [],
      requiredSections: REQUIRED_PRE_CONFIRMATION_DRILLDOWN_SECTIONS,
    };
  }
  const report = read.value;
  if (report.schemaVersion !== 'pre-render-must-decomposition-gate-report/v1' && report.schemaVersion !== 'semantic-checkpoint-pre-render-gate/v1') {
    issues.push(blocking('pre_confirmation_semantic_drilldown_gate_schema_invalid', 'drilldown gate report schemaVersion is invalid', ['schemaVersion']));
  }
  if (report.sourceDocumentHash && report.sourceDocumentHash !== hashes.sourceDocumentHash) {
    issues.push(blocking('pre_confirmation_semantic_drilldown_gate_source_hash_stale', 'drilldown gate report sourceDocumentHash is stale', ['sourceDocumentHash']));
  }
  if (report.implementationConfirmationHash && report.implementationConfirmationHash !== hashes.implementationConfirmationHash) {
    issues.push(
      blocking(
        'pre_confirmation_semantic_drilldown_gate_implementation_hash_stale',
        'drilldown gate report implementationConfirmationHash is stale',
        ['implementationConfirmationHash']
      )
    );
  }
  if (report.verdict !== 'PASS' || report.confirmability === 'blocked') {
    for (const code of asArray(report.failedChecks)) {
      issues.push(blocking(`pre_confirmation_semantic_drilldown_${code}`, `drilldown gate failed: ${code}`, [code]));
    }
    if (!asArray(report.failedChecks).length) {
      issues.push(blocking('pre_confirmation_semantic_drilldown_gate_failed', 'drilldown gate verdict is not PASS'));
    }
  }
  if ((report.criticalAuditor?.consecutiveNoNewGapRounds ?? 0) < 3) {
    issues.push(blocking('pre_confirmation_semantic_drilldown_less_than_three_critic_rounds', 'Critical Auditor convergence is below three no-new-gap rounds'));
  }
  if (report.packetSourceReconciliation?.verdict && report.packetSourceReconciliation.verdict !== 'pass') {
    issues.push(blocking('pre_confirmation_semantic_drilldown_reconciliation_failed', 'packet/source reconciliation did not pass'));
  }
  if (issues.length) {
    issues.push(
      authoringRepairIssue('pre-confirmation authoring repair must be rerun before rendering confirmation HTML', [
        normalizePathForReport(path.resolve(reportPath)),
      ])
    );
  }
  return {
    status: issues.length ? 'blocked' : 'pass',
    reportPath: normalizePathForReport(path.resolve(reportPath)),
    report,
    blockingIssues: issues,
    warnings: [],
    requiredSections: REQUIRED_PRE_CONFIRMATION_DRILLDOWN_SECTIONS,
  };
}

function normalizePathForReport(filePath) {
  return filePath.replace(/\\/g, '/');
}

function inferSourceType(sourcePath, sourceText, entryFlow) {
  const name = path.basename(sourcePath).toLowerCase();
  if (entryFlow === 'bugfix' || /bugfix|bug[-_ ]?report/.test(name)) return 'BUGFIX';
  if (entryFlow === 'standalone_tasks' || /tasks?[_-]/.test(name)) return 'TASKS';
  if (/story/.test(name)) return 'Story';
  if (/prd/.test(name)) return 'PRD';
  if (/^#\s*story\b/imu.test(sourceText)) return 'Story';
  if (/^#\s*bugfix\b/imu.test(sourceText)) return 'BUGFIX';
  if (/^#\s*tasks?\b/imu.test(sourceText)) return 'TASKS';
  return 'PRD';
}

function extractImplementationConfirmation(sourceText) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    throw new Error('missing implementationConfirmation block');
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = i;
      break;
    }
  }

  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText);
  if (!parsed || typeof parsed !== 'object' || !parsed.implementationConfirmation) {
    throw new Error('implementationConfirmation block is not valid YAML');
  }
  return { blockText, confirmation: parsed.implementationConfirmation };
}

function extractFunctionalResumeFailureCaseRegistry(sourceText) {
  const registries = [];
  const blocks = [...sourceText.matchAll(/```yaml\s*\n([\s\S]*?)```/giu)];
  for (const match of blocks) {
    let parsed;
    try {
      parsed = yaml.load(match[1]);
    } catch {
      continue;
    }
    if (parsed?.functionalResumeFailureCaseRegistry) {
      registries.push(parsed.functionalResumeFailureCaseRegistry);
    }
  }
  return registries.at(-1) ?? null;
}

function normalizeGovernanceEventTypeRegistryPolicy(confirmation, schemaIssues) {
  const raw = confirmation?.governanceEventTypeRegistryPolicy;
  if (!raw || typeof raw !== 'object') {
    schemaIssues.push(blocking('governance_event_type_registry_policy_missing', 'governanceEventTypeRegistryPolicy is required'));
    return null;
  }
  const controlFieldVocabulary = new Set();
  stringList(raw.controlFieldVocabulary).forEach((field) => {
    if (controlFieldVocabulary.has(field)) {
      schemaIssues.push(blocking('governance_event_type_policy_control_field_vocabulary_duplicate', `${field} duplicated`, [field]));
    }
    controlFieldVocabulary.add(field);
  });
  const payloadKindContracts = new Map();
  asArray(raw.payloadKindContracts).forEach((row, index) => {
    const payloadKind = String(row?.payloadKind ?? '').trim();
    if (!payloadKind) {
      schemaIssues.push(blocking('governance_event_type_policy_payload_kind_missing', `payloadKindContracts[${index}] missing payloadKind`));
      return;
    }
    if (payloadKindContracts.has(payloadKind)) {
      schemaIssues.push(blocking('governance_event_type_policy_payload_kind_duplicate', `${payloadKind} duplicated`, [payloadKind]));
    }
    payloadKindContracts.set(payloadKind, {
      requiredFields: stringList(row?.requiredFields),
      forbiddenFields: stringList(row?.forbiddenFields),
      allowedControlWriteModes: stringList(row?.allowedControlWriteModes),
    });
  });
  const controlWriteModePolicies = new Map();
  asArray(raw.controlWriteModePolicies).forEach((row, index) => {
    const mode = String(row?.allowedControlWriteMode ?? row?.mode ?? '').trim();
    if (!mode) {
      schemaIssues.push(blocking('governance_event_type_policy_write_mode_missing', `controlWriteModePolicies[${index}] missing allowedControlWriteMode`));
      return;
    }
    if (controlWriteModePolicies.has(mode)) {
      schemaIssues.push(blocking('governance_event_type_policy_write_mode_duplicate', `${mode} duplicated`, [mode]));
    }
    const allowedWritesControlFields = stringList(row?.allowedWritesControlFields);
    for (const field of allowedWritesControlFields) {
      if (!controlFieldVocabulary.has(field)) {
        schemaIssues.push(blocking('governance_event_type_policy_control_field_vocabulary_unknown', `${mode} references unknown ${field}`, [mode, field]));
      }
    }
    controlWriteModePolicies.set(mode, { allowedWritesControlFields });
  });
  const eventSpecificRequirements = new Map();
  asArray(raw.eventSpecificRequirements).forEach((row, index) => {
    const eventType = String(row?.eventType ?? '').trim();
    if (!eventType) {
      schemaIssues.push(blocking('governance_event_type_policy_event_requirement_missing', `eventSpecificRequirements[${index}] missing eventType`));
      return;
    }
    if (eventSpecificRequirements.has(eventType)) {
      schemaIssues.push(blocking('governance_event_type_policy_event_requirement_duplicate', `${eventType} duplicated`, [eventType]));
    }
    eventSpecificRequirements.set(eventType, {
      eventType,
      payloadKind: String(row?.payloadKind ?? '').trim(),
      requiredSourceRefs: row?.requiredSourceRefs === true,
      requiredFields: stringList(row?.requiredFields),
      forbiddenFields: stringList(row?.forbiddenFields),
      allowedControlWriteMode: String(row?.allowedControlWriteMode ?? '').trim(),
    });
  });
  if (!payloadKindContracts.size) {
    schemaIssues.push(blocking('governance_event_type_policy_payload_kind_contracts_missing', 'payloadKindContracts[] is required'));
  }
  if (!controlWriteModePolicies.size) {
    schemaIssues.push(blocking('governance_event_type_policy_control_write_modes_missing', 'controlWriteModePolicies[] is required'));
  }
  if (!controlFieldVocabulary.size) {
    schemaIssues.push(blocking('governance_event_type_policy_control_field_vocabulary_missing', 'controlFieldVocabulary[] is required'));
  }
  return { controlFieldVocabulary, payloadKindContracts, controlWriteModePolicies, eventSpecificRequirements };
}

function validatePayloadContract(eventType, row, policy, schemaIssues) {
  const payloadKind = String(row?.payloadKind ?? '').trim();
  const contract = row?.payloadContract && typeof row.payloadContract === 'object' ? row.payloadContract : null;
  if (!contract) {
    schemaIssues.push(blocking('governance_event_type_missing_payload_contract', `${eventType} missing payloadContract`, [eventType]));
    return {
      requiredFields: [],
      forbiddenFields: [],
      requiredSourceRefs: false,
      allowedControlWriteMode: '',
    };
  }

  const requiredFields = stringList(contract.requiredFields);
  const forbiddenFields = stringList(contract.forbiddenFields);
  const requiredSourceRefs = contract.requiredSourceRefs === true;
  const allowedControlWriteMode = String(contract.allowedControlWriteMode ?? '').trim();
  const payloadKindPolicy = policy?.payloadKindContracts.get(payloadKind);
  const eventPolicy = policy?.eventSpecificRequirements.get(eventType);

  if (!payloadKindPolicy) {
    schemaIssues.push(blocking('governance_event_type_invalid_payload_kind', `${eventType} has invalid payloadKind ${payloadKind}`, [eventType]));
  } else {
    for (const field of payloadKindPolicy.requiredFields) {
      if (!requiredFields.includes(field)) {
        schemaIssues.push(blocking('governance_event_type_payload_contract_missing_required_field', `${eventType} payloadContract.requiredFields missing ${field}`, [eventType, field]));
      }
    }
    for (const field of payloadKindPolicy.forbiddenFields) {
      if (!forbiddenFields.includes(field)) {
        schemaIssues.push(blocking('governance_event_type_payload_contract_missing_forbidden_field', `${eventType} payloadContract.forbiddenFields missing ${field}`, [eventType, field]));
      }
    }
    for (const field of payloadKindPolicy.requiredFields) {
      if (forbiddenFields.includes(field)) {
        schemaIssues.push(blocking('governance_event_type_payload_contract_forbids_payload_field', `${eventType} payloadContract forbids ${field}`, [eventType, field]));
      }
    }
    if (!payloadKindPolicy.allowedControlWriteModes.includes(allowedControlWriteMode)) {
      schemaIssues.push(blocking('governance_event_type_invalid_control_write_mode', `${eventType} has invalid allowedControlWriteMode ${allowedControlWriteMode}`, [eventType]));
    }
  }
  if (eventPolicy) {
    if (eventPolicy.payloadKind && eventPolicy.payloadKind !== payloadKind) {
      schemaIssues.push(blocking('governance_event_type_policy_payload_kind_mismatch', `${eventType} must use payloadKind ${eventPolicy.payloadKind}`, [eventType]));
    }
    for (const field of eventPolicy.requiredFields) {
      if (!requiredFields.includes(field)) {
        schemaIssues.push(blocking('governance_event_type_policy_missing_required_field', `${eventType} policy requires ${field}`, [eventType, field]));
      }
    }
    for (const field of eventPolicy.forbiddenFields) {
      if (!forbiddenFields.includes(field)) {
        schemaIssues.push(blocking('governance_event_type_policy_missing_forbidden_field', `${eventType} policy forbids ${field}`, [eventType, field]));
      }
    }
    if (eventPolicy.requiredSourceRefs === true && requiredSourceRefs !== true) {
      schemaIssues.push(blocking('governance_event_type_payload_contract_missing_source_refs', `${eventType} must require sourceRefs`, [eventType]));
    }
    if (eventPolicy.allowedControlWriteMode && eventPolicy.allowedControlWriteMode !== allowedControlWriteMode) {
      schemaIssues.push(blocking('governance_event_type_policy_wrong_write_mode', `${eventType} must use ${eventPolicy.allowedControlWriteMode}`, [eventType]));
    }
  }

  return {
    requiredFields,
    forbiddenFields,
    requiredSourceRefs,
    allowedControlWriteMode,
  };
}

function validateControlWriteMode(eventType, writesControlFields, payloadContract, policy, schemaIssues) {
  const mode = payloadContract.allowedControlWriteMode;
  const modePolicy = policy?.controlWriteModePolicies.get(mode);
  if (!modePolicy) {
    schemaIssues.push(blocking('governance_event_type_unknown_control_write_mode_policy', `${eventType} missing policy for write mode ${mode}`, [eventType, mode]));
    return;
  }
  for (const field of writesControlFields) {
    if (!policy?.controlFieldVocabulary.has(field)) {
      schemaIssues.push(blocking('governance_event_type_control_field_not_in_vocabulary', `${eventType} writes unknown control field ${field}`, [eventType, field]));
    }
    if (!modePolicy.allowedWritesControlFields.includes(field)) {
      schemaIssues.push(blocking('governance_event_type_control_mode_unknown_field', `${eventType} ${mode} event writes unsupported field ${field}`, [eventType, field]));
    }
  }
}

function normalizeGovernanceEventTypeRegistry(confirmation) {
  const schemaIssues = [];
  const eventTypes = new Map();
  const rows = asArray(confirmation?.governanceEventTypeRegistry);
  const policy = normalizeGovernanceEventTypeRegistryPolicy(confirmation, schemaIssues);
  rows.forEach((row, index) => {
    const eventType = String(row?.eventType ?? '').trim();
    if (!eventType) {
      schemaIssues.push(blocking('governance_event_type_missing_id', `governanceEventTypeRegistry[${index}] missing eventType`));
      return;
    }
    if (eventTypes.has(eventType)) {
      schemaIssues.push(blocking('governance_event_type_duplicate_id', `${eventType} is duplicated`, [eventType]));
    }
    const requiredFields = ['ownerModel', 'payloadKind', 'canAffectControlFlow', 'payloadContract'];
    for (const field of requiredFields) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        schemaIssues.push(blocking('governance_event_type_missing_required_field', `${eventType} missing ${field}`, [eventType, field]));
      }
    }
    const writesControlFields = stringList(row?.writesControlFields);
    const payloadContract = validatePayloadContract(eventType, row, policy, schemaIssues);
    validateControlWriteMode(eventType, writesControlFields, payloadContract, policy, schemaIssues);
    eventTypes.set(eventType, {
      eventType,
      ownerModel: row?.ownerModel ?? '',
      payloadKind: row?.payloadKind ?? '',
      writesControlFields,
      allowedDecisionValues: stringList(row?.allowedDecisionValues),
      allowedStatusValues: stringList(row?.allowedStatusValues),
      payloadContract,
      canAffectControlFlow: row?.canAffectControlFlow === true,
      description: row?.description ?? '',
    });
  });
  return {
    definitions: eventTypes,
    schemaIssues,
  };
}

function classifyMermaidSectionGroup(title, fallback = 'business') {
  const text = String(title ?? '').toLowerCase();
  if (
    /治理|边界|门禁|准出|launch\s*gate|failure\s*path|control|governance|closeout|recovery|resume|current[-\s]?target|double\s*gate|turnstile|rate\s*limit|origin|budget|kill\s*switch/iu.test(
      text
    )
  ) {
    return 'governance';
  }
  if (
    /业务|business|ingest|chat|retrieval|hybrid|rerank|incremental|用户|产品|domain|ingest lifecycle|chat security|chat retrieval|incremental ingest/iu.test(
      text
    )
  ) {
    return 'business';
  }
  return fallback;
}

function inferViewScope(view, businessIds, governanceIds) {
  const explicitScope = String(view?.scope ?? view?.boundaryScope ?? '').toLowerCase();
  if (['business', 'governance', 'mixed'].includes(explicitScope)) return explicitScope;
  const title = `${view?.id ?? ''} ${view?.title ?? ''} ${view?.description ?? ''}`;
  if (
    /治理|边界|门禁|准出|launch\s*gate|control|governance|closeout|recovery|resume|current[-\s]?target|double\s*gate|turnstile|rate\s*limit|origin|budget|kill\s*switch/iu.test(
      title
    )
  ) {
    return 'governance';
  }
  const ids = stringList(view?.covers);
  const hasBusiness = ids.some((id) => businessIds.has(id));
  const hasGovernance = ids.some((id) => governanceIds.has(id));
  if (hasBusiness && hasGovernance) return 'mixed';
  if (hasGovernance) return 'governance';
  return 'business';
}

function inferMermaidBlockScope(block, businessIds, governanceIds) {
  const ids = stringList(block?.ids);
  const hasBusiness = ids.some((id) => businessIds.has(id));
  const hasGovernance = ids.some((id) => governanceIds.has(id));
  if (hasBusiness && hasGovernance) return 'mixed';
  if (hasGovernance) return 'governance';
  if (hasBusiness) return 'business';
  const explicitScope = String(block?.sectionGroup ?? '').toLowerCase();
  if (['business', 'governance', 'mixed'].includes(explicitScope)) return explicitScope;
  if (block?.viewKind === 'boundary') return 'governance';
  if (['happy', 'failure', 'stateFlow', 'edge'].includes(block?.viewKind)) return 'business';
  const title = `${block?.title ?? ''} ${block?.sourceHeading ?? ''}`;
  if (
    /治理|边界|门禁|准出|control|governance|closeout|recovery|resume|current[-\s]?target|double\s*gate|turnstile|rate\s*limit|origin|budget|kill\s*switch/iu.test(
      title
    )
  ) {
    return 'governance';
  }
  if (
    /业务|business|ingest|chat|retrieval|hybrid|rerank|incremental|用户|产品|domain|ingest lifecycle|chat security|chat retrieval|incremental ingest/iu.test(
      title
    )
  ) {
    return 'business';
  }
  return 'business';
}

function extractMermaidBlocks(sourceText) {
  const lines = sourceText.split(/\r?\n/u);
  const blocks = [];
  let currentHeading = '';
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^\s{0,3}#{2,6}\s+(.+?)\s*$/u);
    if (heading) {
      currentHeading = heading[1].trim();
      continue;
    }
    if (!/^\s*```mermaid\b/iu.test(lines[index])) continue;
    const body = [];
    index += 1;
    while (index < lines.length && !/^\s*```\s*$/u.test(lines[index])) {
      body.push(lines[index]);
      index += 1;
    }
    const source = body.join('\n').trim();
    const id = `MERMAID-${String(blocks.length + 1).padStart(3, '0')}`;
    blocks.push(
      makeMermaidBlock(id, source, 'source', 'source_mermaid_block', {
        title: currentHeading || id,
        sourceHeading: currentHeading,
        sectionGroup: classifyMermaidSectionGroup(currentHeading, 'business'),
      })
    );
  }
  return blocks;
}

function makeMermaidBlock(id, source, viewKind, generatedFrom, meta = {}) {
  const renderSource = mermaidRenderSource(source);
  return {
    id,
    title: meta.title ?? id,
    source,
    renderSource,
    diagramHash: sha256(source),
    ids: extractIds(source),
    unboundLines: findUnboundDiagramSemantics(source),
    viewKind,
    generatedFrom,
    sectionGroup: meta.sectionGroup ?? 'business',
    sourceHeading: meta.sourceHeading ?? '',
  };
}

function quoteMermaidLabel(label) {
  return `"${String(label ?? '')
    .replace(/"/gu, "'")
    .replace(/\r?\n/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()}"`;
}

function safeMermaidNodeLabel(label) {
  const unquoted = String(label ?? '')
    .trim()
    .replace(/^["'](.+)["']$/u, '$1');
  return quoteMermaidLabel(
    unquoted
      .replace(/\[([A-Z]+-\d+[A-Z]*)\]/gu, ' $1 ')
      .replace(/[{}]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

function sanitizeMermaidNodeLabels(line) {
  return String(line ?? '')
    .replace(/(\b[A-Za-z][\w-]*)\[((?:[^\[\]\r\n]|\[[A-Z]+-\d+[A-Z]*\])*)\]/gu, (_match, node, label) => {
      return `${node}[${safeMermaidNodeLabel(label)}]`;
    })
    .replace(/(\b[A-Za-z][\w-]*)\(((?:[^\(\)\r\n]|\([A-Z]+-\d+[A-Z]*\))*)\)/gu, (_match, node, label) => {
      return `${node}(${safeMermaidNodeLabel(label)})`;
    })
    .replace(/(\b[A-Za-z][\w-]*)\{((?:[^\{\}\r\n]|\{[A-Z]+-\d+[A-Z]*\})*)\}/gu, (_match, node, label) => {
      return `${node}{${safeMermaidNodeLabel(label)}}`;
    });
}

function safeMermaidEdgeLabel(label) {
  const text = String(label ?? '').trim();
  if (/^["'].*["']$/u.test(text)) return text;
  return quoteMermaidLabel(
    text
      .replace(/\[([A-Z]+-\d+[A-Z]*)\]/gu, ' $1 ')
      .replace(/[{}]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

function sanitizeMermaidEdgeLabels(line) {
  return String(line ?? '').replace(/(\s(?:-->|--|->)\s*)\|([^|\r\n]+)\|/gu, (_match, prefix, label) => {
    return `${prefix}|${safeMermaidEdgeLabel(label)}|`;
  });
}

function sanitizeMermaidTransitionLabel(label) {
  return String(label ?? '')
    .replace(/\[([A-Z]+-\d+[A-Z]*)\]/gu, '$1')
    .replace(/[<>{}]/gu, ' ')
    .replace(/;/gu, ' and')
    .replace(/\s+/gu, ' ')
    .trim();
}

function sanitizeMermaidStateLine(line) {
  return String(line ?? '').replace(/(:\s*)(.+)$/u, (_match, prefix, label) => {
    return `${prefix}${sanitizeMermaidTransitionLabel(label)}`;
  });
}

function sanitizeMermaidSequenceNoteLine(line) {
  return String(line ?? '').replace(/^(\s*Note\s+(?:over|right of|left of)\s+[^:]+:\s*)(.+)$/iu, (_match, prefix, label) => {
    const safeLabel = sanitizeMermaidTransitionLabel(label);
    return `${prefix}${safeLabel}`;
  });
}

function sanitizeMermaidSequenceMessageLine(line) {
  return String(line ?? '').replace(
    /^(\s*\S+\s*(?:-{1,2}|={1,2})(?:>>|>|x|\){1,2})?\s*\S+\s*:\s*)(.+)$/u,
    (_match, prefix, label) => {
      const safeLabel = sanitizeMermaidTransitionLabel(label);
      return `${prefix}${safeLabel}`;
    }
  );
}

function sanitizeMermaidSequenceLine(line) {
  if (/^\s*Note\s+/iu.test(line)) return sanitizeMermaidSequenceNoteLine(line);
  if (/^\s*\S+\s*(?:-{1,2}|={1,2})(?:>>|>|x|\){1,2})?\s*\S+\s*:/u.test(line)) {
    return sanitizeMermaidSequenceMessageLine(line);
  }
  return line;
}

function mermaidRenderSource(source) {
  const text = String(source ?? '');
  if (/^\s*sequenceDiagram\b/imu.test(text)) {
    return text
      .split(/\r?\n/u)
      .map((line) => sanitizeMermaidSequenceLine(line))
      .join('\n');
  }
  if (!/^\s*(flowchart|graph|stateDiagram|stateDiagram-v2)\b/imu.test(text)) return text;
  return text
    .split(/\r?\n/u)
    .map((line) => {
      if (/^\s*(stateDiagram|stateDiagram-v2)\b/iu.test(line)) return line;
      if (/^\s*(flowchart|graph)\b/iu.test(line)) return line;
      if (/^\s*(note|classDef|class|style|linkStyle|click|subgraph|end)\b/iu.test(line)) return line;
      const nodeSafe = sanitizeMermaidEdgeLabels(sanitizeMermaidNodeLabels(line));
      return /^\s*(?:\[\*\]|\w[\w-]*)\s*(?:-->|->|--)/u.test(nodeSafe)
        ? sanitizeMermaidStateLine(nodeSafe)
        : nodeSafe;
    })
    .join('\n');
}

function idsFromViews(views) {
  return unique(views.flatMap((view) => stringList(view.covers)));
}

function compactIdsForMermaid(ids) {
  const compact = unique(ids).slice(0, 8);
  return compact.length ? compact.map((id) => `[${id}]`).join('') : '[TRACE-UNBOUND]';
}

function renderResumeCoveragePhase(item) {
  if (item.fullLinkRequired) return 'six mental models full-link deterministic fixture';
  if (item.phase4_5Required) return 'Phase 4.5 coverage';
  if (item.phase5Required) return 'Phase 5 hardening coverage';
  return 'post-full-link coverage matrix';
}

function normalizeResumeFailureGroupDefinitions(registry, schemaIssues) {
  const groupDefs = new Map();
  const groupByCase = new Map();
  const groups = asArray(registry?.groups).length ? asArray(registry?.groups) : asArray(registry?.groupDefinitions);
  if (!groups.length && asArray(registry?.failureCases).length) {
    schemaIssues.push(
      blocking(
        'resume_failure_groups_missing',
        'functionalResumeFailureCaseRegistry.groups[] is required; renderer must not infer failure-case groups'
      )
    );
  }
  groups.forEach((group, index) => {
    const groupId = String(group?.groupId ?? '').trim();
    if (!groupId) {
      schemaIssues.push(blocking('resume_failure_group_missing_id', `groups[${index}] missing groupId`));
      return;
    }
    const label = String(group?.label ?? group?.title ?? '').trim();
    const caseRefs = stringList(group?.caseRefs);
    if (!label) schemaIssues.push(blocking('resume_failure_group_missing_label', `${groupId} missing label`, [groupId]));
    if (!caseRefs.length && !asArray(registry?.groupDefinitions).length) {
      schemaIssues.push(blocking('resume_failure_group_missing_case_refs', `${groupId} missing caseRefs[]`, [groupId]));
    }
    if (groupDefs.has(groupId)) {
      schemaIssues.push(blocking('resume_failure_group_duplicate_id', `${groupId} is duplicated`, [groupId]));
    }
    const groupDef = {
      groupId,
      label,
      caseRefs,
      ownerModel: group?.ownerModel ?? '',
      blockingBehavior: group?.blockingBehavior ?? '',
      requiredEvidenceRefs: stringList(group?.requiredEvidenceRefs),
      requiredTraceRefs: stringList(group?.requiredTraceRefs),
    };
    groupDefs.set(groupId, groupDef);
    caseRefs.forEach((caseId) => {
      if (groupByCase.has(caseId) && groupByCase.get(caseId) !== groupId) {
        schemaIssues.push(
          blocking(
            'resume_failure_case_group_conflict',
            `${caseId} is assigned to both ${groupByCase.get(caseId)} and ${groupId}`,
            [caseId, groupByCase.get(caseId), groupId]
          )
        );
      }
      groupByCase.set(caseId, groupId);
    });
  });
  return { groupDefs, groupByCase };
}

function resolveGovernanceEventTypesForResumeActions(registry, schemaIssues, governanceEventTypes) {
  if (!governanceEventTypes.size && asArray(registry?.recoveryActionDefinitions).some((action) => stringList(action?.writesControlFields).length)) {
    schemaIssues.push(
      blocking(
        'governance_event_type_registry_missing',
        'implementationConfirmation.governanceEventTypeRegistry[] is required when recovery actions write control fields'
      )
    );
  }
  return governanceEventTypes;
}

function normalizeRecoveryActionDefinitions(registry, schemaIssues, eventTypeDefs) {
  const actionDefs = new Map();
  const actions = asArray(registry?.recoveryActionDefinitions);
  if (!actions.length && asArray(registry?.failureCases).length) {
    schemaIssues.push(
      blocking(
        'resume_failure_recovery_action_definitions_missing',
        'functionalResumeFailureCaseRegistry.recoveryActionDefinitions[] is required'
      )
    );
  }
  actions.forEach((action, index) => {
    const actionId = String(action?.actionId ?? '').trim();
    if (!actionId) {
      schemaIssues.push(blocking('resume_failure_recovery_action_missing_id', `recoveryActionDefinitions[${index}] missing actionId`));
      return;
    }
    if (actionDefs.has(actionId)) {
      schemaIssues.push(blocking('resume_failure_recovery_action_duplicate_id', `${actionId} is duplicated`, [actionId]));
    }
    if (!String(action.label ?? action.description ?? '').trim()) {
      schemaIssues.push(
        blocking('resume_failure_recovery_action_missing_required_field', `${actionId} missing label or description`, [
          actionId,
          'label',
        ])
      );
    }
    const writesControlFields = stringList(action.writesControlFields);
    const recordEventTypes = stringList(action.recordEventTypes);
    if (writesControlFields.length && !recordEventTypes.length) {
      schemaIssues.push(
        blocking('resume_failure_recovery_action_missing_record_event_types', `${actionId} writes control fields but missing recordEventTypes[]`, [
          actionId,
        ])
      );
    }
    for (const eventType of recordEventTypes) {
      if (!eventTypeDefs.has(eventType)) {
        schemaIssues.push(
          blocking('resume_failure_recovery_action_unknown_event_type', `${actionId} references unknown record event type ${eventType}`, [
            actionId,
            eventType,
          ])
        );
      }
    }
    const coveredControlFields = new Set(
      recordEventTypes.flatMap((eventType) => stringList(eventTypeDefs.get(eventType)?.writesControlFields))
    );
    for (const controlField of writesControlFields) {
      if (!coveredControlFields.has(controlField)) {
        schemaIssues.push(
          blocking(
            'resume_failure_recovery_action_uncovered_control_field',
            `${actionId} writes ${controlField} but recordEventTypes[] do not cover it`,
            [actionId, controlField]
          )
        );
      }
    }
    actionDefs.set(actionId, {
      actionId,
      label: action.label ?? action.description ?? '',
      ownerModel: action.ownerModel ?? '',
      automationLevel: action.automationLevel ?? '',
      writesControlFields,
      recordEventTypes,
      outputArtifacts: stringList(action.outputArtifacts),
      createsNewCloseoutAttempt: action.createsNewCloseoutAttempt === true,
      requiresUserConfirmation: action.requiresUserConfirmation === true,
    });
  });
  return actionDefs;
}

function normalizeResumeFailureCaseItem(item, index, groupByCase, groupDefs, actionDefs, p0Required, phase45, phase5, schemaIssues) {
  const objectRow = item && typeof item === 'object' && !Array.isArray(item);
  const caseId = objectRow ? String(item.id ?? '').trim() : String(item ?? '').trim();
  if (!caseId) {
    schemaIssues.push(blocking('resume_failure_case_missing_id', `failureCases[${index}] missing id`));
    return null;
  }
  const mappedGroupId = groupByCase.get(caseId);
  const explicitGroupId = objectRow ? String(item.groupId ?? '').trim() : '';
  const groupId = explicitGroupId || mappedGroupId || '';
  if (!groupId) {
    schemaIssues.push(
      blocking(
        'resume_failure_case_missing_group_ref',
        `${caseId} missing groupId and is not listed in any groups[].caseRefs`,
        [caseId]
      )
    );
  }
  if (groupId && !groupDefs.has(groupId)) {
    schemaIssues.push(blocking('resume_failure_case_unknown_group', `${caseId} references unknown group ${groupId}`, [caseId, groupId]));
  }
  if (explicitGroupId && mappedGroupId && explicitGroupId !== mappedGroupId) {
    schemaIssues.push(
      blocking(
        'resume_failure_case_group_conflict',
        `${caseId} groupId ${explicitGroupId} conflicts with groups[].caseRefs ${mappedGroupId}`,
        [caseId, explicitGroupId, mappedGroupId]
      )
    );
  }

  const groupDef = groupDefs.get(groupId) ?? {};
  const normalized = {
    caseId,
    groupId,
    groupLabel: groupDef.label ?? groupId,
    fullLinkRequired: objectRow && item.fullLinkRequired !== undefined ? item.fullLinkRequired === true : p0Required.has(caseId),
    phase4_5Required: objectRow && item.coveragePhase === 'Phase 4.5 coverage' ? true : phase45.has(caseId),
    phase5Required: objectRow && item.coveragePhase === 'Phase 5 hardening coverage' ? true : phase5.has(caseId),
    blockingBehavior: item?.blockingBehavior || groupDef.blockingBehavior || 'fail_closed_until_recovered',
    triggerSignal: item?.triggerSignal ?? '',
    detectionPoint: item?.detectionPoint ?? '',
    failClosedGate: item?.failClosedGate ?? 'Functional Resume Gate',
    failureRecordType: item?.failureRecordType ?? '',
    expectedRecoveryActions: stringList(item?.expectedRecoveryActions),
    requiredTraceRefs: stringList(item?.requiredTraceRefs).length ? stringList(item?.requiredTraceRefs) : stringList(groupDef.requiredTraceRefs),
    requiredEvidenceRefs: stringList(item?.requiredEvidenceRefs).length
      ? stringList(item?.requiredEvidenceRefs)
      : stringList(groupDef.requiredEvidenceRefs),
    ownerModel: item?.ownerModel ?? groupDef.ownerModel ?? '',
    source: 'functionalResumeFailureCaseRegistry.failureCases',
    order: index + 1,
  };
  normalized.coveragePhase = item?.coveragePhase ?? renderResumeCoveragePhase(normalized);
  if (!normalized.blockingBehavior) {
    schemaIssues.push(blocking('resume_failure_case_missing_blocking_behavior', `${caseId} missing blockingBehavior`, [caseId]));
  }
  if (!normalized.expectedRecoveryActions.length) {
    schemaIssues.push(blocking('resume_failure_case_missing_recovery_actions', `${caseId} missing expectedRecoveryActions[]`, [caseId]));
  }
  for (const actionId of normalized.expectedRecoveryActions) {
    if (!actionDefs.has(actionId)) {
      schemaIssues.push(
        blocking('resume_failure_case_unknown_recovery_action', `${caseId} references unknown recovery action ${actionId}`, [
          caseId,
          actionId,
        ])
      );
    }
  }
  return normalized;
}

function normalizeFunctionalResumeFailureCaseRegistry(registry, governanceEventTypes = new Map()) {
  const schemaIssues = [];
  if (hasOwn(registry, 'controlledRecordEventTypes')) {
    schemaIssues.push(
      blocking(
        'resume_failure_second_event_registry_present',
        'functionalResumeFailureCaseRegistry.controlledRecordEventTypes is forbidden; use implementationConfirmation.governanceEventTypeRegistry[] only',
        ['functionalResumeFailureCaseRegistry.controlledRecordEventTypes']
      )
    );
  }
  const rawFailureCases = asArray(registry?.failureCases);
  const p0Required = new Set(stringList(registry?.fullLinkRequiredFixtureCases ?? registry?.p0RequiredFixtureCases));
  const phase45 = new Set(stringList(registry?.phase4_5Coverage));
  const phase5 = new Set(stringList(registry?.phase5HardeningCoverage));
  const { groupDefs, groupByCase } = normalizeResumeFailureGroupDefinitions(registry, schemaIssues);
  const eventTypeDefs = resolveGovernanceEventTypesForResumeActions(registry, schemaIssues, governanceEventTypes);
  const actionDefs = normalizeRecoveryActionDefinitions(registry, schemaIssues, eventTypeDefs);
  const seenCases = new Set();
  const cases = rawFailureCases
    .map((item, index) =>
      normalizeResumeFailureCaseItem(item, index, groupByCase, groupDefs, actionDefs, p0Required, phase45, phase5, schemaIssues)
    )
    .filter(Boolean);
  cases.forEach((item) => {
    if (seenCases.has(item.caseId)) {
      schemaIssues.push(blocking('resume_failure_case_duplicate_id', `${item.caseId} is duplicated`, [item.caseId]));
    }
    seenCases.add(item.caseId);
  });
  for (const [caseId, groupId] of groupByCase.entries()) {
    if (!seenCases.has(caseId)) {
      schemaIssues.push(
        blocking('resume_failure_group_case_ref_unknown', `${groupId} references case ${caseId} missing from failureCases[]`, [
          groupId,
          caseId,
        ])
      );
    }
  }
  const groups = cases.reduce((acc, item) => {
    if (!acc[item.groupId]) acc[item.groupId] = [];
    acc[item.groupId].push(item);
    return acc;
  }, {});
  return {
    rawPresent: !!registry,
    status: registry?.status ?? '',
    fullLinkExecutableSubsetRequired: registry?.fullLinkExecutableSubsetRequired === true || registry?.p0ExecutableSubsetRequired === true,
    fullLinkRequiredFixtureCases: stringList(registry?.fullLinkRequiredFixtureCases ?? registry?.p0RequiredFixtureCases),
    phase4_5Coverage: stringList(registry?.phase4_5Coverage),
    phase5HardeningCoverage: stringList(registry?.phase5HardeningCoverage),
    governanceEventTypeRefs: Object.fromEntries(eventTypeDefs.entries()),
    groupDefinitions: Object.fromEntries(groupDefs.entries()),
    recoveryActionDefinitions: Object.fromEntries(actionDefs.entries()),
    cases,
    groups,
    schemaIssues,
  };
}

function buildResumeFailureMermaidBlocks(registry) {
  if (!registry?.cases?.length) return [];
  return Object.entries(registry.groups).map(([group, cases], index) => {
    const groupDef = registry.groupDefinitions?.[group] ?? {};
    const caseList = cases.map((item) => item.caseId).join('<br/>');
    const refs = unique(cases.flatMap((item) => [...stringList(item.requiredTraceRefs), ...stringList(item.requiredEvidenceRefs)]));
    const refSuffix = refs.length ? compactIdsForMermaid(refs) : '[EVD-022]';
    return makeMermaidBlock(
      `DERIVED-RESUME-FAILURE-${String(index + 1).padStart(3, '0')}`,
      [
        'flowchart LR',
        `  A["Detect ${group}<br/>${caseList} ${refSuffix}"] --> B["Load traceRows checkpoint ${refSuffix}"]`,
        `  B --> C["${groupDef.label ?? group}: compare governed resume inputs ${refSuffix}"]`,
        `  C --> D["${groupDef.blockingBehavior ?? 'fail closed'} ${refSuffix}"]`,
      ].join('\n'),
      'resumeFailure',
      'functionalResumeFailureCaseRegistry',
      {
        title: groupDef.label ?? group,
        sectionGroup: 'governance',
      }
    );
  });
}

function renderResumeFailureCoverage(registry, mermaidRuntime, args, ui) {
  if (!registry?.cases?.length) {
    return `<section class="card" id="resume-failure-cases"><h2>恢复失败路径矩阵</h2><p class="empty-state">源文档未提供 functionalResumeFailureCaseRegistry.failureCases[]。</p></section>`;
  }
  const trueText = ui.trueText ?? 'true';
  const falseText = ui.falseText ?? 'false';
  const rows = registry.cases.map((item) => [
    item.order,
    item.caseId,
    `${item.groupLabel} (${item.groupId})`,
    item.fullLinkRequired ? trueText : falseText,
    item.coveragePhase,
    item.blockingBehavior,
    item.triggerSignal,
    item.detectionPoint,
    item.failClosedGate,
    item.failureRecordType,
    stringList(item.expectedRecoveryActions).join(', '),
    renderCompactIdBadges(item.requiredTraceRefs),
    renderCompactIdBadges(item.requiredEvidenceRefs),
    item.source,
  ]);
  const groupBlocks = buildResumeFailureMermaidBlocks(registry);
  const blockByGroup = new Map(groupBlocks.map((block, index) => [Object.keys(registry.groups)[index], block]));
  const groupDetails = Object.entries(registry.groups)
    .map(
      ([group, cases]) =>
        `<details class="resume-case-group"><summary>${escapeHtml(registry.groupDefinitions?.[group]?.label ?? group)} <code>${escapeHtml(
          group
        )}</code> (${cases.length})</summary>
          ${renderTable(
            [
              'caseId',
              'coveragePhase',
              'full-link required',
              'triggerSignal',
              'detectionPoint',
              'failClosedGate',
              'failureRecordType',
              'expectedRecoveryActions',
            ],
            cases.map((item) => [
              item.caseId,
              item.coveragePhase,
              item.fullLinkRequired ? trueText : falseText,
              item.triggerSignal,
              item.detectionPoint,
              item.failClosedGate,
              item.failureRecordType,
              stringList(item.expectedRecoveryActions).join(', '),
            ])
          )}
          ${renderMermaidBlocks([blockByGroup.get(group)].filter(Boolean), ui, mermaidRuntime, args)}
        </details>`
    )
    .join('');
  return `<section class="card" id="resume-failure-cases">
    <h2>恢复失败路径矩阵</h2>
    <p class="section-lead">本区只读取源文档 <code>functionalResumeFailureCaseRegistry.failureCases[]</code>；它不是从 renderer hardcode 生成的 case 列表。</p>
    <div class="metric-grid">
      <div class="metric"><strong>${registry.cases.length}</strong><span>failure cases</span></div>
      <div class="metric"><strong>${registry.fullLinkRequiredFixtureCases.length}</strong><span>full-link fixture cases</span></div>
      <div class="metric"><strong>${Object.keys(registry.groups).length}</strong><span>groups</span></div>
      <div class="metric"><strong>${registry.fullLinkExecutableSubsetRequired ? trueText : falseText}</strong><span>six mental model executable subset</span></div>
    </div>
    ${renderTable(
      [
        '#',
        'caseId',
        'group',
        'full-link required',
        'coveragePhase',
        'blockingBehavior',
        'triggerSignal',
        'detectionPoint',
        'failClosedGate',
        'failureRecordType',
        'expectedRecoveryActions',
        'requiredTraceRefs',
        'requiredEvidenceRefs',
        'source',
      ],
      rows
    )}
    <h3>恢复动作权威注册表</h3>
    ${renderTable(
      [
        'actionId',
        'label',
        'ownerModel',
        'automationLevel',
        'writesControlFields',
        'recordEventTypes',
        'outputArtifacts',
        'createsNewCloseoutAttempt',
        'requiresUserConfirmation',
      ],
      Object.values(registry.recoveryActionDefinitions ?? {}).map((action) => [
        action.actionId,
        action.label,
        action.ownerModel,
        action.automationLevel,
        stringList(action.writesControlFields).join(', '),
        renderIdBadges(action.recordEventTypes),
        stringList(action.outputArtifacts).join(', '),
        action.createsNewCloseoutAttempt ? trueText : falseText,
        action.requiresUserConfirmation ? trueText : falseText,
      ])
    )}
    <h3>可展开恢复失败路径分组图</h3>
    ${groupDetails}
  </section>`;
}

function mermaidLabel(value, fallback) {
  return String(value ?? fallback ?? '')
    .replace(/[\r\n]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function getDiagramLabels(confirmation) {
  const labels = confirmation.diagramLabels ?? {};
  return {
    user: mermaidLabel(labels.user, 'User'),
    agent: mermaidLabel(labels.agent, 'Agent'),
    record: mermaidLabel(labels.record, 'Record'),
    gate: mermaidLabel(labels.gate, 'Gate'),
    check: mermaidLabel(labels.check, 'Check'),
    followUp: mermaidLabel(labels.followUp, 'Follow-up'),
    confirmation: mermaidLabel(labels.confirmation, 'Confirmation'),
    runtime: mermaidLabel(labels.runtime, 'Runtime'),
    resume: mermaidLabel(labels.resume, 'Resume'),
    finalCheck: mermaidLabel(labels.finalCheck, 'Final Check'),
    happyConfirm: mermaidLabel(labels.happyConfirm, 'Confirm scope'),
    happyBind: mermaidLabel(labels.happyBind, 'Bind trace rows and evidence'),
    happyProvide: mermaidLabel(labels.happyProvide, 'Provide governed inputs'),
    happyAllow: mermaidLabel(labels.happyAllow, 'Allow next stage'),
    failureSignal: mermaidLabel(labels.failureSignal, 'Provide invalid or incomplete behavior signal'),
    failureCompare: mermaidLabel(labels.failureCompare, 'Compare against negative assertions'),
    failureExpose: mermaidLabel(labels.failureExpose, 'Expose evidence gaps'),
    failureFollowUp: mermaidLabel(labels.failureFollowUp, 'Open follow-up when needed'),
    failureReport: mermaidLabel(labels.failureReport, 'Report why completion is blocked'),
    boundaryRequest: mermaidLabel(labels.boundaryRequest, 'Request scope expansion'),
    boundaryMatch: mermaidLabel(labels.boundaryMatch, 'Match request to boundary rule'),
    boundaryBlock: mermaidLabel(labels.boundaryBlock, 'Block silent scope expansion'),
    boundaryConfirm: mermaidLabel(labels.boundaryConfirm, 'Require explicit confirmation delta'),
    recoveryDetect: mermaidLabel(labels.recoveryDetect, 'Detect interruption or mismatch'),
    recoveryVerify: mermaidLabel(labels.recoveryVerify, 'Verify checkpoint and policy snapshot'),
    recoveryExpose: mermaidLabel(labels.recoveryExpose, 'Expose unresolved recovery blocker'),
    recoveryBlock: mermaidLabel(labels.recoveryBlock, 'Fail current attempt until remediated'),
  };
}

function buildDerivedMermaidBlocks(confirmation, views) {
  const labels = getDiagramLabels(confirmation);
  const sequenceViews = asArray(views.sequenceViews);
  const happyIds = unique([
    ...asArray(confirmation.must).map((item) => item.id),
    ...asArray(confirmation.evidence).map((item) => item.id),
  ]);
  const failureIds = unique([
    ...asArray(confirmation.notDone).map((item) => item.id),
    ...idsFromViews(
      sequenceViews.filter((view) => stringList(view.covers).some((id) => id.startsWith('NEG-') || id.startsWith('OUT-')))
    ).filter((id) => id.startsWith('NEG-')),
  ]);
  const flowIds = idsFromViews(asArray(views.flowViews));
  const edgeIds = idsFromViews(asArray(views.edgeCaseViews));
  const boundaryIds = idsFromViews(asArray(views.boundaryViews));
  const blocks = [];

  if (happyIds.length) {
    const ids = compactIdsForMermaid(happyIds);
    blocks.push(
      makeMermaidBlock(
        'DERIVED-HAPPY-001',
        [
          'sequenceDiagram',
          `  actor User as ${labels.user}`,
          `  participant Agent as ${labels.agent}`,
          `  participant Record as ${labels.record}`,
          `  participant Gate as ${labels.gate}`,
          `  User->>Agent: ${labels.happyConfirm} ${ids}`,
          `  Agent->>Record: ${labels.happyBind} ${ids}`,
          `  Record-->>Gate: ${labels.happyProvide} ${ids}`,
          `  Gate-->>User: ${labels.happyAllow} ${ids}`,
        ].join('\n'),
        'happy',
        'sequenceViews',
        { sectionGroup: 'business' }
      )
    );
  }

  if (failureIds.length) {
    const ids = compactIdsForMermaid(failureIds);
    blocks.push(
      makeMermaidBlock(
        'DERIVED-FAILURE-NEG-001',
        [
          'sequenceDiagram',
          `  actor User as ${labels.user}`,
          `  participant Agent as ${labels.agent}`,
          `  participant Record as ${labels.record}`,
          `  participant Check as ${labels.check}`,
          `  participant FollowUp as ${labels.followUp}`,
          `  User->>Agent: ${labels.failureSignal} ${ids}`,
          `  Agent->>Record: ${labels.failureCompare} ${ids}`,
          `  Record-->>Check: ${labels.failureExpose} ${ids}`,
          `  Check-->>FollowUp: ${labels.failureFollowUp} ${ids}`,
          `  FollowUp-->>User: ${labels.failureReport} ${ids}`,
        ].join('\n'),
        'failure',
        'notDone,sequenceViews',
        { sectionGroup: 'governance' }
      )
    );
  }

  if (boundaryIds.length) {
    const ids = compactIdsForMermaid(boundaryIds);
    blocks.push(
      makeMermaidBlock(
        'DERIVED-FAILURE-OUT-001',
        [
          'sequenceDiagram',
          `  actor User as ${labels.user}`,
          `  participant Agent as ${labels.agent}`,
          `  participant Record as ${labels.record}`,
          `  participant Confirm as ${labels.confirmation}`,
          `  User->>Agent: ${labels.boundaryRequest} ${ids}`,
          `  Agent->>Record: ${labels.boundaryMatch} ${ids}`,
          `  Record-->>Agent: ${labels.boundaryBlock} ${ids}`,
          `  Agent-->>Confirm: ${labels.boundaryConfirm} ${ids}`,
        ].join('\n'),
        'failure',
        'boundaryViews',
        { sectionGroup: 'governance' }
      )
    );
  }

  if (edgeIds.length) {
    const ids = compactIdsForMermaid(edgeIds);
    blocks.push(
      makeMermaidBlock(
        'DERIVED-FAILURE-EDGE-001',
        [
          'sequenceDiagram',
          `  participant Runtime as ${labels.runtime}`,
          `  participant Resume as ${labels.resume}`,
          `  participant Record as ${labels.record}`,
          `  participant FinalCheck as ${labels.finalCheck}`,
          `  Runtime->>Resume: ${labels.recoveryDetect} ${ids}`,
          `  Resume->>Record: ${labels.recoveryVerify} ${ids}`,
          `  Record-->>FinalCheck: ${labels.recoveryExpose} ${ids}`,
          `  FinalCheck-->>Runtime: ${labels.recoveryBlock} ${ids}`,
        ].join('\n'),
        'failure',
        'edgeCaseViews',
        { sectionGroup: 'governance' }
      )
    );
  }

  if (flowIds.length) {
    const ids = compactIdsForMermaid(flowIds);
    blocks.push(
      makeMermaidBlock(
        'DERIVED-FLOW-001',
        [
          'stateDiagram-v2',
          `  [*] --> draft: source contract loaded ${ids}`,
          `  draft --> user_confirmed: chat hash confirmation ${ids}`,
          `  user_confirmed --> implementation_readiness: traceRows and commands bound ${ids}`,
          `  implementation_readiness --> execution: governed work starts ${ids}`,
          `  execution --> closeout_attempt: evidence registered ${ids}`,
          `  closeout_attempt --> blocked: missing evidence or orphan found ${ids}`,
          `  closeout_attempt --> complete: current attempt decision pass ${ids}`,
        ].join('\n'),
        'stateFlow',
        'flowViews',
        { sectionGroup: 'business' }
      )
    );
  }

  if (edgeIds.length) {
    const ids = compactIdsForMermaid(edgeIds);
    blocks.push(
      makeMermaidBlock(
        'DERIVED-EDGE-001',
        [
          'flowchart TD',
          `  A["Edge case detected ${ids}"] --> B["Classify failure or resume condition ${ids}"]`,
          `  B --> C["Require evidence, rerun, or reconfirmation ${ids}"]`,
          `  C --> D["Block closeout until trace checkpoint is safe ${ids}"]`,
        ].join('\n'),
        'edge',
        'edgeCaseViews',
        { sectionGroup: 'business' }
      )
    );
  }

  return blocks;
}

function findUnboundDiagramSemantics(source) {
  const out = [];
  const lines = source.split(/\r?\n/u);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^(sequenceDiagram|stateDiagram|stateDiagram-v2|flowchart|graph|classDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|participant|actor|autonumber|alt\b|else\b|opt\b|loop\b|par\b|and\b|rect\b|end\b|note\b)/iu.test(trimmed)) {
      ID_PATTERN.lastIndex = 0;
      if (/^(alt|else|opt|loop|par|and|note)\b/iu.test(trimmed) && !ID_PATTERN.test(trimmed)) {
        out.push({ line: index + 1, text: trimmed, reason: 'diagram control branch lacks ID' });
      }
      return;
    }
    ID_PATTERN.lastIndex = 0;
    if (BUSINESS_EDGE_PATTERN.test(trimmed) && !extractIds(trimmed).length) {
      out.push({ line: index + 1, text: trimmed, reason: 'diagram business edge lacks ID' });
    }
  });
  return out;
}

function makeIdSet(confirmation) {
  const sequenceViews = asArray(confirmation.sequenceViews);
  const flowViews = asArray(confirmation.flowViews);
  const edgeCaseViews = asArray(confirmation.edgeCaseViews);
  const boundaryViews = asArray(confirmation.boundaryViews);
  return {
    must: new Set(asArray(confirmation.must).map((item) => item.id)),
    notDone: new Set(asArray(confirmation.notDone).map((item) => item.id)),
    mustNot: new Set(asArray(confirmation.mustNot).map((item) => item.id)),
    evidence: new Set(asArray(confirmation.evidence).map((item) => item.id)),
    openQuestions: new Set(asArray(confirmation.openQuestions).map((item) => item.id)),
    traceRows: new Set(asArray(confirmation.traceRows).map((item) => item.id)),
    failurePaths: new Set(asArray(confirmation.failurePaths).map((item) => item.id)),
    edgeCases: new Set(asArray(confirmation.edgeCases).map((item) => item.id)),
    acceptance: new Set(normalizeAcceptanceSuites(confirmation).map((item) => item.id)),
    artifacts: new Set(asArray(confirmation.artifactAutomationPlan).map((item) => item.artifactId ?? item.id)),
    commands: new Set([
      ...asArray(confirmation.requiredCommands).map((item) => item?.id ?? item?.commandId),
      ...asArray(confirmation.suggestedCommands).map((item) => item?.id ?? item?.commandId),
    ]),
    tasks: new Set([
      ...asArray(confirmation.implementationTasks).map((item) => item.taskId ?? item.id),
      ...asArray(confirmation.aiTddContractExecutionManifestProjection?.atomicImplementationTaskLineage).map(
        (item) => item.taskId ?? item.id
      ),
    ]),
    views: new Set([
      ...sequenceViews.map((item) => item.id),
      ...flowViews.map((item) => item.id),
      ...edgeCaseViews.map((item) => item.id),
      ...boundaryViews.map((item) => item.id),
    ]),
  };
}

function allKnownIds(idSet) {
  return new Set([
    ...idSet.must,
    ...idSet.notDone,
    ...idSet.mustNot,
    ...idSet.evidence,
    ...idSet.openQuestions,
    ...idSet.traceRows,
    ...idSet.failurePaths,
    ...idSet.edgeCases,
    ...idSet.acceptance,
    ...idSet.artifacts,
    ...idSet.commands,
    ...idSet.tasks,
    ...idSet.views,
  ]);
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
      const id = String(item?.id ?? item?.testId ?? `${prefix}-${String(index + 1).padStart(3, '0')}`).trim();
      rows.push({
        id,
        suiteType: String(item?.suiteType ?? item?.kind ?? suiteType),
        sourceSection: section,
        files: unique([
          String(item?.file ?? item?.path ?? item?.testFile ?? item?.testPath ?? '').trim(),
          ...stringList(item?.files),
          ...stringList(item?.testFiles),
        ]),
        covers: unique([
          ...stringList(item?.covers),
          ...stringList(item?.requirementRefs),
          ...stringList(item?.linkedRequirementIds),
          ...stringList(item?.mustRefs),
          ...stringList(item?.negRefs),
        ]),
        traceRows: unique([...stringList(item?.traceRows), ...stringList(item?.traceRefs)]),
        evidenceRefs: unique([...stringList(item?.evidenceRefs), ...stringList(item?.linkedEvidenceIds)]),
        failurePathRefs: unique([...stringList(item?.failurePathRefs), ...stringList(item?.linkedFailurePathIds)]),
        edgeCaseRefs: unique([...stringList(item?.edgeCaseRefs), ...stringList(item?.linkedEdgeCaseIds)]),
        commandRefs: unique([
          ...stringList(item?.commandRefs),
          ...stringList(item?.requiredCommandRefs),
          ...stringList(item?.requiredCommandIds),
        ]),
        expectedPreImplementationState: String(item?.expectedPreImplementationState ?? '').trim(),
        oracle: String(item?.oracle ?? item?.expectedBehavior ?? item?.assertion ?? '').trim(),
        positiveControl: item?.positiveControl === true,
        negativeControls: unique([...stringList(item?.negativeControls), ...stringList(item?.negativeControlRefs)]),
        mockOnly: item?.mockOnly === true,
      });
    });
  }
  return rows.filter((row) => row.id);
}

function findAcceptanceCovering(acceptanceRows, id) {
  return acceptanceRows.filter((row) => row.covers.includes(id)).map((row) => row.id);
}

function findRowsCovering(traceRows, id) {
  return traceRows
    .filter((row) => {
      if (stringList(row.covers).includes(id)) return true;
      const boundaryRefs = new Set(stringList(row.boundaryViewRefs ?? row.boundaryRefs));
      return boundaryRefs.size > 0 && stringList(row.boundaryCoveredIds ?? row.boundaryIds).includes(id);
    })
    .map((row) => row.id);
}

function enrichTraceRowsWithBoundaryCoverage(traceRows, boundaryViews) {
  const boundaryViewCoverage = new Map(
    asArray(boundaryViews).map((view) => [view.id, stringList(view.covers)])
  );
  return asArray(traceRows).map((row) => {
    const boundaryCoveredIds = unique(
      stringList(row.boundaryViewRefs ?? row.boundaryRefs).flatMap((ref) => boundaryViewCoverage.get(ref) ?? [])
    );
    return boundaryCoveredIds.length
      ? { ...row, boundaryCoveredIds: unique([...stringList(row.boundaryCoveredIds ?? row.boundaryIds), ...boundaryCoveredIds]) }
      : row;
  });
}

function isBoundaryOnlyTrace(row, boundaryViews) {
  const boundaryRefs = new Set(stringList(row.boundaryViewRefs ?? row.boundaryRefs));
  if (!boundaryRefs.size) return false;
  const coveredBoundaryIds = asArray(boundaryViews)
    .filter((view) => boundaryRefs.has(view.id))
    .flatMap((view) => stringList(view.covers));
  return coveredBoundaryIds.length > 0;
}

function findViewsCovering(views, id) {
  return views.filter((view) => stringList(view.covers).includes(id)).map((view) => view.id);
}

function findArtifactRefs(artifactPlan, id) {
  return artifactPlan
    .filter((item) => extractIds(stableStringify(item)).includes(id) || stringList(item.linkedRequirements).includes(id))
    .map((item) => item.artifactId ?? item.id);
}

function refsForRow(row, keys) {
  return unique(keys.flatMap((key) => stringList(row?.[key])));
}

function commandRefsForTrace(row) {
  return refsForRow(row, [
    'commandRefs',
    'requiredCommandRefs',
    'requiredCommandIds',
    'contractValidationCommandRefs',
    'deliveryEvidenceCommandRefs',
  ]);
}

function isAiTddCanonicalArtifactPlanRow(row) {
  const role = String(row?.sourceOfTruthRole ?? '').trim();
  const artifactType = String(row?.artifactType ?? '').trim();
  return (
    role === 'implementation' ||
    role === 'control' ||
    row?.canAffectControlFlow === true ||
    /^(?:code|script|hook|test|config|schema|control_record)$/iu.test(artifactType)
  );
}

function rowsMissing(rows, category) {
  return rows.flatMap((row) =>
    stringList(row.missing).map((code) => ({
      id: row.id || row.pathOrField || category,
      code,
      category,
    }))
  );
}

function aiTddContractManifestRequired(confirmation) {
  return applicabilityDomainApplies(confirmation, 'aiTddContractGate');
}

function buildAiTddContractManifestCoverage(input) {
  const { confirmation, traceRows, views, artifactPlan, targetModificationPaths, acceptanceRows, targetModificationPathCoverage } = input;
  const required = aiTddContractManifestRequired(confirmation);
  const allViews = [
    ...asArray(views.sequenceViews),
    ...asArray(views.flowViews),
    ...asArray(views.edgeCaseViews),
    ...asArray(views.boundaryViews),
  ];
  const failureNegRefs = new Map(
    asArray(confirmation.failurePaths).map((row) => [row.id, refsForRow(row, ['linkedNegIds', 'negRefs'])])
  );
  const traceRefsFor = (requirementRefs, evidenceRefs, explicitRefs = []) =>
    unique([
      ...explicitRefs,
      ...asArray(traceRows)
        .filter(
          (trace) =>
            stringList(trace.covers).some((ref) => requirementRefs.includes(ref)) ||
            stringList(trace.evidenceRefs).some((ref) => evidenceRefs.includes(ref))
        )
        .map((trace) => trace.id),
    ]);
  const viewRefsFor = (id, explicitRefs = []) =>
    unique([...explicitRefs, ...allViews.filter((view) => stringList(view.covers).includes(id) || stringList(view.cases).includes(id)).map((view) => view.id)]);
  const acceptanceRefsFor = (key, id) =>
    asArray(acceptanceRows)
      .filter((row) => stringList(row[key]).includes(id))
      .map((row) => row.id);

  const failurePaths = asArray(confirmation.failurePaths).map((row) => {
    const linkedNegIds = refsForRow(row, ['linkedNegIds', 'negRefs']);
    const linkedEvidenceIds = refsForRow(row, ['linkedEvidenceIds', 'evidenceRefs']);
    const traceRefs = traceRefsFor(linkedNegIds, linkedEvidenceIds, refsForRow(row, ['traceRows', 'traceRefs']));
    const viewRefs = viewRefsFor(row.id, refsForRow(row, ['viewRefs', 'sequenceViewRefs', 'boundaryViewRefs']));
    const acceptanceRefs = acceptanceRefsFor('failurePathRefs', row.id);
    const missing = [
      ...(linkedNegIds.length ? [] : ['failure_path_neg_refs_missing']),
      ...(linkedEvidenceIds.length ? [] : ['failure_path_evidence_refs_missing']),
      ...(traceRefs.length ? [] : ['failure_path_trace_coverage_missing']),
      ...(acceptanceRefs.length ? [] : ['failure_path_acceptance_coverage_missing']),
      ...(viewRefs.length ? [] : ['failure_path_view_coverage_missing']),
    ];
    return { id: row.id, linkedNegIds, linkedEvidenceIds, traceRefs, viewRefs, acceptanceRefs, missing, ready: missing.length === 0 };
  }).filter((row) => row.id);

  const edgeCases = asArray(confirmation.edgeCases).map((row) => {
    const linkedFailurePathIds = refsForRow(row, ['linkedFailurePathIds', 'failurePathRefs']);
    const linkedNegIds = unique([
      ...refsForRow(row, ['linkedNegIds', 'negRefs']),
      ...linkedFailurePathIds.flatMap((id) => failureNegRefs.get(id) ?? []),
    ]);
    const linkedEvidenceIds = refsForRow(row, ['linkedEvidenceIds', 'evidenceRefs']);
    const traceRefs = traceRefsFor(linkedNegIds, linkedEvidenceIds, refsForRow(row, ['traceRows', 'traceRefs']));
    const viewRefs = viewRefsFor(row.id, refsForRow(row, ['viewRefs', 'sequenceViewRefs', 'boundaryViewRefs']));
    const acceptanceRefs = acceptanceRefsFor('edgeCaseRefs', row.id);
    const missing = [
      ...(linkedFailurePathIds.length + linkedNegIds.length ? [] : ['edge_case_failure_or_neg_missing']),
      ...(linkedEvidenceIds.length ? [] : ['edge_case_evidence_refs_missing']),
      ...(traceRefs.length ? [] : ['edge_case_trace_coverage_missing']),
      ...(acceptanceRefs.length ? [] : ['edge_case_acceptance_coverage_missing']),
      ...(viewRefs.length ? [] : ['edge_case_view_coverage_missing']),
    ];
    return { id: row.id, linkedFailurePathIds, linkedNegIds, linkedEvidenceIds, traceRefs, viewRefs, acceptanceRefs, missing, ready: missing.length === 0 };
  }).filter((row) => row.id);

  const commandTargetRows = asArray(confirmation.requiredCommands).map((row) => {
    const id = row.id || row.commandId;
    const files = extractPathRefs(String(row.command ?? ''));
    const linkedTraceRows = asArray(traceRows).filter((trace) => commandRefsForTrace(trace).includes(id));
    const traceRefs = unique([...refsForRow(row, ['traceRows', 'traceRefs']), ...linkedTraceRows.map((trace) => trace.id)]);
    const evidenceRefs = unique([
      ...refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']),
      ...linkedTraceRows.flatMap((trace) => stringList(trace.evidenceRefs)),
    ]);
    const missing = [
      ...(files.length ? [] : ['command_target_files_missing']),
      ...(traceRefs.length ? [] : ['command_target_trace_refs_missing']),
      ...(evidenceRefs.length ? [] : ['command_target_evidence_refs_missing']),
    ];
    return { id, files, traceRefs, evidenceRefs, missing, ready: missing.length === 0 };
  }).filter((row) => row.id);

  const traceClosureRows = asArray(traceRows).map((row) => {
    const commandRefs = commandRefsForTrace(row);
    const artifactRefs = stringList(row.artifactRefs);
    const acceptanceRefs = stringList(row.acceptanceRefs);
    const missing = [
      ...(stringList(row.covers).length ? [] : ['trace_closure_requirement_refs_missing']),
      ...(stringList(row.evidenceRefs).length ? [] : ['trace_closure_evidence_refs_missing']),
      ...(commandRefs.length ? [] : ['trace_closure_command_refs_missing']),
      ...(acceptanceRefs.length ? [] : ['trace_closure_acceptance_refs_missing']),
      ...(artifactRefs.length ? [] : ['trace_closure_artifact_refs_missing']),
    ];
    return { id: row.id, covers: stringList(row.covers), evidenceRefs: stringList(row.evidenceRefs), commandRefs, acceptanceRefs, artifactRefs, missing, ready: missing.length === 0 };
  }).filter((row) => row.id);

  const canonicalRows = [
    ...asArray(confirmation.currentTargetMap?.canonicalArtifacts).map((row) => ({
      id: row.id || row.targetPathOrField,
      pathOrField: row.targetPathOrField,
      traceRefs: refsForRow(row, ['traceRows', 'traceRefs']),
      evidenceRefs: refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']),
      sourceSection: 'currentTargetMap.canonicalArtifacts',
    })),
    ...asArray(confirmation.currentTargetMap?.pathRegistry).map((row) => ({
      id: row.id || row.path || row.fixedPath,
      pathOrField: row.path || row.fixedPath,
      traceRefs: refsForRow(row, ['traceRows', 'traceRefs']),
      evidenceRefs: refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']),
      sourceSection: 'currentTargetMap.pathRegistry',
    })),
    ...asArray(artifactPlan)
      .filter(isAiTddCanonicalArtifactPlanRow)
      .map((row) => ({
        id: row.artifactId || row.id,
        pathOrField: row.path,
        traceRefs: refsForRow(row, ['traceRows', 'traceRefs']),
        evidenceRefs: refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']),
        sourceSection: 'artifactAutomationPlan',
      })),
    ...asArray(targetModificationPaths).map((row) => ({
      id: row.id,
      pathOrField: row.path,
      traceRefs: stringList(row.traceRefs),
      evidenceRefs: stringList(row.evidenceRefs),
      sourceSection: 'targetModificationPaths',
    })),
  ].filter((row) => row.id || row.pathOrField).map((row) => {
    const missing = [
      ...(row.pathOrField ? [] : ['canonical_surface_path_or_field_missing']),
      ...(row.traceRefs.length ? [] : ['canonical_surface_trace_refs_missing']),
      ...(row.evidenceRefs.length ? [] : ['canonical_surface_evidence_refs_missing']),
    ];
    return { ...row, missing, ready: missing.length === 0 };
  });

  const currentTargetMap = confirmation.currentTargetMap ?? {};
  const currentTargetGroups = [
    ['currentSummary', asArray(currentTargetMap.currentSummary)],
    ['targetSummary', asArray(currentTargetMap.targetSummary)],
    ['diffRows', asArray(currentTargetMap.diffRows)],
    ['process', asArray(currentTargetMap.process)],
    ['artifactPaths', asArray(currentTargetMap.artifactPaths)],
    ['canonicalArtifacts', asArray(currentTargetMap.canonicalArtifacts)],
    ['existingArtifacts', asArray(currentTargetMap.existingArtifacts)],
  ];
  const currentTargetRows = currentTargetGroups.map(([id, rows]) => ({
    id,
    count: rows.length,
    missing: rows.length ? [] : ['current_target_map_group_missing'],
    ready: rows.length > 0,
  }));
  const currentTargetMissing = [
    ...rowsMissing(currentTargetRows, 'CURRENT_TARGET_MAP'),
    ...(currentTargetMap.schemaVersion === CURRENT_TARGET_SCHEMA_VERSION
      ? []
      : [{ id: 'schemaVersion', code: 'current_target_map_schema_version_missing_or_invalid', category: 'CURRENT_TARGET_MAP' }]),
    ...(currentTargetMap.displayProfile === CURRENT_TARGET_DISPLAY_PROFILE
      ? []
      : [{ id: 'displayProfile', code: 'current_target_map_display_profile_missing_or_invalid', category: 'CURRENT_TARGET_MAP' }]),
  ];

  const legacyRows = asArray(confirmation.currentTargetMap?.existingArtifacts)
    .filter((row) => ['legacy_only', 'not_completion_proof'].includes(String(row.completionProofPolicy ?? '')))
    .map((row) => {
      const traceRefs = refsForRow(row, ['traceRows', 'traceRefs']);
      const evidenceRefs = refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']);
      const missing = [
        ...(row.currentPath ? [] : ['legacy_denial_oracle_missing']),
        ...(traceRefs.length + evidenceRefs.length ? [] : ['legacy_denial_refs_missing']),
      ];
      return { id: row.id || row.currentPath, pathOrField: row.currentPath, completionProofPolicy: row.completionProofPolicy, traceRefs, evidenceRefs, missing, ready: missing.length === 0 };
    });

  const closeout = confirmation.closeoutReadinessPreview ?? {};
  const closeoutMissing = [
    ...(stringList(closeout.requiredCommands).length ? [] : ['closeout_proof_required_commands_missing']),
    ...([closeout.orphanPolicy, closeout.currentAttemptPolicy, closeout.recordClosedPolicy].filter(Boolean).length ? [] : ['closeout_proof_policies_missing']),
    ...(canonicalRows.length ? [] : ['closeout_proof_target_refs_missing']),
  ];

  const evidenceRows = asArray(confirmation.evidence).map((row) => {
    const requiredCommandRefs = refsForRow(row, ['requiredCommandRefs', 'commandRefs']);
    const artifactRefs = refsForRow(row, ['artifactRefs']);
    const missing = [
      ...(String(row.oracle ?? '').trim() ? [] : ['evidence_trust_oracle_missing']),
      ...(requiredCommandRefs.length ? [] : ['evidence_trust_command_refs_missing']),
      ...(artifactRefs.length ? [] : ['evidence_trust_artifact_refs_missing']),
    ];
    return { id: row.id, requiredCommandRefs, artifactRefs, missing, ready: missing.length === 0 };
  }).filter((row) => row.id);

  const sections = {
    errorCaseCoverage: { rows: [...failurePaths, ...edgeCases], missing: [...rowsMissing(failurePaths, 'FAIL'), ...rowsMissing(edgeCases, 'EDGE')] },
    commandTargetCollection: { rows: commandTargetRows, missing: rowsMissing(commandTargetRows, 'CMD_TARGET') },
    traceClosureAssertions: { rows: traceClosureRows, missing: rowsMissing(traceClosureRows, 'TRACE_CLOSURE') },
    currentTargetMap: { rows: currentTargetRows, missing: currentTargetMissing },
    canonicalSurfaceReconciliation: { rows: canonicalRows, missing: rowsMissing(canonicalRows, 'CANONICAL_SURFACE') },
    legacyDenial: { rows: legacyRows, missing: rowsMissing(legacyRows, 'LEGACY_DENIAL') },
    closeoutProof: { rows: [{ id: 'closeoutReadinessPreview', requiredCommands: stringList(closeout.requiredCommands), policies: [closeout.orphanPolicy, closeout.currentAttemptPolicy, closeout.recordClosedPolicy].filter(Boolean), missing: closeoutMissing }], missing: closeoutMissing.map((code) => ({ id: 'closeoutReadinessPreview', code, category: 'CLOSEOUT_PROOF' })) },
    evidenceTrustStates: { rows: evidenceRows, missing: rowsMissing(evidenceRows, 'EVIDENCE_TRUST') },
    targetModificationPathCoverage: {
      rows: targetModificationPaths,
      missing: [
        ...asArray(targetModificationPathCoverage?.missingCoverage).map((row) => ({
          id: row.path,
          code: 'target_modification_path_coverage_missing',
          category: 'TARGET_MODIFICATION_PATH_COVERAGE',
        })),
        ...asArray(targetModificationPathCoverage?.unclassifiedCoverage).map((row) => ({
          id: row.path,
          code: 'target_modification_path_classification_missing',
          category: 'TARGET_MODIFICATION_PATH_COVERAGE',
        })),
      ],
    },
  };
  for (const section of Object.values(sections)) {
    section.ready = section.rows.length > 0 && section.missing.length === 0;
    section.decision = section.ready ? 'pass' : 'blocked';
    if (!section.rows.length) section.missing.push({ id: 'section', code: 'ai_tdd_manifest_section_empty', category: 'AI_TDD_MANIFEST' });
  }
  const blockingIssues = Object.entries(sections).flatMap(([sectionName, section]) =>
    section.missing.map((item) => blocking(`ai_tdd_manifest_${item.code}`, `${sectionName} missing ${item.id}: ${item.code}`, [sectionName, item.id]))
  );
  return {
    required,
    ready: !required || blockingIssues.length === 0,
    decision: !required || blockingIssues.length === 0 ? 'pass' : 'blocked',
    sections,
    blockingIssues: required ? blockingIssues : [],
    counts: Object.fromEntries(Object.entries(sections).map(([key, section]) => [key, section.rows.length])),
  };
}

function hasStatusWithoutUserApproval(status) {
  return ['DEFERRED', 'OUT_OF_SCOPE'].includes(String(status ?? '').toUpperCase());
}

function traceContractValidationCommandRefs(row) {
  return stringList(row.contractValidationCommandRefs);
}

function traceDeliveryEvidenceCommandRefs(row) {
  return stringList(row.deliveryEvidenceCommandRefs);
}

function targetModificationPathsRequired(confirmation, artifactPlan) {
  if (applicabilityDomainApplies(confirmation, 'scriptsAndHooks')) return true;
  if (applicabilityDomainApplies(confirmation, 'currentTargetMap')) return true;
  if (applicabilityDomainApplies(confirmation, 'governanceEvents')) return true;
  if (runtimeRecoveryRequiresRegistry(confirmation)) return true;
  return artifactPlan.some(
    (item) =>
      item.sourceOfTruthRole === 'implementation' ||
      item.canAffectControlFlow === true ||
      /^(?:code|script|hook|test|config|schema)$/iu.test(String(item.artifactType ?? ''))
  );
}

function normalizeTargetModificationPaths(confirmation, artifactPlan) {
  const rows = [];
  const scalarList = (value) =>
    asArray(value)
      .filter((item) => typeof item === 'string' || typeof item === 'number')
      .map((item) => String(item));
  const pushRow = (row, index, sourceSection) => {
    const pathValue = String(row?.path ?? row?.targetPath ?? row?.targetPathOrField ?? row?.file ?? row?.glob ?? '').trim();
    if (!pathValue) return;
    rows.push({
      id: String(row?.id ?? row?.targetModificationId ?? `TARGET-MOD-${String(index + 1).padStart(3, '0')}`).trim(),
      path: normalizePathForReport(pathValue),
      coverageRole: String(
        row?.coverageRole ??
          row?.targetPathRole ??
          row?.pathRole ??
          row?.classification ??
          row?.role ??
          ''
      ).trim(),
      changeType: String(row?.changeType ?? row?.operation ?? row?.action ?? row?.modificationType ?? '').trim(),
      intent: String(row?.intent ?? row?.purpose ?? row?.description ?? row?.reason ?? '').trim(),
      ownerModel: String(row?.ownerModel ?? row?.owner ?? '').trim(),
      requirementRefs: unique([...stringList(row?.requirementRefs), ...stringList(row?.linkedRequirements), ...stringList(row?.covers)]),
      traceRefs: unique([...stringList(row?.traceRefs), ...stringList(row?.traceRows)]),
      evidenceRefs: unique([...stringList(row?.evidenceRefs), ...stringList(row?.linkedEvidenceIds)]),
      artifactRefs: unique([...stringList(row?.artifactRefs), ...stringList(row?.outputArtifacts)]),
      requiresReconfirmationOnChange: row?.requiresReconfirmationOnChange === false ? false : true,
      sourceSection,
      sourceArtifactId: String(row?.sourceArtifactId ?? row?.artifactId ?? '').trim(),
    });
  };

  scalarList(confirmation?.targetModificationPaths).forEach((value, index) =>
    pushRow({ path: value }, index, 'targetModificationPaths')
  );
  asArray(confirmation?.targetModificationPaths).forEach((row, index) => {
    if (row && typeof row === 'object') pushRow(row, index, 'targetModificationPaths');
  });
  scalarList(confirmation?.targetPaths).forEach((value, index) => pushRow({ path: value }, index, 'targetPaths'));
  asArray(confirmation?.implementationTasks).forEach((task, taskIndex) => {
    scalarList(task?.targetPaths).forEach((value, pathIndex) =>
      pushRow(
        {
          id: task?.id ? `${task.id}-TARGET-${pathIndex + 1}` : undefined,
          path: value,
          intent: task?.description ?? task?.title ?? task?.intent,
          ownerModel: task?.ownerModel,
          requirementRefs: task?.requirementRefs ?? task?.covers,
          traceRefs: task?.traceRefs ?? task?.traceRows,
          evidenceRefs: task?.evidenceRefs,
        },
        taskIndex + pathIndex,
        'implementationTasks.targetPaths'
      )
    );
  });

  if (!rows.length) {
    artifactPlan
      .filter(
        (item) =>
          item.sourceOfTruthRole === 'implementation' ||
          item.canAffectControlFlow === true ||
          /^(?:code|script|hook|test|config|schema)$/iu.test(String(item.artifactType ?? ''))
      )
      .forEach((item, index) =>
        pushRow(
          {
            id: `TARGET-MOD-DERIVED-${String(index + 1).padStart(3, '0')}`,
            path: item.path,
            changeType: item.artifactType,
            intent: item.currentFunction || item.targetRole,
            ownerModel: item.ownerModel,
            linkedRequirements: item.linkedRequirements,
            artifactRefs: [item.artifactId],
            requiresReconfirmationOnChange: true,
            sourceArtifactId: item.artifactId,
          },
          index,
          'artifactAutomationPlan.derived'
        )
      );
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.path}\u0000${row.sourceSection}\u0000${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateTargetModificationPaths(confirmation, targetModificationPaths, artifactPlan, idSet, pathCoverage = null) {
  const issues = [];
  const artifactIds = new Set(artifactPlan.map((item) => item.artifactId).filter(Boolean));
  const explicitRows = targetModificationPaths.filter((row) => row.sourceSection !== 'artifactAutomationPlan.derived');
  if (targetModificationPathsRequired(confirmation, artifactPlan) && !explicitRows.length) {
    issues.push(
      blocking(
        'target_modification_paths_missing',
        'implementationConfirmation.targetModificationPaths[] must explicitly declare target paths when scripts/hooks/governance/current-target or implementation artifacts apply; artifactAutomationPlan-derived rows are display hints only',
        ['implementationConfirmation.targetModificationPaths']
      )
    );
  }
  targetModificationPaths.forEach((row) => {
    const rowId = row.id || row.path || 'TARGET-MOD-UNKNOWN';
    if (!row.path) issues.push(blocking('target_modification_path_missing', `${rowId} missing path`, [rowId]));
    for (const ref of row.requirementRefs) {
      if (!idSet.must.has(ref) && !idSet.notDone.has(ref) && !idSet.mustNot.has(ref)) {
        issues.push(blocking('target_modification_unknown_requirement_ref', `${rowId} references unknown requirement ${ref}`, [rowId, ref]));
      }
    }
    for (const ref of row.traceRefs) {
      if (!idSet.traceRows.has(ref)) {
        issues.push(blocking('target_modification_unknown_trace_ref', `${rowId} references unknown trace ${ref}`, [rowId, ref]));
      }
    }
    for (const ref of row.evidenceRefs) {
      if (!idSet.evidence.has(ref)) {
        issues.push(blocking('target_modification_unknown_evidence_ref', `${rowId} references unknown evidence ${ref}`, [rowId, ref]));
      }
    }
    for (const ref of row.artifactRefs) {
      if (!artifactIds.has(ref)) {
        issues.push(blocking('target_modification_unknown_artifact_ref', `${rowId} references unknown artifact ${ref}`, [rowId, ref]));
      }
    }
  });
  if (pathCoverage) {
    for (const row of pathCoverage.missing ?? []) {
      issues.push(
        blocking(
          'target_modification_path_coverage_missing',
          `${row.path} is declared by ${row.sources.join(', ')} but missing from targetModificationPaths[]`,
          [row.path, ...row.refs]
        )
      );
    }
    for (const row of pathCoverage.unclassified ?? []) {
      issues.push(
        blocking(
          'target_modification_path_classification_missing',
          `${row.path} is a command/current-target path and must be classified as validation_only, generated_output, runtime_output, or an explicit modification`,
          [row.path, ...row.refs]
        )
      );
    }
  }
  return issues;
}

function mergeArtifactPlans(inlinePlan, externalPlan) {
  const inlineItems = asArray(inlinePlan);
  const externalItems = Array.isArray(externalPlan)
    ? externalPlan
    : asArray(externalPlan?.artifactAutomationPlan ?? externalPlan?.items);
  return [...inlineItems, ...externalItems].map((item, index) => ({
    artifactId: item.artifactId ?? item.id ?? `ART-${String(index + 1).padStart(3, '0')}`,
    path: item.path ?? '',
    artifactType: item.artifactType ?? item.kind ?? '',
    sourceOfTruthRole: item.sourceOfTruthRole ?? item.role ?? '',
    ownerModel: item.ownerModel ?? '',
    producer: item.producer ?? '',
    consumer: item.consumer ?? '',
    inputArtifacts: stringList(item.inputArtifacts),
    outputArtifacts: stringList(item.outputArtifacts),
    recordEventTypes: stringList(item.recordEventTypes),
    canAffectControlFlow: item.canAffectControlFlow === true,
    userApprovalRequired: item.userApprovalRequired === true,
    retention: item.retention ?? '',
    cleanupPolicy: item.cleanupPolicy ?? '',
    orphanRisk: item.orphanRisk ?? '',
    containsSensitiveData: item.containsSensitiveData === true,
    trainingDataEligible: item.trainingDataEligible === true,
    group: item.group ?? item.category ?? 'unspecified',
    fallback: item.fallback ?? '',
    currentFunction: item.currentFunction ?? item.function ?? item.description ?? '',
    targetRole: item.targetRole ?? '',
    linkedRequirements: stringList(item.linkedRequirements),
    traceRows: unique([...stringList(item.traceRows), ...stringList(item.traceRefs)]),
    evidenceRefs: unique([...stringList(item.evidenceRefs), ...stringList(item.linkedEvidenceIds)]),
    raw: item,
  }));
}

function validateArtifactPlanEventTypes(artifactPlan, governanceEventTypes) {
  const issues = [];
  if (!governanceEventTypes.size && artifactPlan.some((item) => stringList(item.recordEventTypes).length)) {
    issues.push(
      blocking(
        'governance_event_type_registry_missing',
        'implementationConfirmation.governanceEventTypeRegistry[] is required when artifactAutomationPlan uses recordEventTypes[]'
      )
    );
  }
  artifactPlan.forEach((item) => {
    for (const eventType of stringList(item.recordEventTypes)) {
      if (!governanceEventTypes.has(eventType)) {
        issues.push(
          blocking('artifact_plan_unknown_record_event_type', `${item.artifactId} references unknown record event type ${eventType}`, [
            item.artifactId,
            eventType,
          ])
        );
      }
    }
  });
  return issues;
}

function controlledIngestWriterRegistryRequired(confirmation, governanceEventTypes) {
  if (applicabilityDomainApplies(confirmation, 'governanceEvents')) return true;
  if (governanceEventTypes?.definitions?.size || governanceEventTypes?.size) return true;
  if (asArray(confirmation?.artifactAutomationPlan).some((item) => stringList(item?.recordEventTypes).length)) return true;
  if (
    asArray(confirmation?.functionalResumeFailureCaseRegistry?.recoveryActionDefinitions).some((item) =>
      stringList(item?.recordEventTypes).length
    )
  ) {
    return true;
  }
  return false;
}

function buildControlledIngestWriterCoverage(rows, eventTypeDefs) {
  const eventTypeToWriters = {};
  const controlFieldToWriters = {};
  for (const row of rows) {
    for (const eventType of row.allowedEventTypes) {
      eventTypeToWriters[eventType] = eventTypeToWriters[eventType] ?? [];
      eventTypeToWriters[eventType].push(row.writerId);
    }
    for (const field of row.writesControlFields) {
      controlFieldToWriters[field] = controlFieldToWriters[field] ?? [];
      controlFieldToWriters[field].push(row.writerId);
    }
  }
  const uncoveredEventTypes = [...eventTypeDefs.entries()]
    .filter(([, eventDef]) => stringList(eventDef?.writesControlFields).length)
    .map(([eventType]) => eventType)
    .filter((eventType) => !eventTypeToWriters[eventType]?.length);
  return {
    eventTypeToWriters,
    controlFieldToWriters,
    uncoveredEventTypes,
  };
}

function normalizeControlledIngestWriterRegistry(confirmation, governanceEventTypes) {
  const issues = [];
  const rows = asArray(confirmation?.controlledIngestWriterRegistry);
  const eventTypeDefs = governanceEventTypes?.definitions ?? governanceEventTypes ?? new Map();
  const writerIds = new Set();
  if (!rows.length) {
    if (!controlledIngestWriterRegistryRequired(confirmation, governanceEventTypes)) {
      return {
        rows: [],
        coverage: buildControlledIngestWriterCoverage([], eventTypeDefs),
        schemaIssues: [],
      };
    }
    return {
      rows: [],
      coverage: buildControlledIngestWriterCoverage([], eventTypeDefs),
      schemaIssues: [
        blocking(
          'controlled_ingest_writer_registry_missing',
          'implementationConfirmation.controlledIngestWriterRegistry[] is required when governance events apply',
          ['controlledIngestWriterRegistry']
        ),
      ],
    };
  }
  const requiredFields = [
    'writerId',
    'scriptPath',
    'scriptContentHash',
    'ownerModel',
    'receiptPath',
    'registryHash',
    'architectureConfirmationHash',
  ];
  const requiredListFields = [
    'allowedWriteApis',
    'allowedPaths',
    'allowedEventTypes',
    'payloadContractRefs',
    'writesControlFields',
  ];
  const normalized = rows.map((row, index) => {
    const writerId = String(row?.writerId ?? '').trim();
    const ref = writerId || `controlledIngestWriterRegistry[${index}]`;
    if (!writerId) {
      issues.push(blocking('controlled_ingest_writer_missing_id', `${ref} missing writerId`, [ref]));
    } else if (writerIds.has(writerId)) {
      issues.push(blocking('controlled_ingest_writer_duplicate_id', `${writerId} is duplicated`, [writerId]));
    }
    if (writerId) writerIds.add(writerId);
    for (const field of requiredFields) {
      if (row?.[field] === undefined || row?.[field] === null || String(row[field]).trim() === '') {
        issues.push(blocking('controlled_ingest_writer_missing_required_field', `${ref} missing ${field}`, [ref, field]));
      }
    }
    const listValues = {};
    for (const field of requiredListFields) {
      listValues[field] = stringList(row?.[field]);
      if (!listValues[field].length) {
        issues.push(blocking('controlled_ingest_writer_missing_required_list', `${ref} missing ${field}[]`, [ref, field]));
      }
    }
    if (row?.beforeAfterHashRequired !== true) {
      issues.push(
        blocking('controlled_ingest_writer_before_after_hash_not_required', `${ref} must set beforeAfterHashRequired=true`, [
          ref,
          'beforeAfterHashRequired',
        ])
      );
    }
    if (row?.canModifyWriterRegistry !== false) {
      issues.push(
        blocking('controlled_ingest_writer_can_modify_registry_not_false', `${ref} must set canModifyWriterRegistry=false`, [
          ref,
          'canModifyWriterRegistry',
        ])
      );
    }
    for (const allowedPath of listValues.allowedPaths) {
      if (
        allowedPath === '_bmad-output/runtime/requirement-records/**' ||
        allowedPath === '_bmad-output/runtime/requirement-records/<requirement-set-id>/**' ||
        /runtime\/requirement-records\/\*\*/u.test(allowedPath)
      ) {
        issues.push(blocking('controlled_ingest_writer_allowed_path_too_broad', `${ref} uses broad allowedPath ${allowedPath}`, [ref, allowedPath]));
      }
    }
    const allowedControlFields = new Set();
    for (const eventType of listValues.allowedEventTypes) {
      const eventDef = eventTypeDefs.get(eventType);
      if (!eventDef) {
        issues.push(blocking('controlled_ingest_writer_unknown_event_type', `${ref} references unknown eventType ${eventType}`, [ref, eventType]));
        continue;
      }
      stringList(eventDef.writesControlFields).forEach((field) => allowedControlFields.add(field));
      if (!listValues.payloadContractRefs.includes(eventType)) {
        issues.push(
          blocking('controlled_ingest_writer_missing_payload_contract_ref', `${ref} missing payloadContractRefs entry for ${eventType}`, [
            ref,
            eventType,
          ])
        );
      }
    }
    for (const controlField of listValues.writesControlFields) {
      if (!allowedControlFields.has(controlField)) {
        issues.push(
          blocking(
            'controlled_ingest_writer_control_field_not_covered',
            `${ref} writes ${controlField} but allowedEventTypes[] do not cover it`,
            [ref, controlField]
          )
        );
      }
    }
    return {
      writerId,
      scriptPath: String(row?.scriptPath ?? '').trim(),
      scriptContentHash: String(row?.scriptContentHash ?? '').trim(),
      ownerModel: String(row?.ownerModel ?? '').trim(),
      allowedWriteApis: listValues.allowedWriteApis,
      allowedPaths: listValues.allowedPaths,
      allowedEventTypes: listValues.allowedEventTypes,
      payloadContractRefs: listValues.payloadContractRefs,
      writesControlFields: listValues.writesControlFields,
      receiptPath: String(row?.receiptPath ?? '').trim(),
      beforeAfterHashRequired: row?.beforeAfterHashRequired === true,
      canModifyWriterRegistry: row?.canModifyWriterRegistry === true,
      registryHash: String(row?.registryHash ?? '').trim(),
      architectureConfirmationHash: String(row?.architectureConfirmationHash ?? '').trim(),
    };
  });
  const coverage = buildControlledIngestWriterCoverage(normalized, eventTypeDefs);
  for (const eventType of coverage.uncoveredEventTypes) {
    issues.push(
      blocking(
        'controlled_ingest_writer_uncovered_event_type',
        `governance event type ${eventType} writes control fields but no controlledIngestWriterRegistry[] writer allows it`,
        [eventType]
      )
    );
  }
  return { rows: normalized, coverage, schemaIssues: issues };
}

function validateApplicabilityDomains(confirmation) {
  const issues = [];
  const applicability = confirmation?.applicability;
  if (!applicability || typeof applicability !== 'object' || Array.isArray(applicability)) {
    return [blocking('missing_applicability', 'implementationConfirmation.applicability is required')];
  }
  for (const domain of REQUIRED_APPLICABILITY_DOMAINS) {
    const row = applicability[domain];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      issues.push(blocking('missing_applicability_domain', `applicability.${domain} is required`, [
        `applicability.${domain}`,
      ]));
      continue;
    }
    if (typeof row.applies !== 'boolean') {
      issues.push(blocking('applicability_domain_missing_applies', `applicability.${domain}.applies must be true or false`, [
        `applicability.${domain}.applies`,
      ]));
    }
    if (!String(row.reasonCode ?? '').trim()) {
      issues.push(blocking('applicability_domain_missing_reason_code', `applicability.${domain}.reasonCode is required`, [
        `applicability.${domain}.reasonCode`,
      ]));
    }
  }
  return issues;
}

function applicabilityDomainApplies(confirmation, domain) {
  return confirmation?.applicability?.[domain]?.applies === true;
}

function runtimeRecoveryRequiresRegistry(confirmation) {
  const runtimeRecovery = confirmation?.applicability?.runtimeRecovery;
  return runtimeRecovery?.applies === true || runtimeRecovery?.requiresFunctionalResumeFailureCaseRegistry === true;
}

function validateOwnerModelPolicy(confirmation, artifactPlan) {
  const issues = [];
  const policy = confirmation?.ownerModelPolicy;
  const allowedModels = new Set(stringList(policy?.allowedDisplayModels));
  if (!allowedModels.size) return issues;

  const displayField = String(policy?.displayModelField ?? 'ownerModel').trim() || 'ownerModel';
  const checkRows = (rows, label, idField = 'id') => {
    asArray(rows).forEach((row, index) => {
      const ownerModel = String(row?.[displayField] ?? '').trim();
      if (!ownerModel || allowedModels.has(ownerModel)) return;
      const rowId =
        row?.[idField] ??
        row?.artifactId ??
        row?.eventType ??
        row?.actionId ??
        row?.groupId ??
        row?.category ??
        row?.title ??
        `${label}[${index}]`;
      issues.push(
        blocking(
          'owner_model_not_six_mental_model',
          `${label}.${rowId} uses internal ownerModel ${ownerModel}; move it to ownerSubsystem/producerSubsystem`,
          [label, String(rowId), ownerModel]
        )
      );
    });
  };

  checkRows(confirmation?.implementationTasks, 'implementationTasks');
  checkRows(artifactPlan, 'artifactAutomationPlan', 'artifactId');
  checkRows(confirmation?.governanceEventTypeRegistry, 'governanceEventTypeRegistry', 'eventType');
  checkRows(confirmation?.controlledIngestWriterRegistry, 'controlledIngestWriterRegistry', 'writerId');
  checkRows(confirmation?.functionalResumeFailureCaseRegistry?.groups, 'functionalResumeFailureCaseRegistry.groups', 'groupId');
  checkRows(
    confirmation?.functionalResumeFailureCaseRegistry?.recoveryActionDefinitions,
    'functionalResumeFailureCaseRegistry.recoveryActionDefinitions',
    'actionId'
  );
  checkRows(confirmation?.functionalResumeFailureCaseRegistry?.failureCases, 'functionalResumeFailureCaseRegistry.failureCases');
  checkRows(confirmation?.architectureImpacts, 'architectureImpacts');

  return issues;
}

function validateConditionalApplicabilityModules(confirmation, resumeFailureRegistry) {
  const issues = [];
  if (applicabilityDomainApplies(confirmation, 'governanceEvents') && !asArray(confirmation.governanceEventTypeRegistry).length) {
    issues.push(
      blocking(
        'governance_event_type_registry_missing',
        'applicability.governanceEvents.applies=true requires implementationConfirmation.governanceEventTypeRegistry[]',
        ['applicability.governanceEvents', 'governanceEventTypeRegistry']
      )
    );
  }
  if (runtimeRecoveryRequiresRegistry(confirmation) && !resumeFailureRegistry?.rawPresent) {
    issues.push(
      blocking(
        'functional_resume_failure_case_registry_missing',
        'applicability.runtimeRecovery requires functionalResumeFailureCaseRegistry',
        ['applicability.runtimeRecovery', 'functionalResumeFailureCaseRegistry']
      )
    );
  }
  return issues;
}

function classifyArtifactGroups(artifactPlan) {
  const groups = {
    confirmation: [],
    executionEvidence: [],
    existingLegacy: [],
    scripts: [],
    hooks: [],
    notGenerated: [],
    unspecified: [],
  };
  for (const item of artifactPlan) {
    const key = String(item.group).replace(/[-_ ]+([a-z])/giu, (_, c) => c.toUpperCase());
    if (groups[key]) groups[key].push(item);
    else if (/script/iu.test(item.artifactType) || /scripts?[\\/]/iu.test(item.path)) groups.scripts.push(item);
    else if (/hook/iu.test(item.artifactType) || /hooks?[\\/]/iu.test(item.path)) groups.hooks.push(item);
    else if (/confirm/iu.test(item.artifactType) || /confirmation/iu.test(item.path)) groups.confirmation.push(item);
    else if (/evidence|report|audit/iu.test(item.artifactType)) groups.executionEvidence.push(item);
    else groups.unspecified.push(item);
  }
  return groups;
}

function validateInput(args) {
  const issues = [];
  if (!args.source) issues.push(blocking('missing_cli_source', '--source is required'));
  if (!args.out) issues.push(blocking('missing_cli_out', '--out is required'));
  if (!args.language) issues.push(blocking('missing_cli_language', '--language is required'));
  if (args.language && !VALID_LANGUAGES.has(args.language)) {
    issues.push(blocking('invalid_language', `--language must be ${[...VALID_LANGUAGES].join('|')}`));
  }
  if (args.entryFlow && !VALID_ENTRY_FLOWS.has(args.entryFlow)) {
    issues.push(blocking('invalid_entry_flow', `--entry-flow must be ${[...VALID_ENTRY_FLOWS].join('|')}`));
  }
  if (args.entryFlowClass && !VALID_ENTRY_FLOW_CLASSES.has(args.entryFlowClass)) {
    issues.push(
      blocking(
        'invalid_entry_flow_class',
        `--entry-flow-class must be ${[...VALID_ENTRY_FLOW_CLASSES].join('|')}`
      )
    );
  }
  if (args.workflowAdapter && !VALID_WORKFLOW_ADAPTERS.has(args.workflowAdapter)) {
    issues.push(
      blocking(
        'invalid_workflow_adapter',
        `--workflow-adapter must be ${[...VALID_WORKFLOW_ADAPTERS].join('|')}`
      )
    );
  }
  if (args.mode && !VALID_RENDER_MODES.has(args.mode)) {
    issues.push(blocking('invalid_mode', `--mode must be ${[...VALID_RENDER_MODES].join('|')}`));
  }
  if (args.theme && !VALID_THEMES.has(args.theme)) {
    issues.push(blocking('invalid_theme', `--theme must be ${[...VALID_THEMES].join('|')}`));
  }
  const mermaidBundle = resolveMermaidBundlePath(args);
  if (args.mermaidBundle && !mermaidBundle) {
    issues.push(
      blocking(
        'invalid_mermaid_bundle_path',
        `--mermaid-bundle does not point to an existing local file: ${args.mermaidBundle}`
      )
    );
  }
  if (args.requireMermaidRuntime && !mermaidBundle) {
    issues.push(
      blocking(
        'missing_mermaid_runtime',
        '--require-mermaid-runtime was set but Mermaid runtime was not found; install mermaid or pass --mermaid-bundle'
      )
    );
  }
  return issues;
}

function resolveMermaidBundlePath(args) {
  const explicit = args.mermaidBundle ? path.resolve(args.mermaidBundle) : null;
  if (explicit && fs.existsSync(explicit)) return explicit;
  if (explicit) return null;
  if (fs.existsSync(SKILL_MERMAID_BUNDLE_PATH)) return SKILL_MERMAID_BUNDLE_PATH;
  if (fs.existsSync(PROJECT_MERMAID_BUNDLE_PATH)) return PROJECT_MERMAID_BUNDLE_PATH;
  return null;
}

function readMermaidRuntimeScript(args) {
  const bundlePath = resolveMermaidBundlePath(args);
  if (!bundlePath) {
    return {
      path: null,
      hash: null,
      script: '',
      available: false,
      issues: [],
      format: 'missing',
    };
  }
  const script = readText(bundlePath);
  const issues = validateMermaidRuntimeScript(bundlePath, script);
  if (issues.length) {
    return {
      path: normalizePathForReport(bundlePath),
      hash: sha256(script),
      script: '',
      available: false,
      issues,
      format: 'invalid',
    };
  }
  return {
    path: normalizePathForReport(bundlePath),
    hash: sha256(script),
    script,
    available: true,
    issues: [],
    format: 'classic-global',
  };
}

function validateMermaidRuntimeScript(bundlePath, script) {
  const normalizedPath = normalizePathForReport(bundlePath);
  const refs = [normalizedPath];
  const staticEsmImport = /(^|[;\r\n])\s*import(?:\s|[{*"'])/u.test(script);
  const staticEsmExport = /(^|[;\r\n])\s*export(?:\s|[{*])/u.test(script);
  if (staticEsmImport || staticEsmExport || /\.mjs$/iu.test(bundlePath)) {
    return [
      blocking(
        'invalid_mermaid_runtime_bundle',
        'Mermaid runtime bundle must be a browser classic script that initializes window.mermaid; ESM import/export bundles cannot be inlined into confirmation HTML.',
        refs
      ),
    ];
  }
  const exposesClassicGlobal =
    /\b(?:window|globalThis|self)\.mermaid\s*=/u.test(script) ||
    /\bvar\s+mermaid\s*=/u.test(script) ||
    /\bmermaid\s*=\s*(?:function\b|\()/u.test(script) ||
    /\.mermaid\s*=/u.test(script);
  if (!exposesClassicGlobal) {
    return [
      blocking(
        'invalid_mermaid_runtime_bundle',
        'Mermaid runtime bundle does not expose a classic global mermaid runtime. Use dist/mermaid.min.js or pass a bundle that assigns window.mermaid.',
        refs
      ),
    ];
  }
  return [];
}

function blocking(code, message, refs = []) {
  return { severity: 'blocking', code, message, refs };
}

function warning(code, message, refs = []) {
  return { severity: 'warning', code, message, refs };
}

function hasCjkText(value) {
  return /[\u3400-\u9fff]/u.test(String(value ?? ''));
}

function hasLatinWordText(value) {
  return /[A-Za-z]{3,}/u.test(String(value ?? ''));
}

function localizedValue(item, key, language) {
  if (!item || typeof item !== 'object') return '';
  if (language === 'zh-CN' || language === 'bilingual') {
    const candidates = [
      item[`${key}ZhCN`],
      item[`${key}ZhCn`],
      item[`${key}Zh`],
      item[`${key}_zh_CN`],
      item[`${key}_zh`],
      item.zhCN?.[key],
      item.zh?.[key],
      item.localized?.['zh-CN']?.[key],
      item.localized?.zhCN?.[key],
      item.localized?.zh?.[key],
      item.localizedText?.['zh-CN'],
      item.localizedText?.zhCN,
      item.localizedText?.zh,
    ];
    for (const candidate of candidates) {
      if (String(candidate ?? '').trim()) return candidate;
    }
  }
  return item[key];
}

function userFacingText(item, key, language) {
  const localized = localizedValue(item, key, language);
  if (String(localized ?? '').trim()) return localized;
  return item?.[key];
}

function isEnglishOnlyConfirmationText(value) {
  const text = String(value ?? '').trim();
  return Boolean(text) && hasLatinWordText(text) && !hasCjkText(text);
}

function validateConfirmationLanguageContent(confirmation, language) {
  if (language !== 'zh-CN' && language !== 'bilingual') return [];
  const issues = [];
  const fieldGroups = [
    ['must', 'must', ['text']],
    ['notDone', 'notDone', ['text', 'whyItBlocksCompletion']],
    ['mustNot', 'mustNot', ['text', 'scopeBoundary']],
    ['evidence', 'evidence', ['text', 'oracle']],
    ['failurePaths', 'failurePaths', ['title', 'trigger', 'expectedBehavior', 'forbiddenBehavior']],
    ['edgeCases', 'edgeCases', ['condition', 'expectedBehavior', 'forbiddenBehavior']],
    ['openQuestions', 'openQuestions', ['text', 'requiredDecision', 'impactIfUnresolved']],
  ];
  for (const [groupName, arrayKey, fields] of fieldGroups) {
    asArray(confirmation?.[arrayKey]).forEach((item, index) => {
      const ref = item?.id ?? `${groupName}[${index}]`;
      for (const field of fields) {
        const raw = item?.[field];
        if (!String(raw ?? '').trim()) continue;
        const localized = localizedValue(item, field, language);
        if (!hasCjkText(localized) && isEnglishOnlyConfirmationText(raw)) {
          issues.push(
            blocking(
              'confirmation_language_content_english_only',
              `confirmationLanguage=${language} requires Chinese confirmation text for ${ref}.${field}; provide Chinese source text or ${field}Zh/textZh/localized.zh-CN before user confirmation.`,
              [ref, field]
            )
          );
        }
      }
    });
  }
  asArray(confirmation?.traceRows).forEach((row, index) => {
    const ref = row?.id ?? `traceRows[${index}]`;
    for (const field of ['closureAssertion', 'targetStateAssertion', 'acceptanceSummary']) {
      const raw = row?.[field];
      if (!String(raw ?? '').trim()) continue;
      const localized = localizedValue(row, field, language);
      if (!hasCjkText(localized) && isEnglishOnlyConfirmationText(raw)) {
        issues.push(
          blocking(
            'confirmation_language_content_english_only',
            `confirmationLanguage=${language} requires Chinese confirmation text for ${ref}.${field}; provide Chinese source text or ${field}Zh/localized.zh-CN before user confirmation.`,
            [ref, field]
          )
        );
      }
    }
  });
  return issues;
}

function buildReconfirmationState(confirmation, currentHashes, driftClassification = null) {
  const request = confirmation.reconfirmationRequest && typeof confirmation.reconfirmationRequest === 'object'
    ? confirmation.reconfirmationRequest
    : {};
  const previousSourceDocumentHash =
    driftClassification?.latestConfirmedSourceDocumentHash ??
    request.previousSourceDocumentHash ??
    confirmation.sourceDocumentHash ??
    null;
  const previousImplementationConfirmationHash =
    driftClassification?.latestConfirmedImplementationConfirmationHash ??
    request.previousImplementationConfirmationHash ??
    confirmation.implementationConfirmationHash ??
    null;
  const currentSourceDocumentHash =
    driftClassification?.currentSourceDocumentHash ?? request.currentSourceDocumentHash ?? currentHashes.sourceDocumentHash;
  const currentImplementationConfirmationHash =
    driftClassification?.currentImplementationConfirmationHash ??
    request.currentImplementationConfirmationHash ??
    currentHashes.implementationConfirmationHash;
  const sourceChanged = driftClassification
    ? driftClassification.sourceChanged === true
    : Boolean(previousSourceDocumentHash) && previousSourceDocumentHash !== currentHashes.sourceDocumentHash;
  const implementationChanged = driftClassification
    ? driftClassification.implementationChanged === true
    : Boolean(previousImplementationConfirmationHash) &&
      previousImplementationConfirmationHash !== currentHashes.implementationConfirmationHash;
  const required = driftClassification
    ? driftClassification.kind === SEMANTIC_RECONFIRMATION_REQUIRED
    : Boolean(request.required) || sourceChanged || implementationChanged;
  const allowedUserActions = stringList(request.allowedUserActions);
  return {
    required,
    reason:
      request.reasonCode ??
      request.reason ??
      (sourceChanged
        ? 'sourceDocumentHash_changed'
        : implementationChanged
          ? 'implementationConfirmationHash_changed'
          : null),
    reasonCode: request.reasonCode ?? null,
    userFacingTitle: request.userFacingTitle ?? null,
    userFacingSummary: request.userFacingSummary ?? null,
    persuasiveRationale: request.persuasiveRationale ?? null,
    evidenceBundle: request.evidenceBundle ?? null,
    driftClassification: driftClassification ?? null,
    bookkeepingRepairRequired: driftClassification?.kind === STALE_BOOKKEEPING_REPAIR_REQUIRED,
    projectionRefreshRequired: driftClassification?.kind === PROJECTION_REFRESH_REQUIRED,
    sourceChanged,
    implementationChanged,
    previousSourceDocumentHash,
    currentSourceDocumentHash,
    previousImplementationConfirmationHash,
    currentImplementationConfirmationHash,
    diffSummary: asArray(request.diffSummary),
    affectedRequirementIds: stringList(request.affectedRequirementIds),
    affectedTraceRows: stringList(request.affectedTraceRows),
    impactedIds: unique([...stringList(request.impactedIds), ...stringList(request.affectedRequirementIds)]),
    impactedTraceRows: unique([...stringList(request.impactedTraceRows), ...stringList(request.affectedTraceRows)]),
    impactedArtifacts: stringList(request.impactedArtifacts),
    impactedGatesOrCommands: stringList(request.impactedGatesOrCommands),
    allowedUserActions,
  };
}

function buildCoverage(input) {
  const {
    confirmation,
    traceRows,
    sequenceViews,
    flowViews,
    edgeCaseViews,
    boundaryViews,
    artifactPlan,
    targetModificationPaths,
    mermaidBlocks,
    reconfirmationState,
  } = input;
  const idSet = makeIdSet(confirmation);
  const knownIds = allKnownIds(idSet);
  const acceptanceRows = normalizeAcceptanceSuites(confirmation);
  const targetModificationPathCoverageAudit = evaluateTargetModificationPathCoverage(
    confirmation,
    targetModificationPaths,
    artifactPlan
  );
  const aiTddContractManifestCoverage = buildAiTddContractManifestCoverage({
    confirmation,
    traceRows,
    views: { sequenceViews, flowViews, edgeCaseViews, boundaryViews },
    artifactPlan,
    targetModificationPaths,
    acceptanceRows,
    targetModificationPathCoverage: targetModificationPathCoverageAudit,
  });
  const artifactIds = new Set(artifactPlan.map((item) => item.artifactId).filter(Boolean));
  const acceptanceIds = new Set(acceptanceRows.map((item) => item.id));
  const requiredCommandIds = new Set([
    ...asArray(confirmation.requiredCommands).map((item) => item?.id ?? item?.commandId).filter(Boolean),
    ...asArray(confirmation.suggestedCommands).map((item) => item?.id ?? item?.commandId).filter(Boolean),
  ]);
  const blockingIssues = [];
  const warnings = [];
  blockingIssues.push(...aiTddContractManifestCoverage.blockingIssues);

  function validateRefs(refs, validSet, code, owner) {
    for (const ref of refs) {
      if (!validSet.has(ref)) blockingIssues.push(blocking(code, `${owner} references unknown ID ${ref}`, [owner, ref]));
    }
  }

  const requiredArrays = [
    ['must', confirmation.must],
    ['notDone', confirmation.notDone],
    ['mustNot', confirmation.mustNot],
    ['evidence', confirmation.evidence],
    ['failurePaths', confirmation.failurePaths],
    ['edgeCases', confirmation.edgeCases],
  ];
  for (const [field, value] of requiredArrays) {
    if (!Array.isArray(value) || !value.length) {
      blockingIssues.push(blocking(`missing_${field}`, `implementationConfirmation.${field}[] is required`, [
        `implementationConfirmation.${field}`,
      ]));
    }
  }

  const isManagedReconfirmationStatus =
    confirmation.status === 'reconfirm_required' || confirmation.status === 'reconfirmation_required';
  const hasManagedReconfirmationRequest =
    reconfirmationState?.required === true &&
    isManagedReconfirmationStatus &&
    confirmation.reconfirmationRequest &&
    confirmation.reconfirmationRequest.required === true;

  if (reconfirmationState?.sourceChanged && !hasManagedReconfirmationRequest) {
    blockingIssues.push(
      blocking(
        'sourceDocumentHash_changed',
        'Current sourceDocumentHash differs from the last confirmed source hash; user reconfirmation is required.',
        ['implementationConfirmation.sourceDocumentHash']
      )
    );
  }
  if (reconfirmationState?.implementationChanged && !hasManagedReconfirmationRequest) {
    blockingIssues.push(
      blocking(
        'implementationConfirmationHash_changed',
        'Current implementationConfirmationHash differs from the last confirmed confirmation hash; user reconfirmation is required.',
        ['implementationConfirmation']
      )
    );
  }
  if (reconfirmationState?.required) {
    if (!isManagedReconfirmationStatus && confirmation.status !== 'draft') {
      blockingIssues.push(
        blocking(
          'reconfirmation_status_not_set',
          'Hash drift requires status draft, reconfirm_required, or reconfirmation_required before a new user confirmation can be recorded.',
          ['implementationConfirmation.status']
        )
      );
    }
    if (!confirmation.reconfirmationRequest || confirmation.reconfirmationRequest.required !== true) {
      blockingIssues.push(
        blocking(
          'reconfirmation_request_missing',
          'Hash drift must create a reconfirmationRequest; users must not manually edit hashes or confirmation state.',
          ['implementationConfirmation.reconfirmationRequest']
        )
      );
    }
    if (!asArray(reconfirmationState.diffSummary).length) {
      blockingIssues.push(
        blocking(
          'reconfirmation_missing_diff_summary',
          'reconfirmationRequest.diffSummary[] is required when reconfirmation is required.',
          ['implementationConfirmation.reconfirmationRequest.diffSummary']
        )
      );
    }
  }

  blockingIssues.push(...validateApplicabilityDomains(confirmation));

  for (const item of asArray(confirmation.must)) {
    validateRefs(stringList(item.evidenceRefs), idSet.evidence, 'must_unknown_evidence_ref', item.id);
    if (!findRowsCovering(traceRows, item.id).length) {
      blockingIssues.push(blocking('must_missing_trace_coverage', `${item.id} has no traceRows coverage`, [item.id]));
    }
    if (![...findViewsCovering(sequenceViews, item.id), ...findViewsCovering(flowViews, item.id)].length) {
      blockingIssues.push(blocking('must_missing_happy_or_flow_view', `${item.id} has no happy/state/flow view`, [item.id]));
    }
    if (!findAcceptanceCovering(acceptanceRows, item.id).length) {
      blockingIssues.push(blocking('must_missing_acceptance_or_e2e_coverage', `${item.id} has no ACC/E2E coverage`, [item.id]));
    }
  }

  for (const item of asArray(confirmation.notDone)) {
    validateRefs(stringList(item.evidenceRefs), idSet.evidence, 'neg_unknown_evidence_ref', item.id);
    if (!findRowsCovering(traceRows, item.id).length) {
      blockingIssues.push(blocking('neg_missing_trace_coverage', `${item.id} has no traceRows coverage`, [item.id]));
    }
    if (![...findViewsCovering(sequenceViews, item.id), ...findViewsCovering(edgeCaseViews, item.id)].length) {
      blockingIssues.push(blocking('neg_missing_failure_or_edge_view', `${item.id} has no failure/edge view`, [item.id]));
    }
    if (!findAcceptanceCovering(acceptanceRows, item.id).length) {
      blockingIssues.push(blocking('neg_missing_acceptance_or_e2e_coverage', `${item.id} has no ACC/E2E coverage`, [item.id]));
    }
  }

  for (const item of asArray(confirmation.mustNot)) {
    if (!findViewsCovering(boundaryViews, item.id).length) {
      blockingIssues.push(blocking('out_missing_boundary_view', `${item.id} has no boundary view`, [item.id]));
    }
  }

  for (const item of asArray(confirmation.failurePaths)) {
    const failureId = item.id ?? 'FAIL-UNKNOWN';
    if (!String(item.trigger ?? '').trim()) {
      blockingIssues.push(blocking('failure_path_missing_trigger', `${failureId} missing trigger`, [failureId]));
    }
    if (!String(item.expectedBehavior ?? '').trim()) {
      blockingIssues.push(blocking('failure_path_missing_expected_behavior', `${failureId} missing expectedBehavior`, [
        failureId,
      ]));
    }
    validateRefs(stringList(item.linkedNegIds), idSet.notDone, 'failure_path_unknown_neg_ref', failureId);
    validateRefs(stringList(item.linkedEvidenceIds), idSet.evidence, 'failure_path_unknown_evidence_ref', failureId);
  }

  for (const item of asArray(confirmation.edgeCases)) {
    const edgeId = item.id ?? 'EDGE-UNKNOWN';
    if (!String(item.condition ?? item.expectedBehavior ?? '').trim()) {
      blockingIssues.push(blocking('edge_case_missing_condition', `${edgeId} missing condition`, [edgeId]));
    }
    if (!String(item.expectedBehavior ?? '').trim()) {
      blockingIssues.push(blocking('edge_case_missing_expected_behavior', `${edgeId} missing expectedBehavior`, [edgeId]));
    }
    validateRefs(stringList(item.linkedFailurePathIds), idSet.failurePaths, 'edge_case_unknown_failure_path_ref', edgeId);
    validateRefs(stringList(item.linkedEvidenceIds), idSet.evidence, 'edge_case_unknown_evidence_ref', edgeId);
  }

  for (const question of asArray(confirmation.openQuestions)) {
    if (question.blocksImplementation === true) {
      blockingIssues.push(blocking('blocking_open_question', `${question.id} blocks implementation`, [question.id]));
    }
  }

  for (const row of traceRows) {
    const rowId = row.id ?? 'TRACE-UNKNOWN';
    validateRefs(stringList(row.covers), new Set([...idSet.must, ...idSet.notDone, ...idSet.mustNot]), 'trace_unknown_cover_ref', rowId);
    validateRefs(stringList(row.evidenceRefs), idSet.evidence, 'trace_unknown_evidence_ref', rowId);
    validateRefs(stringList(row.acceptanceRefs), acceptanceIds, 'trace_unknown_acceptance_ref', rowId);
    if (!stringList(row.covers).length && !isBoundaryOnlyTrace(row, boundaryViews)) {
      blockingIssues.push(blocking('trace_missing_covers', `${rowId} has no covers`, [rowId]));
    }
    if (!stringList(row.evidenceRefs).length) {
      blockingIssues.push(blocking('trace_missing_evidence', `${rowId} has no evidenceRefs`, [rowId]));
    }
    if (!stringList(row.taskRefs).length) blockingIssues.push(blocking('trace_task_unbound', `${rowId} has no taskRefs`, [rowId]));
    if (!traceContractValidationCommandRefs(row).length) {
      blockingIssues.push(blocking('trace_missing_contract_validation_command', `${rowId} has no contract validation command refs`, [rowId]));
    }
    if (hasOwn(row, 'commandRefs') && !hasOwn(row, 'contractValidationCommandRefs') && !hasOwn(row, 'deliveryEvidenceCommandRefs')) {
      blockingIssues.push(
        blocking(
          'trace_legacy_command_refs_only',
          `${rowId} uses only legacy commandRefs[]; use contractValidationCommandRefs[] and deliveryEvidenceCommandRefs[]`,
          [rowId]
        )
      );
    }
    if (!stringList(row.sequenceViewRefs ?? row.diagramRefs).length) {
      blockingIssues.push(blocking('trace_missing_diagram', `${rowId} has no diagram refs`, [rowId]));
    }
    if (String(row.status ?? '').toUpperCase() !== 'PENDING' && !stringList(row.evidenceRefs).length) {
      blockingIssues.push(blocking('trace_non_pending_without_evidence', `${rowId} is non-PENDING without evidence`, [rowId]));
    }
    if (hasStatusWithoutUserApproval(row.status) && row.userApproved !== true) {
      blockingIssues.push(blocking('trace_bare_deferred_or_out_of_scope', `${rowId} uses bare ${row.status}`, [rowId]));
    }
  }

  for (const block of mermaidBlocks) {
    for (const unbound of block.unboundLines) {
      blockingIssues.push(
        blocking(
          'diagram_unbound_semantics',
          `${block.id} line ${unbound.line}: ${unbound.reason}`,
          [block.id]
        )
      );
    }
    for (const id of block.ids) {
      if (!knownIds.has(id)) {
        blockingIssues.push(blocking('diagram_unknown_id', `${block.id} references unknown ID ${id}`, [block.id, id]));
      }
    }
  }

  if (!traceRows.length) blockingIssues.push(blocking('missing_trace_rows', 'traceRows[] is required'));
  if (!sequenceViews.length) blockingIssues.push(blocking('missing_sequence_views', 'sequenceViews[] is required'));
  if (!flowViews.length) blockingIssues.push(blocking('missing_flow_views', 'flowViews[] is required'));
  if (!edgeCaseViews.length) blockingIssues.push(blocking('missing_edge_case_views', 'edgeCaseViews[] is required'));
  if (!boundaryViews.length) blockingIssues.push(blocking('missing_boundary_views', 'boundaryViews[] is required'));
  blockingIssues.push(...collectReconfirmationEvidenceIssues(reconfirmationState, knownIds));
  const requirementBoundary = inferRequirementBoundary(
    confirmation,
    { sequenceViews, flowViews, edgeCaseViews, boundaryViews },
    mermaidBlocks
  );
  if (requirementBoundary.business.requirementIds.length && !requirementBoundary.business.viewRefs.length) {
    blockingIssues.push(
      blocking(
        'business_boundary_missing_views',
        'Business requirements exist but no business-scoped view is available in requirementBoundary or view metadata.',
        requirementBoundary.business.requirementIds
      )
    );
  }

  for (const row of acceptanceRows) {
    const rowId = row.id || 'ACC-UNKNOWN';
    if (!/^(ACC|E2E)-/u.test(rowId)) {
      blockingIssues.push(blocking('acceptance_invalid_id', `${rowId} must start with ACC- or E2E-`, [rowId]));
    }
    if (!row.files.length) {
      blockingIssues.push(blocking('acceptance_missing_file', `${rowId} must declare file/files`, [rowId]));
    }
    for (const file of row.files) {
      if (!file) continue;
      const absolute = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
      if (!fs.existsSync(absolute)) {
        blockingIssues.push(blocking('acceptance_test_file_missing', `${rowId} references missing file ${file}`, [rowId, file]));
      }
    }
    validateRefs(row.covers, new Set([...idSet.must, ...idSet.notDone]), 'acceptance_unknown_requirement_ref', rowId);
    validateRefs(row.traceRows, idSet.traceRows, 'acceptance_unknown_trace_ref', rowId);
    validateRefs(row.evidenceRefs, idSet.evidence, 'acceptance_unknown_evidence_ref', rowId);
    validateRefs(row.commandRefs, requiredCommandIds, 'acceptance_unknown_command_ref', rowId);
    if (!row.covers.length) blockingIssues.push(blocking('acceptance_missing_covers', `${rowId} has no covers[]`, [rowId]));
    if (!row.traceRows.length) blockingIssues.push(blocking('acceptance_missing_trace_rows', `${rowId} has no traceRows[]`, [rowId]));
    if (!row.evidenceRefs.length) blockingIssues.push(blocking('acceptance_missing_evidence_refs', `${rowId} has no evidenceRefs[]`, [rowId]));
    if (!row.commandRefs.length) blockingIssues.push(blocking('acceptance_missing_command_refs', `${rowId} has no commandRefs[]`, [rowId]));
    if (!row.oracle) blockingIssues.push(blocking('acceptance_missing_oracle', `${rowId} has no oracle`, [rowId]));
    if (row.mockOnly) blockingIssues.push(blocking('acceptance_mock_only_invalid', `${rowId} is mock-only`, [rowId]));
    if (/^(exit code|stdout|http 200|page render|mock calls?)$/iu.test(row.oracle)) {
      blockingIssues.push(blocking('acceptance_oracle_smoke_only', `${rowId} uses smoke-only oracle`, [rowId]));
    }
  }
  if (requirementBoundary.business.requirementIds.length && !requirementBoundary.business.diagramRefs.length) {
    blockingIssues.push(
      blocking(
        'business_boundary_missing_diagrams',
        'Business requirements exist but no business Mermaid diagram is available; governance diagrams cannot substitute for consumer project behavior.',
        requirementBoundary.business.requirementIds
      )
    );
  }
  if (requirementBoundary.governance.requirementIds.length && !requirementBoundary.governance.viewRefs.length) {
    blockingIssues.push(
      blocking(
        'governance_boundary_missing_views',
        'Governance requirements exist but no governance-scoped boundary view is available.',
        requirementBoundary.governance.requirementIds
      )
    );
  }
  if (requirementBoundary.governance.requirementIds.length && !requirementBoundary.governance.diagramRefs.length) {
    blockingIssues.push(
      blocking(
        'governance_boundary_missing_diagrams',
        'Governance requirements exist but no governance Mermaid diagram is available; business diagrams cannot substitute for control boundaries.',
        requirementBoundary.governance.requirementIds
      )
    );
  }
  if (!artifactPlan.length) {
    blockingIssues.push(blocking('missing_artifact_automation_plan', 'artifactAutomationPlan[] is required'));
  }
  blockingIssues.push(
    ...validateTargetModificationPaths(
      confirmation,
      targetModificationPaths,
      artifactPlan,
      idSet,
      targetModificationPathCoverageAudit
    )
  );

  const requiredArtifactFields = [
    'artifactId',
    'path',
    'artifactType',
    'sourceOfTruthRole',
    'ownerModel',
    'producer',
    'consumer',
    'canAffectControlFlow',
    'userApprovalRequired',
    'retention',
    'cleanupPolicy',
    'orphanRisk',
    'containsSensitiveData',
    'trainingDataEligible',
  ];
  artifactPlan.forEach((item) => {
    for (const field of requiredArtifactFields) {
      if (item[field] === '' || item[field] === undefined || item[field] === null) {
        blockingIssues.push(
          blocking('artifact_plan_missing_required_field', `${item.artifactId} missing ${field}`, [
            item.artifactId,
            field,
          ])
        );
      }
    }
    if (item.canAffectControlFlow === true && item.sourceOfTruthRole !== 'control') {
      warnings.push(
        warning('control_affecting_artifact_not_control_role', `${item.artifactId} affects control flow`, [
          item.artifactId,
        ])
      );
    }
    if (item.canAffectControlFlow === true || item.sourceOfTruthRole === 'control') {
      warnings.push(warning('control_artifact_highlighted', `${item.artifactId} is control-sensitive`, [item.artifactId]));
    }
    if (item.userApprovalRequired) warnings.push(warning('user_approval_required_artifact', item.artifactId, [item.artifactId]));
    if (item.orphanRisk === 'high') warnings.push(warning('high_orphan_risk', item.artifactId, [item.artifactId]));
    if (item.trainingDataEligible) warnings.push(warning('training_data_eligible', item.artifactId, [item.artifactId]));
    if (item.containsSensitiveData) warnings.push(warning('sensitive_data_artifact', item.artifactId, [item.artifactId]));
    if (item.retention === 'long_lived') warnings.push(warning('long_lived_artifact', item.artifactId, [item.artifactId]));
  });

  const longItems = [
    ...asArray(confirmation.must),
    ...asArray(confirmation.notDone),
    ...asArray(confirmation.mustNot),
    ...asArray(confirmation.evidence),
  ].filter((item) => String(item.text ?? '').length > 240);
  if (longItems.length) warnings.push(warning('long_item_text', `${longItems.length} long confirmation items`));
  if (artifactPlan.length > 20) warnings.push(warning('too_many_artifacts', `${artifactPlan.length} artifact plan items`));
  const scriptCount = artifactPlan.filter((item) => /script/iu.test(item.artifactType) || /scripts?[\\/]/iu.test(item.path)).length;
  if (scriptCount > 10) warnings.push(warning('too_many_scripts', `${scriptCount} script items`));
  if (!asArray(confirmation.suggestedCommands).length) {
    warnings.push(warning('missing_suggested_commands', 'suggestedCommands[] is missing'));
  }
  if (!asArray(confirmation.architectureImpacts).length) {
    warnings.push(warning('architecture_impact_unknown', 'architectureImpacts[] is missing'));
  }

  return {
    idSet,
    knownIds,
    blockingIssues,
    warnings,
    diagramCoverage: Object.fromEntries(
      [...idSet.must, ...idSet.notDone, ...idSet.mustNot, ...idSet.evidence].map((id) => [
        id,
        {
          sequenceViews: findViewsCovering(sequenceViews, id),
          flowViews: findViewsCovering(flowViews, id),
          edgeCaseViews: findViewsCovering(edgeCaseViews, id),
          boundaryViews: findViewsCovering(boundaryViews, id),
          mermaidBlocks: mermaidBlocks.filter((block) => block.ids.includes(id)).map((block) => block.id),
        },
      ])
    ),
    traceCoverage: Object.fromEntries(
      [...idSet.must, ...idSet.notDone, ...idSet.mustNot].map((id) => [id, findRowsCovering(traceRows, id)])
    ),
    artifactAutomationCoverage: Object.fromEntries(
      [...idSet.must, ...idSet.notDone, ...idSet.mustNot, ...idSet.evidence].map((id) => [
        id,
        findArtifactRefs(artifactPlan, id),
      ])
    ),
    targetModificationPathCoverage: {
      rows: targetModificationPaths,
      byRequirement: Object.fromEntries(
        [...idSet.must, ...idSet.notDone, ...idSet.mustNot].map((id) => [
          id,
          targetModificationPaths.filter((row) => row.requirementRefs.includes(id)).map((row) => row.id),
        ])
      ),
      byTrace: Object.fromEntries(
        [...idSet.traceRows].map((id) => [
          id,
          targetModificationPaths.filter((row) => row.traceRefs.includes(id)).map((row) => row.id),
        ])
      ),
      missingArtifactRefs: unique(
        targetModificationPaths.flatMap((row) => row.artifactRefs).filter((ref) => !artifactIds.has(ref))
      ),
      requiredCoverage: targetModificationPathCoverageAudit.required,
      missingCoverage: targetModificationPathCoverageAudit.missing,
      unclassifiedCoverage: targetModificationPathCoverageAudit.unclassified,
      ready: targetModificationPathCoverageAudit.ready,
      counts: {
        total: targetModificationPaths.length,
        explicit: targetModificationPaths.filter((row) => row.sourceSection !== 'artifactAutomationPlan.derived').length,
        derived: targetModificationPaths.filter((row) => row.sourceSection === 'artifactAutomationPlan.derived').length,
        requiredCoverage: targetModificationPathCoverageAudit.counts.required,
        missingCoverage: targetModificationPathCoverageAudit.counts.missing,
        unclassifiedCoverage: targetModificationPathCoverageAudit.counts.unclassified,
      },
    },
    aiTddContractManifestCoverage,
    acceptanceCoverage: {
      rows: acceptanceRows,
      byRequirement: Object.fromEntries(
        [...idSet.must, ...idSet.notDone].map((id) => [id, findAcceptanceCovering(acceptanceRows, id)])
      ),
      counts: {
        acceptanceTests: acceptanceRows.filter((row) => row.sourceSection !== 'e2eSuites' && row.sourceSection !== 'e2eTests').length,
        e2eSuites: acceptanceRows.filter((row) => row.sourceSection === 'e2eSuites' || row.sourceSection === 'e2eTests').length,
        total: acceptanceRows.length,
      },
    },
  };
}

function normalizeViews(confirmation) {
  const sequenceViews = asArray(confirmation.sequenceViews);
  const flowViews = asArray(confirmation.flowViews);
  const edgeCaseViews = asArray(confirmation.edgeCaseViews);
  const boundaryViews = asArray(confirmation.boundaryViews);
  return { sequenceViews, flowViews, edgeCaseViews, boundaryViews };
}

function buildEmptyCurrentTargetMap() {
  return {
    schemaVersion: '',
    displayProfile: '',
    sourceReferences: [],
    metrics: [],
    currentSummary: [],
    targetSummary: [],
    diffRows: [],
    targetFlow: [],
    mentalModels: [],
    mentalModelSequence: { lanes: [], legend: [] },
    doubleGates: { gates: [], envelopeRules: [] },
    canonicalArtifacts: [],
    pathRegistry: [],
    existingArtifacts: [],
    scriptConvergence: [],
    hookConvergence: [],
    noHookTargets: [],
    retainedScriptTypes: [],
    requirementGeneration: [],
    facts: [],
    process: [],
    artifactPaths: [],
    architecture: [],
    artifactIndexClarification: '',
    sampleRoutesClarification: '',
    noHookFallback: '',
    introduction: '',
    currentTitle: '',
    targetTitle: '',
    schemaIssues: [],
    tableCoverage: {},
  };
}

function collectReconfirmationEvidenceIssues(reconfirmationState, knownIds) {
  if (!reconfirmationState?.required) return [];
  const findings = [];
  const issueFor = (code, message, refs = []) => blocking(code, message, refs);
  if (!reconfirmationState.reasonCode) {
    findings.push(issueFor('reconfirmation_missing_reason_code', 'reconfirmationRequest.reasonCode is required'));
  }
  if (!String(reconfirmationState.userFacingSummary ?? '').trim()) {
    findings.push(issueFor('reconfirmation_missing_user_facing_summary', 'reconfirmationRequest.userFacingSummary is required'));
  }
  const rationale = reconfirmationState.persuasiveRationale ?? {};
  for (const field of ['whyReconfirmNow', 'riskIfSkipped', 'whyEvidenceIsSufficient']) {
    if (!String(rationale[field] ?? '').trim()) {
      findings.push(
        issueFor(
          `reconfirmation_missing_${field}`,
          `reconfirmationRequest.persuasiveRationale.${field} is required`
        )
      );
    }
  }
  const evidenceBundle = reconfirmationState.evidenceBundle ?? {};
  if (evidenceBundle.sufficiencyVerdict !== 'sufficient') {
    findings.push(
      issueFor(
        'reconfirmation_evidence_not_sufficient',
        'reconfirmationRequest.evidenceBundle.sufficiencyVerdict must be sufficient'
      )
    );
  }
  const items = asArray(evidenceBundle.items);
  if (!items.length) {
    findings.push(
      issueFor(
        'reconfirmation_missing_evidence_items',
        'reconfirmationRequest.evidenceBundle.items[] is required'
      )
    );
  }
  for (const item of items) {
    const refs = [...stringList(item?.sourceRefs), ...stringList(item?.proofRefs)];
    if (!refs.length) {
      findings.push(
        issueFor(
          'reconfirmation_evidence_item_missing_refs',
          `${item?.id ?? 'reconfirmation evidence item'} must include sourceRefs[] or proofRefs[]`
        )
      );
      continue;
    }
    for (const ref of refs) {
      if (!knownIds.has(ref) && !/^ART-|^CMD-/u.test(ref)) {
        findings.push(
          issueFor(
            'reconfirmation_evidence_item_unknown_ref',
            `${item?.id ?? 'reconfirmation evidence item'} references unknown ID ${ref}`,
            [ref]
          )
        );
      }
    }
  }
  if (!stringList(reconfirmationState.allowedUserActions).length) {
    findings.push(
      issueFor(
        'reconfirmation_missing_allowed_user_actions',
        'reconfirmationRequest.allowedUserActions[] is required'
      )
    );
  }
  return findings;
}

const CURRENT_TARGET_ARRAY_FIELDS = [
  'sourceReferences',
  'metrics',
  'currentSummary',
  'targetSummary',
  'diffRows',
  'targetFlow',
  'mentalModels',
  'canonicalArtifacts',
  'pathRegistry',
  'existingArtifacts',
  'scriptConvergence',
  'hookConvergence',
  'noHookTargets',
  'retainedScriptTypes',
  'requirementGeneration',
  'facts',
  'process',
  'artifactPaths',
  'architecture',
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valueForKeys(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key];
  }
  return '';
}

const CURRENT_TARGET_LEGACY_ROW_MAPPERS = {
  sourceReferences: (row) => ({ path: row[0], description: row[1], sourceOfTruthRole: row[2] }),
  metrics: (row) => ({ value: row[0], label: row[1], tone: row[2] }),
  currentSummary: (row) => ({ title: row[0], detail: row[1], tone: row[2] }),
  targetSummary: (row) => ({ title: row[0], detail: row[1], tone: row[2] }),
  diffRows: (row) => ({ dimension: row[0], currentState: row[1], targetState: row[2], action: row[3], tone: row[4] }),
  targetFlow: (row) => ({ stepTitle: row[0], description: row[1], output: row[2], ownerModel: row[3] }),
  mentalModels: (row) => ({ name: row[0], question: row[1], status: row[2] }),
  canonicalArtifacts: (row) => ({ targetPathOrField: row[0], functionDescription: row[1], controlPlaneRole: row[2] }),
  pathRegistry: (row) => ({ category: row[0], fixedPath: row[1], sourceOfTruthRole: row[2], description: row[3] }),
  existingArtifacts: (row) => ({ currentPath: row[0], currentFunction: row[1], targetTreatment: row[2], completionProofPolicy: row[3] }),
  scriptConvergence: (row) => ({
    scriptOrConfigPath: row[0],
    currentFunction: row[1],
    targetOwnerModel: row[2],
    targetWritesOrOutputs: row[3],
    completionAuthority: row[4],
  }),
  hookConvergence: (row) => ({
    layer: row[0],
    hostHookPaths: row[1],
    sharedCore: row[2],
    responsibility: row[3],
    targetBoundary: row[4],
    fallbackPolicy: row[5],
  }),
  noHookTargets: (row) => ({ title: row[0], detail: row[1] }),
  retainedScriptTypes: (row) => ({ category: row[0], representativePaths: row[1], targetTreatment: row[2], reason: row[3] }),
  requirementGeneration: (row) => ({ dimension: row[0], currentState: row[1], targetState: row[2] }),
  facts: (row) => ({ currentState: row[0], targetState: row[1] }),
  process: (row) => ({ phase: row[0], currentState: row[1], targetState: row[2] }),
  artifactPaths: (row) => ({ path: row[0], targetRole: row[1] }),
  architecture: (row) => ({ dimension: row[0], currentState: row[1], targetState: row[2] }),
};

function normalizeCurrentTargetRow(field, item, index, issues) {
  if (Array.isArray(item)) {
    issues.push(
      blocking('current_target_invalid_row_shape', `currentTargetMap.${field}[${index}] uses legacy array row; v1 requires object rows`, [
        `currentTargetMap.${field}[${index}]`,
      ])
    );
    return CURRENT_TARGET_LEGACY_ROW_MAPPERS[field]?.(item) ?? { value: item.join(' | ') };
  }
  if (!isPlainObject(item)) {
    issues.push(
      blocking('current_target_invalid_row_shape', `currentTargetMap.${field}[${index}] must be an object`, [
        `currentTargetMap.${field}[${index}]`,
      ])
    );
    return {};
  }
  const row = { ...item };
  if (field === 'sourceReferences') {
    row.path = valueForKeys(row, ['path', 'source', 'id']);
  }
  if (field === 'targetFlow') {
    row.stepTitle = valueForKeys(row, ['stepTitle', 'title', 'step']);
    row.description = valueForKeys(row, ['description', 'text']);
  }
  if (field === 'mentalModels') {
    row.name = valueForKeys(row, ['name', 'title']);
  }
  if (field === 'canonicalArtifacts') {
    row.targetPathOrField = valueForKeys(row, ['targetPathOrField', 'path', 'field']);
    row.functionDescription = valueForKeys(row, ['functionDescription', 'description']);
    row.controlPlaneRole = valueForKeys(row, ['controlPlaneRole', 'role']);
  }
  if (field === 'pathRegistry') {
    row.fixedPath = valueForKeys(row, ['fixedPath', 'path']);
  }
  if (field === 'existingArtifacts') {
    row.currentPath = valueForKeys(row, ['currentPath', 'path']);
  }
  if (field === 'scriptConvergence') {
    row.scriptOrConfigPath = valueForKeys(row, ['scriptOrConfigPath', 'path']);
    row.targetOwnerModel = valueForKeys(row, ['targetOwnerModel', 'ownerModel']);
    row.targetWritesOrOutputs = valueForKeys(row, ['targetWritesOrOutputs', 'outputs', 'output']);
  }
  if (field === 'hookConvergence') {
    row.hostHookPaths = valueForKeys(row, ['hostHookPaths', 'paths', 'hostPaths']);
  }
  if (field === 'noHookTargets') {
    row.title = valueForKeys(row, ['title', 'name']);
    row.detail = valueForKeys(row, ['detail', 'description', 'text']);
  }
  if (field === 'retainedScriptTypes') {
    row.representativePaths = valueForKeys(row, ['representativePaths', 'paths', 'path']);
  }
  if (field === 'artifactPaths') {
    row.path = valueForKeys(row, ['path', 'currentPath']);
  }
  return row;
}

function validateCurrentTargetRows(field, rows, issues) {
  const profile = CURRENT_TARGET_TABLE_PROFILES[field];
  if (!profile) return;
  rows.forEach((row, index) => {
    for (const fieldDef of profile.fields.filter((item) => item.required)) {
      if (row[fieldDef.key] === '' || row[fieldDef.key] === undefined || row[fieldDef.key] === null) {
        issues.push(
          blocking(
            'current_target_schema_missing_field',
            `currentTargetMap.${field}[${index}] missing required field ${fieldDef.key}`,
            [`currentTargetMap.${field}[${index}]`, fieldDef.key]
          )
        );
      }
    }
  });
}

function normalizeCurrentTargetTable(field, input, issues) {
  const rows = asArray(input[field]).map((item, index) => normalizeCurrentTargetRow(field, item, index, issues));
  validateCurrentTargetRows(field, rows, issues);
  return rows;
}

function normalizeDoubleGateRows(input, issues) {
  const gates = asArray(input.doubleGates?.gates).map((item, index) => {
    if (Array.isArray(item)) {
      issues.push(
        blocking('current_target_invalid_row_shape', `currentTargetMap.doubleGates.gates[${index}] uses legacy array row; v1 requires object rows`, [
          `currentTargetMap.doubleGates.gates[${index}]`,
        ])
      );
      return { gate: item[0], uniqueness: item[1], inputs: item[2], outputs: item[3] };
    }
    const row = isPlainObject(item) ? { ...item } : {};
    if (!isPlainObject(item)) {
      issues.push(
        blocking('current_target_invalid_row_shape', `currentTargetMap.doubleGates.gates[${index}] must be an object`, [
          `currentTargetMap.doubleGates.gates[${index}]`,
        ])
      );
    }
    row.gate = valueForKeys(row, ['gate', 'name']);
    return row;
  });
  const envelopeRules = asArray(input.doubleGates?.envelopeRules).map((item, index) => {
    if (Array.isArray(item)) {
      issues.push(
        blocking(
          'current_target_invalid_row_shape',
          `currentTargetMap.doubleGates.envelopeRules[${index}] uses legacy array row; v1 requires object rows`,
          [`currentTargetMap.doubleGates.envelopeRules[${index}]`]
        )
      );
      return { title: item[0], text: item[1] };
    }
    if (!isPlainObject(item)) {
      issues.push(
        blocking('current_target_invalid_row_shape', `currentTargetMap.doubleGates.envelopeRules[${index}] must be an object`, [
          `currentTargetMap.doubleGates.envelopeRules[${index}]`,
        ])
      );
      return {};
    }
    return { ...item };
  });
  validateCurrentTargetRows('doubleGateFields', gates, issues);
  validateCurrentTargetRows('envelopeRules', envelopeRules, issues);
  return { gates, envelopeRules };
}

function normalizeMentalModelSequence(input, issues) {
  const lanes = asArray(input.mentalModelSequence?.lanes).map((lane, index) => {
    if (!isPlainObject(lane)) {
      issues.push(
        blocking('current_target_invalid_row_shape', `currentTargetMap.mentalModelSequence.lanes[${index}] must be an object`, [
          `currentTargetMap.mentalModelSequence.lanes[${index}]`,
        ])
      );
      return { title: '', events: [] };
    }
    return {
      ...lane,
      title: valueForKeys(lane, ['title', 'name']),
      events: asArray(lane.events).map((event) => (isPlainObject(event) ? event : { title: String(event), meta: '' })),
    };
  });
  const legend = asArray(input.mentalModelSequence?.legend).map((item) => (isPlainObject(item) ? item : { text: String(item), tone: 'gold' }));
  return { lanes, legend };
}

function currentTargetTableCoverage(map) {
  const coverage = {};
  for (const [field, profile] of Object.entries(CURRENT_TARGET_TABLE_PROFILES)) {
    const rows =
      field === 'doubleGateFields'
        ? asArray(map.doubleGates?.gates)
        : field === 'envelopeRules'
          ? asArray(map.doubleGates?.envelopeRules)
          : asArray(map[field]);
    let missingFieldCount = 0;
    rows.forEach((row) => {
      for (const fieldDef of profile.fields.filter((item) => item.required)) {
        if (row[fieldDef.key] === '' || row[fieldDef.key] === undefined || row[fieldDef.key] === null) {
          missingFieldCount += 1;
        }
      }
    });
    coverage[field] = {
      rowCount: rows.length,
      missingFieldCount,
      requiredFields: profile.fields.filter((item) => item.required).map((item) => item.key),
    };
  }
  return coverage;
}

function normalizeCurrentTargetMap(map) {
  const base = buildEmptyCurrentTargetMap();
  const input = map && typeof map === 'object' ? map : {};
  const issues = [];
  base.schemaVersion = input.schemaVersion ?? '';
  base.displayProfile = input.displayProfile ?? '';
  if (Object.keys(input).length > 0 && base.schemaVersion !== CURRENT_TARGET_SCHEMA_VERSION) {
    issues.push(
      blocking(
        'current_target_schema_version_missing_or_invalid',
        `currentTargetMap.schemaVersion must be ${CURRENT_TARGET_SCHEMA_VERSION}`,
        ['currentTargetMap.schemaVersion']
      )
    );
  }
  if (Object.keys(input).length > 0 && base.displayProfile !== CURRENT_TARGET_DISPLAY_PROFILE) {
    issues.push(
      blocking(
        'current_target_display_profile_missing_or_invalid',
        `currentTargetMap.displayProfile must be ${CURRENT_TARGET_DISPLAY_PROFILE}`,
        ['currentTargetMap.displayProfile']
      )
    );
  }
  for (const field of CURRENT_TARGET_ARRAY_FIELDS) {
    base[field] = normalizeCurrentTargetTable(field, input, issues);
  }
  base.mentalModelSequence = normalizeMentalModelSequence(input, issues);
  base.doubleGates = normalizeDoubleGateRows(input, issues);
  base.artifactIndexClarification = input.artifactIndexClarification ?? '';
  base.sampleRoutesClarification = input.sampleRoutesClarification ?? '';
  base.noHookFallback = input.noHookFallback ?? '';
  base.introduction = input.introduction ?? '';
  base.currentTitle = input.currentTitle ?? '';
  base.targetTitle = input.targetTitle ?? '';
  base.schemaIssues = issues;
  base.tableCoverage = currentTargetTableCoverage(base);
  return base;
}

function emptyCurrentTargetTableCoverage() {
  return currentTargetTableCoverage(buildEmptyCurrentTargetMap());
}

function mergeCurrentTargetMaps(inlineMap, externalMap, options = {}) {
  if (options.enabled !== true) {
    const empty = buildEmptyCurrentTargetMap();
    empty.tableCoverage = currentTargetTableCoverage(empty);
    return empty;
  }
  const inlineNormalized = normalizeCurrentTargetMap(inlineMap);
  const externalNormalized = normalizeCurrentTargetMap(externalMap?.currentTargetMap ?? externalMap);
  const merged = buildEmptyCurrentTargetMap();
  merged.schemaVersion = externalNormalized.schemaVersion || inlineNormalized.schemaVersion;
  merged.displayProfile = externalNormalized.displayProfile || inlineNormalized.displayProfile;
  for (const field of CURRENT_TARGET_ARRAY_FIELDS) {
    merged[field] = [...inlineNormalized[field], ...externalNormalized[field]];
  }
  merged.mentalModelSequence = {
    lanes: [...inlineNormalized.mentalModelSequence.lanes, ...externalNormalized.mentalModelSequence.lanes],
    legend: [...inlineNormalized.mentalModelSequence.legend, ...externalNormalized.mentalModelSequence.legend],
  };
  merged.doubleGates = {
    gates: [...inlineNormalized.doubleGates.gates, ...externalNormalized.doubleGates.gates],
    envelopeRules: [...inlineNormalized.doubleGates.envelopeRules, ...externalNormalized.doubleGates.envelopeRules],
  };
  merged.artifactIndexClarification = externalNormalized.artifactIndexClarification || inlineNormalized.artifactIndexClarification;
  merged.sampleRoutesClarification = externalNormalized.sampleRoutesClarification || inlineNormalized.sampleRoutesClarification;
  merged.noHookFallback = externalNormalized.noHookFallback || inlineNormalized.noHookFallback;
  merged.introduction = externalNormalized.introduction || inlineNormalized.introduction;
  merged.currentTitle = externalNormalized.currentTitle || inlineNormalized.currentTitle;
  merged.targetTitle = externalNormalized.targetTitle || inlineNormalized.targetTitle;
  merged.schemaIssues = [...inlineNormalized.schemaIssues, ...externalNormalized.schemaIssues];
  merged.tableCoverage = currentTargetTableCoverage(merged);
  return merged;
}

function countCurrentTargetRows(map) {
  const normalized = normalizeCurrentTargetMap(map);
  return {
    currentSummary: normalized.currentSummary.length,
    targetSummary: normalized.targetSummary.length,
    requirementGeneration: normalized.requirementGeneration.length,
    facts: normalized.facts.length,
    process: normalized.process.length,
    artifactPaths: normalized.artifactPaths.length,
    architecture: normalized.architecture.length,
    sourceReferences: normalized.sourceReferences.length,
    schemaVersion: normalized.schemaVersion,
    displayProfile: normalized.displayProfile,
    schemaIssues: normalized.schemaIssues.length,
    diffRows: normalized.diffRows.length,
    mentalModels: normalized.mentalModels.length,
    mentalModelSequenceLanes: normalized.mentalModelSequence.lanes.length,
    doubleGates: normalized.doubleGates.gates.length,
    canonicalArtifacts: normalized.canonicalArtifacts.length,
    pathRegistry: normalized.pathRegistry.length,
    existingArtifacts: normalized.existingArtifacts.length,
    scriptConvergence: normalized.scriptConvergence.length,
    hookConvergence: normalized.hookConvergence.length,
  };
}

function emptyCurrentTargetCoverage() {
  return {
    currentSummary: 0,
    targetSummary: 0,
    requirementGeneration: 0,
    facts: 0,
    process: 0,
    artifactPaths: 0,
    architecture: 0,
    sourceReferences: 0,
    schemaVersion: '',
    displayProfile: '',
    schemaIssues: 0,
    diffRows: 0,
    mentalModels: 0,
    mentalModelSequenceLanes: 0,
    doubleGates: 0,
    canonicalArtifacts: 0,
    pathRegistry: 0,
    existingArtifacts: 0,
    scriptConvergence: 0,
    hookConvergence: 0,
  };
}

function hasCurrentTargetData(map) {
  if (!map) return false;
  const counts = countCurrentTargetRows(map);
  return Object.entries(counts).some(
    ([key, value]) => !['schemaIssues'].includes(key) && typeof value === 'number' && value > 0
  );
}

function currentTargetMapApplies(confirmation) {
  return applicabilityDomainApplies(confirmation, 'currentTargetMap');
}

function currentTargetRequiresCanonicalArtifacts(confirmation) {
  return [
    'governanceEvents',
    'runtimeRecovery',
    'scoringDashboardSft',
    'scriptsAndHooks',
  ].some((domain) => applicabilityDomainApplies(confirmation, domain));
}

function validateRequiredCurrentTargetMap(confirmation, profile, currentTargetMap) {
  const issues = [];
  if (!currentTargetMapApplies(confirmation)) return issues;

  if (!viewPackRequired(profile, CURRENT_TARGET_REQUIRED_VIEW_PACK) || !viewPackEnabled(profile, CURRENT_TARGET_REQUIRED_VIEW_PACK)) {
    issues.push(
      blocking(
        'current_target_required_view_pack_missing',
        'applicability.currentTargetMap.applies=true requires requiredViewPacks[] to include currentTargetMap before confirmation',
        ['applicability.currentTargetMap', 'requiredViewPacks']
      )
    );
  }

  if (currentTargetMap.schemaVersion !== CURRENT_TARGET_SCHEMA_VERSION) {
    issues.push(
      blocking(
        'current_target_required_schema_version_missing_or_invalid',
        `applicability.currentTargetMap.applies=true requires currentTargetMap.schemaVersion=${CURRENT_TARGET_SCHEMA_VERSION}`,
        ['currentTargetMap.schemaVersion']
      )
    );
  }
  if (currentTargetMap.displayProfile !== CURRENT_TARGET_DISPLAY_PROFILE) {
    issues.push(
      blocking(
        'current_target_required_display_profile_missing_or_invalid',
        `applicability.currentTargetMap.applies=true requires currentTargetMap.displayProfile=${CURRENT_TARGET_DISPLAY_PROFILE}`,
        ['currentTargetMap.displayProfile']
      )
    );
  }

  const counts = countCurrentTargetRows(currentTargetMap);
  const requiredCoverage = { ...CURRENT_TARGET_MINIMUM_COVERAGE };
  if (currentTargetRequiresCanonicalArtifacts(confirmation)) requiredCoverage.canonicalArtifacts = 1;
  const missingCoverage = Object.entries(requiredCoverage)
    .filter(([field, minimum]) => Number(counts[field] ?? 0) < minimum)
    .map(([field, minimum]) => `${field}:${counts[field] ?? 0}/${minimum}`);
  if (missingCoverage.length > 0) {
    issues.push(
      blocking(
        'current_target_required_coverage_insufficient',
        `applicability.currentTargetMap.applies=true requires visible current/target comparison coverage (${missingCoverage.join(', ')})`,
        missingCoverage.map((item) => `currentTargetCoverage.${item}`)
      )
    );
  }

  return issues;
}

function validateConfirmationProfile(confirmation, profile, currentTargetMap) {
  const issues = [];
  for (const pack of profile.unknownViewPacks) {
    issues.push(blocking('unknown_view_pack', `Unknown confirmation view pack ${pack}`, [pack]));
  }
  issues.push(...validateRequiredCurrentTargetMap(confirmation, profile, currentTargetMap));
  if (viewPackEnabled(profile, 'currentTargetMap')) {
    if (!hasCurrentTargetData(currentTargetMap)) {
      issues.push(
        blocking(
          'required_view_pack_missing_data',
          'currentTargetMap view pack is enabled but no currentTargetMap data was provided',
          ['currentTargetMap']
        )
      );
    }
  }
  if (viewPackEnabled(profile, 'sixMentalModels')) {
    const mentalModels = asArray(currentTargetMap?.mentalModels);
    const lanes = asArray(currentTargetMap?.mentalModelSequence?.lanes);
    if (!mentalModels.length) {
      issues.push(
        blocking(
          'required_view_pack_missing_data',
          'sixMentalModels view pack is enabled but currentTargetMap.mentalModels[] is missing',
          ['currentTargetMap.mentalModels']
        )
      );
    }
    if (!lanes.length) {
      issues.push(
        blocking(
          'required_view_pack_missing_data',
          'sixMentalModels view pack is enabled but currentTargetMap.mentalModelSequence.lanes[] is missing',
          ['currentTargetMap.mentalModelSequence.lanes']
        )
      );
    }
  }
  if (viewPackEnabled(profile, 'doubleGates')) {
    const gates = asArray(currentTargetMap?.doubleGates?.gates);
    const envelopeRules = asArray(currentTargetMap?.doubleGates?.envelopeRules);
    if (!gates.length && !envelopeRules.length) {
      issues.push(
        blocking(
          'required_view_pack_missing_data',
          'doubleGates view pack is enabled but currentTargetMap.doubleGates data is missing',
          ['currentTargetMap.doubleGates']
        )
      );
    }
  }
  return issues;
}

function renderedSectionsForProfile(profile) {
  return [
    'fingerprint',
    'core-design',
    'progress-delta',
    'pre-confirmation-semantic-drilldown',
    'decision-summary',
    'confirm-instruction',
    'requirements',
    'requirement-boundary',
    'business-visuals',
    'governance-visuals',
    'resume-failure-cases',
    'trace-matrix',
    ...(viewPackEnabled(profile, 'currentTargetMap') ? ['current-target'] : []),
    'target-modification-paths',
    'artifact-plan',
    'controlled-ingest-writers',
    'architecture-impact',
    'entry-flow',
    'scoring-dashboard-sft',
    'closeout-preview',
    'blocking-issues',
    'warnings',
    'eight-questions',
  ];
}

function renderTable(headers, rows, options = {}) {
  function isTrustedHtmlCell(cell) {
    if (typeof cell !== 'string') return false;
    const trimmed = cell.trim();
    if (!trimmed.includes('<')) return false;
    return (
      /^<span class="(?:id-badge(?: mini)?|muted)">[\s\S]*<\/span>(?:\s*<span class="(?:id-badge(?: mini)?|muted)">[\s\S]*<\/span>)*$/u.test(
        trimmed
      ) || /^<span class="tag (?:red|green|blue|gold)">[\s\S]*<\/span>$/u.test(
        trimmed
      ) || /^<code>[\s\S]*<\/code>$/u.test(
        trimmed
      ) || /^<span class="artifact-row" data-artifact-group="[^"]*" data-new-artifact="(?:true|false)" data-control-artifact="(?:true|false)">[\s\S]*<\/span>$/u.test(
        trimmed
      ) || /^<p class="(?:ok|blocked|muted)">[\s\S]*<\/p>$/u.test(trimmed)
    );
  }

  const colgroup = asArray(options.widths).length
    ? `<colgroup>${options.widths.map((width) => `<col style="width:${attr(width)}" />`).join('')}</colgroup>`
    : '';
  return `<div class="table-wrap"><table data-sortable="true" class="${attr(options.className ?? '')}">${colgroup}<thead><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${isTrustedHtmlCell(cell) ? cell : escapeHtml(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody></table></div>`;
}

function renderIdBadges(values) {
  const ids = stringList(values);
  if (!ids.length) return '<span class="muted">无</span>';
  return ids.map((id) => `<span class="id-badge">${escapeHtml(id)}</span>`).join(' ');
}

function renderStatusBadge(label, tone = 'blue') {
  return `<span class="tag ${tone}">${escapeHtml(label)}</span>`;
}

function statusBadgeTone(value) {
  const text = String(value ?? '').toLowerCase();
  if (/accepted_success|current_pass|legal_transition|final_acceptance_ready|delivery_ready|pass|passed|true|closed/u.test(text)) {
    return 'green';
  }
  if (/blocked|false|missing|illegal|unproven|open_or_unaccepted|no_controlled|failed/u.test(text)) {
    return 'red';
  }
  if (/open_before_closeout|pending|diagnostic|source_projection_gap/u.test(text)) {
    return 'gold';
  }
  return 'blue';
}

function renderCompactIdBadges(values, limit = 8) {
  const ids = stringList(values);
  if (!ids.length) return '<span class="muted">无</span>';
  const visible = ids.slice(0, limit).map((id) => `<span class="id-badge mini">${escapeHtml(id)}</span>`);
  if (ids.length > limit) {
    visible.push(`<span class="id-more">+${ids.length - limit}</span>`);
  }
  return visible.join(' ');
}

function shortHash(value) {
  const text = String(value ?? '');
  if (text.length <= 22) return text;
  return `${text.slice(0, 18)}...${text.slice(-6)}`;
}

function clipText(value, maxLength = 86) {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function getUiText(language) {
  const zh = {
    pageTitle: '实例级需求确认页',
    navTitle: '确认页',
    fingerprint: '顶部确认指纹',
    coreDesign: '核心设计摘要',
    progressDelta: '历史进度与本次差异',
    progressLead: '本区优先回答重入确认时最关键的问题：哪些已经有历史证据，哪些是本次新增或变更，哪些证据因为 hash/current attempt 失效，下一步应从哪里继续。完整 MUST / Trace Matrix 保留在下方作为明细。',
    totalRequirementIds: '需求 / 证据 ID 总数',
    traceRowsLabel: 'Trace rows',
    newOrChangedIds: '本次新增 / 变更 ID',
    currentAttemptProofValid: '当前 attempt 有效证明',
    staleProofNeedsRecheck: '历史通过但需复验',
    missingCurrentEvidence: '缺当前证据',
    currentConfirmationChanges: '本次确认变化',
    currentEvidenceStatus: '当前证据状态',
    suggestedContinueStart: '建议继续起点',
    noPendingTrace: '无待执行 trace',
    affectedTrace: '受影响 Trace',
    affectedIds: '受影响 ID',
    noDiffSummary: '源文档未提供 diffSummary[]；本区按 affectedRequirementIds / affectedTraceRows 推导。',
    reviewFocus: '重点验收焦点',
    reviewFocusNote: '新增 / 变更只表示本次确认范围变化；PASS 仍必须由当前 hash 和当前 closeout attempt 的受控证据证明。',
    noReviewFocus: '当前没有额外重点验收 ID。',
    historicalEvidenceSummary: '历史证据摘要',
    staleTraceSummary: '历史通过但 hash/current attempt 已失效的 trace',
    affectedTraceCoveredIds: '受影响 trace 覆盖的历史 ID',
    overflowPrefix: '另有',
    overflowSuffix: '项',
    progressStatus: {
      noControlledRecord: '无受控记录',
      missingEvidence: '缺证据',
      currentProofValid: '当前证明有效',
      currentEvidenceRecorded: '当前证据已记录',
      staleProof: '历史证明已过期',
      newOrChanged: '新增 / 变更',
      affectedTrace: '受影响 Trace',
      reviewFocus: '重点验收',
      notEvaluated: '未评估',
    },
    decisionSummary: '用户决策摘要',
    confirmInstruction: '确认口令区',
    requirements: '需求内容区',
    requirementBoundary: '需求边界区',
    requirementBoundaryLead: '本区把消费项目的业务需求与治理/控制需求分开，用户应能清楚看到不同需求的边界、视图和图表来源。',
    consumerBusinessRequirements: '消费项目 / 业务需求',
    governanceControlRequirements: '治理 / 控制需求',
    viewBoundaryMap: '视图边界地图',
    businessVisuals: '业务需求可视化区',
    businessVisualsLead: '本区只展示消费项目自身的产品行为、数据流、上线行为、用户可见行为和验收路径；治理图不能替代业务图。',
    governanceVisuals: '治理 / 控制可视化区',
    governanceVisualsLead: '本区展示确认、证据、受控写入、门禁、准出、脚本、hooks、恢复和 closeout 等控制层机制。',
    businessDiagramSet: '业务图集合',
    governanceDiagramSet: '治理图集合',
    governanceBoundaryViews: '治理边界视图',
    businessMermaidVisual: '业务 Mermaid 图',
    mixedMermaidVisual: '业务 / 治理边界 Mermaid 图',
    governanceMermaidVisual: '治理 Mermaid 图',
    traceMatrix: 'Trace Matrix',
    currentTarget: '现状 vs 目标态',
    targetModificationPaths: '目标修改路径清单',
    artifactPlan: 'Artifact Plan',
    architectureImpact: 'Architecture Impact',
    entryFlow: 'EntryFlow',
    scoringDashboardSft: 'Scoring / Dashboard / SFT',
    closeoutPreview: 'Closeout Preview',
    blockingIssues: 'Blocking Issues',
    warnings: 'Warnings',
    eightQuestions: '8 个问题',
    showAll: '显示全部',
    showControl: '只看控制层产物',
    showNew: '只看本次新增文件',
    collapseNav: '收起侧栏',
    expandNav: '展开侧栏',
    copy: '复制',
    copied: '已复制',
    confirmPhrase: '确认以上范围进入下一阶段',
    htmlCannotConfirm: '必须回到 chat 确认。HTML 不能点击确认，也不会写 confirmationHistory。',
    sourcePath: '源文档路径',
    sourceType: '源文档类型',
    generatedAt: '生成时间',
    confirmationLanguage: '确认语言',
    currentStatus: '当前状态',
    confirmability: '是否允许确认',
    scopeConfirmability: '范围确认状态',
    deliveryReadiness: '交付准出状态',
    deliveryReady: 'delivery_ready=true',
    deliveryNotReady: 'delivery_ready=false',
    deliveryReadinessReason: '交付阻断原因',
    deliveryReadinessLead:
      '注意：confirmable 只表示需求范围可确认，不代表实现完成、可合并、可发布或可上线。交付准出必须依赖当前 attempt 的受控证据。',
    deliveryReadinessMissingRecord: '缺少受控记录',
    deliveryReadinessMissingCurrentEvidence: '存在缺失当前证据',
    deliveryReadinessStaleEvidence: '存在过期历史证据',
    deliveryReadinessTraceNotAllPass: 'traceRows 尚未全部 current_pass',
    coreSubtitle: '本页是针对当前源文档的实例级确认视图，展示已提供的范围、视图、traceRows、工件计划和确认预期。',
    diffCurrent: '当前',
    diffTarget: '目标',
    diffAction: '收敛动作',
    currentTargetIntro: '以下对比不是泛泛说明，而是把当前源文档所属入口映射到目标治理形态。',
    mermaidVisual: '可视化图表',
    mermaidSource: 'Mermaid 源码和 diagramHash',
    noMermaid: '没有找到 Mermaid 图块。',
    renderNote: '默认一次只显示一张真实 Mermaid 图，避免图表挤在一起；可用编号、上一张/下一张切换，必要时再展开全部。原始 Mermaid 源码只作为折叠审计材料保留。',
    diagramViewer: '图表查看器',
    previousDiagram: '上一张',
    nextDiagram: '下一张',
    expandDiagrams: '展开全部',
    singleDiagram: '单图查看',
    mermaidRuntimeMissing:
      'Mermaid runtime 未内联：本页无法生成 IDE 级原生 SVG。请安装 mermaid 或传入 --mermaid-bundle 后重新生成；不要把 fallback 当作确认图。',
    fallbackDiagram: 'Fallback 结构图（非确认图）',
    happyPath: 'Happy Path 时序图',
    failurePath: 'Failure / Negative Path 时序图',
    stateFlow: 'State / Flow View',
    edgeCase: 'Edge Case View',
    decisionQuestion: '问题',
    decisionAnswer: '答案',
    confirmWhatPrefix: '确认当前源文档提供的范围、证据、图表、traceRows、工件计划和下一阶段预期：',
    notConfirmWhat: '不会确认实现已完成，也不会把 HTML 视图本身当作流程状态变更。',
    yes: '是',
    no: '否',
    nextStageBlocked: '阻断项修复并重新生成 HTML 前，不能进入下一阶段',
    nextStageReadyFallback: '源文档未提供 nextStageAfterConfirmation',
    noBlockingIssuesDetected: '未发现阻断项。',
    noWarningsDetected: '未发现警告。',
    issueTableNone: '无',
    field: '字段',
    value: '值',
    notProvided: '未提供',
    unknown: '未知',
    trueText: '是',
    falseText: '否',
    entryFlowView: 'EntryFlow 视图',
    architectureImpactView: '架构影响视图',
    scoringDashboardSftView: '评分 / Dashboard / SFT 视图',
    closeoutReadinessPreview: 'Closeout 准出预览',
    artifactAutomationPlanView: '工件与自动化计划视图',
    cannotDriveCloseoutMissing: '源文档未提供 noReverseCloseoutReason。',
    eightAnswers: [
      ['我到底在确认什么？', '确认本需求记录的需求范围、证据、视图、工件计划，以及是否允许进入下一阶段。'],
      ['哪些是不做或不能算完成？', '查看 NEG 和 OUT 区。没有证据或没有用户明确批准变更时，不能声明完成。'],
      ['业务流程是否完整，包括失败路径？', '查看 happy path、failure path、state/flow、edge case 和 Mermaid 覆盖关系。'],
      ['每个需求未来怎么验收？', '查看 Evidence 和 Trace Matrix：其中列出 gate、oracle、命令和工件。'],
      ['AI 会生成或修改哪些文件、脚本、hooks、报告？', '先查看目标修改路径清单确认预计修改面，再查看工件与自动化计划视图了解证据、报告和生命周期。'],
      ['哪些产物会影响主流程，哪些只是证据？', '查看 sourceOfTruthRole 和 canAffectControlFlow 字段。'],
      ['当前做法和目标态差距在哪里？', '查看现状 vs 目标态对比区。'],
      ['确认后 agent 被允许进入什么阶段、不能做什么？', '下一阶段由源文档字段和阻断项决定；即使确认页生成成功，agent 仍不能实现未确认 ID，也不能在 HTML 中确认。'],
    ],
  };
  const en = {
    pageTitle: 'Instance Requirements Confirmation',
    navTitle: 'Confirmation',
    fingerprint: 'Confirmation Fingerprints',
    coreDesign: 'Core Design Summary',
    progressDelta: 'Progress And Delta',
    progressLead: 'This section answers the key re-entry questions first: what has historical evidence, what is newly added or changed, which evidence is stale because hashes/current attempt do not match, and where execution should continue. Full MUST and Trace Matrix details remain below.',
    totalRequirementIds: 'Requirement / evidence IDs',
    traceRowsLabel: 'Trace rows',
    newOrChangedIds: 'New / changed IDs',
    currentAttemptProofValid: 'Current-attempt proof valid',
    staleProofNeedsRecheck: 'Historical pass needs recheck',
    missingCurrentEvidence: 'Missing current evidence',
    currentConfirmationChanges: 'Current Confirmation Changes',
    currentEvidenceStatus: 'Current Evidence Status',
    suggestedContinueStart: 'Suggested Continue Start',
    noPendingTrace: 'No pending trace',
    affectedTrace: 'Affected Trace',
    affectedIds: 'Affected IDs',
    noDiffSummary: 'The source did not provide diffSummary[]; this section is derived from affectedRequirementIds / affectedTraceRows.',
    reviewFocus: 'Review Focus',
    reviewFocusNote: 'New / changed only means the confirmation scope changed. PASS still requires controlled evidence for the current hashes and current closeout attempt.',
    noReviewFocus: 'No extra review-focus IDs.',
    historicalEvidenceSummary: 'Historical Evidence Summary',
    staleTraceSummary: 'Trace rows with historical pass but stale hash/current attempt',
    affectedTraceCoveredIds: 'Historical IDs covered by affected trace rows',
    overflowPrefix: '+',
    overflowSuffix: 'more',
    progressStatus: {
      noControlledRecord: 'No Controlled Record',
      missingEvidence: 'Missing Evidence',
      currentProofValid: 'Current Proof Valid',
      currentEvidenceRecorded: 'Current Evidence Recorded',
      staleProof: 'Stale Proof',
      newOrChanged: 'New / Changed',
      affectedTrace: 'Affected Trace',
      reviewFocus: 'Review Focus',
      notEvaluated: 'Not Evaluated',
    },
    decisionSummary: 'User Decision Summary',
    confirmInstruction: 'Confirmation Phrase',
    requirements: 'Requirement Content',
    requirementBoundary: 'Requirement Boundary',
    requirementBoundaryLead: 'This section separates consumer/business requirements from governance/control requirements so the consuming project can see both boundaries clearly.',
    consumerBusinessRequirements: 'Consumer / Business Requirements',
    governanceControlRequirements: 'Governance / Control Requirements',
    viewBoundaryMap: 'View Scope Map',
    businessVisuals: 'Business Requirements Visuals',
    businessVisualsLead: 'These diagrams show the consuming project product behavior, data flow, launch behavior, user-visible behavior, and acceptance paths; governance diagrams cannot substitute for them.',
    governanceVisuals: 'Governance / Control Visuals',
    governanceVisualsLead: 'These diagrams show confirmation, evidence, controlled ingest, gates, closeout, scripts, hooks, recovery, and other control-plane mechanics.',
    businessDiagramSet: 'Business Diagram Set',
    governanceDiagramSet: 'Governance Diagram Set',
    governanceBoundaryViews: 'Governance Boundary Views',
    businessMermaidVisual: 'Business Mermaid Diagram',
    mixedMermaidVisual: 'Business / Governance Boundary Mermaid Diagram',
    governanceMermaidVisual: 'Governance Mermaid Diagram',
    traceMatrix: 'Trace Matrix',
    currentTarget: 'Current vs Target',
    targetModificationPaths: 'Target Modification Paths',
    artifactPlan: 'Artifact Plan',
    architectureImpact: 'Architecture Impact',
    entryFlow: 'EntryFlow',
    scoringDashboardSft: 'Scoring / Dashboard / SFT',
    closeoutPreview: 'Closeout Preview',
    blockingIssues: 'Blocking Issues',
    warnings: 'Warnings',
    eightQuestions: '8 Key Questions',
    showAll: 'Show All',
    showControl: 'Control Artifacts Only',
    showNew: 'New Files Only',
    collapseNav: 'Collapse Nav',
    expandNav: 'Expand Nav',
    copy: 'Copy',
    copied: 'Copied',
    confirmPhrase: 'Confirm the above scope and enter the next stage',
    htmlCannotConfirm: 'You must confirm back in chat. This HTML page cannot confirm requirements and never writes confirmationHistory.',
    sourcePath: 'Source Document Path',
    sourceType: 'Source Document Type',
    generatedAt: 'Generated At',
    confirmationLanguage: 'Confirmation Language',
    currentStatus: 'Current Status',
    confirmability: 'Confirmability',
    scopeConfirmability: 'Scope Confirmability',
    deliveryReadiness: 'Delivery Readiness',
    deliveryReady: 'delivery_ready=true',
    deliveryNotReady: 'delivery_ready=false',
    deliveryReadinessReason: 'Delivery Blocker',
    deliveryReadinessLead:
      'Important: confirmable only means the requirement scope can be confirmed. It does not mean implementation complete, merge ready, release ready, or launch ready. Delivery readiness requires controlled current-attempt evidence.',
    deliveryReadinessMissingRecord: 'Missing controlled record',
    deliveryReadinessMissingCurrentEvidence: 'Missing current evidence',
    deliveryReadinessStaleEvidence: 'Stale historical evidence exists',
    deliveryReadinessTraceNotAllPass: 'traceRows are not all current_pass',
    coreSubtitle:
      'This is an instance-level confirmation view for the current source document, showing the provided scope, views, traceRows, artifact plan, and next-stage expectations.',
    diffCurrent: 'Current',
    diffTarget: 'Target',
    diffAction: 'Convergence Action',
    currentTargetIntro: 'This comparison maps the current source entry flow to the target governance shape.',
    mermaidVisual: 'Rendered Diagram',
    mermaidSource: 'Mermaid source and diagramHash',
    noMermaid: 'No Mermaid blocks found.',
    renderNote: 'One real Mermaid diagram is shown at a time by default so diagrams do not crowd the page. Use numbers, previous/next, or expand all when needed. Source is retained only as collapsed audit material.',
    diagramViewer: 'Diagram Viewer',
    previousDiagram: 'Previous',
    nextDiagram: 'Next',
    expandDiagrams: 'Expand All',
    singleDiagram: 'Single View',
    mermaidRuntimeMissing:
      'Mermaid runtime is not embedded, so IDE-grade native SVG cannot be produced. Install mermaid or pass --mermaid-bundle and regenerate; do not treat fallback as the confirmation diagram.',
    fallbackDiagram: 'Fallback Structure (not confirmation-grade)',
    happyPath: 'Happy Path Sequence',
    failurePath: 'Failure / Negative Path Sequence',
    stateFlow: 'State / Flow View',
    edgeCase: 'Edge Case View',
    decisionQuestion: 'Question',
    decisionAnswer: 'Answer',
    confirmWhatPrefix: 'Confirm the provided scope, evidence, diagrams, traceRows, artifacts, and next-stage expectations for ',
    notConfirmWhat:
      'It does not confirm implementation completion, and the HTML view itself is not a workflow state transition.',
    yes: 'yes',
    no: 'no',
    nextStageBlocked: 'blocked until all blocking issues are fixed and HTML is regenerated',
    nextStageReadyFallback: 'source document did not provide nextStageAfterConfirmation',
    noBlockingIssuesDetected: 'No blocking issues detected.',
    noWarningsDetected: 'No warnings detected.',
    issueTableNone: 'none',
    field: 'field',
    value: 'value',
    notProvided: 'not provided',
    unknown: 'unknown',
    trueText: 'true',
    falseText: 'false',
    entryFlowView: 'EntryFlow View',
    architectureImpactView: 'Architecture Impact View',
    scoringDashboardSftView: 'Scoring / Dashboard / SFT View',
    closeoutReadinessPreview: 'Closeout Readiness Preview',
    artifactAutomationPlanView: 'Artifact & Automation Plan View',
    cannotDriveCloseoutMissing: 'source document did not provide noReverseCloseoutReason',
    eightAnswers: [
      ['What am I confirming?', 'You are confirming requirement scope, evidence, views, artifacts, and next-stage permission for this record.'],
      ['What is not done or cannot count as complete?', 'See NEG and OUT sections. They cannot be claimed complete without evidence or explicit user change approval.'],
      ['Is the business flow complete, including failures?', 'See happy path, failure path, state/flow, edge case, and Mermaid coverage sections.'],
      ['How will each requirement be accepted later?', 'See Evidence and Trace Matrix sections with gates, oracles, commands, and artifacts.'],
      ['What files, scripts, hooks, and reports will AI modify or generate?', 'Review Target Modification Paths first for planned code/config/test changes, then Artifact & Automation Plan for evidence, reports, and lifecycle.'],
      ['Which artifacts can affect the main flow?', 'See sourceOfTruthRole and canAffectControlFlow columns.'],
      ['Where is the current-vs-target gap?', 'See Current vs Target section.'],
      ['After confirmation, what may the agent do?', 'The next stage depends on source fields and blockers. The agent still cannot implement unconfirmed IDs or confirm inside HTML.'],
    ],
  };
  if (language === 'en-US') return en;
  if (language === 'bilingual') {
    return Object.fromEntries(
      Object.keys(zh).map((key) => {
        if (key === 'eightAnswers') {
          return [
            key,
            zh.eightAnswers.map((item, index) => [
              `${item[0]} / ${en.eightAnswers[index]?.[0] ?? ''}`,
              `${item[1]} / ${en.eightAnswers[index]?.[1] ?? ''}`,
            ]),
          ];
        }
        return [key, `${zh[key]} / ${en[key]}`];
      })
    );
  }
  return zh;
}

function parseSequenceEdges(source) {
  const participants = [];
  const edges = [];
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    const match = line.match(/^(.+?)\s*(->>|-->>|->|-->)\s*([^:]+):\s*(.+)$/u);
    if (!match) continue;
    const from = match[1].replace(/^(actor|participant)\s+/iu, '').trim();
    const to = match[3].trim();
    const label = match[4].trim();
    for (const name of [from, to]) {
      if (name && !participants.includes(name)) participants.push(name);
    }
    edges.push({ from, to, arrow: match[2], label });
  }
  return { participants, edges };
}

function classifyEventTone(label) {
  const text = String(label ?? '').toLowerCase();
  if (/block|fail|reject|missing|forbid|not |cannot|error|unsafe|mismatch|缺|阻断|失败|禁止|不能/u.test(text)) {
    return 'warn';
  }
  if (/pass|ok|confirm|ready|closed|persist|write|link|索引|确认|通过|关闭|写入/u.test(text)) {
    return 'pass';
  }
  return '';
}

function stripIdsFromLabel(label) {
  return String(label ?? '')
    .replace(/\[(?:MUST|NEG|OUT|EVD|TRACE|Q)-\d+\]/gu, '')
    .replace(ID_PATTERN, '')
    .replace(/\[\s*\]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function renderSequenceLanes(block) {
  const { participants, edges } = parseSequenceEdges(block.source);
  if (!edges.length) return null;
  const lanes = participants.slice(0, 6).map((name) => ({ name, events: [] }));
  const laneByName = new Map(lanes.map((lane) => [lane.name, lane]));
  edges.forEach((edge, index) => {
    const targetLane = laneByName.get(edge.to) ?? laneByName.get(edge.from) ?? lanes[index % lanes.length];
    targetLane.events.push({
      label: stripIdsFromLabel(edge.label) || `${edge.from} -> ${edge.to}`,
      meta: `${edge.from} ${edge.arrow} ${edge.to}`,
      ids: extractIds(edge.label),
      tone: classifyEventTone(edge.label),
    });
  });
  return `<div class="rendered-mermaid compact-sequence" role="img" aria-label="${attr(
    block.id
  )} rendered compact sequence diagram" data-density="compact-card-lanes"><div class="diagram-legend"><span class="legend-dot pass"></span>pass / confirm / write<span class="legend-dot warn"></span>blocked / fail / reject<span class="legend-dot"></span>context</div><div class="compact-lanes" style="--lane-count:${lanes.length}">${lanes
    .map(
      (lane, index) => `<div class="compact-lane">
        <h4>${escapeHtml(index + 1)} ${escapeHtml(lane.name)}</h4>
        ${lane.events
          .map(
            (event) => `<div class="compact-event ${event.tone}"><strong title="${attr(event.label)}">${escapeHtml(
              clipText(event.label)
            )}</strong><small>${escapeHtml(
              event.meta
            )}</small><div class="event-ids">${renderCompactIdBadges(event.ids)}</div></div>`
          )
          .join('')}
      </div>`
    )
    .join('')}</div></div>`;
}

function simplifyMermaidLine(line) {
  return line
    .replace(/^\s*(flowchart|graph|stateDiagram-v2|stateDiagram)\b.*$/iu, '')
    .replace(/^\s*\[\*\]\s*/u, 'Start ')
    .replace(/["[\]{}()]/gu, ' ')
    .replace(/\s*(-->|--|->|:)\s*/gu, ' -> ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function renderPipelineCards(block) {
  const items = block.source
    .split(/\r?\n/u)
    .map((line) => ({ text: simplifyMermaidLine(line), ids: extractIds(line), tone: classifyEventTone(line) }))
    .filter((item) => item.text)
    .filter((item) => !/^(participant|actor|sequenceDiagram|autonumber)$/iu.test(item.text));
  if (!items.length) return null;
  return `<div class="rendered-mermaid compact-flow" role="img" aria-label="${attr(
    block.id
  )} rendered compact flow diagram" data-density="compact-card-flow">${items
    .slice(0, 12)
    .map(
      (item, index) => `<div class="flow-step-card ${item.tone}">
        <span class="step-index">${index + 1}</span>
        <strong title="${attr(stripIdsFromLabel(item.text) || item.text)}">${escapeHtml(
          clipText(stripIdsFromLabel(item.text) || item.text)
        )}</strong>
        <div class="event-ids">${renderCompactIdBadges(item.ids)}</div>
      </div>`
    )
    .join('')}${items.length > 12 ? `<div class="flow-step-card muted-card"><strong>+${items.length - 12} more edges</strong><div class="event-ids"><span class="muted">open source for full audit</span></div></div>` : ''}</div>`;
}

function renderMermaidSvg(block) {
  if (/^\s*sequenceDiagram\b/iu.test(block.source)) return renderSequenceLanes(block) ?? renderPipelineCards(block);
  return renderPipelineCards(block);
}

function renderMermaidNativeBlock(block) {
  const renderSource = block.renderSource ?? block.source;
  const normalized = renderSource === block.source ? 'false' : 'true';
  return `<pre class="mermaid-source-native" data-mermaid-source data-mermaid-normalized="${attr(normalized)}">${escapeHtml(renderSource)}</pre>
    <div class="mermaid-native-render" data-mermaid-render data-diagram-id="${attr(block.id)}"></div>
    <p class="mermaid-runtime-error blocked" data-mermaid-error hidden></p>`;
}

function renderIssueList(title, issues, emptyText) {
  const groupedRows = Object.entries(
    issues.reduce((acc, issue) => {
      acc[issue.code] = acc[issue.code] ?? { count: 0, severity: issue.severity, refs: [] };
      acc[issue.code].count += 1;
      acc[issue.code].refs.push(...asArray(issue.refs));
      return acc;
    }, {})
  )
    .sort((a, b) => b[1].count - a[1].count)
    .map(([code, info]) => [String(info.count), code, info.severity, renderCompactIdBadges(unique(info.refs), 12)]);
  return `<section class="card" id="${attr(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">
    <h2>${escapeHtml(title)}</h2>
    ${
      issues.length
        ? `<div class="issue-summary"><h3>阻断项聚合</h3>${renderTable(
            ['数量', '类型', '严重级别', '涉及 ID'],
            groupedRows,
            { className: 'compact-map-table' }
          )}</div><details class="issue-details"><summary>展开逐项明细</summary><ul class="issue-list">${issues
            .map(
              (issue) =>
                `<li class="${issue.severity === 'blocking' ? 'blocking' : 'warning'}"><strong>${escapeHtml(
                  issue.code
                )}</strong>: ${escapeHtml(issue.message)} ${renderIdBadges(issue.refs)}</li>`
            )
            .join('')}</ul></details>`
        : `<p class="ok">${escapeHtml(emptyText)}</p>`
    }
  </section>`;
}

function renderMermaidBlocks(blocks, ui, mermaidRuntime, args) {
  if (!blocks.length) return `<p class="blocked">${escapeHtml(ui.noMermaid)}</p>`;
  const fallbackOpen = args.allowMermaidFallback === true ? ' open' : '';
  const tabs = blocks
    .map(
      (block, index) =>
        `<button type="button" class="diagram-tab ${index === 0 ? 'active' : ''}" data-diagram-index="${index}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(
          block.title ?? block.id
        )}</button>`
    )
    .join('');
  return `<div class="diagram-viewer" data-diagram-viewer data-diagram-mode="single" data-active-diagram="0" data-mermaid-runtime="${mermaidRuntime.available ? 'embedded' : 'missing'}">
    <div class="diagram-toolbar" aria-label="${attr(ui.diagramViewer)}">
      <div class="diagram-tabs">${tabs}</div>
      <div class="diagram-actions">
        <button type="button" data-diagram-prev>${escapeHtml(ui.previousDiagram)}</button>
        <button type="button" data-diagram-next>${escapeHtml(ui.nextDiagram)}</button>
        <button type="button" data-diagram-toggle>${escapeHtml(ui.expandDiagrams)}</button>
      </div>
    </div>
    ${
      mermaidRuntime.available
        ? `<p class="mermaid-runtime-status ok">Mermaid runtime embedded: ${escapeHtml(
            mermaidRuntime.hash
          )}</p>`
        : `<p class="mermaid-runtime-status blocked">${escapeHtml(ui.mermaidRuntimeMissing)}</p>`
    }
    <div class="diagram-grid">${blocks
    .map(
      (block, index) => `<article class="diagram-card ${index === 0 ? 'active' : ''}" data-diagram-card data-diagram-index="${index}">
        <div class="diagram-head">
          <div class="diagram-title"><strong>${escapeHtml(block.title ?? block.id)}</strong><span>${escapeHtml(shortHash(block.diagramHash))}</span></div>
          <div class="diagram-meta">${renderCompactIdBadges(block.ids, 10)}</div>
        </div>
        <div class="diagram-rendered" tabindex="0"><h4>${escapeHtml(
          block.sectionGroup === 'governance'
            ? ui.governanceMermaidVisual
            : block.sectionGroup === 'mixed'
              ? ui.mixedMermaidVisual
              : ui.businessMermaidVisual
        )}</h4>${renderMermaidNativeBlock(block)}<details class="fallback-diagram"${fallbackOpen}><summary>${escapeHtml(
          ui.fallbackDiagram
        )}</summary>${renderMermaidSvg(block) ?? `<p class="blocked">${escapeHtml(
          ui.noMermaid
        )}</p>`}</details></div>
        <details><summary>${escapeHtml(ui.mermaidSource)}</summary><pre>${escapeHtml(block.source)}</pre><code>${escapeHtml(
          block.diagramHash
        )}</code></details>
      </article>`
    )
    .join('')}</div></div>`;
}

function blockHasAnyPrefix(block, prefixes) {
  return block.ids.some((id) => prefixes.some((prefix) => id.startsWith(prefix)));
}

function blockIntersectsIds(block, ids) {
  return block.ids.some((id) => ids.has(id));
}

function uniqueBlocks(blocks) {
  const seen = new Set();
  return blocks.filter((block) => {
    if (seen.has(block.diagramHash)) return false;
    seen.add(block.diagramHash);
    return true;
  });
}

function selectDiagramBlocks(mermaidBlocks, views) {
  const sequenceViews = asArray(views.sequenceViews);
  const flowViews = asArray(views.flowViews);
  const edgeCaseViews = asArray(views.edgeCaseViews);
  const boundaryViews = asArray(views.boundaryViews);
  const allViews = [...sequenceViews, ...flowViews, ...edgeCaseViews, ...boundaryViews];
  const businessIds = new Set(
    allViews
      .filter((view) => inferViewScope(view, new Set(), new Set()) !== 'governance')
      .flatMap((view) => stringList(view.covers))
  );
  const governanceIds = new Set(
    allViews
      .filter((view) => inferViewScope(view, businessIds, new Set()) !== 'business')
      .flatMap((view) => stringList(view.covers))
  );
  const blockScope = (block) => inferMermaidBlockScope(block, businessIds, governanceIds);
  const happyIds = new Set(
    sequenceViews
      .filter((view) => !stringList(view.covers).some((id) => id.startsWith('NEG-') || id.startsWith('OUT-')))
      .flatMap((view) => stringList(view.covers))
  );
  const failureIds = new Set(
    sequenceViews
      .filter((view) => stringList(view.covers).some((id) => id.startsWith('NEG-') || id.startsWith('OUT-')))
      .flatMap((view) => stringList(view.covers))
  );
  const flowIds = new Set(flowViews.flatMap((view) => stringList(view.covers)));
  const edgeIds = new Set(edgeCaseViews.flatMap((view) => stringList(view.covers)));
  const businessBlock = (block) =>
    blockScope(block) === 'business' ||
    blockScope(block) === 'mixed' ||
    (block.sectionGroup !== 'governance' &&
      (block.viewKind === 'happy' || block.viewKind === 'failure' || block.viewKind === 'stateFlow' || block.viewKind === 'edge'));
  const governanceBlock = (block) =>
    blockScope(block) === 'governance' ||
    (block.sectionGroup === 'governance' && blockScope(block) !== 'business' && block.viewKind === 'boundary');
  const businessViewBlocks = mermaidBlocks.filter((block) => businessBlock(block));
  const governanceViewBlocks = mermaidBlocks.filter((block) => governanceBlock(block));
  return {
    all: mermaidBlocks.map((block) => ({ ...block, sectionGroup: blockScope(block) })),
    happy: uniqueBlocks(
      businessViewBlocks.filter(
        (block) =>
          (block.viewKind === 'happy' ||
            blockIntersectsIds(block, happyIds) ||
            (block.viewKind === 'source' &&
              blockHasAnyPrefix(block, ['MUST-', 'EVD-']) &&
              !blockHasAnyPrefix(block, ['NEG-', 'OUT-'])))
      )
    ),
    failure: uniqueBlocks(
      businessViewBlocks.filter(
        (block) =>
          (block.viewKind === 'failure' || blockIntersectsIds(block, failureIds) || blockHasAnyPrefix(block, ['NEG-', 'OUT-']))
      )
    ),
    stateFlow: uniqueBlocks(
      businessViewBlocks.filter(
        (block) =>
          (block.viewKind === 'stateFlow' ||
            blockIntersectsIds(block, flowIds) ||
            (block.viewKind === 'source' && /^\s*(stateDiagram|stateDiagram-v2|flowchart|graph)\b/iu.test(block.source)))
      )
    ),
    edge: uniqueBlocks(
      businessViewBlocks.filter(
        (block) =>
          (block.viewKind === 'edge' || blockIntersectsIds(block, edgeIds) || blockHasAnyPrefix(block, ['NEG-', 'OUT-']))
      )
    ),
    business: uniqueBlocks(businessViewBlocks).map((block) => ({ ...block, sectionGroup: blockScope(block) })),
    governance: uniqueBlocks(governanceViewBlocks).map((block) => ({ ...block, sectionGroup: blockScope(block) })),
  };
}

function renderRequirementSections(input) {
  const { confirmation, traceRows, views, artifactPlan, progressDelta, language } = input;
  const acceptanceRows = normalizeAcceptanceSuites(confirmation);
  const mustRows = asArray(confirmation.must).map((item) => [
    item.id,
    renderStatusBadge(statusForRequirementId(item.id, progressDelta).label, statusForRequirementId(item.id, progressDelta).tone),
    userFacingText(item, 'text', language),
    renderIdBadges(item.evidenceRefs),
    renderIdBadges(findRowsCovering(traceRows, item.id)),
    renderIdBadges(findAcceptanceCovering(acceptanceRows, item.id)),
    renderIdBadges(findViewsCovering(views.sequenceViews, item.id)),
    renderIdBadges(item.upstreamRequirementIds),
    item.riskLevel ?? 'unspecified',
  ]);
  const negRows = asArray(confirmation.notDone).map((item) => [
    item.id,
    renderStatusBadge(statusForRequirementId(item.id, progressDelta).label, statusForRequirementId(item.id, progressDelta).tone),
    userFacingText(item, 'text', language),
    renderIdBadges(item.evidenceRefs),
    renderIdBadges(findAcceptanceCovering(acceptanceRows, item.id)),
    userFacingText(item, 'whyItBlocksCompletion', language) ?? 'completion is blocked until proven',
    String(item.negativeAssertionRequired ?? true),
    renderIdBadges([...findViewsCovering(views.sequenceViews, item.id), ...findViewsCovering(views.edgeCaseViews, item.id)]),
  ]);
  const outRows = asArray(confirmation.mustNot).map((item) => [
    item.id,
    renderStatusBadge(statusForRequirementId(item.id, progressDelta).label, statusForRequirementId(item.id, progressDelta).tone),
    userFacingText(item, 'text', language),
    userFacingText(item, 'scopeBoundary', language) ?? 'scope boundary must be preserved',
    String(item.userApprovalRequiredIfChanged ?? true),
    renderIdBadges(findViewsCovering(views.boundaryViews, item.id)),
  ]);
  const evidenceRows = asArray(confirmation.evidence).map((item) => [
    item.id,
    renderStatusBadge(statusForRequirementId(item.id, progressDelta).label, statusForRequirementId(item.id, progressDelta).tone),
    userFacingText(item, 'text', language),
    item.gate ?? '',
    userFacingText(item, 'oracle', language) ?? '',
    renderIdBadges(item.requiredCommandRefs),
    renderIdBadges(item.artifactRefs ?? findArtifactRefs(artifactPlan, item.id)),
    item.acceptanceType ?? 'unspecified',
  ]);
  const questionRows = asArray(confirmation.openQuestions).map((item) => [
    item.id,
    userFacingText(item, 'text', language),
    String(item.blocksImplementation === true),
    item.owner ?? '',
    userFacingText(item, 'requiredDecision', language) ?? '',
    userFacingText(item, 'impactIfUnresolved', language) ?? '',
  ]);
  const failureRows = asArray(confirmation.failurePaths).map((item) => [
    item.id,
    userFacingText(item, 'title', language) ?? '',
    userFacingText(item, 'trigger', language) ?? '',
    userFacingText(item, 'expectedBehavior', language) ?? '',
    userFacingText(item, 'forbiddenBehavior', language) ?? '',
    String(item.blocksCompletionWhenViolated === true),
    renderIdBadges(item.linkedNegIds),
    renderIdBadges(item.linkedEvidenceIds),
    asArray(item.requiredAssertions).map((assertion) => escapeHtml(assertion)).join('<br/>'),
  ]);
  const edgeRows = asArray(confirmation.edgeCases).map((item) => [
    item.id,
    item.category ?? '',
    userFacingText(item, 'condition', language) ?? userFacingText(item, 'expectedBehavior', language) ?? '',
    userFacingText(item, 'expectedBehavior', language) ?? '',
    userFacingText(item, 'forbiddenBehavior', language) ?? '',
    renderIdBadges(item.linkedFailurePathIds),
    renderIdBadges(item.linkedEvidenceIds),
    String(item.blocksImplementation === true),
  ]);
  const acceptanceTableRows = acceptanceRows.map((item) => [
    item.id,
    item.suiteType,
    item.files.map((file) => inlineCode(file)).join('<br/>'),
    renderIdBadges(item.covers),
    renderIdBadges(item.traceRows),
    renderIdBadges(item.evidenceRefs),
    renderIdBadges(item.commandRefs),
    item.expectedPreImplementationState || 'unspecified',
    escapeHtml(item.oracle),
    String(item.mockOnly),
  ]);
  return `<section class="card" id="requirements">
    <h2>需求内容区</h2>
    <h3>Must Do</h3>${renderTable(
      ['id', 'userStatus', 'text', 'evidenceRefs', 'coveredByTraceRows', 'acceptanceRefs', 'coveredBySequenceViews', 'upstreamRequirementIds', 'riskLevel'],
      mustRows
    )}
    <h3>Not Done / Cannot Count As Complete</h3>${renderTable(
      ['id', 'userStatus', 'text', 'evidenceRefs', 'acceptanceRefs', 'whyItBlocksCompletion', 'negativeAssertionRequired', 'coveredByFailurePath'],
      negRows
    )}
    <h3>Must Not Do / Out Of Scope</h3>${renderTable(
      ['id', 'userStatus', 'text', 'scopeBoundary', 'userApprovalRequiredIfChanged', 'coveredByBoundaryView'],
      outRows
    )}
    <h3>Evidence</h3>${renderTable(
      ['id', 'userStatus', 'text', 'gate', 'oracle', 'requiredCommandRefs', 'artifactRefs', 'acceptanceType'],
      evidenceRows
    )}
    <h3>Acceptance / E2E Suites</h3>${renderTable(
      ['id', 'suiteType', 'files', 'covers', 'traceRows', 'evidenceRefs', 'commandRefs', 'expectedPreImplementationState', 'oracle', 'mockOnly'],
      acceptanceTableRows
    )}
    <h3>Failure Paths</h3>${renderTable(
      ['id', 'title', 'trigger', 'expectedBehavior', 'forbiddenBehavior', 'blocksCompletion', 'linkedNegIds', 'linkedEvidenceIds', 'requiredAssertions'],
      failureRows
    )}
    <h3>Edge Cases</h3>${renderTable(
      ['id', 'category', 'condition', 'expectedBehavior', 'forbiddenBehavior', 'linkedFailurePathIds', 'linkedEvidenceIds', 'blocksImplementation'],
      edgeRows
    )}
    <h3>Open Questions</h3>${renderTable(
      ['id', 'text', 'blocksImplementation', 'owner', 'requiredDecision', 'impactIfUnresolved'],
      questionRows
    )}
  </section>`;
}

function inferRequirementBoundary(confirmation, views, mermaidBlocks) {
  const explicit = confirmation.requirementBoundary ?? {};
  const allIds = unique([
    ...asArray(confirmation.must).map((item) => item.id),
    ...asArray(confirmation.notDone).map((item) => item.id),
    ...asArray(confirmation.mustNot).map((item) => item.id),
    ...asArray(confirmation.evidence).map((item) => item.id),
  ]);
  const explicitBusiness = stringList(explicit.business?.requirementIds);
  const explicitGovernance = stringList(explicit.governance?.requirementIds);
  const governanceKeywords =
    /governance|control|gate|closeout|confirmation|record|writer|event|hook|dashboard|sft|score|evidence|artifact|current[-_ ]?target|recovery|resume|trace|policy|registry|治理|控制|门禁|准出|确认|证据|工件|恢复|注册表/iu;
  const governanceIds = new Set(explicitGovernance);
  for (const item of [
    ...asArray(confirmation.must),
    ...asArray(confirmation.notDone),
    ...asArray(confirmation.mustNot),
    ...asArray(confirmation.evidence),
  ]) {
    const text = `${item.id} ${item.text ?? ''} ${item.gate ?? ''} ${item.oracle ?? ''} ${item.scopeBoundary ?? ''}`;
    if (governanceKeywords.test(text)) governanceIds.add(item.id);
  }
  const businessIds = new Set(explicitBusiness.length ? explicitBusiness : allIds.filter((id) => !governanceIds.has(id)));
  for (const id of explicitBusiness) governanceIds.delete(id);
  const allViews = [
    ...views.sequenceViews.map((view) => ({ ...view, type: 'sequenceViews' })),
    ...views.flowViews.map((view) => ({ ...view, type: 'flowViews' })),
    ...views.edgeCaseViews.map((view) => ({ ...view, type: 'edgeCaseViews' })),
    ...views.boundaryViews.map((view) => ({ ...view, type: 'boundaryViews' })),
  ];
  const viewRows = allViews.map((view) => ({ ...view, inferredScope: inferViewScope(view, businessIds, governanceIds) }));
  const businessViewRefs = unique([
    ...stringList(explicit.business?.viewRefs),
    ...viewRows.filter((view) => view.inferredScope === 'business' || view.inferredScope === 'mixed').map((view) => view.id),
  ]);
  const governanceViewRefs = unique([
    ...stringList(explicit.governance?.viewRefs),
    ...viewRows.filter((view) => view.inferredScope === 'governance' || view.inferredScope === 'mixed').map((view) => view.id),
  ]);
  const businessDiagramRefs = unique([
    ...stringList(explicit.business?.diagramRefs),
    ...mermaidBlocks.filter((block) => inferMermaidBlockScope(block, businessIds, governanceIds) !== 'governance').map((block) => block.id),
  ]);
  const governanceDiagramRefs = unique([
    ...stringList(explicit.governance?.diagramRefs),
    ...mermaidBlocks.filter((block) => inferMermaidBlockScope(block, businessIds, governanceIds) !== 'business').map((block) => block.id),
  ]);
  return {
    business: {
      description: explicit.business?.description ?? 'Consumer-facing product, data, safety, launch, and domain behavior.',
      requirementIds: [...businessIds],
      viewRefs: businessViewRefs,
      diagramRefs: businessDiagramRefs,
    },
    governance: {
      description: explicit.governance?.description ?? 'Confirmation, evidence, controlled ingest, automation, gate, and closeout mechanics.',
      requirementIds: [...governanceIds],
      viewRefs: governanceViewRefs,
      diagramRefs: governanceDiagramRefs,
    },
    viewRows,
  };
}

function renderRequirementBoundary(boundary, ui) {
  const summaryRows = [
    [
      ui.consumerBusinessRequirements,
      boundary.business.description,
      renderCompactIdBadges(boundary.business.requirementIds, 18),
      renderCompactIdBadges(boundary.business.viewRefs, 12),
      renderCompactIdBadges(boundary.business.diagramRefs, 12),
    ],
    [
      ui.governanceControlRequirements,
      boundary.governance.description,
      renderCompactIdBadges(boundary.governance.requirementIds, 18),
      renderCompactIdBadges(boundary.governance.viewRefs, 12),
      renderCompactIdBadges(boundary.governance.diagramRefs, 12),
    ],
  ];
  const viewRows = boundary.viewRows.map((view) => [
    view.id,
    view.type,
    view.title ?? '',
    view.inferredScope,
    renderCompactIdBadges(view.covers, 12),
  ]);
  return `<section class="card" id="requirement-boundary">
    <h2>${escapeHtml(ui.requirementBoundary)}</h2>
    <p class="section-lead">${escapeHtml(ui.requirementBoundaryLead)}</p>
    ${renderTable(['scope', 'description', 'requirementIds', 'viewRefs', 'diagramRefs'], summaryRows)}
    <h3>${escapeHtml(ui.viewBoundaryMap)}</h3>
    ${renderTable(['viewId', 'viewType', 'title', 'scope', 'covers'], viewRows)}
  </section>`;
}

function renderBusinessVisuals(diagramGroups, boundary, ui, mermaidRuntime, args) {
  const businessViews = boundary.viewRows.filter((view) => view.inferredScope === 'business' || view.inferredScope === 'mixed');
  return `<section class="card" id="business-visuals"><h2>${escapeHtml(ui.businessVisuals)}</h2><p class="section-lead">${escapeHtml(
    ui.businessVisualsLead
  )}</p><h3>${escapeHtml(ui.businessDiagramSet)}</h3>${renderMermaidBlocks(
    diagramGroups.business,
    ui,
    mermaidRuntime,
    args
  )}<h3>${escapeHtml(ui.happyPath)}</h3>${renderMermaidBlocks(
    diagramGroups.happy,
    ui,
    mermaidRuntime,
    args
  )}${renderTable(
    ['viewId', 'title', 'scope', 'covers', 'diagramHash'],
    businessViews.map((view) => [
      view.id,
      view.title ?? '',
      view.inferredScope,
      renderIdBadges(view.covers),
      view.diagramHash ?? 'computed from Mermaid blocks below',
    ])
  )}<h3>${escapeHtml(ui.failurePath)}</h3>${renderMermaidBlocks(
    diagramGroups.failure,
    ui,
    mermaidRuntime,
    args
  )}<h3>${escapeHtml(ui.stateFlow)}</h3>${renderMermaidBlocks(
    diagramGroups.stateFlow,
    ui,
    mermaidRuntime,
    args
  )}${renderTable(
    ['viewId', 'title', 'scope', 'covers', 'diagramHash'],
    businessViews.filter((view) => view.type === 'flowViews').map((view) => [view.id, view.title ?? '', view.inferredScope, renderIdBadges(view.covers), view.diagramHash ?? 'computed from Mermaid blocks below'])
  )}<h3>${escapeHtml(ui.edgeCase)}</h3>${renderMermaidBlocks(
    diagramGroups.edge,
    ui,
    mermaidRuntime,
    args
  )}${renderTable(
    ['viewId', 'title', 'scope', 'covers', 'cases'],
    businessViews.filter((view) => view.type === 'edgeCaseViews').map((view) => [view.id, view.title ?? '', view.inferredScope, renderIdBadges(view.covers), stringList(view.cases).join(', ')])
  )}</section>`;
}

function renderGovernanceVisuals(diagramGroups, boundary, ui, mermaidRuntime, args) {
  const governanceViews = boundary.viewRows.filter((view) => view.inferredScope === 'governance' || view.inferredScope === 'mixed');
  return `<section class="card" id="governance-visuals"><h2>${escapeHtml(ui.governanceVisuals)}</h2><p class="section-lead">${escapeHtml(
    ui.governanceVisualsLead
  )}</p><h3>${escapeHtml(ui.governanceDiagramSet)}</h3>${renderMermaidBlocks(
    diagramGroups.governance,
    ui,
    mermaidRuntime,
    args
  )}<h3>${escapeHtml(ui.governanceBoundaryViews)}</h3>${renderTable(
    ['viewId', 'title', 'scope', 'covers'],
    governanceViews.map((view) => [view.id, view.title ?? '', view.inferredScope, renderIdBadges(view.covers)])
  )}</section>`;
}

function collectIdsFromSourceRefs(entry, sourceType) {
  return asArray(entry?.sourceRefs)
    .filter((ref) => !sourceType || ref?.sourceType === sourceType)
    .map((ref) => String(ref?.id ?? '').trim())
    .filter(Boolean);
}

function collectTraceRefs(entry) {
  return unique([
    ...stringList(entry?.traceRows),
    ...stringList(entry?.traceRowIds),
    ...stringList(entry?.traceRefs),
    ...stringList(entry?.coveredTraceRows),
    ...collectIdsFromSourceRefs(entry, 'trace_row'),
    ...extractIds(entry?.requirementId).filter((id) => id.startsWith('TRACE-')),
  ]);
}

function collectEvidenceRefs(entry) {
  return unique([
    ...stringList(entry?.evidenceRefs),
    ...stringList(entry?.evidenceIds),
    ...collectIdsFromSourceRefs(entry, 'evidence'),
  ]);
}

function collectCommandRefs(entry) {
  return unique([
    ...stringList(entry?.requiredCommandRefs),
    ...stringList(entry?.commandRefs),
    ...asArray(entry?.commandRunRefs).map((ref) => ref?.commandId ?? ref?.id ?? '').filter(Boolean),
    ...collectIdsFromSourceRefs(entry, 'command_run'),
  ]);
}

function collectArtifactRefs(entry) {
  const primitiveRefs = (value) =>
    asArray(value).filter((item) => item === null || typeof item !== 'object').map((item) => String(item));
  return unique([
    ...primitiveRefs(entry?.artifactRefs),
    ...primitiveRefs(entry?.evidenceArtifactRefs),
    ...asArray(entry?.evidenceArtifactRefs).map((ref) => ref?.artifactId ?? ref?.path ?? ref?.contentHash ?? '').filter(Boolean),
    ...asArray(entry?.artifactRefs)
      .map((ref) => (typeof ref === 'object' ? ref.artifactId ?? ref.path ?? ref.hash : ref))
      .filter(Boolean),
  ].map((item) => String(item)));
}

function collectArtifactObjects(entry) {
  return [
    ...asArray(entry?.artifactRefs),
    ...asArray(entry?.evidenceArtifactRefs),
  ].filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

function artifactIsBound(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return false;
  return Boolean(
    firstString(artifact.path, artifact.artifactId, artifact.hash, artifact.contentHash) &&
      firstString(artifact.hash, artifact.contentHash)
  );
}

function closeoutAttempts(record) {
  return asArray(record?.closeout?.attempts);
}

function latestCloseoutAttempt(record, currentAttemptId) {
  const attempts = closeoutAttempts(record);
  if (currentAttemptId) {
    const matched = attempts.find((attempt) => firstString(attempt?.closeoutAttemptId, attempt?.attemptId) === currentAttemptId);
    if (matched) return matched;
  }
  return attempts.at(-1) ?? null;
}

function deliveryEvidenceObject(record) {
  return record?.deliveryEvidence && typeof record.deliveryEvidence === 'object' && !Array.isArray(record.deliveryEvidence)
    ? record.deliveryEvidence
    : {};
}

function commandSelectedForAttempt(command, attemptId) {
  if (!attemptId) return false;
  if (firstString(command?.closeoutAttemptId) === attemptId) return true;
  const lastRunRef = command?.lastRunRef;
  return Boolean(
    lastRunRef &&
      typeof lastRunRef === 'object' &&
      !Array.isArray(lastRunRef) &&
      firstString(lastRunRef.closeoutAttemptId) === attemptId
  );
}

function requiredCommandsForAttempt(record, attemptId) {
  return asArray(deliveryEvidenceObject(record).requiredCommands).filter((command) =>
    commandSelectedForAttempt(command, attemptId)
  );
}

function commandRunId(command) {
  const lastRunRef = command?.lastRunRef;
  return firstString(
    command?.runId,
    lastRunRef && typeof lastRunRef === 'object' && !Array.isArray(lastRunRef) ? lastRunRef.runId : ''
  );
}

function defaultCloseoutReportPath(requirementRecordState) {
  if (!requirementRecordState?.path) return '';
  return path.join(path.dirname(path.resolve(requirementRecordState.path)), 'delivery-closeout-report.json');
}

function readCloseoutReport(args, requirementRecordState) {
  const requestedPath = args.closeoutReport
    ? path.resolve(args.closeoutReport)
    : defaultCloseoutReportPath(requirementRecordState);
  if (!requestedPath) {
    return { found: false, path: '', report: null, hash: null, loadError: null, source: 'unresolved' };
  }
  if (!fs.existsSync(requestedPath)) {
    return {
      found: false,
      path: normalizePathForReport(requestedPath),
      report: null,
      hash: null,
      loadError: null,
      source: args.closeoutReport ? 'explicit' : 'default',
    };
  }
  try {
    const raw = readText(requestedPath);
    return {
      found: true,
      path: normalizePathForReport(requestedPath),
      report: /\.ya?ml$/iu.test(requestedPath) ? yaml.load(raw) : JSON.parse(raw),
      hash: sha256(raw),
      loadError: null,
      source: args.closeoutReport ? 'explicit' : 'default',
    };
  } catch (error) {
    return {
      found: false,
      path: normalizePathForReport(requestedPath),
      report: null,
      hash: null,
      loadError: error instanceof Error ? error.message : String(error),
      source: args.closeoutReport ? 'explicit' : 'default',
    };
  }
}

function currentCloseoutChecks(closeoutReportState, attempt) {
  const reportChecks = asArray(closeoutReportState?.report?.checks);
  if (reportChecks.length) return reportChecks;
  return asArray(attempt?.checks);
}

function checkPassed(check) {
  if (check?.passed === true) return true;
  if (check?.passed === false) return false;
  const status = String(check?.status ?? check?.decision ?? '').toLowerCase();
  if (!status) return false;
  return ['pass', 'passed', 'ready', 'complete', 'completed', 'closed', 'true'].includes(status);
}

function checkIssueCount(check) {
  return Number(check?.issueCount ?? check?.failedEvidenceCount ?? check?.missingEvidenceCount ?? check?.openCount ?? 0) || 0;
}

function closeoutReportDecision(closeoutReportState, attemptDecision) {
  return String(closeoutReportState?.report?.decision ?? closeoutReportState?.report?.closeoutReadyDecision ?? attemptDecision ?? '').toLowerCase();
}

function closeoutUserAcceptanceRequestProof(record, currentAttemptId, attempt) {
  if (!record || !currentAttemptId) {
    return { awaitingUserAcceptance: false, proofKind: 'missing_record_or_attempt', proofRefs: [] };
  }
  const refs = [];
  const closeoutAttemptMatches = firstString(record?.closeout?.currentAttemptId) === currentAttemptId;
  const closeoutDecisionPass = String(record?.closeout?.decision ?? '').toLowerCase() === 'pass';
  const attemptDecisionPass = String(attempt?.decision ?? '').toLowerCase() === 'pass';
  const acceptanceRequest = record?.closeout?.acceptanceRequest ?? {};
  const acceptanceRequestPresent =
    acceptanceRequest && typeof acceptanceRequest === 'object' && Object.keys(acceptanceRequest).length > 0;
  const requestMatches =
    !acceptanceRequestPresent ||
    (String(acceptanceRequest?.status ?? '') === 'awaiting_user_acceptance' &&
      firstString(acceptanceRequest?.closeoutAttemptId) === currentAttemptId);
  if (record.status === 'awaiting_user_acceptance') refs.push('record.status=awaiting_user_acceptance');
  if (record.lastEventType === 'delivery_confirmation_user_acceptance_requested') {
    refs.push('record.lastEventType=delivery_confirmation_user_acceptance_requested');
  }
  if (String(record.lastAppliedEventId ?? '').startsWith('delivery_confirmation_user_acceptance_requested:')) {
    refs.push(`record.lastAppliedEventId=${record.lastAppliedEventId}`);
  }
  if (acceptanceRequestPresent && requestMatches) {
    refs.push('record.closeout.acceptanceRequest.status=awaiting_user_acceptance');
  }
  const awaitingUserAcceptance =
    closeoutAttemptMatches &&
    (closeoutDecisionPass || attemptDecisionPass) &&
    record.status === 'awaiting_user_acceptance' &&
    String(record.currentMentalModel ?? '') === 'delivery_confirmation' &&
    String(record.currentStage ?? '') === 'delivery_confirmation' &&
    String(record.lastEventType ?? '') === 'delivery_confirmation_user_acceptance_requested' &&
    requestMatches;
  return {
    awaitingUserAcceptance,
    proofKind: awaitingUserAcceptance
      ? 'closeout_user_acceptance_request_proof'
      : 'closeout_user_acceptance_request_missing',
    proofRefs: refs,
  };
}

function terminalStatus(value) {
  return ['pass', 'passed', 'closed', 'done', 'completed', 'resolved', 'success'].includes(String(value ?? '').toLowerCase());
}

function countOpenItems(rows) {
  return asArray(rows).filter((row) => {
    const status = row?.status ?? row?.decision ?? row?.state ?? row?.result;
    if (status === undefined || status === null || status === '') return false;
    return !terminalStatus(status);
  }).length;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function entrySourceHash(entry) {
  return firstString(entry?.sourceDocumentHash, entry?.hashes?.sourceDocumentHash, entry?.sourceRefsHash?.sourceDocumentHash);
}

function entryImplementationHash(entry) {
  return firstString(
    entry?.implementationConfirmationHash,
    entry?.hashes?.implementationConfirmationHash,
    entry?.sourceRefsHash?.implementationConfirmationHash
  );
}

function entryArchitectureHash(entry) {
  return firstString(
    entry?.architectureConfirmationHash,
    entry?.architectureConfirmationArtifactHash,
    entry?.hashes?.architectureConfirmationHash,
    entry?.hashes?.architectureConfirmationArtifactHash
  );
}

function entryAttemptId(entry) {
  return firstString(
    entry?.closeoutAttemptId,
    entry?.currentAttemptId,
    entry?.attemptId,
    ...asArray(entry?.commandRunRefs).map((ref) => ref?.closeoutAttemptId)
  );
}

function hashMatchStatus(actual, expected, label) {
  if (!expected) return { ok: false, reason: `${label}_current_hash_missing` };
  if (!actual) return { ok: false, reason: `${label}_hash_missing` };
  if (actual !== expected) return { ok: false, reason: `${label}_hash_mismatch` };
  return { ok: true, reason: `${label}_hash_match` };
}

function entryMatchesCurrentHashes(entry, currentHashes) {
  const checks = [
    hashMatchStatus(entrySourceHash(entry), currentHashes.sourceDocumentHash, 'sourceDocument'),
    hashMatchStatus(entryImplementationHash(entry), currentHashes.implementationConfirmationHash, 'implementationConfirmation'),
    currentHashes.architectureConfirmationHash
      ? hashMatchStatus(entryArchitectureHash(entry), currentHashes.architectureConfirmationHash, 'architectureConfirmation')
      : { ok: true, reason: 'architectureConfirmation_not_required' },
  ];
  return {
    ok: checks.every((check) => check.ok),
    reasons: checks.filter((check) => !check.ok).map((check) => check.reason),
  };
}

function entryMatchesCurrentAttempt(entry, currentAttemptId) {
  if (!currentAttemptId) return { ok: false, reason: 'current_attempt_missing' };
  const actualAttemptId = entryAttemptId(entry);
  if (!actualAttemptId) return { ok: false, reason: 'entry_attempt_missing' };
  if (actualAttemptId !== currentAttemptId) return { ok: false, reason: 'attempt_mismatch' };
  return { ok: true, reason: 'attempt_match' };
}

function latestArchitectureConfirmationHash(record) {
  return firstString(
    record?.architectureConfirmationHash,
    record?.architectureConfirmationState?.currentArchitectureConfirmationHash,
    record?.architectureConfirmationState?.staleInputs?.currentArtifactHash,
    ...asArray(record?.architectureConfirmations).map((item) => item?.architectureConfirmationArtifactHash).reverse()
  );
}

function buildTraceExecutionState(input) {
  const {
    traceRows,
    requirementRecordState,
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationHash,
  } = input;
  const record = requirementRecordState?.record;
  const currentAttemptId = firstString(record?.closeout?.currentAttemptId);
  const currentHashes = {
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationHash: firstString(architectureConfirmationHash, latestArchitectureConfirmationHash(record)),
  };
  const entries = [
    ...asArray(record?.requirementClosures).map((entry) => ({ kind: 'requirementClosure', entry })),
    ...asArray(record?.executionIterations).map((entry) => ({ kind: 'executionIteration', entry })),
    ...asArray(record?.gateChecks).map((entry) => ({ kind: 'gateCheck', entry })),
    ...asArray(record?.contractChecks).map((entry) => ({ kind: 'contractCheck', entry })),
    ...asArray(record?.deliveryEvidence).map((entry) => ({ kind: 'deliveryEvidence', entry })),
  ];
  const rowStates = {};
  for (const row of traceRows) {
    const traceId = row.id;
    const matchingEntries = entries.filter(({ entry }) => collectTraceRefs(entry).includes(traceId));
    const currentEntries = matchingEntries.filter(({ entry }) => {
      const hashStatus = entryMatchesCurrentHashes(entry, currentHashes);
      const attemptStatus = entryMatchesCurrentAttempt(entry, currentAttemptId);
      return hashStatus.ok && attemptStatus.ok;
    });
    const currentPassEntries = currentEntries.filter(({ entry }) => {
      const status = String(entry?.status ?? entry?.decision ?? '').toLowerCase();
      return ['pass', 'passed', 'closed', 'done', 'completed'].includes(status);
    });
    const currentEvidenceEntries = currentEntries.filter(({ entry }) => {
      const evidenceRefs = collectEvidenceRefs(entry);
      const commandRefs = collectCommandRefs(entry);
      const artifactRefs = collectArtifactRefs(entry);
      return evidenceRefs.length || commandRefs.length || artifactRefs.length;
    });
    const staleReasons = unique(
      matchingEntries.flatMap(({ entry }) => {
        const hashStatus = entryMatchesCurrentHashes(entry, currentHashes);
        const attemptStatus = entryMatchesCurrentAttempt(entry, currentAttemptId);
        return [
          ...hashStatus.reasons,
          attemptStatus.ok ? '' : attemptStatus.reason,
        ];
      })
    );
    const bestEntry = currentPassEntries[0]?.entry ?? currentEvidenceEntries[0]?.entry ?? matchingEntries.at(-1)?.entry ?? null;
    const status =
      !requirementRecordState?.found
        ? 'no_controlled_record'
        : !matchingEntries.length
          ? 'no_controlled_execution'
          : currentPassEntries.length
            ? 'current_pass'
            : currentEvidenceEntries.length
              ? 'current_evidence_recorded'
              : staleReasons.some((reason) => /hash_/u.test(reason))
                ? 'historical_stale_hash_mismatch'
                : staleReasons.some((reason) => /attempt/u.test(reason))
                  ? 'historical_stale_attempt_mismatch'
                  : 'historical_stale';
    const validity =
      status === 'current_pass' || status === 'current_evidence_recorded'
        ? 'current'
        : status === 'no_controlled_record' || status === 'no_controlled_execution'
          ? 'unavailable'
          : 'stale';
    rowStates[traceId] = {
      traceId,
      status,
      validity,
      currentAttemptId,
      matchedEntryCount: matchingEntries.length,
      currentEntryCount: currentEntries.length,
      staleReasons,
      evidenceRefs: collectEvidenceRefs(bestEntry),
      commandRefs: collectCommandRefs(bestEntry),
      artifactRefs: collectArtifactRefs(bestEntry).slice(0, 6),
      runId: firstString(bestEntry?.runId, ...asArray(bestEntry?.commandRunRefs).map((ref) => ref?.runId)),
      closeoutAttemptId: entryAttemptId(bestEntry),
      reason: requirementRecordState?.loadError
        ? `record_load_error:${requirementRecordState.loadError}`
        : !requirementRecordState?.found
          ? 'requirement-record.json not found'
          : staleReasons.join(', '),
    };
  }
  return {
    recordPath: requirementRecordState?.path ? normalizePathForReport(requirementRecordState.path) : '',
    recordFound: requirementRecordState?.found === true,
    recordLoadError: requirementRecordState?.loadError ?? null,
    currentAttemptId,
    currentHashes,
    statusProjectionPolicy: {
      sourceTraceRowsStatusRole: 'confirmed_contract_projection',
      runtimeClosureStatusRole: 'controlled_execution_projection',
      sourcePendingDoesNotOverrideRuntimeClosure: true,
      runtimeClosureDoesNotRewriteConfirmedSourceTraceRows: true,
    },
    rows: rowStates,
    counts: {
      currentPass: Object.values(rowStates).filter((row) => row.status === 'current_pass').length,
      currentEvidenceRecorded: Object.values(rowStates).filter((row) => row.status === 'current_evidence_recorded').length,
      stale: Object.values(rowStates).filter((row) => row.validity === 'stale').length,
      unavailable: Object.values(rowStates).filter((row) => row.validity === 'unavailable').length,
    },
  };
}

function renderTraceExecutionEvidence(state) {
  if (!state) return '<span class="muted">无</span>';
  const parts = [
    state.runId ? `run=${state.runId}` : '',
    state.closeoutAttemptId ? `attempt=${state.closeoutAttemptId}` : '',
    state.evidenceRefs?.length ? `evidence=${state.evidenceRefs.join(',')}` : '',
    state.commandRefs?.length ? `commands=${state.commandRefs.join(',')}` : '',
    state.artifactRefs?.length ? `artifacts=${state.artifactRefs.join(',')}` : '',
    state.reason ? `reason=${state.reason}` : '',
  ].filter(Boolean);
  return inlineCode(parts.join(' | ') || '无');
}

function requirementIdsForTraceRows(traceRows, traceIds) {
  const wanted = new Set(stringList(traceIds));
  return unique(
    asArray(traceRows)
      .filter((row) => wanted.has(row.id))
      .flatMap((row) => [...stringList(row.covers), ...stringList(row.boundaryCoveredIds), ...stringList(row.evidenceRefs)])
  );
}

function allConfirmationIdsByGroup(confirmation) {
  return {
    must: asArray(confirmation.must).map((item) => item.id),
    notDone: asArray(confirmation.notDone).map((item) => item.id),
    mustNot: asArray(confirmation.mustNot).map((item) => item.id),
    evidence: asArray(confirmation.evidence).map((item) => item.id),
    traceRows: asArray(confirmation.traceRows).map((item) => item.id),
  };
}

function buildIdToTraceRows(traceRows) {
  const out = {};
  for (const row of asArray(traceRows)) {
    for (const id of unique([...stringList(row.covers), ...stringList(row.boundaryCoveredIds), ...stringList(row.evidenceRefs)])) {
      out[id] = unique([...(out[id] ?? []), row.id]);
    }
  }
  return out;
}

function traceStatusForIds(ids, idToTraceRows, traceExecutionState, ui) {
  const traceIds = unique(stringList(ids).flatMap((id) => idToTraceRows[id] ?? []));
  const states = traceIds.map((traceId) => traceExecutionState?.rows?.[traceId]).filter(Boolean);
  if (!traceExecutionState?.recordFound) {
    return {
      traceIds,
      label: ui.progressStatus.noControlledRecord,
      tone: 'gold',
      proofState: 'no_controlled_record',
    };
  }
  if (!traceIds.length || !states.length) {
    return {
      traceIds,
      label: ui.progressStatus.missingEvidence,
      tone: 'red',
      proofState: 'missing_evidence',
    };
  }
  if (states.some((state) => state.validity === 'current' && state.status === 'current_pass')) {
    return {
      traceIds,
      label: ui.progressStatus.currentProofValid,
      tone: 'green',
      proofState: 'current_proof_valid',
    };
  }
  if (states.some((state) => state.validity === 'current')) {
    return {
      traceIds,
      label: ui.progressStatus.currentEvidenceRecorded,
      tone: 'blue',
      proofState: 'current_evidence_recorded',
    };
  }
  if (states.some((state) => state.validity === 'stale')) {
    return {
      traceIds,
      label: ui.progressStatus.staleProof,
      tone: 'gold',
      proofState: 'stale_proof',
    };
  }
  return {
    traceIds,
    label: ui.progressStatus.missingEvidence,
    tone: 'red',
    proofState: 'missing_evidence',
  };
}

function statusForRequirementId(id, progressDelta) {
  if (!progressDelta) return { label: 'not_evaluated', tone: 'gold', proofState: 'not_evaluated' };
  if (progressDelta.newIds.includes(id)) {
    return { label: progressDelta.statusLabels.newOrChanged, tone: 'blue', proofState: 'new_or_changed' };
  }
  return progressDelta.idStatuses[id] ?? {
    label: progressDelta.statusLabels.missingEvidence,
    tone: 'red',
    proofState: 'missing_evidence',
  };
}

function buildProgressDelta(input) {
  const { confirmation, traceRows, traceExecutionState, reconfirmationState, ui, sourceProjectionDiagnostics, closeoutRuntimeReady } = input;
  const byGroup = allConfirmationIdsByGroup(confirmation);
  const idToTraceRows = buildIdToTraceRows(traceRows);
  const affectedTraceRows = unique([
    ...stringList(reconfirmationState?.affectedTraceRows),
    ...stringList(reconfirmationState?.impactedTraceRows),
    ...stringList(reconfirmationState?.impactedIds).filter((id) => id.startsWith('TRACE-')),
  ]);
  const traceCoveredReviewIds = requirementIdsForTraceRows(traceRows, affectedTraceRows);
  const affectedRequirementIds = unique([
    ...stringList(reconfirmationState?.affectedRequirementIds),
    ...stringList(reconfirmationState?.impactedIds).filter((id) => !id.startsWith('TRACE-')),
  ]);
  const newIds = unique(
    affectedRequirementIds.filter(
      (id) =>
        byGroup.must.includes(id) ||
        byGroup.notDone.includes(id) ||
        byGroup.mustNot.includes(id) ||
        byGroup.evidence.includes(id) ||
        byGroup.traceRows.includes(id)
    )
  );
  const changedIds = unique([
    ...asArray(reconfirmationState?.diffSummary).flatMap((item) => extractIds(stableStringify(item))),
    ...newIds,
  ]);
  const idStatuses = {};
  for (const groupIds of [byGroup.must, byGroup.notDone, byGroup.evidence]) {
    for (const id of groupIds) {
      idStatuses[id] = traceStatusForIds([id], idToTraceRows, traceExecutionState, ui);
    }
  }
  const sourceProjectionGapIds = new Set(
    asArray(sourceProjectionDiagnostics?.unboundEvidence).map((row) => row.id).filter(Boolean)
  );
  if (closeoutRuntimeReady) {
    for (const id of sourceProjectionGapIds) {
      if (idStatuses[id]?.proofState === 'missing_evidence') {
        idStatuses[id] = {
          traceIds: [],
          label: 'source_projection_gap',
          tone: 'gold',
          proofState: 'source_projection_gap',
          explanation:
            'source evidence[] entry exists but no source traceRows[].evidenceRefs row binds it; this is not closeout runtime evidence missing',
        };
      }
    }
  }
  for (const id of byGroup.mustNot) {
    idStatuses[id] = {
      traceIds: idToTraceRows[id] ?? [],
      label: ui.progressStatus.currentProofValid,
      tone: 'green',
      proofState: 'scope_boundary_confirmed',
    };
  }
  const traceRowsWithState = asArray(traceRows).map((row) => ({
    id: row.id,
    status: traceExecutionState?.rows?.[row.id]?.status ?? 'no_controlled_record',
    validity: traceExecutionState?.rows?.[row.id]?.validity ?? 'unavailable',
  }));
  const currentAttemptProofValidIds = Object.entries(idStatuses)
    .filter(([, status]) => status.proofState === 'current_proof_valid')
    .map(([id]) => id);
  const currentEvidenceRecordedIds = Object.entries(idStatuses)
    .filter(([, status]) => status.proofState === 'current_evidence_recorded')
    .map(([id]) => id);
  const staleProofIds = Object.entries(idStatuses)
    .filter(([, status]) => status.proofState === 'stale_proof')
    .map(([id]) => id);
  const missingEvidenceIds = Object.entries(idStatuses)
    .filter(([, status]) => ['missing_evidence', 'no_controlled_record'].includes(status.proofState))
    .map(([id]) => id);
  const sourceProjectionGapEvidenceIds = Object.entries(idStatuses)
    .filter(([, status]) => status.proofState === 'source_projection_gap')
    .map(([id]) => id);
  const historicalPassedTraceRows = traceRowsWithState
    .filter((row) => row.validity === 'stale')
    .map((row) => row.id);
  const currentPassTraceRows = traceRowsWithState
    .filter((row) => row.status === 'current_pass')
    .map((row) => row.id);
  const reviewFocusIds = unique([
    ...newIds,
    ...affectedTraceRows,
    ...missingEvidenceIds,
  ]);
  const affectedTraceCoveredIds = traceCoveredReviewIds;
  const nextExecutionStart = affectedTraceRows[0] ?? traceRowsWithState.find((row) => row.status !== 'current_pass')?.id ?? '';
  const currentAttemptStatus =
    !traceExecutionState?.recordFound
      ? 'missing_controlled_record'
      : traceExecutionState.counts.unavailable > 0
        ? 'missing_current_attempt_evidence'
        : traceExecutionState.counts.stale > 0
          ? 'has_stale_historical_evidence'
          : 'current_attempt_evidence_available';
  return {
    affectedTraceRows,
    affectedRequirementIds,
    newIds,
    changedIds,
    reviewFocusIds,
    affectedTraceCoveredIds,
    historicalPassedIds: staleProofIds,
    historicalPassedTraceRows,
    currentAttemptProofValidIds,
    currentEvidenceRecordedIds,
    sourceProjectionGapEvidenceIds,
    currentPassTraceRows,
    staleProofIds,
    missingEvidenceIds,
    idStatuses,
    traceRows: traceRowsWithState,
    currentAttemptStatus,
    nextExecutionStart,
    statusLabels: {
      affectedTrace: ui.progressStatus.affectedTrace,
      reviewFocus: ui.progressStatus.reviewFocus,
      missingEvidence: ui.progressStatus.missingEvidence,
      newOrChanged: ui.progressStatus.newOrChanged,
    },
    counts: {
      totalRequirementIds:
        byGroup.must.length + byGroup.notDone.length + byGroup.mustNot.length + byGroup.evidence.length,
      totalTraceRows: byGroup.traceRows.length,
      newOrChangedIds: newIds.length,
      reviewFocusIds: reviewFocusIds.length,
      currentAttemptProofValidIds: currentAttemptProofValidIds.length,
      currentEvidenceRecordedIds: currentEvidenceRecordedIds.length,
      sourceProjectionGapEvidenceIds: sourceProjectionGapEvidenceIds.length,
      staleProofIds: staleProofIds.length,
      missingEvidenceIds: missingEvidenceIds.length,
      currentPassTraceRows: currentPassTraceRows.length,
      historicalPassedTraceRows: historicalPassedTraceRows.length,
    },
  };
}

function buildDeliveryReadiness(progressDelta, traceExecutionState, ui) {
  const totalTraceRows = progressDelta?.counts?.totalTraceRows ?? 0;
  const currentPassTraceRows = progressDelta?.counts?.currentPassTraceRows ?? 0;
  const missingEvidenceCount = progressDelta?.counts?.missingEvidenceIds ?? 0;
  const staleProofCount = progressDelta?.counts?.staleProofIds ?? 0;
  const traceRows = asArray(progressDelta?.traceRows);
  const nonCurrentPassTraceRows = traceRows
    .filter((row) => row.status !== 'current_pass')
    .map((row) => row.id);
  const reasons = [];
  if (!traceExecutionState?.recordFound) reasons.push(ui.deliveryReadinessMissingRecord);
  if (missingEvidenceCount > 0) reasons.push(`${ui.deliveryReadinessMissingCurrentEvidence}: ${missingEvidenceCount}`);
  if (staleProofCount > 0 || (traceExecutionState?.counts?.stale ?? 0) > 0) {
    reasons.push(`${ui.deliveryReadinessStaleEvidence}: ${Math.max(staleProofCount, traceExecutionState?.counts?.stale ?? 0)}`);
  }
  if (currentPassTraceRows !== totalTraceRows) {
    reasons.push(`${ui.deliveryReadinessTraceNotAllPass}: ${currentPassTraceRows}/${totalTraceRows}`);
  }
  return {
    ready: reasons.length === 0,
    status: reasons.length === 0 ? 'delivery_ready' : 'delivery_not_ready',
    label: reasons.length === 0 ? ui.deliveryReady : ui.deliveryNotReady,
    reasons: unique(reasons),
    currentAttemptStatus: progressDelta?.currentAttemptStatus ?? 'unknown',
    currentPassTraceRows,
    totalTraceRows,
    missingEvidenceCount,
    staleProofCount,
    nonCurrentPassTraceRows,
  };
}

function buildSourceProjectionDiagnostics(confirmation, traceRows) {
  const idToTraceRows = buildIdToTraceRows(traceRows);
  const evidenceRows = asArray(confirmation?.evidence);
  const unboundEvidence = evidenceRows
    .filter((row) => row?.id && !asArray(idToTraceRows[row.id]).length)
    .map((row) => ({
      id: row.id,
      diagnosticType: 'source_projection_gap',
      proofState: 'source_evidence_unbound_to_trace',
      explanation:
        'source evidence[] entry exists but no source traceRows[].evidenceRefs row binds it; this is not closeout runtime evidence missing',
      requiredCommandRefs: stringList(row.requiredCommandRefs),
      artifactRefs: stringList(row.artifactRefs),
    }));
  return {
    unboundEvidenceCount: unboundEvidence.length,
    unboundEvidence,
  };
}

function buildCloseoutGateMatrix(closeoutReportState, attempt) {
  const checks = currentCloseoutChecks(closeoutReportState, attempt);
  const rows = checks.map((check) => ({
    id: firstString(check?.id, check?.checkId, check?.name),
    passed: checkPassed(check),
    issueCount: Number(check?.issueCount ?? 0) || 0,
    openCount: Number(check?.openCount ?? 0) || 0,
    missingEvidenceCount: Number(check?.missingEvidenceCount ?? 0) || 0,
    failedEvidenceCount: Number(check?.failedEvidenceCount ?? 0) || 0,
    deliveryStatus: firstString(check?.deliveryStatus, check?.status, check?.decision),
    reportPath: firstString(check?.reportPath, closeoutReportState?.report?.reportPath, attempt?.reportPath, closeoutReportState?.path),
    blockingReasons: stringList(check?.blockingReasons),
  })).filter((row) => row.id);
  return {
    reportFound: closeoutReportState?.found === true,
    reportPath: closeoutReportState?.path ?? '',
    reportDecision: closeoutReportDecision(closeoutReportState, attempt?.decision),
    reportLoadError: closeoutReportState?.loadError ?? null,
    totalCount: rows.length,
    passedCount: rows.filter((row) => row.passed).length,
    failedCount: rows.filter((row) => !row.passed).length,
    rows,
  };
}

function buildCloseoutAttemptHistory(record) {
  const attempts = closeoutAttempts(record).map((attempt, index) => {
    const checks = asArray(attempt?.checks);
    return {
      index: index + 1,
      closeoutAttemptId: firstString(attempt?.closeoutAttemptId, attempt?.attemptId),
      decision: firstString(attempt?.decision, attempt?.status),
      blockingReasons: stringList(attempt?.blockingReasons),
      checkCount: checks.length,
      passedCheckCount: checks.filter(checkPassed).length,
      failedCheckCount: checks.filter((check) => !checkPassed(check)).length,
      reportPath: firstString(attempt?.reportPath),
      evaluatedAt: firstString(attempt?.evaluatedAt, attempt?.updatedAt, attempt?.generatedAt),
    };
  });
  return {
    totalCount: attempts.length,
    blockedCount: attempts.filter((attempt) => String(attempt.decision).toLowerCase() === 'blocked').length,
    passedCount: attempts.filter((attempt) => String(attempt.decision).toLowerCase() === 'pass').length,
    attempts,
  };
}

function buildRuntimeEvidenceClosureSummary(record) {
  const requirementClosures = asArray(record?.requirementClosures);
  const gateChecks = asArray(record?.gateChecks);
  const contractChecks = asArray(record?.contractChecks);
  const failureRecords = asArray(record?.failureRecords);
  const rcaRecords = asArray(record?.rcaRecords);
  const rerunLoops = asArray(record?.rerunLoops);
  const artifactIndex = asArray(record?.artifactIndex);
  const readinessAuditRequests = asArray(record?.readinessAuditRequests);
  const readinessAuditResults = asArray(record?.readinessAuditResults);
  const readinessScoringRecords = asArray(record?.readinessScoringRecords);
  const executionIterations = asArray(record?.executionIterations);
  const deliveryRequiredCommands = asArray(record?.deliveryEvidence?.requiredCommands);
  const rows = [
    ['executionIterations', executionIterations.length, countOpenItems(executionIterations)],
    ['requirementClosures', requirementClosures.length, countOpenItems(requirementClosures)],
    ['gateChecks', gateChecks.length, countOpenItems(gateChecks)],
    ['contractChecks', contractChecks.length, countOpenItems(contractChecks)],
    ['failureRecords', failureRecords.length, countOpenItems(failureRecords)],
    ['rcaRecords', rcaRecords.length, countOpenItems(rcaRecords)],
    ['rerunLoops', rerunLoops.length, countOpenItems(rerunLoops)],
    ['artifactIndex', artifactIndex.length, 0],
    ['readinessAuditRequests', readinessAuditRequests.length, countOpenItems(readinessAuditRequests)],
    ['readinessAuditResults', readinessAuditResults.length, countOpenItems(readinessAuditResults)],
    ['readinessScoringRecords', readinessScoringRecords.length, countOpenItems(readinessScoringRecords)],
    ['deliveryRequiredCommands', deliveryRequiredCommands.length, countOpenItems(deliveryRequiredCommands)],
    ['closeoutAttempts', closeoutAttempts(record).length, 0],
  ].map(([name, totalCount, openCount]) => ({
    name,
    totalCount,
    openCount,
    status: Number(openCount) === 0 ? 'closed_or_not_applicable' : 'open_items_present',
  }));
  return { rows };
}

function buildFinalAcceptanceReview(input) {
  const { args, traceRows, traceExecutionState, requirementRecordState, deliveryReadiness } = input;
  const applies = args.mode === 'closeout-review';
  const record = requirementRecordState?.record;
  const currentAttemptId = traceExecutionState?.currentAttemptId ?? '';
  const attempt = latestCloseoutAttempt(record, currentAttemptId);
  const attemptDecision = String(attempt?.decision ?? record?.closeout?.decision ?? '').toLowerCase();
  const attemptBlockingReasons = stringList(attempt?.blockingReasons);
  const acceptanceRequestProof = closeoutUserAcceptanceRequestProof(record, currentAttemptId, attempt);
  const awaitingUserAcceptance =
    requirementRecordState?.found === true && acceptanceRequestProof.awaitingUserAcceptance;
  const allRequiredCommands = asArray(deliveryEvidenceObject(record).requiredCommands);
  const currentAttemptCommands = requiredCommandsForAttempt(record, currentAttemptId);
  const artifactBoundCommands = currentAttemptCommands.filter((command) =>
    collectArtifactObjects(command).some(artifactIsBound)
  );
  const requiredCommandEvidence = {
    totalCount: allRequiredCommands.length,
    currentAttemptCount: currentAttemptCommands.length,
    artifactBoundCount: artifactBoundCommands.length,
    currentAttemptCommandIds: currentAttemptCommands.map((command) => firstString(command.commandId, command.id)),
    artifactBoundCommandIds: artifactBoundCommands.map((command) => firstString(command.commandId, command.id)),
  };
  const rows = {};
  const rowIssues = [];
  for (const row of asArray(traceRows)) {
    const state = traceExecutionState?.rows?.[row.id] ?? {};
    const originalConfirmationStatus = String(row.status ?? 'PENDING');
    const finalAcceptanceStatus = state.status === 'current_pass' ? 'accepted_success' : 'open_or_unaccepted';
    const transitionLegality =
      awaitingUserAcceptance &&
      attemptDecision === 'pass' &&
      attemptBlockingReasons.length === 0 &&
      state.status === 'current_pass' &&
      state.validity === 'current'
        ? 'legal_transition'
        : 'illegal_or_unproven_transition';
    if (finalAcceptanceStatus !== 'accepted_success' || transitionLegality !== 'legal_transition') {
      rowIssues.push(
        blocking(
          'final_acceptance_trace_not_accepted',
          `${row.id} final acceptance is ${finalAcceptanceStatus}/${transitionLegality}`,
          [row.id]
        )
      );
    }
    rows[row.id] = {
      traceId: row.id,
      originalConfirmationStatus,
      preCloseoutRuntimeStatus: originalConfirmationStatus === 'PASS' ? 'already_terminal_before_closeout' : 'open_before_closeout',
      postCloseoutRuntimeStatus: state.status ?? 'no_controlled_record',
      finalAcceptanceStatus,
      transitionLegality,
      evidenceRefs: state.evidenceRefs ?? [],
      commandRefs: state.commandRefs ?? [],
      artifactRefs: state.artifactRefs ?? [],
      runId: state.runId ?? '',
      closeoutAttemptId: state.closeoutAttemptId ?? currentAttemptId,
      blockingReason:
        finalAcceptanceStatus === 'accepted_success' && transitionLegality === 'legal_transition'
          ? ''
          : state.reason || 'trace_not_current_pass_after_user_acceptance_request',
    };
  }

  const blockingIssues = [];
  if (applies && !requirementRecordState?.found) {
    blockingIssues.push(blocking('final_acceptance_requirement_record_missing', 'requirement-record.json is required for closeout review'));
  }
  if (applies && !awaitingUserAcceptance) {
    blockingIssues.push(
      blocking(
        'final_acceptance_user_acceptance_request_missing',
        'closeout-review requires awaiting_user_acceptance proof for the current attempt before user closeout confirmation'
      )
    );
  }
  if (applies && !currentAttemptId) {
    blockingIssues.push(blocking('final_acceptance_current_attempt_missing', 'closeout currentAttemptId is required'));
  }
  if (applies && attemptDecision !== 'pass') {
    blockingIssues.push(
      blocking('final_acceptance_attempt_not_passed', `current closeout attempt decision is ${attemptDecision || '<missing>'}`)
    );
  }
  if (applies && attemptBlockingReasons.length) {
    blockingIssues.push(
      blocking(
        'final_acceptance_attempt_has_blocking_reasons',
        `current closeout attempt still has blockers: ${attemptBlockingReasons.join(', ')}`
      )
    );
  }
  if (applies && allRequiredCommands.length === 0) {
    blockingIssues.push(
      blocking('final_acceptance_required_commands_missing', 'deliveryEvidence.requiredCommands[] is required for closeout review')
    );
  }
  if (applies && allRequiredCommands.length > 0 && currentAttemptCommands.length === 0) {
    blockingIssues.push(
      blocking(
        'final_acceptance_required_commands_current_attempt_missing',
        'no deliveryEvidence.requiredCommands[] entry is bound to the current closeout attempt'
      )
    );
  }
  if (applies && currentAttemptCommands.length > 0 && artifactBoundCommands.length !== currentAttemptCommands.length) {
    blockingIssues.push(
      blocking(
        'final_acceptance_required_commands_not_artifact_bound',
        `${artifactBoundCommands.length}/${currentAttemptCommands.length} current-attempt required commands have artifact-bound evidence`
      )
    );
  }
  if (applies) blockingIssues.push(...rowIssues);
  const ready = applies ? blockingIssues.length === 0 : false;
  return {
    applies,
    ready,
    status: ready ? 'final_acceptance_ready' : applies ? 'final_acceptance_ready=false' : 'not_applicable',
    recordClosed: record?.status === 'closed',
    awaitingUserAcceptance,
    acceptanceRequestProof,
    lastEventType: record?.lastEventType ?? '',
    lastAppliedEventId: record?.lastAppliedEventId ?? '',
    currentAttemptId,
    attemptDecision,
    attemptBlockingReasons,
    deliveryReadinessDiagnostic: deliveryReadiness ?? null,
    requiredCommandEvidence,
    blockingIssues,
    rows,
  };
}

function buildCloseoutDeliveryVerdict(input) {
  const { args, finalAcceptanceReview, closeoutGateMatrix, sourceProjectionDiagnostics, closeoutReportHash } = input;
  const applies = args.mode === 'closeout-review';
  const failedChecks = asArray(closeoutGateMatrix?.rows).filter((row) => !row.passed);
  const reportDecision = String(closeoutGateMatrix?.reportDecision ?? '').toLowerCase();
  const reportReady = closeoutGateMatrix?.reportFound === true && reportDecision === 'pass' && failedChecks.length === 0;
  const reasons = [];
  if (applies && !finalAcceptanceReview?.ready) reasons.push('finalAcceptanceReview_not_ready');
  if (applies && !closeoutGateMatrix?.reportFound) reasons.push('delivery_closeout_report_missing');
  if (applies && closeoutGateMatrix?.reportLoadError) reasons.push(`delivery_closeout_report_load_error:${closeoutGateMatrix.reportLoadError}`);
  if (applies && closeoutGateMatrix?.reportFound && reportDecision !== 'pass') {
    reasons.push(`delivery_closeout_report_decision_${reportDecision || 'missing'}`);
  }
  if (applies && failedChecks.length) {
    reasons.push(`delivery_closeout_report_failed_checks:${failedChecks.map((row) => row.id).join(',')}`);
  }
  const ready = applies && finalAcceptanceReview?.ready === true && reportReady;
  return {
    applies,
    ready,
    status: !applies ? 'not_applicable' : ready ? 'final_acceptance_ready' : 'final_acceptance_blocked',
    label: !applies ? 'not_applicable' : ready ? 'final_acceptance_ready' : 'final_acceptance_blocked',
    reasons,
    currentAttemptId: finalAcceptanceReview?.currentAttemptId ?? '',
    finalAcceptanceStatus: finalAcceptanceReview?.status ?? 'not_applicable',
    closeoutReportPath: closeoutGateMatrix?.reportPath ?? '',
    deliveryCloseoutReportHash: closeoutReportHash ?? null,
    closeoutReportDecision: closeoutGateMatrix?.reportDecision ?? '',
    closeoutCheckCount: closeoutGateMatrix?.totalCount ?? 0,
    closeoutFailedCheckCount: failedChecks.length,
    sourceProjectionGapCount: sourceProjectionDiagnostics?.unboundEvidenceCount ?? 0,
  };
}

function closeoutProjectionIdentity(outPath, recordId, closeoutAttemptId) {
  const canonicalPath = path.join(
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId || 'unrecorded',
    'confirmation',
    `closeout-confirmation-${closeoutAttemptId || 'unattempted'}.html`
  );
  const currentAliasPath = path.join(
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId || 'unrecorded',
    'confirmation',
    'closeout-confirmation-current.html'
  );
  const normalizedOut = normalizePathForReport(path.resolve(outPath));
  const normalizedCanonical = normalizePathForReport(path.resolve(canonicalPath));
  const normalizedAlias = normalizePathForReport(path.resolve(currentAliasPath));
  const outputRole =
    normalizedOut === normalizedCanonical
      ? 'canonical_attempt_projection'
      : normalizedOut === normalizedAlias
        ? 'current_alias_projection'
        : 'noncanonical_diagnostic_projection';
  return {
    schemaVersion: 'closeout-confirmation-projection/v1',
    closeoutAttemptId: closeoutAttemptId || '',
    canonicalPath: normalizePathForReport(canonicalPath),
    currentAliasPath: normalizePathForReport(currentAliasPath),
    renderedPath: normalizePathForReport(outPath),
    outputRole,
    preservesScopeConfirmation: true,
  };
}

function buildCloseoutConfirmInstruction(input) {
  return [
    '确认最终验收并关闭需求',
    `sourceDocumentHash=${input.sourceDocumentHash}`,
    `implementationConfirmationHash=${input.implementationConfirmationHash}`,
    `closeoutAttemptId=${input.closeoutAttemptId || ''}`,
    `closeoutConfirmationPageHash=${SELF_CLOSEOUT_PAGE_HASH_PLACEHOLDER}`,
    `deliveryCloseoutReportHash=${input.deliveryCloseoutReportHash || 'sha256:missing_delivery_closeout_report'}`,
  ].join('\n');
}

function scopeConfirmationPageHashForCloseout(requirementRecordState, confirmation) {
  const record = requirementRecordState?.record ?? {};
  return firstString(
    record.confirmationPageHash,
    asArray(record.confirmationHistory)
      .filter((item) => item && typeof item === 'object' && item.eventType === 'confirmation_recorded')
      .at(-1)?.confirmationPageHash,
    confirmation?.confirmationRender?.htmlHash
  );
}

function overflowText(ui, count) {
  if (count <= 0) return '';
  return ui.overflowPrefix === '+'
    ? `${ui.overflowPrefix}${count} ${ui.overflowSuffix}`
    : `${ui.overflowPrefix} ${count} ${ui.overflowSuffix}`;
}

function renderProgressDelta(progressDelta, reconfirmationState, ui) {
  const focusRows = progressDelta.reviewFocusIds.slice(0, 30).map((id) => {
    const status = progressDelta.idStatuses[id] ?? (
      progressDelta.affectedTraceRows.includes(id)
        ? { label: ui.progressStatus.affectedTrace, tone: 'blue', proofState: 'affected_trace' }
        : { label: ui.progressStatus.reviewFocus, tone: 'gold', proofState: 'review_focus' }
    );
    return [
      id,
      renderStatusBadge(status.label, status.tone),
      renderIdBadges(status.traceIds ?? (progressDelta.affectedTraceRows.includes(id) ? [id] : [])),
      status.proofState,
    ];
  });
  const diffRows = asArray(reconfirmationState?.diffSummary).map((item, index) => [
    item.id ?? `DIFF-${String(index + 1).padStart(3, '0')}`,
    item.summary ?? item.text ?? item.reason ?? JSON.stringify(item),
  ]);
  const historyRows = [
    [ui.staleTraceSummary, renderIdBadges(progressDelta.historicalPassedTraceRows.slice(0, 20)), overflowText(ui, progressDelta.historicalPassedTraceRows.length - 20)],
    [ui.affectedTraceCoveredIds, renderIdBadges(progressDelta.affectedTraceCoveredIds.slice(0, 20)), overflowText(ui, progressDelta.affectedTraceCoveredIds.length - 20)],
  ];
  const sourceProjectionGapRows = asArray(progressDelta.sourceProjectionGapEvidenceIds).map((id) => {
    const status = progressDelta.idStatuses[id] ?? {};
    return [
      id,
      renderStatusBadge('source_projection_gap', 'gold'),
      status.explanation ?? 'source projection diagnostic only; not closeout runtime missing evidence',
    ];
  });
  return `<section class="card progress-delta" id="progress-delta">
    <h2>${escapeHtml(ui.progressDelta)}</h2>
    <p class="section-lead">${escapeHtml(ui.progressLead)}</p>
    <div class="metric-grid">
      <div class="metric"><strong>${escapeHtml(progressDelta.counts.totalRequirementIds)}</strong><span>${escapeHtml(ui.totalRequirementIds)}</span></div>
      <div class="metric"><strong>${escapeHtml(progressDelta.counts.totalTraceRows)}</strong><span>${escapeHtml(ui.traceRowsLabel)}</span></div>
      <div class="metric warn"><strong>${escapeHtml(progressDelta.counts.newOrChangedIds)}</strong><span>${escapeHtml(ui.newOrChangedIds)}</span></div>
      <div class="metric"><strong>${escapeHtml(progressDelta.counts.currentAttemptProofValidIds)}</strong><span>${escapeHtml(ui.currentAttemptProofValid)}</span></div>
      <div class="metric warn"><strong>${escapeHtml(progressDelta.counts.staleProofIds)}</strong><span>${escapeHtml(ui.staleProofNeedsRecheck)}</span></div>
      <div class="metric danger"><strong>${escapeHtml(progressDelta.counts.missingEvidenceIds)}</strong><span>${escapeHtml(ui.missingCurrentEvidence)}</span></div>
      <div class="metric warn"><strong>${escapeHtml(progressDelta.counts.sourceProjectionGapEvidenceIds ?? 0)}</strong><span>source_projection_gap</span></div>
    </div>
    <div class="review-flow">
      <section class="review-step">
        <h3>${escapeHtml(ui.currentConfirmationChanges)}</h3>
        <p><strong>${escapeHtml(ui.currentEvidenceStatus)}：</strong>${escapeHtml(progressDelta.currentAttemptStatus)}</p>
        <p><strong>${escapeHtml(ui.suggestedContinueStart)}：</strong>${inlineCode(progressDelta.nextExecutionStart || ui.noPendingTrace)}</p>
        <p><strong>${escapeHtml(ui.affectedTrace)}：</strong>${renderIdBadges(progressDelta.affectedTraceRows)}</p>
        <p><strong>${escapeHtml(ui.affectedIds)}：</strong>${renderIdBadges(progressDelta.newIds)}</p>
        ${diffRows.length ? renderTable(['diffId', 'summary'], diffRows, { className: 'compact-map-table' }) : `<p class="empty-state">${escapeHtml(ui.noDiffSummary)}</p>`}
      </section>
      <section class="review-step">
        <h3>${escapeHtml(ui.reviewFocus)}</h3>
        <p class="muted">${escapeHtml(ui.reviewFocusNote)}</p>
        ${focusRows.length ? renderTable(['id', 'userStatus', 'traceRows', 'proofState'], focusRows, { className: 'compact-map-table' }) : `<p class="empty-state">${escapeHtml(ui.noReviewFocus)}</p>`}
      </section>
      <section class="review-step">
        <h3>${escapeHtml(ui.historicalEvidenceSummary)}</h3>
        ${renderTable(['summary', 'sample', 'overflow'], historyRows, { className: 'compact-map-table' })}
      </section>
      <section class="review-step">
        <h3>Source Projection Gap Overrides</h3>
        <p class="muted">These rows are source trace binding diagnostics, not closeout runtime missing evidence.</p>
        ${sourceProjectionGapRows.length
          ? renderTable(['Evidence', 'Diagnostic', 'Explanation'], sourceProjectionGapRows, { className: 'compact-map-table source-projection-gap-table' })
          : '<p class="empty-state">No source projection gap override applied.</p>'}
      </section>
    </div>
  </section>`;
}

function renderTraceMatrix(traceRows, traceExecutionState = null) {
  const rows = traceRows.map((row) => [
    row.id,
    renderIdBadges(row.covers),
    renderIdBadges(row.taskRefs),
    renderIdBadges(row.evidenceRefs),
    renderIdBadges(traceContractValidationCommandRefs(row)),
    renderIdBadges(traceDeliveryEvidenceCommandRefs(row)),
    renderIdBadges(row.acceptanceRefs),
    renderIdBadges(row.sequenceViewRefs ?? row.diagramRefs),
    renderIdBadges(row.artifactRefs),
    row.status ?? 'PENDING',
    traceExecutionState?.rows?.[row.id]?.status ?? 'no_controlled_record',
    traceExecutionState?.rows?.[row.id]?.validity ?? 'unavailable',
    renderTraceExecutionEvidence(traceExecutionState?.rows?.[row.id]),
    row.blockingReason ?? '',
  ]);
  return `<section class="card" id="trace-matrix">
    <h2>Trace Matrix</h2>
    <p class="section-lead">契约状态来自源文档 traceRows[]；受控执行状态只读来自 requirement-record.json。历史 PASS 只有同时匹配当前 sourceDocumentHash、implementationConfirmationHash、architectureConfirmationHash 和 currentAttemptId 时，才显示为 current_pass。</p>
    <p class="section-lead">Projection policy: source traceRows[].status is the confirmed contract projection; runtime closure is the controlled execution projection. Source PENDING does not override a current runtime closure, and runtime closure does not rewrite confirmed source traceRows.</p>
    ${traceExecutionState ? renderTable(
      ['字段', '值'],
      [
        ['requirementRecordPath', traceExecutionState.recordPath],
        ['recordFound', String(traceExecutionState.recordFound)],
        ['currentAttemptId', traceExecutionState.currentAttemptId || ''],
        ['sourceTraceRowsStatusRole', traceExecutionState.statusProjectionPolicy?.sourceTraceRowsStatusRole || ''],
        ['runtimeClosureStatusRole', traceExecutionState.statusProjectionPolicy?.runtimeClosureStatusRole || ''],
        ['currentPass', String(traceExecutionState.counts.currentPass)],
        ['currentEvidenceRecorded', String(traceExecutionState.counts.currentEvidenceRecorded)],
        ['stale', String(traceExecutionState.counts.stale)],
        ['unavailable', String(traceExecutionState.counts.unavailable)],
      ],
      { className: 'compact-map-table' }
    ) : ''}
    ${renderTable(['Trace', 'Covers', 'Tasks', 'Evidence', 'Contract Validation Commands', 'Delivery Evidence Commands', 'Acceptance/E2E', 'Diagrams', 'Artifacts', 'Contract Status', 'Controlled Execution Status', 'Current Validity', 'Execution Evidence / Reason', 'Blocking Reason'], rows)}
  </section>`;
}

function renderCurrentTarget(map, artifactPlan, profile) {
  const artifactPlanScriptRows = artifactPlan
    .filter((item) => /script|hook|gate/iu.test(`${item.artifactType} ${item.path}`))
    .map((item) => [
      item.path,
      item.currentFunction,
      item.ownerModel,
      String(item.canAffectControlFlow),
      item.sourceOfTruthRole === 'projection' || item.sourceOfTruthRole === 'evidence' ? 'yes' : 'no',
      String(item.userApprovalRequired),
      item.fallback,
    ]);
  const renderOptionalTable = (headers, rows, className = '') =>
    rows.length
      ? renderTable(headers, rows, { className })
      : '<p class="empty-state">源文档未提供该表数据。</p>';
  const currentSummary = asArray(map.currentSummary);
  const targetSummary = asArray(map.targetSummary);
  const metrics = asArray(map.metrics);
  const compactList = (rows, className) =>
    `<ul class="list ${className}">${rows
      .map((row) => `<li><strong>${escapeHtml(row.title ?? row.name ?? '')}</strong><span>${inlineCode(row.detail ?? row.text ?? row.description ?? '')}</span></li>`)
      .join('')}</ul>`;
  const tagForRole = (role) => {
    if (/唯一|控制|准出|索引/u.test(role)) return 'green';
    if (/生命周期|数据|证据/u.test(role)) return 'blue';
    return 'gold';
  };
  const mapCell = (cell, index, tagColumnIndex) => {
    if (index === tagColumnIndex) {
      return `<span class="tag ${tagForRole(String(cell))}">${escapeHtml(cell)}</span>`;
    }
    if (/(?:^_|^scripts\/|^_bmad\/|\.json|\.jsonl|\.md|\.ts|\[\]|\(\)|<[^>]+>)/u.test(String(cell))) {
      return `<code>${escapeHtml(cell)}</code>`;
    }
    return inlineCode(cell);
  };
  const renderTaggedTable = (headers, rows, tagColumnIndex) =>
    renderTable(
      headers,
      rows.map((row) => row.map((cell, index) => mapCell(cell, index, tagColumnIndex))),
      { className: 'compact-map-table' }
    );
  const renderTargetRealization = () => {
    const realizationRows = asArray(map.targetRealization);
    if (!realizationRows.length) return '';
    const summary = map.targetRealizationSummary ?? {};
    const rows = realizationRows.map((row) => [
      row.id,
      inlineCode(row.source_target ?? ''),
      inlineCode(row.runtime_evidence ?? ''),
      renderStatusBadge(row.verification_status ?? 'not_evaluable', statusBadgeTone(row.verification_status ?? 'not_evaluable')),
      renderIdBadges(row.evidence_refs),
      renderStatusBadge(String(row.legal_transition ?? false), statusBadgeTone(row.legal_transition)),
    ]);
    return `<h3>目标态实现核实层</h3>
    <p class="section-lead">closeout-review 模式下，本层从受控 runtime evidence / trace / command / closeout gate 投影目标态是否达成；不会仅凭 source 文案标记 achieved。</p>
    <div class="metric-strip target-realization-summary">
      <div class="metric compact green"><strong>${escapeHtml(summary.achieved ?? 0)}</strong><span>achieved</span></div>
      <div class="metric compact warn"><strong>${escapeHtml(summary.partially_achieved ?? 0)}</strong><span>partially_achieved</span></div>
      <div class="metric compact danger"><strong>${escapeHtml(summary.not_achieved ?? 0)}</strong><span>not_achieved</span></div>
      <div class="metric compact warn"><strong>${escapeHtml(summary.not_evaluable ?? 0)}</strong><span>not_evaluable</span></div>
    </div>
    ${renderTable(
      ['ID', 'source_target', 'runtime_evidence', 'verification_status', 'evidence_refs', 'legal_transition'],
      rows,
      { className: 'compact-map-table target-realization-table' }
    )}`;
  };
  const renderDiffDeck = (rows) =>
    rows.length
      ? `<div class="diff-deck compact-diff-deck">${rows
      .map(
        (row) => `<article class="diff-card">
          <div class="diff-card-title"><strong>${escapeHtml(row.dimension ?? '')}</strong><span>${escapeHtml(row.action ?? '')}</span></div>
          <div class="diff-compare">
            <div class="diff-side diff-minus"><b>当前</b><p>${inlineCode(row.currentState ?? '')}</p></div>
            <div class="diff-side diff-plus"><b>目标</b><p>${inlineCode(row.targetState ?? '')}</p></div>
          </div>
        </article>`
      )
      .join('')}</div>`
      : '<p class="empty-state">源文档未提供 diffRows[]。</p>';
  const sourceRows = asArray(map.sourceReferences);
  const targetFlowRows = asArray(map.targetFlow);
  const mentalModels = asArray(map.mentalModels);
  const renderMentalModels = () => {
    if (!viewPackEnabled(profile, 'sixMentalModels')) return '';
    return (
    mentalModels.length
      ? `<h3>六个心智模型</h3><div class="model-grid">${mentalModels
      .map(
        (row) =>
          `<div class="model-card"><h3>${escapeHtml(row.name ?? '')}</h3><p class="question">${escapeHtml(
            row.question ?? ''
          )}</p><span class="status">${escapeHtml(row.status ?? '')}</span></div>`
      )
      .join('')}</div>`
      : '<h3>六个心智模型</h3><p class="empty-state">源文档已启用 sixMentalModels view pack，但未提供 mentalModels[]。</p>'
    );
  };
  const renderMentalModelSequence = () => {
    if (!viewPackEnabled(profile, 'sixMentalModels')) return '';
    const lanes = asArray(map.mentalModelSequence?.lanes);
    if (!lanes.length) {
      return '<h3>六个心智模型时序图</h3><p class="empty-state">源文档已启用 sixMentalModels view pack，但未提供 mentalModelSequence.lanes[]。</p>';
    }
    return `<h3>六个心智模型时序图</h3>
    <div class="sequence" role="img" aria-label="六个心智模型时序图">
      <div class="lanes">${lanes
        .map(
          (lane, index) => `<div class="lane">
            <h3>${escapeHtml(lane.title ?? lane.name ?? `${index + 1}`)}</h3>
            ${asArray(lane.events)
              .map(
                (event) =>
                  `<div class="event ${attr(event.tone ?? '')}"><strong>${escapeHtml(
                    event.title ?? event.name ?? ''
                  )}</strong><small>${escapeHtml(event.meta ?? event.eventType ?? '')}</small></div>`
              )
              .join('')}
          </div>`
        )
        .join('')}</div>
    </div>
    <div class="legend">${asArray(map.mentalModelSequence?.legend)
      .map((item) => `<span class="tag ${attr(item.tone ?? item.color ?? 'gold')}">${escapeHtml(item.text ?? item.label ?? item)}</span>`)
      .join('')}</div>`;
  };
  const renderDoubleGate = () => {
    if (!viewPackEnabled(profile, 'doubleGates')) return '';
    const gates = asArray(map.doubleGates?.gates);
    const envelopeRules = asArray(map.doubleGates?.envelopeRules);
    if (!gates.length && !envelopeRules.length) {
      return '<h3>双唯一门禁与 typed envelope</h3><p class="empty-state">源文档已启用 doubleGates view pack，但未提供 doubleGates.gates[] 或 doubleGates.envelopeRules[]。</p>';
    }
    return `<h3>双唯一门禁与 typed envelope</h3><div class="split current-target-split">
      <article>
        <h3>双唯一门禁字段</h3>${renderProfileTable('doubleGateFields', gates)}</article>
      <article>
        <h3>typed envelope 规则</h3>${renderProfileTable('envelopeRules', envelopeRules)}</article>
    </div>`;
  };
  return `<section class="card current-target-map" id="current-target">
    <h2>现状 vs 目标态对比区</h2>
    <p class="section-lead">${escapeHtml(map.introduction ?? '本区只渲染源文档 implementationConfirmation.currentTargetMap 中提供的结构化内容；渲染脚本不会内置项目级治理结论。')}</p>
    <aside class="source-box"><h3>来源</h3><div class="source-list">${sourceRows.length
      ? sourceRows.map((row) => `<code>${escapeHtml(row.path ?? '')}</code><span>${escapeHtml(row.description ?? '')}</span>`).join('')
      : '<span class="empty-state">源文档未提供 sourceReferences[]。</span>'}</div><p class="footnote">该确认页是静态可视化和实例投影，不是新的事实源。</p></aside>
    <div class="metric-strip">${metrics
      .map((row) => `<div class="metric compact"><strong>${escapeHtml(row.value ?? '')}</strong><span>${escapeHtml(row.label ?? '')}</span></div>`)
      .join('')}</div>
    <div class="split current-target-split">
      <article>
        <div class="panel-title"><h3>${escapeHtml(map.currentTitle ?? '当前现状')}</h3><span class="tag red">current</span></div>
        ${compactList(currentSummary, 'current')}
      </article>
      <article>
        <div class="panel-title"><h3>${escapeHtml(map.targetTitle ?? '目标态')}</h3><span class="tag green">target</span></div>
        ${compactList(targetSummary, 'target')}
      </article>
    </div>
    <h3>核心差异</h3>${renderDiffDeck(asArray(map.diffRows))}
    ${renderTargetRealization()}
    <div class="target-flow">${targetFlowRows.length
      ? targetFlowRows.map((row) => `<div class="flow-step"><strong>${escapeHtml(row.stepTitle ?? '')}</strong><span>${inlineCode(row.description ?? '')}</span></div>`).join('')
      : '<p class="empty-state">源文档未提供 targetFlow[]。</p>'}</div>
    ${renderMentalModels()}
    ${renderMentalModelSequence()}
    ${renderDoubleGate()}
    <p class="callout">${escapeHtml(map.artifactIndexClarification ?? '')}</p>
    <p class="callout">${escapeHtml(map.sampleRoutesClarification ?? '')}</p>
    <h3>${CURRENT_TARGET_TABLE_PROFILES.canonicalArtifacts.title}</h3>${renderProfileTable('canonicalArtifacts', map.canonicalArtifacts)}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.pathRegistry.title}</h3>${renderProfileTable('pathRegistry', map.pathRegistry)}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.existingArtifacts.title}</h3>${renderProfileTable('existingArtifacts', map.existingArtifacts)}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.scriptConvergence.title}</h3>${renderProfileTable('scriptConvergence', map.scriptConvergence)}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.hookConvergence.title}</h3>${renderProfileTable('hookConvergence', map.hookConvergence)}
    <div class="split current-target-split">
      <article>
        <h3>目标 no-hook 等价与边界</h3>${asArray(map.noHookTargets).length ? compactList(asArray(map.noHookTargets), 'target') : '<p class="empty-state">源文档未提供 noHookTargets[]。</p>'}
      </article>
      <article>
        <h3>${CURRENT_TARGET_TABLE_PROFILES.retainedScriptTypes.title}</h3>${renderProfileTable('retainedScriptTypes', map.retainedScriptTypes)}
      </article>
    </div>
    <h3>${CURRENT_TARGET_TABLE_PROFILES.requirementGeneration.title}</h3>${renderProfileTable('requirementGeneration', map.requirementGeneration)}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.facts.title}</h3>${renderProfileTable('facts', map.facts)}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.process.title}</h3>${renderProfileTable('process', map.process)}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.artifactPaths.title}</h3>${renderProfileTable('artifactPaths', map.artifactPaths)}
    <h3>脚本 / hooks 收敛</h3>${renderOptionalTable(
      ['当前脚本路径', '当前功能', '目标 ownerModel', '是否能写控制状态', '是否只是 evidence/projection', '是否需要用户批准', 'fallback'],
      artifactPlanScriptRows
    )}
    <h3>${CURRENT_TARGET_TABLE_PROFILES.architecture.title}</h3>${renderProfileTable('architecture', map.architecture)}
  </section>`;
}

function tagTone(value) {
  const text = String(value ?? '').toLowerCase();
  if (/否|不能|阻断|风险|fail|block|red|no_|not_|invalid|missing/u.test(text)) return 'red';
  if (/唯一|控制|准出|pass|green|ready|closed|delivery_closeout_gate/u.test(text)) return 'green';
  if (/证据|projection|read|derived|context|evidence|blue|lifecycle|index/u.test(text)) return 'blue';
  return 'gold';
}

function renderProfileCell(value, fieldDef) {
  const text = Array.isArray(value) ? value.join('、') : String(value ?? '');
  if (fieldDef.cell === 'code') {
    if (!text) return '<span class="muted">无</span>';
    return text
      .split(/\s*;\s*/u)
      .filter(Boolean)
      .map((part) => `<code>${escapeHtml(part)}</code>`)
      .join('<br />');
  }
  if (fieldDef.cell === 'tag') {
    if (!text) return '<span class="muted">无</span>';
    return `<span class="tag ${tagTone(text)}">${escapeHtml(text)}</span>`;
  }
  if (fieldDef.cell === 'list') {
    const items = Array.isArray(value) ? value : String(value ?? '').split(/\s*[,;]\s*/u).filter(Boolean);
    return items.length ? items.map((item) => `<span class="id-badge">${escapeHtml(item)}</span>`).join(' ') : '<span class="muted">无</span>';
  }
  return inlineCode(text);
}

function renderProfileTable(profileKey, rows, options = {}) {
  const profile = CURRENT_TARGET_TABLE_PROFILES[profileKey];
  if (!profile) {
    return `<p class="empty-state">Unknown table profile: ${escapeHtml(profileKey)}</p>`;
  }
  const safeRows = asArray(rows);
  if (!safeRows.length) {
    return `<p class="empty-state">${escapeHtml(profile.emptyStateText)}</p>`;
  }
  const headers = profile.fields.map((field) => field.header);
  const widths = profile.fields.map((field) => field.width ?? '');
  const renderedRows = safeRows.map((row) => profile.fields.map((field) => renderProfileCell(row[field.key], field)));
  return renderTable(headers, renderedRows, {
    className: `${profile.className} ${options.className ?? ''}`.trim(),
    widths,
  });
}

function buildTargetRealizationProjection(input) {
  const { args, currentTargetMap, finalAcceptanceReview, closeoutGateMatrix, traceExecutionState } = input;
  if (args.mode !== 'closeout-review') return currentTargetMap;
  const traceRows = Object.values(finalAcceptanceReview?.rows ?? {});
  const acceptedTraceCount = traceRows.filter(
    (row) => row.finalAcceptanceStatus === 'accepted_success' && row.transitionLegality === 'legal_transition'
  ).length;
  const runtimeReady =
    finalAcceptanceReview?.ready === true &&
    closeoutGateMatrix?.reportFound === true &&
    String(closeoutGateMatrix?.reportDecision ?? '').toLowerCase() === 'pass';
  const rows = [
    ...asArray(currentTargetMap.diffRows).map((row, index) => ({
      source: 'currentTargetMap.diffRows',
      id: row.id ?? `DIFF-${String(index + 1).padStart(3, '0')}`,
      source_target: row.targetState ?? row.action ?? '',
    })),
    ...asArray(currentTargetMap.process).map((row, index) => ({
      source: 'currentTargetMap.process',
      id: row.id ?? `PROCESS-${String(index + 1).padStart(3, '0')}`,
      source_target: row.targetState ?? row.phase ?? '',
    })),
  ];
  const evidenceRefs = unique(
    traceRows.flatMap((row) => [
      ...stringList(row.evidenceRefs),
      ...stringList(row.commandRefs),
      ...stringList(row.artifactRefs),
    ])
  );
  const targetRealization = rows.map((row) => {
    const verificationStatus =
      runtimeReady && acceptedTraceCount > 0
        ? 'achieved'
        : traceExecutionState?.recordFound
          ? 'not_achieved'
          : 'not_evaluable';
    return {
      id: row.id,
      source: row.source,
      source_target: row.source_target,
      runtime_evidence:
        verificationStatus === 'achieved'
          ? `finalAcceptanceReview.ready=true; acceptedTraceRows=${acceptedTraceCount}; closeoutDecision=${closeoutGateMatrix?.reportDecision ?? ''}`
          : traceExecutionState?.recordFound
            ? 'runtime evidence exists but final acceptance is not ready'
            : 'no controlled runtime record available',
      verification_status: verificationStatus,
      evidence_refs: evidenceRefs,
      legal_transition: verificationStatus === 'achieved',
    };
  });
  const targetRealizationSummary = targetRealization.reduce(
    (acc, row) => {
      acc[row.verification_status] = (acc[row.verification_status] ?? 0) + 1;
      return acc;
    },
    { achieved: 0, partially_achieved: 0, not_achieved: 0, not_evaluable: 0 }
  );
  return {
    ...currentTargetMap,
    targetRealization,
    targetRealizationSummary,
  };
}

function renderArtifactPlan(artifactPlan) {
  const groups = classifyArtifactGroups(artifactPlan);
  const headers = [
    'artifactId',
    'path',
    'artifactType',
    'sourceOfTruthRole',
    'ownerModel',
    'producer',
    'consumer',
    'inputArtifacts',
    'outputArtifacts',
    'recordEventTypes',
    'canAffectControlFlow',
    'userApprovalRequired',
    'retention',
    'cleanupPolicy',
    'orphanRisk',
    'containsSensitiveData',
    'trainingDataEligible',
  ];
  function rows(items) {
    return items.map((item) => [
      `<span class="artifact-row" data-artifact-group="${attr(item.group)}" data-new-artifact="${isNewArtifact(item) ? 'true' : 'false'}" data-control-artifact="${item.canAffectControlFlow || item.sourceOfTruthRole === 'control' ? 'true' : 'false'}">${escapeHtml(
        item.artifactId
      )}</span>`,
      item.path,
      item.artifactType,
      item.sourceOfTruthRole,
      item.ownerModel,
      item.producer,
      item.consumer,
      renderIdBadges(item.inputArtifacts),
      renderIdBadges(item.outputArtifacts),
      renderIdBadges(item.recordEventTypes),
      String(item.canAffectControlFlow),
      String(item.userApprovalRequired),
      item.retention,
      item.cleanupPolicy,
      item.orphanRisk,
      String(item.containsSensitiveData),
      String(item.trainingDataEligible),
    ]);
  }
  return `<section class="card" id="artifact-plan">
    <h2>工件与自动化计划视图</h2>
    <p>风险高亮：canAffectControlFlow=true、sourceOfTruthRole=control、userApprovalRequired=true、orphanRisk=high、trainingDataEligible=true、containsSensitiveData=true、retention=long_lived。</p>
    ${Object.entries(groups)
      .map(
        ([group, items]) => {
          const body = items.length
            ? renderTable(headers, rows(items), { className: 'artifact-plan-table' })
            : `<p class="empty-state">本次无 ${escapeHtml(group)} 工件。</p>`;
          return `<div class="artifact-group-section ${items.length ? '' : 'empty'}" data-artifact-group-section data-empty-group="${items.length ? 'false' : 'true'}"><h3>${escapeHtml(group)}</h3>${body}</div>`;
        }
      )
      .join('')}
  </section>`;
}

function renderTargetModificationPaths(targetModificationPaths) {
  const rows = targetModificationPaths.map((item) => [
    item.id,
    item.path,
    item.coverageRole || item.changeType || 'unspecified',
    item.intent || '',
    item.ownerModel || '',
    renderIdBadges(item.requirementRefs),
    renderIdBadges(item.traceRefs),
    renderIdBadges(item.evidenceRefs),
    renderIdBadges(item.artifactRefs),
    String(item.requiresReconfirmationOnChange),
    item.sourceSection,
  ]);
  return `<section class="card" id="target-modification-paths">
    <h2>目标修改路径清单</h2>
    <p class="section-lead">本区展示用户确认后 agent 预计会修改、新增或生成的 repo 路径。它回答“会动哪些文件/脚本/测试/配置”，不能被工件计划或现状/目标态对比替代。</p>
    ${
      rows.length
        ? renderTable(
          ['ID', '路径', '修改类型', '意图', 'ownerModel', '需求', 'Trace', 'Evidence', 'Artifacts', '越界需重新确认', '来源字段'],
          rows,
          { className: 'target-modification-paths-table' }
        )
        : '<p class="empty-state">源文档未提供 targetModificationPaths[]。</p>'
    }
  </section>`;
}

function renderAiTddContractManifestCoverage(coverage) {
  const sections = coverage?.sections ?? {};
  const sectionLabels = [
    ['errorCaseCoverage', 'Error cases'],
    ['commandTargetCollection', 'Command targets'],
    ['traceClosureAssertions', 'Trace closure'],
    ['currentTargetMap', 'Current/target map'],
    ['targetModificationPathCoverage', 'Target modification path coverage'],
    ['canonicalSurfaceReconciliation', 'Canonical surfaces'],
    ['legacyDenial', 'Legacy denial'],
    ['closeoutProof', 'Closeout proof'],
    ['evidenceTrustStates', 'Evidence trust'],
  ];
  const summaryRows = sectionLabels.map(([key, label]) => {
    const section = sections[key] ?? {};
    return [
      label,
      renderStatusBadge(section.ready ? 'pass' : 'blocked', section.ready ? 'green' : 'red'),
      String(asArray(section.rows).length),
      String(asArray(section.missing).length),
    ];
  });
  const detailRows = sectionLabels.flatMap(([key, label]) =>
    asArray(sections[key]?.rows).map((row) => [
      label,
      row.id || row.pathOrField || '',
      renderIdBadges([
        ...stringList(row.linkedNegIds),
        ...stringList(row.linkedFailurePathIds),
        ...stringList(row.linkedEvidenceIds),
        ...stringList(row.evidenceRefs),
        ...stringList(row.traceRefs),
        ...stringList(row.commandRefs),
        ...stringList(row.acceptanceRefs),
        ...stringList(row.artifactRefs),
      ]),
      stringList(row.missing).join(', ') || 'pass',
    ])
  );
  return `<section class="card" id="ai-tdd-contract-manifest">
    <h2>AI-TDD 契约执行清单</h2>
    <p class="section-lead">本区展示 implementation readiness / delivery verification / closeout 共享的契约完整性标准。确认页必须能看到这些清单；缺失时 confirmability 会被阻断。</p>
    ${renderTable(['Section', '状态', 'Rows', 'Missing'], summaryRows, { className: 'compact-map-table' })}
    ${
      detailRows.length
        ? renderTable(['Section', 'ID/Surface', 'Refs', 'Missing'], detailRows, { className: 'compact-map-table' })
        : '<p class="empty-state">源文档未提供 AI-TDD 契约执行清单可投影内容。</p>'
    }
  </section>`;
}

function renderControlledIngestWriterRegistry(registry) {
  const rows = asArray(registry?.rows);
  const coverage = registry?.coverage ?? {};
  const headers = [
    'writerId',
    'scriptPath',
    'scriptContentHash',
    'ownerModel',
    'allowedWriteApis',
    'allowedPaths',
    'allowedEventTypes',
    'payloadContractRefs',
    'writesControlFields',
    'receiptPath',
    'beforeAfterHashRequired',
    'canModifyWriterRegistry',
    'registryHash',
    'architectureConfirmationHash',
  ];
  const bodyRows = rows.map((item) => [
    item.writerId,
    item.scriptPath,
    item.scriptContentHash,
    item.ownerModel,
    renderIdBadges(item.allowedWriteApis),
    item.allowedPaths.map((allowedPath) => `<code>${escapeHtml(allowedPath)}</code>`).join('<br/>'),
    renderIdBadges(item.allowedEventTypes),
    renderIdBadges(item.payloadContractRefs),
    renderIdBadges(item.writesControlFields),
    item.receiptPath,
    String(item.beforeAfterHashRequired),
    String(item.canModifyWriterRegistry),
    item.registryHash,
    item.architectureConfirmationHash,
  ]);
  return `<section class="card" id="controlled-ingest-writers">
    <h2>Controlled Ingest Writer Registry</h2>
    <p class="section-lead">本区只读取源文档 <code>implementationConfirmation.controlledIngestWriterRegistry[]</code>。它是 controlled ingest 写入权限的唯一机器可读权威；脚本路径、旧约定、fixture 或 renderer hardcode 不能授权控制写入。</p>
    <div class="metric-grid">
      <div class="metric"><strong>${rows.length}</strong><span>registered writers</span></div>
      <div class="metric ${asArray(coverage.uncoveredEventTypes).length ? 'danger' : ''}"><strong>${asArray(coverage.uncoveredEventTypes).length}</strong><span>uncovered event types</span></div>
    </div>
    ${
      rows.length
        ? renderTable(headers, bodyRows, { className: 'controlled-ingest-writer-table' })
        : '<p class="empty-state">源文档未提供 controlledIngestWriterRegistry[]。</p>'
    }
  </section>`;
}

function isNewArtifact(item) {
  if (/^code$/iu.test(String(item.artifactType)) || item.sourceOfTruthRole === 'implementation') return false;
  if (['confirmation', 'executionEvidence', 'scripts', 'hooks'].includes(String(item.group))) return true;
  if (/confirmation|runtime\/requirements|artifact-index|render-report|summary/iu.test(String(item.path))) return true;
  if (/rendered|reported|created|implementation_delta|hook_receipt/iu.test(stringList(item.recordEventTypes).join(' '))) return true;
  return false;
}

function renderArchitectureImpact(confirmation) {
  const impacts = asArray(confirmation.architectureImpacts);
  const rows = impacts.length
    ? impacts.map((item) => [
        item.component,
        item.currentState,
        item.targetState,
        item.impactType,
        item.risk,
        item.requiredDecision,
        renderIdBadges(item.linkedRequirements),
        renderIdBadges(item.linkedEvidence),
        item.ownerModel,
      ])
    : [];
  return `<section class="card" id="architecture-impact">
    <h2>架构影响视图</h2>
    ${rows.length ? renderTable(
      ['component', 'currentState', 'targetState', 'impactType', 'risk', 'requiredDecision', 'linkedRequirements', 'linkedEvidence', 'ownerModel'],
      rows
    ) : '<p class="empty-state">源文档未提供 architectureImpacts[]。</p>'}
  </section>`;
}

function renderEntryFlowView(entryFlow, confirmation, sourcePath) {
  let rows;
  if (entryFlow === 'bugfix') {
    rows = [
      ['bug symptom', confirmation.bugSymptom ?? '未提供'],
      ['reproduction path', confirmation.reproductionPath ?? '未提供'],
      ['root cause', confirmation.rootCause ?? '未提供'],
      ['fix boundary', confirmation.fixBoundary ?? '未提供'],
      ['regression assertions', renderIdBadges(asArray(confirmation.notDone).map((item) => item.id))],
      ['excluded tests policy', confirmation.excludedTestsPolicy ?? '未提供'],
    ];
  } else if (entryFlow === 'standalone_tasks') {
    rows = [
      ['source TASKS path', sourcePath],
      ['task list provenance', confirmation.taskListProvenance ?? '未提供'],
      ['missing acceptance criteria', confirmation.missingAcceptanceCriteria ?? '必须表现为 blocking issues'],
      ['required commands', renderIdBadges(asArray(confirmation.requiredCommands).map((item) => item.id ?? item))],
      ['conversion to implementationConfirmation status', confirmation.status ?? '未知'],
    ];
  } else {
    rows = [
      ['PRD lineage', confirmation.prdLineage ?? '未提供'],
      ['architecture lineage', confirmation.architectureLineage ?? '未提供'],
      ['epics coverage', confirmation.epicsCoverage ?? '未提供'],
      ['story subset contract', confirmation.storySubsetContract ?? '未提供'],
      ['upstreamRequirementIds', renderIdBadges(asArray(confirmation.must).flatMap((item) => stringList(item.upstreamRequirementIds)))],
      ['story-prd alignment status', confirmation.storyPrdAlignmentStatus ?? '未提供'],
    ];
  }
  return `<section class="card" id="entry-flow">
    <h2>EntryFlow 视图</h2>
    ${renderTable(['字段', '值'], rows)}
  </section>`;
}

function renderScoringDashboardSft(confirmation) {
  const policy = confirmation.scoringDashboardSft ?? {};
  const rows = [
    ['score required', policy.scoreRequired === undefined ? '未提供' : policy.scoreRequired ? '是' : '否'],
    ['scoring policy hash', policy.scoringPolicyHash ?? '未提供'],
    ['score materialization gate', policy.scoreMaterializationGate ?? '未提供'],
    ['score evaluation gate', policy.scoreEvaluationGate ?? '未提供'],
    ['dashboard readonly', policy.dashboardReadonly === undefined ? '未提供' : policy.dashboardReadonly ? '是' : '否'],
    ['SFT eligible', policy.sftEligible === undefined ? '未提供' : policy.sftEligible ? '是' : '否'],
    [
      'eval/holdout/redaction/contamination required',
      policy.evalHoldoutRedactionContaminationRequired === undefined
        ? '未提供'
        : policy.evalHoldoutRedactionContaminationRequired
          ? '是'
          : '否',
    ],
    ['为什么不能反向驱动 closeout', policy.noReverseCloseoutReason ?? '未提供'],
  ];
  return `<section class="card" id="scoring-dashboard-sft">
    <h2>评分 / Dashboard / SFT 视图</h2>
    ${renderTable(['字段', '值'], rows)}
  </section>`;
}

function renderReconfirmationPanel(reconfirmationState) {
  if (!reconfirmationState?.required) return '';
  const rationale = reconfirmationState.persuasiveRationale ?? {};
  const evidenceBundle = reconfirmationState.evidenceBundle ?? {};
  const evidenceRows = asArray(evidenceBundle.items).map((item, index) => [
    item.id ?? `RCEVD-${String(index + 1).padStart(3, '0')}`,
    item.kind ?? 'evidence',
    item.title ?? '未命名证据',
    item.summary ?? '',
    renderIdBadges([...(stringList(item.sourceRefs)), ...(stringList(item.proofRefs))]),
  ]);
  const rows = [
    ['reasonCode', reconfirmationState.reasonCode ?? reconfirmationState.reason ?? 'reconfirmation_required'],
    ['userFacingSummary', reconfirmationState.userFacingSummary ?? '未提供'],
    ['whyReconfirmNow', rationale.whyReconfirmNow ?? '未提供'],
    ['riskIfSkipped', rationale.riskIfSkipped ?? '未提供'],
    ['whyEvidenceIsSufficient', rationale.whyEvidenceIsSufficient ?? '未提供'],
    ['evidenceSufficiency', evidenceBundle.sufficiencyVerdict ?? '未提供'],
    ['previousSourceDocumentHash', reconfirmationState.previousSourceDocumentHash ?? '未提供'],
    ['currentSourceDocumentHash', reconfirmationState.currentSourceDocumentHash ?? '未提供'],
    ['previousImplementationConfirmationHash', reconfirmationState.previousImplementationConfirmationHash ?? '未提供'],
    ['currentImplementationConfirmationHash', reconfirmationState.currentImplementationConfirmationHash ?? '未提供'],
    ['impactedIds', renderIdBadges(reconfirmationState.impactedIds)],
    ['impactedTraceRows', renderIdBadges(reconfirmationState.impactedTraceRows)],
    ['impactedArtifacts', stringList(reconfirmationState.impactedArtifacts).map(escapeHtml).join('<br/>')],
    ['impactedGatesOrCommands', stringList(reconfirmationState.impactedGatesOrCommands).map(escapeHtml).join('<br/>')],
    ['allowedUserActions', stringList(reconfirmationState.allowedUserActions).map(escapeHtml).join('<br/>')],
  ];
  const diffRows = asArray(reconfirmationState.diffSummary).map((item, index) => {
    if (typeof item === 'string') return [`DIFF-${String(index + 1).padStart(3, '0')}`, item];
    return [
      item.id ?? item.path ?? `DIFF-${String(index + 1).padStart(3, '0')}`,
      item.summary ?? item.text ?? item.change ?? JSON.stringify(item),
    ];
  });
  return `<section class="card" id="reconfirmation-request">
    <h2>${escapeHtml(reconfirmationState.userFacingTitle ?? '需要重新确认')}</h2>
    <p class="blocked">检测到确认边界语义漂移。用户只需要确认业务意图，不应手工修改 hash、status 或 confirmationHistory。</p>
    ${renderTable(['字段', '值'], rows)}
    <h3>重新确认证据</h3>
    ${evidenceRows.length ? renderTable(['证据 ID', '类型', '标题', '说明', '绑定引用'], evidenceRows) : '<p class="empty-state">源文档未提供 reconfirmationRequest.evidenceBundle.items[]。</p>'}
    <h3>差异摘要</h3>
    ${diffRows.length ? renderTable(['项', '变化'], diffRows) : '<p class="empty-state">源文档未提供 reconfirmationRequest.diffSummary[]。</p>'}
  </section>`;
}

function renderCoreDesignSummary(input) {
  const {
    ui,
    confirmation,
    traceRows,
    artifactPlan,
    blockingIssues,
    warnings,
    confirmability,
    deliveryReadiness,
    closeoutDeliveryVerdict,
  } = input;
  const primaryDelivery = closeoutDeliveryVerdict?.applies ? closeoutDeliveryVerdict : deliveryReadiness;
  const controlArtifacts = artifactPlan.filter(
    (item) => item.canAffectControlFlow || item.sourceOfTruthRole === 'control'
  ).length;
  const summary = confirmation.coreDesignSummary ?? {};
  const metrics = asArray(summary.metrics).map((item) =>
    Array.isArray(item) ? item : [item.value ?? item.count ?? '', item.label ?? item.text ?? '']
  );
  const principles = asArray(summary.principles).map((item) =>
    Array.isArray(item) ? item : [item.title ?? item.name ?? '', item.text ?? item.description ?? '']
  );
  return `<section class="card hero" id="core-design">
    <div class="hero-copy">
      <span class="eyebrow">${escapeHtml(ui.coreDesign)}</span>
      <h2>${escapeHtml(ui.coreDesign)}</h2>
      <p>${escapeHtml(summary.subtitle ?? ui.coreSubtitle)}</p>
    </div>
    <div class="metric-grid">
      ${metrics.map(([value, label]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('')}
      <div class="metric status-metric"><strong class="status-${confirmability}">${escapeHtml(confirmability)}</strong><span>${escapeHtml(ui.confirmability)}</span></div>
      <div class="metric status-metric ${primaryDelivery.ready ? 'green' : 'danger'}"><strong class="status-${primaryDelivery.ready ? 'confirmable' : 'blocked'}">${escapeHtml(primaryDelivery.label)}</strong><span>${escapeHtml(closeoutDeliveryVerdict?.applies ? 'Closeout Delivery Verdict' : ui.deliveryReadiness)}</span></div>
      <div class="metric"><strong>${traceRows.length}</strong><span>traceRows</span></div>
      <div class="metric"><strong>${artifactPlan.length}</strong><span>工件计划项</span></div>
      <div class="metric"><strong>${controlArtifacts}</strong><span>影响控制流的工件</span></div>
      <div class="metric danger"><strong>${blockingIssues.length}</strong><span>阻断项</span></div>
      <div class="metric warn"><strong>${warnings.length}</strong><span>警告</span></div>
    </div>
    ${principles.length ? `<div class="principle-grid">${principles
      .map(([title, text]) => `<article class="principle"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`)
      .join('')}</div>` : '<p class="empty-state">源文档未提供 coreDesignSummary.principles[]。</p>'}
  </section>`;
}

function renderDeliveryReadiness(deliveryReadiness, ui, closeoutDeliveryVerdict = null, sourceProjectionDiagnostics = null) {
  if (closeoutDeliveryVerdict?.applies) {
    const diagnosticRows = deliveryReadiness.reasons.length
      ? deliveryReadiness.reasons.map((reason, index) => [`${String(index + 1).padStart(2, '0')}`, reason])
      : [['--', 'preCloseoutDiagnostic has no blocking reason']];
    const sourceGapRows = asArray(sourceProjectionDiagnostics?.unboundEvidence).map((row) => [
      row.id,
      renderStatusBadge(row.diagnosticType, 'gold'),
      row.explanation,
      renderIdBadges(row.requiredCommandRefs),
      renderIdBadges(row.artifactRefs),
    ]);
    const verdictReasonRows = closeoutDeliveryVerdict.reasons.length
      ? closeoutDeliveryVerdict.reasons.map((reason, index) => [`${String(index + 1).padStart(2, '0')}`, reason])
      : [['--', 'final_acceptance_ready']];
    return `<section class="card" id="delivery-readiness">
      <h2>Closeout Delivery Verdict</h2>
      <p class="section-lead">closeout-review 模式下，本区主状态来自最终验收和受控 closeout report；旧 deliveryReadiness 只作为 preCloseoutDiagnostic 展示。</p>
      <div class="metric-grid closeout-verdict-metrics">
        <div class="metric status-metric ${closeoutDeliveryVerdict.ready ? 'green' : 'danger'}"><strong class="status-${closeoutDeliveryVerdict.ready ? 'confirmable' : 'blocked'}">${escapeHtml(closeoutDeliveryVerdict.label)}</strong><span>closeoutDeliveryVerdict</span></div>
        <div class="metric"><strong>${escapeHtml(closeoutDeliveryVerdict.currentAttemptId)}</strong><span>current closeout attempt</span></div>
        <div class="metric"><strong>${escapeHtml(closeoutDeliveryVerdict.closeoutReportDecision || '')}</strong><span>closeout report decision</span></div>
        <div class="metric"><strong>${escapeHtml(closeoutDeliveryVerdict.closeoutCheckCount)}</strong><span>closeout checks</span></div>
        <div class="metric danger"><strong>${escapeHtml(closeoutDeliveryVerdict.closeoutFailedCheckCount)}</strong><span>failed closeout checks</span></div>
        <div class="metric warn"><strong>${escapeHtml(closeoutDeliveryVerdict.sourceProjectionGapCount)}</strong><span>source projection gaps</span></div>
      </div>
      <h3>Closeout Verdict Reasons</h3>
      ${renderTable(['reasonId', 'reason'], verdictReasonRows, { className: 'compact-map-table' })}
      <h3>Pre-Closeout Diagnostic</h3>
      <p class="muted">以下诊断来自 source trace/evidence projection，不是 closeout runtime acceptance verdict。</p>
      ${renderTable(['reasonId', 'reason'], diagnosticRows, { className: 'compact-map-table' })}
      <h3>Source Projection Gap Diagnostic</h3>
      ${sourceGapRows.length
        ? renderTable(['Evidence', 'Diagnostic', 'Explanation', 'Commands', 'Artifacts'], sourceGapRows, { className: 'compact-map-table source-projection-gap-table' })
        : '<p class="empty-state">No source evidence projection gaps detected.</p>'}
    </section>`;
  }
  const reasonRows = deliveryReadiness.reasons.length
    ? deliveryReadiness.reasons.map((reason, index) => [`${String(index + 1).padStart(2, '0')}`, reason])
    : [['--', ui.deliveryReady]];
  return `<section class="card" id="delivery-readiness">
    <h2>${escapeHtml(ui.deliveryReadiness)}</h2>
    <p class="section-lead">${escapeHtml(ui.deliveryReadinessLead)}</p>
    <div class="metric-grid">
      <div class="metric status-metric ${deliveryReadiness.ready ? 'green' : 'danger'}"><strong class="status-${deliveryReadiness.ready ? 'confirmable' : 'blocked'}">${escapeHtml(deliveryReadiness.label)}</strong><span>${escapeHtml(ui.deliveryReadiness)}</span></div>
      <div class="metric"><strong>${escapeHtml(deliveryReadiness.currentPassTraceRows)}</strong><span>current_pass traceRows</span></div>
      <div class="metric"><strong>${escapeHtml(deliveryReadiness.totalTraceRows)}</strong><span>traceRows total</span></div>
      <div class="metric danger"><strong>${escapeHtml(deliveryReadiness.missingEvidenceCount)}</strong><span>${escapeHtml(ui.missingCurrentEvidence)}</span></div>
      <div class="metric warn"><strong>${escapeHtml(deliveryReadiness.staleProofCount)}</strong><span>${escapeHtml(ui.staleProofNeedsRecheck)}</span></div>
    </div>
    <div class="table-wrap">${renderTable(['reasonId', 'reason'], reasonRows)}</div>
  </section>`;
}

function renderFinalAcceptanceReview(finalAcceptanceReview) {
  if (!finalAcceptanceReview?.applies) return '';
  const issueRows = finalAcceptanceReview.blockingIssues.length
    ? finalAcceptanceReview.blockingIssues.map((issue) => [
        issue.code ?? 'final_acceptance_blocker',
        issue.message ?? '',
        renderIdBadges(issue.refs ?? []),
      ])
    : [['--', 'final_acceptance_ready=true', '<span class="muted">无</span>']];
  const traceRows = Object.values(finalAcceptanceReview.rows).map((row) => [
    row.traceId,
    renderStatusBadge(row.originalConfirmationStatus, statusBadgeTone(row.originalConfirmationStatus)),
    renderStatusBadge(row.preCloseoutRuntimeStatus, statusBadgeTone(row.preCloseoutRuntimeStatus)),
    renderStatusBadge(row.postCloseoutRuntimeStatus, statusBadgeTone(row.postCloseoutRuntimeStatus)),
    renderStatusBadge(row.finalAcceptanceStatus, statusBadgeTone(row.finalAcceptanceStatus)),
    renderStatusBadge(row.transitionLegality, statusBadgeTone(row.transitionLegality)),
    renderIdBadges(row.evidenceRefs),
    renderIdBadges(row.commandRefs),
    renderIdBadges(row.artifactRefs),
    row.runId,
    row.closeoutAttemptId,
    row.blockingReason,
  ]);
  return `<section class="card" id="final-acceptance-review">
    <h2>Final Acceptance Review</h2>
    <p class="section-lead">Closeout review is a read-only post-closeout projection. It preserves the original confirmation status and adds runtime/final acceptance columns from the controlled requirement record.</p>
    <div class="metric-grid final-acceptance-metrics">
      <div class="metric status-metric ${finalAcceptanceReview.ready ? 'green' : 'danger'}"><strong class="status-${finalAcceptanceReview.ready ? 'confirmable' : 'blocked'}">${escapeHtml(finalAcceptanceReview.status)}</strong><span>finalAcceptanceReview.ready</span></div>
      <div class="metric"><strong>${escapeHtml(finalAcceptanceReview.currentAttemptId)}</strong><span>current closeout attempt</span></div>
      <div class="metric"><strong>${escapeHtml(String(finalAcceptanceReview.awaitingUserAcceptance))}</strong><span>awaitingUserAcceptance</span></div>
      <div class="metric"><strong>${escapeHtml(finalAcceptanceReview.attemptDecision || '')}</strong><span>attemptDecision</span></div>
      <div class="metric"><strong>${escapeHtml(finalAcceptanceReview.requiredCommandEvidence.currentAttemptCount)}</strong><span>current-attempt commands</span></div>
      <div class="metric"><strong>${escapeHtml(finalAcceptanceReview.requiredCommandEvidence.artifactBoundCount)}</strong><span>artifact-bound commands</span></div>
    </div>
    ${renderTable(['Field', 'Value'], [
      ['lastEventType', finalAcceptanceReview.lastEventType],
      ['lastAppliedEventId', finalAcceptanceReview.lastAppliedEventId],
      ['attemptBlockingReasons', finalAcceptanceReview.attemptBlockingReasons.join(', ') || 'none'],
      ['requiredCommandIds', renderIdBadges(finalAcceptanceReview.requiredCommandEvidence.currentAttemptCommandIds)],
      ['artifactBoundCommandIds', renderIdBadges(finalAcceptanceReview.requiredCommandEvidence.artifactBoundCommandIds)],
    ], { className: 'compact-map-table' })}
    <h3>Final Acceptance Blockers</h3>
    ${renderTable(['code', 'message', 'refs'], issueRows, { className: 'compact-map-table' })}
    <h3>Closeout Trace Acceptance Matrix</h3>
    ${renderTable([
      'Trace',
      'Original Confirmation Status',
      'Pre-Closeout Runtime Status',
      'Post-Closeout Runtime Status',
      'Final Acceptance Status',
      'Transition Legality',
      'Evidence',
      'Command',
      'Artifact',
      'Run ID',
      'Closeout Attempt ID',
      'Blocking Reason',
    ], traceRows, { className: 'closeout-trace-acceptance-table' })}
  </section>`;
}

function renderStructuredValue(value) {
  if (value === null || value === undefined || value === '') return '<span class="muted">无</span>';
  if (Array.isArray(value)) {
    const scalarItems = value.filter((item) => item === null || typeof item !== 'object').map((item) => String(item));
    if (scalarItems.length === value.length) return renderIdBadges(scalarItems);
    return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
  }
  if (typeof value === 'object') return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
  if (typeof value === 'boolean') return renderStatusBadge(String(value), value ? 'green' : 'red');
  return inlineCode(String(value));
}

function objectRows(value, keys = null) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const selectedKeys = keys ?? Object.keys(source);
  return selectedKeys.map((key) => [key, renderStructuredValue(source[key])]);
}

function renderCloseoutGateResultMatrix(closeoutGateMatrix) {
  const rows = asArray(closeoutGateMatrix?.rows).map((row) => [
    row.id,
    renderStatusBadge(String(row.passed), row.passed ? 'green' : 'red'),
    String(row.issueCount),
    String(row.openCount),
    String(row.missingEvidenceCount),
    String(row.failedEvidenceCount),
    row.deliveryStatus || '',
    row.reportPath || '',
    stringList(row.blockingReasons).join(', ') || 'none',
  ]);
  return `<section class="card" id="closeout-gate-result-matrix">
    <h2>Closeout Gate Result Matrix</h2>
    <p class="section-lead">本区渲染当前 closeout report 的每个 check。它是 closeoutDeliveryVerdict 的主要运行态证据来源。</p>
    <div class="metric-grid">
      <div class="metric status-metric ${closeoutGateMatrix?.failedCount ? 'danger' : 'green'}"><strong class="status-${closeoutGateMatrix?.failedCount ? 'blocked' : 'confirmable'}">${escapeHtml(closeoutGateMatrix?.reportDecision || 'missing')}</strong><span>closeout report decision</span></div>
      <div class="metric"><strong>${escapeHtml(closeoutGateMatrix?.totalCount ?? 0)}</strong><span>checks total</span></div>
      <div class="metric"><strong>${escapeHtml(closeoutGateMatrix?.passedCount ?? 0)}</strong><span>checks passed</span></div>
      <div class="metric danger"><strong>${escapeHtml(closeoutGateMatrix?.failedCount ?? 0)}</strong><span>checks failed</span></div>
    </div>
    ${rows.length
      ? renderTable(['Check ID', 'Passed', 'Issue Count', 'Open Count', 'Missing Evidence', 'Failed Evidence', 'Delivery Status', 'Report Path', 'Blocking Reasons'], rows, { className: 'compact-map-table closeout-gate-result-table' })
      : '<p class="empty-state">No closeout checks were available from delivery-closeout-report.json or the current closeout attempt.</p>'}
  </section>`;
}

function renderCloseoutAttemptHistory(closeoutAttemptHistory) {
  const rows = asArray(closeoutAttemptHistory?.attempts).map((attempt) => [
    String(attempt.index),
    attempt.closeoutAttemptId,
    renderStatusBadge(attempt.decision || 'missing', statusBadgeTone(attempt.decision)),
    stringList(attempt.blockingReasons).join(', ') || 'none',
    String(attempt.checkCount),
    String(attempt.passedCheckCount),
    String(attempt.failedCheckCount),
    attempt.evaluatedAt || '',
    attempt.reportPath || '',
  ]);
  return `<section class="card" id="closeout-attempt-history">
    <h2>Closeout Attempt History</h2>
    <p class="section-lead">本区保留所有 closeout attempt，让审核者看到 blocked 到 pass 的合法演进。</p>
    ${rows.length
      ? renderTable(['#', 'Attempt ID', 'Decision', 'Blocking Reasons', 'Checks', 'Passed', 'Failed', 'Evaluated At', 'Report Path'], rows, { className: 'compact-map-table closeout-attempt-history-table' })
      : '<p class="empty-state">No closeout attempt history found.</p>'}
  </section>`;
}

function renderRuntimeEvidenceClosureSummary(runtimeEvidenceClosureSummary) {
  const rows = asArray(runtimeEvidenceClosureSummary?.rows).map((row) => [
    row.name,
    String(row.totalCount),
    String(row.openCount),
    renderStatusBadge(row.status, statusBadgeTone(row.status)),
  ]);
  return `<section class="card" id="runtime-evidence-closure-summary">
    <h2>Runtime Evidence Closure Summary</h2>
    <p class="section-lead">本区按 requirement record 汇总运行态闭环证据数量，帮助判断 open 状态是否已经合法关闭。</p>
    ${renderTable(['Record Area', 'Total Count', 'Open Count', 'Status'], rows, { className: 'compact-map-table runtime-evidence-summary-table' })}
  </section>`;
}

function renderSourceCloseoutPolicy(confirmation, sourceProjectionDiagnostics) {
  const postCloseout = confirmation.postCloseoutConfirmationReview ?? {};
  const preview = confirmation.closeoutReadinessPreview ?? {};
  const suggestedRows = asArray(confirmation.suggestedCommands).map((row) => [
    row.id ?? row.commandId ?? '',
    row.command ?? '',
    renderIdBadges(row.traceRows),
    renderIdBadges(row.evidenceRefs),
  ]);
  const projectionRows = asArray(confirmation.mustDerivedProjectionMap).map((row) => [
    row.id ?? '',
    renderStructuredValue(row.mustRefs ?? row.mustIds ?? row.sourceRefs),
    renderStructuredValue(row.projectionRefs ?? row.targetRefs ?? row.traceRefs),
    row.policy ?? row.status ?? row.text ?? '',
  ]);
  const manifest = confirmation.aiTddContractExecutionManifestProjection ?? {};
  const manifestRows = objectRows(manifest, [
    'schemaVersion',
    'applies',
    'requiredSections',
    'atomicImplementationTaskLineage',
    'finalGateMatrix',
    'executionLoopProtocol',
    'semanticGapPolicy',
    'hostExecutionHints',
    'evidenceTrustStates',
  ]);
  const gapRows = asArray(sourceProjectionDiagnostics?.unboundEvidence).map((row) => [
    row.id,
    renderStatusBadge(row.diagnosticType, 'gold'),
    row.explanation,
    renderIdBadges(row.requiredCommandRefs),
    renderIdBadges(row.artifactRefs),
  ]);
  return `<section class="card" id="source-closeout-policy">
    <h2>Source Closeout Policy</h2>
    <p class="section-lead">本区渲染 source-defined closeout policy。它解释页面必须如何保留原确认状态、增加最终验收列，并避免把 source projection gap 误报为 runtime closeout blocker。</p>
    <h3>postCloseoutConfirmationReview</h3>
    ${renderTable(['Field', 'Value'], objectRows(postCloseout), { className: 'compact-map-table source-closeout-policy-table' })}
    <h3>closeoutReadinessPreview</h3>
    ${renderTable(['Field', 'Value'], objectRows(preview), { className: 'compact-map-table source-closeout-policy-table' })}
    <h3>suggestedCommands</h3>
    ${suggestedRows.length
      ? renderTable(['Command ID', 'Command', 'Trace Rows', 'Evidence'], suggestedRows, { className: 'compact-map-table' })
      : '<p class="empty-state">源文档未提供 suggestedCommands[]。</p>'}
    <h3>mustDerivedProjectionMap</h3>
    ${projectionRows.length
      ? renderTable(['ID', 'MUST Refs', 'Projection Refs', 'Policy'], projectionRows, { className: 'compact-map-table' })
      : '<p class="empty-state">源文档未提供 mustDerivedProjectionMap[]。</p>'}
    <h3>AI-TDD Closeout Projection Policy</h3>
    ${renderTable(['Field', 'Value'], manifestRows, { className: 'compact-map-table' })}
    <h3>Source Projection Gap Diagnostic</h3>
    ${gapRows.length
      ? renderTable(['Evidence', 'Diagnostic', 'Explanation', 'Commands', 'Artifacts'], gapRows, { className: 'compact-map-table source-projection-gap-table' })
      : '<p class="empty-state">No source projection gaps detected.</p>'}
  </section>`;
}

function renderPreConfirmationSemanticDrilldown(drilldown) {
  const report = drilldown?.report ?? {};
  const nestedGate = report.mustDecompositionGate ?? {};
  const packet = report.mustDecompositionPacketRef ?? nestedGate.mustDecompositionPacketRef ?? {};
  const kernel = report.semanticKernelRef ?? nestedGate.semanticKernelRef ?? {};
  const critic = report.criticalAuditor ?? nestedGate.criticalAuditor ?? {};
  const reconciliation = report.packetSourceReconciliation ?? nestedGate.packetSourceReconciliation ?? {};
  const failedChecks = asArray(report.failedChecks);
  return `<section class="card" id="pre-confirmation-semantic-drilldown">
    <h2>Pre-Confirmation Semantic Drilldown</h2>
    <p class="section-lead">本区说明模型如何理解需求、如何自我追问、MUST 如何拆成原子任务，以及 packet/source 是否同源同步。用户确认的只是需求范围，不是 delivery ready 或 closeout ready。</p>
    ${renderTable(['Field', 'Value'], [
      ['Gate verdict', report.verdict ?? drilldown.status ?? 'missing'],
      ['Gate report', drilldown.reportPath || 'missing'],
      ['Semantic kernel hash', kernel.hash ?? 'missing'],
      ['Packet hash', packet.hash ?? 'missing'],
      ['Packet status', packet.status ?? 'missing'],
      ['Critical Auditor rounds', String(critic.consecutiveNoNewGapRounds ?? critic.rounds ?? 0)],
      ['Reconciliation verdict', reconciliation.verdict ?? 'missing'],
      ['Failed checks', failedChecks.join(', ') || 'none'],
    ])}
    <h3>Semantic Kernel Summary</h3>
    ${renderTable(['Kernel Field', 'Value'], [
      ['path', kernel.path ?? 'missing'],
      ['hash', kernel.hash ?? 'missing'],
      ['sourceDocumentHash', report.sourceDocumentHash ?? 'missing'],
      ['implementationConfirmationHash', report.implementationConfirmationHash ?? 'missing'],
    ])}
    <h3>MUST Decomposition Packet</h3>
    ${renderTable(['Packet Field', 'Value'], [
      ['path', packet.path ?? 'missing'],
      ['hash', packet.hash ?? 'missing'],
      ['status', packet.status ?? 'missing'],
      ['confirmability', report.confirmability ?? 'blocked'],
    ])}
    <h3>Atomicity Drivers</h3>
    <p class="muted">每个 MUST 必须在 packet 中记录 decompositionBasis、atomicityDrivers、questionCoverage 和 atomicityCompleteness；缺失或 under-split 会阻断确认页。</p>
    <h3>Atomic Task Baseline</h3>
    <p class="muted">expectedTaskCount 与 actualTaskCount 必须一致；任何 covers 多个独立行为面或多个独立 oracle 的 task 会被判定为 over-broad。</p>
    <h3>Projection Coverage</h3>
    <p class="muted">EVD / TRACE / ACC / E2E / failure / edge / currentTarget / AI-TDD / artifacts / commands / closeout 均必须从 packet projection 物化，不允许 source row 独立发明。</p>
    <h3>Critical Auditor Convergence</h3>
    ${renderTable(['Field', 'Value'], [
      ['minimumRounds', String(critic.minimumRounds ?? 3)],
      ['consecutiveNoNewGapRounds', String(critic.consecutiveNoNewGapRounds ?? 0)],
      ['latestReceiptHash', critic.latestReceiptHash ?? 'missing'],
      ['convergenceVerdict', critic.convergenceVerdict ?? 'blocked'],
    ])}
    <h3>Gap History</h3>
    <p class="muted">${failedChecks.length ? failedChecks.map(escapeHtml).join(', ') : 'No unresolved validated gap in the loaded drilldown gate report.'}</p>
    <h3>Packet-To-Source Reconciliation</h3>
    ${renderTable(['Field', 'Value'], [
      ['reportPath', reconciliation.reportPath ?? 'missing'],
      ['verdict', reconciliation.verdict ?? 'missing'],
    ])}
  </section>`;
}

function renderCloseoutPreview(confirmation) {
  const requiredChecks = asArray(confirmation.requiredContractChecks);
  const requiredCommands = asArray(confirmation.requiredCommands);
  const preview = confirmation.closeoutReadinessPreview ?? {};
  const rows = [
    ['requiredContractChecks[]', renderIdBadges(requiredChecks.map((item) => item.id ?? item))],
    ['orphanPolicy', preview.orphanPolicy ?? confirmation.orphanPolicy ?? '未提供'],
    ['currentAttemptPolicy', preview.currentAttemptPolicy ?? confirmation.currentAttemptPolicy ?? '未提供'],
    ['must run commands', renderIdBadges(requiredCommands.map((item) => item.id ?? item.command ?? item))],
    ['required evidence', renderIdBadges(asArray(confirmation.evidence).map((item) => item.id))],
    ...asArray(preview.items).map((item) =>
      Array.isArray(item) ? item : [item.label ?? item.name ?? item.key ?? '', item.value ?? item.text ?? item.description ?? '']
    ),
  ];
  return `<section class="card" id="closeout-preview">
    <h2>Closeout 准出预览</h2>
    ${renderTable(['项目', '值'], rows)}
  </section>`;
}

function renderMermaidRuntimeScript(mermaidRuntime) {
  if (!mermaidRuntime.available) return '';
  return `<script data-mermaid-runtime-hash="${attr(mermaidRuntime.hash)}">
${mermaidRuntime.script}
</script>`;
}

function renderUsabilityScript(ui, mermaidRuntime) {
  const runtimeUnavailableMessage = mermaidRuntime.available
    ? 'Mermaid runtime failed to initialize after embedding.'
    : ui.mermaidRuntimeMissing;
  return `<script>
(() => {
  const mermaidRuntimeAvailable = ${mermaidRuntime.available ? 'true' : 'false'};
  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.getAttribute('data-copy-target'));
      if (!target) return;
      await navigator.clipboard.writeText(target.innerText);
      button.innerText = ${JSON.stringify(ui.copied)};
      setTimeout(() => { button.innerText = ${JSON.stringify(ui.copy)}; }, 1200);
    });
  });
  document.querySelectorAll('th').forEach((th) => {
    th.addEventListener('click', () => {
      const table = th.closest('table');
      const index = Array.from(th.parentNode.children).indexOf(th);
      const rows = Array.from(table.tBodies[0].rows);
      const asc = th.dataset.asc !== 'true';
      rows.sort((a, b) => a.cells[index].innerText.localeCompare(b.cells[index].innerText) * (asc ? 1 : -1));
      rows.forEach((row) => table.tBodies[0].appendChild(row));
      th.dataset.asc = String(asc);
    });
  });
  const filterButtons = Array.from(document.querySelectorAll('.nav-filters button[data-filter]'));
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      document.body.dataset.filter = button.dataset.filter;
      filterButtons.forEach((candidate) => {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
      applyArtifactFilter(button.dataset.filter || 'all');
    });
  });
  function applyArtifactFilter(filter) {
    document.querySelectorAll('.artifact-plan-table tbody tr').forEach((row) => {
      const marker = row.querySelector('[data-new-artifact],[data-control-artifact]');
      const isNew = marker && marker.getAttribute('data-new-artifact') === 'true';
      const isControl = marker && marker.getAttribute('data-control-artifact') === 'true';
      const hidden =
        (filter === 'new' && !isNew) ||
        (filter === 'control' && !isControl);
      row.hidden = Boolean(hidden);
    });
    document.querySelectorAll('[data-artifact-group-section]').forEach((section) => {
      const rows = Array.from(section.querySelectorAll('tbody tr'));
      section.hidden = filter !== 'all' && !rows.some((row) => !row.hidden);
    });
    document.querySelectorAll('.card').forEach((card) => {
      if (filter === 'all') {
        card.hidden = false;
        return;
      }
      const alwaysVisible = ['fingerprint', 'current-target', 'artifact-plan'].includes(card.id);
      card.hidden = filter === 'new' && !alwaysVisible;
      if (filter === 'control') card.hidden = false;
    });
    const totalRows = document.querySelectorAll('.artifact-plan-table tbody tr').length;
    const visibleRows = Array.from(document.querySelectorAll('.artifact-plan-table tbody tr')).filter((row) => !row.hidden).length;
    const status = document.querySelector('[data-filter-status]');
    if (status) {
      const label = filter === 'new' ? ${JSON.stringify(ui.showNew)} : filter === 'control' ? ${JSON.stringify(ui.showControl)} : ${JSON.stringify(ui.showAll)};
      status.textContent = label + ': ' + visibleRows + '/' + totalRows;
    }
  }
  const navToggle = document.querySelector('[data-nav-toggle]');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const collapsed = document.body.dataset.navCollapsed === 'true';
      document.body.dataset.navCollapsed = collapsed ? 'false' : 'true';
      navToggle.setAttribute('aria-expanded', String(collapsed));
      navToggle.innerText = collapsed ? ${JSON.stringify(ui.collapseNav)} : ${JSON.stringify(ui.expandNav)};
    });
  }
  document.querySelectorAll('[data-diagram-viewer]').forEach((viewer) => {
    const cards = Array.from(viewer.querySelectorAll('[data-diagram-card]'));
    const tabs = Array.from(viewer.querySelectorAll('[data-diagram-index].diagram-tab'));
    const toggle = viewer.querySelector('[data-diagram-toggle]');
    const setActive = (nextIndex) => {
      const index = (nextIndex + cards.length) % cards.length;
      viewer.dataset.activeDiagram = String(index);
      if (viewer.dataset.diagramMode !== 'all') {
        viewer.dataset.diagramMode = 'single';
      }
      cards.forEach((card, cardIndex) => {
        card.classList.toggle('active', cardIndex === index);
      });
      tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === index;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        viewer.dataset.diagramMode = 'single';
        if (toggle) toggle.innerText = ${JSON.stringify(ui.expandDiagrams)};
        setActive(Number(tab.dataset.diagramIndex || 0));
      });
    });
    const move = (delta) => {
      viewer.dataset.diagramMode = 'single';
      if (toggle) toggle.innerText = ${JSON.stringify(ui.expandDiagrams)};
      setActive(Number(viewer.dataset.activeDiagram || 0) + delta);
    };
    const prev = viewer.querySelector('[data-diagram-prev]');
    const next = viewer.querySelector('[data-diagram-next]');
    if (prev) prev.addEventListener('click', () => move(-1));
    if (next) next.addEventListener('click', () => move(1));
    if (toggle) {
      toggle.addEventListener('click', () => {
        const expanded = viewer.dataset.diagramMode === 'all';
        viewer.dataset.diagramMode = expanded ? 'single' : 'all';
        toggle.innerText = expanded ? ${JSON.stringify(ui.expandDiagrams)} : ${JSON.stringify(ui.singleDiagram)};
        setActive(Number(viewer.dataset.activeDiagram || 0));
      });
    }
    setActive(Number(viewer.dataset.activeDiagram || 0));
  });
  async function renderNativeMermaid() {
    const blocks = Array.from(document.querySelectorAll('[data-diagram-card]'));
    if (!mermaidRuntimeAvailable || !window.mermaid) {
      blocks.forEach((card) => {
        const error = card.querySelector('[data-mermaid-error]');
        if (!error) return;
        error.hidden = false;
        error.innerText = ${JSON.stringify(runtimeUnavailableMessage)};
      });
      return;
    }
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      sequence: {
        mirrorActors: false,
        wrap: true,
        useMaxWidth: false,
        diagramMarginX: 16,
        diagramMarginY: 20,
        boxMargin: 8,
        boxTextMargin: 4,
        noteMargin: 10,
        messageAlign: 'left',
        messageMargin: 34,
        actorMargin: 42,
        width: 126,
        height: 38,
        actorFontSize: 12,
        messageFontSize: 12,
        noteFontSize: 12
      },
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        nodeSpacing: 28,
        rankSpacing: 34
      },
      themeVariables: {
        fontFamily: 'Segoe UI, Noto Sans SC, Microsoft YaHei, sans-serif',
        fontSize: '12px',
        primaryColor: '#fffdf8',
        primaryBorderColor: '#8b611b',
        primaryTextColor: '#24211b',
        lineColor: '#2d5d82',
        signalColor: '#2d5d82',
        signalTextColor: '#24211b',
        actorBorder: '#8b611b',
        actorBkg: '#f3e3bf',
        actorTextColor: '#24211b',
        noteBkgColor: '#fff6f3',
        noteTextColor: '#24211b',
        activationBorderColor: '#28684e',
        activationBkgColor: '#dff0e7'
      }
    });
    for (const card of blocks) {
      const sourceEl = card.querySelector('[data-mermaid-source]');
      const target = card.querySelector('[data-mermaid-render]');
      const error = card.querySelector('[data-mermaid-error]');
      if (!sourceEl || !target) continue;
      const id = 'native-mermaid-' + (target.dataset.diagramId || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2);
      try {
        const rendered = await window.mermaid.render(id, sourceEl.textContent || '');
        target.innerHTML = rendered.svg;
        target.dataset.rendered = 'true';
        const svg = target.querySelector('svg');
        if (svg) {
          svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
          const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\\s+/).map(Number);
          if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
            const naturalWidth = Math.max(320, Math.ceil(viewBox[2]));
            const naturalHeight = Math.max(180, Math.ceil(viewBox[3]));
            svg.setAttribute('width', String(naturalWidth));
            svg.setAttribute('height', String(naturalHeight));
            svg.style.width = naturalWidth + 'px';
            svg.style.height = naturalHeight + 'px';
          }
          svg.style.maxWidth = 'none';
          svg.style.margin = '0';
          svg.style.display = 'block';
        }
        if (error) error.hidden = true;
      } catch (err) {
        if (error) {
          error.hidden = false;
          error.innerText = 'Mermaid render failed: ' + (err && err.message ? err.message : String(err));
        }
      }
    }
  }
  applyArtifactFilter(document.body.dataset.filter || 'all');
  renderNativeMermaid();
})();
</script>`;
}

function renderCss(theme) {
  const compact = theme === 'compact';
  return `<style>
:root{--bg:#f4f0e7;--paper:#fffdf8;--ink:#24211b;--muted:#6b655b;--line:#d9cbb5;--rule:#a88f63;--red:#a33a2d;--red-soft:#f8ddd7;--green:#28684e;--green-soft:#dff0e7;--blue:#2d5d82;--blue-soft:#dceaf4;--gold:#8b611b;--gold-soft:#f3e3bf;--purple:#5b4c8a;--purple-soft:#ece7fb;--shadow:none;--mono:"Cascadia Mono",Consolas,monospace;--sans:"Noto Sans SC","Segoe UI","Microsoft YaHei",sans-serif}
*{box-sizing:border-box}body{margin:0;color:var(--ink);background:linear-gradient(90deg,#ebe1cf 0,#f7f3eb 42%,#fffdf8 100%);font-family:var(--sans);line-height:1.62}a{color:var(--blue)}
.layout{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh;transition:grid-template-columns .18s ease;max-width:100%}.nav{position:sticky;top:0;height:100vh;overflow:auto;padding:24px 22px;background:#1f211c;color:#fff;border-right:1px solid rgba(255,255,255,.08)}.nav a{display:block;color:#fff;text-decoration:none;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.1)}.nav button{width:100%;margin:4px 0;padding:8px;border:1px solid rgba(255,255,255,.22);background:#f8f1df;color:#24211b;border-radius:4px;cursor:pointer}.nav-toggle{font-weight:800}.nav-filters button[aria-pressed="true"]{background:var(--gold-soft);border-color:var(--gold);color:#2b2110}.filter-status{margin:8px 0 0;color:#f2e3c2;font-family:var(--mono);font-size:11px}body[data-nav-collapsed="true"] .layout{grid-template-columns:58px minmax(0,1fr)}body[data-nav-collapsed="true"] .nav{padding:12px 8px;overflow:hidden}body[data-nav-collapsed="true"] .nav h2,body[data-nav-collapsed="true"] .nav-links,body[data-nav-collapsed="true"] .nav-filters,body[data-nav-collapsed="true"] .nav hr{display:none}body[data-nav-collapsed="true"] .nav-toggle{writing-mode:vertical-rl;min-height:96px;padding:10px 4px;border-color:rgba(255,255,255,.25)}
main{padding:${compact ? '22px' : '44px'} min(6vw,88px) 86px;min-width:0;max-width:100%;background:linear-gradient(180deg,rgba(255,253,248,.96),rgba(255,253,248,.9));counter-reset:doc-section}h1{font-size:clamp(34px,4.8vw,58px);line-height:1.02;margin:0 0 26px;font-family:Georgia,"Noto Serif SC",serif;font-weight:650;letter-spacing:-.035em}h2{font-size:clamp(24px,2.5vw,34px);line-height:1.15;margin:0 0 16px;font-family:Georgia,"Noto Serif SC",serif;font-weight:620;letter-spacing:-.018em}h3{margin:26px 0 10px}
.card{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;padding:${compact ? '24px 0 28px' : '36px 0 42px'};box-shadow:none;margin:0;min-width:0;max-width:100%}.card:first-of-type{border-top:0;padding-top:0}.card>h2{display:flex;align-items:baseline;gap:10px;padding-bottom:11px;border-bottom:1px solid var(--line)}.card>h2::before{counter-increment:doc-section;content:counter(doc-section,decimal-leading-zero);font:700 12px/1 var(--mono);letter-spacing:.12em;color:var(--gold);min-width:28px}.section-lead{color:var(--muted);max-width:980px}.hero{background:linear-gradient(90deg,rgba(243,227,191,.28),rgba(220,234,244,.18));border-top:1px solid var(--rule);border-bottom:1px solid var(--line);padding-left:0;padding-right:0}.hero-copy{max-width:980px}.eyebrow{display:inline-block;text-transform:uppercase;letter-spacing:.16em;font-size:12px;color:var(--gold);font-weight:800}.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;margin:22px 0;min-width:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.metric{background:transparent;border:0;border-right:1px solid var(--line);border-radius:0;padding:12px 14px;min-width:0}.metric:last-child{border-right:0}.metric strong{display:block;font-size:28px;line-height:1;color:var(--blue)}.metric.status-metric strong{display:inline-block;max-width:100%;box-sizing:border-box;font-size:13px;line-height:1.2;overflow-wrap:anywhere;word-break:break-word;white-space:normal}.metric.status-metric strong.status-confirmable{color:var(--green)}.metric.status-metric strong.status-blocked{color:var(--red)}.metric.status-metric span{display:block;margin-top:8px}.metric span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.metric.danger strong{color:var(--red)}.metric.warn strong{color:var(--gold)}.principle-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;min-width:0}.principle{background:rgba(255,255,255,.42);border:0;border-left:3px solid var(--line);border-radius:0;padding:10px 12px;min-width:0}.principle p{margin:6px 0 0;color:var(--muted)}.fingerprint{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;min-width:0}.kv{border:0;border-left:3px solid var(--line);border-radius:0;padding:9px 12px;background:rgba(255,255,255,.42);min-width:0}.kv span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em}.hash{font-family:var(--mono);word-break:break-all}
.status-confirmable{background:var(--green-soft);color:var(--green);padding:5px 9px;border-radius:3px;font-weight:700}.status-blocked{background:var(--red-soft);color:var(--red);padding:5px 9px;border-radius:3px;font-weight:700}
.confirm-box{background:#191815;color:#fff;border-radius:0;border-left:4px solid var(--gold);padding:18px 20px}.confirm-box pre{white-space:pre-wrap;font-family:var(--mono)}button.copy{padding:8px 12px;border-radius:3px;border:1px solid var(--gold);background:#f8efd7;color:#2b2110;cursor:pointer}
.table-wrap{overflow-x:auto;overflow-y:auto;border:1px solid var(--line);border-radius:0;min-width:0;max-width:100%;scrollbar-gutter:stable;background:#fff}.table-wrap table{width:max-content;min-width:100%;border-collapse:collapse;background:#fff;table-layout:auto}.table-wrap th,.table-wrap td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;min-width:140px;max-width:560px;overflow-wrap:break-word}.table-wrap th{position:sticky;top:0;background:#efe7d8;cursor:pointer;text-align:left;font-size:12px;letter-spacing:.02em}.table-wrap tr:nth-child(even) td{background:#fbf8f1}.table-wrap code,.table-wrap .id-badge{white-space:nowrap}.compact-map-table{min-width:1100px}.id-badge{display:inline-block;font-family:var(--mono);font-size:11px;margin:2px;padding:2px 6px;border-radius:3px;background:var(--blue-soft);color:var(--blue)}
.closeout-verdict-metrics,.final-acceptance-metrics{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));max-width:100%;overflow:hidden}.closeout-verdict-metrics .metric strong,.final-acceptance-metrics .metric strong{font-size:13px!important;line-height:1.25!important;max-width:100%;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;font-family:var(--mono)}.closeout-verdict-metrics .metric,.final-acceptance-metrics .metric{min-width:0;max-width:100%;overflow:hidden}.target-realization-table{width:100%;min-width:980px;table-layout:fixed}.target-realization-table th,.target-realization-table td{overflow-wrap:anywhere;word-break:break-word}.target-realization-summary .metric strong{font-size:14px}.closeout-trace-acceptance-table{width:100%!important;min-width:1320px!important;table-layout:fixed!important}.closeout-trace-acceptance-table th,.closeout-trace-acceptance-table td{min-width:0!important;max-width:none!important;overflow-wrap:anywhere!important;word-break:break-word!important}.closeout-trace-acceptance-table code,.closeout-trace-acceptance-table .id-badge,.closeout-trace-acceptance-table .tag,.closeout-gate-result-table code,.closeout-gate-result-table .id-badge,.closeout-gate-result-table .tag,.closeout-attempt-history-table code,.closeout-attempt-history-table .id-badge,.closeout-attempt-history-table .tag{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}.source-projection-gap-table td{overflow-wrap:anywhere;word-break:break-word}
.issue-list{padding-left:18px}.blocking{background:var(--red-soft);border-left:4px solid var(--red);padding:8px;margin:8px 0}.warning{background:var(--gold-soft);border-left:4px solid var(--gold);padding:8px;margin:8px 0}.ok{background:var(--green-soft);color:var(--green);padding:10px;border-radius:0}.blocked{background:var(--red-soft);color:var(--red);padding:10px;border-radius:0}.muted{color:var(--muted)}
.split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;min-width:0}.review-flow{display:grid;gap:0;margin-top:22px;min-width:0;border-top:1px solid var(--line)}.review-step{border-top:0;border-bottom:1px solid var(--line);padding:18px 0;min-width:0}.review-step:first-child{border-top:0}.review-step h3{margin-top:0}.panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.tag{display:inline-flex;align-items:center;border-radius:3px;padding:4px 8px;font-size:11px;font-weight:800;background:var(--blue-soft);color:var(--blue);border:1px solid rgba(49,95,134,.16);white-space:nowrap}.tag.red{background:var(--red-soft);color:var(--red)}.tag.green{background:var(--green-soft);color:var(--green)}.tag.blue{background:var(--blue-soft);color:var(--blue)}.tag.gold{background:var(--gold-soft);color:var(--gold)}.list{display:grid;gap:0;margin:0;padding:0;list-style:none;min-width:0;border-top:1px solid var(--line)}.list li{display:grid;gap:4px;border-left:0;border-bottom:1px solid var(--line);padding:10px 0;background:transparent;border-radius:0;min-width:0}.list strong{font-size:14px}.list span{color:var(--muted);font-size:13px;overflow-wrap:anywhere}.current li{border-left-color:var(--red)}.target li{border-left-color:var(--green)}.current-target-map h3{margin:22px 0 8px}.current-target-map .table-wrap{margin:0 0 14px;border-radius:0}.current-target-map .compact-map-table{width:100%;min-width:960px;table-layout:fixed;font-size:12px;line-height:1.34}.current-target-map .compact-map-table th,.current-target-map .compact-map-table td{min-width:0;max-width:none;padding:6px 8px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto}.current-target-map .compact-map-table th{font-size:11px;text-transform:uppercase;letter-spacing:.02em}.current-target-map .compact-map-table code,.current-target-map code{display:inline;max-width:100%;font-family:var(--mono);font-size:11px;background:#f7efe3;border:1px solid rgba(120,104,78,.2);border-radius:3px;padding:1px 4px;white-space:normal;overflow-wrap:anywhere;word-break:break-word}.current-target-map .compact-map-table .tag{max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:break-word}.metric-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);min-width:0}.metric.compact{padding:10px 12px;border-radius:0}.metric.compact strong{font-size:24px}.metric.compact span{text-transform:none}.footnote{font-family:var(--mono);font-size:12px;color:var(--blue)!important}.diff-deck{display:grid;gap:0;margin:18px 0;min-width:0;border-top:1px solid var(--line)}.compact-diff-deck{grid-template-columns:1fr;align-items:stretch}.diff-card{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;overflow:hidden;min-width:0}.diff-card-title{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(120,104,78,.18);background:transparent}.diff-card-title strong{font-family:Georgia,"Noto Serif SC",serif;font-size:16px}.diff-card-title span{font-family:var(--mono);font-size:10.5px;color:var(--blue);text-align:right;overflow-wrap:anywhere}.diff-compare{display:grid;grid-template-columns:1fr 1fr;min-width:0}.diff-side{padding:10px 12px;min-height:72px;min-width:0}.diff-side b{display:block;font-family:var(--mono);font-size:11px;margin-bottom:5px}.diff-side p{margin:0;color:var(--muted);font-size:12px;line-height:1.38;overflow-wrap:anywhere}.diff-minus{background:rgba(248,221,215,.42);border-right:1px solid rgba(120,104,78,.18)}.diff-minus b{color:var(--red)}.diff-plus{background:rgba(223,240,231,.48)}.diff-plus b{color:var(--green)}.target-flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;align-items:stretch;margin:20px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);min-width:0}.flow-step{border-radius:0;border:0;border-right:1px solid var(--line);background:transparent;padding:12px;position:relative;min-width:0}.flow-step:last-child{border-right:0}.flow-step span{display:block;color:var(--muted);font-size:12px;margin-top:6px;overflow-wrap:anywhere}.flow-step::after{content:"";position:absolute}.callout{border-radius:0;border:0;border-left:4px solid var(--red);background:rgba(247,223,216,.36);padding:11px 14px;margin:10px 0;overflow-wrap:anywhere}
.diagram-viewer{border:1px solid var(--line);border-radius:0;background:#fbf8f1;padding:14px;margin:18px 0 28px}.diagram-toolbar{display:flex;gap:12px;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:10px}.diagram-tabs{display:flex;gap:6px;flex-wrap:wrap}.diagram-actions{display:flex;gap:8px;flex-wrap:wrap}.diagram-tab,.diagram-actions button{border:1px solid rgba(120,104,78,.34);background:#fffdf8;color:var(--ink);border-radius:3px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer}.diagram-tab.active,.diagram-actions button:hover{background:#24211b;color:#fff;border-color:#24211b}.mermaid-runtime-status{margin:0 0 12px}.diagram-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}.diagram-viewer[data-diagram-mode="single"] .diagram-grid{display:block}.diagram-viewer[data-diagram-mode="single"] .diagram-card{display:none}.diagram-viewer[data-diagram-mode="single"] .diagram-card.active{display:block}.diagram-viewer[data-diagram-mode="all"] .diagram-card{display:block}.diagram-card{border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0;background:transparent;box-shadow:none;overflow:hidden}.diagram-viewer[data-diagram-mode="single"] .diagram-card{max-width:none;margin:0}.diagram-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid rgba(120,104,78,.2);padding-bottom:7px}.diagram-title strong{display:block;font-family:Georgia,"Noto Serif SC",serif;font-size:17px;line-height:1}.diagram-title span{display:block;margin-top:4px;color:var(--muted);font-family:var(--mono);font-size:10px}.diagram-meta{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:58%}.diagram-rendered{background:#fffdf8;border:1px solid var(--line);border-radius:0;padding:16px 18px 22px;margin-top:9px;overflow:auto;max-height:520px;min-height:300px;text-align:left;resize:vertical;scrollbar-gutter:stable both-edges}.diagram-viewer[data-diagram-mode="all"] .diagram-rendered{max-height:360px;min-height:260px}.diagram-rendered h4{margin:0 0 12px;font-size:11px;color:var(--gold);letter-spacing:.08em;text-transform:uppercase}.mermaid-source-native{display:none}.mermaid-native-render{display:block;min-width:max-content;min-height:210px;text-align:left;transform-origin:top left}.mermaid-native-render svg{display:block;margin:0 !important;max-width:none !important;overflow:visible}.mermaid-native-render .actor,.mermaid-native-render .messageText,.mermaid-native-render .noteText,.mermaid-native-render text{font-size:12px !important}.mermaid-runtime-error{margin:12px 0}.fallback-diagram{margin-top:14px;border-top:1px dashed rgba(120,104,78,.35);padding-top:10px}.fallback-diagram summary{cursor:pointer;color:var(--muted);font-weight:800}.fallback-diagram:not([open]){opacity:.72}.rendered-mermaid{background:transparent;border-radius:0}.diagram-legend{display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--muted);font-size:10.5px;margin:0 0 7px}.legend-dot{width:8px;height:8px;border-radius:99px;background:var(--blue);display:inline-block}.legend-dot.pass{background:var(--green)}.legend-dot.warn{background:var(--red)}.compact-lanes{min-width:max(600px,100%);display:grid;grid-template-columns:repeat(var(--lane-count),minmax(118px,1fr));gap:7px}.diagram-viewer[data-diagram-mode="single"] .compact-lanes{min-width:max(820px,100%)}.compact-lane{border:1px solid rgba(120,104,78,.22);border-radius:0;background:rgba(255,255,255,.5);padding:7px;position:relative;min-height:158px}.compact-lane::before{content:"";position:absolute;top:42px;bottom:9px;left:50%;border-left:2px dashed rgba(36,33,27,.13)}.compact-lane h4{position:relative;z-index:2;margin:0 0 7px;background:var(--paper);border:1px solid rgba(120,104,78,.18);border-radius:0;padding:6px;text-align:center;font-size:11px;line-height:1.2}.compact-event{position:relative;z-index:2;margin:7px 0;padding:7px;border-radius:0;border:1px solid rgba(36,33,27,.11);background:var(--paper);box-shadow:none;font-size:11px}.compact-event strong{display:block;font-size:11px;line-height:1.25;margin-bottom:4px}.compact-event small{color:var(--muted);font-family:var(--mono);font-size:9.5px;line-height:1.2}.compact-event.warn,.flow-step-card.warn{border-color:rgba(166,61,47,.28);background:#fff6f3}.compact-event.pass,.flow-step-card.pass{border-color:rgba(47,111,84,.28);background:#f3fbf6}.event-ids{margin-top:5px}.id-badge.mini{font-size:10px;padding:1px 5px;margin:1px}.id-more{display:inline-block;font-family:var(--mono);font-size:10px;margin:1px;padding:1px 5px;border-radius:3px;background:var(--gold-soft);color:var(--gold)}.compact-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:7px}.diagram-viewer[data-diagram-mode="single"] .compact-flow{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.flow-step-card{border-radius:0;border:1px solid rgba(47,111,84,.22);background:var(--green-soft);padding:8px;position:relative;min-height:78px}.flow-step-card::after{content:"";position:absolute}.flow-step-card.muted-card{background:#f8f3e9;border-style:dashed}.step-index{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:3px;background:#fff;color:var(--green);font-weight:800;margin-bottom:5px;font-size:10px}.flow-step-card strong{display:block;font-size:11.5px;line-height:1.25}.mermaid,pre{background:#181713;color:#fff;border-radius:0;padding:14px;overflow:auto}.answers{display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--line)}.answer{border:0;border-bottom:1px solid var(--line);background:transparent;padding:12px 0;border-radius:0}
body[data-filter="control"] .card:not(:has(.artifact-plan-table)){opacity:.45}body[data-filter="new"] .artifact-plan-table tbody tr{display:none}body[data-filter="new"] .artifact-plan-table tbody tr:has([data-new-artifact="true"]){display:table-row}body[data-filter="new"] .card:not(#artifact-plan):not(#fingerprint):not(#current-target){display:none}.artifact-plan-table tr[hidden],.card[hidden],.artifact-group-section[hidden]{display:none!important}@media(max-width:900px){.layout,body[data-nav-collapsed="true"] .layout{grid-template-columns:1fr}.nav{position:relative;height:auto}body[data-nav-collapsed="true"] .nav h2,body[data-nav-collapsed="true"] .nav-links,body[data-nav-collapsed="true"] .nav-filters,body[data-nav-collapsed="true"] .nav hr{display:block}body[data-nav-collapsed="true"] .nav-toggle{writing-mode:horizontal-tb;min-height:auto}.diff-compare{grid-template-columns:1fr}.diff-minus{border-right:0;border-bottom:1px solid rgba(120,104,78,.18)}}@media print{.nav,button{display:none}.layout{display:block}.card{box-shadow:none;break-inside:avoid}body{background:#fff}}
@media(max-width:1100px){.split{grid-template-columns:1fr}.target-flow{grid-template-columns:1fr}.flow-step::after{content:"v";right:18px;top:auto;bottom:-18px}.flow-step:last-child::after{content:""}.diagram-toolbar{align-items:flex-start;flex-direction:column}.diagram-grid{grid-template-columns:1fr}.diagram-meta{max-width:100%;justify-content:flex-start}.compact-lanes,.diagram-viewer[data-diagram-mode="single"] .compact-lanes{min-width:720px}.flow-step-card::after{content:""}}
</style>`;
}

function buildHtml(input) {
  const {
    args,
    sourceType,
    sourcePath,
    recordId,
    requirementSetId,
    entryFlow,
    entryFlowClass,
    workflowAdapter,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    generatedAt,
    confirmation,
    confirmability,
    confirmInstruction,
    blockingIssues,
    warnings,
    mermaidBlocks,
    views,
    traceRows,
    artifactPlan,
    targetModificationPaths,
    currentTargetMap,
    confirmationProfile,
    traceExecutionState,
    progressDelta,
    deliveryReadiness,
    closeoutDeliveryVerdict,
    closeoutGateMatrix,
    closeoutAttemptHistory,
    runtimeEvidenceClosureSummary,
    sourceProjectionDiagnostics,
    finalAcceptanceReview,
    reconfirmationState,
    resumeFailureRegistry,
    controlledIngestWriters,
    mermaidRuntime,
    requirementBoundary,
    preConfirmationSemanticDrilldown,
  } = input;
  const aiTddContractManifestCoverage = input.coverage.aiTddContractManifestCoverage;
  const ui = getUiText(args.language);
  const diagramGroups = selectDiagramBlocks(mermaidBlocks, views);
  const nextStage =
    confirmability === 'confirmable'
      ? confirmation.nextStageAfterConfirmation ?? ui.nextStageReadyFallback
      : ui.nextStageBlocked;
  const sectionHtml = [
    reconfirmationState?.required ? ['reconfirmation-request', renderReconfirmationPanel(reconfirmationState)] : null,
    [
      'core-design',
      renderCoreDesignSummary({
        ui,
        confirmation,
        traceRows,
        artifactPlan,
        blockingIssues,
        warnings,
        confirmability,
        deliveryReadiness,
        closeoutDeliveryVerdict,
      }),
    ],
    ['delivery-readiness', renderDeliveryReadiness(deliveryReadiness, ui, closeoutDeliveryVerdict, sourceProjectionDiagnostics)],
    finalAcceptanceReview?.applies
      ? ['final-acceptance-review', renderFinalAcceptanceReview(finalAcceptanceReview)]
      : null,
    closeoutDeliveryVerdict?.applies
      ? ['closeout-gate-result-matrix', renderCloseoutGateResultMatrix(closeoutGateMatrix)]
      : null,
    closeoutDeliveryVerdict?.applies
      ? ['closeout-attempt-history', renderCloseoutAttemptHistory(closeoutAttemptHistory)]
      : null,
    closeoutDeliveryVerdict?.applies
      ? ['runtime-evidence-closure-summary', renderRuntimeEvidenceClosureSummary(runtimeEvidenceClosureSummary)]
      : null,
    closeoutDeliveryVerdict?.applies
      ? ['source-closeout-policy', renderSourceCloseoutPolicy(confirmation, sourceProjectionDiagnostics)]
      : null,
    ['progress-delta', renderProgressDelta(progressDelta, reconfirmationState, ui)],
    ['pre-confirmation-semantic-drilldown', renderPreConfirmationSemanticDrilldown(preConfirmationSemanticDrilldown)],
    ['decision-summary', `<section class="card" id="decision-summary"><h2>${escapeHtml(ui.decisionSummary)}</h2>${renderTable(
      [ui.decisionQuestion, ui.decisionAnswer],
      [
        ['本次要确认什么', `${ui.confirmWhatPrefix}${recordId}`],
        ['本次不会确认什么', ui.notConfirmWhat],
        ['是否存在 open questions', asArray(confirmation.openQuestions).length ? ui.yes : ui.no],
        ['是否存在无覆盖项', blockingIssues.some((i) => /coverage|missing_.*view|trace_/u.test(i.code)) ? ui.yes : ui.no],
        ['是否存在计划外工件', blockingIssues.some((i) => /artifact/u.test(i.code)) ? ui.yes : ui.no],
        ['是否提供目标修改路径清单', targetModificationPaths.length ? ui.yes : ui.no],
        ['是否存在会影响控制层的脚本 / hook / gate', artifactPlan.some((item) => item.canAffectControlFlow) ? ui.yes : ui.no],
        ['用户确认后会进入哪个下一阶段', nextStage],
      ]
    )}</section>`],
    ['confirm-instruction', `<section class="card" id="confirm-instruction"><h2>${escapeHtml(ui.confirmInstruction)}</h2><div class="confirm-box"><p>${escapeHtml(
      ui.htmlCannotConfirm
    )}</p><pre id="confirm-text">${escapeHtml(
      confirmInstruction
    )}</pre><button class="copy" data-copy-target="confirm-text">${escapeHtml(ui.copy)}</button></div></section>`],
    ['requirements', renderRequirementSections({ confirmation, traceRows, views, artifactPlan, progressDelta, language: args.language })],
    ['requirement-boundary', renderRequirementBoundary(requirementBoundary, ui)],
    ['business-visuals', renderBusinessVisuals(diagramGroups, requirementBoundary, ui, mermaidRuntime, args)],
    ['governance-visuals', renderGovernanceVisuals(diagramGroups, requirementBoundary, ui, mermaidRuntime, args)],
    ['resume-failure-cases', renderResumeFailureCoverage(resumeFailureRegistry, mermaidRuntime, args, ui)],
    ['trace-matrix', renderTraceMatrix(traceRows, traceExecutionState)],
    viewPackEnabled(confirmationProfile, 'currentTargetMap')
      ? ['current-target', renderCurrentTarget(currentTargetMap, artifactPlan, confirmationProfile)]
      : null,
    ['ai-tdd-contract-manifest', renderAiTddContractManifestCoverage(aiTddContractManifestCoverage)],
    ['target-modification-paths', renderTargetModificationPaths(targetModificationPaths)],
    ['artifact-plan', renderArtifactPlan(artifactPlan)],
    ['controlled-ingest-writers', renderControlledIngestWriterRegistry(controlledIngestWriters)],
    ['architecture-impact', renderArchitectureImpact(confirmation)],
    ['entry-flow', renderEntryFlowView(entryFlow, confirmation, normalizePathForReport(sourcePath))],
    ['scoring-dashboard-sft', renderScoringDashboardSft(confirmation)],
    ['closeout-preview', renderCloseoutPreview(confirmation)],
    ['blocking-issues', renderIssueList(ui.blockingIssues, blockingIssues, ui.noBlockingIssuesDetected)],
    ['warnings', renderIssueList(ui.warnings, warnings, ui.noWarningsDetected)],
    ['eight-questions', `<section class="card" id="eight-questions"><h2>8 个用户关键问题</h2><div class="answers">${ui.eightAnswers
      .map(([q, a]) => `<div class="answer"><strong>${escapeHtml(q)}</strong><p>${escapeHtml(a)}</p></div>`)
      .join('')}</div></section>`],
  ].filter(Boolean);
  const navLabels = {
    fingerprint: ui.fingerprint,
    'core-design': ui.coreDesign,
    'delivery-readiness': ui.deliveryReadiness,
    'final-acceptance-review': 'Final Acceptance Review',
    'closeout-gate-result-matrix': 'Closeout Gate Result Matrix',
    'closeout-attempt-history': 'Closeout Attempt History',
    'runtime-evidence-closure-summary': 'Runtime Evidence Closure Summary',
    'source-closeout-policy': 'Source Closeout Policy',
    'progress-delta': ui.progressDelta,
    'pre-confirmation-semantic-drilldown': 'Pre-Confirmation Semantic Drilldown',
    'reconfirmation-request': '重新确认请求',
    'decision-summary': ui.decisionSummary,
    'confirm-instruction': ui.confirmInstruction,
    requirements: ui.requirements,
    'requirement-boundary': ui.requirementBoundary,
    'business-visuals': ui.businessVisuals,
    'governance-visuals': ui.governanceVisuals,
    'resume-failure-cases': '恢复失败路径矩阵',
    'trace-matrix': ui.traceMatrix,
    'current-target': ui.currentTarget,
    'ai-tdd-contract-manifest': 'AI-TDD 契约执行清单',
    'target-modification-paths': ui.targetModificationPaths,
    'artifact-plan': ui.artifactPlan,
    'controlled-ingest-writers': 'Controlled Ingest Writers',
    'architecture-impact': ui.architectureImpact,
    'entry-flow': ui.entryFlow,
    'scoring-dashboard-sft': ui.scoringDashboardSft,
    'closeout-preview': ui.closeoutPreview,
    'blocking-issues': ui.blockingIssues,
    warnings: ui.warnings,
    'eight-questions': ui.eightQuestions,
  };
  const navItems = [
    ['fingerprint', ui.fingerprint],
    ...sectionHtml.map(([id]) => [id, navLabels[id] ?? id]),
  ];
  const fingerprintRows = [
    [ui.sourcePath, normalizePathForReport(sourcePath)],
    [ui.sourceType, sourceType],
    ['entryFlow', entryFlow],
    ['entryFlowClass', entryFlowClass],
    ['workflowAdapter', workflowAdapter],
    ['recordId', recordId],
    ['requirementSetId', requirementSetId ?? ''],
    ['sourceDocumentHash', sourceDocumentHash],
    ['implementationConfirmationHash', implementationConfirmationHash],
    ['confirmationPageHash', confirmationPageHash],
    [ui.generatedAt, generatedAt],
    [ui.confirmationLanguage, args.language],
    ['confirmationProfile', confirmationProfile.confirmationProfile],
    ['requiredViewPacks', confirmationProfile.requiredViewPacks.join(', ')],
    ['optionalViewPacks', confirmationProfile.optionalViewPacks.join(', ')],
    [ui.currentStatus, confirmation.status ?? 'unknown'],
    [ui.confirmability, confirmability],
    [
      closeoutDeliveryVerdict?.applies ? 'closeoutDeliveryVerdict' : ui.deliveryReadiness,
      closeoutDeliveryVerdict?.applies ? closeoutDeliveryVerdict.label : deliveryReadiness.label,
    ],
    ['finalAcceptanceReview', finalAcceptanceReview?.applies ? finalAcceptanceReview.status : 'not_applicable'],
  ];
  return `<!doctype html>
<html lang="${attr(args.language === 'en-US' ? 'en' : 'zh-CN')}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Requirements Confirmation ${escapeHtml(
    recordId
  )}</title>${renderCss(args.theme)}</head>
<body data-filter="all" data-nav-collapsed="false"><div class="layout"><nav class="nav"><button type="button" class="nav-toggle" data-nav-toggle aria-expanded="true">${escapeHtml(
    ui.collapseNav
  )}</button><h2>${escapeHtml(ui.navTitle)}</h2><div class="nav-links">${navItems
    .map(([id, label]) => `<a href="#${id}">${escapeHtml(label)}</a>`)
    .join('')}</div><hr/><div class="nav-filters"><button data-filter="all" aria-pressed="true">${escapeHtml(ui.showAll)}</button><button data-filter="control" aria-pressed="false">${escapeHtml(
    ui.showControl
  )}</button><button data-filter="new" aria-pressed="false">${escapeHtml(ui.showNew)}</button><p class="filter-status" data-filter-status>${escapeHtml(
    ui.showAll
  )}</p></div></nav><main>
<section class="card" id="fingerprint"><h1>${escapeHtml(ui.pageTitle)}</h1><div class="fingerprint">${fingerprintRows
    .map(
      ([k, v]) =>
        `<div class="kv"><span>${escapeHtml(k)}</span><strong class="${String(v).startsWith('sha256:') ? 'hash' : ''}">${escapeHtml(
          v
        )}</strong></div>`
    )
    .join('')}</div><p><span class="status-${confirmability}">${escapeHtml(confirmability)}</span></p></section>
${sectionHtml.map(([, html]) => html).join('\n')}
</main></div>${renderMermaidRuntimeScript(mermaidRuntime)}${renderUsabilityScript(ui, mermaidRuntime)}</body></html>`;
}

function buildReport(input) {
  const currentTargetEnabled =
    currentTargetMapApplies(input.confirmation) || viewPackEnabled(input.confirmationProfile, 'currentTargetMap');
  const renderedSectionOrder = Array.isArray(input.renderedSectionOrder)
    ? input.renderedSectionOrder
    : renderedSectionsForProfile(input.confirmationProfile);
  return {
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourcePath: normalizePathForReport(input.sourcePath),
    sourceType: input.sourceType,
    entryFlow: input.entryFlow,
    entryFlowClass: input.entryFlowClass,
    workflowAdapter: input.workflowAdapter,
    sourceDocumentHash: input.sourceDocumentHash,
    sourceDocumentHashScope: 'semantic_source_excluding_confirmation_bookkeeping',
    implementationConfirmationHash: input.implementationConfirmationHash,
    implementationConfirmationHashScope: 'semantic_implementation_confirmation_excluding_bookkeeping',
    confirmationPageHash: input.confirmationPageHash,
    confirmationPageHashScope:
      input.args.mode === 'closeout-review'
        ? 'scope_confirmation_hash_compatibility_field_not_closeout_authority'
        : 'html_normalized_with_self_hash_placeholder_and_generated_at_excluded',
    closeoutConfirmationPageHash: input.closeoutConfirmationPageHash ?? null,
    renderedCloseoutCompatibilityHash:
      input.args.mode === 'closeout-review' ? input.renderedConfirmationPageHash ?? null : null,
    closeoutConfirmationHashScope: input.closeoutConfirmationHashScope ?? null,
    closeoutProjectionIdentity: input.closeoutProjectionIdentity ?? null,
    closeoutConfirmInstruction: input.closeoutConfirmInstruction ?? null,
    deliveryCloseoutReportHash: input.deliveryCloseoutReportHash ?? null,
    actualHtmlFileHash: input.actualHtmlFileHash,
    generatedAt: input.generatedAt,
    language: input.args.language,
    mode: input.args.mode,
    confirmationProfile: input.confirmationProfile?.confirmationProfile ?? DEFAULT_CONFIRMATION_PROFILE,
    requiredViewPacks: input.confirmationProfile?.requiredViewPacks ?? CORE_VIEW_PACKS,
    optionalViewPacks: input.confirmationProfile?.optionalViewPacks ?? [],
    enabledViewPacks: input.confirmationProfile?.enabledViewPacks ?? CORE_VIEW_PACKS,
    optionalViewPacksSkipped: input.confirmationProfile?.optionalViewPacksSkipped ?? GOVERNANCE_VIEW_PACKS,
    unknownViewPacks: input.confirmationProfile?.unknownViewPacks ?? [],
    confirmability: input.confirmability,
    scopeConfirmability: input.confirmability,
    preConfirmationSemanticDrilldown: input.preConfirmationSemanticDrilldown,
    deliveryReadiness: input.deliveryReadiness,
    preCloseoutDiagnostic: input.args.mode === 'closeout-review' ? input.deliveryReadiness : null,
    closeoutDeliveryVerdict: input.closeoutDeliveryVerdict ?? null,
    closeoutGateMatrix: input.closeoutGateMatrix ?? null,
    closeoutAttemptHistory: input.closeoutAttemptHistory ?? null,
    runtimeEvidenceClosureSummary: input.runtimeEvidenceClosureSummary ?? null,
    sourceProjectionDiagnostics: input.sourceProjectionDiagnostics ?? null,
    sourceCloseoutPolicyCoverage:
      input.args.mode === 'closeout-review'
        ? {
            postCloseoutConfirmationReviewFields: Object.keys(
              input.confirmation?.postCloseoutConfirmationReview ?? {}
            ),
            closeoutReadinessPreviewFields: Object.keys(input.confirmation?.closeoutReadinessPreview ?? {}),
            suggestedCommandIds: asArray(input.confirmation?.suggestedCommands).map((row) =>
              firstString(row?.id, row?.commandId)
            ),
            mustDerivedProjectionMapIds: asArray(input.confirmation?.mustDerivedProjectionMap).map((row) =>
              firstString(row?.id)
            ),
            aiTddContractExecutionManifestProjectionFields: Object.keys(
              input.confirmation?.aiTddContractExecutionManifestProjection ?? {}
            ),
          }
        : null,
    finalAcceptanceReview: input.finalAcceptanceReview,
    blockingIssues: input.blockingIssues,
    warnings: input.warnings,
    diagramCoverage: input.coverage.diagramCoverage,
    traceCoverage: input.coverage.traceCoverage,
    traceExecutionState: input.traceExecutionState ?? null,
    progressDelta: input.progressDelta ?? null,
    requirementBoundary: input.requirementBoundary ?? null,
    artifactAutomationCoverage: input.coverage.artifactAutomationCoverage,
    targetModificationPathCoverage: input.coverage.targetModificationPathCoverage,
    aiTddContractManifestCoverage: input.coverage.aiTddContractManifestCoverage,
    targetModificationPaths: input.targetModificationPaths,
    acceptanceCoverage: input.coverage.acceptanceCoverage,
    currentTargetCoverage: currentTargetEnabled ? input.currentTargetCoverage : emptyCurrentTargetCoverage(),
    currentTargetSchemaVersion: currentTargetEnabled ? input.currentTargetSchemaVersion : '',
    currentTargetDisplayProfile: currentTargetEnabled ? input.currentTargetDisplayProfile : '',
    currentTargetTableCoverage: currentTargetEnabled ? input.currentTargetTableCoverage : emptyCurrentTargetTableCoverage(),
    currentTargetRealization:
      input.args.mode === 'closeout-review'
        ? {
            rows: asArray(input.currentTargetMap?.targetRealization),
            summary: input.currentTargetMap?.targetRealizationSummary ?? null,
          }
        : null,
    currentTargetSchemaIssues: currentTargetEnabled ? input.currentTargetSchemaIssues : [],
    governanceEventTypeRegistry: input.governanceEventTypeRegistry ?? {},
    governanceEventTypeSchemaIssues: input.governanceEventTypeSchemaIssues ?? [],
    controlledIngestWriterRegistry: input.controlledIngestWriterRegistry ?? [],
    controlledIngestWriterCoverage: input.controlledIngestWriterCoverage ?? {
      eventTypeToWriters: {},
      controlFieldToWriters: {},
      uncoveredEventTypes: [],
    },
    controlledIngestWriterSchemaIssues: input.controlledIngestWriterSchemaIssues ?? [],
    reconfirmationRequest: input.reconfirmationState ?? null,
    confirmationDriftClassification: input.reconfirmationState?.driftClassification ?? null,
    renderedSectionOrder,
    reconfirmationBannerRendered: renderedSectionOrder.includes('reconfirmation-request'),
    reconfirmationEvidenceVerdict:
      input.reconfirmationState?.evidenceBundle?.sufficiencyVerdict ?? null,
    reconfirmationPrimaryProofRefs: asArray(
      input.reconfirmationState?.evidenceBundle?.items
    ).flatMap((item) => stringList(item?.proofRefs)),
    resumeFailureCaseCoverage: {
      status: input.resumeFailureRegistry?.status ?? null,
      caseCount: input.resumeFailureRegistry?.cases?.length ?? 0,
      groupCount: Object.keys(input.resumeFailureRegistry?.groups ?? {}).length,
      schemaIssueCount: input.resumeFailureRegistry?.schemaIssues?.length ?? 0,
      schemaIssues: input.resumeFailureRegistry?.schemaIssues ?? [],
      fullLinkExecutableSubsetRequired:
        input.resumeFailureRegistry?.fullLinkExecutableSubsetRequired ?? input.resumeFailureRegistry?.p0ExecutableSubsetRequired ?? false,
      fullLinkRequiredFixtureCases: input.resumeFailureRegistry?.fullLinkRequiredFixtureCases ?? input.resumeFailureRegistry?.p0RequiredFixtureCases ?? [],
      phase4_5Coverage: input.resumeFailureRegistry?.phase4_5Coverage ?? [],
      phase5HardeningCoverage: input.resumeFailureRegistry?.phase5HardeningCoverage ?? [],
      governanceEventTypeRefs: input.resumeFailureRegistry?.governanceEventTypeRefs ?? {},
      groupDefinitions: input.resumeFailureRegistry?.groupDefinitions ?? {},
      recoveryActionDefinitions: input.resumeFailureRegistry?.recoveryActionDefinitions ?? {},
      cases: (input.resumeFailureRegistry?.cases ?? []).map((item) => ({
        caseId: item.caseId,
        groupId: item.groupId,
        coveragePhase: item.coveragePhase,
        fullLinkRequired: item.fullLinkRequired,
        triggerSignal: item.triggerSignal,
        detectionPoint: item.detectionPoint,
        failClosedGate: item.failClosedGate,
        failureRecordType: item.failureRecordType,
        expectedRecoveryActions: item.expectedRecoveryActions,
        requiredTraceRefs: item.requiredTraceRefs,
        requiredEvidenceRefs: item.requiredEvidenceRefs,
      })),
      groups: Object.fromEntries(
        Object.entries(input.resumeFailureRegistry?.groups ?? {}).map(([group, cases]) => [
          group,
          cases.map((item) => item.caseId),
        ])
      ),
    },
    confirmInstruction: input.confirmInstruction,
    artifactRef: {
      artifactType: 'confirmation_view',
      sourceOfTruthRole: 'projection',
      path: normalizePathForReport(input.outPath),
      hash: input.confirmationPageHash,
      hashScope: 'html_normalized_with_self_hash_placeholder',
      actualFileHash: input.actualHtmlFileHash,
      recordId: input.recordId,
      requirementSetId: input.requirementSetId,
    },
    mermaidRuntime: {
      available: input.mermaidRuntime?.available ?? false,
      path: input.mermaidRuntime?.path ?? null,
      hash: input.mermaidRuntime?.hash ?? null,
      format: input.mermaidRuntime?.format ?? null,
      issues: input.mermaidRuntime?.issues ?? [],
    },
    renderedSections: renderedSectionOrder,
  };
}

function buildSummary(report, confirmation, views, artifactPlan) {
  return {
    recordId: report.recordId,
    sourcePath: report.sourcePath,
    sourceDocumentHash: report.sourceDocumentHash,
    implementationConfirmationHash: report.implementationConfirmationHash,
    confirmationPageHash: report.confirmationPageHash,
    closeoutConfirmationPageHash: report.closeoutConfirmationPageHash ?? null,
    closeoutConfirmInstruction: report.closeoutConfirmInstruction ?? null,
    closeoutConfirmationHashScope: report.closeoutConfirmationHashScope ?? null,
    closeoutProjectionIdentity: report.closeoutProjectionIdentity ?? null,
    deliveryCloseoutReportHash: report.deliveryCloseoutReportHash ?? null,
    language: report.language,
    generatedAt: report.generatedAt,
    confirmability: report.confirmability,
    scopeConfirmability: report.scopeConfirmability,
    preConfirmationSemanticDrilldown: report.preConfirmationSemanticDrilldown,
    blockingIssues: report.blockingIssues,
    deliveryReadiness: report.deliveryReadiness,
    preCloseoutDiagnostic: report.preCloseoutDiagnostic ?? null,
    closeoutDeliveryVerdict: report.closeoutDeliveryVerdict ?? null,
    closeoutGateMatrix: report.closeoutGateMatrix ?? null,
    closeoutAttemptHistory: report.closeoutAttemptHistory ?? null,
    runtimeEvidenceClosureSummary: report.runtimeEvidenceClosureSummary ?? null,
    sourceProjectionDiagnostics: report.sourceProjectionDiagnostics ?? null,
    sourceCloseoutPolicyCoverage: report.sourceCloseoutPolicyCoverage ?? null,
    finalAcceptanceReview: report.finalAcceptanceReview ?? null,
    renderedSectionOrder: report.renderedSectionOrder ?? [],
    warnings: report.warnings,
    mermaidRuntime: report.mermaidRuntime,
    aiTddContractManifestCoverage: report.aiTddContractManifestCoverage,
    requirementBoundary: report.requirementBoundary,
    progressDelta: report.progressDelta ?? null,
    currentTargetRealization: report.currentTargetRealization ?? null,
    counts: {
      must: asArray(confirmation.must).length,
      notDone: asArray(confirmation.notDone).length,
      mustNot: asArray(confirmation.mustNot).length,
      evidence: asArray(confirmation.evidence).length,
      acceptanceTests: report.acceptanceCoverage?.counts?.acceptanceTests ?? 0,
      e2eSuites: report.acceptanceCoverage?.counts?.e2eSuites ?? 0,
      failurePaths: asArray(confirmation.failurePaths).length,
      edgeCases: asArray(confirmation.edgeCases).length,
      traceRows: asArray(confirmation.traceRows).length,
      sequenceViews: views.sequenceViews.length,
      resumeFailureCases: report.resumeFailureCaseCoverage?.caseCount ?? 0,
      targetModificationPaths: report.targetModificationPaths?.length ?? 0,
      aiTddManifestSections: Object.keys(report.aiTddContractManifestCoverage?.sections ?? {}).length,
      artifactPlanItems: artifactPlan.length,
    },
  };
}

function companionOutputPaths(outPath, mode) {
  if (mode === 'closeout-review') {
    const parsed = path.parse(outPath);
    const basename = path.join(parsed.dir, parsed.name);
    return {
      summaryPath: `${basename}.summary.json`,
      reportPath: `${basename}.render-report.json`,
    };
  }
  return {
    summaryPath: path.join(path.dirname(outPath), 'confirmation-summary.json'),
    reportPath: path.join(path.dirname(outPath), 'confirmation-render-report.json'),
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const cliIssues = validateInput(args);
  if (cliIssues.length) {
    console.error(JSON.stringify({ ok: false, blockingIssues: cliIssues }, null, 2));
    return 2;
  }

  const sourcePath = path.resolve(args.source);
  const outPath = path.resolve(args.out);
  let sourceText = '';
  let confirmation;
  let blockText = '';
  try {
    sourceText = readText(sourcePath);
    const extracted = extractImplementationConfirmation(sourceText);
    confirmation = extracted.confirmation;
    blockText = extracted.blockText;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ ok: false, blockingIssues: [blocking('source_parse_failed', msg)] }, null, 2));
    return 2;
  }

  const generatedAt = new Date().toISOString();
  const recordId = args.recordId ?? confirmation.recordId ?? 'unrecorded';
  const requirementSetId = args.requirementSetId ?? confirmation.requirementSetId ?? '';
  const entryFlow = args.entryFlow ?? confirmation.entryFlow ?? 'story';
  const entryFlowClass =
    args.entryFlowClass ??
    confirmation.entryFlowClass ??
    (entryFlow === 'bugfix'
      ? 'corrective_entry'
      : entryFlow === 'standalone_tasks'
        ? 'task_packet_entry'
        : 'full_story_entry');
  const workflowAdapter = args.workflowAdapter ?? confirmation.workflowAdapter ?? (entryFlow === 'story' ? 'bmad' : 'direct');
  const sourceType = inferSourceType(sourcePath, sourceText, entryFlow);
  const sourceDocumentHash = sourceDocumentHashFor(sourceText, blockText, confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  const confirmationProfile = resolveConfirmationProfile(confirmation);
  const governanceEventTypes = normalizeGovernanceEventTypeRegistry(confirmation);
  const controlledIngestWriters = normalizeControlledIngestWriterRegistry(confirmation, governanceEventTypes);
  const resumeFailureRegistry = normalizeFunctionalResumeFailureCaseRegistry(
    confirmation.functionalResumeFailureCaseRegistry ?? extractFunctionalResumeFailureCaseRegistry(sourceText),
    governanceEventTypes.definitions
  );
  const externalPlan = args.artifactPlan ? readDataFile(path.resolve(args.artifactPlan)) : null;
  const artifactPlan = mergeArtifactPlans(confirmation.artifactAutomationPlan, externalPlan);
  const targetModificationPaths = normalizeTargetModificationPaths(confirmation, artifactPlan);
  const views = normalizeViews(confirmation);
  const mermaidBlocks = uniqueBlocks([
    ...buildDerivedMermaidBlocks(confirmation, views),
    ...extractMermaidBlocks(sourceText),
  ]);
  const requirementBoundary = inferRequirementBoundary(confirmation, views, mermaidBlocks);
  const traceRows = enrichTraceRowsWithBoundaryCoverage(confirmation.traceRows, views.boundaryViews);
  const requirementRecordState = readRequirementRecord(args, recordId);
  const driftClassification = classifyConfirmationDrift({
    confirmation,
    requirementRecord: requirementRecordState,
    renderReport: null,
    currentHashes: {
      sourceDocumentHash,
      implementationConfirmationHash,
    },
  });
  const reconfirmationState = buildReconfirmationState(
    confirmation,
    {
      sourceDocumentHash,
      implementationConfirmationHash,
    },
    driftClassification
  );
  const traceExecutionState = buildTraceExecutionState({
    traceRows,
    requirementRecordState,
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationHash: args.architectureConfirmationHash ?? confirmation.architectureConfirmationHash ?? '',
  });
  const ui = getUiText(args.language);
  const closeoutReportState = readCloseoutReport(args, requirementRecordState);
  const currentCloseoutAttempt = latestCloseoutAttempt(
    requirementRecordState.record,
    traceExecutionState.currentAttemptId
  );
  const sourceProjectionDiagnostics = buildSourceProjectionDiagnostics(confirmation, traceRows);
  const closeoutGateMatrix = buildCloseoutGateMatrix(closeoutReportState, currentCloseoutAttempt);
  const closeoutAttemptHistory = buildCloseoutAttemptHistory(requirementRecordState.record);
  const runtimeEvidenceClosureSummary = buildRuntimeEvidenceClosureSummary(requirementRecordState.record);
  const externalCurrentTargetMap = args.currentTargetMap ? readDataFile(path.resolve(args.currentTargetMap)) : null;
  const currentTargetRequired = currentTargetMapApplies(confirmation);
  const mergedCurrentTargetMap = mergeCurrentTargetMaps(confirmation.currentTargetMap, externalCurrentTargetMap, {
    enabled: currentTargetRequired || viewPackEnabled(confirmationProfile, 'currentTargetMap'),
  });
  const preliminaryProgressDelta = buildProgressDelta({
    confirmation,
    traceRows,
    traceExecutionState,
    reconfirmationState,
    ui,
    sourceProjectionDiagnostics,
    closeoutRuntimeReady: false,
  });
  const preliminaryDeliveryReadiness = buildDeliveryReadiness(preliminaryProgressDelta, traceExecutionState, ui);
  const preliminaryFinalAcceptanceReview = buildFinalAcceptanceReview({
    args,
    traceRows,
    traceExecutionState,
    requirementRecordState,
    deliveryReadiness: preliminaryDeliveryReadiness,
  });
  const preliminaryCloseoutDeliveryVerdict = buildCloseoutDeliveryVerdict({
    args,
    finalAcceptanceReview: preliminaryFinalAcceptanceReview,
    closeoutGateMatrix,
    sourceProjectionDiagnostics,
    closeoutReportHash: closeoutReportState.hash,
  });
  const progressDelta = buildProgressDelta({
    confirmation,
    traceRows,
    traceExecutionState,
    reconfirmationState,
    ui,
    sourceProjectionDiagnostics,
    closeoutRuntimeReady: preliminaryCloseoutDeliveryVerdict.ready === true,
  });
  const deliveryReadiness = buildDeliveryReadiness(progressDelta, traceExecutionState, ui);
  const finalAcceptanceReview = buildFinalAcceptanceReview({
    args,
    traceRows,
    traceExecutionState,
    requirementRecordState,
    deliveryReadiness,
  });
  const closeoutDeliveryVerdict = buildCloseoutDeliveryVerdict({
    args,
    finalAcceptanceReview,
    closeoutGateMatrix,
    sourceProjectionDiagnostics,
    closeoutReportHash: closeoutReportState.hash,
  });
  const currentTargetMap = buildTargetRealizationProjection({
    args,
    currentTargetMap: mergedCurrentTargetMap,
    finalAcceptanceReview,
    closeoutGateMatrix,
    traceExecutionState,
  });
  const coverage = buildCoverage({
    confirmation,
    traceRows,
    sequenceViews: views.sequenceViews,
    flowViews: views.flowViews,
    edgeCaseViews: views.edgeCaseViews,
    boundaryViews: views.boundaryViews,
    artifactPlan,
    targetModificationPaths,
    mermaidBlocks,
    reconfirmationState,
  });
  coverage.blockingIssues.push(...validateConfirmationProfile(confirmation, confirmationProfile, currentTargetMap));
  coverage.blockingIssues.push(...validateOwnerModelPolicy(confirmation, artifactPlan));
  if (currentTargetRequired || viewPackEnabled(confirmationProfile, 'currentTargetMap')) {
    coverage.blockingIssues.push(...currentTargetMap.schemaIssues);
  }
  coverage.blockingIssues.push(...governanceEventTypes.schemaIssues);
  coverage.blockingIssues.push(...controlledIngestWriters.schemaIssues);
  coverage.blockingIssues.push(...validateConditionalApplicabilityModules(confirmation, resumeFailureRegistry));
  coverage.blockingIssues.push(...validateArtifactPlanEventTypes(artifactPlan, governanceEventTypes.definitions));
  coverage.blockingIssues.push(...resumeFailureRegistry.schemaIssues);
  coverage.blockingIssues.push(...validateConfirmationLanguageContent(confirmation, args.language));

  if (confirmation.status === 'user_confirmed') {
    coverage.warnings.push(warning('source_already_user_confirmed', 'renderer does not confirm or change status'));
  }
  if (String(sourceText).includes('confirmationHistory:')) {
    coverage.blockingIssues.push(blocking('confirmation_history_present', 'source already contains confirmationHistory; renderer will not write it'));
  }
  const mermaidRuntime = readMermaidRuntimeScript(args);
  coverage.blockingIssues.push(...asArray(mermaidRuntime.issues));
  if (mermaidBlocks.length && !mermaidRuntime.available && args.allowMermaidFallback !== true) {
    coverage.blockingIssues.push(
      blocking(
        mermaidRuntime.issues?.length ? 'invalid_mermaid_runtime' : 'missing_mermaid_runtime',
        mermaidRuntime.issues?.length
          ? 'Mermaid blocks exist but the configured Mermaid runtime cannot be safely embedded; use a browser classic Mermaid bundle such as dist/mermaid.min.js'
          : 'Mermaid blocks exist but no local Mermaid runtime is available; install mermaid or pass --mermaid-bundle to render real sequence/flow diagrams'
      )
    );
  }
  const preConfirmationSemanticDrilldown = loadPreConfirmationSemanticDrilldown(args, confirmation, {
    sourceDocumentHash,
    implementationConfirmationHash,
  });
  coverage.blockingIssues.push(...preConfirmationSemanticDrilldown.blockingIssues);
  coverage.warnings.push(...preConfirmationSemanticDrilldown.warnings);

  const confirmability = coverage.blockingIssues.length ? 'blocked' : 'confirmable';
  const scopeConfirmInstruction = [
    confirmation.confirmPhrase ?? ui.confirmPhrase,
    `sourceDocumentHash=${sourceDocumentHash}`,
    `implementationConfirmationHash=${implementationConfirmationHash}`,
    `confirmationPageHash=${SELF_PAGE_HASH_PLACEHOLDER}`,
  ].join('\n');
  const closeoutProjection = closeoutProjectionIdentity(
    outPath,
    recordId,
    closeoutDeliveryVerdict.currentAttemptId
  );
  const closeoutConfirmInstruction = buildCloseoutConfirmInstruction({
    sourceDocumentHash,
    implementationConfirmationHash,
    closeoutAttemptId: closeoutDeliveryVerdict.currentAttemptId,
    deliveryCloseoutReportHash: closeoutReportState.hash,
  });
  const confirmInstruction =
    args.mode === 'closeout-review' ? closeoutConfirmInstruction : scopeConfirmInstruction;
  const htmlWithSelfHashPlaceholder = buildHtml({
    args,
    sourceType,
    sourcePath,
    recordId,
    requirementSetId,
    entryFlow,
    entryFlowClass,
    workflowAdapter,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash: SELF_PAGE_HASH_PLACEHOLDER,
    generatedAt,
    confirmation,
    confirmability,
    confirmInstruction,
    blockingIssues: coverage.blockingIssues,
    warnings: coverage.warnings,
    mermaidBlocks,
    views,
    traceRows,
    artifactPlan,
    targetModificationPaths,
    currentTargetMap,
    confirmationProfile,
    traceExecutionState,
    progressDelta,
    deliveryReadiness,
    closeoutDeliveryVerdict,
    closeoutGateMatrix,
    closeoutAttemptHistory,
    runtimeEvidenceClosureSummary,
    sourceProjectionDiagnostics,
    finalAcceptanceReview,
    reconfirmationState,
    resumeFailureRegistry,
    controlledIngestWriters,
    mermaidRuntime,
    requirementBoundary,
    preConfirmationSemanticDrilldown,
    coverage,
  });
  const renderedSectionOrder = [
    'fingerprint',
    ...(reconfirmationState?.required ? ['reconfirmation-request'] : []),
    'core-design',
    'delivery-readiness',
    ...(finalAcceptanceReview.applies ? ['final-acceptance-review'] : []),
    ...(closeoutDeliveryVerdict.applies
      ? [
          'closeout-gate-result-matrix',
          'closeout-attempt-history',
          'runtime-evidence-closure-summary',
          'source-closeout-policy',
        ]
      : []),
    'progress-delta',
    'pre-confirmation-semantic-drilldown',
    'decision-summary',
    'confirm-instruction',
    'requirements',
    'requirement-boundary',
    'business-visuals',
    'governance-visuals',
    'resume-failure-cases',
    'trace-matrix',
    ...(viewPackEnabled(confirmationProfile, 'currentTargetMap') ? ['current-target'] : []),
    'ai-tdd-contract-manifest',
    'target-modification-paths',
    'artifact-plan',
    'controlled-ingest-writers',
    'architecture-impact',
    'entry-flow',
    'scoring-dashboard-sft',
    'closeout-preview',
    'blocking-issues',
    'warnings',
    'eight-questions',
  ];
  const renderedConfirmationPageHash = confirmationPageHashFor(
    htmlWithSelfHashPlaceholder.replaceAll(SELF_CLOSEOUT_PAGE_HASH_PLACEHOLDER, SELF_PAGE_HASH_PLACEHOLDER),
    generatedAt
  );
  const closeoutConfirmationPageHash =
    args.mode === 'closeout-review'
      ? closeoutConfirmationPageHashFor(htmlWithSelfHashPlaceholder, generatedAt)
      : null;
  const confirmationPageHash =
    args.mode === 'closeout-review'
      ? scopeConfirmationPageHashForCloseout(requirementRecordState, confirmation) || renderedConfirmationPageHash
      : renderedConfirmationPageHash;
  const finalConfirmInstruction = confirmInstruction
    .replaceAll(SELF_PAGE_HASH_PLACEHOLDER, confirmationPageHash)
    .replaceAll(SELF_CLOSEOUT_PAGE_HASH_PLACEHOLDER, closeoutConfirmationPageHash ?? confirmationPageHash);
  const finalHtml = htmlWithSelfHashPlaceholder.replaceAll(
    SELF_PAGE_HASH_PLACEHOLDER,
    confirmationPageHash
  ).replaceAll(SELF_CLOSEOUT_PAGE_HASH_PLACEHOLDER, closeoutConfirmationPageHash ?? confirmationPageHash);
  const actualHtmlFileHash = sha256(finalHtml);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, finalHtml, 'utf8');
  if (args.mode === 'closeout-review' && closeoutProjection.outputRole === 'current_alias_projection') {
    const canonicalPath = path.resolve(closeoutProjection.canonicalPath);
    fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
    fs.writeFileSync(canonicalPath, finalHtml, 'utf8');
  }

  const common = {
    args,
    recordId,
    requirementSetId,
    sourcePath,
    outPath,
    sourceType,
    entryFlow,
    entryFlowClass,
    workflowAdapter,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    renderedConfirmationPageHash,
    closeoutConfirmationPageHash,
    closeoutConfirmInstruction:
      args.mode === 'closeout-review' ? finalConfirmInstruction : null,
    closeoutConfirmationHashScope:
      args.mode === 'closeout-review'
        ? 'closeout_html_normalized_with_self_hash_placeholder_and_generated_at_excluded'
        : null,
    closeoutProjectionIdentity: closeoutProjection,
    deliveryCloseoutReportHash: closeoutReportState.hash ?? null,
    actualHtmlFileHash,
    generatedAt,
    confirmation,
    confirmability,
    deliveryReadiness,
    closeoutDeliveryVerdict,
    closeoutGateMatrix,
    closeoutAttemptHistory,
    runtimeEvidenceClosureSummary,
    sourceProjectionDiagnostics,
    confirmInstruction: finalConfirmInstruction,
    blockingIssues: coverage.blockingIssues,
    warnings: coverage.warnings,
    coverage,
    confirmationProfile,
    currentTargetMap,
    targetModificationPaths,
    currentTargetCoverage: countCurrentTargetRows(currentTargetMap),
    currentTargetSchemaVersion: currentTargetMap.schemaVersion,
    currentTargetDisplayProfile: currentTargetMap.displayProfile,
    currentTargetTableCoverage: currentTargetMap.tableCoverage,
    currentTargetSchemaIssues: currentTargetMap.schemaIssues,
    traceExecutionState,
    progressDelta,
    deliveryReadiness,
    finalAcceptanceReview,
    governanceEventTypeRegistry: Object.fromEntries(governanceEventTypes.definitions.entries()),
    governanceEventTypeSchemaIssues: governanceEventTypes.schemaIssues,
    controlledIngestWriterRegistry: controlledIngestWriters.rows,
    controlledIngestWriterCoverage: controlledIngestWriters.coverage,
    controlledIngestWriterSchemaIssues: controlledIngestWriters.schemaIssues,
    reconfirmationState,
    resumeFailureRegistry,
    mermaidRuntime,
    requirementBoundary,
    preConfirmationSemanticDrilldown,
    renderedSectionOrder,
  };
  const report = buildReport(common);
  const summary = buildSummary(report, confirmation, views, artifactPlan);
  const { summaryPath, reportPath } = companionOutputPaths(outPath, args.mode);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    console.log(`confirmation.html=${normalizePathForReport(outPath)}`);
    console.log(`confirmation-summary.json=${normalizePathForReport(summaryPath)}`);
    console.log(`confirmation-render-report.json=${normalizePathForReport(reportPath)}`);
    console.log(`scopeConfirmability=${confirmability}`);
    console.log(`deliveryReadiness=${deliveryReadiness.label}`);
  }

  if (
    args.strict !== false &&
    (coverage.blockingIssues.length ||
      (finalAcceptanceReview.applies && !finalAcceptanceReview.ready) ||
      (closeoutDeliveryVerdict.applies && !closeoutDeliveryVerdict.ready))
  ) {
    return 3;
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ ok: false, error: msg }, null, 2));
    process.exitCode = 2;
  }
}

module.exports = {
  main,
  parseArgs,
  extractImplementationConfirmation,
  extractMermaidBlocks,
  buildCoverage,
};
