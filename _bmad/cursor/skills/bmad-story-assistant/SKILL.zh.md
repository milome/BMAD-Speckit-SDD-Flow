---
name: bmad-story-assistant
description: |
  BMAD Story 鍔╂墜锛氭寜 Epic/Story 缂栧彿鎵ц瀹屾暣鐨?Create Story 鈫?瀹¤ 鈫?Dev Story 鈫?瀹炴柦鍚庡璁?宸ヤ綔娴併€?  闃舵闆讹細鍦ㄦ柊椤圭洰/worktree 鑷姩妫€娴嬪苟琛ヤ竵 party-mode 灞曠ず鍚嶄紭鍖栵紙鑻?_bmad 瀛樺湪涓旀湭浼樺寲锛夈€?  浣跨敤 subagent 鎵ц浠诲姟锛涘璁℃楠や紭鍏堥€氳繃 Cursor Task 璋冨害 code-reviewer锛?claude/agents/ 鎴?.cursor/agents/锛夛紝澶辫触鍒欏洖閫€ mcp_task generalPurpose銆?  閬靛惊 ralph-method銆乀DD 绾㈢豢鐏€乻peckit-workflow 绾︽潫銆備富 Agent 绂佹鐩存帴淇敼鐢熶骇浠ｇ爜銆?  **绂佹鍥?Epic/Story 宸插瓨鍦ㄥ嵆璺宠繃 party-mode**锛氫粎褰撶敤鎴锋槑纭銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃銆嶆椂鏂瑰彲璺宠繃 Create Story锛涘惁鍒欏繀椤绘墽琛?Create Story銆備富 Agent 鍦ㄨ繘鍏?Cursor party-mode 鍓嶅繀椤诲厛灞曠ず `20 / 50 / 100` 寮哄害閫夐」銆佺瓑寰呯敤鎴烽€夋嫨銆佸畬鎴愬彂璧峰墠鑷锛屽苟鐢卞涓诲湪 `SubagentStart` 娉ㄥ叆 `Party Mode Session Bootstrap (JSON)`锛涙秹鍙婃柟妗堥€夋嫨鎴栬璁″喅绛栨椂杩涘叆 party-mode 鑷冲皯 100 杞€?  閫傜敤鍦烘櫙锛氱敤鎴锋彁渚?Epic 缂栧彿涓?Story 缂栧彿锛堝 4銆? 琛ㄧず Story 4.1锛夛紝闇€鐢熸垚 Story 鏂囨。銆侀€氳繃瀹¤銆佹墽琛?Dev Story 骞跺畬鎴愬疄鏂藉悗瀹¤銆傚叏绋嬩腑鏂囥€?---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?
# BMAD Story 鍔╂墜

## 涓?Agent 缂栨帓闈紙寮哄埗锛?
浜や簰妯″紡涓嬶紝鍦ㄤ富 Agent 鍚姩銆佹仮澶嶆垨鏀跺彛 `story` 鎵ц閾句箣鍓嶏紝蹇呴』鍏堣鍙栵細

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action inspect
```

濡傞渶鐢熸垚姝ｅ紡娲惧彂璁″垝锛屽垯璇诲彇锛?
```bash
npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan
```

`mainAgentNextAction / mainAgentReady` 浠呬负 compatibility summary锛涚湡姝ｆ潈濞佺姸鎬佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
> **Party-mode source of truth锛圕ursor锛?*锛歚{project-root}/_bmad/cursor/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`銆侰ursor 鍒嗘敮鐨?party-mode rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit gate 璇箟閮戒互璇ユ枃浠朵负鍑嗭紱鏈?skill 鍙畾涔?Story 鍦烘櫙浣曟椂杩涘叆 party-mode锛屼笉寰楃淮鎶ょ浜屽 gate 璇箟銆?
### Party-Mode 涓?Agent 缂栨帓绾︽潫锛圕ursor锛?
- 杩涘叆 Cursor party-mode 鍓嶏紝涓?Agent 蹇呴』鍏堝悜鐢ㄦ埛灞曠ず `20 / 50 / 100` 涓夋。寮哄害锛屽苟鎸夎姹傜被鍨嬫帹鏂粯璁ゅ€笺€?- 鏅€?RCA / 鏂规鍒嗘瀽鎺ㄨ崘 `decision_root_cause_50`锛汣reate Story / Story 璁捐瀹氱 / 鏈€缁堜换鍔″垪琛ㄧ瓑楂樼疆淇℃渶缁堜骇鐗╂帹鑽?`final_solution_task_list_100`銆?*娉ㄦ剰锛氭帹鑽愭。浣嶄笉绛変簬鐢ㄦ埛宸查€夋。浣嶏紱鏈敹鍒扮敤鎴锋槑纭洖澶嶅墠锛屼富 Agent 涓嶅緱鎶婃帹鑽愭。浣嶅啓鎴愨€滃凡閫夋嫨鈥濄€?*
- 褰撲富 Agent 灞曠ず妗ｄ綅閫夐」鏃讹紝璇ユ潯娑堟伅蹇呴』鍋滃湪鎻愰棶澶勶紝绛夊緟涓嬩竴鏉＄敤鎴峰洖澶嶃€?*绂佹**鍚屼竴鏉″姪鎵嬫秷鎭噷鍚屾椂鍑虹幇銆岃纭閫夋嫨鍝釜妗ｄ綅銆嶄笌銆屾垨鎸夋帹鑽愭。浣嶅紑濮嬨€嶃€岀幇鍦ㄥ惎鍔?party-mode-facilitator銆嶄箣绫昏嚜鍔ㄥ彂璧疯〃杩般€?- `quick_probe_20` 浠呯敤浜?probe-only锛涜嫢鐢ㄦ埛褰撳墠閫夋嫨 `quick_probe_20` 鎴?`decision_root_cause_50`锛屽嵈鍙堟槑纭姹傞珮缃俊鏈€缁堜骇鐗╋紝涓?Agent 蹇呴』鎷掔粷褰撳墠妗ｄ綅骞惰姹傚崌绾у埌 `final_solution_task_list_100`銆?- 鐢ㄦ埛閫夋嫨妗ｄ綅鍚庯紝涓?Agent **蹇呴』**瀹屾垚鍙戣捣鍓嶈嚜妫€娓呭崟骞惰緭鍑?`銆愯嚜妫€瀹屾垚銆?..鍙互鍙戣捣銆俙
- Session Bootstrap JSON 鐢卞涓诲湪 `SubagentStart` 娉ㄥ叆锛屼富 Agent 涓嶅緱鐪佺暐璇ユ墽琛岄摼銆?- Cursor 鍒嗘敮涓笉鍋氫腑閫旀殏鍋滐紝涔熶笉鍦?`20 / 40 / ...` 杞浜よ繕涓?Agent锛涘瓙浠ｇ悊涓€鏃﹀惎鍔紝蹇呴』鍦ㄥ悓涓€浼氳瘽鍐呰繛缁繍琛屽埌鐢ㄦ埛閫夋嫨鐨勬€昏疆娆°€?- 鑻?party-mode 瀛愪唬鐞嗗湪 `22/50`銆乣10/50` 绛変腑閫旇疆娆℃彁鍓嶇粨鏉燂紝涓?Agent **涓嶅緱**鑷缁啓璁ㄨ鎴栦粠 Round 1 閲嶆柊寮€濮嬫€荤粨銆侰ursor 鐜板凡鏀寔 `subagentStop` hook锛屽涓讳細鍦?`subagentStop` 鑷姩瑙﹀彂 party-mode 杩斿洖鏀跺彛涓庢憳瑕佸埛鏂帮紱浣嗚繑鍥炲悗榛樿涓?*鍙厑璁稿厛鍗曠嫭杩愯** `node .cursor/hooks/party-mode-read-current-session.cjs --project-root "{project-root}"`銆傝繖鏉″懡浠ゅ繀椤讳綔涓?*鍗曠嫭涓€鏉?Node 鍛戒护**鎵ц锛?*绂佹**鎶?project-local helper 涓?fallback helper 鎷兼垚鍚屼竴鏉?shell 鍛戒护锛?*绂佹**浣跨敤 `||`銆乣2>&null`銆乣2>/dev/null`銆乣cmd /c`銆乣pwsh -c` 绛夊洖閫€閾俱€備粎褰撳凡缁忕‘璁?`.cursor/hooks/party-mode-read-current-session.cjs` 鐪熷疄涓嶅瓨鍦紝鎴栬鍗曟潯鍛戒护鏄庣‘杩斿洖 `MODULE_NOT_FOUND` / `ENOENT` 涓旀寚鍚?helper 鏂囦欢鏈韩鏃讹紝鎵嶅厑璁稿湪**绗簩姝ュ崟鐙繍琛?* `node _bmad/runtime/hooks/party-mode-read-current-session.cjs --project-root "{project-root}"`銆傝 helper 浼氬厛璇诲彇 `_bmad-output/party-mode/runtime/current-session.json Do not use shell probes; forbidden shell-probe diagnosis is prohibited before helper JSON evidence. `锛屽苟杈撳嚭缁熶竴鐨?JSON 璇婃柇鎽樿銆備富 Agent 浠ヨ helper 鐨?JSON 杈撳嚭浣滀负鍞竴妫€鏌ュ叆鍙ｏ紱**绂佹**鎸変慨鏀规椂闂寸寽娴嬧€滄渶鏂?`pm-*` 浼氳瘽鈥濄€傛鏌ラ『搴忓浐瀹氫负锛氣憼 `validation_status`銆乣status`銆乣session_key`銆乣target_rounds_total`锛涒憽 **鍏堣鍙?* `execution_evidence_level`锛岃瀛楁鍥哄畾涓?`none|pending|partial|final`锛歚none` 琛ㄧず褰撳墠 run 娌℃湁浠讳綍鍙鎵ц璇佹嵁锛沗pending` 琛ㄧず宸叉湁鍚姩/杩涜涓瘉鎹紝褰撳墠 run 浠嶈涓烘椿璺冿紱`partial` 琛ㄧず宸叉湁閮ㄥ垎鎵ц璇佹嵁锛屼絾杩樻病鏈夋渶缁堥樁娈?verdict锛沗final` 琛ㄧず宸叉湁鏈€缁堥樁娈佃瘉鎹垨鏈€缁?verdict锛涒憿 **浼樺厛璇诲彇** `visible_output_summary` 涓?`visible_fragment_record_present`锛屽厛鐪?`observed_visible_round_count`銆乣first_visible_round`銆乣last_visible_round`銆乣progress_current_round`銆乣progress_target_round`銆乣final_gate_present`銆乣final_gate_profile`銆乣final_gate_total_rounds`銆乣diagnostic_classification`銆乣quality_flags`銆乣excerpt`锛涒懀 **浠呭湪闇€瑕佹繁鎸栨椂**鍐嶈鍙?`session_log_path`銆乣snapshot_path`銆乣audit_verdict_path`銆乣visible_output_capture_path`銆?*绂佹**鍦ㄨ鍙?`visible_output_summary` 涔嬪墠鍏堢炕 `session log` 鎴?`tool-result.md`锛屼篃**绂佹**浣跨敤 `ls -la`銆乣mkdir -p`銆乣dir ... /b`銆乣2>/dev/null` 涓€绫荤洰褰?鏂囦欢鎺㈡祴鍛戒护銆傝嫢 helper 杈撳嚭 `diagnostic_classification=degenerate_placeholder_completion`锛屼富 Agent 鍙兘琛ㄨ堪涓恒€岀粨鏋勪笂宸茶窇瀹岋紝浣嗚璁哄唴瀹归€€鍖栦负鍗犱綅绗︺€嶏紝**涓嶅緱**璇啓鎴愨€滄彁鍓嶉€€鍑衡€濓紱鑻?helper 杈撳嚭 `diagnostic_classification=stub_only_completion`锛屼富 Agent 鍙兘琛ㄨ堪涓恒€屾湰娆″彧杩斿洖 completion stub銆嶏紝**涓嶅緱**浠呭嚟杩欎竴杞氨褰掔撼涓衡€淭ask tool 鍏ㄥ眬鏃犳硶澶勭悊 party-mode鈥濄€傚彧鏈夊綋 helper 杈撳嚭 `execution_evidence_level=none` 鏃讹紝鎵嶅厑璁歌繘涓€姝ユ€€鐤?transport / host 鎵ц閾惧け鏁堛€傝嫢 `validation_status != PASS` 鎴栨湭杈惧埌鐢ㄦ埛閫夋嫨鐨勬€昏疆娆★紝蹇呴』娌跨敤鍚屼竴杞涓庡悓涓€ gate profile 绔嬪嵆閲嶅彂 facilitator銆?
- 鑻?helper 杈撳嚭 `recovered_from_newer_launch = true` 鎴?`pending_launch_evidence_present = true`锛屼富 Agent 蹇呴』鎶婂綋鍓嶇粨鏋滆В閲婁负**瀛樺湪鏇存柊鐨?pending / active launch**锛屼笉寰楃户缁紩鐢ㄦ洿鏃х殑 completed session 浣滀负褰撳墠 Story run 鐨勭粨鏋滐紝涔熶笉寰楁嵁姝ゅ绉板綋鍓?run 宸茬粨鏉熴€?
### RCA 鍥哄寲锛氫负浠€涔堜互鍓嶇湅璧锋潵鏇寸ǔ瀹?
- 鏃ч摼璺洿鈥滅ǔ瀹氣€濈殑琛ㄨ薄锛屽緢澶т竴閮ㄥ垎鏉ヨ嚜**瀹芥澗鍒ゅ畾**锛氭湁杩斿洖鏂囨湰銆佹湁鏈€缁堝潡銆佺敋鑷冲彧鏈夊急璇佹嵁鏃讹紝灏卞彲鑳借榛樿涓衡€滃畬鎴愨€濄€?- 鐜板湪杩斿洖璇婃柇鏇寸粏锛屽緢澶氭棫闂浼氱洿鎺ユ毚闇蹭负 `degenerate_placeholder_completion` 鎴?`stub_only_completion`銆?- 鍚屾椂锛岃繎鏈?party-mode 鐨勭姸鎬侀摼璺瘮浠ュ墠澶嶆潅锛岀‘瀹炰篃瀛樺湪鐪熷疄鐨勬柊鍥炲綊闈€?- 鍥犳 Story 鍦烘櫙涓嬬殑涓?Agent 蹇呴』鏄惧紡鍖哄垎锛?  - 鏃ч棶棰樹互鍓嶈鍚炴帀锛岀幇鍦ㄨ鏄惧紡鍒嗙被
  - 鏂版不鐞嗛摼璺甫鏉ョ殑鍚屾椋庨櫓
- **绂佹**鎶婁袱鑰呮贩鍐欐垚鈥淭ask tool 鍏ㄥ眬鏃犳硶澶勭悊 party-mode鈥濇垨鈥滃綋鍓嶇幆澧冩暣浣撳け鏁堚€濄€?
### Cursor Party-Mode 鎵ц浣撶害鏉?
- 鍦ㄥ綋鍓?Cursor IDE 涓紝party-mode-facilitator 鍏佽閫氳繃 `generalPurpose-compatible` 鎵ц璺緞鎵胯浇锛沗.cursor/agents/party-mode-facilitator.md` 浠嶆槸 canonical prompt/source asset锛屽涓诲繀椤诲湪 `SubagentStart` 娉ㄥ叆 `Party Mode Session Bootstrap (JSON)`銆?- 鐢变簬 Cursor 鍒嗘敮涓嶅仛涓€旀殏鍋滄垨鍒嗘壒鍥炰紶锛屼富 Agent 鍦?party-mode 瀛愪唬鐞嗚繑鍥炲悗锛屽彧妫€鏌ュ叾鏄惁杈惧埌鐢ㄦ埛閫夋嫨鐨勬€昏疆娆″苟杈撳嚭鏈€缁堟€荤粨 / `## Final Gate Evidence`锛涜嫢鍦?`10/50`銆乣11/50`銆乣22/50` 绛変腑閫旇疆娆℃彁鍓嶇粨鏉燂紝涓?Agent **涓嶅緱**鑷缁啓璁ㄨ鎴栦粠 Round 1 閲嶆柊寮€濮嬫€荤粨锛屽繀椤绘部鐢ㄥ悓涓€鎬昏疆娆′笌鍚屼竴 gate profile 绔嬪嵆閲嶅彂 facilitator锛屾垨鏄惧紡鍚戠敤鎴锋姤鍛婂綋鍓嶆墽琛屼綋鏃犳晥銆?
## 蹇€熷喅绛栨寚寮?
### 浜斿眰鏋舵瀯姒傝
```
Layer 1: 浜у搧瀹氫箟灞?(Product Brief 鈫?澶嶆潅搴﹁瘎浼?鈫?PRD 鈫?Architecture)
Layer 2: Epic/Story瑙勫垝灞?(create-epics-and-stories)
Layer 3: Story寮€鍙戝眰 (Create Story 鈫?Party-Mode 鈫?Story鏂囨。)
Layer 4: 鎶€鏈疄鐜板眰 (宓屽speckit-workflow: specify鈫抪lan鈫扜APS鈫抰asks鈫扵DD)
Layer 5: 鏀跺熬灞?(鎵归噺Push + PR鑷姩鐢熸垚 + 寮哄埗浜哄伐瀹℃牳 + 鍙戝竷)
```

### 浣曟椂浣跨敤鏈妧鑳?- 闇€瑕佷粠Product Brief寮€濮嬪畬鏁寸殑浜у搧寮€鍙戞祦绋?- 闇€瑕丳RD/Architecture鐨勬繁搴︾敓鎴愬拰Party-Mode璁ㄨ
- 闇€瑕佽繘琛孍pic/Story鐨勮鍒掑拰鎷嗗垎
- 闇€瑕佸湪Story绾у埆杩涜鏂规閫夋嫨鍜岃璁″喅绛?
### 浣曟椂浣跨敤speckit-workflow
- 宸叉槑纭妧鏈疄鐜版柟妗堬紝鍙渶瑕佽缁嗘墽琛?- 宸叉湁Story鏂囨。锛岄渶瑕佽浆鎹负鎶€鏈鏍煎拰浠ｇ爜
- 涓嶉渶瑕佷骇鍝佸眰闈㈢殑璁ㄨ鍜屽喅绛?
### 涓よ€呭叧绯?鏈妧鑳藉寘鍚玸peckit-workflow浣滀负Layer 4鐨勫祵濂楁祦绋嬨€?褰撴墽琛屽埌"闃舵涓夛細Dev Story瀹炴柦"鏃讹紝浼氳嚜鍔ㄨЕ鍙憇peckit-workflow鐨勫畬鏁存祦绋嬨€?
---

鏈?skill 瀹氫箟 **Create Story 鈫?瀹¤ 鈫?Dev Story 鈫?瀹炴柦鍚庡璁?* 鐨勫畬鏁村伐浣滄祦銆侲pic 缂栧彿涓?Story 缂栧彿鐢辩敤鎴锋垨涓婁笅鏂囨彁渚涳紝浣滀负 skill 鐨勮緭鍏ュ弬鏁般€?
## 寮哄埗绾︽潫

- **涓?Agent 绂佹鐩存帴鐢熸垚 Story 鏂囨。**锛氶樁娈典竴 Create Story 浜у嚭鐨?Story 鏂囨。蹇呴』鐢?mcp_task 瀛愪唬鐞嗕骇鍑猴紱涓?Agent 涓嶅緱浠ャ€屽凡鏈夐渶姹傛枃妗ｃ€嶃€孍pic 宸叉槑纭€嶇瓑涓虹敱璺宠繃瀛愪唬鐞嗗苟鑷鎾板啓 Story 鏂囨。銆?- **涓?Agent 绂佹鐩存帴淇敼鐢熶骇浠ｇ爜**锛氬疄鏂藉繀椤婚€氳繃 mcp_task 瀛愪唬鐞嗘墽琛屻€?- **绂佹鍥?Epic/Story 宸插瓨鍦ㄥ嵆璺宠繃 party-mode**锛氫粎褰撶敤鎴?*鏄庣‘**璇存槑銆孲tory 宸查€氳繃 party-mode 涓斿璁￠€氳繃锛岃烦杩?Create Story銆嶆垨绗﹀悎渚嬪鍦烘櫙鏃讹紝鏂瑰彲璺宠繃闃舵涓€銆佷簩锛涘惁鍒欙紝鍗充娇 Epic/Story 鏂囨。宸插瓨鍦紙鍙兘鐢辩畝鍗?bmad 鍛戒护鐢熸垚銆佹湭缁?party-mode 娣卞叆璁ㄨ锛夛紝**蹇呴』**鎵ц Create Story銆傚嚒娑夊強浠ｇ爜瀹炵幇鐨?Story锛?*蹇呴』**杩涘叆 party-mode 鑷冲皯 100 杞京璁猴紙渚嬪鍦烘櫙瑙侀樁娈典竴 搂1.0锛夈€?
---

## 杈撳叆鍙傛暟

| 鍙傛暟 | 璇存槑 | 绀轰緥 |
|------|------|------|
| `epic_num` | Epic 缂栧彿 | 4 |
| `story_num` | Story 瀛愮紪鍙凤紙濡?1 琛ㄧず Story 4.1锛?| 1 |

Story 瀹屾暣鏍囪瘑涓?`{epic_num}-{story_num}`锛屼緥濡?Epic 4銆丼tory 4.1 鈫?`4-1`銆傜敤鎴峰彲鐩存帴缁欏嚭锛堝銆?銆?銆嶏級锛屾垨浠?sprint-status 绛夋枃妗ｈВ鏋愩€?
---

## 搂 绂佹璇嶈〃锛圫tory 鏂囨。锛?
浠ヤ笅璇嶄笉寰楀嚭鐜板湪 Story 鏂囨。鐨勪骇鍑轰腑銆傞樁娈典竴浜у嚭銆侀樁娈典簩瀹¤椤诲紩鐢ㄦ湰琛紱瀹¤鏃惰嫢 Story 鏂囨。涓瓨鍦ㄤ换涓€璇嶏紝缁撹涓烘湭閫氳繃銆?
| 绂佹璇?鐭 | 鏇夸唬鏂瑰悜 |
|-------------|----------|
| 鍙€夈€佸彲鑰冭檻銆佸彲浠ヨ€冭檻 | 鏄庣‘鍐欍€岄噰鐢ㄦ柟妗?A銆嶏紝骞剁畝杩扮悊鐢便€?|
| 鍚庣画銆佸悗缁凯浠ｃ€佸緟鍚庣画 | 鑻ヤ笉鍋氫笖鍔熻兘鍦?Epic 鑼冨洿鍐咃紝椤诲啓鏄庣敱鍝釜 Story 璐熻矗锛涚姝㈡棤褰掑睘鎺掗櫎銆傝嫢涓嶅湪浜у搧鑼冨洿锛岄』寮曠敤 Epic/PRD 渚濇嵁銆傝嫢鍋氬垯鍐欐竻鏈樁娈靛畬鎴愯寖鍥淬€?|
| 鍏堝疄鐜般€佸悗缁墿灞曘€佹垨鍚庣画鎵╁睍 | 鏈?Story 瀹炵幇 X锛沋 鐢?Story A.B 璐熻矗锛圓.B 椤诲瓨鍦ㄤ笖 scope 鍚?Y锛屼笖琛ㄨ堪椤诲惈 Y 鐨勫叿浣撴弿杩帮級銆?|
| 寰呭畾銆侀厡鎯呫€佽鎯呭喌 | 鏀逛负鏄庣‘鏉′欢涓庡搴斿姩浣滐紙濡傘€岃嫢 X 鍒?Y銆嶏級銆?|
| 鎶€鏈€恒€佸厛杩欐牱鍚庣画鍐嶆敼 | 涓嶅湪 Story 鏂囨。涓暀鎶€鏈€猴紱鍗曠嫭寮€ Story 鎴栦笉鍦ㄦ湰娆¤寖鍥淬€?|
| 鏃㈡湁闂鍙帓闄ゃ€佷笌鏈鏃犲叧銆佸巻鍙查棶棰樻殏涓嶅鐞嗐€佺幆澧冮棶棰樺彲蹇界暐 | 鍦ㄩ獙鏀?瀹¤缁撹銆佷换鍔″畬鎴愯鏄庝腑鍑虹幇涓?*鏃犳寮忔帓闄よ褰?*鏃剁姝紱鑻ユ湁姝ｅ紡鎺掗櫎璁板綍锛屽彲鍦ㄨ褰曚腑浣滃瑙傛弿杩颁絾椤诲甫瀹㈣渚濇嵁锛堝 issue 鍙枫€佸鐜版楠わ級銆?|

