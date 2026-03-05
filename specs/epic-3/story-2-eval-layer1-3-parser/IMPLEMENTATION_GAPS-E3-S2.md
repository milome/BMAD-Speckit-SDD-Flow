# IMPLEMENTATION_GAPS-E3-S2：eval-layer1-3-parser

<!-- AUDIT: PASSED 2026-03-04 -->

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.2  
**输入**：plan-E3-S2.md、spec-E3-S2.md、当前代码库 scoring/、config/、Story 3.2

---

## 1. 现状摘要

- **已有**：config/stage-mapping.yaml、config/eval-lifecycle-report-paths.yaml（Story 3.1 产出）；scoring/parsers/ 存在 rules.ts、types.ts（Story 2.1）；scoring/writer/write-score.ts 提供 writeScoreRecordSync；scoring/schema/run-score-schema.json、scoring/constants/weights.ts、table-b.ts 存在；RunScoreRecord 类型与 check_items 结构已定义。
- **缺失**：Layer 1 prd/arch、Layer 3 story 审计报告解析器；parseAuditReport 统一入口；prd/arch/story 单元测试；解析→写入集成测试；端到端测试；验收脚本 accept-e3-s2.ts；报告路径约定在代码中的常量或文档。

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3 / plan §3 / T1 | GAP-1.1 | prd 审计报告解析器：解析 A/B/C/D→phase_score，提取 check_items | 未实现 | 无 scoring/parsers/audit-prd.ts |
| spec §3 / plan §3 / T1 | GAP-1.2 | prd 报告路径从 config 读取；边界：文件不存在/格式异常→抛错 | 未实现 | 无解析器实现 |
| spec §4 / plan §4 / T2 | GAP-2.1 | arch 审计报告解析器：等级→数值、check_items、环节 1+2 映射 | 未实现 | 无 scoring/parsers/audit-arch.ts |
| spec §5 / plan §5 / T3 | GAP-3.1 | story 审计报告解析器：AUDIT_Story_{epic}-{story}.md 路径 | 未实现 | 无 scoring/parsers/audit-story.ts |
| spec §5 / plan §5 / T3 | GAP-3.2 | story 格式判定：含 A/B/C/D 则复用 prd/arch 映射 | 未实现 | 无解析逻辑 |
| spec §6 / plan §6 / T4 | GAP-4.1 | 统一输出结构：RunScore、iteration_count=0、iteration_records=[]、可选字段 | 未实现 | 类型已有，解析器未产出 |
| spec §7 / plan §8 / T4 | GAP-4.2 | 报告路径约定在代码/文档中明确（prd、arch、story 三类） | 未实现 | 无常量表或 README |
| spec §8 / plan §7、§9 / T5 | GAP-5.1 | parseAuditReport 统一入口，根据 stage 调度 prd/arch/story | 未实现 | 无 scoring/parsers/audit-index.ts |
| plan §9 | GAP-6.1 | 单元测试：audit-prd、audit-arch、audit-story + 边界 | 未实现 | 无 scoring/parsers/__tests__/audit-*.test.ts |
| plan §9 | GAP-6.2 | 集成测试：parseAuditReport→writeScoreRecordSync 断言写入成功 | 未实现 | 无 parse-and-write.test.ts |
| plan §9 | GAP-6.3 | 端到端测试：报告→解析→写入→验证存储 | 未实现 | 无 E2E 或 accept-e3-s2 内实现 |
| plan §9 / AC-3 | GAP-6.4 | 验收脚本 accept-e3-s2.ts：import parseAuditReport、writeScoreRecordSync，实际调用并验证；package.json 或 CI 注册 | 未实现 | 脚本不存在 |
| AC-1 | GAP-AC1 | prd/arch 报告→环节 1 评分结构、schema 兼容 | 未实现 | 见 GAP-1.x、GAP-2.x |
| AC-2 | GAP-AC2 | story 报告→环节 1 评分结构 | 未实现 | 见 GAP-3.x |
| AC-3 | GAP-AC3 | 路径约定文档化、与 3.1 一致 | 未实现 | 见 GAP-4.2 |
| AC-4 | GAP-AC4 | 输出含 phase_score、phase_weight、check_items | 未实现 | 类型已有，解析器未产出 |

---

## 3. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §3 / T1 | GAP-1.1、GAP-1.2、GAP-AC1 | ✓ 有 | T1 |
| spec §4 / T2 | GAP-2.1、GAP-AC1 | ✓ 有 | T2 |
| spec §5 / T3 | GAP-3.1、GAP-3.2、GAP-AC2 | ✓ 有 | T3 |
| spec §6、§7 / T4 | GAP-4.1、GAP-4.2、GAP-AC3、GAP-AC4 | ✓ 有 | T4 |
| spec §8 / T5 | GAP-5.1 | ✓ 有 | T5 |
| plan §9 | GAP-6.1～GAP-6.4 | ✓ 有 | T6（测试与验收） |

---

## 4. 与 plan 的对应关系

- **GAP-1.x**：创建 scoring/parsers/audit-prd.ts；等级 A/B/C/D→100/80/60/40；从 config 读取 prd.report_path；边界抛错。
- **GAP-2.x**：创建 scoring/parsers/audit-arch.ts；同 prd 逻辑。
- **GAP-3.x**：创建 scoring/parsers/audit-story.ts；路径 `AUDIT_Story_{epic}-{story}.md`；格式判定复用或单独实现。
- **GAP-4.x**：输出符合 RunScoreRecord；路径约定写入 constants 或 README。
- **GAP-5.1**：创建 scoring/parsers/audit-index.ts，导出 parseAuditReport。
- **GAP-6.x**：单元测试、集成测试、E2E、验收脚本 accept-e3-s2.ts；验收脚本必须 import parseAuditReport、writeScoreRecordSync 并实际调用；package.json scripts 或 CI 注册。

---

## 5. 非差距（无需本 Story 实现）

- 解析结果持久化写入的触发链（Story 3.3）；全链路 Skill 编排（Story 3.1）；一票否决、阶梯扣分（Story 4.1）。config/stage-mapping、eval-lifecycle-report-paths 已存在。

---

## 6. 闭合条件

- scoring/parsers/audit-prd.ts、audit-arch.ts、audit-story.ts、audit-index.ts 存在且可解析样本报告；parseAuditReport 产出可传入 writeScoreRecordSync；单元测试、集成测试、E2E 全部通过；scripts/accept-e3-s2.ts 存在且 import 并调用 parseAuditReport、writeScoreRecordSync，脚本在 package.json 或 CI 注册。
