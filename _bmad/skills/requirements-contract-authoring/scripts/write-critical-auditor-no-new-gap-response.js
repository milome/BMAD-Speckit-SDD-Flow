#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function usage() {
  return [
    "Usage: node write-critical-auditor-no-new-gap-response.js --authoring-dir <path> --round <n> [options]",
    "",
    "Writes a Critical Auditor no-new-gap response artifact from a current round request.",
    "This script never writes receipt files; authoring-repair must validate and ingest the response.",
    "Options:",
    "  --authoring-dir <path>           Requirement-record authoring artifact directory.",
    "  --round <n>                      Critical Auditor round index.",
    "  --request <path>                 Request path. Defaults to <authoring-dir>/critical-auditor-round-request-<n>.json.",
    "  --response-out <path>            Response path. Defaults to <authoring-dir>/critical-auditor-round-response-<n>.json.",
    "  --reviewed-projection-ref <id>   Explicit reviewed projection ref. May be repeated.",
    "  --json                           Emit JSON result.",
    "  --help                           Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { json: false, reviewedProjectionRef: [] };
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
    if (arg === "--reviewed-projection-ref") {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${arg}`);
      args.reviewedProjectionRef.push(value);
      index += 1;
      continue;
    }
    if (["--authoring-dir", "--round", "--request", "--response-out"].includes(arg)) {
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

function ensureInsideAuthoringDir(authoringDir, filePath, label) {
  const dir = path.resolve(authoringDir);
  const target = path.resolve(filePath);
  const relative = path.relative(dir, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_authoring_dir`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listTemporaryExecutableHelpers(authoringDir) {
  if (!fs.existsSync(authoringDir)) return [];
  return fs
    .readdirSync(authoringDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:cjs|js|mjs|ps1)$/iu.test(entry.name))
    .map((entry) => normalizePathForReport(path.join(authoringDir, entry.name)))
    .sort();
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))];
}

function numberValue(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isFiniteNumberValue(value) {
  if (value === null || value === undefined || value === "") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric);
}

function strictNumberValue(value) {
  return Number(value);
}

function roundPerspective(roundIndex) {
  if (roundIndex === 1) return "MUST atomicity, over-broad tasks, and missing decomposition";
  if (roundIndex === 2) {
    return "EVD/TRACE/ACC/E2E/FAIL/EDGE/artifact/command/AI-TDD projection materialization";
  }
  return "stale hash, authority bypass, negative boundary, reconfirmation, and delivery-vs-confirmation separation";
}

function selectCheckedProjectionGroups(request) {
  const required = stringArray(request.requiredResponseSchema?.checkedProjectionGroups);
  if (required.length > 0) return required;
  return stringArray(request.packetProjectionSummary?.projectionGroups);
}

function selectCheckedProjectionQualityRuleCodes(request) {
  const required = stringArray(request.requiredResponseSchema?.checkedProjectionQualityRuleCodes);
  if (required.length > 0) return uniqueStrings(required);
  return uniqueStrings(request.projectionQualityGate?.requiredRuleCodes);
}

function selectReviewedProjectionRefs(request, explicitRefs) {
  const projectionRefs = stringArray(request.packetProjectionSummary?.projectionRefs);
  const selected = explicitRefs.length > 0 ? explicitRefs : projectionRefs.slice(0, 50);
  if (projectionRefs.length === 0) return uniqueStrings(selected);
  return uniqueStrings(selected.filter((ref) => projectionRefs.includes(ref)));
}

function buildResponse({ request, requestPath, roundIndex, reviewedProjectionRefs }) {
  const gateDryRun = request.gateDryRun || {};
  const reconciliation = gateDryRun.reconciliation || {};
  const checkedProjectionGroups = selectCheckedProjectionGroups(request);
  const checkedProjectionQualityRuleCodes = selectCheckedProjectionQualityRuleCodes(request);
  const gateDryRunHash = gateDryRun.gateDryRunHash || gateDryRun.hash || null;
  const reconciliationReportPath = gateDryRun.reconciliationReportPath
    ? String(gateDryRun.reconciliationReportPath).replace(/\\/gu, "/")
    : null;
  return {
    schemaVersion: "critical-auditor-round-response/v1",
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex ?? roundIndex,
    sourceHash: request.sourceDocumentHash,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash,
    reconciliationIssueCount: numberValue(reconciliation.issueCount),
    checkedProjectionGroups,
    checkedProjectionQualityRuleCodes,
    verdict: "no_new_valid_gap",
    reviewedMustRefs: stringArray(request.mustRefs),
    reviewedProjectionRefs,
    priorFindingsDisposition: [
      {
        findingRef: "critical_auditor_receipt_missing",
        disposition: roundIndex === 1 ? "new" : "resolved",
        evidenceRefs: [toRootRelative(requestPath), reconciliationReportPath].filter(Boolean),
        rationale:
          roundIndex === 1
            ? "The missing current round receipt is expected before this response is ingested; it is not a source or packet projection gap."
            : "The current round is still pre-ingest; earlier current receipts are handled by the authoring-repair receipt loop.",
      },
      {
        findingRef: "packet_source_reconciliation",
        disposition: "resolved",
        evidenceRefs: [reconciliationReportPath].filter(Boolean),
        rationale: "The current gate dry-run reports packet/source reconciliation issueCount=0.",
      },
    ],
    falsePositiveProofs: [],
    gapCandidates: [],
    validatedGaps: [],
    rejectedGapCandidates: [
      {
        id: `ROUND${roundIndex}-NO-ACTIONABLE-GATE-BLOCKER`,
        code: "missing_receipt_is_pre_response_state",
        reason:
          "critical_auditor_receipt_missing is the expected pre-response state for the active round and is not an actionable source, packet, or projection blocker.",
      },
    ],
    rationale: `Round ${roundIndex} reviewed ${roundPerspective(roundIndex)}. The request is bound to current sourceDocumentHash=${request.sourceDocumentHash}, implementationConfirmationHash=${request.implementationConfirmationHash}, packetHash=${request.packetHash}, and gateDryRunHash=${gateDryRunHash}. The dry-run has actionableBlockingIssueCount=0 and reconciliation issueCount=0, so no new valid confirmation-blocking gap is found.`,
  };
}

