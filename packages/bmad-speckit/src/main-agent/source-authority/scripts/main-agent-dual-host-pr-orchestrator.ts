// Legacy compatibility entry. New callers must use main-agent-host-matrix-pr-orchestrator.ts.
import { main as runHostMatrixPrMain } from './main-agent-host-matrix-pr-orchestrator';

export {
  runHostMatrixPrOrchestration as runDualHostPrOrchestration,
  main,
} from './main-agent-host-matrix-pr-orchestrator';

if (require.main === module) {
  process.exitCode = runHostMatrixPrMain(process.argv.slice(2));
}
