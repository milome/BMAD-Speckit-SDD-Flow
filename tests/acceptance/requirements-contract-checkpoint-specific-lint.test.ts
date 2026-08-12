import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  lintRequirementsContractProjectionStage,
  publishRequirementsContractCp05Cp08Stages,
  REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS,
  REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES,
  validateRequirementsContractPublicationReady,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp05-cp08';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

const identity = {
  authoringRequestId: 'REQUEST-001',
  authoringAttemptId: 'ATTEMPT-001',
  attemptManifestHash: hash('1'),
  scopeSemanticHash: hash('2'),
  sourceBindingHash: hash('3'),
};

const applicableArtifactIds = [
  'confirmation-projection',
  'final-markdown',
  'execution-manifest',
  'per-must-bundle',
  'trace-matrix',
  'diagram-set',
  'projection-reconciliation-report',
  'authority-resolution-report',
  'renderability-probe-report',
];

function publicationReadyFixture() {
  const authorityResolution = {
    evidenceClaimId: 'EVIDENCE-CLAIM-MUST-001',
    authorityClass: 'source_grounded',
    branch: 'source_span',
    sourceSpanRefs: ['MUST-001:1-1'],
    decisionReceiptRefs: [],
    premiseRefs: [],
    derivationReceiptRefs: [],
  };
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: 'REQUEST-001',
    requestId: 'REQUEST-001',
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-test/v1',
    semantics: {
      requirements: [{ id: 'MUST-001', text: 'Persist the value.', oracle: 'Value exists.' }],
      atoms: [
        {
          id: 'ATOM-001',
          action: 'Persist the value.',
          oracle: 'Value exists.',
          requirementRef: 'MUST-001',
        },
      ],
    },
    evidenceClaims: [
      {
        evidenceClaimId: 'EVIDENCE-CLAIM-MUST-001',
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('4'),
        sourceEvidenceRequired: true,
        decisionReceiptRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
    ],
    specSpanRegistry: [
      {
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('4'),
        boundSemanticNodeIds: ['MUST-001', 'ATOM-001'],
        boundObligationIds: ['MUST-001'],
        evidenceClaimRefs: ['EVIDENCE-CLAIM-MUST-001'],
        decisionReceiptRefs: [],
        derivationReceiptRefs: [],
      },
    ],
    executionConstraints: [],
    semanticProvenance: { 'MUST-001': 'MUST-001' },
  });
  const lineageNode = {
    role: 'must',
    id: 'MUST-001',
    factRefs: [],
    mustRefs: ['MUST-001'],
    atomRefs: ['ATOM-001'],
    traceRefs: [],
    specSpanRefs: [semanticIr.semanticPayload.specSpanRegistry[0].specSpanId],
    evidenceClaimRefs: ['EVIDENCE-CLAIM-MUST-001'],
  };
  const packetBody = {
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    requirementIds: ['MUST-001'],
    artifactIds: applicableArtifactIds,
    mandatoryDimensionIds: [...REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS],
    lineageNodes: [lineageNode],
    authorityResolutions: [authorityResolution],
    artifactPayloadGroups: applicableArtifactIds.map((artifactId) => ({
      artifactIds: [artifactId],
      payload: { artifactId, semanticRevisionId: semanticIr.semanticRevisionId },
    })),
  };
  const auditPacket = {
    schemaVersion: 'requirements-contract-judge-audit-packet/v1',
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    body: packetBody,
  };
  const serializedBytes = Buffer.byteLength(JSON.stringify(auditPacket), 'utf8');
  return {
    activeAuthoringAttemptPointer: {
      schemaVersion: 'ActiveAuthoringAttemptPointer/v1',
      authoringAttemptId: 'ATTEMPT-001',
      attemptManifestPath: 'authoring/staging/ATTEMPT-001/manifests/8-cp08.json',
      attemptManifestHash: hash('1'),
      latestValidPredecessorCheckpoint: 'cp07',
      inputManifestHash: hash('2'),
    },
    cp08Snapshot: {
      checkpointId: 'cp08',
      authoringAttemptId: 'ATTEMPT-001',
      attemptManifestHash: hash('1'),
      semanticIr,
      resolvedEvidenceIndex: {
        semanticRevisionId: semanticIr.semanticRevisionId,
        resolutions: [authorityResolution],
      },
    },
    reconciliationReport: {
      schemaVersion: 'requirements-contract-projection-reconciliation-report/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      decision: 'pass',
      requirementIds: ['MUST-001'],
      nodes: [lineageNode],
    },
    authorityResolutionReport: {
      schemaVersion: 'requirements-contract-authority-resolution-report/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      decision: 'pass',
      resolutions: [authorityResolution],
    },
    renderabilityProbeReport: {
      schemaVersion: 'requirements-contract-renderability-probe-report/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      decision: 'pass',
      promotable: false,
      providerInvocationCount: 0,
      committerInvocationCount: 0,
      renderedRequirementIds: ['MUST-001'],
    },
    auditPacket,
    coverageManifest: {
      requirementIds: packetBody.requirementIds,
      artifactIds: packetBody.artifactIds,
      mandatoryDimensionIds: packetBody.mandatoryDimensionIds,
      omittedArtifactIds: [],
      allApplicableArtifactsIncluded: true,
    },
    mandatoryDimensionRegistry: {
      dimensionIds: [...REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS],
    },
    payloadObservation: { serializedBytes },
    finalBuildManifestInputs: ['cp08-snapshot', 'audit-packet'],
  };
}

