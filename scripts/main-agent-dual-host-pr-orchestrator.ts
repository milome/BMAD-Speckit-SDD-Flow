// Legacy compatibility entry. New callers must use main-agent-host-matrix-pr-orchestrator.ts.
export {
  runHostMatrixPrOrchestration as runDualHostPrOrchestration,
  main,
} from './main-agent-host-matrix-pr-orchestrator';

if (require.main === module) {
  const { main } = require('./main-agent-host-matrix-pr-orchestrator');
  process.exitCode = main(process.argv.slice(2));
}
