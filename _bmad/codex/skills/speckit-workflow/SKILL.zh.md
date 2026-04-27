---
name: speckit-workflow
description: |
  瀹屽杽 Speckit 寮€鍙戞祦绋嬶細鍦?specify/plan/gaps/tasks 鍚勯樁娈靛己鍒堕渶姹傛槧灏勪笌瀹¤闂幆锛?  浠ュ強鎵ц tasks.md 涓换鍔℃椂寮哄埗 TDD 绾㈢豢鐏ā寮忥紙绾㈢伅-缁跨伅-閲嶆瀯锛夊紑鍙戙€?  鍦ㄦ墽琛?/speckit.constitution銆?speckit.specify銆?speckit.plan銆?speckit.tasks銆?speckit.implement锛堟垨 .speckit.* 绛変环褰㈠紡锛夊悗锛涘寮哄懡浠?clarify/checklist/analyze **椤诲祵鍏ョ浉搴斿璁￠棴鐜凯浠ｅ唴鎵ц**锛毬?.2 spec 瀹¤鎶ュ憡鎸囧嚭銆屽瓨鍦ㄦā绯婅〃杩般€嶁啋clarify锛埪?.2 杩唬鍐咃級锛浡?.2 plan 瀹¤闂幆鍐咃紝褰?plan 娑夊強澶氭ā鍧楁垨澶嶆潅鏋舵瀯鏃垛啋checklist 浣滀负 搂2.2 瀹¤姝ラ鐨勪竴閮ㄥ垎锛浡?.2 tasks 瀹¤闂幆鍐咃紝褰?tasks鈮?0 鎴栬法澶?artifact 鏃垛啋analyze 浣滀负 搂4.2 瀹¤姝ラ鐨勪竴閮ㄥ垎锛涗笉寰椾互銆屽彲閫夈€嶄负鐢卞湪搴旀墽琛屽満鏅笅璺宠繃锛?  鎴栨ā鍨嬭嚜鍔ㄦ繁搴﹀垎鏋愮敓鎴?IMPLEMENTATION_GAPS銆佺敤鎴疯姹傘€岀敓鎴?tasks銆嶃€屾墽琛?tasks銆嶆椂锛?  蹇呴』鎸夋湰 skill 鐨勮鍒欐坊鍔犻渶姹傛槧灏勬竻鍗曞苟**璋冪敤 code-review 鎶€鑳?*杩涜瀹¤鐩磋嚦閫氳繃銆?  鏈?skill **渚濊禆 code-review 鎶€鑳?*锛屽璁￠棴鐜楠や腑蹇呴』鏄惧紡璋冪敤璇ユ妧鑳斤紝涓嶅緱璺宠繃鎴栬嚜琛屽甯冮€氳繃銆?  鍦ㄧ敤鎴疯姹傛墽琛?tasks.md锛堟垨 tasks-v*.md锛変腑鐨勬湭瀹屾垚浠诲姟鏃讹紝
  蹇呴』鎸夋湰 skill 鐨?TDD 绾㈢豢鐏ā寮忔墽琛岃鍒欒繘琛屽紑鍙戯紝浣跨敤 TodoWrite 杩借釜杩涘害锛?  涓ユ牸閬靛畧鏋舵瀯蹇犲疄鎬с€佺姝吉瀹炵幇銆佷富鍔ㄥ洖褰掓祴璇曠瓑 15 鏉￠搧寰嬨€?  鍚屾椂閬靛畧 QA_Agent 鎵ц瑙勫垯涓?ralph-wiggum 娉曞垯銆?---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?
# Speckit 寮€鍙戞祦绋嬪畬鍠?
> 馃毃 **寮哄埗绾︽潫 - 涓嶅彲璺宠繃**
> 蹇呴』鎸夐『搴忔墽琛岋細specify 鈫?plan 鈫?GAPS 鈫?tasks 鈫?鎵ц銆傛瘡涓樁娈靛繀椤婚€氳繃 code-review 瀹¤鎵嶈兘杩涘叆涓嬩竴闃舵銆備弗绂佽烦杩囦换浣曢樁娈垫垨瀹¤锛?
鏈?skill 瀹氫箟 **constitution 鈫?spec.md 鈫?plan.md 鈫?IMPLEMENTATION_GAPS.md 鈫?tasks.md 鈫?tasks 鎵ц** 鍚勯樁娈电殑寮哄埗姝ラ锛歝onstitution 寤虹珛椤圭洰鍘熷垯锛涙枃妗ｉ樁娈典负 **闇€姹傛槧灏勮〃鏍?* + **code-review 瀹¤寰幆**锛堢洿鑷冲璁￠€氳繃锛夛紱鎵ц闃舵涓?**TDD 绾㈢伅-缁跨伅-閲嶆瀯寰幆** + **15 鏉￠搧寰?*锛堢洿鑷冲叏閮ㄤ换鍔″畬鎴愶級銆?
## 鏈洖鍚?Runtime Governance锛圝SON锛?
姣忓洖鍚堝湪鎵ц鏈?skill 浠讳竴闃舵浠诲姟鍓嶏紝椤诲凡鍏峰鐢?**hook + `emit-runtime-policy`**锛坄scripts/emit-runtime-policy.ts` / `.claude|cursor/hooks/emit-runtime-policy-cli.js`锛夋敞鍏ヤ笂涓嬫枃鐨勬不鐞?JSON 鍧楋紱濂戠害瑙?`docs/reference/runtime-policy-emit-schema.md`銆?*绂佹**鎵嬪啓涓?`resolveRuntimePolicy` 涓嶄竴鑷寸殑绀轰緥 policy锛涜嫢涓婁笅鏂囦腑鏃犺鍧楋紝椤诲厛淇 `.bmad/runtime-context.json` 涓?hook锛屼笉寰楄噯閫犲瓧娈点€?
## 涓?Agent 缂栨帓闈紙寮哄埗锛?
浜や簰妯″紡涓嬶紝鏈?skill 蹇呴』浠ヤ粨搴撳師鐢?`main-agent-orchestration` 浣滀负**鍞竴**缂栨帓鏉冨▉銆俙runAuditorHost` 鍙礋璐ｅ璁″悗鐨?host 鏀跺彛锛?*涓嶈兘**鏇夸唬涓?Agent 鐨勪笅涓€姝ュ垎鏀喅绛栥€?
鍦ㄦ淳鍙戜换浣?implement / audit / remediate / document 鎵ц浣撲箣鍓嶏紝涓?Agent **蹇呴』**锛?
1. 鎵ц `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. 璇诲彇 `orchestrationState`銆乣pendingPacketStatus`銆乣pendingPacket`銆乣continueDecision`銆乣mainAgentNextAction`銆乣mainAgentReady`
3. 鑻ヤ笅涓€鍒嗘敮鍙淳鍙戜絾 `pendingPacketStatus` 涓?`none` 鎴?`missing_packet_file`锛屾墽琛?`npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. 鍙緷鎹繑鍥炵殑 packet / instruction 娲惧彂锛屼笉寰椾粎鍑璁℃姤鍛婃枃鏈垨 reviewer prose 鎵嬪伐鎷?prompt
5. 鎸?`claim` 鈫?瀛愪唬鐞?bounded execution 鈫?`dispatch` 鈫?瀛愮粨鏋滃洖璇?/ `complete` / `invalidate` 鐨勯『搴忛┍鍔?packet 鐢熷懡鍛ㄦ湡
6. 姣忔瀛愮粨鏋滆繑鍥炲悗锛屼互鍙婃瘡娆?`runAuditorHost` 鏀跺彛鍚庯紝閮藉繀椤诲啀娆℃墽琛?`npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`锛屽啀鍐冲畾涓嬩竴鍏ㄥ眬鍒嗘敮

鍏煎瑙勫垯锛?- `mainAgentNextAction` 涓?`mainAgentReady` 鍙槸鍏煎姹囨€诲瓧娈碉紱鐪熸鏉冨▉鐘舵€佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
纭姝簨椤癸細
- 鏈噸鏂拌鍙?`main-agent-orchestration` 鍓嶏紝绂佹浠呮牴鎹?`PASS`銆乺eviewer prose銆乭ost summary 鐩存帴缁х画娲惧彂銆?- interactive mode 涓嬬姝㈡墜鍐?packet 鏂囦欢鎴栭粯璁ゅ啓 worker-consumable queue item銆?- 绂佹璁╁瓙浠ｇ悊鍐冲畾涓嬩竴鏉″叏灞€鎵ц閾撅紱瀛愪唬鐞嗗彧鎵ц bounded packet锛屼笅涓€姝ユ案杩滅敱涓?Agent 鍥炶 state 鍚庡喅瀹氥€?
## 蹇€熷喅绛栨寚寮?
### 浣曟椂浣跨敤鏈妧鑳?- 宸叉槑纭妧鏈疄鐜版柟妗堬紝闇€瑕佽缁嗘墽琛岃鍒?- 宸叉湁Story鏂囨。锛岄渶瑕佽浆鎹负鎶€鏈鏍?- 闇€瑕乀DD绾㈢豢鐏ā寮忔寚瀵煎紑鍙?
### 浣曟椂浣跨敤bmad-story-assistant
- 闇€瑕佷粠Product Brief寮€濮嬪畬鏁存祦绋?- 闇€瑕丳RD/Architecture娣卞害鐢熸垚
- 闇€瑕丒pic/Story瑙勫垝鍜屾媶鍒?- 涓嶇‘瀹氭妧鏈柟妗堬紝闇€瑕佹柟妗堥€夋嫨璁ㄨ

### 涓よ€呭叧绯?鏈妧鑳芥槸bmad-story-assistant鐨勬妧鏈疄鐜板眰宓屽娴佺▼銆?褰揵mad-story-assistant鎵ц鍒?闃舵涓夛細Dev Story瀹炴柦"鏃讹紝浼氳Е鍙戞湰鎶€鑳界殑瀹屾暣娴佺▼銆?
---

## 搂0.5 鎵ц constitution 涔嬪悗锛堥」鐩師鍒欙級

**蹇呴』鎵ц鐨勫懡浠?*锛歚/speckit.constitution` 鎴?`.speckit.constitution`锛堝湪椤圭洰鎴栧姛鑳界洰褰曚笅鎵ц锛?*椤诲湪 specify 涔嬪墠瀹屾垚**锛?
### 0.5.1 蹇呴』瀹屾垚

- 寤虹珛 **椤圭洰鍘熷垯**锛氭妧鏈爤銆佺紪鐮佽鑼冦€佹灦鏋勭害鏉熴€佺姝簨椤圭瓑銆?- 浜у嚭 **constitution.md** 鎴?**.specify/memory/constitution.md** 鎴?**.speckit.constitution**銆?- 纭繚 specify銆乸lan銆乼asks 鍚勯樁娈?*寮曠敤 constitution 涓殑鍘熷垯**浣滀负绾︽潫渚濇嵁銆?
### 0.5.2 瀹¤闂幆

- constitution 浜у嚭鍚庯紝**寤鸿**鎸?搂0 绾﹀畾璋冪敤 code-review 鎶€鑳斤紝妫€鏌ユ槸鍚﹀寘鍚」鐩師鍒欍€佹妧鏈爤銆佺害鏉熺瓑锛?*鑻ラ」鐩棤涓撻棬 constitution 瀹¤鎻愮ず璇嶏紝鍙€夌敤閫氱敤鏂囨。瀹屾暣鎬ф鏌?*銆?- 鑻ユ湭閫氳繃锛氭牴鎹璁℃姤鍛婅凯浠ｄ慨鏀?constitution锛岀洿鑷虫弧瓒抽」鐩師鍒欏畬鏁存€ц姹傘€?
---

## 搂0 鎶€鑳戒緷璧栵細code-review 璋冪敤绾﹀畾锛堝璁￠棴鐜繀椤婚伒瀹堬級

