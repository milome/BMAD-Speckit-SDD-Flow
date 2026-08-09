#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { auditExecutionPackage } = require('./audit-execution-package');
const {
  compileBoundSchema,
  compileBundledSchema,
  failure,
  isNonFunctionalText,
  parseArgs,
  readJson,
  resolveExistingInside,
  sha256,
  stableJson,
  validateSchemaInstance,
  writeAtomic,
} = require('./build-execution-package');

function git(repositoryRoot, args, failureClass, input) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    input,
    windowsHide: true,
  });
  if (result.status !== 0) failure(failureClass, { stderr: result.stderr.trim() });
  return result.stdout.trim();
}

function gitIsAncestor(repositoryRoot, ancestor, descendant, failureClass) {
  const result = spawnSync(
    'git',
    ['-C', repositoryRoot, 'merge-base', '--is-ancestor', ancestor, descendant],
    { encoding: 'utf8', windowsHide: true }
  );
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  failure(failureClass, { stderr: result.stderr.trim() });
}

function readBoundJsonOnce({
  repositoryRoot,
  binding,
  hashFailureClass,
  jsonFailureClass,
}) {
  if (!binding?.path || !binding?.hash) failure(hashFailureClass);
  const filePath = resolveExistingInside(
    repositoryRoot,
    binding.path,
    'campaign_artifact_path_escape'
  );
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    failure(hashFailureClass, { path: binding.path });
  }
  const bytes = fs.readFileSync(filePath);
  const actualHash = sha256(bytes);
  if (actualHash !== binding.hash) {
    failure(hashFailureClass, { path: binding.path, actualHash });
  }
  try {
    return { filePath, value: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    failure(jsonFailureClass, { path: binding.path, message: error.message });
  }
}

function verifyBoundJson({
  repositoryRoot,
  binding,
  hashFailureClass,
  validator,
  schemaFailureClass,
}) {
  const { value } = readBoundJsonOnce({
    repositoryRoot,
    binding,
    hashFailureClass,
    jsonFailureClass: schemaFailureClass,
  });
  if (!validator(value)) {
    failure(schemaFailureClass, {
      path: binding.path,
      errors: (validator.errors || []).slice(0, 5),
    });
  }
  return value;
}

function parseTrailers(repositoryRoot, subject, body) {
  const parsed = git(
    repositoryRoot,
    ['interpret-trailers', '--parse'],
    'commit_trailers_invalid',
    `${subject}\n\n${body}\n`
  );
  const trailers = new Map();
  for (const line of parsed.split(/\r?\n/u).filter(Boolean)) {
    const match = /^([^:]+):\s*(.*)$/u.exec(line);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const values = trailers.get(key) || [];
    values.push(match[2]);
    trailers.set(key, values);
  }
  return trailers;
}

function countRawTrailerOccurrences(body, field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(`^${escapedField}\\s*:`, 'gimu');
  return [...body.matchAll(pattern)].length;
}

function containsExactToken(text, token) {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9])${escapedToken}(?=$|[^A-Za-z0-9])`, 'u').test(text);
}

function verifyFunctionalMessage({
  repositoryRoot,
  subject,
  body,
  child,
  result,
  declaredPartitionIds,
}) {
  const match =
    /^(feat|fix|refactor|test|docs|chore|perf|build|ci)\(([a-z0-9][a-z0-9-]*)\):\s+(.+)$/u.exec(
      subject
    );
  if (
    !match ||
    isNonFunctionalText(match[3], child) ||
    declaredPartitionIds.some(
      (partitionId) =>
        partitionId !== child.partitionId && containsExactToken(match[3], partitionId)
    )
  ) {
    failure('commit_subject_not_functional', { partitionId: child.partitionId, subject });
  }
  const trailers = parseTrailers(repositoryRoot, subject, body);
  const required = [
    'Functional-Outcome',
    'Affected-Scope',
    'Child-Contract',
    'Contract-Hash',
    'Evidence',
    'Validation',
  ];
  const ambiguous = required.find(
    (field) =>
      countRawTrailerOccurrences(body, field) > 1 ||
      (trailers.get(field.toLowerCase()) || []).length > 1
  );
  if (ambiguous) {
    failure('commit_trailers_ambiguous', {
      partitionId: child.partitionId,
      trailer: ambiguous,
    });
  }
  if (
    required.some(
      (field) =>
        (trailers.get(field.toLowerCase()) || []).length !== 1 ||
        trailers.get(field.toLowerCase())[0].trim() === ''
    )
  ) {
    failure('commit_trailers_incomplete', { partitionId: child.partitionId });
  }
  const trailer = (field) => trailers.get(field.toLowerCase())[0];
  if (isNonFunctionalText(trailer('Functional-Outcome'), child)) {
    failure('commit_functional_outcome_not_specific', {
      partitionId: child.partitionId,
      functionalOutcome: trailer('Functional-Outcome'),
    });
  }
  if (
    trailer('Child-Contract') !== child.partitionId ||
    trailer('Contract-Hash') !== child.contract.hash ||
    trailer('Evidence') !== `${result.evidence.path}#${result.evidence.hash}`
  ) {
    failure('commit_trailers_mismatch', { partitionId: child.partitionId });
  }
  const validationIds = trailer('Validation')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    validationIds.length !== child.requiredCommandIds.length ||
    new Set(validationIds).size !== validationIds.length ||
    child.requiredCommandIds.some((id) => !validationIds.includes(id))
  ) {
    failure('commit_trailers_mismatch', { partitionId: child.partitionId });
  }
  return {
    functionalOutcome: trailer('Functional-Outcome'),
  };
}

function sameOrdered(left, right) {
  return stableJson(left) === stableJson(right);
}

function captureRepositorySnapshot(
  repositoryRoot,
  failureClass,
  ownedPaths = []
) {
  const head = git(repositoryRoot, ['rev-parse', 'HEAD'], failureClass);
  return {
    head,
    tree: git(repositoryRoot, ['rev-parse', `${head}^{tree}`], failureClass),
    ownedPaths,
    ownedPathStatus: ownedPaths.length
      ? git(
          repositoryRoot,
          [
            'status',
            '--porcelain=v1',
            '--untracked-files=all',
            '--',
            ...ownedPaths,
          ],
          failureClass
        )
      : '',
    stagedPaths: git(
      repositoryRoot,
      ['diff', '--cached', '--name-only', '--no-renames'],
      failureClass
    )
      .split(/\r?\n/u)
      .filter(Boolean),
  };
}

