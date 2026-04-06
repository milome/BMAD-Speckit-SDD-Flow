<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-code-reviewer-lifecycle
description: |
  End-to-end Code Reviewer skill: orchestrates audit output → parsing → scoring write for each BMAD workflow stage.
  Defines trigger timing, stage mapping, and report path conventions; references code-reviewer, audit-prompts, code-reviewer-config, scoring/rules.
  Works with speckit-workflow and bmad-story-assistant; after a stage audit passes, call parsing and write to scoring storage.
when_to_use: |
  Use when: after any BMAD workflow stage audit (prd/arch/story/specify/plan/gaps/tasks/implement/post_impl) you need score parsing and write;
  or speckit-workflow / bmad-story-assistant stage completion must invoke end-to-end “parse and write” logic;
  or the user explicitly asks for “end-to-end scoring”.
references:
  - code-reviewer: run stage audits; Cursor Task dispatch, pass mode and prompt_template per stage
  - audit-prompts: per-stage audit prompts; audit-prompts-prd.md, audit-prompts-arch.md, etc.
  - code-reviewer-config: multi-mode config (prd/arch/code/pr); _bmad/_config/code-reviewer-config.yaml
  - scoring/rules: parsing rules, item_id, veto_items; scoring/rules/*.yaml
  - parseAndWriteScore (Story 3.3): parse audit report and write scoring storage; scoring/orchestrator/parse-and-write.ts; CLI scripts/parse-and-write-score.ts; acceptance scripts/accept-e3-s3.ts
---

# bmad-code-reviewer-lifecycle

End-to-end Code Reviewer skill: orchestrates audit → parse → scoring write for each BMAD workflow stage.

## References (Architecture §2.2, §10.2)

| Component | Role | How it is used |
|-----------|------|----------------|
| code-reviewer | Run stage audits | Cursor Task dispatch; pass `mode` and `prompt_template` per stage |
| audit-prompts | Stage audit prompts | audit-prompts-prd.md, audit-prompts-arch.md, etc. |
| code-reviewer-config | Multi-mode config (prd/arch/code/pr) | Read dimensions, pass_criteria by mode |
| scoring/rules | Parsing rules, item_id, veto_items | Map audit output to stage scores |

## Paths

- **code-reviewer**: `.cursor/agents/code-reviewer.md` or `.claude/agents/code-reviewer.md`
- **audit-prompts**: `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-prd.md`, `audit-prompts-arch.md`, etc.
- **code-reviewer-config**: `_bmad/_config/code-reviewer-config.yaml`
- **scoring/rules**: `scoring/rules/` (including `default/`, `gaps-scoring.yaml`, `iteration-tier.yaml`)

## Stage mapping and triggers

See `_bmad/_config/stage-mapping.yaml`.

## Report path conventions

See `_bmad/_config/eval-lifecycle-report-paths.yaml` or `_bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`.

## Parse and write (Story 3.3)

This skill calls Story 3.3 `parseAndWriteScore` to close the “audit → parse → write” loop:

- **Function**: `scoring/orchestrator/parse-and-write.ts`
- **CLI**: `scripts/parse-and-write-score.ts`, `scripts/accept-e3-s3.ts`
- **Acceptance**: `npm run accept:e3-s3`

## parseAndWriteScore prerequisites (checklist)

After the tasks-stage audit passes and before calling `parseAndWriteScore`, **confirm**:

1. **Report contains parseable blocks**: The report must end with “总体评级: [A|B|C|D]” and “维度评分: 维度名: XX/100” blocks; otherwise parsing fails and the dashboard shows no rating. See `audit-prompts.md §4.1`, `audit-prompts-critical-auditor-appendix.md §7`.
2. **Line-by-line format**: If the report uses table + conclusions, append the parseable blocks after the conclusions.
3. **Paths**: You may pass `--reportPath` for any report path; the convention is `AUDIT_tasks-E{epic}-S{story}.md`; historical filename variants (e.g. a line-by-line audit suffix in the name) still work via `--reportPath`.
