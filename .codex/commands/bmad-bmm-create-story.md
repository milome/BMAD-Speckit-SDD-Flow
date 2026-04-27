---
name: 'create-story'
description: 'Create the next user story from epics+stories with enhanced context analysis and direct ready-for-dev marking'
disable-model-invocation: true
---

**Required skills**: bmad-story-assistant (full Create Story flow); bmad-party-mode (when design or option trade-offs need party-mode)
**Install**: `pwsh scripts/setup.ps1 -Target <project-root>` or copy manually to `{SKILLS_ROOT}`
**Handoff**: After Create Story output, explicitly invoke `/bmad-bmm-dev-story` to complete the Dev Story flow.

**Prerequisites**: sprint-planning is a prerequisite for create-story. If `sprint-status.yaml` is missing, run `sprint-planning` first or explicitly confirm bypass. See the `bmad-bmm-sprint-planning` command.

**Story docs path exemption**: If the user supplies a **story docs path** (greenfield: a folder path containing story documents), that path may be accepted as a valid entry when sprint-status is missing; authoritative behavior and ordering are in `@{project-root}/_bmad/bmm/workflows/4-implementation/create-story/instructions.xml` step 1 (comments mark the greenfield / 搂2.2-style exemption). Epic鈥搒tory IDs (e.g. 2-4) still require gate confirmation when sprint-status is missing.

**Output path (MANDATORY)**: `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/{epic}-{story}-{slug}.md`. Same as bmad-story-assistant; the story subdirectory contains only the story segment (`story-{story}-{slug}`), not the epic segment.

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL @{project-root}/_bmad/core/tasks/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the specific workflow-config @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml
3. Pass the yaml path @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written to process and follow the specific workflow config and its instructions
5. Save outputs after EACH section when generating any documents from templates
</steps>
