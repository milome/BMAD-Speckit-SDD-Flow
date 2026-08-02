const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  freezeExpectedEvidenceRegistry,
  validateExpectedEvidenceMutation,
} = require('../src/utils/goal-contract/evidence-registry.ts');
const {
  EvidenceTerminalState,
  evaluateEvidenceClosure,
  observedEvidenceIssueCodes,
  validateObservedEvidence,
} = require('../src/utils/goal-contract/evidence-integrity-validator.ts');
const {
  writeGenerationReceipt,
} = require('../src/utils/goal-contract/goal-contract-receipts.ts');
const {
  buildExpectedEvidenceFreezeSlot,
} = require('../src/utils/goal-contract/slot-data-builder.ts');

function hash(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function makeContext() {
  return {
    contractHash: hash(Buffer.from('frozen contract', 'utf8')),
    commitSha: hash(Buffer.from('current commit', 'utf8')).slice(7),
    treeIdentity: hash(Buffer.from('current tree', 'utf8')).slice(7),
    now: new Date('2026-07-18T08:00:30.000Z'),
  };
}

function makeExpected(overrides = {}) {
  return {
    id: 'EVD-TEST',
    producer: 'CMD-TEST',
    commandId: 'CMD-TEST',
    productionEntryPoint: 'goalContractCommand',
    admissibleObservedEvidenceTypes: ['behavior'],
    minimumStrength: 'behavior',
    requiredFields: [
      'contractHash',
      'commitSha',
      'treeIdentity',
      'argv',
      'cwd',
      'startedAt',
      'completedAt',
      'exitCode',
      'artifactHashes',
    ],
    requiredProvenanceFields: ['argv', 'cwd', 'exitCode'],
    freshness: { maxAgeMs: 60_000 },
    failureClass: EvidenceTerminalState.CONVERGENCE_REQUIRED,
    requiredCapability: 'node_runtime',
    negativeControl: {
      required: true,
      expectedNonZero: true,
      acceptedBlockerClasses: ['EXPECTED_BLOCK'],
    },
    ...overrides,
  };
}

function makeObserved(context, overrides = {}) {
  return {
    evidenceId: 'EVD-TEST',
    producer: 'CMD-TEST',
    commandId: 'CMD-TEST',
    productionEntryPoint: 'goalContractCommand',
    evidenceType: 'behavior',
    evidenceStrength: 'behavior',
    contractHash: context.contractHash,
    commitSha: context.commitSha,
    treeIdentity: context.treeIdentity,
    argv: [process.execPath, '--version'],
    cwd: process.cwd(),
    startedAt: '2026-07-18T08:00:00.000Z',
    completedAt: '2026-07-18T08:00:01.000Z',
    exitCode: 0,
    artifactHashes: {
      stdout: hash(Buffer.from(process.version, 'utf8')),
    },
    freshnessDecision: 'current_execution_pass',
    originKind: 'runtime_command',
    realProductionEntry: true,
    negativeControlResults: [
      {
        expectedNonZero: true,
        exitCode: 1,
        blockerClass: 'EXPECTED_BLOCK',
      },
    ],
    ...overrides,
  };
}

function makeRegistry(context) {
  return freezeExpectedEvidenceRegistry({
    expectedEvidence: [makeExpected()],
    contractHash: context.contractHash,
    frozenAt: '2026-07-18T07:59:00.000Z',
    implementationStartedAt: '2026-07-18T08:00:00.000Z',
  });
}

describe('goal-contract evidence integrity', () => {
  it('freezes a complete Expected EVD registry before implementation starts', () => {
    const context = makeContext();
    const registry = makeRegistry(context);
    const slot = buildExpectedEvidenceFreezeSlot(registry);

    assert.equal(registry.itemCount, 1);
    assert.equal(registry.contractHash, context.contractHash);
    assert.equal(registry.immutable, true);
    assert.equal(Object.isFrozen(registry), true);
    assert.equal(Object.isFrozen(registry.items), true);
    assert.match(registry.registryHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(slot, new RegExp(registry.items[0].id, 'u'));
    assert.doesNotMatch(slot, /\bObserved(?: Evidence)?:\s*PASS\b/u);
  });

  it('blocks late freeze, deletion, and post-start strength weakening', () => {
    const context = makeContext();
    assert.throws(
      () =>
        freezeExpectedEvidenceRegistry({
          expectedEvidence: [makeExpected()],
          contractHash: context.contractHash,
          frozenAt: '2026-07-18T08:00:01.000Z',
          implementationStartedAt: '2026-07-18T08:00:00.000Z',
        }),
      (error) => error.failureClass === 'expected_evidence_freeze_late'
    );

    const registry = makeRegistry(context);
    assert.throws(
      () =>
        validateExpectedEvidenceMutation({
          frozenRegistry: registry,
          candidateExpectedEvidence: [],
          implementationStarted: true,
        }),
      (error) =>
        error.failureClass === 'expected_evidence_weakening_forbidden'
    );
    assert.throws(
      () =>
        validateExpectedEvidenceMutation({
          frozenRegistry: registry,
          candidateExpectedEvidence: [
            makeExpected({ minimumStrength: 'coverage' }),
          ],
          implementationStarted: true,
        }),
      (error) =>
        error.failureClass === 'expected_evidence_weakening_forbidden'
    );
  });

  it('accepts only current runtime-bound Observed Evidence', () => {
    const context = makeContext();
    const expected = makeExpected();
    const observed = makeObserved(context);

    assert.deepEqual(
      validateObservedEvidence({ expected, observed, context }),
      {
        decision: 'pass',
        evidenceId: expected.id,
        issues: [],
      }
    );
  });

  it('rejects stale, mismatched, incomplete, and non-production evidence', () => {
    const context = makeContext();
    const expected = makeExpected();
    const cases = [
      {
        code: observedEvidenceIssueCodes.contractMismatch,
        overrides: { contractHash: hash(Buffer.from('other contract')) },
      },
      {
        code: observedEvidenceIssueCodes.treeMismatch,
        overrides: { treeIdentity: hash(Buffer.from('other tree')).slice(7) },
      },
      {
        code: observedEvidenceIssueCodes.requiredFieldMissing,
        mutate(observed) {
          delete observed.argv;
        },
      },
      {
        code: observedEvidenceIssueCodes.stale,
        overrides: {
          startedAt: '2026-07-18T07:00:00.000Z',
          completedAt: '2026-07-18T07:00:01.000Z',
        },
      },
      {
        code: observedEvidenceIssueCodes.fixtureOnly,
        overrides: { originKind: 'fixture' },
      },
      {
        code: observedEvidenceIssueCodes.selfAuthored,
        overrides: { originKind: 'self_authored_pass' },
      },
      {
        code: observedEvidenceIssueCodes.strengthInsufficient,
        overrides: {
          evidenceType: 'coverage',
          evidenceStrength: 'coverage',
        },
      },
      {
        code: observedEvidenceIssueCodes.negativeControlMissing,
        overrides: { negativeControlResults: [] },
      },
      {
        code: observedEvidenceIssueCodes.realEntryMissing,
        overrides: { realProductionEntry: false },
      },
    ];

    for (const testCase of cases) {
      const observed = makeObserved(context, testCase.overrides);
      if (testCase.mutate) testCase.mutate(observed);
      const result = validateObservedEvidence({
        expected,
        observed,
        context,
      });
      assert.equal(result.decision, 'block');
      assert.ok(
        result.issues.some((issue) => issue.code === testCase.code),
        `${testCase.code} was not emitted`
      );
    }
  });

  it('evaluates mutually exclusive environment, convergence, and final states', () => {
    const context = makeContext();
    const registry = makeRegistry(context);
    const observed = makeObserved(context);

    const blocked = evaluateEvidenceClosure({
      registry,
      observedEvidence: [],
      context,
      environment: { missingCapabilities: ['node_runtime'] },
    });
    const converging = evaluateEvidenceClosure({
      registry,
      observedEvidence: [],
      context,
      environment: { missingCapabilities: [] },
    });
    const complete = evaluateEvidenceClosure({
      registry,
      observedEvidence: [observed],
      context,
      environment: { missingCapabilities: [] },
    });

    assert.equal(blocked.terminalState, EvidenceTerminalState.BLOCKED_ENVIRONMENT);
    assert.equal(converging.terminalState, EvidenceTerminalState.CONVERGENCE_REQUIRED);
    assert.equal(complete.terminalState, EvidenceTerminalState.FINAL_PASS);
    assert.equal(complete.closedEvidenceCount, registry.itemCount);
    assert.deepEqual(
      new Set([
        blocked.terminalState,
        converging.terminalState,
        complete.terminalState,
      ]).size,
      3
    );
  });

  it('writes FINAL_PASS only with a complete evidence-closure receipt', () => {
    const context = makeContext();
    const registry = makeRegistry(context);
    const closure = evaluateEvidenceClosure({
      registry,
      observedEvidence: [makeObserved(context)],
      context,
      environment: { missingCapabilities: [] },
    });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-evidence-'));
    const receiptPath = path.join(root, 'generation.json');

    writeGenerationReceipt(receiptPath, {
      schemaVersion: 'goal-contract-generation-receipt/v1',
      evidenceTerminalState: closure.terminalState,
      evidenceClosure: closure,
    });
    const written = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));

    assert.equal(written.evidenceTerminalState, EvidenceTerminalState.FINAL_PASS);
    assert.equal(written.evidenceClosure.decision, 'pass');
    assert.throws(
      () =>
        writeGenerationReceipt(path.join(root, 'invalid.json'), {
          evidenceTerminalState: EvidenceTerminalState.FINAL_PASS,
          evidenceClosure: {
            ...closure,
            decision: 'block',
          },
        }),
      (error) =>
        error.failureClass === 'generation_receipt_final_pass_unproven'
    );
  });
});
