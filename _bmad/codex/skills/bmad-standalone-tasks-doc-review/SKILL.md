---
name: bmad-standalone-tasks-doc-review
description: |
  Codex CLI / OMC adapter entry for BMAD standalone TASKS document audit.
  Uses Cursor bmad-standalone-tasks-doc-review as the semantic baseline for strict TASKS document quality gates.
  Critical Auditor >70%, three consecutive rounds with no new gap; the audit subagent must edit the audited document when gaps are found.
  When the main Agent launches an audit subtask, it **must** copy the full prompt template from this skill and fill placeholders鈥攏o omission, summary, or paraphrase.
  Prefer `.codex/agents/auditors/auditor-tasks-doc`; follow the fallback chain.
  Use when: TASKS document audit, 鈥渁udit subtask on {path}鈥? or pre-implementation quality gate.
when_to_use: |
  Use when: (1) the user requests a strict TASKS document audit, (2) 鈥渁udit subtask on {document path}鈥?or 鈥淭ASKS document audit鈥? (3) pre-implementation document quality gate.
references:
  - auditor-tasks-doc: TASKS doc audit executor; `.codex/agents/auditors/auditor-tasks-doc.md`
  - auditor-document: document audit executor; `.codex/agents/auditors/auditor-document.md`
  - audit-document-iteration-rules: `.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - audit-prompts: `.codex/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-critical-auditor-appendix: `.codex/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
  - audit-post-impl-rules: `.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - prompt-template-tasks-doc: `.codex/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md`
  - prompt-template-impl: `.codex/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-impl.md`
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

> **Orphan TASKS doc-review closeout contract**: when the audited document lives under `_orphan/`, the structured audit report must explicitly provide `stage=standalone_tasks`, `artifactDocPath`, and `reportPath`. Missing any field, returning `stage=document`, or relying on prose-only `PASS` must not count as authoritative closeout.

# Codex adapter: bmad-standalone-tasks-doc-review

## Purpose

This skill is the unified Codex CLI / OMC entry for Cursor `bmad-standalone-tasks-doc-review`.

The goal is **not** to blindly copy the Cursor skill, but to:

1. **Inherit validated TASKS document audit semantics** (resolve path 鈫?baseline 鈫?subagent audit 鈫?convergence 鈫?iterate)
2. **Map executors to `.codex/agents/`** (`auditor-tasks-doc`, `auditor-document`)
3. **Integrate** handoff, scoring, and commit gate
4. **Ensure** Codex CLI can run TASKS document audits end-to-end

## Host Guard锛堝繀椤诲厛鎵ц锛?
鑻ュ綋鍓嶅疄闄呭涓绘槸 **Cursor IDE**锛屾垨璋冪敤涓婁笅鏂囨槑鏄句娇鐢?Cursor 渚т换鍔¤涔夛紙渚嬪 Cursor 鍘熺敓浠诲姟杞借嵎鎴?Cursor 涓撶敤鎵ц鍣級锛屽垯锛?
1. **绔嬪嵆鍋滄**鏈?Codex adapter 鐨勫悗缁墽琛?2. 杈撳嚭浠ヤ笅鍥哄畾鎻愮ず锛?
```text
HOST_MISMATCH: 褰撳墠璇姞杞戒簡 Claude 鐗?bmad-standalone-tasks-doc-review锛屼絾瀹為檯瀹夸富鏄?Cursor銆傝鏀圭敤 ``.codex`/skills/bmad-standalone-tasks-doc-review/SKILL.md`銆?```

3. **绂佹**缁х画鎵ц鏈?Codex adapter 鐨?Fallback 闄嶇骇閫昏緫

鍙湁鍦?**Codex CLI / OMC** 瀹夸富涓紝鎵嶅厑璁哥户缁墽琛屾湰鏂囦欢鍚庣画鍐呭銆?
---

## Core acceptance criteria

The Claude variant must:

- Act as the **TASKS document audit entry** for Codex CLI, unifying parse 鈫?audit 鈫?convergence
- Keep executor selection, fallback, and scoring write aligned with Cursor
- Integrate:
  - `auditor-tasks-doc` executor
  - Unified auditor host runner (`runAuditorHost`)
  - Handoff protocol
- **Not** mix Codex Canonical Base, Claude Runtime Adapter, and Repo Add-ons into unclear prompt rewrites

## Main-Agent Orchestration Surface (mandatory)

In interactive mode, this skill must treat repo-native `main-agent-orchestration` as the only orchestration authority. `runAuditorHost` is only the post-audit close-out entry; it must not replace the main Agent's next-branch decision.

Before launching any TASKS doc-review audit subtask, remediation subtask, or other bounded execution, the main Agent must:

1. Run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. Read `orchestrationState`, `pendingPacketStatus`, `pendingPacket`, `continueDecision`, `mainAgentNextAction`, and `mainAgentReady`
3. If the next branch is dispatchable but no usable packet exists yet, run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. Dispatch only from the returned packet / instruction instead of continuing from audit prose or document-review prose alone
5. Re-run `inspect` after each child result and after each `runAuditorHost` close-out before choosing the next global branch

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

## Host Guard锛堝繀椤诲厛鎵ц锛?
鑻ュ綋鍓嶅疄闄呭涓绘槸 **Cursor IDE**锛屾垨璋冪敤涓婁笅鏂囨槑鏄句娇鐢?Cursor 渚т换鍔¤涔夛紙渚嬪 Cursor 鍘熺敓浠诲姟杞借嵎銆丆ursor 涓撶敤鎵ц鍣紝鎴栬皟鐢ㄦ柟鏄庣‘璇粹€滃湪 Cursor 瀹夸富涓墽琛屸€濓級锛屽垯锛?
1. **绔嬪嵆鍋滄**鏈?Codex adapter 鐨勫悗缁墽琛?2. 杈撳嚭浠ヤ笅鍥哄畾鎻愮ず锛?
```text
HOST_MISMATCH: 褰撳墠璇姞杞戒簡 Claude 鐗?bmad-standalone-tasks-doc-review锛屼絾瀹為檯瀹夸富鏄?Cursor銆傝鏀圭敤 ``.codex`/skills/bmad-standalone-tasks-doc-review/SKILL.md`銆?```

3. **绂佹**缁х画鎵ц鏈?Codex adapter 鐨?`L1/L2/L3/L4` Fallback 闄嶇骇閫昏緫

---

## Three-layer architecture

### Layer 1: Codex Canonical Base

> Inherits all validated semantics from Cursor `bmad-standalone-tasks-doc-review`

#### When to use

- User specifies a document path and asks for an audit subtask
- Quality gate before implementing a TASKS document
- Audit that must reach 鈥渇ull coverage, verified pass鈥?with 3-round no-gap convergence

#### Mandatory constraints

| Constraint | Description |
|------------|-------------|
| Critical Auditor | Must participate; speaking share **>70%** |
| Convergence | **Three consecutive rounds with no new gap** (on the audited document) |
| When a gap is found | **Audit subagent must edit the audited document in the same round**; suggestions-only forbidden |
| Max rounds | **10**; then force-stop with 鈥渕ax rounds reached鈥攎anual review鈥?|

#### Workflow

1. **Resolve document path** from user input (`{document-path}`, e.g. `_bmad-output/implementation-artifacts/_orphan/TASKS_xxx.md`).
2. **Baseline**: If the TASKS header has a reference field, read it as baseline; else the TASKS doc is self-contained (`{baseline-path}` = audited path).
3. **Launch audit**: Copy the full prompt from [references/audit-prompt-tasks-doc.md](references/audit-prompt-tasks-doc.md), replace `{document-path}`, `{baseline-path}`, `{project-root}`, `{report-path}`, `{round}`; the **report save** section must say **every round鈥檚 report (pass or fail) is saved to `{report-path}`**.
4. **Subagent choice**: Follow fallback strategy (Layer 2).
5. **Convergence**: If verdict is pass and Critical Auditor says 鈥渘o new gap this round鈥?鈫?`consecutive_pass_count + 1`; else reset. **Pass**: conclusion contains 鈥滃畬鍏ㄨ鐩栥€侀獙璇侀€氳繃鈥?or 鈥滈€氳繃鈥? Critical Auditor contains 鈥滄湰杞棤鏂?gap鈥? 鈥滄棤鏂?gap鈥? or 鈥滄棤 gap鈥?
6. **Iterate**: Until 3 no-gap rounds. **No infinite loops**: when `consecutive_pass_count >= 3`, **stop**.
7. **Persist reports**: Every round to `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_{slug}_搂4_round{N}.md`; state this in the subagent prompt.

#### Mandatory parseable scoring block

Main flow (TASKS document audit) reports must end with:

```markdown
## 鍙В鏋愯瘎鍒嗗潡锛堜緵 parseAndWriteScore锛?鎬讳綋璇勭骇: [A|B|C|D]
缁村害璇勫垎:
- 闇€姹傚畬鏁存€? XX/100
- 鍙祴璇曟€? XX/100
- 涓€鑷存€? XX/100
- 鍙拷婧€? XX/100
```

#### Mode B: post-implementation audit (搂5)

When auditing **implementation results** (code, prd, progress), use audit-prompts 搂5:

