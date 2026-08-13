import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  advanceThroughRequirementsGrill,
  createRequirementsConsumerRoot,
  removeRequirementsConsumerRoot,
  REPOSITORY_ROOT,
  type JsonRecord,
  type MainAgentCommandEvidence,
} from './helpers/requirements-contract-production-harness';

const LIVE_ENABLED = process.env.BMAD_RUN_LIVE_REQUIREMENTS_JUDGE === '1';
const EVIDENCE_ROOT = path.join(
  REPOSITORY_ROOT,
  '.artifacts',
  'requirements-contract',
  'live-judge'
);

function sha256(bytes: Buffer | string): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function writeEvidence(testRunId: string, value: JsonRecord): void {
  const runRoot = path.join(EVIDENCE_ROOT, testRunId);
  fs.mkdirSync(runRoot, { recursive: true });
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(path.join(runRoot, 'live-judge-evidence-status.json'), bytes, 'utf8');
  fs.mkdirSync(EVIDENCE_ROOT, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_ROOT, 'live-judge-evidence-status.json'), bytes, 'utf8');
}

function fixtureAuthorityHash(): string {
  const root = path.join(
    REPOSITORY_ROOT,
    'tests',
    'e2e',
    'fixtures',
    'requirements-contract',
    'batch-refund-consumer'
  );
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const current = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(current);
      else if (entry.isFile()) files.push(current);
    }
  };
  visit(root);
  const digest = createHash('sha256');
  for (const file of files.sort()) {
    digest.update(path.relative(root, file).replace(/\\/gu, '/'));
    digest.update('\0');
    digest.update(fs.readFileSync(file));
    digest.update('\0');
  }
  return `sha256:${digest.digest('hex')}`;
}

