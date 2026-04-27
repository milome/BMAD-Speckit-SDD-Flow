<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-standalone-tasks
description: |
  Codex CLI / OMC adapter entry for BMAD Standalone Tasks.
  Uses Cursor bmad-standalone-tasks as the semantic baseline: parse unfinished work 鈫?subagent implementation 鈫?post-implementation audit for TASKS/BUGFIX-driven execution.
  When the main Agent starts any subtask, it **must** copy the full prompt template for that phase and fill placeholders鈥攏o omission, summary, or paraphrase.
  The main Agent must not edit production code; implementation uses Agent tool subagents (`subagent_type: general-purpose`).
  Prefer `.codex/agents/auditors/auditor-implement`; follow the fallback chain.
  Follows ralph-method (`prd.{stem}.json` / `progress.{stem}.txt`), TDD red鈥揼reen鈥搑efactor, and speckit-workflow.
  Use when: the user provides a TASKS/BUGFIX document and asks to execute unfinished items.
when_to_use: |
  Use when: the user says to implement unfinished items from TASKS_*.md / BUGFIX_*.md or supplies a TASKS/BUGFIX document path to execute.

> **Orphan standalone closeout contract**: when the TASKS / BUGFIX document lives under `_orphan/`, the structured audit report must explicitly provide `stage=standalone_tasks`, `artifactDocPath`, and `reportPath`. `stage=document` is no longer a valid orphan closeout return value. Missing any field, or relying on prose-only `PASS`, must fail closeout conservatively.
references:
  - auditor-tasks-doc: Pre-implementation TASKS audit executor; `.codex/agents/auditors/auditor-tasks-doc.md`
  - auditor-implement: Post-implementation audit executor; `.codex/agents/auditors/auditor-implement.md`
  - speckit-implement: Implementation executor; `.codex/agents/speckit-implement.md`
  - audit-post-impl-rules: `.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - audit-document-iteration-rules: `.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - ralph-method: prd + progress files, US order
  - speckit-workflow: no pseudo-impl, run acceptance commands, architecture fidelity
  - prompt-templates: `.codex/skills/bmad-standalone-tasks/references/prompt-templates.md`
---

# Codex adapter: bmad-standalone-tasks

## Purpose

This skill is the unified Codex CLI / OMC entry for Cursor `bmad-standalone-tasks`.

## Main Agent Orchestration Surface

In interactive main-agent mode, before the main Agent starts, resumes, or closes out the `standalone_tasks` chain, it must first read:

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect
```

If an official dispatch plan is needed, read:

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan
```

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

## Uninterrupted Execution Contract

- 涓嶄腑鏂墽琛?contract锛歩mplementation subagents must **杩炵画瀹屾垚褰撳墠浣滅敤鍩熷唴鐨勫叏閮ㄥ墿浣?US/浠诲姟** until a real blocker or audit boundary is reached.
- The main Agent may only use `resume` / continuation prompts to continue the chain.
- It must not hand the remaining implementation back to the user before `runAuditorHost` closeout is ready.

The goal is **not** to blindly copy the Cursor skill, but to:

1. **Inherit validated standalone execution semantics** (extract unfinished items from TASKS/BUGFIX 鈫?subagent implement 鈫?post-implementation audit)
2. **Map executors to `.codex/agents/`** (audit 鈫?`auditor-implement`, `auditor-tasks-doc`; implement 鈫?`speckit-implement` or generic executor)
3. **Integrate** handoff, scoring, and commit gate
4. **Ensure** Codex CLI can run the standalone task flow end-to-end

## Host Guard (must run first)

If the actual host is **Cursor IDE**, or the invocation context clearly uses Cursor-side task semantics (for example Cursor-native task payloads, Cursor-specific executors, or the caller explicitly says this is running under Cursor), then:

1. **Stop immediately**
2. Print the exact message below:

```text
HOST_MISMATCH: Loaded the Claude variant of bmad-standalone-tasks under a Cursor host. Use ``.codex`/skills/bmad-standalone-tasks/SKILL.md` instead.
```

3. **Do not** continue into this Codex adapter鈥檚 `L1/L2/L3/L4` fallback chain
4. **Do not** emit downgrade notices derived from `.codex/agents/speckit-implement.md`, `auditor-implement`, or `Agent tool`

Continue with the rest of this file **only** when the real host is Codex CLI / OMC.

---

