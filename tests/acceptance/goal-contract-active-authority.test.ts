import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  sha256Stable,
  stableStringify,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { compileGoalExecutionIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

function withoutHash(value: Record<string, unknown>, field: string) {
  const payload = { ...value };
  delete payload[field];
  return payload;
}

function writeCanonical(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

describe('Goal active authority publication', () => {
  it('reuses an identical authority with zero writes', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const input = {
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      };
      const compile = vi.fn(compileGoalExecutionIR);
      const dependencies = { compileGoalExecutionIR: compile };
      const first = compileRequirementsBackedGoal(input, dependencies);
      const activeBytes = readFileSync(first.activeAuthorityRef.path);
      const second = compileRequirementsBackedGoal(input, dependencies);

      expect(first.publicationStatus).toBe('published');
      expect(first.writeCount).toBeGreaterThan(0);
      expect(second.publicationStatus).toBe('reused');
      expect(second.writeCount).toBe(0);
      expect(second.activeAuthorityRef).toEqual(first.activeAuthorityRef);
      expect(readFileSync(second.activeAuthorityRef.path)).toEqual(activeBytes);
      expect(compile).toHaveBeenCalledTimes(1);
    } finally {
      fixture.cleanup();
    }
  });

  it('refreshes only binding members when the active consumer has the same GoalExecutionIR', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const input = {
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      };
      const compile = vi.fn(compileGoalExecutionIR);
      const dependencies = { compileGoalExecutionIR: compile };
      const first = compileRequirementsBackedGoal(input, dependencies);
      const irBytes = readFileSync(first.goalExecutionIrRef.path);
      const active = JSON.parse(readFileSync(first.activeAuthorityRef.path, 'utf8'));
      const currentBinding = JSON.parse(readFileSync(first.sourceBindingRef.path, 'utf8'));
      const currentEvidence = JSON.parse(readFileSync(first.resolvedEvidenceIndexRef.path, 'utf8'));
      const oldBindingPayload = {
        ...withoutHash(currentBinding, 'goalSourceBindingHash'),
        requirementsBindingRevisionId: 'binding-revision-before-compatible-refresh',
        requirementsSourceBindingHash: `sha256:${'a'.repeat(64)}`,
      };
      const oldBinding = {
        ...oldBindingPayload,
        goalSourceBindingHash: sha256Stable(oldBindingPayload),
      };
      const oldEvidencePayload = {
        ...withoutHash(currentEvidence, 'resolvedEvidenceIndexHash'),
        goalSourceBindingHash: oldBinding.goalSourceBindingHash,
        requirementsBindingRevisionId: oldBinding.requirementsBindingRevisionId,
      };
      const oldEvidence = {
        ...oldEvidencePayload,
        resolvedEvidenceIndexHash: sha256Stable(oldEvidencePayload),
      };
      const oldBindingDir = path.join(
        input.outRoot,
        'goal',
        'bindings',
        oldBinding.goalSourceBindingHash.slice('sha256:'.length)
      );
      const oldBindingPath = path.join(oldBindingDir, 'goal-source-binding.json');
      const oldEvidencePath = path.join(oldBindingDir, 'resolved-evidence-index.json');
      writeCanonical(oldBindingPath, oldBinding);
      writeCanonical(oldEvidencePath, oldEvidence);
      const oldActivePayload = {
        ...withoutHash(active, 'activeAuthorityHash'),
        sourceBindingRef: {
          path: path.relative(input.outRoot, oldBindingPath).replace(/\\/gu, '/'),
          hash: oldBinding.goalSourceBindingHash,
        },
        resolvedEvidenceIndexRef: {
          path: path.relative(input.outRoot, oldEvidencePath).replace(/\\/gu, '/'),
          hash: oldEvidence.resolvedEvidenceIndexHash,
        },
      };
      const oldActive = {
        ...oldActivePayload,
        activeAuthorityHash: sha256Stable(oldActivePayload),
      };
      writeCanonical(first.activeAuthorityRef.path, oldActive);

      const refreshed = compileRequirementsBackedGoal(input, dependencies);
      const refreshedActive = JSON.parse(readFileSync(refreshed.activeAuthorityRef.path, 'utf8'));

      expect(refreshed.goalExecutionIRHash).toBe(first.goalExecutionIRHash);
      expect(refreshed.goalJudgeDispatchCount).toBe(0);
      expect(refreshedActive.sourceBindingRef.hash).toBe(first.sourceBindingRef.hash);
      expect(refreshedActive.resolvedEvidenceIndexRef.hash).toBe(
        first.resolvedEvidenceIndexRef.hash
      );
      expect(readFileSync(refreshed.goalExecutionIrRef.path)).toEqual(irBytes);
      expect(compile).toHaveBeenCalledTimes(1);
    } finally {
      fixture.cleanup();
    }
  });
});
