# Plan E7-S4：Coach discovery 仅 real_dev

*基于 spec-E7-S4.md 的技术实现计划*

---

## 1. 概述与目标

为 discovery 与 Coach 入口增加 scenario 过滤能力，使无参 `/bmad-coach` 默认仅诊断 `scenario=real_dev` 的 run，排除 eval_question sample 误选。

---

## 2. 技术栈与架构

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript |
| 测试 | Vitest |
| 入口 | scripts/coach-diagnose.ts（CLI）、commands/bmad-coach.md（Command 文档） |
| 依赖 | scoring/coach/discovery.ts、scoring/writer/types.ts |

---

## 3. 文件结构与变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| scoring/coach/discovery.ts | 修改 | 为 discoverLatestRunId 增加 scenarioFilter 参数 |
| scripts/coach-diagnose.ts | 修改 | 解析 --scenario，默认 real_dev；调用 discovery 时传入 scenarioFilter |
| scoring/coach/__tests__/discovery.test.ts | 修改 | 新增 scenarioFilter 相关用例 |
| commands/bmad-coach.md | 修改 | 补充 --scenario 参数说明 |
| skills/bmad-eval-analytics/SKILL.md | 修改 | Coach 执行指引注明默认仅 real_dev |

---

## 4. 实现顺序与集成

1. **Phase 1：discovery 扩展**
   - 修改 `discoverLatestRunId` 签名，增加 `scenarioFilter?: 'real_dev' | 'eval_question' | 'all'`
   - 在 loadAllRecords 后按 scenarioFilter 过滤
   - 过滤后 sort → slice → 返回或 null

2. **Phase 2：coach-diagnose 集成**
   - 解析 `--scenario`，默认 `real_dev`
   - 无 `--run-id` 时：将 scenarioFilter 传给 discoverLatestRunId
   - AC-3：默认 scenario 且 discovery 返回 null 时，根据 scenarioFilter 输出对应空数据消息

3. **Phase 3：文档**
   - commands/bmad-coach.md 补充 --scenario 说明
   - skills/bmad-eval-analytics/SKILL.md 注明默认仅 real_dev

4. **Phase 4：测试**
   - discovery.test.ts：scenarioFilter=real_dev 仅返回 real_dev；eval_question 同理；undefined/all 不过滤
   - 集成验证：coach-diagnose 无参时 discovery 路径被调用且传入 real_dev

---

## 5. 集成测试与端到端计划

| 测试类型 | 覆盖 | 验收方式 |
|----------|------|----------|
| 单元测试 | discovery scenarioFilter 过滤逻辑 | discovery.test.ts 新增用例 |
| 集成测试 | coach-diagnose 调用 discovery 并传入 scenarioFilter | 运行 coach-diagnose 无参，验证 discovery 路径使用 real_dev；或 mock discovery 验证调用参数 |
| 端到端 | 用户无参运行 coach-diagnose，输出正确 | 准备 real_dev+eval_question 混合数据，无参运行应返回 real_dev 最新 run 的诊断 |

---

## 6. 风险与回退

- 无重大风险；scenarioFilter 为可选参数，省略时保持现有行为
- 回退：移除 scenarioFilter 参数，coach-diagnose 不传 scenario，恢复原行为

<!-- AUDIT: PASSED by code-reviewer -->