function verifyRepositorySnapshot(repositoryRoot, expected) {
  const actual = captureRepositorySnapshot(
    repositoryRoot,
    'campaign_repair_repository_state_changed',
    expected.ownedPaths
  );
  if (!sameOrdered(actual, expected)) {
    failure('campaign_repair_repository_state_changed', { expected, actual });
  }
}

function listOutputFiles(outputRoot) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(outputRoot, fullPath).replace(/\\/gu, '/');
      const stat = fs.lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        failure('package_output_path_escape', { path: relativePath });
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        files.push(relativePath);
      } else {
        failure('package_output_path_escape', { path: relativePath });
      }
    }
  };
  walk(outputRoot);
  return files.sort();
}

function publishOutputSet(outputRoot, outputs, beforePublish) {
  const targetRoot = path.resolve(outputRoot);
  const entries = Object.entries(outputs).sort(([left], [right]) => left.localeCompare(right));
  const expectedPaths = entries.map(([relativePath]) => relativePath);
  if (new Set(expectedPaths).size !== expectedPaths.length) {
    failure('package_output_conflict');
  }

  if (fs.existsSync(targetRoot)) {
    const rootStat = fs.lstatSync(targetRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      failure('package_output_path_escape');
    }
    const actualPaths = listOutputFiles(targetRoot);
    if (!sameOrdered(actualPaths, expectedPaths)) {
      failure('package_output_conflict', { actualPaths, expectedPaths });
    }
    for (const [relativePath, content] of entries) {
      const targetPath = resolveExistingInside(
        targetRoot,
        relativePath,
        'package_output_path_escape'
      );
      if (!fs.statSync(targetPath).isFile() || fs.readFileSync(targetPath, 'utf8') !== content) {
        failure('package_output_conflict', { path: relativePath });
      }
    }
    if (beforePublish) beforePublish();
    return;
  }

  const parent = path.dirname(targetRoot);
  fs.mkdirSync(parent, { recursive: true });
  const temporaryRoot = path.join(
    parent,
    `.${path.basename(targetRoot)}.${process.pid}.${sha256(stableJson(outputs)).slice(7, 19)}.tmp`
  );
  if (fs.existsSync(temporaryRoot)) {
    failure('package_output_conflict', { path: temporaryRoot });
  }
  fs.mkdirSync(temporaryRoot);
  try {
    for (const [relativePath, content] of entries) {
      writeAtomic(temporaryRoot, relativePath, content);
    }
    for (const [relativePath, content] of entries) {
      const stagedPath = resolveExistingInside(
        temporaryRoot,
        relativePath,
        'package_output_path_escape'
      );
      if (fs.readFileSync(stagedPath, 'utf8') !== content) {
        failure('package_output_conflict', { path: relativePath });
      }
    }
    if (beforePublish) beforePublish();
    fs.renameSync(temporaryRoot, targetRoot);
  } catch (error) {
    if (fs.existsSync(temporaryRoot)) {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
    throw error;
  }
}

function prepareCompletedCampaignAuditContext(
  packageRoot,
  expectedPackageManifestHash
) {
  const manifest = auditExecutionPackage(
    packageRoot,
    expectedPackageManifestHash
  );
  if (!Array.isArray(manifest.children) || manifest.children.length === 0) {
    failure('child_result_set_incomplete');
  }
  const repositoryRoot = path.resolve(manifest.repositoryRoot || '');
  return {
    manifest,
    repositoryRoot,
    evidenceValidator: compileBoundSchema(
      repositoryRoot,
      manifest.evidenceSchema,
      'evidence_schema_hash_mismatch',
      'evidence_schema_invalid'
    ),
    closureValidator: compileBoundSchema(
      repositoryRoot,
      manifest.closureSchema,
      'closure_schema_hash_mismatch',
      'closure_schema_invalid'
    ),
  };
}

function auditCompletedChild({
  context,
  packageRoot,
  expectedPackageManifestHash,
  childIndex,
  result,
  expectedParent,
  priorCommitHashes = [],
  lineageMode = 'strict_lineage',
  repositoryHead = 'HEAD',
}) {
  const auditContext =
    context ||
    prepareCompletedCampaignAuditContext(
      packageRoot,
      expectedPackageManifestHash
    );
  const {
    manifest,
    repositoryRoot,
    evidenceValidator,
    closureValidator,
  } = auditContext;
  const child = manifest.children[childIndex];
  if (!['strict_lineage', 'repair_closure_authority'].includes(lineageMode)) {
    failure('child_lineage_mode_invalid', { childIndex, lineageMode });
  }
  if (!child) {
    failure('child_result_mismatch', { childIndex });
  }
  if (
    result?.partitionId !== child.partitionId ||
    result.status !== 'closed' ||
    result.contractHash !== child.contract.hash
  ) {
    failure('child_result_mismatch', { partitionId: child.partitionId });
  }
  const evidence = verifyBoundJson({
    repositoryRoot,
    binding: result.evidence,
    hashFailureClass: 'child_evidence_hash_mismatch',
    validator: evidenceValidator,
    schemaFailureClass: 'child_evidence_schema_invalid',
  });
  const closure = verifyBoundJson({
    repositoryRoot,
    binding: result.closure,
    hashFailureClass: 'child_closure_hash_mismatch',
    validator: closureValidator,
    schemaFailureClass: 'child_closure_schema_invalid',
  });
  if (
    ('partitionId' in evidence && evidence.partitionId !== child.partitionId) ||
    closure.partitionId !== child.partitionId ||
    closure.childContractHash !== child.contract.hash ||
    closure.decision !== 'pass'
  ) {
    failure('child_closure_schema_invalid', {
      partitionId: child.partitionId,
    });
  }
  if (
    !Array.isArray(result.validationResults) ||
    result.validationResults.length !== child.requiredCommandIds.length ||
    new Set(result.validationResults.map((entry) => entry?.id)).size !==
      result.validationResults.length
  ) {
    failure('child_validation_incomplete', {
      partitionId: child.partitionId,
    });
  }
  for (const commandId of child.requiredCommandIds) {
    const validation = result.validationResults.find(
      (entry) => entry.id === commandId
    );
    if (!validation || validation.status !== 'pass') {
      failure('child_validation_incomplete', {
        partitionId: child.partitionId,
        commandId,
      });
    }
    verifyBoundJson({
      repositoryRoot,
      binding: validation.evidence,
      hashFailureClass: 'child_validation_evidence_mismatch',
      validator: evidenceValidator,
      schemaFailureClass: 'child_validation_evidence_schema_invalid',
    });
  }
  const commit = result.commit;
  if (
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit?.hash || '') ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit?.parentHash || '') ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit?.treeHash || '') ||
    typeof commit?.subject !== 'string' ||
    !Array.isArray(commit?.changedPaths) ||
    commit.changedPaths.length === 0 ||
    priorCommitHashes.includes(commit.hash)
  ) {
    failure('child_commit_set_invalid', {
      partitionId: child.partitionId,
    });
  }
  git(
    repositoryRoot,
    ['cat-file', '-e', `${commit.hash}^{commit}`],
    'child_commit_not_reachable'
  );
  if (lineageMode === 'strict_lineage') {
    git(
      repositoryRoot,
      ['merge-base', '--is-ancestor', commit.hash, repositoryHead],
      'child_commit_not_reachable'
    );
  }
  const commitAndParents = git(
    repositoryRoot,
    ['rev-list', '--parents', '-n', '1', commit.hash],
    'child_commit_parent_mismatch'
  ).split(/\s+/u);
  if (commitAndParents.length !== 2) {
    failure('child_commit_parent_mismatch', {
      partitionId: child.partitionId,
    });
  }
  const actualParent = commitAndParents[1];
  const actualTree = git(
    repositoryRoot,
    ['rev-parse', `${commit.hash}^{tree}`],
    'child_commit_tree_mismatch'
  );
  const actualSubject = git(
    repositoryRoot,
    ['show', '-s', '--format=%s', commit.hash],
    'child_commit_message_missing'
  );
  const actualBody = git(
    repositoryRoot,
    ['show', '-s', '--format=%b', commit.hash],
    'child_commit_message_missing'
  );
  const actualPaths = git(
    repositoryRoot,
    ['show', '--no-renames', '--pretty=format:', '--name-only', commit.hash],
    'child_commit_paths_mismatch'
  )
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
  const actualDiff = git(
    repositoryRoot,
    [
      'show',
      '--no-renames',
      '--no-ext-diff',
      '--format=',
      '--patch',
      commit.hash,
    ],
    'child_commit_diff_missing'
  );
  if (!actualDiff.trim()) {
    failure('child_commit_diff_missing', {
      partitionId: child.partitionId,
    });
  }
  const ownedPaths = new Set(child.ownedArtifactPaths);
  if (actualPaths.some((changedPath) => !ownedPaths.has(changedPath))) {
    failure('child_commit_scope_escape', {
      partitionId: child.partitionId,
    });
  }
  if (
    (lineageMode === 'strict_lineage' && actualParent !== expectedParent) ||
    commit.parentHash !== actualParent ||
    commit.treeHash !== actualTree ||
    commit.subject !== actualSubject ||
    !sameOrdered([...commit.changedPaths].sort(), actualPaths)
  ) {
    failure('child_commit_binding_mismatch', {
      partitionId: child.partitionId,
    });
  }
  const verifiedMessage = verifyFunctionalMessage({
    repositoryRoot,
    subject: actualSubject,
    body: actualBody,
    child,
    result,
    declaredPartitionIds: manifest.children.map(({ partitionId }) => partitionId),
  });
  const childSummary = {
    partitionId: child.partitionId,
    displayTitle: child.displayTitle,
    functionalOutcome: verifiedMessage.functionalOutcome,
    status: 'closed',
    commitSubject: actualSubject,
    commitHash: commit.hash,
    evidenceHash: result.evidence.hash,
    closureHash: result.closure.hash,
    validationCommandIds: [...child.requiredCommandIds],
  };
  const receiptCore = {
    schemaVersion: 'goal-subcontract-completed-child-audit/v1',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    partitionId: child.partitionId,
    childContractHash: child.contract.hash,
    childIndex,
    evidenceHash: result.evidence.hash,
    closureHash: result.closure.hash,
    commitHash: commit.hash,
    parentHash: actualParent,
    treeHash: actualTree,
    subject: actualSubject,
    changedPaths: actualPaths,
    functionalOutcome: verifiedMessage.functionalOutcome,
    validationCommandIds: [...child.requiredCommandIds],
    decision: 'pass',
  };
  return {
    auditReceipt: {
      ...receiptCore,
      receiptHash: sha256(stableJson(receiptCore)),
    },
    childSummary,
    closureBinding: {
      partitionId: child.partitionId,
      evidenceHash: result.evidence.hash,
      closureHash: result.closure.hash,
    },
    commitHash: commit.hash,
  };
}

