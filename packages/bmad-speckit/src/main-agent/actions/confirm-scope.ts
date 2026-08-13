const fs = require('node:fs');
const path = require('node:path');

const REQUIREMENTS_CONFIRMATION_REJECTION_CODES = new Set([
  'requirements_confirmation_exact_text_mismatch',
  'requirements_confirmation_promotion_stale',
  'requirements_confirmation_promotion_evidence_missing',
  'requirements_confirmation_promotion_evidence_stale',
  'requirements_confirmation_page_stale',
  'requirements_confirmation_page_missing',
  'requirements_confirmation_effective_pass_missing',
  'requirements_confirmation_effective_pass_invalid',
  'requirements_confirmation_request_id_invalid',
  'requirements_confirmation_not_confirmable',
  'citation_binding_stale',
]);

function hasConfirmScopeSource(args) {
  return Boolean(args.requestId || args.source || args.sourceDocument || args.sourcePath);
}

function confirmScopeMissingReason(args) {
  if (args.requestId) {
    if (!args.exactConfirmationText) {
      return 'confirm-scope requires --exact-confirmation-text with --request-id';
    }
    return null;
  }
  if (!hasConfirmScopeSource(args)) {
    return 'confirm-scope requires --request-id or --source <source-document.md>';
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
  if (context.args.requestId) {
    let result;
    try {
      result = facade.confirmRequirementsContractIrScope({
        projectRoot: context.cwd,
        requestId: context.args.requestId,
        exactConfirmationText: context.args.exactConfirmationText,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (!REQUIREMENTS_CONFIRMATION_REJECTION_CODES.has(code)) throw error;
      result = {
        ok: false,
        action: 'confirm-scope',
        status: 'confirmation_blocked',
        exitCode: 2,
        authority: 'main-agent-controlled-requirements-confirmation',
        requestId: context.args.requestId,
        mismatches: [code],
        error: code,
      };
    }
    return {
      ...result,
      runtimeState: runtimeState || null,
    };
  }
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