### Story 鑼冨洿琛ㄨ堪绀轰緥锛堟帹杩熼棴鐜級

**姝ｇ‘绀轰緥**锛?> 鏈?Story 瀹炵幇 use_adaptive_threshold=0 璺緞銆倁se_adaptive_threshold 闈為浂鏃剁殑鍒嗘敮閫昏緫鐢?Story 5.6 璐熻矗銆傦紙瀹¤鏃堕』楠岃瘉 Story 5.6 瀛樺湪涓?scope 鍚鎻忚堪锛?
**閿欒绀轰緥**锛?> 鏈?Story 鍏堝疄鐜?use_adaptive_threshold=0 璺緞锛屾垨鍚庣画鎵╁睍銆傦紙绂佹璇嶏細鍏堝疄鐜般€佹垨鍚庣画鎵╁睍锛?> 鏈?Story 瀹炵幇 0 璺緞锛涘叾浣欑敱 Story 5.6 璐熻矗銆傦紙銆屽叾浣欍€嶈繃浜庢ā绯婏紝瀹¤鍛樻棤娉曢獙璇侊級

**浣跨敤璇存槑**锛氶樁娈典竴 Create Story 浜у嚭瑕佹眰椤诲紩鐢ㄦ湰琛ㄦ垨璐村嚭涓婅〃绮剧畝鐗堬紱闃舵浜?Story 鏂囨。瀹¤椤诲啓銆岃嫢 Story 鏂囨。瀛樺湪鏈〃浠讳竴璇嶏紝缁撹涓烘湭閫氳繃銆嶃€傞樁娈靛洓瀹炴柦鍚庡璁￠』鍐欍€岃嫢楠屾敹/瀹¤缁撹涓嚭鐜颁笂琛ㄣ€屽け璐ユ帓闄ゃ€嶇浉鍏崇姝㈣瘝涓旀棤瀵瑰簲姝ｅ紡鎺掗櫎璁板綍锛岀粨璁轰负鏈€氳繃銆嶃€?
---

## 姝ｅ紡鎺掗櫎澶辫触鐢ㄤ緥鐨勮瀹氾紙涓?bmad-bug-assistant 淇濇寔涓€鑷达級

**鍘熷垯**锛氫换浣曞湪鏈楠屾敹/鍥炲綊涓嚭鐜扮殑澶辫触鐢ㄤ緥锛屽潎椤诲湪鏈疆鍐?*淇**鎴?*鍒楀叆姝ｅ紡鎺掗櫎娓呭崟**骞舵帴鍙楀璁★紱涓嶅緱浠ヤ换浣曟湭璁板綍銆佹湭瀹¤鐨勭悊鐢卞拷鐣ュけ璐ャ€?
**绂佹鑷姩鐢熸垚**锛氬璁″瓙浠ｇ悊銆佸疄鏂藉瓙浠ｇ悊**绂佹**鑷姩鍒涘缓鎴栨洿鏂?EXCLUDED_TESTS_*.md 鎴栫被浼兼帓闄ゆ竻鍗曟枃浠躲€?
**椤诲厛璇㈤棶鐢ㄦ埛**锛氬綋楠屾敹/鍥炲綊瀛樺湪澶辫触鐢ㄤ緥涓旀嫙鍒楀叆姝ｅ紡鎺掗櫎鏃讹紝涓?Agent 鎴栧瓙浠ｇ悊蹇呴』**鍏堝悜鐢ㄦ埛璇㈤棶**銆屾槸鍚︽壒鍑嗗皢浠ヤ笅鐢ㄤ緥鍒楀叆姝ｅ紡鎺掗櫎娓呭崟銆嶏紝鐢ㄦ埛鏄庣‘鎵瑰噯鍚庯紝鏂瑰彲鍒涘缓鎴栨洿鏂版帓闄ゆ竻鍗曪紱鑻ョ敤鎴锋嫆缁濓紝蹇呴』杩涘叆淇娴佺▼锛屼笉寰楀垱寤烘帓闄ゆ竻鍗曘€?
**鎺掗櫎璁板綍璺緞锛圫tory 鐢級**锛歚_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/EXCLUDED_TESTS_{epic_num}-{story_num}.md`銆傚繀澶囧瓧娈典笌鍙帴鍙?涓嶅彲鎺ュ彈鍒ゅ畾涓?bmad-bug-assistant銆屾寮忔帓闄ゅけ璐ョ敤渚嬬殑瑙勫畾銆嶄竴鑷达紙鐢ㄤ緥 ID銆佹帓闄ょ悊鐢便€佸瑙備緷鎹€佹湰 Story 鏍囪瘑銆佸璁＄粨璁猴級銆?
---

## 搂 浣曟椂鍙烦杩?party-mode 涓?code-review 琛ュ伩瑙勫垯

**璇存槑**锛氭湰鑺傛弿杩拌烦杩?party-mode 鍚庣殑琛ュ伩鏈哄埗銆傛槸鍚﹀彲璺宠繃鐨勫垽鏂互銆岄樁娈典竴 搂1.0 Party-Mode 鍐崇瓥妫€鏌ャ€嶄负鍑嗐€?
### 浣曟椂鍙烦杩?party-mode锛圕reate Story锛?
**鍞竴鍏佽鏉′欢**锛氱敤鎴?*鏄庣‘**璇存槑銆孲tory 宸查€氳繃 party-mode 涓斿璁￠€氳繃锛岃烦杩?Create Story銆嶆椂锛屽彲璺宠繃闃舵涓€銆佷簩銆?
**绂佹**锛氫粎鍥?Epic/Story 鏂囨。宸插瓨鍦ㄥ嵆璺宠繃锛涘彲鑳界敱绠€鍗?bmad 鍛戒护鐢熸垚銆佹湭缁?party-mode 娣卞叆璁ㄨ鐨勬枃妗ｏ紝**蹇呴』**鎵ц Create Story銆?
### party-mode 璺宠繃鏃?code-review 琛ュ伩瑙勫垯

褰?party-mode 琚烦杩囨椂锛岄樁娈典簩锛圫tory 鏂囨。瀹¤锛夐渶**琛ュ伩**缂哄け鐨勬繁搴︼紝鍚﹀垯璐ㄩ噺闂ㄦ帶涓嶈冻銆?
| 鎯呭舰 | 闃舵浜屼弗鏍煎害 | 鐞嗙敱 |
|------|--------------|------|
| 鐢ㄦ埛鏄庣‘璇淬€岃烦杩?party-mode銆?| **strict** | 鐢ㄦ埛涓诲姩璺宠繃锛岄渶琛ュ伩娣卞害 |
| 鏃?party-mode 浜у嚭鐗╋紙story 鐩綍涓嬫棤 `DEBATE_鍏辫瘑_*`銆乣party-mode 鏀舵暃绾` 绛夛級 | **strict** | 琛ュ伩缂哄け鐨?party-mode 娣卞害锛涜繛缁?3 杞棤 gap + 鎵瑰垽瀹¤鍛?>50% |
| 鏈?party-mode 浜у嚭鐗╁瓨鍦?| **standard** | 宸叉湁娣卞害锛岄獙璇佸嵆鍙紱鍗曟 + 鎵瑰垽瀹¤鍛?|
| 鐢ㄦ埛鏄惧紡瑕佹眰 strict | **strict** | 浠ョ敤鎴蜂负鍑?|

**浜у嚭鐗╂娴?*锛氫富 Agent 鍦ㄩ樁娈典簩瀹¤鍓嶏紝妫€鏌?story 鐩綍鏄惁瀛樺湪 party-mode 浜у嚭鐗╋紱鑻ユ湁涓旂敤鎴锋湭寮哄埗 strict锛屽垯鐢?standard锛涜嫢鏃犳垨鐢ㄦ埛瑕佹眰 strict锛屽垯鐢?strict銆?
---

## 浣跨敤绀轰緥

### 绀轰緥 1锛氬畬鏁存祦绋嬶紙Epic 4銆丼tory 4.1锛?
鐢ㄦ埛璇达細銆屼娇鐢?bmad story 鍔╂墜锛岀敓鎴?Epic 4銆丼tory 4.1锛屽苟鎵ц瀹屾暣娴佺▼銆傘€?
**sprint-status 瑕佹眰**锛氳嫢 sprint-status.yaml 涓嶅瓨鍦紝椤诲厛杩愯 sprint-planning 鎴栨樉寮忕‘璁?bypass锛涘惁鍒欎笉寰楀彂璧?Create Story 瀛愪换鍔°€?
涓?Agent 鎵ц椤哄簭锛?0. 锛堥樁娈甸浂-鍓嶇疆锛夎嫢 _bmad 瀛樺湪涓?party-mode 鏈仛灞曠ず鍚嶄紭鍖栵紝鑷姩鎵ц琛ヤ竵
1. 鍙戣捣 Create Story 瀛愪换鍔★紙epic_num=4, story_num=1锛?2. 浜у嚭 `_bmad-output/implementation-artifacts/epic-4-*/story-1-<slug>/4-1-<slug>.md` 鍚庯紝鍙戣捣 Story 鏂囨。瀹¤
3. 瀹¤閫氳繃鍚庯紝鍙戣捣 Dev Story 瀹炴柦瀛愪换鍔★紝浼犲叆 TASKS 鎴?BUGFIX 鏂囨。璺緞
4. 瀹炴柦瀹屾垚鍚庯紝**蹇呴』**鍙戣捣瀹炴柦鍚庡璁★紙audit-prompts.md 搂5锛夛紙鏈楠や负蹇呴』锛岄潪鍙€夛級
5. 瀹¤閫氳繃鍗虫祦绋嬬粨鏉?
### 绀轰緥 2锛氫粎 Create Story + 瀹¤锛圗pic 3銆丼tory 2锛?
鐢ㄦ埛璇达細銆屽府鎴戝垱寤?Story 3.2 骞跺仛瀹¤銆傘€?
涓?Agent 鎵ц锛?1. mcp_task 鍙戣捣 Create Story锛坋pic_num=3, story_num=2锛?2. 浜у嚭 `3-2-<title>.md` 鍚庡彂璧峰璁″瓙浠诲姟
3. 鑻ユ湭閫氳繃鍒欎慨鏀规枃妗ｅ苟鍐嶆瀹¤锛岀洿鑷抽€氳繃

### 绀轰緥 3锛氫粠 sprint-status 瑙ｆ瀽鍚庢墽琛?
鐢ㄦ埛璇达細銆屾寜 sprint-status 閲岀殑涓嬩竴涓?Story 鎵ц bmad story 鍔╂墜銆傘€?
**sprint-status 瑕佹眰**锛氭绀轰緥浠呭湪 sprint-status.yaml 瀛樺湪鏃跺彲琛岋紱鑻ヤ笉瀛樺湪锛岄』鍏堣繍琛?sprint-planning 鎴栨樉寮忕‘璁?bypass銆?
涓?Agent 鍏堣鍙?`_bmad-output/implementation-artifacts/sprint-status.yaml`锛岃В鏋愬嚭涓嬩竴寰呭姙 Story锛堝 `4-1`锛夛紝鍐嶆寜绀轰緥 1 鐨勬祦绋嬫墽琛岋紝灏?epic_num=4銆乻tory_num=1 浠ｅ叆鍚勯樁娈电殑 prompt銆?
### 绀轰緥 4锛氫粎 Dev Story锛堢敤鎴锋槑纭‘璁ゅ凡閫氳繃 party-mode 涓斿璁★級

鐢ㄦ埛璇达細銆孲tory 4-1 鏂囨。宸插瓨鍦紝**宸查€氳繃 party-mode 涓斿璁￠€氳繃**锛岃鎵ц Dev Story銆傘€?
涓?Agent 鏂瑰彲璺宠繃闃舵涓€銆佷簩锛岀洿鎺ュ彂璧?Dev Story 瀹炴柦瀛愪换鍔★紝浼犲叆锛?- Story 鏂囨。璺緞锛歚_bmad-output/implementation-artifacts/epic-4-*/story-1-*/*.md`
- TASKS 鏂囨。璺緞锛氾紙濡?`_bmad-output/implementation-artifacts/epic-4-*/story-1-*/TASKS_4-1-*.md`锛?- 椤圭洰鏍圭洰褰?
瀹炴柦瀹屾垚鍚庢寜闃舵鍥涘彂璧峰疄鏂藉悗瀹¤銆?
**娉ㄦ剰**锛氳嫢鐢ㄦ埛浠呰銆孲tory 宸插瓨鍦ㄣ€嶈€屾湭鏄庣‘銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃銆嶏紝涓?Agent **涓嶅緱**璺宠繃 Create Story锛涢』鎵ц闃舵涓€锛堝惈 party-mode 100 杞京璁猴紝鑻ユ湁鏂规閫夋嫨鎴栬璁″喅绛栵級锛屽啀瀹¤銆佸啀 Dev Story銆?
---

## 闃舵闆讹紙鍓嶇疆锛夛細灞曠ず鍚嶆枃浠舵鏌ヤ笌鑷姩浼樺寲

**璇存槑**锛氭湰闃舵涓烘妧鏈ˉ涓侊紝鍦?Layer 1 浜у搧瀹氫箟灞備箣鍓嶆墽琛屻€備笌涓嬫枃鐨勩€岄樁娈甸浂锛歀ayer 1浜у搧瀹氫箟灞傘€嶅尯鍒嗭細鍓嶈€呬负灞曠ず鍚嶄紭鍖栵紝鍚庤€呬负浜у搧瀹氫箟銆?
**瑙﹀彂鏃舵満**锛氱敤鎴峰湪鏈」鐩垨 worktree 棣栨浣跨敤鏈?skill 鏃讹紝鎴栫敤鎴锋槑纭姹傘€屾鏌?浼樺寲灞曠ず鍚嶃€嶆椂銆?
**鍓嶆彁**锛氶」鐩唴宸插畨瑁?`_bmad`锛坄{project-root}/_bmad/` 瀛樺湪锛夈€?
**妫€鏌ラ€昏緫**锛?1. 璇诲彇 `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`锛堜互 canonical step-02 浣滀负 party-mode 灞曠ず鍚嶄紭鍖栦笌 gate 璇箟鐘舵€佺殑浠ｈ〃鏂囦欢锛涜嫢 step-02 宸蹭紭鍖栵紝鍚庣画 mirror 閫氳繃鍚屾鑴氭湰鐢熸垚锛?2. 鑻?step-02 涓?*鍚屾椂涓嶅惈**瀛楃涓?`蹇呴』浣跨敤 **灞曠ず鍚峘 **涓?* `灞曠ず鍚?displayName`锛屽垯鍒ゅ畾鏈紭鍖?
**鎵ц鍔ㄤ綔**锛氬浠ヤ笅涓変釜鏂囦欢搴旂敤 `search_replace` 淇敼銆傝嫢鏌愭枃浠朵笉瀛樺湪鍒欒烦杩囥€傝嫢 `old_string` 涓庡綋鍓嶆枃浠跺唴瀹逛笉瀹屽叏涓€鑷达紝鍏堣鍙栨枃浠跺啀鏍规嵁瀹為檯鏍煎紡寰皟 `old_string` 鍚庨噸璇曪紱浠嶅け璐ュ垯璺宠繃骞舵彁绀恒€?
### 琛ヤ竵 1锛歸orkflow.md

璺緞锛歚{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`

```yaml
old_string: "[Load agent roster and display 2-3 most diverse agents as examples]"
new_string: |
  [Load agent roster and display 2-3 most diverse agents as examples. 浠嬬粛鏃跺繀椤讳娇鐢ㄥ睍绀哄悕锛坉isplayName锛夛紝涓?`_bmad/_config/agent-manifest.csv` 淇濇寔涓€鑷淬€傜ず渚嬶細Winston 鏋舵瀯甯堛€丄melia 寮€鍙戙€丮ary 鍒嗘瀽甯堛€丣ohn 浜у搧缁忕悊銆丅Mad Master銆丵uinn 娴嬭瘯銆丳aige 鎶€鏈啓浣溿€丼ally UX銆丅arry Quick Flow銆丅ond Agent 鏋勫缓銆丮organ Module 鏋勫缓銆乄endy Workflow 鏋勫缓銆乂ictor 鍒涙柊绛栫暐銆丏r. Quinn 闂瑙ｅ喅銆丮aya 璁捐鎬濈淮銆丆arson 澶磋剳椋庢毚銆丼ophia 鏁呬簨璁茶堪銆丆aravaggio 婕旂ず銆丮urat 娴嬭瘯鏋舵瀯銆佹壒鍒ゆ€у璁″憳銆俔
```

### 琛ヤ竵 2锛歴tep-01-agent-loading.md

璺緞锛歚{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.md`

淇敼 A锛?```yaml
old_string: "- **displayName** (agent's persona name for conversations)"
new_string: "- **displayName** (agent's persona name for conversations锛涗腑鏂囪澧冧笅浣跨敤 灞曠ず鍚嶏紝濡?Mary 鍒嗘瀽甯堛€乄inston 鏋舵瀯甯?"
```

淇敼 B锛?```yaml
old_string: "[Display 3-4 diverse agents to showcase variety]:

- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]
- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]
- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]"
new_string: "[Display 3-4 diverse agents to showcase variety锛涗娇鐢?灞曠ず鍚?鏍囨敞锛屽 Winston 鏋舵瀯甯堛€丄melia 寮€鍙戙€丮ary 鍒嗘瀽甯圿:

- [Icon Emoji] **[灞曠ず鍚?displayName]** ([Title]): [Brief role description]
- [Icon Emoji] **[灞曠ず鍚?displayName]** ([Title]): [Brief role description]
- [Icon Emoji] **[灞曠ず鍚?displayName]** ([Title]): [Brief role description]"
```

### 琛ヤ竵 3锛歴tep-02-discussion-orchestration.md

璺緞锛歚{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`

淇敼 A锛圧esponse Structure锛夛細
```yaml
old_string: "**Response Structure:**
[For each selected agent]:

\"[Icon Emoji] **[Agent Name]**: [Authentic in-character response]\""
new_string: "**Response Structure:**
[For each selected agent]:
- 蹇呴』浣跨敤 **灞曠ず鍚嶏紙displayName锛?* 鏍囨敞鍙戣█瑙掕壊锛屼笌 `_bmad/_config/agent-manifest.csv` 淇濇寔涓€鑷淬€?- 灞曠ず鍚嶇ず渚嬶細BMad Master銆丮ary 鍒嗘瀽甯堛€丣ohn 浜у搧缁忕悊銆乄inston 鏋舵瀯甯堛€丄melia 寮€鍙戙€丅ob Scrum Master銆丵uinn 娴嬭瘯銆丳aige 鎶€鏈啓浣溿€丼ally UX銆丅arry Quick Flow銆丅ond Agent 鏋勫缓銆丮organ Module 鏋勫缓銆乄endy Workflow 鏋勫缓銆乂ictor 鍒涙柊绛栫暐銆丏r. Quinn 闂瑙ｅ喅銆丮aya 璁捐鎬濈淮銆丆arson 澶磋剳椋庢毚銆丼ophia 鏁呬簨璁茶堪銆丆aravaggio 婕旂ず銆丮urat 娴嬭瘯鏋舵瀯銆佹壒鍒ゆ€у璁″憳銆?
\"[Icon Emoji] **[灞曠ず鍚?displayName]**: [Authentic in-character response]\""
```

淇敼 B锛圕ross-Talk锛夛細
```yaml
old_string: "- Agents can reference each other by name: \"As [Another Agent] mentioned...\""
new_string: "- Agents can reference each other by 灞曠ず鍚? \"As [Another Agent 灞曠ず鍚峕 mentioned...\"锛堝銆屾濡?Winston 鏋舵瀯甯?鎵€璇粹€︺€嶏級"
```

淇敼 C锛圦uestion Handling锛夛細
```yaml
old_string: "- Clearly highlight: **[Agent Name] asks: [Their question]**"
new_string: "- Clearly highlight: **[灞曠ず鍚?displayName] asks: [Their question]**锛堝 **Amelia 寮€鍙?asks: 鈥?*锛?
```

淇敼 D锛圡oderation锛夛細
```yaml
old_string: "- If discussion becomes circular, have bmad-master summarize and redirect"
new_string: "- If discussion becomes circular, have BMad Master 鎬荤粨骞跺紩瀵艰浆鍚?
```