function canonicalValueHash(value) {
  return sha256(JSON.stringify(JSON.parse(stableJson(value))));
}

function verifySelfHashedRecord(record, failureClass) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    failure(failureClass);
  }
  const { receiptHash, ...core } = record;
  if (receiptHash !== canonicalValueHash(core)) {
    failure(failureClass);
  }
  return record;
}

function verifyRepairClosureSet({
  repositoryRoot,
  manifest,
  provenance,
  repairAuthority,
  closureValidator,
}) {
  if (
    !Array.isArray(provenance.effectiveClosureReceipts) ||
    provenance.effectiveClosureReceipts.length !== manifest.children.length
  ) {
    failure('campaign_repair_closure_set_incomplete');
  }
  const preservedIds = new Set(repairAuthority.preservedPartitionIds);
  const invalidatedIds = new Set(repairAuthority.invalidatedPartitionIds);
  if (
    !Array.isArray(repairAuthority.preservedClosureBindings) ||
    repairAuthority.preservedClosureBindings.length !== preservedIds.size ||
    repairAuthority.preservedClosureBindings.some(
      (binding, index) =>
        binding?.ordinal !== index + 1 ||
        binding.partitionId !== repairAuthority.preservedPartitionIds[index] ||
        !/^sha256:[a-f0-9]{64}$/u.test(binding.closureReceiptHash || '')
    )
  ) {
    failure('campaign_repair_authority_invalid');
  }
  const preservedBindings = new Map(
    repairAuthority.preservedClosureBindings.map((binding) => [
      binding.partitionId,
      binding.closureReceiptHash,
    ])
  );
  const byPartition = new Map();
  const closureBindings = [];
  for (const [index, child] of manifest.children.entries()) {
    const binding = provenance.effectiveClosureReceipts[index];
    const closure = verifySelfHashedRecord(
      verifyBoundJson({
        repositoryRoot,
        binding,
        hashFailureClass: 'campaign_repair_closure_hash_mismatch',
        validator: closureValidator,
        schemaFailureClass: 'campaign_repair_closure_schema_invalid',
      }),
      'campaign_repair_closure_self_hash_mismatch'
    );
    const expectedAttemptId = preservedIds.has(child.partitionId)
      ? repairAuthority.baseAttemptId
      : invalidatedIds.has(child.partitionId)
        ? repairAuthority.repairAttemptId
        : null;
    if (
      closure.schemaVersion !== 'goal-contract-subcontract-closure-receipt/v1' ||
      closure.partitionId !== child.partitionId ||
      closure.childContractHash !== child.contract.hash ||
      closure.attemptId !== expectedAttemptId ||
      closure.decision !== 'pass' ||
      !Array.isArray(closure.predecessorClosureReceiptHashes)
    ) {
      failure('campaign_repair_closure_binding_mismatch', {
        partitionId: child.partitionId,
      });
    }
    if (
      preservedIds.has(child.partitionId) &&
      preservedBindings.get(child.partitionId) !== closure.receiptHash
    ) {
      failure('campaign_repair_preserved_closure_stale', {
        partitionId: child.partitionId,
      });
    }
    byPartition.set(child.partitionId, closure);
    closureBindings.push({
      partitionId: child.partitionId,
      attemptId: closure.attemptId,
      path: binding.path,
      closureReceiptHash: closure.receiptHash,
      artifactHash: binding.hash,
    });
  }
  for (const child of manifest.children) {
    const closure = byPartition.get(child.partitionId);
    const expectedPredecessors = (child.predecessorPartitionIds || []).map(
      (predecessorId) => byPartition.get(predecessorId)?.receiptHash
    );
    if (
      expectedPredecessors.some((hash) => !hash) ||
      !sameOrdered(
        closure.predecessorClosureReceiptHashes,
        expectedPredecessors
      )
    ) {
      failure('campaign_repair_predecessor_closure_stale', {
        partitionId: child.partitionId,
      });
    }
  }
  return {
    bindings: provenance.effectiveClosureReceipts,
    repairClosureSetHash: sha256(stableJson(closureBindings)),
  };
}

