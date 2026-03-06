# Story 7.4：Coach discovery 仅 real_dev

Status: ready-for-dev

**Epic**：7 eval-ux-dashboard-and-sft  
**Story**：7.4  
**Slug**：coach-discovery-real-dev-only  
**来源**：epics.md §Epic 7、用户需求（discovery 误选 eval_question sample）

---

## 1. 需求追溯

| PRD/需求 | 描述 | 本 Story 覆盖 |
|----------|------|---------------|
| 用户反馈 | 无参 `/bmad-coach` 误选 eval-question-sample，希望仅诊断 real_dev | 是 |
| REQ-UX NFR2 | 数据隔离：eval_question 与 real_dev 严格分离 | 是 |

---

## 2. Story

**As a** 日常开发者（Dev）  
**I want to** 运行 `/bmad-coach` 时默认仅诊断 real_dev 的 run  
**so that** eval_question 等 sample 不会被误选为「最新一轮」，诊断结果反映真实 Dev Story 产出

---

## 3. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 默认仅 real_dev | 存在 real_dev 与 eval_question 评分记录 | 用户运行 `/bmad-coach` 无参 | discovery 只考虑 scenario=real_dev，返回最新 real_dev run_id |
| AC-2 | 显式指定 scenario | 存在多种 scenario 记录 | 用户运行 `--scenario eval_question` 或 `--scenario real_dev` | 仅诊断指定 scenario 的记录 |
| AC-3 | 无 real_dev 数据 | 仅有 eval_question 记录 | 用户运行 `/bmad-coach` 默认 | 返回「暂无 real_dev 评分数据，请先完成至少一轮 Dev Story」 |
| AC-4 | 向后兼容 | — | 用户显式 `--run-id=xxx` | 跳过 discovery，直接诊断指定 run_id（不校验 scenario） |

---

## 4. Scope

### 4.1 本 Story 实现范围

1. **`scoring/coach/discovery.ts`**  
   - `discoverLatestRunId(dataPath, limit?, scenarioFilter?)` 增加可省略参数 `scenarioFilter: 'real_dev' | 'eval_question' | undefined`（省略时不过滤）
   - `undefined` 表示不过滤（向后兼容）；`'real_dev'` 时仅考虑 `scenario=real_dev` 的记录；`'eval_question'` 同理

2. **`scripts/coach-diagnose.ts`**  
   - 新增 `--scenario real_dev|eval_question|all` 参数，默认 `real_dev`  
   - 无 `--run-id` 时：调用 `discoverLatestRunId(dataPath, limit, scenarioFilter)`，默认传入 `'real_dev'`  
   - `--scenario all` 时传入 `undefined`（与当前行为一致）  
   - AC-3：默认 scenario 下无 real_dev 记录时，输出「暂无 real_dev 评分数据，请先完成至少一轮 Dev Story」

3. **`commands/bmad-coach.md`**  
   - 补充 `--scenario real_dev|eval_question|all` 说明：默认 real_dev；all 表示不过滤 scenario

4. **`skills/bmad-eval-analytics/SKILL.md`**  
   - Coach 执行指引中注明：默认 `coach-diagnose` 仅诊断 real_dev；用户若需 eval_question 需显式 `--scenario eval_question`

### 4.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 仪表盘数据 scenario 过滤 | Story 7.1 | 7.1 已交付，其仪表盘（scripts/dashboard-generate.ts）已仅使用 real_dev 记录；本 Story 不修改 7.1 |
| SFT 提取 Command | Story 7.2 | 归属 Epic 7 |
| SFT 纳入 bmad-eval-analytics Skill（自然语言触发 SFT） | Story 7.3 | 归属 Epic 7 |
| 评分查询层 queryByScenario 扩展 | Story 6.3 | scoring/query 已有 queryByScenario；本 Story 仅改 discovery 与 Coach 入口，复用现有 query 能力 |

---

## 5. Tasks / Subtasks