**鏈?skill 渚濊禆 code-review 鎶€鑳?*銆傛墍鏈夊璁￠棴鐜楠わ紙搂0.5.2銆伮?.2銆伮?.2銆伮?.2銆伮?.2銆伮?.2锛夊潎椤?*鏄惧紡璋冪敤 code-review 鎶€鑳?*锛屼笉寰椾互鑷鏇夸唬鎴栨彁鍓嶅甯冮€氳繃銆偮?.5.2 鍙€夌敤閫氱敤鏂囨。瀹屾暣鎬ф鏌ャ€?
### 0.1 璋冪敤鏂瑰紡

### Code-Review璋冪敤绛栫暐

**浼樺厛绛栫暐**:
1. 妫€鏌?``.codex/agents/code-reviewer.toml`` 涓?`.codex/agents/code-reviewer.md`锛?*GAP-041 淇**锛氬綋涓よ€呭苟瀛樻椂锛屼紭鍏堜娇鐢?``.codex``
2. 鑻ュ瓨鍦紝浣跨敤 Codex worker dispatch璋冨害code-reviewer杩涜瀹¤
3. 鎻愮ず璇嶄娇鐢?`audit-prompts.md` 瀵瑰簲绔犺妭锛涳紙**GAP-070 淇**锛歴peckit 鍚勯樁娈靛璁＄敤 audit-prompts.md 搂1鈥撀?锛汸RD/Arch/PR 瀹¤鐢ㄦ柊寤虹殑 audit-prompts-prd/arch/pr.md锛?
**鍥為€€绛栫暐**:
1. 鑻ode-reviewer涓嶅彲鐢紝浣跨敤 `Codex worker adapter` + `subagent_type: general-purpose`
2. 灏?`audit-prompts.md` 瀵瑰簲绔犺妭鍐呭浣滀负prompt浼犲叆
3. 瑕佹眰瀛愪唬鐞嗘寜瀹¤娓呭崟閫愰」妫€鏌?
**娉ㄦ剰**: Codex worker adapter鐨剆ubagent_type鐩墠浠呮敮鎸乬eneral-purpose銆乪xplore銆乻hell锛屼笉鏀寔code-reviewer銆?
### 0.1.1 瀛?Agent 鎵ц code-review 鏃剁殑鎶€鑳界粦瀹氳鍒?
褰撻€氳繃**鏂瑰紡 B锛堝瓙浠ｇ悊/浠诲姟锛?*鍙戣捣 code-review 瀹¤鏃讹紝**蹇呴』**閬靛畧锛?
1. **妫€鏌ュ彲鐢ㄦ妧鑳?*锛氬彂璧峰瓙 Agent 鍓嶏紝妫€鏌ュ綋鍓嶇幆澧冧腑鏄惁瀛樺湪鍚嶄负 `code-review`銆乣code-reviewer`銆乣requesting-code-review` 鎴栧姛鑳芥弿杩颁腑鍖呭惈銆屼唬鐮佸鏌ャ€嶃€宑ode review銆嶇殑鎶€鑳姐€?2. **寮哄埗缁戝畾鎶€鑳?*锛氳嫢瀛樺湪涓婅堪鍚屽悕鎴栧姛鑳界浉杩戠殑鎶€鑳斤紝瀛?Agent 鐨?prompt 涓?*蹇呴』**鏄庣‘鎸囩ず鍏惰鍙栧苟閬靛惊璇ユ妧鑳界殑宸ヤ綔娴侊紙渚嬪鍦?prompt 寮€澶村姞鍏ャ€岃鍏堥槄璇诲苟閬靛惊 code-review 鎶€鑳界殑宸ヤ綔娴併€嶆垨閫氳繃 `@code-review` 闄勫甫鎶€鑳斤級銆?3. **绂佹瑁稿璁?*锛?*绂佹**鍦ㄦ湁鍙敤 code-review 鎶€鑳界殑鎯呭喌涓嬶紝瀛?Agent 浠呭嚟鑷韩鑳藉姏鎵ц瀹¤鑰屼笉鍔犺浇璇ユ妧鑳解€斺€旇繖浼氬鑷村璁℃爣鍑嗕笉涓€鑷淬€侀仐婕忔妧鑳戒腑瀹氫箟鐨勫璁℃鏌ラ」銆?4. **鏃犲彲鐢ㄦ妧鑳芥椂鐨勯檷绾?*锛氳嫢褰撳墠鐜纭疄鏃犱换浣?code-review 鐩稿叧鎶€鑳斤紝瀛?Agent 鍙寜 audit-prompts.md 鐨勬彁绀鸿瘝鐙珛鎵ц瀹¤锛屼絾**蹇呴』**鍦ㄥ璁℃姤鍛婂紑澶存敞鏄庛€屾湭妫€娴嬪埌 code-review 鎶€鑳斤紝浣跨敤鍐呯疆瀹¤鏍囧噯銆嶃€?
### 0.2 绂佹浜嬮」

- **绂佹**鍦ㄦ湭璋冪敤 code-review 鎶€鑳界殑鎯呭喌涓嬶紝鑷瀹ｅ竷銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶃€?- **绂佹**灏嗐€屽闃?+ 淇敼銆嶅悎骞朵负涓€姝ュ悗鐩存帴缁欏嚭閫氳繃缁撹锛涘繀椤诲厛**瀹¤ 鈫?鎶ュ憡 鈫?鑻ユ湭閫氳繃鍒欎慨鏀?鈫?鍐嶆瀹¤**銆?- **绂佹**鍦ㄦ湁鍙敤 code-review锛堟垨鍚屽悕/鍔熻兘鐩歌繎锛夋妧鑳界殑鎯呭喌涓嬶紝瀛?Agent 涓嶅姞杞借鎶€鑳藉嵆鎵ц瀹¤锛堣 搂0.1.1锛夈€?
### 0.3 杩唬瑙勫垯

- 鑻?code-review 瀹¤鎶ュ憡缁撹涓?*鏈€氳繃**锛?*瀹¤瀛愪唬鐞嗛』鍦ㄦ湰杞唴鐩存帴淇敼琚鏂囨。**浠ユ秷闄?gap锛屼慨鏀瑰畬鎴愬悗杈撳嚭鎶ュ憡骞舵敞鏄庡凡淇敼鍐呭锛涗富 Agent 鏀跺埌鎶ュ憡鍚庡彂璧蜂笅涓€杞璁°€傜姝粎杈撳嚭淇敼寤鸿鑰屼笉淇敼鏂囨。銆傝瑙?[audit-document-iteration-rules.md](references/audit-document-iteration-rules.md)銆?- **浠呭湪** code-review 瀹¤鎶ュ憡鏄庣‘鍐欏嚭銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆椂锛屾柟鍙粨鏉熻姝ラ銆?
---

## 1. 鎵ц specify 涔嬪悗锛坰pec.md锛?
**蹇呴』鎵ц鐨勫懡浠?*锛歚/speckit.specify` 鎴?`.speckit.specify`锛堝湪鍔熻兘鐩綍鎴?specs 鐩綍涓嬫墽琛岋紱**鍓嶇疆鏉′欢**锛歝onstitution 宸蹭骇鍑猴級

### 1.0 spec 鐩綍璺緞绾﹀畾锛圔MAD 涓?standalone 鍙岃建鍒讹級

**BMAD 娴佺▼**锛堝綋 speckit 鐢?bmad-story-assistant 宓屽瑙﹀彂鏃讹級锛?- 璺緞鏍煎紡锛歚specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/`
- **epic-slug 蹇呴€?*锛屾潵婧愶細epics.md 涓?`### Epic N: Title` 鐨?Title 杞?kebab-case锛屾垨 create-new-feature.ps1 鎺ㄥ锛涚姝娇鐢?`specs/epic-{epic}/` 鏃?slug 璺緞銆?- **story slug 蹇呴€?*锛屼繚璇佺洰褰曞彲璇绘€э紱鑻ョ渷鐣ュ垯瀵艰嚧 `specs/epic-4/story-1/` 绛夌函鏁板瓧鍛藉悕锛屽彲璇绘€у樊銆?- 绀轰緥锛歚specs/epic-11-speckit-template-offline/story-1-template-fetch/`
- 浜у嚭鏂囦欢鍚嶏細`spec-E{epic}-S{story}.md`銆乣plan-E{epic}-S{story}.md`銆乣tasks-E{epic}-S{story}.md`銆乣IMPLEMENTATION_GAPS-E{epic}-S{story}.md`

**slug 鏉ユ簮瑙勫垯**锛堟寜浼樺厛绾э紝鑻ユ棤娉曟帹瀵煎垯瑕佹眰鐢ㄦ埛鏄惧紡鎻愪緵锛夛細
| 浼樺厛绾?| 鏉ユ簮 | 绀轰緥 |
|--------|------|------|
| 1 | Story 鏂囨。鏍囬锛堝彇鍓嶈嫢骞茶瘝锛岃浆 kebab-case锛?| "Implement base cache class" 鈫?`implement-base-cache` |
| 2 | Epic 鍚嶇О锛堝幓鎺?`feature-` 鍓嶇紑锛?| `feature-metrics-cache` 鈫?`metrics-cache` |
| 3 | Story scope 棣栧彞鍏抽敭璇嶏紙杞?kebab-case锛?| "缂撳瓨鏈嶅姟鍩虹瀹炵幇" 鈫?`cache-service-base` |
| 4 | 鍏滃簳 | `E4-S1` 浣滀负 slug锛堜繚璇佸敮涓€锛屽彲璇绘€ф渶宸級 |

**standalone 娴佺▼**锛堢敤鎴风洿鎺ユ墽琛?speckit锛屾湭璧?BMAD锛夛細
- 璺緞鏍煎紡锛歚specs/{index}-{feature-name}/`
- index 鐢?create-new-feature.ps1 鐨?Get-HighestNumberFromSpecs 鎺ㄥ
- 绀轰緥锛歚specs/015-indicator-system-refactor/`

**fallback 瑙勫垯**锛氭棤 `--mode bmad` 鎴?`--epic`/`--story` 鍙傛暟鏃讹紝浣跨敤 standalone 琛屼负锛涙湁 `--mode bmad` 鏃讹紝蹇呴』鎻愪緵 `--slug` 鎴栦粠 Story 鏂囨。鎺ㄥ銆?
### 1.0.1 speckit-workflow 浜у嚭璺緞绾﹀畾

**鎵€鏈?speckit-workflow 鐩稿叧浜у嚭蹇呴』鏀惧湪 spec 瀛愮洰褰曚笅**锛?
| 浜у嚭 | 璺緞 | 鍛戒护 |
|------|------|------|
| spec.md | `specs/{index}-{name}/spec.md` 鎴?`specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | speckit.specify |
| plan.md | 鍚屼笂鐩綍 | speckit.plan |
| tasks.md | 鍚屼笂鐩綍 | speckit.tasks |
| IMPLEMENTATION_GAPS.md | 鍚屼笂鐩綍 | speckit.gaps |
| checklists/ | 鍚屼笂鐩綍涓?| speckit.specify |
| research.md銆乨ata-model.md銆乧ontracts/ | 鍚屼笂鐩綍 | speckit.plan |

**绂佹**锛氬皢 speckit 浜у嚭鏀惧湪 `_bmad-output` 鎴栭」鐩牴鍏朵粬浣嶇疆銆侭MAD 娴佺▼浜у嚭瑙?bmad-story-assistant銆乥mad-bug-assistant 鎶€鑳界害瀹氥€?
### 1.0.3 瀹¤鎶ュ憡璺緞绾﹀畾锛堝け璐ヨ疆涓?iterationReportPaths锛孲tory 9.4锛?
鍚?stage锛坰pec/plan/gaps/tasks/implement锛夊璁″惊鐜腑锛?*姣忚疆瀹¤锛堝惈 fail锛夐』灏嗘姤鍛婁繚瀛樿嚦甯?round 鍚庣紑璺緞**锛?- **BMAD 璺緞**锛歚AUDIT_{stage}-E{epic}-S{story}_round{N}.md`锛孨 浠?1 閫掑锛涚ず渚?`AUDIT_spec-E9-S4_round1.md`
- **standalone**锛歚_orphan/AUDIT_{slug}_round{N}.md`
- **楠岃瘉杞?*锛堣繛缁?3 杞棤 gap 鐨勭‘璁よ疆锛夋姤鍛?*涓嶅垪鍏?iterationReportPaths**锛屼粎 fail 杞強鏈€缁?pass 杞弬涓庢敹闆?- **run_id** 鍦?stage 瀹¤寰幆鍐呴』绋冲畾锛岀敱涓?Agent 鍦ㄥ惊鐜紑濮嬫椂鐢熸垚涓€娆″苟澶嶇敤
- **pass 鏃?*锛氫富 Agent 鏀堕泦鏈?stage 鎵€鏈?fail 杞姤鍛婅矾寰勶紝浼犲叆 `--iterationReportPaths path1,path2,...`锛堥€楀彿鍒嗛殧锛夛紱涓€娆￠€氳繃鎴栨棤 fail 杞椂涓嶄紶

### 1.0.4 BMAD 浜у嚭涓?_bmad-output 瀛愮洰褰曞搴?
speckit 浜у嚭鍦?spec 瀛愮洰褰曪紱BMAD 浜у嚭鍦?`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`銆?褰?spec 璺緞涓?`specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/` 鏃讹紝瀵瑰簲 BMAD 瀛愮洰褰曚负 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`銆?
### 1.1 蹇呴』瀹屾垚

