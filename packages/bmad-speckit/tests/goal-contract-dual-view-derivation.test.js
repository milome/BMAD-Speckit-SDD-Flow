const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  StandaloneViewProvider,
  assertViewIsolation,
  buildSourceSnapshot,
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

describe('goal-contract dual-view derivation', () => {
  it('requires the standalone entry and isolated Implementation View in the skill workflow', () => {
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
    assert.match(skill, /StandaloneViewProvider\.deriveImplementationView/u);
    assert.match(
      skill,
      /StandaloneViewProvider\.deriveAcceptanceEvidenceView/u
    );
    assert.match(skill, /immutable `SourceSnapshot`/u);
  });

  it('builds an immutable source-plan snapshot from exact raw bytes', () => {
    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs\\plans\\source.md',
      rawBytes: Buffer.from('# Plan\r\nExact bytes.\r\n', 'utf8'),
    });

    assert.equal(snapshot.sourceType, 'source_plan');
    assert.equal(snapshot.sourcePath, 'docs/plans/source.md');
    assert.match(snapshot.aggregateHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(snapshot.segments.length, 1);
    assert.equal(snapshot.segments[0].content, '# Plan\r\nExact bytes.\r\n');
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

    const result = await provider.deriveImplementationView({
      snapshot,
      repositoryFacts: { commitSha: 'a'.repeat(40) },
    });

    assert.equal(result.validation.decision, 'pass');
    assert.deepEqual(result.view, implementationView());
    assert.equal(result.receipt.providerIdentity, 'provider-a');
    assert.equal(result.receipt.sessionIdentity, 'implementation-session-1');
    assert.equal(result.receipt.inputHash, snapshot.aggregateHash);
    assert.match(result.receipt.outputHash, /^sha256:[0-9a-f]{64}$/u);
    assert.deepEqual(Object.keys(providerInput).sort(), [
      'repositoryFacts',
      'roleContract',
      'snapshot',
      'snapshotHash',
    ]);
    assert.equal(providerInput.roleContract, 'implementation_view/v1');
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
      () => sharedResponseProvider.deriveImplementationView({ snapshot }),
      (error) => error.failureClass === 'view_isolation_violation'
    );

    const unavailableProvider = new StandaloneViewProvider({
      providerIdentity: 'provider-a',
    });
    await assert.rejects(
      () => unavailableProvider.deriveImplementationView({ snapshot }),
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

    const implementation = await provider.deriveImplementationView({ snapshot });
    const acceptanceEvidence = await provider.deriveAcceptanceEvidenceView({
      snapshot,
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
          snapshot,
          implementationView: implementationView(),
        }),
      (error) => error.failureClass === 'view_isolation_violation'
    );
  });
});
