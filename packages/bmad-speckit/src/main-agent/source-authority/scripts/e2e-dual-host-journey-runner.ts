// Legacy compatibility entry. New callers must use e2e-host-matrix-journey-runner.ts.
export { runHostMatrixJourneyRunner as runDualHostJourneyRunner } from './e2e-host-matrix-journey-runner';

if (require.main === module) {
  const { runHostMatrixJourneyRunner } = require('./e2e-host-matrix-journey-runner');
  process.exit(runHostMatrixJourneyRunner(process.argv.slice(2)));
}
