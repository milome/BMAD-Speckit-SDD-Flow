import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('party-mode host-native capability boundary', () => {
  it('documents current host hook surfaces as session/subagent/tool boundaries only', () => {
    const cursorHooks = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.cursor', 'hooks.json'), 'utf8')
    ) as {
      hooks: Record<string, unknown>;
    };
    const claudeSettings = JSON.parse(
      fs.readFileSync(path.join(ROOT, '_bmad', 'claude', 'settings.json'), 'utf8')
    ) as {
      hooks: Record<string, unknown>;
    };

    expect(Object.keys(cursorHooks.hooks).sort()).toEqual([
      'postToolUse',
      'preToolUse',
      'sessionStart',
      'subagentStart',
      'subagentStop',
    ]);
    expect(Object.keys(claudeSettings.hooks).sort()).toEqual([
      'PostToolUse',
      'PreToolUse',
      'Stop',
      'SubagentStart',
      'SubagentStop',
      'WorktreeCreate',
    ]);

    const combinedKeys = [...Object.keys(cursorHooks.hooks), ...Object.keys(claudeSettings.hooks)];
    expect(combinedKeys).not.toContain('AgentTurn');
    expect(combinedKeys).not.toContain('AssistantTurn');
    expect(combinedKeys).not.toContain('AssistantMessage');
  });

  it('keeps the runtime gap note honest about bridge vs native support', () => {
    const governanceGuide = fs.readFileSync(
      path.join(
        ROOT,
        'docs',
        'how-to',
        'runtime-governance-auto-inject-cursor-claude.md'
      ),
      'utf8'
    );

    expect(governanceGuide).toContain('Cursor 主路径');
    expect(governanceGuide).toContain('.cursor/hooks.json');
    expect(governanceGuide).toContain('Cursor 兼容路径');
    expect(governanceGuide).toContain('third-party hooks / Claude-compatible hooks');
  });
});
