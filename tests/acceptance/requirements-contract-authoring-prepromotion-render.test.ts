import { existsSync, renameSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequirementsContractCheckpointManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import {
  createRequirementsContractCoreArtifactFreeze,
  sha256Stable,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  expectSourceHashUnchanged,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  sha256File,
  sha256Text,
  sourcePromotionDecisionPath,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

const require = createRequire(import.meta.url);
const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function linkDirectory(target: string, linkPath: string): void {
  symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function prepublicationAttemptFixture(root: string, sourcePath: string) {
  const recordRoot = path.join(root, '_bmad-output/runtime/requirement-records/REQ-PREPUBLICATION');
  const attemptId = 'ATTEMPT-PREPUBLICATION-001';
  const inputManifestHash = hash('1');
  const semanticRevisionId = 'SEMREV-PREPUBLICATION-001';
  const scopeSemanticHash = hash('2');
  const stagingRoot = `authoring/staging/${attemptId}`;
  const writeJsonArtifact = (
    stage: string,
    role: string,
    fileName: string,
    value: Record<string, unknown>
  ) => {
    const recordRelativePath = `${stagingRoot}/${stage}/${fileName}`;
    writeText(recordRoot, recordRelativePath, `${JSON.stringify(value, null, 2)}\n`);
    const artifactHash =
      stage === 'cp04'
        ? createRequirementsContractCoreArtifactFreeze({
            stage: 'cp04',
            artifactRole: role.replaceAll('_', '-') as never,
            artifact: value,
          }).artifactHash
        : sha256Stable(value);
    return {
      role,
      schemaVersion: String(value.schemaVersion),
      artifactId: `${stage.toUpperCase()}-${role.toUpperCase()}`,
      recordRelativePath,
      artifactHash,
    };
  };
  const writeTextArtifact = (stage: string, role: string, fileName: string, value: string) => {
    const recordRelativePath = `${stagingRoot}/${stage}/${fileName}`;
    writeText(recordRoot, recordRelativePath, value);
    return {
      role,
      schemaVersion: 'text/markdown',
      artifactId: `${stage.toUpperCase()}-${role.toUpperCase()}`,
      recordRelativePath,
      artifactHash: sha256Text(value),
    };
  };
  const identity = { semanticRevisionId, scopeSemanticHash };
  const artifactsByStage = {
    cp04: [
      writeJsonArtifact('cp04', 'semantic_ir', 'semantic-ir.json', {
        schemaVersion: 'requirements-contract-semantic-ir/v1',
        ...identity,
      }),
      writeJsonArtifact('cp04', 'source_binding', 'source-binding.json', {
        schemaVersion: 'requirements-contract-source-binding/v1',
        ...identity,
      }),
      writeJsonArtifact('cp04', 'resolved_evidence_index', 'resolved-evidence-index.json', {
        schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
        ...identity,
      }),
    ],
    cp05: [
      writeJsonArtifact('cp05', 'confirmation_projection', 'confirmation-projection.json', {
        schemaVersion: 'requirements-contract-confirmation-projection/v1',
        ...identity,
        specSpanRefs: ['SPEC-SPAN-001'],
        evidenceClaimRefs: ['CLAIM-001'],
      }),
      writeTextArtifact(
        'cp05',
        'final_markdown',
        'requirements.md',
        '# Frozen projection\n\nMUST-001 SPEC-SPAN-001 CLAIM-001\n'
      ),
    ],
    cp06: ['execution_manifest', 'per_must_bundle', 'trace_matrix'].map((role) =>
      writeJsonArtifact('cp06', role, `${role}.json`, {
        schemaVersion: `requirements-contract-${role.replaceAll('_', '-')}/v1`,
        ...identity,
        mustRefs: ['MUST-001'],
        atomRefs: ['ATOM-001'],
        specSpanRefs: ['SPEC-SPAN-001'],
        evidenceClaimRefs: ['CLAIM-001'],
      })
    ),
    cp07: [
      writeJsonArtifact('cp07', 'diagram_set', 'diagram-set.json', {
        schemaVersion: 'requirements-contract-diagram-set/v1',
        ...identity,
        diagramRefs: ['DIAGRAM-001'],
      }),
    ],
    cp08: [
      writeJsonArtifact('cp08', 'projection_reconciliation_report', 'reconciliation.json', {
        schemaVersion: 'requirements-contract-projection-reconciliation-report/v1',
        ...identity,
        decision: 'pass',
      }),
      writeJsonArtifact('cp08', 'authority_resolution_report', 'authority-resolution.json', {
        schemaVersion: 'requirements-contract-authority-resolution-report/v1',
        ...identity,
        decision: 'pass',
      }),
      writeJsonArtifact('cp08', 'renderability_probe_report', 'renderability-probe.json', {
        schemaVersion: 'requirements-contract-renderability-probe-report/v1',
        ...identity,
        decision: 'pass',
        promotable: false,
      }),
      writeJsonArtifact('cp08', 'judge_audit_packet', 'judge-audit-packet.json', {
        schemaVersion: 'requirements-contract-judge-audit-packet/v1',
        ...identity,
        body: { mustRefs: ['MUST-001'] },
      }),
      writeJsonArtifact('cp08', 'judge_audit_packet_coverage', 'coverage.json', {
        schemaVersion: 'requirements-contract-judge-audit-packet-coverage/v1',
        ...identity,
        allApplicableArtifactsIncluded: true,
        omittedArtifactIds: [],
      }),
    ],
  };
  let previous = {
    checkpointId: 'cp03',
    checkpointOrdinal: 3,
    path: `${stagingRoot}/manifests/3-cp03.json`,
    hash: hash('3'),
  };
  for (let ordinal = 4; ordinal <= 8; ordinal += 1) {
    const stage = `cp0${ordinal}` as keyof typeof artifactsByStage;
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: 'REQUEST-PREPUBLICATION-001',
      authoringAttemptId: attemptId,
      checkpointId: stage,
      checkpointOrdinal: ordinal,
      stage,
      status: 'passed',
      inputManifestHash,
      previousCheckpointManifestRef: previous,
      latestValidPredecessorCheckpoint: previous.checkpointId,
      compilerIdentity: 'requirements-compiler/v1',
      artifactEntries: artifactsByStage[stage] as never,
      decisionReceiptRefs: [],
      baseAuthorityRef: null,
    });
    const manifestPath = `${stagingRoot}/manifests/${ordinal}-${stage}.json`;
    writeText(recordRoot, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    previous = {
      checkpointId: stage,
      checkpointOrdinal: ordinal,
      path: manifestPath,
      hash: manifest.checkpointManifestHash,
    };
  }
  writeText(
    recordRoot,
    'record/active-authoring-request.json',
    `${JSON.stringify(
      {
        schemaVersion: 'ActiveAuthoringAttemptPointer/v1',
        authoringAttemptId: attemptId,
        attemptManifestPath: previous.path,
        attemptManifestHash: previous.hash,
        latestValidPredecessorCheckpoint: 'cp07',
        inputManifestHash,
      },
      null,
      2
    )}\n`
  );
  return {
    recordRoot,
    sourcePath,
    cp08ManifestPath: previous.path,
    pointerPath: 'record/active-authoring-request.json',
    probePath: path.join(recordRoot, `${stagingRoot}/cp08/renderability-probe.json`),
  };
}

function prepromotionSource(): string {
  return [
    '# Prepromotion Render PRD',
    '',
    'Target file: `tests/trader/test_gateway_profile_registry.py`',
    '',
    '## Product Context',
    '',
    'The authoring flow validates a strict staging render before source publication.',
    '',
    '## Success Criteria',
    '',
    'Promotion occurs only after a confirmable strict render, and failure preserves source bytes.',
    '',
    '## In Scope',
    '',
    'Strict staging render ordering and fail-closed source promotion.',
    '',
    '## User Journeys',
    '',
    'The author receives either a confirmed promotion decision or an unchanged source with a blocker.',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| FR-001 | System MUST render the staging source before promotion. | Promotion cannot validate content that was not rendered. | ACC-001 | Strict render succeeds before promotion begins. | CMD-001 TRACE-001 | PATH-001 owns strict rendering. |',
    '',
    '## Non-Functional Requirements',
    '',
    '| NFR ID | Category | Requirement | Threshold and evidence | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| NFR-001 | Atomicity | Strict render failure must preserve the target source hash. | ACC-002 proves byte preservation and no promotion receipt. | The target hash remains unchanged after failure. | ACC-002 CMD-002 TRACE-002 | PATH-001 owns source preservation. |',
    '',
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| NEG-001 | A failed strict render cannot count as promotion success. | Render failure must preserve the source hash and produce no promotion receipt. | The source changes or promotion proceeds after strict render failure. | FAIL-002 | ACC-002 CMD-002 |',
    '| NEG-002 | Promotion cannot begin before strict rendering succeeds. | The promotion decision remains blocked until strict rendering is confirmed. | Promotion starts before the strict render result is confirmable. | FAIL-001 | ACC-001 CMD-001 |',
    '',
    '## Architecture Decision Records',
    '',
    'Strict rendering is a mandatory promotion precondition and cannot be bypassed.',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| FAIL-001 | Promotion begins before the staging source renders successfully. | Block promotion until the strict staging render succeeds. | NEG-002 | ACC-001 E2E-001 | MUST-FR-001 |',
    '| FAIL-002 | The staging source cannot be rendered into a valid confirmation view. | Block promotion, preserve the current source hash, and report the renderer failure without publishing partial output. | NEG-001 | ACC-002 E2E-002 | MUST-NFR-001 |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | Strict staging render | NEG-002 MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k strict_render_precedes_promotion | Promotion occurs only after the staging source renders successfully. | CMD-001 | PATH-001 owns strict rendering. |',
    '| ACC-002 | Failed-render source preservation | NEG-001 MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k failed_strict_render_preserves_source_hash | Failed strict render preserves the source hash and produces no promotion receipt. | CMD-002 | PATH-001 owns rollback. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CMD-001 | delivery-evidence | NEG-002 MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k strict_render_precedes_promotion | Exit code 0. | Strict render precedes promotion. | ACC-001 E2E-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py |',
    '| CMD-002 | delivery-evidence | NEG-001 MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k failed_strict_render_preserves_source_hash | Exit code 0. | Failed strict render leaves source and promotion state unchanged. | ACC-002 E2E-002 TRACE-002 | PATH-001 owns rollback. | tests/trader/test_gateway_profile_registry.py |',
    '| E2E-001 | e2e | NEG-002 MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k strict_render_precedes_promotion | Exit code 0. | The staging render succeeds before promotion begins. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py |',
    '| E2E-002 | e2e | MUST-NFR-001 NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k failed_strict_render_preserves_source_hash | Exit code 0. | A failed strict render preserves the source hash and promotion state. | ACC-002 CMD-002 TRACE-002 | PATH-001 owns rollback. | tests/trader/test_gateway_profile_registry.py |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | NEG-002 MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Successful strict render precedes promotion. | NEG-002 and MUST-FR-001 close through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
    '| TRACE-002 | NEG-001 MUST-NFR-001 | ACC-002 | ACC-002 E2E-002 | CMD-002 | CMD-002 | none | PATH-001 | none | Failed strict render produces no source mutation or promotion receipt. | NEG-001 and MUST-NFR-001 close through ACC-002 and TRACE-002. | PATH-001 owns rollback. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `tests/trader/test_gateway_profile_registry.py` | Promotion owner | Require a successful strict staging render before atomic promotion. | MUST-FR-001 MUST-NFR-001 NEG-001 | ACC-001 and ACC-002 prove success and source preservation independently. | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | Promotion owner owns implementation and rollback. |',
    '',
    '## Source Current State',
    '',
    '| ID | Current behavior | Current path | Limitation | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| CUR-001 | Promotion can evaluate a staging draft. | `tests/trader/test_gateway_profile_registry.py` | The strict-render result must remain authoritative. | ACC-001 |',
    '',
    '## Source Target State',
    '',
    '| ID | Target behavior | Target path | Acceptance state | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| TGT-001 | Promotion follows a successful strict render and fails closed otherwise. | `tests/trader/test_gateway_profile_registry.py` | ACC-001 and ACC-002 pass. | ACC-001 ACC-002 |',
    '',
    '## Current Target Map',
    '',
    '| ID | Current refs | Target refs | Transition | Invariant | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CTM-001 | CUR-001 | TGT-001 | Gate publication on strict render. | Failed rendering never mutates the source. | FR-001 NFR-001 | ACC-001 and ACC-002 remain authoritative. | ACC-001 ACC-002 | PATH-001 owns remediation. |',
    '',
    '## Human-Readable ID-Bound Views',
    '',
    'Happy-path sequence view; Failure-path sequence view; State and flow view; Edge-case view; Business and governance boundary view; Artifact automation plan; Current-vs-target map; aiTddContractExecutionManifestProjection.',
    '',
    '## Out Of Scope',
    '',
    '| ID | Excluded capability | Preservation rule | Evidence |',
    '| --- | --- | --- | --- |',
    '| OUT-001 | Direct renderer source mutation. | The renderer never mutates the target source directly. | ACC-002 |',
  ].join('\n');
}

describe('requirements contract authoring prepromotion render', () => {
  it('validates only the active attempt pointer and its confined cp08-to-cp04 lineage', () => {
    const root = createTempRoot('bmad-prepublication-attempt-');
    try {
      const sourcePath = writeText(root, 'source.md', '# Existing final source\n');
      const fixture = prepublicationAttemptFixture(root, sourcePath);
      const gate = require(
        path.resolve(
          '_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js'
        )
      ) as {
        validatePrepublicationAttempt(input: { sourcePath: string; recordRoot: string }): {
          exitCode: number;
          report: Record<string, unknown>;
        };
      };

      const result = gate.validatePrepublicationAttempt(fixture);

      expect(result.exitCode).toBe(0);
      expect(result.report).toMatchObject({
        verdict: 'PASS',
        sourceHashPreserved: true,
        semanticRevisionId: 'SEMREV-PREPUBLICATION-001',
        scopeSemanticHash: hash('2'),
        manifestPaths: [
          'authoring/staging/ATTEMPT-PREPUBLICATION-001/manifests/8-cp08.json',
          'authoring/staging/ATTEMPT-PREPUBLICATION-001/manifests/7-cp07.json',
          'authoring/staging/ATTEMPT-PREPUBLICATION-001/manifests/6-cp06.json',
          'authoring/staging/ATTEMPT-PREPUBLICATION-001/manifests/5-cp05.json',
          'authoring/staging/ATTEMPT-PREPUBLICATION-001/manifests/4-cp04.json',
        ],
      });
      expect(JSON.stringify(result.report)).not.toContain('activeAuthority');
      expect(JSON.stringify(result.report)).not.toContain('providerSelection');
      expect(JSON.stringify(result.report)).not.toContain('judgeRequest');
    } finally {
      removeTempRoot(root);
    }
  });

  it('blocks a tampered cp08 renderability probe without changing final source bytes', () => {
    const root = createTempRoot('bmad-prepublication-probe-fail-');
    try {
      const sourcePath = writeText(root, 'source.md', '# Existing final source\n');
      const beforeHash = sha256File(sourcePath);
      const fixture = prepublicationAttemptFixture(root, sourcePath);
      writeText(
        path.dirname(fixture.probePath),
        path.basename(fixture.probePath),
        `${JSON.stringify(
          {
            schemaVersion: 'requirements-contract-renderability-probe-report/v1',
            semanticRevisionId: 'SEMREV-PREPUBLICATION-001',
            scopeSemanticHash: hash('2'),
            decision: 'block',
            promotable: false,
          },
          null,
          2
        )}\n`
      );
      const gate = require(
        path.resolve(
          '_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js'
        )
      ) as {
        validatePrepublicationAttempt(input: { sourcePath: string; recordRoot: string }): {
          exitCode: number;
          report: { failedChecks: string[] };
        };
      };

      const result = gate.validatePrepublicationAttempt(fixture);

      expect(result.exitCode).toBe(1);
      expect(result.report.failedChecks).toContain('authoring_checkpoint_artifact_hash_mismatch');
      expect(result.report.failedChecks).toContain('prepublication_renderability_probe_blocked');
      expectSourceHashUnchanged(sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it.each(['manifest-parent', 'artifact-parent'] as const)(
    'blocks %s reparse escapes before reading outside the requirement record',
    (escapeKind) => {
      const root = createTempRoot(`bmad-prepublication-${escapeKind}-`);
      try {
        const sourcePath = writeText(root, 'source.md', '# Existing final source\n');
        const fixture = prepublicationAttemptFixture(root, sourcePath);
        const attemptRoot = path.join(
          fixture.recordRoot,
          'authoring',
          'staging',
          'ATTEMPT-PREPUBLICATION-001'
        );
        const linkedPath =
          escapeKind === 'manifest-parent'
            ? path.join(attemptRoot, 'manifests')
            : path.join(attemptRoot, 'cp08');
        const outsidePath = path.join(root, `outside-${escapeKind}`);
        renameSync(linkedPath, outsidePath);
        linkDirectory(outsidePath, linkedPath);
        const gate = require(
          path.resolve(
            '_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js'
          )
        ) as {
          validatePrepublicationAttempt(input: { sourcePath: string; recordRoot: string }): {
            exitCode: number;
            report: { failedChecks: string[] };
          };
        };

        const result = gate.validatePrepublicationAttempt(fixture);

        expect(result.exitCode).toBe(1);
        expect(result.report.failedChecks).toContain('authoring_record_path_reparse_forbidden');
        expect(result.report.failedChecks).not.toContain(
          'authoring_checkpoint_artifact_hash_mismatch'
        );
        expect(result.report.failedChecks).not.toContain(
          'authoring_checkpoint_manifest_hash_mismatch'
        );
      } finally {
        removeTempRoot(root);
      }
    }
  );

  it.each(['pointer-parent', 'source-parent', 'record-root'] as const)(
    'blocks %s reparse escapes before reading external bytes',
    (escapeKind) => {
      const root = createTempRoot(`bmad-prepublication-${escapeKind}-`);
      try {
        const sourceParent = path.join(root, 'source-parent');
        const sourcePath = writeText(sourceParent, 'source.md', '# Existing final source\n');
        const fixture = prepublicationAttemptFixture(root, sourcePath);
        const linkedPath =
          escapeKind === 'pointer-parent'
            ? path.join(fixture.recordRoot, 'record')
            : escapeKind === 'source-parent'
              ? sourceParent
              : fixture.recordRoot;
        const outsidePath = path.join(root, `outside-${escapeKind}`);
        renameSync(linkedPath, outsidePath);
        linkDirectory(outsidePath, linkedPath);
        const gate = require(
          path.resolve(
            '_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js'
          )
        ) as {
          validatePrepublicationAttempt(input: { sourcePath: string; recordRoot: string }): {
            exitCode: number;
            report: {
              failedChecks: string[];
              sourceHashBefore: string | null;
              sourceHashAfter: string | null;
            };
          };
        };

        const result = gate.validatePrepublicationAttempt(fixture);

        expect(result.exitCode).toBe(1);
        expect(result.report.failedChecks).toContain('authoring_record_path_reparse_forbidden');
        expect(result.report.sourceHashBefore).toBeNull();
        expect(result.report.sourceHashAfter).toBeNull();
        expect(result.report.failedChecks).not.toContain(
          'active_authoring_attempt_pointer_unreadable'
        );
        expect(result.report.failedChecks).not.toContain(
          'authoring_checkpoint_artifact_hash_mismatch'
        );
      } finally {
        removeTempRoot(root);
      }
    }
  );

  it('strict_render_precedes_promotion', () => {
    const root = createTempRoot('bmad-prepromotion-render-');
    try {
      const intakeSource = writeText(root, 'source.md', prepromotionSource());
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-PREPROMOTION-RENDER';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      expect(result.blockingIssues, JSON.stringify(result.blockingIssues, null, 2)).toEqual([]);

      const decision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, recordId)
      );

      expect(decision).toMatchObject({
        strictRenderBeforePromotion: true,
        strictRenderConfirmability: 'confirmable',
        strictRenderBlockingIssueCount: 0,
        promotionPreconditionOrder: [
          'model_closure',
          'localization',
          'projection',
          'packet_reconciliation',
          'source_write_gates',
          'critical_auditor_round_1',
          'critical_auditor_round_2',
          'critical_auditor_round_3',
          'strict_render',
          'encoding_gate',
          'final_hash_reconciliation',
          'promotion',
        ],
      });
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('failed_strict_render_preserves_source_hash', () => {
    const root = createTempRoot('bmad-prepromotion-fail-');
    try {
      const targetSource = writeText(root, 'existing.md', prepromotionSource());
      const intakeSource = writeText(root, 'source.md', prepromotionSource());
      const beforeHash = sha256File(targetSource);
      const recordId = 'REQ-TEST-PREPROMOTION-FAIL';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
        forceStrictRenderFailureForTest: true,
      });

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const decisionPath = sourcePromotionDecisionPath(root, recordId);

      expect(
        result.blockingIssues.map((issue) => issue.code),
        JSON.stringify(result.blockingIssues, null, 2)
      ).toContain('renderer_oracle_escape_upstream_runtime_defect');
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(readJson<Record<string, unknown>>(decisionPath)).toMatchObject({
        finalDecision: 'block_source_promotion',
        strictRenderBeforePromotion: true,
        sourceHashPreservedAfterFailedStrictRender: true,
      });
      expectSourceHashUnchanged(targetSource, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);
});
