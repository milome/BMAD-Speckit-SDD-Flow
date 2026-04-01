# Runtime policy emit 契约（`emit-runtime-policy`）

单一求值源：`scripts/runtime-governance.ts` 的 `resolveRuntimePolicy`。对外出口：`scripts/emit-runtime-policy.ts`（本仓库开发）、`@bmad-speckit/runtime-emit` 打出的 `dist/emit-runtime-policy.cjs`（**消费者与 hooks 主路径**：`npm install` + init 将 cjs 置于 `.cursor/hooks`/`.claude/hooks` 旁），以及 `emit-runtime-policy-cli.js` 薄启动器（优先同目录 cjs，其次 `require.resolve('@bmad-speckit/runtime-emit/dist/emit-runtime-policy.cjs')`）。**不要求**消费者项目根存在 `scripts/emit-runtime-policy.ts`。

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

## 环境变量与真相源

- **不读取**任何用于覆盖运行时策略或关闭注入的专用环境变量；**无** env 覆盖、**无** CLI 覆盖 flow/stage（CLI 仅 `--cwd` 用于定位项目根）。
- **唯一真相源**：`_bmad-output/runtime/registry.json` 的 `activeScope` + 解析得到的 scoped context JSON（如 `context/project.json`）。
- **`compatibilitySource` 的 `shadow`**：仅由单元/验收测试调用 `setRuntimePolicyShadowModeForTests(true)`（见 `scripts/runtime-governance.ts`），**不**通过环境变量。

## 互链

- 上下文文件：[`runtime-context.schema.json`](./runtime-context.schema.json)、[`../how-to/runtime-governance-auto-inject-cursor-claude.md`](../how-to/runtime-governance-auto-inject-cursor-claude.md)
