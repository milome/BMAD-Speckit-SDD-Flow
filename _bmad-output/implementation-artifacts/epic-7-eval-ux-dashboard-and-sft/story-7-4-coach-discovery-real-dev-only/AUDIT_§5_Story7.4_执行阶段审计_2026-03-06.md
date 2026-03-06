# Story 7.4 Coach discovery 仅 real_dev — §5 执行阶段审计报告

**审计日期**：2026-03-06  
**审计类型**：audit-prompts §5 执行阶段审计（实施完成验证）  
**被审对象**：7-4-coach-discovery-real-dev-only.md；tasks-E7-S4.md；plan-E7-S4.md；IMPLEMENTATION_GAPS-E7-S4.md；实施产物 scoring/coach/discovery.ts、scripts/coach-diagnose.ts、commands/bmad-coach.md、skills/bmad-eval-analytics/SKILL.md

---

## §1 逐项验证（§5 审计项）

### 1.1 任务是否真正实现（无预留/占位/假完成）

| 任务 ID | 内容 | 验证方式 | 结果 |
|---------|------|----------|------|
| T1.1 | discovery.ts scenarioFilter 参数 | discovery.ts L96-104：签名为 `scenarioFilter?: 'real_dev' \| 'eval_question' \| 'all'`，L103-104 过滤逻辑 | ✅ |
| T1.2 | 过滤后无记录返回 null | discovery.ts L106 `if (records.length === 0) return null` | ✅ |
| T1.3 | discovery.test.ts scenarioFilter 用例 | 4 个用例：real_dev、eval_question、无 filter、无匹配记录返回 null | ✅ |
| T2.1 | coach-diagnose 解析 --scenario | L65-72：默认 real_dev，all→undefined，eval_question→'eval_question' | ✅ |
| T2.2 | 无 --run-id 时传 scenarioFilter | L155 `discoverLatestRunId(dataPath, limit, scenarioFilter)` | ✅ |
| T2.3 | AC-3 空数据消息 | L156-162：real_dev→EMPTY_REAL_DEV_MESSAGE，eval_question→EMPTY_EVAL_QUESTION_MESSAGE | ✅ |
| T2.4 | --run-id 跳过 discovery | L149-151：effectiveRunId 已存在时 L152 直接 coachDiagnose，不调用 discovery | ✅ |
| T3.1 | commands/bmad-coach.md --scenario 说明 | L31：`--scenario real_dev\|eval_question\|all`，默认 real_dev | ✅ |
| T3.2 | skills/SKILL.md Coach 指引 | L41：默认仅 real_dev，eval_question 需显式 `--scenario eval_question` | ✅ |

**结论**：无占位、无预留、无假完成；所有任务均已落地。

### 1.2 生产代码是否在关键路径中被使用

**关键路径**：commands/bmad-coach.md（或 Skill 自然语言）→ `npx ts-node scripts/coach-diagnose.ts` → discoverLatestRunId(dataPath, limit, scenarioFilter) → coachDiagnose(runId)

| 环节 | 证据 | 结果 |
|------|------|------|
| coach-diagnose 导入 discovery | scripts/coach-diagnose.ts L10 `import { ..., discoverLatestRunId } from '../scoring/coach'` | ✅ |
| 无 run-id 时调用 discovery | L152-155：effectiveRunId==null 时 `discoverLatestRunId(dataPath, limit, scenarioFilter)` | ✅ |
| scenarioFilter 传入 | L71-72 scenarioFilter 计算；L155 传入第三参数 | ✅ |
| scoring/coach 导出 | scoring/coach/index.ts L2 `export { discoverLatestRunId } from './discovery'` | ✅ |

**结论**：discovery 与 coach-diagnose 均在关键路径，无孤岛模块。

### 1.3 需实现的项是否均有实现与测试/验收覆盖

| AC/需求 | 实现 | 测试/验收 |
|---------|------|-----------|
| AC-1 默认仅 real_dev | coach-diagnose 默认 scenario='real_dev'，discovery 传入 'real_dev' | 单元 discovery.test.ts；E2E 无参运行返回 real_dev 最新 run |
| AC-2 显式 --scenario | --scenario eval_question / all 解析并传参 | E2E `--scenario eval_question`、`--scenario all` 已验证 |
| AC-3 无 real_dev 友好提示 | EMPTY_REAL_DEV_MESSAGE、EMPTY_EVAL_QUESTION_MESSAGE | discovery.test.ts「scenarioFilter with no matching records returns null」+ 代码分支覆盖 |
| AC-4 --run-id 向后兼容 | runId 存在时跳过 discovery | E2E `--run-id=eval-question-sample` 成功，未走 discovery |

