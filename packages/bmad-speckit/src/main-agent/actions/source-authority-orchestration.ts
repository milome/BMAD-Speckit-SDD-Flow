const fs = require('node:fs');
const path = require('node:path');
const { resolvePackageOwnedBmadPath } = require('../runtime/package-bmad-root');
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
const { compileTypedSourceAtoms, createTypedRequirementsSemanticIr, createTypedRequirementsSourceBinding,
} = require('../source-authority/scripts/requirements-contract-typed-source-compiler');
const {
  prepareRequirementsContractCp02PipelineStage,
  prepareRequirementsContractCp04FreezeStage,
  publishRequirementsContractCp04FreezeStage,
} = require('../source-authority/scripts/requirements-contract-production-semantic-pipeline');
const {
  createRequirementsContractSemanticIr,
  resolveRequirementsContractSemanticIrAuthority,
} = require('../source-authority/scripts/requirements-contract-semantic-ir');
const {
  createRequirementsContractSourceBindingCapsule,
  createRequirementsContractResolvedEvidenceIndex,
} = require('../source-authority/scripts/requirements-contract-source-binding-capsule');
const {
  canonicalSourceSpanId,
} = require('../source-authority/scripts/requirements-contract-span-registry');
const {
  lintRequirementsContractProjectionStage,
  prepareRequirementsContractCp05Projection,
  prepareRequirementsContractCp06Projection,
  prepareRequirementsContractCp07Projection,
  prepareRequirementsContractCp08Projection,
  validateRequirementsContractPublicationReady,
} = require('../source-authority/scripts/requirements-contract-cp05-cp08');
const {
  createRequirementsContractBuildManifestV2,
} = require('../source-authority/scripts/requirements-contract-authoring-manifest');
const {
  publishRequirementsContentObject,
  readRequirementsContentObject,
} = require('../source-authority/scripts/requirements-contract-content-store');
const {
  deriveRequirementsContractActiveAuthority,
  publishRequirementsContractDurableBuild,
  readRequirementsActiveBuildManifest,
  resolveRequirementsActiveArtifact,
} = require('../source-authority/scripts/requirements-contract-durable-build-store');
const {
  resolveRequirementsAuthoringArtifact,
} = require('../source-authority/scripts/requirements-contract-artifact-resolver');
const {
  buildRequirementsContractJudgeAuditPacketV3,
  validateRequirementsContractJudgeAuditDraft,
} = require('../source-authority/scripts/requirements-contract-judge-audit-packet');
const {
  readVerifiedRequirementsContractJudgeDecision,
} = require('../source-authority/scripts/requirements-contract-judge-decision-store');
const {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} = require('../source-authority/scripts/requirements-contract-hash-domains');
const {
  runRequirementsSemanticCheckpointJsonUnit,
  runRequirementsSemanticCheckpointUnits,
  readRequirementsSemanticCheckpoint,
} = require('../source-authority/scripts/requirements-contract-semantic-checkpoint-store');
const {
  withoutRequirementsAuthoringOperationMetadata,
} = require('../source-authority/scripts/requirements-contract-projection-normalization');
const {
  inventoryRequirementsRecordStorage,
  reserveRequirementsRecordStorage,
} = require('../source-authority/scripts/requirements-contract-record-storage');
const { sourceBytesHash } = require('../source-authority/scripts/requirements-contract-hash-domains');
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
  evaluateRequirementsContractRemediationCandidate,
} = require('../source-authority/scripts/requirements-contract-remediation-preflight');
const {
  materializeRequirementsSemanticRepair,
} = require('../source-authority/scripts/requirements-contract-remediation-materializer');
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
const { preflightRequirementsContractSourceBindingRefresh } =
  require('../source-authority/scripts/requirements-contract-source-binding-preflight');
const {
  assertRequirementsGrillSessionPathConfinement,
  resolveRequirementsGrillSessionSnapshot,
} = require('../source-authority/scripts/requirements-contract-grill-session');
const {
  sha256Stable,
} = require('../source-authority/scripts/requirements-contract-semantic-resolver');
const {
  normalizeRequirementsContractSemanticIrAuthority,
} = require('../source-authority/scripts/requirements-contract-semantic-ir');
const {
  createRequirementsContractCoreArtifactFreeze,
} = require('../source-authority/scripts/requirements-contract-semantic-resolver');
const {
  renderAndPromoteRequirementsContractConfirmation,
  refreshRequirementsContractConfirmationBinding,
  stageRequirementsContractConfirmationBindingRefresh,
} = require('../source-authority/scripts/requirements-contract-confirmation-acceptance');
const {
  CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION,
  openRequirementsContractRecord,
} = require('../source-authority/scripts/requirements-contract-record-boundary');

function ensureCwd(argv, cwd) {
  if (argv.includes('--cwd') || argv.some((arg) => String(arg).startsWith('--cwd='))) return argv;
  return [...argv, '--cwd', cwd];
}

function packageOrchestrationModule() {
  return require(path.join('..', 'source-authority', 'scripts', 'main-agent-orchestration.js'));
}

