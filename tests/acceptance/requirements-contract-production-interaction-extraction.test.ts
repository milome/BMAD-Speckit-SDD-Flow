import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  extractProductionInteractionCandidates,
  type ProductionInteractionSourceRoot,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-interaction-candidate-extractor';
import { buildCanonicalPreCheckpointCompilerInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-canonical-compiler-input';
import {
  materializeEntryLineage,
  materializeFileEntryIntake,
  readCanonicalUtf8Source,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-entry-authority-facade';
import { runRequirementsContractProductionSemanticPipeline } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';
import { validateRequirementsContractSemanticConservationManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-conservation-manifest';
import {
  sha256Stable,
  sha256Text,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  buildInteractionSourceRoots,
  createInteractionSourceRoot,
  createInteractionFixtureDescriptor,
  type InteractionFixtureDescriptor,
} from './helpers/requirements-contract-interaction-fixture';

const PRIMARY_INTERACTION_FIXTURE = createInteractionFixtureDescriptor({
  token: 'fixture',
  ordinal: 1,
  actorLabel: 'Fixture operator',
  componentLabel: 'Fixture component',
  owningSystem: 'fixture-system',
  targetExportName: 'fixtureSemanticTarget',
  commandOperation: 'perform_fixture_operation',
  resultOperation: 'return_fixture_result',
  branchCondition: 'fixture_request_is_valid',
  correlationKey: 'fixtureCorrelationKey',
});

const ALTERNATE_INTERACTION_FIXTURE = createInteractionFixtureDescriptor({
  token: 'variant',
  ordinal: 41,
  actorLabel: 'Variant operator',
  componentLabel: 'Variant component',
  owningSystem: 'variant-system',
  targetExportName: 'variantSemanticTarget',
  commandOperation: 'perform_variant_operation',
  resultOperation: 'return_variant_result',
  branchCondition: 'variant_request_is_valid',
  correlationKey: 'variantCorrelationKey',
  deadlineMs: 1750,
});

interface InteractionResolutionProjection {
  authorized: Array<{
    interactionKind: string;
    fieldRef: string;
    semanticResolutionReceipt: { receiptHash: string } | null;
    decisionReceipt: { receiptHash: string } | null;
  }>;
  unresolved: Array<Record<string, unknown>>;
  sequenceModelHashAfter: string;
  sequenceModelAfter: {
    resolvedInteractions?: Record<string, Record<string, Record<string, unknown>>>;
  };
  canonicalSemanticAuthority: {
    inputSourceAuthorityHash: string;
    semanticResolutionReceiptSetHash: string;
    semanticResolutionBindingSetHash: string;
    interactionResolutionReceiptSetHash: string;
    sequenceModelHashAfter: string;
    resolvedSourceRootSetHash: string;
    authorityHash: string;
  };
}

function semanticResolutionAuthorityBinding(receipt: Record<string, unknown>) {
  return {
    schemaVersion: receipt.schemaVersion,
    resolutionId: receipt.resolutionId,
    fieldRef: receipt.fieldRef,
    valueHash: receipt.valueHash,
    resolutionAuthorityClass: receipt.resolutionAuthorityClass,
    derivationRule: receipt.derivationRule,
    applicabilityProof: receipt.applicabilityProof,
    conflictingCandidates: [...((receipt.conflictingCandidates as string[]) ?? [])].sort(),
    sourceModelHashBefore: receipt.sourceModelHashBefore,
    sourceModelHashAfter: receipt.sourceModelHashAfter,
    resolverId: receipt.resolverId,
    resolutionRunId: receipt.resolutionRunId,
  };
}

function literalCount(source: string, value: string): number {
  return source.split(value).length - 1;
}

function runSemanticPipelineForSourceRoots(
  root: string,
  descriptor: InteractionFixtureDescriptor,
  sourceRoots: ReturnType<typeof buildInteractionSourceRoots>,
  executionConstraints?: {
    registry: {
      entries: Array<{ kind: 'CMD'; id: string; value: string }>;
    };
    refsBySourceRootId: Record<string, string[]>;
  }
) {
  const authoring = path.join(root, 'authoring');
  const intakeReceiptPath = path.join(authoring, 'intake', 'intake-receipt.json');
  const sourceContent = `${sourceRoots
    .map((sourceRoot) => JSON.stringify(sourceRoot.semanticBody))
    .join('\n')}\n`;
  const sourceDocumentPath = sourceRoots[0].sourcePath;
  const materializableRoots = sourceRoots.map((sourceRoot, index) => ({
    ...sourceRoot,
    sourcePath: sourceDocumentPath,
    sourceContent,
    sourceSpan: {
      startLine: index + 1,
      endLine: index + 1,
    },
  }));
  const sourcePath = path.join(root, sourceDocumentPath);
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, sourceContent, 'utf8');
  const intakeAuthority = materializeFileEntryIntake({
    projectRoot: root,
    recordRoot: root,
    requirementSetId: descriptor.refs.requirementSetId,
    entrySource: 'source_prd_draft',
    source: readCanonicalUtf8Source(sourcePath),
    capturedAt: new Date(0).toISOString(),
    intakeReceiptPath,
  });
  const intentLineageLedgerPath = path.join(authoring, 'intake', 'intent-lineage-ledger.json');
  const semanticResolutionDir = path.join(authoring, 'semantic-resolution');
  const intentLineageLedger = materializeEntryLineage({
    projectRoot: root,
    authority: intakeAuthority,
    sourceRoots: materializableRoots,
    lineageLedgerPath: intentLineageLedgerPath,
  });
  expect(intakeAuthority.intakeReceipt.schemaVersion).toBe(
    'requirements-contract-file-intake-receipt/v2'
  );
  expect(intentLineageLedger.schemaVersion).toBe('requirements-contract-intent-lineage-ledger/v2');
  const compactControlJson = JSON.stringify({
    intakeReceipt: intakeAuthority.intakeReceipt,
    intentLineageLedger,
  });
  expect(compactControlJson).not.toContain(sourceContent);
  expect(compactControlJson).not.toMatch(/"content":|classifications|classificationHash/u);
  expect(
    'materialRoots' in intentLineageLedger
      ? intentLineageLedger.materialRoots.map((root) => root.sourceRootId).sort()
      : []
  ).toEqual(materializableRoots.map((root) => root.sourceRootId).sort());
  mkdirSync(semanticResolutionDir, { recursive: true });
  const result = runRequirementsContractProductionSemanticPipeline({
    projectRoot: root,
    recordRoot: root,
    recordId: descriptor.refs.recordId,
    requirementSetId: descriptor.refs.requirementSetId,
    intakeReceiptPath,
    intakeReceipt: intakeAuthority.intakeReceipt,
    intentLineageLedgerPath,
    intentLineageLedger,
    sourceRootCandidates: materializableRoots.map(({ authorityClass, ...sourceRoot }) => ({
      ...sourceRoot,
      proposedAuthorityClass: authorityClass,
    })),
    semanticIrPath: path.join(authoring, 'semantic-ir.json'),
    semanticResolutionDir,
    interactionResolutionPath: path.join(authoring, 'interaction-resolution.json'),
    semanticConservationManifestPath: path.join(authoring, 'semantic-conservation-manifest.json'),
    ...(executionConstraints
      ? {
          executionRegistry: executionConstraints.registry,
          executionConstraintRefsBySourceRootId: executionConstraints.refsBySourceRootId,
        }
      : {}),
  });
  expect(result.sourceRoots.every((sourceRoot) => !('sourceContent' in sourceRoot))).toBe(true);
  expect(result.sourceRoots.every((sourceRoot) => 'sourceBlobRef' in sourceRoot)).toBe(true);
  return result;
}

function semanticReceiptFileNames(
  sourceRoots: ReturnType<typeof buildInteractionSourceRoots>
): string[] {
  return sourceRoots
    .map(
      (sourceRoot, index) =>
        `${String(index + 1).padStart(3, '0')}-${sourceRoot.sourceRootId.toLowerCase()}.receipt.json`
    )
    .sort();
}

function publishedSemanticBundleSnapshot(root: string): Record<string, string> {
  const authoring = path.join(root, 'authoring');
  const semanticResolutionDir = path.join(authoring, 'semantic-resolution');
  const files = [
    path.join(authoring, 'semantic-ir.json'),
    path.join(authoring, 'interaction-resolution.json'),
    path.join(authoring, 'semantic-conservation-manifest.json'),
    ...readdirSync(semanticResolutionDir)
      .filter((fileName) => fileName.endsWith('.receipt.json'))
      .sort()
      .map((fileName) => path.join(semanticResolutionDir, fileName)),
  ];
  return Object.fromEntries(
    files.map((filePath) => [
      path.relative(authoring, filePath).replace(/\\/gu, '/'),
      sha256Text(readFileSync(filePath, 'utf8')),
    ])
  );
}

describe('production interaction candidate extraction', () => {
  it('extracts proof-carrying participant, step, branch, ordering, and temporal candidates', () => {
    const roots = buildInteractionSourceRoots(PRIMARY_INTERACTION_FIXTURE);
    const extraction = extractProductionInteractionCandidates({
      sourceRoots: roots as ProductionInteractionSourceRoot[],
    });

    expect(extraction.unresolved).toEqual([]);
    expect(extraction.candidates.map((candidate) => candidate.interactionKind)).toEqual([
      'participant',
      'participant',
      'step',
      'step',
      'branch',
      'ordering',
      'temporal',
    ]);
    expect(
      extraction.candidates.every(
        (candidate) =>
          candidate.resolutionAuthorityClass === 'source_extracted' &&
          candidate.premises.length === 1 &&
          candidate.premises[0].kind === 'source'
      )
    ).toBe(true);
    expect(Object.keys(extraction.trustedSourceSnapshots)).toHaveLength(roots.length);
    for (const candidate of extraction.candidates) {
      const premise = candidate.premises[0];
      if (premise.kind !== 'source') throw new Error('expected a source premise');
      const snapshot = extraction.trustedSourceSnapshots[premise.sourcePath];
      expect(snapshot.hash).toBe(sha256Text(snapshot.content));
      expect(snapshot.extractions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldRef: candidate.fieldRef,
            valueHash: sha256Stable(candidate.value),
          }),
        ])
      );
    }
  });

  it('conserves typed execution refs through the production semantic pipeline', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'requirements-contract-execution-conservation-')
    );
    try {
      const sourceRoots = buildInteractionSourceRoots(PRIMARY_INTERACTION_FIXTURE);
      const result = runSemanticPipelineForSourceRoots(
        root,
        PRIMARY_INTERACTION_FIXTURE,
        sourceRoots,
        {
          registry: {
            entries: [
              {
                kind: 'CMD',
                id: 'interaction-targeted-test',
                value:
                  'npm test -- requirements-contract-production-interaction-extraction.test.ts',
              },
            ],
          },
          refsBySourceRootId: {
            [sourceRoots[0].sourceRootId]: ['CMD:interaction-targeted-test'],
          },
        }
      );

      expect(result.semanticConservationManifest.semanticNodes).toContainEqual(
        expect.objectContaining({
          nodeId: sourceRoots[0].sourceRootId,
          executionConstraintRefs: ['CMD:interaction-targeted-test'],
        })
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks production semantic publication when a typed execution ref is unknown', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-execution-unknown-'));
    try {
      const sourceRoots = buildInteractionSourceRoots(PRIMARY_INTERACTION_FIXTURE);
      expect(() =>
        runSemanticPipelineForSourceRoots(root, PRIMARY_INTERACTION_FIXTURE, sourceRoots, {
          registry: {
            entries: [
              {
                kind: 'CMD',
                id: 'interaction-targeted-test',
                value:
                  'npm test -- requirements-contract-production-interaction-extraction.test.ts',
              },
            ],
          },
          refsBySourceRootId: {
            [sourceRoots[0].sourceRootId]: ['CMD:missing'],
          },
        })
      ).toThrow(/requirements_execution_constraint_unknown/u);
      expect(() =>
        readFileSync(path.join(root, 'authoring', 'semantic-ir.json'), 'utf8')
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('feeds extracted candidates and trusted source snapshots into the production resolver', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-interactions-'));
    try {
      const sourceRoots = buildInteractionSourceRoots(PRIMARY_INTERACTION_FIXTURE);
      const result = runSemanticPipelineForSourceRoots(
        root,
        PRIMARY_INTERACTION_FIXTURE,
        sourceRoots
      );
      const authoring = path.join(root, 'authoring');
      const authorized = result.interactionResolution.authorized as Array<Record<string, unknown>>;
      const unresolved = result.interactionResolution.unresolved as Array<Record<string, unknown>>;
      const interactionResolution =
        result.interactionResolution as unknown as InteractionResolutionProjection;
      const resolvedRootProjection = sourceRoots
        .map((sourceRoot) => {
          const node = result.semanticIr.nodes[sourceRoot.sourceRootId];
          return {
            sourceRootId: sourceRoot.sourceRootId,
            rootClass: sourceRoot.rootClass,
            nodeType: node.nodeType,
            bodySchemaVersion: node.bodySchemaVersion,
            bodyHash: node.bodyHash,
            authorityClass: sourceRoot.authorityClass,
            relatedRequirementRefs: [...(sourceRoot.relatedRequirementRefs ?? [])].sort(),
          };
        })
        .sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId));
      const semanticResolutionReceiptSetHash = sha256Stable(
        result.semanticResolutionReceipts.map((receipt) => receipt.receiptHash).sort()
      );
      const semanticResolutionBindingSetHash = sha256Stable(
        result.semanticResolutionReceipts
          .map((receipt) =>
            sha256Stable(
              semanticResolutionAuthorityBinding(receipt as unknown as Record<string, unknown>)
            )
          )
          .sort()
      );
      const interactionResolutionReceiptSetHash = sha256Stable(
        interactionResolution.authorized
          .map(
            (entry) =>
              entry.semanticResolutionReceipt?.receiptHash ?? entry.decisionReceipt?.receiptHash
          )
          .filter((receiptHash): receiptHash is string => Boolean(receiptHash))
          .sort()
      );
      const resolvedSourceRootSetHash = sha256Stable(resolvedRootProjection);

      expect(authorized).toHaveLength(7);
      expect(unresolved).toEqual([]);
      expect(authorized.map((candidate) => candidate.interactionKind).sort()).toEqual([
        'branch',
        'ordering',
        'participant',
        'participant',
        'step',
        'step',
        'temporal',
      ]);
      expect(JSON.stringify(result.interactionResolution)).not.toContain('"User"');
      expect(JSON.stringify(result.interactionResolution)).not.toContain('"Agent"');
      expect(JSON.stringify(result.interactionResolution)).not.toContain('"Record"');
      expect(JSON.stringify(result.interactionResolution)).not.toContain('"Gate"');
      expect(
        JSON.parse(readFileSync(path.join(authoring, 'interaction-resolution.json'), 'utf8'))
      ).toEqual(result.interactionResolution);
      expect(interactionResolution.canonicalSemanticAuthority).toMatchObject({
        semanticResolutionReceiptSetHash,
        semanticResolutionBindingSetHash,
        interactionResolutionReceiptSetHash,
        sequenceModelHashAfter: interactionResolution.sequenceModelHashAfter,
        resolvedSourceRootSetHash,
      });
      expect(interactionResolution.canonicalSemanticAuthority.authorityHash).toBe(
        sha256Stable({
          inputSourceAuthorityHash:
            interactionResolution.canonicalSemanticAuthority.inputSourceAuthorityHash,
          semanticResolutionBindingSetHash,
          interactionResolutionReceiptSetHash,
          sequenceModelHashAfter: interactionResolution.sequenceModelHashAfter,
          resolvedSourceRootSetHash,
        })
      );
      expect(result.semanticIr.sourceAuthorityHash).toBe(
        interactionResolution.canonicalSemanticAuthority.authorityHash
      );
      expect(result.semanticConservationManifest.hashChain.sourceAuthorityHash).toBe(
        interactionResolution.canonicalSemanticAuthority.authorityHash
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform !== 'win32')(
    'publishes the semantic bundle from a long requirement-record path without using a long staging root',
    () => {
      const baseRoot = mkdtempSync(
        path.join(os.tmpdir(), 'requirements-contract-long-semantic-staging-')
      );
      const root = path.join(
        baseRoot,
        ...Array.from({ length: 6 }, () => `segment-${randomUUID()}`)
      );
      try {
        mkdirSync(root, { recursive: true });
        expect(path.join(root, 'authoring', '.s', 'r-XXXXXX').length).toBeGreaterThanOrEqual(260);
        const sourceRoots = buildInteractionSourceRoots(PRIMARY_INTERACTION_FIXTURE);
        const result = runSemanticPipelineForSourceRoots(
          root,
          PRIMARY_INTERACTION_FIXTURE,
          sourceRoots
        );
        expect(result.semanticResolutionReceipts.length).toBeGreaterThan(0);
        expect(readFileSync(path.join(root, 'authoring', 'semantic-ir.json'), 'utf8')).toContain(
          '"schemaVersion"'
        );
      } finally {
        rmSync(baseRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      }
    }
  );

  it('keeps compiler classification and requirement topology under Canonical IR authority', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-compiler-topology-'));
    try {
      const descriptor = ALTERNATE_INTERACTION_FIXTURE;
      const requirementRoot = createInteractionSourceRoot(
        descriptor,
        descriptor.refs.mustRequirementId,
        'functional_requirement',
        'requirements-contract-must-root/v1',
        {
          id: descriptor.refs.mustRequirementId,
          text: descriptor.semantics.orderingReason,
          sourceRequirementId: descriptor.refs.sourceRequirementId,
        },
        'requirement'
      );
      const targetRoot = createInteractionSourceRoot(
        descriptor,
        descriptor.refs.implementationPathId,
        'target_ownership',
        'requirements-contract-target-root/v1',
        {
          id: descriptor.refs.implementationPathId,
          path: descriptor.paths.targetPath,
          pathKind: 'file',
          coverageRole: 'modify',
        },
        'target'
      );
      const commandRoot = createInteractionSourceRoot(
        descriptor,
        descriptor.refs.commandId,
        'validation_obligation',
        'requirements-contract-validation-root/v1',
        {
          id: descriptor.refs.commandId,
          command: `npx vitest run ${descriptor.paths.testPath}`,
          workingDirectory: '.',
          targetPathRefs: [descriptor.refs.implementationPathId],
        },
        'oracle'
      );
      const sourceRoots = [requirementRoot, targetRoot, commandRoot];
      const result = runSemanticPipelineForSourceRoots(root, descriptor, sourceRoots);
      const baseline = buildCanonicalPreCheckpointCompilerInput({
        semanticIr: result.semanticIr,
        semanticConservationManifest: result.semanticConservationManifest,
        sourceRoots,
      });
      const tamperedRoots = sourceRoots.map((sourceRoot, index) => ({
        ...sourceRoot,
        rootClass: ['validation_obligation', 'functional_requirement', 'target_ownership'][index],
        relatedRequirementRefs: [],
      }));
      const tampered = buildCanonicalPreCheckpointCompilerInput({
        semanticIr: result.semanticIr,
        semanticConservationManifest: result.semanticConservationManifest,
        sourceRoots: tamperedRoots,
      });

      expect(tampered).toEqual(baseline);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a schema-valid Conservation Manifest with a different source authority hash', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-authority-binding-'));
    try {
      const descriptor = ALTERNATE_INTERACTION_FIXTURE;
      const sourceRoots = buildInteractionSourceRoots(descriptor);
      const result = runSemanticPipelineForSourceRoots(root, descriptor, sourceRoots);
      const tamperedManifest = structuredClone(result.semanticConservationManifest);
      tamperedManifest.hashChain.sourceAuthorityHash = sha256Stable({
        previous: result.semanticIr.sourceAuthorityHash,
        mutation: descriptor.refs.requirementSetId,
      });
      const { manifestHash: _manifestHash, ...manifestPayload } = tamperedManifest;
      const {
        semanticConservationManifestHash: _semanticConservationManifestHash,
        ...hashChainWithoutSelf
      } = manifestPayload.hashChain;
      tamperedManifest.manifestHash = sha256Stable({
        ...manifestPayload,
        hashChain: hashChainWithoutSelf,
      });
      tamperedManifest.hashChain.semanticConservationManifestHash = tamperedManifest.manifestHash;

      expect(validateRequirementsContractSemanticConservationManifest(tamperedManifest)).toBe(true);
      expect(() =>
        buildCanonicalPreCheckpointCompilerInput({
          semanticIr: result.semanticIr,
          semanticConservationManifest: tamperedManifest,
          sourceRoots,
        })
      ).toThrow(/source authority hash/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps fixture identities under the seed-derived descriptor authority', () => {
    const testPath = fileURLToPath(import.meta.url);
    const helperPath = path.join(
      path.dirname(testPath),
      'helpers',
      'requirements-contract-interaction-fixture.ts'
    );
    const source = `${readFileSync(testPath, 'utf8')}\n${readFileSync(helperPath, 'utf8')}`;

    for (const descriptor of [PRIMARY_INTERACTION_FIXTURE, ALTERNATE_INTERACTION_FIXTURE]) {
      const seedAuthorizedValues = [
        descriptor.semantics.actorLabel,
        descriptor.semantics.componentLabel,
        descriptor.semantics.owningSystem,
        descriptor.semantics.targetExportName,
        descriptor.semantics.commandOperation,
        descriptor.semantics.resultOperation,
        descriptor.semantics.branchCondition,
        descriptor.semantics.correlationKey,
        String(descriptor.timing.deadlineMs),
      ];
      for (const value of seedAuthorizedValues) {
        expect(literalCount(source, value), `copied seed identity: ${value}`).toBe(1);
      }

      const derivedValues = [
        ...Object.values(descriptor.paths),
        ...Object.values(descriptor.refs),
        descriptor.semantics.orderingReason,
        descriptor.timing.orderingPolicy,
      ];
      for (const value of derivedValues) {
        expect(literalCount(source, value), `hard-coded derived identity: ${value}`).toBe(0);
      }
    }

    expect(source).not.toMatch(/writeFileSync\(\s*sourcePath,\s*\[/u);
  });

  it('replaces the prior semantic receipt generation with the current exact set', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-semantic-generation-'));
    try {
      const primaryRoots = buildInteractionSourceRoots(PRIMARY_INTERACTION_FIXTURE);
      const alternateRoots = buildInteractionSourceRoots(ALTERNATE_INTERACTION_FIXTURE);

      runSemanticPipelineForSourceRoots(root, PRIMARY_INTERACTION_FIXTURE, primaryRoots);
      const result = runSemanticPipelineForSourceRoots(
        root,
        ALTERNATE_INTERACTION_FIXTURE,
        alternateRoots
      );
      const receiptFiles = readdirSync(path.join(root, 'authoring', 'semantic-resolution'))
        .filter((fileName) => fileName.endsWith('.receipt.json'))
        .sort();

      expect(receiptFiles).toEqual(semanticReceiptFileNames(alternateRoots));
      expect(Object.keys(result.semanticIr.nodes).sort()).toEqual(
        alternateRoots.map((sourceRoot) => sourceRoot.sourceRootId).sort()
      );
      expect(receiptFiles).not.toEqual(semanticReceiptFileNames(primaryRoots));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves the published semantic generation when interaction resolution blocks', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-semantic-rollback-'));
    try {
      const primaryRoots = buildInteractionSourceRoots(PRIMARY_INTERACTION_FIXTURE);
      runSemanticPipelineForSourceRoots(root, PRIMARY_INTERACTION_FIXTURE, primaryRoots);
      const publishedBefore = publishedSemanticBundleSnapshot(root);
      const syntheticRoot = createInteractionSourceRoot(
        ALTERNATE_INTERACTION_FIXTURE,
        ALTERNATE_INTERACTION_FIXTURE.refs.actorParticipantId,
        'sequence_participant',
        'requirements-contract-sequence-participant-root/v1',
        {
          id: 'Agent',
          kind: 'runtime_component',
          label: 'Agent',
          owningSystem: ALTERNATE_INTERACTION_FIXTURE.semantics.owningSystem,
          requirementRefs: [ALTERNATE_INTERACTION_FIXTURE.refs.mustRequirementId],
        }
      );

      expect(() =>
        runSemanticPipelineForSourceRoots(root, ALTERNATE_INTERACTION_FIXTURE, [syntheticRoot])
      ).toThrow(/Interaction semantic resolution blocked/u);
      expect(publishedSemanticBundleSnapshot(root)).toEqual(publishedBefore);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['User', 'Agent', 'Record', 'Gate'])(
    'keeps the synthetic participant %s outside the resolved sequence model',
    (identity) => {
      const syntheticRoot = createInteractionSourceRoot(
        PRIMARY_INTERACTION_FIXTURE,
        `PARTICIPANT-${identity.toUpperCase()}`,
        'sequence_participant',
        'requirements-contract-sequence-participant-root/v1',
        {
          id: identity,
          kind: 'runtime_component',
          label: identity,
          owningSystem: PRIMARY_INTERACTION_FIXTURE.semantics.owningSystem,
          requirementRefs: [PRIMARY_INTERACTION_FIXTURE.refs.mustRequirementId],
        }
      );
      const extraction = extractProductionInteractionCandidates({
        sourceRoots: [syntheticRoot],
      });

      expect(extraction.candidates).toEqual([]);
      expect(extraction.unresolved).toEqual([
        expect.objectContaining({
          interactionKind: 'participant',
          reasonCode: 'synthetic_participant_forbidden',
        }),
      ]);
    }
  );

  it('blocks unresolved typed interaction roots before publishing canonical semantic IR', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-interaction-block-'));
    try {
      const syntheticRoot = createInteractionSourceRoot(
        PRIMARY_INTERACTION_FIXTURE,
        'PARTICIPANT-SYNTHETIC',
        'sequence_participant',
        'requirements-contract-sequence-participant-root/v1',
        {
          id: 'Agent',
          kind: 'runtime_component',
          label: 'Agent',
          owningSystem: PRIMARY_INTERACTION_FIXTURE.semantics.owningSystem,
          requirementRefs: [PRIMARY_INTERACTION_FIXTURE.refs.mustRequirementId],
        }
      );
      const authoring = path.join(root, 'authoring');
      const semanticIrPath = path.join(authoring, 'semantic-ir.json');

      expect(() =>
        runSemanticPipelineForSourceRoots(root, PRIMARY_INTERACTION_FIXTURE, [syntheticRoot])
      ).toThrow(/Interaction semantic resolution blocked/u);
      expect(() => readFileSync(semanticIrPath, 'utf8')).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
