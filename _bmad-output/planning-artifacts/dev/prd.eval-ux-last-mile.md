# 用户体验层「最后一公里」— 产品需求文档（PRD）

**版本**：1.0  
**来源**：REQUIREMENTS_用户体验层最后一公里_Coach入口与评测仪表盘_需求分析_Refined.md  
**映射范围**：§1–§8 核心内容 100% 覆盖，含 Deferred Gaps

---

## Executive Summary

为**开发者、技术负责人、AI 研发效能工程师、团队 Lead** 提供零门槛的 Coach 诊断、评分查询和 SFT 提取入口，将 BMAD 评测体系的底层能力（parser、veto、coach、analytics）从 CLI 暴露为 Cursor Command/Skill，以提升评分体系的使用率和迭代效率。用户无需了解 run-id、scores.jsonl 或终端命令，通过 `/bmad-coach`、`/bmad-scores`、`/bmad-dashboard` 等即可一键获取诊断报告、评分汇总和仪表盘。

---

## 1. 产品概述

### 1.1 问题陈述（problem-statement 结构）

**I am**：已完成 Dev Story 的开发者 / 想了解项目健康度的技术负责人 / 需提取微调数据的 AI 研发效能工程师 / 需维护评测题库的团队 Lead

**Trying to**：快速知道短板、查看评分、生成微调数据、管理题目

**But**：必须懂 run-id、会读 scores.jsonl、会用 CLI 命令（如 `npx ts-node scripts/coach-diagnose.ts --run-id <id>`），无用户友好入口

**Because**：底层引擎（parser、veto、coach、analytics、SFT extractor）已就绪，但没有将能力暴露为 Command/Skill 的「最后一公里」

**Which makes me feel**：能力存在却难以使用、体验割裂，违背「通过 Skills 和 Commands 在 Cursor 中自然触发」的设计初衷

**How Might We**：在 Cursor 中让用户无需了解 run-id 即可获取 Coach 诊断、评分查询和 SFT 提取？

### 1.2 产品定位

评测体系的**用户友好入口层**，覆盖 Coach 诊断、评分查询、全局仪表盘、SFT 微调数据提取、题库管理，使开发者、技术负责人、AI 研发效能工程师、团队 Lead 在 Cursor 中零门槛使用评分与诊断能力。

---

## 2. 目标用户

### 2.1 概要表

| 用户类型 | 典型场景 | 期望交互 |
|----------|----------|----------|
| 开发者（日常） | 完成一轮 Dev Story 后想知道短板 | 在 Cursor 中说「帮我看看短板」或运行 `/bmad-coach` |
| 技术负责人 | 了解整个项目代码质量健康度 | 一份一页仪表盘：总分、各维度得分、趋势 |
| AI 研发效能工程师 | 提取微调数据集用于模型优化 | 在 Cursor 中说「提取微调数据」或运行 `/bmad-sft-extract` |
| 团队 Lead | 维护和扩充评测题库 | 有管理入口可增删改查题目 |

### 2.2 Proto-Persona

#### Dev（日常开发者）
- **Role:** 在 Cursor 中执行 Dev Story，使用 BMAD+Speckit 流程
- **Goals:** 快速了解本轮短板，改进下次实现；不想打断工作流
- **Pains:** 不知道 run-id 是什么、scores.jsonl 在哪、不想查文档找 CLI 命令
- **Quotes:** 「我只是想知道哪里扣了分，不想查文档找命令」
- **Behaviors:** 习惯用 Command 和自然语言，而非终端；期望「说一句或点一下就能看到结果」

#### TechLead（技术负责人）
- **Role:** 负责项目整体质量，需向团队或上级汇报
- **Goals:** 一页了解项目健康度；识别薄弱环节以便分配资源
- **Pains:** 评分数据散落在 jsonl，无汇总视图；需手动聚合才有结论
- **Quotes:** 「我想要一句结论：项目 78 分，短板在测试覆盖」
- **Behaviors:** 定期查看（每周/每迭代）；期望仪表盘可复用到汇报材料

#### AIEng（AI 研发效能工程师）
- **Role:** 优化模型或工作流，需从评分数据提取训练样本
- **Goals:** 从低分记录中提取 bad/good 代码对，用于 SFT 微调
- **Pains:** SFT 提取只有 CLI，无 Command 入口；需理解 scripts 目录结构
- **Quotes:** 「能不能在 Cursor 里说『提取微调数据』就自动跑完？」
- **Behaviors:** 按需触发；期望输出路径可配置、摘要含跳过原因

