import Ajv2020 from 'ajv/dist/2020.js';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupFixtures,
  createFixture,
  directoryDigest,
  git,
  hashFile,
  runScript,
  sha256,
  SKILL_ROOT,
} from '../helpers/goal-subcontract-execution-package-fixture';

const buildScript = createRequire(import.meta.url)(
  path.join(SKILL_ROOT, 'scripts', 'build-execution-package.js')
) as {
  git?: (repositoryRoot: string, args: string[], failureClass: string, input?: string) => string;
  writeAtomic: (root: string, relativePath: string, content: string) => string;
};

afterEach(cleanupFixtures);

function compile(requestPath: string, out: string) {
  return runScript('build-execution-package.js', [
    '--request',
    requestPath,
    '--out',
    out,
    '--json',
  ]);
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableJson(value: unknown): string {
  const sorted = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(sorted);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.keys(entry)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sorted((entry as Record<string, unknown>)[key]);
        return result;
      }, {});
  };
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

function rehashPackageArtifact(packageRoot: string, relativePath: string): void {
  const manifestPath = path.join(packageRoot, 'package-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const artifact = manifest.artifacts.find(
    (entry: { path: string }) => entry.path === relativePath
  );
  if (!artifact) throw new Error(`missing package artifact ${relativePath}`);
  artifact.hash = hashFile(path.join(packageRoot, relativePath));
  const core = { ...manifest };
  delete core.packageManifestHash;
  manifest.packageManifestHash = sha256(stableJson(core));
  writeJson(manifestPath, manifest);
}

function auditPackage(packageRoot: string, expectedHash: string) {
  return runScript('audit-execution-package.js', [
    '--package',
    packageRoot,
    '--expected-package-manifest-hash',
    expectedHash,
    '--json',
  ]);
}

function temporaryFiles(root: string): string[] {
  return fs.existsSync(root) ? fs.readdirSync(root).filter((entry) => entry.endsWith('.tmp')) : [];
}

