---
name: bmad-code-reviewer-lifecycle
description: |
  Codex CLI / OMC 鐗堝叏閾捐矾 Code Reviewer Lifecycle Skill 閫傞厤鍏ュ彛銆?  浠?Cursor bmad-code-reviewer-lifecycle 涓鸿涔夊熀绾匡紝缂栨帓 BMAD 宸ヤ綔娴佸悇 stage 鐨勫璁′骇鍑衡啋瑙ｆ瀽鈫抯coring 鍐欏叆闂幆銆?  瀹氫箟瑙﹀彂鏃舵満銆乻tage 鏄犲皠銆佹姤鍛婅矾寰勭害瀹氾紱寮曠敤 auditor-* 鎵ц浣撱€乤udit-prompts銆乧ode-reviewer-config銆乻coring/rules銆?  涓?speckit-workflow銆乥mad-story-assistant 鍗忓悓锛宻tage 瀹¤閫氳繃鍚庤皟鐢ㄨВ鏋愬苟鍐欏叆 scoring 瀛樺偍銆?when_to_use: |
  Use when: BMAD 宸ヤ綔娴佸悇 stage锛坧rd/arch/story/specify/plan/gaps/tasks/implement/post_impl锛夊璁￠€氳繃鍚庨渶瑙﹀彂璇勫垎瑙ｆ瀽涓庡啓鍏ワ紱
  鎴?speckit-workflow銆乥mad-story-assistant 鐨?stage 瀹屾垚姝ラ闇€璋冪敤鍏ㄩ摼璺€岃В鏋愬苟鍐欏叆銆嶉€昏緫锛?  鎴栫敤鎴锋樉寮忚姹傘€屽叏閾捐矾璇勫垎銆嶆椂銆?references:
  - auditor-spec: spec 闃舵瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-spec.md`
  - auditor-plan: plan 闃舵瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-plan.md`
  - auditor-tasks: tasks 闃舵瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-tasks.md`
  - auditor-implement: implement 闃舵瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-implement.md`
  - auditor-bugfix: bugfix 闃舵瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-bugfix.md`
  - auditor-document: document 闃舵瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-document.md`
  - audit-prompts: 鍚?stage 瀹¤鎻愮ず璇嶏紱`.codex/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-prd: PRD 瀹¤鎻愮ず璇嶏紱`.codex/skills/speckit-workflow/references/audit-prompts-prd.md`
  - audit-prompts-arch: 鏋舵瀯瀹¤鎻愮ず璇嶏紱`.codex/skills/speckit-workflow/references/audit-prompts-arch.md`
  - audit-prompts-code: 浠ｇ爜瀹¤鎻愮ず璇嶏紱`.codex/skills/speckit-workflow/references/audit-prompts-code.md`
  - audit-prompts-pr: PR 瀹¤鎻愮ず璇嶏紱`.codex/skills/speckit-workflow/references/audit-prompts-pr.md`
  - code-reviewer-config: 澶氭ā寮忛厤缃紙prd/arch/code/pr锛夛紱`_bmad/_config/code-reviewer-config.yaml`
  - scoring/rules: 瑙ｆ瀽瑙勫垯銆乮tem_id銆乿eto_items锛沗scoring/rules/*.yaml`
  - runAuditorHost / 缁熶竴 auditor host runner锛氭壙鎺ュ璁℃姤鍛婂悗鐨勮瘎鍒嗗啓鍏ャ€乤uditIndex 鏇存柊涓庣粺涓€ post-audit automation
---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?
# Claude Adapter: bmad-code-reviewer-lifecycle

## Purpose