## Core acceptance criteria

The Claude variant must:

- Act as the **standalone task entry** for Codex CLI, unifying parse 鈫?implement 鈫?audit
- Keep executor selection, fallback, and scoring write aligned with the validated Cursor flow
- Fully integrate:
  - `auditor-tasks-doc`, `auditor-implement`
  - Scoring write (`parse-and-write-score.ts`)
  - Handoff protocol
- **Not** mix Codex Canonical Base, Claude Runtime Adapter, and Repo Add-ons into unclear rewrites
- **Main Agent must not edit production code** (FR20a)

---

## Codex Canonical Base

The following inherits Cursor `bmad-standalone-tasks` as the business baseline; do not rewrite intent arbitrarily.

Execute unfinished work from a **single TASKS or BUGFIX document** in a single session. Implementation and code edits are **only** done by subagents; the main Agent orchestrates and audits.

### When to use

- User says: **"/bmad implement unfinished items in {document}"** or equivalent (e.g. implement per `BUGFIX_xxx.md`, `TASKS_xxx.md`).
- Input: one **document path** (`TASKS_*.md`, `BUGFIX_*.md`, or similar list with clear items and acceptance).

### Optional inputs and multi-document convention

- **Working directory**: defaults to project root; if the user specifies one, resolve `DOC_PATH` relative to that directory or as absolute.
- **Branch name**: if ralph-method `prd` needs `branchName`, infer from doc/env or ask the user.
- **Multiple docs**: if several TASKS/BUGFIX docs are mentioned, use the **first explicitly named single document**; `prd`/`progress` names follow that document鈥檚 stem only.

### Prerequisite: parse unfinished task list

Before starting the implementation subtask, the main Agent must parse the document and list unfinished items: task tables (e.g. 搂7), unchecked items, sections marked TODO/incomplete. If nothing is explicitly marked, compare document order with the co-located `progress` file鈥?*treat as unfinished** anything not logged in `progress` and not `passes` in `prd`. Pass that list into the Step 1 prompt. Progress file name: `progress.{stem}.txt` (ralph-method).

### Hard constraints (non-negotiable)

1. **Implementation only via subagent**
   All production and test code changes go through Agent tool (`subagent_type: general-purpose`). The main Agent **must not** use `search_replace`, `write`, or `edit` on production code.

2. **ralph-method**
   - Create and maintain **prd** and **progress** beside the reference document (`prd.{stem}.json`, `progress.{stem}.txt` for e.g. `BUGFIX_foo.md`).
   - After **each** completed US: update prd (`passes=true`), append progress (timestamped story log).
   - Execute US in order.

3. **TDD red鈥揼reen鈥搑efactor**
   Per US: tests first (red) 鈫?implement until green 鈫?refactor. Do not mark done without passing tests.

4. **speckit-workflow**
   No placeholders or pseudo-implementation; run acceptance commands from the document; stay faithful to the BUGFIX/TASKS doc.

5. **Forbidden**
   - Do not add defer-to-later phrasing in task text (Chinese specs often forbid literals like deferred-to-next-iteration wording; match your TASKS/BUGFIX language).
   - Do not mark complete if behavior is not invoked or verified.

### Main Agent prompt rules (mandatory)

For every subagent (Agent tool) launch:

1. **Use the full template** for that phase; **no** summary, abbreviation, or paraphrase.
2. **Copy the entire template** into the subtask `prompt`; **no** 鈥渂ullet points only鈥?or 鈥渟ee below鈥?
3. **Replace all placeholders** (e.g. `{DOC_PATH}`, `{TASK_LIST}`) before sending.
4. **Self-check first**: if the phase has a pre-flight checklist, confirm each item before launch.
5. **No summarization**: the subtask prompt must contain the full template body with placeholders filled.
6. **Bad examples**: 鈥渆xecute per bmad-standalone-tasks template鈥? 鈥渟ee Step 1 in the skill鈥? 鈥渃onstraints above鈥?
7. **Good example**: full template text in the prompt, placeholders replaced, pre-flight checklist printed before launch.
8. **Self-check is mandatory**: do not launch without printing self-check results, e.g. a line stating Step 1 template was copied in full and placeholders were replaced.

---

## Codex no-hooks Runtime Adapter

### Executor tiers and fallback

Two families: **implementation** and **audit**.

#### Implementation executor (Step 1)

