# AGENTS.md

## Karpathy-Inspired Guidelines

- Think Before Coding: Wrong assumptions, hidden confusion, missing tradeoffs
- Simplicity First: Overcomplication, bloated abstractions
- Surgical Changes: Orthogonal edits, touching code you shouldn't
- Goal-Driven Execution: Leverage through tests-first, verifiable success criteria

## Hard Delivery Gate: Real 8h Development Evidence

- For this project delivery, "8h evidence" means a real 8-hour main-agent development run-loop executing this repository's actual requirement-development workflow.
- A wall-clock heartbeat soak, empty timer, mock journey, contract fixture, deterministic replay, or background idle process is not acceptable completion evidence.
- Valid evidence must show real task/pending-packet consumption, orchestration state transitions, gate execution, runtime heartbeat/lease/recovery records, and final delivery-truth-gate evaluation from the same 8h run.
- Do not claim final completion, release readiness, or non-half-finished delivery until the real 8h development run evidence exists and `main-agent:delivery-truth-gate` allows completion.
- If only heartbeat soak evidence exists, report it as partial runtime evidence and explicitly state that the real 8h development evidence is still missing.

## User Rules

- Multiple Roles: 澶氳鑹茶瑙掑垎鏋愬拰璇勫
- Output Style: 绠€娲併€佺洿鎺ャ€佸彲鎵ц
- Language Rules: 鍐呴儴寮€鍙戣繃绋嬩腑鐨勮瑷€浠ヤ腑鏂囦紭鍏?
## 鎰忓浘婢勬竻

閫傜敤鏉′欢锛氫笉纭畾鎬у彲閫氳繃蹇€熸壂鎻?+ 涓€杞彁闂秷闄ゃ€?
1. 寮€鍦哄榻愶紙鎵ц鍓嶅繀鍋氾級锛氬厛鍚戠敤鎴峰洖鏄锯€滄垜鐞嗚В鐨勭洰鏍?鑼冨洿/涓嶅仛/鍏抽敭鍋囪鈥?2. 璇锋眰瑙勮寖鍖栵紙Prompt Refinement锛夛細灏嗙敤鎴峰師濮嬭姹傛敹鏁涗负鍙墽琛屾憳瑕侊紙鐩爣/鑼冨洿/涓嶅仛/楠屾敹锛?3. 蹇€熸壂鎻忥細Glob/Grep 璇嗗埆鐩稿叧鏂囦欢
4. 鍏抽敭鎻愰棶锛氭湁鐤戦棶鏃舵彁闂苟绛夊緟鍥炵瓟
5. 鐢熸垚鏂规锛氬熀浜庡洖绛旇緭鍑虹洰鏍囥€佽寖鍥淬€乄HEN/THEN 琛屼负瑙勬牸銆侀獙鏀舵爣鍑嗐€佷笉鍋氶」
6. 鎵ц锛氶渶姹傛槑纭笖瀹炵幇璺緞鍞竴鏃剁洿鎺ュ紑濮嬶紱娑夊強涓氬姟鍐崇瓥/鍏抽敭杈撳叆缂哄け/閲嶅ぇ姝т箟鏃剁瓑寰呯敤鎴风‘璁ゅ悗寮€濮?
鎻愰棶瑙勫垯锛?- `Lite` 涓旈渶姹傛槑纭€佸疄鐜拌矾寰勫敮涓€锛氫笉鎻愰棶锛岀洿鎺ユ墽琛?- `Standard/Full` 涓旈渶姹傛槑纭€佸疄鐜拌矾寰勫敮涓€锛氬紑鍦哄榻愬悗鐩存帴鎵ц
- 娑夊強涓氬姟鍐崇瓥銆佺己灏戝叧閿緭鍏ャ€佹垨瀛樺湪澶氭柟妗堟潈琛★細涓€娆℃€ф彁鍑哄叏閮ㄥ叧閿棶棰樺苟绛夊緟纭
- 宸茶繘鍏?`superpowers:brainstorming` 鏃讹紝鎸夊叾瑙勫垯鏀逛负鈥滀竴娆′竴闂€?- `AskUserQuestion` 涓嶅彲鐢ㄦ椂锛屾敼涓烘櫘閫氭枃鏈彁闂苟鏆傚仠鎵ц绛夊緟鐢ㄦ埛鍥炲