鏈?skill 鏄?Cursor `bmad-code-reviewer-lifecycle` 鍦?Codex CLI / OMC 鐜涓嬬殑缁熶竴閫傞厤鍏ュ彛銆?
鐩爣涓嶆槸绠€鍗曞鍒?Cursor skill锛岃€屾槸锛?
1. **缁ф壙 Cursor 宸查獙璇佺殑鍏ㄩ摼璺璁＄紪鎺掕涔?*锛堝悇 stage 瀹¤瑙﹀彂 鈫?瀹¤鎵ц 鈫?鎶ュ憡鐢熸垚 鈫?璇勫垎鍐欏叆锛?2. **鍦?Codex no-hooks 杩愯鏃朵腑灏嗗璁℃墽琛屼綋鏄犲皠鍒?`.codex/agents/auditor-*` 绯诲垪**
3. **鎺ュ叆浠撳簱涓凡寮€鍙戝畬鎴愮殑璇勫垎鍐欏叆銆佺姸鎬佹満銆乭andoff 鏈哄埗**
4. **纭繚鍦?Codex CLI 涓兘瀹屾暣銆佽繛缁€佹纭湴鎵ц鍚?stage 瀹¤闂幆涓?scoring 鍐欏叆**

---

## 鏍稿績楠屾敹鏍囧噯

Claude 鐗?`bmad-code-reviewer-lifecycle` 蹇呴』婊¤冻锛?
- 鑳戒綔涓?Codex CLI 鐨?*鍏ㄩ摼璺璁＄紪鎺掑叆鍙?*锛岀粺涓€绠＄悊鍚?stage 鐨勫璁♀啋瑙ｆ瀽鈫掕瘎鍒嗗啓鍏ラ棴鐜?- 鍚?stage 鐨勫璁℃墽琛屽櫒閫夋嫨銆乫allback銆佽瘎鍒嗗啓鍏ュ潎涓?Cursor 宸查獙璇佹祦绋嬭涔変竴鑷?- 瀹屾暣鎺ュ叆鏈粨鏂板鐨勶細
  - 澶?auditor agent锛坅uditor-spec銆乤uditor-plan銆乤uditor-tasks銆乤uditor-implement銆乤uditor-bugfix銆乤uditor-document锛?- 缁熶竴 auditor host runner锛坄runAuditorHost`锛?  - handoff 鍗忚
- 涓嶅緱灏?Codex Canonical Base銆丆laude Runtime Adapter銆丷epo Add-ons 娣峰啓涓烘潵婧愪笉鏄庣殑閲嶅啓鐗?prompt

## 涓?Agent 缂栨帓闈紙寮哄埗锛?
浜や簰妯″紡涓嬶紝鏈?skill 涓嶆槸鐙珛鐨勫叏灞€缂栨帓鑰咃紱鍏ㄥ眬鎺ㄨ繘蹇呴』鐢?repo-native `main-agent-orchestration` 鍐冲畾銆俙runAuditorHost` 鍙礋璐ｅ璁″悗鐨?host close-out锛屼笉鑳芥浛浠ｄ富 Agent 鐨勪笅涓€姝ュ垎鏀喅绛栥€?
鍦ㄥ彂璧蜂换浣?auditor銆佹暣鏀瑰瓙浠诲姟鎴栧叾浠?bounded execution 鍓嶏紝涓?Agent 蹇呴』锛?
1. 鎵ц `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. 璇诲彇 `orchestrationState`銆乣pendingPacketStatus`銆乣pendingPacket`銆乣continueDecision`銆乣mainAgentNextAction`銆乣mainAgentReady`
3. 鑻ヤ笅涓€鍒嗘敮鍙淳鍙戜絾灏氭棤鍙敤 packet锛屾墽琛?`npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. 浠呬緷鎹繑鍥炵殑 packet / instruction 娲惧彂 bounded execution锛屼笉寰楀彧鍑璁?prose銆佽瘎鍒嗙粨璁烘垨 handoff 鎽樿鐩存帴鎺ㄨ繘
5. 姣忔瀛愪唬鐞嗚繑鍥炲悗锛屼互鍙婃瘡娆?`runAuditorHost` 鏀跺彛鍚庯紝閮藉啀娆?`inspect`锛屽啀鍐冲畾涓嬩竴鍏ㄥ眬鍒嗘敮

`mainAgentNextAction / mainAgentReady` 浠呬负 compatibility summary锛涚湡姝ｆ潈濞佺姸鎬佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
---

## Codex Canonical Base

浠ヤ笅鍐呭缁ф壙鑷?Cursor `bmad-code-reviewer-lifecycle`锛屽睘浜庝笟鍔¤涔夊熀绾匡紝Claude 鐗堜笉寰楁搮鑷噸鍐欏叾鎰忓浘锛?
### 寮曠敤鍏崇郴锛圓rchitecture 搂2.2銆伮?0.2锛?
| 寮曠敤缁勪欢 | 鑱岃矗 | 寮曠敤鏂瑰紡锛圕laude 閫傞厤鐗堬級 |
|----------|------|--------------------------|
| auditor-* | 鎵ц鍚?stage 瀹¤ | 涓?Agent 閫氳繃 Agent tool锛坄subagent_type: general-purpose`锛夎皟搴?`.codex/agents/auditors/auditor-*.md` |
| audit-prompts | 鍚?stage 瀹¤鎻愮ず璇?| `.codex/skills/speckit-workflow/references/audit-prompts*.md` |
| code-reviewer-config | 澶氭ā寮忛厤缃紙prd/arch/code/pr锛?| 鎸?mode 璇诲彇 dimensions銆乸ass_criteria |
| scoring/rules | 瑙ｆ瀽瑙勫垯銆乮tem_id銆乿eto_items | 鐢ㄤ簬瑙ｆ瀽瀹¤浜у嚭骞舵槧灏勭幆鑺傚緱鍒?|

