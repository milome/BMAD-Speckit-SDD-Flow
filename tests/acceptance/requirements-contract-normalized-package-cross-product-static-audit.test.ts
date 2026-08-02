import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDERER_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer.ts'
);

describe('Normalized Contract Package cross-product static audit', () => {
  it('rejects semantic-body by complete-edge-universe scans in the production renderer', () => {
    const source = readFileSync(RENDERER_PATH, 'utf8');
    const findings = [
      {
        code: 'semantic_body_edge_universe_scan',
        matched:
          /Object\.values\(input\.semanticBodies\)\.filter\([\s\S]{0,240}edgeJson\.includes/u.test(
            source
          ),
      },
      {
        code: 'legacy_current_target_map_projection',
        matched: /\bcurrentTargetMap\b/u.test(source),
      },
      {
        code: 'cartesian_product_builder',
        matched: /\b(?:cartesianProduct|crossProduct)\s*\(/u.test(source),
      },
    ].filter((finding) => finding.matched);

    expect(findings).toEqual([]);
  });
});
