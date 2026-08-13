import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import type { DeterministicJudgeProvider } from './openai-compatible-judge-provider';

export const REPOSITORY_ROOT = process.cwd();
export const REQUIREMENTS_CLI = path.join(
  REPOSITORY_ROOT,
  'packages',
  'bmad-speckit',
  'bin',
  'bmad-speckit.js'
);
export const REQUIREMENTS_FIXTURE_ROOT = path.join(
  REPOSITORY_ROOT,
  'tests',
  'e2e',
  'fixtures',
  'requirements-contract',
  'batch-refund-consumer'
);

export type JsonRecord = Record<string, unknown>;
export type CliEnvelope = JsonRecord & { data: JsonRecord };

export interface SpawnedMainAgentResult {
  code: number | null;
  stdout: string;
  stderr: string;
  envelope: CliEnvelope | null;
}

export interface MainAgentCommandEvidence extends SpawnedMainAgentResult {
  action: string;
  args: string[];
}

export function createRequirementsConsumerRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-e2e-'));
  fs.cpSync(REQUIREMENTS_FIXTURE_ROOT, root, { recursive: true });
  return root;
}

export function removeRequirementsConsumerRoot(root: string): void {
  fs.rmSync(root, { force: true, recursive: true });
}

export function spawnMainAgentResult(
  root: string,
  action: string,
  args: string[]
): Promise<SpawnedMainAgentResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [REQUIREMENTS_CLI, 'main-agent', action, '--cwd', root, ...args, '--json'],
      { cwd: REPOSITORY_ROOT, windowsHide: true }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      let envelope: CliEnvelope | null = null;
      try {
        envelope = stdout.trim() ? (JSON.parse(stdout) as CliEnvelope) : null;
      } catch {
        envelope = null;
      }
      resolve({ code, stdout, stderr, envelope });
    });
  });
}

export async function spawnMainAgent(
  root: string,
  action: string,
  args: string[]
): Promise<CliEnvelope> {
  const result = await spawnMainAgentResult(root, action, args);
  if (result.code !== 0 || !result.envelope) {
    throw new Error(
      `main-agent ${action} exited ${result.code}: ${result.stderr || result.stdout}`
    );
  }
  return result.envelope;
}

export function installJudgeRuntime(root: string, baseUrl: string): void {
  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'config', 'private'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad', 'shared', 'requirements-contract', 'judge-prompts'), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(
      REPOSITORY_ROOT,
      '_bmad',
      'shared',
      'requirements-contract',
      'judge-prompts',
      'requirements-contract-critical-auditor.prompt.md'
    ),
    path.join(
      root,
      '_bmad',
      'shared',
      'requirements-contract',
      'judge-prompts',
      'requirements-contract-critical-auditor.prompt.md'
    )
  );
  fs.writeFileSync(
    path.join(root, '_bmad', '_config', 'governance-remediation.yaml'),
    yaml.dump({
      judgeRuntime: {
        schemaVersion: 'requirements-contract-judge-runtime/v1',
        enabled: true,
        activeProviderRef: 'deterministic-local-judge',
        promptConfig: {
          systemPromptPath:
            '_bmad/shared/requirements-contract/judge-prompts/requirements-contract-critical-auditor.prompt.md',
          outputTokenReserve: 4096,
        },
        selectionPolicy: {
          mode: 'contract_locked',
          runtimeFallbackAllowed: false,
          runtimeAutoDiscoveryAllowed: false,
          environmentOverrideAllowed: false,
          cliTransportAllowed: false,
          selectionReceiptRequired: true,
        },
        credentialConfig: {
          source: 'config_file',
          path: '_bmad-output/config/private/judge-provider.credentials.yaml',
          schemaVersion: 'requirements-contract-judge-credentials/v1',
          allowedRoot: '_bmad-output/config/private',
          environmentFallbackAllowed: false,
        },
        providers: {
          'deterministic-local-judge': {
            enabled: true,
            transport: 'openai-compatible',
            apiStyle: 'chat_completions',
            model: 'deterministic-requirements-judge',
            credentialRef: 'deterministic-local-credential',
            endpoint: {
              baseUrl,
              resolutionMode: 'transport_managed',
              routingOwnership: 'transport_adapter',
              upstreamVersioning: 'gateway_managed',
              explicitOperationPath: null,
            },
            authentication: {
              type: 'bearer',
              sensitivity: 'secret',
              arbitraryNonEmptyValueAllowed: false,
            },
            auditPolicy: {
              independenceClass: 'deterministic_protocol',
              blindReview: true,
              allowPassAuthority: false,
              toolsAllowed: false,
              implementationWritesAllowed: false,
            },
            requestPolicy: {
              timeoutMs: 10000,
              maximumAttempts: 1,
              structuredResponseRequired: true,
            },
          },
        },
      },
    }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'config', 'private', 'judge-provider.credentials.yaml'),
    yaml.dump({
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      credentialRevision: 1,
      providers: {
        'deterministic-local-credential': {
          authenticationType: 'bearer',
          apiKey: 'deterministic-e2e-secret',
        },
      },
    }),
    'utf8'
  );
}