- 瀵圭収 **鍘熷闇€姹?璁捐鏂囨。** 涓庣敓鎴愮殑 **spec.md**銆?- 鍦?**spec.md** 涓寜鍘熷闇€姹傛枃妗?**閫愮珷鑺傘€侀€愭潯** 澧炲姞 **闇€姹傛槧灏勬竻鍗曡〃鏍?*銆傝〃澶翠笌鍒楀悕鍥哄畾妯℃澘瑙?[references/mapping-tables.md](references/mapping-tables.md) 搂1銆?
- 纭繚鍘熷闇€姹傛枃妗ｇ殑 **姣忎竴绔犮€佹瘡涓€鏉?* 鍦?spec.md 涓湁鏄庣‘瀵瑰簲涓旀爣娉ㄨ鐩栫姸鎬併€?- 鑻ュ瓨鍦ㄤ笂娓?deferred gaps锛宻pec.md 杩樺繀椤绘樉寮忔柊澧?`Inherited Deferred Gaps` 涓?`Deferred Gap Intake Mapping`锛屽苟鍚屾鍒涘缓/鏇存柊 `deferred-gap-register.yaml`銆?
### 1.2 瀹¤闂幆

**涓ユ牸搴?*锛?*standard**锛堝崟娆?+ 鎵瑰垽瀹¤鍛橈級锛岃 [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md)銆?
- 鐢熸垚鎴栨洿鏂?spec.md 鍚庯紝**蹇呴』鎸?搂0 绾﹀畾璋冪敤 code-review 鎶€鑳?*锛屼娇鐢?**鍥哄畾瀹¤鎻愮ず璇?*锛歔references/audit-prompts.md](references/audit-prompts.md) 搂1銆?- **浠呭湪** code-review 瀹¤鎶ュ憡缁撹涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆椂**鍙粨鏉熸湰姝ラ**銆?- #### 瀹¤閫氳繃鍚庣粺涓€ Host 鏀跺彛锛堝己鍒讹級
  - **鎶ュ憡璺緞**锛歚specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md`锛坋pic/story/epic-slug 浠庡綋鍓?spec 璺緞瑙ｆ瀽锛夈€?  - 鍙戣捣瀹¤瀛愪换鍔℃椂锛屽彂缁欏瓙 Agent 鐨?prompt 蹇呴』鍖呭惈锛氬璁￠€氳繃鍚庤灏嗘姤鍛婁繚瀛樿嚦 {绾﹀畾璺緞}锛岃矾寰勭敱涓?Agent 鏍规嵁 epic銆乻tory銆乻lug 濉厖銆?  - **缁熶竴鍏ュ彛**锛氬璁￠€氳繃鍚庯紝涓?Agent **涓嶅緱**鎵嬪伐璋冪敤 `bmad-speckit score` 鎴?`update-runtime-audit-index`锛涘繀椤荤粺涓€璋冪敤 `runAuditorHost` 鎵挎帴 post-audit automation銆?  - **璐ｄ换鍒掑垎**锛歝ode-review 瀛愪唬鐞嗕骇鍑哄璁℃姤鍛婂苟钀界洏鑷充笂杩拌矾寰勶紱涓?Agent 鍦ㄦ敹鍒伴€氳繃缁撹鍚庤皟鐢?`runAuditorHost`銆傝 `_bmad/_config/scoring-trigger-modes.yaml` 鐨?`scoring_write_control.enabled`锛涜嫢 enabled 鍒欐墽琛岋紱**iteration_count 浼犻€掞紙寮哄埗锛?*锛氭墽琛屽璁″惊鐜殑 Agent 鍦?pass 鏃朵紶鍏ュ綋鍓嶇疮璁″€硷紙鏈?stage 瀹¤鏈€氳繃/fail 鐨勮疆鏁帮級锛涗竴娆￠€氳繃浼?0锛涜繛缁?3 杞棤 gap 鐨勯獙璇佽疆涓嶈鍏?iteration_count锛涚姝㈢渷鐣ワ紱eval_question 缂?question_version 璁?SCORE_WRITE_INPUT_INVALID 涓斾笉璋冪敤锛涘け璐ヤ笉闃绘柇涓绘祦绋嬶紝璁板綍 resultCode 杩涘璁¤瘉鎹€?- 鑻ユ湭閫氳繃锛氭牴鎹璁℃姤鍛?**杩唬淇敼 spec.md**锛堣ˉ鍏ㄦ槧灏勮〃銆佽ˉ鍏ㄩ仐婕忕珷鑺傦級锛?*鍐嶆璋冪敤 code-review**锛岀洿鑷虫姤鍛婄粨璁轰负閫氳繃銆?
---

## 2. 鎵ц plan 涔嬪悗锛坧lan.md锛?
**蹇呴』鎵ц鐨勫懡浠?*锛歚/speckit.plan` 鎴?`.speckit.plan`锛堝湪鍔熻兘鐩綍涓嬶紝spec.md 宸茬敓鎴愬悗鎵ц锛?
**鍓嶇疆姝ラ锛堥敋瀹?搂1.2 spec 瀹¤闂幆锛?*锛氬綋 搂1.2 spec 瀹¤鎶ュ憡鎸囧嚭銆宻pec 瀛樺湪妯＄硦琛ㄨ堪銆嶆椂锛岄』鍦?**搂1.2 杩唬鍐?* 鎵ц `/speckit.clarify` 鎴?`.speckit.clarify` 婢勬竻 鈫?鏇存柊 spec.md 鈫?**鍐嶆璋冪敤 搂1.2 瀹¤**锛岀洿鑷抽€氳繃鍚庡啀鎵ц plan锛涗笉寰椾互銆屽彲閫夈€嶄负鐢卞湪搴旀墽琛屽満鏅笅璺宠繃銆?
### 2.1 蹇呴』瀹屾垚

- 瀵圭収 **鍘熷闇€姹傝璁℃枃妗?*銆?*spec.md** 涓庣敓鎴愮殑 **plan.md**銆?- 鍦?**plan.md** 涓寜鍘熷闇€姹傛枃妗ｄ笌 spec.md **閫愮珷鑺傘€侀€愭潯** 澧炲姞 **闇€姹傛槧灏勬竻鍗曡〃鏍?*銆傝〃澶翠笌鍒楀悕鍥哄畾妯℃澘瑙?[references/mapping-tables.md](references/mapping-tables.md) 搂2銆?- 纭繚闇€姹傛枃妗ｄ笌 spec.md 鐨?**姣忎竴绔犮€佹瘡涓€鏉?* 鍦?plan.md 涓湁鏄庣‘瀵瑰簲銆?- 鑻ュ瓨鍦?active deferred gaps锛宲lan.md 杩樺繀椤绘柊澧?`Deferred Gap Architecture Mapping`锛屽苟鎶婃瘡鏉?gap 鏄犲皠鍒?`architecture_refs`銆乣work_item_refs`銆乣journey_refs`銆乣prod_path_refs`锛堝閫傜敤锛夈€?
**闆嗘垚涓庣鍒扮娴嬭瘯璁″垝锛堝繀椤伙級**

- plan.md **蹇呴』**鍖呭惈**瀹屾暣鐨勯泦鎴愭祴璇曚笌绔埌绔姛鑳芥祴璇曡鍒?*锛岃鐩栨ā鍧楅棿鍗忎綔銆佺敓浜т唬鐮佸叧閿矾寰勩€佺敤鎴峰彲瑙佸姛鑳芥祦绋嬨€?- **涓ョ**娴嬭瘯璁″垝浠呭寘鍚崟鍏冩祴璇曪紱鍗曞厓娴嬭瘯涓哄繀瑕佽ˉ鍏咃紝浣嗕笉寰椾綔涓哄敮涓€楠岃瘉鎵嬫銆?- **涓ョ**鍑虹幇銆屾ā鍧楀唴閮ㄥ疄鐜板畬鏁翠笖鍙€氳繃鍗曞厓娴嬭瘯锛屼絾浠庢湭鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲鎴栬皟鐢ㄣ€嶇殑鎯呭喌鈥斺€旀祴璇曡鍒掑繀椤婚獙璇佹瘡涓ā鍧?*纭疄琚敓浜т唬鐮佸叧閿矾寰勫鍏ュ苟璋冪敤**銆?
### 2.2 瀹¤闂幆

**涓ユ牸搴?*锛?*standard**锛堝崟娆?+ 鎵瑰垽瀹¤鍛橈級锛岃 [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md)銆?
- 鐢熸垚鎴栨洿鏂?plan.md 鍚庯紝**蹇呴』鎸?搂0 绾﹀畾璋冪敤 code-review 鎶€鑳?*锛屼娇鐢?**鍥哄畾瀹¤鎻愮ず璇?*锛歔references/audit-prompts.md](references/audit-prompts.md) 搂2銆?- **浠呭湪** code-review 瀹¤鎶ュ憡缁撹涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆椂**鍙粨鏉熸湰姝ラ**銆?- #### 瀹¤閫氳繃鍚庣粺涓€ Host 鏀跺彛锛堝己鍒讹級
  - **鎶ュ憡璺緞**锛歚specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md`銆?  - 鍙戣捣瀹¤瀛愪换鍔℃椂锛屽彂缁欏瓙 Agent 鐨?prompt 蹇呴』鍖呭惈锛氬璁￠€氳繃鍚庤灏嗘姤鍛婁繚瀛樿嚦 {绾﹀畾璺緞}锛岃矾寰勭敱涓?Agent 鏍规嵁 epic銆乻tory銆乻lug 濉厖銆?  - **缁熶竴鍏ュ彛**锛氬璁￠€氳繃鍚庯紝涓?Agent 缁熶竴璋冪敤 `runAuditorHost`锛涗笉鍐嶆墜宸ユ嫾瑁?plan 闃舵鐨?score / auditIndex CLI銆?  - **璐ｄ换鍒掑垎**锛歝ode-review 瀛愪唬鐞嗕骇鍑烘姤鍛婂苟钀界洏锛涗富 Agent 鍦ㄦ敹鍒伴€氳繃缁撹鍚庤皟鐢?`runAuditorHost`銆備綑鍚?搂1.2锛堝惈 iteration_count 浼犻€掕鍒欍€佸け璐ヨ褰?resultCode锛夈€?- 鑻ユ湭閫氳繃锛氭牴鎹璁℃姤鍛?**杩唬淇敼 plan.md**锛?*鍐嶆璋冪敤 code-review**锛岀洿鑷虫姤鍛婄粨璁轰负閫氳繃銆?- **宓屽叆姝ラ锛堝綋 plan 娑夊強澶氭ā鍧楁垨澶嶆潅鏋舵瀯鏃堕』鎵ц锛?*锛氬湪 plan 瀹¤閫氳繃鍚庛€佹湰姝ラ缁撴潫鍓嶏紝**椤诲皢 `/speckit.checklist` 鎴?`.speckit.checklist` 浣滀负 搂2.2 瀹¤姝ラ鐨勪竴閮ㄥ垎**鎵ц鈥斺€旂敓鎴愯川閲忔鏌ユ竻鍗曪紝楠岃瘉闇€姹傚畬鏁存€с€佹竻鏅板害涓庝竴鑷存€э紱鑻?checklist 鍙戠幇闂锛岄』杩唬淇敼 plan.md 骞?*鍐嶆鎵ц code-review 瀹¤**锛岀洿鑷?checklist 楠岃瘉閫氳繃锛涗笉寰椾互銆屽彲閫夈€嶄负鐢卞湪搴旀墽琛屽満鏅笅璺宠繃銆?
