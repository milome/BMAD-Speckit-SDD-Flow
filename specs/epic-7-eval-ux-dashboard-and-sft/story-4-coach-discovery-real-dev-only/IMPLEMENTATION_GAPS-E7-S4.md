# IMPLEMENTATION_GAPS E7-S4：Coach discovery 仅 real_dev

*基于 plan-E7-S4.md 与现有代码的差距分析*

---

## 1. spec/plan 覆盖检查

| spec/plan 章节 | 覆盖 | 说明 |
|----------------|------|------|
| spec §3.2 discoverLatestRunId 扩展 | ✅ | 需在 discovery.ts 实现 scenarioFilter |
| spec §3.3 CLI 参数 | ✅ | 需在 coach-diagnose.ts 解析 --scenario |
| spec §3.4 空数据行为 | ✅ | 需在 coach-diagnose 输出 scenario 特定消息 |
| spec §3.5 向后兼容 | ✅ | --run-id 跳过 discovery，--scenario all 不过滤 |
| plan Phase 1–4 | ✅ | 与 spec 一致 |

---

## 2. 现有代码现状与差距

### 2.1 discovery.ts

| 现状 | 差距 |
|------|------|
| discoverLatestRunId(dataPath, limit) 无 scenario 参数 | 需增加 scenarioFilter?: 'real_dev' \| 'eval_question' \| 'all' |
| loadAllRecords 后直接 sort/slice | 需在 sort 前按 scenarioFilter 过滤 records |
| 无记录返回 null | 保持；过滤后无记录同样返回 null |

### 2.2 coach-diagnose.ts

| 现状 | 差距 |
|------|------|
| 无 --scenario 参数 | 需解析 --scenario，默认 real_dev |
| discoverLatestRunId(dataPath, limit) 不传 scenario | 需传入 scenarioFilter（real_dev / eval_question / undefined） |
| EMPTY_DATA_MESSAGE 通用 | 需在默认 scenario=real_dev 且无记录时输出「暂无 real_dev 评分数据…」 |
| --run-id 存在时跳过 discovery | 已满足；无需修改 |

### 2.3 commands/bmad-coach.md

| 现状 | 差距 |
|------|------|
| 无 --scenario 说明 | 需补充 --scenario real_dev\|eval_question\|all，默认 real_dev |

### 2.4 skills/bmad-eval-analytics/SKILL.md

| 现状 | 差距 |
|------|------|
| Coach 执行指引未注明 scenario | 需注明默认仅 real_dev，eval_question 需显式 --scenario |

### 2.5 discovery.test.ts

| 现状 | 差距 |
|------|------|
| 所有用例用 scenario='real_dev' | 需新增：scenarioFilter=real_dev 仅返回 real_dev；eval_question 同理；无 filter 与现有一致 |
| 无 scenario 混合数据用例 | 需增加 real_dev+eval_question 混合，验证过滤后取 latest |

---

## 3. 生产代码关键路径

```
commands/bmad-coach.md（用户触发）
  → scripts/coach-diagnose.ts（CLI）
    → discoverLatestRunId(dataPath, limit, scenarioFilter)（无 run-id 时）
    → coachDiagnose(runId, options)
```

discovery 与 coach-diagnose 已在生产关键路径；本 Story 仅扩展 discovery 参数与 coach-diagnose 解析，无孤岛模块风险。

---

## 4. 待实现任务概要

1. discovery.ts：scenarioFilter 参数与过滤逻辑
2. coach-diagnose.ts：--scenario 解析、默认 real_dev、scenario 特定空数据消息
3. discovery.test.ts：scenarioFilter 用例
4. commands/bmad-coach.md：--scenario 文档
5. skills/bmad-eval-analytics/SKILL.md：Coach 默认 real_dev 说明

<!-- AUDIT: PASSED by code-reviewer -->
