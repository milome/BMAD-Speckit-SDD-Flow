# Step 2: Discussion Orchestration and Multi-Agent Conversation (Cursor Override)

## 强制执行规则

- ✅ 你是讨论编排者，不是分批返回式进度汇报器
- ✅ 在 Cursor 中，facilitator-compatible 子代理必须保持单次连续运行
- ✅ 每个有效轮次都必须先输出 `### Round <n>`
- ✅ 每位角色发言都必须使用 `[Icon Emoji] **[展示名]**: [发言内容]`
- ✅ 可见讨论必须遵循 `{communication_language}`

## 讨论编排顺序

### 1. 议题分析

- 分析用户议题、所需能力与目标产出深度
- 为当前轮选择最相关的角色
- 在同一 `session_key` 中保持上下文连续性

### 2. 响应结构

每个有效轮次都必须：

1. 输出 `### Round <n>`
2. 依次输出角色发言：
   `[Icon Emoji] **[展示名]**: [发言内容]`
3. 讨论始终保持在当前 facilitator-compatible 子代理会话内

展示名与图标优先来自 `_bmad/i18n/agent-display-names.yaml`，缺项时回退 `_bmad/_config/agent-manifest.csv`。

### 3. 决策 / 根因模式

当议题属于多方案选一、根因分析或设计辩论时：

- **指定挑战者**：必须且只能选择 1 位 designated challenger，优先 `adversarial-reviewer`
- **第 1 轮必须出场**：挑战者必须在 round 1 发言
- **5 轮窗口覆盖**：每个 5 轮窗口内挑战者至少发言 1 次
- **挑战者占比硬门禁**：`challenger_ratio > 0.60`

### 4. 分层最少轮次

- `quick_probe_20` → `min_rounds = 20`
- `decision_root_cause_50` → `min_rounds = 50`
- `final_solution_task_list_100` → `min_rounds = 100`

若用户请求最终方案 / 最终任务列表 / BUGFIX §7 / Story 定稿，只允许使用 `final_solution_task_list_100`。

### 5. Cursor 连续全程运行规则

在 Cursor 分支中：

- 必须持续在同一 facilitator-compatible 子代理会话中推进，直到 `target_rounds_total`
- 不得在中途进展总结后停止
- 不得在达到最终轮次前把控制权交还主 Agent
- 任何 `current_batch_*` 字段都只视为宿主内部 bookkeeping，不能作为返回边界

### 5a. Cursor 长程紧凑模式

当 `target_rounds_total >= 50` 时，必须为输出预算做紧凑化处理：

- 默认每轮**优先只输出 1 条简短且有实质内容的角色发言**
- 若这样最利于保持轮次连续性，可由 designated challenger 单独代表该轮发言
- 只有在确实需要引入新证据、反驳或综合结论时，才增加第 2 位角色
- 每条发言尽量简短，禁止在中途插入重复 framing、表格或 recap
- 所有扩展总结材料统一推迟到最终轮次之后输出

### 6. Session 真相源与证据

- `session_key` 与 `.meta.json` 由宿主负责
- session log / snapshot / convergence / audit artifacts 由宿主从可见输出重建
- 因此 facilitator 必须保持可见输出结构完整
- facilitator 不得为了写讨论状态而主动申请 shell / write 权限
- 主 Agent 的返回诊断必须从 `_bmad-output/party-mode/runtime/current-session.json` 开始，不能把 `.meta.json`、原始 session log 是否存在、或 capture 文件是否存在当作首要完成判据
- 主 Agent 必须优先读取 `validation_status`、`status`、`target_rounds_total`、`visible_output_summary`、`visible_fragment_record_present`
- 仅因 session log 文件缺失或 capture 文件缺失，**不足以**单独判定 facilitator 未产生有效结果

### 7. 收敛条件

达到最少轮次后，必须同时满足：

1. 已形成单一最终方案或单一共识结论
2. 无“可选”“可考虑”等未决表述
3. 最后 3 轮没有新的 risks / edge cases / 遗漏点
4. 指定挑战者已给出终审陈述

任一条件不满足，都必须继续讨论。

### 8. 最终可见收敛证据块

结束前必须输出一个标题完全固定的可见块：

`## Final Gate Evidence`

并至少包含：

- `- Gate Profile: <gate_profile_id>`
- `- Total Rounds: <n>`
- `- Challenger Ratio Check: PASS|FAIL`
- `- Tail Window No New Gap: PASS|FAIL`
- `- Final Result: PASS|FAIL`

### 9. 退出时机

- 禁止在 `10/50`、`16/50`、`20/50`、`22/50`、`91/100` 这类中途轮次结束
- 只有同一 `session_key` 下的最终收敛证据块已经输出后，才允许结束

## 失败模式

- ❌ 只输出摘要，没有逐轮结构
- ❌ 指定挑战者覆盖不足
- ❌ 未到 `target_rounds_total` 就提前结束
- ❌ 没有 `## Final Gate Evidence` 就声称完成
