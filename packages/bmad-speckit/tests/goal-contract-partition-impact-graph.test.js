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
const {
  enumerateRepositoryFacts,
} = require('../src/utils/goal-contract/repository-facts.ts');

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

function partitionPlan({ reverse = false, windowsPaths = false } = {}) {
  const normalize = (value) =>
    windowsPaths ? value.replace(/\//gu, '\\') : value;
  const semantic = {
    schemaVersion: 'goal-contract-partition-plan/v1',
    orderedSourceSnapshotSetHash: hashControlPlaneValue({
      source: 'impact-graph',
    }),
    canonicalIntentSemanticHash: hashControlPlaneValue({
      obligations: 'impact-graph',
    }),
    executionProjectionHash: hashControlPlaneValue({
      projection: 'impact-graph',
    }),
    topologicalOrder: ['partition-p01', 'partition-p02'],
    dependencyEdges: [
      {
        fromPartitionId: 'partition-p01',
        toPartitionId: 'partition-p02',
      },
    ],
    partitions: [
      {
        partitionId: 'partition-p01',
        dependencyPartitionIds: [],
        ownedArtifactPaths: [normalize('src/base.ts')],
        commandIds: [],
      },
      {
        partitionId: 'partition-p02',
        dependencyPartitionIds: ['partition-p01'],
        ownedArtifactPaths: [
          normalize('src/consumer.ts'),
          normalize('src/new.ts'),
        ],
        commandIds: ['command-consumer-direct'],
      },
    ],
  };
  if (reverse) {
    semantic.partitions.reverse();
    semantic.dependencyEdges.reverse();
    for (const partition of semantic.partitions) {
      partition.ownedArtifactPaths.reverse();
      partition.commandIds.reverse();
    }
  }
  return {
    ...semantic,
    partitionPlanHash: hashControlPlaneValue(semantic),
  };
}

function reconciledGraph({ reverse = false } = {}) {
  const graph = {
    commands: {
      direct: [
        command(
          'command-consumer-direct',
          'node --test src/consumer.ts'
        ),
      ],
      impacted: [],
      integration: [],
      regression: [],
    },
  };
  if (reverse) graph.commands.direct.reverse();
  return graph;
}

function fixture() {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'goal-impact-graph-')
  );
  write(repositoryRoot, 'src/base.ts', 'export const value = 1;\n');
  write(
    repositoryRoot,
    'src/consumer.ts',
    "import { value } from './base';\nexport const result = value;\n"
  );
  return repositoryRoot;
}

function compileInput(overrides = {}) {
  return {
    repositoryRoot: fixture(),
    packageRoot: REPO_ROOT,
    partitionPlan: partitionPlan(),
    reconciledGraph: reconciledGraph(),
    ...overrides,
  };
}

