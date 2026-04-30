import * as path from 'node:path';

export type OrchestrationHost = 'cursor' | 'claude' | 'codex';
export type OrchestrationFlow = 'story' | 'bugfix' | 'standalone_tasks';
export type OrchestrationTaskType = 'implement' | 'audit' | 'remediate' | 'document';
export type PacketKind = 'recommendation' | 'execution' | 'resume';

export interface DispatchRoute {
  tool: string;
  subtype: string;
  fallback: string;
}

export interface RecommendationPacket {
  packetId: string;
  parentSessionId: string;
  flow: OrchestrationFlow;
  phase: string;
  recommendedRole: string;
  recommendedTaskType: OrchestrationTaskType;
  inputArtifacts: string[];
  allowedWriteScope: string[];
  expectedDelta: string;
  successCriteria: string[];
  stopConditions: string[];
  providerReasoning?: string | null;
}

export interface ExecutionPacket {
  packetId: string;
  parentSessionId: string;
  sourceRecommendationPacketId?: string | null;
  flow: OrchestrationFlow;
  phase: string;
  taskType: OrchestrationTaskType;
  role: string;
  inputArtifacts: string[];
  allowedWriteScope: string[];
  expectedDelta: string;
  successCriteria: string[];
  stopConditions: string[];
  downstreamConsumer?: string | null;
}

export interface ResumePacket {
  packetId: string;
  parentSessionId: string;
  originalExecutionPacketId: string;
  flow: OrchestrationFlow;
  phase: string;
  role: string;
  resumeReason: string;
  inputArtifacts: string[];
  allowedWriteScope: string[];
  expectedDelta: string;
  successCriteria: string[];
  stopConditions: string[];
}

export interface TaskReport {
  packetId: string;
  status: 'done' | 'blocked' | 'partial';
  filesChanged: string[];
  validationsRun: string[];
  evidence: string[];
  downstreamContext: string[];
  driftFlags?: string[];
}

export interface FallbackDecisionInput {
  interactive: boolean;
  transportAvailable: boolean;
  explicitFallbackRequested: boolean;
}

export function packetArtifactDir(projectRoot: string, sessionId: string): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'packets',
    sessionId
  );
}

export function packetArtifactPath(
  projectRoot: string,
  sessionId: string,
  packetId: string
): string {
  return path.join(packetArtifactDir(projectRoot, sessionId), `${packetId}.json`);
}

export function resolveDispatchRoute(
  host: OrchestrationHost,
  taskType: OrchestrationTaskType
): DispatchRoute {
  if (host === 'codex') {
    return {
      tool: 'codex',
      subtype: `worker:${taskType}`,
      fallback: 'disabled',
    };
  }

  if (host === 'cursor') {
    if (taskType === 'audit') {
      return {
        tool: 'Task',
        subtype: 'code-reviewer',
        fallback: 'mcp_task:generalPurpose',
      };
    }
    return {
      tool: 'mcp_task',
      subtype: 'generalPurpose',
      fallback: 'disabled',
    };
  }

  if (taskType === 'audit') {
    return {
      tool: 'Agent',
      subtype: 'code-reviewer',
      fallback: 'Agent:general-purpose',
    };
  }

  return {
    tool: 'Agent',
    subtype: 'general-purpose',
    fallback: 'disabled',
  };
}

export function fallbackAllowed(_input: FallbackDecisionInput): boolean {
  return false;
}

export function createExecutionPacket(input: ExecutionPacket): ExecutionPacket {
  return {
    ...input,
    sourceRecommendationPacketId: input.sourceRecommendationPacketId ?? null,
    downstreamConsumer: input.downstreamConsumer ?? null,
  };
}

export function createResumePacket(input: ResumePacket): ResumePacket {
  return { ...input };
}
