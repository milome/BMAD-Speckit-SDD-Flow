# 迭代次数展示需求文档审计报告 — 第 1 轮

**审计类型**：需求文档审计（依据 audit-prompts §5 精神适配）  
**被审对象**：`REQUIREMENTS_iteration_count_display.md`  
**依据**：`DEBATE_iteration_count_display_100轮.md` 辩论共识；scoring/coach、scoring/dashboard、scoring/writer、scripts/dashboard-generate.ts 实现现状  
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
| Coach 集成：phase_iteration_counts 可选；format 有则输出 | §3.1、§4.1、§5 | ✅ 覆盖 |
| Dashboard：getHighIterationTop3；高迭代 Top 3 小节；全 0 时「均为一次通过」 | §3.1、§4.2、§5 | ✅ 覆盖 |
| 边界：record.iteration_count ?? 0；负数 clamp；NaN round；历史/eval 说明 | §3.1、§4.3、ITER-DISP-08、ITER-DISP-11 | ✅ 覆盖 |
| recommendations 加高迭代建议 | §6、ITER-DISP-10 | ✅ 覆盖 |
| 固定 stage 顺序 vs 按 records：决议为按 records，无 record 不展示 | §3.2 争议表 | ✅ 覆盖（与 DEBATE 轮 50「缺失 stage 显示—」有表述差异，见批判审计员结论） |
| eval 全 0 时不省略 iteration 小节 | §3.2 | ✅ 覆盖 |

**结论**：需求覆盖完整。

---

### 1.2 禁止词

| 检查项 | 结果 |
|--------|------|
| 可选、可考虑、后续、待定、酌情、视情况、技术债 | 第 51 行含「可选字段」 |

**具体位置**：第 51 行  
> 4. **Coach 集成**：CoachDiagnosisReport 新增 `phase_iteration_counts?: Record<string, number>`；formatToMarkdown 扩展，有则输出；**可选字段**，无则保持现有行为。

**裁定**：此处「可选」指 TypeScript optional 类型语义（`?:`），即字段可为 undefined 的**技术约定**，非「需求上可实现可不实现」的模糊承诺。与禁止词清单旨在防止需求层面「可做可不做」的用意不同。建议改为「optional 字段」或「字段可为 undefined」以避免误触发；若项目禁止词规则对技术用语有豁免，可保留。**边际 gap**，不阻断。

---

### 1.3 任务列表

| 任务 ID | 验收标准 | 可执行性 |
|---------|----------|----------|
| ITER-DISP-01 | 类型检查 | ✅ |
| ITER-DISP-02 | 单测：同 stage 多条时取最新 | ✅ |
| ITER-DISP-03 | 单测：有/无 phase_iteration_counts 时输出差异 | ✅ |
| ITER-DISP-04 | 单测：全 0 与部分>0 时输出 | ✅ |
| ITER-DISP-05 | 单测 | ✅ |
| ITER-DISP-06 | 单测 | ✅ |
| ITER-DISP-07 | 集成：npx ts-node scripts/dashboard-generate.ts 产出含高迭代小节 | ✅ |
| ITER-DISP-08 | 单测 | ✅ |
| ITER-DISP-09 | 验收：format 输出含该句 | ✅ |
| ITER-DISP-10 | 单测 | ✅ |
| ITER-DISP-11 | Coach README 或 scoring 文档 | ✅ |
| ITER-DISP-12 | npm test scoring/coach | ⚠️ 应为 `npm test -- scoring/coach` 或 `npm test -- --testPathPattern=scoring/coach` |
| ITER-DISP-13 | npm test scoring/dashboard | ⚠️ 同上 |

**结论**：任务可执行、可验收。ITER-DISP-12、13 的 `npm test` 参数格式需与项目实际脚本一致；常见为 `npm test -- --testPathPattern=scoring/coach`。**边际**。

---

### 1.4 集成点

| 文档路径/函数 | 实际存在 | 说明 |
|---------------|----------|------|
| scoring/coach/types.ts | ✅ | CoachDiagnosisReport 尚无 phase_iteration_counts |
| scoring/coach/diagnose.ts | ✅ | 使用 loadRunRecords、scored→phaseScores |
| scoring/coach/format.ts | ✅ | 仅输出 phase_scores，未含 iteration |
| scoring/dashboard/compute.ts | ✅ | 有 getWeakTop3、getLatestRunRecords；无 getHighIterationTop3（待实现） |
| scoring/dashboard/format.ts | ✅ | DashboardData 无 highIterTop3（待实现） |
| scripts/dashboard-generate.ts | ✅ | 使用 loadAndDedupeRecords、getLatestRunRecords，未调用 getHighIterationTop3 |
| scoring/coach/README.md | ✅ | 存在 |
| scoring/query/loader.ts | — | 文档 §5 写 loadAndDedupeRecords，Dashboard 实际从 `../scoring/query/loader` 导入 ✅ |

**数据流核对**：
- Coach：文档写 `loadRunRecords(run_id)`；实际 `loadRunRecords(runId, options.dataPath)`，Loader 在 `scoring/coach/loader.ts` ✅
- Dashboard：文档写 `loadAndDedupeRecords → records (filter real_dev)`；实际 `loadAndDedupeRecords(dataPath).filter(r => r.scenario !== 'eval_question')` ✅
- `getScoringDataPath()` 在 dashboard-generate 中调用，数据路径正确 ✅

