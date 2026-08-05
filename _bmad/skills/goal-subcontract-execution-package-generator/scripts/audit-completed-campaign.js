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

function verifyBoundFile(repositoryRoot, binding, failureClass) {
  if (!binding?.path || !binding?.hash) failure(failureClass);
  const filePath = resolveExistingInside(
    repositoryRoot,
    binding.path,
    'campaign_artifact_path_escape'
  );
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    failure(failureClass, { path: binding.path });
  }
  const actualHash = sha256(fs.readFileSync(filePath));
  if (actualHash !== binding.hash) failure(failureClass, { path: binding.path, actualHash });
  return filePath;
}

function verifyBoundJson({
  repositoryRoot,
  binding,
  hashFailureClass,
  validator,
  schemaFailureClass,
}) {
  const filePath = verifyBoundFile(repositoryRoot, binding, hashFailureClass);
  const value = readJson(filePath, schemaFailureClass);
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

function verifyFunctionalMessage({ repositoryRoot, subject, body, child, result }) {
  const match =
    /^(feat|fix|refactor|test|docs|chore|perf|build|ci)\(([a-z0-9][a-z0-9-]*)\):\s+(.+)$/u.exec(
      subject
    );
  if (!match || isNonFunctionalText(match[3], child)) {
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

function publishOutputSet(outputRoot, outputs) {
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
  git(
    repositoryRoot,
    ['merge-base', '--is-ancestor', commit.hash, 'HEAD'],
    'child_commit_not_reachable'
  );
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
    actualParent !== expectedParent ||
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

function auditCompletedCampaign({
  packageRoot,
  expectedPackageManifestHash,
  artifactsPath,
  outputRoot,
}) {
  const context = prepareCompletedCampaignAuditContext(
    packageRoot,
    expectedPackageManifestHash
  );
  const { manifest, repositoryRoot, evidenceValidator } = context;
  const artifacts = readJson(path.resolve(artifactsPath), 'invalid_campaign_artifacts');
  if (
    artifacts.schemaVersion !== 'goal-subcontract-completed-campaign-artifacts/v1' ||
    artifacts.packageId !== manifest.packageId ||
    artifacts.packageManifestHash !== manifest.packageManifestHash
  ) {
    failure('campaign_package_binding_mismatch');
  }
  if (
    !Array.isArray(artifacts.childResults) ||
    artifacts.childResults.length !== manifest.children.length
  ) {
    failure('child_result_set_incomplete');
  }
  const commits = [];
  const closures = [];
  const childSummaries = [];
  let expectedParent = manifest.repositoryBaseline.headCommit;
  for (const [index, child] of manifest.children.entries()) {
    const result = artifacts.childResults[index];
    const childAudit = auditCompletedChild({
      context,
      childIndex: index,
      result,
      expectedParent,
      priorCommitHashes: commits,
    });
    commits.push(childAudit.commitHash);
    closures.push(childAudit.closureBinding);
    childSummaries.push(childAudit.childSummary);
    expectedParent = childAudit.commitHash;
  }
  const ownedPaths = [...new Set(manifest.children.flatMap((child) => child.ownedArtifactPaths))];
  const finalChildCommit = commits.at(-1);
  const committedOwnedPathHistory = git(
    repositoryRoot,
    [
      'log',
      '--format=',
      '--name-only',
      '--no-renames',
      `${finalChildCommit}..HEAD`,
      '--',
      ...ownedPaths,
    ],
    'child_owned_path_drift'
  );
  const committedOwnedPathDiff = git(
    repositoryRoot,
    ['diff', '--name-only', '--no-renames', `${finalChildCommit}..HEAD`, '--', ...ownedPaths],
    'child_owned_path_drift'
  );
  const pendingOwnedPathDrift = git(
    repositoryRoot,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', ...ownedPaths],
    'child_owned_path_drift'
  );
  if (committedOwnedPathHistory || committedOwnedPathDiff || pendingOwnedPathDrift) {
    failure('child_owned_path_drift', {
      committedPaths: committedOwnedPathHistory.split(/\r?\n/u).filter(Boolean),
      changedPaths: committedOwnedPathDiff.split(/\r?\n/u).filter(Boolean),
      pendingChanges: pendingOwnedPathDrift.split(/\r?\n/u).filter(Boolean),
    });
  }
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
  const childClosureSetHash = sha256(stableJson(closures));
  const commitSetHash = sha256(stableJson(commits));
  const campaignCore = {
    schemaVersion: 'goal-subcontract-campaign-audit-report/v2',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    childClosureSetHash,
    commitSetHash,
    childCount: manifest.children.length,
    childSummaries,
    aggregateAuditDecision: 'pass',
  };
  const campaignReportHash = sha256(stableJson(campaignCore));
  const campaignReport = { ...campaignCore, campaignReportHash };
  const taskReport = {
    schemaVersion: 'goal-subcontract-campaign-task-report/v2',
    status: 'done',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    campaignReportHash,
    childClosureSetHash,
    commitSetHash,
    childSummaries,
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
    aggregateAuditDecision: 'pass',
    requirementRecordBinding: manifest.requirementRecordBinding,
  };
  const taskReportValidator = compileBundledSchema(
    'campaign-task-report-binding.schema.json',
    'invalid_task_report',
    repositoryRoot
  );
  validateSchemaInstance(taskReportValidator, taskReport, 'invalid_task_report');
  publishOutputSet(outputRoot, {
    'campaign-audit-report.json': stableJson(campaignReport),
    'task-report.json': stableJson(taskReport),
    'main-agent-handoff.json': stableJson(handoff),
  });
  return {
    ok: true,
    status: 'done',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    campaignReportHash,
    taskReportHash: handoff.taskReportHash,
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
