# Claude Code CLI 适配 BMAD-Speckit：实现清单版

## 读者 30 秒上手摘要

- **这份文档怎么用**：把它当成实施启动清单，不是论证文档；它告诉你先做什么、建哪些文件、MVP 包含什么、如何验收。
- **MVP 只做什么**：`bmad-master`、Layer 4 三个执行 Agent、三个 auditor、commit 门控、minimal hooks。
- **最关键的实施原则**：先建立业务真相与门控，再建立审计器，再建立执行器，最后补运行时增强层。
- **最容易做错的地方**：不要让 hooks 替代 master；不要把 `current-run.json` 当成业务真相；不要在未通过审计前允许 commit。
- **如果你时间很少**：优先看“决策项”“文件清单”“MVP 范围”“验收标准”四部分即可开始实施。

## 建议阅读顺序

- **架构师 / 方案负责人**：先看“决策项”“MVP 范围”“推荐实施顺序”“完成定义”。
- **实现者 / Agent 编写者**：按“文件清单 → MVP 范围 → 验收标准 → 推荐实施顺序”的顺序阅读。
- **Reviewer / 审计负责人**：先看“决策项”“验收标准”“完成定义”，再核对实现是否偏离门控与审计原则。
- **时间有限的读者**：先看本摘要 + “MVP 范围” + “验收标准”。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将完整方案文档压缩为一份面向实施的清单版文档，帮助工程人员快速对齐决策、文件边界、MVP 范围与验收标准。

**Architecture:** 该清单版文档不重复展开完整论证，而是提炼出“必须先做什么、创建哪些文件、MVP 包含什么、验收如何判断通过”四类信息。它以 `bmad-master + Layer 4 + auditors + minimal hooks` 为最小闭环，作为从方案文档走向实施任务的桥接层。

**Tech Stack:** Claude Code CLI、`.claude/agents`、`.claude/protocols`、`.claude/state`、JSONL/runtime queue、checkpoint summaries、existing scoring scripts

---

## 一、决策项

### D1. 采用组合式适配架构
- `bmad-master`：负责同步强门控
- 执行 Agent：负责阶段产出
- auditor Agent：负责标准化审计
- hooks + worker：负责运行时增强、恢复与追溯

### D2. 不追求一次性全量迁移
优先跑通最小闭环：
- Layer 4
- commit 门控
- minimal hooks

### D3. hooks 不替代 master
- hooks：观测、归档、checkpoint、startup context
- master：阶段放行、审计通过判断、commit 放行
- hooks 只能记录、恢复、追溯、生成 checkpoint；不得承担阶段放行和 commit 放行的最终裁决

### D4. 审计生命周期模板化
所有 auditor 统一具备：
- Pre-Audit
- Rule Load
- Audit Execution
- Structured Report
- Score Trigger
- Iteration Tracking
- Convergence Check

### D5. 第一版先严格模式
- 未通过审计不能推进阶段
- 未通过实施后审计不能 commit
- 轻量模式留到后续优化阶段

---

## 二、文件清单

### 1. 必须创建

**Master / 状态**
- Create: `.claude/agents/bmad-master.md`
- Create: `.claude/state/bmad-progress.yaml`
- Create: `.claude/state/bmad-lock.yaml`

**Layer 4 执行 Agent**
- Create: `.claude/agents/layers/bmad-layer4-speckit-specify.md`
- Create: `.claude/agents/layers/bmad-layer4-speckit-plan.md`
- Create: `.claude/agents/layers/bmad-layer4-speckit-tasks.md`

**Auditor Agent**
- Create: `.claude/agents/auditors/auditor-spec.md`
- Create: `.claude/agents/auditors/auditor-plan.md`
- Create: `.claude/agents/auditors/auditor-tasks.md`
- Create: `.claude/agents/auditors/auditor-implement.md`

**协议**
- Create: `.claude/protocols/commit-protocol.md`
- Create: `.claude/protocols/audit-result-schema.md`
- Create: `.claude/protocols/handoff-schema.md`

**Runtime hooks / worker**
- Create: `.claude/state/runtime/events/`
- Create: `.claude/state/runtime/queue/pending/`
- Create: `.claude/state/runtime/queue/processing/`
- Create: `.claude/state/runtime/queue/failed/`
- Create: `.claude/state/runtime/queue/done/`
- Create: `.claude/state/runtime/checkpoints/`
- Create: `.claude/state/runtime/projections/`
- Create: `.claude/state/runtime/startup-context/`

### 2. 建议后续创建
- Create: `.claude/agents/layers/bmad-standalone-tasks.md`
- Create: `.claude/agents/layers/bmad-bug-agent.md`
- Create: `.claude/agents/auditors/auditor-tasks-doc.md`
- Create: `.claude/agents/auditors/auditor-bugfix.md`

