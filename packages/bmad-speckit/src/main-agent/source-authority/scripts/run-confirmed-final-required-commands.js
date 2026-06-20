/* eslint-disable no-console */

const DYNAMIC_RUNNER = 'scripts/run-required-commands-from-ai-tdd-manifest.ts';

function main(argv) {
  const json = argv.includes('--json');
  const output = {
    ok: false,
    tombstone: true,
    legacyEvidenceOnly: true,
    notCompletionAuthority: true,
    message:
      'run-confirmed-final-required-commands.js is a non-executing tombstone. Use scripts/run-required-commands-from-ai-tdd-manifest.ts.',
    replacement: DYNAMIC_RUNNER,
  };
  process.stdout.write(json ? `${JSON.stringify(output, null, 2)}\n` : `${output.message}\n`);
  return 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, DYNAMIC_RUNNER };
