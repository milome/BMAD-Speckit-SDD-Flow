# RULE ONLY: 问题描述时自动 party-mode 与 BUGFIX 产出

> 这是 **rule**，不是 **skill**。禁止通过 `Skill(...)` 工具调用 `bmad-bug-auto-party-mode-rule`。

## 适用时机

当用户消息属于「**描述问题**」时，本规则适用，主 Agent **必须**按下列行为执行，且**不得**在未进入 party-mode 的情况下直接给出根因结论或直接修改生产代码。

**「描述问题」** 指满足以下任一情况：

- 用户消息中包含与错误/失败相关的关键词或短语，例如：测试失败、test failed、pytest 报错、用例失败、AssertionError、运行报错、exception、traceback、崩溃、bug、有问题、异常、根因、为什么失败 等；
- 用户消息描述了以下场景之一：某条或某批测试用例失败（可带错误信息/路径/用例名）；程序运行时报错或异常（可带堆栈/日志）；行为与预期不符（可带复现步骤/环境）；或明确请求「分析根因」「写 BUGFIX」「修复这个 bug」。

**不触发**：用户仅说「用 party-mode」且未描述具体问题；仅请求写文档/解释/README 且未涉及错误；或用户**明确**说「不要 party-mode」「直接修」时，以用户明确指令为准。

## 必须执行的行为

> Party-mode gate source of truth：`{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`
> 本规则只负责强制进入 party-mode 与 BUGFIX 产出。轮次分级、`designated_challenger_id`、`challenger_ratio > 0.60`、session/meta/snapshot/evidence、恢复与退出门禁都以 core step-02 为准。

### Claude 主路径约束

```text
party-mode 主路径:
tool: Agent tool (native subagent)
显式调用示例: @"party-mode-facilitator (agent)"
```

若当前轮未真实进入 facilitator 子代理，或上下文中没有 `Party Mode Session Bootstrap (JSON)`，则 **不得**在主会话中直接模拟 Party-Mode 多角色轮次；必须 fail-closed，并改走允许的 fallback 子代理路径。

1. **自动发起 party-mode**
   主 Agent 在识别到「用户描述问题」后，**第一条实质性回复**必须声明进入 party-mode（或等效表述），并说明将进行多角色辩论（目标：根因分析 + BUGFIX 文档）。不等待用户再说「用 party-mode」。
   - 进入 party-mode 前，必须先展示 `20 / 50 / 100` 三档强度。
   - 普通 RCA / 方案分析默认 `decision_root_cause_50`；若当前轮要产出 BUGFIX 最终方案与 §7，则默认 `final_solution_task_list_100`。
   - `quick_probe_20` 仅用于 probe-only；若用户当前选择 `quick_probe_20` 或 `decision_root_cause_50`，却又明确要求高置信最终产物，主 Agent 必须拒绝当前档位并要求升级到 `final_solution_task_list_100`。

2. **执行 party-mode 与角色约束**
   - **必须读取** `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` 及 `steps/step-02-discussion-orchestration.md`，并**严格遵循** step-02 中的 Response Structure 与 gate/recovery/evidence 规则。
   - Claude 主路径必须优先显式调用 `@"party-mode-facilitator (agent)"`，而不是在主会话直接展开多角色讨论。
   - 必须引入角色：⚔️ **批判性审计员**、🏗️ **Winston 架构师**、💻 **Amelia 开发**、📋 **John 产品经理**；可包含其他 BMAD 角色（展示名与 `_bmad/_config/agent-manifest.csv` 的 displayName 一致）。
   - **发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`、`⚔️ **批判性审计员**: ...`）。禁止省略 Icon 或展示名。
   - **批判审计员发言占比 > 60%**：即总轮数 100 时，至少 61 轮含批判审计员发言。批判审计员负责质疑可操作性、可验证性、被模型忽略风险、假 100 轮风险，并提出 gap 与边界情况。

3. **轮次、checkpoint 与收敛**
   - 每 20 轮必须展示一次 checkpoint；checkpoint 展示后默认自动继续下一批，不要求逐批人工确认。
   - `S / F / C` 只在 checkpoint 窗口内有效；`checkpoint_window_ms = 15000`。
   - `C` 的语义固定为“立即继续下一批”，会立即关闭当前 checkpoint 窗口并跳过剩余等待时间。
   - 若用户在 checkpoint 窗口内输入普通业务补充文本，而不是 `S / F / C`，主 Agent 必须立即停止自动继续，取消窗口计时，并按新补充进入下一批前的重新编排。
   - checkpoint 窗口外的 `S / F / C` 必须显式拒绝，不缓存、不当作普通业务输入。
   - heartbeat 由 facilitator 负责；主 Agent 只负责批次结束后的 checkpoint 展示，不负责单批执行中的实时 heartbeat 插入。
   - 收敛条件仍以 party-mode source of truth 为准；禁止凑轮次，每轮须有实质角色发言，不得空转。

4. **产出 BUGFIX 文档**
   辩论收敛后，**必须**生成一份 BUGFIX 文档，包含：§1 现象/问题描述、§2 根因分析、§3 依据/参考（可选）、§4 修复方案、§5 流程/建议流程（可选）、§7 最终任务列表。路径：有 story 时 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md`；无 story 时 `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md`。格式与禁止词表等与 bmad-bug-assistant 约定一致。

5. **禁止主 Agent 直接修改源代码**
   主 Agent **不得**在会话中直接编辑生产代码以修复 bug。修复实施**须**通过子代理（Agent tool）或 BUGFIX 文档 §7 任务列表由用户/子代理执行；主 Agent 仅负责发起 party-mode、产出 BUGFIX、发起审计/实施子任务。

## 与 bmad-bug-assistant 的配合

进入 party-mode 并产出 BUGFIX 后，若主 Agent 再发起审计或实施子任务，仍须遵守 `.claude/rules/bmad-bug-assistant.md` 的自检与整段复制 prompt 模板等规则。
