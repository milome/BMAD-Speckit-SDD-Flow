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
  publishRequirementsContractCp05Cp08Stages,
} = require('../source-authority/scripts/requirements-contract-cp05-cp08');
const {
  ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
  activeAuthoringAttemptPointerHash,
  publishActiveAuthoringAttemptPointer,
} = require('../source-authority/scripts/requirements-contract-active-authoring-attempt-pointer');
const {
  createRequirementsContractCheckpointManifest,
} = require('../source-authority/scripts/requirements-contract-authoring-manifest');
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
    snapshotSetHash: sourceBinding.snapshotSetHash,
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

function continueAuthoringFromContext(context, authoringContext, options = {}) {
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
  const semanticIr = canonicalSemanticIrFromClosure({
    authoringRequestId: requestId,
    scan,
    cp02Candidate,
    capability,
  });
  const resolvedEvidenceIndex = resolvedEvidenceIndexForClosure({
    scan,
    semanticIr,
  });
  const cp04Stage = prepareRequirementsContractCp04FreezeStage({
    semanticIr,
    sourceBinding: sourceBindingPayload(scan),
    resolvedEvidenceIndex,
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
  publishRequirementsContractCp05Cp08Stages({
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
  return cliContinuationResult({
    status: 'audit_pending',
    issueCode: 'requirements_audit_pending',
    authoringRequestId: requestId,
    authoringAttemptId,
    grillSessionId: options.grillSessionId,
    decisionReceiptRefs: options.decisionReceiptRefs,
  });
}

function authorConfirmationReadySourceAction(context) {
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
    return continueAuthoringFromContext(context, authoringContext);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'requirements_authoring_failed';
    return {
      status: 'authoring_blocked',
      exitCode: 2,
      errors: [{ code, message: code }],
    };
  }
}

function resumeAuthorConfirmationReadySourceAction(context) {
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
          if (currentManifest.checkpointId === 'cp04') {
            const currentBindingEntry = currentManifest.artifactEntries.find(
              (entry) => entry.role === 'source_binding'
            );
            const currentSemanticEntry = currentManifest.artifactEntries.find(
              (entry) => entry.role === 'semantic_ir'
            );
            if (!currentBindingEntry || !currentSemanticEntry) {
              throw new Error('requirements_source_binding_refresh_current_authority_missing');
            }
            const currentBinding = JSON.parse(
              fs.readFileSync(
                path.join(recordRoot, ...currentBindingEntry.recordRelativePath.split('/')),
                'utf8'
              )
            );
            const semanticIr = JSON.parse(
              fs.readFileSync(
                path.join(recordRoot, ...currentSemanticEntry.recordRelativePath.split('/')),
                'utf8'
              )
            );
            const nextSourceBinding = sourceBindingPayload(scan);
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
              return continueAuthoringFromContext(context, currentContext);
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
            publishRequirementsContractSourceBindingRefresh({
              recordRootPath: recordRoot,
              currentAttemptPointer: currentPointer,
              expectedCurrentPointerHash: activeAuthoringAttemptPointerHash(currentPointer),
              preflight,
              sourceBinding: nextSourceBinding,
              resolvedEvidenceIndex: {
                schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
                claimRefs: scan.sourceRootCandidates
                  .filter((candidate) =>
                    ['functional_requirement', 'non_functional_requirement'].includes(
                      candidate.rootClass
                    )
                  )
                  .map((candidate) => candidate.sourceRootId)
                  .sort(),
                decisionReceiptRefs: currentManifest.decisionReceiptRefs,
              },
              authoringRequestId: requestId,
              authoringAttemptId: successorAttemptId,
              inputManifestHash: scan.sourceList.sourceListHash,
              previousCheckpointManifestRef: {
                checkpointId: 'cp03',
                checkpointOrdinal: 3,
                path: `authoring/staging/${successorAttemptId}/manifests/3-cp03.json`,
                hash: sha256Stable({
                  domain: 'requirements-contract-cp03-predecessor/v1',
                  activeManifestHash: currentManifest.checkpointManifestHash,
                  preflightHash: preflight.preflightHash,
                }),
              },
              compilerIdentity: 'requirements-contract-source-binding-refresh/v1',
              decisionReceiptRefs: currentManifest.decisionReceiptRefs,
              baseAuthorityRef: currentManifest.baseAuthorityRef,
              compareAndSwapAttemptPointer: fileAttemptPointerCas(recordRoot),
            });
            return cliContinuationResult({
              status: 'audit_pending',
              issueCode: 'requirements_audit_pending',
              authoringRequestId: requestId,
              authoringAttemptId: successorAttemptId,
            });
          }
        }
        return continueAuthoringFromContext(context, currentContext);
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
      return continueAuthoringFromContext(context, successorContext);
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
      return continueAuthoringFromContext(context, resolution.session, {
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
