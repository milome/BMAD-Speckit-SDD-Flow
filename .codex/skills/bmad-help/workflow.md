
# Task: BMAD Help

## ROUTING RULES

- **Empty `phase` = anytime** 鈥?Universal tools work regardless of workflow state
- **Numbered phases indicate sequence** 鈥?Phases like `1-discover` 鈫?`2-define` 鈫?`3-build` 鈫?`4-ship` flow in order (naming varies by module)
- **Phase with no Required Steps** - If an entire phase has no required, true items, the entire phase is optional. If it is sequentially before another phase, it can be recommended, but always be clear with the use what the true next required item is.
- **Stay in module** 鈥?Guide through the active module's workflow based on phase+sequence ordering
- **Descriptions contain routing** 鈥?Read for alternate paths (e.g., "back to previous if fixes needed")
- **`required=true` blocks progress** 鈥?Required workflows must complete before proceeding to later phases
- **Artifacts reveal completion** 鈥?Search resolved output paths for `outputs` patterns, fuzzy-match found files to workflow rows

## STATE-AWARE ROUTING

- **`flow` is the user-visible work-type dimension**
- **`sourceMode` stays internal** 鈥?derive user-visible `contextMaturity` from runtime/artifact evidence
- **Use explicit evidence before recommendation** 鈥?derive `implementationReadinessStatus` before any implementation-first suggestion
- **Use the unified gate label `implementation-readiness`** when explaining implementation blocking or readiness repair
- **鏈€澶?1 鍒?2 涓叧閿棶棰?* 鈥?ask only when evidence is insufficient
- **Implementation entry may be `recommended` only when readiness is `ready_clean` or `repair_closed`**
- **`standalone_tasks + high complexity` must upgrade to a story-oriented path**
- **Present routes as `recommended` or `blocked`** 鈥?when the current flow must be upgraded, surface `rerouteRequired` instead of a soft-allowed implementation label

## DISPLAY RULES

## CODEX / MAIN-AGENT FIVE-LAYER FIRST SCREEN

When the user asks how to start, what to run next, or how to use BMAD-Speckit with Codex, surface this first before legacy module/phase rows:

- **Canonical entry**: `bmad-help` -> main-agent orchestration -> five-layer flow.
- **Codex host mode**: Codex is a no-hooks host and must use `cli_ingress` plus dispatch packets, not hook-only shortcuts.
- **Layer 1** `layer_1_intake`: PRD / project intake / context maturity.
- **Layer 2** `layer_2_architecture`: architecture and technical constraints.
- **Layer 3** `layer_3_story`: epics, stories, story audit, readiness.
- **Layer 4** `layer_4_speckit`: `specify -> plan -> gaps -> tasks -> implement`.
- **Layer 5** `layer_5_closeout`: `post_audit -> pr_review -> release_gate -> delivery_truth_gate`.
- **Accepted Codex install command**: `bmad-speckit-init . --agent codex --full --no-package-json`.
- **Accepted Codex runtime command**: `main-agent-orchestration --action run-loop --host codex`.

Do not present Codex as a second-class compatibility branch. If Codex artifacts are missing, recommend repairing installation before continuing.

## PRESENTATION PRIORITY

- **Always lead with recommended skill/workflow**
- **Commands are secondary**
- **Do not open with command cheat sheets**
- **Use workflow language for next steps**

### Command-Based Workflows
When `workflow-file` is a normal file path and `command` field has a value:
- Show the command in backticks as a legacy command entry point

### Skill-Referenced Workflows
When `workflow-file` starts with `skill:`:
- The value is a skill reference (e.g., `skill:bmad-quick-dev-new-preview`), NOT a file path
- Do NOT attempt to resolve or load it as a file path
- Strip the `skill:` prefix and display the real skill name in backticks (e.g., `bmad-create-prd`)
- If `command` is also present, present it only as a legacy/compatibility alias, not as the primary skill name

### Agent-Based Workflows
When `command` field is empty:
- User loads agent first by invoking the agent skill (e.g., `bmad-pm`)
- Then invokes by referencing the `code` field or describing the `name` field
- Do NOT show a slash command 鈥?show the code value and agent load instruction instead

Example presentation for skill/command-based agent:
```text
Explain Concept (EC)
Recommended skill: `bmad-agent-tech-writer`
Skill: `bmad-agent-tech-writer`
Legacy command: `bmad-agent-bmm-tech-writer`, then ask to "EC about [topic]"
Agent: Paige (Technical Writer)
Description: Create clear technical explanations with examples...
```

## OFFICIAL EXECUTION PATHS (BMAD-Speckit-SDD-Flow)

When recommending next steps, **prefer** these skills as the canonical entry points (see `{project-root}/_bmad/_config/bmad-help.csv` and `_bmad/bmm/module-help.csv`):

