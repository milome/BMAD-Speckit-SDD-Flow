import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import {
  materializeImplementationReadinessFixture,
  type ImplementationReadinessFixture,
} from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const SCOPED_INPUT_CASES: Array<[string, (fixture: ImplementationReadinessFixture) => string]> = [
  ['test', (fixture) => fixture.testPath],
  ['pre_implementation_target', (fixture) => fixture.targetPath],
  ['config', (fixture) => fixture.configPath],
  ['lock', (fixture) => fixture.lockPath],
];

function bytesHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function validateSchema(schemaName: string, value: unknown) {
  const schema = JSON.parse(
    readFileSync(path.join(ROOT, '_bmad', 'shared', 'goal-contract', schemaName), 'utf8')
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}

describe('requirements-backed Goal admission', () => {
  it('requires the current passed readiness authority before compiling GoalExecutionIR', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      expect(() =>
        compileRequirementsBackedGoal({
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot: path.join(fixture.root, 'goal-run'),
        })
      ).toThrowError('readiness_recheck_required:implementation_readiness');

      const readiness = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as { status: string; implementationReadinessCandidateHash: string };
      expect(readiness.status).toBe('implementation_readiness_pass');

      const result = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const goalExecutionIr = JSON.parse(readFileSync(result.goalExecutionIrRef.path, 'utf8'));
      const activeAuthority = JSON.parse(readFileSync(result.activeAuthorityRef.path, 'utf8'));
      const admissionSnapshot = JSON.parse(readFileSync(result.admissionSnapshotRef.path, 'utf8'));
      const adapterProjection = JSON.parse(readFileSync(result.adapterProjectionRef.path, 'utf8'));
      const sourceBinding = JSON.parse(readFileSync(result.sourceBindingRef.path, 'utf8'));
      const closure = JSON.parse(readFileSync(result.closureRef.path, 'utf8'));
      const renderability = JSON.parse(readFileSync(result.renderabilityReportRef.path, 'utf8'));
      const resolvedEvidenceIndex = JSON.parse(
        readFileSync(result.resolvedEvidenceIndexRef.path, 'utf8')
      );

      expect(result.status).toBe('requirements_backed_goal_ready');
      expect(result.profile).toBe('requirements_backed');
      expect(result.goalJudgeDispatchCount).toBe(0);
      expect(goalExecutionIr.schemaVersion).toBe('GoalExecutionIR/v1');
      expect(goalExecutionIr.profile).toBe('requirements_backed');
      expect(goalExecutionIr.requirementsLineage.scopeSemanticHash).toBe(fixture.scopeSemanticHash);
      expect(goalExecutionIr.goalExecutionIRHash).toBe(result.goalExecutionIRHash);
      expect(activeAuthority.goalExecutionIRHash).toBe(result.goalExecutionIRHash);
      expect(activeAuthority.profile).toBe('requirements_backed');
      expect(resolvedEvidenceIndex.goalExecutionIRHash).toBe(result.goalExecutionIRHash);
      expect(activeAuthority.resolvedEvidenceIndexRef.hash).toBe(
        result.resolvedEvidenceIndexRef.hash
      );
      expect(existsSync(result.closureRef.path)).toBe(true);
      expect(renderability).toMatchObject({
        schemaVersion: 'GoalContractRenderabilityProbe/v1',
        goalExecutionIRHash: result.goalExecutionIRHash,
        decision: 'pass',
      });
      expect(activeAuthority.renderabilityReportRef).toEqual({
        path: expect.any(String),
        bytesHash: result.renderabilityReportRef.bytesHash,
      });
      expect(result.parentProjectionRef.bytesHash).toBe(bytesHash(result.parentProjectionRef.path));
      expect(result.renderabilityReportRef.bytesHash).toBe(
        bytesHash(result.renderabilityReportRef.path)
      );
      for (const [schemaName, value] of [
        ['goal-contract-admission-snapshot.schema.json', admissionSnapshot],
        ['goal-requirements-adapter-projection.schema.json', adapterProjection],
        ['goal-execution-ir.schema.json', goalExecutionIr],
        ['goal-source-binding.schema.json', sourceBinding],
        ['goal-contract-resolved-evidence-index.schema.json', resolvedEvidenceIndex],
        ['goal-execution-closure.schema.json', closure],
        ['goal-contract-active-authority.schema.json', activeAuthority],
      ] as const) {
        validateSchema(schemaName, value);
      }
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects source and caller-derived hashes for the requirements-backed profile', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      expect(() =>
        compileRequirementsBackedGoal({
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot: path.join(fixture.root, 'goal-run'),
          source: 'requirements.md',
        } as never)
      ).toThrowError('requirements_backed_caller_derived_input_forbidden:source');
      expect(() =>
        compileRequirementsBackedGoal({
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot: path.join(fixture.root, 'goal-run'),
          scopeSemanticHash: fixture.scopeSemanticHash,
        } as never)
      ).toThrowError('requirements_backed_caller_derived_input_forbidden:scopeSemanticHash');
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a disk readiness receipt that is not bound to the verified projection', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const runtimeRecord = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      const readinessProjection = runtimeRecord.sixModelResults.implementation_readiness;
      const receiptPath = path.join(
        fixture.recordRoot,
        ...readinessProjection.decisionReceiptRef.split('/')
      );
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      delete receipt.schemaVersion;
      receipt.receiptHash = `sha256:${'0'.repeat(64)}`;
      writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
      const outRoot = path.join(fixture.root, 'goal-run-invalid-readiness-receipt');

      expect(() =>
        compileRequirementsBackedGoal({
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot,
        })
      ).toThrowError('readiness_recheck_required:implementation_readiness');
      expect(existsSync(path.join(outRoot, 'goal', 'active-authority.json'))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it.each(SCOPED_INPUT_CASES)(
    'requires readiness recheck when %s bytes drift after admission',
    (_role, resolvePath) => {
      const fixture = materializeImplementationReadinessFixture();
      try {
        produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
        const scopedPath = resolvePath(fixture);
        writeFileSync(
          scopedPath,
          Buffer.concat([readFileSync(scopedPath), Buffer.from(' \n', 'utf8')])
        );
        const outRoot = path.join(fixture.root, `goal-run-stale-${_role}`);

        expect(() =>
          compileRequirementsBackedGoal({
            projectRoot: fixture.root,
            requirementRecordPath: fixture.runtimeRecordPath,
            outRoot,
          })
        ).toThrowError('readiness_recheck_required:scoped_input_digest');
        expect(existsSync(path.join(outRoot, 'goal', 'active-authority.json'))).toBe(false);
      } finally {
        fixture.cleanup();
      }
    }
  );
});
