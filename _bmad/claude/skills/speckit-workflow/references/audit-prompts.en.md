<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.
# Audit prompts (fixed templates, copy-paste)

**Report save anti-loop**: When the prompt includes “report save” or “save the full report to”, it **must** also forbid repeating status lines such as “writing full audit report”. See [audit-report-save-rules.md](audit-report-save-rules.md).

After generating or updating stage artifacts, you **must** invoke **code-review** using the matching prompt below. **Only when** the audit conclusion is **“fully covered, verification passed”** may you finish the step; otherwise revise the artifact from the report and re-audit.

**Document audit iteration (§1–§4)**: Document audits for spec/plan/GAPS/tasks **must** follow [audit-document-iteration-rules.md](audit-document-iteration-rules.md). **When the audit subagent finds a gap, it must edit the audited document directly**; do not only suggest edits. The main Agent starts the next audit round after receiving the report. **“Three consecutive rounds with no gap” applies to the audited document**: convergence means three consecutive audits of that document with no new gap.

---

## 1. spec.md audit prompt

```
You are a very strict code auditor. Review whether the current spec.md fully covers every section of the original requirements/design document; check and verify item by item. If the spec contains ambiguous wording (unclear requirements, undefined edge cases, ambiguous terms, etc.), the report must explicitly flag “spec has ambiguous wording” and cite locations so the clarify flow can run. Produce an audit report that lists each check, how it was verified, and the result. The report must end with a clear conclusion: whether it is “fully covered, verification passed”; if not, list missing sections, uncovered points, or ambiguous locations. The end of the report must include the parseable scoring block required by §4.1 (overall grade + dimension scores), same as the tasks stage; otherwise parseAndWriteScore cannot parse it and the dashboard will not show grades. Do not substitute prose for the structured block: never summarize with text like “parseable block (overall X, dimensions Y–Z)”; you must output the full structured block, including one line `Overall Grade: X` and one line `总体评级: X` (same letter on both lines) and four lines `- dimension name: XX/100`. Overall grade must be only A/B/C/D (no A-, B+, C+, D-, etc.). Dimension scores must be on separate lines, no ranges or summaries. [§1 parseable block requirement] Also run the Critical Auditor checklist; output format: [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
```

**[Post-audit actions]** When the audit **passes**, **you (audit subagent) must**: (1) Append `<!-- AUDIT: PASSED by code-reviewer -->` to the end of the audited document (artifactDocPath → spec-E{epic}-S{story}.md); skip if that line or `<!-- AUDIT: PASSED` already exists. (2) Save the full report to reportPath given in this prompt and state reportPath and iteration_count in the conclusion (failed rounds for this stage; 0 = passed first time). **Before returning to the main Agent, return `projectRoot`, `reportPath`, `artifactDocPath`, and `stage` so the invoking host/runner can call `runAuditorHost`.** On pass, the host/runner uses: `npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage <stage> --artifactPath <artifactDocPath> --reportPath <reportPath> --iterationCount {累计值}`; placeholders come from this prompt or the caller; on failure note resultCode in the conclusion. **Forbidden**: Do not stream status lines like “writing full audit report” or “saving”; write once with the write tool. **When the audit does not pass**: **directly edit the audited document** in this round to close gaps, then note what changed in the report; the main Agent starts the next audit. Do not only suggest edits. See [audit-document-iteration-rules.md](audit-document-iteration-rules.md).

---

## 2. plan.md audit prompt

```
You are a very strict code auditor. Review whether the current plan.md fully covers every section of the original requirements/design document; verify item by item. Additionally, explicitly check: whether plan.md includes a full integration and end-to-end test plan (cross-module behavior, production critical paths, user-visible flows), whether it relies on unit tests only without integration/E2E plans, and whether any module could be fully implemented internally but never imported or called from production critical paths. Produce an audit report listing each check, verification method, and result. End with whether it is “fully covered, verification passed”; if not, list missing sections or uncovered points. The end must include the §4.1 parseable scoring block (overall grade + dimension scores), same as tasks; otherwise parseAndWriteScore cannot parse and the dashboard will not show grades. Do not substitute prose for the structured block; output the full block with one line `Overall Grade: X`, one line `总体评级: X` (same letter), and four `- dimension: XX/100` lines. Overall grade only A/B/C/D (no +/- modifiers). Dimension scores line-by-line, no ranges. [§2 parseable block requirement] Also run the Critical Auditor checklist; format: [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
```

