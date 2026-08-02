const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const controlPlane = require('../src/utils/goal-contract/control-plane/index.ts');
const {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function requireFunction(name) {
  assert.equal(typeof controlPlane[name], 'function', `${name} must be exported`);
  return controlPlane[name];
}

function write(root, relativePath, contents) {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
}

function command(commandId, literal) {
  return {
    id: commandId,
    literal,
    commandTextHash: sha256(literal),
    workingDirectory: '.',
    shell: 'host_shell',
    runtime: 'node',
    sourceBinding: {
      sourcePlanPath: 'docs/plans/source.md',
      lineStart: 1,
      lineEnd: 1,
      textHash: sha256(commandId),
      specSpanRefs: [],
    },
  };
}

function plan({
  colocated = false,
  dependent = true,
  commandTargetsBase = false,
  sharedCommandTargetsConsumer = false,
  sharedGovernedBySuccessor = false,
  partitionIds = ['partition-p01', 'partition-p02'],
} = {}) {
  const [firstPartitionId, secondPartitionId] = partitionIds;
  const partitions = colocated
    ? [
        {
          partitionId: firstPartitionId,
          dependencyPartitionIds: [],
          ownedArtifactPaths: ['src/base.ts', 'src/consumer.ts'],
          governedPaths: ['src/base.ts', 'src/consumer.ts'],
          commandIds: commandTargetsBase ? ['command-p01-direct'] : [],
        },
      ]
    : [
        {
          partitionId: firstPartitionId,
          dependencyPartitionIds: [],
          ownedArtifactPaths: ['src/base.ts'],
          governedPaths: ['src/base.ts'],
          commandIds: sharedCommandTargetsConsumer ? ['command-shared'] : [],
        },
        {
          partitionId: secondPartitionId,
          dependencyPartitionIds: dependent ? [firstPartitionId] : [],
          ownedArtifactPaths: ['src/consumer.ts'],
          governedPaths: [
            ...(sharedGovernedBySuccessor ? ['src/base.ts'] : []),
            'src/consumer.ts',
          ],
          commandIds: sharedCommandTargetsConsumer
            ? ['command-shared']
            : commandTargetsBase
              ? ['command-p02-direct']
              : [],
        },
      ];
  const semantic = {
    schemaVersion: 'goal-contract-partition-plan/v1',
    orderedSourceSnapshotSetHash: hashControlPlaneValue({
      source: 'feasibility',
    }),
    canonicalIntentSemanticHash: hashControlPlaneValue({
      obligations: 'feasibility',
    }),
    executionProjectionHash: hashControlPlaneValue({
      projection: 'feasibility',
    }),
    topologicalOrder: partitions.map(({ partitionId }) => partitionId),
    dependencyEdges: partitions.flatMap((partition) =>
      partition.dependencyPartitionIds.map((dependencyPartitionId) => ({
        fromPartitionId: dependencyPartitionId,
        toPartitionId: partition.partitionId,
      }))
    ),
    partitions,
  };
  return {
    ...semantic,
    partitionPlanHash: hashControlPlaneValue(semantic),
  };
}

function graphFixture(options = {}) {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'goal-feasibility-')
  );
  write(
    repositoryRoot,
    'src/base.ts',
    options.baseUsesConsumer === true
      ? "import { result } from './consumer';\nexport const value = result;\n"
      : 'export const value = 1;\n'
  );
  if (options.consumerPlanned !== true) {
    write(
      repositoryRoot,
      'src/consumer.ts',
      options.consumerUsesBase === false
        ? 'export const result = 1;\n'
        : "import { value } from './base';\nexport const result = value;\n"
    );
  }
  const partitionPlan = plan(options);
  const commandId = options.colocated
    ? 'command-p01-direct'
    : 'command-p02-direct';
  const reconciledGraph = {
    commands: {
      direct: options.sharedCommandTargetsConsumer
        ? [command('command-shared', 'node --test src/consumer.ts')]
        : options.commandTargetsBase
          ? [command(commandId, 'node --test src/base.ts')]
          : [],
      impacted: [],
      integration: [],
      regression: [],
    },
  };
  const compilePartitionImpactGraph = requireFunction(
    'compilePartitionImpactGraph'
  );
  return {
    impactGraph: compilePartitionImpactGraph({
      repositoryRoot,
      packageRoot: REPO_ROOT,
      partitionPlan,
      reconciledGraph,
    }),
    packageRoot: REPO_ROOT,
    partitionPlan,
  };
}

