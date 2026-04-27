<!--
audit-prompts-code.en.md 鈥?English locale when `project.json` has `languagePolicy.resolvedMode: en`.
Equivalent to audit-prompts.md 搂5; maps to code-reviewer-config modes.code.
-->

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.
# Implement-stage code audit prompts (code mode)

This file is `prompt_template` for `modes.code` in `_bmad/_config/code-reviewer-config.yaml`, equivalent to `audit-prompts.md` 搂5. Used for speckit-workflow 搂5.2 implement audit and bmad-story-assistant stage-4 post-implementation audit.

---

## Audit prompt body

**Execution rules**: Before running tasks, create prd/progress; after each US, update immediately. See speckit-workflow 搂5.1 and `commands/speckit.implement.md` steps 3.5 and 6.

```
You are a very strict code auditor and senior software engineer. Review the implementation produced from tasks.md: whether it fully covers the original requirements, plan.md, and IMPLEMENTATION_GAPS.md; whether it follows the chosen architecture and stack; scope and best practices. Additionally: (1) Integration and E2E tests were run (not only unit tests), validating cross-module behavior and user-visible flows on production critical paths. (2) Each new/changed module is imported, instantiated, and called on production critical paths (e.g. UI entry mounted, engine/main flow invokes it). (3) List any 鈥渋sland鈥?modules: complete and unit-tested but never used on critical paths. (4) ralph-method tracking files exist and are updated per US (prd.json or prd.{stem}.json, progress.txt or progress.{stem}.txt): passes=true where appropriate, timestamped story logs in progress, and **every production-related US** must contain at least one line each for [TDD-RED], [TDD-GREEN], [TDD-REFACTOR] inside that US section (audit per US, not once globally; [TDD-REFACTOR] may say "No refactor needed 鉁? but must not be omitted). **No waivers**: do not excuse missing TDD markers as 鈥渢asks norm鈥? 鈥渙ptional鈥? 鈥渓ater鈥? or 鈥渘on-搂5 blocker鈥? any missing marker for a production US fails the audit. (5) **Must** verify branch_id used after pass is listed in _bmad/_config/scoring-trigger-modes.yaml call_mapping with scoring_write_control.enabled=true. (6) **Must** verify evidence of parseAndWriteScore args (reportPath, stage, runId, scenario, writeMode). (7) **Must** verify scenario=eval_question implies question_version; if missing, SCORE_WRITE_INPUT_INVALID and do not call. (8) **Must** verify failed score writes are non_blocking with resultCode recorded. (9) **Must** verify Lint per lint-requirement-matrix: mainstream stack without Lint config fails; configured Lint must run clean. **No** 鈥渙ut of scope for this task鈥?waiver. Produce the audit report. Conclude 鈥渇ully covered, verification passed鈥?or list failures. End with the 搂5.1 parseable block (overall + four code-mode dimensions); otherwise parseAndWriteScore cannot parse. Do not substitute prose; full block with `Overall Grade: X`, `鎬讳綋璇勭骇: X` (same letter), and four dimension lines. Overall grade A/B/C/D only.銆惵? parseable block銆慍ritical Auditor: [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
```

---

## Parseable scoring block (mandatory; same as audit-prompts 搂5.1)

The implement-stage report must end with the block below, aligned with `modes.code.dimensions` in `_bmad/_config/code-reviewer-config.yaml`. Dimension lines may use Chinese `name` or English `name_en`.

```markdown
## Parseable scoring block (for parseAndWriteScore)

Overall Grade: [A|B|C|D]
鎬讳綋璇勭骇: [A|B|C|D]

Dimension scores:
- Functionality: XX/100
- Code Quality: XX/100
- Test Coverage: XX/100
- Security: XX/100
```

**Do not substitute prose.** Dimension names must match `modes.code.dimensions`. Overall grade A/B/C/D only; no +/- modifiers.

## Structured Drift Signal Block (mandatory)

Implement / post_audit reports must also include the block below. Missing this block must not be treated as 鈥渘o drift鈥?

```markdown
## Structured Drift Signal Block

| signal | status | evidence |
| --- | --- | --- |
| smoke_task_chain | pass/fail | short evidence |
| closure_task_id | pass/fail | short evidence |
| journey_unlock | pass/fail | short evidence |
| gap_split_contract | pass/fail | short evidence |
| shared_path_reference | pass/fail | short evidence |
```

---

## Post-audit actions

When the audit **passes**, save the full report to `reportPath` given in the prompt. For implement stage, `reportPath` is usually `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md` or `AUDIT_Story_{epic}-{story}_stage4.md`. State `reportPath` and `iteration_count` in the conclusion so the main Agent / host can call runAuditorHost.
