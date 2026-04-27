# Prompt templates for bmad-standalone-tasks (Codex CLI)

Use these when invoking Agent tool for implementation (`subagent_type: general-purpose`) and audit. Replace `{DOC_PATH}` and any `{鈥` placeholders.

---

## Implementation sub-task (general-purpose)

**鍓嶇疆锛堝繀椤伙級**锛氳鍏堣鍙栧苟閬靛惊浠ヤ笅鎶€鑳藉啀鎵ц涓嬫柟浠诲姟锛?- **ralph-method**锛歱rd/progress 鍛藉悕瑙勫垯涓?schema锛堜笌褰撳墠鏂囨。鍚岀洰褰曘€乸rd.{stem}.json / progress.{stem}.txt锛夈€佹瘡瀹屾垚涓€ US 鏇存柊 prd 涓?progress銆?- **speckit-workflow**锛歍DD 绾㈢豢鐏€?5 鏉￠搧寰嬨€侀獙鏀跺懡浠ゃ€佹灦鏋勫繝瀹烇紱绂佹浼疄鐜颁笌鍗犱綅銆?璇蜂粠褰撳墠鐜鍙敤鐨勬妧鑳戒腑鍔犺浇 ralph-method銆乻peckit-workflow锛涜嫢鏃犳硶瀹氫綅锛屽垯鎸夋湰 prompt 涓凡鍐欐槑鐨?ralph-method / speckit-workflow 绾︽潫鎵ц銆?
---

