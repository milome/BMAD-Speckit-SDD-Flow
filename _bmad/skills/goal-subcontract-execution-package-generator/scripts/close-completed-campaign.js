#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { auditCompletedCampaign } = require('./audit-completed-campaign.js');
const {
  compileBundledSchema,
  sha256,
  stableJson,
  validateSchemaInstance,
} = require('./build-execution-package.js');

const HELP = `Usage: close-completed-campaign --context <path> --expected-context-hash <sha256> [--json]\n`;
const PASSTHROUGH_FAILURES = new Set([
  'campaign_closeout_context_mismatch',
  'campaign_closeout_compile_binding_mismatch',
  'campaign_closeout_path_escape',
  'campaign_closeout_evidence_mismatch',
  'campaign_closeout_target_exists',
]);

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  error.failureClass = failureClass;
  error.details = details;
  throw error;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') result.help = true;
    else if (argument.startsWith('--')) result[argument.slice(2)] = argv[index + 1] ?? true;
  }
  return result;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolvedPath(base, value, failureClass = 'campaign_closeout_path_escape') {
  if (typeof value !== 'string' || value.trim() === '') failure(failureClass);
  const candidate = path.resolve(path.isAbsolute(value) ? value : path.join(base, value));
  return candidate;
}

function existingInside(root, value, failureClass = 'campaign_closeout_path_escape') {
  const lexicalRoot = path.resolve(root);
  const candidate = resolvedPath(lexicalRoot, value, failureClass);
  if (!isInside(lexicalRoot, candidate) || !fs.existsSync(candidate)) {
    failure(failureClass, { path: value });
  }
  const realRoot = fs.realpathSync.native(lexicalRoot);
  const realCandidate = fs.realpathSync.native(candidate);
  if (!isInside(realRoot, realCandidate)) failure(failureClass, { path: value });
  return realCandidate;
}

function fileInside(root, value, failureClass) {
  const candidate = existingInside(root, value, failureClass);
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink() || !stat.isFile()) failure(failureClass, { path: value });
  return candidate;
}

function manifestFileInside(invocationRoot, packageRoot, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    failure('campaign_closeout_path_escape');
  }
  const candidates = path.isAbsolute(value)
    ? [path.resolve(value)]
    : [path.resolve(invocationRoot, value), path.resolve(packageRoot, value)];
  for (const candidate of candidates) {
    if (isInside(packageRoot, candidate) && fs.existsSync(candidate)) {
      return fileInside(packageRoot, candidate, 'campaign_closeout_path_escape');
    }
  }
  failure('campaign_closeout_path_escape', { path: value });
}

function readJson(filePath, failureClass) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    failure(failureClass, { path: filePath, message: error.message });
  }
}

function verifyFileHash(filePath, expectedHash, failureClass) {
  const actualHash = sha256(fs.readFileSync(filePath));
  if (actualHash !== expectedHash) failure(failureClass, { path: filePath, actualHash });
  return actualHash;
}

function git(repositoryRoot, args, encoding = 'utf8') {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : String(result.stderr || '');
    failure('campaign_closeout_evidence_mismatch', { stderr: stderr.trim() });
  }
  return result.stdout;
}

function captureRawTrackedMaterialization(repositoryRoot) {
  const inventory = git(repositoryRoot, ['ls-files', '--stage', '-z'], null);
  const records = inventory
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d{6}) ([0-9a-f]+) (\d)\t(.+)$/u.exec(record);
      if (!match || match[3] !== '0') {
        failure('campaign_closeout_evidence_mismatch', { reason: 'non_stage0_entry' });
      }
      const [, mode, objectId, , relativePath] = match;
      const absolutePath = resolvedPath(repositoryRoot, relativePath);
      if (!isInside(repositoryRoot, absolutePath) || !fs.existsSync(absolutePath)) {
        failure('campaign_closeout_evidence_mismatch', { path: relativePath });
      }
      const stat = fs.lstatSync(absolutePath);
      if (mode === '160000') {
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
          failure('campaign_closeout_evidence_mismatch', { path: relativePath });
        }
        return { path: relativePath, mode, type: 'gitlink', commit: objectId };
      }
      if (mode === '120000') {
        if (!stat.isSymbolicLink()) {
          failure('campaign_closeout_evidence_mismatch', { path: relativePath });
        }
        return {
          path: relativePath,
          mode,
          type: 'symlink',
          hash: sha256(Buffer.from(fs.readlinkSync(absolutePath), 'utf8')),
        };
      }
      if (!['100644', '100755'].includes(mode) || !stat.isFile() || stat.isSymbolicLink()) {
        failure('campaign_closeout_evidence_mismatch', { path: relativePath });
      }
      return {
        path: relativePath,
        mode,
        type: 'blob',
        hash: sha256(fs.readFileSync(absolutePath)),
      };
    })
    .sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  return {
    head: String(git(repositoryRoot, ['rev-parse', 'HEAD'])).trim(),
    tree: String(git(repositoryRoot, ['rev-parse', 'HEAD^{tree}'])).trim(),
    hash: sha256(stableJson(records)),
  };
}

