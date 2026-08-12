const fs = require('node:fs');
const path = require('node:path');
const {
  scanRequirementsContractConsumerAuthority,
  readRequirementsContractDeclaredAuthoritySources,
} = require('../source-authority/scripts/requirements-contract-consumer-authority-scanner');
const {
  atomicNoClobberPublish,
} = require('../source-authority/scripts/requirements-contract-atomic-no-clobber-publisher');
const {
  resolveRequirementsProductionTechnicalPlanningCapability,
} = require('../source-authority/scripts/requirements-contract-technical-planning-capability');
const {
  prepareRequirementsContractCp02PipelineStage,
  prepareRequirementsContractCp04FreezeStage,
  publishRequirementsContractCp04FreezeStage,
} = require('../source-authority/scripts/requirements-contract-production-semantic-pipeline');
const {
  createRequirementsContractSemanticIr,
} = require('../source-authority/scripts/requirements-contract-semantic-ir');
const {
  createRequirementsContractSourceBindingCapsule,
  createRequirementsContractResolvedEvidenceIndex,
} = require('../source-authority/scripts/requirements-contract-source-binding-capsule');
const {
  canonicalSourceSpanId,
} = require('../source-authority/scripts/requirements-contract-span-registry');
const {
  publishRequirementsContractCp05Cp08Stages,
} = require('../source-authority/scripts/requirements-contract-cp05-cp08');
const {
  ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
  activeAuthoringAttemptPointerHash,
  publishActiveAuthoringAttemptPointer,
} = require('../source-authority/scripts/requirements-contract-active-authoring-attempt-pointer');
const {
  createRequirementsContractCheckpointManifest,
  createRequirementsContractBuildManifest,
} = require('../source-authority/scripts/requirements-contract-authoring-manifest');
const {
  commitRequirementsContractAuthorityPublication,
} = require('../source-authority/scripts/requirements-contract-authority-publication-committer');
const {
  prepareRequirementsContractJudgeInvocation,
} = require('../source-authority/scripts/requirements-contract-judge-invocation');
const {
  loadConfiguredRequirementsContractJudgePrompt,
} = require('../source-authority/scripts/requirements-contract-judge-prompt-loader');
const {
  runRequirementsContractProductionJudgePipeline,
} = require('../source-authority/scripts/requirements-contract-production-judge-pipeline');
const {
  finalizeRequirementsContractRemediationDelta,
  requirementsContractAutomaticRepairSteps,
} = require('../source-authority/scripts/requirements-contract-remediation-delta-finalizer');
const {
  advanceRequirementsContractJudgeActiveRequest,
  classifyAcceptedJudgeFailureContinuation,
  closedRemediationHaltResult,
  compareAndSwapRequirementsContractJudgeActiveRequest,
} = require('../source-authority/scripts/requirements-contract-judge-lifecycle');
const {
  createUnavailableRequirementsContractJudgeSelectionReceipt,
} = require('../source-authority/scripts/requirements-contract-judge-selection');
const { writeJsonAtomic } = require('../source-authority/scripts/requirement-record-control-store');
const {
  createRequirementsGrillQuestionGraph,
} = require('../source-authority/scripts/requirements-contract-grill-model');
const {
  preflightRequirementsContractSourceBindingRefresh,
  publishRequirementsContractSourceBindingRefresh,
} = require('../source-authority/scripts/requirements-contract-source-binding-refresh');
const {
  assertRequirementsGrillSessionPathConfinement,
  resolveRequirementsGrillSessionSnapshot,
} = require('../source-authority/scripts/requirements-contract-grill-session');
const {
  sha256Stable,
} = require('../source-authority/scripts/requirements-contract-semantic-resolver');

function withoutRuntimeOnlyFlags(argv) {
  return argv.filter((arg) => {
    const value = String(arg || '');
    return (
      value !== '--legacy-orchestration' &&
      value !== '--legacyOrchestration' &&
      !value.startsWith('--legacy-orchestration=') &&
      !value.startsWith('--legacyOrchestration=')
    );
  });
}

function ensureCwd(argv, cwd) {
  if (argv.includes('--cwd') || argv.some((arg) => String(arg).startsWith('--cwd='))) return argv;
  return [...argv, '--cwd', cwd];
}

function packageOrchestrationModule() {
  return require(path.join('..', 'source-authority', 'scripts', 'main-agent-orchestration.js'));
}