**鎵ц椤哄簭**锛氶樁娈甸浂鍦ㄩ樁娈典竴涔嬪墠鎵ц锛涜嫢妫€娴嬪埌鏈紭鍖栧垯鍏堝畬鎴愯ˉ涓侊紝鍐嶇户缁悗缁樁娈点€傝嫢 `_bmad` 涓嶅瓨鍦紝璺宠繃闃舵闆跺苟鎻愮ず鐢ㄦ埛瀹夎 BMAD銆?
**鏂?worktree 妫€娴嬩笌 _bmad 瀹氬埗杩佺Щ鎻愮ず**锛?- 鑻ユ娴嬪埌褰撳墠涓烘柊 worktree锛堜緥濡?cwd 涓轰笌椤圭洰鏍瑰钩绾х殑 worktree 鐩綍濡?`{repo鍚峿-{branch}`锛屾垨 `_bmad` 涓哄叏鏂板畨瑁咃級锛屼笖 `_bmad-output/bmad-customization-backups/` 瀛樺湪澶囦唤锛屽垯鎻愮ず鐢ㄦ埛锛?  > 妫€娴嬪埌褰撳墠涓烘柊 worktree銆傝嫢闇€鎭㈠ _bmad 瀹氬埗锛屽彲杩愯锛歚python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{鏈€鏂板浠借矾寰剗" --project-root "{褰撳墠椤圭洰鏍箎"`銆傛渶鏂板浠借矾寰勪负 `_bmad-output/bmad-customization-backups/` 涓嬫寜鏃堕棿鎴虫帓搴忕殑鏈€鏂扮洰褰曘€?- 鑻ユ棤澶囦唤锛屼笉鎻愮ず銆?
---

### 浜у嚭璺緞绾﹀畾

**pre-speckit 浜у嚭锛堟寜 branch 瀛愮洰褰曪級**锛?| 浜у嚭 | 璺緞 |
|------|------|
| Epic/Story 瑙勫垝 | `_bmad-output/planning-artifacts/{branch}/epics.md` |
| 灏辩华鎶ュ憡 | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` |
| prd锛坧lanning 绾э級 | `_bmad-output/planning-artifacts/{branch}/prd.{ref}.json` |
| 鏋舵瀯璁捐 | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 鎴?`ARCH_*.md` |

**branch 瑙ｆ瀽**锛歚git rev-parse --abbrev-ref HEAD`锛涜嫢涓?`HEAD` 鍒?`detached-{short-sha}`锛沗/` 鏇挎崲涓?`-`銆?**褰掓。**锛歚--archive` 鏃跺厛澶嶅埗鍒?`_archive/{branch}/{date}-{seq}/` 鍐嶅啓鍏ャ€?
**post-speckit 浜у嚭锛堝叆 story 瀛愮洰褰曪級**锛?| 浜у嚭 | 璺緞 |
|------|------|
| Story 鏂囨。 | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/{epic}-{story}-{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md` |
| prd銆乸rogress | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.{ref}.json`銆乣progress.{ref}.txt` |
| DEBATE 鍏辫瘑 | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/DEBATE_鍏辫瘑_{slug}_{date}.md` |
| 璺?Story DEBATE | `_bmad-output/implementation-artifacts/_shared/DEBATE_鍏辫瘑_{slug}_{date}.md` |

**瀛愮洰褰曞垱寤?*锛欳reate Story 浜у嚭鏃讹紝鑻?`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` 涓嶅瓨鍦紝椤诲厛鍒涘缓銆傚瓙鐩綍鐢?create-new-feature.ps1 -ModeBmad 鍦ㄥ垱寤?spec 鏃跺悓姝ュ垱寤猴紝鎴栫敱 bmad-story-assistant 鍦ㄩ娆″啓鍏?Story 鏃跺垱寤恒€?
---

## 闃舵闆讹細Layer 1浜у搧瀹氫箟灞?
**璇存槑**锛氫笌涓婃枃鐨勩€岄樁娈甸浂锛堝墠缃級锛氬睍绀哄悕鏂囦欢妫€鏌ヤ笌鑷姩浼樺寲銆嶅尯鍒嗭細鏈樁娈典负浜у搧瀹氫箟灞傦紝鍖呭惈 Product Brief銆佸鏉傚害璇勪及銆丳RD銆丄rchitecture銆?
鍦ㄧ敤鎴锋槑纭鍒涘缓鏂癊pic鎴栭噸澶у姛鑳芥椂锛岄鍏堟墽琛屼骇鍝佸畾涔夊眰銆?
### Step 1: Product Brief
鍒涘缓鎴栬鍙朠roduct Brief鏂囨。锛屽寘鍚細
- 浜у搧姒傝堪鍜岀洰鏍?- 鐩爣鐢ㄦ埛缇や綋
- 鏍稿績浠峰€煎拰宸紓鍖?- 鎴愬姛鎸囨爣

### Step 2: 澶嶆潅搴﹁瘎浼?濉啓涓夌淮澶嶆潅搴﹁瘎浼伴棶鍗凤細
```yaml
涓氬姟澶嶆潅搴?(1-5鍒?:
  - 棰嗗煙鐭ヨ瘑: [鐔熸倝(1鍒?/閮ㄥ垎鏂?3鍒?/鍏ㄦ柊(5鍒?]
  - 鍒╃泭鐩稿叧鏂规暟閲? [鈮?(1鍒?/3-5(3鍒?/>5(5鍒?]
  - 鍚堣瑕佹眰: [鏃?1鍒?/涓€鑸?3鍒?/涓ユ牸(5鍒?]

鎶€鏈鏉傚害 (1-5鍒?:
  - 鎶€鏈爤: [鐜版湁(1鍒?/閮ㄥ垎鏂?3鍒?/鍏ㄦ柊(5鍒?]
  - 鏋舵瀯鎸戞垬: [鏃?1鍒?/涓瓑(3鍒?/楂樺苟鍙戝ぇ鏁版嵁(5鍒?]
  - 闆嗘垚闅惧害: [鐙珛(1鍒?/灏戦噺渚濊禆(3鍒?/澶嶆潅缃戠粶(5鍒?]

褰卞搷鑼冨洿 (1-5鍒?:
  - [鍗曚釜Story(1鍒?/鍗曚釜妯″潡(3鍒?/璺ㄦā鍧?4鍒?/鍏ㄧ郴缁?5鍒?]
```

**鑱氬悎鍏紡锛圙AP-019 淇锛汫AP-071 淇锛?*锛氭瘡缁村害鍙栧瓙椤?*鏈€楂樺垎**锛堥粯璁や繚瀹堬級鎴?*骞冲潎鍒?*锛堝洓鑸嶄簲鍏ワ級锛?*閫夋嫨鏉′欢**锛氶粯璁ゅ彇鏈€楂樺垎锛涜嫢鐢ㄦ埛鏄惧紡閫夋嫨銆屼箰瑙傛ā寮忋€嶅垯鍙栧钩鍧囧垎锛涙€诲垎 = 涓氬姟 + 鎶€鏈?+ 褰卞搷锛岃寖鍥?3~15銆?
### Step 3: PRD鐢熸垚
鏍规嵁鎬诲垎鍐冲畾PRD鐢熸垚鏂瑰紡锛圙AP-004 淇锛氳竟鐣屽€煎綊灞炶鍒欙級锛?
| 鎬诲垎 | PRD鐢熸垚鏂瑰紡 |
|------|-------------|
| 鈮?鍒嗭紙鍚?6 鍒嗭級 | 鐩存帴鐢熸垚PRD |
| 7-10鍒嗭紙鍚?7銆?0 鍒嗭級 | 50杞甈arty-Mode鍚庣敓鎴?|
| 11-15鍒嗭紙鍚?11銆?5 鍒嗭級 | 80杞甈arty-Mode鍚庣敓鎴?|
| 15鍒嗭紙婊″垎锛?| 80杞甈arty-Mode + 澶栭儴涓撳Review锛涳紙**GAP-081 淇**锛氭€诲垎鑼冨洿 3~15锛屾棤 >15锛涙弧鍒?15 鏃惰Е鍙戯級锛涳紙GAP-038 淇锛氫笓瀹舵潵婧愬彲涓洪」鐩唴璧勬繁鏋舵瀯甯堟垨澶栭儴椤鹃棶锛岃緭鍑烘牸寮忎负銆孯eview 鎰忚 + 閫氳繃/鏈夋潯浠堕€氳繃/涓嶉€氳繃銆嶏級 |

PRD蹇呴』鍖呭惈锛?- 璇︾粏闇€姹傚垪琛紙甯D锛?- 楠屾敹鏍囧噯
- 浼樺厛绾ф帓搴?- 渚濊禆鍏崇郴

### Step 4: Architecture鐢熸垚锛堝闇€锛?褰撴€诲垎鈮?鍒嗘椂锛岄渶瑕佺敓鎴怉rchitecture鏂囨。锛?- 鎶€鏈灦鏋勫浘
- 妯″潡鍒掑垎鍜屾帴鍙ｅ畾涔?- 鎶€鏈€夊瀷鍙奣radeoff鍒嗘瀽锛堜娇鐢ˋDR鏍煎紡锛?- 瀹夊叏鍜屾€ц兘鑰冮噺

Architecture Party-Mode瑙掕壊锛圙AP-020 淇锛氫笌 Plan Party-Mode 宸紓璇存槑锛夛細
- 绯荤粺鏋舵瀯甯堛€佹€ц兘宸ョ▼甯堛€佸畨鍏ㄦ灦鏋勫笀銆佽繍缁村伐绋嬪笀銆佹垚鏈垎鏋愬笀銆佹壒鍒ゅ璁″憳
- Plan 闃舵鍋忔妧鏈柟妗堬紝Architecture 闃舵鍋忔灦鏋勫喅绛栵紝瑙掕壊鍙鐢紱鑻ラ」鐩湁涓撻棬鏋舵瀯甯堝彲鎵╁睍

### 闃舵闆朵骇鍑?- Product Brief鏂囨。
- 澶嶆潅搴﹁瘎浼扮粨鏋?- PRD鏂囨。锛堝惈闇€姹傝拷婧〃锛?- Architecture鏂囨。锛堝闇€瑕侊級

---

## Layer 2 Epic/Story瑙勫垝灞?
鍦ㄦ墽琛孋reate Story涔嬪墠锛屽厛杩涜Epic/Story瑙勫垝銆?
### create-epics-and-stories

鍩轰簬PRD鍜孉rchitecture鏂囨。锛屾墽琛屼互涓嬫楠わ細

1. **Epic瀹氫箟**
   - 纭畾Epic杈圭晫鍜岃寖鍥?   - 鍛藉悕瑙勮寖锛歚feature-{domain}-{capability}`
   - 浼扮畻Epic鎬讳綋宸ヤ綔閲?
2. **Story鎷嗗垎**
   - 鎸夊姛鑳芥ā鍧楁媶鍒哠tory
   - 姣忎釜Story鍙嫭绔嬩氦浠?   - 鍛藉悕瑙勮寖锛歚{epic_num}.{story_num} {description}`

3. **渚濊禆鍏崇郴鍒嗘瀽**
   - 璇嗗埆Story闂寸殑渚濊禆鍏崇郴
   - 鐢熸垚渚濊禆鍥撅紙鏂囨湰鎴栧浘褰級
   - 纭畾鎵ц椤哄簭

4. **绮楃矑搴︿及绠?*
   - 姣忎釜Story鐨勫垵姝ュ伐浣滈噺浼扮畻
   - 璇嗗埆楂橀闄㏒tory
   - 鏍囪闇€瑕丼pike鐨凷tory

### 浜у嚭鐗?
1. **Epic鍒楄〃**
   ```markdown
   | Epic ID | 鍚嶇О | 鎻忚堪 | 棰勪及宸ユ椂 | 浼樺厛绾?|
   |---------|------|------|---------|--------|
   | 4 | feature-metrics-cache | 鎸囨爣缂撳瓨浼樺寲 | 80h | P0 |
   ```

2. **Story鍒楄〃锛堢矖绮掑害锛?*
   ```markdown
   | Story ID | 鎵€灞濫pic | 鎻忚堪 | 渚濊禆 | 棰勪及宸ユ椂 | 椋庨櫓 |
   |----------|---------|------|------|---------|------|
   | 4.1 | 4 | 鍩虹缂撳瓨绫诲疄鐜?| 鏃?| 8h | 浣?|
   | 4.2 | 4 | TTL鏈哄埗瀹炵幇 | 4.1 | 12h | 涓?|
   ```

3. **渚濊禆鍥?*
   ```
   Story 4.1 鈹€鈹?              鈹溾攢鈫?Story 4.3 鈹€鈫?Story 4.5
   Story 4.2 鈹€鈹?   ```

### 杩涘叆闃舵涓€鐨勬潯浠?- Epic鍜孲tory鍒楄〃宸插畬鎴?- 渚濊禆鍏崇郴宸叉槑纭?- 宸茶幏寰楃敤鎴风‘璁?
---

## 涓?Agent 浼犻€掓彁绀鸿瘝瑙勫垯锛堝繀瀹堬級

- **浣跨敤瀹屾暣妯℃澘銆佹暣娈靛鍒躲€佺姝㈡鎷?*锛氬彂璧峰悇闃舵瀛愪换鍔℃椂锛屽繀椤诲皢璇ラ樁娈靛畬鏁?prompt 妯℃澘鏁存澶嶅埗鍒?prompt 涓苟鏇挎崲鍗犱綅绗︼紝绂佹鐢ㄦ鎷鏇夸唬锛堝銆岃鎸?story-assistant 闃舵浜屽璁℃墽琛屻€嶃€岃鍙傝€冩妧鑳介樁娈典簩銆嶃€屽璁¤姹傝涓婃枃銆嶏級銆?- **閿欒绀轰緥**锛堢姝級锛氥€岃鎸?story-assistant 闃舵浜屽璁℃墽琛屻€嶃€岃鍙傝€冩妧鑳介樁娈典簩銆嶃€屽璁¤姹傝涓婃枃銆嶃€?- **姝ｇ‘绀轰緥**锛歱rompt 鍚闃舵瀹屾暣妯℃澘鍏ㄦ枃銆佸崰浣嶇宸叉浛鎹€佸彂璧峰墠宸茶緭鍑鸿嚜妫€缁撴灉銆?- **鍗犱綅绗︽竻鍗?*锛?
| 闃舵 | 鍗犱綅绗?| 鍚箟 | 绀轰緥鍊?| 鏈浛鎹㈠悗鏋?|
|------|--------|------|--------|------------|
| 闃舵涓€ | epic_num, story_num, project-root | Epic 缂栧彿銆丼tory 瀛愮紪鍙枫€侀」鐩牴鐩綍 | 4, 1, d:/Dev/my-project | 瀛愪换鍔℃棤娉曞畾浣嶄骇鍑鸿矾寰?|
| 闃舵浜?| Story 鏂囨。璺緞, project-root | 宸蹭骇鍑?Story 鏂囦欢璺緞銆侀」鐩牴 | _bmad-output/.../4-1-xxx.md | 瀹¤瀵硅薄閿欒鎴栫己澶?|
| 闃舵涓?| epic_num, story_num, epic_slug, slug, project-root | Epic/Story 缂栧彿銆乪pic_slug锛堜粠 epics.md 鎺ㄥ锛夈€乻tory slug銆侀」鐩牴 | 11, 1, speckit-template-offline, template-fetch, d:/Dev/... | 瀛愪唬鐞嗗垱寤?specs 鏃剁敤鏃?slug 璺緞 |
| 闃舵鍥?| 鍚屼笂鍙婂璁′緷鎹矾寰?| tasks/plan/GAPS 璺緞 | 鐢变富 Agent 浼犲叆 | 瀹¤渚濇嵁缂哄け |

- **鑷寮哄埗**锛氭湭瀹屾垚璇ラ樁娈靛彂璧峰墠鑷娓呭崟骞惰緭鍑鸿嚜妫€缁撴灉锛屼笉寰楀彂璧凤紱绂佹鍏堝彂璧峰悗琛ヨ嚜妫€銆?- **鑷缁撴灉鏍煎紡绀轰緥**锛氥€屻€愯嚜妫€瀹屾垚銆戦樁娈?X锛氬凡鏁存澶嶅埗妯℃澘 [妯℃澘 ID]锛涘崰浣嶇 [宸叉浛鎹?鍒楀嚭]锛沎鍏朵粬蹇呴€夐」]銆傚彲浠ュ彂璧枫€傘€?
### 涓籄gent鍙戣捣瀛愪换鍔″墠鑷娓呭崟

鍦ㄥ彂璧蜂换浣曞瓙浠诲姟锛坢cp_task鎴朇ursor Task锛夊墠锛屽繀椤诲畬鎴愪互涓嬫鏌ワ細

**sprint-status 妫€鏌?*锛堥樁娈典竴 Create Story 鍙戣捣鍓嶅繀椤绘墽琛岋紝TASKS_sprint-planning-gate T4锛夛細
- [ ] 褰撶敤鎴烽€氳繃 epic_num/story_num 鎴栦粠 sprint-status 瑙ｆ瀽鎸囧畾 Story 鏃讹紝涓?Agent 椤诲湪鍙戣捣 Create Story 瀛愪换鍔?*涔嬪墠**妫€鏌?sprint-status 鏄惁瀛樺湪銆?- [ ] 鍙皟鐢?`{project-root}/scripts/check-sprint-ready.ps1 -Json`锛堣嫢瀛樺湪锛夋垨绛変环閫昏緫锛涜嫢 `SPRINT_READY=false` 涓旂敤鎴锋湭鏄惧紡纭銆屽凡鐭ョ粫杩囷紝缁х画銆嶏紝涓嶅緱鍙戣捣 Create Story 瀛愪换鍔°€?- [ ] 鑷缁撴灉涓』鍖呭惈銆宻print-status 宸茬‘璁ゅ瓨鍦ㄣ€嶆垨銆岀敤鎴峰凡纭 bypass銆嶆垨绛変环澹版槑銆?
**鏂囨。瀛樺湪鎬ф壂鎻?*锛堥樁娈典笁 Dev Story 鍙戣捣鍓嶅繀椤绘墽琛岋級锛?- [ ] 鍦ㄥ彂璧烽樁娈典笁 Dev Story 瀛愪换鍔″墠锛屽繀椤绘墽琛岋細
  `python _bmad/speckit/scripts/python/check_speckit_prerequisites.py --epic {epic} --story {story} --project-root {project_root}`
  涓旈€€鍑虹爜涓?0锛涘惁鍒欎笉寰楀彂璧枫€?- [ ] 鑷缁撴灉涓』鍖呭惈銆屽凡杩愯鍓嶇疆妫€鏌ヨ剼鏈笖閫氳繃銆嶆垨绛変环澹版槑锛堝彲涓?IMP-003 鑷鎶ュ憡绀轰緥瀵归綈锛歴pec/plan/GAPS/tasks 鍥涚被鏂囨。瀛樺湪 + 瀹¤閫氳繃锛夈€?
**鍑嗗闃舵妫€鏌?*:
- [ ] 宸茶鍙栫浉鍏硈kill鏂囦欢鑾峰彇鏈€鏂板唴瀹?- [ ] 宸茬‘璁ゅ綋鍓嶅浜庢纭殑闃舵锛圠ayer 1/2/3/4/5锛?- [ ] 宸插噯澶囧ソ鎵€鏈夊繀瑕佺殑涓婁笅鏂囦俊鎭?- [ ] 宸茬‘璁ゅ墠涓€闃舵宸插畬鎴愬苟閫氳繃瀹¤

**瀛愪换鍔￠厤缃鏌?*:
- [ ] subagent_type璁剧疆姝ｇ‘锛坓eneralPurpose/explore/shell锛?- [ ] prompt鍖呭惈瀹屾暣鐨勮儗鏅俊鎭拰鍏蜂綋瑕佹眰
- [ ] 寮曠敤浜嗘纭殑audit-prompts.md绔犺妭锛堝閫傜敤锛?- [ ] 璁剧疆浜嗗悎鐞嗙殑瓒呮椂鏃堕棿

**瀹¤鐩稿叧妫€鏌?*:
- [ ] 宸茬‘璁ode-reviewer鍙敤鎬ф垨鍑嗗浜嗗洖閫€鏂规
- [ ] 宸插噯澶囧ソaudit-prompts.md瀵瑰簲绔犺妭鍐呭
- [ ] 宸叉槑纭璁￠€氳繃鏍囧噯锛圓/B/C/D绾э級
- [ ] 宸茶鍒掑璁″け璐ュ悗鐨勫鐞嗘祦绋?
**绂佹浜嬮」鑷煡**:
- [ ] 娌℃湁鐩存帴淇敼鐢熶骇浠ｇ爜锛堝繀椤婚€氳繃瀛愪换鍔★級
- [ ] 娌℃湁璺宠繃蹇呰鐨勫璁℃楠?- [ ] 娌℃湁浣跨敤妯＄硦鐨勬寚浠わ紙濡?鑰冭檻涓€涓?銆?鐪嬬湅鑳戒笉鑳?锛?- [ ] 娌℃湁閬楁紡闇€姹傛槧灏勬垨杩芥函

**鑷纭**锛?浠ヤ笂鎵€鏈夋鏌ラ」瀹屾垚鍚庯紝鍦ㄥ洖澶嶄腑鏄庣‘澹版槑锛?"鑷瀹屾垚锛屾墍鏈夋鏌ラ」宸查€氳繃锛岀幇鍦ㄥ彂璧峰瓙浠诲姟銆?

---

## 闃舵涓€锛欳reate Story

### 1.0 鍙戣捣鍓嶈嚜妫€锛堝己鍒讹紝鏂板锛?
涓?Agent 鍦ㄥ彂璧?Create Story 瀛愪换鍔″墠锛?*蹇呴』**鎵ц浠ヤ笅妫€鏌ュ苟杈撳嚭缁撴灉锛?
**Party-Mode 鍐崇瓥妫€鏌?*锛?
| 妫€鏌ラ」 | 缁撴灉閫夐」 | 瑙勫垯 |
|--------|----------|------|
| Story 鏄惁娑夊強浠ｇ爜瀹炵幇锛?| 鏄?鍚?| 鍙傝涓嬫柟銆屼唬鐮佸疄鐜板畾涔夈€?|
| Party-Mode 鍐崇瓥 | 杩涘叆/璺宠繃 | 榛樿杩涘叆锛屼粎渚嬪鍦烘櫙鍙烦杩?|
| 璺宠繃鐞嗙敱锛堣嫢璺宠繃锛?| 渚嬪鍦烘櫙缂栧彿 | 蹇呴』鍖归厤涓嬫柟渚嬪鍦烘櫙 |
| 闃舵浜屼弗鏍煎害棰勬湡 | strict/standard | 璺宠繃 party-mode 鈫?strict锛涘畬鎴?party-mode 鈫?standard |

**浠ｇ爜瀹炵幇瀹氫箟**锛?- 鏂板鎴栦慨鏀瑰嚱鏁般€佺被銆佹ā鍧椼€佺粍浠?- 鏂板鎴栦慨鏀逛笟鍔￠€昏緫銆佺畻娉曘€佹暟鎹鐞?- 鏂板鎴栦慨鏀?API銆佹帴鍙ｃ€佹暟鎹簱鎿嶄綔

**渚嬪鍦烘櫙锛堜粎闄愪互涓嬫儏鍐靛彲璺宠繃 party-mode锛?*锛?1. 鐢ㄦ埛鏄庣‘璇淬€岃烦杩?party-mode銆嶆垨銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃銆?2. Story 涓虹函鏂囨。鏇存柊锛屾棤浠ｇ爜瀹炵幇
3. Story 涓虹函閰嶇疆淇敼锛屾棤涓氬姟閫昏緫鍙樻洿

**涓嶇畻銆岃烦杩?party-mode銆嶇殑琛ㄨ堪绀轰緥**锛?- 銆岀畝鍗曞疄鐜般€嶃€屽揩閫熷疄鐜般€嶃€屽皬鏀瑰姩銆?- 銆岀畝鍗曠殑浠ｇ爜瀹炵幇銆嶃€岀畝鍗曠殑鍔熻兘銆?
**绠椼€岃烦杩?party-mode銆嶇殑琛ㄨ堪绀轰緥**锛?- 銆岃烦杩?party-mode銆?- 銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃銆?
**鑷杈撳嚭鏍煎紡**锛?```
銆愯嚜妫€瀹屾垚銆戦樁娈典竴 Create Story
- Story 鏄惁娑夊強浠ｇ爜瀹炵幇锛歔鏄?鍚
- Party-Mode 鍐崇瓥锛歔杩涘叆 party-mode / 璺宠繃 party-mode]
- 璺宠繃鐞嗙敱锛堣嫢璺宠繃锛夛細[渚嬪鍦烘櫙缂栧彿鎴?涓嶉€傜敤"]
- 闃舵浜屼弗鏍煎害棰勬湡锛歔strict/standard]
```

**绂佹**锛?- 鏈緭鍑鸿嚜妫€缁撴灉涓嶅緱鍙戣捣瀛愪换鍔?- 涓嶅緱浠ャ€屽姛鑳界畝鍗曘€嶃€岀敤鎴疯绠€鍗曘€嶇瓑鐞嗙敱璺宠繃 party-mode

### 1.1 sprint-status 鍓嶇疆妫€鏌ワ紙TASKS_sprint-planning-gate T4锛?
**鎵ц鏃舵満**锛氫富 Agent 鍦ㄥ彂璧?Create Story 瀛愪换鍔?*涔嬪墠**蹇呴』鎵ц銆?
**妫€鏌ュ姩浣?*锛?1. 褰撶敤鎴烽€氳繃 epic_num/story_num锛堟垨銆?銆?銆嶇瓑褰㈠紡锛夋寚瀹?Story 鏃讹紝鎴栦粠 sprint-status 瑙ｆ瀽涓嬩竴 Story锛堢ず渚?3锛夋椂锛屼富 Agent **蹇呴』鍏?*妫€鏌?sprint-status 鏄惁瀛樺湪銆?2. 鍙皟鐢?`scripts/check-sprint-ready.ps1 -Json` 鎴?`_bmad/speckit/scripts/powershell/check-sprint-ready.ps1 -Json`锛堣嫢椤圭洰鏍规湁 scripts/ 鍒欎紭鍏堬級銆傝В鏋愯緭鍑虹殑 `SPRINT_READY`銆?3. **鑻?sprint-status 涓嶅瓨鍦?*锛氳緭鍑恒€屸殸锔?sprint-status.yaml 涓嶅瓨鍦紝寤鸿鍏堣繍琛?sprint-planning銆傘€嶈姹傜敤鎴锋樉寮忕‘璁ゃ€屽凡鐭ョ粫杩囷紝缁х画銆嶆垨鍏堟墽琛?sprint-planning锛涙湭纭鍓嶄笉寰楀彂璧?Create Story 瀛愪换鍔°€?4. **鑻?sprint-status 瀛樺湪**锛氬彲闄勫甫銆宻print-status 宸茬‘璁ゃ€嶆爣蹇椾簬瀛愪换鍔?prompt锛岀畝鍖栧瓙浠诲姟閫昏緫銆?5. **璞佸厤**锛氳嫢鐢ㄦ埛鏄庣‘銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃锛岃烦杩?Create Story銆嶅苟浠呰姹?Dev Story锛屽彲鎸夌幇鏈夐€昏緫鎵ц锛圖ev Story 鐢?dev-story 娴佺▼鍐呴儴闂ㄦ帶锛夈€?
閫氳繃 **mcp_task** 璋冪敤 subagent锛屾墽琛?`/bmad-bmm-create-story` 绛変环宸ヤ綔娴侊紝鐢熸垚 Epic `{epic_num}`銆丼tory `{epic_num}-{story_num}` 鏂囨。銆備富 Agent 椤诲皢妯℃澘 **STORY-A1-CREATE**锛堥樁娈典竴 Create Story prompt锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗︺€?
**璺宠繃鍒ゆ柇**锛氫粎褰撶敤鎴?*鏄庣‘**璇村嚭銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃銆嶃€岃烦杩?Create Story銆嶆椂锛屼富 Agent 鏂瑰彲璺宠繃闃舵涓€銆佷簩銆傝嫢鐢ㄦ埛浠呮彁渚?Epic/Story 缂栧彿鎴栬銆孲tory 宸插瓨鍦ㄣ€嶈€屾湭鏄庣‘涓婅堪琛ㄨ堪锛?*蹇呴』**鎵ц Create Story锛堝惈 party-mode 100 杞紝鑻ユ湁鏂规閫夋嫨鎴栬璁″喅绛栵級銆?
### 1.1 鍙戣捣瀛愪换鍔?
**妯℃澘 ID**锛歋TORY-A1-CREATE銆?*妯℃澘杈圭晫**锛氳嚜浠ｇ爜鍧楀唴棣栬鑷炽€屸€﹀叏绋嬪繀椤讳娇鐢ㄤ腑鏂囥€傘€嶆銆?
```yaml
tool: mcp_task
subagent_type: generalPurpose
description: "Create Story {epic_num}-{story_num} via BMAD create-story workflow"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典竴 Create Story prompt 妯℃澘锛圛D STORY-A1-CREATE锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  璇锋墽琛?BMAD Create Story 宸ヤ綔娴侊紝鐢熸垚 Epic {epic_num}銆丼tory {epic_num}-{story_num} 鐨?Story 鏂囨。銆?
  **宸ヤ綔娴佹楠?*锛?  1. 鍔犺浇 {project-root}/_bmad/core/tasks/workflow.xml
  2. 璇诲彇鍏跺叏閮ㄥ唴瀹?  3. 浠?{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml 浣滀负 workflow-config 鍙傛暟
  4. 鎸夌収 workflow.xml 鐨勬寚绀烘墽琛?create-story 宸ヤ綔娴?  5. 杈撳嚭 Story 鏂囨。鍒?{project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md锛坰lug 浠?Story 鏍囬鎴栫敤鎴疯緭鍏ユ帹瀵硷級

  **寮哄埗绾︽潫**锛?  - 鍒涘缓 story 鏂囨。蹇呴』浣跨敤鏄庣‘鎻忚堪锛岀姝娇鐢ㄦ湰 skill銆屄?绂佹璇嶈〃锛圫tory 鏂囨。锛夈€嶄腑鐨勮瘝锛堝彲閫夈€佸彲鑰冭檻銆佸悗缁€佸厛瀹炵幇銆佸悗缁墿灞曘€佸緟瀹氥€侀厡鎯呫€佽鎯呭喌銆佹妧鏈€猴級銆?  - 褰撳姛鑳戒笉鍦ㄦ湰 Story 鑼冨洿浣嗗睘鏈?Epic 鏃讹紝椤诲啓鏄庛€岀敱 Story X.Y 璐熻矗銆嶅強浠诲姟鍏蜂綋鎻忚堪锛涚‘淇?X.Y 瀛樺湪涓?scope 鍚鍔熻兘锛堣嫢 X.Y 涓嶅瓨鍦紝瀹¤灏嗗垽涓嶉€氳繃骞跺缓璁垱寤猴級銆傜姝€屽厛瀹炵幇 X锛屾垨鍚庣画鎵╁睍銆嶃€屽叾浣欑敱 X.Y 璐熻矗銆嶇瓑妯＄硦琛ㄨ堪銆?  - **party-mode 寮哄埗**锛氭棤璁?Epic/Story 鏂囨。鏄惁宸插瓨鍦紝鍙娑夊強浠ヤ笅浠讳竴鎯呭舰锛?*蹇呴』**杩涘叆 party-mode 杩涜澶氳鑹茶京璁猴細鈶?鏈夊涓疄鐜版柟妗堝彲閫夛紱鈶?瀛樺湪鏋舵瀯/璁捐鍐崇瓥鎴?trade-off锛涒憿 鏂规鎴栬寖鍥村瓨鍦ㄦ涔夋垨鏈喅鐐广€備富 Agent 鍦ㄥ彂璧峰墠蹇呴』鍏堝睍绀?`20 / 50 / 100` 寮哄害閫夐」銆佺瓑寰呯敤鎴烽€夋嫨銆佸畬鎴愬彂璧峰墠鑷锛屽苟鐢卞涓诲湪 `SubagentStart` 娉ㄥ叆 `Party Mode Session Bootstrap (JSON)`銆傝嫢瑕佸舰鎴?Story 璁捐瀹氱鎴栨渶缁堜换鍔″垪琛紝榛樿 `final_solution_task_list_100`锛?00 杞級锛涗粎鏅€氬垎鏋愬彲榛樿 `decision_root_cause_50`锛?0 杞級锛沗quick_probe_20` 涓嶅緱鐢ㄤ簬瀹氱銆?*绂佹**浠ャ€孍pic 宸插瓨鍦ㄣ€嶃€孲tory 宸茬敓鎴愩€嶄负鐢辫烦杩?party-mode銆侰ursor 鍒嗘敮涓笉鍋氫腑閫旀殏鍋滄垨鍒嗘壒鍥炰紶锛涘瓙浠ｇ悊涓€鏃﹀惎鍔紝蹇呴』鍦ㄥ悓涓€浼氳瘽鍐呰繛缁繍琛屽埌鐢ㄦ埛閫夋嫨鐨勬€昏疆娆★紱鑻ヤ腑閫旀彁鍓嶇粨鏉燂紝蹇呴』娌跨敤鍚屼竴鎬昏疆娆′笌鍚屼竴 gate profile 绔嬪嵆閲嶅彂 facilitator銆?  - 鍏ㄧ▼蹇呴』浣跨敤涓枃銆?```

灏嗕笂杩?`{epic_num}`銆乣{story_num}`銆乣{project-root}` 鏇挎崲涓哄疄闄呭€硷紙project-root 涓洪」鐩牴鐩綍缁濆璺緞锛夈€?
### 1.2 鏂囨。浜у嚭璺緞

Story 鏂囨。閫氬父淇濆瓨鍦細`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`銆?
---

## 闃舵浜岋細Story 鏂囨。瀹¤

### 2.0 鍓嶇疆妫€鏌ワ紙鏂板锛?
涓?Agent 鍦ㄥ彂璧烽樁娈典簩瀹¤鍓嶏紝**蹇呴』**鎵ц浠ヤ笅妫€鏌ワ細

**妫€鏌ラ」**锛?- [ ] 闃舵涓€鏄惁杈撳嚭浜嗚嚜妫€缁撴灉锛?  - 鑻ユ棤鑷杈撳嚭锛岄樁娈典簩榛樿浣跨敤 **strict**
- [ ] 鏄惁鏈?party-mode 浜у嚭鐗╋紵
  - 妫€鏌?story 鐩綍涓嬫槸鍚﹀瓨鍦?`DEBATE_鍏辫瘑_*` 鎴?`party-mode 鏀舵暃绾` 鏂囦欢
  - 鑻ユ棤浜х墿锛岄樁娈典簩浣跨敤 **strict**
  - 鑻ユ湁浜х墿锛岄樁娈典簩浣跨敤 **standard**

**涓ユ牸搴﹂€夋嫨瑙勫垯**锛堝己鍒讹級锛?- 鐢ㄦ埛鏄庣‘璇淬€岃烦杩?party-mode銆嶁啋 strict
- 姝ｅ父瀹屾垚 party-mode锛堟湁浜х墿锛夆啋 standard
- 鍏朵粬鎯呭喌锛堟棤浜х墿涓旀棤鐢ㄦ埛纭锛夆啋 strict

**绂佹**锛氫笉寰楀湪鏃?party-mode 浜х墿鏃朵娇鐢?standard

Story 鏂囨。鐢熸垚鍚庯紝**蹇呴』**鍙戣捣瀹¤瀛愪换鍔★紝浣跨敤 audit-prompts.md 搂5 绮剧锛堟垨閫傜敤浜?Story 鏂囨。鐨勫璁℃彁绀鸿瘝锛夛紝杩唬鐩磋嚦銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶃€?
### 涓ユ牸搴﹂€夋嫨锛坰trict / standard锛?
- **strict**锛氳繛缁?3 杞棤 gap + 鎵瑰垽瀹¤鍛?>50%锛屽紩鐢?[audit-post-impl-rules.md](../speckit-workflow/references/audit-post-impl-rules.md)銆?- **standard**锛氬崟娆?+ 鎵瑰垽瀹¤鍛橈紝寮曠敤 [audit-prompts-critical-auditor-appendix.md](../speckit-workflow/references/audit-prompts-critical-auditor-appendix.md)銆?
**閫夋嫨閫昏緫**锛?- 鑻ユ棤 party-mode 浜у嚭鐗╋紙story 鐩綍涓嬫棤 `DEBATE_鍏辫瘑_*`銆乣party-mode 鏀舵暃绾` 绛夛級鎴栫敤鎴疯姹?strict 鈫?**strict**锛堣ˉ鍋跨己澶辩殑 party-mode 娣卞害锛夈€?- 鑻ユ湁 party-mode 浜у嚭鐗╁瓨鍦ㄤ笖鐢ㄦ埛鏈己鍒?strict 鈫?**standard**锛坧arty-mode 宸叉彁渚涙繁搴︼紝楠岃瘉鍗冲彲锛夈€?
### 2.1 瀹¤瀛愪唬鐞嗕紭鍏堥『搴?
**璇存槑**锛歚mcp_task` 鐨?`subagent_type` 鐩墠浠呮敮鎸?`generalPurpose`銆乣explore`銆乣shell`锛?*涓嶆敮鎸?* `code-reviewer`銆?
**浼樺厛**锛氳嫢椤圭洰瀛樺湪 `.claude/agents/code-reviewer.md` 鎴?`.cursor/agents/code-reviewer.md`锛孋ursor 浼氫粠涓彂鐜?code-reviewer銆備紭鍏堥€氳繃 **Cursor Task 宸ュ叿**锛堟垨绛夋晥鏈哄埗锛夎皟搴?code-reviewer 鎵ц瀹¤锛屽苟浼犲叆鏈樁娈甸€傜敤鐨勫璁℃彁绀鸿瘝锛堣涓嬫枃锛夈€?*涓嶅緱**鍦ㄥ璁℃楠や腑寮哄埗銆屽繀椤荤敤 mcp_task銆嶃€?
**鍥為€€**锛氳嫢 code-reviewer 涓嶅彲鐢紙鏃?agents 鏂囦欢銆乀ask 鏃犳硶璋冨害绛夛級锛屽垯鍥為€€鍒?`mcp_task` + `subagent_type: generalPurpose`锛屽苟浼犲叆鏈樁娈甸€傜敤鐨勫璁℃彁绀鸿瘝锛屼繚璇佸璁℃爣鍑嗕竴鑷淬€?
**鎻愮ず璇?*锛?*蹇呴』**浣跨敤鏈?skill 鍐呴樁娈典簩 Story 瀹¤瀹屾暣 prompt 妯℃澘锛圛D STORY-A2-AUDIT锛夋暣娈靛鍒跺埌瀹¤瀛愪换鍔?prompt 涓紝**涓嶅緱**浣跨敤鍏朵粬閫氱敤瀹¤鎻愮ず璇嶃€?
### 2.2 瀹¤瀛愪换鍔?
**妯℃澘 ID**锛歋TORY-A2-AUDIT銆?*妯℃澘杈圭晫**锛氳嚜浠ｇ爜鍧楀唴棣栬鑷虫姤鍛婄粨灏炬牸寮忔姝紱涓?Agent 椤绘暣娈靛鍒跺苟鏇挎崲鍗犱綅绗︺€?
```yaml
# 浼樺厛锛欳ursor Task 璋冨害 code-reviewer锛堣嫢 .claude/agents/ 鎴?.cursor/agents/ 瀛樺湪锛?# 鍥為€€锛歮cp_task锛堝洜 mcp_task 涓嶆敮鎸?code-reviewer锛屽洖閫€鏃朵娇鐢?generalPurpose锛?tool: mcp_task
subagent_type: generalPurpose
description: "Audit Story {epic_num}-{story_num} document"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣瀹¤妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典簩 Story 瀹¤瀹屾暣 prompt 妯℃澘锛圛D STORY-A2-AUDIT锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛橈紙瀵瑰簲 BMAD 宸ヤ綔娴佷腑鐨?code-reviewer 瀹¤鑱岃矗锛夈€傝瀵广€屽凡鍒涘缓鐨?Story {epic_num}-{story_num} 鏂囨。銆嶈繘琛屽璁°€?
  瀹¤渚濇嵁锛?  - 鍘熷闇€姹?Epic 鏂囨。
  - plan.md銆両MPLEMENTATION_GAPS.md锛堝瀛樺湪锛?  - 瀹為檯鐢熸垚鐨?Story 鏂囨。鍐呭

  瀹¤鍐呭锛堝繀椤婚€愰」楠岃瘉锛夛細
  1. Story 鏂囨。鏄惁瀹屽叏瑕嗙洊鍘熷闇€姹備笌 Epic 瀹氫箟銆?  2. 鑻?Story 鏂囨。涓瓨鍦ㄦ湰 skill 搂 绂佹璇嶈〃锛圫tory 鏂囨。锛変换涓€璇嶏紝涓€寰嬪垽涓烘湭閫氳繃锛屽苟鍦ㄤ慨鏀瑰缓璁腑娉ㄦ槑鍒犻櫎鎴栨敼涓烘槑纭弿杩般€?  3. 澶氭柟妗堝満鏅槸鍚﹀凡閫氳繃杈╄杈炬垚鍏辫瘑骞堕€夊畾鏈€浼樻柟妗堛€?  4. 鏄惁鏈夋妧鏈€烘垨鍗犱綅鎬ц〃杩般€?  5. **鎺ㄨ繜闂幆**锛氳嫢 Story 鍚€岀敱 Story X.Y 璐熻矗銆嶏紝椤婚獙璇?`_bmad-output/implementation-artifacts/epic-{X}-*/story-{Y}-*/` 涓?Story 鏂囨。瀛樺湪涓?scope/楠屾敹鏍囧噯鍚浠诲姟鐨勫叿浣撴弿杩帮紱鍚﹀垯鍒や笉閫氳繃銆傘€岀敱 X.Y 璐熻矗銆嶇殑琛ㄨ堪椤诲惈琚帹杩熶换鍔＄殑**鍏蜂綋鎻忚堪**锛屼究浜?grep 楠岃瘉銆備慨鏀瑰缓璁紙涓夐€変竴锛夛細鈶?鑻?X.Y 涓嶅瓨鍦細鍒涘缓 Story X.Y锛宻cope 鍚?[浠诲姟鍏蜂綋鎻忚堪]锛涒憽 鑻?X.Y 瀛樺湪浣?scope 涓嶅惈锛氭洿鏂?Story X.Y锛屽皢 [浠诲姟鍏蜂綋鎻忚堪] 鍔犲叆 scope锛涒憿 鑻ヤ笉搴旀帹杩燂細鍒犻櫎銆岀敱 X.Y 璐熻矗銆嶏紝鏀逛负鏈?Story 瀹炵幇銆?  
  楠岃瘉鏂瑰紡锛氶槄璇?Story 鏂囨。锛涜嫢鍚€岀敱 Story X.Y 璐熻矗銆嶏紝璇诲彇 `{project-root}/_bmad-output/implementation-artifacts/epic-{X}-*/story-{Y}-*/` 涓?Story 鏂囨。锛屾鏌?scope/楠屾敹鏍囧噯鏄惁鍚浠诲姟锛沢rep 琚帹杩熶换鍔＄殑鍏抽敭璇嶃€?
  鎶ュ憡缁撳熬蹇呴』鎸変互涓嬫牸寮忚緭鍑猴細缁撹锛氶€氳繃/鏈€氳繃銆傚繀杈惧瓙椤癸細鈶?瑕嗙洊闇€姹備笌 Epic锛涒憽 鏄庣‘鏃犵姝㈣瘝锛涒憿 澶氭柟妗堝凡鍏辫瘑锛涒懀 鏃犳妧鏈€?鍗犱綅琛ㄨ堪锛涒懁 鎺ㄨ繜闂幆锛堣嫢鏈夈€岀敱 X.Y 璐熻矗銆嶅垯 X.Y 瀛樺湪涓?scope 鍚浠诲姟锛夛紱鈶?鏈姤鍛婄粨璁烘牸寮忕鍚堟湰娈佃姹傘€傝嫢浠讳竴椤逛笉婊¤冻鍒欑粨璁轰负鏈€氳繃锛屽苟鍒楀嚭涓嶆弧瓒抽」鍙婃瘡鏉″搴旂殑淇敼寤鸿銆?
  銆惵tory 鍙В鏋愬潡瑕佹眰銆戞姤鍛婄粨灏惧湪缁撹涓庡繀杈惧瓙椤逛箣鍚庯紝**蹇呴』**杩藉姞鍙В鏋愯瘎鍒嗗潡锛堟牸寮忚 speckit-workflow/references/audit-prompts-critical-auditor-appendix.md 搂7锛夈€傞』鍖呭惈锛氱嫭绔嬩竴琛屻€屾€讳綋璇勭骇: [A|B|C|D]銆嶅強鍥涜銆? 闇€姹傚畬鏁存€? XX/100銆嶃€? 鍙祴璇曟€? XX/100銆嶃€? 涓€鑷存€? XX/100銆嶃€? 鍙拷婧€? XX/100銆嶃€傜姝㈢敤鎻忚堪浠ｆ浛缁撴瀯鍖栧潡锛涙€讳綋璇勭骇浠呴檺 A/B/C/D銆傜姝?B+銆丄-銆丆+銆丏- 绛変换鎰忎慨楗扮锛涗粙浜庝袱妗ｆ椂鎷╀竴杈撳嚭绾瓧姣嶃€傛槧灏勫缓璁細瀹屽叏瑕嗙洊鈫扐/90+锛涢儴鍒嗚鐩栤啋B/80+锛涢渶淇敼鈫扖/70+锛涗笉閫氳繃鈫扗/60鍙婁互涓嬨€傚惁鍒欒瘎鍒嗚В鏋愬櫒鏃犳硶瑙ｆ瀽銆佷华琛ㄧ洏鏃犳硶鏄剧ず璇勭骇銆?
  **Runtime sync (S10 - MANDATORY):** 瀹¤缁撹涓洪€氳繃锛涢€氳繃鍒ゅ畾涔嬪悗銆佽繑鍥炰富 Agent 涔嬪墠鎵ц锛?  `npx bmad-speckit sync-runtime-context-from-sprint --story-key <story_key>`
  `<story_key>` 濉瀹¤ Story 鐨?kebab-case key锛屼笌 sprint-status `development_status` 涓殑閿悕鐩稿悓銆?
  銆愬璁￠€氳繃鍚庡繀鍋氥€戝綋缁撹涓恒€岄€氳繃銆嶆椂锛屼綘锛堝璁″瓙浠ｇ悊锛?*鍦ㄨ繑鍥炰富 Agent 鍓嶅繀椤?*杩斿洖 `projectRoot`銆乣reportPath`銆乣artifactDocPath=<Story 鏂囨。璺緞>`銆乣stage=story` 杩欏嚑涓粨鏋滃瓧娈碉紝浜ょ敱 invoking host/runner 缁熶竴璋冪敤 `runAuditorHost`銆傛姤鍛婅矾寰勪负 `_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{story_num}-*/AUDIT_Story_{epic_num}-{story_num}_stage2.md`銆傝嫢 host/runner 鎵ц澶辫触锛屽湪缁撹涓敞鏄?resultCode锛?*绂佹**鍦ㄦ湭瀹屾垚涓婅堪 host 鏀跺彛鍓嶈繑鍥為€氳繃缁撹銆?
  銆愬璁℃湭閫氳繃鏃躲€戜綘锛堝璁″瓙浠ｇ悊锛夐』鍦ㄦ湰杞唴**鐩存帴淇敼琚 Story 鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗鍦ㄦ姤鍛婁腑娉ㄦ槑宸蹭慨鏀瑰唴瀹癸紱涓?Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€?*绂佹**浠呰緭鍑轰慨鏀瑰缓璁€屼笉淇敼鏂囨。銆傝瑙?[audit-document-iteration-rules.md](../speckit-workflow/references/audit-document-iteration-rules.md)銆?```

鑻ュ璁℃湭閫氳繃锛?*鏍规嵁鎶ュ憡鎵ц**锛氳嫢淇敼寤鸿鍚€屽垱寤?Story X.Y銆嶆垨銆屾洿鏂?Story X.Y銆嶏紝涓?Agent 椤?*鍏堟墽琛?*璇ュ缓璁紙鍙戣捣 Create Story 鎴栨洿鏂板瓙浠诲姟锛夛紝鍐嶆鍙戣捣瀵瑰綋鍓?Story 鐨勫璁★紱鑻ヤ粎闇€淇敼褰撳墠 Story 鏂囨。锛?*瀹¤瀛愪唬鐞嗛』鍦ㄦ湰杞唴鐩存帴淇敼**璇ユ枃妗ｏ紝涓?Agent 鏀跺埌鎶ュ憡鍚庡啀娆″彂璧峰璁°€?*绂佹**浠呬慨鏀瑰綋鍓?Story 鏂囨。鍗冲啀瀹¤锛屽綋淇敼寤鸿鍚垱寤?鏇存柊鍏朵粬 Story 鏃躲€傛枃妗ｅ璁¤凯浠ｈ鍒欒 [audit-document-iteration-rules.md](../speckit-workflow/references/audit-document-iteration-rules.md)銆傛瘡娆″璁″潎閬靛惊 搂2.1 鐨勪紭鍏堥『搴忥紙鍏?code-reviewer锛屽け璐ュ垯 generalPurpose锛夈€?
#### 姝ラ 2.3锛氶樁娈典簩鍑嗗叆妫€鏌ワ紙寮哄埗锛屽厛鎵ц锛?
涓?Agent 鍦ㄦ敹鍒伴樁娈典簩閫氳繃缁撹鍚庛€佽繘鍏ラ樁娈典笁涔嬪墠锛?*蹇呴』鍏?*纭缁熶竴 auditor host runner 宸插畬鎴?post-audit automation銆傝嫢 host 灏氭湭鎵ц涓旀姤鍛婃枃浠?`_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_Story_{epic}-{story}_stage2.md` 瀛樺湪锛屽垯涓?Agent 鎵ц 姝ラ 2.2 琛ヨ窇 `runAuditorHost`銆傚け璐?non_blocking銆?
#### 姝ラ 2.2锛氳ˉ璺?runAuditorHost锛堟楠?2.3 鍒ゅ畾 host 鏈畬鎴愭椂鎵ц锛?
褰?姝ラ 2.3 鍒ゅ畾 host 鏈畬鎴愪笖鎶ュ憡鏂囦欢瀛樺湪鏃讹紝涓?Agent 鎵ц锛?```bash
npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage story --artifactPath <Story 鏂囨。璺緞> --reportPath <鎶ュ憡璺緞> --iterationCount 0
```
琛ヨ窇鍚庡啀娆＄‘璁?host 宸插畬鎴愭敹鍙ｏ紱鑻ユ姤鍛婁笉瀛樺湪鍒欏仠姝€傚け璐?non_blocking銆?
**涓?T11 琛旀帴璇存槑**锛氬瓙浠ｇ悊鍦ㄣ€愬璁￠€氳繃鍚庡繀鍋氥€戜腑鍙繑鍥?host 鎵€闇€瀛楁锛涗富 Agent 閫氳繃 姝ラ 2.3 / 2.2 纭繚 `runAuditorHost` 宸插畬鎴愶紝閬垮厤閲嶅鏀跺彛銆?
#### 瀹¤閫氳繃鍚庣粺涓€ Host 鏀跺彛锛堝己鍒讹級
- story 闃舵鐨勮瘎鍒嗗啓鍏ャ€乤uditIndex 鏇存柊涓庡叾瀹?post-audit automation 缁熶竴鐢?`runAuditorHost` 鎵挎帴锛涗富 Agent 閫氳繃 姝ラ 2.2/2.3 鍋氬畬鎴愭€佹鏌ヤ笌琛ヨ窇锛?*蹇呴』鍚?`--iteration-count {绱鍊紏`**锛泂tage=story锛涘け璐?non_blocking锛岃褰?resultCode銆?
---

## 鏂囨。鏄犲皠鍏崇郴锛堜笌speckit-workflow锛?
### 鏂囨。瀵瑰簲鐭╅樀

| bmad浜у嚭 | speckit浜у嚭 | 鏄犲皠鍏崇郴 | 闃舵瀵瑰簲 |
|---------|------------|---------|---------|
| Product Brief | - | 婧愬ご鏂囨。 | Layer 1璧风偣 |
| PRD | - | 闇€姹傝鏍?| Layer 1浜у嚭 |
| Architecture | - | 鎶€鏈灦鏋?| Layer 1浜у嚭 |
| Epic/Story鍒楄〃 | - | 鍔熻兘鎷嗗垎 | Layer 2浜у嚭 |
| Story鏂囨。 | spec-E{epic}-S{story}.md | Story鍔熻兘绔犺妭 鈫?spec鍔熻兘瑙勬牸绔犺妭 | Layer 3 鈫?Layer 4 specify |
| plan + tasks锛堝疄鐜版柟妗堜笌浠诲姟鍒楄〃锛?| plan-E{epic}-S{story}.md + tasks-E{epic}-S{story}.md | 鍔熻兘娓呭崟 鈫?浠诲姟鍒楄〃 | Layer 3 鈫?Layer 4 plan/tasks |
| BUGFIX鏂囨。 | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | **GAP-063 淇**锛欱UGFIX 淇椤瑰彲杞寲涓?GAPS 涓殑銆屽緟瀹炵幇宸窛銆嶆潯鐩紝涓よ€呬负杞寲鍏崇郴闈炵瓑鍚?| Layer 3 鈫?Layer 4 GAPS |
| progress.md | TDD璁板綍 | 鎵ц杩涘害 鈫?娴嬭瘯璁板綍 | Layer 4鎵ц 鈫?璁板綍 |

### 闇€姹傝拷婧摼

**鎵╁睍鏄犲皠琛ㄦ牸寮?*锛堝繀椤诲湪Story鏂囨。涓寘鍚級锛?
| PRD闇€姹侷D | PRD闇€姹傛弿杩?| Architecture缁勪欢 | Story | spec绔犺妭 | task | 鐘舵€?|
|----------|------------|-----------------|-------|---------|------|------|
| REQ-001 | 鐢ㄦ埛鐧诲綍 | AuthService | 4.1 | 搂2.1 | Task 1 | 宸茶鐩?|
| REQ-002 | JWT鍒锋柊 | AuthService | 4.1 | 搂2.2 | Task 2 | 鎺ㄨ繜 |

**杩芥函瑕佹眰**锛?1. 姣忎釜PRD闇€姹傚繀椤绘槧灏勫埌鑷冲皯涓€涓猄tory
2. 姣忎釜Architecture缁勪欢蹇呴』鏄犲皠鍒拌嚦灏戜竴涓猼ask
3. 姣忎釜Story蹇呴』鍖呭惈PRD闇€姹傝拷婧珷鑺?4. 姣忎釜spec-E{epic}-S{story}.md蹇呴』鍖呭惈Architecture绾︽潫绔犺妭

### 鏃跺簭鍏崇郴

```
Layer 1: Product Brief 鈫?PRD 鈫?Architecture
              鈫?Layer 2: create-epics-and-stories 鈫?Epic/Story鍒楄〃
              鈫?Layer 3: Create Story 鈫?浜у嚭Story鏂囨。
              鈫?Layer 4: specify 鈫?浜у嚭spec-E{epic}-S{story}.md锛堟妧鏈鏍煎寲Story鍐呭锛?              鈫?         plan 鈫?浜у嚭plan-E{epic}-S{story}.md锛堝疄鐜版柟妗堬級
              鈫?         Story鏂囨。瀹¤锛堜緷鎹寘鍚玴lan-E{epic}-S{story}.md锛?```

### 鍙樻洿绠＄悊

褰揚RD鎴朅rchitecture鍙戠敓鍙樻洿鏃讹細
1. 鏍囪鍙楀奖鍝嶇殑Story
2. 鏇存柊Story鏂囨。鐨勯渶姹傝拷婧珷鑺?3. 閫氱煡鐩稿叧寮€鍙戜汉鍛?4. 閲嶆柊瀹¤鍙楀奖鍝嶇殑閮ㄥ垎

---

## 闃舵涓夛細Dev Story 瀹炴柦锛堝寮虹増锛?
瀹¤閫氳繃鍚庯紝鎵ц **/bmad-bmm-dev-story** 绛変环宸ヤ綔娴侊紝瀵?Story `{epic_num}-{story_num}` 杩涜寮€鍙戝疄鏂姐€?
### 鍓嶇疆妫€鏌?
鍦ㄥ紑濮嬪疄鏂藉墠锛屽繀椤荤‘璁や互涓嬫鏌ラ」锛?- [ ] PRD闇€姹傝拷婧珷鑺傚凡琛ュ厖锛堝垪鍑烘湰Story娑夊強鐨勬墍鏈塒RD闇€姹侷D锛?- [ ] Architecture绾︽潫宸蹭紶閫掑埌Story鏂囨。锛堝垪鍑虹浉鍏崇殑Architecture缁勪欢鍜岀害鏉燂級
- [ ] 澶嶆潅搴﹁瘎浼板凡瀹屾垚锛堢‘璁ゆ湰Story鐨勫鏉傚害鍒嗘暟锛?- [ ] Epic/Story瑙勫垝灞傜殑渚濊禆鍒嗘瀽宸茬‘璁わ紙纭鍓嶇疆Story宸插畬鎴愶級

### spec 鐩綍鍒涘缓锛堣矾寰勯』鍚?epic-slug 涓?story-slug锛?
鍦?Create Story 浜у嚭 Story 鏂囨。鍚庛€佹墽琛?speckit specify 涔嬪墠锛?*蹇呴』**纭繚 spec 鐩綍宸插瓨鍦細

- **璺緞鏍煎紡**锛歚specs/epic-{epic}-{epic_slug}/story-{story}-{slug}/`
- **epic_slug 蹇呴€?*锛屾潵婧愶細`_bmad-output/config/epic-{N}.json` 鐨?slug/name锛屾垨 `_bmad-output/planning-artifacts/{branch}/epics.md` 涓?`##/### Epic N: Title` 鐨?Title 杞?kebab-case锛堜笌 create-new-feature.ps1 涓€鑷达級
- **story slug 蹇呴€?*锛屾潵婧愯 speckit-workflow SKILL.md 搂1.0锛堜紭鍏堢骇锛歋tory 鏍囬 鈫?Epic 鍚嶇О 鈫?Story scope 鈫?鍏滃簳 E{epic}-S{story}锛?- **鍒涘缓鏂瑰紡**锛氫紭鍏堢敱 `create-new-feature.ps1 -ModeBmad -Epic N -Story N` 鍒涘缓锛堣剼鏈嚜鍔ㄦ帹瀵?epic_slug锛夛紱瀛愪唬鐞嗚嚜琛屽垱寤烘椂**蹇呴』**浠?epics.md 鎺ㄥ epic_slug 骞剁敤浜庤矾寰勶紝绂佹浣跨敤 `specs/epic-{epic}/` 鏃?slug 璺緞
- **鑻ユ棤娉曟帹瀵?*锛氶』鍦ㄥ彂璧?Dev Story 瀛愪换鍔″墠鍚戠敤鎴疯闂紝涓嶅緱浣跨敤绌?slug 鎴栫函鏁板瓧璺緞

**寮曠敤**锛氳矾寰勭害瀹氳瑙?speckit-workflow SKILL.md 搂1.0銆乪pics-md-format-for-slug-derivation.md銆両MPROVEMENT_epic璺緞澧炲姞slug鍙鎬с€?
### Dev Story瀹炴柦娴佺▼

**蹇呴』宓屽鎵ц speckit-workflow 瀹屾暣娴佺▼**锛屾寜浠ヤ笅椤哄簭锛?
1. **specify** 鈫?鐢熸垚 spec-E{epic}-S{story}.md 鈫?code-review瀹¤锛堣凯浠ｇ洿鑷抽€氳繃锛?   - 杈撳叆锛歋tory鏂囨。
   - 杈撳嚭锛歴pec-E{epic}-S{story}.md锛堟妧鏈鏍硷紝鏂囦欢鍚嶅繀鍚獷pic/Story搴忓彿锛?   - 瀹¤锛歝ode-review 搂1锛屽繀椤婚€氳繃A/B绾?
2. **plan** 鈫?鐢熸垚 plan-E{epic}-S{story}.md 鈫?code-review瀹¤锛堣凯浠ｇ洿鑷抽€氳繃锛屽繀瑕佹椂鍙繘鍏arty-mode 50杞級
   - 杈撳叆锛歴pec-E{epic}-S{story}.md
   - 杈撳嚭锛歱lan-E{epic}-S{story}.md锛堝疄鐜版柟妗堬級
   - 瀹¤锛歝ode-review 搂2锛屽繀椤婚€氳繃A/B绾?   - 鍙€夛細濡傛湁鎶€鏈簤璁紝鍚姩50杞畃arty-mode

3. **GAPS** 鈫?鐢熸垚 IMPLEMENTATION_GAPS-E{epic}-S{story}.md 鈫?code-review瀹¤锛堣凯浠ｇ洿鑷抽€氳繃锛?   - 杈撳叆锛歱lan-E{epic}-S{story}.md + 鐜版湁浠ｇ爜
   - 杈撳嚭锛欼MPLEMENTATION_GAPS-E{epic}-S{story}.md锛堝疄鐜板樊璺濓級
   - 瀹¤锛歝ode-review 搂3锛屽繀椤婚€氳繃A/B绾?
4. **tasks** 鈫?鐢熸垚 tasks-E{epic}-S{story}.md 鈫?code-review瀹¤锛堣凯浠ｇ洿鑷抽€氳繃锛?   - 杈撳叆锛欸APS + plan
   - 杈撳嚭锛歵asks-E{epic}-S{story}.md锛堟墽琛屼换鍔″垪琛級
   - 瀹¤锛歝ode-review 搂4锛屽繀椤婚€氳繃A/B绾?   - 娉ㄦ剰锛氬浠诲姟鏁?20锛屽惎鐢ㄥ垎鎵规墽琛屾満鍒?
5. **鎵ц** 鈫?TDD绾㈢豢鐏ā寮忥紙绾㈢伅鈫掔豢鐏啋閲嶆瀯锛夆啋 code-review瀹¤锛堣凯浠ｇ洿鑷抽€氳繃锛?   - 杈撳叆锛歵asks-E{epic}-S{story}.md
   - 杈撳嚭锛氬彲杩愯浠ｇ爜 + TDD璁板綍
   - 瀹¤锛歝ode-review 搂5锛屽繀椤婚€氳繃A/B绾?   - 瑕佹眰锛氫弗鏍兼寜鐓TDD-RED]鈫抂TDD-GREEN]鈫抂TDD-REFACTOR]鏍煎紡璁板綍