function closureBindings(childClosures) {
  return childClosures.map((child) => {
    if (
      !child ||
      typeof child.partitionId !== 'string' ||
      typeof child.evidence?.hash !== 'string' ||
      typeof child.closure?.hash !== 'string'
    ) {
      failure('campaign_closeout_evidence_mismatch', { reason: 'invalid_child_closure' });
    }
    return {
      partitionId: child.partitionId,
      evidenceHash: child.evidence.hash,
      closureHash: child.closure.hash,
    };
  });
}

function verifyEvidenceSet(repositoryRoot, bindings, expectedSetHash, commands) {
  if (sha256(stableJson(bindings)) !== expectedSetHash) {
    failure('campaign_closeout_evidence_mismatch', { reason: 'evidence_set_hash' });
  }
  if (commands && bindings.length !== commands.length) {
    failure('campaign_closeout_evidence_mismatch', { reason: 'command_count' });
  }
  const commandIds = new Set();
  return bindings.map((binding, index) => {
    const command = commands?.[index];
    if (
      !binding ||
      typeof binding.commandId !== 'string' ||
      commandIds.has(binding.commandId) ||
      !['pass', undefined].includes(binding.status) ||
      !['pass', undefined].includes(binding.decision) ||
      (command &&
        (command.id !== binding.commandId ||
          sha256(stableJson(command)) !== binding.commandDefinitionHash))
    ) {
      failure('campaign_closeout_evidence_mismatch', { commandId: binding?.commandId });
    }
    commandIds.add(binding.commandId);
    const evidencePath = fileInside(
      repositoryRoot,
      binding.immutablePath,
      'campaign_closeout_path_escape'
    );
    verifyFileHash(evidencePath, binding.documentByteHash, 'campaign_closeout_evidence_mismatch');
    return {
      binding,
      evidencePath,
      repositoryRelativePath: path.relative(repositoryRoot, evidencePath).replace(/\\/gu, '/'),
    };
  });
}

