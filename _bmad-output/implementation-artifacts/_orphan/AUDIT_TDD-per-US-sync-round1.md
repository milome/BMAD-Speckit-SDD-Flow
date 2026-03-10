# 审计报告：TDD 每 US 独立执行约束同步更新

**审计依据**：audit-prompts §5 结构、audit-prompts-critical-auditor-appendix、连续 3 轮无 gap 收敛要求  
**审计对象**：7 处 skills、workflow、commands 的 TDD 每 US 独立约束覆盖情况  
**审计日期**：2025-03-09  
**轮次**：第 1 轮  

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit |

---

## 1. 逐项验证结果

### 1.1 skills/bmad-story-assistant/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-story-assistant\bmad-story-assistant\SKILL.md`（规范主文件）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含「每个 US 须独立执行」或等价表述 | ✅ 通过 |
| 禁止仅对首个 US 执行 | 须含「禁止仅对首个 US 执行 TDD」 | ✅ 通过 |

**证据**：第 589-594 行、第 593-600 行含：
- 「对 prd 中每个 involvesProductionCode=true 的 US，必须独立执行一次完整循环；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」
- 「prd 中每个 involvesProductionCode=true 的 US 必须**独立**执行一次完整 RED→GREEN→REFACTOR 循环」
- 「**禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现**」

---

### 1.2 skills/speckit-workflow/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\speckit-workflow\speckit-workflow\SKILL.md`（规范主文件；根 SKILL.md 为 "x" 占位）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 必须独立执行 | 须含「每个 US 必须独立执行」 | ✅ 通过 |
| 禁止表述 | 须含「禁止仅对首个 US」等禁止表述 | ✅ 通过 |

**证据**：第 375 行 §5.1 执行流程含：
- 「**逐任务执行 TDD 循环**（**每个 US 必须独立执行**，禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现）」

---

### 1.3 skills/speckit-workflow/references/task-execution-tdd.md

**路径**：存在两处，内容不一致。

| 路径 | 要求「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」 | 验证结果 |
|------|------------------------------------------------------------------|----------|
| `speckit-workflow/speckit-workflow/references/task-execution-tdd.md` | 须含完整表述 | ✅ 通过 |
| `speckit-workflow/references/task-execution-tdd.md` | 同上 | ❌ **GAP** |

**GAP 详情**：  
`speckit-workflow/references/task-execution-tdd.md`（根 references）当前为：
- 「**【TDD 红绿灯阻塞约束】** 每个涉及生产代码的**任务**执行顺序为：」

缺少「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」表述。  
嵌套路径 `speckit-workflow/speckit-workflow/references/` 版本已含正确表述。

---

### 1.4 skills/bmad-standalone-tasks/SKILL.md

**路径**：存在两处，根与嵌套内容不一致。

| 路径 | 要求「每个 US 须独立执行 RED→GREEN→REFACTOR」 | 验证结果 |
|------|-----------------------------------------------|----------|
| `bmad-standalone-tasks/bmad-standalone-tasks/SKILL.md` | 须含 | ✅ 通过 |
| `bmad-standalone-tasks/SKILL.md` | 须含 | ❌ **GAP** |

**GAP 详情**：  
根路径 `bmad-standalone-tasks/SKILL.md` 第 75-76 行为：
- 「**TDD 红绿灯**：每个 US 执行前先写/补测试（红灯）→ 实现使通过（绿灯）→ 重构。」
- 无「**每个 US 须独立执行 RED→GREEN→REFACTOR**」
- 无「禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

 nested 版本已含完整约束。

---

### 1.5 skills/bmad-standalone-tasks/references/prompt-templates.md

**路径**：存在两处，根与嵌套内容不一致。

| 路径 | 要求「每个 US 须独立执行 RED→GREEN→REFACTOR」 | 验证结果 |
|------|-----------------------------------------------|----------|
| `bmad-standalone-tasks/bmad-standalone-tasks/references/prompt-templates.md` | 须含 | ✅ 通过 |
| `bmad-standalone-tasks/references/prompt-templates.md` | 须含 | ❌ **GAP** |

**GAP 详情**：  
根路径第 25 行为：
- 「**TDD 红绿灯**：每个 US 执行前先写/补测试（红灯）→ 实现使通过（绿灯）→ 重构。**【TDD 红绿灯阻塞约束】**…」
- 缺少「**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

---

### 1.6 skills/bmad-bug-assistant/SKILL.md

**路径**：`C:\Users\milom\.cursor\skills\bmad-bug-assistant\bmad-bug-assistant\SKILL.md`

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 | 须含「每个 US 须独立执行」 | ✅ 通过 |

**证据**：第 437 行（阶段四实施 BUG-A4-IMPL）含：
- 「**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。」

---

### 1.7 .cursor/commands/speckit.implement.md

**路径**：`d:\Dev\BMAD-Speckit-SDD-Flow\.cursor\commands\speckit.implement.md`  
（与 `D:\Dev\micang-trader-015-indicator-system-refactor\.cursor\commands\speckit.implement.md` 内容一致）

| 审计项 | 要求 | 验证结果 |
|--------|------|----------|
| 每个 US 须独立执行 RED→GREEN→REFACTOR | 须含该表述 | ❌ **GAP** |