### 寮曠敤璺緞

- **auditor 鎵ц浣?*: `.codex/agents/auditors/auditor-spec.md`銆乣auditor-plan.md`銆乣auditor-gaps.md`銆乣auditor-tasks.md`銆乣auditor-implement.md`銆乣auditor-bugfix.md`銆乣auditor-document.md`
- **瀹¤鎻愮ず璇?*: `.codex/skills/speckit-workflow/references/audit-prompts.md`銆乣audit-prompts-prd.md`銆乣audit-prompts-arch.md`銆乣audit-prompts-code.md`銆乣audit-prompts-pr.md`
- **閰嶇疆**: `_bmad/_config/code-reviewer-config.yaml`銆乣_bmad/_config/stage-mapping.yaml`銆乣_bmad/_config/eval-lifecycle-report-paths.yaml`
- **璇勫垎瑙勫垯**: `scoring/rules/`锛堝惈 `default/`銆乣gaps-scoring.yaml`銆乣iteration-tier.yaml`锛?- **鑷韩璺緞**: `.codex/skills/bmad-code-reviewer-lifecycle/SKILL.md`

### Stage 鏄犲皠涓庤Е鍙?
璇﹁ `_bmad/_config/stage-mapping.yaml`銆傚悇 stage 鍒?auditor 鎵ц浣撶殑鏄犲皠濡備笅锛?
| stage | layer | auditor 鎵ц浣?| prompt_template |
|-------|-------|----------------|-----------------|
| `story` | layer_3 | 鐢?bmad-story-assistant 绠＄悊 | `audit-prompts.md` |
| `specify` | layer_4 | `auditor-spec` | `audit-prompts.md 搂1` |
| `plan` | layer_4 | `auditor-plan` | `audit-prompts.md 搂2` |
| `gaps` | layer_4 | `auditor-gaps` | `audit-prompts.md 搂3` |
| `tasks` | layer_4 | `auditor-tasks` | `audit-prompts.md 搂4` |
| `implement` | layer_4 | `auditor-implement` | `audit-prompts.md 搂5` |
| `post_impl` | layer_5 | `auditor-implement` | `audit-prompts.md 搂5` |
| `pr_review` | layer_5 | 涓?Agent 鎴?Codex reviewer | `audit-prompts-pr.md` |
| `bugfix` | 鈥?| `auditor-bugfix` | `audit-prompts.md 搂5` |
| `document` | 鈥?| `auditor-document` | `audit-prompts.md 搂4 / TASKS-doc` |

