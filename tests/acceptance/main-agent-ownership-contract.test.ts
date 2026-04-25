import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

describe('main agent ownership contract', () => {
  it('documents the main agent as the only interactive orchestrator', () => {
    const agentsRef = readFileSync(join(ROOT, 'docs', 'reference', 'agents.md'), 'utf8');
    const storyGuide = readFileSync(join(ROOT, 'docs', 'how-to', 'bmad-story-assistant.md'), 'utf8');

    expect(agentsRef).toContain('Main Agent 是唯一交互式编排者');
    expect(agentsRef).toContain('子代理只负责 bounded execution');
    expect(agentsRef).toContain('后台 worker / runner 已禁用为 legacy path');

    expect(storyGuide).toContain('interactive 模式下的下一步执行始终由 **主 Agent** 决定');
    expect(storyGuide).toContain('由主 Agent 读取 orchestration state 与 packet');
  });
});