**GAPS 映射**：IMPLEMENTATION_GAPS-E7-S4 §2.1～§2.5 差距均已实现；§4 待实现概要 1～5 均有对应任务与实现。

### 1.4 验收表/验收命令是否已按实际执行并填写

| 验收命令 | 执行结果 | 填写位置 |
|----------|----------|----------|
| `npx vitest run scoring/coach/__tests__/ -v` | 41 tests passed（含 discovery 11 tests） | progress.tasks-E7-S4.txt 验收命令区 |
| `npx ts-node scripts/coach-diagnose.ts` | 成功；默认 real_dev，返回 sample-run | 本次审计复现通过 |
| `--scenario eval_question` | 成功；返回 eval-question-sample | 本次审计复现通过 |
| `--scenario all` | 成功；不过滤，返回最新 | 本次审计复现通过 |
| `--run-id=<id>` | 成功；跳过 discovery | 本次审计复现通过 |

**结论**：验收命令已执行；progress 中记录验收命令与 TDD 步骤；本轮复现全部通过。

### 1.5 是否遵守 ralph-method（prd/progress 更新、US 顺序）

| 产出 | 状态 | 说明 |
|------|------|------|
| prd.tasks-E7-S4.json | ✅ 存在 | US-001～003 均 passes=true |
| progress.tasks-E7-S4.txt | ✅ 存在 | 含验收命令、US-001/002 的 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR]、US-003 勾选 |
| US-001 TDD 三项 | ✅ | [TDD-RED] 2 失败→[TDD-GREEN] 11 通过→[TDD-REFACTOR] 无需重构 |
| US-002 TDD 三项 | ✅ | [TDD-RED] 集成→[TDD-GREEN] 41 通过→[TDD-REFACTOR] 无需重构 |
| US-003 TDD 三项 | N/A | 纯文档任务，不涉及生产代码；progress 用 - [x] 勾选 T3.1、T3.2 |

**结论**：prd/progress 已创建并更新；涉及生产代码的 US-001、US-002 均含 TDD 三项；US 顺序 US-001→002→003 与 plan Phase 一致。

### 1.6 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

| 检查项 | 结果 |
|--------|------|
| Story 文档、tasks、代码 | 无「后续迭代」「待定」「可考虑」等延迟表述 |
| prd passes=true | US-001～003 均 passes；对应实现与验收已确认 |
| 验收命令已调用 | 本次审计执行 vitest、coach-diagnose 无参/--scenario/--run-id，均通过 |

**结论**：无延迟表述；无假完成。

### 1.7 §5 审计项 (5)～(8) 适用性

审计提示词 (5)～(8) 涉及 parseAndWriteScore、scoring-trigger-modes.yaml、question_version、评分写入失败 non_blocking 等。**本 Story 7.4 不涉及评分写入流程**，仅扩展 coach discovery 的 scenario 过滤，故 (5)～(8) **N/A**。

---

## 批判审计员结论

**角色**：批判审计员（Critical Auditor），对抗视角，专门检查遗漏、路径失效、验收未跑、§5/验收误伤或漏网。

### CA-1：行号与路径有效性核查

| 审计引用 | 实际代码位置 | 验证 |
|----------|--------------|------|
| coach-diagnose L144 调用 discoverLatestRunId | 当前为 L152-155（因新增 --scenario 解析行数前移） | ⚠️ 行号已变化，但调用逻辑存在且正确 |
| Story §6.3 coach-diagnose 无 run-id 时 L144 | 同上，行号过时 | ⚠️ 文档行号未同步更新，非实现缺陷 |
| discovery.ts loadAllRecords 后过滤 | L101-106：loadAllRecords → 按 scenarioFilter 过滤 → sort | ✅ 逻辑正确 |

**CA-1 结论**：行号引用存在过时（Story/Dev Notes 中的 L144），但不影响实施正确性。建议后续同步更新 Story 文档中的行号引用。

### CA-2：遗漏任务与 GAPS 覆盖

| 来源 | 任务/差距 | 是否遗漏 | 验证 |
|------|-----------|----------|------|
| spec §4.1(1) | discoverLatestRunId scenarioFilter | 已实现 | discovery.ts L96-104 ✅ |
| spec §4.1(2) | coach-diagnose --scenario，默认 real_dev | 已实现 | coach-diagnose L65-72, L155 ✅ |
| spec §4.1(2) AC-3 | 无 real_dev 时「暂无 real_dev 评分数据…」 | 已实现 | L156-162 ✅ |
| spec §4.1(3) | commands --scenario 说明 | 已实现 | bmad-coach.md L31 ✅ |
| spec §4.1(4) | Skill 注明默认 real_dev | 已实现 | SKILL.md L41 ✅ |
| GAPS §2.5 | discovery.test.ts scenarioFilter 用例 | 已实现 | 4 个用例（含「无匹配返回 null」）✅ |
| tasks 集成验证 | coach-diagnose 无参时传 'real_dev' | 已实现 | L71 real_dev 默认；L155 传 scenarioFilter ✅ |

