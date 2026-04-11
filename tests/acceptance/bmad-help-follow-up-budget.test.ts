import { describe, expect, it } from 'vitest';
import { readBmadHelpRoutingModel } from './helpers/bmad-help-doc-helpers';

describe('bmad-help follow-up budget contract', () => {
  it('limits follow-up questions to one or two critical questions and falls back to unclassified', () => {
    const doc = readBmadHelpRoutingModel();

    expect(doc).toContain('## 13. 追问预算规则');
    expect(doc).toContain('最多追问 `1` 到 `2` 个关键问题');
    expect(doc).toContain('超出预算后，若仍缺关键证据，直接进入 `unclassified`');

    expect(doc).toContain('只允许追问会显著影响以下判定的问题：');
    expect(doc).toContain('1. `flow`');
    expect(doc).toContain('2. `contextMaturity`');
    expect(doc).toContain('3. `complexity`');
    expect(doc).toContain('4. `implementationReadinessStatus`');

    expect(doc).toContain('纯好奇型补充');
    expect(doc).toContain('对当前推荐无影响的背景故事');
    expect(doc).toContain('可以从现有文档 / runtime state 直接读取的信息');
  });
});