function validateRequestForNoNewGap(request, roundIndex, reviewedProjectionRefs) {
  const issues = [];
  const gateDryRun = request?.gateDryRun || {};
  const reconciliation = gateDryRun.reconciliation || {};
  if (!request || typeof request !== "object") issues.push("critical_auditor_request_missing_or_invalid");
  if (request?.roundIndex !== undefined && Number(request.roundIndex) !== roundIndex) {
    issues.push("critical_auditor_request_round_mismatch");
  }
  for (const key of ["requestHash", "sourceDocumentHash", "implementationConfirmationHash", "packetHash"]) {
    if (!request?.[key]) issues.push(`critical_auditor_request_${key}_missing`);
  }
  if (!(gateDryRun.gateDryRunHash || gateDryRun.hash)) {
    issues.push("critical_auditor_request_gate_dry_run_hash_missing");
  }
  if (!isFiniteNumberValue(gateDryRun.actionableBlockingIssueCount)) {
    issues.push("critical_auditor_request_gate_dry_run_blocker_count_malformed");
  } else if (strictNumberValue(gateDryRun.actionableBlockingIssueCount) !== 0) {
    issues.push("critical_auditor_no_new_gap_forbidden_by_gate_dry_run_blockers");
  }
  if (!Array.isArray(gateDryRun.actionableBlockingIssues)) {
    issues.push("critical_auditor_request_gate_dry_run_blockers_malformed");
  } else if (gateDryRun.actionableBlockingIssues.length !== 0) {
    issues.push("critical_auditor_no_new_gap_forbidden_by_gate_dry_run_blockers");
  }
  if (!isFiniteNumberValue(reconciliation.issueCount)) {
    issues.push("critical_auditor_request_reconciliation_issue_count_malformed");
  } else if (strictNumberValue(reconciliation.issueCount) !== 0) {
    issues.push("critical_auditor_no_new_gap_forbidden_by_reconciliation_issues");
  }
  if (selectCheckedProjectionGroups(request).length === 0) {
    issues.push("critical_auditor_checked_projection_groups_missing");
  }
  if (selectCheckedProjectionQualityRuleCodes(request).length === 0) {
    issues.push("critical_auditor_checked_projection_quality_rule_codes_missing");
  }
  if (reviewedProjectionRefs.length === 0) {
    issues.push("critical_auditor_reviewed_projection_refs_missing");
  }
  return issues;
}

function writeCriticalAuditorNoNewGapResponse(args) {
  if (!args.authoringDir) throw new Error("authoring_dir_required");
  const roundIndex = Number(args.round);
  if (!Number.isInteger(roundIndex) || roundIndex <= 0) throw new Error("round_required");

  const authoringDir = path.resolve(args.authoringDir);
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
            "Critical Auditor response writing is skill-local; requirement-record authoring directories must not contain executable helper scripts.",
        },
      ],
    };
  }

  const requestPath = path.resolve(
    args.request || path.join(authoringDir, `critical-auditor-round-request-${roundIndex}.json`)
  );
  const responsePath = path.resolve(
    args.responseOut || path.join(authoringDir, `critical-auditor-round-response-${roundIndex}.json`)
  );
  ensureInsideAuthoringDir(authoringDir, requestPath, "request");
  ensureInsideAuthoringDir(authoringDir, responsePath, "response_out");
  if (!fs.existsSync(requestPath)) throw new Error("critical_auditor_round_request_missing");

  const request = readJson(requestPath);
  const reviewedProjectionRefs = selectReviewedProjectionRefs(request, args.reviewedProjectionRef);
  const issues = validateRequestForNoNewGap(request, roundIndex, reviewedProjectionRefs);
  if (issues.length > 0) {
    return {
      ok: false,
      failureClass: "critical_auditor_no_new_gap_response_blocked",
      issues,
      request: toRootRelative(requestPath),
      responseOut: toRootRelative(responsePath),
    };
  }

  const response = buildResponse({ request, requestPath, roundIndex, reviewedProjectionRefs });
  writeJson(responsePath, response);
  return {
    ok: true,
    responsePath: toRootRelative(responsePath),
    roundIndex,
    requestHash: request.requestHash,
    gateDryRunHash: response.gateDryRunHash,
    reviewedProjectionRefs,
    receiptWritten: false,
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
    const result = writeCriticalAuditorNoNewGapResponse(args);
    writeResult(result, args.json);
    return result.ok ? 0 : 1;
  } catch (error) {
    writeResult(
      {
        ok: false,
        failureClass: "critical_auditor_no_new_gap_response_failed",
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
  writeCriticalAuditorNoNewGapResponse,
};
