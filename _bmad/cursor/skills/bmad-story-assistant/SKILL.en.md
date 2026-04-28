<!-- BLOCK_LABEL_POLICY=B -->

---
name: bmad-story-assistant
description: |
  BMAD Story Assistant: Execute the complete Create Story 鈫?Audit 鈫?Dev Story 鈫?Post-Implementation Audit workflow by Epic/Story number.
  Phase zero: Automatically detect and patch party-mode display name optimization in new projects/worktree (if _bmad exists and is not optimized).
  Use subagent to perform tasks; the audit step prioritizes scheduling code-reviewer (.claude/agents/ or .cursor/agents/) through Cursor Task, and falls back to mcp_task generalPurpose if it fails.
  Follow ralph-method, TDD traffic lights, speckit-workflow constraints. The main agent is prohibited from directly modifying the production code.
  **It is prohibited to skip party-mode because Epic/Story already exists**: Create Story can be skipped only when the user explicitly says "party-mode has been passed and the audit has passed"; otherwise Create Story must be executed. Before entering Cursor party-mode, the main Agent must show `20 / 50 / 100`, wait for the user's choice, complete the pre-launch self-check, and let the host inject `Party Mode Session Bootstrap (JSON)` on `SubagentStart`; party-mode still runs for at least 100 rounds when it comes to solution selection or design decisions.
  Applicable scenarios: The user provides Epic and Story numbers (e.g. 4 and 1 for Story 4.1); produce the Story document, pass audit, run Dev Story, and complete post-implementation audit. Deliverables and subagent copy-paste prompts stay in Chinese per workflow and parser rules.
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.
> **不中断执行 contract**：If the audit conclusion is **failed**, keep the implementation subagent running until the post-audit boundary; do not stop at a single task, milestone, or progress checkpoint.

# BMAD Story Assistant

## Main-Agent Orchestration Surface (Mandatory)

In interactive main-agent mode, before the main Agent starts, resumes, or closes out the `story` chain, it must first read:

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action inspect
```

If an official dispatch plan is needed, read:

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan
```

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

> **Party-mode source of truth (Cursor)**: `{project-root}/_bmad/cursor/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`. Cursor-side party-mode rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit-gate semantics must follow that file; this skill only decides when Story flows enter party-mode.

### Cursor Party-Mode Main-Agent Flow

- Before entering Cursor party-mode, the main Agent must show the `20 / 50 / 100` options and infer the default tier from the request type.
- Recommend `decision_root_cause_50` for ordinary RCA / option analysis and `final_solution_task_list_100` for high-confidence final outputs such as Story finalization. Recommendation is not authorization: before the user explicitly replies, the main Agent must not turn a recommended tier into 鈥渟elected鈥?
- `quick_probe_20` is probe-only; if the chosen tier cannot satisfy a high-confidence final-output request, the main Agent must reject it and require an upgrade to `final_solution_task_list_100`.
- After the user chooses the tier, the main Agent must complete the pre-launch self-check checklist and print a `銆愯嚜妫€瀹屾垚銆?..鍙互鍙戣捣銆俙 result block.
- Session Bootstrap JSON is injected by the host on `SubagentStart`; the main Agent must not skip that execution path.
- The Cursor branch does not pause mid-run and does not hand control back to the main Agent at `20 / 40 / ...`. Once launched, the sub-agent must keep running in the same session until the user-selected total rounds are completed.
- If the party-mode sub-agent stops early at rounds such as `22/50` or `10/50`, the main Agent must **not** continue the discussion itself and must **not** restart from Round 1. Cursor now supports the `subagentStop` hook, and the host will automatically trigger party-mode closeout / summary refresh on `subagentStop`; however, after the sub-agent returns, it must still **first read** `_bmad-output/party-mode/runtime/current-session.json` and use that file as the only validation entrypoint. **Do not** guess the latest `pm-*` session by file timestamp. The check order is fixed: 鈶?`validation_status`, `status`, `session_key`, and `target_rounds_total`; 鈶?**read `visible_output_summary` and `visible_fragment_record_present` first**, and inspect `observed_visible_round_count`, `first_visible_round`, `last_visible_round`, `progress_current_round`, `progress_target_round`, `final_gate_present`, `final_gate_profile`, `final_gate_total_rounds`, and `excerpt`; 鈶?**only when deeper investigation is needed** read `session_log_path`, `snapshot_path`, `audit_verdict_path`, and `visible_output_capture_path`. **Do not** open the session log or `tool-result.md` before checking `visible_output_summary`. If `validation_status != PASS` or the selected total rounds were not reached, re-issue the facilitator immediately with the same total rounds and gate profile.

## Quick Decision Guide

### Five-layer architecture overview
```
Layer 1: 浜у搧瀹氫箟灞?(Product Brief 鈫?澶嶆潅搴﹁瘎浼?鈫?PRD 鈫?Architecture)
Layer 2: Epic/Story瑙勫垝灞?(create-epics-and-stories)
Layer 3: Story寮€鍙戝眰 (Create Story 鈫?Party-Mode 鈫?Story鏂囨。)
Layer 4: 鎶€鏈疄鐜板眰 (宓屽speckit-workflow: specify鈫抪lan鈫扜APS鈫抰asks鈫扵DD)
Layer 5: 鏀跺熬灞?(鎵归噺Push + PR鑷姩鐢熸垚 + 寮哄埗浜哄伐瀹℃牳 + 鍙戝竷)
```
### When to use this skill
- The complete product development process needs to start from Product Brief
- Requires in-depth generation of PRD/Architecture and Party-Mode discussion
- Need to plan and split Epic/Story
- Need to make solution selection and design decisions at the Story level

### When to use speckit-workflow
- The technical implementation plan has been clarified and only needs to be implemented in detail
- There is already a Story document that needs to be converted into technical specifications and code
- No product-level discussions and decisions required

### The relationship between the two
This skill includes speckit-workflow as a nested process of Layer 4.
When the execution reaches "Phase 3: Dev Story Implementation", the complete process of speckit-workflow will be automatically triggered.

## Deferred Gaps Dev Story Addendum

This distributed English variant must keep the same Deferred Gaps guardrails as the main Chinese contract.

- Before implementation, Dev Story must read and validate `deferred-gap-register.yaml`.
- Dev Story must also read and validate `journey-ledger`, `trace-map`, and `closure-notes`.
- Implementation must fail closed when an active gap has no task binding, `Smoke Task Chain`, `Closure Task ID`, or production path mapping.
- Post-audit must inspect `closure_evidence`, `carry_forward_evidence`, `Production Path`, `Smoke Proof`, and `Acceptance Evidence`.
- `module complete but journey not runnable` is a hard failure, not a warning.

---

This skill defines the complete workflow of **Create Story 鈫?Audit 鈫?Dev Story 鈫?Post-Implementation Audit**. The Epic number and Story number are provided by the user or context as input parameters to the skill.

## Mandatory constraints

- **The main Agent is prohibited from directly generating Story documents**: The Story document produced by Create Story in Phase 1 must be produced by the mcp_task sub-agent; the main Agent is not allowed to skip the sub-agent and write the Story document on its own on the grounds of "existing requirements document" or "Epic has been clarified".
- **Master Agent is prohibited from directly modifying production code**: Implementation must be performed through the mcp_task subagent.
- **It is forbidden to skip party-mode** because Epic/Story already exists: Only when the user **clearly** states that "Story has passed party-mode and passed the audit, skip Create Story" or meets the exception scenario, stages 1 and 2 can be skipped; otherwise, even if the Epic/Story document already exists (maybe generated by a simple bmad command without in-depth discussion of party-mode), Create Story must be executed. Any Story involving code implementation must enter party-mode for at least 100 rounds of debate (for exceptions, see Phase 1 搂1.0).

---

## Input parameters

| Parameters | Description | Example |
|------|------|------|
| `epic_num` | Epic number | 4 |
| `story_num` | Story sub-number (e.g. 1 means Story 4.1) | 1 |

The complete identification of Story is `{epic_num}-{story_num}`, for example, Epic 4, Story 4.1 鈫?`4-1`. Users can give it directly (such as "4, 1"), or parse it from documents such as sprint-status.

---

## 搂 Prohibited word list (Story document)

The following words must not appear in the output of Story documents. This table must be referenced in Phase 1 output and Phase 2 audits; if any word exists in the Story document during the audit, the conclusion is that it failed.

| Prohibited words/phrases | Alternate directions |
|-------------|----------|
| Optional, can be considered, can be considered | Clearly write "Adopt Option A" and briefly describe the reasons. |
| Follow-up, subsequent iterations, to be followed | If not done and the function is within the scope of Epic, it must be stated which Story is responsible; exclusion without attribution is prohibited. If outside the scope of the product, the Epic/PRD basis must be cited. If so, write down the scope of completion of this stage. |
| First implement, later extend, or later extend | This Story implements X; Y is owned by Story A.B (A.B must exist, scope must include Y, and the wording must name Y concretely). |
| To be determined, at discretion, depending on the situation | Change to clear conditions and corresponding actions (such as "If X then Y"). |
| Technical debt, do this first and then change later | Do not leave technical debt in the Story document; opening the Story separately may not be within the scope of this article. |
| Existing problems can be eliminated, have nothing to do with this time, historical issues will not be dealt with for the time being, and environmental issues can be ignored | Prohibited when appearing in acceptance/audit conclusions, task completion instructions and **no formal exclusion record**; if there is a formal exclusion record, an objective description can be made in the record but must have objective basis (such as issue number, reproduction steps). |

### Story scope statement example (postponed loop closure)

**Correct example**:
> This Story implements the use_adaptive_threshold=0 path. The branching logic when use_adaptive_threshold is non-zero is taken care of by Story 5.6. (The audit must verify that Story 5.6 exists and the scope contains this description)

**Error Example**:
> This Story will first implement the use_adaptive_threshold=0 path, or expand it later. (Prohibited words: first implementation, or subsequent expansion)
> This Story implements 0 paths; Story 5.6 takes care of the rest. (鈥淭he rest鈥?is too vague for auditors to verify)

**Instructions for use**: The output requirements of Stage 1 Create Story must quote this table or post a simplified version of the above table; the Stage 2 Story document audit must write "If any word in this table exists in the Story document, the conclusion is that it has failed." The post-implementation audit of Stage 4 must write "If the acceptance/audit conclusion appears with the forbidden words "failure exclusion" in the table above and there is no corresponding formal exclusion record, the conclusion is failure."

---

## Formal exclusion of failed use cases (consistent with bmad-bug-assistant)

**Principle**: Any failed use cases that appear in this acceptance/regression must be **fixed** or **included in a formal exclusion list** and audited within this round; failures must not be ignored for any unrecorded or unaudited reasons.
**Disable automatic generation**: Audit subagent, enforcement subagent **Disable** automatic creation or update of EXCLUDED_TESTS_*.md or similar exclusion manifest files.

**The user must be asked first**: When there is a failed use case in acceptance/regression and it is to be included in the formal exclusion list, the main agent or sub-agent must **first ask** the user** "whether to approve the inclusion of the following use cases in the formal exclusion list". After the user explicitly approves, the exclusion list can be created or updated; if the user refuses, the repair process must be entered and the exclusion list must not be created.

**Exclude record path (for Story)**: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/EXCLUDED_TESTS_{epic_num}-{story_num}.md`. Required fields and acceptable/unacceptable judgments are consistent with bmad-bug-assistant's "provisions for formally excluding failed use cases" (use case ID, exclusion reason, objective basis, this Story identification, audit conclusion).

---

## 搂 When can party-mode and code-review compensation rules be skipped?

**Note**: This section describes the compensation mechanism after skipping party-mode. The judgment of whether it can be skipped shall be based on "Phase 1 搂1.0 Party-Mode Decision Check".

### When to skip party-mode (Create Story)

**The only allowed condition**: When the user **clearly** states that "Story has passed party-mode and passed the audit, skip Create Story", stages one and two can be skipped.

**BANNED**: Skip the Epic/Story document simply because it already exists; documents that may be generated by a simple bmad command without in-depth discussion of party-mode, **must** execute Create Story.

### Code-review compensation rules when party-mode is skipped

When party-mode is skipped, phase two (Story document audit) needs to compensate for the missing depth, otherwise quality gating will be insufficient.

| Situation | Stage 2 Stringency | Justification |
|------|--------------|------|
| The user explicitly said "skip party-mode" | **strict** | The user actively skipped and needs to compensate for the depth |
| No party-mode output (no `DEBATE_consensus_*`, `party-mode convergence minutes`, etc. in the story directory) | **strict** | Compensate for missing party-mode depth; no gap + critical auditor >50% for 3 consecutive rounds |
| Party-mode output exists | **standard** | Depth is available, just verify; single + critical auditor |
| User explicitly requires strict | **strict** | Subject to user |

**Output detection**: Before the stage 2 audit, the main agent checks whether the party-mode output exists in the story directory; if it exists and the user does not force strict, use standard; if not or the user requires strict, use strict.

---

## Usage example

### Example 1: Complete process (Epic 4, Story 4.1)

The user said: "Use bmad story assistant to generate Epic 4 and Story 4.1 and execute the complete process."

**sprint-status requirements**: If sprint-status.yaml does not exist, sprint-planning must be run first or the bypass must be explicitly confirmed; otherwise, the Create Story subtask must not be initiated.

Main Agent execution sequence:
0. (Phase zero - prefix) If _bmad exists and party-mode does not perform display name optimization, automatically execute the patch
1. Initiate the Create Story subtask (epic_num=4, story_num=1)
2. After outputting `_bmad-output/implementation-artifacts/epic-4-*/story-1-<slug>/4-1-<slug>.md`, initiate Story document audit
3. After passing the audit, initiate the Dev Story implementation subtask and pass in the TASKS or BUGFIX document path
4. After the implementation is completed, you **must** initiate a post-implementation audit (audit-prompts.md 搂5) (this step is required, not optional)
5. The process ends when the audit is passed

### Example 2: Create Story + Audit only (Epic 3, Story 2)

User said: "Help me create Story 3.2 and do the audit."

The main Agent executes:
1. mcp_task initiates Create Story (epic_num=3, story_num=2)
2. Initiate the audit subtask after outputting `3-2-<title>.md`
3. If it fails, modify the document and audit it again until it passes.

### Example 3: Execute after parsing from sprint-status

The user said: "Click the next Story in sprint-status to execute the bmad story assistant."

**sprint-status requirement**: This example only works if sprint-status.yaml exists; if it does not exist, sprint-planning must be run first or bypass explicitly confirmed.

The main Agent first reads `_bmad-output/implementation-artifacts/sprint-status.yaml`, parses out the next to-do Story (such as `4-1`), and then executes the process according to Example 1, substituting epic_num=4 and story_num=1 into the prompts of each stage.

### Example 4: Dev Story only (user explicitly confirms party-mode passed and audited)

The user said: "The Story 4-1 document already exists, has passed party-mode and passed the audit, please execute Dev Story."

The main agent can skip stages one and two and directly initiate the Dev Story implementation subtask, passing in:
- Story document path: `_bmad-output/implementation-artifacts/epic-4-*/story-1-*/*.md`
- TASKS document path: (such as `_bmad-output/implementation-artifacts/epic-4-*/story-1-*/TASKS_4-1-*.md`)
-Project root directory

