# Runtime Governance 自动注入（Cursor / Claude Code）

## 目标

在 **Agent / 子代理**路径上，由 hook 调用 **`emit-runtime-policy`**，将 `resolveRuntimePolicy` 的 JSON 注入模型上下文。**禁止**第二套 policy 求值逻辑。

- **Claude 主路径**：`.claude/settings.json` hooks
- **Cursor 主路径**：`.cursor/hooks.json` native hooks
- **Cursor 兼容路径**：third-party hooks / Claude-compatible hooks

## Init

1. 运行 `npx bmad-speckit init .`（`--ai claude` / `cursor-agent` 或逗号多选）或 `node scripts/init-to-root.js`（`--agent cursor` / `claude-code`）。
2. 完成后应存在：
   - **Claude**：`.claude/hooks/emit-runtime-policy-cli.js`、`.claude/hooks/runtime-policy-inject.js`，且 `.claude/settings.json` 含 policy hooks。
   - **Cursor**：`.cursor/hooks/emit-runtime-policy-cli.js`、`.cursor/hooks/runtime-policy-inject.js`、`.cursor/hooks/emit-runtime-policy.cjs`、`.cursor/hooks/write-runtime-context.js`，且 **`.cursor/hooks.json` 已生成**。
3. **runtime context / registry bootstrap**：init 现在会自动生成基础 project context 与最小 registry；正式运行时，story/run 级上下文应由真实入口通过统一 helper 自动刷新，而不是依赖用户记住手工补上下文。
4. **`scripts/emit-runtime-policy.cjs`**：由 workspace 包 **`@bmad-speckit/runtime-emit`** 构建并在 init 时复制到目标项目。

## Cursor Native Hooks

### 主路径

Cursor Runtime Governance 的主路径是：

- `.cursor/hooks.json`

该文件必须由 init / install / sync 自动生成，而不是要求用户手工到 Cursor UI 粘贴命令。

### 最低要求

`.cursor/hooks.json` 必须至少注册：

- `preToolUse`
- `subagentStart`
- `sessionStart`（若本轮实现采用会话级主注入）

并指向：

- `.cursor/hooks/runtime-policy-inject.js --cursor-host`
- 或 `.cursor/hooks/emit-runtime-policy-cli.js`

### 输出要求

`runtime-policy-inject.js --cursor-host` 必须输出 **Cursor-native hook JSON**。不能复用 Claude 的：

- `systemMessage`
- `hookSpecificOutput.additionalContext`

去假装兼容 Cursor。

## Claude Hooks

Claude 路径继续使用：

- `.claude/settings.json`
- `.claude/hooks/runtime-policy-inject.js`

Claude 与 Cursor **共用同一个治理内核**：

- 同一个 `resolveRuntimePolicy`
- 同一个 `emit-runtime-policy`
- 同一个 RuntimePolicy schema
- 同一个 `_bmad/runtime/hooks/` shared hook core

但两侧宿主 adapter 与 envelope 可以不同：

- `_bmad/claude/hooks/`：Claude adapter canonical source
- `_bmad/cursor/hooks/`：Cursor adapter canonical source
- `_bmad/runtime/hooks/`：shared canonical logic

## 验证

```bash
npx ts-node --transpile-only scripts/emit-runtime-policy.ts --cwd .
# 或（推荐；消费者目录仅需 Node，无需 ts-node）
node .claude/hooks/emit-runtime-policy-cli.js
node .cursor/hooks/emit-runtime-policy-cli.js
```

应打印一行 JSON policy。若缺少上下文且无 CLI 参数与 registry-backed context，应 **exit 非 0** 且 stderr 有说明。

```bash
npm run test:runtime-policy-inject
```

若已补齐 Cursor native hooks 专项测试，还必须通过：

```bash
npx vitest run tests/acceptance/cursor-hooks-json-generation.test.ts tests/acceptance/cursor-hooks-json-schema.test.ts tests/acceptance/cursor-runtime-policy-inject-output.test.ts
```

## 排障

| 现象 | 处理 |
|------|------|
| 缺少 registry-backed runtime context | 先确保 `activeScope` 指向有效的 scoped context file，或通过 CLI/env 明确提供 `flow`/`stage` 与 story identity；正式入口不再依赖单独的 context-file 环境变量 |
| emit 失败 / hook exit 1 | 读 stderr；模型侧只能见错误信息，**不能**出现伪 policy |
| Cursor 无生效 hooks | 先检查 `.cursor/hooks.json` 是否存在、事件是否注册、command 路径是否正确 |
| 路径错误 | 确认项目根含 `_bmad/` 且 hook command 指向正确文件 |

## `BMAD_POLICY_INJECT`

- **默认**：未设置 = **开启**注入。
- **`BMAD_POLICY_INJECT=0`**：hook 与 `emit-runtime-policy-cli.js` 首行短路，不调用 emit；仅输出已关闭说明。用于排障，**不作为默认安装行为**。

## 超时

- Claude policy hook timeout：**8s**
- Cursor native hooks timeout：**8s**

## Cursor 兼容路径

当且仅当以下条件成立时，允许使用兼容路径：

1. 当前 Cursor 版本不支持项目级 `.cursor/hooks.json`
2. 企业策略接管 hooks 配置
3. 用户显式选择 third-party hooks / Claude-compatible hooks 模式

此时才允许：

- 使用 third-party hooks
- 加载 Claude-compatible hooks
- 或手工在 Cursor UI 注册命令

这些都不是主推荐路径。

## 参考

- [`../reference/runtime-policy-emit-schema.md`](../reference/runtime-policy-emit-schema.md)
- [`../reference/runtime-context.schema.json`](../reference/runtime-context.schema.json)
- [`../reference/cursor-runtime-governance-hooks.md`](../reference/cursor-runtime-governance-hooks.md)
