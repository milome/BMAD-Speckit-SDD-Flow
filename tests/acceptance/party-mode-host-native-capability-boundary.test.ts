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
      fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8')
    ) as {
      hooks: Record<string, unknown>;
    };

    expect(Object.keys(cursorHooks.hooks).sort()).toEqual([
      'postToolUse',
      'preToolUse',
      'preToolUseCommands',
      'sessionStart',
      'subagentStart',
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
    const gapNote = fs.readFileSync(
      path.join(
        ROOT,
        'docs',
        'plans',
        '2026-04-14-party-mode-facilitator-runtime-hook-gap-note.md'
      ),
      'utf8'
    );

    expect(gapNote).toContain('仍不是 host 原生 agent-turn event');
    expect(gapNote).toContain('只能稳定观察到');
    expect(gapNote).toContain('sessionStart / subagentStart');
    expect(gapNote).toContain('repo-owned explicit event writer + post-tool-use refresh bridge');
  });
});
