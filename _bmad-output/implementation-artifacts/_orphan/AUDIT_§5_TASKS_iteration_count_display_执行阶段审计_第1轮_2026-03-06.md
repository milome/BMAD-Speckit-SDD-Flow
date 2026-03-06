# audit-prompts §5 执行阶段审计：TASKS_iteration_count_display

**本审计为实施后 §5 审计，第 1 轮**

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit |

**被审对象**
- 实施依据：`_bmad-output/implementation-artifacts/_orphan/TASKS_iteration_count_display.md`
- 实施产物：scoring/coach/types.ts、diagnose.ts、format.ts；scoring/utils/sanitize-iteration.ts；scoring/dashboard/compute.ts、format.ts；scripts/dashboard-generate.ts；prd/progress

---

## 一、§5 审计项逐项验证

### 1. 任务是否真正实现（无预留/占位/假完成）

| US | 验证结果 |
|----|----------|
| US-001 | types.ts L32 存在 `phase_iteration_counts?: Record<string, number>`，grep 命中 ✅ |
| US-002 | diagnose.ts L317-328 构建 phaseIterationCounts，同 stage 按 timestamp 取最新 record.iteration_count；L382 写入 report ✅ |
| US-003 | format.ts L6-14 有 counts 时 Phase Scores 行扩展为「整改 N 轮」 ✅ |
| US-004 | format.ts L22-33 新增「各 Stage 整改轮次」小节，含说明「审计未通过次数…」及全 0 时「均为 0（一次通过）」 ✅ |
| US-005 | sanitize-iteration.ts 实现 `Math.max(0, Math.round(val ?? 0))`；NaN/undefined/null→0；format.ts、compute.ts 均 import 并调用 ✅ |
| US-006 | compute.ts L111-127 getHighIterationTop3；过滤 >0、降序、取前 3；全 0 返回 [] ✅ |
| US-007 | DashboardData 含 highIterTop3；format.ts L49-57「高迭代 Top 3」小节；全 0 时「各 stage 均为一次通过」 ✅ |
| US-008 | dashboard-generate.ts L49-50 调用 getHighIterationTop3，L54-60 传入 formatDashboardMarkdown ✅ |
| US-009 | format.ts L44 含「phase_score 已按整改轮次应用阶梯扣分。」 ✅ |
| US-010 | diagnose.ts L359-366 当 hasHighIteration 时追加「建议关注高整改轮次 stage…」 ✅ |
| US-011 | scoring/coach/README.md L45-55、scoring/README.md L11-15 含整改轮次、历史补录、eval 说明 ✅ |
| US-012 | Coach 单测 50 passed（format.test、diagnose.test 覆盖 phase_iteration_counts、阶梯扣分、US-005 sanitize、US-010 recommendations）✅ |
| US-013 | Dashboard 单测 + utils 共 31 passed（compute.test getHighIterationTop3、format.test highIterTop3、sanitize-iteration.test）✅ |

**结论**：13 项 US 均真正实现，无占位或假完成。

### 2. 生产代码是否在关键路径中被使用

- `phase_iteration_counts`：diagnose.ts 构建 → report → formatToMarkdown（coach/format.ts）→ scripts/coach-diagnose.ts 输出 Markdown ✅
- `sanitizeIterationCount`：coach/format.ts L2、L9、L25；dashboard/compute.ts L6、L114 ✅
- `getHighIterationTop3`：dashboard-generate.ts L49 → formatDashboardMarkdown（L54-60）✅

**结论**：全部在生产关键路径中被调用，无孤岛模块。

### 3. 需实现的项是否均有实现与测试/验收覆盖

- US-005 验收「传入 NaN/-1/1.7/{} 断言输出 0/0/2/0」：sanitize 函数接收 number | undefined | null；`{}` 等价于 record 无 iteration_count 即 undefined→0，已由 undefined/null 单测覆盖；format.test.ts L59-71 通过 phase_iteration_counts 传入 NaN/-1/1.7/undefined 验证输出 ✅
- 其余 US 均有单测或 grep/ts-node 验收 ✅

### 4. 验收表/验收命令是否已按实际执行并填写

