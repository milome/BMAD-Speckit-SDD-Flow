#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function dirExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function findDocsReview() {
  const cwd = process.cwd();
  const home = os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
  const candidates = [
    path.join(cwd, ".codex", "skills", "docs-review", "SKILL.md"),
    path.join(cwd, ".cursor", "skills", "docs-review", "SKILL.md"),
    path.join(cwd, ".claude", "skills", "docs-review", "SKILL.md"),
    path.join(cwd, "_bmad", "skills", "docs-review", "SKILL.md"),
    path.join(cwd, "_bmad", "codex", "skills", "docs-review", "SKILL.md"),
    path.join(cwd, "_bmad", "cursor", "skills", "docs-review", "SKILL.md"),
    path.join(cwd, "_bmad", "claude", "skills", "docs-review", "SKILL.md"),
    path.join(codexHome, "skills", "docs-review", "SKILL.md"),
    path.join(home, ".codex", "skills", "docs-review", "SKILL.md"),
    path.join(home, ".agents", "skills", "docs-review", "SKILL.md"),
    path.join(home, ".cursor", "skills", "docs-review", "SKILL.md"),
    path.join(home, ".claude", "skills", "docs-review", "SKILL.md"),
  ];

  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function findInstaller() {
  const home = os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
  const candidates = [
    path.join(codexHome, "skills", ".system", "skill-installer", "scripts", "install-skill-from-github.py"),
    path.join(home, ".codex", "skills", ".system", "skill-installer", "scripts", "install-skill-from-github.py"),
  ];

  return candidates.find(fileExists) || null;
}

function installFromLocalSource() {
  const source = process.env.DOCS_REVIEW_SKILL_SOURCE;
  if (!source) {
    return null;
  }

  const sourceSkill = path.join(source, "SKILL.md");
  if (!fileExists(sourceSkill)) {
    return {
      ok: false,
      method: "local_source",
      reason: `DOCS_REVIEW_SKILL_SOURCE does not contain SKILL.md: ${source}`,
    };
  }

  const home = os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
  const dest = path.join(codexHome, "skills", "docs-review");
  if (dirExists(dest)) {
    return { ok: true, method: "local_source_existing", skillPath: path.join(dest, "SKILL.md") };
  }

  copyDir(source, dest);
  return { ok: true, method: "local_source", skillPath: path.join(dest, "SKILL.md") };
}

function installFromOpenAISkills(installer) {
  const home = os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
  const attempts = [
    ["openai/skills", "skills/.curated/docs-review"],
    ["openai/skills", "skills/.experimental/docs-review"],
  ];

  const errors = [];
  for (const [repo, skillPath] of attempts) {
    const result = run(process.env.PYTHON || "python", [
      installer,
      "--repo",
      repo,
      "--path",
      skillPath,
      "--dest",
      path.join(codexHome, "skills"),
    ]);

    const installed = findDocsReview();
    if (result.status === 0 && installed) {
      return { ok: true, method: "skill_installer", skillPath: installed };
    }

    errors.push({
      path: skillPath,
      status: result.status,
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
    });
  }

  return { ok: false, method: "skill_installer", errors };
}

function main() {
  const autoInstall = process.argv.includes("--auto-install");
  const existing = findDocsReview();
  if (existing) {
    console.log(JSON.stringify({ status: "available", skillPath: existing }, null, 2));
    return;
  }

  if (!autoInstall) {
    console.log(JSON.stringify({ status: "missing", reason: "docs-review skill not found" }, null, 2));
    process.exitCode = 2;
    return;
  }

  const localInstall = installFromLocalSource();
  if (localInstall?.ok) {
    console.log(JSON.stringify({ status: "installed", ...localInstall }, null, 2));
    return;
  }

  const installer = findInstaller();
  if (!installer) {
    console.log(JSON.stringify({
      status: "blocked",
      reason: "docs-review skill missing and skill-installer script not found",
      localInstall,
    }, null, 2));
    process.exitCode = 3;
    return;
  }

  const remoteInstall = installFromOpenAISkills(installer);
  if (remoteInstall.ok) {
    console.log(JSON.stringify({ status: "installed", ...remoteInstall }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    status: "blocked",
    reason: "docs-review skill missing and automatic install attempts failed",
    localInstall,
    remoteInstall,
  }, null, 2));
  process.exitCode = 4;
}

main();
