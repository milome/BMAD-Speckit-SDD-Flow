# Tasks 楠屾敹涓庢墽琛屾ā鏉匡紙鍥哄畾妯℃澘锛屽彲澶嶅埗锛?
浠?`tasks-template.md` 鎻愮偧鐨勫彲澶嶇敤妯℃澘锛欰gent 鎵ц瑙勫垯銆侀渶姹傝拷婧牸寮忋€侀獙鏀舵爣鍑嗗繀澶囪绱犮€侀獙鏀舵墽琛岃鍒欍€傜敓鎴愭垨缁存姢 tasks.md 鏃跺彲鐩存帴澶嶅埗鍒版枃妗ｄ腑浣跨敤銆?
---

## 1. Agent 鎵ц瑙勫垯锛堝潡锛?
瀹屾暣瑙勫垯瑙?[references/qa-agent-rules.md](qa-agent-rules.md)銆備互涓嬩负鍙祵鍏?tasks.md 鐨勭畝鐭潡锛?
```markdown
## Agent 鎵ц瑙勫垯

**绂佹浜嬮」**:
1. 鉂?绂佹鍦ㄤ换鍔℃弿杩颁腑娣诲姞銆屾敞: 灏嗗湪鍚庣画杩唬...銆?2. 鉂?绂佹鏍囪浠诲姟瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤
3. 鉂?绂佹浠呭垵濮嬪寲瀵硅薄鑰屼笉鍦ㄥ叧閿矾寰勪腑浣跨敤
4. 鉂?绂佹鐢ㄣ€岄鐣欍€嶃€屽崰浣嶃€嶇瓑璇嶈閬垮疄鐜?
**蹇呴』浜嬮」**:
1. 鉁?闆嗘垚浠诲姟蹇呴』淇敼鐢熶骇浠ｇ爜璺緞
2. 鉁?蹇呴』杩愯楠岃瘉鍛戒护纭鍔熻兘鍚敤
3. 鉁?閬囧埌鏃犳硶瀹屾垚鐨勬儏鍐碉紝搴旀姤鍛婇樆濉炶€岄潪鑷寤惰繜
4. 鉁?鍔熻兘/鏁版嵁璺緞鐩稿叧浠诲姟瀹炴柦鍓嶅繀椤诲厛妫€绱㈠苟闃呰闇€姹傛枃妗ｇ浉鍏崇珷鑺傦紙瑙?搂9 闇€姹傝拷婧笌闂幆锛?5. 鉁?闇€姹傝拷婧紙瀹炴柦鍓嶅繀濉級锛氶棶棰樺叧閿瘝銆佹绱㈣寖鍥淬€佺浉鍏崇珷鑺傘€佹棦鏈夌害瀹氭憳瑕併€佹柟妗堟槸鍚︿笌闇€姹備竴鑷?```

---

## 2. 闇€姹傝拷婧紙瀹炴柦鍓嶅繀濉級瀛楁妯℃澘

姣忎釜浠诲姟瀹炴柦鍓嶉』濉啓浠ヤ笅鍧楋紝鍙洿鎺ュ鍒跺埌浠诲姟鎻忚堪涓細

```markdown
- **闇€姹傝拷婧紙瀹炴柦鍓嶅繀濉級**
  - **闂鍏抽敭璇?*: 锛堝 SimpleHeader銆佸叡浜唴瀛樸€乺evision锛?  - **妫€绱㈣寖鍥?*: 锛堝 specs/015-indicator-system-refactor/鎸囨爣绯荤粺閲嶆瀯闇€姹傚垎鏋愭枃妗v1.md锛?  - **鐩稿叧绔犺妭**: 锛堝 搂7, 搂8, 搂16锛?  - **鏃㈡湁绾﹀畾鎽樿**: 锛堝 count, revision锛涘崟鍐欏叆鑰呮棤 Seqlock锛?  - **鏂规鏄惁涓庨渶姹備竴鑷?*: 鏄?/ 鍚︼紙鑻ュ惁锛岃鏄庡師鍥狅級
```

---

## 3. 楠屾敹鏍囧噯蹇呭瑕佺礌锛氱敓浜т唬鐮佸疄鐜?
楠屾敹鏃舵瘡鏉?Gap **蹇呴』**鍦ㄥ搴旇涓啓鏄庝互涓嬪瓙椤癸紝鍙洿鎺ョ敤涓嬭〃浣滀负璇存槑鍧楋細

