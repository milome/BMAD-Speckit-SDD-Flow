<!--
audit-prompts-code.md
瀵瑰簲鍏崇郴锛?- 鏈枃浠剁瓑鏁堜簬 audit-prompts.md 搂5锛堟墽琛?tasks.md 鍚?implement 闃舵瀹¤鎻愮ず璇嶏級
- 涓?_bmad/_config/code-reviewer-config.yaml modes.code 瀵瑰簲锛歝ode-reviewer 鍦?code 妯″紡涓嬩娇鐢ㄦ湰鏂囦欢浣滀负 prompt_template
- 鍙В鏋愬潡閮ㄥ垎鏄庣‘涓?搂5.1 鍥涚淮鏍煎紡锛屼笌 modes.code.dimensions 涓€鑷达紙鍔熻兘鎬с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級
-->

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?# Implement 闃舵浠ｇ爜瀹¤鎻愮ず璇嶏紙code 妯″紡锛?
鏈枃浠朵负 `_bmad/_config/code-reviewer-config.yaml` 涓?modes.code 鐨?prompt_template锛岀瓑鏁堜簬 `audit-prompts.md` 搂5銆傜敤浜?speckit-workflow 搂5.2 鎵ц闃舵瀹¤鍙?bmad-story-assistant 闃舵鍥涘疄鏂藉悗瀹¤銆?
---

