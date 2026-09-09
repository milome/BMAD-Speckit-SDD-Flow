const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  lintCanonicalRequirementGraph,
} = require('../src/utils/goal-contract/control-plane/canonical-requirement-graph.ts');
const {
  sha256Stable,
} = require('../src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver.ts');
const {
  lintStandaloneSourcePlan,
} = require('../src/utils/goal-contract/source-plan/standalone-source-plan.ts');

const REAL_LEGACY = path.join(
  __dirname,
  'fixtures',
  'standalone-goal',
  'real-source-plan-20260904.md'
);

function canonicalGraph() {
  const graph = {
    schemaVersion: 'CanonicalRequirementGraph/v2',
    sourceAuthority: {
      kind: 'standalone_source_plan',
      schemaVersion: 'standalone-source-plan/v1',
      authorityId: 'PLAN-LINT-001',
      authorityHash: `sha256:${'a'.repeat(64)}`,
    },
    nodes: [
      {
        id: 'REQ-LINT-001',
        kind: 'REQ',
        title: 'Lint requirement',
        statement: 'The shared graph lint MUST validate semantic bindings.',
        normativeStrength: 'MUST',
        polarity: 'required',
        applicability: { mode: 'always' },
        scope: 'local',
        aliases: [],
        ownerRef: null,
        attributes: {},
      },
      {
        id: 'TASK-LINT-001',
        kind: 'TASK',
        title: 'Implement lint',
        statement: 'Implement shared semantic lint.',
        normativeStrength: 'MUST',
        polarity: 'required',
        applicability: { mode: 'always' },
        scope: 'local',
        aliases: [],
        ownerRef: 'REQ-LINT-001',
        attributes: {},
      },
      {
        id: 'AC-LINT-001',
        kind: 'AC',
        title: 'Lint acceptance',
        statement: 'Semantic mutations fail closed.',
        normativeStrength: 'MUST',
        polarity: 'required',
        applicability: { mode: 'always' },
        scope: 'local',
        aliases: [],
        ownerRef: 'TASK-LINT-001',
        attributes: {},
      },
      {
        id: 'CMD-LINT-001',
        kind: 'CMD',
        title: 'Lint command',
        statement: 'Run the focused graph lint test.',
        normativeStrength: 'MUST',
        polarity: 'required',
        applicability: { mode: 'always' },
        scope: 'local',
        aliases: [],
        ownerRef: 'TASK-LINT-001',
        attributes: { command: 'node --test' },
      },
    ],
    relations: [
      {
        id: 'REL-LINT-IMPLEMENTED-001',
        type: 'implemented_by',
        fromRef: 'REQ-LINT-001',
        toRef: 'TASK-LINT-001',
        scope: 'local',
      },
      {
        id: 'REL-LINT-ACCEPTED-001',
        type: 'accepted_by',
        fromRef: 'TASK-LINT-001',
        toRef: 'AC-LINT-001',
        scope: 'local',
      },
      {
        id: 'REL-LINT-VALIDATED-001',
        type: 'validated_by',
        fromRef: 'TASK-LINT-001',
        toRef: 'CMD-LINT-001',
        scope: 'local',
      },
    ],
    aliases: [],
    semanticHash: '',
    graphHash: '',
  };
  return rehash(graph);
}

function rehash(value) {
  const graph = structuredClone(value);
  const sorted = (rows, key) => [...rows].sort((left, right) =>
    String(left[key]).localeCompare(String(right[key])));
  const semantic = {
    nodes: sorted(graph.nodes, 'id'),
    relations: sorted(graph.relations, 'id'),
    aliases: sorted(graph.aliases, 'alias'),
  };
  graph.semanticHash = sha256Stable({
    domain: 'canonical-requirement-semantic/v1',
    ...semantic,
  });
  const { graphHash: _ignored, ...payload } = graph;
  graph.graphHash = sha256Stable({
    domain: 'canonical-requirement-graph/v2',
    payload,
  });
  return graph;
}

function mutate(mutator) {
  const graph = canonicalGraph();
  mutator(graph);
  return lintCanonicalRequirementGraph(rehash(graph));
}

function validLegacySource({
  taskPurpose = '- Purpose: implement FIX-01.',
  acceptanceOwner = '- Fix: FIX-01.',
  extra = [],
} = {}) {
  return [
    '# Compatibility Source Plan',
    '',
    'FIX-01: The implementation MUST preserve behavior.',
    '',
    '### AC-01: behavior preserved',
    '',
    acceptanceOwner,
    '- PASS: behavior is preserved.',
    '- Command: `node --test tests/behavior.test.js`.',
    '',
    '### WORK-01: implement preservation',
    '',
    taskPurpose,
    '- Acceptance: AC-01.',
    '- Red command: `node --test tests/behavior.test.js`.',
    '',
    ...extra,
  ].join('\n');
}