function verifyContext(context, expectedContextHash, invocationRoot) {
  const contextValidator = compileBundledSchema(
    'campaign-closeout-context.schema.json',
    'campaign_closeout_context_mismatch',
    invocationRoot
  );
  validateSchemaInstance(
    contextValidator,
    context,
    'campaign_closeout_context_mismatch'
  );
  const { contextHash, ...contextCore } = context;
  if (contextHash !== expectedContextHash || sha256(stableJson(contextCore)) !== contextHash) {
    failure('campaign_closeout_context_mismatch');
  }

  const packageRoot = resolvedPath(invocationRoot, context.package.root);
  if (!fs.existsSync(packageRoot) || fs.lstatSync(packageRoot).isSymbolicLink()) {
    failure('campaign_closeout_path_escape', { path: context.package.root });
  }
  const manifestPath = manifestFileInside(
    invocationRoot,
    packageRoot,
    context.package.manifestPath
  );
  const manifest = readJson(manifestPath, 'campaign_closeout_compile_binding_mismatch');
  const repositoryRoot = fs.realpathSync.native(path.resolve(manifest.repositoryRoot || ''));
  if (!isInside(repositoryRoot, packageRoot)) failure('campaign_closeout_path_escape');
  const { packageManifestHash, ...manifestCore } = manifest;
  if (
    manifest.packageId !== context.package.packageId ||
    packageManifestHash !== context.package.manifestSelfHash ||
    sha256(stableJson(manifestCore)) !== packageManifestHash
  ) {
    failure('campaign_closeout_compile_binding_mismatch');
  }
  verifyFileHash(
    manifestPath,
    context.package.manifestArtifactHash,
    'campaign_closeout_compile_binding_mismatch'
  );

  const compileReceiptPath = fileInside(
    repositoryRoot,
    context.compileReceipt.path,
    'campaign_closeout_path_escape'
  );
  verifyFileHash(
    compileReceiptPath,
    context.compileReceipt.documentHash,
    'campaign_closeout_compile_binding_mismatch'
  );
  const compileReceipt = readJson(
    compileReceiptPath,
    'campaign_closeout_compile_binding_mismatch'
  );
  if (
    compileReceipt.packageId !== context.package.packageId ||
    compileReceipt.packageManifestHash !== context.package.manifestSelfHash ||
    context.compileReceipt.packageId !== context.package.packageId ||
    context.compileReceipt.manifestHash !== context.package.manifestSelfHash
  ) {
    failure('campaign_closeout_compile_binding_mismatch');
  }

  const activePointerPath = fileInside(
    repositoryRoot,
    context.campaign.activePointerPath,
    'campaign_closeout_path_escape'
  );
  verifyFileHash(
    activePointerPath,
    context.campaign.activePointerDocumentHash,
    'campaign_closeout_evidence_mismatch'
  );
  const repairAuthorityPath = fileInside(
    repositoryRoot,
    context.repairAuthority.receiptPath,
    'campaign_closeout_path_escape'
  );
  const repairAuthorityDocumentHash = verifyFileHash(
    repairAuthorityPath,
    context.repairAuthority.artifactHash,
    'campaign_closeout_evidence_mismatch'
  );
  const repairAuthority = readJson(repairAuthorityPath, 'campaign_closeout_evidence_mismatch');
  if (
    (repairAuthority.receiptHash || repairAuthorityDocumentHash) !==
      context.repairAuthority.receiptHash ||
    (repairAuthority.repairAttemptId || repairAuthority.attemptId) !==
      context.repairAuthority.attemptId
  ) {
    failure('campaign_closeout_evidence_mismatch', { reason: 'repair_authority' });
  }

  if (sha256(stableJson(closureBindings(context.childClosures))) !== context.childClosureSetHash) {
    failure('campaign_closeout_evidence_mismatch', { reason: 'child_closure_set_hash' });
  }
  const collectionEvidence = verifyEvidenceSet(
    repositoryRoot,
    context.collectionEvidence,
    context.collectionVerificationSetHash,
    manifest.collectionVerificationCommands
  );
  verifyEvidenceSet(
    repositoryRoot,
    context.finalValidationEvidence,
    context.finalValidationEvidenceSetHash
  );

  const materialization = captureRawTrackedMaterialization(repositoryRoot);
  if (
    materialization.head !== context.validationMaterialization.head ||
    materialization.tree !== context.validationMaterialization.tree ||
    materialization.hash !== context.validationMaterialization.hash ||
    context.compileReceipt.validationHead !== materialization.head ||
    context.compileReceipt.validationTree !== materialization.tree ||
    context.compileReceipt.attemptId !== context.repairAuthority.attemptId
  ) {
    failure('campaign_closeout_evidence_mismatch', { reason: 'validation_materialization' });
  }
  if (sha256(stableJson(context.allowedWritePaths)) !== context.allowedWritePathSetHash) {
    failure('campaign_closeout_context_mismatch', { reason: 'allowed_write_path_set_hash' });
  }
  const targetRoot = resolvedPath(repositoryRoot, context.allowedWritePaths[0]);
  if (!isInside(repositoryRoot, targetRoot)) failure('campaign_closeout_path_escape');
  if (fs.existsSync(targetRoot)) failure('campaign_closeout_target_exists');

  return { collectionEvidence, manifest, manifestPath, packageRoot, repositoryRoot, targetRoot };
}

function writeJson(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, stableJson(value), { encoding: 'utf8', flag: 'wx' });
}

