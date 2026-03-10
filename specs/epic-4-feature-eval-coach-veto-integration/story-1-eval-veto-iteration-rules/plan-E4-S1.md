# plan-E4-S1：eval-veto-iteration-rules 实现方案

**Epic**：E4 feature-eval-coach-veto-integration  
**Story ID**：4.1  
**输入**：spec-E4-S1.md、Story 4-1

---

## 1. 目标与约束

- 实现一票否决项与环节映射、阶梯系数、Epic 8 项判定的可调用模块；产出供 Story 4.2 教练调用的 API。
- 消费 Story 2.1 的 loadPhaseScoringYaml、loadGapsScoringYaml、loadIterationTierYaml；输入来自 Story 3.2 的 RunScoreRecord。
- 与 Story 1.1 schema、Story 1.2 写入接口兼容；与 scoring/parsers、scoring/writer 无循环依赖。

---

## 2. 模块设计

### 2.1 实现路径

**主模块**：`scoring/veto/index.ts`（或 `scoring/rules/veto-and-tier.ts`）

**目录结构**：
```
scoring/
  veto/
    index.ts      # 导出 applyTierAndVeto、evaluateEpicVeto、getTierCoefficient、isVetoTriggered
    veto.ts       # isVetoTriggered、buildVetoItemIds
    tier.ts       # getTierCoefficient、applyTierToPhaseScore
    epic-veto.ts  # evaluateEpicVeto、EpicVetoInput
    types.ts      # EpicStoryRecord、EpicVetoInput 等
```

### 2.2 依赖关系

```
scoring/veto
  ├── scoring/parsers/rules (loadPhaseScoringYaml, loadGapsScoringYaml, loadIterationTierYaml)
  ├── scoring/writer/types (RunScoreRecord, CheckItem, IterationRecord)
  └── scoring/core/calculator (可选，仅若需复合分计算)
```

---

## 3. 核心 API 设计

### 3.1 环节级 veto 与阶梯

| 函数 | 签名 | 职责 |
|------|------|------|
| isVetoTriggered | `(checkItems: CheckItem[], vetoItemIds: Set<string>) => boolean` | 检查 check_items 中是否存在 veto 类 item_id 且 passed=false |
| buildVetoItemIds | `(options?: { rulesDir? }) => Set<string>` | 从 loadPhaseScoringYaml(2/3/4)、loadGapsScoringYaml 的 veto_items 解析 ref，取 item_id 构建集合 |
| getTierCoefficient | `(record: RunScoreRecord) => number` | 先应用 severity_override（fatal≥3→0，serious≥2→降一档），再按 iteration_count 查 iteration_tier |
| applyTierToPhaseScore | `(rawScore: number, record: RunScoreRecord) => number` | rawScore × getTierCoefficient(record) |
| applyTierAndVeto | `(record: RunScoreRecord) => { phase_score, veto_triggered, tier_coefficient }` | 先判定 veto，触发则 phase_score=0；否则应用阶梯 |

### 3.2 Epic 8 项判定

| 函数 | 签名 | 职责 |
|------|------|------|
| evaluateEpicVeto | `(input: EpicVetoInput) => { triggered: boolean, triggeredConditions: string[] }` | 逐项判定 8 项条件，返回是否触发及触发的条件 ID |

**EpicVetoInput**（与 spec §3.3 一致）：
- storyRecords: EpicStoryRecord[]
- epicStoryCount: number
- passedStoryCount?: number
- testStats?: { passed: number; total: number }

---

## 4. 数据结构

### 4.1 EpicStoryRecord

与 RunScoreRecord 兼容的子集，含：
- veto_triggered: boolean
- phase_score: number
- iteration_count: number
- first_pass: boolean
- iteration_records: IterationRecord[]
- check_items: CheckItem[]

### 4.2 raw_phase_score 来源

applyTierAndVeto 的 record 需含 raw_phase_score 或可计算的原始分。若 RunScoreRecord 仅有 phase_score，则：
- 方案 A：调用方传入 raw_phase_score；record 扩展为 `RunScoreRecord & { raw_phase_score?: number }`
- 方案 B：由 check_items 计算 raw（扣分求和后满分减）；需知道阶段满分
- **推荐**：record 扩展 raw_phase_score 可选；若无则用 phase_score 作为基数（阶梯未应用前的近似）