**结论**：集成点与当前代码结构一致，无失效路径。

---

### 1.5 歧义与边界

| 项 | 文档定义 | 状态 |
|----|----------|------|
| 旧数据 | record.iteration_count ?? 0；说明「历史补录、eval 场景可能无迭代信息，显示为 0」 | ✅ |
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
| weight 不展示，属另一需求 | §3.1、§6 待决表 |
| veto 在 recommendations 统一说明 | 隐含于现有 recommendations 逻辑 |
| tier 文档供高级用户查阅 | §6 待决表 |
| iteration_passed 与 iteration_count 关系 | §6 待决表、ITER-DISP-10 |
| phase_iteration_counts 缺失时 fallback | §3.1、§4.1「有则输出」 |

**结论**：无 DEBATE 共识未被覆盖的遗漏。

---

## 2. 批判审计员结论

**已检查维度**：需求覆盖、禁止词、任务列表、集成点、歧义与边界、遗漏点。

**每维度结论**：

1. **需求覆盖**：通过。文档覆盖 DEBATE 七个维度的共识；展示粒度、歧义处理、评分联动、Coach 集成、Dashboard、边界、sprint-status 决策均明确。**质疑与裁定**：DEBATE 轮 50 共识含「缺失 stage 显示—」，而 REQUIREMENTS §3.2 争议表决议为「按 records 顺序；无 record 的 stage 不展示」。批判审计员核查：在「按 records 顺序」策略下，phase_scores 与 phase_iteration_counts 均从 records 构建，无 record 的 stage 不会进入数据，故「不展示」与「显示—」在现行决议下等价；若未来扩展为固定 stage 顺序（§6 待决表已列），则须在 format 规范中补充「缺失 stage 显示—」的显式约定，避免与 DEBATE 轮 15–16 的批判意见冲突。**裁定**：当前文档与共识一致，无阻断 gap。
2. **禁止词**：边际未通过。第 51 行「可选字段」触发禁止词清单。**对抗性质疑**：禁止词旨在防止「可做可不做」的模糊承诺；此处「可选」指 TypeScript `?:` 的 optional 语义，属明确技术约定，非需求层面弹性。**裁定**：建议改为「optional 字段」或「字段可为 undefined」以避免自动化检查误判；若项目对技术用语有豁免规则可保留。不阻断实施。
3. **任务列表**：通过。13 条任务均有验收标准，可执行。**对抗性质疑**：ITER-DISP-12、13 写 `npm test scoring/coach`，常见 Jest 用法为 `npm test -- --testPathPattern=scoring/coach` 或项目自定义脚本；若项目 package.json 的 test 命令已配置 path pattern，则当前写法可工作。**裁定**：建议在实施前确认项目 test 配置，并在验收中注明实际命令；边际，不阻断。
4. **集成点**：通过。逐项核查：`scoring/coach/types.ts`、`diagnose.ts`、`format.ts` 存在；`scoring/dashboard/compute.ts`、`format.ts` 存在；`scripts/dashboard-generate.ts` 存在；`scoring/coach/README.md` 存在。Coach 数据流用 `loadRunRecords`（coach/loader），Dashboard 用 `loadAndDedupeRecords`（query/loader），与文档 §5 一致。无失效路径或错误引用。
5. **歧义与边界**：通过。record.iteration_count ?? 0、负数 clamp、NaN round、历史/eval 说明、术语「整改 N 轮」、「通过后的多轮确认验证不计入」与 DEBATE 轮 26 一致。无歧义。
6. **遗漏点**：通过。weight 排除、veto 不重复、tier 文档、iteration_passed 关系、phase_iteration_counts fallback 均在 §6 或任务中覆盖。无 DEBATE 共识遗漏。

**本轮 gap 结论**：本轮存在 2 个边际 gap（不计数为阻断性 gap）。

- **GAP-A**（禁止词边际）：第 51 行「可选字段」——建议改为「optional 字段」或「字段可为 undefined」，以减少与禁止词清单的冲突。修改后可消 gap。
- **GAP-B**（任务验收命令边际）：ITER-DISP-12、ITER-DISP-13 的 `npm test scoring/coach`、`npm test scoring/dashboard` 需确认与项目 jest/vitest 配置一致；建议在验收列注明实际可执行命令。

**收敛判定**：上述两项为边际改进，不阻断文档作为实施依据。建议修订 GAP-A 后进入第 2 轮审计；累计至连续 3 轮无 gap 后收敛。**本轮无新阻断性 gap**；第 1 轮。

---

## 3. 审计结论

### 3.1 总体结论

**完全覆盖、验证通过**（含 2 项边际 gap，建议修订后累计至连续 3 轮无 gap 后收敛）。

### 3.2 建议修改

| 优先级 | 建议 |
|--------|------|
| 高 | 无 |
| 中 | 第 51 行将「可选字段」改为「optional 字段」或「字段可为 undefined」 |
| 低 | ITER-DISP-12、13 验收命令与项目 test 配置对齐并注明 |

### 3.3 收敛说明

本轮无**阻断性** gap；存在 2 项边际 gap。若采纳建议修订，可进入第 2 轮审计；建议累计至连续 3 轮无 gap 后收敛。

---

**报告结束**
