import { compileRequirementsContractCp02Candidate, type RequirementsContractCp02CompilerResult } from './requirements-contract-compiler';
import { createRequirementsContractSemanticIr, normalizeRequirementsContractSemanticIrAuthority, type RequirementsContractSemanticIr } from './requirements-contract-semantic-ir';
import { createRequirementsContractSourceBindingCapsule, createRequirementsContractResolvedEvidenceIndex,
  createTypedSourceBindings, assertTypedSourceBindingAuthority } from './requirements-contract-source-binding-capsule';
import { canonicalSourceSpanId } from './requirements-contract-span-registry';
import { resolveRequirementsProductionTechnicalPlanningCapability, resolveTypedTechnicalDeclarations,
  type RequirementsTechnicalPlanningCapabilityResult } from './requirements-contract-technical-planning-capability';
import { resolveTypedSourceAuthority, resolveTypedSourceActionOracle, createTypedSourceCoverage,
  assertTypedConfirmationProjection, type RequirementsTypedSourceAuthority } from './requirements-contract-typed-source-semantics';
import { selectRequirementsContractFrozenConfirmationSemantics } from './requirements-contract-confirmation-projection-facade';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import type { scanRequirementsContractConsumerAuthority } from './requirements-contract-consumer-authority-scanner';

type Scan = ReturnType<typeof scanRequirementsContractConsumerAuthority>;
type Decision = {
  id: string;
  decisionReceiptRef: string;
  affectedSourceRefs: string[];
  affectedRequirementIds: string[];
  affectedAtomIds: string[];
  authorityPremiseHashes: string[];
  [key: string]: unknown;
};
type CandidateInput = { authoringRequestId: string; scan: Scan; cp02Candidate: RequirementsContractCp02CompilerResult;
  capability: RequirementsTechnicalPlanningCapabilityResult; confirmedDecisions: Decision[];
  confirmationSemantics?: Record<string, unknown> };

export function deriveRequirementsTypedSourceConfirmationSemantics(authority: RequirementsTypedSourceAuthority) {
  const graph = resolveTypedSourceAuthority(authority);
  const works = new Map(graph.workDeclarations.map((work) => [String(work.id), work]));
  const actions = graph.sourceNodes.filter((node) => node.executionRole === 'action');
  const declarations = resolveTypedTechnicalDeclarations(authority);
  const requiredDeclarations = declarations.filter((entry) => entry.kind === 'CMD' && entry.modality === 'required' && entry.applicableSourceRefs!.length > 0);
  const commandsFor = (id: string) => requiredDeclarations.filter((entry) => entry.applicableSourceRefs!.includes(id)).map((entry) => entry.id);
  const evidence = actions.flatMap((node) => {
    const work = works.get(node.sourceRootId)!;
    return (Array.isArray(work.evidence) ? work.evidence : []).map((entry, index) => {
      const value = entry as Record<string, unknown>;
      if (typeof value.raw !== 'string' || !value.raw) throw new Error('requirements_typed_confirmation_evidence_invalid');
      return { id: `EVD-${node.sourceRootId}-${index + 1}`, text: value.raw, requiredCommandRefs: commandsFor(node.sourceRootId) };
    });
  });
  const evidenceRefs = (id: string) => evidence.filter((row) => row.id.startsWith(`EVD-${id}-`)).map((row) => row.id);
  const must = actions.map((node) => ({ id: node.sourceRootId, text: node.text,
    evidenceRefs: evidenceRefs(node.sourceRootId), coveredByTraceRows: [`TRACE-${node.sourceRootId}`],
    perMustOracle: resolveTypedSourceActionOracle(graph, node.sourceRootId) }));
  const implementationTasks = actions.map((node) => ({ id: `${node.sourceRootId}-A1`, title: node.text, requirementRefs: [node.sourceRootId],
    ...(node.taskExecution ? { taskExecution: structuredClone(node.taskExecution) } : {}),
    targetPaths: [...new Set(declarations.filter((entry) => entry.kind === 'PATH' && entry.applicableSourceRefs!.includes(node.sourceRootId))
      .map((entry) => entry.value))], traceRefs: [`TRACE-${node.sourceRootId}`], evidenceRefs: evidenceRefs(node.sourceRootId) }));
  const requiredCommands = requiredDeclarations.map((entry) => ({ id: entry.id,
    ...(entry.sourceDeclarationRefs?.[0] ? { commandRef: entry.sourceDeclarationRefs[0] } : {}), command: entry.value,
    purpose: `Source declaration ${entry.sourceDeclarationRefs!.join(', ')}: ${entry.value}`,
    traceRows: entry.applicableSourceRefs!.map((id) => `TRACE-${id}`),
    evidenceRefs: [...new Set(entry.applicableSourceRefs!.flatMap(evidenceRefs))] }));
  const traceRows = actions.map((node) => ({ id: `TRACE-${node.sourceRootId}`, covers: [node.sourceRootId],
    taskRefs: [`${node.sourceRootId}-A1`], evidenceRefs: evidenceRefs(node.sourceRootId), acceptanceRefs: [],
    contractValidationCommandRefs: [], deliveryEvidenceCommandRefs: commandsFor(node.sourceRootId), status: 'PENDING',
    blockingReason: 'Source-derived candidate has not received governed confirmation or execution evidence.' }));
  const projection = { typedSourceAuthority: authority, typedCoverage: createTypedSourceCoverage(authority),
    must, implementationTasks, evidence, traceRows, requiredCommands, suggestedCommands: [] };
  assertTypedConfirmationProjection(projection);
  return projection;
}

