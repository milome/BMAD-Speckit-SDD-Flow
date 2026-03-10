# tasks-E6-S2.md 覆盖审计报告

**审计对象**：`tasks-E6-S2.md`  
**参照文档**：`spec-E6-S2.md`、`plan-E6-S2.md`、`IMPLEMENTATION_GAPS-E6-S2.md`  
**审计日期**：2026-03-06  
**审计员**：code-reviewer（严苛模式）

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## §1 spec.md 覆盖验证

### 1.1 spec §1 概述

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| 输入来源与 scope 一致性 | 对照 tasks §1 Input、Scope 与 spec §1 | ✅ 覆盖。tasks 声明 Input 含 spec、plan、GAPS；Scope 为 Story 6.2 全部。 |

### 1.2 spec §2 需求映射清单

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| REQ-UX-1.5、1.6、2.2、2.4 可追溯 | 对照 tasks §1 本批任务↔需求追溯、§8 Gaps 映射 | ✅ 覆盖。T1–T5 均有需求文档章节与 GAP 映射。 |

### 1.3 spec §3 功能规格

| spec 章节 | 需求要点 | 对应任务 | 验证结果 |
|-----------|----------|----------|----------|
| §3.1 功能目标 | 入口、数据源、筛选策略、输出 | T1, T3 | ✅ T1.1/T1.3 数据源与筛选；T3 脚本入口 |
| §3.2 参数解析 | --epic N、--story X.Y、互斥、校验 | T3.1, T3.2 | ✅ 格式、互斥、校验均有任务 |
| §3.3.1 run_id 解析 | `-e(\d+)-s(\d+)-`、`-e(\d+)-s(\d+)$` | T1.2 | ✅ T1.2 明确列出正则 |
| §3.3.2 source_path fallback | `epic-{epic}-*/story-{story}-*`、`story-{epic}-{story}-*` | T1.2 | ✅ T1.2 明确列出 fallback 模式 |
| §3.3.3 scenario 过滤 | 排除 eval_question | T1.3, T5.1 | ✅ T1.3 排除逻辑；T5.1 覆盖 scenario 过滤 |
| §3.4 筛选流程 | 加载→过滤→解析→匹配→聚合→无匹配 | T1.3 | ✅ T1.3 完整描述流程 |
| §3.5 coachDiagnose 扩展 | options.records、短路 loadRunRecords | T2 | ✅ T2.1、T2.2 |
| §3.6 无约定数据反馈 | 空记录、无可解析、无匹配三条 error | T1.3, T5.2 | ✅ T1.3 三条 error 文案；T5.2 验证 |
| §3.7 Command 文档 | bmad-coach.md、.cursor/commands | T4 | ✅ T4.1、T4.2 |
| §3.8 验收命令 | 四条验收命令 | T5.2, §7 | ✅ 全部在 T5.2 与 §7 中 |
| §3.9 修改文件一览 | scripts、diagnose/types、coach/、commands | T1–T4 | ✅ 全部覆盖 |

### 1.4 spec §4、§5、§6

| 章节 | 检查项 | 验证结果 |
|------|--------|----------|
| §4 数据源与 schema | RunScoreRecord 不修改，epic_id/story_id 由解析得出 | ✅ 无修改 schema 任务，符合约束 |
| §5 测试要求 | 单元测试 + 集成/端到端 | ✅ T5.1 单元；T5.2 端到端 |
| §6 依赖与约束 | Story 6.1 复用；Story 6.3 未实现时 inline；禁止修改 schema | ✅ 隐含于 T1–T3，无冲突 |

---

## §2 plan.md 覆盖验证

### 2.1 plan §1–§2

| plan 章节 | 检查项 | 验证结果 |
|-----------|--------|----------|
| §1 需求映射 | plan 与 spec/需求文档映射 | ✅ tasks §1、§8 提供映射 |
| §2 目标与约束 | 必须含集成测试与 E2E 计划 | ✅ 见 §3 专项审查 |

### 2.2 plan §3 实施分期

