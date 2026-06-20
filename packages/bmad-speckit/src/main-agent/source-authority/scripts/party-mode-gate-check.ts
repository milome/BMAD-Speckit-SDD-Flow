import { runCli } from './party-mode-runtime';

export { runCli } from './party-mode-runtime';

if (require.main === module) {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
