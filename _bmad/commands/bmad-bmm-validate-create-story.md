---
name: 'validate-create-story'
description: 'Quality check existing story documents using create-story checklist - identify gaps, prevent LLM dev mistakes, and optionally apply improvements'
disable-model-invocation: false
---

**前置条件**：需有 Story 文件路径（用户提供或从 sprint-status.yaml 读取 ready-for-dev 列表）。

**用途**：对已生成的 Story 文档做系统化质量检查，对照 create-story checklist 发现原 create-story 遗漏的问题，防止开发阶段出现：重复造轮子、用错库、放错文件、破坏回归、忽略 UX、模糊实现、虚假完成、忽视前置 Story 经验等。

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. LOAD the full checklist at @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/checklist.md
2. RESOLVE story file(s) to validate:
   - If user provided a path: use it
   - Else: read @{project-root}/_bmad-output/implementation-artifacts/sprint-status.yaml, find all keys where development_status value is "ready-for-dev", resolve to story file paths under implementation_artifacts (epic-X-slug/story-X-Y-slug/X-Y-slug.md)
   - If still no target: ask user to provide story file path(s)
3. For EACH story file: execute the checklist's systematic approach (Steps 1–8 in checklist.md):
   - Step 1: Load workflow.yaml from create-story for variable context (epics_file, architecture_file, etc.)
   - Step 2: Exhaustive source document analysis (epics, architecture, previous story if story_num > 1, git history, tech research)
   - Step 3: Disaster prevention gap analysis (reinvention, tech spec, file structure, regression, implementation)
   - Step 4: LLM-Dev-Agent optimization analysis (verbosity, ambiguity, context overload, structure)
   - Step 5: Improvement recommendations (Critical / Enhancement / Optimization / LLM optimization)
   - Step 6: Present findings interactively (critical issues, enhancements, optimizations, LLM optimizations)
   - Step 7: On user acceptance: apply improvements to story file (natural wording, no "added" references)
   - Step 8: Confirm and suggest next steps (dev-story)
4. Output format: use checklist's "Step 5: Present Improvement Suggestions" format
5. All outputs in {communication_language} per _bmad/bmm/config.yaml
</steps>