闇€姹傛ā绯娿€佽法妯″潡浜や簰鎴栧瓨鍦ㄥ涓璁″垎姝ф椂锛岃皟鐢?`superpowers:brainstorming` 鏀舵暃杈圭晫銆?
## 閫氱敤閫€鍑烘爣鍑?
鎵€鏈変换鍔′氦浠樺墠閫愰」妫€鏌ワ紙鎶€鑳戒笓灞為€€鍑烘爣鍑嗕粎杩藉姞锛屼笉鏇夸唬锛夛細

| # | 鏍囧噯 | 妫€鏌ユ柟寮?|
|---|------|---------|
| 1 | 璇锋眰鍥炵湅 | 閫愭潯瀵圭収鍘熷璇锋眰锛屾爣璁?Done/Partial/Skipped |
| 2 | 浜у嚭鐗╁洖璇?| 瀹￠槄鎵€鏈夌敓鎴愬唴瀹癸紝妫€鏌ラ仐婕?閿欒 |
| 3 | 楠岃瘉璇佹嵁 | 鎻愪緵鍛戒护 + 杈撳嚭鎽樿锛屾垨璇存槑鏃犳硶楠岃瘉鍘熷洜 |
| 4 | 璐ㄩ噺闂ㄧ | 鎸?`rules/code-quality.md` 妫€鏌ワ細姝ｇ‘鎬р啋瀹夊叏鈫掓€ц兘鈫掑彲缁存姢鎬э紙鎸夐€傜敤鎬ч獙璇侊級 |

鏈€氳繃鍒欒嚜鍔ㄤ慨澶嶏紝鏈€澶?3 杞紱浠嶅け璐ュ繀椤绘槑纭畫浣欓闄╋紝绂佹闅愯棌銆?
## 浠诲姟杩借釜

榛樿鐢?`skills/superagents/SKILL.md` 鐨勭紪鎺掍笌杩借釜瑙勫垯鎵ц銆?
- 蹇€熻矾寰勪换鍔★細鎸?`rules/fast-path.md` 鎵ц锛屽彲璺宠繃浠诲姟杩借釜
- 澶嶆潅浠诲姟锛堚墺3 姝ユ垨璺ㄥ鏂囦欢锛夛細浣跨敤 TaskCreate/TaskUpdate/TaskList
- 鎵€鏈夋。浣嶈矾寰勶紙Lite/Standard/Full锛夐兘蹇呴』婊¤冻鏈€灏忚拷韪細姝ラ鐘舵€佸彲瑙併€侀樆濉炲叧绯诲彲瑙併€佸畬鎴愯瘉鎹彲杩芥函

## 鐢ㄦ埛浜や簰鍐崇瓥

浠ヤ笅涓?`rules/output-style.md` 纭瑙勫垯鐨勮ˉ鍏咃紙鍓嶈€呯鈥滄槸鍚︾‘璁も€濓紝姝ゅ绠♀€滄槸鍚﹁闂柟鍚戔€濓級锛?
| 鍦烘櫙 | 琛屼负 |
|------|------|
| 鎶€鏈柟妗堝敮涓€ | 鐩存帴鎵ц |
| 2-3 涓瓑浠锋柟妗?| 鎺ㄨ崘棣栭€?+ 绠€鐭姣旓紝AskUserQuestion |
| 娑夊強涓氬姟鍐崇瓥 | 蹇呴』 AskUserQuestion |
| 缂哄皯鍏抽敭杈撳叆 | 蹇呴』 AskUserQuestion |
| 鐢ㄦ埛璇粹€滃府鎴戝喅瀹氣€?| 鍒嗘瀽鍚庣粰鎺ㄨ崘锛屼笉鍙嶉棶 |

