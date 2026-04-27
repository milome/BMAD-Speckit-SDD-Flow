<!-- BLOCK_LABEL_POLICY=B -->

---
name: bmad-story-assistant
description: |
  Codex CLI / OMC entry for the BMAD Story Assistant.
  Uses Cursor `bmad-story-assistant` as the semantic baseline to orchestrate Story creation 鈫?audit 鈫?Dev Story 鈫?post-implementation audit 鈫?failure loopback,
  and integrates this repository鈥檚 multi-agent, hooks, state machine, handoff, score writing, and commit gate mechanisms.
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

# Claude Adapter: BMAD Story Assistant

> **Party-mode source of truth**: `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`. All party-mode rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit-gate semantics must follow that file; this skill only decides when Story flows enter party-mode.

## Purpose

This skill is the unified adaptation entrance of Cursor `bmad-story-assistant` in Codex CLI / OMC environment.

## Main Agent Orchestration Surface

In interactive main-agent mode, before the main Agent starts, resumes, or closes out the `story` chain, it must first read:

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect
```

If an official dispatch plan is needed, read:

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan
```

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

## Uninterrupted Execution Contract

- Story implementation must continue through all remaining scoped User Stories/tasks until the blocker or post-audit boundary is reached.
- If post-audit fails, the main Agent must resume the same execution chain instead of stopping for manual continuation.
- post-audit is ready only after `runAuditorHost` confirms closeout and the ralph-method tracking files remain aligned.

The goal is not to simply copy the Cursor skill, but to:

1. **Inherit Cursor鈥檚 verified process semantics**
2. **Select the correct executor and define fallback in Codex no-hooks Runtime**
3. **Integrate the repository鈥檚 state machine, hooks, handoff, audit closed loop, score writing, and commit gate**
4. **Ensure that the entire process of Story creation 鈫?development 鈫?audit closed-loop iteration can be executed completely, continuously and correctly in Codex CLI**

---

## Core Acceptance Criteria

The Claude version of `bmad-story-assistant` must satisfy:

- Can be used as the **unified entrance** of Codex CLI to continuously orchestrate Story creation, stage audit, Dev Story implementation, post-implementation audit and failure loopback
- Each stage jump, executor selection, fallback, status placement, score writing and audit closed loop are all semantically consistent with Cursor's verified process
- Complete access to the new additions to this warehouse:
  - Multi-agent
  - hooks
  - State machine
  -handoff
  - Audit executive
  - runAuditorHost
  -commit gate
- Codex Canonical Base, Claude Runtime Adapter, and Repo Add-ons must not be mixed into a rewritten version of prompt from unknown sources.

## Party-Mode Agent Mention Contract

From this revision onward, Claude-side party-mode is no longer described as a `general-purpose` main path.

- **Primary path**: `.codex/agents/party-mode-facilitator.md`
- **Single invocation contract**: `@"party-mode-facilitator (agent)"`
- **Scope**: any party-mode debate that resolves design trade-offs, architecture decisions, scope ambiguity, or Story planning disagreements
- **Compatibility fallback**: only when the dedicated facilitator agent is unavailable may the flow fall back to `subagent_type: general-purpose` with the full facilitator contract inlined
- **Non party-mode executors**: `bmad-story-create`, `auditor-*`, `speckit-implement`, and other executors may still use `general-purpose`

So `general-purpose` still exists in the Claude Story flow, but it is **no longer the recommended main path for party-mode**.

## Deferred Gaps Dev Story Addendum

This distributed English variant must keep the same Deferred Gaps guardrails as the main Chinese contract.

- Before implementation, Dev Story must read and validate `deferred-gap-register.yaml`.
- Dev Story must also read and validate `journey-ledger`, `trace-map`, and `closure-notes`.
- Implementation must fail closed when an active gap has no task binding, `Smoke Task Chain`, `Closure Task ID`, or production path mapping.
- Post-audit must inspect `closure_evidence`, `carry_forward_evidence`, `Production Path`, `Smoke Proof`, and `Acceptance Evidence`.
- `module complete but journey not runnable` is a hard failure, not a warning.

---

## Codex Canonical Base

The following content is inherited from Cursor `bmad-story-assistant` and belongs to the business semantic baseline. The Claude version is not allowed to rewrite its intention without authorization:

### Stage model
1.Create Story
2. Story audit
3. Dev Story / `STORY-A3-DEV`
4. Post-Implementation Audit / `STORY-A4-POSTAUDIT`
5. Failure loopback and re-audit

### Key Template Baseline
- `STORY-A3-DEV`
- `STORY-A4-POSTAUDIT`
- Story document stage audit requirements
- Baseline constraints for pre-checking, TDD traffic lights, ralph-method, and post-audit

### Baseline semantics that must be preserved
- The master agent must not bypass critical stages
- Pre-requisite documents must have passed audit
- Dev Story must not be triggered repeatedly after implementation has ended
- Post-audit must be initiated after implementation is completed
- TDD sequencing and logging requirements cannot be skipped
- The order of cleanup / post-audit must be maintained after the subtask returns

### Content that does not belong to Codex Canonical Base
The following content is prohibited from being written to Cursor Base and should be placed in Runtime Adapter or Repo Add-ons:
- Specific agent name of Codex no-hooks
- `Codex-native reviewer:code-reviewer`
- `code-review` skill
- `auditor-spec` / `auditor-plan` / `auditor-tasks` / `auditor-implement`
- Warehouse local scoring, forbidden words, critical auditor format, state update details

---

## Codex no-hooks Runtime Adapter

This section defines how Cursor semantics are implemented in Codex CLI/OMC.

### Stage Routing Map

| Cursor stage | Claude entry/execution body | Description |
|------|------|------|
| Create Story | Claude version `bmad-story-assistant` adapter skill 鈫?story/create execution body | Currently reserved as design bit, it should be mapped to `.codex/agents/...` in the future |
| Story audit | Story audit executive / reviewer | Currently reserved as a design bit, it should be standardized in the future |
| `STORY-A3-DEV` | `.codex/agents/speckit-implement.md` | Tri-layered and aligned `STORY-A3-DEV` |
| `STORY-A4-POSTAUDIT` | `.codex/agents/layers/bmad-layer4-speckit-implement.md` + `auditor-implement` | Already three-layered, auditor takes priority |
| spec audit | `auditor-spec` | primary |
| plan audit | `auditor-plan` | primary |
| tasks audit | `auditor-tasks` | primary |
| implement audit | `auditor-implement` | primary |
| bugfix audit | `auditor-bugfix` | primary |

### Primary Executors

- The primary executor of Story / Layer 4 / implement/post-audit gives priority to using the warehouse custom executor
- Prioritize use during the audit phase:
  - `auditor-spec`
  - `auditor-plan`
  - `auditor-tasks`
  - `auditor-implement`
  - `auditor-bugfix`
- Dev Story implementation prefers to use:
  - `.codex/agents/speckit-implement.md`

### Optional Reuse

If available at runtime, it can be reused:
- `Codex-native reviewer:code-reviewer`
- `code-review` skill
- OMC executor / reviewer type agent
- Test/lint dedicated executor

### Fallback Strategy

The unified fallback strategy is as follows:

1. Prioritize using the primary executor defined by the warehouse
2. If the primary executor cannot be called directly in the current environment, fall back to Codex reviewer / executor
3. If Codex reviewer/executor is unavailable, fall back to `code-review` skill or equivalent capabilities
4. If none of the above execution bodies are available, the main Agent will directly execute the same three-layer structure prompt
5. fallback only allows changes to the executor, not:
   - Codex Canonical Base
   -Repo Add-ons
   - Output format
   - Rating block
   - required_fixes structure
   - handoff / state update rules

### Runtime Contracts

All stages must adhere to the following runtime contracts:

- Must maintain:
  - `.codex/state/bmad-progress.yaml`
  - `.codex/state/stories/*-progress.yaml` (if applicable)
- Handoff information must be maintained:
  - `artifactDocPath`
  - `reportPath`
  - `iteration_count`
  - `next_action`
- Must be triggered after passing the audit:
  - `run-auditor-host.ts`
  - Audit pass mark
  - Status updates
- When the implementation is completed but post-audit is not executed, it is prohibited to re-enter the development phase.
- If hooks are available, only hooks are allowed to do:
  - Observation
  -checkpoint
  - Recovery tips
  - Non-business gate control
- hooks must not be substituted for:
  - Phased release
  - commit release
  - Main state machine decisions

---

## Repo Add-ons

The following content is an additional enhancement to the warehouse and does not belong to the original semantics of Cursor.

### Audit enhancement
- Forbidden word check
- Critique auditor output format
- `No new gap in this round / There is a gap in this round`
- strict convergence (such as implement 3 consecutive rounds without gaps)

### Rating and storage enhancements
- `run-auditor-host.ts`
- `iteration_count`
- `iterationReportPaths`
- Parsable scoring block requirements

### Status and gate control enhancement
- `.codex/state/bmad-progress.yaml`
- `.codex/state/stories/*.yaml`
-commit gate
- handoff protocol

### Configure system integration (audit granularity)

This skill supports controlling the audit granularity by configuring the system to implement three modes: `full`/`story`/`epic`.

#### Configuration loading

The master Agent must load the configuration when the skill starts:
```typescript
import { loadConfig, shouldAudit, shouldValidate } from './scripts/bmad-config';

const config = loadConfig();
```
#### Configure sources (by priority)

1. **CLI parameters**: `--audit-granularity=story` | `--continue`
2. **Environment variables**: `BMAD_AUDIT_GRANULARITY=story` | `BMAD_AUTO_CONTINUE=true`
3. **Project configuration**: `_bmad/_config/bmad-story-config.yaml`
4. **Default value**: `audit-granularity=full`, `auto_continue=false`

#### Conditional audit routing