describe('checkpoint-specific projection lint', () => {
  it('uses closed cp05-cp08 profiles with checkpoint-specific artifact roles and issues', () => {
    expect(REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES).toMatchObject({
      cp05: {
        profileId: 'requirements-contract-cp05-source-confirmation-projection/v1',
        artifactRoles: ['source_markdown', 'implementation_confirmation'],
      },
      cp06: {
        profileId: 'requirements-contract-cp06-execution-projection/v1',
        artifactRoles: ['per_must_bundle', 'execution_manifest', 'compact_trace_matrix'],
      },
      cp07: {
        profileId: 'requirements-contract-cp07-view-diagram-projection/v1',
        artifactRoles: ['human_view', 'diagram_set'],
      },
      cp08: {
        profileId: 'requirements-contract-cp08-reconciliation-renderability/v1',
        artifactRoles: [
          'projection_reconciliation_report',
          'authority_resolution_report',
          'renderability_probe_report',
          'judge_audit_packet',
        ],
      },
    });

    const result = lintRequirementsContractProjectionStage({
      stage: 'cp07',
      identity,
      artifacts: [{ artifactId: 'VIEW-001', role: 'execution_manifest', value: {} }],
      checkedRequirementIds: ['MUST-001'],
    });

    expect(result.decision).toBe('block');
    expect(result.issueCodes).toContain(
      'requirements_cp07_artifact_role_invalid:execution_manifest'
    );
    expect(result.earliestAffectedStage).toBe('cp07');
    expect(result.latestValidPredecessorCheckpoint).toBe('cp06');
  });

  it('publication-ready reads attempt/cp08 evidence and rejects Task4 authority fields', () => {
    const base = publicationReadyFixture();

    expect(validateRequirementsContractPublicationReady(base).decision).toBe('pass');
    for (const forbidden of [
      'activeAuthorityTuple',
      'finalBuildManifest',
      'providerSelection',
      'judgeRequest',
    ] as const) {
      expect(
        validateRequirementsContractPublicationReady({ ...base, [forbidden]: {} }).issueCodes
      ).toContain(`requirements_publication_ready_task4_field_forbidden:${forbidden}`);
    }
    const largePacket = structuredClone(base.auditPacket);
    largePacket.body.artifactPayloadGroups[0].payload = {
      body: '批量退款审批'.repeat(400_000),
    };
    const largePacketBytes = Buffer.byteLength(JSON.stringify(largePacket), 'utf8');
    expect(largePacketBytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(
      validateRequirementsContractPublicationReady({
        ...base,
        auditPacket: largePacket,
        payloadObservation: { serializedBytes: largePacketBytes },
      })
    ).toMatchObject({ decision: 'pass', providerInvocationCount: 0, committerInvocationCount: 0 });
  });

  it.each([
    {
      name: 'reconciliation identity is malformed',
      issueCode: 'requirements_publication_ready_reconciliation_report_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.reconciliationReport.semanticRevisionId = 'SEMANTIC-UNKNOWN';
      },
    },
    {
      name: 'authority report body is incomplete',
      issueCode: 'requirements_publication_ready_authority_resolution_report_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.authorityResolutionReport.resolutions = [];
      },
    },
    {
      name: 'renderability report claims a provider call',
      issueCode: 'requirements_publication_ready_renderability_probe_report_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.renderabilityProbeReport.providerInvocationCount = 1;
      },
    },
    {
      name: 'renderability report contains an undeclared field',
      issueCode: 'requirements_publication_ready_renderability_probe_report_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        Object.assign(base.renderabilityProbeReport, { estimatedInputTokens: 512 });
      },
    },
    {
      name: 'payload observation restores the removed token estimate',
      issueCode: 'requirements_publication_ready_payload_observation_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        Object.assign(base.payloadObservation, { estimatedInputTokens: 512 });
      },
    },
    {
      name: 'cp08 snapshot does not bind the active manifest hash',
      issueCode: 'requirements_publication_ready_cp08_snapshot_identity_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.cp08Snapshot.attemptManifestHash = hash('9');
      },
    },
  ])('blocks publication when $name', ({ issueCode, mutate }) => {
    const base = publicationReadyFixture();
    mutate(base);

    expect(validateRequirementsContractPublicationReady(base)).toMatchObject({
      decision: 'block',
      issueCodes: expect.arrayContaining([issueCode]),
      providerInvocationCount: 0,
      committerInvocationCount: 0,
    });
  });

  it('does not activate the cp08 pointer when publication lint cannot be published', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'requirements-cp08-publication-'));
    const base = publicationReadyFixture();
    const lintPath = path.join(
      root,
      'authoring',
      'staging',
      'ATTEMPT-001',
      'publication-ready-lint.json'
    );
    fs.mkdirSync(path.dirname(lintPath), { recursive: true });
    fs.writeFileSync(lintPath, JSON.stringify({ conflict: true }), 'utf8');
    let casCalls = 0;

    try {
      expect(() =>
        publishRequirementsContractCp05Cp08Stages({
          recordRoot: root,
          sourcePath: path.join(root, 'source.md'),
          authoringRequestId: 'REQUEST-001',
          authoringAttemptId: 'ATTEMPT-001',
          inputManifestHash: hash('8'),
          previousCheckpointManifestRef: {
            checkpointId: 'cp04',
            checkpointOrdinal: 4,
            path: 'authoring/staging/ATTEMPT-001/manifests/4-cp04.json',
            hash: hash('9'),
          },
          expectedCurrentPointerHash: hash('0'),
          compareAndSwapAttemptPointer() {
            casCalls += 1;
            return true;
          },
          semanticIr: base.cp08Snapshot.semanticIr,
          sourceBinding: { sourceBindingHash: hash('3') },
          resolvedEvidenceIndex: base.cp08Snapshot.resolvedEvidenceIndex,
          decisionReceiptRefs: [],
        })
      ).toThrow('atomic_no_clobber_conflict');
      expect(casCalls).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: 'a frozen requirement is missing',
      issueCode: 'requirements_publication_ready_requirement_coverage_gap',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.auditPacket.body.requirementIds = [];
        base.coverageManifest.requirementIds = [];
      },
    },
    {
      name: 'an applicable artifact is missing',
      issueCode: 'requirements_publication_ready_artifact_coverage_gap',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.auditPacket.body.artifactIds = base.auditPacket.body.artifactIds.slice(1);
        base.coverageManifest.artifactIds = base.coverageManifest.artifactIds.slice(1);
      },
    },
    {
      name: 'the mandatory dimension set is incomplete',
      issueCode: 'requirements_publication_ready_mandatory_dimensions_mismatch',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.auditPacket.body.mandatoryDimensionIds = ['semantic_projection_reconciliation'];
        base.coverageManifest.mandatoryDimensionIds = ['semantic_projection_reconciliation'];
        base.mandatoryDimensionRegistry.dimensionIds = ['semantic_projection_reconciliation'];
      },
    },
    {
      name: 'a frozen lineage node is missing',
      issueCode: 'requirements_publication_ready_lineage_coverage_gap',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.auditPacket.body.lineageNodes = [];
      },
    },
    {
      name: 'a lineage node references an unknown semantic ID',
      issueCode: 'requirements_publication_ready_lineage_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.auditPacket.body.lineageNodes[0].atomRefs = ['ATOM-UNKNOWN'];
      },
    },
    {
      name: 'a lineage node omits its typed reference arrays',
      issueCode: 'requirements_publication_ready_lineage_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        delete (
          base.auditPacket.body.lineageNodes[0] as Partial<
            (typeof base.auditPacket.body.lineageNodes)[number]
          >
        ).atomRefs;
      },
    },
    {
      name: 'an authority resolution is missing',
      issueCode: 'requirements_publication_ready_authority_resolution_coverage_gap',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.auditPacket.body.authorityResolutions = [];
      },
    },
    {
      name: 'an authority resolution uses an invalid authority branch',
      issueCode: 'requirements_publication_ready_authority_resolution_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        base.auditPacket.body.authorityResolutions[0].sourceSpanRefs = [];
      },
    },
    {
      name: 'the resolved evidence index contains a malformed row',
      issueCode: 'requirements_publication_ready_authority_resolution_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        delete (
          base.cp08Snapshot.resolvedEvidenceIndex.resolutions[0] as Partial<
            (typeof base.cp08Snapshot.resolvedEvidenceIndex.resolutions)[number]
          >
        ).sourceSpanRefs;
      },
    },
    {
      name: 'the frozen spec span registry contains a malformed row',
      issueCode: 'requirements_publication_ready_frozen_semantic_ir_invalid',
      mutate(base: ReturnType<typeof publicationReadyFixture>) {
        delete (
          base.cp08Snapshot.semanticIr.semanticPayload.specSpanRegistry[0] as Partial<
            (typeof base.cp08Snapshot.semanticIr.semanticPayload.specSpanRegistry)[number]
          >
        ).boundObligationIds;
      },
    },
  ])('recomputes deep packet coverage when $name', ({ issueCode, mutate }) => {
    const base = publicationReadyFixture();
    mutate(base);

    expect(validateRequirementsContractPublicationReady(base)).toMatchObject({
      decision: 'block',
      issueCodes: expect.arrayContaining([issueCode]),
      providerInvocationCount: 0,
      committerInvocationCount: 0,
    });
  });
});