function frozenTypedConfirmationSemantics(authority: RequirementsTypedSourceAuthority, supplied?: Record<string, unknown>) {
  const derived = deriveRequirementsTypedSourceConfirmationSemantics(authority);
  const candidate = supplied ? { ...supplied, typedSourceAuthority: authority, typedCoverage: derived.typedCoverage } : derived;
  assertTypedConfirmationProjection(candidate);
  const frozen = selectRequirementsContractFrozenConfirmationSemantics(candidate);
  delete frozen.typedSourceAuthority;
  delete frozen.typedCoverage;
  return { ...frozen, typedSourceAuthorityRef: {
    schemaVersion: 'requirements-contract-typed-source-authority-ref/v2', graphHash: authority.graphHash },
    typedCoverageRef: { schemaVersion: 'requirements-contract-typed-source-coverage-ref/v2',
      graphHash: authority.graphHash, coverageHash: derived.typedCoverage.coverageHash } };
}

export function compileTypedSourceAtoms(scan: Scan) {
  if (!scan.typedSourceAuthority) throw new Error('requirements_typed_source_authority_missing');
  const graph = resolveTypedSourceAuthority(scan.typedSourceAuthority);
  const entries = resolveTypedTechnicalDeclarations(scan.typedSourceAuthority);
  const candidateById = new Map(scan.sourceRootCandidates.map((candidate) => [candidate.sourceRootId, candidate]));
  return graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => {
    const candidate = candidateById.get(node.sourceRootId)!;
    const binding = candidate.sourceBinding!;
    const sourceSpanRef = `${node.sourceRootId}:${binding.byteStart}-${binding.byteEnd}`;
    const work = graph.workDeclarations.find((declaration) => declaration.id === node.sourceRootId);
    if (!work || !Array.isArray(work.dependencies)) throw new Error('requirements_typed_action_dependencies_missing');
    return { atomId: `${node.sourceRootId}-A1`, action: node.text, oracle: resolveTypedSourceActionOracle(graph, node.sourceRootId),
      dependencies: work.dependencies.map((id) => `${String(id)}-A1`).sort(), coverageSeed: node.sourceRootId,
      originBindings: [{ sourceRootId: node.sourceRootId, sourceSpanRef }], authorityRefs: [node.sourceRootId], spanRefs: [sourceSpanRef],
      executionConstraintRefs: entries.filter((entry) => entry.applicableSourceRefs!.includes(node.sourceRootId))
        .map((entry) => `${entry.kind}:${entry.id}`).sort() };
  });
}

