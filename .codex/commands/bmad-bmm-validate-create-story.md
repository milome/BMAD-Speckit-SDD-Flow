---
name: 'validate-create-story'
description: 'Quality check existing story documents using create-story checklist - identify gaps, prevent LLM dev mistakes, and optionally apply improvements'
disable-model-invocation: false
---

**鍓嶇疆鏉′欢**锛氶渶鏈?Story 鏂囦欢璺緞锛堢敤鎴锋彁渚涙垨浠?sprint-status.yaml 璇诲彇 ready-for-dev 鍒楄〃锛夈€?
**鐢ㄩ€?*锛氬宸茬敓鎴愮殑 Story 鏂囨。鍋氱郴缁熷寲璐ㄩ噺妫€鏌ワ紝瀵圭収 create-story checklist 鍙戠幇鍘?create-story 閬楁紡鐨勯棶棰橈紝闃叉寮€鍙戦樁娈靛嚭鐜帮細閲嶅閫犺疆瀛愩€佺敤閿欏簱銆佹斁閿欐枃浠躲€佺牬鍧忓洖褰掋€佸拷鐣?UX銆佹ā绯婂疄鐜般€佽櫄鍋囧畬鎴愩€佸拷瑙嗗墠缃?Story 缁忛獙绛夈€?
IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. LOAD the full checklist at @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/checklist.md
2. RESOLVE story file(s) to validate:
   - If user provided a path: use it
   - Else: read @{project-root}/_bmad-output/implementation-artifacts/sprint-status.yaml, find all keys where development_status value is "ready-for-dev", resolve to story file paths under implementation_artifacts (epic-X-slug/story-X-Y-slug/X-Y-slug.md)
   - If still no target: ask user to provide story file path(s)
3. For EACH story file: execute the checklist's systematic approach (Steps 1鈥? in checklist.md):
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
