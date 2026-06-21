const path = require('node:path');

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

function packageOrchestrationModule() {
  return require(path.join('..', 'source-authority', 'scripts', 'main-agent-orchestration.js'));
}

async function capturePackageOrchestration(argv, cwd) {
  const orchestration = packageOrchestrationModule();
  const forwardedArgv = ensureCwd(withoutRuntimeOnlyFlags(argv), cwd);
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = function writeStdout(chunk, ...rest) {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  process.stderr.write = function writeStderr(chunk, ...rest) {
    stderr += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  try {
    const exitCode = await orchestration.mainMainAgentOrchestrationAsync(forwardedArgv);
    return {
      exitCode: typeof exitCode === 'number' ? exitCode : 0,
      stdout,
      stderr,
      forwardedArgv,
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

async function emitPackageOrchestration(context) {
  const result = await capturePackageOrchestration(context.rootArgv, context.cwd);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.exitCode;
}

module.exports = {
  capturePackageOrchestration,
  emitPackageOrchestration,
};
