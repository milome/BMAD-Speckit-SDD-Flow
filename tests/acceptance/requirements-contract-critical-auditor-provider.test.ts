import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { mainMainAgentOrchestration } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  artifacts,
  buildValidResponseFromRequest,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readJson,
  removeTempRoot,
  roundArtifact,
  runAuthoring,
  sha256File,
  stagingMustDecompositionPacket,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function createAuthoringConsumerFixture(root: string, recordId: string) {
  const configTarget = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configTarget), { recursive: true });
  writeFileSync(
    configTarget,
    readFileSync(
      path.join(process.cwd(), '_bmad', '_config', 'governance-remediation.yaml'),
      'utf8'
    ),
    'utf8'
  );
  const materialization = writeMinimalConsumerRequirement(
    root,
    `docs/requirements/${recordId.toLowerCase()}.md`,
    createMinimalConsumerRequirementDescriptor(recordId)
  );
  return materialization;
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function implementationConfirmationFromText(sourceText: string): Record<string, any> {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    throw new Error('test_implementation_confirmation_missing');
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim()) continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }
  const parsed = yaml.load(lines.slice(start, end).join('\n')) as {
    implementationConfirmation?: Record<string, any>;
  } | null;
  if (!parsed?.implementationConfirmation) {
    throw new Error('test_implementation_confirmation_invalid');
  }
  return parsed.implementationConfirmation;
}

function replaceImplementationConfirmation(
  sourceText: string,
  confirmation: Record<string, unknown>
): string {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    throw new Error('test_implementation_confirmation_missing');
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim()) continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }
  return [
    ...lines.slice(0, start),
    yaml.dump({ implementationConfirmation: confirmation }, { lineWidth: 120 }).trimEnd(),
    ...lines.slice(end),
  ].join('\n');
}

function createRequestForResponseFile(root: string, recordId: string) {
  const materialization = createAuthoringConsumerFixture(root, recordId);
  const source = materialization.sourcePath;
  const beforeHash = sha256File(source);
  const first = runAuthoring(root, source, recordId, materialization.authoringOptions);
  const requestPath = roundArtifact(root, recordId, 'request', 1);
  if (!existsSync(requestPath)) {
    throw new Error(
      `critical auditor request was not generated: ${JSON.stringify({
        blockingStage: first.blockingStage ?? null,
        issueCodes: issueCodes(first),
        blockingIssues: first.blockingIssues ?? [],
      })}`
    );
  }
  return {
    source,
    beforeHash,
    first,
    authoringOptions: materialization.authoringOptions,
    requestPath,
    request: readJson<Record<string, unknown>>(requestPath),
    packet: stagingMustDecompositionPacket(root, recordId),
  };
}

