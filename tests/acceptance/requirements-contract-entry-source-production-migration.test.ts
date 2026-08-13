import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as productionSemanticPipeline from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';
import { validateRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { validateRequirementsContractSourceBindingCapsule } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';
import { validateRequirementsContractBuildManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';

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
    negativeText?: string;
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
      text: options.negativeText ?? 'The parser must not silently drop a material requirement.',
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
    '---',
    'authoritySources:',
    ...(options.includeMust === false
      ? []
      : [
          '  - path: docs/functional.json',
          '    rootClass: functional_requirement',
          '    proposedAuthorityClass: source_authority',
          '    bodySchemaVersion: requirement-contract-requirement/v2',
        ]),
    ...(options.includeNonFunctional === true
      ? [
          '  - path: docs/non-functional.json',
          '    rootClass: non_functional_requirement',
          '    proposedAuthorityClass: source_authority',
          '    bodySchemaVersion: requirement-contract-requirement/v2',
        ]
      : []),
    ...(options.includeNegative === false
      ? []
      : [
          '  - path: docs/negative.json',
          '    rootClass: negative_requirement',
          '    proposedAuthorityClass: source_authority',
          '    bodySchemaVersion: requirement-contract-requirement/v2',
        ]),
    ...(options.includeBoundary === false
      ? []
      : [
          '  - path: docs/out-of-scope.json',
          '    rootClass: out_of_scope_boundary',
          '    proposedAuthorityClass: source_authority',
          '    bodySchemaVersion: requirement-contract-requirement/v2',
        ]),
    '---',
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
    includeMust: options.includeMust !== false,
    includeNonFunctional: options.includeNonFunctional === true,
    includeNegative: options.includeNegative !== false,
    includeBoundary: options.includeBoundary !== false,
  };
}

type EntrySourceFixture = ReturnType<typeof createEntrySourceFixture>;

