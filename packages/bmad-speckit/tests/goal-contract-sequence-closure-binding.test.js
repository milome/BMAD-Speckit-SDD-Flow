const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, describe, it } = require('node:test');

const {
  resolveCanonicalSequenceClosureBinding,
} = require('../src/utils/goal-contract/sequence-closure-binding.ts');

const ACTION_ID = 'requirements-contract-sequence-closure-compile';
const ACTION_EXPORT = 'compileCanonicalSequenceClosure';
const HASHES = {
  sourceAuthorityHash: `sha256:${'a'.repeat(64)}`,
  semanticModelHash: `sha256:${'b'.repeat(64)}`,
  traceGraphHash: `sha256:${'c'.repeat(64)}`,
};
const roots = [];

function sha256File(filePath) {
  return `sha256:${createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex')}`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function createPackage({
  bundleMutator = null,
  freezeMutator = null,
  manifestMutator = null,
  moduleMode = 'valid',
  resultMutator = null,
} = {}) {
  const packageRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sequence-closure-binding-')
  );
  roots.push(packageRoot);
  const artifactRoot = path.join(packageRoot, 'sequence-artifacts');
  const sequenceContractPath = path.join(
    artifactRoot,
    'sequence-contract.json'
  );
  const interfaceContractSetPath = path.join(
    artifactRoot,
    'interface-contract-set.json'
  );
  const sequenceClosureBundlePath = path.join(
    artifactRoot,
    'sequence-closure-bundle.json'
  );
  const interfaceFreezeReceiptPath = path.join(
    artifactRoot,
    'interface-freeze-receipt.json'
  );
  writeJson(sequenceContractPath, {
    schemaVersion: 'sequence-contract/v1',
    scenarios: [{ scenarioId: 'SCENARIO-1' }],
  });
  writeJson(interfaceContractSetPath, {
    schemaVersion: 'semantic-interface-contract-set/v1',
    interfaces: [{ interfaceId: 'INTERFACE-1' }],
  });
  const bundle = {
    schemaVersion: 'sequence-closure-bundle/v1',
    ownershipConstraints: [{ participantRef: 'PARTICIPANT-1' }],
    interfaceConstraints: [{ interfaceRef: 'INTERFACE-1' }],
    implementationDependencyConstraints: [],
    writeScopeConstraints: [],
    integrationJoinConstraints: [],
    evidenceConstraints: [],
    invalidationIndex: { 'INTERFACE-1': ['PARTICIPANT-1'] },
  };
  bundleMutator?.(bundle);
  writeJson(sequenceClosureBundlePath, bundle);
  const sequenceContractHash = sha256File(sequenceContractPath);
  const interfaceContractSetHash = sha256File(interfaceContractSetPath);
  const sequenceClosureBundleHash = sha256File(sequenceClosureBundlePath);
  const freezeReceipt = {
    schemaVersion: 'sequence-interface-freeze-receipt/v1',
    decision: 'pass',
    ...HASHES,
    sequenceContractHash,
    interfaceContractSetHash,
    sequenceClosureBundleHash,
  };
  freezeMutator?.(freezeReceipt);
  writeJson(interfaceFreezeReceiptPath, freezeReceipt);
  const result = {
    ...HASHES,
    sequenceContractRef: path.relative(packageRoot, sequenceContractPath),
    sequenceContractHash,
    interfaceContractSetRef: path.relative(
      packageRoot,
      interfaceContractSetPath
    ),
    interfaceContractSetHash,
    sequenceClosureBundleRef: path.relative(
      packageRoot,
      sequenceClosureBundlePath
    ),
    sequenceClosureBundleHash,
    interfaceFreezeReceiptRef: path.relative(
      packageRoot,
      interfaceFreezeReceiptPath
    ),
    interfaceFreezeReceiptHash: sha256File(interfaceFreezeReceiptPath),
    sequenceClosureBundle: bundle,
  };
  resultMutator?.(result);
  const modulePath = path.join(
    packageRoot,
    'dist',
    'main-agent',
    'source-authority',
    'scripts',
    'requirements-contract-sequence-closure-compile.js'
  );
  if (moduleMode === 'valid') {
    writeText(
      modulePath,
      `module.exports = { ${ACTION_EXPORT}: async () => (${JSON.stringify(
        result
      )}) };\n`
    );
  } else if (moduleMode === 'missing-export') {
    writeText(modulePath, 'module.exports = {};\n');
  }
  const moduleRelativePath = path.relative(packageRoot, modulePath);
  const moduleHash = fs.existsSync(modulePath)
    ? sha256File(modulePath)
    : `sha256:${'0'.repeat(64)}`;
  const manifest = {
    schemaVersion:
      'requirements-contract-package-runtime-action-binding-manifest/v2',
    decision: 'pass',
    actions: [
      {
        actionId: ACTION_ID,
        packageDistRef: {
          path: moduleRelativePath,
          hash: moduleHash,
        },
        installedSurfaceRefs: [
          {
            path: moduleRelativePath,
            hash: moduleHash,
          },
        ],
        semanticGate: {
          gateId: `${ACTION_ID}:semantic-gate`,
          sourceSymbol: ACTION_EXPORT,
          distSymbol: ACTION_EXPORT,
        },
        routingOnly: false,
      },
    ],
  };
  manifestMutator?.(manifest);
  writeJson(
    path.join(
      packageRoot,
      '_bmad',
      'shared',
      'requirements-contract',
      'requirements-contract-package-runtime-action-binding-manifest.json'
    ),
    manifest
  );
  return {
    interfaceFreezeReceiptPath,
    packageRoot,
  };
}