Each Layer 4 stage (specify/plan/gaps/tasks/implement) must determine the execution path according to the configuration:
```typescript
// 鏉′欢瀹¤閫昏緫妯℃澘
const stageConfig = getStageConfig('specify'); // 鎴栧綋鍓嶉樁娈?
if (stageConfig.audit) {
  // 璺緞 1: 瀹屾暣瀹¤锛堥粯璁?full 妯″紡锛?  await executeFullAudit({
    strictness: stageConfig.strictness, // 'standard' | 'strict'
    subagentTool: 'Agent',
    subagentType: 'general-purpose'
  });
} else if (stageConfig.validation) {
  // 璺緞 2: 鍩虹楠岃瘉锛坰tory 妯″紡鐨勪腑闂撮樁娈碉級
  await executeBasicValidation({
    level: stageConfig.validation,      // 'basic' | 'test_only'
    checks: stageConfig.checks          // 楠岃瘉椤瑰垪琛?  });
  // 楠岃瘉閫氳繃鍚庣洿鎺ユ爣璁伴樁娈靛畬鎴愶紝涓嶇敓鎴?AUDIT_鎶ュ憡
  await markStageAsPassedWithoutAudit();
} else {
  // 璺緞 3: 浠呯敓鎴愭枃妗ｏ紙epic 妯″紡鐨?story 闃舵锛?  await markStageAsPassedWithoutAudit();
}
```
#### Behavior of each mode

| Patterns | Story Creation | Intermediate Stages | Post-Implementation | Epic Audit |
|------|-----------|----------|--------|----------|
| **full** | Audit | All Audit | Audit | - |
| **story** | Audit | Basic Verification | Audit | - |
| **epic** | Not audited | Not audited | Not audited | Audited |

#### Authentication level definition

**basic verification** (used in the intermediate stage of story mode):
- Document existence check
- Basic structural inspection
- Required Chapter Check

**test_only verification** (for story mode implement phase):
- All tests passed
- Lint error-free
- Document exists

#### Execution body calling method

After using the configuration system, the execution body calling template is updated to:
```yaml
tool: Agent
subagent_type: general-purpose  # 濮嬬粓浣跨敤 general-purpose锛岄€氳繃 prompt 浼犻€掗厤缃?description: "Execute Stage with config-aware routing"
prompt: |
  銆愬繀璇汇€戞湰 prompt 鍖呭惈閰嶇疆涓婁笅鏂囥€?
  **閰嶇疆涓婁笅鏂?*:
  - audit_mode: "story"  # full | story | epic
  - stage: "specify"     # 褰撳墠闃舵
  - should_audit: false  # 鏍规嵁閰嶇疆璁＄畻
  - validation: "basic"  # 褰?audit: false 鏃剁殑楠岃瘉绾у埆

  **鎵ц閫昏緫**:
  1. 璇诲彇閰嶇疆骞惰В鏋?should_audit
  2. 濡傛灉 should_audit: true 鈫?鎵ц瀹屾暣瀹¤娴佺▼锛圫tep 4 瀹¤寰幆锛?  3. 濡傛灉 should_audit: false:
     - 鑻?validation: "basic" 鈫?鎵ц鍩虹楠岃瘉
     - 鑻?validation: "test_only" 鈫?鎵ц娴嬭瘯楠岃瘉
     - 鑻?validation: null 鈫?鐩存帴鏍囪闃舵閫氳繃
  4. 鏍规嵁缁撴灉鏇存柊鐘舵€佹枃浠?```
### Runtime governance enhancements
- ralph-method trace file
- progress / prd required
- hooks / state / runtime adapter behavior

---

## Stage-by-Stage Orchestration

### Stage 1: Create Story

Claude's Stage 1 Create Story execution body is responsible for generating Story documents in the BMAD Story process and advancing the process to the Story audit stage.

#### Purpose

This stage is the execution adapter of the Create Story stage in Cursor `bmad-story-assistant` in the Codex CLI / OMC environment.

Goal:
- Inherit the business semantics of the Cursor Create Story phase
- Clearly defined executors, inputs, state updates and handoffs under the Claude runtime
- Provide standard products for subsequent Stage 2 Story audits

#### Required Inputs

- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- `project_root`
- If exists: `sprint-status.yaml`, related requirements documents, pre-Epic/Story planning documents

#### Codex Canonical Base

- Main text baseline source: Stage 1 Create Story (`STORY-A1-CREATE`) template of the Cursor `bmad-story-assistant` skill.
- The main Agent must perform a sprint-status pre-check before initiating the Create Story subtask:
  1. When the user specifies Story through `epic_num/story_num` (or "4, 1", etc.), or parses the next Story from sprint-status, it must first check whether sprint-status exists.
  2. You can call `scripts/check-sprint-ready.ps1 -Json` or `_bmad/speckit/scripts/powershell/check-sprint-ready.ps1 -Json` (if the project root has `scripts/`, it will take precedence), and parse `SPRINT_READY`.
  3. If sprint-status does not exist, the user must be prompted "鈿狅笍 sprint-status.yaml does not exist, it is recommended to run sprint-planning first" and require the user to explicitly confirm "Known bypass, continue" or execute sprint-planning first; the Create Story subtask must not be initiated before confirmation.
  4. If sprint-status exists, you can add the "sprint-status confirmed" mark to the subtask prompt to simplify the subtask logic.
  5. This stage can be exempted only if the user clearly "has passed party-mode and passed the audit, skip Create Story" and only requests Dev Story.
- When calling the Create Story workflow through a subtask, the master Agent must copy the entire **complete template** `STORY-A1-CREATE` and replace the placeholders; it is prohibited to generalize or abbreviate the template.
- Skip judgment: Only when the user **explicitly** says "passed party-mode and audit passed" and "skip Create Story", the main agent can skip stages one and two. If the user only provides the Epic/Story number or says "Story already exists" without clarifying the above statement, Create Story must be executed.
- Create Story template requirements:
  - Execute the equivalent workflow of `/bmad-bmm-create-story` through subtasks to generate Story documents of Epic `{epic_num}` and Story `{epic_num}-{story_num}`.
  - Output the Story document to `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`.
  - When creating Story documents, you must use clear descriptions and prohibit the use of words in the Story forbidden list (optional, considerable, follow-up, first implementation, subsequent expansion, pending, discretionary, contingent, technical debt).
  - When the function is not within the scope of this Story but belongs to this Epic, it must be stated "Responsible for Story X.Y" and a detailed description of the task; ensure that X.Y exists and the scope includes the function. Vague and delayed expressions are prohibited.
  - **party-mode mandatory**: Regardless of whether the Epic/Story document already exists, you **must** enter party-mode for multi-role debate (minimum 100 rounds) as long as any of the following situations are involved: 鈶?There are multiple implementation options available; 鈶?There are architectural/design decisions or trade-offs; 鈶?There are ambiguities or unresolved points in the options or scope.
  - Chinese must be used throughout the entire process.
