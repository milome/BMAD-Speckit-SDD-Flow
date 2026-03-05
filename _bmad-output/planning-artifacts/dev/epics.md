# AI 代码评测体系 — Epics 与 Story 列表

**版本**：1.0  
**来源**：prd.ai-code-eval-system.md、architecture.ai-code-eval-system.md

---

## 1. Epic 列表

| ID | 名称 | 描述 | 预估工时 | 优先级 |
|----|------|------|----------|--------|
| E1 | feature-eval-scoring-core | 评分核心：四层架构（六环节→四能力维度→综合百分制→L1-L5）、存储 schema、scoring 目录结构、表 A/B 映射 | 5d | P0 |
| E2 | feature-eval-rules-authority | 评分规则与权威文档：scoring/rules YAML、code-reviewer-config ref、SCORING_CRITERIA_AUTHORITATIVE.md、gaps/iteration_tier、环节 3–6 schema | 4d | P0 |
| E3 | feature-eval-lifecycle-skill | 全链路 Skill 与编排：全链路 Code Reviewer Skill、Layer 1–3 同机解析、审计产出解析、scoring 写入、与 speckit-workflow/bmad-story-assistant 协同 | 5d | P0 |
| E4 | feature-eval-coach-veto-integration | AI 代码教练、一票否决、场景与 BMAD 集成：教练定位与输出、角色/Epic 级一票否决、多次迭代阶梯式扣分、场景区分、迭代结束标准、BMAD 五层集成 | 4d | P0 |
| E5 | feature-eval-scoring-enhancement | Scoring 模块功能补充：版本锁定、三阶段评分规则、LLM 解析容错、聚类分析、SFT 提取、Prompt 优化、规则自优化、Bugfix 回写、回退建议等 12 项技术交底书声称功能 | 10-17d | P0 |

---

## 2. Story 列表

### Epic 1：feature-eval-scoring-core

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 1.1 | eval-system-scoring-core：实现四层架构（六环节分项评分、四能力维度聚合、综合百分制、L1-L5 等级）、六环节权重 20/25/25/15/10/5、存储 schema（run_id/scenario/stage/phase_score/check_items/iteration_count/iteration_records/first_pass）、scoring/data 与 scoring/rules 目录结构、表 A 表 B 映射 | 无 | 3d | 低 |
| 1.2 | eval-system-storage-writer：实现评分写入逻辑，支持 JSON/JSONL 追加模式，单次运行单文件与 scores.jsonl 双模式，check_items 明细结构 | E1.1 | 2d | 低 |

### Epic 2：feature-eval-rules-authority

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 2.1 | eval-rules-yaml-config：实现 scoring/rules 下环节 2/3/4 的 YAML schema，与 code-reviewer-config 通过 ref 衔接，veto_items、weights、items 结构，gaps-scoring.yaml、iteration-tier.yaml | E1.1 | 2d | 中 |
| 2.2 | eval-authority-doc：产出 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md，含 24 项内容（BMAD 五层、阶段→环节映射、检查项清单、一票否决、L1-L5、schema、Code Reviewer 整合、Epic 综合评分等），与 scoring/rules 一致且可追溯；须含题量表述（区分已实现题数 vs 目标题池规模、与文档/产出一致）；spec/tasks 须含「24 项与需求 §3.10 逐一核对清单」以可验证 | E2.1 | 2d | 低 |

### Epic 3：feature-eval-lifecycle-skill

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 3.1 | eval-lifecycle-skill-def：定义全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle），引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules，编排逻辑（触发时机、stage 映射、解析规则） | E1.2, E2.1 | 2d | 中 |
| 3.2 | eval-layer1-3-parser：实现 Layer 1（prd/arch）、Layer 3（story）审计产出的同机解析，从 audit-prompts-prd/arch、Create Story 审计报告提取维度，映射环节 1 检查项，约定 AUDIT_Story_{epic}-{story}.md 路径 | E3.1 | 2d | 中 |
| 3.3 | eval-skill-scoring-write：全链路 Skill 在 stage 审计通过后调用解析并写入 scoring 存储，与 speckit-workflow、bmad-story-assistant 协同，触发模式表实现 | E3.1, E3.2 | 1d | 低 |

