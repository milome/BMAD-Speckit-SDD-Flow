import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  sha256Stable,
  stableStringify,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { compileGoalExecutionIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
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

function currentReadinessCandidate(fixture: ImplementationReadinessFixture) {
  const runtimeRecord = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
  const projection = runtimeRecord.sixModelResults.implementation_readiness;
  const receipt = JSON.parse(
    readFileSync(path.join(fixture.recordRoot, ...projection.decisionReceiptRef.split('/')), 'utf8')
  );
  const candidateRef = receipt.deterministicGateOutputs.find(
    (output: { role: string }) => output.role === 'implementation_readiness_candidate'
  );
  return JSON.parse(
    readFileSync(path.join(fixture.recordRoot, ...candidateRef.path.split('/')), 'utf8')
  );
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}

function semanticAuthorityPath(fixture: ImplementationReadinessFixture): string {
  const authoringRecord = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
  return path.join(
    fixture.recordRoot,
    ...authoringRecord.activeAuthority.activeSemanticIrPath.split('/')
  );
}

async function startActiveAuthorityWinner(input: {
  activePath: string;
  bytes: Buffer;
}): Promise<{ release(): void; exited: Promise<void> }> {
  const gateBuffer = new SharedArrayBuffer(4);
  const gate = new Int32Array(gateBuffer);
  const worker = new Worker(
    `
      const fs = require('node:fs');
      const { parentPort, workerData } = require('node:worker_threads');
      fs.writeFileSync(workerData.lockPath, '', { flag: 'wx' });
      parentPort.postMessage('locked');
      const gate = new Int32Array(workerData.gateBuffer);
      while (Atomics.load(gate, 0) === 0) Atomics.wait(gate, 0, 0);
      fs.writeFileSync(workerData.activePath, Buffer.from(workerData.bytesBase64, 'base64'));
      fs.rmSync(workerData.lockPath, { force: true });
    `,
    {
      eval: true,
      workerData: {
        activePath: input.activePath,
        lockPath: `${input.activePath}.lock`,
        bytesBase64: input.bytes.toString('base64'),
        gateBuffer,
      },
    }
  );
  const locked = new Promise<void>((resolve, reject) => {
    worker.once('message', () => resolve());
    worker.once('error', reject);
  });
  const exited = new Promise<void>((resolve, reject) => {
    worker.once('error', reject);
    worker.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`active_authority_worker_exit:${code}`))
    );
  });
  await locked;
  return {
    release: () => {
      Atomics.store(gate, 0, 1);
      Atomics.notify(gate, 0);
    },
    exited,
  };
}

