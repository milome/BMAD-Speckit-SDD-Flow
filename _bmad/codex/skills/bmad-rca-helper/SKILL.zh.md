---
name: bmad-rca-helper
description: |
  Codex CLI / OMC 鐗?BMAD RCA 鍔╂墜閫傞厤鍏ュ彛銆?  浠?Cursor bmad-rca-helper 涓鸿涔夊熀绾匡紝鎸夈€孭arty-Mode 鏍瑰洜鍒嗘瀽 鈫?鏈€缁堟柟妗?+ 浠诲姟鍒楄〃 鈫?瀹¤鏀舵暃銆嶆墽琛屾繁搴﹀垎鏋愩€?  Party-Mode 鐨?gate銆乺ecovery銆乻napshot銆乪vidence 涓?exit 璇箟浠?`{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md` 涓哄噯锛涘綋鍓?designated challenger 纭棬绂佷负 `>60%`锛屼笉鍐嶇敱鏈?skill 鑷畾涔夌浜屽闃堝€笺€傚鈥滄渶缁堟柟妗?+ 浠诲姟鍒楄〃鈥濆満鏅嚦灏?100 杞紝杩炵画 3 杞棤 gap 鏀舵暃锛涘璁″瓙浠ｇ悊鍦ㄥ彂鐜?gap 鏃剁洿鎺ヤ慨鏀硅瀹℃枃妗ｃ€?  瀹¤浼樺厛 `.codex/agents/auditors/auditor-document`锛屾寜 Fallback 閾鹃檷绾с€?  閫傜敤鍦烘櫙锛氱敤鎴疯姹?RCA銆?鏍瑰洜鍒嗘瀽"銆?璁/闂娣卞害鍒嗘瀽"銆?鏈€浼樻柟妗?浠诲姟鍒楄〃"銆佹垨 "RCA 鍚庡璁′换鍔℃枃妗?銆傚叏绋嬩腑鏂囥€?when_to_use: |
  Use when: (1) 鐢ㄦ埛璇锋眰娣卞害鏍瑰洜鍒嗘瀽 (RCA), (2) "鏍瑰洜鍒嗘瀽"銆?璁/闂娣卞害鍒嗘瀽", (3) "鏈€浼樻柟妗?浠诲姟鍒楄〃", (4) "RCA 鍚庡璁′换鍔℃枃妗?銆?references:
  - auditor-document: RCA 鏂囨。瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-document.md`
  - auditor-bugfix: Bugfix 瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-bugfix.md`
  - audit-document-iteration-rules: 鏂囨。瀹¤杩唬瑙勫垯锛沗.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - audit-prompts: 涓诲璁℃彁绀鸿瘝浣撶郴锛沗.codex/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-critical-auditor-appendix: 鎵瑰垽瀹¤鍛橀檮褰曪紱`.codex/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
  - prompt-template-rca-tasks: `.codex/skills/bmad-rca-helper/references/audit-prompt-rca-tasks.md`
  - rca-iteration-rules: `.codex/skills/bmad-rca-helper/references/audit-document-iteration-rules.md`
  - party-mode: `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`
---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?
# Claude Adapter: bmad-rca-helper

> **Party-mode source of truth**锛歚{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`銆傛墍鏈?party-mode 鐨?rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit gate 璇箟閮戒互璇ユ枃浠朵负鍑嗭紱鏈?skill 涓嶅緱瀹氫箟绗簩濂?gate 璇箟銆?
## Purpose

鏈?skill 鏄?Cursor `bmad-rca-helper` 鍦?Codex CLI / OMC 鐜涓嬬殑缁熶竴閫傞厤鍏ュ彛銆?
鐩爣涓嶆槸绠€鍗曞鍒?Cursor skill锛岃€屾槸锛?
1. **缁ф壙 Cursor 宸查獙璇佺殑 RCA 娣卞害鍒嗘瀽璇箟**锛圥arty-Mode 100 杞璁?鈫?鏈€缁堟柟妗?+ 浠诲姟鍒楄〃 鈫?瀹¤鏀舵暃锛?2. **鍦?Codex no-hooks 杩愯鏃朵腑灏嗗璁℃墽琛屼綋鏄犲皠鍒?`.codex/agents/` 绯诲垪**锛堝璁?鈫?`auditor-document`锛?3. **鎺ュ叆浠撳簱涓凡寮€鍙戝畬鎴愮殑 handoff銆乻coring銆乧ommit gate 鏈哄埗**
4. **纭繚鍦?Codex CLI 涓兘瀹屾暣銆佽繛缁€佹纭湴鎵ц RCA 鍏ㄦ祦绋?*

