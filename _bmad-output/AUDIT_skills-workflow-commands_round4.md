# 第 4 轮审计报告：skills、workflow、commands 验收标准覆盖

**审计日期**：2025-03-09  
**审计轮次**：第 4 轮  
**审计依据**：audit-prompts §5、批判审计员格式、连续 3 轮无 gap 收敛  
**验收标准**：每处须含「每个 US 须独立执行」或「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」及「禁止仅对首个 US 执行 TDD」等价表述  

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 逐项验证结果

### 1. bmad-story-assistant/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-story-assistant\bmad-story-assistant\SKILL.md`  

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 每个 US 须独立执行 / prd 中 involvesProductionCode=true 须独立执行 | 通过 | L866：`对 prd 中每个 involvesProductionCode=true 的 US，必须独立执行一次完整循环`；L872：`prd 中每个 involvesProductionCode=true 的 US 必须**独立**执行一次完整 RED→GREEN→REFACTOR 循环` |
| 禁止仅对首个 US 执行 TDD | 通过 | L866：`禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现`；L878：`**禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现**` |

**结论**：**通过**

---

### 2. speckit-workflow/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\speckit-workflow\speckit-workflow\SKILL.md`  

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 每个 US 须独立执行 / prd 中 involvesProductionCode=true 须独立执行 | 通过 | L375：`**每个 US 必须独立执行**`（等价表述） |
| 禁止仅对首个 US 执行 TDD | 通过 | L375：`禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现` |

**结论**：**通过**

---

### 3. speckit-workflow/references/task-execution-tdd.md

**路径**：`C:\Users\milom\.cursor\skills\speckit-workflow\speckit-workflow\references\task-execution-tdd.md`  

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 每个 US 须独立执行 / prd 中 involvesProductionCode=true 须独立执行 | 通过 | L7：`prd 中每个 involvesProductionCode=true 的 US 必须**独立**执行一次完整循环` |
| 禁止仅对首个 US 执行 TDD | 通过 | L13：`**禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现**` |

**结论**：**通过**

---

### 4. bmad-standalone-tasks/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-standalone-tasks\bmad-standalone-tasks\SKILL.md`  

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 每个 US 须独立执行 / prd 中 involvesProductionCode=true 须独立执行 | 通过 | L75：`**每个 US 须独立执行 RED→GREEN→REFACTOR**` |
| 禁止仅对首个 US 执行 TDD | 通过 | L75：`禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现` |

**结论**：**通过**

---

### 5. bmad-standalone-tasks/references/prompt-templates.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-standalone-tasks\bmad-standalone-tasks\references\prompt-templates.md`  

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 每个 US 须独立执行 / prd 中 involvesProductionCode=true 须独立执行 | 通过 | L25：`**每个 US 须独立执行 RED→GREEN→REFACTOR**` |
| 禁止仅对首个 US 执行 TDD | 通过 | L25：`禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现` |

**结论**：**通过**

---

### 6. bmad-bug-assistant/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-bug-assistant\bmad-bug-assistant\SKILL.md`  

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 每个 US 须独立执行 / prd 中 involvesProductionCode=true 须独立执行 | 通过 | L437：`**每个 US 须独立执行 RED→GREEN→REFACTOR**` |
| 禁止仅对首个 US 执行 TDD | 通过 | L437：`禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现` |

**结论**：**通过**

---

### 7. .cursor/commands/speckit.implement.md

**路径**：`D:\Dev\BMAD-Speckit-SDD-Flow\.cursor\commands\speckit.implement.md`（当前工作区）  

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 每个 US 须独立执行 / prd 中 involvesProductionCode=true 须独立执行 | **未通过** | L121 仅含「Per-US tracking：每完成一个可验收任务…必须立即」，**缺少**「每个 US 须独立执行」或「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」 |
| 禁止仅对首个 US 执行 TDD | **未通过** | **缺少**「禁止仅对首个 US 执行 TDD」或等价表述 |

**grep 证据**：`D:\Dev\BMAD-Speckit-SDD-Flow\.cursor\commands\` 下无匹配。  
**对比**：`D:\Dev\micang-trader-015-indicator-system-refactor\.cursor\commands\speckit.implement.md` 同位置 L121 已包含完整表述，当前工作区版本缺失。

**结论**：**未通过**

---

## 批判审计员结论

**已检查维度**：

| 维度 | 检查内容 | 结论 |
|------|----------|------|
| 表述完整性 | 是否同时包含「每个 US 须独立执行」或「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」 | 6/7 通过；speckit.implement.md 缺失 |
| 禁止表述 | 是否包含「禁止仅对首个 US 执行 TDD」或等价表述 | 6/7 通过；speckit.implement.md 缺失 |
| 路径一致性 | 审计对象路径是否与用户指定一致（skills 全局 + .cursor/commands） | 已验证；当前工作区 .cursor/commands 为 BMAD-Speckit-SDD-Flow |
| 交叉引用 | 各 skill 间是否互相引用并约束一致 | 基本一致；bmad-story-assistant 引用 speckit-workflow；standalone/bug 均自含约束 |
| 可操作性 | 表述是否可被 grep 检索、可解析 | 除第 7 处外均可检索 |

**本轮 gap 结论**：

1. **GAP-7-1**：`D:\Dev\BMAD-Speckit-SDD-Flow\.cursor\commands\speckit.implement.md` 步骤 6 的 Per-US tracking 段落（L121）**缺少**：
   - 「每个 US 须独立执行 RED→GREEN→REFACTOR」或「prd 中每个 involvesProductionCode=true 的 US 必须独立执行一次完整循环」
   - 「禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

2. **修复建议**：将 L121 从  
   `**Per-US tracking**：每完成一个可验收任务（对应 prd 中的一个 US），**必须立即**：`  
   修改为  
   `**Per-US tracking**：**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。每完成一个可验收任务（对应 prd 中的一个 US），**必须立即**：`  
   （对齐 `D:\Dev\micang-trader-015-indicator-system-refactor\.cursor\commands\speckit.implement.md` L121）

---

## 可解析评分块

```yaml
# AUDIT_SCORE_BLOCK
总体评级: C
- 需求完整性: 86/100
- 可测试性: 85/100
- 一致性: 90/100
- 可追溯性: 95/100
```

---

## 审计结论

**未通过**

- 通过项：6/7（bmad-story-assistant、speckit-workflow、task-execution-tdd、bmad-standalone-tasks、prompt-templates、bmad-bug-assistant）
- 未通过项：1/7（.cursor/commands/speckit.implement.md）

**本轮存在 gap，不计数**。须修复第 7 处后再进行第 5 轮审计；连续 3 轮无 gap 后方可收敛。
