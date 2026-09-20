import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as packetModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-packet';
import * as requestModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity';
import { publishRequirementsContentObject } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store';
import { requirementsContractDomainHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';

const roots: string[] = [];
function recordRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-judge-ref-'));
  roots.push(root);
  return root;
}

function requiredFunction<T>(name: string): T {
  const value = Reflect.get(packetModule, name) as T | undefined;
  expect(value, `${name} must be exported`).toBeTypeOf('function');
  if (!value) throw new Error(`${name} missing`);
  return value;
}

function validSemanticIr() {
  return createRequirementsContractSemanticIr({
    recordId: 'REC-1', requestId: 'REQ-1', parentSemanticRevisionId: null,
    compilerVersion: 'compiler/v1',
    semantics: {
      requirements: [{ id: 'MUST-1', text: 'Persist exactly once.', oracle: 'ACC-1 passes.', requirementKind: 'functional', polarity: 'positive' }],
      atoms: [{ id: 'MUST-1-A1', action: 'Persist exactly once.', oracle: 'ACC-1 passes.', requirementRef: 'MUST-1' }],
      decisions: [],
    },
    evidenceClaims: [], specSpanRegistry: [], executionConstraints: [],
    semanticProvenance: { 'MUST-1': 'MUST-1' },
  });
}

describe('requirements contract Judge reference packet', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('persists one packet ref and hydrates only for provider invocation', () => {
    const root = recordRoot();
    const semanticIr = validSemanticIr();
    const packet = { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: semanticIr.semanticRevisionId, scopeSemanticHash: semanticIr.scopeSemanticHash, body: { sentinel: 'only once', requirementIds: ['MUST-1'], artifactIds: ['A-1'], mandatoryDimensionIds: ['complete'], semanticIr } };
    const build = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>('buildRequirementsContractJudgeAuditPacketV3');
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>('publishRequirementsContractJudgeAuditPacketRef');
    const hydrate = requiredFunction<(input: Record<string, unknown>) => unknown>('hydrateRequirementsContractJudgeAuditPacket');
    const descriptor = build({ recordRoot: root, packet });
    const ref = publish({ recordRoot: root, packet: descriptor });
    const request = {
      auditBinding: { auditBindingHash: `sha256:${'2'.repeat(64)}` },
      auditPacketRef: ref,
    };

    expect(request).not.toHaveProperty('auditPacket');
    expect(hydrate({ recordRoot: root, packetRef: ref })).toMatchObject({
      schemaVersion: 'requirements-contract-judge-audit-packet/v3-hydrated',
      scopeSemanticHash: packet.scopeSemanticHash,
      body: expect.objectContaining({ sentinel: 'only once' }),
    });
  });

  it('reuses canonical semantic and projection refs without embedding their payloads', () => {
    const root = recordRoot();
    const semanticIr = validSemanticIr();
    const projection = {
      schemaVersion: 'requirements-contract-confirmation-projection/v1',
      sentinel: 'projection payload stored once',
    };
    const semanticIrRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'semantic_ir',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(semanticIr), 'utf8'),
    });
    const projectionRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'confirmation_projection',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(projection), 'utf8'),
    });
    const packet = {
      schemaVersion: 'requirements-contract-judge-audit-packet/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      body: {
        semanticRevisionId: semanticIr.semanticRevisionId, scopeSemanticHash: semanticIr.scopeSemanticHash,
        requirementIds: ['MUST-1'], artifactIds: ['confirmation-projection'],
        mandatoryDimensionIds: ['complete'], lineageNodes: [], authorityResolutions: [],
        semanticIr,
        artifactPayloadGroups: [{ artifactIds: ['confirmation-projection'], payload: projection }],
      },
    };
    const build = requiredFunction<(input: Record<string, unknown>) => Record<string, any>>(
      'buildRequirementsContractJudgeAuditPacketV3'
    );
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      'publishRequirementsContractJudgeAuditPacketRef'
    );
    const hydrate = requiredFunction<(input: Record<string, unknown>) => Record<string, any>>(
      'hydrateRequirementsContractJudgeAuditPacket'
    );

    const descriptor = build({
      recordRoot: root,
      packet,
      semanticIr,
      semanticIrRef,
      artifactEntries: [{
        artifactId: 'confirmation-projection',
        role: 'confirmation_projection',
        schemaVersion: projection.schemaVersion,
        semanticHash: requirementsContractDomainHash(
          'requirements-projection:confirmation_projection/v1',
          projection
        ),
        contentRef: projectionRef,
      }],
    });
    expect(descriptor.semanticIrRef).toEqual(semanticIrRef);
    expect(descriptor.semanticAuditSliceRefs).toContainEqual(expect.objectContaining({
      role: 'confirmation-projection',
      contentRef: projectionRef,
    }));
    expect(JSON.stringify(descriptor)).not.toContain(projection.sentinel);

    const packetRef = publish({ recordRoot: root, packet: descriptor });
    const hydrated = hydrate({ recordRoot: root, packetRef });
    expect(hydrated.body.artifactPayloadGroups).toContainEqual({
      artifactIds: ['confirmation-projection'],
      payload: projection,
    });
  });

  it('blocks tampered refs before dispatch', () => {
    const root = recordRoot();
    const semanticIr = validSemanticIr();
    const packet = { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: semanticIr.semanticRevisionId, scopeSemanticHash: semanticIr.scopeSemanticHash, body: { sentinel: 'only once', requirementIds: ['MUST-1'], artifactIds: ['A-1'], mandatoryDimensionIds: ['complete'], semanticIr } };
    const build = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>('buildRequirementsContractJudgeAuditPacketV3');
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>('publishRequirementsContractJudgeAuditPacketRef');
    const hydrate = requiredFunction<(input: Record<string, unknown>) => unknown>('hydrateRequirementsContractJudgeAuditPacket');
    const ref = publish({ recordRoot: root, packet: build({ recordRoot: root, packet }) });
    const tampered = { ...ref, contentHash: `sha256:${'0'.repeat(64)}` };

    expect(() => hydrate({ recordRoot: root, packetRef: tampered })).toThrow('requirements_judge_audit_packet_ref_mismatch');
  });

  it('rejects malformed v3 request refs before provider dispatch', () => {
    const root = recordRoot();
    const packetRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'judge_audit_packet',
      mediaType: 'application/json',
      bytes: Buffer.from('{"schemaVersion":"requirements-contract-judge-audit-packet/v3"}', 'utf8'),
    });
    const build = Reflect.get(requestModule, 'buildRequirementsContractJudgeRequestV3') as (input: Record<string, unknown>) => Record<string, unknown>;
    const verify = Reflect.get(requestModule, 'verifyRequirementsContractJudgeRequestV3') as (value: unknown) => unknown;
    const request = build({
      auditBinding: { auditBindingHash: `sha256:${'1'.repeat(64)}` },
      auditPacketRef: packetRef,
      providerSelection: { providerSelectionHash: `sha256:${'2'.repeat(64)}` },
      prompt: { systemPrompt: 'judge' },
      remediation: null,
    });
    expect(verify(request)).toEqual(request);
    expect(() => verify({ ...request, auditBinding: [] })).toThrow('requirements_contract_judge_request_v3_invalid');
    expect(() => verify({ ...request, providerSelection: 'provider' })).toThrow('requirements_contract_judge_request_v3_invalid');
    expect(() => verify({ ...request, auditPacketRef: { ...packetRef, recordRelativePath: 'authoring/objects/sha256/not-canonical' } }))
      .toThrow('requirements_contract_judge_request_v3_invalid');
  });
});
