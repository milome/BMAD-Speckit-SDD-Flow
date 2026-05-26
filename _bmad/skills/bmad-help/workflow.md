
# Task: BMAD Help

## ROUTING RULES

- **Empty `phase` = anytime** — Universal tools work regardless of workflow state
- **Numbered phases indicate sequence** — Phases like `1-discover` → `2-define` → `3-build` → `4-ship` flow in order (naming varies by module)
- **Phase with no Required Steps** - If an entire phase has no required, true items, the entire phase is optional. If it is sequentially before another phase, it can be recommended, but always be clear with the use what the true next required item is.
- **Stay in module** — Guide through the active module's workflow based on phase+sequence ordering
- **Descriptions contain routing** — Read for alternate paths (e.g., "back to previous if fixes needed")
- **`required=true` blocks progress** — Required workflows must complete before proceeding to later phases
- **Artifacts reveal completion** — Search resolved output paths for `outputs` patterns, fuzzy-match found files to workflow rows

## STATE-AWARE ROUTING

- **`flow` is the user-visible work-type dimension**
- **`sourceMode` stays internal** — derive user-visible `contextMaturity` from runtime/artifact evidence
- **Use explicit evidence before recommendation** — derive `implementationReadinessStatus` before any implementation-first suggestion
- **Use the unified gate label `implementation-readiness`** when explaining implementation blocking or readiness repair
- **Use shared readiness route labels** — use `upstream_planning_readiness`, `speckit_runtime_readiness`, `readiness_help_projection`, `governed_runtime_readiness_gate`, and `readiness_auto_remediation` consistently with `bmad-check-implementation-readiness`
- **最多 1 到 2 个关键问题** — ask only when evidence is insufficient
- **Implementation entry may be `recommended` only when readiness is `ready_clean` or `repair_closed`**
- **`standalone_tasks + high complexity` must upgrade to a story-oriented path**
- **Present routes as `recommended` or `blocked`** — when the current flow must be upgraded, surface `rerouteRequired` instead of a soft-allowed implementation label

## DISPLAY RULES

## DUAL VIEW OUTPUT

- **Governed Runtime Next Step first** — when an active runtime record exists, default output must show `Governed Runtime Next Step` before any upstream catalog details.
- **BMAD Upstream Workflow Catalog on request** — when the user asks for BMAD upstream workflows, a menu, catalog, or upstream BMAD Method compatibility, also show `BMAD Upstream Workflow Catalog`.
- **Catalog is informational under governed runtime** — the upstream catalog is informational unless no governed runtime state exists or the user explicitly chooses upstream planning artifact work.
- **Catalog item status labels** — each upstream item must be labeled as `available`, `blocked by currentMentalModel`, `compatibility only`, or `replaced by project official skill`.
- **Runtime readiness gate label** — when runtime state exists, `Check Implementation Readiness` maps to `governed_runtime_readiness_gate`, not directly to the upstream planning readiness workflow.
- **No remediation execution** — `bmad-help` may explain that `readiness_auto_remediation` is the main Agent lane for blocked runtime readiness, but it must not trigger remediation.
- **No mental model progression** — Only `main_agent_orchestration` and controlled ingest may progress the six mental model chain.

## PRESENTATION PRIORITY

- **Always lead with recommended skill/workflow** — Show the canonical skill or workflow entry first
- **Commands are secondary** — Legacy commands belong in a separate quick-reference section or as compatibility aliases after the recommended entry
- **Do not open with command cheat sheets** — If a skill/workflow recommendation exists, it must appear before any command list
- **Use workflow language for next steps** — Prefer phrases like "推荐 workflow" / "推荐 skill" / "下一步建议" over command-first phrasing

### Command-Based Workflows
When `workflow-file` is a normal file path and `command` field has a value:
- Show the workflow or skill recommendation first, and only then show the command in backticks as a legacy command entry point

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
- Do NOT show a slash command — show the code value and agent load instruction instead

