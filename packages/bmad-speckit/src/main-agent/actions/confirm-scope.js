function hasConfirmScopeSource(args) {
  return Boolean(args.source || args.sourceDocument || args.sourcePath);
}

function confirmScopeMissingReason(args) {
  if (!hasConfirmScopeSource(args)) {
    return 'confirm-scope requires --source <source-document.md>';
  }
  return null;
}

module.exports = {
  confirmScopeMissingReason,
  hasConfirmScopeSource,
};