After the implementation is completed, a post-implementation audit will be initiated according to stage four.

**Note**: If the user only says "Story already exists" but does not specify "passed party-mode and passed the audit", the main Agent **may not** skip Create Story; it must execute Phase 1 (including 100 rounds of debate in party-mode, if there is a solution selection or design decision), audit again, and then Dev Story.

---

## Stage zero (pre-stage): display name file inspection and automatic optimization

**Note**: This stage is a technical patch, which is executed before the Layer 1 product definition layer. It is distinguished from the "Phase Zero: Layer 1 Product Definition Layer" below: the former is display name optimization, and the latter is product definition.

**Trigger time**: When the user uses this skill for the first time in this project or worktree, or when the user explicitly requests "check/optimize display name".

**Prerequisite**: `_bmad` has been installed in the project (`{project-root}/_bmad/` exists).

**Check logic**:
1. Read `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md` (use canonical step-02 as the representative file for party-mode display-name optimization and gate semantics; if step-02 is updated, mirrors are generated afterward by the sync script)
2. If step-02 **does not contain** the string `must use **display name` **and** `display name displayName`, it is determined that it is not optimized.

**Execute Action**: Apply `search_replace` modifications to the following three files. If a file does not exist, skip it. If `old_string` is not completely consistent with the content of the current file, read the file first and then fine-tune `old_string` according to the actual format and try again; if it still fails, skip and prompt.

### Patch 1: workflow.md

Path: `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`
```yaml
old_string: "[Load agent roster and display 2-3 most diverse agents as examples]"
new_string: |
  [Load agent roster and display 2-3 most diverse agents as examples. 浠嬬粛鏃跺繀椤讳娇鐢ㄥ睍绀哄悕锛坉isplayName锛夛紝涓?`_bmad/_config/agent-manifest.csv` 淇濇寔涓€鑷淬€傜ず渚嬶細Winston 鏋舵瀯甯堛€丄melia 寮€鍙戙€丮ary 鍒嗘瀽甯堛€丣ohn 浜у搧缁忕悊銆丅Mad Master銆丵uinn 娴嬭瘯銆丳aige 鎶€鏈啓浣溿€丼ally UX銆丅arry Quick Flow銆丅ond Agent 鏋勫缓銆丮organ Module 鏋勫缓銆乄endy Workflow 鏋勫缓銆乂ictor 鍒涙柊绛栫暐銆丏r. Quinn 闂瑙ｅ喅銆丮aya 璁捐鎬濈淮銆丆arson 澶磋剳椋庢毚銆丼ophia 鏁呬簨璁茶堪銆丆aravaggio 婕旂ず銆丮urat 娴嬭瘯鏋舵瀯銆佹壒鍒ゆ€у璁″憳銆俔
```
### Patch 2: step-01-agent-loading.md

Path: `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.md`

Modification A:
```yaml
old_string: "- **displayName** (agent's persona name for conversations)"
new_string: "- **displayName** (agent's persona name for conversations锛涗腑鏂囪澧冧笅浣跨敤 灞曠ず鍚嶏紝濡?Mary 鍒嗘瀽甯堛€乄inston 鏋舵瀯甯?"
```
Modification B:
```yaml
old_string: "[Display 3-4 diverse agents to showcase variety]:

- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]
- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]
- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]"
new_string: "[Display 3-4 diverse agents to showcase variety锛涗娇鐢?灞曠ず鍚?鏍囨敞锛屽 Winston 鏋舵瀯甯堛€丄melia 寮€鍙戙€丮ary 鍒嗘瀽甯圿:

- [Icon Emoji] **[灞曠ず鍚?displayName]** ([Title]): [Brief role description]
- [Icon Emoji] **[灞曠ず鍚?displayName]** ([Title]): [Brief role description]
- [Icon Emoji] **[灞曠ず鍚?displayName]** ([Title]): [Brief role description]"
```
### Patch 3: step-02-discussion-orchestration.md

Path: `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`

Modify A (Response Structure):
```yaml
old_string: "**Response Structure:**
[For each selected agent]:

\"[Icon Emoji] **[Agent Name]**: [Authentic in-character response]\""
new_string: "**Response Structure:**
[For each selected agent]:
- 蹇呴』浣跨敤 **灞曠ず鍚嶏紙displayName锛?* 鏍囨敞鍙戣█瑙掕壊锛屼笌 `_bmad/_config/agent-manifest.csv` 淇濇寔涓€鑷淬€?- 灞曠ず鍚嶇ず渚嬶細BMad Master銆丮ary 鍒嗘瀽甯堛€丣ohn 浜у搧缁忕悊銆乄inston 鏋舵瀯甯堛€丄melia 寮€鍙戙€丅ob Scrum Master銆丵uinn 娴嬭瘯銆丳aige 鎶€鏈啓浣溿€丼ally UX銆丅arry Quick Flow銆丅ond Agent 鏋勫缓銆丮organ Module 鏋勫缓銆乄endy Workflow 鏋勫缓銆乂ictor 鍒涙柊绛栫暐銆丏r. Quinn 闂瑙ｅ喅銆丮aya 璁捐鎬濈淮銆丆arson 澶磋剳椋庢毚銆丼ophia 鏁呬簨璁茶堪銆丆aravaggio 婕旂ず銆丮urat 娴嬭瘯鏋舵瀯銆佹壒鍒ゆ€у璁″憳銆?
\"[Icon Emoji] **[灞曠ず鍚?displayName]**: [Authentic in-character response]\""
```
Modification B (Cross-Talk):
```yaml
old_string: "- Agents can reference each other by name: \"As [Another Agent] mentioned...\""
new_string: "- Agents can reference each other by 灞曠ず鍚? \"As [Another Agent 灞曠ず鍚峕 mentioned...\"锛堝銆屾濡?Winston 鏋舵瀯甯?鎵€璇粹€︺€嶏級"
```
Modify C (Question Handling):
```yaml
old_string: "- Clearly highlight: **[Agent Name] asks: [Their question]**"
new_string: "- Clearly highlight: **[灞曠ず鍚?displayName] asks: [Their question]**锛堝 **Amelia 寮€鍙?asks: 鈥?*锛?
```
Modification D (Moderation):
```yaml
old_string: "- If discussion becomes circular, have bmad-master summarize and redirect"
new_string: "- If discussion becomes circular, have BMad Master 鎬荤粨骞跺紩瀵艰浆鍚?
```
**Execution order**: Phase zero is executed before phase one; if non-optimization is detected, the patch is completed first, and then subsequent phases are continued. If `_bmad` does not exist, phase zero is skipped and the user is prompted to install BMAD.

**New worktree detection and _bmad custom migration tips**:
- If it is detected that the current worktree is a new worktree (for example, cwd is a worktree directory at the same level as the project root such as `{repo name}-{branch}`, or `_bmad` is a new installation), and `_bmad-output/bmad-customization-backups/` has a backup, the user will be prompted:
  > A new worktree has been detected. If you need to restore _bmad customization, you can run: `python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{latest backup path}" --project-root "{current project root}"`. The latest backup path is the latest directory sorted by timestamp under `_bmad-output/bmad-customization-backups/`.
- If there is no backup, no prompt will be given.

---

### Output path convention

**pre-speckit output (by branch subdirectory)**:
| Output | Path |
|------|------|
| Epic/Story Planning | `_bmad-output/planning-artifacts/{branch}/epics.md` |
| Readiness Report | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` |
| prd (planning level) | `_bmad-output/planning-artifacts/{branch}/prd.{ref}.json` |
| Architecture design | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` or `ARCH_*.md` |

**branch parsing**: `git rev-parse --abbrev-ref HEAD`; if it is `HEAD`, then `detached-{short-sha}`; `/` is replaced by `-`.
**Archive**: When using `--archive`, first copy to `_archive/{branch}/{date}-{seq}/` and then write.