- **Story lifecycle (Dev Story / DS)** 鈥?Official: **`bmad-story-assistant`** (Create Story 鈫?audit 鈫?Dev Story 鈫?post-audit; integrates **speckit-workflow** and audit-loop iteration). **Not recommended:** invoking **`/bmad-bmm-dev-story`** or the legacy dev-story command / `_bmad/commands/bmad-bmm-dev-story.md` **alone**, which skips that orchestration.
- **Quick Spec / Quick Dev (QS / QD)** 鈥?Official: **`bmad-standalone-tasks`** for TASKS/BUGFIX-style execution (**ralph-method**, TDD, audit-loop iteration). **Not recommended as primary:** **`bmad-bmm-quick-dev`**, **`bmad-bmm-quick-spec`**, **`bmad-agent-bmm-quick-flow-solo-dev`**, or the legacy quick-flow commands alone.
- **BUGFIX** 鈥?Official: **`bmad-bug-assistant`** (party-mode RCA 鈫?BUGFIX doc 鈫?audit 鈫?implementation via subagent).

Always surface these preferences when the user is in the matching phase or asks what to run next.

Always surface these preferences when the user is in the matching phase or asks what to run next.

## MODULE DETECTION

- **Empty `module` column** 鈫?universal tools (work across all modules)
- **Named `module`** 鈫?module-specific workflows

Detect the active module from conversation context, recent workflows, or user query keywords. If ambiguous, ask the user.

## INPUT ANALYSIS

Determine what was just completed:
- Explicit completion stated by user
- Workflow completed in current conversation
- Artifacts found matching `outputs` patterns
- Runtime context / activeScope / `sourceMode` if available
- Latest readiness report / remediation artifact / execution record if available
- If `index.md` exists, read it for additional context
- If still unclear, ask at most **鏈€澶?1 鍒?2 涓叧閿棶棰?*

## EXECUTION

1. **Load catalog** 鈥?Load `{project-root}/_bmad/_config/bmad-help.csv`

2. **Resolve output locations and config** 鈥?Scan each folder under `{project-root}/_bmad/` (except `_config`) for `config.yaml`. For each workflow row, resolve its `output-location` variables against that module's config so artifact paths can be searched. Also extract `communication_language` and `project_knowledge` from each scanned module's config.

3. **Ground in project knowledge** 鈥?If `project_knowledge` resolves to an existing path, read available documentation files (architecture docs, project overview, tech stack references) for grounding context. Use discovered project facts when composing any project-specific output. Never fabricate project-specific details 鈥?if documentation is unavailable, state so.

4. **Read runtime and governance facts when available**
   - runtime context / activeScope
   - latest readiness report
   - remediation artifact
   - rerun / execution closure facts

5. **Detect active module** 鈥?Use MODULE DETECTION above

6. **Analyze input and derive state** 鈥?Task may provide a workflow name/code, conversational phrase, or nothing. Infer what was just completed using INPUT ANALYSIS above, then derive:
   - `flow`
   - `sourceMode`
   - `contextMaturity`
   - `complexity`
   - `implementationReadinessStatus`
   - `currentLayer`
   - `currentStage`
   - `nextRequiredLayer`

   The first screen must be progress-aware. If `helpRouting.fiveLayerProgress` is available, use its `currentLayer/currentStage/nextRequiredLayer` as the primary recommendation source instead of restarting at `layer_1`. The recommendation may show completed layers, but the next required action must point at `nextRequiredLayer` and `currentStage`.

7. **Present recommendations** 鈥?Show next steps based on:
   - Completed workflows detected
   - Phase/sequence ordering (ROUTING RULES)
    - Artifact presence
    - state-aware routing facts

   **Recommended skill/workflow first** 鈥?Lead with the canonical skill or workflow entry the user should run next
   **Optional items first** 鈥?List optional workflows until a required step is reached
   **Required items next** 鈥?List the next required workflow
   **Command quick reference last** 鈥?If commands are worth showing, add them after the recommendation section as compatibility aliases or a short cheat sheet

   For each item, apply DISPLAY RULES above and include:
   - Workflow **name**
   - **Skill** OR **Code + Agent load instruction** (per DISPLAY RULES)
   - If present and helpful, include **Legacy command** as a compatibility alias rather than the primary invocation
   - **Agent** title and display name from the CSV (e.g., "馃帹 Alex (Designer)")
   - Brief **description**
   - where relevant: why it is `recommended`, `blocked`, or `blocked + rerouteRequired`
   - where available: `currentLayer`, `currentStage`, and `nextRequiredLayer`

8. **Additional guidance to convey**:
   - Present all output in `{communication_language}`
   - Run each workflow in a **fresh context window**
   - For **validation workflows**: recommend using a different high-quality LLM if available
   - For conversational requests: match the user's tone while presenting clearly
   - Never recommend implementation-first when `implementationReadinessStatus` is not `ready_clean` or `repair_closed`
   - For `standalone_tasks` with `high complexity`, recommend upgrade instead of preserving the quick path

9. Return to the calling process after presenting recommendations.
