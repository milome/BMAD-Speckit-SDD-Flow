# Runtime policy emit 契约（`emit-runtime-policy`）

单一求值源：`scripts/runtime-governance.ts` 的 `resolveRuntimePolicy`。对外出口：`scripts/emit-runtime-policy.ts`（开发）、`@bmad-speckit/runtime-emit` 打出的 `emit-runtime-policy.cjs`（消费者 / hooks），或 `emit-runtime-policy-cli.js` 包装器。

## 成功响应（stdout）

- **Content-Type**：单行 UTF-8 JSON（无 BOM）。
- **序列化**：对对象键做**深度字典序排序**后的 JSON，与 `stableStringifyPolicy(policy)` 一致（见 `scripts/stable-runtime-policy-json.ts`）。
- **结构**：与 `RuntimePolicy` 一致，字段见 [`runtime-policy-emit.schema.json`](./runtime-policy-emit.schema.json) 中 `$defs/successPolicy`。
- **兼容策略**：当前成功响应同时包含顶层兼容字段与子结构字段：
  - 顶层：`flow`、`stage`、`auditRequired`、`validationLevel`、`strictness`、`generateDoc`、`convergence`、`mandatoryGate`、`granularityGoverned`、`skipAllowed`、`scoringEnabled`、`triggerStage`、`compatibilitySource`、`reason`
  - 子结构：`identity`、`control`、`language`
- **镜像约束**：`control.triggerStage`、`control.scoringEnabled`、`control.mandatoryGate`、`control.granularityGoverned` 等值必须与同名顶层兼容字段保持一致；`language` 子结构用于声明 machine-readable surfaces 不因 narrative 语言切换而被改写。

## 失败响应（本仓库写死策略）

- **CLI `emit-runtime-policy`**：退出码 **≠ 0**；**stderr** 为人类可读说明；**stdout 为空**（不输出伪完整 policy）。
- **可选**（未采用）：stdout 仅一行 `{"error":"...","reason":"..."}`；若将来启用，须与 [`runtime-policy-emit.schema.json`](./runtime-policy-emit.schema.json) 中 `$defs/errorBody` 一致。

## Hook 失败时

- `runtime-policy-inject.js`：`emit` 非 0 时 **exit 1**，并向 stdout 写入 Claude Code 要求的 JSON，其中 **仅含错误说明文本**（`systemMessage` 或 `hookSpecificOutput.additionalContext`），**禁止**注入伪造的完整 policy 对象。

## 环境变量

| 变量 | 作用 |
|------|------|
| `BMAD_RUNTIME_CWD` | 项目根（emit-cli 设置）。 |
| `BMAD_RUNTIME_FLOW` / `BMAD_RUNTIME_STAGE` | 直接提供 flow/stage；缺失时才回落到 registry-backed context 解析。 |
| `BMAD_RUNTIME_EPIC_ID` / `BMAD_RUNTIME_STORY_ID` / `BMAD_RUNTIME_RUN_ID` 等 | 提供 story-scoped identity；正式入口不再依赖单独的 context-file 环境变量。 |
| `BMAD_RUNTIME_SHADOW=1` | 影响 `compatibilitySource` 字段（对照测试）。 |

## 互链

- 上下文文件：[`runtime-context.schema.json`](./runtime-context.schema.json)、[`../how-to/runtime-governance-auto-inject-cursor-claude.md`](../how-to/runtime-governance-auto-inject-cursor-claude.md)