### Stage Scoring Phases

| stage | scoring phases | report path source |
|-------|---------------|-------------------|
| `story` | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `specify` | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `plan` | `[1,2]` | `eval-lifecycle-report-paths.yaml` |
| `gaps` | `[1,2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `tasks` | `[2,3,4,5]` | `eval-lifecycle-report-paths.yaml` |
| `implement` | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `post_impl` | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `pr_review` | `[6]` | `eval-lifecycle-report-paths.yaml` |

### 鎶ュ憡璺緞绾﹀畾

璇﹁ `_bmad/_config/eval-lifecycle-report-paths.yaml`銆?
### Mode Mapping

| mode | 鏉ユ簮閰嶇疆 | 鐢ㄩ€?| prompt_template |
|------|---------|------|-----------------|
| `code` | `code-reviewer-config.yaml` | 浠ｇ爜瀹¤ | `audit-prompts-code.md` |
| `prd` | `code-reviewer-config.yaml` | PRD 瀹¤ | `audit-prompts-prd.md` |
| `arch` | `code-reviewer-config.yaml` | 鏋舵瀯瀹¤ | `audit-prompts-arch.md` |
| `pr` | `code-reviewer-config.yaml` | PR 瀹¤ | `audit-prompts-pr.md` |

### Trigger Mapping

| event | trigger | scope |
|-------|---------|-------|
| `stage_audit_complete` | auto | 褰撳墠 stage 瀵瑰簲璇勫垎鐜妭 |
| `story_status_change` | auto | 鐜妭 1鈥? |
| `mr_created` | auto | 鐜妭 2鈥? |
| `epic_pending_acceptance` | manual_or_auto | 鐜妭 6 / Epic 缁煎悎 |
| `user_explicit_request` | manual | 鍏ㄧ幆鑺?|

---

## Codex no-hooks Runtime Adapter

### Primary Executor

鍚?stage 瀹¤閫氳繃 **Agent tool**锛坄subagent_type: general-purpose`锛夎皟搴﹀搴旂殑 `.codex/agents/auditors/auditor-*.md` 鎵ц浣撱€備富 Agent 灏?auditor agent 鐨勫畬鏁?markdown 鍐呭鏁存浼犲叆浣滀负 prompt銆?
### Fallback Strategy

4 灞?Fallback 閾撅紙鎸変紭鍏堢骇闄嶅簭锛夛細