export function createTypedRequirementsSemanticIr(input: CandidateInput): RequirementsContractSemanticIr {
  const authority = input.scan.typedSourceAuthority;
  if (!authority || !input.capability.executionRegistry) throw new Error('requirements_typed_source_authority_missing');
  const graph = resolveTypedSourceAuthority(authority);
  const requirements = graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => ({
    id: node.sourceRootId, text: node.text, oracle: resolveTypedSourceActionOracle(graph, node.sourceRootId),
    requirementKind: 'functional', polarity: 'positive', executionRole: 'action',
  }));
  const constraints = input.capability.executionRegistry.entries.map((entry) => ({
    constraintId: entry.id, kind: entry.kind, canonicalValue: entry.value,
    applicableMustRefs: entry.applicableSourceRefs!, applicableAtomRefs: entry.applicableSourceRefs!.map((id) => `${id}-A1`),
    premiseRefs: entry.premiseRefs!, derivationReceiptRefs: entry.derivationReceiptRefs!,
    disposition: 'proven' as const, authorityKind: entry.authorityKind!, applicableSourceRefs: entry.applicableSourceRefs!,
    conditions: entry.conditions!, scope: entry.scope!, modality: entry.modality!, sourceDeclarationRefs: entry.sourceDeclarationRefs!,
  }));
  const constraintIds = new Map(input.capability.executionRegistry.entries.map((entry) => [`${entry.kind}:${entry.id}`, entry.id]));
  const atoms = input.cp02Candidate.atoms.map((atom) => ({ id: atom.atomId, action: atom.action, oracle: atom.oracle,
    requirementRef: atom.authorityRefs[0], dependencies: atom.dependencies, authorityRefs: atom.authorityRefs,
    executionConstraintRefs: atom.executionConstraintRefs.map((ref) => constraintIds.get(ref)!).sort() }));
  const sourceClaim = { evidenceClaimId: 'EVIDENCE-CLAIM-TYPED-SOURCE-GRAPH', authorityClass: 'source_grounded' as const,
    normalizedClaimHash: authority.graphHash, sourceEvidenceRequired: true, decisionReceiptRefs: [], premiseRefs: [], derivationReceiptRefs: [] };
  const sourceSpan = { authorityClass: 'source_grounded' as const, normalizedClaimHash: authority.graphHash,
    boundSemanticNodeIds: [...requirements.map((node) => node.id), ...atoms.map((atom) => atom.id)],
    boundObligationIds: requirements.map((node) => node.id), boundTypedSourceGraphHash: authority.graphHash,
    evidenceClaimRefs: [sourceClaim.evidenceClaimId],
    decisionReceiptRefs: [], derivationReceiptRefs: [] };
  const decisionClaims = input.confirmedDecisions.map((decision) => ({ evidenceClaimId: `EVIDENCE-CLAIM-${decision.id}`,
    authorityClass: 'human_confirmed' as const, normalizedClaimHash: sha256Stable(decision),
    decisionReceiptRefs: [String(decision.decisionReceiptRef)], premiseRefs: [], derivationReceiptRefs: [] }));
  const decisionSpans = input.confirmedDecisions.map((decision, index) => ({ authorityClass: 'human_confirmed' as const,
    normalizedClaimHash: decisionClaims[index].normalizedClaimHash,
    boundSemanticNodeIds: [...new Set([String(decision.id), ...decision.affectedSourceRefs,
      ...decision.affectedRequirementIds, ...decision.affectedAtomIds])],
    boundObligationIds: decision.affectedSourceRefs as string[], evidenceClaimRefs: [decisionClaims[index].evidenceClaimId],
    decisionReceiptRefs: [String(decision.decisionReceiptRef)], derivationReceiptRefs: [] }));
  return createRequirementsContractSemanticIr({ recordId: input.authoringRequestId, requestId: input.authoringRequestId,
    parentSemanticRevisionId: null, compilerVersion: 'requirements-contract-cp02-compiler/v2',
    semantics: { schemaVersion: 'requirements-contract-typed-source-semantics/v2', typedSourceAuthority: authority,
      typedCoverage: createTypedSourceCoverage(authority), requirements, atoms, decisions: input.confirmedDecisions,
      implementationConfirmation: frozenTypedConfirmationSemantics(authority, input.confirmationSemantics) },
    evidenceClaims: [sourceClaim, ...decisionClaims], specSpanRegistry: [sourceSpan, ...decisionSpans], executionConstraints: constraints,
    semanticProvenance: { typedSourceGraph: authority.graphHash, ...Object.fromEntries(input.confirmedDecisions.map((decision) => [decision.id, decision.decisionReceiptRef])) } });
}

