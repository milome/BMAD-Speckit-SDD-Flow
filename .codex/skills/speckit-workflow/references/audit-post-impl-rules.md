# 瀹炴柦鍚庡璁¤鍒欙紙瀹炴柦鍚庨樁娈电粺涓€ strict锛?
鏈枃浠跺畾涔?*瀹炴柦鍚庡璁?*鐨?strict 瑙勫垯锛屼负 bmad-story-assistant 闃舵鍥涖€乻peckit-workflow 搂5.2銆乥mad-standalone-tasks Step 2 涓夊鎻愪緵 Single source of truth銆?
---

## 1. 瀹炴柦鍚庡璁＄殑閫傜敤鑼冨洿

**瀹炴柦鍚?* = 浠ｇ爜/鍙繍琛屼骇鐗╁凡瀹屾垚鐨勫璁°€備互涓嬩笁澶勫潎涓哄疄鏂藉悗瀹¤锛?*蹇呴』**閬靛惊鏈鍒欙細

| 鎶€鑳?| 闃舵/姝ラ | 瀹¤瀵硅薄 |
|------|-----------|----------|
| bmad-story-assistant | 闃舵鍥涳紙瀹炴柦鍚庡璁★級 | Story 瀹炴柦鍚庣殑浠ｇ爜銆乸rd銆乸rogress |
| speckit-workflow | 搂5.2 鎵ц闃舵瀹¤ | tasks.md 鎵ц鍚庣殑浠ｇ爜銆乸rd銆乸rogress |
| bmad-standalone-tasks | Step 2 瀹¤瀛愪换鍔?| TASKS/BUGFIX 瀹炴柦鍚庣殑浠ｇ爜銆乸rd銆乸rogress |

---

## 2. strict 瑙勫垯锛堝繀椤婚伒瀹堬級

瀹炴柦鍚庡璁?*蹇呴』**婊¤冻浠ヤ笅鏉′欢锛岀己涓€涓嶅彲锛?
### 2.1 鎵瑰垽瀹¤鍛?
- 瀹¤鎶ュ憡椤诲寘鍚嫭绔嬫钀?**銆?# 鎵瑰垽瀹¤鍛樼粨璁恒€?*
- 璇ユ钀?*瀛楁暟鎴栨潯鐩暟涓嶅皯浜庢姤鍛婂叾浣欓儴鍒?*锛堝嵆鍗犳瘮 鈮?0%锛?- 蹇呭～缁撴瀯锛氬凡妫€鏌ョ淮搴﹀垪琛ㄣ€佹瘡缁村害缁撹銆併€屾湰杞棤鏂?gap銆嶆垨銆屾湰杞瓨鍦?gap銆嶅強鍏蜂綋椤?- 璇﹁ [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)

### 2.2 杩炵画 3 杞棤 gap 鏀舵暃

**涓€杞?* = 涓€娆″畬鏁村璁″瓙浠诲姟/瀛愪唬鐞嗚皟鐢ㄣ€?
**杩炵画 3 杞棤 gap** = 杩炵画 3 娆″璁＄粨璁哄潎涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紝涓旇 3 娆℃姤鍛婁腑鎵瑰垽瀹¤鍛樼粨璁烘鍧囨敞鏄庛€屾湰杞棤鏂?gap銆嶃€?
**璁℃暟瑙勫垯**锛?- 鏀跺埌 pass 涓旀壒鍒ゅ璁″憳鏃犳柊 gap 鈫?`consecutive_pass_count + 1`
- 浠讳竴杞负銆屾湭閫氳繃銆嶆垨銆屽瓨鍦?gap銆嶁啋 `consecutive_pass_count` 缃?0锛屼粠涓嬩竴杞噸鏂拌鏁?- 杈惧埌 3 鍗虫敹鏁涳紝鍙粨鏉熷璁?
**绀轰緥**锛?- 閫氳繃-閫氳繃-gap 鈫?淇敼 鈫?閫氳繃-閫氳繃-閫氳繃 鈫?鍚?3 杞畻鏀舵暃 鉁?- 閫氳繃-閫氳繃-閫氳繃 鈫?鏀舵暃 鉁?
### 2.3 涓?iteration_count 鐨勫尯鍒?
- **iteration_count**锛氱粺璁″璁?*鏈€氳繃**鐨勮疆娆★紙fail 娆℃暟锛夛紝鐢ㄤ簬 scoring tier 绯绘暟绛?- **consecutive_pass_count**锛氱敤浜庢敹鏁涙潯浠讹紝涓嶅啓鍏?scoring锛屼粎娴佺▼鍐呴儴鎺у埗

### 2.4 Wave 1B journey contract 涔熸槸 strict 鏀舵暃鍓嶆彁

