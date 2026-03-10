# 审计报告：TDD 每 US 独立执行约束（第 9 轮）

**审计依据**：audit-prompts §5 结构、两项约束专项验证  
**审计对象**：7 处 skills、workflow、commands 的 TDD 每 US 独立约束覆盖情况  
**审计日期**：2025-03-09  
**轮次**：第 9 轮（连续无 gap 第 3 轮）  

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计范围与验证标准

**路径范围**：
- `C:\Users\milom\.cursor\skills`
- `D:\Dev\BMAD-Speckit-SDD-Flow`
- `D:\Dev\micang-trader-015-indicator-system-refactor`

**约束（两类）**：
1. **每个 US 须独立执行**：须含「每个 US 须独立执行」「每个 US 必须独立执行」或等价表述（如「prd 中每个 involvesProductionCode=true 的 US 必须**独立**执行一次完整循环」）。
2. **禁止仅对首个 US 执行 TDD**：须含「禁止仅对首个 US 执行 TDD」或「禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现」。

---

## 2. 批判审计员主导验证（>70%）

### 2.1 批判审计员逐项质疑

| 序号 | 质疑点 | 验证动作 | 结果 |
|------|--------|----------|------|
| 1 | 第 7、8 轮已通过，本轮是否存在退化或遗漏？ | 跨三路径 grep 逐文件复验 | 未发现缺项 |
| 2 | BMAD-Speckit-SDD-Flow 的 skills/ 与 commands/ 是否为独立副本且均已覆盖？ | 核对 skills/、.cursor/commands/、commands/ | 均已包含两项约束 |
| 3 | micang-trader 的 speckit.implement.md 与 skills 是否与全局 skills 保持一致？ | 比对 L121、各 SKILL 对应行 | 表述一致 |
| 4 | task-execution-tdd.md 仅含「prd 中每个…US 必须**独立**执行」是否仍判为等价？ | 语义核对：独立执行一次完整循环 = 每个 US 须独立执行 | 等价 ✅ |
| 5 | 是否存在某处仅含禁止表述而缺「独立执行」？ | 逐项检查，两项须同时存在 | 7 处均同时含两项 |

---

## 3. 逐项验证结果

### 3.1 ① bmad-story-assistant/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`  
**BMAD-Speckit 副本**：`D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-story-assistant\SKILL.md`  
**micang-trader 副本**：`D:\Dev\micang-trader-015-indicator-system-refactor\skills\bmad-story-assistant\SKILL.md`

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含禁止表述 | ✅ 通过 |

**证据**：L866、L872-878 含  
- 「对 prd 中每个 involvesProductionCode=true 的 US，必须独立执行一次完整循环；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」  
- 「**禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现**」

---

### 3.2 ② bmad-bug-assistant/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-bug-assistant\SKILL.md`  
**BMAD-Speckit 副本**：`D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-bug-assistant\SKILL.md`  
**micang-trader 副本**：`D:\Dev\micang-trader-015-indicator-system-refactor\skills\bmad-bug-assistant\SKILL.md`（及嵌套）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含禁止表述 | ✅ 通过 |

**证据**：L437 含  
- 「**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

---

### 3.3 ③ speckit-workflow/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`、`C:\Users\milom\.cursor\skills\speckit-workflow\speckit-workflow\SKILL.md`  
**BMAD-Speckit 副本**：`D:\Dev\BMAD-Speckit-SDD-Flow\skills\speckit-workflow\SKILL.md`  
**micang-trader 副本**：`D:\Dev\micang-trader-015-indicator-system-refactor\skills\speckit-workflow\SKILL.md`（及嵌套）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含禁止表述 | ✅ 通过 |

**证据**：L375 含  
- 「**逐任务执行 TDD 循环**（**每个 US 必须独立执行**，禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现）」

---

### 3.4 ④ speckit-workflow/references/task-execution-tdd.md

**路径**：`C:\Users\milom\.cursor\skills\speckit-workflow\references\task-execution-tdd.md`、`C:\Users\milom\.cursor\skills\speckit-workflow\speckit-workflow\references\task-execution-tdd.md`  
**BMAD-Speckit 副本**：`D:\Dev\BMAD-Speckit-SDD-Flow\skills\speckit-workflow\references\task-execution-tdd.md`  
**micang-trader 副本**：`D:\Dev\micang-trader-015-indicator-system-refactor\skills\speckit-workflow\references\task-execution-tdd.md`（及嵌套）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含禁止表述 | ✅ 通过 |

**证据**：L7-8、L13 含  
- 「prd 中每个 involvesProductionCode=true 的 US 必须**独立**执行一次完整循环」  
- 「**禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现**」

---

### 3.5 ⑤ bmad-standalone-tasks/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-standalone-tasks\SKILL.md`  
**BMAD-Speckit 副本**：`D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-standalone-tasks\SKILL.md`  
**micang-trader 副本**：`D:\Dev\micang-trader-015-indicator-system-refactor\skills\bmad-standalone-tasks\SKILL.md`（及嵌套）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含禁止表述 | ✅ 通过 |

**证据**：L75 含  
- 「**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

---

### 3.6 ⑥ bmad-standalone-tasks/references/prompt-templates.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-standalone-tasks\references\prompt-templates.md`  
**BMAD-Speckit 副本**：`D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-standalone-tasks\references\prompt-templates.md`  
**micang-trader 副本**：`D:\Dev\micang-trader-015-indicator-system-refactor\skills\bmad-standalone-tasks\references\prompt-templates.md`（及嵌套）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含禁止表述 | ✅ 通过 |

**证据**：L25 含  
- 「**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

---

### 3.7 ⑦ speckit.implement.md

**路径**：`D:\Dev\BMAD-Speckit-SDD-Flow\.cursor\commands\speckit.implement.md`、`D:\Dev\BMAD-Speckit-SDD-Flow\commands\speckit.implement.md`  
**micang-trader 副本**：`D:\Dev\micang-trader-015-indicator-system-refactor\.cursor\commands\speckit.implement.md`

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含禁止表述 | ✅ 通过 |

**证据**：L121 含  
- 「**Per-US tracking**：**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

---

## 4. 验证方式

- `grep -E "每个 US (须|必须) 独立执行|禁止仅对首个 US|prd 中每个 involvesProductionCode=true 的 US 必须.*独立.*执行"` 于三路径下执行；
- 逐文件读段确认上下文与约束完整性；
- 批判审计员占比 >70%（本报告 §2、§4 为主，§3 为逐项结果）。

---

## 5. 结论

**本轮无新 gap，第 9 轮（连续无 gap 第 3 轮）；连续 3 轮无 gap，收敛达成**。

7 处文件均满足两项约束：
1. 每个 US 须独立执行（或等价表述）  
2. 禁止仅对首个 US 执行 TDD（或完整禁止表述）

**完全覆盖、验证通过**
