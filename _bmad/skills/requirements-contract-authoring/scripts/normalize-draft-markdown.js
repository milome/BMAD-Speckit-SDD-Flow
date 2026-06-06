#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function usage() {
  return [
    "Usage: node normalize-draft-markdown.js --draft <path> [--out <path>] [--json]",
    "",
    "Normalizes deterministic transport damage in requirements contract drafts.",
    "Options:",
    "  --draft <path>  Draft markdown file to read.",
    "  --out <path>    Output path. Defaults to overwriting --draft.",
    "  --json          Emit JSON result.",
    "  --help          Show this help.",
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
    if (arg === "--draft" || arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${arg}`);
      args[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex")}`;
}

function countFenceBalance(content) {
  const matches = content.match(/^```/gmu);
  return matches ? matches.length % 2 : 0;
}

function quoteYamlScalar(value) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === "|" ||
    trimmed === ">" ||
    trimmed.startsWith('"') ||
    trimmed.startsWith("'") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("{")
  ) {
    return value;
  }
  if (!trimmed.includes(": ")) return value;
  const leading = value.match(/^\s*/u)?.[0] ?? "";
  const trailing = value.match(/\s*$/u)?.[0] ?? "";
  const escaped = trimmed.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
  return `${leading}"${escaped}"${trailing}`;
}

function normalizeMarkdown(raw) {
  const normalizations = [];
  const input = raw.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (input !== raw) normalizations.push("line_endings_or_bom");

  const lines = input.split("\n");
  let inImplementationConfirmation = false;
  let implementationIndent = null;
  let openedMermaidFence = false;
  let mermaidFenceRepairs = 0;
  let yamlScalarQuotes = 0;

  const output = lines.map((line) => {
    if (line === "`mermaid") {
      openedMermaidFence = true;
      mermaidFenceRepairs += 1;
      return "```mermaid";
    }
    if (openedMermaidFence && line === "`") {
      openedMermaidFence = false;
      mermaidFenceRepairs += 1;
      return "```";
    }

    const keyMatch = /^(\s*)implementationConfirmation:\s*$/u.exec(line);
    if (keyMatch) {
      inImplementationConfirmation = true;
      implementationIndent = keyMatch[1].length;
      return line;
    }

    if (inImplementationConfirmation) {
      const currentIndent = line.match(/^\s*/u)?.[0].length ?? 0;
      if (line.trim() && currentIndent <= implementationIndent) {
        inImplementationConfirmation = false;
        implementationIndent = null;
      }
    }

    if (inImplementationConfirmation) {
      const scalarMatch = /^(\s+[A-Za-z0-9_-]+:\s+)(.*)$/u.exec(line);
      if (scalarMatch) {
        const before = scalarMatch[2];
        const after = quoteYamlScalar(before);
        if (after !== before) {
          yamlScalarQuotes += 1;
          return `${scalarMatch[1]}${after}`;
        }
      }
    }

    return line;
  });

  if (mermaidFenceRepairs) normalizations.push("mermaid_fence_repair");
  if (yamlScalarQuotes) normalizations.push("implementation_confirmation_yaml_scalar_quote");

  return {
    content: output.join("\n"),
    normalizations,
    mermaidFenceRepairs,
    yamlScalarQuotes,
  };
}

function writeJson(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!result.ok) {
    console.error(result.error || "normalization failed");
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
  if (!args.draft) {
    console.error("missing --draft");
    console.error(usage());
    return 2;
  }

  const draftPath = path.resolve(args.draft);
  const outPath = path.resolve(args.out || args.draft);
  try {
    const raw = fs.readFileSync(draftPath, "utf8");
    const normalized = normalizeMarkdown(raw);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, normalized.content, "utf8");
    const result = {
      ok: true,
      draftPath,
      outPath,
      changed: normalized.content !== raw,
      normalizations: normalized.normalizations,
      mermaidFenceRepairs: normalized.mermaidFenceRepairs,
      yamlScalarQuotes: normalized.yamlScalarQuotes,
      bytes: Buffer.byteLength(normalized.content, "utf8"),
      sha256: sha256(normalized.content),
      markdownFenceBalance: countFenceBalance(normalized.content),
    };
    writeJson(result, args.json);
    return 0;
  } catch (error) {
    writeJson({ ok: false, draftPath, outPath, error: error.message }, args.json);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  normalizeMarkdown,
};
