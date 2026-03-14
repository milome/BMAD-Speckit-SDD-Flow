# Cursor 版 BMAD Story Assistant 使用说明

## 1. 入口定位

本文档介绍的是 **Cursor 运行时版本** 的 `bmad-story-assistant` 使用方式。

它与 `docs/guide/claudecode/bmad-story-assistant.md` 共享相同的高层流程语义，但运行时入口不同：

- **Cursor 版**：通过 Cursor 规则、Cursor Task、`mcp_task`、`generalPurpose` 执行
- **Claude 版**：通过 Claude Code CLI / OMC、`Agent`、`general-purpose` 执行

## 2. 与 Claude 版的关系

可以这样理解：

- **Claude 版 `bmad-story-assistant`**：适配 Claude Code CLI / OMC 的统一入口
- **Cursor 版 `bmad-story-assistant`**：适配 Cursor 运行时的统一入口

二者共享：

- Story 工作流阶段语义
- 审计粒度配置模型
- `config/bmad-story-config.yaml` 配置来源

二者不同：

- 子代理调用工具
- 子代理类型参数
- 规则/技能加载方式

## 3. 审计粒度配置

当前支持三种模式：

- `full`
- `story`
- `epic`

配置优先级如下：

1. CLI / 输入中的 `--audit-granularity=...`
2. 环境变量 `BMAD_AUDIT_GRANULARITY`
3. 项目配置 `config/bmad-story-config.yaml`
4. 默认值 `full`

## 4. 各模式行为

| 模式 | Story创建 | 中间阶段 | 实施后 | Epic审计 |
|------|-----------|----------|--------|----------|
| `full` | 审计 | 全部审计 | 审计 | - |
| `story` | 审计 | 基础验证 | 审计 | - |
| `epic` | 不审计 | 不审计 | 不审计 | 审计 |

### `story` 模式补充

在 `story` 模式下：

- `story_create` / `story_audit` / `post_audit` 继续执行完整审计
- `specify` / `plan` / `gaps` / `tasks` 执行 `basic` 验证
- `implement` 执行 `test_only` 验证

### `epic` 模式补充

在 `epic` 模式下：

- Story 级阶段不执行完整审计
- 中间文档仍然生成
- `implement` 阶段至少保留 `test_only` 验证
- 审计责任转移到 Epic 级阶段

## 5. Cursor 运行时调用方式

Cursor 环境下，子任务调用应使用：

```text
tool: mcp_task
subagent_type: generalPurpose
```

与 Claude 版的对应关系如下：

| 环境 | 工具 | subagent_type |
|------|------|---------------|
| Cursor | `mcp_task` | `generalPurpose` |
| Claude Code CLI | `Agent` | `general-purpose` |

## 6. 配置系统如何接入 Cursor

应通过 `scripts/bmad-config.ts` 读取当前配置，并根据阶段决定是否审计：

- `loadConfig()`
- `getStageConfig(stage)`
- `shouldAudit(stage)`
- `shouldValidate(stage)`
- `getSubagentParams()`

在 Cursor 环境中，`getSubagentParams()` 应解析为：

```text
tool: mcp_task
subagent_type: generalPurpose
```

## 7. 输入示例

### 示例 1：全流程审计

```text
请使用 bmad-story-assistant 启动 E001-S001，并使用 --audit-granularity=full
```

### 示例 2：Story 级轻量审计

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=story
```

### 示例 3：Epic 级审计

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=epic
```

### 示例 4：与继续执行组合

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=story --continue
```

## 8. 你应该看到的关键能力

当 Cursor 版支持正确接入后，应具备以下能力：

- 文档中明确出现 `--audit-granularity`
- 文档中明确出现 `BMAD_AUDIT_GRANULARITY`
- 规则中明确出现 `mcp_task`
- 规则中明确出现 `generalPurpose`
- `story` / `epic` 模式下的中间阶段行为被明确定义

## 9. 相关文档

- [`../README.md`](../README.md)
- [`../claudecode/README.md`](../claudecode/README.md)
- [`../claudecode/bmad-story-assistant.md`](../claudecode/bmad-story-assistant.md)
- [`../../design/audit-granularity-config-design.md`](../../design/audit-granularity-config-design.md)
- [`../../design/cross-platform-compatibility.md`](../../design/cross-platform-compatibility.md)
