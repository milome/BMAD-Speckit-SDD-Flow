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
  const artifactHash = input.validation.declaredHash || input.validation.computedHash;
  const phrase = confirmPhrase(c, artifactHash);
  const confirmability = input.validation.blockingIssues.length ? 'blocked' : 'confirmable';
  const triggerCount = array(c.fullArchitectureTriggerMatrix).filter((row) => text(row.decision || row.status).includes('triggered')).length;
  return `<!doctype html>
<html lang="${escapeHtml(input.language)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>架构确认 ${escapeHtml(c.recordId)}</title>
  <style>
    :root{--bg:#f4f1ea;--paper:#fffdf8;--ink:#24211b;--muted:#6b655b;--line:#d7cbb8;--red:#a33a2d;--red-soft:#f8ddd7;--green:#28684e;--green-soft:#dff0e7;--blue:#2d5d82;--blue-soft:#dceaf4;--gold:#8b611b;--gold-soft:#f3e3bf;--shadow:0 18px 40px rgba(36,33,27,.12);--mono:"Cascadia Mono",Consolas,monospace;--sans:"Segoe UI","Noto Sans SC","Microsoft YaHei",sans-serif}
    *{box-sizing:border-box}body{margin:0;color:var(--ink);background:linear-gradient(135deg,#f8f1e4,#eef0e9 55%,#f5e7da);font-family:var(--sans);line-height:1.55}main{max-width:1320px;margin:0 auto;padding:28px 24px 56px}a{color:var(--blue)}
    .layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px}.nav{position:sticky;top:16px;align-self:start;background:rgba(255,253,248,.92);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);padding:14px}.nav a{display:block;padding:7px 8px;border-radius:10px;text-decoration:none;color:var(--ink);font-size:13px}.nav a:hover{background:var(--blue-soft)}
    .hero,.card{background:var(--paper);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);padding:22px 24px;margin:0 0 18px}.chip{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;margin:0 8px 8px 0;background:var(--blue-soft);color:var(--blue)}.bad{background:var(--red-soft);color:var(--red)}.good{background:var(--green-soft);color:var(--green)}.warn{background:var(--gold-soft);color:var(--gold)}
    h1,h2,h3{margin:0 0 12px}h1{font-size:28px}h2{font-size:20px}p{margin:0 0 12px}.muted{color:var(--muted)}.hash{font-family:var(--mono);word-break:break-all;font-size:12px}.phrase{background:#111;color:#f6f0e7;padding:16px;border-radius:14px;font-family:var(--mono);white-space:pre-wrap}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.two-col{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}
    .section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}.section-title h2{margin:0}.copy-button{border:1px solid var(--blue);background:var(--blue);color:#fff;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer}.copy-button:hover{filter:brightness(.95)}.copy-button:focus-visible{outline:3px solid rgba(45,93,130,.28);outline-offset:2px}.copy-status{min-height:20px;margin:10px 0 0;color:var(--green);font-size:13px}
    .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px}.table-wrap table{min-width:100%;border-collapse:collapse;background:#fff}.table-wrap th,.table-wrap td{padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;text-align:left}.table-wrap th{background:#f6efe0;position:sticky;top:0}.pill-list span{display:inline-block;margin:0 8px 8px 0;padding:4px 8px;border-radius:999px;background:#eef4f9;border:1px solid #d6e4ef;font-size:12px}.inline-json{font-size:11px;margin:0;max-width:520px}.empty{color:var(--muted);font-style:italic}@media(max-width:900px){.layout,.grid,.two-col{display:block}.nav{position:relative;margin-bottom:16px}}
  </style>
</head>
<body>
<main class="layout">
  <nav class="nav">
    <strong>架构确认导航</strong>
    <a href="#summary">确认摘要</a><a href="#impact">影响扫描</a><a href="#triggers">触发矩阵</a><a href="#paths">目标路径</a><a href="#hash">Hash Recipe</a><a href="#risk">风险与回滚</a><a href="#phrase">确认口令</a><a href="#metadata">工件元数据</a>
  </nav>
  <div>
    <section id="summary" class="hero">
      <span class="chip ${confirmability === 'confirmable' ? 'good' : 'bad'}">${escapeHtml(confirmability)}</span><span class="chip warn">${escapeHtml(c.status || 'draft')}</span><span class="chip">${escapeHtml(c.recordId)}</span>
      <h1>${escapeHtml(c.recordId)} 架构确认草案</h1>
      <p class="muted">该页面是 requirement-scoped 架构确认 JSON 的用户可读投影。它不写入 architectureConfirmations[]，确认后必须通过 controlled ingest 写入。</p>
      <div class="two-col">
        <div>
          <p><strong>确认范围：</strong>${escapeHtml(c.decision || c.outcome || 'architecture confirmation')}</p>
          <p><strong>当前结论：</strong>命中 ${triggerCount} 个完整架构触发项；必须先确认架构再进入实施准备。</p>
          <p><strong>用户下一步：</strong>回到 chat 粘贴确认口令。HTML 内不能点击确认。</p>
          <p><strong>阻断项：</strong>${escapeHtml(input.validation.blockingIssues.join(', ') || 'none')}</p>
        </div>
        <div>
          <p class="muted">确认指纹</p>
          <div class="hash">sourceDocumentHash=${escapeHtml(c.sourceDocumentHash)}</div>
          <div class="hash">implementationConfirmationHash=${escapeHtml(c.implementationConfirmationHash)}</div>
          <div class="hash">resolvedRecipeHash=${escapeHtml(c.resolvedRecipeHash)}</div>
          <div class="hash">architectureConfirmationArtifactHash=${escapeHtml(artifactHash)}</div>
        </div>
      </div>
    </section>
    <section id="impact" class="grid">
      <div class="card"><h2>消费项目影响扫描</h2>${renderObjectTable(c.consumerImpactScan, ['category', 'status', 'summary', 'description', 'requiredDecision'])}</div>
      <div class="card"><h2>治理系统影响扫描</h2>${renderObjectTable(c.governanceImpactScan, ['category', 'status', 'summary', 'description', 'requiredDecision'])}</div>
    </section>
    <section id="triggers" class="card"><h2>完整架构触发矩阵</h2>${renderObjectTable(c.fullArchitectureTriggerMatrix, ['trigger', 'decision', 'reason', 'requiredDecision'])}</section>
    <section id="paths" class="card"><h2>目标路径</h2><p class="muted">${array(c.targetPaths).length} 个 targetPaths</p>${renderPathTable(c.targetPaths)}</section>
    <section id="hash" class="card"><h2>Hash Recipe 与 stale 输入</h2><div class="grid"><div><h3>Recipe</h3>${renderObjectTable([c.architectureConfirmationHashRecipe || {}], ['schemaVersion', 'recipeVersion', 'configPath', 'resolvedRecipeHash'])}</div><div><h3>Stale Inputs</h3>${renderObjectTable([c.staleInputs || {}], ['sourceDocumentHash', 'implementationConfirmationHash', 'targetPathsHash', 'consumerImpactScanHash', 'governanceImpactScanHash', 'resolvedRecipeHash'])}</div></div></section>
    <section id="risk" class="card"><h2>风险与回滚</h2><p><strong>Risk:</strong> ${escapeHtml(c.riskStatement || '源工件未提供 riskStatement。')}</p><p><strong>Rollback:</strong> ${escapeHtml(c.rollbackPlan || '源工件未提供 rollbackPlan。')}</p><p><strong>Evidence:</strong></p><div class="pill-list">${renderList(c.evidenceRefs)}</div></section>
    <section id="phrase" class="card"><div class="section-title"><h2>确认口令</h2><button class="copy-button" type="button" data-copy-target="architecture-confirmation-phrase">复制确认口令</button></div><pre id="architecture-confirmation-phrase" class="phrase">${escapeHtml(phrase)}</pre><p class="copy-status" data-copy-status aria-live="polite"></p></section>
    <section id="metadata" class="card"><h2>工件元数据</h2>${renderObjectTable([{ jsonPath: input.architecturePath, htmlPath: input.outPath, runId: c.runId, artifactHash, computedArtifactHash: input.validation.computedHash }], ['jsonPath', 'htmlPath', 'runId', 'artifactHash', 'computedArtifactHash'])}</section>
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
      setStatus('未找到确认口令。');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else fallbackCopy(text);
      setStatus('确认口令已复制。');
    } catch {
      setStatus('复制失败，请手动选择口令。');
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