### Plan闃舵鍙€塒arty-Mode

> Party-mode source of truth锛歚{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`
> 鏈妭鍙畾涔変綍鏃跺缓璁繘鍏?party-mode銆傝疆娆″垎绾с€乣designated_challenger_id`銆乣challenger_ratio > 0.60`銆乻ession/meta/snapshot/evidence銆佹仮澶嶄笌閫€鍑洪棬绂侀兘浠?core step-02 涓哄噯銆?
褰撲互涓嬫儏鍐靛嚭鐜版椂锛屽彲鍦╬lan闃舵鍚姩party-mode锛?1. 鐢ㄦ埛鏄庣‘瑕佹眰娣卞叆璁ㄨ鎶€鏈柟妗?2. Create Story闃舵鏈兘鍏呭垎瑙ｅ喅鐨勬妧鏈簤璁?3. 娑夊強閲嶅ぇ鏋舵瀯鍐崇瓥锛堝鏁版嵁搴撻€夊瀷銆佹湇鍔℃媶鍒嗭級

**鍚姩鍛戒护**:
```
杩涘叆party-mode璁ㄨ鎶€鏈柟妗堬紝寤鸿50杞?```

**瑙掕壊璁惧畾**:
- Winston (鏋舵瀯甯?
- Amelia (寮€鍙?
- Quinn (娴嬭瘯)
- 鎵瑰垽瀹¤鍛?(鏂板锛屽己鍒跺弬涓?

**鏀舵暃鏉′欢**:
1. 鎵€鏈夎鑹茶揪鎴愬叡璇?2. 杩?杞棤鏂扮殑鎶€鏈痝ap鎻愬嚭
3. 杈╄杞杈惧埌鏈€灏戣姹傦紙50杞級

---

## 3. 鐢熸垚 tasks 涔嬪墠锛圛MPLEMENTATION_GAPS.md锛?
**瑙﹀彂鏂瑰紡**锛氭棤鐙珛鍛戒护銆傚湪 plan.md 宸查€氳繃瀹¤鍚庯紝**妯″瀷蹇呴』鑷姩鎵ц娣卞害鍒嗘瀽**锛氬鐓?plan.md銆佸師濮嬮渶姹傛枃妗ｄ笌褰撳墠瀹炵幇锛岄€愮珷鑺傞€愭潯姣旇緝宸紓锛岀敓鎴?IMPLEMENTATION_GAPS.md銆傜敤鎴疯姹傘€岀敓鎴?IMPLEMENTATION_GAPS銆嶃€岀敓鎴?GAPS銆嶆椂鍚屾牱瑙﹀彂銆?
### 3.1 蹇呴』瀹屾垚

- 鏍规嵁 **褰撳墠瀹炵幇** 涓?**鍘熷闇€姹傝璁℃枃妗?*锛屾寜 **閫愮珷鑺傘€侀€愭潯** 鍒嗘瀽宸紓锛岀敓鎴?**IMPLEMENTATION_GAPS.md**銆?- **鑻ョ敤鎴锋槑纭粰鍑烘洿澶氬弬鑰冩枃妗?*锛堜緥濡傚崟鐙殑鏋舵瀯璁捐鏂囨。銆佽璁¤鏄庝功绛夛級锛?*蹇呴』**鍚屾椂鎸?**閫愮珷鑺傘€侀€愭潯** 瀵?*鎵€鏈夌粰瀹氬弬鑰冩枃妗?*鍒嗘瀽宸紓锛岀‘淇濆叏閮ㄤ綔涓烘湁鏁堣緭鍏ュ弬涓?Gap 鍒嗘瀽銆?- 鏂囨。缁撴瀯闇€鎸夐渶姹傛枃妗ｏ紙鍙婃墍鏈夊弬鑰冩枃妗ｏ級绔犺妭鍒楀嚭姣忔潯 Gap锛屽苟娉ㄦ槑锛氶渶姹?璁捐绔犺妭銆佸綋鍓嶅疄鐜扮姸鎬併€佺己澶?鍋忓樊璇存槑銆侴ap 鍒楄〃琛ㄥご妯℃澘瑙?[references/mapping-tables.md](references/mapping-tables.md) 搂3銆?- 鑻ュ瓨鍦?deferred gaps锛孖MPLEMENTATION_GAPS.md 杩樺繀椤绘柊澧?`Deferred Gap Lifecycle Classification`锛屽苟鏄惧紡鍖哄垎 `inherited gap`銆乣new gap`銆乣definition gap`銆乣implementation gap`銆乣journey runnable gap`銆乣evidence gap`銆?
### 3.2 瀹¤闂幆

**涓ユ牸搴?*锛?*standard**锛堝崟娆?+ 鎵瑰垽瀹¤鍛橈級锛岃 [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md)銆?
- 鐢熸垚鎴栨洿鏂?IMPLEMENTATION_GAPS.md 鍚庯紝**蹇呴』鎸?搂0 绾﹀畾璋冪敤 code-review 鎶€鑳?*锛屼娇鐢?**鍥哄畾瀹¤鎻愮ず璇?*锛歔references/audit-prompts.md](references/audit-prompts.md) 搂3銆?- **浠呭湪** code-review 瀹¤鎶ュ憡缁撹涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆椂**鍙粨鏉熸湰姝ラ**銆?- #### 瀹¤閫氳繃鍚庣粺涓€ Host 鏀跺彛锛堝己鍒讹級
  - **鎶ュ憡璺緞**锛歚specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_GAPS-E{epic}-S{story}.md`銆?  - 鍙戣捣瀹¤瀛愪换鍔℃椂锛屽彂缁欏瓙 Agent 鐨?prompt 蹇呴』鍖呭惈锛氬璁￠€氳繃鍚庤灏嗘姤鍛婁繚瀛樿嚦 {绾﹀畾璺緞}锛岃矾寰勭敱涓?Agent 鏍规嵁 epic銆乻tory銆乻lug 濉厖銆?  - **缁熶竴鍏ュ彛**锛氬璁￠€氳繃鍚庯紝涓?Agent 缁熶竴璋冪敤 `runAuditorHost`锛涗笉鍐嶆墜宸ユ嫾瑁?gaps 闃舵鐨?score / auditIndex CLI銆?  - **璐ｄ换鍒掑垎**锛歝ode-review 瀛愪唬鐞嗕骇鍑烘姤鍛婂苟钀界洏锛涗富 Agent 鍦ㄦ敹鍒伴€氳繃缁撹鍚庤皟鐢?`runAuditorHost`銆侴APS 鎶ュ憡鏍煎紡涓?plan 鍏煎锛宻tage=gaps銆備綑鍚?搂1.2锛堝惈 iteration_count 浼犻€掕鍒欍€佸け璐ヨ褰?resultCode锛夈€?- 鑻ユ湭閫氳繃锛氭牴鎹璁℃姤鍛?**杩唬淇敼 IMPLEMENTATION_GAPS.md**锛?*鍐嶆璋冪敤 code-review**锛岀洿鑷虫姤鍛婄粨璁轰负閫氳繃銆?
---

## 4. 鎵ц tasks 鎴栫敓鎴?tasks 鐩稿叧 md 鏃讹紙tasks.md锛?
**蹇呴』鎵ц鐨勫懡浠?*锛歚/speckit.tasks` 鎴?`.speckit.tasks` 鎴?鐢ㄦ埛鏄庣‘瑕佹眰銆岀敓鎴?tasks銆嶃€岀敓鎴?tasks.md銆嶏紙鍦?IMPLEMENTATION_GAPS.md 宸茬敓鎴愬悗鎵ц锛?
### 4.1 蹇呴』瀹屾垚

- 瀵圭収 **鍘熷闇€姹傝璁℃枃妗?*銆?*plan.md**銆?*IMPLEMENTATION_GAPS.md** 鐢熸垚 **tasks.md**銆?- 浣跨敤椤圭洰 **tasks 妯℃澘**锛歚_bmad/speckit/templates/tasks-template.md`锛堟垨椤圭洰鍐呯害瀹氱殑妯℃澘璺緞锛夈€?- 鍦?**tasks.md** 涓寜鍘熷闇€姹傛枃妗ｃ€乸lan.md銆両MPLEMENTATION_GAPS.md **閫愮珷鑺傘€侀€愭潯** 澧炲姞 **闇€姹傛槧灏勬竻鍗曡〃鏍?*锛涜〃澶翠笌鍒楀悕瑙?[references/mapping-tables.md](references/mapping-tables.md) 搂4鈥撀?0锛汚gent 鎵ц瑙勫垯銆侀渶姹傝拷婧牸寮忋€侀獙鏀舵爣鍑嗕笌楠屾敹鎵ц瑙勫垯瑙?[references/tasks-acceptance-templates.md](references/tasks-acceptance-templates.md)銆?- tasks.md 椤跺眰蹇呴』鏄?`journey-first`锛氳嚦灏戝寘鍚?`P0 Journey Ledger`銆乣Invariant Ledger`銆乣Runnable Slice Milestones`銆佹寜 Journey 鎷嗗垎鐨?runnable slices銆乣Closure Notes`銆?- 姣忎釜浠诲姟蹇呴』鏄惧紡鎸傛帴 `Journey ID`銆乣Trace ID`銆佷换鍔＄被鍨嬶紱setup / foundational 浠诲姟涓嶅緱鑴辩 Journey 鍗曠嫭瀛樺湪锛屼笖蹇呴』棰濆澹版槑 `Journey Unlock` 涓?`Smoke Path Unlock`銆?- 姣忎釜 runnable slice 蹇呴』澹版槑 `Journey ID`銆乣Invariant ID`锛堟垨 `INV-N/A` + 鍘熷洜锛夈€乣Evidence Type`銆乣Verification Command`銆乣Closure Note Path`銆乣Definition Gap Handling`銆乣Implementation Gap Handling`銆?- tasks.md 涓繀椤诲悓鏃跺瓨鍦?`Journey -> Task -> Test -> Closure` 鏄犲皠琛紝浠ュ強 `Definition Gap vs Implementation Gap` 瀵圭収琛紱鏄犲皠琛ㄤ腑蹇呴』鏄惧紡鍐欏嚭 `Smoke Task Chain` 涓?`Closure Task ID`锛屼袱绫?gap 涓嶅緱娣峰啓鍚庣洿鎺ュ绉板姛鑳藉凡璺戦€氥€?- 鑻?tasks.md 鍚敤 multi-agent 妯″紡锛屽繀椤绘樉寮忚褰?`Shared Journey Ledger Path`銆乣Shared Invariant Ledger Path`銆乣Shared Trace Map Path`锛屽苟寮鸿皟鎵€鏈?agent 浣跨敤鍚屼竴浠?`same path reference`锛岀姝㈠悇鑷骇鐢熺鏈夋憳瑕併€?- 鑻ュ瓨鍦?inherited deferred gaps锛宼asks 闃舵蹇呴』鍚屾椂缁存姢 `deferred-gap-register.yaml`锛屽苟鏂板 `Deferred Gap Task Binding`锛沘ctive gap 蹇呴』浜岄€変竴锛氱粦瀹?task 鎴栧啓 explicit defer reason銆?- 鑻?deferred gap 褰卞搷鏌愭潯 Journey锛宼asks 闃舵蹇呴』鎶婅 gap 鏄犲皠鍒?`Journey ID`銆乣Smoke Task Chain`銆乣Closure Task ID`銆乣Production Path`銆?
**闆嗘垚涓庣鍒扮娴嬭瘯鐢ㄤ緥锛堝繀椤伙級**

