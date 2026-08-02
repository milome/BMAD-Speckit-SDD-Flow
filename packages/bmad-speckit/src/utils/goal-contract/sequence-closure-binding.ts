const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  findForbiddenSequenceFields,
} = require('./sequence-applicability.ts');

export type GoalContractSequenceClosureBindingModule = never;

const ACTION_ID = 'requirements-contract-sequence-closure-compile';
const ACTION_EXPORT = 'compileCanonicalSequenceClosure';
const ACTION_MANIFEST_RELATIVE_PATH = path.join(
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-package-runtime-action-binding-manifest.json'
);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DIAGRAM_SEMANTIC_FIELDS = new Set(['diagramSet', 'mermaid']);
const CONSTRAINT_ARRAY_FIELDS = [
  'ownershipConstraints',
  'interfaceConstraints',
  'implementationDependencyConstraints',
  'writeScopeConstraints',
  'integrationJoinConstraints',
  'evidenceConstraints',
];

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256File(filePath) {
  return `sha256:${createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex')}`;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStrictlyWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolvePackageRoot(packageRoot) {
  if (
    typeof packageRoot !== 'string' ||
    packageRoot.length === 0 ||
    !fs.existsSync(packageRoot) ||
    !fs.statSync(packageRoot).isDirectory()
  ) {
    throw failure('sequence_closure_required_unavailable');
  }
  return fs.realpathSync(path.resolve(packageRoot));
}

function resolvePackageOwnedFile({
  packageRoot,
  relativePath,
  expectedHash,
  missingFailureClass,
  mismatchFailureClass,
}) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    !SHA256_PATTERN.test(expectedHash || '')
  ) {
    throw failure(mismatchFailureClass);
  }
  const candidatePath = path.resolve(packageRoot, relativePath);
  if (!isStrictlyWithin(packageRoot, candidatePath)) {
    throw failure(mismatchFailureClass);
  }
  if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isFile()) {
    throw failure(missingFailureClass || mismatchFailureClass);
  }
  let realPath;
  try {
    realPath = fs.realpathSync(candidatePath);
  } catch {
    throw failure(missingFailureClass || mismatchFailureClass);
  }
  if (
    !isStrictlyWithin(packageRoot, realPath) ||
    sha256File(realPath) !== expectedHash
  ) {
    throw failure(mismatchFailureClass);
  }
  return realPath;
}

function readJson(filePath, failureClass) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!isObject(value)) throw new Error('json_object_required');
    return value;
  } catch {
    throw failure(failureClass);
  }
}

function findFields(value, fields, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (fields.has(key)) found.push(key);
    findFields(child, fields, found);
  }
  return [...new Set(found)].sort();
}

function validateConstraintBundle(bundle) {
  const forbiddenFields = findForbiddenSequenceFields(bundle);
  if (forbiddenFields.length > 0) {
    throw failure('sequence_second_task_universe_forbidden', {
      forbiddenFields,
    });
  }
  const diagramFields = findFields(bundle, DIAGRAM_SEMANTIC_FIELDS);
  if (diagramFields.length > 0) {
    throw failure('sequence_diagram_semantic_source_forbidden', {
      forbiddenFields: diagramFields,
    });
  }
  const arrayConstraintCount = CONSTRAINT_ARRAY_FIELDS.reduce(
    (count, field) =>
      count + (Array.isArray(bundle[field]) ? bundle[field].length : 0),
    0
  );
  const invalidationIndexCount = isObject(bundle.invalidationIndex)
    ? Object.keys(bundle.invalidationIndex).length
    : 0;
  if (arrayConstraintCount === 0 && invalidationIndexCount === 0) {
    throw failure('sequence_closure_constraints_empty');
  }
}

function validateInterfaceFreezeReceipt(
  receipt,
  result,
  expectedRoots
) {
  if (receipt.decision !== 'pass') {
    throw failure('sequence_interface_freeze_receipt_blocked');
  }
  const expectedFields = {
    schemaVersion: 'sequence-interface-freeze-receipt/v1',
    ...expectedRoots,
    sequenceContractHash: result.sequenceContractHash,
    interfaceContractSetHash: result.interfaceContractSetHash,
    sequenceClosureBundleHash: result.sequenceClosureBundleHash,
  };
  const staleFields = Object.entries(expectedFields)
    .filter(([field, value]) => receipt[field] !== value)
    .map(([field]) => field)
    .sort();
  if (staleFields.length > 0) {
    throw failure('sequence_interface_freeze_receipt_stale', {
      staleFields,
    });
  }
}

