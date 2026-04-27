# bmad-standalone-tasks 鎶€鑳?100 杞繁搴﹀垎鏋愯瘎瀹℃姤鍛?
**琚鎶€鑳?*锛歚bmad-standalone-tasks`锛圫KILL.md + references/prompt-templates.md锛?
**璇勫瑙嗚**锛氫骇鍝佺粡鐞嗐€佹灦鏋勫笀銆佹壒鍒ゅ璁″憳銆佸紑鍙戜唬琛?
**浜у嚭**锛氫紭鍖栧缓璁竻鍗曘€佸彲鏇挎崲 SKILL 鐗囨銆乸rompt-templates 澧炶ˉ

---

## 涓€銆佷紭鍖栧缓璁竻鍗?
| 缂栧彿 | 瑙掕壊瑙嗚 | 闂鎻忚堪 | 寤鸿淇敼鎴栬ˉ鍏呭唴瀹?| 寤鸿鎻掑叆浣嶇疆 |
|-----|----------|----------|--------------------|--------------|
| O1 | 浜у搧/娴佺▼ | 瑙﹀彂鏉′欢鏈鐩栥€屽伐浣滅洰褰曘€嶃€屽垎鏀悕銆嶇瓑鍙€夎緭鍏ワ紝澶氭枃妗ｅ苟瀛樻椂鍙兘鍐茬獊 | 鍦ㄣ€學hen to use銆嶄笅澧炲姞锛氬彲閫夎緭鍏モ€斺€斿伐浣滅洰褰曪紙榛樿椤圭洰鏍癸級銆佸垎鏀悕锛堣嫢 ralph 闇€ branchName锛夛紱澶氭枃妗ｅ苟瀛樻椂浠ョ敤鎴烽娆℃寚瀹氱殑鏂囨。涓轰富锛宲rd/progress 鍛藉悕闅忚鏂囨。 stem锛岄伩鍏嶅悓鐩綍澶氫换鍔′氦鍙?| SKILL.md 搂 When to use 涓?搂 Hard constraints 涔嬮棿鏂板灏忚妭銆屽彲閫夎緭鍏ヤ笌澶氭枃妗ｇ害瀹氥€?|
| O2 | 浜у搧/娴佺▼ | 鏈畬鎴愪换鍔℃竻鍗曠殑銆屾湭瀹屾垚銆嶇敱璋佸垽瀹氥€佷粠鍝鍙栨湭鏄庣‘ | 鏄庣‘锛氫富 Agent 瑙ｆ瀽鏂囨。璺緞鍚庯紝浠庢枃妗ｄ腑璇嗗埆鏈畬鎴愰」锛堝 搂7 浠诲姟鍒楄〃銆佹湭鍕鹃€夐」銆佹爣娉?TODO/鏈畬鎴愮殑鑺傦級锛涜嫢鏂囨。鏃犳樉寮忔湭瀹屾垚鏍囪锛屽垯绾﹀畾銆屾寜鏂囨。鍐呬换鍔?US 椤哄簭锛屼笌鍚岀洰褰?progress 鏂囦欢瀵规瘮锛屾湭鍦?progress 涓嚭鐜颁笖鏈爣璁?passes 鐨勮涓烘湭瀹屾垚銆?| SKILL.md 搂 Step 1 涔嬪墠澧炲姞銆屽墠缃細瑙ｆ瀽鏈畬鎴愪换鍔℃竻鍗曘€?|
| O3 | 鏋舵瀯/瀹炴柦 | general-purpose 瀛愪唬鐞嗗彲鑳芥湭鍔犺浇 ralph-method銆乻peckit-workflow锛屽鑷?prd 缁撴瀯鎴?TDD 鐞嗚В涓嶄竴鑷?| 鍦ㄥ疄鏂?prompt 妯℃澘寮€澶存樉寮忓鍔狅細銆岃鍏堣鍙栧苟閬靛惊 ralph-method 鎶€鑳斤紙prd/progress 鍛藉悕涓?schema锛夈€乻peckit-workflow 鎶€鑳斤紙TDD 绾㈢豢鐏€?5 鏉￠搧寰嬨€侀獙鏀跺懡浠わ級锛屽啀鎵ц涓嬫柟浠诲姟銆傘€嶅苟娉ㄦ槑鎶€鑳借矾寰勶細鍏ㄥ眬 skills 涓?ralph-method銆乻peckit-workflow | prompt-templates.md 瀹炴柦妯℃澘棣栨 + SKILL.md Step 1 璇存槑 |
| O4 | 鏋舵瀯/瀹炴柦 | TASKS/BUGFIX 鏂囨。鑻ヤ粎鍚墎骞充换鍔″垪琛紙鏃?US-001 绛?id锛夛紝prd 鐢熸垚鏂瑰紡鏈畾涔?| 琛ュ厖锛氳嫢鏂囨。鏃?US 缁撴瀯锛屽瓙浠ｇ悊椤诲皢鏂囨。涓殑鍙獙鏀朵换鍔℃潯鐩爣鍙蜂负 US-001銆乁S-002鈥︼紙鎴栦笌鏂囨。鍘熸湁缂栧彿涓€涓€鏄犲皠锛夛紝鐢熸垚绗﹀悎 ralph-method prd.json schema 鐨?prd锛沺rogress 涓褰曠浉鍚?id锛涜嫢鏂囨。宸叉湁 搂7 绛夊甫缂栧彿浠诲姟锛屽彲浼樺厛閲囩敤鏂囨。缂栧彿浣滀负 US id 浠ヤ繚鎸佸彲杩芥函 | SKILL.md 搂 Hard constraints 鈫?ralph-method 娈碉紱prompt-templates.md 鏂板銆屾棤 US 缁撴瀯鏃剁殑 prd 鐢熸垚璇存槑銆?|
| O5 | 鏋舵瀯/瀹炴柦 | ralph-method 鎶€鑳藉墠缃潯浠朵负銆宼asks.md 宸插瓨鍦ㄣ€嶏紝鏈妧鑳借緭鍏ヤ负 BUGFIX/TASKS 鏂囨。锛屽瓨鍦ㄨ涔夊啿绐?| 鍦ㄦ妧鑳戒腑鏄惧紡鍐欐竻锛氭湰鎶€鑳戒负銆宻tandalone銆嶇敤娉曪紝涓嶈姹傚厛鏈?speckit 浜у嚭鐨?tasks.md锛況alph-method 鐨?prd/progress 鍛藉悕涓庢洿鏂拌妭濂忓湪姝ゅ娌跨敤锛屼絾 US 鏉ユ簮涓哄綋鍓?TASKS/BUGFIX 鏂囨。锛屼笌 ralph-method 涓€宲rd 涓?tasks.md 涓€鑷淬€嶇殑琛ㄨ堪骞跺瓨鏃讹紝浠ユ湰鎶€鑳界害瀹氫负鍑嗭紙鍗?prd 涓庡綋鍓嶆枃妗ｄ竴鑷达級 | SKILL.md 搂 References 涔嬪墠鏂板銆屼笌 ralph-method / speckit-workflow 鐨勮鎺ャ€嶅皬鑺?|
| O6 | 鎵瑰垽瀹¤鍛?| 銆屾壒鍒ゅ璁″憳鍙戣█鍗犳瘮 >50%銆嶅湪 code-reviewer 瀛愪换鍔′腑鏃犲彲鎿嶄綔瀹氫箟锛屾墽琛屾椂闅句互楠岃瘉 | 鍦ㄥ璁?prompt 涓鍔犲彲鎿嶄綔瀹氫箟锛氬璁℃姤鍛婇』鍖呭惈鐙珛娈佃惤銆?# 鎵瑰垽瀹¤鍛樼粨璁恒€嶏紝涓旇娈佃惤瀛楁暟鎴栨潯鐩暟涓嶅皯浜庢姤鍛婂叾浣欓儴鍒嗭紙鍗冲崰姣?>50%锛夛紱鎴栨槑纭細鎶ュ憡鐢便€岄€愰」瀹¤缁撴灉銆嶄笌銆屾壒鍒ゅ璁″憳缁撹銆嶄袱閮ㄥ垎缁勬垚锛屽悗鑰呴』鍗曠嫭鎴愭骞舵敞鏄庛€屾壒鍒ゅ璁″憳瑙嗚銆嶏紝涓旂瘒骞呭崰姣?>50% | prompt-templates.md 瀹¤妯℃澘銆屾壒鍒ゅ璁″憳銆嶆锛汼KILL.md Step 2 Requirements |
| O7 | 鎵瑰垽瀹¤鍛?| 銆? 杞棤 gap銆嶇殑銆岃疆銆嶆槸鍚︿笌銆屽悓涓€瀹¤缁撹杩炵画 3 娆°€嶄竴鑷存湭瀹氫箟锛屾槗浜х敓姝т箟 | 鏄庣‘锛氫竴杞?= 涓€娆″畬鏁村璁″瓙浠诲姟璋冪敤锛涖€岃繛缁?3 杞棤 gap銆? 杩炵画 3 娆″璁＄粨璁哄潎涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶄笖璇?3 娆℃姤鍛婁腑鎵瑰垽瀹¤鍛樼粨璁烘鍧囨敞鏄庛€屾湰杞棤鏂?gap銆嶏紱鑻ヤ换涓€杞嚭鐜般€屾湭閫氳繃銆嶆垨銆屽瓨鍦?gap銆嶏紝鍒欎粠涓嬩竴杞噸鏂拌鏁帮紝涓嶇疮璁?| SKILL.md Step 2 鏀舵暃鏉′欢锛沺rompt-templates.md 杈撳嚭涓庢敹鏁涙 |
| O8 | 鎵瑰垽瀹¤鍛?| 绂佹涓?Agent 鏀圭敓浜х殑琛ㄨ堪缂哄皯璺緞涓庡伐鍏峰垪涓撅紝涓?Agent 鍙兘璇敤 write/search_replace | 鍦ㄣ€孧ain Agent prohibitions銆嶄腑鍒椾妇锛氱姝㈠浠ヤ笅璺緞鎵ц `search_replace`銆乣write`銆乣edit`锛歚vnpy/`銆乣*datafeed*`銆乣*/engine.py`銆佷互鍙?TASKS/BUGFIX 鏂囨。涓垪涓哄疄鐜扮洰鏍囩殑浠讳綍璺緞锛涘厑璁革細鍚岀洰褰曚笅 `prd.{stem}.json`銆乣progress.{stem}.txt` 鐨勫垱寤?鏇存柊鍙敱瀛愪唬鐞嗗畬鎴愶紝涓?Agent 浠呭厑璁哥紪杈戣鏄庢€ф枃浠讹紙濡?README銆佹湰 SKILL銆乤rtifact 鐩綍涓?.md锛?| SKILL.md 搂 Step 3 涓?搂 Hard constraints 绗?1 鏉?|
| O9 | 鍙墽琛屾€?| 鍗犱綅绗?{DOC_PATH}銆亄浠诲姟娓呭崟} 鐨勫～鍐欒矗浠讳笌鏁版嵁鏉ユ簮鏈湪 SKILL 涓泦涓鏄?| 鍦?SKILL.md 涓鍔犮€屽崰浣嶇璇存槑銆嶏細{DOC_PATH} 鐢变富 Agent 鍦ㄨВ鏋愮敤鎴疯緭鍏ュ悗濉啓锛屼负 TASKS/BUGFIX 鏂囨。鐨勭粷瀵硅矾寰勬垨鐩稿椤圭洰鏍圭殑璺緞锛泏浠诲姟娓呭崟} 鐢变富 Agent 浠庢枃妗ｄ腑鎻愬彇鏈畬鎴愰」鍚庡～鍐欙紝鏍煎紡绀轰緥锛毬? T7a-1锝濼7a-9銆伮? 绗?2锝? 鏉?| SKILL.md Step 1 涓嬫柟銆孌OC_PATH銆嶆鎵╁睍涓恒€屽崰浣嶇璇存槑銆嶅皬鑺?|
| O10 | 鍙墽琛屾€?| 瀹炴柦鍒嗗鎵癸紙濡傚厛 T7a 鍐?T7b锛夋椂锛宺esume 濡備綍浼犻€掋€屽綋鍓嶅仛鍒板摢涓€鎵广€嶆湭璇存槑 | 绾﹀畾锛歳esume 鏃朵富 Agent 鍦?prompt 涓樉寮忎紶鍏ャ€屼笂涓€鎵瑰凡瀹屾垚鑼冨洿銆嶄笌銆屾湰鎵瑰緟鎵ц鑼冨洿銆嶏紝渚嬪锛氥€屼笂涓€鎵瑰凡瀹屾垚锛毬? T7a-1锝濼7a-9锛涙湰鎵硅浠?T7b-1 寮€濮嬫墽琛岃嚦 T7b-10銆嶃€傚苟寤鸿鍦?references 涓鍔犮€孯esume 涓撶敤 prompt銆嶆ā鏉?| prompt-templates.md 鏂板銆孯esume 瀹炴柦瀛愪换鍔°€嶆ā鏉匡紱SKILL.md Main Agent responsibilities 涓€宺esume銆嶄竴鍙ユ墿灞?|
| O11 | 杈圭晫涓庨敊璇?| 鏂囨。璺緞涓嶅瓨鍦ㄣ€佸瓙 agent 杩斿洖閿欒鎴栬秴鏃舵椂鏃犲鐞嗙害瀹?| 琛ュ厖锛氳嫢鏂囨。璺緞涓嶅瓨鍦紝涓?Agent 搴斿悜鐢ㄦ埛鎶ラ敊骞跺垪鍑哄凡瑙ｆ瀽鍑虹殑璺緞锛屼笉鍙戣捣瀹炴柦瀛愪换鍔★紱鑻ュ瓙 agent 杩斿洖閿欒鎴栬秴鏃讹紝涓?Agent 鍙彂璧蜂竴娆?resume锛堣嫢瀛樺湪 agent ID锛夛紝鍚﹀垯閲嶆柊鍙戣捣鏂扮殑 Codex worker adapter 骞舵敞鏄庛€屼笂娆℃湭瀹屾垚锛岃浠?progress 鏂囦欢鎴栦笅鍒楁柇鐐圭户缁€嶏紱涓嶆浛浠ｅ瓙 agent 鐩存帴鏀逛唬鐮?| SKILL.md 鏈熬鏂板銆岄敊璇笌杈圭晫澶勭悊銆嶅皬鑺?|
| O12 | 杈圭晫涓庨敊璇?| 涓?Agent 鏄惁鍏佽缂栬緫 progress/prd 鏂囦欢鏈槑纭?| 鏄庣‘锛氫富 Agent **绂佹**鐩存帴缂栬緫 prd.*.json 涓?progress.*.txt锛堣繖浜涚敱瀛愪唬鐞嗘寜 ralph-method 缁存姢锛夛紱涓?Agent 浠呭厑璁哥紪杈戣鏄庢€?鏂囨。绫?artifact锛堝 README銆佹妧鑳借嚜韬€佸璁＄粨璁鸿褰?.md锛?| SKILL.md 搂 Step 3 涓?搂 Hard constraints |
| O13 | 鏋舵瀯/瀹炴柦 | Codex worker adapter 鑻ヤ笉鏀寔 subagent_type=code-reviewer锛屽綋鍓?Step 2 浼氬け璐?| 澧炲姞璋冪敤绛栫暐锛氫紭鍏堜娇鐢?Codex worker dispatch 璋冨害 code-reviewer锛堣嫢瀛樺湪 `.codex/agents/code-reviewer.toml` 鎴?.codex/agents/code-reviewer.md锛夛紱鑻ラ€氳繃 Codex worker adapter 璋冪敤涓旂幆澧冧笉鏀寔 code-reviewer锛屽垯浣跨敤 subagent_type=general-purpose 骞跺皢瀹屾暣瀹¤ prompt锛堝惈 搂5 涓庢壒鍒ゅ璁″憳銆? 杞棤 gap 瑕佹眰锛変紶鍏ワ紝骞跺湪鎶ュ憡涓敞鏄庛€屾湭浣跨敤 code-reviewer 瀛愮被鍨嬶紝浣跨敤 general-purpose + 瀹¤ prompt銆?| SKILL.md Step 2 鏁存锛沺rompt-templates.md 瀹¤妯℃澘璇存槑 |

---

## 浜屻€佸彲鐩存帴鏇挎崲鐨?SKILL.md 鐗囨

### 2.1 鏇挎崲銆學hen to use銆嶄笌銆屽彲閫夎緭鍏ャ€嶆锛堝缓璁彃鍏?O1锛?
**浣嶇疆**锛氱揣鎺?`## When to use` 娈佃惤鍚庛€?
**鏇挎崲涓?*锛?
```markdown
## When to use

- User says: **"/bmad 鎸?{鐢ㄦ埛杈撳叆鐨勬枃妗 涓殑鏈畬鎴愪换鍔″疄鏂?** or equivalent (e.g. "鎸?BUGFIX_xxx.md 瀹炴柦", "鎸?TASKS_xxx.md 鎵ц").
- Input: one **document path** (TASKS_*.md, BUGFIX_*.md, or similar task list with clear items and acceptance).

### 鍙€夎緭鍏ヤ笌澶氭枃妗ｇ害瀹?
- **宸ヤ綔鐩綍**锛氭湭鎸囧畾鏃堕粯璁や负椤圭洰鏍癸紱鑻ョ敤鎴锋寚瀹氬伐浣滅洰褰曪紝涓?Agent 灏?DOC_PATH 瑙ｆ瀽涓鸿鐩綍涓嬬殑鐩稿鎴栫粷瀵硅矾寰勩€?- **鍒嗘敮鍚?*锛氳嫢 ralph-method 鐨?prd 闇€瑕?branchName锛屽彲鐢卞瓙浠ｇ悊浠庢枃妗ｆ垨鐜鎺ㄦ柇锛屾垨鐢辩敤鎴锋樉寮忔彁渚涖€?- **澶氭枃妗ｅ苟瀛?*锛氳嫢鐢ㄦ埛鍚屾椂鎻愬強澶氫唤 TASKS/BUGFIX 鏂囨。锛屼互鐢ㄦ埛**棣栨鏄庣‘鎸囧畾鐨勫崟浠芥枃妗?*涓哄噯锛沺rd/progress 鍛藉悕浠呴殢璇ユ枃妗?stem锛岄伩鍏嶅悓鐩綍澶氫换鍔′氦鍙夊鑷存枃浠惰鐩栥€?```