function materializeEntrySourceFixture(
  root: string,
  sourcePath: string,
  fixture: EntrySourceFixture
) {
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  const docsDir = path.join(root, 'docs');
  mkdirSync(docsDir, { recursive: true });
  const writeAuthority = (fileName: string, sourceRootId: string, semanticBody: object) =>
    writeFileSync(
      path.join(docsDir, fileName),
      `${JSON.stringify(
        {
          schemaVersion: 'requirements-contract-authority-source/v1',
          sourceRootId,
          semanticBody,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  if (fixture.includeMust) {
    writeAuthority('functional.json', fixture.semanticAuthority.must.id, {
      text: fixture.semanticAuthority.must.text,
      oracle: 'The targeted fixture proves source spans remain preserved.',
      executionConstraints: [
        { kind: 'CMD', id: 'session-parser-test', value: 'npm test -- session-parser.test.ts' },
        { kind: 'PATH', id: 'session-parser-owner', value: 'src/session-parser.ts' },
      ],
      executionConstraintRefs: ['CMD:session-parser-test', 'PATH:session-parser-owner'],
    });
  }
  if (fixture.includeNonFunctional) {
    writeAuthority('non-functional.json', fixture.semanticAuthority.nonFunctional.id, {
      text: fixture.semanticAuthority.nonFunctional.text,
      oracle: 'The targeted fixture proves stale input is rejected before compilation.',
      executionConstraints: [
        { kind: 'CMD', id: 'stale-input-test', value: 'npm test -- stale-input.test.ts' },
      ],
      executionConstraintRefs: ['CMD:stale-input-test'],
    });
  }
  if (fixture.includeNegative) {
    writeAuthority('negative.json', fixture.semanticAuthority.negative.id, {
      text: fixture.semanticAuthority.negative.text,
      negativeAssertion: fixture.semanticAuthority.negative.text,
      blockingCondition: 'A material requirement is silently dropped.',
    });
  }
  if (fixture.includeBoundary) {
    writeAuthority('out-of-scope.json', fixture.semanticAuthority.boundary.id, {
      text: fixture.semanticAuthority.boundary.text,
      boundaryAssertion: 'The graphical editor remains excluded.',
    });
  }
  writeFileSync(sourcePath, fixture.sessionRequirement, 'utf8');
}

function activeAuthoringArtifacts(root: string, requirementSetId: string) {
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId
  );
  const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  const requirementRecord = JSON.parse(readFileSync(requirementRecordPath, 'utf8')) as Record<
    string,
    any
  >;
  const activeAuthority = requirementRecord.activeAuthority as Record<string, string>;
  const resolveRecordPath = (recordRelativePath: string) =>
    path.join(recordRoot, ...recordRelativePath.split('/'));
  const semanticIrPath = resolveRecordPath(activeAuthority.activeSemanticIrPath);
  const sourceBindingPath = resolveRecordPath(activeAuthority.activeSourceBindingPath);
  const buildManifestPath = resolveRecordPath(activeAuthority.activeBuildManifestPath);
  const buildManifest = JSON.parse(readFileSync(buildManifestPath, 'utf8')) as Record<string, any>;
  const terminalManifestPath = resolveRecordPath(buildManifest.terminalCheckpointManifestRef.path);
  return {
    recordRoot,
    requirementRecordPath,
    requirementRecord,
    activeAuthority,
    semanticIrPath,
    semanticIr: JSON.parse(readFileSync(semanticIrPath, 'utf8')) as Record<string, any>,
    sourceBindingPath,
    sourceBinding: JSON.parse(readFileSync(sourceBindingPath, 'utf8')) as Record<string, any>,
    buildManifestPath,
    buildManifest,
    terminalManifestPath,
    terminalManifest: JSON.parse(readFileSync(terminalManifestPath, 'utf8')) as Record<string, any>,
  };
}

function expectPublishedAuthority(
  result: ReturnType<typeof runProductionEntry>,
  fixture: EntrySourceFixture,
  root: string
) {
  expect(result.status, result.stderr || result.stdout).toBe(0);
  expect(result.json?.data ?? result.json).toMatchObject({
    status: 'audit_pending',
    authoringRequestId: fixture.sessionAuthority.requirementSetId,
    authoringAttemptId: expect.any(String),
  });
  const paths = activeAuthoringArtifacts(root, fixture.sessionAuthority.requirementSetId);
  expect(paths.requirementRecord.activeAuthority).toMatchObject({
    activeSemanticIrPath: expect.stringMatching(
      /^authoring\/semantic-revisions\/[^/]+\/semantic-ir\.json$/u
    ),
    activeSourceBindingPath: expect.stringMatching(
      /^authoring\/source-bindings\/[^/]+\/source-binding\.json$/u
    ),
    activeBuildManifestPath: expect.stringMatching(
      /^authoring\/staging\/[^/]+\/contract-build-manifest\.json$/u
    ),
  });
  expect(validateRequirementsContractSemanticIr(paths.semanticIr).decision).toBe('pass');
  expect(validateRequirementsContractSourceBindingCapsule(paths.sourceBinding).decision).toBe(
    'pass'
  );
  expect(validateRequirementsContractBuildManifest(paths.buildManifest).decision).toBe('pass');
  expect(paths.buildManifest.terminalCheckpointManifestRef.checkpointId).toBe('cp08');
  expect(paths.terminalManifest.checkpointId).toBe('cp08');
  expect(paths.terminalManifest.status).toBe('passed');
  expect(paths.activeAuthority.activeSemanticIrPath).toBe(
    paths.buildManifest.semanticAuthorityRef.path
  );
  expect(paths.activeAuthority.activeSourceBindingPath).toBe(
    paths.buildManifest.bindingAuthorityRef.path
  );
  const requirements = (paths.semanticIr.semanticPayload?.semantics?.requirements ?? []) as Array<
    Record<string, string>
  >;
  const requirementIds = requirements.map((row) => row.id);
  const expectedIds = [
    ...(fixture.includeMust ? [fixture.semanticAuthority.must.id] : []),
    ...(fixture.includeNonFunctional ? [fixture.semanticAuthority.nonFunctional.id] : []),
    ...(fixture.includeNegative ? [fixture.semanticAuthority.negative.id] : []),
  ];
  expect([...requirementIds].sort()).toEqual(expectedIds.sort());
  if (fixture.includeBoundary) {
    expect(requirementIds).not.toContain(fixture.semanticAuthority.boundary.id);
  }
  return paths;
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
      materializeEntrySourceFixture(root, sourcePath, fixture);

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = expectPublishedAuthority(result, fixture, root);
      expect(paths.semanticIr.semanticPayload.specSpanRegistry.length).toBeGreaterThan(0);
      expect(paths.buildManifest.auditPacketRef.path).toMatch(
        /^authoring\/staging\/[^/]+\/judge-audit-packet\.json$/u
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('persists the declared authority source list before semantic compilation', () => {
    const fixture = createEntrySourceFixture('intake-lineage');
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-production-'));
    try {
      const sourcePath = path.join(root, 'input', 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      materializeEntrySourceFixture(root, sourcePath, fixture);
      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = expectPublishedAuthority(result, fixture, root);
      const sourceListPath = path.join(
        paths.recordRoot,
        'authoring',
        'staging',
        paths.activeAuthority.activeAuthoringAttemptId,
        'consumer-authority-source-list.json'
      );
      expect(existsSync(sourceListPath)).toBe(true);
      const sourceList = JSON.parse(readFileSync(sourceListPath, 'utf8')) as Record<string, any>;
      expect(sourceList.entries.map((entry: { path: string }) => entry.path)).toEqual([
        'docs/functional.json',
        'docs/negative.json',
        'docs/out-of-scope.json',
      ]);
      expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('binds each declared authority root to an immutable source artifact', () => {
    const fixture = createEntrySourceFixture('session-lineage-span-mutation', {
      includeNonFunctional: true,
    });
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-lineage-mutation-'));
    try {
      const sourcePath = path.join(root, 'input', 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      materializeEntrySourceFixture(root, sourcePath, fixture);
      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = expectPublishedAuthority(result, fixture, root);
      const boundArtifacts = paths.sourceBinding.sourceArtifacts as Array<Record<string, string>>;
      expect(boundArtifacts.map((row) => row.immutableBlobRef)).toEqual(
        expect.arrayContaining([
          'docs/functional.json',
          'docs/non-functional.json',
          'docs/negative.json',
        ])
      );
      expect(boundArtifacts.map((row) => row.immutableBlobRef)).not.toContain(
        'docs/out-of-scope.json'
      );
      for (const artifact of boundArtifacts) {
        expect(artifact.sourceSnapshotHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      }
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
        const sourcePath = path.join(root, 'input', 'session-requirement.md');
        const targetPath = path.join(root, 'requirements', 'source-prd.md');
        materializeEntrySourceFixture(root, sourcePath, fixture);

        const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
        const paths = expectPublishedAuthority(result, fixture, root);
        observedIdentitySets.push(
          (paths.semanticIr.semanticPayload.semantics.requirements as Array<{ id: string }>).map(
            (row) => row.id
          )
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
    expect(observedIdentitySets[0]).not.toEqual(observedIdentitySets[1]);
  });

  it('preserves escaped, code-span, and link pipes from declared authority JSON', () => {
    const canonicalNegativeText =
      'Preserve visible \\| value, `left|right`, and [proof|ref](docs/proof.md).';
    const fixture = createEntrySourceFixture('canonical-parser-production', {
      negativeText: canonicalNegativeText,
    });
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-canonical-parser-'));
    try {
      const sourcePath = path.join(root, 'input', 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      materializeEntrySourceFixture(root, sourcePath, fixture);

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = expectPublishedAuthority(result, fixture, root);
      expect(paths.semanticIr.semanticPayload.semantics.requirements).toContainEqual(
        expect.objectContaining({
          id: fixture.semanticAuthority.negative.id,
          text: canonicalNegativeText,
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
      const sourcePath = path.join(root, 'input', 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      materializeEntrySourceFixture(root, sourcePath, fixture);

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = expectPublishedAuthority(result, fixture, root);
      const semantics = paths.semanticIr.semanticPayload.semantics as Record<string, any>;
      const expectedMustIds = [
        fixture.semanticAuthority.must.id,
        fixture.semanticAuthority.nonFunctional.id,
      ];
      expect(
        semantics.requirements
          .filter((row: { requirementKind: string }) => row.requirementKind !== 'negative')
          .map((row: { id: string }) => row.id)
          .sort()
      ).toEqual([...expectedMustIds].sort());
      expect(semantics.atoms.map((row: { requirementRef: string }) => row.requirementRef)).toEqual(
        expect.arrayContaining(expectedMustIds)
      );
      expect(paths.buildManifest.semanticAuthorityRef.hash).toBe(
        paths.semanticIr.scopeSemanticHash
      );
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
      const sourcePath = path.join(root, 'input', 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      materializeEntrySourceFixture(root, sourcePath, fixture);

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      const paths = expectPublishedAuthority(result, fixture, root);
      expect(paths.semanticIr.semanticPayload.semantics.requirements).toEqual([
        expect.objectContaining({ id: fixture.semanticAuthority.must.id }),
      ]);
      expect(paths.sourceBinding.sourceArtifacts).toEqual([
        expect.objectContaining({ sourceArtifactId: fixture.semanticAuthority.must.id }),
      ]);
      expect(
        paths.semanticIr.semanticPayload.semantics.requirements.map((row: { id: string }) => row.id)
      ).not.toEqual(
        expect.arrayContaining([
          fixture.semanticAuthority.negative.id,
          fixture.semanticAuthority.boundary.id,
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps active authority absent when technical planning is unavailable', () => {
    const fixture = createEntrySourceFixture('pre-draft-compiler-order', {
      includeMust: false,
    });
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-pre-draft-'));
    try {
      const sourcePath = path.join(root, 'input', 'session-requirement.md');
      const targetPath = path.join(root, 'requirements', 'source-prd.md');
      materializeEntrySourceFixture(root, sourcePath, fixture);

      const result = runProductionEntry(root, sourcePath, targetPath, fixture.sessionAuthority);
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.json?.data ?? result.json).toMatchObject({
        status: 'technical_planning_pending',
        issueCode: 'requirements_technical_planning_pending',
        authoringRequestId: fixture.sessionAuthority.requirementSetId,
      });
      const recordRoot = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.sessionAuthority.requirementSetId
      );
      expect(existsSync(path.join(recordRoot, 'record', 'requirement-record.json'))).toBe(false);
      expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
