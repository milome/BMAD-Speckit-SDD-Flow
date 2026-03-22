/**
 * Optional augmenters applied after base policy + template merge in `resolveRuntimePolicy`.
 * Not exported from npm packages; scripts and Vitest only.
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-returns */
import type { ResolveRuntimePolicyInput, RuntimePolicy } from './runtime-governance';

export type RuntimePolicyAugmenterFn = (
  policy: RuntimePolicy,
  ctx: ResolveRuntimePolicyInput
) => RuntimePolicy;

const augmenters: Array<{ id: string; fn: RuntimePolicyAugmenterFn }> = [];

/**
 * Register an augmenter (append order). Idempotent duplicate ids append another entry (tests should clear).
 */
export function registerRuntimePolicyAugmenter(id: string, fn: RuntimePolicyAugmenterFn): void {
  augmenters.push({ id, fn });
}

export function applyRegisteredAugmenters(
  policy: RuntimePolicy,
  ctx: ResolveRuntimePolicyInput
): RuntimePolicy {
  let p = policy;
  for (const { fn } of augmenters) {
    p = fn(p, ctx);
  }
  return p;
}

/** Vitest isolation */
export function clearAugmentersForTest(): void {
  augmenters.length = 0;
}
