# TASKS_v1.audit - Gate Audit Checklist

> 鐢ㄩ€旓細涓?`docs/plans/TASKS_v1.md` 閰嶅銆傛瘡瀹屾垚涓€涓换鍔″嵆鎵ц鏈竻鍗曪紝褰㈡垚缁熶竴 gate 璇佹嵁锛岄伩鍏嶁€滃畬鎴愪簡浣嗕笉鍙獙璇佲€濄€?>
> 缁熶竴寮曠敤锛坰ingle source锛夛細
> - 绛栫暐灞傦細`_bmad/_config/orchestration-governance.contract.yaml`
> - 浜嬪疄灞傦細`_bmad-output/runtime/governance/user_story_mapping.json`

---

## 0. 鏃跺簭鍥惧弬鑰冿紙涓诲惊鐜鐓э級

- **鐜扮姸涓庣洰鏍囨€?*鐨勬椂搴忓浘鍙?**Host parity 娉抽亾瀛愬浘**瑙?`docs/plans/TASKS_v1.md` **绗?0.3 鑺?*锛?.3.1 / 0.3.2 / **0.3.3**锛涘惈 Mermaid 婧愮爜锛屼究浜庤瘎瀹′笌 diff锛夈€?- 瀹¤ **G1锛堜富寰幆濂戠害锛?* 鏃讹紝搴旂敤璇ユ椂搴忛€愰」鏍稿锛歚inspect 鈫?dispatch-plan 鈫?packet 鐢熷懡鍛ㄦ湡 鈫?ingest 鈫?closeout` 鏈绗簩 orchestrator銆侀殣寮忚亰澶╂垨骞宠绛栫暐婧愭梺璺浛浠ｃ€?
---

## A. 鍏ㄥ眬瀹¤瑙勫垯锛堟瘡涓换鍔￠兘瑕佹墽琛岋級

1. **璇佹嵁浼樺厛**锛氭病鏈夊懡浠よ緭鍑烘憳瑕佹垨宸ヤ欢璺緞锛岃涓烘湭瀹屾垚銆?2. **涓绘帶涓€鑷存€?*锛氫笉寰楀紩鍏モ€滅浜?orchestrator鈥濊涓猴紙鍚庡彴鑷鎺ㄨ繘涓绘祦绋嬶級銆?3. **璇箟涓€鑷存€?*锛歚hooks/no-hooks` 蹇呴』鍚屾瀯锛屼笉鍏佽鍑虹幇涓ゅ nextAction 璇箟銆?4. **瀹屾垚璇箟**锛氬繀椤绘弧瓒?`gate pass + closeout approved`锛屽惁鍒欎换鍔″彧鑳芥爣璁颁负 `partial`銆?5. **鍙洖婊?*锛氫换浣曢珮椋庨櫓鏀瑰姩蹇呴』缁欏嚭鍥為€€绛栫暐鎴?feature flag銆?6. **鍗曚竴鐪熺浉婧?*锛氱瓥鐣ュ眰鍙 `orchestration-governance.contract.yaml`锛屼簨瀹炲眰鍙 `user_story_mapping.json`銆?7. **杈圭晫濂戠害**锛?   - contract 鍙畾涔夎鍒欙紝涓嶅瓨杩愯浜嬪疄锛?   - mapping 鍙瓨浜嬪疄锛屼笉瀛樿鍒欓槇鍊硷紱
   - runtime policy 鍙瓨浼氳瘽鍙傛暟锛屽苟甯?`contractHash + mappingHash`锛?   - 涓诲惊鐜垽瀹氬彧璁?`inspect surface` 鍗曞叆鍙ｏ紱
   - single-source 娴嬭瘯澶辫触鍗虫暣浣撻獙鏀跺け璐ャ€?8. **瀛楁鐧藉悕鍗?*锛氫互 `docs/plans/TASKS_v1.md` 搂0.1.2 涓哄噯锛涚櫧鍚嶅崟澶栧瓧娈典竴寰嬪垽瀹氳繚瑙勩€?
---

## B. Gate 鍒嗙骇

### G0 - 鍙樻洿瀹屾暣鎬?Gate
- [ ] 浠ｇ爜鏀瑰姩涓庝换鍔＄洰鏍囦竴鑷达紙鏃犺秺鐣屽疄鐜帮級
- [ ] 蹇呰鏂囨。鏇存柊宸插畬鎴?- [ ] 瀵瑰簲娴嬭瘯鏂囦欢宸叉柊澧?鏇存柊
- [ ] 鏃犵牬鍧忔€ф敼鍔ㄦ湭澹版槑

