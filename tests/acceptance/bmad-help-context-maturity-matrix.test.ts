import { describe, expect, it } from 'vitest';
import { readBmadHelpRoutingModel } from './helpers/bmad-help-doc-helpers';

describe('bmad-help contextMaturity matrix contract', () => {
  it('defines contextMaturity values, evidence groups, and sourceMode-derived candidates', () => {
    const doc = readBmadHelpRoutingModel();

    expect(doc).toContain('## 4. `contextMaturity` 字段合同');
    expect(doc).toContain('`minimal`');
    expect(doc).toContain('`seeded`');
    expect(doc).toContain('`full`');
    expect(doc).toContain('`unclassified`');

    expect(doc).toContain('artifact 完整度');
    expect(doc).toContain('Four-Signal 完整度');
    expect(doc).toContain('execution specificity');
    expect(doc).toContain('governance health');
    expect(doc).toContain('runtime scope completeness');

    expect(doc).toMatch(/`standalone_story`[\s\S]*?`minimal`/);
    expect(doc).toMatch(/`seeded_solutioning`[\s\S]*?`seeded`/);
    expect(doc).toMatch(/`full_bmad`[\s\S]*?`full`/);
    expect(doc).toContain('证据冲突时，成熟度向下取保守值');
  });
});
