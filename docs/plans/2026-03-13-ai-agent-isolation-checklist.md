# AI Agent Isolation Checklist

## Validation gates

- `npm run test:cursor-regression`
- `npm run test:claude-isolation`

## Cross-install order

- cursor->claude-code
- claude-code->cursor

## Required checks

- `.cursor/**` is not overwritten by Claude Code installation
- `.claude/**` is not overwritten by Cursor installation
- key runtime entry files exist after each order
