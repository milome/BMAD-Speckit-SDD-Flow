import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanRequirementsContractConsumerAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-consumer-authority-scanner';
import { resolveRequirementsProductionTechnicalPlanningCapability } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-technical-planning-capability';
import { createExecutionConstraintRegistry, createRequirementsContractSemanticIr, validateExecutionConstraintRegistry, validateRequirementsContractSemanticIr,
  resolveRequirementsContractSemanticIrAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { createFullSourceBundle, createSmallBundle, hash, SOURCE_HASH } from '../helpers/source-authority-full-source';
import { stableStringify } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileRequirementsTypedSourceCandidate, deriveRequirementsTypedSourceConfirmationSemantics } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-compiler';
import { resolveTypedSourceAuthority, resolveTypedSourceCoverage } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { resolveTypedSourceBindings, validateRequirementsContractSourceBindingCapsule, assertTypedSourceBindingAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';
import { buildCanonicalFrozenRequirementsCompilerInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-canonical-compiler-input';
import { prepareRequirementsContractCp05Cp08Projection, projectRequirementsContractCp06ExecutionManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp05-cp08';
import { resolveRequirementsContractJudgeAuditPacket, validateRequirementsContractJudgeAuditPacketCoverage } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-packet';
import { createSourceSpanRegistry, expandRequirementsTypedSpecSpans, resolveRequirementsSpecSpanSourceNodeIds } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-span-registry';
import { prepareRequirementsContractCp04FreezeStage } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateRequirementsContractCp02AtomicClosure } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp00-cp04';
import { measureFullSourceRequirementsJudgePreflight } from '../helpers/source-authority-full-source-preflight';
import { canonicalJson, sha256 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

describe('full source Requirements authority input, test-only without confirmation or Judge', () => {
  it('counts source documents, not typed child declarations, against the unchanged 128-file budget', () => {
    const fixture = createSmallBundle(129);
    try {
      const scanned = scanRequirementsContractConsumerAuthority({ cwd: fixture.root,
        intakeSource: fixture.intakeSource, authoritySources: fixture.authoritySources });
      expect(scanned.sourceList.entries).toHaveLength(1);
      expect(scanned.sourceRootCandidates).toHaveLength(129);
      expect(scanned.sourceRootCandidates.map((candidate) => candidate.semanticBody))
        .toEqual(fixture.sourceRoots.map((candidate) => candidate.semanticBody));
      expect(scanned.sourceRootCandidates.filter((candidate) => candidate.semanticBody.executionRole === 'action')).toHaveLength(1);
      expect(existsSync(path.join(fixture.root, '_bmad-output'))).toBe(false);
    } finally { rmSync(fixture.root, { recursive: true, force: true }); }
  });

  it('preserves every independent real-source clause, declaration, condition and relation in bounded section bundles', () => {
    const fixture = createFullSourceBundle();
    try {
      expect(fixture.authoritySources.length).toBeLessThan(128);
      expect(fixture.fileBytes.every((bytes) => bytes <= 1048576)).toBe(true);
      expect(hash(readFileSync(path.join(fixture.root, 'inputs/raw-source.md')))).toBe(SOURCE_HASH);
      const scanned = scanRequirementsContractConsumerAuthority({ cwd: fixture.root,
        intakeSource: fixture.intakeSource, authoritySources: fixture.authoritySources }) as any;
      const wanted = new Map(fixture.sourceRoots.map((child) => [child.sourceRootId, child.semanticBody]));
      const actual = new Map(scanned.sourceRootCandidates.map((child: any) => [child.sourceRootId, child.semanticBody]));
      expect(actual).toEqual(wanted);
      expect(JSON.stringify([...actual.values()])).not.toMatch(/"(?:sourceBinding|sourcePath|byteStart|byteEnd)":/u);
      expect(scanned.sourceRootCandidates.map((child: any) => child.sourceBinding))
        .toEqual(fixture.sourceRoots.map((child) => child.sourceBinding));
      expect(scanned.sourceRootCandidates.filter((child: any) => child.semanticBody.executionRole === 'action')
        .map((child: any) => child.sourceRootId).sort()).toEqual(fixture.expected.sections.flatMap((section: any) => section.works).map((work: any) => work.id).sort());
      expect(scanned.sourceRootCandidates.filter((child: any) => child.semanticBody.executionRole === 'definition')).toHaveLength(277);
      expect(scanned.sourceRootCandidates.filter((child: any) => child.semanticBody.sourceClauseId)).toHaveLength(2241);
      expect([...new Set(scanned.sourceRootCandidates.flatMap((child: any) => child.semanticBody.declaredIds || []))].sort())
        .toEqual([...new Set(fixture.declaredIds)].sort());
      const order = (rows: any[]) => rows.map((row) => stableStringify(row)).sort();
      const lineByRelation = new Map(scanned.sourceRelationBindings.map((binding: any) => [binding.relationId, binding.sourceLine]));
      expect(order(scanned.sourceRelations.map(({ relationId, ...relation }: any) => ({ ...relation,
        ...(lineByRelation.has(relationId) ? { sourceLine: lineByRelation.get(relationId) } : {}) }))))
        .toEqual(order(fixture.sourceRelations));
      const compiled = compileRequirementsTypedSourceCandidate({ scan: scanned,
        authoringRequestId: 'TEST-ONLY-FULL-SOURCE', authoringAttemptId: 'TEST-ONLY-ATTEMPT' });
      expect(compiled.cp02Candidate.status).toBe('closed');
      expect(compiled.cp02Candidate.schemaVersion).toBe('requirements-contract-cp02-candidate/v2');
      expect(compiled.cp02Candidate.atoms).toHaveLength(16);
      expect(compiled.semanticIr.schemaVersion).toBe('requirements-contract-semantic-ir/v2');
      expect(compiled.semanticIrAuthority.schemaVersion).toBe('RequirementsSemanticCandidate/v2');
      expect(Buffer.byteLength(JSON.stringify(compiled.semanticIrAuthority), 'utf8')).toBeLessThanOrEqual(1048576);
      expect(resolveRequirementsContractSemanticIrAuthority(JSON.parse(JSON.stringify(compiled.semanticIrAuthority)))).toEqual(compiled.semanticIr);
      expect(() => resolveRequirementsContractSemanticIrAuthority(compiled.semanticIr)).toThrow('requirements_semantic_authority_candidate_required');
      const authority = compiled.semanticIr.semanticPayload.semantics.typedSourceAuthority as any;
      const graph = resolveTypedSourceAuthority(authority);
      expect(graph.sourceNodes).toHaveLength(2534);
      expect(graph.sourceRelations).toHaveLength(2778);
      expect(graph.commandDeclarations).toHaveLength(97);
      const sourceGroup = compiled.semanticIr.semanticPayload.specSpanRegistry.find((span) => span.boundTypedSourceGraphHash)!;
      const actionNodeIds = graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId);
      expect(resolveRequirementsSpecSpanSourceNodeIds(sourceGroup, authority)).toEqual(actionNodeIds);
      const expandedSourceGroups = expandRequirementsTypedSpecSpans([sourceGroup], authority);
      expect(expandedSourceGroups).toHaveLength(graph.sourceNodes.length);
      expect(expandedSourceGroups.every((span) => span.originSpecSpanRef === sourceGroup.specSpanId)).toBe(true);
      expect(expandedSourceGroups.flatMap((span) => resolveRequirementsSpecSpanSourceNodeIds(span, authority, graph)).sort())
        .toEqual(graph.sourceNodes.map((node) => node.sourceRootId).sort());
      expect(() => resolveRequirementsSpecSpanSourceNodeIds(sourceGroup)).toThrow('requirements_spec_span_typed_graph_binding_invalid');
      expect(() => resolveRequirementsSpecSpanSourceNodeIds({ ...sourceGroup, boundObligationIds: ['WORK-01'] }, authority))
        .toThrow('requirements_spec_span_typed_direct_projection_mismatch');
      expect(resolveTypedSourceCoverage(compiled.semanticIr.semanticPayload.semantics.typedCoverage, authority).nodes).toHaveLength(2534);
      expect(validateRequirementsContractSourceBindingCapsule(compiled.sourceBinding).decision).toBe('pass');
      expect(resolveTypedSourceBindings(compiled.sourceBinding.typedSourceBindings!).nodes.map((node) => node.sourceBinding))
        .toEqual(fixture.sourceRoots.map((node) => node.sourceBinding));
      const contextBindings = resolveTypedSourceBindings(compiled.sourceBinding.typedSourceBindings!).contexts;
      expect(contextBindings.filter((binding) => /^\/sourceBlocks\/\d+\/source$/u.test(String(binding.fieldRef)))).toHaveLength(2486);
      expect(new Set(contextBindings.map((binding) => binding.fieldRef)).size).toBe(contextBindings.length);
      const canonical = buildCanonicalFrozenRequirementsCompilerInput(compiled);
      expect(canonical.semantic.source).toBe('requirements-contract-semantic-ir/v2');
      expect(canonical.binding.source).toBe('requirements-contract-source-binding/v2');
      const cp04 = prepareRequirementsContractCp04FreezeStage({ semanticIr: compiled.semanticIr as unknown as Record<string, unknown>,
        sourceBinding: compiled.sourceBinding as unknown as Record<string, unknown>,
        resolvedEvidenceIndex: compiled.resolvedEvidenceIndex as unknown as Record<string, unknown> });
      expect(cp04.semanticIrAuthority).toEqual(compiled.semanticIrAuthority);
      expect(cp04.semanticIr).toEqual(compiled.semanticIr);
      const projection = projectRequirementsContractCp06ExecutionManifest({ checkpointId: 'cp04', checkpointStatus: 'passed',
        readbackVerified: true, semanticIr: compiled.semanticIr,
        requiredConstraintIds: compiled.semanticIr.semanticPayload.executionConstraints.map((entry) => entry.constraintId) });
      expect(projection.decision).toBe('pass');
      expect(projection.executionManifest.schemaVersion).toBe('requirements-contract-execution-manifest/v2');
      expect(projection.executionManifest.constraints).toEqual(compiled.semanticIr.semanticPayload.executionConstraints);
      const native = prepareRequirementsContractCp05Cp08Projection(compiled);
      expect(native.serializedBytes).toBeLessThanOrEqual(1048576);
      const decodedPacket = resolveRequirementsContractJudgeAuditPacket(JSON.parse(native.auditPacketBuild.serializedPacket));
      expect((decodedPacket.body as any).semanticIr).toEqual(compiled.semanticIr);
      const artifactGroups = (decodedPacket.body as any).artifactPayloadGroups;
      expect(artifactGroups.find((group: any) => group.artifactIds.includes('final-markdown')).payload).toBe(native.markdown);
      expect(artifactGroups.find((group: any) => group.artifactIds.includes('confirmation-projection')).payload).toEqual(native.cp05Projection);
      expect(validateRequirementsContractJudgeAuditPacketCoverage({ packet: native.auditPacket,
        expectedArtifactIds: native.coverageManifest.artifactIds as string[] }).decision).toBe('pass');
      const alteredPacket = structuredClone(native.auditPacket) as any;
      alteredPacket.body.requirementIds = [];
      const { packetHash: _ignoredPacketHash, ...alteredPayload } = alteredPacket;
      alteredPacket.packetHash = sha256(canonicalJson(alteredPayload));
      expect(() => resolveRequirementsContractJudgeAuditPacket(alteredPacket)).toThrow('requirements_judge_audit_packet_header_mismatch');
      const preflight = measureFullSourceRequirementsJudgePreflight({ root: fixture.root, compiled, native });
      expect(preflight.dispatchCount).toBe(0);
      expect(preflight.rows).toHaveLength(4);
      for (const row of preflight.rows) {
        expect(row.error, row.adapterId).toBeNull();
        expect(row.requestBytes).toBeLessThanOrEqual(1048576);
        expect(row.totalBytes).toBeLessThanOrEqual(1048576);
      }
      expect(existsSync(path.join(fixture.root, 'TEST-ONLY'))).toBe(false);
      const confirmation = deriveRequirementsTypedSourceConfirmationSemantics(authority);
      expect(confirmation.must.map((row) => row.id)).toEqual(graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId));
      expect(Object.keys(confirmation)).not.toContain('status');
      const frozen = compiled.semanticIr.semanticPayload.semantics.implementationConfirmation as any;
      expect(frozen.typedSourceAuthority).toBeUndefined();
      expect(frozen.typedSourceAuthorityRef.graphHash).toBe(authority.graphHash);
      const ajv = new Ajv2020({ strict: false, allErrors: true });
      const schemaDirectory = path.resolve('packages/bmad-speckit/src/main-agent/source-authority/schemas');
      ajv.addSchema(JSON.parse(readFileSync(path.join(schemaDirectory, 'requirements-contract-source-node.schema.json'), 'utf8')));
      for (const [schemaFile, value] of [
        ['requirements-contract-semantic-candidate.schema.json', compiled.semanticIrAuthority],
        ['requirements-contract-semantic-ir.schema.json', compiled.semanticIr],
        ['requirements-contract-source-binding.schema.json', compiled.sourceBinding],
        ['requirements-contract-technical-planning-capability.schema.json', compiled.capability],
      ] as const) {
        const validate = ajv.compile(JSON.parse(readFileSync(path.join(schemaDirectory, schemaFile), 'utf8')));
        expect(validate(value), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
      }
      const tampered = structuredClone(compiled.semanticIr);
      tampered.semanticPayload.executionConstraints[0].applicableAtomRefs = [];
      expect(validateRequirementsContractSemanticIr(tampered).decision).toBe('block');
      const badBinding = structuredClone(compiled.sourceBinding);
      badBinding.sourceSpanRegistry[0].exactTextHash = `sha256:${'f'.repeat(64)}`;
      expect(() => assertTypedSourceBindingAuthority(badBinding, authority)).toThrow('typed_source_bindings_claim_text_mismatch');
      expect(existsSync(path.join(fixture.root, '_bmad-output'))).toBe(false);
    } finally { rmSync(fixture.root, { recursive: true, force: true }); }
  }, 420_000);

  it('rejects typed child content hidden in a legacy v1 source instead of silently dropping it', () => {
    const fixture = createSmallBundle(2);
    try {
      writeFileSync(path.join(fixture.root, 'inputs/authority.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1', sourceRootId: 'MUST-PARENT-01',
        semanticBody: { text: 'Preserve both child clauses.', sourceRoots: fixture.sourceRoots },
      }), 'utf8');
      expect(() => scanRequirementsContractConsumerAuthority({ cwd: fixture.root, intakeSource: fixture.intakeSource,
        authoritySources: [{ path: 'inputs/authority.json', rootClass: 'functional_requirement',
          proposedAuthorityClass: 'source_authority', bodySchemaVersion: 'requirement-contract-requirement/v2' }] }))
        .toThrow('requirements_authority_typed_bundle_version_required');
    } finally { rmSync(fixture.root, { recursive: true, force: true }); }
  });

  it('preserves source-declared constraint ownership and binds it into the technical registry identity', () => {
    const constraint = (owner: string) => ({ kind: 'CMD', id: 'CMD-VERIFY-01', value: 'npm test',
      authorityKind: 'source_declared', applicableSourceRefs: [owner], premiseRefs: ['SOURCE-CMD-01'],
      derivationReceiptRefs: [], scope: { kind: 'task', ownerId: owner }, conditions: ['after implementation'] });
    const resolve = (owner: string) => resolveRequirementsProductionTechnicalPlanningCapability({
      authoringRequestId: 'TEST-ONLY-REQUEST', authoringAttemptId: 'TEST-ONLY-ATTEMPT',
      premiseHash: `sha256:${'a'.repeat(64)}`,
      sourceRootCandidates: [{ sourceRootId: 'SOURCE-CMD-01', semanticBody: {
        schemaVersion: 'requirements-contract-source-node/v2', executionRole: 'binding',
        executionConstraints: [constraint(owner)],
      } }],
    });
    const first = resolve('WORK-001');
    const second = resolve('WORK-002');
    expect(first.executionRegistry?.entries).toEqual([constraint('WORK-001')]);
    expect(first.executionRegistry?.registryHash).not.toBe(second.executionRegistry?.registryHash);
  });

  it('does not accept derived proven status from a nonempty premise list alone', () => {
    const registry = createExecutionConstraintRegistry([{
      constraintId: 'CMD-UNPROVED-01', kind: 'CMD', canonicalValue: 'npm test',
      applicableMustRefs: ['REQ-001'], applicableAtomRefs: ['ATOM-001'], premiseRefs: ['REQ-001'],
      derivationReceiptRefs: [], disposition: 'proven', authorityKind: 'derived',
    } as any]);
    const validation = validateExecutionConstraintRegistry(registry);
    expect(validation.decision).toBe('block');
    expect(validation.issueCodes).toContain('execution_constraint_proven_derivation_missing');
  });

  it('rejects an execution atom promoted from a typed non-action source node', () => {
    expect(() => createRequirementsContractSemanticIr({
      recordId: 'TEST-ONLY-RECORD', requestId: 'TEST-ONLY-REQUEST', parentSemanticRevisionId: null,
      compilerVersion: 'requirements-source-compiler/v2',
      semantics: { schemaVersion: 'requirements-contract-typed-source-semantics/v2',
        sourceNodes: [{ sourceRootId: 'BOUNDARY-001', executionRole: 'boundary',
          text: 'Do not invoke a live business command.', polarity: 'forbidden', normativeStrength: 'must' }],
        sourceRelations: [], requirements: [], decisions: [],
        atoms: [{ atomId: 'ATOM-BOUNDARY-001', sourceRootId: 'BOUNDARY-001', action: 'Do not invoke a live business command.' }],
      },
      evidenceClaims: [], specSpanRegistry: [], executionConstraints: [], semanticProvenance: {},
    })).toThrow('requirements_semantic_atom_source_role_invalid');
  });

  it('preserves the frozen numeric canonical hex span ID instead of treating it as legacy sequential data', () => {
    const span = { sourceArtifactId: 'raw-source', sourceSnapshotHash: `sha256:${SOURCE_HASH}`,
      startByte: 191548, endByteExclusive: 191588, startLine: 2387, startColumn: 95, endLine: 2387, endColumn: 113,
      exactTextHash: 'sha256:e9deaab6b36d098688811213b56404a6fdaf0604d28a5735e4f4238d756471af',
      normalizedTextHash: 'sha256:1b9760c7b6e9e46434a7ecbef69d8c27b0b28d6c569fe4da2be42c8af7535f92',
      structuralAnchor: 'raw-source:191548-191588', sourceSpanId: 'SOURCE-SPAN-26986705256707780563' };
    expect(createSourceSpanRegistry([span])[0]).toEqual(span);
    expect(() => createSourceSpanRegistry([{ ...span, sourceSpanId: 'SOURCE-SPAN-123' }])).toThrow();
  });

  it('keeps non-action decisions bound to typed sources without fabricating an affected atom', () => {
    const base = { atoms: [{ atomId: 'WORK-01-A1', action: 'Perform source work', oracle: 'Source oracle',
      dependencies: [], coverageSeed: 'WORK-01', originBindings: [{ sourceRootId: 'WORK-01', sourceSpanRef: 'source:1-2' }],
      authorityRefs: ['WORK-01'], spanRefs: ['source:1-2'], executionConstraintRefs: ['PATH:path-1'] }],
      executionRegistry: { entries: [{ id: 'path-1', kind: 'PATH', value: 'src/work.ts' }] },
      decisions: [{ decisionId: 'TEST-ONLY-DECISION', affectedAtomIds: [], affectedSourceRefs: ['BOUNDARY-01'],
        authorityPremiseHashes: [`sha256:${'a'.repeat(64)}`] }] };
    expect(validateRequirementsContractCp02AtomicClosure({ ...base, typedSourceIds: ['WORK-01', 'BOUNDARY-01'] }).decision).toBe('pass');
    expect(validateRequirementsContractCp02AtomicClosure(base).decision).toBe('block');
    expect(validateRequirementsContractCp02AtomicClosure({ ...base, typedSourceIds: ['WORK-01'] }).issueCodes)
      .toContain('requirements_cp02_decision_source_binding_invalid');
  });
});