- Audited object is code/implementation, not only the TASKS doc
- Gaps fixed by **implementation** subagent, not audit subagent
- Convergence: `.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`

See [references/audit-prompt-impl.md](references/audit-prompt-impl.md).

---

### Layer 2: Codex no-hooks Runtime Adapter

> Map Cursor executors to Codex CLI native executors

#### Primary executor

| Phase | Source platform | Claude executor | Agent definition |
|-------|-----------------|-----------------|-------------------|
| TASKS doc audit | code-reviewer (Cursor-native Task) | `auditor-tasks-doc` | `.codex/agents/auditors/auditor-tasks-doc.md` |
| Document audit (stage 4) | code-reviewer (Cursor-native Task) | `auditor-document` | `.codex/agents/auditors/auditor-document.md` |

Invocation: Agent tool (`subagent_type: general-purpose`).

#### Fallback (4 levels)

| Level | Mechanism | Condition |
|-------|-----------|-----------|
| L1 (Primary) | `auditor-tasks-doc` | Default |
| L2 | `code-reviewer` Agent | auditor-tasks-doc unavailable |
| L3 | `code-review` skill | Agent mechanism unavailable |
| L4 | Main Agent runs same three-layer prompt | All subagents unavailable |

**Fallback notice (FR26)**:

```
鈿狅笍 Executor downgrade: L{from} 鈫?L{to}
  Reason: {why}
  Current executor: {name}
```

#### CLI calling summary (Architecture D2)

Before each audit subagent call:

```yaml
--- CLI Calling Summary ---
subagent_type: general-purpose
target_agent: auditor-tasks-doc
phase: tasks_doc_audit
round: {N}
artifact_doc_path: {path}
baseline_path: {baseline}
report_path: {path}
fallback_level: L{N}
---
```

#### YAML handoff (Architecture D2/D4)

```yaml
--- YAML Handoff ---
execution_summary:
  status: passed|failed
  round: {N}
  critic_ratio: "{X}%"
  gap_count: {N}
  new_gap_count: {N}
  convergence_status: in_progress|converged
artifacts:
  artifact_doc_path: "{path}"
  report_path: "{path}"
next_steps:
  - action: revise_tasks_doc|execute_standalone_tasks
    agent: auditor-tasks-doc|bmad-standalone-tasks
    ready: true|false
handoff:
  next_action: revise_tasks_doc|execute_standalone_tasks
  next_agent: auditor-tasks-doc|bmad-standalone-tasks
  ready: true|false
  mainAgentNextAction: dispatch_remediation|dispatch_implement
  mainAgentReady: true|false
---
```

`mainAgentNextAction / mainAgentReady` in this handoff block are compatibility summary fields only. Before any global branch change, the main Agent must re-read `main-agent-orchestration`.

---

### Layer 3: Repo add-ons

> State, hooks, handoff, scoring, commit gate

#### State

- `.codex/state/bmad-progress.yaml`: global BMAD progress
- Handoff: structured YAML at end of each phase

#### Post-audit automation close-out

On pass, do not hand-run `bmad-speckit score`. The executor only needs to return `projectRoot`, `reportPath`, and `artifactDocPath`; the invoking host/runner handles score write, audit-index updates, and the rest of post-audit automation.

#### Commit gate

- PASS means document audit passed; may proceed to `bmad-standalone-tasks` implementation
- Do not commit directly
- Final commit gated by `bmad-master`

#### Forbidden wording

Reports must not use delay language: 鈥渙ptional鈥? 鈥渓ater鈥? 鈥淭BD鈥? 鈥渄epending鈥? 鈥渘ext iteration鈥? 鈥渘ot yet鈥? 鈥渋mplement first鈥? etc. (match Chinese list in canonical SKILL.md).

---

## References

- **audit-document-iteration-rules**: `.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`
- **audit-prompts 搂4**: `.codex/skills/speckit-workflow/references/audit-prompts.md` 搂4
- **audit-prompts 搂5**: `.codex/skills/speckit-workflow/references/audit-prompts.md` 搂5
- **audit-prompts-critical-auditor-appendix**: `.codex/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
- **audit-post-impl-rules**: `.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`

---

## Prompt template integrity (mandatory)

When launching a TASKS document audit subtask, the main Agent **must** copy the **full** prompt from `references/audit-prompt-tasks-doc.md` into the subagent prompt and replace all placeholders. **Forbidden**:

- Omitting any paragraph
- Summarizing or paraphrasing
- Dropping mandatory guard lines exactly as authored in the source audit prompt template (required-reading boilerplate must remain verbatim)
- Removing 鈥渧erbatim output鈥?requirements

Post-implementation audit template: `references/audit-prompt-impl.md`.

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
