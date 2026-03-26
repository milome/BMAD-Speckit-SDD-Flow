import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { loadManifest } from '../../scripts/i18n/load-manifest';
import { extractOverallGrade } from '../../packages/scoring/parsers/audit-generic';

describe('acceptance: i18n audit pipeline (E15-S2 T6.4)', () => {
  it('has i18n manifests on disk', () => {
    const root = path.join(process.cwd(), '_bmad', 'i18n', 'manifests');
    expect(existsSync(path.join(root, 'speckit.audit.spec.yaml'))).toBe(true);
    expect(existsSync(path.join(root, 'speckit.audit.implement.yaml'))).toBe(true);
  });

  it('loadManifest returns spec manifest', () => {
    const m = loadManifest('speckit.audit.spec');
    expect(m.id).toBe('speckit.audit.spec');
  });

  it('scoring extracts Overall Grade from English report line', () => {
    expect(extractOverallGrade('Summary\n\nOverall Grade: B\n')).toBe('B');
  });
});