function validateSequenceClosureCompilationResult({
  packageRoot,
  result,
  sourceAuthorityHash,
  semanticModelHash,
  traceGraphHash,
}) {
  if (!isObject(result)) {
    throw failure('sequence_closure_required_unavailable');
  }
  const expectedRoots = {
    sourceAuthorityHash,
    semanticModelHash,
    traceGraphHash,
  };
  const staleFields = Object.entries(expectedRoots)
    .filter(
      ([field, value]) =>
        !SHA256_PATTERN.test(value || '') || result[field] !== value
    )
    .map(([field]) => field)
    .sort();
  if (staleFields.length > 0) {
    throw failure('sequence_constraint_hash_mismatch', { staleFields });
  }

  const artifactSpecs = [
    {
      refField: 'sequenceContractRef',
      hashField: 'sequenceContractHash',
      mismatchFailureClass: 'sequence_contract_hash_mismatch',
      invalidFailureClass: 'sequence_contract_invalid',
    },
    {
      refField: 'interfaceContractSetRef',
      hashField: 'interfaceContractSetHash',
      mismatchFailureClass:
        'sequence_interface_contract_set_hash_mismatch',
      invalidFailureClass: 'sequence_interface_contract_set_invalid',
    },
    {
      refField: 'sequenceClosureBundleRef',
      hashField: 'sequenceClosureBundleHash',
      mismatchFailureClass: 'sequence_closure_bundle_hash_mismatch',
      invalidFailureClass: 'sequence_closure_bundle_invalid',
    },
    {
      refField: 'interfaceFreezeReceiptRef',
      hashField: 'interfaceFreezeReceiptHash',
      missingFailureClass: 'sequence_interface_freeze_receipt_missing',
      mismatchFailureClass:
        'sequence_interface_freeze_receipt_hash_mismatch',
      invalidFailureClass: 'sequence_interface_freeze_receipt_stale',
    },
  ];
  const artifacts = Object.fromEntries(
    artifactSpecs.map((spec) => {
      const artifactPath = resolvePackageOwnedFile({
        packageRoot,
        relativePath: result[spec.refField],
        expectedHash: result[spec.hashField],
        missingFailureClass: spec.missingFailureClass,
        mismatchFailureClass: spec.mismatchFailureClass,
      });
      return [
        spec.refField,
        {
          path: artifactPath,
          value: readJson(artifactPath, spec.invalidFailureClass),
        },
      ];
    })
  );
  const bundle = artifacts.sequenceClosureBundleRef.value;
  if (
    !isObject(result.sequenceClosureBundle) ||
    stableStringify(result.sequenceClosureBundle) !== stableStringify(bundle)
  ) {
    throw failure('sequence_closure_bundle_hash_mismatch');
  }
  validateConstraintBundle(bundle);
  validateInterfaceFreezeReceipt(
    artifacts.interfaceFreezeReceiptRef.value,
    result,
    expectedRoots
  );
  return deepFreeze(structuredClone(result));
}

function loadCanonicalSequenceClosureRuntimeBinding({ packageRoot }) {
  const resolvedPackageRoot = resolvePackageRoot(packageRoot);
  const manifestPath = path.join(
    resolvedPackageRoot,
    ACTION_MANIFEST_RELATIVE_PATH
  );
  if (
    !fs.existsSync(manifestPath) ||
    !fs.statSync(manifestPath).isFile()
  ) {
    throw failure('sequence_closure_required_unavailable');
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throw failure('sequence_closure_required_unavailable');
  }
  const actions = Array.isArray(manifest?.actions) ? manifest.actions : [];
  const matches = actions.filter((action) => action?.actionId === ACTION_ID);
  const action = matches.length === 1 ? matches[0] : null;
  const semanticGate = action?.semanticGate;
  const packageDistRef = action?.packageDistRef;
  const installedSurfaceRefs = Array.isArray(action?.installedSurfaceRefs)
    ? action.installedSurfaceRefs
    : [];
  if (
    manifest?.schemaVersion !==
      'requirements-contract-package-runtime-action-binding-manifest/v2' ||
    manifest?.decision !== 'pass' ||
    !action ||
    action.routingOnly !== false ||
    semanticGate?.sourceSymbol !== ACTION_EXPORT ||
    semanticGate?.distSymbol !== ACTION_EXPORT ||
    !isObject(packageDistRef) ||
    !installedSurfaceRefs.some(
      (ref) =>
        ref?.path === packageDistRef.path &&
        ref?.hash === packageDistRef.hash
    )
  ) {
    throw failure('sequence_closure_required_unavailable');
  }
  let modulePath;
  try {
    modulePath = resolvePackageOwnedFile({
      packageRoot: resolvedPackageRoot,
      relativePath: packageDistRef.path,
      expectedHash: packageDistRef.hash,
      mismatchFailureClass: 'sequence_closure_required_unavailable',
    });
  } catch {
    throw failure('sequence_closure_required_unavailable');
  }
  let runtimeModule;
  try {
    runtimeModule = require(modulePath);
  } catch {
    throw failure('sequence_closure_required_unavailable');
  }
  const compile = runtimeModule?.[ACTION_EXPORT];
  if (typeof compile !== 'function') {
    throw failure('sequence_closure_required_unavailable');
  }
  return Object.freeze({
    actionId: ACTION_ID,
    actionExport: ACTION_EXPORT,
    packageRoot: resolvedPackageRoot,
    modulePath,
    moduleHash: packageDistRef.hash,
    compile,
  });
}

async function resolveCanonicalSequenceClosureBinding({
  packageRoot,
  sourceAuthorityHash,
  semanticModelHash,
  traceGraphHash,
}) {
  const runtimeBinding = loadCanonicalSequenceClosureRuntimeBinding({
    packageRoot,
  });
  let result;
  try {
    result = await runtimeBinding.compile(
      deepFreeze({
        sourceAuthorityHash,
        semanticModelHash,
        traceGraphHash,
      })
    );
  } catch (error) {
    if (error?.failureClass) throw error;
    throw failure('sequence_closure_required_unavailable');
  }
  return validateSequenceClosureCompilationResult({
    packageRoot: runtimeBinding.packageRoot,
    result,
    sourceAuthorityHash,
    semanticModelHash,
    traceGraphHash,
  });
}

module.exports = {
  ACTION_EXPORT,
  ACTION_ID,
  loadCanonicalSequenceClosureRuntimeBinding,
  resolveCanonicalSequenceClosureBinding,
  validateSequenceClosureCompilationResult,
};
