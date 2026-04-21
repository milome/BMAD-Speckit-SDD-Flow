# Cursor Runtime Governance Hooks Reference

> **Current path**: `shared hook core + Cursor adapter + registry/activeScope`；post-audit automation 由 `runAuditorHost` 承接
> **Legacy path**: Cursor 侧各自猜状态，或把 post-audit 收口混进宿主 hooks 逻辑

## 1. 目的

本文档定义 Runtime Governance 在 **Cursor 宿主**上的正式 hooks 参考协议。

它回答五个问题：

1. Cursor 侧到底交付哪些运行时文件
2. `.cursor/hooks.json` 应该长什么样
3. 每个 hooks 事件调用哪个 command
4. command 的 stdin / stdout 契约是什么
5. Cursor native hooks 与 Claude hooks / third-party hooks 的关系是什么

本文档是 Cursor Runtime Governance 自动注入方案的 **reference 文档**，与以下文档配套：

- [runtime-policy-emit-schema.md](./runtime-policy-emit-schema.md)
- [runtime-context.md](./runtime-context.md)
- [../how-to/runtime-governance-auto-inject-cursor-claude.md](../how-to/runtime-governance-auto-inject-cursor-claude.md)
- [../plans/TASKS_RUNTIME_GOVERNANCE_AUTO_INJECT.md](../plans/TASKS_RUNTIME_GOVERNANCE_AUTO_INJECT.md)
- [../plans/2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md](../plans/2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md)

---

## 2. 正式宿主结论

### 2.1 Cursor 已具备所需核心能力

基于当前官方能力核证，Cursor 已具备 Runtime Governance 落地所需的核心 hooks 能力，包括：

- command hooks
- stdio JSON 输入/输出
- `preToolUse`
- `subagentStart`
- `matcher`
- `failClosed`
- `sessionStart.additional_context`
- `postToolUse.additional_context`
- third-party hooks
- Claude-compatible hooks 加载路径

因此，Cursor 不再被定义为“只能复制脚本、不能自动挂载”。

### 2.2 主路径与兼容路径

Runtime Governance 在 Cursor 宿主上的正式路径定义如下：

- **主路径**：项目级 native hooks 文件 **`.cursor/hooks.json`**
- **兼容路径**：third-party hooks / Claude-compatible hooks
- **手工路径**：用户手工在 Cursor UI 注册 command hooks

只有主路径是正式默认方案。

third-party hooks 与手工 UI 注册都不是主推荐方案。

补充边界：

- Cursor hooks 负责 **执行前/执行中** 的治理注入与门控
- 审计通过后的 scoring 写入、auditIndex 更新与其它 post-audit automation **不** 由 hooks 自己串联，统一由 `runAuditorHost` 承接

---

## 3. Cursor 宿主交付物

### 3.1 init 后必须落盘的文件

当执行：

- `npx bmad-speckit init . --ai cursor-agent`
- 或等价 install / sync / init 路径

目标项目中必须存在以下交付物：

- `.cursor/hooks.json`
- `.cursor/hooks/emit-runtime-policy-cli.js`
- `.cursor/hooks/runtime-policy-inject.js`
- `.cursor/hooks/emit-runtime-policy.cjs`
- `.cursor/hooks/write-runtime-context.js`

### 3.2 这些文件的职责

| 文件                                       | 职责                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `.cursor/hooks.json`                       | Cursor native hooks 配置入口；负责把事件挂到本地命令                                  |
| `.cursor/hooks/emit-runtime-policy-cli.js` | 轻量 CLI 包装器；调用 `emit-runtime-policy` 并输出稳定 JSON                           |
| `.cursor/hooks/runtime-policy-inject.js`   | Cursor hook command 主入口；读取 hook stdin，调用 emit，并输出 Cursor-native envelope |
| `.cursor/hooks/emit-runtime-policy.cjs`    | hooks 可直接调用的运行时构建产物                                                      |
| `.cursor/hooks/write-runtime-context.js`   | 写 runtime context 文件；供 init / 编排 / 调试使用                                    |

### 3.3 缺失判定

若 init 后出现以下任一情况，Cursor Runtime Governance 自动注入视为 **未完整交付**：

- 不存在 `.cursor/hooks.json`
- `.cursor/hooks.json` 不包含 Runtime Governance 事件注册
- `.cursor/hooks/*.js` 存在，但没有任何 native hooks config 指向它们

---

