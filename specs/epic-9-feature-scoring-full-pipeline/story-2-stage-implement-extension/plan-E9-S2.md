# plan-E9-S2：stage=implement 扩展 实现方案

**Epic**：E9 feature-scoring-full-pipeline  
**Story ID**：9.2  
**输入**：spec-E9-S2.md、Story 9.2（9-2-stage-implement-extension.md）

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story | parse-and-write-score 支持 stage=implement | Phase 1 | ✅ |
| AC-1 | spec §3.1.1, §3.1.2 | Phase 1.1 | ✅ |
| AC-2 | spec §3.2 | Phase 1.2 | ✅ |
| AC-3 | spec §3.1.3 | Phase 1.1, 1.3 | ✅ |
| AC-4 | spec §3.3 | Phase 1.4 | ✅ |
| AC-5 | spec §3.4 | Phase 2 | ✅ |
| AC-6 | spec §3.5 | Phase 3 | ✅ |
| AC-7 | spec §3.6 | Phase 1.5, 1.6 | ✅ |
| Task 6.2 | spec §3.6 文档化约定 | Phase 1.6 | ✅ |

---

## 2. 目标与约束

- **Phase 1**：parse-and-write-score 扩展（AuditStage、case implement、CLI）、schema 确认、audit-item-mapping、trigger 衔接、文档化
- **Phase 2**：仪表盘完整 run 定义扩展
- **Phase 3**：speckit-workflow §5.2 更新
- **必须包含**：集成测试与 E2E（parse-and-write-score --stage implement、compute.ts 完整 run 单测、仪表盘 implement 与 tasks 区分）

---

## 3. 实施分期

### Phase 1：parse-and-write-score 与配置扩展

#### Phase 1.1：AuditStage 与 case implement（T1.1–T1.4, T1.6）

1. **audit-index.ts**：`AuditStage` 增加 `'implement'`；switch 增加 `case 'implement'`，调用 `parseGenericReport(..., stage: 'implement', phaseWeight: PHASE_WEIGHT_IMPLEMENT)`
2. **weights.ts**：新增 `PHASE_WEIGHT_IMPLEMENT = 0.25`
3. **audit-generic.ts**：`GenericAuditStage` 扩展包含 `'implement'`（Extract<MappingStage, ...> 需含 implement）
4. **parse-and-write-score.ts**：CLI stage 类型包含 implement；usage 文本更新
5. **验收**：`npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement --epic 9 --story 2` 执行成功

#### Phase 1.2：Schema 与 RunScoreRecord（T2.1, T2.2）

1. **run-score-schema.json**：确认 stage enum 已含 "implement"（已支持，无需修改）
2. **scoring/writer/types.ts**：确认 RunScoreRecord 的 stage 类型包含 `'implement'`（若由 schema 推导则已兼容）
3. **验收**：既有 record 不受影响；新 record 可含 stage: "implement"

#### Phase 1.3：implement 解析规则（T1.5）

1. **parseGenericReport**：传入 stage='implement' 时使用 implement-scoring.yaml 的 items、veto_items（通过 audit-item-mapping 的 implement 段衔接 resolveItemId/resolveEmptyItemId）
2. **验收**：phase_weight === 0.25；单测 parseAuditReport({ stage: 'implement' }) 返回 record.stage === 'implement'

#### Phase 1.4：audit-item-mapping implement 段（T3.1, T3.2）

1. **config/audit-item-mapping.yaml**：新增 implement 段；结构同 prd/arch（dimensions、checks、empty_overall、empty_dimensions）；checks 与 implement-scoring.yaml 的 items 对应（func_correct、code_standards、exception_handling、security、perf_maintain 等）
2. **audit-item-mapping.ts**：`AuditStage` 增加 `'implement'`；loadMapping 迭代列表增加 `'implement'`
3. **验收**：resolveItemId(stage='implement', ...)、resolveEmptyItemId(stage='implement', ...) 可用；单测覆盖

#### Phase 1.5：trigger 衔接（T6.1）

1. **config/scoring-trigger-modes.yaml**：新增 `implement_audit_pass: event: stage_audit_complete, stage: implement`
2. **验收**：`npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement --event stage_audit_complete --epic 9 --story 2` 不因 trigger 校验失败退出

#### Phase 1.6：文档化约定（T6.2）

