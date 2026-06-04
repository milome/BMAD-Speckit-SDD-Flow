#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.5';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const OWNER_REGISTRY_PATH = path.join(ROOT, '_bmad', '_config', 'script-owner-model-registry.yaml');
const CONTRACT_PATH = path.join(WAVE_DIR, 'registry-invocation-contract.json');
const HELPER_PATH = path.join(WAVE_DIR, 'skill-helper-hardening.json');
const PARITY_PATH = path.join(WAVE_DIR, 'skill-sync-parity.json');
const EVIDENCE_PATH = path.join(WAVE_DIR, 'evidence.json');
const SUMMARY_PATH = path.join(WAVE_DIR, 'summary.md');

const REQUIRED_GROUPS = [
  'execution_closure',
  'implementation_readiness',
  'architecture_confirmation',
  'requirement_confirmation',
  'audit_review',
  'delivery_confirmation',
];

const REQUIRED_FIELDS = [
  'sourceRepoPath',
  'sourcePathKind',
  'consumerInvocationKind',
  'consumerInvocation',
  'consumerRootPathRequired',
  'packageRuntimeCommand',
  'installedHelperPath',
  'consumerRuntimeAvailability',
  'directNodeTsInvocationSupported',
];

const CONSUMER_RUNNABLE = new Set([
  'package_cli',
  'package_runtime_module',
  'consumer_installed_helper',
]);

const ALLOWED_INVOCATION_KINDS = new Set([
  ...CONSUMER_RUNNABLE,
  'source_repo_only',
  'not_consumer_runnable',
]);

const REQUIRED_HELPERS = [
  '_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
  '_bmad/skills/req-trace-matrix-prompt-generator/scripts/load-js-yaml.js',
  '_bmad/skills/goal-execution-contract-generator/scripts/check-docs-review-dependency.js',
];

const PARITY_SURFACES = [
  '.codex/skills',
  '.claude/skills',
  '.cursor/skills',
  '_bmad/skills',
  'packages/bmad-speckit/_bmad/skills',
];

const REQUIRED_PARITY_SKILLS = [
  'requirements-contract-authoring',
  'bmad-code-reviewer-lifecycle',
  'bmad-rca-helper',
  'bmad-standalone-tasks-doc-review',
];

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function repoPath(filePath) {
  return slash(path.relative(ROOT, filePath));
}

