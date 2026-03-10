# Spec E9-S1 审计报告：逐条对照与批判审计员结论

**审计日期**：2026-03-06  
**待审计 spec**：`specs/epic-9/story-1-scoring-full-pipeline/spec-E9-S1.md`  
**原始需求文档**：Story 9.1（9-1-scoring-full-pipeline.md）、TASKS_评分全链路写入与仪表盘聚合.md  
**审计依据**：audit-prompts spec.md 审计提示词；audit-prompts-critical-auditor-appendix.md  

---

## 1. 逐条检查与验证结果

### 1.1 Story 9.1 章节覆盖

| 原始章节 | 原始要点 | spec 对应位置 | 验证方式 | 验证结果 |
|----------|----------|---------------|----------|----------|
| Story 陈述 | bmad-story-assistant 阶段四、speckit-workflow 各 stage 审计通过后自动 parse-and-write-score；Story 完成时自检 scoring/data；仪表盘按 epic/story 聚合 | spec §1 概述、§3 | 逐句对照 | ✅ 覆盖 |
| 实施范围说明 | T1–T9、T11（T10、T12 Phase 0 已完成） | spec §1 实施范围 | 对比任务列表 | ✅ 一致 |
| AC-1 | 阶段四插入 parse-and-write-score 显式步骤 | spec §3.1.1 | 对照 T1 验收、CLI 示例、报告路径模板 | ✅ 覆盖 |
| AC-2 | 审计子任务 prompt 约定报告保存路径 | spec §3.1.2 | 对照 T2 约定内容、STORY-A4-POSTAUDIT | ✅ 覆盖 |
| AC-3 | 主 Agent 收到审计通过后自动解析 reportPath | spec §3.2.1 | 对照自动化逻辑、SCORE_WRITE_SKIP_REPORT_MISSING 边界 | ✅ 覆盖 |
| AC-4 | parse-and-write-score 支持 trigger_stage | spec §3.2.2 | 对照 RunScoreRecord、CLI、单测 | ✅ 覆盖 |
| AC-5 | Story 完成时检查 scoring/data 是否已写入 | spec §3.3.1 | 对照 check-story-score-written 脚本、嵌入位置 | ✅ 覆盖 |
| AC-6 | 检查逻辑与路径约定文档化 | spec §3.3.2 | 对照 docs/BMAD 章节、grep 验收 | ✅ 覆盖 |
| AC-7 | 聚合逻辑：按时间窗口与 epic/story | spec §3.4.1 | 对照 aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 | ✅ 覆盖 |
| AC-8 | 仪表盘按 epic/story 聚合总分与四维 | spec §3.4.2 | 对照 dashboard-generate、策略、验收 | ⚠️ 部分覆盖（见 1.3） |
| AC-9 | 跨 run 聚合与短板计算 | spec §3.4.3 | 对照 getWeakTop3、最低分规则 | ✅ 覆盖 |
| AC-10 | run_id 共享策略 | spec §3.2.3 | 对照 --runGroupId、RUN_ID_CONVENTION | ⚠️ 部分覆盖（见 1.3） |
| Dev Notes 架构 | 写入链路、聚合键、trigger_stage 短期方案 | spec §3 各节 | 逐段对照 | ✅ 覆盖 |
| Dev Notes 涉及源文件 | 各模块路径与修改内容 | spec §5 | 逐行对照 | ✅ 覆盖 |
| Dev Notes 测试标准 | T4/T5/T7/T8/T9 验收 | spec §4 成功标准 | 对照 | ✅ 覆盖 |
| Dev Notes Project Structure | scoring/data、run_id 正则、parseEpicStoryFromRecord | spec §3.3.1 | 间接引用 | ✅ 覆盖 |

### 1.2 TASKS 文档章节覆盖（T1–T9、T11；T10、T12 按范围排除）

