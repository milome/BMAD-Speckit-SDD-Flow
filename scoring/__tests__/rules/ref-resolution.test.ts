/**
 * Story 2.1: ref 解析单元测试 AC-6
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { resolveRef } from '../../parsers/rules';
import { RefResolutionError } from '../../parsers/types';

const configPath = path.resolve(process.cwd(), 'config', 'code-reviewer-config.yaml');

describe('resolveRef', () => {
  it('AC-6: ref 指向的 item_id 存在时返回 ResolvedItem', () => {
    const r = resolveRef('code-reviewer-config#functional_correctness', configPath);
    expect(r.item_id).toBe('functional_correctness');
    expect(r.name).toBeDefined();
  });

  it('AC-6: veto_* ref 可解析', () => {
    const r = resolveRef('code-reviewer-config#veto_core_logic', configPath);
    expect(r.item_id).toBe('veto_core_logic');
  });

  it('AC-6: item_id 不存在时抛出 RefResolutionError', () => {
    expect(() => resolveRef('code-reviewer-config#nonexistent_item', configPath)).toThrow(
      RefResolutionError
    );
    try {
      resolveRef('code-reviewer-config#nonexistent_item', configPath);
    } catch (e) {
      expect(e).toBeInstanceOf(RefResolutionError);
      expect((e as RefResolutionError).ref).toBe('code-reviewer-config#nonexistent_item');
      expect((e as RefResolutionError).itemId).toBe('nonexistent_item');
    }
  });

  it('非法 ref 格式抛出 RefResolutionError', () => {
    expect(() => resolveRef('invalid-ref', configPath)).toThrow(RefResolutionError);
  });
});
