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
  - code-reviewer: run stage audits; Codex worker dispatch dispatch, pass mode and prompt_template per stage
  - audit-prompts: per-stage audit prompts; audit-prompts-prd.md, audit-prompts-arch.md, etc.
  - code-reviewer-config: multi-mode config (prd/arch/code/pr); _bmad/_config/code-reviewer-config.yaml
  - scoring/rules: parsing rules, item_id, veto_items; scoring/rules/*.yaml
  - runAuditorHost / 统一 auditor host runner: single post-audit entry for score write, auditIndex update, and post-audit automation
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

# bmad-code-reviewer-lifecycle

End-to-end Code Reviewer skill: orchestrates audit → parse → scoring write for each BMAD workflow stage.

## References (Architecture §2.2, §10.2)

| Component | Role | How it is used |
|-----------|------|----------------|
| code-reviewer | Run stage audits | Codex worker dispatch dispatch; pass `mode` and `prompt_template` per stage |
| audit-prompts | Stage audit prompts | audit-prompts-prd.md, audit-prompts-arch.md, etc. |
| code-reviewer-config | Multi-mode config (prd/arch/code/pr) | Read dimensions, pass_criteria by mode |
| scoring/rules | Parsing rules, item_id, veto_items | Map audit output to stage scores |

## Paths

- **code-reviewer**: `.codex/agents/code-reviewer.md` or `.codex/agents/code-reviewer.md`
- **audit-prompts**: `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-prd.md`, `audit-prompts-arch.md`, etc.
- **code-reviewer-config**: `_bmad/_config/code-reviewer-config.yaml`
- **scoring/rules**: `scoring/rules/` (including `default/`, `gaps-scoring.yaml`, `iteration-tier.yaml`)

## Stage mapping and triggers

See `_bmad/_config/stage-mapping.yaml`.

## Report path conventions

See `_bmad/_config/eval-lifecycle-report-paths.yaml` or `_bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`.

## Parse and write (Story 3.3)

This skill uses `runAuditorHost` to close the “audit → host close-out” loop:

- **Function**: `scoring/orchestrator/parse-and-write.ts`
- **CLI**: `scripts/run-auditor-host.ts`
- **Acceptance**: `npm run accept:e3-s3`

## Main-Agent Orchestration Surface (Mandatory)

In interactive mode, this skill must treat repo-native `main-agent-orchestration` as the only orchestration authority. `runAuditorHost` is only the post-audit close-out entry; it must not replace the main Agent's next-branch decision.

Before launching any auditor, remediation subtask, or other bounded execution, the main Agent must:

1. Run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. Read `orchestrationState`, `pendingPacketStatus`, `pendingPacket`, `continueDecision`, `mainAgentNextAction`, and `mainAgentReady`
3. If the next branch is dispatchable but no usable packet exists yet, run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. Dispatch only from the returned packet / instruction instead of continuing from audit prose, scoring prose, or handoff summary alone
5. Re-run `inspect` after each child result and after each `runAuditorHost` close-out before choosing the next global branch

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

## Unified auditor host runner prerequisites (checklist)

After the tasks-stage audit passes and before calling the unified auditor host runner, **confirm**:

1. **Report contains parseable blocks**: The report must end with “总体评级: [A|B|C|D]” and “维度评分: 维度名: XX/100” blocks; otherwise parsing fails and the dashboard shows no rating. See `audit-prompts.md §4.1`, `audit-prompts-critical-auditor-appendix.md §7`.
2. **Line-by-line format**: If the report uses table + conclusions, append the parseable blocks after the conclusions.
3. **Paths**: You may pass `--reportPath` for any report path; the convention is `AUDIT_tasks-E{epic}-S{story}.md`; historical filename variants (e.g. a line-by-line audit suffix in the name) still work via `--reportPath`.