### Epic 4：feature-eval-coach-veto-integration

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 4.1 | eval-veto-iteration-rules：实现一票否决项与环节映射（OWASP Top 10、CWE-798、核心需求遗漏等）、角色一票否决权（批判审计员、AI 代码教练）、Epic 级一票否决 8 项条件、多次迭代阶梯式扣分（1 次 100%/2 次 80%/3 次 50%/≥4 次 0%）、致命/严重问题差异化 | E2.1 | 2d | 中 |
| 4.2 | eval-ai-coach：实现 AI 代码教练定位、职责、人格、技能配置（引用全链路 Skill）、工作流、输出格式（summary/phase_scores/weak_areas/recommendations/iteration_passed）、一票否决权，禁止「面试」主导表述 | E3.3 | 1d | 低 |
| 4.3 | eval-scenario-bmad-integration：实现场景区分（real_dev/eval_question）、两种场景均走 Layer 1→5 完整路径、各阶段迭代结束标准、轻量化三原则（同机执行、可选启用、最小侵入）、数据污染防护（题目来源与时间隔离、定期迭代题池、混淆变量校验、私有闭卷与评测接口分离；操作要点与触发条件可置于 scoring/ 或项目 checklist）、与 BMAD 五层 workflows 集成点 | E3.3 | 1d | 低 |

### Epic 5：feature-eval-scoring-enhancement

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 5.1 | eval-foundation-modules：版本锁定校验（B02）、触发加载器（B04）、eval_question E2E（B10）、Bugfix 回写（B12）、Git 回退建议（B13） | E4 | 14-28h | 低 |
| 5.2 | eval-scoring-rules-expansion：spec/plan/tasks 三阶段评分规则（B03）、四维加权评分（B11） | E2.1 | 20-36h | 中 |
| 5.3 | eval-parser-llm-fallback：LLM 结构化提取容错层（B05） | E5.2 | 16-24h | 中 |
| 5.4 | eval-analytics-clustering：能力短板聚类分析（B06） | 无 | 8-12h | 低 |
| 5.5 | eval-analytics-advanced：SFT 提取（B07）、Prompt 优化建议（B08）、规则自优化建议（B09） | E5.4 | 20-36h | 中 |

---

## 3. PRD 需求 → Story 映射

| PRD 需求 ID | 映射 Story |
|-------------|------------|
| REQ-1.1~1.6 | 1.1, 4.3 |
| REQ-2.1~2.5 | 1.1, 3.2, 4.3 |
| REQ-3.1~3.10 | 1.1, 1.2, 2.1, 2.2, 4.1 |
| REQ-3.11 | 4.3 |
| REQ-3.12~3.17, REQ-3.13a | 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2 |
| REQ-4.1, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2 | 2.2, 4.3 |

---

## 4. Architecture 组件 → Task 映射

