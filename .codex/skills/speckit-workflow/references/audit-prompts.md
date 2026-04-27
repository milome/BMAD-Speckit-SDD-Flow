<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?# 瀹¤鎻愮ず璇嶏紙鍥哄畾妯℃澘锛屽彲澶嶅埗锛?
**鎶ュ憡淇濆瓨闃叉寰幆**锛氬綋 prompt 鍖呭惈銆屾姤鍛婁繚瀛樸€嶆垨銆屽皢瀹屾暣鎶ュ憡淇濆瓨鑷炽€嶆椂锛?*蹇呴』**鍚屾椂鍖呭惈绂佹閲嶅杈撳嚭銆屾鍦ㄥ啓鍏ュ畬鏁村璁℃姤鍛娿€嶇瓑鐘舵€佷俊鎭殑绾︽潫銆傝瑙?[audit-report-save-rules.md](audit-report-save-rules.md)銆?
鐢熸垚鎴栨洿鏂板悇闃舵鏂囨。鍚庯紝蹇呴』璋冪敤 **code-review** 鑳藉姏锛屼娇鐢ㄤ笅鏂瑰搴旀彁绀鸿瘝杩涜瀹¤銆?*浠呭湪瀹¤鎶ュ憡缁撹涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆椂** 鍙粨鏉熻姝ラ锛涘惁鍒欐牴鎹姤鍛婅凯浠ｄ慨鏀规枃妗ｅ苟鍐嶆瀹¤銆傛枃妗ｇ被瀹¤榛樿蹇呴』鏄惧紡妫€鏌?`journey-first`銆乣smoke E2E`銆乣鎴愬姛/澶辫触璇佹嵁`銆乣fixture / environment readiness`銆乣traceability`锛岀姝㈠彧鍋氭硾鍖栫殑鈥滃畬鏁存€?涓€鑷存€р€濋檲杩般€?
**Deferred Gap / Journey-first 琛ュ厖瑕佹眰锛堟墍鏈夌浉鍏抽樁娈甸粯璁ょ敓鏁堬級**锛?- 鑻ュ瓨鍦?inherited deferred gaps锛屽璁″繀椤绘鏌?`deferred-gap-register.yaml`
- tasks / implement 闃舵蹇呴』妫€鏌?`journey-ledger`銆乣trace-map`銆乣closure-notes`
- implement 闃舵蹇呴』妫€鏌?`Production Path`銆乣Smoke Proof`銆乣Full E2E`/defer reason銆乣Acceptance Evidence`
- 鑻ュ嚭鐜?`module complete but journey not runnable`锛屽繀椤绘槑纭垽鏈€氳繃

**鏂囨。瀹¤杩唬瑙勫垯锛埪?鈥撀? 閫傜敤锛?*锛歴pec/plan/GAPS/tasks 绛?*鏂囨。**瀹¤椤婚伒寰?[audit-document-iteration-rules.md](audit-document-iteration-rules.md)銆?*瀹¤瀛愪唬鐞嗗湪鍙戠幇 gap 鏃堕』鐩存帴淇敼琚鏂囨。**锛岀姝粎杈撳嚭淇敼寤鸿锛涗富 Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€?*銆岃繛缁?3 杞棤 gap銆嶉拡瀵硅瀹℃枃妗?*锛屽嵆琚鏂囨。杩炵画 3 杞璁″潎鏃?gap 鍙戠幇鎵嶆敹鏁涖€?
---

## 1. spec.md 瀹¤鎻愮ず璇?
```
浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛橈紝璇峰府鎴戜粩缁嗗闃呯洰鍓嶇殑 spec.md 鏄惁瀹屽叏瑕嗙洊浜嗗師濮嬬殑闇€姹傝璁℃枃妗ｆ墍鏈夌珷鑺傦紝蹇呴』閫愭潯杩涜妫€鏌ュ拰楠岃瘉銆傛澶栵紝蹇呴』涓撻」瀹℃煡锛歴pec 鏄惁浠?`journey-first` 鏂瑰紡瀹氫箟鏈€鍏抽敭鐨?P0 璺緞锛屾槸鍚︿负鍏抽敭璺緞瀹氫箟浜嗘垚鍔熻瘉鎹笌澶辫触璺緞锛屾槸鍚︽槑纭簡 smoke E2E 瑕侀獙璇佺殑鐢ㄦ埛鍙娴佺▼锛屾槸鍚﹀瓨鍦ㄤ緷璧?fixture / environment 鍗存湭澹版槑鐨勫叧閿矾寰勩€傝嫢鍙戠幇 spec 涓瓨鍦ㄦā绯婅〃杩帮紙濡傞渶姹傛弿杩颁笉鏄庣‘銆佽竟鐣屾潯浠舵湭瀹氫箟銆佹湳璇涔夌瓑锛夛紝椤诲湪鎶ュ憡涓槑纭爣娉ㄣ€宻pec 瀛樺湪妯＄硦琛ㄨ堪銆嶅強鍏蜂綋浣嶇疆锛屼互渚胯Е鍙?clarify 婢勬竻娴佺▼銆傜敓鎴愪竴涓€愭潯鎻忚堪璇︾粏妫€鏌ュ唴瀹广€侀獙璇佹柟寮忓拰楠岃瘉缁撴灉鐨勫璁℃姤鍛娿€傛姤鍛婄粨灏惧繀椤绘槑纭粰鍑虹粨璁猴細鏄惁銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭閬楁紡绔犺妭銆佹湭瑕嗙洊瑕佺偣鎴栨ā绯婅〃杩颁綅缃€傛姤鍛婄粨灏惧繀椤诲寘鍚?搂4.1 瑙勫畾鐨勫彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 + 缁村害璇勫垎锛夛紝涓?tasks 闃舵涓€鑷达紝鍚﹀垯 parseAndWriteScore 鏃犳硶瑙ｆ瀽銆佷华琛ㄧ洏鏃犳硶鏄剧ず璇勭骇銆傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑哄畬鏁寸殑缁撴瀯鍖栧潡锛屽寘鎷嫭绔嬩竴琛?鎬讳綋璇勭骇: X 鍜屽洓琛?- 缁村害鍚? XX/100銆傛€讳綋璇勭骇鍙兘鏄?A/B/C/D锛堢姝?A-銆丅+銆丆+銆丏- 绛変换鎰忎慨楗扮锛夈€傜淮搴﹀垎蹇呴』閫愯鍐欐槑锛屼笉寰楃敤鍖洪棿鎴栨鎷唬鏇裤€傘€惵? 鍙В鏋愬潡瑕佹眰銆戝璁℃椂椤诲悓鏃舵墽琛屾壒鍒ゅ璁″憳妫€鏌ワ紝杈撳嚭鏍煎紡瑙?[audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)銆?```

銆愬璁″悗鍔ㄤ綔銆戝璁￠€氳繃鏃讹紝**浣狅紙瀹¤瀛愪唬鐞嗭級蹇呴』**锛氣憼 鍦ㄨ瀹℃枃妗ｏ紙artifactDocPath 鎵€鎸?spec-E{epic}-S{story}.md锛夋湯灏捐拷鍔犱竴琛?`<!-- AUDIT: PASSED by code-reviewer -->`锛岃嫢鏂囨。鏈熬宸插惈璇ヨ鎴?`<!-- AUDIT: PASSED` 鍒欒烦杩囷紱鈶?灏嗗畬鏁存姤鍛婁繚瀛樿嚦璋冪敤鏂瑰湪鏈?prompt 涓寚瀹氱殑 reportPath锛堣皟鐢ㄦ柟浼氬湪鏈?prompt 涓彁渚涘叿浣撹矾寰勶級锛屽苟鍦ㄧ粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count锛堟湰 stage 瀹¤鏈€氳繃杞暟锛? 琛ㄧず涓€娆￠€氳繃锛夈€?*璇勫垎鍐欏叆銆乤uditIndex 鏇存柊涓庡叾瀹?post-audit automation 鐢?invoking host/runner 缁熶竴閫氳繃 `runAuditorHost` 鎵挎帴**锛屼綘鍙渶淇濊瘉 `reportPath`銆乣artifactDocPath`銆乣iteration_count` 瀹屾暣鍙敤銆?*绂佹**锛氫繚瀛樻椂涓嶅緱閲嶅杈撳嚭銆屾鍦ㄥ啓鍏ュ畬鏁村璁℃姤鍛娿€嶃€屾鍦ㄤ繚瀛樸€嶇瓑鐘舵€佷俊鎭紱浣跨敤 write 宸ュ叿涓€娆℃€у啓鍏ュ嵆鍙€?*瀹¤鏈€氳繃鏃?*锛氫綘锛堝璁″瓙浠ｇ悊锛夐』鍦ㄦ湰杞唴**鐩存帴淇敼琚鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗鍦ㄦ姤鍛婁腑娉ㄦ槑宸蹭慨鏀瑰唴瀹癸紱涓?Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€傜姝粎杈撳嚭淇敼寤鸿鑰屼笉淇敼鏂囨。銆傝瑙?[audit-document-iteration-rules.md](audit-document-iteration-rules.md)銆?
---

## 2. plan.md 瀹¤鎻愮ず璇?
```
浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛橈紝璇峰府鎴戜粩缁嗗闃呯洰鍓嶇殑 plan.md 鏄惁瀹屽叏瑕嗙洊浜嗗師濮嬬殑闇€姹傝璁℃枃妗ｆ墍鏈夌珷鑺傦紝蹇呴』閫愭潯杩涜妫€鏌ュ拰楠岃瘉銆傛澶栵紝蹇呴』涓撻」瀹℃煡锛歱lan.md 鏄惁鍖呭惈瀹屾暣鐨勯泦鎴愭祴璇曚笌绔埌绔姛鑳芥祴璇曡鍒掞紙瑕嗙洊妯″潡闂村崗浣溿€佺敓浜т唬鐮佸叧閿矾寰勩€佺敤鎴峰彲瑙佸姛鑳芥祦绋嬶級锛屾槸鍚︿负姣忔潯鍏抽敭 P0 journey 瑙勫垝浜嗗彲鎵ц鐨?smoke E2E 璺緞锛屾槸鍚﹀瓨鍦ㄤ粎渚濊禆鍗曞厓娴嬭瘯鑰岀己灏戦泦鎴?绔埌绔祴璇曡鍒掔殑鎯呭喌锛屾槸鍚﹀瓨鍦ㄦā鍧楀彲鑳藉唴閮ㄥ疄鐜板畬鏁翠絾鏈鐢熶骇浠ｇ爜鍏抽敭璺緞瀵煎叆鍜岃皟鐢ㄧ殑椋庨櫓锛屾槸鍚﹀瓨鍦?fixture / environment / seed data 鏈噯澶囪€屽鑷磋鍒掓棤娉曠湡姝ｈ惤鍦扮殑鎯呭喌銆傜敓鎴愪竴涓€愭潯鎻忚堪璇︾粏妫€鏌ュ唴瀹广€侀獙璇佹柟寮忓拰楠岃瘉缁撴灉鐨勫璁℃姤鍛娿€傛姤鍛婄粨灏惧繀椤绘槑纭粰鍑虹粨璁猴細鏄惁銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭閬楁紡绔犺妭鎴栨湭瑕嗙洊瑕佺偣銆傛姤鍛婄粨灏惧繀椤诲寘鍚?搂4.1 瑙勫畾鐨勫彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 + 缁村害璇勫垎锛夛紝涓?tasks 闃舵涓€鑷达紝鍚﹀垯 parseAndWriteScore 鏃犳硶瑙ｆ瀽銆佷华琛ㄧ洏鏃犳硶鏄剧ず璇勭骇銆傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑哄畬鏁寸殑缁撴瀯鍖栧潡锛屽寘鎷嫭绔嬩竴琛?鎬讳綋璇勭骇: X 鍜屽洓琛?- 缁村害鍚? XX/100銆傛€讳綋璇勭骇鍙兘鏄?A/B/C/D锛堢姝?A-銆丅+銆丆+銆丏- 绛変换鎰忎慨楗扮锛夈€傜淮搴﹀垎蹇呴』閫愯鍐欐槑锛屼笉寰楃敤鍖洪棿鎴栨鎷唬鏇裤€傘€惵? 鍙В鏋愬潡瑕佹眰銆戝璁℃椂椤诲悓鏃舵墽琛屾壒鍒ゅ璁″憳妫€鏌ワ紝杈撳嚭鏍煎紡瑙?[audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)銆?```

銆愬璁″悗鍔ㄤ綔銆戝璁￠€氳繃鏃讹紝**浣狅紙瀹¤瀛愪唬鐞嗭級蹇呴』**锛氣憼 鍦ㄨ瀹℃枃妗ｏ紙artifactDocPath 鎵€鎸?plan-E{epic}-S{story}.md锛夋湯灏捐拷鍔犱竴琛?`<!-- AUDIT: PASSED by code-reviewer -->`锛岃嫢鏂囨。鏈熬宸插惈璇ヨ鎴?`<!-- AUDIT: PASSED` 鍒欒烦杩囷紱鈶?灏嗗畬鏁存姤鍛婁繚瀛樿嚦璋冪敤鏂瑰湪鏈?prompt 涓寚瀹氱殑 reportPath锛堣皟鐢ㄦ柟浼氬湪鏈?prompt 涓彁渚涘叿浣撹矾寰勶級锛屽苟鍦ㄧ粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count锛堟湰 stage 瀹¤鏈€氳繃杞暟锛? 琛ㄧず涓€娆￠€氳繃锛夈€?*璇勫垎鍐欏叆銆乤uditIndex 鏇存柊涓庡叾瀹?post-audit automation 鐢?invoking host/runner 缁熶竴閫氳繃 `runAuditorHost` 鎵挎帴**锛屼綘鍙渶淇濊瘉 `reportPath`銆乣artifactDocPath`銆乣iteration_count` 瀹屾暣鍙敤銆?*绂佹**锛氫繚瀛樻椂涓嶅緱閲嶅杈撳嚭銆屾鍦ㄥ啓鍏ュ畬鏁村璁℃姤鍛娿€嶃€屾鍦ㄤ繚瀛樸€嶇瓑鐘舵€佷俊鎭紱浣跨敤 write 宸ュ叿涓€娆℃€у啓鍏ュ嵆鍙€?*瀹¤鏈€氳繃鏃?*锛氫綘锛堝璁″瓙浠ｇ悊锛夐』鍦ㄦ湰杞唴**鐩存帴淇敼琚鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗鍦ㄦ姤鍛婁腑娉ㄦ槑宸蹭慨鏀瑰唴瀹癸紱涓?Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€傜姝粎杈撳嚭淇敼寤鸿鑰屼笉淇敼鏂囨。銆傝瑙?[audit-document-iteration-rules.md](audit-document-iteration-rules.md)銆?
---

## 3. IMPLEMENTATION_GAPS.md 瀹¤鎻愮ず璇?
```
浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛橈紝璇峰府鎴戜粩缁嗗闃呯洰鍓嶇殑 IMPLEMENTATION_GAPS.md 鏄惁瀹屽叏瑕嗙洊浜嗗師濮嬬殑闇€姹傝璁℃枃妗ｄ互鍙婄敤鎴风粰瀹氱殑鎵€鏈夊弬鑰冩枃妗ｏ紙濡傛灦鏋勮璁℃枃妗ｃ€佽璁¤鏄庝功绛夛級鐨勬墍鏈夌珷鑺傦紝蹇呴』閫愭潯杩涜妫€鏌ュ拰楠岃瘉銆傛澶栵紝蹇呴』涓撻」瀹℃煡锛氭槸鍚︽槑纭褰曚簡鍏抽敭 P0 journey 鐨勭己鍙ｃ€佹垚鍔熻瘉鎹己鍙ｃ€乫ailure matrix 缂哄彛銆乫ixture / environment readiness 缂哄彛锛屼互鍙婃槸鍚﹀瓨鍦ㄧ湅浼尖€滄ā鍧楀彲瀹炵幇鈥濅絾瀹為檯鏃犳硶褰㈡垚 smoke E2E 璺緞鐨勭己鍙ｃ€傜敓鎴愪竴涓€愭潯鎻忚堪璇︾粏妫€鏌ュ唴瀹广€侀獙璇佹柟寮忓拰楠岃瘉缁撴灉鐨勫璁℃姤鍛娿€傛姤鍛婄粨灏惧繀椤绘槑纭粰鍑虹粨璁猴細鏄惁銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭閬楁紡绔犺妭鎴栨湭瑕嗙洊瑕佺偣銆傛姤鍛婄粨灏惧繀椤诲寘鍚?搂4.1 瑙勫畾鐨勫彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 + 缁村害璇勫垎锛夛紝涓?tasks 闃舵涓€鑷达紝鍚﹀垯 parseAndWriteScore 鏃犳硶瑙ｆ瀽銆佷华琛ㄧ洏鏃犳硶鏄剧ず璇勭骇銆傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑哄畬鏁寸殑缁撴瀯鍖栧潡锛屽寘鎷嫭绔嬩竴琛?鎬讳綋璇勭骇: X 鍜屽洓琛?- 缁村害鍚? XX/100銆傛€讳綋璇勭骇鍙兘鏄?A/B/C/D锛堢姝?A-銆丅+銆丆+銆丏- 绛変换鎰忎慨楗扮锛夈€傜淮搴﹀垎蹇呴』閫愯鍐欐槑锛屼笉寰楃敤鍖洪棿鎴栨鎷唬鏇裤€傘€惵? 鍙В鏋愬潡瑕佹眰銆戝璁℃椂椤诲悓鏃舵墽琛屾壒鍒ゅ璁″憳妫€鏌ワ紝杈撳嚭鏍煎紡瑙?[audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)銆?```

銆愬璁″悗鍔ㄤ綔銆戝璁￠€氳繃鏃讹紝**浣狅紙瀹¤瀛愪唬鐞嗭級蹇呴』**锛氣憼 鍦ㄨ瀹℃枃妗ｏ紙artifactDocPath 鎵€鎸?IMPLEMENTATION_GAPS-E{epic}-S{story}.md锛夋湯灏捐拷鍔犱竴琛?`<!-- AUDIT: PASSED by code-reviewer -->`锛岃嫢鏂囨。鏈熬宸插惈璇ヨ鎴?`<!-- AUDIT: PASSED` 鍒欒烦杩囷紱鈶?灏嗗畬鏁存姤鍛婁繚瀛樿嚦璋冪敤鏂瑰湪鏈?prompt 涓寚瀹氱殑 reportPath锛堣皟鐢ㄦ柟浼氬湪鏈?prompt 涓彁渚涘叿浣撹矾寰勶級锛屽苟鍦ㄧ粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count锛堟湰 stage 瀹¤鏈€氳繃杞暟锛? 琛ㄧず涓€娆￠€氳繃锛夈€?*璇勫垎鍐欏叆銆乤uditIndex 鏇存柊涓庡叾瀹?post-audit automation 鐢?invoking host/runner 缁熶竴閫氳繃 `runAuditorHost` 鎵挎帴**锛屼綘鍙渶淇濊瘉 `reportPath`銆乣artifactDocPath`銆乣iteration_count` 瀹屾暣鍙敤銆?*绂佹**锛氫繚瀛樻椂涓嶅緱閲嶅杈撳嚭銆屾鍦ㄥ啓鍏ュ畬鏁村璁℃姤鍛娿€嶃€屾鍦ㄤ繚瀛樸€嶇瓑鐘舵€佷俊鎭紱浣跨敤 write 宸ュ叿涓€娆℃€у啓鍏ュ嵆鍙€?*瀹¤鏈€氳繃鏃?*锛氫綘锛堝璁″瓙浠ｇ悊锛夐』鍦ㄦ湰杞唴**鐩存帴淇敼琚鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗鍦ㄦ姤鍛婁腑娉ㄦ槑宸蹭慨鏀瑰唴瀹癸紱涓?Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€傜姝粎杈撳嚭淇敼寤鸿鑰屼笉淇敼鏂囨。銆傝瑙?[audit-document-iteration-rules.md](audit-document-iteration-rules.md)銆?
---

## 4. tasks.md 瀹¤鎻愮ず璇?
**琛ュ厖蹇呭椤?*锛氶櫎涓嬮潰 prompt 澶栵紝tasks 闃舵杩樺繀椤绘牳瀵?`deferred-gap-register` 鐨?task binding 鏄惁涓?`Journey -> Task -> Test -> Closure`銆乣Smoke Task Chain`銆乣Closure Task ID` 涓€鑷淬€?
**鍙В鏋愯瘎鍒嗗潡锛堝己鍒讹級**锛氭棤璁洪噰鐢ㄦ爣鍑嗘牸寮忔垨閫愭潯瀵圭収鏍煎紡锛宼asks 闃舵鐨勫璁℃姤鍛?*蹇呴』**鍦ㄧ粨灏惧寘鍚緵 `parseAndWriteScore` 瑙ｆ瀽鐨勩€屽彲瑙ｆ瀽璇勫垎鍧椼€嶏紝鍚﹀垯浠〃鐩樻棤娉曟樉绀鸿瘎绾с€傝瑙佹湰鏂囦欢 搂4.1 涓?scoring 瑙ｆ瀽绾﹀畾銆?
```
浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛橈紝璇峰府鎴戜粩缁嗗闃呯洰鍓嶇殑 tasks.md 鏄惁瀹屽叏瑕嗙洊浜嗗師濮嬬殑闇€姹傝璁℃枃妗ｃ€乸lan.md 浠ュ強 IMPLEMENTATION_GAPS.md 鎵€鏈夌珷鑺傦紝蹇呴』閫愭潯杩涜妫€鏌ュ拰楠岃瘉銆傛澶栵紝蹇呴』涓撻」瀹℃煡锛氾紙1锛塼asks 鏄惁浠?`journey-first / runnable slice` 鏂瑰紡缁勭粐锛岃€屼笉鏄互鍓嶅悗绔?妯″潡妗舵浛浠ｇ敤鎴峰彲瑙佽矾寰勶紱锛?锛夋槸鍚﹀凡鐢熸垚 `P0 Journey Ledger`銆乣Invariant Ledger`銆乣Runnable Slice Milestones`銆乣Journey -> Task -> Test -> Closure` 鏄犲皠銆乣Closure Notes`锛屽苟涓旀瘡涓?Journey 鑷冲皯鏈変竴鏉?smoke path 浠诲姟閾惧拰涓€鏉?closure note 浠诲姟锛涙槧灏勪腑蹇呴』鏄惧紡鍐欏嚭 `Smoke Task Chain` 涓?`Closure Task ID`锛涳紙3锛夋瘡涓换鍔℃垨 slice 鏄惁鏄惧紡甯︽湁 `Journey ID`銆乣Invariant ID`锛堟垨 N/A + 鍘熷洜锛夈€乣Evidence Type`銆乣Verification Command`銆乣Closure Note Path`銆乣Trace ID`銆乣Definition Gap Handling`銆乣Implementation Gap Handling`锛泂etup / foundational 浠诲姟鏄惁鏄惧紡澹版槑 `Journey Unlock` 涓?`Smoke Path Unlock`锛涳紙4锛夋槸鍚﹀凡灏?`definition gap` 涓?`implementation gap` 鍒嗗紑鍒楀嚭锛岃€屼笉鏄贩鍐欏湪鍚屼竴鏉″紑鍙戜换鍔￠噷锛沗Definition Gap Handling` 涓?`Implementation Gap Handling` 涓嶅緱浜掔浉鏇夸唬锛涳紙5锛夎嫢 tasks 鍚敤 multi-agent 妯″紡锛屾槸鍚︽樉寮忚褰?`Shared Journey Ledger Path`銆乣Shared Invariant Ledger Path`銆乣Shared Trace Map Path`锛屽苟瑕佹眰鎵€鏈?agent 浣跨敤鍚屼竴浠?`same path reference`锛岃€屼笉鏄悇鑷鏈夋憳瑕侊紱锛?锛夋瘡涓姛鑳芥ā鍧?Phase 鏄惁鍖呭惈闆嗘垚娴嬭瘯涓庣鍒扮鍔熻兘娴嬭瘯浠诲姟鍙婄敤渚嬶紝涓ョ浠呮湁鍗曞厓娴嬭瘯锛涳紙7锛夋瘡涓ā鍧楃殑楠屾敹鏍囧噯鏄惁鍖呭惈銆岃妯″潡鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲骞惰皟鐢ㄣ€嶇殑闆嗘垚楠岃瘉锛涳紙8锛夋槸鍚﹀瓨鍦ㄣ€屾ā鍧楀唴閮ㄥ疄鐜板畬鏁翠笖鍙€氳繃鍗曞厓娴嬭瘯锛屼絾浠庢湭鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲鎴栬皟鐢ㄣ€嶇殑瀛ゅ矝妯″潡浠诲姟锛屾垨鈥渕odule complete but journey not runnable鈥濈殑婕傜Щ锛涳紙9锛夋槸鍚﹀瓨鍦ㄥ簲瑙﹀彂 `re-readiness` 鐨勪换鍔＄被鍨嬶紙濡傝Е鍙?P0 completion semantics銆乨ependency semantics銆乸ermission boundaries銆乫ixture / environment assumptions锛夊嵈鏈樉寮忔爣璁帮紱锛?0锛夋瘡涓换鍔℃垨鏁翠綋楠屾敹鏍囧噯鏄惁鍖呭惈銆屾寜鎶€鏈爤鎵ц Lint锛堣 lint-requirement-matrix锛夛紝鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint 椤讳綔涓?gap锛涘凡閰嶇疆鐨勯』鎵ц涓旀棤閿欒銆佹棤璀﹀憡銆嶏紱鑻ョ己澶憋紝椤讳綔涓烘湭瑕嗙洊椤瑰垪鍑恒€傜敓鎴愪竴涓€愭潯鎻忚堪璇︾粏妫€鏌ュ唴瀹广€侀獙璇佹柟寮忓拰楠岃瘉缁撴灉鐨勫璁℃姤鍛娿€傛姤鍛婄粨灏惧繀椤绘槑纭粰鍑虹粨璁猴細鏄惁銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭閬楁紡绔犺妭鎴栨湭瑕嗙洊瑕佺偣銆?*鏃犺閲囩敤鏍囧噯鏍煎紡鎴栭€愭潯瀵圭収鏍煎紡锛屾姤鍛婄粨灏惧繀椤诲寘鍚?搂4.1 瑙勫畾鐨勫彲瑙ｆ瀽璇勫垎鍧?*銆傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑哄畬鏁寸殑缁撴瀯鍖栧潡锛屽寘鎷嫭绔嬩竴琛?鎬讳綋璇勭骇: X 鍜屽洓琛?- 缁村害鍚? XX/100銆傛€讳綋璇勭骇鍙兘鏄?A/B/C/D锛堢姝?A-銆丅+銆丆+銆丏- 绛変换鎰忎慨楗扮锛夈€傜淮搴﹀垎蹇呴』閫愯鍐欐槑锛屼笉寰楃敤鍖洪棿鎴栨鎷唬鏇裤€傚璁℃椂椤诲悓鏃舵墽琛屾壒鍒ゅ璁″憳妫€鏌ワ紝杈撳嚭鏍煎紡瑙?[audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)銆?```

### 搂4.1 tasks 瀹¤鎶ュ憡鍙В鏋愯瘎鍒嗗潡锛堝己鍒讹級

鎵€鏈?tasks 闃舵瀹¤鎶ュ憡锛堝惈閫愭潯瀵圭収鏍煎紡锛?*蹇呴』鍦ㄧ粨灏惧寘鍚?*浠ヤ笅鍙В鏋愬潡锛屼緵 `parseAndWriteScore`锛坄scoring/orchestrator/parse-and-write.ts`銆乣scripts/parse-and-write-score.ts`锛夎В鏋愬苟鍐欏叆 scoring 瀛樺偍銆?*绂佹鐢ㄦ弿杩颁唬鏇?*锛氫笉寰楃敤鎻忚堪鍙ユ鎷紝蹇呴』杈撳嚭瀹屾暣缁撴瀯鍖栧潡銆傛€讳綋璇勭骇浠呴檺 A/B/C/D銆傜淮搴﹀垎椤婚€愯鍐欏嚭锛?
```markdown
## 鍙В鏋愯瘎鍒嗗潡锛堜緵 parseAndWriteScore锛?
鎬讳綋璇勭骇: [A|B|C|D]