```
浣犳鍦ㄦ寜 **TASKS/BUGFIX 鏂囨。** 鎵ц鏈畬鎴愪换鍔°€傚繀椤讳弗鏍奸伒寰互涓嬬害鏉燂紝涓嶅緱杩濆弽銆?
## 鏂囨。涓庤矾寰?- **TASKS/BUGFIX 鏂囨。璺緞**锛歿DOC_PATH}
- **浠诲姟娓呭崟**锛歿TASK_LIST}锛堢敱涓?Agent 浠庢枃妗ｈВ鏋愭湭瀹屾垚椤瑰悗濉啓锛岀ず渚嬶細搂7 T7a-1锝濼7a-9銆伮? T7b-1锝濼7b-10銆傦級

## 寮哄埗绾︽潫
1. **ralph-method**锛氬湪鏈枃妗ｅ悓鐩綍鍒涘缓骞剁淮鎶?prd 涓?progress 鏂囦欢锛堟枃妗ｄ负 BUGFIX_xxx.md 鏃朵娇鐢?prd.BUGFIX_xxx.json銆乸rogress.BUGFIX_xxx.txt锛夛紱姣忓畬鎴愪竴涓?US 蹇呴』鏇存柊 prd锛堝搴?passes=true锛夈€乸rogress锛堣拷鍔犱竴鏉″甫鏃堕棿鎴崇殑 story log锛夛紱鎸?US 椤哄簭鎵ц銆?*prd 椤荤鍚?ralph-method schema**锛氭秹鍙婄敓浜т唬鐮佺殑 US 鍚?`involvesProductionCode: true` 涓?`tddSteps`锛圧ED/GREEN/REFACTOR 涓夐樁娈碉級锛涗粎鏂囨。/閰嶇疆鐨勫惈 `tddSteps`锛圖ONE 鍗曢樁娈碉級銆?*progress 棰勫～ TDD 妲戒綅**锛氱敓鎴?progress 鏃讹紝瀵规瘡涓?US 棰勫～ `[TDD-RED] _pending_`銆乣[TDD-GREEN] _pending_`銆乣[TDD-REFACTOR] _pending_` 鎴?`[DONE] _pending_`锛屾秹鍙婄敓浜т唬鐮佺殑 US 鍚笁鑰咃紝浠呮枃妗?閰嶇疆鐨勫惈 [DONE]锛涙墽琛屾椂灏?`_pending_` 鏇挎崲涓哄疄闄呯粨鏋溿€?2. **TDD 绾㈢豢鐏?*锛?*姣忎釜 US 椤荤嫭绔嬫墽琛?RED鈫扜REEN鈫扲EFACTOR**锛涚姝粎瀵归涓?US 鎵ц TDD 鍚庡鍚庣画 US 璺宠繃绾㈢伅鐩存帴瀹炵幇銆傛瘡涓?US 鎵ц鍓嶅厛鍐?琛ユ祴璇曪紙绾㈢伅锛夆啋 瀹炵幇浣块€氳繃锛堢豢鐏級鈫?閲嶆瀯銆?*銆怲DD 绾㈢豢鐏樆濉炵害鏉熴€?* 姣忎釜娑夊強鐢熶骇浠ｇ爜鐨勪换鍔℃墽琛岄『搴忎负锛氣憼 鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹 鈫?蹇呴』寰楀埌澶辫触缁撴灉锛堢孩鐏級锛涒憽 绔嬪嵆鍦?progress 杩藉姞 [TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed锛涒憿 鍐嶅疄鐜板苟閫氳繃楠屾敹 鈫?寰楀埌閫氳繃缁撴灉锛堢豢鐏級锛涒懀 绔嬪嵆鍦?progress 杩藉姞 [TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed锛涒懁 **鏃犺鏄惁鏈夐噸鏋?*锛屽湪 progress 杩藉姞 [TDD-REFACTOR] <浠诲姟ID> <鍐呭>锛堟棤鍏蜂綋閲嶆瀯鏃跺啓銆屾棤闇€閲嶆瀯 鉁撱€嶏級銆傜姝㈠湪鏈畬鎴愭楠?1鈥? 涔嬪墠鎵ц姝ラ 3銆傜姝㈡墍鏈変换鍔″畬鎴愬悗闆嗕腑琛ュ啓 TDD 璁板綍銆?*浜や粯鍓嶈嚜妫€**锛氭秹鍙婄敓浜т唬鐮佺殑姣忎釜 US锛宲rogress 椤诲惈 [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鍚勮嚦灏戜竴琛岋紝涓?[TDD-RED] 椤诲湪 [TDD-GREEN] 涔嬪墠锛涚己浠讳竴椤瑰垯琛ュ厖鍚庡啀浜や粯銆?3. **speckit-workflow**锛氱姝吉瀹炵幇銆佸崰浣嶃€乀ODO 寮忓疄鐜帮紱蹇呴』杩愯鏂囨。涓殑楠屾敹鍛戒护锛涙灦鏋勫繝瀹炰簬 BUGFIX/TASKS 鏂囨。锛涚姝㈠湪浠诲姟鎻忚堪涓坊鍔犮€屽皢鍦ㄥ悗缁凯浠ｃ€嶏紱绂佹鏍囪瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤銆?4. **楠屾敹**锛氭瘡鎵逛换鍔″畬鎴愬悗杩愯鏂囨。涓粰鍑虹殑 pytest 鎴栭獙鏀跺懡浠わ紝骞跺皢缁撴灉鍐欏叆 progress銆?
璇疯鍙栦笂杩拌矾寰勪笅鐨勬枃妗ｏ紝鎸夋湭瀹屾垚浠诲姟閫愰」瀹炴柦锛屽苟杈撳嚭锛氬凡瀹屾垚鐨?US/浠诲姟缂栧彿銆侀獙鏀跺懡浠よ繍琛岀粨鏋溿€佷互鍙婃洿鏂板悗鐨?prd/progress 鐘舵€佹憳瑕併€?```

#### 鏃?US 缁撴瀯鏃剁殑 prd 鐢熸垚

