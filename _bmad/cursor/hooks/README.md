# Cursor hooks（Runtime Governance）

源脚本与 Claude 共用治理内核，位于 `_bmad/claude/hooks/`：

- `emit-runtime-policy-cli.cjs` — 优先 hook 邻接 `emit-runtime-policy.cjs`；其次项目内 `scripts/emit-runtime-policy.cjs`；再使用 `@bmad-speckit/runtime-emit` bundle；最后才回退到 `ts-node` + `scripts/emit-runtime-policy.ts`
- `runtime-policy-inject.cjs` — Cursor 宿主路径使用 `--cursor-host`，输出 Cursor-native hook JSON

`init-to-root.js`（`--agent cursor`）与 install/sync 路径必须部署：

- `.cursor/hooks/emit-runtime-policy-cli.cjs`
- `.cursor/hooks/runtime-policy-inject.cjs`
- `.cursor/hooks/subagent-result-summary.cjs`
- `.cursor/hooks/emit-runtime-policy.cjs`
- `.cursor/hooks/write-runtime-context.cjs`
- `.cursor/hooks.json`

## 与 Claude 的关系

- **Claude Code**：`_bmad/claude/settings.json` 经 init 合并到 `.claude/settings.json`，PreToolUse / SubagentStart 自动调用 `runtime-policy-inject.cjs`。
- **Cursor**：主路径是 **native `.cursor/hooks.json`**。该文件必须由 init 自动生成，并把本地 node 命令挂到 Cursor 官方 hooks 事件上。
- **Cursor fallback**：third-party hooks / Claude-compatible hooks 仅作为兼容路径，不是主方案。
- **双宿主一致**指：**同一** `resolveRuntimePolicy`、**同一** `emit-runtime-policy`、**同一** RuntimePolicy schema；并不要求两宿主配置文件或输出 envelope 完全相同。

## 当前正式结论

1. Cursor 官方 hooks 已具备 Runtime Governance 落地所需的核心能力。
2. 本仓库对 Cursor 的正式自动化交付物不只是 `.cursor/hooks/*.js`，还包括 **`.cursor/hooks.json`**。
3. `subagentStop` 现已可用于 Cursor 分支的 party-mode 自动收口，但 `current-session.json` 仍是唯一真相源。
4. 若 `.cursor/hooks.json` 未随 init 落盘，则 Cursor 自动注入方案视为未完整交付。

完整步骤与排障：[`docs/how-to/runtime-governance-auto-inject-cursor-claude.md`](../../../docs/how-to/runtime-governance-auto-inject-cursor-claude.md)
