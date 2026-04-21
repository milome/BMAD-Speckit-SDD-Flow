import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
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
  it('current repo mirrors are byte-equivalent to canonical after stripping generated header', () => {
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

  it('syncPartyModeMirrors repairs drift inside a temporary workspace', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-mirror-'));
    try {
      fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
      const drifted = path.join(tempRoot, '_bmad', 'skills', 'bmad-party-mode', 'workflow.en.md');
      fs.writeFileSync(drifted, 'drifted\n', 'utf8');

      syncPartyModeMirrors(tempRoot);

      const canonical = fs.readFileSync(
        path.join(tempRoot, '_bmad', 'core', 'skills', 'bmad-party-mode', 'workflow.en.md'),
        'utf8'
      );
      const repaired = stripGeneratedHeader(fs.readFileSync(drifted, 'utf8'));
      expect(repaired).toBe(canonical);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
