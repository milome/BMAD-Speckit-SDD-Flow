const {
  capturePackageOrchestration,
  emitPackageOrchestration,
} = require('./source-authority-orchestration');

function withoutRuntimeOnlyFlags(argv) {
  return argv.filter((arg) => {
    const value = String(arg || '');
    return (
      value !== '--legacy-orchestration' &&
      value !== '--legacyOrchestration' &&
      !value.startsWith('--legacy-orchestration=') &&
      !value.startsWith('--legacyOrchestration=')
    );
  });
}

function ensureCwd(argv, cwd) {
  if (argv.includes('--cwd') || argv.some((arg) => String(arg).startsWith('--cwd='))) return argv;
  return [...argv, '--cwd', cwd];
}

async function captureFullOrchestration(argv, cwd) {
  return capturePackageOrchestration(ensureCwd(withoutRuntimeOnlyFlags(argv), cwd), cwd);
}

async function emitFullOrchestration(context) {
  return emitPackageOrchestration({
    ...context,
    rootArgv: ensureCwd(withoutRuntimeOnlyFlags(context.rootArgv), context.cwd),
  });
}

module.exports = {
  captureFullOrchestration,
  emitFullOrchestration,
};
