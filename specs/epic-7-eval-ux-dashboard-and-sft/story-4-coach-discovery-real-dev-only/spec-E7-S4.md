# Spec E7-S4：Coach discovery 仅 real_dev

*Story 7.4 技术规格*  
*Epic E7 eval-ux-dashboard-and-sft*

---

## 1. 概述

本 spec 将 Story 7.4 的实现范围固化为可执行技术规格，为 discovery 与 Coach 增加 scenario 过滤能力，使无参 `/bmad-coach` 默认仅诊断 `scenario=real_dev` 的 run，排除 eval_question sample 误选。

**输入来源**：
- `epics.md` §Epic 7 Story 7.4
- `scoring/coach/discovery.ts`、`scripts/coach-diagnose.ts`
- `scoring/docs/RUN_ID_CONVENTION.md` §2.1 real_dev / §2.2 eval_question

---

## 2. 需求映射清单

| 原始需求 | spec 对应 | 覆盖 |
|----------|-----------|------|
| AC-1 默认仅 real_dev | §3.2 discoverLatestRunId scenario 过滤 | ✅ |
| AC-2 显式 `--scenario` | §3.3 CLI 参数 | ✅ |
| AC-3 无 real_dev 时友好提示 | §3.4 空数据行为 | ✅ |
| AC-4 `--run-id` 跳过 discovery | §3.5 向后兼容 | ✅ |

---

## 3. 功能规格

### 3.1 变更范围

| 组件 | 变更 |
|------|------|
| `scoring/coach/discovery.ts` | `discoverLatestRunId(dataPath, limit?, scenarioFilter?)` 新增可选 scenarioFilter |
| `scripts/coach-diagnose.ts` | 支持 `--scenario real_dev|eval_question|all`；无参时默认 `real_dev` |
| `commands/bmad-coach.md` | 文档补充 `--scenario` 参数说明 |
| bmad-eval-analytics Skill | 调用 discovery 时传入默认 scenario（若 Skill 触发无指定则用 real_dev） |

### 3.2 discoverLatestRunId 扩展

```ts
/**
 * @param scenarioFilter - 可选。'real_dev' | 'eval_question' | undefined
 *   - undefined 或 'all'：不过滤 scenario（向后兼容，或显式要求全部）
 *   - 'real_dev'：仅考虑 scenario=real_dev
 *   - 'eval_question'：仅考虑 scenario=eval_question
 */
function discoverLatestRunId(
  dataPath: string,
  limit?: number,
  scenarioFilter?: 'real_dev' | 'eval_question' | 'all'
): { runId: string; truncated: boolean } | null;
```

- 当 scenarioFilter 有值且非 'all' 时，`loadAllRecords` 后过滤 `records.filter(r => r.scenario === scenarioFilter)`
- 过滤后无记录 → 返回 `null`

### 3.3 CLI 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `--scenario real_dev` | 仅诊断 real_dev | 无参时默认 |
| `--scenario eval_question` | 仅诊断 eval_question | — |
| `--scenario all` | 不过滤 scenario（当前行为） | — |

- 无 `--scenario` 时使用 `real_dev`
- `--run-id` 存在时：跳过 discovery，不应用 scenario 过滤

### 3.4 空数据行为

| 条件 | 输出 |
|------|------|
| scenarioFilter=real_dev 且无 real_dev 记录 | 「暂无 real_dev 评分数据，请先完成至少一轮 Dev Story」 |
| scenarioFilter=eval_question 且无 eval_question 记录 | 「暂无 eval_question 评分数据」 |
| 其他（无任何记录） | 「暂无评分数据，请先完成至少一轮 Dev Story」（与现有一致） |

### 3.5 向后兼容

- `--run-id=xxx`：跳过 discovery，直接 `coachDiagnose(runId)`，不校验 scenario
- `--scenario all`：保留「全部 scenario 一起参与 discovery」的行为

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 默认仅 real_dev | 存在 real_dev 与 eval_question | `/bmad-coach` 无参 | 返回最新 real_dev run_id 的诊断 |
| AC-2 | 显式 scenario | 存在多种 scenario | `--scenario eval_question` | 仅诊断 eval_question |
| AC-3 | 无 real_dev | 仅有 eval_question | `/bmad-coach` 默认 | 返回「暂无 real_dev 评分数据…」 |
| AC-4 | 指定 run-id | — | `--run-id=sample-run` | 直接诊断，不校验 scenario |

<!-- AUDIT: PASSED by code-reviewer -->
