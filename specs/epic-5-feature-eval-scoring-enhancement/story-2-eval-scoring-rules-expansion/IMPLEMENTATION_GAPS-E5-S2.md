# IMPLEMENTATION_GAPS-E5-S2：eval-scoring-rules-expansion

**输入**：`spec-E5-S2.md`、`plan-E5-S2.md`、当前代码基线  
**分析范围**：仅 B03 + B11

---

## 1. 当前实现快照

基于代码现状检查，存在以下事实：

- `scoring/rules/spec-scoring.yaml`、`plan-scoring.yaml`、`tasks-scoring.yaml` 仍为占位符注释。
- `scoring/parsers/audit-index.ts` 的 `AuditStage` 仅包含 `prd|arch|story`，无 `spec`。
- `scripts/parse-and-write-score.ts` 的 stage 类型仍限制为 `prd|arch|story`。
- `scoring/parsers/audit-generic.ts` 不存在。
- `scoring/parsers/dimension-parser.ts` 不存在。
- `RunScoreRecord` 与 `run-score-schema.json` 尚未包含 `dimension_scores`。
- `scoring/orchestrator/parse-and-write.ts` 尚未接入维度加权覆盖逻辑。
- B03/B11 对应 fixture 与测试文件尚未创建。

---

## 2. Gap 明细（需求逐条对照）

### 2.1 B03 相关 Gaps

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S2-B03-1 | AC-B03-4（规则完整性） | 三阶段 YAML 为占位符 | 三个 YAML 含 `weights/items/veto_items` 且可被规则加载器消费 | T1.1-T1.3 |
| GAP-E5-S2-B03-2 | AC-B03-1/2/3（三阶段解析） | `AuditStage` 无 `spec/plan/tasks` | `AuditStage` 扩展并在 `parseAuditReport` 新增分支 | T1.4-T1.6 |
| GAP-E5-S2-B03-3 | AC-B03-1/2/3（权重写入） | 未定义三阶段独立权重常量 | 新增 spec/plan/tasks 对应 `phase_weight=0.2` 常量并接入 | T1.7 |
| GAP-E5-S2-B03-4 | AC-B03-1/2/3/5（通用解析） | 无 `audit-generic.ts` | 新增通用解析器并产出统一 `RunScoreRecord`，缺失等级抛 ParseError | T2.1-T2.4 |
| GAP-E5-S2-B03-5 | AC-B03-4/5（测试覆盖） | 无 B03 fixtures 与测试 | 新增 3 个 report fixture + 9 个测试，覆盖正常/异常路径 | T4.1, T4.3 |

### 2.2 B11 相关 Gaps

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S2-B11-1 | AC-B11-1/3（维度解析与映射） | 无 `dimension-parser.ts`、无 `stageToMode` | 新增维度解析器，按 stage 映射 mode 并读取配置权重 | T3.1-T3.3 |
| GAP-E5-S2-B11-2 | AC-B11-4（数据结构） | `RunScoreRecord` 无 `dimension_scores` | `types.ts` 增加 `dimension_scores?: DimensionScore[]` | T3.4 |
| GAP-E5-S2-B11-3 | AC-B11-4（schema） | schema 无 `dimension_scores` 定义 | `run-score-schema.json` 新增数组对象定义 | T3.5 |
| GAP-E5-S2-B11-4 | AC-B11-1/2（加权与回退） | parse-and-write 仅用等级映射分 | 维度存在时覆盖分数，维度缺失时 fallback 到等级映射 | T3.6-T3.7, T4.5 |
| GAP-E5-S2-B11-5 | AC-B11-1/2/3（测试覆盖） | 无维度样例与测试 | 新增 1 个维度 fixture + 6 个 parser 测试 + orchestrator 断言 | T4.2, T4.4, T4.5 |

---

## 3. 依赖关系与实施顺序

1. 先完成 B03（T1、T2），再进行 B11（T3）。  
   原因：Story 5.3 的 B05 依赖 B03 产出的 `audit-generic.ts`。
2. 测试阶段（T4）依赖 T1~T3 完成后统一补齐。
3. 最终执行命令（T5）在全部代码与测试文件完成后执行。

---

## 4. 风险与缓解

| 风险 | 触发条件 | 缓解动作 | 落位任务 |
| ------ | ---------- | ---------- | ---------- |
| 规则文件与配置键名不一致 | YAML 的 item/veto id 与 `code-reviewer-config.yaml` 不对齐 | 在 T1 中逐条对齐键名；在 T4.6 增加 veto 路径测试 | T1.1-T1.3, T4.6 |
| 维度加权破坏旧报告写入 | 旧报告无维度字段 | T3.7 保证空数组 fallback，T4.5 覆盖回退断言 | T3.7, T4.5 |
| CLI 无法接收新 stage | stage 类型仍为旧联合类型 | T1.6 将 CLI stage 改为 `AuditStage` 并更新 usage 描述 | T1.6 |
| schema 与类型不一致 | 仅改类型未改 schema 或反之 | T3.4 + T3.5 成对变更，并在 T4.5 做写入断言 | T3.4, T3.5, T4.5 |

---

## 5. Gap 到任务映射总表

| Gap ID | Task IDs | 验收命令 |
| -------- | ---------- | ---------- |
| GAP-E5-S2-B03-1 | T1.1-T1.3 | `npm run test:scoring -- scoring/veto/__tests__/apply-tier-and-veto.test.ts` |
| GAP-E5-S2-B03-2 | T1.4-T1.6 | `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts` |
| GAP-E5-S2-B03-3 | T1.7 | `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts` |
| GAP-E5-S2-B03-4 | T2.1-T2.4 | `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts` |
| GAP-E5-S2-B03-5 | T4.1, T4.3 | `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts` |
| GAP-E5-S2-B11-1 | T3.1-T3.3 | `npm run test:scoring -- scoring/parsers/__tests__/dimension-parser.test.ts` |
| GAP-E5-S2-B11-2 | T3.4 | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` |
| GAP-E5-S2-B11-3 | T3.5 | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` |
| GAP-E5-S2-B11-4 | T3.6-T3.7, T4.5 | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` |
| GAP-E5-S2-B11-5 | T4.2, T4.4, T4.5 | `npm run test:scoring -- scoring/parsers/__tests__/dimension-parser.test.ts` |

<!-- AUDIT: PASSED by code-reviewer -->