describe('goal-contract partition impact graph', () => {
  it('loads one immutable bounded package-owned impact policy', () => {
    const loadPartitionImpactPolicy = requireFunction(
      'loadPartitionImpactPolicy'
    );
    const policy = loadPartitionImpactPolicy({ packageRoot: REPO_ROOT });

    assert.equal(
      policy.schemaVersion,
      'goal-contract-partition-impact-policy/v1'
    );
    assert.equal(policy.allowedRoots[0], '.');
    assert.equal(policy.maxBytesPerFile, 1048576);
    assert.equal(policy.maxAggregateBytes, 268435456);
    assert.ok(policy.excludedPathPrefixes.includes('.claude/'));
    assert.ok(policy.excludedPathPrefixes.includes('.codex/'));
    assert.ok(policy.excludedPathPrefixes.includes('.cursor/'));
    assert.ok(policy.excludedPathPrefixes.includes('.tmp/'));
    assert.ok(policy.excludedPathPrefixes.includes('.worktrees/'));
    assert.ok(policy.excludedPathPrefixes.includes('Devclaw-scope/'));
    assert.ok(policy.excludedPathPrefixes.includes('docs/plans/'));
    assert.ok(policy.excludedPathPrefixes.includes('outputs/'));
    assert.equal(policy.unsupportedSyntaxDecision, 'blocked');
    assert.match(policy.partitionImpactPolicyHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(Object.isFrozen(policy), true);
  });

  it('compiles current-byte artifact, command, partition, and static relation authority', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const graph = compilePartitionImpactGraph(input);
    const artifactByPath = new Map(
      graph.artifactNodes.map((artifact) => [artifact.path, artifact])
    );
    const importEdge = graph.relationEdges.find(
      (edge) => edge.relationKind === 'static_import'
    );

    assert.equal(
      graph.schemaVersion,
      'goal-contract-partition-impact-graph/v1'
    );
    assert.equal(artifactByPath.get('src/base.ts').plannedOperation, 'modify');
    assert.equal(
      artifactByPath.get('src/base.ts').ownerPartitionId,
      'partition-p01'
    );
    assert.equal(
      artifactByPath.get('src/consumer.ts').fileHash,
      sha256(
        "import { value } from './base';\nexport const result = value;\n"
      )
    );
    assert.equal(artifactByPath.get('src/new.ts').existenceState, 'planned');
    assert.equal(artifactByPath.get('src/new.ts').plannedOperation, 'create');
    assert.ok(importEdge);
    assert.equal(importEdge.evidencePath, 'src/consumer.ts');
    assert.deepEqual(
      graph.commandNodes.map(({ commandId, commandOwnerPartitionId }) => ({
        commandId,
        commandOwnerPartitionId,
      })),
      [
        {
          commandId: 'command-consumer-direct',
          commandOwnerPartitionId: 'partition-p02',
        },
      ]
    );
    assert.match(graph.repositoryTreeHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(typeof enumerateRepositoryFacts, 'function');
    assert.match(graph.repositoryFactsHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(graph.impactGraphHash, /^sha256:[0-9a-f]{64}$/u);
  });

  it('fails closed when a required governed path is a symlink', (t) => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const linkPath = path.join(input.repositoryRoot, 'src', 'base.ts');
    fs.unlinkSync(linkPath);
    write(input.repositoryRoot, 'src/base-target.ts', 'export const value = 1;\n');
    try {
      fs.symlinkSync('base-target.ts', linkPath, 'file');
    } catch (error) {
      if (
        process.platform === 'win32' &&
        ['EPERM', 'EACCES'].includes(error.code)
      ) {
        t.skip('Windows host does not permit file symlink creation');
        return;
      }
      throw error;
    }

    assert.throws(
      () => compilePartitionImpactGraph(input),
      (error) =>
        error.failureClass === 'partition_impact_required_path_symlink' &&
        error.path === 'src/base.ts'
    );
  });

  it('fails closed when a required governed path traverses a symlink directory', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const sourcePath = path.join(input.repositoryRoot, 'src');
    const targetPath = path.join(input.repositoryRoot, 'linked-src');
    fs.renameSync(sourcePath, targetPath);
    fs.symlinkSync(targetPath, sourcePath, 'junction');

    assert.throws(
      () => compilePartitionImpactGraph(input),
      (error) =>
        error.failureClass === 'partition_impact_required_path_symlink' &&
        error.path === 'src'
    );
  });

  it('excludes configured generated directories at any repository path boundary', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const repositoryRoot = fixture();
    write(
      repositoryRoot,
      'sandboxes/consumer/node_modules/example/index.js',
      'export const installed = true;\n'
    );
    write(
      repositoryRoot,
      'packages/example/dist/generated.js',
      'export const generated = true;\n'
    );

    const graph = compilePartitionImpactGraph({
      repositoryRoot,
      packageRoot: REPO_ROOT,
      partitionPlan: partitionPlan(),
      reconciledGraph: reconciledGraph(),
    });
    const artifactPaths = graph.artifactNodes.map((artifact) => artifact.path);

    assert.equal(
      artifactPaths.includes(
        'sandboxes/consumer/node_modules/example/index.js'
      ),
      false
    );
    assert.equal(
      artifactPaths.includes('packages/example/dist/generated.js'),
      false
    );
  });

  it('ignores import-shaped text outside executable code', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const repositoryRoot = fixture();
    write(
      repositoryRoot,
      'src/consumer.ts',
      [
        "const quoted = \"import('../../outside')\";",
        "const templated = `require('../../outside')`;",
        "/* import '../../outside'; */",
        "import { value } from './base';",
        'export const result = value;',
        '',
      ].join('\n')
    );

    const graph = compilePartitionImpactGraph({
      repositoryRoot,
      packageRoot: REPO_ROOT,
      partitionPlan: partitionPlan(),
      reconciledGraph: reconciledGraph(),
    });
    const consumerEdges = graph.relationEdges.filter(
      (edge) => edge.evidencePath === 'src/consumer.ts'
    );

    assert.equal(consumerEdges.length, 1);
    assert.equal(consumerEdges[0].relationKind, 'static_import');
  });

  it('is byte deterministic across enumeration, object, and path ordering', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const repositoryRoot = fixture();
    const forward = compilePartitionImpactGraph({
      repositoryRoot,
      packageRoot: REPO_ROOT,
      partitionPlan: partitionPlan(),
      reconciledGraph: reconciledGraph(),
    });
    const reversed = compilePartitionImpactGraph({
      repositoryRoot,
      packageRoot: REPO_ROOT,
      partitionPlan: partitionPlan({
        reverse: true,
        windowsPaths: true,
      }),
      reconciledGraph: reconciledGraph({ reverse: true }),
    });

    assert.equal(
      stableControlPlaneStringify(forward),
      stableControlPlaneStringify(reversed)
    );
    assert.equal(forward.impactGraphHash, reversed.impactGraphHash);
  });

  it('treats one command required by every partition as baseline authority', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const plan = partitionPlan();
    plan.partitions[0].commandIds = [
      'command-consumer-direct',
    ];
    const { partitionPlanHash: _ignored, ...semantic } = plan;
    plan.partitionPlanHash = hashControlPlaneValue(semantic);

    const graph = compilePartitionImpactGraph({
      repositoryRoot: fixture(),
      packageRoot: REPO_ROOT,
      partitionPlan: plan,
      reconciledGraph: reconciledGraph(),
    });

    assert.equal(graph.commandNodes.length, 1);
    assert.equal(
      graph.commandNodes[0].commandOwnerPartitionId,
      'baseline'
    );
  });

  it('rejects authority injection, path escape, duplicate ownership, and graph tampering', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const verifyPartitionImpactGraph = requireFunction(
      'verifyPartitionImpactGraph'
    );
    const input = compileInput();

    assert.throws(
      () =>
        compilePartitionImpactGraph({
          ...input,
          artifactNodes: [],
        }),
      (error) =>
        error.failureClass === 'partition_impact_authority_injection'
    );
    assert.throws(
      () =>
        compilePartitionImpactGraph({
          ...input,
          partitionPlan: {
            ...input.partitionPlan,
            partitions: input.partitionPlan.partitions.map(
              (partition, index) => ({
                ...partition,
                ownedArtifactPaths:
                  index === 0 ? ['../escape.ts'] : partition.ownedArtifactPaths,
              })
            ),
          },
        }),
      (error) => error.failureClass === 'partition_impact_path_escape'
    );
    assert.throws(
      () =>
        compilePartitionImpactGraph({
          ...input,
          partitionPlan: {
            ...input.partitionPlan,
            partitions: input.partitionPlan.partitions.map((partition) => ({
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                'src/shared.ts',
              ],
            })),
          },
        }),
      (error) => error.failureClass === 'partition_impact_owner_ambiguous'
    );

    const graph = compilePartitionImpactGraph(input);
    assert.throws(
      () =>
        verifyPartitionImpactGraph({
          ...input,
          graph: {
            ...graph,
            impactGraphHash: hashControlPlaneValue({ forged: true }),
          },
        }),
      (error) => error.failureClass === 'partition_impact_graph_hash_mismatch'
    );
  });

  it('keeps an impacted repository consumer under baseline authority', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const baselineConsumerInput = compileInput();
    baselineConsumerInput.partitionPlan = {
      ...baselineConsumerInput.partitionPlan,
      partitions: baselineConsumerInput.partitionPlan.partitions.map(
        (partition) => ({
          ...partition,
          ownedArtifactPaths: partition.ownedArtifactPaths.filter(
            (artifactPath) => artifactPath !== 'src/consumer.ts'
          ),
        })
      ),
    };
    const graph = compilePartitionImpactGraph(baselineConsumerInput);
    const consumer = graph.artifactNodes.find(
      ({ path: artifactPath }) => artifactPath === 'src/consumer.ts'
    );
    assert.equal(consumer.ownerPartitionId, 'baseline');
    assert.equal(consumer.mutable, false);
  });

  it('fails closed on unsupported closure syntax', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const unsupportedInput = compileInput();
    write(
      unsupportedInput.repositoryRoot,
      'src/consumer.ts',
      "const target = './base';\nexport const pending = import(target);\n"
    );
    assert.throws(
      () => compilePartitionImpactGraph(unsupportedInput),
      (error) => {
        assert.equal(
          error.failureClass,
          'partition_impact_coverage_incomplete'
        );
        assert.equal(error.sourcePath, 'src/consumer.ts');
        assert.equal(error.relationClass, 'dynamic_module_specifier');
        return true;
      }
    );
  });

  it('ignores dynamic module paths rooted in external temporary directories', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath = 'packages/bmad-speckit/tests/external-runtime-loader.test.js';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        "const fs = require('fs');",
        "const os = require('os');",
        "const path = require('path');",
        "const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-'));",
        "const packageRoot = path.join(tempRoot, 'package');",
        "require(path.join(packageRoot, 'dist/runtime.js'));",
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath }) => evidencePath === loaderPath
      ),
      false
    );
  });

  it('retains oversized baseline sources as hash-only relation targets', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const targetPath = 'src/oversized.ts';
    const consumerPath = 'src/oversized-consumer.ts';
    write(
      input.repositoryRoot,
      targetPath,
      `export const value = 1;\n${' '.repeat(1048576)}`
    );
    write(
      input.repositoryRoot,
      consumerPath,
      "import { value } from './oversized';\nexport { value };\n"
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p02'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                consumerPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);
    const artifactById = new Map(
      graph.artifactNodes.map((artifact) => [artifact.artifactId, artifact])
    );
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath, toNodeId }) =>
          evidencePath === consumerPath &&
          artifactById.get(toNodeId)?.path === targetPath
      ),
      true
    );
    assert.equal(
      graph.artifactNodes.find((artifact) => artifact.path === targetPath)
        ?.ownerPartitionId,
      'baseline'
    );
  });

  it('resolves constant literal module-path bindings', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath = 'packages/bmad-speckit/tests/fixture-loader.test.js';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        "const MODULE_PATH = '../../../src/base';",
        'const { value } = require(MODULE_PATH);',
        'module.exports = { value };',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath, relationKind, toNodeId }) =>
          evidencePath === loaderPath &&
          relationKind === 'commonjs_require' &&
          graph.artifactNodes.find((artifact) => artifact.artifactId === toNodeId)
            ?.path === 'src/base.ts'
      ),
      true
    );
  });

  it('allows only the package-owned goal-contract runtime loaders', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath = 'packages/bmad-speckit/src/commands/goal-contract.ts';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        '/* goal-contract-source-runtime:start */',
        'function loadDistModule(relativePath) {',
        "  return require(path.join(PACKAGE_ROOT, 'dist', relativePath));",
        '}',
        'function loadPartitionModule(relativePath) {',
        '  return require(resolvePartitionModulePath(relativePath));',
        '}',
        'function loadRenderer() {',
        '  return require(resolveRendererPath());',
        '}',
        'function loadCommandPortabilityChecker() {',
        '  return require(resolveCommandPortabilityCheckerPath());',
        '}',
        '/* goal-contract-source-runtime:end */',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    try {
      compilePartitionImpactGraph(input);
    } catch (error) {
      assert.fail(
        JSON.stringify({
          message: error.message,
          ...error,
        })
      );
    }
  });

  it('allows the package-owned shared skill runtime resolver', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath = '_bmad/shared/skill-runtime/resolve-bmad-runtime.js';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        'function unique(values) { return values; }',
        'function modulePathExists(candidate) { return Boolean(candidate); }',
        'function requireRootPackageDependency(name) {',
        '  const resolvePaths = unique([process.cwd(), __dirname]);',
        '  return require(require.resolve(name, { paths: resolvePaths }));',
        '}',
        'function requireBmadSpeckit(subpath = "") {',
        '  const packageRequest = subpath || "bmad-speckit";',
        '  const resolvePaths = unique([process.cwd(), __dirname]);',
        '  try {',
        '    return require(require.resolve(packageRequest, { paths: resolvePaths }));',
        '  } catch {}',
        '  const candidate = packageRequest;',
        '  if (!modulePathExists(candidate)) throw new Error("not found");',
        '  return require(candidate);',
        '}',
        'module.exports = { requireBmadSpeckit, requireRootPackageDependency };',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    try {
      compilePartitionImpactGraph(input);
    } catch (error) {
      assert.fail(
        JSON.stringify({
          message: error.message,
          ...error,
        })
      );
    }
  });

  it('allows the package-owned Wave 3.12 action registry loader', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath = 'packages/bmad-speckit/src/main-agent/runtime.ts';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        'const WAVE_3_12_PACKAGE_RUNTIME_ACTIONS = {',
        "  'fixture-action': ['./actions/fixture-action', 'runFixtureAction'],",
        '};',
        'function loadWave312PackageRuntimeAction(action) {',
        '  const definition = WAVE_3_12_PACKAGE_RUNTIME_ACTIONS[action];',
        '  if (!definition) return null;',
        '  const [modulePath, exportName] = definition;',
        '  return require(modulePath)[exportName];',
        '}',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    assert.doesNotThrow(() => compilePartitionImpactGraph(input));
  });

  it('allows the package-owned authority supersession loaders', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath =
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/authority-supersession.ts';
    write(
      input.repositoryRoot,
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/partition-output-paths.ts',
      'export const partitionOutputPaths = true;\n'
    );
    write(
      input.repositoryRoot,
      'packages/bmad-speckit/src/utils/goal-contract/partition-receipts.ts',
      'export const partitionReceipts = true;\n'
    );
    write(
      input.repositoryRoot,
      'packages/bmad-speckit/src/utils/large-document-writer/receipts.ts',
      'export const receipts = true;\n'
    );
    write(
      input.repositoryRoot,
      loaderPath,
      [
        'const {',
        '  preflightRequirementRecordPartitionAuthoritySupersession,',
        '} = require(',
        "  `./partition-output-paths${__filename.endsWith('.ts') ? '.ts' : ''}`",
        ');',
        'function loadGoalContractModule(relativePath) {',
        '  return require(',
        '    __filename.endsWith(\'.ts\')',
        '      ? `../${relativePath}.ts`',
        '      : `../${relativePath}`',
        '  );',
        '}',
        'function canonicalReceiptBytes() {',
        '  const { stableStringify } = require(',
        "    __filename.endsWith('.ts')",
        "      ? '../../large-document-writer/receipts.ts'",
        "      : '../../large-document-writer/receipts'",
        '  );',
        '  return stableStringify({});',
        '}',
        'function loadRequirementRecordControlStore() {',
        '  const candidates = [',
        "    path.resolve(__dirname, '../../../../../../src/base.ts'),",
        '  ];',
        '  const modulePath = candidates.find((candidate) => fs.existsSync(candidate));',
        '  return require(modulePath);',
        '}',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);

    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath, relationKind, toNodeId }) =>
          evidencePath === loaderPath &&
          relationKind === 'commonjs_require' &&
          graph.artifactNodes.find((artifact) => artifact.artifactId === toNodeId)
            ?.path === 'src/base.ts'
      ),
      true
    );
  });

  it('resolves static calls through a package-owned relative module loader', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath =
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/index.ts';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        'function modulePath(relativePath: string): string {',
        "  return `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;",
        '}',
        "const { value } = require(modulePath('../../../../../../src/base'));",
        'export { value };',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath, relationKind, toNodeId }) =>
          evidencePath === loaderPath &&
          relationKind === 'commonjs_require' &&
          graph.artifactNodes.find((artifact) => artifact.artifactId === toNodeId)
            ?.path === 'src/base.ts'
      ),
      true
    );
  });

  it('resolves direct dirname template module loaders', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath =
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/partition-output-paths.ts';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        'const { value } = require(',
        "  `${__dirname}/../../../../../../src/base${__filename.endsWith('.ts') ? '.ts' : ''}`",
        ');',
        'export { value };',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath, relationKind, toNodeId }) =>
          evidencePath === loaderPath &&
          relationKind === 'commonjs_require' &&
          graph.artifactNodes.find((artifact) => artifact.artifactId === toNodeId)
            ?.path === 'src/base.ts'
      ),
      true
    );
  });

  it('resolves dirname path-join conditional module loaders', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath = 'packages/bmad-speckit/src/utils/goal-contract/goal-contract-receipts.ts';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        'const { value } = require(',
        '  __filename.endsWith(\'.ts\')',
        "    ? path.join(__dirname, '..', '..', '..', '..', '..', 'src', 'base')",
        "    : '../../../../../src/base'",
        ');',
        'export { value };',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath, relationKind, toNodeId }) =>
          evidencePath === loaderPath &&
          relationKind === 'commonjs_require' &&
          graph.artifactNodes.find((artifact) => artifact.artifactId === toNodeId)
            ?.path === 'src/base.ts'
      ),
      true
    );
  });

  it('resolves conditional module-path assignments', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    const loaderPath =
      'packages/bmad-speckit/src/utils/goal-contract/partition-receipts.ts';
    write(
      input.repositoryRoot,
      loaderPath,
      [
        'const modulePath = __filename.endsWith(\'.ts\')',
        "  ? './missing.ts'",
        "  : fs.existsSync(path.join(__dirname, 'missing.js'))",
        "    ? './missing'",
        "    : path.join(__dirname, '..', '..', '..', '..', '..', 'src', 'base.ts');",
        'const { value } = require(modulePath);',
        'export { value };',
      ].join('\n')
    );
    const { partitionPlanHash: ignored, ...partitionPlanAuthority } =
      input.partitionPlan;
    input.partitionPlan = {
      ...partitionPlanAuthority,
      partitions: partitionPlanAuthority.partitions.map((partition) =>
        partition.partitionId === 'partition-p01'
          ? {
              ...partition,
              ownedArtifactPaths: [
                ...partition.ownedArtifactPaths,
                loaderPath,
              ],
            }
          : partition
      ),
    };
    input.partitionPlan.partitionPlanHash = hashControlPlaneValue(
      input.partitionPlan
    );

    const graph = compilePartitionImpactGraph(input);
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath, relationKind, toNodeId }) =>
          evidencePath === loaderPath &&
          relationKind === 'commonjs_require' &&
          graph.artifactNodes.find((artifact) => artifact.artifactId === toNodeId)
            ?.path === 'src/base.ts'
      ),
      true
    );
  });

  it('does not block on static relations into excluded generated paths', () => {
    const compilePartitionImpactGraph = requireFunction(
      'compilePartitionImpactGraph'
    );
    const input = compileInput();
    write(
      input.repositoryRoot,
      'src/consumer.ts',
      "require(\n  '../dist/generated.js'\n);\nexport const result = 1;\n"
    );

    const graph = compilePartitionImpactGraph(input);

    assert.equal(graph.unsupportedRelationRecords.length, 0);
    assert.equal(
      graph.relationEdges.some(
        ({ evidencePath }) => evidencePath === 'src/consumer.ts'
      ),
      false
    );
  });
});
