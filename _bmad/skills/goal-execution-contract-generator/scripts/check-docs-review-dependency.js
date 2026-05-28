#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SHARED_REF_PATTERN = /@\.\/\.\.\/_shared\/([^\s)]+)/g;

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

function unique(items) {
  return [...new Set(items)];
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

function sharedRootForSkillPath(skillPath) {
  return path.resolve(path.dirname(skillPath), "..", "_shared");
}

function normalizeSharedRef(ref) {
  const normalized = ref.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    return null;
  }
  return normalized;
}

function readSharedReferences(skillPath) {
  const content = fs.readFileSync(skillPath, "utf8");
  const refs = [];
  let match;
  SHARED_REF_PATTERN.lastIndex = 0;
  while ((match = SHARED_REF_PATTERN.exec(content)) !== null) {
    const normalized = normalizeSharedRef(match[1]);
    if (normalized) {
      refs.push(normalized);
    }
  }
  return unique(refs).sort();
}

function validateSharedReferences(skillPath) {
  const refs = readSharedReferences(skillPath);
  const sharedRoot = sharedRootForSkillPath(skillPath);
  const missing = refs.filter((ref) => !fileExists(path.join(sharedRoot, ref)));
  return {
    ok: missing.length === 0,
    sharedRoot,
    refs,
    missing,
  };
}

function candidateSharedRoots(skillPath) {
  const cwd = process.cwd();
  const home = os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
  const installedSkillsRoot = path.dirname(path.dirname(skillPath));
  const currentSkillRoot = path.dirname(__dirname);
  const currentSkillsRoot = path.dirname(currentSkillRoot);
  return unique([
    process.env.DOCS_REVIEW_SHARED_SOURCE,
    path.join(installedSkillsRoot, "_shared"),
    path.join(currentSkillsRoot, "_shared"),
    path.join(cwd, ".codex", "skills", "_shared"),
    path.join(cwd, ".cursor", "skills", "_shared"),
    path.join(cwd, ".claude", "skills", "_shared"),
    path.join(cwd, "_bmad", "skills", "_shared"),
    path.join(codexHome, "skills", "_shared"),
    path.join(home, ".codex", "skills", "_shared"),
    path.join(home, ".agents", "skills", "_shared"),
    path.join(home, ".cursor", "skills", "_shared"),
    path.join(home, ".claude", "skills", "_shared"),
  ].filter(Boolean).map((candidate) => path.resolve(candidate)));
}

function findSharedRootWithRefs(skillPath, refs) {
  for (const candidate of candidateSharedRoots(skillPath)) {
    if (!dirExists(candidate)) {
      continue;
    }
    if (refs.every((ref) => fileExists(path.join(candidate, ref)))) {
      return candidate;
    }
  }
  return null;
}

function repairSharedReferences(skillPath, audit) {
  if (audit.ok || audit.refs.length === 0) {
    return { repaired: false, reason: "no repair needed" };
  }

  const sourceSharedRoot = findSharedRootWithRefs(skillPath, audit.refs);
  if (!sourceSharedRoot) {
    return {
      repaired: false,
      reason: "no candidate _shared directory contains all referenced files",
      missing: audit.missing,
    };
  }

  copyDir(sourceSharedRoot, audit.sharedRoot);
  const nextAudit = validateSharedReferences(skillPath);
  return {
    repaired: nextAudit.ok,
    sourceSharedRoot,
    audit: nextAudit,
  };
}

function syncSharedForSource(sourceSkillDir, destSkillDir) {
  const sourceSkill = path.join(sourceSkillDir, "SKILL.md");
  if (!fileExists(sourceSkill)) {
    return null;
  }
  const refs = readSharedReferences(sourceSkill);
  if (refs.length === 0) {
    return null;
  }

  const sourceSharedRoot = path.resolve(sourceSkillDir, "..", "_shared");
  const destSharedRoot = path.resolve(destSkillDir, "..", "_shared");
  if (!dirExists(sourceSharedRoot)) {
    return {
      ok: false,
      reason: "source skill references ../_shared but source _shared directory is missing",
      sourceSharedRoot,
      refs,
    };
  }

  copyDir(sourceSharedRoot, destSharedRoot);
  return {
    ok: true,
    sourceSharedRoot,
    destSharedRoot,
    refs,
  };
}

function emitValidatedSkill(status, skillPath, autoInstall, extra = {}) {
  const audit = validateSharedReferences(skillPath);
  if (audit.ok) {
    console.log(JSON.stringify({ status, skillPath, ...extra, sharedReferences: audit }, null, 2));
    return true;
  }

  const repair = autoInstall ? repairSharedReferences(skillPath, audit) : null;
  if (repair?.repaired && repair.audit?.ok) {
    console.log(JSON.stringify({
      status: `${status}_repaired`,
      skillPath,
      ...extra,
      sharedReferences: repair.audit,
      repair,
    }, null, 2));
    return true;
  }

  console.log(JSON.stringify({
    status: "broken_shared_dependency",
    reason: "skill references ../_shared files that are missing",
    skillPath,
    ...extra,
    sharedReferences: repair?.audit || audit,
    repair,
  }, null, 2));
  process.exitCode = 5;
  return false;
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
  const sharedSync = syncSharedForSource(source, dest);
  return { ok: true, method: "local_source", skillPath: path.join(dest, "SKILL.md"), sharedSync };
}

function installFromOpenAISkills(installer) {
  const home = os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
  const attempts = [
    ["metabase/metabase", ".claude/skills/docs-review", "master"],
    ["openai/skills", "skills/.curated/docs-review"],
    ["openai/skills", "skills/.experimental/docs-review"],
  ];

  const errors = [];
  for (const [repo, skillPath, ref] of attempts) {
    const args = [
      installer,
      "--repo",
      repo,
      "--path",
      skillPath,
      "--dest",
      path.join(codexHome, "skills"),
    ];
    if (ref) {
      args.push("--ref", ref);
    }
    const result = run(process.env.PYTHON || "python", [
      ...args,
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
    emitValidatedSkill("available", existing, autoInstall);
    return;
  }

  if (!autoInstall) {
    console.log(JSON.stringify({ status: "missing", reason: "docs-review skill not found" }, null, 2));
    process.exitCode = 2;
    return;
  }

  const localInstall = installFromLocalSource();
  if (localInstall?.ok) {
    emitValidatedSkill("installed", localInstall.skillPath, autoInstall, localInstall);
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
    emitValidatedSkill("installed", remoteInstall.skillPath, autoInstall, remoteInstall);
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