function approvedAuthorities(): Map<string, unknown> {
  const approved = JSON.parse(
    fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        'tests',
        'e2e',
        'fixtures',
        'requirements-contract',
        'batch-refund-user-authority.user-approved.json'
      ),
      'utf8'
    )
  ) as { authorities: Array<{ fieldKey: string; value: unknown }> };
  return new Map(approved.authorities.map((authority) => [authority.fieldKey, authority.value]));
}

export async function advanceToUserConfirmable(
  consumerRoot: string,
  provider: DeterministicJudgeProvider
): Promise<CliEnvelope> {
  const envelope = await advanceThroughRequirementsGrill(consumerRoot);
  if (provider.requests.length !== 1) {
    throw new Error(`expected one Judge request, received ${provider.requests.length}`);
  }
  return envelope;
}

export async function advanceThroughRequirementsGrill(
  consumerRoot: string,
  onCommand?: (evidence: MainAgentCommandEvidence) => void
): Promise<CliEnvelope> {
  const run = async (action: string, args: string[]): Promise<CliEnvelope> => {
    const result = await spawnMainAgentResult(consumerRoot, action, args);
    onCommand?.({ action, args, ...result });
    if (result.code !== 0 || !result.envelope) {
      throw new Error(
        `main-agent ${action} exited ${result.code}: ${result.stderr || result.stdout}`
      );
    }
    return result.envelope;
  };
  let envelope = await run('author-confirmation-ready-source', [
    '--intake-source',
    'requirements.md',
    '--target-source',
    'docs/refund-batch-requirements.md',
    '--confirmation-language',
    'zh-CN',
  ]);
  const approvedByField = approvedAuthorities();
  while (envelope.status === 'business_decision_required') {
    const requestId = envelope.data.authoringRequestId as string;
    const grillSessionId = envelope.data.grillSessionId as string;
    const recordRoot = path.join(
      consumerRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requestId
    );
    const session = JSON.parse(
      fs.readFileSync(
        path.join(
          recordRoot,
          'authoring',
          'decisions',
          'sessions',
          grillSessionId,
          'session.json'
        ),
        'utf8'
      )
    ) as JsonRecord;
    const frontier = envelope.data.frontier as string[];
    const answers = frontier.map((questionId) => {
      const question = session.questions.find(
        (candidate: JsonRecord) => candidate.questionId === questionId
      ) as JsonRecord;
      if (!question || question.affectedFieldIds.length !== 1) {
        throw new Error(`invalid E2E Grill question ${questionId}`);
      }
      const fieldKey = question.affectedFieldIds[0] as string;
      if (!approvedByField.has(fieldKey)) {
        throw new Error(`No approved authority for ${fieldKey}`);
      }
      return {
        questionId,
        questionVersion: question.questionVersion,
        answerValue: approvedByField.get(fieldKey),
      };
    });
    const answersPath = path.join(consumerRoot, `answers-${frontier.join('-')}.json`);
    fs.writeFileSync(
      answersPath,
      JSON.stringify({ schemaVersion: 'requirements-grill-answers/v1', answers }),
      'utf8'
    );
    envelope = await run('submit-requirements-grill-response', [
      '--request-id',
      requestId,
      '--grill-session-id',
      grillSessionId,
      '--answers',
      answersPath,
    ]);
  }
  return envelope;
}
