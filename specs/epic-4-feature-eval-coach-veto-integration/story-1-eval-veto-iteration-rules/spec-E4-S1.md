# Spec E4-S1：eval-veto-iteration-rules

*Story 4.1 技术规格*
*Epic E4 feature-eval-coach-veto-integration*

---

## 1. 概述

本 spec 将 Story 4-1（eval-veto-iteration-rules）的需求转化为可执行的技术规格，涵盖：一票否决项与环节映射、角色一票否决权、Epic 级一票否决 8 项条件、多次迭代阶梯式扣分及致命/严重问题差异化。

---

## 2. 功能范围

### 2.1 一票否决项与环节映射

**item_id 匹配约定**：YAML 的 veto_items 每项含 `id`（如 veto_core_logic_error）与 `ref`（如 code-reviewer-config#veto_core_logic）。check_items 的 item_id 与 **config 的 veto_items 键名**（veto_core_logic、veto_owasp_high、veto_cwe798、veto_compile、veto_core_unmapped、veto_gaps_conflict）匹配。vetoItemIds 构建：从 loadPhaseScoringYaml(2/3/4)、loadGapsScoringYaml 的 veto_items 中解析 ref，取 ref 目标 item_id（如 code-reviewer-config#veto_core_logic → veto_core_logic），去重后得 vetoItemIds 集合。

| 需求要点 | 技术规格 |
|----------|----------|
| OWASP Top 10 高危、CWE-798 硬编码敏感信息、核心逻辑错误、编译失败等与评分环节对应 | 环节 2：implement-scoring.yaml（veto_core_logic、veto_owasp_high、veto_compile、veto_cwe798）；环节 3：test-scoring.yaml；环节 4：bugfix-scoring.yaml；gaps：gaps-scoring.yaml（veto_core_unmapped、veto_gaps_conflict） |
| 消费 Story 2.1 的 veto_items 配置 | 使用 scoring/parsers/rules.ts 的 loadPhaseScoringYaml、loadGapsScoringYaml；不直接读 YAML |
| 给定 check_items 含 veto 类 item_id 且 passed=false 可判定环节级 veto | 实现 isVetoTriggered(checkItems, vetoItemIds): boolean；输入来自 RunScoreRecord.check_items |

### 2.2 角色一票否决权

| 角色 | 触发条件 | 后果 | 实现方式 |
|------|----------|------|----------|
| 批判审计员 | 阶段级；审计结论「存在 gap」或「未通过」 | 该 stage 迭代不收敛 | 规则文档化；流程文档定义触发条件与后果 |
| AI 代码教练 | 全流程级；教练输出 iteration_passed: false | 全流程迭代不达标 | 本 Story 定义规则；Story 4.2 实现执行 |

### 2.3 Epic 级一票否决 8 项条件

**⑤「未通过」判定标准**：单 Story 记为「未通过」当且仅当该 Story 的**当前/最新验收状态**（即 storyRecords 中该 Story 对应 record 所代表的状态）满足 `veto_triggered === true` 或 `phase_score === 0`（阶梯系数为 0 导致）。二者已覆盖常见验收失败情形；若有独立的验收结论字段，其「fail」亦视为未通过。storyRecords 每项须含 `veto_triggered`、`phase_score`、`iteration_count` 等字段供判定。

| 序号 | 条件 | 阈值 | 判定逻辑 |
|------|------|------|----------|
| ① | 单阶段 veto 次数 | ≥3 | 全流程环节级 veto 累计 |
| ② | 需求交付率 | < 80% | passedStoryCount / epicStoryCount；若 options 未传入 passedStoryCount 则跳过或使用近似并文档化 |
| ③ | 高危漏洞 | ≥ 2 | OWASP Top 10 或 CWE-798，check_items 中 veto 类且 passed=false 累计 |
| ④ | 测试通过率 | < 80% | testStats.passed / testStats.total；若 options 未传入 testStats 则跳过或文档化近似规则 |
| ⑤ | 整改≥4 次未通过 Story 数 | ≥1 | iteration_count ≥ 4 且该 Story 未通过（veto_triggered 或 phase_score=0） |
| ⑥ | 一次通过率 | < 50% | first_pass=true 的 Story 数 / epicStoryCount |
| ⑦ | 整改≥3 次 Story 数 | ≥2 | iteration_count ≥ 3 的 Story 数 |
| ⑧ | 致命问题整改≥3 次 Story 数 | ≥1 | iteration_records 中 severity=fatal 且整改次数≥3 的 Story 数 |

### 2.4 多次迭代阶梯式扣分

