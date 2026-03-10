# spec-E4-S1 覆盖性审计报告

**审计对象**：spec-E4-S1.md 对 Story 4-1 eval-veto-iteration-rules 的覆盖完整性  
**原始需求**：`_bmad-output/implementation-artifacts/4-1-eval-veto-iteration-rules/4-1-eval-veto-iteration-rules.md`  
**待审计 spec**：`specs/epic-4/story-1-eval-veto-iteration-rules/spec-E4-S1.md`  
**审计日期**：2026-03-04

---

## §1 Scope 逐条检查

### 1.1 本 Story 包含

| 原始需求要点 | spec 对应 | 验证方式 | 验证结果 |
|-------------|-----------|----------|----------|
| 1.1.1 一票否决项与环节映射：OWASP、CWE-798、核心逻辑错误、编译失败、核心需求>20%未映射、gaps 与规范冲突与环节对应 | spec §2.1 表格第 1 行 | 比对 item_id 列表 | ✅ 覆盖：spec 列 veto_core_logic、veto_owasp_high、veto_cwe798、veto_compile、veto_core_unmapped、veto_gaps_conflict |
| 1.1.1 消费 Story 2.1 veto_items 配置、不直接读 YAML | spec §2.1 第 2 行、§3.1 | 比对 | ✅ 覆盖 |
| 1.1.1 veto 判定输入来自 RunScoreRecord.check_items | spec §2.1 第 3 行 | 比对 | ✅ 覆盖 |
| 1.1.2 角色一票否决权：批判审计员阶段级、AI 教练全流程级 | spec §2.2 | 比对 | ✅ 覆盖 |
| 1.1.3 Epic 级一票否决 8 项条件及阈值 | spec §2.3 | 逐一比对 8 项 | ✅ 覆盖 |
| 1.1.3 聚合输入 storyRecords、epicStoryCount 由调用方传入 | spec §2.3、§3.3 | 比对 | ⚠️ 部分：evaluateEpicVeto(input) 未显式定义 EpicVetoInput 结构（storyRecords、epicStoryCount、passedStoryCount、testStats 等） |
| 1.1.4 阶梯系数 1/2/3/≥4 次对应 100%/80%/50%/0% | spec §2.4 | 比对 | ✅ 覆盖 |
| 1.1.4 tier 与 iteration_count 映射（tier1=0, tier2=1, tier3=2, tier4≥3） | spec §2.4 表格 | 比对 | ✅ 覆盖 |
| 1.1.4 与 Story 1.1 iteration_count、iteration_records、first_pass 对齐 | spec 未显式提及 | — | ⚠️ 缺失：Story 明确要求与 1.1 schema 对齐，spec 无此约束表述 |
| 1.1.5 severity_override 应用顺序（fatal≥3→0；serious≥2→降一档） | spec §2.4 | 比对 | ✅ 覆盖 |
| 1.1.6 环节级 veto 与阶梯在单 stage 应用；Epic 8 项在 Epic 聚合时判定 | spec §2.5 | 比对 | ✅ 覆盖 |
| 1.1.6 产出可被 Story 4.2 调用的 API；与 Story 1.2 写入 schema 兼容 | spec §2.5、§3.3 | 比对 | ✅ 覆盖 |

### 1.2 本 Story 不包含

| 原始需求要点 | spec 对应 | 验证结果 |
|-------------|-----------|----------|
| 评分规则 YAML schema 与解析器（Story 2.1） | spec §4 | ✅ 覆盖 |
| 全链路 Skill、审计报告解析、scoring 写入（3.1、3.2、3.3） | spec §4 | ✅ 覆盖 |
| veto 类 item_id 映射与解析扩展（Story 3.2） | spec §4 | ✅ 覆盖 |
| AI 代码教练定位、人格、工作流（Story 4.2） | spec §4 | ✅ 覆盖 |
| 场景区分、迭代结束标准、BMAD 五层集成（Story 4.3） | spec §4 | ✅ 覆盖 |
| 需求交付率、测试通过率 schema 不足时的契约/近似规则 | spec §2.3 ②④ 行 | ✅ 覆盖：若调用方未传入则文档化近似规则 |

---

## §2 Acceptance Criteria 逐条检查