| 命令 | progress 记录 | 本次复现 |
|------|---------------|----------|
| grep phase_iteration_counts types.ts | 命中 line 32 | ✅ L32 命中 |
| npx tsc --noEmit | 未记录 | ❌ 项目存在 4 个既有 TS 错误（非本批次文件） |
| npx vitest run scoring/coach | 7 files, 50 passed | ✅ 50 passed |
| npx vitest run scoring/dashboard | 2 files, 18 passed | ✅ 4 files, 31 passed（含 utils） |
| npx ts-node scripts/dashboard-generate.ts | OK，产出含「高迭代 Top 3」 | ✅ 产出含该小节 |
| grep 整改轮次 README | 两文件均命中 | ✅ |
| npx ts-node scripts/coach-diagnose.ts | **未记录** | ✅ 本次执行：输出含「整改 0 轮」「各 Stage 整改轮次」「phase_score 已按整改轮次应用阶梯扣分」 |

**结论**：progress 漏填 `npx tsc --noEmit` 与 `coach-diagnose` 集成验收；其余已执行并填写。tsc 失败来自既有错误，非本批次引入。

### 5. 是否遵守 ralph-method（prd/progress 更新、US 顺序）

- prd.TASKS_iteration_count_display.json：13 条 US，passes 均为 true ✅
- progress.TASKS_iteration_count_display.txt：13 条 US 均 PASSED；按建议顺序（001→002→005→003→004…）✅

**结论**：符合 ralph-method。

### 6. 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