**post-speckit output (into story subdirectory)**:
| Output | Path |
|------|------|
| Story documentation | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/{epic}-{story}-{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md` |
| prd, progress | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.{ref}.json`, `progress.{ref}.txt` |
| DEBATE consensus | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/DEBATE_consensus_{slug}_{date}.md` |
| Cross Story DEBATE | `_bmad-output/implementation-artifacts/_shared/DEBATE_consensus_{slug}_{date}.md` |

**Subdirectory creation**: When creating Story, if `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` does not exist, it must be created first. Subdirectories are created synchronously by create-new-feature.ps1 -ModeBmad when the spec is created, or by bmad-story-assistant when the Story is first written.

---

## Stage zero: Layer 1 product definition layer

**Note**: Different from the above "Phase Zero (pre-stage): Display name file inspection and automatic optimization": this stage is the product definition layer, including Product Brief, Complexity Assessment, PRD, and Architecture.

When the user clearly wants to create a new epic or major feature, the product definition layer is executed first.

### Step 1: Product Brief
Create or read Product Brief documents, including:
- Product overview and objectives
- Target user group
- Core values and differentiation
- Success indicators

### Step 2: Complexity Assessment
Fill out the 3D Complexity Assessment Questionnaire:
```yaml
涓氬姟澶嶆潅搴?(1-5鍒?:
  - 棰嗗煙鐭ヨ瘑: [鐔熸倝(1鍒?/閮ㄥ垎鏂?3鍒?/鍏ㄦ柊(5鍒?]
  - 鍒╃泭鐩稿叧鏂规暟閲? [鈮?(1鍒?/3-5(3鍒?/>5(5鍒?]
  - 鍚堣瑕佹眰: [鏃?1鍒?/涓€鑸?3鍒?/涓ユ牸(5鍒?]

鎶€鏈鏉傚害 (1-5鍒?:
  - 鎶€鏈爤: [鐜版湁(1鍒?/閮ㄥ垎鏂?3鍒?/鍏ㄦ柊(5鍒?]
  - 鏋舵瀯鎸戞垬: [鏃?1鍒?/涓瓑(3鍒?/楂樺苟鍙戝ぇ鏁版嵁(5鍒?]
  - 闆嗘垚闅惧害: [鐙珛(1鍒?/灏戦噺渚濊禆(3鍒?/澶嶆潅缃戠粶(5鍒?]

褰卞搷鑼冨洿 (1-5鍒?:
  - [鍗曚釜Story(1鍒?/鍗曚釜妯″潡(3鍒?/璺ㄦā鍧?4鍒?/鍏ㄧ郴缁?5鍒?]
```
**Aggregation formula (GAP-019 fixed; GAP-071 fixed)**: each dimension takes the highest score** (default conservative) or **average score** (rounded); **Selection conditions**: takes the highest score by default; if the user explicitly selects "optimistic mode", the average score is taken; total score = business + technology + impact, range 3~15.

### Step 3: PRD generation
The PRD generation method is determined based on the total score (GAP-004 fix: boundary value attribution rules):

| Total score | PRD generation method |
|------|-------------|
| 鈮? points (including 6 points) | Directly generate PRD |
| 7-10 points (including 7 and 10 points) | Generated after 50 rounds of Party-Mode |
| 11-15 points (including 11 and 15 points) | Generated after 80 rounds of Party-Mode |
| 15 points (full score) | 80 rounds of Party-Mode + external expert Review; (**GAP-081 fix**: total score range is 3~15, no >15; triggered when the full score is 15); (GAP-038 fix: the expert source can be a senior architect within the project or an external consultant, and the output format is "Review opinion + pass/conditional pass/fail") |

The PRD must contain:
- Detailed demand list (with ID)
- Acceptance criteria
- Prioritization
- Dependencies

### Step 4: Architecture generation (if required)
When the total score is 鈮? points, Architecture documents need to be generated:
- Technical architecture diagram
- Module division and interface definition
- Technology selection and tradeoff analysis (using ADR format)
- Security and performance considerations

Architecture Party-Mode role (GAP-020 fix: explanation of differences from Plan Party-Mode):
- System architect, performance engineer, security architect, operations engineer, cost analyst, critical auditor
- The Plan phase focuses on technical solutions, the Architecture phase focuses on architectural decisions, and roles can be reused; if the project has a dedicated architect, it can be expanded

### Stage zero output
- Product Brief document
- Complexity assessment results
- PRD document (including demand traceability table)
- Architecture documentation (if required)

---

## Layer 2 Epic/Story planning layer

Before executing Create Story, do Epic/Story planning.

### create-epics-and-stories

Based on the PRD and Architecture documents, perform the following steps:

1. **Epic definition**
   - Determine Epic boundaries and scope
   - Naming convention: `feature-{domain}-{capability}`
   - Estimate Epic's overall workload

2. **Story split**
   - Split Story by functional modules
   - Each Story can be delivered independently
   - Naming convention: `{epic_num}.{story_num} {description}`

3. **Dependency Analysis**
   - Identify dependencies between Stories
   - Generate dependency graph (text or graphic)
   - Determine the order of execution

4. **Coarse-grained estimation**
   - Preliminary workload estimate for each Story
   - Identify high-risk stories
   - Mark the Story that needs Spike

### Output

1. **Epic List**
   ```markdown
   | Epic ID | 鍚嶇О | 鎻忚堪 | 棰勪及宸ユ椂 | 浼樺厛绾?|
   |---------|------|------|---------|--------|
   | 4 | feature-metrics-cache | 鎸囨爣缂撳瓨浼樺寲 | 80h | P0 |
   ```
2. **Story list (coarse-grained)**
   ```markdown
   | Story ID | 鎵€灞濫pic | 鎻忚堪 | 渚濊禆 | 棰勪及宸ユ椂 | 椋庨櫓 |
   |----------|---------|------|------|---------|------|
   | 4.1 | 4 | 鍩虹缂撳瓨绫诲疄鐜?| 鏃?| 8h | 浣?|
   | 4.2 | 4 | TTL鏈哄埗瀹炵幇 | 4.1 | 12h | 涓?|
   ```
3. **Dependency graph**
   ```
   Story 4.1 鈹€鈹?              鈹溾攢鈫?Story 4.3 鈹€鈫?Story 4.5
   Story 4.2 鈹€鈹?   ```
### Conditions for entering stage one
- Epic and Story lists completed
- Dependencies have been clarified
- Obtained user confirmation

---

## Master Agent鈥檚 rules for delivering prompt words (must be observed)

- **Use the complete template, copy the entire section, and prohibit summarization**: When initiating subtasks of each stage, you must copy the entire prompt template of the stage to the prompt and replace the placeholder. Replacement with summary words is prohibited (such as "Please press the story-assistant stage 2 audit execution" "Please refer to the skill stage 2" "See above for audit requirements").
- **Error Example** (Prohibited): "Please press story-assistant stage 2 audit execution" "Please refer to skill stage 2" "See above for audit requirements".
- **Correct example**: The prompt contains the full text of the complete template at this stage, the placeholders have been replaced, and the self-test results have been output before launching.
- **Placeholder List**:

| Stage | Placeholder | Meaning | Example value | Consequences of not replacing |
|------|--------|------|--------|------------|
| Phase 1 | epic_num, story_num, project-root | Epic number, Story sub-number, project root directory | 4, 1, d:/Dev/my-project | Subtask cannot locate the output path |
| Phase 2 | Story document path, project-root | Produced Story file path, project root | _bmad-output/.../4-1-xxx.md | Audit object is wrong or missing |
| Phase 3 | epic_num, story_num, epic_slug, slug, project-root | Epic/Story number, epic_slug (derived from epics.md), story slug, project root | 11, 1, speckit-template-offline, template-fetch, d:/Dev/... | Subagent creates specs with no slug path |
| Stage 4 | Same as above and audit basis path | tasks/plan/GAPS path | Passed in by the main Agent | Audit basis is missing |

- **Self-test mandatory**: It is not allowed to initiate the self-test before completing the pre-initiation self-test list and outputting the self-test results at this stage; it is prohibited to initiate the self-test first and then supplement the self-test.
- **Self-test result format example**: "[Self-test completed] Phase X: The entire template [template ID] has been copied; placeholder [replaced/listed]; [other required options]. Can be initiated."

### Self-check list before main agent initiates subtask

Before initiating any subtask (mcp_task or Cursor Task), the following checks must be completed:

**sprint-status check** (stage one must be executed before Create Story is initiated, TASKS_sprint-planning-gate T4):
- [ ] When the user specifies a Story via epic_num/story_num or parsed from sprint-status, the master agent must check whether sprint-status exists before initiating the Create Story subtask.
- [ ] Can call `{project-root}/scripts/check-sprint-ready.ps1 -Json` (if it exists) or equivalent logic; if `SPRINT_READY=false` and the user does not explicitly confirm "Known bypass, continue", the Create Story subtask must not be initiated.
- [ ] The self-test result must include "sprint-status confirmed to exist" or "user confirmed bypass" or equivalent statement.

**Document Existence Scanning** (Phase 3 must be executed before Dev Story is initiated):
- [ ] Before initiating the Phase 3 Dev Story subtask, you must execute:
  `python _bmad/speckit/scripts/python/check_speckit_prerequisites.py --epic {epic} --story {story} --project-root {project_root}`
  And the exit code is 0; otherwise it shall not be initiated.
- [ ] The self-inspection result must include "the pre-check script has been run and passed" or an equivalent statement (can be aligned with the IMP-003 self-inspection report example: four types of documents in spec/plan/GAPS/tasks exist + audit passed).

**Preparatory phase inspection**:
- [ ] Relevant skill files have been read to obtain the latest content
- [ ] Confirmed to be in the correct stage (Layer 1/2/3/4/5)
- [ ] has all necessary contextual information ready
- [ ] Confirmed that the previous stage has been completed and passed the audit

**Subtask configuration check**:
- [ ] subagent_type is set correctly (generalPurpose/explore/shell)
- [ ] prompt contains complete background information and specific requirements
- [ ] references the correct audit-prompts.md section (if applicable)
- [ ] Set a reasonable timeout

**AUDIT RELATED INSPECTIONS**:
- [ ] The availability of code-reviewer has been confirmed or a fallback plan has been prepared
- [ ] The corresponding chapter content of audit-prompts.md has been prepared
- [ ] Audit passing standards have been clarified (Level A/B/C/D)
- [ ] Processing process after audit failure has been planned

**Self-examination of prohibited items**:
- [ ] No direct modification of production code (must pass subtask)
- [ ] Not skipping necessary audit steps
- [ ] does not use vague instructions (such as "think about it", "see if you can")
- [ ] No missing requirements mapping or traceability

**Self-test confirmation**:
After completing all the above check items, clearly state in the reply:
"The self-test is completed, all check items have passed, now start the subtask."

---

## Phase 1: Create Story

### 1.0 Self-check before launching (mandatory, new)

Before initiating the Create Story subtask, the main Agent must perform the following checks and output the results:

**Party-Mode Decision Check**:

| Check items | Result options | Rules |
|--------|----------|------|
| Does the Story involve code implementation? | Yes/No | See "Code Implementation Definition" below |
| Party-Mode Decision | Enter/Skip | Enter by default, only exception scenarios can be skipped |
| Skip reason (if skipped) | Exception scene number | Must match the exception scene below |
| Stage 2 strictness expectations | strict/standard | Skip party-mode 鈫?strict; complete party-mode 鈫?standard |

**Code Implementation Definition**:
- Add or modify functions, classes, modules, and components
- Add or modify business logic, algorithms, and data processing
- Add or modify APIs, interfaces, and database operations

**Exception scenarios (party-mode can be skipped only in the following situations)**:
1. The user explicitly said "skip party-mode" or "passed party-mode and passed the audit"
2. Story is a pure document update, no code implementation
3. Story is a pure configuration modification with no business logic changes.

**Examples of expressions that do not include "skip party-mode"**:
- "Simple implementation" "Quick implementation" "Small changes"
- "Simple code implementation" "Simple function"

**Example of expression of "skip party-mode"**:
- "Skip party-mode"
- "Passed party-mode and passed the audit"

**Self-test output format**:
```
銆愯嚜妫€瀹屾垚銆戦樁娈典竴 Create Story
- Story 鏄惁娑夊強浠ｇ爜瀹炵幇锛歔鏄?鍚
- Party-Mode 鍐崇瓥锛歔杩涘叆 party-mode / 璺宠繃 party-mode]
- 璺宠繃鐞嗙敱锛堣嫢璺宠繃锛夛細[渚嬪鍦烘櫙缂栧彿鎴?涓嶉€傜敤"]
- 闃舵浜屼弗鏍煎害棰勬湡锛歔strict/standard]
```
**BANNED**:
- Subtasks must not be initiated without outputting the self-test results.
- Do not skip party-mode for reasons such as "the function is simple" or "users say it is simple"

### 1.1 sprint-status pre-check (TASKS_sprint-planning-gate T4)

**Execution Timing**: The main Agent must be executed before initiating the Create Story subtask**.

**CHECK ACTION**:
1. When the user specifies a Story through epic_num/story_num (or "4, 1", etc.), or when parsing the next Story from sprint-status (Example 3), the main Agent **must first** check whether sprint-status exists.
2. You can call `scripts/check-sprint-ready.ps1 -Json` or `_bmad/speckit/scripts/powershell/check-sprint-ready.ps1 -Json` (if the project root has scripts/, it will take precedence). `SPRINT_READY` that parses the output.
3. **If sprint-status does not exist**: Output "鈿狅笍 sprint-status.yaml does not exist, it is recommended to run sprint-planning first." The user is required to explicitly confirm "Known bypass, continue" or execute sprint-planning first; the Create Story subtask must not be initiated before confirmation.
4. **If sprint-status exists**: You can attach the "sprint-status confirmed" mark to the subtask prompt to simplify the subtask logic.
5. **Exemption**: If the user clearly "has passed party-mode and passed the audit, skip Create Story" and only request Dev Story, it can be executed according to the existing logic (Dev Story is controlled internally by the dev-story process).

Call the subagent through **mcp_task**, execute the equivalent workflow of `/bmad-bmm-create-story`, and generate Epic `{epic_num}` and Story `{epic_num}-{story_num}` documents. The master Agent must copy the entire template **STORY-A1-CREATE** (Phase 1 Create Story prompt) and replace the placeholders.

**Skip judgment**: Only when the user **clearly** says "passed party-mode and audit passed" and "skip Create Story", the main agent can skip stages one and two. If the user only provides the Epic/Story number or says "Story already exists" without clarifying the above statement, Create Story must be executed (including 100 rounds of party-mode, if there is a solution selection or design decision).

### 1.1 Initiate subtask

**Template ID**: STORY-A1-CREATE. **Template Boundary**: From the first line in the code block to "...the entire process must be in Chinese."
```yaml
tool: mcp_task
subagent_type: generalPurpose
description: "Create Story {epic_num}-{story_num} via BMAD create-story workflow"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典竴 Create Story prompt 妯℃澘锛圛D STORY-A1-CREATE锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  璇锋墽琛?BMAD Create Story 宸ヤ綔娴侊紝鐢熸垚 Epic {epic_num}銆丼tory {epic_num}-{story_num} 鐨?Story 鏂囨。銆?
  **宸ヤ綔娴佹楠?*锛?  1. 鍔犺浇 {project-root}/_bmad/core/tasks/workflow.xml
  2. 璇诲彇鍏跺叏閮ㄥ唴瀹?  3. 浠?{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml 浣滀负 workflow-config 鍙傛暟
  4. 鎸夌収 workflow.xml 鐨勬寚绀烘墽琛?create-story 宸ヤ綔娴?  5. 杈撳嚭 Story 鏂囨。鍒?{project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md锛坰lug 浠?Story 鏍囬鎴栫敤鎴疯緭鍏ユ帹瀵硷級

  **寮哄埗绾︽潫**锛?  - 鍒涘缓 story 鏂囨。蹇呴』浣跨敤鏄庣‘鎻忚堪锛岀姝娇鐢ㄦ湰 skill銆屄?绂佹璇嶈〃锛圫tory 鏂囨。锛夈€嶄腑鐨勮瘝锛堝彲閫夈€佸彲鑰冭檻銆佸悗缁€佸厛瀹炵幇銆佸悗缁墿灞曘€佸緟瀹氥€侀厡鎯呫€佽鎯呭喌銆佹妧鏈€猴級銆?  - 褰撳姛鑳戒笉鍦ㄦ湰 Story 鑼冨洿浣嗗睘鏈?Epic 鏃讹紝椤诲啓鏄庛€岀敱 Story X.Y 璐熻矗銆嶅強浠诲姟鍏蜂綋鎻忚堪锛涚‘淇?X.Y 瀛樺湪涓?scope 鍚鍔熻兘锛堣嫢 X.Y 涓嶅瓨鍦紝瀹¤灏嗗垽涓嶉€氳繃骞跺缓璁垱寤猴級銆傜姝€屽厛瀹炵幇 X锛屾垨鍚庣画鎵╁睍銆嶃€屽叾浣欑敱 X.Y 璐熻矗銆嶇瓑妯＄硦琛ㄨ堪銆?  - **party-mode 寮哄埗**锛氭棤璁?Epic/Story 鏂囨。鏄惁宸插瓨鍦紝鍙娑夊強浠ヤ笅浠讳竴鎯呭舰锛?*蹇呴』**杩涘叆 party-mode 杩涜澶氳鑹茶京璁猴細鈶?鏈夊涓疄鐜版柟妗堝彲閫夛紱鈶?瀛樺湪鏋舵瀯/璁捐鍐崇瓥鎴?trade-off锛涒憿 鏂规鎴栬寖鍥村瓨鍦ㄦ涔夋垨鏈喅鐐广€侭efore launch, the main Agent must show `20 / 50 / 100`, wait for the user's choice, complete the pre-launch self-check, and let the host inject `Party Mode Session Bootstrap (JSON)` on `SubagentStart`. Use `final_solution_task_list_100` (100 rounds) for Story finalization / final task lists and `decision_root_cause_50` (50 rounds) for ordinary analysis; `quick_probe_20` must not be used for finalization. **Do not** skip party-mode because 鈥淓pic already exists鈥?or 鈥淪tory already exists鈥? The Cursor branch does not pause mid-run or hand control back in batches; once the sub-agent starts, it must run in the same session until the user-selected total rounds are completed. If it stops early, re-issue the facilitator immediately with the same total rounds and gate profile.
  - 鍏ㄧ▼蹇呴』浣跨敤涓枃銆?```
Replace the above `{epic_num}`, `{story_num}`, `{project-root}` with actual values 鈥嬧€?project-root is the absolute path to the project root directory).

### 1.2 Document output path

Story documents are usually saved in: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`.

---

## Phase 2: Story document audit

### 2.0 Pre-check (new)

Before initiating a phase 2 audit, the master agent must perform the following checks:

**Check items**:
- [ ] Has the self-test result been output in phase one?
  - If there is no self-test output, phase 2 defaults to **strict**
- [ ] Is there a party-mode output?
  - Check whether there is a `DEBATE_consensus_*` or `party-mode convergence record` file in the story directory
  - If there is no product, use **strict** in stage 2
  - If there is a product, use **standard** in stage two

**strictness selection rules** (mandatory):
- The user explicitly said "skip party-mode" 鈫?strict
- Normal completion party-mode (with product) 鈫?standard
- Other cases (no product and no user confirmation) 鈫?strict

**BANNED**: Do not use standard without a party-mode product

After the Story document is generated, you must initiate an audit subtask, using the spirit of audit-prompts.md 搂5 (or the audit prompt words applicable to the Story document), and iterate until "complete coverage and verification passed."

### Strictness selection (strict/standard)

- **strict**: 3 rounds in a row without gap + critical auditor >50%, referencing [audit-post-impl-rules.md](../speckit-workflow/references/audit-post-impl-rules.md).
- **standard**: single + critical auditor, reference [audit-prompts-critical-auditor-appendix.md](../speckit-workflow/references/audit-prompts-critical-auditor-appendix.md).

**Selection logic**:
- If there are no party-mode outputs (there are no `DEBATE_consensus_*`, `party-mode convergence minutes`, etc. in the story directory) or the user requires strict 鈫?**strict** (to compensate for the missing party-mode depth).
- If party-mode output exists and the user does not force strict 鈫?**standard** (party-mode has provided depth, just verify).

### 2.1 Audit subagent priority

**Note**: The `subagent_type` of `mcp_task` currently only supports `generalPurpose`, `explore`, `shell`, and **does not support** `code-reviewer`.

**Preferred**: Under the current registry-backed contract, the Cursor audit primary path is fixed as the runtime carrier `.cursor/agents/code-reviewer.md` plus **Cursor Task -> code-reviewer**. This section documents the current product route, not an ad-hoc discovery order between `.claude/agents/` and `.cursor/agents/`. **MUST NOT** enforce "mcp_task must be used" in the audit step.

**Fallback**: If code-reviewer is unavailable (no agents file, Task cannot be scheduled, etc.), fallback to `mcp_task` + `subagent_type: generalPurpose`, and pass in the audit prompt words applicable to this stage to ensure consistent audit standards.

**Prompt words**: **Must** use the complete prompt template (ID STORY-A2-AUDIT) of the Stage 2 Story audit in this skill to copy the entire section into the audit subtask prompt, and **must** use other general audit prompt words.

### 2.2 Audit subtask

**Template ID**: STORY-A2-AUDIT. **Template boundary**: From the first line in the code block to the format section at the end of the report; the master Agent must copy the entire section and replace the placeholders.
```yaml
# 浼樺厛锛欳ursor Task 璋冨害 code-reviewer锛堣嫢 .claude/agents/ 鎴?.cursor/agents/ 瀛樺湪锛?# 鍥為€€锛歮cp_task锛堝洜 mcp_task 涓嶆敮鎸?code-reviewer锛屽洖閫€鏃朵娇鐢?generalPurpose锛?tool: mcp_task
subagent_type: generalPurpose
description: "Audit Story {epic_num}-{story_num} document"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣瀹¤妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典簩 Story 瀹¤瀹屾暣 prompt 妯℃澘锛圛D STORY-A2-AUDIT锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛橈紙瀵瑰簲 BMAD 宸ヤ綔娴佷腑鐨?code-reviewer 瀹¤鑱岃矗锛夈€傝瀵广€屽凡鍒涘缓鐨?Story {epic_num}-{story_num} 鏂囨。銆嶈繘琛屽璁°€?
  瀹¤渚濇嵁锛?  - 鍘熷闇€姹?Epic 鏂囨。
  - plan.md銆両MPLEMENTATION_GAPS.md锛堝瀛樺湪锛?  - 瀹為檯鐢熸垚鐨?Story 鏂囨。鍐呭

  瀹¤鍐呭锛堝繀椤婚€愰」楠岃瘉锛夛細
  1. Story 鏂囨。鏄惁瀹屽叏瑕嗙洊鍘熷闇€姹備笌 Epic 瀹氫箟銆?  2. 鑻?Story 鏂囨。涓瓨鍦ㄦ湰 skill 搂 绂佹璇嶈〃锛圫tory 鏂囨。锛変换涓€璇嶏紝涓€寰嬪垽涓烘湭閫氳繃锛屽苟鍦ㄤ慨鏀瑰缓璁腑娉ㄦ槑鍒犻櫎鎴栨敼涓烘槑纭弿杩般€?  3. 澶氭柟妗堝満鏅槸鍚﹀凡閫氳繃杈╄杈炬垚鍏辫瘑骞堕€夊畾鏈€浼樻柟妗堛€?  4. 鏄惁鏈夋妧鏈€烘垨鍗犱綅鎬ц〃杩般€?  5. **鎺ㄨ繜闂幆**锛氳嫢 Story 鍚€岀敱 Story X.Y 璐熻矗銆嶏紝椤婚獙璇?`_bmad-output/implementation-artifacts/epic-{X}-*/story-{Y}-*/` 涓?Story 鏂囨。瀛樺湪涓?scope/楠屾敹鏍囧噯鍚浠诲姟鐨勫叿浣撴弿杩帮紱鍚﹀垯鍒や笉閫氳繃銆傘€岀敱 X.Y 璐熻矗銆嶇殑琛ㄨ堪椤诲惈琚帹杩熶换鍔＄殑**鍏蜂綋鎻忚堪**锛屼究浜?grep 楠岃瘉銆備慨鏀瑰缓璁紙涓夐€変竴锛夛細鈶?鑻?X.Y 涓嶅瓨鍦細鍒涘缓 Story X.Y锛宻cope 鍚?[浠诲姟鍏蜂綋鎻忚堪]锛涒憽 鑻?X.Y 瀛樺湪浣?scope 涓嶅惈锛氭洿鏂?Story X.Y锛屽皢 [浠诲姟鍏蜂綋鎻忚堪] 鍔犲叆 scope锛涒憿 鑻ヤ笉搴旀帹杩燂細鍒犻櫎銆岀敱 X.Y 璐熻矗銆嶏紝鏀逛负鏈?Story 瀹炵幇銆?  
  楠岃瘉鏂瑰紡锛氶槄璇?Story 鏂囨。锛涜嫢鍚€岀敱 Story X.Y 璐熻矗銆嶏紝璇诲彇 `{project-root}/_bmad-output/implementation-artifacts/epic-{X}-*/story-{Y}-*/` 涓?Story 鏂囨。锛屾鏌?scope/楠屾敹鏍囧噯鏄惁鍚浠诲姟锛沢rep 琚帹杩熶换鍔＄殑鍏抽敭璇嶃€?
  鎶ュ憡缁撳熬蹇呴』鎸変互涓嬫牸寮忚緭鍑猴細缁撹锛氶€氳繃/鏈€氳繃銆傚繀杈惧瓙椤癸細鈶?瑕嗙洊闇€姹備笌 Epic锛涒憽 鏄庣‘鏃犵姝㈣瘝锛涒憿 澶氭柟妗堝凡鍏辫瘑锛涒懀 鏃犳妧鏈€?鍗犱綅琛ㄨ堪锛涒懁 鎺ㄨ繜闂幆锛堣嫢鏈夈€岀敱 X.Y 璐熻矗銆嶅垯 X.Y 瀛樺湪涓?scope 鍚浠诲姟锛夛紱鈶?鏈姤鍛婄粨璁烘牸寮忕鍚堟湰娈佃姹傘€傝嫢浠讳竴椤逛笉婊¤冻鍒欑粨璁轰负鏈€氳繃锛屽苟鍒楀嚭涓嶆弧瓒抽」鍙婃瘡鏉″搴旂殑淇敼寤鸿銆?
  銆惵tory 鍙В鏋愬潡瑕佹眰銆戞姤鍛婄粨灏惧湪缁撹涓庡繀杈惧瓙椤逛箣鍚庯紝**蹇呴』**杩藉姞鍙В鏋愯瘎鍒嗗潡锛堟牸寮忚 speckit-workflow/references/audit-prompts-critical-auditor-appendix.md 搂7锛夈€傞』鍖呭惈锛氱嫭绔嬩竴琛屻€屾€讳綋璇勭骇: [A|B|C|D]銆嶅強鍥涜銆? 闇€姹傚畬鏁存€? XX/100銆嶃€? 鍙祴璇曟€? XX/100銆嶃€? 涓€鑷存€? XX/100銆嶃€? 鍙拷婧€? XX/100銆嶃€傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛涙€讳綋璇勭骇浠呴檺 A/B/C/D銆傜姝?B+銆丄-銆丆+銆丏- 绛変换鎰忎慨楗扮锛涗粙浜庝袱妗ｆ椂鎷╀竴杈撳嚭绾瓧姣嶃€傛槧灏勫缓璁細瀹屽叏瑕嗙洊鈫扐/90+锛涢儴鍒嗚鐩栤啋B/80+锛涢渶淇敼鈫扖/70+锛涗笉閫氳繃鈫扗/60鍙婁互涓嬨€侽therwise the scoring parser cannot parse the block and the dashboard will not display grades.

  **Runtime sync (S10 - MANDATORY):** 瀹¤缁撹涓洪€氳繃锛涢€氳繃鍒ゅ畾涔嬪悗銆佽繑鍥炰富 Agent 涔嬪墠鎵ц锛?  `npx bmad-speckit sync-runtime-context-from-sprint --story-key <story_key>`
  `<story_key>` 濉瀹¤ Story 鐨?kebab-case key锛屼笌 sprint-status `development_status` 涓殑閿悕鐩稿悓銆?
  [Must do after passing the audit] When the conclusion is "pass", you (the audit subagent) **must** return `projectRoot`, `reportPath`, `artifactDocPath=<Story document path>`, and `stage=story` before returning to the main Agent, so the invoking host/runner can call `runAuditorHost`. The report path is `_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{story_num}-*/AUDIT_Story_{epic_num}-{story_num}_stage2.md`. If the host/runner fails, indicate resultCode in the conclusion. **Do not** return a passing conclusion before the host close-out is complete.

  銆愬璁℃湭閫氳繃鏃躲€戜綘锛堝璁″瓙浠ｇ悊锛夐』鍦ㄦ湰杞唴**鐩存帴淇敼琚 Story 鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗鍦ㄦ姤鍛婁腑娉ㄦ槑宸蹭慨鏀瑰唴瀹癸紱涓?Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€?*绂佹**浠呰緭鍑轰慨鏀瑰缓璁€屼笉淇敼鏂囨。銆傝瑙?[audit-document-iteration-rules.md](../speckit-workflow/references/audit-document-iteration-rules.md)銆?```
If the audit fails, **execute according to the report**: If the modification suggestion contains "Create Story X.Y" or "Update Story **Prohibited** Only modify the current Story document and then review it, when the modification proposal includes creating/updating other Stories. For document audit iteration rules, see [audit-document-iteration-rules.md](../speckit-workflow/references/audit-document-iteration-rules.md). Each audit follows the priority order of 搂2.1 (code-reviewer first, generalPurpose on failure).

#### Step 2.3: Phase 2 admission check (mandatory, executed first)

After receiving the passing conclusion of phase two and before entering phase three, the main agent must first confirm that the unified auditor host runner has completed post-audit automation. If host execution is still missing and the report file `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_Story_{epic}-{story}_stage2.md` exists, the main Agent performs step 2.2 to backfill `runAuditorHost`. Failure remains non-blocking.

#### Step 2.2: Run runAuditorHost (executed when step 2.3 determines host close-out is missing)

When step 2.3 determines that host close-out is missing and the report file exists, the main Agent executes:
```bash
npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage story --artifactPath <Story document path> --reportPath <report path> --iterationCount 0
```
After the backfill run, confirm host close-out again until it is completed or the report no longer exists. Failure remains non-blocking.

**T11 linkage**: the sub-agent only returns the fields required by the host runner; the main agent uses step 2.3 / 2.2 to ensure `runAuditorHost` has completed and to avoid duplicate close-out.

#### Unified host close-out after the audit passes (mandatory)
- Story-stage score write, auditIndex update, and other post-audit automation are all handled by `runAuditorHost`; the main agent uses steps 2.2/2.3 to check completion and backfill when needed. **It must include `--iteration-count {cumulative value}`**; stage=story; failure remains non-blocking and resultCode must be recorded.

---

## Document mapping relationship (with speckit-workflow)

### Document correspondence matrix

| bmad output | speckit output | mapping relationship | stage correspondence |
|---------|------------|---------|---------|
| Product Brief | - | Source Documentation | Layer 1 Starting Point |
| PRD | - | Requirements Specification | Layer 1 Output |
| Architecture | - | Technical Architecture | Layer 1 Output |
| Epic/Story List | - | Function Split | Layer 2 Output |
| Story document | spec-E{epic}-S{story}.md | Story function chapter 鈫?spec function specification chapter | Layer 3 鈫?Layer 4 specify |
| plan + tasks (implementation plan and task list) | plan-E{epic}-S{story}.md + tasks-E{epic}-S{story}.md | Function list 鈫?Task list | Layer 3 鈫?Layer 4 plan/tasks |
| BUGFIX Documentation | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | **GAP-063 Fix**: BUGFIX repair items can be converted into "Gap to be implemented" entries in GAPS, and the two have a non-identical conversion relationship | Layer 3 鈫?Layer 4 GAPS |
| progress.md | TDD record | Execution progress 鈫?Test record | Layer 4 execution 鈫?Record |

### Demand traceability chain

**Extended mapping table format** (must be included in the Story document):

| PRD requirement ID | PRD requirement description | Architecture component | Story | spec chapter | task | status |
|----------|------------|------------------|-------|----------|------|------|
| REQ-001 | User Login | AuthService | 4.1 | 搂2.1 | Task 1 | Covered |
| REQ-002 | JWT Refresh | AuthService | 4.1 | 搂2.2 | Task 2 | Defer |

**Traceability Requirements**:
1. Each PRD requirement must be mapped to at least one Story
2. Each Architecture component must be mapped to at least one task
3. Each Story must contain a PRD requirements traceability chapter
4. Each spec-E{epic}-S{story}.md must contain an Architecture constraints chapter

### Timing relationship
```
Layer 1: Product Brief 鈫?PRD 鈫?Architecture
              鈫?Layer 2: create-epics-and-stories 鈫?Epic/Story鍒楄〃
              鈫?Layer 3: Create Story 鈫?浜у嚭Story鏂囨。
              鈫?Layer 4: specify 鈫?浜у嚭spec-E{epic}-S{story}.md锛堟妧鏈鏍煎寲Story鍐呭锛?              鈫?         plan 鈫?浜у嚭plan-E{epic}-S{story}.md锛堝疄鐜版柟妗堬級
              鈫?         Story鏂囨。瀹¤锛堜緷鎹寘鍚玴lan-E{epic}-S{story}.md锛?```
### Change Management

When PRD or Architecture changes:
1. Mark the affected Story
2. Update the requirements tracing chapter of the Story document
3. Notify relevant developers
4. Re-audit the affected parts

---

## Phase Three: Dev Story Implementation (Enhanced Version)

After passing the audit, execute the equivalent workflow of **/bmad-bmm-dev-story** to develop and implement Story `{epic_num}-{story_num}`.

### Pre-check

Before starting implementation, the following check items must be confirmed:
- [ ] The PRD requirements traceability chapter has been added (list all PRD requirement IDs involved in this Story)
- [ ] Architecture constraints have been passed to the Story document (listing relevant Architecture components and constraints)
- [ ] Complexity assessment completed (confirm the complexity score of this Story)
- [ ] Dependency analysis of the Epic/Story planning layer has been confirmed (confirm that the pre-Story has been completed)

### Spec directory creation (the path must contain epic-slug and story-slug)

After Create Story outputs the Story document and before executing speckit specify, you must ensure that the spec directory exists:

- **Path format**: `specs/epic-{epic}-{epic_slug}/story-{story}-{slug}/`
- **epic_slug required**, source: slug/name of `_bmad-output/config/epic-{N}.json`, or Title of `##/### Epic N: Title` in `_bmad-output/planning-artifacts/{branch}/epics.md` to kebab-case (consistent with create-new-feature.ps1)
- **story slug required**, see speckit-workflow SKILL.md 搂1.0 for the source (Priority: Story title 鈫?Epic name 鈫?Story scope 鈫?E{epic}-S{story})
- **Creation method**: First created by `create-new-feature.ps1 -ModeBmad -Epic N -Story N` (the script automatically derives epic_slug); when the sub-agent is created by itself, **must** derive epic_slug from epics.md and use it for the path. It is forbidden to use `specs/epic-{epic}/` without slug path
- **If it cannot be deduced**: You must ask the user before initiating the Dev Story subtask, and you must not use empty slugs or pure numeric paths.

**Quote**: For details on path conventions, see speckit-workflow SKILL.md 搂1.0, epics-md-format-for-slug-derivation.md, IMPROVEMENT_epic path to increase slug readability.

### Dev Story implementation process

**The complete speckit-workflow process must be nested and executed** in the following order:

1. **specify** 鈫?Generate spec-E{epic}-S{story}.md 鈫?code-review audit (iterate until passed)
   - Input: Story document
   - Output: spec-E{epic}-S{story}.md (technical specifications, the file name must contain the Epic/Story serial number)
   - Audit: code-review 搂1, must pass level A/B

2. **plan** 鈫?Generate plan-E{epic}-S{story}.md 鈫?code-review audit (iterate until passed, enter party-mode for 50 rounds if necessary)
   - Input: spec-E{epic}-S{story}.md
   - Output: plan-E{epic}-S{story}.md (implementation plan)
   - Audit: code-review 搂2, must pass level A/B
   - Optional: If there is a technical dispute, start 50 rounds of party-mode

3. **GAPS** 鈫?Generate IMPLEMENTATION_GAPS-E{epic}-S{story}.md 鈫?code-review audit (iterate until passed)
   - Input: plan-E{epic}-S{story}.md + existing code
   - Output: IMPLEMENTATION_GAPS-E{epic}-S{story}.md (implementation gap)
   - Audit: code-review 搂3, must pass level A/B

4. **tasks** 鈫?Generate tasks-E{epic}-S{story}.md 鈫?code-review audit (iterate until passed)
   - Input: GAPS + plan
   - Output: tasks-E{epic}-S{story}.md (execution task list)
   - Audit: code-review 搂4, must pass level A/B
   - Note: If the number of tasks is >20, enable batch execution mechanism

5. **Execution** 鈫?TDD traffic light mode (red light 鈫?green light 鈫?refactoring) 鈫?code-review audit (iterate until passed)
   - Input: tasks-E{epic}-S{story}.md
   - Output: runnable code + TDD recording
   - Audit: code-review 搂5, must pass level A/B
   - Requirements: Strictly record in the format of [TDD-RED]鈫抂TDD-GREEN]鈫抂TDD-REFACTOR]

6. **Post-implementation audit (required)**: After the subtask returns, the main Agent must initiate a post-implementation audit according to stage four, and skipping is prohibited.

### Worktree Strategy (revised version)

**story_count source (GAP-005 fixed; GAP-072 fixed)**: Taken by priority (1) Epic configuration `epic.story_count`; (2) Story list `len(epic.stories)`; (3) User input `--story-count N`. **Conflict Handling**: If (1) is different from (2), log a warning and use (1). **story_count=0 (GAP-022 fixed)**: prohibit the creation of worktree, prompt the user to complete the Epic/Story planning first; or adopt the story-level placeholder strategy (single Story placeholder).

**Automatic detection logic**:
```python
worktree_base = Path(repo_root).parent  # 椤圭洰鏍圭埗鐩綍
repo_name = Path(repo_root).name  # 涓?using-git-worktrees 涓€鑷?if story_count <= 2:
    worktree_type = "story-level"
    path = str(worktree_base / f"{repo_name}-story-{epic_num}-{story_num}")
elif story_count >= 3:
    worktree_type = "epic-level"
    path = str(worktree_base / f"{repo_name}-feature-epic-{epic_num}")
    branch = f"story-{epic_num}-{story_num}"
```
**Story-level worktree** (number of Stories 鈮?2):
- Path: `{parent directory}/{repo name}-story-{epic_num}-{story_num}` (level with the project root, repo name = directory name, consistent with using-git-worktrees)
- Each Story has an independent worktree
- Complete isolation, suitable for stories with strong dependencies or high risks

**Epic-level worktree** (number of Stories 鈮?3):
- Path: `{parent directory}/{repo name}-feature-epic-{epic_num}` (level with the project root, repo name = directory name, consistent with using-git-worktrees)
- Create Story branch within Epic worktree
- Branch name: `story-{epic_num}-{story_num}`
- Reduce context switching time by 87%

**Serial/Parallel Mode Switch**:
```bash
# 鍒囨崲鍒板苟琛屾ā寮忥紙闇€婊¤冻鏂囦欢鑼冨洿鏃犻噸鍙狅級
/bmad-set-worktree-mode epic=4 mode=parallel

# 鍒囨崲鍒颁覆琛屾ā寮忥紙榛樿锛?/bmad-set-worktree-mode epic=4 mode=serial

# 鍥為€€鍒癝tory绾?/bmad-set-worktree-mode epic=4 mode=story-level
```
### Solo fast iteration mode (no new worktree/branch)

**Applicable**: solo development, multiple epics/stories on the same branch, rapid iteration, and bugfix interspersion. `create-new-feature.ps1 -ModeBmad` does not create branches or worktrees by default.

**Path convention when not created**:
- **spec**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/`, consistent with BMAD (epic-slug is consistent with the derivation of create-new-feature.ps1)
- **Output path**: `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`, consistent with BMAD
- **planning-artifacts**: by `{branch}/` subdirectory, `_bmad-output/planning-artifacts/{branch}/epics.md`, etc.

**Multiple epic/story with the same branch**: Each story has independent subdirectories `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/` and `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`, which do not cover each other.

**Dev Story Execution**: Execute in the current directory without calling worktree creation.

### Demand traceability requirements

**spec-E{epic}-S{story}.md must contain** (the file name must contain the Epic/Story serial number):
```markdown
## 闇€姹傝拷婧?
| PRD闇€姹侷D | PRD闇€姹傛弿杩?| 瀵瑰簲spec绔犺妭 | 瀹炵幇鐘舵€?|
|----------|------------|-------------|---------|
| REQ-001 | XXX | 搂2.1 | 宸插疄鐜?|
```
**tasks-E{epic}-S{story}.md must contain** (the file name must contain the Epic/Story serial number):
```markdown
## Architecture绾︽潫

| Architecture缁勪欢 | 绾︽潫鎻忚堪 | 瀵瑰簲task | 楠岃瘉鏂瑰紡 |
|-----------------|---------|---------|---------|
| CacheService | 蹇呴』鏀寔TTL | Task 2 | 鍗曞厓娴嬭瘯 |
```
### Conflict handling and rollback

**If it is found that the Story document conflicts with the spec/plan**:
1. Try to solve it in the speckit stage (modify spec/plan)
2. If it cannot be solved, go back to Create Story and clarify again.
3. If major plan changes are involved, re-enter party-mode

**Rollback command**:
```
/bmad-bmm-correct-course epic=4 story=1 reason="闇€姹傚啿绐?
```
### 3.1 Mandatory constraints (reserved)

1. **ralph-method**: `prd` and `progress` files must be created and maintained; each time a US is completed, prd (passes=true) and progress (append story log) must be updated; execute in sequence US-001~US-005.
2. **TDD traffic light**: The order that each US must reach is red light 鈫?green light 鈫?reconstruction. Tasks involving production code: you must first write/make up the test and run the acceptance test to fail (red light), then implement and run the test to pass the acceptance test (green light); **progress must contain** the acceptance command and result of each sub-step. It is forbidden to use "final return all passed" as a substitute for task-by-task TDD recording.
3. **speckit-workflow**: Fake implementations and placeholders are prohibited; acceptance commands must be run; the architecture is faithful to BUGFIX/requirements documents.
4. **Forbidden**: Add "will be in subsequent iterations" in the task description; mark completed but the function is not actually called.

### 3.2 Main Agent Responsibilities

**Steps that the main Agent must perform**: 1 Derive epic_slug (prefer the Title of `### Epic N: Title` in `_bmad-output/planning-artifacts/{branch}/epics.md`; stop and generate the branch-scoped epics file when it is missing; or resolve the existing directory name from `_bmad-output/implementation-artifacts/epic-{N}-*/`) 鈫?2 Prepare prompt (resolve the template STORY-A3-DEV Copy the entire section and replace the placeholders epic_num, story_num, epic_slug, slug, project-root) 鈫?3 Execute the pre-initiation self-check list 鈫?4 Output the self-check results 鈫?5 Initiate the subtask. **Forbidden**: Step 5 must not be performed without completing steps 3 and 4; the epic_slug placeholder must not be omitted, otherwise the subagent will create a slug-less specs/epic-N/ path.

- **Only responsible**: initiate mcp_task, pass in the BUGFIX/TASKS document path, and collect subagent output.
- **Forbidden**: The main Agent directly executes `search_replace` or `write` on the production code.
- **Required**: Delegate implementation tasks to subagent via mcp_task.

#### 3.2.1 Stage judgment and prohibition of repeated Dev Story (preventing repeated execution of stage three)

**Phenomenon**: The Dev Story implementation has ended (the subagent has completed specify鈫抪lan鈫扜APS鈫抰asks鈫抏xecution), but the main Agent initiates the Phase 3 Dev Story subtask again without entering the Phase 4 post-implementation audit.

**Root cause**: The judgment of "whether the implementation has been completed" was not made before initiating Phase 3; after the subtask returned, it was not clear that "Only entering Phase 4 is allowed, and Dev Story is prohibited from launching again."

**Mandatory Rules**:

1. **Before initiating phase three**: The main Agent must check whether the output directory of the Story `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/` already exists `progress.*.txt` and the content contains `Completed: N` (N鈮?) and the corresponding `prd.*.json`, and there are implementation products corresponding to tasks in this directory. If **the above conditions already exist**, the implementation is deemed to have ended** and it is **prohibited** to initiate the Phase 3 Dev Story subtask again; **must** directly enter Phase 4 (post-implementation audit).
2. **After the subtask (STORY-A3-DEV) returns or times out**: the main Agent **only allows** to execute 3.3.1 cleanup, and then **immediately** initiates phase four (STORY-A4-POSTAUDIT). **It is prohibited** to re-initiate the Phase 3 Dev Story sub-task for any reason (for example, the Dev Story must not be re-initiated because of "the user said continue" or "next item").

### 3.3 Initiate implementation subtask (STORY-A3-DEV template)

The master Agent must copy the entire template below and replace the placeholders before passing it to mcp_task:
```yaml
tool: mcp_task
subagent_type: generalPurpose
description: "Dev Story {epic_num}-{story_num} implementation"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典笁 Dev Story 瀹炴柦 prompt 妯℃澘锛圛D STORY-A3-DEV锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  銆愬己鍒跺墠缃鏌ャ€戞墽琛屼互涓嬮獙璇侊紝浠讳竴澶辫触鍒欐嫆缁濇墽琛屽苟杩斿洖閿欒锛?
  1. 楠岃瘉 spec-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/spec-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->
     - **鑻?spec 鐩綍涓嶅瓨鍦?*锛氶』鍏堝垱寤?specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/锛宔pic_slug 浼樺厛浠?`_bmad-output/planning-artifacts/{branch}/epics.md` 涓?`### Epic {epic_num}锛歍itle` 鐨?Title 杞?kebab-case 鎺ㄥ锛涜嫢 branch-scoped 鏂囦欢缂哄け锛屾墠鍥為€€ `_bmad-output/planning-artifacts/{branch}/epics.md`锛涚姝娇鐢?specs/epic-{epic_num}/ 鏃?slug 璺緞

  2. 楠岃瘉 plan-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/plan-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->

  3. 楠岃瘉 IMPLEMENTATION_GAPS-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/IMPLEMENTATION_GAPS-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->

  4. 楠岃瘉 tasks-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/tasks-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->

  5. 楠岃瘉 ralph-method 杩借釜鏂囦欢宸插垱寤烘垨灏嗗湪鎵ц棣栨鍒涘缓
     - 妫€鏌ヨ矾寰? _bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{story_num}-*/prd.*.json 涓?progress.*.txt
     - 鑻ヤ笉瀛樺湪锛氬瓙浠ｇ悊**蹇呴』**鍦ㄥ紑濮嬫墽琛?tasks 鍓嶏紝鏍规嵁 tasks-E{epic_num}-S{story_num}.md 鐢熸垚 prd 涓?progress锛堢鍚?ralph-method schema锛夛紝鍚﹀垯涓嶅緱寮€濮嬬紪鐮併€?     - **progress 棰勫～ TDD 妲戒綅**锛氱敓鎴?progress 鏃讹紝瀵规瘡涓?US 棰勫～ [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鎴?[DONE] 鍗犱綅琛岋紙`_pending_`锛夛紝娑夊強鐢熶骇浠ｇ爜鐨?US 鍚笁鑰咃紝浠呮枃妗?閰嶇疆鐨勫惈 [DONE]銆?
  濡傛湁浠讳綍涓€椤逛笉婊¤冻锛岀珛鍗宠繑鍥為敊璇細
  "鍓嶇疆妫€鏌ュけ璐? [鍏蜂綋鍘熷洜]銆傝鍏堝畬鎴?speckit-workflow 鐨勫畬鏁存祦绋嬶紙specify鈫抪lan鈫扜APS鈫抰asks锛夈€?

  ---

  浣犳槸涓€浣嶉潪甯歌祫娣辩殑寮€鍙戜笓瀹?Amelia 寮€鍙戯紙瀵瑰簲 BMAD 寮€鍙戣亴璐ｏ級锛岃礋璐ｆ寜 Story/TASKS 鎵ц瀹炴柦銆傝鎸変互涓嬭鑼冩墽琛屻€?
  **銆怲DD 鎵ц椤哄簭锛堜笉鍙烦杩囷級銆?*
  瀵?prd 涓瘡涓?involvesProductionCode=true 鐨?US锛屽繀椤荤嫭绔嬫墽琛屼竴娆″畬鏁村惊鐜紱绂佹浠呭棣栦釜 US 鎵ц TDD 鍚庡鍚庣画 US 璺宠繃绾㈢伅鐩存帴瀹炵幇銆傛瘡涓秹鍙婄敓浜т唬鐮佺殑浠诲姟锛屽繀椤讳弗鏍兼寜浠ヤ笅椤哄簭鎵ц锛?  1. 绾㈢伅锛氬厛鍐欐垨琛ュ厖瑕嗙洊璇ヤ换鍔￠獙鏀舵爣鍑嗙殑娴嬭瘯锛岃繍琛岄獙鏀跺懡浠わ紝纭澶辫触銆?  2. 缁跨伅锛氬啀鍐欐渶灏戦噺鐨勭敓浜т唬鐮佷娇娴嬭瘯閫氳繃銆?  3. 閲嶆瀯锛氬湪娴嬭瘯淇濇姢涓嬩紭鍖栦唬鐮侊紝骞跺湪 progress 涓褰?[TDD-REFACTOR]銆?  绂佹锛氬厛鍐欑敓浜т唬鐮佸啀琛ユ祴璇曪紱绂佹鍦ㄦ湭鐪嬪埌绾㈢伅锛堟祴璇曞け璐ワ級鍓嶈繘鍏ョ豢鐏樁娈点€?
  **銆怲DD 绾㈢豢鐏樆濉炵害鏉熴€?* prd 涓瘡涓?involvesProductionCode=true 鐨?US 蹇呴』**鐙珛**鎵ц涓€娆″畬鏁?RED鈫扜REEN鈫扲EFACTOR 寰幆銆傛墽琛岄『搴忎负锛?  1. 鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹 鈫?蹇呴』寰楀埌澶辫触缁撴灉锛堢孩鐏級
  2. 绔嬪嵆鍦?progress 杩藉姞 [TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed
  3. 鍐嶅疄鐜板苟閫氳繃楠屾敹 鈫?寰楀埌閫氳繃缁撴灉锛堢豢鐏級
  4. 绔嬪嵆鍦?progress 杩藉姞 [TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed
  5. **鏃犺鏄惁鏈夐噸鏋?*锛屽湪 progress 杩藉姞 [TDD-REFACTOR] <浠诲姟ID> <鍐呭>锛堟棤鍏蜂綋閲嶆瀯鏃跺啓銆屾棤闇€閲嶆瀯 鉁撱€嶏級
  绂佹鍦ㄦ湭瀹屾垚姝ラ 1鈥? 涔嬪墠鎵ц姝ラ 3銆?*绂佹浠呭棣栦釜 US 鎵ц TDD锛屽悗缁?US 璺宠繃绾㈢伅鐩存帴瀹炵幇**锛涚姝㈡墍鏈変换鍔″畬鎴愬悗闆嗕腑琛ュ啓 TDD 璁板綍銆?
  **銆怲DD 绾㈢豢鐏褰曚笌楠屾敹銆?*
  姣忓畬鎴愪竴涓秹鍙婄敓浜т唬鐮佺殑浠诲姟鐨勭豢鐏悗锛岀珛鍗冲湪 progress 杩藉姞涓夎锛?  `[TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed`
  `[TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed`
  `[TDD-REFACTOR] <浠诲姟ID> <鍐呭> | 鏃犻渶閲嶆瀯 鉁揱
  闆嗘垚浠诲姟 REFACTOR 鍙啓銆屾棤鏂板鐢熶骇浠ｇ爜锛屽悇妯″潡鐙珛鎬у凡楠岃瘉锛屾棤璺ㄦā鍧楅噸鏋?鉁撱€嶃€?  浜や粯鍓嶈嚜妫€锛氬姣忎釜娑夊強鐢熶骇浠ｇ爜鐨勪换鍔★紝progress 椤诲惈 [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR]锛堟垨銆孴xx 鏃犻渶閲嶆瀯 鉁撱€嶏級鍚勮嚦灏戜竴琛岋紱涓?[TDD-RED] 琛岄』鍦?[TDD-GREEN] 琛屼箣鍓嶃€傜己浠讳竴椤瑰垯琛ュ厖鍚庡啀浜や粯銆傜姝㈡墍鏈?US 瀹屾垚鍚庢墠闆嗕腑琛ュ啓銆?
  璇峰 Story {epic_num}-{story_num} 鎵ц Dev Story 瀹炴柦銆?
  **Post-audit persistence and unified host close-out for each stage (mandatory)**:

  锛?锛夊悇 stage 瀹¤閫氳繃鏃讹紝灏嗘姤鍛婁繚瀛樿嚦 speckit-workflow 搂x.2 绾﹀畾璺緞锛泂pec/plan/GAPS/tasks 闃舵璺緞鍒嗗埆涓?specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/ 涓嬬殑 AUDIT_spec-銆丄UDIT_plan-銆丄UDIT_GAPS-銆丄UDIT_tasks-E{epic_num}-S{story_num}.md锛涚粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count銆?
  锛?锛塮ail 杞姤鍛婁繚瀛樿嚦 AUDIT_{stage}-E{epic}-S{story}_round{N}.md銆?*楠岃瘉杞?*锛堣繛缁?3 杞棤 gap 鐨勭‘璁よ疆锛夋姤鍛?*涓嶅垪鍏?iterationReportPaths**锛屼粎 fail 杞強鏈€缁?pass 杞弬涓庢敹闆嗐€俻ass 鏃朵富 Agent 鏀堕泦鏈?stage 鎵€鏈?fail 杞姤鍛婅矾寰勶紝浼犲叆 `--iterationReportPaths path1,path2,...`锛堥€楀彿鍒嗛殧锛夛紱**涓€娆￠€氳繃鎴栨棤 fail 杞椂涓嶄紶**銆?
  锛?锛塗he invoking host/runner must call `runAuditorHost` for spec/plan/GAPS/tasks stage close-out; the main Agent no longer hand-runs `bmad-speckit score`. **iteration_count passing (mandatory)**: pass the cumulative number of failed rounds for the stage; use 0 for first-pass success; verification rounds in a 3-round no-gap check do not increment `iteration_count`; omission is prohibited.

  锛?锛塱mplement 闃舵 artifactDocPath 鍙负 story 瀛愮洰褰曞疄鐜颁富鏂囨。璺緞鎴栫暀绌恒€?
  锛?锛夎皟鐢ㄥけ璐ユ椂璁板綍 resultCode 杩涘璁¤瘉鎹紝涓嶉樆鏂祦绋嬨€?
  **蹇呴』宓屽鎵ц speckit-workflow 瀹屾暣娴佺▼**锛歴pecify 鈫?plan 鈫?GAPS 鈫?tasks 鈫?鎵ц銆?
  **涓婁笅鏂囦笌璺緞**锛?  - Story 鏂囨。锛歿project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{story_num}-*/*.md
  - 浜у嚭璺緞锛歋tory 鏂囨。鍏?story 瀛愮洰褰?`epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-{slug}.md`
  - BUGFIX/TASKS 鏂囨。锛氾紙鐢变富 Agent 浼犲叆瀹為檯璺緞锛?  - 椤圭洰鏍圭洰褰曪細{project-root}

  **蹇呴』閬靛畧**锛歳alph-method锛堟墽琛屽墠**蹇呴』**鍦?`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/` 鍒涘缓 prd.{stem}.json 涓?progress.{stem}.txt锛坰tem 涓?tasks 鏂囨。 stem锛夛紱姣忓畬鎴愪竴涓?US 蹇呴』鏇存柊 prd锛坧asses=true锛夈€乸rogress锛堣拷鍔?story log锛夛紱鎸?US 椤哄簭鎵ц銆?*绂佹**鍦ㄦ湭鍒涘缓涓婅堪鏂囦欢鍓嶅紑濮嬬紪鐮侊級銆乀DD 绾㈢豢鐏€乻peckit-workflow銆佺姝吉瀹炵幇銆佸け璐ョ敤渚嬮』淇垨璁般€乸ytest 鍦ㄩ」鐩牴鐩綍杩愯銆?
**implement 鎵ц绾︽潫**锛氭墽琛?implement锛堟垨绛変环鎵ц tasks锛夋椂锛屽瓙 Agent 蹇呴』鍔犺浇 speckit-workflow 涓?ralph-method 鎶€鑳斤紝鎴栬嚦灏戦伒瀹?commands/speckit.implement.md 涓祵鍏ョ殑 ralph 姝ラ锛堟楠?3.5銆?銆?锛夛紱涓嶅緱浠呭嚟銆屾墽琛?tasks銆嶇殑娉涘寲鐞嗚В鑰岃烦杩?prd/progress 鍒涘缓涓?per-US 鏇存柊銆?
  璇疯鍙?ralph-method 鎶€鑳戒笌 speckit-workflow 鎶€鑳斤紝涓ユ牸鎸夌収鍏惰鍒欐墽琛屻€?
  瀛愪换鍔¤繑鍥炲悗锛屼富 Agent 蹇呴』鍙戣捣闃舵鍥涘疄鏂藉悗瀹¤锛圫TORY-A4-POSTAUDIT锛夛紝绂佹璺宠繃銆傚疄鏂藉悗瀹¤涓哄繀椤绘楠わ紝闈炲彲閫夈€?```
#### 3.3.1 Cleanup after the subtask returns (mandatory step for the main Agent)

After the subtask (STORY-A3-DEV) returns or times out, the main Agent **must** execute in order and is **not allowed** to skip:

1. **cleanup**: Check `_bmad-output/current_pytest_session_pid.txt`; if the file exists, **must** execute the following commands corresponding to the platform and delete the file; **not allowed** to skip.
2. **Only allowed next action**: **Immediately** initiate a Phase 4 post-implementation audit (STORY-A4-POSTAUDIT). **PROHIBITED** Restarting the Phase 3 Dev Story subtask.

cleanup command (choose one to execute according to the platform):

- **Linux/macOS**: `python tools/cleanup_test_processes.py --only-from-file --session-pid $(cat _bmad-output/current_pytest_session_pid.txt)`
- **Windows (PowerShell)**: `python tools/cleanup_test_processes.py --only-from-file --session-pid (Get-Content _bmad-output/current_pytest_session_pid.txt)`
- **Windows (cmd)**: `for /f %i in (_bmad-output\current_pytest_session_pid.txt) do python tools/cleanup_test_processes.py --only-from-file --session-pid %i`

Delete `_bmad-output/current_pytest_session_pid.txt` after execution is completed.

---

## Phase 4: Post-implementation audit (enhanced version)

This stage is a **required** step and is not optional. The main Agent must initiate the subtask after returning and cannot skip it. **Strictness: strict**, subject to [audit-post-impl-rules.md](../speckit-workflow/references/audit-post-impl-rules.md) (path: `.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`).

### Convergence condition (strict, required)

- **No gaps for 3 consecutive rounds**: The audit conclusions for 3 consecutive rounds are all "fully covered and verified", and the critical auditor conclusion paragraphs in the 3 reports all indicate "no new gaps in this round". If there is a gap in any round, the calculation will be restarted from the next round.
- **Critical Auditor >50%**: The report must contain the "## Critical Auditor Conclusion" paragraph, which has no fewer words or entries than the rest of the report; the required structure is shown in [audit-prompts-critical-auditor-appendix.md](../speckit-workflow/references/audit-prompts-critical-auditor-appendix.md).
- Before initiating the second and third rounds of audits, the main Agent can output "Nth round of audit passed, continue verification..." to prompt the user.

### Pre-check

Before conducting a post-implementation audit, it must be confirmed that:
- [ ] speckit specify stage code-review audit passed (搂1)
- [ ] The speckit plan stage code-review audit has passed (搂2)
- [ ] speckit GAPS stage code-review audit has passed (搂3)
- [ ] The speckit tasks phase code-review audit has passed (搂4)
- [ ] The speckit execution phase code-review audit has passed (搂5)
- [ ] TDD records are complete (including three stages of RED/GREEN/REFACTOR)
- [ ] ralph-method progress file updated

If any item fails, the audit must be completed first.

### Comprehensive audit

Use `audit-prompts.md 搂5` for comprehensive validation. **Report parsable blocks must comply with 搂5.1** (four dimensions: functionality, code quality, test coverage, security), consistent with _bmad/_config/code-reviewer-config.yaml modes.code.dimensions, otherwise the code-mode scoring parser cannot parse them and the dashboard displays "No data" in the four dimensions.

**[搂5 Parsable block requirements (implement-only)]** The parsable scoring block at the end of the report **must** use the modes.code four dimension lines exactly as mandated in `audit-prompts.md` 搂5.1 / `code-reviewer-config.yaml` (Chinese labels for functionality, code quality, test coverage, security 鈥?copy verbatim from the STORY-A4-POSTAUDIT prompt fence). **Do not** use the story-stage four lines (requirements completeness, testability, consistency, traceability). The overall-rating line must use the bare `A|B|C|D` pattern with no `+`/`-` suffixes. Otherwise the code-mode scoring parser cannot parse the block and the dashboard shows empty dimension data.

**Audit Dimensions**:
1. Requirements coverage: Whether all requirements in the Story document are implemented
2. Test completeness: Are unit tests and integration tests sufficient?
3. Code quality: Does it comply with the project coding specifications?
3.1. Lint: The project must configure and execute Lint according to the technology stack (see lint-requirement-matrix); if a mainstream language is used but Lint is not configured, it must be regarded as a failed item; if it has been configured, it must be executed without errors or warnings. "Irrelevant to this mission" exemptions are prohibited.
4. Document consistency: Whether the Story document, spec, plan, and code are consistent
5. Traceability: Is the link from PRD requirements 鈫?Story 鈫?spec 鈫?task 鈫?code complete?

**Mandatory audit items (consistent with bmad-bug-assistant BUG-A4-POSTAUDIT)**:
- **TDD sequence verification**: For the progress record of each task, [TDD-RED] must appear before [TDD-GREEN]; if [TDD-GREEN] appears before [TDD-RED] or lacks [TDD-RED], it will be judged as "post-incident" and the conclusion will not pass.
- **Regression determination (mandatory)**: Any test case that existed before this Story鈥檚 implementation and fails after implementation counts as a regression; fix it or, with user approval, add it to the formal exclusion list. Do not excuse failures with 鈥渞elated to Story X鈥? 鈥渦nrelated to this Story鈥? 鈥渇rom a prior Story鈥? etc. Mandatory steps: run full regression and classify each failure; if someone claims 鈥渦nrelated to this Story鈥?without a formal exclusion record, the audit conclusion is fail.

**Audit method**:
- Priority: Cursor Task scheduling code-reviewer
- Fallback: mcp_task generalPurpose + audit-prompts.md 搂5 content

### Audit conclusion processing

**Pass (Grade A/B)**:
- Story marked as complete
- #### Step 4.3: Story completion self-check (mandatory, run first)
  - Before **completion options** are provided, the main Agent **must first** confirm that the unified auditor host runner has completed implement-stage post-audit automation.
  - If host close-out is already complete, there is no need to perform step 4.2.
  - If host close-out is missing and `AUDIT_Story_{epic}-{story}_stage4.md` exists, the main Agent performs step 4.2 to backfill.
  - If the report parsable block uses the wrong dimensions, fix the report first and then run `runAuditorHost` again.
  - If the backfill fails, it remains non-blocking and the main flow continues.
- #### Step 4.2: Run runAuditorHost (executed when step 4.3 determines host close-out is missing)
  - When step 4.3 determines host close-out is missing and the report exists, the main Agent executes: `npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage implement --artifactPath <story document path> --reportPath <report path> --iterationCount {The cumulative number of fail rounds for this stage, 0 means one pass}`
  - If the call fails, record the resultCode and do not block the process (non-blocking).
- #### Unified host close-out after the audit passes (mandatory)
  - The sub-agent returns the fields required by the host runner in [Must do after passing the audit]; the main Agent uses steps 4.3/4.2 to verify completion and backfill when needed. **It must contain `--iteration-count {cumulative value}`**; stage=implement; failure remains non-blocking.
- Provides completion options (see below)

**Conditional Pass (Level C)**:
- List issues that must be fixed
- Re-audit after repair

**Fail (Grade D)**:
- List major issues
- You may need to go back to Layer 3 and create Story again.
- Or go back to a specific stage of speckit and re-execute it

### Post-completion options

When the Story audit passes, the following options are provided (see **Phase 5: Closing and Integration (Enhanced Version)** for detailed implementation):

**[0] Submit code**
-Ask whether to commit the current changes to the local repository
- If yes is selected, the auto-commit-utf8 skill is automatically called to generate a Chinese commit message and submit it.

**[1] Start the next Story**
- Switch to the next Story branch within the same Epic worktree
- Automatically detect and handle cross-story dependencies

**[2] Create PR and wait for review**
- Push the current Story branch to the remote
- Create PR (call pr-template-generator to generate description)
- Enter the mandatory manual review process

**[3] Batch Push all Story branches**
- Push all completed Story branches under Epic
- Create PR for each Story
- Enter the batch manual review process

**[4] Keep branch for later processing**
- Keep current branch status
- Allow to continue later

### Epic Complete Check

When all Stories under Epic are completed:
1. Verify that all Story PRs have been merged into the feature-epic-{num} branch
2. Execute Epic-level integration testing
3. Create an Epic-level PR (merged into main)
4. Enter mandatory manual review again
5. Clean up the Epic worktree (optional); (**GAP-045 fix**: Cleaning conditions: Epic PR has been merged and there are no pending issues; retention time: 7 days is recommended; recovery: re-checkout the feature-epic-{num} branch from main); (**GAP-086 fix**: The user chooses whether to clean; or the system recommends the user to confirm)

### Phase 5: Closing and Integration (Enhanced Version)

**GAP-074 Precondition**: Before executing option [2] or [3], make sure pr-template-generator is installed or confirmed in the pre-probe. If it does not exist, output the installation instructions (such as `cursor skills install pr-template-generator` or refer to the Cursor skills documentation) and skip PR description generation; a placeholder template can be used instead.

When all stories are completed, the following options are available:

#### Option [0] Submit code
-Ask whether to commit the current changes to the local repository
- If yes is selected, the auto-commit-utf8 skill is automatically called to generate a Chinese commit message and submit it.

#### Option [1] Continue to the next Story
- Switch to the next Story branch within the same Epic worktree
- Automatically detect and handle cross-story dependencies
- If the pre-story is not completed, you will be prompted to wait.

#### Option [2] Create PR and wait for review
- Push the current Story branch to the remote
- **Automatically call pr-template-generator to generate PR description** (see GAP-074 above for prerequisites)
- Create a PR and enter the mandatory manual review process

**pr-template-generator call**:
```bash
# 鍒嗘瀽褰撳墠鍒嗘敮鐨刢ommits
analyze_commits(story_branch)

# 鐢熸垚PR妯℃澘
pr_template = generate_pr_template(
    story_id="4.1",
    story_title="metrics cache fix",
    commits=commit_history,
    files_changed=changed_files,
    tests_added=test_files
)

# PR妯℃澘鍐呭鍖呮嫭锛?# - Story鑳屾櫙鍜岀洰鐨?# - 涓昏鏀瑰姩鐐癸紙鍩轰簬commit message锛?# - 娴嬭瘯瑕嗙洊鎯呭喌
# - 褰卞搷鑼冨洿
# - 鍥炴粴鏂规
```
#### Option [3] Batch Push all Story branches
- Push all completed Story branches under Epic to the remote
- **Automatically create PR for each Story (using pr-template-generator, see GAP-074 for prerequisites)**
- Enter the batch manual review process

**Batch processing process**:
```
For each completed_story in epic.stories:
    1. Push story_branch to origin
    2. Generate PR template using pr-template-generator
    3. Create PR with generated template
    4. Add to batch_review_queue

Display batch review summary:
- Total PRs created: N
- Epic: feature-epic-4
- Ready for review
```
**Batch Push implementation details**:

**Precondition check**:
```python
def batch_push_precheck(epic_id):
    # 1. 妫€鏌ユ墍鏈塖tory鏄惁宸插畬鎴?    incomplete_stories = get_incomplete_stories(epic_id)
    if incomplete_stories:
        warn(f"浠ヤ笅Story鏈畬鎴? {incomplete_stories}")
        if not user_confirm("鏄惁鍙帹閫佸凡瀹屾垚鐨凷tory锛?):
            return False

    # 2. 妫€鏌ヨ繙绋嬩粨搴撹繛鎺?    if not test_remote_connection():
        error("鏃犳硶杩炴帴鍒拌繙绋嬩粨搴?)
        return False

    # 3. 妫€鏌ユ潈闄?    if not has_push_permission():
        error("娌℃湁鎺ㄩ€佹潈闄?)
        return False

    return True
```
**Batch push process**:
```python
def batch_push_stories(epic_id):
    results = []

    for story in get_completed_stories(epic_id):
        try:
            # 1. 鍒囨崲鍒癝tory鍒嗘敮
            checkout_branch(f"story-{epic_id}-{story.num}")

            # 2. 鎷夊彇鏈€鏂颁唬鐮侊紙閬垮厤鍐茬獊锛?            pull_latest()  # GAP-082 淇锛歱ull 澶辫触锛堝鍐茬獊锛夋椂榛樿 skip 璇?Story 缁х画涓嬩竴 Story 骞惰褰曪紱鍙€夈€屾彁绀虹敤鎴疯В鍐炽€嶆ā寮?
            # 3. 鎺ㄩ€佸埌杩滅▼
            push_to_remote(f"story-{epic_id}-{story.num}")

            # 4. 鐢熸垚PR妯℃澘
            pr_template = generate_pr_template(story)

            # 5. 鍒涘缓PR
            pr_url = create_pull_request(
                title=f"Story {epic_id}.{story.num}: {story.title}",
                body=pr_template,
                head=f"story-{epic_id}-{story.num}",
                base=f"feature-epic-{epic_id}"
            )

            results.append({
                "story": story.num,
                "status": "success",
                "pr_url": pr_url
            })

        except Exception as e:
            results.append({
                "story": story.num,
                "status": "failed",
                "error": str(e)
            })

    return results
```
**Error handling**:
- Failure to push a single Story will not affect other Stories
- Record the story and reasons for failure
- Provide retry mechanism

**Progress display**:
```
鎵归噺鎺ㄩ€佷腑...
[1/7] Story 4.1: 鎺ㄩ€佷腑... 鉁?瀹屾垚锛孭R #123
[2/7] Story 4.2: 鎺ㄩ€佷腑... 鉁?瀹屾垚锛孭R #124
[3/7] Story 4.3: 鎺ㄩ€佷腑... 鉂?澶辫触锛堢綉缁滈敊璇級
[4/7] Story 4.4: 鎺ㄩ€佷腑... 鉁?瀹屾垚锛孭R #125
...

鎺ㄩ€佸畬鎴愶細6/7 鎴愬姛
澶辫触锛歋tory 4.3
鏄惁閲嶈瘯澶辫触鐨凷tory锛焄Y/n]
```
#### Option [4] Keep branch for later processing
- Keep current branch status
- Allow to continue later
- Record current progress to metadata

#### Mandatory manual review process

No matter which option is selected, the PR Merge link **must not automatically merge**:

**Single PR review interface**:
```
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                   馃敀 PR瀹℃牳璇锋眰                            鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: feature-epic-4 (鐢ㄦ埛绠＄悊绯荤粺閲嶆瀯)                    鈺?鈺? PR: #123 Story 4.1: metrics cache fix                     鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 馃搳 CI鐘舵€?        鉁?鍏ㄩ儴閫氳繃                              鈺?鈺? 馃搱 瑕嗙洊鐜囧彉鍖?    +2.3%                                   鈺?鈺? 馃攳 浠ｇ爜瀹℃煡:      鉁?宸查€氳繃 code-reviewer锛?*GAP-059 淇**锛氳皟鐢ㄦ椂浼犲叆 mode=pr锛屼粠 code-reviewer-config 璇诲彇 pr 妯″紡鎻愮ず璇嶏級                 鈺?鈺? 馃搧 褰卞搷鏂囦欢:      12涓?                                   鈺?鈺? 馃摑 PR鎻忚堪:        [鐢眕r-template-generator鐢熸垚]           鈺?鈺?                                                           鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯骞禡erge                                        鈺?鈺? [2] 鉂?鎷掔粷锛岃繑鍥炰慨鏀?                                     鈺?鈺? [3] 馃憖 鏌ョ湅璇︾粏diff                                       鈺?鈺? [4] 鈴笍  璺宠繃姝R                                          鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
```
**Batch review interface**:
```
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                馃敀 鎵归噺PR瀹℃牳璇锋眰                           鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: feature-epic-4                                       鈺?鈺? 寰呭鏍窹R: 3涓?                                             鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? [#123] Story 4.1 - 鉁?CI閫氳繃 - 鉁?瀹¤A绾?                 鈺?鈺? [#124] Story 4.2 - 鉁?CI閫氳繃 - 鉁?瀹¤B绾?                 鈺?鈺? [#125] Story 4.3 - 鉁?CI閫氳繃 - 鈿狅笍  瀹¤C绾э紙闇€鍏虫敞锛?      鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯鍏ㄩ儴骞堕€愪釜Merge                                鈺?鈺? [2] 鉁?鎵瑰噯閮ㄥ垎锛堥€夋嫨锛?                                  鈺?鈺? [3] 鉂?鎷掔粷鍏ㄩ儴锛岃繑鍥炰慨鏀?                                鈺?鈺? [4] 馃憖 閫愪釜鏌ョ湅璇︽儏                                       鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
```
**Important Constraints**:
- Must wait for the user to explicitly select [1] and confirm before merging
- Automatic merge is strictly prohibited
- PRs that fail the review cannot be merged

#### Implementation of forced manual review interface

**Core Principle**: Automatic merge is absolutely not allowed and must stop waiting for manual confirmation.

**Single PR review interface**:
```python
def show_pr_review_interface(pr_info):
    # 鑾峰彇PR璇︾粏淇℃伅
    ci_status = get_ci_status(pr_info.id)
    coverage_change = get_coverage_change(pr_info.id)
    code_review_result = get_code_review_result(pr_info.id)
    affected_files = get_affected_files(pr_info.id)

    # 鏄剧ず瀹℃牳鐣岄潰
    display(f"""
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                   馃敀 PR瀹℃牳璇锋眰                            鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: {pr_info.epic_name}                                  鈺?鈺? PR: #{pr_info.id} {pr_info.title}                         鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 馃搳 CI鐘舵€?        {ci_status.emoji} {ci_status.text}       鈺?鈺? 馃搱 瑕嗙洊鐜囧彉鍖?    {coverage_change}                        鈺?鈺? 馃攳 浠ｇ爜瀹℃煡:      {code_review_result.emoji} {code_review_result.grade}绾?鈺?鈺? 馃搧 褰卞搷鏂囦欢:      {len(affected_files)}涓?                 鈺?鈺? 馃摑 PR鎻忚堪:        [鐢眕r-template-generator鐢熸垚]           鈺?鈺?                                                           鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯骞禡erge                                        鈺?鈺? [2] 鉂?鎷掔粷锛岃繑鍥炰慨鏀?                                     鈺?鈺? [3] 馃憖 鏌ョ湅璇︾粏diff                                       鈺?鈺? [4] 鈴笍  璺宠繃姝R                                          鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
    """)

    # 绛夊緟鐢ㄦ埛杈撳叆锛堣疆璇㈡ā寮忥紝24h瓒呮椂锛?    # GAP-010 淇锛欳ursor/Claude 鏃犵幇鎴?wait_for_user_input_with_polling API锛岄渶鑷瀹炵幇
    # 瀹炵幇寤鸿锛氳緭鍑?prompt 鍚庣粨鏉熸湰杞紱鐢ㄦ埛鍦ㄤ笅鏉℃秷鎭洖澶?1/2/3/4
    # 瓒呮椂/鎻愰啋锛氫粎鍦ㄤ細璇濅腑鎵撳嵃鎻愮ず淇℃伅锛屾殏涓嶉泦鎴愰偖浠?Slack 绛夊鎺?    choice = wait_for_user_input_with_polling(
        timeout_hours=24,
        poll_interval_minutes=30,
        on_timeout=lambda: print(f"[瓒呮椂鎻愰啋] PR #{pr_info.id} 寰呭鏍稿凡瓒呰繃24灏忔椂銆傝灏藉揩瀹屾垚瀹℃牳锛屾垨閫夋嫨璺宠繃/鎷掔粷銆?)
    )

    if choice == "1":
        confirm = ask("纭畾瑕佹壒鍑嗗苟Merge姝R锛?[yes/no]: ")
        if confirm.lower() == "yes":
            merge_pull_request(pr_info.id)
            return "merged"
        else:
            return "cancelled"
    elif choice == "2":
        reason = ask("鎷掔粷鍘熷洜: ")
        reject_pull_request(pr_info.id, reason)
        return "rejected"
    elif choice == "3":
        show_diff(pr_info.id)
        return show_pr_review_interface(pr_info)  # 閫掑綊鏄剧ず
    elif choice == "4":
        return "skipped"
```
**Batch review interface**:
```python
def show_batch_review_interface(epic_id, pr_list):
    pr_statuses = [get_pr_status(pr) for pr in pr_list]

    display(f"""
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                馃敀 鎵归噺PR瀹℃牳璇锋眰                           鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: {epic_id}                                            鈺?鈺? 寰呭鏍窹R: {len(pr_list)}涓?                                鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?""")

    for i, (pr, status) in enumerate(zip(pr_list, pr_statuses), 1):
        display(f"鈺? [#{pr.id}] Story {pr.story_id} - {status.ci_emoji} CI{status.ci_status} - {status.review_emoji} 瀹¤{status.grade}绾?)

    display("""
鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯鍏ㄩ儴骞堕€愪釜Merge                                鈺?鈺? [2] 鉁?鎵瑰噯閮ㄥ垎锛堥€夋嫨锛?                                  鈺?鈺? [3] 鉂?鎷掔粷鍏ㄩ儴锛岃繑鍥炰慨鏀?                                鈺?鈺? [4] 馃憖 閫愪釜鏌ョ湅璇︽儏                                       鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
    """)

    choice = wait_for_user_input_with_polling(timeout_hours=24, poll_interval_minutes=30)

    if choice == "1":
        confirm = ask(f"纭畾瑕佹壒鍑嗗叏閮▄len(pr_list)}涓狿R骞堕€愪釜Merge锛?[yes/no]: ")
        if confirm.lower() == "yes":
            for pr in pr_list:
                merge_pull_request(pr.id)
            return "all_merged"
    elif choice == "2":
        # GAP-046/GAP-088 淇锛歴elect_prs_to_merge UI 浜や簰
        selected = select_prs_to_merge(pr_list)
        for pr in selected:
            merge_pull_request(pr.id)
        return f"{len(selected)}_merged"
    # ... 鍏朵粬閫夐」
```
**select_prs_to_merge UI interaction (GAP-046/GAP-088)**:
```python
def select_prs_to_merge(pr_list):
    """鎵瑰噯閮ㄥ垎PR鏃剁殑閫夋嫨閫昏緫"""
    display(pr_list with indices 1..n)
    raw = input("杈撳叆搴忓彿锛岄€楀彿鎴栬寖鍥达紝濡?1,3,5 鎴?1-3: ")
    indices = parse_indices(raw, max_n=len(pr_list))
    # 绌鸿緭鍏モ啋[]锛涢潪娉曟牸寮忊啋鎻愮ず閲嶈緭锛涜秺鐣屸啋蹇界暐
    return [pr_list[i-1] for i in indices if 1 <= i <= len(pr_list)]
```
**Audit reminder mechanism** (only printed in session, not integrated with email/Slack yet):
```python
# GAP-056 淇锛氬凡鐭ラ檺鍒垛€斺€旂敤鎴峰叧闂細璇濆悗 reopen 鏃舵彁閱掓棤娉曢€佽揪锛涘彲琛ュ厖銆屼細璇濇仮澶嶆椂妫€鏌ュ緟瀹℃牳 PR 骞舵彁绀恒€?if time_since_last_activity() > timedelta(hours=24):
    print(f"[鎻愰啋] Epic {epic_id} 鏈夊緟瀹℃牳PR锛屽叡 {pending_pr_count} 涓凡瓒呰繃24灏忔椂锛岃灏藉揩澶勭悊銆?)
```
**Review SLA Agreement** (recommended):
- P0 PR: response within 4 hours
- P1 PR: response within 24 hours
- P2 PR: response within 72 hours

**Runtime Governance (S11 - post-audit):** The main Agent executes before calling the post-audit subtask:
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit`
Execute after the subtask returns:
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit --persist`
`{story_key}` is the kebab-case key of the current Story.

### 4.1 Audit sub-agent and prompt words

Same as Phase 2: **Priority** Cursor Task schedules code-reviewer; **Fallback** mcp_task generalPurpose. The main Agent must copy the entire prompt template of **STORY-A4-POSTAUDIT** and replace the placeholders before passing it in. **The prompt passed into the audit subtask must contain [搂5 parsable block requirements (implement-specific)]** (see the previous section on comprehensive auditing), and be accompanied by audit-prompts 搂5.1 or audit-prompts-code.md parsable block examples (functionality, code quality, test coverage, security). **[Must do after passing the audit]**: when the conclusion is "complete coverage, verification passed", you (audit subagent) **must** return `projectRoot`, `reportPath`, `artifactDocPath=<story document path>`, and `stage=implement` so the invoking host/runner can call `runAuditorHost`; the report path is `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`; if host execution fails, indicate the resultCode in the conclusion; **it is forbidden** to return a passing conclusion before the host close-out is complete. For detailed templates, see the historical version of this skill or speckit-workflow references.

If the audit conclusion is **failed**, **must** be modified according to the audit report and be initiated again until "complete coverage and verification passed".

**涓嶄腑鏂墽琛?contract**: The implementation subagent must continuously complete all remaining scoped User Stories/tasks. It must not pause after a milestone and wait for main-Agent approval. Control may return to the main Agent only when: 鈶?all work in the current scope is finished and the flow can enter post-audit; 鈶?a real blocker requires reroute / remediation; 鈶?an explicit audit or checkpoint boundary defined by this skill has been reached. 鎹㈣█涔嬶紝瀛愪唬鐞嗗繀椤昏繛缁畬鎴愬綋鍓嶄綔鐢ㄥ煙鍐呯殑鍏ㄩ儴鍓╀綑 User Story/浠诲姟銆?
---

## Phase 5: Skill self-audit (when skill is created)

When this skill is newly created or significantly modified, an audit subtask should be initiated for the skill file. Follow 搂2.1 / 搂4.1 order of precedence (code-reviewer first, generalPurpose on failure).
```yaml
# 鍥為€€鏂规绀轰緥
tool: mcp_task
subagent_type: generalPurpose
description: "Audit bmad-story-assistant skill"
prompt: |
  浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛樸€傝瀵广€宐mad-story-assistant SKILL.md銆嶈繘琛屽璁°€?
  瀹¤鍐呭锛?  1. 鏄惁瀹屾暣瑕嗙洊鐢ㄦ埛瑕佹眰鐨?Create Story銆佸璁°€丏ev Story銆佸疄鏂藉悗瀹¤銆丼kill 鑷璁?鍏ㄦ祦绋嬨€?  2. Epic/Story 缂栧彿浣滀负杈撳叆鐨勮鏄庢槸鍚︽竻鏅帮紝鍗犱綅绗?{epic_num}銆亄story_num}銆亄project-root} 鏄惁涓€鑷淬€?  3. 寮曠敤鐨勫懡浠ゃ€佹妧鑳芥槸鍚﹀噯纭細/bmad-bmm-create-story銆?bmad-bmm-dev-story銆乵cp_task銆乺alph-method銆乻peckit-workflow銆乤udit-prompts.md 搂5銆?  4. 涓?Agent 绂佹鐩存帴淇敼鐢熶骇浠ｇ爜銆佸繀椤婚€氳繃 mcp_task 濮旀墭绛夌害鏉熸槸鍚︽槑纭€?  5. 涓枃琛ㄨ堪鏄惁娓呮櫚鏃犳涔夈€?  6. 瀹¤姝ラ鏄惁鏄庣‘锛歮cp_task 涓嶆敮鎸?code-reviewer锛涗紭鍏?Cursor Task 璋冨害 code-reviewer銆佸け璐ュ垯鍥為€€ mcp_task generalPurpose锛涙槸鍚﹂伩鍏嶅己鍒躲€屽繀椤荤敤 mcp_task銆嶏紱闃舵浜屼娇鐢?Story 涓撶敤鎻愮ず璇嶃€侀樁娈靛洓浣跨敤瀹屾暣 audit-prompts 搂5銆?  7. **鎺ㄨ繜闂幆**锛氱姝㈣瘝琛ㄦ槸鍚﹀惈銆屽厛瀹炵幇銆佸悗缁墿灞曘€佹垨鍚庣画鎵╁睍銆嶏紱鏄惁鍚€孲tory 鑼冨洿琛ㄨ堪绀轰緥銆嶏紱闃舵浜屽璁℃槸鍚﹀惈銆岀敱 Story X.Y 璐熻矗銆嶇殑楠岃瘉椤癸紱瀹¤鏈€氳繃鏃朵富 Agent 鏄惁椤诲厛鎵ц銆屽垱寤?鏇存柊 Story X.Y銆嶅啀鍐嶆瀹¤锛汣reate Story 鏄惁鍚闈㈡寚寮曪紙鍔熻兘涓嶅湪鏈?Story 浣嗗睘 Epic 鏃堕』鍐欐槑褰掑睘锛夈€?
  鎶ュ憡缁撳熬蹇呴』鏄庣‘缁欏嚭缁撹锛氭槸鍚︺€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭鏈€氳繃椤瑰強淇敼寤鸿銆?```
Iteratively modify SKILL.md and audit again until the report conclusion is "fully covered and verified."

---

## BMAD Agent display name and command comparison

In scenarios such as mcp_task subtask invocation, Party Mode multi-round dialogue, workflow guidance, etc., the following **display name** should be used to refer to each Agent to maintain context consistency and user experience.

| Agent display name | Command name | Module |
|--------------|--------|------|
| BMad Master | `bmad-agent-bmad-master` | core |
| Mary Analyst | `bmad-agent-bmm-analyst` | bmm |
| John Product Manager | `bmad-agent-bmm-pm` | bmm |
| Winston Architect | `bmad-agent-bmm-architect` | bmm |
| Amelia Development | `bmad-agent-bmm-dev` | bmm |
| Bob Scrum Master | `bmad-agent-bmm-sm` | bmm |
| Quinn test | `bmad-agent-bmm-qa` | bmm |
| Paige Technical Writing | `bmad-agent-bmm-tech-writer` | bmm |
| Sally UX | `bmad-agent-bmm-ux-designer` | bmm |
| Barry Quick Flow | `bmad-agent-bmm-quick-flow-solo-dev` | bmm |
| Bond Agent Build | `bmad-agent-bmb-agent-builder` | bmb |
| Morgan Module Build | `bmad-agent-bmb-module-builder` | bmb |
| Wendy Workflow Build | `bmad-agent-bmb-workflow-builder` | bmb |
| Victor Innovation Strategy | `bmad-agent-cis-innovation-strategist` | cis |
| Dr. Quinn Problem Solving | `bmad-agent-cis-creative-problem-solver` | cis |
| Maya Design Thinking | `bmad-agent-cis-design-thinking-coach` | cis |
| Carson brainstorming | `bmad-agent-cis-brainstorming-coach` | cis |
| Sophia Storyteller | `bmad-agent-cis-storyteller` | cis |
| Caravaggio presentation | `bmad-agent-cis-presentation-master` | cis |
| Murat test architecture | `bmad-agent-tea-tea` | tea |
| critical auditor | (only used in party-mode, no independent command) | core |

**Instructions for use**:
- **mcp_task subtask context**: Use the display name when referencing the BMAD workflow or recommending next steps in the prompt (such as "can be handed over to Winston architect for architecture review").
- **Party Mode multiple rounds of dialogue**: When Facilitator introduces and speaks, the role must be marked with a display name (such as "馃彈锔?**Winston Architect**:..." "馃捇 **Amelia Developer**:..."), which is consistent with the `displayName` of `_bmad/_config/agent-manifest.csv` and the above table.

---

## Role configuration

### Critical Auditor

**Role Positioning**:
An independent critical thinking expert who focuses on finding loopholes in solutions, questioning assumptions, and challenging design decisions.
In all Party-Mode discussions, the Critical Auditor must speak first each round.

**Core Responsibilities**:
1. Actively participate in the debate during the Layer 1 PRD Party-Mode stage (mandatory)
2. Actively participate in the debate during the Layer 1 Architecture Party-Mode stage (mandatory)
3. Actively participate in the debate during the Layer 3 Create Story Party-Mode stage (mandatory)
4. Raise at least 5 in-depth questions on every key decision
5. Document all unresolved gaps and assumptions
6. Continue to challenge and do not compromise easily until a consensus is reached on the plan.
7. Ensure that the audit checklist (audit-prompts.md) is strictly implemented

**Powers and Permissions**:
1. **Suspension right**: When a major vulnerability is discovered, you can request to suspend the process
2. **Right of Recording**: All queries must be recorded and tracked
3. **Right of re-inspection**: You can request another audit of the revised plan
4. **One-vote veto**: When a fatal flaw is discovered, the plan can be vetoed to enter the next stage; (**GAP-060 Repair**: In the skill execution environment, when the critical auditor exercises the veto power, the Facilitator/Main Agent is responsible for pausing and recording, and is not allowed to enter the next stage)

**Intervention Phase**:
1. **Layer 1 PRD Party-Mode** (mandatory): Questioning the integrity of requirements, user value, and market positioning
2. **Layer 1 Architecture Party-Mode** (mandatory): Questioning technical feasibility, tradeoff rationality, and over-design
3. **Layer 3 Create Story Party-Mode** (mandatory): Question solution selection, scoping, and acceptance criteria
4. **speckit.plan stage** (on demand): intervene when the user explicitly requires it or when there is a technical dispute
5. **Audit phase** (enhanced): working in conjunction with code-review

**Exit Criteria**:
1. All questions were answered satisfactorily
2. Reach the convergence condition (consensus + no new gaps in the past 3 rounds)
3. The user explicitly accepts the risks and continues
4. Record the complete query list and resolution status

**Competency Requirements**:
1. Familiar with the audit checklist (audit-prompts.md)
2. Have critical thinking and logical analysis skills
3. Understand the technical architecture and implementation constraints
4. Have rich project experience and risk identification capabilities

**Typical Questions**:
- "What is the user value of this requirement? Is it supported by data?"
- "Is this technical solution over-engineered? Is there a simpler alternative?"
- "Is the scope clearly defined? Have boundary conditions been considered?"
- "Is this acceptance criterion testable? How to verify it?"
- "How scalable will it be in the next 3 years? Where will the technical debt accumulate?"

---

## References and paths

| Quote | Path/Description |
|------|-----------|
| Create Story command | `/bmad-bmm-create-story` (or command file `bmad-bmm-create-story.md`) |
| Dev Story command | `/bmad-bmm-dev-story` (or command file `bmad-bmm-dev-story.md`) |
| ralph-method skill | `ralph-method` SKILL.md |
| speckit-workflow skills | `speckit-workflow` SKILL.md |
| audit-prompts.md 搂5 | Preferred: global skills `speckit-workflow/references/audit-prompts.md` Section 5 (as under `~/.cursor/skills/`); alternative: within the project `{project-root}/docs/speckit/skills/speckit-workflow/references/audit-prompts.md` |
| workflow.xml | `{project-root}/_bmad/core/tasks/workflow.xml` |
| create-story workflow | `{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` |
| dev-story workflow | `{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` |
| party-mode workflow | `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` |
| agent-manifest | `{project-root}/_bmad/_config/agent-manifest.csv` (including displayName, etc.) |
| implementation_artifacts | `{project-root}/_bmad-output/implementation-artifacts/` |

**Note**: `_bmad` is the installation directory within the project and is not submitted to the repository; each worktree needs to install BMAD separately before the `_bmad` path exists.

### speckit-workflow reference constraints

When this skill is executed to "Phase 3: Dev Story Implementation", the following constraints must be followed:

1. **Process Constraints**
   - Must be executed in order: specify 鈫?plan 鈫?GAPS 鈫?tasks 鈫?execute
   - Each stage must pass the code-review audit before entering the next stage.
   - Skipping any stage or audit is strictly prohibited

2. **Document Constraints**
   - Story document must contain PRD requirements traceability chapter
   - spec-E{epic}-S{story}.md must reference the function description of the Story document
   - plan-E{epic}-S{story}.md must contain the test plan
   - tasks-E{epic}-S{story}.md must contain Architecture component constraints

3. **TDD constraints**
   - Must use unified [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] format
   - Must update ralph-method progress file
   - It is strictly forbidden to skip the red light stage or the reconstruction stage

4. **Audit Constraints**
   - Prioritize using Cursor Task to schedule code-reviewer
   - Use mcp_task fallback when code-reviewer is unavailable
   - All audits must reach Level A/B before they can continue

5. **Worktree Constraints**
   - The number of stories 鈮?2 uses story-level worktree
   - The number of stories 鈮?3 uses Epic-level worktree
   - When switching the Story branch, you must commit/stash uncommitted changes

**Violation handling**:
- Immediately suspend execution if violations are discovered
- Record violations and reasons
- Depends on severity: Warn/Return to previous stage/Create Story again

---

## Fallback mechanism

When major problems are discovered during the implementation process, it is allowed to roll back to the previous stage.

### Rollback scenes and commands

**Scenario 1: During the speckit stage, the Story document is found to be unclear**
- Symptom: Repeated audits failed in the specify/plan stage because the requirements were unclear.
- Fallback command: `/bmad-bmm-correct-course epic={num} story={num} reason="Unclear requirements"`
- Fallback target: Layer 3 Create Story stage
- Operation: Re-enter party-mode to clarify the requirements and update the Story document

**Scenario 2: Major flaws in the technical solution are discovered**
- Symptom: During the planning stage, it is found that the technical solution is not feasible and needs to be redesigned
- Rollback command: `/bmad-bmm-correct-course epic={num} story={num} reason="Technical solution defect"`
- Fallback target: Layer 3 Create Story stage
- Operation: Re-enter party-mode to discuss technical solutions

**Scenario 3: TDD execution discovers architectural issues**
- Symptom: During the execution phase, it is discovered that the architecture needs to be modified to pass the test.
- Fallback command: `/bmad-bmm-correct-course epic={num} story={num} reason="Architectural problem"`
- Fallback target: speckit plan stage
- Operation: Modify plan-E{epic}-S{story}.md and return to Create Story if necessary

**Scenario 4: PRD/Architecture needs to be changed**
- Symptom: Omissions or errors in PRD or Architecture are found during the implementation process
- Rollback command: `/bmad-bmm-correct-course epic={num} story={num} reason="PRD change"`
- Fallback target: Layer 1 product definition layer
- Action: Update PRD/Architecture and re-evaluate the scope of impact

### Fallback data retention

The following data is retained when rolling back:
- Original Story document (backed up as `story-{epic}-{story}-v{N}.md`)
- Generated spec/plan (for reference)
- TDD records (if any)
- Audit history

### Rollback limit (GAP-006 fix: differentiated from rollback)

- **Rollback** (correct-course): Return to the Create Story/speckit and other stages, calculated by **Story**; the same Story can be rolled back up to 3 times, and BMad Master is required to intervene if more than 3 times is rolled back.
- **Rollback** (rollback-worktree): The worktree returns from the Epic level to the Story level, calculated in **Epic**; the same Epic can be rolled back up to 2 times (see Task 3.6)
- **BMad Master intervention (GAP-037 fix)**: When rolling back > 3 times or rolling back > 2 times, the user or project leader needs to confirm; Approval steps: Record the reason 鈫?User confirms "continue" or "terminate" 鈫?reset the count if continuing
- Falling back to Layer 1 will reset the entire Epic plan
- Rollback/rollback operations must record the reasons and decision-making process