- After Create Story is produced, the Story document is usually saved in: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`.

#### Subtask Template (STORY-A1-CREATE)

When initiating the Create Story subtask, the following complete template must be used (all placeholders need to be replaced beforehand):

**Template ID**: STORY-A1-CREATE
```yaml
description: "Create Story {epic_num}-{story_num} via BMAD create-story workflow"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典竴 Create Story prompt 妯℃澘锛圛D STORY-A1-CREATE锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  璇锋墽琛?BMAD Create Story 宸ヤ綔娴侊紝鐢熸垚 Epic {epic_num}銆丼tory {epic_num}-{story_num} 鐨?Story 鏂囨。銆?
  **宸ヤ綔娴佹楠?*锛?  1. 鍔犺浇 {project-root}/_bmad/core/tasks/workflow.xml
  2. 璇诲彇鍏跺叏閮ㄥ唴瀹?  3. 浠?{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml 浣滀负 workflow-config 鍙傛暟
  4. 鎸夌収 workflow.xml 鐨勬寚绀烘墽琛?create-story 宸ヤ綔娴?  5. 杈撳嚭 Story 鏂囨。鍒?{project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md锛坰lug 浠?Story 鏍囬鎴栫敤鎴疯緭鍏ユ帹瀵硷級

  **寮哄埗绾︽潫**锛?  - 鍒涘缓 story 鏂囨。蹇呴』浣跨敤鏄庣‘鎻忚堪锛岀姝娇鐢ㄦ湰 skill銆屄?绂佹璇嶈〃锛圫tory 鏂囨。锛夈€嶄腑鐨勮瘝锛堝彲閫夈€佸彲鑰冭檻銆佸悗缁€佸厛瀹炵幇銆佸悗缁墿灞曘€佸緟瀹氥€侀厡鎯呫€佽鎯呭喌銆佹妧鏈€猴級銆?  - 褰撳姛鑳戒笉鍦ㄦ湰 Story 鑼冨洿浣嗗睘鏈?Epic 鏃讹紝椤诲啓鏄庛€岀敱 Story X.Y 璐熻矗銆嶅強浠诲姟鍏蜂綋鎻忚堪锛涚‘淇?X.Y 瀛樺湪涓?scope 鍚鍔熻兘锛堣嫢 X.Y 涓嶅瓨鍦紝瀹¤灏嗗垽涓嶉€氳繃骞跺缓璁垱寤猴級銆傜姝€屽厛瀹炵幇 X锛屾垨鍚庣画鎵╁睍銆嶃€屽叾浣欑敱 X.Y 璐熻矗銆嶇瓑妯＄硦琛ㄨ堪銆?  - **party-mode 寮哄埗**锛氭棤璁?Epic/Story 鏂囨。鏄惁宸插瓨鍦紝鍙娑夊強浠ヤ笅浠讳竴鎯呭舰锛?*蹇呴』**杩涘叆 party-mode 杩涜澶氳鑹茶京璁猴紙**鏈€灏?100 杞?*锛岃 party-mode step-02 鐨勩€岀敓鎴愭渶缁堟柟妗堝拰鏈€缁堜换鍔″垪琛ㄣ€嶆垨 Create Story 浜у嚭鏂规鍦烘櫙锛夛細鈶?鏈夊涓疄鐜版柟妗堝彲閫夛紱鈶?瀛樺湪鏋舵瀯/璁捐鍐崇瓥鎴?trade-off锛涒憿 鏂规鎴栬寖鍥村瓨鍦ㄦ涔夋垨鏈喅鐐广€?*绂佹**浠ャ€孍pic 宸插瓨鍦ㄣ€嶃€孲tory 宸茬敓鎴愩€嶄负鐢辫烦杩?party-mode銆傚叡璇嗗墠椤昏揪鏈€灏戣疆娆★紱鑻ユ湭杈炬垚鍗曚竴鏂规鎴栦粛鏈夋湭闂悎鐨?gaps/risks锛岀户缁京璁虹洿鑷虫弧瓒虫垨杈句笂闄愯疆娆°€?  - 鍏ㄧ▼蹇呴』浣跨敤涓枃銆?```
**Placeholder replacement instructions**:
- `{epic_num}` 鈫?actual Epic number (e.g. `4`)
- `{story_num}` 鈫?actual Story number (e.g. `1`)
- `{epic-slug}` 鈫?Epic short name (like `cli-integration`)
- `{slug}` 鈫?Story short name (derived from title or input)
- `{project-root}` 鈫?absolute path to the project root directory

#### Stage 1 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 1 execution body:
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 1: Create Story - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-story-create
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?epic_num: {瀹為檯鍊紏
  鈥?story_num: {瀹為檯鍊紏
  鈥?epic_slug: {瀹為檯鍊紏
  鈥?story_slug: {瀹為檯鍊紏
  鈥?project_root: {瀹為檯鍊紏

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 sprint-status 鍓嶇疆妫€鏌ヨ姹?  鈹?  鈹溾攢 STORY-A1-CREATE 瀹屾暣妯℃澘
  鈹?  鈹溾攢 party-mode 寮哄埗瑕佹眰锛?00杞京璁猴級
  鈹?  鈹斺攢 Story 绂佹璇嶈〃绾︽潫
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary Executor: bmad-story-create
  鈹?  鈹溾攢 Fallback: 涓?Agent 鐩存帴鎵ц
  鈹?  鈹斺攢 Runtime Contracts: 浜х墿璺緞銆佺姸鎬佹洿鏂?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌?      鈹溾攢 鏈粨鐩綍瑙勮寖
      鈹斺攢 BMAD 鐘舵€佹満鍏煎

棰勬湡浜х墿:
  鈥?Story 鏂囨。: _bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md
  鈥?鐘舵€佹洿鏂? story_created
  鈥?Handoff 鐩爣: bmad-story-audit
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```
The Agent tool is called immediately after output.

#### Codex no-hooks Runtime Adapter

**Execution body calling method**

When the main Agent uses this skill, it must call the execution body in the following way:

**Important**: The explicit Codex CLI invocation example for party-mode is now standardized as `@"party-mode-facilitator (agent)"`. Whenever Stage 1 requires a party-mode debate, the main path must invoke `.codex/agents/party-mode-facilitator.md` via that agent mention. Only non-specialized executors continue to use `general-purpose`.

1. **Party-mode debate mode** (preferred, and mandatory whenever design trade-offs, scope ambiguity, or architecture choices remain open):
   The main Agent reads `.codex/agents/party-mode-facilitator.md` in full and invokes it via an explicit agent mention:
   ```yaml
   tool: Agent
   description: "Run Stage 1 Party-Mode debate"
   prompt: |
     @"party-mode-facilitator (agent)"

      ## 鐢ㄦ埛閫夋嫨
      寮哄害: {Main Agent fills from the user's explicit reply, e.g. 50 (decision_root_cause_50)}

      [Full contents of .codex/agents/party-mode-facilitator.md]

     Agenda:
     - debate before Story Create
     - current Epic/Story inputs and constraints
     - produce a convergence memo for downstream bmad-story-create
   ```
2. **Direct execution mode** (non party-mode, or after the facilitator has already produced convergence output):
   The main Agent directly reads the complete prompt of Stage 1 in this skill (including the Subtask Template above), copies the entire section and replaces the placeholder, and then uses the `Agent` tool to call the executor:
   ```yaml
   tool: Agent
   subagent_type: general-purpose
   description: "Execute Stage 1 Create Story"
   prompt: |
     [鏈?skill Stage 1 鐨勫畬鏁村唴瀹癸紝鍚?Codex Canonical Base + Subtask Template锛屾墍鏈夊崰浣嶇宸叉浛鎹
   ```
3. **Agent file reference mode**:
   If you use `.codex/agents/bmad-story-create.md` as the executable body, you must first read the entire file content and then pass it in as `prompt`. These non-specialized executors still use `general-purpose`:
   ```yaml
   tool: Agent
   subagent_type: general-purpose
   description: "Create Story via bmad-story-create agent"
   prompt: |
     浣犱綔涓?bmad-story-create 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 1 Create Story 娴佺▼锛?
     [璇诲彇 .codex/agents/bmad-story-create.md 鐨勫畬鏁村唴瀹癸紝鍚細]
     [1. Role]
     [2. Input Reception - 纭鎺ユ敹鍒扮殑鍙傛暟]
     [3. Required Inputs - 鏇挎崲涓哄疄闄呭€糫
     [4. Codex Canonical Base - 瀹屾暣澶嶅埗]
     [5. Subtask Template - 瀹屾暣澶嶅埗锛屽崰浣嶇宸叉浛鎹
     [6. Mandatory Startup]
     [7. Execution Flow]
     [8. Output / Handoff 瑕佹眰]
   ```
**Important**:
- You must not just pass in the executable file path and let the executor read it by itself. You must pass in the complete prompt content.
- The execution body itself does not load skills, and all instructions are passed by the main Agent through the prompt parameter.
- Party-mode debate must prefer `@"party-mode-facilitator (agent)"` as the main path.
- If the user has already explicitly replied `20` / `50` / `100`, the main Agent must first compile that reply into the `## 鐢ㄦ埛閫夋嫨` confirmation block before invoking `@"party-mode-facilitator (agent)"`.
- After the execution body returns, the main Agent must verify the handoff output and decide the next route

---

**Primary Executor**
- `.codex/agents/bmad-story-create.md` (called through the Agent tool, the complete prompt is passed in by the main Agent)

**Optional Reuse**
- Reuse existing discussion / brainstorming / party-mode equivalent capabilities to assist in generating Story documents
- Reusable `speckit-constitution.md`, `speckit-analyze.md`, `speckit-checklist.md` as input constraints and checking aids

**Fallback Strategy**
1. Prioritize directly generating Story documents by `bmad-story-create` agent
2. If in-depth discussion is required and the OMC/conversational executor is available, reuse it to complete the solution convergence, but this stage will still be responsible for finalizing the final Story product.
3. If the external executor is unavailable, the main Agent will sequentially execute requirements collection, structured generation, and quality self-inspection.
4. Fallback must not change the semantic requirements of Codex Canonical Base

**Runtime Contracts**
- Product path: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md`
- After the Story output is completed, the story state must be updated to `story_created`
- Must be written to handoff and handed over to `bmad-story-audit` for execution in Stage 2
- If the user explicitly skips Create Story, the skip reason must be recorded and the Story audit must be entered directly

#### Repo Add-ons

- Story documents must comply with the forbidden word rules of this warehouse
- Story documents must be auditable and must not have ambiguous scope that cannot be mapped to subsequent stages
- The output directory and naming must comply with the BMAD story directory specifications of this warehouse
- The state file and handoff must be compatible with `.codex/state/bmad-progress.yaml` and `.codex/state/stories/*-progress.yaml`

#### Output / Handoff

Output handoff after completion:
```yaml
layer: 3
stage: story_create

execution_summary:
  agent: bmad-story-create
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: sprint_status_check
      status: passed
      result: "sprint-status.yaml 宸茬‘璁?
    - step: story_generation
      status: completed
      result: "Story 鏂囨。宸茬敓鎴?
    - step: document_persistence
      status: completed
      result: "鏂囨。宸插啓鍏?
    - step: state_update
      status: completed
      result: "鐘舵€佸凡鏇存柊涓?story_created"

artifacts:
  story_doc:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md"
    exists: true

handoff:
  next_action: story_audit
  next_agent: bmad-story-audit
  ready: true
  mainAgentNextAction: dispatch_review
  mainAgentReady: true
```
### Stage 2: Story Audit

Claude's Stage 2 Story audit execution body is responsible for auditing Story documents and deciding whether to allow access to Dev Story.

#### Purpose

This stage is the execution adapter of the Story document audit stage in Cursor `bmad-story-assistant` in the Codex CLI / OMC environment.

Goal:
- Inherit Cursor Story audit semantics
- Perform pass/fail judgment on Story documents
- Handoff to Dev Story after passing the audit
- Loopback to repair Story documents after audit failure

#### Required Inputs

- `storyDocPath`
- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- Relevant requirements sources/Epic/Story planning documents/constraint documents (if existing)

#### Codex Canonical Base

- Main text baseline source: Stage 2 Story Audit Template (`STORY-A2-AUDIT`) for the Cursor `bmad-story-assistant` skill.
- After the Story document is generated, the audit subtask must be initiated and iterated until "complete coverage and verification passed".
- Strictness selection:
  - **strict**: 3 consecutive rounds without gap + critical auditor >50%
  - **standard**: single + critical auditor
- Selection logic:
  - If there is no party-mode output (there is no `DEBATE_consensus_*`, `party-mode convergence record`, etc. in the story directory) or the user requires strict 鈫?use **strict** (to compensate for the missing party-mode depth)
  - If party-mode artifacts exist and user does not enforce strict 鈫?use **standard**
- Audit subagent priority:
  - Prioritize Story auditing through code-reviewer / equivalent reviewer
  - If reviewer is unavailable, fall back to the universal execution body, but the **complete** `STORY-A2-AUDIT` template must be passed in; **must not** be replaced by other universal audit prompt words
- The master agent must copy the entire `STORY-A2-AUDIT` template and replace the placeholders; summarizing, abbreviating or only passing the summary is prohibited.
- The audit content must be verified item by item:
  1. Whether the Story document fully covers the original requirements and Epic definition
  2. If there is any word in the prohibited word list in the Story document, it will be judged as failed.
  3. Whether the multi-solution scenario has reached consensus through debate and selected the optimal solution
  4. Is there technical debt or placeholder statements?
  5. If the Story contains "Responsible by Story
- The end of the report must output: conclusion (passed/failed) + required sub-items + Story stage parsable scoring blocks (overall rating A/B/C/D + four-dimensional scoring: requirements completeness/testability/consistency/traceability).
- Must do after passing the audit: return the fields required by `runAuditorHost` and let the invoking host/runner complete the story-stage close-out.
- When the audit fails: The audit sub-agent must **directly modify the audited Story document** within this round to eliminate the gap; if the recommendation involves creating or updating other Stories, the main Agent must first implement the recommendation and then re-audit the current Story.
- Phase 2 admission check: after receiving the phase 2 passing conclusion and before entering phase 3, the main agent must first confirm that the unified auditor host runner has completed story-stage post-audit automation; if not, backfill `runAuditorHost` instead of hand-running score CLI.

#### Stage 2 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 2 execution body:
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 2: Story 瀹¤ - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-story-audit
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?storyDocPath: {瀹為檯鍊紏
  鈥?epic_num: {瀹為檯鍊紏
  鈥?story_num: {瀹為檯鍊紏
  鈥?epic_slug: {瀹為檯鍊紏
  鈥?story_slug: {瀹為檯鍊紏

瀹¤涓ユ牸搴?
  鈥?褰撳墠妯″紡: {strict|standard}
  鈥?鍒ゅ畾渚濇嵁: {鏃?party-mode 浜х墿 鈫?strict / 鏈?party-mode 鈫?standard}

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 STORY-A2-AUDIT 瀹屾暣妯℃澘
  鈹?  鈹溾攢 閫愰」楠岃瘉瑕佹眰锛?澶ч獙璇侀」锛?  鈹?  鈹溾攢 鎵瑰垽瀹¤鍛樹粙鍏ヨ姹?  鈹?  鈹斺攢 鍙В鏋愯瘎鍒嗗潡鏍煎紡瑕佹眰
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary Executor: bmad-story-audit
  鈹?  鈹溾攢 Fallback: Codex reviewer 鈫?code-review skill 鈫?涓?Agent
  鈹?  鈹斺攢 Runtime Contracts: 鎶ュ憡璺緞銆佺姸鎬佹洿鏂?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌?      鈹溾攢 鎵瑰垽瀹¤鍛樼粨璁猴紙>50%瀛楁暟锛?      鈹溾攢 runAuditorHost 瑙﹀彂
      鈹斺攢 缁熶竴 auditor host runner 瀹屾垚鎬佹鏌?
棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT_story-{epic_num}-{story_num}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?鐘舵€佹洿鏂? story_audit_passed / story_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```
The Agent tool is called immediately after output.

#### Codex no-hooks Runtime Adapter

**Execution body calling method**

When the main Agent calls the Stage 2 execution body, the complete content of Stage 2 in this skill (including all audit requirements of the Codex Canonical Base) must be passed in through the `Agent` tool:
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 2 Story Audit"
prompt: |
  浣犱綔涓?bmad-story-audit 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 2 Story 瀹¤娴佺▼锛?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - storyDocPath: {瀹為檯璺緞}
  - epic_num: {瀹為檯鍊紏
  - story_num: {瀹為檯鍊紏
  - ...

  **Codex Canonical Base - 瀹¤瑕佹眰**锛堝畬鏁村鍒舵湰 skill Stage 2 閮ㄥ垎锛夛細
  [1. Story 鏂囨。鐢熸垚鍚庯紝蹇呴』鍙戣捣瀹¤瀛愪换鍔?..]
  [2. 涓ユ牸搴﹂€夋嫨锛歴trict/standard...]
  [3. 瀹¤鍐呭閫愰」楠岃瘉...]
  [4. 鎶ュ憡缁撳熬蹇呴』杈撳嚭...]
  [5. 瀹¤閫氳繃鍚庡繀鍋?..]

  **Repo Add-ons**锛?  - 蹇呴』鎵ц绂佹璇嶆鏌?  - 蹇呴』杈撳嚭鎵瑰垽瀹¤鍛樼粨璁?  - 蹇呴』杈撳嚭鍙В鏋愯瘎鍒嗗潡

  **Runtime Contracts**锛?  - 瀹¤鎶ュ憡璺緞锛?..
  - 瀹¤閫氳繃鍚庢洿鏂?state 涓?story_audit_passed

  瀹屾垚鍚庤緭鍑?PASS/FAIL handoff 鏍煎紡銆?```
**Important**: The executor does not load this skill by itself; all audit instructions, checklist items, and output-format requirements must be fully passed by the Main Agent via the `prompt` parameter.

---

**Primary Executor**
- `.codex/agents/bmad-story-audit.md` (called through the Agent tool, the complete prompt is passed in by the main Agent)

**Optional Reuse**
- Reusable `code-review` / reviewer capabilities assist in generating audit reports
- Reusable existing warehouse audit formats, critical auditor requirements and scoring block requirements

**Fallback Strategy**
1. Priority is given to `bmad-story-audit` agent to perform Story auditing
2. If the Codex reviewer is available, it will be reused for auxiliary review, but the final judgment will still be summarized and placed at this stage.
3. If the reviewer is unavailable, the main Agent directly executes the same three-tier structure audit prompt
4. Fallback shall not reduce audit stringency

**Runtime Contracts**
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md`
- Audit passed: update story state to `story_audit_passed`, handoff to `speckit-implement`
- Audit failed: Update story state to `story_audit_failed`, requiring the Story document to be repaired and re-audited.

#### Repo Add-ons

- Story audit must perform the forbidden word check of this warehouse
- Critical auditor conclusion must be output
- pass / fail / required_fixes must be clearly marked
- state and handoff must be compatible with the BMAD story state machine of this warehouse

#### Output / Handoff

**PASS**
```yaml
layer: 3
stage: story_audit_passed

execution_summary:
  agent: bmad-story-audit
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: passed
  strictness: {strict|standard}

audit_summary:
  gaps_found: 0
  criteria_verified:
    - requirement_coverage: passed
    - forbidden_words_check: passed
    - multi_solution_consensus: passed
    - tech_debt_check: passed
    - story_references_valid: passed
  critical_auditor_percentage: "{XX}%"
  score_block_generated: true

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md"
    exists: true
  score_data:
    path: "scoring/data/{epic_num}-{story_num}-story-audit.json"
    written: true

handoff:
  next_action: dev_story
  next_agent: speckit-implement
  ready: true
  mainAgentNextAction: dispatch_implement
  mainAgentReady: true
```

**FAIL**
```yaml
layer: 3
stage: story_audit_failed

execution_summary:
  agent: bmad-story-audit
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: failed

audit_summary:
  gaps_found: {N}
  criteria_failed:
    - {鍏蜂綋澶辫触椤箎
  critical_auditor_percentage: "{XX}%"

required_fixes_detail:
  fixes:
    - fix_id: FIX-001
      description: "{淇鎻忚堪}"
      location: "{鏂囨。浣嶇疆}"
      severity: critical|high|medium
  fix_strategy: direct_modify
  iteration_required: true

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
    modified_in_round: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md"
    exists: true

handoff:
  next_action: revise_story
  next_agent: bmad-story-create
  ready: true
  mainAgentNextAction: dispatch_remediation
  mainAgentReady: true
```
### Stage 3: Dev Story / `STORY-A3-DEV`

Claude's Stage 3 Dev Story execution body is responsible for executing tasks according to the TDD traffic light mode and completing code implementation.

#### Purpose

This stage is the execution adapter of the Dev Story stage in Cursor `bmad-story-assistant` in the Codex CLI / OMC environment.

Goal:
- Inherit the business semantics of Cursor Dev Story stage
- Strictly implement the TDD traffic light sequence
- Maintain ralph-method tracking files
- A Stage 4 Post Audit must be initiated after implementation

#### Required Inputs

- `tasksPath`: tasks.md file path
- `epic`: Epic number
- `story`: Story number
- `epicSlug`: Epic name slug
- `storySlug`: Story name slug
- `mode`: `bmad` or `standalone`

#### Codex Canonical Base

- Use `STORY-A3-DEV` as the main text baseline
- The pre-requisite document must be PASS (Story audit passing status)
- TDD traffic light sequence must be complete (RED 鈫?GREEN 鈫?REFACTOR)
- Must maintain ralph-method tracking files (prd.json + progress.txt)
- `STORY-A4-POSTAUDIT` must be initiated after the subtask returns
- 15 iron rules must be observed during implementation

#### Subtask Template (STORY-A3-DEV)
```yaml
description: "Execute Dev Story {epic}-{story} via STORY-A3-DEV workflow"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€?
  浣犱綔涓?speckit-implement / bmad-layer4-speckit-implement 鎵ц浣擄紝鎵ц BMAD Stage 3 Dev Story 娴佺▼銆?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - tasksPath: {瀹為檯璺緞}
  - epic: {瀹為檯鍊紏
  - story: {瀹為檯鍊紏
  - epicSlug: {瀹為檯鍊紏
  - storySlug: {瀹為檯鍊紏
  - mode: bmad

  **Codex Canonical Base - Dev Story 瑕佹眰**锛?  1. 鍓嶇疆妫€鏌ワ細Story 瀹¤蹇呴』宸?PASS
  2. 璇诲彇 tasks.md銆乸lan.md銆両MPLEMENTATION_GAPS.md
  3. 楠岃瘉 ralph-method 鏂囦欢瀛樺湪锛坧rd.json + progress.txt锛?  4. 閫愪换鍔℃墽琛?TDD 绾㈢豢鐏惊鐜細
     - [TDD-RED] 缂栧啓澶辫触鐨勬祴璇?     - [TDD-GREEN] 缂栧啓鏈€灏忓疄鐜颁娇娴嬭瘯閫氳繃
     - [TDD-REFACTOR] 閲嶆瀯浠ｇ爜
  5. 瀹炴椂鏇存柊 ralph-method 杩借釜鏂囦欢
  6. 鎵ц batch 闂村璁″拰鏈€缁堝璁?  7. 瀹屾垚鍚庡繀椤诲彂璧?STORY-A4-POSTAUDIT

  **寮哄埗绾︽潫**锛?  - 绂佹鍦ㄦ湭鍒涘缓 prd/progress 鍓嶅紑濮嬬紪鐮?  - 绂佹鍏堝啓鐢熶骇浠ｇ爜鍐嶈ˉ娴嬭瘯
  - 绂佹璺宠繃閲嶆瀯闃舵
  - 蹇呴』閬靛畧 15 鏉￠搧寰?
  **Repo Add-ons**锛?  - 鏇存柊 `.codex/state/stories/{epic}-{story}-progress.yaml` 涓?`implement_in_progress` / `implement_passed`
  - 鎵ц `run-auditor-host.ts` 璁板綍杩涘害
  - handoff 鍒?Stage 4 Post Audit
```
#### Stage 3 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 3 execution body:
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 3: Dev Story - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-layer4-dev-story
type: agent-sequence (5 sub-agents)
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?epic: {瀹為檯鍊紏
  鈥?story: {瀹為檯鍊紏
  鈥?epicSlug: {瀹為檯鍊紏
  鈥?storySlug: {瀹為檯鍊紏
  鈥?mode: {瀹為檯鍊紏

TDD 绾㈢豢鐏『搴忓己璋?
  1. RED: 鍏堝啓娴嬭瘯 鈫?娴嬭瘯澶辫触
  2. GREEN: 瀹炵幇浠ｇ爜 鈫?娴嬭瘯閫氳繃
  3. IMPROVE: 閲嶆瀯浠ｇ爜 鈫?淇濇寔閫氳繃

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 Layer 4 浜旈樁娈垫墽琛屽簭鍒?(specify 鈫?plan 鈫?gaps 鈫?tasks 鈫?implement)
  鈹?  鈹溾攢 姣忛樁娈?handoff 妫€鏌ョ偣
  鈹?  鈹斺攢 寮哄埗 TDD 瑕佹眰
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary: bmad-layer4-dev-story (sequence coordinator)
  鈹?  鈹溾攢 Sub-agents: specify, plan, gaps, tasks, implement
  鈹?  鈹斺攢 Runtime Contracts: 姣忛樁娈典骇鐗╄矾寰勩€佺姸鎬佹洿鏂?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌?      鈹溾攢 ralph-method 杩借釜
      鈹斺攢 TDD 璇佹嵁瀹℃煡

棰勬湡浜х墿:
  鈥?璁捐鏂囨。: _bmad-output/.../DESIGN-{epic}-{story}.md
  鈥?瀹炵幇浠ｇ爜: src/... (鏍规嵁 story 鑰屽畾)
  鈥?娴嬭瘯浠ｇ爜: tests/... (鏍规嵁 story 鑰屽畾)
  鈥?鐘舵€佹洿鏂? story_development_completed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```
The Agent tool is called immediately after output.

#### Codex no-hooks Runtime Adapter

**Execution body calling method**

When the main Agent calls the Stage 3 execution body, the complete content of Stage 3 in this skill must be passed in through the `Agent` tool:
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 3 Dev Story"
prompt: |
  浣犱綔涓?speckit-implement / bmad-layer4-speckit-implement 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 3 Dev Story 娴佺▼锛?
  [鏈?skill Stage 3 鐨勫畬鏁村唴瀹癸紝鍚?Required Inputs銆丆ursor Canonical Base銆丼ubtask Template锛屾墍鏈夊崰浣嶇宸叉浛鎹
```
**Important**: The execution body itself does not load the skill, and all instructions are completely passed by the main Agent through the prompt parameter.

---

**Primary Executor**
- `.codex/agents/speckit-implement.md`
- `.codex/agents/layers/bmad-layer4-speckit-implement.md` (BMAD mode)

**Fallback Strategy**
1. Prioritize execution by speckit-implement / bmad-layer4-speckit-implement
2. If unavailable, fall back to the main Agent and directly execute the TDD cycle
3. Batch audit and final audit are performed by `auditor-implement` or the main Agent

**Runtime Contracts**
- Must create/update ralph-method tracking files (prd.json + progress.txt)
- Must be executed in TDD order (RED 鈫?GREEN 鈫?REFACTOR)
- Update prd.json passes status after each User Story is completed
- TDD loops must be logged to progress.txt
- Stage 4 Post Audit must be triggered after implementation

#### Repo Add-ons

- progress / prd update requirements
- This warehouse's scoring / handoff / lint / key path requirements
- Strict convergence check (continuous 3 rounds no gap)
-Critical auditor intervention

#### Output / Handoff

Output handoff after completion:
```yaml
layer: 4
stage: implement_passed

execution_summary:
  agent: speckit-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: party_mode_check
      status: passed
      result: "party-mode.yaml 宸茬‘璁?
    - step: spec_read
      status: completed
      result: "spec.md 宸茶鍙?
    - step: plan_read
      status: completed
      result: "plan.md 宸茶鍙?
    - step: tasks_read
      status: completed
      result: "tasks.md 宸茶鍙?
    - step: tdd_red
      status: completed
      result: "娴嬭瘯宸茬紪鍐欙紝澶辫触鐘舵€佺‘璁?
    - step: tdd_green
      status: completed
      result: "瀹炵幇宸茬紪鍐欙紝娴嬭瘯閫氳繃"
    - step: tdd_refactor
      status: completed
      result: "浠ｇ爜宸查噸鏋?
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_passed"

tdd_summary:
  red_phase:
    tests_written: {count}
    tests_failed_initially: {count}
    status: completed
  green_phase:
    implementation_complete: true
    tests_passing: {count}
    status: completed
  refactor_phase:
    code_quality_checks_passed: true
    test_coverage: "{percent}%"
    status: completed

ralph_method_status:
  prd_json_updated: true
  progress_txt_updated: true
  passes_status: "all_passed"

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  implementation_code:
    path: "{implementationPath}"
    exists: true
    file_count: {count}
  test_files:
    path: "{testPath}"
    exists: true
    coverage: "{percent}%"
  ralph_artifacts:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/"
    files:
      - "prd.json"
      - "progress.txt"

handoff:
  next_action: post_audit
  next_agent: auditor-implement
  next_stage: 4
  ready: true
  mainAgentNextAction: dispatch_review
  mainAgentReady: true
  prerequisites_met:
    - tdd_cycle_complete
    - ralph_method_tracked
    - state_updated
```
**Runtime Governance (S11 - post-audit):** The main Agent executes before calling the post-audit subtask:
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit`
Execute after the subtask returns:
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit --persist`
`{story_key}` is the kebab-case key of the current Story.

### Stage 4: Post Audit / `STORY-A4-POSTAUDIT`

Claude is the Stage 4 Post Audit executor, responsible for strictly auditing the Dev Story implementation results.

#### Purpose

This stage is the execution adapter of the Post Audit stage in Cursor `bmad-story-assistant` in the Codex CLI / OMC environment.

Goal:
- Inherit Cursor Post Audit semantics
- Verify that the code implementation fully covers tasks, specs, and plans
- Special review of TDD implementation evidence and ralph-method tracking files
- Decide whether to allow entry to the commit gate

#### Required Inputs

- `artifactDocPath`: the code/document path under review
- `reportPath`: audit report saving path
- `tasksPath`: tasks.md path (for comparison)
- `specPath`: spec.md path (for comparison, optional)
- `planPath`: plan.md path (for comparison, optional)
- `epic`: Epic number
- `story`: Story number
- `epicSlug`: Epic name slug
- `storySlug`: Story name slug
- `iterationCount`: current iteration round number (default 0)
- `strictness`: strictness mode (simple/standard/strict, default standard)

#### Codex Canonical Base

- Baseline Cursor post-audit semantics
- post-audit is a required step, not optional
- The subject of review is **code implementation**, not documentation
- **Do not modify the code directly** when a gap is discovered (the main Agent entrusts the sub-agent to implement modifications)
- Use **code pattern dimensions** (functionality, code quality, test coverage, security)
- Evidence of TDD traffic light execution must be verified
- Must check ralph-method trace file
- `runAuditorHost` must be triggered after the audit passes

#### Subtask Template (STORY-A4-POSTAUDIT)
```yaml
description: "Execute Post Audit for {epic}-{story} via STORY-A4-POSTAUDIT"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€?
  浣犱綔涓?auditor-implement 鎵ц浣擄紝鎵ц BMAD Stage 4 Post Audit 娴佺▼銆?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - artifactDocPath: {瀹為檯璺緞}
  - reportPath: {瀹為檯璺緞}
  - tasksPath: {瀹為檯璺緞}
  - specPath: {瀹為檯璺緞}
  - planPath: {瀹為檯璺緞}
  - epic: {瀹為檯鍊紏
  - story: {瀹為檯鍊紏
  - iterationCount: {瀹為檯鍊紏
  - strictness: {standard|strict}

  **Codex Canonical Base - Post Audit 瑕佹眰**锛?  1. 璇诲彇 audit-prompts.md 搂5
  2. 璇诲彇鎵瑰垽瀹¤鍛樿鑼?  3. 璇诲彇瀹炴柦鍚庡璁¤鍒?  4. 璇诲彇 tasks.md銆乻pec.md銆乸lan.md 浣滀负瀵圭収鍩虹嚎
  5. 璇诲彇 ralph-method 杩借釜鏂囦欢锛坧rd.json + progress.txt锛?  6. 閫愰」楠岃瘉浠ｇ爜瀹炵幇瑕嗙洊搴?  7. 涓撻」瀹℃煡 TDD 绾㈢豢鐏墽琛岃瘉鎹?  8. 鐢熸垚鍖呭惈鎵瑰垽瀹¤鍛樼粨璁虹殑瀹屾暣鎶ュ憡
  9. 鎶ュ憡缁撳熬杈撳嚭鍙В鏋愯瘎鍒嗗潡

  **瀹¤缁村害**锛?  - 鍔熻兘鎬у疄鐜板畬鏁存€?  - 浠ｇ爜璐ㄩ噺鏍囧噯
  - 娴嬭瘯瑕嗙洊鐜?  - 瀹夊叏鎬ф鏌?
  **Repo Add-ons**锛?  - 绂佹璇嶆鏌?  - 鎵瑰垽瀹¤鍛樼粨璁?  - runAuditorHost 瑙﹀彂
  - commit gate 鍓嶇疆鏉′欢妫€鏌?```
#### Stage 4 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 4 execution body:
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 4: Post Audit - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-story-post-audit
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?artifactDocPath: {瀹為檯鍊紏
  鈥?reportPath: {瀹為檯鍊紏
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?specPath: {瀹為檯鍊紏
  鈥?planPath: {瀹為檯鍊紏
  鈥?gapsPath: {瀹為檯鍊紏
  鈥?implementationPath: {瀹為檯鍊紏

浠ｇ爜妯″紡缁村害寮鸿皟:
  鈥?绂佹璇嶆鏌? 鏃犳ā绯婅〃杩般€佹棤寤舵湡鎵胯
  鈥?涓€鑷存€ф鏌? 瀹炵幇涓?spec/plan/tasks 瀵归綈
  鈥?TDD 璇佹嵁瀹℃煡: 娴嬭瘯瑕嗙洊鐜?鈮?80%
  鈥?浠ｇ爜璐ㄩ噺: 鍑芥暟 < 50 琛岋紝鏂囦欢 < 800 琛?
strict convergence 妫€鏌?
  鈥?绗?杞? 鍒濇瀹¤锛屽彂鐜版墍鏈?gap
  鈥?绗?杞? 楠岃瘉淇锛岀‘璁ゆ棤鏂?gap
  鈥?绗?杞? 鏈€缁堢‘璁わ紝杈撳嚭閫氳繃鏍囪

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 POST-AUDIT-PROTOCOL 瀹屾暣妯℃澘
  鈹?  鈹溾攢 5澶т唬鐮佸璁＄淮搴︼紙绂佹璇?涓€鑷存€?TDD/璐ㄩ噺/瀹夊叏锛?  鈹?  鈹溾攢 鎵瑰垽瀹¤鍛樹粙鍏ヨ姹?  鈹?  鈹斺攢 鍙В鏋愯瘎鍒嗗潡鏍煎紡
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary Executor: bmad-story-post-audit
  鈹?  鈹溾攢 Fallback: auditor-spec/plan/tasks/implement 搴忓垪
  鈹?  鈹斺攢 Runtime Contracts: 瀹¤鎶ュ憡璺緞銆佽瘎鍒嗗啓鍏?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌ワ紙鍚唬鐮佹敞閲婏級
      鈹溾攢 鎵瑰垽瀹¤鍛樼粨璁猴紙>50%瀛楁暟锛?      鈹溾攢 runAuditorHost 瑙﹀彂
      鈹斺攢 strict 妯″紡 3 杞敹鏁?
棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?鐘舵€佹洿鏂? story_audit_passed / story_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```
The Agent tool is called immediately after output.

#### Codex no-hooks Runtime Adapter

**Execution body calling method**

When the main Agent calls the Stage 4 execution body, the complete content of Stage 4 in this skill must be passed in through the `Agent` tool:
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 4 Post Audit"
prompt: |
  浣犱綔涓?auditor-implement 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 4 Post Audit 娴佺▼锛?
  [鏈?skill Stage 4 鐨勫畬鏁村唴瀹癸紝鍚?Required Inputs銆丆ursor Canonical Base銆丼ubtask Template锛屾墍鏈夊崰浣嶇宸叉浛鎹
```
**Important**: The execution body itself does not load the skill, and all audit instructions are completely passed by the main Agent through the prompt parameter.

---

**Primary Executor**
- `.codex/agents/auditors/auditor-implement.md`

**Fallback Strategy**
1. Post Audit is executed by `auditor-implement` agent first.
2. If unavailable, fall back to Codex reviewer
3. If it is no longer available, fall back to `code-review` skill
4. Finally, fall back to the main Agent and directly execute the same three-layer audit prompt.

**Runtime Contracts**
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md`
- `run-auditor-host.ts` must be executed after passing the audit
- Update story state to `implement_passed` after passing the audit
- After audit failure, update story state to `implement_failed` and fall back to Stage 3 for repair

#### Repo Add-ons

- strict convergence (no gap for 3 consecutive rounds)
- Criticize the auditor鈥檚 conclusions
- runAuditorHost triggers
- commit gate precondition check
- Check forbidden words in this warehouse

#### Output / Handoff

**PASS**
```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "浠ｇ爜瀹炵幇宸茶鍙?
    - step: tasks_comparison
      status: completed
      result: "tasks 瑕嗙洊搴﹀凡楠岃瘉"
    - step: spec_comparison
      status: completed
      result: "spec 瀵归綈搴﹀凡楠岃瘉"
    - step: tdd_evidence_review
      status: completed
      result: "TDD 绾㈢豢鐏瘉鎹凡瀹℃煡"
    - step: ralph_method_check
      status: completed
      result: "ralph-method 杩借釜鏂囦欢宸叉鏌?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: parse_and_write_score
      status: completed
      result: "璇勫垎宸插啓鍏?scoring/data/"
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_audit_passed"

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  tdd_evidence:
    red_phase_confirmed: true
    green_phase_confirmed: true
    refactor_phase_confirmed: true
    test_coverage: "{percent}%"
  ralph_method_check:
    prd_json_complete: true
    progress_txt_complete: true
    all_stories_passed: true
  code_quality:
    avg_function_lines: {number}
    avg_file_lines: {number}
    no_banned_words: true
    security_checks_passed: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  mainAgentNextAction: run_closeout
  mainAgentReady: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**FAIL**
```yaml
layer: 4
stage: implement_audit_failed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "浠ｇ爜瀹炵幇宸茶鍙?
    - step: tasks_comparison
      status: failed
      result: "鍙戠幇 tasks 鏈鐩栭」"
    - step: spec_comparison
      status: failed
      result: "鍙戠幇 spec 鍋忕椤?
    - step: tdd_evidence_review
      status: failed
      result: "TDD 璇佹嵁涓嶈冻"
    - step: ralph_method_check
      status: failed
      result: "ralph-method 杩借釜涓嶅畬鏁?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: gap_documentation
      status: completed
      result: "鎵€鏈?gap 宸茶褰?

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  gaps_found:
    total: {count}
    critical: {count}
    major: {count}
    minor: {count}
  required_fixes:
    - category: "tasks_coverage"
      description: "{gap_description}"
      priority: critical
    - category: "spec_alignment"
      description: "{gap_description}"
      priority: major
    - category: "tdd_evidence"
      description: "{gap_description}"
      priority: major
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "FAIL"
    critical_gaps: {count}

required_fixes_detail:
  fix_strategy: "return_to_stage_3"
  estimated_fix_time: "{duration}"
  fix_categories:
    - category: "implementation"
      items: [{gap_items}]
    - category: "tests"
      items: [{gap_items}]
    - category: "documentation"
      items: [{gap_items}]

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  gaps_list:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/GAPS_{epic}-{story}_stage4.md"
    exists: true

handoff:
  next_action: fix_implement
  next_agent: speckit-implement
  next_stage: 3
  ready: true
  mainAgentNextAction: dispatch_remediation
  mainAgentReady: true
  fix_required: true
  prerequisites_met:
    - audit_completed
    - gaps_documented
    - reviewer_conclusion_verified
```
---

#### Story Type Detection (Code vs Document Mode)

Stage 4 supports two audit modes, automatically routing according to Story type:

| Story type | Detection basis | Audit mode | Execution body |
|-----------|----------|----------|--------|
| **Code Implementation Type** | tasks.md contains code tasks, spec.md defines interface/implementation | Code Mode | `auditor-implement` |
| **Document verification type** | tasks.md tasks are pure documentation/verification work, no production code | Document Mode | `auditor-document` |

**Automatic detection logic** (main Agent execution):
```typescript
// TypeScript 妫€娴嬮€昏緫绀轰緥
function detectStoryType(tasksPath: string, specPath?: string): 'code' | 'document' {
  const tasksContent = readFile(tasksPath);

  // 鏂囨。鍨嬬壒寰侊細浠诲姟鍧囦负鏂囨。鍒涘缓銆侀獙璇併€佹祴璇曢厤缃瓑
  const documentPatterns = [
    /鍒涘缓.*鏂囨。/i,
    /楠岃瘉.*杈撳嚭/i,
    /妫€鏌?*閰嶇疆/i,
    /娴嬭瘯.*Story/i,
    /鏂囨。.*鐢熸垚/i,
    /鏍煎紡.*楠岃瘉/i,
  ];

  // 浠ｇ爜鍨嬬壒寰侊細娑夊強鐢熶骇浠ｇ爜銆佹帴鍙ｅ疄鐜般€佹ā鍧楀紑鍙?  const codePatterns = [
    /瀹炵幇.*鍑芥暟/i,
    /鍒涘缓.*妯″潡/i,
    /娣诲姞.*鎺ュ彛/i,
    /缂栧啓.*浠ｇ爜/i,
    /寮€鍙?*鍔熻兘/i,
    /refactor|閲嶆瀯/i,
  ];

  const docMatches = documentPatterns.filter(p => p.test(tasksContent)).length;
  const codeMatches = codePatterns.filter(p => p.test(tasksContent)).length;

  // 浼樺厛鍒ゆ柇锛氬鏋滄湁浠ｇ爜鐩稿叧浠诲姟锛岃涓轰唬鐮佸瀷
  if (codeMatches > 0) return 'code';
  if (docMatches > 0 && codeMatches === 0) return 'document';

  // 榛樿淇濆畧绛栫暐锛氭寜浠ｇ爜鍨嬪鐞嗭紙鏇翠弗鏍硷級
  return 'code';
}
```
#### Extended Codex Canonical Base (Code vs Document)

**Code Mode (code audit mode)**:

- The subject of review is **code implementation**, not documentation
- **Do not modify the code directly** when a gap is discovered (the main Agent entrusts the sub-agent to implement modifications)
- Use **code pattern dimensions** (functionality, code quality, test coverage, security)
- Evidence of TDD traffic light execution must be verified
- Must check ralph-method trace file
- `runAuditorHost` must be triggered after the audit passes

**Document Mode**:

- The subject of review is the **Story document itself**, not the code
- When a gap is found **directly modify the document under review** (auditor will repair it by itself)
- Use **document mode dimensions** (document completeness, task completion, consistency, traceability)
- No need to check TDD evidence (no code)
- No need to check ralph-method file (no code)
- Must verify that all tasks in tasks.md are marked complete
- `runAuditorHost` must be triggered after the audit passes

#### Code vs Document audit comparison

| Project | Code audit (auditor-implement) | Document audit (auditor-document) |
|------|----------------------------------|----------------------------------|
| **Object being reviewed** | Code implementation | Story document itself |
| **When a gap is found** | **Do not modify the code** (main Agent entrusts modification) | **Modify the document directly** (auditor repairs it by itself) |
| **Dimensions** | Functionality/code quality/test coverage/security | Documentation completeness/task completion/consistency/traceability |
| **TDD Check** | Forced check by US | None (no code) |
| **ralph-method** | Force check prd.json + progress.txt | None (no code) |
| **tasks check** | Verify code coverage tasks | Verify task mark completion |
| **Forbidden word check** | progress.txt + code comments | Story document full text |
| **Iterative convergence** | 3 consecutive rounds without gap (strict) | 3 consecutive rounds without gap (strict) |
| **Critical Auditor** | 鈮?0% word count | 鈮?0% word count |

---

### Document Mode Subtask Template (STORY-A4-DOCUMENT-AUDIT)
```yaml
description: "Execute Document Post Audit for {epic}-{story} via STORY-A4-DOCUMENT-AUDIT"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€?
  浣犱綔涓?auditor-document 鎵ц浣擄紝鎵ц BMAD Stage 4 Post Audit锛堟枃妗ｅ璁℃ā寮忥級娴佺▼銆?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - artifactDocPath: {瀹為檯璺緞}锛堣瀹?Story 鏂囨。璺緞锛?  - tasksPath: {瀹為檯璺緞}锛堥獙璇佷换鍔″畬鎴愮姸鎬侊級
  - reportPath: {瀹為檯璺緞}锛堝璁℃姤鍛婁繚瀛樿矾寰勶級
  - epic: {瀹為檯鍊紏
  - story: {瀹為檯鍊紏
  - iterationCount: {瀹為檯鍊紏
  - strictness: {standard|strict}

  **Codex Canonical Base - Document Audit 瑕佹眰**锛?  1. 璇诲彇 audit-prompts.md 搂1锛堝€熺敤 spec 瀹¤鐨勬枃妗ｆ鏌ユ柟娉曪級
  2. 璇诲彇鎵瑰垽瀹¤鍛樿鑼?  3. 璇诲彇鏂囨。杩唬瑙勫垯
  4. 璇诲彇琚 Story 鏂囨。
  5. 璇诲彇 tasks.md锛岄獙璇佹墍鏈変换鍔″凡鏍囪瀹屾垚
  6. 妫€鏌?Story 鏂囨。璐ㄩ噺锛堝畬鏁存€с€佸噯纭€с€佽鑼冩€э級
  7. 妫€鏌ユ枃妗ｄ腑鏃犵姝㈣瘝銆佹棤妯＄硦琛ㄨ堪
  8. 鍙戠幇 gap 鏃剁洿鎺ヤ慨鏀硅瀹℃枃妗?  9. 鐢熸垚鍖呭惈鎵瑰垽瀹¤鍛樼粨璁虹殑瀹屾暣鎶ュ憡
  10. 鎶ュ憡缁撳熬杈撳嚭鍙В鏋愯瘎鍒嗗潡

  **瀹¤缁村害**锛圖ocument Mode锛夛細
  - 鏂囨。瀹屾暣鎬э細缁撴瀯瀹屾暣銆佺珷鑺傞綈鍏ㄣ€佹牸寮忚鑼?  - 浠诲姟瀹屾垚搴︼細tasks.md 涓墍鏈変换鍔″凡鏍囪瀹屾垚
  - 涓€鑷存€э細鏂囨。鍐呴儴涓€鑷淬€佷笌鍓嶇疆鏂囨。涓€鑷?  - 鍙拷婧€э細闇€姹傚彲杩芥函鍒伴獙鏀舵爣鍑?
  **Repo Add-ons**锛?  - 绂佹璇嶆鏌ワ紙Story 鏂囨。鍏ㄦ枃锛?  - 鎵瑰垽瀹¤鍛樼粨璁猴紙>50%瀛楁暟锛?  - runAuditorHost 瑙﹀彂
  - commit gate 鍓嶇疆鏉′欢妫€鏌?```
---

#### Stage 4 pre-call CLI output requirements (dual mode)

**Code Mode call summary**:
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 4: Post Audit (Code Mode) - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? auditor-implement
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

Story 绫诲瀷妫€娴?
  鈥?妫€娴嬩緷鎹? tasks.md 鍐呭鍒嗘瀽
  鈥?妫€娴嬬粨鏋? 浠ｇ爜瀹炵幇鍨嬶紙Code Mode锛?
杈撳叆鍙傛暟:
  鈥?artifactDocPath: {瀹為檯鍊紏
  鈥?reportPath: {瀹為檯鍊紏
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?specPath: {瀹為檯鍊紏
  鈥?planPath: {瀹為檯鍊紏

浠ｇ爜妯″紡缁村害寮鸿皟:
  鈥?绂佹璇嶆鏌? 鏃犳ā绯婅〃杩般€佹棤寤舵湡鎵胯
  鈥?涓€鑷存€ф鏌? 瀹炵幇涓?spec/plan/tasks 瀵归綈
  鈥?TDD 璇佹嵁瀹℃煡: 娴嬭瘯瑕嗙洊鐜?鈮?80%
  鈥?浠ｇ爜璐ㄩ噺: 鍑芥暟 < 50 琛岋紝鏂囦欢 < 800 琛?
strict convergence 妫€鏌?
  鈥?绗?杞? 鍒濇瀹¤锛屽彂鐜版墍鏈?gap
  鈥?绗?杞? 楠岃瘉淇锛岀‘璁ゆ棤鏂?gap
  鈥?绗?杞? 鏈€缁堢‘璁わ紝杈撳嚭閫氳繃鏍囪

棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?鐘舵€佹洿鏂? implement_audit_passed / implement_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```
**Document Mode call summary**:
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 4: Post Audit (Document Mode) - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? auditor-document
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

Story 绫诲瀷妫€娴?
  鈥?妫€娴嬩緷鎹? tasks.md 鍐呭鍒嗘瀽
  鈥?妫€娴嬬粨鏋? 鏂囨。楠岃瘉鍨嬶紙Document Mode锛?
杈撳叆鍙傛暟:
  鈥?artifactDocPath: {瀹為檯鍊紏
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?reportPath: {瀹為檯鍊紏

鏂囨。妯″紡缁村害寮鸿皟:
  鈥?鏂囨。瀹屾暣鎬? 缁撴瀯瀹屾暣銆佺珷鑺傞綈鍏ㄣ€佹牸寮忚鑼?  鈥?浠诲姟瀹屾垚搴? tasks.md 涓墍鏈変换鍔″凡鏍囪瀹屾垚
  鈥?涓€鑷存€? 鏂囨。鍐呴儴涓€鑷淬€佷笌鍓嶇疆鏂囨。涓€鑷?  鈥?鍙拷婧€? 闇€姹傚彲杩芥函鍒伴獙鏀舵爣鍑?
鍏抽敭鍖哄埆:
  鈥?琚瀵硅薄: Story 鏂囨。鏈韩锛堥潪浠ｇ爜锛?  鈥?Gap 淇: 瀹¤瀛愪唬鐞嗙洿鎺ヤ慨鏀规枃妗?  鈥?鏃?TDD 妫€鏌? 鏃犱唬鐮佸疄鐜?  鈥?鏃?ralph-method: 鏃犱唬鐮佸疄鐜?
strict convergence 妫€鏌?
  鈥?绗?杞? 鍒濇瀹¤锛屽彂鐜版墍鏈?gap
  鈥?绗?杞? 楠岃瘉淇锛岀‘璁ゆ棤鏂?gap
  鈥?绗?杞? 鏈€缁堢‘璁わ紝杈撳嚭閫氳繃鏍囪

棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?Gap 淇: 鐩存帴淇敼 Story 鏂囨。
  鈥?鐘舵€佹洿鏂? implement_audit_passed / implement_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```
The Agent tool is called immediately after output.

---

#### Codex no-hooks Runtime Adapter (dual mode)

**Execution body calling method**

When the main Agent calls the Stage 4 execution body, it must select the correct execution body according to the Story type:
```typescript
// 涓?Agent 璺敱閫昏緫
const storyType = detectStoryType(tasksPath, specPath);

if (storyType === 'code') {
  // Code Mode - 浣跨敤 auditor-implement
  await Agent({
    subagent_type: 'general-purpose',
    description: "Execute Stage 4 Post Audit (Code Mode)",
    prompt: codeModePrompt // 瀹屾暣 STORY-A4-POSTAUDIT 妯℃澘
  });
} else {
  // Document Mode - 浣跨敤 auditor-document
  await Agent({
    subagent_type: 'general-purpose',
    description: "Execute Stage 4 Post Audit (Document Mode)",
    prompt: documentModePrompt // 瀹屾暣 STORY-A4-DOCUMENT-AUDIT 妯℃澘
  });
}
```
**Primary Executor (by mode)**

| Mode | Primary Executor | Agent File |
|------|------------------|------------|
| Code Mode | `auditor-implement` | `.codex/agents/auditors/auditor-implement.md` |
| Document Mode | `auditor-document` | `.codex/agents/auditors/auditor-document.md` |

**Fallback Strategy (dual mode)**

Code Mode:
1. Post Audit is executed by `auditor-implement` agent first.
2. If unavailable, fall back to Codex reviewer
3. If it is no longer available, fall back to `code-review` skill
4. Finally, fall back to the main Agent and directly execute the same three-layer audit prompt.

Document Mode:
1. Post Audit is executed by `auditor-document` agent first.
2. If unavailable, fall back to Codex reviewer
3. If it is no longer available, fall back to `code-review` skill
4. Finally, fall back to the main Agent and directly execute the same three-layer audit prompt.

**Important**: The execution body itself does not load the skill, and all audit instructions are completely passed by the main Agent through the prompt parameter.

---

**Runtime Contracts (dual mode)**

Code Mode:
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md`
- `run-auditor-host.ts` must be executed after passing the audit
- Update story state to `implement_passed` after passing the audit
- After audit failure, update story state to `implement_failed` and fall back to Stage 3 for repair

Document Mode:
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md`
- `run-auditor-host.ts` must be executed after passing the audit
- After passing the audit, update the story state to `implement_passed` (document-type Story is regarded as implemented)
- After the audit fails, update the story state to `implement_failed` and return to the repair document

---

#### Repo Add-ons (dual mode)

Code Mode:
- strict convergence (no gap for 3 consecutive rounds)
- Criticize the auditor鈥檚 conclusions
- runAuditorHost triggers
- commit gate precondition check
- Inspection of forbidden words in this warehouse (including code comments)
- TDD traffic light review
- ralph-method tracking file review

Document Mode:
- strict convergence (no gap for 3 consecutive rounds)
- Criticize the auditor鈥檚 conclusion (鈮?0% word count)
- runAuditorHost triggers
- commit gate precondition check
- Check forbidden words in this warehouse (full text of Story document)
- Document structural integrity check
- Verification of task completion

---

#### Output / Handoff (dual mode)

**Code Mode-PASS**
```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "浠ｇ爜瀹炵幇宸茶鍙?
    - step: tasks_comparison
      status: completed
      result: "tasks 瑕嗙洊搴﹀凡楠岃瘉"
    - step: spec_comparison
      status: completed
      result: "spec 瀵归綈搴﹀凡楠岃瘉"
    - step: tdd_evidence_review
      status: completed
      result: "TDD 绾㈢豢鐏瘉鎹凡瀹℃煡"
    - step: ralph_method_check
      status: completed
      result: "ralph-method 杩借釜鏂囦欢宸叉鏌?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: parse_and_write_score
      status: completed
      result: "璇勫垎宸插啓鍏?scoring/data/"
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_audit_passed"

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  tdd_evidence:
    red_phase_confirmed: true
    green_phase_confirmed: true
    refactor_phase_confirmed: true
    test_coverage: "{percent}%"
  ralph_method_check:
    prd_json_complete: true
    progress_txt_complete: true
    all_stories_passed: true
  code_quality:
    avg_function_lines: {number}
    avg_file_lines: {number}
    no_banned_words: true
    security_checks_passed: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  mainAgentNextAction: run_closeout
  mainAgentReady: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**Document Mode - PASS**

```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-document
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: document_read
      status: completed
      result: "Story 鏂囨。宸茶鍙?
    - step: tasks_read
      status: completed
      result: "tasks.md 宸茶鍙栵紝鎵€鏈変换鍔″凡鏍囪瀹屾垚"
    - step: document_structure_check
      status: completed
      result: "鏂囨。缁撴瀯瀹屾暣鎬у凡楠岃瘉"
    - step: forbidden_words_check
      status: completed
      result: "绂佹璇嶆鏌ラ€氳繃"
    - step: document_consistency_check
      status: completed
      result: "鏂囨。涓€鑷存€у凡楠岃瘉"
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: parse_and_write_score
      status: completed
      result: "璇勫垎宸插啓鍏?scoring/data/"
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_audit_passed"

audit_summary:
  coverage:
    document_complete: true
    tasks_all_completed: true
    no_gaps_found: true
  document_quality:
    structure_complete: true
    format_compliant: true
    no_banned_words: true
    links_valid: true
  document_consistency:
    internal_consistent: true
    aligned_with_spec: true
    aligned_with_plan: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{artifactDocPath}"
    exists: true
    modified_in_round: false
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  mainAgentNextAction: run_closeout
  mainAgentReady: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**Document Mode - FAIL**

```yaml
layer: 4
stage: implement_audit_failed

execution_summary:
  agent: auditor-document
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: document_read
      status: completed
      result: "Story 鏂囨。宸茶鍙?
    - step: tasks_read
      status: failed
      result: "鍙戠幇鏈畬鎴愪换鍔?
    - step: document_structure_check
      status: failed
      result: "鏂囨。缁撴瀯涓嶅畬鏁?
    - step: forbidden_words_check
      status: failed
      result: "鍙戠幇绂佹璇?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: gap_fix_document
      status: completed
      result: "宸茬洿鎺ヤ慨鏀?Story 鏂囨。"
    - step: gap_documentation
      status: completed
      result: "鎵€鏈?gap 宸茶褰?

audit_summary:
  gaps_found:
    total: {count}
    critical: {count}
    major: {count}
    minor: {count}
  required_fixes:
    - category: "tasks_completion"
      description: "{gap_description}"
      priority: critical
    - category: "document_structure"
      description: "{gap_description}"
      priority: major
    - category: "forbidden_words"
      description: "{gap_description}"
      priority: major
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "FAIL"
    critical_gaps: {count}

required_fixes_detail:
  fix_strategy: "direct_document_modify"
  estimated_fix_time: "{duration}"
  fix_categories:
    - category: "document_structure"
      items: [{gap_items}]
    - category: "forbidden_words"
      items: [{gap_items}]
    - category: "tasks_completion"
      items: [{gap_items}]

artifacts:
  story_doc:
    path: "{artifactDocPath}"
    exists: true
    modified_in_round: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  gaps_list:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/GAPS_{epic}-{story}_stage4.md"
    exists: true

handoff:
  next_action: fix_document
  next_agent: auditor-document
  next_stage: 4
  ready: true
  mainAgentNextAction: dispatch_remediation
  mainAgentReady: true
  fix_required: true
  prerequisites_met:
    - audit_completed
    - gaps_documented
    - document_modified
    - reviewer_conclusion_verified
```
---

## Failure / Recovery Matrix

| Scene | Primary Action | Fallback | Result |
|------|------|------|------|
| Story audit failed | Repair Story document and review again | reviewer fallback | Not allowed to enter Dev Story |
| Spec audit failed | Repair spec and try again | `auditor-spec` fallback | Not allowed to enter plan |
| Plan audit failed | Repair plan and try again | `auditor-plan` fallback | Do not enter tasks |
| Tasks audit failed | Repair tasks and retry | `auditor-tasks` fallback | Do not enter implement |
| implement audit failed (Code Mode) | Fix code/documentation and re-review | `auditor-implement` fallback | Do not enter commit gate |
| implement audit failure (Document Mode) | modify the document directly and review again | `auditor-document` fallback | not allowed to enter the commit gate |
| OMC is not available | Fallback to warehouse definition reviewer / skill / main agent | Level-by-level fallback | Keep semantics and output contracts unchanged |
| state drift | read `.codex/state/...` restore context | handoff + report to get the bottom of things | continue with the correct phase after recovery |
| Product missing | Stop and ask to complete prerequisite files | None | No stage skipping allowed |

---

## State / Audit / Handoff Contracts

### Status truth source
- `bmad-progress.yaml` is the global stage truth source
- `stories/*-progress.yaml` is the story-level source of truth

### Audit rules
- Failed audit = stage not completed
- fail = must be repaired
- pass = to update status/continue to next stage
- implement audit must meet strict convergence (if required by the current rules of the warehouse)

### handoff minimum field
- `layer`
- `stage`
- `artifactDocPath` / `artifacts`
- `auditReportPath`
- `iteration_count`
- `next_action`

---

## Runtime Prohibitions

1. It is prohibited to mix Codex Canonical Base, Runtime Adapter, and Repo Add-ons into a rewritten version of prompt from unknown sources.
2. It is forbidden to use fallback as an excuse for downgrading semantics
3. Disable bypassing post-audit
4. It is forbidden to advance the state without updating it.
5. It is forbidden to commit before the audit gate is met.

---

## Implementation suggestions (follow-up)

1. Use this skill as a unified entry point for `bmad-story-assistant` in Codex CLI
2. Subsequent completion:
   - Claude Actuator Mapping for Story Create
   - Story audit standard execution body
3. Gradually recycle the existing adaptation rules in `.codex/agents/*.md` into:
   -Skill main entrance
   - stage executor
   - Stage audit executor

---

## Verification Requirements

After the Claude version of the skill is launched, it should at least meet the following verifications:

- No hardcoded local absolute paths allowed
- Canonical Base must be bound to an explicit Cursor template/stage
- Runtime Adapter must have:
  - `Primary Executor`
  - `Fallback Strategy`
  - `Runtime Contracts`
- The relevant accept test must pass
- Audit fail / pass / retry / resume paths must pass grep and status file verification

---

## One sentence conclusion

> The Claude version of `bmad-story-assistant` is not a direct copy of the Cursor skill, but a unified orchestration entry with Cursor as the semantic baseline, Codex no-hooks as the execution adaptation layer, and repository-local rules as the enhancement layer.

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