## 4. 治理内核与宿主适配层

### 4.1 单一治理内核

Cursor 与 Claude 必须共用同一个治理内核：

- 同一个 `resolveRuntimePolicy`
- 同一个 `emit-runtime-policy`
- 同一个 RuntimePolicy schema
- 同一个 runtime context 输入模型

### 4.3 hooks 三层结构（当前实现）

当前 hooks 目录已经演进为三层：

- `_bmad/runtime/hooks/`：shared canonical logic
- `_bmad/claude/hooks/`：Claude adapter
- `_bmad/cursor/hooks/`：Cursor adapter

shared 层当前已承载：

- `runtime-policy-inject-core.js`
- `run-emit-runtime-policy.js`
- `should-skip-runtime-policy.js`
- `build-runtime-error-message.js`

部署规则：

- `.claude/hooks/` ← shared + Claude adapter
- `.cursor/hooks/` ← shared + Cursor adapter（缺失时才 fallback Claude adapter）

因此，shared 逻辑不再以 `_bmad/claude/hooks/` 作为唯一源目录。

### 4.4 宿主适配层允许不同

宿主适配层可以不同，包括：

- hooks 配置文件形态
- 事件名集合
- stdout envelope 字段
- fail-open / fail-closed 行为写法

所以“双宿主一致”不是要求 `.claude/settings.json` 与 `.cursor/hooks.json` 同构。

“双宿主一致”只要求：

1. 输入到治理求值器的是同一类上下文
2. 产出的 policy 内容来自同一求值源
3. 注入到模型侧的治理语义一致

---

## 5. `.cursor/hooks.json` 目标结构

### 5.1 最低事件集合

Runtime Governance 的 Cursor native hooks 最低必须覆盖：

- `preToolUse`
- `subagentStart`

若本轮实现选择会话级主注入，则还必须覆盖：

- `sessionStart`

### 5.2 事件职责分工

| 事件            | 职责                                                  |
| --------------- | ----------------------------------------------------- |
| `sessionStart`  | 会话级基础 policy 注入；适合使用 `additional_context` |
| `preToolUse`    | 工具调用前门控、参数改写、校验；不是首选主注入通道    |
| `subagentStart` | 子代理启动前补注入；确保 subagent 也收到治理上下文    |
| `postToolUse`   | 可选补充注入通道；适合在工具结果后追加上下文          |

### 5.3 推荐优先级

Cursor Runtime Governance 推荐的注入优先级如下：

1. `sessionStart.additional_context`
2. `subagentStart` 的上下文补注入
3. `postToolUse.additional_context`
4. `preToolUse` 的 deny / `agent_message` / `updated_input` 只作为补充

### 5.4 推荐目标形态