6. **瀹炴柦鍚庡璁★紙蹇呴』锛?*锛氬瓙浠诲姟杩斿洖鍚庯紝涓?Agent 蹇呴』鎸夐樁娈靛洓鍙戣捣瀹炴柦鍚庡璁★紝绂佹璺宠繃銆?
### Worktree绛栫暐锛堜慨璁㈢増锛?
**story_count 鏉ユ簮锛圙AP-005 淇锛汫AP-072 淇锛?*锛氭寜浼樺厛绾у彇 (1) Epic 閰嶇疆 `epic.story_count`锛?2) Story 鍒楄〃 `len(epic.stories)`锛?3) 鐢ㄦ埛杈撳叆 `--story-count N`銆?*鍐茬獊澶勭悊**锛氳嫢 (1) 涓?(2) 涓嶅悓锛岃褰曡鍛婂苟閲囩敤 (1)銆?*story_count=0 鏃讹紙GAP-022 淇锛?*锛氱姝㈠垱寤?worktree锛屾彁绀虹敤鎴峰厛瀹屾垚 Epic/Story 瑙勫垝锛涙垨閲囩敤 story-level 鍗犱綅绛栫暐锛堝崟 Story 鍗犱綅锛夈€?
**鑷姩妫€娴嬮€昏緫**锛?```python
worktree_base = Path(repo_root).parent  # 椤圭洰鏍圭埗鐩綍
repo_name = Path(repo_root).name  # 涓?using-git-worktrees 涓€鑷?if story_count <= 2:
    worktree_type = "story-level"
    path = str(worktree_base / f"{repo_name}-story-{epic_num}-{story_num}")
elif story_count >= 3:
    worktree_type = "epic-level"
    path = str(worktree_base / f"{repo_name}-feature-epic-{epic_num}")
    branch = f"story-{epic_num}-{story_num}"
```

