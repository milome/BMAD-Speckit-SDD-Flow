import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { materializeAiTddManifestCloseoutRunnerFixture } from '../helpers/requirement-fixture-runtime';
import { artifactHashes, QUARTET, runGenerator } from '../helpers/req-trace-budget-publication';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-only-confirmation-chain-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); });

describe.each(['req_trace_direct', 'main_agent_compile'])('%s confirmation chain currentness', (entry) => {
  it.each(['reconfirmation_requested', 'sourceDocumentHash', 'implementationConfirmationHash'])(
    'blocks %s authority drift without replacing an existing quartet', (damage) => {
      const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'workspace') });
      const outDir = path.join(root, 'out');
      const label = `${entry}-confirmation-chain-${damage}`;
      const baseline = runGenerator({ label: `${label}-baseline`, entry, outDir, fixture });
      expect(baseline.status, baseline.stdout || baseline.stderr).toBe(0);
      const before = artifactHashes(outDir);
      expect(Object.keys(before).sort()).toEqual([...QUARTET].sort());
      const sourceBefore = fs.readFileSync(fixture.sourcePath);
      const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
      expect(record.confirmationHistory.at(-1).eventType).toBe('confirmation_recorded');
      expect(record.sourceDocumentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(record.implementationConfirmationHash).toMatch(/^sha256:[a-f0-9]{64}$/u);

      // Only the isolated synthetic test record changes; no human confirmation is produced.
      if (damage === 'reconfirmation_requested') {
        record.confirmationHistory.push({ eventType: 'reconfirmation_requested', recordId: record.recordId,
          requirementSetId: record.requirementSetId, requestedAt: '2026-05-26T17:22:58.718Z',
          requestedBy: 'test-only-fixture', reason: 'Test-only confirmation authority invalidation' });
      } else {
        delete record[damage];
      }
      fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      const rejected = runGenerator({ label: `${label}-reject`, entry, outDir, fixture });
      expect.soft(rejected.status, rejected.stdout || rejected.stderr).toBe(3);
      expect.soft(JSON.parse(rejected.stdout).blockingReasons).toContain(damage === 'reconfirmation_requested'
        ? 'CONFIRMATION_RECORD_REQUIRED' : 'CONFIRMATION_RECORD_HASH_MISMATCH');
      expect(artifactHashes(outDir)).toEqual(before);
      expect(fs.readFileSync(fixture.sourcePath)).toEqual(sourceBefore);
    });
});
