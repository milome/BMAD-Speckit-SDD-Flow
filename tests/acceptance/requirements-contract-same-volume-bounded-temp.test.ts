import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSameVolumeBoundedTempDirectory } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-same-volume-bounded-temp';

describe('requirements-contract same-volume bounded temporary directories', () => {
  it.skipIf(process.platform !== 'win32')(
    'allocates a same-volume temporary root whose projected descendants remain below the legacy path limit',
    () => {
      const baseRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-bounded-temp-'));
      const deepAnchor = path.join(
        baseRoot,
        ...Array.from({ length: 8 }, () => `segment-${randomUUID()}`)
      );
      const projectedRelativePaths = [
        'semantic-ir.json',
        path.join('resolution', 'semantic', 'interaction-resolution-receipt.json'),
        path.join('proofs', 'semantic-conservation-manifest.json'),
      ];

      try {
        expect(
          Math.max(
            ...projectedRelativePaths.map(
              (relativePath) =>
                path.join(deepAnchor, '.s', 'roundtrip-XXXXXX', relativePath).length
            )
          )
        ).toBeGreaterThanOrEqual(260);

        const temporaryRoot = createSameVolumeBoundedTempDirectory({
          anchorDirectory: deepAnchor,
          prefix: 'roundtrip-',
          projectedRelativePaths,
        });

        expect(path.parse(temporaryRoot).root.toLowerCase()).toBe(
          path.parse(deepAnchor).root.toLowerCase()
        );
        expect(
          Math.max(
            temporaryRoot.length,
            ...projectedRelativePaths.map(
              (relativePath) => path.join(temporaryRoot, relativePath).length
            )
          )
        ).toBeLessThan(260);
      } finally {
        rmSync(baseRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      }
    }
  );
});