function competingActiveAuthorityBytes(winnerBytes: Buffer): Buffer {
  const active = JSON.parse(winnerBytes.toString('utf8'));
  const payload = {
    ...active,
    goalId: `${active.goalId}-competitor`,
  };
  delete payload.activeAuthorityHash;
  return canonicalBytes({ ...payload, activeAuthorityHash: sha256Stable(payload) });
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

  it('advances an existing active authority to a readiness successor with CAS', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const input = {
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run-successor'),
      };
      const first = compileRequirementsBackedGoal(input);
      const firstActive = JSON.parse(readFileSync(first.activeAuthorityRef.path, 'utf8'));

      writeFileSync(
        fixture.targetPath,
        Buffer.concat([readFileSync(fixture.targetPath), Buffer.from('// successor\n', 'utf8')])
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const successor = compileRequirementsBackedGoal(input);
      const successorActive = JSON.parse(readFileSync(successor.activeAuthorityRef.path, 'utf8'));

      expect(successor.publicationStatus).toBe('published');
      expect(successor.goalExecutionIRHash).not.toBe(first.goalExecutionIRHash);
      expect(successorActive.activeAuthorityHash).not.toBe(firstActive.activeAuthorityHash);
      expect(successorActive.goalExecutionIRHash).toBe(successor.goalExecutionIRHash);
      expect(existsSync(first.goalExecutionIrRef.path)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it('waits for a real lock holder and reuses the same committed readiness successor', async () => {
    const fixture = materializeImplementationReadinessFixture();
    let workerExit: Promise<void> | undefined;
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const input = {
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run-concurrent-successor'),
      };
      const first = compileRequirementsBackedGoal(input);
      const originalActiveBytes = readFileSync(first.activeAuthorityRef.path);
      writeFileSync(
        fixture.targetPath,
        Buffer.concat([readFileSync(fixture.targetPath), Buffer.from('// successor\n', 'utf8')])
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const seededSuccessor = compileRequirementsBackedGoal(input);
      const winnerBytes = readFileSync(seededSuccessor.activeAuthorityRef.path);
      writeFileSync(first.activeAuthorityRef.path, originalActiveBytes);
      const winner = await startActiveAuthorityWinner({
        activePath: first.activeAuthorityRef.path,
        bytes: winnerBytes,
      });
      workerExit = winner.exited;

      const contender = compileRequirementsBackedGoal(input, {
        compileGoalExecutionIR: (compilerInput) => {
          winner.release();
          return compileGoalExecutionIR(compilerInput);
        },
      });
      await workerExit;

      expect(contender.publicationStatus).toBe('reused');
      expect(contender.writeCount).toBe(0);
      expect(readFileSync(contender.activeAuthorityRef.path)).toEqual(winnerBytes);
    } finally {
      await workerExit?.catch(() => undefined);
      fixture.cleanup();
    }
  });

  it('rejects a stale expected hash when a different successor wins lock contention', async () => {
    const fixture = materializeImplementationReadinessFixture();
    let workerExit: Promise<void> | undefined;
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const input = {
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run-competing-successor'),
      };
      const first = compileRequirementsBackedGoal(input);
      const originalActiveBytes = readFileSync(first.activeAuthorityRef.path);
      writeFileSync(
        fixture.targetPath,
        Buffer.concat([readFileSync(fixture.targetPath), Buffer.from('// successor\n', 'utf8')])
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const seededSuccessor = compileRequirementsBackedGoal(input);
      const competingWinnerBytes = competingActiveAuthorityBytes(
        readFileSync(seededSuccessor.activeAuthorityRef.path)
      );
      writeFileSync(first.activeAuthorityRef.path, originalActiveBytes);
      const winner = await startActiveAuthorityWinner({
        activePath: first.activeAuthorityRef.path,
        bytes: competingWinnerBytes,
      });
      workerExit = winner.exited;

      expect(() =>
        compileRequirementsBackedGoal(input, {
          compileGoalExecutionIR: (compilerInput) => {
            winner.release();
            return compileGoalExecutionIR(compilerInput);
          },
        })
      ).toThrowError('goal_active_authority_cas_mismatch');
      await workerExit;

      expect(readFileSync(first.activeAuthorityRef.path)).toEqual(competingWinnerBytes);
    } finally {
      await workerExit?.catch(() => undefined);
      fixture.cleanup();
    }
  });

  it('returns writer busy only after bounded lock contention expires', () => {
    const fixture = materializeImplementationReadinessFixture();
    let lockPath = '';
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const input = {
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run-lock-timeout'),
      };
      const first = compileRequirementsBackedGoal(input);
      const originalActiveBytes = readFileSync(first.activeAuthorityRef.path);
      writeFileSync(
        fixture.targetPath,
        Buffer.concat([readFileSync(fixture.targetPath), Buffer.from('// successor\n', 'utf8')])
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      lockPath = `${first.activeAuthorityRef.path}.lock`;
      writeFileSync(lockPath, '', { flag: 'wx' });
      const startedAt = Date.now();

      expect(() => compileRequirementsBackedGoal(input)).toThrowError(
        'goal_active_authority_writer_busy'
      );

      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_900);
      expect(readFileSync(first.activeAuthorityRef.path)).toEqual(originalActiveBytes);
    } finally {
      if (lockPath && existsSync(lockPath)) unlinkSync(lockPath);
      fixture.cleanup();
    }
  });

  it.each(['deleted', 'tampered'] as const)(
    'requires readiness recheck when an external raw log is %s',
    (mutation) => {
      const fixture = materializeImplementationReadinessFixture();
      try {
        produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
        const candidate = currentReadinessCandidate(fixture);
        const rawLogPath = path.join(
          fixture.recordRoot,
          ...candidate.redOutcomes[0].rawLogRef.path.split('/')
        );
        if (mutation === 'deleted') unlinkSync(rawLogPath);
        else
          writeFileSync(
            rawLogPath,
            Buffer.concat([readFileSync(rawLogPath), Buffer.from('tampered\n', 'utf8')])
          );
        const outRoot = path.join(fixture.root, `goal-run-raw-log-${mutation}`);

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
    }
  );

  it('rejects publication when scoped bytes change inside the compiler dependency hook', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const outRoot = path.join(fixture.root, 'goal-run-compile-hook-scoped-drift');

      expect(() =>
        compileRequirementsBackedGoal(
          {
            projectRoot: fixture.root,
            requirementRecordPath: fixture.runtimeRecordPath,
            outRoot,
          },
          {
            compileGoalExecutionIR: (compilerInput) => {
              writeFileSync(
                fixture.targetPath,
                Buffer.concat([
                  readFileSync(fixture.targetPath),
                  Buffer.from(' // drift\n', 'utf8'),
                ])
              );
              return compileGoalExecutionIR(compilerInput);
            },
          }
        )
      ).toThrowError('readiness_recheck_required:scoped_input_digest');
      expect(existsSync(path.join(outRoot, 'goal', 'active-authority.json'))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects publication when requirements lineage changes inside the compiler dependency hook', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const semanticPath = semanticAuthorityPath(fixture);
      const outRoot = path.join(fixture.root, 'goal-run-compile-hook-lineage-drift');

      expect(() =>
        compileRequirementsBackedGoal(
          {
            projectRoot: fixture.root,
            requirementRecordPath: fixture.runtimeRecordPath,
            outRoot,
          },
          {
            compileGoalExecutionIR: (compilerInput) => {
              const semanticIr = JSON.parse(readFileSync(semanticPath, 'utf8'));
              semanticIr.semanticPayload.semantics.requirements[0].text =
                'Tampered after Goal admission.';
              writeFileSync(semanticPath, `${JSON.stringify(semanticIr, null, 2)}\n`, 'utf8');
              return compileGoalExecutionIR(compilerInput);
            },
          }
        )
      ).toThrowError('requirements_successor_required:semantic_authority');
      expect(existsSync(path.join(outRoot, 'goal', 'active-authority.json'))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    [
      'scoped bytes',
      'readiness_recheck_required:scoped_input_digest',
      (fixture: ImplementationReadinessFixture) =>
        writeFileSync(
          fixture.targetPath,
          Buffer.concat([readFileSync(fixture.targetPath), Buffer.from(' // late drift\n', 'utf8')])
        ),
    ],
    [
      'requirements lineage',
      'requirements_successor_required:semantic_authority',
      (fixture: ImplementationReadinessFixture) => {
        const semanticPath = semanticAuthorityPath(fixture);
        const semanticIr = JSON.parse(readFileSync(semanticPath, 'utf8'));
        semanticIr.semanticPayload.semantics.requirements[0].text =
          'Tampered immediately before active commit.';
        writeFileSync(semanticPath, `${JSON.stringify(semanticIr, null, 2)}\n`, 'utf8');
      },
    ],
  ] as const)(
    'revalidates %s under the active lock immediately before rename',
    (_role, issueCode, mutate) => {
      const fixture = materializeImplementationReadinessFixture();
      try {
        produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
        const outRoot = path.join(fixture.root, `goal-run-late-${_role.replace(' ', '-')}`);

        expect(() =>
          compileRequirementsBackedGoal(
            {
              projectRoot: fixture.root,
              requirementRecordPath: fixture.runtimeRecordPath,
              outRoot,
            },
            { beforeActiveAuthorityCommit: () => mutate(fixture) }
          )
        ).toThrowError(issueCode);
        expect(existsSync(path.join(outRoot, 'goal', 'active-authority.json'))).toBe(false);
      } finally {
        fixture.cleanup();
      }
    }
  );
});
