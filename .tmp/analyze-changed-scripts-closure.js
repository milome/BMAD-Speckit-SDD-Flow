const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const base = cp.execSync('git rev-list -1 --before="2026-05-27 00:00" HEAD', {
  encoding: 'utf8',
}).trim();
const diffRaw = cp
  .execSync(`git diff --name-status ${base}..HEAD -- scripts`, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  .trim();
const numRaw = cp
  .execSync(`git diff --numstat ${base}..HEAD -- scripts`, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  .trim();

const changed = diffRaw
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const parts = line.split(/\t/);
    return { status: parts[0], file: parts[1] };
  });

const numstat = new Map();
for (const line of numRaw.split(/\r?\n/).filter(Boolean)) {
  const [added, deleted, file] = line.split(/\t/);
  numstat.set(file, {
    added,
    deleted,
    churn: (Number(added) || 0) + (Number(deleted) || 0),
  });
}

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rel(abs) {
  return normalize(path.relative(root, abs));
}

function sh(cmd) {
  return cp.execSync(cmd, { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
}

const trackedFiles = sh('git ls-files -z').split('\0').filter(Boolean).map(normalize);
const scanFiles = trackedFiles.filter((f) => {
  if (f.startsWith('node_modules/')) return false;
  if (f.startsWith('packages/')) return true;
  if (f.startsWith('scripts/')) return true;
  if (f.startsWith('_bmad/')) return true;
  if (f.startsWith('.codex/')) return true;
  if (f.startsWith('.cursor/')) return true;
  if (f.startsWith('.claude/')) return true;
  if (f.startsWith('.agents/')) return true;
  if (f.startsWith('tests/')) return true;
  if (f.startsWith('docs/')) return true;
  if (f === 'package.json') return true;
  if (f === 'README.md' || f === 'README.zh-CN.md') return true;
  return false;
});

const textCache = new Map();
for (const f of scanFiles) {
  try {
    textCache.set(f, read(f));
  } catch {
    // Ignore generated or unavailable files in the static scan.
  }
}

function fileKind(f) {
  if (f === 'package.json') return 'root_package_json';
  if (f === 'packages/bmad-speckit/bin/bmad-speckit.js') return 'package_cli';
  if (f.startsWith('packages/bmad-speckit/')) return 'package_bmad_speckit';
  if (f.startsWith('packages/runtime-emit/')) return 'runtime_emit_package';
  if (f.startsWith('_bmad/')) {
    if (f.includes('/hooks/') || f.includes('hooks')) return 'installed_hook_surface';
    if (f.includes('/skills/')) return 'installed_skill_surface';
    return 'installed_bmad_surface';
  }
  if (
    f.startsWith('.codex/') ||
    f.startsWith('.cursor/') ||
    f.startsWith('.claude/') ||
    f.startsWith('.agents/')
  ) {
    if (f.includes('/hooks/')) return 'installed_hook_surface';
    if (f.includes('/skills/')) return 'installed_skill_surface';
    return 'installed_agent_surface';
  }
  if (f.startsWith('tests/')) return 'tests';
  if (f.startsWith('docs/')) return 'docs';
  if (f.startsWith('scripts/')) return 'scripts_source';
  if (f.startsWith('README')) return 'readme';
  return 'other';
}

function isInstallKind(kind) {
  return kind.startsWith('installed_') || kind === 'readme';
}

function isConsumerVisibleKind(kind) {
  return isInstallKind(kind) || kind === 'package_cli' || kind === 'package_bmad_speckit';
}

const packageCli = textCache.get('packages/bmad-speckit/bin/bmad-speckit.js') || '';
const directRunRepo = new Map();
for (const m of packageCli.matchAll(/runRepoScript\(\s*['"]([^'"]+)['"]/g)) {
  const scriptName = m[1];
  const file = scriptName.startsWith('scripts/') ? scriptName : `scripts/${scriptName}`;
  if (!directRunRepo.has(file)) directRunRepo.set(file, []);
  directRunRepo.get(file).push(
    `packages/bmad-speckit/bin/bmad-speckit.js:runRepoScript(${scriptName})`
  );
}

const rootPkg = JSON.parse(read('package.json'));
const npmScriptRefs = new Map();
for (const [name, value] of Object.entries(rootPkg.scripts || {})) {
  for (const row of changed) {
    const script = row.file;
    const basename = path.basename(script);
    if (String(value).includes(script) || String(value).includes(basename)) {
      if (!npmScriptRefs.has(script)) npmScriptRefs.set(script, []);
      npmScriptRefs.get(script).push(name);
    }
  }
}

const packageBinRefs = new Map();
for (const [name, value] of Object.entries(rootPkg.bin || {})) {
  for (const row of changed) {
    if (value === row.file || value.includes(row.file) || value.includes(path.basename(row.file))) {
      if (!packageBinRefs.has(row.file)) packageBinRefs.set(row.file, []);
      packageBinRefs.get(row.file).push(name);
    }
  }
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const baseDir = path.dirname(fromFile);
  const raw = normalize(path.normalize(path.join(baseDir, spec)));
  const candidates = [
    raw,
    `${raw}.ts`,
    `${raw}.js`,
    `${raw}.cjs`,
    `${raw}.mjs`,
    `${raw}/index.ts`,
    `${raw}/index.js`,
    `${raw}/index.cjs`,
    `${raw}/index.mjs`,
  ];
  return candidates.find((candidate) => candidate.startsWith('scripts/') && exists(candidate)) || null;
}

function importsFrom(file, content) {
  const out = new Set();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of content.matchAll(re)) {
      const resolved = resolveImport(file, m[1]);
      if (resolved) out.add(resolved);
    }
  }
  return [...out];
}

const scriptFiles = trackedFiles.filter(
  (f) => f.startsWith('scripts/') && /\.(ts|js|cjs|mjs)$/.test(f) && exists(f)
);
const importGraph = new Map();
const importedBy = new Map();
for (const f of scriptFiles) {
  const imports = importsFrom(f, read(f));
  importGraph.set(f, imports);
  for (const target of imports) {
    if (!importedBy.has(target)) importedBy.set(target, []);
    importedBy.get(target).push(f);
  }
}

const consumerSeeds = new Set([...directRunRepo.keys()].filter(exists));
for (const row of changed) {
  if (!exists(row.file)) continue;
  const exact = row.file;
  const basename = path.basename(row.file);
  const noScripts = exact.replace(/^scripts\//, '');
  const refs = [];
  for (const [f, txt] of textCache.entries()) {
    const kind = fileKind(f);
    if (!isConsumerVisibleKind(kind)) continue;
    if (f === row.file) continue;
    if (txt.includes(exact) || txt.includes(noScripts) || txt.includes(basename)) refs.push(f);
  }
  if (refs.some((f) => isInstallKind(fileKind(f)) || fileKind(f) === 'package_cli')) {
    consumerSeeds.add(row.file);
  }
}

function closureFrom(seeds) {
  const seen = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const cur = queue.shift();
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of importGraph.get(cur) || []) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

const consumerClosure = closureFrom(consumerSeeds);
const mainAgentSeeds = scriptFiles.filter((f) =>
  /(^scripts\/main-agent-|main-agent-orchestration|main-agent-unified-ingress|six-model|reconfirmation|requirement-record|orchestration-|runtime-governance|runtime-context|resolve-active-requirement|emit-runtime-policy)/.test(
    f
  )
);
const mainAgentClosure = closureFrom(new Set(mainAgentSeeds));

let runtimeEmitManifest = '';
try {
  runtimeEmitManifest = [
    read('packages/runtime-emit/dist/build-manifest.json'),
    read('packages/runtime-emit/build.js'),
    read('packages/runtime-emit/package.json'),
  ].join('\n');
} catch {
  runtimeEmitManifest = '';
}

function runtimeEmitHit(script) {
  const basename = path
    .basename(script)
    .replace(/\.ts$/, '')
    .replace(/\.js$/, '')
    .replace(/\.cjs$/, '');
  return runtimeEmitManifest.includes(script) || runtimeEmitManifest.includes(basename);
}

const runtimePattern =
  /(main-agent|six-model|reconfirmation|requirement-record|orchestration|runtime-|runtime_|governance|audit|auditor|reviewer|worker|host|closeout|delivery|scoring|quality-gate|release-gate|truth-gate|active-requirement|implementation-readiness|ai-tdd|sdd-artifact|execution-|supervised)/;
const i18nPattern = /^scripts\/i18n\//;
const ralphPattern = /^scripts\/ralph-method\//;

function refsForScript(script) {
  const basename = path.basename(script);
  const noScripts = script.replace(/^scripts\//, '');
  const refs = [];
  for (const [f, txt] of textCache.entries()) {
    if (f === script) continue;
    if (txt.includes(script) || txt.includes(noScripts) || txt.includes(basename)) {
      refs.push({ file: f, kind: fileKind(f) });
    }
  }
  return refs;
}

function topRefs(refs, n = 12) {
  return refs.slice(0, n).map((r) => `${r.kind}:${r.file}`);
}

function countByKind(refs) {
  const counts = {};
  for (const r of refs) counts[r.kind] = (counts[r.kind] || 0) + 1;
  return counts;
}

function conciseCallers(row, refs) {
  const bits = [];
  if (directRunRepo.has(row.file)) {
    bits.push(`package CLI runRepoScript (${directRunRepo.get(row.file).length})`);
  }
  if (packageBinRefs.has(row.file)) {
    bits.push(`package bin: ${packageBinRefs.get(row.file).join(', ')}`);
  }
  if (npmScriptRefs.has(row.file)) {
    const names = npmScriptRefs.get(row.file);
    bits.push(`npm scripts: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ', ...' : ''}`);
  }
  const counts = countByKind(refs);
  for (const kind of [
    'installed_hook_surface',
    'installed_skill_surface',
    'installed_bmad_surface',
    'installed_agent_surface',
    'package_bmad_speckit',
    'runtime_emit_package',
    'tests',
    'docs',
    'scripts_source',
  ]) {
    if (counts[kind]) bits.push(`${kind}:${counts[kind]}`);
  }
  if (importedBy.has(row.file)) bits.push(`importedBy scripts:${importedBy.get(row.file).length}`);
  return bits.join('; ') || 'no direct current reference found by static scan';
}

function classify(row, refs) {
  const f = row.file;
  const installRefs = refs.filter((r) => isInstallKind(r.kind));
  const packageRefs = refs.filter((r) => r.kind === 'package_cli' || r.kind === 'package_bmad_speckit');
  const onlyTestsDocsScripts = refs.every((r) =>
    ['tests', 'docs', 'scripts_source', 'root_package_json'].includes(r.kind)
  );
  const runtimeish = runtimePattern.test(f);
  const inConsumerClosure = consumerClosure.has(f);
  const inMainAgentClosure = mainAgentClosure.has(f);
  const emitHit = runtimeEmitHit(f);

  if (row.status.startsWith('D')) {
    return {
      classification: 'removed_path_verify_callers_clean',
      consumerReach: refs.length ? 'possible_stale_references' : 'none_found',
      target: 'No migration target; verify former callers use package renderer/stable replacement.',
      risk: refs.length ? 'medium' : 'low',
      action:
        'Keep in ledger until stale references and package renderer replacement are proven clean. No deletion action is needed because file is already absent.',
    };
  }

  if (directRunRepo.has(f)) {
    return {
      classification: 'consumer_runtime_migrate',
      consumerReach: 'yes_direct_package_cli',
      target: 'packages/bmad-speckit/src/... compiled package runtime or approved de-surface.',
      risk: runtimeish ? 'high' : 'medium',
      action:
        'Replace package CLI runRepoScript dispatch with package-relative JS/CJS runtime and add install-mode tests.',
    };
  }

  if (inConsumerClosure) {
    return {
      classification: emitHit
        ? 'consumer_runtime_migrate_or_package_compiled_runtime'
        : 'consumer_runtime_migrate',
      consumerReach: 'yes_import_closure_or_installed_surface',
      target: emitHit
        ? 'Package CLI/runtime must execute compiled package artifact; root TS may remain source only.'
        : 'packages/bmad-speckit/src/... or durable installed runtime helper according to caller.',
      risk: runtimeish ? 'high' : 'medium',
      action:
        'Migrate with the consumer runtime closure or prove the consumer-executed artifact is compiled and package-relative.',
    };
  }

  if (installRefs.length > 0) {
    const skillOnly = installRefs.every((r) => r.kind === 'installed_skill_surface');
    const hookOrBmad = installRefs.some((r) =>
      ['installed_hook_surface', 'installed_bmad_surface', 'installed_agent_surface'].includes(r.kind)
    );
    if (runtimeish || hookOrBmad) {
      return {
        classification: emitHit
          ? 'package_compiled_runtime_or_durable_helper_migrate'
          : 'durable_helper_migrate',
        consumerReach: 'yes_installed_surface_reference',
        target: emitHit
          ? '@bmad-speckit/runtime-emit compiled CJS or packages/bmad-speckit runtime; no root TS execution.'
          : '_bmad/scripts, _bmad/speckit/scripts, or packages/bmad-speckit runtime.',
        risk: runtimeish ? 'high' : 'medium',
        action:
          'Replace installed-surface root script reference with stable installed helper or package runtime and add initialized-consumer tests.',
      };
    }
    return {
      classification: skillOnly ? 'skill_local_migrate' : 'durable_helper_migrate',
      consumerReach: 'yes_installed_surface_reference',
      target: skillOnly ? '_bmad/skills/<skill>/scripts/ or package command.' : '_bmad/scripts or _bmad/speckit/scripts.',
      risk: 'medium',
      action: 'Move under caller-owned installed helper surface or replace references with stable package CLI.',
    };
  }

  if (
    runtimeish &&
    (inMainAgentClosure ||
      packageRefs.length > 0 ||
      (importedBy.get(f) || []).some((importer) => runtimePattern.test(importer)))
  ) {
    return {
      classification: 'pending_runtime_closure_review',
      consumerReach: 'possible_main_agent_or_runtime_closure',
      target: 'Probably packages/bmad-speckit/src/... unless proven source-dev-only or package-compiled-runtime.',
      risk: 'high',
      action:
        'Do not mark internal yet. Prove whether Main Agent/six-model/auditor/worker/runtime closure reaches it before migration decision.',
    };
  }

  if (emitHit) {
    return {
      classification: 'package_compiled_runtime',
      consumerReach: 'compiled_artifact_possible',
      target:
        '@bmad-speckit/runtime-emit compiled JS/CJS artifact; root source may remain only as build input.',
      risk: 'medium',
      action:
        'Verify build manifest, package export, packed artifact, and install tests execute compiled CJS, not root TS.',
    };
  }

  if (ralphPattern.test(f)) {
    return {
      classification: 'source_dev_compatibility_wrapper_pending_cleanup',
      consumerReach: 'no_direct_consumer_reference_found',
      target:
        'Canonical implementation already belongs under packages/ralph-method; root shim can remain source-dev-only until callers switch.',
      risk: 'low',
      action:
        'Switch tests/source callers to package path first; deletion requires approval after validation.',
    };
  }

  if (i18nPattern.test(f)) {
    return {
      classification: 'repo_internal_keep_or_skill_local_migrate',
      consumerReach: refs.some((r) => isInstallKind(r.kind))
        ? 'installed_reference_possible'
        : 'no_direct_consumer_reference_found',
      target:
        'Root scripts for source i18n maintenance, or skill-local helper if a skill executes it after install.',
      risk: refs.some((r) => isInstallKind(r.kind)) ? 'medium' : 'low',
      action:
        'Keep as source-dev/i18n maintenance unless an installed skill/hook executes it; then move to caller-owned helper surface.',
    };
  }

  if (npmScriptRefs.has(f)) {
    return {
      classification: runtimeish ? 'pending_runtime_closure_review' : 'repo_internal_keep',
      consumerReach: runtimeish ? 'possible_source_dev_or_runtime_gate' : 'source_repo_npm_script_only',
      target: runtimeish
        ? 'Prove source-dev-only or migrate to package runtime.'
        : 'Root scripts with manifest class repo_maintenance/source_dev/ci as applicable.',
      risk: runtimeish ? 'medium' : 'low',
      action: runtimeish
        ? 'Do not expose to consumers; add source-dev-only proof or package migration.'
        : 'Retain under root scripts with explicit non-consumer manifest class.',
    };
  }

  if (refs.length === 0) {
    return {
      classification: runtimeish ? 'pending_classification' : 'repo_internal_keep',
      consumerReach: 'no_direct_current_reference_found',
      target: runtimeish ? 'Needs owner review; likely package runtime or source-dev-only.' : 'Root scripts source-dev/internal unless future caller is found.',
      risk: runtimeish ? 'medium' : 'low',
      action: runtimeish ? 'Inspect intended owner before any move/delete.' : 'Keep/reclassify; no deletion without explicit approval.',
    };
  }

  if (onlyTestsDocsScripts) {
    return {
      classification: 'repo_internal_keep',
      consumerReach: 'repo_docs_tests_only',
      target:
        'Root scripts or tests/helpers depending on whether it is a real source-dev tool or test fixture.',
      risk: 'low',
      action:
        'Keep under root scripts if source-dev tool; move to tests/helpers only if proven test-only.',
    };
  }

  return {
    classification: 'pending_classification',
    consumerReach: 'unclear',
    target: 'Needs import/call graph owner review before migration.',
    risk: runtimeish ? 'medium' : 'low',
    action: 'Do not delete. Classify with owner and caller evidence first.',
  };
}

const rows = changed.map((row) => {
  const refs = refsForScript(row.file);
  const cls = classify(row, refs);
  const ns = numstat.get(row.file) || {};
  return {
    status: row.status,
    file: row.file,
    added: ns.added ?? '',
    deleted: ns.deleted ?? '',
    churn: ns.churn ?? 0,
    exists: exists(row.file),
    classification: cls.classification,
    consumerReach: cls.consumerReach,
    target: cls.target,
    risk: cls.risk,
    action: cls.action,
    callers: conciseCallers(row, refs),
    directPackageCliRunRepoScript: directRunRepo.get(row.file) || [],
    npmScripts: npmScriptRefs.get(row.file) || [],
    packageBins: packageBinRefs.get(row.file) || [],
    importedBy: importedBy.get(row.file) || [],
    imports: importGraph.get(row.file) || [],
    inConsumerClosure: consumerClosure.has(row.file),
    inMainAgentClosure: mainAgentClosure.has(row.file),
    runtimeEmitHit: runtimeEmitHit(row.file),
    referenceCounts: countByKind(refs),
    topReferences: topRefs(refs),
  };
});

rows.sort((a, b) => {
  function priority(r) {
    if (r.directPackageCliRunRepoScript.length) return 0;
    if (r.classification.includes('consumer_runtime')) return 1;
    if (r.classification.includes('pending_runtime')) return 2;
    if (r.classification.includes('durable')) return 3;
    if (r.classification.includes('package_compiled')) return 4;
    if (r.classification.includes('skill')) return 5;
    if (r.classification.includes('removed')) return 6;
    return 7;
  }
  return priority(a) - priority(b) || b.churn - a.churn || a.file.localeCompare(b.file);
});

const counts = rows.reduce(
  (acc, r) => {
    acc.byClassification[r.classification] = (acc.byClassification[r.classification] || 0) + 1;
    acc.byStatus[r.status] = (acc.byStatus[r.status] || 0) + 1;
    acc.byRisk[r.risk] = (acc.byRisk[r.risk] || 0) + 1;
    return acc;
  },
  { byClassification: {}, byStatus: {}, byRisk: {} }
);
const directConsumer = rows.filter((r) => r.consumerReach.startsWith('yes'));
const possibleRuntime = rows.filter(
  (r) => r.consumerReach.startsWith('possible') || r.classification.includes('pending')
);
const highRisk = rows.filter((r) => r.risk === 'high');

fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });

const jsonPath = path.join(root, '.tmp', 'changed-scripts-closure-ledger.json');
fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      base,
      command: `git diff --name-status ${base}..HEAD -- scripts`,
      counts,
      consumerSeeds: [...consumerSeeds].sort(),
      rows,
    },
    null,
    2
  ),
  'utf8'
);

