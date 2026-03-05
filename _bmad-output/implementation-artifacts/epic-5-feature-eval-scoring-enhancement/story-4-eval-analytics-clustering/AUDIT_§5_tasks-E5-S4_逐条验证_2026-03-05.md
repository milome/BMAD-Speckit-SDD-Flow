# 审计报告：tasks-E5-S4.md 逐条验证

**审计日期**：2026-03-05  
**审计依据**：Story 5.4、spec-E5-S4.md、plan-E5-S4.md、IMPLEMENTATION_GAPS-E5-S4.md  
**被审计文件**：`specs/epic-5/story-4-eval-analytics-clustering/tasks-E5-S4.md`  
**审计员**：code-reviewer（批判审计员 >60%）

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit |

---

## 一、需求覆盖逐条验证

### 1.1 spec-E5-S4.md 覆盖验证

| spec 章节 | 内容摘要 | tasks 对应 | 验证方式 | 结果 |
|-----------|----------|------------|----------|------|
| §1 概述 | B06 能力短板聚类分析 | tasks  scope、T1–T4 | 范围声明一致 | ✅ |
| §2.1 In Scope | 新增 cluster-weaknesses、两层分析、minFrequency=2、severity、coach 集成、CLI、零 ML | T1.1–T1.7, T2, T3 | 逐项对照 | ✅ |
| §2.2 Out of Scope | B07/B08/B09 由 Story 5.5 | tasks 未涉及其它 | 范围正确 | ✅ |
| §2.3 修改文件 | diagnose.ts、types.ts | T2.1, T2.2 | 明确列出 | ✅ |
| §3.1.1 WeaknessCluster | cluster_id、primary_item_ids、frequency、keywords、severity_distribution、affected_stages | T1.1 | 字段齐全 | ✅ |
| §3.1.2 主函数 | clusterWeaknesses(records, minFrequency?)、空 records→[]、frequency 降序 | T1.2, T1.7 | 含空 records 处理 | ✅ |
| §3.1.3 层 1 | passed=false、item_id 聚合、minFrequency 过滤 | T1.3 | 明确 | ✅ |
| §3.1.4 层 2 | 正则分词、停用词、top-5、空 note→[] | T1.4 | 停用词列全 | ✅ |
| §3.1.5 severity_distribution | ≤-10→高、-10~-5→中、>-5/null→低 | T1.5 | 含 null/undefined | ✅ |
| §3.1.6 affected_stages | records.stage 聚合去重 | T1.6 | 明确 | ✅ |
| §3.2 coachDiagnose | buildWeakAreas 后调用、异常容错 | T2.2 | try-catch 明确 | ✅ |
| §3.3 CLI | --dataPath、--minFrequency、--output、*.json+scores.jsonl | T3.1–T3.2 | 加载逻辑完整 | ✅ |
| §4 AC 映射 | AC-B06-1~7 | §1 映射表、T4 | 全部覆盖 | ✅ |

**spec 覆盖结论**：✅ 完全覆盖

---

### 1.2 plan-E5-S4.md 覆盖验证

| plan 章节 | 内容摘要 | tasks 对应 | 验证方式 | 结果 |
|-----------|----------|------------|----------|------|
| §1 目标与约束 | 仅 B06、两层分析、零 ML、clusterWeaknesses 由 coach 调用、独立失败不阻断 | T1–T2、T2.2 | 约束一致 | ✅ |
| §1 测试约束 | **必须包含**完整的集成测试与端到端功能测试计划 | T4.2, T4.3 | 见专项审查 | ✅ |
| §2 Phase 1 (7 项) | 新增文件、层 1/2、severity、cluster_id、affected_stages、降序 | T1.1–T1.7 | 一一对应 | ✅ |
| §2 Phase 2 (2 项) | types 新增、diagnose 调用+容错 | T2.1, T2.2 | 顺序正确 | ✅ |
| §2 Phase 3 (3 项) | CLI、加载、输出 | T3.1–T3.2 | 合并为 2 子任务 | ✅ |
| §2 Phase 4 (4 项) | 5 单测、coach 集成断言、CLI 验收、全量回归 | T4.1–T4.4 | 完全一致 | ✅ |
| §3.1 新增文件 | cluster-weaknesses.ts、cluster-weaknesses.test.ts、analytics-cluster.ts | T1.1, T4.1, T3.1 | 3 个文件 | ✅ |
| §3.2 修改文件 | diagnose.ts、types.ts | T2.1, T2.2 | 2 个文件 | ✅ |
| §4.1 调用链路 | 输入、聚合、过滤、分词、severity、stage、排序 | T1.2–T1.7 | 逻辑一致 | ✅ |
| §4.2 coach 集成点 | buildWeakAreas 后、loadRunRecords 已存在 | T2.2 | 明确 | ✅ |
| §4.3 生产关键路径验证 | coachDiagnose 含 weakness_clusters；CLI 可执行 | T4.2, T4.3 | 对应 | ✅ |
| §5.1 单元测试 | 5 用例 | T4.1 | 用例一一列举 | ✅ |
| §5.2 集成测试 | diagnose/coach-integration 中 weakness_clusters 断言 | T4.2 | 明确 | ✅ |
| §5.3 端到端/CLI | CLI 可执行、全链路回归 | T4.3, T4.4 | 明确 | ✅ |
| §6 需求追溯 | AC-B06-1~7 ↔ plan ↔ tasks | §1、§7 | 映射完整 | ✅ |
| §7 准入标准 | 5 单测+coach 集成+CLI 可执行；npm run test:scoring 通过 | T4.1–T4.4 | 覆盖 | ✅ |