- grep 本批次修改的 scoring/*.ts：无「将在后续」「后续迭代」「TODO」「FIXME」「占位」「placeholder」✅
- prd 标记 passes: true 的 US 均已在 diagnose/format/compute/dashboard-generate 中实际调用 ✅

**结论**：无禁止表述，无虚标完成。

---

## 二、批判审计员结论

以下为批判审计员（Critical Auditor）对抗性检查，占比 >50%。

### CA-1：npx tsc --noEmit 项目级失败

**质疑**：TASKS US-001 验收要求「npx tsc --noEmit 无错误」。实际执行返回 4 个错误：
- scoring/__tests__/writer/validate-scenario.test.ts
- scoring/analytics/__tests__/prompt-optimizer.test.ts
- scoring/analytics/__tests__/rule-suggestion.test.ts
- scripts/analytics-sft-extract.ts

**裁定**：上述文件均不在本 TASKS 修改范围内。本批次涉及的文件（types.ts、diagnose.ts、format.ts、sanitize-iteration.ts、compute.ts、dashboard/format.ts、dashboard-generate.ts）无任何 TS 错误。vitest 使用 ts-node/vite 编译，50+31 测试全部通过，证明本批次代码可正常编译运行。**可接受**：项目存在既有 TS 债务，本批次未新增。

**建议**：progress 应补充记录「npx tsc --noEmit：项目存在既有 4 处错误，本批次无新增」。

### CA-2：progress 未记录 coach-diagnose 集成验收

**质疑**：TASKS §四 验收命令汇总明确列出「npx ts-node scripts/coach-diagnose.ts | Coach 集成（有数据时须验证输出含整改轮次）」。progress 的「验收命令结果」段落未包含该命令的执行与结果。

**裁定**：**Gap**。验收命令汇总中的强制项（有数据时须验证）应写入 progress。本次审计已复现：coach-diagnose 输出含「整改 0 轮」「各 Stage 整改轮次」「phase_score 已按整改轮次应用阶梯扣分」，功能正确，但**文档层面**未满足「验收表按实际运行结果填写」的 §5 要求。

**修改建议**：在 progress 的验收命令结果中增加一行：`npx ts-node scripts/coach-diagnose.ts: OK，有数据时输出含整改轮次、各 Stage 整改轮次小节、phase_score 阶梯扣分说明`。

### CA-3：US-005 验收表述与实现的对齐

**质疑**：TASKS 写「传入 `{ iteration_count: NaN }`、`{ iteration_count: -1 }`…`{}`」。sanitizeIterationCount 签名为 `(val: number | undefined | null)`，不接收 record 对象。

**裁定**：语义等价。`{}` 表示 record 无 iteration_count，即 `record.iteration_count === undefined`，sanitizeIterationCount(undefined) 已单测覆盖返回 0。format.test.ts 通过 phase_iteration_counts 传入 NaN/-1/1.7/undefined 验证 format 输出「整改 0 轮」「整改 2 轮」正确。**无 Gap**。

### CA-4：行号与路径有效性

**质疑**：progress 写「grep 命中 line 32」。若 types.ts 后续修改，行号可能失效。

**裁定**：本次审计核对 types.ts 当前 L32 仍为 `phase_iteration_counts?: Record<string, number>;`，行号有效。grep 按内容匹配，行号仅为辅助，路径 `scoring/coach/types.ts` 正确。**无 Gap**。

### CA-5：dashboard-generate 产出格式与 US-007 一致性

**质疑**：US-007 要求全 0 时「各 stage 均为一次通过」。dashboard 实际输出为「各 stage 均为一次通过」。是否存在 typo？

**裁定**：format.ts L52 与 dashboard.md 均为「各 stage 均为一次通过」，与 TASKS 要求一致。**无 Gap**。

### CA-6：高迭代小节在有数据且 >0 时的展示

**质疑**：当前 dashboard 数据全 0，输出「各 stage 均为一次通过」。若有 iteration_count>0 的 record，是否应显示具体条目？

**裁定**：compute.test L96-112 与 format.test L19-20 已覆盖 highIterTop3 非空时输出 `E6.S1 spec: 5 轮整改` 格式。dashboard-generate 逻辑正确，当前环境数据全 0 导致显示「各 stage 均为一次通过」符合预期。**无 Gap**。

### CA-7：diagnose phase_iteration_counts 同 stage 取最新的正确性

**质疑**：US-002 要求同 stage 多条时取 timestamp 最新 record 的 iteration_count。diagnose.test L236-282 的用例：spec 有 rec1(10:00, iter=2)、rec2(12:00, iter=5)，期望 spec=5。

**裁定**：diagnose.ts L325-328 按 timestamp 取 latest，rec2 更新，故 phaseIterationCounts.spec=5。单测通过，逻辑正确。**无 Gap**。

### CA-8：§5 验收误伤或漏网

**漏网检查**：有无任务在 TASKS 中列出但未在本文逐项验证？— 无。US-001～013 全部逐项核对。

**误伤检查**：有无因既有项目问题（如 tsc 全局失败）错误判定本批次不通过？— tsc 单独标注为「项目既有问题」，未归咎本批次。

### 批判审计员本轮结论

- **本轮存在 1 个 Gap**：progress 未记录 coach-diagnose 集成验收命令的执行与结果（CA-2）。
- **其余 7 项对抗性质疑**经裁定均无新 gap。
- **修改建议**：在 progress.TASKS_iteration_count_display.txt 的验收命令结果中补充 coach-diagnose 与 tsc 的记录。

---

## 三、输出与收敛

### 结论

**未通过**。

**Gap 清单**：
| # | 项 | 修改建议 |
|---|-----|----------|
| G1 | progress 漏填 coach-diagnose 集成验收 | 在「验收命令结果」中增加：`npx ts-node scripts/coach-diagnose.ts: OK，有数据时输出含整改轮次、各 Stage 整改轮次小节、phase_score 阶梯扣分说明` |
| G2 | progress 漏填 npx tsc --noEmit 说明 | 增加：`npx tsc --noEmit: 项目存在既有 4 处错误（validate-scenario、prompt-optimizer、rule-suggestion、analytics-sft-extract），本批次修改文件无新增错误` |

**实施层面**：13 项 US 均已正确实现，生产代码在关键路径中使用，单测与集成验收（本次复现）均通过。**代码与功能满足要求**。

**文档层面**：progress 验收命令记录不完整，未满足 §5「验收表中的执行情况是否已按实际运行结果填写」的审计项。**需补充 G1、G2 后，方可判定「完全覆盖、验证通过」**。

### 收敛说明

**本轮存在 gap，不计数**。完成 G1、G2 修改并复审后，可进入下一轮；建议累计至 3 轮无 gap 后收敛。

---

**审计完成时间**：2026-03-06