褰撴枃妗ｄ粎涓烘墎骞充换鍔″垪琛紙鏃?US-001 绛?id锛夋椂锛屽瓙浠ｇ悊椤伙細
1. 灏嗘枃妗ｄ腑姣忔潯鍙獙鏀朵换鍔′緷娆℃爣鍙蜂负 US-001銆乁S-002銆佲€︼紙鎴栦笌鏂囨。宸叉湁缂栧彿濡?T7a-1 涓€涓€鏄犲皠锛屽苟鍦?prd 鐨?userStories[].id 涓娇鐢ㄤ竴鑷?id锛夈€?2. 鐢熸垚绗﹀悎 ralph-method 鐨?prd.json锛堝惈 userStories銆乤cceptanceCriteria銆乸asses銆乮nvolvesProductionCode銆乼ddSteps 绛夛級銆?3. progress 棰勫～ TDD 妲戒綅锛圼TDD-RED] _pending_銆乕TDD-GREEN] _pending_銆乕TDD-REFACTOR] _pending_ 鎴?[DONE] _pending_锛夛紱瀹屾垚椤逛笌 prd 涓殑 id 涓€鑷淬€?4. 鑻ユ枃妗ｅ瓨鍦?搂7 绛夊甫缂栧彿浠诲姟鍒楄〃锛屼紭鍏堥噰鐢ㄨ缂栧彿浣滀负 US id 浠ヤ繚鎸佸彲杩芥函銆?
---

## Resume 瀹炴柦瀛愪换鍔★紙general-purpose锛?
褰?Step 1 瀛愪换鍔℃湭鍦ㄤ竴娆¤皟鐢ㄥ唴瀹屾垚鏃讹紝涓?Agent 浣跨敤 Agent tool **resume** 鎴栭噸鏂板彂璧?Agent tool 鏃讹紝鍙紶鍏ヤ互涓嬫ā鏉匡紙濉啓鏂偣涓庢湰鎵硅寖鍥达級銆?
```
浣犳鍦?*鎺ョ画**鎵ц TASKS/BUGFIX 鏂囨。鐨勬湭瀹屾垚浠诲姟銆傝鍏堣鍙栧悓鐩綍涓嬬殑 progress 鏂囦欢纭宸插畬鎴愯寖鍥达紝鍐嶄粠鏈壒璧风偣寮€濮嬫墽琛屻€?
## 鏂囨。涓庤矾寰?- **TASKS/BUGFIX 鏂囨。璺緞**锛歿DOC_PATH}
- **涓婁竴鎵瑰凡瀹屾垚**锛歿宸插畬鎴愯寖鍥达紝濡?搂7 T7a-1锝濼7a-9}
- **鏈壒寰呮墽琛?*锛歿鏈壒鑼冨洿锛屽 搂7 T7b-1锝濼7b-10}

## 寮哄埗绾︽潫
锛堜笌銆孖mplementation sub-task銆嶄腑 1锝? 鏉＄浉鍚岋細ralph-method銆乀DD 绾㈢豢鐏€乻peckit-workflow銆侀獙鏀躲€傦級

璇蜂粠鏈壒寰呮墽琛岀殑绗竴椤瑰紑濮嬶紝閫愰」瀹炴柦骞舵洿鏂?prd/progress锛岃緭鍑猴細鏈壒宸插畬鎴愮殑 US/浠诲姟缂栧彿銆侀獙鏀跺懡浠よ繍琛岀粨鏋溿€佷互鍙婃洿鏂板悗鐨?prd/progress 鐘舵€佹憳瑕併€?```

---

## Audit sub-task (搂5 + 鎵瑰垽瀹¤鍛? 3 杞棤 gap)