| TASKS 章节 | 要点 | spec 对应 | 验证方式 | 验证结果 |
|------------|------|-----------|----------|----------|
| §1 需求追溯表 REQ-1 | bmad-story-assistant 显式步骤 | spec §3.1 | AC-1 覆盖 | ✅ |
| §1 REQ-2 | 主 Agent 自动化、reportPath 解析 | spec §3.2.1 | AC-3 覆盖 | ✅ |
| §1 REQ-3 | Story 完成自检 | spec §3.3 | AC-5、AC-6 覆盖 | ✅ |
| §1 REQ-4 | 聚合逻辑（时间窗口、branch） | spec §3.4.1 | T7 覆盖；aggregateByBranch 不实现 | ⚠️ spec 未显式写明「aggregateByBranch 本轮不实现」 |
| §1 REQ-5 | speckit 全流程、implement stage | T10、T11 | T10 排除；T11 spec §3.2.3 | ✅ 符合范围 |
| §1 REQ-6 | 跨 run 聚合、短板 | spec §3.4.2、§3.4.3 | T8、T9 覆盖 | ✅ |
| §1 REQ-7 | 可解析评分块 | T12 | 排除（Phase 0） | ✅ |
| §2 议题映射 | 6 个议题结论 | spec §3 功能规格 | 间接映射 | ✅ |
| §3 实施顺序 | Phase 1/2/3、依赖关系 | spec §3 分 Phase | 结构一致 | ✅ |
| T1 完整内容 | 步骤 4.2、CLI、路径、non_blocking | spec §3.1.1 | 逐项对照 | ✅ |
| T2 完整内容 | STORY-A4-POSTAUDIT、路径约定 | spec §3.1.2 | 逐项对照 | ✅ |
| T3 完整内容 | 主 Agent 解析 reportPath、边界 | spec §3.2.1 | 逐项对照 | ✅ |
| T4 完整内容 | trigger_stage、schema、CLI、单测 | spec §3.2.2 | 逐项对照 | ✅ |
| T5 完整内容 | check 脚本、嵌入、补跑、T4 延后时参数 | spec §3.3.1 | 逐项对照 | ⚠️ 补跑时 stage/triggerStage 未明确 |
| T6 完整内容 | Story 完成自检章节、三项内容 | spec §3.3.2 | 逐项对照 | ✅ |
| T7 完整内容 | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2、aggregateByBranch 不实现 | spec §3.4.1 | 逐项对照 | ⚠️ 未写明 aggregateByBranch 不实现 |
| T8 完整内容 | 完整 run 定义、退化逻辑、fixture 结构 | spec §3.4.2 | 逐项对照 | ⚠️ 模糊（见 §2） |
| T9 完整内容 | getWeakTop3、最低分、单测 | spec §3.4.3 | 逐项对照 | ✅ |
| T11 完整内容 | --runGroupId、run_id 格式、文档 | spec §3.2.3 | 逐项对照 | ⚠️「等效」机制未定义 |

### 1.3 发现的模糊表述与遗漏

| 序号 | 位置 | 问题描述 | 建议 |
|------|------|----------|------|
| GAP-1 | spec §3.2.3 | 「`--runGroupId` 或等效」——「等效」未定义，验收时无法判断何谓等效 | 明确等效机制（如仅支持 --runGroupId，或列出可接受替代方案） |
| GAP-2 | spec §3.4.2 | 「时间窗口内取最新『完整 run』」——「完整 run」未定义。TASKS T8 明确：含 spec+plan+gaps+tasks 至少 3 个 stage；implement 以 trigger_stage=speckit_5_2 或 stage=tasks 计入 | **spec 存在模糊表述**；须补充完整 run 定义 |
| GAP-3 | spec §3.4.2 | TASKS T8 有「若无完整 run，退化为按单 record 最新 timestamp 取可用的 stage 子集」——spec 未写退化逻辑 | **spec 存在模糊表述**；须补充退化行为 |
| GAP-4 | spec §3.4.2 验收 | 「已知 fixture 断言总分与四维与预期一致」——未指定 fixture 结构、phase_score、phase_weight、预期值。TASKS T8 给出具体示例（如 dev-e8-s1-*、80/90/92、各 0.2） | **spec 存在模糊表述**；须补充 fixture 示例或引用 TASKS |
| GAP-5 | spec §3.3.1 | 补跑决策仅写「若报告路径存在则执行 parse-and-write-score 补跑」。TASKS T5 明确「T4 延后时：补跑使用 stage=tasks、triggerStage=bmad_story_stage4」——spec 未写补跑时的 CLI 参数 | **spec 存在模糊表述**；须明确补跑时的 stage、triggerStage |
| GAP-6 | spec §3.4.1 | TASKS T7 明确「aggregateByBranch 本轮不实现」及原因（RunScoreRecord 无 branch、source_path 未约定）。spec 未提及，实施方可能误以为需实现 | spec 须显式写明「aggregateByBranch 本轮不实现」 |

---

## 2. 验证方式汇总