1. **`.codex/agents/auditors/auditor-*`**锛氬搴?stage 鐨勪笓鐢ㄥ璁℃墽琛屼綋锛圥rimary锛?2. **Codex reviewer**锛坄Codex-native reviewer` code-reviewer subagent_type锛?3. **code-review skill**锛堥€氱敤 code-review 鎶€鑳斤紝鎸?audit-prompts 瀵瑰簲绔犺妭鎵ц锛?4. **涓?Agent 鐩存帴鎵ц**锛氫富 Agent 璇诲彇 audit-prompts 瀵瑰簲绔犺妭锛屾寜瀹¤娓呭崟閫愰」妫€鏌ュ苟杈撳嚭瀹¤鎶ュ憡

**Fallback 闄嶇骇閫氱煡锛團R26锛?*锛氬綋 Fallback 瑙﹀彂鏃讹紝椤诲悜鐢ㄦ埛鏄剧ず褰撳墠浣跨敤鐨勬墽琛屼綋灞傜骇銆傛牸寮忥細

```
鈿狅笍 Fallback 闄嶇骇閫氱煡锛氬綋鍓嶅璁′娇鐢ㄦ墽琛屼綋灞傜骇 {N}锛坽鎵ц浣撳悕绉皚锛夛紝鍘熷洜锛歿灞傜骇 N-1 涓嶅彲鐢ㄥ師鍥爙
```

绀轰緥锛?- `鈿狅笍 Fallback 闄嶇骇閫氱煡锛氬綋鍓嶅璁′娇鐢ㄦ墽琛屼綋灞傜骇 2锛圕odex reviewer锛夛紝鍘熷洜锛歛uditor-spec 涓嶅瓨鍦ㄦ垨涓嶅彲鐢╜
- `鈿狅笍 Fallback 闄嶇骇閫氱煡锛氬綋鍓嶅璁′娇鐢ㄦ墽琛屼綋灞傜骇 4锛堜富 Agent 鐩存帴鎵ц锛夛紝鍘熷洜锛氬墠涓夊眰鎵ц浣撳潎涓嶅彲鐢╜

### Runtime Contracts

- 蹇呰锛歚.codex/protocols/audit-result-schema.md`
- 蹇呰锛歚.codex/state/bmad-progress.yaml`
- 鏄惧紡寮曠敤锛歚code-reviewer-config.yaml`
- 鏄惧紡寮曠敤锛歚stage-mapping.yaml`
- 鏄惧紡寮曠敤锛歚eval-lifecycle-report-paths.yaml`
- 鏄惧紡寮曠敤锛歚runAuditorHost`
- 杩斿洖蹇呴』鍖呭惈锛歚execution_summary`銆乣artifacts`銆乣handoff`
- 蹇呴』鏄庣‘ mode 鈫?auditor / stage 鈫?scoring / stage 鈫?reportPath / event 鈫?trigger 鐨勬槧灏勫叧绯?
### CLI Calling Summary锛圓rchitecture Pattern 2锛?
姣忔璋冪敤瀹¤瀛愪唬鐞嗗墠锛屼富 Agent **蹇呴』**杈撳嚭濡備笅缁撴瀯鍖栨憳瑕侊細

```yaml
# CLI Calling Summary
Input: {stage}={褰撳墠闃舵}, mode={瀹¤妯″紡}, reportPath={鎶ュ憡璺緞}
Template: {浣跨敤鐨?auditor agent 鏂囦欢璺緞}
Output: {棰勬湡浜у嚭鈥斺€斿璁℃姤鍛婅矾寰剗
Fallback: {褰撳墠浣跨敤鐨勬墽琛屼綋灞傜骇鍙婇檷绾ф柟妗坿
Acceptance: {楠屾敹鏍囧噯鈥斺€旀姤鍛婄粨璁轰负"瀹屽叏瑕嗙洊銆侀獙璇侀€氳繃"}
```

### YAML Handoff锛圓rchitecture Pattern 4锛?
姣忎釜 stage 瀹¤缁撴潫鍚庯紝涓?Agent **蹇呴』**杈撳嚭濡備笅 handoff 缁撴瀯锛?
```yaml
execution_summary:
  status: passed|failed
  stage: {褰撳墠 stage}
  mode: {瀹¤妯″紡}
  iteration_count: {绱杞}
artifacts:
  reportPath: {瀹¤鎶ュ憡璺緞}
  artifactDocPath: {琚鏂囨。璺緞}
next_steps:
  - {涓嬩竴姝ユ搷浣滄弿杩皚
handoff:
  next_action: scoring_trigger|iterate_audit|proceed_to_next_stage
  next_agent: bmad-master|auditor-{stage}|runAuditorHost
  ready: true|false
  mainAgentNextAction: dispatch_review|dispatch_remediation|dispatch_implement
  mainAgentReady: true|false
```

---

## Repo Add-ons

### Lifecycle Phases

