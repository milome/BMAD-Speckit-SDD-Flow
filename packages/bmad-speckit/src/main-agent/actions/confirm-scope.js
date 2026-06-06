const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function hasConfirmScopeSource(args) {
  return Boolean(args.source || args.sourceDocument || args.sourcePath);
}

function confirmScopeMissingReason(args) {
  if (!hasConfirmScopeSource(args)) {
    return 'confirm-scope requires --source <source-document.md>';
  }
  if (!args.confirmationText && !args.confirmationTextFile) {
    return 'confirm-scope requires --confirmation-text <exact chat confirmation> or --confirmation-text-file <file>';
  }
  return null;
}

function confirmScopeAction(context, runtimeState) {
  return {
    source:
      context.args.source || context.args.sourceDocument || context.args.sourcePath || null,
    confirmedBy: context.args.confirmedBy || 'main-agent-package-runtime',
    confirmedAt: context.args.confirmedAt || new Date().toISOString(),
    updateSource: context.args.updateSource === 'true',
    runtimeState,
  };
}

function stripWrappingQuotes(value) {
  return String(value ?? '').replace(/^["']|["']$/g, '');
}

function resolveProjectPath(root, value) {
  const normalized = stripWrappingQuotes(value);
  return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
}

function pushOptionalArg(out, flag, value, root, resolvePath = false) {
  if (value === undefined || value === null || value === '' || value === 'false') return;
  out.push(flag);
  out.push(resolvePath ? resolveProjectPath(root, value) : String(value));
}

function resolveConfirmScopeEntry(root) {
  const candidates = [
    path.join(root, '_bmad', 'skills', 'requirements-contract-authoring', 'scripts', 'confirm-requirements-scope.js'),
    path.join(__dirname, '..', '..', '_bmad', 'skills', 'requirements-contract-authoring', 'scripts', 'confirm-requirements-scope.js'),
    path.join(__dirname, '..', '..', '..', '_bmad', 'skills', 'requirements-contract-authoring', 'scripts', 'confirm-requirements-scope.js'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function parseJsonOrText(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function legacyConfirmScopeAction(context) {
  const args = context.args;
  const entry = resolveConfirmScopeEntry(context.cwd);
  if (!fs.existsSync(entry)) {
    throw new Error(`controlled confirmation entry missing: ${entry}`);
  }
  const source = args.source || args.sourceDocument || args.sourcePath;
  const delegatedArgs = ['--source', resolveProjectPath(context.cwd, source), '--json'];
  pushOptionalArg(delegatedArgs, '--render-report', args.renderReport, context.cwd, true);
  pushOptionalArg(delegatedArgs, '--confirmation-text', args.confirmationText, context.cwd);
  pushOptionalArg(delegatedArgs, '--confirmation-text-file', args.confirmationTextFile, context.cwd, true);
  pushOptionalArg(delegatedArgs, '--confirmed-by', args.confirmedBy || 'main-agent-orchestration', context.cwd);
  pushOptionalArg(delegatedArgs, '--confirmed-at', args.confirmedAt, context.cwd);
  pushOptionalArg(delegatedArgs, '--record-id', args.recordId, context.cwd);
  pushOptionalArg(delegatedArgs, '--requirement-set-id', args.requirementSetId, context.cwd);
  pushOptionalArg(delegatedArgs, '--runtime-root', args.runtimeRoot, context.cwd, true);
  pushOptionalArg(delegatedArgs, '--requirement-record', args.requirementRecord, context.cwd, true);
  pushOptionalArg(delegatedArgs, '--event-log', args.eventLog, context.cwd, true);
  pushOptionalArg(delegatedArgs, '--artifact-index', args.artifactIndex, context.cwd, true);
  pushOptionalArg(delegatedArgs, '--update-source', args.updateSource, context.cwd);

  const step = spawnSync(process.execPath, [entry, ...delegatedArgs], {
    cwd: context.cwd,
    encoding: 'utf8',
  });
  const parsedStdout = parseJsonOrText(step.stdout);
  const result = {
    ok: step.status === 0,
    action: 'confirm-scope',
    delegatedEntry: path.relative(context.cwd, entry).replace(/\\/g, '/'),
    exitCode: step.status ?? 2,
    ...(parsedStdout !== undefined ? { stdout: parsedStdout } : {}),
    ...(step.stderr.trim() ? { stderr: step.stderr.trim() } : {}),
  };
  if (context.legacyOrchestration || !context.json) return result;
  return parsedStdout && typeof parsedStdout === 'object' && !Array.isArray(parsedStdout)
    ? parsedStdout
    : result;
}

module.exports = {
  confirmScopeAction,
  confirmScopeMissingReason,
  hasConfirmScopeSource,
  legacyConfirmScopeAction,
};
