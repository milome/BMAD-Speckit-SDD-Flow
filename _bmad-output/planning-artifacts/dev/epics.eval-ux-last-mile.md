---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/dev/prd.eval-ux-last-mile.md
# DEPRECATED: E6–E8 已合并进 epics.md，本文件仅供历史参考。下游工具仅读 epics.md。
---

# 用户体验层「最后一公里」— Epics 与 Stories

> **已废弃**：E6–E8 已合并进 `epics.md`。请使用 `_bmad-output/planning-artifacts/dev/epics.md` 作为唯一 epics 来源。

**来源**：prd.eval-ux-last-mile.md  
**格式**：PM skills/user-story（As a / I want / so that + Gherkin Given/When/Then）

---

## 1. Requirements Inventory

### 1.1 Functional Requirements

| ID | 描述 |
|----|------|
| FR1 | 用户运行 `/bmad-coach` 无需参数即可触发 AI Coach 诊断 |
| FR2 | 系统自动扫描 scoring/data/ 下 .json 和 scores.jsonl，按 timestamp 取最新 N 条（默认 100） |
| FR3 | 空目录时返回「暂无评分数据，请先完成至少一轮 Dev Story」 |
| FR4 | `/bmad-coach --epic 3` 仅诊断 Epic 3 相关数据 |
| FR5 | `/bmad-coach --story 3.3` 仅诊断 Story 3.3（解析 epicId=3, storyId=3） |
| FR6 | Skill bmad-eval-analytics 支持自然语言触发，复用 discoverLatestRunIds |
| FR7 | scoring/query/ 提供 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario |
| FR8 | epic_id/story_id 从 run_id 约定或 source_path 提取；无约定时明确反馈 |
| FR9 | 同 run_id+stage 取 timestamp 最新一条去重 |
| FR10 | `/bmad-scores` 显示全部摘要；`--epic 3`、`--story 3.3` 支持筛选 |
| FR11 | 仪表盘含项目健康度总分、四维雷达图、短板 Top 3、Veto 统计、趋势 |
| FR12 | 仪表盘无数据时输出与 Coach 一致提示 |
| FR13 | `/bmad-dashboard` 输出到 _bmad-output/dashboard.md 且在对话中展示 |
| FR14 | `/bmad-sft-extract` 无参数即可运行；phase_score 阈值默认 60 可配置 |
| FR15 | SFT 提取：git diff 失败时 fallback 为 instruction-only；输出摘要含跳过原因 |
| FR16 | SFT 支持 `--output <path>`；按 source_run_id+base_commit_hash+source_path 去重 |
| FR17 | 题库 manifest.yaml schema：questions: [{ id, title, path, difficulty?, tags[] }] |
| FR18 | `/bmad-eval-questions list` 返回题目清单 |
| FR19 | `/bmad-eval-questions add --title "xxx"` 生成 q00X-{slug}.md 模板 |
| FR20 | `/bmad-eval-questions run --id q001 --version v1` 加载题目→评审→写入时注入 scenario=eval_question、question_version |
| FR21 | run_id 含 version（如 eval-q001-v1-{timestamp}）；question_version 在 eval_question 时必填 |

### 1.2 Non-Functional Requirements

| ID | 描述 |
|----|------|
| NFR1 | 轻量化三原则：同机执行、可选启用、最小侵入 |
| NFR2 | 数据隔离：eval_question 与 real_dev 严格分离 |
| NFR3 | 向后兼容：不修改 scores.jsonl schema，查询层仅读 |
| NFR4 | 无外部依赖：仪表盘和查询均在本地完成 |

### 1.3 FR Coverage Map

| FR | Epic | 描述 |
|----|------|------|
| FR1–FR6 | E6 | Coach Command 与 Skill |
| FR7–FR10 | E6 | Query 层与 /bmad-scores |
| FR11–FR13 | E7 | 仪表盘 |
| FR14–FR16 | E7 | SFT 提取 |
| FR17–FR21 | E8 | 题库管理 |

---

## 2. Epic List