| Architecture 组件 | 映射 Story |
|-------------------|------------|
| 评分规则 scoring/rules/*.yaml | 2.1 |
| 权威文档 SCORING_CRITERIA_AUTHORITATIVE.md | 2.2 |
| 评分存储 scoring/data/、schema | 1.1, 1.2 |
| 全链路 Skill | 3.1, 3.2, 3.3 |
| code-reviewer-config 引用关系 | 2.1, 3.1 |
| audit-prompts 引用关系 | 3.1, 3.2 |
| 表 A 表 B | 1.1, 2.2 |
| 审计产出→评分环节映射 | 3.2, 2.2 |
| Layer 1–3 同机解析 | 3.2 |
| 数据流、BMAD 集成点 | 3.3, 4.3 |
| 数据污染防护（§3.7 四条） | 4.3 |
| 题量表述（§3.9 已实现 vs 目标规模） | 2.2 |

---

## 5. 依赖图

```
E1.1 (scoring-core)
    ├──→ E1.2 (storage-writer)
    └──→ E2.1 (rules-yaml)

E2.1 (rules-yaml)
    ├──→ E2.2 (authority-doc)
    └──→ E4.1 (veto-iteration)

E1.2, E2.1
    └──→ E3.1 (lifecycle-skill-def)

E3.1
    ├──→ E3.2 (layer1-3-parser)
    └──→ E3.3 (skill-scoring-write)

E3.2
    └──→ E3.3

E3.3
    └──→ E4.2 (ai-coach), E4.3 (scenario-bmad)

E2.1
    └──→ E4.1 (veto-iteration)
```

**关键路径**：E1.1 → E1.2 → E3.1 → E3.2 → E3.3 → E4.2/E4.3

---

## 6. 命名规范

- **Epic**：feature-{domain}-{capability}（如 feature-eval-scoring-core）
- **Story**：{epic_num}.{story_num} {description}（如 1.1 eval-system-scoring-core）

---

*本文档确保每个 PRD 需求映射到至少一个 Story，每个 Architecture 组件映射到至少一个 task。*

---

# Epic 5: feature-eval-scoring-enhancement — Scoring 模块功能补充

**版本**：1.0  
**来源**：`_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1（三轮审计通过）、`_bmad-output/patent/技术交底书_BMAD-Speckit-SDD-Flow.md`  
**前置已完成**：GAP-B01（RunScoreRecord 版本追溯字段，路径 C：base_commit_hash + content_hash）

---

## 1. Epic 概述

### 1.1 目标

补充 Scoring 模块中技术交底书声称但尚未实现的 12 项功能（GAP-B02 至 GAP-B13），使系统具备：
1. 跨阶段版本锁定校验能力（B02）
2. spec/plan/tasks 三阶段完整评分规则（B03）
3. YAML 配置驱动的程序化触发控制（B04）
4. 审计报告解析容错层（B05）
5. 能力短板聚类分析与 AI Coach 增强（B06）
6. SFT 微调数据集提取能力（B07）
7. Prompt 模板优化建议生成（B08）
8. 评分规则自优化反馈（B09）
9. eval_question 场景端到端验证（B10）
10. 四维加权评分的程序化实现（B11）
11. Bugfix 数据自动回写到主 Story（B12）
12. D 级熔断后 Git 回退建议（B13）

### 1.2 范围

- **包含**：scoring/ 目录下的新增模块（gate、trigger、analytics、bugfix、parsers 扩展）及其测试
- **包含**：config/ 下评分规则 YAML 的补充
- **包含**：scripts/ 下 CLI 工具的新增和扩展
- **不包含**：技术交底书本身的文字修改（由 `TASKS_交底书改进.md` 单独管理）
- **不包含**：UI/前端展示层

### 1.3 成功标准

| 标准 | 度量 |
|------|------|
| 功能覆盖 | 12 个 GAP 全部实现，无降级方案 |
| 测试覆盖 | 新增 68 个测试用例全部通过，零回归 |
| 代码质量 | 每个 Story 实施后审计达到 B 级以上 |
| 向后兼容 | 现有 129+ 个测试持续通过，`RunScoreRecord` 新增字段全部可选 |
| 文档一致 | 技术交底书声称的功能与代码实现一致（无"声称但未实现"的 Gap） |

### 1.4 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| B05 LLM API 依赖引入外部网络调用 | 离线环境不可用 | 严格 fallback 链：正则 → LLM → 抛异常；无 API key 时跳过 LLM |
| B05 审计报告发送至外部 LLM API | 数据安全 | 环境变量控制开关 + system prompt 限制输出 |
| Schema 膨胀（5 个新增字段） | 维护成本增加 | 所有字段可选，JSDoc 语义标注清晰 |
| B06-B09 分析模块实用性待验证 | 投入产出比不确定 | 独立于评分流水线，失败不影响核心功能 |

---

## 2. Story 列表

| Story ID | 名称 | 包含 GAP | 依赖 | 预估工期 |
|----------|------|---------|------|---------|
| 5.1 | eval-foundation-modules | B02, B04, B10, B12, B13 | E4（已完成） | 14-28h |
| 5.2 | eval-scoring-rules-expansion | B03, B11 | E2.1（已完成） | 20-36h |
| 5.3 | eval-parser-llm-fallback | B05 | Story 5.2（B03 的 audit-generic.ts） | 16-24h |
| 5.4 | eval-analytics-clustering | B06 | 无（可独立，但 B03 数据源扩大分析范围） | 8-12h |
| 5.5 | eval-analytics-advanced | B07, B08, B09 | Story 5.4（B06 聚类结果） | 20-36h |

---

## 3. Story 详细定义

### Story 5.1: eval-foundation-modules（基础模块 + 独立模块）

**As a** Scoring 系统的开发者，  
**I want** 跨阶段版本锁定校验、程序化触发控制、eval_question 端到端验证、Bugfix 回写、Git 回退建议，  
**So that** Scoring 系统具备完整的流转控制和闭环能力。

**包含 GAP**：B02（版本锁定）、B04（触发加载器）、B10（eval_question E2E）、B12（Bugfix 回写）、B13（回退建议）

**Acceptance Criteria:**

**Given** specify 阶段审计通过且 `source_hash` 已写入记录  
**When** plan 阶段启动时调用 `checkPreconditionHash`  
**Then** 系统比对 spec.md 当前 hash 与记录中的 `source_hash`，匹配则 proceed，不匹配则 block  
**And** 上一阶段无记录时返回 warn_and_proceed

**Given** `scoring-trigger-modes.yaml` 中 `enabled=true` 且 stage 已注册  
**When** 调用 `shouldWriteScore(event, stage, scenario)`  
**Then** 返回 `write=true` 和正确的 `writeMode`  
**And** `enabled=false` 或 stage 未注册时返回 `write=false`

**Given** eval_question 场景的审计报告  
**When** 执行 parse → write → coach diagnose 全链路  
**Then** 记录正确写入且 coach 诊断成功  
**And** content_hash 和 base_commit_hash 正确填充

**Given** BUGFIX 文档的 §7 已完成任务列表  
**When** 调用 `writebackBugfixToStory`  
**Then** progress.txt 追加格式化的回写行（时间戳 + branchId + storyId + 摘要）  
**And** 支持 `[x]`、`[X]`、`* [x]`、缩进等 Markdown checkbox 变体

**Given** D 级熔断触发  
**When** 调用 `suggestRollback`  
**Then** 返回包含告警前缀的回退建议和命令列表  
**And** 不自动执行任何 git 操作

**新增文件**: 5 实现 + 5 测试 + 2 fixture = 12  
**修改文件**: types.ts, run-score-schema.json, parse-and-write.ts, parse-and-write-score.ts = 4  
**新增测试**: 7+7+3+6+4 = 27

---

### Story 5.2: eval-scoring-rules-expansion（评分规则扩展 + 四维加权）

**As a** Scoring 系统的审计触发方，  
**I want** spec/plan/tasks 三阶段具备完整的百分制评分规则，且审计报告支持四维加权评分，  
**So that** 全流程每个节点都有程序化的评分标准，且评分维度权重由配置驱动。

**包含 GAP**：B03（评分规则）、B11（四维加权）

**Acceptance Criteria:**

**Given** spec 阶段的审计报告  
**When** 调用通用解析器 `parseGenericReport`  
**Then** 正确解析为 `RunScoreRecord`，stage='spec'，phaseWeight=0.2  
**And** check_items 包含 spec_demand_coverage 等 item_id  
**And** plan、tasks 阶段同理

**Given** spec-scoring.yaml 中定义了 4 个 items 和 1 个 veto_item  
**When** `applyTierAndVeto` 处理 spec 阶段记录  
**Then** 正确应用扣分和一票否决逻辑

**Given** 审计报告包含维度评分（`维度名: 分数/100` 格式）  
**When** 调用 `parseDimensionScores(content, mode)`  
**Then** 返回 DimensionScore 数组，加权总分 = Σ(score × weight / 100)  
**And** 报告无维度评分时返回空数组（fallback 到等级映射）

**Given** `stageToMode('spec')` 调用  
**When** 执行映射  
**Then** 返回 'prd' mode（spec/plan/tasks 共用 prd 维度定义）

**新增文件**: 2 实现 + 2 测试 + 4 fixture = 8  
**修改文件**: 3 YAML + audit-index.ts + parsers/index.ts + run-score-schema.json + parse-and-write-score.ts + audit-prd.ts + weights.ts = 9  
**新增测试**: 9+6 = 15

---

### Story 5.3: eval-parser-llm-fallback（LLM 结构化提取容错层）

**As a** Scoring 系统的解析模块，  
**I want** 在正则解析失败时自动调用 LLM 做结构化提取，  
**So that** 非标格式的审计报告也能被正确解析。

**包含 GAP**：B05

**前置依赖**: Story 5.2（`audit-generic.ts` 中的 `extractOverallGrade` 需已迁移）

**Acceptance Criteria:**

**Given** 审计报告正则解析成功  
**When** 执行解析流程  
**Then** 不调用 LLM API

**Given** 正则解析失败且 `SCORING_LLM_API_KEY` 已配置  
**When** 调用 `llmStructuredExtract`  
**Then** 返回 `{ grade, issues, veto_items }` 结构化结果  
**And** schema 校验失败时重试 1 次

**Given** `SCORING_LLM_API_KEY` 未配置  
**When** 正则解析失败  
**Then** 抛出原始 ParseError（与当前行为一致）

**新增文件**: 1 实现 + 1 测试 = 2  
**修改文件**: audit-prd.ts, audit-arch.ts, audit-story.ts, audit-generic.ts = 4  
**新增测试**: 6

---

### Story 5.4: eval-analytics-clustering（能力短板聚类分析）

**As a** AI Coach 模块，  
**I want** 基于 check_items 失败模式的两层聚类分析（item_id 频率 + 关键词聚合），  
**So that** 能力短板识别从简单阈值判定升级为结构化聚类分析。

**包含 GAP**：B06

**Acceptance Criteria:**

**Given** 多条 RunScoreRecord 中存在相同 item_id 的 check_items 失败  
**When** 调用 `clusterWeaknesses(records, minFrequency=2)`  
**Then** 聚合为 WeaknessCluster，包含 keywords、severity_distribution、affected_stages  
**And** severity 从 score_delta 反向映射（≤-10→高，-10~-5→中，>-5→低）

**Given** AI Coach `coachDiagnose` 调用  
**When** 执行诊断  
**Then** `weak_areas` 保持 string[] 向后兼容  
**And** 新增 `weakness_clusters` 字段包含完整聚类结果

**新增文件**: 1 实现 + 1 测试 + 1 CLI = 3  
**修改文件**: diagnose.ts, coach/types.ts = 2  
**新增测试**: 5

---

### Story 5.5: eval-analytics-advanced（SFT 提取 + Prompt 优化 + 规则建议）

**As a** 模型优化反馈闭环系统，  
**I want** 从 C/D 级审计记录中提取 SFT 数据集、生成 Prompt 优化建议、生成规则升级建议，  
**So that** 审计数据能反向驱动模型能力和管控规则的持续优化。

**包含 GAP**：B07（SFT 提取）、B08（Prompt 优化）、B09（规则建议）

**前置依赖**: Story 5.4（B06 聚类结果作为 B08/B09 输入）

**Acceptance Criteria:**

**Given** scores.jsonl 中存在 phase_score ≤ 60 的 C/D 级记录  
**When** 调用 `extractSftDataset`  
**Then** 从 source_path 关联 BUGFIX 文档，提取 §1/§4 作为 instruction  
**And** 通过 git diff 提取 bad/good 代码对  
**And** source_path 不存在或 git diff 失败时跳过该记录并 warn

**Given** WeaknessCluster 聚类结果  
**When** 调用 `generatePromptSuggestions(clusters)`  
**Then** 匹配 skills/ 目录下的 Skill 文件（关键词交集 ≥ 2）  
**And** 输出 PromptSuggestion 列表（priority 按 frequency 分级）

**Given** WeaknessCluster 聚类结果  
**When** 调用 `generateRuleSuggestions(clusters)`  
**Then** 失败率 >50% 且 deduct<8 → increase_deduct  
**And** 失败率 >80% → promote_to_veto  
**And** 输出 YAML 建议文件，不直接修改规则文件

**新增文件**: 3 实现 + 3 测试 + 3 CLI = 9  
**修改文件**: types.ts, run-score-schema.json, parse-and-write.ts = 3  
**新增测试**: 7+4+4 = 15

---

## 4. 需求 → Story 映射

| 来源需求（TASKS_gaps v2.1 中的 GAP） | 映射 Story |
|--------------------------------------|-----------|
| B02 版本锁定机制 | 5.1 |
| B03 spec/plan/tasks 评分规则 | 5.2 |
| B04 触发加载器 | 5.1 |
| B05 LLM 结构化提取 | 5.3 |
| B06 聚类分析 | 5.4 |
| B07 SFT 提取 | 5.5 |
| B08 Prompt 优化建议 | 5.5 |
| B09 规则自优化 | 5.5 |
| B10 eval_question E2E | 5.1 |
| B11 四维加权评分 | 5.2 |
| B12 Bugfix 回写 | 5.1 |
| B13 Git 回退建议 | 5.1 |

---

## 5. 依赖图

```
E1-E4 (已完成)
    └──→ E5.1 (foundation-modules)  [B02,B04,B10,B12,B13]
    └──→ E5.2 (scoring-rules)      [B03,B11]
              └──→ E5.3 (llm-fallback)    [B05]
    └──→ E5.4 (analytics-clustering) [B06]
              └──→ E5.5 (analytics-advanced) [B07,B08,B09]
```

**关键路径**：E5.2 → E5.3（B05 依赖 B03 的 audit-generic.ts）  
**并行路径**：E5.1 和 E5.2 和 E5.4 可并行执行

---

## 6. 汇总统计

| 指标 | 数值 |
|------|------|
| Story 数量 | 5 |
| GAP 覆盖 | 12/12（B02-B13 全部覆盖） |
| 新增测试 | 68 个 |
| 新增文件 | 33 个 |
| 修改文件 | ~15 个 |
| 总预估工期 | 78-136 小时 |
