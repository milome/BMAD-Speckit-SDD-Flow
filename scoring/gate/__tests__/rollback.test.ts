import { describe, it, expect } from 'vitest';
import { suggestRollback } from '../rollback';

describe('rollback', () => {
  it('有 lastStableCommit → 生成 git reset 命令', () => {
    const r = suggestRollback('implement', 'abc12345');
    expect(r.action).toBe('suggest_rollback');
    expect(r.commands).toContain('git stash');
    expect(r.commands).toContain('git reset --hard abc12345');
  });

  it('无 lastStableCommit → 仅生成 git stash', () => {
    const r = suggestRollback('implement');
    expect(r.commands).toEqual(['git stash']);
  });

  it('message 包含告警前缀 ⚠️', () => {
    const r = suggestRollback('implement', 'abc123');
    expect(r.message).toContain('⚠️');
    expect(r.message).toContain('以下回退命令仅供参考，请确认后手动执行');
  });

  it('action 固定为 suggest_rollback', () => {
    expect(suggestRollback('a').action).toBe('suggest_rollback');
    expect(suggestRollback('b', 'x').action).toBe('suggest_rollback');
  });
});
