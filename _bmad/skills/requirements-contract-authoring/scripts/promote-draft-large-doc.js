#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildManifest } = require("./generate-draft-manifest");
const { normalizeMarkdown } = require("./normalize-draft-markdown");
const { requireLargeDocumentWriter } = require("./resolve-bmad-runtime");
const {
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
} = require("./pre_render_definition_drilldown_lib");

const { safeWriteText } = requireLargeDocumentWriter();

const PROMOTION_STAGE_POLICIES = {
  "confirmation-ready": {
    allowedStatuses: new Set(["user_confirmed"]),
    confirmationReadyOnSuccess: true,
    safePromotionAsDraft: false,
  },
  "authoring-draft": {
    allowedStatuses: new Set(["draft", "draft_updated_not_confirmation_ready", "reconfirm_required"]),
    confirmationReadyOnSuccess: false,
    safePromotionAsDraft: true,
  },
  "current-source-receipt-refresh": {
    allowedStatuses: new Set(["draft", "draft_updated_not_confirmation_ready", "reconfirm_required", "user_confirmed"]),
    confirmationReadyOnSuccess: false,
    safePromotionAsDraft: false,
  },
  "projection-metadata-resync": {
    allowedStatuses: new Set(["draft", "draft_updated_not_confirmation_ready", "reconfirm_required", "user_confirmed"]),
    confirmationReadyOnSuccess: false,
    safePromotionAsDraft: false,
  },
};

