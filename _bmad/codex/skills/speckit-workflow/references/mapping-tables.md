# 鏄犲皠琛ㄥ垪鍚嶄笌缁撴瀯锛堝浐瀹氭ā鏉匡紝鍙鍒讹級

浠ヤ笅涓哄悇闃舵闇€姹傛槧灏勬竻鍗曠殑**琛ㄥご涓庡垪鍚?*鍥哄畾妯℃澘锛屽彲鐩存帴澶嶅埗鍒?spec.md / plan.md / IMPLEMENTATION_GAPS.md / tasks.md 涓娇鐢ㄣ€?
---

## 1. spec.md锛氶渶姹傛槧灏勬竻鍗曪紙spec 鈫?鍘熷闇€姹傛枃妗ｏ級

```markdown
## 闇€姹傛槧灏勬竻鍗曪紙spec.md 鈫?鍘熷闇€姹傛枃妗ｏ級

| 鍘熷鏂囨。绔犺妭 | 鍘熷闇€姹傝鐐?| spec.md 瀵瑰簲浣嶇疆 | 瑕嗙洊鐘舵€?|
|-------------|-------------|------------------|----------|
| 搂1 姒傝堪     | 锛堢畝杩帮級    | spec 搂...        | 鉁?/ 鉂?  |
| 搂2 ...      | ...         | spec 搂...        | 鉁?/ 鉂?  |
```

**璇存槑**锛氬師濮嬮渶姹傛枃妗ｇ殑姣忎竴绔犮€佹瘡涓€鏉￠』鍦?spec.md 涓湁鏄庣‘瀵瑰簲骞舵爣娉ㄨ鐩栫姸鎬併€?
---

## 2. plan.md锛氶渶姹傛槧灏勬竻鍗曪紙plan 鈫?闇€姹傛枃妗?+ spec锛?
```markdown
## 闇€姹傛槧灏勬竻鍗曪紙plan.md 鈫?闇€姹傛枃妗?+ spec.md锛?
| 闇€姹傛枃妗ｇ珷鑺?| spec.md 瀵瑰簲 | plan.md 瀵瑰簲 | 瑕嗙洊鐘舵€?|
|-------------|-------------|-------------|----------|
| 搂1          | spec 搂...   | plan Phase 1 / 搂... | 鉁?/ 鉂?|
| 搂2          | spec 搂...   | plan 搂...   | 鉁?/ 鉂?  |
```

**璇存槑**锛氶渶姹傛枃妗ｄ笌 spec.md 鐨勬瘡涓€绔犮€佹瘡涓€鏉￠』鍦?plan.md 涓湁鏄庣‘瀵瑰簲銆?
---

## 2A. plan.md锛欴eferred Gap Architecture Mapping

```markdown
## Deferred Gap Architecture Mapping

| Gap ID | 鏉ユ簮 | Architecture Refs | Work Item Refs | Journey Refs | Production Path Refs | 鐘舵€?|
|--------|------|-------------------|----------------|--------------|----------------------|------|
| J04-Smoke-E2E | readiness | `architecture.md#checkout` | `T021,T022` | `J04` | `src/app/checkout/page.tsx` | mapped |
```

**璇存槑**锛歛ctive Deferred Gaps 鍦?plan 闃舵蹇呴』鑷冲皯鏄犲皠鍒?architecture/work item锛涜嫢褰卞搷鐪熷疄鍔熻兘鍙敤鎬э紝杩樺繀椤绘樉寮忓啓鍑?`Journey Refs` 涓?`Production Path Refs`銆?
---

## 3. IMPLEMENTATION_GAPS.md锛欸ap 鍒楄〃琛ㄥご锛堟寜闇€姹傛枃妗ｇ珷鑺傦級

```markdown
## Gaps 娓呭崟锛堟寜闇€姹傛枃妗ｇ珷鑺傦級

| 闇€姹傛枃妗ｇ珷鑺?| Gap ID | 闇€姹傝鐐?| 褰撳墠瀹炵幇鐘舵€?| 缂哄け/鍋忓樊璇存槑 |
|-------------|--------|----------|-------------|---------------|
| 绗?N 绔?    | GAP-x.y | 锛堢畝杩帮級 | 宸插疄鐜?閮ㄥ垎/鏈疄鐜?| ... |
```

**璇存槑**锛氭寜鍘熷闇€姹傛枃妗ｉ€愮珷鑺傚垪鍑烘瘡鏉?Gap锛屾敞鏄庡疄鐜扮姸鎬佷笌缂哄け/鍋忓樊銆?
---

## 3A. IMPLEMENTATION_GAPS.md锛欴eferred Gap Lifecycle Classification

```markdown
## Deferred Gap Lifecycle Classification

