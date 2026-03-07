# IMPLEMENTATION_GAPS-E9-S2：stage=implement 扩展

**Epic**：E9 feature-scoring-full-pipeline  
**Story**：9.2  
**输入**：spec-E9-S2.md、plan-E9-S2.md、Story 9.2、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1.1, AC-1 | GAP-1.1 | audit-index.ts AuditStage 增加 'implement' | 未实现 | 当前 AuditStage = 'prd'\|'arch'\|'story'\|'spec'\|'plan'\|'tasks'，无 implement |
| spec §3.1.1, AC-1 | GAP-1.2 | audit-index switch case 'implement' 调用 parseGenericReport | 未实现 | switch 仅有 prd/arch/story/spec/plan/tasks，无 implement 分支 |
| spec §3.1.3, AC-3 | GAP-1.3 | PHASE_WEIGHT_IMPLEMENT = 0.25 | 未实现 | weights.ts 仅有 PHASE_WEIGHTS_SPEC/PLAN/TASKS，无 PHASE_WEIGHT_IMPLEMENT |
| spec §3.1.3, AC-3 | GAP-1.4 | audit-generic.ts GenericAuditStage 含 'implement' | 未实现 | GenericAuditStage = Extract<MappingStage, 'prd'\|'spec'\|'plan'\|'tasks'>，无 implement |
| spec §3.1.1, AC-1 | GAP-1.5 | parse-and-write-score.ts stage 类型、usage 含 implement | 未实现 | CLI stage 类型由 AuditStage 推导，无 implement；usage 文本未列 implement |
| spec §3.2, AC-2 | GAP-2.1 | run-score-schema stage 支持 implement | 已实现 | schema enum 已含 "implement" |
| spec §3.2, AC-2 | GAP-2.2 | RunScoreRecord stage 类型含 implement | 部分 | 若由 schema 推导则兼容；writer/types 若显式 union 需确认 |
| spec §3.3, AC-4 | GAP-3.1 | audit-item-mapping.yaml implement 段 | 未实现 | 当前仅有 prd、arch、story；无 implement 段 |
| spec §3.3, AC-4 | GAP-3.2 | audit-item-mapping.ts AuditStage、loadMapping 含 implement | 未实现 | AuditStage 无 implement；loadMapping 迭代列表无 'implement' |
| spec §3.4, AC-5 | GAP-4.1 | compute.ts 完整 run 含 stage=implement | 部分实现 | 当前按 x.stage 去重，stage=implement 将自然计入；需确认 implement 与 trigger_stage=speckit_5_2 双识别逻辑 |
| spec §3.4, AC-5 | GAP-4.2 | 仪表盘按 stage/trigger_stage 区分 implement 与 tasks | 未实现 | format 或 compute 输出结构需能区分；当前 getWeakTop3 等按 stage 输出，stage=implement 与 tasks 已为不同值 |
| spec §3.5, AC-6 | GAP-5.1 | speckit-workflow §5.2 改用 --stage implement | 未实现 | 当前 §5.2 使用 --stage tasks --triggerStage speckit_5_2 |
| spec §3.6, AC-7 | GAP-6.1 | scoring-trigger-modes implement_audit_pass | 未实现 | call_mapping 无 implement_audit_pass；--stage implement 时 triggerStage=implement 无匹配 |
| spec §3.6, Task 6.2 | GAP-6.2 | 文档化 triggerStage 与 stage 一致可省略约定 | 未实现 | scoring/docs 或 config 相关文档未补充 |

---

## 2. 需求映射清单（Gaps ↔ spec/plan）

| Gap ID | spec 章节 | plan 对应 | 覆盖状态 |
|--------|----------|----------|----------|
| GAP-1.1～1.5 | §3.1 | Phase 1.1 | ✅ |
| GAP-2.1～2.2 | §3.2 | Phase 1.2 | ✅ |
| GAP-3.1～3.2 | §3.3 | Phase 1.4 | ✅ |
| GAP-4.1～4.2 | §3.4 | Phase 2 | ✅ |
| GAP-5.1 | §3.5 | Phase 3 | ✅ |
| GAP-6.1～6.2 | §3.6 | Phase 1.5、1.6 | ✅ |

---

## 3. plan §4 集成测试与 E2E 计划 ↔ 当前实现

| plan §4 测试项 | 当前实现状态 | 缺失/偏差说明 |
|----------------|-------------|---------------|
| §4.1 parseAuditReport stage=implement 单测 | 未实现 | 无 implement 解析路径，单测无法通过 |
| §4.1 CLI --stage implement 集成 | 未实现 | AuditStage 无 implement，CLI 会落入 default 抛错 |
| §4.1 trigger 校验集成 | 未实现 | implement_audit_pass 未配置，会失败 |
| §4.2 compute.ts 含 stage=implement 单测 | 部分 | getLatestRunRecordsV2 等已存在；需增加 stage=implement fixture 的用例 |
| §4.2 dashboard-generate E2E | 未实现 | 需 stage=implement record 的 fixture；dashboard 需能区分输出 |
| §4.3 生产路径验证 | 部分 | parse-and-write-score、compute 均有生产入口；implement 路径未打通 |

---

## 4. spec §4 成功标准 ↔ 实现状态

| 成功标准 | 实现状态 | 说明 |
|----------|----------|------|
| 向后兼容 | 部分 | run-score-schema 已支持；既存 trigger_stage=speckit_5_2 记录有效 |
| 单测覆盖 | 未实现 | 需 Task 1、Task 4 单测 |
| E2E | 未实现 | parse-and-write-score --stage implement 当前不可执行 |

---

## 5. 实施优先级（依赖顺序）

1. **Phase 1.4 先行**：GAP-3.1、GAP-3.2（audit-item-mapping implement 段）→ 供 Phase 1.1 parseGenericReport 使用
2. **Phase 1.1**：GAP-1.1～1.5（audit-index、weights、audit-generic、CLI）
3. **Phase 1.2**：GAP-2.1～2.2 确认（schema 已支持，仅验证）
4. **Phase 1.5**：GAP-6.1（implement_audit_pass）
5. **Phase 1.6**：GAP-6.2（文档化约定）
6. **Phase 2**：GAP-4.1～4.2（compute 完整 run、仪表盘区分）
7. **Phase 3**：GAP-5.1（speckit-workflow §5.2）
