import * as path from 'node:path';

type JsonObject = Record<string, unknown>;

export interface AiTddCloseoutRemediationInput {
  sourcePath: string;
  requirementRecordPath: string;
  closeoutAttemptId: string;
  runId: string;
  evidenceDir: string;
  projectRoot?: string;
}

export interface AiTddCloseoutRemediationPlan {
  adapter: 'main-agent-ai-tdd-closeout-remediation-adapter';
  lane: 'ai_tdd_closeout_remediation';
  status: 'dynamic_runner_required';
  runnerScript: string;
  runnerArgs: string[];
  forbiddenActions: string[];
}

function normalizePath(value: string): string {
  return path.normalize(value).replace(/\\/g, '/');
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized)
    throw new Error(`main-agent-ai-tdd-closeout-remediation-adapter:${field}_missing`);
  return normalized;
}

export function assertNoLocalRequiredCommandExecution(candidate: JsonObject = {}): void {
  const forbidden = [
    'executedRequiredCommands',
    'requiredCommandResults',
    'synthesizedDeliveryEvidence',
    'deliveryEvidence',
  ];
  for (const key of forbidden) {
    if (candidate[key] !== undefined) {
      throw new Error(`main-agent-ai-tdd-closeout-remediation-adapter:forbidden_${key}`);
    }
  }
}

export function remediateAiTddRequiredCommandEvidenceGap(
  input: AiTddCloseoutRemediationInput
): AiTddCloseoutRemediationPlan {
  const projectRoot = path.resolve(input.projectRoot ?? process.cwd());
  const runnerScript = normalizePath(
    path.join(projectRoot, 'scripts', 'run-required-commands-from-ai-tdd-manifest.ts')
  );
  const sourcePath = normalizePath(requireNonEmpty(input.sourcePath, 'sourcePath'));
  const requirementRecordPath = normalizePath(
    requireNonEmpty(input.requirementRecordPath, 'requirementRecordPath')
  );
  const closeoutAttemptId = requireNonEmpty(input.closeoutAttemptId, 'closeoutAttemptId');
  const runId = requireNonEmpty(input.runId, 'runId');
  const evidenceDir = normalizePath(requireNonEmpty(input.evidenceDir, 'evidenceDir'));

  return {
    adapter: 'main-agent-ai-tdd-closeout-remediation-adapter',
    lane: 'ai_tdd_closeout_remediation',
    status: 'dynamic_runner_required',
    runnerScript,
    runnerArgs: [
      '--source',
      sourcePath,
      '--requirement-record',
      requirementRecordPath,
      '--mode',
      'closeout',
      '--attempt-id',
      closeoutAttemptId,
      '--run-id',
      runId,
      '--evidence-dir',
      evidenceDir,
      '--json',
    ],
    forbiddenActions: [
      'execute_required_commands_locally',
      'synthesize_deliveryEvidence.requiredCommands',
      'repair_blocked_closeout_attempt_in_place',
    ],
  };
}
