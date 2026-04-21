import { describe, expect, it } from 'vitest';
import { readBmadHelpRoutingModel } from './helpers/bmad-help-doc-helpers';

describe('bmad-help implementationReadinessStatus contract', () => {
  it('freezes statuses, read order, and implementation allow-list', () => {
    const doc = readBmadHelpRoutingModel();

    expect(doc).toContain('## 5. `implementationReadinessStatus` 状态机');

    for (const status of [
      '`missing`',
      '`blocked`',
      '`repair_in_progress`',
      '`ready_clean`',
      '`repair_closed`',
      '`stale_after_semantic_change`',
    ]) {
      expect(doc).toContain(status);
    }

    expect(doc).toContain('最新 readiness report');
    expect(doc).toContain('最新 remediation artifact');
    expect(doc).toContain('execution record / rerun gate 结果');
    expect(doc).toContain('deferred gaps tracking');
    expect(doc).toContain('runtime context / activeScope');

    expect(doc).toContain('只有以下两种状态允许把实施入口作为首推：');
    expect(doc).toContain('- `ready_clean`');
    expect(doc).toContain('- `repair_closed`');
    expect(doc).toContain('其它状态只能输出：');
    expect(doc).toContain('- `blocked`');
    expect(doc).toContain('- 或 `blocked + rerouteRequired=true`');
  });
});