---

## 鏍稿績楠屾敹鏍囧噯

Claude 鐗?`bmad-rca-helper` 蹇呴』婊¤冻锛?
- 鑳戒綔涓?Codex CLI 鐨?**RCA 鍒嗘瀽鍏ュ彛**锛岀粺涓€绠＄悊 party-mode 鈫?鏂规浜у嚭 鈫?瀹¤鏀舵暃闂幆
- 鍚勯樁娈电殑鎵ц鍣ㄩ€夋嫨銆乫allback銆佽瘎鍒嗗啓鍏ュ潎涓?Cursor 宸查獙璇佹祦绋嬭涔変竴鑷?- 瀹屾暣鎺ュ叆鏈粨鏂板鐨勶細
  - auditor-document 鎵ц浣?  - 缁熶竴 auditor host runner锛坄runAuditorHost`锛?  - handoff 鍗忚
- 涓嶅緱灏?Codex Canonical Base銆丆laude Runtime Adapter銆丷epo Add-ons 娣峰啓涓烘潵婧愪笉鏄庣殑閲嶅啓鐗?prompt

## 涓?Agent 缂栨帓闈紙寮哄埗锛?
浜や簰妯″紡涓嬶紝鏈?skill 鐨勫叏灞€鎺ㄨ繘蹇呴』鐢?repo-native `main-agent-orchestration` 鍐冲畾銆俙runAuditorHost` 鍙礋璐ｅ璁″悗鐨?host close-out锛屼笉鑳芥浛浠ｄ富 Agent 鐨勪笅涓€姝ュ垎鏀喅绛栥€?
鍦ㄥ彂璧?RCA 瀹¤瀛愪换鍔°€佸疄鏂藉瓙浠诲姟鎴栦换浣?bounded execution 鍓嶏紝涓?Agent 蹇呴』锛?
1. 鎵ц `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. 璇诲彇 `orchestrationState`銆乣pendingPacketStatus`銆乣pendingPacket`銆乣continueDecision`銆乣mainAgentNextAction`銆乣mainAgentReady`
3. 鑻ヤ笅涓€鍒嗘敮鍙淳鍙戜絾灏氭棤鍙敤 packet锛屾墽琛?`npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. 浠呬緷鎹繑鍥炵殑 packet / instruction 娲惧彂瀛愪唬鐞嗭紝涓嶅緱鍙嚟 party-mode 缁撹銆丷CA prose 鎴?handoff 鎽樿鐩存帴缁窇
5. 姣忔瀛愪唬鐞嗚繑鍥炲悗锛屼互鍙婃瘡娆?`runAuditorHost` 鏀跺彛鍚庯紝閮藉啀娆?`inspect`锛屽啀鍐冲畾涓嬩竴鍏ㄥ眬鍒嗘敮

`mainAgentNextAction / mainAgentReady` 浠呬负 compatibility summary锛涚湡姝ｆ潈濞佺姸鎬佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
---

## 涓夊眰鏋舵瀯

### Layer 1: Codex Canonical Base

> 缁ф壙 Cursor `bmad-rca-helper` 鍏ㄩ儴宸查獙璇佽涔?
#### 閫傜敤鍦烘櫙

- 鐢ㄦ埛鎻愪緵璁銆侀棶棰樻弿杩般€佹埅鍥炬垨鍏蜂綋闂锛岃姹傛繁搴︽牴鍥犲垎鏋?- 闇€瑕佸瑙掕壊杈╄鎸栨帢鏈€浼樻柟妗堝苟鐢熸垚鍙墽琛屼换鍔″垪琛?- 浜у嚭鏂囨。闇€缁忎弗鏍煎璁★紙瀹¤闃舵鍙姹傛壒鍒ゅ璁″憳 >70%銆佽繛缁?3 杞棤 gap锛夊悗浜や粯

#### 寮哄埗绾︽潫

| 绾︽潫 | 璇存槑 |
|------|------|
| Party-Mode 杞 | **鑷冲皯 100 杞?*锛堜骇鍑烘渶缁堟柟妗?+ 浠诲姟鍒楄〃鍦烘櫙锛?|
| 鎵瑰垽瀹¤鍛?| 蹇呴』寮曞叆锛沺arty-mode 鍙戣█鍗犳瘮浠?core step-02 涓哄噯锛堝綋鍓?designated challenger 纭棬绂侊細`challenger_ratio > 0.60`锛?|
| 鏀舵暃鏉′欢 | **鏈€鍚?3 杞棤鏂?gap** 鎵嶈兘缁撴潫杈╄锛團R23a锛氬璁℃敹鏁涙潯浠堕』鍙獙璇侊級 |
| 鏂规涓庝换鍔℃弿杩?| **绂佹**妯＄硦琛ㄨ堪锛?*绂佹**銆屽彲閫夈€佸彲鑰冭檻銆佸悗缁€侀厡鎯呫€嶇瓑涓嶇‘瀹氱敤璇紱**绂佹**閬楁紡 |
| 瀹¤瀛愪换鍔?| 杈╄鏀舵暃骞朵骇鍑烘枃妗ｅ悗**蹇呴』**鍙戣捣瀹¤瀛愪换鍔?|
| 瀹¤鏀舵暃 | 瀹¤椤?*杩炵画 3 杞棤 gap**锛涙湭閫氳繃鏃?*瀹¤瀛愪唬鐞嗙洿鎺ヤ慨鏀硅瀹℃枃妗?*锛岀姝粎杈撳嚭寤鸿 |

#### 宸ヤ綔娴?
##### 闃舵涓€锛歅arty-Mode 鏍瑰洜鍒嗘瀽涓庢柟妗堣璁?
1. **杈撳叆**锛氱敤鎴锋彁渚涚殑璁/闂鎻忚堪/鎴浘/闂锛堜富 Agent 褰掔撼涓虹粺涓€璁鎻忚堪锛夈€?2. **鎵ц**锛?*蹇呴』璇诲彇** `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` 鍙?`steps/step-02-discussion-orchestration.md`锛屽苟**涓ユ牸閬靛惊** step-02 涓殑 Response Structure 涓?gate/recovery/evidence 瑙勫垯缂栨帓澶氳鑹茶璁恒€?3. **瑙掕壊**锛?*蹇呴』**寮曞叆 鈿旓笍 **鎵瑰垽鎬у璁″憳**锛涘彲鍖呭惈 馃彈锔?Winston 鏋舵瀯甯堛€侌煉?Amelia 寮€鍙戙€侌煋?John 浜у搧缁忕悊绛夛紙灞曠ず鍚嶄笌 `_bmad/_config/agent-manifest.csv` 涓€鑷达級锛涙壒鍒ゅ璁″憳鍙戣█鍗犳瘮浠?core step-02 涓哄噯锛屼笉鍦ㄦ湰鎶€鑳戒腑鍙︾珛闃堝€笺€?3b. **鍙戣█鏍煎紡锛堝己鍒讹級**锛氭瘡杞瘡浣嶈鑹插彂瑷€**蹇呴』**浣跨敤鏍煎紡 `[Icon Emoji] **[灞曠ず鍚峕**: [鍙戣█鍐呭]`锛堝 `馃彈锔?**Winston 鏋舵瀯甯?*: ...`銆乣鈿旓笍 **鎵瑰垽鎬у璁″憳**: ...`锛夈€侷con 涓庡睍绀哄悕鍙栬嚜 `_bmad/_config/agent-manifest.csv`锛岀姝㈢渷鐣ャ€?4. **杞涓庢敹鏁?*锛?   - 璁ㄨ **鑷冲皯 100 杞?*锛?   - **鏀舵暃鏉′欢**锛?*鏈€鍚?3 杞棤鏂?gap** 鎵嶈兘缁撴潫锛堝绗?98銆?9銆?00 杞潎鏃犳柊 gap锛夛紱
   - 绂佹鍑戣疆娆★細姣忚疆椤绘湁瀹炶川瑙掕壊鍙戣█銆?5. **浜у嚭**锛?   - 鏈€缁堟柟妗堟弿杩帮細楂樿川閲忋€佸噯纭€佹棤妯＄硦琛ㄨ堪銆佹棤銆屽彲閫?鍙€冭檻/鍚庣画/閰屾儏銆嶃€佹棤閬楁紡锛?   - 鏈€缁堜换鍔″垪琛細鍙墽琛屻€佸彲楠屾敹銆佷笌鏂规涓€涓€瀵瑰簲銆?
浜у嚭鏂囨。鍛藉悕涓庤矾寰勶細鑻ヤ笌 Story 鍏宠仈鍒欑疆浜?`_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/`锛屽惁鍒欑疆浜?`_bmad-output/implementation-artifacts/_orphan/`锛涘 `RCA_{璁slug}.md` 鎴?`TASKS_RCA_{璁slug}.md`锛堝惈 搂1 闂绠€杩般€伮? 绾︽潫銆伮? 鏍瑰洜涓庢柟妗堛€伮? 浠诲姟鍒楄〃銆伮? 楠屾敹绛夛級銆?
##### 闃舵浜岋細瀹¤瀛愪换鍔★紙蹇呭仛锛?
1. **瑙﹀彂**锛氶樁娈典竴鏀舵暃骞剁敓鎴愭渶缁堟柟妗?+ 浠诲姟鍒楄〃鏂囨。鍚庯紝涓?Agent **蹇呴』**鍙戣捣瀹¤瀛愪换鍔°€?2. **瀛愪唬鐞嗛€夋嫨**锛氭寜 Fallback Strategy 鎵ц锛堣 Layer 2锛夈€?3. **瀹¤渚濇嵁**锛氫娇鐢?[references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) 涓殑瀹屾暣 prompt 妯℃澘锛坅udit-prompts 搂4 绮剧 + TASKS 鏂囨。閫傞厤锛夈€?4. **瀹¤瑕佹眰**锛?   - **鎵瑰垽瀹¤鍛樺繀椤诲嚭鍦?*锛屽彂瑷€鍗犳瘮 **>70%**锛?   - **鏀舵暃鏉′欢**锛?*杩炵画 3 杞棤 gap**锛堥拡瀵硅瀹℃枃妗ｏ級锛?   - **鏈€氳繃鏃?*锛?*瀹¤瀛愪唬鐞嗛』鍦ㄦ湰杞唴鐩存帴淇敼琚鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗杈撳嚭鎶ュ憡骞舵敞鏄庡凡淇敼鍐呭锛涗富 Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁★紱**绂佹**浠呰緭鍑轰慨鏀瑰缓璁€屼笉淇敼鏂囨。銆傝瑙?[references/audit-document-iteration-rules.md](references/audit-document-iteration-rules.md) 鎴?`.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`銆?5. **杩唬**锛氶噸澶嶅璁＄洿鑷虫姤鍛婄粨璁轰负銆?*瀹屽叏瑕嗙洊銆侀獙璇侀€氳繃**銆嶄笖杩炵画 3 杞棤 gap銆?*鏈€澶ц疆娆★細10 杞?*锛岃秴杩囧垯寮哄埗缁撴潫骞惰緭鍑恒€屽凡杈炬渶澶ц疆娆★紝璇蜂汉宸ユ鏌ャ€嶃€?6. **鎶ュ憡钀界洏**锛氭瘡杞璁℃姤鍛婏紙鏃犺閫氳繃涓庡惁锛夊潎椤讳繚瀛樿嚦绾﹀畾璺緞锛屽 `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_RCA_{slug}_搂4_round{N}.md`銆?7. **鏀舵暃妫€鏌?*锛氭敹鍒版姤鍛婂悗锛岃嫢缁撹銆岄€氳繃銆嶄笖鎵瑰垽瀹¤鍛樻敞鏄庛€屾湰杞棤鏂?gap銆嶁啋 `consecutive_pass_count + 1`锛涜嫢銆屾湭閫氳繃銆嶆垨瀛樺湪 gap 鈫?缃?0銆?*閫氳繃鍒ゅ畾**锛氭姤鍛婄粨璁哄惈銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆垨銆岄€氳繃銆嶏紱鎵瑰垽瀹¤鍛樻钀藉惈銆屾湰杞棤鏂?gap銆嶃€屾棤鏂?gap銆嶆垨銆屾棤 gap銆嶃€?8. **绂佹姝诲惊鐜?*锛歚consecutive_pass_count >= 3` 鏃?*绔嬪嵆缁撴潫**锛屼笉鍐嶅彂璧峰璁°€?
#### 鍙В鏋愯瘎鍒嗗潡锛堝己鍒讹級

瀹¤鎶ュ憡缁撳熬椤诲惈锛?
```markdown
## 鍙В鏋愯瘎鍒嗗潡锛堜緵 parseAndWriteScore锛?鎬讳綋璇勭骇: [A|B|C|D]
缁村害璇勫垎:
- 闇€姹傚畬鏁存€? XX/100
- 鍙祴璇曟€? XX/100
- 涓€鑷存€? XX/100
- 鍙拷婧€? XX/100
```

#### 搂 绂佹璇嶈〃锛堟柟妗堜笌浠诲姟鎻忚堪锛?
浠ヤ笅璇嶄笉寰楀嚭鐜板湪鏈€缁堟柟妗堟弿杩颁笌浠诲姟鍒楄〃涓€傚璁℃椂鑻ュ彂鐜颁换涓€璇嶏紝缁撹涓烘湭閫氳繃銆?
| 绂佹璇?鐭 | 鏇夸唬鏂瑰悜 |
|-------------|----------|
| 鍙€夈€佸彲鑰冭檻銆佸彲浠ヨ€冭檻 | 鏄庣‘鍐欍€岄噰鐢ㄦ柟妗?A銆嶅苟绠€杩扮悊鐢?|
| 鍚庣画銆佸悗缁凯浠ｃ€佸緟鍚庣画 | 鑻ユ湰闃舵涓嶅仛鍒欎笉鍦ㄦ枃妗ｄ腑鍐欙紱鑻ュ仛鍒欏啓娓呮湰闃舵瀹屾垚鑼冨洿 |
| 寰呭畾銆侀厡鎯呫€佽鎯呭喌 | 鏀逛负鏄庣‘鏉′欢涓庡搴斿姩浣滐紙濡傘€岃嫢 X 鍒?Y銆嶏級 |
| 鎶€鏈€恒€佸厛杩欐牱鍚庣画鍐嶆敼 | 鍗曠嫭寮€ Story 鎴栦笉鍦ㄦ湰娆¤寖鍥达紱涓嶅湪 RCA 浜у嚭涓暀鎶€鏈€?|

---

### Layer 2: Codex no-hooks Runtime Adapter

> 灏?Cursor 鎵ц浣撴槧灏勫埌 Codex CLI 鍘熺敓鎵ц浣?
#### Primary Executor

| 闃舵 | 婧愬钩鍙板璁″櫒 | Claude 鎵ц浣?| Agent 瀹氫箟 |
|------|-------------|--------------|-----------|
| RCA 鏂囨。瀹¤ | code-reviewer锛堝師骞冲彴 Task 璋冨害锛?| `auditor-document` | `.codex/agents/auditors/auditor-document.md` |

璋冪敤鏂瑰紡锛氶€氳繃 Agent tool锛坄subagent_type: general-purpose`锛夎皟鐢ㄥ搴旀墽琛屼綋銆?
#### Fallback Strategy锛? 灞傞檷绾э級

褰?Primary Executor 涓嶅彲鐢ㄦ椂锛屾寜浠ヤ笅椤哄簭閫愮骇闄嶇骇锛?
| 灞傜骇 | 鎵ц鏂瑰紡 | 鏉′欢 |
|------|---------|------|
| L1 (Primary) | `.codex/agents/auditors/auditor-document` 鎵ц浣?| 榛樿棣栭€?|
| L2 | `code-reviewer` Agent | auditor-document 涓嶅彲鐢ㄦ椂 |
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
target_agent: auditor-document
phase: rca_doc_audit
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
  - action: revise_rca_doc|execute_rca_tasks
    agent: auditor-document|bmad-standalone-tasks
    ready: true|false
handoff:
  next_action: revise_rca_doc|execute_rca_tasks
  next_agent: auditor-document|bmad-standalone-tasks
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

- PASS 浠呰〃绀?RCA 鏂囨。瀹¤閫氳繃锛屽厑璁歌繘鍏?`bmad-standalone-tasks` 瀹炴柦闃舵
- 涓嶅厑璁哥洿鎺?commit
- 鏈€缁?commit 鐢?`bmad-master` 闂ㄦ帶

---

## 寮曠敤涓庝緷璧?
| 璧勬簮 | 璺緞/璇存槑 |
|------|-----------|
| **party-mode** | `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`锛涙墍鏈?rounds / challenger ratio / recovery / evidence / exit gate 瑙勫垯浠?core step-02 涓哄噯 |
| **鎵瑰垽瀹¤鍛?* | `{project-root}/_bmad/core/agents/critical-auditor-guide.md`锛堣嫢瀛樺湪锛夛紱step-02 涓壒鍒ゆ€у璁″憳涓哄繀閫夋寫鎴樿€?|
| **audit-prompts 搂4** | `.codex/skills/speckit-workflow/references/audit-prompts.md` 搂4锛坱asks 瀹¤锛夛紱鏈妧鑳藉璁?prompt 涓庝箣绮剧涓€鑷?|
| **audit-document-iteration-rules** | `.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`锛涘彂鐜?gap 鏃跺璁″瓙浠ｇ悊鐩存帴淇敼鏂囨。銆? 杞棤 gap 鏀舵暃 |
| **鏈妧鑳藉璁℃ā鏉?* | [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) |
| **鏈妧鑳借凯浠ｈ鍒?* | [references/audit-document-iteration-rules.md](references/audit-document-iteration-rules.md) |

---

## 鎻愮ず璇嶆ā鏉垮畬鏁存€э紙閾佸緥锛?
涓?Agent 鍙戣捣 RCA 鏂囨。瀹¤瀛愪换鍔℃椂锛?*蹇呴』**灏?`references/audit-prompt-rca-tasks.md` 涓殑瀹屾暣 prompt 妯℃澘鏁存澶嶅埗鍒板瓙浠ｇ悊 prompt 涓紝鏇挎崲鍏ㄩ儴鍗犱綅绗︺€?*绂佹**锛?- 鐪佺暐妯℃澘涓殑浠讳綍娈佃惤
- 姒傛嫭鎴栬嚜琛屾敼鍐欐彁绀鸿瘝
- 閬楁紡銆屻€愬繀璇汇€戙€嶉槻鎶よ
- 鍒犻櫎銆岄€愬瓧杈撳嚭銆嶆牸寮忚姹?
RCA 杈╄浜у嚭妯℃澘涓殑銆屾渶缁堟柟妗堟弿杩般€嶃€屾渶缁堜换鍔″垪琛ㄣ€嶆牸寮忚姹備笉寰楃渷鐣ャ€?
---

## 涓?Agent 鍙戣捣瀹¤鏃剁殑蹇呭畧瑙勫垯

- 灏?**references/audit-prompt-rca-tasks.md** 涓殑瀹屾暣 prompt **鏁存澶嶅埗**鍒板璁″瓙浠诲姟锛屾浛鎹?`{鏂囨。璺緞}`銆乣{闇€姹備緷鎹矾寰剗`銆乣{椤圭洰鏍箎`銆乣{鎶ュ憡璺緞}`銆乣{杞}`銆?- **鎶ュ憡淇濆瓨**锛氭ā鏉夸腑椤讳负銆屾瘡杞姤鍛婏紙鏃犺閫氳繃涓庡惁锛夊潎椤讳繚瀛樿嚦 {鎶ュ憡璺緞}銆嶃€?- 纭繚瀹¤瀛愪唬鐞嗗彲璁块棶椤圭洰鍐?`audit-document-iteration-rules.md` 鍙?audit-prompts 搂4 绮剧璇存槑锛堝彲鍦?prompt 涓矘璐村叧閿钀芥垨璺緞锛夈€?
<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
