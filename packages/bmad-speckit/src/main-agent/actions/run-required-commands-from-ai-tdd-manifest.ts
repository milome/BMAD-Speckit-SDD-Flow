const {
  mainRunRequiredCommandsFromAiTddManifest,
} = require('../source-authority/scripts/run-required-commands-from-ai-tdd-manifest');

function runRequiredCommandsFromAiTddManifestAction(context) {
  const argv = [
    ...context.positionals,
    ...Object.entries(context.args || {}).flatMap(([key, value]) =>
      value === undefined || value === false
        ? []
        : value === true
          ? [`--${key}`]
          : [`--${key}`, String(value)]
    ),
  ];
  const exitCode = mainRunRequiredCommandsFromAiTddManifest(argv);
  if (exitCode !== 0) {
    throw new Error(`run-required-commands-from-ai-tdd-manifest failed with exit code ${exitCode}`);
  }
  return {
    report: {
      reportType: 'run_required_commands_from_ai_tdd_manifest_package_runtime',
      generatedAt: new Date().toISOString(),
      action: 'run-required-commands-from-ai-tdd-manifest',
      cwd: context.cwd,
      mode: 'package_runtime_module',
      consumerRuntimeProof: {
        usedRootScript: false,
        usedCompiledFallback: false,
        usedTypeScriptRunner: false,
      },
    },
    reportPath: null,
  };
}

module.exports = {
  runRequiredCommandsFromAiTddManifestAction,
};
