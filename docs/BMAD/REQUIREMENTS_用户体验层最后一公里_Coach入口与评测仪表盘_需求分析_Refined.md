# 需求分析：用户体验层「最后一公里」— Coach 入口、评测仪表盘与 SFT 管理（Refined）

**来源**：BMAD-Speckit-SDD-Flow 实际使用中发现的 UX 缺口讨论  
**日期**：2026-03-06  
**状态**：Party-Mode 100 轮辩论收敛后 Refined  
**关联**：Epic 4（AI Coach）、Epic 5（Analytics）、评分体系全链路

---

## 1. 问题陈述

当前系统在**底层引擎层面已完整实现**——parser、veto、coach、analytics、SFT extractor 等模块均可运行。但在**用户体验层面存在严重断裂**：

| 底层能力 | 当前用户入口 | 问题 |
|----------|-------------|------|
| AI Coach 诊断 | CLI：`npx ts-node scripts/coach-diagnose.ts --run-id <id>` | 用户不知道 run-id 是什么 |
| 评分查询 | 无（需手动读 `scores.jsonl`） | 用户无法按 Epic/Story 查分 |
| 全局健康度 | 无 | 散落在 jsonl 中，无汇总视图 |
| SFT 微调数据提取 | CLI：`npx ts-node scripts/analytics-sft-extract.ts` | 无 Skill/Command，用户不知道这个命令存在 |
| 题库维护 | 无 | 仅有需求设计，无管理入口 |

**核心矛盾**：系统设计哲学是"通过 Skills 和 Commands 在 Cursor 中自然触发"，但上述功能全部依赖 CLI 或手动操作，违背了设计初衷。

---

## 2. 目标用户画像

| 用户类型 | 典型场景 | 期望交互 |
|----------|----------|----------|
| 开发者（日常） | 完成一轮 Dev Story 后想知道自己哪里做得不好 | 在 Cursor 中说"帮我看看短板"或运行 `/bmad-coach` |
| 技术负责人 | 想了解整个项目的代码质量健康度 | 看一份一页的仪表盘：总分、各维度得分、趋势 |
| AI 研发效能工程师 | 想提取微调数据集用于模型优化 | 在 Cursor 中说"提取微调数据"或运行 `/bmad-sft-extract` |
| 团队 Lead | 想维护和扩充评测题库 | 有一个管理入口可以增删改查题目 |

---

## 3. 需求清单

### REQ-UX-1：Coach Skill/Command（面向用户的诊断入口）

**优先级**：P0（最小可用改进）

**3.1.1 新建 Command `commands/bmad-coach.md`**

- 用户在 Cursor 中运行 `/bmad-coach` 即可触发 AI Coach 诊断
- **无需用户提供 run-id**，系统自动执行以下逻辑：
  1. 扫描 `scoring/data/` 目录（或 `getScoringDataPath()`）下所有 `.json`（排除非评分 schema 文件）和 `scores.jsonl`
  2. 按 timestamp 排序，取最新的 N 条记录（**默认 N=100**，可配置上限；超出时提示「仅展示最近 N 条」）
  3. 自动调用 `coachDiagnose` 并输出 Markdown 格式诊断报告
- **空目录行为**：当无任何评分数据时，返回结构化 Markdown 提示「暂无评分数据，请先完成至少一轮 Dev Story」，满足 AC-1
- **多 worktree**：首版以 `process.cwd()` 或 `getScoringDataPath()` 为根；多 worktree 聚合扫描为 Deferred
- 支持可选参数：
  - `/bmad-coach`：诊断全部最新数据
  - `/bmad-coach --epic 3`：仅诊断 Epic 3 相关数据（**仅对符合 run_id 约定或含 metadata 的 record 生效**）
  - `/bmad-coach --story 3.3`：仅诊断 Story 3.3（**解析规则**：`--story X.Y` → epicId=X, storyId=Y；`--epic X` → epicId=X）

**3.1.2 新建或扩展 Skill `bmad-eval-analytics`**

- 让用户可以用自然语言触发，Skill 复用 Command 的 `discoverLatestRunIds` 等共享逻辑
- 「最近一轮」以 timestamp 最近为准

**验收标准**：

- AC-1：用户运行 `/bmad-coach` 无需提供任何参数即可看到诊断报告
- AC-2：诊断报告包含 `phase_scores`、`weak_areas`、`recommendations`
- AC-3：支持按 Epic/Story 筛选

---

### REQ-UX-2：按 Epic/Story 查询评分（索引能力）

