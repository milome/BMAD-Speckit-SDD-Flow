const { mainDeliveryEvidenceRun } = require('../source-authority/scripts/main-agent-delivery-evidence-run');

function deliveryEvidenceRunAction(context) {
  const previousCwd = process.cwd();
  try {
    process.chdir(context.cwd);
    const exitCode = mainDeliveryEvidenceRun(context.rawArgv.slice(1));
    return {
      exitCode,
      suppressStdout: true,
    };
  } finally {
    process.chdir(previousCwd);
  }
}

module.exports = {
  deliveryEvidenceRunAction,
};