下例是 **目标结构示意**，用于冻结配置方向，不代表当前仓库已全部实现：

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "matcher": "*",
        "timeout": 8000,
        "failClosed": true,
        "command": "node .cursor/hooks/runtime-policy-inject.js --cursor-host --session-start"
      }
    ],
    "preToolUse": [
      {
        "matcher": "Agent|Task",
        "timeout": 8000,
        "failClosed": true,
        "command": "node .cursor/hooks/runtime-policy-inject.js --cursor-host"
      }
    ],
    "subagentStart": [
      {
        "matcher": "*",
        "timeout": 8000,
        "failClosed": true,
        "command": "node .cursor/hooks/runtime-policy-inject.js --cursor-host --subagent-start"
      }
    ]
  }
}
```

### 5.5 配置要求

`.cursor/hooks.json` 必须满足：

- 根级 `version` 为 **数字**（例如 `1`），不能是字符串
- 事件名使用 Cursor 约定的 **camelCase**（如 `sessionStart`、`preToolUse`），与 Claude Code `settings.json` 中的 PascalCase 事件名不同
- command 使用项目内相对路径或稳定本地路径
- timeout 固定可文档化
- matcher 固定可测试
- failClosed 策略固定可测试
- 事件与 command 的映射关系稳定，不靠 UI 手工记忆

---

## 6. Event → Command 映射

### 6.1 `sessionStart`

**用途**：在会话开始时注入 Runtime Governance 基础上下文。

**推荐 command**：

```bash
node .cursor/hooks/runtime-policy-inject.js --cursor-host --session-start
```

**输入来源**：Cursor hook stdin JSON。

**输出目标**：`additional_context`。

### 6.2 `preToolUse`

**用途**：在工具调用前执行治理校验、必要门控、必要参数改写。

**推荐 command**：

```bash
node .cursor/hooks/runtime-policy-inject.js --cursor-host
```

**输入来源**：Cursor hook stdin JSON，至少包含：

- `tool_name`
- `tool_input`
- `cwd`
- `agent_message`（若 Cursor 当前事件提供）

**输出目标**：

- `permission`
- `updated_input`
- `agent_message`
- 或错误反馈

### 6.3 `subagentStart`

**用途**：在子代理启动前补注入治理上下文，避免只有主代理收到 policy。

**推荐 command**：

```bash
node .cursor/hooks/runtime-policy-inject.js --cursor-host --subagent-start
```

**输入来源**：Cursor hook stdin JSON，通常包括：

- `subagent_id`
- `subagent_type`
- `task`
- `subagent_model`
- `is_parallel_worker`

**输出目标**：

- 子代理上下文附加信息
- `permission`
- `user_message`
- 或错误反馈

### 6.4 `postToolUse`

**用途**：如果主设计采用结果后追加，则用它补充 `additional_context`。

**推荐 command**：

```bash
node .cursor/hooks/runtime-policy-inject.js --cursor-host --post-tool-use
```

这不是当前主设计的首选路径，但文档保留该定位，避免未来重复设计。

---

## 7. Command stdin 契约

### 7.1 总原则

Cursor hooks command 必须从 **stdin** 读取宿主事件 JSON。

`runtime-policy-inject.js` 不能假定只靠 CLI 参数就能完成上下文推导。

CLI 参数只用于声明宿主模式和事件模式，例如：

- `--cursor-host`
- `--session-start`
- `--subagent-start`
- `--post-tool-use`

### 7.2 输入分层

输入必须被分为三层：

1. **宿主事件输入**：来自 Cursor hook stdin JSON
2. **运行时上下文输入**：来自 registry `activeScope` 指向的 scoped context file，或来自 CLI/env 直接提供的 `flow`/`stage`
3. **治理求值输入**：传给 `resolveRuntimePolicy()` 的标准字段

### 7.3 运行时上下文补全规则

Runtime Governance 在 Cursor 宿主下依旧遵循统一 context 规则：

- 只使用 registry + activeScope + scoped context file
- 缺失显式运行时上下文时，不再回退到 `.bmad/runtime-context.json`
- 不再读取任何已移除的 speckit fallback 输入
- 并发 / story-scoped 模式下缺少显式上下文必须直接失败

详细规则见：

- [runtime-context.md](./runtime-context.md)

---

## 8. Command stdout 契约

### 8.1 不能复用 Claude envelope

Cursor host 下，`runtime-policy-inject.js --cursor-host` **不能**输出 Claude 专用 envelope，例如：

- `systemMessage`
- `hookSpecificOutput.additionalContext`

然后把它当成 Cursor 兼容输出。

这会造成：

- 宿主协议不明确
- 测试无法冻结真实 Cursor 语义
- 文档与官方能力不一致

### 8.2 Cursor-native 输出要求

Cursor host 下必须输出 **Cursor-native hook JSON**。

根据事件不同，允许的目标字段不同：

| 事件            | 允许/推荐输出                                      |
| --------------- | -------------------------------------------------- |
| `sessionStart`  | `additional_context`                               |
| `preToolUse`    | `permission`、`updated_input`、`agent_message`     |
| `subagentStart` | `permission`、`user_message`、子代理上下文相关字段 |
| `postToolUse`   | `additional_context`                               |

### 8.3 Runtime Governance 推荐语义

推荐把 Runtime Governance 输出语义分成三类：

1. **注入类**
   - 把稳定 JSON policy 追加进 `additional_context`
2. **门控类**
   - 用 `permission` / deny 阻断不允许的动作
3. **说明类**
   - 用 `agent_message` / `user_message` 告知治理原因

### 8.4 失败响应

若 `emit-runtime-policy` 失败：

- command 必须返回明确错误语义
- 不允许输出伪完整 policy
- 是否阻断由 `failClosed` 与事件策略共同决定

---

## 9. `runtime-policy-inject.js` 的宿主分叉要求

### 9.1 Claude 路径

Claude 路径保持：

- Claude 官方 hooks envelope
- `systemMessage`
- `hookSpecificOutput.additionalContext`

### 9.2 Cursor 路径

Cursor 路径必须：

- 通过 `--cursor-host` 进入宿主分支
- 输出 Cursor-native hook JSON
- 不依赖 Claude 输出字段名

### 9.3 分叉原则

分叉只允许发生在 **宿主 envelope 层**。

不允许在以下层面分叉成两套逻辑：

- `resolveRuntimePolicy()`
- `emit-runtime-policy`
- RuntimePolicy schema
- story-scoped context 解释规则

---

## 10. failClosed、timeout、matcher 策略

### 10.1 timeout

Runtime Governance hooks timeout 固定为：

- **8s**

该值必须在：

- `.cursor/hooks.json`
- how-to
- 测试说明

三处保持一致。

### 10.2 matcher

matcher 必须明确、可测试、不可依赖用户记忆。

推荐最低要求：

- `preToolUse`：覆盖 Agent / Task 路径
- `subagentStart`：覆盖所有子代理启动事件
- `sessionStart`：全量匹配

### 10.3 failClosed

Runtime Governance 默认策略应为：

- **关键注入与关键门控路径 failClosed**

理由：

- 治理链路失败时不应假装成功
- 不应在无 governance context 的情况下静默继续

但具体到事件层，可按如下规则固定：

| 事件            | 建议策略                             |
| --------------- | ------------------------------------ |
| `sessionStart`  | `failClosed: true`                   |
| `preToolUse`    | `failClosed: true`                   |
| `subagentStart` | `failClosed: true`                   |
| `postToolUse`   | 可与主方案一致，但不得与 how-to 冲突 |

---

## 11. Native 与兼容路径的切换条件

### 11.1 必须先尝试 native

只要 Cursor 宿主支持项目级 `.cursor/hooks.json`，就必须优先使用 native hooks。

### 11.2 允许兼容路径的条件

只有以下条件成立时，才允许使用兼容路径：

1. Cursor 当前版本不支持项目级 hooks.json
2. 企业/团队策略接管 hooks 配置
3. 用户显式要求改走 third-party hooks / Claude-compatible hooks

### 11.3 兼容路径的边界

兼容路径只改变 **宿主挂载方式**，不能改变：

- policy 求值源
- emit 输出 schema
- runtime context 语义
- story-scoped 隔离规则

---

## 12. 与并发治理的关系

Cursor hooks 只是宿主挂载层。

并发安全不由 hooks.json 本身保证，而由以下机制共同保证：

- story-scoped runtime context
- runId / storyId 幂等键
- emit 在并发模式下禁用共享 context 旧路径依赖
- score/state 顺序与去重规则

因此，Cursor hooks 参考文档必须与总实施任务书保持一致：

- [../plans/2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md](../plans/2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md)

---

## 13. 测试与核证要求

Cursor Runtime Governance hooks 方案至少需要以下测试：

1. `.cursor/hooks.json` 生成测试
2. `.cursor/hooks.json` schema / event / command 测试
3. `runtime-policy-inject.js --cursor-host` 输出语义测试
4. init / install / sync 集成测试
5. dual-host parity 测试

当 reference 文档与测试不一致时：

- 以官方能力 + 已通过测试的实现为准
- 然后必须回写本文档

---

## 14. 与其他文档的边界

| 文档                                                                          | 作用                                  |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| `runtime-policy-emit-schema.md`                                               | 定义 emit 本体输出契约                |
| `runtime-context.md`                                                          | 定义 runtime context 输入契约         |
| `runtime-governance-auto-inject-cursor-claude.md`                             | 给使用者的 how-to                     |
| `TASKS_RUNTIME_GOVERNANCE_AUTO_INJECT.md`                                     | 自动注入专项任务书                    |
| `2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md` | 总实施任务书                          |
| **本文档**                                                                    | 专门定义 Cursor native hooks 参考协议 |

---

## 15. 当前目标态总结

Cursor 宿主对 Runtime Governance 的正式目标态是：

1. init 自动生成 `.cursor/hooks.json`
2. `.cursor/hooks.json` 自动挂接 `runtime-policy-inject.js --cursor-host`
3. `runtime-policy-inject.js --cursor-host` 输出 Cursor-native hook JSON
4. policy 内容仍来自统一的 `emit-runtime-policy`
5. third-party hooks / Claude-compatible hooks 仅保留为兼容路径

只要这五点没有同时成立，就说明 Cursor Runtime Governance 仍未完全达到正式自动注入目标态。
