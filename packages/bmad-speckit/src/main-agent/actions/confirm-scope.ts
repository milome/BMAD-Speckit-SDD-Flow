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
  const entry = path.join(
    __dirname,
    '..',
    'source-authority',
    'scripts',
    'requirements-contract-confirmation-acceptance.js'
  );
  if (!fs.existsSync(entry)) {
    throw new Error(`main-agent confirmation authority missing: ${entry}`);
  }
  const facade = require(entry);
  const result = facade.runRequirementsContractConfirmationAcceptance({
    root: context.cwd,
    args: {
      ...context.args,
      source:
        context.args.source || context.args.sourceDocument || context.args.sourcePath || undefined,
      confirmedBy: context.args.confirmedBy || 'main-agent-package-runtime',
      confirmedAt: context.args.confirmedAt || new Date().toISOString(),
    },
  });
  return {
    ...result,
    runtimeState: runtimeState || null,
  };
}

function legacyConfirmScopeAction(context) {
  const result = confirmScopeAction(context, null);
  return {
    ok: result.ok,
    action: 'confirm-scope',
    delegatedEntry: path
      .relative(
        context.cwd,
        path.join(
          __dirname,
          '..',
          'source-authority',
          'scripts',
          'requirements-contract-confirmation-acceptance.js'
        )
      )
      .replace(/\\/g, '/'),
    exitCode: result.exitCode ?? (result.ok === false ? 1 : 0),
    stdout: result,
    ...(result.error ? { stderr: result.error } : {}),
  };
}

module.exports = {
  confirmScopeAction,
  confirmScopeMissingReason,
  hasConfirmScopeSource,
  legacyConfirmScopeAction,
};
