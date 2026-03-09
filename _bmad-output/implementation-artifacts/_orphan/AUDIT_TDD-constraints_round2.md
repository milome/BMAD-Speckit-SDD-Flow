# 第 2 轮审计：TDD 约束覆盖度

**审计日期**：2026-03-09  
**审计依据**：audit-prompts §5、audit-prompts-critical-auditor-appendix、连续 3 轮无 gap 收敛要求  
**验收标准**：7 处均须包含「每个 US 须独立执行 RED→GREEN→REFACTOR」或「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」；以及「禁止仅对首个 US 执行 TDD」。

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 一、逐项验证结果

| 序号 | 审计对象 | 路径 | 是否包含 TDD 约束 | 验证方式 |
|------|----------|------|-------------------|----------|
| 1 | bmad-story-assistant | C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md | ❌ **未通过** | grep 无匹配；STORY-A3-DEV 模板缺「每个 US 须独立执行」及「禁止仅对首个 US 执行 TDD」 |
| 2 | speckit-workflow | C:\Users\milom\.cursor\skills\speckit-workflow\speckit-workflow\SKILL.md | ✅ 通过 | §5.1 含「每个 US 必须独立执行」及「禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」 |
| 3 | task-execution-tdd | C:\Users\milom\.cursor\skills\speckit-workflow\references\task-execution-tdd.md | ✅ 通过 | 含「prd 中每个 involvesProductionCode=true 的 US 必须**独立**执行一次完整循环」及「禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现」 |
| 4 | bmad-standalone-tasks | C:\Users\milom\.cursor\skills\bmad-standalone-tasks\SKILL.md | ✅ 通过 | Step 1 模板含「每个 US 须独立执行 RED→GREEN→REFACTOR」及「禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」 |
| 5 | prompt-templates | C:\Users\milom\.cursor\skills\bmad-standalone-tasks\references\prompt-templates.md | ✅ 通过 | Implementation 模板含相同约束 |
| 6 | bmad-bug-assistant | C:\Users\milom\.cursor\skills\bmad-bug-assistant\bmad-bug-assistant\SKILL.md | ✅ 通过 | BUG-A4-IMPL 含「每个 US 须独立执行 RED→GREEN→REFACTOR」及「禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」 |
| 7 | speckit.implement | D:\Dev\micang-trader-015-indicator-system-refactor\.cursor\commands\speckit.implement.md | ✅ 通过 | 步骤 6 含「每个 US 须独立执行 RED→GREEN→REFACTOR」及「禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现」 |

**说明**：speckit-workflow 根路径 SKILL.md 若指向 `speckit-workflow\speckit-workflow\SKILL.md`，则已覆盖；若根路径为独立入口且内容极少，则需确认引用链包含 task-execution-tdd.md。

---

## 二、批判审计员结论

### 2.1 已检查维度

| 维度 | 检查内容 | 结论 |
|------|----------|------|
| **功能性** | 7 处是否均包含「每个 US 须独立执行 RED→GREEN→REFACTOR」或等价表述 | 1 处缺失（bmad-story-assistant 根 SKILL.md） |
| **可操作性** | 表述是否明确、可执行、无歧义 | 通过处表述清晰；缺失处导致 STORY-A3-DEV 模板无法强制逐 US TDD |
| **可验证性** | 约束是否可通过 grep 或文档审计验证 | 可通过 grep 验证；bmad-story-assistant 根文件 grep 无匹配 |
| **引用链完整性** | 嵌套 skill / command 是否传递约束 | bmad-story-assistant 通过 STORY-A3-DEV 传入子代理，模板缺失即子代理无该约束 |
| **被模型忽略风险** | 约束是否容易被模型概括或跳过 | 根 bmad-story-assistant 仅写「每个涉及生产代码的任务」，未明确「禁止仅对首个 US 执行 TDD」，存在被理解为「对首个 US 执行后即可批量实现」的风险 |
| **假 100 轮风险** | 与本审计无关 | N/A |
| **边界情况** | 多 US、单 US、无生产代码 US 的场景 | 约束均要求「涉及生产代码」或「involvesProductionCode=true」的 US 独立执行，边界清晰 |
| **与 bmad-story-assistant 嵌套关系** | bmad-story-assistant 是否在 Dev Story 阶段传递 speckit-workflow / ralph 约束 | bmad-story-assistant 通过 STORY-A3-DEV 模板直接传约束；模板缺约束则 speckit-workflow 的约束不会在子代理上下文中被强调 |