```markdown
#### 1. 鐢熶骇浠ｇ爜瀹炵幇锛堝繀椤婚€愰」鍒楀嚭锛?
楠屾敹鏃?*蹇呴』**鍦ㄥ搴?Gap 琛屼腑鍐欐槑锛?
| 瀛愰」 | 蹇呴』鍒楀嚭鐨勫唴瀹?| 绀轰緥 |
|------|----------------|------|
| **鏂囦欢璺緞** | 淇敼/鏂板鐨勭敓浜т唬鐮佹枃浠讹紙缁濆鎴栫浉瀵硅矾寰勶級 | `vnpy/datafeed/hot_data_source.py`銆乣vnpy/datafeed/indicator_worker.py` |
| **绫诲悕** | 瀹炵幇璇?Gap 鐨勫叿浣撶被 | `GlobalDataSource`銆乣SharedTimeframeDataStore`銆乣SmartBarDataLoader` |
| **鏂规硶鍚?* | 鍏抽敭鏂规硶锛堝惈绛惧悕鎴栬涓鸿鏄庯級 | `initialize(create=True)`銆乣update_bar(bar, is_realtime)`銆乣get_or_create_store(...)`銆乣load_bars(...)`銆乣submit_calculation(...)` |
| **浠ｇ爜瀹炵幇缁嗚妭** | 璋冪敤閾俱€佸叧閿€昏緫銆乬rep 鍙畾浣嶇壒寰?| 璋佸湪浣曟椂璋冪敤璋侊紱鏁版嵁濡備綍鍐欏叆鍏变韩鍖猴紱Worker 濡備綍浠庤鍥捐锛沗grep -n "write_bars\|get_view" 鏂囦欢` 鍙畾浣?|
```

---

## 4. 楠屾敹鏍囧噯蹇呭瑕佺礌锛氶泦鎴愭祴璇?
楠屾敹鏃舵瘡鏉?Gap **蹇呴』**鍦ㄥ搴旇涓啓鏄庡苟鍦ㄩ獙鏀舵椂鎵ц锛屽彲鐩存帴鐢ㄤ笅琛ㄤ綔涓鸿鏄庡潡锛?
```markdown
#### 2. 闆嗘垚娴嬭瘯锛堝繀椤婚€愰」鍒楀嚭骞跺～鍐欐墽琛屾儏鍐碉級

楠屾敹鏃?*蹇呴』**鍦ㄥ搴?Gap 琛屼腑鍐欐槑骞跺湪楠屾敹鏃舵墽琛岋細

| 瀛愰」 | 蹇呴』鍒楀嚭鐨勫唴瀹?| 绀轰緥 |
|------|----------------|------|
| **娴嬭瘯鏂囦欢璺緞** | 闆嗘垚娴嬭瘯鎵€鍦ㄦ枃浠?| `tests/test_hot_data_source_integration.py`銆乣tests/test_gds_load_and_worker_integration.py` |
| **娴嬭瘯鐢ㄤ緥鍚?* | 鍏蜂綋鐢ㄤ緥鍑芥暟鍚嶏紙鍙涓級 | `test_global_data_source_singleton`銆乣test_load_1min_writes_to_gds`銆乣test_worker_reads_from_ringbuffer_view` |
| **鎵ц鍛戒护** | 瀹屾暣鍙墽琛屽懡浠?| `pytest tests/test_hot_data_source_integration.py -v`銆乣pytest tests/ -k "gds or ringbuffer" -v` |
| **棰勬湡缁撴灉** | 鐢ㄤ緥閫氳繃鏉′欢 | 涓婅堪鐢ㄤ緥鍏ㄩ儴 PASSED銆佹棤 FAILED |
| **鎵ц鎯呭喌** | 楠屾敹鏃?*蹇呭～** | `[ ] 寰呮墽琛宍 / `[x] 閫氳繃` / `[ ] 澶辫触锛堟敞鏄庡師鍥狅級`锛涙湭鎵ц鎴栧け璐ヤ笉寰楀嬀閫夈€岄獙璇侀€氳繃銆?|
```

---

## 5. 楠屾敹鎵ц瑙勫垯锛堝潡锛?
鍙洿鎺ュ鍒跺埌 tasks.md 鐨勩€岄獙鏀舵墽琛岃鍒欍€嶅皬鑺傦細

```markdown
#### 楠屾敹鎵ц瑙勫垯

