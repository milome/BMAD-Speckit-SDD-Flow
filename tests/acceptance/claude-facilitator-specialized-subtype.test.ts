import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('Claude facilitator specialized subtype', () => {
  it('ships a canonical Claude facilitator agent and mirrors it into runtime', () => {
    const canonicalPath = '_bmad/claude/agents/party-mode-facilitator.md';
    const runtimePath = '.claude/agents/party-mode-facilitator.md';

    expect(existsSync(canonicalPath)).toBe(true);
    expect(existsSync(runtimePath)).toBe(true);
    expect(readFileSync(runtimePath, 'utf8')).toBe(readFileSync(canonicalPath, 'utf8'));
  });

  it('updates story assistant to route party-mode through the specialized facilitator subtype', () => {
    const rule = readFileSync('_bmad/claude/rules/bmad-story-assistant.md', 'utf8');
    const skill = readFileSync('_bmad/claude/skills/bmad-story-assistant/SKILL.md', 'utf8');

    expect(rule).toContain('party-mode-facilitator');
    expect(rule).toContain('@"party-mode-facilitator (agent)"');
    expect(skill).toContain('.claude/agents/party-mode-facilitator.md');
    expect(skill).toContain('@"party-mode-facilitator (agent)"');
    expect(skill).toContain('general-purpose');
    expect(skill).not.toContain(
      'Claude Code CLI 的 `Agent` 工具没有专门的 `subagent_type` 对应 `.claude/agents/*.md` 文件。'
    );
  });

  it('updates bug assistant to route party-mode through the specialized facilitator subtype while retaining compatibility fallback', () => {
    const skill = readFileSync('_bmad/claude/skills/bmad-bug-assistant/SKILL.md', 'utf8');

    expect(skill).toContain('.claude/agents/party-mode-facilitator.md');
    expect(skill).toContain('@"party-mode-facilitator (agent)"');
    expect(skill).toContain('Fallback Strategy');
    expect(skill).toContain('subagent_type: general-purpose');
  });
});
