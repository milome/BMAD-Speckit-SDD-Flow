import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDevelopmentJourneyMatrix } from '../../scripts/main-agent-development-journey-matrix';

describe('main-agent development journey matrix e2e', () => {
  it('covers hooks no-hooks codex ingress and delivery truth sequence checkpoints', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'development-journey-matrix-'));
    try {
      const report = runDevelopmentJourneyMatrix({
        projectRoot: root,
        realProvider: false,
      });

      expect(report.allPassed).toBe(true);
      expect(report.steps.map((step) => step.sequence)).toEqual([
        'S3c-S3e',
        'S3c-S3e',
        'S3c-S3e',
        'S31-S32',
        'S37-S38',
        'R1-R10/S39-S43',
      ]);
      expect(report.steps.find((step) => step.id === 'ingress-codex')?.evidence).toContain(
        'no_hooks/cli_ingress'
      );
      expect(report.steps.find((step) => step.id === 'delivery-truth-contract')?.passed).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
