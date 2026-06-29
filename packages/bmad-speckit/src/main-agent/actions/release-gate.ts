const { mainReleaseGate } = require('../source-authority/scripts/main-agent-release-gate');

function releaseGateAction(context) {
  const previousCwd = process.cwd();
  try {
    process.chdir(context.cwd);
    const exitCode = mainReleaseGate(context.rawArgv.slice(1));
    return {
      exitCode,
      suppressStdout: true,
    };
  } finally {
    process.chdir(previousCwd);
  }
}

module.exports = {
  releaseGateAction,
};
