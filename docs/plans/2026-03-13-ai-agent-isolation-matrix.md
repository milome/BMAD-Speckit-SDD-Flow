# AI Agent Isolation Matrix

## Runtime Boundaries

| Area | Cursor | Claude Code | Shared Source | Cross-Agent Reuse |
|---|---|---|---|---|
| runtime entrypoints | `.cursor/commands`, `.cursor/rules`, `.cursor/agents` | `.claude/agents`, `.claude/commands`, `.claude/protocols` | `commands/`, `rules/`, `.claude/agents/`, `.claude/protocols/` | No |
| state | Cursor-managed workspace state | `.claude/state` | None | No |
| hooks | Cursor-managed IDE/runtime hooks | `.claude/hooks` | None | No |
| checkpoints | Cursor regression checkpoints and acceptance evidence | Claude-specific checkpoints and acceptance evidence | Documentation only | No |

## Cursor runtime

- `.cursor/commands`
- `.cursor/rules`
- `.cursor/agents`

## Claude Code runtime

- `.claude/agents`
- `.claude/commands`
- `.claude/protocols`
- `.claude/state`
- `.claude/hooks`

## Shared source assets

- `_bmad/`
- `templates/`
- `workflows/`
- `commands/`
- `rules/`

## Never shared across agents

- state
- hooks
- checkpoints
- runtime entrypoints