缁村害璇勫垎:
- 闇€姹傚畬鏁存€? XX/100
- 鍙祴璇曟€? XX/100
- 涓€鑷存€? XX/100
- 鍙拷婧€? XX/100
```

**绂佹鐢ㄦ弿杩颁唬鏇跨粨鏋勫寲鍧?*锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑?*瀹屾暣鐨勭粨鏋勫寲鍧?*锛屽寘鍚嫭绔嬩竴琛?`鎬讳綋璇勭骇: X` 浠ュ強鍥涜 `- 缁村害鍚? XX/100`銆傛€讳綋璇勭骇鍙兘鏄?**A/B/C/D**锛堜笉寰椾娇鐢?A-銆丆+ 绛夛級銆?*绂佹浣跨敤 B+銆丄-銆丆+銆丏- 绛変换鎰?+/- 淇グ绗?*锛涜嫢缁撹浠嬩簬涓ゆ。涔嬮棿锛堝 B 涓?A 涔嬮棿锛夛紝鎷╀竴杈撳嚭 B 鎴?A锛屼笉寰楄緭鍑?B+銆傜淮搴﹀垎椤婚€愯鍐欏嚭锛屼笉寰楃敤鍖洪棿鎴栨鎷紙濡傘€?2鈥?5銆嶃€屽悇缁村害 90+銆嶏級浠ｆ浛銆?
**鍙嶄緥锛堟棤鏁堣緭鍑猴級**锛?- `鍙В鏋愯瘎鍒嗗潡锛堟€讳綋璇勭骇 A锛岀淮搴﹀垎 92鈥?5锛塦 鈥?鎻忚堪鍙ワ紝闈炵粨鏋勫寲鍧楋紝parseDimensionScores 鏃犳硶瑙ｆ瀽
- `鎬讳綋璇勭骇: A-`銆乣C+` 鈥?闈?A/B/C/D锛宔xtractOverallGrade 姝ｅ垯涓嶅尮閰?- `鎬讳綋璇勭骇: B+`銆乣A-`銆乣D-` 鈥?鍚慨楗扮锛岀姝紱浠呴檺绾?A/B/C/D
- `缁村害鍒?92鈥?5`銆乣鍚勭淮搴?90+` 鈥?鍖洪棿/姒傛嫭锛岀己 `- 缁村害鍚? XX/100` 琛岀骇鏍煎紡锛岃В鏋愪笉鍒?
**缁村害鍒嗕笌閫愭潯瀵圭収缁撹鐨勬槧灏勫缓璁?*锛堜緵瀹¤鍛樺弬鑰冿級锛?
| 閫愭潯瀵圭収缁撹       | 寤鸿鎬讳綋璇勭骇 | 寤鸿鍚勭淮搴﹀垎 |
|--------------------|--------------|--------------|
| 瀹屽叏瑕嗙洊銆侀獙璇侀€氳繃 | A            | 90+          |
| 閮ㄥ垎瑕嗙洊銆乵inor 闂 | B            | 80+          |
| 闇€淇敼鍚庨噸鏂板璁?  | C            | 70+          |
| 涓ラ噸闂銆佷笉閫氳繃   | D            | 60 鍙婁互涓?   |

