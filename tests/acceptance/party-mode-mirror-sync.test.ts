import { beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  RELATIVE_FILES,
  stripGeneratedHeader,
  syncPartyModeMirrors,
} from '../../scripts/i18n/sync-party-mode-mirrors';

const ROOT = process.cwd();
const CANONICAL_ROOT = path.join(ROOT, '_bmad', 'core', 'skills', 'bmad-party-mode');
const COMPATIBILITY_ROOT = path.join(ROOT, '_bmad', 'skills', 'bmad-party-mode');
const LEGACY_ROOT = path.join(ROOT, '_bmad', 'core', 'workflows', 'party-mode');

describe('party-mode mirror sync', () => {
  beforeAll(() => {
    syncPartyModeMirrors();
  });

  it('keeps compatibility copy and legacy mirror byte-equivalent to canonical after stripping generated header', () => {
    for (const relativeFile of RELATIVE_FILES) {
      const canonical = fs.readFileSync(path.join(CANONICAL_ROOT, relativeFile), 'utf8');
      const compatibility = stripGeneratedHeader(
        fs.readFileSync(path.join(COMPATIBILITY_ROOT, relativeFile), 'utf8')
      );
      const legacy = stripGeneratedHeader(
        fs.readFileSync(path.join(LEGACY_ROOT, relativeFile), 'utf8')
      );

      expect(compatibility).toBe(canonical);
      expect(legacy).toBe(canonical);
    }
  });
});