| Tier | Executor | Note |
|------|----------|------|
| L1 | `.codex/agents/speckit-implement.md` 鈫?Agent tool (`subagent_type: general-purpose`) | Primary: pass full agent markdown as prompt |
| L2 | Generic Agent tool + inline implementation prompt | If `speckit-implement` missing |
| L3 | Main Agent direct | Only if L1/L2 unavailable |

#### Audit executor (Step 2: post-implementation audit)

| Tier | Executor | Note |
|------|----------|------|
| L1 | `.codex/agents/auditors/auditor-implement.md` 鈫?Agent tool | Primary |
| L2 | Codex-native reviewer `code-reviewer` | OMC fallback |
| L3 | `code-review` skill under speckit-workflow | Skill fallback |
| L4 | Main Agent runs the same three-layer prompt | Last resort |

#### Optional pre-doc audit (Step 0)

| Tier | Executor | Note |
|------|----------|------|
| L1 | `.codex/agents/auditors/auditor-tasks-doc.md` | Primary |
| L2 | Generic Agent tool + audit prompt | Fallback |
| L3 | Main Agent direct | Last resort |

**Fallback notice (FR26)**: when downgrading L1鈫扡2/L3/L4, print which tier is active, e.g. 鈥渄owngraded from L1 (auditor-implement) to L2 (OMC code-reviewer) for audit鈥?

### Runtime contracts

- Before each subagent call, output **CLI Calling Summary** (5 fields):

```yaml
=== CLI Calling Summary ===
Input: {args / document path}
Template: {prompt template name}
Output: {expected artifact}
Fallback: {downgrade plan}
Acceptance: {acceptance criteria}
```

- After each step, output **YAML Handoff**:

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl|standalone_audit
  batch: {current batch}
artifacts:
  tasks_doc: {TASKS document path}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - {next action}
handoff:
  next_action: implement_next_batch|post_batch_audit|commit_gate|revise_tasks_doc
  next_agent: bmad-standalone-tasks|auditor-implement|bmad-master|auditor-tasks-doc
  ready: true|false
  mainAgentNextAction: dispatch_implement|dispatch_review|dispatch_remediation|run_closeout|await_user
  mainAgentReady: true|false
```

### Main Agent responsibilities

- **Do**: resolve path, read tasks, **launch Agent tool subagents** for implement and audit, pass context, **summarize** results.
- **Do**: if incomplete, **resume** Agent tool with same agent id or continuation context; do **not** implement code yourself.
- **Do not**: edit production/test code (including paths listed as implementation targets in the TASKS/BUGFIX doc).
- **Do not**: directly edit `prd.{stem}.json` or `progress.{stem}.txt` (subagent maintains them per ralph-method).

---

## Step 1: Implementation sub-task

**Tool**: Agent tool
**subagent_type**: `general-purpose`

### Pre-flight checklist

- [ ] `DOC_PATH` set (absolute or repo-relative)
- [ ] `TASK_LIST` parsed from document
- [ ] CLI Calling Summary printed
- [ ] Full template copied (not a summary)

### CLI Calling Summary example

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={path}, TASK_LIST={scope}
Template: Step 1 Implementation Prompt
Output: completed US ids, verification, prd/progress updates
Fallback: L2 generic Agent tool + inline prompt
Acceptance: all US passes=true and TDD log complete
```

### Prompt template (copy in full; replace placeholders)

