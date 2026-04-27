---
name: bmad-standalone-tasks
description: |
  Codex CLI / OMC 鐗?BMAD Standalone Tasks 閫傞厤鍏ュ彛銆?  浠?Cursor bmad-standalone-tasks 涓鸿涔夊熀绾匡紝鎸夈€孴ASKS/BUGFIX 鏂囨。鍓嶇疆瀹¤ 鈫?瑙ｆ瀽鏈畬鎴愪换鍔?鈫?瀛愪唬鐞嗗疄鏂?鈫?瀹炴柦鍚庡璁°€嶆墽琛?TASKS/BUGFIX 鏂囨。椹卞姩鐨勫疄鏂芥祦绋嬨€?  涓?Agent 鍙戣捣浠讳竴瀛愪换鍔℃椂**蹇呴』**灏嗘湰 skill 鍐呰闃舵鐨勩€屽畬鏁?prompt 妯℃澘銆嶆暣娈靛鍒跺苟濉叆鍗犱綅绗﹀悗浼犲叆锛岀姝㈢渷鐣ャ€佹鎷垨鑷鏀瑰啓鎻愮ず璇嶏紱
  涓?Agent 绂佹鐩存帴淇敼鐢熶骇浠ｇ爜锛屽疄鏂介』閫氳繃 Agent tool 瀛愪唬鐞嗭紙subagent_type: general-purpose锛夈€?  `auditor-tasks-doc` 灞炰簬 TASKS/BUGFIX 鏂囨。鍓嶇疆瀹¤锛屽繀椤诲厛浜庡疄鏂芥墽琛岄€氳繃锛涘疄鏂藉悗瀹¤浼樺厛 `.codex/agents/auditors/auditor-implement`锛屾寜 Fallback 閾鹃檷绾с€?  閬靛惊 ralph-method锛坧rd.{stem}.json / progress.{stem}.txt锛夈€乀DD 绾㈢豢鐏€乻peckit-workflow銆?  閫傜敤鍦烘櫙锛氱敤鎴锋彁渚?TASKS/BUGFIX 鏂囨。骞惰姹傛墽琛屾湭瀹屾垚浠诲姟銆傚叏绋嬩腑鏂囥€?when_to_use: |
  Use when: 鐢ㄦ埛璇淬€屾寜 TASKS_xxx.md 涓殑鏈畬鎴愪换鍔″疄鏂姐€嶃€屾寜 BUGFIX_xxx.md 瀹炴柦銆嶆垨鎻愪緵 TASKS/BUGFIX 鏂囨。璺緞瑕佹眰鎵ц銆?
> **Orphan standalone closeout contract**锛氬綋 TASKS / BUGFIX 鏂囨。浣嶄簬 `_orphan/` 璺緞鏃讹紝缁撴瀯鍖栧璁℃姤鍛婂繀椤绘樉寮忔彁渚?`stage=standalone_tasks`銆乣artifactDocPath`銆乣reportPath`锛涗笉寰楃户缁娇鐢?`stage=document` 浣滀负 orphan closeout 杩斿洖鍊笺€傜己澶变换涓€瀛楁鎴栦粎鏈?PASS 鏂囨湰鏃讹紝涓?Agent 涓嶅緱杩涘叆瀹炵幇鎵ц锛宧ost closeout 蹇呴』 fail-closed銆?references:
  - auditor-tasks-doc: TASKS 鏂囨。鍓嶇疆瀹¤鎵ц浣擄紱`.codex/agents/auditors/auditor-tasks-doc.md`
  - auditor-implement: 瀹炴柦鍚庡璁℃墽琛屼綋锛沗.codex/agents/auditors/auditor-implement.md`
  - speckit-implement: 瀹炴柦鎵ц浣擄紱`.codex/agents/speckit-implement.md`
  - audit-post-impl-rules: 瀹炴柦鍚庡璁¤鍒欙紱`.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - audit-document-iteration-rules: 鏂囨。瀹¤杩唬瑙勫垯锛沗.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - ralph-method: prd銆乸rogress 鏂囦欢锛屾寜 US 椤哄簭鎵ц
  - speckit-workflow: 绂佹浼疄鐜般€佸繀椤昏繍琛岄獙鏀跺懡浠ゃ€佹灦鏋勫繝瀹?  - prompt-templates: `.codex/skills/bmad-standalone-tasks/references/prompt-templates.md`
---

# Claude Adapter: bmad-standalone-tasks

## Purpose

鏈?skill 鏄?Cursor `bmad-standalone-tasks` 鍦?Codex CLI / OMC 鐜涓嬬殑缁熶竴閫傞厤鍏ュ彛銆?
## 涓?Agent 缂栨帓闈紙寮哄埗锛?
浜や簰妯″紡涓嬶紝鍦ㄤ富 Agent 鍚姩銆佹仮澶嶆垨鏀跺彛 `standalone_tasks` 鎵ц閾句箣鍓嶏紝蹇呴』鍏堣鍙栵細

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect
```

濡傞渶鐢熸垚姝ｅ紡娲惧彂璁″垝锛屽垯璇诲彇锛?
```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan
```

`mainAgentNextAction / mainAgentReady` 浠呬负 compatibility summary锛涚湡姝ｆ潈濞佺姸鎬佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
鐩爣涓嶆槸绠€鍗曞鍒?Cursor skill锛岃€屾槸锛?
1. **缁ф壙 Cursor 宸查獙璇佺殑 standalone 浠诲姟鎵ц璇箟**锛堜粠 TASKS/BUGFIX 鏂囨。鍓嶇疆瀹¤ 鈫?鎻愬彇鏈畬鎴愪换鍔?鈫?瀛愪唬鐞嗗疄鏂?鈫?瀹炴柦鍚庡璁★級
2. **鍦?Codex no-hooks 杩愯鏃朵腑灏嗘墽琛屼綋鏄犲皠鍒?`.codex/agents/` 绯诲垪**锛堝璁?鈫?`auditor-implement`銆乣auditor-tasks-doc`锛涘疄鏂?鈫?`speckit-implement` 鎴栭€氱敤鎵ц浣擄級
3. **鎺ュ叆浠撳簱涓凡寮€鍙戝畬鎴愮殑 handoff銆乻coring銆乧ommit gate 鏈哄埗**
4. **纭繚鍦?Codex CLI 涓兘瀹屾暣銆佽繛缁€佹纭湴鎵ц standalone 浠诲姟娴佺▼**

