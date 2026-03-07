# 迭代次数展示需求文档审计报告 — 第 2 轮

**本审计为第 2 轮需求文档审计。**

**审计类型**：需求文档审计（依据 audit-prompts §5 精神适配）  
**被审对象**：`REQUIREMENTS_iteration_count_display.md`（已按第 1 轮审计建议修订）  
**依据**：`DEBATE_iteration_count_display_100轮.md` 辩论共识；scoring/coach、scoring/dashboard、scripts/dashboard-generate.ts 实现现状  
**日期**：2026-03-06

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计项逐条验证

### 1.1 需求覆盖

| DEBATE 共识维度 | 文档位置 | 验证结果 |
|-----------------|----------|----------|
| 展示粒度：per-stage 逐行；不引入总体聚合 | §1.1、§3.1 | ✅ 覆盖 |
| sprint-status 本需求不展示 | §2 表、§3.1、§6 | ✅ 覆盖 |
| 歧义处理：小节标题 + 说明 + 全 0 简化表述 | §3.1、§4.1、ITER-DISP-04 | ✅ 覆盖 |
| 与评分联动：仅 phase_score + iteration_count；说明分数已含阶梯扣分 | §3.1、ITER-DISP-09 | ✅ 覆盖 |
| Coach 集成：phase_iteration_counts optional；format 有则输出 | §3.1、§4.1、§5 | ✅ 覆盖 |
| Dashboard：getHighIterationTop3；高迭代 Top 3 小节；全 0 时「均为一次通过」 | §3.1、§4.2、§5 | ✅ 覆盖 |
| 边界：record.iteration_count ?? 0；负数 clamp；NaN round；历史/eval 说明 | §3.1、§4.3、ITER-DISP-08、ITER-DISP-11 | ✅ 覆盖 |
| recommendations 加高迭代建议 | §6、ITER-DISP-10 | ✅ 覆盖 |
| 按 records 顺序；无 record 的 stage 不展示 | §3.2 争议表 | ✅ 覆盖 |
| eval 全 0 时不省略 iteration 小节 | §3.2 | ✅ 覆盖 |

**结论**：需求覆盖完整。

---

### 1.2 禁止词

| 检查项 | 结果 |
|--------|------|
| 可选、可考虑、后续、待定、酌情、视情况、技术债、先实现、后续扩展 | grep 全文档：0 命中 |

**具体核查**：第 51 行已按第 1 轮建议修订为「optional 字段，可为 undefined」，不再使用禁止词「可选」。  
**结论**：禁止词检查通过。

---

### 1.3 任务列表

| 任务 ID | 验收标准 | 可执行性验证 |
|---------|----------|--------------|
| ITER-DISP-12 | `npx vitest run scoring/coach` | ✅ 已执行，41 passed，exit 0 |
| ITER-DISP-13 | `npx vitest run scoring/dashboard` | ✅ 已执行，15 passed，exit 0 |

**结论**：ITER-DISP-12、13 验收命令已与 package.json 的 `vitest run` 一致；命令可执行且通过。13 条任务均有明确、可验收标准。

---

### 1.4 集成点

| 文档路径/函数 | 实际存在 | 说明 |
|---------------|----------|------|
| scoring/coach/types.ts | ✅ | CoachDiagnosisReport 待新增 phase_iteration_counts |
| scoring/coach/diagnose.ts | ✅ | 使用 scored、phaseScores |
| scoring/coach/format.ts | ✅ | 待扩展 |
| scoring/dashboard/compute.ts | ✅ | 待新增 getHighIterationTop3 |
| scoring/dashboard/format.ts | ✅ | 待新增 highIterTop3 |
| scripts/dashboard-generate.ts | ✅ | 待调用 getHighIterationTop3 |
| scoring/coach/README.md | ✅ | 存在 |

**结论**：集成点与当前代码结构一致，无失效路径。

---

### 1.5 歧义与边界

| 项 | 文档定义 | 状态 |
|----|----------|------|
| 旧数据 | record.iteration_count ?? 0；说明历史补录/eval 可能无迭代信息 | ✅ |
| eval | 通常 iteration_count=0；全 0 时统一展示 | ✅ |
| NaN | Math.max(0, Math.round(iter))；NaN 时 0 | ✅ |
| 负数 | clamp 为 0 | ✅ |
| 术语 | 「整改 N 轮」；N=0 一次通过，N≥1 未通过次数 | ✅ |
| 3 轮无 gap | 说明用「通过后的多轮确认验证不计入」 | ✅ |

**结论**：边界与术语定义明确。

---

### 1.6 遗漏点

| DEBATE 讨论点 | 文档覆盖 |
|---------------|----------|
| weight 不展示，属另一需求 | §3.1、§6 |
| tier 文档供高级用户查阅 | §6 待决表 |
| iteration_passed 与 iteration_count 关系 | §6 待决表、ITER-DISP-10 |
| phase_iteration_counts 缺失时 fallback | §3.1、§4.1「有则输出」 |
| sprint-status 解耦决策 | §2、§6 |

