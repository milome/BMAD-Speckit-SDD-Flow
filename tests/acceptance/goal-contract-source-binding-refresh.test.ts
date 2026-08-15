import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { refreshGoalSourceBinding } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-source-binding-refresh';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

function withoutHash(value: Record<string, unknown>, field: string) {
  const payload = { ...value };
  delete payload[field];
  return payload;
}

describe('Goal source binding-only refresh', () => {
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
});
