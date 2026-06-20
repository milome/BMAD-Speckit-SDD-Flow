"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = exports.runDualHostPrOrchestration = void 0;
// Legacy compatibility entry. New callers must use main-agent-host-matrix-pr-orchestrator.ts.
var main_agent_host_matrix_pr_orchestrator_1 = require("./main-agent-host-matrix-pr-orchestrator");
Object.defineProperty(exports, "runDualHostPrOrchestration", { enumerable: true, get: function () { return main_agent_host_matrix_pr_orchestrator_1.runHostMatrixPrOrchestration; } });
Object.defineProperty(exports, "main", { enumerable: true, get: function () { return main_agent_host_matrix_pr_orchestrator_1.main; } });
if (require.main === module) {
    const { main } = require('./main-agent-host-matrix-pr-orchestrator');
    process.exitCode = main(process.argv.slice(2));
}
