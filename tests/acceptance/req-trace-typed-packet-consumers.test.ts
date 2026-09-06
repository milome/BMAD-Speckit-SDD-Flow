import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createTypedSourceAuthority, createTypedSourceCoverage } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { decodeGoalSemanticDictionary } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';
import { validateTypedModelPacket } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-model-packet';
import {
  errorCaseCoverageFromTypedModelPacket,
  requiredCommandsFromTypedModelPacket,
  typedModelPacketProjectionRefs,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-packet-projection';
import { requiredCommandExecutionDescriptorsFromModelPacket } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-command-execution-receipt';

const require = createRequire(import.meta.url);
const { hashCanonicalManifest } = require('../../_bmad/shared/contract-execution-manifest/hash-contract-execution-manifest.js');
const { controlledRequiredCommandDescriptor } = require('../../_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js');
function fixture() {
  const authority = createTypedSourceAuthority({ schemaVersion: 'requirements-contract-typed-source-graph/v2',
    sourceNodes: [{ sourceRootId: 'BOUND-1', executionRole: 'boundary', text: 'Do not modify the input.',
      polarity: 'forbidden', normativeStrength: 'must', conditions: [], scope: { kind: 'source_section' }, declaredIds: [] }],
    sourceRelations: [], sourceBlocks: [], commandDeclarations: [], workDeclarations: [],
    scenarioDeclarations: [], fixDeclarations: [], sections: [] });
  const coverage = createTypedSourceCoverage(authority);
  const packet: Record<string, any> = { schemaVersion: 'req-trace-ai-tdd-model-packet/v2',
    typedSourceAuthority: authority, typedCoverage: coverage, requiredCommands: [],
    errorCaseCoverage: { acceptanceTests: [], e2eSuites: [], failurePaths: [], edgeCases: [] },
    acceptanceTests: [], e2eSuites: [], requirements: { must: [] }, atomicImplementationTaskList: [],
    traceOrder: [], traceSlices: [],
    contractExecutionManifest: { schemaVersion: 'contract-execution-manifest/v2',
      typedSourceAuthorityRef: { schemaVersion: authority.schemaVersion, graphHash: authority.graphHash,
        authorityPath: 'model_packet.json#/typedSourceAuthority' },
      typedCoverageRef: { schemaVersion: coverage.schemaVersion, coverageHash: coverage.coverageHash,
        authorityPath: 'model_packet.json#/typedCoverage' }, traceRows: [] } };
  const receipt = { schemaVersion: 'req-trace-ai-tdd-compiler-audit-receipt/v2',
    typedSourceAuthorityHash: authority.graphHash, typedCoverageHash: coverage.coverageHash };
  return { packet, receipt, confirmation: { typedSourceAuthority: structuredClone(authority), typedCoverage: structuredClone(coverage) } };
}

function compactFixtureWithNonEmptyProjections() {
  const value = fixture();
  const command = {
    id: 'CMD-1',
    command: 'node --test tests/work.test.js',
    argv: ['node', '--test', 'tests/work.test.js'],
    cwd: '.',
    receiptPath: 'test-only-receipts/CMD-1.json',
    requirementRefs: ['MUST-001'],
    acceptanceRefs: ['ACC-001'],
    traceRefs: ['TRACE-1'],
    traceRows: ['TRACE-1'],
    evidenceRefs: ['EVD-001'],
  };
  Object.assign(value.packet.contractExecutionManifest, {
    requiredCommands: [command],
    errorCaseCoverage: {
      acceptanceTests: [{ id: 'ACC-001' }],
      e2eSuites: [{ id: 'E2E-001' }],
      failurePaths: [{ id: 'FAIL-001' }],
      edgeCases: [{ id: 'EDGE-001' }],
    },
    acceptanceTests: [{ id: 'ACC-001' }],
    e2eSuites: [{ id: 'E2E-001' }],
  });
  delete value.packet.requiredCommands;
  delete value.packet.errorCaseCoverage;
  delete value.packet.acceptanceTests;
  delete value.packet.e2eSuites;
  value.packet.projectionRefs = { ...typedModelPacketProjectionRefs() };
  return { ...value, command };
}

describe('typed packet consumer protocol', () => {
  it('preserves confirmed WORK command owners without treating boundary IDs as requirements', () => {
    const { packet } = fixture();
    const confirmation = { typedSourceAuthority: packet.typedSourceAuthority, must: [{ id: 'WORK-01' }],
      traceRows: [{ id: 'TRACE-1', covers: ['WORK-01', 'BOUND-1'], deliveryEvidenceCommandRefs: ['CMD-1'] }] };
    const command = { id: 'CMD-1', command: 'node --test tests/work.test.js', traceRows: ['TRACE-1'] };
    const projected = controlledRequiredCommandDescriptor(confirmation, command,
      { commandCwd: '.', commandReceiptRoot: 'test-only-receipts' });
    expect(projected.requirementRefs).toEqual(['WORK-01']);
    expect(projected.traceRefs).toEqual(['TRACE-1']);
    expect(projected.command).toBe(command.command);
  });
  it('preserves legacy untyped packets without synthesizing v2 authority', () => {
    expect(validateTypedModelPacket({ schemaVersion: 'req-trace-ai-tdd-model-packet/v1' })).toEqual([]);
  });
  it('validates the complete graph and its independently bound coverage', () => {
    const { packet, receipt, confirmation } = fixture();
    expect(validateTypedModelPacket(packet, receipt, confirmation)).toEqual([]);
  });
  it('reconstructs compact coverage refs from the complete packet graph', () => {
    const { packet, receipt, confirmation } = fixture();
    packet.typedCoverage = { schemaVersion: 'requirements-contract-typed-source-coverage-ref/v2',
      graphHash: packet.typedSourceAuthority.graphHash, coverageHash: packet.typedCoverage.coverageHash };
    expect(validateTypedModelPacket(packet, receipt, confirmation)).toEqual([]);
    packet.typedCoverage.coverageHash = 'wrong';
    expect(validateTypedModelPacket(packet, receipt, confirmation)).toContain('typed_packet_authority_invalid');
  });
  it('accepts manifest-backed typed projections and rejects a broken projection ref', () => {
    const { packet, receipt } = fixture();
    packet.contractExecutionManifest.requiredCommands = [];
    packet.contractExecutionManifest.errorCaseCoverage = {};
    packet.contractExecutionManifest.acceptanceTests = [];
    packet.contractExecutionManifest.e2eSuites = [];
    delete packet.requiredCommands;
    delete packet.errorCaseCoverage;
    packet.projectionRefs = { requiredCommands: 'contractExecutionManifest.requiredCommands',
      errorCaseCoverage: 'contractExecutionManifest.errorCaseCoverage',
      acceptanceTests: 'contractExecutionManifest.acceptanceTests',
      e2eSuites: 'contractExecutionManifest.e2eSuites' };
    expect(validateTypedModelPacket(packet, receipt)).toEqual([]);
    packet.projectionRefs.requiredCommands = 'wrong';
    expect(validateTypedModelPacket(packet, receipt)).toContain('typed_packet_projection_ref_invalid');
  });
  it('resolves non-empty compact projections through publication and execution consumers', () => {
    const { packet, receipt, command } = compactFixtureWithNonEmptyProjections();
    expect(validateTypedModelPacket(packet, receipt)).toEqual([]);
    expect(requiredCommandsFromTypedModelPacket(packet)).toEqual([command]);
    expect(errorCaseCoverageFromTypedModelPacket(packet)).toMatchObject({
      failurePaths: [{ id: 'FAIL-001' }],
      edgeCases: [{ id: 'EDGE-001' }],
    });
    expect(requiredCommandExecutionDescriptorsFromModelPacket(packet)).toEqual({
      descriptors: [expect.objectContaining({
        id: 'CMD-1',
        command: command.command,
        requirementRefs: ['MUST-001'],
        acceptanceRefs: ['ACC-001'],
        traceRefs: ['TRACE-1'],
      })],
      issueCodes: [],
    });
  });
  it.each(['missing-refs', 'missing-manifest-field', 'unknown-ref', 'wrong-target'])(
    'rejects compact projection damage: %s', (damage) => {
      const { packet, receipt } = compactFixtureWithNonEmptyProjections();
      if (damage === 'missing-refs') delete packet.projectionRefs;
      if (damage === 'missing-manifest-field') delete packet.contractExecutionManifest.requiredCommands;
      if (damage === 'unknown-ref') packet.projectionRefs.unknown = 'contractExecutionManifest.unknown';
      if (damage === 'wrong-target') {
        packet.projectionRefs.requiredCommands = 'contractExecutionManifest.errorCaseCoverage';
      }
      expect(validateTypedModelPacket(packet, receipt).length).toBeGreaterThan(0);
      expect(() => requiredCommandsFromTypedModelPacket(packet)).toThrow(/typed_packet_projection/u);
    }
  );
  it('rejects conflicting transitional top-level projection copies', () => {
    const { packet, receipt } = fixture();
    packet.contractExecutionManifest.requiredCommands = [];
    packet.contractExecutionManifest.errorCaseCoverage = {};
    packet.contractExecutionManifest.acceptanceTests = [];
    packet.contractExecutionManifest.e2eSuites = [];
    packet.requiredCommands = [{ id: 'CMD-CONFLICT' }];
    packet.errorCaseCoverage = {};
    packet.projectionRefs = { requiredCommands: 'contractExecutionManifest.requiredCommands',
      errorCaseCoverage: 'contractExecutionManifest.errorCaseCoverage',
      acceptanceTests: 'contractExecutionManifest.acceptanceTests',
      e2eSuites: 'contractExecutionManifest.e2eSuites' };
    expect(validateTypedModelPacket(packet, receipt)).toContain('typed_packet_projection_conflict');
  });
  it.each(['version', 'missing-graph', 'missing-coverage', 'manifest-ref', 'receipt-hash', 'invented-task'])(
    'rejects %s instead of treating it as legacy', (damage) => {
      const { packet, receipt, confirmation } = fixture();
      if (damage === 'version') packet.schemaVersion = 'req-trace-ai-tdd-model-packet/v1';
      if (damage === 'missing-graph') delete packet.typedSourceAuthority;
      if (damage === 'missing-coverage') delete packet.typedCoverage;
      if (damage === 'manifest-ref') packet.contractExecutionManifest.typedSourceAuthorityRef.graphHash = 'wrong';
      if (damage === 'receipt-hash') receipt.typedCoverageHash = 'wrong';
      if (damage === 'invented-task') packet.atomicImplementationTaskList.push({ id: 'BOUND-1-A1', requirementRefs: ['BOUND-1'] });
      expect(validateTypedModelPacket(packet, receipt, confirmation).length).toBeGreaterThan(0);
    });
  it('rejects a self-consistent rewritten graph against the independent confirmed source', () => {
    const { packet, receipt, confirmation } = fixture();
    const graph = decodeGoalSemanticDictionary(packet.typedSourceAuthority.graph) as any;
    graph.sourceNodes[0].text = 'May modify the input.';
    graph.sourceNodes[0].polarity = 'permitted';
    const changed = createTypedSourceAuthority(graph);
    packet.typedSourceAuthority = changed;
    packet.typedCoverage = createTypedSourceCoverage(changed);
    packet.contractExecutionManifest.typedSourceAuthorityRef.graphHash = changed.graphHash;
    packet.contractExecutionManifest.typedCoverageRef.coverageHash = packet.typedCoverage.coverageHash;
    receipt.typedSourceAuthorityHash = changed.graphHash;
    receipt.typedCoverageHash = packet.typedCoverage.coverageHash;
    expect(validateTypedModelPacket(packet, receipt, confirmation)).toContain('typed_packet_confirmed_source_mismatch');
  });
  it.each(['version', 'authority-hash', 'coverage-hash'])(
    'rejects a stripped packet while the receipt retains typed %s evidence', (marker) => {
      const { packet, receipt } = fixture();
      delete packet.typedSourceAuthority;
      delete packet.typedCoverage;
      packet.schemaVersion = 'req-trace-ai-tdd-model-packet/v1';
      packet.contractExecutionManifest = { schemaVersion: 'contract-execution-manifest/v1' };
      const retained = marker === 'version' ? { schemaVersion: receipt.schemaVersion }
        : marker === 'authority-hash' ? { typedSourceAuthorityHash: receipt.typedSourceAuthorityHash }
          : { typedCoverageHash: receipt.typedCoverageHash };
      expect(validateTypedModelPacket(packet, retained)).toContain('typed_packet_version_invalid');
    });
  it('rejects reversal of two valid trace rows even without a separately loaded source', () => {
    const { packet, receipt } = fixture();
    packet.contractExecutionManifest.traceRows = [{ id: 'TRACE-1', covers: [] }, { id: 'TRACE-2', covers: [] }];
    packet.traceOrder = ['TRACE-1', 'TRACE-2'];
    packet.traceSlices = [{ traceId: 'TRACE-1', covers: [] }, { traceId: 'TRACE-2', covers: [] }];
    expect(validateTypedModelPacket(packet, receipt)).toEqual([]);
    packet.traceOrder.reverse();
    expect(validateTypedModelPacket(packet, receipt)).toContain('typed_packet_trace_order_invalid');
  });
  it('hash-binds manifest typed references and the complete ordered trace rows', () => {
    const { packet } = fixture();
    const original = hashCanonicalManifest(packet.contractExecutionManifest);
    for (const mutate of [(value: any) => { value.typedSourceAuthorityRef.graphHash = 'changed'; },
      (value: any) => { value.typedCoverageRef.coverageHash = 'changed'; },
      (value: any) => { value.traceRows.push({ id: 'TRACE-1', boundaryViewRefs: ['BOUND-1'], taskRefs: [] }); }]) {
      const changed = structuredClone(packet.contractExecutionManifest);
      mutate(changed);
      expect(hashCanonicalManifest(changed)).not.toBe(original);
    }
  });
});
