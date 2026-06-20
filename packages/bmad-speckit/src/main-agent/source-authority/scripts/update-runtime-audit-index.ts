/* eslint-disable no-console */

import { syncAuditIndexFromReport, readRuntimeContextRegistry } from './runtime-context-registry';

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--projectRoot' && argv[i + 1]) {
      out.projectRoot = argv[++i];
    } else if (token === '--reportPath' && argv[i + 1]) {
      out.reportPath = argv[++i];
    }
  }
  return out;
}

export function mainUpdateRuntimeAuditIndex(argv: string[]): number {
  const args = parseArgs(argv);
  const projectRoot = args.projectRoot?.trim();
  const reportPath = args.reportPath?.trim();

  if (!projectRoot || !reportPath) {
    console.error(
      'update-runtime-audit-index: usage --projectRoot <path> --reportPath <audit-report-path>'
    );
    return 1;
  }

  try {
    syncAuditIndexFromReport(projectRoot, reportPath);
    const registry = readRuntimeContextRegistry(projectRoot);
    process.stdout.write(JSON.stringify({ updated: true, auditIndex: registry.auditIndex }));
    return 0;
  } catch (error) {
    console.error(
      `update-runtime-audit-index: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }
}

function isDirectUpdateRuntimeAuditIndexCli(entry: string | undefined): boolean {
  return /(^|[\\/])update-runtime-audit-index(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

if (require.main === module && isDirectUpdateRuntimeAuditIndexCli(process.argv[1])) {
  process.exit(mainUpdateRuntimeAuditIndex(process.argv.slice(2)));
}
