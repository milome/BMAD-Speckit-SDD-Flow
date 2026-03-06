# Tasks E7-S4：Coach discovery 仅 real_dev

*基于 IMPLEMENTATION_GAPS-E7-S4.md 与 plan-E7-S4.md 的任务分解*

---

## 需求映射清单

| AC/需求 | 任务 |
|---------|------|
| AC-1 默认仅 real_dev | US-001, US-002 |
| AC-2 显式 --scenario | US-002 |
| AC-3 无 real_dev 友好提示 | US-002 |
| AC-4 --run-id 向后兼容 | US-002（已有逻辑，验证保持） |

---

## US-001：扩展 discoverLatestRunId scenarioFilter

**验收**：discoverLatestRunId 支持 scenarioFilter，过滤后按 timestamp 取最新；无 filter 时与现有行为一致。

| # | 任务 | 验收 |
|---|------|------|
| T1.1 | 在 `scoring/coach/discovery.ts` 为 `discoverLatestRunId` 增加 `scenarioFilter?: 'real_dev' \| 'eval_question' \| 'all'`；loadAllRecords 后按 scenarioFilter 过滤（all/undefined 不过滤） | 签名与实现符合 spec §3.2 |
| T1.2 | 过滤后无记录返回 null | 单元测试覆盖 |
| T1.3 | 新增 `scoring/coach/__tests__/discovery.test.ts` 用例：scenarioFilter=real_dev 时仅返回 real_dev 最新 run_id；eval_question 同理；无 filter 与现有行为一致 | discovery.test.ts 含 3 个 scenarioFilter 用例 |

**集成验证**：coach-diagnose 无参时调用 discoverLatestRunId(dataPath, limit, 'real_dev')，在生产路径中被调用。

---

## US-002：coach-diagnose 解析 --scenario 并集成 discovery

**验收**：无参默认 real_dev；--scenario all 不过滤；--run-id 跳过 discovery；AC-3 空数据消息。

| # | 任务 | 验收 |
|---|------|------|
| T2.1 | 在 `scripts/coach-diagnose.ts` 解析 `--scenario real_dev\|eval_question\|all`，默认 `real_dev` | 解析正确 |
| T2.2 | 无 `--run-id` 时调用 `discoverLatestRunId(dataPath, limit, scenarioFilter)`，real_dev→'real_dev'，eval_question→'eval_question'，all→undefined | 传参正确 |
| T2.3 | 默认 scenario 且 discovery 返回 null 时：real_dev 输出「暂无 real_dev 评分数据，请先完成至少一轮 Dev Story」；eval_question 输出「暂无 eval_question 评分数据」 | AC-3 满足 |
| T2.4 | `--run-id` 存在时跳过 discovery，不应用 scenario（与现有行为一致） | AC-4 满足 |

**集成验证**：运行 `npx ts-node scripts/coach-diagnose.ts` 无参，discovery 使用 real_dev；有 real_dev 数据时输出正确诊断。

---

## US-003：更新 Command 与 Skill 文档

**验收**：文档明确 --scenario 与默认 real_dev 说明。

| # | 任务 | 验收 |
|---|------|------|
| T3.1 | 在 `commands/bmad-coach.md` 补充 `--scenario real_dev\|eval_question\|all`，说明默认 real_dev | 文档含 --scenario 说明 |
| T3.2 | 在 `skills/bmad-eval-analytics/SKILL.md` Coach 执行指引中注明：默认仅 real_dev，eval_question 需显式 `--scenario eval_question` | Skill 文档已更新 |

---

## 验收命令

```bash
# 单元 + 集成
npx vitest run scoring/coach/__tests__/ -v

# 端到端（有数据时）
npx ts-node scripts/coach-diagnose.ts
npx ts-node scripts/coach-diagnose.ts --scenario eval_question
npx ts-node scripts/coach-diagnose.ts --scenario all
npx ts-node scripts/coach-diagnose.ts --run-id=<existing-run-id>
```

<!-- AUDIT: PASSED by code-reviewer -->
