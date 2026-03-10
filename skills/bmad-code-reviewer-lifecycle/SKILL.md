---
name: bmad-code-reviewer-lifecycle
description: |
  全链路 Code Reviewer Skill：编排 BMAD 工作流各 stage 的审计产出→解析→scoring 写入。
  定义触发时机、stage 映射、报告路径约定；引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules。
  与 speckit-workflow、bmad-story-assistant 协同，stage 审计通过后调用解析并写入 scoring 存储。
when_to_use: |
  Use when: BMAD 工作流各 stage（prd/arch/story/specify/plan/gaps/tasks/implement/post_impl）审计通过后需触发评分解析与写入；
  或 speckit-workflow、bmad-story-assistant 的 stage 完成步骤需调用全链路「解析并写入」逻辑；
  或用户显式请求「全链路评分」时。
references:
  - code-reviewer: 执行各 stage 审计；Cursor Task 调度，按 stage 传 mode 与 prompt_template
  - audit-prompts: 各 stage 审计提示词；audit-prompts-prd.md、audit-prompts-arch.md 等
  - code-reviewer-config: 多模式配置（prd/arch/code/pr）；config/code-reviewer-config.yaml
  - scoring/rules: 解析规则、item_id、veto_items；scoring/rules/*.yaml
  - parseAndWriteScore (Story 3.3): 解析审计报告并写入 scoring 存储；scoring/orchestrator/parse-and-write.ts；CLI scripts/parse-and-write-score.ts、验收 scripts/accept-e3-s3.ts
---

# bmad-code-reviewer-lifecycle

全链路 Code Reviewer Skill，编排 BMAD 工作流各 stage 的审计→解析→scoring 写入闭环。

## 引用关系（Architecture §2.2、§10.2）

| 引用组件 | 职责 | 引用方式 |
|----------|------|----------|
| code-reviewer | 执行各 stage 审计 | Cursor Task 调度，按 stage 传 mode 与 prompt_template |
| audit-prompts | 各 stage 审计提示词 | audit-prompts-prd.md、audit-prompts-arch.md 等 |
| code-reviewer-config | 多模式配置（prd/arch/code/pr） | 按 mode 读取 dimensions、pass_criteria |
| scoring/rules | 解析规则、item_id、veto_items | 用于解析审计产出并映射环节得分 |

## 引用路径

- **code-reviewer**: `.cursor/agents/code-reviewer.md` 或 `.claude/agents/code-reviewer.md`
- **audit-prompts**: `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-prd.md`、`audit-prompts-arch.md` 等
- **code-reviewer-config**: `config/code-reviewer-config.yaml`
- **scoring/rules**: `scoring/rules/`（含 default/、gaps-scoring.yaml、iteration-tier.yaml）

## stage 映射与触发

详见 `config/stage-mapping.yaml`。

## 报告路径约定

详见 `config/eval-lifecycle-report-paths.yaml` 或 `_bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`。

## 解析并写入（Story 3.3）

本 Skill 调用 Story 3.3 的 `parseAndWriteScore` 完成「审计→解析→写入」闭环：
- **函数**：`scoring/orchestrator/parse-and-write.ts`
- **CLI**：`scripts/parse-and-write-score.ts`、`scripts/accept-e3-s3.ts`
- **验收**：`npm run accept:e3-s3`

## parseAndWriteScore 前置条件（Checklist）

tasks 阶段审计通过后、调用 parseAndWriteScore 前，**必须**确认：

1. **报告包含可解析块**：报告结尾须含「总体评级: [A|B|C|D]」与「维度评分: 维度名: XX/100」块，否则解析失败、仪表盘不显示评级。详见 `audit-prompts.md §4.1`、`audit-prompts-critical-auditor-appendix.md §7`、`docs/BMAD/审计报告格式与解析约定.md`。
2. **逐条对照格式**：若报告为逐条对照格式（表格+结论），须在结论后追加上述可解析块。
3. **路径**：可使用 `--reportPath` 指定任意报告路径；约定路径为 `AUDIT_tasks-E{epic}-S{story}.md`，历史命名变体（如含「逐条对照」后缀）亦可通过 `--reportPath` 解析。
