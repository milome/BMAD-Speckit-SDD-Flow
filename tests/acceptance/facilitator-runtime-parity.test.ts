import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureFacilitatorRuntimeDefinition } from '../../scripts/facilitator-runtime-definition';

const repoRoot = process.cwd();

function seedRoot(root: string): void {
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

describe('facilitator runtime parity', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it('keeps same runtime target paths while materializing locale-specific content for both hosts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facilitator-parity-'));
    tempRoots.push(root);
    seedRoot(root);
    fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
      JSON.stringify(
        {
          version: 1,
          flow: 'story',
          stage: 'specify',
          languagePolicy: { resolvedMode: 'en' },
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );

    const receipts = ensureFacilitatorRuntimeDefinition(root);
    expect(receipts).toHaveLength(2);
    expect(receipts.map((receipt) => path.relative(root, receipt.targetPath).replace(/\\/g, '/'))).toEqual([
      '.cursor/agents/party-mode-facilitator.md',
      '.claude/agents/party-mode-facilitator.md',
    ]);

    const cursorRuntime = fs.readFileSync(
      path.join(root, '.cursor', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );
    const claudeRuntime = fs.readFileSync(
      path.join(root, '.claude', 'agents', 'party-mode-facilitator.md'),
      'utf8'
    );

    expect(cursorRuntime).toContain('resolvedMode=en');
    expect(claudeRuntime).toContain('resolvedMode=en');
    expect(cursorRuntime).toContain('_bmad/cursor/agents/party-mode-facilitator.en.md');
    expect(claudeRuntime).toContain('_bmad/claude/agents/party-mode-facilitator.en.md');
    expect(cursorRuntime).toContain('_bmad/core/skills/bmad-party-mode/workflow.en.md');
    expect(claudeRuntime).toContain('_bmad/core/skills/bmad-party-mode/workflow.en.md');
  });
});
