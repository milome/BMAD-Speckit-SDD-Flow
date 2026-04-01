# Runtime Context（显式 scoped 输入）

Hook 与 `emit-runtime-policy` 不再把项目根 `.bmad/runtime-context.json` 作为默认真相源。运行时上下文必须来自 **registry + activeScope + scoped context file**，或来自 CLI/env 显式提供的 `flow`/`stage`。若缺失所需上下文，则直接失败。

## 输入规则

当未通过 CLI/env 提供 `flow`/`stage` 时，`emit-runtime-policy` 必须：

1. 读取 runtime context registry
2. 解析 `activeScope`
3. 定位对应 scoped context file
4. 读取该 context 并求值

若 registry、`activeScope` 或对应 context 缺失，则直接 fail loud；**不允许再回退到** 任何旧共享 context。`.speckit-state.yaml` 已完全移除，不再作为 runtime context 输入。

## 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `version` | 是 | 固定 `1` |
| `flow` | 是 | `story` \| `bugfix` \| `standalone_tasks` \| `epic` \| `unknown` |
| `stage` | 是 | Speckit/BMAD 阶段名，见 JSON Schema 枚举 |
| `templateId` | 否 | 传入 `resolveRuntimePolicy` 的模板 id |
| `epicId` | 否 | 当前 story-scoped 运行上下文所属 Epic 标识 |
| `storyId` | 否 | 当前 story-scoped 运行上下文所属 Story 标识 |
| `storySlug` | 否 | Story 目录 slug，用于 artifact 与日志可读性 |
| `runId` | 否 | 当前执行轮次的唯一运行身份 |
| `artifactRoot` | 否 | 当前 story 产物根目录 |
| `contextScope` | 否 | `project` \| `story`；正式运行时推荐使用 `story` |
| `updatedAt` | 是 | ISO-8601 时间戳（写入责任方更新） |

## 写入责任

- **统一 helper 入口（当前推荐）**：
  - `detectRuntimeSourceMode(...)`
  - `ensureProjectRuntimeContext(...)`
  - `ensureStoryRuntimeContext(...)`
  - `ensureRunRuntimeContext(...)`
- **生成 context file**：维护方仍可通过 `node scripts/write-runtime-context.js <targetFile> [flow] [stage] [templateId] [epicId] [storyId] [storySlug] [runId] [artifactRoot] [contextScope]` 生成 scoped runtime context 文件，供 registry `activeScope` 或显式读取路径消费；正式 emit / hooks 不再把单独的 context-file 环境变量作为主入口。
- **阶段切换**：真实入口应调用统一 helper 自动刷新 context / registry，而不是要求用户记住何时手工补上下文。
- **story-scoped 模式**：当 `contextScope=story` 或当前 story/implement/post_audit 运行依赖 story 身份时，必须通过 context + registry 提供上下文；缺失时直接失败，禁止再依赖共享根 context。
- **消费者**：若需要样板，可从 [`../../_bmad/runtime-context.example.json`](../../_bmad/runtime-context.example.json) 复制并生成独立 context file。

## 机器校验

- JSON Schema：[`runtime-context.schema.json`](./runtime-context.schema.json)
