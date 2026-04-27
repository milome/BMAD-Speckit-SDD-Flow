---
name: bmad-standalone-tasks-doc-review
description: |
  Codex CLI / OMC 鐗?BMAD Standalone Tasks 鏂囨。瀹¤閫傞厤鍏ュ彛銆?  浠?Cursor bmad-standalone-tasks-doc-review 涓鸿涔夊熀绾匡紝鎸夈€孴ASKS 鏂囨。涓ユ牸瀹¤銆嶆墽琛岃川閲忛棬鎺с€?  鎵瑰垽瀹¤鍛?>70%锛岃繛缁?3 杞棤 gap 鏀舵暃锛屽璁″瓙浠ｇ悊鍦ㄥ彂鐜?gap 鏃剁洿鎺ヤ慨鏀硅瀹℃枃妗ｃ€?  涓?Agent 鍙戣捣瀹¤瀛愪换鍔℃椂**蹇呴』**灏嗘湰 skill 鍐呯殑銆屽畬鏁?prompt 妯℃澘銆嶆暣娈靛鍒跺苟濉叆鍗犱綅绗﹀悗浼犲叆锛岀姝㈢渷鐣ャ€佹鎷垨鑷鏀瑰啓鎻愮ず璇嶃€?  瀹¤浼樺厛 `.codex/agents/auditors/auditor-tasks-doc`锛屾寜 Fallback 閾鹃檷绾с€?  閫傜敤鍦烘櫙锛氱敤鎴疯姹?TASKS 鏂囨。瀹¤銆?瀵?{鏂囨。璺緞} 鍙戣捣瀹¤瀛愪换鍔?銆乀ASKS 鏂囨。瀹炴柦鍓嶈川閲忛棬鎺с€傚叏绋嬩腑鏂囥€?when_to_use: |
  Use when: (1) 鐢ㄦ埛璇锋眰瀵?TASKS 鏂囨。鍙戣捣涓ユ牸瀹¤, (2) "瀵?{鏂囨。璺緞} 鍙戣捣瀹¤瀛愪换鍔? or "TASKS 鏂囨。瀹¤", (3) TASKS 鏂囨。瀹炴柦鍓嶈川閲忛棬鎺с€?references:
  - auditor-tasks-doc: TASKS 鏂囨。瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-tasks-doc.md`
  - auditor-document: 鏂囨。瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-document.md`
  - audit-document-iteration-rules: 鏂囨。瀹¤杩唬瑙勫垯锛沗.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - audit-prompts: 涓诲璁℃彁绀鸿瘝浣撶郴锛沗.codex/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-critical-auditor-appendix: 鎵瑰垽瀹¤鍛橀檮褰曪紱`.codex/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
  - audit-post-impl-rules: 瀹炴柦鍚庡璁¤鍒欙紱`.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - prompt-template-tasks-doc: `.codex/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md`
  - prompt-template-impl: `.codex/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-impl.md`
---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?
> **Orphan TASKS doc-review closeout contract**锛氬綋琚鏂囨。浣嶄簬 `_orphan/` 璺緞鏃讹紝缁撴瀯鍖栧璁℃姤鍛婂繀椤绘樉寮忔彁渚?`stage=standalone_tasks`銆乣artifactDocPath`銆乣reportPath`銆傜己澶变换涓€瀛楁銆佷粛杩斿洖 `stage=document`銆佹垨浠呭啓 PASS 鏂囨湰鏃讹紝涓嶅緱瑙嗕负 authoritative closeout銆?
# Claude Adapter: bmad-standalone-tasks-doc-review

## Purpose