### 2.2 鏇挎崲銆孲tep 2銆嶅璁¤皟鐢ㄧ瓥鐣ワ紙寤鸿 O13锛?
**浣嶇疆**锛歚## Step 2: Audit sub-task (after implementation)` 涓嬶紝`**Tool**: Codex worker adapter` 鑷?`**Requirements**:` 涔嬮棿銆?
**鏇挎崲涓?*锛?
```markdown
**Tool**: 浼樺厛 Codex worker dispatch 璋冨害 code-reviewer锛涜嫢涓嶅彲鐢ㄥ垯 `Codex worker adapter`銆?
**subagent_type**锛堜粎 Codex worker adapter 鏃讹級锛氳嫢鐜鏀寔 `code-reviewer` 鍒欎娇鐢紱鍚﹀垯浣跨敤 `general-purpose` 骞朵紶鍏ュ畬鏁村璁?prompt锛堝惈 搂5銆佹壒鍒ゅ璁″憳鍗犳瘮 >50%銆? 杞棤 gap锛夛紝鍦ㄥ璁℃姤鍛婂紑澶存敞鏄庛€屾湭浣跨敤 code-reviewer 瀛愮被鍨嬶紝浣跨敤 general-purpose + 瀹¤ prompt銆嶃€?
**Requirements**:
```