function sharedPredecessorBoundaryFixture() {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'goal-feasibility-shared-boundary-')
  );
  write(
    repositoryRoot,
    'src/shared.ts',
    "import { future } from './future';\nexport const shared = future;\n"
  );
  write(
    repositoryRoot,
    'src/consumer.ts',
    "import { shared } from './shared';\nexport const value = shared;\n"
  );
  write(repositoryRoot, 'src/future.ts', 'export const future = 1;\n');
  const partitions = [
    {
      partitionId: 'partition-p01',
      dependencyPartitionIds: [],
      ownedArtifactPaths: ['src/shared.ts'],
      governedPaths: ['src/shared.ts'],
      commandIds: [],
    },
    {
      partitionId: 'partition-p02',
      dependencyPartitionIds: ['partition-p01'],
      ownedArtifactPaths: ['src/consumer.ts'],
      governedPaths: ['src/consumer.ts'],
      commandIds: [],
    },
    {
      partitionId: 'partition-p03',
      dependencyPartitionIds: ['partition-p02'],
      ownedArtifactPaths: ['src/future.ts'],
      governedPaths: ['src/future.ts', 'src/shared.ts'],
      commandIds: [],
    },
  ];
  const semantic = {
    schemaVersion: 'goal-contract-partition-plan/v1',
    orderedSourceSnapshotSetHash: hashControlPlaneValue({
      source: 'shared-boundary',
    }),
    canonicalIntentSemanticHash: hashControlPlaneValue({
      obligations: 'shared-boundary',
    }),
    executionProjectionHash: hashControlPlaneValue({
      projection: 'shared-boundary',
    }),
    topologicalOrder: partitions.map(({ partitionId }) => partitionId),
    dependencyEdges: [
      {
        fromPartitionId: 'partition-p01',
        toPartitionId: 'partition-p02',
      },
      {
        fromPartitionId: 'partition-p02',
        toPartitionId: 'partition-p03',
      },
    ],
    partitions,
  };
  const partitionPlan = {
    ...semantic,
    partitionPlanHash: hashControlPlaneValue(semantic),
  };
  const compilePartitionImpactGraph = requireFunction(
    'compilePartitionImpactGraph'
  );
  return {
    impactGraph: compilePartitionImpactGraph({
      repositoryRoot,
      packageRoot: REPO_ROOT,
      partitionPlan,
      reconciledGraph: {
        commands: {
          direct: [],
          impacted: [],
          integration: [],
          regression: [],
        },
      },
    }),
    packageRoot: REPO_ROOT,
    partitionPlan,
  };
}