**优先级**：P0

**3.2.1 评分数据索引层**

- 在 `scoring/query/` 下提供：
  - `queryByEpic(epicId: number): ScoreRecord[]`
  - `queryByStory(epicId: number, storyId: number): ScoreRecord[]`
  - `queryLatest(n?: number): ScoreRecord[]`
  - `queryByStage(stage: string): ScoreRecord[]`
  - `queryByScenario(scenario: 'real_dev' | 'eval_question'): ScoreRecord[]`
- **epic_id/story_id 解析规则**：RunScoreRecord 当前无此字段。从 run_id 约定（如 `{prefix}-e{epic}-s{story}`）或 source_path（`story-{epic}-{story}`）提取；历史数据无约定时，Epic/Story 筛选不可用，调用方应得到明确反馈
- **数据源**：从 `scoring/data/*.json`（仅评分 schema 文件）和 `scores.jsonl` 读取；**去重规则**：同 run_id+stage 取 timestamp 最新一条
- **Epic/Story 筛选仅针对 real_dev**；eval_question 数据隔离

**3.2.2 Command `/bmad-scores`**

- `/bmad-scores`：显示全部评分摘要
- `/bmad-scores --epic 3`：Epic 3 的各 Story 评分
- `/bmad-scores --story 3.3`：Story 3.3 的各阶段评分明细

**验收标准**：

- AC-4：`queryByStory(3, 3)` 返回 Story 3.3 的所有评分记录（对符合约定的数据）
- AC-5：`/bmad-scores` 输出表格格式的评分汇总

---

### REQ-UX-3：全局仪表盘（一页汇总）

**优先级**：P1

**3.3.1 仪表盘生成器**

- **项目健康度总分**：沿用 `scoring/constants/weights.ts` 的 PHASE_WEIGHTS 与 record 内 phase_weight 计算加权平均
- **四维雷达图**：从 dimension_scores 提取；若 record 无 dimension_scores，该维度显示「无数据」
- **短板 Top 3**：得分最低的 3 个阶段/Story
- **Veto 触发统计**：从 check_items 中 passed=false 且 item_id 在 veto 配置内的计数
- **趋势**：按 run_id 去重，取 timestamp 最近 5 个 run；比较最近一次 vs 前一次（或最近 vs 最前）的加权总分，输出升/降/持平
- **无数据时**：输出与 Coach 一致的提示「暂无数据，请先完成至少一轮 Dev Story」，并写入 `_bmad-output/dashboard.md`
- 输出格式：Markdown（可在 Cursor 中直接渲染）

**3.3.2 Command `/bmad-dashboard`**

- 用户运行 `/bmad-dashboard` 即可看到一页仪表盘
- 仪表盘输出到 `_bmad-output/dashboard.md`，同时在对话中展示

**验收标准**：

- AC-6：仪表盘包含总分、四维得分、短板 Top 3、Veto 统计
- AC-7：无评分数据时优雅提示「暂无数据，请先完成至少一轮 Dev Story」

---

### REQ-UX-4：SFT 提取 Skill/Command（微调数据管理）

**优先级**：P1

**3.4.1 Command `/bmad-sft-extract`**

- **phase_score 阈值**：默认 60，可通过 env 或 CLI 参数配置
- 系统自动：
  1. 扫描 `scoring/data/` 中 `phase_score ≤ 阈值` 的记录
  2. 从对应 BUGFIX 文档提取 §1（问题）和 §4（修复方案）
  3. 通过 `git diff` 生成 bad/good 代码对；**git diff 失败时 fallback**：可产出 instruction-only 样本（§1+§4），不含 input/output 代码对；SftEntry 增加 `has_code_pair: boolean`
  4. 输出到 `scoring/data/sft-dataset.jsonl`（或 `--output` 指定路径）
- **输出摘要**：共提取 N 条训练样本，覆盖 M 个 Story；**含「跳过 K 条（原因：git diff 失败 / 无 source_path / ...）」**
- **去重**：按 source_run_id + base_commit_hash + source_path 去重
- **输出路径**：支持 `--output <path>` 参数

**3.4.2 纳入 `bmad-eval-analytics` Skill**

- 用户可说"提取微调数据集"或"生成 SFT 训练数据"触发

**验收标准**：

- AC-8：`/bmad-sft-extract` 无参数即可运行
- AC-9：输出文件为合法的 JSONL，每行含 `instruction`、`input`、`output`（或 `has_code_pair: false` 时 input/output 为空）

