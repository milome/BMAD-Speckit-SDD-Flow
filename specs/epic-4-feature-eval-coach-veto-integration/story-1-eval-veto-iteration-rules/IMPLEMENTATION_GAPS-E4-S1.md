# IMPLEMENTATION_GAPS-E4-S1：eval-veto-iteration-rules

**对照**：plan-E4-S1.md、spec-E4-S1.md、Story 4-1、当前实现  
**生成日期**：2026-03-04

---

## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| §1.1.1 一票否决项与环节映射 | GAP-1.1 | 给定 check_items 含 veto 类 item_id 且 passed=false，可判定环节级 veto | 未实现 | 无 isVetoTriggered、buildVetoItemIds；scoring/veto 模块不存在 |
| §1.1.1 消费 Story 2.1 veto 配置 | GAP-1.2 | 从 loadPhaseScoringYaml、loadGapsScoringYaml 获取 vetoItemIds | 部分 | rules.ts 已有 load*；无 buildVetoItemIds 从 veto_items 解析 ref 构建集合 |
| §1.1.2 角色 veto 规则文档化 | GAP-1.3 | 批判审计员、AI 教练的 veto 触发条件与后果 | 未实现 | VETO_AND_ITERATION_RULES.md 不存在 |
| §1.1.3 Epic 8 项条件 | GAP-1.4 | 8 项条件可判定；evaluateEpicVeto 产出 triggered、triggeredConditions | 未实现 | 无 evaluateEpicVeto、EpicVetoInput |
| §1.1.4 多次迭代阶梯式扣分 | GAP-1.5 | getTierCoefficient、applyTierToPhaseScore；severity_override 顺序 | 未实现 | 无 getTierCoefficient、tier 应用逻辑；iteration-tier.yaml 存在但未被消费 |
| §1.1.5 致命/严重问题差异化 | GAP-1.6 | fatal≥3→0；serious≥2→降一档 | 未实现 | 与 GAP-1.5 同属 tier 模块 |
| §1.1.6 与评分核心的集成 | GAP-1.7 | applyTierAndVeto 可被 Story 4.2 调用；与 RunScoreRecord 兼容 | 未实现 | 无 applyTierAndVeto；parse-and-write、calculator 未集成 veto/tier |
| §3 Tasks T1 | GAP-T1 | isVetoTriggered、buildVetoItemIds、环节 2/3/4、gaps | 未实现 | scoring/veto 未创建 |
| §3 Tasks T2 | GAP-T2 | getTierCoefficient、applyTierToPhaseScore、loadIterationTierYaml | 未实现 | 同上 |
| §3 Tasks T3 | GAP-T3 | applyTierAndVeto 编排 | 未实现 | 同上 |
| §3 Tasks T4 | GAP-T4 | EpicVetoInput、evaluateEpicVeto、8 项逐项实现 | 未实现 | 同上 |
| §3 Tasks T5 | GAP-T5 | VETO_AND_ITERATION_RULES.md、CONTRACT | 未实现 | 文档缺失 |
| §3 Tasks T6 | GAP-T6 | scoring/veto 模块导出、集成测试/验收脚本 | 未实现 | 模块缺失；无 accept-e4-s1 |

---

## 四类汇总（D/S/I/M）

| 类别 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| 数据/配置加载 D | GAP-1.2 | ✓ 有 | T1.2、T2.1 |
| 业务逻辑 S | GAP-1.1、GAP-1.4、GAP-1.5、GAP-1.6、GAP-T1–T4 | ✓ 有 | T1、T2、T3、T4 |
| 集成 I | GAP-1.7、GAP-T6 | ✓ 有 | T3.2、T6.1–T6.3 |
| 文档 M | GAP-1.3、GAP-T5 | ✓ 有 | T5 |

---

## 当前实现可复用项

- scoring/parsers/rules.ts：loadPhaseScoringYaml、loadGapsScoringYaml、loadIterationTierYaml
- scoring/writer/types.ts：RunScoreRecord、CheckItem、IterationRecord
- scoring/rules/iteration-tier.yaml、gaps-scoring.yaml、default/*.yaml
- config/code-reviewer-config.yaml：veto_items
- scoring/orchestrator/parse-and-write.ts：评分写入流程（可扩展为调用 applyTierAndVeto）
