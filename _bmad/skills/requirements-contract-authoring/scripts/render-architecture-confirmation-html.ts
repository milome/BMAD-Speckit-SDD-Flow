#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('./load-js-yaml');

const VALID_LANGUAGES = new Set(['zh-CN', 'en-US', 'bilingual']);
const VALID_THEMES = new Set(['readable', 'compact', 'audit']);
const DEFAULT_RECIPE_PATH = '_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml';
const EXPECTED_SCHEMA_VERSION = 'architecture-confirmation-hash-recipe.contract/v1';
const EXPECTED_RECIPE_VERSION = 'architecture-confirmation-hash/v1';
const REQUIRED_ARCHITECTURE_DIAGRAM_TYPES = [
  'system_architecture',
  'deployment',
  'class',
  'swimlane',
  'state_machine',
  'sequence',
  'activity',
];

function parseArgs(argv) {
  const args = { strict: true, language: 'zh-CN', theme: 'audit' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    args[key] = key === 'strict' ? value !== 'false' : value;
    index += 1;
  }
  return args;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function shortHash(value) {
  return text(value).replace(/^sha256:/u, '').slice(0, 12);
}

function readJson(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRepoPath(value, repoRoot = process.cwd()) {
  const raw = String(value || '').replace(/\\/gu, '/').trim();
  const root = repoRoot.replace(/\\/gu, '/').replace(/\/$/u, '');
  const withoutRoot = raw.startsWith(`${root}/`) ? raw.slice(root.length + 1) : raw;
  return path.posix
    .normalize(withoutRoot.replace(/^[a-zA-Z]:\//u, (drive) => drive.toLowerCase()))
    .replace(/^\.\//u, '')
    .replace(/\/$/u, '');
}

function readMermaidRuntimeScript() {
  const runtimePath = path.resolve(__dirname, '..', 'assets', 'mermaid', 'mermaid.min.js');
  try {
    const script = fs.readFileSync(runtimePath, 'utf8');
    return {
      available: true,
      path: normalizeRepoPath(runtimePath),
      hash: sha256Text(script),
      script,
    };
  } catch (error) {
    return {
      available: false,
      path: normalizeRepoPath(runtimePath),
      hash: '',
      script: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolveRecipe(configPath = DEFAULT_RECIPE_PATH) {
  const absoluteConfigPath = path.resolve(configPath);
  const config = yaml.load(fs.readFileSync(absoluteConfigPath, 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`ArchitectureConfirmationHashRecipe must be an object: ${configPath}`);
  }
  if (text(config.schemaVersion) !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(`ArchitectureConfirmationHashRecipe schemaVersion invalid: ${text(config.schemaVersion) || '<missing>'}`);
  }
  if (text(config.recipeVersion) !== EXPECTED_RECIPE_VERSION) {
    throw new Error(`ArchitectureConfirmationHashRecipe recipeVersion invalid: ${text(config.recipeVersion) || '<missing>'}`);
  }
  const resolvedWithoutHash = {
    schemaVersion: text(config.schemaVersion),
    recipeVersion: text(config.recipeVersion),
    configPath: normalizeRepoPath(absoluteConfigPath),
    canonicalization: object(config.canonicalization),
    pathNormalization: object(config.pathNormalization),
    fixedCategoryOrder: object(config.fixedCategoryOrder),
    volatileFieldsExcludedFromArtifactHash: array(config.volatileFieldsExcludedFromArtifactHash).map(text).filter(Boolean),
    stateTransitionHashCoverage: object(config.stateTransitionHashCoverage),
    controlledIngestRules: object(config.controlledIngestRules),
  };
  return { ...resolvedWithoutHash, resolvedRecipeHash: sha256Text(stableStringify(resolvedWithoutHash)) };
}

function architectureHashFor(confirmation, recipe) {
  const volatile = new Set([
    ...array(recipe.volatileFieldsExcludedFromArtifactHash).map(text),
    'artifactHash',
    'architectureConfirmationArtifactHash',
    'confirmationPhrase',
    'architectureConfirmationArtifactRef',
  ]);
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!volatile.has(key)) semantic[key] = value;
  }
  return sha256Text(stableStringify(semantic));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/gu, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    return '&quot;';
  });
}

function deriveSibling(outPath, suffix) {
  return outPath.replace(/\.html?$/iu, suffix);
}

function statusClass(value) {
  const normalized = text(value).toLowerCase();
  if (normalized.includes('triggered') && !normalized.includes('not_triggered')) return 'bad';
  if (normalized.includes('active') || normalized.includes('confirm') || normalized.includes('pass')) return 'good';
  if (normalized.includes('not_triggered') || normalized.includes('no_direct')) return 'good';
  return 'warn';
}

function renderValue(value) {
  if (Array.isArray(value)) return escapeHtml(value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('\n'));
  if (value && typeof value === 'object') return `<pre class="inline-json">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
  return escapeHtml(value ?? '');
}

function renderObjectTable(rows, preferredFields) {
  const objects = array(rows).filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  if (objects.length === 0) return '<p class="empty">源工件未提供该视图数据。</p>';
  const fieldSet = new Set(preferredFields);
  for (const row of objects) Object.keys(row).forEach((key) => fieldSet.add(key));
  const fields = Array.from(fieldSet).filter((field) => objects.some((row) => row[field] !== undefined));
  const head = fields.map((field) => `<th>${escapeHtml(field)}</th>`).join('');
  const body = objects
    .map((row) => {
      const cells = fields
        .map((field) => {
          const cls = field === 'status' || field === 'decision' ? ` class="${statusClass(row[field])}"` : '';
          return `<td${cls}>${renderValue(row[field])}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderPathTable(paths) {
  const rows = array(paths).map((item) => `<tr><td><code>${escapeHtml(item)}</code></td></tr>`).join('');
  return rows
    ? `<div class="table-wrap"><table><thead><tr><th>path</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<p class="empty">源工件未提供 targetPaths[]。</p>';
}

function renderList(values) {
  const items = array(values).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  return items || '<span class="empty">none</span>';
}

function getUiText(language) {
  const zh = {
    titlePrefix: '架构确认',
    navTitle: '架构确认导航',
    navSummary: '确认摘要',
    navDelta: '确认重点',
    navBusinessDiagrams: '业务架构图谱',
    navGovernanceDiagrams: '治理架构图谱',
    navImpact: '影响扫描',
    navTriggers: '触发矩阵',
    navPaths: '目标路径',
    navHash: 'Hash Recipe',
    navRisk: '风险与回滚',
    navPhrase: '确认口令',
    navMetadata: '工件元数据',
    draftTitleSuffix: '架构确认草案',
    projectionNote: '该页面是 requirement-scoped 架构确认 JSON 的用户可读投影。它不写入 architectureConfirmations[]，确认后必须通过 controlled ingest 写入。',
    confirmationScope: '确认范围',
    currentDecision: '当前结论',
    currentDecisionText: (count) => `命中 ${count} 个完整架构触发项；必须先确认架构再进入实施准备。`,
    userNextStep: '用户下一步',
    userNextStepText: '回到 chat 粘贴确认口令。HTML 内不能点击确认。',
    blockers: '阻断项',
    fingerprint: '确认指纹',
    architectureDelta: '本次架构确认重点',
    architectureDeltaLead: '本区先展示本次确认真正需要 review 的架构影响、有效范围和 stale 输入；完整 targetPaths 与触发矩阵保留在下方作为明细。',
    targetPaths: '目标路径',
    consumerTriggered: '消费项目触发项',
    governanceTriggered: '治理系统触发项',
    architectureRulesTriggered: '架构规则触发项',
    staleInputs: 'stale/hash 输入',
    reviewRows: '重点 review 行',
    focusRows: '重点影响行',
    targetPathSamples: '有效路径样例',
    businessArchitectureDiagrams: '业务架构图谱',
    businessArchitectureDiagramsLead: '本区聚焦消费项目业务行为、用户界面、设置状态和验收路径；缺少任一必需业务视图都不能进入实施准备。',
    governanceArchitectureDiagrams: '治理架构图谱',
    governanceArchitectureDiagramsLead: '本区保留确认、ingest、record 和 hash recipe 的治理架构视图，用于审阅流程控制边界。',
    diagramEvidenceRefs: '证据',
    diagramTargetPathRefs: '目标路径',
    diagramViewer: '架构图查看器',
    previousDiagram: '上一图',
    nextDiagram: '下一图',
    expandDiagrams: '展开全部',
    singleDiagram: '单图模式',
    mermaidRuntimeMissing: 'Mermaid runtime 不可用；保留源码但不能渲染为图。',
    mermaidRuntimeEmbedded: 'Mermaid runtime embedded',
    businessMermaidVisual: '业务 Mermaid 图',
    governanceMermaidVisual: '治理 Mermaid 图',
    fallbackDiagram: '紧凑 fallback 图',
    mermaidSource: 'Mermaid 源码和 diagramHash',
    diagramLabels: {
      system_architecture: '系统架构图',
      deployment: '部署图',
      class: '类图',
      swimlane: '泳道图',
      state_machine: '状态机图',
      sequence: '时序图',
      activity: '活动图',
    },
    noTriggeredRows: '当前没有触发项。',
    noStaleInputs: '源工件未提供 staleInputs。',
    consumerImpactScan: '消费项目影响扫描',
    governanceImpactScan: '治理系统影响扫描',
    fullTriggerMatrix: '完整架构触发矩阵',
    targetPathsCount: (count) => `${count} 个 targetPaths`,
    hashRecipeAndStaleInputs: 'Hash Recipe 与 stale 输入',
    recipe: 'Recipe',
    riskAndRollback: '风险与回滚',
    missingRisk: '源工件未提供 riskStatement。',
    missingRollback: '源工件未提供 rollbackPlan。',
    evidence: 'Evidence',
    confirmationPhrase: '确认口令',
    copyPhrase: '复制确认口令',
    copyMissing: '未找到确认口令。',
    copyDone: '确认口令已复制。',
    copyFailed: '复制失败，请手动选择口令。',
    metadata: '工件元数据',
  };
  const en = {
    titlePrefix: 'Architecture Confirmation',
    navTitle: 'Architecture Confirmation Navigation',
    navSummary: 'Summary',
    navDelta: 'Review Focus',
    navBusinessDiagrams: 'Business Diagrams',
    navGovernanceDiagrams: 'Governance Diagrams',
    navImpact: 'Impact Scan',
    navTriggers: 'Trigger Matrix',
    navPaths: 'Target Paths',
    navHash: 'Hash Recipe',
    navRisk: 'Risk And Rollback',
    navPhrase: 'Confirmation Phrase',
    navMetadata: 'Artifact Metadata',
    draftTitleSuffix: 'Architecture Confirmation Draft',
    projectionNote: 'This page is a user-readable projection of the requirement-scoped architecture confirmation JSON. It does not write architectureConfirmations[]; after user confirmation, controlled ingest must record it.',
    confirmationScope: 'Confirmation Scope',
    currentDecision: 'Current Decision',
    currentDecisionText: (count) => `${count} full-architecture trigger item(s) matched; architecture must be confirmed before implementation readiness.`,
    userNextStep: 'User Next Step',
    userNextStepText: 'Return to chat and paste the confirmation phrase. HTML cannot confirm anything.',
    blockers: 'Blockers',
    fingerprint: 'Confirmation Fingerprint',
    architectureDelta: 'Architecture Review Focus',
    architectureDeltaLead: 'This section shows the architecture impacts, effective scope, and stale inputs that need review first. Full targetPaths and trigger matrix details remain below.',
    targetPaths: 'Target Paths',
    consumerTriggered: 'Consumer impacts triggered',
    governanceTriggered: 'Governance impacts triggered',
    architectureRulesTriggered: 'Architecture rules triggered',
    staleInputs: 'Stale/hash inputs',
    reviewRows: 'Review-focus rows',
    focusRows: 'Focus Rows',
    targetPathSamples: 'Target Path Samples',
    businessArchitectureDiagrams: 'Business Architecture Diagrams',
    businessArchitectureDiagramsLead: 'This section focuses on consumer-project business behavior, UI surfaces, settings state, and acceptance paths. Missing any required business view blocks implementation readiness.',
    governanceArchitectureDiagrams: 'Governance Architecture Diagrams',
    governanceArchitectureDiagramsLead: 'This section preserves confirmation, ingest, record, and hash-recipe governance architecture views for process-control review.',
    diagramEvidenceRefs: 'Evidence',
    diagramTargetPathRefs: 'Target Paths',
    diagramViewer: 'Architecture Diagram Viewer',
    previousDiagram: 'Previous',
    nextDiagram: 'Next',
    expandDiagrams: 'Show All',
    singleDiagram: 'Single Diagram',
    mermaidRuntimeMissing: 'Mermaid runtime is unavailable; source is preserved but cannot be rendered as a diagram.',
    mermaidRuntimeEmbedded: 'Mermaid runtime embedded',
    businessMermaidVisual: 'Business Mermaid Diagram',
    governanceMermaidVisual: 'Governance Mermaid Diagram',
    fallbackDiagram: 'Compact fallback diagram',
    mermaidSource: 'Mermaid source and diagramHash',
    diagramLabels: {
      system_architecture: 'System Architecture Diagram',
      deployment: 'Deployment Diagram',
      class: 'Class Diagram',
      swimlane: 'Swimlane Diagram',
      state_machine: 'State Machine Diagram',
      sequence: 'Sequence Diagram',
      activity: 'Activity Diagram',
    },
    noTriggeredRows: 'No triggered rows.',
    noStaleInputs: 'The source artifact did not provide staleInputs.',
    consumerImpactScan: 'Consumer Impact Scan',
    governanceImpactScan: 'Governance Impact Scan',
    fullTriggerMatrix: 'Full Architecture Trigger Matrix',
    targetPathsCount: (count) => `${count} targetPaths`,
    hashRecipeAndStaleInputs: 'Hash Recipe And Stale Inputs',
    recipe: 'Recipe',
    riskAndRollback: 'Risk And Rollback',
    missingRisk: 'The source artifact did not provide riskStatement.',
    missingRollback: 'The source artifact did not provide rollbackPlan.',
    evidence: 'Evidence',
    confirmationPhrase: 'Confirmation Phrase',
    copyPhrase: 'Copy Confirmation Phrase',
    copyMissing: 'Confirmation phrase not found.',
    copyDone: 'Confirmation phrase copied.',
    copyFailed: 'Copy failed. Select the phrase manually.',
    metadata: 'Artifact Metadata',
  };
  if (language === 'en-US') return en;
  if (language === 'bilingual') {
    return Object.fromEntries(
      Object.keys(zh).map((key) => {
        if (typeof zh[key] === 'function') {
          return [key, (value) => `${zh[key](value)} / ${en[key](value)}`];
        }
        if (
          zh[key] &&
          typeof zh[key] === 'object' &&
          !Array.isArray(zh[key]) &&
          en[key] &&
          typeof en[key] === 'object' &&
          !Array.isArray(en[key])
        ) {
          return [
            key,
            Object.fromEntries(
              Object.keys(zh[key]).map((nestedKey) => [
                nestedKey,
                `${zh[key][nestedKey]} / ${en[key][nestedKey]}`,
              ])
            ),
          ];
        }
        return [key, `${zh[key]} / ${en[key]}`];
      })
    );
  }
  return zh;
}

function firstText(...values) {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return '';
}

function summarizeScanRows(rows) {
  const normalized = array(rows).map((row) => object(row));
  return {
    total: normalized.length,
    triggered: normalized.filter((row) => firstText(row.status, row.decision).includes('triggered') && !firstText(row.status, row.decision).includes('not_triggered')).length,
    reviewRows: normalized
      .filter((row) => firstText(row.status, row.decision).includes('triggered') || firstText(row.requiredDecision))
      .map((row) => ({
        category: firstText(row.category, row.trigger, row.name),
        status: firstText(row.status, row.decision),
        summary: firstText(row.summary, row.reason, row.description, row.requiredDecision),
      })),
  };
}

function buildArchitectureDelta(confirmation, validation) {
  const targetPaths = array(confirmation.targetPaths).map((item) => text(item)).filter(Boolean);
  const consumer = summarizeScanRows(confirmation.consumerImpactScan);
  const governance = summarizeScanRows(confirmation.governanceImpactScan);
  const triggers = summarizeScanRows(confirmation.fullArchitectureTriggerMatrix);
  const staleInputs = object(confirmation.staleInputs);
  const staleInputRows = Object.entries(staleInputs)
    .filter(([, value]) => text(value))
    .map(([field, value]) => ({ field, value: text(value) }));
  const reviewFocus = [
    ...consumer.reviewRows.map((row) => ({ source: 'consumerImpactScan', ...row })),
    ...governance.reviewRows.map((row) => ({ source: 'governanceImpactScan', ...row })),
    ...triggers.reviewRows.map((row) => ({ source: 'fullArchitectureTriggerMatrix', ...row })),
  ];
  return {
    targetPathCount: targetPaths.length,
    sampleTargetPaths: targetPaths.slice(0, 12),
    consumer,
    governance,
    triggers,
    staleInputRows,
    reviewFocus,
    blockingIssues: validation.blockingIssues,
    warnings: validation.warnings,
    counts: {
      targetPaths: targetPaths.length,
      triggeredConsumerImpacts: consumer.triggered,
      triggeredGovernanceImpacts: governance.triggered,
      triggeredArchitectureRules: triggers.triggered,
      staleInputs: staleInputRows.length,
      reviewFocus: reviewFocus.length,
    },
  };
}

function renderArchitectureDelta(delta, ui) {
  const focusRows = delta.reviewFocus.slice(0, 24).map((row) => [
    row.source,
    row.category,
    row.status,
    row.summary,
  ]);
  const staleRows = delta.staleInputRows.map((row) => [row.field, row.value]);
  return `<section id="architecture-delta" class="card">
      <h2>${escapeHtml(ui.architectureDelta)}</h2>
      <p class="muted">${escapeHtml(ui.architectureDeltaLead)}</p>
      <div class="metric-grid">
        <div class="metric"><strong>${escapeHtml(delta.counts.targetPaths)}</strong><span>${escapeHtml(ui.targetPaths)}</span></div>
        <div class="metric warn"><strong>${escapeHtml(delta.counts.triggeredConsumerImpacts)}</strong><span>${escapeHtml(ui.consumerTriggered)}</span></div>
        <div class="metric warn"><strong>${escapeHtml(delta.counts.triggeredGovernanceImpacts)}</strong><span>${escapeHtml(ui.governanceTriggered)}</span></div>
        <div class="metric warn"><strong>${escapeHtml(delta.counts.triggeredArchitectureRules)}</strong><span>${escapeHtml(ui.architectureRulesTriggered)}</span></div>
        <div class="metric"><strong>${escapeHtml(delta.counts.staleInputs)}</strong><span>${escapeHtml(ui.staleInputs)}</span></div>
        <div class="metric"><strong>${escapeHtml(delta.counts.reviewFocus)}</strong><span>${escapeHtml(ui.reviewRows)}</span></div>
      </div>
      <div class="review-flow">
        <section class="review-step">
          <h3>${escapeHtml(ui.focusRows)}</h3>
          ${focusRows.length ? renderObjectTable(focusRows.map(([source, category, status, summary]) => ({ source, category, status, summary })), ['source', 'category', 'status', 'summary']) : `<p class="empty">${escapeHtml(ui.noTriggeredRows)}</p>`}
        </section>
        <section class="review-step">
          <h3>${escapeHtml(ui.targetPathSamples)}</h3>
          <div class="pill-list">${renderList(delta.sampleTargetPaths)}</div>
        </section>
        <section class="review-step">
          <h3>Stale Inputs</h3>
          ${staleRows.length ? renderObjectTable(staleRows.map(([field, value]) => ({ field, value })), ['field', 'value']) : `<p class="empty">${escapeHtml(ui.noStaleInputs)}</p>`}
        </section>
      </div>
    </section>`;
}

function normalizeArchitectureDiagrams(confirmation, fieldName = 'architectureDiagrams', fallbackFieldName = '') {
  const byType = new Map();
  const hasPrimaryField = Object.prototype.hasOwnProperty.call(confirmation, fieldName);
  const primaryRows = array(confirmation[fieldName]);
  const sourceRows = hasPrimaryField ? primaryRows : array(fallbackFieldName ? confirmation[fallbackFieldName] : []);
  for (const row of sourceRows.map((item) => object(item))) {
    const type = text(row.type);
    if (type && !byType.has(type)) byType.set(type, row);
  }
  return REQUIRED_ARCHITECTURE_DIAGRAM_TYPES.map((type) => {
    const row = byType.get(type);
    return row
      ? {
          id: text(row.id) || `ARCH-VIEW-${type.toUpperCase().replace(/[^A-Z0-9]+/gu, '-')}`,
          type,
          title: text(row.title),
          description: text(row.description),
          mermaid: text(row.mermaid),
          evidenceRefs: array(row.evidenceRefs).map(text).filter(Boolean),
          targetPathRefs: array(row.targetPathRefs).map(text).filter(Boolean),
          triggerRefs: array(row.triggerRefs).map(text).filter(Boolean),
        }
      : {
          id: `ARCH-VIEW-${type.toUpperCase().replace(/[^A-Z0-9]+/gu, '-')}`,
          type,
          title: '',
          description: '',
          mermaid: '',
          evidenceRefs: [],
          targetPathRefs: [],
          triggerRefs: [],
          missing: true,
        };
  });
}

function architectureDiagramLabel(ui, type) {
  return text(ui.diagramLabels?.[type]) || type;
}

function inferMermaidDiagramKind(source) {
  const normalized = text(source);
  if (/^sequenceDiagram\b/iu.test(normalized)) return 'sequence';
  if (/^classDiagram\b/iu.test(normalized)) return 'class';
  if (/^stateDiagram(?:-v2)?\b/iu.test(normalized)) return 'state';
  if (/^(?:flowchart|graph)\b/iu.test(normalized)) return 'flowchart';
  return 'unknown';
}

function classifyCompactFallbackTone(label) {
  const normalized = String(label ?? '').toLowerCase();
  if (/block|fail|reject|missing|forbid|cannot|error|unsafe|mismatch|缺|阻断|失败|禁止|不能/u.test(normalized)) {
    return 'warn';
  }
  if (/pass|ok|confirm|ready|persist|write|link|active|索引|确认|通过|关闭|写入/u.test(normalized)) {
    return 'pass';
  }
  return '';
}

function simplifyMermaidLine(line) {
  return String(line ?? '')
    .replace(/^\s*(?:flowchart|graph|classDiagram|stateDiagram-v2|stateDiagram|sequenceDiagram)\b.*$/iu, '')
    .replace(/^\s*(?:subgraph|end|classDef|style|linkStyle|direction)\b.*$/iu, '')
    .replace(/^\s*(?:participant|actor)\s+/iu, '')
    .replace(/\[\*\]/gu, 'Start')
    .replace(/["[\]{}()]/gu, ' ')
    .replace(/\|([^|]+)\|/gu, ' $1 ')
    .replace(/\s*(?:-->|---|--|->>|->|<--|<-->|:|\.\.|==)\s*/gu, ' -> ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function renderCompactMermaidFallback(diagram, mermaid) {
  const items = String(mermaid ?? '')
    .split(/\r?\n/u)
    .map((line) => ({
      text: simplifyMermaidLine(line),
      tone: classifyCompactFallbackTone(line),
    }))
    .filter((item) => item.text);
  if (!items.length) return `<pre>${escapeHtml(mermaid)}</pre>`;
  const visibleItems = items.slice(0, 12);
  const hiddenCount = items.length - visibleItems.length;
  return `<div class="rendered-mermaid compact-flow" role="img" aria-label="${escapeHtml(
    diagram.id
  )} rendered compact architecture diagram" data-diagram-kind="${escapeHtml(
    inferMermaidDiagramKind(mermaid)
  )}" data-density="compact-card-flow">${visibleItems
    .map(
      (item, index) => `<div class="flow-step-card ${escapeHtml(item.tone)}">
        <span class="step-index">${index + 1}</span>
        <strong title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</strong>
      </div>`
    )
    .join('')}${
    hiddenCount > 0
      ? `<div class="flow-step-card muted-card"><strong>+${hiddenCount} more edges</strong></div>`
      : ''
  }</div>`;
}

function renderMermaidNativeBlock(diagram, mermaid) {
  const diagramHash = sha256Text(mermaid);
  const diagramKind = inferMermaidDiagramKind(mermaid);
  return `<pre class="mermaid-source-native" data-mermaid-source data-mermaid-normalized="false">${escapeHtml(mermaid)}</pre>
    <div class="mermaid-native-render" data-mermaid-render data-diagram-id="${escapeHtml(
      diagram.id
    )}" data-diagram-kind="${escapeHtml(diagramKind)}"></div>
    <p class="mermaid-runtime-error blocked" data-mermaid-error hidden></p>
    <details class="fallback-diagram"><summary>${escapeHtml(diagram.fallbackLabel)}</summary>${renderCompactMermaidFallback(
      diagram,
      mermaid
    )}</details>
    <details><summary>${escapeHtml(diagram.sourceLabel)}</summary><pre>${escapeHtml(mermaid)}</pre><code>${escapeHtml(diagramHash)}</code></details>`;
}

function renderArchitectureDiagrams({ sectionId, title, lead, diagrams, ui, mermaidRuntime }) {
  const tabs = diagrams
    .map((diagram, index) => {
      const label = architectureDiagramLabel(ui, diagram.type);
      return `<button type="button" class="diagram-tab ${index === 0 ? 'active' : ''}" data-diagram-index="${index}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
    })
    .join('');
  const cards = diagrams
    .map((diagram, index) => {
      const label = architectureDiagramLabel(ui, diagram.type);
      const title = text(diagram.title) || label;
      const description = text(diagram.description);
      const mermaid = text(diagram.mermaid);
      const missing = diagram.missing || !mermaid;
      const diagramHash = mermaid ? sha256Text(mermaid) : '';
      const visualLabel =
        sectionId === 'governance-architecture-diagrams'
          ? ui.governanceMermaidVisual
          : ui.businessMermaidVisual;
      return `<article class="diagram-card ${index === 0 ? 'active' : ''}" data-diagram-card data-diagram-index="${index}" data-diagram-type="${escapeHtml(diagram.type)}">
        <div class="diagram-head">
          <div class="diagram-title"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(title)}</span></div>
          <div class="diagram-meta">${diagramHash ? `<span>${escapeHtml(shortHash(diagramHash))}</span>` : ''}</div>
        </div>
        ${description ? `<p class="muted">${escapeHtml(description)}</p>` : ''}
        ${
          missing
            ? `<p class="empty">${escapeHtml(`missing ${diagram.type}`)}</p>`
            : `<div class="diagram-rendered" tabindex="0"><h4>${escapeHtml(visualLabel)}</h4>${renderMermaidNativeBlock(
                {
                  id: diagram.id,
                  fallbackLabel: ui.fallbackDiagram,
                  sourceLabel: ui.mermaidSource,
                },
                mermaid
              )}</div>`
        }
        <div class="diagram-refs">
          <p><strong>${escapeHtml(ui.diagramEvidenceRefs)}:</strong></p>
          <div class="pill-list">${renderList(diagram.evidenceRefs)}</div>
          <p><strong>${escapeHtml(ui.diagramTargetPathRefs)}:</strong></p>
          <div class="pill-list">${renderList(diagram.targetPathRefs)}</div>
        </div>
      </article>`;
    })
    .join('');
  return `<section id="${escapeHtml(sectionId)}" class="card">
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(lead)}</p>
      ${mermaidRuntime.available ? '' : `<p class="blocked">${escapeHtml(ui.mermaidRuntimeMissing)}</p>`}
      <div class="diagram-viewer" data-diagram-viewer data-diagram-mode="single" data-active-diagram="0" data-mermaid-runtime="${mermaidRuntime.available ? 'embedded' : 'missing'}">
        <div class="diagram-toolbar" aria-label="${escapeHtml(ui.diagramViewer)}">
          <div class="diagram-tabs">${tabs}</div>
          <div class="diagram-actions">
            <button type="button" data-diagram-prev>${escapeHtml(ui.previousDiagram)}</button>
            <button type="button" data-diagram-next>${escapeHtml(ui.nextDiagram)}</button>
            <button type="button" data-diagram-toggle>${escapeHtml(ui.expandDiagrams)}</button>
          </div>
        </div>
        ${
          mermaidRuntime.available
            ? `<p class="mermaid-runtime-status ok">${escapeHtml(ui.mermaidRuntimeEmbedded)}: ${escapeHtml(
                mermaidRuntime.hash
              )}</p>`
            : `<p class="mermaid-runtime-status blocked">${escapeHtml(ui.mermaidRuntimeMissing)}</p>`
        }
        <div class="diagram-grid">${cards}</div>
      </div>
    </section>`;
}

