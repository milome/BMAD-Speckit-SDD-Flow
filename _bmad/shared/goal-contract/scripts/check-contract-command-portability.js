#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const POWERSHELL_GIT_REVISION_PATTERN =
  /\bgit[ \t]+rev-parse[ \t]+(?!["'])([^\s`|;&]+\^\{[^}\r\n]+\})/gu;

function take(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function locationAt(content, index) {
  const prefix = content.slice(0, index);
  const line = prefix.split(/\r\n|\r|\n/u).length;
  const lastLineFeed = Math.max(prefix.lastIndexOf("\n"), prefix.lastIndexOf("\r"));
  return {
    line,
    column: index - lastLineFeed,
  };
}

function findPowerShellIssues(content) {
  const issues = [];
  let match;
  POWERSHELL_GIT_REVISION_PATTERN.lastIndex = 0;

  while ((match = POWERSHELL_GIT_REVISION_PATTERN.exec(content)) !== null) {
    const location = locationAt(content, match.index);
    issues.push({
      code: "powershell_git_revision_expression_requires_quoting",
      ...location,
      command: match[0],
      revision: match[1],
      repairHint: `Quote the revision argument, for example: git rev-parse "${match[1]}"`,
    });
  }

  return issues;
}

function auditCommandPortability({ content, targetPath, shell = "pwsh" }) {
  if (!["pwsh", "powershell"].includes(shell.toLowerCase())) {
    throw new Error(`Unsupported shell: ${shell}`);
  }

  const issues = findPowerShellIssues(content);
  return {
    schemaVersion: "goal-contract-command-portability/v1",
    targetPath: targetPath ? path.resolve(targetPath) : null,
    shell: "pwsh",
    status: issues.length === 0 ? "PASS" : "FAIL",
    issueCount: issues.length,
    issues,
  };
}

function commandPortabilityCli(args = process.argv.slice(2)) {
  const target = take(args, "--target");
  const shell = take(args, "--shell") || "pwsh";
  const json = args.includes("--json");

  if (!target) {
    process.stderr.write(
      "Usage: check-contract-command-portability.js --target <path> [--shell pwsh] [--json]\n"
    );
    return 1;
  }

  const targetPath = path.resolve(target);
  const receipt = auditCommandPortability({
    content: fs.readFileSync(targetPath, "utf8"),
    targetPath,
    shell,
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${receipt.status} target=${targetPath} shell=pwsh issues=${receipt.issueCount}\n`
    );
  }

  return receipt.status === "PASS" ? 0 : 2;
}

if (require.main === module) {
  process.exitCode = commandPortabilityCli();
}

module.exports = {
  auditCommandPortability,
  commandPortabilityCli,
  findPowerShellIssues,
};
