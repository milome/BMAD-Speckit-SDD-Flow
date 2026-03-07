# TASKS：迭代次数（iteration_count）展示

**产出日期**：2026-03-06  
**来源**：REQUIREMENTS_iteration_count_display.md §1～§8；Party-Mode 100 轮决策（批判审计员 >70%，最后 3 轮无新 gap 收敛）  
**参考文档**：`_bmad-output/implementation-artifacts/_orphan/REQUIREMENTS_iteration_count_display.md`

---

## 一、Party-Mode 决策摘要（100 轮）

### 1.1 参与角色与发言占比

| 角色 | 发言轮次 | 占比 |
|------|----------|------|
| 批判审计员 | 71+ | >70% |
| Winston（架构师） | ~15 | |
| Amelia（开发） | ~12 | |
| John（产品） | ~8 | |
| Mary（分析师） | ~6 | |
| AI Coach | ~5 | |

### 1.2 关键争议与共识

| 维度 | 争议/讨论 | 决议 |
|------|-----------|------|
| **任务粒度** | ITER-DISP-03 与 04 是否合并 | 保持分离：03 扩展 Phase Scores 行格式，04 新增独立小节；合并后验收难拆分 |
| **验收可执行性** | ITER-DISP-01「类型检查」过泛 | 明确为 `grep -n "phase_iteration_counts" scoring/coach/types.ts` 且类型定义存在 |
| **依赖顺序** | sanitize（08）与 diagnose（02）谁先 | 02 先构建 raw 数据；08 在展示前 sanitize，落点 format.ts 与 compute.ts |
| **§8 纳入** | audit-prompts 总体评级是否纳入本 TASKS | **不纳入**：不同工作流（audit-prompts §1–§5 修改 vs Coach/Dashboard 功能）；§8 应单独 TASKS_audit_rating_output |
| **边界与 fallback** | 08 与 11 的职责划分 | 08 负责展示前 sanitize（NaN/负/小数）；11 负责文档说明历史/eval 场景 |
| **recommendations** | ITER-DISP-10 与 diagnose 的集成点 | diagnose 构建 report 时，若 phase_iteration_counts 存在且存在 >0，向 recommendations 追加建议 |
| **文档更新** | 11 的落点具体化 | Coach README 或 `scoring/coach/README.md`；若无则新建或补充 `scoring/README.md` |

### 1.3 批判审计员终审陈述

> 经 100 轮逐项质疑，REQUIREMENTS §1～§7 全部共识、集成点、边界均有对应任务；任务粒度适宜，验收标准可执行；§8 审计评级输出属不同子系统，不纳入本批次。最后 3 轮无新 risks、edge cases 或遗漏点，**可产出最终任务列表**。

---

## 二、任务总览与依赖

| US-ID | 对应 ITER-DISP | 修改/新增 | 依赖 |
|-------|----------------|------------|------|
| US-001 | ITER-DISP-01 | types.ts | 无 |
| US-002 | ITER-DISP-02 | diagnose.ts | US-001 |
| US-003 | ITER-DISP-03 | format.ts | US-001, US-002 |
| US-004 | ITER-DISP-04 | format.ts | US-003 |
| US-005 | ITER-DISP-08 | format.ts, compute.ts | 与 US-002～006 并行，展示前统一 sanitize |
| US-006 | ITER-DISP-05 | compute.ts | 无 |
| US-007 | ITER-DISP-06 | format.ts, DashboardData | US-006 |
| US-008 | ITER-DISP-07 | dashboard-generate.ts | US-007 |
| US-009 | ITER-DISP-09 | format.ts | US-003 |
| US-010 | ITER-DISP-10 | diagnose.ts | US-002 |
| US-011 | ITER-DISP-11 | 文档 | 无（可与实施并行） |
| US-012 | ITER-DISP-12 | Coach 单测 | US-001～004, US-010 |
| US-013 | ITER-DISP-13 | Dashboard 单测 | US-006～008 |

**建议执行顺序**：US-001 → US-002 → US-005（sanitize 工具） → US-003 → US-004 → US-009 → US-010 → US-006 → US-007 → US-008 → US-011 → US-012 → US-013

---

## 三、任务详情与验收标准

### US-001（ITER-DISP-01）：CoachDiagnosisReport 新增 phase_iteration_counts

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/types.ts` |
| **具体修改** | `CoachDiagnosisReport` 新增 `phase_iteration_counts?: Record<string, number>` |
| **验收标准** | `grep -n "phase_iteration_counts" scoring/coach/types.ts` 返回命中；TypeScript 编译无错误 |
| **验收命令** | `grep -n "phase_iteration_counts" scoring/coach/types.ts` 且 `npx tsc --noEmit` |

---

### US-002（ITER-DISP-02）：diagnose.ts 构建 phase_iteration_counts

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/diagnose.ts` |
| **具体修改** | 从 `scored` 构建 `phase_iteration_counts`；同 stage 多条时按 timestamp 取最新 record 的 iteration_count |
| **验收标准** | 单测：同 stage 多条 records 时，`report.phase_iteration_counts[stage]` 取 timestamp 最新的 record 的 iteration_count |
| **验收命令** | `npx vitest run scoring/coach/__tests__/diagnose.test.ts` |