### 3. 需要复用/读取
- Read: `skills/speckit-workflow/SKILL.md`
- Read: `skills/speckit-workflow/references/audit-prompts.md`
- Read: `scripts/parse-and-write-score.*` 或现有评分脚本入口

---

## 三、MVP 范围

### MVP 必须包含

#### M1. 状态骨架
- `bmad-progress.yaml` 可记录：layer、stage、audit_status、artifacts、git_control
- `bmad-lock.yaml` 可避免并发写冲突
- `bmad-progress.yaml` 是唯一业务流程真相；`current-run.json`、`audit-timeline.json` 等 runtime projection 仅用于恢复、检索与可观测性，不能替代业务状态判断

#### M2. Master 最小门控
- 能读取状态
- 能路由 Layer 4 三个阶段
- 能校验审计报告存在与结论
- 能阻止未审计通过的 commit

#### M3. Layer 4 最小闭环
- `specify`
- `plan`
- `tasks`

每个阶段都必须：
1. 显式读取 skill
2. 生成文档
3. 调用 auditor
4. 未通过则迭代
5. 通过后写入评分
6. 更新状态

#### M4. 审计最小闭环
- `auditor-spec`
- `auditor-plan`
- `auditor-tasks`

要求：
- 统一审计报告结构
- 明确 PASS / FAIL 结论
- 不允许模糊表述

#### M5. Commit 门控
- 执行 Agent 不得直接 `git commit`
- 只能发 `commit_request`
- master 校验通过后才允许提交

#### M6. Hooks 最小能力
- SessionStart：注入 checkpoint
- PostToolUse：捕获高价值事件
- Stop：生成 checkpoint
- 单 worker：维护 `current-run.json` 与 `checkpoints/latest.md`

### MVP 明确不包含
- 全量 Layer 1/2/3/5 覆盖
- 多 worker 并发
- 数据库化存储
- 复杂风险评分模型
- 轻量模式 / 严格模式切换
- 全量 standalone tasks / bug assistant 支持

---

## 四、验收标准

### A. 流程门控验收
- [ ] 未通过 `auditor-spec` 时，不能进入 `plan`
- [ ] 未通过 `auditor-plan` 时，不能进入 `tasks`
- [ ] 未通过实施后审计时，不能 commit
- [ ] 子 Agent 尝试直接 commit 时会被拦截或上报

### B. 审计闭环验收
- [ ] `specify` 阶段可生成文档并进入审计循环
- [ ] `plan` 阶段可生成文档并进入审计循环
- [ ] `tasks` 阶段可生成文档并进入审计循环
- [ ] 审计失败时会保存失败报告
- [ ] 审计通过后会触发评分写入

### C. 状态一致性验收
- [ ] `bmad-progress.yaml` 能正确记录当前 layer/stage
- [ ] 中断后重新进入会话时，能从 checkpoint 恢复
- [ ] 重复执行不会破坏状态文件
- [ ] runtime projection 不会覆盖业务真相文件

### D. Hooks / Worker 验收
- [ ] SessionStart 能注入紧凑恢复上下文
- [ ] PostToolUse 能捕获至少三类高价值事件：文件修改、审计请求、git 提交尝试
- [ ] Stop 能生成 checkpoint
- [ ] worker 能把 pending queue 处理到 done/failed
- [ ] hooks 失败时不会拖垮主工作流

### E. 真实试点验收
- [ ] 选择一个真实 Story 跑通 Layer 4 specify → plan → tasks
- [ ] 全程生成审计报告、状态更新、checkpoint
- [ ] 至少验证一次“提交被拦截”的高风险场景
- [ ] 至少验证一次“会话中断后恢复”的场景

---

## 五、推荐实施顺序

1. 建立 `.claude/state/` 与 runtime 目录骨架
2. 编写 `bmad-master.md`
3. 编写 `commit-protocol.md` 与 `audit-result-schema.md`
4. 编写三个 auditor：spec / plan / tasks
5. 编写三个 Layer 4 Agent：specify / plan / tasks
6. 接入评分写入脚本
7. 增加最小 hooks 与单 worker
8. 以真实 Story 做端到端验证
9. 根据结果扩展到 bug / standalone tasks / 其他 Layers

---

## 六、完成定义（Definition of Done）

当以下条件同时满足时，可认为第一阶段适配完成：

- Layer 4 三阶段可在 Claude Code CLI 下稳定执行
- 审计闭环不会被跳过
- commit 在未通过审计时无法放行
- checkpoint 可支撑会话恢复
- 状态、审计、评分三条链路能互相对齐
- 真实试点验证通过