| Phase | plan 描述 | tasks 对应 | 验证结果 |
|-------|-----------|------------|----------|
| Phase 1 | filter-epic-story.ts：loadAllRecords、parseEpicStoryFromRecord、filterByEpicStory | T1.1–T1.4 | ✅ 一致，且 tasks 用 loadAllRecordsForFilter 与 plan §3.3 一致 |
| Phase 2 | CoachDiagnoseOptions.records、diagnose 短路 | T2.1–T2.2 | ✅ 完全对应 |
| Phase 3 | coach-diagnose.ts 解析、filterByEpicStory 调用、无参回归 | T3.1–T3.4 | ✅ 完全对应 |
| Phase 4 | commands 更新 | T4.1–T4.2 | ✅ 完全对应 |
| Phase 5 | 单元测试 + 端到端 | T5.1–T5.3 | ✅ 完全对应 |

### 2.3 plan §4 模块与文件改动设计

| plan 文件 | tasks 任务 | 验证结果 |
|-----------|------------|----------|
| scoring/coach/filter-epic-story.ts | T1 | ✅ |
| scoring/coach/__tests__/filter-epic-story.test.ts | T5.1 | ✅ |
| scoring/coach/types.ts | T2.1 | ✅ |
| scoring/coach/diagnose.ts | T2.2 | ✅ |
| scripts/coach-diagnose.ts | T3 | ✅ |
| commands/bmad-coach.md | T4.1 | ✅ |
| .cursor/commands/bmad-coach.md | T4.2 | ✅ |

### 2.4 plan §5 详细技术方案

| plan 小节 | 检查项 | 验证结果 |
|-----------|--------|----------|
| §5.1 filterByEpicStory 接口 | 返回类型、error 分支 | ✅ T1.3 明确三条 error；与 plan 一致 |
| §5.2 source_path 正则 | epic-(\d+)-[^/]*/story-(\d+)-、story-(\d+)-(\d+)- | ✅ T1.2 包含 |
| §5.3 coach-diagnose.ts 流程 | parseArgs 分支、filterByEpicStory 调用 | ✅ T3.1–T3.4 实现 |
| §5.4 生产代码关键路径验证 | coach-diagnose main 调用链 | ✅ 见 §3 专项审查 |

### 2.5 plan §6 测试计划

| plan 小节 | 内容 | tasks 对应 | 验证结果 |
|-----------|------|------------|----------|
| §6.1 单元测试 | parseEpicStoryFromRecord、filterByEpicStory 覆盖点 | T5.1 | ✅ 覆盖点一致 |
| §6.2 集成测试 | --epic 3、--story 3.3 有数据/无匹配/互斥/格式错误 | T5.2 | ✅ 命令一致 |
| §6.3 端到端/CLI 验收 | AC-1、AC-2、AC-3、空目录、无参回归、互斥、格式错误 | T5.2、§7 | ✅ 全部覆盖 |

### 2.6 plan §7 执行准入标准

| 检查项 | 验证结果 |
|--------|----------|
| 任务具备明确文件路径与验收命令 | ✅ 所有任务有路径；§7 有验收命令汇总 |
| filter-epic-story 单测 + 端到端 CLI 验收 | ✅ T5.1 + T5.2 |
| npm run test:scoring 通过后收尾 | ✅ T5.3 |

---

## §3 IMPLEMENTATION_GAPS 覆盖验证

### 3.1 GAP 逐条映射

| Gap ID | 需求要点 | tasks 对应 | 验证结果 |
|--------|----------|------------|----------|
| GAP-E6-S2-1 | --epic N 解析与分支 | T3 | ✅ |
| GAP-E6-S2-2 | --story X.Y 解析与分支 | T3 | ✅ |
| GAP-E6-S2-3 | epic_id/story_id 解析规则 | T1.2, T5.1 | ✅ |
| GAP-E6-S2-4 | scenario !== eval_question | T1.3, T5.1 | ✅ |
| GAP-E6-S2-5 | run_id 正则、source_path fallback | T1.2 | ✅ |
| GAP-E6-S2-6 | filterByEpicStory 完整流程 | T1.3 | ✅ |
| GAP-E6-S2-7 | options.records、短路 loadRunRecords | T2 | ✅ |
| GAP-E6-S2-8 | 无约定数据明确反馈 | T1.3, T3.3 | ✅ |
| GAP-E6-S2-9 | Command 文档 --epic、--story | T4 | ✅ |
| GAP-E6-S2-10 | 参数互斥、格式校验 | T3.1, T3.2 | ✅ |
| GAP-E6-S2-11 | 单元测试 | T5.1 | ✅ |