function renderMermaidRuntimeScript(mermaidRuntime) {
  if (!mermaidRuntime.available) return '';
  return `<script data-mermaid-runtime-hash="${escapeHtml(mermaidRuntime.hash)}">
${mermaidRuntime.script}
</script>`;
}

function confirmPhrase(confirmation, artifactHash) {
  return (
    text(confirmation.confirmationPhrase) ||
    [
      '确认架构确认进入实施准备',
      `sourceDocumentHash=${text(confirmation.sourceDocumentHash)}`,
      `implementationConfirmationHash=${text(confirmation.implementationConfirmationHash)}`,
      `resolvedRecipeHash=${text(confirmation.resolvedRecipeHash)}`,
      `architectureConfirmationArtifactHash=${artifactHash}`,
    ].join('\n')
  );
}

function validate(confirmation, recipe) {
  const blockingIssues = [];
  const warnings = [];
  const required = [
    'schemaVersion',
    'recordId',
    'requirementSetId',
    'runId',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'resolvedRecipeHash',
    'targetPathsHash',
    'consumerImpactScanHash',
    'governanceImpactScanHash',
  ];
  for (const field of required) {
    if (!text(confirmation[field])) blockingIssues.push(`missing_${field}`);
  }
  for (const field of ['targetPaths', 'consumerImpactScan', 'governanceImpactScan', 'fullArchitectureTriggerMatrix']) {
    if (array(confirmation[field]).length === 0) blockingIssues.push(`missing_${field}`);
  }
  const businessDiagrams = normalizeArchitectureDiagrams(
    confirmation,
    'businessArchitectureDiagrams',
    'architectureDiagrams'
  );
  const governanceDiagrams = normalizeArchitectureDiagrams(
    confirmation,
    'governanceArchitectureDiagrams',
    'architectureDiagrams'
  );
  const missingBusinessDiagramTypes = businessDiagrams
    .filter((diagram) => diagram.missing || !text(diagram.mermaid))
    .map((diagram) => diagram.type);
  const missingGovernanceDiagramTypes = governanceDiagrams
    .filter((diagram) => diagram.missing || !text(diagram.mermaid))
    .map((diagram) => diagram.type);
  if (missingBusinessDiagramTypes.length) {
    blockingIssues.push('missing_businessArchitectureDiagrams');
    for (const type of missingBusinessDiagramTypes) {
      blockingIssues.push(`missing_businessArchitectureDiagram_${type}`);
    }
  }
  if (missingGovernanceDiagramTypes.length) {
    blockingIssues.push('missing_governanceArchitectureDiagrams');
    for (const type of missingGovernanceDiagramTypes) {
      blockingIssues.push(`missing_governanceArchitectureDiagram_${type}`);
    }
  }
  const declaredHash = text(confirmation.architectureConfirmationArtifactHash || confirmation.artifactHash);
  const computedHash = architectureHashFor(confirmation, recipe);
  if (!declaredHash) blockingIssues.push('missing_architectureConfirmationArtifactHash');
  if (declaredHash && declaredHash !== computedHash) blockingIssues.push('architecture_confirmation_artifact_hash_mismatch');
  if (text(confirmation.resolvedRecipeHash) !== recipe.resolvedRecipeHash) {
    blockingIssues.push('resolved_recipe_hash_mismatch');
  }
  if (array(confirmation.targetPaths).length > 80) warnings.push('many_target_paths');
  return { blockingIssues, warnings, declaredHash, computedHash };
}

