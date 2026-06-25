/**
 * Built-in 19+ AI list (PRD §5.3, ARCH §3.1, Story 10.1 T3).
 * Each item: id, name, description - for configTemplate extension (Story 12.1).
 * Used for init selection; full configTemplate comes from ai-registry-builtin.
 * @type {Array<{ id: string, name: string, description: string }>}
 */
module.exports = [
  { id: 'claude', name: 'Claude', description: 'Anthropic Claude (Claude Code, Claude Desktop)' },
  { id: 'gemini', name: 'Gemini', description: 'Google Gemini' },
  { id: 'copilot', name: 'Copilot', description: 'GitHub Copilot' },
  { id: 'cursor-agent', name: 'Cursor Agent', description: 'Cursor IDE built-in agent' },
  { id: 'qwen', name: 'Qwen', description: 'Alibaba Qwen / Tongyi' },
  { id: 'opencode', name: 'OpenCode', description: 'OpenCode CLI' },
  { id: 'codex', name: 'Codex', description: 'Codex CLI' },
  { id: 'windsurf', name: 'Windsurf', description: 'Windsurf IDE' },
  { id: 'kilocode', name: 'KiloCode', description: 'KiloCode' },
  { id: 'auggie', name: 'Auggie', description: 'Augment / Auggie' },
  { id: 'roo', name: 'Roo', description: 'Roo CLI' },
  { id: 'codebuddy', name: 'CodeBuddy', description: 'CodeBuddy' },
  { id: 'amp', name: 'Amp', description: 'Amp' },
  { id: 'shai', name: 'SHAI', description: 'SHAI' },
  { id: 'q', name: 'Q', description: 'Q' },
  { id: 'agy', name: 'Agy', description: 'Agy' },
  { id: 'bob', name: 'Bob', description: 'IBM Bob' },
  { id: 'qodercli', name: 'QoderCLI', description: 'Qoder CLI' },
  { id: 'cody', name: 'Cody', description: 'Sourcegraph Cody' },
  { id: 'tabnine', name: 'Tabnine', description: 'Tabnine' },
  { id: 'generic', name: 'Generic', description: 'Generic / custom (requires --ai-commands-dir)' },
];