| 验证项 | 执行方式 | 结果 |
|--------|----------|------|
| Story 各 AC 与 spec 映射 | 逐 AC 对照 spec §2 需求映射表及 §3 功能规格 | AC-1～9 有对应；AC-8、AC-10 存在模糊 |
| TASKS T1–T9、T11 完整性 | 逐任务逐项对照 spec 规格表 | T5、T7、T8、T11 存在模糊或遗漏 |
| 实施范围一致性 | spec §1 vs Story 实施范围说明 vs TASKS §3 | ✅ 一致 |
| 涉及源文件 | spec §5 vs Story Dev Notes、TASKS | ✅ 一致 |
| 成功标准可验证性 | spec §4 与各 AC 验收标准 | 除 GAP-4 外可执行 |
| 术语一致性 | run_id、run_group_id、trigger_stage、完整 run | 完整 run、等效 存在歧义 |

---

## 3. 结论

**未完全通过。** spec 对 Story 9.1 与 TASKS 的主体覆盖较好，但存在 **6 处模糊表述或遗漏**，须触发 clarify 澄清流程后方可判「完全覆盖、验证通过」。

**遗漏/未完全覆盖要点**：
1. spec §3.2.3：run_id 共享策略中「等效」机制未定义  
2. spec §3.4.2：「完整 run」未定义；退化逻辑未描述；验收 fixture 未指定  
3. spec §3.3.1：补跑时 stage、triggerStage 参数未明确  
4. spec §3.4.1：aggregateByBranch 本轮不实现未显式声明  

**建议后续动作**：按 speckit-workflow clarify 流程，对上述 6 项逐项澄清并更新 spec。

---

## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、术语歧义、规格可操作性、实施可验证性。

**每维度结论**：

- **遗漏需求点**：Story 9.1 的 10 个 AC 及 Dev Notes 在 spec 中均有映射，无整条 AC 遗漏。TASKS 的 T1–T9、T11 在 spec 中均有对应节。但 TASKS T7 的「aggregateByBranch 本轮不实现」、TASKS T8 的「完整 run」定义与「退化逻辑」、TASKS T5 的「T4 延后时补跑参数」在 spec 中未体现，属于**规格级遗漏**，非需求级遗漏。结论：存在规格级遗漏。

- **边界未定义**：「完整 run」的 stage 组合规则（至少 3 个、implement 计入方式）、「若无完整 run」时的退化行为未在 spec 中定义，实施时需回查 TASKS，增加漂移风险。run_id「等效」机制未定义，验收「可选 --runGroupId 或等效机制可用」无法量化。结论：边界存在未定义项。

- **验收不可执行**：spec §3.4.2 的「已知 fixture 断言总分与四维与预期一致」未给出 fixture 结构、phase_score、phase_weight、预期计算公式，实施方与审计方无法独立复现验收。§3.2.3 的「等效机制可用」无判定标准。结论：部分验收不可独立执行。

- **与前置文档矛盾**：spec 与 Story 9.1、TASKS 无直接矛盾，实施范围、任务划分一致。但 spec 对 TASKS 中已明确写明的「aggregateByBranch 不实现」「完整 run 定义」「退化逻辑」「补跑参数」未纳入，存在**信息不一致**，可能被解读为 spec 与 TASKS 有隐式冲突（例如实施方按 spec 实现 aggregateByBranch）。结论：无明显矛盾，但存在信息缺口导致的隐性冲突风险。

- **术语歧义**：「完整 run」「等效」「已知 fixture」在 spec 中未给出与 TASKS 一致的释义，易产生歧义。结论：存在术语歧义。

- **规格可操作性**：T1–T4、T6、T9 的规格可直接操作；T5 的补跑分支、T7 的聚合策略排除、T8 的完整 run 与退化、T11 的等效机制，实施时需额外查阅 TASKS 或自行推断。结论：部分规格可操作性不足。

- **实施可验证性**：除上述验收不可执行项外，T1–T4、T5（检查步骤）、T6、T7、T9 的验收可执行。T8 的 fixture 验收、T11 的等效验收需补充定义。结论：部分实施结果不可独立验证。

**本轮结论**：本轮存在 gap。具体项：  
1) spec §3.2.3「等效」未定义，须明确或删除；  
2) spec §3.4.2「完整 run」未定义，须补充至少 3 个 stage、implement 计入规则；  
3) spec §3.4.2 退化逻辑未描述，须补充；  
4) spec §3.4.2 验收 fixture 未指定，须补充或引用 TASKS 示例；  
5) spec §3.3.1 补跑时 stage/triggerStage 未明确，须补充；  
6) spec §3.4.1 须显式写明 aggregateByBranch 本轮不实现。  
不计数，修复后重新发起审计。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: B

维度评分:
- 需求完整性: 82/100
- 可测试性: 78/100
- 一致性: 85/100
- 可追溯性: 90/100
