import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileRequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createSourceAuthorityProjectionDescriptor,
  createTempRoot,
  createTestAuthoringExecutionOptions,
  installJudgeRuntimeConfig,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256Text,
  stagingMustDecompositionPacket,
  writeSourceAuthorityProjection,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';
import { inspectRequirementsContractSourceAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

function createJudgeReadyTempRoot(prefix: string): string {
  const root = createTempRoot(prefix);
  installJudgeRuntimeConfig(root);
  return root;
}

function sourceLineOf(sourcePath: string, needle: string): number {
  const lineIndex = readFileSync(sourcePath, 'utf8')
    .split(/\r?\n/u)
    .findIndex((line) => line.includes(needle));
  if (lineIndex < 0) throw new Error(`source line not found: ${needle}`);
  return lineIndex + 1;
}

function sourceObligationIdentityFromSeed(seedHash: string): {
  sourceRequirementId: string;
  canonicalRequirementId: string;
  projectedMustId: string;
} {
  const ordinal = (Number.parseInt(seedHash.slice(-8), 16) % 900) + 1;
  const paddedOrdinal = String(ordinal).padStart(3, '0');
  return {
    sourceRequirementId: `S${paddedOrdinal}`,
    canonicalRequirementId: `FR-${paddedOrdinal}`,
    projectedMustId: `MUST-FR-${paddedOrdinal}`,
  };
}

function perMustProductProjectionFixture(): string {
  return [
    '# Per-MUST Product Projection',
    '',
    '## Out Of Scope',
    '',
    '| ID | Forbidden scope | Boundary assertion | Evidence |',
    '| --- | --- | --- | --- |',
    '| OUT-001 | Replacing unrelated engines is out of scope. | Keep unrelated engines unchanged. | ACC-001 ACC-002 |',
    '',
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| NEG-001 | Reporting refresh success while stale cache remains does not count as completion. | Refresh must not report current state without advancing the cache revision. | A refresh result is published before the revision advances. | FAIL-002 | ACC-002 CMD-002 |',
    '',
    '## User Journeys',
    '',
    '| ID | Actor | Trigger | Required flow | Completion state |',
    '| --- | --- | --- | --- | --- |',
    '| UJ-001 | Trader | Connects a widget session. | Given a configured widget, when the trader connects, then the widget loads the persisted profile. | Widget session is live with the selected profile. |',
    '| UJ-002 | Operator | Refreshes widget state. | Given a stale widget cache, when the operator refreshes, then the cache revision advances without blocking the session. | Widget cache is current and the session remains live. |',
    '',
    '## Functional Requirements',
    '',
    '| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| FR-001 | The widget must load the selected persisted profile. | Product session behavior. | ACC-001 E2E-001 | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 CMD-001 TRACE-001; tests/widget/test_profile.py | PATH-001 owns implementation and rollback. |',
    '| FR-002 | The widget must refresh stale cache state without blocking the live session. | Product refresh behavior. | ACC-002 E2E-002 | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 CMD-002 TRACE-002; tests/widget/test_refresh.py | PATH-002 owns implementation and rollback. |',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| FAIL-001 | Selected profile is missing or disabled. | Connection rejects before opening the widget session and preserves the prior safe state. | none | ACC-001 |',
    '| FAIL-002 | Cache refresh times out. | Refresh reports cache_refresh_timeout while the existing live session remains responsive. | NEG-001 | ACC-002 |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | Profile load acceptance | MUST-FR-001 | python -m pytest -q "tests/widget/test_profile.py" | Given a configured profile, when the widget connects, then the selected profile is loaded. | CMD-001 TRACE-001; tests/widget/test_profile.py | PATH-001 owns remediation. |',
    '| ACC-002 | Cache refresh acceptance | MUST-FR-002 | python -m pytest -q "tests/widget/test_refresh.py" | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | CMD-002 TRACE-002; tests/widget/test_refresh.py | PATH-002 owns remediation. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| E2E-001 | e2e | MUST-FR-001 | python -m pytest -q "tests/widget/test_profile.py" | Exit code 0. | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns remediation. | tests/widget/test_profile.py src/widget/profile.py |',
    '| E2E-002 | e2e | MUST-FR-002 | python -m pytest -q "tests/widget/test_refresh.py" | Exit code 0. | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 CMD-002 TRACE-002 | PATH-002 owns remediation. | tests/widget/test_refresh.py src/widget/refresh.py |',
    '| CMD-001 | delivery-evidence | MUST-FR-001 | python -m pytest -q "tests/widget/test_profile.py" | Exit code 0. | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 TRACE-001 | PATH-001 owns remediation. | tests/widget/test_profile.py src/widget/profile.py |',
    '| CMD-002 | delivery-evidence | MUST-FR-002 | python -m pytest -q "tests/widget/test_refresh.py" | Exit code 0. | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 TRACE-002 | PATH-002 owns remediation. | tests/widget/test_refresh.py src/widget/refresh.py |',
    '| CMD-999 | contract-validation | source structure only; no MUST coverage | node scripts/lint-source.js --source docs/requirements/widget.md | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 | Requirements owner owns remediation. | docs/requirements/widget.md |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-999 | CMD-001 | UJ-001 | PATH-001 | OUT-001 | Given a configured profile, when the widget connects, then the selected profile is loaded. | MUST-FR-001 closes only through ACC-001 and CMD-001. | PATH-001 owns implementation and rollback. |',
    '| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 E2E-002 | CMD-999 | CMD-002 | UJ-002 | PATH-002 | none | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | MUST-FR-002 closes only through ACC-002 and CMD-002. | PATH-002 owns implementation and rollback. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `src/widget/profile.py` | Profile owner | Implement profile loading. | FR-001 | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 CMD-001 TRACE-001 | Profile owner owns implementation, rollback and remediation. |',
    '| PATH-002 | `src/widget/refresh.py` | Refresh owner | Implement non-blocking cache refresh. | FR-002 | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 CMD-002 TRACE-002 | Refresh owner owns implementation, rollback and remediation. |',
    '',
  ].join('\n');
}

describe('requirements contract authoring authority grounding', () => {
  it('preserves an upstream source-obligation identity through its canonical MUST alias', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-source-obligation-alias-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'source-obligation-alias'
      );
      const identity = sourceObligationIdentityFromSeed(descriptor.seedHash);
      const source = writeText(
        root,
        `docs/requirements/${descriptor.seedHash.slice(-12)}.md`,
        [
          `# ${descriptor.semantics.title} Requirement`,
          '',
          '## Authoritative Source Requirement',
          '',
          `${identity.sourceRequirementId}: ${descriptor.semantics.requirement}`,
          '',
        ].join('\n')
      );

      const analysis = inspectRequirementsContractSourceAuthority({
        root,
        sourcePath: source,
        explicitTargetPaths: [descriptor.target.path],
        explicitRequiredCommands: [descriptor.verification.requiredCommand],
      });

      expect(analysis.controlledMustCandidates).toHaveLength(1);
      expect(analysis.controlledMustCandidates[0]).toMatchObject({
        sourceRequirementId: identity.sourceRequirementId,
        projectedMustId: identity.projectedMustId,
        normalizedRequirement: descriptor.semantics.requirement,
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when two upstream identities resolve to the same canonical MUST alias', () => {
    const root = createJudgeReadyTempRoot(
      'requirements-contract-source-obligation-alias-collision-'
    );
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'source-obligation-alias-collision'
      );
      const identity = sourceObligationIdentityFromSeed(descriptor.seedHash);
      const source = writeText(
        root,
        `docs/requirements/${descriptor.seedHash.slice(-12)}.md`,
        [
          `# ${descriptor.semantics.title} Requirement`,
          '',
          '## Authoritative Source Requirements',
          '',
          `${identity.sourceRequirementId}: ${descriptor.semantics.requirement}`,
          '',
          `${identity.canonicalRequirementId}: ${descriptor.semantics.negativeRequirement}`,
          '',
        ].join('\n')
      );

      expect(() =>
        inspectRequirementsContractSourceAuthority({
          root,
          sourcePath: source,
          explicitTargetPaths: [descriptor.target.path],
          explicitRequiredCommands: [descriptor.verification.requiredCommand],
        })
      ).toThrow(/Canonical Source requirement alias collision/u);
    } finally {
      removeTempRoot(root);
    }
  });

  it('keeps acceptance and provenance metadata outside legacy MUST and target authority', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-legacy-authority-boundary-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'legacy-authority-boundary'
      );
      const recordId = `REQ-${descriptor.seedHash.slice(-12).toUpperCase()}`;
      const provenancePath = `docs/plans/upstream-${descriptor.seedHash.slice(-12)}.md`;
      const source = writeText(
        root,
        `docs/requirements/${descriptor.seedHash.slice(-12)}.md`,
        [
          `# ${descriptor.semantics.title} Requirement`,
          '',
          '## Authoritative Source Requirement',
          '',
          descriptor.semantics.requirement,
          '',
          '## Authoritative Acceptance Criteria',
          '',
          `${descriptor.refs.acceptanceId}: ${descriptor.semantics.oracle}`,
          '',
          '## Source Authority Provenance',
          '',
          `- Contract path: \`${provenancePath}\``,
          `- Contract SHA256: \`${descriptor.seedHash}\``,
          '- Source line: `1`',
          '',
        ].join('\n')
      );

      const analysis = inspectRequirementsContractSourceAuthority({
        root,
        sourcePath: source,
        explicitTargetPaths: [descriptor.target.path],
        explicitRequiredCommands: [descriptor.verification.requiredCommand],
      });

      expect(analysis.controlledMustCandidates).toHaveLength(1);
      expect(analysis.controlledMustCandidates[0]).toMatchObject({
        originalText: descriptor.semantics.requirement,
        normalizedRequirement: descriptor.semantics.requirement,
      });
      expect(analysis.targetPaths).toContain(descriptor.target.path);
      expect(analysis.targetPaths).not.toContain(provenancePath);
    } finally {
      removeTempRoot(root);
    }
  });

  it('derives business failure applicability from the authoritative project profile', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-failure-applicability-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'business-failure-applicability'
      );
      const authorityRelativePath = `architecture/${descriptor.seedHash.slice(-12)}.json`;
      const authorityContent = `${JSON.stringify({
        schemaVersion: 'registered-architecture-record/v1',
        owningSystem: descriptor.semantics.title,
      })}\n`;
      writeText(root, authorityRelativePath, authorityContent);
      const authorityHash = sha256Text(authorityContent);
      const renderSource = (projectKind: 'consumer_product' | 'governance_framework') =>
        [
          'projectProfile:',
          '  schemaVersion: requirements-contract-project-profile/v1',
          `  projectKind: ${projectKind}`,
          `  owningSystem: ${descriptor.semantics.title}`,
          '  governanceFramework: BMAD-Speckit',
          '  classificationAuthority:',
          '    kind: registered_architecture_record',
          `    ref: ${authorityRelativePath}`,
          `    hash: ${authorityHash}`,
          `  diagramPolicyRegistryHash: ${descriptor.seedHash}`,
          '',
          `# ${descriptor.semantics.title}`,
          '',
          '## Authoritative Source Requirement',
          '',
          descriptor.semantics.requirement,
          '',
        ].join('\n');
      const inspect = (projectKind: 'consumer_product' | 'governance_framework') => {
        const source = writeText(
          root,
          `docs/requirements/${projectKind}-${descriptor.seedHash.slice(-12)}.md`,
          renderSource(projectKind)
        );
        return inspectRequirementsContractSourceAuthority({
          root,
          sourcePath: source,
          explicitTargetPaths: [descriptor.target.path],
          explicitRequiredCommands: [descriptor.verification.requiredCommand],
        });
      };

      expect(inspect('governance_framework').businessFailureAuthority).toEqual({
        applies: false,
        projectKind: 'governance_framework',
        reasonCode: 'governance_framework_business_failure_not_applicable',
      });
      expect(inspect('consumer_product').businessFailureAuthority).toEqual({
        applies: true,
        projectKind: 'consumer_product',
        reasonCode: 'consumer_product_business_failure_required',
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('derives requirement lineage and preserves explicit boundary authority', () => {
    const sourcePath = 'docs/requirements/widget.md';
    const requirement = {
      id: 'REQUIREMENT-WIDGET-SUMMARY',
      text: 'Widget summary must stay synchronized.',
      sourceRequirementId: 'SOURCE-WIDGET-SUMMARY',
      sourcePath,
      sourceSpan: { startLine: 7, endLine: 7 },
    };
    const negativeRequirement = {
      id: 'NEGATIVE-WIDGET-SUMMARY',
      text: 'Widget summary must not discard selected settings.',
      sourceRequirementId: 'SOURCE-NEGATIVE-WIDGET-SUMMARY',
      sourcePath,
      sourceSpan: { startLine: 8, endLine: 8 },
    };
    const boundary = {
      id: 'BOUNDARY-UNRELATED-ENGINES',
      text: 'Do not rewrite unrelated engines.',
      authorityState: 'source_boundary' as const,
      provenance: {
        sourceRequirementId: 'SOURCE-BOUNDARY-UNRELATED-ENGINES',
        sourcePath,
        sourceSpan: { startLine: 9, endLine: 9 },
        compiler: 'requirements-source-normalizer',
      },
    };
    const validation = {
      id: 'VALIDATION-WIDGET-SUMMARY',
      command: 'pytest tests/test_widget.py',
      requirementRefs: [requirement.id],
    };
    const target = {
      id: 'MODIFICATION-WIDGET-SUMMARY',
      path: 'src/widget.py',
      requirementRefs: [requirement.id],
    };
    const model = compileRequirementContractModel({
      recordId: 'REQ-AUTHORITY-GROUNDING',
      requirementSetId: 'REQ-AUTHORITY-GROUNDING-SET',
      must: [requirement],
      notDone: [negativeRequirement],
      outOfScope: [boundary],
      requiredCommands: [validation],
      targetPaths: [target],
    });

    expect(model.must[0]).toMatchObject({
      authorityState: 'source_grounded',
      provenance: {
        sourceRequirementId: requirement.sourceRequirementId,
        sourcePath: requirement.sourcePath,
        sourceSpan: requirement.sourceSpan,
        compiler: 'requirements-contract-compiler',
      },
    });
    expect(model.outOfScope[0]).toEqual(boundary);
    expect(model.requiredCommands).toEqual([
      {
        id: validation.id,
        command: validation.command,
        covers: validation.requirementRefs,
      },
    ]);
    expect(model.targetModificationPaths).toEqual([target]);
    expect(model.invariantClosure).toMatchObject({
      remainingIssueCount: 0,
      issues: [],
    });
  });

  it('persists source authority spans, hashes, and source requirement IDs through authoring artifacts', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-authority-grounding-');
    try {
      const source = writeText(
        root,
        'docs/requirements/authority-grounding.md',
        [
          '# Authority Grounding Requirement',
          '',
          '目标文件：`src/widget.py`',
          '',
          '## Functional Requirements',
          '',
          '| FR ID | Requirement |',
          '|---|---|',
          '| FR-001 | Widget summary must stay synchronized with selected settings. |',
          '',
          '## Negative Requirements And Not Done Conditions',
          '',
          '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
          '| --- | --- | --- | --- | --- | --- |',
          '| NEG-001 | Returning a stale widget summary does not count as synchronized behavior. | The widget summary must not discard selected settings. | The summary is published from stale settings. | none | ACC-001 |',
          '',
          '## Out Of Scope',
          '',
          '| ID | Forbidden scope | Boundary assertion | Evidence |',
          '| --- | --- | --- | --- |',
          '| OUT-001 | Rewriting unrelated widget engines is out of scope. | Keep unrelated widget engines unchanged. | ACC-001 |',
          '',
          '## Validation',
          '',
          'pytest tests/test_widget.py',
          '',
        ].join('\n')
      );

      const result = runAuthoring(root, source, 'REQ-AUTHORITY-GROUNDING');
      const paths = artifacts(root, 'REQ-AUTHORITY-GROUNDING', 'REQ-AUTHORITY-GROUNDING-SET');
      const candidates = readJson<{ candidates: Array<Record<string, unknown>> }>(
        paths.controlledMustCandidates
      );
      const target = readJson<{ accepted: Array<Record<string, unknown>> }>(
        paths.targetAuthorityReport
      );
      const validation = readJson<{ accepted: Array<Record<string, unknown>> }>(
        paths.validationAuthorityReport
      );
      const candidate = candidates.candidates.find(
        (row: Record<string, unknown>) => row.sourceRequirementId === 'FR-001'
      );
      const requirementLine = sourceLineOf(source, '| FR-001 |');
      const validationLine = sourceLineOf(source, 'pytest tests/test_widget.py');

      expect(issueCodes(result)).toContain('business_failure_paths_source_authority_required');
      expect(candidate).toMatchObject({
        sourceRequirementId: 'FR-001',
        projectedMustId: 'MUST-FR-001',
        sourcePath: 'docs/requirements/authority-grounding.md',
        sourceSpan: { startLine: requirementLine, endLine: requirementLine },
        sourceDocumentHash: expect.stringMatching(/^sha256:/),
      });
      expect(target.accepted[0]).toMatchObject({
        source: 'source_document',
        sourceSpan: expect.objectContaining({ startLine: expect.any(Number) }),
      });
      expect(validation.accepted[0]).toMatchObject({
        source: 'source_document',
        sourceSpan: { startLine: validationLine, endLine: validationLine },
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('keeps ID-bearing FR and NFR rows as MUST candidates while projecting embedded authority', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-id-bearing-authority-');
    try {
      const source = writeText(
        root,
        'docs/requirements/id-bearing-authority.md',
        [
          '# ID-bearing Authority Grounding',
          '',
          '## Functional Requirements',
          '',
          '| ID | Requirement | Target path | Command |',
          '| --- | --- | --- | --- |',
          '| FR-001 | The profile widget MUST load the selected profile. | `src/widget/profile.ts` | npm run test:widget-profile |',
          '',
          '## Non Functional Requirements',
          '',
          '| ID | Requirement | Target path | Command |',
          '| --- | --- | --- | --- |',
          '| NFR-001 | The profile widget MUST refresh without blocking the live session. | `src/widget/refresh.ts` | npm run test:widget-refresh |',
          '',
        ].join('\n')
      );

      runAuthoring(root, source, 'REQ-ID-BEARING-AUTHORITY');
      const paths = artifacts(
        root,
        'REQ-ID-BEARING-AUTHORITY',
        'REQ-ID-BEARING-AUTHORITY-SET'
      );
      const coverageEntries = readJson<{ entries: Array<Record<string, unknown>> }>(
        paths.requirementCoverageLedger
      ).entries;
      const candidates = readJson<{ candidates: Array<Record<string, unknown>> }>(
        paths.controlledMustCandidates
      ).candidates;
      const targetAuthority = readJson<{ accepted: Array<Record<string, unknown>> }>(
        paths.targetAuthorityReport
      ).accepted;
      const validationAuthority = readJson<{ accepted: Array<Record<string, unknown>> }>(
        paths.validationAuthorityReport
      ).accepted;

      expect(
        coverageEntries
          .filter((entry) => /(?:FR-001|NFR-001)/u.test(JSON.stringify(entry.tableContext ?? {})))
          .map((entry) => ({
            decision: entry.decision,
            requirementSignal: entry.requirementSignal,
          }))
      ).toEqual([
        {
          decision: 'mapped_to_must',
          requirementSignal: expect.arrayContaining([
            'source_requirement_id',
            'target_path',
            'validation_command',
          ]),
        },
        {
          decision: 'mapped_to_must',
          requirementSignal: expect.arrayContaining([
            'source_requirement_id',
            'target_path',
            'validation_command',
          ]),
        },
      ]);
      expect(
        candidates.map((candidate) => ({
          sourceRequirementId: candidate.sourceRequirementId,
          projectedMustId: candidate.projectedMustId,
        }))
      ).toEqual([
        { sourceRequirementId: 'FR-001', projectedMustId: 'MUST-FR-001' },
        { sourceRequirementId: 'NFR-001', projectedMustId: 'MUST-NFR-001' },
      ]);
      expect(targetAuthority.map((record) => record.path)).toEqual([
        'src/widget/profile.ts',
        'src/widget/refresh.ts',
      ]);
      expect(
        validationAuthority.map((record) => ({
          command: record.command,
          sourceMustRefs: record.sourceMustRefs,
        }))
      ).toEqual([
        {
          command: 'npm run test:widget-profile',
          sourceMustRefs: ['MUST-FR-001'],
        },
        {
          command: 'npm run test:widget-refresh',
          sourceMustRefs: ['MUST-NFR-001'],
        },
      ]);
    } finally {
      removeTempRoot(root);
    }
  });

  it('keeps source NEG rows independent from source OUT rows', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-neg-out-authority-');
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor('neg-out-authority', {
        negativeCount: 15,
      });
      const { sourcePath: source } = writeSourceAuthorityProjection(root, descriptor);

      runAuthoring(root, source, 'REQ-NEG-OUT-AUTHORITY');
      const confirmation = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        artifacts(root, 'REQ-NEG-OUT-AUTHORITY', 'REQ-NEG-OUT-AUTHORITY-SET')
          .draftImplementationConfirmation
      ).implementationConfirmation;
      const outIds = (confirmation.outOfScope as Array<Record<string, unknown>>).map(
        (row) => row.id
      );
      const negIds = (confirmation.notDone as Array<Record<string, unknown>>).map((row) => row.id);
      const firstOut = (confirmation.outOfScope as Array<Record<string, unknown>>)[0];
      const firstNeg = (confirmation.notDone as Array<Record<string, unknown>>)[0];

      expect(outIds).toEqual(descriptor.outOfScope.map((row) => row.id));
      expect(firstOut).toMatchObject({
        id: descriptor.outOfScope[0].id,
        text: descriptor.outOfScope[0].text,
        scopeBoundary: descriptor.outOfScope[0].boundary,
      });
      expect(negIds).toEqual(descriptor.negatives.map((row) => row.id));
      expect(firstNeg).toMatchObject({
        id: descriptor.negatives[0].id,
        text: descriptor.negatives[0].text,
        negativeAssertion: descriptor.negatives[0].negativeAssertion,
        whyItBlocksCompletion: descriptor.negatives[0].blocksCompletionWhen,
        sourceFailureRefs: [descriptor.failure.id],
        sourceAcceptanceRefs: [descriptor.negatives[0].acceptanceId],
        sourceCommandRefs: [descriptor.negatives[0].commandId],
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('resolves ACC and E2E files from source ACC CMD and PATH authority tables', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-acceptance-file-authority-');
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor('acceptance-file-authority', {
        negativeCount: 1,
      });
      const { sourcePath: source, authoringOptions } = writeSourceAuthorityProjection(
        root,
        descriptor
      );

      const result = runAuthoring(root, source, 'REQ-ACCEPTANCE-FILE-AUTHORITY', {
        ...authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(
        root,
        'REQ-ACCEPTANCE-FILE-AUTHORITY',
        'REQ-ACCEPTANCE-FILE-AUTHORITY-SET'
      );
      const conservation = readJson<Record<string, unknown>>(paths.semanticConservationManifest);
      const conservationDecision = {
        issueCodes: issueCodes(result),
        sourceToIrMissingRootCount: conservation.sourceToIrMissingRootCount,
        sourceToIrExtraRootCount: conservation.sourceToIrExtraRootCount,
        sourceToIrPayloadMismatchCount: conservation.sourceToIrPayloadMismatchCount,
        sourceToIrAuthorityMismatchCount: conservation.sourceToIrAuthorityMismatchCount,
        sourceToIrDuplicateRootCount: conservation.sourceToIrDuplicateRootCount,
      };
      expect(conservationDecision).toEqual({
        issueCodes: [],
        sourceToIrMissingRootCount: 0,
        sourceToIrExtraRootCount: 0,
        sourceToIrPayloadMismatchCount: 0,
        sourceToIrAuthorityMismatchCount: 0,
        sourceToIrDuplicateRootCount: 0,
      });
      const confirmation = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const acceptance = (confirmation.acceptanceTests as Array<Record<string, unknown>>)[0];
      const e2e = (confirmation.e2eSuites as Array<Record<string, unknown>>)[0];

      expect(acceptance.file).toBe(descriptor.primary.testPath);
      expect(e2e.file).toBe(descriptor.primary.testPath);
      expect(acceptance.file).not.toBe('source_authorized_validation_command');
      expect(e2e.file).not.toBe('source_authorized_validation_command');
    } finally {
      removeTempRoot(root);
    }
  });

  it('materializes source NEG rows as independent closures without inventing tasks', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-negative-closure-authority-');
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor('negative-closure-authority', {
        negativeCount: 15,
      });
      const { sourcePath: source, authoringOptions } = writeSourceAuthorityProjection(
        root,
        descriptor
      );

      const result = runAuthoring(root, source, 'REQ-NEGATIVE-CLOSURE-AUTHORITY', {
        ...authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      expect(issueCodes(result)).toEqual([]);
      const confirmation = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        artifacts(root, 'REQ-NEGATIVE-CLOSURE-AUTHORITY', 'REQ-NEGATIVE-CLOSURE-AUTHORITY-SET')
          .draftImplementationConfirmation
      ).implementationConfirmation;
      const traceRows = confirmation.traceRows as Array<Record<string, unknown>>;
      const acceptanceTests = confirmation.acceptanceTests as Array<Record<string, unknown>>;
      const tasks = confirmation.atomicImplementationTaskList as Array<Record<string, unknown>>;
      const taskIds = new Set(tasks.map((row) => row.id));
      const expectedTraceIds = descriptor.negatives.map((row) => row.traceId);
      const expectedAcceptanceIds = descriptor.negatives.map((row) => row.acceptanceId);
      const negativeTraceRows = traceRows.filter((row) =>
        expectedTraceIds.includes(String(row.id))
      );
      const negativeAcceptanceRows = acceptanceTests.filter((row) =>
        expectedAcceptanceIds.includes(String(row.id))
      );
      const ownerTaskId = String((negativeTraceRows[0]?.taskRefs as string[])?.[0] ?? '');
      const ownerTask = tasks.find((row) => row.id === ownerTaskId);
      const taskToTrace = confirmation.atomicTaskToTraceMap as Record<string, string[]>;
      const taskToAcceptance = confirmation.atomicTaskToAcceptanceMap as Record<string, string[]>;
      const notDoneRows = confirmation.notDone as Array<Record<string, unknown>>;
      const mustTraceRows = traceRows.filter((row) =>
        (row.covers as string[]).includes(descriptor.requirement.mustId)
      );
      const requiredCommandIds = new Set(
        (confirmation.requiredCommands as Array<Record<string, unknown>>).map((row) =>
          String(row.id)
        )
      );
      const negativeCommandRefs = negativeTraceRows.flatMap(
        (row) => row.deliveryEvidenceCommandRefs as string[]
      );

      expect(negativeTraceRows.map((row) => row.id)).toEqual(expectedTraceIds);
      expect(negativeAcceptanceRows.map((row) => row.id)).toEqual(expectedAcceptanceIds);
      expect(tasks).toHaveLength(1);
      expect(ownerTaskId).not.toBe('');
      expect(taskIds.has(ownerTaskId)).toBe(true);
      expect(negativeTraceRows.every((row) => (row.taskRefs as string[]).length === 1)).toBe(true);
      expect(
        negativeTraceRows.every((row, index) =>
          (row.covers as string[]).includes(descriptor.negatives[index].id)
        )
      ).toBe(true);
      expect(
        negativeTraceRows.every((row) =>
          (row.acceptanceRefs as string[]).includes(descriptor.primary.endToEndId)
        )
      ).toBe(true);
      expect(
        negativeAcceptanceRows.every(
          (row, index) =>
            (row.covers as string[])[0] === descriptor.negatives[index].id &&
            (row.traceRows as string[])[0] === expectedTraceIds[index]
        )
      ).toBe(true);
      expect(negativeAcceptanceRows[0]?.file).toBe(descriptor.negatives[0].testPath);
      expect(negativeAcceptanceRows[14]?.file).toBe(descriptor.negatives[14].testPath);
      expect(ownerTask?.traceRows).toEqual(expect.arrayContaining(expectedTraceIds));
      expect(ownerTask?.acceptanceRefs).toEqual(expect.arrayContaining(expectedAcceptanceIds));
      expect(taskToTrace[ownerTaskId]).toEqual(expect.arrayContaining(expectedTraceIds));
      expect(taskToAcceptance[ownerTaskId]).toEqual(expect.arrayContaining(expectedAcceptanceIds));
      expect(notDoneRows.map((row) => row.coveredByTraceRows)).toEqual(
        expectedTraceIds.map((traceId) => [traceId])
      );
      expect(mustTraceRows.map((row) => ({ id: row.id, covers: row.covers }))).toEqual([
        {
          id: descriptor.primary.traceId,
          covers: [descriptor.requirement.mustId],
        },
      ]);
      expect(negativeCommandRefs).not.toHaveLength(0);
      expect(negativeCommandRefs.every((commandRef) => requiredCommandIds.has(commandRef))).toBe(
        true
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('preserves source-authored target paths owned only by negative requirements', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-negative-target-authority-');
    try {
      const negativeTargetPath = 'src/authority-fixtures/negative-only-target.ts';
      const descriptor = createSourceAuthorityProjectionDescriptor('negative-target-authority', {
        negativeCount: 15,
        firstNegativeTargetPath: negativeTargetPath,
      });
      const firstNegative = descriptor.negatives[0];
      const { sourcePath: source } = writeSourceAuthorityProjection(root, descriptor);

      runAuthoring(root, source, 'REQ-NEGATIVE-TARGET-AUTHORITY');
      const paths = artifacts(
        root,
        'REQ-NEGATIVE-TARGET-AUTHORITY',
        'REQ-NEGATIVE-TARGET-AUTHORITY-SET'
      );
      const confirmation = readJson<{ implementationConfirmation: Record<string, any> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const target = confirmation.targetModificationPaths.find(
        (row: any) => row.path === firstNegative.targetPath
      );
      const command = confirmation.requiredCommands.find(
        (row: any) => row.id === firstNegative.commandId
      );

      expect(command.targetFiles).toContain(firstNegative.targetPath);
      expect(target).toMatchObject({
        sourcePathId: firstNegative.pathId,
        coverageRole: 'modify',
      });
      expect(
        confirmation.atomicImplementationTaskList.flatMap((row: any) => row.targetFiles)
      ).toContain(firstNegative.targetPath);
    } finally {
      removeTempRoot(root);
    }
  });

  it('projects product-specific tasks, commands, paths, oracles, journeys, and current-target rows per MUST', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-per-must-product-projection-');
    try {
      const source = writeText(
        root,
        'docs/requirements/per-must-product-projection.md',
        perMustProductProjectionFixture()
      );

      const recordId = 'REQ-PER-MUST-PRODUCT-PROJECTION';
      runAuthoring(root, source, recordId, {
        ...createTestAuthoringExecutionOptions(recordId),
        criticalAuditorRound: cleanCriticalAuditorRound,
        confirmationLanguage: 'en-US',
      });
      const paths = artifacts(
        root,
        recordId,
        `${recordId}-SET`
      );
      const confirmation = readJson<{ implementationConfirmation: Record<string, any> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const packet = stagingMustDecompositionPacket(
        root,
        'REQ-PER-MUST-PRODUCT-PROJECTION'
      ) as Record<string, any>;
      const trace1 = confirmation.traceRows.find((row: any) => row.id === 'TRACE-001');
      const trace2 = confirmation.traceRows.find((row: any) => row.id === 'TRACE-002');
      const targetRowsById = new Map<string, { coverageRole?: string }>(
        confirmation.targetModificationPaths.map((row: any) => [row.id, row])
      );
      const target1 = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'src/widget/profile.py'
      );
      const target2 = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'src/widget/refresh.py'
      );
      const validationSourceTarget = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'docs/requirements/widget.md'
      );
      const validationScriptTarget = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'scripts/lint-source.js'
      );
      const acceptance1 = confirmation.acceptanceTests.find((row: any) => row.id === 'ACC-001');
      const acceptance2 = confirmation.acceptanceTests.find((row: any) => row.id === 'ACC-002');
      const packet1 = packet.mustPackets.find((row: any) => row.mustRef === 'MUST-FR-001');
      const packet2 = packet.mustPackets.find((row: any) => row.mustRef === 'MUST-FR-002');
      const productTasks = confirmation.atomicImplementationTaskList.filter((row: any) =>
        ['MUST-FR-001', 'MUST-FR-002'].includes(row.derivedFromMustRef)
      );
      const failure2 = confirmation.failurePaths.find((row: any) => row.id === 'FAIL-002');
      const businessSequences = confirmation.sequenceViews.filter(
        (row: any) => row.scope === 'business'
      );
      const journey1 = businessSequences.find((row: any) => row.sourceJourneyRef === 'UJ-001');
      const journey2 = businessSequences.find((row: any) => row.sourceJourneyRef === 'UJ-002');
      const serialized = JSON.stringify(confirmation);

      expect(trace1.deliveryEvidenceCommandRefs).toEqual(['CMD-001']);
      expect(trace1.contractValidationCommandRefs).toEqual(['CMD-999']);
      expect(trace2.deliveryEvidenceCommandRefs).toEqual(['CMD-002']);
      expect(trace2.contractValidationCommandRefs).toEqual(['CMD-999']);
      expect(target1.requirementRefs).toEqual(['MUST-FR-001']);
      expect(target2.requirementRefs).toEqual(['MUST-FR-002']);
      expect(validationSourceTarget?.coverageRole).toBe('validation_only');
      expect(validationScriptTarget?.coverageRole).toBe('validation_only');
      expect(acceptance1.oracle).toContain('selected profile is loaded');
      expect(acceptance2.oracle).toContain('live session remains responsive');
      expect(
        productTasks.every((row: any) => !/semantic kernel|confirmation HTML/iu.test(row.text)),
        'product tasks must not contain authoring implementation details'
      ).toBe(true);
      expect(
        productTasks.some((row: any) => row.targetFiles.includes('src/widget/profile.py')),
        'MUST-FR-001 must own the profile implementation target'
      ).toBe(true);
      expect(
        productTasks.some((row: any) => row.targetFiles.includes('src/widget/refresh.py')),
        'MUST-FR-002 must own the refresh implementation target'
      ).toBe(true);
      expect(packet1.mustCommandProjection.map((row: any) => row.id)).toContain('CMD-001');
      expect(packet1.mustCommandProjection.map((row: any) => row.id)).not.toContain('CMD-002');
      expect(packet2.mustCommandProjection.map((row: any) => row.id)).toContain('CMD-002');
      expect(packet2.mustCommandProjection.map((row: any) => row.id)).not.toContain('CMD-001');
      expect(packet1.atomicityCompleteness.expectedTaskCount).toBe(packet1.mustAtomicTasks.length);
      expect(packet1.atomicityCompleteness.expectedTaskCount).toBe(1);
      expect(packet1.questionCoverage.questions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('independently confirmable behavior'),
          expect.stringContaining('overlap'),
        ])
      );
      expect(
        packet1.authorClaims.every(
          (claim: any) => claim.criticDisposition === 'accepted_no_new_valid_gap'
        ),
        'MUST-FR-001 packet claims must reflect three clean critical-auditor rounds'
      ).toBe(true);
      expect(
        packet.authorClaims.every(
          (claim: any) => claim.criticDisposition === 'accepted_no_new_valid_gap'
        ),
        'packet-level author claims must reflect three clean critical-auditor rounds'
      ).toBe(true);
      expect(trace1.targetModificationPathRefs).toContain(target1.id);
      expect(trace2.targetModificationPathRefs).toContain(target2.id);
      expect(
        [...trace1.targetModificationPathRefs, ...trace2.targetModificationPathRefs].every(
          (targetId: string) => targetRowsById.get(targetId)?.coverageRole !== 'generated_output'
        ),
        'source traces must not claim generated outputs as implementation targets'
      ).toBe(true);
      expect(packet1.questionCoverage.questions.length).toBeGreaterThan(0);
      expect(packet2.questionCoverage.questions.length).toBeGreaterThan(0);
      expect(
        confirmation.currentTargetMap.diffRows.some(
          (row: any) =>
            row.requirementRefs?.length === 1 &&
            row.requirementRefs[0] === 'MUST-FR-001' &&
            String(row.targetState).includes('selected persisted profile')
        ),
        'current-target diff must preserve the MUST-FR-001 target state'
      ).toBe(true);
      expect(
        confirmation.currentTargetMap.diffRows.some(
          (row: any) =>
            row.requirementRefs?.length === 1 &&
            row.requirementRefs[0] === 'MUST-FR-002' &&
            String(row.targetState).includes('refresh stale cache state')
        ),
        'current-target diff must preserve the MUST-FR-002 target state'
      ).toBe(true);
      expect(
        businessSequences.some((row: any) => row.sourceJourneyRef === 'UJ-001'),
        'business sequence projection must preserve UJ-001'
      ).toBe(true);
      expect(
        businessSequences.some((row: any) => row.sourceJourneyRef === 'UJ-002'),
        'business sequence projection must preserve UJ-002'
      ).toBe(true);
      expect(journey1.covers).toEqual(['MUST-FR-001']);
      expect(journey1.traceRows).toEqual(['TRACE-001']);
      expect(journey1.evidenceRefs).toEqual(['EVD-001']);
      expect(journey1.acceptanceRefs).toEqual(['ACC-001', 'E2E-001']);
      expect(journey1.mermaid).toContain('[MUST-FR-001]');
      expect(journey2.covers).toEqual(['MUST-FR-002']);
      expect(journey2.traceRows).toEqual(['TRACE-002']);
      expect(journey2.evidenceRefs).toEqual(['EVD-002']);
      expect(journey2.acceptanceRefs).toEqual(['ACC-002', 'E2E-002']);
      expect(journey2.mermaid).toContain('[MUST-FR-002]');
      expect(trace1.sequenceViewRefs).toContain('SEQ-UJ-001');
      expect(trace1.sequenceViewRefs).not.toContain('SEQ-UJ-002');
      expect(trace2.sequenceViewRefs).toContain('SEQ-UJ-002');
      expect(trace2.sequenceViewRefs).not.toContain('SEQ-UJ-001');
      expect(
        confirmation.currentTargetMap.canonicalArtifacts.map((row: any) => row.targetPathOrField)
      ).not.toEqual(
        expect.arrayContaining([
          'docs/requirements/widget.md',
          'scripts/lint-source.js',
          'tests/widget/test_profile.py',
          'tests/widget/test_refresh.py',
        ])
      );
      expect(failure2.ownerMustRefs).toContain('MUST-FR-002');
      expect(
        confirmation.must.find((row: any) => row.id === 'MUST-FR-002').coveredByFailurePath
      ).toContain('FAIL-002');
      expect(serialized).not.toContain('"derivedFromMustRef":"MUST-001"');
    } finally {
      removeTempRoot(root);
    }
  });

  it('resolves source-declared directory command targets to authorized projected files', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-directory-command-targets-');
    try {
      const fixture = perMustProductProjectionFixture().replace(
        '| CMD-999 | contract-validation | source structure only; no MUST coverage | node scripts/lint-source.js --source docs/requirements/widget.md | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 | Requirements owner owns remediation. | docs/requirements/widget.md |',
        "| CMD-999 | contract-validation | source structure only; no MUST coverage | rg -n -e 'profile' -e 'refresh' -- src/widget | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 | Requirements owner owns remediation. | src/widget/ |"
      );
      const source = writeText(root, 'docs/requirements/directory-command-targets.md', fixture);

      const recordId = 'REQ-DIRECTORY-COMMAND-TARGETS';
      runAuthoring(root, source, recordId, {
        ...createTestAuthoringExecutionOptions(recordId),
        criticalAuditorRound: cleanCriticalAuditorRound,
        confirmationLanguage: 'en-US',
      });
      const paths = artifacts(
        root,
        recordId,
        `${recordId}-SET`
      );
      const confirmation = readJson<{ implementationConfirmation: Record<string, any> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const command = confirmation.requiredCommands.find((row: any) => row.id === 'CMD-999');

      expect(command.targetFiles).toEqual(
        expect.arrayContaining(['src/widget/profile.py', 'src/widget/refresh.py'])
      );
      expect(command.targetFiles).not.toContain('src/widget');
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when one source MUST has no owner-specific Failure closure', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-per-must-failure-authority-');
    try {
      const source = writeText(
        root,
        'docs/requirements/per-must-failure-authority.md',
        perMustProductProjectionFixture()
          .split(/\r?\n/u)
          .filter((line) => !line.startsWith('| FAIL-002 |'))
          .join('\n')
      );
      const recordId = 'REQ-PER-MUST-FAILURE-AUTHORITY';
      const result = runAuthoring(
        root,
        source,
        recordId,
        createTestAuthoringExecutionOptions(recordId)
      );
      const issue = result.blockingIssues.find(
        (candidate) => candidate.code === 'source_projection_authority_missing'
      );

      expect(issue?.refs).toContain('MUST-FR-002:failure');
      expect(result.substate).toBe('blocked_by_semantic_gap');
      expect(result.confirmability).toBe('blocked');
      const output = artifacts(root, recordId, `${recordId}-SET`);
      expect(existsSync(output.promotionReceipt)).toBe(false);
      expect(existsSync(output.html)).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed instead of synthesizing business failure paths when the source has no Failure Matrix', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-missing-business-failure-paths-');
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor(
        'missing-business-failure-paths',
        {
          negativeCount: 1,
        }
      );
      const materialized = writeSourceAuthorityProjection(root, descriptor, {
        omitFailureMatrix: true,
      });

      const recordId = 'REQ-MISSING-BUSINESS-FAILURE-PATHS';
      const result = runAuthoring(
        root,
        materialized.sourcePath,
        recordId,
        materialized.authoringOptions
      );
      const paths = artifacts(root, recordId, `${recordId}-SET`);

      expect(issueCodes(result)).toContain('business_failure_paths_source_authority_required');
      expect(result.confirmability).toBe('blocked');
      expect(() => stagingMustDecompositionPacket(root, recordId)).toThrow();
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(existsSync(paths.html)).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when a source User Journey has no MUST-owning trace mapping', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-unbound-user-journey-');
    try {
      const fixture = perMustProductProjectionFixture();
      const source = writeText(
        root,
        'docs/requirements/unbound-user-journey.md',
        fixture.replace(
          '| UJ-002 | Operator | Refreshes widget state. | Given a stale widget cache, when the operator refreshes, then the cache revision advances without blocking the session. | Widget cache is current and the session remains live. |',
          [
            '| UJ-002 | Operator | Refreshes widget state. | Given a stale widget cache, when the operator refreshes, then the cache revision advances without blocking the session. | Widget cache is current and the session remains live. |',
            '| UJ-003 | Auditor | Opens an unmapped diagnostics view. | The diagnostics view opens. | Diagnostics are visible. |',
          ].join('\n')
        )
      );

      const result = runAuthoring(root, source, 'REQ-UNBOUND-USER-JOURNEY');

      expect(issueCodes(result)).toContain('business_user_journey_owner_requirement_missing');
    } finally {
      removeTempRoot(root);
    }
  });
});
