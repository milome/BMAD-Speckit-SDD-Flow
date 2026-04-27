# Architecture瀹¤鎻愮ず璇?
## 瀹¤瀵硅薄
Architecture Design Document (鏋舵瀯璁捐鏂囨。)

## 瀹¤鐩爣
楠岃瘉鏋舵瀯璁捐鏄惁鎵挎帴浜?PRD 鐨勫叧閿骇鍝佸悎鍚岋紝灏ゅ叾鏄?`P0 journey`銆乣key path sequence`銆乣business completion state vs system completion state`銆乣sync / async boundary`銆乣failure handling`銆乣smoke E2E preconditions` 涓?`observability / traceability`銆?
## 瀹¤缁村害

### 1. 鎶€鏈彲琛屾€э紙30%锛?
**妫€鏌ラ」**锛?- [ ] 鎶€鏈€夊瀷鏈夊厖鍒嗙殑鐞嗙敱鍜屼緷鎹?- [ ] 鏋舵瀯鍙互鍦ㄧ粰瀹氱殑璧勬簮鍐呭疄鐜?- [ ] 鎵€闇€鎶€鏈拰宸ュ叿鎴愮啛涓斿彲鑾峰緱
- [ ] 姣忔潯鍏抽敭 `P0 journey` 閮芥湁瀵瑰簲 `key path sequence`
- [ ] 鍏抽敭璺緞涓殑 `sync / async boundary` 宸插畾涔?
**璇勫垎鏍囧噯**锛?- A: 鎶€鏈柟妗堟垚鐔熷彲琛岋紝鍏抽敭璺緞娓呮櫚
- B: 鍩烘湰鍙锛屾湁閮ㄥ垎椋庨櫓闇€瑕佸叧娉?- C: 鍙鎬у瓨鐤戯紝鍏抽敭璺緞浠嶆湁绌虹櫧
- D: 涓嶅彲琛屾垨椋庨櫓杩囬珮

### 2. 鎵╁睍鎬э紙25%锛?
**妫€鏌ラ」**锛?- [ ] 鏋舵瀯鏀寔鏈潵涓氬姟澧為暱
- [ ] 鏂板姛鑳藉彲浠ュ湪涓嶇牬鍧忓叧閿矾寰勭殑鎯呭喌涓嬫坊鍔?- [ ] `business completion state` 涓?`system completion state` 鐨勫樊寮傚凡瀹氫箟
- [ ] 寮傛杈圭晫銆侀噸璇曘€佽ˉ鍋挎垨骞傜瓑绛栫暐瓒冲鏀拺鎵╁睍

**璇勫垎鏍囧噯**锛?- A: 鎵╁睍鎬т紭绉€锛屽叧閿姸鎬佽涔夋槑纭?- B: 鑹ソ鐨勬墿灞曟€э紝鍩烘湰婊¤冻鏈潵闇€姹?- C: 鎵╁睍鎬ф湁闄愶紝鐘舵€?寮傛绛栫暐瀛樺湪缂哄彛
- D: 缂轰箯鎵╁睍鎬ц€冭檻锛屽緢蹇細閬囧埌鐡堕

### 3. 瀹夊叏鎬э紙25%锛?
**妫€鏌ラ」**锛?- [ ] 杩涜浜嗗▉鑳佸缓妯″苟璁板綍浜嗕富瑕佸▉鑳?- [ ] 閽堝姣忎釜濞佽儊鏈夌浉搴斿畨鍏ㄦ帶鍒舵帾鏂?- [ ] 鏁版嵁浼犺緭鍜屽瓨鍌ㄥ畨鍏ㄦ€ф湁鑰冭檻
- [ ] 韬唤璁よ瘉鍜屾巿鏉冩満鍒朵笌 actor / permission 绾︽潫涓€鑷?- [ ] 澶辫触璺緞銆佽ˉ鍋跨瓥鐣ャ€佸璁℃棩蹇椾笌杩借釜淇℃伅鍙敤浜庡畨鍏ㄦ帓鏌?
**璇勫垎鏍囧噯**锛?- A: 鍏ㄩ潰鐨勫畨鍏ㄨ璁★紝濞佽儊涓庤拷韪摼瀹屾暣
- B: 鑹ソ鐨勫畨鍏ㄨ璁★紝涓昏濞佽儊宸茶鐩?- C: 瀹夊叏璁捐鏈夐仐婕忥紝瀛樺湪涓瓑椋庨櫓
- D: 瀹夊叏璁捐涓ラ噸涓嶈冻锛屽瓨鍦ㄩ珮椋庨櫓

### 4. 鎴愭湰鏁堢泭锛?0%锛?
**妫€鏌ラ」**锛?- [ ] 鍩虹璁炬柦鎴愭湰浼扮畻鍚堢悊
- [ ] 杩愮淮鎴愭湰鍙帶
- [ ] `minimum observability contract` 鎴愭湰涓庢敹鐩婂钩琛?- [ ] `smoke E2E preconditions` 涓?fixture / environment 鏂规鍙疄闄呯淮鎶?
**璇勫垎鏍囧噯**锛?- A: 鎴愭湰鏁堢泭浼樼锛屽叧閿繍缁村悎鍚屾槑纭?- B: 鎴愭湰鏁堢泭鑹ソ锛屽熀鏈悎鐞?- C: 鎴愭湰鍋忛珮鎴栨祴璇?瑙傛祴鎴愭湰涓嶆竻
- D: 鎴愭湰杩囬珮鎴?ROI 涓嶆槑纭?
## Tradeoff鍒嗘瀽瀹¤

姣忎釜閲嶅ぇ鏋舵瀯鍐崇瓥蹇呴』鏈?ADR锛圓rchitecture Decision Record锛夋垨绛変环 tradeoff 璇存槑銆?
**ADR妫€鏌ラ」**锛?- [ ] 鍐崇瓥鑳屾櫙鎻忚堪娓呮櫚
- [ ] 鑰冭檻浜嗚嚦灏?2 涓閫夋柟妗?- [ ] 姣忎釜鏂规鐨勪紭缂虹偣鍒嗘瀽鍒颁綅
- [ ] 鍐崇瓥鐞嗙敱鍏呭垎涓旇兘鍥炴寚鍏抽敭璺緞闇€姹?- [ ] 鍐崇瓥鍚庢灉锛堟闈㈠拰璐熼潰锛夊垎鏋愬畬鏁?- [ ] 鍏抽敭璺緞銆乻moke E2E銆乫ailure handling 鏄惁琚撼鍏ュ喅绛栧悗鏋滃垎鏋?
## 杈撳嚭鏍煎紡

```text
Architecture瀹¤鎶ュ憡
====================