| AC | 验收标准 | spec 对应 | 验证结果 |
|----|----------|-----------|----------|
| AC-1 | 一票否决项与环节映射可配置或可查；veto 类 item_id + passed=false 可判定环节级 veto | §2.1、§5 | ✅ 覆盖 |
| AC-2 | 阶梯系数 0/1/2/≥3 对应 100%/80%/50%/0%；severity_override 顺序正确 | §2.4、§5 | ✅ 覆盖 |
| AC-3 | Epic 8 项文档化；角色 veto 规则文档化 | §2.2、§2.3、§5 | ✅ 覆盖 |
| AC-4 | Epic 8 项聚合函数：storyRecords、epicStoryCount → epicVetoTriggered、触发的条件项 | §2.3、§3.3、§5 | ✅ 覆盖（triggered、triggeredConditions 与 epicVetoTriggered、触发的条件项等价） |
| AC-5 | applyTierAndVeto(record)、evaluateEpicVeto(storyRecords, epicStoryCount, options?) 可调用 | §2.5、§3.3、§5 | ⚠️ 签名差异：Story 为三参数，spec 为单参数 input；语义可等价，但需明确 input 含 storyRecords、epicStoryCount、options |

---

## §3 Tasks / Subtasks 逐条检查

| 原始 Task | spec 对应 | 验证结果 |
|-----------|-----------|----------|
| **T1** 环节级 veto 判定 | §2.1、§3.1 | ⚠️ 功能覆盖但无显式 Task 分解 |
| T1.1 isVetoTriggered(checkItems, vetoItemIds) | §2.1 第 3 行 | ✅ 规格有 |
| T1.2 loadPhaseScoringYaml、gaps-scoring 获取 vetoItemIds；环节 2/3/4、gaps | §2.1、§3.1 | ✅ 规格有（loadGapsScoringYaml 对应 gaps-scoring） |
| T1.3 单元测试覆盖 veto_core_logic、veto_owasp_high 等 | — | ❌ spec 未要求具体测试覆盖项 |
| **T2** 阶梯系数计算 | §2.4 | ⚠️ 功能覆盖但无 Task 分解 |
| T2.1 getTierCoefficient(record) | — | ❌ spec 未显式列出 getTierCoefficient |
| T2.2 applyTierToPhaseScore | — | ❌ spec 未显式列出 |
| T2.3 单元测试 iteration_count 0/1/2/≥3、severity | — | ❌ spec 未要求 |
| **T3** applyTierAndVeto(record) | §2.5、§3.3 | ✅ 有 |
| T3.2 与 Story 1.1 phase_score、check_items 语义一致 | — | ❌ spec 未显式约束 |
| **T4** Epic 8 项判定 | §2.3、§3.3 | ⚠️ 功能有，结构缺 |
| T4.1 EpicVetoInput 接口定义 | — | ❌ spec 未定义 EpicVetoInput |
| T4.3 第 2、4 项调用方未传入时的处理 | §2.3 ②④ | ✅ 有 |
| T4.4 单元测试覆盖第 1、3、5、6、7、8 项 | — | ❌ spec 未要求 |
| **T5** 角色 veto 规则文档化 | §2.2 | ⚠️ 内容有，产出物缺 |
| T5.1 VETO_AND_ITERATION_RULES.md（scoring/docs 或本 Story 产出目录） | — | ❌ spec 未指定文档路径与产出物 |
| T5.2 与 REQUIREMENTS §3.4.1、§3.4.2 一致 | — | ❌ spec 未要求与 REQUIREMENTS 对齐 |
| **T6** 可调用入口与模块导出 | §2.5、§3.3 | ⚠️ 功能有，实现指引缺 |
| T6.1 scoring/veto/ 或 scoring/rules/ 下 veto-and-tier 模块 | — | ❌ spec 未指定实现路径 |
| T6.2 CONTRACT 或接口文档 | — | ❌ spec 未要求 |
| T6.3 集成测试或验收脚本 | — | ❌ spec 未要求 |

**结论**：§3 Tasks 在 spec 中**无明确对应章节**，需求映射清单 §6 也未包含 §3 Tasks。T1–T6 的功能意图在 §2、§3 中有体现，但任务分解、子任务、测试要求、产出物路径、接口文档要求均未在 spec 中显式覆盖。

---

## §5 Architecture 逐条检查