鏈?skill 鏄?Cursor `bmad-standalone-tasks-doc-review` 鍦?Codex CLI / OMC 鐜涓嬬殑缁熶竴閫傞厤鍏ュ彛銆?
鐩爣涓嶆槸绠€鍗曞鍒?Cursor skill锛岃€屾槸锛?
1. **缁ф壙 Cursor 宸查獙璇佺殑 TASKS 鏂囨。瀹¤璇箟**锛堣В鏋愭枃妗ｈ矾寰?鈫?纭畾闇€姹備緷鎹?鈫?瀛愪唬鐞嗗璁?鈫?鏀舵暃妫€鏌?鈫?杩唬鑷抽€氳繃锛?2. **鍦?Codex no-hooks 杩愯鏃朵腑灏嗘墽琛屼綋鏄犲皠鍒?`.codex/agents/` 绯诲垪**锛堝璁?鈫?`auditor-tasks-doc`銆乣auditor-document`锛?3. **鎺ュ叆浠撳簱涓凡寮€鍙戝畬鎴愮殑 handoff銆乻coring銆乧ommit gate 鏈哄埗**
4. **纭繚鍦?Codex CLI 涓兘瀹屾暣銆佽繛缁€佹纭湴鎵ц TASKS 鏂囨。瀹¤娴佺▼**

## Host Guard锛堝繀椤诲厛鎵ц锛?
鑻ュ綋鍓嶅疄闄呭涓绘槸 **Cursor IDE**锛屾垨璋冪敤涓婁笅鏂囨槑鏄句娇鐢?Cursor 璇箟锛堜緥濡?`Codex worker adapter`銆乣general-purpose`銆乣Codex worker dispatch`锛夛紝鍒欙細

1. **绔嬪嵆鍋滄**鏈?Codex adapter 鐨勫悗缁墽琛?2. 杈撳嚭浠ヤ笅鍥哄畾鎻愮ず锛?
```text
HOST_MISMATCH: 褰撳墠璇姞杞戒簡 Claude 鐗?bmad-standalone-tasks-doc-review锛屼絾瀹為檯瀹夸富鏄?Cursor銆傝鏀圭敤 ``.codex`/skills/bmad-standalone-tasks-doc-review/SKILL.md`銆?```

3. **绂佹**缁х画鎵ц鏈?Codex adapter 鐨?Fallback 闄嶇骇閫昏緫

鍙湁鍦?**Codex CLI / OMC** 瀹夸富涓紝鎵嶅厑璁哥户缁墽琛屾湰鏂囦欢鍚庣画鍐呭銆?
---

## 鏍稿績楠屾敹鏍囧噯

Claude 鐗?`bmad-standalone-tasks-doc-review` 蹇呴』婊¤冻锛?
- 鑳戒綔涓?Codex CLI 鐨?**TASKS 鏂囨。瀹¤鍏ュ彛**锛岀粺涓€绠＄悊瑙ｆ瀽鈫掑璁♀啋鏀舵暃闂幆
- 鍚勯樁娈电殑鎵ц鍣ㄩ€夋嫨銆乫allback銆佽瘎鍒嗗啓鍏ュ潎涓?Cursor 宸查獙璇佹祦绋嬭涔変竴鑷?- 瀹屾暣鎺ュ叆鏈粨鏂板鐨勶細
  - auditor-tasks-doc 鎵ц浣?  - 缁熶竴 auditor host runner锛坄runAuditorHost`锛?  - handoff 鍗忚
- 涓嶅緱灏?Codex Canonical Base銆丆laude Runtime Adapter銆丷epo Add-ons 娣峰啓涓烘潵婧愪笉鏄庣殑閲嶅啓鐗?prompt

## 涓?Agent 缂栨帓闈紙寮哄埗锛?
浜や簰妯″紡涓嬶紝鏈?skill 鐨勫叏灞€鎺ㄨ繘蹇呴』鐢?repo-native `main-agent-orchestration` 鍐冲畾銆俙runAuditorHost` 鍙礋璐ｅ璁″悗鐨?host close-out锛屼笉鑳芥浛浠ｄ富 Agent 鐨勪笅涓€姝ュ垎鏀喅绛栥€?
鍦ㄥ彂璧?TASKS 鏂囨。瀹¤瀛愪换鍔°€佷慨澶嶅瓙浠诲姟鎴栦换浣?bounded execution 鍓嶏紝涓?Agent 蹇呴』锛?
1. 鎵ц `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. 璇诲彇 `orchestrationState`銆乣pendingPacketStatus`銆乣pendingPacket`銆乣continueDecision`銆乣mainAgentNextAction`銆乣mainAgentReady`
3. 鑻ヤ笅涓€鍒嗘敮鍙淳鍙戜絾灏氭棤鍙敤 packet锛屾墽琛?`npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. 浠呬緷鎹繑鍥炵殑 packet / instruction 娲惧彂瀛愪唬鐞嗭紝涓嶅緱鍙嚟瀹¤ prose 鎴?doc-review 缁撹鐩存帴缁窇
5. 姣忔瀛愪唬鐞嗚繑鍥炲悗锛屼互鍙婃瘡娆?`runAuditorHost` 鏀跺彛鍚庯紝閮藉啀娆?`inspect`锛屽啀鍐冲畾涓嬩竴鍏ㄥ眬鍒嗘敮