```
**鍓嶇疆锛堝繀椤伙級**锛氳鍏堣鍙栧苟閬靛惊浠ヤ笅鎶€鑳藉啀鎵ц涓嬫柟浠诲姟锛?- **ralph-method**锛歱rd/progress 鍛藉悕涓?schema锛堜笌褰撳墠鏂囨。鍚岀洰褰曘€乸rd.{stem}.json / progress.{stem}.txt锛夈€佹瘡瀹屾垚涓€ US 鏇存柊 prd 涓?progress銆?- **speckit-workflow**锛歍DD 绾㈢豢鐏€?5 鏉￠搧寰嬨€侀獙鏀跺懡浠ゃ€佹灦鏋勫繝瀹烇紱绂佹浼疄鐜颁笌鍗犱綅銆?锛堟妧鑳藉彲浠庡綋鍓嶇幆澧冨彲鐢ㄦ妧鑳戒腑鍔犺浇锛涜嫢鏃犳硶瀹氫綅鍒欐寜鏈?prompt 涓嬪垪绾︽潫鎵ц銆傦級

浣犳鍦ㄦ寜 **TASKS/BUGFIX 鏂囨。** 鎵ц鏈畬鎴愪换鍔°€傚繀椤讳弗鏍奸伒寰互涓嬬害鏉燂紝涓嶅緱杩濆弽銆?
## 鏂囨。涓庤矾寰?- **TASKS/BUGFIX 鏂囨。璺緞**锛歿DOC_PATH}锛堣浣跨敤缁濆璺緞鎴栫浉瀵归」鐩牴鐨勮矾寰勮繘琛岃鍐欙紝鍕夸緷璧栧綋鍓嶅伐浣滅洰褰曘€傦級
- **浠诲姟娓呭崟**锛歿TASK_LIST}

## 寮哄埗绾︽潫
1. **ralph-method**锛氬湪鏈枃妗ｅ悓鐩綍鍒涘缓骞剁淮鎶?prd 涓?progress 鏂囦欢锛堟枃妗ｄ负 BUGFIX_xxx.md 鏃朵娇鐢?prd.BUGFIX_xxx.json銆乸rogress.BUGFIX_xxx.txt锛夛紱姣忓畬鎴愪竴涓?US 蹇呴』鏇存柊 prd锛堝搴?passes=true锛夈€乸rogress锛堣拷鍔犱竴鏉″甫鏃堕棿鎴崇殑 story log锛夛紱鎸?US 椤哄簭鎵ц銆?*prd 椤荤鍚?ralph-method schema**锛氭秹鍙婄敓浜т唬鐮佺殑 US 鍚?`involvesProductionCode: true` 涓?`tddSteps`锛圧ED/GREEN/REFACTOR 涓夐樁娈碉級锛涗粎鏂囨。/閰嶇疆鐨勫惈 `tddSteps`锛圖ONE 鍗曢樁娈碉級銆?*progress 棰勫～ TDD 妲戒綅**锛氱敓鎴?progress 鏃讹紝瀵规瘡涓?US 棰勫～ `[TDD-RED] _pending_`銆乣[TDD-GREEN] _pending_`銆乣[TDD-REFACTOR] _pending_` 鎴?`[DONE] _pending_`锛屾秹鍙婄敓浜т唬鐮佺殑 US 鍚笁鑰咃紝浠呮枃妗?閰嶇疆鐨勫惈 [DONE]锛涙墽琛屾椂灏?`_pending_` 鏇挎崲涓哄疄闄呯粨鏋溿€?2. **TDD 绾㈢豢鐏?*锛?*姣忎釜 US 椤荤嫭绔嬫墽琛?RED鈫扜REEN鈫扲EFACTOR**锛涚姝粎瀵归涓?US 鎵ц TDD 鍚庡鍚庣画 US 璺宠繃绾㈢伅鐩存帴瀹炵幇銆傛瘡涓?US 鎵ц鍓嶅厛鍐?琛ユ祴璇曪紙绾㈢伅锛夆啋 瀹炵幇浣块€氳繃锛堢豢鐏級鈫?閲嶆瀯銆?   **銆怲DD 绾㈢豢鐏樆濉炵害鏉熴€?* 姣忎釜娑夊強鐢熶骇浠ｇ爜鐨勪换鍔℃墽琛岄『搴忎负锛氣憼 鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹 鈫?蹇呴』寰楀埌澶辫触缁撴灉锛堢孩鐏級锛涒憽 绔嬪嵆鍦?progress 杩藉姞 [TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed锛涒憿 鍐嶅疄鐜板苟閫氳繃楠屾敹 鈫?寰楀埌閫氳繃缁撴灉锛堢豢鐏級锛涒懀 绔嬪嵆鍦?progress 杩藉姞 [TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed锛涒懁 **鏃犺鏄惁鏈夐噸鏋?*锛屽湪 progress 杩藉姞 [TDD-REFACTOR] <浠诲姟ID> <鍐呭>锛堟棤鍏蜂綋閲嶆瀯鏃跺啓銆屾棤闇€閲嶆瀯 鉁撱€嶏級銆傜姝㈠湪鏈畬鎴愭楠?1鈥? 涔嬪墠鎵ц姝ラ 3銆傜姝㈡墍鏈変换鍔″畬鎴愬悗闆嗕腑琛ュ啓 TDD 璁板綍銆?*浜や粯鍓嶈嚜妫€**锛氭秹鍙婄敓浜т唬鐮佺殑姣忎釜 US锛宲rogress 椤诲惈 [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鍚勮嚦灏戜竴琛岋紝涓?[TDD-RED] 椤诲湪 [TDD-GREEN] 涔嬪墠锛涚己浠讳竴椤瑰垯琛ュ厖鍚庡啀浜や粯銆?3. **speckit-workflow**锛氱姝吉瀹炵幇銆佸崰浣嶃€乀ODO 寮忓疄鐜帮紱蹇呴』杩愯鏂囨。涓殑楠屾敹鍛戒护锛涙灦鏋勫繝瀹炰簬 BUGFIX/TASKS 鏂囨。锛涚姝㈠湪浠诲姟鎻忚堪涓坊鍔犮€屽皢鍦ㄥ悗缁凯浠ｃ€嶏紱绂佹鏍囪瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤銆?4. **楠屾敹**锛氭瘡鎵逛换鍔″畬鎴愬悗杩愯鏂囨。涓粰鍑虹殑 pytest 鎴栭獙鏀跺懡浠わ紝骞跺皢缁撴灉鍐欏叆 progress銆?
璇疯鍙栦笂杩拌矾寰勪笅鐨勬枃妗ｏ紝鎸夋湭瀹屾垚浠诲姟閫愰」瀹炴柦锛屽苟杈撳嚭锛氬凡瀹屾垚鐨?US/浠诲姟缂栧彿銆侀獙鏀跺懡浠よ繍琛岀粨鏋溿€佷互鍙婃洿鏂板悗鐨?prd/progress 鐘舵€佹憳瑕併€?```