describe('CanonicalRequirementGraph semantic lint', () => {
  it('accepts a valid sparse canonical graph', () => {
    const result = lintCanonicalRequirementGraph(canonicalGraph());
    assert.equal(result.decision, 'pass', JSON.stringify(result.issueCodes));
  });

  it('enforces canonical ID grammar and kind consistency', () => {
    const grammar = mutate((graph) => {
      graph.nodes[0].id = 'MUST-BOGUS';
    });
    assert.equal(grammar.decision, 'block');
    assert.ok(grammar.issueCodes.includes('node_identity_grammar_invalid'));
    assert.ok(grammar.issueCodes.includes('node_kind_identity_mismatch'));
  });

  it('retains the explicit Requirements typed-ID compatibility lane', () => {
    const graph = canonicalGraph();
    graph.sourceAuthority.kind = 'requirements_semantic_ir';
    graph.sourceAuthority.schemaVersion = 'requirements-contract-typed-source-graph/v2';
    graph.typedSourceGraphHash = `sha256:${'b'.repeat(64)}`;
    graph.nodes[1].id = 'WORK-alpha';
    graph.nodes[1].attributes.compatibilityIdentity = 'requirements_typed_source_id';
    for (const node of graph.nodes) {
      if (node.ownerRef === 'TASK-LINT-001') node.ownerRef = 'WORK-alpha';
    }
    for (const relation of graph.relations) {
      if (relation.fromRef === 'TASK-LINT-001') relation.fromRef = 'WORK-alpha';
      if (relation.toRef === 'TASK-LINT-001') relation.toRef = 'WORK-alpha';
    }
    const result = lintCanonicalRequirementGraph(rehash(graph));
    assert.equal(result.decision, 'pass', JSON.stringify(result.issueCodes));
  });

  it('rejects duplicate relation identities and incompatible endpoints', () => {
    const result = mutate((graph) => {
      graph.relations[1].id = graph.relations[0].id;
      graph.relations[2].type = 'implemented_by';
    });
    assert.ok(result.issueCodes.includes('relation_identity_invalid'));
    assert.ok(result.issueCodes.includes('relation_endpoint_type_invalid'));
  });

  it('rejects invalid owner type, self ownership, and ownership cycles', () => {
    const missing = mutate((graph) => {
      graph.nodes[2].ownerRef = null;
    });
    assert.ok(missing.issueCodes.includes('owner_reference_required'));

    const ownerType = mutate((graph) => {
      graph.nodes[2].ownerRef = 'CMD-LINT-001';
    });
    assert.ok(ownerType.issueCodes.includes('owner_type_invalid'));

    const self = mutate((graph) => {
      graph.nodes[2].ownerRef = 'AC-LINT-001';
    });
    assert.ok(self.issueCodes.includes('owner_self_reference_invalid'));

    const cycle = mutate((graph) => {
      graph.nodes[0].ownerRef = 'TASK-LINT-001';
    });
    assert.ok(cycle.issueCodes.includes('owner_cycle_invalid'));
  });

  it('rejects relation scope mismatches, purpose conflict, and unauthorized fan-out', () => {
    const scope = mutate((graph) => {
      graph.relations[0].scope = 'global';
    });
    assert.ok(scope.issueCodes.includes('relation_scope_invalid'));

    const purpose = mutate((graph) => {
      graph.nodes[0].attributes.prohibits = ['goal_contract_generation'];
    });
    assert.ok(purpose.issueCodes.includes('source_plan_purpose_conflict'));

    const fanout = mutate((graph) => {
      graph.relations[0].toRef = 'ALL_WORKS';
    });
    assert.ok(fanout.issueCodes.includes('global_fanout_unauthorized'));

    const global = mutate((graph) => {
      graph.nodes[1].scope = 'global';
    });
    assert.ok(global.issueCodes.includes('global_authority_missing'));
  });

  it('accepts an explicitly authorized global binding without imposing an edge budget', () => {
    const graph = canonicalGraph();
    graph.nodes[1].scope = 'global';
    for (const relation of graph.relations) {
      if (relation.fromRef === 'TASK-LINT-001') relation.scope = 'global';
    }
    graph.relations.push({
      id: 'REL-LINT-GLOBAL-001',
      type: 'globally_authorized_by',
      fromRef: 'TASK-LINT-001',
      toRef: 'REQ-LINT-001',
      scope: 'global',
    });
    const result = lintCanonicalRequirementGraph(rehash(graph));
    assert.equal(result.decision, 'pass', JSON.stringify(result.issueCodes));
  });
});