| Gap ID | Gap Origin | Lifecycle Classification | Gap Type | 璇存槑 |
|--------|------------|--------------------------|----------|------|
| J04-Smoke-E2E | inherited | inherited_open | journey runnable gap | smoke proof 浠嶆湭褰㈡垚 |
| J07-Async-Proof | new | new_gap | evidence gap | 鏂板彂鐜扮殑 acceptance evidence 缂哄彛 |
```

**璇存槑**锛氳繖閲屽繀椤绘妸 inherited gap 鍜?new gap 鍒嗗紑锛沗Gap Type` 杩樺繀椤诲尯鍒?`definition gap`銆乣implementation gap`銆乣journey runnable gap`銆乣evidence gap`銆?
---

## 4. tasks.md锛氭湰鎵逛换鍔?鈫?闇€姹傝拷婧?
```markdown
## 鏈壒浠诲姟 鈫?闇€姹傝拷婧?
| 浠诲姟 ID | 闇€姹傛枃妗?| 绔犺妭 | 闇€姹傝鐐?|
|---------|----------|------|----------|
| Txxxx鈥揟xxxx | 锛堥渶姹傛枃妗ｆ枃浠跺悕锛?| 搂N, 搂M | 锛堢畝瑕佽鐐癸級 |
```

**璇存槑**锛氫换鍔?ID 鍙负鍗曚换鍔℃垨鑼冨洿锛涢渶姹傛枃妗ｃ€佺珷鑺傘€佽鐐归』鍙拷婧埌鍏蜂綋闇€姹傘€?
---

## 5. tasks.md锛欸aps 鈫?浠诲姟鏄犲皠锛堟寜闇€姹傛枃妗ｇ珷鑺傦級

```markdown
## Gaps 鈫?浠诲姟鏄犲皠锛堟寜闇€姹傛枃妗ｇ珷鑺傦級

**鏍稿瑙勫垯**锛欼MPLEMENTATION_GAPS.md 涓嚭鐜扮殑姣忎竴鏉?Gap 蹇呴』鍦ㄦ湰浠诲姟琛ㄤ腑鍑虹幇骞跺搴斿埌鍏蜂綋浠诲姟锛涗笉寰楅仐婕忋€?
| 绔犺妭 | Gap ID | 鏈换鍔¤〃琛?| 瀵瑰簲浠诲姟 |
|------|--------|------------|----------|
| 绗?N 绔?| GAP-x.y | 鉁?鏈?| Txxxx, Txxxx |
```

---

## 6. tasks.md锛欸aps 鈫?浠诲姟鏄犲皠锛堝洓绫绘眹鎬伙紝濡?D/S/I/M锛?
```markdown
## Gaps 鈫?浠诲姟鏄犲皠锛堝洓绫绘眹鎬伙級

| 绫诲埆 | Gap ID | 鏈换鍔¤〃琛?| 瀵瑰簲浠诲姟 |
|------|--------|------------|----------|
| 鏁版嵁鍔犺浇 | D1, D2, ... | 鉁?鏈?| Txxxx, ... |
| 鏁版嵁鍏变韩 | S1, S2, ... | 鉁?鏈?| Txxxx, ... |
```

**璇存槑**锛氳嫢 IMPLEMENTATION_GAPS 浣跨敤銆屾寜绔犺妭 + 鍥涚被姹囨€汇€嶅弻瑙嗚锛屽垯涓よ〃鍧囬渶瀛樺湪涓旀棤閬楁紡銆?
---

## 6A. tasks.md锛欴eferred Gap Task Binding

```markdown
## Deferred Gap Task Binding

| Gap ID | Task Binding Status | Task IDs | Smoke Task IDs | Closure Task ID | Explicit Defer Reason | Next Checkpoint |
|--------|---------------------|----------|----------------|-----------------|----------------------|-----------------|
| J04-Smoke-E2E | planned | T021,T022 | T023 | CLOSE-J04 |  | Sprint Review |
| J09-Full-E2E | explicitly_deferred |  |  |  | Nightly suite owned by QA backlog | Epic 3 Planning |
```

**璇存槑**锛歛ctive Deferred Gap 蹇呴』浜岄€変竴锛氳涔堢粦瀹?task锛岃涔堝啓 `Explicit Defer Reason`銆傝嫢 gap 褰卞搷鏌愭潯 Journey锛屽繀椤诲悓鏃跺啓 `Smoke Task IDs` 涓?`Closure Task ID`銆?
---

## 7. tasks.md锛氶獙鏀惰〃澶达紙鎸?Gap 閫愭潯楠岃瘉锛?
```markdown
### 鎸夐渶姹傛枃妗ｇ珷鑺傦紙GAP-x.y锛?
琛ㄥご璇存槑锛?*鐢熶骇浠ｇ爜瀹炵幇瑕佺偣**椤诲垪鍑烘枃浠躲€佺被銆佹柟娉曘€佷唬鐮佸疄鐜扮粏鑺傦紱**闆嗘垚娴嬭瘯瑕佹眰**椤诲垪鍑烘祴璇曟枃浠躲€佺敤渚嬪悕銆佹墽琛屽懡浠ゃ€侀鏈熺粨鏋滐紱**鎵ц鎯呭喌**楠屾敹鏃跺繀濉紙寰呮墽琛?閫氳繃/澶辫触鍙婂師鍥狅級锛涗粎褰撲袱鑰呮弧瓒充笖鎵ц鎯呭喌涓洪€氳繃鏃跺彲鍕鹃€?*楠岃瘉閫氳繃**銆?
| Gap ID | 瀵瑰簲浠诲姟 | 鐢熶骇浠ｇ爜瀹炵幇瑕佺偣锛堟枃浠?绫?鏂规硶/瀹炵幇缁嗚妭锛?| 闆嗘垚娴嬭瘯瑕佹眰锛堟祴璇曟枃浠?鐢ㄤ緥/鍛戒护/棰勬湡锛?| 鎵ц鎯呭喌 | 楠岃瘉閫氳繃 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| GAP-x.y | Txxxx | ... | ... | [ ] 寰呮墽琛?/ [x] 閫氳繃 / [ ] 澶辫触锛堝師鍥狅級 | [ ] / [x] |
```

---

## 8. tasks.md锛氬洓绫绘眹鎬婚獙鏀惰〃澶?
```markdown
### 鍥涚被姹囨€伙紙D/S/I/M锛?
| Gap ID | 瀵瑰簲浠诲姟 | 鐢熶骇浠ｇ爜瀹炵幇瑕佺偣锛堟枃浠?绫?鏂规硶/瀹炵幇缁嗚妭锛?| 闆嗘垚娴嬭瘯瑕佹眰锛堟祴璇曟枃浠?鐢ㄤ緥/鍛戒护/棰勬湡锛?| 鎵ц鎯呭喌 | 楠岃瘉閫氳繃 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| D1 | Txxxx, ... | ... | ... | [ ] / [x] 閫氳繃 / [ ] 澶辫触 | [ ] / [x] |
```

---

## 9. tasks.md锛欽ourney -> Task -> Test -> Closure 鏄犲皠

```markdown
## Journey -> Task -> Test -> Closure 鏄犲皠