| ID | 名称 | 目标用户价值 | FR 覆盖 | 优先级 |
|----|------|--------------|---------|--------|
| E6 | eval-ux-coach-and-query | 开发者无需 run-id 即可获得 Coach 诊断与评分查询 | FR1–FR10 | P0 |
| E7 | eval-ux-dashboard-and-sft | 技术负责人与 AI 工程师获得仪表盘与 SFT 提取入口 | FR11–FR16 | P1 |
| E8 | eval-question-bank | 团队 Lead 可管理评测题库并执行题目 | FR17–FR21 | P2 |

---

## 3. Epic 6: eval-ux-coach-and-query

**Epic 目标**：使开发者与技术负责人无需了解 run-id 即可通过 Command 获取 Coach 诊断与评分汇总。

### Story 6.1: Coach Command 无参数运行

**Summary:** 零参数 Coach 诊断，让开发者无需 run-id 即可获得短板报告

**As a** 日常开发者（Dev）  
**I want to** 运行 `/bmad-coach` 而不提供任何参数  
**so that** 我能立刻看到最近一轮的 Coach 诊断报告

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 有数据时输出诊断 | scoring/data/ 下有至少一条评分记录 | 用户运行 `/bmad-coach` | 输出包含 phase_scores、weak_areas、recommendations 的 Markdown 诊断报告 |
| AC-2 | 空目录时友好提示 | scoring/data/ 为空或无评分数据 | 用户运行 `/bmad-coach` | 返回结构化 Markdown 提示「暂无评分数据，请先完成至少一轮 Dev Story」 |
| AC-3 | 数据量限制 | scoring/data/ 中记录超过 N（默认 100） | 用户运行 `/bmad-coach` | 仅取最新 N 条，必要时提示「仅展示最近 N 条」 |

---

### Story 6.2: Coach 按 Epic/Story 筛选

**Summary:** 支持按 Epic 或 Story 筛选 Coach 诊断数据

**As a** 日常开发者  
**I want to** 运行 `/bmad-coach --epic 3` 或 `/bmad-coach --story 3.3`  
**so that** 我只看到指定 Epic/Story 的短板诊断，不被其他数据干扰

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | Epic 筛选 | 存在符合 run_id 约定或含 metadata 的 Epic 3 记录 | 用户运行 `/bmad-coach --epic 3` | 仅诊断 Epic 3 相关数据 |
| AC-2 | Story 筛选 | 存在 Story 3.3 的记录 | 用户运行 `/bmad-coach --story 3.3` | 仅诊断 Story 3.3（解析为 epicId=3, storyId=3） |
| AC-3 | 无约定数据 | 记录无 epic_id/story_id 可解析 | 用户运行 `--epic` 或 `--story` | 调用方得到明确反馈（无可筛选数据） |

---

### Story 6.3: 评分查询层（scoring/query/）

**Summary:** 实现评分数据索引层，支持按 Epic/Story/Stage/Scenario 查询

