---
name: bmad-story-assistant
description: |
  Codex CLI / OMC 鐗?BMAD Story Assistant 閫傞厤鍏ュ彛銆?  浠?Cursor bmad-story-assistant 涓鸿涔夊熀绾匡紝瀹屾暣缂栨帓 Story 鍒涘缓 鈫?瀹¤ 鈫?Dev Story 鈫?瀹炴柦鍚庡璁?鈫?澶辫触鍥炵幆锛?  骞舵帴鍏ヤ粨搴撳唴宸插疄鐜扮殑澶?agent銆乭ooks銆佺姸鎬佹満銆乭andoff銆佽瘎鍒嗗啓鍏ヤ笌 commit gate 鏈哄埗銆?---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 鏈鏀剁揣锛氭湰鏂囦欢涓€滃畬鎴?/ 閫氳繃 / 鍙繘鍏ヤ笅涓€闃舵鈥濅竴寰嬫寚 `runAuditorHost` 杩斿洖 `closeout approved`銆傚璁℃姤鍛?`PASS` 浠呰〃绀哄彲浠ヨ繘鍏?host close-out锛屽崟鐙殑 `PASS` 涓嶅緱瑙嗕负瀹屾垚銆佸噯鍏ユ垨鏀捐銆?
# Claude Adapter: BMAD Story Assistant