**plan 覆盖结论**：✅ 完全覆盖

---

### 1.3 IMPLEMENTATION_GAPS-E5-S4.md 覆盖验证

| GAP 章节 | Gap ID | 目标状态 | tasks 对应 | 验证方式 | 结果 |
|----------|--------|----------|------------|----------|------|
| §2.1 | GAP-E5-S4-B06-1 | cluster-weaknesses.ts 完整实现 | T1.1–T1.7 | §7 映射表 | ✅ |
| §2.1 | GAP-E5-S4-B06-2 | 5 个单测用例 | T4.1 | 5 用例列全 | ✅ |
| §2.2 | GAP-E5-S4-B06-3 | types 新增 weakness_clusters | T2.1 | 明确 | ✅ |
| §2.2 | GAP-E5-S4-B06-4 | diagnose 调用 clusterWeaknesses + 容错 | T2.2 | try-catch 明确 | ✅ |
| §2.3 | GAP-E5-S4-B06-5 | analytics-cluster.ts，*.json+scores.jsonl 全量加载 | T3.1–T3.2 | 加载逻辑独立 | ✅ |
| §2.4 | GAP-E5-S4-B06-6 | coach 测试中 weakness_clusters 断言 | T4.2 | diagnose/coach-integration | ✅ |
| §2.4 | GAP-E5-S4-B06-7 | CLI 可执行验收 | T4.3 | 命令明确 | ✅ |
| §3 依赖顺序 | Phase 1→2→3→4；T2.1 先于 T2.2 | tasks 执行方式 | 顺序一致 | ✅ |
| §3 CLI 独立 | 不采用 loadRunRecords，独立加载全量 | T3.2 | 描述为独立加载逻辑 | ⚠️ 见下 |
| §4 风险缓解 | clusterWeaknesses 异常→try-catch | T2.2 | 明确 | ✅ |
| §4 风险缓解 | note 格式多样性→正则+空 note | T1.4 | 覆盖 | ✅ |
| §5 Gap→Task | 7 个 Gap 全部映射 | §7 映射表 | 一一对应 | ✅ |

**GAP §3「CLI 加载逻辑独立」**：Gap 写明「CLI 加载逻辑独立于 loadRunRecords」「需读取 dataPath 下所有 *.json 与 scores.jsonl」。tasks T3.2 仅描述加载逻辑（读 *.json、解析 scores.jsonl），未显式写出「不采用 loadRunRecords」。从实现角度，CLI 需求与 coach 不同，T3.2 已足以引导独立实现；若需更强可验证性，可建议在 T3.2 补充一句：「加载逻辑独立于 loadRunRecords，不按 run_id 过滤。」

**GAP 覆盖结论**：✅ 基本完全覆盖（上述为可选强化）

---

### 1.4 Story 5.4 覆盖验证

