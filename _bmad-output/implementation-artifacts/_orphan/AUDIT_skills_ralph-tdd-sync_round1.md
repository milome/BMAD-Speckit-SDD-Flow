# 执行阶段审计报告：bmad-standalone-tasks、bmad-bug-assistant 与 ralph-method TDD 模式对齐

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 审计依据

1. **ralph-method SKILL**：prd schema 含 `involvesProductionCode`、`tddSteps`（RED/GREEN/REFACTOR 或 DONE）；progress 预填 TDD 槽位（`_pending_`）
2. **bmad-story-assistant** 作为已对齐参考（progress 预填、TDD 三项含 REFACTOR）
3. **修改建议**：bmad-standalone-tasks、bmad-bug-assistant 须补齐 progress 预填、prd tddSteps、TDD 三项（[TDD-REFACTOR] 强制）

---

## §5 审计项逐项验证

### 审计项 1：bmad-standalone-tasks 主 prompt 的 ralph-method 约束

| 子项 | 要求 | 验证结果 | 证据位置 |
|------|------|----------|----------|
| progress 预填 TDD 槽位（_pending_） | 必须有 | **通过** | SKILL.md L74：`[TDD-RED] _pending_`、`[TDD-GREEN] _pending_`、`[TDD-REFACTOR] _pending_`、`[DONE] _pending_` |
| prd involvesProductionCode | 必须有 | **通过** | SKILL.md L74：`involvesProductionCode: true` |
| prd tddSteps | 必须有 | **通过** | SKILL.md L74：`tddSteps`（RED/GREEN/REFACTOR 三阶段或 DONE 单阶段） |

**结论**：审计项 1 通过。

---

### 审计项 2：bmad-standalone-tasks TDD 红绿灯约束

| 子项 | 要求 | 验证结果 | 证据位置 |
|------|------|----------|----------|
| [TDD-REFACTOR] 强制 | 无论是否有重构都须有一行；无重构时写「无需重构 ✓」 | **通过** | SKILL.md L76：⑤ **无论是否有重构**，在 progress 追加 [TDD-REFACTOR]...（无具体重构时写「无需重构 ✓」） |
| 交付前自检 | RED/GREEN/REFACTOR 各至少一行 | **通过** | SKILL.md L76：**交付前自检**：涉及生产代码的每个 US，progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行 |

**结论**：审计项 2 通过。

---

### 审计项 3：bmad-standalone-tasks Step 2 审计项 5 与批判审计员

| 子项 | 要求 | 验证结果 | 证据位置 |
|------|------|----------|----------|
| 审计项 5 含 [TDD-REFACTOR] 验证 | 必须 | **通过** | SKILL.md L114：涉及生产代码的每个 US 是否含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行（[TDD-REFACTOR] 允许写「无需重构 ✓」） |
| 批判审计员占比 >70% | 必须 | **通过** | SKILL.md L98、L119：批判审计员发言占比须 **>70%**；报告须包含...该段落字数或条目数不少于报告其余部分的 70% |

**结论**：审计项 3 通过。

---

### 审计项 4：bmad-bug-assistant BUG-A4-IMPL ralph-method 段

| 子项 | 要求 | 验证结果 | 证据位置 |
|------|------|----------|----------|
| prd involvesProductionCode/tddSteps | 必须有 | **通过** | SKILL.md L432：涉及生产代码的 US 含 `involvesProductionCode: true` 与 `tddSteps`（RED/GREEN/REFACTOR 三阶段） |
| progress 预填 TDD 槽位 | 必须有 | **通过** | SKILL.md L433：`[TDD-RED] _pending_`、`[TDD-GREEN] _pending_`、`[TDD-REFACTOR] _pending_`、`[DONE] _pending_` |

**结论**：审计项 4 通过。

---

### 审计项 5：bmad-bug-assistant BUG-A4-IMPL TDD 记录与交付前自检

| 子项 | 要求 | 验证结果 | 证据位置 |
|------|------|----------|----------|
| TDD 记录三行（含 [TDD-REFACTOR]） | 必须 | **通过** | SKILL.md L408–412：【必做】...追加三行：`[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR] ... | 无需重构 ✓` |
| 交付前自检含 [TDD-REFACTOR] | 必须 | **通过** | SKILL.md L454：progress 中是否有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行 |

**结论**：审计项 5 通过。

