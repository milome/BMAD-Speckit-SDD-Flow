# Epic 9 附录：speckit 全 stage 评分写入改进

**产出来源**：Party-Mode 100 轮辩论（批判审计员发言占比 >70%，最后 3 轮无新 gap 收敛）  
**共识文档**：`_orphan/DEBATE_speckit全stage评分写入改进_100轮.md`  
**审计状态**：连续 3 轮无 gap 收敛通过（AUDIT_DEBATE_speckit全stage评分写入_round4～6）

---

## §1 议题与背景（明确描述）

### 1.1 议题一：规范 speckit 子任务

**现状**：speckit-workflow SKILL 已在 §1.2、§2.2、§3.2、§4.2、§5.2 各阶段定义「审计通过后评分写入触发」：报告落盘约定路径 + 调用 `npx ts-node scripts/parse-and-write-score.ts`。子 Agent 执行审计时的 prompt 中**未显式写明**以下两项：(1) 审计通过后须将报告保存至约定路径；(2) 主 Agent 在收到通过结论后须调用 parse-and-write-score。导致模型可能忽略该步骤，仪表盘无法显示 spec/plan/GAPS/tasks 阶段评分。

**目标**：在 speckit 各阶段（spec、plan、GAPS、tasks、implement）审计 prompt 或子任务编排中，**明确要求**审计通过后将报告保存至约定路径，并触发 parse-and-write-score。主 Agent 在收到通过结论后必须调用 parse-and-write-score。

### 1.2 议题二：补齐 Story 9.3 的 speckit 评分

**现状**：Story 9.3 已有 spec/plan/GAPS/tasks 文档（路径：`specs/epic-9/story-3-epic-dashboard-aggregate/`），但**无** speckit 约定路径的审计报告文件：`AUDIT_spec-E9-S3.md`、`AUDIT_plan-E9-S3.md`、`AUDIT_GAPS-E9-S3.md`、`AUDIT_tasks-E9-S3.md`。implement 阶段存在 `AUDIT_Story_9-3_stage4*.md`（BMAD 命名），但 speckit §5.2 约定为 `AUDIT_implement-E9-S3.md`。仪表盘 Epic 9 聚合时，E9.S3 的 spec/plan/GAPS/tasks 阶段评分在 scoring 存储中缺失。

**目标**：用户可选择对 Story 9.3 的 spec/plan/GAPS/tasks 各执行一次 speckit 审计，产出约定路径报告并调用 parse-and-write-score；或仅对现有 stage4 报告补跑 parse-and-write-score（若尚未写入）。用户根据仪表盘需求决定是否执行。

### 1.3 约定路径表（speckit-workflow 权威约定）

| stage | 报告路径 | 说明 |
|-------|----------|------|
| spec | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md` | 由主 Agent 根据 epic、story、slug 填充 |
| plan | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md` | 同上 |
| GAPS | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_GAPS-E{epic}-S{story}.md` | 同上 |
| tasks | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md` | 同上 |
| implement | `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md` 或 `AUDIT_Story_{epic}-{story}_stage4.md` | 目录为 `story-{epic}-{story}-{slug}`，新产出建议用 AUDIT_implement-，历史兼容 stage4 |

---

## §2 共识方案（逐项明确）

### 2.1 议题一实施要点

1. **audit-prompts.md**：在 §1、§2、§3、§4、§5 各节末尾追加「【审计后动作】」段落，内容为：审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath，并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过），以便主 Agent 调用 parse-and-write-score。§5 单独注明 implement 阶段的 reportPath 通常为 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{epic}-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md` 或 `AUDIT_Story_{epic}-{story}_stage4.md`。

2. **speckit-workflow SKILL**：在 §1.2、§2.2、§3.2、§4.2、§5.2 各「审计通过后评分写入触发」段落中，补充明确要求：发起审计子任务时，**发给子 Agent 的 prompt 必须包含**「审计通过后请将报告保存至 {约定路径}」，路径由主 Agent 根据 epic、story、slug 填充。不得省略或概括。

3. **bmad-story-assistant SKILL**：在 speckit 嵌套流程中，发起 spec/plan/GAPS/tasks 审计时，prompt 模板须显式包含：(1) 落盘路径（由主 Agent 注入）；(2) iteration_count 输出要求（子 Agent 在通过结论中注明本 stage 审计未通过轮数）。与 speckit-workflow 约定一致。修改位置：STORY-A3-DEV 模板及 speckit 嵌套调用的 prompt 段落，约 bmad-story-assistant SKILL 第 856 行附近。

4. **implement 报告命名**：新产出的 implement 阶段审计报告建议统一命名为 `AUDIT_implement-E{epic}-S{story}.md`；历史已存在的 `AUDIT_Story_{epic}-{story}_stage4.md` 保持兼容，补跑 parse-and-write-score 时直接使用现有路径作为 --reportPath 即可。

### 2.2 议题二实施要点（可选，用户决策）

- **T5（可选-全量）**：对 Story 9.3 的 spec、plan、GAPS、tasks 各执行一次 speckit 审计（使用 audit-prompts §1～§4），产出 `AUDIT_spec-E9-S3.md`、`AUDIT_plan-E9-S3.md`、`AUDIT_GAPS-E9-S3.md`、`AUDIT_tasks-E9-S3.md`，每 stage 通过后运行 parse-and-write-score。仪表盘 Epic 9 聚合可查 E9.S3 各 stage 评分。
- **T6（可选-仅 implement）**：以现有 `AUDIT_Story_9-3_stage4.md` 或最后通过的 round 报告（如 `AUDIT_Story_9-3_stage4_round3.md`）为 --reportPath，执行 `npx ts-node scripts/parse-and-write-score.ts ...`；若 scoring 存储中 E9.S3 implement 已有记录则跳过。scoring 存储中 E9.S3 implement 有记录即验收通过。

### 2.3 Deferred Gaps（不纳入本次实施，后续迭代处理）

- standalone speckit 流程的 reportPath 参数注入机制（Cursor Task 或等价方式的参数化支持）；
- AUDIT_implement 与 AUDIT_Story_stage4 的长期命名统一策略。

---

## §3 任务列表（与 TASKS 文档一致）

见同目录 `TASKS_speckit全stage评分写入改进.md`。

---

## §4 引用路径

| 引用 | 路径 |
|------|------|
| 共识 DEBATE | `_bmad-output/implementation-artifacts/_orphan/DEBATE_speckit全stage评分写入改进_100轮.md` |
| audit-prompts | `skills/speckit-workflow/references/audit-prompts.md` |
| speckit-workflow SKILL | `skills/speckit-workflow/SKILL.md` |
| bmad-story-assistant SKILL | `skills/bmad-story-assistant/SKILL.md` |
| config | `config/scoring-trigger-modes.yaml`（scoring_write_control.enabled 控制是否调用 parse-and-write-score） |
