<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-standalone-tasks-doc-review
description: |
  Strict audit for TASKS / TASKS-like documents (TASKS_*.md, tasks-E*.md): Critical Auditor >70%, 3-round no-gap convergence, and the audit subagent must edit the audited document when gaps are found. Use when: (1) The user requests an audit of a TASKS document with strict convergence, (2) “Run an audit subtask on {doc path}” or “TASKS document audit”, (3) Pre-implementation document quality gate. Supports code-reviewer (Cursor Task) or mcp_task generalPurpose fallback. Follows audit-document-iteration-rules.
---

# BMAD standalone tasks document audit

Run a strict audit on `TASKS_*.md`, `tasks-E*.md`, and similar task documents. Requires Critical Auditor >70%, three consecutive rounds with no new gap, and the audit subagent must **directly edit** the audited document when gaps are found.

**Orphan TASKS doc-review closeout contract**: when the audited document lives under `_orphan/`, the structured audit report must explicitly provide `stage=standalone_tasks`, `artifactDocPath`, and `reportPath`. Missing any field, returning `stage=document`, or relying on prose-only `PASS` must not count as authoritative closeout.

## When to use

- The user gives a document path and asks to launch an audit subtask
- Quality gate before implementing a TASKS document
- Document audit that must reach “full coverage, verified pass” with 3-round no-gap convergence

## Main-Agent Orchestration Surface (Mandatory)

In interactive mode, this skill must treat repo-native `main-agent-orchestration` as the only orchestration authority. `runAuditorHost` is only the post-audit close-out entry; it must not replace the main Agent's next-branch decision.

Before launching any audit subtask, remediation subtask, or other bounded execution, the main Agent must:

1. Run `npm run main-agent-orchestration -- --cwd {project-root} --action inspect`
2. Read `orchestrationState`, `pendingPacketStatus`, `pendingPacket`, `continueDecision`, `mainAgentNextAction`, and `mainAgentReady`
3. If the next branch is dispatchable but no usable packet exists yet, run `npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan`
4. Dispatch only from the returned packet / instruction instead of continuing from audit prose or document-review prose alone
5. Re-run `inspect` after each child result and after each `runAuditorHost` close-out before choosing the next global branch

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

## Mandatory constraints

| Constraint | Description |
|------------|-------------|
| Critical Auditor | Must participate; speaking share **>70%** |
| Convergence | **Three consecutive rounds with no new gap** (on the audited document) |
| When a gap is found | **The audit subagent must edit the audited document in the same round**; suggestions-only is forbidden |
| Subagent type | Prefer code-reviewer; if unavailable use `mcp_task` + `subagent_type: generalPurpose` |

## Workflow

1. **Resolve document path**: From user input, get `{document-path}` (e.g. `_bmad-output/implementation-artifacts/_orphan/TASKS_xxx.md`).
2. **Determine requirements baseline**: If the TASKS doc header has a `reference` (or equivalent) field pointing to a baseline document, read that document as the baseline; otherwise the TASKS doc is self-contained (then `{baseline-path}` is the audited doc path).
3. **Launch audit**: Copy the full prompt from [references/audit-prompt-tasks-doc.md](references/audit-prompt-tasks-doc.md), replace `{document-path}`, `{baseline-path}`, `{project-root}`, `{report-path}`, `{round}`; the **report save** section must say that **every round’s report (pass or fail) is saved to `{report-path}`**, consistent with step 7 (if the template says “only when audit passes”, override it).
4. **Subagent choice**: Prefer Cursor Task → code-reviewer; if code-reviewer is unavailable (no Task, failure, timeout), use `mcp_task` + `subagent_type: generalPurpose`.
5. **Convergence check**: After each report, if the verdict is pass and the Critical Auditor states “no new gap this round” → `consecutive_pass_count + 1`; otherwise reset to 0. **Pass** means the conclusion contains “完全覆盖、验证通过” or “通过”; Critical Auditor section contains “本轮无新 gap”, “无新 gap”, or “无 gap”.
6. **Iterate**: Until 3 no-gap rounds, launch the next audit on the updated document. **No infinite loops**: when `consecutive_pass_count >= 3`, **stop immediately**; **max 10 rounds**, then force-stop with “max rounds reached—manual review required”.
7. **Persist reports**: Every round’s report (pass or fail) must be saved to `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_{slug}_§4_round{N}.md`; the main Agent must state this in the subagent prompt. **Note**: saving reports is the subagent’s job; the main Agent **only** checks convergence—do not re-launch audits just to “save reports”.

## References

- **audit-document-iteration-rules**: `.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md`
- **audit-prompts §4**: `.cursor/skills/speckit-workflow/references/audit-prompts.md` §4 (main TASKS document audit flow)
- **audit-prompts §5**: `.cursor/skills/speckit-workflow/references/audit-prompts.md` §5 (mode B post-implementation audit)
- **audit-prompts-critical-auditor-appendix**: `.cursor/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
- **audit-post-impl-rules**: `.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md` (mode B convergence rules)

## Mandatory parseable scoring block

Main flow (TASKS document audit) reports must end with:

```markdown
## 可解析评分块（供 parseAndWriteScore）
总体评级: [A|B|C|D]
维度评分:
- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

Mode B (post-implementation audit) dimensions differ; see audit-prompts §5.1 (functionality, code quality, test coverage, security).

## Mode B: post-implementation audit (§5)

When the user audits **implementation results** (code, prd, progress), use audit-prompts §5. Then:

- The audited object is code/implementation, not the TASKS doc alone
- Gaps are fixed by the **implementation** subagent, not the audit subagent
- Convergence rules: `.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`

See [references/audit-prompt-impl.md](references/audit-prompt-impl.md).