#### TeamLead（团队 Lead）
- **Role:** 维护评测题库，支撑 eval_question 场景
- **Goals:** 增删改查题目；保证题目版本与评分隔离
- **Pains:** 无管理入口；题目散落、manifest 需手写
- **Quotes:** 「需要一个入口列出当前题目、添加新题、跑某道题」
- **Behaviors:** 不频繁操作；期望 list/add/run 简单可用

---

## 3. 核心价值

1. **零门槛使用**：无需了解 run-id、scores.jsonl 结构、CLI 命令，通过 Command/Skill 即可触发。
2. **自动发现**：系统自动扫描最新数据、自动选 run-id、自动输出 Markdown 报告。
3. **一致体验**：空数据、无数据时统一提示「暂无数据，请先完成至少一轮 Dev Story」。
4. **向后兼容**：不修改现有 scores.jsonl schema，查询层为只读。

---

## 4. 成功指标

### 4.1 Primary Metric（主指标）
**Command 使用率**：用户在 Cursor 中通过 `/bmad-coach`、`/bmad-scores`、`/bmad-dashboard`、`/bmad-sft-extract` 触发操作的次数（替代 CLI 直接调用）
- **目标**：E6 完成后，Coach 和 Scores 的 Command 调用成为主路径；CLI 仅用于调试

### 4.2 Secondary Metrics（次指标）
| 指标 | 目标 |
|------|------|
| REQ-UX-1~5 覆盖 | PRD 需求 100% 映射到至少一个 Story |
| 验收标准可验证 | 每项 AC 有明确执行步骤与预期结果 |
| 空数据体验 | 无数据时 100% 返回结构化提示「暂无数据，请先完成至少一轮 Dev Story」 |

### 4.3 Guardrail Metrics（护栏指标）
| 指标 | 约束 |
|------|------|
| 向后兼容 | 不修改现有 scores.jsonl schema；查询层仅读 |
| Deferred Gaps 追踪 | GAP-024~027 纳入后续 Story 或 Roadmap |
| 实施前提条件 | run_id 约定、manifest schema 在实施前定稿 |

### 4.4 优先级依据（ICE 框架）

| Epic | Impact | Confidence | Ease | 结论 |
|------|--------|------------|------|------|
| E6 Coach+Query | 高（解决最大痛点：run-id） | 高（底层已就绪） | 低 Effort（Command 调度现有模块） | **P0** |
| E7 Dashboard+SFT | 中（仪表盘+SFT 入口） | 高 | 中 Effort | **P1** |
| E8 题库 | 长期价值 | 中（需 manifest/题目模板定稿） | 高 Effort | **P2** |

---

## 5. 详细需求列表

### 5.1 REQ-UX-1：Coach Skill/Command（面向用户的诊断入口）

**优先级**：P0

#### User Story 示例（E6-US1）
- **Summary:** 零参数 Coach 诊断，让开发者无需 run-id 即可获得短板报告
- **As a** 日常开发者
- **I want to** 运行 `/bmad-coach` 而不提供任何参数
- **so that** 我能立刻看到最近一轮的 Coach 诊断报告
- **Acceptance Criteria:**
  - **Scenario:** 无参数运行 Coach
  - **Given:** scoring/data/ 下有至少一条评分记录
  - **When:** 用户运行 `/bmad-coach`
  - **Then:** 输出包含 phase_scores、weak_areas、recommendations 的 Markdown 诊断报告

#### 需求明细

| ID | 需求描述 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| REQ-UX-1.1 | 新建 Command `commands/bmad-coach.md` | 用户运行 `/bmad-coach` 即可触发 AI Coach 诊断 | P0 |
| REQ-UX-1.2 | 无需 run-id，自动扫描 `scoring/data/`（或 getScoringDataPath()）下 `.json`（排除非评分 schema）和 `scores.jsonl` | 按 timestamp 排序，取最新 N 条（默认 N=100，可配置）；超出时提示「仅展示最近 N 条」 | P0 |
| REQ-UX-1.3 | 空目录行为 | 返回结构化 Markdown 提示「暂无评分数据，请先完成至少一轮 Dev Story」 | P0 |
| REQ-UX-1.4 | 多 worktree | 首版以 process.cwd() 或 getScoringDataPath() 为根；多 worktree 聚合扫描为 Deferred | P0 |
| REQ-UX-1.5 | 可选参数 `/bmad-coach --epic 3` | 仅诊断 Epic 3 相关数据；仅对符合 run_id 约定或含 metadata 的 record 生效 | P0 |
| REQ-UX-1.6 | 可选参数 `/bmad-coach --story 3.3` | 解析规则：`--story X.Y` → epicId=X, storyId=Y；`--epic X` → epicId=X | P0 |
| REQ-UX-1.7 | 新建或扩展 Skill `bmad-eval-analytics` | 用户可用自然语言触发；Skill 复用 Command 的 discoverLatestRunIds 等共享逻辑；「最近一轮」以 timestamp 最近为准 | P0 |

