# 迭代次数（iteration_count）展示需求

**议题**：iteration_count 在 Coach、Dashboard 等场景的展示需求与实现方案  
**日期**：2026-03-06  
**来源**：Party-Mode 辩论 `DEBATE_iteration_count_display_100轮.md` 共识产出

---

## §1 需求描述与背景

### 1.1 需求描述

在 Coach 诊断报告与 Dashboard 中**展示各 stage 的 iteration_count**（整改轮次），使用户能够：

1. 了解各 stage 的审计通过效率（一次通过 vs 多轮整改后通过）；
2. 识别高整改轮次 stage 作为效率短板；
3. 理解 phase_score 已按整改轮次应用阶梯扣分。

**展示粒度**：per-stage 逐行，不引入「总体迭代次数」聚合。  
**术语**：统一使用「整改 N 轮」，N=0 表示一次通过；N≥1 表示该 stage 审计未通过次数。

### 1.2 背景

- `iteration_count` 已按 stage 写入 RunScoreRecord，`iteration_count=0` 表示一次通过，≥1 表示该 stage 审计未通过（fail）次数；3 轮无 gap 验证轮不计入。
- `CoachDiagnosisReport` 含 `phase_scores`，不含 `iteration_count`；`formatToMarkdown` 仅输出 phase_score。
- Coach diagnose 内部有 `storyRecords` 含 `iteration_count`，但未透出到 report。
- Dashboard 当前无 iteration_count 展示。

---

## §2 现状分析

| 组件 | 现状 | 差距 |
|------|------|------|
| CoachDiagnosisReport | phase_scores: Record<string, number>；无 iteration_count | 需新增 phase_iteration_counts |
| formatToMarkdown | 仅输出 `- stage: score` | 需扩展为含整改轮次 |
| coach diagnose | storyRecords 含 iteration_count，未写入 report | 需从 records 提取并写入 report |
| Dashboard compute | getWeakTop3 按 phase_score；无 iteration 相关 | 需新增 getHighIterationTop3 |
| Dashboard format | 无 iteration 小节 | 需新增「高迭代 Top 3」小节 |
| sprint-status | 进度追踪，不含 scoring | 本需求不展示，文档化解耦决策 |

---

## §3 讨论共识与争议点

### 3.1 共识

1. **展示粒度**：per-stage 逐行；不引入总体聚合；sprint-status 本需求不展示。
2. **歧义处理**：小节标题「各 Stage 整改轮次」+ 说明「审计未通过次数，0=一次通过；通过后的多轮确认验证不计入」；全 0 时统一展示「均为 0（一次通过）」。
3. **与评分联动**：仅展示 phase_score + iteration_count；不展示 tier_coefficient；说明中注明「phase_score 已按整改轮次应用阶梯扣分」。
4. **Coach 集成**：CoachDiagnosisReport 新增 `phase_iteration_counts?: Record<string, number>`（optional 字段，可为 undefined）；formatToMarkdown 扩展，有则输出，无则保持现有行为。
5. **Dashboard**：新增「高迭代 Top 3」小节；getHighIterationTop3；全 0 时显示「均为一次通过」。
6. **边界**：`record.iteration_count ?? 0`；负数 clamp 为 0；NaN/小数 round；文档说明历史补录与 eval 场景通常为 0。

### 3.2 争议点（已决）

| 争议 | 决议 |
|------|------|
| 合并一行 vs 两小节 | Coach Phase Scores 扩展为 `stage: score 分，整改 N 轮` 合并输出；Dashboard 独立「高迭代 Top 3」小节 |
| 固定 stage 顺序 vs 按 records 顺序 | 按 records 实际 stage 顺序；无 record 的 stage 不展示 |
| eval 全 0 时是否省略 iteration 小节 | 不省略；统一展示，全 0 时简化表述 |

---

## §4 方案与推荐

### 4.1 Coach 扩展