| 迭代次数 | 阶梯系数 | 备注 |
|----------|----------|------|
| 1 次 | 100% | tier 1，iteration_count=0 |
| 2 次 | 80% | tier 2，iteration_count=1 |
| 3 次 | 50% | tier 3，iteration_count=2 |
| ≥4 次 | 0% | tier 4，iteration_count≥3 |

**应用点**：环节分；公式 `phase_score = raw_phase_score × tier_coefficient`

**severity_override 顺序**：
1. 先检查 iteration_records 中 severity=fatal 且整改次数≥3 → 阶梯系数强制 0
2. 再检查 severity=serious 且整改次数≥2 → 系数降一档（如 tier 2→tier 3，0.8→0.5）
3. 否则按 iteration_count 查 iteration_tier

### 2.5 与评分核心的集成

| 要点 | 技术规格 |
|------|----------|
| 环节级 veto 与阶梯系数 | 在单 stage 评分计算中应用 |
| Epic 8 项 | 在 Epic 聚合时判定 |
| 产出 | 可被 Story 4.2 调用的 applyTierAndVeto、evaluateEpicVeto；与 RunScoreRecord schema 兼容 |

---

## 3. 接口与依赖

### 3.1 从 Story 2.1 接收

- `loadPhaseScoringYaml(phase: 2|3|4, options?)` → PhaseScoringYaml（含 veto_items）
- `loadGapsScoringYaml(options?)` → GapsScoringYaml（含 veto_items）
- `loadIterationTierYaml(options?)` → IterationTierYaml（iteration_tier、severity_override）

**源路径**：`scoring/parsers/rules.ts`；veto 定义来自 `config/code-reviewer-config.yaml`、`scoring/rules/default/*.yaml`、`gaps-scoring.yaml`。

### 3.2 从 Story 3.2 接收

- RunScoreRecord：check_items（item_id、passed、score_delta、note）、iteration_count、iteration_records、first_pass
- Schema：`scoring/writer/types.ts` 的 RunScoreRecord、CheckItem、IterationRecord
- 消费契约：check_items 中可含 veto 类 item_id（与 config veto_items 键名一致）；若 Story 3.2 未产出则由前置任务扩展 audit-item-mapping 或解析规则产出 veto_*

### 3.3 向 Story 4.2 提供

**核心函数**（与 Story AC-5 对应；`evaluateEpicVeto(storyRecords, epicStoryCount, options?)` 等价于 `evaluateEpicVeto({ storyRecords, epicStoryCount, ...options })`）：

- `applyTierAndVeto(record: RunScoreRecord): { phase_score, veto_triggered, tier_coefficient }`
- `evaluateEpicVeto(input: EpicVetoInput): { triggered: boolean, triggeredConditions: string[] }`
- `getTierCoefficient(record: RunScoreRecord): number`
- `isVetoTriggered(checkItems: CheckItem[], vetoItemIds: Set<string>): boolean`

**EpicVetoInput 接口**：

```ts
interface EpicStoryRecord {
  veto_triggered: boolean;
  phase_score: number;
  iteration_count: number;
  first_pass: boolean;
  iteration_records: IterationRecord[];
  check_items: CheckItem[];
}

interface EpicVetoInput {
  storyRecords: EpicStoryRecord[];
  epicStoryCount: number;
  passedStoryCount?: number;  // 需求交付率分子；未传入则跳过第②项或近似
  testStats?: { passed: number; total: number };  // 未传入则跳过第④项或近似
}
```

---

## 4. Tasks 映射（spec §2、§3 ↔ Story T1–T6）

| 任务 ID | spec 对应 | 验收要点 |
|---------|-----------|----------|
| T1 环节级 veto 判定 | §2.1、§3.1 | isVetoTriggered、vetoItemIds 从 loadPhaseScoringYaml、loadGapsScoringYaml 构建 |
| T1.1–T1.3 | §2.1 | 单元测试覆盖 veto_core_logic、veto_owasp_high、veto_cwe798、veto_core_unmapped、veto_gaps_conflict |
| T2 阶梯系数计算 | §2.4 | getTierCoefficient、applyTierToPhaseScore；loadIterationTierYaml |
| T2.1–T2.3 | §2.4 | 单元测试 iteration_count 0/1/2/≥3；severity_override fatal≥3、serious≥2 |
| T3 编排 applyTierAndVeto | §2.5、§3.3 | 先判定 veto，触发则 phase_score=0；否则应用阶梯；与 RunScoreRecord schema 一致 |
| T4 Epic 8 项 | §2.3、§3.3 | EpicVetoInput、evaluateEpicVeto；第 2、4 项调用方未传入则跳过或近似并文档化 |
| T4.1–T4.4 | §3.3 | 单元测试覆盖第 1、3、5、6、7、8 项 |
| T5 角色 veto 规则文档化 | §2.2 | VETO_AND_ITERATION_RULES.md；路径 scoring/docs/VETO_AND_ITERATION_RULES.md 或 _bmad-output/implementation-artifacts/4-1-eval-veto-iteration-rules/；与 REQUIREMENTS §3.4.1、§3.4.2 一致 |
| T6 可调用入口 | §2.5、§3.3 | 实现路径 scoring/veto/ 或 scoring/rules/veto-and-tier.ts；导出 applyTierAndVeto、evaluateEpicVeto、getTierCoefficient、isVetoTriggered |
| T6.2–T6.3 | §3.3 | CONTRACT 或接口文档；集成测试或验收脚本 |

