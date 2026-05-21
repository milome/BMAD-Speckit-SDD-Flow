#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const VALID_LANGUAGES = new Set(['zh-CN', 'en-US', 'bilingual']);
const VALID_THEMES = new Set(['readable', 'compact', 'audit']);
const DEFAULT_RECIPE_PATH = '_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml';
const EXPECTED_SCHEMA_VERSION = 'architecture-confirmation-hash-recipe.contract/v1';
const EXPECTED_RECIPE_VERSION = 'architecture-confirmation-hash/v1';

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
    .table-wrap{overflow-x:auto;overflow-y:auto;border:1px solid var(--line);border-radius:0;min-width:0;max-width:100%;scrollbar-gutter:stable;background:#fff}.table-wrap table{width:max-content;min-width:100%;border-collapse:collapse;background:#fff;table-layout:auto}.table-wrap th,.table-wrap td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;min-width:140px;max-width:560px;overflow-wrap:break-word}.table-wrap th{background:#efe7d8;position:sticky;top:0;font-size:12px;letter-spacing:.02em}.table-wrap tr:nth-child(even) td{background:#fbf8f1}.pill-list span{display:inline-block;margin:0 8px 8px 0;padding:4px 8px;border-radius:3px;background:#eef4f9;border:1px solid #d6e4ef;font-size:12px}.inline-json{font-size:11px;margin:0;max-width:520px}.empty{color:var(--muted);font-style:italic}@media(max-width:900px){main.layout{display:block;padding:24px 18px 52px}.grid,.two-col{display:block}.nav{position:relative;height:auto;margin:0 0 18px;padding:16px}}
  </style>
</head>
<body>
<main class="layout">
  <nav class="nav">
    <strong>${escapeHtml(ui.navTitle)}</strong>
    <a href="#summary">${escapeHtml(ui.navSummary)}</a><a href="#architecture-delta">${escapeHtml(ui.navDelta)}</a><a href="#impact">${escapeHtml(ui.navImpact)}</a><a href="#triggers">${escapeHtml(ui.navTriggers)}</a><a href="#paths">${escapeHtml(ui.navPaths)}</a><a href="#hash">${escapeHtml(ui.navHash)}</a><a href="#risk">${escapeHtml(ui.navRisk)}</a><a href="#phrase">${escapeHtml(ui.navPhrase)}</a><a href="#metadata">${escapeHtml(ui.navMetadata)}</a>
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
<script>
(() => {
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
  const html = renderHtml({ confirmation, recipe, validation, language: args.language, architecturePath, outPath });
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
    counts: {
      targetPaths: array(confirmation.targetPaths).length,
      consumerImpactScan: array(confirmation.consumerImpactScan).length,
      governanceImpactScan: array(confirmation.governanceImpactScan).length,
      fullArchitectureTriggerMatrix: array(confirmation.fullArchitectureTriggerMatrix).length,
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
