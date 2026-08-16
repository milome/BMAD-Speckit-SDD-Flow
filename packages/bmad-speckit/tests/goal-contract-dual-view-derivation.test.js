const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  StandaloneViewProvider,
  assertViewIsolation,
  buildCanonicalSemanticModel,
  buildSourceSnapshot,
  selectSemanticDerivationMode,
  validateAcceptanceEvidenceView,
  validateImplementationView,
} = require('../src/utils/goal-contract/dual-view-derivation.ts');

function implementationView() {
  return {
    tasks: [{ id: 'G00', purpose: 'Implement the declared behavior.' }],
    traceSlices: [{ id: 'TRACE-001', goalIds: ['G00'] }],
    productionSymbols: ['buildSourceSnapshot'],
    allowedPaths: ['packages/bmad-speckit/src/utils/goal-contract/dual-view-derivation.ts'],
    commands: {
      direct: ['CMD-03'],
      impacted: ['CMD-01'],
      integration: ['CMD-09'],
      regression: ['CMD-17'],
    },
    dependencies: [],
    commitPolicy: 'exactly_one_atomic_commit',
    closeConditions: ['Implementation View is complete.'],
    synchronizationObligations: ['package-source'],
  };
}

function acceptanceEvidenceView() {
  return {
    acceptanceItems: [{ id: 'AC-01', passCondition: 'Three entries are explicit.' }],
    negativeControls: ['unknown entry blocks'],
    productionEntryPoints: ['bmad-speckit goal-contract generate'],
    manualScenarios: ['Run one standalone generation journey.'],
    expectedEvidence: [{ id: 'EVD-01', producer: 'CMD-02' }],
    antiCheatRules: ['fixture-only evidence cannot close acceptance'],
    stopConditions: ['BLOCKED_ENVIRONMENT'],
  };
}

function semanticRequest(snapshot, extra = {}) {
  return {
    snapshot,
    sourceObligationGraphHash: `sha256:${'a'.repeat(64)}`,
    methodologyProfileHash: `sha256:${'b'.repeat(64)}`,
    repositoryFacts: { state: 'not_provided', facts: [] },
    repositoryFactsHash: `sha256:${'c'.repeat(64)}`,
    ...extra,
  };
}