### Placeholder notes

- **DOC_PATH**: absolute path or repo-relative path to the TASKS/BUGFIX doc (main Agent resolves from user input; absolute recommended).
- **TASK_LIST**: unfinished items parsed by the main Agent (e.g. 搂7 T7a-1鈥?. For resume, use the 鈥淩esume implementation subtask鈥?template in `references/prompt-templates.md` with 鈥渁lready completed鈥?and 鈥渢his batch鈥?scopes.

Main Agent only: invoke Agent tool with this prompt, then collect and summarize (resume if needed).

### YAML Handoff (after Step 1)

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl
  batch: {current batch}
  completed_us: [{completed US ids}]
artifacts:
  tasks_doc: {DOC_PATH}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - Start Step 2 post-implementation audit
handoff:
  next_action: post_batch_audit
  next_agent: auditor-implement
  ready: true
  mainAgentNextAction: dispatch_review
  mainAgentReady: true
```

---

## Step 2: Audit sub-task (after implementation)

**Tool**: Agent tool
**subagent_type**: `general-purpose` (pass full `.codex/agents/auditors/auditor-implement.md` or inline prompt below)

### Auditor selection (fallback)

1. **L1**: Read `.codex/agents/auditors/auditor-implement.md` in full 鈫?Agent tool
2. **L2**: OMC `code-reviewer`
3. **L3**: speckit-workflow `code-review` skill
4. **L4**: Main Agent runs the audit prompt below

Print downgrade notice on fallback (FR26).

### Requirements

- Use **audit-prompts.md 搂5** (implementation-stage audit): verify each item; no placeholders; actionable; conclusion must use the pass phrasing required by the audit template (category 伪: often Chinese literals in repo templates).
- **Critical Auditor required**, share **>70%**; adversarial check for omissions, line drift, acceptance mismatch.
- **Convergence**: one **round** = one full audit subtask; **three consecutive no-gap rounds** = three passes in a row with the template鈥檚 required pass wording and Critical Auditor stating no new gap in the template鈥檚 required language; any fail verdict or reported gap resets the count.

### Pre-flight checklist

- [ ] `DOC_PATH` filled
- [ ] Implementation artifacts identified
- [ ] CLI Calling Summary printed
- [ ] Audit prompt template copied in full

### CLI Calling Summary example

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={path}, round={N}
Template: Step 2 Audit Prompt (搂5 + Critical Auditor)
Output: audit report (pass / fail)
Fallback: L2 OMC code-reviewer 鈫?L3 code-review skill 鈫?L4 main Agent
Acceptance: three consecutive no-gap rounds
```

### Prompt template (copy in full; replace placeholders)

```
瀵?**瀹炴柦瀹屾垚鍚庣殑缁撴灉** 鎵ц **audit-prompts 搂5 鎵ц闃舵瀹¤**銆傚繀椤诲紩鍏?**鎵瑰垽瀹¤鍛橈紙Critical Auditor锛?* 瑙嗚锛屼笖鎵瑰垽瀹¤鍛樺彂瑷€鍗犳瘮椤?**>70%**銆?
## 琚瀵硅薄
- 瀹炴柦渚濇嵁鏂囨。锛歿DOC_PATH}
- 瀹炴柦浜х墿锛氫唬鐮佸彉鏇淬€乸rd銆乸rogress銆佷互鍙婃枃妗ｄ腑瑕佹眰鐨勯獙鏀跺懡浠よ緭鍑?
## 搂5 瀹¤椤?1. 浠诲姟鏄惁鐪熸瀹炵幇锛堟棤棰勭暀/鍗犱綅/鍋囧畬鎴愶級
2. 鐢熶骇浠ｇ爜鏄惁鍦ㄥ叧閿矾寰勪腑琚娇鐢?3. 闇€瀹炵幇鐨勯」鏄惁鍧囨湁瀹炵幇涓庢祴璇?楠屾敹瑕嗙洊
4. 楠屾敹琛?楠屾敹鍛戒护鏄惁宸叉寜瀹為檯鎵ц骞跺～鍐?5. 鏄惁閬靛畧 ralph-method锛坧rd/progress 鏇存柊銆乁S 椤哄簭锛夛紱娑夊強鐢熶骇浠ｇ爜鐨勬瘡涓?US 鏄惁鍚?[TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鍚勮嚦灏戜竴琛岋紙[TDD-REFACTOR] 鍏佽鍐欍€屾棤闇€閲嶆瀯 鉁撱€嶏紱[TDD-RED] 椤诲湪 [TDD-GREEN] 涔嬪墠锛?6. 鏄惁鏃犮€屽皢鍦ㄥ悗缁凯浠ｃ€嶇瓑寤惰繜琛ㄨ堪锛涙槸鍚︽棤鏍囪瀹屾垚浣嗘湭璋冪敤
7. 椤圭洰椤绘寜鎶€鏈爤閰嶇疆骞舵墽琛?Lint锛堣 lint-requirement-matrix锛夛紱鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint 椤讳綔涓烘湭閫氳繃椤癸紱宸查厤缃殑椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶈眮鍏嶃€?
## 鎵瑰垽瀹¤鍛?浠庡鎶楄瑙掓鏌ワ細閬楁紡浠诲姟銆佽鍙锋垨璺緞澶辨晥銆侀獙鏀跺懡浠ゆ湭璺戙€伮?/楠屾敹璇激鎴栨紡缃戙€?**鍙搷浣滆姹?*锛氭姤鍛婇』鍖呭惈鐙珛娈佃惤銆?# 鎵瑰垽瀹¤鍛樼粨璁恒€嶏紝涓旇娈佃惤瀛楁暟鎴栨潯鐩暟涓嶅皯浜庢姤鍛婂叾浣欓儴鍒嗙殑 70%锛堝嵆鍗犳瘮 >70%锛夛紱缁撹椤绘槑纭€屾湰杞棤鏂?gap銆嶆垨銆屾湰杞瓨鍦?gap銆嶅強鍏蜂綋椤广€傝嫢涓?Agent 浼犲叆浜嗘湰杞搴忓彿锛岃鍦ㄧ粨璁轰腑娉ㄦ槑銆岀 N 杞€嶃€?
## 杈撳嚭涓庢敹鏁?- 缁撹椤绘槑纭細**銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆?* 鎴?**銆屾湭閫氳繃銆?*锛堝苟鍒?gap 涓庝慨鏀瑰缓璁級銆?- 鑻ラ€氳繃涓旀壒鍒ゅ璁″憳鏃犳柊 gap锛氭敞鏄庛€屾湰杞棤鏂?gap锛岀 N 杞紱寤鸿绱鑷?3 杞棤 gap 鍚庢敹鏁涖€嶃€?- 鑻ユ湭閫氳繃锛氭敞鏄庛€屾湰杞瓨鍦?gap锛屼笉璁℃暟銆嶏紝淇鍚庡啀娆″彂璧锋湰瀹¤锛岀洿鑷宠繛缁?3 杞棤 gap 鏀舵暃銆?```

Main Agent: run after Step 1 (and any resume). You may print 鈥渞ound N passed, continuing verification鈥︹€?between rounds. If the audit verdict is fail, launch implementation subagent (or resume) to fix code/prd/progress; the main Agent may edit explanatory/docs-only files only, not `prd.*`, `progress.*`, or production code. Re-audit until three consecutive no-gap rounds.

### YAML Handoff (after Step 2)

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_audit
  round: {N}
  critic_ratio: "{Critical Auditor share}"
  gap_count: {count}
  convergence_status: in_progress|converged
artifacts:
  report: {audit report path}
  tasks_doc: {DOC_PATH}
next_steps:
  - {if pass: next batch or commit gate}
  - {if fail: fix and re-audit}
handoff:
  next_action: implement_next_batch|commit_gate|revise_and_reaudit
  next_agent: bmad-standalone-tasks|bmad-master|auditor-implement
  ready: true|false
  mainAgentNextAction: dispatch_implement|dispatch_review|dispatch_remediation|run_closeout|await_user
  mainAgentReady: true|false
```

---

## Step 3: Main Agent prohibitions (reminder)

- **Do not** use `search_replace`, `write`, or `edit` on production code (including paths listed as implementation targets). **Do not** edit `prd.{stem}.json` or `progress.{stem}.txt` (subagent maintains them).
- **Do not** replace the subagent by implementing yourself; use Agent tool **resume** or a new call with 鈥渁lready completed鈥?/ 鈥渢his batch鈥?in the prompt.
- **May** edit explanatory/docs-only files (README, this skill, artifact `.md`) to reflect audit outcomes or notes.

---

## Integration with ralph-method / speckit-workflow

- **Standalone mode**: this skill uses the current TASKS/BUGFIX doc as the single source; no prior speckit `tasks.md` required. US and prd come from the document. If ralph-method elsewhere requires prd aligned with `tasks.md`, **this skill鈥檚 convention wins** for standalone runs. Subagents may synthesize prd/progress without plan/GAPS/tasks.md gates from ralph-method skill.
- **No US structure**: map each verifiable item to US-001, US-002, 鈥?(or doc-native ids), valid prd.json schema, consistent progress ids.
- **Skill loading**: the Step 1 prompt already tells the subagent to load ralph-method and speckit-workflow first.

---

## Repo add-ons

### Handoff / state

- YAML Handoff at end of each step (templates above)
- Final commit via `bmad-master` gate
- Subagents must not commit on their own

### Scoring

- Audit reports must include parseable scoring blocks for `parse-and-write-score.ts`
- Format per `.codex/skills/bmad-code-reviewer-lifecycle/SKILL.md`

### Forbidden / vague wording

- Do not use defer-to-later or 鈥渋mplement later鈥?phrasing in task text (mirror whatever forbidden list your TASKS/BUGFIX or audit template requires).
- Audits should flag such wording as gaps

---

## References

- **ralph-method**: prd + progress naming/schema; see ralph-method skill.
- **speckit-workflow**: TDD, 15 rules, acceptance commands, architecture fidelity; audits should invoke code-review where applicable.
- **audit-prompts 搂5**: implementation-stage audit; Step 2鈥檚 seven items mirror 搂5. If `_bmad/references/audit-prompts.md` exists, cross-check 搂5. Critical Auditor, three no-gap rounds.
- **audit-post-impl-rules**: aligned with speckit-workflow and bmad-story-assistant; Step 2 satisfies 3-round no-gap and Critical Auditor >50%. Path: `.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`.
- **audit-document-iteration-rules**: for TASKS/BUGFIX **document** audit (not post-impl), audit subagent edits the doc when gaps are found. **Step 2 audits code after implementation**鈥攊mplementation subagent fixes code, not this document rule.
- **Prompt templates**: `references/prompt-templates.md`.

---

## Errors and edge cases

- **Missing path**: after resolving `DOC_PATH`, if the file does not exist, error to the user with the resolved path; do not start implementation subtask.
- **Subagent failure / timeout**: **resume** once if agent id returned; else new Agent tool with 鈥渃ontinue from progress / checkpoint below鈥? do not edit production code as substitute.
- **Main Agent must not** edit `prd.*.json` or `progress.*.txt` 鈥渢o fix progress鈥濃€攐nly the subagent.

<!-- ADAPTATION_COMPLETE: 2026-03-16 -->
