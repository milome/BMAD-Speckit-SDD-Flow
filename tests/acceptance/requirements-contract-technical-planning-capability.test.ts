import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveRequirementsTechnicalPlanningCapability,
  validateRequirementsTechnicalPlanningCapabilityResult,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-technical-planning-capability';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const capabilityHash = sha256Stable('technical-planning-capability');
const configHash = sha256Stable('technical-planning-config');
const premiseHash = sha256Stable('technical-planning-premises');

function runProductionAuthor(root: string, semanticBody: Record<string, unknown>) {
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  const intakePath = path.join(root, 'intake.md');
  const targetPath = path.join(root, 'requirements.md');
  writeFileSync(intakePath, [
    '---',
    'authoritySources:',
    '  - path: docs/functional.json',
    '    rootClass: functional_requirement',
    '    proposedAuthorityClass: source_authority',
    '    bodySchemaVersion: requirement-contract-requirement/v2',
    '---',
    '# Requirements',
    '',
  ].join('\n'), 'utf8');
  writeFileSync(path.join(root, 'docs', 'functional.json'), JSON.stringify({
    schemaVersion: 'requirements-contract-authority-source/v1',
    sourceRootId: 'MUST-FR-TECHNICAL-001',
    semanticBody,
  }), 'utf8');
  return spawnSync(process.execPath, [
    path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
    'main-agent',
    'author-confirmation-ready-source',
    '--cwd',
    root,
    '--intake-source',
    intakePath,
    '--target-source',
    targetPath,
    '--confirmation-language',
    'en-US',
    '--json',
  ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
}

function runProductionResume(root: string, requestId: string, authoringAttemptId: string) {
  return spawnSync(process.execPath, [
    path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
    'main-agent',
    'resume-author-confirmation-ready-source',
    '--cwd',
    root,
    '--request-id',
    requestId,
    '--authoring-attempt-id',
    authoringAttemptId,
    '--json',
  ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
}

function productionAttemptDir(root: string, requestId: string): string {
  const stagingRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requestId,
    'authoring',
    'staging'
  );
  const attempts = readdirSync(stagingRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  expect(attempts).toHaveLength(1);
  return path.join(stagingRoot, attempts[0]);
}

describe('requirements contract technical planning capability', () => {
  it('returns a stable resumable cp02 checkpoint when capability is unavailable', () => {
    const input = {
      authoringRequestId: 'request-technical-planning',
      authoringAttemptId: 'attempt-technical-planning',
      checkpointId: 'cp02' as const,
      capability: {
        capabilityId: 'repository-technical-planner',
        status: 'unavailable' as const,
        capabilityHash,
        configHash,
      },
      premiseHash,
      candidates: [],
    };

    const first = resolveRequirementsTechnicalPlanningCapability(input);
    const replay = resolveRequirementsTechnicalPlanningCapability(input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      schemaVersion: 'requirements-contract-technical-planning-capability/v1',
      status: 'technical_planning_pending',
      issueCode: 'requirements_technical_planning_pending',
      checkpointId: 'cp02',
      resumable: true,
      executionRegistry: null,
    });
    expect(validateRequirementsTechnicalPlanningCapabilityResult(first)).toBe(true);
  });

  it('closes cp02 with a canonical typed execution registry when capability is available', () => {
    const result = resolveRequirementsTechnicalPlanningCapability({
      authoringRequestId: 'request-technical-planning',
      authoringAttemptId: 'attempt-technical-planning',
      checkpointId: 'cp02',
      capability: {
        capabilityId: 'repository-technical-planner',
        status: 'available',
        capabilityHash,
        configHash,
      },
      premiseHash,
      candidates: [
        { kind: 'STOP', id: 'stop-on-schema-drift', value: 'Stop on schema drift.' },
        { kind: 'PATH', id: 'source-owner', value: 'src/owner.ts' },
        { kind: 'CMD', id: 'targeted-test', value: 'npm test -- owner.test.ts' },
        { kind: 'ART', id: 'semantic-ir', value: 'semantic-ir.json' },
        { kind: 'CTM', id: 'must-trace', value: 'MUST-001 -> targeted-test' },
        { kind: 'EVDREQ', id: 'test-receipt', value: 'targeted test receipt' },
      ],
    });

    expect(result.status).toBe('resolved');
    expect(result.issueCode).toBeNull();
    expect(result.executionRegistry?.entries.map((entry) => entry.kind)).toEqual([
      'ART',
      'CMD',
      'CTM',
      'EVDREQ',
      'PATH',
      'STOP',
    ]);
    expect(validateRequirementsTechnicalPlanningCapabilityResult(result)).toBe(true);
  });

  it('enters production cp02 when consumer authority proves typed execution constraints', () => {
    const root = path.join(os.tmpdir(), `requirements-technical-available-${process.pid}-${Date.now()}`);
    try {
      const run = runProductionAuthor(root, {
        text: 'System MUST persist accepted decisions.',
        oracle: 'The targeted test proves accepted decisions are durable.',
        executionConstraints: [
          { kind: 'CMD', id: 'targeted-test', value: 'npm test -- decisions.test.ts' },
          { kind: 'PATH', id: 'decision-owner', value: 'src/decisions.ts' },
        ],
        executionConstraintRefs: ['CMD:targeted-test', 'PATH:decision-owner'],
      });

      expect(run.status, run.stderr || run.stdout).toBe(0);
      const envelope = JSON.parse(run.stdout) as Record<string, any>;
      expect(envelope.data).toMatchObject({
        status: 'audit_pending',
        issueCode: 'requirements_audit_pending',
      });
      const attemptDir = productionAttemptDir(root, envelope.data.authoringRequestId);
      expect(JSON.parse(readFileSync(
        path.join(attemptDir, 'cp02-technical-planning-capability.json'),
        'utf8'
      ))).toMatchObject({ status: 'resolved', capabilityStatus: 'available' });
      expect(JSON.parse(readFileSync(
        path.join(attemptDir, 'cp02-candidate.json'),
        'utf8'
      ))).toMatchObject({ status: 'closed', issueCodes: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('persists one durable production pending snapshot and performs zero writes on replay', () => {
    const root = path.join(os.tmpdir(), `requirements-technical-pending-${process.pid}-${Date.now()}`);
    try {
      const first = runProductionAuthor(root, {
        text: 'System MUST persist accepted decisions.',
        oracle: 'The durable decision can be read back.',
      });
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const firstEnvelope = JSON.parse(first.stdout) as Record<string, any>;
      expect(firstEnvelope.data.status).toBe('technical_planning_pending');
      const attemptDir = productionAttemptDir(root, firstEnvelope.data.authoringRequestId);
      const snapshotPath = path.join(attemptDir, 'cp02-technical-planning-capability.json');
      const firstBytes = readFileSync(snapshotPath);
      const firstMtime = statSync(snapshotPath).mtimeMs;

      const replay = runProductionAuthor(root, {
        text: 'System MUST persist accepted decisions.',
        oracle: 'The durable decision can be read back.',
      });
      expect(replay.status, replay.stderr || replay.stdout).toBe(0);
      expect(JSON.parse(replay.stdout).data).toEqual(firstEnvelope.data);
      expect(readFileSync(snapshotPath)).toEqual(firstBytes);
      expect(statSync(snapshotPath).mtimeMs).toBe(firstMtime);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resumes technical planning as a new immutable attempt after authority gains constraints', () => {
    const root = path.join(os.tmpdir(), `requirements-technical-resume-${process.pid}-${Date.now()}`);
    try {
      const first = runProductionAuthor(root, {
        text: 'System MUST persist accepted decisions.',
        oracle: 'The durable decision can be read back.',
      });
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const firstEnvelope = JSON.parse(first.stdout) as Record<string, any>;
      expect(firstEnvelope.data).toMatchObject({
        status: 'technical_planning_pending',
        issueCode: 'requirements_technical_planning_pending',
        authoringAttemptId: expect.any(String),
        nextAction: 'resume-author-confirmation-ready-source',
      });
      const requestId = firstEnvelope.data.authoringRequestId as string;
      const firstAttemptId = firstEnvelope.data.authoringAttemptId as string;
      const firstAttemptDir = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requestId,
        'authoring',
        'staging',
        firstAttemptId
      );
      const firstCapabilityPath = path.join(
        firstAttemptDir,
        'cp02-technical-planning-capability.json'
      );
      const firstContextPath = path.join(firstAttemptDir, 'authoring-context.json');
      const immutablePendingPaths = [
        firstCapabilityPath,
        firstContextPath,
        path.join(firstAttemptDir, 'semantic-kernel.json'),
        path.join(firstAttemptDir, 'must_decomposition_packet.json'),
        path.join(firstAttemptDir, 'id-registry.json'),
        path.join(firstAttemptDir, 'manifests', '0-cp00.json'),
        path.join(firstAttemptDir, 'manifests', '1-cp01.json'),
        path.join(firstAttemptDir, 'manifests', '2-cp02.json'),
      ];
      const immutablePendingState = new Map(immutablePendingPaths.map((filePath) => [
        filePath,
        { bytes: readFileSync(filePath), mtime: statSync(filePath).mtimeMs },
      ]));
      const pointerPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requestId,
        'record',
        'active-authoring-request.json'
      );
      expect(JSON.parse(readFileSync(pointerPath, 'utf8'))).toMatchObject({
        authoringAttemptId: firstAttemptId,
        attemptManifestPath: `authoring/staging/${firstAttemptId}/manifests/2-cp02.json`,
        latestValidPredecessorCheckpoint: 'cp01',
      });

      const replay = runProductionResume(root, requestId, firstAttemptId);
      expect(replay.status, replay.stderr || replay.stdout).toBe(0);
      expect(JSON.parse(replay.stdout).data).toEqual(firstEnvelope.data);
      for (const [filePath, state] of immutablePendingState) {
        expect(readFileSync(filePath), filePath).toEqual(state.bytes);
        expect(statSync(filePath).mtimeMs, filePath).toBe(state.mtime);
      }

      writeFileSync(path.join(root, 'docs', 'functional.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'MUST-FR-TECHNICAL-001',
        semanticBody: {
          text: 'System MUST persist accepted decisions.',
          oracle: 'The durable decision can be read back.',
          executionConstraints: [
            { kind: 'CMD', id: 'targeted-test', value: 'npm test -- decisions.test.ts' },
            { kind: 'PATH', id: 'decision-owner', value: 'src/decisions.ts' },
          ],
          executionConstraintRefs: ['CMD:targeted-test', 'PATH:decision-owner'],
        },
      }), 'utf8');

      const resume = runProductionResume(root, requestId, firstAttemptId);
      expect(resume.status, resume.stderr || resume.stdout).toBe(0);
      const resumeEnvelope = JSON.parse(resume.stdout) as Record<string, any>;
      expect(resumeEnvelope.data).toMatchObject({
        status: 'audit_pending',
        issueCode: 'requirements_audit_pending',
        authoringRequestId: requestId,
        authoringAttemptId: expect.any(String),
      });
      expect(resumeEnvelope.data.authoringAttemptId).not.toBe(firstAttemptId);
      const nextAttemptDir = path.join(
        path.dirname(firstAttemptDir),
        resumeEnvelope.data.authoringAttemptId
      );
      expect(JSON.parse(readFileSync(
        path.join(nextAttemptDir, 'cp02-technical-planning-capability.json'),
        'utf8'
      ))).toMatchObject({ status: 'resolved', capabilityStatus: 'available' });
      expect(JSON.parse(readFileSync(
        path.join(nextAttemptDir, 'cp02-candidate.json'),
        'utf8'
      ))).toMatchObject({ status: 'closed', issueCodes: [] });
      expect(readFileSync(path.join(nextAttemptDir, 'manifests', '4-cp04.json'))).not.toHaveLength(0);
      for (const [filePath, state] of immutablePendingState) {
        expect(readFileSync(filePath), filePath).toEqual(state.bytes);
        expect(statSync(filePath).mtimeMs, filePath).toBe(state.mtime);
      }
      expect(readFileSync(path.join(nextAttemptDir, 'semantic-kernel.json'))).not.toHaveLength(0);
      expect(readFileSync(path.join(nextAttemptDir, 'must_decomposition_packet.json')))
        .not.toHaveLength(0);
      expect(readFileSync(path.join(nextAttemptDir, 'id-registry.json'))).not.toHaveLength(0);
      expect(readFileSync(path.join(nextAttemptDir, 'manifests', '3-cp03.json')))
        .not.toHaveLength(0);
      const immutableAuditPendingPaths = [
        pointerPath,
        path.join(nextAttemptDir, 'semantic-kernel.json'),
        path.join(nextAttemptDir, 'must_decomposition_packet.json'),
        path.join(nextAttemptDir, 'id-registry.json'),
        path.join(nextAttemptDir, 'manifests', '0-cp00.json'),
        path.join(nextAttemptDir, 'manifests', '1-cp01.json'),
        path.join(nextAttemptDir, 'manifests', '2-cp02.json'),
        path.join(nextAttemptDir, 'manifests', '3-cp03.json'),
        path.join(nextAttemptDir, 'manifests', '4-cp04.json'),
      ];
      const immutableAuditPendingState = new Map(immutableAuditPendingPaths.map((filePath) => [
        filePath,
        { bytes: readFileSync(filePath), mtime: statSync(filePath).mtimeMs },
      ]));
      const auditReplay = runProductionResume(
        root,
        requestId,
        resumeEnvelope.data.authoringAttemptId
      );
      expect(auditReplay.status, auditReplay.stderr || auditReplay.stdout).toBe(0);
      expect(JSON.parse(auditReplay.stdout).data).toEqual(resumeEnvelope.data);
      for (const [filePath, state] of immutableAuditPendingState) {
        expect(readFileSync(filePath), filePath).toEqual(state.bytes);
        expect(statSync(filePath).mtimeMs, filePath).toBe(state.mtime);
      }
      const emittedPaths = readdirSync(root, { recursive: true }).map(String);
      expect(emittedPaths.filter((value) => /critical-auditor/iu.test(value))).toEqual([]);
      expect(emittedPaths.filter((value) => /(?:cleanup|garbage-collection|gc-delete)/iu.test(value)))
        .toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