export function createTypedRequirementsSourceBinding(input: { authoringRequestId: string; scan: Scan;
  semanticIr: RequirementsContractSemanticIr; parentBindingRevisionId?: string }) {
  if (!input.scan.typedSourceAuthority || !input.scan.sourceArtifacts) throw new Error('requirements_typed_source_authority_missing');
  const sourceArtifacts = input.scan.sourceArtifacts.map((artifact, index) => ({ sourceArtifactId: artifact.artifactId,
    role: 'typed_source_authority', mediaType: 'text/markdown', sourceSnapshotHash: `sha256:${artifact.sha256}`,
    orderedPosition: index, immutableBlobRef: artifact.path }));
  const artifactById = new Map(sourceArtifacts.map((artifact) => [artifact.sourceArtifactId, artifact]));
  const nodeBindings: Array<{ sourceRootId: string; sourceSpanId: string; sourceBinding: Record<string, unknown> }> = [];
  const mappedSpans = input.scan.sourceRootCandidates.map((candidate) => {
    const raw = Buffer.from(candidate.sourceContent, 'utf8');
    const binding = candidate.sourceBinding!;
    const before = raw.subarray(0, binding.byteStart).toString('utf8');
    const through = raw.subarray(0, binding.byteEnd).toString('utf8');
    const excerpt = raw.subarray(binding.byteStart, binding.byteEnd).toString('utf8');
    if (excerpt !== candidate.semanticBody.text) throw new Error('requirements_typed_binding_exact_text_mismatch');
    const artifact = artifactById.get(binding.sourceArtifactRef)!;
    const span = { sourceArtifactId: artifact.sourceArtifactId, sourceSnapshotHash: artifact.sourceSnapshotHash,
      startByte: binding.byteStart, endByteExclusive: binding.byteEnd,
      startLine: before.split(/\r\n?|\n/u).length, startColumn: before.split(/\r\n?|\n/u).at(-1)!.length + 1,
      endLine: through.split(/\r\n?|\n/u).length, endColumn: through.split(/\r\n?|\n/u).at(-1)!.length + 1,
      exactTextHash: sha256Stable({ domain: 'requirements-source-exact-text/v1', content: excerpt }),
      normalizedTextHash: sha256Stable({ domain: 'requirements-source-normalized-text/v1', content: excerpt.replace(/\r\n?/gu, '\n').normalize('NFC') }),
      structuralAnchor: `${artifact.sourceArtifactId}:${binding.byteStart}-${binding.byteEnd}` };
    const sourceSpanId = canonicalSourceSpanId(span);
    nodeBindings.push({ sourceRootId: candidate.sourceRootId, sourceSpanId, sourceBinding: binding });
    return { ...span, sourceSpanId };
  });
  const sourceSpans = [...new Map(mappedSpans.map((span) => [span.sourceSpanId, span])).values()];
  const evidenceClaimBindings = input.semanticIr.semanticPayload.evidenceClaims.map((claim) => ({ evidenceClaimId: claim.evidenceClaimId,
    specSpanId: input.semanticIr.semanticPayload.specSpanRegistry.find((span) => span.evidenceClaimRefs.includes(claim.evidenceClaimId))!.specSpanId,
    authorityClass: claim.authorityClass, sourceSpanRefs: claim.authorityClass === 'source_grounded' ? sourceSpans.map((span) => span.sourceSpanId) : [] }));
  const sourceBinding = createRequirementsContractSourceBindingCapsule({ recordId: input.authoringRequestId,
    semanticRevisionId: input.semanticIr.semanticRevisionId, scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    parentBindingRevisionId: input.parentBindingRevisionId ?? null, resolverIdentity: 'requirements-contract-consumer-authority-scanner/v2',
    sourceArtifacts, sourceSpans, evidenceClaimBindings,
    typedSourceBindings: createTypedSourceBindings(input.scan.typedSourceAuthority.graphHash, { artifacts: input.scan.sourceArtifacts,
      nodes: nodeBindings, relations: input.scan.sourceRelationBindings!, contexts: input.scan.sourceContextBindings! }) });
  assertTypedSourceBindingAuthority(sourceBinding, input.scan.typedSourceAuthority);
  const resolvedEvidenceIndex = createRequirementsContractResolvedEvidenceIndex({ semanticRevisionId: input.semanticIr.semanticRevisionId,
    bindingRevisionId: sourceBinding.bindingRevisionId, sourceBindingHash: sourceBinding.sourceBindingHash,
    resolutions: input.semanticIr.semanticPayload.evidenceClaims.map((claim, index) => ({ evidenceClaimId: claim.evidenceClaimId,
      authorityClass: claim.authorityClass, sourceSpanRefs: evidenceClaimBindings[index].sourceSpanRefs,
      decisionReceiptRefs: claim.decisionReceiptRefs, premiseRefs: claim.premiseRefs, derivationReceiptRefs: claim.derivationReceiptRefs })) });
  return { sourceBinding, resolvedEvidenceIndex };
}

