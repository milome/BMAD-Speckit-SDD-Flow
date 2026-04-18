import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureFacilitatorRuntimeDefinition } from '../../scripts/facilitator-runtime-definition';

const ROOT = process.cwd();
const TEMP_ROOTS: string[] = [];

function seed(root: string): void {
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  fs.mkdirSync(path.join(root, '.cursor', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude', 'agents'), { recursive: true });
  fs.copyFileSync(
    path.join(root, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
    path.join(root, '.cursor', 'agents', 'party-mode-facilitator.md')
  );
  fs.copyFileSync(
    path.join(root, '_bmad', 'claude', 'agents', 'party-mode-facilitator.md'),
    path.join(root, '.claude', 'agents', 'party-mode-facilitator.md')
  );
}

describe('facilitator runtime gate contract', () => {
  afterEach(() => {
    while (TEMP_ROOTS.length > 0) {
      fs.rmSync(TEMP_ROOTS.pop()!, { recursive: true, force: true });
    }
  });

  it('keeps runtime facilitator definitions bound to canonical core skill assets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facilitator-gate-contract-'));
    TEMP_ROOTS.push(root);
    seed(root);

    const receipts = ensureFacilitatorRuntimeDefinition(root, { mode: 'en' });
    expect(receipts.every((receipt) => receipt.skippedReason == null)).toBe(true);

    const cursorRuntime = fs.readFileSync(
      path.join(root, '.cursor', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    const claudeRuntime = fs.readFileSync(
      path.join(root, '.claude', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );

    expect(cursorRuntime).toContain(
      '_bmad/cursor/skills/bmad-party-mode/steps/step-02-discussion-orchestration.en.md'
    );
    expect(claudeRuntime).toContain(
      '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.en.md'
    );

    for (const runtime of [cursorRuntime, claudeRuntime]) {
      expect(runtime).not.toContain(
        '_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration'
      );
      expect(runtime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=en');
    }

    expect(cursorRuntime).toContain('generalPurpose-compatible wrapper');
    expect(cursorRuntime).toContain('NO MID-RUN PAUSE IN CURSOR');
    expect(cursorRuntime).toContain('CURSOR INLINE FULL-RUN ONLY');
    expect(cursorRuntime).toContain('10/50');
    expect(cursorRuntime).toContain('20/50');
    expect(cursorRuntime).toContain('## Final Gate Evidence');
    expect(cursorRuntime).not.toContain('## Checkpoint <current_round>/<target_rounds_total>');
    expect(cursorRuntime).not.toMatch(/checkpoint/iu);

    expect(claudeRuntime).toContain('## Checkpoint <current_round>/<target_rounds_total>');
    expect(claudeRuntime).toContain('## Final Gate Evidence');
    expect(claudeRuntime).toContain('BATCH-BOUNDARY HANDOFF ONLY');
    expect(claudeRuntime).toContain('10/50');
  });

  it('canonical step-02 includes checker and evidence-chain requirements consumed by facilitator runtime', () => {
    const canonical = fs.readFileSync(
      path.join(
        ROOT,
        '_bmad',
        'core',
        'skills',
        'bmad-party-mode',
        'steps',
        'step-02-discussion-orchestration.md'
      ),
      'utf8'
    );

    expect(canonical).toContain('designated_challenger_id');
    expect(canonical).toContain('challenger_ratio > 0.60');
    expect(canonical).toContain('_bmad-output/party-mode/sessions/<session_key>.meta.json');
    expect(canonical).toContain('.cursor/hooks/party-mode-read-current-session.cjs');
    expect(canonical).toContain('_bmad/runtime/hooks/party-mode-read-current-session.cjs');
    expect(canonical).toMatch(/consumer installs must not require a project-root `scripts\/` directory|consumer 安装不得要求项目根存在 `scripts\/` 目录/iu);
    expect(canonical).toContain('_bmad-output/party-mode/evidence/<session_key>.audit.json');
    expect(canonical).toContain('20 / 40 / 60 / 80 / ...');
    expect(canonical).toContain('阶段性进展 checkpoint');
    expect(canonical).toContain('当前 challenger ratio');
    expect(canonical).toContain('### Round <n>');
    expect(canonical).toContain('## Checkpoint <current_round>/<target_rounds_total>');
    expect(canonical).toContain('## Final Gate Evidence');
    expect(canonical).toContain('current_batch_target_round');
    expect(canonical).toContain('10/50');
    expect(canonical).toContain('current_batch_target_round');
    expect(canonical).toContain('把控制权交还主 Agent');
  });

  it('Claude facilitator carriers keep visible checkpoints while Cursor carriers stay inline-only', () => {
    const claudeCarrierPaths = [
      path.join(ROOT, '_bmad', 'claude', 'agents', 'party-mode-facilitator.md'),
      path.join(ROOT, '_bmad', 'claude', 'agents', 'party-mode-facilitator.en.md'),
      path.join(ROOT, '_bmad', 'claude', 'agents', 'party-mode-facilitator.zh.md'),
    ];
    const cursorCarrierPaths = [
      path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
      path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.en.md'),
      path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.zh.md'),
    ];

    for (const content of claudeCarrierPaths.map((carrierPath) => fs.readFileSync(carrierPath, 'utf8'))) {
      expect(content).toContain('20 / 40 / 60 / 80 / ...');
      expect(content).toContain('## Checkpoint <current_round>/<target_rounds_total>');
      expect(content).toContain('## Final Gate Evidence');
      expect(content).toContain('BATCH-BOUNDARY HANDOFF ONLY');
      expect(content).toContain('10/50');
    }

    for (const content of cursorCarrierPaths.map((carrierPath) => fs.readFileSync(carrierPath, 'utf8'))) {
      expect(content).toContain('generalPurpose-compatible wrapper');
      expect(content).toContain('NO MID-RUN PAUSE IN CURSOR');
      expect(content).toContain('CURSOR INLINE FULL-RUN ONLY');
      expect(content).toContain('## Final Gate Evidence');
      expect(content).not.toContain('## Checkpoint <current_round>/<target_rounds_total>');
      expect(content).not.toMatch(/checkpoint/iu);
    }
  });

  it('base-language carriers keep the stronger zh-visible checkpoint instructions', () => {
    const cursorCarrier = fs.readFileSync(
      path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    const claudeCarrier = fs.readFileSync(
      path.join(ROOT, '_bmad', 'claude', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );

    expect(claudeCarrier).toContain('阶段性进展 checkpoint');
    expect(claudeCarrier).toContain('checkpoint 是 facilitator 控制文本');
    expect(claudeCarrier).toContain('## Checkpoint <current_round>/<target_rounds_total>');

    expect(cursorCarrier).toContain('generalPurpose 兼容执行路径');
    expect(cursorCarrier).toContain('NO MID-RUN PAUSE IN CURSOR');
    expect(cursorCarrier).toContain('CURSOR INLINE FULL-RUN ONLY');
    expect(cursorCarrier).not.toContain('BATCH-BOUNDARY HANDOFF ONLY');
    expect(cursorCarrier).not.toContain('## Checkpoint <current_round>/<target_rounds_total>');
    expect(cursorCarrier).not.toMatch(/checkpoint/iu);
  });
});