| Story 章节 | 内容摘要 | tasks 对应 | 验证方式 | 结果 |
|------------|----------|------------|----------|------|
| §0 Party-Mode | 两层分析、minFrequency=2、零 ML、停用词 | T1.4, T1.2, T1.7 | 已纳入 | ✅ |
| §1 Story | 能力短板识别 → 结构化聚类 | T1–T4 整体 | 功能对应 | ✅ |
| §2.1 范围 | B06 clusterWeaknesses、层 1/2、severity、coach 集成 | T1, T2 | 一致 | ✅ |
| §3 AC | AC-B06-1~7 | §1、T4 | 全部覆盖 | ✅ |
| §4 Tasks | Task 1~3 与子任务 | T1–T3 细化 | 更细粒度 | ✅ |
| §5.1 技术约束 | minFrequency、停用词、分词、独立性、向后兼容 | T1, T2 | 一致 | ✅ |
| §5.2 架构 | coachDiagnose 调用、records 来源 | T2.2 | 明确 | ✅ |
| §5.4 新增 3 文件 | cluster-weaknesses.ts、test、CLI | T1.1, T4.1, T3.1 | 对应 | ✅ |
| §5.5 修改 2 文件 | diagnose.ts、types.ts | T2.1, T2.2 | 对应 | ✅ |

**Story 覆盖结论**：✅ 完全覆盖

---

## 二、专项审查

### 2.1 集成测试与端到端测试覆盖（严禁仅有单元测试）

| Phase | 模块 | 单元测试 | 集成测试 | 端到端测试 | 验证方式 | 结果 |
|-------|------|----------|----------|------------|----------|------|
| Phase 1 | cluster-weaknesses | T4.1（5 用例） | T4.2（coach path） | T4.3（CLI path） | T4.2 断言 report.weakness_clusters；T4.3 CLI 可执行 | ✅ |
| Phase 2 | coachDiagnose 集成 | （复用 T4.1） | T4.2 | — | diagnose/coach-integration 补充 weakness_clusters 断言 | ✅ |
| Phase 3 | CLI analytics-cluster | — | — | T4.3 | CLI 运行并输出合法 JSON | ✅ |
| Phase 4 | 测试与验收 | T4.1 | T4.2 | T4.3, T4.4 | 汇总 | ✅ |

**验证**：
- Phase 1 的 cluster-weaknesses：除 T4.1 单测外，通过 T4.2 验证 coach 路径、T4.3 验证 CLI 路径，满足「严禁仅有单元测试」。
- Phase 2：通过 T4.2 集成测试验证 coach 集成。
- Phase 3：通过 T4.3 CLI 验收实现端到端验证。

**结论**：✅ 无「仅有单元测试」的 Phase；集成与 E2E 均覆盖。

---

### 2.2 生产关键路径集成验证

| 模块 | 生产关键路径 | 验收任务 | 验收标准是否包含「导入、实例化、调用」 | 结果 |
|------|--------------|----------|----------------------------------------|------|
| cluster-weaknesses | coachDiagnose（diagnose.ts） | T4.2 | report.weakness_clusters 存在且为 WeaknessCluster[] → 可反推 clusterWeaknesses 已被调用 | ✅ |
| cluster-weaknesses | CLI analytics-cluster.ts | T4.3 | CLI 可执行且输出合法 JSON → 可反推 clusterWeaknesses 已被调用 | ✅ |
| coach types + diagnose | coachDiagnose 流水线 | T4.2 | weakness_clusters 断言 + weak_areas 向后兼容 | ✅ |

**tasks §8 完成判定标准**：「每个模块的验收须包含该模块在生产代码关键路径（coachDiagnose、CLI analytics-cluster）中被导入并调用的集成验证。」

- cluster-weaknesses 在 coach 路径：T4.2 覆盖 ✅  
- cluster-weaknesses 在 CLI 路径：T4.3 覆盖 ✅  

**结论**：✅ 满足「生产关键路径」集成验证要求。

---

### 2.3 孤岛模块检查

| 模块 | 生产代码调用点 | 验证任务 | 是否存在孤岛 | 结果 |
|------|----------------|----------|--------------|------|
| cluster-weaknesses.ts | ① diagnose.ts 的 coachDiagnose ② scripts/analytics-cluster.ts | T2.2, T3.1–T3.2；T4.2, T4.3 | 否 | ✅ |
| CoachDiagnosisReport.weakness_clusters | diagnose.ts 填充 | T2.1, T2.2；T4.2 | 否 | ✅ |
| scripts/analytics-cluster.ts | 独立入口，调用 clusterWeaknesses | T3, T4.3 | 否 | ✅ |