Example presentation for skill/command-based agent:
```
Explain Concept (EC)
Recommended skill: `bmad-agent-tech-writer`
Skill: `bmad-agent-tech-writer`
Legacy command: `bmad-agent-bmm-tech-writer`, then ask to "EC about [topic]"
Agent: Paige (Technical Writer)
Description: Create clear technical explanations with examples...
```

## OFFICIAL EXECUTION PATHS (BMAD-Speckit-SDD-Flow)

When recommending next steps, **prefer** these skills as the canonical entry points (see `{project-root}/_bmad/_config/bmad-help.csv` and `_bmad/bmm/module-help.csv`):

- **Story lifecycle (Dev Story / DS)** — Official: **`bmad-story-assistant`** (Create Story → audit → Dev Story → post-audit; integrates **speckit-workflow** and audit-loop iteration). **Not recommended:** invoking **`/bmad-bmm-dev-story`** or the legacy dev-story command / `_bmad/commands/bmad-bmm-dev-story.md` **alone**, which skips that orchestration.
- **Quick Spec / Quick Dev (QS / QD)** — Official: **`bmad-standalone-tasks`** for TASKS/BUGFIX-style execution (**ralph-method**, TDD, audit-loop iteration). **Not recommended as primary:** **`bmad-bmm-quick-dev`**, **`bmad-bmm-quick-spec`**, **`bmad-agent-bmm-quick-flow-solo-dev`**, or the legacy quick-flow commands alone.
- **BUGFIX** — Official: **`bmad-bug-assistant`** (party-mode RCA → BUGFIX doc → audit → implementation via subagent).

Always surface these preferences when the user is in the matching phase or asks what to run next.

## MODULE DETECTION

- **Empty `module` column** → universal tools (work across all modules)
- **Named `module`** → module-specific workflows

Detect the active module from conversation context, recent workflows, or user query keywords. If ambiguous, ask the user.

## INPUT ANALYSIS

Determine what was just completed:
- Explicit completion stated by user
- Workflow completed in current conversation
- Artifacts found matching `outputs` patterns
- If `index.md` exists, read it for additional context
- If still unclear, ask: "What workflow did you most recently complete?"

## EXECUTION

1. **Load catalog** — Load `{project-root}/_bmad/_config/bmad-help.csv`

2. **Resolve output locations and config** — Scan each folder under `{project-root}/_bmad/` (except `_config`) for `config.yaml`. For each workflow row, resolve its `output-location` variables against that module's config so artifact paths can be searched. Also extract `communication_language` and `project_knowledge` from each scanned module's config.

3. **Ground in project knowledge** — If `project_knowledge` resolves to an existing path, read available documentation files (architecture docs, project overview, tech stack references) for grounding context. Use discovered project facts when composing any project-specific output. Never fabricate project-specific details — if documentation is unavailable, state so.

4. **Detect active module** — Use MODULE DETECTION above

5. **Analyze input** — Task may provide a workflow name/code, conversational phrase, or nothing. Infer what was just completed using INPUT ANALYSIS above.

6. **Present recommendations** — Show next steps based on:
   - Completed workflows detected
   - Phase/sequence ordering (ROUTING RULES)
   - Artifact presence

   **Recommended skill/workflow first** — Lead with the canonical skill or workflow entry the user should run next
   **Optional items first** — List optional workflows until a required step is reached
   **Required items next** — List the next required workflow
   **Command quick reference last** — If commands are worth showing, add them after the recommendation section as compatibility aliases or a short cheat sheet

   For each item, apply DISPLAY RULES above and include:
   - Workflow **name**
   - **Skill** OR **Code + Agent load instruction** (per DISPLAY RULES)
   - If present and helpful, include **Legacy command** as a compatibility alias rather than the primary invocation
   - **Agent** title and display name from the CSV (e.g., "🎨 Alex (Designer)")
   - Brief **description**

7. **Additional guidance to convey**:
   - Present all output in `{communication_language}`
   - Run each workflow in a **fresh context window**
   - For **validation workflows**: recommend using a different high-quality LLM if available
   - For conversational requests: match the user's tone while presenting clearly

8. Return to the calling process after presenting recommendations.