function verifyRepairFinalValidation({
  repositoryRoot,
  provenance,
  manifest,
  artifacts,
  repairAuthority,
  repairClosureSetHash,
  amendmentCommitHash,
  firstInvalidatedIndex,
  auditSnapshot,
  expectedValidationCommandIds,
}) {
  const { value: finalValidationRecord } = readBoundJsonOnce({
    repositoryRoot,
    binding: provenance.finalValidation,
    hashFailureClass: 'campaign_repair_final_validation_hash_mismatch',
    jsonFailureClass: 'campaign_repair_final_validation_invalid',
  });
  const finalValidationValidator = compileBundledSchema(
    'repair-final-validation-binding.schema.json',
    'campaign_repair_final_validation_invalid',
    repositoryRoot
  );
  const finalValidation = verifySelfHashedRecord(
    finalValidationRecord,
    'campaign_repair_final_validation_self_hash_mismatch'
  );
  validateSchemaInstance(
    finalValidationValidator,
    finalValidation,
    'campaign_repair_final_validation_invalid'
  );

  const ownedPaths = [
    ...new Set(manifest.children.flatMap((child) => child.ownedArtifactPaths)),
  ].sort();
  const ownedPathBindings = ownedPaths.map((ownedPath) => ({
    path: ownedPath,
    blobHash: git(
      repositoryRoot,
      ['rev-parse', `${auditSnapshot.head}:${ownedPath}`],
      'campaign_repair_final_validation_stale'
    ),
  }));
  const unreachableChildCommitHashes = artifacts.childResults
    .map((result) => result?.commit?.hash)
    .filter(
      (commitHash) =>
        typeof commitHash === 'string' &&
        !gitIsAncestor(
          repositoryRoot,
          commitHash,
          auditSnapshot.head,
          'campaign_repair_final_validation_stale'
        )
    );
  const parentDiscontinuities = [];
  let expectedParent = manifest.repositoryBaseline.headCommit;
  for (const [index, child] of manifest.children.entries()) {
    if (index === firstInvalidatedIndex) expectedParent = amendmentCommitHash;
    const commitHash = artifacts.childResults[index]?.commit?.hash;
    const commitAndParents = git(
      repositoryRoot,
      ['rev-list', '--parents', '-n', '1', commitHash],
      'campaign_repair_final_validation_stale'
    ).split(/\s+/u);
    const actualParent = commitAndParents[1];
    if (!actualParent) failure('campaign_repair_final_validation_stale');
    if (index >= firstInvalidatedIndex && actualParent !== expectedParent) {
      parentDiscontinuities.push({
        partitionId: child.partitionId,
        commitHash,
        expectedParentHash: expectedParent,
        actualParentHash: actualParent,
      });
    }
    expectedParent = commitHash;
  }
  const finalChildCommit = artifacts.childResults.at(-1)?.commit?.hash;
  const historyBaseline = git(
    repositoryRoot,
    ['merge-base', finalChildCommit, auditSnapshot.head],
    'campaign_repair_final_validation_stale'
  );
  const postChildCommitHashes = git(
    repositoryRoot,
    ['rev-list', '--reverse', `${historyBaseline}..${auditSnapshot.head}`],
    'campaign_repair_final_validation_stale'
  )
    .split(/\r?\n/u)
    .filter(Boolean);
  const validationIds = finalValidation.validationResults.map(({ id }) => id);
  const validationEvidencePaths = finalValidation.validationResults.map(
    ({ evidence }) => evidence.path
  );
  const validationEvidenceHashes = finalValidation.validationResults.map(
    ({ evidence }) => evidence.hash
  );
  if (
    new Set(validationIds).size !== validationIds.length ||
    new Set(validationEvidencePaths).size !==
      validationEvidencePaths.length ||
    new Set(validationEvidenceHashes).size !==
      validationEvidenceHashes.length ||
    !sameOrdered(validationIds, expectedValidationCommandIds)
  ) {
    failure('campaign_repair_final_validation_invalid');
  }
  for (const requiredId of expectedValidationCommandIds) {
    const result = finalValidation.validationResults.find(({ id }) => id === requiredId);
    if (!result) failure('campaign_repair_final_validation_invalid', { requiredId });
    const { value: evidence } = readBoundJsonOnce({
      repositoryRoot,
      binding: result.evidence,
      hashFailureClass: 'campaign_repair_final_validation_evidence_hash_mismatch',
      jsonFailureClass: 'campaign_repair_final_validation_invalid',
    });
    if (
      evidence.schemaVersion !== result.evidenceSchemaVersion ||
      evidence.commandId !== requiredId ||
      evidence.boundHead !== auditSnapshot.head ||
      evidence.decision !== 'pass'
    ) {
      failure('campaign_repair_final_validation_stale', { requiredId });
    }
  }
  if (
    finalValidation.repairAttemptId !== repairAuthority.repairAttemptId ||
    finalValidation.repairAuthorityReceiptHash !== repairAuthority.receiptHash ||
    finalValidation.repairClosureSetHash !== repairClosureSetHash ||
    finalValidation.boundHead !== auditSnapshot.head ||
    finalValidation.boundTree !== auditSnapshot.tree ||
    finalValidation.repositoryState.head !== auditSnapshot.head ||
    auditSnapshot.stagedPaths.length !== 0 ||
    !sameOrdered(finalValidation.unreachableChildCommitHashes, unreachableChildCommitHashes) ||
    !sameOrdered(finalValidation.parentDiscontinuities, parentDiscontinuities) ||
    !sameOrdered(finalValidation.ownedPathBindings, ownedPathBindings) ||
    finalValidation.ownedPathSetHash !== sha256(stableJson(ownedPathBindings)) ||
    !sameOrdered(finalValidation.postChildCommitHashes, postChildCommitHashes) ||
    finalValidation.postChildCommitSetHash !== sha256(stableJson(postChildCommitHashes))
  ) {
    failure('campaign_repair_final_validation_stale', {
      boundHead: finalValidation.boundHead,
      actualHead: auditSnapshot.head,
    });
  }
  return {
    finalValidationHead: auditSnapshot.head,
    finalValidationReceiptHash: finalValidation.receiptHash,
    finalValidationArtifactHash: provenance.finalValidation.hash,
    postChildCommitHashes,
  };
}