function renderHtml(input) {
  const c = input.confirmation;
  const ui = getUiText(input.language);
  const artifactHash = input.validation.declaredHash || input.validation.computedHash;
  const phrase = confirmPhrase(c, artifactHash);
  const confirmability = input.validation.blockingIssues.length ? 'blocked' : 'confirmable';
  const triggerCount = array(c.fullArchitectureTriggerMatrix).filter((row) => text(row.decision || row.status).includes('triggered')).length;
  const architectureDelta = buildArchitectureDelta(c, input.validation);
  const businessArchitectureDiagrams = normalizeArchitectureDiagrams(c, 'businessArchitectureDiagrams', 'architectureDiagrams');
  const governanceArchitectureDiagrams = normalizeArchitectureDiagrams(c, 'governanceArchitectureDiagrams', 'architectureDiagrams');
  return `<!doctype html>
<html lang="${escapeHtml(input.language)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(ui.titlePrefix)} ${escapeHtml(c.recordId)}</title>
  <style>
    :root{--bg:#f4f1ea;--paper:#fffdf8;--ink:#24211b;--muted:#6b655b;--line:#d7cbb8;--rule:#a88f63;--red:#a33a2d;--red-soft:#f8ddd7;--green:#28684e;--green-soft:#dff0e7;--blue:#2d5d82;--blue-soft:#dceaf4;--gold:#8b611b;--gold-soft:#f3e3bf;--shadow:none;--mono:"Cascadia Mono",Consolas,monospace;--sans:"Noto Sans SC","Segoe UI","Microsoft YaHei",sans-serif}
    *{box-sizing:border-box}body{margin:0;color:var(--ink);background:linear-gradient(90deg,#ebe1cf 0,#f7f3eb 42%,#fffdf8 100%);font-family:var(--sans);line-height:1.62}a{color:var(--blue)}
    main.layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:0;min-height:100vh;max-width:100%;padding:44px min(6vw,88px) 86px;transition:grid-template-columns .18s ease}main.layout>div{min-width:0;max-width:100%;counter-reset:arch-section}.nav{position:sticky;top:0;align-self:start;height:calc(100vh - 88px);overflow:auto;background:#1f211c;color:#fff;border-right:1px solid rgba(255,255,255,.08);padding:22px 20px;margin:-20px 34px 0 -20px}.nav a{display:block;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.1);text-decoration:none;color:#fff;font-size:13px}.nav a:hover{color:#f3e3bf}
    .hero,.card{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;box-shadow:none;padding:36px 0 42px;margin:0;min-width:0;max-width:100%}.hero{border-top:1px solid var(--rule);border-bottom:1px solid var(--line);padding-top:28px}.card>h2,.section-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 16px;padding-bottom:11px;border-bottom:1px solid var(--line)}.card>h2::before,.section-title h2::before{counter-increment:arch-section;content:counter(arch-section,decimal-leading-zero);font:700 12px/1 var(--mono);letter-spacing:.12em;color:var(--gold);margin-right:10px}.section-title h2{display:flex;align-items:baseline}.chip{display:inline-block;padding:4px 9px;border-radius:3px;font-size:12px;font-weight:800;margin:0 8px 10px 0;background:var(--blue-soft);color:var(--blue)}.bad{background:var(--red-soft);color:var(--red)}.good{background:var(--green-soft);color:var(--green)}.warn{background:var(--gold-soft);color:var(--gold)}
    .metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;margin:18px 0;min-width:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.metric{background:transparent;border:0;border-right:1px solid var(--line);border-radius:0;padding:12px 14px;min-width:0}.metric:last-child{border-right:0}.metric strong{display:block;font-size:28px;line-height:1;color:var(--blue)}.metric span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.metric.warn strong{color:var(--gold)}.metric.bad strong{color:var(--red)}
    h1,h2,h3{margin:0 0 12px}h1{font-size:clamp(34px,4.4vw,56px);line-height:1.04;font-family:Georgia,"Noto Serif SC",serif;font-weight:650;letter-spacing:-.035em}h2{font-size:clamp(24px,2.4vw,32px);line-height:1.15;font-family:Georgia,"Noto Serif SC",serif;font-weight:620;letter-spacing:-.018em}h3{font-size:17px;margin:24px 0 10px}p{margin:0 0 12px}.muted{color:var(--muted)}.hash{font-family:var(--mono);word-break:break-all;font-size:12px}.phrase{background:#191815;color:#f6f0e7;padding:16px;border-radius:0;border-left:4px solid var(--gold);font-family:var(--mono);white-space:pre-wrap}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;min-width:0}.two-col{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:22px;min-width:0}.review-flow{display:grid;gap:0;margin-top:18px;min-width:0;border-top:1px solid var(--line)}.review-step{border-top:0;border-bottom:1px solid var(--line);padding:18px 0;min-width:0}.review-step:first-child{border-top:0}.review-step h3{margin-top:0}
    .copy-button{border:1px solid var(--blue);background:var(--blue);color:#fff;border-radius:3px;padding:8px 14px;font-weight:800;cursor:pointer}.copy-button:hover{filter:brightness(.95)}.copy-button:focus-visible{outline:3px solid rgba(45,93,130,.28);outline-offset:2px}.copy-status{min-height:20px;margin:10px 0 0;color:var(--green);font-size:13px}
    .diagram-viewer{border:1px solid var(--line);border-radius:0;background:#fbf8f1;padding:14px;margin:18px 0 28px}.diagram-toolbar{display:flex;gap:12px;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:10px}.diagram-tabs{display:flex;gap:6px;flex-wrap:wrap}.diagram-actions{display:flex;gap:8px;flex-wrap:wrap}.diagram-tab,.diagram-actions button{border:1px solid rgba(120,104,78,.34);background:#fffdf8;color:var(--ink);border-radius:3px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer}.diagram-tab.active,.diagram-actions button:hover{background:#24211b;color:#fff;border-color:#24211b}.mermaid-runtime-status{margin:0 0 12px}.diagram-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}.diagram-viewer[data-diagram-mode="single"] .diagram-grid{display:block}.diagram-viewer[data-diagram-mode="single"] .diagram-card{display:none}.diagram-viewer[data-diagram-mode="single"] .diagram-card.active{display:block}.diagram-viewer[data-diagram-mode="all"] .diagram-card{display:block}.diagram-card{border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0;background:transparent;box-shadow:none;overflow:hidden}.diagram-viewer[data-diagram-mode="single"] .diagram-card{max-width:none;margin:0}.diagram-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid rgba(120,104,78,.2);padding-bottom:7px}.diagram-title strong{display:block;font-family:Georgia,"Noto Serif SC",serif;font-size:17px;line-height:1}.diagram-title span{display:block;margin-top:4px;color:var(--muted);font-family:var(--mono);font-size:10px}.diagram-meta{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:58%;font-family:var(--mono);font-size:10px;color:var(--blue)}.diagram-rendered{background:#fffdf8;border:1px solid var(--line);border-radius:0;padding:16px 18px 22px;margin-top:9px;overflow:auto;max-height:520px;min-height:300px;text-align:left;resize:vertical;scrollbar-gutter:stable both-edges}.diagram-viewer[data-diagram-mode="all"] .diagram-rendered{max-height:360px;min-height:260px}.diagram-rendered h4{margin:0 0 12px;font-size:11px;color:var(--gold);letter-spacing:.08em;text-transform:uppercase}.mermaid-source-native{display:none}.mermaid-native-render{display:block;min-width:max-content;min-height:210px;text-align:left;transform-origin:top left}.mermaid-native-render svg{display:block;margin:0 !important;max-width:none !important;overflow:visible}.mermaid-native-render .actor,.mermaid-native-render .messageText,.mermaid-native-render .noteText,.mermaid-native-render text{font-size:12px !important}.mermaid-native-render .normalized-mermaid-svg text,.mermaid-native-render .normalized-mermaid-svg span,.mermaid-native-render .normalized-mermaid-svg foreignObject{font-family:var(--sans)!important;color:var(--ink)!important;fill:var(--ink)!important}.mermaid-native-render[data-diagram-kind="flowchart"] .node rect,.mermaid-native-render[data-diagram-kind="flowchart"] .node polygon,.mermaid-native-render[data-diagram-kind="flowchart"] .node circle,.mermaid-native-render[data-diagram-kind="flowchart"] .node ellipse,.mermaid-native-render[data-diagram-kind="class"] .classGroup rect,.mermaid-native-render[data-diagram-kind="state"] .stateGroup rect{fill:#fffdf8!important;stroke:var(--gold)!important;stroke-width:1.35px!important;rx:0!important;ry:0!important}.mermaid-native-render[data-diagram-kind="flowchart"] .cluster rect{fill:#fbf8f1!important;stroke:var(--line)!important;stroke-width:1.2px!important;rx:0!important;ry:0!important}.mermaid-native-render[data-diagram-kind="flowchart"] .edgePath path,.mermaid-native-render[data-diagram-kind="flowchart"] .flowchart-link,.mermaid-native-render[data-diagram-kind="class"] .relation,.mermaid-native-render[data-diagram-kind="state"] .transition{stroke:var(--blue)!important;stroke-width:1.45px!important}.mermaid-native-render[data-diagram-kind="flowchart"] marker path,.mermaid-native-render[data-diagram-kind="class"] marker path,.mermaid-native-render[data-diagram-kind="state"] marker path{fill:var(--blue)!important;stroke:var(--blue)!important}.mermaid-native-render[data-diagram-kind="flowchart"] .edgeLabel,.mermaid-native-render[data-diagram-kind="class"] .edgeLabel,.mermaid-native-render[data-diagram-kind="state"] .edgeLabel{background:#fffdf8!important;color:var(--ink)!important}.mermaid-native-render[data-diagram-kind="flowchart"] .labelBkg,.mermaid-native-render[data-diagram-kind="class"] .labelBkg,.mermaid-native-render[data-diagram-kind="state"] .labelBkg{fill:#fffdf8!important;opacity:.86!important}.mermaid-native-render[data-diagram-kind="class"] .classTitle,.mermaid-native-render[data-diagram-kind="state"] .state-title{font-weight:800!important;fill:var(--blue)!important}.mermaid-native-render[data-diagram-kind="class"] .divider,.mermaid-native-render[data-diagram-kind="state"] .divider{stroke:var(--line)!important}.mermaid-runtime-error{margin:12px 0}.fallback-diagram{margin-top:14px;border-top:1px dashed rgba(120,104,78,.35);padding-top:10px}.fallback-diagram summary{cursor:pointer;color:var(--muted);font-weight:800}.fallback-diagram:not([open]){opacity:.72}.rendered-mermaid{background:transparent;border-radius:0}.compact-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:7px}.diagram-viewer[data-diagram-mode="single"] .compact-flow{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.flow-step-card{border-radius:0;border:1px solid rgba(47,111,84,.22);background:var(--green-soft);padding:8px;position:relative;min-height:78px}.flow-step-card.warn{border-color:rgba(166,61,47,.28);background:#fff6f3}.flow-step-card.pass{border-color:rgba(47,111,84,.28);background:#f3fbf6}.flow-step-card.muted-card{background:#f8f3e9;border-style:dashed}.step-index{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:3px;background:#fff;color:var(--green);font-weight:800;margin-bottom:5px;font-size:10px}.flow-step-card strong{display:block;font-size:11.5px;line-height:1.25}.diagram-refs{border-top:1px solid var(--line);margin-top:12px;padding-top:10px}.blocked{color:var(--red);background:var(--red-soft);border-left:4px solid var(--red);padding:10px 12px}
    .table-wrap{overflow-x:auto;overflow-y:auto;border:1px solid var(--line);border-radius:0;min-width:0;max-width:100%;scrollbar-gutter:stable;background:#fff}.table-wrap table{width:max-content;min-width:100%;border-collapse:collapse;background:#fff;table-layout:auto}.table-wrap th,.table-wrap td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;min-width:140px;max-width:560px;overflow-wrap:break-word}.table-wrap th{background:#efe7d8;position:sticky;top:0;font-size:12px;letter-spacing:.02em}.table-wrap tr:nth-child(even) td{background:#fbf8f1}.pill-list span{display:inline-block;margin:0 8px 8px 0;padding:4px 8px;border-radius:3px;background:#eef4f9;border:1px solid #d6e4ef;font-size:12px}.inline-json{font-size:11px;margin:0;max-width:520px}.empty{color:var(--muted);font-style:italic}@media(max-width:900px){main.layout{display:block;padding:24px 18px 52px}.grid,.two-col{display:block}.nav{position:relative;height:auto;margin:0 0 18px;padding:16px}.diagram-toolbar{display:block}.diagram-actions{margin-top:10px}}
  </style>
</head>
<body>
<main class="layout">
  <nav class="nav">
    <strong>${escapeHtml(ui.navTitle)}</strong>
    <a href="#summary">${escapeHtml(ui.navSummary)}</a><a href="#architecture-delta">${escapeHtml(ui.navDelta)}</a><a href="#business-architecture-diagrams">${escapeHtml(ui.navBusinessDiagrams)}</a><a href="#governance-architecture-diagrams">${escapeHtml(ui.navGovernanceDiagrams)}</a><a href="#impact">${escapeHtml(ui.navImpact)}</a><a href="#triggers">${escapeHtml(ui.navTriggers)}</a><a href="#paths">${escapeHtml(ui.navPaths)}</a><a href="#hash">${escapeHtml(ui.navHash)}</a><a href="#risk">${escapeHtml(ui.navRisk)}</a><a href="#phrase">${escapeHtml(ui.navPhrase)}</a><a href="#metadata">${escapeHtml(ui.navMetadata)}</a>
  </nav>
  <div>
    <section id="summary" class="hero">
      <span class="chip ${confirmability === 'confirmable' ? 'good' : 'bad'}">${escapeHtml(confirmability)}</span><span class="chip warn">${escapeHtml(c.status || 'draft')}</span><span class="chip">${escapeHtml(c.recordId)}</span>
      <h1>${escapeHtml(c.recordId)} ${escapeHtml(ui.draftTitleSuffix)}</h1>
      <p class="muted">${escapeHtml(ui.projectionNote)}</p>
      <div class="two-col">
        <div>
          <p><strong>${escapeHtml(ui.confirmationScope)}：</strong>${escapeHtml(c.decision || c.outcome || 'architecture confirmation')}</p>
          <p><strong>${escapeHtml(ui.currentDecision)}：</strong>${escapeHtml(ui.currentDecisionText(triggerCount))}</p>
          <p><strong>${escapeHtml(ui.userNextStep)}：</strong>${escapeHtml(ui.userNextStepText)}</p>
          <p><strong>${escapeHtml(ui.blockers)}：</strong>${escapeHtml(input.validation.blockingIssues.join(', ') || 'none')}</p>
        </div>
        <div>
          <p class="muted">${escapeHtml(ui.fingerprint)}</p>
          <div class="hash">sourceDocumentHash=${escapeHtml(c.sourceDocumentHash)}</div>
          <div class="hash">implementationConfirmationHash=${escapeHtml(c.implementationConfirmationHash)}</div>
          <div class="hash">resolvedRecipeHash=${escapeHtml(c.resolvedRecipeHash)}</div>
          <div class="hash">architectureConfirmationArtifactHash=${escapeHtml(artifactHash)}</div>
        </div>
      </div>
    </section>
    ${renderArchitectureDelta(architectureDelta, ui)}
    ${renderArchitectureDiagrams({
      sectionId: 'business-architecture-diagrams',
      title: ui.businessArchitectureDiagrams,
      lead: ui.businessArchitectureDiagramsLead,
      diagrams: businessArchitectureDiagrams,
      ui,
      mermaidRuntime: input.mermaidRuntime,
    })}
    ${renderArchitectureDiagrams({
      sectionId: 'governance-architecture-diagrams',
      title: ui.governanceArchitectureDiagrams,
      lead: ui.governanceArchitectureDiagramsLead,
      diagrams: governanceArchitectureDiagrams,
      ui,
      mermaidRuntime: input.mermaidRuntime,
    })}
    <section id="impact" class="card">
      <h2>${escapeHtml(ui.navImpact)}</h2>
      <div class="review-flow">
        <section class="review-step"><h3>${escapeHtml(ui.consumerImpactScan)}</h3>${renderObjectTable(c.consumerImpactScan, ['category', 'status', 'summary', 'description', 'requiredDecision'])}</section>
        <section class="review-step"><h3>${escapeHtml(ui.governanceImpactScan)}</h3>${renderObjectTable(c.governanceImpactScan, ['category', 'status', 'summary', 'description', 'requiredDecision'])}</section>
      </div>
    </section>
    <section id="triggers" class="card"><h2>${escapeHtml(ui.fullTriggerMatrix)}</h2>${renderObjectTable(c.fullArchitectureTriggerMatrix, ['trigger', 'decision', 'reason', 'requiredDecision'])}</section>
    <section id="paths" class="card"><h2>${escapeHtml(ui.targetPaths)}</h2><p class="muted">${escapeHtml(ui.targetPathsCount(array(c.targetPaths).length))}</p>${renderPathTable(c.targetPaths)}</section>
    <section id="hash" class="card"><h2>${escapeHtml(ui.hashRecipeAndStaleInputs)}</h2><div class="review-flow"><section class="review-step"><h3>${escapeHtml(ui.recipe)}</h3>${renderObjectTable([c.architectureConfirmationHashRecipe || {}], ['schemaVersion', 'recipeVersion', 'configPath', 'resolvedRecipeHash'])}</section><section class="review-step"><h3>Stale Inputs</h3>${renderObjectTable([c.staleInputs || {}], ['sourceDocumentHash', 'implementationConfirmationHash', 'targetPathsHash', 'consumerImpactScanHash', 'governanceImpactScanHash', 'resolvedRecipeHash'])}</section></div></section>
    <section id="risk" class="card"><h2>${escapeHtml(ui.riskAndRollback)}</h2><p><strong>Risk:</strong> ${escapeHtml(c.riskStatement || ui.missingRisk)}</p><p><strong>Rollback:</strong> ${escapeHtml(c.rollbackPlan || ui.missingRollback)}</p><p><strong>${escapeHtml(ui.evidence)}:</strong></p><div class="pill-list">${renderList(c.evidenceRefs)}</div></section>
    <section id="phrase" class="card"><div class="section-title"><h2>${escapeHtml(ui.confirmationPhrase)}</h2><button class="copy-button" type="button" data-copy-target="architecture-confirmation-phrase">${escapeHtml(ui.copyPhrase)}</button></div><pre id="architecture-confirmation-phrase" class="phrase">${escapeHtml(phrase)}</pre><p class="copy-status" data-copy-status aria-live="polite"></p></section>
    <section id="metadata" class="card"><h2>${escapeHtml(ui.metadata)}</h2>${renderObjectTable([{ jsonPath: input.architecturePath, htmlPath: input.outPath, runId: c.runId, artifactHash, computedArtifactHash: input.validation.computedHash }], ['jsonPath', 'htmlPath', 'runId', 'artifactHash', 'computedArtifactHash'])}</section>
  </div>
</main>
${renderMermaidRuntimeScript(input.mermaidRuntime)}
<script>
(() => {
  const mermaidRuntimeAvailable = ${input.mermaidRuntime.available ? 'true' : 'false'};
  const runtimeUnavailableMessage = ${
    input.mermaidRuntime.available
      ? JSON.stringify('Mermaid runtime failed to initialize after embedding.')
      : JSON.stringify(ui.mermaidRuntimeMissing)
  };
  document.querySelectorAll('[data-diagram-viewer]').forEach((viewer) => {
    const cards = Array.from(viewer.querySelectorAll('[data-diagram-card]'));
    const tabs = Array.from(viewer.querySelectorAll('[data-diagram-index].diagram-tab'));
    const toggle = viewer.querySelector('[data-diagram-toggle]');
    const setActive = (nextIndex) => {
      if (!cards.length) return;
      const index = (nextIndex + cards.length) % cards.length;
      viewer.dataset.activeDiagram = String(index);
      if (viewer.dataset.diagramMode !== 'all') viewer.dataset.diagramMode = 'single';
      cards.forEach((card, cardIndex) => card.classList.toggle('active', cardIndex === index));
      tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === index;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        viewer.dataset.diagramMode = 'single';
        if (toggle) toggle.innerText = ${JSON.stringify(getUiText(input.language).expandDiagrams)};
        setActive(Number(tab.dataset.diagramIndex || 0));
      });
    });
    const move = (delta) => {
      viewer.dataset.diagramMode = 'single';
      if (toggle) toggle.innerText = ${JSON.stringify(getUiText(input.language).expandDiagrams)};
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
        toggle.innerText = expanded
          ? ${JSON.stringify(getUiText(input.language).expandDiagrams)}
          : ${JSON.stringify(getUiText(input.language).singleDiagram)};
        setActive(Number(viewer.dataset.activeDiagram || 0));
      });
    }
    setActive(Number(viewer.dataset.activeDiagram || 0));
  });
  async function renderNativeMermaid() {
    const cards = Array.from(document.querySelectorAll('[data-diagram-card]'));
    if (!mermaidRuntimeAvailable || !window.mermaid) {
      cards.forEach((card) => {
        const error = card.querySelector('[data-mermaid-error]');
        if (!error) return;
        error.hidden = false;
        error.innerText = runtimeUnavailableMessage;
      });
      return;
    }
    function inferMermaidDiagramKind(source) {
      const normalized = String(source || '').trim();
      if (/^sequenceDiagram\\b/iu.test(normalized)) return 'sequence';
      if (/^classDiagram\\b/iu.test(normalized)) return 'class';
      if (/^stateDiagram(?:-v2)?\\b/iu.test(normalized)) return 'state';
      if (/^(?:flowchart|graph)\\b/iu.test(normalized)) return 'flowchart';
      return 'unknown';
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
    for (const card of cards) {
      const sourceEl = card.querySelector('[data-mermaid-source]');
      const target = card.querySelector('[data-mermaid-render]');
      const error = card.querySelector('[data-mermaid-error]');
      if (!sourceEl || !target) continue;
      const sourceText = sourceEl.textContent || '';
      const diagramKind = inferMermaidDiagramKind(sourceText);
      const id = 'native-mermaid-' + (target.dataset.diagramId || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2);
      try {
        const rendered = await window.mermaid.render(id, sourceText);
        target.innerHTML = rendered.svg;
        target.dataset.rendered = 'true';
        target.dataset.diagramKind = diagramKind;
        if (typeof rendered.bindFunctions === 'function') rendered.bindFunctions(target);
        const svg = target.querySelector('svg');
        if (svg) {
          svg.classList.add('normalized-mermaid-svg');
          svg.dataset.diagramKind = diagramKind;
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
  renderNativeMermaid();
  const button = document.querySelector('[data-copy-target]');
  if (!button) return;
  const targetId = button.getAttribute('data-copy-target');
  const target = targetId ? document.getElementById(targetId) : null;
  const status = document.querySelector('[data-copy-status]');
  const setStatus = (message) => {
    if (status) status.textContent = message;
  };
  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!ok) throw new Error('copy command failed');
  };
  button.addEventListener('click', async () => {
    const text = target?.textContent?.trim() || '';
    if (!text) {
      setStatus(${JSON.stringify(ui.copyMissing)});
      return;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else fallbackCopy(text);
      setStatus(${JSON.stringify(ui.copyDone)});
    } catch {
      setStatus(${JSON.stringify(ui.copyFailed)});
    }
  });
})();
</script>
</body>
</html>`;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node render-architecture-confirmation-html.ts --architecture-confirmation <json> --out <html> --language zh-CN [--json]');
    return 0;
  }
  if (!args.architectureConfirmation || !args.out) {
    throw new Error('missing required args: architectureConfirmation, out');
  }
  if (!VALID_LANGUAGES.has(args.language)) throw new Error(`invalid language: ${args.language}`);
  if (!VALID_THEMES.has(args.theme)) throw new Error(`invalid theme: ${args.theme}`);

  const architecturePath = path.resolve(args.architectureConfirmation);
  const outPath = path.resolve(args.out);
  const summaryPath = path.resolve(args.summary || deriveSibling(outPath, '.summary.json'));
  const reportPath = path.resolve(args.renderReport || deriveSibling(outPath, '.render-report.json'));
  const confirmation = readJson(architecturePath);
  const recipe = resolveRecipe(args.recipe);
  const validation = validate(confirmation, recipe);
  const architectureDelta = buildArchitectureDelta(confirmation, validation);
  const businessArchitectureDiagrams = normalizeArchitectureDiagrams(
    confirmation,
    'businessArchitectureDiagrams',
    'architectureDiagrams'
  );
  const governanceArchitectureDiagrams = normalizeArchitectureDiagrams(
    confirmation,
    'governanceArchitectureDiagrams',
    'architectureDiagrams'
  );
  const mermaidRuntime = readMermaidRuntimeScript();
  const html = renderHtml({
    confirmation,
    recipe,
    validation,
    language: args.language,
    architecturePath,
    outPath,
    mermaidRuntime,
  });
  const htmlHash = sha256Text(html);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');

  const architectureConfirmationArtifactHash = validation.declaredHash || validation.computedHash;
  const confirmInstruction = confirmPhrase(confirmation, architectureConfirmationArtifactHash);
  const confirmability = validation.blockingIssues.length ? 'blocked' : 'confirmable';
  const summary = {
    recordId: text(confirmation.recordId),
    requirementSetId: text(confirmation.requirementSetId),
    runId: text(confirmation.runId),
    sourceDocumentHash: text(confirmation.sourceDocumentHash),
    implementationConfirmationHash: text(confirmation.implementationConfirmationHash),
    resolvedRecipeHash: text(confirmation.resolvedRecipeHash),
    architectureConfirmationArtifactHash,
    computedArchitectureConfirmationArtifactHash: validation.computedHash,
    htmlHash,
    confirmability,
    blockingIssues: validation.blockingIssues,
    warnings: validation.warnings,
    architectureDelta,
    businessArchitectureDiagrams,
    governanceArchitectureDiagrams,
    mermaidRuntime: {
      available: mermaidRuntime.available,
      path: mermaidRuntime.path,
      hash: mermaidRuntime.hash,
      error: mermaidRuntime.error,
    },
    counts: {
      targetPaths: array(confirmation.targetPaths).length,
      consumerImpactScan: array(confirmation.consumerImpactScan).length,
      governanceImpactScan: array(confirmation.governanceImpactScan).length,
      fullArchitectureTriggerMatrix: array(confirmation.fullArchitectureTriggerMatrix).length,
      businessArchitectureDiagrams: businessArchitectureDiagrams.filter(
        (diagram) => !diagram.missing && text(diagram.mermaid)
      ).length,
      governanceArchitectureDiagrams: governanceArchitectureDiagrams.filter(
        (diagram) => !diagram.missing && text(diagram.mermaid)
      ).length,
      evidenceRefs: array(confirmation.evidenceRefs).length,
    },
  };
  const report = {
    ...summary,
    architectureConfirmationPath: normalizeRepoPath(architecturePath),
    htmlRef: {
      artifactType: 'architecture_confirmation_view',
      sourceOfTruthRole: 'projection',
      path: normalizeRepoPath(outPath),
      hash: htmlHash,
    },
    artifactRef: object(confirmation.architectureConfirmationArtifactRef),
    confirmInstruction,
    summaryPath: normalizeRepoPath(summaryPath),
    reportPath: normalizeRepoPath(reportPath),
  };
  writeJson(summaryPath, summary);
  writeJson(reportPath, report);
  const output = { ok: confirmability === 'confirmable', summaryPath, reportPath, htmlPath: outPath, ...summary };
  if (args.json) process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  else console.log(`architecture_confirmation_html=${normalizeRepoPath(outPath)}`);
  return args.strict && validation.blockingIssues.length ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
