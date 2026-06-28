#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
} = require("./pre_render_definition_drilldown_lib");

function usage() {
  return [
    "Usage: node prepare-current-source-promotion.js --source <path> --authoring-dir <path> [options]",
    "",
    "Prepares current-source promotion artifacts for refreshing a stale promotion receipt.",
    "The draft is byte-identical to the current source, so this script cannot authorize semantic source edits.",
    "Options:",
    "  --source <path>                   Current source document path.",
    "  --authoring-dir <path>            Requirement-record authoring artifact directory.",
    "  --draft-out <path>                Draft output path. Defaults to <authoring-dir>/current-source-authoring-draft.md.",
    "  --encoding-report-out <path>      Encoding report path. Defaults to <authoring-dir>/encoding-report.json.",
    "  --source-mutation-decision-out <path> Source mutation decision path. Defaults to <authoring-dir>/source-mutation-decision.json.",
    "  --draft-implementation-confirmation-out <path> Draft projection path. Defaults to <authoring-dir>/draft-implementation-confirmation.json.",
    "  --authoring-materialization-receipt-out <path> Materialization receipt path. Defaults to <authoring-dir>/authoring-materialization-receipt.json.",
    "  --record-id <id>                  Override implementationConfirmation.recordId.",
    "  --requirement-set-id <id>         Override implementationConfirmation.requirementSetId.",
    "  --reason <text>                   Decision basis reason.",
    "  --json                           Emit JSON result.",
    "  --help                           Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { json: false };
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
    if (
      [
        "--source",
        "--authoring-dir",
        "--draft-out",
        "--encoding-report-out",
        "--source-mutation-decision-out",
        "--draft-implementation-confirmation-out",
        "--authoring-materialization-receipt-out",
        "--record-id",
        "--requirement-set-id",
        "--reason",
      ].includes(arg)
    ) {
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

function toRootRelative(filePath) {
  const absolute = path.resolve(filePath);
  const relative = path.relative(process.cwd(), absolute);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.replace(/\\/gu, "/");
  }
  return normalizePathForReport(absolute);
}

function sha256Text(content) {
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex")}`;
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function ensureInsideAuthoringDir(authoringDir, filePath, label) {
  const dir = path.resolve(authoringDir);
  const target = path.resolve(filePath);
  const relative = path.relative(dir, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_authoring_dir`);
  }
}

function listTemporaryExecutableHelpers(authoringDir) {
  if (!fs.existsSync(authoringDir)) return [];
  return fs
    .readdirSync(authoringDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:cjs|js|mjs|ps1)$/iu.test(entry.name))
    .map((entry) => normalizePathForReport(path.join(authoringDir, entry.name)))
    .sort();
}

function scopedEncodingFindings(sourceRel, sourceBytes, sourceText) {
  const findings = [];
  if (sourceBytes.includes(0)) {
    findings.push({ file: sourceRel, hits: [{ line: 1, pattern: "NUL-byte" }] });
  }
  if (sourceBytes[0] === 0xef && sourceBytes[1] === 0xbb && sourceBytes[2] === 0xbf) {
    findings.push({ file: sourceRel, hits: [{ line: 1, pattern: "UTF-8-BOM" }] });
  }
  if (sourceText.includes("\uFFFD")) {
    findings.push({ file: sourceRel, hits: [{ line: 1, pattern: "replacement-char" }] });
  }
  return findings;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function prepareCurrentSourcePromotion(args) {
  if (!args.source) throw new Error("source_required");
  if (!args.authoringDir) throw new Error("authoring_dir_required");

  const sourcePath = path.resolve(args.source);
  const authoringDir = path.resolve(args.authoringDir);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error("source_file_missing");
  }

  const draftOut = path.resolve(args.draftOut || path.join(authoringDir, "current-source-authoring-draft.md"));
  const encodingReportOut = path.resolve(args.encodingReportOut || path.join(authoringDir, "encoding-report.json"));
  const sourceMutationDecisionOut = path.resolve(
    args.sourceMutationDecisionOut || path.join(authoringDir, "source-mutation-decision.json")
  );
  const draftImplementationConfirmationOut = path.resolve(
    args.draftImplementationConfirmationOut ||
      path.join(authoringDir, "draft-implementation-confirmation.json")
  );
  const authoringMaterializationReceiptOut = path.resolve(
    args.authoringMaterializationReceiptOut ||
      path.join(authoringDir, "authoring-materialization-receipt.json")
  );
  ensureInsideAuthoringDir(authoringDir, draftOut, "draft_out");
  ensureInsideAuthoringDir(authoringDir, encodingReportOut, "encoding_report_out");
  ensureInsideAuthoringDir(authoringDir, sourceMutationDecisionOut, "source_mutation_decision_out");
  ensureInsideAuthoringDir(
    authoringDir,
    draftImplementationConfirmationOut,
    "draft_implementation_confirmation_out"
  );
  ensureInsideAuthoringDir(
    authoringDir,
    authoringMaterializationReceiptOut,
    "authoring_materialization_receipt_out"
  );

  fs.mkdirSync(authoringDir, { recursive: true });
  const temporaryHelpers = listTemporaryExecutableHelpers(authoringDir);
  if (temporaryHelpers.length > 0) {
    return {
      ok: false,
      failureClass: "authoring_temporary_executable_helper_present",
      temporaryExecutableHelpers: {
        forbiddenExtensions: [".cjs", ".js", ".mjs", ".ps1"],
        files: temporaryHelpers,
      },
      nextRequiredActions: [
        {
          action: "archive_authoring_temporary_executable_helpers",
          reason:
            "Current-source promotion prep is skill-local; requirement-record authoring directories must not contain executable helper scripts.",
        },
      ],
    };
  }

  const sourceBytes = fs.readFileSync(sourcePath);
  const sourceText = sourceBytes.toString("utf8");
  const sourceRel = toRootRelative(sourcePath);
  const rawSourceHash = sha256Buffer(sourceBytes);
  let semanticSourceHash = rawSourceHash;
  let implementationConfirmationHash = null;
  let implementationConfirmation = null;
  let recordId = args.recordId || null;
  let requirementSetId = args.requirementSetId || null;
  try {
    const extracted = extractImplementationConfirmation(sourceText);
    semanticSourceHash = sourceDocumentHashFor(
      sourceText,
      extracted.blockText,
      extracted.confirmation
    );
    implementationConfirmationHash = implementationConfirmationHashFor(extracted.confirmation);
    implementationConfirmation = extracted.confirmation;
    recordId = recordId || (extracted.confirmation?.recordId ? String(extracted.confirmation.recordId) : null);
    requirementSetId =
      requirementSetId ||
      (extracted.confirmation?.requirementSetId
        ? String(extracted.confirmation.requirementSetId)
        : recordId);
  } catch (error) {
    return {
      ok: false,
      failureClass: "implementation_confirmation_parse_failed",
      error: error instanceof Error ? error.message : String(error),
      source: sourceRel,
    };
  }

  fs.writeFileSync(draftOut, sourceText, "utf8");
  const draftHash = sha256Text(fs.readFileSync(draftOut, "utf8"));
  const findings = scopedEncodingFindings(sourceRel, sourceBytes, sourceText);
  const createdAt = new Date().toISOString();
  const reason =
    args.reason ||
    "current source is already materialized; refresh promotion receipt and source mutation binding without semantic edits";

  const encodingReport = {
    checkedFiles: 1,
    findings,
    source: "skill-local-current-source-byte-scan",
    scope: [
      {
        path: sourceRel,
        bytes: sourceBytes.length,
        utf8Bom: sourceBytes[0] === 0xef && sourceBytes[1] === 0xbb && sourceBytes[2] === 0xbf,
        nulByte: sourceBytes.includes(0),
        replacementChar: sourceText.includes("\uFFFD"),
        sha256: rawSourceHash,
      },
    ],
    checkedAt: createdAt,
  };
  const decision = {
    schemaVersion: "requirements-authoring-source-mutation-decision/v1",
    sourcePath: sourceRel,
    sourceDocumentExistedBefore: true,
    sourceDocumentHashBefore: rawSourceHash,
    sourceDocumentHashAfter: rawSourceHash,
    targetRawHashBefore: rawSourceHash,
    targetRawHashAfter: rawSourceHash,
    semanticSourceHashBefore: semanticSourceHash,
    semanticSourceHashAfter: semanticSourceHash,
    recordId,
    requirementSetId,
    attemptId: sha256Text(JSON.stringify({ sourceRel, rawSourceHash, draftHash, reason })),
    createdAt,
    sourceMutationAllowed: true,
    sourceMutationPerformed: false,
    blockedIssueCodes: [],
    coverageDecision: "pass",
    targetAuthorityDecision: "pass",
    validationAuthorityDecision: "pass",
    projectionSanityDecision: "pass",
    auditEvidenceDecision: "pass",
    scaleRoutingDecision: "current_source_receipt_refresh",
    userConfirmationDecision: "draft_only_user_confirmation_not_allowed",
    reverseAuditDraftValidationDecision: "pass",
    finalDecision: "allow_source_materialization",
    decisionBasis: {
      reason,
      draftPath: toRootRelative(draftOut),
      rawSourceHash,
      semanticSourceHash,
      implementationConfirmationHash,
    },
  };

  writeJson(encodingReportOut, encodingReport);
  writeJson(sourceMutationDecisionOut, decision);
  const mustCount = Array.isArray(implementationConfirmation?.must)
    ? implementationConfirmation.must.length
    : 0;
  const draftProjection = {
    schemaVersion: "requirements-authoring-draft-implementation-confirmation/v1",
    sourcePath: sourceRel,
    sourceDocumentHash: rawSourceHash,
    rawSourceHash,
    semanticSourceHash,
    implementationConfirmationHash,
    recordId,
    requirementSetId,
    status: implementationConfirmation?.status || null,
    candidateCount: mustCount,
    acceptedCandidateCount: mustCount,
    mustCount,
    failClosed: false,
    implementationConfirmation,
    decision: "current_source_materialization_preserved",
    createdAt,
  };
  writeJson(draftImplementationConfirmationOut, draftProjection);
  const materializationReceipt = {
    schemaVersion: "requirements-authoring-materialization-receipt/v1",
    sourcePath: sourceRel,
    sourceDocumentHash: rawSourceHash,
    rawSourceHash,
    semanticSourceHash,
    implementationConfirmationHash,
    recordId,
    requirementSetId,
    candidateArtifactPath: null,
    draftImplementationConfirmationPath: toRootRelative(draftImplementationConfirmationOut),
    candidateCount: mustCount,
    acceptedCandidateCount: mustCount,
    mustCount,
    failClosed: false,
    decision: "current_source_materialization_preserved",
    requiresUserConfirmationBeforeExecution: true,
    sourceMutationDecisionPath: toRootRelative(sourceMutationDecisionOut),
    draftPath: toRootRelative(draftOut),
    createdAt,
  };
  writeJson(authoringMaterializationReceiptOut, {
    ...materializationReceipt,
    receiptHash: sha256Text(JSON.stringify(materializationReceipt)),
  });

  return {
    ok: findings.length === 0,
    source: sourceRel,
    authoringDir: normalizePathForReport(authoringDir),
    draft: toRootRelative(draftOut),
    encodingReport: toRootRelative(encodingReportOut),
    sourceMutationDecision: toRootRelative(sourceMutationDecisionOut),
    draftImplementationConfirmation: toRootRelative(draftImplementationConfirmationOut),
    authoringMaterializationReceipt: toRootRelative(authoringMaterializationReceiptOut),
    rawSourceHash,
    draftHash,
    semanticSourceHash,
    implementationConfirmationHash,
    recordId,
    requirementSetId,
    findings,
    temporaryExecutableHelpers: {
      forbiddenExtensions: [".cjs", ".js", ".mjs", ".ps1"],
      files: [],
    },
  };
}

function writeResult(result, json) {
  const payload = `${JSON.stringify(result, null, 2)}\n`;
  if (json || result.ok) process.stdout.write(payload);
  else process.stderr.write(payload);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    return 2;
  }
  if (args.help) {
    console.log(usage());
    return 0;
  }
  try {
    const result = prepareCurrentSourcePromotion(args);
    writeResult(result, args.json);
    return result.ok ? 0 : 1;
  } catch (error) {
    writeResult(
      {
        ok: false,
        failureClass: "current_source_promotion_prep_failed",
        error: error instanceof Error ? error.message : String(error),
      },
      args.json
    );
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  prepareCurrentSourcePromotion,
};
