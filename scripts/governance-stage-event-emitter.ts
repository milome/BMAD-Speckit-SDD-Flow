import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GovernanceJourneyContractHintProjection } from './governance-hook-types';

export interface GovernanceStageRerunResultEvent {
  type: 'governance-rerun-result';
  payload: {
    projectRoot: string;
    configPath?: string;
    journeyContractHints?: GovernanceJourneyContractHintProjection[];
    sourceEventType?: string;
    runnerInput: Record<string, unknown>;
    rerunGateResult?: Record<string, unknown>;
  };
}

function queueDir(projectRoot: string): string {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue');
}

function pendingEventDir(projectRoot: string): string {
  return path.join(queueDir(projectRoot), 'pending-events');
}

function sanitizeEventToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function buildGovernanceStageRerunResultEvent(input: {
  projectRoot: string;
  configPath?: string;
  journeyContractHints?: GovernanceJourneyContractHintProjection[];
  sourceEventType?: string;
  runnerInput: Record<string, unknown>;
  rerunGateResult?: Record<string, unknown>;
}): GovernanceStageRerunResultEvent {
  return {
    type: 'governance-rerun-result',
    payload: {
      projectRoot: input.projectRoot,
      ...(input.configPath ? { configPath: input.configPath } : {}),
      ...(input.journeyContractHints && input.journeyContractHints.length > 0
        ? { journeyContractHints: input.journeyContractHints }
        : {}),
      ...(input.sourceEventType ? { sourceEventType: input.sourceEventType } : {}),
      runnerInput: input.runnerInput,
      ...(input.rerunGateResult ? { rerunGateResult: input.rerunGateResult } : {}),
    },
  };
}

export function persistGovernanceStageRerunResultEvent(event: GovernanceStageRerunResultEvent): string {
  const projectRoot = event.payload.projectRoot;
  const dir = pendingEventDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });

  const runnerInput = event.payload.runnerInput ?? {};
  const rerunGate =
    typeof runnerInput.rerunGate === 'string' && runnerInput.rerunGate.trim() !== ''
      ? runnerInput.rerunGate
      : 'unknown-gate';
  const attemptId =
    typeof runnerInput.attemptId === 'string' && runnerInput.attemptId.trim() !== ''
      ? runnerInput.attemptId
      : 'unknown-attempt';

  const fileName = `${sanitizeEventToken(rerunGate)}--${sanitizeEventToken(attemptId)}--${Date.now()}.json`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(event, null, 2) + '\n', 'utf8');
  return filePath;
}
