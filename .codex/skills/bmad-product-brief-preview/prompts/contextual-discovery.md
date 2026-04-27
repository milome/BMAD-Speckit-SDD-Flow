**Language:** Use `{communication_language}` for all output.
**Output Language:** Use `{document_output_language}` for documents.
**Output Location:** `{planning_artifacts}`

# Stage 2: Contextual Discovery

**Goal:** Armed with the user's stated intent, intelligently gather and synthesize all available context — documents, project knowledge, and web research — so later stages work from a rich, relevant foundation.

## Subagent Fan-Out

Now that you know what the brief is about, fan out subagents in parallel to gather context. Each subagent receives the product intent summary so it knows what's relevant.

**Launch in parallel:**

1. **Artifact Analyzer** (`../agents/artifact-analyzer.md`) — Scans `{planning_artifacts}` and `{project_knowledge}` for relevant documents. Also scans any specific paths the user provided. Returns structured synthesis of what it found.

2. **Web Researcher** (`../agents/web-researcher.md`) — Searches for competitive landscape, market context, trends, and relevant industry data. Returns structured findings scoped to the product domain.

3. **Contract Translator** (`../agents/contract-translator.md`) — Converts brief-stage findings into downstream-ready contract hints, especially user evidence, risk wording, and handoff-ready structure when the brief later needs PRD inheritance.

### Graceful Degradation

If subagents are unavailable or fail:
- Read only the most relevant 1-2 documents in the main context and summarize (don't full-read everything — limit context impact in degraded mode)
- Do a few targeted web searches inline
- Never block the workflow because a subagent feature is unavailable

## Synthesis

Once subagent results return (or inline scanning completes):

1. **Merge findings** with what the user already told you
2. **Produce a `Context Digest`** — the strongest local facts that matter for the brief
3. **Produce a `Research Digest`** — the strongest external facts that matter for the brief
4. **Identify `Known Unknowns`** — what do you still need to know to write a solid brief?
5. **Maintain a `Contradiction Log`** — anything from research that contradicts or materially enriches the user's assumptions?
6. **Emit `GateFailure`** if a blocker-level gap prevents continuing, including target artifact, owning role, and what must change before rerun

## Mode-Specific Behavior

**Guided mode:**
- Present a concise summary of what you found: "Here's what I learned from your documents and web research..."
- Make the `Context Digest`, `Research Digest`, `Known Unknowns`, and `Contradiction Log` explicit
- Highlight anything surprising or worth discussing
- Share the gaps you've identified
- If a blocker-level gap exists, present the `GateFailure`, route it to the right reviewer or `contract-translator`, and do not advance until the local gate is rerun
- Ask: "Anything else you'd like to add, or shall we move on to filling in the details?"
- Route to `guided-elicitation.md`

**Yolo mode:**
- Absorb all findings silently
- Skip directly to `draft-and-review.md` — you have enough to draft
- The user will refine later

**Headless mode:**
- Absorb all findings
- Skip directly to `draft-and-review.md`
- No interaction

## Stage Complete

This stage is complete when subagent results (or inline scanning fallback) have returned and findings are merged with user context. Route per mode:
- **Guided** → `guided-elicitation.md`
- **Yolo / Headless** → `draft-and-review.md`