function closeCompletedCampaign({ contextPath, expectedContextHash, invocationRoot = process.cwd() }) {
  const resolvedContextPath = path.resolve(contextPath);
  const context = readJson(resolvedContextPath, 'campaign_closeout_context_mismatch');
  const verified = verifyContext(context, expectedContextHash, path.resolve(invocationRoot));
  const parent = path.dirname(verified.targetRoot);
  fs.mkdirSync(parent, { recursive: true });
  const realParent = fs.realpathSync.native(parent);
  if (!isInside(verified.repositoryRoot, realParent)) failure('campaign_closeout_path_escape');
  const draftRoot = path.join(
    parent,
    `.${path.basename(verified.targetRoot)}.${context.closeoutAttemptId}.${process.pid}.draft`
  );
  if (fs.existsSync(draftRoot)) failure('campaign_closeout_target_exists', { path: draftRoot });
  fs.mkdirSync(draftRoot);

  const auditInputPath = path.join(draftRoot, '.audit-input.json');
  const auditOutputRoot = path.join(draftRoot, '.audit-output');
  const campaignArtifacts = {
    schemaVersion: 'goal-subcontract-completed-campaign-artifacts/v1',
    packageId: verified.manifest.packageId,
    packageManifestHash: verified.manifest.packageManifestHash,
    childResults: context.childClosures,
    collectionVerificationResults: verified.collectionEvidence.map(
      ({ binding, repositoryRelativePath }) => ({
        id: binding.commandId,
        status: 'pass',
        evidence: { path: repositoryRelativePath, hash: binding.documentByteHash },
      })
    ),
    openObligations: [],
    drift: [],
    retries: [],
    scopeChanges: [],
    blockers: [],
  };
  writeJson(auditInputPath, campaignArtifacts);

  let auditResult;
  try {
    auditResult = auditCompletedCampaign({
      packageRoot: verified.packageRoot,
      expectedPackageManifestHash: verified.manifest.packageManifestHash,
      artifactsPath: auditInputPath,
      outputRoot: auditOutputRoot,
      closeoutContext: context,
    });
  } catch (error) {
    failure('campaign_closeout_audit_failed', {
      cause: error.failureClass || error.message,
    });
  }
  const materializationAfterAudit = captureRawTrackedMaterialization(
    verified.repositoryRoot
  );
  if (
    materializationAfterAudit.head !== context.validationMaterialization.head ||
    materializationAfterAudit.tree !== context.validationMaterialization.tree ||
    materializationAfterAudit.hash !== context.validationMaterialization.hash
  ) {
    failure('campaign_closeout_evidence_mismatch', {
      reason: 'validation_materialization_changed_during_audit',
    });
  }

  const campaignReportBytes = fs.readFileSync(
    path.join(auditOutputRoot, 'campaign-audit-report.json')
  );
  const candidateBytes = fs.readFileSync(path.join(auditOutputRoot, 'task-report.json'));
  fs.writeFileSync(path.join(draftRoot, 'campaign-report.json'), campaignReportBytes, { flag: 'wx' });
  fs.writeFileSync(path.join(draftRoot, 'task-report-candidate.json'), candidateBytes, { flag: 'wx' });
  const receiptCore = {
    schemaVersion: 'goal-campaign-closure-receipt/v1',
    closeoutAttemptId: context.closeoutAttemptId,
    priorAttemptHash: context.priorAttemptHash,
    contextHash: context.contextHash,
    compileReceiptHash: context.compileReceipt.documentHash,
    childClosureSetHash: context.childClosureSetHash,
    campaignReportPath: 'campaign-report.json',
    campaignReportHash: auditResult.campaignReportHash,
    taskReportCandidatePath: 'task-report-candidate.json',
    taskReportArtifactHash: sha256(candidateBytes),
    status: 'campaign_closed',
  };
  const receipt = { ...receiptCore, receiptHash: sha256(stableJson(receiptCore)) };
  const receiptValidator = compileBundledSchema(
    'goal-campaign-closure-receipt.schema.json',
    'campaign_closeout_audit_failed',
    verified.repositoryRoot
  );
  validateSchemaInstance(receiptValidator, receipt, 'campaign_closeout_audit_failed');
  writeJson(path.join(draftRoot, 'goal-campaign-closure-receipt.json'), receipt);
  fs.rmSync(auditOutputRoot, { recursive: true, force: true });
  fs.rmSync(auditInputPath, { force: true });
  if (fs.existsSync(verified.targetRoot)) failure('campaign_closeout_target_exists');
  fs.renameSync(draftRoot, verified.targetRoot);
  return {
    ok: true,
    status: 'campaign_closed',
    closeoutAttemptId: context.closeoutAttemptId,
    receiptHash: receipt.receiptHash,
    producerAuditInvocationCount: 1,
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  try {
    if (typeof args.context !== 'string' || typeof args['expected-context-hash'] !== 'string') {
      failure('campaign_closeout_context_mismatch');
    }
    process.stdout.write(
      stableJson(
        closeCompletedCampaign({
          contextPath: args.context,
          expectedContextHash: args['expected-context-hash'],
        })
      )
    );
    return 0;
  } catch (error) {
    const failureClass = PASSTHROUGH_FAILURES.has(error.failureClass)
      ? error.failureClass
      : error.failureClass || 'campaign_closeout_audit_failed';
    process.stdout.write(
      stableJson({ ok: false, failureClass, details: error.details || {} })
    );
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  captureRawTrackedMaterialization,
  closeCompletedCampaign,
  main,
};