function readJson(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${repoPath(filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid JSON ${repoPath(filePath)}: ${error.message}`);
    return null;
  }
}

function readYaml(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${repoPath(filePath)}`);
    return null;
  }
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid YAML ${repoPath(filePath)}: ${error.message}`);
    return null;
  }
}

function collectRegistryRows(registry) {
  return (registry?.scripts || []).filter((row) => {
    const rowPath = slash(row.path);
    return rowPath.startsWith('scripts/') && rowPath.endsWith('.ts');
  });
}

function groupCounts(rows) {
  const counts = {};
  for (const row of rows) counts[row.ownerModel] = (counts[row.ownerModel] || 0) + 1;
  return counts;
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field);
}

function containsForbiddenRuntime(value) {
  const text = slash(value || '');
  return (
    /(^|\s|["'])scripts\/[^"'\s]+\.ts(\s|["']|$)/u.test(text) ||
    /node_modules\/[^"'\s]*\/scripts\/[^"'\s]+\.ts/u.test(text) ||
    /\btsx\b/u.test(text) ||
    /\bts-node\b/u.test(text)
  );
}

function validateRegistryRows(rows, errors) {
  for (const row of rows) {
    for (const field of REQUIRED_FIELDS) {
      if (!hasOwn(row, field)) errors.push(`${row.scriptId} missing ${field}`);
    }
    if (row.sourceRepoPath !== row.path) errors.push(`${row.scriptId} sourceRepoPath must equal path`);
    if (row.sourcePathKind !== 'source_repo_provenance') {
      errors.push(`${row.scriptId} sourcePathKind must be source_repo_provenance`);
    }
    if (!ALLOWED_INVOCATION_KINDS.has(row.consumerInvocationKind)) {
      errors.push(`${row.scriptId} invalid consumerInvocationKind ${row.consumerInvocationKind}`);
    }
    if (row.consumerRootPathRequired !== false) {
      errors.push(`${row.scriptId} consumerRootPathRequired must be false`);
    }
    if (row.directNodeTsInvocationSupported !== false) {
      errors.push(`${row.scriptId} directNodeTsInvocationSupported must be false`);
    }
    if (row.consumerInvocationKind === 'package_cli') {
      if (!String(row.consumerInvocation || '').startsWith('npx --no-install bmad-speckit')) {
        errors.push(`${row.scriptId} package_cli must use npx --no-install bmad-speckit`);
      }
      if (!row.consumerEvidenceCommand) errors.push(`${row.scriptId} package_cli missing consumerEvidenceCommand`);
    }
    if (row.consumerInvocationKind === 'source_repo_only') {
      if (row.consumerRuntimeAvailability !== 'unavailable_in_consumer_project') {
        errors.push(`${row.scriptId} source_repo_only availability must be unavailable_in_consumer_project`);
      }
    }
    if (row.consumerInvocationKind === 'not_consumer_runnable') {
      if (row.consumerRuntimeAvailability !== 'not_applicable') {
        errors.push(`${row.scriptId} not_consumer_runnable availability must be not_applicable`);
      }
    }
    if (CONSUMER_RUNNABLE.has(row.consumerInvocationKind)) {
      for (const field of ['consumerInvocation', 'packageRuntimeCommand', 'consumerEvidenceCommand']) {
        if (containsForbiddenRuntime(row[field])) {
          errors.push(`${row.scriptId} ${field} contains forbidden runtime path`);
        }
      }
    }
    if (containsForbiddenRuntime(row.installedHelperPath)) {
      errors.push(`${row.scriptId} installedHelperPath contains forbidden runtime path`);
    }
  }
}

function validateRegistryContract(rows, errors) {
  const contract = readJson(CONTRACT_PATH, errors);
  if (!contract) return;
  const counts = groupCounts(rows);
  if (contract.waveId !== WAVE_ID) errors.push('registry-invocation-contract waveId mismatch');
  if (contract.totalScriptRows !== rows.length) errors.push('registry-invocation-contract totalScriptRows mismatch');
  for (const group of REQUIRED_GROUPS) {
    if (!contract.coveredGroups?.includes(group)) errors.push(`registry contract missing group ${group}`);
    if (contract.groupCounts?.[group] !== counts[group]) {
      errors.push(`registry contract group count mismatch for ${group}`);
    }
  }
  if (!Array.isArray(contract.rows) || contract.rows.length !== rows.length) {
    errors.push('registry-invocation-contract rows length mismatch');
    return;
  }
  for (const row of rows) {
    const receipt = contract.rows.find((item) => item.scriptId === row.scriptId);
    if (!receipt) {
      errors.push(`registry-invocation-contract missing row ${row.scriptId}`);
      continue;
    }
    if (receipt.sourceRepoPath !== row.sourceRepoPath) errors.push(`${row.scriptId} contract sourceRepoPath mismatch`);
    if (receipt.consumerInvocationKind !== row.consumerInvocationKind) {
      errors.push(`${row.scriptId} contract consumerInvocationKind mismatch`);
    }
    if (receipt.consumerRootPathRequired !== false) {
      errors.push(`${row.scriptId} contract consumerRootPathRequired must be false`);
    }
    if (receipt.directNodeTsInvocationSupported !== false) {
      errors.push(`${row.scriptId} contract directNodeTsInvocationSupported must be false`);
    }
  }
}

function runNodeProbe(target, cwd) {
  const result = spawnSync(process.execPath, [target], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    command: `node ${repoPath(target)}`,
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function validateHelpers(errors) {
  const receipt = readJson(HELPER_PATH, errors);
  if (!receipt) return;
  if (receipt.waveId !== WAVE_ID) errors.push('skill-helper-hardening waveId mismatch');
  const entries = Array.isArray(receipt.entries) ? receipt.entries : [];
  const byOriginal = new Map(entries.map((entry) => [slash(entry.originalPath), entry]));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-wave35-helper-'));
  fs.writeFileSync(path.join(tempDir, 'package.json'), '{"type":"module"}\n', 'utf8');
  try {
    for (const helper of REQUIRED_HELPERS) {
      const entry = byOriginal.get(helper);
      if (!entry) {
        errors.push(`skill-helper-hardening missing ${helper}`);
        continue;
      }
      if (!['local_commonjs_package_boundary', 'cjs_entrypoint'].includes(entry.hardeningRoute)) {
        errors.push(`${helper} invalid hardeningRoute ${entry.hardeningRoute}`);
      }
      const hardened = path.join(ROOT, entry.hardenedPath || entry.originalPath);
      if (!fs.existsSync(hardened)) errors.push(`${helper} hardenedPath missing`);
      if (entry.hardeningRoute === 'local_commonjs_package_boundary') {
        const boundary = path.join(ROOT, entry.boundaryPath || '');
        if (!fs.existsSync(boundary)) errors.push(`${helper} boundaryPath missing`);
        else {
          const pkg = JSON.parse(fs.readFileSync(boundary, 'utf8'));
          if (pkg.type !== 'commonjs') errors.push(`${helper} boundary type must be commonjs`);
        }
      }
      const probe = runNodeProbe(hardened, tempDir);
      const combined = `${probe.stdout}\n${probe.stderr}`;
      if (/ERR_REQUIRE_ESM|ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/u.test(combined)) {
        errors.push(`${helper} failed module-type probe: ${combined}`);
      }
      if (entry.typeModuleProbe?.moduleTypeSafe !== true) {
        errors.push(`${helper} typeModuleProbe.moduleTypeSafe must be true`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function listSkillFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...listSkillFiles(full));
    if (entry.isFile() && entry.name === 'SKILL.md') files.push(full);
  }
  return files;
}

function hasValidFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
  const lines = text.split(/\r?\n/u);
  if (lines[0] !== '---') return false;
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (endIndex < 0) return false;
  const frontmatter = lines.slice(1, endIndex).join('\n');
  return /^name:\s*.+$/mu.test(frontmatter) && /^description:\s*.+$/mu.test(frontmatter);
}

function validateSkillParity(errors) {
  const receipt = readJson(PARITY_PATH, errors);
  if (!receipt) return;
  if (receipt.waveId !== WAVE_ID) errors.push('skill-sync-parity waveId mismatch');
  for (const surface of PARITY_SURFACES) {
    if (!receipt.surfaces?.[surface]) errors.push(`skill-sync-parity missing surface ${surface}`);
  }
  for (const surface of PARITY_SURFACES) {
    const rootDir = path.join(ROOT, surface);
    const files = listSkillFiles(rootDir);
    for (const file of files) {
      if (!hasValidFrontmatter(file)) errors.push(`invalid frontmatter: ${repoPath(file)}`);
    }
  }
  for (const skill of REQUIRED_PARITY_SKILLS) {
    const records = receipt.skills?.[skill];
    if (!records) {
      errors.push(`skill-sync-parity missing skill ${skill}`);
      continue;
    }
    for (const surface of ['.codex/skills', '.claude/skills', '.cursor/skills', '_bmad/skills']) {
      const record = records[surface];
      const skillPath = path.join(ROOT, surface, skill, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        if (!record?.exists) errors.push(`${skill} ${surface} exists but receipt says missing`);
        if (record?.frontmatterValid !== true) errors.push(`${skill} ${surface} frontmatterValid must be true`);
      }
    }
  }
}

function validateEvidenceAndSummary(errors) {
  const evidence = readJson(EVIDENCE_PATH, errors);
  if (evidence) {
    if (evidence.waveId !== WAVE_ID) errors.push('evidence waveId mismatch');
    if (evidence.result !== 'passed') errors.push('evidence result must be passed');
    if (evidence.noRootScriptDeletion !== true) errors.push('evidence noRootScriptDeletion must be true');
    if (evidence.consumerRootScriptsDependency !== false) errors.push('evidence consumerRootScriptsDependency must be false');
    if (evidence.userGlobalSkillWrite !== false) errors.push('evidence userGlobalSkillWrite must be false');
  }
  if (!fs.existsSync(SUMMARY_PATH)) {
    errors.push(`missing file: ${repoPath(SUMMARY_PATH)}`);
  } else {
    const summary = fs.readFileSync(SUMMARY_PATH, 'utf8');
    for (const required of [
      'No root script deletion',
      'No consumer root scripts/*.ts dependency',
      'No user-global skill write',
      'npx --no-install bmad-speckit',
    ]) {
      if (!summary.includes(required)) errors.push(`summary missing ${required}`);
    }
  }
}

function validateNoRootScriptDeletion(errors) {
  const result = spawnSync('git', ['status', '--short', '--', 'scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    errors.push(`git status scripts failed: ${result.stderr || result.stdout}`);
    return;
  }
  const bad = result.stdout
    .split(/\r?\n/u)
    .filter((line) => /^( D|D |R )\s+scripts[\\/]/u.test(line));
  if (bad.length > 0) errors.push(`root script deletion or rename detected: ${bad.join('; ')}`);
}

function main() {
  const errors = [];
  const registry = readYaml(OWNER_REGISTRY_PATH, errors);
  const rows = collectRegistryRows(registry);
  const counts = groupCounts(rows);
  for (const group of REQUIRED_GROUPS) {
    if (!counts[group]) errors.push(`missing kbase-audited group ${group}`);
  }
  validateRegistryRows(rows, errors);
  validateRegistryContract(rows, errors);
  validateHelpers(errors);
  validateSkillParity(errors);
  validateEvidenceAndSummary(errors);
  validateNoRootScriptDeletion(errors);

  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    waveId: WAVE_ID,
    registryRows: rows.length,
    groupCounts: counts,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
