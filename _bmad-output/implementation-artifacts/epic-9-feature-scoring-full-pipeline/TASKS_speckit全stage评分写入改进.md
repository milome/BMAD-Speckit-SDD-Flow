# TASKS：speckit 全 stage 评分写入改进

**归属**：Epic 9  
**产出来源**：Party-Mode 100 轮辩论（批判审计员 >70%，最后 3 轮无 gap 收敛）  
**共识文档**：`_orphan/DEBATE_speckit全stage评分写入改进_100轮.md`  
**附录**：同目录 `ANNEX_speckit全stage评分写入改进.md`  
**路径**：`_bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/TASKS_speckit全stage评分写入改进.md`

---

## §1 任务列表（T1～T6）

### T1：audit-prompts §1～§4 增加【审计后动作】段落

| 项 | 内容 |
|----|------|
| **修改文件** | `skills/speckit-workflow/references/audit-prompts.md` |
| **修改位置** | §1、§2、§3、§4 各节**末尾**（在可解析评分块说明之后） |
| **追加内容** | 在每节末尾增加以下段落（可复制粘贴）：`【审计后动作】审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath（调用方会在本 prompt 中提供具体路径），并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过），以便主 Agent 调用 parse-and-write-score。` |
| **验收标准** | (1) grep 每节末尾含「审计后动作」「reportPath」「iteration_count」；(2) 复制该段落到子 Agent prompt 后，子 Agent 能明确知晓落盘路径与 iteration_count 输出要求 |
| **责任人** | 主 Agent / 文档维护 |

### T2：audit-prompts §5 增加【审计后动作】段落（含 implement 路径）

| 项 | 内容 |
|----|------|
| **修改文件** | `skills/speckit-workflow/references/audit-prompts.md` |
| **修改位置** | §5 节**末尾** |
| **追加内容** | 在 §5 末尾增加：`【审计后动作】审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath。implement 阶段的 reportPath 通常为 _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{epic}-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md 或 AUDIT_Story_{epic}-{story}_stage4.md。并在结论中注明保存路径及 iteration_count，以便主 Agent 调用 parse-and-write-score。` |
| **验收标准** | (1) grep §5 末尾含「审计后动作」「implement」「reportPath」「AUDIT_implement」或「AUDIT_Story」；(2) 路径格式与 §1.3 约定表一致 |
| **责任人** | 主 Agent / 文档维护 |

### T3：speckit-workflow 各 §x.2 补充「prompt 须包含落盘路径」要求

| 项 | 内容 |
|----|------|
| **修改文件** | `skills/speckit-workflow/SKILL.md` |
| **修改位置** | §1.2、§2.2、§3.2、§4.2、§5.2 各「审计通过后评分写入触发」段落内 |
| **追加内容** | 在每段中增加一句：`发起审计子任务时，发给子 Agent 的 prompt 必须包含：审计通过后请将报告保存至 {约定路径}，路径由主 Agent 根据 epic、story、slug 填充。` |
| **验收标准** | (1) grep 五处 §x.2 均含「prompt 必须包含」「审计通过后请将报告保存至」；(2) 与 audit-prompts 的【审计后动作】表述一致 |
| **责任人** | 主 Agent / 技能维护 |

### T4：bmad-story-assistant 强化 speckit 嵌套流程的审计 prompt 模板

| 项 | 内容 |
|----|------|
| **修改文件** | `skills/bmad-story-assistant/SKILL.md` |
| **修改位置** | STORY-A3-DEV 模板及 speckit 嵌套调用段落（约第 856 行附近）；发起 spec/plan/GAPS/tasks 审计的 prompt 模板 |
| **追加/强化内容** | 在 prompt 模板中显式包含：(1) 「审计通过后请将报告保存至 specs/epic-{epic_num}/story-{story_num}-{slug}/AUDIT_spec-E{epic_num}-S{story_num}.md」（spec 阶段，plan/GAPS/tasks 对应 AUDIT_plan-、AUDIT_GAPS-、AUDIT_tasks-）；(2) 「在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过）」 |
| **验收标准** | (1) grep bmad-story-assistant SKILL 含「审计通过后请将报告保存至」及「iteration_count」；(2) 路径占位符 epic_num、story_num、slug 由主 Agent 发起时注入；(3) 与 speckit-workflow §x.2 约定一致 |
| **责任人** | 主 Agent / 技能维护 |