銆愬璁″悗鍔ㄤ綔銆戝璁￠€氳繃鏃讹紝**浣狅紙瀹¤瀛愪唬鐞嗭級蹇呴』**锛氣憼 鍦ㄨ瀹℃枃妗ｏ紙artifactDocPath 鎵€鎸?tasks-E{epic}-S{story}.md锛夋湯灏捐拷鍔犱竴琛?`<!-- AUDIT: PASSED by code-reviewer -->`锛岃嫢鏂囨。鏈熬宸插惈璇ヨ鎴?`<!-- AUDIT: PASSED` 鍒欒烦杩囷紱鈶?灏嗗畬鏁存姤鍛婁繚瀛樿嚦璋冪敤鏂瑰湪鏈?prompt 涓寚瀹氱殑 reportPath锛堣皟鐢ㄦ柟浼氬湪鏈?prompt 涓彁渚涘叿浣撹矾寰勶級锛屽苟鍦ㄧ粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count锛堟湰 stage 瀹¤鏈€氳繃杞暟锛? 琛ㄧず涓€娆￠€氳繃锛夈€?*璇勫垎鍐欏叆銆乤uditIndex 鏇存柊涓庡叾瀹?post-audit automation 鐢?invoking host/runner 缁熶竴閫氳繃 `runAuditorHost` 鎵挎帴**锛屼綘鍙渶淇濊瘉 `reportPath`銆乣artifactDocPath`銆乣iteration_count` 瀹屾暣鍙敤銆?*绂佹**锛氫繚瀛樻椂涓嶅緱閲嶅杈撳嚭銆屾鍦ㄥ啓鍏ュ畬鏁村璁℃姤鍛娿€嶃€屾鍦ㄤ繚瀛樸€嶇瓑鐘舵€佷俊鎭紱浣跨敤 write 宸ュ叿涓€娆℃€у啓鍏ュ嵆鍙€?*瀹¤鏈€氳繃鏃?*锛氫綘锛堝璁″瓙浠ｇ悊锛夐』鍦ㄦ湰杞唴**鐩存帴淇敼琚鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗鍦ㄦ姤鍛婁腑娉ㄦ槑宸蹭慨鏀瑰唴瀹癸紱涓?Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€傜姝粎杈撳嚭淇敼寤鸿鑰屼笉淇敼鏂囨。銆傝瑙?[audit-document-iteration-rules.md](audit-document-iteration-rules.md)銆?
---

