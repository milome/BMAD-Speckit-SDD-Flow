/**
 * Built-in 22 AI configTemplate (Story 12.1, spec §4.3, PRD §5.12).
 * 每条含 id、name、description、configTemplate（commandsDir、rulesDir、skillsDir、agentsDir/configDir、subagentSupport）。
 * Used by AIRegistry as base entries; project/global registry override or extend.
 * @type {Array<{ id: string, name: string, description: string, configTemplate: Record<string, unknown> }>}
 */
module.exports = [
  { id: 'cursor-agent', name: 'Cursor Agent', description: 'Cursor IDE built-in agent', configTemplate: { commandsDir: '.cursor/commands', rulesDir: '.cursor/rules', skillsDir: '~/.cursor/skills', agentsDir: '.cursor/agents', subagentSupport: 'native', sourceDir: 'cursor', platformSkillsDir: '_bmad/cursor/skills', rulesFormat: 'mdc' } },
  { id: 'claude', name: 'Claude', description: 'Anthropic Claude (Claude Code, Claude Desktop)', configTemplate: { commandsDir: '.claude/commands', rulesDir: '.claude/rules', skillsDir: '~/.claude/skills', agentsDir: '.claude/agents', subagentSupport: 'native', sourceDir: 'claude', platformSkillsDir: '_bmad/claude/skills', hooksDir: '.claude/hooks', rulesFormat: 'md' } },
  { id: 'gemini', name: 'Gemini', description: 'Google Gemini', configTemplate: { commandsDir: '.gemini/commands', skillsDir: '~/.gemini/commands', subagentSupport: 'limited' } },
  { id: 'copilot', name: 'Copilot', description: 'GitHub Copilot', configTemplate: { commandsDir: '.github/agents', subagentSupport: 'native' } },
  { id: 'qwen', name: 'Qwen', description: 'Alibaba Qwen / Tongyi', configTemplate: { commandsDir: '.qwen/commands', skillsDir: '~/.qwen/skills', subagentSupport: 'native' } },
  { id: 'opencode', name: 'OpenCode', description: 'OpenCode CLI', configTemplate: { commandsDir: '.opencode/command', skillsDir: '~/.config/opencode/commands', subagentSupport: 'native' } },
  { id: 'codex', name: 'Codex', description: 'Codex CLI', configTemplate: { commandsDir: '.codex/commands', configDir: '.codex/config.toml', subagentSupport: 'mcp' } },
  { id: 'windsurf', name: 'Windsurf', description: 'Windsurf IDE', configTemplate: { commandsDir: '.windsurf/workflows', skillsDir: '~/.codeium/windsurf/skills', subagentSupport: 'limited' } },
  { id: 'kilocode', name: 'KiloCode', description: 'KiloCode', configTemplate: { rulesDir: '.kilocode/rules', skillsDir: '~/.kilocode/rules', subagentSupport: 'limited' } },
  { id: 'auggie', name: 'Auggie', description: 'Augment / Auggie', configTemplate: { rulesDir: '.augment/rules', skillsDir: '~/.augment/commands', subagentSupport: 'native' } },
  { id: 'roo', name: 'Roo', description: 'Roo CLI', configTemplate: { rulesDir: '.roo/rules', skillsDir: '~/.roo/rules', subagentSupport: 'limited' } },
  { id: 'codebuddy', name: 'CodeBuddy', description: 'CodeBuddy', configTemplate: { commandsDir: '.codebuddy/commands', skillsDir: '.codebuddy/skills', agentsDir: '.codebuddy/agents', subagentSupport: 'native' } },
  { id: 'amp', name: 'Amp', description: 'Amp', configTemplate: { commandsDir: '.agents/commands', subagentSupport: 'native' } },
  { id: 'shai', name: 'SHAI', description: 'SHAI', configTemplate: { commandsDir: '.shai/commands', skillsDir: '~/.shai/skills', subagentSupport: 'mcp' } },
  { id: 'q', name: 'Q', description: 'Q', configTemplate: { commandsDir: '~/.aws/amazonq/prompts', skillsDir: '~/.aws/amazonq/prompts', subagentSupport: 'native' } },
  { id: 'agy', name: 'Agy', description: 'Agy', configTemplate: { commandsDir: '.agent/workflows', skillsDir: '~/.gemini/antigravity/skills', configDir: '.agent/skills', subagentSupport: 'native' } },
  { id: 'bob', name: 'Bob', description: 'IBM Bob', configTemplate: { commandsDir: '.bob/commands', subagentSupport: 'mcp' } },
  { id: 'qodercli', name: 'QoderCLI', description: 'Qoder CLI', configTemplate: { commandsDir: '.qoder/commands', skillsDir: '~/.qoder/skills', subagentSupport: 'native' } },
  { id: 'cody', name: 'Cody', description: 'Sourcegraph Cody', configTemplate: { configDir: 'cody.json', subagentSupport: 'limited' } },
  { id: 'tabnine', name: 'Tabnine', description: 'Tabnine', configTemplate: { skillsDir: '~/.tabnine/agent', subagentSupport: 'none' } },
  { id: 'kiro-cli', name: 'Kiro CLI', description: 'Kiro CLI', configTemplate: { commandsDir: '.kiro/prompts', skillsDir: '~/.kiro/prompts', subagentSupport: 'native' } },
  { id: 'generic', name: 'Generic', description: 'Generic / custom (requires --ai-commands-dir)', configTemplate: { subagentSupport: 'none' } },
];
