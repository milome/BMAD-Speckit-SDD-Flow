export * from '../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

import { mainMainAgentOrchestrationAsync } from '../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

function isDirectMainAgentOrchestrationCli(entry: string | undefined): boolean {
  return /(^|[\\/])main-agent-orchestration(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

if (require.main === module && isDirectMainAgentOrchestrationCli(process.argv[1])) {
  void mainMainAgentOrchestrationAsync(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