**[Post-audit actions]** When the audit **passes**, **you (audit subagent) must**: (1) Append `<!-- AUDIT: PASSED by code-reviewer -->` to plan-E{epic}-S{story}.md if absent. (2) Save the full report to reportPath; state reportPath and iteration_count. **Return `projectRoot`, `reportPath`, `artifactDocPath`, and `stage` before return so the invoking host/runner can call `runAuditorHost`.** On pass: `npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage <stage> --artifactPath <artifactDocPath> --reportPath <reportPath> --iterationCount {累计值}`; on failure note resultCode. **Forbidden**: no repeated “writing/saving” status output. **On fail**: edit the audited document in-round; main Agent re-audits. See [audit-document-iteration-rules.md](audit-document-iteration-rules.md).

---

## 3. IMPLEMENTATION_GAPS.md audit prompt

```
You are a very strict code auditor. Review whether IMPLEMENTATION_GAPS.md fully covers every section of the original requirements/design document and all reference documents the user supplied (architecture, design notes, etc.); verify item by item. Produce an audit report listing checks, verification, and results. End with whether it is “fully covered, verification passed”; if not, list gaps. The end must include the §4.1 parseable scoring block; otherwise parseAndWriteScore cannot parse. Do not substitute prose; output the full block with `Overall Grade: X`, `总体评级: X` (same letter), and four dimension lines `XX/100`. Overall grade only A/B/C/D. Dimension scores line-by-line. [§3 parseable block requirement] Also run the Critical Auditor checklist: [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
```

**[Post-audit actions]** Same pattern as §1–§2: append pass marker to IMPLEMENTATION_GAPS-E{epic}-S{story}.md, save report, run `npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage <stage> --artifactPath <artifactDocPath> --reportPath <reportPath> --iterationCount {累计值}`. No status spam on save. On fail, edit document in-round. [audit-document-iteration-rules.md](audit-document-iteration-rules.md).

---

## 4. tasks.md audit prompt

**Parseable scoring block (mandatory)**: Whether you use the standard layout or line-by-line checklist format, the tasks-stage report **must** end with a block parseable by `parseAndWriteScore`; otherwise the dashboard will not show grades. See §4.1 below and the scoring parser contract.

```
You are a very strict code auditor. Review whether tasks.md fully covers the original requirements document, plan.md, and IMPLEMENTATION_GAPS.md; verify item by item. Additionally: (1) Every functional module/Phase must include integration and E2E tasks and cases—unit tests alone are not enough. (2) Every module’s acceptance criteria must include integration verification that the module is imported, instantiated, and called on the production critical path. (3) Flag “island” tasks: module complete and unit-tested but never imported/instantiated/called on the production critical path. (4) Every task or global acceptance must include running Lint per stack (see lint-requirement-matrix): if the stack is mainstream and Lint is not configured, treat as a gap; if configured, it must run clean (no errors/warnings). Produce the audit report. End with “fully covered, verification passed” or not; if not, list missing sections or points. **Regardless of format, the report must end with the §4.1 parseable block.** Do not substitute prose; output the full structured block with `Overall Grade: X`, `总体评级: X` (same letter), and four `- dimension: XX/100` lines. Overall grade A/B/C/D only. Also run the Critical Auditor checklist: [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
```

### §4.1 tasks audit report — parseable scoring block (mandatory)

All tasks-stage reports (including line-by-line checklist style) **must** end with the following parseable block for `parseAndWriteScore` (`scoring/orchestrator/parse-and-write.ts`, `scripts/parse-and-write-score.ts`). **No prose substitute**; emit the full structure. Overall grade A/B/C/D only. One score per dimension on its own line.

**Parser note**: `extractOverallGrade` accepts either `Overall Grade:` or `总体评级:` (same letter on both if you output both). Dimension lines must match `name` or `name_en` in `code-reviewer-config.yaml` mode `prd` (below uses English `name_en` values).

```markdown
## Parseable scoring block (for parseAndWriteScore)

Overall Grade: [A|B|C|D]
总体评级: [A|B|C|D]

Dimension scores:
- Requirements Completeness: XX/100
- Testability: XX/100
- Consistency: XX/100
- Traceability: XX/100
```

**Do not substitute prose** for the block: no summaries like “parseable block (overall A, …)”. You must output **both** overall lines (`Overall Grade:` and `总体评级:`) with the **same** A/B/C/D, plus four `- dimension: XX/100` lines. **No B+, A-, C+, D-**; if between two grades, pick A or B only. No ranges like “92–95” or “all 90+”.

**Invalid examples**:
- A sentence summarizing the block — not parseable by parseDimensionScores
- `Overall Grade: A-` / `总体评级: B+` — extractOverallGrade expects plain A/B/C/D
- Ranges without four named dimension lines

**Suggested mapping** (for auditors):

| Checklist conclusion | Suggested overall | Suggested dimension band |
|----------------------|-------------------|---------------------------|
| Fully covered, passed | A | 90+ |
| Partially covered, minor issues | B | 80+ |
| Must revise and re-audit | C | 70+ |
| Serious issues, fail | D | 60 or below |