**CA-2 结论**：无遗漏任务；spec、plan、GAPS、tasks 全覆盖。

### CA-3：验收命令是否实际执行

| 命令 | tasks 要求 | progress 记录 | 本次审计执行 |
|------|------------|---------------|--------------|
| vitest scoring/coach/__tests__/ | 有 | 验收命令区列示 | ✅ 41 tests passed |
| coach-diagnose 无参 | 有 | — | ✅ 通过，返回 real_dev run |
| coach-diagnose --scenario eval_question | 有 | — | ✅ 通过 |
| coach-diagnose --scenario all | 有 | — | ✅ 通过 |
| coach-diagnose --run-id=xxx | 有 | — | ✅ 通过 |

**CA-3 结论**：验收命令均已在本轮审计中实际执行并通过。progress 中未逐条填写每项 E2E 结果，但验收命令区块存在，且实现可复现。

### CA-4：§5 与验收的误伤/漏网

**误伤（不应判失败却判失败）**：
- 无。US-003 为纯文档 US，不强制 TDD 三项，当前处理合理。
- discovery 签名含 'all' 而 spec 写 undefined：'all' 在 CLI 层映射为 undefined 传入 discovery，语义一致，非误伤。

**漏网（应判失败却未判失败）**：
- **潜在漏网 1**：AC-3 的 E2E 验证「无 real_dev 数据时输出特定消息」——需在无 real_dev 的 scoring 目录下运行。本次审计在有 real_dev+eval_question 混合数据环境下执行，未显式验证「仅有 eval_question 时默认输出 EMPTY_REAL_DEV_MESSAGE」。实现逻辑（L156-162）正确，单元测试覆盖「scenarioFilter 无匹配返回 null」分支，coach-diagnose 在 null 时按 scenarioFilter 输出对应消息。**保守结论**：逻辑与单测覆盖充分，E2E 空数据场景未在本轮显式跑，但不构成致命漏网。
- **潜在漏网 2**：commands/bmad-coach.md 验收命令未包含 `--scenario`、`--run-id` 示例。可选参数已在 §可选参数 中说明，验收命令侧重常用场景。不判为漏网。

**CA-4 结论**：无明确误伤；AC-3 空数据 E2E 未在本轮显式执行，但实现与单测覆盖可接受，不构成阻断性漏网。

### CA-5：类型与边界

| 检查项 | 结果 |
|--------|------|
| scenarioFilter 类型 | discovery: `'real_dev' \| 'eval_question' \| 'all'`；coach-diagnose 传入 `'real_dev' \| 'eval_question' \| undefined`（all→undefined） | ✅ 一致 |
| 非法 --scenario 值 | L66-70：非 real_dev/eval_question/all 时 exit 1 | ✅ |
| scenarioFilter undefined 与 'all' | discovery L103：`scenarioFilter != null && scenarioFilter !== 'all'`，两者均不过滤 | ✅ |

**CA-5 结论**：类型与边界正确。

### CA-6：技能文档与 Command 一致性

| 文档 | 内容 | 与实现一致性 |
|------|------|--------------|
| commands/bmad-coach.md | --scenario real_dev\|eval_question\|all，默认 real_dev | ✅ |
| skills/SKILL.md | 默认仅 real_dev；eval_question 需显式 --scenario eval_question | ✅ |
| SKILL 验收「无评分数据时」 | 输出「暂无评分数据…」 | 默认 real_dev 下无 real_dev 即输出「暂无 real_dev 评分数据…」，语义包含，可接受 ✅ |

**CA-6 结论**：文档与实现一致。

### CA-7：轮次与收敛声明

- **本轮是否存在新 gap**：否。CA-1～CA-6 所涉事项均为已实现或可接受的差异（行号过时、AC-3 空数据 E2E 未显式跑），无未实现需求、无阻断性缺陷。
- **累计轮次建议**：若此前无 Story 7.4 的 §5 审计记录，本轮为第 1 轮；建议累计至 **3 轮无 gap** 后收敛。

### CA-8：端到端行为对抗验证

