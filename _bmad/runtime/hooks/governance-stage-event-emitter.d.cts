export interface GovernanceStageRerunResultEvent {
  type: 'governance-rerun-result';
  payload: {
    projectRoot: string;
    configPath?: string;
    journeyContractHints?: Array<Record<string, unknown>>;
    sourceEventType?: string;
    runnerInput: Record<string, unknown>;
    rerunGateResult?: Record<string, unknown>;
  };
}

export function buildGovernanceStageRerunResultEvent(input: {
  projectRoot: string;
  configPath?: string;
  journeyContractHints?: Array<Record<string, unknown>>;
  sourceEventType?: string;
  runnerInput: Record<string, unknown>;
  rerunGateResult?: Record<string, unknown>;
}): GovernanceStageRerunResultEvent;

export function persistGovernanceStageRerunResultEvent(
  event: GovernanceStageRerunResultEvent
): string;