---

### US-003（ITER-DISP-03）：formatToMarkdown Phase Scores 扩展

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/format.ts` |
| **具体修改** | 若 `phase_iteration_counts` 存在，Phase Scores 节每行扩展为 `- ${stage}: ${score} 分，整改 ${iter} 轮` |
| **验收标准** | 单测：有 phase_iteration_counts 时输出含「整改 N 轮」；无时保持现有 `- stage: score` 格式 |
| **验收命令** | `npx vitest run scoring/coach`（format 输出可由 coach-integration 或新增 format.test.ts 覆盖） |

---

### US-004（ITER-DISP-04）：formatToMarkdown 新增「各 Stage 整改轮次」小节

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/format.ts` |
| **具体修改** | 新增「各 Stage 整改轮次」小节；说明「审计未通过次数，0=一次通过；通过后的多轮确认验证不计入」；全 0 时「均为 0（一次通过）」 |
| **验收标准** | 单测：全 0 与部分>0 时输出格式正确；含上述说明句 |
| **验收命令** | `npx vitest run scoring/coach` |

---

### US-005（ITER-DISP-08）：展示前 sanitize iteration_count

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/format.ts`、`scoring/dashboard/compute.ts`（或共用 utils） |
| **具体修改** | 展示前：`Math.max(0, Math.round(record.iteration_count ?? 0))`；NaN 时 0 |
| **验收标准** | 单测：传入 `{ iteration_count: NaN }`、`{ iteration_count: -1 }`、`{ iteration_count: 1.7 }`、`{}`，断言输出分别为 0、0、2、0 |
| **验收命令** | `npx vitest run scoring/coach scoring/dashboard`（相关单测通过） |

---

### US-006（ITER-DISP-05）：getHighIterationTop3

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/dashboard/compute.ts` |
| **具体修改** | 新增 `getHighIterationTop3(records)`：按 iteration_count 降序，过滤 >0，取前 3；返回 `{ stage, epicStory, iteration_count }[]`；全 0 时返回空数组 |
| **验收标准** | 单测：多 records 时返回降序前 3；全 0 时返回 [] |
| **验收命令** | `npx vitest run scoring/dashboard/__tests__/compute.test.ts` |

---

### US-007（ITER-DISP-06）：DashboardData 与 format 增加高迭代小节

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/dashboard/format.ts`、DashboardData 类型 |
| **具体修改** | DashboardData 新增 `highIterTop3`；formatDashboardMarkdown 增加「高迭代 Top 3」小节；全 0 时「各 stage 均为一次通过」 |
| **验收标准** | 单测：format 输出含 highIterTop3 小节；全 0 时含「各 stage 均为一次通过」 |
| **验收命令** | `npx vitest run scoring/dashboard/__tests__/format.test.ts` |

---

### US-008（ITER-DISP-07）：dashboard-generate.ts 集成 getHighIterationTop3

| 字段 | 内容 |
|------|------|
| **修改文件** | `scripts/dashboard-generate.ts` |
| **具体修改** | 调用 getHighIterationTop3，传入 formatDashboardMarkdown |
| **验收标准** | 集成：`npx ts-node scripts/dashboard-generate.ts` 产出 `_bmad-output/dashboard.md` 含「高迭代 Top 3」小节（有数据且存在 >0 时） |
| **验收命令** | `npx ts-node scripts/dashboard-generate.ts`；`grep "高迭代" _bmad-output/dashboard.md` 有结果（有数据时） |

---

### US-009（ITER-DISP-09）：Coach report 说明 phase_score 阶梯扣分

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/format.ts` |
| **具体修改** | Coach report 说明中加「phase_score 已按整改轮次应用阶梯扣分」 |
| **验收标准** | format 输出含该句；单测中断言 `expect(formatToMarkdown(report)).toContain('phase_score 已按整改轮次应用阶梯扣分')` |
| **验收命令** | `npx vitest run scoring/coach`（单测通过即验收） |

---