async function resolve(packageRoot) {
  return resolveCanonicalSequenceClosureBinding({
    packageRoot,
    ...HASHES,
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('goal-contract Sequence Closure binding', () => {
  it('fails closed when the current canonical producer is unavailable', async () => {
    await assert.rejects(
      resolve(path.resolve(__dirname, '..')),
      (error) =>
        error.failureClass === 'sequence_closure_required_unavailable'
    );
  });

  it('rejects a missing producer module or stable action export', async () => {
    for (const moduleMode of ['missing', 'missing-export']) {
      const scenario = createPackage({ moduleMode });
      await assert.rejects(
        resolve(scenario.packageRoot),
        (error) =>
          error.failureClass === 'sequence_closure_required_unavailable'
      );
    }
  });

  it('rejects stale Sequence artifact hashes', async () => {
    const cases = [
      ['sequenceContractHash', 'sequence_contract_hash_mismatch'],
      ['interfaceContractSetHash', 'sequence_interface_contract_set_hash_mismatch'],
      ['sequenceClosureBundleHash', 'sequence_closure_bundle_hash_mismatch'],
      ['interfaceFreezeReceiptHash', 'sequence_interface_freeze_receipt_hash_mismatch'],
    ];
    for (const [field, failureClass] of cases) {
      const scenario = createPackage({
        resultMutator(result) {
          result[field] = `sha256:${'f'.repeat(64)}`;
        },
      });
      await assert.rejects(
        resolve(scenario.packageRoot),
        (error) => error.failureClass === failureClass
      );
    }
  });

  it('rejects a missing, blocked, or stale Interface Freeze Receipt', async () => {
    const missing = createPackage();
    fs.rmSync(missing.interfaceFreezeReceiptPath);
    await assert.rejects(
      resolve(missing.packageRoot),
      (error) =>
        error.failureClass === 'sequence_interface_freeze_receipt_missing'
    );

    const blocked = createPackage({
      freezeMutator(receipt) {
        receipt.decision = 'block';
      },
    });
    await assert.rejects(
      resolve(blocked.packageRoot),
      (error) =>
        error.failureClass === 'sequence_interface_freeze_receipt_blocked'
    );

    const stale = createPackage({
      freezeMutator(receipt) {
        receipt.sequenceContractHash = `sha256:${'e'.repeat(64)}`;
      },
    });
    await assert.rejects(
      resolve(stale.packageRoot),
      (error) =>
        error.failureClass === 'sequence_interface_freeze_receipt_stale'
    );
  });

  it('rejects a second task universe in the Sequence Closure Bundle', async () => {
    for (const field of [
      'atomicTasks',
      'taskDag',
      'partitionCount',
      'partitions',
      'atomicImplementationTaskList',
      'implementationTaskDag',
    ]) {
      const scenario = createPackage({
        bundleMutator(bundle) {
          bundle[field] = [];
        },
      });
      await assert.rejects(
        resolve(scenario.packageRoot),
        (error) =>
          error.failureClass === 'sequence_second_task_universe_forbidden' &&
          error.forbiddenFields.includes(field)
      );
    }
  });

  it('rejects Mermaid, Diagram Set, and empty constraints as semantic input', async () => {
    for (const [field, value] of [
      ['mermaid', 'sequenceDiagram'],
      ['diagramSet', { diagrams: [] }],
    ]) {
      const scenario = createPackage({
        bundleMutator(bundle) {
          bundle[field] = value;
        },
      });
      await assert.rejects(
        resolve(scenario.packageRoot),
        (error) =>
          error.failureClass === 'sequence_diagram_semantic_source_forbidden'
      );
    }

    const empty = createPackage({
      bundleMutator(bundle) {
        bundle.ownershipConstraints = [];
        bundle.interfaceConstraints = [];
        bundle.invalidationIndex = {};
      },
    });
    await assert.rejects(
      resolve(empty.packageRoot),
      (error) => error.failureClass === 'sequence_closure_constraints_empty'
    );
  });

  it('rejects producer results bound to stale semantic roots', async () => {
    const scenario = createPackage({
      resultMutator(result) {
        result.semanticModelHash = `sha256:${'d'.repeat(64)}`;
      },
    });
    await assert.rejects(
      resolve(scenario.packageRoot),
      (error) =>
        error.failureClass === 'sequence_constraint_hash_mismatch' &&
        error.staleFields.includes('semanticModelHash')
    );
  });

  it(
    'consumes the real canonical Sequence Closure producer',
    { skip: 'canonical Sequence Closure producer is not published' },
    async () => {}
  );
});