`mainAgentNextAction / mainAgentReady` 浠呬负 compatibility summary锛涚湡姝ｆ潈濞佺姸鎬佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
---

## 涓夊眰鏋舵瀯

### Layer 1: Codex Canonical Base

> 缁ф壙 Cursor `bmad-standalone-tasks-doc-review` 鍏ㄩ儴宸查獙璇佽涔?
#### 閫傜敤鍦烘櫙

- 鐢ㄦ埛鎸囧畾鏂囨。璺緞骞惰姹傚彂璧峰璁″瓙浠诲姟
- TASKS 鏂囨。瀹炴柦鍓嶇殑璐ㄩ噺闂ㄦ帶
- 闇€銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶄笖 3 杞棤 gap 鏀舵暃鐨勬枃妗ｅ璁?
#### 寮哄埗绾︽潫

| 绾︽潫 | 璇存槑 |
|------|------|
| 鎵瑰垽瀹¤鍛?| 蹇呴』鍑哄満锛屽彂瑷€鍗犳瘮 **>70%** |
| 鏀舵暃鏉′欢 | **杩炵画 3 杞棤 gap**锛堥拡瀵硅瀹℃枃妗ｏ級 |
| 鍙戠幇 gap 鏃?| **瀹¤瀛愪唬鐞嗛』鍦ㄦ湰杞唴鐩存帴淇敼琚鏂囨。**锛岀姝粎杈撳嚭寤鸿 |
| 鏈€澶ц疆娆?| **10 杞?*锛岃秴杩囧垯寮哄埗缁撴潫骞惰緭鍑恒€屽凡杈炬渶澶ц疆娆★紝璇蜂汉宸ユ鏌ャ€?|