async function capturePackageOrchestration(argv, cwd) {
  const orchestration = packageOrchestrationModule();
  const forwardedArgv = ensureCwd(withoutRuntimeOnlyFlags(argv), cwd);
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = function writeStdout(chunk, ...rest) {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  process.stderr.write = function writeStderr(chunk, ...rest) {
    stderr += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  try {
    const exitCode = await orchestration.mainMainAgentOrchestrationAsync(forwardedArgv);
    return {
      exitCode: typeof exitCode === 'number' ? exitCode : 0,
      stdout,
      stderr,
      forwardedArgv,
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

async function emitPackageOrchestration(context) {
  const result = await capturePackageOrchestration(context.rootArgv, context.cwd);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.exitCode;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function stableId(prefix, payload) {
  return `${prefix}-${sha256Stable(payload)
    .slice('sha256:'.length, 'sha256:'.length + 24)
    .toUpperCase()}`;
}

function confinedPath(cwd, value, issueCode) {
  const resolved = path.resolve(cwd, String(value || ''));
  const relative = path.relative(cwd, resolved);
  if (!value || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(issueCode);
  return resolved;
}

function authoringRecordRoot(cwd, requestId) {
  return path.join(cwd, '_bmad-output', 'runtime', 'requirement-records', requestId);
}

function authoringContextPath(recordRoot, authoringAttemptId) {
  return path.join(
    recordRoot,
    'authoring',
    'staging',
    authoringAttemptId,
    'authoring-context.json'
  );
}

function publishAuthoringContext(recordRoot, value) {
  atomicNoClobberPublish({
    targetPath: authoringContextPath(recordRoot, value.authoringAttemptId),
    value,
    role: 'requirements_authoring_context',
  });
  return value;
}

function fileAttemptPointerCas(recordRoot) {
  return (targetPath, expectedHash, pointer, pointerHash) => {
    if (targetPath !== ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH) return false;
    const absolute = path.join(recordRoot, ...targetPath.split('/'));
    const currentHash = fs.existsSync(absolute)
      ? activeAuthoringAttemptPointerHash(JSON.parse(fs.readFileSync(absolute, 'utf8')))
      : null;
    if (currentHash === pointerHash) return true;
    if (currentHash !== expectedHash) return false;
    writeJsonAtomic(absolute, pointer);
    return (
      activeAuthoringAttemptPointerHash(JSON.parse(fs.readFileSync(absolute, 'utf8'))) ===
      pointerHash
    );
  };
}

function sourceBindingPayload(scan) {
  const atomCandidates = scan.sourceRootCandidates.filter((candidate) =>
    ['functional_requirement', 'non_functional_requirement'].includes(candidate.rootClass)
  );
  return {
    schemaVersion: 'requirements-contract-source-binding/v1',
    authoritySourceListHash: scan.sourceList.sourceListHash,
    snapshotSetHash: sha256Stable(
      scan.sourceRootCandidates.map((candidate) => ({
        sourceRootId: candidate.sourceRootId,
        sourcePath: candidate.sourcePath,
        sourceContent: candidate.sourceContent,
      }))
    ),
    sourceSpanRegistryHash: sha256Stable(
      scan.sourceRootCandidates.map((candidate) => ({
        sourceRootId: candidate.sourceRootId,
        sourcePath: candidate.sourcePath,
        sourceSpan: candidate.sourceSpan,
      }))
    ),
    evidenceClaimRegistryHash: sha256Stable(
      atomCandidates.map((candidate) => ({
        sourceRootId: candidate.sourceRootId,
        oracle: candidate.semanticBody.oracle,
      }))
    ),
  };
}

function sourceBindingLocatorHash(sourceBinding) {
  return sha256Stable({
    snapshotSetHash: sourceBinding.snapshotSetHash ?? sha256Stable(sourceBinding.sourceArtifacts),
    sourceSpanRegistryHash: sourceBinding.sourceSpanRegistryHash,
  });
}

function atomicMustsFromScan(scan) {
  return scan.sourceRootCandidates
    .filter((candidate) =>
      ['functional_requirement', 'non_functional_requirement'].includes(candidate.rootClass)
    )
    .map((candidate) => {
      const body = candidate.semanticBody;
      const sourceSpanRef = `${candidate.sourceRootId}:${candidate.sourceSpan.startLine}-${candidate.sourceSpan.endLine}`;
      return {
        atomId: `${candidate.sourceRootId}-A1`,
        action: String(body.text || '').normalize('NFC'),
        oracle: String(body.oracle || '').normalize('NFC'),
        dependencies: Array.isArray(body.atomDependencies)
          ? [...new Set(body.atomDependencies.map(String))].sort()
          : [],
        coverageSeed: candidate.sourceRootId,
        originBindings: [{ sourceRootId: candidate.sourceRootId, sourceSpanRef }],
        authorityRefs: [candidate.sourceRootId],
        spanRefs: [sourceSpanRef],
        executionConstraintRefs: Array.isArray(body.executionConstraintRefs)
          ? [...new Set(body.executionConstraintRefs.map(String))].sort()
          : [],
      };
    });
}

function canonicalSemanticIrFromClosure(input) {
  const requirements = input.scan.sourceRootCandidates
    .filter((candidate) =>
      ['functional_requirement', 'non_functional_requirement'].includes(candidate.rootClass)
    )
    .map((candidate) => ({
      id: candidate.sourceRootId,
      text: String(candidate.semanticBody.text || '').normalize('NFC'),
      oracle: String(candidate.semanticBody.oracle || '').normalize('NFC'),
    }));
  const requirementByAtomId = new Map(
    input.cp02Candidate.atoms.map((atom) => [atom.atomId, atom.authorityRefs[0]])
  );
  const constraints = input.capability.executionRegistry.entries.map((entry) => {
    const constraintId = `${entry.kind}-${entry.id}`;
    const applicableAtoms = input.cp02Candidate.atoms.filter((atom) =>
      atom.executionConstraintRefs.includes(`${entry.kind}:${entry.id}`)
    );
    return {
      constraintId,
      kind: entry.kind,
      canonicalValue: entry.value,
      applicableMustRefs: [
        ...new Set(
          applicableAtoms.map((atom) => requirementByAtomId.get(atom.atomId)).filter(Boolean)
        ),
      ].sort(),
      applicableAtomRefs: applicableAtoms.map((atom) => atom.atomId).sort(),
      premiseRefs: applicableAtoms.flatMap((atom) => atom.authorityRefs).sort(),
      derivationReceiptRefs: [],
      disposition: 'proven',
    };
  });
  const constraintIdByLegacyRef = new Map(
    input.capability.executionRegistry.entries.map((entry) => [
      `${entry.kind}:${entry.id}`,
      `${entry.kind}-${entry.id}`,
    ])
  );
  const atoms = input.cp02Candidate.atoms.map((atom) => ({
    id: atom.atomId,
    action: atom.action,
    oracle: atom.oracle,
    requirementRef: requirementByAtomId.get(atom.atomId),
    dependencies: atom.dependencies,
    authorityRefs: atom.authorityRefs,
    executionConstraintRefs: atom.executionConstraintRefs
      .map((ref) => constraintIdByLegacyRef.get(ref))
      .filter(Boolean)
      .sort(),
  }));
  const evidenceClaims = requirements.map((requirement) => ({
    evidenceClaimId: `EVIDENCE-CLAIM-${requirement.id}`,
    authorityClass: 'source_grounded',
    normalizedClaimHash: sha256Stable({
      text: requirement.text,
      oracle: requirement.oracle,
    }),
    sourceEvidenceRequired: true,
    decisionReceiptRefs: [],
    premiseRefs: [],
    derivationReceiptRefs: [],
  }));
  const specSpanRegistry = requirements.map((requirement) => ({
    authorityClass: 'source_grounded',
    normalizedClaimHash: sha256Stable({
      text: requirement.text,
      oracle: requirement.oracle,
    }),
    boundSemanticNodeIds: [
      requirement.id,
      ...atoms.filter((atom) => atom.requirementRef === requirement.id).map((atom) => atom.id),
    ],
    boundObligationIds: [requirement.id],
    evidenceClaimRefs: [`EVIDENCE-CLAIM-${requirement.id}`],
    decisionReceiptRefs: [],
    derivationReceiptRefs: [],
  }));
  return createRequirementsContractSemanticIr({
    recordId: input.authoringRequestId,
    requestId: input.authoringRequestId,
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-cp02-compiler/v1',
    semantics: { requirements, atoms },
    evidenceClaims,
    specSpanRegistry,
    executionConstraints: constraints,
    semanticProvenance: Object.fromEntries(
      requirements.map((requirement) => [requirement.id, requirement.id])
    ),
  });
}

function resolvedEvidenceIndexForClosure(input) {
  const candidates = new Map(
    input.scan.sourceRootCandidates.map((candidate) => [candidate.sourceRootId, candidate])
  );
  return {
    schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    resolutions: input.semanticIr.semanticPayload.evidenceClaims.map((claim) => {
      const requirementId = claim.evidenceClaimId.replace(/^EVIDENCE-CLAIM-/u, '');
      const candidate = candidates.get(requirementId);
      return {
        evidenceClaimId: claim.evidenceClaimId,
        authorityClass: claim.authorityClass,
        sourceSpanRefs: candidate
          ? [
              `${candidate.sourceRootId}:${candidate.sourceSpan.startLine}-${candidate.sourceSpan.endLine}`,
            ]
          : [],
        decisionReceiptRefs: claim.decisionReceiptRefs,
        premiseRefs: claim.premiseRefs,
        derivationReceiptRefs: claim.derivationReceiptRefs,
      };
    }),
  };
}

function canonicalBindingFromClosure(input) {
  const candidateById = new Map(
    input.scan.sourceRootCandidates.map((candidate) => [candidate.sourceRootId, candidate])
  );
  const sourceArtifacts = [];
  const sourceSpans = [];
  const evidenceClaimBindings = [];
  for (const claim of input.semanticIr.semanticPayload.evidenceClaims) {
    const requirementId = claim.evidenceClaimId.replace(/^EVIDENCE-CLAIM-/u, '');
    const candidate = candidateById.get(requirementId);
    if (!candidate) throw new Error('requirements_source_binding_candidate_missing');
    const sourceSnapshotHash = sha256Stable({
      domain: 'requirements-source-snapshot/v1',
      content: candidate.sourceContent,
    });
    const normalizedContent = candidate.sourceContent.replace(/\r\n?/gu, '\n').normalize('NFC');
    const sourceSpan = {
      sourceArtifactId: candidate.sourceRootId,
      sourceSnapshotHash,
      startByte: 0,
      endByteExclusive: Buffer.byteLength(candidate.sourceContent, 'utf8'),
      startLine: 1,
      startColumn: 1,
      endLine: candidate.sourceSpan.endLine,
      endColumn: normalizedContent.split('\n').at(-1).length + 1,
      exactTextHash: sha256Stable({ domain: 'requirements-source-exact-text/v1', content: candidate.sourceContent }),
      normalizedTextHash: sha256Stable({ domain: 'requirements-source-normalized-text/v1', content: normalizedContent }),
      structuralAnchor: candidate.sourceRootId,
    };
    const sourceSpanId = canonicalSourceSpanId(sourceSpan);
    const specSpan = input.semanticIr.semanticPayload.specSpanRegistry.find((span) =>
      span.evidenceClaimRefs.includes(claim.evidenceClaimId)
    );
    if (!specSpan) throw new Error('requirements_source_binding_spec_span_missing');
    sourceArtifacts.push({
      sourceArtifactId: candidate.sourceRootId,
      role: candidate.rootClass,
      mediaType: 'application/json',
      sourceSnapshotHash,
      orderedPosition: sourceArtifacts.length,
      immutableBlobRef: candidate.sourcePath,
    });
    sourceSpans.push({ ...sourceSpan, sourceSpanId });
    evidenceClaimBindings.push({
      evidenceClaimId: claim.evidenceClaimId,
      specSpanId: specSpan.specSpanId,
      authorityClass: claim.authorityClass,
      sourceSpanRefs: [sourceSpanId],
    });
  }
  const sourceBinding = createRequirementsContractSourceBindingCapsule({
    recordId: input.authoringRequestId,
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    parentBindingRevisionId: input.parentBindingRevisionId ?? null,
    resolverIdentity: 'requirements-contract-consumer-authority-scanner/v1',
    sourceArtifacts,
    sourceSpans,
    evidenceClaimBindings,
  });
  const sourceSpanRefsByClaim = new Map(
    evidenceClaimBindings.map((binding) => [binding.evidenceClaimId, binding.sourceSpanRefs])
  );
  const resolvedEvidenceIndex = createRequirementsContractResolvedEvidenceIndex({
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    resolutions: input.semanticIr.semanticPayload.evidenceClaims.map((claim) => ({
      evidenceClaimId: claim.evidenceClaimId,
      authorityClass: claim.authorityClass,
      sourceSpanRefs: sourceSpanRefsByClaim.get(claim.evidenceClaimId) ?? [],
      decisionReceiptRefs: claim.decisionReceiptRefs,
      premiseRefs: claim.premiseRefs,
      derivationReceiptRefs: claim.derivationReceiptRefs,
    })),
  });
  return { sourceBinding, resolvedEvidenceIndex };
}

function publishAttemptCoreSnapshots(input) {
  const stagingRoot = path.join(input.recordRoot, 'authoring', 'staging', input.authoringAttemptId);
  const artifacts = {
    semanticKernel: {
      schemaVersion: 'requirements-contract-semantic-kernel/v1',
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      authoritySourceListHash: input.scan.sourceList.sourceListHash,
      sourceRoots: input.scan.sourceRootCandidates.map((candidate) => ({
        sourceRootId: candidate.sourceRootId,
        rootClass: candidate.rootClass,
        nodeType: candidate.nodeType,
        bodySchemaVersion: candidate.bodySchemaVersion,
        semanticBody: candidate.semanticBody,
        proposedAuthorityClass: candidate.proposedAuthorityClass,
      })),
    },
    mustDecompositionPacket: {
      schemaVersion: 'requirements-contract-must-decomposition-packet/v1',
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      candidateHash: input.cp02Candidate.candidateHash,
      atoms: input.cp02Candidate.atoms,
      decisions: input.cp02Candidate.decisions,
      technicalPlanningTriggerIdentity: input.cp02Candidate.technicalPlanningTriggerIdentity,
      executionRegistryHash: input.cp02Candidate.executionRegistryHash,
    },
    idRegistry: {
      schemaVersion: 'requirements-contract-id-registry/v1',
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      sourceRootIds: input.scan.sourceRootCandidates
        .map((candidate) => candidate.sourceRootId)
        .sort(),
      atomIds: input.cp02Candidate.atoms.map((atom) => atom.atomId).sort(),
      executionConstraintRefs: [
        ...new Set(input.cp02Candidate.atoms.flatMap((atom) => atom.executionConstraintRefs)),
      ].sort(),
    },
  };
  const artifactDefinitions = [
    {
      key: 'semanticKernel',
      role: 'semantic_kernel',
      fileName: 'semantic-kernel.json',
      artifactId: `semantic-kernel-${input.authoringAttemptId}`,
    },
    {
      key: 'mustDecompositionPacket',
      role: 'must_decomposition_packet',
      fileName: 'must_decomposition_packet.json',
      artifactId: `must-decomposition-packet-${input.authoringAttemptId}`,
    },
    {
      key: 'idRegistry',
      role: 'id_registry',
      fileName: 'id-registry.json',
      artifactId: `id-registry-${input.authoringAttemptId}`,
    },
  ];
  const artifactEntries = artifactDefinitions.map((definition) => {
    const value = artifacts[definition.key];
    const targetPath = path.join(stagingRoot, definition.fileName);
    atomicNoClobberPublish({
      targetPath,
      value,
      role: definition.role,
    });
    return {
      role: definition.role,
      schemaVersion: value.schemaVersion,
      artifactId: definition.artifactId,
      recordRelativePath: `authoring/staging/${input.authoringAttemptId}/${definition.fileName}`,
      artifactHash: sha256Stable(value),
    };
  });
  const stages = [
    { checkpointId: 'cp00', checkpointOrdinal: 0, status: 'passed', entryCount: 1 },
    { checkpointId: 'cp01', checkpointOrdinal: 1, status: 'passed', entryCount: 2 },
    {
      checkpointId: 'cp02',
      checkpointOrdinal: 2,
      status: input.cp02Candidate.status === 'technical_planning_pending' ? 'pending' : 'passed',
      entryCount: 3,
    },
    ...(input.cp02Candidate.status === 'closed'
      ? [{ checkpointId: 'cp03', checkpointOrdinal: 3, status: 'passed', entryCount: 3 }]
      : []),
  ];
  let previousCheckpointManifestRef = null;
  let lastManifest = null;
  for (const stage of stages) {
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      checkpointId: stage.checkpointId,
      checkpointOrdinal: stage.checkpointOrdinal,
      stage: stage.checkpointId,
      status: stage.status,
      inputManifestHash: input.scan.sourceList.sourceListHash,
      previousCheckpointManifestRef,
      latestValidPredecessorCheckpoint: previousCheckpointManifestRef?.checkpointId ?? null,
      compilerIdentity: 'requirements-contract-cp00-cp04-compiler/v1',
      artifactEntries: artifactEntries.slice(0, stage.entryCount),
      decisionReceiptRefs: input.decisionReceiptRefs,
      baseAuthorityRef: null,
    });
    const relativePath =
      `authoring/staging/${input.authoringAttemptId}/manifests/` +
      `${stage.checkpointOrdinal}-${stage.checkpointId}.json`;
    atomicNoClobberPublish({
      targetPath: path.join(input.recordRoot, ...relativePath.split('/')),
      value: manifest,
      role: 'requirements_contract_checkpoint_manifest',
    });
    previousCheckpointManifestRef = {
      checkpointId: stage.checkpointId,
      checkpointOrdinal: stage.checkpointOrdinal,
      path: relativePath,
      hash: manifest.checkpointManifestHash,
    };
    lastManifest = manifest;
  }
  if (input.cp02Candidate.status === 'technical_planning_pending') {
    const pointer = {
      schemaVersion: 'ActiveAuthoringAttemptPointer/v1',
      authoringAttemptId: input.authoringAttemptId,
      attemptManifestPath: previousCheckpointManifestRef.path,
      attemptManifestHash: previousCheckpointManifestRef.hash,
      latestValidPredecessorCheckpoint: lastManifest.latestValidPredecessorCheckpoint,
      inputManifestHash: input.scan.sourceList.sourceListHash,
    };
    const pointerPath = path.join(
      input.recordRoot,
      ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/')
    );
    const currentPointer = fs.existsSync(pointerPath)
      ? JSON.parse(fs.readFileSync(pointerPath, 'utf8'))
      : null;
    const pointerHash = activeAuthoringAttemptPointerHash(pointer);
    if (!currentPointer || activeAuthoringAttemptPointerHash(currentPointer) !== pointerHash) {
      publishActiveAuthoringAttemptPointer({
        pointer,
        expectedCurrentPointerHash: currentPointer
          ? activeAuthoringAttemptPointerHash(currentPointer)
          : null,
        readAttemptManifest: () => lastManifest,
        compareAndSwap: fileAttemptPointerCas(input.recordRoot),
      });
    }
  }
  return { artifacts, artifactEntries, terminalManifestRef: previousCheckpointManifestRef };
}

function cliContinuationResult(input) {
  const payload = {
    schemaVersion: 'requirements-contract-cli-result/v1',
    status: input.status,
    issueCode: input.issueCode,
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    grillSessionId: input.grillSessionId ?? null,
    resumable: true,
    nextAction: 'resume-author-confirmation-ready-source',
    decisionReceiptRefs: input.decisionReceiptRefs ?? [],
    frontier: [],
    forbiddenArtifacts: ['active_authority', 'confirmation', 'projection', 'target_source'],
  };
  return {
    ...payload,
    resultHash: sha256Stable({ domain: 'requirements-contract-cli-result/v1', payload }),
    exitCode: 0,
    errors: [],
  };
}

function readRecordJson(recordRoot, recordRelativePath) {
  const absolute = path.resolve(recordRoot, ...String(recordRelativePath || '').split('/'));
  const relative = path.relative(recordRoot, absolute);
  if (!recordRelativePath || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_authoring_record_path_escape');
  }
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function comparableProjectionArtifacts(buildManifest) {
  return (Array.isArray(buildManifest.artifactEntries) ? buildManifest.artifactEntries : [])
    .filter((entry) => entry.role !== 'lint_report')
    .map((entry) => ({
      role: entry.role,
      artifactId: entry.artifactId,
      schemaVersion: entry.schemaVersion,
      artifactHash: entry.artifactHash,
    }))
    .sort((left, right) =>
      left.role.localeCompare(right.role, 'en') || left.artifactId.localeCompare(right.artifactId, 'en')
    );
}

function remediationRepairSteps(plan) {
  return requirementsContractAutomaticRepairSteps(plan);
}

const CLOSED_REMEDIATION_ISSUE_CODES = new Set([
  'judge_remediation_no_progress',
  'judge_remediation_limit_reached',
  'requirements_contract_remediation_blocked',
]);

function persistClosedRemediationHalt(input) {
  if (!CLOSED_REMEDIATION_ISSUE_CODES.has(input.issueCode)) return null;
  const current = JSON.parse(fs.readFileSync(input.activeJudgeRequestPath, 'utf8'));
  if (current.judgeRequestHash !== input.activeRequest.judgeRequestHash) {
    throw new Error('requirements_contract_judge_active_cas_conflict');
  }
  if (current.lastIssueCode !== input.issueCode) {
    const next = advanceRequirementsContractJudgeActiveRequest(current, {
      lastIssueCode: input.issueCode,
    });
    compareAndSwapRequirementsContractJudgeActiveRequest({
      recordRoot: input.recordRoot,
      expected: current,
      next,
    });
  }
  return closedRemediationHaltResult({
    issueCode: input.issueCode,
    authoringRequestId: input.requestId,
    authoringAttemptId: input.currentAuthority.activeAuthoringAttemptId,
    judgeRequestHash: input.activeRequest.judgeRequestHash,
    automaticRemediationCount: input.request.remediation ? 1 : 0,
  });
}

async function continueAcceptedJudgeFailure(input) {
  const activeRequest = input.activeRequest;
  const request = readRecordJson(input.recordRoot, activeRequest.requestPath);
  if (request.judgeRequestHash !== activeRequest.judgeRequestHash) {
    throw new Error('requirements_contract_judge_request_readback_mismatch');
  }
  const continuation = classifyAcceptedJudgeFailureContinuation({ request, activeRequest });
  if (continuation === 'limit') throw new Error('judge_remediation_limit_reached');
  const plan = readRecordJson(input.recordRoot, activeRequest.remediationPlanRef.path);
  const aggregate = readRecordJson(input.recordRoot, activeRequest.aggregateRef.path);
  const repairSteps = remediationRepairSteps(plan);
  const repairAttemptId = stableId('ATTEMPT', {
    requestId: input.requestId,
    remediatesRequestHash: activeRequest.judgeRequestHash,
    remediationPlanHash: plan.remediationPlanHash,
  });
  const repairContext = publishAuthoringContext(input.recordRoot, {
    ...input.authoringContext,
    authoringAttemptId: repairAttemptId,
  });
  const repairStagingRoot = path.join(input.recordRoot, 'authoring', 'staging', repairAttemptId);
  atomicNoClobberPublish({
    targetPath: path.join(repairStagingRoot, 'consumer-authority-source-list.json'),
    value: input.scan.sourceList,
    role: 'requirements_consumer_authority_source_list',
  });
  atomicNoClobberPublish({
    targetPath: path.join(repairStagingRoot, 'cp02-technical-planning-capability.json'),
    value: input.capability,
    role: 'requirements_technical_planning_capability',
  });
  atomicNoClobberPublish({
    targetPath: path.join(repairStagingRoot, 'cp02-candidate.json'),
    value: input.cp02Candidate,
    role: 'requirements_cp02_candidate',
  });
  const coreSnapshots = publishAttemptCoreSnapshots({
    recordRoot: input.recordRoot,
    authoringRequestId: input.requestId,
    authoringAttemptId: repairAttemptId,
    scan: input.scan,
    cp02Candidate: input.cp02Candidate,
    decisionReceiptRefs: input.decisionReceiptRefs,
  });
  const currentPointerPath = path.join(
    input.recordRoot,
    ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/')
  );
  const currentPointer = JSON.parse(fs.readFileSync(currentPointerPath, 'utf8'));
  const currentPointerHash = activeAuthoringAttemptPointerHash(currentPointer);
  const currentBuildManifest = readRecordJson(
    input.recordRoot,
    input.currentAuthority.activeBuildManifestPath
  );
  const existingDelta = continuation === 'resume_commit'
    ? readRecordJson(input.recordRoot, activeRequest.remediationDeltaRef.path)
    : null;
  if (
    existingDelta &&
    (existingDelta.remediationDeltaHash !== activeRequest.remediationDeltaRef.hash ||
      existingDelta.remediatesRequestHash !== activeRequest.judgeRequestHash)
  ) {
    throw new Error('requirements_contract_remediation_delta_readback_mismatch');
  }
  if (existingDelta && sha256Stable(input.currentAuthority) === existingDelta.afterAuthorityHash) {
    return {
      repairContext,
      activeAuthority: input.currentAuthority,
      buildManifest: currentBuildManifest,
      auditPacket: readRecordJson(input.recordRoot, currentBuildManifest.auditPacketRef.path),
      remediation: {
        remediatesRequestHash: activeRequest.judgeRequestHash,
        remediationAggregateHash: aggregate.requirementsAuditAggregateHash,
        remediationDeltaHash: existingDelta.remediationDeltaHash,
      },
    };
  }
  if (existingDelta && sha256Stable(input.currentAuthority) !== existingDelta.beforeAuthorityHash) {
    throw new Error('requirements_contract_remediation_authority_recovery_mismatch');
  }
  const semanticIr = readRecordJson(input.recordRoot, input.currentAuthority.activeSemanticIrPath);
  const sourceBinding = readRecordJson(input.recordRoot, input.currentAuthority.activeSourceBindingPath);
  const resolvedEvidenceIndex = readRecordJson(
    input.recordRoot,
    `authoring/source-bindings/${input.currentAuthority.activeBindingRevisionId}/resolved-evidence-index.json`
  );
  const cp04Stage = prepareRequirementsContractCp04FreezeStage({
    semanticIr,
    sourceBinding,
    resolvedEvidenceIndex,
  });
  const cp04Publication = publishRequirementsContractCp04FreezeStage({
    recordRootPath: input.recordRoot,
    stage: cp04Stage,
    authoringRequestId: input.requestId,
    authoringAttemptId: repairAttemptId,
    inputManifestHash: input.scan.sourceList.sourceListHash,
    previousCheckpointManifestRef: coreSnapshots.terminalManifestRef,
    compilerIdentity: 'requirements-contract-remediation-projection-compiler/v1',
    decisionReceiptRefs: currentBuildManifest.decisionReceiptRefs,
    baseAuthorityRef: input.currentAuthority,
    expectedCurrentPointerHash: currentPointerHash,
    compareAndSwapAttemptPointer: fileAttemptPointerCas(input.recordRoot),
    deferAttemptPointerActivation: true,
  });
  const cp08Publication = publishRequirementsContractCp05Cp08Stages({
    recordRoot: input.recordRoot,
    sourcePath: input.intakeSource,
    authoringRequestId: input.requestId,
    authoringAttemptId: repairAttemptId,
    inputManifestHash: input.scan.sourceList.sourceListHash,
    previousCheckpointManifestRef: {
      checkpointId: 'cp04', checkpointOrdinal: 4,
      path: `authoring/staging/${repairAttemptId}/manifests/4-cp04.json`,
      hash: cp04Publication.checkpointManifest.checkpointManifestHash,
    },
    expectedCurrentPointerHash: currentPointerHash,
    compareAndSwapAttemptPointer: fileAttemptPointerCas(input.recordRoot),
    deferAttemptPointerActivation: true,
    semanticIr: cp04Stage.semanticIr,
    sourceBinding: cp04Stage.sourceBinding,
    resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
    decisionReceiptRefs: currentBuildManifest.decisionReceiptRefs,
  });
  const nextBuildManifest = createRequirementsContractBuildManifest({
    authoringRequestId: input.requestId,
    authoringAttemptId: repairAttemptId,
    inputManifestHash: input.scan.sourceList.sourceListHash,
    terminalCheckpointManifestRef: cp08Publication.terminalManifestRef,
    semanticAuthorityRef: currentBuildManifest.semanticAuthorityRef,
    bindingAuthorityRef: currentBuildManifest.bindingAuthorityRef,
    artifactEntries: cp08Publication.terminalManifest.artifactEntries,
    decisionReceiptRefs: currentBuildManifest.decisionReceiptRefs,
    auditPacketRef: cp08Publication.canonicalAuditPacketRef,
    projectionReportRefs: cp08Publication.projectionReportRefs,
  });
  if (
    sha256Stable(comparableProjectionArtifacts(currentBuildManifest)) ===
    sha256Stable(comparableProjectionArtifacts(nextBuildManifest))
  ) {
    throw new Error('judge_remediation_no_progress');
  }
  const changedArtifacts = comparableProjectionArtifacts(nextBuildManifest)
    .filter((next) => !comparableProjectionArtifacts(currentBuildManifest)
      .some((current) => current.role === next.role && current.artifactId === next.artifactId && current.artifactHash === next.artifactHash));
  const changedArtifactRoles = changedArtifacts.map((entry) => entry.role);
  const changedArtifactRefs = changedArtifacts.map((entry) => entry.artifactId);
  const nextAuthority = {
    ...input.currentAuthority,
    activeAuthoringAttemptId: repairAttemptId,
    activeBuildManifestPath: `authoring/staging/${repairAttemptId}/contract-build-manifest.json`,
    activeBuildManifestHash: nextBuildManifest.buildManifestHash,
  };
  const delta = finalizeRequirementsContractRemediationDelta({
    plan,
    beforeAuthority: input.currentAuthority,
    afterAuthority: nextAuthority,
    executedRepairStepRefs: repairSteps.map((step) => step.findingId),
    deferredRepairStepRefs: [],
    changedArtifactRoles,
    changedArtifactRefs,
    automaticRemediationCount: 0,
    maxAutomaticRemediations: 1,
  });
  const deltaPath = `quality/requests/${activeRequest.judgeRequestHash.replace(':', '-')}/remediation-delta.json`;
  if (existingDelta) {
    if (
      deltaPath !== activeRequest.remediationDeltaRef.path ||
      delta.remediationDeltaHash !== activeRequest.remediationDeltaRef.hash ||
      sha256Stable(delta) !== sha256Stable(existingDelta)
    ) {
      throw new Error('requirements_contract_remediation_delta_recovery_mismatch');
    }
  } else {
    atomicNoClobberPublish({
      targetPath: path.join(input.recordRoot, ...deltaPath.split('/')),
      value: delta,
      role: 'remediation_delta',
    });
    const updatedActiveRequest = advanceRequirementsContractJudgeActiveRequest(activeRequest, {
      remediationDeltaRef: { path: deltaPath, hash: delta.remediationDeltaHash },
    });
    compareAndSwapRequirementsContractJudgeActiveRequest({
      recordRoot: input.recordRoot,
      expected: activeRequest,
      next: updatedActiveRequest,
    });
  }
  publishActiveAuthoringAttemptPointer({
    pointer: cp08Publication.attemptPointer.pointer,
    expectedCurrentPointerHash: currentPointerHash,
    readAttemptManifest: () => cp08Publication.terminalManifest,
    compareAndSwap: fileAttemptPointerCas(input.recordRoot),
  });
  const requirementRecordPath = path.join(input.recordRoot, 'record', 'requirement-record.json');
  commitRequirementsContractAuthorityPublication({
    route: 'projection_repair',
    current: input.currentAuthority,
    next: nextAuthority,
    recordRootPath: input.recordRoot,
    buildManifestTargetPath: path.join(input.recordRoot, ...nextAuthority.activeBuildManifestPath.split('/')),
    buildManifest: nextBuildManifest,
    compareAndSwapAuthorityTuple(current, next) {
      const latest = JSON.parse(fs.readFileSync(requirementRecordPath, 'utf8'));
      if (sha256Stable(latest.activeAuthority) !== sha256Stable(current)) return false;
      writeJsonAtomic(requirementRecordPath, { ...latest, activeAuthority: next, lifecycle: 'audit_pending' });
      return true;
    },
  });
  return {
    repairContext,
    activeAuthority: nextAuthority,
    buildManifest: nextBuildManifest,
    auditPacket: readRecordJson(input.recordRoot, cp08Publication.canonicalAuditPacketRef.path),
    remediation: {
      remediatesRequestHash: activeRequest.judgeRequestHash,
      remediationAggregateHash: aggregate.requirementsAuditAggregateHash,
      remediationDeltaHash: delta.remediationDeltaHash,
    },
  };
}

async function continueAuthoringFromContext(context, authoringContext, options = {}) {
  const requestId = String(authoringContext.authoringRequestId || '').trim();
  const authoringAttemptId = String(authoringContext.authoringAttemptId || '').trim();
  if (!SAFE_ID.test(requestId) || !SAFE_ID.test(authoringAttemptId)) {
    throw new Error('requirements_authoring_resume_identity_invalid');
  }
  const intakeSource = confinedPath(
    context.cwd,
    authoringContext.intakeSource,
    'requirements_authoring_intake_source_invalid'
  );
  confinedPath(
    context.cwd,
    authoringContext.targetSource,
    'requirements_authoring_target_source_invalid'
  );
  const authoritySources = readRequirementsContractDeclaredAuthoritySources(intakeSource);
  const scan = scanRequirementsContractConsumerAuthority({
    cwd: context.cwd,
    intakeSource,
    authoritySources,
  });
  if (scan.conflicts.length > 0) throw new Error('requirements_authority_conflict');
  if (scan.sourceList.sourceListHash !== authoringContext.authoritySourceListHash) {
    throw new Error('requirements_authority_context_stale');
  }
  const recordRoot = authoringRecordRoot(context.cwd, requestId);
  const stagingRoot = path.join(recordRoot, 'authoring', 'staging', authoringAttemptId);
  atomicNoClobberPublish({
    targetPath: path.join(stagingRoot, 'consumer-authority-source-list.json'),
    value: scan.sourceList,
    role: 'requirements_consumer_authority_source_list',
  });
  const capability = resolveRequirementsProductionTechnicalPlanningCapability({
    authoringRequestId: requestId,
    authoringAttemptId,
    premiseHash: scan.sourceList.sourceListHash,
    sourceRootCandidates: scan.sourceRootCandidates,
  });
  atomicNoClobberPublish({
    targetPath: path.join(stagingRoot, 'cp02-technical-planning-capability.json'),
    value: capability,
    role: 'requirements_technical_planning_capability',
  });
  const cp02Candidate = prepareRequirementsContractCp02PipelineStage({
    authoringRequestId: requestId,
    authoringAttemptId,
    atoms: atomicMustsFromScan(scan),
    decisions: [],
    technicalPlanning: capability,
  });
  atomicNoClobberPublish({
    targetPath: path.join(stagingRoot, 'cp02-candidate.json'),
    value: cp02Candidate,
    role: 'requirements_cp02_candidate',
  });
  const decisionReceiptRefs = (options.decisionReceiptRefs ?? []).map((ref) => ({
    decisionReceiptId: path.basename(ref.path, '.json'),
    path: ref.path,
    hash: ref.hash,
  }));
  const coreSnapshots = publishAttemptCoreSnapshots({
    recordRoot,
    authoringRequestId: requestId,
    authoringAttemptId,
    scan,
    cp02Candidate,
    decisionReceiptRefs,
  });
  if (capability.status !== 'resolved') {
    return cliContinuationResult({
      status: 'technical_planning_pending',
      issueCode: 'requirements_technical_planning_pending',
      authoringRequestId: requestId,
      authoringAttemptId,
      grillSessionId: options.grillSessionId,
      decisionReceiptRefs: options.decisionReceiptRefs,
    });
  }
  if (cp02Candidate.status !== 'closed') {
    throw new Error(cp02Candidate.issueCodes[0] || 'requirements_cp02_closure_failed');
  }
  const activeJudgeRequestPath = path.join(recordRoot, 'quality', 'active-request.json');
  const activeJudgeRequest = fs.existsSync(activeJudgeRequestPath)
    ? JSON.parse(fs.readFileSync(activeJudgeRequestPath, 'utf8'))
    : null;
  if (activeJudgeRequest?.status === 'audited_fail') {
    const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
    const requirementRecord = JSON.parse(fs.readFileSync(requirementRecordPath, 'utf8'));
    let repair;
    try {
      repair = await continueAcceptedJudgeFailure({
        recordRoot,
        requestId,
        intakeSource,
        authoringContext,
        currentAuthority: requirementRecord.activeAuthority,
        activeRequest: activeJudgeRequest,
        scan,
        capability,
        cp02Candidate,
        decisionReceiptRefs,
      });
    } catch (error) {
      const issueCode = error instanceof Error ? error.message : '';
      const halted = persistClosedRemediationHalt({
        issueCode,
        activeJudgeRequestPath,
        activeRequest: activeJudgeRequest,
        request: readRecordJson(recordRoot, activeJudgeRequest.requestPath),
        recordRoot,
        requestId,
        currentAuthority: requirementRecord.activeAuthority,
      });
      if (halted) return halted;
      throw error;
    }
    let prepared;
    try {
      prepared = await prepareRequirementsContractJudgeInvocation({
        projectRoot: context.cwd,
        config: '_bmad/_config/governance-remediation.yaml',
      });
    } catch {
      return cliContinuationResult({
        status: 'audit_pending',
        issueCode: 'requirements_audit_pending',
        authoringRequestId: requestId,
        authoringAttemptId: repair.repairContext.authoringAttemptId,
        decisionReceiptRefs: options.decisionReceiptRefs,
      });
    }
    const configuredPrompt = loadConfiguredRequirementsContractJudgePrompt({
      projectRoot: context.cwd,
      promptConfig: prepared.judgeRuntime.promptConfig,
    });
    const auditPacketBody = repair.auditPacket.body || {};
    const judge = await runRequirementsContractProductionJudgePipeline({
      authoringRequestId: requestId,
      recordRoot,
      activeAuthority: repair.activeAuthority,
      buildManifest: repair.buildManifest,
      auditPacket: repair.auditPacket,
      judgePrompt: {
        systemPrompt: configuredPrompt.systemPrompt,
        rubric: {
          mandatoryDimensionIds: Array.isArray(auditPacketBody.mandatoryDimensionIds)
            ? auditPacketBody.mandatoryDimensionIds
            : [],
        },
        structuredOutputSchema: configuredPrompt.structuredOutputSchema,
        outputTokenReserve: configuredPrompt.outputTokenReserve,
      },
      providerSelection: {
        providerRef: prepared.providerRef,
        provider: prepared.provider,
        adapterRef: prepared.provider.adapterRef ||
          (prepared.provider.transport === 'openai-compatible'
            ? 'OpenAICompatibleJudgeAdapter'
            : prepared.provider.transport === 'anthropic-compatible'
              ? 'AnthropicCompatibleJudgeAdapter'
              : prepared.provider.transport === 'claude-code-cli'
                ? 'ClaudeCodeCliJudgeAdapter'
                : 'CodexCliJudgeAdapter'),
        providerRegistryHash: prepared.providerRegistryHash,
      },
      preparedInvocation: prepared,
      remediation: repair.remediation,
    });
    return cliContinuationResult({
      status: judge.status === 'audited_pass' ? 'final_render_pending' : 'audit_pending',
      issueCode: judge.status === 'audited_pass'
        ? 'requirements_final_render_pending'
        : 'requirements_audit_pending',
      authoringRequestId: requestId,
      authoringAttemptId: repair.repairContext.authoringAttemptId,
      decisionReceiptRefs: options.decisionReceiptRefs,
    });
  }
  const semanticIr = canonicalSemanticIrFromClosure({
    authoringRequestId: requestId,
    scan,
    cp02Candidate,
    capability,
  });
  const canonicalBinding = canonicalBindingFromClosure({
    authoringRequestId: requestId,
    scan,
    semanticIr,
  });
  const cp04Stage = prepareRequirementsContractCp04FreezeStage({
    semanticIr,
    sourceBinding: canonicalBinding.sourceBinding,
    resolvedEvidenceIndex: canonicalBinding.resolvedEvidenceIndex,
  });
  const pointerPath = path.join(recordRoot, ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/'));
  const expectedCurrentPointerHash = fs.existsSync(pointerPath)
    ? activeAuthoringAttemptPointerHash(JSON.parse(fs.readFileSync(pointerPath, 'utf8')))
    : null;
  const cp04Publication = publishRequirementsContractCp04FreezeStage({
    recordRootPath: recordRoot,
    stage: cp04Stage,
    authoringRequestId: requestId,
    authoringAttemptId,
    inputManifestHash: scan.sourceList.sourceListHash,
    previousCheckpointManifestRef: coreSnapshots.terminalManifestRef,
    compilerIdentity: 'requirements-contract-cp02-compiler/v1',
    decisionReceiptRefs,
    baseAuthorityRef: null,
    expectedCurrentPointerHash,
    compareAndSwapAttemptPointer: fileAttemptPointerCas(recordRoot),
  });
  const cp08Publication = publishRequirementsContractCp05Cp08Stages({
    recordRoot,
    sourcePath: intakeSource,
    authoringRequestId: requestId,
    authoringAttemptId,
    inputManifestHash: scan.sourceList.sourceListHash,
    previousCheckpointManifestRef: {
      checkpointId: 'cp04',
      checkpointOrdinal: 4,
      path: `authoring/staging/${authoringAttemptId}/manifests/4-cp04.json`,
      hash: cp04Publication.checkpointManifest.checkpointManifestHash,
    },
    expectedCurrentPointerHash: cp04Publication.attemptPointer.pointerHash,
    compareAndSwapAttemptPointer: fileAttemptPointerCas(recordRoot),
    semanticIr: cp04Stage.semanticIr,
    sourceBinding: cp04Stage.sourceBinding,
    resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
    decisionReceiptRefs,
  });
  const buildManifest = createRequirementsContractBuildManifest({
    authoringRequestId: requestId,
    authoringAttemptId,
    inputManifestHash: scan.sourceList.sourceListHash,
    terminalCheckpointManifestRef: cp08Publication.terminalManifestRef,
    semanticAuthorityRef: {
      semanticRevisionId: cp04Stage.semanticIdentity.semanticRevisionId,
      path: `authoring/semantic-revisions/${cp04Stage.semanticIdentity.semanticRevisionId}/semantic-ir.json`,
      hash: cp04Stage.semanticIdentity.scopeSemanticHash,
    },
    bindingAuthorityRef: {
      bindingRevisionId: cp04Stage.bindingIdentity.bindingRevisionId,
      path: `authoring/source-bindings/${cp04Stage.bindingIdentity.bindingRevisionId}/source-binding.json`,
      hash: cp04Stage.bindingIdentity.sourceBindingHash,
    },
    artifactEntries: cp08Publication.terminalManifest.artifactEntries,
    decisionReceiptRefs,
    auditPacketRef: cp08Publication.canonicalAuditPacketRef,
    projectionReportRefs: cp08Publication.projectionReportRefs,
  });
  const activeAuthority = {
    activeSemanticRevisionId: cp04Stage.semanticIdentity.semanticRevisionId,
    activeSemanticIrPath: buildManifest.semanticAuthorityRef.path,
    activeScopeSemanticHash: cp04Stage.semanticIdentity.scopeSemanticHash,
    activeBindingRevisionId: cp04Stage.bindingIdentity.bindingRevisionId,
    activeSourceBindingPath: buildManifest.bindingAuthorityRef.path,
    activeSourceBindingHash: cp04Stage.bindingIdentity.sourceBindingHash,
    activeAuthoringAttemptId: authoringAttemptId,
    activeBuildManifestPath: `authoring/staging/${authoringAttemptId}/contract-build-manifest.json`,
    activeBuildManifestHash: buildManifest.buildManifestHash,
  };
  const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  const currentRecord = fs.existsSync(requirementRecordPath)
    ? JSON.parse(fs.readFileSync(requirementRecordPath, 'utf8'))
    : null;
  if (sha256Stable(currentRecord?.activeAuthority ?? null) !== sha256Stable(activeAuthority)) {
    commitRequirementsContractAuthorityPublication({
      route: 'initial',
      current: currentRecord?.activeAuthority ?? null,
      next: activeAuthority,
      recordRootPath: recordRoot,
      buildManifestTargetPath: path.join(recordRoot, ...activeAuthority.activeBuildManifestPath.split('/')),
      buildManifest,
      compareAndSwapAuthorityTuple(current, next) {
        const latest = fs.existsSync(requirementRecordPath)
          ? JSON.parse(fs.readFileSync(requirementRecordPath, 'utf8'))
          : null;
        if (sha256Stable(latest?.activeAuthority ?? null) !== sha256Stable(current)) return false;
        writeJsonAtomic(requirementRecordPath, {
          schemaVersion: 'requirements-contract-record/v1',
          recordId: requestId,
          lifecycle: 'audit_pending',
          confirmedScopeSemanticHash: null,
          activeAuthority: next,
        });
        return true;
      },
    });
  }
  let prepared;
  try {
    prepared = await prepareRequirementsContractJudgeInvocation({
      projectRoot: context.cwd,
      config: '_bmad/_config/governance-remediation.yaml',
    });
  } catch (error) {
    const issueCode = error instanceof Error ? error.message : 'judge_provider_unavailable';
    const unavailable = createUnavailableRequirementsContractJudgeSelectionReceipt({
      providerRegistryHash: sha256Stable({ unavailable: true }),
      providerConfigurationHash: sha256Stable({
        config: '_bmad/_config/governance-remediation.yaml',
      }),
      issueCode,
    });
    atomicNoClobberPublish({
      targetPath: path.join(
        recordRoot,
        'quality',
        'selections',
        unavailable.providerSelectionHash.replace(':', '-'),
        'provider-selection-receipt.json'
      ),
      value: unavailable,
      role: 'requirements_judge_selection',
    });
    return cliContinuationResult({
      status: 'audit_pending',
      issueCode: 'requirements_audit_pending',
      authoringRequestId: requestId,
      authoringAttemptId,
      grillSessionId: options.grillSessionId,
      decisionReceiptRefs: options.decisionReceiptRefs,
    });
  }
  const auditPacket = JSON.parse(
    fs.readFileSync(path.join(recordRoot, ...cp08Publication.canonicalAuditPacketRef.path.split('/')), 'utf8')
  );
  const configuredPrompt = loadConfiguredRequirementsContractJudgePrompt({
    projectRoot: context.cwd,
    promptConfig: prepared.judgeRuntime.promptConfig,
  });
  const auditPacketBody = auditPacket.body || {};
  const judge = await runRequirementsContractProductionJudgePipeline({
    authoringRequestId: requestId,
    recordRoot,
    activeAuthority,
    buildManifest,
    auditPacket,
    judgePrompt: {
      systemPrompt: configuredPrompt.systemPrompt,
      rubric: {
        mandatoryDimensionIds: Array.isArray(auditPacketBody.mandatoryDimensionIds)
          ? auditPacketBody.mandatoryDimensionIds
          : [],
      },
      structuredOutputSchema: configuredPrompt.structuredOutputSchema,
      outputTokenReserve: configuredPrompt.outputTokenReserve,
    },
    providerSelection: {
      providerRef: prepared.providerRef,
      provider: prepared.provider,
      adapterRef: prepared.provider.adapterRef ||
        (prepared.provider.transport === 'openai-compatible'
          ? 'OpenAICompatibleJudgeAdapter'
          : prepared.provider.transport === 'anthropic-compatible'
            ? 'AnthropicCompatibleJudgeAdapter'
            : prepared.provider.transport === 'claude-code-cli'
              ? 'ClaudeCodeCliJudgeAdapter'
              : 'CodexCliJudgeAdapter'),
      providerRegistryHash: prepared.providerRegistryHash,
    },
    preparedInvocation: prepared,
  });
  return cliContinuationResult({
    status: judge.status === 'audited_pass' ? 'final_render_pending' : 'audit_pending',
    issueCode: judge.status === 'audited_pass'
      ? 'requirements_final_render_pending'
      : 'requirements_audit_pending',
    authoringRequestId: requestId,
    authoringAttemptId,
    grillSessionId: options.grillSessionId,
    decisionReceiptRefs: options.decisionReceiptRefs,
  });
}

async function authorConfirmationReadySourceAction(context) {
  const allowed = new Set([
    'action',
    'cwd',
    'json',
    'intakeSource',
    'targetSource',
    'confirmationLanguage',
    'requestId',
    'authoringAttemptId',
    'grillSessionId',
    'legacyOrchestration',
  ]);
  const forbidden = Object.keys(context.args).filter((key) => !allowed.has(key));
  if (forbidden.length > 0) {
    return {
      status: 'authoring_blocked',
      exitCode: 2,
      errors: [
        {
          code: 'requirements_authoring_argument_forbidden',
          message: `Unsupported authoring arguments: ${forbidden.sort().join(',')}`,
        },
      ],
    };
  }
  try {
    const intakeSource = confinedPath(
      context.cwd,
      context.args.intakeSource,
      'requirements_authoring_intake_source_invalid'
    );
    const targetSource = confinedPath(
      context.cwd,
      context.args.targetSource,
      'requirements_authoring_target_source_invalid'
    );
    const confirmationLanguage = String(context.args.confirmationLanguage || '').trim();
    if (!confirmationLanguage) throw new Error('requirements_confirmation_language_missing');
    const authoritySources = readRequirementsContractDeclaredAuthoritySources(intakeSource);
    const scan = scanRequirementsContractConsumerAuthority({
      cwd: context.cwd,
      intakeSource,
      authoritySources,
    });
    if (scan.conflicts.length > 0) throw new Error('requirements_authority_conflict');
    const requestId =
      String(context.args.requestId || '').trim() ||
      stableId('REQ', {
        intakeSource: path.relative(context.cwd, intakeSource).replace(/\\/gu, '/'),
        intakeSourceHash: scan.sourceList.intakeSourceHash,
        targetSource: path.relative(context.cwd, targetSource).replace(/\\/gu, '/'),
      });
    if (!SAFE_ID.test(requestId)) throw new Error('requirements_authoring_request_id_invalid');
    const authoringAttemptId =
      String(context.args.authoringAttemptId || '').trim() ||
      stableId('ATTEMPT', { requestId, sourceListHash: scan.sourceList.sourceListHash });
    const unresolved = scan.sourceRootCandidates
      .filter((candidate) => candidate.rootClass === 'unresolved_decision')
      .sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId));
    const recordRoot = authoringRecordRoot(context.cwd, requestId);
    const stagingRoot = path.join(recordRoot, 'authoring', 'staging', authoringAttemptId);
    atomicNoClobberPublish({
      targetPath: path.join(stagingRoot, 'consumer-authority-source-list.json'),
      value: scan.sourceList,
      role: 'requirements_consumer_authority_source_list',
    });
    const authoringContext = publishAuthoringContext(recordRoot, {
      schemaVersion: 'requirements-authoring-continuation-context/v1',
      authoringRequestId: requestId,
      authoringAttemptId,
      confirmationLanguage,
      intakeSource: path.relative(context.cwd, intakeSource).replace(/\\/gu, '/'),
      targetSource: path.relative(context.cwd, targetSource).replace(/\\/gu, '/'),
      authoritySourceListHash: scan.sourceList.sourceListHash,
    });
    if (unresolved.length > 0) {
      const grillSessionId =
        String(context.args.grillSessionId || '').trim() ||
        stableId('GRILL', {
          requestId,
          authoringAttemptId,
          unresolved: unresolved.map((candidate) => ({
            sourceRootId: candidate.sourceRootId,
            bodyHash: sha256Stable(candidate.semanticBody),
          })),
        });
      if (!SAFE_ID.test(grillSessionId)) throw new Error('requirements_grill_session_id_invalid');
      const questions = unresolved.map((candidate) => {
        const body = candidate.semanticBody;
        const answerSchema =
          body.answerSchema && typeof body.answerSchema === 'object'
            ? body.answerSchema
            : { type: ['string', 'number', 'boolean', 'object', 'array'] };
        return {
          questionId: candidate.sourceRootId,
          questionVersion: String(body.questionVersion || 'v1'),
          question: String(body.question || '').normalize('NFC'),
          dependencies: Array.isArray(body.dependencies)
            ? [...new Set(body.dependencies.map(String))].sort()
            : [],
          affectedFieldIds: Array.isArray(body.affectedFieldIds)
            ? [...new Set(body.affectedFieldIds.map(String))].sort()
            : [candidate.sourceRootId],
          authorityPremiseHashes: [
            sha256Stable({
              sourcePath: candidate.sourcePath,
              sourceRootId: candidate.sourceRootId,
              semanticBody: candidate.semanticBody,
            }),
          ],
          answerSchema,
          answerSchemaHash: sha256Stable(answerSchema),
          affectedNodeIds: Array.isArray(body.affectedNodeIds)
            ? [...new Set(body.affectedNodeIds.map(String))].sort()
            : [candidate.sourceRootId],
          userInputProvenance: { authorityOrigin: 'requesting_user' },
        };
      });
      const questionGraph = createRequirementsGrillQuestionGraph({
        authoringRequestId: requestId,
        grillSessionId,
        questions: questions.map((question) => ({
          questionId: question.questionId,
          questionVersion: question.questionVersion,
          dependencies: question.dependencies,
          affectedFieldIds: question.affectedFieldIds,
          authorityPremiseHashes: question.authorityPremiseHashes,
          affectedNodeIds: question.affectedNodeIds,
        })),
        resolvedQuestionIds: [],
      });
      const session = {
        schemaVersion: 'requirements-grill-session-snapshot/v1',
        authoringRequestId: requestId,
        authoringAttemptId,
        grillSessionId,
        confirmationLanguage,
        intakeSource: authoringContext.intakeSource,
        targetSource: authoringContext.targetSource,
        authoritySourceListHash: authoringContext.authoritySourceListHash,
        questions,
        questionGraph,
        readyQuestionIds: questionGraph.readyFrontier,
      };
      const sessionPath = path.join(
        recordRoot,
        'authoring',
        'decisions',
        'sessions',
        grillSessionId,
        'session.json'
      );
      assertRequirementsGrillSessionPathConfinement({ recordRoot, targetPath: sessionPath });
      atomicNoClobberPublish({
        targetPath: sessionPath,
        value: session,
        role: 'requirements_grill_session_snapshot',
      });
      const payload = {
        schemaVersion: 'requirements-contract-cli-result/v1',
        status: 'business_decision_required',
        issueCode: 'requirements_business_decision_required',
        authoringRequestId: requestId,
        authoringAttemptId,
        grillSessionId,
        resumable: true,
        nextAction: 'submit-requirements-grill-response',
        decisionReceiptRefs: [],
        frontier: questionGraph.readyFrontier,
        forbiddenArtifacts: ['active_authority', 'confirmation', 'projection', 'target_source'],
      };
      return {
        ...payload,
        resultHash: sha256Stable({ domain: 'requirements-contract-cli-result/v1', payload }),
        exitCode: 0,
        errors: [],
      };
    }
    return await continueAuthoringFromContext(context, authoringContext);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'requirements_authoring_failed';
    return {
      status: 'authoring_blocked',
      exitCode: 2,
      errors: [{ code, message: code }],
    };
  }
}

async function resumeAuthorConfirmationReadySourceAction(context) {
  const allowed = new Set([
    'action',
    'cwd',
    'json',
    'requestId',
    'authoringAttemptId',
    'grillSessionId',
  ]);
  const forbidden = Object.keys(context.args).filter((key) => !allowed.has(key));
  if (forbidden.length > 0) {
    return {
      status: 'authoring_blocked',
      exitCode: 2,
      errors: [
        {
          code: 'requirements_authoring_argument_forbidden',
          message: `Unsupported resume arguments: ${forbidden.sort().join(',')}`,
        },
      ],
    };
  }
  const requestId = String(context.args.requestId || '').trim();
  const authoringAttemptId = String(context.args.authoringAttemptId || '').trim();
  const grillSessionId = String(context.args.grillSessionId || '').trim();
  const resumeIdentities = [authoringAttemptId, grillSessionId].filter(Boolean);
  if (
    !SAFE_ID.test(requestId) ||
    resumeIdentities.length !== 1 ||
    !resumeIdentities.every((identity) => SAFE_ID.test(identity))
  ) {
    return {
      status: 'authoring_blocked',
      exitCode: 2,
      errors: [
        {
          code: 'requirements_authoring_resume_identity_invalid',
          message: 'requestId and exactly one resume identity must be explicit safe identities.',
        },
      ],
    };
  }
  try {
    const recordRoot = path.resolve(
      context.cwd,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requestId
    );
    if (authoringAttemptId) {
      const currentContext = JSON.parse(
        fs.readFileSync(authoringContextPath(recordRoot, authoringAttemptId), 'utf8')
      );
      if (
        currentContext.schemaVersion !== 'requirements-authoring-continuation-context/v1' ||
        currentContext.authoringRequestId !== requestId ||
        currentContext.authoringAttemptId !== authoringAttemptId
      ) {
        throw new Error('requirements_authoring_context_identity_mismatch');
      }
      const intakeSource = confinedPath(
        context.cwd,
        currentContext.intakeSource,
        'requirements_authoring_intake_source_invalid'
      );
      const scan = scanRequirementsContractConsumerAuthority({
        cwd: context.cwd,
        intakeSource,
        authoritySources: readRequirementsContractDeclaredAuthoritySources(intakeSource),
      });
      if (scan.conflicts.length > 0) throw new Error('requirements_authority_conflict');
      if (scan.sourceList.sourceListHash === currentContext.authoritySourceListHash) {
        const pointerPath = path.join(
          recordRoot,
          ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/')
        );
        if (fs.existsSync(pointerPath)) {
          const currentPointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
          const currentManifest = JSON.parse(
            fs.readFileSync(
              path.join(recordRoot, ...currentPointer.attemptManifestPath.split('/')),
              'utf8'
            )
          );
          if (currentManifest.inputManifestHash !== scan.sourceList.sourceListHash) {
            throw new Error('requirements_source_binding_refresh_authority_mismatch');
          }
          const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
          const requirementRecord = fs.existsSync(requirementRecordPath)
            ? JSON.parse(fs.readFileSync(requirementRecordPath, 'utf8'))
            : null;
          const currentAuthority = requirementRecord?.activeAuthority;
          if (currentAuthority) {
            const currentBinding = JSON.parse(
              fs.readFileSync(
                path.join(recordRoot, ...currentAuthority.activeSourceBindingPath.split('/')),
                'utf8'
              )
            );
            const semanticIr = JSON.parse(
              fs.readFileSync(
                path.join(recordRoot, ...currentAuthority.activeSemanticIrPath.split('/')),
                'utf8'
              )
            );
            const nextBinding = canonicalBindingFromClosure({
              authoringRequestId: requestId,
              scan,
              semanticIr,
              parentBindingRevisionId: currentBinding.bindingRevisionId,
            });
            const nextSourceBinding = nextBinding.sourceBinding;
            const beforeLocatorHash = sourceBindingLocatorHash(currentBinding);
            const afterLocatorHash = sourceBindingLocatorHash(nextSourceBinding);
            const preflight = preflightRequirementsContractSourceBindingRefresh({
              semanticRevisionId: semanticIr.semanticRevisionId,
              scopeSemanticHash: semanticIr.scopeSemanticHash,
              beforeSemanticAuthority: {
                authoritySourceListHash: currentManifest.inputManifestHash,
              },
              afterSemanticAuthority: {
                authoritySourceListHash: scan.sourceList.sourceListHash,
              },
              beforeLocatorHash,
              afterLocatorHash,
            });
            if (preflight.decision !== 'refresh_binding') {
              return await continueAuthoringFromContext(context, currentContext);
            }
            const successorAttemptId = stableId('ATTEMPT', {
              requestId,
              sourceListHash: scan.sourceList.sourceListHash,
              locatorHash: afterLocatorHash,
            });
            publishAuthoringContext(recordRoot, {
              ...currentContext,
              authoringAttemptId: successorAttemptId,
            });
            atomicNoClobberPublish({
              targetPath: path.join(
                recordRoot,
                'authoring',
                'staging',
                successorAttemptId,
                'consumer-authority-source-list.json'
              ),
              value: scan.sourceList,
              role: 'requirements_consumer_authority_source_list',
            });
            const refreshed = publishRequirementsContractSourceBindingRefresh({
              recordRootPath: recordRoot,
              currentAttemptPointer: currentPointer,
              expectedCurrentPointerHash: activeAuthoringAttemptPointerHash(currentPointer),
              preflight,
              sourceBinding: nextSourceBinding,
              resolvedEvidenceIndex: nextBinding.resolvedEvidenceIndex,
              authoringRequestId: requestId,
              authoringAttemptId: successorAttemptId,
              inputManifestHash: scan.sourceList.sourceListHash,
              previousCheckpointManifestRef: currentManifest.previousCheckpointManifestRef,
              compilerIdentity: 'requirements-contract-source-binding-refresh/v1',
              decisionReceiptRefs: currentManifest.decisionReceiptRefs,
              baseAuthorityRef: currentManifest.baseAuthorityRef,
              compareAndSwapAttemptPointer: fileAttemptPointerCas(recordRoot),
              currentAuthority: {
                semanticIrPath: currentAuthority.activeSemanticIrPath,
                sourceBindingPath: currentAuthority.activeSourceBindingPath,
              },
              preserveCurrentAttemptPointer: true,
            });
            const buildManifest = JSON.parse(
              fs.readFileSync(
                path.join(recordRoot, ...currentAuthority.activeBuildManifestPath.split('/')),
                'utf8'
              )
            );
            const nextAuthority = {
              ...currentAuthority,
              activeBindingRevisionId: refreshed.bindingIdentity.bindingRevisionId,
              activeSourceBindingPath:
                `authoring/source-bindings/${refreshed.bindingIdentity.bindingRevisionId}/source-binding.json`,
              activeSourceBindingHash: refreshed.bindingIdentity.sourceBindingHash,
            };
            commitRequirementsContractAuthorityPublication({
              route: 'binding_refresh',
              current: currentAuthority,
              next: nextAuthority,
              recordRootPath: recordRoot,
              buildManifestTargetPath: path.join(
                recordRoot,
                ...currentAuthority.activeBuildManifestPath.split('/')
              ),
              buildManifest,
              compareAndSwapAuthorityTuple(current, next) {
                const latest = fs.existsSync(requirementRecordPath)
                  ? JSON.parse(fs.readFileSync(requirementRecordPath, 'utf8'))
                  : null;
                if (sha256Stable(latest?.activeAuthority ?? null) !== sha256Stable(current)) {
                  return false;
                }
                writeJsonAtomic(requirementRecordPath, {
                  ...latest,
                  activeAuthority: next,
                });
                return true;
              },
            });
            return cliContinuationResult({
              status: 'audit_pending',
              issueCode: 'requirements_audit_pending',
              authoringRequestId: requestId,
              authoringAttemptId: successorAttemptId,
            });
          }
        }
        return await continueAuthoringFromContext(context, currentContext);
      }
      const successorAttemptId = stableId('ATTEMPT', {
        requestId,
        sourceListHash: scan.sourceList.sourceListHash,
      });
      const successorContext = publishAuthoringContext(recordRoot, {
        ...currentContext,
        authoringAttemptId: successorAttemptId,
        authoritySourceListHash: scan.sourceList.sourceListHash,
      });
      return await continueAuthoringFromContext(context, successorContext);
    }
    const sessionPath = path.join(
      recordRoot,
      'authoring',
      'decisions',
      'sessions',
      grillSessionId,
      'session.json'
    );
    assertRequirementsGrillSessionPathConfinement({ recordRoot, targetPath: sessionPath });
    const resolution = resolveRequirementsGrillSessionSnapshot({
      recordRoot,
      authoringRequestId: requestId,
      grillSessionId,
      session: JSON.parse(fs.readFileSync(sessionPath, 'utf8')),
    });
    const frontier = resolution.questionGraph.readyFrontier;
    if (frontier.length === 0) {
      return await continueAuthoringFromContext(context, resolution.session, {
        grillSessionId,
        decisionReceiptRefs: resolution.decisionReceiptRefs,
      });
    }
    const payload = {
      schemaVersion: 'requirements-contract-cli-result/v1',
      status: 'business_decision_required',
      issueCode: 'requirements_business_decision_required',
      authoringRequestId: requestId,
      authoringAttemptId: resolution.session.authoringAttemptId,
      grillSessionId,
      resumable: true,
      nextAction: 'submit-requirements-grill-response',
      decisionReceiptRefs: resolution.decisionReceiptRefs,
      frontier,
      forbiddenArtifacts: ['active_authority', 'confirmation', 'projection', 'target_source'],
    };
    return {
      ...payload,
      resultHash: sha256Stable({ domain: 'requirements-contract-cli-result/v1', payload }),
      exitCode: 0,
      errors: [],
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'requirements_authoring_resume_failed';
    return {
      status: 'authoring_blocked',
      exitCode: 2,
      errors: [{ code, message: code }],
    };
  }
}

module.exports = {
  capturePackageOrchestration,
  emitPackageOrchestration,
  continueAuthoringFromContext,
  authorConfirmationReadySourceAction,
  resumeAuthorConfirmationReadySourceAction,
};