describe('goal-contract dual-view derivation', () => {
  it('requires the standalone entry and frozen semantic authoring authority', () => {
    const skill = fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '_bmad',
        'skills',
        'goal-execution-contract-generator',
        'SKILL.md'
      ),
      'utf8'
    );

    assert.match(
      skill,
      /goal-contract generate --entry standalone_goal_contract/u
    );
    assert.match(skill, /immutable `SourceSnapshot`/u);
    assert.match(skill, /StandaloneGoalSemanticIR\/v1/u);
    assert.match(skill, /goal_full/u);
    assert.match(skill, /StandaloneGoalAuthoringEffectivePass\/v1/u);
  });

  it('builds an immutable source-plan snapshot from exact raw bytes', () => {
    const rawBytes = Buffer.from('# Plan\r\nExact bytes.\r\n', 'utf8');
    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs\\plans\\source.md',
      rawBytes,
      sourcePlanSemanticHash: `sha256:${'a'.repeat(64)}`,
    });

    assert.equal(snapshot.sourceType, 'source_plan');
    assert.equal(snapshot.sourcePath, 'docs/plans/source.md');
    assert.match(snapshot.aggregateHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(snapshot.exactByteHash, snapshot.aggregateHash);
    assert.equal(snapshot.sourceBytes, rawBytes.length);
    assert.equal(snapshot.sourceLines, 3);
    assert.equal(snapshot.sourcePlanSemanticHash, `sha256:${'a'.repeat(64)}`);
    assert.equal(snapshot.segments.length, 1);
    assert.equal(snapshot.segments[0].content, '# Plan\r\nExact bytes.\r\n');
    assert.deepEqual(snapshot.segments[0].boundary, {
      sourcePath: 'docs/plans/source.md',
      byteStart: 0,
      byteEnd: rawBytes.length,
      lineStart: 1,
      lineEnd: 3,
    });
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.segments), true);
    assert.equal(Object.isFrozen(snapshot.segments[0]), true);
  });

  it('stable-serializes ordered conversation segments after LF normalization', () => {
    const crlf = buildSourceSnapshot({
      sourceType: 'conversation',
      sourceId: 'conversation-2026-07-17',
      segments: [
        { role: 'user', content: 'First\r\nline', boundary: { messageId: 'm1' } },
        { role: 'assistant', content: 'Second', boundary: { messageId: 'm2' } },
      ],
    });
    const lf = buildSourceSnapshot({
      sourceType: 'conversation',
      sourceId: 'conversation-2026-07-17',
      segments: [
        { role: 'user', content: 'First\nline', boundary: { messageId: 'm1' } },
        { role: 'assistant', content: 'Second', boundary: { messageId: 'm2' } },
      ],
    });

    assert.equal(crlf.aggregateHash, lf.aggregateHash);
    assert.deepEqual(crlf.segments.map((segment) => segment.segmentId), [
      'SEG-001',
      'SEG-002',
    ]);
    assert.equal(crlf.segments[0].content, 'First\nline');
    assert.match(crlf.segments[0].contentHash, /^sha256:[0-9a-f]{64}$/u);
  });

  it('derives and validates one complete isolated Implementation View', async () => {
    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs/plans/source.md',
      rawBytes: Buffer.from('# Plan\n', 'utf8'),
    });
    let providerInput;
    const provider = new StandaloneViewProvider({
      providerIdentity: 'provider-a',
      createSessionIdentity: () => 'implementation-session-1',
      deriveImplementationView: async (input) => {
        providerInput = input;
        return implementationView();
      },
    });

    const result = await provider.deriveImplementationView(
      semanticRequest(snapshot, {
        repositoryFacts: { commitSha: 'a'.repeat(40) },
      })
    );

    assert.equal(result.validation.decision, 'pass');
    assert.deepEqual(result.view, implementationView());
    assert.equal(result.receipt.providerIdentity, 'provider-a');
    assert.equal(result.receipt.sessionIdentity, 'implementation-session-1');
    assert.equal(result.receipt.inputHash, snapshot.aggregateHash);
    assert.match(result.receipt.outputHash, /^sha256:[0-9a-f]{64}$/u);
    assert.deepEqual(Object.keys(providerInput).sort(), [
      'methodologyProfileHash',
      'repositoryFacts',
      'repositoryFactsHash',
      'roleContract',
      'roleContractHash',
      'snapshot',
      'snapshotHash',
      'sourceObligationGraphHash',
    ]);
    assert.equal(
      providerInput.roleContract,
      'goal_contract_implementation_view/v1'
    );
    assert.equal(
      result.receipt.sourceObligationGraphHash,
      `sha256:${'a'.repeat(64)}`
    );
    assert.equal(result.receipt.methodologyProfileHash, `sha256:${'b'.repeat(64)}`);
    assert.equal(result.receipt.repositoryFactsHash, `sha256:${'c'.repeat(64)}`);
  });

  it('fails closed on incomplete, cross-view, or unavailable provider behavior', async () => {
    assert.equal(
      validateImplementationView({ tasks: [] }).failureClass,
      'implementation_view_incomplete'
    );

    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs/plans/source.md',
      rawBytes: Buffer.from('# Plan\n', 'utf8'),
    });
    const sharedResponseProvider = new StandaloneViewProvider({
      providerIdentity: 'provider-a',
      createSessionIdentity: () => 'shared-session',
      deriveImplementationView: async () => ({
        ...implementationView(),
        acceptanceEvidenceView: { acceptance: [] },
      }),
    });
    await assert.rejects(
      () => sharedResponseProvider.deriveImplementationView(semanticRequest(snapshot)),
      (error) => error.failureClass === 'view_isolation_violation'
    );

    const unavailableProvider = new StandaloneViewProvider({
      providerIdentity: 'provider-a',
    });
    await assert.rejects(
      () => unavailableProvider.deriveImplementationView(semanticRequest(snapshot)),
      (error) => error.failureClass === 'BLOCKED_ENVIRONMENT'
    );
  });

  it('derives a separate complete Acceptance/Evidence View from the same snapshot', async () => {
    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs/plans/source.md',
      rawBytes: Buffer.from('# Plan\n', 'utf8'),
    });
    const provider = new StandaloneViewProvider({
      providerIdentity: 'provider-a',
      createSessionIdentity: (role) => `${role}-session`,
      deriveImplementationView: async () => implementationView(),
      deriveAcceptanceEvidenceView: async () => acceptanceEvidenceView(),
    });

    const implementation = await provider.deriveImplementationView(
      semanticRequest(snapshot)
    );
    const acceptanceEvidence = await provider.deriveAcceptanceEvidenceView({
      ...semanticRequest(snapshot),
    });
    const isolation = assertViewIsolation(implementation, acceptanceEvidence);

    assert.equal(acceptanceEvidence.validation.decision, 'pass');
    assert.deepEqual(acceptanceEvidence.view, acceptanceEvidenceView());
    assert.equal(
      acceptanceEvidence.receipt.inputHash,
      implementation.receipt.inputHash
    );
    assert.notEqual(
      acceptanceEvidence.receipt.sessionIdentity,
      implementation.receipt.sessionIdentity
    );
    assert.equal(isolation.decision, 'pass');
    assert.equal(isolation.persistedViewAuthorityFiles, 0);
  });

  it('accepts current role-contract transport receipts as isolated views', () => {
    const sourceSnapshotHash = `sha256:${'d'.repeat(64)}`;
    const result = assertViewIsolation(
      {
        receipt: {
          roleContract: 'goal_contract_implementation_view/v1',
          sourceSnapshotHash,
          sessionIdentity: 'implementation-transport-session',
          persistedViewAuthorityFiles: 0,
        },
      },
      {
        receipt: {
          roleContract: 'goal_contract_acceptance_evidence_view/v1',
          sourceSnapshotHash,
          sessionIdentity: 'acceptance-transport-session',
          persistedViewAuthorityFiles: 0,
        },
      }
    );

    assert.equal(result.decision, 'pass');
    assert.equal(result.snapshotHash, sourceSnapshotHash);
  });

  it('rejects incomplete Acceptance/Evidence Views and cross-view input', async () => {
    assert.equal(
      validateAcceptanceEvidenceView({ acceptanceItems: [] }).failureClass,
      'acceptance_evidence_view_incomplete'
    );
    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs/plans/source.md',
      rawBytes: Buffer.from('# Plan\n', 'utf8'),
    });
    const provider = new StandaloneViewProvider({
      providerIdentity: 'provider-a',
      createSessionIdentity: (role) => `${role}-session`,
      deriveAcceptanceEvidenceView: async () => acceptanceEvidenceView(),
    });

    await assert.rejects(
      () =>
        provider.deriveAcceptanceEvidenceView({
          ...semanticRequest(snapshot),
          implementationView: implementationView(),
        }),
      (error) => error.failureClass === 'view_isolation_violation'
    );
  });

  it('selects derivation mode from typed source bindings without provider calls', () => {
    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs/plans/structured-source.md',
      rawBytes: Buffer.from('# Plan\n', 'utf8'),
    });
    const complete = [
      'declared_execution_task',
      'acceptance_condition',
      'verification_command',
      'evidence_contract',
    ].map((kind) => ({ kind, applicabilityState: 'applicable' }));

    assert.deepEqual(
      selectSemanticDerivationMode({
        sourceSnapshot: snapshot,
        sourceObligations: complete,
        semanticDerivationAllowed: true,
        semanticProviderConfigured: true,
      }),
      {
        mode: 'structured_fast_path',
        sourceSnapshotHash: snapshot.aggregateHash,
        semanticProviderCallCount: 0,
        missingStructuredBindings: [],
      }
    );
    assert.equal(
      selectSemanticDerivationMode({
        sourceSnapshot: snapshot,
        sourceObligations: complete.slice(0, 2),
        semanticDerivationAllowed: true,
      }).mode,
      'semantic_completion'
    );
    assert.throws(
      () =>
        selectSemanticDerivationMode({
          sourceSnapshot: snapshot,
          sourceObligations: complete.slice(0, 2),
          semanticDerivationAllowed: false,
        }),
      (error) =>
        error.failureClass === 'partition_semantics_inconclusive' &&
        error.missingStructuredBindings.length === 2
    );
  });

  it('hashes one canonical semantic model without provider runtime metadata', () => {
    const derivation = {
      implementation: {
        view: implementationView(),
        receipt: { providerRunId: 'run-a', completedAt: '2026-07-25T00:00:00Z' },
      },
      acceptanceEvidence: {
        view: acceptanceEvidenceView(),
        receipt: { providerRunId: 'run-b', completedAt: '2026-07-25T00:00:01Z' },
      },
    };
    const input = {
      sourceObligationGraphHash: `sha256:${'a'.repeat(64)}`,
      methodologyProfileHash: `sha256:${'b'.repeat(64)}`,
      derivation,
    };
    const first = buildCanonicalSemanticModel(input);
    const replay = buildCanonicalSemanticModel({
      ...input,
      derivation: {
        implementation: { ...derivation.implementation, receipt: { providerRunId: 'run-c' } },
        acceptanceEvidence: {
          ...derivation.acceptanceEvidence,
          receipt: { providerRunId: 'run-d' },
        },
      },
    });
    const changed = buildCanonicalSemanticModel({
      ...input,
      derivation: {
        ...derivation,
        implementation: {
          ...derivation.implementation,
          view: { ...implementationView(), closeConditions: ['Changed condition.'] },
        },
      },
    });

    assert.equal(first.semanticModel.schemaVersion, 'goal-contract-semantic-model/v1');
    assert.match(first.semanticModelHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(replay.semanticModelHash, first.semanticModelHash);
    assert.notEqual(changed.semanticModelHash, first.semanticModelHash);
  });
});
