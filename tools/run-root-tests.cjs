const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const isWindows = process.platform === 'win32';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: isWindows,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  process.exitCode = result.status ?? 1;
  return process.exitCode === 0;
}

function runOrExit(command, commandArgs) {
  if (!run(command, commandArgs)) {
    process.exit(process.exitCode ?? 1);
  }
}

if (args.length > 0) {
  runOrExit('npx', ['vitest', 'run', ...args]);
  process.exit(0);
}

runOrExit('npm', ['run', 'test:governance-fixtures']);
runOrExit('npm', ['run', 'test:vitest:default']);
runOrExit('npm', ['run', 'test:bmad-speckit']);
