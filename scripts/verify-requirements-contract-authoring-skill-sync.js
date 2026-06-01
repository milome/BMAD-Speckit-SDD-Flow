#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, '_bmad', 'skills', 'requirements-contract-authoring');

const surfaces = [
  path.join(projectRoot, '.codex', 'skills', 'requirements-contract-authoring'),
  path.join(projectRoot, '.claude', 'skills', 'requirements-contract-authoring'),
  path.join(projectRoot, '.cursor', 'skills', 'requirements-contract-authoring'),
  path.join(projectRoot, 'packages', 'bmad-speckit', '_bmad', 'skills', 'requirements-contract-authoring'),
  'C:/Users/milom/.codex/skills/requirements-contract-authoring',
  'C:/Users/milom/.claude/skills/requirements-contract-authoring',
  'C:/Users/milom/.cursor/skills/requirements-contract-authoring',
];

function normalizePathForReport(value) {
  return value.replace(/\\/g, '/');
}

function listFiles(root) {
  const result = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      result.push(normalizePathForReport(path.relative(root, absolute)));
    }
  }
  visit(root);
  return result.sort();
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function fileHash(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function directoryHash(root, files) {
  const hash = crypto.createHash('sha256');
  for (const relative of files) {
    hash.update(relative);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relative)));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function runHelp(skillDir) {
  const script = path.join(skillDir, 'scripts', 'assess_contract_authoring_scale.js');
  const result = spawnSync(process.execPath, [script, '--help'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    hasPhase: `${result.stdout || ''}\n${result.stderr || ''}`.includes('--phase'),
  };
}

function inspectSkillDir(skillDir, sourceFiles) {
  const normalizedPath = normalizePathForReport(skillDir);
  if (!fs.existsSync(skillDir)) {
    return {
      ok: false,
      path: normalizedPath,
      missing: true,
      issues: ['surface_missing'],
    };
  }
  const files = listFiles(skillDir);
  const missingFiles = sourceFiles.filter((file) => !files.includes(file));
  const extraFiles = files.filter((file) => !sourceFiles.includes(file));
  const mismatchedFiles = [];
  for (const relative of sourceFiles) {
    const sourcePath = path.join(sourceDir, relative);
    const targetPath = path.join(skillDir, relative);
    if (!fs.existsSync(targetPath)) continue;
    if (fileHash(sourcePath) !== fileHash(targetPath)) mismatchedFiles.push(relative);
  }
  const help = runHelp(skillDir);
  const runCheckpointsPath = path.join(skillDir, 'scripts', 'run_semantic_checkpoints.js');
  const assessPath = path.join(skillDir, 'scripts', 'assess_contract_authoring_scale.js');
  const issues = [];
  if (missingFiles.length) issues.push('missing_files');
  if (extraFiles.length) issues.push('extra_files');
  if (mismatchedFiles.length) issues.push('mismatched_files');
  if (!help.hasPhase || help.status !== 0) issues.push('assess_help_phase_missing');

  return {
    ok: issues.length === 0,
    path: normalizedPath,
    missing: false,
    fileCount: files.length,
    directoryHash: directoryHash(skillDir, files),
    runSemanticCheckpointsHash: fs.existsSync(runCheckpointsPath) ? fileHash(runCheckpointsPath) : null,
    assessContractAuthoringScaleHash: fs.existsSync(assessPath) ? fileHash(assessPath) : null,
    assessHelp: {
      status: help.status,
      hasPhase: help.hasPhase,
      outputPreview: `${help.stdout}\n${help.stderr}`.trim().split(/\r?\n/u).slice(0, 12),
    },
    missingFiles,
    extraFiles,
    mismatchedFiles,
    issues,
  };
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`requirements-contract-authoring source dir missing: ${normalizePathForReport(sourceDir)}`);
    return 2;
  }
  const sourceFiles = listFiles(sourceDir);
  const source = {
    path: normalizePathForReport(sourceDir),
    fileCount: sourceFiles.length,
    directoryHash: directoryHash(sourceDir, sourceFiles),
    runSemanticCheckpointsHash: fileHash(path.join(sourceDir, 'scripts', 'run_semantic_checkpoints.js')),
    assessContractAuthoringScaleHash: fileHash(
      path.join(sourceDir, 'scripts', 'assess_contract_authoring_scale.js')
    ),
  };
  const surfaceResults = surfaces.map((surface) => inspectSkillDir(path.resolve(surface), sourceFiles));
  const ok = surfaceResults.every((surface) => {
    return (
      surface.ok &&
      surface.fileCount === source.fileCount &&
      surface.directoryHash === source.directoryHash &&
      surface.runSemanticCheckpointsHash === source.runSemanticCheckpointsHash &&
      surface.assessContractAuthoringScaleHash === source.assessContractAuthoringScaleHash
    );
  });
  const report = {
    ok,
    source,
    surfaces: surfaceResults,
  };
  const output = JSON.stringify(report, null, 2);
  if (ok) {
    console.log(output);
    return 0;
  }
  console.error(output);
  return 1;
}

if (require.main === module) {
  process.exit(main());
}