| Journey ID | Invariant IDs | Task IDs | Smoke Proof | Full E2E | Closure Note |
|------------|---------------|----------|-------------|----------|--------------|
| J01 | INV-01, INV-02 | T021, T022, T023 | `tests/e2e/smoke/...` | `tests/e2e/full/...` 鎴?deferred reason | `closure-notes/J01.md` |
| J02 | INV-03 | T024, T025 | `tests/e2e/smoke/...` | `N/A`锛堝啓鏄庡師鍥狅級 | `closure-notes/J02.md` |
```

**璇存槑**锛氭瘡鏉?`P0 journey` 閮藉繀椤昏兘浠?`journey -> task -> test -> closure` 涓€璺拷婧紝绂佹鍙垪妯″潡浠诲姟鑰屾棤 smoke proof / closure 鏀跺彛銆?
---

## 9A. Journey Runtime Proof Mapping

```markdown
## Journey Runtime Proof Mapping

| Journey ID | Production Path | Smoke Proof | Full E2E / defer reason | Closure Note | Acceptance Evidence |
|------------|-----------------|-------------|--------------------------|--------------|--------------------|
| J01 | `src/app/checkout/page.tsx` | `tests/e2e/smoke/checkout.spec.ts` | `tests/e2e/full/checkout.spec.ts` | `closure-notes/J01.md` | `reports/checkout-proof.md` |
| J02 | `src/server/orders/create-order.ts` | `tests/e2e/smoke/order.spec.ts` | deferred: nightly owned by QA | `closure-notes/J02.md` | `reports/order-proof.md` |
```

**璇存槑**锛氳繖涓€琛ㄤ笓闂ㄩ槻鈥滀换鍔″畬鎴愪絾 Journey 涓?runnable鈥濄€俙Production Path`銆乣Smoke Proof`銆乣Closure Note`銆乣Acceptance Evidence` 缂轰换涓€椤癸紝Journey 閮戒笉鑳藉绉板畬鎴愩€?
---

## 10. Gap 鍒嗙被锛欴efinition Gap vs Implementation Gap

```markdown
## Definition Gap vs Implementation Gap

| Gap Type | Source | Current Handling | Owner | Next Gate |
|----------|--------|------------------|-------|----------|
| Definition Gap | spec / plan / readiness / audit | clarify / re-readiness / contract patch | PM / Architect / Owner | clarify / readiness |
| Implementation Gap | tasks / implement / verification / audit | code change / test fix / closure note | Dev / QA / Owner | implement / audit |
```

**璇存槑**锛?- `Definition Gap` 鎸囬渶姹傘€佸畬鎴愭€併€佹潈闄愯竟鐣屻€乫ixture / environment銆佷緷璧栬涔夌瓑瀹氫箟灞傜己鍙ｃ€?- `Implementation Gap` 鎸囦唬鐮佽矾寰勩€佺敓浜ф帴绾裤€乻moke/full 璇佹嵁銆乧losure note 绛夊疄鐜板眰缂哄彛銆?- 涓ょ被 gap **蹇呴』鍒嗗紑璁板綍**锛屼笉寰楀湪涓€鏉♀€滃紑鍙戜换鍔♀€濋噷娣峰啓鍚庣洿鎺ュ绉板姛鑳藉凡璺戦€氥€?