- **鐢熶骇浠ｇ爜**锛氶€愭潯鏍稿銆屾枃浠?/ 绫?/ 鏂规硶 / 瀹炵幇缁嗚妭銆嶆槸鍚︿笌琛ㄤ腑鎻忚堪涓€鑷达紱鍙€氳繃 grep銆侀槄璇绘簮鐮佺‘璁ゃ€?- **闆嗘垚娴嬭瘯**锛氬繀椤昏繍琛岃〃涓€屾墽琛屽懡浠ゃ€嶏紝鏍规嵁瀹為檯缁撴灉濉啓銆屾墽琛屾儏鍐点€嶏紱鏈繍琛屾垨澶辫触鍒欎笉寰楀湪銆岄獙璇侀€氳繃銆嶅垪鎵撳嬀銆?- **lint锛堝繀椤伙級**锛氶」鐩』鎸夊叾鎵€鐢ㄦ妧鏈爤閰嶇疆骞舵墽琛屽搴旂殑 Lint 宸ュ叿锛堣 lint-requirement-matrix.md锛夛紱楠屾敹鍓嶉』鎵ц涓旀棤閿欒銆佹棤璀﹀憡銆傝嫢椤圭洰浣跨敤涓绘祦璇█浣嗘湭閰嶇疆璇ヨ瑷€鐨?Lint 宸ュ叿锛岄』浣滀负閲嶈璐ㄩ噺闂淇锛屽璁′笉浜堥€氳繃銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶄负鐢辫眮鍏嶃€?- **楠岃瘉閫氳繃**锛氫粎褰撱€岀敓浜т唬鐮佸疄鐜般€嶃€岄泦鎴愭祴璇曘€嶅強銆宭int銆嶅潎婊¤冻锛屼笖鎵ц鎯呭喌涓恒€岄€氳繃銆嶆椂锛屾柟鍙湪銆岄獙璇侀€氳繃銆嶅垪鍕鹃€?`[x]`銆?- **闃诲澶勭悊**锛氳嫢鏌愭潯 Gap 鍥犱緷璧栨垨骞冲彴闄愬埗鏃犳硶瀹屽叏婊¤冻锛岄』鍦ㄤ换鍔′腑**鎶ュ憡闃诲**骞舵敞鏄庡師鍥狅紝涓嶅緱鍕鹃€夈€岄獙璇侀€氳繃銆嶃€?
涓嬭〃銆岀敓浜т唬鐮佸疄鐜拌鐐广€嶄笌銆岄泦鎴愭祴璇曡姹傘€嶅垪缁欏嚭姣忔潯 Gap 鐨勪笂杩板繀澶囪绱狅紱楠屾敹鏃堕渶閫愭潯鏍稿銆佹墽琛屾祴璇曞苟濉啓銆屾墽琛屾儏鍐点€嶅垪銆?```

---

## 6. 楠屾敹鎵ц璇存槑锛堢畝鐭増锛岀敤浜庢枃妗ｆ湯灏撅級

```markdown
### 楠屾敹鎵ц璇存槑

