import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  requirementRecordIndexPath,
  requirementRecordsRoot,
  resolveActiveRequirement,
} from '../../scripts/resolve-active-requirement';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { mainMainAgentOrchestration } from '../../scripts/main-agent-orchestration';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolved-runtime-context-'));
  fs.cpSync(path.join(process.cwd(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function writeRequirementRecord(overrides: Record<string, unknown> = {}): {
  recordPath: string;
  indexPath: string;
} {
  const requirementSetId = String(overrides.requirementSetId ?? 'REQSET-ACTIVE-001');
  const base = path.join(requirementRecordsRoot(root), requirementSetId);
  fs.mkdirSync(path.join(base, 'recovery'), { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  const record = {
    recordId: 'REQ-ACTIVE-001',
    requirementSetId,
    status: 'user_confirmed',
    flow: 'story',
    stage: 'implement',
    entryFlow: 'story',
    entryFlowClass: 'full_story_entry',
    workflowAdapter: 'bmad',
    sourceMode: 'full_bmad',
    sourcePath: 'docs/prd.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationPageHash:
      'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    epicId: 'epic-01',
    storyId: '1.1',
    runId: 'run-active-001',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-01/story-1.1',
    artifactPath: '_bmad-output/implementation-artifacts/epic-01/story-1.1/story.md',
    runtimePolicySnapshotRef: {
      path: `_bmad-output/runtime/requirement-records/${requirementSetId}/recovery/runtime-policy-snapshot.json`,
    },
    recoveryContextRef: {
      path: `_bmad-output/runtime/requirement-records/${requirementSetId}/recovery/recovery-context.json`,
    },
    implementationEntryGate: {
      gateName: 'implementation-readiness',
      requestedFlow: 'story',
      recommendedFlow: 'story',
      decision: 'pass',
      readinessStatus: 'ready_clean',
      blockerCodes: [],
      blockerSummary: [],
      rerouteRequired: false,
      rerouteReason: null,
      evidenceSources: {
        readinessReportPath: null,
        remediationArtifactPath: null,
        executionRecordPath: null,
        authoritativeAuditReportPath: null,
      },
      semanticFingerprint: 'story.md',
      evaluatedAt: '2026-05-19T00:00:00.000Z',
    },
    ...overrides,
  };
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(base, 'recovery', 'runtime-policy-snapshot.json'),
    '{"kind":"runtime-policy-snapshot"}\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(base, 'recovery', 'recovery-context.json'),
    '{"kind":"recovery-context"}\n',
    'utf8'
  );

  const indexPath = requirementRecordIndexPath(root);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    `${JSON.stringify(
      {
        version: 1,
        active: {
          recordId: record.recordId,
          requirementSetId,
          runId: record.runId,
        },
        records: [
          {
            recordId: record.recordId,
            requirementSetId,
            runId: record.runId,
            recordPath: path.relative(root, recordPath).replace(/\\/g, '/'),
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { recordPath, indexPath };
}

function captureStdout(fn: () => number): { code: number; stdout: string; stderr: string } {
  const chunks: string[] = [];
  const errors: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  const origError = console.error;
  process.stdout.write = (msg: string | Uint8Array) => {
    chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
    return true;
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(' '));
  };
  try {
    return { code: fn(), stdout: chunks.join(''), stderr: errors.join('\n') };
  } finally {
    process.stdout.write = origWrite;
    console.error = origError;
  }
}

describe('Active Requirement Resolver / ResolvedRuntimeContext', () => {
  it('resolves active requirement from requirement-records index without legacy project context', () => {
    const { recordPath, indexPath } = writeRequirementRecord();
    expect(fs.existsSync(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'))).toBe(false);

    const resolved = resolveActiveRequirement({ root });
    expect(resolved).toMatchObject({
      kind: 'ResolvedRuntimeContext',
      recordId: 'REQ-ACTIVE-001',
      requirementSetId: 'REQSET-ACTIVE-001',
      flow: 'story',
      stage: 'implement',
      runId: 'run-active-001',
      resolutionSource: 'index_active',
      runtimePolicySnapshotExists: true,
      recoveryContextExists: true,
    });
    expect(resolved.indexPath).toBe(indexPath);
    expect(resolved.recordPath).toBe(recordPath);
  });

  it('CLI fails closed on explicit record mismatch', () => {
    writeRequirementRecord();
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/ts-node/dist/bin.js',
        '--project',
        'tsconfig.node.json',
        '--transpile-only',
        'scripts/resolve-active-requirement.ts',
        '--cwd',
        root,
        '--record-id',
        'REQ-NOT-FOUND',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('resolve-active-requirement:');
    expect(result.stderr).toContain('recordId mismatch');
  });

  it('emit-runtime-policy reads flow/stage from ResolvedRuntimeContext, not legacy context', () => {
    writeRequirementRecord();
    const result = captureStdout(() => mainEmitRuntimePolicy(['--cwd', root]));

    expect(result.code, result.stderr).toBe(0);
    const policy = JSON.parse(result.stdout);
    expect(policy.flow).toBe('story');
    expect(policy.stage).toBe('implement');
    expect(policy.identity.storyId).toBe('1.1');
    expect(policy.identity.runId).toBe('run-active-001');
  });

  it('main-agent inspect uses requirement record implementation gate and orchestration hints', () => {
    writeRequirementRecord();
    const result = captureStdout(() =>
      mainMainAgentOrchestration(['--cwd', root, '--action', 'inspect'])
    );

    expect(result.code, result.stderr).toBe(0);
    const surface = JSON.parse(result.stdout);
    expect(surface.source).toBe('implementation_entry_gate');
    expect(surface.latestGate).toMatchObject({
      gateId: 'implementation-readiness',
      decision: 'pass',
    });
    expect(surface.mainAgentNextAction).toBe('dispatch_implement');
    expect(surface.mainAgentReady).toBe(true);
  });
});