export function compileRequirementsTypedSourceCandidate(input: { scan: Scan; authoringRequestId: string;
  authoringAttemptId: string; confirmedDecisions?: Decision[]; confirmationSemantics?: Record<string, unknown> }) {
  if (!input.scan.typedSourceAuthority) throw new Error('requirements_typed_source_authority_missing');
  const capability = resolveRequirementsProductionTechnicalPlanningCapability({ authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId, premiseHash: input.scan.sourceList.sourceListHash,
    sourceRootCandidates: input.scan.sourceRootCandidates, typedSourceAuthority: input.scan.typedSourceAuthority });
  const atoms = compileTypedSourceAtoms(input.scan);
  const confirmedDecisions = input.confirmedDecisions ?? [];
  const cp02Candidate = compileRequirementsContractCp02Candidate({ authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId, atoms, technicalPlanning: capability,
    typedSourceIds: input.scan.sourceRootCandidates.map((candidate) => candidate.sourceRootId),
    decisions: confirmedDecisions.map((decision) => ({ decisionId: decision.id,
      affectedAtomIds: decision.affectedAtomIds, affectedSourceRefs: decision.affectedSourceRefs,
      authorityPremiseHashes: decision.authorityPremiseHashes })) });
  if (cp02Candidate.status !== 'closed') throw new Error(cp02Candidate.issueCodes[0] ?? 'requirements_typed_cp02_not_closed');
  const semanticIr = createTypedRequirementsSemanticIr({ ...input, cp02Candidate, capability, confirmedDecisions });
  return { cp02Candidate, capability, semanticIr, semanticIrAuthority: normalizeRequirementsContractSemanticIrAuthority(semanticIr),
    ...createTypedRequirementsSourceBinding({ ...input, semanticIr }) };
}