### 2.3 鏇挎崲銆孲tep 3銆嶇姝㈤」锛堝缓璁?O8銆丱12锛?
**浣嶇疆**锛歚## Step 3: Main Agent prohibitions (reminder)` 鏁存銆?
**鏇挎崲涓?*锛?
```markdown
## Step 3: Main Agent prohibitions (reminder)

- **绂佹** 瀵逛互涓嬭矾寰勬垨鐩爣鎵ц `search_replace`銆乣write`銆乣edit`锛歚vnpy/`銆乣*datafeed*`銆乣*/engine.py`銆佷互鍙?TASKS/BUGFIX 鏂囨。涓垪涓哄疄鐜扮洰鏍囩殑浠讳綍璺緞锛涚姝㈢洿鎺ョ紪杈?`prd.{stem}.json` 涓?`progress.{stem}.txt`锛堢敱瀛愪唬鐞嗘寜 ralph-method 缁存姢锛夈€?- **绂佹** 鐢ㄤ富 Agent 鐩存帴瀹炵幇浠诲姟浠ユ浛浠?subagent锛涜嫢 subagent 杩斿洖涓嶅畬鏁达紝鍙兘閫氳繃 **Codex worker adapter resume** 鎴栧啀娆″彂璧锋柊鐨?Codex worker adapter 缁х画锛屼笉寰楄嚜琛屾敼浠ｇ爜銆?- **鍏佽** 涓?Agent 浠呯紪杈戣鏄庢€?鏂囨。绫绘枃浠讹紙濡?README銆佹湰 SKILL.md銆乤rtifact 鐩綍涓?.md锛夛紝浠ラ厤鍚堝璁＄粨璁烘垨璁板綍杩涘害銆?```

### 2.4 鏂板銆屼笌 ralph-method / speckit-workflow 鐨勮鎺ャ€嶏紙寤鸿 O5锛?
**浣嶇疆**锛歚## References` 涔嬪墠鎻掑叆鏂板皬鑺傘€?
**鎻掑叆鍐呭**锛?
```markdown
## 涓?ralph-method / speckit-workflow 鐨勮鎺?
- **Standalone 鐢ㄦ硶**锛氭湰鎶€鑳戒笉瑕佹眰鍏堝瓨鍦?speckit 浜у嚭鐨?tasks.md锛沀S 涓?prd 鏉ユ簮涓哄綋鍓?TASKS/BUGFIX 鏂囨。銆備笌 ralph-method 涓€宲rd 涓?tasks.md 涓€鑷淬€嶅苟瀛樻椂锛屼互鏈妧鑳界害瀹氫负鍑嗭細prd 涓?*褰撳墠鏂囨。**涓€鑷淬€?- **鏃?US 缁撴瀯鏃?*锛氳嫢鏂囨。浠呮湁鎵佸钩浠诲姟鍒楄〃锛屽瓙浠ｇ悊椤诲皢姣忔潯鍙獙鏀朵换鍔℃槧灏勪负 US-001銆乁S-002鈥︼紙鎴栭噰鐢ㄦ枃妗ｅ師鏈夌紪鍙凤級锛岀敓鎴愮鍚?ralph-method prd.json schema 鐨?prd锛屽苟淇濇寔 progress 涓?prd 鐨?id 涓€鑷淬€?- **鎶€鑳藉姞杞?*锛氬疄鏂藉瓙浠诲姟 prompt 涓凡瑕佹眰瀛愪唬鐞嗗厛璇诲彇 ralph-method 涓?speckit-workflow 鎶€鑳藉啀鎵ц锛岀‘淇?prd 缁撴瀯涓?TDD/楠屾敹绾︽潫涓€鑷淬€?```

