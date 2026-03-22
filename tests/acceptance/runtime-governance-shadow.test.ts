/**
 * U-1.5 Shadow 可观测性（**策略 B**：仅测试层组装 legacy ↔ governance；生产 `bmad-config` 不静态 import `runtime-governance`，见 U-1.5c）。
 *
 * `BMAD_RUNTIME_SHADOW=1` 时经 `console.debug('[bmad-runtime-shadow]', …)` 输出单行 JSON。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadConfig,
  shouldAudit,
  shouldValidate,
  getStrictness,
  shouldGenerateDoc,
  type StageName,
} from '../../scripts/bmad-config';
import { resolveRuntimePolicy, type RuntimeFlowId } from '../../scripts/runtime-governance';

type LegacySlice = {
  auditRequired: boolean;
  validationLevel: ReturnType<typeof shouldValidate>;
  strictness: ReturnType<typeof getStrictness>;
  generateDoc: boolean;
};

function buildLegacySlice(stage: StageName, config: ReturnType<typeof loadConfig>): LegacySlice {
  return {
    auditRequired: shouldAudit(stage, config),
    validationLevel: shouldValidate(stage, config),
    strictness: getStrictness(stage, config),
    generateDoc: shouldGenerateDoc(stage, config),
  };
}

function shadowDiff(
  flow: RuntimeFlowId,
  stage: StageName,
  config: ReturnType<typeof loadConfig>,
  governanceOverride?: ReturnType<typeof resolveRuntimePolicy>
): { legacy: LegacySlice; governance: ReturnType<typeof resolveRuntimePolicy>; diff: boolean } {
  const legacy = buildLegacySlice(stage, config);
  const governance = governanceOverride ?? resolveRuntimePolicy({ flow, stage, config });
  const diff =
    legacy.auditRequired !== governance.auditRequired ||
    legacy.validationLevel !== governance.validationLevel ||
    legacy.strictness !== governance.strictness ||
    legacy.generateDoc !== governance.generateDoc;

  if (process.env.BMAD_RUNTIME_SHADOW === '1') {
    console.debug(
      '[bmad-runtime-shadow]',
      JSON.stringify({ flow, stage, legacy, governance, diff })
    );
  }

  return { legacy, governance, diff };
}

describe('runtime-governance shadow (U-1.5)', () => {
  const prevShadow = process.env.BMAD_RUNTIME_SHADOW;

  afterEach(() => {
    if (prevShadow === undefined) {
      delete process.env.BMAD_RUNTIME_SHADOW;
    } else {
      process.env.BMAD_RUNTIME_SHADOW = prevShadow;
    }
    vi.restoreAllMocks();
  });

  it('BMAD_RUNTIME_SHADOW=1 时 resolveRuntimePolicy 的 compatibilitySource 为 shadow', () => {
    process.env.BMAD_RUNTIME_SHADOW = '1';
    const config = loadConfig();
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'plan', config });
    expect(policy.compatibilitySource).toBe('shadow');
  });

  it('BMAD_RUNTIME_SHADOW=1 时输出 console.debug 且 payload 含 flow/stage/legacy/governance/diff', () => {
    process.env.BMAD_RUNTIME_SHADOW = '1';
    const dbg = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const config = loadConfig();
    shadowDiff('story', 'specify', config);

    expect(dbg).toHaveBeenCalled();
    const raw = dbg.mock.calls[0]?.[1] as string;
    expect(raw).toBeDefined();
    const payload = JSON.parse(raw) as {
      flow: string;
      stage: string;
      legacy: LegacySlice;
      governance: Record<string, unknown>;
      diff: boolean;
    };
    expect(payload.flow).toBe('story');
    expect(payload.stage).toBe('specify');
    expect(payload.legacy).toBeDefined();
    expect(payload.governance).toBeDefined();
    expect(typeof payload.diff).toBe('boolean');
  });

  it('无篡改时 diff 为 false（与 governance legacy 对齐字段一致）', () => {
    process.env.BMAD_RUNTIME_SHADOW = '1';
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const config = loadConfig();
    const { diff } = shadowDiff('bugfix', 'plan', config);
    expect(diff).toBe(false);
  });

  it('intentional：mock resolveRuntimePolicy 返回篡改 auditRequired 时 diff 为 true 且仍输出 debug', () => {
    process.env.BMAD_RUNTIME_SHADOW = '1';
    const dbg = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const config = loadConfig();
    const canonical = resolveRuntimePolicy({ flow: 'standalone_tasks', stage: 'tasks', config });
    const tampered = { ...canonical, auditRequired: !canonical.auditRequired };
    const { diff } = shadowDiff('standalone_tasks', 'tasks', config, tampered);
    expect(diff).toBe(true);
    expect(dbg).toHaveBeenCalled();
    const payload = JSON.parse(dbg.mock.calls[0]?.[1] as string) as { diff: boolean };
    expect(payload.diff).toBe(true);
  });
});