#### 宸ヤ綔娴?
1. **瑙ｆ瀽鏂囨。璺緞**锛氫粠鐢ㄦ埛杈撳叆鑾峰彇 `{鏂囨。璺緞}`锛堝 `_bmad-output/implementation-artifacts/_orphan/TASKS_xxx.md`锛?2. **纭畾闇€姹備緷鎹?*锛氳嫢 TASKS 鏂囨。澶撮儴鏈夈€屽弬鑰冦€嶅瓧娈碉紝璇诲彇璇ユ枃妗ｄ綔涓洪渶姹備緷鎹紱鍚﹀垯浠?TASKS 鑷韩涓鸿嚜娲戒緷鎹紙姝ゆ椂 `{闇€姹備緷鎹矾寰剗` 濉瀹℃枃妗ｈ矾寰勶級
3. **鍙戣捣瀹¤**锛氬皢 [references/audit-prompt-tasks-doc.md](references/audit-prompt-tasks-doc.md) 瀹屾暣 prompt 澶嶅埗锛屾浛鎹?`{鏂囨。璺緞}`銆乣{闇€姹備緷鎹矾寰剗`銆乣{椤圭洰鏍箎`銆乣{鎶ュ憡璺緞}`銆乣{杞}`锛?*鎶ュ憡淇濆瓨閮ㄥ垎椤讳负銆屾瘡杞姤鍛婏紙鏃犺閫氳繃涓庡惁锛夊潎椤讳繚瀛樿嚦 {鎶ュ憡璺緞}銆?*
4. **瀛愪唬鐞嗛€夋嫨**锛氭寜 Fallback Strategy 鎵ц锛堣 Layer 2锛?5. **鏀舵暃妫€鏌?*锛氭敹鍒版姤鍛婂悗锛岃嫢缁撹銆岄€氳繃銆嶄笖鎵瑰垽瀹¤鍛樻敞鏄庛€屾湰杞棤鏂?gap銆嶁啋 `consecutive_pass_count + 1`锛涜嫢銆屾湭閫氳繃銆嶆垨瀛樺湪 gap 鈫?缃?0銆?*閫氳繃鍒ゅ畾**锛氭姤鍛婄粨璁哄惈銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆垨銆岄€氳繃銆嶏紱鎵瑰垽瀹¤鍛樻钀藉惈銆屾湰杞棤鏂?gap銆嶃€屾棤鏂?gap銆嶆垨銆屾棤 gap銆嶃€?6. **杩唬**锛氭湭杈?3 杞棤 gap 鏃讹紝鍙戣捣涓嬩竴杞璁°€?*绂佹姝诲惊鐜?*锛歚consecutive_pass_count >= 3` 鏃?*绔嬪嵆缁撴潫**锛屼笉鍐嶅彂璧峰璁°€?7. **鎶ュ憡钀界洏**锛氭瘡杞姤鍛婏紙鏃犺閫氳繃涓庡惁锛夊潎椤讳繚瀛樿嚦 `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_{slug}_搂4_round{N}.md`锛涗富 Agent 鍙戣捣瀹¤鏃堕』鍦?prompt 涓槑纭瑕佹眰銆?
#### 鍙В鏋愯瘎鍒嗗潡锛堝己鍒讹級

涓绘祦绋嬶紙TASKS 鏂囨。瀹¤锛夋姤鍛婄粨灏鹃』鍚細

```markdown
## 鍙В鏋愯瘎鍒嗗潡锛堜緵 parseAndWriteScore锛?鎬讳綋璇勭骇: [A|B|C|D]
缁村害璇勫垎:
- 闇€姹傚畬鏁存€? XX/100
- 鍙祴璇曟€? XX/100
- 涓€鑷存€? XX/100
- 鍙拷婧€? XX/100
```

#### 妯″紡 B锛氬疄鏂藉悗瀹¤锛埪?锛?
褰撶敤鎴疯姹傚**瀹炴柦瀹屾垚鍚庣殑缁撴灉**锛堜唬鐮併€乸rd銆乸rogress锛夊璁℃椂锛屼娇鐢?audit-prompts 搂5銆傛鏃讹細
- 琚瀵硅薄涓轰唬鐮?瀹炵幇锛岄潪鏂囨。
- 鍙戠幇 gap 鏃剁敱**瀹炴柦瀛愪唬鐞?*淇敼浠ｇ爜锛岄潪瀹¤瀛愪唬鐞?- 鏀舵暃瑙勫垯瑙?`.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`

璇﹁ [references/audit-prompt-impl.md](references/audit-prompt-impl.md)銆?
---

### Layer 2: Codex no-hooks Runtime Adapter

> 灏?Cursor 鎵ц浣撴槧灏勫埌 Codex CLI 鍘熺敓鎵ц浣?
#### Primary Executor

| 闃舵 | 婧愬钩鍙板璁″櫒 | Claude 鎵ц浣?| Agent 瀹氫箟 |
|------|-------------|--------------|-----------|
| TASKS 鏂囨。瀹¤ | code-reviewer锛堝師骞冲彴 Task 璋冨害锛?| `auditor-tasks-doc` | `.codex/agents/auditors/auditor-tasks-doc.md` |
| 鏂囨。瀹¤锛圫tage 4锛?| code-reviewer锛堝師骞冲彴 Task 璋冨害锛?| `auditor-document` | `.codex/agents/auditors/auditor-document.md` |

璋冪敤鏂瑰紡锛氶€氳繃 Agent tool锛坄subagent_type: general-purpose`锛夎皟鐢ㄥ搴旀墽琛屼綋銆?
#### Fallback Strategy锛? 灞傞檷绾э級

褰?Primary Executor 涓嶅彲鐢ㄦ椂锛屾寜浠ヤ笅椤哄簭閫愮骇闄嶇骇锛?
| 灞傜骇 | 鎵ц鏂瑰紡 | 鏉′欢 |
|------|---------|------|
| L1 (Primary) | `.codex/agents/auditors/auditor-tasks-doc` 鎵ц浣?| 榛樿棣栭€?|
| L2 | `code-reviewer` Agent | auditor-tasks-doc 涓嶅彲鐢ㄦ椂 |
| L3 | `code-review` skill 鐩存帴璋冪敤 | Agent 鏈哄埗涓嶅彲鐢ㄦ椂 |
| L4 | 涓?Agent 鐩存帴鎵ц鍚屼竴浠戒笁灞傜粨鏋?prompt | 鎵€鏈夊瓙浠ｇ悊鍧囦笉鍙敤鏃?|

**Fallback 闄嶇骇閫氱煡锛團R26锛?*锛氭瘡娆¤Е鍙?Fallback 鏃讹紝蹇呴』鍦ㄦ帶鍒跺彴杈撳嚭闄嶇骇閫氱煡锛?
```
鈿狅笍 鎵ц浣撳眰绾ч檷绾? L{鍘熷眰绾 鈫?L{鐩爣灞傜骇}
  鍘熷洜: {涓嶅彲鐢ㄥ師鍥爙
  褰撳墠鎵ц浣? {瀹為檯浣跨敤鐨勬墽琛屼綋鍚嶇О}
```

#### CLI Calling Summary锛圓rchitecture D2锛?
姣忔璋冪敤瀹¤瀛愪唬鐞嗗墠锛屼富 Agent 蹇呴』杈撳嚭锛?
```yaml
--- CLI Calling Summary ---
subagent_type: general-purpose
target_agent: auditor-tasks-doc
phase: tasks_doc_audit
round: {N}
artifact_doc_path: {鏂囨。璺緞}
baseline_path: {闇€姹備緷鎹矾寰剗
report_path: {鎶ュ憡璺緞}
fallback_level: L{N}
---
```

#### YAML Handoff锛圓rchitecture D2/D4锛?
瀹¤瀹屾垚鍚庤緭鍑虹粨鏋勫寲浜ゆ帴锛?
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
  artifact_doc_path: "{鏂囨。璺緞}"
  report_path: "{鎶ュ憡璺緞}"
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

---

### Layer 3: Repo Add-ons

> 浠撳簱绾ф墿灞曪細鐘舵€佹満銆乭ooks銆乭andoff銆乻coring銆乧ommit gate

#### 鐘舵€佺鐞?
- `.codex/state/bmad-progress.yaml`锛欱MAD 鍏ㄥ眬杩涘害璺熻釜
- handoff 鍗忚锛氭瘡闃舵缁撴潫杈撳嚭缁撴瀯鍖?YAML

#### 瀹¤鍚庤嚜鍔ㄥ寲鏀跺彛

瀹¤閫氳繃鏃讹紝涓嶅啀鐢变富 Agent 鎴栧璁″瓙浠ｇ悊鎵嬪伐璋冪敤 `bmad-speckit score`銆傛墽琛屼綋鍙渶淇濊瘉 `projectRoot`銆乣reportPath`銆乣artifactDocPath` 涓変釜缁撴灉瀛楁瀹屾暣鍙敤锛屽悗缁瘎鍒嗗啓鍏ャ€乤uditIndex 鏇存柊涓庡叾瀹?post-audit automation 缁熶竴鐢?invoking host/runner 鎵挎帴銆?
#### Commit Gate

- PASS 浠呰〃绀烘枃妗ｅ璁￠€氳繃锛屽厑璁歌繘鍏?`bmad-standalone-tasks` 瀹炴柦闃舵
- 涓嶅厑璁哥洿鎺?commit
- 鏈€缁?commit 鐢?`bmad-master` 闂ㄦ帶

#### 绂佹璇嶆鏌?
瀹¤鎶ュ憡涓笉寰楀嚭鐜颁互涓嬪欢杩熻〃杩帮細銆屽彲閫夈€嶃€屽悗缁€嶃€屽緟瀹氥€嶃€岃鎯呭喌銆嶃€屽悗缁凯浠ｃ€嶃€屾殏涓嶃€嶃€屽厛瀹炵幇銆嶃€?
---

## 寮曠敤

- **audit-document-iteration-rules**锛歚.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`
- **audit-prompts 搂4**锛歚.codex/skills/speckit-workflow/references/audit-prompts.md` 搂4锛堜富娴佺▼ TASKS 鏂囨。瀹¤锛?- **audit-prompts 搂5**锛歚.codex/skills/speckit-workflow/references/audit-prompts.md` 搂5锛堟ā寮?B 瀹炴柦鍚庡璁★級
- **audit-prompts-critical-auditor-appendix**锛歚.codex/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
- **audit-post-impl-rules**锛歚.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`

---

## 鎻愮ず璇嶆ā鏉垮畬鏁存€э紙閾佸緥锛?
涓?Agent 鍙戣捣 TASKS 鏂囨。瀹¤瀛愪换鍔℃椂锛?*蹇呴』**灏?`references/audit-prompt-tasks-doc.md` 涓殑瀹屾暣 prompt 妯℃澘鏁存澶嶅埗鍒板瓙浠ｇ悊 prompt 涓紝鏇挎崲鍏ㄩ儴鍗犱綅绗︺€?*绂佹**锛?- 鐪佺暐妯℃澘涓殑浠讳綍娈佃惤
- 姒傛嫭鎴栬嚜琛屾敼鍐欐彁绀鸿瘝
- 閬楁紡銆屻€愬繀璇汇€戙€嶉槻鎶よ
- 鍒犻櫎銆岄€愬瓧杈撳嚭銆嶆牸寮忚姹?
瀹炴柦鍚庡璁℃ā鏉胯 `references/audit-prompt-impl.md`銆?
<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
