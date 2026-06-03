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

module.exports = {
  confirmScopeAction,
  confirmScopeMissingReason,
  hasConfirmScopeSource,
};