---

### 审计项 6：bmad-bug-assistant BUG-A4-POSTAUDIT 审计项⑥

| 子项 | 要求 | 验证结果 | 证据位置 |
|------|------|----------|----------|
| 审计项⑥含 [TDD-REFACTOR] 验证 | 必须 | **通过** | SKILL.md L512：TDD 三项验证...须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行（[TDD-REFACTOR] 允许写「无需重构 ✓」） |
| grep 示例 | 必须有 | **通过** | SKILL.md L512、L518：`grep -E "\[TDD-(RED|GREEN|REFACTOR)\]" progress.*.txt`；修改建议示例含 `[TDD-REFACTOR] T3 无需重构 ✓` |

**结论**：审计项 6 通过。

---

### 审计项 7：三技能一致性（progress 预填、prd tddSteps、TDD 三项）

| 技能 | progress 预填 | prd tddSteps | [TDD-REFACTOR] 强制 |
|------|---------------|--------------|---------------------|
| bmad-story-assistant | ✓ L856 | ✓（未显式，依赖 speckit） | **部分**：记录段要求三行，阻塞约束 L877 写「若有重构」 |
| bmad-standalone-tasks | ✓ L74 | ✓ L74 | ✓ L76「无论是否有重构」 |
| bmad-bug-assistant | ✓ L433 | ✓ L432 | ✓ L442「无论是否有重构」 |

**不一致点**：bmad-story-assistant L877 的「【TDD 红绿灯阻塞约束】」第 5 步为「若有重构，在 progress 追加 [TDD-REFACTOR]」，与 bmad-standalone-tasks、bmad-bug-assistant 的「无论是否有重构」不一致。但其「【TDD 红绿灯记录与验收】」段（L881–886）明确要求三行含 `[TDD-REFACTOR] ... | 无需重构 ✓`，故语义上仍要求始终有 REFACTOR 行，仅阻塞约束表述不统一。

**结论**：审计项 7 部分通过。三技能在 TDD 三项的最终要求上一致，但 bmad-story-assistant 阻塞约束步 5 的表述建议修正为「无论是否有重构」。

---

## 批判审计员结论

### 已检查维度

1. **遗漏项**
   - bmad-standalone-tasks 主 prompt：无遗漏，progress 预填、prd schema、TDD 三项完整。
   - bmad-bug-assistant BUG-A4-IMPL / BUG-A4-POSTAUDIT：无遗漏。
   - **遗漏风险**：prompt-templates.md 的 Implementation 模板未包含与 SKILL 主 prompt 等价的完整约束（见下）。

2. **表述模糊**
   - bmad-standalone-tasks 主 SKILL 表述明确。
   - prompt-templates.md L24：prd schema 仅写「涉及生产代码的 US 含 involvesProductionCode、tddSteps」，未写出「involvesProductionCode: true」和「tddSteps（RED/GREEN/REFACTOR 三阶段）」，可执行性略弱。
   - bmad-story-assistant L877：「若有重构」与「【TDD 红绿灯记录与验收】」的三行强制要求存在表面矛盾，易被理解为「有重构才写 REFACTOR」。

3. **与 ralph-method / speckit-workflow 不一致**
   - speckit-workflow SKILL.md 明确「无论是否有具体重构动作，均须在 progress 中记录 `[TDD-REFACTOR]` 一行」。
   - bmad-standalone-tasks、bmad-bug-assistant 已与 speckit-workflow 一致。
   - bmad-story-assistant 阻塞约束步 5 仍用「若有重构」，与 speckit-workflow 及另两技能不一致。

4. **prompt-templates.md 与主 SKILL 不同步**
   - **GAP**：prompt-templates.md 的 Implementation 模板（L23–27）缺少：
     - 主 SKILL 中的「【TDD 红绿灯阻塞约束】」五步（含 ⑤ 无论是否有重构）；
     - 主 SKILL 中的明确「交付前自检」表述（RED/GREEN/REFACTOR 各至少一行）；
     - prd schema 的完整表述（involvesProductionCode: true、tddSteps 三阶段）。
   - 若主 Agent 从 prompt-templates 拷贝模板，会得到弱于 SKILL 的约束，存在执行偏差风险。
   - SKILL Step 1 的权威模板为 SKILL 内联内容，prompt-templates 作为引用应与之一致。

