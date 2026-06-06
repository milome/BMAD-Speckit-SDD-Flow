const { mainAgentRuntimeCommand } = require('./runtime');

module.exports = {
  mainAgentRuntimeCommand,
};

if (require.main === module) {
  Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2)))
    .then((code) => {
      process.exitCode = code ?? 0;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