## 瀹¤鎻愮ず璇嶆鏂?
**鎵ц闃舵蹇呴』閬靛畧**锛氬湪寮€濮嬫墽琛?tasks 鍓嶅垱寤?prd/progress锛涙瘡瀹屾垚涓€涓?US 绔嬪嵆鏇存柊銆傝瑙?speckit-workflow 搂5.1銆乧ommands/speckit.implement.md 姝ラ 3.5 涓?6銆?
```
浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛樹互鍙婅祫娣辩殑杞欢寮€鍙戜笓瀹讹紝璇峰府鎴戜粩缁嗗闃呯洰鍓嶅熀浜巘asks.md鐨勬墽琛屾墍鍋氱殑浠ｇ爜瀹炵幇 鏄惁瀹屽叏瑕嗙洊浜嗗師濮嬬殑闇€姹傝璁℃枃妗ｃ€乸lan.md 浠ュ強 IMPLEMENTATION_GAPS.md 鎵€鏈夌珷鑺傦紝鏄惁涓ユ牸鎸夌収鎶€鏈灦鏋勫拰鎶€鏈€夊瀷鍐崇瓥锛屾槸鍚︿弗鏍兼寜鐓ч渶姹傚拰鍔熻兘鑼冨洿瀹炵幇锛屾槸鍚︿弗鏍奸伒寰蒋浠跺紑鍙戞渶浣冲疄璺点€傛澶栵紝蹇呴』涓撻」瀹℃煡锛氾紙1锛夋槸鍚﹀凡鎵ц闆嗘垚娴嬭瘯涓庣鍒扮鍔熻兘娴嬭瘯锛堜笉浠呬粎鏄崟鍏冩祴璇曪級锛岄獙璇佹ā鍧楅棿鍗忎綔涓庣敤鎴峰彲瑙佸姛鑳芥祦绋嬪湪鐢熶骇浠ｇ爜鍏抽敭璺緞涓婂伐浣滄甯革紱锛?锛夋瘡涓柊澧炴垨淇敼鐨勬ā鍧楁槸鍚︾‘瀹炶鐢熶骇浠ｇ爜鍏抽敭璺緞瀵煎叆銆佸疄渚嬪寲骞惰皟鐢紙渚嬪妫€鏌?UI 鍏ュ彛鏄惁鎸傝浇銆丒ngine/涓绘祦绋嬫槸鍚﹀疄闄呰皟鐢級锛涳紙3锛夋槸鍚﹀瓨鍦ㄣ€屾ā鍧楀唴閮ㄥ疄鐜板畬鏁翠笖鍙€氳繃鍗曞厓娴嬭瘯锛屼絾浠庢湭鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲鎴栬皟鐢ㄣ€嶇殑瀛ゅ矝妯″潡鈥斺€旇嫢瀛樺湪锛屽繀椤讳綔涓烘湭閫氳繃椤瑰垪鍑猴紱锛?锛夋槸鍚﹀凡鍒涘缓骞剁淮鎶?ralph-method 杩借釜鏂囦欢锛坧rd.json 鎴?prd.{stem}.json銆乸rogress.txt 鎴?progress.{stem}.txt锛夛紝涓旀瘡瀹屾垚涓€涓?US 鏈夊搴旀洿鏂帮紙prd 涓?passes=true銆乸rogress 涓甫鏃堕棿鎴崇殑 story log锛屼笖娑夊強鐢熶骇浠ｇ爜鐨?*姣忎釜 US** 椤诲湪鍏跺搴旀钀藉唴鍚勫惈 [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鑷冲皯涓€琛岋紙瀹¤椤婚€?US 妫€鏌ワ紝涓嶅緱浠ユ枃浠跺叏灞€鍚勬湁涓€琛屽嵆鍒ら€氳繃锛沎TDD-REFACTOR] 鍏佽鍐?鏃犻渶閲嶆瀯 鉁?锛屼絾绂佹鐪佺暐锛夛紱鑻ユ湭鍒涘缓鎴栨湭鎸?US 鏇存柊锛屽繀椤讳綔涓烘湭閫氳繃椤瑰垪鍑猴紱**瀹¤涓嶅緱璞佸厤**锛氫笉寰椾互銆宼asks 瑙勮寖銆嶃€屽彲閫夈€嶃€屽彲鍚庣画琛ュ厖銆嶃€岄潪 搂5 闃绘柇銆嶄负鐢辫眮鍏?TDD 涓夐」妫€鏌ワ紱娑夊強鐢熶骇浠ｇ爜鐨?US 缂轰换涓€椤瑰嵆鍒ゆ湭閫氳繃锛涳紙5锛?*蹇呴』**妫€鏌ワ細瀹¤閫氳繃鍚庤瘎鍒嗗啓鍏ョ殑 branch_id 鏄惁鍦?_bmad/_config/scoring-trigger-modes.yaml 鐨?call_mapping 涓厤缃笖 scoring_write_control.enabled=true锛涳紙6锛?*蹇呴』**妫€鏌ワ細parseAndWriteScore 璋冪敤鐨勫弬鏁拌瘉鎹槸鍚﹂綈鍏紙reportPath銆乻tage銆乺unId銆乻cenario銆亀riteMode锛夛紱锛?锛?*蹇呴』**妫€鏌ワ細scenario=eval_question 鏃?question_version 鏄惁蹇呭～锛岀己鍒欒 SCORE_WRITE_INPUT_INVALID 涓斾笉璋冪敤锛涳紙8锛?*蹇呴』**妫€鏌ワ細璇勫垎鍐欏叆澶辫触鏄惁 non_blocking 涓旇褰?resultCode 杩涘璁¤瘉鎹€傚繀椤婚€愭潯杩涜妫€鏌ュ拰楠岃瘉锛岀敓鎴愪竴涓€愭潯鎻忚堪璇︾粏妫€鏌ュ唴瀹广€侀獙璇佹柟寮忓拰楠岃瘉缁撴灉鐨勫璁℃姤鍛娿€傛姤鍛婄粨灏惧繀椤绘槑纭粰鍑虹粨璁猴細鏄惁銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭閬楁紡绔犺妭鎴栨湭瑕嗙洊瑕佺偣銆傛姤鍛婄粨灏惧繀椤诲寘鍚互涓嬪彲瑙ｆ瀽璇勫垎鍧楋紙鍥涚淮锛氬姛鑳芥€с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級锛屽惁鍒?parseAndWriteScore(mode=code) 鏃犳硶瑙ｆ瀽銆佷华琛ㄧ洏鍥涚淮鏄剧ず銆屾棤鏁版嵁銆嶃€傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑哄畬鏁寸殑缁撴瀯鍖栧潡锛屽寘鎷嫭绔嬩竴琛?鎬讳綋璇勭骇: X 鍜屽洓琛?- 缁村害鍚? XX/100銆傜淮搴﹀悕椤讳笌 _bmad/_config/code-reviewer-config.yaml modes.code.dimensions 瀹屽叏涓€鑷淬€傛€讳綋璇勭骇鍙兘鏄?A/B/C/D锛堢姝?A-銆丆+ 绛夛級銆傜淮搴﹀垎蹇呴』閫愯鍐欐槑锛屼笉寰楃敤鍖洪棿鎴栨鎷唬鏇裤€傘€惵? 鍙В鏋愬潡瑕佹眰銆戝璁℃椂椤诲悓鏃舵墽琛屾壒鍒ゅ璁″憳妫€鏌ワ紝杈撳嚭鏍煎紡瑙?[audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)銆?```

---