---

### REQ-UX-5：题库管理框架（最小可行）

**优先级**：P2

**3.5.1 题库目录结构约定**

- 在 `scoring/eval-questions/` 下建立版本化目录：
  ```
  scoring/eval-questions/
  ├── v1/
  │   ├── q001-refactor-scoring.md
  │   ├── q002-bugfix-veto-logic.md
  │   └── manifest.yaml          # 题目清单
  └── v2/
      └── ...
  ```
- **manifest.yaml schema**：
  ```yaml
  questions:
    - id: string
      title: string
      path: string
      difficulty?: string
      tags?: string[]
  ```

**3.5.2 Command `/bmad-eval-questions`**

- `/bmad-eval-questions list`：列出当前版本所有题目
- `/bmad-eval-questions add --title "xxx"`：首版简化为生成 `q00X-{slug}.md` 模板到当前版本目录
- `/bmad-eval-questions run --id q001 --version v1`：加载题目→调用评审/Skill 流程→写入时注入 scenario=eval_question、question_version=v1；**run 失败时输出明确错误信息（文件不存在、解析失败等）**

**3.5.3 与 `eval_question` 场景集成**

- 题目执行时自动设置 `scenario=eval_question`、`question_version=v1`
- **run_id 约定**：含 version，如 `eval-q001-v1-{timestamp}`，实现 v1/v2 评分隔离
- 评分写入时 **question_version 必填**（scenario=eval_question 时），缺失则 throw
- **题目文档**：需与 parser 输入格式兼容，定义题目模板

**验收标准**：

- AC-10：`/bmad-eval-questions list` 返回题目清单
- AC-11：题库版本隔离，v1 和 v2 的评分数据不混淆

---

## 4. 与现有架构的关系

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

## 5. 实施建议

### 推荐 Epic 拆分

| Epic | 名称 | 包含 REQ | 优先级 | 预估 |
|------|------|----------|--------|------|
| E6 | eval-ux-coach-and-query | REQ-UX-1, REQ-UX-2 | P0 | 3-5d |
| E7 | eval-ux-dashboard-and-sft | REQ-UX-3, REQ-UX-4 | P1 | 3-5d |
| E8 | eval-question-bank | REQ-UX-5 | P2 | 5-8d |

### 最小可行路径（MVP）

若时间有限，**仅实施 REQ-UX-1（Coach Command）** 即可解决最大痛点：

1. 新建 `commands/bmad-coach.md`（1 个文件）
2. 在 Command 内嵌入"自动扫描最新数据 → 调用 coachDiagnose → 输出报告"的指令
3. 无需新增 TypeScript 代码，Command 可直接调度现有的 `scoring/coach/` 模块

---

## 6. 非功能性约束

| 约束 | 说明 |
|------|------|
| 轻量化三原则 | 同机执行、可选启用、最小侵入（沿用 Story 4.3 约定） |
| 数据隔离 | `eval_question` 与 `real_dev` 的评分数据严格分离 |
| 向后兼容 | 不修改现有 `scores.jsonl` 的 schema，查询层为只读 |
| 无外部依赖 | 仪表盘和查询均在本地完成，不依赖外部服务 |

---

## 7. Challenger Final Review

**Status**: conditional（有条件同意）

**Deferred Gaps**:

| Gap ID | 描述 | 影响 | 建议 |
|--------|------|------|------|
| GAP-024 | 组合 queryByFilters API | 复杂筛选需调用方多次 query+filter | 后续 Story 实现 |
| GAP-025 | 多 worktree 聚合扫描 | 多 worktree 用户需手动指定 dataPath | 后续迭代 |
| GAP-026 | 交互式 add 引导 | add 首版仅生成模板 | 后续增强 |
| GAP-027 | SFT instruction max_instruction_tokens | 超长 instruction 可能影响 fine-tune | 可选配置，后续实现 |

**Conditions**（实施前须满足）:

1. run_id 约定或 epic_id/story_id 元数据方案在 REQ-UX-2 实施前定稿
2. manifest.yaml schema 与题目模板在 REQ-UX-5 实施前定稿

---

## 8. 辩论收敛摘要

- **辩论轮次**：100 轮
- **批判性审计员占比**：62 轮（>60%）
- **收敛条件**：最后 3 轮（R98–R100）无新 gap
- **共识**：上述 Refined 需求 + Part B Gaps 解决表（见 `PARTY_MODE_100轮_REQUIREMENTS_用户体验层最后一公里_辩论产出.md`）