5. **可验证性**
   - grep 示例已覆盖：`grep -E "\[TDD-(RED|GREEN|REFACTOR)\]" progress.*.txt`、`_pending_` 等。
   - 修改建议示例具体可复制（如「Task 3 应补充：[TDD-RED] ...；[TDD-GREEN] ...；[TDD-REFACTOR] T3 无需重构 ✓」）。

6. **边界与例外**
   - 仅文档/配置的 US 使用 [DONE] _pending_ 单阶段，三个技能均有一致约定。
   - 回归失败且用户拒绝排除时的 [TDD-RED] 记录，bmad-bug-assistant 已覆盖。

### 本轮结论

**本轮存在 gap**，具体如下：

- **GAP-1**：`skills/bmad-standalone-tasks/references/prompt-templates.md` 的 Implementation 模板与主 SKILL Step 1 模板不同步，缺少「【TDD 红绿灯阻塞约束】」五步、「交付前自检」及 prd schema 的完整表述。
- **GAP-2**：`skills/bmad-story-assistant/SKILL.md` 第 877 行「【TDD 红绿灯阻塞约束】」第 5 步为「若有重构」，与 ralph-method / speckit-workflow 及 bmad-standalone-tasks、bmad-bug-assistant 的「无论是否有重构」不一致，建议改为「无论是否有重构」。

---

## grep 验证结果

```bash
# progress 预填、_pending_
grep -r "progress 预填\|_pending_" skills/bmad-standalone-tasks skills/bmad-bug-assistant
# 命中：bmad-standalone-tasks SKILL L74, prompt-templates L24,37；bmad-bug-assistant L433

# involvesProductionCode、tddSteps
grep -r "involvesProductionCode\|tddSteps" skills/bmad-standalone-tasks skills/bmad-bug-assistant
# 命中：两技能均有

# TDD-REFACTOR、无需重构
grep -r "TDD-REFACTOR\|无需重构" skills/bmad-standalone-tasks skills/bmad-bug-assistant
# 命中：两技能均有，含审计项与 grep 示例
```

---

## 修改建议（未通过项）

### GAP-1：prompt-templates.md 与主 SKILL 同步

**文件**：`skills/bmad-standalone-tasks/references/prompt-templates.md`

**建议**：将 Implementation 模板（L23–27）的强制约束 1、2 扩展为与 SKILL.md Step 1 内联模板等价，至少包含：

1. **约束 1（ralph-method）**：补全 prd schema 表述，例如「涉及生产代码的 US 含 `involvesProductionCode: true` 与 `tddSteps`（RED/GREEN/REFACTOR 三阶段）；仅文档/配置的含 `tddSteps`（DONE 单阶段）」。
2. **约束 2（TDD 红绿灯）**：补全「【TDD 红绿灯阻塞约束】」五步，尤其第 5 步「无论是否有重构，在 progress 追加 [TDD-REFACTOR]（无具体重构时写「无需重构 ✓」）」；以及「交付前自检」：涉及生产代码的每个 US，progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 须在 [TDD-GREEN] 之前。

### GAP-2：bmad-story-assistant 阻塞约束步 5 统一表述

**文件**：`skills/bmad-story-assistant/SKILL.md`

**建议**：将 L877「5. 若有重构，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>」改为「5. **无论是否有重构**，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>（无具体重构时写「无需重构 ✓」）」，与 bmad-standalone-tasks、bmad-bug-assistant 及 speckit-workflow 保持一致。

---

## 结论

**未通过**。审计项 1–6 均通过，审计项 7 部分通过。存在 2 个 gap，需按上述建议修改后再发起下一轮审计。

---

## 可解析评分块（供 parseAndWriteScore）

```yaml
## 可解析评分块（供 parseAndWriteScore）
总体评级: C
维度评分:
  - 功能性: 88/100
  - 代码质量: 85/100
  - 测试覆盖: 75/100
  - 安全性: 90/100
```

**说明**：功能性、代码质量、安全性较高；测试覆盖因 prompt-templates 与主 SKILL 不同步及 bmad-story-assistant 表述不一致而降分。

---

## 收敛条件

本审计为第 **1** 轮。须连续 3 轮结论均为「完全覆盖、验证通过」且批判审计员注明「本轮无新 gap」方能收敛。当前结论为「未通过」，建议按 GAP-1、GAP-2 修改后发起第 2 轮审计。
