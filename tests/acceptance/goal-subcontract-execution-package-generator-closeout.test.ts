import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareCampaign } from '../helpers/goal-subcontract-campaign-fixture';
import {
  cleanupFixtures,
  git,
  hashFile,
  runScript,
} from '../helpers/goal-subcontract-execution-package-fixture';

afterEach(cleanupFixtures);

const sha256 = (value: string | Buffer) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const sorted = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => [key, sorted((value as Record<string, unknown>)[key])])
        )
      : value;
const stable = (value: unknown): string => `${JSON.stringify(sorted(value), null, 2)}\n`;

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

function rawTrackedMaterializationHash(repositoryRoot: string): string {
  const inventory = spawnSync('git', ['-C', repositoryRoot, 'ls-files', '--stage', '-z'], {
    encoding: 'buffer',
    windowsHide: true,
  });
  if (inventory.status !== 0) throw new Error(inventory.stderr.toString('utf8'));
  const entries = inventory.stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d{6}) ([0-9a-f]+) (\d)\t(.+)$/u.exec(record);
      if (!match || match[3] !== '0') throw new Error(`invalid fixture inventory: ${record}`);
      const [, mode, objectId, , relativePath] = match;
      const absolutePath = path.join(repositoryRoot, relativePath);
      const stat = fs.lstatSync(absolutePath);
      if (mode === '160000') {
        if (!stat.isDirectory()) throw new Error(`fixture type mismatch: ${relativePath}`);
        return {
          path: relativePath.replace(/\\/gu, '/'),
          mode,
          type: 'gitlink',
          commit: objectId,
        };
      }
      if (mode === '120000') {
        if (!stat.isSymbolicLink()) throw new Error(`fixture type mismatch: ${relativePath}`);
        return {
          path: relativePath.replace(/\\/gu, '/'),
          mode,
          type: 'symlink',
          hash: sha256(Buffer.from(fs.readlinkSync(absolutePath), 'utf8')),
        };
      }
      if (!stat.isFile()) throw new Error(`fixture type mismatch: ${relativePath}`);
      return {
        path: relativePath.replace(/\\/gu, '/'),
        mode,
        type: 'blob',
        hash: hashFile(absolutePath),
      };
    })
    .sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  return sha256(stable(entries));
}

