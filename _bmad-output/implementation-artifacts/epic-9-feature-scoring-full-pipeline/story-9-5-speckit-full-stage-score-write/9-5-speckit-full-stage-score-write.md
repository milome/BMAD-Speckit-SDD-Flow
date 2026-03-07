# Story 9.5: speckit 全 stage 评分写入规范

Status: ready-for-dev

## Story

**As a** 主 Agent / 技能维护者，  
**I want** speckit 各 stage（spec/plan/GAPS/tasks/implement）审计通过时，子 Agent 能将报告保存至约定路径并在结论中注明 iteration_count，以便主 Agent 可靠调用 parse-and-write-score 写入评分存储，  
**so that** 评分全链路在 speckit 各阶段的审计产出能一致落盘并触发 parse-and-write-score，避免模型忽略落盘或 iteration_count 导致评分缺失或错误。

## 实施范围说明

本 Story 实施 `TASKS_speckit全stage评分写入改进.md` 中的 **T1～T4**。

**T5、T6 由 TASKS 标注为「用户决策」任务，本 Story 不包含。**

**共识依据**：`_orphan/DEBATE_speckit全stage评分写入改进_100轮.md`（Party-Mode 100 轮，批判审计员 >70%，最后 3 轮无 gap 收敛）

---

## Acceptance Criteria

| # | 需求 | 对应任务 | 验收标准 |
|---|------|----------|----------|
| AC-1 | audit-prompts §1～§4 含【审计后动作】 | T1 | grep 每节末尾含「审计后动作」「reportPath」「iteration_count」；复制该段落到子 Agent prompt 后，子 Agent 能明确知晓落盘路径与 iteration_count 输出要求 |
| AC-2 | audit-prompts §5 含【审计后动作】（implement 路径） | T2 | grep §5 末尾含「审计后动作」「implement」「reportPath」「AUDIT_implement」或「AUDIT_Story」；路径格式与 §1.3 约定表一致 |
| AC-3 | speckit-workflow §x.2 含「prompt 须包含落盘路径」 | T3 | grep 五处 §1.2、§2.2、§3.2、§4.2、§5.2 均含「prompt 必须包含」「审计通过后请将报告保存至」；与 audit-prompts 的【审计后动作】表述一致 |
| AC-4 | bmad-story-assistant 强化 speckit 嵌套 prompt 模板 | T4 | grep bmad-story-assistant SKILL 含「审计通过后请将报告保存至」及「iteration_count」；路径占位符 epic_num、story_num、slug 由主 Agent 发起时注入；与 speckit-workflow §x.2 约定一致 |

---

## Tasks（引用 TASKS §1）

- [x] **T1** audit-prompts §1～§4 增加【审计后动作】段落（AC-1）
- [x] **T2** audit-prompts §5 增加【审计后动作】段落（含 implement 路径）（AC-2）
- [x] **T3** speckit-workflow 各 §1.2、§2.2、§3.2、§4.2、§5.2 补充「prompt 须包含落盘路径」要求（AC-3）
- [x] **T4** bmad-story-assistant 强化 speckit 嵌套流程的审计 prompt 模板（AC-4）

### 任务详情（TASKS 原文摘要）

| 任务 | 修改文件 | 修改位置 | 追加内容要点 |
|------|----------|----------|--------------|
| T1 | `skills/speckit-workflow/references/audit-prompts.md` | §1、§2、§3、§4 各节末尾 | 【审计后动作】审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath，并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过），以便主 Agent 调用 parse-and-write-score。 |
| T2 | 同上 | §5 节末尾 | 【审计后动作】审计通过时，请将完整报告保存至调用方指定的 reportPath。implement 阶段的 reportPath 通常为 `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md` 或 `AUDIT_Story_{epic}-{story}_stage4.md`。并在结论中注明保存路径及 iteration_count。 |
| T3 | `skills/speckit-workflow/SKILL.md` | §1.2、§2.2、§3.2、§4.2、§5.2 各「审计通过后评分写入触发」段落内 | 发起审计子任务时，发给子 Agent 的 prompt 必须包含：审计通过后请将报告保存至 {约定路径}，路径由主 Agent 根据 epic、story、slug 填充。 |
| T4 | `skills/bmad-story-assistant/SKILL.md` | STORY-A3-DEV 模板及 speckit 嵌套调用段落；spec/plan/GAPS/tasks 审计的 prompt 模板 | (1) 审计通过后请将报告保存至 specs/epic-{epic_num}/story-{story_num}-{slug}/AUDIT_spec-E{epic_num}-S{story_num}.md（spec）；plan/GAPS/tasks 对应 AUDIT_plan-、AUDIT_GAPS-、AUDIT_tasks-；(2) 在结论中注明保存路径及 iteration_count。 |

---

## 验收命令

```bash
# T1、T2 验收
grep -E "审计后动作|reportPath|iteration_count" skills/speckit-workflow/references/audit-prompts.md

# T3 验收
grep -E "prompt 必须包含|审计通过后请将报告保存至" skills/speckit-workflow/SKILL.md

# T4 验收
grep -E "审计通过后请将报告保存至|iteration_count" skills/bmad-story-assistant/SKILL.md
```

---

## 依赖

- Story 9.3（Epic 级仪表盘聚合）已完成；parse-and-write-score 脚本及 call_mapping 已就绪（Epic 9.1）

---

## 需求追溯

| 来源 | 映射 |
|------|------|
| epics.md §2 Story 9.5 | speckit 全 stage 评分写入规范 |
| TASKS_speckit全stage评分写入改进.md §1 | T1～T4 任务定义与验收标准 |
| DEBATE_speckit全stage评分写入改进_100轮.md §3 | 共识方案（audit-prompts、speckit-workflow、bmad-story-assistant 三处强化） |
| bmad-code-reviewer-lifecycle Skill | 全链路 stage 映射与 parse-and-write-score 触发 |

---

## Dev Notes

- **修改类型**：文档与技能文件修改，无生产代码变更
- **涉及文件**：`skills/speckit-workflow/references/audit-prompts.md`、`skills/speckit-workflow/SKILL.md`、`skills/bmad-story-assistant/SKILL.md`
- **约定路径**（DEBATE §1.3）：spec → `specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md`；plan → `AUDIT_plan-*`；GAPS → `AUDIT_GAPS-*`；tasks → `AUDIT_tasks-*`；implement → `_bmad-output/.../AUDIT_implement-E{epic}-S{story}.md` 或 `AUDIT_Story_{epic}-{story}_stage4.md`
- **禁止词表**：不得使用「可选」「可考虑」「后续」「先实现」「后续扩展」「待定」「酌情」「视情况」「技术债」

### References

- [Source: TASKS_speckit全stage评分写入改进.md §1]
- [Source: DEBATE_speckit全stage评分写入改进_100轮.md §3]
- [Source: epics.md §2 Story 9.5]
- [Source: ANNEX_speckit全stage评分写入改进.md]（同目录）

---

## Dev Agent Record

### Agent Model Used

（实施时填写）

### Debug Log References

（实施时填写）

### Completion Notes List

（实施时填写）

### File List

（实施时填写）