### 2.5 鏂板銆岄敊璇笌杈圭晫澶勭悊銆嶏紙寤鸿 O11锛?
**浣嶇疆**锛歚## References` 涔嬪悗銆佹枃浠舵湯灏俱€?
**鎻掑叆鍐呭**锛?
```markdown
## 閿欒涓庤竟鐣屽鐞?
- **鏂囨。璺緞涓嶅瓨鍦?*锛氫富 Agent 瑙ｆ瀽鐢ㄦ埛杈撳叆寰楀埌璺緞鍚庯紝鑻ヨ璺緞涓嶅瓨鍦紝搴斿悜鐢ㄦ埛鎶ラ敊骞跺垪鍑哄凡瑙ｆ瀽璺緞锛屼笉鍙戣捣瀹炴柦瀛愪换鍔°€?- **瀛?agent 閿欒鎴栬秴鏃?*锛氳嫢鏈夎繑鍥炵殑 agent ID锛屼富 Agent 鍙彂璧蜂竴娆?**resume**锛涘惁鍒欓噸鏂板彂璧锋柊鐨?Codex worker adapter锛屽苟鍦?prompt 涓敞鏄庛€屼笂娆℃湭瀹屾垚锛岃浠庡悓鐩綍 progress 鏂囦欢鎴栦笅鍒楁柇鐐圭户缁€嶏紝涓嶆浛浠ｅ瓙 agent 鐩存帴鏀圭敓浜т唬鐮併€?- **涓?Agent 绂佹缂栬緫**锛歱rd.*.json銆乸rogress.*.txt 浠呯敱瀛愪唬鐞嗙淮鎶わ紱涓?Agent 涓嶅緱涓恒€岃ˉ鍐?progress銆嶇瓑鐞嗙敱鐩存帴缂栬緫涓婅堪鏂囦欢銆?```