- [ ] **Task 1**（AC-1、AC-2、AC-3）：扩展 discovery 与 coach-diagnose
  - [ ] T1.1 在 `scoring/coach/discovery.ts` 中为 `discoverLatestRunId` 增加可省略参数 `scenarioFilter`（省略时不过滤）；过滤逻辑：`scenarioFilter` 为 `'real_dev'` 或 `'eval_question'` 时，仅保留 `r.scenario === scenarioFilter` 的记录后再按 timestamp 取最新
  - [ ] T1.2 在 `scripts/coach-diagnose.ts` 中解析 `--scenario`，默认 `real_dev`；无 `--run-id` 时传 `scenarioFilter` 给 `discoverLatestRunId`；AC-3：默认 scenario 且无匹配记录时输出「暂无 real_dev 评分数据，请先完成至少一轮 Dev Story」
  - [ ] T1.3 新增 `scoring/coach/__tests__/discovery.test.ts` 用例：scenarioFilter 为 real_dev 时仅返回 real_dev 最新 run_id；为 eval_question 时同理；无 filter 时与当前行为一致

- [ ] **Task 2**（AC-4）：保持 --run-id  backward compatibility
  - [ ] T2.1 当 `--run-id` 或 `RUN_ID` 已指定时，不调用 discovery，直接 `coachDiagnose(runId)`，不校验 scenario（与当前行为一致）

- [ ] **Task 3**（AC-1、AC-2）：更新 Command 与 Skill 文档
  - [ ] T3.1 在 `commands/bmad-coach.md` 的 CLI 参数说明中补充 `--scenario real_dev|eval_question|all`，说明默认 real_dev
  - [ ] T3.2 在 `skills/bmad-eval-analytics/SKILL.md` Coach 执行指引中注明默认仅 real_dev，eval_question 需显式 `--scenario eval_question`

---

## 6. Dev Notes

### 6.1 技术依赖与路径

| 依赖 | 路径/来源 | 说明 |
|------|-----------|------|
| discovery | `scoring/coach/discovery.ts` | `discoverLatestRunId(dataPath, limit)` 当前无 scenario 过滤；扩展后增加 `scenarioFilter?` |
| coach-diagnose | `scripts/coach-diagnose.ts` | 无 `--run-id` 时 L144 调用 `discoverLatestRunId`；需传入 scenario |
| query 层 | `scoring/query/index.ts` | `queryByScenario` 已存在；`queryByEpic`、`queryByStory` 已仅 real_dev；本 Story 不改 query |
| 记录类型 | `scoring/writer/types.ts` | `RunScoreRecord.scenario: 'real_dev' | 'eval_question'` |
| 仪表盘 | `scripts/dashboard-generate.ts` | 已内联过滤 `r.scenario !== 'eval_question'`；与本 Story 目标一致，不修改 |

### 6.2 与 Story 7.1 的 aligned 行为

Story 7.1 仪表盘生成器已仅使用 real_dev 数据（见 7-1-dashboard-generator.md §3.1 数据源、scripts/dashboard-generate.ts L31）。本 Story 使 Coach discovery 与仪表盘行为一致：默认仅 real_dev。

### 6.3 与 --epic / --story 的关系

当用户指定 `--epic` 或 `--story` 时，coach-diagnose 使用 `queryByEpic` / `queryByStory`，两者已仅返回 real_dev（query/index.ts filterRealDev）。本 Story 的 scenario 过滤主要影响无 epic/story 时的 discovery 路径。

---

## 7. 禁止词表合规声明

本 Story 文档已避免使用禁止词表所列全部词汇（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。所有范围界定均采用明确归属（由 Story X.Y 负责）。

---

## 8. References

- [Source: _bmad-output/planning-artifacts/dev/epics.md] Epic 7 §Story 7.4
- [Source: scoring/coach/discovery.ts] discoverLatestRunId 当前实现
- [Source: scripts/coach-diagnose.ts] 无 run-id 时 discovery 调用
- [Source: _bmad-output/implementation-artifacts/epic-7-eval-ux-dashboard-and-sft/story-7-1-dashboard-generator/7-1-dashboard-generator.md] 7.1 数据源仅 real_dev

---

## 9. Dev Agent Record

### Agent Model Used

—

### Completion Notes List

—

### File List