function prepareRepairAuditProvenance({
  repositoryRoot,
  manifest,
  artifacts,
  closureValidator,
  expectedRepairAuthorityArtifactHash,
  expectedRepairAuthorityPath,
  expectedFinalValidationArtifactHash,
  expectedValidationCommandIds,
  auditSnapshot,
}) {
  if (artifacts.repairProvenance === undefined) return null;
  const provenance = artifacts.repairProvenance;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    failure('campaign_repair_provenance_invalid');
  }
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(
      expectedRepairAuthorityArtifactHash || ''
    ) ||
    !/^sha256:[a-f0-9]{64}$/u.test(
      expectedFinalValidationArtifactHash || ''
    ) ||
    typeof expectedRepairAuthorityPath !== 'string' ||
    expectedRepairAuthorityPath.length === 0 ||
    !Array.isArray(expectedValidationCommandIds) ||
    expectedValidationCommandIds.length === 0 ||
    new Set(expectedValidationCommandIds).size !==
      expectedValidationCommandIds.length
  ) {
    failure('campaign_repair_trust_binding_missing');
  }
  if (
    provenance.repairAuthority?.hash !==
      expectedRepairAuthorityArtifactHash ||
    typeof provenance.repairAuthority?.path !== 'string' ||
    provenance.repairAuthority?.path.replace(/\\/gu, '/') !==
      expectedRepairAuthorityPath.replace(/\\/gu, '/') ||
    provenance.finalValidation?.hash !== expectedFinalValidationArtifactHash
  ) {
    failure('campaign_repair_trust_binding_mismatch');
  }
  const { value: repairAuthorityRecord } = readBoundJsonOnce({
    repositoryRoot,
    binding: provenance.repairAuthority,
    hashFailureClass: 'campaign_repair_authority_hash_mismatch',
    jsonFailureClass: 'campaign_repair_authority_invalid',
  });
  const repairAuthority = verifySelfHashedRecord(
    repairAuthorityRecord,
    'campaign_repair_authority_invalid'
  );
  const repairAuthorityValidator = compileBundledSchema(
    'campaign-repair-authority-receipt.schema.json',
    'campaign_repair_authority_invalid',
    repositoryRoot
  );
  validateSchemaInstance(
    repairAuthorityValidator,
    repairAuthority,
    'campaign_repair_authority_invalid'
  );
  const partitionIds = manifest.children.map(({ partitionId }) => partitionId);
  const preservedPartitionIds = repairAuthority.preservedPartitionIds;
  const invalidatedPartitionIds = repairAuthority.invalidatedPartitionIds;
  if (
    repairAuthority.schemaVersion !==
      'goal-contract-campaign-repair-authority-receipt/v1' ||
    repairAuthority.decision !== 'pass' ||
    typeof repairAuthority.baseAttemptId !== 'string' ||
    repairAuthority.baseAttemptId.length === 0 ||
    typeof repairAuthority.repairAttemptId !== 'string' ||
    repairAuthority.repairAttemptId.length === 0 ||
    repairAuthority.baseAttemptId === repairAuthority.repairAttemptId ||
    !Array.isArray(preservedPartitionIds) ||
    !Array.isArray(invalidatedPartitionIds) ||
    new Set([...preservedPartitionIds, ...invalidatedPartitionIds]).size !==
      partitionIds.length ||
    !sameOrdered(
      [...preservedPartitionIds, ...invalidatedPartitionIds],
      partitionIds
    ) ||
    repairAuthority.campaignId !==
      `goal-campaign-${repairAuthority.campaignActivationHash.slice(7)}` ||
    repairAuthority.basePartitionManifestDocumentHash !==
      manifest.partitionManifest.hash ||
    repairAuthority.partitionManifestHash !==
      manifest.partitionManifest.partitionManifestHash ||
    !sameOrdered(
      repairAuthority.baseChildReleaseBindings.map(
        ({ ordinal, partitionId }) => ({ ordinal, partitionId })
      ),
      partitionIds.map((partitionId, index) => ({
        ordinal: index + 1,
        partitionId,
      }))
    ) ||
    repairAuthority.repairAuthorizationHash !==
      canonicalValueHash(repairAuthority.repairAuthorization)
  ) {
    failure('campaign_repair_authority_invalid');
  }
  const canonicalAuthoritySuffix =
    `campaigns/${repairAuthority.campaignId}/repair/authority.receipt.json`;
  const normalizedAuthorityPath = provenance.repairAuthority.path.replace(
    /\\/gu,
    '/'
  );
  if (
    normalizedAuthorityPath !== canonicalAuthoritySuffix &&
    !normalizedAuthorityPath.endsWith(`/${canonicalAuthoritySuffix}`)
  ) {
    failure('campaign_repair_authority_path_invalid');
  }
  const firstInvalidatedIndex = preservedPartitionIds.length;
  if (firstInvalidatedIndex >= partitionIds.length) {
    failure('campaign_repair_authority_invalid');
  }
  const { value: chainAnchorRecord } = readBoundJsonOnce({
    repositoryRoot,
    binding: provenance.chainAnchor,
    hashFailureClass: 'campaign_repair_chain_anchor_hash_mismatch',
    jsonFailureClass: 'campaign_repair_chain_anchor_invalid',
  });
  const chainAnchor = verifySelfHashedRecord(
    chainAnchorRecord,
    'campaign_repair_chain_anchor_invalid'
  );
  if (
    ![
      'goal-subcontract-repair-chain-anchor/v1',
      'ma-gs-repair-chain-anchor/v1',
    ].includes(chainAnchor.schemaVersion) ||
    chainAnchor.decision !== 'pass' ||
    chainAnchor.repairAttemptId !== repairAuthority.repairAttemptId ||
    chainAnchor.repairAuthorityReceiptHash !== repairAuthority.receiptHash ||
    !/^sha256:[a-f0-9]{64}$/u.test(chainAnchor.receiptHash || '') ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(
      chainAnchor.amendmentCommitHash || ''
    ) ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(
      chainAnchor.parentCommitHash || ''
    ) ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(
      chainAnchor.treeHash || ''
    ) ||
    typeof chainAnchor.subject !== 'string' ||
    chainAnchor.subject.length === 0
  ) {
    failure('campaign_repair_chain_anchor_invalid');
  }
  git(
    repositoryRoot,
    ['cat-file', '-e', `${chainAnchor.amendmentCommitHash}^{commit}`],
    'campaign_repair_chain_anchor_invalid'
  );
  git(
    repositoryRoot,
    ['merge-base', '--is-ancestor', chainAnchor.amendmentCommitHash, auditSnapshot.head],
    'campaign_repair_chain_anchor_invalid'
  );
  const commitAndParents = git(
    repositoryRoot,
    ['rev-list', '--parents', '-n', '1', chainAnchor.amendmentCommitHash],
    'campaign_repair_chain_anchor_invalid'
  ).split(/\s+/u);
  const expectedAnchorParent =
    firstInvalidatedIndex === 0
      ? manifest.repositoryBaseline.headCommit
      : artifacts.childResults[firstInvalidatedIndex - 1]?.commit?.hash;
  if (
    commitAndParents.length !== 2 ||
    commitAndParents[1] !== expectedAnchorParent ||
    chainAnchor.parentCommitHash !== expectedAnchorParent ||
    git(
      repositoryRoot,
      ['rev-parse', `${chainAnchor.amendmentCommitHash}^{tree}`],
      'campaign_repair_chain_anchor_invalid'
    ) !== chainAnchor.treeHash ||
    git(
      repositoryRoot,
      ['show', '-s', '--format=%s', chainAnchor.amendmentCommitHash],
      'campaign_repair_chain_anchor_invalid'
    ) !== chainAnchor.subject
  ) {
    failure('campaign_repair_chain_anchor_invalid');
  }
  const closureSet = verifyRepairClosureSet({
    repositoryRoot,
    manifest,
    provenance,
    repairAuthority,
    closureValidator,
  });
  const finalValidation = verifyRepairFinalValidation({
    repositoryRoot,
    provenance,
    manifest,
    artifacts,
    repairAuthority,
    repairClosureSetHash: closureSet.repairClosureSetHash,
    amendmentCommitHash: chainAnchor.amendmentCommitHash,
    firstInvalidatedIndex,
    auditSnapshot,
    expectedValidationCommandIds,
  });
  return {
    firstInvalidatedIndex,
    baseAttemptId: repairAuthority.baseAttemptId,
    repairAttemptId: repairAuthority.repairAttemptId,
    repairAuthorityReceiptHash: repairAuthority.receiptHash,
    repairAuthorityArtifactHash: provenance.repairAuthority.hash,
    amendmentCommitHash: chainAnchor.amendmentCommitHash,
    ...closureSet,
    ...finalValidation,
  };
}