describe('legacy Source Plan lint normalization', () => {
  it('normalizes the frozen byte-identical real legacy fixture before returning ok', () => {
    const rawBytes = fs.readFileSync(REAL_LEGACY);
    assert.equal(rawBytes.length, 214296);
    assert.equal(
      createHash('sha256').update(rawBytes).digest('hex'),
      '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a'
    );
    const result = lintStandaloneSourcePlan({ sourcePath: REAL_LEGACY, rawBytes });
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.equal(result.detectedSourcePlanVersion, 'legacy/unversioned');
    assert.equal(result.normalizationState, 'legacy_normalized');
    assert.equal(result.nodeCount, 1140);
    assert.equal(result.relationCount, 6379);
  });

  it('fails closed for arbitrary Markdown that has no legacy Source Plan authority', () => {
    const result = lintStandaloneSourcePlan({
      sourcePath: 'notes.md',
      sourceText: '# Notes\n\nThis document contains no implementation authority.\n',
    });
    assert.equal(result.ok, false);
    assert.equal(result.normalizationState, 'rejected');
    assert.ok(result.issues.some(({ failureClass }) =>
      failureClass === 'legacy_source_plan_authority_missing'));
  });

  for (const [name, sourceText, expectedFailure] of [
    [
      'a Source Plan title with only a requirement declaration',
      '# Source Plan\n\nREQ-CORE-001: The compiler MUST preserve behavior.\n',
      'legacy_source_plan_authority_missing',
    ],
    [
      'an explicit MUST statement without executable authority',
      '# Source Plan\n\nThe document MUST contain no executable requirements.\n',
      'source_plan_purpose_conflict',
    ],
    [
      'an English purpose conflict',
      '# Source Plan\n\nNo executable requirements.\n',
      'source_plan_purpose_conflict',
    ],
    [
      'a Chinese purpose conflict',
      '# 需求源计划\n\n本计划不得包含可执行需求。\n',
      'source_plan_purpose_conflict',
    ],
  ]) {
    it(`fails closed for ${name}`, () => {
      const result = lintStandaloneSourcePlan({
        sourcePath: 'invalid-authority.md',
        sourceText,
      });
      assert.equal(result.ok, false);
      assert.equal(result.normalizationState, 'rejected');
      assert.ok(result.issues.some(({ failureClass }) => failureClass === expectedFailure));
    });
  }

  it('fails closed when legacy normalization finds duplicate declared IDs', () => {
    const result = lintStandaloneSourcePlan({
      sourcePath: 'duplicate.md',
      sourceText: [
        '# Compatibility Source Plan',
        '',
        'REQ-CORE-001: The compiler MUST preserve the first behavior.',
        '',
        'REQ-CORE-001: The compiler MUST preserve the second behavior.',
        '',
      ].join('\n'),
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(({ failureClass }) =>
      failureClass === 'source_obligation_id_duplicate'));
  });

  for (const conflict of [
    'Goal contract generation is prohibited.',
    'Prohibit generation of Goal contracts.',
    '禁止 Goal 合同生成。',
    '不得产出目标合同。',
  ]) {
    it(`rejects the normalized purpose-conflict claim: ${conflict}`, () => {
      const sourceText = validLegacySource({ extra: [conflict] });
      const result = lintStandaloneSourcePlan({
        sourcePath: 'purpose-conflict.md',
        sourceText,
      });
      const issue = result.issues.find(({ failureClass }) =>
        failureClass === 'source_plan_purpose_conflict');
      assert.ok(issue, JSON.stringify(result.issues));
      assert.equal(issue.lineStart, sourceText.split('\n').indexOf(conflict) + 1);
      assert.ok(issue.startByte > 0);
    });
  }

  it('retains legitimate execution boundaries without treating them as a purpose conflict', () => {
    const result = lintStandaloneSourcePlan({
      sourcePath: 'legitimate-boundaries.md',
      sourceText: validLegacySource({
        extra: [
          'CONTRACT-010: Do not generate child contracts, execute partition, start Goal, or run an authoring Judge.',
        ],
      }),
    });
    assert.equal(result.ok, true, JSON.stringify(result.issues));
  });

  it('rejects an isolated legacy FIX owner outside every executable closure', () => {
    const result = lintStandaloneSourcePlan({
      sourcePath: 'orphan-fix.md',
      sourceText: validLegacySource({
        extra: [
          '## Unassigned Requirements',
          '',
          'FIX-02: The implementation MUST preserve an unrelated behavior.',
        ],
      }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(({ failureClass, offendingId }) =>
      failureClass === 'legacy_source_requirement_orphaned' && offendingId === 'FIX-02'));
  });

  it('rejects an isolated legacy acceptance owner', () => {
    const result = lintStandaloneSourcePlan({
      sourcePath: 'orphan-acceptance.md',
      sourceText: validLegacySource({
        extra: ['### AC-02: unrelated acceptance'],
      }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(({ failureClass, offendingId }) =>
      failureClass === 'source_semantic_owner_missing' && offendingId === 'AC-02'));
  });

  it('rejects a WORK and verification chain with no requirement owner', () => {
    const result = lintStandaloneSourcePlan({
      sourcePath: 'ownerless-work.md',
      sourceText: validLegacySource({
        taskPurpose: '- Purpose: implement behavior.',
        acceptanceOwner: '- PASS: behavior remains stable.',
      }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(({ failureClass, offendingId }) =>
      failureClass === 'source_semantic_owner_missing' && offendingId === 'WORK-01'));
  });
});