Story 1.1 schema 中 phase_score 为最终分。本 Story 的 applyTierAndVeto 输入应为「raw_phase_score + check_items + iteration_*」；若上游仅提供 phase_score，则需在 parse-and-write 或 calculator 层拆分。为简化，**本 Story 约定**：applyTierAndVeto 的 record 含 `raw_phase_score`（由调用方或上游在应用阶梯前计算并传入）；若缺失则回退为用 phase_score 当作 raw（会重复应用阶梯，调用方需避免）。

---

## 5. 集成与端到端测试计划

### 5.1 单元测试

| 模块 | 用例 | 命令 |
|------|------|------|
| veto.ts | isVetoTriggered：含 veto 且 passed=false 返回 true；无 veto 或全 passed 返回 false | `npm test -- scoring/veto` |
| veto.ts | buildVetoItemIds：加载后集合含 veto_core_logic、veto_owasp_high 等 | 同上 |
| tier.ts | getTierCoefficient：iteration_count 0/1/2/≥3 → 1.0/0.8/0.5/0 | 同上 |
| tier.ts | severity_override：fatal≥3→0；serious≥2→降一档 | 同上 |
| epic-veto.ts | evaluateEpicVeto：第 1、3、5、6、7、8 项至少 6 项有断言 | 同上 |

### 5.2 集成测试

| 场景 | 验证方式 |
|------|----------|
| applyTierAndVeto 被 parse-and-write 或 calculator 调用 | 在 scoring/orchestrator 或 scoring/core 的评分流程中导入并调用 applyTierAndVeto；测试用例准备 RunScoreRecord，断言 phase_score、veto_triggered 符合规则 |
| evaluateEpicVeto 可被外部脚本调用 | 验收脚本或集成测试：给定 storyRecords、epicStoryCount，调用 evaluateEpicVeto，断言 triggered、triggeredConditions |
| 生产代码关键路径 | grep 验证 scoring/veto 被 scoring/orchestrator、或 accept-e4-s1 验收脚本导入 |

### 5.3 端到端验收

- 新增 `scripts/accept-e4-s1.ts`：调用 applyTierAndVeto、evaluateEpicVeto，给定样本记录，校验输出；或通过 `npm run accept:e4-s1` 执行。

---

## 6. 文档产出

- **VETO_AND_ITERATION_RULES.md**：路径 `scoring/docs/VETO_AND_ITERATION_RULES.md`
- 内容：批判审计员、AI 教练的 veto 触发条件与后果；与 REQUIREMENTS §3.4.1、§3.4.2 一致
- **CONTRACT**（或接口文档）：入参、出参、与 Story 3.2、4.2 的衔接；可置于 scoring/veto/README.md 或 scoring/docs/VETO_CONTRACT.md

---

## 7. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| §1 Scope 1.1 | spec §2.1 | plan §3.1、§4 | ✅ |
| §1 Scope 1.2 | spec §2.2 | plan §6 文档 | ✅ |
| §1 Scope 1.3 | spec §2.3 | plan §3.2、§4.1 | ✅ |
| §1 Scope 1.4 | spec §2.4 | plan §3.1 tier | ✅ |
| §1 Scope 1.5 | spec §2.4 | plan §3.1 severity_override | ✅ |
| §1 Scope 1.6 | spec §2.5 | plan §2、§3 | ✅ |
| §2 AC-1 至 AC-5 | spec §6 | plan §3、§5 | ✅ |
| §3 Tasks T1–T6 | spec §4 | plan §2–§6 | ✅ |
| §5 Architecture | spec §2、§3 | plan §2、§3 | ✅ |

---

## 8. 集成测试与端到端测试计划（专项）

**必须**：plan 须包含完整集成测试与端到端功能测试计划。

| 测试类型 | 计划内容 | plan 位置 |
|----------|----------|-----------|
| 单元测试 | veto 判定、tier 系数、severity_override、Epic 8 项至少 6 项 | §5.1 |
| 集成测试 | applyTierAndVeto 在评分流程中被调用；evaluateEpicVeto 可被脚本调用；生产代码关键路径 grep 验证 | §5.2 |
| 端到端 | accept-e4-s1.ts 验收脚本 | §5.3 |

**严禁**：仅依赖单元测试；模块实现完整但未被生产代码关键路径导入和调用。
