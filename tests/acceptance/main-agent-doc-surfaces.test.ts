import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('main-agent doc surfaces', () => {
  it('keeps README entry surfaces on the accepted main-agent path', () => {
    const readme = readFileSync('README.md', 'utf8');
    const zh = readFileSync('README.zh-CN.md', 'utf8');

    expect(readme).toContain('inspect -> dispatch-plan -> closeout');
    expect(readme).toContain('main-agent path');
    expect(zh).toContain('inspect -> dispatch-plan -> closeout');
    expect(zh).toContain('主 Agent');
  });

  it('keeps guide-index, skills, and speckit-cli aligned with surface-first semantics', () => {
    const guideIndex = readFileSync('docs/how-to/guide-index.md', 'utf8');
    const skills = readFileSync('docs/reference/skills.md', 'utf8');
    const cli = readFileSync('docs/reference/speckit-cli.md', 'utf8');

    expect(guideIndex).toContain('main-agent-orchestration inspect');
    expect(skills).toContain('main-agent-orchestration inspect');
    expect(cli).toContain('main-agent-orchestration inspect');
    expect(cli).toContain('dispatch-plan');
  });
});
