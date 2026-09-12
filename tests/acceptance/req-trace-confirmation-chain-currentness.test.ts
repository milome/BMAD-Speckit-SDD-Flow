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
      expect(record.lifecycle).toBe('user_confirmed');
      expect(record.confirmationEventRef.artifactBytesHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(record.currentPromotionEvidence.artifactBytesHash).toMatch(/^sha256:[a-f0-9]{64}$/u);

      // Only the isolated canonical authority changes; no human confirmation is produced.
      if (damage === 'reconfirmation_requested') {
        record.lifecycle = 'reconfirmation_required';
        fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      } else {
        const recordRoot = path.dirname(path.dirname(fixture.recordPath));
        const attemptId = record.activeAuthority.activeAuthoringAttemptId;
        const artifactPath = damage === 'sourceDocumentHash'
          ? path.join(recordRoot, 'authoring', 'staging', attemptId, 'cp05', 'final-source.md')
          : path.join(recordRoot, 'authoring', 'staging', attemptId, 'cp05', 'confirmation-projection.json');
        fs.appendFileSync(artifactPath, '\nTEST-ONLY authority drift\n', 'utf8');
      }
      const rejected = runGenerator({ label: `${label}-reject`, entry, outDir, fixture });
      expect.soft(rejected.status, rejected.stdout || rejected.stderr).toBe(3);
      expect.soft(JSON.parse(rejected.stdout).blockingReasons).toContain('CONFIRMED_AUTHORITY_INVALID');
      expect(artifactHashes(outDir)).toEqual(before);
      expect(fs.readFileSync(fixture.sourcePath)).toEqual(sourceBefore);
    }, 120_000);
});