### 3.2 GAPS §3 依赖关系与实施顺序

| 检查项 | 验证结果 |
|--------|----------|
| Phase 1→2→3→4→5 顺序 | ✅ tasks §2–§6 按 Phase 1–5 排序 |
| 各 Phase 依赖关系 | ✅ T3 依赖 T1、T2；T5 依赖 T1–T4 |

---

## §4 专项审查（一）：集成测试与端到端

### 4.1 要求

每个功能模块/Phase 须包含**集成测试与端到端功能测试**任务及用例，**严禁仅有单元测试**。

### 4.2 逐 Phase 验证

| Phase | 模块 | 单元测试 | 集成/E2E 测试 | 验证结果 |
|-------|------|----------|---------------|----------|
| Phase 1 | filter-epic-story.ts | T5.1 filter-epic-story.test.ts | T5.2 端到端：`--epic 3`、`--story 3.3` 等执行脚本，该模块在生产路径中被调用 | ✅ **通过**。T5.1 为单元；T5.2 通过脚本调用覆盖集成与 E2E。 |
| Phase 2 | CoachDiagnoseOptions.records、diagnose 短路 | 无独立单测 | T5.2 脚本传入 records 后 coachDiagnose 正确输出 | ✅ **通过**。T2 的「集成验证：T5.2」明确覆盖；E2E 执行时即验证 records 注入路径。 |
| Phase 3 | scripts/coach-diagnose.ts | 无 | T5.2 端到端验收 | ✅ **通过**。T5.2 直接验证脚本行为。 |
| Phase 4 | Command 文档 | 无（文档非代码模块） | 手动验收 | ⚪ **N/A**。文档不属功能模块，无集成/E2E 要求。 |
| Phase 5 | 测试 | 元任务 | T5.1 + T5.2 | ✅ 覆盖完整 |

### 4.3 结论

**通过**。Phase 1–3 均有端到端验收（T5.2），且明确覆盖集成路径，未出现「仅单元测试」的 Phase。

---

## §5 专项审查（二）：生产代码关键路径集成验证

### 5.1 要求

每个模块的验收标准须包含「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证。

### 5.2 逐模块验证

| 模块 | 生产路径 | 集成验证任务 | 验证结果 |
|------|----------|--------------|----------|
| filter-epic-story.ts | scripts/coach-diagnose.ts 在 --epic/--story 分支调用 filterByEpicStory | Phase 1 AC：「集成验证：T5.2（脚本 --epic、--story 可执行）」 | ✅ **通过**。T5.2 执行脚本即验证导入与调用。 |
| CoachDiagnoseOptions.records、diagnose 短路 | coach-diagnose.ts 调用 coachDiagnose(runId, { records }) | Phase 2 AC：「集成验证：T5.2（脚本传入 records 后 coachDiagnose 正确输出）」 | ✅ **通过**。 |
| coach-diagnose.ts --epic/--story 分支 | main() 解析 → filterByEpicStory → coachDiagnose | Phase 3 AC：「集成验证：T5.2 端到端验收」 | ✅ **通过**。 |
| 完成判定标准 §9 | 明确要求「每个模块的验收须包含该模块在生产代码关键路径（scripts/coach-diagnose.ts）中被导入并调用的集成验证」 | — | ✅ **通过**。与专项要求一致。 |

### 5.3 结论

**通过**。各模块均具备「在生产路径中被导入并调用」的集成验证。

---

## §6 专项审查（三）：孤岛模块风险

### 6.1 要求

不得存在「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的孤岛模块。

