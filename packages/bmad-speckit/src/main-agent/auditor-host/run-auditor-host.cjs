#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args.positional.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: bmad-speckit run-auditor-host --projectRoot <path> --stage <stage> --artifactPath <path>',
      '',
      'Runs the package-owned auditor host runtime probe.',
      'This command does not require a source repository checkout.',
      '',
    ].join('\n')
  );
}

function resolveProjectPath(projectRoot, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const projectRoot = path.resolve(String(args.projectRoot || args.cwd || process.cwd()));
  const stage = String(args.stage || 'implement');
  const artifactPath = resolveProjectPath(projectRoot, args.artifactPath);
  const reportPath = resolveProjectPath(projectRoot, args.reportPath);
  const reportExists = reportPath ? fs.existsSync(reportPath) : false;
  const result = {
    schemaVersion: 'main-agent-auditor-host-runtime/v1',
    action: 'run-auditor-host',
    cwd: projectRoot,
    status: reportExists || !args.reportPath ? 'ready' : 'report_missing',
    exitCode: 0,
    errors: [],
    data: {
      stage,
      artifactPath,
      reportPath,
      reportExists,
      mode: 'package_owned_runtime_output',
    },
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`run-auditor-host: ${result.status}\n`);
  }
  return 0;
}

module.exports = {
  main,
  parseArgs,
};

if (require.main === module) {
  process.exitCode = main();
}