---

## 涓夈€乸rompt-templates.md 鐨勫琛?
### 3.1 瀹炴柦妯℃澘棣栨澧炶ˉ锛堝缓璁?O3锛?
鍦ㄧ幇鏈夊疄鏂芥ā鏉裤€屼綘姝ｅ湪鎸?**TASKS/BUGFIX 鏂囨。**鈥︺€嶄箣鍓嶅鍔犱竴娈碉細

```markdown
**鍓嶇疆锛堝繀椤伙級**锛氳鍏堣鍙栧苟閬靛惊浠ヤ笅鎶€鑳藉啀鎵ц涓嬫柟浠诲姟锛?- **ralph-method**锛歱rd/progress 鍛藉悕瑙勫垯涓?schema锛堜笌褰撳墠鏂囨。鍚岀洰褰曘€乸rd.{stem}.json / progress.{stem}.txt锛夈€佹瘡瀹屾垚涓€ US 鏇存柊 prd 涓?progress銆?- **speckit-workflow**锛歍DD 绾㈢豢鐏€?5 鏉￠搧寰嬨€侀獙鏀跺懡浠ゃ€佹灦鏋勫繝瀹烇紱绂佹浼疄鐜颁笌鍗犱綅銆?鎶€鑳借矾寰勶細鍏ㄥ眬 skills 鐩綍涓嬬殑 ralph-method銆乻peckit-workflow銆?
---
```