1. **types.ts**：`CoachDiagnosisReport` 新增 `phase_iteration_counts?: Record<string, number>`。
2. **diagnose.ts**：从 `scored` 构建 `phase_iteration_counts`；同 stage 多条时按 timestamp 取最新 record 的 iteration_count。
3. **format.ts**：若 `phase_iteration_counts` 存在，Phase Scores 节每行扩展为 `- ${stage}: ${score} 分，整改 ${iter} 轮`；新增「各 Stage 整改轮次」小节，含说明与全 0 时的简化表述。

### 4.2 Dashboard 扩展

1. **compute.ts**：新增 `getHighIterationTop3(records)`，按 iteration_count 降序取前 3，过滤 iteration_count>0；全 0 时返回空数组。
2. **format.ts / DashboardData**：新增 `highIterTop3`；format 增加「高迭代 Top 3」小节；全 0 时显示「各 stage 均为一次通过」。
3. **dashboard-generate.ts**：调用 getHighIterationTop3，传入 formatDashboardMarkdown。

### 4.3 边界与 fallback

- `record.iteration_count ?? 0`；
- 展示前 `Math.max(0, Math.round(iter))`，NaN 时 0；
- 说明中注明「历史补录、eval 场景可能无迭代信息，显示为 0」。

---

## §5 数据流与集成点

```
Coach:
  loadRunRecords(run_id) → records
  → scored = records.map(applyTierAndVeto)
  → phase_scores[stage] = result.phase_score
  → phase_iteration_counts[stage] = record.iteration_count (同 stage 取最新)
  → CoachDiagnosisReport { phase_scores, phase_iteration_counts, ... }
  → formatToMarkdown → Markdown 含 Phase Scores + 整改轮次

Dashboard:
  loadAndDedupeRecords → records (filter real_dev)
  → getLatestRunRecords → latestRecords
  → getHighIterationTop3(latestRecords) → highIterTop3
  → formatDashboardMarkdown({ ..., highIterTop3 })
  → dashboard.md
```

**集成点**：

| 位置 | 修改内容 |
|------|----------|
| scoring/coach/types.ts | CoachDiagnosisReport 新增 phase_iteration_counts |
| scoring/coach/diagnose.ts | 构建 phase_iteration_counts 并写入 report |
| scoring/coach/format.ts | 扩展 formatToMarkdown 输出整改轮次与说明 |
| scoring/dashboard/compute.ts | 新增 getHighIterationTop3 |
| scoring/dashboard/format.ts | DashboardData 新增 highIterTop3；format 增加小节 |
| scripts/dashboard-generate.ts | 调用 getHighIterationTop3 并传 format |
| scoring/coach/README.md 或等价 | 说明整改轮次含义、历史/eval 场景 fallback |

---

## §6 待决与风险

| 类型 | 描述 | 缓解 |
|------|------|------|
| sprint-status 扩展 | 若 sprint-status 需展示 iteration，格式须与 Coach/Dashboard 统一 | 文档化「sprint-status 与 iteration 解耦」决策；扩展时复用相同术语与说明 |
| 固定 stage 顺序 | 当前按 records 顺序；若需固定顺序，stage 列表须从 rules/config 定义 | 本需求按 records 顺序；列对齐需求出现时再扩展 |
| tier 文档 | 高级用户查阅 tier 映射规则 | 在 iteration-tier.yaml 或 SCORING_CRITERIA 中已有说明；本需求说明中引用 |
| iteration_passed 与 iteration_count 关系 | 用户可能混淆 | recommendations 中若 iteration_count>0 可加「提升一次通过率」建议 |

---

## §7 建议任务列表