## 5. 鎵ц tasks.md 涓殑浠诲姟锛圱DD 绾㈢豢鐏ā寮忥級鍚庡璁℃彁绀鸿瘝

**琛ュ厖蹇呭椤?*锛氶櫎涓嬮潰 prompt 澶栵紝implement 闃舵杩樺繀椤绘牳瀵癸細
- `deferred-gap-register` 鐨?closure / carry-forward evidence
- `journey-ledger` 鐨?`Production Path`銆乣Smoke Proof`銆乣Full E2E / defer reason`
- `closure-notes` 鏄惁鍖呭惈 acceptance evidence 涓庢湭瑙ｅ喅 deferred gaps 鎽樿

**鎵ц闃舵蹇呴』閬靛畧**锛氬湪寮€濮嬫墽琛?tasks 鍓嶅垱寤?prd/progress锛涙瘡瀹屾垚涓€涓?US 绔嬪嵆鏇存柊銆傝瑙?speckit-workflow 搂5.1銆乧ommands/speckit.implement.md 姝ラ 3.5 涓?6銆?
```
浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛樹互鍙婅祫娣辩殑杞欢寮€鍙戜笓瀹讹紝璇峰府鎴戜粩缁嗗闃呯洰鍓嶅熀浜巘asks.md鐨勬墽琛屾墍鍋氱殑浠ｇ爜瀹炵幇鏄惁瀹屽叏瑕嗙洊浜嗗師濮嬬殑闇€姹傝璁℃枃妗ｃ€乸lan.md 浠ュ強 IMPLEMENTATION_GAPS.md 鎵€鏈夌珷鑺傦紝鏄惁涓ユ牸鎸夌収鎶€鏈灦鏋勫拰鎶€鏈€夊瀷鍐崇瓥锛屾槸鍚︿弗鏍兼寜鐓ч渶姹傚拰鍔熻兘鑼冨洿瀹炵幇锛屾槸鍚︿弗鏍奸伒寰蒋浠跺紑鍙戞渶浣冲疄璺点€傛澶栵紝蹇呴』涓撻」瀹℃煡锛氾紙1锛夋墽琛屽墠鏄惁宸茶鍙栧苟缁存姢 `journey-ledger`銆乣invariant-ledger`銆乣trace-map`锛堢嫭绔嬫枃浠舵垨 tasks 鍐呭祵 section锛夛紝浠ュ強 `Smoke Task Chain`銆乣Closure Task ID`銆乣Journey Unlock`銆乣Smoke Path Unlock`銆乣Definition Gap Handling`銆乣Implementation Gap Handling`锛涘疄鐜扮粨鏋滄槸鍚︿粛涓庤繖浜?ledger / journey contracts 涓€鑷达紱鑻ヤ负 multi-agent 鎵ц锛屾槸鍚︽樉寮忛攣瀹?`Shared Journey Ledger Path`銆乣Shared Invariant Ledger Path`銆乣Shared Trace Map Path`锛屽苟瑕佹眰鎵€鏈?agent 浣跨敤鍚屼竴浠?`same path reference`锛涳紙2锛夋槸鍚﹀凡鎵ц闆嗘垚娴嬭瘯涓庣鍒扮鍔熻兘娴嬭瘯锛堜笉浠呬粎鏄崟鍏冩祴璇曪級锛岄獙璇佹ā鍧楅棿鍗忎綔涓庣敤鎴峰彲瑙佸姛鑳芥祦绋嬪湪鐢熶骇浠ｇ爜鍏抽敭璺緞涓婂伐浣滄甯革紱锛?锛夋瘡涓?`P0 journey` 鏄惁鏈夌湡瀹?smoke proof锛屼笖瀹屾垚 smoke 鍚庡凡鐢熸垚鎴栨洿鏂板搴?`closure note`锛沗Smoke Task Chain` 鏄惁宸茬湡姝ｉ棴鍚堬紝`Closure Task ID` 鏄惁鐪熷疄钀藉埌 closure note 浠诲姟锛沜losure note 鏄惁鍖呭惈 journey id銆乧overed task ids銆乻moke test ids銆乫ull E2E ids 鎴?deferred reason銆佹湭瑙ｅ喅 deferred gaps锛涳紙4锛夋瘡涓柊澧炴垨淇敼鐨勬ā鍧楁槸鍚︾‘瀹炶鐢熶骇浠ｇ爜鍏抽敭璺緞瀵煎叆銆佸疄渚嬪寲骞惰皟鐢紙渚嬪妫€鏌?UI 鍏ュ彛鏄惁鎸傝浇銆丒ngine/涓绘祦绋嬫槸鍚﹀疄闄呰皟鐢級锛涜嫢 setup / foundational 浠诲姟澹扮О瀹屾垚锛屾槸鍚︾湡瀹炲厬鐜?`Journey Unlock` 涓?`Smoke Path Unlock`锛涳紙5锛夋槸鍚﹀瓨鍦ㄣ€屾ā鍧楀唴閮ㄥ疄鐜板畬鏁翠笖鍙€氳繃鍗曞厓娴嬭瘯锛屼絾浠庢湭鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲鎴栬皟鐢ㄣ€嶇殑瀛ゅ矝妯″潡锛屾垨鈥渕odule complete but journey not runnable鈥濈殑婕傜Щ鈥斺€旇嫢瀛樺湪锛屽繀椤讳綔涓烘湭閫氳繃椤瑰垪鍑猴紱锛?锛夋槸鍚﹀凡鏄庣‘鍖哄垎骞惰褰?`definition gap` 涓?`implementation gap`锛沗Definition Gap Handling` 涓?`Implementation Gap Handling` 涓嶅緱娣峰啓锛涜嫢浠嶆湁 definition gap锛屽嵈琚綔涓衡€滃姛鑳藉凡瀹炵幇鈥濆澶栧绉帮紝蹇呴』鍒ゆ湭閫氳繃锛涳紙7锛夋槸鍚﹀凡鍒涘缓骞剁淮鎶?ralph-method 杩借釜鏂囦欢锛坧rd.json 鎴?prd.{stem}.json銆乸rogress.txt 鎴?progress.{stem}.txt锛夛紝涓旀瘡瀹屾垚涓€涓?US 鏈夊搴旀洿鏂帮紙prd 涓?passes=true銆乸rogress 涓甫鏃堕棿鎴崇殑 story log锛屼笖娑夊強鐢熶骇浠ｇ爜鐨?*姣忎釜 US** 椤诲湪鍏跺搴旀钀藉唴鍚勫惈 [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鑷冲皯涓€琛岋紙瀹¤椤婚€?US 妫€鏌ワ紝涓嶅緱浠ユ枃浠跺叏灞€鍚勬湁涓€琛屽嵆鍒ら€氳繃锛沎TDD-REFACTOR] 鍏佽鍐?鏃犻渶閲嶆瀯 鉁?锛屼絾绂佹鐪佺暐锛夛紱鑻ユ湭鍒涘缓鎴栨湭鎸?US 鏇存柊锛屽繀椤讳綔涓烘湭閫氳繃椤瑰垪鍑猴紱**瀹¤涓嶅緱璞佸厤**锛氫笉寰椾互銆宼asks 瑙勮寖銆嶃€屽彲閫夈€嶃€屽彲鍚庣画琛ュ厖銆嶃€岄潪 搂5 闃绘柇銆嶄负鐢辫眮鍏?TDD 涓夐」妫€鏌ワ紱娑夊強鐢熶骇浠ｇ爜鐨?US 缂轰换涓€椤瑰嵆鍒ゆ湭閫氳繃锛涳紙8锛夎嫢鏈疆鏀瑰姩瑙﹀強 `P0 journey`銆乧ompletion semantics銆乨ependency semantics銆乸ermission boundaries銆乫ixture / environment assumptions锛屾槸鍚﹀凡瑙﹀彂 `re-readiness`锛涜瑙﹀彂鑻ョ己澶憋紝蹇呴』鍒ゆ湭閫氳繃锛涳紙9锛?*蹇呴』**妫€鏌ワ細瀹¤閫氳繃鍚庤瘎鍒嗗啓鍏ョ殑 branch_id 鏄惁鍦?_bmad/_config/scoring-trigger-modes.yaml 鐨?call_mapping 涓厤缃笖 scoring_write_control.enabled=true锛涳紙10锛?*蹇呴』**妫€鏌ワ細parseAndWriteScore 璋冪敤鐨勫弬鏁拌瘉鎹槸鍚﹂綈鍏紙reportPath銆乻tage銆乺unId銆乻cenario銆亀riteMode锛夛紱锛?1锛?*蹇呴』**妫€鏌ワ細scenario=eval_question 鏃?question_version 鏄惁蹇呭～锛岀己鍒欒 SCORE_WRITE_INPUT_INVALID 涓斾笉璋冪敤锛涳紙12锛?*蹇呴』**妫€鏌ワ細璇勫垎鍐欏叆澶辫触鏄惁 non_blocking 涓旇褰?resultCode 杩涘璁¤瘉鎹紱锛?3锛?*蹇呴』**妫€鏌ワ細椤圭洰椤绘寜鎶€鏈爤閰嶇疆骞舵墽琛?Lint锛堣 lint-requirement-matrix锛夛紱鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint锛岄』浣滀负鏈€氳繃椤癸紱宸查厤缃殑椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆?*绂佹**浠ャ€屼笌鏈浠诲姟涓嶇浉鍏炽€嶈眮鍏嶃€傚繀椤婚€愭潯杩涜妫€鏌ュ拰楠岃瘉锛岀敓鎴愪竴涓€愭潯鎻忚堪璇︾粏妫€鏌ュ唴瀹广€侀獙璇佹柟寮忓拰楠岃瘉缁撴灉鐨勫璁℃姤鍛娿€傛姤鍛婄粨灏惧繀椤绘槑纭粰鍑虹粨璁猴細鏄惁銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭閬楁紡绔犺妭鎴栨湭瑕嗙洊瑕佺偣銆傛姤鍛婄粨灏惧繀椤诲寘鍚?搂5.1 瑙勫畾鐨勫彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 + 鍥涚淮缁村害璇勫垎锛夛紝鍚﹀垯 parseAndWriteScore 鏃犳硶瑙ｆ瀽銆佷华琛ㄧ洏鏃犳硶鏄剧ず璇勭骇銆傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑哄畬鏁寸殑缁撴瀯鍖栧潡锛屽寘鎷嫭绔嬩竴琛?鎬讳綋璇勭骇: X 鍜?搂5.1 瑙勫畾鐨勫洓琛?- 缁村害鍚? XX/100銆傛€讳綋璇勭骇鍙兘鏄?A/B/C/D锛堢姝?A-銆丅+銆丆+銆丏- 绛変换鎰忎慨楗扮锛夈€傜淮搴﹀垎蹇呴』閫愯鍐欐槑锛屼笉寰楃敤鍖洪棿鎴栨鎷唬鏇裤€傘€惵? 鍙В鏋愬潡瑕佹眰銆戝璁℃椂椤诲悓鏃舵墽琛屾壒鍒ゅ璁″憳妫€鏌ワ紝杈撳嚭鏍煎紡瑙?[audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)銆?```

### 搂5.1 Implement 闃舵鍙В鏋愯瘎鍒嗗潡锛堝己鍒讹級

implement 闃舵瀹¤鎶ュ憡蹇呴』鍦ㄧ粨灏惧寘鍚互涓嬪彲瑙ｆ瀽鍧楋紝涓?`_bmad/_config/code-reviewer-config.yaml` 鐨?`modes.code.dimensions` 涓€鑷淬€傜姝㈢敤鎻忚堪浠ｆ浛銆傛€讳綋璇勭骇浠呴檺 A/B/C/D銆?implement / post_audit 闃舵瀹¤鎶ュ憡杩樺繀椤诲寘鍚?`## Structured Drift Signal Block`锛屽苟浠ュ浐瀹氳〃鏍煎垪杈撳嚭浜旀潯 signal锛歚signal | status | evidence`锛涗簲鏉?signal 鍥哄畾涓?`smoke_task_chain`銆乣closure_task_id`銆乣journey_unlock`銆乣gap_split_contract`銆乣shared_path_reference`銆傜己灏戣 block 涓嶅緱瑙嗕负鈥滄棤 drift鈥濄€?
```markdown
## 鍙В鏋愯瘎鍒嗗潡锛堜緵 parseAndWriteScore锛?
鎬讳綋璇勭骇: [A|B|C|D]

缁村害璇勫垎:
- 鍔熻兘鎬? XX/100
- 浠ｇ爜璐ㄩ噺: XX/100
- 娴嬭瘯瑕嗙洊: XX/100
- 瀹夊叏鎬? XX/100
```