瀹屾暣瀹¤鐢熷懡鍛ㄦ湡鍖呭惈浠ヤ笅 6 涓樁娈碉紝姣忎釜 stage 瀹¤鍧囬』渚濇缁忓巻锛?
1. **Pre-Audit**锛氳鍙栭厤缃紙`code-reviewer-config.yaml`銆乣stage-mapping.yaml`銆乣eval-lifecycle-report-paths.yaml`锛夛紝纭畾 mode銆乤uditor 鎵ц浣撱€佹姤鍛婅矾寰勩€乻coring phases
2. **Audit Execution**锛氶€氳繃 Primary Executor锛堟垨 Fallback锛夎皟搴?auditor 鎵ц浣擄紝浼犲叆瀵瑰簲 stage 鐨?audit-prompts 绔犺妭浣滀负瀹¤鏍囧噯
3. **Report Generation**锛氬璁℃墽琛屼綋浜у嚭瀹¤鎶ュ憡骞朵繚瀛樿嚦绾﹀畾璺緞锛涙姤鍛婇』鍚彲瑙ｆ瀽璇勫垎鍧楋紙銆屾€讳綋璇勭骇: [A|B|C|D]銆嶄笌銆岀淮搴﹁瘎鍒? 缁村害鍚? XX/100銆嶏級
4. **Host Trigger**锛氬璁￠€氳繃鍚庯紝缁熶竴璋冪敤 `runAuditorHost` 鎵挎帴璇勫垎鍐欏叆銆乤uditIndex 鏇存柊涓?post-audit automation
5. **Iteration Tracking**锛氳拷韪璁¤疆娆★紙iteration_count锛夛紝fail 杞』淇濆瓨鎶ュ憡骞惰褰?iterationReportPaths
6. **Convergence Check**锛氭寜 strictness 妫€鏌ユ敹鏁涙潯浠垛€斺€攕tandard 涓哄崟娆￠€氳繃锛泂trict 涓鸿繛缁?3 杞棤 gap + 鎵瑰垽瀹¤鍛?>50%

### 缁熶竴 auditor host runner 鍓嶇疆鏉′欢锛圕hecklist锛?
鍚?stage 瀹¤閫氳繃鍚庛€佽皟鐢ㄧ粺涓€ auditor host runner 鍓嶏紝**蹇呴』**纭锛?
1. **鎶ュ憡鍖呭惈鍙В鏋愬潡**锛氭姤鍛婄粨灏鹃』鍚€屾€讳綋璇勭骇: [A|B|C|D]銆嶄笌銆岀淮搴﹁瘎鍒? 缁村害鍚? XX/100銆嶅潡锛屽惁鍒欒В鏋愬け璐ャ€佷华琛ㄧ洏涓嶆樉绀鸿瘎绾?2. **閫愭潯瀵圭収鏍煎紡**锛氳嫢鎶ュ憡涓洪€愭潯瀵圭収鏍煎紡锛堣〃鏍?缁撹锛夛紝椤诲湪缁撹鍚庤拷鍔犱笂杩板彲瑙ｆ瀽鍧?3. **璺緞**锛氬彲浣跨敤 `--reportPath` 鎸囧畾浠绘剰鎶ュ憡璺緞锛涚害瀹氳矾寰勪负 `AUDIT_{stage}-E{epic}-S{story}.md`
4. **鍙傛暟瀹屽**锛歚stage` / `triggerStage` / `artifactDocPath` / `iterationCount` 宸插噯澶囧畬姣?
### 缁熶竴 auditor host runner 璋冪敤绾︽潫

缁熶竴 auditor host runner锛坄runAuditorHost`锛夎礋璐ｆ壙鎺ワ細
- 璇勫垎鍐欏叆锛堝師 `bmad-speckit score`锛?- auditIndex 鏇存柊
- 缁熶竴 post-audit automation

**iteration_count 浼犻€掞紙寮哄埗锛?*锛氭墽琛屽璁″惊鐜殑 Agent 鍦?pass 鏃朵紶鍏ュ綋鍓嶇疮璁″€硷紙鏈?stage 瀹¤鏈€氳繃/fail 鐨勮疆鏁帮級锛涗竴娆￠€氳繃浼?0锛涜繛缁?3 杞棤 gap 鐨勯獙璇佽疆涓嶈鍏?iteration_count銆?
### Execution Flow