describe('goal-contract partition closure feasibility', () => {
  it('passes co-located closure and binds deterministic per-partition hashes', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const input = graphFixture({ colocated: true });
    const before = stableControlPlaneStringify(input.partitionPlan);
    const first = compilePartitionClosureFeasibility(input);
    const second = compilePartitionClosureFeasibility(input);

    assert.equal(first.decision, 'pass');
    assert.equal(first.blockingIssues.length, 0);
    assert.equal(first.partitionRecords.length, 1);
    assert.equal(
      Object.prototype.hasOwnProperty.call(first, 'partitionPlanHash'),
      false
    );
    assert.equal(
      first.partitionPlanBasisHash,
      input.impactGraph.partitionPlanBasisHash
    );
    assert.deepEqual(first.partitionRecords[0].availableOwnerSet, [
      'baseline',
      'partition-p01',
    ]);
    assert.match(
      first.partitionRecords[0].partitionClosureFeasibilityHash,
      /^sha256:[0-9a-f]{64}$/u
    );
    assert.equal(first.receiptHash, second.receiptHash);
    assert.equal(
      stableControlPlaneStringify(first),
      stableControlPlaneStringify(second)
    );
    assert.equal(stableControlPlaneStringify(input.partitionPlan), before);
  });

  it('preserves declared topological order when partition ids sort differently', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const input = graphFixture({
      partitionIds: ['partition-z-first', 'partition-a-second'],
      consumerUsesBase: false,
    });
    const receipt = compilePartitionClosureFeasibility(input);

    assert.equal(receipt.decision, 'pass');
    assert.deepEqual(
      receipt.partitionRecords.map(({ partitionId }) => partitionId),
      ['partition-z-first', 'partition-a-second']
    );
    assert.deepEqual(
      receipt.partitionRecords[1].availableOwnerSet,
      ['baseline', 'partition-a-second', 'partition-z-first']
    );
  });

  it('passes declared predecessor artifact and command dependencies', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const receipt = compilePartitionClosureFeasibility(
      graphFixture({ commandTargetsBase: true })
    );

    assert.equal(receipt.decision, 'pass');
    assert.equal(receipt.blockingIssues.length, 0);
  });

  it('does not treat shared regression command coverage as artifact availability', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const receipt = compilePartitionClosureFeasibility(
      graphFixture({ sharedCommandTargetsConsumer: true })
    );

    assert.equal(receipt.decision, 'pass');
    assert.equal(receipt.blockingIssues.length, 0);
  });

  it('stops at a shared artifact already governed by a predecessor', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const receipt = compilePartitionClosureFeasibility(
      sharedPredecessorBoundaryFixture()
    );

    assert.equal(receipt.decision, 'pass');
    assert.equal(receipt.blockingIssues.length, 0);
  });

  it('treats present descendant-owned artifacts as available interfaces', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const receipt = compilePartitionClosureFeasibility(
      graphFixture({
        baseUsesConsumer: true,
        consumerUsesBase: false,
      })
    );
    assert.equal(receipt.decision, 'pass');
    assert.equal(receipt.blockingIssues.length, 0);
  });

  it('attributes current shared-path bytes to the last governing partition', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const receipt = compilePartitionClosureFeasibility(
      graphFixture({
        baseUsesConsumer: true,
        consumerUsesBase: false,
        sharedGovernedBySuccessor: true,
      })
    );

    assert.equal(receipt.decision, 'pass');
    assert.equal(receipt.blockingIssues.length, 0);
  });

  it('blocks planned future-owned dependencies and reports the resulting cycle', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const receipt = compilePartitionClosureFeasibility(
      graphFixture({
        baseUsesConsumer: true,
        consumerPlanned: true,
      })
    );
    const p01 = receipt.partitionRecords.find(
      ({ partitionId }) => partitionId === 'partition-p01'
    );
    const issueCodes = p01.blockingIssues.map(({ issueCode }) => issueCode);

    assert.equal(receipt.decision, 'blocked');
    assert.ok(issueCodes.includes('future_owned_artifact_dependency'));
    assert.ok(issueCodes.includes('partition_closure_dependency_cycle'));
  });

  it('blocks missing declared predecessor dependencies on the consuming partition', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const input = graphFixture({ dependent: false });
    const before = stableControlPlaneStringify(input.partitionPlan);
    const receipt = compilePartitionClosureFeasibility(input);
    const p02 = receipt.partitionRecords.find(
      ({ partitionId }) => partitionId === 'partition-p02'
    );

    assert.ok(
      p02.blockingIssues.some(
        ({ issueCode, blockingOwnerPartitionId }) =>
          issueCode === 'future_owned_artifact_dependency' &&
          blockingOwnerPartitionId === 'partition-p01'
      )
    );
    assert.equal(
      p02.blockingIssues.some(
        ({ issueCode }) =>
          issueCode === 'partition_closure_dependency_cycle'
      ),
      false
    );
    assert.equal(stableControlPlaneStringify(input.partitionPlan), before);
  });

  it('fails closed on missing, ambiguous, and unsupported graph coverage', () => {
    const compilePartitionClosureFeasibility = requireFunction(
      'compilePartitionClosureFeasibility'
    );
    const input = graphFixture({ colocated: true });
    const missingOwnerSemantic = {
      ...input.impactGraph,
      artifactNodes: input.impactGraph.artifactNodes.map((artifact) =>
        artifact.path === 'src/consumer.ts'
          ? { ...artifact, ownerPartitionId: '' }
          : artifact
      ),
    };
    delete missingOwnerSemantic.impactGraphHash;
    const missingOwnerGraph = {
      ...missingOwnerSemantic,
      impactGraphHash: hashControlPlaneValue(missingOwnerSemantic),
    };
    assert.throws(
      () =>
        compilePartitionClosureFeasibility({
          ...input,
          impactGraph: missingOwnerGraph,
        }),
      (error) =>
        error.failureClass === 'partition_impact_owner_missing'
    );

    const baseArtifact = input.impactGraph.artifactNodes.find(
      ({ path: artifactPath }) => artifactPath === 'src/base.ts'
    );
    const ambiguousSemantic = {
      ...input.impactGraph,
      artifactNodes: [
        ...input.impactGraph.artifactNodes,
        {
          ...baseArtifact,
          artifactId: `artifact-${'f'.repeat(64)}`,
          ownerPartitionId: 'partition-p02',
        },
      ],
      graphStatistics: {
        ...input.impactGraph.graphStatistics,
        artifactNodeCount:
          input.impactGraph.graphStatistics.artifactNodeCount + 1,
      },
    };
    delete ambiguousSemantic.impactGraphHash;
    const ambiguousGraph = {
      ...ambiguousSemantic,
      impactGraphHash: hashControlPlaneValue(ambiguousSemantic),
    };
    assert.throws(
      () =>
        compilePartitionClosureFeasibility({
          ...input,
          impactGraph: ambiguousGraph,
        }),
      (error) =>
        error.failureClass === 'partition_impact_owner_ambiguous'
    );

    const unsupportedSemantic = {
      ...input.impactGraph,
      unsupportedRelationRecords: [
        {
          sourcePath: 'src/base.ts',
          line: 1,
          relationClass: 'dynamic_module_specifier',
          expressionHash: hashControlPlaneValue({
            expression: 'import(target)',
          }),
          requiredRemediation: 'register_supported_static_relation',
        },
      ],
      graphStatistics: {
        ...input.impactGraph.graphStatistics,
        unsupportedRelationCount: 1,
      },
    };
    delete unsupportedSemantic.impactGraphHash;
    const unsupportedGraph = {
      ...unsupportedSemantic,
      impactGraphHash: hashControlPlaneValue(unsupportedSemantic),
    };
    const unsupportedReceipt = compilePartitionClosureFeasibility({
      ...input,
      impactGraph: unsupportedGraph,
    });
    assert.ok(
      unsupportedReceipt.blockingIssues.some(
        ({ issueCode }) =>
          issueCode === 'partition_impact_coverage_incomplete'
      )
    );
  });
});