1. **docs/BMAD/审计报告格式与解析约定.md** 或 **scoring/docs/** 或 **config/README**：补充「当 triggerStage 与 stage 一致时可省略 --triggerStage；--stage implement 时默认 triggerStage=implement」
2. **验收**：grep 可查到约定文档

### Phase 2：仪表盘完整 run（T4.1, T4.2, T4.3）

1. **scoring/dashboard/compute.ts**：
   - 完整 run：stages = Set(records.map(r => r.stage))；|stages| >= 3
   - implement 阶段识别：stage=implement 的 record 直接计入；stage=tasks 且 trigger_stage=speckit_5_2 的 record 亦计入（向后兼容）
2. **仪表盘展示**：按 stage 或 trigger_stage 区分 implement 与 tasks 的 phase_score
3. **验收**：单测覆盖；给定含 stage=implement 的 fixture，聚合与短板计算正确

### Phase 3：speckit-workflow §5.2（T5.1–T5.3）

1. **定位**：`C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md` 或项目内 `_bmad` 下
2. **修改**：§5.2「审计通过后评分写入触发」段落：CLI 改为 `--stage implement`，移除 `--triggerStage speckit_5_2`
3. **报告路径**：保持 `AUDIT_implement-E{epic}-S{story}.md`
4. **验收**：grep §5.2 含 `--stage implement`，不含 `--triggerStage speckit_5_2`

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 parse-and-write-score --stage implement

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | parseAuditReport stage=implement | scoring/parsers/__tests__/audit-index.test.ts 或 audit-generic.test.ts | record.stage === 'implement'，phase_weight === 0.25 |
| 集成 | CLI --stage implement | `npx ts-node scripts/parse-and-write-score.ts --reportPath <implement报告fixture> --stage implement --epic 9 --story 2` | scoring/data 下 record 含 stage: "implement" |
| 集成 | trigger 校验 | 同上 + `--event stage_audit_complete` | 不因 trigger 失败退出 |

### 4.2 仪表盘完整 run 与 implement 识别

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | getLatestRunRecordsV2 含 stage=implement | scoring/dashboard/__tests__/compute.test.ts | 完整 run 判定正确；implement 与 tasks 分别计入 |
| 单元 | 短板计算含 stage=implement | 同上 | getWeakTop3 等正确 |
| 集成/E2E | dashboard-generate 区分 implement 与 tasks | `npx ts-node scripts/dashboard-generate.ts --epic 9 --story 2 --strategy epic_story_window`（scoring/data 含 stage=implement fixture） | 输出能区分 implement 与 tasks 的 phase_score |

### 4.3 生产代码关键路径验证

- **parse-and-write-score**：speckit-workflow §5.2 审计通过后会调用；验收：执行 CLI --stage implement 确认写入
- **compute.ts**：dashboard-generate 调用 getLatestRunRecordsV2 / computeHealthScore；验收：grep 确认 compute.ts 被 dashboard 入口导入
- **audit-item-mapping**：parseGenericReport 调用 resolveItemId/resolveEmptyItemId；验收：单测覆盖 implement stage

---

## 5. 模块与文件改动设计

### 5.1 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| scoring/parsers/audit-index.ts | AuditStage + 'implement'；case 'implement' | Phase 1.1 |
| scoring/constants/weights.ts | PHASE_WEIGHT_IMPLEMENT = 0.25 | Phase 1.1 |
| scoring/parsers/audit-generic.ts | GenericAuditStage 含 'implement' | Phase 1.1 |
| scoring/parsers/audit-item-mapping.ts | AuditStage + 'implement'；loadMapping + 'implement' | Phase 1.4 |
| config/audit-item-mapping.yaml | implement 段 | Phase 1.4 |
| scripts/parse-and-write-score.ts | stage 类型、usage 含 implement | Phase 1.1 |
| config/scoring-trigger-modes.yaml | implement_audit_pass | Phase 1.5 |
| scoring/dashboard/compute.ts | 完整 run 定义、implement 识别 | Phase 2 |
| speckit-workflow/SKILL.md | §5.2 --stage implement | Phase 3 |
| docs/BMAD/审计报告格式与解析约定.md 或 scoring/docs | 文档化 triggerStage 约定 | Phase 1.6 |

### 5.2 新增文件（可选）

| 文件 | 责任 |
|------|------|
| scoring/parsers/__tests__/audit-implement.test.ts 或扩展现有 | implement 解析单测 |
| scoring/data/__fixtures-implement/ 或内联 fixture | implement 报告 fixture |

---

## 6. 验收命令汇总

| Phase | 验收命令 | 预期 |
|-------|----------|------|
| 1.1 | `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement --epic 9 --story 2` | 执行成功 |
| 1.2 | 检查 run-score-schema、types | implement 已支持 |
| 1.3 | 单测 parseAuditReport({ stage: 'implement' }) | record.stage === 'implement'，phase_weight === 0.25 |
| 1.4 | 单测 resolveItemId('implement', ...) | 可用 |
| 1.5 | 同上 + `--event stage_audit_complete` | 不因 trigger 失败退出 |
| 1.6 | grep 文档化约定 | 有匹配 |
| 2 | 单测 compute.ts 含 stage=implement fixture；E2E dashboard-generate --epic 9 --story 2 | 聚合、短板正确；输出区分 implement 与 tasks |
| 3 | grep speckit-workflow §5.2 | --stage implement，无 --triggerStage speckit_5_2 |
