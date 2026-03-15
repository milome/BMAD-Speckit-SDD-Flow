# 文档审计迭代规则（spec/plan/GAPS/tasks/TASKS/Story 适用）

本文件定义**文档审计**（被审对象为 spec、plan、IMPLEMENTATION_GAPS、tasks、TASKS、Story 等文档）的迭代与收敛规则。与 [audit-post-impl-rules.md](audit-post-impl-rules.md) 区分：后者适用于**实施后审计**（代码/可运行产物）；本文件适用于**文档审计**。

---

## 1. 核心原则

### 1.1 审计子代理须直接修改被审文档

当审计发现 gap 时，**审计子代理须在本轮内直接修改被审文档**以消除 gap，然后输出审计报告并注明已修改内容。

- **禁止**：仅输出修改建议而不修改文档；或由主 Agent 根据建议修改后再发起审计
- **必须**：审计子代理在发现 gap 后，使用 `search_replace`、`write` 等工具直接修改被审文档，修改完成后再输出审计报告
- **下一轮**：主 Agent 发起下一轮审计时，审计子代理将审计**上一轮修改后的文档**

### 1.2 「3 轮无 gap」针对被审文档

**「连续 3 轮无 gap」** 指**被审文档**连续 3 轮审计均无 gap 发现，而非审计报告本身的质量。

- 若第 N 轮审计发现 gap → 审计子代理修改文档 → 第 N 轮不计数
- 若第 N 轮审计无 gap → 被审文档质量稳定 → `consecutive_pass_count + 1`
- 连续 3 轮无 gap → 被审文档质量收敛 → 可结束审计

### 1.3 迭代流程

```
Round 1: 审计子代理审计文档 → 发现 gap → 审计子代理直接修改文档 → 输出报告（结论：未通过）
Round 2: 审计子代理审计修改后的文档 → 发现 gap → 审计子代理直接修改 → 输出报告（结论：未通过）
...
Round K: 审计子代理审计文档 → 无 gap → 输出报告（结论：通过，本轮无新 gap）
Round K+1: 审计子代理审计同一文档 → 无 gap → 输出报告（结论：通过，本轮无新 gap）
Round K+2: 审计子代理审计同一文档 → 无 gap → 输出报告（结论：通过，本轮无新 gap）
→ 收敛：被审文档连续 3 轮无 gap
```

---

## 2. 适用范围

| 审计对象 | 适用阶段 | 引用 |
|----------|----------|------|
| spec.md | speckit specify 后 | audit-prompts §1 |
| plan.md | speckit plan 后 | audit-prompts §2 |
| IMPLEMENTATION_GAPS.md | speckit GAPS 后 | audit-prompts §3 |
| tasks.md / tasks-E{epic}-S{story}.md | speckit tasks 后 | audit-prompts §4 |
| TASKS_*.md（standalone） | 独立 TASKS 文档审计 | 同 §4 精神 |
| Story 文档 | bmad-story-assistant 阶段二 | STORY-A2-AUDIT |

---

## 3. 与实施后审计的区分

| 项目 | 文档审计 | 实施后审计 |
|------|----------|------------|
| 被审对象 | spec/plan/GAPS/tasks/Story 等文档 | 代码、prd、progress |
| 发现 gap 时谁修改 | **审计子代理**直接修改被审文档 | 主 Agent 委托实施子代理修改代码 |
| 3 轮无 gap 含义 | 被审**文档**连续 3 轮无 gap | 被审**实现**连续 3 轮无 gap |
| 规则文件 | 本文件 | audit-post-impl-rules.md |

---

## 4. 主 Agent 职责

- **发起审计**：将完整审计 prompt（含本规则引用）传入审计子任务
- **检查收敛**：收到报告后，若结论为「通过」且批判审计员注明「本轮无新 gap」，则 `consecutive_pass_count + 1`；若结论为「未通过」，则置 0
- **迭代发起**：未收敛时，发起下一轮审计（审计子代理将审计上一轮修改后的文档）
- **禁止**：主 Agent 不得根据审计报告自行修改被审文档；修改须由审计子代理完成

---

## 5. 引用本文件

在发起 spec/plan/GAPS/tasks/Story 等文档审计时，prompt 须引用本规则，并明确要求审计子代理在发现 gap 时直接修改被审文档。

---

## 6. 报告保存（防死循环）

当 prompt 包含「将完整报告保存至 reportPath」时，须同时包含以下禁止规则，否则 code-reviewer 子代理可能陷入重复输出「正在写入完整审计报告」的死循环：

**禁止**：保存时不得重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入完整内容至指定路径即可，完成后在结论中注明保存路径。

详见 [audit-report-save-rules.md](audit-report-save-rules.md)。