### 6.2 风险分析

| 模块 | 孤岛风险 | 防护措施 | 验证结果 |
|------|----------|----------|----------|
| filter-epic-story.ts | 实现 T1 但 T3 未导入/调用 | T3.3 明确「调用 filterByEpicStory(dataPath, ...)」；T5.2 要求 `--epic 3`、`--story 3.3` 有数据时输出诊断 | ✅ **无孤岛**。漏导入会导致 T5.2 失败。 |
| CoachDiagnoseOptions.records | T2 实现但脚本未传 records | T3.3 明确「调用 coachDiagnose(runId, { dataPath, records })」；T5.2 验证 | ✅ **无孤岛**。 |
| diagnose.ts 短路逻辑 | T2.2 实现但永不触发 | 同上，T3.3 传入 records 即触发 | ✅ **无孤岛**。 |

### 6.3 结论

**通过**。无孤岛模块，T3.3 与 T5.2 形成闭环。

---

## §7 遗漏与偏差核查

### 7.1 潜在遗漏

| 检查项 | 说明 | 结论 |
|--------|------|------|
| spec §3.3.2 story-5-eval 单参数模式 | RUN_ID_CONVENTION 有 story-5-eval... → (5, ?) 单 epic 情况 | ✅ spec §3.3.2 以 story-4-2 为主，tasks 以 `story-(\d+)-(\d+)-` 覆盖双参数；单参数为可选扩展，非本 Story 必选 |
|  automated E2E 脚本 | 是否有类似 accept:e6-s2 的 npm script | ⚪ **建议项**。plan §6.2 允许「脚本 E2E 或手动」，当前为手动执行验收命令；增加 `accept:e6-s2` 可提升自动化。非必须。 |
| plan loadAllRecords vs loadAllRecordsForFilter | 命名一致性 | ✅ plan §3.3 已用 loadAllRecordsForFilter，与 tasks T1.1 一致 |

### 7.2 与 RUN_ID_CONVENTION 对齐

| RUN_ID §2、§3 规则 | tasks 覆盖 | 验证结果 |
|--------------------|------------|----------|
| run_id `-e(\d+)-s(\d+)-`、`-e(\d+)-s(\d+)$` | T1.2 | ✅ |
| source_path epic-{N}-*/story-{N}-*、story-{epic}-{story}-* | T1.2 | ✅ |
| eval_question 不参与 Epic/Story 筛选 | T1.3 | ✅ |

---

## §8 验证命令执行（可选）

以下命令可用于实际验证（当前实现尚未完成，仅作结构校验）：

```bash
# 单元测试（实施后）
npm run test:scoring -- scoring/coach/__tests__/filter-epic-story.test.ts

# 端到端（实施后）
npx ts-node scripts/coach-diagnose.ts --epic 3
npx ts-node scripts/coach-diagnose.ts --story 3.3
npx ts-node scripts/coach-diagnose.ts --epic 3 --story 3.3  # 应报错
npx ts-node scripts/coach-diagnose.ts --epic abc            # 应报错
npx ts-node scripts/coach-diagnose.ts                        # 无参回归
```

---

## §9 审计结论

| 审计项 | 结果 |
|--------|------|
| spec.md 全章节覆盖 | ✅ 通过 |
| plan.md 全章节覆盖 | ✅ 通过 |
| IMPLEMENTATION_GAPS 全 GAP 覆盖 | ✅ 通过 |
| 专项（1）每个 Phase 含集成/E2E、非仅单测 | ✅ 通过 |
| 专项（2）每个模块含生产路径集成验证 | ✅ 通过 |
| 专项（3）无孤岛模块 | ✅ 通过 |

**结论：完全覆盖、验证通过。**

tasks-E6-S2.md 对 spec-E6-S2.md、plan-E6-S2.md、IMPLEMENTATION_GAPS-E6-S2.md 的覆盖完整，三项专项审查均满足要求，无遗漏章节或未覆盖要点。建议项：可增加 `accept:e6-s2` 或类似 npm script 以自动化 E2E 验收，非必须。
