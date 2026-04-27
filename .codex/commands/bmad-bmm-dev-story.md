---
name: 'dev-story'
description: 'Execute a story by implementing tasks/subtasks, writing tests, validating, and updating the story file per acceptance criteria'
disable-model-invocation: true
---

> **Speckit-SDD-Flow:** Prefer the **`bmad-story-assistant`** skill for the full Story lifecycle (Create Story 鈫?audit 鈫?Dev Story 鈫?post-audit). It integrates **speckit-workflow** and audit-loop iteration. Invoking this command **alone** is **not recommended**鈥攗se the skill entry point instead.

**Required skills**: bmad-story-assistant, speckit-workflow
**Install**: `pwsh scripts/setup.ps1 -Target <project-root>` or copy manually to `{SKILLS_ROOT}`
**Handoff**: After Create Story output, explicitly invoke this command to complete the Dev Story flow

**Prerequisite**: sprint-planning precedes dev-story. If sprint-status.yaml is missing, run `sprint-planning` first or supply the Story file path to develop. See the `bmad-bmm-sprint-planning` command.

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL @{project-root}/_bmad/core/tasks/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the specific workflow-config @{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml
3. Pass the yaml path @{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written to process and follow the specific workflow config and its instructions
5. Save outputs after EACH section when generating any documents from templates
</steps>