describe('requirements contract Critical Auditor provider modes', () => {
  it('rejects direct Critical Auditor result injection before provider dispatch', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-result-injection-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-RESULT-INJECTION';
      const materialization = createAuthoringConsumerFixture(root, recordId);
      let injectedCallCount = 0;

      expect(() =>
        runAuthoring(root, materialization.sourcePath, recordId, {
          ...materialization.authoringOptions,
          criticalAuditorRound: () => {
            injectedCallCount += 1;
            throw new Error('injected_result_executor_called');
          },
        })
      ).toThrow('critical_auditor_result_injection_forbidden');
      expect(injectedCallCount).toBe(0);
      const authoringDir = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'authoring'
      );
      for (const roundIndex of [1, 2, 3]) {
        expect(
          existsSync(path.join(authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`))
        ).toBe(false);
      }
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects file-backed Critical Auditor result injection before reading the response', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-file-injection-');
    try {
      const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const materialization = createAuthoringConsumerFixture(root, recordId);
      const responsePath = path.join(root, 'prewritten-critical-auditor-response.json');
      writeFileSync(
        responsePath,
        JSON.stringify({
          schemaVersion: 'critical-auditor-round-response/v1',
          verdict: 'no_new_valid_gap',
        }),
        'utf8'
      );

      expect(() =>
        runAuthoring(root, materialization.sourcePath, recordId, {
          ...materialization.authoringOptions,
          criticalAuditorProviderMode: 'response_file',
          criticalAuditorResponseFile: responsePath,
        })
      ).toThrow('critical_auditor_file_backed_provider_forbidden');

      const authoringDir = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'authoring'
      );
      expect(
        !existsSync(authoringDir) ||
          !readdirSync(authoringDir, { withFileTypes: true }).some((entry) =>
            entry.name.startsWith('critical-auditor-receipt-round-')
          )
      ).toBe(true);
    } finally {
      removeTempRoot(root);
    }
  });

  it('keeps semantic binding stable when the same source is materialized under another project root', () => {
    const firstRoot = createTempRoot('requirements-contract-semantic-binding-root-a-');
    const secondRoot = createTempRoot('requirements-contract-semantic-binding-root-b-');
    try {
      const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const first = createRequestForResponseFile(firstRoot, recordId);
      const second = createRequestForResponseFile(secondRoot, recordId);

      expect(second.request.semanticModelHash).toBe(first.request.semanticModelHash);
      expect(second.request.auditInputHash).toBe(first.request.auditInputHash);

      for (const root of [firstRoot, secondRoot]) {
        const semanticIr = readJson<Record<string, any>>(artifacts(root, recordId).semanticIr);
        const commandBodies = Object.values(
          (semanticIr.semanticBodies ?? {}) as Record<string, Record<string, unknown>>
        ).filter((body) => typeof body.command === 'string');
        expect(commandBodies.length).toBeGreaterThan(0);
        expect(commandBodies.every((body) => body.workingDirectory === '.')).toBe(true);
      }
    } finally {
      removeTempRoot(firstRoot);
      removeTempRoot(secondRoot);
    }
  });

  it('allocates canonical identities while preserving audited split MUST rows across the next production rebuild', () => {
    const root = createTempRoot('requirements-contract-audited-split-must-conservation-');
    try {
      const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const fixture = createRequestForResponseFile(root, recordId);
      const firstPreviewPath = artifacts(root, recordId).draftSourcePreview;
      const firstPreviewText = readFileSync(firstPreviewPath, 'utf8');
      const firstConfirmation = implementationConfirmationFromText(firstPreviewText);
      const firstMustRows = firstConfirmation.must as Array<Record<string, any>>;
      expect(firstMustRows).toHaveLength(1);
      const sourceMust = firstMustRows[0]!;
      const sourceMustId = String(sourceMust.id);
      const sourceRequirementId =
        String(sourceMust.sourceRequirementId || '').trim() ||
        sourceMustId.replace(/^MUST-/u, '');
      const auditorProposedId = `${sourceMustId}-${randomUUID()
        .replaceAll('-', '')
        .slice(0, 12)
        .toUpperCase()}`;
      const auditedSplitText = `${String(
        sourceMust.text
      )} The independently audited completion receipt remains observable.`;
      const auditedSplitMust = {
        ...sourceMust,
        id: auditorProposedId,
        text: auditedSplitText,
        source: 'critical_auditor_validated_gap',
        sourceRequirementId,
      };
      const repairedSourcePath = path.join(
        root,
        'docs',
        'requirements',
        `audited-split-${randomUUID()}.md`
      );
      writeFileSync(
        repairedSourcePath,
        replaceImplementationConfirmation(firstPreviewText, {
          ...firstConfirmation,
          must: [sourceMust, auditedSplitMust],
        }),
        'utf8'
      );

      const repairedRecordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const repairedResult = runAuthoring(
        root,
        repairedSourcePath,
        repairedRecordId,
        fixture.authoringOptions
      );

      const repairedArtifacts = artifacts(root, repairedRecordId);
      expect(existsSync(repairedArtifacts.semanticIr), JSON.stringify(repairedResult, null, 2)).toBe(
        true
      );
      const semanticIr = readJson<Record<string, any>>(repairedArtifacts.semanticIr);
      const sourceBoundSemanticBodies = Object.values(
        (semanticIr.semanticBodies ?? {}) as Record<string, Record<string, unknown>>
      ).filter(
        (body) =>
          String((body.source as Record<string, unknown> | undefined)?.sourceRequirementId) ===
          sourceRequirementId
      );
      expect(sourceBoundSemanticBodies).toHaveLength(2);
      const semanticBodyIds = sourceBoundSemanticBodies.map((body) => String(body.id));
      expect(new Set(semanticBodyIds).size).toBe(2);
      expect(semanticBodyIds).toContain(sourceMustId);
      expect(semanticBodyIds).not.toContain(auditorProposedId);
      expect(semanticBodyIds.every((id) => /^MUST-(?:FR|NFR)-\d{3}$/u.test(id))).toBe(true);
      expect(
        sourceBoundSemanticBodies.every(
          (body) =>
            String((body.source as Record<string, unknown>).sourceRequirementId) ===
            sourceRequirementId
        )
      ).toBe(true);
      const auditedSplitCanonicalId = String(
        sourceBoundSemanticBodies.find((body) => body.text === auditedSplitText)?.id ?? ''
      );
      expect(auditedSplitCanonicalId).toMatch(/^MUST-(?:FR|NFR)-\d{3}$/u);
      expect(auditedSplitCanonicalId).not.toBe(sourceMustId);
      const compiledModel = readJson<Record<string, any>>(repairedArtifacts.compiledModel);
      expect((compiledModel.must ?? []).map((row: Record<string, unknown>) => row.id)).toEqual(
        expect.arrayContaining(semanticBodyIds)
      );
      const rebuiltConfirmation = implementationConfirmationFromText(
        readFileSync(repairedArtifacts.draftSourcePreview, 'utf8')
      );
      expect(
        (rebuiltConfirmation.must ?? []).map((row: Record<string, unknown>) => row.id)
      ).toEqual(expect.arrayContaining(semanticBodyIds));
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects a self-hashed no-gap receipt that lacks real Judge invocation provenance', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-receipt-replay-');
    try {
      const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const fixture = createRequestForResponseFile(root, recordId);
      const request = fixture.request as Record<string, any>;
      const response = buildValidResponseFromRequest(request, fixture.packet);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const receiptPath = roundArtifact(root, recordId, 'receipt', 1);
      writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');

      const receipt: Record<string, unknown> = {
        schemaVersion: 'critical-auditor-receipt/v1',
        recordId,
        roundIndex: request.roundIndex,
        transactionId: request.transactionId,
        namespaceVersion: request.namespaceVersion,
        requestHash: request.requestHash,
        inputHash: request.auditInputHash,
        sourceHash: request.sourceDocumentHash,
        sourceDocumentHash: request.sourceDocumentHash,
        semanticModelHash: request.semanticModelHash,
        implementationConfirmationHash: request.implementationConfirmationHash,
        packetHash: request.packetHash,
        projectionSetHash: request.projectionSetHash,
        contentHash: request.packetHash,
        gateDryRunHash: request.gateDryRun.gateDryRunHash,
        responseHash: sha256Json(response),
        independentProviderExpectation: {
          ...request.independentProviderBinding,
          transactionId: request.transactionId,
          auditAttemptId: request.auditAttemptId,
          requestHash: request.requestHash,
          sourceDocumentHash: request.sourceDocumentHash,
          semanticModelHash: request.semanticModelHash,
          projectionSetHash: request.projectionSetHash,
        },
        independentProviderEvidence: response.independentProviderEvidence,
        providerInvocationReceiptRef: null,
        judgeAdapterHostExecution: null,
        convergenceDecision: {
          verdict: 'no_new_valid_gap',
          resetsConvergenceCounter: false,
        },
      };
      receipt.receiptHash = sha256Json(receipt);
      writeFileSync(
        receiptPath,
        `${JSON.stringify({ criticalAuditorReceipt: receipt }, null, 2)}\n`,
        'utf8'
      );

      const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
      const config = yaml.load(readFileSync(configPath, 'utf8')) as Record<string, any>;
      config.judgeRuntime.enabled = false;
      writeFileSync(configPath, yaml.dump(config), 'utf8');

      const result = runAuthoring(root, fixture.source, recordId, {
        ...fixture.authoringOptions,
        criticalAuditorProviderMode: 'external_adapter',
        maxCriticalAuditorRounds: 1,
      });

      expect(issueCodes(result)).toContain('critical_auditor_judge_runtime_disabled');
      expect(issueCodes(result)).not.toContain(
        'critical_auditor_no_new_gap_convergence_not_reached'
      );
      expect(result.userConfirmable).toBe(false);
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('no-new-gap response writer rejects deterministic synthesis without writing a response', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-writer-quality-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-WRITER-QUALITY';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const requestForWriter = {
        ...(fixture.request as any),
        gateDryRun: {
          ...((fixture.request as any).gateDryRun ?? {}),
          verdict: 'PASS',
          failedChecks: [],
          actionableBlockingIssueCount: 0,
          actionableBlockingIssues: [],
        },
      };
      const requestForWriterPath = path.join(
        path.dirname(fixture.requestPath),
        'critical-auditor-round-request-writer-fixture.json'
      );
      writeFileSync(requestForWriterPath, `${JSON.stringify(requestForWriter, null, 2)}\n`, 'utf8');
      const script = path.join(
        process.cwd(),
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'write-critical-auditor-no-new-gap-response.js'
      );

      const result = spawnSync(
        process.execPath,
        [
          script,
          '--authoring-dir',
          path.dirname(fixture.requestPath),
          '--request',
          requestForWriterPath,
          '--response-out',
          responsePath,
          '--round',
          '1',
          '--reviewed-projection-ref',
          String((fixture.request as any).packetProjectionSummary.projectionRefs[0]),
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );

      expect(result.status, result.stderr || result.stdout).toBe(1);
      const response = JSON.parse(result.stdout || result.stderr);
      expect(response).toMatchObject({
        ok: false,
        failureClass: 'critical_auditor_independent_provider_evidence_required',
        issues: ['deterministic_no_new_gap_response_writer_forbidden'],
        receiptWritten: false,
      });
      expect(existsSync(responsePath)).toBe(false);
      expect(response.requestHash).toBe((fixture.request as any).requestHash);
      const writerSource = readFileSync(script, 'utf8');
      expect(writerSource).not.toContain('function buildResponse(');
      expect(writerSource).not.toMatch(/verdict:\s*["']no_new_valid_gap["']/u);
    } finally {
      removeTempRoot(root);
    }
  });

  it('binds Critical Auditor semanticModelHash to the production semantic manifest', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-semantic-binding-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-SEMANTIC-BINDING';
      const fixture = createRequestForResponseFile(root, recordId);
      const artifactPaths = artifacts(root, recordId, `${recordId}-SET`);
      const manifest = readJson<Record<string, any>>(
        artifactPaths.semanticConservationManifest
      );
      const kernel = readJson<{ semanticKernel: Record<string, any> }>(
        path.join(artifactPaths.authoring, 'semantic-kernel.json')
      ).semanticKernel;

      expect(kernel.semanticModelHash).toBe(manifest.semanticModelHash);
      expect(fixture.packet.semanticModelHash).toBe(manifest.semanticModelHash);
      expect(fixture.request.semanticModelHash).toBe(manifest.semanticModelHash);
      expect(fixture.request.semanticModelHash).not.toBe(kernel.kernelHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('binds the staging transaction to the exact frozen draft audited by the request', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-audit-source-binding-');
    try {
      const recordId = `REQ-CRITICAL-AUDITOR-${randomUUID()}`.toUpperCase();
      const { first, request } = createRequestForResponseFile(root, recordId);
      const stagingTransaction = first.stagingTransaction as
        | {
            sourceStartHash?: string;
            auditSourceHash?: string;
            transactionId?: string;
            namespaceVersion?: string;
          }
        | null
        | undefined;

      expect(stagingTransaction).toBeTruthy();
      expect(stagingTransaction?.auditSourceHash).toBe(request.sourceDocumentHash);
      expect(stagingTransaction?.sourceStartHash).not.toBe(stagingTransaction?.auditSourceHash);
      expect(request.transactionId).toBe(stagingTransaction?.transactionId);
      expect(request.namespaceVersion).toBe(stagingTransaction?.namespaceVersion);
    } finally {
      removeTempRoot(root);
    }
  });

  it('no-new-gap response writer fails closed on malformed gate counts and out-of-scope requests', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-writer-fail-closed-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-WRITER-FAIL-CLOSED';
      const fixture = createRequestForResponseFile(root, recordId);
      const authoringDir = path.dirname(fixture.requestPath);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const script = path.join(
        process.cwd(),
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'write-critical-auditor-no-new-gap-response.js'
      );
      const malformedRequest = {
        ...(fixture.request as any),
        gateDryRun: {
          ...((fixture.request as any).gateDryRun ?? {}),
          actionableBlockingIssueCount: 'not-a-number',
          actionableBlockingIssues: {},
          reconciliation: {
            ...(((fixture.request as any).gateDryRun ?? {}).reconciliation ?? {}),
            issueCount: 'not-a-number',
          },
        },
      };
      const malformedRequestPath = path.join(
        authoringDir,
        'critical-auditor-round-request-malformed.json'
      );
      writeFileSync(malformedRequestPath, `${JSON.stringify(malformedRequest, null, 2)}\n`, 'utf8');

      const malformed = spawnSync(
        process.execPath,
        [
          script,
          '--authoring-dir',
          authoringDir,
          '--request',
          malformedRequestPath,
          '--response-out',
          responsePath,
          '--round',
          '1',
          '--reviewed-projection-ref',
          String((fixture.request as any).packetProjectionSummary.projectionRefs[0]),
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      const malformedJson = JSON.parse(malformed.stdout);
      expect(malformed.status).toBe(1);
      expect(malformedJson.issues).toEqual(
        expect.arrayContaining([
          'critical_auditor_request_gate_dry_run_blocker_count_malformed',
          'critical_auditor_request_gate_dry_run_blockers_malformed',
          'critical_auditor_request_reconciliation_issue_count_malformed',
        ])
      );

      const outOfScopeRequestPath = path.join(root, 'critical-auditor-round-request-outside.json');
      writeFileSync(outOfScopeRequestPath, `${JSON.stringify(fixture.request, null, 2)}\n`, 'utf8');
      const outOfScope = spawnSync(
        process.execPath,
        [
          script,
          '--authoring-dir',
          authoringDir,
          '--request',
          outOfScopeRequestPath,
          '--response-out',
          responsePath,
          '--round',
          '1',
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      expect(outOfScope.status).toBe(1);
      const outOfScopeJson = JSON.parse(outOfScope.stdout);
      expect(outOfScopeJson).toMatchObject({
        ok: false,
        failureClass: 'critical_auditor_no_new_gap_response_failed',
        error: 'request_outside_authoring_dir',
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('round requests require Critical Auditor to check per-MUST projection quality rules', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-projection-quality-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-PROJECTION-QUALITY';
      const fixture = createRequestForResponseFile(root, recordId);
      const request = fixture.request as Record<string, any>;

      expect(request.projectionQualityGate).toMatchObject({
        requiredRuleCodes: expect.arrayContaining([
          'projection_per_must_acceptance_not_independent',
          'projection_shared_evidence_without_per_must_oracle',
          'required_command_all_cover_all_without_per_must_assertions',
          'target_modification_path_all_cover_all',
          'current_target_map_not_product_specific',
          'business_visual_generic_or_compressed',
        ]),
      });
      expect(request.auditStandards.join('\n')).toContain('per-MUST independent acceptance');
      expect(request.requiredResponseSchema.checkedProjectionQualityRuleCodes).toEqual(
        request.projectionQualityGate.requiredRuleCodes
      );
      expect(request.requiredResponseSchema.validatedGaps).toEqual([
        expect.objectContaining({
          repairActions: [
            expect.objectContaining({
              actionId: expect.any(String),
              type: expect.any(String),
              sourceSpan: expect.any(Object),
              sourceText: expect.any(String),
              targetField: expect.any(String),
              newValue: expect.anything(),
              reason: expect.any(String),
              mustRefs: expect.any(Array),
              requirementIds: expect.any(Array),
            }),
          ],
        }),
      ]);
    } finally {
      removeTempRoot(root);
    }
  });

  it.each([
    'response_file',
    'codex_subagent_readonly',
    'claude_subagent_readonly',
  ] as const)('rejects the file-backed %s provider before consuming a response', (providerMode) => {
    const root = createTempRoot('requirements-contract-file-backed-provider-hard-cut-');
    try {
      const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const materialization = createAuthoringConsumerFixture(root, recordId);
      const beforeHash = sha256File(materialization.sourcePath);
      const responsePath = path.join(root, 'untrusted-critical-auditor-response.json');
      writeFileSync(
        responsePath,
        JSON.stringify({
          schemaVersion: 'critical-auditor-round-response/v1',
          verdict: 'no_new_valid_gap',
        }),
        'utf8'
      );

      expect(() =>
        runAuthoring(root, materialization.sourcePath, recordId, {
          ...materialization.authoringOptions,
          criticalAuditorProviderMode: providerMode,
          criticalAuditorResponseFile: responsePath,
        })
      ).toThrow('critical_auditor_file_backed_provider_forbidden');

      expectSourceHashUnchanged(materialization.sourcePath, beforeHash);
      const authoringDir = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'authoring'
      );
      expect(
        !existsSync(authoringDir) ||
          !readdirSync(authoringDir, { withFileTypes: true }).some((entry) =>
            entry.name.startsWith('critical-auditor-receipt-round-')
          )
      ).toBe(true);
    } finally {
      removeTempRoot(root);
    }
  });

  it('public CLI rejects critical auditor response directory aliases before provider dispatch', () => {
    for (const flag of ['--critical-auditor-response-dir', '--criticalAuditorResponseDir']) {
      const root = createTempRoot(
        `requirements-contract-response-dir-cli-${flag.replace(/[^a-z]/gi, '-')}-`
      );
      const originalStdoutWrite = process.stdout.write;
      const originalConsoleError = console.error;
      const stdout: string[] = [];
      const stderr: string[] = [];
      try {
        const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
        const materialization = createAuthoringConsumerFixture(root, recordId);
        const beforeHash = sha256File(materialization.sourcePath);
        const responseDir = path.join(root, 'auditor-responses');
        mkdirSync(responseDir, { recursive: true });
        writeFileSync(
          path.join(responseDir, 'critical-auditor-round-response-1.json'),
          JSON.stringify({
            schemaVersion: 'critical-auditor-round-response/v1',
            verdict: 'no_new_valid_gap',
          }),
          'utf8'
        );
        process.stdout.write = ((chunk: string | Uint8Array) => {
          stdout.push(chunk.toString());
          return true;
        }) as typeof process.stdout.write;
        console.error = (...args: unknown[]) => {
          stderr.push(args.map(String).join(' '));
        };

        const exitCode = mainMainAgentOrchestration([
          '--cwd',
          root,
          '--action',
          'author-confirmation-ready-source',
          '--source',
          materialization.sourcePath,
          '--record-id',
          recordId,
          '--requirement-set-id',
          `${recordId}-SET`,
          '--implementation-attempt-id',
          materialization.authoringOptions.implementationAttemptId,
          '--session-id',
          materialization.authoringOptions.sessionId,
          '--session-turn-id',
          materialization.authoringOptions.sessionTurnId,
          '--session-message-id',
          materialization.authoringOptions.sessionMessageId,
          '--session-actor-identity-class',
          materialization.authoringOptions.sessionActorIdentityClass,
          '--session-branch',
          materialization.authoringOptions.sessionBranch,
          '--session-captured-at',
          materialization.authoringOptions.sessionCapturedAt,
          '--confirmation-language',
          materialization.authoringOptions.confirmationLanguage,
          '--target-path',
          materialization.authoringOptions.targetPath,
          '--required-command',
          materialization.authoringOptions.requiredCommand,
          '--critical-auditor-provider-mode',
          'response_file',
          flag,
          responseDir,
        ]);

        expect(exitCode).toBe(1);
        expect(stdout.join('')).toBe('');
        expect(stderr.join('')).toContain('critical_auditor_file_backed_provider_forbidden');
        const authoringDir = path.join(
          root,
          '_bmad-output',
          'runtime',
          'requirement-records',
          recordId,
          'authoring'
        );
        expect(
          !existsSync(authoringDir) ||
            !readdirSync(authoringDir, { withFileTypes: true }).some((entry) =>
              entry.name.startsWith('critical-auditor-receipt-round-')
            )
        ).toBe(true);
        expectSourceHashUnchanged(materialization.sourcePath, beforeHash);
      } finally {
        process.stdout.write = originalStdoutWrite;
        console.error = originalConsoleError;
        removeTempRoot(root);
      }
    }
  });

  it('external_adapter defaults to the package-controlled Judge action without explicit argv', () => {
    const root = createTempRoot('requirements-contract-external-adapter-');
    try {
      const recordId = 'REQ-EXTERNAL-ADAPTER';
      const materialization = createAuthoringConsumerFixture(root, recordId);
      const source = materialization.sourcePath;
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, recordId, {
        ...materialization.authoringOptions,
        criticalAuditorProviderMode: 'external_adapter',
        skipDrilldownArtifacts: true,
      });

      expect(issueCodes(result)).not.toContain('critical_auditor_external_adapter_missing');
      expect(issueCodes(result)).toContain('pre_confirmation_drilldown_core_surfaces_missing');
      expect(result.blockingStage).toBe('pre_confirmation_drilldown_core_surfaces_missing');
      expect(result.sourceMutationPerformed).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('public CLI preserves the canonical external_adapter when no command override is supplied', () => {
    const root = createTempRoot('requirements-contract-external-adapter-cli-');
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;
    const stdout: string[] = [];
    const stderr: string[] = [];
    try {
      const recordId = 'REQ-EXTERNAL-ADAPTER-CLI';
      const materialization = createAuthoringConsumerFixture(root, recordId);
      process.stdout.write = ((chunk: unknown) => {
        stdout.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      process.stderr.write = ((chunk: unknown) => {
        stderr.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      const exitCode = mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'pre-confirmation-drilldown',
        '--source',
        materialization.sourcePath,
        '--record-id',
        recordId,
        '--requirement-set-id',
        recordId,
        '--target-path',
        materialization.authoringOptions.targetPath,
        '--required-command',
        materialization.authoringOptions.requiredCommand,
        '--critical-auditor-provider-mode',
        'external_adapter',
        '--skip-drilldown-artifacts',
      ]);

      expect(exitCode).toBe(1);
      expect(stderr.join('')).not.toContain(
        'critical_auditor_external_adapter_command_override_forbidden'
      );
      const result = JSON.parse(stdout.join(''));
      expect(issueCodes(result)).toContain('pre_confirmation_drilldown_core_surfaces_missing');
      expect(result.criticalAuditorProviderMode).toBe('external_adapter');
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      removeTempRoot(root);
    }
  });

  it('preserves separate host logs across failed production adapter attempts', () => {
    const root = createTempRoot('requirements-contract-external-adapter-host-retry-');
    try {
      const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const fixture = createRequestForResponseFile(root, recordId);
      const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
      const config = yaml.load(readFileSync(configPath, 'utf8')) as {
        judgeRuntime?: {
          activeProviderRef?: string;
          providers?: Record<
            string,
            {
              credentialRef?: string;
              authentication?: {
                type?: string;
              };
              requestPolicy?: {
                timeoutMs?: number;
              };
            }
          >;
          credentialConfig?: {
            path?: string;
            schemaVersion?: string;
          };
        };
      };
      const activeProviderRef = String(config.judgeRuntime?.activeProviderRef ?? '');
      const provider = config.judgeRuntime?.providers?.[activeProviderRef];
      const requestPolicy = provider?.requestPolicy;
      if (!requestPolicy) {
        throw new Error('test_judge_request_policy_missing');
      }
      const credentialConfig = config.judgeRuntime?.credentialConfig;
      const credentialRef = String(provider?.credentialRef ?? '');
      const authenticationType = String(provider?.authentication?.type ?? '');
      if (
        !credentialConfig?.path ||
        !credentialConfig.schemaVersion ||
        !credentialRef ||
        !authenticationType
      ) {
        throw new Error('test_judge_credential_configuration_missing');
      }
      const credentialPath = path.resolve(root, credentialConfig.path);
      mkdirSync(path.dirname(credentialPath), { recursive: true });
      writeFileSync(
        credentialPath,
        yaml.dump({
          schemaVersion: credentialConfig.schemaVersion,
          credentialRevision: 1,
          providers: {
            [credentialRef]: {
              authenticationType,
              apiKey: randomUUID(),
            },
          },
        }),
        'utf8'
      );
      const configuredTimeoutMs = Number(requestPolicy.timeoutMs);
      requestPolicy.timeoutMs = Math.min(configuredTimeoutMs, 1_000);
      writeFileSync(configPath, yaml.dump(config), 'utf8');
      const invoke = () =>
        runAuthoring(root, fixture.source, recordId, {
          ...fixture.authoringOptions,
          criticalAuditorProviderMode: 'external_adapter',
          maxCriticalAuditorRounds: 1,
        });

      const first = invoke();
      expect(issueCodes(first), JSON.stringify(first, null, 2)).toContain(
        'critical_auditor_external_adapter_failed'
      );
      expect(JSON.stringify(first)).not.toContain('critical_auditor_judge_host_log_changed');

      const second = invoke();
      expect(issueCodes(second), JSON.stringify(second, null, 2)).toContain(
        'critical_auditor_external_adapter_failed'
      );
      expect(JSON.stringify(second)).not.toContain('critical_auditor_judge_host_log_changed');

      const firstStagingDir = path.resolve(
        root,
        String((first.stagingTransaction as Record<string, unknown>)?.stagingDir ?? '')
      );
      const secondStagingDir = path.resolve(
        root,
        String((second.stagingTransaction as Record<string, unknown>)?.stagingDir ?? '')
      );
      expect(secondStagingDir, JSON.stringify({ first, second }, null, 2)).toBe(firstStagingDir);
      const outputDir = path.join(
        secondStagingDir,
        'j',
        '1'
      );
      const hostAttemptsDir = path.join(outputDir, 'judge-adapter-host-attempts');
      const attemptDirs = readdirSync(hostAttemptsDir, { withFileTypes: true }).filter((entry) =>
        entry.isDirectory()
      );
      expect(attemptDirs).toHaveLength(2);
      for (const attemptDir of attemptDirs) {
        expect(existsSync(path.join(hostAttemptsDir, attemptDir.name, 'stdout.log'))).toBe(true);
        expect(existsSync(path.join(hostAttemptsDir, attemptDir.name, 'stderr.log'))).toBe(true);
      }
    } finally {
      removeTempRoot(root);
    }
  });

  it('archives the provider invocation namespace with a stale auditor request', () => {
    const root = createTempRoot('requirements-contract-stale-provider-invocation-');
    try {
      const recordId = `REQ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const fixture = createRequestForResponseFile(root, recordId);
      const stagingDir = path.resolve(
        root,
        String(
          (fixture.first.stagingTransaction as Record<string, unknown>)?.stagingDir ?? ''
        )
      );
      expect(path.dirname(fixture.requestPath)).toBe(stagingDir);
      const providerInvocationDir = path.join(
        stagingDir,
        'j',
        '1'
      );
      const sentinelName = `failed-invocation-${randomUUID()}.json`;
      mkdirSync(providerInvocationDir, { recursive: true });
      writeFileSync(
        path.join(providerInvocationDir, sentinelName),
        `${JSON.stringify({
          schemaVersion: 'failed-provider-invocation-sentinel/v1',
          invocationId: randomUUID(),
        })}\n`,
        'utf8'
      );
      writeFileSync(
        fixture.requestPath,
        `${JSON.stringify(
          {
            ...fixture.request,
            auditInputHash: sha256Json({ staleAuditInput: randomUUID() }),
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      runAuthoring(root, fixture.source, recordId, fixture.authoringOptions);

      expect(existsSync(providerInvocationDir)).toBe(false);
      const authoringDir = path.dirname(path.dirname(stagingDir));
      const archiveRoot = path.join(authoringDir, 'archive');
      const archivedSentinelExists = readdirSync(archiveRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .some((entry) =>
          existsSync(
            path.join(
              archiveRoot,
              entry.name,
              'staging',
              path.basename(stagingDir),
              'j',
              '1',
              sentinelName
            )
          )
        );
      expect(archivedSentinelExists).toBe(true);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects an external_adapter command override instead of accepting provider results from the caller', () => {
    const root = createTempRoot('requirements-contract-external-adapter-override-');
    try {
      const recordId = 'REQ-EXTERNAL-ADAPTER-OVERRIDE';
      const fixture = createRequestForResponseFile(root, recordId);

      expect(() =>
        runAuthoring(root, fixture.source, recordId, {
          ...fixture.authoringOptions,
          criticalAuditorProviderMode: 'external_adapter',
          criticalAuditorExternalAdapterCommand: JSON.stringify([
            process.execPath,
            '-e',
            'process.exit(0)',
          ]),
        })
      ).toThrow('critical_auditor_external_adapter_command_override_forbidden');
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it.skip('legacy injected external_adapter result awaits the real configured Judge journey', () => {
    const root = createTempRoot('requirements-contract-external-adapter-execution-');
    try {
      const recordId = 'REQ-EXTERNAL-ADAPTER-EXECUTION';
      const fixture = createRequestForResponseFile(root, recordId);
      const adapterPath = path.join(root, 'critical-auditor-test-adapter.cjs');
      writeFileSync(
        adapterPath,
        [
          "const fs = require('node:fs');",
          'const args = process.argv.slice(2);',
          "const requestIndex = args.indexOf('--request');",
          'if (requestIndex < 0 || !args[requestIndex + 1]) process.exit(2);',
          "const request = JSON.parse(fs.readFileSync(args[requestIndex + 1], 'utf8'));",
          'const binding = request.independentProviderBinding;',
          'const gateDryRun = request.gateDryRun;',
          'const result = {',
          "  schemaVersion: 'critical-auditor-external-adapter-result/v1',",
          '  providerRun: { ...binding, providerRunId: `provider-run-${request.roundIndex}` },',
          '  response: {',
          "    schemaVersion: 'critical-auditor-round-response/v1',",
          "    verdict: 'no_new_valid_gap',",
          '    roundIndex: request.roundIndex,',
          '    transactionId: request.transactionId,',
          '    namespaceVersion: request.namespaceVersion,',
          '    requestHash: request.requestHash,',
          '    sourceHash: request.sourceHash,',
          '    sourceDocumentHash: request.sourceDocumentHash,',
          '    semanticModelHash: request.semanticModelHash,',
          '    implementationConfirmationHash: request.implementationConfirmationHash,',
          '    packetHash: request.packetHash,',
          '    projectionSetHash: request.projectionSetHash,',
          '    gateDryRunHash: gateDryRun.gateDryRunHash,',
          '    reconciliationIssueCount: gateDryRun.reconciliation.issueCount,',
          '    checkedProjectionGroups: request.packetProjectionSummary.projectionGroups,',
          '    checkedProjectionQualityRuleCodes: request.projectionQualityGate.requiredRuleCodes,',
          '    reviewedMustRefs: request.mustRefs,',
          '    reviewedProjectionRefs: request.packetProjectionSummary.projectionRefs.slice(0, 1),',
          '    priorFindingsDisposition: [{',
          '      findingRef: `ROUND-${request.roundIndex}-BASELINE`,',
          "      disposition: request.roundIndex === 1 ? 'new' : 'unchanged',",
          '      evidenceRefs: [gateDryRun.reportPath],',
          '    }],',
          '    rejectedGapCandidates: [{',
          '      id: `REJ-${request.roundIndex}`,',
          "      reason: 'no new valid gap detected',",
          '    }],',
          '    falsePositiveProofs: (gateDryRun.actionableBlockingIssues || []).map((issue) => ({',
          "      blockerCode: String(issue.code || ''),",
          "      proofType: 'current_source_packet_hash_match',",
          '      evidenceRefs: [gateDryRun.reportPath],',
          '    })),',
          '    rationale: `Provider run ${request.roundIndex} found no new valid gap.`,',
          '  },',
          '};',
          'process.stdout.write(`${JSON.stringify(result)}\\n`);',
        ].join('\n'),
        'utf8'
      );

      const result = runAuthoring(root, fixture.source, recordId, {
        ...fixture.authoringOptions,
        criticalAuditorProviderMode: 'external_adapter',
        criticalAuditorExternalAdapterCommand: JSON.stringify([process.execPath, adapterPath]),
        maxCriticalAuditorRounds: 1,
      });
      const response = readJson<Record<string, any>>(roundArtifact(root, recordId, 'response', 1));
      const receipt = readJson<{ criticalAuditorReceipt: Record<string, any> }>(
        roundArtifact(root, recordId, 'receipt', 1)
      ).criticalAuditorReceipt;

      expect(issueCodes(result)).toContain('critical_auditor_no_new_gap_convergence_not_reached');
      expect(response.independentProviderEvidence).toMatchObject({
        providerId: 'local-sonnet-judge',
        model: 'claude-sonnet-5',
        providerRunId: 'provider-run-1',
        requestHash: fixture.request.requestHash,
      });
      expect(receipt.independentProviderEvidence).toEqual(response.independentProviderEvidence);
      expect(receipt.responseHash).toBeDefined();
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it.skip('legacy injected environment probe awaits the real configured Judge journey', () => {
    const root = createTempRoot('requirements-contract-external-adapter-environment-');
    const previousJudgeOverride = process.env.JUDGE_CUSTOM_OVERRIDE;
    const previousBmadJudgeOverride = process.env.BMAD_JUDGE_CUSTOM_OVERRIDE;
    try {
      const recordId = 'REQ-EXTERNAL-ADAPTER-ENVIRONMENT';
      const fixture = createRequestForResponseFile(root, recordId);
      const adapterPath = path.join(root, 'critical-auditor-environment-adapter.cjs');
      writeFileSync(
        adapterPath,
        [
          "const fs = require('node:fs');",
          'const leaked = Object.keys(process.env).filter((key) => /^(?:BMAD_)?JUDGE_/iu.test(key));',
          'if (leaked.length > 0) {',
          '  process.stderr.write(JSON.stringify({ leaked }));',
          '  process.exit(73);',
          '}',
          'const args = process.argv.slice(2);',
          "const requestIndex = args.indexOf('--request');",
          'if (requestIndex < 0 || !args[requestIndex + 1]) process.exit(2);',
          "const request = JSON.parse(fs.readFileSync(args[requestIndex + 1], 'utf8'));",
          'const binding = request.independentProviderBinding;',
          'const gateDryRun = request.gateDryRun;',
          'const result = {',
          "  schemaVersion: 'critical-auditor-external-adapter-result/v1',",
          '  providerRun: { ...binding, providerRunId: `provider-run-${request.roundIndex}` },',
          '  response: {',
          "    schemaVersion: 'critical-auditor-round-response/v1',",
          "    verdict: 'no_new_valid_gap',",
          '    roundIndex: request.roundIndex,',
          '    transactionId: request.transactionId,',
          '    namespaceVersion: request.namespaceVersion,',
          '    requestHash: request.requestHash,',
          '    sourceHash: request.sourceHash,',
          '    sourceDocumentHash: request.sourceDocumentHash,',
          '    semanticModelHash: request.semanticModelHash,',
          '    implementationConfirmationHash: request.implementationConfirmationHash,',
          '    packetHash: request.packetHash,',
          '    projectionSetHash: request.projectionSetHash,',
          '    gateDryRunHash: gateDryRun.gateDryRunHash,',
          '    reconciliationIssueCount: gateDryRun.reconciliation.issueCount,',
          '    checkedProjectionGroups: request.packetProjectionSummary.projectionGroups,',
          '    checkedProjectionQualityRuleCodes: request.projectionQualityGate.requiredRuleCodes,',
          '    reviewedMustRefs: request.mustRefs,',
          '    reviewedProjectionRefs: request.packetProjectionSummary.projectionRefs.slice(0, 1),',
          '    priorFindingsDisposition: [{',
          '      findingRef: `ROUND-${request.roundIndex}-BASELINE`,',
          "      disposition: request.roundIndex === 1 ? 'new' : 'unchanged',",
          '      evidenceRefs: [gateDryRun.reportPath],',
          '    }],',
          '    rejectedGapCandidates: [{',
          '      id: `REJ-${request.roundIndex}`,',
          "      reason: 'no new valid gap detected',",
          '    }],',
          '    falsePositiveProofs: (gateDryRun.actionableBlockingIssues || []).map((issue) => ({',
          "      blockerCode: String(issue.code || ''),",
          "      proofType: 'current_source_packet_hash_match',",
          '      evidenceRefs: [gateDryRun.reportPath],',
          '    })),',
          '    rationale: `Provider run ${request.roundIndex} found no new valid gap.`,',
          '  },',
          '};',
          'process.stdout.write(`${JSON.stringify(result)}\\n`);',
        ].join('\n'),
        'utf8'
      );
      process.env.JUDGE_CUSTOM_OVERRIDE = 'forbidden';
      process.env.BMAD_JUDGE_CUSTOM_OVERRIDE = 'forbidden';

      const result = runAuthoring(root, fixture.source, recordId, {
        ...fixture.authoringOptions,
        criticalAuditorProviderMode: 'external_adapter',
        criticalAuditorExternalAdapterCommand: JSON.stringify([process.execPath, adapterPath]),
        maxCriticalAuditorRounds: 1,
      });

      expect(issueCodes(result)).toContain('critical_auditor_no_new_gap_convergence_not_reached');
      expect(issueCodes(result)).not.toContain('critical_auditor_external_adapter_failed');
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(true);
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      if (previousJudgeOverride === undefined) delete process.env.JUDGE_CUSTOM_OVERRIDE;
      else process.env.JUDGE_CUSTOM_OVERRIDE = previousJudgeOverride;
      if (previousBmadJudgeOverride === undefined) delete process.env.BMAD_JUDGE_CUSTOM_OVERRIDE;
      else process.env.BMAD_JUDGE_CUSTOM_OVERRIDE = previousBmadJudgeOverride;
      removeTempRoot(root);
    }
  });
});