- **鐢熶骇浠ｇ爜锛堝繀椤诲垪鍑猴級**锛氶獙鏀舵椂閫愭潯鏍稿銆岀敓浜т唬鐮佸疄鐜拌鐐广€嶁€斺€?*鏂囦欢璺緞**銆?*绫诲悕**銆?*鏂规硶鍚?*銆?*浠ｇ爜瀹炵幇缁嗚妭**锛堣皟鐢ㄩ摼銆佸叧閿€昏緫銆乬rep 鍙畾浣嶇壒寰侊級鏄惁鍦ㄨ〃涓啓鏄庝笖涓庢簮鐮佷竴鑷达紱鍙€氳繃 grep銆侀槄璇绘簮鐮佺‘璁ゃ€?- **闆嗘垚娴嬭瘯锛堝繀椤诲垪鍑哄苟鎵ц锛?*锛氭瘡鏉?Gap 鐨勩€岄泦鎴愭祴璇曡姹傘€嶉』鍐欐槑**娴嬭瘯鏂囦欢璺緞**銆?*娴嬭瘯鐢ㄤ緥鍚?*銆?*鎵ц鍛戒护**銆?*棰勬湡缁撴灉**锛涢獙鏀舵椂蹇呴』杩愯琛ㄤ腑銆屾墽琛屽懡浠ゃ€嶏紝骞跺湪銆屾墽琛屾儏鍐点€嶅垪濉啓锛歚[ ] 寰呮墽琛宍 / `[x] 閫氳繃` / `[ ] 澶辫触锛堟敞鏄庡師鍥狅級`锛涙湭鎵ц鎴栧け璐ヤ笉寰楀嬀閫夈€岄獙璇侀€氳繃銆嶃€?- **lint锛堝繀椤伙級**锛氶」鐩』鎸夋妧鏈爤閰嶇疆骞舵墽琛?Lint锛堣 lint-requirement-matrix锛夛紱鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint 椤讳慨澶嶏紱宸查厤缃殑椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶈眮鍏嶃€?- **楠岃瘉閫氳繃**锛氫粎褰撱€岀敓浜т唬鐮佸疄鐜般€嶃€岄泦鎴愭祴璇曘€嶅強銆宭int銆嶅潎婊¤冻锛屼笖銆屾墽琛屾儏鍐点€嶄负閫氳繃鏃讹紝鏂瑰彲鍦ㄣ€岄獙璇侀€氳繃銆嶅垪鎵撳嬀 `[x]`銆?- **闃诲澶勭悊**锛氳嫢鏌愭潯 Gap 鍥犱緷璧栨垨骞冲彴闄愬埗鏃犳硶瀹屽叏婊¤冻锛岄』鍦ㄤ换鍔′腑**鎶ュ憡闃诲**骞舵敞鏄庡師鍥狅紝涓嶅緱灏嗐€岄獙璇侀€氳繃銆嶅嬀閫変负瀹屾垚銆?```

---

## 7. Gaps 鈫?浠诲姟瑕嗙洊鏍稿瑙勫垯锛堝潡锛?
鐢ㄤ簬銆孏aps 鈫?浠诲姟鏄犲皠瀹屾暣娓呭崟銆嶅紑澶寸殑鏍稿瑙勫垯璇存槑锛?
```markdown
**鏍稿瑙勫垯**锛欼MPLEMENTATION_GAPS.md锛堟垨 IMPLEMENTATION_GAPS_Vx.md锛変腑鍑虹幇鐨?*姣忎竴鏉?* Gap 蹇呴』鍦ㄦ湰浠诲姟琛ㄤ腑鍑虹幇涓斿搴斿埌浠诲姟 Txxxx鈥揟xxxx锛涗笉寰楅仐婕忋€?```

```markdown
**缁撹**锛氭湰浠诲姟鍒楄〃涓?IMPLEMENTATION_GAPS_xx.md **涓€涓€瀵瑰簲**锛涙寜绔犺妭 N 鏉?Gap + 鍥涚被姹囨€?M 鏉?Gap 鍧囧湪涓婅堪涓よ〃涓嚭鐜板苟鏄犲皠鍒颁换鍔?Txxxx鈥揟xxxx锛?*鏃犻仐婕?*銆傞獙鏀舵椂浠ャ€屾寜闇€姹傛枃妗ｇ珷鑺傘€嶈〃涓庛€屽洓绫绘眹鎬汇€嶈〃涓哄噯閫愭潯鎵ц銆?```

---

## 8. Runnable Slice 鍏冩暟鎹ā鏉匡紙姣忎釜 Journey Slice 蹇呭～锛?
```markdown
### Journey Slice 鍏冩暟鎹?
- **Journey ID**: `J01`
- **Invariant ID**: `INV-01` / `INV-N/A`锛堣嫢涓?N/A锛屽繀椤诲啓鍘熷洜锛?- **Evidence Type**: `unit` / `integration` / `smoke-e2e` / `full-e2e` / `closure-note`
- **Verification Command**: `[瀹屾暣鍛戒护]`
- **Closure Note Path**: `closure-notes/J01.md`
- **Definition Gap IDs**: `DG-01` / `N/A`
- **Implementation Gap IDs**: `IG-01` / `N/A`
- **Deferred Gap IDs**: `J04-Smoke-E2E` / `N/A`
- **Production Path**: `src/app/checkout/page.tsx`
- **Acceptance Evidence**: `reports/checkout-proof.md`
```

**瑕佹眰**锛?- 姣忎釜 runnable slice 閮藉繀椤诲啓鍏ㄤ笂杩板瓧娈点€?- `Evidence Type` 涓嶈兘鐣欑┖锛涜嫢涓€涓?slice 鏈夊涓瘉鎹眰锛岄渶閫愭潯鍒楀嚭銆?- `Closure Note Path` 涓虹┖鏃讹紝涓嶅緱瀹ｇО Journey 瀹屾垚銆?- `Production Path` 涓虹┖鏃讹紝璇存槑鐪熷疄鐢熶骇浠ｇ爜鍏ュ彛杩樻湭缁戝畾銆?- `Acceptance Evidence` 涓虹┖鏃讹紝涓嶅緱瀹ｇО璇?Journey 宸插畬鎴愰獙鏀躲€?
---

## 9. Journey 楠屾敹妯℃澘锛堣瘉鏄庡畬鎴?+ 鏀跺彛锛?
```markdown
### Journey 楠屾敹