| 架构约束 | spec 对应 | 验证结果 |
|----------|-----------|----------|
| 数据输入：消费 RunScoreRecord（check_items、iteration_count、iteration_records、first_pass）；不直接读 YAML | §3.2、§2.1 | ✅ 覆盖 |
| 规则配置：loadPhaseScoringYaml、loadIterationTierYaml；veto_items 来自 scoring/rules/default/*.yaml、gaps-scoring.yaml | §3.1（含 loadGapsScoringYaml） | ✅ 覆盖；Story 7.1 称「gaps-scoring 通过等效加载」→ loadGapsScoringYaml 为等效实现 |
| 阶梯应用：phase_score = raw_phase_score × tier_coefficient | §2.4 | ✅ 覆盖 |
| Epic 聚合：输入 storyRecords[]、epicStoryCount；epicStoryCount 由调用方传入 | §2.3、§3.3 | ✅ 覆盖 |
| 输出：与 Story 1.1 schema、Story 1.2 写入接口兼容 | §2.5 | ⚠️ 提及 RunScoreRecord 兼容，未 explicit 引用 1.1/1.2 |

---

## §6 Dev Notes 逐条检查

| Dev Notes 要点 | spec 对应 | 验证结果 |
|----------------|-----------|----------|
| 6.1 技术栈：TypeScript/Node | — | ❌ spec 未提及 |
| 6.1 规则加载：scoring/parsers/rules.ts 的 loadPhaseScoringYaml、loadIterationTierYaml | §3.1 提及 loadPhaseScoringYaml、loadGapsScoringYaml、loadIterationTierYaml | ⚠️ 未指定 scoring/parsers/rules.ts 路径 |
| 6.1 Schema：scoring/writer/types.ts 的 RunScoreRecord 等 | — | ❌ spec 未提及 |
| 6.1 Veto 定义：config/code-reviewer-config.yaml；scoring/rules/default/*.yaml、gaps-scoring.yaml | §2.1、§3.1 | ⚠️ 未提及 code-reviewer-config.yaml |
| 6.2 实现位置：scoring/veto/ 或 scoring/rules/veto-and-tier.ts | — | ❌ spec 未指定 |
| 6.3 测试标准：单元测试覆盖、无循环依赖 | — | ❌ spec 未要求 |
| 6.4 与 Story 3.2 消费契约：check_items 可含 veto 类 item_id；若 3.2 未产出则与 3.2 对齐 | §3.2 | ✅ 有简要表述，但未包含「扩展 audit-item-mapping 或解析规则以产出 veto_*」等细节 |
| 6.5 禁止词表合规 | — | ❌ spec 未提及 |
| 6.6 Dev Agent Record 填写时机 | — | ❌ spec 未提及（可视为实施阶段事项，非 spec 必选） |

**结论**：§6 Dev Notes 在 spec 中**未形成对应章节**，技术栈、源树路径、实现位置、测试标准、禁止词表均未覆盖。

---

## §7 接口约定 逐条检查

| 接口约定 | spec 对应 | 验证结果 |
|----------|-----------|----------|
| 7.1 从 2.1 接收：loadPhaseScoringYaml、loadIterationTierYaml；gaps-scoring 等效加载 | §3.1 | ✅ 覆盖（loadGapsScoringYaml 即等效） |
| 7.2 从 3.2 接收：RunScoreRecord 结构及消费契约 | §3.2 | ✅ 覆盖 |
| 7.3 向 4.2 提供：applyTierAndVeto、evaluateEpicVeto | §3.3 | ✅ 覆盖 |

---

## §8 依赖 逐条检查

| 依赖项 | spec 对应 | 验证结果 |
|--------|-----------|----------|
| 前置 Story 2.1（veto_items、iteration-tier、loadPhaseScoringYaml、loadIterationTierYaml） | §3.1、§4 | ✅  implicit 覆盖 |
| Story 1.1 存储 schema 与四层架构 | — | ⚠️ spec 未 explicit 列出 |
| Story 3.2 RunScoreRecord 结构 | §3.2 | ✅ 覆盖 |

---

## 模糊表述与术语歧义

| 序号 | 位置 | 描述 | 建议 |
|-----|------|------|------|
| 1 | spec §2.1 第 1 行 | **item_id 命名歧义**：spec 列 veto_core_logic、veto_compile 等；实际 YAML 使用 veto_core_logic_error、veto_compile_fail 等，code-reviewer-config 使用 veto_core_logic、veto_compile。check_items 的 item_id 应与 YAML id 还是 config id 匹配未定义 | 明确 vetoItemIds 的构建来源（来自 loaded veto_items 的 id 字段，或含 ref 解析后的 id），以及与 Story 3.2 产出 item_id 的匹配约定 |
| 2 | spec §2.3、§3.3 | **EpicVetoInput 未定义**：evaluateEpicVeto(input) 的 input 结构未指定。Story T4.1 要求 storyRecords、epicStoryCount、需求交付率分子分母/passedStoryCount、testStats | 增加 EpicVetoInput 接口定义：storyRecords、epicStoryCount、passedStoryCount?、testStats? 等 |
| 3 | spec §3.3 | **evaluateEpicVeto 签名**：Story AC-5 为 (storyRecords, epicStoryCount, options?)，spec 为 (input) | 在 EpicVetoInput 或接口说明中明确与 Story 签名的对应关系 |
| 4 | spec §2.3 ⑤ | **「未通过」定义**：⑤ 整改≥4 次未通过 Story 数 ≥1，未说明「未通过」的判定标准（如 phase_score=0、veto_triggered、或验收结论） | 明确「未通过」的判定依据（如 veto_triggered 或验收结论字段） |

---

## 验证命令与结论

### 验证命令（已执行）

- 全文比对：原始 Story 与 spec 逐节比对  
- grep：`loadGapsScoringYaml`、`loadPhaseScoringYaml`、`gaps-scoring`、`veto_compile`、`veto_core_unmapped`、`veto_core_logic`  
- 核查：scoring/parsers/rules.ts 导出 loadGapsScoringYaml，与 Story 7.1「gaps-scoring 等效加载」一致

### 覆盖结论

| 章节 | 覆盖状态 | 说明 |
|------|----------|------|
| §1 Scope | ✅ 基本覆盖 | 1.1.4 与 Story 1.1 schema 对齐、1.1.3 EpicVetoInput 结构缺显式定义 |
| §2 AC | ✅ 覆盖 | AC-5 签名差异需在接口说明中澄清 |
| §3 Tasks | ❌ 未覆盖 | 无 Tasks 章节或映射；T1–T6 子任务、测试要求、产出物路径、接口文档未体现 |
| §5 Architecture | ✅ 覆盖 | 输出与 1.1/1.2 的 explicit 引用可强化 |
| §6 Dev Notes | ❌ 未覆盖 | 技术栈、源树、实现位置、测试标准、禁止词表均未纳入 |
| §7 接口约定 | ✅ 覆盖 | — |
| §8 依赖 | ⚠️ 部分覆盖 | Story 1.1 依赖未 explicit 列出 |

---

## 最终结论

**未达到「完全覆盖、验证通过」**。

### 未通过项与修改建议

1. **§3 Tasks 缺失**：增加「Tasks 映射」章节，将 T1–T6 及子任务映射到 spec 的 §2、§3，或直接在 spec 中列出任务分解及验收方式。  
2. **§6 Dev Notes 缺失**：增加「实现指引」或「Dev Notes 映射」，包含技术栈、scoring/parsers/rules.ts、scoring/writer/types.ts、config/code-reviewer-config.yaml、实现路径（scoring/veto/ 或 veto-and-tier.ts）、测试标准、禁止词表。  
3. **EpicVetoInput 未定义**：在 §3.3 或独立接口小节中定义 EpicVetoInput，明确 storyRecords、epicStoryCount、passedStoryCount?、testStats? 等字段。  
4. **模糊表述**：按前述「模糊表述与术语歧义」表修正 item_id 匹配约定、evaluateEpicVeto 签名对应、⑤「未通过」判定标准。  
5. **产出物路径**：T5.1 的 VETO_AND_ITERATION_RULES.md 路径（scoring/docs 或本 Story 产出目录）及与 REQUIREMENTS §3.4.1、§3.4.2 的一致性要求在 spec 中明确。

### 可补充项（建议）

- getTierCoefficient、applyTierToPhaseScore、isVetoTriggered 在 spec 中显式列出，与 Story T2.1、T2.2、T1.1 对应。  
- T6.2 CONTRACT/接口文档、T6.3 集成测试或验收脚本的要求写入 spec。  
- Story 1.1 schema 对齐约束在 §2.5 或 Architecture 小节中 explicit 引用。
