#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { extractImplementationConfirmation } = require("./pre_render_definition_drilldown_lib");

function usage() {
  return [
    "Usage: node generate-draft-manifest.js --draft <path> --target <path> [options]",
    "",
    "Creates a deterministic manifest for a normalized requirements source draft.",
    "Options:",
    "  --draft <path>       Draft markdown file to inspect.",
    "  --target <path>      Target markdown path intended for promotion.",
    "  --require <text>     Required literal text. May be repeated.",
    "  --min-bytes <n>      Minimum UTF-8 byte count.",
    "  --attempt-id <id>    Attempt identifier to record.",
    "  --out <path>         Write manifest JSON to this path.",
    "  --require-must <id>  Require an implementationConfirmation.must[] ID. May be repeated.",
    "  --json               Emit JSON result.",
    "  --help               Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    require: [],
    requireMust: [],
    json: false,
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
    if (arg === "--require" || arg === "--require-must") {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${arg}`);
      if (arg === "--require") args.require.push(value);
      else args.requireMust.push(value);
      index += 1;
      continue;
    }
    if (["--draft", "--target", "--min-bytes", "--attempt-id", "--out"].includes(arg)) {
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
  return path.resolve(filePath).replace(/\\/gu, "/");
}

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex")}`;
}

function countFenceBalance(content) {
  const matches = content.match(/^```/gmu);
  return matches ? matches.length % 2 : 0;
}

function collectMustIds(confirmation) {
  return Array.isArray(confirmation?.must)
    ? confirmation.must.map((item) => String(item?.id ?? "")).filter(Boolean)
    : [];
}

function buildManifest(options) {
  const draftPath = path.resolve(options.draft);
  const targetPath = path.resolve(options.target);
  const errors = [];
  const requiredTexts = options.require ?? [];
  const requiredMustIds = options.requireMust ?? [];
  const content = fs.readFileSync(draftPath, "utf8");
  const bytes = Buffer.byteLength(content, "utf8");
  const lines = content.length === 0 ? 0 : content.split(/\n/u).length;
  const requiredTextChecks = requiredTexts.map((text) => ({
    text,
    present: content.includes(text),
  }));
  for (const check of requiredTextChecks) {
    if (!check.present) errors.push(`missing_required_text:${check.text}`);
  }

  const minBytes = options.minBytes === undefined ? null : Number(options.minBytes);
  if (options.minBytes !== undefined && (!Number.isInteger(minBytes) || minBytes < 0)) {
    errors.push("invalid_min_bytes");
  } else if (minBytes !== null && bytes < minBytes) {
    errors.push(`min_bytes_not_met:${bytes}<${minBytes}`);
  }

  const markdownFenceBalance = countFenceBalance(content);
  if (markdownFenceBalance !== 0) errors.push("unbalanced_markdown_fences");

  let confirmation = null;
  let implementationConfirmationPresent = /^implementationConfirmation:\s*$/mu.test(content);
  let statusValue = null;
  let mustIds = [];
  let implementationConfirmationParseError = null;
  try {
    const extracted = extractImplementationConfirmation(content);
    confirmation = extracted.confirmation;
    implementationConfirmationPresent = true;
    statusValue = confirmation?.status === undefined ? null : String(confirmation.status);
    mustIds = collectMustIds(confirmation);
  } catch (error) {
    implementationConfirmationParseError = error instanceof Error ? error.message : String(error);
    if (!implementationConfirmationPresent) errors.push("missing_implementation_confirmation");
    else errors.push("implementation_confirmation_parse_failed");
  }

  for (const id of requiredMustIds) {
    if (!mustIds.includes(id)) errors.push(`missing_required_must:${id}`);
  }

  const manifest = {
    ok: errors.length === 0,
    schemaVersion: "requirements-contract-draft-manifest/v1",
    draftPath: normalizePathForReport(draftPath),
    targetPath: normalizePathForReport(targetPath),
    draftHash: sha256(content),
    bytes,
    lines,
    requiredTextChecks,
    statusValue,
    implementationConfirmationPresent,
    implementationConfirmationParseError,
    mustIds,
    markdownFenceBalance,
    createdAt: new Date().toISOString(),
    attemptId: options.attemptId || `draft-${Date.now()}`,
    errors,
  };

  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    manifest.outPath = normalizePathForReport(outPath);
  }

  return manifest;
}

function writeJson(result, json) {
  const payload = JSON.stringify(result, null, 2);
  if (json || result.ok) {
    console.log(payload);
  } else {
    console.error(payload);
  }
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

  try {
    const manifest = buildManifest(args);
    writeJson(manifest, args.json);
    return manifest.ok ? 0 : 1;
  } catch (error) {
    writeJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        failureClass: "draft_syntax_error",
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
  buildManifest,
};
