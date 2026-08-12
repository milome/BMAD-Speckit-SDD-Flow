import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  preflightRequirementsContractSourceBindingRefresh,
  publishRequirementsContractSourceBindingRefresh,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-refresh';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  prepareRequirementsContractCp04FreezeStage,
  prepareRequirementsContractSourceBindingRefreshPipelineStage,
  publishRequirementsContractCp04FreezeStage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';
import {
  ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
  activeAuthoringAttemptPointerHash,
  type ActiveAuthoringAttemptPointer,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-active-authoring-attempt-pointer';

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function filePointerCas(root: string) {
  return (
    targetPath: typeof ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
    expectedHash: string | null,
    pointer: ActiveAuthoringAttemptPointer,
    pointerHash: string
  ) => {
    const absolute = path.join(root, ...targetPath.split('/'));
    const currentHash = existsSync(absolute)
      ? activeAuthoringAttemptPointerHash(readJson<ActiveAuthoringAttemptPointer>(absolute))
      : null;
    if (currentHash !== expectedHash) return false;
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(pointer, null, 2)}\n`, 'utf8');
    return activeAuthoringAttemptPointerHash(readJson<ActiveAuthoringAttemptPointer>(absolute)) ===
      pointerHash;
  };
}

describe('requirements contract source binding refresh', () => {
  it('routes the production semantic pipeline through the binding preflight owner', () => {
    const semanticAuthority = {
      normalizedClaims: [{ id: 'claim-pipeline', text: 'preserve semantic identity' }],
      authorityClasses: [{ id: 'claim-pipeline', authorityClass: 'source_grounded' }],
      logicalRegistry: [{ id: 'must-pipeline', claimId: 'claim-pipeline' }],
      obligationMapping: [{ obligationId: 'must-pipeline', claimId: 'claim-pipeline' }],
    };
    const result = prepareRequirementsContractSourceBindingRefreshPipelineStage({
      semanticRevisionId: 'SEMREV-PIPELINE-BINDING',
      scopeSemanticHash: sha256Stable('pipeline-scope'),
      beforeSemanticAuthority: semanticAuthority,
      afterSemanticAuthority: semanticAuthority,
      beforeLocatorHash: sha256Stable('pipeline-before-locator'),
      afterLocatorHash: sha256Stable('pipeline-after-locator'),
    });

    expect(result).toMatchObject({
      decision: 'refresh_binding',
      rerunCp00: false,
      invalidateConfirmation: false,
      triggerGoalCompilation: false,
    });
  });

  it('classifies locator-only changes without changing semantic identity', () => {
    const semanticRevisionId = 'SEMREV-LOCATOR-ONLY';
    const scopeSemanticHash = sha256Stable('scope');
    const semanticAuthority = {
      normalizedClaims: [{ id: 'claim-1', text: 'persist decision' }],
      authorityClasses: [{ id: 'claim-1', authorityClass: 'source_grounded' }],
      logicalRegistry: [{ id: 'must-1', claimId: 'claim-1' }],
      obligationMapping: [{ obligationId: 'must-1', claimId: 'claim-1' }],
    };
    const result = preflightRequirementsContractSourceBindingRefresh({
      semanticRevisionId,
      scopeSemanticHash,
      beforeSemanticAuthority: semanticAuthority,
      afterSemanticAuthority: semanticAuthority,
      beforeLocatorHash: sha256Stable('before-locator'),
      afterLocatorHash: sha256Stable('after-locator'),
    });

    expect(result).toMatchObject({
      decision: 'refresh_binding',
      semanticRevisionId,
      scopeSemanticHash,
      rerunCp00: false,
      invalidateConfirmation: false,
      triggerGoalCompilation: false,
    });
  });

  it('routes semantic changes back to cp00', () => {
    const result = preflightRequirementsContractSourceBindingRefresh({
      semanticRevisionId: 'SEMREV-CHANGED',
      scopeSemanticHash: sha256Stable('scope'),
      beforeSemanticAuthority: { normalizedClaims: [{ id: 'claim-1' }] },
      afterSemanticAuthority: { normalizedClaims: [{ id: 'claim-2' }] },
      beforeLocatorHash: sha256Stable('before-locator'),
      afterLocatorHash: sha256Stable('after-locator'),
    });
    expect(result).toMatchObject({ decision: 'semantic_recompile', rerunCp00: true });
  });

  it('publishes refreshed binding authority before CAS replacing the active attempt pointer', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-binding-refresh-publish-'));
    try {
      const scopeSemanticBase = {
        schemaVersion: 'requirements-contract-semantic-ir/v1',
        requirementSetId: 'REQ-BINDING-REFRESH-SET',
        mustIds: ['MUST-001'],
      };
      const currentStage = prepareRequirementsContractCp04FreezeStage({
        semanticIr: scopeSemanticBase,
        sourceBinding: {
          schemaVersion: 'requirements-contract-source-binding/v1',
          snapshotSetHash: sha256Stable('snapshot-before'),
          sourceSpanRegistryHash: sha256Stable('span-before'),
          evidenceClaimRegistryHash: sha256Stable('claims'),
        },
        resolvedEvidenceIndex: {
          schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
          claimRefs: ['CLAIM-001'],
        },
      });
      const current = publishRequirementsContractCp04FreezeStage({
        recordRootPath: root,
        stage: currentStage,
        authoringRequestId: 'REQUEST-BINDING-REFRESH',
        authoringAttemptId: 'ATTEMPT-BEFORE',
        inputManifestHash: sha256Stable('input-before'),
        previousCheckpointManifestRef: {
          checkpointId: 'cp03', checkpointOrdinal: 3,
          path: 'authoring/staging/ATTEMPT-BEFORE/manifests/3-cp03.json',
          hash: sha256Stable('cp03-before'),
        },
        compilerIdentity: 'requirements-contract-compiler/v1',
        decisionReceiptRefs: [],
        baseAuthorityRef: null,
        expectedCurrentPointerHash: null,
        compareAndSwapAttemptPointer: filePointerCas(root),
      });
      const frozenCurrentBytes = Object.fromEntries(
        Object.entries(current.paths).map(([key, filePath]) => [key, readFileSync(filePath)])
      );
      const semanticAuthority = {
        normalizedClaims: [{ id: 'claim-1', text: 'persist decision' }],
        authorityClasses: [{ id: 'claim-1', authorityClass: 'source_grounded' }],
        logicalRegistry: [{ id: 'must-1', claimId: 'claim-1' }],
        obligationMapping: [{ obligationId: 'must-1', claimId: 'claim-1' }],
      };
      const preflight = preflightRequirementsContractSourceBindingRefresh({
        semanticRevisionId: currentStage.semanticIdentity.semanticRevisionId,
        scopeSemanticHash: currentStage.semanticIdentity.scopeSemanticHash,
        beforeSemanticAuthority: semanticAuthority,
        afterSemanticAuthority: semanticAuthority,
        beforeLocatorHash: sha256Stable('locator-before'),
        afterLocatorHash: sha256Stable('locator-after'),
      });
      const refreshed = publishRequirementsContractSourceBindingRefresh({
        recordRootPath: root,
        currentAttemptPointer: current.attemptPointer.pointer,
        expectedCurrentPointerHash: current.attemptPointer.pointerHash,
        preflight,
        sourceBinding: {
          schemaVersion: 'requirements-contract-source-binding/v1',
          snapshotSetHash: sha256Stable('snapshot-after'),
          sourceSpanRegistryHash: sha256Stable('span-after'),
          evidenceClaimRegistryHash: sha256Stable('claims'),
        },
        resolvedEvidenceIndex: {
          schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
          claimRefs: ['CLAIM-001'],
          locatorRevision: 2,
        },
        authoringRequestId: 'REQUEST-BINDING-REFRESH',
        authoringAttemptId: 'ATTEMPT-AFTER',
        inputManifestHash: sha256Stable('input-after'),
        previousCheckpointManifestRef: {
          checkpointId: 'cp03', checkpointOrdinal: 3,
          path: 'authoring/staging/ATTEMPT-AFTER/manifests/3-cp03.json',
          hash: sha256Stable('cp03-after'),
        },
        compilerIdentity: 'requirements-contract-compiler/v1',
        decisionReceiptRefs: [],
        baseAuthorityRef: null,
        compareAndSwapAttemptPointer: filePointerCas(root),
      });

      expect(refreshed.semanticIdentity).toEqual(currentStage.semanticIdentity);
      expect(refreshed.bindingIdentity).not.toEqual(currentStage.bindingIdentity);
      expect(refreshed.publications.semanticIr.disposition).toBe('reused');
      expect(refreshed.paths.semanticIr).toBe(current.paths.semanticIr);
      for (const [key, filePath] of Object.entries(current.paths)) {
        expect(readFileSync(filePath), key).toEqual(frozenCurrentBytes[key]);
      }
      expect(readJson<Record<string, unknown>>(refreshed.paths.sourceBinding))
        .toMatchObject(refreshed.bindingIdentity);
      expect(readJson<Record<string, unknown>>(refreshed.paths.refreshReceipt)).toMatchObject({
        semanticRevisionId: currentStage.semanticIdentity.semanticRevisionId,
        scopeSemanticHash: currentStage.semanticIdentity.scopeSemanticHash,
        fromBindingRevisionId: currentStage.bindingIdentity.bindingRevisionId,
        toBindingRevisionId: refreshed.bindingIdentity.bindingRevisionId,
      });
      expect(readJson<ActiveAuthoringAttemptPointer>(
        path.join(root, ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/'))
      )).toEqual(refreshed.attemptPointer.pointer);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes a real locator-only resume through the refresh publisher', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-binding-refresh-action-'));
    try {
      mkdirSync(path.join(root, 'docs'), { recursive: true });
      const intakePath = path.join(root, 'intake.md');
      const targetPath = path.join(root, 'requirements.md');
      const authorityPath = path.join(root, 'docs', 'functional.json');
      writeFileSync(intakePath, [
        '---',
        'authoritySources:',
        '  - path: docs/functional.json',
        '    rootClass: functional_requirement',
        '    proposedAuthorityClass: source_authority',
        '    bodySchemaVersion: requirement-contract-requirement/v2',
        '---',
        '# Requirements',
        '',
      ].join('\n'), 'utf8');
      const authority = {
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'MUST-FR-LOCATOR-001',
        semanticBody: {
          text: 'System MUST preserve semantic identity across locator refresh.',
          oracle: 'The targeted test proves semantic identity remains stable.',
          executionConstraints: [
            { kind: 'CMD', id: 'locator-test', value: 'npm test -- locator.test.ts' },
            { kind: 'PATH', id: 'locator-owner', value: 'src/locator.ts' },
          ],
          executionConstraintRefs: ['CMD:locator-test', 'PATH:locator-owner'],
        },
      };
      writeFileSync(authorityPath, JSON.stringify(authority), 'utf8');
      const runAction = (action: string, args: string[]) => spawnSync(process.execPath, [
        path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
        'main-agent',
        action,
        '--cwd',
        root,
        ...args,
        '--json',
      ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
      const author = runAction('author-confirmation-ready-source', [
        '--intake-source', intakePath,
        '--target-source', targetPath,
        '--confirmation-language', 'en-US',
      ]);
      expect(author.status, author.stderr || author.stdout).toBe(0);
      const firstEnvelope = JSON.parse(author.stdout) as Record<string, any>;
      expect(firstEnvelope.data).toMatchObject({
        status: 'audit_pending',
        authoringAttemptId: expect.any(String),
      });
      const requestId = firstEnvelope.data.authoringRequestId as string;
      const firstAttemptId = firstEnvelope.data.authoringAttemptId as string;
      const recordRoot = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requestId
      );
      const pointerPath = path.join(recordRoot, ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/'));
      const firstPointer = readJson<ActiveAuthoringAttemptPointer>(pointerPath);
      const firstManifestPath = path.join(recordRoot, ...firstPointer.attemptManifestPath.split('/'));
      const firstManifest = readJson<Record<string, any>>(firstManifestPath);
      expect(firstManifest.checkpointId).toBe('cp08');
      const requirementRecord = readJson<Record<string, any>>(
        path.join(recordRoot, 'record', 'requirement-record.json')
      );
      const firstSemanticPath = path.join(
        recordRoot,
        ...String(requirementRecord.activeAuthority.activeSemanticIrPath).split('/')
      );
      const firstBindingPath = path.join(
        recordRoot,
        ...String(requirementRecord.activeAuthority.activeSourceBindingPath).split('/')
      );
      const firstSemanticBytes = readFileSync(firstSemanticPath);
      const firstBindingBytes = readFileSync(firstBindingPath);
      const firstManifestBytes = readFileSync(firstManifestPath);
      const firstAuthority = requirementRecord.activeAuthority as Record<string, string>;

      writeFileSync(authorityPath, `${JSON.stringify(authority, null, 2)}\n`, 'utf8');
      const resume = runAction('resume-author-confirmation-ready-source', [
        '--request-id', requestId,
        '--authoring-attempt-id', firstAttemptId,
      ]);
      expect(resume.status, resume.stderr || resume.stdout).toBe(0);
      const resumeEnvelope = JSON.parse(resume.stdout) as Record<string, any>;
      expect(resumeEnvelope.data).toMatchObject({
        status: 'audit_pending',
        authoringRequestId: requestId,
        authoringAttemptId: expect.any(String),
      });
      expect(resumeEnvelope.data.authoringAttemptId).not.toBe(firstAttemptId);
      const refreshedPointer = readJson<ActiveAuthoringAttemptPointer>(pointerPath);
      expect(refreshedPointer).toEqual(firstPointer);
      const refreshedRecord = readJson<Record<string, any>>(
        path.join(recordRoot, 'record', 'requirement-record.json')
      );
      const refreshedAuthority = refreshedRecord.activeAuthority as Record<string, string>;
      const refreshedBindingPath = path.join(
        recordRoot,
        ...String(refreshedAuthority.activeSourceBindingPath).split('/')
      );
      const refreshedBindingDir = path.dirname(refreshedBindingPath);
      expect(refreshedAuthority).toMatchObject({
        activeSemanticRevisionId: firstAuthority.activeSemanticRevisionId,
        activeSemanticIrPath: firstAuthority.activeSemanticIrPath,
        activeScopeSemanticHash: firstAuthority.activeScopeSemanticHash,
        activeAuthoringAttemptId: firstAuthority.activeAuthoringAttemptId,
        activeBuildManifestPath: firstAuthority.activeBuildManifestPath,
        activeBuildManifestHash: firstAuthority.activeBuildManifestHash,
      });
      expect(refreshedAuthority.activeBindingRevisionId)
        .not.toBe(firstAuthority.activeBindingRevisionId);
      expect(refreshedAuthority.activeSourceBindingPath)
        .not.toBe(firstAuthority.activeSourceBindingPath);
      expect(refreshedAuthority.activeSourceBindingHash)
        .not.toBe(firstAuthority.activeSourceBindingHash);
      expect(readFileSync(firstSemanticPath)).toEqual(firstSemanticBytes);
      expect(existsSync(path.join(
        refreshedBindingDir,
        'source-binding-refresh-receipt.json'
      ))).toBe(true);
      expect(readFileSync(firstBindingPath)).toEqual(firstBindingBytes);
      expect(readFileSync(firstManifestPath)).toEqual(firstManifestBytes);
      expect(refreshedPointer.attemptManifestPath).toBe(firstPointer.attemptManifestPath);
      expect(refreshedPointer.attemptManifestHash).toBe(firstPointer.attemptManifestHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the current attempt pointer when refresh crashes before manifest publication', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-binding-refresh-crash-'));
    try {
      const currentStage = prepareRequirementsContractCp04FreezeStage({
        semanticIr: { schemaVersion: 'requirements-contract-semantic-ir/v1', mustIds: ['MUST-001'] },
        sourceBinding: {
          schemaVersion: 'requirements-contract-source-binding/v1',
          snapshotSetHash: sha256Stable('snapshot-before'),
          sourceSpanRegistryHash: sha256Stable('span-before'),
          evidenceClaimRegistryHash: sha256Stable('claims'),
        },
        resolvedEvidenceIndex: {
          schemaVersion: 'requirements-contract-resolved-evidence-index/v1', claimRefs: ['CLAIM-001'],
        },
      });
      const current = publishRequirementsContractCp04FreezeStage({
        recordRootPath: root,
        stage: currentStage,
        authoringRequestId: 'REQUEST-BINDING-REFRESH',
        authoringAttemptId: 'ATTEMPT-BEFORE',
        inputManifestHash: sha256Stable('input-before'),
        previousCheckpointManifestRef: {
          checkpointId: 'cp03', checkpointOrdinal: 3,
          path: 'authoring/staging/ATTEMPT-BEFORE/manifests/3-cp03.json',
          hash: sha256Stable('cp03-before'),
        },
        compilerIdentity: 'requirements-contract-compiler/v1',
        decisionReceiptRefs: [],
        baseAuthorityRef: null,
        expectedCurrentPointerHash: null,
        compareAndSwapAttemptPointer: filePointerCas(root),
      });
      const preflight = preflightRequirementsContractSourceBindingRefresh({
        semanticRevisionId: currentStage.semanticIdentity.semanticRevisionId,
        scopeSemanticHash: currentStage.semanticIdentity.scopeSemanticHash,
        beforeSemanticAuthority: { claims: ['MUST-001'] },
        afterSemanticAuthority: { claims: ['MUST-001'] },
        beforeLocatorHash: sha256Stable('locator-before'),
        afterLocatorHash: sha256Stable('locator-after'),
      });
      const refreshInput = {
        recordRootPath: root,
        currentAttemptPointer: current.attemptPointer.pointer,
        expectedCurrentPointerHash: current.attemptPointer.pointerHash,
        preflight,
        sourceBinding: {
          schemaVersion: 'requirements-contract-source-binding/v1',
          snapshotSetHash: sha256Stable('snapshot-after'),
          sourceSpanRegistryHash: sha256Stable('span-after'),
          evidenceClaimRegistryHash: sha256Stable('claims'),
        },
        resolvedEvidenceIndex: {
          schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
          claimRefs: ['CLAIM-001'], locatorRevision: 2,
        },
        authoringRequestId: 'REQUEST-BINDING-REFRESH',
        authoringAttemptId: 'ATTEMPT-AFTER',
        inputManifestHash: sha256Stable('input-after'),
        previousCheckpointManifestRef: {
          checkpointId: 'cp03', checkpointOrdinal: 3,
          path: 'authoring/staging/ATTEMPT-AFTER/manifests/3-cp03.json',
          hash: sha256Stable('cp03-after'),
        },
        compilerIdentity: 'requirements-contract-compiler/v1',
        decisionReceiptRefs: [],
        baseAuthorityRef: null,
        compareAndSwapAttemptPointer: filePointerCas(root),
      } as const;
      const pointerPath = path.join(root, ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/'));
      const beforePointerBytes = readFileSync(pointerPath, 'utf8');
      expect(() => publishRequirementsContractSourceBindingRefresh({
        ...refreshInput,
        onArtifactPhase(role, phase) {
          if (role === 'refresh-receipt' && phase === 'after_publish') {
            throw new Error('binding-refresh-crash');
          }
        },
      })).toThrow('binding-refresh-crash');
      expect(readFileSync(pointerPath, 'utf8')).toBe(beforePointerBytes);
      expect(publishRequirementsContractSourceBindingRefresh(refreshInput).status).toBe('published');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
