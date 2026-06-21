'use strict';

const originalSource = "export interface DeferredGapGovernanceReport {\r\n  gaps: Array<Record<string, string>>;\r\n  explicit: boolean;\r\n  report_path: string;\r\n}\r\n\r\nexport function readDeferredGapsFromReport(reportPath: string): DeferredGapGovernanceReport;\r\n";

module.exports = {
  originalPath: "scripts/deferred-gap-governance.d.cts",
  originalSource,
};
