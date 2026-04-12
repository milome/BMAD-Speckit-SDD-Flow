import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const ENGLISH_SIDEcars = [
  '_bmad/claude/agents/party-mode-facilitator.en.md',
  '_bmad/cursor/agents/party-mode-facilitator.en.md',
  '_bmad/core/skills/bmad-party-mode/workflow.en.md',
  '_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.en.md',
  '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.en.md',
  '_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.en.md',
] as const;

function hasHanCharacters(value: string): boolean {
  return /[\u4e00-\u9fff]/u.test(value);
}

describe('party-mode english sidecars', () => {
  it('keep core english assets free of Han text', () => {
    for (const relativePath of ENGLISH_SIDEcars) {
      const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      expect(hasHanCharacters(content)).toBe(false);
    }
  });

  it('retains expected English control headings', () => {
    const facilitator = fs.readFileSync(
      path.join(ROOT, '_bmad/claude/agents/party-mode-facilitator.en.md'),
      'utf8'
    );
    const workflow = fs.readFileSync(
      path.join(ROOT, '_bmad/core/skills/bmad-party-mode/workflow.en.md'),
      'utf8'
    );
    const step02 = fs.readFileSync(
      path.join(
        ROOT,
        '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.en.md'
      ),
      'utf8'
    );

    expect(facilitator).toContain('## Required Steps');
    expect(workflow).toContain('## Workflow Architecture');
    expect(step02).toContain('## Discussion Sequence');
    expect(step02).toContain('Decision / Root-Cause Override');
  });
});
