#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildManifest } = require("./generate-draft-manifest");
const { normalizeMarkdown } = require("./normalize-draft-markdown");

const CONFIRMATION_READY_STATUSES = new Set(["user_confirmed"]);

function usage() {
  return [
    "Usage: node promote-draft-large-doc.js --draft <path> --target <path> [options]",
    "",
    "Normalizes, preflights, audits, and atomically promotes a large requirements source draft.",
    "Options:",
    "  --draft <path>          Draft markdown file to promote.",
    "  --target <path>         Target markdown path to replace.",
    "  --require <text>        Required literal text. May be repeated.",
    "  --min-bytes <n>         Minimum UTF-8 byte count.",
    "  --retry-receipt <path>  Retry receipt JSON path.",
    "  --preflight-only        Stop after normalization and manifest preflight.",
    "  --dry-run               Run all checks without replacing the target.",
    "  --json                  Emit JSON receipt.",
    "  --help                  Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    require: [],
    json: false,
    dryRun: false,
    preflightOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--preflight-only") {
      args.preflightOnly = true;
      continue;
    }
    if (arg === "--require") {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${arg}`);
      args.require.push(value);
      index += 1;
      continue;
    }
    if (["--draft", "--target", "--min-bytes", "--retry-receipt"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${arg}`);
      args[arg.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function normalizePathForReport(filePath) {
  return filePath ? path.resolve(filePath).replace(/\\/gu, "/") : null;
}

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex")}`;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

function writeReceipt(result, json) {
  const payload = JSON.stringify(result, null, 2);
  if (json || result.ok) {
    console.log(payload);
  } else {
    console.error(payload);
  }
}

function baseReceipt(args) {
  return {
    ok: false,
    dryRun: Boolean(args.dryRun),
    preflightOnly: Boolean(args.preflightOnly),
    draftPath: normalizePathForReport(args.draft),
    targetPath: normalizePathForReport(args.target),
    manifestPath: null,
    targetHash: null,
    backupPath: null,
    audit: null,
    preflight: null,
    failureClass: null,
    warnings: [],
    residualRisks: [],
  };
}

function classifyManifestError(errors) {
  if ((errors ?? []).some((error) => String(error).includes("parse_failed"))) {
    return "draft_syntax_error";
  }
  return "draft_syntax_error";
}

function readRetryReceipt(receiptPath) {
  if (!receiptPath || !fs.existsSync(receiptPath)) return null;
  return JSON.parse(fs.readFileSync(receiptPath, "utf8"));
}

function updateRetryReceipt(receiptPath, context) {
  if (!receiptPath || !context.failureClass) return null;
  const absolute = path.resolve(receiptPath);
  const previous = readRetryReceipt(absolute);
  const sameFailure =
    previous?.draftHash === context.draftHash &&
    previous?.lastFailureClass === context.failureClass;
  const consecutiveFailureCount = sameFailure ? Number(previous.consecutiveFailureCount ?? 0) + 1 : 1;
  const entry = {
    attemptId: context.attemptId,
    draftHash: context.draftHash,
    failureClass: context.failureClass,
    exitCode: context.exitCode,
    createdAt: new Date().toISOString(),
  };
  const receipt = {
    receiptVersion: "requirements-contract-large-doc-retry/v1",
    attemptId: context.attemptId,
    draftPath: normalizePathForReport(context.draftPath),
    targetPath: normalizePathForReport(context.targetPath),
    draftHash: context.draftHash,
    lastFailureClass: context.failureClass,
    consecutiveFailureCount,
    lastFailureAt: entry.createdAt,
    history: [...(Array.isArray(previous?.history) ? previous.history : []), entry],
  };
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function normalizeDraftInPlace(draftPath) {
  const raw = fs.readFileSync(draftPath, "utf8");
  const normalized = normalizeMarkdown(raw);
  if (normalized.content !== raw) {
    fs.writeFileSync(draftPath, normalized.content, "utf8");
  }
  return {
    changed: normalized.content !== raw,
    normalizations: normalized.normalizations,
    mermaidFenceRepairs: normalized.mermaidFenceRepairs,
    yamlScalarQuotes: normalized.yamlScalarQuotes,
    content: normalized.content,
  };
}

function detectShellTransportError(content) {
  const markers = [
    "ParserError:",
    "Missing file specification after redirection operator",
    "Missing ']' after array index expression",
    "Expressions are only allowed as the first element of a pipeline",
    "The term '",
    "is not recognized as a name of a cmdlet",
  ];
  return markers.filter((marker) => content.includes(marker));
}

function runReverseAudit(draftPath) {
  const reverseAuditPath = path.join(__dirname, "reverse_audit_contract.js");
  const result = spawnSync(process.execPath, [reverseAuditPath, draftPath, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  let report = null;
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  try {
    report = output ? JSON.parse(output) : null;
  } catch (error) {
    report = {
      parseError: error instanceof Error ? error.message : String(error),
      outputPreview: output.slice(0, 2000),
    };
  }
  return {
    status: result.status,
    ok: result.status === 0 && report?.verdict === "PASS",
    report,
  };
}

function copyFileAtomic(sourcePath, targetPath) {
  const content = fs.readFileSync(sourcePath, "utf8");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, content, "utf8");
  fs.renameSync(tempPath, targetPath);
  return sha256(content);
}

function backupTarget(targetPath) {
  if (!fs.existsSync(targetPath)) return null;
  const backupPath = `${targetPath}.bak.${timestamp()}`;
  fs.copyFileSync(targetPath, backupPath);
  return backupPath;
}

function fail(receipt, failureClass, details, args, manifest, exitCode = 1) {
  receipt.failureClass = failureClass;
  if (details) receipt.details = details;
  const retry = updateRetryReceipt(args.retryReceipt, {
    attemptId: manifest?.attemptId ?? `promote-${Date.now()}`,
    draftPath: args.draft,
    targetPath: args.target,
    draftHash: manifest?.draftHash ?? null,
    failureClass,
    exitCode,
  });
  if (retry?.consecutiveFailureCount >= 2) {
    receipt.failureClass = `retry_limit_exceeded:${failureClass}`;
    receipt.retry = retry;
    return { receipt, exitCode: 1 };
  }
  if (retry) receipt.retry = retry;
  return { receipt, exitCode };
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
  if (!args.draft || !args.target) {
    console.error("missing --draft or --target");
    console.error(usage());
    return 2;
  }

  const draftPath = path.resolve(args.draft);
  const targetPath = path.resolve(args.target);
  const receipt = baseReceipt({ ...args, draft: draftPath, target: targetPath });

  try {
    if (draftPath === targetPath) {
      const failed = fail(
        receipt,
        "draft_syntax_error",
        { errors: ["draft_target_same_path"] },
        { ...args, draft: draftPath, target: targetPath },
        null
      );
      writeReceipt(failed.receipt, args.json);
      return failed.exitCode;
    }

    const normalization = normalizeDraftInPlace(draftPath);
    receipt.preflight = {
      normalization: {
        changed: normalization.changed,
        normalizations: normalization.normalizations,
        mermaidFenceRepairs: normalization.mermaidFenceRepairs,
        yamlScalarQuotes: normalization.yamlScalarQuotes,
      },
    };

    const shellTransportMarkers = detectShellTransportError(normalization.content);
    if (shellTransportMarkers.length > 0) {
      const failed = fail(
        receipt,
        "shell_transport_error",
        { markers: shellTransportMarkers },
        { ...args, draft: draftPath, target: targetPath },
        {
          attemptId: `promote-${Date.now()}`,
          draftHash: sha256(normalization.content),
        }
      );
      writeReceipt(failed.receipt, args.json);
      return failed.exitCode;
    }

    const manifestPath = `${draftPath}.manifest.json`;
    const manifest = buildManifest({
      draft: draftPath,
      target: targetPath,
      require: args.require,
      minBytes: args.minBytes,
      attemptId: `promote-${Date.now()}`,
      out: manifestPath,
    });
    receipt.manifestPath = normalizePathForReport(manifestPath);
    receipt.preflight.manifest = manifest;

    if (!manifest.ok) {
      const failed = fail(
        receipt,
        classifyManifestError(manifest.errors),
        { errors: manifest.errors },
        { ...args, draft: draftPath, target: targetPath },
        manifest
      );
      writeReceipt(failed.receipt, args.json);
      return failed.exitCode;
    }

    if (args.preflightOnly) {
      receipt.ok = true;
      receipt.failureClass = null;
      receipt.residualRisks.push("reverse_audit_not_run_preflight_only");
      writeReceipt(receipt, args.json);
      return 0;
    }

    if (!CONFIRMATION_READY_STATUSES.has(String(manifest.statusValue))) {
      const failed = fail(
        receipt,
        "semantic_decision_required:expected_draft_gap_policy",
        { statusValue: manifest.statusValue },
        { ...args, draft: draftPath, target: targetPath },
        manifest
      );
      writeReceipt(failed.receipt, args.json);
      return failed.exitCode;
    }

    const audit = runReverseAudit(draftPath);
    receipt.audit = audit;
    if (!audit.ok) {
      const failed = fail(
        receipt,
        "semantic_audit_gap",
        { status: audit.status, failedChecks: audit.report?.failedChecks ?? [] },
        { ...args, draft: draftPath, target: targetPath },
        manifest
      );
      writeReceipt(failed.receipt, args.json);
      return failed.exitCode;
    }

    if (args.dryRun) {
      receipt.ok = true;
      receipt.targetHash = fs.existsSync(targetPath)
        ? sha256(fs.readFileSync(targetPath, "utf8"))
        : null;
      receipt.residualRisks.push("target_not_written_dry_run");
      writeReceipt(receipt, args.json);
      return 0;
    }

    const backupPath = backupTarget(targetPath);
    receipt.backupPath = normalizePathForReport(backupPath);
    receipt.targetHash = copyFileAtomic(draftPath, targetPath);
    receipt.ok = true;
    receipt.failureClass = null;
    writeReceipt(receipt, args.json);
    return 0;
  } catch (error) {
    const failed = fail(
      receipt,
      "draft_syntax_error",
      { error: error instanceof Error ? error.message : String(error) },
      { ...args, draft: draftPath, target: targetPath },
      null
    );
    writeReceipt(failed.receipt, args.json);
    return failed.exitCode;
  }
}

if (require.main === module) {
  process.exit(main());
}
