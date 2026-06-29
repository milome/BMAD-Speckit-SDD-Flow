const { main } = require('../source-authority/scripts/main-agent-delivery-truth-gate');

function runtimeArgsFromContext(context) {
  const argv = [];
  for (const [key, value] of Object.entries(context.args || {})) {
    if (key === 'action') continue;
    argv.push(`--${key}`);
    argv.push(String(value));
  }
  return argv;
}

function deliveryTruthGateAction(context) {
  const previousCwd = process.cwd();
  try {
    process.chdir(context.cwd);
    const exitCode = main(runtimeArgsFromContext(context));
    return {
      exitCode,
      suppressStdout: true,
    };
  } finally {
    process.chdir(previousCwd);
  }
}

module.exports = {
  deliveryTruthGateAction,
};
