---
name: "bmad-eval-analytics"
description: "bmad-eval-analytics: trigger Coach diagnostics or SFT extraction from natural language. Coach: when the user asks to see weak points, the latest Coach report, a diagnosis, or scoring gaps, run `npx bmad-speckit coach` and show the output. Shares the script with the /bmad-coach command. SFT: when the user asks to extract a fine-tuning dataset, generate SFT training data, or generate SFT data, run `npx bmad-speckit sft-extract` and show a summary. Shares the script with the /bmad-sft-extract comma"
---

# bmad-eval-analytics skill

This skill lets the agent run the right scripts when the user asks in natural language about evaluation gaps, Coach reports, or SFT dataset extraction.

## When to use

**Coach diagnostics** — trigger when the user says any of the following (or close paraphrases):

- “show my weak points” / “what are my scoring gaps”
- “latest Coach report” / “last Coach output”
- “diagnose my scores” / “run Coach diagnosis”
- “analyze my evaluation scores”

**SFT extraction** — trigger when the user says any of the following (or close paraphrases):

- “extract fine-tuning dataset”
- “generate SFT training data”
- “generate SFT data” / “run SFT extract”

## Execution

1. **Detect trigger**: user message matches Coach or SFT intent.
2. **Coach branch**: if Coach → run `npx bmad-speckit coach` → show output (Markdown or JSON).
3. **SFT branch**: if SFT → run `npx bmad-speckit sft-extract` → show script summary.

**Reuse note**:

- This skill does not implement discovery, Coach, or SFT logic; it reuses `scripts/coach-diagnose.ts` and `scripts/sft-extract.ts`.
- Coach: without `--run-id`, the script uses `discoverLatestRunId` for the latest timestamp; by default it diagnoses `scenario=real_dev`; same as `/bmad-coach`. For `eval_question` samples, pass `--scenario eval_question` explicitly.
- SFT: same as `/bmad-sft-extract` via `npx bmad-speckit sft-extract`; supports `--output`, `--min-score` (default 90, cannot be below 90).

## Acceptance

**Coach**:

- When score data exists: output the Coach diagnostic report (Markdown).
- When no score data: state that there is no score data yet and the user should complete at least one Dev Story run first.

**SFT**:

- `npx bmad-speckit sft-extract` completes successfully; output includes a summary such as “extracted N items, covering M stories; skipped K (reason: …)” or equivalent.