function buildContext(fixture: ReturnType<typeof prepareCampaign>, targetRoot: string) {
  const manifestPath = path.join(fixture.packageA, 'package-manifest.json');
  const validationHead = git(fixture.root, ['rev-parse', 'HEAD']);
  const validationTree = git(fixture.root, ['rev-parse', 'HEAD^{tree}']);
  const compileReceiptPath = writeJson(fixture.root, 'compile-receipt.json', {
    schemaVersion: 'goal-subcontract-execution-package-compile-receipt/v1',
    packageRoot: fixture.packageA,
    packageId: JSON.parse(fs.readFileSync(manifestPath, 'utf8')).packageId,
    packageManifestHash: fixture.packageManifestHash,
    validationHead,
    validationTree,
    attemptId: 'fixture-attempt',
    compilerExitCode: 0,
  });
  const artifacts = JSON.parse(fs.readFileSync(fixture.artifactsPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const childClosures = artifacts.childResults;
  const collectionEvidence = artifacts.collectionVerificationResults.map((result: any, index: number) => ({
    commandId: result.id,
    commandDefinitionHash: sha256(stable(manifest.collectionVerificationCommands[index])),
    immutablePath: path.join(fixture.root, result.evidence.path),
    documentByteHash: hashFile(path.join(fixture.root, result.evidence.path)),
    schemaVersion: 'evidence/v1',
    status: 'pass',
    sourceAttempt: 'fixture-attempt',
    provenance: 'fresh',
  }));
  const activePointerPath = writeJson(fixture.root, 'active-pointer.json', { active: true });
  const repairAuthorityPath = writeJson(fixture.root, 'repair-authority.json', { attemptId: 'fixture-attempt' });
  const context: Record<string, unknown> = {
    schemaVersion: 'campaign-closeout-context/v1',
    closeoutAttemptId: 'fixture-closeout-attempt-001',
    priorAttemptHash: null,
    sourcePlanHash: `sha256:${'1'.repeat(64)}`,
    package: {
      root: fixture.packageA,
      packageId: manifest.packageId,
      manifestPath,
      manifestSelfHash: fixture.packageManifestHash,
      manifestArtifactHash: hashFile(manifestPath),
    },
    compileReceipt: {
      path: compileReceiptPath,
      documentHash: hashFile(compileReceiptPath),
      commandId: 'compile-execution-package',
      packageId: manifest.packageId,
      manifestHash: fixture.packageManifestHash,
      validationHead,
      validationTree,
      attemptId: 'fixture-attempt',
    },
    campaign: {
      activationHash: `sha256:${'2'.repeat(64)}`,
      activePointerPath,
      activePointerDocumentHash: hashFile(activePointerPath),
    },
    repairAuthority: {
      attemptId: 'fixture-attempt',
      receiptPath: repairAuthorityPath,
      receiptHash: hashFile(repairAuthorityPath),
      artifactHash: hashFile(repairAuthorityPath),
    },
    childClosures,
    childClosureSetHash: sha256(
      stable(
        childClosures.map((child: any) => ({
          partitionId: child.partitionId,
          evidenceHash: child.evidence.hash,
          closureHash: child.closure.hash,
        }))
      )
    ),
    finalValidationEvidence: [],
    finalValidationEvidenceSetHash: sha256(stable([])),
    collectionEvidence,
    collectionVerificationSetHash: sha256(stable(collectionEvidence)),
    validationMaterialization: {
      head: validationHead,
      tree: validationTree,
      algorithm: 'raw-tracked-v1',
      hash: rawTrackedMaterializationHash(fixture.root),
    },
    allowedWritePaths: [targetRoot],
    allowedWritePathSetHash: sha256(stable([targetRoot])),
  };
  context.contextHash = sha256(stable(context));
  return context;
}

function withContextHash(context: Record<string, unknown>) {
  const next = structuredClone(context);
  delete next.contextHash;
  next.contextHash = sha256(stable(next));
  return next;
}

function runCloseout(context: Record<string, unknown>, contextPath: string) {
  writeJson(path.dirname(contextPath), path.basename(contextPath), context);
  return runScript('close-completed-campaign.js', [
    '--context',
    contextPath,
    '--expected-context-hash',
    context.contextHash as string,
    '--json',
  ]);
}

describe('close-completed-campaign producer', () => {
  it('prints help without requiring a provider or running audit', () => {
    const result = runScript('close-completed-campaign.js', ['--help']);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain('--context');
    expect(result.stdout).toContain('--expected-context-hash');
  });

  it('publishes one immutable campaign closure and calls audit exactly once', () => {
    const fixture = prepareCampaign();
    const targetRoot = path.join(fixture.root, 'closeout-attempt-001');
    const context = buildContext(fixture, targetRoot);
    const contextPath = writeJson(fixture.root, 'closeout-context.json', context);
    const result = runScript('close-completed-campaign.js', [
      '--context',
      contextPath,
      '--expected-context-hash',
      context.contextHash as string,
      '--json',
    ]);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ ok: true, status: 'campaign_closed', producerAuditInvocationCount: 1 });
    expect(fs.existsSync(path.join(targetRoot, 'campaign-report.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetRoot, 'task-report-candidate.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetRoot, 'goal-campaign-closure-receipt.json'))).toBe(true);
    const candidate = JSON.parse(fs.readFileSync(path.join(targetRoot, 'task-report-candidate.json'), 'utf8'));
    expect(candidate.schemaVersion).toBe('goal-subcontract-campaign-task-report/v3');
    expect(candidate.status).toBe('done');
  });

  it('accepts dirty tracked bytes when the closeout context freezes their materialization', () => {
    const fixture = prepareCampaign();
    const manifest = JSON.parse(
      fs.readFileSync(path.join(fixture.packageA, 'package-manifest.json'), 'utf8')
    );
    const dirtyOwnedPath = path.join(
      fixture.root,
      manifest.children[0].ownedArtifactPaths[0]
    );
    fs.appendFileSync(dirtyOwnedPath, '\n// controlled closeout materialization\n', 'utf8');
    const targetRoot = path.join(fixture.root, 'closeout-attempt-dirty-materialization');
    const context = buildContext(fixture, targetRoot);
    const result = runCloseout(
      context,
      path.join(fixture.root, 'dirty-materialization-context.json')
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      status: 'campaign_closed',
      producerAuditInvocationCount: 1,
    });
  });

  it('fails closed for context mismatch, path escape, and an existing target', () => {
    const fixture = prepareCampaign();
    const targetRoot = path.join(fixture.root, 'closeout-attempt-001');
    const context = buildContext(fixture, targetRoot);
    const contextPath = writeJson(fixture.root, 'closeout-context.json', context);
    const mismatch = runScript('close-completed-campaign.js', [
      '--context', contextPath,
      '--expected-context-hash', `sha256:${'f'.repeat(64)}`,
      '--json',
    ]);
    expect(mismatch.status).toBe(1);
    expect(mismatch.stdout).toContain('campaign_closeout_context_mismatch');

    const escapedWritePaths = [path.join(fixture.root, '..')];
    const escaped = {
      ...context,
      contextHash: undefined,
      allowedWritePaths: escapedWritePaths,
      allowedWritePathSetHash: sha256(stable(escapedWritePaths)),
    };
    escaped.contextHash = sha256(stable(escaped));
    const escapedPath = writeJson(fixture.root, 'escaped-context.json', escaped);
    const escapeResult = runScript('close-completed-campaign.js', [
      '--context', escapedPath,
      '--expected-context-hash', escaped.contextHash as string,
      '--json',
    ]);
    expect(escapeResult.status).toBe(1);
    expect(escapeResult.stdout).toContain('campaign_closeout_path_escape');

    fs.mkdirSync(targetRoot, { recursive: true });
    const existing = runScript('close-completed-campaign.js', [
      '--context', contextPath,
      '--expected-context-hash', context.contextHash as string,
      '--json',
    ]);
    expect(existing.status).toBe(1);
    expect(existing.stdout).toContain('campaign_closeout_target_exists');
  });

  it('fails closed before audit when compile or evidence bytes drift', () => {
    const compileFixture = prepareCampaign();
    const compileTarget = path.join(compileFixture.root, 'closeout-attempt-compile-drift');
    const compileContext = buildContext(compileFixture, compileTarget);
    const invalidCompile = withContextHash({
      ...compileContext,
      compileReceipt: {
        ...(compileContext.compileReceipt as Record<string, unknown>),
        manifestHash: `sha256:${'9'.repeat(64)}`,
      },
    });
    const compileResult = runCloseout(
      invalidCompile,
      path.join(compileFixture.root, 'compile-drift-context.json')
    );
    expect(compileResult.status).toBe(1);
    expect(compileResult.stdout).toContain('campaign_closeout_compile_binding_mismatch');

    const evidenceFixture = prepareCampaign();
    const evidenceTarget = path.join(evidenceFixture.root, 'closeout-attempt-evidence-drift');
    const evidenceContext = buildContext(evidenceFixture, evidenceTarget);
    const evidencePath = (evidenceContext.collectionEvidence as any[])[0].immutablePath;
    fs.appendFileSync(evidencePath, 'drift', 'utf8');
    const evidenceResult = runCloseout(
      evidenceContext,
      path.join(evidenceFixture.root, 'evidence-drift-context.json')
    );
    expect(evidenceResult.status).toBe(1);
    expect(evidenceResult.stdout).toContain('campaign_closeout_evidence_mismatch');
  });

  it('fails closed when tracked bytes or tracked filesystem types drift', () => {
    const byteFixture = prepareCampaign();
    const byteContext = buildContext(
      byteFixture,
      path.join(byteFixture.root, 'closeout-attempt-byte-drift')
    );
    fs.appendFileSync(path.join(byteFixture.root, 'goal.md'), '\ntracked drift\n', 'utf8');
    const byteResult = runCloseout(
      byteContext,
      path.join(byteFixture.root, 'byte-drift-context.json')
    );
    expect(byteResult.status).toBe(1);
    expect(byteResult.stdout).toContain('campaign_closeout_evidence_mismatch');

    const typeFixture = prepareCampaign();
    const typeContext = buildContext(
      typeFixture,
      path.join(typeFixture.root, 'closeout-attempt-type-drift')
    );
    const trackedPath = path.join(typeFixture.root, 'goal.md');
    fs.rmSync(trackedPath);
    fs.mkdirSync(trackedPath);
    const typeResult = runCloseout(
      typeContext,
      path.join(typeFixture.root, 'type-drift-context.json')
    );
    expect(typeResult.status).toBe(1);
    expect(typeResult.stdout).toContain('campaign_closeout_evidence_mismatch');
  });

  it('rejects evidence reached through a symlink escape', () => {
    const fixture = prepareCampaign();
    const outsideRoot = fs.mkdtempSync(path.join(path.dirname(fixture.root), 'closeout-outside-'));
    try {
      const outsideEvidence = writeJson(outsideRoot, 'evidence.json', { decision: 'pass' });
      const linkPath = path.join(fixture.root, 'escaped-evidence');
      fs.symlinkSync(outsideRoot, linkPath, 'junction');
      const context = buildContext(fixture, path.join(fixture.root, 'closeout-attempt-link'));
      const collectionEvidence = structuredClone(context.collectionEvidence as any[]);
      collectionEvidence[0].immutablePath = path.join(linkPath, 'evidence.json');
      collectionEvidence[0].documentByteHash = hashFile(outsideEvidence);
      const escapedContext = withContextHash({
        ...context,
        collectionEvidence,
        collectionVerificationSetHash: sha256(stable(collectionEvidence)),
      });
      const result = runCloseout(
        escapedContext,
        path.join(fixture.root, 'symlink-escape-context.json')
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('campaign_closeout_path_escape');
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('rejects a gitlink replaced by another filesystem type', () => {
    const fixture = prepareCampaign();
    const submoduleRoot = fs.mkdtempSync(path.join(path.dirname(fixture.root), 'closeout-submodule-'));
    try {
      git(submoduleRoot, ['init', '--quiet']);
      git(submoduleRoot, ['config', 'user.email', 'fixture@example.test']);
      git(submoduleRoot, ['config', 'user.name', 'Fixture']);
      fs.writeFileSync(path.join(submoduleRoot, 'README.md'), '# fixture\n', 'utf8');
      git(submoduleRoot, ['add', '--', 'README.md']);
      git(submoduleRoot, ['commit', '--quiet', '-m', 'test: seed submodule']);
      git(fixture.root, [
        '-c',
        'protocol.file.allow=always',
        'submodule',
        'add',
        '--quiet',
        submoduleRoot,
        'vendor/fixture-submodule',
      ]);
      const context = buildContext(
        fixture,
        path.join(fixture.root, 'closeout-attempt-gitlink-drift')
      );
      const gitlinkPath = path.join(fixture.root, 'vendor', 'fixture-submodule');
      fs.rmSync(gitlinkPath, { recursive: true, force: true });
      fs.writeFileSync(gitlinkPath, 'not a gitlink\n', 'utf8');
      const result = runCloseout(
        context,
        path.join(fixture.root, 'gitlink-drift-context.json')
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('campaign_closeout_evidence_mismatch');
    } finally {
      fs.rmSync(submoduleRoot, { recursive: true, force: true });
    }
  });

  it('preserves the sibling draft when the single deterministic audit fails', () => {
    const fixture = prepareCampaign({ invalidSubject: true });
    const targetRoot = path.join(fixture.root, 'closeout-attempt-audit-failure');
    const context = buildContext(fixture, targetRoot);
    const result = runCloseout(
      context,
      path.join(fixture.root, 'audit-failure-context.json')
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('campaign_closeout_audit_failed');
    expect(fs.existsSync(targetRoot)).toBe(false);
    expect(
      fs
        .readdirSync(fixture.root)
        .some((entry) => entry.startsWith('.closeout-attempt-audit-failure.'))
    ).toBe(true);
  });
});