**结论**：✅ 不存在「仅通过单测、 never 在生产路径被调用」的孤岛模块。

---

## 三、逐项验证汇总

### 3.1 需求追溯完整性

| 来源文档 | 章节数 | 已覆盖 | 遗漏 | 状态 |
|----------|--------|--------|------|------|
| spec-E5-S4.md | §1–§5 | 全部 | 0 | ✅ |
| plan-E5-S4.md | §1–§7 | 全部 | 0 | ✅ |
| IMPLEMENTATION_GAPS-E5-S4.md | §1–§5 | 7/7 Gap | 0（可选：T3.2 显式写「独立于 loadRunRecords」） | ✅ |
| Story 5.4 | §0–§10 | 全部 | 0 | ✅ |

### 3.2 Gaps 映射完整性

| Gap ID | 对应任务 | 验收命令 | 状态 |
|--------|----------|----------|------|
| GAP-E5-S4-B06-1 | T1.1–T1.7 | npm run test:scoring -- scoring/analytics/__tests__/cluster-weaknesses.test.ts | ✅ |
| GAP-E5-S4-B06-2 | T4.1 | 同上 | ✅ |
| GAP-E5-S4-B06-3 | T2.1 | 随 T2.2 集成验证 | ✅ |
| GAP-E5-S4-B06-4 | T2.2 | npm run test:scoring -- scoring/coach/__tests__/diagnose.test.ts | ✅ |
| GAP-E5-S4-B06-5 | T3.1–T3.2 | npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2 | ✅ |
| GAP-E5-S4-B06-6 | T4.2 | 同上 + coach-integration | ✅ |
| GAP-E5-S4-B06-7 | T4.3 | CLI 验收命令 | ✅ |

### 3.3 验收命令可执行性

| 命令 | 预期行为 | 验证方式 |
|------|----------|----------|
| npm run test:scoring -- scoring/analytics/__tests__/cluster-weaknesses.test.ts | 运行 cluster-weaknesses 单测 | vitest 模式正确 |
| npm run test:scoring -- scoring/coach/__tests__/diagnose.test.ts | 运行 coach 相关测试 | 项目已有该路径 |
| npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2 | CLI 执行并输出 JSON | 脚本待实现 |
| npm run test:scoring | 全量 scoring 回归 | 常规命令 |

**结论**：验收命令格式正确，可执行（实施后）。

---

## 四、发现的可选改进（非阻塞）

1. **T3.2 显式独立性**：GAP §3 明确 CLI 加载逻辑独立于 loadRunRecords。T3.2 可补充一句：「加载逻辑独立于 loadRunRecords，不按 run_id 过滤」，便于实现者避免误用。
2. **Phase 1 集成可追溯性**：Phase 1 段落仅列出 AC-B06-1~5，未直接提及 T4.2/T4.3 的集成/E2E 验证。可在 Phase 1 的 AC 或说明中增加：「本 Phase 模块的集成验证见 T4.2（coach 路径）与 T4.3（CLI 路径）。」

以上为可读性与可追溯性增强，不构成通过/不通过的条件。

---

## 五、审计结论

### 逐条检查汇总

| 检查项 | 结果 |
|--------|------|
| spec-E5-S4.md 全章节覆盖 | ✅ 完全覆盖 |
| plan-E5-S4.md 全章节覆盖 | ✅ 完全覆盖 |
| IMPLEMENTATION_GAPS-E5-S4.md 全章节覆盖 | ✅ 7/7 Gap 覆盖 |
| Story 5.4 全章节覆盖 | ✅ 完全覆盖 |
| 每个 Phase 含集成/E2E 测试（严禁仅有单测） | ✅ 满足 |
| 每个模块验收含生产关键路径集成验证 | ✅ 满足 |
| 无孤岛模块 | ✅ 无孤岛 |

### 最终结论

**「完全覆盖、验证通过」**

`tasks-E5-S4.md` 完整覆盖了 spec-E5-S4.md、plan-E5-S4.md、IMPLEMENTATION_GAPS-E5-S4.md 及 Story 5.4 的要求；每个 Phase 均包含单元测试、集成测试或端到端测试；每个相关模块的验收均包含在生产路径（coachDiagnose、CLI analytics-cluster）中的集成验证；不存在孤岛模块。可选改进见 §四，不影响通过判定。