---

## 5. 本 Story 不包含

- 评分规则 YAML 的 schema 与解析器（Story 2.1）
- 全链路 Skill、审计报告解析、scoring 写入（Story 3.1、3.2、3.3）
- 审计报告中 veto 类 item_id 的映射与解析扩展（Story 3.2）
- AI 代码教练的定位、人格、工作流（Story 4.2）
- 场景区分、迭代结束标准、BMAD 五层集成（Story 4.3）

---

## 6. 验收标准映射

| AC |  Story 验收标准 | spec 对应 |
|----|-----------------|-----------|
| AC-1 | 一票否决项与环节映射可配置或可查；给定 check_items 含 veto 类 item_id 且 passed=false，可判定环节级 veto | §2.1、§3.1 |
| AC-2 | 多次迭代阶梯式扣分正确；severity_override 顺序正确 | §2.4 |
| AC-3 | Epic 8 项文档化；角色 veto 规则文档化 | §2.2、§2.3 |
| AC-4 | Epic 8 项聚合函数：输入 storyRecords、epicStoryCount，输出 epicVetoTriggered | §2.3、§3.3 |
| AC-5 | 可调用入口 applyTierAndVeto、evaluateEpicVeto | §2.5、§3.3 |

---

## 7. Dev Notes（实现指引）

| 要点 | 规格 |
|------|------|
| 技术栈 | TypeScript/Node，与 scoring 模块一致 |
| 规则加载 | scoring/parsers/rules.ts 的 loadPhaseScoringYaml、loadGapsScoringYaml、loadIterationTierYaml |
| Schema | scoring/writer/types.ts 的 RunScoreRecord、CheckItem、IterationRecord |
| Veto 定义 | config/code-reviewer-config.yaml 的 veto_items；scoring/rules/default/*.yaml、gaps-scoring.yaml |
| 实现路径 | scoring/veto/ 或 scoring/rules/veto-and-tier.ts |
| 测试标准 | 单元测试覆盖 veto 判定、tier 系数、severity_override、Epic 8 项至少 6 项；与 scoring/parsers、scoring/writer 无循环依赖 |
| Story 1.1 对齐 | 输出 phase_score、check_items 与 RunScoreRecord schema 兼容；与 Story 1.2 写入接口兼容 |
| 禁止词表 | 禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债 |

---

## 8. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| §1 Scope 1.1.1 | 一票否决项与环节映射 | spec §2.1 | ✅ |
| §1 Scope 1.1.2 | 角色一票否决权（批判审计员、AI 教练） | spec §2.2 | ✅ |
| §1 Scope 1.1.3 | Epic 级一票否决 8 项条件 | spec §2.3 | ✅ |
| §1 Scope 1.1.4 | 多次迭代阶梯式扣分 | spec §2.4 | ✅ |
| §1 Scope 1.1.5 | 致命/严重问题差异化 | spec §2.4（severity_override） | ✅ |
| §1 Scope 1.1.6 | 与评分核心的集成 | spec §2.5 | ✅ |
| §1 Scope 1.2 | 本 Story 不包含 | spec §5 | ✅ |
| §2 Acceptance Criteria | AC-1 至 AC-5 | spec §6 | ✅ |
| §3 Tasks | T1–T6 及子任务、测试、产出物 | spec §4 | ✅ |
| §5 Architecture | 数据输入、规则配置、阶梯应用、Epic 聚合、输出 | spec §2、§3 | ✅ |
| §6 Dev Notes | 技术栈、源树、实现路径、测试标准、禁止词表 | spec §7 | ✅ |
| §4 PRD 追溯 | REQ-3.4、3.4.1–3.4.5、3.6、3.10 | spec §2、§3 | ✅ |
| §7 接口约定 | 2.1、3.2、4.2 接口 | spec §3 | ✅ |
| §8 依赖 | 前置 Story 2.1、1.1、3.2 | spec §3、§5、§7 | ✅ |