1. Read `.codex/protocols/audit-result-schema.md`
2. Read `.codex/state/bmad-progress.yaml`
3. 璇诲彇 `code-reviewer-config.yaml`
4. 璇诲彇 `stage-mapping.yaml`
5. 璇诲彇 `eval-lifecycle-report-paths.yaml`
6. 鏍规嵁 stage 瑙ｆ瀽 mode / scoring / reportPath / trigger
7. 杈撳嚭 **CLI Calling Summary**
8. 璋冨害 auditor 鎵ц浣擄紙Primary 鈫?Fallback锛?9. 瀹¤鎵ц浣撹鍙栧疄鐜颁骇鐗╁苟鎵ц瀹℃煡妫€鏌ユ竻鍗?10. 瀹¤鎵ц浣撲骇鍑烘姤鍛?11. 鏍￠獙缁熶竴 auditor host runner 鍓嶇疆鏉′欢
12. 瑙﹀彂缁熶竴 auditor host runner
13. 杈撳嚭 **YAML Handoff**
14. 鏇存柊瀹¤鐘舵€?
### Output / Handoff

```yaml
execution_summary:
  status: passed|failed
  stage: review_passed
  mode: code|prd|arch|pr
artifacts:
  review: reviews/.../review.md
  reportPath: reports/.../audit.md
handoff:
  next_action: scoring_trigger|return_to_auditor
  next_agent: bmad-master|auditor-implement
  ready: true|false
  mainAgentNextAction: dispatch_review
  mainAgentReady: true|false
```

### State Updates

```yaml
layer: review
stage: review_passed
review_round: number
review_verdict: pass | fail
artifacts:
  review: reviews/.../review.md
```

### Constraints

- **绂佹鑷 commit**
- 蹇呴』閫氳繃 implement 闃舵瀹¤锛堥噰鐢?Codex Canonical Base / Codex no-hooks Runtime Adapter / Repo Add-ons 涓夊眰缁撴瀯锛?
---

## 涓庡叾浠?Skill 鐨勫崗鍚?
### speckit-workflow 鍗忓悓

`speckit-workflow` 鍚勯樁娈碉紙搂1.2 spec銆伮?.2 plan銆伮?.2 gaps銆伮?.2 tasks銆伮?.2 implement锛夊璁￠棴鐜腑锛?1. 璋冪敤鏈?skill 纭畾褰撳墠 stage 鐨?auditor 鎵ц浣撳拰 mode
2. 鏈?skill 閫氳繃 Primary Executor / Fallback 閾捐皟搴﹀璁?3. 瀹¤閫氳繃鍚庯紝鏈?skill 缁熶竴瑙﹀彂 `runAuditorHost`
4. 杈撳嚭 YAML Handoff 渚?speckit-workflow 鍐冲畾涓嬩竴姝ユ搷浣?
### bmad-story-assistant 鍗忓悓

`bmad-story-assistant` 鍦?Dev Story 闃舵瑙﹀彂 speckit-workflow锛岄棿鎺ラ€氳繃鏈?skill 瀹屾垚瀹¤缂栨帓銆?
---

## Use Cases

- speckit 鍚勯樁娈靛璁￠棴鐜殑缁熶竴瀹¤缂栨帓涓庤瘎鍒嗗啓鍏?- 瀹炴柦鍚庣殑浠ｇ爜瀹℃煡锛坧ost_impl锛?- PR 鍓嶇殑鏈€缁堟鏌ワ紙pr_review锛?- 浠ｇ爜璐ㄩ噺闂ㄦ帶
- BUGFIX 鏂囨。瀹¤锛坆ugfix锛?- TASKS 鏂囨。瀹¤锛坉ocument锛?
<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