async function capturePackageOrchestration(argv, cwd) {
  const orchestration = packageOrchestrationModule();
  const forwardedArgv = ensureCwd(argv, cwd);
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

function sourceBindingLocatorHash(sourceBinding) {
  return sha256Stable({
    snapshotSetHash: sourceBinding.snapshotSetHash ?? sha256Stable(sourceBinding.sourceArtifacts),
    sourceSpanRegistryHash: sourceBinding.sourceSpanRegistryHash,
  });
}

function atomicMustsFromScan(scan) {
  if (scan.typedSourceAuthority) {
    return compileTypedSourceAtoms(scan);
  }
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

function confirmedDecisionsFromGrillResolution(resolution, atoms, scan) {
  if (!resolution) return [];
  const atomById = new Map(atoms.map((atom) => [atom.atomId, atom]));
  const atomIdsByAuthorityRef = new Map();
  for (const atom of atoms) {
    for (const authorityRef of atom.authorityRefs) {
      const refs = atomIdsByAuthorityRef.get(authorityRef) ?? [];
      refs.push(atom.atomId);
      atomIdsByAuthorityRef.set(authorityRef, refs);
    }
  }
  return [...resolution.receiptByQuestionId.values()]
    .map((receipt) => {
      const question = resolution.questionById.get(receipt.questionId);
      if (!question) throw new Error('requirements_grill_receipt_question_unknown');
      const affectedAtomIds = new Set();
      for (const affectedNodeId of receipt.affectedNodeIds) {
        if (atomById.has(affectedNodeId)) affectedAtomIds.add(affectedNodeId);
        for (const atomId of atomIdsByAuthorityRef.get(affectedNodeId) ?? []) {
          affectedAtomIds.add(atomId);
        }
      }
      const sourceIds = scan?.typedSourceAuthority ? new Set(scan.sourceRootCandidates.map((entry) => entry.sourceRootId)) : null;
      const affectedSourceRefs = sourceIds ? [...new Set(receipt.affectedNodeIds.flatMap((id) =>
        sourceIds.has(id) ? [id] : atomById.get(id)?.authorityRefs ?? []))].sort() : null;
      if (sourceIds && (affectedSourceRefs.length === 0 || receipt.affectedNodeIds.some((id) =>
        !sourceIds.has(id) && !atomById.has(id)))) throw new Error('requirements_decision_affected_source_unknown');
      if (affectedAtomIds.size === 0 && !sourceIds) {
        throw new Error('requirements_decision_affected_node_unknown');
      }
      const sortedAffectedAtomIds = [...affectedAtomIds].sort();
      const affectedRequirementIds = [
        ...new Set(sortedAffectedAtomIds.flatMap((atomId) => atomById.get(atomId).authorityRefs)),
      ].sort();
      return {
        id: receipt.decisionReceiptId,
        decisionReceiptRef: receipt.decisionReceiptId,
        questionId: receipt.questionId,
        questionVersion: receipt.questionVersion,
        question: question.question,
        affectedFieldIds: receipt.affectedFieldIds,
        affectedNodeIds: receipt.affectedNodeIds,
        affectedAtomIds: sortedAffectedAtomIds,
        ...(affectedSourceRefs ? { affectedSourceRefs } : {}),
        affectedRequirementIds,
        authorityPremiseHashes: receipt.authorityPremiseHashes,
        answerValue: structuredClone(receipt.answerValue),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function canonicalSemanticIrFromClosure(input) {
  if (input.scan.typedSourceAuthority) return createTypedRequirementsSemanticIr(input);
  const requirements = input.scan.sourceRootCandidates
    .filter((candidate) =>
      ['functional_requirement', 'non_functional_requirement', 'negative_requirement'].includes(
        candidate.rootClass
      )
    )
    .map((candidate) => ({
      id: candidate.sourceRootId,
      text: String(candidate.semanticBody.text || '').normalize('NFC'),
      oracle: String(
        candidate.semanticBody.oracle ||
          candidate.semanticBody.negativeAssertion ||
          candidate.semanticBody.blockingCondition ||
          ''
      ).normalize('NFC'),
      requirementKind:
        candidate.rootClass === 'functional_requirement'
          ? 'functional'
          : candidate.rootClass === 'non_functional_requirement'
            ? 'nonfunctional'
            : 'negative',
      polarity: candidate.rootClass === 'negative_requirement' ? 'negative' : 'positive',
      ...(candidate.rootClass === 'negative_requirement'
        ? {
            negativeAssertion: String(candidate.semanticBody.negativeAssertion || '').normalize(
              'NFC'
            ),
            blockingCondition: String(candidate.semanticBody.blockingCondition || '').normalize(
              'NFC'
            ),
          }
        : {}),
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
  const decisions = input.confirmedDecisions;
  const sourceEvidenceClaims = requirements.map((requirement) => ({
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
  const decisionEvidenceClaims = decisions.map((decision) => ({
    evidenceClaimId: `EVIDENCE-CLAIM-${decision.id}`,
    authorityClass: 'human_confirmed',
    normalizedClaimHash: sha256Stable({
      questionId: decision.questionId,
      questionVersion: decision.questionVersion,
      question: decision.question,
      affectedFieldIds: decision.affectedFieldIds,
      affectedNodeIds: decision.affectedNodeIds,
      answerValue: decision.answerValue,
    }),
    decisionReceiptRefs: [decision.decisionReceiptRef],
    premiseRefs: [],
    derivationReceiptRefs: [],
  }));
  const sourceSpecSpans = requirements.map((requirement) => ({
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
  const decisionSpecSpans = decisions.map((decision, index) => ({
    authorityClass: 'human_confirmed',
    normalizedClaimHash: decisionEvidenceClaims[index].normalizedClaimHash,
    boundSemanticNodeIds: [
      decision.id,
      ...decision.affectedRequirementIds,
      ...decision.affectedAtomIds,
    ],
    boundObligationIds: decision.affectedRequirementIds,
    evidenceClaimRefs: [decisionEvidenceClaims[index].evidenceClaimId],
    decisionReceiptRefs: [decision.decisionReceiptRef],
    derivationReceiptRefs: [],
  }));
  return createRequirementsContractSemanticIr({
    recordId: input.authoringRequestId,
    requestId: input.authoringRequestId,
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-cp02-compiler/v1',
    semantics: { requirements, atoms, decisions },
    evidenceClaims: [...sourceEvidenceClaims, ...decisionEvidenceClaims],
    specSpanRegistry: [...sourceSpecSpans, ...decisionSpecSpans],
    executionConstraints: constraints,
    semanticProvenance: Object.fromEntries([
      ...requirements.map((requirement) => [requirement.id, requirement.id]),
      ...decisions.map((decision) => [decision.id, decision.decisionReceiptRef]),
    ]),
  });
}

function canonicalBindingFromClosure(input) {
  if (input.scan.typedSourceAuthority) return createTypedRequirementsSourceBinding(input);
  const candidateById = new Map(
    input.scan.sourceRootCandidates.map((candidate) => [candidate.sourceRootId, candidate])
  );
  const sourceArtifacts = [];
  const sourceSpans = [];
  const evidenceClaimBindings = [];
  for (const claim of input.semanticIr.semanticPayload.evidenceClaims) {
    const requirementId = claim.evidenceClaimId.replace(/^EVIDENCE-CLAIM-/u, '');
    const candidate = candidateById.get(requirementId);
    const specSpan = input.semanticIr.semanticPayload.specSpanRegistry.find((span) =>
      span.evidenceClaimRefs.includes(claim.evidenceClaimId)
    );
    if (!specSpan) throw new Error('requirements_source_binding_spec_span_missing');
    if (claim.authorityClass !== 'source_grounded') {
      evidenceClaimBindings.push({
        evidenceClaimId: claim.evidenceClaimId,
        specSpanId: specSpan.specSpanId,
        authorityClass: claim.authorityClass,
        sourceSpanRefs: [],
      });
      continue;
    }
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
      exactTextHash: sha256Stable({
        domain: 'requirements-source-exact-text/v1',
        content: candidate.sourceContent,
      }),
      normalizedTextHash: sha256Stable({
        domain: 'requirements-source-normalized-text/v1',
        content: normalizedContent,
      }),
      structuralAnchor: candidate.sourceRootId,
    };
    const sourceSpanId = canonicalSourceSpanId(sourceSpan);
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
  for (const candidate of [...(input.scan.architecturePremiseAuthorityCandidates ?? [])].sort(
    (left, right) =>
      left.authorityRole.localeCompare(right.authorityRole) ||
      left.authorityId.localeCompare(right.authorityId)
  )) {
    sourceArtifacts.push({
      sourceArtifactId: candidate.authorityId,
      role: candidate.authorityRole,
      mediaType: 'application/json',
      sourceSnapshotHash: sha256Stable({
        domain: 'requirements-source-snapshot/v1',
        content: candidate.sourceContent,
      }),
      orderedPosition: sourceArtifacts.length,
      immutableBlobRef: candidate.sourcePath,
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

function cliContinuationResult(input) {
  const payload = {
    schemaVersion: 'requirements-contract-cli-result/v1',
    status: input.status,
    issueCode: input.issueCode,
    authoringRequestId: input.authoringRequestId,
    requestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    grillSessionId: input.grillSessionId ?? null,
    resumable: input.status !== 'user_confirmable',
    nextAction:
      input.status === 'user_confirmable'
        ? 'confirm-scope'
        : 'resume-author-confirmation-ready-source',
    decisionReceiptRefs: input.decisionReceiptRefs ?? [],
    frontier: [],
    forbiddenArtifacts: ['active_authority', 'confirmation', 'projection', 'target_source'],
    ...(Number.isSafeInteger(input.unresolvedDecisionCount)
      ? { unresolvedDecisionCount: input.unresolvedDecisionCount }
      : {}),
    ...(input.confirmation ? { confirmation: input.confirmation } : {}),
  };
  return {
    ...payload,
    resultHash: sha256Stable({ domain: 'requirements-contract-cli-result/v1', payload }),
    exitCode: 0,
    errors: [],
  };
}

function continueRequirementsFinalRender(context, input) {
  try {
    const rendered = renderAndPromoteRequirementsContractConfirmation({
      projectRoot: context.cwd,
      requestId: input.authoringRequestId,
      targetSource: input.targetSource,
    });
    return cliContinuationResult({
      status: rendered.status,
      issueCode: 'requirements_user_confirmable',
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      grillSessionId: input.grillSessionId,
      decisionReceiptRefs: input.decisionReceiptRefs,
      unresolvedDecisionCount: rendered.unresolvedDecisionCount,
      confirmation: rendered.confirmation,
    });
  } catch (error) {
    const recordRoot = authoringRecordRoot(context.cwd, input.authoringRequestId);
    const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
    if (fs.existsSync(recordPath)) {
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
      writeJsonAtomic(recordPath, {
        ...record,
        lifecycle: 'final_render_pending',
        finalRenderIssueCode:
          error instanceof Error ? error.message : 'requirements_final_render_failure',
      });
    }
    return cliContinuationResult({
      status: 'final_render_pending',
      issueCode: 'requirements_final_render_pending',
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      grillSessionId: input.grillSessionId,
      decisionReceiptRefs: input.decisionReceiptRefs,
    });
  }
}

async function continuePublishedRequirementsAudit(context, input) {
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
        input.recordRoot,
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
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      grillSessionId: input.grillSessionId,
      decisionReceiptRefs: input.decisionReceiptRefs,
      targetSource: input.targetSource,
    });
  }
  const configuredPrompt = loadConfiguredRequirementsContractJudgePrompt({
    projectRoot: context.cwd,
    promptConfig: prepared.judgeRuntime.promptConfig,
  });
  const auditPacketBody = input.auditPacket.body || {};
  const judge = await runRequirementsContractProductionJudgePipeline({
    authoringRequestId: input.authoringRequestId,
    recordRoot: input.recordRoot,
    activeAuthority: input.activeAuthority,
    buildManifest: input.buildManifest,
    auditPacket: input.auditPacket,
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
      adapterRef:
        prepared.provider.adapterRef ||
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
  if (judge.status === 'audited_pass') {
    return continueRequirementsFinalRender(context, {
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      grillSessionId: input.grillSessionId,
      decisionReceiptRefs: input.decisionReceiptRefs,
      targetSource: input.targetSource,
    });
  }
  return cliContinuationResult({
    status: 'audit_pending',
    issueCode: 'requirements_audit_pending',
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    grillSessionId: input.grillSessionId,
    decisionReceiptRefs: input.decisionReceiptRefs,
  });
}

function readRecordJson(recordRoot, recordRelativePath) {
  const absolute = path.resolve(recordRoot, ...String(recordRelativePath || '').split('/'));
  const relative = path.relative(recordRoot, absolute);
  if (!recordRelativePath || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_authoring_record_path_escape');
  }
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function publishContentAddressedAuthoringBuild(input) {
  const authorityEntries = input.contentAddressedArtifactEntries ? [] : [
    {
      role: 'semantic_ir',
      schemaVersion: input.semanticIr.schemaVersion,
      recordRelativePath: `authoring/semantic-revisions/${input.semanticIr.semanticRevisionId}/semantic-ir.json`,
    },
    {
      role: 'source_binding',
      schemaVersion: input.sourceBinding.schemaVersion,
      recordRelativePath: `authoring/source-bindings/${input.sourceBinding.bindingRevisionId}/source-binding.json`,
    },
    {
      role: 'resolved_evidence_index',
      schemaVersion: input.resolvedEvidenceIndex.schemaVersion,
      recordRelativePath: `authoring/source-bindings/${input.sourceBinding.bindingRevisionId}/resolved-evidence-index.json`,
    },
  ];
  const sourceEntries = [...authorityEntries, ...(input.artifactEntries ?? [])]
    .filter((entry) => entry.role !== 'lint_report' && entry.role !== 'judge_audit_packet');
  const artifactEntries = input.contentAddressedArtifactEntries
    ? input.contentAddressedArtifactEntries.map(({ artifactId: _artifactId, ...entry }) => entry)
    : sourceEntries.map((entry) => {
    const absolute = path.join(input.recordRoot, ...entry.recordRelativePath.split('/'));
    let bytes = fs.readFileSync(absolute);
    const mediaType = entry.recordRelativePath.endsWith('.md') ? 'text/markdown' : 'application/json';
    const value = mediaType === 'application/json'
      ? withoutRequirementsAuthoringOperationMetadata(JSON.parse(bytes.toString('utf8')))
      : bytes.toString('utf8');
    if (mediaType === 'application/json') bytes = Buffer.from(canonicalRequirementsJson(value), 'utf8');
    const schemaVersion = mediaType === 'text/markdown' ? 'markdown/v1' : entry.schemaVersion;
    const contentRef = publishRequirementsContentObject({
      recordRoot: input.recordRoot,
      role: entry.role,
      mediaType,
      bytes,
    });
    const manifestEntry = {
      role: entry.role,
      schemaVersion,
      semanticHash: requirementsContractDomainHash(`requirements-projection:${entry.role}/v1`, value),
      contentRef,
    };
    resolveRequirementsAuthoringArtifact({ recordRoot: input.recordRoot, entry: manifestEntry });
    return manifestEntry;
  });
  if (!input.contentAddressedArtifactEntries) {
    const semanticEntry = artifactEntries.find((entry) => entry.role === 'semantic_ir');
    const stagedAuditPacketEntry = input.artifactEntries.find((entry) => entry.role === 'judge_audit_packet');
    if (!semanticEntry || !stagedAuditPacketEntry) throw new Error('requirements_judge_audit_packet_missing');
    const stagedAuditPacket = readRecordJson(input.recordRoot, stagedAuditPacketEntry.recordRelativePath);
    const resolvedAuditPacket = validateRequirementsContractJudgeAuditDraft(stagedAuditPacket);
    const resolvedAuditBody = resolvedAuditPacket && typeof resolvedAuditPacket.body === 'object'
      ? resolvedAuditPacket.body : {};
    const normalizedAuditPacket = {
      schemaVersion: 'requirements-contract-judge-audit-draft/v1',
      semanticRevisionId: resolvedAuditPacket.semanticRevisionId,
      scopeSemanticHash: resolvedAuditPacket.scopeSemanticHash,
      body: withoutRequirementsAuthoringOperationMetadata(resolvedAuditBody),
    };
    const auditedArtifactIds = Array.isArray(resolvedAuditBody.artifactIds)
      ? resolvedAuditBody.artifactIds : [];
    const auditArtifactEntries = auditedArtifactIds.map((artifactId) => {
      const stagedEntry = input.artifactEntries.find((entry) => entry.artifactId === artifactId);
      if (!stagedEntry) throw new Error('requirements_judge_audit_packet_coverage_gap');
      const manifestEntry = artifactEntries.find((entry) => entry.role === stagedEntry.role);
      if (!manifestEntry) throw new Error('requirements_judge_audit_packet_coverage_gap');
      return { artifactId, ...manifestEntry };
    });
    const auditPacketDescriptor = buildRequirementsContractJudgeAuditPacketV3({
      recordRoot: input.recordRoot,
      packet: normalizedAuditPacket,
      semanticIr: withoutRequirementsAuthoringOperationMetadata(input.semanticIr),
      semanticIrRef: semanticEntry.contentRef,
      artifactEntries: auditArtifactEntries,
    });
    const auditPacketManifestEntry = contentAddressedArtifactEntry({
      recordRoot: input.recordRoot,
      role: 'judge_audit_packet',
      schemaVersion: auditPacketDescriptor.schemaVersion,
      mediaType: 'application/json',
      value: auditPacketDescriptor,
    });
    resolveRequirementsAuthoringArtifact({ recordRoot: input.recordRoot, entry: auditPacketManifestEntry });
    artifactEntries.push(auditPacketManifestEntry);
  }
  for (const entry of artifactEntries) {
    resolveRequirementsAuthoringArtifact({ recordRoot: input.recordRoot, entry });
  }
  const projectionSetHash = requirementsContractDomainHash(
    'requirements-projection-set/v2',
    artifactEntries.map((entry) => ({
      role: entry.role,
      schemaVersion: entry.schemaVersion,
      semanticHash: entry.semanticHash,
      contentHash: entry.contentRef.contentHash,
    }))
  );
  const cp08Roles = new Set([
    'projection_reconciliation_report', 'authority_resolution_report',
    'renderability_probe_report', 'judge_audit_packet', 'judge_audit_packet_coverage',
  ]);
  const cp08Entries = artifactEntries
    .filter((entry) => cp08Roles.has(entry.role))
    .sort((left, right) => left.role.localeCompare(right.role, 'en'));
  if (!input.contentAddressedArtifactEntries) {
    runRequirementsSemanticCheckpointUnits({
      recordRoot: input.recordRoot,
      operationId: input.operationId,
      checkpointId: 'cp08',
      semanticInputHash: input.semanticInputHash,
      planHash: requirementsContractDomainHash('requirements-checkpoint-plan/cp08/v1', {
        compiler: 'requirements-contract-cp08-reconciliation-renderability/v1',
        unitIds: cp08Entries.map((entry) => `cp08:${entry.role}`),
      }),
      validatorVersion: 'requirements-contract-authoring-validator/v2',
      units: cp08Entries.map((entry) => ({
        unitId: `cp08:${entry.role}`,
        unitInputHash: entry.semanticHash,
        compilerVersion: 'requirements-contract-cp08-reconciliation-renderability/v1',
        execute: () => [entry.contentRef],
      })),
    });
  }
  const checkpointIds = Array.from({ length: 9 }, (_, ordinal) =>
    `cp${String(ordinal).padStart(2, '0')}`
  );
  const terminalStateHashes = checkpointIds.map((checkpointId) => {
    const checkpoint = readRequirementsSemanticCheckpoint({
      recordRoot: input.recordRoot,
      operationId: input.operationId,
      checkpointId,
    });
    if (checkpoint.semanticInputHash !== input.semanticInputHash || checkpoint.decision !== 'passed') {
      throw new Error('requirements_checkpoint_state_invalid');
    }
    return checkpoint.stateHash;
  });
  const manifest = createRequirementsContractBuildManifestV2({
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    sourceBindingHash: input.sourceBinding.sourceBindingHash,
    compilerIdentity: 'requirements-contract-authoring-compiler/v2',
    projectionSetHash,
    checkpointSummary: { checkpointIds, terminalStateHashes },
    validationSummary: { decision: 'pass', checkIds: checkpointIds },
    artifactEntries,
  });
  if (input.contentAddressedArtifactEntries) {
    const gate = require(resolvePackageOwnedBmadPath(
      'skills', 'requirements-contract-authoring', 'scripts', 'pre_render_must_decomposition_gate.js'
    ));
    const prepublication = gate.validatePrepublicationAttempt({
      sourcePath: input.sourcePath ?? '',
      recordRoot: input.recordRoot,
      buildManifestV2: manifest,
    });
    if (prepublication.exitCode !== 0) {
      throw new Error(prepublication.report.failedChecks[0] || 'requirements_prepublication_blocked');
    }
  }
  const currentAuthorityForCas = input.currentAuthority ?? null;
  const currentAuthority = input.currentAuthority?.activeBuildHash ? input.currentAuthority : null;
  const nextAuthority = deriveRequirementsContractActiveAuthority({
    manifest,
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    bindingRevisionId: input.sourceBinding.bindingRevisionId,
    authoringAttemptId: input.operationId,
    currentAuthority,
  });
  publishRequirementsContractDurableBuild({
    recordRoot: input.recordRoot,
    operationId: input.operationId,
    manifest,
    nextAuthority,
    currentAuthority: currentAuthorityForCas,
    expectedActiveAuthorityHash: currentAuthorityForCas
      ? requirementsContractDomainHash('requirements-active-authority-cas/v1', currentAuthorityForCas)
      : `sha256:${'0'.repeat(64)}`,
    compareAndSwapAuthorityTuple(current, next) {
      const latest = fs.existsSync(input.requirementRecordPath)
        ? openRequirementsContractRecord(input.requirementRecordPath)
        : null;
      if (sha256Stable(latest?.activeAuthority ?? null) !== sha256Stable(current)) return false;
      writeJsonAtomic(input.requirementRecordPath, {
        ...(latest ?? {
          schemaVersion: CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION,
          recordId: input.requestId,
          confirmedScopeSemanticHash: null,
        }),
        lifecycle: 'audit_pending',
        activeOperationId: input.operationId,
        activeAuthority: next,
      });
      return true;
    },
  });
  return { manifest, activeAuthority: nextAuthority };
}

function contentAddressedArtifactEntry(input) {
  const value = input.mediaType === 'application/json'
    ? withoutRequirementsAuthoringOperationMetadata(input.value)
    : String(input.value);
  const contentRef = publishRequirementsContentObject({
    recordRoot: input.recordRoot,
    role: input.role,
    mediaType: input.mediaType,
    ...(input.reservation ? { reservation: input.reservation } : {}),
    bytes: Buffer.from(
      input.mediaType === 'application/json' ? canonicalRequirementsJson(value) : value,
      'utf8'
    ),
  });
  return {
    role: input.role,
    schemaVersion: input.mediaType === 'application/json'
      ? String(value.schemaVersion || input.schemaVersion)
      : input.schemaVersion,
    semanticHash: requirementsContractDomainHash(`requirements-projection:${input.role}/v1`, value),
    contentRef,
  };
}

function readContentAddressedValue(recordRoot, entry) {
  const bytes = readRequirementsContentObject({ recordRoot, ref: entry.contentRef });
  return entry.contentRef.mediaType === 'application/json'
    ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function runContentAddressedProjectionStage(input) {
  let computed = null;
  const checkpoint = runRequirementsSemanticCheckpointUnits({
    recordRoot: input.recordRoot,
    operationId: input.operationId,
    checkpointId: input.checkpointId,
    semanticInputHash: input.semanticInputHash,
    planHash: requirementsContractDomainHash(
      `requirements-checkpoint-plan/${input.checkpointId}/v2`,
      { compiler: input.compilerVersion, artifactIds: input.artifacts.map((artifact) => artifact.artifactId) }
    ),
    validatorVersion: 'requirements-contract-authoring-validator/v2',
    units: [{
      unitId: `${input.checkpointId}:stage`,
      unitInputHash: input.unitInputHash,
      compilerVersion: input.compilerVersion,
      execute: () => {
        computed = input.compute();
        const plannedBytes = input.artifacts.map((artifact) => {
          const value = artifact.mediaType === 'application/json'
            ? withoutRequirementsAuthoringOperationMetadata(computed[artifact.key])
            : String(computed[artifact.key]);
          const bytes = Buffer.from(
            artifact.mediaType === 'application/json' ? canonicalRequirementsJson(value) : value,
            'utf8'
          );
          return { bytes, hash: sourceBytesHash(bytes) };
        });
        const inventory = inventoryRequirementsRecordStorage(input.recordRoot);
        const uniqueBytes = plannedBytes
          .filter(({ hash }) => !fs.existsSync(path.join(
            input.recordRoot, 'authoring', 'objects', 'sha256', hash.slice(7, 9), hash.slice(9)
          )))
          .reduce((total, item) => total + item.bytes.length, 0);
        const reservation = reserveRequirementsRecordStorage({
          recordRoot: input.recordRoot,
          operationId: input.operationId,
          expectedInventoryHash: inventory.inventoryHash,
          requestedUniqueBytes: uniqueBytes,
          requestedMetadataBytes: 0,
        });
        return input.artifacts.map((artifact) => contentAddressedArtifactEntry({
          recordRoot: input.recordRoot,
          ...artifact,
          reservation,
          value: computed[artifact.key],
        }).contentRef);
      },
    }],
  });
  const refs = checkpoint.state.completedUnits[0]?.outputRefs ?? [];
  if (refs.length !== input.artifacts.length) throw new Error('requirements_checkpoint_unit_output_missing');
  const artifactEntries = input.artifacts.map((artifact, index) => {
    const contentRef = refs[index];
    const bytes = readRequirementsContentObject({ recordRoot: input.recordRoot, ref: contentRef });
    const value = artifact.mediaType === 'application/json'
      ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return {
      artifactId: artifact.artifactId,
      value,
      entry: {
        role: artifact.role,
        schemaVersion: artifact.mediaType === 'application/json'
          ? String(value.schemaVersion || artifact.schemaVersion)
          : artifact.schemaVersion,
        semanticHash: requirementsContractDomainHash(
          `requirements-projection:${artifact.role}/v1`, value
        ),
        contentRef,
      },
    };
  });
  return {
    state: checkpoint.state,
    values: Object.fromEntries(artifactEntries.map((artifact) => [artifact.artifactId, artifact.value])),
    artifactEntries: artifactEntries.map(({ artifactId, entry }) => ({ artifactId, ...entry })),
  };
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
    .sort(
      (left, right) =>
        left.role.localeCompare(right.role, 'en') ||
        left.artifactId.localeCompare(right.artifactId, 'en')
    );
}

function remediationRepairSteps(plan) {
  return requirementsContractAutomaticRepairSteps(plan);
}

function prepareContentAddressedProjectionSuccessor(input) {
  const currentManifest = readRequirementsActiveBuildManifest({
    recordRoot: input.recordRoot,
    activeAuthority: input.currentAuthority,
  });
  const currentEntries = currentManifest.artifactEntries;
  const currentEntry = (role) => {
    const matches = currentEntries.filter((entry) => entry.role === role);
    if (matches.length !== 1) throw new Error(`requirements_active_artifact_${role}_invalid`);
    return matches[0];
  };
  const semanticIr = input.semanticIr ?? resolveRequirementsActiveArtifact({
    recordRoot: input.recordRoot,
    activeAuthority: input.currentAuthority,
    role: 'semantic_ir',
  }).value;
  const sourceBinding = input.sourceBinding ?? resolveRequirementsActiveArtifact({
    recordRoot: input.recordRoot,
    activeAuthority: input.currentAuthority,
    role: 'source_binding',
  }).value;
  const resolvedEvidenceIndex = input.resolvedEvidenceIndex ?? resolveRequirementsActiveArtifact({
    recordRoot: input.recordRoot,
    activeAuthority: input.currentAuthority,
    role: 'resolved_evidence_index',
  }).value;
  const cp04Entries = [
    input.semanticIr
      ? contentAddressedArtifactEntry({
          recordRoot: input.recordRoot,
          role: 'semantic_ir',
          schemaVersion: semanticIr.schemaVersion,
          mediaType: 'application/json',
          value: semanticIr,
        })
      : currentEntry('semantic_ir'),
    input.sourceBinding
      ? contentAddressedArtifactEntry({
          recordRoot: input.recordRoot,
          role: 'source_binding',
          schemaVersion: sourceBinding.schemaVersion,
          mediaType: 'application/json',
          value: sourceBinding,
        })
      : currentEntry('source_binding'),
    input.resolvedEvidenceIndex
      ? contentAddressedArtifactEntry({
          recordRoot: input.recordRoot,
          role: 'resolved_evidence_index',
          schemaVersion: resolvedEvidenceIndex.schemaVersion,
          mediaType: 'application/json',
          value: resolvedEvidenceIndex,
        })
      : currentEntry('resolved_evidence_index'),
  ];
  const stableCoreEntries = currentEntries.filter((entry) =>
    ['semantic_kernel', 'decision_graph', 'must_decomposition_packet', 'id_registry'].includes(entry.role)
  );
  const reusableEntries = stableCoreEntries.length > 0 ? stableCoreEntries : cp04Entries;
  for (const checkpointId of ['cp00', 'cp01', 'cp02', 'cp03', 'cp04']) {
    const entries = checkpointId === 'cp04' ? cp04Entries : reusableEntries;
    runRequirementsSemanticCheckpointUnits({
      recordRoot: input.recordRoot,
      operationId: input.operationId,
      checkpointId,
      semanticInputHash: input.semanticInputHash,
      planHash: requirementsContractDomainHash(
        `requirements-checkpoint-plan/${checkpointId}/successor-v1`,
        {
          currentBuildHash: input.currentAuthority.activeBuildHash,
          roles: entries.map((entry) => entry.role).sort(),
        }
      ),
      validatorVersion: 'requirements-contract-authoring-validator/v2',
      units: [{
        unitId: `${checkpointId}:successor-inputs`,
        unitInputHash: requirementsContractDomainHash(
          `requirements-checkpoint-unit/${checkpointId}/successor-v1`,
          entries.map((entry) => entry.semanticHash).sort()
        ),
        compilerVersion: 'requirements-contract-content-addressed-successor/v1',
        execute: () => entries.map((entry) => entry.contentRef),
      }],
    });
  }
  const cp05Result = runContentAddressedProjectionStage({
    recordRoot: input.recordRoot,
    operationId: input.operationId,
    checkpointId: 'cp05',
    semanticInputHash: input.semanticInputHash,
    unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp05/v2', {
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      sourceBindingHash: sourceBinding.sourceBindingHash,
    }),
    compilerVersion: 'requirements-contract-cp05-source-confirmation-projection/v2',
    artifacts: [
      { artifactId: 'confirmation-projection', key: 'cp05Projection', role: 'confirmation_projection', schemaVersion: 'requirements-contract-confirmation-projection/v2', mediaType: 'application/json' },
      { artifactId: 'final-markdown', key: 'markdown', role: 'final_markdown', schemaVersion: 'markdown/v1', mediaType: 'text/markdown' },
    ],
    compute: () => prepareRequirementsContractCp05Projection({ semanticIr, resolvedEvidenceIndex }),
  });
  const cp06Result = runContentAddressedProjectionStage({
    recordRoot: input.recordRoot,
    operationId: input.operationId,
    checkpointId: 'cp06',
    semanticInputHash: input.semanticInputHash,
    unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp06/v2', {
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      sourceBindingHash: sourceBinding.sourceBindingHash,
    }),
    compilerVersion: 'requirements-contract-cp06-execution-projection/v2',
    artifacts: [
      { artifactId: 'execution-manifest', key: 'executionManifest', role: 'execution_manifest', schemaVersion: 'requirements-contract-execution-manifest/v2', mediaType: 'application/json' },
      { artifactId: 'per-must-bundle', key: 'perMustBundle', role: 'per_must_bundle', schemaVersion: 'requirements-contract-per-must-bundle/v1', mediaType: 'application/json' },
      { artifactId: 'trace-matrix', key: 'traceMatrix', role: 'trace_matrix', schemaVersion: 'requirements-contract-trace-matrix/v1', mediaType: 'application/json' },
    ],
    compute: () => {
      const projection = prepareRequirementsContractCp06Projection({ semanticIr, resolvedEvidenceIndex });
      return {
        executionManifest: projection.cp06Execution.executionManifest,
        perMustBundle: projection.perMustBundle,
        traceMatrix: projection.traceMatrix,
      };
    },
  });
  const cp07Result = runContentAddressedProjectionStage({
    recordRoot: input.recordRoot,
    operationId: input.operationId,
    checkpointId: 'cp07',
    semanticInputHash: input.semanticInputHash,
    unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp07/v2', {
      scopeSemanticHash: semanticIr.scopeSemanticHash,
    }),
    compilerVersion: 'requirements-contract-cp07-view-diagram-projection/v2',
    artifacts: [
      { artifactId: 'diagram-set', key: 'diagramSet', role: 'diagram_set', schemaVersion: 'requirements-contract-diagram-set/v1', mediaType: 'application/json' },
    ],
    compute: () => prepareRequirementsContractCp07Projection({ semanticIr, resolvedEvidenceIndex }),
  });
  const cp05Projection = cp05Result.values['confirmation-projection'];
  const markdown = cp05Result.values['final-markdown'];
  const executionManifest = cp06Result.values['execution-manifest'];
  const perMustBundle = cp06Result.values['per-must-bundle'];
  const traceMatrix = cp06Result.values['trace-matrix'];
  const diagramSet = cp07Result.values['diagram-set'];
  const cp08 = prepareRequirementsContractCp08Projection({
    semanticIr,
    resolvedEvidenceIndex,
    cp05Projection,
    markdown,
    markdownComposition: undefined,
    executionManifest,
    perMustBundle,
    traceMatrix,
    diagramSet,
  });
  const projectionIdentity = {
    authoringRequestId: input.requestId,
    authoringAttemptId: input.operationId,
    attemptManifestHash: input.currentAuthority.activeBuildHash,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    sourceBindingHash: sourceBinding.sourceBindingHash,
  };
  const lintStages = [
    ['cp05', [
      { artifactId: 'final-markdown', role: 'source_markdown', value: markdown },
      { artifactId: 'confirmation-projection', role: 'implementation_confirmation', value: cp05Projection },
    ]],
    ['cp06', [
      { artifactId: 'per-must-bundle', role: 'per_must_bundle', value: perMustBundle },
      { artifactId: 'execution-manifest', role: 'execution_manifest', value: executionManifest },
      { artifactId: 'trace-matrix', role: 'compact_trace_matrix', value: traceMatrix },
    ]],
    ['cp07', [
      { artifactId: 'confirmation-view', role: 'human_view', value: markdown },
      { artifactId: 'diagram-set', role: 'diagram_set', value: diagramSet },
    ]],
    ['cp08', [
      { artifactId: 'projection-reconciliation-report', role: 'projection_reconciliation_report', value: cp08.reconciliationReport },
      { artifactId: 'authority-resolution-report', role: 'authority_resolution_report', value: cp08.authorityResolutionReport },
      { artifactId: 'renderability-probe-report', role: 'renderability_probe_report', value: cp08.renderabilityProbeReport },
      { artifactId: 'judge-audit-packet', role: 'judge_audit_packet', value: cp08.auditPacket },
    ]],
  ];
  for (const [stage, artifacts] of lintStages) {
    const lint = lintRequirementsContractProjectionStage({
      stage,
      identity: projectionIdentity,
      artifacts,
      checkedRequirementIds: cp08.requirementIds,
    });
    if (lint.decision === 'block') throw new Error(lint.issueCodes[0]);
  }
  const lintReport = {
    schemaVersion: 'requirements-contract-lint-report/v1',
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    decision: 'pass',
    checkIds: lintStages.map(([stage]) => stage),
  };
  const cp08ReportEntries = [
    { artifactId: 'lint-report', role: 'lint_report', value: lintReport },
    { artifactId: 'projection-reconciliation-report', role: 'projection_reconciliation_report', value: cp08.reconciliationReport },
    { artifactId: 'authority-resolution-report', role: 'authority_resolution_report', value: cp08.authorityResolutionReport },
    { artifactId: 'renderability-probe-report', role: 'renderability_probe_report', value: cp08.renderabilityProbeReport },
    { artifactId: 'judge-audit-packet-coverage', role: 'judge_audit_packet_coverage', value: cp08.coverageManifest },
  ].map((artifact) => ({
    artifactId: artifact.artifactId,
    ...contentAddressedArtifactEntry({
      recordRoot: input.recordRoot,
      role: artifact.role,
      schemaVersion: artifact.value.schemaVersion,
      mediaType: 'application/json',
      value: artifact.value,
    }),
  }));
  const auditArtifactEntries = [
    ...cp05Result.artifactEntries,
    ...cp06Result.artifactEntries,
    ...cp07Result.artifactEntries,
    ...cp08ReportEntries,
  ].filter((entry) => !['judge_audit_packet_coverage', 'lint_report'].includes(entry.role));
  const semanticEntry = cp04Entries.find((entry) => entry.role === 'semantic_ir');
  const auditPacketDescriptor = buildRequirementsContractJudgeAuditPacketV3({
    recordRoot: input.recordRoot,
    packet: cp08.auditPacket,
    semanticIr: withoutRequirementsAuthoringOperationMetadata(semanticIr),
    semanticIrRef: semanticEntry.contentRef,
    artifactEntries: auditArtifactEntries,
  });
  const auditPacketEntry = {
    artifactId: 'judge-audit-packet',
    ...contentAddressedArtifactEntry({
      recordRoot: input.recordRoot,
      role: 'judge_audit_packet',
      schemaVersion: auditPacketDescriptor.schemaVersion,
      mediaType: 'application/json',
      value: auditPacketDescriptor,
    }),
  };
  const generatedEntries = [
    ...cp04Entries,
    ...cp05Result.artifactEntries,
    ...cp06Result.artifactEntries,
    ...cp07Result.artifactEntries,
    ...cp08ReportEntries,
    auditPacketEntry,
  ];
  const replacedRoles = new Set(generatedEntries.map((entry) => entry.role));
  const artifactEntries = [
    ...currentEntries.filter((entry) => !replacedRoles.has(entry.role)),
    ...generatedEntries,
  ].map(({ artifactId: _artifactId, ...entry }) => entry);
  const cp08Entries = generatedEntries
    .filter((entry) => [
      'projection_reconciliation_report',
      'authority_resolution_report',
      'renderability_probe_report',
      'judge_audit_packet_coverage',
      'judge_audit_packet',
    ].includes(entry.role))
    .sort((left, right) => left.role.localeCompare(right.role, 'en'));
  runRequirementsSemanticCheckpointUnits({
    recordRoot: input.recordRoot,
    operationId: input.operationId,
    checkpointId: 'cp08',
    semanticInputHash: input.semanticInputHash,
    planHash: requirementsContractDomainHash('requirements-checkpoint-plan/cp08/v2', {
      compiler: 'requirements-contract-cp08-reconciliation-renderability/v2',
      unitIds: cp08Entries.map((entry) => `cp08:${entry.role}`),
    }),
    validatorVersion: 'requirements-contract-authoring-validator/v2',
    units: cp08Entries.map((entry) => ({
      unitId: `cp08:${entry.role}`,
      unitInputHash: entry.semanticHash,
      compilerVersion: 'requirements-contract-cp08-reconciliation-renderability/v2',
      execute: () => [entry.contentRef],
    })),
  });
  const checkpointIds = Array.from({ length: 9 }, (_, ordinal) =>
    `cp${String(ordinal).padStart(2, '0')}`
  );
  const terminalStateHashes = checkpointIds.map((checkpointId) => {
    const checkpoint = readRequirementsSemanticCheckpoint({
      recordRoot: input.recordRoot,
      operationId: input.operationId,
      checkpointId,
    });
    if (checkpoint.semanticInputHash !== input.semanticInputHash || checkpoint.decision !== 'passed') {
      throw new Error('requirements_checkpoint_state_invalid');
    }
    return checkpoint.stateHash;
  });
  const projectionSetHash = requirementsContractDomainHash(
    'requirements-projection-set/v2',
    artifactEntries.map((entry) => ({
      role: entry.role,
      schemaVersion: entry.schemaVersion,
      semanticHash: entry.semanticHash,
      contentHash: entry.contentRef.contentHash,
    }))
  );
  const manifest = createRequirementsContractBuildManifestV2({
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    compilerIdentity: 'requirements-contract-authoring-compiler/v2',
    projectionSetHash,
    checkpointSummary: { checkpointIds, terminalStateHashes },
    validationSummary: { decision: 'pass', checkIds: checkpointIds },
    artifactEntries,
  });
  const nextAuthority = deriveRequirementsContractActiveAuthority({
    manifest,
    semanticRevisionId: semanticIr.semanticRevisionId,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    currentAuthority: input.currentAuthority,
  });
  const changedArtifacts = generatedEntries.filter((entry) => {
    const current = currentEntries.find((candidate) => candidate.role === entry.role);
    return !current || current.semanticHash !== entry.semanticHash ||
      current.contentRef.contentHash !== entry.contentRef.contentHash;
  });
  return {
    currentManifest,
    manifest,
    nextAuthority,
    auditPacket: auditPacketDescriptor,
    changedArtifacts,
  };
}

const CLOSED_REMEDIATION_ISSUE_CODES = new Set([
  'judge_remediation_no_progress',
  'judge_remediation_limit_reached',
  'requirements_contract_remediation_blocked',
  'requirements_remediation_not_materializable',
]);

function writeLatestRemediationFailureSummary(input) {
  const request = input.request && typeof input.request === 'object' ? input.request : {};
  const auditBindingHash =
    String(request.auditBindingHash || request.auditBinding?.auditBindingHash ||
      input.activeRequest.auditBindingHash || sha256Stable({ judgeRequestHash: input.activeRequest.judgeRequestHash }));
  const binding = request.auditBinding && typeof request.auditBinding === 'object'
    ? request.auditBinding
    : null;
  if (!binding) throw new Error('requirements_judge_decision_binding_missing');
  const decision = readVerifiedRequirementsContractJudgeDecision({
    recordRoot: input.recordRoot,
    binding,
  });
  if (!decision || decision.verdict !== 'audited_fail') {
    throw new Error('requirements_judge_decision_missing');
  }
  const judgeDecisionHash = decision.decisionHash;
  const remediationDecision = input.issueCode === 'judge_remediation_no_progress'
    ? 'no_progress'
    : input.issueCode === 'judge_remediation_limit_reached'
      ? 'budget_exhausted'
      : input.issueCode === 'requirements_remediation_not_materializable' ||
          input.issueCode === 'requirements_contract_remediation_blocked'
        ? 'not_materializable'
        : 'judge_failed';
  const payload = {
    schemaVersion: 'requirements-contract-failure-summary/v1',
    scopeSemanticHash: String(input.currentAuthority.activeScopeSemanticHash || ''),
    auditBindingHash,
    judgeDecisionHash,
    activeRequestHash: sha256Stable(input.activeRequest),
    issueCodes: [input.issueCode],
    remediationDecision,
  };
  writeJsonAtomic(
    path.join(input.recordRoot, 'quality', 'failures', 'latest.json'),
    { ...payload, summaryHash: sha256Stable({ domain: 'requirements-contract-failure-summary/v1', payload }) }
  );
}

function persistClosedRemediationHalt(input) {
  if (!CLOSED_REMEDIATION_ISSUE_CODES.has(input.issueCode)) return null;
  const current = JSON.parse(fs.readFileSync(input.activeJudgeRequestPath, 'utf8'));
  if (
    sha256Stable(current) !== sha256Stable(input.activeRequest) ||
    current.status !== 'audited_fail' ||
    !current.acceptedEvaluation
  ) {
    throw new Error('requirements_contract_judge_active_cas_conflict');
  }
  writeLatestRemediationFailureSummary(input);
  return closedRemediationHaltResult({
    issueCode: input.issueCode,
    authoringRequestId: input.requestId,
    authoringAttemptId: `build-${String(input.currentAuthority.activeBuildHash).slice('sha256:'.length)}`,
    judgeRequestHash: input.activeRequest.judgeRequestHash,
    automaticRemediationCount: input.request.remediation ? 1 : 0,
  });
}

function readTerminalRemediationHalt(input) {
  const summaryPath = path.join(input.recordRoot, 'quality', 'failures', 'latest.json');
  if (!fs.existsSync(summaryPath)) return null;
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const { summaryHash, ...payload } = summary;
    if (
      summaryHash !== sha256Stable({ domain: 'requirements-contract-failure-summary/v1', payload }) ||
      !Array.isArray(summary.issueCodes) || summary.issueCodes.length !== 1 ||
      !CLOSED_REMEDIATION_ISSUE_CODES.has(String(summary.issueCodes[0]))
    ) return null;
    const request = readRecordJson(input.recordRoot, input.activeRequest.requestPath);
    const binding = request.auditBinding && typeof request.auditBinding === 'object'
      ? request.auditBinding
      : null;
    if (!binding) return null;
    const decision = readVerifiedRequirementsContractJudgeDecision({
      recordRoot: input.recordRoot,
      binding,
    });
    if (!decision || decision.verdict !== 'audited_fail' ||
      summary.auditBindingHash !== decision.auditBindingHash ||
      summary.judgeDecisionHash !== decision.decisionHash ||
      summary.activeRequestHash !== sha256Stable(input.activeRequest) ||
      summary.scopeSemanticHash !== input.currentAuthority.activeScopeSemanticHash) return null;
    return closedRemediationHaltResult({
      issueCode: summary.issueCodes[0],
      authoringRequestId: input.requestId,
      authoringAttemptId: `build-${String(input.currentAuthority.activeBuildHash).slice('sha256:'.length)}`,
      judgeRequestHash: input.activeRequest.judgeRequestHash,
      automaticRemediationCount: request.remediation ? 1 : 0,
    });
  } catch {
    return null;
  }
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
  if (repairSteps.some((step) => !['cp05', 'cp06', 'cp07', 'cp08'].includes(String(step.earliestAffectedStage)))) {
    throw new Error('requirements_remediation_not_materializable');
  }
  const currentSemanticIr = resolveRequirementsActiveArtifact({
    recordRoot: input.recordRoot,
    activeAuthority: input.currentAuthority,
    role: 'semantic_ir',
  }).value;
  const materialized = materializeRequirementsSemanticRepair({
    currentSemanticIr,
    repairSteps,
  });
  if (materialized.decision === 'blocked') throw new Error(materialized.issueCodes[0]);
  if (!materialized.candidateSemanticIr) throw new Error('requirements_remediation_not_materializable');
  const preflight = evaluateRequirementsContractRemediationCandidate({
    currentSemanticIr,
    candidateSemanticIr: materialized.candidateSemanticIr,
    repairSteps,
  });
  if (preflight.decision === 'blocked') throw new Error(preflight.issueCodes[0]);
  if (preflight.decision === 'no_progress') throw new Error('judge_remediation_no_progress');
  const repairAttemptId = stableId('REPAIR', {
    requestId: input.requestId,
    remediatesRequestHash: activeRequest.judgeRequestHash,
    remediationPlanHash: plan.remediationPlanHash,
  });
  const repairContext = {
    ...input.authoringContext,
    authoringAttemptId: repairAttemptId,
  };
  const existingDelta =
    continuation === 'resume_commit'
      ? readRecordJson(input.recordRoot, activeRequest.remediationDeltaRef.path)
      : null;
  if (
    existingDelta &&
    (existingDelta.remediationDeltaHash !== activeRequest.remediationDeltaRef.hash ||
      existingDelta.remediatesRequestHash !== activeRequest.judgeRequestHash)
  ) {
    throw new Error('requirements_contract_remediation_delta_readback_mismatch');
  }
  const prepared = prepareContentAddressedProjectionSuccessor({
    recordRoot: input.recordRoot,
    requestId: input.requestId,
    operationId: repairAttemptId,
    semanticInputHash: input.scan.sourceList.sourceListHash,
    currentAuthority: input.currentAuthority,
    semanticIr: materialized.candidateSemanticIr,
    sourceBinding: input.candidateBinding.sourceBinding,
    resolvedEvidenceIndex: input.candidateBinding.resolvedEvidenceIndex,
  });
  if (prepared.changedArtifacts.length === 0) {
    throw new Error('judge_remediation_no_progress');
  }
  const changedArtifactRoles = prepared.changedArtifacts.map((entry) => entry.role);
  const changedArtifactRefs = prepared.changedArtifacts.map(
    (entry) => entry.artifactId || entry.role
  );
  const delta = finalizeRequirementsContractRemediationDelta({
    plan,
    beforeAuthority: input.currentAuthority,
    afterAuthority: prepared.nextAuthority,
    executedRepairStepRefs: repairSteps.map((step) => step.findingId),
    deferredRepairStepRefs: [],
    changedArtifactRoles,
    changedArtifactRefs,
    automaticRemediationCount: 0,
    maxAutomaticRemediations: 1,
  });
  const deltaPath =
    `quality/requests/${activeRequest.judgeRequestHash.replace(':', '-')}/remediation-delta.json`;
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
    compareAndSwapRequirementsContractJudgeActiveRequest({
      recordRoot: input.recordRoot,
      expected: activeRequest,
      next: advanceRequirementsContractJudgeActiveRequest(activeRequest, {
        remediationDeltaRef: { path: deltaPath, hash: delta.remediationDeltaHash },
      }),
    });
  }
  const requirementRecordPath = path.join(
    input.recordRoot,
    'record',
    'requirement-record.json'
  );
  publishRequirementsContractDurableBuild({
    recordRoot: input.recordRoot,
    operationId: repairAttemptId,
    manifest: prepared.manifest,
    nextAuthority: prepared.nextAuthority,
    currentAuthority: input.currentAuthority,
    expectedActiveAuthorityHash: requirementsContractDomainHash(
      'requirements-active-authority-cas/v1',
      input.currentAuthority
    ),
    compareAndSwapAuthorityTuple(current, next) {
      const latest = openRequirementsContractRecord(requirementRecordPath);
      if (sha256Stable(latest.activeAuthority) !== sha256Stable(current)) return false;
      writeJsonAtomic(requirementRecordPath, {
        ...latest,
        activeOperationId: repairAttemptId,
        activeAuthority: next,
        lifecycle: 'audit_pending',
      });
      return true;
    },
  });
  return {
    repairContext,
    activeAuthority: prepared.nextAuthority,
    buildManifest: prepared.manifest,
    auditPacket: prepared.auditPacket,
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
  const recordRoot = authoringRecordRoot(context.cwd, requestId);
  // The scanner may publish content-addressed source blobs during resume.
  fs.mkdirSync(recordRoot, { recursive: true });
  const authoritySources = readRequirementsContractDeclaredAuthoritySources(intakeSource);
  const scan = scanRequirementsContractConsumerAuthority({
    cwd: context.cwd,
    recordRoot,
    intakeSource,
    authoritySources,
  });
  if (scan.conflicts.length > 0) throw new Error('requirements_authority_conflict');
  if (scan.sourceList.sourceListHash !== authoringContext.authoritySourceListHash) {
    throw new Error('requirements_authority_context_stale');
  }
  const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  const activeJudgeRequestPath = path.join(recordRoot, 'quality', 'active-request.json');
  if (fs.existsSync(requirementRecordPath)) {
    const requirementRecord = openRequirementsContractRecord(requirementRecordPath);
    const activeAuthority = requirementRecord.activeAuthority;
    const activeJudgeRequestStatus = fs.existsSync(activeJudgeRequestPath)
      ? JSON.parse(fs.readFileSync(activeJudgeRequestPath, 'utf8')).status
      : null;
    if (activeJudgeRequestStatus === 'audited_fail') {
      const terminalRequest = JSON.parse(fs.readFileSync(activeJudgeRequestPath, 'utf8'));
      const terminal = readTerminalRemediationHalt({
        recordRoot,
        requestId,
        currentAuthority: activeAuthority,
        activeRequest: terminalRequest,
      });
      if (terminal) return terminal;
    }
    if (
      activeAuthority?.activeBuildHash &&
      requirementRecord.activeOperationId === authoringAttemptId &&
      activeJudgeRequestStatus !== 'audited_fail'
    ) {
      const buildManifest = readRecordJson(recordRoot, activeAuthority.activeBuildManifestPath);
      if (
        buildManifest.schemaVersion === 'requirements-contract-build-manifest/v2' &&
        activeAuthority.activeSourceBindingHash !== buildManifest.sourceBindingHash &&
        requirementRecord.currentPromotionEvidence?.path
      ) {
        const stagingRoot = path.join(
          recordRoot, 'confirmation', 'staging', 'binding-refresh',
          String(activeAuthority.activeBindingRevisionId)
        );
        if (!fs.existsSync(path.join(stagingRoot, 'requirements.md')) ||
            !fs.existsSync(path.join(stagingRoot, 'requirements.html'))) {
          stageRequirementsContractConfirmationBindingRefresh({
            projectRoot: context.cwd,
            requestId,
            bindingRevisionId: activeAuthority.activeBindingRevisionId,
          });
        }
        const refreshedConfirmation = refreshRequirementsContractConfirmationBinding({
          projectRoot: context.cwd,
          requestId,
        });
        return cliContinuationResult({
          status: refreshedConfirmation.status,
          issueCode: 'requirements_user_confirmable',
          authoringRequestId: requestId,
          authoringAttemptId,
          unresolvedDecisionCount: refreshedConfirmation.unresolvedDecisionCount,
          confirmation: refreshedConfirmation.confirmation,
        });
      }
      const packetEntry = (Array.isArray(buildManifest.artifactEntries) ? buildManifest.artifactEntries : [])
        .find((entry) => entry.role === 'judge_audit_packet');
      if (!packetEntry) throw new Error('requirements_judge_audit_packet_missing');
      return continuePublishedRequirementsAudit(context, {
        recordRoot,
        authoringRequestId: requestId,
        authoringAttemptId,
        grillSessionId: options.grillSessionId,
        decisionReceiptRefs: options.decisionReceiptRefs,
        activeAuthority,
        buildManifest,
        auditPacket: resolveRequirementsAuthoringArtifact({ recordRoot, entry: packetEntry }),
        targetSource: authoringContext.targetSource,
      });
    }
  }
  runRequirementsSemanticCheckpointJsonUnit({
    recordRoot,
    operationId: authoringAttemptId,
    checkpointId: 'cp00',
    semanticInputHash: scan.sourceList.sourceListHash,
    planHash: requirementsContractDomainHash('requirements-checkpoint-plan/cp00/v1', {
      compiler: 'requirements-consumer-authority-scanner/v1',
    }),
    validatorVersion: 'requirements-contract-authoring-validator/v2',
    unitId: 'cp00:authority-source-list',
    unitInputHash: scan.sourceList.sourceListHash,
    compilerVersion: 'requirements-consumer-authority-scanner/v1',
    role: 'consumer_authority_source_list',
    execute: () => withoutRequirementsAuthoringOperationMetadata(scan.sourceList),
  });
  const atoms = atomicMustsFromScan(scan);
  const confirmedDecisions = confirmedDecisionsFromGrillResolution(options.grillResolution, atoms, scan);
  const semanticKernel = {
    schemaVersion: 'requirements-contract-semantic-kernel/v1',
    authoringRequestId: requestId,
    authoritySourceListHash: scan.sourceList.sourceListHash,
    sourceRoots: scan.sourceRootCandidates.map((candidate) => ({
      sourceRootId: candidate.sourceRootId,
      rootClass: candidate.rootClass,
      nodeType: candidate.nodeType,
      bodySchemaVersion: candidate.bodySchemaVersion,
      semanticBody: candidate.semanticBody,
      proposedAuthorityClass: candidate.proposedAuthorityClass,
    })),
  };
  let capabilitySemantic = null;
  const cp01Units = [
    ...[...scan.sourceRootCandidates]
      .sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId, 'en'))
      .map((candidate) => ({
        unitId: `cp01:root:${candidate.sourceRootId}`,
        unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp01-root/v1', {
          sourceRootId: candidate.sourceRootId,
          rootClass: candidate.rootClass,
          semanticBody: candidate.semanticBody,
        }),
        compilerVersion: 'requirements-contract-material-root/v1',
        execute: () => [contentAddressedArtifactEntry({
          recordRoot, role: 'semantic_root', schemaVersion: candidate.bodySchemaVersion,
          mediaType: 'application/json', value: candidate.semanticBody,
        }).contentRef],
      })),
    {
      unitId: 'cp01:zz-semantic-kernel',
      unitInputHash: requirementsContractDomainHash(
        'requirements-checkpoint-unit/cp01-semantic-kernel/v1', semanticKernel
      ),
      compilerVersion: 'requirements-contract-semantic-kernel/v1',
      execute: () => [contentAddressedArtifactEntry({
        recordRoot, role: 'semantic_kernel', schemaVersion: semanticKernel.schemaVersion,
        mediaType: 'application/json', value: semanticKernel,
      }).contentRef],
    },
    {
      unitId: 'cp01:zzz-technical-planning-capability',
      unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp01-capability/v1', {
        sourceListHash: scan.sourceList.sourceListHash,
        typedSourceGraphHash: scan.typedSourceAuthority?.graphHash ?? null,
      }),
      compilerVersion: 'requirements-production-technical-planning-capability/v1',
      execute: () => {
        capabilitySemantic = withoutRequirementsAuthoringOperationMetadata(
          resolveRequirementsProductionTechnicalPlanningCapability({
            authoringRequestId: requestId,
            authoringAttemptId,
            premiseHash: scan.sourceList.sourceListHash,
            sourceRootCandidates: scan.sourceRootCandidates,
            ...(scan.typedSourceAuthority ? { typedSourceAuthority: scan.typedSourceAuthority } : {}),
          })
        );
        return [contentAddressedArtifactEntry({
          recordRoot, role: 'technical_planning_capability',
          schemaVersion: capabilitySemantic.schemaVersion,
          mediaType: 'application/json', value: capabilitySemantic,
        }).contentRef];
      },
    },
  ];
  const cp01Checkpoint = runRequirementsSemanticCheckpointUnits({
    recordRoot, operationId: authoringAttemptId, checkpointId: 'cp01',
    semanticInputHash: scan.sourceList.sourceListHash,
    planHash: requirementsContractDomainHash('requirements-checkpoint-plan/cp01/v2', {
      compiler: 'requirements-contract-material-root/v1',
      unitIds: cp01Units.map((unit) => unit.unitId),
    }),
    validatorVersion: 'requirements-contract-authoring-validator/v2',
    units: cp01Units,
  });
  const cp01ById = new Map(cp01Checkpoint.state.completedUnits.map((unit) => [unit.unitId, unit]));
  const semanticKernelRef = cp01ById.get('cp01:zz-semantic-kernel')?.outputRefs[0];
  const capabilityRef = cp01ById.get('cp01:zzz-technical-planning-capability')?.outputRefs[0];
  if (!semanticKernelRef || !capabilityRef) throw new Error('requirements_checkpoint_unit_output_missing');
  if (!capabilitySemantic) {
    capabilitySemantic = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
      readRequirementsContentObject({ recordRoot, ref: capabilityRef })
    ));
  }
  const capability = { ...capabilitySemantic, authoringAttemptId };
  const cp02Input = {
    atoms,
    typedSourceIds: scan.typedSourceAuthority
      ? scan.sourceRootCandidates.map((candidate) => candidate.sourceRootId) : [],
    decisions: confirmedDecisions.map((decision) => ({
      decisionId: decision.id,
      affectedAtomIds: decision.affectedAtomIds,
      ...(decision.affectedSourceRefs ? { affectedSourceRefs: decision.affectedSourceRefs } : {}),
      authorityPremiseHashes: decision.authorityPremiseHashes,
    })),
    technicalPlanning: capability,
  };
  let cp02CandidateSemantic = null;
  const cp02Units = [
    ...[...atoms]
      .sort((left, right) => left.atomId.localeCompare(right.atomId, 'en'))
      .map((atom) => ({
        unitId: `cp02:atom:${atom.atomId}`,
        unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp02-atom/v1', atom),
        compilerVersion: 'requirements-contract-atomic-decomposition/v1',
        execute: () => [contentAddressedArtifactEntry({
          recordRoot, role: 'atomic_requirement', schemaVersion: 'requirements-contract-atomic-requirement/v1',
          mediaType: 'application/json', value: atom,
        }).contentRef],
      })),
    {
      unitId: 'cp02:zz-final-closure',
      unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp02/v1', cp02Input),
      compilerVersion: 'requirements-contract-cp02-compiler/v1',
      execute: () => {
        cp02CandidateSemantic = withoutRequirementsAuthoringOperationMetadata(
          prepareRequirementsContractCp02PipelineStage({
            authoringRequestId: requestId, authoringAttemptId, atoms: cp02Input.atoms,
            ...(cp02Input.typedSourceIds.length > 0 ? { typedSourceIds: cp02Input.typedSourceIds } : {}),
            decisions: cp02Input.decisions,
            technicalPlanning: cp02Input.technicalPlanning,
          })
        );
        const mustPacket = {
          schemaVersion: 'requirements-contract-must-decomposition-packet/v1',
          authoringRequestId: requestId,
          candidateHash: cp02CandidateSemantic.candidateHash,
          atoms: cp02CandidateSemantic.atoms,
          decisions: cp02CandidateSemantic.decisions,
          technicalPlanningTriggerIdentity: cp02CandidateSemantic.technicalPlanningTriggerIdentity,
          executionRegistryHash: cp02CandidateSemantic.executionRegistryHash,
        };
        const idRegistry = {
          schemaVersion: 'requirements-contract-id-registry/v1',
          authoringRequestId: requestId,
          sourceRootIds: scan.sourceRootCandidates.map((candidate) => candidate.sourceRootId).sort(),
          atomIds: cp02CandidateSemantic.atoms.map((atom) => atom.atomId).sort(),
          executionConstraintRefs: [...new Set(cp02CandidateSemantic.atoms.flatMap(
            (atom) => atom.executionConstraintRefs
          ))].sort(),
        };
        return [
          ['cp02_candidate', cp02CandidateSemantic],
          ['must_decomposition_packet', mustPacket],
          ['id_registry', idRegistry],
        ].map(([role, value]) => contentAddressedArtifactEntry({
          recordRoot, role, schemaVersion: value.schemaVersion,
          mediaType: 'application/json', value,
        }).contentRef);
      },
    },
  ];
  const cp02Checkpoint = runRequirementsSemanticCheckpointUnits({
    recordRoot, operationId: authoringAttemptId, checkpointId: 'cp02',
    semanticInputHash: scan.sourceList.sourceListHash,
    planHash: requirementsContractDomainHash('requirements-checkpoint-plan/cp02/v2', {
      compiler: 'requirements-contract-cp02-compiler/v1',
      unitIds: cp02Units.map((unit) => unit.unitId),
    }),
    validatorVersion: 'requirements-contract-authoring-validator/v2', units: cp02Units,
  });
  const cp02FinalRefs = cp02Checkpoint.state.completedUnits
    .find((unit) => unit.unitId === 'cp02:zz-final-closure')?.outputRefs ?? [];
  if (cp02FinalRefs.length !== 3) throw new Error('requirements_checkpoint_unit_output_missing');
  if (!cp02CandidateSemantic) {
    cp02CandidateSemantic = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
      readRequirementsContentObject({ recordRoot, ref: cp02FinalRefs[0] })
    ));
  }
  const cp02Candidate = { ...cp02CandidateSemantic, authoringAttemptId };
  const decisionReceiptRefs = (options.decisionReceiptRefs ?? []).map((ref) => ({
    decisionReceiptId: path.basename(ref.path, '.json'),
    path: ref.path,
    hash: ref.hash,
  }));
  const coreArtifactEntries = [
    {
      role: 'semantic_kernel', schemaVersion: semanticKernel.schemaVersion,
      semanticHash: requirementsContractDomainHash('requirements-projection:semantic_kernel/v1', semanticKernel),
      contentRef: semanticKernelRef,
    },
    ...[
      ['must_decomposition_packet', cp02FinalRefs[1]],
      ['id_registry', cp02FinalRefs[2]],
    ].map(([role, contentRef]) => {
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
        readRequirementsContentObject({ recordRoot, ref: contentRef })
      ));
      return {
        role, schemaVersion: value.schemaVersion,
        semanticHash: requirementsContractDomainHash(`requirements-projection:${role}/v1`, value),
        contentRef,
      };
    }),
  ];
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
  const activeJudgeRequest = fs.existsSync(activeJudgeRequestPath)
    ? JSON.parse(fs.readFileSync(activeJudgeRequestPath, 'utf8'))
    : null;
  if (activeJudgeRequest?.status === 'audited_fail') {
    const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
    const requirementRecord = openRequirementsContractRecord(requirementRecordPath);
    const candidateSemanticIr = canonicalSemanticIrFromClosure({
      authoringRequestId: requestId,
      scan,
      cp02Candidate,
      capability,
      confirmedDecisions,
    });
    const candidateBinding = canonicalBindingFromClosure({
      authoringRequestId: requestId,
      scan,
      semanticIr: candidateSemanticIr,
      parentBindingRevisionId: requirementRecord.activeAuthority.activeBindingRevisionId,
    });
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
        candidateSemanticIr,
        candidateBinding,
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
        adapterRef:
          prepared.provider.adapterRef ||
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
    if (judge.status === 'audited_pass') {
      return continueRequirementsFinalRender(context, {
        authoringRequestId: requestId,
        authoringAttemptId: repair.repairContext.authoringAttemptId,
        grillSessionId: options.grillSessionId,
        decisionReceiptRefs: options.decisionReceiptRefs,
        targetSource: repair.repairContext.targetSource,
      });
    }
    return cliContinuationResult({
      status: 'audit_pending',
      issueCode: 'requirements_audit_pending',
      authoringRequestId: requestId,
      authoringAttemptId: repair.repairContext.authoringAttemptId,
      decisionReceiptRefs: options.decisionReceiptRefs,
    });
  }
  let compiledClosure = null;
  const cp03Checkpoint = runRequirementsSemanticCheckpointUnits({
    recordRoot,
    operationId: authoringAttemptId,
    checkpointId: 'cp03',
    semanticInputHash: scan.sourceList.sourceListHash,
    planHash: requirementsContractDomainHash('requirements-checkpoint-plan/cp03/v1', {
      compiler: 'requirements-contract-semantic-closure/v1',
    }),
    validatorVersion: 'requirements-contract-authoring-validator/v2',
    units: [{
      unitId: 'cp03:semantic-closure',
      unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp03/v1', {
        cp02Candidate: withoutRequirementsAuthoringOperationMetadata(cp02Candidate),
        capability: withoutRequirementsAuthoringOperationMetadata(capability),
        confirmedDecisions,
      }),
      compilerVersion: 'requirements-contract-semantic-closure/v1',
      execute: () => {
        const semanticIr = canonicalSemanticIrFromClosure({
          authoringRequestId: requestId,
          scan,
          cp02Candidate,
          capability,
          confirmedDecisions,
        });
        const canonicalBinding = canonicalBindingFromClosure({
          authoringRequestId: requestId,
          scan,
          semanticIr,
        });
        compiledClosure = { semanticIr, canonicalBinding };
        return [
          ['semantic_ir', semanticIr],
          ['source_binding', canonicalBinding.sourceBinding],
          ['resolved_evidence_index', canonicalBinding.resolvedEvidenceIndex],
        ].map(([role, value]) => publishRequirementsContentObject({
          recordRoot,
          role,
          mediaType: 'application/json',
          bytes: Buffer.from(canonicalRequirementsJson(withoutRequirementsAuthoringOperationMetadata(value)), 'utf8'),
        }));
      },
    }],
  });
  if (!compiledClosure) {
    const refs = cp03Checkpoint.state.completedUnits[0]?.outputRefs ?? [];
    if (refs.length !== 3) throw new Error('requirements_checkpoint_unit_output_missing');
    const readJsonRef = (ref) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
      readRequirementsContentObject({ recordRoot, ref })
    ));
    const [semanticIr, sourceBinding, resolvedEvidenceIndex] = refs.map(readJsonRef);
    compiledClosure = {
      semanticIr,
      canonicalBinding: { sourceBinding, resolvedEvidenceIndex },
    };
  }
  const { semanticIr, canonicalBinding } = compiledClosure;
  const cp04Result = runContentAddressedProjectionStage({
    recordRoot, operationId: authoringAttemptId, checkpointId: 'cp04',
    semanticInputHash: scan.sourceList.sourceListHash,
    unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp04/v2', {
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      sourceBindingHash: canonicalBinding.sourceBinding.sourceBindingHash,
    }),
    compilerVersion: 'requirements-contract-cp04-freeze/v2',
    artifacts: [
      { artifactId: 'semantic-ir', key: 'semanticIr', role: 'semantic_ir', schemaVersion: semanticIr.schemaVersion, mediaType: 'application/json' },
      { artifactId: 'source-binding', key: 'sourceBinding', role: 'source_binding', schemaVersion: canonicalBinding.sourceBinding.schemaVersion, mediaType: 'application/json' },
      { artifactId: 'resolved-evidence-index', key: 'resolvedEvidenceIndex', role: 'resolved_evidence_index', schemaVersion: canonicalBinding.resolvedEvidenceIndex.schemaVersion, mediaType: 'application/json' },
    ],
    compute: () => ({
      ...prepareRequirementsContractCp04FreezeStage({
        semanticIr,
        sourceBinding: canonicalBinding.sourceBinding,
        resolvedEvidenceIndex: canonicalBinding.resolvedEvidenceIndex,
      }),
      semanticIr,
      sourceBinding: canonicalBinding.sourceBinding,
      resolvedEvidenceIndex: canonicalBinding.resolvedEvidenceIndex,
    }),
  });
  const cp04Stage = {
    semanticIr: cp04Result.values['semantic-ir'],
    sourceBinding: cp04Result.values['source-binding'],
    resolvedEvidenceIndex: cp04Result.values['resolved-evidence-index'],
  };
  const cp05Result = runContentAddressedProjectionStage({
    recordRoot, operationId: authoringAttemptId, checkpointId: 'cp05',
    semanticInputHash: scan.sourceList.sourceListHash,
    unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp05/v2', {
      scopeSemanticHash: cp04Stage.semanticIr.scopeSemanticHash,
      sourceBindingHash: cp04Stage.sourceBinding.sourceBindingHash,
    }),
    compilerVersion: 'requirements-contract-cp05-source-confirmation-projection/v2',
    artifacts: [
      { artifactId: 'confirmation-projection', key: 'cp05Projection', role: 'confirmation_projection', schemaVersion: 'requirements-contract-confirmation-projection/v2', mediaType: 'application/json' },
      { artifactId: 'final-markdown', key: 'markdown', role: 'final_markdown', schemaVersion: 'markdown/v1', mediaType: 'text/markdown' },
    ],
    compute: () => prepareRequirementsContractCp05Projection({
      semanticIr: cp04Stage.semanticIr, resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
    }),
  });
  const cp06Result = runContentAddressedProjectionStage({
    recordRoot, operationId: authoringAttemptId, checkpointId: 'cp06',
    semanticInputHash: scan.sourceList.sourceListHash,
    unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp06/v2', {
      scopeSemanticHash: cp04Stage.semanticIr.scopeSemanticHash,
      sourceBindingHash: cp04Stage.sourceBinding.sourceBindingHash,
    }),
    compilerVersion: 'requirements-contract-cp06-execution-projection/v2',
    artifacts: [
      { artifactId: 'execution-manifest', key: 'cp06Execution', role: 'execution_manifest', schemaVersion: 'requirements-contract-execution-manifest/v2', mediaType: 'application/json' },
      { artifactId: 'per-must-bundle', key: 'perMustBundle', role: 'per_must_bundle', schemaVersion: 'requirements-contract-per-must-bundle/v1', mediaType: 'application/json' },
      { artifactId: 'trace-matrix', key: 'traceMatrix', role: 'trace_matrix', schemaVersion: 'requirements-contract-trace-matrix/v1', mediaType: 'application/json' },
    ],
    compute: () => {
      const result = prepareRequirementsContractCp06Projection({
        semanticIr: cp04Stage.semanticIr, resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
      });
      return {
        cp06Execution: result.cp06Execution.executionManifest,
        perMustBundle: result.perMustBundle,
        traceMatrix: result.traceMatrix,
      };
    },
  });
  const cp07Result = runContentAddressedProjectionStage({
    recordRoot, operationId: authoringAttemptId, checkpointId: 'cp07',
    semanticInputHash: scan.sourceList.sourceListHash,
    unitInputHash: requirementsContractDomainHash('requirements-checkpoint-unit/cp07/v2', {
      scopeSemanticHash: cp04Stage.semanticIr.scopeSemanticHash,
    }),
    compilerVersion: 'requirements-contract-cp07-view-diagram-projection/v2',
    artifacts: [{ artifactId: 'diagram-set', key: 'diagramSet', role: 'diagram_set', schemaVersion: 'requirements-contract-diagram-set/v1', mediaType: 'application/json' }],
    compute: () => prepareRequirementsContractCp07Projection({
      semanticIr: cp04Stage.semanticIr, resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
    }),
  });
  const cp05Values = cp05Result.values;
  const cp06Values = cp06Result.values;
  const cp07Values = cp07Result.values;
  const cp08Pure = prepareRequirementsContractCp08Projection({
    semanticIr: cp04Stage.semanticIr,
    resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
    cp05Projection: cp05Values['confirmation-projection'],
    markdown: cp05Values['final-markdown'],
    markdownComposition: undefined,
    executionManifest: cp06Values['execution-manifest'],
    perMustBundle: cp06Values['per-must-bundle'],
    traceMatrix: cp06Values['trace-matrix'],
    diagramSet: cp07Values['diagram-set'],
  });
  const projectionIdentity = {
    authoringRequestId: requestId,
    authoringAttemptId,
    attemptManifestHash: cp03Checkpoint.state.stateHash,
    scopeSemanticHash: cp04Stage.semanticIr.scopeSemanticHash,
    sourceBindingHash: cp04Stage.sourceBinding.sourceBindingHash,
  };
  const checkedRequirementIds = cp08Pure.requirementIds;
  const lintStages = [
    ['cp05', [
      { artifactId: 'final-markdown', role: 'source_markdown', value: cp05Values['final-markdown'] },
      { artifactId: 'confirmation-projection', role: 'implementation_confirmation', value: cp05Values['confirmation-projection'] },
    ]],
    ['cp06', [
      { artifactId: 'per-must-bundle', role: 'per_must_bundle', value: cp06Values['per-must-bundle'] },
      { artifactId: 'execution-manifest', role: 'execution_manifest', value: cp06Values['execution-manifest'] },
      { artifactId: 'trace-matrix', role: 'compact_trace_matrix', value: cp06Values['trace-matrix'] },
    ]],
    ['cp07', [
      { artifactId: 'confirmation-view', role: 'human_view', value: cp05Values['final-markdown'] },
      { artifactId: 'diagram-set', role: 'diagram_set', value: cp07Values['diagram-set'] },
    ]],
    ['cp08', [
      { artifactId: 'projection-reconciliation-report', role: 'projection_reconciliation_report', value: cp08Pure.reconciliationReport },
      { artifactId: 'authority-resolution-report', role: 'authority_resolution_report', value: cp08Pure.authorityResolutionReport },
      { artifactId: 'renderability-probe-report', role: 'renderability_probe_report', value: cp08Pure.renderabilityProbeReport },
      { artifactId: 'judge-audit-packet', role: 'judge_audit_packet', value: cp08Pure.auditPacket },
    ]],
  ];
  for (const [stage, artifacts] of lintStages) {
    const lint = lintRequirementsContractProjectionStage({
      stage, identity: projectionIdentity, artifacts, checkedRequirementIds,
    });
    if (lint.decision === 'block') throw new Error(lint.issueCodes[0]);
  }
  const contentAddressedProjectionEntries = [
    ...coreArtifactEntries,
    ...cp04Result.artifactEntries,
    ...cp05Result.artifactEntries,
    ...cp06Result.artifactEntries,
    ...cp07Result.artifactEntries,
  ];
  const lintReport = {
    schemaVersion: 'requirements-contract-lint-report/v1',
    semanticRevisionId: cp04Stage.semanticIr.semanticRevisionId,
    scopeSemanticHash: cp04Stage.semanticIr.scopeSemanticHash,
    decision: 'pass',
    checkIds: lintStages.map(([stage]) => stage),
  };
  const cp08ReportEntries = [
    { artifactId: 'lint-report', role: 'lint_report', value: lintReport },
    { artifactId: 'projection-reconciliation-report', role: 'projection_reconciliation_report', value: cp08Pure.reconciliationReport },
    { artifactId: 'authority-resolution-report', role: 'authority_resolution_report', value: cp08Pure.authorityResolutionReport },
    { artifactId: 'renderability-probe-report', role: 'renderability_probe_report', value: cp08Pure.renderabilityProbeReport },
    { artifactId: 'judge-audit-packet-coverage', role: 'judge_audit_packet_coverage', value: cp08Pure.coverageManifest },
  ].map((artifact) => ({
    artifactId: artifact.artifactId,
    ...contentAddressedArtifactEntry({
      recordRoot, role: artifact.role, schemaVersion: artifact.value.schemaVersion,
      mediaType: 'application/json', value: artifact.value,
    }),
  }));
  const auditArtifactEntries = [
    ...cp05Result.artifactEntries,
    ...cp06Result.artifactEntries,
    ...cp07Result.artifactEntries,
    ...cp08ReportEntries,
  ].filter((entry) => entry.role !== 'judge_audit_packet_coverage' && entry.role !== 'lint_report').map((entry) => ({
    artifactId: entry.artifactId, ...entry,
  }));
  const auditPacketDescriptor = buildRequirementsContractJudgeAuditPacketV3({
    recordRoot,
    packet: cp08Pure.auditPacket,
    semanticIr: withoutRequirementsAuthoringOperationMetadata(cp04Stage.semanticIr),
    semanticIrRef: cp04Result.artifactEntries.find((entry) => entry.role === 'semantic_ir').contentRef,
    artifactEntries: auditArtifactEntries,
  });
  const auditPacketManifestEntry = contentAddressedArtifactEntry({
    recordRoot, role: 'judge_audit_packet', schemaVersion: auditPacketDescriptor.schemaVersion,
    mediaType: 'application/json', value: auditPacketDescriptor,
  });
  const cp08Entries = cp08ReportEntries;
  const directArtifactEntries = [
    ...contentAddressedProjectionEntries,
    ...cp08Entries,
    { artifactId: 'judge-audit-packet', ...auditPacketManifestEntry },
  ];
  const publicationReady = validateRequirementsContractPublicationReady({
    buildIdentity: {
      schemaVersion: 'requirements-contract-build-input/v2',
      scopeSemanticHash: cp04Stage.semanticIr.scopeSemanticHash,
      sourceBindingHash: cp04Stage.sourceBinding.sourceBindingHash,
      artifactRoles: [...new Set(directArtifactEntries.map((entry) => entry.role))].sort(),
    },
    semanticIr: cp04Stage.semanticIr,
    resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
    reconciliationReport: cp08Pure.reconciliationReport,
    authorityResolutionReport: cp08Pure.authorityResolutionReport,
    renderabilityProbeReport: cp08Pure.renderabilityProbeReport,
    auditPacket: cp08Pure.auditPacket,
    coverageManifest: cp08Pure.coverageManifest,
    mandatoryDimensionRegistry: { dimensionIds: ['semantic_projection_reconciliation', 'authority_resolution', 'renderability', 'audit_packet_coverage'] },
    payloadObservation: { serializedBytes: cp08Pure.serializedBytes },
    buildArtifactRoles: [...new Set(directArtifactEntries.map((entry) => entry.role))].sort(),
  });
  if (publicationReady.decision === 'block') throw new Error(publicationReady.issueCodes[0]);
  runRequirementsSemanticCheckpointUnits({
    recordRoot, operationId: authoringAttemptId, checkpointId: 'cp08',
    semanticInputHash: scan.sourceList.sourceListHash,
    planHash: requirementsContractDomainHash('requirements-checkpoint-plan/cp08/v2', {
      compiler: 'requirements-contract-cp08-reconciliation-renderability/v2',
      unitIds: directArtifactEntries
        .filter((entry) => ['projection_reconciliation_report', 'authority_resolution_report',
          'renderability_probe_report', 'judge_audit_packet_coverage', 'judge_audit_packet']
          .includes(entry.role))
        .map((entry) => `cp08:${entry.role}`),
    }),
    validatorVersion: 'requirements-contract-authoring-validator/v2',
    units: directArtifactEntries
      .filter((entry) => ['projection_reconciliation_report', 'authority_resolution_report',
        'renderability_probe_report', 'judge_audit_packet_coverage', 'judge_audit_packet']
        .includes(entry.role))
      .sort((left, right) => left.role.localeCompare(right.role, 'en'))
      .map((entry) => ({
        unitId: `cp08:${entry.role}`,
        unitInputHash: entry.semanticHash,
        compilerVersion: 'requirements-contract-cp08-reconciliation-renderability/v2',
        execute: () => [entry.contentRef],
      })),
  });
  const currentRecord = fs.existsSync(requirementRecordPath)
    ? openRequirementsContractRecord(requirementRecordPath)
    : null;
  const durable = publishContentAddressedAuthoringBuild({
    recordRoot,
    sourcePath: intakeSource,
    operationId: authoringAttemptId,
    semanticIr: cp04Stage.semanticIr,
    sourceBinding: cp04Stage.sourceBinding,
    resolvedEvidenceIndex: cp04Stage.resolvedEvidenceIndex,
    contentAddressedArtifactEntries: directArtifactEntries,
    semanticInputHash: scan.sourceList.sourceListHash,
    currentAuthority: currentRecord?.activeAuthority ?? null,
    requirementRecordPath,
    requestId,
  });
  const buildManifest = durable.manifest;
  const activeAuthority = durable.activeAuthority;
  const auditPacketEntry = buildManifest.artifactEntries.find(
    (entry) => entry.role === 'judge_audit_packet'
  );
  if (!auditPacketEntry) throw new Error('requirements_judge_audit_packet_missing');
  const auditPacket = resolveRequirementsAuthoringArtifact({
    recordRoot,
    entry: auditPacketEntry,
  });
  return continuePublishedRequirementsAudit(context, {
    recordRoot,
    authoringRequestId: requestId,
    authoringAttemptId,
    grillSessionId: options.grillSessionId,
    decisionReceiptRefs: options.decisionReceiptRefs,
    activeAuthority,
    buildManifest,
    auditPacket,
    targetSource: authoringContext.targetSource,
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
    let scan = scanRequirementsContractConsumerAuthority({
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
    fs.mkdirSync(recordRoot, { recursive: true });
    scan = scanRequirementsContractConsumerAuthority({
      cwd: context.cwd,
      recordRoot,
      intakeSource,
      authoritySources,
    });
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
        requestId,
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
      const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
      if (fs.existsSync(requirementRecordPath)) {
        const requirementRecord = openRequirementsContractRecord(requirementRecordPath);
        const currentAuthority = requirementRecord.activeAuthority;
        const currentPromotionEvidence = requirementRecord.currentPromotionEvidence;
        const originalPromotionPath = path.join(
          recordRoot,
          'confirmation',
          'confirmation-promotion-receipt.json'
        );
        if (
          currentAuthority &&
          fs.existsSync(originalPromotionPath) &&
          currentPromotionEvidence?.path === 'confirmation/confirmation-promotion-receipt.json'
        ) {
          const originalPromotion = JSON.parse(fs.readFileSync(originalPromotionPath, 'utf8'));
          if (
            originalPromotion.bindingRevisionId !== currentAuthority.activeBindingRevisionId ||
            originalPromotion.sourceBindingHash !== currentAuthority.activeSourceBindingHash
          ) {
            const refreshedConfirmation = refreshRequirementsContractConfirmationBinding({
              projectRoot: context.cwd,
              requestId,
            });
            return cliContinuationResult({
              status: refreshedConfirmation.status,
              issueCode: 'requirements_user_confirmable',
              authoringRequestId: requestId,
              authoringAttemptId,
              unresolvedDecisionCount: refreshedConfirmation.unresolvedDecisionCount,
              confirmation: refreshedConfirmation.confirmation,
            });
          }
        }
      }
      const intakeSource = confinedPath(
        context.cwd,
        currentContext.intakeSource,
        'requirements_authoring_intake_source_invalid'
      );
      const scan = scanRequirementsContractConsumerAuthority({
        cwd: context.cwd,
        recordRoot,
        intakeSource,
        authoritySources: readRequirementsContractDeclaredAuthoritySources(intakeSource),
      });
      if (scan.conflicts.length > 0) throw new Error('requirements_authority_conflict');
      const requirementRecord = fs.existsSync(requirementRecordPath)
        ? openRequirementsContractRecord(requirementRecordPath)
        : null;
      const bindingRefreshRecovery =
        typeof requirementRecord?.activeOperationId === 'string' &&
        requirementRecord.activeOperationId.startsWith('BINDING-');
      if (
        scan.sourceList.sourceListHash === currentContext.authoritySourceListHash ||
        bindingRefreshRecovery
      ) {
        const currentAuthority = requirementRecord?.activeAuthority;
        if (currentAuthority) {
          const hasCurrentPromotionEvidence = Boolean(
            requirementRecord?.currentPromotionEvidence?.path
          );
          const currentManifest = readRequirementsActiveBuildManifest({
            recordRoot,
            activeAuthority: currentAuthority,
          });
          const currentBinding = resolveRequirementsActiveArtifact({
            recordRoot,
            activeAuthority: currentAuthority,
            role: 'source_binding',
          }).value;
          const semanticIr = resolveRequirementsContractSemanticIrAuthority(
            resolveRequirementsActiveArtifact({
              recordRoot,
              activeAuthority: currentAuthority,
              role: 'semantic_ir',
            }).value
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
              authoritySourceListHash: currentContext.authoritySourceListHash,
            },
            afterSemanticAuthority: {
              authoritySourceListHash: scan.sourceList.sourceListHash,
            },
            beforeLocatorHash,
            afterLocatorHash,
          });
          if (bindingRefreshRecovery && preflight.decision === 'no_change') {
            stageRequirementsContractConfirmationBindingRefresh({
              projectRoot: context.cwd,
              requestId,
              bindingRevisionId: currentBinding.bindingRevisionId,
            });
            const refreshedConfirmation = refreshRequirementsContractConfirmationBinding({
              projectRoot: context.cwd,
              requestId,
            });
            return cliContinuationResult({
              status: refreshedConfirmation.status,
              issueCode: 'requirements_user_confirmable',
              authoringRequestId: requestId,
              authoringAttemptId: requirementRecord.activeOperationId,
              unresolvedDecisionCount: refreshedConfirmation.unresolvedDecisionCount,
              confirmation: refreshedConfirmation.confirmation,
            });
          }
          if (
            preflight.decision === 'no_change' &&
            requirementRecord?.lifecycle === 'user_confirmed'
          ) {
            return cliContinuationResult({
              status: 'user_confirmed',
              issueCode: 'requirements_user_confirmed',
              authoringRequestId: requestId,
              authoringAttemptId,
              unresolvedDecisionCount: 0,
            });
          }
          if (preflight.decision !== 'refresh_binding') {
            return await continueAuthoringFromContext(context, currentContext);
          }
          const successorAttemptId = stableId('BINDING', {
            requestId,
            currentBuildHash: currentManifest.buildHash,
            sourceListHash: scan.sourceList.sourceListHash,
            locatorHash: afterLocatorHash,
          });
          const prepared = prepareContentAddressedProjectionSuccessor({
            recordRoot,
            requestId,
            operationId: successorAttemptId,
            semanticInputHash: scan.sourceList.sourceListHash,
            currentAuthority,
            semanticIr,
            sourceBinding: nextSourceBinding,
            resolvedEvidenceIndex: nextBinding.resolvedEvidenceIndex,
          });
          if (prepared.changedArtifacts.length === 0) {
            return await continueAuthoringFromContext(context, currentContext);
          }
          publishRequirementsContractDurableBuild({
            recordRoot,
            operationId: successorAttemptId,
            manifest: prepared.manifest,
            nextAuthority: prepared.nextAuthority,
            currentAuthority,
            expectedActiveAuthorityHash: requirementsContractDomainHash(
              'requirements-active-authority-cas/v1',
              currentAuthority
            ),
            compareAndSwapAuthorityTuple(current, next) {
              const latest = openRequirementsContractRecord(requirementRecordPath);
              if (sha256Stable(latest.activeAuthority) !== sha256Stable(current)) return false;
              writeJsonAtomic(requirementRecordPath, {
                ...latest,
                activeOperationId: successorAttemptId,
                activeAuthority: next,
              });
              return true;
            },
          });
          if (!hasCurrentPromotionEvidence) {
            return cliContinuationResult({
              status: 'audit_pending',
              issueCode: 'requirements_audit_pending',
              authoringRequestId: requestId,
              authoringAttemptId: successorAttemptId,
            });
          }
          stageRequirementsContractConfirmationBindingRefresh({
            projectRoot: context.cwd,
            requestId,
            bindingRevisionId: nextSourceBinding.bindingRevisionId,
          });
          const refreshedConfirmation = refreshRequirementsContractConfirmationBinding({
            projectRoot: context.cwd,
            requestId,
          });
          return cliContinuationResult({
            status: refreshedConfirmation.status,
            issueCode: 'requirements_user_confirmable',
            authoringRequestId: requestId,
            authoringAttemptId: successorAttemptId,
            unresolvedDecisionCount: refreshedConfirmation.unresolvedDecisionCount,
            confirmation: refreshedConfirmation.confirmation,
          });
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
        grillResolution: resolution,
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