| Journey ID | 瀵瑰簲浠诲姟 | 鍝潯娴嬭瘯璇佹槑瀹屾垚 | Verification Command | Closure Note | Gap 绫诲瀷 |
|------------|----------|------------------|----------------------|--------------|----------|
| J01 | T021, T022, T023 | `tests/e2e/smoke/test_checkout.py::test_checkout_smoke` | `pytest tests/e2e/smoke/test_checkout.py -v` | `closure-notes/J01.md` | Implementation Gap |
| J02 | T024, T025 | `N/A`锛堝綋鍓嶄粛鏄畾涔夋緞娓咃級 | `N/A` | `closure-notes/J02.md`锛堟爣璁?deferred锛?| Definition Gap |
```

**瑕佹眰**锛?- 楠屾敹蹇呴』鏄庣‘鍐欏嚭鈥滅敱鍝潯娴嬭瘯璇佹槑瀹屾垚鈥濓紝涓嶈兘鍙啓鈥滃凡瑕嗙洊娴嬭瘯鈥濄€?- 楠屾敹蹇呴』鏄庣‘鍐欏嚭鈥滅敱鍝潯 closure note 鏀跺彛鈥濓紝涓嶈兘鍙啓鈥滃凡璁板綍鈥濄€?- 鑻ュ綋鍓嶄换鍔″彧鏄湪娑堥櫎 `definition gap`锛屽繀椤绘槑纭爣娉ㄤ负 `Definition Gap`锛岀姝㈠€熸瀹ｇО鍔熻兘宸插彲璺戦€氥€?- 鑻ュ綋鍓嶄换鍔℃槸鍦ㄤ慨澶嶄唬鐮佹垨鎺ョ嚎闂锛屾爣娉ㄤ负 `Implementation Gap`锛屽苟缁欏嚭鐪熷疄楠岃瘉鍛戒护銆?
---

## 10. Deferred Gap 涓?Journey 鏀跺彛妯℃澘

```markdown
### Deferred Gap Closure / Carry-Forward

| Gap ID | Journey IDs | Closure Evidence | Carry-Forward Evidence | Production Path Evidence | Smoke / Full E2E | Acceptance Evidence |
|--------|-------------|------------------|------------------------|--------------------------|------------------|--------------------|
| J04-Smoke-E2E | J04 | `commit:abc123` | `N/A` | `src/app/checkout/page.tsx` | `tests/e2e/smoke/checkout.spec.ts` / deferred nightly | `reports/checkout-proof.md` |
| J09-Full-E2E | J04 | `N/A` | `carry-forward note in closure-notes/J04.md` | `src/app/checkout/page.tsx` | full deferred | `reports/checkout-proof.md` |
```

**瑕佹眰**锛?- `resolved` gap 蹇呴』鏈?`Closure Evidence`
- `carried_forward` gap 蹇呴』鏈?`Carry-Forward Evidence`
- 褰卞搷鐪熷疄鍔熻兘鐨?gap 杩樺繀椤诲悓鏃剁粰鍑?`Production Path Evidence`銆乣Smoke / Full E2E`銆乣Acceptance Evidence`
