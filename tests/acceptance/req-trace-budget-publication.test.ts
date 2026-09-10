import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { materializeAiTddManifestCloseoutRunnerFixture } from '../helpers/requirement-fixture-runtime';
import {
  artifactHashes,
  growSyntheticConfirmation,
  hash,
  QUARTET,
  REAL_SOURCE,
  runGenerator,
  generatorTimeoutMs,
} from '../helpers/req-trace-budget-publication';

let root: string;
vi.setConfig({ testTimeout: 120_000, hookTimeout: 30_000 });
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-budget-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
});

function expectPublished(outDir: string, stdout: string): void {
  const hashes = artifactHashes(outDir);
  const audit = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));
  expect(audit.decision).toBe('pass');
  expect(audit.outputHashes.modelPacketHash).toBe(hashes['model_packet.json']);
  expect(audit.outputHashes.humanPromptHash).toBe(hashes['human_prompt.txt']);
  expect(audit.outputHashes.goalDocumentHash).toBe(hashes['goal_execution.md']);
  const summary = JSON.parse(stdout);
  expect(summary.outputHashes.auditReceiptHash).toBe(hashes['audit_receipt.json']);
  expect(summary.payloadBudgets).toHaveLength(4);
  for (const metric of summary.payloadBudgets) {
    expect(metric.bytes).toBe(fs.statSync(path.join(outDir, metric.artifact)).size);
    expect(metric.hash).toBe(hashes[metric.artifact]);
    expect(metric.limit).toBeNull();
    expect(metric.unit).toBe('utf8_bytes');
  }
}

function pendingJournal(outDir: string): string {
  return JSON.parse(fs.readFileSync(path.join(outDir, '.compiler-publication.lock'), 'utf8')).journalPath;
}