| ID | 任务 | 验收 |
|----|------|------|
| ITER-DISP-01 | CoachDiagnosisReport 新增 `phase_iteration_counts?: Record<string, number>` | 类型检查 |
| ITER-DISP-02 | diagnose.ts：从 scored 构建 phase_iteration_counts；同 stage 多条时按 timestamp 取最新 | 单测：同 stage 多条时取最新 |
| ITER-DISP-03 | formatToMarkdown：若 phase_iteration_counts 存在，Phase Scores 扩展为「stage: score 分，整改 N 轮」 | 单测：有/无 phase_iteration_counts 时输出差异 |
| ITER-DISP-04 | formatToMarkdown：新增「各 Stage 整改轮次」小节，含说明「审计未通过次数，0=一次通过；通过后的多轮确认验证不计入」；全 0 时「均为 0（一次通过）」 | 单测：全 0 与部分>0 时输出 |
| ITER-DISP-05 | getHighIterationTop3(records)：按 iteration_count 降序，过滤>0，取前 3；返回 { stage, epicStory, iteration_count }[] | 单测 |
| ITER-DISP-06 | DashboardData 新增 highIterTop3；formatDashboardMarkdown 增加「高迭代 Top 3」小节；全 0 时「各 stage 均为一次通过」 | 单测 |
| ITER-DISP-07 | dashboard-generate.ts 调用 getHighIterationTop3 并传入 format | 集成：npx ts-node scripts/dashboard-generate.ts 产出含高迭代小节 |
| ITER-DISP-08 | 展示前 sanitize：`Math.max(0, Math.round(record.iteration_count ?? 0))`；NaN 时 0 | 单测 |
| ITER-DISP-09 | Coach report 说明中加「phase_score 已按整改轮次应用阶梯扣分」 | 验收：format 输出含该句 |
| ITER-DISP-10 | recommendations：若存在 iteration_count>0 的 stage，加「建议关注高整改轮次 stage，提升一次通过率」 | 单测 |
| ITER-DISP-11 | 文档：说明历史补录、eval 场景 iteration_count 通常为 0；sprint-status 本需求不展示 | Coach README 或 scoring 文档 |
| ITER-DISP-12 | diagnose 单测：传入含 iteration_count 的 records，断言 report.phase_iteration_counts 正确 | `npx vitest run scoring/coach`（与 package.json test: vitest run 一致） |
| ITER-DISP-13 | Dashboard 单测：getHighIterationTop3、format 含 highIterTop3 | `npx vitest run scoring/dashboard`（与 package.json test: vitest run 一致） |

**优先级**：ITER-DISP-01～04 为 Coach 核心；ITER-DISP-05～07 为 Dashboard；ITER-DISP-08～11 为边界与文档；ITER-DISP-12～13 为验收。

---

## §8 补充：为什么审计结束不显示评级？

### 8.1 现象

当前 spec / plan / GAPS / tasks / 执行阶段的审计报告仅输出「完全覆盖、验证通过」或「未通过」，**不输出 A/B/C/D 总体评级**。下游解析器（如 sample-spec-report.md 等 fixture）期望存在「总体评级: A/B/C/D」字段，但主流程的 audit-prompts §1–§5 并未要求 code-reviewer 输出此字段。

### 8.2 根本原因

audit-prompts.md §1–§5（spec / plan / GAPS / tasks / 执行）的提示词**没有要求**输出 A/B/C/D 评级。

这些提示词只要求：

> 报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节、未覆盖要点或模糊表述位置。

因此 code-reviewer 自然只会给出「通过 / 未通过」，而不会输出「总体评级: A/B/C/D」。

### 8.3 现状与差异

| 文档 | 是否要求评级 | 说明 |
|------|--------------|------|
| audit-prompts.md §1–§5 | 否 | 只要求「完全覆盖、验证通过」或「未通过」 |
| audit-prompts-prd.md | 是 | 要求「总体评级: [A/B/C/D]」 |
| audit-prompts-arch.md | 是 | 要求「总体评级: [A/B/C/D]」 |
| speckit-workflow SKILL | 有定义但未接入提示词 | 有 A/B/C/D 评级表（A 直接下一阶段、B 记录后下一阶段等），但未写入 §1–§5 的 prompt |
| sample-spec-report.md 等 fixture | 期望该格式 | 部分解析器期望「总体评级: B」等字段，但主流程的 spec/plan/GAPS/tasks/执行阶段并未要求 code-reviewer 输出此字段 |

### 8.4 修复方向

在 audit-prompts.md §1–§5 的提示词中增加输出要求，例如：

> 报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节、未覆盖要点或模糊表述位置。**须同时输出「总体评级: [A/B/C/D]」**，对应 speckit-workflow 审计质量评级（A 优秀、B 良好、C 需修改、D 不及格）。

---

**文档结束**
