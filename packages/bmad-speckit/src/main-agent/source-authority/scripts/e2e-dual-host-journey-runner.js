"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDualHostJourneyRunner = void 0;
// Legacy compatibility entry. New callers must use e2e-host-matrix-journey-runner.ts.
var e2e_host_matrix_journey_runner_1 = require("./e2e-host-matrix-journey-runner");
Object.defineProperty(exports, "runDualHostJourneyRunner", { enumerable: true, get: function () { return e2e_host_matrix_journey_runner_1.runHostMatrixJourneyRunner; } });
if (require.main === module) {
    const { runHostMatrixJourneyRunner } = require('./e2e-host-matrix-journey-runner');
    process.exit(runHostMatrixJourneyRunner(process.argv.slice(2)));
}