```
瀵?**瀹炴柦瀹屾垚鍚庣殑缁撴灉** 鎵ц **audit-prompts 搂5 鎵ц闃舵瀹¤**銆傚繀椤诲紩鍏?**鎵瑰垽瀹¤鍛橈紙Critical Auditor锛?* 瑙嗚锛屼笖鎵瑰垽瀹¤鍛樺彂瑷€鍗犳瘮椤?**>70%**銆?
## 琚瀵硅薄
- 瀹炴柦渚濇嵁鏂囨。锛歿DOC_PATH}
- 瀹炴柦浜х墿锛氫唬鐮佸彉鏇淬€乸rd銆乸rogress銆佷互鍙婃枃妗ｄ腑瑕佹眰鐨勯獙鏀跺懡浠よ緭鍑?
## 搂5 瀹¤椤?1. 浠诲姟鏄惁鐪熸瀹炵幇锛堟棤棰勭暀/鍗犱綅/鍋囧畬鎴愶級
2. 鐢熶骇浠ｇ爜鏄惁鍦ㄥ叧閿矾寰勪腑琚娇鐢?3. 闇€瀹炵幇鐨勯」鏄惁鍧囨湁瀹炵幇涓庢祴璇?楠屾敹瑕嗙洊
4. 楠屾敹琛?楠屾敹鍛戒护鏄惁宸叉寜瀹為檯鎵ц骞跺～鍐?5. 鏄惁閬靛畧 ralph-method锛坧rd/progress 鏇存柊銆乁S 椤哄簭锛夛紱娑夊強鐢熶骇浠ｇ爜鐨勬瘡涓?US 鏄惁鍚?[TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鍚勮嚦灏戜竴琛岋紙[TDD-REFACTOR] 鍏佽鍐欍€屾棤闇€閲嶆瀯 鉁撱€嶏紱[TDD-RED] 椤诲湪 [TDD-GREEN] 涔嬪墠锛?6. 鏄惁鏃犮€屽皢鍦ㄥ悗缁凯浠ｃ€嶇瓑寤惰繜琛ㄨ堪锛涙槸鍚︽棤鏍囪瀹屾垚浣嗘湭璋冪敤
7. 椤圭洰椤绘寜鎶€鏈爤閰嶇疆骞舵墽琛?Lint锛堣 lint-requirement-matrix锛夛紱鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint 椤讳綔涓烘湭閫氳繃椤癸紱宸查厤缃殑椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶈眮鍏嶃€?
## 鎵瑰垽瀹¤鍛?浠庡鎶楄瑙掓鏌ワ細閬楁紡浠诲姟銆佽鍙锋垨璺緞澶辨晥銆侀獙鏀跺懡浠ゆ湭璺戙€伮?/楠屾敹璇激鎴栨紡缃戙€?**鍙搷浣滆姹?*锛氭姤鍛婇』鍖呭惈鐙珛娈佃惤銆?# 鎵瑰垽瀹¤鍛樼粨璁恒€嶏紝涓旇娈佃惤瀛楁暟鎴栨潯鐩暟涓嶅皯浜庢姤鍛婂叾浣欓儴鍒嗙殑 70%锛堝嵆鍗犳瘮 >70%锛夛紱缁撹椤绘槑纭€屾湰杞棤鏂?gap銆嶆垨銆屾湰杞瓨鍦?gap銆嶅強鍏蜂綋椤广€傝嫢涓婁笅鏂囦腑鎻愪緵浜嗘湰杞搴忓彿锛堝銆岀 2 杞€嶏級锛岃鍦ㄧ粨璁轰腑娉ㄦ槑璇ヨ疆娆°€?
## 杈撳嚭涓庢敹鏁?- 缁撹椤绘槑纭細**銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆?* 鎴?**銆屾湭閫氳繃銆?*锛堝苟鍒?gap 涓庝慨鏀瑰缓璁級銆?- **涓€杞?* = 涓€娆℃湰瀹¤瀛愪换鍔＄殑瀹屾暣璋冪敤銆傘€岃繛缁?3 杞棤 gap銆? 杩炵画 3 娆＄粨璁哄潎涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶄笖璇?3 娆℃姤鍛婁腑鎵瑰垽瀹¤鍛樼粨璁烘鍧囨敞鏄庛€屾湰杞棤鏂?gap銆嶏紱鑻ヤ换涓€杞负銆屾湭閫氳繃銆嶆垨銆屽瓨鍦?gap銆嶏紝鍒欎粠涓嬩竴杞噸鏂拌鏁般€?- 鑻ラ€氳繃涓旀壒鍒ゅ璁″憳鏃犳柊 gap锛氭敞鏄庛€屾湰杞棤鏂?gap锛岀 N 杞紱寤鸿绱鑷?3 杞棤 gap 鍚庢敹鏁涖€嶃€?- 鑻ユ湭閫氳繃锛氭敞鏄庛€屾湰杞瓨鍦?gap锛屼笉璁℃暟銆嶏紝淇鍚庡啀娆″彂璧锋湰瀹¤锛岀洿鑷宠繛缁?3 杞棤 gap 鏀舵暃銆?```
