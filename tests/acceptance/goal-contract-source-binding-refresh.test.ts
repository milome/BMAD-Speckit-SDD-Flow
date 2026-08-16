import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { refreshGoalSourceBinding } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-source-binding-refresh';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_COMMAND = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function activate(cwd: string, goalAuthorityPath: string) {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      SOURCE_RUNNER,
      SOURCE_COMMAND,
      'activate',
      '--cwd',
      cwd,
      '--goal-authority',
      goalAuthorityPath,
      '--json',
    ],
    { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return JSON.parse(completed.stdout);
}

function withoutHash(value: Record<string, unknown>, field: string) {
  const payload = { ...value };
  delete payload[field];
  return payload;
}

describe('Goal source binding-only refresh', () => {
  it('reuses the committed active run across a compatible binding-only refresh', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      const outRoot = path.join(fixture.root, 'goal-run-active-run-currentness');
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot,
      });
      const first = activate(fixture.root, compiled.activeAuthorityRef.path);
      const firstActivation = first.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'activation_record'
      );
      const firstPointer = first.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'active_run_pointer'
      );
      const activationBytes = readFileSync(firstActivation.artifactRef);
      const pointerBytes = readFileSync(firstPointer.artifactRef);
      const binding = JSON.parse(readFileSync(compiled.sourceBindingRef.path, 'utf8'));
      const evidenceIndex = JSON.parse(
        readFileSync(compiled.resolvedEvidenceIndexRef.path, 'utf8')
      );
      const nextBindingPayload = {
        ...withoutHash(binding, 'goalSourceBindingHash'),
        requirementsBindingRevisionId: 'binding-revision-active-run-compatible-refresh',
        requirementsSourceBindingHash: `sha256:${'d'.repeat(64)}`,
      };
      const nextBinding = {
        ...nextBindingPayload,
        goalSourceBindingHash: sha256Stable(nextBindingPayload),
      };
      const nextEvidencePayload = {
        ...withoutHash(evidenceIndex, 'resolvedEvidenceIndexHash'),
        goalSourceBindingHash: nextBinding.goalSourceBindingHash,
        requirementsBindingRevisionId: nextBinding.requirementsBindingRevisionId,
      };
      const nextEvidenceIndex = {
        ...nextEvidencePayload,
        resolvedEvidenceIndexHash: sha256Stable(nextEvidencePayload),
      };
      refreshGoalSourceBinding({
        outRoot,
        expectedActiveAuthorityHash: compiled.activeAuthorityRef.hash,
        sourceBinding: nextBinding,
        resolvedEvidenceIndex: nextEvidenceIndex,
      });

      const replay = activate(fixture.root, compiled.activeAuthorityRef.path);

      expect(replay.status).toBe('activation_reused');
      expect(
        replay.artifacts.find((artifact: { role: string }) => artifact.role === 'activation_record')
          .artifactHash
      ).toBe(firstActivation.artifactHash);
      expect(
        replay.artifacts.find(
          (artifact: { role: string }) => artifact.role === 'active_run_pointer'
        ).artifactHash
      ).toBe(firstPointer.artifactHash);
      expect(readFileSync(firstActivation.artifactRef)).toEqual(activationBytes);
      expect(readFileSync(firstPointer.artifactRef)).toEqual(pointerBytes);
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a schema-invalid binding even when its hash is self-consistent', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const outRoot = path.join(fixture.root, 'goal-run');
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot,
      });
      const binding = JSON.parse(readFileSync(compiled.sourceBindingRef.path, 'utf8'));
      const evidenceIndex = JSON.parse(
        readFileSync(compiled.resolvedEvidenceIndexRef.path, 'utf8')
      );
      const invalidBindingPayload = {
        ...withoutHash(binding, 'goalSourceBindingHash'),
        requirementsBindingRevisionId: 'binding-revision-compatible-refresh',
        unexpectedAuthority: 'forbidden',
      };
      const invalidBinding = {
        ...invalidBindingPayload,
        goalSourceBindingHash: sha256Stable(invalidBindingPayload),
      };
      const nextEvidencePayload = {
        ...withoutHash(evidenceIndex, 'resolvedEvidenceIndexHash'),
        goalSourceBindingHash: invalidBinding.goalSourceBindingHash,
        requirementsBindingRevisionId: invalidBinding.requirementsBindingRevisionId,
      };
      const nextEvidenceIndex = {
        ...nextEvidencePayload,
        resolvedEvidenceIndexHash: sha256Stable(nextEvidencePayload),
      };

      expect(() =>
        refreshGoalSourceBinding({
          outRoot,
          expectedActiveAuthorityHash: compiled.activeAuthorityRef.hash,
          sourceBinding: invalidBinding,
          resolvedEvidenceIndex: nextEvidenceIndex,
        })
      ).toThrowError('canonical_schema_invalid');
    } finally {
      fixture.cleanup();
    }
  });

  it('changes only binding authority members and keeps semantic compilation and Judge counts at zero', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const outRoot = path.join(fixture.root, 'goal-run');
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot,
      });
      const irBytesBefore = readFileSync(compiled.goalExecutionIrRef.path);
      const binding = JSON.parse(readFileSync(compiled.sourceBindingRef.path, 'utf8'));
      const evidenceIndex = JSON.parse(
        readFileSync(compiled.resolvedEvidenceIndexRef.path, 'utf8')
      );
      const nextBindingPayload = {
        ...withoutHash(binding, 'goalSourceBindingHash'),
        requirementsBindingRevisionId: 'binding-revision-compatible-refresh',
        requirementsSourceBindingHash: `sha256:${'b'.repeat(64)}`,
      };
      const nextBinding = {
        ...nextBindingPayload,
        goalSourceBindingHash: sha256Stable(nextBindingPayload),
      };
      const nextEvidencePayload = {
        ...withoutHash(evidenceIndex, 'resolvedEvidenceIndexHash'),
        goalSourceBindingHash: nextBinding.goalSourceBindingHash,
        requirementsBindingRevisionId: nextBinding.requirementsBindingRevisionId,
      };
      const nextEvidenceIndex = {
        ...nextEvidencePayload,
        resolvedEvidenceIndexHash: sha256Stable(nextEvidencePayload),
      };

      const refreshed = refreshGoalSourceBinding({
        outRoot,
        expectedActiveAuthorityHash: compiled.activeAuthorityRef.hash,
        sourceBinding: nextBinding,
        resolvedEvidenceIndex: nextEvidenceIndex,
      });
      const active = JSON.parse(readFileSync(compiled.activeAuthorityRef.path, 'utf8'));

      expect(refreshed.decision).toBe('binding_only_refreshed');
      expect(refreshed.goalExecutionIRHash).toBe(compiled.goalExecutionIRHash);
      expect(refreshed.semanticCompileCount).toBe(0);
      expect(refreshed.judgeDispatchCount).toBe(0);
      expect(active.goalExecutionIRHash).toBe(compiled.goalExecutionIRHash);
      expect(active.sourceBindingRef.hash).toBe(nextBinding.goalSourceBindingHash);
      expect(active.resolvedEvidenceIndexRef.hash).toBe(
        nextEvidenceIndex.resolvedEvidenceIndexHash
      );
      expect(readFileSync(compiled.goalExecutionIrRef.path)).toEqual(irBytesBefore);
      expect(() =>
        refreshGoalSourceBinding({
          outRoot,
          expectedActiveAuthorityHash: compiled.activeAuthorityRef.hash,
          sourceBinding: nextBinding,
          resolvedEvidenceIndex: nextEvidenceIndex,
        })
      ).toThrowError('goal_binding_refresh_active_authority_cas_mismatch');
    } finally {
      fixture.cleanup();
    }
  });

  it('does not replace the active authority when the commit-time currentness check fails', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const outRoot = path.join(fixture.root, 'goal-run-currentness');
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot,
      });
      const activeBytes = readFileSync(compiled.activeAuthorityRef.path);
      const binding = JSON.parse(readFileSync(compiled.sourceBindingRef.path, 'utf8'));
      const evidenceIndex = JSON.parse(
        readFileSync(compiled.resolvedEvidenceIndexRef.path, 'utf8')
      );
      const nextBindingPayload = {
        ...withoutHash(binding, 'goalSourceBindingHash'),
        requirementsBindingRevisionId: 'binding-revision-currentness-check',
        requirementsSourceBindingHash: `sha256:${'c'.repeat(64)}`,
      };
      const nextBinding = {
        ...nextBindingPayload,
        goalSourceBindingHash: sha256Stable(nextBindingPayload),
      };
      const nextEvidencePayload = {
        ...withoutHash(evidenceIndex, 'resolvedEvidenceIndexHash'),
        goalSourceBindingHash: nextBinding.goalSourceBindingHash,
        requirementsBindingRevisionId: nextBinding.requirementsBindingRevisionId,
      };
      const nextEvidenceIndex = {
        ...nextEvidencePayload,
        resolvedEvidenceIndexHash: sha256Stable(nextEvidencePayload),
      };

      expect(() =>
        refreshGoalSourceBinding({
          outRoot,
          expectedActiveAuthorityHash: compiled.activeAuthorityRef.hash,
          sourceBinding: nextBinding,
          resolvedEvidenceIndex: nextEvidenceIndex,
          beforeActiveAuthorityCommit: () => {
            throw new Error('simulated_binding_currentness_drift');
          },
        })
      ).toThrowError('simulated_binding_currentness_drift');
      expect(readFileSync(compiled.activeAuthorityRef.path)).toEqual(activeBytes);
    } finally {
      fixture.cleanup();
    }
  });
});