### G1 - 涓诲惊鐜绾?Gate
- [ ] 涓?Agent 浠嶄负鍞竴 owner
- [ ] 瀛愪唬鐞嗕粛涓?bounded execution
- [ ] `recommendation` 涓嶅彲鐩存帴 dispatch锛堟湁闃叉姢锛?- [ ] `inspect -> dispatch-plan -> packet lifecycle -> ingest -> closeout` 涓婚摼鏈牬鍧?
### G2 - 鐘舵€佹満涓庢仮澶?Gate
- [ ] 骞傜瓑鎬ч€氳繃锛堥噸澶嶆墽琛屾棤閲嶅鍓綔鐢級
- [ ] 涓柇鎭㈠閫氳繃锛坮esume 鍚庣姸鎬佷竴鑷达級
- [ ] `gatesLoop` 閲嶈瘯/鐔旀柇琛屼负绗﹀悎棰勬湡
- [ ] 鐘舵€佸伐浠跺彲杩芥函锛坰tate/packet/report 璺緞鍙锛?
### G3 - Host Parity Gate
- [ ] Cursor 璺緞閫氳繃
- [ ] Claude 璺緞閫氳繃
- [ ] no-hooks 璺緞閫氳繃
- [ ] 涓夎矾寰勫叧閿瓧娈典竴鑷达紙phase/nextAction/pendingPacket锛?
### G4 - Closeout Gate
- [ ] 浠呭湪 gate pass 鍚庤繘鍏?closeout
- [ ] closeout 缁撴灉鍐欏洖 orchestration state
- [ ] 鏈€氳繃 closeout 涓嶅緱鏍囪 done

### G5 - Contract/Index Gate锛堟柊澧烇級
- [ ] five-signal 涓?stage gate 瑙勫垯浠呮潵鑷?contract
- [ ] 璺敱/婕傜Щ/绾崇浜嬪疄浠呮潵鑷?user_story_mapping index
- [ ] 涓诲惊鐜笉瀛樺湪绗笁绛栫暐鏉ユ簮锛堟枃妗?涓存椂鑴氭湰/纭紪鐮侊級
- [ ] contract 鏂囦欢鐗堟湰涓庤繍琛屾棩蹇楄褰曚竴鑷?- [ ] `adaptive_intake_governance_gate` 鍦?intake/reroute/closeout 鍓嶈Е鍙?- [ ] runtime policy 浠呭寘鍚細璇濆弬鏁帮紝涓旈檮 `contractHash + mappingHash`
- [ ] 涓诲惊鐜垽瀹氫粎缁?`inspect surface`锛堟棤鏃佽矾鍒ゅ畾锛?- [ ] contract/mapping/runtimePolicy 瀛楁鍧囩鍚堢櫧鍚嶅崟锛堣 `docs/plans/TASKS_v1.md` 搂0.1.2锛?- [ ] 鏈嚭鐜扮櫧鍚嶅崟澶栧瓧娈垫垨榛戝悕鍗曞瓧娈?
---

## C. 浠诲姟绾у璁℃竻鍗曪紙瀵瑰簲 TASKS_v1 閫愰」锛?
## M1 瀹¤

### T1.1 Host Parity 鍥炲綊鐭╅樀
- [ ] 鏂板鍥炲綊娴嬭瘯鍙湪 CI 绋冲畾杩愯
- [ ] 鍩虹嚎鎶ュ憡宸茶緭鍑哄埌 `docs/ops/host-parity-regression-matrix.md`
- [ ] 澶辫触鏍蜂緥鏈夋槑纭垎绫伙紙host bug / orchestration drift / flaky锛?
### T1.2 State 骞傜瓑涓庨噸鍏?- [ ] claim/dispatch/complete/invalidate 閲嶅鎵ц鏃犳薄鏌?- [ ] 涓柇鐐规仮澶嶅悗 `originalExecutionPacketId` 鏈涪澶?- [ ] `gatesLoop.retryCount` 琛屼负姝ｇ‘

