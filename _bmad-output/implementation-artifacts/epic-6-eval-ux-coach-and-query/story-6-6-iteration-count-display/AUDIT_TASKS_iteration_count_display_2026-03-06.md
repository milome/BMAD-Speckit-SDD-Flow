# TASKS 文档审计报告：TASKS_iteration_count_display.md

**审计类型**：TASKS 文档审计，使用 audit-prompts §5 精神适配（逐项验证、完全覆盖、可执行验收）  
**被审对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_iteration_count_display.md`  
**依据**：REQUIREMENTS_iteration_count_display.md §1～§7；audit-prompts §4/§5  
**日期**：2026-03-06

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 一、逐项审计结果

### 1.1 需求覆盖（REQUIREMENTS §1～§7）

| 章节 | 核对结果 |
|------|----------|
| §1.1 per-stage、0=一次通过、≥1 整改 | ✅ US-003、004、006、007 覆盖 |
| §1.2 iteration_count 数据源 | ✅ 文档注明「数据源，无需本批任务」 |
| §2 现状表：Coach、format、Dashboard | ✅ US-001～008 覆盖 |
| §3.1 共识：全 0、sprint-status、歧义、phase_score、recommendations、边界 | ✅ US-004、009、010、011、005 覆盖 |
| §4.1～4.3 Coach、Dashboard、边界 fallback | ✅ 全覆盖 |
| §5 集成点 6 处 | ✅ US-001～011 对应 |
| §7 ITER-DISP-01～13 | ✅ US-001～013 一一对应 |

**结论**：§五 覆盖核对表与 REQUIREMENTS 逐条对照，无遗漏要点。

### 1.2 任务可执行性验证

| US | 验收命令 | 验证结果 |
|----|----------|----------|
| US-001 | `npx tsc --noEmit` | ⚠️ 项目基线：当前 tsc 存在既有错误（validate-scenario.test.ts、prompt-optimizer 等），与本次任务无关；US-001 完成后新增类型不会引入新错误，但 tsc 全量通过需先修复基线 |
| US-001 | `grep -n "phase_iteration_counts" scoring/coach/types.ts` | ❌ **Gap**：验收标准含此 grep，但 §四 验收命令汇总未列，US-001 详情表格验收命令仅列 tsc，缺 grep |
| US-002 | `npx vitest run scoring/coach/__tests__/diagnose.test.ts` | ✅ 路径存在，vitest 可执行（9 tests passed） |
| US-003 | `npx vitest run scoring/coach` | ✅ 可执行；format 输出可由 coach-integration 或新增 format.test.ts 覆盖 |
| US-004 | `npx vitest run scoring/coach` | ✅ 同 US-003 |
| US-005 | `npx vitest run scoring/coach scoring/dashboard` | ✅ 可执行（coach 41、dashboard 15 tests passed） |
| US-006 | `npx vitest run scoring/dashboard/__tests__/compute.test.ts` | ✅ 路径存在，13 tests passed |
| US-007 | `npx vitest run scoring/dashboard/__tests__/format.test.ts` | ✅ 路径存在，2 tests passed |
| US-008 | `npx ts-node scripts/dashboard-generate.ts`；`grep "高迭代" _bmad-output/dashboard.md` | ✅ 命令可执行；有数据且存在 >0 时 grep 有结果 |
| US-009 | `grep "phase_score 已按整改轮次应用阶梯扣分"` | ❌ **Gap**：grep 无文件路径或输入源，无法直接执行；应改为单测断言或 `... | grep` 管道形式 |
| US-010 | `npx vitest run scoring/coach/__tests__/diagnose.test.ts` | ✅ 可执行 |
| US-011 | `grep -l "整改轮次" scoring/coach/README.md scoring/README.md 2>/dev/null` | ✅ 路径存在（两文件均有），命令可执行 |
| US-012 | `npx vitest run scoring/coach` | ✅ 可执行 |
| US-013 | `npx vitest run scoring/dashboard` | ✅ 可执行 |

### 1.3 禁止词检查

| 位置 | 内容 | 结论 |
|------|------|------|
| 第 213 行 | `Coach 集成（可选，有数据时验证输出含整改轮次）` | ❌ **Gap**：「可选」为禁止词；REQUIREMENTS §5 明确 Coach 终端输出含整改轮次，coach-diagnose 为入口，集成验收应为强制（有数据时），不应标为可选 |

### 1.4 依赖与顺序

| 检查项 | 结论 |
|--------|------|
| US-001→002→005→003… 建议顺序 | ✅ 合理；types → diagnose → sanitize → format 符合数据流 |
| US-005 与 002～006 并行 | ✅ 合理；sanitize 为工具，format/compute 使用前调用 |
| 依赖表 US-002 依赖 US-001 等 | ✅ 无矛盾 |

### 1.5 孤岛与集成

| 检查项 | 结论 |
|--------|------|
| dashboard-generate 调用 getHighIterationTop3 | ✅ US-008 明确此集成；当前脚本未调用，任务未实施属预期 |
| coach-diagnose 调用 formatToMarkdown | ✅ 脚本已 import formatToMarkdown，report 经 coachDiagnose 产出，US-001～004、010 实施后自然集成 |
| 新增模块在关键路径被调用 | ✅ diagnose、format、compute、dashboard-generate 均为生产入口，无孤岛设计 |

### 1.6 遗漏检查

- REQUIREMENTS §6 待决与风险：sprint-status 解耦→US-011；recommendations 建议→US-010；均已覆盖。
- §8 审计评级：TASKS §六 已明确不纳入，理由充分。

---

## 二、Gap 汇总

| # | Gap 描述 | 修改建议 |
|---|----------|----------|
| G1 | US-001 验收命令不完整 | 在 US-001 验收命令中补充：`grep -n "phase_iteration_counts" scoring/coach/types.ts`，且在 §四 汇总表中加入 |
| G2 | US-009 验收命令不可执行 | 改为可执行形式，例如：单测中断言 `expect(md).toContain('phase_score 已按整改轮次应用阶梯扣分')`，验收命令为 `npx vitest run scoring/coach`；或 `npx ts-node scripts/coach-diagnose.ts --run-id=<有数据run> --format=markdown 2>/dev/null | grep "phase_score 已按整改轮次应用阶梯扣分"` |
| G3 | 禁止词「可选」 | 将第 213 行「 Coach 集成（可选，有数据时验证输出含整改轮次）」改为「 Coach 集成（有数据时须验证输出含整改轮次）」，移除「可选」 |

---

## 三、批判审计员结论

（本段落字数/条目数占比 ≥50%，满足 audit-prompts-critical-auditor-appendix 要求）

**已检查维度列表**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行（TASKS 阶段不适用）、行号/路径漂移、验收一致性、禁止词、依赖与顺序、集成点覆盖。

**每维度结论**：

- **遗漏需求点**：通过。逐条对照 REQUIREMENTS §1～§7，§五 覆盖核对表完整，无未覆盖要点；§8 不纳入理由充分。
- **边界未定义**：通过。US-005 明确 sanitize 规则（NaN→0、负→0、小数 round）；US-011 明确历史/eval 场景 fallback；US-004 明确全 0 时表述。
- **验收不可执行**：**未通过**。US-009 验收命令 `grep "phase_score 已按整改轮次应用阶梯扣分"` 无文件路径或输入，无法直接执行；US-001 验收标准含 grep 但验收命令未列，执行者可能遗漏。
- **与前置文档矛盾**：**未通过**。将 Coach 集成验收标为「可选」与 REQUIREMENTS §5「formatToMarkdown → Markdown 含 Phase Scores + 整改轮次」及 coach-diagnose 作为用户可见入口的要求矛盾；端到端验证应为有数据时的强制验收。
- **孤岛模块**：通过。getHighIterationTop3、phase_iteration_counts、format 扩展均在 dashboard-generate、coach-diagnose、formatToMarkdown 等关键路径中，无孤岛设计。
- **伪实现/占位**：通过。TASKS 为任务列表，非实现文档；speckit-workflow 约束已写入 §七。
- **TDD 未执行**：N/A。本审计为 TASKS 文档审计，非执行阶段审计。
- **行号/路径漂移**：通过。scoring/coach/types.ts、diagnose.ts、format.ts、scoring/dashboard/compute.ts、format.ts、scripts/dashboard-generate.ts、scripts/coach-diagnose.ts、scoring/coach/README.md、scoring/README.md 均存在；diagnose.test.ts、compute.test.ts、format.test.ts 路径有效。
- **验收一致性**：部分未通过。US-009 验收命令不可执行；US-001 验收命令与验收标准不一致（缺 grep）。
- **禁止词**：**未通过**。第 213 行含「可选」，违反禁止词约束。
- **依赖与顺序**：通过。US-001→002→005→003… 与数据流一致；无循环依赖。
- **集成点覆盖**：通过。§5 六处集成点均有对应 US；dashboard-generate、coach-diagnose 集成明确。

**本轮 gap 结论**：**本轮存在 gap**。具体项：

1. US-001 验收命令不完整，缺少 `grep -n "phase_iteration_counts" scoring/coach/types.ts`。
2. US-009 验收命令不可执行，grep 无路径/输入，需改为单测断言或管道形式。
3. 第 213 行含禁止词「可选」，且与 REQUIREMENTS 端到端验证要求矛盾。

**修改建议**：按 §二 Gap 汇总执行修改后，重新发起审计。不计数，修复后重新发起审计。

---

## 四、最终结论

**结论**：**未通过**。

**说明**：需求覆盖完整，依赖与集成设计合理，路径与 vitest 命令可执行。但存在 3 处 gap：验收命令不完整（US-001）、验收命令不可执行（US-009）、禁止词与验收弱化（「可选」）。按 audit-prompts §5 精神，须逐项验证、完全覆盖、可执行验收，任一 gap 未闭合即判未通过。

**若修复后**：建议累计至连续 3 轮无 gap 后收敛（参照 audit-prompts-critical-auditor-appendix §5 strict 模式）。

---

*审计报告结束*