瀹¤瀵硅薄: [Architecture鏂囨。鍚峕
瀹¤鏃ユ湡: [YYYY-MM-DD]

鎬讳綋璇勭骇: [A/B/C/D]

缁村害璇勫垎:
1. 鎶€鏈彲琛屾€? [A/B/C/D] ([寰楀垎]/30)
   - [鍏蜂綋闂鎻忚堪]
2. 鎵╁睍鎬? [A/B/C/D] ([寰楀垎]/25)
   - [鍏蜂綋闂鎻忚堪]
3. 瀹夊叏鎬? [A/B/C/D] ([寰楀垎]/25)
   - [鍏蜂綋闂鎻忚堪]
4. 鎴愭湰鏁堢泭: [A/B/C/D] ([寰楀垎]/20)
   - [鍏蜂綋闂鎻忚堪]

鍏抽敭鍚堝悓妫€鏌?
- P0 Journey Coverage: [閫氳繃/鏈€氳繃]
- Key Path Sequence Coverage: [閫氳繃/鏈€氳繃]
- Business Completion State vs System Completion State: [閫氳繃/鏈€氳繃]
- Smoke E2E Preconditions: [閫氳繃/鏈€氳繃]
- Observability / Traceability Contract: [閫氳繃/鏈€氳繃]
- Failure Handling / Compensation: [閫氳繃/鏈€氳繃]

Tradeoff鍒嗘瀽瀹¤:
- ADR瑕嗙洊鐜? [X/Y] 涓噸澶у喅绛?- ADR璐ㄩ噺璇勭骇: [A/B/C/D]
- [鍏蜂綋闂鎻忚堪]

闂娓呭崟:
1. [涓ラ噸绋嬪害:楂?涓?浣嶿 [闂鎻忚堪] [寤鸿淇敼]
2. ...

閫氳繃鏍囧噯:
- 鎬讳綋璇勭骇A鎴朆: 閫氳繃锛屽彲杩涘叆涓嬩竴闃舵
- 鎬讳綋璇勭骇C: 鏈夋潯浠堕€氳繃锛屽繀椤讳慨澶嶉珮/涓?severity 闂
- 鎬讳綋璇勭骇D: 涓嶉€氳繃锛岄渶瑕侀噸澶т慨鏀?
涓嬩竴姝ヨ鍔?
[鍏蜂綋寤鸿]
```

## 鐗规畩妫€鏌?
### 澶嶆潅搴﹁瘎浼伴獙璇?- [ ] Architecture 鐨勫鏉傚害璇勪及鏄惁鍚堢悊
- [ ] Party-Mode 瑙﹀彂鏉′欢鏄惁姝ｇ‘搴旂敤
- [ ] 璇勪及缁撴灉涓庡疄闄呮灦鏋勫鏉傚害鏄惁鍖归厤

### 涓嶱RD鐨勪竴鑷存€?- [ ] 鏋舵瀯璁捐鏄惁婊¤冻 PRD 涓殑鎵€鏈夊叧閿?journeys
- [ ] PRD 鐨?evidence contract 鏄惁鍦ㄦ灦鏋勪腑鏈夋壙鎺?- [ ] 鏋舵瀯绾︽潫鏄惁浼犻€掑埌涓嬫父鏂囨。
- [ ] 鎶€鏈柟妗堜笌涓氬姟鐩爣銆佸叧閿矾寰勩€侀獙璇佹柟寮忓榻?
### Readiness-to-Implement 瀹¤
- [ ] 鏄惁瀛樺湪娌℃湁 key path sequence 鐨勫叧閿矾寰?- [ ] 鏄惁瀛樺湪娌℃湁 smoke E2E 鍓嶆彁鐨勫叧閿?journey
- [ ] 鏄惁瀛樺湪 business done / system accepted 璇箟涓嶆竻鐨勮矾寰?- [ ] 鏄惁瀛樺湪 failure handling銆乫ixture銆乪nvironment 浠嶉渶瀹炵幇鑰呯寽娴嬬殑鏈畾涔夊悎鍚?
---

## 鎵瑰垽瀹¤鍛樻鏌ワ紙standard/strict 妯″紡蹇呴』锛?
瀹¤鏃堕』鍚屾椂鎵ц鎵瑰垽瀹¤鍛樻鏌ワ紝杈撳嚭鏍煎紡瑙?[audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)銆?
