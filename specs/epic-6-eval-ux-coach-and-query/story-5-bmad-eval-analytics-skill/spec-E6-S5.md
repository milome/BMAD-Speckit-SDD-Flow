# Spec E6-S5：bmad-eval-analytics Skill

*Story 6.5 技术规格*  
*Epic E6 eval-ux-coach-and-query*

---

## 1. 概述

本 spec 将 Story 6.5 的实现范围固化为可执行技术规格，覆盖 `bmad-eval-analytics` Skill 的新建、自然语言触发短语映射、以及复用 `discoverLatestRunId` 与 `coachDiagnose` 的说明。

**输入来源**：
- `_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-5-bmad-eval-analytics-skill/6-5-bmad-eval-analytics-skill.md`
- `prd.eval-ux-last-mile.md` §5.1（REQ-UX-1.7）
- `scripts/coach-diagnose.ts`（与 /bmad-coach Command 共用逻辑）
- `scoring/coach/discovery.ts`、`scoring/coach/diagnose.ts`

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story §1 REQ-UX-1.7 | 新建或扩展 Skill bmad-eval-analytics，用户可用自然语言触发 | spec §3.1, §3.2 | ✅ |
| Story §1 REQ-UX-1.7 | Skill 复用 discoverLatestRunId 等共享逻辑 | spec §3.3, §3.4 | ✅ |
| Story §1 REQ-UX-1.7 | 「最近一轮」以 timestamp 最近为准 | spec §3.3 | ✅ |
| Story §1 REQ-UX-4.7 | 纳入 bmad-eval-analytics Skill（SFT 归属 7.3） | spec §4 非本 Story | ✅ |
| Story §3.1(1) | 新建或扩展 Skill，支持自然语言触发 | spec §3.1, §3.2 | ✅ |
| Story §3.1(2) | 复用 discoverLatestRunId 与 coachDiagnose 调用 | spec §3.3, §3.4 | ✅ |
| Story §3.1(3) | timestamp 最近为准 | spec §3.3 | ✅ |
| Story §3.1(4) | 触发短语示例 | spec §3.2 | ✅ |
| Story §4 AC-1 | 自然语言触发 → 输出诊断 | spec §3.2, §3.5 | ✅ |
| Story §4 AC-2 | 最近一轮以 timestamp 为准 | spec §3.3, §3.5 | ✅ |
| Story §4 AC-3 | 共用逻辑，无重复实现 | spec §3.4, §3.5 | ✅ |

---

## 3. 功能规格

### 3.1 Skill 产出物

| 项目 | 规格 |
|------|------|
| Skill 文档 | `skills/bmad-eval-analytics/SKILL.md`（新建） |
| 触发配置 | 自然语言短语 → 执行 Coach 诊断的映射或规则，在 SKILL.md 的 description / when to use 中定义 |

### 3.2 自然语言触发短语映射

| 用户短语 | Agent 行为 |
|----------|------------|
| 「帮我看看短板」 | 识别为 bmad-eval-analytics 触发，执行 Coach 诊断 |
| 「最近一轮的 Coach 报告」 | 同上 |
| 「诊断一下」「看看评分短板」 | 可扩展等价短语，以 Skill 配置或文档为准 |

**实现方式**：Skill 的 `description` 与 `when to use` 须明确列出上述短语；Cursor 加载该 Skill 后，Agent 在用户说出这些短语时，应执行 `npx ts-node scripts/coach-diagnose.ts` 获取 Coach 诊断输出。

### 3.3 复用 discoverLatestRunId

- **来源**：`scoring/coach/discovery.ts` 导出的 `discoverLatestRunId`（单数，非 discoverLatestRunIds）。
- **行为**：按 `getScoringDataPath()` 下评分文件的 timestamp 取最新 run_id；与 Story 6.1 的 Command 共享 discovery 逻辑。
- **调用路径**：Skill 不直接 import discovery；通过执行 `scripts/coach-diagnose.ts` 间接复用。coach-diagnose 无 `--run-id` 时内部调用 `discoverLatestRunId`，故「最近一轮」以 timestamp 最近为准由脚本保证。

### 3.4 复用 coachDiagnose

- **来源**：`scripts/coach-diagnose.ts` 作为 CLI 入口，内部调用 `scoring/coach` 的 `coachDiagnose`。
- **行为**：Skill 指引 Agent 执行 `npx ts-node scripts/coach-diagnose.ts`，与 `/bmad-coach` Command 共用该脚本，无重复实现 discovery 或 coach 逻辑。

### 3.5 验收行为

| 场景 | 用户输入 | 预期 |
|------|----------|------|
| AC-1 | 「帮我看看短板」 | Skill 触发后，Agent 执行 `npx ts-node scripts/coach-diagnose.ts`，输出 Coach 诊断报告（Markdown 或 JSON） |
| AC-2 | 「最近一轮的 Coach 报告」 | 同上；coach-diagnose 内部以 timestamp 最近为准输出对应 run 的诊断 |
| AC-3 | 任意上述短语 | 复用 Command 的 discoverLatestRunId 与 coachDiagnose，无独立 discovery/coach 实现 |

---

## 4. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| SFT 提取自然语言触发（「提取微调数据集」） | Story 7.3 | 归属 Epic 7 |
| `/bmad-coach --epic/--story` 按 Epic/Story 筛选 | Story 6.2 | 6.5 首版可仅支持「全部/最近一轮」 |

---

## 5. 产出物路径与验收命令

| 产出 | 路径 |
|------|------|
| Skill 文档 | `skills/bmad-eval-analytics/SKILL.md` |
| 验收命令 | `npx ts-node scripts/coach-diagnose.ts`（验证底层逻辑可执行） |
| 验收方式 | 在 Cursor 中说「帮我看看短板」或「最近一轮的 Coach 报告」，Agent 应执行 coach-diagnose 并输出诊断 |
