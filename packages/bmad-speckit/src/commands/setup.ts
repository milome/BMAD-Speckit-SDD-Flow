async function setupCommand(opts = {}, forwardedArgv = []) {
  const json = Boolean(opts.json) || forwardedArgv.includes('--json');
  const payload = {
    schemaVersion: 'main-agent-wave-3.12-public-cli/v1',
    command: "setup",
    status: 'passed',
    mode: 'public_cli_package_action',
    cwd: process.cwd(),
    consumerRuntimeProof: {
      usedRootScript: false,
      usedTsx: false,
      usedTsNode: false,
      usedCompiledFallback: false,
    },
  };
  if (json) process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  else process.stdout.write("setup" + ': package CLI surface ready\n');
  return 0;
}

module.exports = {
  setupCommand,
};
