#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..", "..", "..", "..");
const sourceDir = path.join(projectRoot, "_bmad", "skills", "requirements-contract-authoring");
const homeDir = os.homedir();

function usage() {
  return [
    "Usage: node verify-requirements-contract-authoring-skill-sync.js [options]",
    "",
    "Verifies the requirements-contract-authoring skill source and installed surfaces are synchronized.",
    "Options:",
    "  --repo-only  Verify only repository-local host and package surfaces.",
    "  --sync       Copy source skill to repository-local surfaces. Requires --repo-only.",
    "  --help       Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    repoOnly: false,
    sync: false,
  };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--repo-only") {
      args.repoOnly = true;
      continue;
    }
    if (arg === "--sync") {
      args.sync = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  if (args.sync && !args.repoOnly) {
    throw new Error("--sync is only supported with --repo-only");
  }
  return args;
}

function repoSurfaces() {
  return [
    {
      path: path.join(projectRoot, ".codex", "skills", "requirements-contract-authoring"),
      required: true,
      repoLocal: true,
    },
    {
      path: path.join(projectRoot, ".claude", "skills", "requirements-contract-authoring"),
      required: true,
      repoLocal: true,
    },
    {
      path: path.join(projectRoot, ".cursor", "skills", "requirements-contract-authoring"),
      required: true,
      repoLocal: true,
    },
    {
      path: path.join(
        projectRoot,
        "packages",
        "bmad-speckit",
        "_bmad",
        "skills",
        "requirements-contract-authoring"
      ),
      required: true,
      repoLocal: true,
    },
  ];
}

function globalSurfaces() {
  return [
    {
      path: path.join(homeDir, ".codex", "skills", "requirements-contract-authoring"),
      required: false,
      repoLocal: false,
    },
    {
      path: path.join(homeDir, ".claude", "skills", "requirements-contract-authoring"),
      required: false,
      repoLocal: false,
    },
    {
      path: path.join(homeDir, ".cursor", "skills", "requirements-contract-authoring"),
      required: false,
      repoLocal: false,
    },
  ];
}

function surfacesFor(args) {
  return args.repoOnly ? repoSurfaces() : [...repoSurfaces(), ...globalSurfaces()];
}

function normalizePathForReport(value) {
  return value.replace(/\\/gu, "/");
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
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function fileHash(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function directoryHash(root, files) {
  const hash = crypto.createHash("sha256");
  for (const relative of files) {
    hash.update(relative);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(root, relative)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function runHelp(skillDir) {
  const script = path.join(skillDir, "scripts", "assess_contract_authoring_scale.js");
  const result = spawnSync(process.execPath, [script, "--help"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    hasPhase: `${result.stdout || ""}\n${result.stderr || ""}`.includes("--phase"),
  };
}

function assertSafeRepoSurface(targetDir) {
  const resolved = path.resolve(targetDir);
  const allowed = repoSurfaces().map((surface) => path.resolve(surface.path));
  if (!allowed.includes(resolved)) {
    throw new Error(`refusing to sync non-repo skill surface: ${normalizePathForReport(resolved)}`);
  }
}

function copyDirectoryExact(source, target) {
  assertSafeRepoSurface(target);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function syncRepoSurfaces() {
  const synced = [];
  for (const surface of repoSurfaces()) {
    copyDirectoryExact(sourceDir, surface.path);
    synced.push(normalizePathForReport(path.resolve(surface.path)));
  }
  return synced;
}

function inspectSkillDir(surface, sourceFiles) {
  const skillDir = surface.path;
  const normalizedPath = normalizePathForReport(skillDir);
  if (!fs.existsSync(skillDir)) {
    return {
      ok: !surface.required,
      path: normalizedPath,
      required: surface.required,
      repoLocal: surface.repoLocal,
      missing: true,
      skipped: !surface.required,
      issues: surface.required ? ["surface_missing"] : [],
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
  const runCheckpointsPath = path.join(skillDir, "scripts", "run_semantic_checkpoints.js");
  const assessPath = path.join(skillDir, "scripts", "assess_contract_authoring_scale.js");
  const promotePath = path.join(skillDir, "scripts", "promote-draft-large-doc.js");
  const issues = [];
  if (missingFiles.length) issues.push("missing_files");
  if (extraFiles.length) issues.push("extra_files");
  if (mismatchedFiles.length) issues.push("mismatched_files");
  if (!help.hasPhase || help.status !== 0) issues.push("assess_help_phase_missing");
  if (!fs.existsSync(promotePath)) issues.push("large_doc_promote_missing");

  return {
    ok: issues.length === 0,
    path: normalizedPath,
    required: surface.required,
    repoLocal: surface.repoLocal,
    missing: false,
    skipped: false,
    fileCount: files.length,
    directoryHash: directoryHash(skillDir, files),
    runSemanticCheckpointsHash: fs.existsSync(runCheckpointsPath)
      ? fileHash(runCheckpointsPath)
      : null,
    assessContractAuthoringScaleHash: fs.existsSync(assessPath) ? fileHash(assessPath) : null,
    promoteDraftLargeDocHash: fs.existsSync(promotePath) ? fileHash(promotePath) : null,
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

function verify(args) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(
      `requirements-contract-authoring source dir missing: ${normalizePathForReport(sourceDir)}`
    );
  }
  const synced = args.sync ? syncRepoSurfaces() : [];
  const sourceFiles = listFiles(sourceDir);
  const promotePath = path.join(sourceDir, "scripts", "promote-draft-large-doc.js");
  const source = {
    path: normalizePathForReport(sourceDir),
    fileCount: sourceFiles.length,
    directoryHash: directoryHash(sourceDir, sourceFiles),
    runSemanticCheckpointsHash: fileHash(path.join(sourceDir, "scripts", "run_semantic_checkpoints.js")),
    assessContractAuthoringScaleHash: fileHash(
      path.join(sourceDir, "scripts", "assess_contract_authoring_scale.js")
    ),
    promoteDraftLargeDocHash: fs.existsSync(promotePath) ? fileHash(promotePath) : null,
  };
  const surfaceResults = surfacesFor(args).map((surface) =>
    inspectSkillDir({ ...surface, path: path.resolve(surface.path) }, sourceFiles)
  );
  const ok = surfaceResults.every((surface) => {
    if (!surface.required && surface.skipped) return true;
    return (
      surface.ok &&
      surface.fileCount === source.fileCount &&
      surface.directoryHash === source.directoryHash &&
      surface.runSemanticCheckpointsHash === source.runSemanticCheckpointsHash &&
      surface.assessContractAuthoringScaleHash === source.assessContractAuthoringScaleHash &&
      surface.promoteDraftLargeDocHash === source.promoteDraftLargeDocHash
    );
  });
  return {
    ok,
    repoOnly: args.repoOnly,
    sync: args.sync,
    synced,
    source,
    surfaces: surfaceResults,
  };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 2;
  }
  if (args.help) {
    console.log(usage());
    return 0;
  }
  try {
    const report = verify(args);
    const output = JSON.stringify(report, null, 2);
    if (report.ok) {
      console.log(output);
      return 0;
    }
    console.error(output);
    return 1;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  verify,
};