**绂佹鐢ㄦ弿杩颁唬鏇跨粨鏋勫寲鍧?*锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑?*瀹屾暣鐨勭粨鏋勫寲鍧?*锛屽寘鍚嫭绔嬩竴琛?`鎬讳綋璇勭骇: X` 浠ュ強鍥涜 `- 缁村害鍚? XX/100`銆傜淮搴﹀悕椤讳笌 config 涓?`modes.code.dimensions` 鐨?`name` 瀹屽叏涓€鑷达紙鍔熻兘鎬с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級銆傛€讳綋璇勭骇鍙兘鏄?**A/B/C/D**锛堜笉寰椾娇鐢?A-銆丆+ 绛夛級銆?*绂佹浣跨敤 B+銆丄-銆丆+銆丏- 绛変换鎰?+/- 淇グ绗?*锛涜嫢缁撹浠嬩簬涓ゆ。涔嬮棿锛堝 B 涓?A 涔嬮棿锛夛紝鎷╀竴杈撳嚭 B 鎴?A锛屼笉寰楄緭鍑?B+銆傜淮搴﹀垎椤婚€愯鍐欏嚭锛屼笉寰楃敤鍖洪棿鎴栨鎷紙濡傘€?2鈥?5銆嶃€屽悇缁村害 90+銆嶏級浠ｆ浛銆?
**鍙嶄緥锛堟棤鏁堣緭鍑猴級**锛堝彲鍙傝€?搂4.1锛夛細
- `鍙В鏋愯瘎鍒嗗潡锛堟€讳綋璇勭骇 A锛岀淮搴﹀垎 92鈥?5锛塦 鈥?鎻忚堪鍙ワ紝闈炵粨鏋勫寲鍧楋紝parseDimensionScores(mode=code) 鏃犳硶瑙ｆ瀽
- `鎬讳綋璇勭骇: A-`銆乣C+` 鈥?闈?A/B/C/D锛宔xtractOverallGrade 姝ｅ垯涓嶅尮閰?- `鎬讳綋璇勭骇: B+`銆乣A-`銆乣D-` 鈥?鍚慨楗扮锛岀姝紱浠呴檺绾?A/B/C/D
- `缁村害鍒?92鈥?5`銆乣鍚勭淮搴?90+` 鈥?鍖洪棿/姒傛嫭锛岀己 `- 缁村害鍚? XX/100` 琛岀骇鏍煎紡锛岃В鏋愪笉鍒?
銆愬璁″悗鍔ㄤ綔銆戝璁￠€氳繃鏃讹紝璇峰皢瀹屾暣鎶ュ憡淇濆瓨鑷宠皟鐢ㄦ柟鍦ㄦ湰 prompt 涓寚瀹氱殑 reportPath銆俰mplement 闃舵鐨?reportPath 閫氬父涓?_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md 鎴?AUDIT_Story_{epic}-{story}_stage4.md銆傚苟鍦ㄧ粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count銆?*璇勫垎鍐欏叆銆乤uditIndex 鏇存柊涓庡叾瀹?post-audit automation 鐢?invoking host/runner 缁熶竴閫氳繃 `runAuditorHost` 鎵挎帴**锛屼綘鍙渶淇濊瘉 `reportPath`銆乣artifactDocPath`銆乣iteration_count` 瀹屾暣鍙敤銆?*绂佹**锛氫繚瀛樻椂涓嶅緱閲嶅杈撳嚭銆屾鍦ㄥ啓鍏ュ畬鏁村璁℃姤鍛娿€嶃€屾鍦ㄤ繚瀛樸€嶇瓑鐘舵€佷俊鎭紱浣跨敤 write 宸ュ叿涓€娆℃€у啓鍏ュ嵆鍙€?
