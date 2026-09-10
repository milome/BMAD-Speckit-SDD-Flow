import { describe, expect, it } from 'vitest';
import { encodeGoalSemanticDictionary, encodeGoalSemanticDictionaryForEncoding,
  decodeGoalSemanticDictionary } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';
import { expandRequirementsTypedDictionaries, restoreRequirementsTypedDictionaries } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-dictionary-expansion';
import { buildRequirementsContractJudgeAuditPacket, resolveRequirementsContractJudgeAuditPacket,
  transformRequirementsAuditSourceSpanReferences } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-packet';
import { canonicalJson, sha256 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

function sample() {
  return {
    typedSourceAuthority: { schemaVersion: 'requirements-contract-typed-source-authority/v2',
      graph: encodeGoalSemanticDictionary({ sourceNodes: [{ id: 'BOUNDARY-01', text: 'Preserve the complete original source.',
        polarity: 'forbidden', conditions: ['when the configured Judge is unavailable'] }] }) },
    typedCoverage: { schemaVersion: 'requirements-contract-typed-source-coverage/v2',
      coverage: encodeGoalSemanticDictionary({ nodes: [{ sourceRootId: 'BOUNDARY-01', actionRefs: [], relationRefs: ['REL-01'] }] }) },
  };
}

function sampleWithEncoding(nodeEncoding?: 'GoalDictionaryNodes/base36-v1' | 'GoalDictionaryNodes/base36-run-v2') {
  return {
    typedSourceAuthority: { schemaVersion: 'requirements-contract-typed-source-authority/v2',
      graph: encodeGoalSemanticDictionaryForEncoding({ sourceNodes: Array.from({ length: 40 }, (_, index) => ({
        id: `BOUNDARY-${index}`, text: `Preserve complete source ${index}.`, polarity: 'forbidden',
        conditions: ['when the configured Judge is unavailable'],
      })) }, nodeEncoding) },
  };
}

describe('Requirements nested typed dictionaries retain complete audit semantics in transport', () => {
  it.each([
    [undefined, null],
    ['GoalDictionaryNodes/base36-v1', 'GoalDictionaryNodes/base36-v1'],
    ['GoalDictionaryNodes/base36-run-v2', 'GoalDictionaryNodes/base36-run-v2'],
  ] as const)('binds and restores canonical %s dictionaries without changing their bytes', (nodeEncoding, recipeEncoding) => {
    const original = sampleWithEncoding(nodeEncoding);
    const expanded = expandRequirementsTypedDictionaries(original) as any;
    expect(expanded.typedSourceAuthority.graph.nodeEncoding).toBe(recipeEncoding);
    expect(restoreRequirementsTypedDictionaries(expanded)).toEqual(original);
  });

  it('restores a frozen three-field v1 recipe produced before encoding was explicitly bound', () => {
    const original = sampleWithEncoding('GoalDictionaryNodes/base36-v1');
    const expanded = expandRequirementsTypedDictionaries(original) as any;
    delete expanded.typedSourceAuthority.graph.nodeEncoding;
    expect(restoreRequirementsTypedDictionaries(expanded)).toEqual(original);
  });

  it('rejects a canonical hash substituted from another node encoding', () => {
    const original = sampleWithEncoding('GoalDictionaryNodes/base36-v1');
    const expanded = expandRequirementsTypedDictionaries(original) as any;
    const semanticValue = expanded.typedSourceAuthority.graph.semanticValue;
    const v2 = encodeGoalSemanticDictionaryForEncoding(semanticValue, 'GoalDictionaryNodes/base36-run-v2');
    expanded.typedSourceAuthority.graph.dictionaryHash = sha256(canonicalJson(v2));
    expect(() => restoreRequirementsTypedDictionaries(expanded))
      .toThrow('requirements_typed_dictionary_expansion_dictionary_hash_mismatch');
  });

  it.each([
    'GoalDictionaryNodes/base36-v1',
    'GoalDictionaryNodes/base36-run-v2',
  ] as const)('does not convert a valid noncanonical %s dictionary into a recipe', (nodeEncoding) => {
    const semanticValue = [{ preserved: true }];
    const raw = encodeGoalSemanticDictionaryForEncoding(semanticValue, undefined);
    const noncanonical = { ...raw, nodeEncoding };
    expect(decodeGoalSemanticDictionary(noncanonical)).toEqual(semanticValue);
    const original = { typedSourceAuthority: {
      schemaVersion: 'requirements-contract-typed-source-authority/v2', graph: noncanonical } };
    expect(expandRequirementsTypedDictionaries(original)).toEqual(original);
  });

  it('rejects an unknown encoding bound to a restoration recipe', () => {
    const expanded = expandRequirementsTypedDictionaries(sampleWithEncoding('GoalDictionaryNodes/base36-v1')) as any;
    expanded.typedSourceAuthority.graph.nodeEncoding = 'GoalDictionaryNodes/unknown-v999';
    expect(() => restoreRequirementsTypedDictionaries(expanded))
      .toThrow('requirements_typed_dictionary_expansion_node_encoding_unknown');
  });

  it('restores the original canonical dictionaries and every readable source field after outer dictionary decoding', () => {
    const original = sample();
    const expanded = expandRequirementsTypedDictionaries(original) as any;
    expect(expanded.typedSourceAuthority.graph.semanticValue).toEqual(decodeGoalSemanticDictionary(original.typedSourceAuthority.graph));
    expect(expanded.typedCoverage.coverage.semanticValue).toEqual(decodeGoalSemanticDictionary(original.typedCoverage.coverage));
    const transport = encodeGoalSemanticDictionary(expanded);
    expect(restoreRequirementsTypedDictionaries(decodeGoalSemanticDictionary(transport))).toEqual(original);
  });

  it('rejects altered semantics, altered original dictionary identity and unrecognized recipe fields', () => {
    const changed = expandRequirementsTypedDictionaries(sample()) as any;
    changed.typedSourceAuthority.graph.semanticValue.sourceNodes[0].polarity = 'required';
    expect(() => restoreRequirementsTypedDictionaries(changed)).toThrow('requirements_typed_dictionary_expansion_dictionary_hash_mismatch');
    const wrongHash = expandRequirementsTypedDictionaries(sample()) as any;
    wrongHash.typedSourceAuthority.graph.dictionaryHash = `sha256:${'a'.repeat(64)}`;
    expect(() => restoreRequirementsTypedDictionaries(wrongHash)).toThrow('requirements_typed_dictionary_expansion_dictionary_hash_mismatch');
    const extra = expandRequirementsTypedDictionaries(sample()) as any;
    extra.typedCoverage.coverage.omitted = [];
    expect(() => restoreRequirementsTypedDictionaries(extra)).toThrow('requirements_typed_dictionary_expansion_fields_invalid');
  });

  it('fails closed for unknown expansion versions', () => {
    const expanded = expandRequirementsTypedDictionaries(sample()) as any;
    expanded.typedSourceAuthority.graph.schemaVersion = 'RequirementsTypedDictionaryExpansion/v999';
    expect(() => restoreRequirementsTypedDictionaries(expanded)).toThrow('requirements_typed_dictionary_expansion_version_unknown');
  });

  it('restores ordered physical span identities, including all-numeric IDs and repeated references', () => {
    const sourceSpanRefs = Array.from({ length: 12 }, (_, index) => `SOURCE-SPAN-${index.toString(16).padStart(20, '0')}`);
    sourceSpanRefs.push('SOURCE-SPAN-26986705256707780563', sourceSpanRefs[0]);
    const payload = { sourceSpanRefs };
    const compact = transformRequirementsAuditSourceSpanReferences(payload) as any;
    expect(compact.sourceSpanRefs.schemaVersion).toBe('RequirementsSourceSpanReferences/v2');
    expect(transformRequirementsAuditSourceSpanReferences(compact, true)).toEqual(payload);
    const tampered = structuredClone(compact);
    tampered.sourceSpanRefs.suffixes[0] = tampered.sourceSpanRefs.suffixes[1];
    expect(() => transformRequirementsAuditSourceSpanReferences(tampered, true)).toThrow('requirements_judge_audit_packet_source_span_refs_hash_mismatch');
    compact.sourceSpanRefs.schemaVersion = 'RequirementsSourceSpanReferences/v999';
    expect(() => transformRequirementsAuditSourceSpanReferences(compact, true)).toThrow('requirements_judge_audit_packet_source_span_refs_version_unknown');
    expect(() => resolveRequirementsContractJudgeAuditPacket({ schemaVersion: 'requirements-contract-judge-audit-packet/v999' }))
      .toThrow('requirements_judge_audit_packet_version_unknown');
  });

  it('leaves unrelated and legacy-v1 values unchanged', () => {
    const legacy = { schemaVersion: 'requirements-contract-semantic-ir/v1', semanticPayload: { requirements: ['REQ-01'] } };
    expect(expandRequirementsTypedDictionaries(legacy)).toEqual(legacy);
    expect(restoreRequirementsTypedDictionaries(legacy)).toEqual(legacy);
    const built = buildRequirementsContractJudgeAuditPacket({ semanticRevisionId: 'TEST-ONLY-SEMREV', scopeSemanticHash: 'TEST-ONLY-HASH',
      requirementIds: ['REQ-01'], mandatoryDimensionIds: ['DIM-01'], lineageNodes: [], authorityResolutions: [],
      artifacts: [{ artifactId: 'final-markdown', payload: '# Legacy source\n' }] });
    expect(built.packet).toEqual({ schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'TEST-ONLY-SEMREV',
      scopeSemanticHash: 'TEST-ONLY-HASH', body: { semanticRevisionId: 'TEST-ONLY-SEMREV', scopeSemanticHash: 'TEST-ONLY-HASH',
        requirementIds: ['REQ-01'], mandatoryDimensionIds: ['DIM-01'], lineageNodes: [], authorityResolutions: [],
        artifactIds: ['final-markdown'], artifactPayloadGroups: [{ artifactIds: ['final-markdown'], payload: '# Legacy source\n' }] } });
    expect(resolveRequirementsContractJudgeAuditPacket(built.packet)).toBe(built.packet);
  });
});