### T1.3 Gates Loop 寮傚父琛ュ伩
- [ ] retry budget 鐢熸晥
- [ ] no-progress 鐔旀柇鐢熸晥
- [ ] 鐔旀柇鍚?nextAction = blocked 涓旀湁 machine-readable reason

### T1.4 Contract/Index 鏀舵暃鎺ュ叆
- [ ] `orchestration-governance.contract.yaml` 宸插垱寤哄苟鐢熸晥
- [ ] `user_story_mapping.json` 宸插垱寤哄苟鐢熸晥
- [ ] 涓诲惊鐜彧璇诲彇 contract + index

### T1.5 StageName 瀵归綈娌荤悊鍚堝悓
- [ ] `stage_requirements` 閿笌杩愯鏃?`StageName` 瀵归綈锛堟棤闈欓粯鏈畾涔夐樁娈碉級
- [ ] `tests/acceptance/governance-stage-requirements-alignment.test.ts` 鍦?CI 绋冲畾閫氳繃
- [ ] 瀵归綈缁撴灉宸茶鍏ユ湰 audit-log 瀵瑰簲鏉＄洰

### T1.6 杩斿伐闂幆鑷姩缁窇
- [ ] 瑙﹀彂 `auto_repairable_block` 鍚庯紝涓诲惊鐜繘鍏?`dispatch_remediation`
- [ ] 杩斿伐 `TaskReport(done)` 鍚庯紝1 涓富寰幆鍛ㄦ湡鍐呰嚜鍔ㄤ骇鐢熷瀹′笅涓€璺筹紙闈炰汉宸ヨЕ鍙戯級
- [ ] 澶嶅閫氳繃鍙洖涓婚摼锛坄dispatch_implement`/`run_closeout`锛夛紱澶辫触鍙彈鎺у啀杩斿伐
- [ ] Cursor/Claude/no-hooks 涓夎矾寰勭瓑浠烽€氳繃鍚屼竴 E2E fixture
- [ ] 瀹¤璇佹嵁鍖呭惈鍛戒护杈撳嚭鎽樿 + 鐘舵€佸伐浠惰矾寰勶紙缂轰竴涓嶅彲锛?
### T1.7 Release Gate 鎬绘帶鑴氭湰
- [ ] `main-agent:release-gate` 鍗曞懡浠ゅ彲鑱氬悎鍏抽敭闂ㄧ骞惰繑鍥炲敮涓€ pass/fail
- [ ] 浠讳竴瀛愰棬绂佸け璐ユ椂 exit code 闈?0
- [ ] 鎶ュ憡杈撳嚭鍖呭惈澶辫触椤广€佽瘉鎹矾寰勩€佷慨澶嶅缓璁?
### T1.8 浠ｇ爜璐ㄩ噺閫€鍖栫‖闃堝€?- [ ] 璐ㄩ噺闃堝€硷紙lint/澶嶆潅搴?閲嶅/鍏抽敭瑕嗙洊锛夊彲鏈哄櫒鏍￠獙
- [ ] 浠讳竴闃堝€?breach 鏃?`main-agent:quality-gate` 澶辫触
- [ ] 闃堝€兼枃妗ｄ笌鑴氭湰鐗堟湰涓€鑷达紙涓嶄竴鑷寸洿鎺?fail锛?
### T1.9 瀹¤鐘舵€佽嚜鍔ㄥ洖鍐?- [ ] `task-audit:sync-status` 鑷姩鏇存柊 audit-log 鐘舵€佹澘
- [ ] 妫€娴嬩笂娓?fail 涓嬫父 pass/in_progress 骞惰繑鍥炲け璐?- [ ] 妫€娴嬫墜宸ョ鏀圭姸鎬佷笖鏃犺瘉鎹苟杩斿洖澶辫触

### T1.10 鏁呴殰娉ㄥ叆涓庢仮澶嶉獙鏀?- [ ] 瑕嗙洊鏈€灏忔晠闅滈泦锛坧acket 涓㈠け/closeout fail/pending gate/涓柇鎭㈠/host 鍒囨崲锛?- [ ] 姣忎釜鍦烘櫙鏈夊彲鎭㈠璇佹嵁涓庢仮澶嶆鏁拌褰?- [ ] 浠讳竴鍦烘櫙鏈仮澶嶅埌鍙户缁姸鎬佸垯娴嬭瘯澶辫触

### T1.11 P0 纭牎楠岋紙validate-single-source-whitelist锛?- [ ] `validate:single-source-whitelist` 鍙墽琛屼笖 fail-closed
- [ ] contract/mapping/runtimePolicy 瀛楁瓒婄晫鍙妫€娴嬪苟闃绘柇
- [ ] 缂哄け `contractHash/mappingHash` 浼氬け璐?
### T1.12 P0 闂幆鏍￠獙锛坢ain-agent-rerun-gate-e2e-loop锛?- [ ] `test:main-agent-rerun-gate-e2e-loop` 鍙墽琛屼笖绋冲畾
- [ ] `rerun_gate` 鍚庤嚜鍔ㄧ画璺戝瀹¤璇佹槑锛堟棤闇€浜哄伐浜屾瑙﹀彂锛?- [ ] 闂幆澶辫触鍦烘櫙鑳借繑鍥為潪 0 骞剁粰鍑鸿瘉鎹?
### T1.13 P0 鎬婚棬绂侊紙main-agent:release-gate锛?- [ ] release-gate 鑱氬悎 T1.11 + T1.12 + 鍏抽敭 gate
- [ ] 浠讳竴瀛愰棬绂佸け璐ユ椂鏁翠綋澶辫触锛坋xit code 闈?0锛?- [ ] 鏈€氳繃 release-gate 绂佹瀹ｇО瀹屾垚

### T1.14 P0 鍐欏叆鍓嶇疆闂幆锛坰print-status 璧勬牸浠ょ墝锛?- [ ] release-gate 閫氳繃鍚庢墠绛惧彂 `completion-intent` 浠ょ墝
- [ ] 鏃犱护鐗屾墽琛?sprint-status 鍐欏叆蹇呴』澶辫触锛坋xit code 闈?0锛?- [ ] 鍐欏叆瀹¤璁板綍鍖呭惈 `sessionId/contractHash/gateReportPath/storyKey/fromStatus/toStatus`
- [ ] 涓嶅瓨鍦ㄦ湭鎺堟潈鑴氭湰鍐欏叆 sprint-status 鐨勬梺璺矾寰?
### T1.15 P0 鐪熺敤鎴疯矾寰?E2E锛堝弻瀹夸富 Claude/Codex锛?- [ ] 鍙屽涓?journey runner 瑕嗙洊 mock/real 涓ゅ眰
- [ ] E2E 閫氳繃鍓嶇姝㈡帹杩?sprint-status 鐘舵€?- [ ] 鍚堝悓 preflight/postflight 鍧囪緭鍑虹粨鏋勫寲璇佹嵁
- [ ] Claude/Codex 鍦ㄥ悓涓€ fixture 涓嬬粨璁轰竴鑷达紙pass/fail 涓€鑷达級

### T1.16 P0 鍙嶆梺璺‖闂ㄧ锛坰print-status 鍐欒矾寰勶級
- [ ] `validate:sprint-status-write-path` 鍙娴嬪苟闃绘柇闈炴巿鏉冨啓鍏?- [ ] release-gate 鎶ュ憡鍚?`blocked_sprint_status_update` 涓旇涔夋纭?- [ ] 妫€娴嬪埌鏃佽矾鍐欏叆鏃讹紝蹇呴』杈撳嚭鈥滅姝㈡洿鏂?sprint-status鈥濈殑鏄庣‘闃绘柇鍘熷洜

---

## M2 瀹¤

### T2.1 Long-Run Runtime Policy
- [ ] 闀胯窇绛栫暐鍙傛暟鍙厤缃紙checkpoint/compaction/retry budget锛?- [ ] 鍙傛暟琚富寰幆鐪熷疄娑堣垂锛屼笉鏄粎鏂囨。澹版槑
- [ ] 鍥炲綊娴嬭瘯瑕嗙洊绛栫暐杈圭晫鍊?
### T2.2 Soak Test (>=8h)
- [ ] soak 鑴氭湰鍙繍琛?- [ ] 鎶ュ憡妯℃澘宸茶惤鍦板苟鏈夋牱渚嬭緭鍑?- [ ] 鎭㈠鎴愬姛鐜囪揪鍒扮洰鏍囷紙>=95%锛?
---

## M3 瀹¤

### T3.1 Churn-in 璺敱璇勫垎鍣?- [ ] 璇勫垎缁村害鍙В閲婏紙impact/dependency/capacity锛?- [ ] reroute 涓嶈烦鍑轰富寰幆
- [ ] story/bugfix/standalone 涓夌被閮芥湁瑕嗙洊鐢ㄤ緥

### T3.2 Sprint Epic/Story Queue 鑷姩鑱斿姩
- [ ] Epic/Story Queue 鏇存柊宸ヤ欢鍙拷婧?- [ ] 渚濊禆鍏崇郴鏇存柊姝ｇ‘
- [ ] 澧為噺娉ㄥ叆鍚?DoD/Gate 涓嶈缁曡繃

### T3.3 Adaptive Intake Governance Gate
- [ ] 鍖归厤璇勫垎锛坉omain/dependency/sprint/risk/readiness锛夋湁杈撳嚭璇佹嵁
- [ ] mapping/lifecycle/sprint 涓夌被涓€鑷存€ф鏌ユ湁缁撴灉璁板綍
- [ ] 浠讳竴涓€鑷存€уけ璐ユ椂 verdict=block
- [ ] reroute 鍚庢棫 active mapping 姝ｇ‘闄嶇骇

---

## M4 瀹¤

### T4.1 Parallel Planner + Write Scope Lock
- [ ] 骞惰鍒嗙粍瑙勫垯鍙В閲?- [ ] writeScope 鍐茬獊妫€娴嬪噯纭?- [ ] 鍐茬獊鍚庤嚜鍔ㄩ噸鎺掓垨闄嶇骇涓茶鏈夎瘉鎹?
### T4.2 PR Topology Orchestration
- [ ] PR DAG 宸ヤ欢鐢熸垚鎴愬姛
- [ ] create/update/sync/merge 瑙勫垯鍙獙璇?- [ ] gate 澶辫触鏃朵笉浼氶敊璇帹杩涘悗缁?merge 鑺傜偣

---

## M5 瀹¤

### T5.1 ADR Drift Guard
- [ ] drift 妫€鏌ヨ剼鏈兘妫€娴嬧€滅浜?orchestrator鈥濆洖褰?- [ ] 涓?ADR 鍘熷垯鍐茬獊鏃舵祴璇曞け璐?- [ ] 澶辫触淇℃伅鍏峰淇鎸囧紩

### T5.2 涓夊悜杩借釜鐭╅樀
- [ ] 5澶х洰鏍囧潎鏄犲皠鍒颁唬鐮佽矾寰?- [ ] 姣忎釜鐩爣鍧囨槧灏勮嚦灏?涓?acceptance test
- [ ] 鏄犲皠鏂囨。鍙瀹¤鑷姩娑堣垂锛堢粨鏋勫寲锛?
### T5.3 Single Source Guard
- [ ] 骞宠鏍囧噯妫€娴嬫祴璇曞凡鎺ュ叆
- [ ] 璇诲彇鏉ユ簮瓒婄晫浼氬鑷存祴璇曞け璐?- [ ] 鎶ュ憡鍙寚鍑鸿繚瑙勬潵婧愯矾寰?
---

## D. 鏍囧噯瀹¤璁板綍妯℃澘锛堟瘡浠诲姟涓€浠斤級

```md
## Audit Record: <Task ID>

- Date:
- Owner:
- Scope:

### Evidence
- Commands run:
  - `<command>`
- Output summary:
  - `<key result>`
- Artifacts:
  - `<path>`

### Gate Results
- G0:
- G1:
- G2:
- G3:
- G4:
- G5:

### Verdict
- pass | partial | fail

### Follow-ups
- [ ] item 1
- [ ] item 2
```

---

## E. 寤鸿鎵ц椤哄簭

1. 姣忓畬鎴愪竴涓?`T*`锛屽厛璺戝搴旀祴璇曪紝鍐嶅～涓€浠?Audit Record銆?2. 姣忎釜閲岀▼纰戯紙M1~M5锛夌粨鏉熸椂锛屾墽琛屼竴娆?G0~G5 鍏ㄩ噺澶嶆牳銆?3. 浠讳竴 Gate fail锛氱珛鍗宠繘鍏ヤ慨澶嶏紝涓嶅緱鎺ㄨ繘涓嬩竴浠诲姟銆?4. 浠讳竴 Contract/Index 璺緞缂哄け锛氱洿鎺?fail锛屼笉鍏佽闄嶇骇璺宠繃銆?