describe('goal subcontract execution package compile', () => {
  it('exports the hardened git helper for other package auditors', () => {
    expect(buildScript.git).toBeTypeOf('function');
  });

  it('forwards optional stdin through the shared git helper', () => {
    const fixture = createFixture();
    const first = buildScript.git?.(
      fixture.root,
      ['hash-object', '--stdin'],
      'shared_git_input_failed',
      'first payload'
    );
    const second = buildScript.git?.(
      fixture.root,
      ['hash-object', '--stdin'],
      'shared_git_input_failed',
      'second payload'
    );

    expect(first).toMatch(/^[a-f0-9]{40,64}$/u);
    expect(second).toMatch(/^[a-f0-9]{40,64}$/u);
    expect(first).not.toBe(second);
  });

  it('preserves the requested failure class when git spawn returns null stderr', () => {
    const fixture = createFixture();
    const result = runScript(
      'build-execution-package.js',
      ['--request', fixture.requestPath, '--out', fixture.packageA, '--json'],
      { env: { ...process.env, PATH: '' } }
    );

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      failureClass: 'invalid_compile_request',
      details: {
        stderr: expect.any(String),
      },
    });
  });

  it('accepts functional display titles containing oauth-2 and utf-8 subjects', () => {
    const fixture = createFixture();
    const manifestPath = path.join(fixture.root, 'partition-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.partitions[0].displayTitle = 'Rotate OAuth-2 tokens with UTF-8 claims';
    writeJson(manifestPath, manifest);
    const request = JSON.parse(fs.readFileSync(fixture.requestPath, 'utf8'));
    request.partitionManifest.hash = hashFile(manifestPath);
    writeJson(fixture.requestPath, request);

    const result = compile(fixture.requestPath, fixture.packageA);

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });

  it.each(['write', 'rename'])('cleans atomic temp files when the %s step fails', (failureStep) => {
    const fixture = createFixture();
    const outputRoot = path.join(fixture.root, `atomic-${failureStep}`);
    const originalWriteFileSync = fs.writeFileSync;
    const writeSpy =
      failureStep === 'write'
        ? vi.spyOn(fs, 'writeFileSync').mockImplementation(((...args: unknown[]) => {
            const result = Reflect.apply(originalWriteFileSync, fs, args);
            if (String(args[0]).endsWith('.tmp')) throw new Error('injected write failure');
            return result;
          }) as typeof fs.writeFileSync)
        : undefined;
    const renameSpy =
      failureStep === 'rename'
        ? vi.spyOn(fs, 'renameSync').mockImplementation(() => {
            throw new Error('injected rename failure');
          })
        : undefined;

    try {
      expect(() => buildScript.writeAtomic(outputRoot, 'artifact.json', '{"ok":true}\n')).toThrow(
        `injected ${failureStep} failure`
      );
      expect(temporaryFiles(outputRoot)).toEqual([]);
    } finally {
      writeSpy?.mockRestore();
      renameSpy?.mockRestore();
    }
  });

  it('keeps the builder entrypoint below 800 lines', () => {
    const source = fs.readFileSync(
      path.join(SKILL_ROOT, 'scripts', 'build-execution-package.js'),
      'utf8'
    );

    expect(source.split(/\r?\n/u).length).toBeLessThan(800);
  });

  it('generates deterministic packages and an absent record branch', () => {
    const fixture = createFixture();
    const headBefore = git(fixture.root, ['rev-parse', 'HEAD']);
    const first = compile(fixture.requestPath, fixture.packageA);
    const second = compile(fixture.requestPath, fixture.packageB);

    expect(first.status, first.stderr || first.stdout).toBe(0);
    expect(second.status, second.stderr || second.stdout).toBe(0);
    expect(git(fixture.root, ['rev-parse', 'HEAD'])).toBe(headBefore);
    expect(directoryDigest(fixture.packageA)).toBe(directoryDigest(fixture.packageB));

    const manifest = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'package-manifest.json'), 'utf8')
    );
    expect(manifest.schemaVersion).toBe('goal-subcontract-execution-package/v2');
    expect(
      manifest.children.map((child: { partitionId: string; displayTitle: string }) => ({
        partitionId: child.partitionId,
        displayTitle: child.displayTitle,
      }))
    ).toEqual([
      {
        partitionId: 'AUTH-01',
        displayTitle: 'Refresh expired access tokens',
      },
      {
        partitionId: 'AUTH-02',
        displayTitle: 'Revoke rotated refresh tokens',
      },
    ]);
    expect(manifest.requirementRecordBinding).toEqual({
      status: 'absent',
      downstreamAction: 'main_agent_resolve_requirement_record',
    });
    expect(manifest.requirementRecordBinding).not.toHaveProperty('recordId');

    const campaignPrompt = fs.readFileSync(
      path.join(fixture.packageA, 'campaign-prompt.md'),
      'utf8'
    );
    expect(campaignPrompt).toContain(
      'Refresh expired access tokens (AUTH-01) -> Revoke rotated refresh tokens (AUTH-02)'
    );
    expect(campaignPrompt).toContain('CMD-COLLECTION: npm test -- auth-campaign');
    expect(campaignPrompt).toContain('Record schema-valid evidence for every collection command.');
    expect(campaignPrompt).not.toContain('Execute in order: AUTH-01 -> AUTH-02');

    const expectedChildIdentities = [
      {
        partitionId: 'AUTH-01',
        displayTitle: 'Refresh expired access tokens',
      },
      {
        partitionId: 'AUTH-02',
        displayTitle: 'Revoke rotated refresh tokens',
      },
    ];
    const taskReportTemplate = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'templates/task-report.json'), 'utf8')
    );
    const handoffTemplate = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'templates/main-agent-handoff.json'), 'utf8')
    );
    expect(taskReportTemplate.childIdentities).toEqual(expectedChildIdentities);
    expect(handoffTemplate.childIdentities).toEqual(expectedChildIdentities);

    const audit = auditPackage(fixture.packageA, JSON.parse(first.stdout).packageManifestHash);
    expect(audit.status, audit.stderr || audit.stdout).toBe(0);
  });

  it('preserves a supplied RequirementRecord binding', () => {
    const fixture = createFixture({
      status: 'present',
      recordId: 'RR-42',
      requirementSetId: 'REQ-42',
      recordPathHash: `sha256:${'a'.repeat(64)}`,
    });
    const result = compile(fixture.requestPath, fixture.packageA);

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'package-manifest.json'), 'utf8')
    );
    expect(manifest.requirementRecordBinding).toEqual({
      status: 'present',
      recordId: 'RR-42',
      requirementSetId: 'REQ-42',
      recordPathHash: `sha256:${'a'.repeat(64)}`,
    });
  });

  it('requires an external trusted package-manifest hash for package audit', () => {
    const fixture = createFixture();
    expect(compile(fixture.requestPath, fixture.packageA).status).toBe(0);

    const result = runScript('audit-execution-package.js', [
      '--package',
      fixture.packageA,
      '--json',
    ]);

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('expected_package_manifest_hash_missing');
  });

  it('emits package and child packet instances that satisfy the bundled schemas', () => {
    const fixture = createFixture();
    const result = compile(fixture.requestPath, fixture.packageA);
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'package-manifest.json'), 'utf8')
    );
    const manifestSchema = JSON.parse(
      fs.readFileSync(
        path.join(SKILL_ROOT, 'schemas/execution-package-manifest.schema.json'),
        'utf8'
      )
    );
    const childSchema = JSON.parse(
      fs.readFileSync(path.join(SKILL_ROOT, 'schemas/child-prompt-packet.schema.json'), 'utf8')
    );
    const validateManifest = ajv.compile(manifestSchema);
    const validateChild = ajv.compile(childSchema);

    expect(validateManifest(manifest), JSON.stringify(validateManifest.errors)).toBe(true);
    const incompleteManifest = structuredClone(manifest);
    incompleteManifest.children[0] = {
      partitionId: manifest.children[0].partitionId,
      displayTitle: manifest.children[0].displayTitle,
    };
    expect(validateManifest(incompleteManifest)).toBe(false);
    const invalidArtifactManifest = structuredClone(manifest);
    invalidArtifactManifest.artifacts[0] = {};
    expect(validateManifest(invalidArtifactManifest)).toBe(false);
    const handoffTemplate = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'templates/main-agent-handoff.json'), 'utf8')
    );
    expect(handoffTemplate).toMatchObject({
      goalContractHash: manifest.goalContract.hash,
      partitionManifestHash: manifest.partitionManifest.hash,
    });
    for (const child of manifest.children) {
      const packet = JSON.parse(
        fs.readFileSync(path.join(fixture.packageA, child.packetPath), 'utf8')
      );
      expect(validateChild(packet), JSON.stringify(validateChild.errors)).toBe(true);
      expect(packet).toMatchObject({
        evidenceSchema: manifest.evidenceSchema,
        closureSchema: manifest.closureSchema,
        executionPolicy: {
          predecessorClosureRequired: true,
          stageOwnedPathsOnly: true,
          closureStatus: 'closed',
          commitVerificationFields: [
            'hash',
            'parentHash',
            'treeHash',
            'subject',
            'changedPaths',
            'diff',
            'reachability',
            'trailers',
          ],
        },
      });
      const prompt = fs.readFileSync(path.join(fixture.packageA, child.promptPath), 'utf8');
      expect(prompt).toContain(
        `Evidence schema: ${manifest.evidenceSchema.path}#${manifest.evidenceSchema.hash}`
      );
      expect(prompt).toContain(
        `Closure schema: ${manifest.closureSchema.path}#${manifest.closureSchema.hash}`
      );
      expect(prompt).toContain(
        'Commit verification: hash, parentHash, treeHash, subject, changedPaths, diff, reachability, trailers'
      );
      expect(prompt).toContain('Inspect the actual commit diff');
    }
  });

  it('rejects stale source hashes and generated artifact tampering', () => {
    const stale = createFixture();
    fs.appendFileSync(path.join(stale.root, stale.children[0].path), '\ndrift\n', 'utf8');
    const staleResult = compile(stale.requestPath, stale.packageA);
    expect(staleResult.status).not.toBe(0);
    expect(JSON.parse(staleResult.stdout).failureClass).toBe('child_contract_hash_mismatch');

    const tampered = createFixture();
    const built = compile(tampered.requestPath, tampered.packageA);
    expect(built.status, built.stderr || built.stdout).toBe(0);
    fs.appendFileSync(path.join(tampered.packageA, 'campaign-prompt.md'), '\ntampered\n', 'utf8');
    const audit = auditPackage(tampered.packageA, JSON.parse(built.stdout).packageManifestHash);
    expect(audit.status).not.toBe(0);
    expect(JSON.parse(audit.stdout).failureClass).toBe('package_artifact_hash_mismatch');
  });

  it('rejects self-rehashed human projections that fall back to bare child identifiers', () => {
    const scenarios = [
      {
        selectPath: () => 'campaign-prompt.md',
        mutate(content: string) {
          return content.replace(
            'Refresh expired access tokens (AUTH-01) -> Revoke rotated refresh tokens (AUTH-02)',
            'AUTH-01 -> AUTH-02'
          );
        },
      },
      {
        selectPath: (manifest: { children: Array<{ promptPath: string }> }) =>
          manifest.children[1].promptPath,
        mutate(content: string) {
          return content.replace(
            'Predecessors: Refresh expired access tokens (AUTH-01)',
            'Predecessors: AUTH-01'
          );
        },
      },
      {
        selectPath: () => 'templates/task-report.json',
        mutate(content: string) {
          const template = JSON.parse(content);
          template.childIdentities = template.childIdentities.map(
            ({ partitionId }: { partitionId: string }) => ({
              partitionId,
              displayTitle: partitionId,
            })
          );
          return stableJson(template);
        },
      },
    ];

    for (const scenario of scenarios) {
      const fixture = createFixture();
      const compiled = compile(fixture.requestPath, fixture.packageA);
      expect(compiled.status).toBe(0);
      const trustedPackageManifestHash = JSON.parse(compiled.stdout).packageManifestHash;
      const manifest = JSON.parse(
        fs.readFileSync(path.join(fixture.packageA, 'package-manifest.json'), 'utf8')
      );
      const relativePath = scenario.selectPath(manifest);
      const artifactPath = path.join(fixture.packageA, relativePath);
      fs.writeFileSync(
        artifactPath,
        scenario.mutate(fs.readFileSync(artifactPath, 'utf8')),
        'utf8'
      );
      rehashPackageArtifact(fixture.packageA, relativePath);

      const result = auditPackage(fixture.packageA, trustedPackageManifestHash);

      expect(result.status).not.toBe(0);
      expect(JSON.parse(result.stdout).failureClass).toBe('package_manifest_hash_mismatch');
    }
  });

  it('reconstructs source projections after an attacker-supplied receipt bypasses the first hash gate', () => {
    const fixture = createFixture();
    const compiled = compile(fixture.requestPath, fixture.packageA);
    expect(compiled.status).toBe(0);
    const campaignPromptPath = path.join(fixture.packageA, 'campaign-prompt.md');
    fs.appendFileSync(campaignPromptPath, '\nattacker-controlled projection\n', 'utf8');
    rehashPackageArtifact(fixture.packageA, 'campaign-prompt.md');
    const attackerManifest = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'package-manifest.json'), 'utf8')
    );

    const result = auditPackage(fixture.packageA, attackerManifest.packageManifestHash);

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('package_projection_mismatch');
  });

  it('rejects child-order drift, source path escape, and partition coverage gaps', () => {
    const reordered = createFixture();
    const reorderedRequest = JSON.parse(fs.readFileSync(reordered.requestPath, 'utf8'));
    reorderedRequest.children.reverse();
    writeJson(reordered.requestPath, reorderedRequest);
    const reorderedResult = compile(reordered.requestPath, reordered.packageA);
    expect(JSON.parse(reorderedResult.stdout).failureClass).toBe('child_membership_mismatch');

    const escaped = createFixture();
    const escapedRequest = JSON.parse(fs.readFileSync(escaped.requestPath, 'utf8'));
    escapedRequest.goalContract.path = '../goal.md';
    writeJson(escaped.requestPath, escapedRequest);
    const escapedResult = compile(escaped.requestPath, escaped.packageA);
    expect(JSON.parse(escapedResult.stdout).failureClass).toBe('source_path_escape');

    const coverage = createFixture();
    const manifestPath = path.join(coverage.root, 'partition-manifest.json');
    const coverageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    coverageManifest.coverage.uncoveredObligationIds.push('REQ-GAP');
    writeJson(manifestPath, coverageManifest);
    const coverageRequest = JSON.parse(fs.readFileSync(coverage.requestPath, 'utf8'));
    coverageRequest.partitionManifest.hash = hashFile(manifestPath);
    writeJson(coverage.requestPath, coverageRequest);
    const coverageResult = compile(coverage.requestPath, coverage.packageA);
    expect(JSON.parse(coverageResult.stdout).failureClass).toBe('partition_coverage_incomplete');

    const nonTopological = createFixture();
    const nonTopologicalManifestPath = path.join(nonTopological.root, 'partition-manifest.json');
    const nonTopologicalManifest = JSON.parse(fs.readFileSync(nonTopologicalManifestPath, 'utf8'));
    nonTopologicalManifest.partitions[0].dependencyPartitionIds = ['AUTH-02'];
    writeJson(nonTopologicalManifestPath, nonTopologicalManifest);
    const nonTopologicalRequest = JSON.parse(fs.readFileSync(nonTopological.requestPath, 'utf8'));
    nonTopologicalRequest.partitionManifest.hash = hashFile(nonTopologicalManifestPath);
    writeJson(nonTopological.requestPath, nonTopologicalRequest);
    const nonTopologicalResult = compile(nonTopological.requestPath, nonTopological.packageA);
    expect(JSON.parse(nonTopologicalResult.stdout).failureClass).toBe(
      'partition_manifest_not_final'
    );
  });

  it('rejects machine-only and lifecycle-only partition display titles', () => {
    for (const displayTitle of [
      'AUTH-01',
      'Complete AUTH-01 implementation',
      'Refresh credentials for AUTH-02',
      'Authentication',
      '认证能力',
    ]) {
      const fixture = createFixture();
      const manifestPath = path.join(fixture.root, 'partition-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.partitions[0].displayTitle = displayTitle;
      writeJson(manifestPath, manifest);
      const request = JSON.parse(fs.readFileSync(fixture.requestPath, 'utf8'));
      request.partitionManifest.hash = hashFile(manifestPath);
      writeJson(fixture.requestPath, request);

      const result = compile(fixture.requestPath, fixture.packageA);

      expect(result.status).not.toBe(0);
      expect(JSON.parse(result.stdout).failureClass).toBe('child_display_title_not_human_readable');
    }
  });

  it('requires exact effective Goal freeze directives', () => {
    const fixture = createFixture();
    const goalPath = path.join(fixture.root, 'goal.md');
    fs.writeFileSync(
      goalPath,
      '# Frozen Goal\n\n# contractMode: frozen\nrewritePolicy: forbidden-ish\n',
      'utf8'
    );
    const request = JSON.parse(fs.readFileSync(fixture.requestPath, 'utf8'));
    request.goalContract.hash = hashFile(goalPath);
    writeJson(fixture.requestPath, request);

    const result = compile(fixture.requestPath, fixture.packageA);

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('goal_contract_not_frozen');

    const fencedOnly = createFixture();
    const fencedGoalPath = path.join(fencedOnly.root, 'goal.md');
    fs.writeFileSync(
      fencedGoalPath,
      '# Goal Example\n\n```yaml\ncontractMode: frozen\nrewritePolicy: forbidden\n```\n',
      'utf8'
    );
    const fencedRequest = JSON.parse(fs.readFileSync(fencedOnly.requestPath, 'utf8'));
    fencedRequest.goalContract.hash = hashFile(fencedGoalPath);
    writeJson(fencedOnly.requestPath, fencedRequest);
    const fencedResult = compile(fencedOnly.requestPath, fencedOnly.packageA);
    expect(JSON.parse(fencedResult.stdout).failureClass).toBe('goal_contract_not_frozen');

    const effectiveWithExample = createFixture();
    const effectiveGoalPath = path.join(effectiveWithExample.root, 'goal.md');
    fs.writeFileSync(
      effectiveGoalPath,
      [
        '# Frozen Goal',
        '',
        'contractMode: frozen',
        'rewritePolicy: forbidden',
        '',
        '```yaml',
        'contractMode: frozen',
        'rewritePolicy: forbidden',
        '```',
        '',
      ].join('\n'),
      'utf8'
    );
    const effectiveRequest = JSON.parse(fs.readFileSync(effectiveWithExample.requestPath, 'utf8'));
    effectiveRequest.goalContract.hash = hashFile(effectiveGoalPath);
    writeJson(effectiveWithExample.requestPath, effectiveRequest);
    expect(compile(effectiveWithExample.requestPath, effectiveWithExample.packageA).status).toBe(0);

    const falseFenceCloser = createFixture();
    const falseFenceGoalPath = path.join(falseFenceCloser.root, 'goal.md');
    fs.writeFileSync(
      falseFenceGoalPath,
      [
        '# Goal Example',
        '',
        '````text',
        '````yaml',
        'contractMode: frozen',
        'rewritePolicy: forbidden',
        '````',
        '',
      ].join('\n'),
      'utf8'
    );
    const falseFenceRequest = JSON.parse(fs.readFileSync(falseFenceCloser.requestPath, 'utf8'));
    falseFenceRequest.goalContract.hash = hashFile(falseFenceGoalPath);
    writeJson(falseFenceCloser.requestPath, falseFenceRequest);
    const falseFenceResult = compile(falseFenceCloser.requestPath, falseFenceCloser.packageA);
    expect(JSON.parse(falseFenceResult.stdout).failureClass).toBe('goal_contract_not_frozen');
  });

  it('requires an explicit canonical Git repository root', () => {
    const fixture = createFixture();
    const request = JSON.parse(fs.readFileSync(fixture.requestPath, 'utf8'));
    delete request.repositoryRoot;
    writeJson(fixture.requestPath, request);

    const result = compile(fixture.requestPath, fixture.packageA);

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('invalid_compile_request');
  });

  it('validates bound schemas before package readiness', () => {
    const invalidJson = createFixture();
    const invalidJsonSchemaPath = path.join(invalidJson.root, 'schemas/evidence.json');
    fs.writeFileSync(invalidJsonSchemaPath, '{ invalid json\n', 'utf8');
    const invalidJsonRequest = JSON.parse(fs.readFileSync(invalidJson.requestPath, 'utf8'));
    invalidJsonRequest.evidenceSchema.hash = hashFile(invalidJsonSchemaPath);
    writeJson(invalidJson.requestPath, invalidJsonRequest);

    const invalidJsonResult = compile(invalidJson.requestPath, invalidJson.packageA);
    expect(JSON.parse(invalidJsonResult.stdout).failureClass).toBe('evidence_schema_invalid');

    const invalidSchema = createFixture();
    const invalidSchemaPath = path.join(invalidSchema.root, 'schemas/closure.json');
    writeJson(invalidSchemaPath, { type: 'not-a-json-schema-type' });
    const invalidSchemaRequest = JSON.parse(fs.readFileSync(invalidSchema.requestPath, 'utf8'));
    invalidSchemaRequest.closureSchema.hash = hashFile(invalidSchemaPath);
    writeJson(invalidSchema.requestPath, invalidSchemaRequest);

    const invalidSchemaResult = compile(invalidSchema.requestPath, invalidSchema.packageA);
    expect(JSON.parse(invalidSchemaResult.stdout).failureClass).toBe('closure_schema_invalid');
  });

  it('enforces runtime manifest invariants and bundled package schemas', () => {
    const invalidSourceManifest = createFixture();
    const sourceManifestPath = path.join(invalidSourceManifest.root, 'partition-manifest.json');
    const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
    sourceManifest.partitionManifestHash = 'not-a-sha256';
    sourceManifest.partitions[0].ownedArtifactPaths.push(
      sourceManifest.partitions[0].ownedArtifactPaths[0]
    );
    writeJson(sourceManifestPath, sourceManifest);
    const invalidRequest = JSON.parse(fs.readFileSync(invalidSourceManifest.requestPath, 'utf8'));
    invalidRequest.partitionManifest.hash = hashFile(sourceManifestPath);
    writeJson(invalidSourceManifest.requestPath, invalidRequest);

    const invalidSourceResult = compile(
      invalidSourceManifest.requestPath,
      invalidSourceManifest.packageA
    );
    expect(JSON.parse(invalidSourceResult.stdout).failureClass).toBe(
      'partition_manifest_not_final'
    );

    const invalidPackage = createFixture();
    const compiled = compile(invalidPackage.requestPath, invalidPackage.packageA);
    expect(compiled.status).toBe(0);
    const manifestPath = path.join(invalidPackage.packageA, 'package-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.children[0].packetHash;
    const core = { ...manifest };
    delete core.packageManifestHash;
    manifest.packageManifestHash = sha256(stableJson(core));
    writeJson(manifestPath, manifest);

    const audit = auditPackage(invalidPackage.packageA, manifest.packageManifestHash);
    expect(audit.status).not.toBe(0);
    expect(JSON.parse(audit.stdout).failureClass).toBe('invalid_package_manifest');
  });

  it('rejects a repository baseline whose tree does not belong to its commit', () => {
    const fixture = createFixture();
    const compiled = compile(fixture.requestPath, fixture.packageA);
    expect(compiled.status).toBe(0);
    const manifestPath = path.join(fixture.packageA, 'package-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.repositoryBaseline.treeHash = manifest.repositoryBaseline.headCommit;
    const core = { ...manifest };
    delete core.packageManifestHash;
    manifest.packageManifestHash = sha256(stableJson(core));
    writeJson(manifestPath, manifest);

    const result = auditPackage(fixture.packageA, manifest.packageManifestHash);

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('repository_baseline_mismatch');
  });

  it('rejects undeclared files in an otherwise hash-valid package', () => {
    const fixture = createFixture();
    const compiled = compile(fixture.requestPath, fixture.packageA);
    expect(compiled.status).toBe(0);
    fs.writeFileSync(path.join(fixture.packageA, 'undeclared-control.txt'), 'drift\n', 'utf8');

    const audit = auditPackage(fixture.packageA, JSON.parse(compiled.stdout).packageManifestHash);

    expect(audit.status).not.toBe(0);
    expect(JSON.parse(audit.stdout).failureClass).toBe('undeclared_package_artifact');
  });

  it('rejects source and output paths that escape through filesystem links', () => {
    const outsideSource = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-source-outside-'));
    const outsideOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-output-outside-'));
    try {
      const sourceFixture = createFixture();
      fs.writeFileSync(
        path.join(outsideSource, 'goal.md'),
        '# Frozen Goal\n\ncontractMode: frozen\nrewritePolicy: forbidden\n',
        'utf8'
      );
      fs.symlinkSync(outsideSource, path.join(sourceFixture.root, 'outside-source'), 'junction');
      const sourceRequest = JSON.parse(fs.readFileSync(sourceFixture.requestPath, 'utf8'));
      sourceRequest.goalContract = {
        path: 'outside-source/goal.md',
        hash: hashFile(path.join(outsideSource, 'goal.md')),
      };
      writeJson(sourceFixture.requestPath, sourceRequest);
      const sourceResult = compile(sourceFixture.requestPath, sourceFixture.packageA);
      expect(JSON.parse(sourceResult.stdout).failureClass).toBe('source_path_escape');

      const outputFixture = createFixture();
      fs.mkdirSync(outputFixture.packageA, { recursive: true });
      fs.symlinkSync(outsideOutput, path.join(outputFixture.packageA, 'children'), 'junction');
      const outputResult = compile(outputFixture.requestPath, outputFixture.packageA);
      expect(JSON.parse(outputResult.stdout).failureClass).toBe('package_output_path_escape');
    } finally {
      fs.rmSync(outsideSource, { recursive: true, force: true });
      fs.rmSync(outsideOutput, { recursive: true, force: true });
    }
  });

  it('rejects partition manifest display-title drift after package compilation', () => {
    const fixture = createFixture();
    const compiled = compile(fixture.requestPath, fixture.packageA);
    expect(compiled.status).toBe(0);
    const trustedPackageManifestHash = JSON.parse(compiled.stdout).packageManifestHash;
    const manifestPath = path.join(fixture.root, 'partition-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.partitions[0].displayTitle = 'Issue emergency administrator credentials';
    writeJson(manifestPath, manifest);

    const result = auditPackage(fixture.packageA, trustedPackageManifestHash);

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('partition_manifest_hash_mismatch');
  });

  it('rejects a self-rehashed package artifact path change against the trusted receipt', () => {
    const fixture = createFixture();
    const result = compile(fixture.requestPath, fixture.packageA);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const trustedPackageManifestHash = JSON.parse(result.stdout).packageManifestHash;
    const manifestPath = path.join(fixture.packageA, 'package-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.artifacts[0].path = '../escaped-artifact.md';
    const core = { ...manifest };
    delete core.packageManifestHash;
    manifest.packageManifestHash = sha256(stableJson(core));
    writeJson(manifestPath, manifest);

    const audit = auditPackage(fixture.packageA, trustedPackageManifestHash);
    expect(audit.status).not.toBe(0);
    expect(JSON.parse(audit.stdout).failureClass).toBe('package_manifest_hash_mismatch');
  });
});
