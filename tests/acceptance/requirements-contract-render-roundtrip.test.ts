import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_ROOT_CLASS_REGISTRY_HASH } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-root-class-registry';
import {
  evaluateRequirementsContractRenderRoundTrip,
  validateRequirementsContractRenderRoundTripReport,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-render-roundtrip-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  installJudgeRuntimeConfig,
  readJson,
  removeTempRoot,
  runAuthoring,
  runIntakeAuthoring,
  sha256File,
  writeCanonicalizableDirectIntakeRequirement,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function roundTripPipelineFixture(text: string, semanticModelHash: string) {
  const sourceRoot = {
    sourceRootId: 'MUST-FR-001',
    rootClass: 'functional_requirement',
    nodeType: 'requirement',
    bodySchemaVersion: 'requirement-contract-requirement/v2',
    semanticBody: { id: 'MUST-FR-001', text },
    sourcePath: 'docs/requirements/fixture.md',
    sourceContent: text,
    sourceSpan: { startLine: 1, endLine: 1 },
    authorityClass: 'source_extracted',
  };
  return {
    sourceRoots: [sourceRoot],
    semanticIr: {
      semanticModelHash,
      nodes: {
        'MUST-FR-001': {
          applicability: {
            decision: 'applicable',
            reasonCode: 'source_authorized',
            proofRefs: ['SOURCE-SPAN-001'],
          },
        },
      },
    },
    semanticConservationManifest: {
      manifestHash: sha256Stable(`manifest:${semanticModelHash}`),
      decisionReceiptSetHash: sha256Stable([]),
    },
  } as any;
}

describe('requirements contract render round-trip gate', () => {
  it('rereads the audited draft through Canonical Parser, IR, and conservation before checkpoints', () => {
    const root = createTempRoot('requirements-contract-render-roundtrip-');
    try {
      installJudgeRuntimeConfig(root);
      const descriptor = createMinimalConsumerRequirementDescriptor('render-roundtrip');
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/plans/render-roundtrip.md',
        descriptor
      );
      const recordId = 'REQ-RENDER-ROUNDTRIP';
      const requirementSetId = `${recordId}-SET`;
      const result = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        requirementSetId,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, requirementSetId);

      expect(existsSync(paths.renderRoundTripReport)).toBe(true);

      const report = readJson<Record<string, any>>(paths.renderRoundTripReport);
      const manifest = readJson<Record<string, any>>(paths.semanticConservationManifest);
      expect(result.blockingIssues, JSON.stringify(report)).toEqual([]);
      expect(report).toMatchObject({
        schemaVersion: 'requirements-contract-render-roundtrip-report/v1',
        decision: 'pass',
        sourceRootClassRegistryHash: SOURCE_ROOT_CLASS_REGISTRY_HASH,
        baselineSemanticModelHash: manifest.semanticModelHash,
        roundTripSemanticModelHash: manifest.semanticModelHash,
        missingRootCount: 0,
        extraRootCount: 0,
        payloadMismatchCount: 0,
        authorityMismatchCount: 0,
        applicabilityMismatchCount: 0,
        decisionReceiptSetMismatchCount: 0,
        semanticModelHashMismatchCount: 0,
      });
      expect(report.sourceReadbackHash).toBe(sha256File(paths.draftSourcePreview));
      const { reportHash, ...preimage } = report;
      expect(reportHash).toBe(sha256Stable(preimage));
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('preserves original intake provenance through rendered Source PRD readback', () => {
    const root = createTempRoot('requirements-contract-render-roundtrip-intake-');
    try {
      installJudgeRuntimeConfig(root);
      const recordId = 'REQ-RENDER-ROUNDTRIP-INTAKE';
      const descriptor = createMinimalConsumerRequirementDescriptor(recordId);
      const materialized = writeCanonicalizableDirectIntakeRequirement(
        root,
        `_bmad-output/runtime/requirement-records/${recordId}/authoring/intake/intake-source.md`,
        descriptor
      );
      const targetSource = path.join(root, 'docs/plans/render-roundtrip-intake.md');
      const result = runIntakeAuthoring(
        root,
        materialized.sourcePath,
        targetSource,
        recordId,
        {
          ...materialized.authoringOptions,
          criticalAuditorRound: cleanCriticalAuditorRound,
        }
      );
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const sourcePrdLintReportPath = path.join(
        paths.authoring,
        'source-prd-instance-lint-report.json'
      );
      const sourcePrdLintReport = existsSync(sourcePrdLintReportPath)
        ? readJson<Record<string, any>>(sourcePrdLintReportPath)
        : null;
      expect(
        result.blockingIssues,
        JSON.stringify(
          {
            blockingStage: result.blockingStage,
            blockingIssues: result.blockingIssues,
            sourcePrdLintReport,
          },
          null,
          2
        )
      ).toEqual([]);
      const report = readJson<Record<string, any>>(paths.renderRoundTripReport);

      expect(
        report.payloadMismatchIds,
        JSON.stringify(
          {
            blockingStage: result.blockingStage,
            blockingIssues: result.blockingIssues,
            report,
          },
          null,
          2
        )
      ).toEqual([]);
      expect(report.decision).toBe('pass');
      expect(report.baselineSemanticModelHash).toBe(report.roundTripSemanticModelHash);
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('rejects a rehashed PASS report whose mismatch arrays contradict its counts', () => {
    const semanticModelHash = sha256Stable('semantic-model');
    const report = evaluateRequirementsContractRenderRoundTrip({
      sourceReadbackHash: sha256Stable('source-readback'),
      baseline: roundTripPipelineFixture('same authority', semanticModelHash),
      roundTrip: roundTripPipelineFixture('same authority', semanticModelHash),
    });
    const forgedPreimage = {
      ...report,
      payloadMismatchIds: ['MUST-FR-001'],
      payloadMismatchCount: 0,
    };
    const { reportHash: _oldHash, ...payload } = forgedPreimage;
    const forged = {
      ...payload,
      reportHash: sha256Stable(payload),
    };

    expect(validateRequirementsContractRenderRoundTripReport(forged)).toBe(false);
  });
});
