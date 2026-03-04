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

详见 `config/eval-lifecycle-report-paths.yaml` 或 `_bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`。