strict 瀹¤涓嶅彧妫€鏌モ€滄湁鏃?gap鈥濓紝杩樺繀椤绘妸浠ヤ笅 Wave 1B journey contracts 瑙嗕负**纭棬妲?*锛涗换涓€椤圭己澶辨垨璇佹嵁涓嶆垚绔嬶紝璇ヨ疆鍗冲垽 `瀛樺湪 gap`锛宍consecutive_pass_count` 娓呴浂锛?
- `Smoke Task Chain`锛氬繀椤昏兘璇佹槑褰撳墠 Journey 鐨?smoke 浠诲姟閾惧凡鐪熸闂悎锛岃€屼笉鏄彧瀛樺湪鏂囧瓧澹版槑銆?- `Closure Task ID`锛氬繀椤昏兘瀹氫綅鍒扮湡瀹?closure note 浠诲姟锛涜嫢 closure note 宸插啓浣嗘病鏈夊搴?`Closure Task ID`锛屼粛鍒ゆ湭閫氳繃銆?- `Journey Unlock` / `Smoke Path Unlock`锛歴etup / foundational 浠诲姟鑻ュ０绉板凡瑙ｉ攣 Journey锛屽繀椤绘湁瀹為檯瑙ｉ攣璇佹嵁锛岃€屼笉鏄粎甯?Journey 鏍囩銆?- `Definition Gap Handling` / `Implementation Gap Handling`锛氫袱绫?gap 蹇呴』淇濇寔鍒嗙锛涜嫢鎶?definition gap 鍖呰鎴愬凡瀹炵幇鍔熻兘锛屾垨鍦ㄥ璁＄粨璁洪噷娣峰啓锛屼粛鍒ゆ湭閫氳繃銆?- `Shared Journey Ledger Path` / `Shared Invariant Ledger Path` / `Shared Trace Map Path`锛歮ulti-agent 瀹¤蹇呴』楠岃瘉鎵€鏈?worker 浣跨敤鍚屼竴浠?shared artifacts銆?- `same path reference`锛氳嫢涓嶅悓 agent 鍙紩鐢ㄥ悇鑷鏈夋憳瑕侊紝鑰屾病鏈夊洖鍒板悓涓€浠?ledger / trace map 璺緞锛屽垯璇ヨ疆涓嶅緱璁颁负鏃?gap銆?- `Production Path`锛氭瘡涓?P0 journey 蹇呴』鑳藉畾浣嶅埌鐪熷疄鐢熶骇浠ｇ爜鍏ュ彛锛涜嫢浠诲姟瀹屾垚浣嗗叆鍙ｆ湭鎺ョ嚎锛岃杞笉寰楄涓烘棤 gap銆?- `Smoke Proof` / `Full E2E`锛歋moke Proof 缂哄け鐩存帴鍒ゆ湭閫氳繃锛汧ull E2E 鏈畬鎴愭椂锛宑losure note 涓繀椤诲啓 formal defer reason銆?- `Acceptance Evidence`锛氳嫢 Journey 宸插绉板畬鎴愶紝浣嗘病鏈?acceptance evidence锛岃杞笉寰楄涓烘棤 gap銆?- `Deferred Gap register`锛氳嫢 gap 琚爣璁颁负 resolved / carried_forward锛屼絾鏈悓姝?closure evidence 鎴?carry-forward evidence锛岃杞笉寰楄涓烘棤 gap銆?
---

## 3. 涓?audit-prompts 搂5 鐨勫紩鐢ㄥ叧绯?
- **audit-prompts.md 搂5**锛氭墽琛岄樁娈靛璁＄殑鎻愮ず璇嶆ā鏉匡紝鍚€愰」妫€鏌ユ竻鍗?- **鏈枃浠?*锛氬疄鏂藉悗瀹¤鐨?*娴佺▼涓庢敹鏁涜鍒?*锛? 杞棤 gap銆佹壒鍒ゅ璁″憳瑕佹眰锛?- 涓夎€呴厤鍚堬細瀹¤瀛愪换鍔′娇鐢?audit-prompts 搂5 鐨勬彁绀鸿瘝锛屽悓鏃舵寜鏈枃浠舵墽琛?3 杞敹鏁涢€昏緫锛屽苟寮曠敤 audit-prompts-critical-auditor-appendix 鐨勬壒鍒ゅ璁″憳鏍煎紡

---

## 4. batch 鍦烘櫙锛坰peckit-workflow锛?
- **batch 闂村璁?*锛堟瘡鎵?tasks 瀹屾垚鍚庣殑涓棿妫€鏌ョ偣锛夛細鍙敤 **standard**锛堝崟娆?+ 鎵瑰垽瀹¤鍛橈級锛屼笉蹇?3 杞?- **鏈€缁?搂5.2 瀹¤**锛堝叏閮?tasks 鎵ц瀹屾瘯鍚庣殑鎬诲璁★級锛?*蹇呴』 strict**锛岃繛缁?3 杞棤 gap 鏀舵暃

---

## 5. 寮曠敤鏈枃浠?
涓夊鎶€鑳藉湪鎻忚堪瀹炴柦鍚庡璁℃椂锛屽簲寮曠敤鏈鍒欙細

- 璺緞锛歚.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`
- 鎴栫浉瀵瑰紩鐢細`[audit-post-impl-rules.md](audit-post-impl-rules.md)`锛堝悓鐩綍涓嬶級