**GAP 详情**：  
当前首段为：
- 「**TDD 红绿灯**：每个**涉及生产代码的任务**必须先写/补测试并运行得失败（红灯），再实现（绿灯）；禁止先写生产代码再补测试。progress 必须包含每任务的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录…」

仅提及「每个涉及生产代码的任务」，未出现：
- 「每个 US 须独立执行 RED→GREEN→REFACTOR」
- 「禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」

步骤 6 的 Per-US tracking 也未嵌入上述约束表述。

---

## 2. BMAD-Speckit-SDD-Flow 源文件一致性

| 检查项 | 结果 |
|--------|------|
| 项目内 `skills/speckit-workflow/references/task-execution-tdd.md` | 已含「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」（与 speckit-workflow/speckit-workflow/references 一致） |
| 项目内 `speckit.implement.md` | 仍缺每 US 独立约束 |
| Cursor 全局 skills 与项目 skills 的同步 | 存在不一致：部分根路径文件未同步 nested 版本约束 |

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛表述、伪实现、TDD 未执行、路径漂移、验收一致性、多版本一致性。

**每维度结论**：

- **遗漏需求点**：审计要求 7 处均含「每 US 独立执行」约束。4 处（根 path task-execution-tdd、根 bmad-standalone-tasks SKILL、根 prompt-templates、speckit.implement.md）未满足，属遗漏。
- **边界未定义**：技能存在 root 与 nested 双路径，未明确以何者为规范。部分根路径内容落后，易误导加载逻辑。
- **验收不可执行**：speckit.implement 命令缺少「每 US 独立」约束，执行链路可能绕过该要求，验收标准不完整。
- **与前置文档矛盾**：speckit-workflow、task-execution-tdd、bmad-story-assistant 等在 nested 或部分路径中已明确约束，根 path 与 implement 命令未对齐，存在矛盾。
- **孤岛表述**：根 path 中 bmad-standalone-tasks 的 TDD 约束弱于 nested，形成孤岛表述。
- **伪实现**：无；为文档约束缺失，非实现问题。
- **TDD 未执行**：若 implement 命令未强制「每 US 独立」，Agent 可能仅对首 US 执行 TDD，后续直接实现，等同于 TDD 未完整执行。
- **路径漂移**：审计涉及 root 与 nested 多路径，已逐条核对，无行号漂移。
- **验收一致性**：未通过项无法通过「逐 US 检查 TDD 记录」的验收，因命令与部分 skill 未要求该检查。
- **多版本一致性**：bmad-standalone-tasks、speckit-workflow 的 root 与 nested 不一致，需统一。

**本轮结论**：本轮存在 gap。具体项：
1) `speckit-workflow/references/task-execution-tdd.md`（根）缺「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」；  
2) `bmad-standalone-tasks/SKILL.md`（根）缺「每个 US 须独立执行 RED→GREEN→REFACTOR」及禁止表述；  
3) `bmad-standalone-tasks/references/prompt-templates.md`（根）缺同上约束；  
4) `.cursor/commands/speckit.implement.md` 缺「每个 US 须独立执行 RED→GREEN→REFACTOR」及禁止表述。  
不计数，修复后重新发起审计。

---

## 4. 修改建议

| 序号 | 文件路径 | 修改内容 |
|------|----------|----------|
| 1 | `C:\Users\milom\.cursor\skills\speckit-workflow\references\task-execution-tdd.md` | 将「**每个涉及生产代码的任务执行顺序为**」改为「**prd 中每个 involvesProductionCode=true 的 US 必须独立执行一次完整循环。执行顺序为**」，或直接与 nested 版本对齐 |
| 2 | `C:\Users\milom\.cursor\skills\bmad-standalone-tasks\SKILL.md` 第 76 行 | 在「**TDD 红绿灯**：」后增加「**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。」 |
| 3 | `C:\Users\milom\.cursor\skills\bmad-standalone-tasks\references\prompt-templates.md` 第 25 行 | 同上，在 TDD 红绿灯段补充「每个 US 须独立执行 RED→GREEN→REFACTOR」及禁止表述 |
| 4 | `d:\Dev\BMAD-Speckit-SDD-Flow\.cursor\commands\speckit.implement.md`（及 micang-trader 同路径） | 在 TDD 红绿灯段落或步骤 6 Per-US tracking 中增加：「每个 US 须独立执行 RED→GREEN→REFACTOR；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。」 |

---

## 5. 可解析评分块（供 parseAndWriteScore）

```
## 可解析评分块（供 parseAndWriteScore）

总体评级: C

维度评分:
- 功能性: 72/100
- 代码质量: 75/100
- 测试覆盖: 70/100
- 安全性: 78/100
```

---

## 6. 结论

**未通过。**

**GAP 清单**：
1. speckit-workflow/references/task-execution-tdd.md（根）缺「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」  
2. bmad-standalone-tasks/SKILL.md（根）缺「每个 US 须独立执行 RED→GREEN→REFACTOR」及禁止表述  
3. bmad-standalone-tasks/references/prompt-templates.md（根）缺同上约束  
4. speckit.implement.md 缺「每个 US 须独立执行 RED→GREEN→REFACTOR」及禁止表述  

**修改建议**：见 §4。  
**收敛**：本轮存在 gap，不计数。修复后重新发起审计，直至连续 3 轮无 gap 后收敛。