## Host Guard锛堝繀椤诲厛鎵ц锛?
鑻ュ綋鍓嶅疄闄呭涓绘槸 **Cursor IDE**锛屾垨璋冪敤涓婁笅鏂囨槑鏄句娇鐢?Cursor 璇箟锛堜緥濡?`Codex worker adapter`銆乣general-purpose`銆乣Codex worker dispatch`锛屾垨璋冪敤鏂规槑纭鈥滃湪 Cursor 瀹夸富涓墽琛屸€濓級锛屽垯锛?
1. **绔嬪嵆鍋滄**鏈?Codex adapter 鐨勫悗缁墽琛?2. 杈撳嚭浠ヤ笅鍥哄畾鎻愮ず锛?
```text
HOST_MISMATCH: 褰撳墠璇姞杞戒簡 Claude 鐗?bmad-standalone-tasks锛屼絾瀹為檯瀹夸富鏄?Cursor銆傝鏀圭敤 ``.codex`/skills/bmad-standalone-tasks/SKILL.md`銆?```

3. **绂佹**缁х画鎵ц鏈?Codex adapter 鐨?`L1/L2/L3/L4` Fallback 闄嶇骇閫昏緫
4. **绂佹**杈撳嚭浠讳綍鍩轰簬 `.codex/agents/speckit-implement.md`銆乣auditor-implement`銆乣Agent tool` 鐨勯檷绾ч€氱煡

鍙湁鍦?**Codex CLI / OMC** 瀹夸富涓紝鎵嶅厑璁哥户缁墽琛屾湰鏂囦欢鍚庣画鍐呭銆?
---

## 鏍稿績楠屾敹鏍囧噯

Claude 鐗?`bmad-standalone-tasks` 蹇呴』婊¤冻锛?
- 鑳戒綔涓?Codex CLI 鐨?**standalone 浠诲姟鎵ц鍏ュ彛**锛岀粺涓€绠＄悊瑙ｆ瀽鈫掑疄鏂解啋瀹¤闂幆
- 鍚勯樁娈电殑鎵ц鍣ㄩ€夋嫨銆乫allback銆佽瘎鍒嗗啓鍏ュ潎涓?Cursor 宸查獙璇佹祦绋嬭涔変竴鑷?- 瀹屾暣鎺ュ叆鏈粨鏂板鐨勶細
  - auditor-tasks-doc銆乤uditor-implement 鎵ц浣?  - 璇勫垎鍐欏叆锛坄parse-and-write-score.ts`锛?  - handoff 鍗忚
- 涓嶅緱灏?Codex Canonical Base銆丆laude Runtime Adapter銆丷epo Add-ons 娣峰啓涓烘潵婧愪笉鏄庣殑閲嶅啓鐗?prompt
- **涓?Agent 绂佹鐩存帴淇敼鐢熶骇浠ｇ爜**锛團R20a锛?
---

## Codex Canonical Base

浠ヤ笅鍐呭缁ф壙鑷?Cursor `bmad-standalone-tasks`锛屽睘浜庝笟鍔¤涔夊熀绾匡紝Claude 鐗堜笉寰楁搮鑷噸鍐欏叾鎰忓浘銆?
Execute unfinished work from a **single TASKS or BUGFIX document** in a single session. Implementation and code edits are **only** done by subagents; the main Agent orchestrates and audits.

### When to use

- User says: **"/bmad 鎸?{鐢ㄦ埛杈撳叆鐨勬枃妗 涓殑鏈畬鎴愪换鍔″疄鏂?** or equivalent (e.g. "鎸?BUGFIX_xxx.md 瀹炴柦", "鎸?TASKS_xxx.md 鎵ц").
- Input: one **document path** (TASKS_*.md, BUGFIX_*.md, or similar task list with clear items and acceptance).

### 鍙€夎緭鍏ヤ笌澶氭枃妗ｇ害瀹?
- **宸ヤ綔鐩綍**锛氭湭鎸囧畾鏃堕粯璁や负椤圭洰鏍癸紱鑻ョ敤鎴锋寚瀹氬伐浣滅洰褰曪紝涓?Agent 灏?DOC_PATH 瑙ｆ瀽涓鸿鐩綍涓嬬殑鐩稿鎴栫粷瀵硅矾寰勩€?- **鍒嗘敮鍚?*锛氳嫢 ralph-method 鐨?prd 闇€瑕?branchName锛屽彲鐢卞瓙浠ｇ悊浠庢枃妗ｆ垨鐜鎺ㄦ柇锛屾垨鐢辩敤鎴锋樉寮忔彁渚涖€?- **澶氭枃妗ｅ苟瀛?*锛氳嫢鐢ㄦ埛鍚屾椂鎻愬強澶氫唤 TASKS/BUGFIX 鏂囨。锛屼互鐢ㄦ埛**棣栨鏄庣‘鎸囧畾鐨勫崟浠芥枃妗?*涓哄噯锛沺rd/progress 鍛藉悕浠呴殢璇ユ枃妗?stem锛岄伩鍏嶅悓鐩綍澶氫换鍔′氦鍙夊鑷存枃浠惰鐩栥€?
### 鍓嶇疆锛氳В鏋愭湭瀹屾垚浠诲姟娓呭崟

涓?Agent 鍦ㄥ彂璧峰疄鏂藉瓙浠诲姟鍓嶉』瑙ｆ瀽鏂囨。骞剁‘瀹氭湭瀹屾垚椤癸細浠庢枃妗ｄ腑璇嗗埆浠诲姟鍒楄〃锛堝 搂7 浠诲姟琛ㄣ€佹湭鍕鹃€夐」銆佹爣娉?TODO/鏈畬鎴愮殑鑺傦級锛涜嫢鏂囨。鏃犳樉寮忔湭瀹屾垚鏍囪锛屽垯鎸夋枃妗ｅ唴浠诲姟/US 椤哄簭涓庡悓鐩綍 progress 鏂囦欢瀵规瘮锛?*鏈湪 progress 涓嚭鐜颁笖鏈湪 prd 涓爣璁?passes 鐨勮涓烘湭瀹屾垚**锛屽苟灏嗚娓呭崟浼犲叆 Step 1 鐨?prompt銆俻rogress 鏂囦欢鍛藉悕涓庢枃妗?stem 涓€鑷达細`progress.{stem}.txt`锛屼笌 ralph-method 绾﹀畾鐩稿悓銆?
### Hard constraints (non-negotiable)

1. **Implementation only via subagent**
   All production and test code changes must be done through Agent tool subagent锛坄subagent_type: general-purpose`锛? 涓?Agent 绂佹鐩存帴缂栬緫鐢熶骇浠ｇ爜鈥斺€斾笉寰楀鐢熶骇浠ｇ爜鎵ц `search_replace`銆乣write`銆乣edit`銆?