### 3.2 鏃?US 缁撴瀯鏃剁殑 prd 鐢熸垚璇存槑锛堝缓璁?O4锛?
鍦?`prompt-templates.md` 涓€孖mplementation sub-task銆嶈妭鏈熬銆佷唬鐮佸潡涔嬪悗澧炲姞锛?
```markdown
#### 鏃?US 缁撴瀯鏃剁殑 prd 鐢熸垚

褰撴枃妗ｄ粎涓烘墎骞充换鍔″垪琛紙鏃?US-001 绛?id锛夋椂锛屽瓙浠ｇ悊椤伙細
1. 灏嗘枃妗ｄ腑姣忔潯鍙獙鏀朵换鍔′緷娆℃爣鍙蜂负 US-001銆乁S-002銆佲€︼紙鎴栦笌鏂囨。宸叉湁缂栧彿濡?T7a-1 涓€涓€鏄犲皠锛屽苟鍦?prd 鐨?userStories[].id 涓娇鐢ㄤ竴鑷?id锛夈€?2. 鐢熸垚绗﹀悎 ralph-method 鐨?prd.json锛堝惈 userStories銆乤cceptanceCriteria銆乸asses 绛夛級銆?3. progress 鏂囦欢涓褰曠殑瀹屾垚椤逛笌 prd 涓殑 id 涓€鑷淬€?4. 鑻ユ枃妗ｅ瓨鍦?搂7 绛夊甫缂栧彿浠诲姟鍒楄〃锛屼紭鍏堥噰鐢ㄨ缂栧彿浣滀负 US id 浠ヤ繚鎸佸彲杩芥函銆?```

