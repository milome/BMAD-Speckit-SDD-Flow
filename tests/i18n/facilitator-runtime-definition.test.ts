import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureFacilitatorRuntimeDefinition,
  materializeFacilitatorDefinition,
} from '../../scripts/facilitator-runtime-definition';

const repoRoot = process.cwd();

function seedFacilitatorAssets(root: string): void {
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
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

describe('facilitator runtime definition', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it('materializes host runtime target with language-specific workflow bindings', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facilitator-materialize-'));
    tempRoots.push(root);
    seedFacilitatorAssets(root);

    const receipt = materializeFacilitatorDefinition(root, 'cursor', 'en');
    expect(receipt.updated).toBe(true);

    const runtime = fs.readFileSync(
      path.join(root, '.cursor', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    expect(runtime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=en');
    expect(runtime).toContain('_bmad/cursor/agents/party-mode-facilitator.en.md');
    expect(runtime).toContain('_bmad/core/skills/bmad-party-mode/workflow.en.md');
    expect(runtime).toContain(
      '_bmad/cursor/skills/bmad-party-mode/steps/step-02-discussion-orchestration.en.md'
    );
  });

  it('keeps the same runtime path but changes materialized content across zh/en modes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facilitator-materialize-switch-'));
    tempRoots.push(root);
    seedFacilitatorAssets(root);

    const zhReceipt = materializeFacilitatorDefinition(root, 'claude', 'zh');
    const zhRuntime = fs.readFileSync(zhReceipt.targetPath, 'utf8');
    expect(zhReceipt.targetPath.replace(/\\/g, '/')).toContain('/.claude/agents/party-mode-facilitator.md');
    expect(zhRuntime).toContain('resolvedMode=zh');
    expect(zhRuntime).toContain('_bmad/claude/agents/party-mode-facilitator.zh.md');

    const enReceipt = materializeFacilitatorDefinition(root, 'claude', 'en');
    const enRuntime = fs.readFileSync(enReceipt.targetPath, 'utf8');
    expect(enReceipt.targetPath).toBe(zhReceipt.targetPath);
    expect(enRuntime).toContain('resolvedMode=en');
    expect(enRuntime).toContain('_bmad/claude/agents/party-mode-facilitator.en.md');
    expect(enRuntime).not.toBe(zhRuntime);
  });

  it('restores the default runtime target when base mode is requested after a localized materialization', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facilitator-materialize-base-'));
    tempRoots.push(root);
    seedFacilitatorAssets(root);

    materializeFacilitatorDefinition(root, 'cursor', 'en');
    const targetPath = path.join(root, '.cursor', 'agents', 'party-mode-facilitator.md');
    const enRuntime = fs.readFileSync(targetPath, 'utf8');
    expect(enRuntime).toContain('resolvedMode=en');

    const baseReceipt = materializeFacilitatorDefinition(root, 'cursor', 'base');
    expect(baseReceipt.updated).toBe(true);
    expect(baseReceipt.fallbackReason).toBe('explicit_base_override');

    const baseRuntime = fs.readFileSync(targetPath, 'utf8');
    expect(baseRuntime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=base');
    expect(baseRuntime).toContain('fallbackReason=explicit_base_override');
    const canonicalBase = fs.readFileSync(
      path.join(root, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    const baseRuntimeWithoutHeader = baseRuntime.replace(
      /<!-- RUNTIME-MATERIALIZED facilitator[\s\S]*? -->\r?\n?/u,
      ''
    );
    expect(baseRuntimeWithoutHeader).toBe(canonicalBase);
  });

  it('uses project runtime context languagePolicy when no explicit mode is passed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facilitator-ensure-'));
    tempRoots.push(root);
    seedFacilitatorAssets(root);
    fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
      JSON.stringify(
        {
          version: 1,
          flow: 'story',
          stage: 'specify',
          languagePolicy: { resolvedMode: 'bilingual' },
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );

    const receipts = ensureFacilitatorRuntimeDefinition(root);
    expect(receipts.every((receipt) => receipt.skippedReason == null)).toBe(true);

    const claudeRuntime = fs.readFileSync(
      path.join(root, '.claude', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    expect(claudeRuntime).toContain('resolvedMode=bilingual');
    expect(claudeRuntime).toContain('_bmad/claude/agents/party-mode-facilitator.zh.md');
    expect(claudeRuntime).toContain('_bmad/core/skills/bmad-party-mode/workflow.zh.md');
  });

  it('materializes base mode with an explicit diagnostic header when project context is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facilitator-missing-context-'));
    tempRoots.push(root);
    seedFacilitatorAssets(root);

    const receipts = ensureFacilitatorRuntimeDefinition(root);
    expect(receipts.every((receipt) => receipt.mode === 'base')).toBe(true);
    expect(receipts.every((receipt) => receipt.fallbackReason === 'project_context_missing')).toBe(
      true
    );

    const cursorRuntime = fs.readFileSync(
      path.join(root, '.cursor', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    expect(cursorRuntime).toContain('resolvedMode=base');
    expect(cursorRuntime).toContain('fallbackReason=project_context_missing');
    expect(cursorRuntime).toContain('contextPath=_bmad-output/runtime/context/project.json');
  });
});