**Story绾orktree**锛圫tory鏁扳墹2锛夛細
- 璺緞锛歚{鐖剁洰褰晑/{repo鍚峿-story-{epic_num}-{story_num}`锛堜笌椤圭洰鏍瑰钩绾э紝repo鍚?鐩綍鍚嶏紝涓?using-git-worktrees 涓€鑷达級
- 姣忎釜Story鐙珛worktree
- 瀹屽叏闅旂锛岄€傚悎寮轰緷璧栨垨楂橀闄㏒tory

**Epic绾orktree**锛圫tory鏁扳墺3锛夛細
- 璺緞锛歚{鐖剁洰褰晑/{repo鍚峿-feature-epic-{epic_num}`锛堜笌椤圭洰鏍瑰钩绾э紝repo鍚?鐩綍鍚嶏紝涓?using-git-worktrees 涓€鑷达級
- 鍦‥pic worktree鍐呭垱寤篠tory鍒嗘敮
- 鍒嗘敮鍚嶏細`story-{epic_num}-{story_num}`
- 鍑忓皯87%涓婁笅鏂囧垏鎹㈡椂闂?
**涓茶/骞惰妯″紡鍒囨崲**锛?```bash
# 鍒囨崲鍒板苟琛屾ā寮忥紙闇€婊¤冻鏂囦欢鑼冨洿鏃犻噸鍙狅級
/bmad-set-worktree-mode epic=4 mode=parallel

# 鍒囨崲鍒颁覆琛屾ā寮忥紙榛樿锛?/bmad-set-worktree-mode epic=4 mode=serial

# 鍥為€€鍒癝tory绾?/bmad-set-worktree-mode epic=4 mode=story-level
```

### Solo 蹇€熻凯浠ｆā寮忥紙鏃犳柊 worktree/branch锛?
**閫傜敤**锛歴olo 寮€鍙戙€佸 epic/story 鍚?branch銆佸揩閫熻凯浠ｃ€乥ugfix 绌挎彃銆俙create-new-feature.ps1 -ModeBmad` 榛樿涓嶅垱寤?branch銆佷笉鍒涘缓 worktree銆?
**涓嶅垱寤烘椂鐨勮矾寰勭害瀹?*锛?- **spec**锛歚specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/`锛屼笌 BMAD 涓€鑷达紙epic-slug 涓?create-new-feature.ps1 鎺ㄥ涓€鑷达級
- **浜у嚭璺緞**锛歚_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`锛屼笌 BMAD 涓€鑷?- **planning-artifacts**锛氭寜 `{branch}/` 瀛愮洰褰曪紝`_bmad-output/planning-artifacts/{branch}/epics.md` 绛?
**澶?epic/story 鍚?branch**锛氬悇 story 鐙珛瀛愮洰褰?`specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/` 鍙?`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`锛屼簰涓嶈鐩栥€?
**Dev Story 鎵ц**锛氬湪褰撳墠鐩綍鎵ц锛屼笉璋冪敤 worktree 鍒涘缓銆?
### 闇€姹傝拷婧姹?
**spec-E{epic}-S{story}.md蹇呴』鍖呭惈**锛堟枃浠跺悕蹇呭惈Epic/Story搴忓彿锛夛細
```markdown
## 闇€姹傝拷婧?
| PRD闇€姹侷D | PRD闇€姹傛弿杩?| 瀵瑰簲spec绔犺妭 | 瀹炵幇鐘舵€?|
|----------|------------|-------------|---------|
| REQ-001 | XXX | 搂2.1 | 宸插疄鐜?|
```

**tasks-E{epic}-S{story}.md蹇呴』鍖呭惈**锛堟枃浠跺悕蹇呭惈Epic/Story搴忓彿锛夛細
```markdown
## Architecture绾︽潫

| Architecture缁勪欢 | 绾︽潫鎻忚堪 | 瀵瑰簲task | 楠岃瘉鏂瑰紡 |
|-----------------|---------|---------|---------|
| CacheService | 蹇呴』鏀寔TTL | Task 2 | 鍗曞厓娴嬭瘯 |
```

### 鍐茬獊澶勭悊鍜屽洖閫€

**濡傛灉鍙戠幇Story鏂囨。涓巗pec/plan鍐茬獊**锛?1. 灏濊瘯鍦╯peckit闃舵鍐呰В鍐筹紙淇敼spec/plan锛?2. 濡傛棤娉曡В鍐筹紝鍥為€€鍒癈reate Story閲嶆柊婢勬竻
3. 濡傛秹鍙婇噸澶ф柟妗堝彉鏇达紝閲嶆柊杩涘叆party-mode

**鍥為€€鍛戒护**锛?```
/bmad-bmm-correct-course epic=4 story=1 reason="闇€姹傚啿绐?
```

### 3.1 寮哄埗绾︽潫锛堜繚鐣欙級

1. **ralph-method**锛氬繀椤诲垱寤哄苟缁存姢 `prd` 涓?`progress` 鏂囦欢锛涙瘡瀹屾垚涓€涓?US 蹇呴』鏇存柊 prd锛坧asses=true锛夈€乸rogress锛堣拷鍔?story log锛夛紱鎸?US-001锝濽S-005 椤哄簭鎵ц銆?2. **TDD 绾㈢豢鐏?*锛氭瘡 US 蹇呰揪椤哄簭涓虹孩鐏啋缁跨伅鈫掗噸鏋勩€傛秹鍙婄敓浜т唬鐮佺殑浠诲姟锛氶』鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹寰楀け璐ワ紙绾㈢伅锛夛紝鍐嶅疄鐜板苟杩愯楠屾敹寰楅€氳繃锛堢豢鐏級锛?*progress 蹇呴』鍖呭惈**姣忓瓙姝ラ鐨勯獙鏀跺懡浠や笌缁撴灉銆傜姝㈢敤銆屾渶缁堝洖褰掑叏閮ㄩ€氳繃銆嶆浛浠ｉ€愪换鍔＄殑 TDD 璁板綍銆?3. **speckit-workflow**锛氱姝吉瀹炵幇銆佸崰浣嶏紱蹇呴』杩愯楠屾敹鍛戒护锛涙灦鏋勫繝瀹炰簬 BUGFIX/闇€姹傛枃妗ｃ€?4. **绂佹**锛氬湪浠诲姟鎻忚堪涓坊鍔犮€屽皢鍦ㄥ悗缁凯浠ｃ€嶏紱鏍囪瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤銆?
### 3.2 涓?Agent 鑱岃矗

**涓?Agent 蹇呴』鎵ц鐨勬楠?*锛? 鎺ㄥ epic_slug锛堜紭鍏堜粠 `_bmad-output/planning-artifacts/{branch}/epics.md` 涓?`### Epic N锛歍itle` 鐨?Title 杞?kebab-case锛涜嫢 branch-scoped 鏂囦欢缂哄け锛屾墠鍥為€€ `_bmad-output/planning-artifacts/{branch}/epics.md`锛涙垨浠?`_bmad-output/implementation-artifacts/epic-{N}-*/` 宸叉湁鐩綍鍚嶈В鏋愶級鈫?2 鍑嗗 prompt锛堝皢妯℃澘 STORY-A3-DEV 鏁存澶嶅埗骞舵浛鎹㈠崰浣嶇 epic_num銆乻tory_num銆乪pic_slug銆乻lug銆乸roject-root锛夆啋 3 鎵ц鍙戣捣鍓嶈嚜妫€娓呭崟 鈫?4 杈撳嚭鑷缁撴灉 鈫?5 鍙戣捣瀛愪换鍔°€?*绂佹**锛氫笉寰楀湪鏈畬鎴愭楠?3銆? 鐨勬儏鍐典笅鎵ц姝ラ 5锛涗笉寰楃渷鐣?epic_slug 鍗犱綅绗︼紝鍚﹀垯瀛愪唬鐞嗕細鍒涘缓鏃?slug 鐨?specs/epic-N/ 璺緞銆?
- **浠呰礋璐?*锛氬彂璧?mcp_task銆佷紶鍏?BUGFIX/TASKS 鏂囨。璺緞銆佹敹闆?subagent 杈撳嚭銆?- **绂佹**锛氫富 Agent 鐩存帴瀵圭敓浜т唬鐮佹墽琛?`search_replace` 鎴?`write`銆?- **蹇呴』**锛氶€氳繃 mcp_task 灏嗗疄鏂戒换鍔″鎵樼粰 subagent銆?
#### 3.2.1 闃舵鍒ゆ柇涓庣姝㈤噸澶?Dev Story锛堥槻姝㈠弽澶嶆墽琛岄樁娈典笁锛?
**鐜拌薄**锛欴ev Story 瀹炴柦宸茬粨鏉燂紙瀛愪唬鐞嗗凡瀹屾垚 specify鈫抪lan鈫扜APS鈫抰asks鈫掓墽琛岋級锛屼富 Agent 鍗村啀娆″彂璧烽樁娈典笁 Dev Story 瀛愪换鍔★紝鑰屼笉杩涘叆闃舵鍥涘疄鏂藉悗瀹¤銆?
**鏍瑰洜**锛氭湭鍦ㄥ彂璧烽樁娈典笁鍓嶅仛銆屽疄鏂芥槸鍚﹀凡瀹屾垚銆嶅垽鏂紱瀛愪换鍔¤繑鍥炲悗涔熸湭鏄庣‘銆屼粎鍏佽杩涘叆闃舵鍥涖€佺姝㈠啀娆″彂璧?Dev Story銆嶃€?
**寮哄埗瑙勫垯**锛?
1. **鍙戣捣闃舵涓変箣鍓?*锛氫富 Agent 蹇呴』妫€鏌ヨ Story 鐨勪骇鍑虹洰褰?`_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/` 鏄惁宸插瓨鍦?`progress.*.txt` 涓斿唴瀹瑰惈 `Completed: N`锛圢鈮?锛夊強瀵瑰簲 `prd.*.json`锛屼笖璇ョ洰褰曚笅宸叉湁 tasks 瀵瑰簲鐨勫疄鐜颁骇鐗┿€傝嫢**宸插瓨鍦?*涓婅堪鏉′欢锛岃涓?*瀹炴柦宸茬粨鏉?*锛?*绂佹**鍐嶆鍙戣捣闃舵涓?Dev Story 瀛愪换鍔★紱**蹇呴』**鐩存帴杩涘叆闃舵鍥涳紙瀹炴柦鍚庡璁★級銆?2. **瀛愪换鍔★紙STORY-A3-DEV锛夎繑鍥炴垨瓒呮椂涔嬪悗**锛氫富 Agent **浠呭厑璁?*鎵ц 3.3.1 鍏滃簳 cleanup锛岀劧鍚?*绔嬪嵆**鍙戣捣闃舵鍥涳紙STORY-A4-POSTAUDIT锛夈€?*绂佹**浠ヤ换浣曠悊鐢卞啀娆″彂璧烽樁娈典笁 Dev Story 瀛愪换鍔★紙渚嬪涓嶅緱鍥犮€岀敤鎴疯缁х画銆嶆垨銆屼笅涓€椤广€嶈€岄噸鏂板彂璧?Dev Story锛夈€?
### 3.3 鍙戣捣瀹炴柦瀛愪换鍔★紙STORY-A3-DEV 妯℃澘锛?
涓?Agent 椤诲皢浠ヤ笅妯℃澘鏁存澶嶅埗骞舵浛鎹㈠崰浣嶇鍚庝紶鍏?mcp_task锛?
```yaml
tool: mcp_task
subagent_type: generalPurpose
description: "Dev Story {epic_num}-{story_num} implementation"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典笁 Dev Story 瀹炴柦 prompt 妯℃澘锛圛D STORY-A3-DEV锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  銆愬己鍒跺墠缃鏌ャ€戞墽琛屼互涓嬮獙璇侊紝浠讳竴澶辫触鍒欐嫆缁濇墽琛屽苟杩斿洖閿欒锛?
  1. 楠岃瘉 spec-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/spec-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->
     - **鑻?spec 鐩綍涓嶅瓨鍦?*锛氶』鍏堝垱寤?specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/锛宔pic_slug 浼樺厛浠?`_bmad-output/planning-artifacts/{branch}/epics.md` 涓?`### Epic {epic_num}锛歍itle` 鐨?Title 杞?kebab-case 鎺ㄥ锛涜嫢 branch-scoped 鏂囦欢缂哄け锛屾墠鍥為€€ `_bmad-output/planning-artifacts/{branch}/epics.md`锛涚姝娇鐢?specs/epic-{epic_num}/ 鏃?slug 璺緞

  2. 楠岃瘉 plan-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/plan-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->

  3. 楠岃瘉 IMPLEMENTATION_GAPS-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/IMPLEMENTATION_GAPS-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->

  4. 楠岃瘉 tasks-E{epic_num}-S{story_num}.md 瀛樺湪涓斿凡閫氳繃瀹¤
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/tasks-E{epic_num}-S{story_num}.md
     - 蹇呴』鍖呭惈瀹¤鏍囪: <!-- AUDIT: PASSED by code-reviewer -->

  5. 楠岃瘉 ralph-method 杩借釜鏂囦欢宸插垱寤烘垨灏嗗湪鎵ц棣栨鍒涘缓
     - 妫€鏌ヨ矾寰? _bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{story_num}-*/prd.*.json 涓?progress.*.txt
     - 鑻ヤ笉瀛樺湪锛氬瓙浠ｇ悊**蹇呴』**鍦ㄥ紑濮嬫墽琛?tasks 鍓嶏紝鏍规嵁 tasks-E{epic_num}-S{story_num}.md 鐢熸垚 prd 涓?progress锛堢鍚?ralph-method schema锛夛紝鍚﹀垯涓嶅緱寮€濮嬬紪鐮併€?     - **progress 棰勫～ TDD 妲戒綅**锛氱敓鎴?progress 鏃讹紝瀵规瘡涓?US 棰勫～ [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鎴?[DONE] 鍗犱綅琛岋紙`_pending_`锛夛紝娑夊強鐢熶骇浠ｇ爜鐨?US 鍚笁鑰咃紝浠呮枃妗?閰嶇疆鐨勫惈 [DONE]銆?
  6. 楠岃瘉 `deferred-gap-register.yaml` 宸插瓨鍦ㄤ笖鍙
     - 妫€鏌ヨ矾寰? specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/deferred-gap-register.yaml 鎴栧搴?story artifact root
     - 鑻ュ瓨鍦?active deferred gap锛屽繀椤昏兘璇诲彇鍒?task_binding / implementation 鐘舵€?
  7. 楠岃瘉 Journey-first 宸ヤ欢宸插瓨鍦ㄦ垨鏈夋槑纭?fallback
     - 浼樺厛妫€鏌ョ嫭绔嬪伐浠? `journey-ledger`銆乣trace-map`銆乣closure-notes/`
     - 鑻ョ嫭绔嬪伐浠朵笉瀛樺湪锛宼asks 鏂囨。涓繀椤昏嚦灏戞湁 `P0 Journey Ledger`銆乣Journey -> Task -> Test -> Closure`銆乣Closure Notes`
     - 鑻ュ瓨鍦?active deferred gap 浣嗘棤 Smoke Task Chain銆丆losure Task ID 鎴?production path 鏄犲皠锛屽垯鎷掔粷鎵ц

  濡傛湁浠讳綍涓€椤逛笉婊¤冻锛岀珛鍗宠繑鍥為敊璇細
  "鍓嶇疆妫€鏌ュけ璐? [鍏蜂綋鍘熷洜]銆傝鍏堝畬鎴?speckit-workflow 鐨勫畬鏁存祦绋嬶紙specify鈫抪lan鈫扜APS鈫抰asks锛夈€?

  ---

  浣犳槸涓€浣嶉潪甯歌祫娣辩殑寮€鍙戜笓瀹?Amelia 寮€鍙戯紙瀵瑰簲 BMAD 寮€鍙戣亴璐ｏ級锛岃礋璐ｆ寜 Story/TASKS 鎵ц瀹炴柦銆傝鎸変互涓嬭鑼冩墽琛屻€?
  **銆怲DD 鎵ц椤哄簭锛堜笉鍙烦杩囷級銆?*
  瀵?prd 涓瘡涓?involvesProductionCode=true 鐨?US锛屽繀椤荤嫭绔嬫墽琛屼竴娆″畬鏁村惊鐜紱绂佹浠呭棣栦釜 US 鎵ц TDD 鍚庡鍚庣画 US 璺宠繃绾㈢伅鐩存帴瀹炵幇銆傛瘡涓秹鍙婄敓浜т唬鐮佺殑浠诲姟锛屽繀椤讳弗鏍兼寜浠ヤ笅椤哄簭鎵ц锛?  1. 绾㈢伅锛氬厛鍐欐垨琛ュ厖瑕嗙洊璇ヤ换鍔￠獙鏀舵爣鍑嗙殑娴嬭瘯锛岃繍琛岄獙鏀跺懡浠わ紝纭澶辫触銆?  2. 缁跨伅锛氬啀鍐欐渶灏戦噺鐨勭敓浜т唬鐮佷娇娴嬭瘯閫氳繃銆?  3. 閲嶆瀯锛氬湪娴嬭瘯淇濇姢涓嬩紭鍖栦唬鐮侊紝骞跺湪 progress 涓褰?[TDD-REFACTOR]銆?  绂佹锛氬厛鍐欑敓浜т唬鐮佸啀琛ユ祴璇曪紱绂佹鍦ㄦ湭鐪嬪埌绾㈢伅锛堟祴璇曞け璐ワ級鍓嶈繘鍏ョ豢鐏樁娈点€?
  **銆怲DD 绾㈢豢鐏樆濉炵害鏉熴€?* prd 涓瘡涓?involvesProductionCode=true 鐨?US 蹇呴』**鐙珛**鎵ц涓€娆″畬鏁?RED鈫扜REEN鈫扲EFACTOR 寰幆銆傛墽琛岄『搴忎负锛?  1. 鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹 鈫?蹇呴』寰楀埌澶辫触缁撴灉锛堢孩鐏級
  2. 绔嬪嵆鍦?progress 杩藉姞 [TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed
  3. 鍐嶅疄鐜板苟閫氳繃楠屾敹 鈫?寰楀埌閫氳繃缁撴灉锛堢豢鐏級
  4. 绔嬪嵆鍦?progress 杩藉姞 [TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed
  5. **鏃犺鏄惁鏈夐噸鏋?*锛屽湪 progress 杩藉姞 [TDD-REFACTOR] <浠诲姟ID> <鍐呭>锛堟棤鍏蜂綋閲嶆瀯鏃跺啓銆屾棤闇€閲嶆瀯 鉁撱€嶏級
  绂佹鍦ㄦ湭瀹屾垚姝ラ 1鈥? 涔嬪墠鎵ц姝ラ 3銆?*绂佹浠呭棣栦釜 US 鎵ц TDD锛屽悗缁?US 璺宠繃绾㈢伅鐩存帴瀹炵幇**锛涚姝㈡墍鏈変换鍔″畬鎴愬悗闆嗕腑琛ュ啓 TDD 璁板綍銆?
  **銆怲DD 绾㈢豢鐏褰曚笌楠屾敹銆?*
  姣忓畬鎴愪竴涓秹鍙婄敓浜т唬鐮佺殑浠诲姟鐨勭豢鐏悗锛岀珛鍗冲湪 progress 杩藉姞涓夎锛?  `[TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed`
  `[TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed`
  `[TDD-REFACTOR] <浠诲姟ID> <鍐呭> | 鏃犻渶閲嶆瀯 鉁揱
  闆嗘垚浠诲姟 REFACTOR 鍙啓銆屾棤鏂板鐢熶骇浠ｇ爜锛屽悇妯″潡鐙珛鎬у凡楠岃瘉锛屾棤璺ㄦā鍧楅噸鏋?鉁撱€嶃€?  浜や粯鍓嶈嚜妫€锛氬姣忎釜娑夊強鐢熶骇浠ｇ爜鐨勪换鍔★紝progress 椤诲惈 [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR]锛堟垨銆孴xx 鏃犻渶閲嶆瀯 鉁撱€嶏級鍚勮嚦灏戜竴琛岋紱涓?[TDD-RED] 琛岄』鍦?[TDD-GREEN] 琛屼箣鍓嶃€傜己浠讳竴椤瑰垯琛ュ厖鍚庡啀浜や粯銆傜姝㈡墍鏈?US 瀹屾垚鍚庢墠闆嗕腑琛ュ啓銆?
  璇峰 Story {epic_num}-{story_num} 鎵ц Dev Story 瀹炴柦銆?
  **鍚?stage 瀹¤閫氳繃鍚庤惤鐩樹笌缁熶竴 host 鏀跺彛绾︽潫锛堝己鍒讹級**锛?
  锛?锛夊悇 stage 瀹¤閫氳繃鏃讹紝灏嗘姤鍛婁繚瀛樿嚦 speckit-workflow 搂x.2 绾﹀畾璺緞锛泂pec/plan/GAPS/tasks 闃舵璺緞鍒嗗埆涓?specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/ 涓嬬殑 AUDIT_spec-銆丄UDIT_plan-銆丄UDIT_GAPS-銆丄UDIT_tasks-E{epic_num}-S{story_num}.md锛涚粨璁轰腑娉ㄦ槑淇濆瓨璺緞鍙?iteration_count銆?
  锛?锛塮ail 杞姤鍛婁繚瀛樿嚦 AUDIT_{stage}-E{epic}-S{story}_round{N}.md銆?*楠岃瘉杞?*锛堣繛缁?3 杞棤 gap 鐨勭‘璁よ疆锛夋姤鍛?*涓嶅垪鍏?iterationReportPaths**锛屼粎 fail 杞強鏈€缁?pass 杞弬涓庢敹闆嗐€俻ass 鏃朵富 Agent 鏀堕泦鏈?stage 鎵€鏈?fail 杞姤鍛婅矾寰勶紝浼犲叆 `--iterationReportPaths path1,path2,...`锛堥€楀彿鍒嗛殧锛夛紱**涓€娆￠€氳繃鎴栨棤 fail 杞椂涓嶄紶**銆?
  锛?锛夌粺涓€鐢?invoking host/runner 璋冪敤 `runAuditorHost` 鎵挎帴 spec/plan/GAPS/tasks 闃舵鐨勮瘎鍒嗗啓鍏ャ€乤uditIndex 鏇存柊涓?post-audit automation锛涗富 Agent 涓嶅啀鎵嬪伐缂栨帓 `bmad-speckit score`銆?*iteration_count 浼犻€掞紙寮哄埗锛?*锛氭墽琛屽璁″惊鐜殑 Agent 鍦?pass 鏃朵紶鍏ュ綋鍓嶇疮璁″€硷紙鏈?stage 瀹¤鏈€氳繃/fail 鐨勮疆鏁帮級锛?*涓€娆￠€氳繃浼?0**锛?*杩炵画 3 杞棤 gap 鐨勯獙璇佽疆涓嶈鍏?iteration_count**锛涚姝㈢渷鐣ャ€?
  锛?锛塱mplement 闃舵 artifactDocPath 鍙负 story 瀛愮洰褰曞疄鐜颁富鏂囨。璺緞鎴栫暀绌恒€?
  锛?锛夎皟鐢ㄥけ璐ユ椂璁板綍 resultCode 杩涘璁¤瘉鎹紝涓嶉樆鏂祦绋嬨€?
  **蹇呴』宓屽鎵ц speckit-workflow 瀹屾暣娴佺▼**锛歴pecify 鈫?plan 鈫?GAPS 鈫?tasks 鈫?鎵ц銆?
  **涓婁笅鏂囦笌璺緞**锛?  - Story 鏂囨。锛歿project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{story_num}-*/*.md
  - 浜у嚭璺緞锛歋tory 鏂囨。鍏?story 瀛愮洰褰?`epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-{slug}.md`
  - BUGFIX/TASKS 鏂囨。锛氾紙鐢变富 Agent 浼犲叆瀹為檯璺緞锛?  - 椤圭洰鏍圭洰褰曪細{project-root}

  **蹇呴』閬靛畧**锛歳alph-method锛堟墽琛屽墠**蹇呴』**鍦?`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/` 鍒涘缓 prd.{stem}.json 涓?progress.{stem}.txt锛坰tem 涓?tasks 鏂囨。 stem锛夛紱姣忓畬鎴愪竴涓?US 蹇呴』鏇存柊 prd锛坧asses=true锛夈€乸rogress锛堣拷鍔?story log锛夛紱鎸?US 椤哄簭鎵ц銆?*绂佹**鍦ㄦ湭鍒涘缓涓婅堪鏂囦欢鍓嶅紑濮嬬紪鐮侊級銆乀DD 绾㈢豢鐏€乻peckit-workflow銆佺姝吉瀹炵幇銆佸け璐ョ敤渚嬮』淇垨璁般€乸ytest 鍦ㄩ」鐩牴鐩綍杩愯銆?
**implement 鎵ц绾︽潫**锛氭墽琛?implement锛堟垨绛変环鎵ц tasks锛夋椂锛屽瓙 Agent 蹇呴』鍔犺浇 speckit-workflow 涓?ralph-method 鎶€鑳斤紝鎴栬嚦灏戦伒瀹?commands/speckit.implement.md 涓祵鍏ョ殑 ralph 姝ラ锛堟楠?3.5銆?銆?锛夛紱涓嶅緱浠呭嚟銆屾墽琛?tasks銆嶇殑娉涘寲鐞嗚В鑰岃烦杩?prd/progress 鍒涘缓涓?per-US 鏇存柊銆?
  璇疯鍙?ralph-method 鎶€鑳戒笌 speckit-workflow 鎶€鑳斤紝涓ユ牸鎸夌収鍏惰鍒欐墽琛屻€?
  瀛愪换鍔¤繑鍥炲悗锛屼富 Agent 蹇呴』鍙戣捣闃舵鍥涘疄鏂藉悗瀹¤锛圫TORY-A4-POSTAUDIT锛夛紝绂佹璺宠繃銆傚疄鏂藉悗瀹¤涓哄繀椤绘楠わ紝闈炲彲閫夈€?```

#### 3.3.1 瀛愪换鍔¤繑鍥炲悗鍏滃簳 cleanup锛堜富 Agent 寮哄埗姝ラ锛?
瀛愪换鍔★紙STORY-A3-DEV锛夎繑鍥炴垨瓒呮椂鍚庯紝涓?Agent **蹇呴』**鎸夐『搴忔墽琛屼笖**绂佹**璺宠繃锛?
1. **cleanup**锛氭鏌?`_bmad-output/current_pytest_session_pid.txt`锛涜嫢鏂囦欢瀛樺湪锛?*蹇呴』**鎵ц浠ヤ笅瀵瑰簲骞冲彴鐨勫懡浠ゅ苟鍒犻櫎璇ユ枃浠讹紱**绂佹**璺宠繃銆?2. **涓嬩竴姝ュ敮涓€鍏佽鍔ㄤ綔**锛?*绔嬪嵆**鍙戣捣闃舵鍥涘疄鏂藉悗瀹¤锛圫TORY-A4-POSTAUDIT锛夈€?*绂佹**鍐嶆鍙戣捣闃舵涓?Dev Story 瀛愪换鍔°€?
cleanup 鍛戒护锛堟寜骞冲彴鎷╀竴鎵ц锛夛細

- **Linux/macOS**锛歚python tools/cleanup_test_processes.py --only-from-file --session-pid $(cat _bmad-output/current_pytest_session_pid.txt)`
- **Windows (PowerShell)**锛歚python tools/cleanup_test_processes.py --only-from-file --session-pid (Get-Content _bmad-output/current_pytest_session_pid.txt)`
- **Windows (cmd)**锛歚for /f %i in (_bmad-output\current_pytest_session_pid.txt) do python tools/cleanup_test_processes.py --only-from-file --session-pid %i`

鎵ц瀹屾垚鍚庡垹闄?`_bmad-output/current_pytest_session_pid.txt`銆?
---

## 闃舵鍥涳細瀹炴柦鍚庡璁★紙澧炲己鐗堬級

鏈樁娈典负**蹇呴』**姝ラ锛岄潪鍙€夈€備富 Agent 鍦ㄥ瓙浠诲姟杩斿洖鍚庡繀椤诲彂璧凤紝涓嶅緱璺宠繃銆?*涓ユ牸搴︼細strict**锛岄』閬靛惊 [audit-post-impl-rules.md](../speckit-workflow/references/audit-post-impl-rules.md)锛堣矾寰勶細`.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`锛夈€?
### 鏀舵暃鏉′欢锛坰trict锛屽繀椤伙級

- **杩炵画 3 杞棤 gap**锛氳繛缁?3 娆″璁＄粨璁哄潎涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紝涓旇 3 娆℃姤鍛婁腑鎵瑰垽瀹¤鍛樼粨璁烘鍧囨敞鏄庛€屾湰杞棤鏂?gap銆嶃€備换涓€杞负銆屽瓨鍦?gap銆嶅垯浠庝笅涓€杞噸鏂拌鏁般€?- **鎵瑰垽瀹¤鍛?>50%**锛氭姤鍛婇』鍖呭惈銆?# 鎵瑰垽瀹¤鍛樼粨璁恒€嶆钀斤紝璇ユ钀藉瓧鏁版垨鏉＄洰鏁颁笉灏戜簬鎶ュ憡鍏朵綑閮ㄥ垎锛涘繀濉粨鏋勮 [audit-prompts-critical-auditor-appendix.md](../speckit-workflow/references/audit-prompts-critical-auditor-appendix.md)銆?- 涓?Agent 鍦ㄥ彂璧风 2銆? 杞璁″墠锛屽彲杈撳嚭銆岀 N 杞璁￠€氳繃锛岀户缁獙璇佲€︺€嶄互鎻愮ず鐢ㄦ埛銆?
### 鍓嶇疆妫€鏌?
鍦ㄨ繘琛屽疄鏂藉悗瀹¤鍓嶏紝蹇呴』纭锛?- [ ] speckit specify闃舵code-review瀹¤宸查€氳繃锛埪?锛?- [ ] speckit plan闃舵code-review瀹¤宸查€氳繃锛埪?锛?- [ ] speckit GAPS闃舵code-review瀹¤宸查€氳繃锛埪?锛?- [ ] speckit tasks闃舵code-review瀹¤宸查€氳繃锛埪?锛?- [ ] speckit鎵ц闃舵code-review瀹¤宸查€氳繃锛埪?锛?- [ ] TDD璁板綍瀹屾暣锛堝寘鍚玆ED/GREEN/REFACTOR涓変釜闃舵锛?- [ ] ralph-method杩涘害鏂囦欢宸叉洿鏂?
濡傛湁浠讳綍涓€椤规湭閫氳繃锛屽繀椤诲厛瀹屾垚璇ラ」瀹¤銆?
### 缁煎悎瀹¤

浣跨敤 `audit-prompts.md 搂5` 杩涜缁煎悎楠岃瘉銆?*鎶ュ憡鍙В鏋愬潡椤荤鍚?搂5.1**锛堝洓缁达細鍔熻兘鎬с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級锛屼笌 _bmad/_config/code-reviewer-config.yaml modes.code.dimensions 涓€鑷达紝鍚﹀垯 code 妯″紡璇勫垎瑙ｆ瀽鍣ㄦ棤娉曡В鏋愩€佷华琛ㄧ洏鍥涚淮鏄剧ず銆屾棤鏁版嵁銆嶃€?
**銆惵? 鍙В鏋愬潡瑕佹眰锛坕mplement 涓撶敤锛夈€?* 鎶ュ憡缁撳熬鐨勫彲瑙ｆ瀽璇勫垎鍧?*蹇呴』**浣跨敤 modes.code 鍥涚淮锛歚- 鍔熻兘鎬? XX/100`銆乣- 浠ｇ爜璐ㄩ噺: XX/100`銆乣- 娴嬭瘯瑕嗙洊: XX/100`銆乣- 瀹夊叏鎬? XX/100`銆?*绂佹**浣跨敤 闇€姹傚畬鏁存€с€佸彲娴嬭瘯鎬с€佷竴鑷存€с€佸彲杩芥函鎬э紙璇ュ洓缁翠粎閫傜敤浜?tasks/story 闃舵锛夈€傛€讳綋璇勭骇绂佹 B+銆丄-銆丆+銆丏- 绛変慨楗扮锛屼粎闄愮函 A/B/C/D銆傚惁鍒?code 妯″紡璇勫垎瑙ｆ瀽鍣ㄦ棤娉曡В鏋愶紝浠〃鐩樺洓缁存樉绀恒€屾棤鏁版嵁銆嶃€?
**瀹¤缁村害**锛?1. 闇€姹傝鐩栧害锛氭槸鍚﹀疄鐜颁簡Story鏂囨。涓殑鎵€鏈夐渶姹?2. 娴嬭瘯瀹屾暣鎬э細鍗曞厓娴嬭瘯銆侀泦鎴愭祴璇曟槸鍚﹀厖鍒?3. 浠ｇ爜璐ㄩ噺锛氭槸鍚︾鍚堥」鐩紪鐮佽鑼?3.1. lint锛氶」鐩』鎸夋妧鏈爤閰嶇疆骞舵墽琛?Lint锛堣 lint-requirement-matrix锛夛紱鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint 椤讳綔涓烘湭閫氳繃椤癸紱宸查厤缃殑椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶈眮鍏嶃€?4. 鏂囨。涓€鑷存€э細Story鏂囨。銆乻pec銆乸lan銆佷唬鐮佹槸鍚︿竴鑷?5. 鍙拷婧€э細PRD闇€姹傗啋Story鈫抯pec鈫抰ask鈫掍唬鐮佺殑閾捐矾鏄惁瀹屾暣

**寮哄埗瀹¤椤癸紙涓?bmad-bug-assistant BUG-A4-POSTAUDIT 涓€鑷达級**锛?- **TDD 椤哄簭楠岃瘉**锛氬姣忎釜浠诲姟鐨?progress 璁板綍锛孾TDD-RED] 椤诲湪 [TDD-GREEN] 涔嬪墠鍑虹幇锛涜嫢 [TDD-GREEN] 鍦?[TDD-RED] 涔嬪墠鎴栫己灏?[TDD-RED]锛屽垽涓恒€屼簨鍚庤ˉ鍐欍€嶏紝缁撹鏈€氳繃銆?- **鍥炲綊鍒ゅ畾寮哄埗瑙勫垯**锛氫换浣曞湪鏈?Story 瀹炴柦鍓嶅凡瀛樺湪鐨勬祴璇曠敤渚嬶紝鑻ュ疄鏂藉悗澶辫触锛屼竴寰嬭涓哄洖褰掞紝椤讳慨澶嶆垨缁忕敤鎴锋壒鍑嗗悗鍒楀叆姝ｅ紡鎺掗櫎娓呭崟銆傜姝互銆屼笌 Story X 鐩稿叧銆嶃€屼笌鏈?Story 鏃犲叧銆嶃€屾潵鑷墠缃?Story銆嶇瓑鐞嗙敱鎺掗櫎銆傚己鍒舵楠わ細鎵ц鍏ㄩ噺鍥炲綊銆侀€愭潯鍒ゅ畾鏄惁鍥炲綊锛涜嫢鍑虹幇銆屼笌鏈?Story 鏃犲叧銆嶆帓闄や笖鏃犳寮忔帓闄よ褰曪紝缁撹涓烘湭閫氳繃銆?
**瀹¤鏂瑰紡**锛?- 浼樺厛锛欳ursor Task璋冨害code-reviewer
- 鍥為€€锛歮cp_task generalPurpose + audit-prompts.md 搂5鍐呭

### 瀹¤缁撹澶勭悊

**閫氳繃锛圓/B绾э級**锛?- Story鏍囪涓哄畬鎴?- #### 姝ラ 4.3锛歋tory 瀹屾垚鑷锛堝己鍒讹紝鍏堟墽琛岋級
  - 鍦?*鎻愪緵瀹屾垚閫夐」涔嬪墠**锛屼富 Agent **蹇呴』鍏?*纭缁熶竴 auditor host runner 宸插畬鎴?implement 闃舵 post-audit automation銆?  - 鑻?host 宸插畬鎴愶紝鍒欐棤闇€鎵ц 姝ラ 4.2銆?  - 鑻?host 鏈畬鎴愪笖 `AUDIT_Story_{epic}-{story}_stage4.md` 瀛樺湪锛屽垯涓?Agent 鎵ц 姝ラ 4.2 琛ヨ窇銆?  - 鑻ユ姤鍛婂彲瑙ｆ瀽鍧楃淮搴﹂敊璇紝鍒欏厛淇鎶ュ憡锛屽啀閫氳繃 `runAuditorHost` 閲嶆柊鏀跺彛銆?  - 琛ヨ窇澶辫触 non_blocking锛屼富娴佺▼缁х画銆?- #### 姝ラ 4.2锛氳ˉ璺?runAuditorHost锛堟楠?4.3 鍒ゅ畾 host 鏈畬鎴愭椂鎵ц锛?  - 褰?姝ラ 4.3 鍒ゅ畾 host 鏈畬鎴愪笖鎶ュ憡瀛樺湪鏃讹紝涓?Agent 鎵ц锛歚npx ts-node scripts/run-auditor-host.ts --projectRoot <projectRoot> --stage implement --artifactPath <story 鏂囨。璺緞> --reportPath <鎶ュ憡璺緞> --iterationCount {鏈?stage 绱 fail 杞暟锛? 琛ㄧず涓€娆￠€氳繃}`
  - 鑻ヨ皟鐢ㄥけ璐ワ紝璁板綍 resultCode锛屼笉闃绘柇娴佺▼锛坣on_blocking锛夈€?- #### 瀹¤閫氳繃鍚庣粺涓€ Host 鏀跺彛锛堝己鍒讹級
  - 瀛愪唬鐞嗗湪銆愬璁￠€氳繃鍚庡繀鍋氥€戜腑杩斿洖 host 鎵€闇€瀛楁锛涗富 Agent 閫氳繃 姝ラ 4.3/4.2 鍋氬畬鎴愭€佹鏌ヤ笌琛ヨ窇锛?*蹇呴』鍚?`--iteration-count {绱鍊紏`**锛泂tage=implement锛涘け璐?non_blocking銆?- 鎻愪緵瀹屾垚閫夐」锛堣涓嬫枃锛?
**鏈夋潯浠堕€氳繃锛圕绾э級**锛?- 鍒楀嚭蹇呴』淇鐨勯棶棰?- 淇鍚庨噸鏂板璁?
**涓嶉€氳繃锛圖绾э級**锛?- 鍒楀嚭閲嶅ぇ闂
- 鍙兘闇€瑕佸洖閫€鍒癓ayer 3閲嶆柊Create Story
- 鎴栧洖閫€鍒皊peckit鐗瑰畾闃舵閲嶆柊鎵ц

### 瀹屾垚鍚庨€夐」

褰揝tory瀹¤閫氳繃鍚庯紝鎻愪緵浠ヤ笅閫夐」锛堣缁嗗疄鐜拌 **Phase 5: 鏀跺熬涓庨泦鎴愶紙澧炲己鐗堬級**锛夛細

**[0] 鎻愪氦浠ｇ爜**
- 璇㈤棶鏄惁灏嗗綋鍓嶆敼鍔ㄦ彁浜ゅ埌鏈湴浠撳簱
- 鑻ラ€夋嫨鏄紝鑷姩璋冪敤 auto-commit-utf8 鎶€鑳界敓鎴愪腑鏂?commit message 骞舵彁浜?
**[1] 寮€濮嬩笅涓€涓猄tory**
- 鍦ㄥ悓涓€Epic worktree鍐呭垏鎹㈠埌涓嬩竴涓猄tory鍒嗘敮
- 鑷姩妫€娴嬪苟澶勭悊璺⊿tory渚濊禆

**[2] 鍒涘缓PR骞剁瓑寰卹eview**
- 鎺ㄩ€佸綋鍓峉tory鍒嗘敮鍒拌繙绋?- 鍒涘缓PR锛堣皟鐢╬r-template-generator鐢熸垚鎻忚堪锛?- 杩涘叆寮哄埗浜哄伐瀹℃牳娴佺▼

**[3] 鎵归噺Push鎵€鏈塖tory鍒嗘敮**
- 鎺ㄩ€丒pic涓嬫墍鏈夊凡瀹屾垚鐨凷tory鍒嗘敮
- 涓烘瘡涓猄tory鍒涘缓PR
- 杩涘叆鎵归噺浜哄伐瀹℃牳娴佺▼

**[4] 淇濈暀鍒嗘敮绋嶅悗澶勭悊**
- 淇濇寔褰撳墠鍒嗘敮鐘舵€?- 鍏佽绋嶅悗缁х画

### Epic瀹屾垚妫€鏌?
褰揈pic涓嬫墍鏈塖tory閮藉畬鎴愬悗锛?1. 楠岃瘉鎵€鏈塖tory鐨凱R閮藉凡merge鍒癴eature-epic-{num}鍒嗘敮
2. 鎵цEpic绾ч泦鎴愭祴璇?3. 鍒涘缓Epic绾у埆鐨凱R锛堝悎骞跺埌main锛?4. 鍐嶆杩涘叆寮哄埗浜哄伐瀹℃牳
5. 娓呯悊Epic worktree锛堝彲閫夛級锛涳紙**GAP-045 淇**锛氭竻鐞嗘潯浠讹細Epic PR 宸?merge 涓旀棤鏈喅闂锛涗繚鐣欐椂闀匡細寤鸿 7 澶╋紱鎭㈠锛氫粠 main 閲嶆柊 checkout feature-epic-{num} 鍒嗘敮锛夛紱锛?*GAP-086 淇**锛氱敱鐢ㄦ埛閫夋嫨鏄惁娓呯悊锛涙垨绯荤粺寤鸿鍚庣敤鎴风‘璁わ級

### Phase 5: 鏀跺熬涓庨泦鎴愶紙澧炲己鐗堬級

**GAP-074 鍓嶇疆鏉′欢**锛氭墽琛岄€夐」 [2] 鎴?[3] 鍓嶏紝椤荤‘璁?pr-template-generator 宸插畨瑁呮垨宸插湪鍓嶇疆鎺㈡祴涓‘璁ゃ€傝嫢涓嶅瓨鍦紝杈撳嚭瀹夎鎸囧紩锛堝 `cursor skills install pr-template-generator` 鎴栧弬鑰?Cursor skills 鏂囨。锛夊苟璺宠繃 PR 鎻忚堪鐢熸垚锛涘彲浣跨敤鍗犱綅妯℃澘鏇夸唬銆?
褰撴墍鏈塖tory瀹屾垚鍚庯紝鎻愪緵浠ヤ笅閫夐」锛?
#### 閫夐」 [0] 鎻愪氦浠ｇ爜
- 璇㈤棶鏄惁灏嗗綋鍓嶆敼鍔ㄦ彁浜ゅ埌鏈湴浠撳簱
- 鑻ラ€夋嫨鏄紝鑷姩璋冪敤 auto-commit-utf8 鎶€鑳界敓鎴愪腑鏂?commit message 骞舵彁浜?
#### 閫夐」 [1] 缁х画涓嬩竴涓猄tory
- 鍦ㄥ悓涓€Epic worktree鍐呭垏鎹㈠埌涓嬩竴涓猄tory鍒嗘敮
- 鑷姩妫€娴嬪苟澶勭悊璺⊿tory渚濊禆
- 濡傛灉鍓嶇疆Story鏈畬鎴愶紝鎻愮ず绛夊緟

#### 閫夐」 [2] 鍒涘缓PR骞剁瓑寰卹eview
- 鎺ㄩ€佸綋鍓峉tory鍒嗘敮鍒拌繙绋?- **鑷姩璋冪敤pr-template-generator鐢熸垚PR鎻忚堪**锛堝墠缃潯浠惰涓婃柟 GAP-074锛?- 鍒涘缓PR骞惰繘鍏ュ己鍒朵汉宸ュ鏍告祦绋?
**pr-template-generator璋冪敤**锛?```bash
# 鍒嗘瀽褰撳墠鍒嗘敮鐨刢ommits
analyze_commits(story_branch)

# 鐢熸垚PR妯℃澘
pr_template = generate_pr_template(
    story_id="4.1",
    story_title="metrics cache fix",
    commits=commit_history,
    files_changed=changed_files,
    tests_added=test_files
)

# PR妯℃澘鍐呭鍖呮嫭锛?# - Story鑳屾櫙鍜岀洰鐨?# - 涓昏鏀瑰姩鐐癸紙鍩轰簬commit message锛?# - 娴嬭瘯瑕嗙洊鎯呭喌
# - 褰卞搷鑼冨洿
# - 鍥炴粴鏂规
```

#### 閫夐」 [3] 鎵归噺Push鎵€鏈塖tory鍒嗘敮
- 鎺ㄩ€丒pic涓嬫墍鏈夊凡瀹屾垚鐨凷tory鍒嗘敮鍒拌繙绋?- **涓烘瘡涓猄tory鑷姩鍒涘缓PR锛堜娇鐢╬r-template-generator锛屽墠缃潯浠惰 GAP-074锛?*
- 杩涘叆鎵归噺浜哄伐瀹℃牳娴佺▼

**鎵归噺澶勭悊娴佺▼**锛?```
For each completed_story in epic.stories:
    1. Push story_branch to origin
    2. Generate PR template using pr-template-generator
    3. Create PR with generated template
    4. Add to batch_review_queue

Display batch review summary:
- Total PRs created: N
- Epic: feature-epic-4
- Ready for review
```

**鎵归噺Push瀹炵幇缁嗚妭**锛?
**鍓嶇疆鏉′欢妫€鏌?*锛?```python
def batch_push_precheck(epic_id):
    # 1. 妫€鏌ユ墍鏈塖tory鏄惁宸插畬鎴?    incomplete_stories = get_incomplete_stories(epic_id)
    if incomplete_stories:
        warn(f"浠ヤ笅Story鏈畬鎴? {incomplete_stories}")
        if not user_confirm("鏄惁鍙帹閫佸凡瀹屾垚鐨凷tory锛?):
            return False

    # 2. 妫€鏌ヨ繙绋嬩粨搴撹繛鎺?    if not test_remote_connection():
        error("鏃犳硶杩炴帴鍒拌繙绋嬩粨搴?)
        return False

    # 3. 妫€鏌ユ潈闄?    if not has_push_permission():
        error("娌℃湁鎺ㄩ€佹潈闄?)
        return False

    return True
```

**鎵归噺鎺ㄩ€佹祦绋?*锛?```python
def batch_push_stories(epic_id):
    results = []

    for story in get_completed_stories(epic_id):
        try:
            # 1. 鍒囨崲鍒癝tory鍒嗘敮
            checkout_branch(f"story-{epic_id}-{story.num}")

            # 2. 鎷夊彇鏈€鏂颁唬鐮侊紙閬垮厤鍐茬獊锛?            pull_latest()  # GAP-082 淇锛歱ull 澶辫触锛堝鍐茬獊锛夋椂榛樿 skip 璇?Story 缁х画涓嬩竴 Story 骞惰褰曪紱鍙€夈€屾彁绀虹敤鎴疯В鍐炽€嶆ā寮?
            # 3. 鎺ㄩ€佸埌杩滅▼
            push_to_remote(f"story-{epic_id}-{story.num}")

            # 4. 鐢熸垚PR妯℃澘
            pr_template = generate_pr_template(story)

            # 5. 鍒涘缓PR
            pr_url = create_pull_request(
                title=f"Story {epic_id}.{story.num}: {story.title}",
                body=pr_template,
                head=f"story-{epic_id}-{story.num}",
                base=f"feature-epic-{epic_id}"
            )

            results.append({
                "story": story.num,
                "status": "success",
                "pr_url": pr_url
            })

        except Exception as e:
            results.append({
                "story": story.num,
                "status": "failed",
                "error": str(e)
            })

    return results
```

**閿欒澶勭悊**锛?- 鍗曚釜Story鎺ㄩ€佸け璐ヤ笉褰卞搷鍏朵粬Story
- 璁板綍澶辫触鐨凷tory鍜屽師鍥?- 鎻愪緵閲嶈瘯鏈哄埗

**杩涘害鏄剧ず**锛?```
鎵归噺鎺ㄩ€佷腑...
[1/7] Story 4.1: 鎺ㄩ€佷腑... 鉁?瀹屾垚锛孭R #123
[2/7] Story 4.2: 鎺ㄩ€佷腑... 鉁?瀹屾垚锛孭R #124
[3/7] Story 4.3: 鎺ㄩ€佷腑... 鉂?澶辫触锛堢綉缁滈敊璇級
[4/7] Story 4.4: 鎺ㄩ€佷腑... 鉁?瀹屾垚锛孭R #125
...

鎺ㄩ€佸畬鎴愶細6/7 鎴愬姛
澶辫触锛歋tory 4.3
鏄惁閲嶈瘯澶辫触鐨凷tory锛焄Y/n]
```

#### 閫夐」 [4] 淇濈暀鍒嗘敮绋嶅悗澶勭悊
- 淇濇寔褰撳墠鍒嗘敮鐘舵€?- 鍏佽绋嶅悗缁х画
- 璁板綍褰撳墠杩涘害鍒板厓鏁版嵁

#### 寮哄埗浜哄伐瀹℃牳娴佺▼

鏃犺閫夋嫨鍝釜閫夐」锛孭R Merge鐜妭**缁濆涓嶈兘鑷姩merge**锛?
**鍗昉R瀹℃牳鐣岄潰**锛?```
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                   馃敀 PR瀹℃牳璇锋眰                            鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: feature-epic-4 (鐢ㄦ埛绠＄悊绯荤粺閲嶆瀯)                    鈺?鈺? PR: #123 Story 4.1: metrics cache fix                     鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 馃搳 CI鐘舵€?        鉁?鍏ㄩ儴閫氳繃                              鈺?鈺? 馃搱 瑕嗙洊鐜囧彉鍖?    +2.3%                                   鈺?鈺? 馃攳 浠ｇ爜瀹℃煡:      鉁?宸查€氳繃 code-reviewer锛?*GAP-059 淇**锛氳皟鐢ㄦ椂浼犲叆 mode=pr锛屼粠 code-reviewer-config 璇诲彇 pr 妯″紡鎻愮ず璇嶏級                 鈺?鈺? 馃搧 褰卞搷鏂囦欢:      12涓?                                   鈺?鈺? 馃摑 PR鎻忚堪:        [鐢眕r-template-generator鐢熸垚]           鈺?鈺?                                                           鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯骞禡erge                                        鈺?鈺? [2] 鉂?鎷掔粷锛岃繑鍥炰慨鏀?                                     鈺?鈺? [3] 馃憖 鏌ョ湅璇︾粏diff                                       鈺?鈺? [4] 鈴笍  璺宠繃姝R                                          鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
```

**鎵归噺瀹℃牳鐣岄潰**锛?```
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                馃敀 鎵归噺PR瀹℃牳璇锋眰                           鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: feature-epic-4                                       鈺?鈺? 寰呭鏍窹R: 3涓?                                             鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? [#123] Story 4.1 - 鉁?CI閫氳繃 - 鉁?瀹¤A绾?                 鈺?鈺? [#124] Story 4.2 - 鉁?CI閫氳繃 - 鉁?瀹¤B绾?                 鈺?鈺? [#125] Story 4.3 - 鉁?CI閫氳繃 - 鈿狅笍  瀹¤C绾э紙闇€鍏虫敞锛?      鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯鍏ㄩ儴骞堕€愪釜Merge                                鈺?鈺? [2] 鉁?鎵瑰噯閮ㄥ垎锛堥€夋嫨锛?                                  鈺?鈺? [3] 鉂?鎷掔粷鍏ㄩ儴锛岃繑鍥炰慨鏀?                                鈺?鈺? [4] 馃憖 閫愪釜鏌ョ湅璇︽儏                                       鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
```

**閲嶈绾︽潫**锛?- 蹇呴』绛夊緟鐢ㄦ埛鏄庣‘閫夋嫨[1]骞剁‘璁ゅ悗鎵嶈兘merge
- 涓ョ鑷姩merge
- 瀹℃牳涓嶉€氳繃鐨凱R涓嶈兘merge

#### 寮哄埗浜哄伐瀹℃牳鐣岄潰瀹炵幇

**鏍稿績鍘熷垯**锛氱粷瀵逛笉鑳借嚜鍔╩erge锛屽繀椤诲仠姝㈢瓑寰呬汉宸ョ‘璁ゃ€?
**鍗昉R瀹℃牳鐣岄潰**锛?```python
def show_pr_review_interface(pr_info):
    # 鑾峰彇PR璇︾粏淇℃伅
    ci_status = get_ci_status(pr_info.id)
    coverage_change = get_coverage_change(pr_info.id)
    code_review_result = get_code_review_result(pr_info.id)
    affected_files = get_affected_files(pr_info.id)

    # 鏄剧ず瀹℃牳鐣岄潰
    display(f"""
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                   馃敀 PR瀹℃牳璇锋眰                            鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: {pr_info.epic_name}                                  鈺?鈺? PR: #{pr_info.id} {pr_info.title}                         鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 馃搳 CI鐘舵€?        {ci_status.emoji} {ci_status.text}       鈺?鈺? 馃搱 瑕嗙洊鐜囧彉鍖?    {coverage_change}                        鈺?鈺? 馃攳 浠ｇ爜瀹℃煡:      {code_review_result.emoji} {code_review_result.grade}绾?鈺?鈺? 馃搧 褰卞搷鏂囦欢:      {len(affected_files)}涓?                 鈺?鈺? 馃摑 PR鎻忚堪:        [鐢眕r-template-generator鐢熸垚]           鈺?鈺?                                                           鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯骞禡erge                                        鈺?鈺? [2] 鉂?鎷掔粷锛岃繑鍥炰慨鏀?                                     鈺?鈺? [3] 馃憖 鏌ョ湅璇︾粏diff                                       鈺?鈺? [4] 鈴笍  璺宠繃姝R                                          鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
    """)

    # 绛夊緟鐢ㄦ埛杈撳叆锛堣疆璇㈡ā寮忥紝24h瓒呮椂锛?    # GAP-010 淇锛欳ursor/Claude 鏃犵幇鎴?wait_for_user_input_with_polling API锛岄渶鑷瀹炵幇
    # 瀹炵幇寤鸿锛氳緭鍑?prompt 鍚庣粨鏉熸湰杞紱鐢ㄦ埛鍦ㄤ笅鏉℃秷鎭洖澶?1/2/3/4
    # 瓒呮椂/鎻愰啋锛氫粎鍦ㄤ細璇濅腑鎵撳嵃鎻愮ず淇℃伅锛屾殏涓嶉泦鎴愰偖浠?Slack 绛夊鎺?    choice = wait_for_user_input_with_polling(
        timeout_hours=24,
        poll_interval_minutes=30,
        on_timeout=lambda: print(f"[瓒呮椂鎻愰啋] PR #{pr_info.id} 寰呭鏍稿凡瓒呰繃24灏忔椂銆傝灏藉揩瀹屾垚瀹℃牳锛屾垨閫夋嫨璺宠繃/鎷掔粷銆?)
    )

    if choice == "1":
        confirm = ask("纭畾瑕佹壒鍑嗗苟Merge姝R锛?[yes/no]: ")
        if confirm.lower() == "yes":
            merge_pull_request(pr_info.id)
            return "merged"
        else:
            return "cancelled"
    elif choice == "2":
        reason = ask("鎷掔粷鍘熷洜: ")
        reject_pull_request(pr_info.id, reason)
        return "rejected"
    elif choice == "3":
        show_diff(pr_info.id)
        return show_pr_review_interface(pr_info)  # 閫掑綊鏄剧ず
    elif choice == "4":
        return "skipped"
```

**鎵归噺瀹℃牳鐣岄潰**锛?```python
def show_batch_review_interface(epic_id, pr_list):
    pr_statuses = [get_pr_status(pr) for pr in pr_list]

    display(f"""
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?                馃敀 鎵归噺PR瀹℃牳璇锋眰                           鈺?鈺犫晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暎
鈺? Epic: {epic_id}                                            鈺?鈺? 寰呭鏍窹R: {len(pr_list)}涓?                                鈺?鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?""")

    for i, (pr, status) in enumerate(zip(pr_list, pr_statuses), 1):
        display(f"鈺? [#{pr.id}] Story {pr.story_id} - {status.ci_emoji} CI{status.ci_status} - {status.review_emoji} 瀹¤{status.grade}绾?)

    display("""
鈺熲攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈺?鈺? 鉂?璇烽€夋嫨鎿嶄綔锛?                                           鈺?鈺? [1] 鉁?鎵瑰噯鍏ㄩ儴骞堕€愪釜Merge                                鈺?鈺? [2] 鉁?鎵瑰噯閮ㄥ垎锛堥€夋嫨锛?                                  鈺?鈺? [3] 鉂?鎷掔粷鍏ㄩ儴锛岃繑鍥炰慨鏀?                                鈺?鈺? [4] 馃憖 閫愪釜鏌ョ湅璇︽儏                                       鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
    """)

    choice = wait_for_user_input_with_polling(timeout_hours=24, poll_interval_minutes=30)

    if choice == "1":
        confirm = ask(f"纭畾瑕佹壒鍑嗗叏閮▄len(pr_list)}涓狿R骞堕€愪釜Merge锛?[yes/no]: ")
        if confirm.lower() == "yes":
            for pr in pr_list:
                merge_pull_request(pr.id)
            return "all_merged"
    elif choice == "2":
        # GAP-046/GAP-088 淇锛歴elect_prs_to_merge UI 浜や簰
        selected = select_prs_to_merge(pr_list)
        for pr in selected:
            merge_pull_request(pr.id)
        return f"{len(selected)}_merged"
    # ... 鍏朵粬閫夐」
```

**select_prs_to_merge UI 浜や簰锛圙AP-046/GAP-088锛?*锛?```python
def select_prs_to_merge(pr_list):
    """鎵瑰噯閮ㄥ垎PR鏃剁殑閫夋嫨閫昏緫"""
    display(pr_list with indices 1..n)
    raw = input("杈撳叆搴忓彿锛岄€楀彿鎴栬寖鍥达紝濡?1,3,5 鎴?1-3: ")
    indices = parse_indices(raw, max_n=len(pr_list))
    # 绌鸿緭鍏モ啋[]锛涢潪娉曟牸寮忊啋鎻愮ず閲嶈緭锛涜秺鐣屸啋蹇界暐
    return [pr_list[i-1] for i in indices if 1 <= i <= len(pr_list)]
```

**瀹℃牳鎻愰啋鏈哄埗**锛堜粎鍦ㄤ細璇濅腑鎵撳嵃锛屾殏涓嶉泦鎴愰偖浠?Slack锛夛細
```python
# GAP-056 淇锛氬凡鐭ラ檺鍒垛€斺€旂敤鎴峰叧闂細璇濆悗 reopen 鏃舵彁閱掓棤娉曢€佽揪锛涘彲琛ュ厖銆屼細璇濇仮澶嶆椂妫€鏌ュ緟瀹℃牳 PR 骞舵彁绀恒€?if time_since_last_activity() > timedelta(hours=24):
    print(f"[鎻愰啋] Epic {epic_id} 鏈夊緟瀹℃牳PR锛屽叡 {pending_pr_count} 涓凡瓒呰繃24灏忔椂锛岃灏藉揩澶勭悊銆?)
```

**瀹℃牳SLA绾﹀畾**锛堝缓璁級锛?- P0 PR锛?灏忔椂鍐呭搷搴?- P1 PR锛?4灏忔椂鍐呭搷搴?- P2 PR锛?2灏忔椂鍐呭搷搴?
**Runtime Governance (S11 - post-audit):** 涓?Agent 鍦ㄨ皟鐢?post-audit 瀛愪换鍔′箣鍓嶆墽琛岋細
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit`
瀛愪换鍔¤繑鍥炰箣鍚庢墽琛岋細
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit --persist`
`{story_key}` 涓哄綋鍓?Story 鐨?kebab-case key銆?
post-audit 鍓嶈繕蹇呴』杩藉姞浠ヤ笅妫€鏌ワ細

1. `deferred-gap-register.yaml` 宸插悓姝?closure / carry-forward evidence
2. `journey-ledger`銆乣trace-map`銆乣closure-notes` 涓?tasks 褰撳墠鐘舵€佷竴鑷?3. 鑻ュ瓨鍦?`module complete but journey not runnable`銆佺己 `Production Path`銆佺己 `Smoke Proof`銆佺己 `Closure Note`銆佺己 `Acceptance Evidence`锛屽垯涓嶅緱杩涘叆閫氳繃缁撹

### 4.1 瀹¤瀛愪唬鐞嗕笌鎻愮ず璇?
涓庨樁娈典簩鐩稿悓锛?*浼樺厛** Cursor Task 璋冨害 code-reviewer锛?*鍥為€€** mcp_task generalPurpose銆備富 Agent 椤诲皢 **STORY-A4-POSTAUDIT** 瀹屾暣 prompt 妯℃澘鏁存澶嶅埗骞舵浛鎹㈠崰浣嶇鍚庝紶鍏ャ€?*浼犲叆瀹¤瀛愪换鍔＄殑 prompt 蹇呴』鍖呭惈銆惵? 鍙В鏋愬潡瑕佹眰锛坕mplement 涓撶敤锛夈€?*锛堣涓婅妭缁煎悎瀹¤锛夛紝骞堕檮 audit-prompts 搂5.1 鎴?audit-prompts-code.md 鍙В鏋愬潡绀轰緥锛堝姛鑳芥€с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級銆?*銆愬璁￠€氳繃鍚庡繀鍋氥€?*锛氬綋缁撹涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆椂锛屼綘锛堝璁″瓙浠ｇ悊锛?*鍦ㄨ繑鍥炰富 Agent 鍓嶅繀椤?*杩斿洖 `projectRoot`銆乣reportPath`銆乣artifactDocPath=<story 鏂囨。璺緞>`銆乣stage=implement`锛屼氦鐢?invoking host/runner 缁熶竴璋冪敤 `runAuditorHost`锛涙姤鍛婅矾寰勪负 `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`锛涜嫢 host/runner 鎵ц澶辫触锛屽湪缁撹涓敞鏄?resultCode锛?*绂佹**鍦ㄦ湭瀹屾垚涓婅堪 host 鏀跺彛鍓嶈繑鍥為€氳繃缁撹銆傝缁嗘ā鏉胯鏈?skill 鍘嗗彶鐗堟湰鎴?speckit-workflow references銆?
鑻ュ璁＄粨璁轰负**鏈€氳繃**锛?*蹇呴』**鎸夊璁℃姤鍛婁慨鏀瑰悗**鍐嶆鍙戣捣**锛岀洿鑷炽€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶃€?
---

## 闃舵浜旓細Skill 鑷璁★紙鎶€鑳藉垱寤烘椂锛?
褰撴湰 skill 琚?*鏂板缓鎴栭噸澶т慨鏀?*鍚庯紝搴斿 skill 鏂囦欢鍙戣捣瀹¤瀛愪换鍔°€傞伒寰?搂2.1 / 搂4.1 浼樺厛椤哄簭锛堝厛 code-reviewer锛屽け璐ュ垯 generalPurpose锛夈€?
```yaml
# 鍥為€€鏂规绀轰緥
tool: mcp_task
subagent_type: generalPurpose
description: "Audit bmad-story-assistant skill"
prompt: |
  浣犳槸涓€浣嶉潪甯镐弗鑻涚殑浠ｇ爜瀹¤鍛樸€傝瀵广€宐mad-story-assistant SKILL.md銆嶈繘琛屽璁°€?
  瀹¤鍐呭锛?  1. 鏄惁瀹屾暣瑕嗙洊鐢ㄦ埛瑕佹眰鐨?Create Story銆佸璁°€丏ev Story銆佸疄鏂藉悗瀹¤銆丼kill 鑷璁?鍏ㄦ祦绋嬨€?  2. Epic/Story 缂栧彿浣滀负杈撳叆鐨勮鏄庢槸鍚︽竻鏅帮紝鍗犱綅绗?{epic_num}銆亄story_num}銆亄project-root} 鏄惁涓€鑷淬€?  3. 寮曠敤鐨勫懡浠ゃ€佹妧鑳芥槸鍚﹀噯纭細/bmad-bmm-create-story銆?bmad-bmm-dev-story銆乵cp_task銆乺alph-method銆乻peckit-workflow銆乤udit-prompts.md 搂5銆?  4. 涓?Agent 绂佹鐩存帴淇敼鐢熶骇浠ｇ爜銆佸繀椤婚€氳繃 mcp_task 濮旀墭绛夌害鏉熸槸鍚︽槑纭€?  5. 涓枃琛ㄨ堪鏄惁娓呮櫚鏃犳涔夈€?  6. 瀹¤姝ラ鏄惁鏄庣‘锛歮cp_task 涓嶆敮鎸?code-reviewer锛涗紭鍏?Cursor Task 璋冨害 code-reviewer銆佸け璐ュ垯鍥為€€ mcp_task generalPurpose锛涙槸鍚﹂伩鍏嶅己鍒躲€屽繀椤荤敤 mcp_task銆嶏紱闃舵浜屼娇鐢?Story 涓撶敤鎻愮ず璇嶃€侀樁娈靛洓浣跨敤瀹屾暣 audit-prompts 搂5銆?  7. **鎺ㄨ繜闂幆**锛氱姝㈣瘝琛ㄦ槸鍚﹀惈銆屽厛瀹炵幇銆佸悗缁墿灞曘€佹垨鍚庣画鎵╁睍銆嶏紱鏄惁鍚€孲tory 鑼冨洿琛ㄨ堪绀轰緥銆嶏紱闃舵浜屽璁℃槸鍚﹀惈銆岀敱 Story X.Y 璐熻矗銆嶇殑楠岃瘉椤癸紱瀹¤鏈€氳繃鏃朵富 Agent 鏄惁椤诲厛鎵ц銆屽垱寤?鏇存柊 Story X.Y銆嶅啀鍐嶆瀹¤锛汣reate Story 鏄惁鍚闈㈡寚寮曪紙鍔熻兘涓嶅湪鏈?Story 浣嗗睘 Epic 鏃堕』鍐欐槑褰掑睘锛夈€?
  鎶ュ憡缁撳熬蹇呴』鏄庣‘缁欏嚭缁撹锛氭槸鍚︺€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶏紱鑻ユ湭閫氳繃锛岃鍒楀嚭鏈€氳繃椤瑰強淇敼寤鸿銆?```

杩唬淇敼 SKILL.md 骞跺啀娆″璁★紝鐩磋嚦鎶ュ憡缁撹涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶃€?
---

## BMAD Agent 灞曠ず鍚嶄笌鍛戒护瀵圭収

鍦?mcp_task 瀛愪换鍔¤皟鐢ㄣ€丳arty Mode 澶氳疆瀵硅瘽銆佸伐浣滄祦鎸囧紩绛夊満鏅腑锛屽簲浣跨敤浠ヤ笅**灞曠ず鍚?*鎸囦唬鍚?Agent锛屼互淇濇寔涓婁笅鏂囦竴鑷存€т笌鐢ㄦ埛浣撻獙銆?
| Agent 灞曠ず鍚?| 鍛戒护鍚?| 妯″潡 |
|--------------|--------|------|
| BMad Master | `bmad-agent-bmad-master` | core |
| Mary 鍒嗘瀽甯?| `bmad-agent-bmm-analyst` | bmm |
| John 浜у搧缁忕悊 | `bmad-agent-bmm-pm` | bmm |
| Winston 鏋舵瀯甯?| `bmad-agent-bmm-architect` | bmm |
| Amelia 寮€鍙?| `bmad-agent-bmm-dev` | bmm |
| Bob Scrum Master | `bmad-agent-bmm-sm` | bmm |
| Quinn 娴嬭瘯 | `bmad-agent-bmm-qa` | bmm |
| Paige 鎶€鏈啓浣?| `bmad-agent-bmm-tech-writer` | bmm |
| Sally UX | `bmad-agent-bmm-ux-designer` | bmm |
| Barry Quick Flow | `bmad-agent-bmm-quick-flow-solo-dev` | bmm |
| Bond Agent 鏋勫缓 | `bmad-agent-bmb-agent-builder` | bmb |
| Morgan Module 鏋勫缓 | `bmad-agent-bmb-module-builder` | bmb |
| Wendy Workflow 鏋勫缓 | `bmad-agent-bmb-workflow-builder` | bmb |
| Victor 鍒涙柊绛栫暐 | `bmad-agent-cis-innovation-strategist` | cis |
| Dr. Quinn 闂瑙ｅ喅 | `bmad-agent-cis-creative-problem-solver` | cis |
| Maya 璁捐鎬濈淮 | `bmad-agent-cis-design-thinking-coach` | cis |
| Carson 澶磋剳椋庢毚 | `bmad-agent-cis-brainstorming-coach` | cis |
| Sophia 鏁呬簨璁茶堪 | `bmad-agent-cis-storyteller` | cis |
| Caravaggio 婕旂ず | `bmad-agent-cis-presentation-master` | cis |
| Murat 娴嬭瘯鏋舵瀯 | `bmad-agent-tea-tea` | tea |
| 鎵瑰垽鎬у璁″憳 | 锛堜粎 party-mode 鍐呬娇鐢紝鏃犵嫭绔嬪懡浠わ級 | core |

**浣跨敤璇存槑**锛?- **mcp_task 瀛愪换鍔′笂涓嬫枃**锛氬湪 prompt 涓紩鐢?BMAD 宸ヤ綔娴佹垨鎺ㄨ崘涓嬩竴姝ユ椂锛屼娇鐢ㄥ睍绀哄悕锛堝銆屽彲浜ょ敱 Winston 鏋舵瀯甯?鍋氭灦鏋勬鏌ャ€嶏級銆?- **Party Mode 澶氳疆瀵硅瘽**锛欶acilitator 浠嬬粛涓庡彂瑷€鏃讹紝蹇呴』浣跨敤灞曠ず鍚嶆爣娉ㄨ鑹诧紙濡傘€岎煆楋笍 **Winston 鏋舵瀯甯?*锛氣€︺€嶃€岎煉?**Amelia 寮€鍙?*锛氣€︺€嶏級锛屼笌 `_bmad/_config/agent-manifest.csv` 鐨?`displayName` 鍙婁笂琛ㄤ繚鎸佷竴鑷淬€?
---

## 瑙掕壊閰嶇疆

### 鎵瑰垽瀹¤鍛橈紙Critical Auditor锛?
**瑙掕壊瀹氫綅**锛?鐙珛鐨勬壒鍒ゆ€ф€濈淮涓撳锛屼笓娉ㄤ簬鍙戠幇鏂规婕忔礊銆佽川鐤戝亣璁俱€佹寫鎴樿璁″喅绛栥€?鍦ㄦ墍鏈塒arty-Mode璁ㄨ涓紝鎵瑰垽瀹¤鍛樺繀椤绘瘡杞鍏堝彂瑷€銆?
**鏍稿績鑱岃矗**锛?1. 鍦↙ayer 1 PRD Party-Mode闃舵绉瀬鍙備笌杈╄锛堝己鍒讹級
2. 鍦↙ayer 1 Architecture Party-Mode闃舵绉瀬鍙備笌杈╄锛堝己鍒讹級
3. 鍦↙ayer 3 Create Story Party-Mode闃舵绉瀬鍙備笌杈╄锛堝己鍒讹級
4. 瀵规瘡涓叧閿喅绛栨彁鍑鸿嚦灏?涓繁搴﹁川鐤?5. 璁板綍鎵€鏈夋湭瑙ｅ喅鐨刧ap鍜屽亣璁?6. 鍦ㄦ柟妗堟湭杈炬垚鍏辫瘑鍓嶆寔缁寫鎴橈紝涓嶈交鏄撳Ε鍗?7. 纭繚瀹¤娓呭崟锛坅udit-prompts.md锛夎涓ユ牸鎵ц

**鏉冨姏涓庢潈闄?*锛?1. **鏆傚仠鏉?*锛氬彂鐜伴噸澶ф紡娲炴椂锛屽彲瑕佹眰鏆傚仠娴佺▼
2. **璁板綍鏉?*锛氭墍鏈夎川鐤戝繀椤昏璁板綍骞惰拷韪?3. **澶嶉獙鏉?*锛氬彲瑕佹眰瀵逛慨鏀瑰悗鐨勬柟妗堝啀娆″璁?4. **涓€绁ㄥ惁鍐虫潈**锛氬綋鍙戠幇鑷村懡缂洪櫡鏃讹紝鍙惁鍐虫柟妗堣繘鍏ヤ笅涓€闃舵锛涳紙**GAP-060 淇**锛歴kill 鎵ц鐜涓嬶紝鎵瑰垽瀹¤鍛樿浣垮惁鍐虫潈鏃讹紝鐢?Facilitator/涓?Agent 璐熻矗鏆傚仠骞惰褰曪紝涓嶅緱杩涘叆涓嬩竴闃舵锛?
**浠嬪叆闃舵**锛?1. **Layer 1 PRD Party-Mode**锛堝己鍒讹級锛氳川鐤戦渶姹傚畬鏁存€с€佺敤鎴蜂环鍊笺€佸競鍦哄畾浣?2. **Layer 1 Architecture Party-Mode**锛堝己鍒讹級锛氳川鐤戞妧鏈彲琛屾€с€乼radeoff鍚堢悊鎬с€佽繃搴﹁璁?3. **Layer 3 Create Story Party-Mode**锛堝己鍒讹級锛氳川鐤戞柟妗堥€夋嫨銆佽寖鍥寸晫瀹氥€侀獙鏀舵爣鍑?4. **speckit.plan闃舵**锛堟寜闇€锛夛細鐢ㄦ埛鏄庣‘瑕佹眰鎴栨妧鏈簤璁椂浠嬪叆
5. **瀹¤闃舵**锛堝己鍖栵級锛氫笌code-review鍗忓悓宸ヤ綔

**閫€鍑烘爣鍑?*锛?1. 鎵€鏈夎川鐤戦兘寰楀埌婊℃剰鍥炲簲
2. 杈惧埌鏀舵暃鏉′欢锛堝叡璇?+ 杩?杞棤鏂癵ap锛?3. 鐢ㄦ埛鏄庣‘鎺ュ彈椋庨櫓骞剁户缁?4. 璁板綍瀹屾暣鐨勮川鐤戞竻鍗曞拰瑙ｅ喅鐘舵€?
**鑳藉姏瑕佹眰**锛?1. 鐔熸倝瀹¤娓呭崟锛坅udit-prompts.md锛?2. 鍏峰鎵瑰垽鎬ф€濈淮鍜岄€昏緫鍒嗘瀽鑳藉姏
3. 浜嗚В鎶€鏈灦鏋勫拰瀹炵幇绾︽潫
4. 鏈変赴瀵岀殑椤圭洰缁忛獙鍜岄闄╄瘑鍒兘鍔?
**鍏稿瀷璐ㄧ枒闂**锛?- "杩欎釜闇€姹傜殑鐢ㄦ埛浠峰€兼槸浠€涔堬紵鏈夋暟鎹敮鎾戝悧锛?
- "杩欎釜鎶€鏈柟妗堟槸鍚﹁繃搴﹀伐绋嬪寲锛熸湁鏇寸畝鍗曠殑鏇夸唬鍚楋紵"
- "杩欎釜鑼冨洿鐣屽畾鏄惁娓呮櫚锛熻竟鐣屾潯浠惰€冭檻浜嗗悧锛?
- "杩欎釜楠屾敹鏍囧噯鏄惁鍙祴璇曪紵濡備綍楠岃瘉锛?
- "鏈潵3骞寸殑鎵╁睍鎬у浣曪紵鎶€鏈€哄姟浼氬湪鍝噷绉疮锛?

---

## 寮曠敤涓庤矾寰?
| 寮曠敤 | 璺緞/璇存槑 |
|------|-----------|
| Create Story 鍛戒护 | `/bmad-bmm-create-story`锛堟垨鍛戒护鏂囦欢 `bmad-bmm-create-story.md`锛?|
| Dev Story 鍛戒护 | `/bmad-bmm-dev-story`锛堟垨鍛戒护鏂囦欢 `bmad-bmm-dev-story.md`锛?|
| ralph-method 鎶€鑳?| `ralph-method` SKILL.md |
| speckit-workflow 鎶€鑳?| `speckit-workflow` SKILL.md |
| audit-prompts.md 搂5 | 棣栭€夛細鍏ㄥ眬 skills `speckit-workflow/references/audit-prompts.md` 绗?5 鑺傦紙濡?`~/.cursor/skills/` 涓嬶級锛涘閫夛細椤圭洰鍐?`{project-root}/docs/speckit/skills/speckit-workflow/references/audit-prompts.md` |
| workflow.xml | `{project-root}/_bmad/core/tasks/workflow.xml` |
| create-story workflow | `{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` |
| dev-story workflow | `{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` |
| party-mode workflow | `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` |
| agent-manifest | `{project-root}/_bmad/_config/agent-manifest.csv`锛堝惈 displayName 绛夛級 |
| implementation_artifacts | `{project-root}/_bmad-output/implementation-artifacts/` |

**璇存槑**锛歚_bmad` 涓洪」鐩唴瀹夎鐩綍锛屼笉鎻愪氦鑷崇増鏈簱锛涘悇 worktree 闇€鍗曠嫭瀹夎 BMAD 鍚?`_bmad` 璺緞鏂瑰瓨鍦ㄣ€?
### speckit-workflow寮曠敤绾︽潫

褰撴湰鎶€鑳芥墽琛屽埌"闃舵涓夛細Dev Story瀹炴柦"鏃讹紝蹇呴』閬靛惊浠ヤ笅绾︽潫锛?
1. **娴佺▼绾︽潫**
   - 蹇呴』鎸夐『搴忔墽琛岋細specify 鈫?plan 鈫?GAPS 鈫?tasks 鈫?鎵ц
   - 姣忎釜闃舵蹇呴』閫氳繃code-review瀹¤鎵嶈兘杩涘叆涓嬩竴闃舵
   - 涓ョ璺宠繃浠讳綍闃舵鎴栧璁?
2. **鏂囨。绾︽潫**
   - Story鏂囨。蹇呴』鍖呭惈PRD闇€姹傝拷婧珷鑺?   - spec-E{epic}-S{story}.md蹇呴』寮曠敤Story鏂囨。鐨勫姛鑳芥弿杩?   - plan-E{epic}-S{story}.md蹇呴』鍖呭惈娴嬭瘯璁″垝
   - tasks-E{epic}-S{story}.md蹇呴』鍖呭惈Architecture缁勪欢绾︽潫

3. **TDD绾︽潫**
   - 蹇呴』浣跨敤缁熶竴鐨刐TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR]鏍煎紡
   - 蹇呴』鏇存柊ralph-method杩涘害鏂囦欢
   - 涓ョ璺宠繃绾㈢伅闃舵鎴栭噸鏋勯樁娈?
4. **瀹¤绾︽潫**
   - 浼樺厛浣跨敤Cursor Task璋冨害code-reviewer
   - code-reviewer涓嶅彲鐢ㄦ椂浣跨敤mcp_task鍥為€€
   - 鎵€鏈夊璁″繀椤昏揪鍒癆/B绾ф墠鑳界户缁?
5. **Worktree绾︽潫**
   - Story鏁扳墹2浣跨敤Story绾orktree
   - Story鏁扳墺3浣跨敤Epic绾orktree
   - Story鍒嗘敮鍒囨崲鏃跺繀椤籧ommit/stash鏈彁浜ゅ彉鏇?
**杩濊澶勭悊**锛?- 鍙戠幇杩濊绔嬪嵆鏆傚仠鎵ц
- 璁板綍杩濊浜嬮」鍜屽師鍥?- 鏍规嵁涓ラ噸绋嬪害鍐冲畾锛氳鍛?杩斿洖涓婁竴闃舵/閲嶆柊Create Story

---

## 鍥為€€鏈哄埗

褰撳湪瀹炴柦杩囩▼涓彂鐜伴噸澶ч棶棰橈紝鍏佽鍥為€€鍒颁箣鍓嶇殑闃舵銆?
### 鍥為€€鍦烘櫙鍜屽懡浠?
**鍦烘櫙1锛歴peckit闃舵鍙戠幇Story鏂囨。涓嶆竻鏅?*
- 鐥囩姸锛歴pecify/plan闃舵鍙嶅瀹¤涓嶉€氳繃锛屽師鍥犳槸闇€姹備笉鏄庣‘
- 鍥為€€鍛戒护锛歚/bmad-bmm-correct-course epic={num} story={num} reason="闇€姹備笉娓呮櫚"`
- 鍥為€€鐩爣锛歀ayer 3 Create Story闃舵
- 鎿嶄綔锛氶噸鏂拌繘鍏arty-mode婢勬竻闇€姹傦紝鏇存柊Story鏂囨。

**鍦烘櫙2锛氬彂鐜版妧鏈柟妗堟湁閲嶅ぇ缂洪櫡**
- 鐥囩姸锛歱lan闃舵鍙戠幇鎶€鏈柟妗堜笉鍙锛岄渶瑕侀噸鏂拌璁?- 鍥為€€鍛戒护锛歚/bmad-bmm-correct-course epic={num} story={num} reason="鎶€鏈柟妗堢己闄?`
- 鍥為€€鐩爣锛歀ayer 3 Create Story闃舵
- 鎿嶄綔锛氶噸鏂拌繘鍏arty-mode璁ㄨ鎶€鏈柟妗?
**鍦烘櫙3锛歍DD鎵ц鍙戠幇鏋舵瀯闂**
- 鐥囩姸锛氭墽琛岄樁娈靛彂鐜伴渶瑕佷慨鏀规灦鏋勬墠鑳介€氳繃娴嬭瘯
- 鍥為€€鍛戒护锛歚/bmad-bmm-correct-course epic={num} story={num} reason="鏋舵瀯闂"`
- 鍥為€€鐩爣锛歴peckit plan闃舵
- 鎿嶄綔锛氫慨鏀筽lan-E{epic}-S{story}.md锛屽繀瑕佹椂鍥炲埌Create Story

**鍦烘櫙4锛歅RD/Architecture闇€瑕佸彉鏇?*
- 鐥囩姸锛氬疄鏂借繃绋嬩腑鍙戠幇PRD鎴朅rchitecture鏈夐仐婕忔垨閿欒
- 鍥為€€鍛戒护锛歚/bmad-bmm-correct-course epic={num} story={num} reason="PRD鍙樻洿"`
- 鍥為€€鐩爣锛歀ayer 1浜у搧瀹氫箟灞?- 鎿嶄綔锛氭洿鏂癙RD/Architecture锛岄噸鏂拌瘎浼板奖鍝嶈寖鍥?
### 鍥為€€鏁版嵁淇濈暀

鍥為€€鏃朵繚鐣欎互涓嬫暟鎹細
- 鍘烻tory鏂囨。锛堝浠戒负`story-{epic}-{story}-v{N}.md`锛?- 宸茬敓鎴愮殑spec/plan锛堢敤浜庡弬鑰冿級
- TDD璁板綍锛堝鏈夛級
- 瀹¤鍘嗗彶璁板綍

### 鍥為€€闄愬埗锛圙AP-006 淇锛氫笌鍥炴粴鍖哄垎锛?
- **鍥為€€**锛坈orrect-course锛夛細鍥炲埌 Create Story/speckit 绛夐樁娈碉紝鎸?**Story** 璁★紱鍚屼竴 Story 鏈€澶氬洖閫€ 3 娆★紝瓒呰繃闇€瑕?BMad Master 浠嬪叆
- **鍥炴粴**锛坮ollback-worktree锛夛細worktree 浠?Epic 绾у洖鍒?Story 绾э紝鎸?**Epic** 璁★紱鍚屼竴 Epic 鏈€澶氬洖婊?2 娆★紙瑙佷换鍔?3.6锛?- **BMad Master 浠嬪叆锛圙AP-037 淇锛?*锛氬洖閫€>3 娆℃垨鍥炴粴>2 娆℃椂锛岄渶鐢ㄦ埛鎴栭」鐩礋璐ｄ汉纭锛涘鎵规楠わ細璁板綍鍘熷洜 鈫?鐢ㄦ埛纭銆岀户缁€嶆垨銆岀粓姝€嶁啋 鑻ョ户缁垯閲嶇疆璁℃暟
- 鍥為€€鍒?Layer 1 浼氶噸缃暣涓?Epic 鐨勮鍒?- 鍥為€€/鍥炴粴鎿嶄綔蹇呴』璁板綍鍘熷洜鍜屽喅绛栬繃绋?

## Cursor party-mode return validation contract

输出 Story 文档到 {project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md
Story 文档通常保存在：`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`。

为什么以前看起来更稳定：旧问题被吞掉或旧问题被显式分类前不显性；现在是旧问题显性暴露，不得归因为全局无法处理、全局不稳定或整体坏了。若有新回归，应明确标成状态同步风险或新回归引入。
禁止 shell-probe 诊断；Do not use shell fallback probes.

??????? standalone command / single command?
`node .cursor/hooks/party-mode-read-current-session.cjs --project-root "{project-root}"`

**Do not / forbidden / ?? / ??** use shell probes such as `ls -la`, `mkdir -p`, `terminals/`, `2>/dev/null`, or `2>&null`; use the current-session helper first.
? `current-session.json` ??????????????
1. `current-session.json`
2. `execution_evidence_level`????? none|pending|partial|final
3. `visible_output_summary`
4. `diagnostic_classification`

?? shell-probe ???Do not use shell fallback probes. Do not use `ls -la`, `mkdir -p`, `No terminals folder`, `agent-transcripts`, `terminals/`, `2>&null`, `2>/dev/null`, or fallback shell chains to infer party-mode return state.
??? `degenerate_placeholder_completion` ? `stub_only_completion` ??? Task tool ?????????? current-session evidence ???
??? `recovered_from_newer_launch` ? `pending_launch_evidence_present` ?????? completed session??? launch evidence ?????? active run?
??????????????????????????????????????????????????????????????????????????????????????????