### US-010（ITER-DISP-10）：recommendations 增加高整改轮次建议

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/diagnose.ts` |
| **具体修改** | 若存在 iteration_count>0 的 stage，向 recommendations 追加「建议关注高整改轮次 stage，提升一次通过率」 |
| **验收标准** | 单测：有 >0 时 recommendations 含该句；全 0 时不含 |
| **验收命令** | `npx vitest run scoring/coach/__tests__/diagnose.test.ts` |

---

### US-011（ITER-DISP-11）：文档说明迭代与 fallback

| 字段 | 内容 |
|------|------|
| **修改文件** | `scoring/coach/README.md` 或 `scoring/README.md`（若无则新建或补充） |
| **具体修改** | 说明：整改轮次含义；历史补录、eval 场景 iteration_count 通常为 0；sprint-status 本需求不展示 |
| **验收标准** | `grep -E "iteration_count|整改轮次|历史补录|eval" scoring/coach/README.md scoring/README.md` 有相关说明 |
| **验收命令** | `grep -l "整改轮次" scoring/coach/README.md scoring/README.md 2>/dev/null` 至少命中一个文件 |

---

### US-012（ITER-DISP-12）：Coach 单测全量验收

| 字段 | 内容 |
|------|------|
| **类型** | 验收 |
| **验收标准** | diagnose 单测：传入含 iteration_count 的 records，断言 report.phase_iteration_counts 正确 |
| **验收命令** | `npx vitest run scoring/coach` |

---

### US-013（ITER-DISP-13）：Dashboard 单测全量验收

| 字段 | 内容 |
|------|------|
| **类型** | 验收 |
| **验收标准** | getHighIterationTop3、format 含 highIterTop3 单测通过 |
| **验收命令** | `npx vitest run scoring/dashboard` |

---

## 四、验收命令汇总

| 命令 | 覆盖任务 |
|------|----------|
| `grep -n "phase_iteration_counts" scoring/coach/types.ts` 且 `npx tsc --noEmit` | US-001 |
| `npx vitest run scoring/coach` | US-002, US-003, US-004, US-005（Coach 侧）, US-009, US-010, US-012 |
| `npx vitest run scoring/dashboard` | US-005（Dashboard 侧）, US-006, US-007, US-013 |
| `npx ts-node scripts/dashboard-generate.ts` | US-008 |
| `npx ts-node scripts/coach-diagnose.ts` | Coach 集成（有数据时须验证输出含整改轮次） |
| `grep -l "整改轮次" scoring/coach/README.md scoring/README.md` | US-011 |

---

## 五、REQUIREMENTS §1～§7 覆盖核对

| 需求章节 | 要点 | 对应 US |
|----------|------|----------|
| §1.1 | per-stage 展示、0=一次通过、≥1 整改 | US-003, US-004, US-006, US-007 |
| §1.2 | iteration_count 已写入 RunScoreRecord | 数据源，无需本批任务 |
| §2 现状表 | Coach 新增 phase_iteration_counts | US-001, US-002 |
| §2 现状表 | format 扩展 | US-003, US-004 |
| §2 现状表 | Dashboard getHighIterationTop3、小节 | US-006, US-007, US-008 |
| §3.1 共识 | 全 0 时「均为 0（一次通过）」 | US-004 |
| §3.1 共识 | sprint-status 不展示 | US-011 文档化 |
| §3.1 共识 | 歧义处理说明 | US-004 |
| §3.1 共识 | phase_score 阶梯扣分说明 | US-009 |
| §3.1 共识 | recommendations 高整改建议 | US-010 |
| §3.1 共识 | 边界 sanitize | US-005 |
| §4.1 Coach | types、diagnose、format | US-001, US-002, US-003, US-004 |
| §4.2 Dashboard | compute、format、dashboard-generate | US-006, US-007, US-008 |
| §4.3 边界 fallback | NaN/负/小数、历史 eval | US-005, US-011 |
| §5 集成点 | 全部 6 处 | US-001～011 |
| §7 任务 | ITER-DISP-01～13 | US-001～013 |

**结论**：REQUIREMENTS §1～§7 全部共识、集成点、边界均有对应任务，无遗漏。

---

## 六、§8 审计评级输出（不纳入本 TASKS）

**决议**：audit-prompts.md §1–§5 的「总体评级: A/B/C/D」输出任务**不纳入**本 TASKS。

**理由**：
- 不同工作流：本 TASKS 为 Coach/Dashboard 功能扩展；§8 为 audit-prompts 提示词修改
- 不同修改目标：scoring/coach、scoring/dashboard、scripts vs skills/.../audit-prompts.md
- 若需实施 §8，建议单独创建 `TASKS_audit_rating_output.md` 或纳入 audit-prompts 相关改进批次

---

## 七、实施顺序与 TDD 约束

1. **ralph-method**：在 `_orphan/` 同目录创建并维护 `prd.TASKS_iteration_count_display.json`、`progress.TASKS_iteration_count_display.txt`
2. **TDD 红绿灯**：每个 US 执行前先写/补测试（红灯）→ 实现使通过（绿灯）→ 重构
3. **speckit-workflow**：禁止伪实现、占位；必须运行上表验收命令
4. **执行顺序**：按 §二 建议顺序，types → diagnose → format → compute → 集成 → 文档 → 验收

---

**文档结束**
