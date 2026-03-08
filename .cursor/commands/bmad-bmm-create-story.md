---
name: 'create-story'
description: 'Create the next user story from epics+stories with enhanced context analysis and direct ready-for-dev marking'
disable-model-invocation: true
---

**前置条件**：sprint-planning 为 create-story 的前置条件。sprint-status.yaml 缺失时需先运行 `sprint-planning` 或显式确认 bypass。参见 `bmad-bmm-sprint-planning` 命令。

**Story docs path 豁免**：若用户提供 **story docs path**（greenfield 场景，指向包含 story 文档的文件夹路径），sprint-status 缺失时该路径可放行，作为合法入口；见 TASKS_sprint-planning-gate §2.2 豁免。epic-story 编号（如 2-4）在 sprint-status 缺失时仍须经门控确认。

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL @{project-root}/_bmad/core/tasks/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the specific workflow-config @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml
3. Pass the yaml path @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written to process and follow the specific workflow config and its instructions
5. Save outputs after EACH section when generating any documents from templates
</steps>