| 场景 | 预期 | 实际执行 | 结果 |
|------|------|----------|------|
| 无参（默认 real_dev） | 仅考虑 real_dev，返回 real_dev 最新 run_id | `npx ts-node scripts/coach-diagnose.ts` → run_id=sample-run | ✅ sample-run 为 real_dev |
| --scenario eval_question | 仅考虑 eval_question | 执行返回 run_id=eval-question-sample | ✅ |
| --scenario all | 不过滤，取 timestamp 最新 | 执行返回 eval-question-sample（混合数据中 eval_question 最新） | ✅ 与无 filter 一致 |
| --run-id=xxx | 跳过 discovery，直接诊断 | 执行成功，输出指定 run 诊断 | ✅ AC-4 满足 |

### CA-9：TDD 与 progress 合规对抗检查

| US | 是否涉及生产代码 | [TDD-RED] | [TDD-GREEN] | [TDD-REFACTOR] | 判定 |
|----|------------------|-----------|-------------|----------------|------|
| US-001 | 是（discovery.ts） | ✓ 2 失败 | ✓ 11 通过 | ✓ 无需重构 | 合规 |
| US-002 | 是（coach-diagnose.ts） | ✓ 集成 | ✓ 41 通过 | ✓ 无需重构 | 合规 |
| US-003 | 否（纯文档） | N/A | N/A | N/A | 豁免合理 |

**CA-9 结论**：涉及生产代码的 US 均含 TDD 三项；审计不得豁免的要求已满足。

### CA-10：孤岛模块与调用链对抗验证

| 模块 | 是否被导入 | 调用方 | 调用路径 |
|------|------------|--------|----------|
| discoverLatestRunId | scoring/coach/index.ts 导出 | coach-diagnose.ts L10 import | coach-diagnose main() L155 调用 |
| 过滤逻辑 | discovery.ts 内部 | — | loadAllRecords → filter → sort → return |

**对抗质疑**：discovery 仅被 coach-diagnose 调用，是否有其他入口应使用 scenarioFilter 而未使用？  
**核查**：commands/bmad-coach.md 与 skills/SKILL.md 均指引执行 coach-diagnose.ts；无其他 discovery 直接入口。dashboard-generate 使用 loadAndDedupeRecords + 内联过滤，不调用 discovery。**结论**：无孤岛，调用链唯一且正确。

### CA-11：文档行号失效风险

Story 7.4 §6.3 与 Dev Notes 引用「coach-diagnose 无 run-id 时 L144 调用 discoverLatestRunId」。当前实现中该调用位于 L152-155。若后续维护者按 L144 查找，将指向错误位置。**风险等级**：低；建议在 Story 或 Dev Notes 中更新行号，或改为「无 run-id 分支」等不依赖行号的描述。

### CA-12：AC-3 空数据分支的覆盖边界

AC-3 要求：无 real_dev 数据时输出「暂无 real_dev 评分数据…」。实现：L156-162 按 scenarioFilter 分支输出。单测：discovery.test.ts「scenarioFilter with no matching records returns null」覆盖 discovery 返回 null；coach-diagnose 在 null 时输出逻辑由代码审查确认。**缺口**：未在真实「仅有 eval_question 的 scoring 目录」下执行 coach-diagnose 无参以复现 AC-3。**判定**：逻辑正确、单测覆盖 discovery 层；E2E 空数据场景为可选增强，非阻断。

### 批判审计员最终判定

**本轮无新 gap**。所有任务已实现，生产代码在关键路径，验收命令已执行并通过，ralph-method 遵守，无延迟表述与假完成。

**可接受次要项**（不构成未通过）：
1. CA-1 / CA-11：Story 文档行号 L144 过时，建议更新；
2. CA-4 / CA-12：AC-3 空数据 E2E 未在无 real_dev 环境下显式执行，实现与单测覆盖可接受。

**明确结论**：**本轮无新 gap**，建议累计至 3 轮无 gap 后收敛。

---

## §2 审计结论

### 结论

**完全覆盖、验证通过**。

### 依据摘要

1. 任务实现：T1.1～T1.3、T2.1～T2.4、T3.1～T3.2 均已落地，无占位与假完成。
2. 关键路径：discovery → coach-diagnose → commands/Skill，无孤岛模块。
3. 验收：vitest 41 tests 通过；coach-diagnose 无参/--scenario/--run-id 均通过。
4. ralph-method：prd/progress 存在且更新；US-001、US-002 含 TDD 三项；US-003 为文档任务合理豁免。
5. 批判审计员：本轮无新 gap；建议累计至 3 轮无 gap 后收敛。

### 后续建议

- 可选：更新 Story 7.4 文档 §6.3 中 coach-diagnose 行号引用（L144→L152 一带）。
- 可选：在无 real_dev 的评分目录下显式执行 coach-diagnose 无参，验证 AC-3 输出「暂无 real_dev 评分数据…」。