- tasks.md **蹇呴』**涓烘瘡鏉?`P0 journey` 鑷冲皯鐢熸垚涓€鏉?`smoke path` 浠诲姟閾撅紝骞舵槑纭?full E2E 鎴?deferred reason銆?- **涓ョ**楠屾敹鏍囧噯浠呬緷璧栧崟鍏冩祴璇曪紱姣忎釜 runnable slice 鐨勯獙鏀?*蹇呴』**鍚屾椂鍖呭惈銆岃妯″潡鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲骞惰皟鐢ㄣ€嶇殑闆嗘垚楠岃瘉銆?- **涓ョ**鍑虹幇銆屾ā鍧楀唴閮ㄥ疄鐜板畬鏁翠笖鍙€氳繃鍗曞厓娴嬭瘯锛屼絾浠庢湭鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲鎴栬皟鐢ㄣ€嶇殑瀛ゅ矝妯″潡浠诲姟琚爣璁颁负瀹屾垚銆?- 姣忔潯 Journey **蹇呴』**鏈?`closure note` 浠诲姟锛涙病鏈?closure note锛屼笉寰楀绉拌 Journey 瀹屾垚銆?
### 4.2 瀹¤闂幆

**涓ユ牸搴?*锛?*standard**锛堝崟娆?+ 鎵瑰垽瀹¤鍛橈級锛岃 [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md)銆?
- 鐢熸垚鎴栨洿鏂?tasks.md 鍚庯紝**蹇呴』鎸?搂0 绾﹀畾璋冪敤 code-review 鎶€鑳?*锛屼娇鐢?**鍥哄畾瀹¤鎻愮ず璇?*锛歔references/audit-prompts.md](references/audit-prompts.md) 搂4銆?- 瀹¤蹇呴』棰濆妫€鏌ワ細task 鏄惁灞炰簬 runnable slice銆佹槸鍚﹀瓨鍦?orphan module task銆佹槸鍚︾己 `Evidence Type` / `Closure Note` / `Trace`銆佹槸鍚﹂仐婕?`re-readiness` 瑙﹀彂鏉′欢銆?- **浠呭湪** code-review 瀹¤鎶ュ憡缁撹涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶆椂**鍙粨鏉熸湰姝ラ**銆?- #### 瀹¤閫氳繃鍚庣粺涓€ Host 鏀跺彛锛堝己鍒讹級
  - **鎶ュ憡璺緞**锛歚specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md`銆?  - 鍙戣捣瀹¤瀛愪换鍔℃椂锛屽彂缁欏瓙 Agent 鐨?prompt 蹇呴』鍖呭惈锛氬璁￠€氳繃鍚庤灏嗘姤鍛婁繚瀛樿嚦 {绾﹀畾璺緞}锛岃矾寰勭敱涓?Agent 鏍规嵁 epic銆乻tory銆乻lug 濉厖銆?  - **缁熶竴鍏ュ彛**锛氬璁￠€氳繃鍚庯紝涓?Agent 缁熶竴璋冪敤 `runAuditorHost`锛涗笉鍐嶆墜宸ユ嫾瑁?tasks 闃舵鐨?score / auditIndex CLI銆?  - **璐ｄ换鍒掑垎**锛歝ode-review 瀛愪唬鐞嗕骇鍑烘姤鍛婂苟钀界洏锛涗富 Agent 鍦ㄦ敹鍒伴€氳繃缁撹鍚庤皟鐢?`runAuditorHost`銆備綑鍚?搂1.2锛堝惈 iteration_count 浼犻€掕鍒欍€佸け璐ヨ褰?resultCode锛夈€?- 鑻ユ湭閫氳繃锛氭牴鎹璁℃姤鍛?**杩唬淇敼 tasks.md**锛?*鍐嶆璋冪敤 code-review**锛岀洿鑷虫姤鍛婄粨璁轰负閫氳繃銆?- **宓屽叆姝ラ锛堝綋 tasks 鏁伴噺鈮?0 鎴栬法澶?artifact 鏃堕』鎵ц锛?*锛氬湪 tasks 瀹¤閫氳繃鍚庛€佹湰姝ラ缁撴潫鍓嶏紝**椤诲皢 `/speckit.analyze` 鎴?`.speckit.analyze` 浣滀负 搂4.2 瀹¤姝ラ鐨勪竴閮ㄥ垎**鎵ц鈥斺€斿仛璺?artifact 涓€鑷存€у垎鏋愶紙spec銆乸lan銆乼asks 绛夊榻愭姤鍛婏級锛涜嫢 analyze 鍙戠幇闂锛岄』杩唬淇敼 tasks.md 骞?*鍐嶆鎵ц code-review 瀹¤**锛岀洿鑷?analyze 楠岃瘉閫氳繃锛涗笉寰椾互銆屽彲閫夈€嶄负鐢卞湪搴旀墽琛屽満鏅笅璺宠繃銆?
### 浠诲姟鍒嗘壒鎵ц鏈哄埗

褰搕asks-E{epic}-S{story}.md涓殑浠诲姟鏁伴噺瓒呰繃20涓椂锛屽繀椤诲垎鎵规墽琛岋細锛?*GAP-044 淇**锛?0 涓虹粡楠岄槇鍊硷紝鍏奸【鍗曟壒鍙鐞嗘€т笌瀹¤鎴愭湰锛涘彲閫氳繃閰嶇疆瑕嗙洊锛?
**鍒嗘壒瑙勫垯**:
- 姣忔壒鏈€澶?0涓换鍔?- 姣忔壒鎵ц瀹屾瘯鍚庤繘琛宑ode-review瀹¤
- 瀹¤閫氳繃鍚庢墠鑳藉紑濮嬩笅涓€鎵?
**鎵ц娴佺▼**:
```
Batch 1: Task 1-20 鈫?鎵ц 鈫?code-review瀹¤ 鈫?閫氳繃
Batch 2: Task 21-40 鈫?鎵ц 鈫?code-review瀹¤ 鈫?閫氳繃
...
Batch N: Task ... 鈫?鎵ц 鈫?code-review瀹¤ 鈫?閫氳繃
```

**妫€鏌ョ偣瀹¤鍐呭**:
1. 鏈壒浠诲姟鏄惁鍏ㄩ儴瀹屾垚
2. 娴嬭瘯鏄惁鍏ㄩ儴閫氳繃
3. 鏄惁鏈夐仐鐣欓棶棰樺奖鍝嶄笅涓€鎵?4. 鏄惁闇€瑕佽皟鏁村悗缁壒娆¤鍒?5. 鏄惁鍑虹幇鈥滄ā鍧楀仛瀹屼簡锛屼絾 Journey 浠嶄笉鍙窇鈥濈殑婕傜Щ

**寮傚父澶勭悊**:
- 濡傛灉鏌愭壒瀹¤鏈€氳繃锛屼慨澶嶅悗閲嶆柊瀹¤璇ユ壒
- 濡傛灉杩炵画涓ゆ壒瀹¤鏈€氳繃锛屾殏鍋滃苟璇勪及鏁翠綋鏂规

### 瀹¤璐ㄩ噺璇勭骇锛圓/B/C/D锛?
鐢变簬speckit鍚勯樁娈典笉寮哄埗瑕佹眰party-mode锛岄€氳繃瀹¤璐ㄩ噺璇勭骇琛ュ伩璐ㄩ噺淇濊瘉锛?
| 璇勭骇 | 鍚箟 | 澶勭悊鏂瑰紡 |
|-----|------|---------|
| **A绾?* | 浼樼锛屽畬鍏ㄧ鍚堣姹?| 鐩存帴杩涘叆涓嬩竴闃舵 |
| **B绾?* | 鑹ソ锛宮inor闂 | 璁板綍闂锛?*鍦ㄦ湰闃舵瀹¤闂幆鍐呭畬鎴愪慨澶?*鍚庤繘鍏ヤ笅涓€闃舵锛涚姝娇鐢ㄣ€屽悗缁€嶃€屽緟瀹氥€嶇瓑妯＄硦琛ㄨ堪 |
| **C绾?* | 鍙婃牸锛岄渶淇敼 | 蹇呴』淇敼鍚庨噸鏂板璁?|
| **D绾?* | 涓嶅強鏍硷紝涓ラ噸闂 | 閫€鍥炰笂涓€闃舵閲嶆柊璁捐 |

**璇勭骇缁村害**:
1. 瀹屾暣鎬э紙30%锛夛細鏄惁瑕嗙洊鎵€鏈夐渶姹傜偣
2. 姝ｇ‘鎬э紙30%锛夛細鎶€鏈柟妗堟槸鍚︽纭?3. 娴嬭瘯楠岃瘉锛?5%锛夛細鐢熶骇浠ｇ爜闆嗘垚娴嬭瘯楠岃瘉銆?*GAP-087 淇**锛氥€屾柊澧炰唬鐮併€? 鏈?Story 鎴栨湰鎵逛换鍔℃柊澧?淇敼鐨勪唬鐮侊紱鏂板浠ｇ爜瑕嗙洊鐜団墺85%锛?4. 璐ㄩ噺锛?5%锛夛細浠ｇ爜/鏂囨。璐ㄩ噺鏄惁杈炬爣

**寮哄埗鍗囩骇瑙勫垯**:
- 杩炵画涓や釜闃舵璇勪负C绾э紝绗笁闃舵寮哄埗杩涘叆party-mode
- 浠讳竴闃舵璇勪负D绾э紝蹇呴』澶嶇洏骞惰€冭檻鍥炲埌Layer 3閲嶆柊Create Story

---

## 5. 鎵ц tasks.md 涓殑浠诲姟锛圱DD 绾㈢豢鐏ā寮忥級

**蹇呴』鎵ц鐨勫懡浠?*锛歚/speckit.implement` 鎴?`.speckit.implement` 鎴?鐢ㄦ埛鏄庣‘瑕佹眰銆屾墽琛?tasks.md銆嶃€屾墽琛?tasks銆嶃€屽畬鎴?tasks 涓殑浠诲姟銆?
褰撶敤鎴疯姹傛墽琛?tasks.md锛堟垨 tasks-v*.md锛変腑鐨勬湭瀹屾垚浠诲姟鏃讹紝**蹇呴』**鎸?TDD 绾㈢伅-缁跨伅-閲嶆瀯寰幆閫愪换鍔℃帹杩涖€?
**銆愭墽琛岄『搴忋€?* 姣忎釜娑夊強鐢熶骇浠ｇ爜鐨勪换鍔★細鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹寰楀け璐ワ紙绾㈢伅锛夛紱鍐嶅啓鐢熶骇浠ｇ爜浣块€氳繃锛堢豢鐏級锛涙渶鍚庨噸鏋勫苟璁板綍銆傜姝㈠厛鍐欑敓浜т唬鐮佸啀琛ユ祴璇曘€?
### 5.1 鎵ц娴佺▼

