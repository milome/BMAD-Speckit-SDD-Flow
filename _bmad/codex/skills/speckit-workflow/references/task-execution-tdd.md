# Tasks 鎵ц瑙勫垯锛歍DD 绾㈢豢鐏ā寮忥紙璇︾粏鍙傝€冿級

鎵ц tasks.md锛堟垨 tasks-v*.md锛変腑鐨勬湭瀹屾垚浠诲姟鏃跺繀椤婚伒瀹堟湰鏂囦欢鐨勫叏閮ㄨ鍒欍€?
**鎵ц椤哄簭**锛歐RITE test 鈫?RUN 鈫?ASSERT FAIL 鈫?WRITE code 鈫?RUN 鈫?ASSERT PASS 鈫?REFACTOR銆傜姝㈠厛鍐欑敓浜т唬鐮佸啀琛ユ祴璇曘€?
**銆怲DD 绾㈢豢鐏樆濉炵害鏉熴€?* prd 涓瘡涓?involvesProductionCode=true 鐨?US 蹇呴』**鐙珛**鎵ц涓€娆″畬鏁村惊鐜€傛墽琛岄『搴忎负锛?1. 鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹 鈫?蹇呴』寰楀埌澶辫触缁撴灉锛堢孩鐏級
2. 绔嬪嵆鍦?progress 杩藉姞 [TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed
3. 鍐嶅疄鐜板苟閫氳繃楠屾敹 鈫?寰楀埌閫氳繃缁撴灉锛堢豢鐏級
4. 绔嬪嵆鍦?progress 杩藉姞 [TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed
5. 鑻ユ湁閲嶆瀯锛屽湪 progress 杩藉姞 [TDD-REFACTOR] <浠诲姟ID> <鍐呭>
绂佹鍦ㄦ湭瀹屾垚姝ラ 1鈥? 涔嬪墠鎵ц姝ラ 3銆?*绂佹浠呭棣栦釜 US 鎵ц TDD锛屽悗缁?US 璺宠繃绾㈢伅鐩存帴瀹炵幇**銆傜姝㈡墍鏈変换鍔″畬鎴愬悗闆嗕腑琛ュ啓 TDD 璁板綍銆?
---

## 1. TDD 绾㈢伅-缁跨伅-閲嶆瀯寰幆

### 1.1 绾㈢伅闃舵锛堢紪鍐欐祴璇曪級

- 闃呰褰撳墠浠诲姟鐨勯渶姹傝拷婧紝妫€绱㈠苟闃呰鐩稿叧闇€姹傛枃妗ｇ珷鑺傘€?- 缂栧啓鎴栬ˉ鍏呰鐩栧綋鍓嶄换鍔￠獙鏀舵爣鍑嗙殑娴嬭瘯鐢ㄤ緥銆?- 杩愯娴嬭瘯锛?*纭娴嬭瘯澶辫触**锛堢孩鐏級锛岄獙璇佹祴璇曠殑鏈夋晥鎬с€?- 鑻ユ祴璇曠洿鎺ラ€氳繃锛岃鏄庢祴璇曟棤鏁堟垨鍔熻兘宸插瓨鍦紝闇€淇娴嬭瘯鎴栫‘璁ゅ悗璺宠繃璇ユ祴璇曘€?
### 1.2 缁跨伅闃舵锛堟渶灏忓疄鐜帮級

- 缂栧啓**鏈€灏戦噺**鐢熶骇浠ｇ爜浣挎祴璇曢€氳繃銆?- 杩愯娴嬭瘯锛岀‘璁ゅ叏閮ㄩ€氳繃锛堢豢鐏級銆?- 姝ら樁娈典笉杩芥眰浠ｇ爜璐ㄩ噺锛屼粎杩芥眰娴嬭瘯閫氳繃銆?
### 1.3 閲嶆瀯闃舵锛堜唬鐮佷紭鍖栵級

- 鍦ㄦ祴璇曚繚鎶や笅浼樺寲浠ｇ爜锛氬懡鍚嶃€佽В鑰︺€佹秷闄ら噸澶嶃€佹敼鍠勫彲璇绘€с€?- 瀵圭収涓氱晫鏈€浣冲疄璺靛瑙嗗疄鐜帮細SOLID 鍘熷垯銆佽璁℃ā寮忋€佹€ц兘浼樺寲銆?- 姣忔閲嶆瀯鍚庤繍琛屾祴璇曪紝纭繚浠嶅叏閮ㄩ€氳繃銆?- **閲嶆瀯鑷崇鍚堟渶浣冲疄璺靛悗鏂瑰彲缁撴潫鏈樁娈?*锛屼笉寰楄烦杩囬噸鏋勩€?
---

## 2. 杩涘害杩借釜涓庣姸鎬佹洿鏂?
### 2.0 progress 妯℃澘棰勫～ TDD 妲戒綅

鐢熸垚 progress 鏃讹紝瀵规瘡涓?US 棰勫～浠ヤ笅鍗犱綅琛岋紱妯″瀷鎵ц鏃跺皢 `_pending_` 鏇挎崲涓哄疄闄呯粨鏋滐細

**娑夊強鐢熶骇浠ｇ爜鐨?US**锛?```
# US-001: Create user entity
[TDD-RED]   _pending_
[TDD-GREEN] _pending_
[TDD-REFACTOR] _pending_
---
```

**浠呮枃妗?閰嶇疆鐨?US**锛?```
# US-002: Add config value
[DONE] _pending_
---
```

鏇挎崲鏍煎紡绀轰緥锛歚[TDD-RED] T1 pytest tests/test_xxx.py -v => N failed`

### 2.1 TodoWrite 杩借釜

- 寮€濮嬫墽琛屽墠锛屼娇鐢?TodoWrite 鍒涘缓鎵€鏈夋湭瀹屾垚浠诲姟鐨勮拷韪垪琛ㄣ€?- 姣忎釜浠诲姟寮€濮嬫椂鏍囪 `in_progress`锛屽畬鎴愭椂鏍囪 `completed`銆?- 鍚屼竴鏃堕棿浠呬竴涓换鍔″浜?`in_progress` 鐘舵€併€?
### 2.2 tasks.md 澶嶉€夋鏇存柊

- 浠诲姟瀹屾垚鍚?*绔嬪嵆**鏇存柊 tasks.md锛堟垨 tasks-v*.md锛変腑鐨勫閫夋 `[ ]` 鈫?`[x]`銆?- 绂佹鎵归噺寤惰繜鏇存柊锛涙瘡瀹屾垚涓€涓换鍔″嵆鏇存柊涓€娆°€?
### 2.3 闀挎椂闂磋剼鏈鐞?
- pytest銆佹瀯寤鸿剼鏈瓑闀挎椂闂磋繍琛岀殑鍛戒护浣跨敤 `block_until_ms: 0` 鍚庡彴杩愯銆?- 鍚姩鍚庤疆璇?`terminals/` 鐩綍妫€鏌ョ粨鏋滄枃浠躲€?- 浣跨敤鎸囨暟閫€閬跨瓥鐣ヨ疆璇紙2s 鈫?4s 鈫?8s 鈫?16s...锛夛紝鏍规嵁鍛戒护棰勪及鏃堕暱璋冩暣銆?- 绛夊緟 `exit_code` 鍑虹幇鍚庤鍙栧畬鏁磋緭鍑哄垽鏂粨鏋溿€?
---

## 3. 鎵ц绾︽潫锛?5 鏉￠搧寰嬶級

### 绗竴绫伙細鏋舵瀯涓庨渶姹傚繝瀹炴€?
1. **涓ユ牸鎸夋枃妗ｆ妧鏈灦鏋勫疄鏂?*锛氬繀椤讳弗鏍兼寜鐓ф枃妗ｄ腑璁板綍鐨勬妧鏈灦鏋勫拰閫夊瀷杩涜瀹炴柦锛岀姝㈡搮鑷慨鏀瑰疄鏂界殑鎶€鏈灦鏋勫拰閫夊瀷銆?2. **涓ユ牸鎸夋枃妗ｉ渶姹傝寖鍥村疄鏂?*锛氬繀椤讳弗鏍兼寜鐓ф枃妗ｄ腑璁板綍鐨勯渶姹傝寖鍥村拰鍔熻兘鑼冨洿杩涜瀹炴柦锛岀姝㈡搮鑷慨鏀归渶姹傝寖鍥村拰鍔熻兘鑼冨洿锛岀姝互鍏堝疄鏂芥渶灏忓疄鐜颁负鐢辨搮鑷亸绂荤敤鎴风殑鐪熸闇€姹傚拰鎰忓浘銆?
### 绗簩绫伙細绂佹浼疄鐜?
3. **绂佹鏍囪瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤**锛氫换鍔℃爣璁颁负瀹屾垚鏃讹紝瀵瑰簲鍔熻兘蹇呴』宸插湪鐢熶骇浠ｇ爜鐨勫叧閿矾寰勪腑琚疄闄呰皟鐢ㄣ€?4. **绂佹浠呭垵濮嬪寲瀵硅薄鑰屼笉鍦ㄥ叧閿矾寰勪腑浣跨敤**锛氬垱寤虹殑瀵硅薄銆佺被銆佹ā鍧楀繀椤诲湪鐢熶骇浠ｇ爜璺緞涓鐪熸浣跨敤锛屼笉寰椾粎瀛樺湪浜庡垵濮嬪寲闃舵銆?5. **绂佹鐢ㄣ€岄鐣欍€嶃€屽崰浣嶃€嶇瓑璇嶈閬垮疄鐜?*锛氭墍鏈夊姛鑳藉繀椤诲畬鏁村疄鐜帮紝涓嶅緱鐢ㄥ崰浣嶇銆乀ODO 娉ㄩ噴鎴栭鐣欐帴鍙ｄ唬鏇跨湡瀹炲疄鐜般€?6. **绂佹鍋囧畬鎴愩€佺姝吉瀹炵幇**锛氭墍鏈変换鍔″繀椤绘湁鐪熷疄鐨勫姛鑳藉疄鐜板拰鍙獙璇佺殑杩愯缁撴灉銆?
### 绗笁绫伙細娴嬭瘯涓庡洖褰?
7. **涓诲姩淇娴嬭瘯鑴氭湰**锛氬繀椤讳富鍔ㄨ繘琛屾祴璇曡剼鏈殑淇锛岀姝互娴嬭瘯鐢ㄤ緥涓庢湰娆″紑鍙戞棤鍏充负鐢遍€冮伩淇銆傚彂鐜扮殑娴嬭瘯闂鏃犺鏉ユ簮鍧囬渶淇銆?8. **涓诲姩鍥炲綊娴嬭瘯**锛氬繀椤讳富鍔ㄨ繘琛屽洖褰掓祴璇曪紝搴斿敖鏃╁彂鐜板姛鑳藉洖閫€闂锛岀姝㈡帺鐩栭棶棰樸€傛瘡瀹屾垚涓€涓换鍔″悗杩愯鐩稿叧娴嬭瘯濂椾欢锛屾瘡瀹屾垚涓€涓鏌ョ偣鍚庤繍琛屽叏閲忓洖褰掋€?
### 绗洓绫伙細閲嶆瀯鏍囧噯

9. **涓诲姩閲嶆瀯鑷虫渶浣冲疄璺?*锛氬鏋滅敓鎴愮殑浠ｇ爜涓嶇鍚堟渶浣冲疄璺碉紝搴旇鍦ㄧ孩缁跨伅鐨勯噸鏋勯樁娈典富鍔ㄨ繘琛岄噸鏋勶紝鐩村埌绗﹀悎鏈€浣冲疄璺典负姝€傚瑙嗘爣鍑嗗寘鎷細SOLID 鍘熷垯銆丏RY銆佹竻鏅板懡鍚嶃€侀€傚綋鎶借薄灞傛銆侀敊璇鐞嗐€佹€ц兘鑰冮噺銆?
### 绗簲绫伙細娴佺▼瀹屾暣鎬?
10. **绂佹鎻愬墠鍋滄**锛氱姝㈠湪鎵€鏈夋湭瀹屾垚浠诲姟鐪熸瀹炵幇骞跺畬鎴愪箣鍓嶆搮鑷仠姝㈠紑鍙戝伐浣溿€傚繀椤绘寔缁帹杩涚洿鍒版墍鏈変换鍔″畬鎴愭垨閬囧埌涓嶅彲瑙ｅ喅鐨勯樆濉炪€?11. **妫€鏌ョ偣鍓嶉獙璇佸墠缃换鍔?*锛氶亣鍒版鏌ョ偣鏃堕獙璇佹墍鏈夊墠缃换鍔″凡瀹屾垚銆傚垪鍑哄墠缃换鍔℃竻鍗曪紝閫愪竴纭鐘舵€佷负 completed锛岃繍琛屾鏌ョ偣瑕佹眰鐨勫叏閮ㄩ獙璇佸懡浠ゃ€?12. **鏌ラ槄鍓嶇疆鏂囨。**锛氬闇€鍙傝€冭璁★紝鏌ョ湅鍓嶇疆鐩稿叧鐨勯渶姹傛枃妗?plan鏂囨。/IMPLEMENTATION_GAPS鏂囨。銆傚疄鏂藉墠鎵ц闇€姹傝拷婧紙瑙佷笅 搂5锛夈€?12.1 **璇诲彇 Deferred Gaps 宸ヤ欢**锛氳嫢瀛樺湪 `deferred-gap-register.yaml`锛屽繀椤诲湪鎵ц鍓嶅姞杞斤紱鑻ュ０鏄庡瓨鍦?inherited deferred gaps 鍗存湭璇诲彇璇ユ枃浠讹紝涓嶅緱缁х画鎶婁换鍔℃爣璁颁负瀹屾垚銆?12.2 **璇诲彇 Journey-first 宸ヤ欢**锛氫紭鍏堣鍙栫嫭绔?`journey-ledger`銆乣invariant-ledger`銆乣trace-map`銆乣closure-notes`锛涗粎褰撹繖浜涚嫭绔嬪伐浠朵笉瀛樺湪鏃讹紝鎵嶅厑璁稿洖閫€鍒?tasks.md 鍐呭祵 section銆?
### 绗叚绫伙細杩涘害杩借釜

13. **TodoWrite 杩借釜杩涘害**锛氫娇鐢?TodoWrite 杩借釜杩涘害锛屾瘡涓换鍔℃爣璁?`in_progress` / `completed`銆?14. **绔嬪嵆鏇存柊澶嶉€夋**锛氬畬鎴愪换鍔″悗绔嬪嵆鏇存柊 tasks.md锛堟垨 tasks-v*.md锛変腑鐨勫閫夋 `[ ]` 鈫?`[x]`銆?15. **闀挎椂闂磋剼鏈悗鍙拌繍琛?*锛歱ytest/闀挎椂闂磋剼鏈娇鐢?`block_until_ms: 0` 鍚庡彴杩愯锛岀劧鍚庤疆璇?`terminals/` 妫€鏌ョ粨鏋溿€?16. **Journey 涓?Deferred Gap 鍚屾鏀跺彛**锛氬叧闂?gap銆佺敓鎴?smoke/full E2E銆佸畬鎴?closure note銆佽ˉ acceptance evidence 鏃讹紝蹇呴』鍚屾鏇存柊 `deferred-gap-register.yaml` 涓?Journey-first 宸ヤ欢锛岀姝㈠彧鏀逛换鍔″閫夋銆?
---

## 4. 妫€鏌ョ偣楠岃瘉娴佺▼

閬囧埌浠诲姟妫€鏌ョ偣锛圕heckpoint锛夋椂锛?
1. 鍒楀嚭鎵€鏈夊墠缃换鍔★紝纭 TodoWrite 鐘舵€佸潎涓?`completed`锛宼asks.md 涓閫夋鍧囦负 `[x]`銆?2. 杩愯璇ユ鏌ョ偣瑕佹眰鐨勬墍鏈夐獙璇佸懡浠ゃ€?3. 鎵ц鍏ㄩ噺鍥炲綊娴嬭瘯锛坄pytest` 鐩稿叧娴嬭瘯鐩綍锛夛紝纭繚鏃犲姛鑳藉洖閫€銆?4. 浠呭綋鎵€鏈夐獙璇侀€氳繃鍚庢柟鍙户缁悗缁换鍔°€?5. 鑻ラ獙璇佸け璐ワ紝鍥為€€淇闂浠诲姟锛屼慨澶嶅悗閲嶆柊杩愯楠岃瘉鐩磋嚦閫氳繃銆?
---

## 5. 闇€姹傝拷婧紙姣忎釜浠诲姟瀹炴柦鍓嶅繀濉級

姣忎釜浠诲姟寮€濮嬪疄鏂藉墠锛岄』瀹屾垚闇€姹傝拷婧細

- **闂鍏抽敭璇?*: 褰撳墠浠诲姟娑夊強鐨勬牳蹇冩蹇碉紙濡?DuckDB銆佸壇鍥惧彔鍔犮€丼haredMemory锛?- **妫€绱㈣寖鍥?*: specs/ 涓嬬浉鍏抽渶姹傛枃妗ｃ€佽璁℃枃妗?- **鐩稿叧绔犺妭**: 闇€姹傛枃妗ｄ腑鐨勫叿浣撶珷鑺傜紪鍙凤紙濡?搂3.1, 搂4.2锛?- **鏃㈡湁绾﹀畾鎽樿**: 宸叉湁璁捐鍐崇瓥鍜岀害瀹氾紙濡傛妧鏈€夊瀷銆佹暟鎹粨鏋勫畾涔夛級
- **鏂规鏄惁涓庨渶姹備竴鑷?*: 鏄?/ 鍚︼紙鑻ュ惁锛岃鏄庡師鍥犲強鏄惁闇€瑕佹洿鏂伴渶姹傦級

---

## 6. 鍗曚换鍔℃墽琛屼吉浠ｇ爜

```
FOR EACH uncompleted_task IN tasks_md:
    TodoWrite(task.id, status="in_progress")

    # 闇€姹傝拷婧?    READ related requirement docs (specs/, plan.md, IMPLEMENTATION_GAPS.md)
    FILL requirement traceability fields
    READ deferred-gap-register.yaml when present
    READ journey-ledger / trace-map / closure-notes when present

    # 绾㈢伅
    WRITE test cases covering acceptance criteria
    RUN tests 鈫?ASSERT tests FAIL (red)

    # 缁跨伅
    WRITE minimum production code
    RUN tests 鈫?ASSERT tests PASS (green)

    # 閲嶆瀯
    WHILE code does NOT meet best practices:
        REFACTOR code (SOLID, DRY, naming, decoupling, performance)
        RUN tests 鈫?ASSERT tests STILL PASS
    END WHILE

    # 鍥炲綊
    RUN regression tests for related modules
    IF regression failure:
        FIX regression 鈫?RE-RUN until all pass
    END IF

    # 鏇存柊杩涘害
    UPDATE tasks_md checkbox [ ] 鈫?[x]
    TodoWrite(task.id, status="completed")
    UPDATE deferred-gap-register closure_evidence or carry_forward_evidence
    UPDATE journey-ledger / trace-map / closure-note when journey state changes

    # 妫€鏌ョ偣锛堝鏈夛級
    IF task is checkpoint:
        VERIFY all prerequisite tasks completed
        RUN full regression suite
        ASSERT all pass before continuing
    END IF
END FOR
```