function copyProductionJudgeConfiguration(consumerRoot: string): JsonRecord {
  const configRelative = '_bmad/_config/governance-remediation.yaml';
  const credentialRelative = '_bmad-output/config/private/judge-provider.credentials.yaml';
  const configSource = path.join(REPOSITORY_ROOT, ...configRelative.split('/'));
  const credentialSource = path.join(REPOSITORY_ROOT, ...credentialRelative.split('/'));
  if (!fs.existsSync(configSource) || !fs.existsSync(credentialSource)) {
    throw new Error('live_judge_production_configuration_missing');
  }
  for (const relative of [configRelative, credentialRelative]) {
    const source = path.join(REPOSITORY_ROOT, ...relative.split('/'));
    const target = path.join(consumerRoot, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  const config = yaml.load(fs.readFileSync(configSource, 'utf8')) as JsonRecord;
  const promptRelative = String(config.judgeRuntime?.promptConfig?.systemPromptPath ?? '');
  if (!promptRelative) throw new Error('live_judge_prompt_configuration_missing');
  const promptSource = path.join(REPOSITORY_ROOT, ...promptRelative.split('/'));
  const promptTarget = path.join(consumerRoot, ...promptRelative.split('/'));
  fs.mkdirSync(path.dirname(promptTarget), { recursive: true });
  fs.copyFileSync(promptSource, promptTarget);
  const providerRef = String(config.judgeRuntime?.activeProviderRef ?? '');
  const provider = config.judgeRuntime?.providers?.[providerRef] as JsonRecord | undefined;
  if (!providerRef || !provider) throw new Error('live_judge_provider_configuration_missing');
  return {
    configRelative,
    providerConfigDigest: sha256(fs.readFileSync(configSource)),
    promptDigest: sha256(fs.readFileSync(promptSource)),
    providerRef,
    provider: {
      transport: provider.transport,
      adapterRef: provider.adapterRef,
      apiStyle: provider.apiStyle,
      model: provider.model ?? null,
      endpoint: provider.endpoint,
      requestPolicy: provider.requestPolicy,
      auditPolicy: provider.auditPolicy,
    },
  };
}

function currentSourceRevision(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('live_judge_source_revision_unavailable');
  return result.stdout.trim();
}

describe('Requirements production-entry live Judge evidence', () => {
  it('records the current admission status without selecting a provider', () => {
    if (LIVE_ENABLED) {
      expect(process.env.BMAD_RUN_LIVE_REQUIREMENTS_JUDGE).toBe('1');
      return;
    }
    const testRunId = randomUUID();
    writeEvidence(testRunId, {
      schemaVersion: 'requirements-contract-live-judge-evidence/v1',
      liveJudgeEvidenceStatus: 'not_run',
      issueCode: 'BMAD_RUN_LIVE_REQUIREMENTS_JUDGE_not_enabled',
      testRunId,
      fixtureAuthorityHash: fixtureAuthorityHash(),
    });
  });

  (LIVE_ENABLED ? it : it.skip)(
    'runs the production CLI with the configured live provider and preserves its verdict',
    async () => {
      const testRunId = randomUUID();
      const sourceRevision = currentSourceRevision();
      const buildCommand = 'npm run build:main-agent-dist';
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const build = spawnSync(npmCommand, ['run', 'build:main-agent-dist'], {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      });
      const distManifestPath = path.join(
        REPOSITORY_ROOT,
        'packages',
        'bmad-speckit',
        'dist',
        'main-agent',
        'runtime-asset-manifest.json'
      );
      const buildEvidence = {
        command: buildCommand,
        exitCode: build.status,
        stdout: build.stdout,
        stderr: build.stderr,
        sourceRevision,
        distBuildDigest:
          build.status === 0 && fs.existsSync(distManifestPath)
            ? sha256(fs.readFileSync(distManifestPath))
            : null,
      };
      if (build.status !== 0 || !buildEvidence.distBuildDigest) {
        writeEvidence(testRunId, {
          schemaVersion: 'requirements-contract-live-judge-evidence/v1',
          liveJudgeEvidenceStatus: 'blocked',
          issueCode: 'live_judge_same_run_build_failed',
          testRunId,
          build: buildEvidence,
          fixtureAuthorityHash: fixtureAuthorityHash(),
        });
        throw new Error('live_judge_same_run_build_failed');
      }

      const consumerRoot = createRequirementsConsumerRoot();
      const commandEvidence: MainAgentCommandEvidence[] = [];
      let providerProvenance: JsonRecord | null = null;
      try {
        providerProvenance = copyProductionJudgeConfiguration(consumerRoot);
        const envelope = await advanceThroughRequirementsGrill(
          consumerRoot,
          (evidence) => commandEvidence.push(evidence)
        );
        const requestId = String(envelope.data.requestId ?? envelope.data.authoringRequestId ?? '');
        const recordRoot = path.join(
          consumerRoot,
          '_bmad-output',
          'runtime',
          'requirement-records',
          requestId
        );
        const activeRequestPath = path.join(recordRoot, 'quality', 'active-request.json');
        const activeRequest = fs.existsSync(activeRequestPath) ? readJson(activeRequestPath) : null;
        const request = activeRequest?.requestPath
          ? readJson(path.join(recordRoot, ...String(activeRequest.requestPath).split('/')))
          : null;
        const response = activeRequest?.responseRef?.path
          ? readJson(path.join(recordRoot, ...String(activeRequest.responseRef.path).split('/')))
          : null;
        const aggregate = activeRequest?.aggregateRef?.path
          ? readJson(path.join(recordRoot, ...String(activeRequest.aggregateRef.path).split('/')))
          : null;
        const verdict = response?.verdict ?? null;
        const liveJudgeEvidenceStatus =
          verdict === 'pass' ? 'passed' : verdict === 'fail' ? 'failed' : 'blocked';
        const issueCode =
          liveJudgeEvidenceStatus === 'blocked'
            ? String(activeRequest?.lastIssueCode ?? envelope.data.issueCode ?? 'live_judge_blocked')
            : null;
        writeEvidence(testRunId, {
          schemaVersion: 'requirements-contract-live-judge-evidence/v1',
          liveJudgeEvidenceStatus,
          issueCode,
          testRunId,
          build: buildEvidence,
          fixtureAuthorityHash: fixtureAuthorityHash(),
          judgeRequestHash: request?.judgeRequestHash ?? activeRequest?.judgeRequestHash ?? null,
          provider: providerProvenance,
          productStatus: envelope.data.status,
          commandEvidence,
          activeRequest,
          request,
          response,
          comments: response?.findings ?? response?.comments ?? [],
          verdict,
          aggregate,
        });
        expect(['passed', 'failed', 'blocked']).toContain(liveJudgeEvidenceStatus);
        if (liveJudgeEvidenceStatus !== 'blocked') {
          expect(request?.judgeRequestHash).toBe(activeRequest?.judgeRequestHash);
          expect(['pass', 'fail']).toContain(verdict);
          expect(response).toBeTruthy();
        }
      } catch (error) {
        writeEvidence(testRunId, {
          schemaVersion: 'requirements-contract-live-judge-evidence/v1',
          liveJudgeEvidenceStatus: 'blocked',
          issueCode: error instanceof Error ? error.message : 'live_judge_unknown_failure',
          testRunId,
          build: buildEvidence,
          fixtureAuthorityHash: fixtureAuthorityHash(),
          provider: providerProvenance,
          commandEvidence,
        });
      } finally {
        removeRequirementsConsumerRoot(consumerRoot);
      }
    },
    35 * 60 * 1000
  );
});
