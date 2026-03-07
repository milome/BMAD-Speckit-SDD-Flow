# TDD 三项审计回退：根因分析

## §1 现象

之前审计会检查 ralph-method 的 progress 中是否含有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 三项记录；近期审计不再强制此项，甚至将「TDD 标记缺失」判为「可接受」。

---

## §2 根因

### 2.1 audit-prompts §5 从未删除 TDD 要求

`skills/speckit-workflow/references/audit-prompts.md` §5 第 (4) 项**始终**要求：

> 且涉及生产代码的**每个 US** 须在其对应段落内各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少一行（审计须逐 US 检查，不得以文件全局各有一行即判通过；[TDD-REFACTOR] 允许写"无需重构 ✓"，但禁止省略）；**若未创建或未按 US 更新，必须作为未通过项列出**

即：TDD 三项是 §5 的**强制检查项**，缺失应判未通过。

### 2.2 审计员解释偏差（主因）

Story 7.2 第 1 轮审计（`AUDIT_§5_Story7.2_执行阶段审计_2026-03-06.md`）中写道：

> 8. **TDD 标记**：tasks-E7-S2.md §8 要求「每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]」。progress 未包含该类标记。**此属 tasks 规范符合性，非 §5 核心审计项**；若严格按 tasks 执行，则为轻微 gap。**本次审计以 §5 六项为准，不将其列为阻断**。

此处将 TDD 三项归为「tasks 规范符合性」并认为「非 §5 核心审计项」，与 audit-prompts §5 (4) 的明文要求相悖。§5 (4) 明确将 ralph-method 追踪及 TDD 三项作为核心审计项，缺失应判未通过。

### 2.3 后续轮次延续了错误结论

- 第 2 轮：`TDD 标记缺失 | 维持可接受 | tasks §8 合规性，非 §5 阻断`
- 第 3 轮：`TDD 标记记录——均为可选增强...不构成 §5 未通过条件`

多轮审计均沿用了「TDD 标记缺失可接受」的结论，形成错误惯例。

### 2.4 「§5 六项」与 audit-prompts 第 (4) 项的关系

自定义审计模板中的「§5 六项」与 audit-prompts 正文的对应关系可能未被厘清。实际上，audit-prompts §5 第 (4) 项即 ralph-method 追踪，其中**已包含**对 TDD 三项的强制要求。审计员若只核对「六项」而忽略第 (4) 项的子要求，就容易得出「TDD 非 §5 核心」的错误判断。

---

## §3 修复建议

### 3.1 在 audit-prompts §5 中强化不可豁免说明

在 §5 第 (4) 项之后追加：

```text
**审计不得豁免**：不得以「tasks 规范」「可选」「可后续补充」「非 §5 阻断」为由豁免 TDD 三项检查；涉及生产代码的 US 缺 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 任一项，即判未通过。
```

### 3.2 审计 checklist 中显式列出 TDD 三项

在 §5 审计执行清单中增加：

- [ ] 逐 US 检查 progress：涉及生产代码的 US 是否各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少一行？缺一即未通过。

### 3.3 纠正 Story 7.2 的 progress

在 `progress.tasks-E7-S2.txt` 中为涉及生产代码的 US（US-001/002/004）补充 TDD 三项记录，再重新执行 §5 审计。

---

## §4 小结

| 项目 | 说明 |
|------|------|
| 根因 | 审计员将 TDD 三项解释为「tasks 规范，非 §5 核心」，忽略了 audit-prompts §5 (4) 的强制要求 |
| 后果 | 多轮审计延续「可接受」结论，造成 TDD 三项检查事实性回退 |
| 修复 | 在 audit-prompts 中明确不可豁免，并在 checklist 中显式加入 TDD 三项逐 US 检查 |
