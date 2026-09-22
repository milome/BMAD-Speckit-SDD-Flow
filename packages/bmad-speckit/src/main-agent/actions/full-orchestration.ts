const {
  capturePackageOrchestration,
  emitPackageOrchestration,
} = require('./source-authority-orchestration');

function ensureCwd(argv, cwd) {
  if (argv.includes('--cwd') || argv.some((arg) => String(arg).startsWith('--cwd='))) return argv;
  return [...argv, '--cwd', cwd];
}

async function captureFullOrchestration(argv, cwd) {
  return capturePackageOrchestration(ensureCwd(argv, cwd), cwd);
}

async function emitFullOrchestration(context) {
  return emitPackageOrchestration({
    ...context,
    rootArgv: ensureCwd(context.rootArgv, context.cwd),
  });
}

module.exports = {
  captureFullOrchestration,
  emitFullOrchestration,
};