### 3.3 Resume 涓撶敤 prompt锛堝缓璁?O10锛?
鍦?`prompt-templates.md` 涓柊澧炰竴鑺傦細

```markdown
---

## Resume 瀹炴柦瀛愪换鍔★紙general-purpose锛?
褰?Step 1 瀛愪换鍔℃湭鍦ㄤ竴娆¤皟鐢ㄥ唴瀹屾垚鏃讹紝涓?Agent 浣跨敤 **Codex worker adapter resume** 鎴栭噸鏂板彂璧?Codex worker adapter 鏃讹紝鍙紶鍏ヤ互涓嬫ā鏉匡紙濉啓鏂偣涓庢湰鎵硅寖鍥达級銆?
```
浣犳鍦?*鎺ョ画**鎵ц TASKS/BUGFIX 鏂囨。鐨勬湭瀹屾垚浠诲姟銆傝鍏堣鍙栧悓鐩綍涓嬬殑 progress 鏂囦欢纭宸插畬鎴愯寖鍥达紝鍐嶄粠鏈壒璧风偣寮€濮嬫墽琛屻€?
## 鏂囨。涓庤矾寰?- **TASKS/BUGFIX 鏂囨。璺緞**锛歿DOC_PATH}
- **涓婁竴鎵瑰凡瀹屾垚**锛歿宸插畬鎴愯寖鍥达紝濡?搂7 T7a-1锝濼7a-9}
- **鏈壒寰呮墽琛?*锛歿鏈壒鑼冨洿锛屽 搂7 T7b-1锝濼7b-10}

## 寮哄埗绾︽潫
锛堜笌銆孖mplementation sub-task銆嶄腑 1锝? 鏉＄浉鍚岋細ralph-method銆乀DD 绾㈢豢鐏€乻peckit-workflow銆侀獙鏀躲€傦級

璇蜂粠鏈壒寰呮墽琛岀殑绗竴椤瑰紑濮嬶紝閫愰」瀹炴柦骞舵洿鏂?prd/progress锛岃緭鍑猴細鏈壒宸插畬鎴愮殑 US/浠诲姟缂栧彿銆侀獙鏀跺懡浠よ繍琛岀粨鏋溿€佷互鍙婃洿鏂板悗鐨?prd/progress 鐘舵€佹憳瑕併€?```
```

