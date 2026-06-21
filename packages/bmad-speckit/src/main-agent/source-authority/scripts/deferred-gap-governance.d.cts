export interface DeferredGapGovernanceReport {
  gaps: Array<Record<string, string>>;
  explicit: boolean;
  report_path: string;
}

export function readDeferredGapsFromReport(reportPath: string): DeferredGapGovernanceReport;