function mdEscape(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function compactRefs(r) {
  const parts = [];
  if (r.directPackageCliRunRepoScript.length) parts.push('package CLI runRepoScript');
  if (r.npmScripts.length) parts.push(`npm:${r.npmScripts.slice(0, 3).join(', ')}`);
  const rc = r.referenceCounts || {};
  for (const [k, v] of Object.entries(rc)) {
    if (
      [
        'installed_hook_surface',
        'installed_skill_surface',
        'installed_bmad_surface',
        'installed_agent_surface',
        'package_bmad_speckit',
        'runtime_emit_package',
        'tests',
        'docs',
        'scripts_source',
      ].includes(k)
    ) {
      parts.push(`${k}:${v}`);
    }
  }
  if (r.importedBy.length) parts.push(`importedBy:${r.importedBy.length}`);
  return parts.join('; ') || 'no direct reference found';
}

const md = [];
md.push('# 2026-05-27+ Changed Scripts Closure Classification');
md.push('');
md.push('Status: initial closure classification ledger, not a migration approval and not a deletion approval');
md.push(`Generated: ${new Date().toISOString()}`);
md.push(`Baseline: ${base}`);
md.push('');
md.push('## Purpose');
md.push('');
md.push(
  'Classify every root `scripts/` file added, deleted, or materially changed since 2026-05-27 before moving code. The goal is to avoid two failure modes: deleting internal scripts without proof, and missing consumer runtime dependencies that still rely on root TypeScript scripts or local `tsx`/`ts-node`.'
);
md.push('');
md.push('## Scope');
md.push('');
md.push('| Metric | Count |');
md.push('| --- | ---: |');
md.push(`| Added | ${counts.byStatus.A || 0} |`);
md.push(`| Modified | ${counts.byStatus.M || 0} |`);
md.push(`| Deleted | ${counts.byStatus.D || 0} |`);
md.push(`| Total | ${rows.length} |`);
md.push('');
md.push('## Classification Summary');
md.push('');
md.push('| Classification | Count |');
md.push('| --- | ---: |');
for (const [k, v] of Object.entries(counts.byClassification).sort(
  (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
)) {
  md.push(`| ${k} | ${v} |`);
}
md.push('');
md.push('| Risk | Count |');
md.push('| --- | ---: |');
for (const [k, v] of Object.entries(counts.byRisk).sort()) md.push(`| ${k} | ${v} |`);
md.push('');
md.push('## Rules Applied');
md.push('');
md.push('- Direct package CLI `runRepoScript(...)` is `consumer_runtime_migrate`.');
md.push(
  '- Any script reachable from consumer-installed surfaces or package CLI script import closure is treated as consumer runtime until proven otherwise.'
);
md.push(
  '- Main Agent, six-model, reconfirmation, requirement-record, governance, auditor, worker, delivery, and gate scripts are not marked internal solely because no direct installed-surface reference was found.'
);
md.push(
  '- `@bmad-speckit/runtime-emit` is accepted only when the consumer-executed artifact is compiled CJS and tests prove consumers do not execute root TS.'
);
md.push(
  '- Root script deletion remains empty by default. Every row requires migrate-or-reclassify first and explicit per-script approval before deletion.'
);
md.push('');
md.push('## Direct Consumer Runtime Hits');
md.push('');
md.push('These rows have direct evidence that consumers can hit them through package CLI or installed surfaces.');
md.push('');
md.push('| Script | Evidence | Required target | Risk |');
md.push('| --- | --- | --- | --- |');
for (const r of directConsumer) {
  md.push(`| \`${r.file}\` | ${mdEscape(compactRefs(r))} | ${mdEscape(r.target)} | ${r.risk} |`);
}
md.push('');
md.push('## Main Agent / Runtime Closure Pending Proof');
md.push('');
md.push(
  'These rows should not be called internal yet. They need package-runtime migration or source-dev-only proof from call graph and install-mode tests.'
);
md.push('');
md.push('| Script | Classification | Evidence | Target | Risk |');
md.push('| --- | --- | --- | --- | --- |');
for (const r of possibleRuntime) {
  md.push(
    `| \`${r.file}\` | ${r.classification} | ${mdEscape(compactRefs(r))} | ${mdEscape(r.target)} | ${r.risk} |`
  );
}
md.push('');
md.push('## Full 140-Row Ledger');
md.push('');
md.push(
  '| # | Status | Script | Class | Consumer reach | Who calls / references it | Need packaging? | Can become package module? | Source-dev only? | Risk | Next action |'
);
md.push('| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
rows.forEach((r, i) => {
  const needPackaging =
    r.classification.includes('consumer_runtime') ||
    r.classification.includes('package_compiled') ||
    r.classification.includes('durable') ||
    r.classification.includes('skill_local') ||
    r.consumerReach.startsWith('yes')
      ? 'yes'
      : r.classification.includes('pending')
        ? 'unknown'
        : 'no';
  const canPackage =
    r.status === 'D'
      ? 'n/a'
      : r.classification.includes('repo_internal') || r.classification.includes('source_dev')
        ? 'not preferred'
        : 'yes, after logic/CLI split';
  const sourceDevOnly =
    r.classification.includes('repo_internal') || r.classification.includes('source_dev')
      ? 'yes with proof'
      : r.classification.includes('pending')
        ? 'unproven'
        : 'no';
  md.push(
    `| ${i + 1} | ${r.status} | \`${r.file}\` | ${r.classification} | ${r.consumerReach} | ${mdEscape(compactRefs(r))} | ${needPackaging} | ${canPackage} | ${sourceDevOnly} | ${r.risk} | ${mdEscape(r.action)} |`
  );
});
md.push('');
md.push('## Deletion Ledger');
md.push('');
md.push(
  'No script is approved for deletion by this classification. Deletion requires replacement path, switched callers, passing tests/install matrix, no repo workflow dependency, and explicit per-script approval.'
);
md.push('');
md.push('## Evidence Files');
md.push('');
md.push('- Machine-readable evidence: `.tmp/changed-scripts-closure-ledger.json`');
md.push(`- Diff command: \`git diff --name-status ${base}..HEAD -- scripts\``);
md.push('');

const mdPath = path.join(root, 'docs', 'plans', '2026-06-02-changed-scripts-closure-classification.md');
fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

console.log(
  JSON.stringify(
    {
      base,
      rows: rows.length,
      counts,
      jsonPath: rel(jsonPath),
      mdPath: rel(mdPath),
      directConsumer: directConsumer.length,
      possibleRuntime: possibleRuntime.length,
      highRisk: highRisk.length,
    },
    null,
    2
  )
);
