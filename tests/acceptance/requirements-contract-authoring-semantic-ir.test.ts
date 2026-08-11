import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractSemanticIr,
  validateRequirementsContractSemanticIr,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import {
  artifactBytesHash,
  bindingRevisionId,
  judgeRequestHash,
  scopeSemanticHash,
  semanticRevisionId,
  sourceBindingHash,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function semanticInput() {
  return {
    recordId: 'REQ-001',
    requestId: 'AUTHORING-001',
    parentSemanticRevisionId: null,
    compilerVersion: 'compiler/v1',
    semantics: {
      musts: [{ id: 'MUST-001', text: 'Persist the approved scope.' }],
      obligations: [{ id: 'OBL-001', semanticNodeRefs: ['MUST-001'] }],
    },
    evidenceClaims: [{
      evidenceClaimId: 'CLAIM-001',
      authorityClass: 'source_grounded' as const,
      normalizedClaimHash: hash('1'),
      sourceEvidenceRequired: true,
      decisionReceiptRefs: [],
      premiseRefs: [],
      derivationReceiptRefs: [],
    }],
    specSpanRegistry: [{
      authorityClass: 'source_grounded' as const,
      normalizedClaimHash: hash('1'),
      boundSemanticNodeIds: ['MUST-001'],
      boundObligationIds: ['OBL-001'],
      evidenceClaimRefs: ['CLAIM-001'],
      decisionReceiptRefs: [],
      derivationReceiptRefs: [],
    }],
    executionConstraints: [{
      constraintId: 'PATH-001',
      kind: 'PATH' as const,
      canonicalValue: 'src/**',
      applicableMustRefs: ['MUST-001'],
      applicableAtomRefs: [],
      premiseRefs: ['repo-policy:source-root'],
      derivationReceiptRefs: ['receipt:path-001'],
      disposition: 'proven' as const,
    }],
    semanticProvenance: {
      parserIdentity: 'parser/v1',
      compilerIdentity: 'compiler/v1',
      policyIdentity: 'policy/v1',
      authorityClassIdentity: 'requirements-authority-class/v1',
    },
  };
}

describe('requirements semantic IR authority', () => {
  it('freezes semantic identity without physical binding data', () => {
    const ir = createRequirementsContractSemanticIr(semanticInput());
    expect(validateRequirementsContractSemanticIr(ir)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(ir.schemaVersion).toBe('requirements-contract-semantic-ir/v1');
    expect(ir.scopeSemanticHash).toBe(scopeSemanticHash(ir.semanticPayload));
    expect(ir.semanticRevisionId).toBe(semanticRevisionId({
      recordId: ir.recordId,
      parentSemanticRevisionId: ir.parentSemanticRevisionId,
      scopeSemanticHash: ir.scopeSemanticHash,
      compilerVersion: ir.compilerVersion,
    }));
    expect(JSON.stringify(ir)).not.toMatch(/sourceBindingHash|sourceSnapshotHash|startByte|sourcePath/);
  });

  it('keeps semantic, binding, lineage, bytes and Judge domains distinct', () => {
    const payload = { musts: [{ id: 'MUST-001', text: 'same' }] };
    const semanticHash = scopeSemanticHash(payload);
    const bindingHash = sourceBindingHash({ snapshot: hash('2'), startByte: 0 });
    expect(new Set([
      semanticHash,
      bindingHash,
      semanticRevisionId({ recordId: 'REQ-001', parentSemanticRevisionId: null, scopeSemanticHash: semanticHash, compilerVersion: 'compiler/v1' }),
      bindingRevisionId({ recordId: 'REQ-001', semanticRevisionId: 'SEM-001', parentBindingRevisionId: null, sourceBindingHash: bindingHash }),
      artifactBytesHash({ role: 'semantic_ir', mediaType: 'application/json', bytes: Buffer.from('{}\n') }),
      judgeRequestHash({ schemaVersion: 'requirements-contract-judge-request/v2', judgeProfile: 'strict', packetHash: hash('3') }),
    ]).size).toBe(6);
  });

  it('fails closed for physical locators and legacy ordinal span identities', () => {
    const invalid = { ...semanticInput(), sourceBindingHash: hash('2') };
    expect(validateRequirementsContractSemanticIr(invalid).issueCodes).toContain('semantic_ir_physical_binding_forbidden');
    const legacy = semanticInput();
    legacy.specSpanRegistry[0]!.specSpanId = 'SOURCE-SPAN-001';
    expect(() => createRequirementsContractSemanticIr(legacy)).toThrow('legacy_source_span_identity_forbidden');
  });
});
