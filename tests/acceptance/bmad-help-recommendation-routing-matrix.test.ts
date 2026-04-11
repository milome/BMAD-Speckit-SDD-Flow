import { describe, expect, it } from 'vitest';
import { readBmadHelpRoutingModel } from './helpers/bmad-help-doc-helpers';

describe('bmad-help recommendation routing matrix', () => {
  it('freezes state-aware order, precedence, unified gate naming, and worked examples', () => {
    const doc = readBmadHelpRoutingModel();

    expect(doc).toContain('## 9. 判定顺序合同');
    expect(doc).toContain('1. `flow`');
    expect(doc).toContain('2. `sourceMode`（内部来源语义）');
    expect(doc).toContain('3. `derive contextMaturity`');
    expect(doc).toContain('4. `follow-up`（最多 1 到 2 个关键问题）');
    expect(doc).toContain('5. `complexity`');
    expect(doc).toContain('6. `implementationReadinessStatus`');
    expect(doc).toContain('7. `recommendation`');

    expect(doc).toContain('## 10. 旧路由与新路由的 precedence');
    expect(doc).toContain('旧 `phase` / `sequence` / catalog 路由');
    expect(doc).toContain('它不能推翻 state-aware recommendation');

    expect(doc).toMatch(/`bugfix`[\s\S]*?`implementation-readiness`/);
    expect(doc).toMatch(/`standalone_tasks`[\s\S]*?`implementation-readiness`/);

    expect(doc).toContain('### 16.1 Story / minimal / blocked');
    expect(doc).toContain('### 16.2 Bugfix / seeded / blocked');
    expect(doc).toContain('### 16.3 Standalone Tasks / full / high / blocked');
    expect(doc).toContain('### 16.4 Story / full / ready_clean');
  });
});