describe.each(['req_trace_direct', 'main_agent_compile'])('%s publication budget', (entry) => {
  it('derives a bounded generator timeout from source size instead of a fixed short timeout', () => {
    expect(generatorTimeoutMs(0)).toBe(120_000);
    expect(generatorTimeoutMs(1024 * 1024)).toBe(120_000);
    expect(generatorTimeoutMs(1024 * 1024 + 1)).toBe(240_000);
    expect(generatorTimeoutMs(2.5 * 1024 * 1024)).toBe(360_000);
  });

  it.each(['journal:prepared', 'goal_execution.md', 'human_prompt.txt', 'model_packet.json',
    'audit_receipt.json', 'journal:completed'])(
    'recovers a real process exit at %s before retrying', (crashPoint) => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    const label = `${entry}-${crashPoint.replace(':', '-')}`;
    expect(runGenerator({ label: `${label}-crash-baseline`, entry, outDir, fixture }).status).toBe(0);
    growSyntheticConfirmation(fixture, 80);
    const crashed = runGenerator({ label: `${label}-crash-exit`, entry, outDir, fixture, crashPoint });
    expect(crashed.status).toBe(86);
    expect(crashed.stdout).toContain('"processExit":86');
    expect(fs.existsSync(path.join(outDir, '.compiler-publication.lock'))).toBe(true);
    const journalPath = pendingJournal(outDir);
    const committed = ['audit_receipt.json', 'journal:completed'].includes(crashPoint);
    const retry = runGenerator({ label: `${label}-crash-retry`, entry, outDir, fixture });
    expect(retry.status, retry.stdout).toBe(0);
    expect(fs.existsSync(path.join(outDir, '.compiler-publication.lock'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(journalPath, 'utf8')).state).toBe(committed ? 'completed' : 'rolled_back');
    expectPublished(outDir, retry.stdout);
  });

  it('recovers a second process exit during rollback', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    expect(runGenerator({ label: `${entry}-repeated-baseline`, entry, outDir, fixture }).status).toBe(0);
    growSyntheticConfirmation(fixture, 80);
    expect(runGenerator({ label: `${entry}-repeated-first-exit`, entry, outDir, fixture,
      crashPoint: 'model_packet.json' }).status).toBe(86);
    const journalPath = pendingJournal(outDir);
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const changed = journal.artifacts.find(
      (item: { name: string; previousHash: string | null; nextHash: string }) =>
        item.previousHash !== null && item.previousHash !== item.nextHash
    );
    expect(changed).toBeDefined();
    expect(runGenerator({ label: `${entry}-repeated-recovery-exit`, entry, outDir, fixture,
      crashPoint: changed.name }).status).toBe(86);
    expect(fs.existsSync(journalPath)).toBe(true);
    const recoveredJournalPath = pendingJournal(outDir);
    expect(recoveredJournalPath).not.toBe(journalPath);
    const publicationJournals = fs
      .readdirSync(outDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('.compiler-publication-'));
    expect(publicationJournals.length).toBeGreaterThanOrEqual(2);
    const retry = runGenerator({ label: `${entry}-repeated-recovered`, entry, outDir, fixture });
    expect(retry.status, retry.stdout).toBe(0);
    expect(fs.readdirSync(path.dirname(journalPath)).some((name) => name.startsWith('.recovery-'))).toBe(false);
    expectPublished(outDir, retry.stdout);
  });

  it('recovers a fresh quartet without inventing previous artifacts', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    expect(runGenerator({ label: `${entry}-fresh-partial-exit`, entry, outDir, fixture,
      crashPoint: 'human_prompt.txt' }).status).toBe(86);
    const journalPath = pendingJournal(outDir);
    const retry = runGenerator({ label: `${entry}-fresh-partial-recovered`, entry, outDir, fixture });
    expect(retry.status, retry.stdout).toBe(0);
    const recovered = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    expect(recovered.state).toBe('rolled_back');
    expect(recovered.artifacts.every((item: { previousHash: string | null }) => item.previousHash === null)).toBe(true);
    expectPublished(outDir, retry.stdout);
  });

  it('does not publish a canonical rejection into a fresh damaged transaction', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    const crashed = runGenerator({ label: `${entry}-fresh-journal-exit`, entry, outDir, fixture,
      crashPoint: 'journal:prepared' });
    expect(crashed.status).toBe(86);
    const transaction = fs.readdirSync(outDir).find((name) => name.startsWith('.compiler-publication-'))!;
    fs.unlinkSync(path.join(outDir, transaction, 'journal.json'));
    const retry = runGenerator({ label: `${entry}-fresh-journal-damaged`, entry, outDir, fixture });
    expect(retry.status).toBe(3);
    expect(retry.stdout).toContain('REQ_TRACE_PUBLICATION_RECOVERY_REQUIRED');
    expect(fs.existsSync(path.join(outDir, '.compiler-publication.lock'))).toBe(true);
    for (const name of QUARTET) expect(fs.existsSync(path.join(outDir, name))).toBe(false);
  });

  it.each(['backup', 'journal-json', 'missing-intent', 'unknown-write'] as const)(
    'preserves the interrupted artifact bytes across repeated %s recovery rejection', (damage) => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    const label = `${entry}-damaged-${damage}`;
    expect(runGenerator({ label: `${label}-baseline`, entry, outDir, fixture }).status).toBe(0);
    growSyntheticConfirmation(fixture, 80);
    expect(runGenerator({ label: `${label}-exit`, entry, outDir, fixture,
      crashPoint: 'human_prompt.txt' }).status).toBe(86);
    const journalPath = pendingJournal(outDir);
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    if (damage === 'backup') fs.appendFileSync(journal.artifacts[0].backupPath, 'TEST-ONLY-CORRUPTION');
    if (damage === 'journal-json') fs.writeFileSync(journalPath, '{broken', 'utf8');
    if (damage === 'missing-intent') {
      journal.artifacts = journal.artifacts.filter((item: { name: string }) => item.name !== 'goal_execution.md');
      fs.writeFileSync(journalPath, JSON.stringify(journal), 'utf8');
    }
    if (damage === 'unknown-write') fs.appendFileSync(path.join(outDir, 'model_packet.json'), '\nTEST-ONLY-FOREIGN-WRITE');
    const before = artifactHashes(outDir);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const rejected = runGenerator({ label: `${label}-retry-${attempt}`, entry, outDir, fixture });
      expect(rejected.status, rejected.stdout).toBe(3);
      expect(rejected.stdout).toContain('REQ_TRACE_PUBLICATION_RECOVERY_REQUIRED');
      expect(artifactHashes(outDir)).toEqual(before);
      expect(fs.existsSync(path.join(outDir, '.compiler-publication.lock'))).toBe(true);
    }
  });

  it('does not overwrite a newer complete quartet during stale recovery', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    const newerDir = path.join(root, 'newer');
    expect(runGenerator({ label: `${entry}-newer-baseline`, entry, outDir, fixture }).status).toBe(0);
    growSyntheticConfirmation(fixture, 80);
    expect(runGenerator({ label: `${entry}-newer-exit`, entry, outDir, fixture,
      crashPoint: 'human_prompt.txt' }).status).toBe(86);
    growSyntheticConfirmation(fixture, 160);
    expect(runGenerator({ label: `${entry}-newer-independent`, entry, outDir: newerDir, fixture }).status).toBe(0);
    // This simulates an external writer that bypasses the cooperative publication lock.
    for (const name of QUARTET) fs.copyFileSync(path.join(newerDir, name), path.join(outDir, name));
    const newer = artifactHashes(outDir);
    const retry = runGenerator({ label: `${entry}-newer-rejected`, entry, outDir, fixture });
    expect(retry.status).toBe(3);
    expect(retry.stdout).toContain('REQ_TRACE_PUBLICATION_RECOVERY_REQUIRED');
    expect(artifactHashes(outDir)).toEqual(newer);
  });

  it('excludes a real second process while the publication owner is alive', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    expect(runGenerator({ label: `${entry}-contended-baseline`, entry, outDir, fixture }).status).toBe(0);
    growSyntheticConfirmation(fixture, 80);
    const owner = runGenerator({ label: `${entry}-contended-exit`, entry, outDir, fixture,
      crashPoint: 'human_prompt.txt', contender: true });
    expect(owner.status).toBe(86);
    const contender = JSON.parse(owner.stdout.split('\n').find((line) => line.includes('contenderStatus'))!);
    expect(contender.contenderStatus).toBe(3);
    expect(contender.contenderStdout).toContain('REQ_TRACE_PUBLICATION_RECOVERY_REQUIRED');
    const retry = runGenerator({ label: `${entry}-contended-recovered`, entry, outDir, fixture });
    expect(retry.status, retry.stdout).toBe(0);
    expectPublished(outDir, retry.stdout);
  });

  it.each(['human_prompt.txt', 'model_packet.json', 'audit_receipt.json'])(
    'rolls back the entire prior quartet if publishing %s fails', (failedName) => {
      const fixture = materializeAiTddManifestCloseoutRunnerFixture({
        root: path.join(root, 'test-only-workspace'),
      });
      const outDir = path.join(root, 'out');
      expect(runGenerator({ label: `${entry}-io-${failedName}-baseline`, entry, outDir, fixture }).status)
        .toBe(0);
      const before = artifactHashes(outDir);
      growSyntheticConfirmation(fixture, 80);
      if (failedName === 'audit_receipt.json') {
        expect(runGenerator({ label: `${entry}-io-audit-recovery-exit`, entry, outDir, fixture,
          crashPoint: 'model_packet.json' }).status).toBe(86);
      }
      const preload = path.join(root, 'test-only-write-failure.cjs');
      fs.writeFileSync(preload, [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        'const rename = fs.renameSync;',
        'let failed = false;',
        'fs.renameSync = function(from, to, ...rest) {',
        `  if (!failed && path.resolve(to) === ${JSON.stringify(path.join(outDir, failedName))}) {`,
        '    failed = true;',
        "    throw Object.assign(new Error('TEST_ONLY_RENAME_FAILURE'), { code: 'EIO' });",
        '  }',
        '  return rename.call(this, from, to, ...rest);',
        '};',
      ].join('\n'), 'utf8');
      const result = runGenerator({ label: `${entry}-io-${failedName}-rejected`,
        entry, outDir, fixture, preload });
      expect.soft(result.status).toBe(3);
      expect.soft(result.stdout).toMatch(/PUBLICATION_FAILED/u);
      expect(artifactHashes(outDir)).toEqual(before);
      const retried = runGenerator({ label: `${entry}-io-${failedName}-retry`, entry, outDir, fixture });
      expect(retried.status).toBe(0);
      expect(artifactHashes(outDir)).not.toEqual(before);
      const audit = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));
      expect(audit.decision).toBe('pass');
      expect(audit.outputHashes.modelPacketHash).toBe(artifactHashes(outDir)['model_packet.json']);
      expect(audit.outputHashes.goalDocumentHash).toBe(artifactHashes(outDir)['goal_execution.md']);
      for (const metric of JSON.parse(retried.stdout).payloadBudgets) {
        const bytes = fs.readFileSync(path.join(outDir, metric.artifact));
        expect(metric.bytes).toBe(bytes.length);
        expect(metric.hash).toBe(hash(bytes));
        expect(metric.limit).toBeNull();
        expect(metric.unit).toBe('utf8_bytes');
      }
      expect(audit.sourceMeasurement.bytes).toBe(fs.statSync(fixture.sourcePath).size);
    }
  );

  it('removes all new execution artifacts when a fresh publication fails', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-workspace') });
    const outDir = path.join(root, 'out');
    const preload = path.join(root, 'test-only-fresh-failure.cjs');
    fs.writeFileSync(preload, [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      'const rename = fs.renameSync;',
      'let failed = false;',
      'fs.renameSync = function(from, to, ...rest) {',
      `  if (!failed && path.resolve(to) === ${JSON.stringify(path.join(outDir, 'audit_receipt.json'))}) {`,
      '    failed = true;',
      "    throw Object.assign(new Error('TEST_ONLY_RENAME_FAILURE'), { code: 'EIO' });",
      '  }',
      '  return rename.call(this, from, to, ...rest);',
      '};',
    ].join('\n'), 'utf8');
    const result = runGenerator({ label: `${entry}-fresh-io-rejected`, entry, outDir, fixture, preload });
    expect(result.status).toBe(3);
    expect(result.stdout).toMatch(/PUBLICATION_FAILED/u);
    for (const name of QUARTET.filter((item) => item !== 'audit_receipt.json'))
      expect(fs.existsSync(path.join(outDir, name))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8')).decision).toBe('blocked');
  });

  it('blocks the complete frozen real source without inventing inline confirmation', () => {
    expect(hash(fs.readFileSync(REAL_SOURCE))).toBe(
      'sha256:06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a'
    );
    const outDir = path.join(root, 'out');
    const result = runGenerator({
      label: `${entry}-real-unconfirmed`,
      entry,
      outDir,
      sourcePath: REAL_SOURCE,
    });
    expect(result.status).toBe(3);
    expect(result.stdout).toMatch(/SOURCE_DOCUMENT_REQUIRED|implementationConfirmation/u);
    for (const name of QUARTET.filter((item) => item !== 'audit_receipt.json')) {
      expect(fs.existsSync(path.join(outDir, name))).toBe(false);
    }
    const auditPath = path.join(outDir, 'audit_receipt.json');
    if (fs.existsSync(auditPath))
      expect(JSON.parse(fs.readFileSync(auditPath, 'utf8')).decision).toBe('blocked');
  });

  it('allows oversized sparse derived artifacts when no provider capacity is declared', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({
      root: path.join(root, 'test-only-workspace'),
    });
    growSyntheticConfirmation(fixture);
    expect(fs.statSync(fixture.sourcePath).size).toBeLessThan(1024 * 1024);
    const outDir = path.join(root, 'out');
    const result = runGenerator({ label: `${entry}-fresh-budget`, entry, outDir, fixture });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expectPublished(outDir, result.stdout);
    const summary = JSON.parse(result.stdout);
    expect(summary.payloadBudgets.every((metric: { limit: number | null }) => metric.limit === null)).toBe(true);
  });

  it.each(['illegal-entry', 'confirmation-drift'] as const)(
    'preserves every byte of the previous passing quartet after %s rejection',
    (failureMode) => {
      const fixture = materializeAiTddManifestCloseoutRunnerFixture({
        root: path.join(root, 'test-only-workspace'),
      });
      const outDir = path.join(root, 'out');
      const first = runGenerator({
        label: `${entry}-${failureMode}-baseline`,
        entry,
        outDir,
        fixture,
      });
      expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
      const before = artifactHashes(outDir);
      expect(
        JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8')).decision
      ).toBe('pass');
      if (failureMode === 'confirmation-drift')
        fs.appendFileSync(fixture.sourcePath, '\nTest-only unconfirmed semantic drift.\n', 'utf8');
      const result = runGenerator({
        label: `${entry}-${failureMode}-rejected`,
        entry: failureMode === 'illegal-entry' ? 'invalid-test-only-entry' : entry,
        outDir,
        fixture,
      });
      expect.soft(result.status).toBe(3);
      if (failureMode === 'illegal-entry')
        expect.soft(result.stdout).toContain('ENTRY_ROUTE_MISMATCH');
      if (failureMode === 'confirmation-drift')
        expect.soft(result.stdout).toMatch(/HASH_MISMATCH|RECONFIRM|DRIFT|STALE/iu);
      expect(artifactHashes(outDir)).toEqual(before);
    }
  );
});