function promotionPolicyFor(stage) {
  return PROMOTION_STAGE_POLICIES[stage] ?? null;
}

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
    "  --promotion-stage <stage> Promotion stage: confirmation-ready (default), authoring-draft, current-source-receipt-refresh, or projection-metadata-resync.",
    "  --scale-assessment <path> Required authoring scale assessment JSON for guarded source writes.",
    "  --scale-routing-decision <path> Required scale routing decision JSON for guarded source writes.",
    "  --source-mutation-decision <path> Required source mutation decision JSON for guarded source writes.",
    "  --checkpoint-persistence-evidence <path> Required when routing requires checkpoints.",
    "  --encoding-report <path> Required encoding gate JSON with zero findings for guarded source writes.",
    "  --receipt-out <path>     Persist the final promotion receipt JSON.",
    "  --auto-repair            Generate deterministic missing gate artifacts before deciding.",
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
    promotionStage: "confirmation-ready",
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
    if (arg === "--auto-repair") {
      args.autoRepair = true;
      continue;
    }
    if (arg === "--require") {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${arg}`);
      args.require.push(value);
      index += 1;
      continue;
    }
    if (
      [
        "--draft",
        "--target",
        "--min-bytes",
        "--retry-receipt",
        "--promotion-stage",
        "--scale-assessment",
        "--scale-routing-decision",
        "--source-mutation-decision",
        "--checkpoint-persistence-evidence",
        "--encoding-report",
        "--receipt-out",
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

function normalizeTargetPathForReceipt(filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(filePath);
  const relative = path.relative(process.cwd(), absolute);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.replace(/\\/gu, "/");
  }
  return normalizePathForReport(absolute);
}

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex")}`;
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function currentTargetState(targetPath) {
  const absolute = path.resolve(targetPath);
  if (!fs.existsSync(absolute)) {
    return {
      exists: false,
      hash: "absent",
      path: normalizePathForReport(absolute),
    };
  }
  return {
    exists: true,
    hash: sha256(fs.readFileSync(absolute, "utf8")),
    path: normalizePathForReport(absolute),
  };
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function sha256Json(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value), "utf8").digest("hex")}`;
}

function semanticBindingForFile(filePath) {
  try {
    const text = fs.readFileSync(path.resolve(filePath), "utf8");
    const extracted = extractImplementationConfirmation(text);
    return {
      sourceDocumentHash: sourceDocumentHashFor(text, extracted.blockText, extracted.confirmation),
      implementationConfirmationHash: implementationConfirmationHashFor(extracted.confirmation),
      error: null,
    };
  } catch (error) {
    return {
      sourceDocumentHash: null,
      implementationConfirmationHash: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

function persistReceipt(receiptPath, result) {
  if (!receiptPath) return null;
  const absolute = path.resolve(receiptPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return normalizePathForReport(absolute);
}

function baseReceipt(args) {
  return {
    ok: false,
    dryRun: Boolean(args.dryRun),
    preflightOnly: Boolean(args.preflightOnly),
    draftPath: normalizePathForReport(args.draft),
    targetPath: args.targetReportPath || normalizeTargetPathForReceipt(args.target),
    promotionStage: args.promotionStage,
    allowedStatuses: [],
    statusValue: null,
    confirmationReady: false,
    safePromotionAsDraft: false,
    requiresUserConfirmationBeforeExecution: true,
    manifestPath: null,
    targetHash: null,
    writeReceipt: null,
    receiptPath: null,
    backupPath: null,
    audit: null,
    preflight: null,
    authoringPromotionGate: null,
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

function readJsonFile(filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    const error = new Error(`missing_json_file:${filePath}`);
    error.code = "missing_json_file";
    throw error;
  }
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function writeJsonFile(filePath, value) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolute;
}

function runNodeJson(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  let parsed = null;
  try {
    parsed = result.stdout ? JSON.parse(result.stdout) : null;
  } catch (error) {
    parsed = {
      parseError: error instanceof Error ? error.message : String(error),
      stdoutPreview: String(result.stdout || "").slice(0, 2000),
      stderrPreview: String(result.stderr || "").slice(0, 2000),
    };
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output,
    parsed,
  };
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

function promoteDraftWithSafeWriter(draftPath, targetPath) {
  const content = fs.readFileSync(draftPath, "utf8");
  const writeReceipt = safeWriteText(targetPath, content, {
    mode: fs.existsSync(targetPath) ? "replace" : "create",
  });
  return {
    targetHash: writeReceipt.finalHash,
    writeReceipt,
  };
}

function isDocsPlansTarget(targetPath) {
  return /(^|\/)docs\/plans\/[^/]+\.md$/u.test(normalizePathForReport(targetPath));
}

function guardedPromotionRequired(args, targetPath) {
  return (
    args.promotionStage === "authoring-draft" ||
    args.promotionStage === "current-source-receipt-refresh" ||
    args.promotionStage === "projection-metadata-resync" ||
    isDocsPlansTarget(targetPath)
  );
}

function defaultAuthoringDir(manifest) {
  const recordId =
    String(manifest?.recordId ?? "").trim() ||
    path.basename(String(manifest?.targetPath ?? "requirements-draft"), path.extname(String(manifest?.targetPath ?? "")));
  return path.join(process.cwd(), "_bmad-output", "runtime", "requirement-records", recordId, "authoring");
}

function defaultGuardPaths(manifest) {
  const authoringDir = defaultAuthoringDir(manifest);
  return {
    authoringDir,
    scaleAssessment: path.join(authoringDir, "scale-assessment-initial.json"),
    scaleRoutingDecision: path.join(authoringDir, "scale-routing-decision.json"),
    sourceMutationDecision: path.join(authoringDir, "source-mutation-decision.json"),
    checkpointPersistenceEvidence: path.join(authoringDir, "checkpoint-persistence-evidence.json"),
    encodingReport: path.join(authoringDir, "encoding-report.json"),
    receiptOut: path.join(authoringDir, "promotion-receipt.json"),
  };
}

function findEncodingIntegrityScript() {
  const candidates = [
    path.join(process.cwd(), "_bmad", "skills", "encoding-integrity-guardian", "scripts", "check-encoding-integrity.js"),
    path.join(process.cwd(), ".codex", "skills", "encoding-integrity-guardian", "scripts", "check-encoding-integrity.js"),
    path.join(process.cwd(), ".claude", "skills", "encoding-integrity-guardian", "scripts", "check-encoding-integrity.js"),
    path.join(process.cwd(), ".cursor", "skills", "encoding-integrity-guardian", "scripts", "check-encoding-integrity.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function autoRepairDeterministicGateArtifacts(args, manifest, targetPath) {
  const actions = [];
  const failures = [];
  const defaults = defaultGuardPaths(manifest);
  const repairedArgs = { ...args };
  const targetState = currentTargetState(targetPath);

  for (const key of ["scaleAssessment", "scaleRoutingDecision", "encodingReport", "receiptOut"]) {
    if (!repairedArgs[key]) repairedArgs[key] = defaults[key];
  }

  if (!fs.existsSync(path.resolve(repairedArgs.scaleAssessment)) || !fs.existsSync(path.resolve(repairedArgs.scaleRoutingDecision))) {
    const assessScript = path.join(__dirname, "assess_contract_authoring_scale.js");
    const result = runNodeJson(assessScript, [
      "--source",
      manifest.draftPath,
      "--phase",
      "initial_assessment",
      "--out",
      repairedArgs.scaleAssessment,
      "--routing-decision-out",
      repairedArgs.scaleRoutingDecision,
      "--json",
    ]);
    actions.push({
      action: "run_initial_scale_assessment",
      script: normalizePathForReport(assessScript),
      out: normalizePathForReport(repairedArgs.scaleAssessment),
      routingDecisionOut: normalizePathForReport(repairedArgs.scaleRoutingDecision),
      ok: result.ok,
      stderrTrace: result.stderr,
    });
    if (!result.ok) failures.push("auto_repair_scale_assessment_failed");
  }

  if (!args.sourceMutationDecision && targetState.exists && targetState.hash === manifest.draftHash) {
    const prepareScript = path.join(__dirname, "prepare-current-source-promotion.js");
    const result = runNodeJson(prepareScript, [
      "--source",
      targetPath,
      "--authoring-dir",
      defaults.authoringDir,
      "--encoding-report-out",
      repairedArgs.encodingReport,
      "--source-mutation-decision-out",
      defaults.sourceMutationDecision,
      "--json",
    ]);
    actions.push({
      action: "prepare_current_source_promotion",
      script: normalizePathForReport(prepareScript),
      out: {
        encodingReport: normalizePathForReport(repairedArgs.encodingReport),
        sourceMutationDecision: normalizePathForReport(defaults.sourceMutationDecision),
      },
      ok: result.ok,
      failureClass: result.parsed?.failureClass ?? null,
    });
    if (fs.existsSync(defaults.sourceMutationDecision)) {
      repairedArgs.sourceMutationDecision = defaults.sourceMutationDecision;
    }
    if (!result.ok) failures.push("auto_repair_current_source_promotion_prep_failed");
  }

  if (!fs.existsSync(path.resolve(repairedArgs.encodingReport))) {
    const encodingScript = findEncodingIntegrityScript();
    if (!encodingScript) {
      failures.push("auto_repair_encoding_script_missing");
    } else {
      const result = runNodeJson(encodingScript, ["--json"]);
      actions.push({
        action: "run_encoding_integrity_gate",
        script: normalizePathForReport(encodingScript),
        out: normalizePathForReport(repairedArgs.encodingReport),
        ok: result.ok,
      });
      if (result.parsed) writeJsonFile(repairedArgs.encodingReport, result.parsed);
      if (!result.ok) failures.push("auto_repair_encoding_gate_failed");
    }
  }

  if (!args.sourceMutationDecision && !repairedArgs.sourceMutationDecision) {
    repairedArgs.sourceMutationDecision = fs.existsSync(defaults.sourceMutationDecision)
      ? defaults.sourceMutationDecision
      : "";
    actions.push({
      action: "source_mutation_decision_required",
      status: "manual_or_orchestrator_semantic_step_required",
      path: normalizePathForReport(defaults.sourceMutationDecision),
      command:
        "npm exec --prefix <project_root> -- bmad-speckit main-agent-orchestration --action author-confirmation-ready-source --source <intake-source.md> --json",
    });
  }

  if (!args.receiptOut && repairedArgs.receiptOut) {
    actions.push({
      action: "default_promotion_receipt_path_selected",
      path: normalizePathForReport(repairedArgs.receiptOut),
      ok: true,
    });
  }

  return {
    args: repairedArgs,
    report: {
      enabled: true,
      actions,
      failures,
      defaultAuthoringDir: normalizePathForReport(defaults.authoringDir),
      targetPath: normalizePathForReport(targetPath),
    },
  };
}

const REQUIRED_CHECKPOINT_IDS = [
  "cp-00-semantic-kernel",
  "cp-01-must-decomposition-packet",
  "cp-02-deterministic-atomic-closure",
  "cp-03-packet-to-source-materialization",
  "cp-04-id-freeze",
  "cp-05-implementation-confirmation-core",
  "cp-06-projections",
  "cp-07-human-readable-views",
  "cp-08-pre-render-global-reconciliation",
];
function validateScaleAssessment(assessment) {
  const issues = [];
  if (!assessment || typeof assessment !== "object") issues.push("scale_assessment_missing_or_invalid");
  if (assessment?.schemaVersion !== "contract-authoring-scale-assessment/v1") {
    issues.push("scale_assessment_schema_invalid");
  }
  if (assessment?.phase !== "initial_assessment") issues.push("scale_assessment_initial_phase_required");
  const trace = assessment?.assessmentTrace;
  if (trace?.visibleOutputStream !== "stderr") issues.push("scale_assessment_visible_stderr_trace_missing");
  if (!trace?.start) issues.push("scale_assessment_trace_start_missing");
  if (!trace?.process?.scoreBreakdown) issues.push("scale_assessment_trace_score_breakdown_missing");
  if (!trace?.process?.hardTriggerBreakdown) issues.push("scale_assessment_trace_hard_trigger_breakdown_missing");
  if (!trace?.result?.decision) issues.push("scale_assessment_trace_routing_decision_missing");
  return issues;
}

function validateScaleRoutingDecision(route, assessment, assessmentPath) {
  const issues = [];
  if (!route || typeof route !== "object") issues.push("scale_routing_decision_missing_or_invalid");
  if (route?.schemaVersion !== "contract-authoring-scale-routing-decision/v1") {
    issues.push("scale_routing_decision_schema_invalid");
  }
  if (!route?.decision) issues.push("scale_routing_decision_missing_decision");
  if (!route?.initialAssessmentRef?.path) issues.push("scale_routing_decision_initial_assessment_ref_path_missing");
  if (!route?.initialAssessmentRef?.hash) issues.push("scale_routing_decision_initial_assessment_ref_hash_missing");
  if (
    route?.initialAssessmentRef?.path &&
    normalizePathForReport(route.initialAssessmentRef.path) !== normalizePathForReport(assessmentPath)
  ) {
    issues.push("scale_routing_decision_initial_assessment_ref_path_mismatch");
  }
  if (assessment && route?.initialAssessmentRef?.hash && route.initialAssessmentRef.hash !== sha256Json(assessment)) {
    issues.push("scale_routing_decision_initial_assessment_ref_hash_mismatch");
  }
  return issues;
}

function checkpointEvidenceRequired(route) {
  return (
    route?.decision === "checkpoint_required" ||
    route?.decision === "checkpoint_required_with_amendment"
  );
}

function validateCheckpointPersistenceEvidence(evidence, context = {}) {
  const issues = [];
  if (!evidence || typeof evidence !== "object") {
    return ["checkpoint_persistence_evidence_missing_or_invalid"];
  }
  if (evidence.checkpointPersistenceSatisfiedCandidate !== true) {
    issues.push("checkpoint_persistence_satisfied_candidate_required");
  }
  if (Array.isArray(evidence.completedCheckpointIds)) {
    issues.push("checkpoint_persistence_top_level_completed_ids_forbidden");
  }
  const completed = Array.isArray(evidence.checkpointPersistenceRef?.completedCheckpointIds)
    ? evidence.checkpointPersistenceRef.completedCheckpointIds
    : [];
  const expectedCompleted = REQUIRED_CHECKPOINT_IDS;
  if (
    completed.length !== expectedCompleted.length ||
    expectedCompleted.some((checkpointId, index) => completed[index] !== checkpointId)
  ) {
    issues.push(`checkpoint_completed_set_invalid:${expectedCompleted.join(",")}`);
  }
  const ref = evidence.checkpointPersistenceRef;
  if (!ref || typeof ref !== "object") issues.push("checkpoint_persistence_ref_missing");
  const receiptRefs = Array.isArray(ref?.checkpointReceiptRefs) ? ref.checkpointReceiptRefs : [];
  if (receiptRefs.length !== REQUIRED_CHECKPOINT_IDS.length) {
    issues.push("checkpoint_receipt_refs_required");
  }
  for (const checkpointId of REQUIRED_CHECKPOINT_IDS) {
    const receiptRef = receiptRefs.find((item) => item?.checkpointId === checkpointId);
    if (!receiptRef) {
      issues.push(`checkpoint_receipt_ref_missing:${checkpointId}`);
      continue;
    }
    if (!receiptRef.path) issues.push(`checkpoint_receipt_ref_path_missing:${checkpointId}`);
    if (!receiptRef.hash) issues.push(`checkpoint_receipt_ref_hash_missing:${checkpointId}`);
    if (receiptRef.path) {
      const receiptPath = path.resolve(receiptRef.path);
      if (!fs.existsSync(receiptPath)) {
        issues.push(`checkpoint_receipt_file_missing:${checkpointId}`);
      } else if (receiptRef.hash && sha256File(receiptPath) !== receiptRef.hash) {
        issues.push(`checkpoint_receipt_file_hash_mismatch:${checkpointId}`);
      } else {
        const receipt = readJsonFile(receiptPath);
        if (
          receipt?.schemaVersion !==
          "requirements-contract-checkpoint-semantic-validation-receipt/v1"
        ) {
          issues.push(`checkpoint_receipt_schema_invalid:${checkpointId}`);
        }
        if (receipt?.checkpointId !== checkpointId) {
          issues.push(`checkpoint_receipt_checkpoint_id_mismatch:${checkpointId}`);
        }
        if (context.sourceDocumentHash) {
          if (!receipt?.sourceDocumentHash) {
            issues.push(`checkpoint_receipt_source_hash_missing:${checkpointId}`);
          } else if (receipt.sourceDocumentHash !== context.sourceDocumentHash) {
            issues.push(`checkpoint_receipt_source_hash_mismatch:${checkpointId}`);
          }
        }
        if (context.implementationConfirmationHash) {
          if (!receipt?.implementationConfirmationHash) {
            issues.push(`checkpoint_receipt_implementation_hash_missing:${checkpointId}`);
          } else if (receipt.implementationConfirmationHash !== context.implementationConfirmationHash) {
            issues.push(`checkpoint_receipt_implementation_hash_mismatch:${checkpointId}`);
          }
        }
        for (const [field, expectedValue] of [
          ["recordId", evidence.recordId],
          ["requirementSetId", evidence.requirementSetId],
          ["implementationAttemptId", evidence.implementationAttemptId],
          ["semanticModelHash", evidence.semanticModelHash],
          ["semanticConservationManifestHash", evidence.semanticConservationManifestHash],
        ]) {
          if (!expectedValue || receipt?.[field] !== expectedValue) {
            issues.push(`checkpoint_receipt_${field}_mismatch:${checkpointId}`);
          }
        }
        for (const field of ["validatorIdentity", "validatorVersion", "validatorHash"]) {
          if (!receipt?.[field]) issues.push(`checkpoint_receipt_${field}_missing:${checkpointId}`);
        }
        if (!Array.isArray(receipt?.validatedInputs) || receipt.validatedInputs.length === 0) {
          issues.push(`checkpoint_receipt_validated_inputs_missing:${checkpointId}`);
        }
        if (
          receiptRef.status !== "passed" ||
          receiptRef.persistenceStatus !== "committed" ||
          receiptRef.semanticValidationStatus !== "pass"
        ) {
          issues.push(`checkpoint_receipt_ref_not_passed:${checkpointId}`);
        }
        if (
          receipt?.persistenceStatus !== "committed" ||
          receipt?.semanticValidationStatus !== "pass" ||
          receipt?.decision !== "pass" ||
          !Array.isArray(receipt?.blockers) ||
          receipt.blockers.length !== 0
        ) {
          issues.push(`checkpoint_receipt_status_not_passed:${checkpointId}`);
        }
        const { receiptHash, ...receiptPayload } = receipt || {};
        if (!receiptHash) {
          issues.push(`checkpoint_receipt_hash_missing:${checkpointId}`);
        } else if (receiptHash !== sha256Json(receiptPayload)) {
          issues.push(`checkpoint_receipt_hash_invalid:${checkpointId}`);
        }
      }
    }
  }
  for (const key of [
    "progressPath",
    "progressHash",
    "preRenderMustDecompositionGateHash",
    "preRenderGlobalConsistencyHash",
    "packetSourceReconciliationHash",
  ]) {
    if (!ref?.[key]) issues.push(`checkpoint_persistence_ref_${key}_missing`);
  }
  return issues;
}

function validateSourceMutationDecision(decision, context) {
  const issues = [];
  if (!decision || typeof decision !== "object") issues.push("source_mutation_decision_missing_or_invalid");
  if (decision?.schemaVersion !== "requirements-authoring-source-mutation-decision/v1") {
    issues.push("source_mutation_decision_schema_invalid");
  }
  if (decision?.finalDecision !== "allow_source_materialization") {
    issues.push("source_mutation_decision_not_allow_source_materialization");
  }
  if (decision?.sourceMutationAllowed !== true) issues.push("source_mutation_allowed_true_required");
  if (!decision?.sourceDocumentHashBefore) issues.push("source_mutation_source_hash_before_missing");
  if (!decision?.sourceDocumentHashAfter) issues.push("source_mutation_source_hash_after_missing");
  if (context) {
    const sourceDocumentHashBefore = String(decision?.sourceDocumentHashBefore ?? "");
    const sourceDocumentHashAfter = String(decision?.sourceDocumentHashAfter ?? "");
    const targetRawHashBefore = String(
      decision?.targetRawHashBefore ?? decision?.sourceDocumentHashBefore ?? ""
    );
    const targetRawHashAfter = String(
      decision?.targetRawHashAfter ?? decision?.sourceDocumentHashAfter ?? ""
    );
    const semanticSourceHashBefore = String(decision?.semanticSourceHashBefore ?? "");
    const semanticSourceHashAfter = String(decision?.semanticSourceHashAfter ?? "");
    if (context.targetState.exists && decision?.sourceDocumentExistedBefore === false) {
      issues.push("source_mutation_target_existence_mismatch");
    }
    if (!context.targetState.exists && decision?.sourceDocumentExistedBefore !== false) {
      issues.push("source_mutation_target_absence_not_authorized");
    }
    if (targetRawHashBefore && targetRawHashBefore !== context.targetState.hash) {
      issues.push("source_mutation_source_hash_before_mismatch");
    }
    if (targetRawHashAfter && targetRawHashAfter !== context.expectedDraftHash) {
      issues.push("source_mutation_source_hash_after_mismatch");
    }
    if (
      decision?.targetRawHashBefore &&
      sourceDocumentHashBefore &&
      decision.targetRawHashBefore !== sourceDocumentHashBefore
    ) {
      issues.push("source_mutation_source_hash_before_raw_alias_mismatch");
    }
    if (
      decision?.targetRawHashAfter &&
      sourceDocumentHashAfter &&
      decision.targetRawHashAfter !== sourceDocumentHashAfter
    ) {
      issues.push("source_mutation_source_hash_after_raw_alias_mismatch");
    }
    if (context.expectedSemanticSourceHash) {
      if (!semanticSourceHashAfter) {
        issues.push("source_mutation_semantic_source_hash_after_missing");
      } else if (semanticSourceHashAfter !== context.expectedSemanticSourceHash) {
        issues.push("source_mutation_semantic_source_hash_after_mismatch");
      }
    }
    if (context.currentSemanticSourceHash) {
      if (!semanticSourceHashBefore) {
        issues.push("source_mutation_semantic_source_hash_before_missing");
      } else if (semanticSourceHashBefore !== context.currentSemanticSourceHash) {
        issues.push("source_mutation_semantic_source_hash_before_mismatch");
      }
    }
  }
  return issues;
}

function validateEncodingReport(report) {
  const issues = [];
  if (!report || typeof report !== "object") issues.push("encoding_report_missing_or_invalid");
  if (!Number.isInteger(report?.checkedFiles) || report.checkedFiles <= 0) {
    issues.push("encoding_report_checked_files_missing");
  }
  if (!Array.isArray(report?.findings)) issues.push("encoding_report_findings_array_missing");
  else if (report.findings.length > 0) issues.push("encoding_report_findings_not_empty");
  return issues;
}

function addNextRequiredActionsForErrors(result) {
  const errorSet = new Set(result.errors);
  const hasSourceMutationDrift = [
    "source_mutation_target_existence_mismatch",
    "source_mutation_target_absence_not_authorized",
    "source_mutation_source_hash_before_mismatch",
    "source_mutation_source_hash_after_mismatch",
  ].some((error) => errorSet.has(error));
  if (hasSourceMutationDrift) {
    result.nextRequiredActions.push({
      action: "rerun_authoring_orchestrator_for_current_hashes",
      command:
        "npm exec --prefix <project_root> -- bmad-speckit main-agent-orchestration --action author-confirmation-ready-source --source <intake-source.md> --json",
      reason:
        "source-mutation-decision.json is stale or not bound to the current target hash and draft manifest hash.",
    });
  }
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function authoringArtifactDirectories(args) {
  return uniqueStrings(
    [
      args.scaleAssessment,
      args.scaleRoutingDecision,
      args.sourceMutationDecision,
      args.checkpointPersistenceEvidence,
      args.encodingReport,
      args.receiptOut,
    ]
      .filter(Boolean)
      .map((value) => path.dirname(path.resolve(value)))
  );
}

function listTemporaryExecutableHelpers(args) {
  const forbidden = /\.(?:cjs|mjs|js|ps1)$/iu;
  const files = [];
  for (const dir of authoringArtifactDirectories(args)) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !forbidden.test(entry.name)) continue;
      files.push(normalizePathForReport(path.join(dir, entry.name)));
    }
  }
  return files.sort();
}

function validateAuthoringPromotionGate(args, targetPath, manifest) {
  const required = guardedPromotionRequired(args, targetPath);
  const targetState = currentTargetState(targetPath);
  const semanticBinding = manifest?.draftPath
    ? semanticBindingForFile(manifest.draftPath)
    : { sourceDocumentHash: null, implementationConfirmationHash: null, error: null };
  const currentTargetSemanticBinding = targetState.exists
    ? semanticBindingForFile(targetPath)
    : { sourceDocumentHash: null, implementationConfirmationHash: null, error: null };
  const result = {
    required,
    ok: true,
    errors: [],
    refs: {
      scaleAssessment: normalizePathForReport(args.scaleAssessment),
      scaleRoutingDecision: normalizePathForReport(args.scaleRoutingDecision),
      sourceMutationDecision: normalizePathForReport(args.sourceMutationDecision),
      checkpointPersistenceEvidence: normalizePathForReport(args.checkpointPersistenceEvidence),
      encodingReport: normalizePathForReport(args.encodingReport),
    },
    decisions: {},
    currentTargetState: {
      exists: targetState.exists,
      hash: targetState.hash,
      path: targetState.path,
    },
    expectedDraftHash: manifest?.draftHash ?? null,
    expectedSemanticSourceHash: semanticBinding.sourceDocumentHash,
    expectedImplementationConfirmationHash: semanticBinding.implementationConfirmationHash,
    currentSemanticSourceHash: currentTargetSemanticBinding.sourceDocumentHash,
    nextRequiredActions: [],
  };
  if (!required) return result;

  for (const [key, value] of Object.entries({
    scaleAssessment: args.scaleAssessment,
    scaleRoutingDecision: args.scaleRoutingDecision,
    sourceMutationDecision: args.sourceMutationDecision,
    encodingReport: args.encodingReport,
    receiptOut: args.receiptOut,
  })) {
    if (!value) result.errors.push(`${key}_required`);
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      if (error === "scaleAssessment_required" || error === "scaleRoutingDecision_required") {
        result.nextRequiredActions.push({
          action: "run_initial_scale_assessment",
          command:
            "node <skill-dir>/scripts/assess_contract_authoring_scale.js --source <intake-source.md> --phase initial_assessment --out <authoring-dir>/scale-assessment-initial.json --routing-decision-out <authoring-dir>/scale-routing-decision.json --json",
        });
      }
      if (error === "sourceMutationDecision_required") {
        result.nextRequiredActions.push({
          action: "run_authoring_orchestrator_until_source_mutation_decision",
          command:
            "npm exec --prefix <project_root> -- bmad-speckit main-agent-orchestration --action author-confirmation-ready-source --source <intake-source.md> --json",
        });
      }
      if (error === "encodingReport_required") {
        result.nextRequiredActions.push({
          action: "run_encoding_integrity_gate",
          command: "node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js --json",
        });
      }
    }
    result.ok = false;
    return result;
  }

  const temporaryExecutableHelpers = listTemporaryExecutableHelpers(args);
  result.decisions.temporaryExecutableHelpers = {
    forbiddenExtensions: [".cjs", ".js", ".mjs", ".ps1"],
    files: temporaryExecutableHelpers,
  };
  if (temporaryExecutableHelpers.length > 0) {
    result.errors.push("authoring_temporary_executable_helper_present");
    result.nextRequiredActions.push({
      action: "archive_authoring_temporary_executable_helpers",
      command:
        "move temporary .cjs/.js/.mjs/.ps1 helper files out of <authoring-dir> and rerun the skill-local authoring/promotion scripts",
      reason:
        "Requirement-record authoring directories may contain evidence JSON/Markdown only; executable helper scripts indicate an ad hoc repair path and are not authoritative.",
    });
    result.ok = false;
    return result;
  }

  try {
    const scaleAssessment = readJsonFile(args.scaleAssessment);
    const scaleRoutingDecision = readJsonFile(args.scaleRoutingDecision);
    const sourceMutationDecision = readJsonFile(args.sourceMutationDecision);
    const encodingReport = readJsonFile(args.encodingReport);

    result.decisions.scaleAssessment = {
      phase: scaleAssessment.phase ?? null,
      decision: scaleAssessment.decision ?? null,
      visibleTrace: scaleAssessment.assessmentTrace?.visibleOutputStream ?? null,
      hash: sha256Json(scaleAssessment),
    };
    result.decisions.scaleRouting = {
      decision: scaleRoutingDecision.decision ?? null,
      nextAction: scaleRoutingDecision.nextAction ?? null,
      checkpointPersistenceSatisfied: scaleRoutingDecision.checkpointPersistenceSatisfied === true,
      hash: sha256Json(scaleRoutingDecision),
    };
    result.decisions.sourceMutation = {
      finalDecision: sourceMutationDecision.finalDecision ?? null,
      sourceMutationAllowed: sourceMutationDecision.sourceMutationAllowed === true,
      sourceDocumentExistedBefore: sourceMutationDecision.sourceDocumentExistedBefore ?? null,
      sourceDocumentHashBefore: sourceMutationDecision.sourceDocumentHashBefore ?? null,
      sourceDocumentHashAfter: sourceMutationDecision.sourceDocumentHashAfter ?? null,
      targetRawHashBefore: sourceMutationDecision.targetRawHashBefore ?? null,
      targetRawHashAfter: sourceMutationDecision.targetRawHashAfter ?? null,
      semanticSourceHashBefore: sourceMutationDecision.semanticSourceHashBefore ?? null,
      semanticSourceHashAfter: sourceMutationDecision.semanticSourceHashAfter ?? null,
      currentTargetHash: targetState.hash,
      expectedDraftHash: manifest?.draftHash ?? null,
    };
    result.decisions.encoding = {
      checkedFiles: encodingReport.checkedFiles ?? null,
      findingCount: Array.isArray(encodingReport.findings) ? encodingReport.findings.length : null,
    };

    result.errors.push(...validateScaleAssessment(scaleAssessment));
    result.errors.push(...validateScaleRoutingDecision(scaleRoutingDecision, scaleAssessment, args.scaleAssessment));
    result.errors.push(
      ...validateSourceMutationDecision(sourceMutationDecision, {
        targetState,
        expectedDraftHash: manifest?.draftHash ?? "",
        expectedSemanticSourceHash: semanticBinding.sourceDocumentHash,
        currentSemanticSourceHash: currentTargetSemanticBinding.sourceDocumentHash,
      })
    );
    result.errors.push(...validateEncodingReport(encodingReport));
    addNextRequiredActionsForErrors(result);

    if (checkpointEvidenceRequired(scaleRoutingDecision)) {
      if (!args.checkpointPersistenceEvidence) {
        result.errors.push("checkpoint_persistence_evidence_required");
        result.nextRequiredActions.push({
          action: "run_semantic_checkpoints_until_pre_render_ready",
          command:
            "node <skill-dir>/scripts/run_semantic_checkpoints.js --source <source-document.md> --mode checkpoint-persistence --route-decision <authoring-dir>/scale-routing-decision.json --json",
        });
      } else {
        const checkpointEvidence = readJsonFile(args.checkpointPersistenceEvidence);
        const checkpointCompleted = Array.isArray(
          checkpointEvidence.checkpointPersistenceRef?.completedCheckpointIds
        )
          ? checkpointEvidence.checkpointPersistenceRef.completedCheckpointIds
          : [];
        result.decisions.checkpointPersistence = {
          satisfied: checkpointEvidence.checkpointPersistenceSatisfiedCandidate === true,
          completedCheckpointCount: checkpointCompleted.length,
          checkpointReceiptCount: Array.isArray(
            checkpointEvidence.checkpointPersistenceRef?.checkpointReceiptRefs
          )
            ? checkpointEvidence.checkpointPersistenceRef.checkpointReceiptRefs.length
            : 0,
        };
        result.errors.push(
          ...validateCheckpointPersistenceEvidence(checkpointEvidence, {
            sourceDocumentHash: semanticBinding.sourceDocumentHash,
            implementationConfirmationHash: semanticBinding.implementationConfirmationHash,
          })
        );
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  result.ok = result.errors.length === 0;
  return result;
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
  const targetReportPath = normalizeTargetPathForReceipt(args.target);
  const receipt = baseReceipt({ ...args, draft: draftPath, target: targetPath, targetReportPath });
  const promotionPolicy = promotionPolicyFor(args.promotionStage);
  if (!promotionPolicy) {
    receipt.failureClass = "draft_syntax_error";
    receipt.details = {
      errors: [`unknown_promotion_stage:${args.promotionStage}`],
      allowedPromotionStages: Object.keys(PROMOTION_STAGE_POLICIES),
    };
    writeReceipt(receipt, args.json);
    return 2;
  }
  receipt.allowedStatuses = [...promotionPolicy.allowedStatuses];
  receipt.safePromotionAsDraft = promotionPolicy.safePromotionAsDraft;

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
    receipt.statusValue = manifest.statusValue ?? null;

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

    if (args.promotionStage === "current-source-receipt-refresh") {
      const targetState = currentTargetState(targetPath);
      if (!targetState.exists || targetState.hash !== manifest.draftHash) {
        const failed = fail(
          receipt,
          "semantic_decision_required:current_source_hash_mismatch",
          {
            promotionStage: args.promotionStage,
            requiredCondition: "draftHash must match the current target hash",
            targetExists: targetState.exists,
            targetHash: targetState.hash,
            draftHash: manifest.draftHash,
          },
          { ...args, draft: draftPath, target: targetPath },
          manifest
        );
        writeReceipt(failed.receipt, args.json);
        return failed.exitCode;
      }
    }
    if (args.promotionStage === "projection-metadata-resync") {
      const targetState = currentTargetState(targetPath);
      if (!targetState.exists) {
        const failed = fail(
          receipt,
          "semantic_decision_required:projection_metadata_target_missing",
          {
            promotionStage: args.promotionStage,
            requiredCondition: "target must exist for metadata-only resynchronization",
          },
          { ...args, draft: draftPath, target: targetPath },
          manifest
        );
        writeReceipt(failed.receipt, args.json);
        return failed.exitCode;
      }
      const draftText = fs.readFileSync(draftPath, "utf8");
      const targetText = fs.readFileSync(targetPath, "utf8");
      const draftConfirmation = extractImplementationConfirmation(draftText);
      const targetConfirmation = extractImplementationConfirmation(targetText);
      const draftSemanticHashes = {
        sourceDocumentHash: sourceDocumentHashFor(
          draftText,
          draftConfirmation.blockText,
          draftConfirmation.confirmation
        ),
        implementationConfirmationHash: implementationConfirmationHashFor(
          draftConfirmation.confirmation
        ),
      };
      const targetSemanticHashes = {
        sourceDocumentHash: sourceDocumentHashFor(
          targetText,
          targetConfirmation.blockText,
          targetConfirmation.confirmation
        ),
        implementationConfirmationHash: implementationConfirmationHashFor(
          targetConfirmation.confirmation
        ),
      };
      if (
        draftSemanticHashes.sourceDocumentHash !== targetSemanticHashes.sourceDocumentHash ||
        draftSemanticHashes.implementationConfirmationHash !==
          targetSemanticHashes.implementationConfirmationHash
      ) {
        const failed = fail(
          receipt,
          "semantic_decision_required:projection_metadata_semantic_hash_mismatch",
          {
            promotionStage: args.promotionStage,
            requiredCondition:
              "sourceDocumentHash and implementationConfirmationHash must remain unchanged",
            targetSemanticHashes,
            draftSemanticHashes,
          },
          { ...args, draft: draftPath, target: targetPath },
          manifest
        );
        writeReceipt(failed.receipt, args.json);
        return failed.exitCode;
      }
    }

    let effectiveArgs = args;
    if (args.autoRepair && guardedPromotionRequired(args, targetPath)) {
      const autoRepair = autoRepairDeterministicGateArtifacts(args, manifest, targetPath);
      effectiveArgs = autoRepair.args;
      receipt.autoRepair = autoRepair.report;
      receipt.draftPath = normalizePathForReport(draftPath);
      receipt.targetPath = targetReportPath;
    }

    const authoringPromotionGate = validateAuthoringPromotionGate(effectiveArgs, targetPath, manifest);
    receipt.authoringPromotionGate = authoringPromotionGate;
    if (!authoringPromotionGate.ok) {
      const failed = fail(
        receipt,
        "authoring_promotion_gate_failed",
        {
          errors: authoringPromotionGate.errors,
          refs: authoringPromotionGate.refs,
          nextRequiredActions: authoringPromotionGate.nextRequiredActions,
          autoRepair: receipt.autoRepair ?? null,
        },
        { ...effectiveArgs, draft: draftPath, target: targetPath },
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

    if (!promotionPolicy.allowedStatuses.has(String(manifest.statusValue))) {
      const failed = fail(
        receipt,
        "semantic_decision_required:expected_draft_gap_policy",
        {
          promotionStage: args.promotionStage,
          allowedStatuses: [...promotionPolicy.allowedStatuses],
          statusValue: manifest.statusValue,
        },
        { ...args, draft: draftPath, target: targetPath },
        manifest
      );
      writeReceipt(failed.receipt, args.json);
      return failed.exitCode;
    }

    if (
      args.promotionStage === "authoring-draft" ||
      args.promotionStage === "current-source-receipt-refresh" ||
      args.promotionStage === "projection-metadata-resync"
    ) {
      receipt.audit = {
        status: null,
        ok: true,
        skipped: true,
        reason:
          args.promotionStage === "current-source-receipt-refresh"
            ? "current_source_receipt_refresh_is_not_confirmation_ready"
            : args.promotionStage === "projection-metadata-resync"
              ? "projection_metadata_resync_is_semantic_hash_neutral"
              : "authoring_draft_is_not_confirmation_ready",
      };
      receipt.residualRisks.push(
        args.promotionStage === "current-source-receipt-refresh"
          ? "reverse_audit_not_run_current_source_receipt_refresh"
          : args.promotionStage === "projection-metadata-resync"
            ? "reverse_audit_not_run_projection_metadata_resync"
            : "reverse_audit_not_run_authoring_draft"
      );
    } else {
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
    }

    if (args.dryRun) {
      receipt.ok = true;
      receipt.confirmationReady = promotionPolicy.confirmationReadyOnSuccess;
      receipt.requiresUserConfirmationBeforeExecution = !promotionPolicy.confirmationReadyOnSuccess;
      receipt.targetHash = fs.existsSync(targetPath)
        ? sha256(fs.readFileSync(targetPath, "utf8"))
        : null;
      receipt.residualRisks.push("target_not_written_dry_run");
      writeReceipt(receipt, args.json);
      return 0;
    }

    const promotion = promoteDraftWithSafeWriter(draftPath, targetPath);
    receipt.writeReceipt = promotion.writeReceipt;
    receipt.backupPath = normalizePathForReport(promotion.writeReceipt.backupPath);
    receipt.targetHash = promotion.targetHash;
    receipt.ok = true;
    receipt.confirmationReady = promotionPolicy.confirmationReadyOnSuccess;
    receipt.requiresUserConfirmationBeforeExecution = !promotionPolicy.confirmationReadyOnSuccess;
    receipt.failureClass = null;
    receipt.receiptPath = persistReceipt(effectiveArgs.receiptOut, receipt);
    if (receipt.receiptPath) {
      const withReceiptPath = { ...receipt, receiptPath: receipt.receiptPath };
      persistReceipt(effectiveArgs.receiptOut, withReceiptPath);
      writeReceipt(withReceiptPath, args.json);
      return 0;
    }
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