> **Party-mode source of truth**锛歚{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`銆傛墍鏈?party-mode 鐨?rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit gate 璇箟閮戒互璇ユ枃浠朵负鍑嗭紱鏈?skill 鍙畾涔?Story 鍦烘櫙浣曟椂杩涘叆 party-mode锛屼笉寰楃淮鎶ょ浜屽 gate 璇箟銆?
## Purpose

鏈?skill 鏄?Cursor `bmad-story-assistant` 鍦?Codex CLI / OMC 鐜涓嬬殑缁熶竴閫傞厤鍏ュ彛銆?
## 涓?Agent 缂栨帓闈紙寮哄埗锛?
浜や簰妯″紡涓嬶紝鍦ㄤ富 Agent 鍚姩銆佹仮澶嶆垨鏀跺彛 `story` 鎵ц閾句箣鍓嶏紝蹇呴』鍏堣鍙栵細

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect
```

濡傞渶鐢熸垚姝ｅ紡娲惧彂璁″垝锛屽垯璇诲彇锛?
```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan
```

`mainAgentNextAction / mainAgentReady` 浠呬负 compatibility summary锛涚湡姝ｆ潈濞佺姸鎬佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
鐩爣涓嶆槸绠€鍗曞鍒?Cursor skill锛岃€屾槸锛?
1. **缁ф壙 Cursor 宸查獙璇佺殑娴佺▼璇箟**
2. **鍦?Codex no-hooks 杩愯鏃朵腑閫夋嫨姝ｇ‘鎵ц鍣ㄥ苟瀹氫箟 fallback**
3. **鎺ュ叆浠撳簱涓凡寮€鍙戝畬鎴愮殑鐘舵€佹満銆乭ooks銆乭andoff銆佸璁￠棴鐜€佽瘎鍒嗗啓鍏ヤ笌 commit gate**
4. **纭繚鍦?Codex CLI 涓兘瀹屾暣銆佽繛缁€佹纭湴鎵ц Story 鍒涘缓 鈫?寮€鍙?鈫?瀹¤闂幆杩唬绛夊叏娴佺▼**

---

## 鏍稿績楠屾敹鏍囧噯

Claude 鐗?`bmad-story-assistant` 蹇呴』婊¤冻锛?
- 鑳戒綔涓?Codex CLI 鐨?*缁熶竴鍏ュ彛**锛岃繛缁紪鎺?Story 鍒涘缓銆侀樁娈靛璁°€丏ev Story 瀹炴柦銆佸疄鏂藉悗瀹¤涓庡け璐ュ洖鐜?- 鍚勯樁娈佃烦杞€佹墽琛屽櫒閫夋嫨銆乫allback銆佺姸鎬佽惤鐩樸€佽瘎鍒嗗啓鍏ヤ笌瀹¤闂幆鍧囦笌 Cursor 宸查獙璇佹祦绋嬭涔変竴鑷?- 瀹屾暣鎺ュ叆鏈粨鏂板鐨勶細
  - 澶?agent
  - hooks
  - 鐘舵€佹満
  - handoff
  - 瀹¤鎵ц浣?  - runAuditorHost
  - commit gate
- 涓嶅緱灏?Codex Canonical Base銆丆laude Runtime Adapter銆丷epo Add-ons 娣峰啓涓烘潵婧愪笉鏄庣殑閲嶅啓鐗?prompt

---

## Party-Mode Agent Mention Contract

浠庢湰鐗堟湰寮€濮嬶紝Claude 鍒嗘敮涓殑 party-mode 涓嶅啀浠?`general-purpose` 浣滀负涓昏矾寰勬弿杩般€?
- **涓昏矾寰?*锛歚.codex/agents/party-mode-facilitator.md`
- **鍞竴璋冪敤 contract**锛歚@"party-mode-facilitator (agent)"`
- **閫傜敤鑼冨洿**锛氬嚒闇€瑕佸瑙掕壊杈╄銆佹柟妗堟敹鏁涖€佹灦鏋?鑼冨洿鍙栬垗銆丼tory 璁捐鍒嗘婢勬竻鐨?party-mode 鍦烘櫙
- **鍏煎 fallback**锛氫粎褰?dedicated facilitator agent 鍦ㄥ綋鍓嶈繍琛屾椂涓嶅彲鐢ㄦ椂锛屾墠鍏佽閫€鍥?`subagent_type: general-purpose` 骞跺唴鑱斿畬鏁?facilitator contract
- **闈?party-mode 鎵ц浣?*锛歚bmad-story-create`銆乣auditor-*`銆乣speckit-implement` 绛夊叾浠栨墽琛屼綋浠嶅彲缁х画浣跨敤 `general-purpose`

鍥犳锛宍general-purpose` 鍦?Claude Story 娴佺▼涓粛鐒跺瓨鍦紝浣?*涓嶅啀鏄?party-mode 鐨勬帹鑽愪富璺緞**銆?
---

## Codex Canonical Base

浠ヤ笅鍐呭缁ф壙鑷?Cursor `bmad-story-assistant`锛屽睘浜庝笟鍔¤涔夊熀绾匡紝Claude 鐗堜笉寰楁搮鑷噸鍐欏叾鎰忓浘锛?
### 闃舵妯″瀷
1. Create Story
2. Story 瀹¤
3. Dev Story / `STORY-A3-DEV`
4. 瀹炴柦鍚庡璁?/ `STORY-A4-POSTAUDIT`
5. 澶辫触鍥炵幆涓庨噸鏂板璁?
### 鍏抽敭妯℃澘鍩虹嚎
- `STORY-A3-DEV`
- `STORY-A4-POSTAUDIT`
- Story 鏂囨。闃舵瀹¤瑕佹眰
- 鍓嶇疆妫€鏌ャ€乀DD 绾㈢豢鐏€乺alph-method銆乸ost-audit 鐨勫熀绾跨害鏉?
### 蹇呴』淇濈暀鐨勫熀绾胯涔?- 涓?Agent 涓嶅緱缁曡繃鍏抽敭闃舵
- 鍓嶇疆鏂囨。蹇呴』宸查€氳繃瀹¤
- Dev Story 涓嶅緱鍦ㄥ疄鏂藉凡缁撴潫鍚庨噸澶嶈Е鍙?- 瀹炴柦瀹屾垚鍚庡繀椤诲彂璧?post-audit
- TDD 椤哄簭涓庤褰曡姹備笉鍙烦杩?- 瀛愪换鍔¤繑鍥炲悗 cleanup / post-audit 鐨勯『搴忓繀椤讳繚鎸?
### 涓嶅睘浜?Codex Canonical Base 鐨勫唴瀹?浠ヤ笅鍐呭绂佹鍐欏叆 Cursor Base锛屽簲鏀惧叆 Runtime Adapter 鎴?Repo Add-ons锛?- Claude / OMC 鐨勫叿浣?agent 鍚嶇О
- `Codex-native reviewer:code-reviewer`
- `code-review` skill
- `auditor-spec` / `auditor-plan` / `auditor-tasks` / `auditor-implement`
- 浠撳簱鏈湴 scoring銆佺姝㈣瘝銆佹壒鍒ゅ璁″憳鏍煎紡銆乻tate 鏇存柊缁嗚妭

---

## Codex no-hooks Runtime Adapter

鏈妭瀹氫箟 Cursor 璇箟鍦?Codex CLI / OMC 涓殑鍏蜂綋鎵ц鏂瑰紡銆?
### Stage Routing Map

| Cursor 闃舵 | Claude 鍏ュ彛 / 鎵ц浣?| 璇存槑 |
|------|------|------|
| Create Story | Claude 鐗?`bmad-story-assistant` adapter skill 鈫?story/create 鎵ц浣?| 褰撳墠浠ヨ璁′綅淇濈暀锛屽悗缁簲鏄犲皠鍒?`.codex/agents/...` |
| Story 瀹¤ | Story 瀹¤鎵ц浣?/ reviewer | 褰撳墠浠ヨ璁′綅淇濈暀锛屽悗缁簲鏍囧噯鍖?|
| `STORY-A3-DEV` | `.codex/agents/speckit-implement.md` | 宸蹭笁灞傚寲锛屽苟瀵归綈 `STORY-A3-DEV` |
| `STORY-A4-POSTAUDIT` | `.codex/agents/layers/bmad-layer4-speckit-implement.md` + `auditor-implement` | 宸蹭笁灞傚寲锛宎uditor 浼樺厛 |
| spec 瀹¤ | `auditor-spec` | primary |
| plan 瀹¤ | `auditor-plan` | primary |
| tasks 瀹¤ | `auditor-tasks` | primary |
| implement 瀹¤ | `auditor-implement` | primary |
| bugfix 瀹¤ | `auditor-bugfix` | primary |

### Primary Executors

- Story / Layer 4 / implement/post-audit 鐨?primary executor 浼樺厛浣跨敤浠撳簱鑷畾涔夋墽琛屼綋
- 瀹¤闃舵浼樺厛浣跨敤锛?  - `auditor-spec`
  - `auditor-plan`
  - `auditor-tasks`
  - `auditor-implement`
  - `auditor-bugfix`
- Dev Story 瀹炴柦浼樺厛浣跨敤锛?  - `.codex/agents/speckit-implement.md`

### Optional Reuse

濡傝繍琛屾椂鍙敤锛屽彲澶嶇敤锛?- `Codex-native reviewer:code-reviewer`
- `code-review` skill
- OMC executor / reviewer 鍨?agent
- 娴嬭瘯 / lint 涓撶敤鎵ц鍣?
### Fallback Strategy

缁熶竴鍥為€€绛栫暐濡備笅锛?
1. 浼樺厛浣跨敤浠撳簱瀹氫箟鐨?primary executor
2. 鑻?primary executor 鍦ㄥ綋鍓嶇幆澧冧笉鍙洿鎺ヨ皟鐢紝鍒欏洖閫€鍒?Codex reviewer / executor
3. 鑻?Codex reviewer / executor 涓嶅彲鐢紝鍒欏洖閫€鍒?`code-review` skill 鎴栫瓑浠疯兘鍔?4. 鑻ヤ笂杩版墽琛屼綋鍧囦笉鍙敤锛屽垯鐢变富 Agent 鐩存帴鎵ц鍚屼竴浠戒笁灞傜粨鏋?prompt
5. fallback 浠呭厑璁告敼鍙樻墽琛屽櫒锛屼笉寰楁敼鍙橈細
   - Codex Canonical Base
   - Repo Add-ons
   - 杈撳嚭鏍煎紡
   - 璇勫垎鍧?   - required_fixes 缁撴瀯
   - handoff / state 鏇存柊瑙勫垯

### Runtime Contracts

鎵€鏈夐樁娈靛繀椤婚伒瀹堜互涓嬭繍琛屾椂濂戠害锛?
- 蹇呴』缁存姢锛?  - `.codex/state/bmad-progress.yaml`
  - `.codex/state/stories/*-progress.yaml`锛堝閫傜敤锛?- 蹇呴』缁存姢 handoff 淇℃伅锛?  - `artifactDocPath`
  - `reportPath`
  - `iteration_count`
  - `next_action`
- 瀹¤閫氳繃鍚庡繀椤昏Е鍙戯細
  - `run-auditor-host.ts`
  - 瀹¤閫氳繃鏍囪
  - 鐘舵€佹洿鏂?- 瀹炴柦瀹屾垚浣?post-audit 鏈墽琛屾椂锛岀姝㈤噸鏂拌繘鍏ュ紑鍙戦樁娈?- 濡?hooks 鍙敤锛屼粎鍏佽 hooks 鍋氾細
  - 瑙傛祴
  - checkpoint
  - 鎭㈠鎻愮ず
  - 闈炰笟鍔￠棬鎺?- hooks 涓嶅緱鏇夸唬锛?  - 闃舵鏀捐
  - commit 鏀捐
  - 涓荤姸鎬佹満鍐崇瓥

---

## Repo Add-ons

浠ヤ笅鍐呭涓轰粨搴撻檮鍔犲寮猴紝涓嶅睘浜?Cursor 鍘熷璇箟銆?
### 瀹¤澧炲己
- 绂佹璇嶆鏌?- 鎵瑰垽瀹¤鍛樿緭鍑烘牸寮?- `鏈疆鏃犳柊 gap / 鏈疆瀛樺湪 gap`
- strict convergence锛堝 implement 杩炵画 3 杞棤 gap锛?
### 璇勫垎涓庡瓨鍌ㄥ寮?- `run-auditor-host.ts`
- `iteration_count`
- `iterationReportPaths`
- 鍙В鏋愯瘎鍒嗗潡瑕佹眰

### 鐘舵€佷笌闂ㄦ帶澧炲己
- `.codex/state/bmad-progress.yaml`
- `.codex/state/stories/*.yaml`
- commit gate
- handoff 鍗忚

### 閰嶇疆绯荤粺闆嗘垚锛堝璁＄矑搴︼級

鏈?skill 鏀寔閫氳繃閰嶇疆绯荤粺鎺у埗瀹¤绮掑害锛屽疄鐜?`full`/`story`/`epic` 涓夌妯″紡銆?
#### 閰嶇疆鍔犺浇

涓?Agent 蹇呴』鍦?skill 鍚姩鏃跺姞杞介厤缃細

```typescript
import { loadConfig, shouldAudit, shouldValidate } from './scripts/bmad-config';

const config = loadConfig();
```

#### 閰嶇疆鏉ユ簮锛堟寜浼樺厛绾э級

1. **CLI 鍙傛暟**: `--audit-granularity=story` | `--continue`
2. **鐜鍙橀噺**: `BMAD_AUDIT_GRANULARITY=story` | `BMAD_AUTO_CONTINUE=true`
3. **椤圭洰閰嶇疆**: `_bmad/_config/bmad-story-config.yaml`
4. **榛樿鍊?*: `audit-granularity=full`, `auto_continue=false`

#### 鏉′欢瀹¤璺敱

姣忎釜 Layer 4 闃舵锛坰pecify/plan/gaps/tasks/implement锛夊繀椤绘牴鎹厤缃喅瀹氭墽琛岃矾寰勶細

```typescript
// 鏉′欢瀹¤閫昏緫妯℃澘
const stageConfig = getStageConfig('specify'); // 鎴栧綋鍓嶉樁娈?
if (stageConfig.audit) {
  // 璺緞 1: 瀹屾暣瀹¤锛堥粯璁?full 妯″紡锛?  await executeFullAudit({
    strictness: stageConfig.strictness, // 'standard' | 'strict'
    subagentTool: 'Agent',
    subagentType: 'general-purpose'
  });
} else if (stageConfig.validation) {
  // 璺緞 2: 鍩虹楠岃瘉锛坰tory 妯″紡鐨勪腑闂撮樁娈碉級
  await executeBasicValidation({
    level: stageConfig.validation,      // 'basic' | 'test_only'
    checks: stageConfig.checks          // 楠岃瘉椤瑰垪琛?  });
  // 楠岃瘉閫氳繃鍚庣洿鎺ユ爣璁伴樁娈靛畬鎴愶紝涓嶇敓鎴?AUDIT_鎶ュ憡
  await markStageAsPassedWithoutAudit();
} else {
  // 璺緞 3: 浠呯敓鎴愭枃妗ｏ紙epic 妯″紡鐨?story 闃舵锛?  await markStageAsPassedWithoutAudit();
}
```

#### 鍚勬ā寮忚涓?
| 妯″紡 | Story鍒涘缓 | 涓棿闃舵 | 瀹炴柦鍚?| Epic瀹¤ |
|------|-----------|----------|--------|----------|
| **full** | 瀹¤ | 鍏ㄩ儴瀹¤ | 瀹¤ | - |
| **story** | 瀹¤ | 鍩虹楠岃瘉 | 瀹¤ | - |
| **epic** | 涓嶅璁?| 涓嶅璁?| 涓嶅璁?| 瀹¤ |

#### 楠岃瘉绾у埆瀹氫箟

**basic 楠岃瘉**锛堢敤浜?story 妯″紡涓棿闃舵锛夛細
- 鏂囨。瀛樺湪鎬ф鏌?- 鍩烘湰缁撴瀯妫€鏌?- 蹇呴渶绔犺妭妫€鏌?
**test_only 楠岃瘉**锛堢敤浜?story 妯″紡 implement 闃舵锛夛細
- 鎵€鏈夋祴璇曢€氳繃
- Lint 鏃犻敊璇?- 鏂囨。瀛樺湪

#### 鎵ц浣撹皟鐢ㄦ柟寮?
浣跨敤閰嶇疆绯荤粺鍚庯紝鎵ц浣撹皟鐢ㄦā鏉挎洿鏂颁负锛?
```yaml
tool: Agent
subagent_type: general-purpose  # 濮嬬粓浣跨敤 general-purpose锛岄€氳繃 prompt 浼犻€掗厤缃?description: "Execute Stage with config-aware routing"
prompt: |
  銆愬繀璇汇€戞湰 prompt 鍖呭惈閰嶇疆涓婁笅鏂囥€?
  **閰嶇疆涓婁笅鏂?*:
  - audit_mode: "story"  # full | story | epic
  - stage: "specify"     # 褰撳墠闃舵
  - should_audit: false  # 鏍规嵁閰嶇疆璁＄畻
  - validation: "basic"  # 褰?audit: false 鏃剁殑楠岃瘉绾у埆

  **鎵ц閫昏緫**:
  1. 璇诲彇閰嶇疆骞惰В鏋?should_audit
  2. 濡傛灉 should_audit: true 鈫?鎵ц瀹屾暣瀹¤娴佺▼锛圫tep 4 瀹¤寰幆锛?  3. 濡傛灉 should_audit: false:
     - 鑻?validation: "basic" 鈫?鎵ц鍩虹楠岃瘉
     - 鑻?validation: "test_only" 鈫?鎵ц娴嬭瘯楠岃瘉
     - 鑻?validation: null 鈫?鐩存帴鏍囪闃舵閫氳繃
  4. 鏍规嵁缁撴灉鏇存柊鐘舵€佹枃浠?```

### 杩愯鏃舵不鐞嗗寮?- ralph-method 杩借釜鏂囦欢
- progress / prd 蹇呭～
- hooks / state / runtime adapter 琛屼负

---

## Stage-by-Stage Orchestration

### Stage 1: Create Story

Claude 绔?Stage 1 Create Story 鎵ц浣擄紝璐熻矗鍦?BMAD Story 娴佺▼涓敓鎴?Story 鏂囨。锛屽苟灏嗘祦绋嬫帹杩涘埌 Story 瀹¤闃舵銆?
#### Purpose

鏈樁娈垫槸 Cursor `bmad-story-assistant` 涓?Create Story 闃舵鍦?Codex CLI / OMC 鐜涓嬬殑鎵ц閫傞厤鍣ㄣ€?
鐩爣锛?- 缁ф壙 Cursor Create Story 闃舵鐨勪笟鍔¤涔?- 鍦?Claude 杩愯鏃朵笅瀹氫箟娓呮櫚鐨勬墽琛屽櫒銆佽緭鍏ャ€佺姸鎬佹洿鏂颁笌 handoff
- 涓哄悗缁?Stage 2 Story 瀹¤鎻愪緵鏍囧噯浜х墿

#### Required Inputs

- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- `project_root`
- 濡傚瓨鍦細`sprint-status.yaml`銆佺浉鍏抽渶姹傛枃妗ｃ€佸墠缃?Epic/Story 瑙勫垝鏂囨。

#### Codex Canonical Base

- 涓绘枃鏈熀绾挎潵婧愶細Cursor `bmad-story-assistant` skill 鐨?Stage 1 Create Story锛坄STORY-A1-CREATE`锛夋ā鏉裤€?- 涓?Agent 鍦ㄥ彂璧?Create Story 瀛愪换鍔?*涔嬪墠**蹇呴』鍏堟墽琛?sprint-status 鍓嶇疆妫€鏌ワ細
  1. 褰撶敤鎴烽€氳繃 `epic_num/story_num`锛堟垨銆?銆?銆嶇瓑褰㈠紡锛夋寚瀹?Story锛屾垨浠?sprint-status 瑙ｆ瀽涓嬩竴 Story 鏃讹紝蹇呴』鍏堟鏌?sprint-status 鏄惁瀛樺湪銆?  2. 鍙皟鐢?`scripts/check-sprint-ready.ps1 -Json` 鎴?`_bmad/speckit/scripts/powershell/check-sprint-ready.ps1 -Json`锛堣嫢椤圭洰鏍规湁 `scripts/` 鍒欎紭鍏堬級锛屽苟瑙ｆ瀽 `SPRINT_READY`銆?  3. 鑻?sprint-status 涓嶅瓨鍦紝蹇呴』鎻愮ず鐢ㄦ埛銆屸殸锔?sprint-status.yaml 涓嶅瓨鍦紝寤鸿鍏堣繍琛?sprint-planning銆嶏紝瑕佹眰鐢ㄦ埛鏄惧紡纭銆屽凡鐭ョ粫杩囷紝缁х画銆嶆垨鍏堟墽琛?sprint-planning锛涙湭纭鍓嶄笉寰楀彂璧?Create Story 瀛愪换鍔°€?  4. 鑻?sprint-status 瀛樺湪锛屽彲闄勫甫銆宻print-status 宸茬‘璁ゃ€嶆爣蹇椾簬瀛愪换鍔?prompt锛岀畝鍖栧瓙浠诲姟閫昏緫銆?  5. 浠呭綋鐢ㄦ埛鏄庣‘銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃锛岃烦杩?Create Story銆嶅苟浠呰姹?Dev Story 鏃讹紝鏂瑰彲璞佸厤鏈樁娈点€?- 閫氳繃瀛愪换鍔¤皟鐢?Create Story 宸ヤ綔娴佹椂锛屼富 Agent 椤诲皢 **瀹屾暣妯℃澘** `STORY-A1-CREATE` 鏁存澶嶅埗骞舵浛鎹㈠崰浣嶇锛?*绂佹**姒傛嫭鎴栫缉鍐欐ā鏉裤€?- 璺宠繃鍒ゆ柇锛氫粎褰撶敤鎴?*鏄庣‘**璇村嚭銆屽凡閫氳繃 party-mode 涓斿璁￠€氳繃銆嶃€岃烦杩?Create Story銆嶆椂锛屼富 Agent 鏂瑰彲璺宠繃闃舵涓€銆佷簩銆傝嫢鐢ㄦ埛浠呮彁渚?Epic/Story 缂栧彿鎴栬銆孲tory 宸插瓨鍦ㄣ€嶈€屾湭鏄庣‘涓婅堪琛ㄨ堪锛?*蹇呴』**鎵ц Create Story銆?- Create Story 妯℃澘瑕佹眰锛?  - 閫氳繃瀛愪换鍔℃墽琛?`/bmad-bmm-create-story` 绛変环宸ヤ綔娴侊紝鐢熸垚 Epic `{epic_num}`銆丼tory `{epic_num}-{story_num}` 鐨?Story 鏂囨。銆?  - 杈撳嚭 Story 鏂囨。鍒?`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`銆?  - 鍒涘缓 Story 鏂囨。鏃跺繀椤讳娇鐢ㄦ槑纭弿杩帮紝绂佹浣跨敤 Story 绂佹璇嶈〃涓殑璇嶏紙鍙€夈€佸彲鑰冭檻銆佸悗缁€佸厛瀹炵幇銆佸悗缁墿灞曘€佸緟瀹氥€侀厡鎯呫€佽鎯呭喌銆佹妧鏈€猴級銆?  - 褰撳姛鑳戒笉鍦ㄦ湰 Story 鑼冨洿浣嗗睘鏈?Epic 鏃讹紝椤诲啓鏄庛€岀敱 Story X.Y 璐熻矗銆嶅強浠诲姟鍏蜂綋鎻忚堪锛涚‘淇?X.Y 瀛樺湪涓?scope 鍚鍔熻兘銆傜姝㈡ā绯婃帹杩熻〃杩般€?  - **party-mode 寮哄埗**锛氭棤璁?Epic/Story 鏂囨。鏄惁宸插瓨鍦紝鍙娑夊強浠ヤ笅浠讳竴鎯呭舰锛?*蹇呴』**杩涘叆 party-mode 杩涜澶氳鑹茶京璁猴紙鏈€灏?100 杞級锛氣憼 鏈夊涓疄鐜版柟妗堝彲閫夛紱鈶?瀛樺湪鏋舵瀯/璁捐鍐崇瓥鎴?trade-off锛涒憿 鏂规鎴栬寖鍥村瓨鍦ㄦ涔夋垨鏈喅鐐广€?  - 鍏ㄧ▼蹇呴』浣跨敤涓枃銆?- Create Story 浜у嚭鍚庯紝Story 鏂囨。閫氬父淇濆瓨鍦細`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`銆?
#### Subtask Template (STORY-A1-CREATE)

鍙戣捣鍒涘缓 Story 瀛愪换鍔℃椂锛屽繀椤讳娇鐢ㄤ互涓嬪畬鏁存ā鏉匡紙鎵€鏈夊崰浣嶇闇€棰勫厛鏇挎崲锛夛細

**妯℃澘 ID**锛歋TORY-A1-CREATE

```yaml
description: "Create Story {epic_num}-{story_num} via BMAD create-story workflow"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€傝嫢鍙戠幇鏄庢樉缂哄け鎴栨湭鏇挎崲鐨勫崰浣嶇锛岃鍕挎墽琛岋紝骞跺洖澶嶏細璇蜂富 Agent 灏嗘湰 skill 涓樁娈典竴 Create Story prompt 妯℃澘锛圛D STORY-A1-CREATE锛夋暣娈靛鍒跺苟鏇挎崲鍗犱綅绗﹀悗閲嶆柊鍙戣捣銆?
  璇锋墽琛?BMAD Create Story 宸ヤ綔娴侊紝鐢熸垚 Epic {epic_num}銆丼tory {epic_num}-{story_num} 鐨?Story 鏂囨。銆?
  **宸ヤ綔娴佹楠?*锛?  1. 鍔犺浇 {project-root}/_bmad/core/tasks/workflow.xml
  2. 璇诲彇鍏跺叏閮ㄥ唴瀹?  3. 浠?{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml 浣滀负 workflow-config 鍙傛暟
  4. 鎸夌収 workflow.xml 鐨勬寚绀烘墽琛?create-story 宸ヤ綔娴?  5. 杈撳嚭 Story 鏂囨。鍒?{project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md锛坰lug 浠?Story 鏍囬鎴栫敤鎴疯緭鍏ユ帹瀵硷級

  **寮哄埗绾︽潫**锛?  - 鍒涘缓 story 鏂囨。蹇呴』浣跨敤鏄庣‘鎻忚堪锛岀姝娇鐢ㄦ湰 skill銆屄?绂佹璇嶈〃锛圫tory 鏂囨。锛夈€嶄腑鐨勮瘝锛堝彲閫夈€佸彲鑰冭檻銆佸悗缁€佸厛瀹炵幇銆佸悗缁墿灞曘€佸緟瀹氥€侀厡鎯呫€佽鎯呭喌銆佹妧鏈€猴級銆?  - 褰撳姛鑳戒笉鍦ㄦ湰 Story 鑼冨洿浣嗗睘鏈?Epic 鏃讹紝椤诲啓鏄庛€岀敱 Story X.Y 璐熻矗銆嶅強浠诲姟鍏蜂綋鎻忚堪锛涚‘淇?X.Y 瀛樺湪涓?scope 鍚鍔熻兘锛堣嫢 X.Y 涓嶅瓨鍦紝瀹¤灏嗗垽涓嶉€氳繃骞跺缓璁垱寤猴級銆傜姝€屽厛瀹炵幇 X锛屾垨鍚庣画鎵╁睍銆嶃€屽叾浣欑敱 X.Y 璐熻矗銆嶇瓑妯＄硦琛ㄨ堪銆?  - **party-mode 寮哄埗**锛氭棤璁?Epic/Story 鏂囨。鏄惁宸插瓨鍦紝鍙娑夊強浠ヤ笅浠讳竴鎯呭舰锛?*蹇呴』**杩涘叆 party-mode 杩涜澶氳鑹茶京璁猴紙**鏈€灏?100 杞?*锛岃 party-mode step-02 鐨勩€岀敓鎴愭渶缁堟柟妗堝拰鏈€缁堜换鍔″垪琛ㄣ€嶆垨 Create Story 浜у嚭鏂规鍦烘櫙锛夛細鈶?鏈夊涓疄鐜版柟妗堝彲閫夛紱鈶?瀛樺湪鏋舵瀯/璁捐鍐崇瓥鎴?trade-off锛涒憿 鏂规鎴栬寖鍥村瓨鍦ㄦ涔夋垨鏈喅鐐广€?*绂佹**浠ャ€孍pic 宸插瓨鍦ㄣ€嶃€孲tory 宸茬敓鎴愩€嶄负鐢辫烦杩?party-mode銆傚叡璇嗗墠椤昏揪鏈€灏戣疆娆★紱鑻ユ湭杈炬垚鍗曚竴鏂规鎴栦粛鏈夋湭闂悎鐨?gaps/risks锛岀户缁京璁虹洿鑷虫弧瓒虫垨杈句笂闄愯疆娆°€?  - 鍏ㄧ▼蹇呴』浣跨敤涓枃銆?```

**鍗犱綅绗︽浛鎹㈣鏄?*锛?- `{epic_num}` 鈫?瀹為檯 Epic 缂栧彿锛堝 `4`锛?- `{story_num}` 鈫?瀹為檯 Story 缂栧彿锛堝 `1`锛?- `{epic-slug}` 鈫?Epic 鐭悕锛堝 `cli-integration`锛?- `{slug}` 鈫?Story 鐭悕锛堜粠鏍囬鎴栬緭鍏ユ帹瀵硷級
- `{project-root}` 鈫?椤圭洰鏍圭洰褰曠粷瀵硅矾寰?
#### Stage 1 璋冪敤鍓?CLI 杈撳嚭瑕佹眰

涓?Agent 蹇呴』鍦ㄨ皟鐢?Stage 1 鎵ц浣撲箣鍓嶏紝鍏堝湪褰撳墠 session CLI 杈撳嚭浠ヤ笅鏍煎紡鐨勮皟鐢ㄦ憳瑕侊細

```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 1: Create Story - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-story-create
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?epic_num: {瀹為檯鍊紏
  鈥?story_num: {瀹為檯鍊紏
  鈥?epic_slug: {瀹為檯鍊紏
  鈥?story_slug: {瀹為檯鍊紏
  鈥?project_root: {瀹為檯鍊紏

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 sprint-status 鍓嶇疆妫€鏌ヨ姹?  鈹?  鈹溾攢 STORY-A1-CREATE 瀹屾暣妯℃澘
  鈹?  鈹溾攢 party-mode 寮哄埗瑕佹眰锛?00杞京璁猴級
  鈹?  鈹斺攢 Story 绂佹璇嶈〃绾︽潫
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary Executor: bmad-story-create
  鈹?  鈹溾攢 Fallback: 涓?Agent 鐩存帴鎵ц
  鈹?  鈹斺攢 Runtime Contracts: 浜х墿璺緞銆佺姸鎬佹洿鏂?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌?      鈹溾攢 鏈粨鐩綍瑙勮寖
      鈹斺攢 BMAD 鐘舵€佹満鍏煎

棰勬湡浜х墿:
  鈥?Story 鏂囨。: _bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md
  鈥?鐘舵€佹洿鏂? story_created
  鈥?Handoff 鐩爣: bmad-story-audit
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```

杈撳嚭鍚庣珛鍗宠皟鐢?Agent 宸ュ叿銆?
#### Codex no-hooks Runtime Adapter

**鎵ц浣撹皟鐢ㄦ柟寮?*

涓?Agent 浣跨敤鏈?skill 鏃讹紝蹇呴』鎸変互涓嬫柟寮忚皟鐢ㄦ墽琛屼綋锛?
**閲嶈**锛欳odex CLI 鐨?party-mode 鏄惧紡璋冪敤绀轰緥缁熶竴涓?`@"party-mode-facilitator (agent)"`銆傚嚒 Stage 1 闇€瑕?party-mode 杈╄鏃讹紝蹇呴』浼樺厛浠ヨ agent mention 璋冪敤 `.codex/agents/party-mode-facilitator.md`锛涘彧鏈夐潪 specialized 鎵ц浣撴墠缁х画浣跨敤 `general-purpose`銆?
1. **party-mode 杈╄妯″紡**锛堟帹鑽愶紝娑夊強鏂规鍒嗘/鏋舵瀯鍙栬垗/鑼冨洿婢勬竻鏃跺繀椤讳紭鍏堣蛋姝よ矾寰勶級锛?   涓?Agent 鐩存帴璇诲彇 `.codex/agents/party-mode-facilitator.md` 鐨勫畬鏁村唴瀹癸紝骞朵互鏄惧紡 agent mention 璋冪敤锛?   ```yaml
   tool: Agent
   description: "Run Stage 1 Party-Mode debate"
   prompt: |
     @"party-mode-facilitator (agent)"

      ## 鐢ㄦ埛閫夋嫨
      寮哄害: {涓?Agent 鎸夌敤鎴锋槑纭洖澶嶅～鍏ワ紝渚嬪 50 (decision_root_cause_50)}

     [璇诲彇 .codex/agents/party-mode-facilitator.md 鐨勫畬鏁村唴瀹筣

     璁:
     - Story Create 鍓嶇殑鏂规杈╄ / 鑼冨洿婢勬竻 / 鏋舵瀯鍙栬垗
     - 褰撳墠 Epic/Story 杈撳叆涓庣害鏉?     - 浜у嚭鍏辫瘑绾锛屼緵鍚庣画 bmad-story-create 浣跨敤
   ```

2. **鐩存帴鎵ц妯″紡**锛堥潪 party-mode锛屾垨宸叉嬁鍒?facilitator 鍏辫瘑鍚庣户缁敓鎴?Story 鏂囨。锛夛細
   涓?Agent 鐩存帴璇诲彇鏈?skill 涓?Stage 1 鐨勫畬鏁?prompt锛堝惈涓婇潰鐨?Subtask Template锛夛紝鏁存澶嶅埗骞舵浛鎹㈠崰浣嶇鍚庯紝浣跨敤 `Agent` 宸ュ叿璋冪敤鎵ц浣擄細
   ```yaml
   tool: Agent
   subagent_type: general-purpose
   description: "Execute Stage 1 Create Story"
   prompt: |
     [鏈?skill Stage 1 鐨勫畬鏁村唴瀹癸紝鍚?Codex Canonical Base + Subtask Template锛屾墍鏈夊崰浣嶇宸叉浛鎹
   ```

3. **Agent 鏂囦欢寮曠敤妯″紡**锛?   鑻ヤ娇鐢?`.codex/agents/bmad-story-create.md` 浣滀负鎵ц浣擄紝蹇呴』鍏堝皢璇ユ枃浠跺唴瀹瑰畬鏁磋鍏ワ紝鐒跺悗浣滀负 `prompt` 浼犲叆銆傛绫婚潪 specialized 鎵ц浣撶殑 `subagent_type` 浠嶇劧鏄?`general-purpose`锛?   ```yaml
   tool: Agent
   subagent_type: general-purpose
   description: "Create Story via bmad-story-create agent"
   prompt: |
     浣犱綔涓?bmad-story-create 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 1 Create Story 娴佺▼锛?
     [璇诲彇 .codex/agents/bmad-story-create.md 鐨勫畬鏁村唴瀹癸紝鍚細]
     [1. Role]
     [2. Input Reception - 纭鎺ユ敹鍒扮殑鍙傛暟]
     [3. Required Inputs - 鏇挎崲涓哄疄闄呭€糫
     [4. Codex Canonical Base - 瀹屾暣澶嶅埗]
     [5. Subtask Template - 瀹屾暣澶嶅埗锛屽崰浣嶇宸叉浛鎹
     [6. Mandatory Startup]
     [7. Execution Flow]
     [8. Output / Handoff 瑕佹眰]
   ```

**閲嶈**锛?- 涓嶅緱浠呬紶鍏ユ墽琛屼綋鏂囦欢璺緞璁╂墽琛屼綋鑷繁鍘昏锛屽繀椤诲皢瀹屾暣 prompt 鍐呭浼犲叆
- 鎵ц浣撴湰韬笉鍔犺浇 skill锛屾墍鏈夋寚浠ょ敱涓?Agent 閫氳繃 prompt 鍙傛暟浼犻€?- party-mode 杈╄涓昏矾寰勫繀椤讳紭鍏堜娇鐢?`@"party-mode-facilitator (agent)"`
- 鑻ョ敤鎴峰凡鏄庣‘鍥炲 `20` / `50` / `100`锛屼富 Agent 蹇呴』鍏堝皢璇ュ洖澶嶈嚜鍔ㄧ紪璇戞垚 `## 鐢ㄦ埛閫夋嫨` 纭鍧楋紝鍐嶅彂璧?`@"party-mode-facilitator (agent)"`
- 鎵ц浣撹繑鍥炲悗锛屼富 Agent 蹇呴』鏍￠獙 handoff 杈撳嚭锛屽苟鍐冲畾涓嬩竴姝ヨ矾鐢?
---

**Primary Executor**
- `.codex/agents/bmad-story-create.md`锛堥€氳繃 Agent 宸ュ叿璋冪敤锛屽畬鏁?prompt 鐢变富 Agent 浼犲叆锛?
**Optional Reuse**
- 鍙鐢ㄥ凡鏈?discussion / brainstorming / party-mode 绛変环鑳藉姏杈呭姪鐢熸垚 Story 鏂囨。
- 鍙鐢?`speckit-constitution.md`銆乣speckit-analyze.md`銆乣speckit-checklist.md` 浣滀负杈撳叆绾︽潫涓庢鏌ヨ緟鍔?
**Fallback Strategy**
1. 浼樺厛鐢?`bmad-story-create` agent 鐩存帴鐢熸垚 Story 鏂囨。
2. 鑻ラ渶瑕佹繁鍏ヨ璁轰笖 OMC / 瀵硅瘽寮忔墽琛屽櫒鍙敤锛屽垯澶嶇敤鍏跺畬鎴愭柟妗堟敹鏁涳紝浣嗘渶缁?Story 浜х墿浠嶇敱鏈樁娈佃礋璐ｈ惤鐩?3. 鑻ュ閮?executor 涓嶅彲鐢紝鍒欑敱涓?Agent 椤哄簭鎵ц闇€姹傛敹闆嗐€佺粨鏋勫寲鐢熸垚銆佽川閲忚嚜妫€
4. fallback 涓嶅緱鏀瑰彉 Codex Canonical Base 鐨勮涔夎姹?
**Runtime Contracts**
- 浜х墿璺緞锛歚_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md`
- Story 浜у嚭瀹屾垚鍚庯紝蹇呴』灏?story state 鏇存柊涓?`story_created`
- 蹇呴』鍐欏叆 handoff锛屼氦鐢?`bmad-story-audit` 鎵ц Stage 2
- 鑻ョ敤鎴锋槑纭烦杩?Create Story锛屽繀椤昏褰曡烦杩囦緷鎹苟鐩存帴杩涘叆 Story 瀹¤

#### Repo Add-ons

- Story 鏂囨。蹇呴』閬靛畧鏈粨绂佹璇嶈鍒?- Story 鏂囨。蹇呴』鍙璁★紝涓嶅緱鍑虹幇鏃犳硶鏄犲皠鍒板悗缁樁娈电殑妯＄硦鑼冨洿
- 浜у嚭鐩綍涓庡懡鍚嶅繀椤荤鍚堟湰浠?BMAD story 鐩綍瑙勮寖
- 鐘舵€佹枃浠朵笌 handoff 蹇呴』鍏煎 `.codex/state/bmad-progress.yaml` 涓?`.codex/state/stories/*-progress.yaml`

#### Output / Handoff

瀹屾垚鍚庤緭鍑?handoff锛?
```yaml
layer: 3
stage: story_create

execution_summary:
  agent: bmad-story-create
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: sprint_status_check
      status: passed
      result: "sprint-status.yaml 宸茬‘璁?
    - step: story_generation
      status: completed
      result: "Story 鏂囨。宸茬敓鎴?
    - step: document_persistence
      status: completed
      result: "鏂囨。宸插啓鍏?
    - step: state_update
      status: completed
      result: "鐘舵€佸凡鏇存柊涓?story_created"

artifacts:
  story_doc:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md"
    exists: true

handoff:
  next_action: story_audit
  next_agent: bmad-story-audit
  ready: true
  mainAgentNextAction: dispatch_review
  mainAgentReady: true
```

### Stage 2: Story 瀹¤

Claude 绔?Stage 2 Story 瀹¤鎵ц浣擄紝璐熻矗瀹¤ Story 鏂囨。骞跺喅瀹氭槸鍚﹀厑璁歌繘鍏?Dev Story銆?
#### Purpose

鏈樁娈垫槸 Cursor `bmad-story-assistant` 涓?Story 鏂囨。瀹¤闃舵鍦?Codex CLI / OMC 鐜涓嬬殑鎵ц閫傞厤鍣ㄣ€?
鐩爣锛?- 缁ф壙 Cursor Story 瀹¤璇箟
- 瀵?Story 鏂囨。杩涜 pass/fail 鍒ゅ畾
- 瀹¤閫氳繃鍚?handoff 鍒?Dev Story
- 瀹¤澶辫触鍚庡洖鐜慨 Story 鏂囨。

#### Required Inputs

- `storyDocPath`
- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- 鐩稿叧闇€姹傛潵婧?/ Epic / Story 瑙勫垝鏂囨。 / 绾︽潫鏂囨。锛堝瀛樺湪锛?
#### Codex Canonical Base

- 涓绘枃鏈熀绾挎潵婧愶細Cursor `bmad-story-assistant` skill 鐨?Stage 2 Story 瀹¤妯℃澘锛坄STORY-A2-AUDIT`锛夈€?- Story 鏂囨。鐢熸垚鍚庯紝**蹇呴』**鍙戣捣瀹¤瀛愪换鍔★紝杩唬鐩磋嚦銆屽畬鍏ㄨ鐩栥€侀獙璇侀€氳繃銆嶃€?- 涓ユ牸搴﹂€夋嫨锛?  - **strict**锛氳繛缁?3 杞棤 gap + 鎵瑰垽瀹¤鍛?>50%
  - **standard**锛氬崟娆?+ 鎵瑰垽瀹¤鍛?- 閫夋嫨閫昏緫锛?  - 鑻ユ棤 party-mode 浜у嚭鐗╋紙story 鐩綍涓嬫棤 `DEBATE_鍏辫瘑_*`銆乣party-mode 鏀舵暃绾` 绛夛級鎴栫敤鎴疯姹?strict 鈫?浣跨敤 **strict**锛堣ˉ鍋跨己澶辩殑 party-mode 娣卞害锛?  - 鑻ユ湁 party-mode 浜у嚭鐗╁瓨鍦ㄤ笖鐢ㄦ埛鏈己鍒?strict 鈫?浣跨敤 **standard**
- 瀹¤瀛愪唬鐞嗕紭鍏堥『搴忥細
  - 浼樺厛閫氳繃 code-reviewer / 绛夋晥 reviewer 鎵ц Story 瀹¤
  - 鑻?reviewer 涓嶅彲鐢紝鍒欏洖閫€鍒伴€氱敤鎵ц浣擄紝浣嗗繀椤讳紶鍏?**瀹屾暣** `STORY-A2-AUDIT` 妯℃澘锛?*涓嶅緱**浣跨敤鍏朵粬閫氱敤瀹¤鎻愮ず璇嶆浛浠?- 涓?Agent 椤绘暣娈靛鍒?`STORY-A2-AUDIT` 妯℃澘骞舵浛鎹㈠崰浣嶇锛?*绂佹**姒傛嫭銆佺缉鍐欐垨鍙紶鎽樿銆?- 瀹¤鍐呭蹇呴』閫愰」楠岃瘉锛?  1. Story 鏂囨。鏄惁瀹屽叏瑕嗙洊鍘熷闇€姹備笌 Epic 瀹氫箟
  2. 鑻?Story 鏂囨。涓瓨鍦ㄧ姝㈣瘝琛ㄤ换涓€璇嶏紝涓€寰嬪垽涓烘湭閫氳繃
  3. 澶氭柟妗堝満鏅槸鍚﹀凡閫氳繃杈╄杈炬垚鍏辫瘑骞堕€夊畾鏈€浼樻柟妗?  4. 鏄惁鏈夋妧鏈€烘垨鍗犱綅鎬ц〃杩?  5. 鑻?Story 鍚€岀敱 Story X.Y 璐熻矗銆嶏紝椤婚獙璇佸搴?Story 鏂囨。瀛樺湪涓?scope/楠屾敹鏍囧噯鍚浠诲姟鍏蜂綋鎻忚堪锛涘惁鍒欏垽涓嶉€氳繃
- 鎶ュ憡缁撳熬蹇呴』杈撳嚭锛氱粨璁猴紙閫氳繃/鏈€氳繃锛? 蹇呰揪瀛愰」 + Story 闃舵鍙В鏋愯瘎鍒嗗潡锛堟€讳綋璇勭骇 A/B/C/D + 鍥涚淮璇勫垎锛氶渶姹傚畬鏁存€?/ 鍙祴璇曟€?/ 涓€鑷存€?/ 鍙拷婧€э級銆?- 瀹¤閫氳繃鍚庡繀鍋氾細缁熶竴閫氳繃 `runAuditorHost` / 缁熶竴 auditor host runner 瑙﹀彂 story 瀹¤鍚庣殑鑷姩鍔ㄤ綔锛涗富 Agent 涓嶅啀鎵嬪伐缂栨帓 `bmad-speckit score`銆?- 瀹¤鏈€氳繃鏃讹細瀹¤瀛愪唬鐞嗛』鍦ㄦ湰杞唴**鐩存帴淇敼琚 Story 鏂囨。**浠ユ秷闄?gap锛涜嫢寤鸿娑夊強鍒涘缓鎴栨洿鏂板叾浠?Story锛屼富 Agent 椤诲厛鎵ц璇ュ缓璁紝鍐嶉噸鏂板璁″綋鍓?Story銆?- 闃舵浜屽噯鍏ユ鏌ワ細涓?Agent 鍦ㄦ敹鍒伴樁娈典簩閫氳繃缁撹鍚庛€佽繘鍏ラ樁娈典笁涔嬪墠锛屽繀椤荤‘璁ょ粺涓€ auditor host runner 宸插畬鎴?post-audit automation锛涜嫢鏈畬鎴愶紝鍒欏厛琛ヨ窇 runner锛岃€屼笉鏄墜宸ヨˉ score CLI銆?
#### Stage 2 璋冪敤鍓?CLI 杈撳嚭瑕佹眰

涓?Agent 蹇呴』鍦ㄨ皟鐢?Stage 2 鎵ц浣撲箣鍓嶏紝鍏堝湪褰撳墠 session CLI 杈撳嚭浠ヤ笅鏍煎紡鐨勮皟鐢ㄦ憳瑕侊細

```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 2: Story 瀹¤ - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-story-audit
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?storyDocPath: {瀹為檯鍊紏
  鈥?epic_num: {瀹為檯鍊紏
  鈥?story_num: {瀹為檯鍊紏
  鈥?epic_slug: {瀹為檯鍊紏
  鈥?story_slug: {瀹為檯鍊紏

瀹¤涓ユ牸搴?
  鈥?褰撳墠妯″紡: {strict|standard}
  鈥?鍒ゅ畾渚濇嵁: {鏃?party-mode 浜х墿 鈫?strict / 鏈?party-mode 鈫?standard}

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 STORY-A2-AUDIT 瀹屾暣妯℃澘
  鈹?  鈹溾攢 閫愰」楠岃瘉瑕佹眰锛?澶ч獙璇侀」锛?  鈹?  鈹溾攢 鎵瑰垽瀹¤鍛樹粙鍏ヨ姹?  鈹?  鈹斺攢 鍙В鏋愯瘎鍒嗗潡鏍煎紡瑕佹眰
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary Executor: bmad-story-audit
  鈹?  鈹溾攢 Fallback: Codex reviewer 鈫?code-review skill 鈫?涓?Agent
  鈹?  鈹斺攢 Runtime Contracts: 鎶ュ憡璺緞銆佺姸鎬佹洿鏂?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌?      鈹溾攢 鎵瑰垽瀹¤鍛樼粨璁猴紙>50%瀛楁暟锛?      鈹溾攢 runAuditorHost 瑙﹀彂
      鈹斺攢 缁熶竴 auditor host runner 瀹屾垚鎬佹鏌?
棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT_story-{epic_num}-{story_num}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?鐘舵€佹洿鏂? story_audit_passed / story_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```

杈撳嚭鍚庣珛鍗宠皟鐢?Agent 宸ュ叿銆?
#### Codex no-hooks Runtime Adapter

**鎵ц浣撹皟鐢ㄦ柟寮?*

涓?Agent 璋冪敤 Stage 2 鎵ц浣撴椂锛屽繀椤诲皢鏈?skill 涓?Stage 2 鐨勫畬鏁村唴瀹癸紙鍚?Codex Canonical Base 鐨勬墍鏈夊璁¤姹傦級閫氳繃 `Agent` 宸ュ叿浼犲叆锛?
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 2 Story Audit"
prompt: |
  浣犱綔涓?bmad-story-audit 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 2 Story 瀹¤娴佺▼锛?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - storyDocPath: {瀹為檯璺緞}
  - epic_num: {瀹為檯鍊紏
  - story_num: {瀹為檯鍊紏
  - ...

  **Codex Canonical Base - 瀹¤瑕佹眰**锛堝畬鏁村鍒舵湰 skill Stage 2 閮ㄥ垎锛夛細
  [1. Story 鏂囨。鐢熸垚鍚庯紝蹇呴』鍙戣捣瀹¤瀛愪换鍔?..]
  [2. 涓ユ牸搴﹂€夋嫨锛歴trict/standard...]
  [3. 瀹¤鍐呭閫愰」楠岃瘉...]
  [4. 鎶ュ憡缁撳熬蹇呴』杈撳嚭...]
  [5. 瀹¤閫氳繃鍚庡繀鍋?..]

  **Repo Add-ons**锛?  - 蹇呴』鎵ц绂佹璇嶆鏌?  - 蹇呴』杈撳嚭鎵瑰垽瀹¤鍛樼粨璁?  - 蹇呴』杈撳嚭鍙В鏋愯瘎鍒嗗潡

  **Runtime Contracts**锛?  - 瀹¤鎶ュ憡璺緞锛?..
  - 瀹¤閫氳繃鍚庢洿鏂?state 涓?story_audit_passed

  瀹屾垚鍚庤緭鍑?PASS/FAIL handoff 鏍煎紡銆?```

**閲嶈**锛氭墽琛屼綋鏈韩涓嶅姞杞?skill锛屾墍鏈夊璁℃寚浠ゃ€佹鏌ラ」銆佽緭鍑烘牸寮忚姹傚繀椤荤敱涓?Agent 閫氳繃 prompt 鍙傛暟瀹屾暣浼犻€掋€?
---

**Primary Executor**
- `.codex/agents/bmad-story-audit.md`锛堥€氳繃 Agent 宸ュ叿璋冪敤锛屽畬鏁?prompt 鐢变富 Agent 浼犲叆锛?
**Optional Reuse**
- 鍙鐢?`code-review` / reviewer 鑳藉姏杈呭姪鐢熸垚瀹¤鎶ュ憡
- 鍙鐢ㄧ幇鏈変粨搴撳璁℃牸寮忋€佹壒鍒ゅ璁″憳瑕佹眰涓庤瘎鍒嗗潡瑕佹眰

**Fallback Strategy**
1. 浼樺厛鐢?`bmad-story-audit` agent 鎵ц Story 瀹¤
2. 鑻?Codex reviewer 鍙敤锛屽垯澶嶇敤鍏惰繘琛岃緟鍔╁鏌ワ紝浣嗘渶缁堝垽瀹氫粛鐢辨湰闃舵姹囨€诲苟钀界洏
3. 鑻?reviewer 涓嶅彲鐢紝鍒欑敱涓?Agent 鐩存帴鎵ц鍚屼竴浠戒笁灞傜粨鏋勫璁?prompt
4. fallback 涓嶅緱闄嶄綆瀹¤涓ユ牸搴?
**Runtime Contracts**
- 瀹¤鎶ュ憡璺緞锛歚_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md`
- 瀹¤閫氳繃锛氭洿鏂?story state 涓?`story_audit_passed`锛宧andoff 鍒?`speckit-implement`
- 瀹¤澶辫触锛氭洿鏂?story state 涓?`story_audit_failed`锛岃姹備慨 Story 鏂囨。鍚庨噸鏂板璁?
#### Repo Add-ons

- Story 瀹¤蹇呴』鎵ц鏈粨绂佹璇嶆鏌?- 蹇呴』杈撳嚭鎵瑰垽瀹¤鍛樼粨璁?- 蹇呴』鏄庣‘鏍囨敞 pass / fail / required_fixes
- state 涓?handoff 闇€鍏煎鏈粨 BMAD story 鐘舵€佹満

#### Output / Handoff

**PASS**
```yaml
layer: 3
stage: story_audit_passed

execution_summary:
  agent: bmad-story-audit
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: passed
  strictness: {strict|standard}

audit_summary:
  gaps_found: 0
  criteria_verified:
    - requirement_coverage: passed
    - forbidden_words_check: passed
    - multi_solution_consensus: passed
    - tech_debt_check: passed
    - story_references_valid: passed
  critical_auditor_percentage: "{XX}%"
  score_block_generated: true

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md"
    exists: true
  score_data:
    path: "scoring/data/{epic_num}-{story_num}-story-audit.json"
    written: true

handoff:
  next_action: dev_story
  next_agent: speckit-implement
  ready: true
  mainAgentNextAction: dispatch_implement
  mainAgentReady: true
```

**FAIL**
```yaml
layer: 3
stage: story_audit_failed

execution_summary:
  agent: bmad-story-audit
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: failed

audit_summary:
  gaps_found: {N}
  criteria_failed:
    - {鍏蜂綋澶辫触椤箎
  critical_auditor_percentage: "{XX}%"

required_fixes_detail:
  fixes:
    - fix_id: FIX-001
      description: "{淇鎻忚堪}"
      location: "{鏂囨。浣嶇疆}"
      severity: critical|high|medium
  fix_strategy: direct_modify
  iteration_required: true

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
    modified_in_round: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md"
    exists: true

handoff:
  next_action: revise_story
  next_agent: bmad-story-create
  ready: true
  mainAgentNextAction: dispatch_remediation
  mainAgentReady: true
```

### Stage 3: Dev Story / `STORY-A3-DEV`

Claude 绔?Stage 3 Dev Story 鎵ц浣擄紝璐熻矗鎸?TDD 绾㈢豢鐏ā寮忔墽琛屼换鍔″苟瀹屾垚浠ｇ爜瀹炵幇銆?
#### Purpose

鏈樁娈垫槸 Cursor `bmad-story-assistant` 涓?Dev Story 闃舵鍦?Codex CLI / OMC 鐜涓嬬殑鎵ц閫傞厤鍣ㄣ€?
鐩爣锛?- 缁ф壙 Cursor Dev Story 闃舵涓氬姟璇箟
- 涓ユ牸鎵ц TDD 绾㈢豢鐏『搴?- 缁存姢 ralph-method 杩借釜鏂囦欢
- 瀹炴柦鍚庡繀椤诲彂璧?Stage 4 Post Audit

#### Required Inputs

- `tasksPath`: tasks.md 鏂囦欢璺緞
- `epic`: Epic 缂栧彿
- `story`: Story 缂栧彿
- `epicSlug`: Epic 鍚嶇О slug
- `storySlug`: Story 鍚嶇О slug
- `mode`: `bmad` 鎴?`standalone`

#### Codex Canonical Base

- 浠?`STORY-A3-DEV` 涓轰富鏂囨湰鍩虹嚎
- 鍓嶇疆鏂囨。蹇呴』 PASS锛圫tory 瀹¤閫氳繃鐘舵€侊級
- TDD 绾㈢豢鐏『搴忓繀椤诲畬鏁达紙RED 鈫?GREEN 鈫?REFACTOR锛?- 蹇呴』缁存姢 ralph-method 杩借釜鏂囦欢锛坧rd.json + progress.txt锛?- 瀛愪换鍔¤繑鍥炲悗蹇呴』鍙戣捣 `STORY-A4-POSTAUDIT`
- 瀹炴柦杩囩▼涓繀椤婚伒瀹?15 鏉￠搧寰?
#### Subtask Template (STORY-A3-DEV)

```yaml
description: "Execute Dev Story {epic}-{story} via STORY-A3-DEV workflow"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€?
  浣犱綔涓?speckit-implement / bmad-layer4-speckit-implement 鎵ц浣擄紝鎵ц BMAD Stage 3 Dev Story 娴佺▼銆?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - tasksPath: {瀹為檯璺緞}
  - epic: {瀹為檯鍊紏
  - story: {瀹為檯鍊紏
  - epicSlug: {瀹為檯鍊紏
  - storySlug: {瀹為檯鍊紏
  - mode: bmad

  **Codex Canonical Base - Dev Story 瑕佹眰**锛?  1. 鍓嶇疆妫€鏌ワ細Story 瀹¤蹇呴』宸?PASS
  2. 璇诲彇 tasks.md銆乸lan.md銆両MPLEMENTATION_GAPS.md
  2.1 璇诲彇骞堕獙璇?`deferred-gap-register.yaml`
  2.2 璇诲彇骞堕獙璇?`journey-ledger`銆乣trace-map`銆乣closure-notes`
  3. 楠岃瘉 ralph-method 鏂囦欢瀛樺湪锛坧rd.json + progress.txt锛?  4. 閫愪换鍔℃墽琛?TDD 绾㈢豢鐏惊鐜細
     - [TDD-RED] 缂栧啓澶辫触鐨勬祴璇?     - [TDD-GREEN] 缂栧啓鏈€灏忓疄鐜颁娇娴嬭瘯閫氳繃
     - [TDD-REFACTOR] 閲嶆瀯浠ｇ爜
  5. 瀹炴椂鏇存柊 ralph-method 杩借釜鏂囦欢
  6. 鎵ц batch 闂村璁″拰鏈€缁堝璁?  6.1 鑻ュ瓨鍦?active deferred gap 浣嗘棤 task binding銆丼moke Task Chain銆丆losure Task ID 鎴?production path 鏄犲皠锛屼笉寰楃户缁疄鏂?  6.2 鑻?Journey runnable 鐘舵€佸彂鐢熷彉鍖栵紝蹇呴』鍚屾鏇存柊 `deferred-gap-register`銆乣journey-ledger`銆乣trace-map`銆乣closure-notes`
  7. 瀹屾垚鍚庡繀椤诲彂璧?STORY-A4-POSTAUDIT

  **寮哄埗绾︽潫**锛?  - 绂佹鍦ㄦ湭鍒涘缓 prd/progress 鍓嶅紑濮嬬紪鐮?  - 绂佹鍏堝啓鐢熶骇浠ｇ爜鍐嶈ˉ娴嬭瘯
  - 绂佹璺宠繃閲嶆瀯闃舵
  - 蹇呴』閬靛畧 15 鏉￠搧寰?
  **Repo Add-ons**锛?  - 鏇存柊 `.codex/state/stories/{epic}-{story}-progress.yaml` 涓?`implement_in_progress` / `implement_passed`
  - 鎵ц `run-auditor-host.ts` 璁板綍杩涘害
  - handoff 鍒?Stage 4 Post Audit
```

#### Stage 3 璋冪敤鍓?CLI 杈撳嚭瑕佹眰

涓?Agent 蹇呴』鍦ㄨ皟鐢?Stage 3 鎵ц浣撲箣鍓嶏紝鍏堝湪褰撳墠 session CLI 杈撳嚭浠ヤ笅鏍煎紡鐨勮皟鐢ㄦ憳瑕侊細

```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 3: Dev Story - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-layer4-dev-story
type: agent-sequence (5 sub-agents)
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?epic: {瀹為檯鍊紏
  鈥?story: {瀹為檯鍊紏
  鈥?epicSlug: {瀹為檯鍊紏
  鈥?storySlug: {瀹為檯鍊紏
  鈥?mode: {瀹為檯鍊紏

TDD 绾㈢豢鐏『搴忓己璋?
  1. RED: 鍏堝啓娴嬭瘯 鈫?娴嬭瘯澶辫触
  2. GREEN: 瀹炵幇浠ｇ爜 鈫?娴嬭瘯閫氳繃
  3. IMPROVE: 閲嶆瀯浠ｇ爜 鈫?淇濇寔閫氳繃

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 Layer 4 浜旈樁娈垫墽琛屽簭鍒?(specify 鈫?plan 鈫?gaps 鈫?tasks 鈫?implement)
  鈹?  鈹溾攢 姣忛樁娈?handoff 妫€鏌ョ偣
  鈹?  鈹斺攢 寮哄埗 TDD 瑕佹眰
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary: bmad-layer4-dev-story (sequence coordinator)
  鈹?  鈹溾攢 Sub-agents: specify, plan, gaps, tasks, implement
  鈹?  鈹斺攢 Runtime Contracts: 姣忛樁娈典骇鐗╄矾寰勩€佺姸鎬佹洿鏂?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌?      鈹溾攢 ralph-method 杩借釜
      鈹斺攢 TDD 璇佹嵁瀹℃煡

棰勬湡浜х墿:
  鈥?璁捐鏂囨。: _bmad-output/.../DESIGN-{epic}-{story}.md
  鈥?瀹炵幇浠ｇ爜: src/... (鏍规嵁 story 鑰屽畾)
  鈥?娴嬭瘯浠ｇ爜: tests/... (鏍规嵁 story 鑰屽畾)
  鈥?鐘舵€佹洿鏂? story_development_completed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```

杈撳嚭鍚庣珛鍗宠皟鐢?Agent 宸ュ叿銆?
#### Codex no-hooks Runtime Adapter

**鎵ц浣撹皟鐢ㄦ柟寮?*

涓?Agent 璋冪敤 Stage 3 鎵ц浣撴椂锛屽繀椤诲皢鏈?skill 涓?Stage 3 鐨勫畬鏁村唴瀹归€氳繃 `Agent` 宸ュ叿浼犲叆锛?
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 3 Dev Story"
prompt: |
  浣犱綔涓?speckit-implement / bmad-layer4-speckit-implement 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 3 Dev Story 娴佺▼锛?
  [鏈?skill Stage 3 鐨勫畬鏁村唴瀹癸紝鍚?Required Inputs銆丆ursor Canonical Base銆丼ubtask Template锛屾墍鏈夊崰浣嶇宸叉浛鎹
```

**閲嶈**锛氭墽琛屼綋鏈韩涓嶅姞杞?skill锛屾墍鏈夋寚浠ょ敱涓?Agent 閫氳繃 prompt 鍙傛暟瀹屾暣浼犻€掋€?
---

**Primary Executor**
- `.codex/agents/speckit-implement.md`
- `.codex/agents/layers/bmad-layer4-speckit-implement.md`锛圔MAD 妯″紡锛?
**Fallback Strategy**
1. 浼樺厛鐢?speckit-implement / bmad-layer4-speckit-implement 鎵ц
2. 鑻ヤ笉鍙敤锛屽洖閫€鍒颁富 Agent 鐩存帴鎵ц TDD 寰幆
3. batch 瀹¤涓庢渶缁堝璁＄敱 `auditor-implement` 鎴栦富 Agent 鎵ц

**Runtime Contracts**
- 蹇呴』鍒涘缓/鏇存柊 ralph-method 杩借釜鏂囦欢锛坧rd.json + progress.txt锛?- 蹇呴』鎸?TDD 椤哄簭鎵ц锛圧ED 鈫?GREEN 鈫?REFACTOR锛?- 姣忎釜 User Story 瀹屾垚鍚庢洿鏂?prd.json passes 鐘舵€?- 蹇呴』璁板綍 TDD 寰幆鍒?progress.txt
- 瀹炴柦鍚庡繀椤昏Е鍙?Stage 4 Post Audit
- 涓嶅緱鍙嬀閫?tasks 澶嶉€夋鑰屼笉鏇存柊 `deferred-gap-register`銆乣journey-ledger`銆乣trace-map`銆乣closure-notes`

#### Repo Add-ons

- progress / prd 鏇存柊瑕佹眰
- 鏈粨 scoring / handoff / lint / key path 瑕佹眰
- 涓ユ牸鏀舵暃妫€鏌ワ紙continuous 3 rounds no gap锛?- 鎵瑰垽瀹¤鍛樹粙鍏?
#### Output / Handoff

瀹屾垚鍚庤緭鍑?handoff锛?
```yaml
layer: 4
stage: implement_passed

execution_summary:
  agent: speckit-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: party_mode_check
      status: passed
      result: "party-mode.yaml 宸茬‘璁?
    - step: spec_read
      status: completed
      result: "spec.md 宸茶鍙?
    - step: plan_read
      status: completed
      result: "plan.md 宸茶鍙?
    - step: tasks_read
      status: completed
      result: "tasks.md 宸茶鍙?
    - step: tdd_red
      status: completed
      result: "娴嬭瘯宸茬紪鍐欙紝澶辫触鐘舵€佺‘璁?
    - step: tdd_green
      status: completed
      result: "瀹炵幇宸茬紪鍐欙紝娴嬭瘯閫氳繃"
    - step: tdd_refactor
      status: completed
      result: "浠ｇ爜宸查噸鏋?
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_passed"

tdd_summary:
  red_phase:
    tests_written: {count}
    tests_failed_initially: {count}
    status: completed
  green_phase:
    implementation_complete: true
    tests_passing: {count}
    status: completed
  refactor_phase:
    code_quality_checks_passed: true
    test_coverage: "{percent}%"
    status: completed

ralph_method_status:
  prd_json_updated: true
  progress_txt_updated: true
  passes_status: "all_passed"

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  implementation_code:
    path: "{implementationPath}"
    exists: true
    file_count: {count}
  test_files:
    path: "{testPath}"
    exists: true
    coverage: "{percent}%"
  ralph_artifacts:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/"
    files:
      - "prd.json"
      - "progress.txt"

handoff:
  next_action: post_audit
  next_agent: auditor-implement
  next_stage: 4
  ready: true
  mainAgentNextAction: dispatch_review
  mainAgentReady: true
  prerequisites_met:
    - tdd_cycle_complete
    - ralph_method_tracked
    - state_updated
```

**Runtime Governance (S11 - post-audit):** 涓?Agent 鍦ㄨ皟鐢?post-audit 瀛愪换鍔′箣鍓嶆墽琛岋細
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit`
瀛愪换鍔¤繑鍥炰箣鍚庢墽琛岋細
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit --persist`
`{story_key}` 涓哄綋鍓?Story 鐨?kebab-case key銆?
### Stage 4: Post Audit / `STORY-A4-POSTAUDIT`

Claude 绔?Stage 4 Post Audit 鎵ц浣擄紝璐熻矗瀵?Dev Story 瀹炴柦缁撴灉杩涜涓ユ牸瀹¤銆?
#### Purpose

鏈樁娈垫槸 Cursor `bmad-story-assistant` 涓?Post Audit 闃舵鍦?Codex CLI / OMC 鐜涓嬬殑鎵ц閫傞厤鍣ㄣ€?
鐩爣锛?- 缁ф壙 Cursor Post Audit 璇箟
- 楠岃瘉浠ｇ爜瀹炵幇瀹屽叏瑕嗙洊 tasks銆乻pec銆乸lan
- 涓撻」瀹℃煡 TDD 鎵ц璇佹嵁鍜?ralph-method 杩借釜鏂囦欢
- 鍐冲畾鏄惁鍏佽杩涘叆 commit gate

#### Required Inputs

- `artifactDocPath`: 琚浠ｇ爜/鏂囨。璺緞
- `reportPath`: 瀹¤鎶ュ憡淇濆瓨璺緞
- `tasksPath`: tasks.md 璺緞锛堝鐓х敤锛?- `specPath`: spec.md 璺緞锛堝鐓х敤锛屽彲閫夛級
- `planPath`: plan.md 璺緞锛堝鐓х敤锛屽彲閫夛級
- `epic`: Epic 缂栧彿
- `story`: Story 缂栧彿
- `epicSlug`: Epic 鍚嶇О slug
- `storySlug`: Story 鍚嶇О slug
- `iterationCount`: 褰撳墠杩唬杞暟锛堥粯璁?0锛?- `strictness`: 涓ユ牸搴︽ā寮忥紙simple/standard/strict锛岄粯璁?standard锛?
#### Codex Canonical Base

- 浠?Cursor post-audit 璇箟涓哄熀绾?- post-audit 鏄繀椤绘楠わ紝闈炲彲閫?- 琚瀵硅薄鏄?*浠ｇ爜瀹炵幇**锛屼笉鏄枃妗?- 鍙戠幇 gap 鏃?*涓嶇洿鎺ヤ慨鏀逛唬鐮?*锛堢敱涓?Agent 濮旀墭瀹炴柦瀛愪唬鐞嗕慨鏀癸級
- 浣跨敤 **code 妯″紡缁村害**锛堝姛鑳芥€с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級
- 蹇呴』楠岃瘉 TDD 绾㈢豢鐏墽琛岃瘉鎹?- 蹇呴』妫€鏌?ralph-method 杩借釜鏂囦欢
- 瀹¤閫氳繃鍚庡繀椤昏Е鍙?`runAuditorHost`
- 蹇呴』棰濆妫€鏌?`deferred-gap-register` 鐨?closure / carry-forward evidence
- 蹇呴』棰濆妫€鏌?`Production Path`銆乣Smoke Proof`銆乣Full E2E` / defer reason銆乣Closure Note`銆乣Acceptance Evidence`
- 鑻ュ嚭鐜?`module complete but journey not runnable`锛屽繀椤诲垽澶辫触骞跺洖閫€鍒?Stage 3 淇

#### Subtask Template (STORY-A4-POSTAUDIT)

```yaml
description: "Execute Post Audit for {epic}-{story} via STORY-A4-POSTAUDIT"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€?
  浣犱綔涓?auditor-implement 鎵ц浣擄紝鎵ц BMAD Stage 4 Post Audit 娴佺▼銆?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - artifactDocPath: {瀹為檯璺緞}
  - reportPath: {瀹為檯璺緞}
  - tasksPath: {瀹為檯璺緞}
  - specPath: {瀹為檯璺緞}
  - planPath: {瀹為檯璺緞}
  - epic: {瀹為檯鍊紏
  - story: {瀹為檯鍊紏
  - iterationCount: {瀹為檯鍊紏
  - strictness: {standard|strict}

  **Codex Canonical Base - Post Audit 瑕佹眰**锛?  1. 璇诲彇 audit-prompts.md 搂5
  2. 璇诲彇鎵瑰垽瀹¤鍛樿鑼?  3. 璇诲彇瀹炴柦鍚庡璁¤鍒?  4. 璇诲彇 tasks.md銆乻pec.md銆乸lan.md 浣滀负瀵圭収鍩虹嚎
  5. 璇诲彇 ralph-method 杩借釜鏂囦欢锛坧rd.json + progress.txt锛?  6. 閫愰」楠岃瘉浠ｇ爜瀹炵幇瑕嗙洊搴?  7. 涓撻」瀹℃煡 TDD 绾㈢豢鐏墽琛岃瘉鎹?  8. 鐢熸垚鍖呭惈鎵瑰垽瀹¤鍛樼粨璁虹殑瀹屾暣鎶ュ憡
  9. 鎶ュ憡缁撳熬杈撳嚭鍙В鏋愯瘎鍒嗗潡

  **瀹¤缁村害**锛?  - 鍔熻兘鎬у疄鐜板畬鏁存€?  - 浠ｇ爜璐ㄩ噺鏍囧噯
  - 娴嬭瘯瑕嗙洊鐜?  - 瀹夊叏鎬ф鏌?
  **Repo Add-ons**锛?  - 绂佹璇嶆鏌?  - 鎵瑰垽瀹¤鍛樼粨璁?  - runAuditorHost 瑙﹀彂
  - commit gate 鍓嶇疆鏉′欢妫€鏌?```

#### Stage 4 璋冪敤鍓?CLI 杈撳嚭瑕佹眰

涓?Agent 蹇呴』鍦ㄨ皟鐢?Stage 4 鎵ц浣撲箣鍓嶏紝鍏堝湪褰撳墠 session CLI 杈撳嚭浠ヤ笅鏍煎紡鐨勮皟鐢ㄦ憳瑕侊細

```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 4: Post Audit - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? bmad-story-post-audit
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

杈撳叆鍙傛暟:
  鈥?artifactDocPath: {瀹為檯鍊紏
  鈥?reportPath: {瀹為檯鍊紏
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?specPath: {瀹為檯鍊紏
  鈥?planPath: {瀹為檯鍊紏
  鈥?gapsPath: {瀹為檯鍊紏
  鈥?implementationPath: {瀹為檯鍊紏

浠ｇ爜妯″紡缁村害寮鸿皟:
  鈥?绂佹璇嶆鏌? 鏃犳ā绯婅〃杩般€佹棤寤舵湡鎵胯
  鈥?涓€鑷存€ф鏌? 瀹炵幇涓?spec/plan/tasks 瀵归綈
  鈥?TDD 璇佹嵁瀹℃煡: 娴嬭瘯瑕嗙洊鐜?鈮?80%
  鈥?浠ｇ爜璐ㄩ噺: 鍑芥暟 < 50 琛岋紝鏂囦欢 < 800 琛?
strict convergence 妫€鏌?
  鈥?绗?杞? 鍒濇瀹¤锛屽彂鐜版墍鏈?gap
  鈥?绗?杞? 楠岃瘉淇锛岀‘璁ゆ棤鏂?gap
  鈥?绗?杞? 鏈€缁堢‘璁わ紝杈撳嚭閫氳繃鏍囪

鎻愮ず璇嶇粨鏋勬憳瑕?
  鈹溾攢 Codex Canonical Base
  鈹?  鈹溾攢 POST-AUDIT-PROTOCOL 瀹屾暣妯℃澘
  鈹?  鈹溾攢 5澶т唬鐮佸璁＄淮搴︼紙绂佹璇?涓€鑷存€?TDD/璐ㄩ噺/瀹夊叏锛?  鈹?  鈹溾攢 鎵瑰垽瀹¤鍛樹粙鍏ヨ姹?  鈹?  鈹斺攢 鍙В鏋愯瘎鍒嗗潡鏍煎紡
  鈹溾攢 Codex no-hooks Runtime Adapter
  鈹?  鈹溾攢 Primary Executor: bmad-story-post-audit
  鈹?  鈹溾攢 Fallback: auditor-spec/plan/tasks/implement 搴忓垪
  鈹?  鈹斺攢 Runtime Contracts: 瀹¤鎶ュ憡璺緞銆佽瘎鍒嗗啓鍏?  鈹斺攢 Repo Add-ons
      鈹溾攢 绂佹璇嶆鏌ワ紙鍚唬鐮佹敞閲婏級
      鈹溾攢 鎵瑰垽瀹¤鍛樼粨璁猴紙>50%瀛楁暟锛?      鈹溾攢 runAuditorHost 瑙﹀彂
      鈹斺攢 strict 妯″紡 3 杞敹鏁?
棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?鐘舵€佹洿鏂? story_audit_passed / story_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```

杈撳嚭鍚庣珛鍗宠皟鐢?Agent 宸ュ叿銆?
#### Codex no-hooks Runtime Adapter

**鎵ц浣撹皟鐢ㄦ柟寮?*

涓?Agent 璋冪敤 Stage 4 鎵ц浣撴椂锛屽繀椤诲皢鏈?skill 涓?Stage 4 鐨勫畬鏁村唴瀹归€氳繃 `Agent` 宸ュ叿浼犲叆锛?
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 4 Post Audit"
prompt: |
  浣犱綔涓?auditor-implement 鎵ц浣擄紝鎵ц浠ヤ笅 Stage 4 Post Audit 娴佺▼锛?
  [鏈?skill Stage 4 鐨勫畬鏁村唴瀹癸紝鍚?Required Inputs銆丆ursor Canonical Base銆丼ubtask Template锛屾墍鏈夊崰浣嶇宸叉浛鎹
```

**閲嶈**锛氭墽琛屼綋鏈韩涓嶅姞杞?skill锛屾墍鏈夊璁℃寚浠ょ敱涓?Agent 閫氳繃 prompt 鍙傛暟瀹屾暣浼犻€掋€?
---

**Primary Executor**
- `.codex/agents/auditors/auditor-implement.md`

**Fallback Strategy**
1. 浼樺厛鐢?`auditor-implement` agent 鎵ц Post Audit
2. 鑻ヤ笉鍙敤锛屽洖閫€鍒?Codex reviewer
3. 鍐嶄笉鍙敤锛屽洖閫€鍒?`code-review` skill
4. 鏈€鍚庡洖閫€鍒颁富 Agent 鐩存帴鎵ц鍚屼竴浠戒笁灞?audit prompt

**Runtime Contracts**
- 瀹¤鎶ュ憡璺緞锛歚_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md`
- 瀹¤閫氳繃鍚庡繀椤绘墽琛?`run-auditor-host.ts`
- 瀹¤閫氳繃鍚庢洿鏂?story state 涓?`implement_passed`
- 瀹¤澶辫触鍚庢洿鏂?story state 涓?`implement_failed`锛屽洖閫€鍒?Stage 3 淇

#### Repo Add-ons

- strict convergence锛堣繛缁?3 杞棤 gap锛?- 鎵瑰垽瀹¤鍛樼粨璁?- runAuditorHost 瑙﹀彂
- commit gate 鍓嶇疆鏉′欢妫€鏌?- 鏈粨绂佹璇嶆鏌?
#### Output / Handoff

**PASS**
```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "浠ｇ爜瀹炵幇宸茶鍙?
    - step: tasks_comparison
      status: completed
      result: "tasks 瑕嗙洊搴﹀凡楠岃瘉"
    - step: spec_comparison
      status: completed
      result: "spec 瀵归綈搴﹀凡楠岃瘉"
    - step: tdd_evidence_review
      status: completed
      result: "TDD 绾㈢豢鐏瘉鎹凡瀹℃煡"
    - step: ralph_method_check
      status: completed
      result: "ralph-method 杩借釜鏂囦欢宸叉鏌?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: parse_and_write_score
      status: completed
      result: "璇勫垎宸插啓鍏?scoring/data/"
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_audit_passed"

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  tdd_evidence:
    red_phase_confirmed: true
    green_phase_confirmed: true
    refactor_phase_confirmed: true
    test_coverage: "{percent}%"
  ralph_method_check:
    prd_json_complete: true
    progress_txt_complete: true
    all_stories_passed: true
  code_quality:
    avg_function_lines: {number}
    avg_file_lines: {number}
    no_banned_words: true
    security_checks_passed: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  mainAgentNextAction: run_closeout
  mainAgentReady: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**FAIL**
```yaml
layer: 4
stage: implement_audit_failed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "浠ｇ爜瀹炵幇宸茶鍙?
    - step: tasks_comparison
      status: failed
      result: "鍙戠幇 tasks 鏈鐩栭」"
    - step: spec_comparison
      status: failed
      result: "鍙戠幇 spec 鍋忕椤?
    - step: tdd_evidence_review
      status: failed
      result: "TDD 璇佹嵁涓嶈冻"
    - step: ralph_method_check
      status: failed
      result: "ralph-method 杩借釜涓嶅畬鏁?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: gap_documentation
      status: completed
      result: "鎵€鏈?gap 宸茶褰?

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  gaps_found:
    total: {count}
    critical: {count}
    major: {count}
    minor: {count}
  required_fixes:
    - category: "tasks_coverage"
      description: "{gap_description}"
      priority: critical
    - category: "spec_alignment"
      description: "{gap_description}"
      priority: major
    - category: "tdd_evidence"
      description: "{gap_description}"
      priority: major
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "FAIL"
    critical_gaps: {count}

required_fixes_detail:
  fix_strategy: "return_to_stage_3"
  estimated_fix_time: "{duration}"
  fix_categories:
    - category: "implementation"
      items: [{gap_items}]
    - category: "tests"
      items: [{gap_items}]
    - category: "documentation"
      items: [{gap_items}]

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  gaps_list:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/GAPS_{epic}-{story}_stage4.md"
    exists: true

handoff:
  next_action: fix_implement
  next_agent: speckit-implement
  next_stage: 3
  ready: true
  mainAgentNextAction: dispatch_remediation
  mainAgentReady: true
  fix_required: true
  prerequisites_met:
    - audit_completed
    - gaps_documented
    - reviewer_conclusion_verified
```

---

#### Story Type Detection (Code vs Document Mode)

Stage 4 鏀寔涓ょ瀹¤妯″紡锛屾牴鎹?Story 绫诲瀷鑷姩璺敱锛?
| Story 绫诲瀷 | 妫€娴嬩緷鎹?| 瀹¤妯″紡 | 鎵ц浣?|
|-----------|---------|---------|--------|
| **浠ｇ爜瀹炵幇鍨?* | tasks.md 鍖呭惈浠ｇ爜浠诲姟銆乻pec.md 瀹氫箟鎺ュ彛/瀹炵幇 | Code Mode | `auditor-implement` |
| **鏂囨。楠岃瘉鍨?* | tasks.md 浠诲姟涓虹函鏂囨。/楠岃瘉宸ヤ綔锛屾棤鐢熶骇浠ｇ爜 | Document Mode | `auditor-document` |

**鑷姩妫€娴嬮€昏緫**锛堜富 Agent 鎵ц锛夛細

```typescript
// TypeScript 妫€娴嬮€昏緫绀轰緥
function detectStoryType(tasksPath: string, specPath?: string): 'code' | 'document' {
  const tasksContent = readFile(tasksPath);

  // 鏂囨。鍨嬬壒寰侊細浠诲姟鍧囦负鏂囨。鍒涘缓銆侀獙璇併€佹祴璇曢厤缃瓑
  const documentPatterns = [
    /鍒涘缓.*鏂囨。/i,
    /楠岃瘉.*杈撳嚭/i,
    /妫€鏌?*閰嶇疆/i,
    /娴嬭瘯.*Story/i,
    /鏂囨。.*鐢熸垚/i,
    /鏍煎紡.*楠岃瘉/i,
  ];

  // 浠ｇ爜鍨嬬壒寰侊細娑夊強鐢熶骇浠ｇ爜銆佹帴鍙ｅ疄鐜般€佹ā鍧楀紑鍙?  const codePatterns = [
    /瀹炵幇.*鍑芥暟/i,
    /鍒涘缓.*妯″潡/i,
    /娣诲姞.*鎺ュ彛/i,
    /缂栧啓.*浠ｇ爜/i,
    /寮€鍙?*鍔熻兘/i,
    /refactor|閲嶆瀯/i,
  ];

  const docMatches = documentPatterns.filter(p => p.test(tasksContent)).length;
  const codeMatches = codePatterns.filter(p => p.test(tasksContent)).length;

  // 浼樺厛鍒ゆ柇锛氬鏋滄湁浠ｇ爜鐩稿叧浠诲姟锛岃涓轰唬鐮佸瀷
  if (codeMatches > 0) return 'code';
  if (docMatches > 0 && codeMatches === 0) return 'document';

  // 榛樿淇濆畧绛栫暐锛氭寜浠ｇ爜鍨嬪鐞嗭紙鏇翠弗鏍硷級
  return 'code';
}
```

#### Extended Codex Canonical Base (Code vs Document)

**Code Mode锛堜唬鐮佸璁℃ā寮忥級**锛?
- 琚瀵硅薄鏄?*浠ｇ爜瀹炵幇**锛屼笉鏄枃妗?- 鍙戠幇 gap 鏃?*涓嶇洿鎺ヤ慨鏀逛唬鐮?*锛堢敱涓?Agent 濮旀墭瀹炴柦瀛愪唬鐞嗕慨鏀癸級
- 浣跨敤 **code 妯″紡缁村害**锛堝姛鑳芥€с€佷唬鐮佽川閲忋€佹祴璇曡鐩栥€佸畨鍏ㄦ€э級
- 蹇呴』楠岃瘉 TDD 绾㈢豢鐏墽琛岃瘉鎹?- 蹇呴』妫€鏌?ralph-method 杩借釜鏂囦欢
- 瀹¤閫氳繃鍚庡繀椤昏Е鍙?`runAuditorHost`

**Document Mode锛堟枃妗ｅ璁℃ā寮忥級**锛?
- 琚瀵硅薄鏄?*Story 鏂囨。鏈韩**锛屼笉鏄唬鐮?- 鍙戠幇 gap 鏃?*鐩存帴淇敼琚鏂囨。**锛坅uditor 鑷淇锛?- 浣跨敤 **document 妯″紡缁村害**锛堟枃妗ｅ畬鏁存€с€佷换鍔″畬鎴愬害銆佷竴鑷存€с€佸彲杩芥函鎬э級
- 鏃犻渶妫€鏌?TDD 璇佹嵁锛堟棤浠ｇ爜锛?- 鏃犻渶妫€鏌?ralph-method 鏂囦欢锛堟棤浠ｇ爜锛?- 蹇呴』楠岃瘉 tasks.md 涓墍鏈変换鍔″凡鏍囪瀹屾垚
- 瀹¤閫氳繃鍚庡繀椤昏Е鍙?`runAuditorHost`

#### Code vs Document 瀹¤瀵规瘮

| 椤圭洰 | Code 瀹¤锛坅uditor-implement锛?| Document 瀹¤锛坅uditor-document锛?|
|------|-------------------------------|----------------------------------|
| **琚瀵硅薄** | 浠ｇ爜瀹炵幇 | Story 鏂囨。鏈韩 |
| **鍙戠幇 gap 鏃?* | **涓嶄慨鏀逛唬鐮?*锛堜富 Agent 濮旀墭淇敼锛?| **鐩存帴淇敼鏂囨。**锛坅uditor 鑷淇锛?|
| **缁村害** | 鍔熻兘鎬?浠ｇ爜璐ㄩ噺/娴嬭瘯瑕嗙洊/瀹夊叏鎬?| 鏂囨。瀹屾暣鎬?浠诲姟瀹屾垚搴?涓€鑷存€?鍙拷婧€?|
| **TDD 妫€鏌?* | 閫?US 寮哄埗妫€鏌?| 鏃狅紙鏃犱唬鐮侊級 |
| **ralph-method** | 寮哄埗妫€鏌?prd.json + progress.txt | 鏃狅紙鏃犱唬鐮侊級 |
| **tasks 妫€鏌?* | 楠岃瘉浠ｇ爜瑕嗙洊 tasks | 楠岃瘉浠诲姟鏍囪瀹屾垚 |
| **绂佹璇嶆鏌?* | progress.txt + 浠ｇ爜娉ㄩ噴 | Story 鏂囨。鍏ㄦ枃 |
| **杩唬鏀舵暃** | 杩炵画 3 杞棤 gap锛坰trict锛?| 杩炵画 3 杞棤 gap锛坰trict锛?|
| **鎵瑰垽瀹¤鍛?* | 鈮?0% 瀛楁暟 | 鈮?0% 瀛楁暟 |

---

### Document Mode Subtask Template (STORY-A4-DOCUMENT-AUDIT)

```yaml
description: "Execute Document Post Audit for {epic}-{story} via STORY-A4-DOCUMENT-AUDIT"
prompt: |
  銆愬繀璇汇€戞湰 prompt 椤讳负瀹屾暣妯℃澘涓旀墍鏈夊崰浣嶇宸叉浛鎹€?
  浣犱綔涓?auditor-document 鎵ц浣擄紝鎵ц BMAD Stage 4 Post Audit锛堟枃妗ｅ璁℃ā寮忥級娴佺▼銆?
  **Required Inputs**锛堝凡鏇挎崲涓哄疄闄呭€硷級锛?  - artifactDocPath: {瀹為檯璺緞}锛堣瀹?Story 鏂囨。璺緞锛?  - tasksPath: {瀹為檯璺緞}锛堥獙璇佷换鍔″畬鎴愮姸鎬侊級
  - reportPath: {瀹為檯璺緞}锛堝璁℃姤鍛婁繚瀛樿矾寰勶級
  - epic: {瀹為檯鍊紏
  - story: {瀹為檯鍊紏
  - iterationCount: {瀹為檯鍊紏
  - strictness: {standard|strict}

  **Codex Canonical Base - Document Audit 瑕佹眰**锛?  1. 璇诲彇 audit-prompts.md 搂1锛堝€熺敤 spec 瀹¤鐨勬枃妗ｆ鏌ユ柟娉曪級
  2. 璇诲彇鎵瑰垽瀹¤鍛樿鑼?  3. 璇诲彇鏂囨。杩唬瑙勫垯
  4. 璇诲彇琚 Story 鏂囨。
  5. 璇诲彇 tasks.md锛岄獙璇佹墍鏈変换鍔″凡鏍囪瀹屾垚
  6. 妫€鏌?Story 鏂囨。璐ㄩ噺锛堝畬鏁存€с€佸噯纭€с€佽鑼冩€э級
  7. 妫€鏌ユ枃妗ｄ腑鏃犵姝㈣瘝銆佹棤妯＄硦琛ㄨ堪
  8. 鍙戠幇 gap 鏃剁洿鎺ヤ慨鏀硅瀹℃枃妗?  9. 鐢熸垚鍖呭惈鎵瑰垽瀹¤鍛樼粨璁虹殑瀹屾暣鎶ュ憡
  10. 鎶ュ憡缁撳熬杈撳嚭鍙В鏋愯瘎鍒嗗潡

  **瀹¤缁村害**锛圖ocument Mode锛夛細
  - 鏂囨。瀹屾暣鎬э細缁撴瀯瀹屾暣銆佺珷鑺傞綈鍏ㄣ€佹牸寮忚鑼?  - 浠诲姟瀹屾垚搴︼細tasks.md 涓墍鏈変换鍔″凡鏍囪瀹屾垚
  - 涓€鑷存€э細鏂囨。鍐呴儴涓€鑷淬€佷笌鍓嶇疆鏂囨。涓€鑷?  - 鍙拷婧€э細闇€姹傚彲杩芥函鍒伴獙鏀舵爣鍑?
  **Repo Add-ons**锛?  - 绂佹璇嶆鏌ワ紙Story 鏂囨。鍏ㄦ枃锛?  - 鎵瑰垽瀹¤鍛樼粨璁猴紙>50%瀛楁暟锛?  - runAuditorHost 瑙﹀彂
  - commit gate 鍓嶇疆鏉′欢妫€鏌?```

---

#### Stage 4 璋冪敤鍓?CLI 杈撳嚭瑕佹眰锛堝弻妯″紡锛?
**Code Mode 璋冪敤鎽樿**锛?
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 4: Post Audit (Code Mode) - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? auditor-implement
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

Story 绫诲瀷妫€娴?
  鈥?妫€娴嬩緷鎹? tasks.md 鍐呭鍒嗘瀽
  鈥?妫€娴嬬粨鏋? 浠ｇ爜瀹炵幇鍨嬶紙Code Mode锛?
杈撳叆鍙傛暟:
  鈥?artifactDocPath: {瀹為檯鍊紏
  鈥?reportPath: {瀹為檯鍊紏
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?specPath: {瀹為檯鍊紏
  鈥?planPath: {瀹為檯鍊紏

浠ｇ爜妯″紡缁村害寮鸿皟:
  鈥?绂佹璇嶆鏌? 鏃犳ā绯婅〃杩般€佹棤寤舵湡鎵胯
  鈥?涓€鑷存€ф鏌? 瀹炵幇涓?spec/plan/tasks 瀵归綈
  鈥?TDD 璇佹嵁瀹℃煡: 娴嬭瘯瑕嗙洊鐜?鈮?80%
  鈥?浠ｇ爜璐ㄩ噺: 鍑芥暟 < 50 琛岋紝鏂囦欢 < 800 琛?
strict convergence 妫€鏌?
  鈥?绗?杞? 鍒濇瀹¤锛屽彂鐜版墍鏈?gap
  鈥?绗?杞? 楠岃瘉淇锛岀‘璁ゆ棤鏂?gap
  鈥?绗?杞? 鏈€缁堢‘璁わ紝杈撳嚭閫氳繃鏍囪

棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?鐘舵€佹洿鏂? implement_audit_passed / implement_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```

**Document Mode 璋冪敤鎽樿**锛?
```
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Stage 4: Post Audit (Document Mode) - 瀛愪唬鐞嗚皟鐢ㄦ憳瑕?鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?鎵ц浣? auditor-document
subagent_type: general-purpose
璋冪敤鏃堕棿: {timestamp}

Story 绫诲瀷妫€娴?
  鈥?妫€娴嬩緷鎹? tasks.md 鍐呭鍒嗘瀽
  鈥?妫€娴嬬粨鏋? 鏂囨。楠岃瘉鍨嬶紙Document Mode锛?
杈撳叆鍙傛暟:
  鈥?artifactDocPath: {瀹為檯鍊紏
  鈥?tasksPath: {瀹為檯鍊紏
  鈥?reportPath: {瀹為檯鍊紏

鏂囨。妯″紡缁村害寮鸿皟:
  鈥?鏂囨。瀹屾暣鎬? 缁撴瀯瀹屾暣銆佺珷鑺傞綈鍏ㄣ€佹牸寮忚鑼?  鈥?浠诲姟瀹屾垚搴? tasks.md 涓墍鏈変换鍔″凡鏍囪瀹屾垚
  鈥?涓€鑷存€? 鏂囨。鍐呴儴涓€鑷淬€佷笌鍓嶇疆鏂囨。涓€鑷?  鈥?鍙拷婧€? 闇€姹傚彲杩芥函鍒伴獙鏀舵爣鍑?
鍏抽敭鍖哄埆:
  鈥?琚瀵硅薄: Story 鏂囨。鏈韩锛堥潪浠ｇ爜锛?  鈥?Gap 淇: 瀹¤瀛愪唬鐞嗙洿鎺ヤ慨鏀规枃妗?  鈥?鏃?TDD 妫€鏌? 鏃犱唬鐮佸疄鐜?  鈥?鏃?ralph-method: 鏃犱唬鐮佸疄鐜?
strict convergence 妫€鏌?
  鈥?绗?杞? 鍒濇瀹¤锛屽彂鐜版墍鏈?gap
  鈥?绗?杞? 楠岃瘉淇锛岀‘璁ゆ棤鏂?gap
  鈥?绗?杞? 鏈€缁堢‘璁わ紝杈撳嚭閫氳繃鏍囪

棰勬湡浜х墿:
  鈥?瀹¤鎶ュ憡: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  鈥?璇勫垎鍐欏叆: scoring/data/...json
  鈥?Gap 淇: 鐩存帴淇敼 Story 鏂囨。
  鈥?鐘舵€佹洿鏂? implement_audit_passed / implement_audit_failed
鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?```

杈撳嚭鍚庣珛鍗宠皟鐢?Agent 宸ュ叿銆?
---

#### Codex no-hooks Runtime Adapter锛堝弻妯″紡锛?
**鎵ц浣撹皟鐢ㄦ柟寮?*

涓?Agent 璋冪敤 Stage 4 鎵ц浣撴椂锛屽繀椤绘牴鎹?Story 绫诲瀷閫夋嫨姝ｇ‘鐨勬墽琛屼綋锛?
```typescript
// 涓?Agent 璺敱閫昏緫
const storyType = detectStoryType(tasksPath, specPath);

if (storyType === 'code') {
  // Code Mode - 浣跨敤 auditor-implement
  await Agent({
    subagent_type: 'general-purpose',
    description: "Execute Stage 4 Post Audit (Code Mode)",
    prompt: codeModePrompt // 瀹屾暣 STORY-A4-POSTAUDIT 妯℃澘
  });
} else {
  // Document Mode - 浣跨敤 auditor-document
  await Agent({
    subagent_type: 'general-purpose',
    description: "Execute Stage 4 Post Audit (Document Mode)",
    prompt: documentModePrompt // 瀹屾暣 STORY-A4-DOCUMENT-AUDIT 妯℃澘
  });
}
```

**Primary Executor锛堟寜妯″紡锛?*

| 妯″紡 | Primary Executor | Agent 鏂囦欢 |
|------|------------------|------------|
| Code Mode | `auditor-implement` | `.codex/agents/auditors/auditor-implement.md` |
| Document Mode | `auditor-document` | `.codex/agents/auditors/auditor-document.md` |

**Fallback Strategy锛堝弻妯″紡锛?*

Code Mode:
1. 浼樺厛鐢?`auditor-implement` agent 鎵ц Post Audit
2. 鑻ヤ笉鍙敤锛屽洖閫€鍒?Codex reviewer
3. 鍐嶄笉鍙敤锛屽洖閫€鍒?`code-review` skill
4. 鏈€鍚庡洖閫€鍒颁富 Agent 鐩存帴鎵ц鍚屼竴浠戒笁灞?audit prompt

Document Mode:
1. 浼樺厛鐢?`auditor-document` agent 鎵ц Post Audit
2. 鑻ヤ笉鍙敤锛屽洖閫€鍒?Codex reviewer
3. 鍐嶄笉鍙敤锛屽洖閫€鍒?`code-review` skill
4. 鏈€鍚庡洖閫€鍒颁富 Agent 鐩存帴鎵ц鍚屼竴浠戒笁灞?audit prompt

**閲嶈**锛氭墽琛屼綋鏈韩涓嶅姞杞?skill锛屾墍鏈夊璁℃寚浠ょ敱涓?Agent 閫氳繃 prompt 鍙傛暟瀹屾暣浼犻€掋€?
---

**Runtime Contracts锛堝弻妯″紡锛?*

Code Mode:
- 瀹¤鎶ュ憡璺緞锛歚_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md`
- 瀹¤閫氳繃鍚庡繀椤绘墽琛?`run-auditor-host.ts`
- 瀹¤閫氳繃鍚庢洿鏂?story state 涓?`implement_passed`
- 瀹¤澶辫触鍚庢洿鏂?story state 涓?`implement_failed`锛屽洖閫€鍒?Stage 3 淇

Document Mode:
- 瀹¤鎶ュ憡璺緞锛歚_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md`
- 瀹¤閫氳繃鍚庡繀椤绘墽琛?`run-auditor-host.ts`
- 瀹¤閫氳繃鍚庢洿鏂?story state 涓?`implement_passed`锛堟枃妗ｅ瀷 Story 瑙嗕负宸插疄鐜帮級
- 瀹¤澶辫触鍚庢洿鏂?story state 涓?`implement_failed`锛岃繑鍥炰慨澶嶆枃妗?
---

#### Repo Add-ons锛堝弻妯″紡锛?
Code Mode:
- strict convergence锛堣繛缁?3 杞棤 gap锛?- 鎵瑰垽瀹¤鍛樼粨璁?- runAuditorHost 瑙﹀彂
- commit gate 鍓嶇疆鏉′欢妫€鏌?- 鏈粨绂佹璇嶆鏌ワ紙鍚唬鐮佹敞閲婏級
- TDD 绾㈢豢鐏鏌?- ralph-method 杩借釜鏂囦欢瀹℃煡

Document Mode:
- strict convergence锛堣繛缁?3 杞棤 gap锛?- 鎵瑰垽瀹¤鍛樼粨璁猴紙鈮?0%瀛楁暟锛?- runAuditorHost 瑙﹀彂
- commit gate 鍓嶇疆鏉′欢妫€鏌?- 鏈粨绂佹璇嶆鏌ワ紙Story 鏂囨。鍏ㄦ枃锛?- 鏂囨。缁撴瀯瀹屾暣鎬ф鏌?- 浠诲姟瀹屾垚搴﹂獙璇?
---

#### Output / Handoff锛堝弻妯″紡锛?
**Code Mode - PASS**

```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "浠ｇ爜瀹炵幇宸茶鍙?
    - step: tasks_comparison
      status: completed
      result: "tasks 瑕嗙洊搴﹀凡楠岃瘉"
    - step: spec_comparison
      status: completed
      result: "spec 瀵归綈搴﹀凡楠岃瘉"
    - step: tdd_evidence_review
      status: completed
      result: "TDD 绾㈢豢鐏瘉鎹凡瀹℃煡"
    - step: ralph_method_check
      status: completed
      result: "ralph-method 杩借釜鏂囦欢宸叉鏌?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: parse_and_write_score
      status: completed
      result: "璇勫垎宸插啓鍏?scoring/data/"
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_audit_passed"

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  tdd_evidence:
    red_phase_confirmed: true
    green_phase_confirmed: true
    refactor_phase_confirmed: true
    test_coverage: "{percent}%"
  ralph_method_check:
    prd_json_complete: true
    progress_txt_complete: true
    all_stories_passed: true
  code_quality:
    avg_function_lines: {number}
    avg_file_lines: {number}
    no_banned_words: true
    security_checks_passed: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  mainAgentNextAction: run_closeout
  mainAgentReady: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**Document Mode - PASS**

```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-document
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: document_read
      status: completed
      result: "Story 鏂囨。宸茶鍙?
    - step: tasks_read
      status: completed
      result: "tasks.md 宸茶鍙栵紝鎵€鏈変换鍔″凡鏍囪瀹屾垚"
    - step: document_structure_check
      status: completed
      result: "鏂囨。缁撴瀯瀹屾暣鎬у凡楠岃瘉"
    - step: forbidden_words_check
      status: completed
      result: "绂佹璇嶆鏌ラ€氳繃"
    - step: document_consistency_check
      status: completed
      result: "鏂囨。涓€鑷存€у凡楠岃瘉"
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: parse_and_write_score
      status: completed
      result: "璇勫垎宸插啓鍏?scoring/data/"
    - step: state_update
      status: completed
      result: "story state 宸叉洿鏂颁负 implement_audit_passed"

audit_summary:
  coverage:
    document_complete: true
    tasks_all_completed: true
    no_gaps_found: true
  document_quality:
    structure_complete: true
    format_compliant: true
    no_banned_words: true
    links_valid: true
  document_consistency:
    internal_consistent: true
    aligned_with_spec: true
    aligned_with_plan: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{artifactDocPath}"
    exists: true
    modified_in_round: false
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  mainAgentNextAction: run_closeout
  mainAgentReady: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**Document Mode - FAIL**

```yaml
layer: 4
stage: implement_audit_failed

execution_summary:
  agent: auditor-document
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 宸茶鍙?
    - step: strictness_determination
      status: passed
      result: "瀹¤涓ユ牸搴? {simple|standard|strict}"
    - step: document_read
      status: completed
      result: "Story 鏂囨。宸茶鍙?
    - step: tasks_read
      status: failed
      result: "鍙戠幇鏈畬鎴愪换鍔?
    - step: document_structure_check
      status: failed
      result: "鏂囨。缁撴瀯涓嶅畬鏁?
    - step: forbidden_words_check
      status: failed
      result: "鍙戠幇绂佹璇?
    - step: reviewer_invocation
      status: completed
      result: "鎵瑰垽瀹¤鍛樺凡浠嬪叆"
    - step: gap_fix_document
      status: completed
      result: "宸茬洿鎺ヤ慨鏀?Story 鏂囨。"
    - step: gap_documentation
      status: completed
      result: "鎵€鏈?gap 宸茶褰?

audit_summary:
  gaps_found:
    total: {count}
    critical: {count}
    major: {count}
    minor: {count}
  required_fixes:
    - category: "tasks_completion"
      description: "{gap_description}"
      priority: critical
    - category: "document_structure"
      description: "{gap_description}"
      priority: major
    - category: "forbidden_words"
      description: "{gap_description}"
      priority: major
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "FAIL"
    critical_gaps: {count}

required_fixes_detail:
  fix_strategy: "direct_document_modify"
  estimated_fix_time: "{duration}"
  fix_categories:
    - category: "document_structure"
      items: [{gap_items}]
    - category: "forbidden_words"
      items: [{gap_items}]
    - category: "tasks_completion"
      items: [{gap_items}]

artifacts:
  story_doc:
    path: "{artifactDocPath}"
    exists: true
    modified_in_round: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  gaps_list:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/GAPS_{epic}-{story}_stage4.md"
    exists: true

handoff:
  next_action: fix_document
  next_agent: auditor-document
  next_stage: 4
  ready: true
  mainAgentNextAction: dispatch_remediation
  mainAgentReady: true
  fix_required: true
  prerequisites_met:
    - audit_completed
    - gaps_documented
    - document_modified
    - reviewer_conclusion_verified
```

---

## Failure / Recovery Matrix

| 鍦烘櫙 | Primary 鍔ㄤ綔 | Fallback | 缁撴灉 |
|------|------|------|------|
| Story 瀹¤澶辫触 | 淇 Story 鏂囨。骞堕噸瀹?| reviewer fallback | 涓嶅緱杩涘叆 Dev Story |
| spec 瀹¤澶辫触 | 淇 spec 骞堕噸瀹?| `auditor-spec` fallback | 涓嶅緱杩涘叆 plan |
| plan 瀹¤澶辫触 | 淇 plan 骞堕噸瀹?| `auditor-plan` fallback | 涓嶅緱杩涘叆 tasks |
| tasks 瀹¤澶辫触 | 淇 tasks 骞堕噸瀹?| `auditor-tasks` fallback | 涓嶅緱杩涘叆 implement |
| implement 瀹¤澶辫触锛圕ode Mode锛?| 淇浠ｇ爜/鏂囨。骞堕噸瀹?| `auditor-implement` fallback | 涓嶅緱杩涘叆 commit gate |
| implement 瀹¤澶辫触锛圖ocument Mode锛?| 鐩存帴淇敼鏂囨。鍚庨噸瀹?| `auditor-document` fallback | 涓嶅緱杩涘叆 commit gate |
| OMC 涓嶅彲鐢?| 鍥為€€鍒颁粨搴撳畾涔?reviewer / skill / main agent | 閫愮骇 fallback | 淇濇寔璇箟涓庤緭鍑哄绾︿笉鍙?|
| state drift | 璇诲彇 `.codex/state/...` 鎭㈠涓婁笅鏂?| handoff + report 鍏滃簳 | 鎭㈠鍚庣户缁纭樁娈?|
| 浜х墿缂哄け | 鍋滄骞惰姹傝ˉ榻愬墠缃枃浠?| 鏃?| 涓嶅緱璺抽樁娈?|

---

## State / Audit / Handoff Contracts

### 鐘舵€佺湡鐩告簮
- `bmad-progress.yaml` 鏄叏灞€闃舵鐪熺浉婧?- `stories/*-progress.yaml` 鏄?story 绾х湡鐩告簮

### 瀹¤瑙勫垯
- 鏈€氳繃瀹¤ = 闃舵鏈畬鎴?- fail = 蹇呴』鍥炰慨
- pass = 鎵嶈兘鏇存柊鐘舵€?/ 缁х画涓嬩竴闃舵
- implement 瀹¤蹇呴』婊¤冻 strict convergence锛堣嫢浠撳簱褰撳墠瑙勫垯瑕佹眰锛?
### handoff 鏈€灏忓瓧娈?- `layer`
- `stage`
- `artifactDocPath` / `artifacts`
- `auditReportPath`
- `iteration_count`
- `next_action`

---

## 杩愯鏃剁姝簨椤?
1. 绂佹鎶?Codex Canonical Base銆丷untime Adapter銆丷epo Add-ons 娣峰啓鎴愭潵婧愪笉鏄庣殑閲嶅啓鐗?prompt
2. 绂佹鎶?fallback 褰撴垚闄嶇骇璇箟鐨勫€熷彛
3. 绂佹缁曡繃 post-audit
4. 绂佹 state 鏈洿鏂板氨鎺ㄨ繘闃舵
5. 绂佹鍦ㄦ湭婊¤冻瀹¤闂ㄦ帶鍓?commit

---

## 瀹炴柦寤鸿锛堝悗缁級

1. 鐢ㄦ湰 skill 浣滀负 Codex CLI 涓?`bmad-story-assistant` 鐨勭粺涓€鍏ュ彛
2. 鍚庣画琛ラ綈锛?   - Story Create 鐨?Claude 鎵ц鍣ㄦ槧灏?   - Story 瀹¤鐨勬爣鍑嗘墽琛屼綋
3. 灏嗙幇鏈?`.codex/agents/*.md` 涓殑閫傞厤瑙勫垯閫愭缁熶竴鍥炴敹涓猴細
   - skill 鎬诲叆鍙?   - 闃舵鎵ц鍣?   - 闃舵瀹¤鎵ц鍣?
---

## Verification Requirements

Claude 鐗?skill 钀藉湴鍚庯紝鑷冲皯搴旀弧瓒充互涓嬮獙璇侊細

- 涓嶅緱鍑虹幇纭紪鐮佹湰鍦扮粷瀵硅矾寰?- Canonical Base 蹇呴』缁戝畾鏄庣‘鐨?Cursor 妯℃澘/闃舵
- Runtime Adapter 蹇呴』鏈夛細
  - `Primary Executor`
  - `Fallback Strategy`
  - `Runtime Contracts`
- 鐩稿叧 accept 娴嬭瘯蹇呴』閫氳繃
- 瀹¤ fail / pass / retry / resume 璺緞蹇呴』鑳介€氳繃 grep 涓庣姸鎬佹枃浠堕獙璇?
---

## 涓€鍙ヨ瘽缁撹

> Claude 鐗?`bmad-story-assistant` 涓嶆槸 Cursor skill 鐨勭洿鎺ュ鍒跺搧锛岃€屾槸涓€涓互 Cursor 涓鸿涔夊熀绾裤€佷互 Codex no-hooks 涓烘墽琛岄€傞厤灞傘€佷互鏈粨瑙勫垯涓哄寮哄眰鐨勭粺涓€缂栨帓鍏ュ彛 skill銆?
<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