琛ュ厖锛歚AskUserQuestion` 涓嶅彲鐢ㄦ椂锛屼娇鐢ㄦ櫘閫氭枃鏈竴娆℃€ф彁闂紙鏈€澶?3 涓叧閿棶棰橈級骞剁瓑寰呯敤鎴风‘璁ゃ€?
## Superpowers 浣跨敤鍑嗗垯

- 姣忔鍝嶅簲鍓嶅繀椤诲厛璋冪敤 `superpowers:using-superpowers`锛堣 `CLAUDE.md`锛?- 鍥哄畾椤哄簭锛歚using-superpowers` 鈫?閫夋嫨鏈€灏?Skill 闆嗗悎 鈫?鎵ц瀵瑰簲 Skill 鈫?楠岃瘉涓庝氦浠?- 鎵€鏈夎姹傚己鍒惰繘鍏?`superagents`锛堣嚜鍔ㄨЕ鍙戯紝鏃犻渶鏄惧紡 `$superagents`锛?- `superagents` 鍐呴儴鎸夊鏉傚害璧?`Lite/Standard/Full` 涓夋。娴佺▼
- `answer/git/github/handoff/fix-bug/develop-feature/refactor/review-code/architecture-review` 浠呬綔涓?`superagents` 鍐呴儴 lane
- 瑙勫垯鍐茬獊浼樺厛绾э細瀹夊叏 > 姝ｇ‘鎬?> 鐢ㄦ埛鏄庣‘瑕佹眰 > `CLAUDE.md` 寮哄埗椤?> 鍏朵綑瑙勫垯/鎶€鑳借鏄?
鍏蜂綋鍦烘櫙鏄犲皠涓庣紪鎺掔粏鑺備互 `skills/superagents/SKILL.md` 涓哄噯銆?
## Agent 鍗忎綔

鑱岃矗杈圭晫淇濇寔涓ゅ眰锛?
- Skill锛氳礋璐ｈ矾鐢变笌娴佺▼缂栨帓
- Agent锛氳礋璐ｅ崟涓€鑱岃矗鎵ц锛坮esearch/plan/implement/review/verify/report锛?
### 瀛愪唬鐞嗘ā鍨嬬瓥鐣?
- 瀛愪唬鐞嗘ā鍨嬪厑璁镐娇鐢?`gpt-5.5`銆乣gpt-5.4` 涓?`gpt-5.3-codex`銆?- 榛樿浼樺厛浣跨敤 `gpt-5.5`锛涘鏋滃綋鍓嶈繍琛屾椂宸ュ叿灞傛湭鏆撮湶 `gpt-5.5`锛屽垯浣跨敤鏈€楂樺彲鐢ㄦā鍨?`gpt-5.4`銆?- 浠呭綋浠诲姟浠ヤ唬鐮佸疄鐜般€佹祴璇曚慨澶嶃€佸眬閮ㄩ噸鏋勩€佸崟妯″潡闃呰涓庡垎鏋愪负涓伙紝涓斾笉闇€瑕佸鏉傝法妯″潡鎺ㄧ悊鏃讹紝鎵嶅彲浣跨敤 `gpt-5.3-codex`銆?- `reasoning_effort` 浠呭厑璁镐娇鐢?`high` 鎴?`xhigh`锛涘鏉傚害鏈夋涔夋椂锛屼竴寰嬩笂璋冧负 `xhigh`銆?
濮旀淳鍘熷垯锛堝叏灞€鏈€灏忕害鏉燂級锛?
- 涓?agent 鍙繚鐣欙細缂栨帓鍐崇瓥銆佺敤鎴蜂氦浜掋€佷换鍔″崗璋冦€佹渶缁堟眹鎬?- 鍙娲惧伐浣滈粯璁ゅ娲撅紝閬垮厤涓讳笂涓嬫枃鑶ㄨ儉
- 澶?Agent 骞跺彂銆佽鑹插垎宸ャ€佸啿绐佸鐞嗕互 `skills/superagents/SKILL.md` 涓哄噯

## 鏂囦欢寮曠敤瑙勮寖

寮曠敤椤圭洰鍐呮枃浠舵椂浣跨敤鐩稿璺緞锛?- Rules: `rules/code-quality.md`銆乣rules/fast-path.md`
- Skills: `skills/develop-feature/SKILL.md`
- Agents: `agents/reviewer.md`

閬垮厤浠呭啓鏂囦欢鍚嶏紙濡?`code-quality.md`锛夛紝纭繚鍙拷婧€?
## 涓柇鎭㈠

鎶€鑳芥墽琛屼腑鏂椂璋冪敤 `handoff`锛堣瑙佸叾 SKILL.md锛夈€?
