import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBmadHelpFiveLayerMatrix } from '../../scripts/main-agent-bmad-help-five-layer-matrix';

describe('bmad-help five-layer main-agent matrix', () => {
  it('proves the bmad-help first-screen route can drive every canonical layer through the main-agent control plane', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-five-layer-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });

      const report = runBmadHelpFiveLayerMatrix({ projectRoot: root });

      expect(report.allPassed).toBe(true);
      expect(report.bmadHelpEntry.catalogLoaded).toBe(true);
      expect(report.bmadHelpEntry.canonicalHelpWorkflow).toBe(true);
      expect(report.layers.map((layer) => layer.id)).toEqual([
        'layer_1',
        'layer_2',
        'layer_3',
        'layer_4',
        'layer_5',
      ]);
      expect(report.layers.every((layer) => layer.passed)).toBe(true);
      expect(report.steps.length).toBeGreaterThanOrEqual(10);
      expect(report.steps.every((step) => step.passed)).toBe(true);
      expect(report.steps.every((step) => step.orchestration.pendingPacketStatus === 'completed')).toBe(
        true
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
