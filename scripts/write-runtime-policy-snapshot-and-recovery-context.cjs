require('ts-node/register/transpile-only');
const { mainWriteRuntimePolicySnapshotAndRecoveryContext } = require('./write-runtime-policy-snapshot-and-recovery-context.ts');

try {
  process.exitCode = mainWriteRuntimePolicySnapshotAndRecoveryContext(process.argv.slice(2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 2;
}