## 鍙В鏋愯瘎鍒嗗潡锛堝己鍒讹紝绛夋晥 audit-prompts 搂5.1锛?
implement 闃舵瀹¤鎶ュ憡蹇呴』鍦ㄧ粨灏惧寘鍚互涓嬪彲瑙ｆ瀽鍧楋紝涓?`_bmad/_config/code-reviewer-config.yaml` 鐨?`modes.code.dimensions` 涓€鑷淬€傜姝㈢敤鎻忚堪浠ｆ浛銆傛€讳綋璇勭骇浠呴檺 A/B/C/D銆?
```markdown
## 鍙В鏋愯瘎鍒嗗潡锛堜緵 parseAndWriteScore锛?
鎬讳綋璇勭骇: [A|B|C|D]

缁村害璇勫垎:
- 鍔熻兘鎬? XX/100
- 浠ｇ爜璐ㄩ噺: XX/100
- 娴嬭瘯瑕嗙洊: XX/100
- 瀹夊叏鎬? XX/100
```

## Structured Drift Signal Block锛堝己鍒讹級

implement / post_audit 闃舵瀹¤鎶ュ憡杩樺繀椤诲寘鍚互涓嬬粨鏋勫寲 block銆傜己灏戣 block 涓嶅緱瑙嗕负鈥滄棤 drift鈥濄€?
```markdown
## Structured Drift Signal Block

| signal | status | evidence |
| --- | --- | --- |
| smoke_task_chain | pass/fail | 绠€瑕佽瘉鎹?|
| closure_task_id | pass/fail | 绠€瑕佽瘉鎹?|
| journey_unlock | pass/fail | 绠€瑕佽瘉鎹?|
| gap_split_contract | pass/fail | 绠€瑕佽瘉鎹?|
| shared_path_reference | pass/fail | 绠€瑕佽瘉鎹?|
```

**绂佹鐢ㄦ弿杩颁唬鏇跨粨鏋勫寲鍧?*锛氫笉寰楀湪鎬荤粨鎴栨鏂囦腑鐢ㄣ€屽彲瑙ｆ瀽璇勫垎鍧楋紙鎬讳綋璇勭骇 X锛岀淮搴﹀垎 Y鈥揨锛夈€嶇瓑鏂囧瓧姒傛嫭锛涘繀椤诲湪鎶ュ憡涓緭鍑?*瀹屾暣鐨勭粨鏋勫寲鍧?*锛屽寘鍚嫭绔嬩竴琛?`鎬讳綋璇勭骇: X` 浠ュ強鍥涜 `- 缁村害鍚? XX/100`銆傜淮搴﹀悕椤讳笌 config 涓?`modes.code.dimensions` 鐨?`name` 瀹屽叏涓€鑷达紙鍔熻兘鎬с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級銆傛€讳綋璇勭骇鍙兘鏄?**A/B/C/D**锛堜笉寰椾娇鐢?A-銆丆+ 绛夛級銆傜淮搴﹀垎椤婚€愯鍐欏嚭锛屼笉寰楃敤鍖洪棿鎴栨鎷紙濡傘€?2鈥?5銆嶃€屽悇缁村害 90+銆嶏級浠ｆ浛銆?
**鍙嶄緥锛堟棤鏁堣緭鍑猴級**锛?- `鍙В鏋愯瘎鍒嗗潡锛堟€讳綋璇勭骇 A锛岀淮搴﹀垎 92鈥?5锛塦 鈥?鎻忚堪鍙ワ紝闈炵粨鏋勫寲鍧楋紝parseDimensionScores(mode=code) 鏃犳硶瑙ｆ瀽
- `鎬讳綋璇勭骇: A-`銆乣C+` 鈥?闈?A/B/C/D锛宔xtractOverallGrade 姝ｅ垯涓嶅尮閰?- `缁村害鍒?92鈥?5`銆乣鍚勭淮搴?90+` 鈥?鍖洪棿/姒傛嫭锛岀己 `- 缁村害鍚? XX/100` 琛岀骇鏍煎紡锛岃В鏋愪笉鍒?
---

## 瀹¤鍚庡姩浣?
瀹¤閫氳繃鏃讹紝璇峰皢瀹屾暣鎶ュ憡淇濆瓨鑷宠皟鐢ㄦ柟鍦ㄦ湰 prompt 涓寚瀹氱殑 reportPath銆俰mplement 闃舵鐨?reportPath 閫氬父涓?`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md` 鎴?`AUDIT_Story_{epic}-{story}_stage4.md`銆傚苟鍦ㄧ粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count锛屼互渚夸富 Agent / 瀹夸富璋冪敤 runAuditorHost銆?
