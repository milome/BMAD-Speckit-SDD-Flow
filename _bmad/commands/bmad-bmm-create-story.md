---
name: 'create-story'
description: 'Create the next user story from epics+stories with enhanced context analysis and direct ready-for-dev marking'
disable-model-invocation: true
---

**依赖 Skill**：bmad-story-assistant（Create Story 全流程）；bmad-party-mode（涉及方案选择时）
**安装**：`pwsh scripts/setup.ps1 -Target <项目根>` 或手动复制至 `{SKILLS_ROOT}`
**衔接**：Create Story 产出后须显式触发 `/bmad-bmm-dev-story` 完成 Dev Story 流程

**依赖 Skill**：bmad-story-assistant（Create Story 全流程）；bmad-party-mode（涉及方案选择时）
**安装**：`pwsh scripts/setup.ps1 -Target <项目根>` 或手动复制至 `{SKILLS_ROOT}`
**衔接**：Create Story 产出后须显式触发 `/bmad-bmm-dev-story` 完成 Dev Story 流程

**前置条件**：sprint-planning 为 create-story 的前置条件。sprint-status.yaml 缺失时需先运行 `sprint-planning` 或显式确认 bypass。参见 `bmad-bmm-sprint-planning` 命令。

**Story docs path 豁免**：若用户提供 **story docs path**（greenfield 场景，指向包含 story 文档的文件夹路径），sprint-status 缺失时该路径可放行，作为合法入口；见 TASKS_sprint-planning-gate §2.2 豁免。epic-story 编号（如 2-4）在 sprint-status 缺失时仍须经门控确认。

**产出路径（MANDATORY）**：`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/{epic}-{story}-{slug}.md`。与 bmad-story-assistant 一致；story 子目录仅含 story 编号（`story-{story}-{slug}`），不含 epic 编号。

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL @{project-root}/_bmad/core/tasks/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the specific workflow-config @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml
3. Pass the yaml path @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written to process and follow the specific workflow config and its instructions
5. Save outputs after EACH section when generating any documents from templates
</steps>