### T5：（可选）Story 9.3 全 stage 补齐

| 项 | 内容 |
|----|------|
| **执行条件** | 用户明确选择执行本任务 |
| **步骤** | (1) 对 `specs/epic-9/story-3-epic-dashboard-aggregate/spec-E9-S3.md` 执行 audit-prompts §1 审计，产出 `AUDIT_spec-E9-S3.md`；(2) 对 plan-E9-S3.md 执行 §2 审计，产出 `AUDIT_plan-E9-S3.md`；(3) 对 IMPLEMENTATION_GAPS-E9-S3.md 执行 §3 审计，产出 `AUDIT_GAPS-E9-S3.md`；(4) 对 tasks-E9-S3.md 执行 §4 审计，产出 `AUDIT_tasks-E9-S3.md`；(5) 每 stage 通过后运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <对应路径> --stage <spec|plan|plan|tasks> --event stage_audit_complete --triggerStage speckit_1_2|speckit_2_2|speckit_3_2|speckit_4_2 --epic 9 --story 3 --artifactDocPath <对应文档路径> --iteration-count 0` |
| **验收标准** | (1) 四个 AUDIT_* 文件存在于 `specs/epic-9/story-3-epic-dashboard-aggregate/`；(2) scoring 存储中 E9.S3 的 spec、plan、GAPS、tasks 阶段均有记录；(3) 仪表盘 Epic 9 聚合可查 E9.S3 各 stage 评分 |
| **责任人** | 用户选择后由主 Agent 或子 Agent 执行 |

### T6：（可选）Story 9.3 implement-only 补齐

| 项 | 内容 |
|----|------|
| **执行条件** | 用户明确选择执行本任务；且 scoring 存储中 E9.S3 implement 阶段尚未有记录 |
| **步骤** | 以 `_bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/story-9-3-epic-dashboard-aggregate/AUDIT_Story_9-3_stage4_round3.md` 为 --reportPath，执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <上述路径> --stage tasks --event story_status_change --triggerStage bmad_story_stage4 --epic 9 --story 3 --iteration-count 1`。若已写入则跳过 |
| **验收标准** | (1) scoring 存储中 E9.S3 implement/tasks 阶段有记录；或 (2) 执行前已存在则跳过，无错误 |
| **责任人** | 用户选择后由主 Agent 执行 |

---

## §2 任务依赖与执行顺序

| 依赖 | 说明 |
|------|------|
| T1、T2 | 可并行执行 |
| T3、T4 | 依赖 T1/T2 的【审计后动作】段落文案，可复用其表述 |
| T5、T6 | 无前置依赖；T5 与 T6 可独立执行，用户可只选 T6（成本低）或 T5（全量） |

**建议顺序**：T1 → T2 → T3 → T4；T5、T6 按用户选择执行。

---

## §3 验收命令汇总

```bash
# T1、T2 验收
grep -E "审计后动作|reportPath|iteration_count" skills/speckit-workflow/references/audit-prompts.md

# T3 验收
grep -E "prompt 必须包含|审计通过后请将报告保存至" skills/speckit-workflow/SKILL.md

# T4 验收
grep -E "审计通过后请将报告保存至|iteration_count" skills/bmad-story-assistant/SKILL.md

# T5 验收（若执行）
ls specs/epic-9/story-3-epic-dashboard-aggregate/AUDIT_spec-E9-S3.md
ls specs/epic-9/story-3-epic-dashboard-aggregate/AUDIT_plan-E9-S3.md
ls specs/epic-9/story-3-epic-dashboard-aggregate/AUDIT_GAPS-E9-S3.md
ls specs/epic-9/story-3-epic-dashboard-aggregate/AUDIT_tasks-E9-S3.md

# T6 验收（若执行）
# 检查 scoring 存储中 E9.S3 是否有 implement 记录
```