### 2.2 每维度结论

- **功能性**：6/7 通过，1 处（bmad-story-assistant 根 SKILL.md）未包含新增 TDD 约束，**不满足验收标准**。
- **代码质量**：通过处文档结构清晰，禁止词表与约束表述一致。
- **测试覆盖**：本审计为文档/技能覆盖度审计，无代码测试；验收标准为逐项 grep/阅读验证。
- **安全性**：与本次 TDD 约束审计无直接关联；未发现安全相关 gap。

### 2.3 本轮 gap 结论

**本轮存在 gap**，具体如下：

1. **GAP-1（必须修复）**：`C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md` 中 STORY-A3-DEV 模板（阶段三 Dev Story 实施 prompt）**未包含**以下任一或等价表述：
   - 「每个 US 须独立执行 RED→GREEN→REFACTOR」
   - 「prd 中每个 involvesProductionCode=true 的 US 必须独立执行」
   - 「禁止仅对首个 US 执行 TDD」

2. **证据**：该文件中 STORY-A3-DEV 模板的「【TDD 执行顺序（不可跳过）】」及「【TDD 红绿灯阻塞约束】」段落仅写：
   - 「每个涉及生产代码的任务，必须严格按以下顺序执行」
   - 「禁止所有任务完成后集中补写 TDD 记录」
   - 未出现「禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现」或等价表述。

3. **影响**：bmad-story-assistant 在执行 Dev Story 时，将 STORY-A3-DEV 模板整段传入子代理；若模板中无上述约束，子代理可能仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现，违反 TDD 红绿灯要求。

4. **对比**：同 skill 目录下的 `bmad-story-assistant\bmad-story-assistant\SKILL.md` 已包含完整约束（对 prd 中每个 involvesProductionCode=true 的 US 必须独立执行一次完整循环；禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现）。**根路径 SKILL.md 与嵌套版本不一致**，需对齐。

---

## 三、可解析评分块

```yaml
# AUDIT_SCORING_BLOCK
总体评级: B
- 功能性: 86/100
- 代码质量: 95/100
- 测试覆盖: N/A（文档审计）
- 安全性: N/A（非代码审计）
```

**评级说明**：B 级 = 大部分满足验收标准，存在 1 处需修复的 gap；修复后可升至 A。

---

## 四、修改建议

针对 GAP-1，建议在 `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md` 的 STORY-A3-DEV 模板中，将「【TDD 执行顺序（不可跳过）】」段落修改为与 `bmad-story-assistant\bmad-story-assistant\SKILL.md` 一致，即增加：

```yaml
对 prd 中每个 involvesProductionCode=true 的 US，必须独立执行一次完整循环；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。
```

并在「【TDD 红绿灯阻塞约束】」段落中增加：

```yaml
prd 中每个 involvesProductionCode=true 的 US 必须**独立**执行一次完整 RED→GREEN→REFACTOR 循环。……禁止在未完成步骤 1–2 之前执行步骤 3。**禁止仅对首个 US 执行 TDD，后续 US 跳过红灯直接实现**；禁止所有任务完成后集中补写 TDD 记录。
```

或采用与 bmad-story-assistant\bmad-story-assistant\SKILL.md 中 STORY-A3-DEV 模板完全一致的文本。

---

## 五、结论

- **完全覆盖、验证通过**：否  
- **未通过**：是  
- **收敛说明**：本轮存在 gap，不计数。修复 GAP-1 后需进行第 3 轮审计；若第 3 轮无新 gap，则累计至连续 1 轮无 gap；须再通过 2 轮审计方可达成「连续 3 轮无 gap 后收敛」。
