/**
 * §A.8 T10：augmenter 注册顺序、后者可读前者输出、clear 后无残留。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import {
  registerRuntimePolicyAugmenter,
  clearAugmentersForTest,
} from '../../scripts/runtime-governance-registry';
import { resetTriggerConfigCache } from '../../packages/scoring/trigger/trigger-loader';

describe('runtime-governance registry (T10)', () => {
  beforeEach(() => {
    clearAugmentersForTest();
    resetTriggerConfigCache();
  });

  const config = loadConfig();

  it('按注册顺序应用 augmenter；后者可读取前者写入的 reason', () => {
    registerRuntimePolicyAugmenter('a', (p) => ({
      ...p,
      reason: `${p.reason} [aug-a]`,
    }));
    registerRuntimePolicyAugmenter('b', (p) => ({
      ...p,
      reason: `${p.reason} [aug-b]`,
    }));
    const p = resolveRuntimePolicy({ flow: 'story', stage: 'plan', config });
    expect(p.reason).toContain('[aug-a]');
    expect(p.reason).toContain('[aug-b]');
    expect(p.reason.indexOf('[aug-a]')).toBeLessThan(p.reason.indexOf('[aug-b]'));
  });

  it('clearAugmentersForTest 后无 augmenter 残留', () => {
    registerRuntimePolicyAugmenter('x', (p) => ({ ...p, auditRequired: false }));
    clearAugmentersForTest();
    const p = resolveRuntimePolicy({ flow: 'story', stage: 'plan', config });
    expect(p.auditRequired).toBe(true);
  });
});