function auditCompletedCampaign({
  packageRoot,
  expectedPackageManifestHash,
  artifactsPath,
  outputRoot,
  expectedRepairAuthorityArtifactHash,
  expectedRepairAuthorityPath,
  expectedFinalValidationArtifactHash,
  expectedValidationCommandIds,
  beforePublish,
  closeoutContext,
}) {
  const context = prepareCompletedCampaignAuditContext(
    packageRoot,
    expectedPackageManifestHash
  );
  const { manifest, repositoryRoot, evidenceValidator, closureValidator } = context;
  const artifacts = readJson(path.resolve(artifactsPath), 'invalid_campaign_artifacts');
  if (
    artifacts.schemaVersion !== 'goal-subcontract-completed-campaign-artifacts/v1' ||
    artifacts.packageId !== manifest.packageId ||
    artifacts.packageManifestHash !== manifest.packageManifestHash
  ) {
    failure('campaign_package_binding_mismatch');
  }
  const controlledCloseout = Boolean(closeoutContext);
  const controlledRepairPartitionIds = new Set();
  if (controlledCloseout) {
    const { value: repairAuthority } = readBoundJsonOnce({
      repositoryRoot,
      binding: {
        path: path.isAbsolute(closeoutContext.repairAuthority.receiptPath)
          ? path.relative(
              repositoryRoot,
              closeoutContext.repairAuthority.receiptPath
            )
          : closeoutContext.repairAuthority.receiptPath,
        hash: closeoutContext.repairAuthority.artifactHash,
      },
      hashFailureClass: 'campaign_closeout_evidence_mismatch',
      jsonFailureClass: 'campaign_closeout_evidence_mismatch',
    });
    for (const partitionId of repairAuthority.invalidatedPartitionIds || []) {
      controlledRepairPartitionIds.add(partitionId);
    }
  }
  if (
    !Array.isArray(artifacts.childResults) ||
    artifacts.childResults.length !== manifest.children.length
  ) {
    failure('child_result_set_incomplete');
  }
  const repairOwnedPaths = artifacts.repairProvenance
    ? [
        ...new Set(
          manifest.children.flatMap((child) => child.ownedArtifactPaths)
        ),
      ].sort()
    : [];
  const auditSnapshot = artifacts.repairProvenance
    ? captureRepositorySnapshot(
        repositoryRoot,
        'campaign_repair_final_validation_stale',
        repairOwnedPaths
      )
    : null;
  const repairProvenance = prepareRepairAuditProvenance({
    repositoryRoot,
    manifest,
    artifacts,
    closureValidator,
    expectedRepairAuthorityArtifactHash,
    expectedRepairAuthorityPath,
    expectedFinalValidationArtifactHash,
    expectedValidationCommandIds,
    auditSnapshot,
  });
  const commits = [];
  const closures = [];
  const childSummaries = [];
  let expectedParent = manifest.repositoryBaseline.headCommit;
  for (const [index, child] of manifest.children.entries()) {
    if (repairProvenance?.firstInvalidatedIndex === index) {
      expectedParent = repairProvenance.amendmentCommitHash;
    }
    const result = artifacts.childResults[index];
    const repairClosureBinding = repairProvenance?.bindings[index];
    const childAudit = auditCompletedChild({
      context,
      childIndex: index,
      result: repairClosureBinding
        ? { ...result, closure: repairClosureBinding }
        : result,
      expectedParent,
      priorCommitHashes: commits,
      lineageMode:
        controlledRepairPartitionIds.has(child.partitionId) ||
        (repairProvenance && index >= repairProvenance.firstInvalidatedIndex)
          ? 'repair_closure_authority'
          : 'strict_lineage',
      repositoryHead: controlledCloseout
        ? closeoutContext.validationMaterialization.head
        : repairProvenance
          ? auditSnapshot.head
          : 'HEAD',
    });
    commits.push(childAudit.commitHash);
    closures.push(childAudit.closureBinding);
    childSummaries.push(childAudit.childSummary);
    expectedParent = childAudit.commitHash;
  }
  const ownedPaths = [...new Set(manifest.children.flatMap((child) => child.ownedArtifactPaths))];
  const finalChildCommit = commits.at(-1);
  const historyHead = controlledCloseout
    ? closeoutContext.validationMaterialization.head
    : repairProvenance
      ? auditSnapshot.head
      : 'HEAD';
  const historyBaseline = controlledCloseout
    ? historyHead
    : repairProvenance
    ? git(
        repositoryRoot,
        ['merge-base', finalChildCommit, historyHead],
        'campaign_repair_post_child_history_invalid'
      )
    : finalChildCommit;
  const committedOwnedPathHistory = git(
    repositoryRoot,
    [
      'log',
      '--format=',
      '--name-only',
      '--no-renames',
      `${historyBaseline}..${historyHead}`,
      '--',
      ...ownedPaths,
    ],
    'child_owned_path_drift'
  );
  const committedOwnedPathDiff = git(
    repositoryRoot,
    [
      'diff',
      '--name-only',
      '--no-renames',
      `${historyBaseline}..${historyHead}`,
      '--',
      ...ownedPaths,
    ],
    'child_owned_path_drift'
  );
  const pendingOwnedPathDrift = git(
    repositoryRoot,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', ...ownedPaths],
    'child_owned_path_drift'
  );
  if (
    (!controlledCloseout &&
      !repairProvenance &&
      (committedOwnedPathHistory || committedOwnedPathDiff)) ||
    (!controlledCloseout && pendingOwnedPathDrift)
  ) {
    failure('child_owned_path_drift', {
      committedPaths: committedOwnedPathHistory.split(/\r?\n/u).filter(Boolean),
      changedPaths: committedOwnedPathDiff.split(/\r?\n/u).filter(Boolean),
      pendingChanges: pendingOwnedPathDrift.split(/\r?\n/u).filter(Boolean),
    });
  }
  const postChildCommitHashes = controlledCloseout
    ? []
    : repairProvenance
    ? repairProvenance.postChildCommitHashes
    : [];
  const postChildOwnedPaths = controlledCloseout
    ? []
    : repairProvenance
    ? [...new Set(committedOwnedPathHistory.split(/\r?\n/u).filter(Boolean))].sort()
    : [];
  if (
    !Array.isArray(artifacts.collectionVerificationResults) ||
    artifacts.collectionVerificationResults.length !==
      manifest.collectionVerificationCommands.length
  ) {
    failure('collection_verification_incomplete');
  }
  for (const command of manifest.collectionVerificationCommands) {
    const result = artifacts.collectionVerificationResults.find((entry) => entry.id === command.id);
    if (!result || result.status !== 'pass') failure('collection_verification_incomplete');
    verifyBoundJson({
      repositoryRoot,
      binding: result.evidence,
      hashFailureClass: 'collection_evidence_hash_mismatch',
      validator: evidenceValidator,
      schemaFailureClass: 'collection_evidence_schema_invalid',
    });
  }
  for (const field of ['openObligations', 'drift', 'retries', 'scopeChanges', 'blockers']) {
    if (!Array.isArray(artifacts[field]) || artifacts[field].length > 0) {
      failure('campaign_open_blocker', { field });
    }
  }
  const repairFields = repairProvenance
    ? {
        baseAttemptId: repairProvenance.baseAttemptId,
        repairAttemptId: repairProvenance.repairAttemptId,
        repairAuthorityReceiptHash:
          repairProvenance.repairAuthorityReceiptHash,
        repairAuthorityArtifactHash:
          repairProvenance.repairAuthorityArtifactHash,
        repairClosureSetHash: repairProvenance.repairClosureSetHash,
        finalValidationHead: repairProvenance.finalValidationHead,
        finalValidationReceiptHash:
          repairProvenance.finalValidationReceiptHash,
        finalValidationArtifactHash:
          repairProvenance.finalValidationArtifactHash,
        postChildCommitHashes,
        postChildCommitSetHash: sha256(stableJson(postChildCommitHashes)),
        postChildOwnedPaths,
        postChildOwnedPathSetHash: sha256(stableJson(postChildOwnedPaths)),
      }
    : {};
  const childClosureSetHash = sha256(
    stableJson(
      repairProvenance ? { closures, ...repairFields } : closures
    )
  );
  const commitSetHash = sha256(
    stableJson(
      repairProvenance
        ? {
            childCommitHashes: commits,
            repairAmendmentCommitHash:
              repairProvenance.amendmentCommitHash,
          }
        : commits
    )
  );
  const campaignCore = {
    schemaVersion: 'goal-subcontract-campaign-audit-report/v2',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    childClosureSetHash,
    commitSetHash,
    childCount: manifest.children.length,
    childSummaries,
    ...repairFields,
    aggregateAuditDecision: 'pass',
  };
  const campaignReportHash = sha256(stableJson(campaignCore));
  const campaignReport = { ...campaignCore, campaignReportHash };
  const closeoutFields = closeoutContext
    ? {
        closeoutAttemptId: closeoutContext.closeoutAttemptId,
        compileReceiptHash: closeoutContext.compileReceipt.documentHash,
        closeoutContextHash: closeoutContext.contextHash,
        finalValidationEvidenceSetHash:
          closeoutContext.finalValidationEvidenceSetHash,
        collectionVerificationSetHash:
          closeoutContext.collectionVerificationSetHash,
        validationMaterializationHash:
          closeoutContext.validationMaterialization.hash,
        priorAttemptHash: closeoutContext.priorAttemptHash,
      }
    : {};
  const taskReport = {
    schemaVersion: closeoutContext
      ? 'goal-subcontract-campaign-task-report/v3'
      : 'goal-subcontract-campaign-task-report/v2',
    status: 'done',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    campaignReportHash,
    childClosureSetHash,
    commitSetHash,
    childSummaries,
    ...repairFields,
    ...closeoutFields,
    aggregateAuditDecision: 'pass',
    requirementRecordBinding: manifest.requirementRecordBinding,
  };
  const handoff = {
    schemaVersion: 'goal-subcontract-main-agent-handoff/v2',
    status: 'ready_for_main_agent',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    goalContractHash: manifest.goalContract.hash,
    partitionManifestHash: manifest.partitionManifest.hash,
    campaignReportHash,
    taskReportHash: sha256(stableJson(taskReport)),
    childClosureSetHash,
    commitSetHash,
    childSummaries,
    ...repairFields,
    aggregateAuditDecision: 'pass',
    requirementRecordBinding: manifest.requirementRecordBinding,
  };
  const taskReportValidator = compileBundledSchema(
    'campaign-task-report-binding.schema.json',
    'invalid_task_report',
    repositoryRoot
  );
  validateSchemaInstance(taskReportValidator, taskReport, 'invalid_task_report');
  publishOutputSet(
    outputRoot,
    {
      'campaign-audit-report.json': stableJson(campaignReport),
      'task-report.json': stableJson(taskReport),
      'main-agent-handoff.json': stableJson(handoff),
    },
    repairProvenance
      ? () => {
          if (beforePublish) beforePublish();
          verifyRepositorySnapshot(repositoryRoot, auditSnapshot);
        }
      : undefined
  );
  return {
    ok: true,
    status: 'done',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    campaignReportHash,
    taskReportHash: handoff.taskReportHash,
    ...repairFields,
    requirementRecordBindingStatus: manifest.requirementRecordBinding.status,
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    if (!args.package || !args.artifacts || !args.out) failure('invalid_arguments');
    const result = auditCompletedCampaign({
      packageRoot: args.package,
      expectedPackageManifestHash: args['expected-package-manifest-hash'],
      artifactsPath: args.artifacts,
      outputRoot: path.resolve(args.out),
      expectedRepairAuthorityArtifactHash:
        args['expected-repair-authority-artifact-hash'],
      expectedRepairAuthorityPath: args['expected-repair-authority-path'],
      expectedFinalValidationArtifactHash:
        args['expected-final-validation-artifact-hash'],
      expectedValidationCommandIds:
        typeof args['expected-final-validation-command-ids'] === 'string'
          ? args['expected-final-validation-command-ids']
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : undefined,
    });
    process.stdout.write(stableJson(result));
    return 0;
  } catch (error) {
    process.stdout.write(
      stableJson({
        ok: false,
        failureClass: error.failureClass || 'completed_campaign_audit_failed',
        details: error.details || {},
      })
    );
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  auditCompletedCampaign,
  auditCompletedChild,
  main,
  prepareCompletedCampaignAuditContext,
  publishOutputSet,
};