鍦ㄦ湰闃舵寮€濮嬫墽琛?tasks 鎴栨媺璧蜂换浣曟墽琛屼綋鍓嶏紝涓?Agent 蹇呴』鍏堬細
- 鎵ц `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`锛屾秷璐瑰綋鍓?`orchestrationState` 涓?`pendingPacket`
- 褰?`mainAgentNextAction` 鍙淳鍙戜絾灏氭棤鍙敤 packet 鏃讹紝鎵ц `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
- 閫氳繃 `main-agent-orchestration` 鐢熷懡鍛ㄦ湡鍔ㄤ綔 claim / dispatch packet锛岃€屼笉鏄粫杩?state 鐩存帴娲惧彂
- 姣忔 bounded 瀛愮粨鏋滆繑鍥炲悗锛屼互鍙婃瘡娆?`runAuditorHost` 璋冪敤鍚庯紝閮藉啀娆?`inspect`锛屽啀杩涘叆涓嬩竴鎵逛换鍔℃垨涓嬩竴瀹¤鍒嗘敮

1. **璇诲彇 tasks.md**锛堟垨 tasks-v*.md锛夛紝璇嗗埆鎵€鏈夋湭瀹屾垚浠诲姟锛坄[ ]` 澶嶉€夋锛夈€?2. **銆恟alph-method 寮哄埗鍓嶇疆銆戝垱寤?prd 涓?progress 杩借釜鏂囦欢**锛?   - 鑻ヤ笌 tasks 鍚岀洰褰曟垨 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` 涓嬩笉瀛樺湪 `prd.{stem}.json` 涓?`progress.{stem}.txt`锛?*蹇呴』**鍦ㄥ紑濮嬫墽琛屼换浣曚换鍔″墠鍒涘缓锛?   - stem 涓?tasks 鏂囨。 stem锛堝 tasks-E1-S1 鈫?`tasks-E1-S1`锛涙棤 BMAD 涓婁笅鏂囨椂鐢?tasks 鏂囦欢鍚?stem锛夛紱
   - prd 缁撴瀯椤荤鍚?ralph-method schema锛屽皢 tasks 涓殑鍙獙鏀朵换鍔℃槧灏勪负 US-001銆乁S-002鈥︼紙鎴栦笌 tasks 缂栧彿涓€涓€瀵瑰簲锛夛紱
   - **progress 棰勫～ TDD 妲戒綅**锛氱敓鎴?progress 鏃讹紝瀵规瘡涓?US 棰勫～浠ヤ笅鍗犱綅琛岋紱娑夊強鐢熶骇浠ｇ爜鐨?US 棰勫～ `[TDD-RED] _pending_`銆乣[TDD-GREEN] _pending_`銆乣[TDD-REFACTOR] _pending_`锛涗粎鏂囨。/閰嶇疆鐨?US 棰勫～ `[DONE] _pending_`銆傛墽琛屾椂灏?`_pending_` 鏇挎崲涓哄疄闄呯粨鏋滐紙濡?`[TDD-RED] T1 pytest ... => N failed`锛夛紱
   - 浜у嚭璺緞锛氫笌 tasks 鍚岀洰褰曪紝鎴?`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`锛圔MAD 娴佺▼鏃讹級锛?   - **绂佹**鍦ㄦ湭鍒涘缓涓婅堪鏂囦欢鍓嶅紑濮嬬紪鐮佹垨鎵ц娑夊強鐢熶骇浠ｇ爜鐨勪换鍔°€?3. **闃呰鍓嶇疆鏂囨。**锛氶渶姹傛枃妗ｃ€乸lan.md銆両MPLEMENTATION_GAPS.md锛岀悊瑙ｆ妧鏈灦鏋勪笌闇€姹傝寖鍥淬€?3.0 **璇诲彇 deferred-gap-register**锛氳嫢瀛樺湪 `deferred-gap-register.yaml`锛屽繀椤诲湪鎵ц鍓嶅姞杞斤紱鑻ュ凡澹版槑 inherited deferred gaps 鍗存棤姝ゆ枃浠讹紝涓嶅緱缁х画瀹ｇО浠诲姟瀹屾垚銆?3.1 **璇诲彇 ledger 宸ヤ欢**锛氳嫢瀛樺湪 `journey-ledger.md`銆乣invariant-ledger.md`銆乣trace-map.json`锛屽繀椤诲湪鎵ц鍓嶅姞杞斤紱鑻ヤ粨搴撳皻鏈媶鍒嗙嫭绔嬫枃浠讹紝鍒欎互 tasks.md 涓搴?section 浣滀负浜嬪疄鏉ユ簮锛屽苟鍚屾璇诲彇 `Smoke Task Chain`銆乣Closure Task ID`銆乣Journey Unlock`銆乣Smoke Path Unlock`銆?3.2 **鍏堝尯鍒?gap 绫诲瀷**锛氭墽琛屽墠蹇呴』鏍囪鍝簺浠诲姟鏄湪娑堥櫎 `definition gap`锛屽摢浜涙槸鍦ㄤ慨澶?`implementation gap`锛涙墽琛岃褰曚腑蹇呴』淇濇寔 `Definition Gap Handling` 涓?`Implementation Gap Handling` 鍒嗙锛岀姝㈡贩鍐欏苟鍦ㄥ悓涓€杞噷鐩存帴瀹ｅ竷 Journey 瀹屾垚銆?3.3 **澶?Agent 鍏辩敤宸ヤ欢璺緞**锛氳嫢涓?multi-agent 鎵ц锛屽繀椤诲厛閿佸畾 `Shared Journey Ledger Path`銆乣Shared Invariant Ledger Path`銆乣Shared Trace Map Path`锛屽苟纭鎵€鏈?agent 閮芥秷璐瑰悓涓€浠?`same path reference`锛岀姝㈡敼鍐欎负鍚勮嚜绉佹湁鎽樿銆?4. **浣跨敤 TodoWrite** 鍒涘缓浠诲姟杩借釜鍒楄〃锛岄涓换鍔℃爣璁?`in_progress`銆?5. **閫愪换鍔℃墽琛?TDD 寰幆**锛?*姣忎釜 US 蹇呴』鐙珛鎵ц**锛岀姝粎瀵归涓?US 鎵ц TDD 鍚庡鍚庣画 US 璺宠繃绾㈢伅鐩存帴瀹炵幇锛夛細
   - **绾㈢伅**锛氱紪鍐?琛ュ厖瑕嗙洊褰撳墠浠诲姟楠屾敹鏍囧噯鐨勬祴璇曠敤渚嬶紝杩愯纭**娴嬭瘯澶辫触**锛堥獙璇佹祴璇曟湁鏁堟€э級銆?   - **缁跨伅**锛氱紪鍐欐渶灏戦噺鐢熶骇浠ｇ爜浣挎祴璇曢€氳繃銆?   - **閲嶆瀯**锛氬湪娴嬭瘯淇濇姢涓嬫鏌ュ苟浼樺寲浠ｇ爜璐ㄩ噺锛圫OLID銆佸懡鍚嶃€佽В鑰︺€佹€ц兘锛夈€?*鏃犺鏄惁鏈夊叿浣撻噸鏋勫姩浣滐紝鍧囬』鍦?progress 涓褰?`[TDD-REFACTOR]` 涓€琛?*锛涙棤鍏蜂綋閲嶆瀯鏃跺啓"鏃犻渶閲嶆瀯 鉁?锛岄泦鎴愪换鍔″啓"鏃犳柊澧炵敓浜т唬鐮侊紝鍚勬ā鍧楃嫭绔嬫€у凡楠岃瘉锛屾棤璺ㄦā鍧楅噸鏋?鉁?銆?6. **瀹屾垚鍚庣珛鍗虫洿鏂?* tasks.md 涓殑澶嶉€夋 `[ ]` 鈫?`[x]`锛孴odoWrite 鏍囪 `completed`銆?6.1 **Journey 鏀跺彛**锛氭瘡褰撲竴涓?`P0 journey` 杈惧埌 smoke runnable 鐘舵€侊紝蹇呴』绔嬪嵆瀹屾垚鎴栨洿鏂板搴?`Closure Task ID` 鎸囧悜鐨?`closure note`锛屽苟鏍″ `Smoke Task Chain` 宸查棴鍚堬紱closure note 蹇呴』鍐欐槑 covered journey id銆乮mplementing task ids銆乻moke test ids銆乫ull E2E ids 鎴?deferred reason銆佹湭瑙ｅ喅 deferred gaps銆?6.2 **Deferred Gap 鏀跺彛**锛氳嫢浠诲姟鍏抽棴浜嗘煇鏉?deferred gap锛屽繀椤诲悓姝ュ啓鍏?`deferred-gap-register.yaml` 鐨?`closure_evidence`锛涜嫢缁х画寤舵湡锛屽繀椤诲悓姝ュ啓鍏?`carry_forward_evidence`銆佹柊 `resolution_target` 涓?closure note 鎽樿銆?7. **妫€鏌ョ偣楠岃瘉**锛氶亣鍒版鏌ョ偣鏃堕獙璇佹墍鏈夊墠缃换鍔″凡瀹屾垚锛屾墽琛屽洖褰掓祴璇曘€?7.1. **lint锛堝繀椤伙級**锛氭瘡瀹屾垚涓€鎵逛换鍔℃垨鍏ㄩ儴浠诲姟瀹屾垚鍓嶏紝椤圭洰椤绘寜鎶€鏈爤鎵ц Lint锛堣 lint-requirement-matrix锛夛紱鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint 椤讳慨澶嶏紱宸查厤缃殑椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶄负鐢辫眮鍏嶃€?7.2. **re-readiness 瑙﹀彂**锛氳嫢鏈壒鍙樻洿瑙﹀強 `P0 journey`銆佸畬鎴愭€佸畾涔夈€佷緷璧栬涔夈€佹潈闄愯竟鐣屻€乫ixture / environment 鍋囪锛屽繀椤诲洖鍒?readiness 閲嶆柊纭鍚庡啀缁х画鎺ㄨ繘 implement 缁撹銆?8. **寰幆**鐩磋嚦鎵€鏈変换鍔″畬鎴愶紝绂佹鎻愬墠鍋滄銆?
### 5.1.1 tasks 涓?prd 鐨勬槧灏勭害瀹?
- tasks 浣跨敤 T1銆乀2銆乀1.1銆乀1.2 绛夋牸寮忔椂锛氬彲灏?T1 鏄犲皠涓?US-001锛孴1.1鈥揟1.n 浣滀负 US-001 鐨勫瓙浠诲姟锛涙垨鎸夐《灞備换鍔?T1鈥揟5 鏄犲皠涓?US-001鈥揢S-005锛?- prd 鐨?userStories 椤讳笌 tasks 涓殑鍙獙鏀朵换鍔′竴涓€瀵瑰簲鎴栧彲杩芥函锛?- 鍏蜂綋鏄犲皠绛栫暐鐢辨墽琛?Agent 鍦ㄧ敓鎴?prd 鏃剁‘瀹氾紝浣嗛』淇濊瘉 tasks 涓瘡鏉″彲楠屾敹浠诲姟鍦?prd 涓湁瀵瑰簲 US 涓旈獙鏀舵爣鍑嗕竴鑷淬€?
### TDD绾㈢豢鐏褰曟牸寮忥紙涓巄mad-story-assistant缁熶竴锛?
**缁熶竴鏍煎紡妯℃澘**:
```markdown
## Task X: 瀹炵幇YYY鍔熻兘

**绾㈢伅闃舵锛圷YYY-MM-DD HH:MM锛?*
[TDD-RED] TX pytest tests/test_xxx.py -v => N failed
[閿欒淇℃伅鎽樿]

**缁跨伅闃舵锛圷YYY-MM-DD HH:MM锛?*
[TDD-GREEN] TX pytest tests/test_xxx.py -v => N passed
[瀹炵幇瑕佺偣鎽樿]

**閲嶆瀯闃舵锛圷YYY-MM-DD HH:MM锛?*
[TDD-REFACTOR] TX [閲嶆瀯鎿嶄綔鎻忚堪 | 鏃犻渶閲嶆瀯 鉁?| 闆嗘垚浠诲姟: 鏃犳柊澧炵敓浜т唬鐮侊紝鍚勬ā鍧楃嫭绔嬫€у凡楠岃瘉 鉁揮
[浼樺寲鐐规憳瑕乚

**鏇存柊ralph-method杩涘害**
- prd.md: US-00X passes=true
- progress.md: 娣诲姞TDD璁板綍閾炬帴
```

**蹇呭～瀛楁**:
1. `[TDD-RED]` - 鏍囪绾㈢伅闃舵寮€濮?2. `[TDD-GREEN]` - 鏍囪缁跨伅闃舵瀹屾垚
3. `[TDD-REFACTOR]` - 鏍囪閲嶆瀯闃舵锛堝繀椤昏褰曞垽鏂粨鏋滐紝鏃犺鏄惁鏈夊叿浣撻噸鏋勫姩浣滐紱绂佹鐪佺暐姝よ锛?4. `TX` - 鏃堕棿鎴冲墠缂€
5. 娴嬭瘯鍛戒护鍜岀粨鏋?6. ralph-method杩涘害鏇存柊

**绂佹浜嬮」**:
- 璺宠繃绾㈢伅闃舵鐩存帴缁跨伅
- 鐪佺暐閲嶆瀯闃舵
- 涓嶆洿鏂皉alph-method杩涘害

### 5.2 瀹¤闂幆

