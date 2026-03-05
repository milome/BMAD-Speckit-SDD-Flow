# 需求分析：用户体验层「最后一公里」— Coach 入口、评测仪表盘与 SFT 管理

**来源**：BMAD-Speckit-SDD-Flow 实际使用中发现的 UX 缺口讨论  
**日期**：2026-03-06  
**状态**：待 Party-Mode 辩论  
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
  1. 扫描 `scoring/data/` 目录下所有 `.json` 和 `.jsonl` 文件
  2. 按时间戳排序，取最新的 N 条记录（默认 N=全部）
  3. 自动调用 `coachDiagnose` 并输出 Markdown 格式诊断报告
- 支持可选参数：
  - `/bmad-coach`：诊断全部最新数据
  - `/bmad-coach --epic 3`：仅诊断 Epic 3 相关数据
  - `/bmad-coach --story 3.3`：仅诊断 Story 3.3

**3.1.2 新建或扩展 Skill `bmad-eval-analytics`**
- 让用户可以用自然语言触发：
  - "帮我看看哪些地方做得不好"
  - "最近一轮的 Coach 报告"
  - "Story 3.3 的评分怎么样"
- Skill 内部自动定位数据、调用 coach、格式化输出

**验收标准**：
- AC-1：用户运行 `/bmad-coach` 无需提供任何参数即可看到诊断报告
- AC-2：诊断报告包含 `phase_scores`、`weak_areas`、`recommendations`
- AC-3：支持按 Epic/Story 筛选

---

### REQ-UX-2：按 Epic/Story 查询评分（索引能力）

**优先级**：P0

**3.2.1 评分数据索引层**
- 在 `scoring/` 下新增查询模块（如 `scoring/query/`），提供：
  - `queryByEpic(epicId: number): ScoreRecord[]`
  - `queryByStory(epicId: number, storyId: number): ScoreRecord[]`
  - `queryLatest(n?: number): ScoreRecord[]`
  - `queryByStage(stage: string): ScoreRecord[]`
  - `queryByScenario(scenario: 'real_dev' | 'eval_question'): ScoreRecord[]`
- 从 `scoring/data/*.json` 和 `scores.jsonl` 中读取并解析

**3.2.2 Command `/bmad-scores`**
- `/bmad-scores`：显示全部评分摘要
- `/bmad-scores --epic 3`：Epic 3 的各 Story 评分
- `/bmad-scores --story 3.3`：Story 3.3 的各阶段评分明细

**验收标准**：
- AC-4：`queryByStory(3, 3)` 返回 Story 3.3 的所有评分记录
- AC-5：`/bmad-scores` 输出表格格式的评分汇总

---

### REQ-UX-3：全局仪表盘（一页汇总）

**优先级**：P1

**3.3.1 仪表盘生成器**
- 新增 `scoring/dashboard/` 模块，输出包含：
  - **项目健康度总分**：所有 Story 加权平均分（如 78/100）
  - **四维雷达图数据**：功能性、代码质量、测试覆盖、安全性各维度平均分
  - **短板 Top 3**：得分最低的 3 个阶段/Story
  - **Veto 触发统计**：各类一票否决项触发次数
  - **趋势**：最近 5 次 run 的得分变化（升/降/持平）
- 输出格式：Markdown（可在 Cursor 中直接渲染）

**3.3.2 Command `/bmad-dashboard`**
- 用户运行 `/bmad-dashboard` 即可看到一页仪表盘
- 仪表盘输出到 `_bmad-output/dashboard.md`，同时在对话中展示

**验收标准**：
- AC-6：仪表盘包含总分、四维得分、短板 Top 3、Veto 统计
- AC-7：无评分数据时优雅提示"暂无数据，请先完成至少一轮 Dev Story"

---

### REQ-UX-4：SFT 提取 Skill/Command（微调数据管理）

**优先级**：P1

**3.4.1 Command `/bmad-sft-extract`**
- 用户运行 `/bmad-sft-extract` 即可从评分数据中提取微调数据集
- 系统自动：
  1. 扫描 `scoring/data/` 中 `phase_score ≤ 60` 的记录
  2. 从对应 BUGFIX 文档提取 §1（问题）和 §4（修复方案）
  3. 通过 `git diff` 生成 bad/good 代码对
  4. 输出到 `scoring/data/sft-dataset.jsonl`
- 输出摘要：共提取 N 条训练样本，覆盖 M 个 Story

**3.4.2 纳入 `bmad-eval-analytics` Skill**
- 用户可说"提取微调数据集"或"生成 SFT 训练数据"触发

**验收标准**：
- AC-8：`/bmad-sft-extract` 无参数即可运行
- AC-9：输出文件为合法的 JSONL，每行含 `instruction`、`input`、`output`

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
  │   └── manifest.yaml          # 题目清单、难度、标签
  └── v2/
      └── ...
  ```

**3.5.2 Command `/bmad-eval-questions`**
- `/bmad-eval-questions list`：列出当前版本所有题目
- `/bmad-eval-questions add --title "xxx"`：引导创建新题目
- `/bmad-eval-questions run --id q001 --version v1`：执行指定题目的评测

**3.5.3 与 `eval_question` 场景集成**
- 题目执行时自动设置 `scenario=eval_question`、`question_version=v1`
- 评分写入时强制校验 `question_version` 存在

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