**结论**：无 DEBATE 共识未被覆盖的遗漏。

---

## 2. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现、行号/路径漂移、验收一致性、需求覆盖、禁止词、任务列表、集成点、歧义与边界、遗漏点。

**每维度结论**（对抗性质疑 + 裁定）：

- **遗漏需求点**：逐条对照 DEBATE_iteration_count_display_100轮.md 七个共识维度（展示粒度、歧义处理、评分联动、Coach 集成、Dashboard、边界、sprint-status 决策）与 REQUIREMENTS 文档 §1～§6，无遗漏。**对抗性质疑**：DEBATE 轮 50 含「缺失 stage 显示—」，而 §3.2 决议为「按 records 顺序；无 record 不展示」。**裁定**：在按 records 构建 phase_scores/phase_iteration_counts 的策略下，无 record 的 stage 不会进入数据，故「不展示」与「显示—」等价；无需额外修正。

- **边界未定义**：NaN、负数、历史/eval、同 stage 多条取最新、record.iteration_count 为 undefined 等边界均在 §3.1、§4.3、ITER-DISP-08 中定义。**对抗性质疑**：同 stage 多条时「按 timestamp 取最新」是否明确 timestamp 字段名？**裁定**：§4.1 与 §5 数据流均写「同 stage 取最新」，RunScoreRecord 约定含 timestamp，实施时可从 records 推断；需求层面已足够明确。

- **验收不可执行**：ITER-DISP-01～11 的验收（类型检查、单测、集成、文档）均可在实施后执行；ITER-DISP-12、13 的 `npx vitest run scoring/coach`、`npx vitest run scoring/dashboard` 已在本轮审计中实际执行并通过（41 passed、15 passed，exit 0）。**对抗性质疑**：是否需补充 dashboard-generate 的端到端验收（ITER-DISP-07 已有）？**裁定**：ITER-DISP-07 已覆盖；本需求为需求文档审计，不要求实施阶段才有的 e2e 证据。

- **与前置文档矛盾**：与 DEBATE 共识一致；第 1 轮 GAP-A（禁止词）、GAP-B（验收命令）均已按建议修订，无矛盾。

- **孤岛模块**：本审计为需求文档，不适用；集成点 §5 已明确各模块在生产代码关键路径中的调用关系。

- **伪实现**：本审计为需求文档，不适用；任务列表无占位或「后续扩展」表述。

- **行号/路径漂移**：§5 集成点、§7 任务列表中的路径（scoring/coach/types.ts、diagnose.ts、format.ts、scoring/dashboard/compute.ts、format.ts、scripts/dashboard-generate.ts、scoring/coach/README.md）与当前代码结构一致；无引用失效路径。

- **验收一致性**：ITER-DISP-12、13 的验收命令与文档宣称一致；已执行并验证通过。文档写「与 package.json test: vitest run 一致」，package.json 实际为 `"test": "vitest run"`，npx vitest run 接受路径参数过滤，二者一致。

- **需求覆盖**：通过。展示粒度、歧义处理、评分联动、Coach 集成、Dashboard、边界、recommendations、sprint-status 决策均覆盖。

- **禁止词**：通过。第 51 行已修订为「optional 字段，可为 undefined」；grep 全文档对禁止词表无命中。第 1 轮 GAP-A 已消除。

- **任务列表**：通过。13 条任务均有明确验收标准；ITER-DISP-12、13 已改为 `npx vitest run scoring/coach`、`npx vitest run scoring/dashboard`。第 1 轮 GAP-B 已消除。

- **集成点**：通过。路径存在；数据流与 loader、diagnose、format 职责一致。

- **歧义与边界**：通过。术语、边界条件与 DEBATE 一致。

- **遗漏点**：通过。weight、tier、iteration_passed、fallback、sprint-status 均在 §6 或任务中覆盖。

**本轮 gap 结论**：**本轮无新 gap。第 2 轮；建议累计至连续 3 轮无 gap 后收敛。**

第 1 轮 GAP-A（禁止词「可选字段」）、GAP-B（验收命令格式）均已按建议修订并通过验证。批判审计员从遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现、行号/路径漂移、验收一致性等 14 个维度核查，均无新质疑。未发现新的遗漏、歧义、禁止词、集成点失效或验收不可执行项。**严格判定**：若未来扩展为固定 stage 顺序（§6 待决表已列），须在 format 规范中补充「缺失 stage 显示—」的显式约定；本需求范围内无阻断性 gap。

---

## 3. 审计结论

### 3.1 总体结论

**完全覆盖、验证通过**。第 1 轮 2 项边际 gap 已全部消除；本轮无新 gap。建议累计至连续 3 轮无 gap 后收敛。

### 3.2 收敛说明

- 第 1 轮：存在 2 项边际 gap（GAP-A 禁止词、GAP-B 验收命令）；已按建议修订。
- 第 2 轮：无新 gap；第 1 轮 gap 已消除。
- 建议：进入第 3 轮审计；若第 3 轮仍无 gap，可判定连续 3 轮无 gap 后收敛。

---

**报告结束**