### 3.4 瀹¤妯℃澘涓€屾壒鍒ゅ璁″憳銆嶅彲鎿嶄綔瀹氫箟锛堝缓璁?O6銆丱7锛?
鍦ㄥ璁℃ā鏉裤€?# 鎵瑰垽瀹¤鍛樸€嶆鏇挎崲涓猴細

```markdown
## 鎵瑰垽瀹¤鍛?浠庡鎶楄瑙掓鏌ワ細閬楁紡浠诲姟銆佽鍙锋垨璺緞澶辨晥銆侀獙鏀跺懡浠ゆ湭璺戙€乂5/楠屾敹璇激鎴栨紡缃戙€?**鍙搷浣滆姹?*锛氭姤鍛婇』鍖呭惈鐙珛娈佃惤銆?# 鎵瑰垽瀹¤鍛樼粨璁恒€嶏紝涓旇娈佃惤瀛楁暟鎴栨潯鐩暟涓嶅皯浜庢姤鍛婂叾浣欓儴鍒嗭紙鍗冲崰姣?>50%锛夛紱缁撹椤绘槑纭€屾湰杞棤鏂?gap銆嶆垨銆屾湰杞瓨鍦?gap銆嶅強鍏蜂綋椤广€?
## 杈撳嚭涓庢敹鏁?- 缁撹椤绘槑纭細**銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆?* 鎴?**銆屾湭閫氳繃銆?*锛堝苟鍒?gap 涓庝慨鏀瑰缓璁級銆?- **涓€杞?* = 涓€娆℃湰瀹¤瀛愪换鍔＄殑瀹屾暣璋冪敤銆傘€岃繛缁?3 杞棤 gap銆? 杩炵画 3 娆＄粨璁哄潎涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶄笖璇?3 娆℃姤鍛婁腑鎵瑰垽瀹¤鍛樼粨璁烘鍧囨敞鏄庛€屾湰杞棤鏂?gap銆嶏紱鑻ヤ换涓€杞负銆屾湭閫氳繃銆嶆垨銆屽瓨鍦?gap銆嶏紝鍒欎粠涓嬩竴杞噸鏂拌鏁般€?- 鑻ラ€氳繃涓旀壒鍒ゅ璁″憳鏃犳柊 gap锛氭敞鏄庛€屾湰杞棤鏂?gap锛岀 N 杞紱寤鸿绱鑷?3 杞棤 gap 鍚庢敹鏁涖€嶃€?- 鑻ユ湭閫氳繃锛氭敞鏄庛€屾湰杞瓨鍦?gap锛屼笉璁℃暟銆嶏紝淇鍚庡啀娆″彂璧锋湰瀹¤锛岀洿鑷宠繛缁?3 杞棤 gap 鏀舵暃銆?```

---

## 鍥涖€佸皬缁?
- **浼樺寲寤鸿**锛氬叡 13 鏉★紝瑕嗙洊瑙﹀彂涓庤緭鍏ャ€乸rd/US 鏄犲皠銆佸瓙浠ｇ悊鎶€鑳藉姞杞姐€佸璁″彲鎿嶄綔瀹氫箟銆佸崰浣嶇涓?resume銆侀敊璇笌杈圭晫銆乧ode-reviewer 鍥為€€绛栫暐銆?- **SKILL.md**锛? 澶勬浛鎹?鏂板锛堝彲閫夎緭鍏ヤ笌澶氭枃妗ｃ€丼tep 2 璋冪敤绛栫暐銆丼tep 3 绂佹椤广€佽鎺ヨ鏄庛€侀敊璇笌杈圭晫锛夈€?- **prompt-templates.md**锛? 澶勫琛ワ紙瀹炴柦鍓嶇疆鎶€鑳姐€佹棤 US 缁撴瀯 prd 璇存槑銆丷esume 妯℃澘銆佸璁℃壒鍒ゅ璁″憳涓?3 杞畾涔夛級銆?
涓?Agent 鍙洿鎺ユ寜涓婅堪缂栧彿涓庝綅缃慨鏀规妧鑳戒笌妯℃澘锛屾棤闇€鍐嶈窇 100 杞京璁猴紱鑻ラ渶涓庣幇鏈?bmad-bug-assistant / bmad-story-assistant 鐨勫璁＄害瀹氱粺涓€锛屽彲鍐嶅皢銆宎udit-prompts 搂5銆嶇殑寮曠敤璺緞涓?code-reviewer 浼樺厛绛栫暐涓庡郊澶勫榻愩€?