**As a** 系统（Command 与 Coach 的底层）  
**I want to** 通过 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario 获取评分记录  
**so that** Coach 与 Scores Command 可以按条件筛选数据

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 按 Story 查询 | 存在 Story 3.3 的评分记录（符合 run_id 约定） | 调用 queryByStory(3, 3) | 返回 Story 3.3 的所有评分记录 |
| AC-2 | 去重 | 同 run_id+stage 存在多条记录 | 调用任一 query 方法 | 同 run_id+stage 仅返回 timestamp 最新一条 |
| AC-3 | 数据源 | scoring/data/*.json 与 scores.jsonl 存在 | 调用 queryLatest(10) | 返回按 timestamp 排序的最新 10 条 |
| AC-4 | Epic/Story 仅 real_dev | 记录含 scenario 字段 | Epic/Story 筛选 | 仅针对 real_dev；eval_question 数据隔离 |

---

### Story 6.4: Scores Command

**Summary:** 用户通过 /bmad-scores 查看评分汇总

**As a** 技术负责人（TechLead）  
**I want to** 运行 `/bmad-scores` 或 `/bmad-scores --epic 3` 或 `/bmad-scores --story 3.3`  
**so that** 我能以表格格式查看全部或指定范围的评分汇总

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 全部摘要 | 存在评分数据 | 用户运行 `/bmad-scores` | 输出表格格式的评分汇总 |
| AC-2 | Epic 汇总 | 存在 Epic 3 数据 | 用户运行 `/bmad-scores --epic 3` | 显示 Epic 3 各 Story 评分 |
| AC-3 | Story 明细 | 存在 Story 3.3 数据 | 用户运行 `/bmad-scores --story 3.3` | 显示 Story 3.3 各阶段评分明细 |

---

### Story 6.5: bmad-eval-analytics Skill 扩展

**Summary:** 用户通过自然语言触发 Coach 诊断

**As a** 日常开发者  
**I want to** 在 Cursor 中说「帮我看看短板」或「最近一轮的 Coach 报告」  
**so that** 无需记住 Command 名称即可获得诊断

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 自然语言触发 | bmad-eval-analytics Skill 已加载 | 用户说「帮我看看短板」 | Skill 调用 Coach 逻辑并输出诊断报告 |
| AC-2 | 最近一轮 | 存在多条评分记录 | 用户说「最近一轮的 Coach 报告」 | 以 timestamp 最近为准，输出对应诊断 |
| AC-3 | 共用逻辑 | — | Skill 被触发 | 复用 Command 的 discoverLatestRunIds 等共享逻辑 |

---

## 4. Epic 7: eval-ux-dashboard-and-sft

**Epic 目标**：使技术负责人获得一页仪表盘，AI 研发效能工程师获得 SFT 提取 Command 入口。

### Story 7.1: 仪表盘生成器

**Summary:** 生成包含总分、四维、短板、Veto、趋势的一页仪表盘

**As a** 技术负责人（TechLead）  
**I want to** 运行 `/bmad-dashboard`  
**so that** 我能看到「项目 78 分，短板在测试覆盖」这类一句话结论

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 有数据时 | 存在评分记录 | 仪表盘生成 | 输出含项目健康度总分（PHASE_WEIGHTS 加权）、四维雷达图、短板 Top 3、Veto 触发统计、趋势（最近 5 run 升/降/持平） |
| AC-2 | 无数据时 | 无评分数据 | 仪表盘生成 | 输出「暂无数据，请先完成至少一轮 Dev Story」，写入 _bmad-output/dashboard.md |
| AC-3 | 无 dimension_scores | 部分 record 无 dimension_scores | 四维计算 | 该维度显示「无数据」 |
| AC-4 | 输出路径 | — | 用户运行 `/bmad-dashboard` | 输出到 _bmad-output/dashboard.md 且在对话中展示 |

---

### Story 7.2: SFT 提取 Command

**Summary:** 用户通过 /bmad-sft-extract 一键提取微调数据集

**As a** AI 研发效能工程师（AIEng）  
**I want to** 运行 `/bmad-sft-extract` 而不提供 run-id 或复杂参数  
**so that** 我能获得 sft-dataset.jsonl，用于模型 SFT 微调

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 无参数运行 | 存在 phase_score≤60 的记录 | 用户运行 `/bmad-sft-extract` | 输出到 scoring/data/sft-dataset.jsonl（或 --output 指定路径） |
| AC-2 | 阈值可配置 | — | 通过 env 或 CLI 参数设置阈值 | 使用该阈值筛选 phase_score |
| AC-3 | git diff 失败 | 某记录 git diff 无法生成代码对 | 提取该记录 | fallback 为 instruction-only（§1+§4），SftEntry 含 has_code_pair: false |
| AC-4 | 输出摘要 | 提取完成 | — | 含「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」 |
| AC-5 | 去重 | 存在重复 source_run_id+base_commit_hash+source_path | 写入 JSONL | 仅保留一条 |
| AC-6 | JSONL 格式 | — | 输出完成 | 每行含 instruction、input、output；has_code_pair: false 时 input/output 可为空 |

---

### Story 7.3: SFT 纳入 bmad-eval-analytics Skill

**Summary:** 用户通过自然语言触发 SFT 提取

**As a** AI 研发效能工程师  
**I want to** 在 Cursor 中说「提取微调数据集」或「生成 SFT 训练数据」  
**so that** 无需记住 Command 即可触发提取

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 自然语言触发 | bmad-eval-analytics Skill 已加载 | 用户说「提取微调数据集」 | Skill 调用 SFT 提取逻辑并输出摘要 |

---

## 5. Epic 8: eval-question-bank

**Epic 目标**：使团队 Lead 可维护评测题库，执行题目并写入隔离的评分数据。

### Story 8.1: 题库目录结构与 manifest

**Summary:** 建立 scoring/eval-questions/v1/ 目录与 manifest.yaml schema

**As a** 团队 Lead（TeamLead）  
**I want to** 在 scoring/eval-questions/ 下建立版本化目录（v1、v2）及 manifest.yaml  
**so that** 题目有统一的结构与清单定义

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | manifest schema | — | manifest.yaml 存在 | 含 questions: [{ id, title, path, difficulty?, tags[] }] |
| AC-2 | 版本隔离 | v1 与 v2 目录存在 | 查询题目 | v1 与 v2 的题目清单独立 |

---

### Story 8.2: 题库 list 与 add 命令

**Summary:** 用户可列出题目并添加新题（模板）

**As a** 团队 Lead  
**I want to** 运行 `/bmad-eval-questions list` 和 `/bmad-eval-questions add --title "xxx"`  
**so that** 我能查看当前题目并快速创建新题模板

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | list | v1 下有题目 | 用户运行 `/bmad-eval-questions list` | 返回题目清单 |
| AC-2 | add | 当前版本为 v1 | 用户运行 `/bmad-eval-questions add --title "refactor-scoring"` | 生成 q00X-refactor-scoring.md 模板到 v1 目录 |

---

### Story 8.3: 题库 run 命令与 eval_question 集成

**Summary:** 用户执行题目评测，评分写入时注入 scenario 与 question_version

**As a** 团队 Lead  
**I want to** 运行 `/bmad-eval-questions run --id q001 --version v1`  
**so that** 题目被执行，评分写入时自动标记 scenario=eval_question、question_version=v1，实现 v1/v2 隔离

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | run 成功 | q001 存在于 v1 | 用户运行 run --id q001 --version v1 | 加载题目→调用评审/Skill→写入评分时注入 scenario=eval_question、question_version=v1 |
| AC-2 | run_id 含 version | — | 写入评分 | run_id 含 version，如 eval-q001-v1-{timestamp} |
| AC-3 | question_version 校验 | scenario=eval_question | 写入时 question_version 缺失 | throw 明确错误 |
| AC-4 | run 失败 | 题目文件不存在或解析失败 | 用户运行 run | 输出明确错误信息（文件不存在、解析失败等） |
| AC-5 | 版本隔离 | v1 与 v2 均有 q001 | 查询 v1 与 v2 的评分 | 数据不混淆 |

---

## 6. PRD 需求 → Story 映射

| PRD 需求 | Story |
|----------|-------|
| REQ-UX-1.1 ~ 1.7 | 6.1, 6.2, 6.5 |
| REQ-UX-2.1 ~ 2.6 | 6.3, 6.4 |
| REQ-UX-3.1 ~ 3.7 | 7.1 |
| REQ-UX-4.1 ~ 4.7 | 7.2, 7.3 |
| REQ-UX-5.1 ~ 5.9 | 8.1, 8.2, 8.3 |

---

## 7. Deferred Gaps Roadmap（后续 Story 追踪）

| Gap ID | 描述 | 影响 | 归属 | 状态 |
|--------|------|------|------|------|
| GAP-024 | 组合 queryByFilters API | 复杂筛选需调用方多次 query+filter | E6 后续 Story 或 E7 前 | 待排期 |
| GAP-025 | 多 worktree 聚合扫描 | 多 worktree 用户需手动指定 dataPath | 后续迭代 | 待排期 |
| GAP-026 | 交互式 add 引导 | add 首版仅生成模板，无向导式创建 | E8 后续增强 | 待排期 |
| GAP-027 | SFT instruction max_instruction_tokens | 超长 instruction 可能影响 fine-tune | E7 可选配置，后续实现 | 待排期 |

**纳入 Epic 时**：在对应 Epic 的 Story 列表或 Backlog 中显式引用本表 Gap ID，避免遗漏。

---

*本文档由 prd.eval-ux-last-mile.md 100% 映射产出；Story 采用 PM skills/user-story 格式（As a / I want / so that + Gherkin Given/When/Then）。*
