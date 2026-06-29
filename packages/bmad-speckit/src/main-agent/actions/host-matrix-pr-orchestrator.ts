const { main } = require('../source-authority/scripts/main-agent-host-matrix-pr-orchestrator');

function hostMatrixPrOrchestratorAction(context) {
  const previousCwd = process.cwd();
  try {
    process.chdir(context.cwd);
    const exitCode = main(context.rawArgv.slice(1));
    return {
      exitCode,
      suppressStdout: true,
    };
  } finally {
    process.chdir(previousCwd);
  }
}

module.exports = {
  hostMatrixPrOrchestratorAction,
};