**验收标准**：

- AC-1：用户运行 `/bmad-coach` 无需任何参数即可看到诊断报告
- AC-2：诊断报告包含 phase_scores、weak_areas、recommendations
- AC-3：支持按 Epic/Story 筛选

---

### 5.2 REQ-UX-2：按 Epic/Story 查询评分（索引能力）

**优先级**：P0

| ID | 需求描述 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| REQ-UX-2.1 | 在 `scoring/query/` 下提供 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | API 实现且可从 data/*.json 和 scores.jsonl 读取 | P0 |
| REQ-UX-2.2 | epic_id/story_id 解析规则 | 从 run_id 约定（如 `{prefix}-e{epic}-s{story}`）或 source_path（`story-{epic}-{story}`）提取；历史无约定时 Epic/Story 筛选不可用，调用方得到明确反馈 | P0 |
| REQ-UX-2.3 | 去重规则 | 同 run_id+stage 取 timestamp 最新一条 | P0 |
| REQ-UX-2.4 | Epic/Story 筛选范围 | 仅针对 real_dev；eval_question 数据隔离 | P0 |
| REQ-UX-2.5 | 数据源过滤 | 仅读取评分 schema 文件；排除非评分 json | P0 |
| REQ-UX-2.6 | Command `/bmad-scores` | `/bmad-scores` 显示全部摘要；`--epic 3` 显示 Epic 3 各 Story；`--story 3.3` 显示 Story 3.3 各阶段明细 | P0 |

**验收标准**：

- AC-4：queryByStory(3, 3) 返回 Story 3.3 的所有评分记录（对符合约定的数据）
- AC-5：`/bmad-scores` 输出表格格式的评分汇总

---

### 5.3 REQ-UX-3：全局仪表盘（一页汇总）

**优先级**：P1

| ID | 需求描述 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| REQ-UX-3.1 | 仪表盘生成器（`scoring/dashboard/`） | 项目健康度总分：沿用 PHASE_WEIGHTS 与 record 内 phase_weight 计算加权平均 | P1 |
| REQ-UX-3.2 | 四维雷达图数据 | 从 dimension_scores 提取；无 dimension_scores 时显示「无数据」 | P1 |
| REQ-UX-3.3 | 短板 Top 3 | 得分最低的 3 个阶段/Story | P1 |
| REQ-UX-3.4 | Veto 触发统计 | 从 check_items 中 passed=false 且 item_id 在 veto 配置内的计数 | P1 |
| REQ-UX-3.5 | 趋势 | 按 run_id 去重取最近 5 个 run；比较最近 vs 前一次（或最近 vs 最前）的加权总分，输出升/降/持平 | P1 |
| REQ-UX-3.6 | 无数据时 | 输出与 Coach 一致提示「暂无数据，请先完成至少一轮 Dev Story」，写入 `_bmad-output/dashboard.md` | P1 |
| REQ-UX-3.7 | Command `/bmad-dashboard` | 运行即可看到仪表盘；输出到 `_bmad-output/dashboard.md` 且在对话中展示 | P1 |

**验收标准**：

- AC-6：仪表盘包含总分、四维得分、短板 Top 3、Veto 统计
- AC-7：无评分数据时优雅提示「暂无数据，请先完成至少一轮 Dev Story」

---

### 5.4 REQ-UX-4：SFT 提取 Skill/Command（微调数据管理）

**优先级**：P1

| ID | 需求描述 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| REQ-UX-4.1 | phase_score 阈值 | 默认 60，可通过 env 或 CLI 参数配置 | P1 |
| REQ-UX-4.2 | 提取逻辑 | 扫描 phase_score≤阈值 的记录；从 BUGFIX 提取 §1、§4；git diff 生成 bad/good 代码对 | P1 |
| REQ-UX-4.3 | git diff 失败 fallback | 产出 instruction-only 样本（§1+§4），不含 input/output；SftEntry 增加 has_code_pair: boolean | P1 |
| REQ-UX-4.4 | 输出路径 | 默认 `scoring/data/sft-dataset.jsonl`；支持 `--output <path>` | P1 |
| REQ-UX-4.5 | 输出摘要 | 共提取 N 条，覆盖 M 个 Story；含「跳过 K 条（原因：git diff 失败 / 无 source_path / …）」 | P1 |
| REQ-UX-4.6 | 去重 | 按 source_run_id + base_commit_hash + source_path 去重 | P1 |
| REQ-UX-4.7 | 纳入 bmad-eval-analytics Skill | 用户可说「提取微调数据集」或「生成 SFT 训练数据」触发 | P1 |

**验收标准**：

- AC-8：`/bmad-sft-extract` 无参数即可运行
- AC-9：输出为合法 JSONL，每行含 instruction、input、output（或 has_code_pair: false 时 input/output 为空）

---

### 5.5 REQ-UX-5：题库管理框架（最小可行）

**优先级**：P2

| ID | 需求描述 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| REQ-UX-5.1 | 目录结构 `scoring/eval-questions/v1/` | 含题目 .md 与 manifest.yaml | P2 |
| REQ-UX-5.2 | manifest.yaml schema | questions: [{ id, title, path, difficulty?, tags[] }] | P2 |
| REQ-UX-5.3 | Command `/bmad-eval-questions list` | 返回当前版本题目清单 | P2 |
| REQ-UX-5.4 | Command `/bmad-eval-questions add --title "xxx"` | 首版生成 q00X-{slug}.md 模板到当前版本目录 | P2 |
| REQ-UX-5.5 | Command `/bmad-eval-questions run --id q001 --version v1` | 加载题目→调用评审/Skill→写入时注入 scenario=eval_question、question_version=v1 | P2 |
| REQ-UX-5.6 | run 失败时 | 输出明确错误信息（文件不存在、解析失败等） | P2 |
| REQ-UX-5.7 | run_id 约定 | 含 version，如 `eval-q001-v1-{timestamp}`，实现 v1/v2 评分隔离 | P2 |
| REQ-UX-5.8 | question_version 校验 | scenario=eval_question 时必填，缺失则 throw | P2 |
| REQ-UX-5.9 | 题目文档 | 需与 parser 输入格式兼容，定义题目模板 | P2 |

**验收标准**：

- AC-10：`/bmad-eval-questions list` 返回题目清单
- AC-11：题库版本隔离，v1 和 v2 的评分数据不混淆

---

## 6. Deferred Gaps 与 Out of Scope

### 6.1 Out of Scope（本版不纳入）
- **多 worktree 聚合扫描**：首版以当前工作目录为根；多 worktree 用户需手动指定 dataPath
- **组合 queryByFilters API**：首版仅原子 query，组合筛选由调用方 filter
- **交互式 add 引导**：题库 add 首版仅生成模板，无向导式创建
- **SFT max_instruction_tokens**：超长 instruction 暂不截断，可选配置后续实现

### 6.2 Deferred Gaps（后续 Story）

| Gap ID | 描述 | 影响 | 归属建议 |
|--------|------|------|----------|
| GAP-024 | 组合 queryByFilters API | 复杂筛选需调用方多次 query+filter | E6 或后续 Story |
| GAP-025 | 多 worktree 聚合扫描 | 多 worktree 用户需手动指定 dataPath | 后续迭代 |
| GAP-026 | 交互式 add 引导 | add 首版仅生成模板，无向导式创建 | 后续增强 |
| GAP-027 | SFT instruction max_instruction_tokens | 超长 instruction 可能影响 fine-tune | 可选配置，后续实现 |

---

## 7. 实施前提条件（Challenger 终审）

**Status**：satisfied（已满足，2026-03-05）

**已定稿**：

1. **run_id 约定**：`scoring/docs/RUN_ID_CONVENTION.md` — real_dev 格式 `{prefix}-e{epic}-s{story}-{ts}`，eval_question 格式 `eval-q{id}-{version}-{ts}`；source_path fallback 解析规则。
2. **manifest.yaml schema 与题目模板**：`scoring/eval-questions/MANIFEST_SCHEMA.md` — questions: [{ id, title, path, difficulty?, tags[] }]；题目 .md 与 parser 输入格式兼容说明；`scoring/eval-questions/v1/manifest.yaml` 已就绪。

---

## 8. 非功能性约束

| 约束 | 说明 |
|------|------|
| 轻量化三原则 | 同机执行、可选启用、最小侵入（沿用 Story 4.3 约定） |
| 数据隔离 | eval_question 与 real_dev 的评分数据严格分离 |
| 向后兼容 | 不修改现有 scores.jsonl 的 schema，查询层为只读 |
| 无外部依赖 | 仪表盘和查询均在本地完成，不依赖外部服务 |

---

## 9. Epic 拆分与映射

### 9.1 Roadmap 视图（Now / Next / Later）

| 阶段 | Epic | 包含 REQ | 说明 |
|------|------|----------|------|
| **Now** | E6 | REQ-UX-1, REQ-UX-2 | Coach + 评分查询；解决 run-id 痛点 |
| **Next** | E7 | REQ-UX-3, REQ-UX-4 | 仪表盘 + SFT 提取；依赖 E6 的 query 层 |
| **Later** | E8 | REQ-UX-5 | 题库管理；+ Deferred Gaps（GAP-024~027）|

**依赖关系**：E7 依赖 E6 的 scoring/query/；E8 可并行启动，但需 manifest schema 定稿。

### 9.2 Epic 明细

| Epic | 名称 | 包含 REQ | Deferred Gaps | 优先级 | 预估 |
|------|------|----------|---------------|--------|------|
| E6 | eval-ux-coach-and-query | REQ-UX-1, REQ-UX-2 | GAP-024（可选） | P0 | 3-5d |
| E7 | eval-ux-dashboard-and-sft | REQ-UX-3, REQ-UX-4 | GAP-027（可选） | P1 | 3-5d |
| E8 | eval-question-bank | REQ-UX-5 | GAP-026（后续） | P2 | 5-8d |

**MVP 最小路径**：仅实施 REQ-UX-1（Coach Command）即可解决最大痛点——新建 `commands/bmad-coach.md`，Command 内嵌入「自动扫描最新数据 → 调用 coachDiagnose → 输出报告」指令。

---

## 10. 与现有架构的关系

```
已实现（底层引擎）                    本次补齐（用户入口）
─────────────────                    ────────────────────
scoring/orchestrator  ──────────→   commands/bmad-coach.md
scoring/coach/diagnose.ts ──────→   commands/bmad-scores.md
scoring/analytics/ ─────────────→   commands/bmad-sft-extract.md
scoring/veto/ ──────────────────→   commands/bmad-dashboard.md
scoring/writer/ ────────────────→   scoring/query/ (新增索引层)
                                    scoring/dashboard/ (新增仪表盘)
                                    scoring/eval-questions/ (新增题库)
                                    skills/bmad-eval-analytics/ (新增 Skill)
```

---

## 11. 依赖关系

| 依赖项 | 说明 |
|--------|------|
| scoring/coach | coachDiagnose 等现有诊断逻辑 |
| scoring/writer、scoring/orchestrator | 现有 scoring 数据写入与存储 |
| scoring/constants/weights.ts | PHASE_WEIGHTS 用于仪表盘加权 |
| commands/、.cursor/commands/ | Command 部署与同步 |
| _bmad-output | dashboard.md 等输出目录 |

---

## 12. PRD 需求 → Epic/Story 映射

| PRD 需求范围 | 映射 Epic |
|--------------|-----------|
| REQ-UX-1.1 ~ REQ-UX-1.7 | E6 |
| REQ-UX-2.1 ~ REQ-UX-2.6 | E6 |
| REQ-UX-3.1 ~ REQ-UX-3.7 | E7 |
| REQ-UX-4.1 ~ REQ-UX-4.7 | E7 |
| REQ-UX-5.1 ~ REQ-UX-5.9 | E8 |
| GAP-024 | E6 或后续 Story |
| GAP-025 | 后续迭代 |
| GAP-026 | E8 后续增强 |
| GAP-027 | E7 或后续 Story |

---

*本文档由 REQUIREMENTS_用户体验层最后一公里_Coach入口与评测仪表盘_需求分析_Refined.md 及 Party-Mode 辩论产出 100% 映射产出；并经 PM Skills（prd-development、problem-statement、proto-persona、user-story、press-release、prioritization-advisor、roadmap-planning）改写完善。*