**涓ユ牸搴﹀垎绾?*锛堝紩鐢?[references/audit-post-impl-rules.md](references/audit-post-impl-rules.md)锛夛細
- **batch 闂村璁?*锛堟瘡鎵?tasks 瀹屾垚鍚庣殑涓棿妫€鏌ョ偣锛夛細**standard**锛堝崟娆?+ 鎵瑰垽瀹¤鍛橈級锛屼笉蹇?3 杞€?- **鏈€缁?搂5.2 瀹¤**锛堝叏閮?tasks 鎵ц瀹屾瘯鍚庣殑鎬诲璁★級锛?*strict**锛屽繀椤昏繛缁?3 杞棤 gap + 鎵瑰垽瀹¤鍛?>50%銆?
- 鎵ц tasks.md 涓殑浠诲姟锛圱DD 绾㈢豢鐏ā寮忥級鍚庯紝**蹇呴』鎸?搂0 绾﹀畾璋冪敤 code-review 鎶€鑳?*锛屼娇鐢?**鍥哄畾瀹¤鎻愮ず璇?*锛歔references/audit-prompts.md](references/audit-prompts.md) 搂5銆?- **batch 闂?*锛氬崟娆￠€氳繃涓旀壒鍒ゅ璁″憳娈佃惤鍚堟牸鍗冲彲锛?*鏈€缁堝璁?*锛氶』杩炵画 3 杞棤 gap 鏀舵暃锛岃瑙?audit-post-impl-rules銆?- 涓?Agent 鍦ㄥ彂璧风 2銆? 杞璁″墠锛屽彲杈撳嚭銆岀 N 杞璁￠€氳繃锛岀户缁獙璇佲€︺€嶄互鎻愮ず鐢ㄦ埛銆?- #### 瀹¤閫氳繃鍚庣粺涓€ Host 鏀跺彛锛堝己鍒讹級
  - **鎶ュ憡璺緞**锛歚{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_implement-E{epic}-S{story}.md`锛堜笌 _bmad/_config/eval-lifecycle-report-paths.yaml 涓€鑷达級锛泂tage=implement锛圫tory 9.2 鎵╁睍锛屾浛浠ｅ師 stage=tasks + triggerStage=speckit_5_2锛夈€?  - 鍙戣捣瀹¤瀛愪换鍔℃椂锛屽彂缁欏瓙 Agent 鐨?prompt 蹇呴』鍖呭惈锛氬璁￠€氳繃鍚庤灏嗘姤鍛婁繚瀛樿嚦 {绾﹀畾璺緞}锛岃矾寰勭敱涓?Agent 鏍规嵁 epic銆乻tory銆乻lug 濉厖銆?  - **缁熶竴鍏ュ彛**锛氬璁￠€氳繃鍚庯紝涓?Agent 缁熶竴璋冪敤 `runAuditorHost`锛涗笉鍐嶆墜宸ユ嫾瑁?implement 闃舵鐨?score / auditIndex CLI銆?  - **璐ｄ换鍒掑垎**锛歝ode-review 瀛愪唬鐞嗕骇鍑哄璁℃姤鍛婂苟钀界洏鑷充笂杩拌矾寰勶紱涓?Agent 鍦ㄦ敹鍒伴€氳繃缁撹鍚庤皟鐢?`runAuditorHost`锛涘け璐ヤ笉闃绘柇涓绘祦绋嬶紝璁板綍 resultCode 杩涘璁¤瘉鎹€?*iteration_count 浼犻€掞紙寮哄埗锛?*锛氭墽琛屽璁″惊鐜殑 Agent 鍦?pass 鏃朵紶鍏ュ綋鍓嶇疮璁″€硷紙鏈?stage 瀹¤鏈€氳繃/fail 鐨勮疆鏁帮級锛涗竴娆￠€氳繃浼?0銆?*standalone speckit** 娴佺▼锛堟棤 epic/story锛夋椂锛屼富 Agent 鍦?pass 鏃跺悓鏍蜂紶鍏?`--iteration-count {绱鍊紏`銆?- 鑻ユ湭閫氳繃锛氭牴鎹璁℃姤鍛?**杩唬鎵ц tasks.md 涓璁℃湭閫氳繃鐨勪换鍔?*锛?*鍐嶆璋冪敤 code-review**锛岀洿鑷虫姤鍛婄粨璁轰负閫氳繃銆?- batch 闂村璁″繀椤婚澶栨鏌ワ細鏄惁缂哄け closure note銆佹槸鍚﹀瓨鍦?`module complete but journey not runnable` 婕傜Щ銆佹槸鍚﹀嚭鐜板簲瑙﹀彂鑰屾湭瑙﹀彂鐨?`re-readiness`銆?
**闆嗘垚涓庣鍒扮娴嬭瘯鎵ц锛堝繀椤伙級**

- 鎵ц闃舵**蹇呴』**杩愯闆嗘垚娴嬭瘯涓庣鍒扮鍔熻兘娴嬭瘯锛岄獙璇佹ā鍧楅棿鍗忎綔涓庣敤鎴峰彲瑙佸姛鑳芥祦绋嬪湪鐢熶骇浠ｇ爜鍏抽敭璺緞涓婂伐浣滄甯搞€?*涓ョ**浠呰繍琛屽崟鍏冩祴璇曞嵆瀹ｅ竷瀹屾垚銆?- **蹇呴』**楠岃瘉姣忎釜鏂板鎴栦慨鏀圭殑妯″潡**纭疄琚敓浜т唬鐮佸叧閿矾寰勫鍏ャ€佸疄渚嬪寲骞惰皟鐢?*锛堜緥濡傦細grep 鐢熶骇浠ｇ爜 import 璺緞銆佹鏌?UI 鍏ュ彛鏄惁鎸傝浇銆佹鏌?Engine/涓绘祦绋嬫槸鍚﹀疄闄呰皟鐢級銆?- 鍙戠幇銆屾ā鍧楀唴閮ㄥ疄鐜板畬鏁翠笖鍙€氳繃鍗曞厓娴嬭瘯锛屼絾浠庢湭鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲鎴栬皟鐢ㄣ€嶇殑鎯呭喌鏃讹紝**蹇呴』**灏嗗叾浣滀负 **鏈€氳繃椤?* 鎶ュ憡骞朵慨澶嶏紝鑰岄潪鏍囪涓洪€氳繃銆?- 姣忎釜 `P0 journey` 鍦ㄥ璁″墠蹇呴』鏈?`closure note`锛涜嫢 full E2E 寤跺悗锛宑losure note 涓繀椤诲啓鏄?deferred reason 涓?next gate銆?- 姣忎釜 `P0 journey` 鍦ㄥ璁″墠杩樺繀椤诲叿澶?`Production Path` 涓?`Acceptance Evidence`锛涚己浠讳竴椤癸紝涓嶅緱瀹ｇО鐪熷疄鍔熻兘宸茶惤鍦般€?
### 5.3 鍏抽敭绾︽潫锛?5 鏉￠搧寰嬫憳瑕侊級

鎵ц鏃跺繀椤婚伒瀹堝畬鏁寸害鏉熻鍒欙紝璇﹁ [references/task-execution-tdd.md](references/task-execution-tdd.md)銆傛牳蹇冭鐐癸細

**鏋舵瀯涓庨渶姹傚繝瀹炴€?*
- 涓ユ牸鎸夋枃妗ｈ褰曠殑鎶€鏈灦鏋勫拰閫夊瀷瀹炴柦锛?*绂佹**鎿呰嚜淇敼銆?- 涓ユ牸鎸夋枃妗ｈ褰曠殑闇€姹傝寖鍥村拰鍔熻兘鑼冨洿瀹炴柦锛?*绂佹**浠ユ渶灏忓疄鐜颁负鐢卞亸绂婚渶姹傘€?
**绂佹浼疄鐜?*
- **绂佹**鍋囧畬鎴愩€佷吉瀹炵幇銆佸崰浣嶅疄鐜般€?- **绂佹**鏍囪瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤鎴栨湭鍦ㄥ叧閿矾寰勪腑浣跨敤銆?
**娴嬭瘯涓庡洖褰?*
- 涓诲姩淇娴嬭瘯鑴氭湰锛岀姝互鏃犲叧涓虹敱閫冮伩銆?- 涓诲姩杩涜鍥炲綊娴嬭瘯锛岀姝㈡帺鐩栧姛鑳藉洖閫€闂銆?
**娴佺▼瀹屾暣鎬?*
- pytest 绛夐暱鏃堕棿鑴氭湰浣跨敤 `block_until_ms: 0`锛岃疆璇?`terminals/` 妫€鏌ョ粨鏋溿€?- 濡傞渶鍙傝€冭璁★紝鏌ョ湅鍓嶇疆闇€姹傛枃妗?plan鏂囨。/IMPLEMENTATION_GAPS鏂囨。銆?- 鍦ㄦ墍鏈夋湭瀹屾垚浠诲姟鐪熸瀹炵幇骞跺畬鎴愪箣鍓?*绂佹**鍋滄寮€鍙戝伐浣溿€?
---

## 6. Agent 鎵ц瑙勫垯锛坧lan.md / tasks.md 蹇呴』閬靛畧锛?
鐢熸垚 plan.md 涓?tasks.md 鏃讹紝闄や笂杩版槧灏勪笌瀹¤澶栵紝**杩樺繀椤?* 閬靛畧浠ヤ笅 Agent 鎵ц瑙勫垯锛堜笌 QA_Agent 浠诲姟鎵ц鏈€浣冲疄璺?搂397鈥?09 涓€鑷达級锛?
**绂佹浜嬮」**

1. 绂佹鍦ㄤ换鍔℃弿杩颁腑娣诲姞銆屾敞: 灏嗗湪鍚庣画杩唬...銆嶃€?2. 绂佹鏍囪浠诲姟瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤銆?3. 绂佹浠呭垵濮嬪寲瀵硅薄鑰屼笉鍦ㄥ叧閿矾寰勪腑浣跨敤銆?4. 绂佹鐢ㄣ€岄鐣欍€嶃€屽崰浣嶃€嶇瓑璇嶈閬垮疄鐜般€?5. **绂佹**妯″潡鍐呴儴瀹炵幇瀹屾暣涓斿彲閫氳繃鍗曞厓娴嬭瘯锛屼絾浠庢湭鍦ㄧ敓浜т唬鐮佸叧閿矾寰勪腑琚鍏ャ€佸疄渚嬪寲鎴栬皟鐢紙銆屽宀涙ā鍧椼€嶅弽妯″紡锛夈€?6. **绂佹**浠呬娇鐢ㄥ崟鍏冩祴璇曢獙鏀朵换鍔★紱闆嗘垚娴嬭瘯涓庣鍒扮鍔熻兘娴嬭瘯涓哄繀椤婚獙鏀堕」銆?
**蹇呴』浜嬮」**

1. 闆嗘垚浠诲姟蹇呴』淇敼鐢熶骇浠ｇ爜璺緞銆?2. 蹇呴』杩愯楠岃瘉鍛戒护纭鍔熻兘鍚敤銆?3. 閬囧埌鏃犳硶瀹屾垚鐨勬儏鍐碉紝搴旀姤鍛婇樆濉炶€岄潪鑷寤惰繜銆?4. 鍔熻兘/閰嶇疆/UI 鐩稿叧浠诲姟瀹炴柦鍓嶅繀椤诲厛妫€绱㈠苟闃呰闇€姹傛枃妗ｇ浉鍏崇珷鑺傦紙搂9 闇€姹傝拷婧笌闂幆锛夈€?5. 闇€姹傝拷婧紙瀹炴柦鍓嶅繀濉級锛氶棶棰樺叧閿瘝銆佹绱㈣寖鍥淬€佺浉鍏崇珷鑺傘€佹棦鏈夌害瀹氭憳瑕併€佹柟妗堟槸鍚︿笌闇€姹備竴鑷淬€?
### Enforcement璇存槑锛堢姝簨椤规鏌ヨ矗浠伙級

**鍚勯樁娈电姝簨椤瑰強妫€鏌ヨ矗浠讳汉**:

| 闃舵 | 绂佹浜嬮」 | 妫€鏌ヨ矗浠讳汉 | 妫€鏌ユ柟寮?|
|-----|---------|-----------|---------|
| specify | 浼疄鐜?| code-reviewer | 浠ｇ爜瀹℃煡 |
| specify | 鑼冨洿钄撳欢 | code-reviewer | 瀵规瘮Story鏂囨。 |
| plan | 鏃犳祴璇曡鍒?| code-reviewer | 妫€鏌lan-E{epic}-S{story}.md |
| plan | 杩囧害璁捐 | code-reviewer | 鏋舵瀯鍚堢悊鎬ц瘎浼?|
| GAPS | 閬楁紡鍏抽敭宸窛 | code-reviewer | 瀹屾暣鎬ф鏌?|
| tasks | 浠诲姟涓嶅彲鎵ц | code-reviewer | 鍙鎬ц瘎浼?|
| 鎵ц | 璺宠繃TDD绾㈢伅 | bmad-story-assistant | 妫€鏌DD璁板綍 |
| 鎵ц | 鐪佺暐閲嶆瀯 | bmad-story-assistant | 妫€鏌DD璁板綍 |

**杩濊澶勭悊**:
1. 棣栨杩濊锛氳鍛婂苟瑕佹眰绔嬪嵆淇
2. 閲嶅杩濊锛氭殏鍋滄墽琛岋紝杩斿洖涓婁竴闃舵
3. 涓ラ噸杩濊锛氳褰曞苟涓婃姤缁橞Mad Master

**璞佸厤鏉′欢**:
- 缁弍arty-mode璁ㄨ涓€鑷村悓鎰?- 鏈夋槑纭殑ADR璁板綍鍐崇瓥鐞嗙敱
- 鑾峰緱鎵瑰垽瀹¤鍛樿鍙?
**Ralph-Wiggum 娉曞垯**

- 绂佹鍋囪瀹屾垚锛岀姝㈡帺鐩栦吉瀹炵幇鐨勪簨瀹烇紝绂佹浠ユ椂闂磋繃闀夸负鐢遍€冮伩浠诲姟銆?- 鍦ㄦ墍鏈変换鍔¤鐪熸楠屾敹骞舵爣璁颁负瀹屾垚涔嬪墠锛岀姝㈤€€鍑恒€?
瀹屾暣 Agent 鎵ц瑙勫垯涓庨渶姹傝拷婧牸寮忚 [references/qa-agent-rules.md](references/qa-agent-rules.md)銆?
---

## 7. 娴佺▼灏忕粨

**銆怐ev Story瀹屾暣娴佺▼ - 涓嶅彲璺宠繃浠讳綍姝ラ銆?*

```
Layer 3: Create Story
    鈫?Layer 4: speckit-workflow锛坈onstitution 鈫?specify 鈫?plan 鈫?GAPS 鈫?tasks 鈫?implement锛?    鈫?Layer 5: 鏀跺熬涓庨泦鎴?```

| speckit闃舵 | 浜у嚭 | 瀹¤渚濇嵁 | bmad瀵瑰簲闃舵 | 璇存槑 |
|------------|------|---------|-------------|------|
| specify | spec-E{epic}-S{story}.md | audit-prompts.md 搂1 | Layer 4寮€濮?| 鎶€鏈鏍煎寲Story鍐呭锛涙枃浠跺悕蹇呭惈Epic/Story搴忓彿 |
| plan | plan-E{epic}-S{story}.md | audit-prompts.md 搂2 | Layer 4缁х画 | 鍒跺畾瀹炵幇鏂规锛涙枃浠跺悕蹇呭惈Epic/Story搴忓彿 |
| GAPS | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | audit-prompts.md 搂3 | Layer 4缁х画 | 璇嗗埆瀹炵幇宸窛锛涙枃浠跺悕蹇呭惈Epic/Story搴忓彿 |
| tasks | tasks-E{epic}-S{story}.md | audit-prompts.md 搂4 | Layer 4缁х画 | 鎷嗚В鎵ц浠诲姟锛涙枃浠跺悕蹇呭惈Epic/Story搴忓彿 |
| 鎵ц | 鍙繍琛屼唬鐮?| audit-prompts.md 搂5 | Layer 4缁撴潫 | TDD绾㈢豢鐏紑鍙?|

**鏂囨。鍛藉悕瑙勫垯**锛氫骇鍑烘枃浠跺悕蹇呴』鍖呭惈 Epic 搴忓彿銆丼tory 搴忓彿锛汦pic 鍚嶇О锛堝 feature-metrics-cache锛夊湪璺緞鎴栨枃妗ｅ厓鏁版嵁涓綋鐜般€傜ず渚嬶細Epic 4 Story 1 鈫?spec-E4-S1.md銆乸lan-E4-S1.md銆?
姣忔銆岃凯浠ｃ€嶅潎涓猴細**鎸?搂0 绾﹀畾璋冪敤 code-review 鎶€鑳?* 鈫?鑾峰緱瀹¤鎶ュ憡 鈫?鑻ユ湭閫氳繃鍒欎慨鏀瑰搴旀枃妗?鈫?**鍐嶆璋冪敤 code-review** 鈫?鐩磋嚦鎶ュ憡缁撹涓哄畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆倀asks 鎵ц闃舵鍚岀悊锛歍DD 绾㈢豢鐏惊鐜?鈫?閫愪换鍔″畬鎴?鈫?妫€鏌ョ偣楠岃瘉 鈫?**鎸?搂0 璋冪敤 code-review 鎶€鑳?* 鈫?鐩磋嚦鎶ュ憡缁撹涓洪€氳繃銆?
---

## 8. Speckit 娴佺▼鍛戒护绱㈠紩锛堝繀椤绘墽琛岋級

| 闃舵 | 蹇呴』鎵ц鐨勫懡浠?| 鍓嶇疆鏉′欢 | 浜у嚭 | 瀹¤渚濇嵁 |
|------|----------------|----------|------|----------|
| **0. constitution** | `/speckit.constitution` 鎴?`.speckit.constitution` | 鏃狅紙鍏ュ彛闃舵锛?| constitution.md 鎴?.specify/memory/constitution.md | 椤圭洰鑷畾涔夋垨閫氱敤鏂囨。瀹屾暣鎬?|
| **1. specify** | `/speckit.specify` 鎴?`.speckit.specify` | constitution 宸蹭骇鍑?| spec.md | audit-prompts.md 搂1 |
| **2. plan** | `/speckit.plan` 鎴?`.speckit.plan` | spec.md 宸查€氳繃瀹¤ | plan.md | audit-prompts.md 搂2 |
| **3. GAPS** | 鏃犵嫭绔嬪懡浠わ紱妯″瀷鑷姩娣卞害鍒嗘瀽锛堝鐓?plan + 闇€姹?+ 褰撳墠瀹炵幇锛夋垨 鐢ㄦ埛瑕佹眰銆岀敓鎴?IMPLEMENTATION_GAPS銆?| plan.md 宸查€氳繃瀹¤ | IMPLEMENTATION_GAPS.md | audit-prompts.md 搂3 |
| **4. tasks** | `/speckit.tasks` 鎴?`.speckit.tasks` 鎴?鐢ㄦ埛瑕佹眰銆岀敓鎴?tasks銆?| IMPLEMENTATION_GAPS.md 宸查€氳繃瀹¤ | tasks.md | audit-prompts.md 搂4 |
| **5. 鎵ц** | `/speckit.implement` 鎴?`.speckit.implement` 鎴?鐢ㄦ埛瑕佹眰銆屾墽琛?tasks銆嶃€屽畬鎴?tasks 涓殑浠诲姟銆?| tasks.md 宸查€氳繃瀹¤ | 鍙繍琛屼唬鐮?+ 娴嬭瘯 | audit-prompts.md 搂5 |

**鍛戒护鎵ц椤哄簭**锛? 鈫?1 鈫?2 鈫?3 鈫?4 鈫?5锛屼笉鍙烦杩囥€俢onstitution 椤诲湪 specify 涔嬪墠瀹屾垚锛涙瘡闃舵浜у嚭蹇呴』閫氳繃 code-review 瀹¤锛埪?锛夊悗鏂瑰彲杩涘叆涓嬩竴闃舵銆?
**澧炲己鍛戒护锛堥』宓屽叆鐩稿簲瀹¤闂幆杩唬鍐呮墽琛岋紝浣滀负瀹¤姝ラ鐨勪竴閮ㄥ垎锛屼笉寰椾互銆屽彲閫夈€嶄负鐢辫烦杩囷級**锛?
| 鍛戒护 | 宓屽叆鐜妭 | 瑙﹀彂鏉′欢 | 鐢ㄩ€?|
|------|----------|----------|------|
| `/speckit.clarify` | **搂1.2 spec 瀹¤闂幆杩唬鍐?* | 搂1.2 瀹¤鎶ュ憡鎸囧嚭銆宻pec 瀛樺湪妯＄硦琛ㄨ堪銆?| 婢勬竻 鈫?鏇存柊 spec 鈫?鍐嶆 搂1.2 瀹¤ |
| `/speckit.checklist` | **搂2.2 plan 瀹¤闂幆鍐?* | plan 娑夊強澶氭ā鍧楁垨澶嶆潅鏋舵瀯 | 浣滀负 搂2.2 瀹¤姝ラ鐨勪竴閮ㄥ垎锛涜嫢鍙戠幇闂鍒欒凯浠?plan 鈫?鍐嶆瀹¤ |
| `/speckit.analyze` | **搂4.2 tasks 瀹¤闂幆鍐?* | tasks鈮?0 鎴栬法澶?artifact | 浣滀负 搂4.2 瀹¤姝ラ鐨勪竴閮ㄥ垎锛涜嫢鍙戠幇闂鍒欒凯浠?tasks 鈫?鍐嶆瀹¤ |

**鍛戒护鏍煎紡璇存槑**锛?- `/speckit.xxx`锛欳ursor/Claude 鏂滄潬鍛戒护锛坈onstitution銆乻pecify銆乸lan銆乼asks銆乮mplement銆乧larify銆乤nalyze銆乧hecklist锛?- `.speckit.xxx`锛氱偣鍛戒护鎴栭」鐩唴 `.speckit.xxx` 鏂囦欢瑙﹀彂
- **GAPS 鏃犵嫭绔嬪懡浠?*锛氭ā鍨嬪湪 plan 閫氳繃鍚庤嚜鍔ㄦ繁搴﹀垎鏋愮敓鎴愶紱鎴栫敤鎴疯姹傘€岀敓鎴?IMPLEMENTATION_GAPS銆嶆椂瑙﹀彂

---

## 9. 鍥哄畾妯℃澘涓庡弬鑰冩枃浠?
| 鐢ㄩ€?| 鏂囦欢 |
|------|------|
| **鎶€鑳戒緷璧?* | **code-review**锛堟垨 requesting-code-review锛夛細瀹¤闂幆蹇呴』鏄惧紡璋冪敤锛岃 搂0 |
| 瀹¤鎻愮ず璇嶏紙鍙鍒讹級 | [references/audit-prompts.md](references/audit-prompts.md) |
| 鏄犲皠琛ㄥ垪鍚嶄笌缁撴瀯 | [references/mapping-tables.md](references/mapping-tables.md) |
| Tasks 楠屾敹涓庢墽琛屾ā鏉?| [references/tasks-acceptance-templates.md](references/tasks-acceptance-templates.md) |
| Agent 鎵ц瑙勫垯锛堝畬鏁达級 | [references/qa-agent-rules.md](references/qa-agent-rules.md) |
| **Tasks 鎵ц TDD 瑙勫垯锛堝畬鏁达級** | **[references/task-execution-tdd.md](references/task-execution-tdd.md)** |
| 瀹炴柦鍚庡璁¤鍒欙紙strict锛?| [references/audit-post-impl-rules.md](references/audit-post-impl-rules.md) |
| audit_convergence 閰嶇疆 | [references/audit-config-schema.md](references/audit-config-schema.md)锛涙牎楠岃剼鏈?`_bmad/speckit/scripts/powershell/validate-audit-config.ps1` |
| **Speckit 鍛戒护绱㈠紩** | 瑙?搂8 |