**[Post-audit actions]**On pass: append `<!-- AUDIT: PASSED by code-reviewer -->` to tasks-E{epic}-S{story}.md; save report to reportPath; run `npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage <stage> --artifactPath <artifactDocPath> --reportPath <reportPath> --iterationCount {累计值}`. No save status spam. On fail, edit tasks doc in-round. [audit-document-iteration-rules.md](audit-document-iteration-rules.md).

---

## 5. Post–tasks.md execution (TDD red/green/refactor) audit prompt

**Execution rules**: Before running tasks, create prd/progress; after each US, update immediately. See speckit-workflow §5.1, `commands/speckit.implement.md` steps 3.5 and 6.

```
You are a very strict code auditor and senior software engineer. Review the implementation produced from tasks.md: whether it fully covers the original requirements, plan.md, and IMPLEMENTATION_GAPS.md; whether it follows the chosen architecture and stack; scope and best practices. Additionally: (1) Integration and E2E tests were run (not only unit tests), validating cross-module behavior and user-visible flows on production critical paths. (2) Each new/changed module is imported, instantiated, and called on production critical paths (e.g. UI entry mounted, engine/main flow invokes it). (3) List any “island” modules: complete and unit-tested but never used on critical paths. (4) ralph-method tracking files exist and are updated per US (prd.json or prd.{stem}.json, progress.txt or progress.{stem}.txt): passes=true where appropriate, timestamped story logs in progress, and **every production-related US** must contain at least one line each for [TDD-RED], [TDD-GREEN], [TDD-REFACTOR] inside that US section (audit per US, not once globally; [TDD-REFACTOR] may say "No refactor needed ✓" but must not be omitted). **No waivers**: do not excuse missing TDD markers as “tasks norm”, “optional”, “later”, or “non-§5 blocker”; any missing marker for a production US fails the audit. (5) **Must** verify branch_id used after pass is listed in _bmad/_config/scoring-trigger-modes.yaml call_mapping with scoring_write_control.enabled=true. (6) **Must** verify evidence of parseAndWriteScore args (reportPath, stage, runId, scenario, writeMode). (7) **Must** verify scenario=eval_question implies question_version; if missing, SCORE_WRITE_INPUT_INVALID and do not call. (8) **Must** verify failed score writes are non_blocking with resultCode recorded. (9) **Must** verify Lint per lint-requirement-matrix: mainstream stack without Lint config fails; configured Lint must run clean. **No** “out of scope for this task” waiver. Produce the audit report. Conclude “fully covered, verification passed” or list failures. End with the §5.1 parseable block (overall + four code-mode dimensions); otherwise parseAndWriteScore cannot parse. Do not substitute prose; full block with `Overall Grade: X`, `总体评级: X` (same letter), and four dimension lines. Overall grade A/B/C/D only.【§5 parseable block】Critical Auditor: [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
```

### §5.1 Implement-stage parseable scoring block (mandatory)

The implement-stage report must end with the block below, aligned with `modes.code.dimensions` in `_bmad/_config/code-reviewer-config.yaml`. **Parser note**: dimension names may be Chinese `name` or English `name_en` from config; example uses English.

```markdown
## Parseable scoring block (for parseAndWriteScore)

Overall Grade: [A|B|C|D]
总体评级: [A|B|C|D]

Dimension scores:
- Functionality: XX/100
- Code Quality: XX/100
- Test Coverage: XX/100
- Security: XX/100
```

**Do not substitute prose.** Dimension names must match `modes.code.dimensions` (`name` or `name_en`). Overall grade A/B/C/D only; no +/- modifiers. No score ranges.

implement / post_audit reports must also include `## Structured Drift Signal Block` with the fixed columns `signal | status | evidence`. The five fixed signals are `smoke_task_chain`, `closure_task_id`, `journey_unlock`, `gap_split_contract`, and `shared_path_reference`. Missing this block must not be treated as “no drift”.

**Invalid examples** (see also §4.1): prose summary of the block; `A-`/`B+`; ranges without four named lines; parseDimensionScores(mode=code) misses malformed lines.

**[Post-audit actions]**On pass: save full report to reportPath (typically `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md` or `AUDIT_Story_{epic}-{story}_stage4.md`). State reportPath and iteration_count. **Before return, provide `projectRoot`, `reportPath`, `artifactDocPath`, and `stage` so the invoking host/runner can call `runAuditorHost`:** `npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage <stage> --artifactPath <artifactDocPath> --reportPath <reportPath> --iterationCount {累计值}`. On failure note resultCode. **Forbidden**: repeated “writing/saving” status lines.

