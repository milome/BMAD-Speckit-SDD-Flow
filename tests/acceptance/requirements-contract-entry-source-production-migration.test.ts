import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  sha256Stable,
  validateSemanticResolutionReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { semanticModelHash as semanticModelHashForContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
import { validateRequirementsContractSemanticConservationManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-conservation-manifest';
import { validateRequirementContractModelV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import * as productionSemanticPipeline from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';
import {
  createRequirementsContractIntentLineageLedger,
  validateRequirementsContractIntentLineageLedger,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-intent-lineage';

const PROJECT_ROOT = process.cwd();
const PACKAGE_CLI = path.join(PROJECT_ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

function fixtureDigest(seed: string, role: string): string {
  return createHash('sha256').update(`${seed}\0${role}`).digest('hex');
}

function fixtureOrdinal(seed: string, role: string): string {
  const ordinal = 100 + (Number.parseInt(fixtureDigest(seed, role).slice(0, 8), 16) % 900);
  return String(ordinal).padStart(3, '0');
}

function createEntrySourceFixture(
  seed: string,
  options: {
    includeMust?: boolean;
    includeNonFunctional?: boolean;
    includeNegative?: boolean;
    includeBoundary?: boolean;
  } = {}
) {
  const fixtureToken = (role: string) => fixtureDigest(seed, role).slice(0, 12);
  const semanticAuthority = {
    must: {
      id: `MUST-FR-${fixtureOrdinal(seed, 'must')}`,
      text: 'Preserve source spans while parsing the session document.',
    },
    nonFunctional: {
      id: `MUST-NFR-${fixtureOrdinal(seed, 'non-functional')}`,
      text: 'Reject stale session input before semantic compilation.',
    },
    negative: {
      id: `NEG-${fixtureOrdinal(seed, 'negative')}`,
      text: 'The parser must not silently drop a material requirement.',
    },
    boundary: {
      id: `OUT-${fixtureOrdinal(seed, 'boundary')}`,
      text: 'A graphical editor is outside this implementation scope.',
    },
  } as const;
  const sessionAuthority = {
    requirementSetId: `REQ-${fixtureToken('requirement-set').toUpperCase()}`,
    sessionId: `session-${fixtureToken('session')}`,
    turnId: `turn-${fixtureToken('turn')}`,
    messageId: `message-${fixtureToken('message')}`,
    actorIdentityClass: 'requesting_user',
    branch: `consumer-${fixtureToken('branch')}`,
    capturedAt: '2026-07-14T00:00:00.000Z',
  } as const;
  const negativeSection =
    options.includeNegative === false
      ? []
      : [
          '## Negative Requirements And Not Done Conditions',
          '',
          '| ID | Not-done condition | Negative assertion | Blocks completion when |',
          '|---|---|---|---|',
          `| ${semanticAuthority.negative.id} | ${semanticAuthority.negative.text} | ${semanticAuthority.negative.text} | The negative assertion is unproved. |`,
          '',
        ];
  const boundarySection =
    options.includeBoundary === false
      ? []
      : [
          '## Out Of Scope',
          '',
          '| ID | Out of scope | Boundary assertion |',
          '|---|---|---|',
          `| ${semanticAuthority.boundary.id} | ${semanticAuthority.boundary.text} | The graphical editor remains excluded. |`,
          '',
        ];
  const sessionRequirement = [
    '# Session Requirement',
    '',
    ...(options.includeMust === false
      ? []
      : [`${semanticAuthority.must.id}: ${semanticAuthority.must.text}`, '']),
    ...(options.includeNonFunctional === true
      ? [`${semanticAuthority.nonFunctional.id}: ${semanticAuthority.nonFunctional.text}`, '']
      : []),
    ...negativeSection,
    ...boundarySection,
    'Target path: `src/session-parser.ts`',
    'Validation command: npx vitest run tests/session-parser.test.ts',
    '',
  ].join('\n');

  return {
    semanticAuthority,
    sessionAuthority,
    sessionRequirement,
  };
}

type EntrySourceFixture = ReturnType<typeof createEntrySourceFixture>;

function authoringPaths(root: string, requirementSetId: string) {
  const authoring = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'authoring'
  );
  return {
    authoring,
    semanticIr: path.join(authoring, 'semantic-ir.json'),
    semanticResolutionDir: path.join(authoring, 'resolution', 'semantic'),
    interactionResolution: path.join(authoring, 'interaction-resolution.json'),
    semanticConservationManifest: path.join(
      authoring,
      'proofs',
      'semantic-conservation-manifest.json'
    ),
    lifecycleValidationReport: path.join(
      authoring,
      'proofs',
      'confirmation-ready-validation-report.json'
    ),
    intakeReceipt: path.join(authoring, 'intake', 'intake-receipt.json'),
    intentLineageLedger: path.join(authoring, 'intake', 'intent-lineage-ledger.json'),
    compilerClosureReport: path.join(authoring, 'compiler-closure-report.json'),
    compiledModel: path.join(authoring, 'requirement-contract-model.json'),
    scaleAssessmentInitial: path.join(authoring, 'scale-assessment-initial.json'),
  };
}

function semanticIrHash(ir: Record<string, unknown>): string {
  const { semanticModelHash: _semanticModelHash, ...preimage } = ir;
  return semanticModelHashForContract(preimage);
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function runProductionEntry(
  root: string,
  sourcePath: string,
  targetPath: string,
  sessionAuthority: EntrySourceFixture['sessionAuthority']
) {
  const result = spawnSync(
    process.execPath,
    [
      PACKAGE_CLI,
      'main-agent-orchestration',
      '--cwd',
      root,
      '--action',
      'author-confirmation-ready-source',
      '--intake-source',
      sourcePath,
      '--target-source',
      targetPath,
      '--request-id',
      sessionAuthority.requirementSetId,
      '--confirmation-language',
      'en-US',
      '--json',
    ],
    {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    }
  );
  return {
    ...result,
    json: result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

describe('requirement entry-source production migration', () => {
  it('materializes validated Intent Lineage before planning semantic Source Root candidates', () => {
    const orchestrationSource = readFileSync(
      path.join(
        PROJECT_ROOT,
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'scripts',
        'main-agent-orchestration.ts'
      ),
      'utf8'
    );
    const sectionStart = orchestrationSource.indexOf(
      'let productionSemanticPipeline: ProductionSemanticPipelineResult | null = null;'
    );
    const sectionEnd = orchestrationSource.indexOf(
      'const projectionSanity = projectionDomainSanityCheck',
      sectionStart
    );
    const productionSection = orchestrationSource.slice(sectionStart, sectionEnd);
    const lineageIndex = productionSection.indexOf('materializeEntryLineage({');
    const candidatePlanningIndex = productionSection.indexOf(
      'planProductionSemanticSourceRootCandidates({'
    );

    expect(sectionStart).toBeGreaterThanOrEqual(0);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(lineageIndex).toBeGreaterThanOrEqual(0);
    expect(candidatePlanningIndex).toBeGreaterThanOrEqual(0);
    expect(lineageIndex).toBeLessThan(candidatePlanningIndex);
  });

  it('keeps authority-bearing Source Root materialization behind validated Intent Lineage', () => {
    expect(productionSemanticPipeline.materializeProductionSemanticSourceRoots).toBeTypeOf(
      'function'
    );
    expect(() =>
      productionSemanticPipeline.materializeProductionSemanticSourceRoots({
        requirementSetId: 'REQ-LINEAGE-GATE',
        intakeReceipt: null,
        intentLineageLedger: null,
        sourceRootCandidates: [],
      } as never)
    ).toThrow(/valid Intake Receipt and Intent Lineage/u);
  });

  it('runs resolver and interaction resolution before publishing conserved canonical Semantic IR', () => {
    const fixture = createEntrySourceFixture('semantic-pipeline');
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-semantic-pipeline-'));
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const sourcePath = path.join(inputDir, 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = authoringPaths(root, fixture.sessionAuthority.requirementSetId);
      expect(
        existsSync(paths.semanticIr),
        [
          'canonical Semantic IR missing',
          `exit=${String(result.status)}`,
          `stdout=${result.stdout}`,
          `stderr=${result.stderr}`,
        ].join('; ')
      ).toBe(true);
      expect(existsSync(paths.semanticResolutionDir)).toBe(true);
      expect(existsSync(paths.interactionResolution)).toBe(true);
      expect(existsSync(paths.semanticConservationManifest)).toBe(true);

      const semanticIr = JSON.parse(readFileSync(paths.semanticIr, 'utf8')) as Record<string, any>;
      const interactionResolution = JSON.parse(
        readFileSync(paths.interactionResolution, 'utf8')
      ) as Record<string, any>;
      const manifest = JSON.parse(
        readFileSync(paths.semanticConservationManifest, 'utf8')
      ) as Record<string, any>;
      const lifecycleValidation = JSON.parse(
        readFileSync(paths.lifecycleValidationReport, 'utf8')
      ) as Record<string, any>;
      const receiptFiles = readdirSync(paths.semanticResolutionDir)
        .filter((name) => name.endsWith('.receipt.json'))
        .sort();
      const receipts = receiptFiles.map((name) =>
        JSON.parse(readFileSync(path.join(paths.semanticResolutionDir, name), 'utf8'))
      );

      expect(semanticIr).toMatchObject({
        schemaVersion: 'requirement-contract-model/v2',
        activationState: 'inactive_schema_boundary',
        recordId: fixture.sessionAuthority.requirementSetId,
        requirementSetId: fixture.sessionAuthority.requirementSetId,
        authority: 'none',
      });
      expect(validateRequirementContractModelV2(semanticIr)).toEqual({
        ok: true,
        issues: [],
      });
      expect(semanticIr.semanticModelHash).toBe(semanticIrHash(semanticIr));
      expect(interactionResolution).toMatchObject({
        resolverId: 'requirements-contract-interaction-resolver',
        authorized: expect.any(Array),
        unresolved: expect.any(Array),
        sequenceModelHashBefore: expect.stringMatching(/^sha256:/u),
        sequenceModelHashAfter: expect.stringMatching(/^sha256:/u),
      });
      expect(receipts).toHaveLength(manifest.sourceRoots.length);
      expect(receipts.every(validateSemanticResolutionReceipt)).toBe(true);
      expect(validateRequirementsContractSemanticConservationManifest(manifest)).toBe(true);
      expect(manifest.semanticModelHash).toBe(semanticIr.semanticModelHash);
      expect(manifest.sourceToIrMissingRootCount).toBe(0);
      expect(manifest.sourceToIrExtraRootCount).toBe(0);
      expect(manifest.sourceToIrPayloadMismatchCount).toBe(0);
      expect(manifest.sourceToIrAuthorityMismatchCount).toBe(0);
      expect(manifest.sourceToIrDuplicateRootCount).toBe(0);
      expect(manifest.sourceRoots).toHaveLength(manifest.semanticNodes.length);
      const validationFacadePath = path.join(
        PROJECT_ROOT,
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'scripts',
        'requirements-contract-validation-facade.ts'
      );
      expect(manifest.validationFacade).toEqual({
        id: 'requirements-contract-validation-facade',
        hash: fileHash(validationFacadePath),
      });
      expect(lifecycleValidation).toMatchObject({
        schemaVersion: 'requirements-contract-lifecycle-validation-report/v1',
        requirementSetId: fixture.sessionAuthority.requirementSetId,
        semanticModelHash: semanticIr.semanticModelHash,
        mode: 'confirmation-ready',
        decision: 'pass',
        ok: true,
        facade: manifest.validationFacade,
        issues: [],
      });
      for (const node of manifest.semanticNodes) {
        expect(semanticIr.nodes[node.nodeId]?.bodyHash).toBe(node.nodeHash);
      }

      expect(
        existsSync(paths.scaleAssessmentInitial),
        [
          'initial assessment missing after semantic conservation and compiler closure',
          `exit=${String(result.status)}`,
          `stdout=${result.stdout}`,
          `stderr=${result.stderr}`,
        ].join('; ')
      ).toBe(true);
      const assessment = JSON.parse(readFileSync(paths.scaleAssessmentInitial, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(assessment).toMatchObject({
        semanticModelHash: semanticIr.semanticModelHash,
        semanticConservationManifestHash: manifest.manifestHash,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('persists current session intake and lineage before semantic compilation', () => {
    const fixture = createEntrySourceFixture('intake-lineage');
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-production-'));
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const sourcePath = path.join(inputDir, 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const authorityRoot = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.sessionAuthority.requirementSetId,
        'authoring'
      );
      const intakeReceiptPath = path.join(authorityRoot, 'intake', 'intake-receipt.json');
      const lineageLedgerPath = path.join(authorityRoot, 'intake', 'intent-lineage-ledger.json');

      expect(
        existsSync(intakeReceiptPath),
        [
          'production entry did not persist Intake Receipt',
          `exit=${String(result.status)}`,
          `stdout=${result.stdout}`,
          `stderr=${result.stderr}`,
        ].join('; ')
      ).toBe(true);
      expect(
        existsSync(lineageLedgerPath),
        `production entry did not persist Intent Lineage; stderr=${result.stderr}`
      ).toBe(true);

      const intakeReceipt = JSON.parse(readFileSync(intakeReceiptPath, 'utf8'));
      const lineageLedger = JSON.parse(readFileSync(lineageLedgerPath, 'utf8'));
      expect(intakeReceipt).toMatchObject({
        schemaVersion: 'requirements-contract-intake-receipt/v1',
        requirementSetId: fixture.sessionAuthority.requirementSetId,
        sessionId: fixture.sessionAuthority.sessionId,
        branch: fixture.sessionAuthority.branch,
        entrySource: 'session_requirements',
        requestedArtifactRole: 'requirement_source_prd',
        capturedAt: fixture.sessionAuthority.capturedAt,
      });
      const sourceBytes = Buffer.from(fixture.sessionRequirement, 'utf8');
      expect(intakeReceipt.excerpts.length).toBeGreaterThan(1);
      expect(
        intakeReceipt.excerpts.map((excerpt: { content: string }) => excerpt.content).join('')
      ).toBe(fixture.sessionRequirement);
      let expectedStartUtf8Byte = 0;
      for (const [index, excerpt] of intakeReceipt.excerpts.entries()) {
        const excerptByteLength = Buffer.byteLength(excerpt.content, 'utf8');
        expect(excerpt).toMatchObject({
          order: index + 1,
          turnId: fixture.sessionAuthority.turnId,
          actorIdentityClass: fixture.sessionAuthority.actorIdentityClass,
          boundary: {
            kind: 'span',
            messageId: fixture.sessionAuthority.messageId,
            startUtf8Byte: expectedStartUtf8Byte,
            endUtf8ByteExclusive: expectedStartUtf8Byte + excerptByteLength,
          },
        });
        expect(excerptByteLength).toBeGreaterThan(0);
        expectedStartUtf8Byte += excerptByteLength;
      }
      expect(expectedStartUtf8Byte).toBe(sourceBytes.length);
      expect(lineageLedger).toMatchObject({
        schemaVersion: 'requirements-contract-intent-lineage-ledger/v1',
        requirementSetId: fixture.sessionAuthority.requirementSetId,
        intakeReceiptHash: intakeReceipt.receiptHash,
        materialSpanIds: intakeReceipt.excerpts.map(
          (excerpt: { excerptId: string }) => excerpt.excerptId
        ),
      });
      expect(lineageLedger.classifications).toHaveLength(intakeReceipt.excerpts.length);
      expect(
        new Set(
          lineageLedger.classifications.map(
            (classification: { spanId: string }) => classification.spanId
          )
        ).size
      ).toBe(intakeReceipt.excerpts.length);
      const classificationBySpanId = new Map(
        lineageLedger.classifications.map((classification: { spanId: string }) => [
          classification.spanId,
          classification,
        ])
      );
      const headingExcerpt = intakeReceipt.excerpts.find(
        (excerpt: { content: string }) => excerpt.content.trim() === '# Session Requirement'
      );
      const blankExcerpt = intakeReceipt.excerpts.find(
        (excerpt: { content: string }) => excerpt.content.trim() === ''
      );
      const mustExcerpt = intakeReceipt.excerpts.find((excerpt: { content: string }) =>
        excerpt.content.includes(fixture.semanticAuthority.must.id)
      );
      expect(headingExcerpt).toBeTruthy();
      expect(blankExcerpt).toBeTruthy();
      expect(mustExcerpt).toBeTruthy();
      expect(classificationBySpanId.get(headingExcerpt.excerptId)).toMatchObject({
        disposition: 'excluded',
        classificationRule: 'session-entry-source-span-mapping/v1',
        exclusionRuleRef: 'non-semantic-source-line/v1',
      });
      expect(classificationBySpanId.get(blankExcerpt.excerptId)).toMatchObject({
        disposition: 'excluded',
        classificationRule: 'session-entry-source-span-mapping/v1',
        exclusionRuleRef: 'non-semantic-source-line/v1',
      });
      expect(classificationBySpanId.get(mustExcerpt.excerptId)).toMatchObject({
        disposition: 'source_root',
        classificationRule: 'session-entry-source-span-mapping/v1',
        sourceRootRefs: [fixture.semanticAuthority.must.id],
      });
      expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a schema-valid Session Lineage ledger whose Source Root refs are swapped across spans', () => {
    const fixture = createEntrySourceFixture('session-lineage-span-mutation', {
      includeNonFunctional: true,
    });
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-lineage-mutation-'));
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const sourcePath = path.join(inputDir, 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = authoringPaths(root, fixture.sessionAuthority.requirementSetId);
      for (const artifactPath of [
        paths.intakeReceipt,
        paths.intentLineageLedger,
        paths.semanticIr,
        paths.semanticConservationManifest,
      ]) {
        expect(
          existsSync(artifactPath),
          `production semantic artifact missing: ${artifactPath}; exit=${String(result.status)}; stderr=${result.stderr}`
        ).toBe(true);
      }

      const intakeReceipt = JSON.parse(readFileSync(paths.intakeReceipt, 'utf8'));
      const lineageLedger = JSON.parse(readFileSync(paths.intentLineageLedger, 'utf8'));
      const semanticIr = JSON.parse(readFileSync(paths.semanticIr, 'utf8'));
      const manifest = JSON.parse(readFileSync(paths.semanticConservationManifest, 'utf8'));
      const semanticReceipts = readdirSync(paths.semanticResolutionDir)
        .filter((name) => name.endsWith('.receipt.json'))
        .map((name) =>
          JSON.parse(readFileSync(path.join(paths.semanticResolutionDir, name), 'utf8'))
        );
      const receiptBySourceRootId = new Map(
        semanticReceipts.map((receipt) => [String(receipt.fieldRef).split('/').at(-1), receipt])
      );
      const sourceRootCandidates = manifest.sourceRoots.map((manifestRoot: Record<string, any>) => {
        const sourceRootId = String(manifestRoot.sourceRootId);
        const node = semanticIr.nodes[sourceRootId];
        const receipt = receiptBySourceRootId.get(sourceRootId);
        const sourcePremise = receipt?.premises?.find(
          (premise: Record<string, unknown>) => premise.kind === 'source'
        );
        expect(node).toBeTruthy();
        expect(sourcePremise).toBeTruthy();
        const resolvedSourcePath = path.resolve(root, String(sourcePremise.sourcePath));
        return {
          sourceRootId,
          rootClass: String(manifestRoot.rootClass),
          nodeType: node.nodeType,
          bodySchemaVersion: node.bodySchemaVersion,
          semanticBody: semanticIr.semanticBodies[node.bodyHash],
          sourcePath: String(sourcePremise.sourcePath),
          sourceContent: readFileSync(resolvedSourcePath, 'utf8'),
          sourceSpan: sourcePremise.sourceSpan,
          proposedAuthorityClass: String(manifestRoot.authorityClass),
          relatedRequirementRefs: Object.values(semanticIr.edges)
            .filter((edge: any) => edge.toRef === sourceRootId && typeof edge.fromRef === 'string')
            .map((edge: any) => edge.fromRef),
        };
      });
      const classificationInputs = lineageLedger.classifications.map(
        ({ sourceHash: _sourceHash, classificationHash: _classificationHash, ...row }: any) =>
          row.disposition === 'source_root'
            ? { ...row, sourceRootRefs: [...row.sourceRootRefs] }
            : { ...row }
      );
      const sourceRootRows = classificationInputs
        .map((row: any, index: number) => ({ row, index }))
        .filter(({ row }: any) => row.disposition === 'source_root');
      const left = sourceRootRows.find(({ row: leftRow }: any) =>
        sourceRootRows.some(
          ({ row: rightRow }: any) =>
            JSON.stringify(rightRow.sourceRootRefs) !== JSON.stringify(leftRow.sourceRootRefs)
        )
      );
      const right = left
        ? sourceRootRows.find(
            ({ row: rightRow }: any) =>
              JSON.stringify(rightRow.sourceRootRefs) !== JSON.stringify(left.row.sourceRootRefs)
          )
        : undefined;
      expect(left).toBeTruthy();
      expect(right).toBeTruthy();
      if (!left || !right) throw new Error('Production lineage did not expose swappable spans');

      const originalRootRefSet = [
        ...new Set(sourceRootRows.flatMap(({ row }: any) => row.sourceRootRefs as string[])),
      ].sort();
      const leftRefs = [...left.row.sourceRootRefs];
      classificationInputs[left.index].sourceRootRefs = [...right.row.sourceRootRefs];
      classificationInputs[right.index].sourceRootRefs = leftRefs;
      const mutatedLedger = createRequirementsContractIntentLineageLedger({
        intakeReceiptPath: lineageLedger.intakeReceiptPath,
        intakeReceipt,
        classifications: classificationInputs,
      });
      const mutatedRootRefSet = [
        ...new Set(
          mutatedLedger.classifications.flatMap((row) =>
            row.disposition === 'source_root' ? row.sourceRootRefs : []
          )
        ),
      ].sort();

      expect(validateRequirementsContractIntentLineageLedger(mutatedLedger)).toBe(true);
      expect(mutatedRootRefSet).toEqual(originalRootRefSet);
      expect(() =>
        productionSemanticPipeline.materializeProductionSemanticSourceRoots({
          requirementSetId: fixture.sessionAuthority.requirementSetId,
          intakeReceipt,
          intentLineageLedger: mutatedLedger,
          sourceRootCandidates,
        })
      ).toThrow(/exact source span/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('compiles source-grounded semantics independently of fixture identities', () => {
    const observedIdentitySets: string[][] = [];
    for (const seed of ['source-grounded-primary', 'source-grounded-renamed']) {
      const fixture = createEntrySourceFixture(seed);
      const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-compiler-'));
      try {
        const inputDir = path.join(root, 'input');
        mkdirSync(inputDir, { recursive: true });
        const sourcePath = path.join(inputDir, 'session-requirement.md');
        const targetPath = path.join(root, 'requirements', 'source-prd.md');
        const canonicalSourcePath = path.relative(root, sourcePath).replace(/\\/g, '/');
        writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');
        const expectedSourceHash = fileHash(sourcePath);

        const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
        const modelPath = path.join(
          root,
          '_bmad-output',
          'runtime',
          'requirement-records',
          fixture.sessionAuthority.requirementSetId,
          'authoring',
          'requirement-contract-model.json'
        );
        expect(
          existsSync(modelPath),
          [
            'production entry did not persist the compiled model',
            `exit=${String(result.status)}`,
            `stdout=${result.stdout}`,
            `stderr=${result.stderr}`,
          ].join('; ')
        ).toBe(true);

        const model = JSON.parse(readFileSync(modelPath, 'utf8'));
        const expectedIdentities = [
          fixture.semanticAuthority.must.id,
          fixture.semanticAuthority.negative.id,
          fixture.semanticAuthority.boundary.id,
        ];
        observedIdentitySets.push(expectedIdentities);
        expect(model.must.map((row: { id: string }) => row.id)).toEqual([
          fixture.semanticAuthority.must.id,
        ]);
        expect(model.must[0].provenance).toMatchObject({
          sourcePath: canonicalSourcePath,
          sourceHash: expectedSourceHash,
        });
        expect(model.notDone).toHaveLength(1);
        expect(model.notDone[0]).toMatchObject({
          id: fixture.semanticAuthority.negative.id,
          text: fixture.semanticAuthority.negative.text,
          authorityState: 'source_grounded',
        });
        expect(model.notDone[0].provenance).toMatchObject({
          sourcePath: canonicalSourcePath,
          sourceHash: expectedSourceHash,
        });
        expect(model.outOfScope).toHaveLength(1);
        expect(model.outOfScope[0]).toMatchObject({
          id: fixture.semanticAuthority.boundary.id,
          text: fixture.semanticAuthority.boundary.text,
          authorityState: 'source_grounded',
        });
        expect(model.outOfScope[0].provenance).toMatchObject({
          sourcePath: canonicalSourcePath,
          sourceHash: expectedSourceHash,
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
    expect(observedIdentitySets[0]).not.toEqual(observedIdentitySets[1]);
  });

  it('uses the canonical parser for escaped, code-span, and link pipes at the package CLI entry', () => {
    const fixture = createEntrySourceFixture('canonical-parser-production');
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-canonical-parser-'));
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const sourcePath = path.join(inputDir, 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      const canonicalNegativeText =
        'Preserve visible \\| value, `left|right`, and [proof|ref](docs/proof.md).';
      const source = fixture.sessionRequirement.replaceAll(
        fixture.semanticAuthority.negative.text,
        canonicalNegativeText
      );
      writeFileSync(sourcePath, source, 'utf8');

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = authoringPaths(root, fixture.sessionAuthority.requirementSetId);
      expect(
        existsSync(paths.compiledModel),
        `canonical parser production model missing; exit=${String(result.status)}; stderr=${result.stderr}`
      ).toBe(true);
      const model = JSON.parse(readFileSync(paths.compiledModel, 'utf8')) as Record<string, any>;
      expect(model.notDone).toContainEqual(
        expect.objectContaining({
          id: fixture.semanticAuthority.negative.id,
          text: 'Preserve visible | value, `left|right`, and [proof|ref](docs/proof.md).',
        })
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('feeds conserved FR and NFR Semantic IR into the preliminary compiler boundary', () => {
    const fixture = createEntrySourceFixture('canonical-compiler-input', {
      includeNonFunctional: true,
    });
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-canonical-compiler-'));
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const sourcePath = path.join(inputDir, 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = authoringPaths(root, fixture.sessionAuthority.requirementSetId);
      expect(
        existsSync(paths.compiledModel) && existsSync(paths.compilerClosureReport),
        [
          'canonical compiler artifacts missing',
          `exit=${String(result.status)}`,
          `stdout=${result.stdout}`,
          `stderr=${result.stderr}`,
        ].join('; ')
      ).toBe(true);

      const semanticIr = JSON.parse(readFileSync(paths.semanticIr, 'utf8')) as Record<string, any>;
      const manifest = JSON.parse(
        readFileSync(paths.semanticConservationManifest, 'utf8')
      ) as Record<string, any>;
      const model = JSON.parse(readFileSync(paths.compiledModel, 'utf8')) as Record<string, any>;
      const report = JSON.parse(readFileSync(paths.compilerClosureReport, 'utf8')) as Record<
        string,
        any
      >;
      const expectedMustIds = [
        fixture.semanticAuthority.must.id,
        fixture.semanticAuthority.nonFunctional.id,
      ];

      expect(model.must.map((row: { id: string }) => row.id)).toEqual(expectedMustIds);
      for (const mustId of expectedMustIds) {
        const node = semanticIr.nodes[mustId];
        const canonicalBody = semanticIr.semanticBodies[node.bodyHash];
        expect(model.must.find((row: { id: string }) => row.id === mustId)).toMatchObject({
          id: canonicalBody.id,
          text: canonicalBody.text,
        });
      }
      expect(report.canonicalInputAuthority).toMatchObject({
        source: 'canonical_semantic_ir',
        semanticModelHash: semanticIr.semanticModelHash,
        semanticConservationManifestHash: manifest.manifestHash,
        sourceAuthorityHash: manifest.hashChain.sourceAuthorityHash,
        sourceRootSetHash: sha256Stable({
          sourceRoots: manifest.sourceRoots,
          semanticNodes: manifest.semanticNodes,
          rootToNodeMappings: manifest.rootToNodeMappings,
          nodeToAuthorityMappings: manifest.nodeToAuthorityMappings,
          nodes: Object.entries(semanticIr.nodes)
            .map(([nodeId, node]) => ({ nodeId, ...(node as Record<string, unknown>) }))
            .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
          edges: Object.entries(semanticIr.edges)
            .map(([edgeId, edge]) => ({ edgeId, ...(edge as Record<string, unknown>) }))
            .sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
        }),
        compilerInputHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(report.requirementContractModelHash).toBe(fileHash(paths.compiledModel));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps absent negative and boundary semantics unresolved without synthetic rows', () => {
    const fixture = createEntrySourceFixture('source-grounded-unresolved', {
      includeNegative: false,
      includeBoundary: false,
    });
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-unresolved-'));
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const sourcePath = path.join(inputDir, 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const modelPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.sessionAuthority.requirementSetId,
        'authoring',
        'requirement-contract-model.json'
      );
      expect(
        existsSync(modelPath),
        [
          'production entry did not persist the unresolved semantic model',
          `exit=${String(result.status)}`,
          `stdout=${result.stdout}`,
          `stderr=${result.stderr}`,
        ].join('; ')
      ).toBe(true);

      const model = JSON.parse(readFileSync(modelPath, 'utf8'));
      expect(model.notDone).toEqual([]);
      expect(model.outOfScope).toEqual([]);
      expect(model.invariantClosure.issues.map((issue: { code: string }) => issue.code)).toEqual(
        expect.arrayContaining([
          'missing_negative_requirement_authority',
          'missing_out_of_scope_authority',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('persists the blocking semantic model before confirmation draft construction', () => {
    const fixture = createEntrySourceFixture('pre-draft-compiler-order', {
      includeMust: false,
    });
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-pre-draft-'));
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const sourcePath = path.join(inputDir, 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const modelPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.sessionAuthority.requirementSetId,
        'authoring',
        'requirement-contract-model.json'
      );
      expect(
        existsSync(modelPath),
        [
          'production entry did not persist the pre-draft blocking model',
          `exit=${String(result.status)}`,
          `stdout=${result.stdout}`,
          `stderr=${result.stderr}`,
        ].join('; ')
      ).toBe(true);

      const model = JSON.parse(readFileSync(modelPath, 'utf8'));
      const paths = authoringPaths(root, fixture.sessionAuthority.requirementSetId);
      expect(model.must).toEqual([]);
      expect(model.invariantClosure.issues.map((issue: { code: string }) => issue.code)).toContain(
        'missing_requirement_authority'
      );
      expect(existsSync(paths.semanticConservationManifest)).toBe(true);
      expect(existsSync(paths.compilerClosureReport)).toBe(true);
      expect(
        existsSync(paths.scaleAssessmentInitial),
        'compiler invariant closure must block before initial assessment'
      ).toBe(false);
      expect(result.json?.blockingIssues?.map((issue: { code: string }) => issue.code)).toContain(
        'renderer_blocker_release_failure'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
