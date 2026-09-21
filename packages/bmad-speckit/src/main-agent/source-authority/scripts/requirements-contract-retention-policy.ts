export interface RequirementsContractRetentionPolicy {
  warningBytes: number;
  maxDurableBytes: number;
  orphanTtlMs: number;
  retainedPredecessorBuilds: number;
  retainedFailureSummaries: number;
  maxJudgeInvocationsPerOperation: number;
  maxAutomaticRepairsPerOperation: number;
}

export const DEFAULT_REQUIREMENTS_CONTRACT_RETENTION_POLICY: RequirementsContractRetentionPolicy = {
  warningBytes: 24 * 1024 * 1024,
  maxDurableBytes: 32 * 1024 * 1024,
  orphanTtlMs: 24 * 60 * 60 * 1000,
  retainedPredecessorBuilds: 1,
  retainedFailureSummaries: 1,
  maxJudgeInvocationsPerOperation: 2,
  maxAutomaticRepairsPerOperation: 1,
};
