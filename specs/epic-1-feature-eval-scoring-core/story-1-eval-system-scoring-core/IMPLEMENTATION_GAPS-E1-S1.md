# IMPLEMENTATION_GAPS-E1-S1：eval-system-scoring-core

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.1  
**来源**：plan-E1-S1.md、原始需求、Architecture、当前实现（scoring/）

---

## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| §2.1 表 A | GAP-2.1.1 | BMAD Layer → 阶段列表（prd, arch, epics, story, specify, plan, gaps, tasks, implement, post_impl, pr_review） | 未实现 | 无 table-a 常量或等效实现 |
| §2.1 表 B | GAP-2.1.2 | 阶段 → 评分环节映射，含 gaps 双轨说明 | 未实现 | 无 table-b 常量或等效实现 |
| §3.2 四层架构 | GAP-3.2.1 | 六环节分项评分，权重 20/25/25/15/10/5 | 未实现 | 无 weights 常量 |
| §3.2 四层架构 | GAP-3.2.2 | 四能力维度聚合公式 | 未实现 | 无 calculator 或等效模块 |
| §3.2 四层架构 | GAP-3.2.3 | 综合得分 = Σ(环节得分×权重)，0–100 | 未实现 | 无 computeCompositeScore |
| §3.2 四层架构 | GAP-3.2.4 | L1–L5 等级与得分区间（L5 90–100、L4 80–89 等） | 未实现 | 无 scoreToLevel 或 LEVEL_RANGES |
| §3.6 存储 schema | GAP-3.6.1 | 必存字段：run_id、scenario、stage、path_type、phase_score、phase_weight、check_items、timestamp、model_version、question_version、iteration_count、iteration_records、first_pass | 部分实现 | 现有 run-score-schema.json 仅含 run_id、timestamp、stage、dimensions、artifact_path、notes；stage 枚举错误（constitution/spec/plan/tasks/implement）；缺 scenario、phase_score、phase_weight、check_items、iteration_count、iteration_records、first_pass |
| §3.6 check_items | GAP-3.6.2 | check_items 含 item_id、passed、score_delta、note | 未实现 | 无 check_items 结构定义 |
| §3.6 iteration_records | GAP-3.6.3 | iteration_records 含 timestamp、result、severity、note | 未实现 | 无 iteration_records 结构定义 |
| §3.8 目录结构 | GAP-3.8.1 | scoring/rules/ 支持 default 等子目录 | 部分实现 | 有 rules/ 但无 default/ 子目录 |
| §3.8 目录结构 | GAP-3.8.2 | scoring/data/ 或 _bmad-output/scoring/ 可配置 | 未实现 | 现有 outputs/ 非 data/；无可配置路径 |
| §3.8 目录结构 | GAP-3.8.3 | scoring/docs/ 权威文档目录 | 未实现 | 无 docs/ 目录 |
| Architecture §9.1 | GAP-A.1 | 目录结构 scoring/rules/default/、scoring/data/、scoring/docs/ | 部分实现 | rules/default/ 缺；data/ 缺（有 outputs/）；docs/ 缺 |
| Story 1.1 T1 | GAP-T1 | 四层架构计算逻辑（环节得分→综合分→等级） | 未实现 | 无 calculator 模块 |
| Story 1.1 T2 | GAP-T2 | 存储 schema（TypeScript 类型或 JSON schema） | 部分实现 | 现有 schema 不完整且错误 |
| Story 1.1 T3 | GAP-T3 | 创建 scoring/rules/、scoring/data/、scoring/docs/ 目录结构 | 部分实现 | rules/ 有；data/、docs/ 缺；rules/default/ 缺 |
| Story 1.1 T4 | GAP-T4 | 实现表 A 表 B 常量或配置 | 未实现 | 无 table-a、table-b |
| Story 1.1 T5 | GAP-T5 | 编写本 Story 对应的单元测试或验收脚本 | 未实现 | 无测试文件、无验收脚本 |

---

## Gaps 汇总（按类别）

| 类别 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Schema | GAP-3.6.1, GAP-3.6.2, GAP-3.6.3, GAP-T2 | ✓ 有 | T2, T1 |
| 常量/表 | GAP-2.1.1, GAP-2.1.2, GAP-3.2.1, GAP-3.2.4, GAP-T4 | ✓ 有 | T4 |
| 计算逻辑 | GAP-3.2.2, GAP-3.2.3, GAP-T1 | ✓ 有 | T1 |
| 目录结构 | GAP-3.8.1, GAP-3.8.2, GAP-3.8.3, GAP-A.1, GAP-T3 | ✓ 有 | T3 |
| 测试/验收 | GAP-T5 | ✓ 有 | T5 |

---

## 核对规则

IMPLEMENTATION_GAPS.md 中出现的每一条 Gap 必须在本任务表（tasks-E1-S1.md）中出现并对应到具体任务；不得遗漏。
