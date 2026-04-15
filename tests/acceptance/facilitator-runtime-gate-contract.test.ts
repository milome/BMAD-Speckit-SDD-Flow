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

    for (const runtime of [cursorRuntime, claudeRuntime]) {
      expect(runtime).toContain(
        '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.en.md'
      );
      expect(runtime).not.toContain(
        '_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration'
      );
      expect(runtime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=en');
    }
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
    expect(canonical).toContain(
      'scripts/party-mode-gate-check.ts --session-key <session_key> --write-all'
    );
    expect(canonical).toContain('_bmad-output/party-mode/evidence/<session_key>.audit.json');
    expect(canonical).toContain('20 / 40 / 60 / 80 / ...');
    expect(canonical).toContain('阶段性进展 checkpoint');
    expect(canonical).toContain('当前 challenger ratio');
  });

  it('facilitator carriers require visible 20-round checkpoints in-session', () => {
    const cursorCarrier = fs.readFileSync(
      path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    const claudeCarrier = fs.readFileSync(
      path.join(ROOT, '_bmad', 'claude', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );

    for (const content of [cursorCarrier, claudeCarrier]) {
      expect(content).toContain('20 / 40 / 60 / 80 / ...');
      expect(content).toContain('阶段性进展 checkpoint');
      expect(content).toContain('checkpoint 是 facilitator 控制文本');
    }
  });
});