2. **ralph-method**
   - Create and maintain **prd** and **progress** in the same directory as the reference document (naming: `prd.{stem}.json`, `progress.{stem}.txt` when document is e.g. `BUGFIX_foo.md`).
   - After **each** completed User Story (US): update prd (`passes=true` for that US), append to progress (timestamped story log).
   - Execute US in order.

3. **TDD 绾㈢豢鐏紙red鈥揼reen鈥搑efactor锛?*
   For each US: write or extend tests first (绾㈢伅/red) 鈫?implement until tests pass (缁跨伅/green) 鈫?refactor. No marking done without passing tests.

4. **speckit-workflow**
   No placeholders or pseudo-implementation; run acceptance commands from the document; architecture must stay faithful to the BUGFIX/TASKS document.

5. **Forbidden**
   - Do not add "灏嗗湪鍚庣画杩唬" (or similar) in task descriptions.
   - Do not mark a task complete if the behavior is not actually invoked or verified.

### 涓?Agent 浼犻€掓彁绀鸿瘝瑙勫垯锛堝繀瀹堬級

姣忔鍙戣捣瀛愪换鍔★紙Agent tool锛夋椂锛屼富 Agent **蹇呴』**閬靛畧浠ヤ笅瑙勫垯锛屽惁鍒欏瓙浠ｇ悊鏄撳洜鎻愮ず璇嶄笉瀹屾暣鑰屽亸绂绘湰 skill 瑕佹眰锛?
1. **浣跨敤瀹屾暣妯℃澘**锛氫娇鐢ㄦ湰 skill 涓闃舵鎻愪緵鐨勩€屽畬鏁?prompt 妯℃澘銆嶏紱**绂佹**鑷姒傛嫭銆佺缉鍐欐垨鏀瑰啓銆?2. **鏁存澶嶅埗**锛氬皢妯℃澘**鏁存澶嶅埗**鍒板瓙浠诲姟鐨?`prompt` 鍙傛暟涓紝**绂佹**鍙紶銆岃鐐广€嶆垨銆屽弬鑰冧笅鏂广€嶃€?3. **鏇挎崲鍗犱綅绗?*锛氬皢妯℃澘涓殑鍗犱綅绗︼紙濡?`{DOC_PATH}`銆乣{TASK_LIST}`锛?*鍏ㄩ儴**鏇挎崲涓哄疄闄呭唴瀹瑰悗鍐嶄紶鍏ャ€?4. **鑷鍚庡啀鍙戣捣**锛氳嫢璇ラ樁娈垫湁銆屽彂璧峰墠鑷娓呭崟銆嶏紝涓?Agent 鍦ㄥ彂璧峰墠**蹇呴』**閫愰」纭鍚庡啀鍙戣捣銆?5. **绂佹姒傛嫭**锛氫富 Agent 涓嶅緱灏嗘ā鏉挎鎷负瑕佺偣鎴栥€屽弬鑰冩妧鑳芥煇鑺傘€嶏紱瀛愪换鍔?prompt 涓繀椤诲寘鍚闃舵妯℃澘鐨勫畬鏁存鏂囷紙鍗犱綅绗﹀凡鏇挎崲锛夈€傝嫢鏈暣娈靛鍒跺鑷村瓙浠诲姟浜у嚭涓嶇鍚堟妧鑳借姹傦紝涓?Agent 椤婚噸鏂板彂璧峰苟鏁存澶嶅埗銆?6. **閿欒绀轰緥**锛堝潎涓嶇鍚堟暣娈靛鍒惰姹傦級锛歱rompt 涓粎鍐欍€岃鎸?bmad-standalone-tasks 瀹炴柦妯℃澘鎵ц銆嶏紱銆岃鍙傝€?standalone-tasks 鎶€鑳?Step 1 閮ㄥ垎銆嶏紱銆岀害鏉熻涓婃枃銆嶃€?7. **姝ｇ‘绀轰緥**锛歱rompt 涓寘鍚闃舵瀹屾暣 prompt 妯℃澘鍏ㄦ枃锛堝惈鎵€鏈夋钀斤級锛屼笖鍗犱綅绗﹀凡鍏ㄩ儴鏇挎崲锛涘彂璧峰墠宸叉寜璇ラ樁娈点€屽彂璧峰墠鑷娓呭崟銆嶉€愰」纭骞惰緭鍑鸿嚜妫€缁撴灉銆?8. **鑷寮哄埗**锛氭湭瀹屾垚璇ラ樁娈靛叏閮ㄨ嚜妫€椤逛笖鏈湪鍙戣捣鍓嶈緭鍑鸿嚜妫€缁撴灉鏃讹紝涓嶅緱鍙戣捣瀛愪换鍔★紱绂佹鍏堝彂璧峰悗琛ヨ嚜妫€銆傝嚜妫€缁撴灉椤绘寜缁熶竴鏍煎紡杈撳嚭锛屼緥濡傦細銆屻€愯嚜妫€瀹屾垚銆慡tep 1锛氬凡鏁存澶嶅埗瀹炴柦妯℃澘锛涘崰浣嶇 [宸叉浛鎹?鍒楀嚭]锛涘彲浠ュ彂璧枫€傘€?
---

## Codex no-hooks Runtime Adapter

### 鎵ц浣撳眰绾т笌 Fallback Strategy

鏈?skill 娑夊強涓ょ被鎵ц浣撹皟鐢細**瀹炴柦鎵ц浣?*鍜?*瀹¤鎵ц浣?*銆侰laude/OMC 鐜涓嬬殑鎵ц鍣ㄩ€夋嫨鎸変互涓?4 灞備紭鍏堢骇锛?
#### 瀹炴柦鎵ц浣擄紙Step 1锛?
| 灞傜骇 | 鎵ц浣?| 璇存槑 |
|------|--------|------|
| L1 | `.codex/agents/speckit-implement.md` prompt 鈫?Agent tool (`subagent_type: general-purpose`) | 涓昏矾寰勶細鏁存浼犲叆 speckit-implement agent 浣滀负瀹屾暣 prompt |
| L2 | 閫氱敤 Agent tool (`subagent_type: general-purpose`) + 鍐呰仈瀹炴柦 prompt | 鍥為€€锛氭棤 speckit-implement 鏃剁洿鎺ヤ紶鍏ユ湰 skill Step 1 prompt |
| L3 | 涓?Agent 鐩存帴鎵ц | 鏈€缁堝洖閫€锛氫粎褰?L1/L2 鍧囦笉鍙敤鏃?|

#### 瀹¤鎵ц浣擄紙Step 2锛氬疄鏂藉悗瀹¤锛?
| 灞傜骇 | 鎵ц浣?| 璇存槑 |
|------|--------|------|
| L1 | `.codex/agents/auditors/auditor-implement.md` prompt 鈫?Agent tool (`subagent_type: general-purpose`) | 涓昏矾寰?|
| L2 | Codex-native reviewer `code-reviewer` | OMC 瀹¤鍥為€€ |
| L3 | `.codex/skills/speckit-workflow/` 涓?`code-review` skill | skill 绾у洖閫€ |
| L4 | 涓?Agent 鐩存帴鎵ц鍚屼竴浠戒笁灞傜粨鏋?prompt | 鏈€缁堝洖閫€ |

#### 鍓嶇疆鏂囨。瀹¤鎵ц浣擄紙瀹炴柦鍓嶅繀鍋?Step 0锛?
| 灞傜骇 | 鎵ц浣?| 璇存槑 |
|------|--------|------|
| L1 | `.codex/agents/auditors/auditor-tasks-doc.md` prompt 鈫?Agent tool (`subagent_type: general-purpose`) | 涓昏矾寰勶紱**蹇呴』鍏堜簬瀹炴柦鎵ц閫氳繃** |
| L2 | 閫氱敤 Agent tool + 瀹¤ prompt | 鍥為€€ |
| L3 | 涓?Agent 鐩存帴鎵ц | 鏈€缁堝洖閫€ |

**Fallback 闄嶇骇閫氱煡**锛團R26锛夛細褰撴墽琛屼綋浠?L1 闄嶇骇鍒?L2/L3/L4 鏃讹紝涓?Agent **蹇呴』**鍚戠敤鎴疯緭鍑洪檷绾ч€氱煡锛岃鏄庡綋鍓嶄娇鐢ㄧ殑鎵ц浣撳眰绾с€備緥濡傦細
- 銆屸殸锔?宸蹭粠 L1 (auditor-implement) 闄嶇骇鍒?L2 (OMC code-reviewer) 鎵ц瀹¤銆?- 銆屸殸锔?宸蹭粠 L1 (speckit-implement) 闄嶇骇鍒?L2 (閫氱敤 Agent tool) 鎵ц瀹炴柦銆?
### Runtime Contracts

- 姣忔璋冪敤瀛愪唬鐞嗗墠杈撳嚭 **CLI Calling Summary**锛? 瀛楁锛夛細

```yaml
=== CLI Calling Summary ===
Input: {杈撳叆鍙傛暟/鏂囨。璺緞}
Template: {浣跨敤鐨?prompt 妯℃澘鍚峿
Output: {棰勬湡浜у嚭}
Fallback: {闄嶇骇鏂规}
Acceptance: {楠屾敹鏍囧噯}
```

- 姣忎釜 step 缁撴潫杈撳嚭 **YAML Handoff**锛?
```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl|standalone_audit
  batch: {褰撳墠鎵规}
artifacts:
  tasks_doc: {TASKS 鏂囨。璺緞}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - {涓嬩竴姝ユ搷浣渳
handoff:
  next_action: implement_next_batch|post_batch_audit|commit_gate|revise_tasks_doc
  next_agent: bmad-standalone-tasks|auditor-implement|bmad-master|auditor-tasks-doc
  ready: true|false
  mainAgentNextAction: dispatch_implement|dispatch_review|dispatch_remediation|run_closeout|await_user
  mainAgentReady: true|false
```

### Main Agent responsibilities

- **Do**: Resolve document path, read task list, **launch Agent tool subagent** (implementation and audit), pass full context, **collect and summarize** subagent output.
- **Do**: If subagent returns incomplete, launch a **resume** Agent tool with the same agent ID or a new invocation with continuation context; do **not** replace the subagent by editing code yourself.
- **Do not**: Edit production or test code (including any path listed in the TASKS/BUGFIX document as implementation target).
- **Do not**: Directly edit `prd.{stem}.json` or `progress.{stem}.txt` (maintained by subagent per ralph-method).

---

## Step 1: Implementation sub-task

**Tool**: Agent tool
**subagent_type**: `general-purpose`

### 鍙戣捣鍓嶈嚜妫€娓呭崟

- [ ] DOC_PATH 宸插～鍏ワ紙缁濆璺緞鎴栫浉瀵归」鐩牴锛?- [ ] TASK_LIST 宸蹭粠鏂囨。瑙ｆ瀽骞跺～鍏?- [ ] 宸茶緭鍑?CLI Calling Summary
- [ ] 妯℃澘宸叉暣娈靛鍒讹紙闈炴憳瑕侊級

### CLI Calling Summary 绀轰緥

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={鏂囨。璺緞}, TASK_LIST={浠诲姟鑼冨洿}
Template: Step 1 Implementation Prompt
Output: 宸插畬鎴?US銆侀獙鏀剁粨鏋溿€乸rd/progress 鏇存柊
Fallback: L2 閫氱敤 Agent tool + 鍐呰仈 prompt
Acceptance: 鎵€鏈?US passes=true + TDD 璁板綍瀹屾暣
```

### Prompt template锛堟暣娈靛鍒讹紝鏇挎崲鍗犱綅绗﹀悗浼犲叆锛?
```
**鍓嶇疆锛堝繀椤伙級**锛氳鍏堣鍙栧苟閬靛惊浠ヤ笅鎶€鑳藉啀鎵ц涓嬫柟浠诲姟锛?- **ralph-method**锛歱rd/progress 鍛藉悕涓?schema锛堜笌褰撳墠鏂囨。鍚岀洰褰曘€乸rd.{stem}.json / progress.{stem}.txt锛夈€佹瘡瀹屾垚涓€ US 鏇存柊 prd 涓?progress銆?- **speckit-workflow**锛歍DD 绾㈢豢鐏€?5 鏉￠搧寰嬨€侀獙鏀跺懡浠ゃ€佹灦鏋勫繝瀹烇紱绂佹浼疄鐜颁笌鍗犱綅銆?锛堟妧鑳藉彲浠庡綋鍓嶇幆澧冨彲鐢ㄦ妧鑳戒腑鍔犺浇锛涜嫢鏃犳硶瀹氫綅鍒欐寜鏈?prompt 涓嬪垪绾︽潫鎵ц銆傦級

浣犳鍦ㄦ寜 **TASKS/BUGFIX 鏂囨。** 鎵ц鏈畬鎴愪换鍔°€傚繀椤讳弗鏍奸伒寰互涓嬬害鏉燂紝涓嶅緱杩濆弽銆?
## 鏂囨。涓庤矾寰?- **TASKS/BUGFIX 鏂囨。璺緞**锛歿DOC_PATH}锛堣浣跨敤缁濆璺緞鎴栫浉瀵归」鐩牴鐨勮矾寰勮繘琛岃鍐欙紝鍕夸緷璧栧綋鍓嶅伐浣滅洰褰曘€傦級
- **浠诲姟娓呭崟**锛歿TASK_LIST}

## 寮哄埗绾︽潫
1. **ralph-method**锛氬湪鏈枃妗ｅ悓鐩綍鍒涘缓骞剁淮鎶?prd 涓?progress 鏂囦欢锛堟枃妗ｄ负 BUGFIX_xxx.md 鏃朵娇鐢?prd.BUGFIX_xxx.json銆乸rogress.BUGFIX_xxx.txt锛夛紱姣忓畬鎴愪竴涓?US 蹇呴』鏇存柊 prd锛堝搴?passes=true锛夈€乸rogress锛堣拷鍔犱竴鏉″甫鏃堕棿鎴崇殑 story log锛夛紱鎸?US 椤哄簭鎵ц銆?*prd 椤荤鍚?ralph-method schema**锛氭秹鍙婄敓浜т唬鐮佺殑 US 鍚?`involvesProductionCode: true` 涓?`tddSteps`锛圧ED/GREEN/REFACTOR 涓夐樁娈碉級锛涗粎鏂囨。/閰嶇疆鐨勫惈 `tddSteps`锛圖ONE 鍗曢樁娈碉級銆?*progress 棰勫～ TDD 妲戒綅**锛氱敓鎴?progress 鏃讹紝瀵规瘡涓?US 棰勫～ `[TDD-RED] _pending_`銆乣[TDD-GREEN] _pending_`銆乣[TDD-REFACTOR] _pending_` 鎴?`[DONE] _pending_`锛屾秹鍙婄敓浜т唬鐮佺殑 US 鍚笁鑰咃紝浠呮枃妗?閰嶇疆鐨勫惈 [DONE]锛涙墽琛屾椂灏?`_pending_` 鏇挎崲涓哄疄闄呯粨鏋溿€?2. **TDD 绾㈢豢鐏?*锛?*姣忎釜 US 椤荤嫭绔嬫墽琛?RED鈫扜REEN鈫扲EFACTOR**锛涚姝粎瀵归涓?US 鎵ц TDD 鍚庡鍚庣画 US 璺宠繃绾㈢伅鐩存帴瀹炵幇銆傛瘡涓?US 鎵ц鍓嶅厛鍐?琛ユ祴璇曪紙绾㈢伅锛夆啋 瀹炵幇浣块€氳繃锛堢豢鐏級鈫?閲嶆瀯銆?   **銆怲DD 绾㈢豢鐏樆濉炵害鏉熴€?* 姣忎釜娑夊強鐢熶骇浠ｇ爜鐨勪换鍔℃墽琛岄『搴忎负锛氣憼 鍏堝啓/琛ユ祴璇曞苟杩愯楠屾敹 鈫?蹇呴』寰楀埌澶辫触缁撴灉锛堢孩鐏級锛涒憽 绔嬪嵆鍦?progress 杩藉姞 [TDD-RED] <浠诲姟ID> <楠屾敹鍛戒护> => N failed锛涒憿 鍐嶅疄鐜板苟閫氳繃楠屾敹 鈫?寰楀埌閫氳繃缁撴灉锛堢豢鐏級锛涒懀 绔嬪嵆鍦?progress 杩藉姞 [TDD-GREEN] <浠诲姟ID> <楠屾敹鍛戒护> => N passed锛涒懁 **鏃犺鏄惁鏈夐噸鏋?*锛屽湪 progress 杩藉姞 [TDD-REFACTOR] <浠诲姟ID> <鍐呭>锛堟棤鍏蜂綋閲嶆瀯鏃跺啓銆屾棤闇€閲嶆瀯 鉁撱€嶏級銆傜姝㈠湪鏈畬鎴愭楠?1鈥? 涔嬪墠鎵ц姝ラ 3銆傜姝㈡墍鏈変换鍔″畬鎴愬悗闆嗕腑琛ュ啓 TDD 璁板綍銆?*浜や粯鍓嶈嚜妫€**锛氭秹鍙婄敓浜т唬鐮佺殑姣忎釜 US锛宲rogress 椤诲惈 [TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鍚勮嚦灏戜竴琛岋紝涓?[TDD-RED] 椤诲湪 [TDD-GREEN] 涔嬪墠锛涚己浠讳竴椤瑰垯琛ュ厖鍚庡啀浜や粯銆?3. **speckit-workflow**锛氱姝吉瀹炵幇銆佸崰浣嶃€乀ODO 寮忓疄鐜帮紱蹇呴』杩愯鏂囨。涓殑楠屾敹鍛戒护锛涙灦鏋勫繝瀹炰簬 BUGFIX/TASKS 鏂囨。锛涚姝㈠湪浠诲姟鎻忚堪涓坊鍔犮€屽皢鍦ㄥ悗缁凯浠ｃ€嶏紱绂佹鏍囪瀹屾垚浣嗗姛鑳芥湭瀹為檯璋冪敤銆?4. **楠屾敹**锛氭瘡鎵逛换鍔″畬鎴愬悗杩愯鏂囨。涓粰鍑虹殑 pytest 鎴栭獙鏀跺懡浠わ紝骞跺皢缁撴灉鍐欏叆 progress銆?
璇疯鍙栦笂杩拌矾寰勪笅鐨勬枃妗ｏ紝鎸夋湭瀹屾垚浠诲姟閫愰」瀹炴柦锛屽苟杈撳嚭锛氬凡瀹屾垚鐨?US/浠诲姟缂栧彿銆侀獙鏀跺懡浠よ繍琛岀粨鏋溿€佷互鍙婃洿鏂板悗鐨?prd/progress 鐘舵€佹憳瑕併€?```

### 鍗犱綅绗﹁鏄?
- **DOC_PATH**锛歍ASKS/BUGFIX 鏂囨。鐨勭粷瀵硅矾寰勬垨鐩稿椤圭洰鏍圭殑璺緞锛堜富 Agent 瑙ｆ瀽鐢ㄦ埛杈撳叆鍚庡～鍐欙紱寤鸿浼犵粷瀵硅矾寰勶級銆?- **TASK_LIST**锛氫富 Agent 浠庢枃妗ｆ彁鍙栫殑鏈畬鎴愰」锛屾牸寮忕ず渚嬶細搂7 T7a-1锝濼7a-9銆伮? 绗?2锝? 鏉°€俁esume 鎴栨柇鐐圭画璺戞椂锛屽繀椤讳娇鐢?`references/prompt-templates.md` 涓殑銆孯esume 瀹炴柦瀛愪换鍔°€嶆ā鏉匡紝骞跺～鍐欍€屼笂涓€鎵瑰凡瀹屾垚銆嶄笌銆屾湰鎵瑰緟鎵ц銆嶈寖鍥淬€?
Main Agent only: invoke Agent tool, pass this prompt, then collect and summarize the subagent's output (and resume if needed).

### YAML Handoff锛圫tep 1 瀹屾垚鍚庤緭鍑猴級

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl
  batch: {褰撳墠鎵规}
  completed_us: [{宸插畬鎴?US 鍒楄〃}]
artifacts:
  tasks_doc: {DOC_PATH}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - 鍙戣捣 Step 2 瀹炴柦鍚庡璁?handoff:
  next_action: post_batch_audit
  next_agent: auditor-implement
  ready: true
  mainAgentNextAction: dispatch_review
  mainAgentReady: true
```

---

## Step 2: Audit sub-task (after implementation)

**Tool**: Agent tool
**subagent_type**: `general-purpose`锛堟暣娈典紶鍏?`.codex/agents/auditors/auditor-implement.md` 鎴栦互涓嬪唴鑱?prompt锛?
### 瀹¤鎵ц浣撻€夋嫨锛堟寜 Fallback Strategy锛?
1. **L1**锛堜富璺緞锛夛細璇诲彇 `.codex/agents/auditors/auditor-implement.md` 鍏ㄦ枃浣滀负 prompt锛屼紶鍏?Agent tool锛坄subagent_type: general-purpose`锛?2. **L2**锛欳odex-native reviewer `code-reviewer`
3. **L3**锛歚.codex/skills/speckit-workflow/` 涓?code-review skill
4. **L4**锛氫富 Agent 鐩存帴鎵ц浠ヤ笅瀹¤ prompt

闄嶇骇鏃堕』鍚戠敤鎴疯緭鍑洪檷绾ч€氱煡锛團R26锛夈€?
### Requirements

- Use **audit-prompts.md 搂5** (鎵ц闃舵瀹¤): 閫愰」楠岃瘉銆佹棤鍗犱綅銆佹棤妯＄硦琛ㄨ堪銆佸彲钀藉湴瀹炴柦銆佸畬鍏ㄨ鐩栥€侀獙璇侀€氳繃.
- **鎵瑰垽瀹¤鍛樺繀椤诲嚭鍦猴紝鍙戣█鍗犳瘮 >70%**锛涗粠瀵规姉瑙嗚妫€鏌ラ仐婕忋€佽鍙锋紓绉汇€侀獙鏀朵竴鑷存€с€佽浼?婕忕綉.
- **鏀舵暃鏉′欢**锛?*涓€杞?* = 涓€娆″畬鏁村璁″瓙浠诲姟璋冪敤锛?*杩炵画 3 杞棤 gap** = 杩炵画 3 娆＄粨璁哄潎涓恒€屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶄笖璇?3 娆℃姤鍛婁腑鎵瑰垽瀹¤鍛樼粨璁烘鍧囨敞鏄庛€屾湰杞棤鏂?gap銆嶏紱鑻ヤ换涓€杞负銆屾湭閫氳繃銆嶆垨銆屽瓨鍦?gap銆嶏紝鍒欎粠涓嬩竴杞噸鏂拌鏁般€傚惁鍒欐牴鎹姤鍛婁慨鏀瑰悗鍐嶆鍙戣捣瀹¤.

### 鍙戣捣鍓嶈嚜妫€娓呭崟

- [ ] DOC_PATH 宸插～鍏?- [ ] 瀹炴柦浜х墿璺緞宸茬‘璁?- [ ] 宸茶緭鍑?CLI Calling Summary
- [ ] 瀹¤ prompt 妯℃澘宸叉暣娈靛鍒?
### CLI Calling Summary 绀轰緥

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={鏂囨。璺緞}, round={杞}
Template: Step 2 Audit Prompt (搂5 + 鎵瑰垽瀹¤鍛?
Output: 瀹¤鎶ュ憡锛堝畬鍏ㄨ鐩?鏈€氳繃锛?Fallback: L2 OMC code-reviewer 鈫?L3 code-review skill 鈫?L4 涓?Agent 鐩存帴鎵ц
Acceptance: 杩炵画 3 杞棤 gap 鏀舵暃
```

### Prompt template锛堟暣娈靛鍒讹紝鏇挎崲鍗犱綅绗﹀悗浼犲叆锛?
```
瀵?**瀹炴柦瀹屾垚鍚庣殑缁撴灉** 鎵ц **audit-prompts 搂5 鎵ц闃舵瀹¤**銆傚繀椤诲紩鍏?**鎵瑰垽瀹¤鍛橈紙Critical Auditor锛?* 瑙嗚锛屼笖鎵瑰垽瀹¤鍛樺彂瑷€鍗犳瘮椤?**>70%**銆?
## 琚瀵硅薄
- 瀹炴柦渚濇嵁鏂囨。锛歿DOC_PATH}
- 瀹炴柦浜х墿锛氫唬鐮佸彉鏇淬€乸rd銆乸rogress銆佷互鍙婃枃妗ｄ腑瑕佹眰鐨勯獙鏀跺懡浠よ緭鍑?
## 搂5 瀹¤椤?1. 浠诲姟鏄惁鐪熸瀹炵幇锛堟棤棰勭暀/鍗犱綅/鍋囧畬鎴愶級
2. 鐢熶骇浠ｇ爜鏄惁鍦ㄥ叧閿矾寰勪腑琚娇鐢?3. 闇€瀹炵幇鐨勯」鏄惁鍧囨湁瀹炵幇涓庢祴璇?楠屾敹瑕嗙洊
4. 楠屾敹琛?楠屾敹鍛戒护鏄惁宸叉寜瀹為檯鎵ц骞跺～鍐?5. 鏄惁閬靛畧 ralph-method锛坧rd/progress 鏇存柊銆乁S 椤哄簭锛夛紱娑夊強鐢熶骇浠ｇ爜鐨勬瘡涓?US 鏄惁鍚?[TDD-RED]銆乕TDD-GREEN]銆乕TDD-REFACTOR] 鍚勮嚦灏戜竴琛岋紙[TDD-REFACTOR] 鍏佽鍐欍€屾棤闇€閲嶆瀯 鉁撱€嶏紱[TDD-RED] 椤诲湪 [TDD-GREEN] 涔嬪墠锛?6. 鏄惁鏃犮€屽皢鍦ㄥ悗缁凯浠ｃ€嶇瓑寤惰繜琛ㄨ堪锛涙槸鍚︽棤鏍囪瀹屾垚浣嗘湭璋冪敤
7. 椤圭洰椤绘寜鎶€鏈爤閰嶇疆骞舵墽琛?Lint锛堣 lint-requirement-matrix锛夛紱鑻ヤ娇鐢ㄤ富娴佽瑷€浣嗘湭閰嶇疆 Lint 椤讳綔涓烘湭閫氳繃椤癸紱宸查厤缃殑椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶈眮鍏嶃€?
## 鎵瑰垽瀹¤鍛?浠庡鎶楄瑙掓鏌ワ細閬楁紡浠诲姟銆佽鍙锋垨璺緞澶辨晥銆侀獙鏀跺懡浠ゆ湭璺戙€伮?/楠屾敹璇激鎴栨紡缃戙€?**鍙搷浣滆姹?*锛氭姤鍛婇』鍖呭惈鐙珛娈佃惤銆?# 鎵瑰垽瀹¤鍛樼粨璁恒€嶏紝涓旇娈佃惤瀛楁暟鎴栨潯鐩暟涓嶅皯浜庢姤鍛婂叾浣欓儴鍒嗙殑 70%锛堝嵆鍗犳瘮 >70%锛夛紱缁撹椤绘槑纭€屾湰杞棤鏂?gap銆嶆垨銆屾湰杞瓨鍦?gap銆嶅強鍏蜂綋椤广€傝嫢涓?Agent 浼犲叆浜嗘湰杞搴忓彿锛岃鍦ㄧ粨璁轰腑娉ㄦ槑銆岀 N 杞€嶃€?
## 杈撳嚭涓庢敹鏁?- 缁撹椤绘槑纭細**銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆?* 鎴?**銆屾湭閫氳繃銆?*锛堝苟鍒?gap 涓庝慨鏀瑰缓璁級銆?- 鑻ラ€氳繃涓旀壒鍒ゅ璁″憳鏃犳柊 gap锛氭敞鏄庛€屾湰杞棤鏂?gap锛岀 N 杞紱寤鸿绱鑷?3 杞棤 gap 鍚庢敹鏁涖€嶃€?- 鑻ユ湭閫氳繃锛氭敞鏄庛€屾湰杞瓨鍦?gap锛屼笉璁℃暟銆嶏紝淇鍚庡啀娆″彂璧锋湰瀹¤锛岀洿鑷宠繛缁?3 杞棤 gap 鏀舵暃銆?```

Main Agent: launch this Agent tool after Step 1 (and after any resume). 涓?Agent 鍦ㄥ彂璧风 2銆? 杞璁″墠锛屽彲杈撳嚭銆岀 N 杞璁￠€氳繃锛岀户缁獙璇佲€︺€嶄互鎻愮ず鐢ㄦ埛銆侷f the report is "鏈€氳繃"锛屼富 Agent 閫氳繃鍐嶆鍙戣捣瀹炴柦瀛愪换鍔★紙鎴?resume锛夌敱瀛愪唬鐞嗕慨澶嶄唬鐮佷笌 prd/progress锛涗富 Agent 浠呭彲鍋氳鏄庢€?鏂囨。绫荤紪杈戯紝涓嶅緱缂栬緫 prd.*.json銆乸rogress.*.txt 鎴栫敓浜т唬鐮併€傜劧鍚庨噸鏂板彂璧峰璁＄洿鑷宠繛缁?3 杞棤 gap 鏀舵暃銆?
### YAML Handoff锛圫tep 2 瀹屾垚鍚庤緭鍑猴級

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_audit
  round: {杞}
  critic_ratio: "{鎵瑰垽瀹¤鍛樺崰姣攠"
  gap_count: {gap 鏁皚
  convergence_status: in_progress|converged
artifacts:
  report: {瀹¤鎶ュ憡璺緞}
  tasks_doc: {DOC_PATH}
next_steps:
  - {鑻ラ€氳繃: 杩涘叆涓嬩竴鎵规垨 commit gate}
  - {鑻ユ湭閫氳繃: 淇鍚庨噸鏂板璁
handoff:
  next_action: implement_next_batch|commit_gate|revise_and_reaudit
  next_agent: bmad-standalone-tasks|bmad-master|auditor-implement
  ready: true|false
  mainAgentNextAction: dispatch_implement|dispatch_review|dispatch_remediation|run_closeout|await_user
  mainAgentReady: true|false
```

---

## Step 3: Main Agent prohibitions (reminder)

- **绂佹** 瀵圭敓浜т唬鐮佹墽琛?`search_replace`銆乣write`銆乣edit`锛堢敓浜т唬鐮佸惈 TASKS/BUGFIX 鏂囨。涓垪涓哄疄鐜扮洰鏍囩殑璺緞锛夛紱**绂佹**鐩存帴缂栬緫 `prd.{stem}.json` 涓?`progress.{stem}.txt`锛堢敱瀛愪唬鐞嗘寜 ralph-method 缁存姢锛?
- **绂佹** 鐢ㄤ富 Agent 鐩存帴瀹炵幇浠诲姟浠ユ浛浠?subagent锛涜嫢 subagent 杩斿洖涓嶅畬鏁达紝鍙兘閫氳繃 Agent tool **resume** 鎴栧啀娆″彂璧锋柊鐨?Agent tool 缁х画锛屽苟鍦?prompt 涓樉寮忎紶鍏ャ€屼笂涓€鎵瑰凡瀹屾垚銆嶄笌銆屾湰鎵瑰緟鎵ц銆嶈寖鍥达紝涓嶅緱鑷鏀逛唬鐮?
- **鍏佽** 涓?Agent 浠呯紪杈戣鏄庢€?鏂囨。绫绘枃浠讹紙濡?README銆佹湰 SKILL.md銆乤rtifact 鐩綍涓?.md锛夛紝浠ラ厤鍚堝璁＄粨璁烘垨璁板綍杩涘害.

---

## 涓?ralph-method / speckit-workflow 鐨勮鎺?
- **Standalone 鐢ㄦ硶**锛氭湰鎶€鑳戒负 standalone 妯″紡锛氫互褰撳墠 TASKS/BUGFIX 鏂囨。涓哄敮涓€浠诲姟鏉ユ簮锛屼笉瑕佹眰鍏堝瓨鍦?speckit 浜у嚭鐨?tasks.md銆俇S 涓?prd 鏉ユ簮涓哄綋鍓嶆枃妗ｃ€備笌 ralph-method 涓€宲rd 涓?tasks.md 涓€鑷淬€嶅苟瀛樻椂锛屼互鏈妧鑳界害瀹氫负鍑嗐€傚瓙浠ｇ悊鍦ㄦ棤 US 缁撴瀯鏃舵寜鏈妧鑳界害瀹氱敓鎴?prd/progress锛屾棤闇€婊¤冻 ralph-method 鎶€鑳界殑鍓嶇疆锛坧lan/IMPLEMENTATION_GAPS/tasks.md锛夋鏌ャ€?- **鏃?US 缁撴瀯鏃?*锛氳嫢鏂囨。浠呮湁鎵佸钩浠诲姟鍒楄〃锛屽瓙浠ｇ悊椤诲皢姣忔潯鍙獙鏀朵换鍔℃槧灏勪负 US-001銆乁S-002鈥︼紙鎴栭噰鐢ㄦ枃妗ｅ師鏈夌紪鍙凤級锛岀敓鎴愮鍚?ralph-method prd.json schema 鐨?prd锛屽苟淇濇寔 progress 涓?prd 鐨?id 涓€鑷淬€?- **鎶€鑳藉姞杞?*锛氬疄鏂藉瓙浠诲姟 prompt 寮€澶村凡瑕佹眰瀛愪唬鐞嗗厛璇诲彇骞堕伒寰?ralph-method 涓?speckit-workflow 鍐嶆墽琛岋紝纭繚 prd 缁撴瀯涓?TDD/楠屾敹绾︽潫涓€鑷淬€?
---

## Repo Add-ons

浠ヤ笅涓轰粨搴撶骇鎵╁睍锛屼笉灞炰簬 Codex Canonical Base锛岀敱鏈粨鏂板銆?
### Handoff / State 鍗忚

- 姣忎釜 step 缁撴潫杈撳嚭 YAML Handoff锛堣涓婃柟鍚?step 鏈熬妯℃澘锛?- 鏈€缁堟彁浜ら€氳繃 `bmad-master` 闂ㄦ帶
- 绂佹瀛愪唬鐞嗚嚜琛?commit

### Scoring 闆嗘垚

- 瀹¤鎶ュ憡椤诲寘鍚彲瑙ｆ瀽璇勫垎鍧楋紙渚?`parse-and-write-score.ts` 鎻愬彇锛?- 鏍煎紡閬靛惊 `.codex/skills/bmad-code-reviewer-lifecycle/SKILL.md` 瀹氫箟

### 绂佹璇嶄笌妯＄硦琛ㄨ堪

- 鏈粨绾﹀畾绂佹鍑虹幇鍦ㄤ换鍔℃弿杩颁腑鐨勮〃杩帮細銆屽皢鍦ㄥ悗缁凯浠ｃ€嶃€屽緟鍚庣画澶勭悊銆嶃€屾殏涓嶅疄鐜般€嶇瓑寤惰繜鎬ц瑷€
- 瀹¤椤绘鏌ュ苟鏍囪姝ょ被琛ㄨ堪涓?gap

---

## References

- **ralph-method**: Create/maintain prd + progress; naming and schema see ralph-method skill.
- **speckit-workflow**: TDD 绾㈢豢鐏€?5 鏉￠搧寰嬨€侀獙鏀跺懡浠ゃ€佹灦鏋勫繝瀹烇紱瀹¤椤昏皟鐢?code-review 鎶€鑳?
- **audit-prompts 搂5**: 鎵ц闃舵瀹¤锛涙湰鎶€鑳藉唴缃殑 7 椤瑰嵆涓?搂5 瀹¤椤广€傝嫢椤圭洰瀛樺湪 `_bmad/references/audit-prompts.md`锛屽彲瀵圭収鍏?搂5 鎵ц銆傞€愰」楠岃瘉銆佸畬鍏ㄨ鐩栥€侀獙璇侀€氳繃锛涙壒鍒ゅ璁″憳銆? 杞棤 gap 鏀舵暃.
- **audit-post-impl-rules**: 涓?speckit-workflow銆乥mad-story-assistant 鐨勫疄鏂藉悗瀹¤瑙勫垯瀵归綈銆傛湰鎶€鑳?Step 2 宸茬鍚?audit-post-impl-rules锛? 杞棤 gap銆佹壒鍒ゅ璁″憳 >50%锛夈€傝鍒欐枃浠惰矾寰勶細`.codex/skills/speckit-workflow/references/audit-post-impl-rules.md`銆?- **audit-document-iteration-rules**: 褰撳 TASKS/BUGFIX **鏂囨。**杩涜瀹¤锛堥潪瀹炴柦鍚庡璁★級鏃讹紝椤婚伒寰?`.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`锛氬璁″瓙浠ｇ悊鍦ㄥ彂鐜?gap 鏃堕』鐩存帴淇敼琚鏂囨。銆?*鏈妧鑳?Step 2 涓哄疄鏂藉悗瀹¤锛堝璁′唬鐮侊級**锛屼慨鏀圭敱瀹炴柦瀛愪唬鐞嗗畬鎴愶紝涓嶉€傜敤鏂囨。杩唬瑙勫垯銆?- **Prompt templates**: See `references/prompt-templates.md` for copy-paste prompts with placeholders.

---

## 閿欒涓庤竟鐣屽鐞?
- **鏂囨。璺緞涓嶅瓨鍦?*锛氫富 Agent 瑙ｆ瀽鐢ㄦ埛杈撳叆寰楀埌璺緞鍚庯紝鑻ヨ璺緞涓嶅瓨鍦紝搴斿悜鐢ㄦ埛鎶ラ敊骞跺垪鍑哄凡瑙ｆ瀽璺緞锛屼笉鍙戣捣瀹炴柦瀛愪换鍔°€?- **瀛愪唬鐞嗛敊璇垨瓒呮椂**锛氳嫢鏈夎繑鍥炵殑 agent ID锛屼富 Agent 鍙彂璧?**resume**锛堟渶澶氶噸璇?1 娆★級锛涜嫢浠嶅け璐ユ垨鏃?agent ID锛屽垯閲嶆柊鍙戣捣鏂扮殑 Agent tool锛屽苟鍦?prompt 涓敞鏄庛€屼笂娆℃湭瀹屾垚锛岃浠庡悓鐩綍 progress 鏂囦欢鎴栦笅鍒楁柇鐐圭户缁€嶏紝涓嶆浛浠ｅ瓙浠ｇ悊鐩存帴鏀圭敓浜т唬鐮併€?- **涓?Agent 绂佹缂栬緫**锛歱rd.*.json銆乸rogress.*.txt 浠呯敱瀛愪唬鐞嗙淮鎶わ紱涓?Agent 涓嶅緱涓恒€岃ˉ鍐?progress銆嶇瓑鐞嗙敱鐩存帴缂栬緫涓婅堪鏂囦欢銆?
<!-- ADAPTATION_COMPLETE: 2026-03-16 -->
