# BMAD-Speckit-SDD-Flow

主 Agent 入口遵循 `inspect -> dispatch-plan -> closeout` 主链。

[English](README.md) | 绠€浣撲腑鏂?
<p align="center">
  <img src="docs/assets/readme-slogan.final.svg" alt="BMAD-Speckit-SDD-Flow" width="100%" />
</p>

<h3 align="center">
  闈㈠悜 Cursor 涓?Claude Code 鐨勮鑼冨寲 Spec-Driven AI 寮€鍙戞祦绋?</h3>

<p align="center">
  <strong>鍩轰簬 <a href="https://github.com/bmad-code-org/BMAD-METHOD">BMAD-METHOD</a> 涓?<a href="https://github.com/github/spec-kit">Spec-Kit</a> 鏋勫缓銆?/strong><br>
  <em>鎶婇渶姹傝鑼冦€佸璁℃祦绋嬨€佽繍琛岀洃鎺у拰璇勫垎鍙嶉鏁村悎鎴愪竴鏉″畬鏁寸殑宸ョ▼鍖栦氦浠橀摼璺€?/em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js Version"></a>
</p>

---

## 杩欏娴佺▼瑕佽В鍐充粈涔堥棶棰橈紵

寰堝 AI 宸ュ叿鍙仠鐣欏湪鎻愮ず璇嶇紪鎺掑眰闈€侭MAD-Speckit-SDD-Flow 鎶婂畠鎺ㄨ繘鎴愪竴鏉″彲绠＄悊鐨勪氦浠樻祦姘寸嚎锛氬厛鍐欒鑼冦€佸啀鍑鸿鍒掋€佺粡杩囧璁★紝纭 ready 鍚庡啀杩涘叆瀹炵幇闃舵锛屾墽琛岃繃绋嬩腑鏈夎繍琛屾椂绠℃帶锛屾渶鍚庣粺涓€杈撳嚭璇勫垎銆佺湅鏉垮拰璁粌鏁版嵁銆?
<p align="center">
  <img src="docs/assets/readme-architecture-overview.final.svg" alt="鏋舵瀯鎬昏" width="100%" />
</p>

### 涓昏鐗规€?
- **浜斿眰浜や粯鏋舵瀯**锛歅roduct Def 鈫?Epic Planning 鈫?Story Dev 鈫?Technical Implementation 鈫?Finish
- **寮哄埗瀹¤闂幆**锛氭瘡涓不鐞嗛樁娈靛繀椤婚€氳繃浠ｇ爜瀹℃煡鎵嶈兘缁х画
- **鍥涗俊鍙峰氨缁鏌?*锛氬疄鐜板叆鍙ｅ墠闇€婊¤冻闇€姹傝鐩栥€佸啋鐑熸祴璇曞氨缁€佽瘉鎹摼瀹屾暣銆佹枃妗ｅ彲杩芥函
- **杩愯鏃剁鎺у惊鐜?*锛氭墽琛屽け璐ヤ笉浼氳闈欓粯璺宠繃锛岃€屾槸娌垮悓涓€鏉℃不鐞嗛摼璺繘鍏ラ噸璇曟垨闃诲
- **鎵ц璇佹嵁閾?*锛氶€氳繃銆侀渶淇銆侀樆濉炪€侀噸璺戠瓑鐘舵€侀兘浼氱暀涓嬪畬鏁磋褰?- **鐪嬫澘銆佽瘖鏂笌璁粌鏁版嵁**锛氳繍琛岀粨鏋滆嚜鍔ㄦ眹鎬诲埌鍙鍖栭潰鏉裤€侀棶棰樿瘖鏂拰妯″瀷寰皟鏁版嵁闆?
> **鍏充簬鍥剧墖**锛歊EADME 涓殑鍥剧墖鏀惧湪 `docs/assets/` 鐩綍涓嬪苟绾冲叆 Git 绠＄悊銆俷pm 鍖呴噷鐨?README 浼氭寜 GitHub Flavored Markdown 娓叉煋锛屽洜姝?浠撳簱鍐呯浉瀵硅矾寰?+ 宸茶窡韪祫婧?鏄 GitHub 鍜?npm 閮芥渶绋冲畾鐨勭瓥鐣ャ€傛潵婧愶細[About package README files](https://docs.npmjs.com/about-package-readme-files)

---

## 杩愯鏃剁鎺т竴瑙?
- **鍥涗俊鍙峰氨缁鏌?*锛氬湪杩涘叆瀹炵幇闃舵鍓嶆墽琛岋紝涓庡疄鐜拌瘎鍒嗕繚鎸佺嫭绔?- **鍏堣 `main-agent-orchestration inspect`**锛氫富 Agent 蹇呴』鍏堣鍙?repo-native authoritative surface锛屽啀鍐冲畾涓嬩竴鏉″叏灞€鍒嗘敮
- **鎸夐渶鎵ц `dispatch-plan`**锛氬彧鏈?surface 鏄庣‘闇€瑕?materialize packet 鏃讹紝鎵嶇敓鎴愭寮忔淳鍙戣鍒?- **瀛愪唬鐞嗗彧鎵ц `bounded packet`**锛氬瓙浠ｇ悊鍙繑鍥?packet 缁撴灉锛屼笉璐熻矗鍐冲畾涓嬩竴鏉″叏灞€鎵ц閾?- **`runAuditorHost` 鍙礋璐?post-audit close-out**锛氬璁￠€氳繃鍚庣粺涓€鍐欏叆璇勫垎銆佺湅鏉裤€佽瘖鏂拰璁粌鏁版嵁锛岀劧鍚庝富 Agent 閲嶆柊璇诲彇 `inspect`
- **鏃?worker / 鎵嬪伐 close-out 鍙ｅ緞浠呬繚鐣欎负鍘嗗彶璇佹嵁**锛氬彲缁х画瀹¤杩芥函锛屼絾涓嶅啀鏄綋鍓?accepted runtime path

## 鐪嬫澘涓?MCP

- **鐪嬫澘鏄粯璁よ兘鍔?*锛氬彂甯冨寘榛樿鏀寔杩愯鏃剁湅鏉跨姸鎬佹煡璇€佸惎鍋滆緟鍔┿€佸揩鐓х敓鎴?- **杩愯鏃?MCP 鏄彲閫夎兘鍔?*锛氬彧鏈夊湪浣犲笇鏈涙妸杩愯鏃舵暟鎹毚闇叉垚 agent 宸ュ叿鎺ュ彛鏃讹紝鎵嶆樉寮忓惎鐢?`--with-mcp`
- **鐪嬫澘鍜岃繍琛屾椂绠℃帶涓嶄緷璧?MCP**锛氬疄鏃剁湅鏉裤€侀挬瀛愩€佽瘎鍒嗘姇褰便€佽繍琛屾椂鏀跺彛鍦ㄦ病鏈?`.mcp.json` 鐨勬儏鍐典笅涔熻兘宸ヤ綔

绠€鍗曠悊瑙ｏ細

- `dashboard`锛氱粰浜虹湅鐨勮繍琛屾椂/璇勫垎鍙鍖?- `runtime-mcp`锛氭妸鍚屼竴浠借繍琛屾椂鏁版嵁鏆撮湶鎴?agent 宸ュ叿鎺ュ彛

---

## 鎺ㄨ崘鐨?npm 瀹夎鏂瑰紡

纭繚鏈満宸插畨瑁?**[Node.js](https://nodejs.org) v18+**銆?
### 鎺ㄨ崘鐨?npm 绂讳粨瀹夎璺緞

濡傛灉浣犳槸瑕佹妸瀹冭杩涗竴涓秷璐归」鐩紝鑰屼笉鏄慨鏀规湰浠撳簱婧愮爜锛屽綋鍓嶆帹鑽愮洿鎺ヤ娇鐢ㄥ凡鍙戝竷鐨勬牴鍖咃細

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit version
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent claude-code --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent cursor --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent codex --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit check
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit dashboard-status
```

涓轰粈涔堟帹鑽愯繖鏉¤矾寰勶細

- 瀹冧娇鐢ㄥ敮涓€鍏紑鍙戝竷鐨勬牴鍖?- 瀹冩樉寮忓榻愪袱渚у涓诲畨瑁呴潰
- 瀹冧繚鐣?`--no-package-json` 杩欑闈炰镜鍏ュ紡娑堣垂瀹夎椋庢牸
- 瀹冨搴旂殑鏄繖娆″凡缁忛獙璇佽繃鐨勫凡鍙戝竷 npm 璺緞锛岃€屼笉鏄棫鐨勭函寮曞蹇嵎鍏ュ彛

### 鎸佷箙瀹夎鍒伴」鐩緷璧栨爲

濡傛灉浣犲笇鏈涙妸鍖呭啓杩涙秷璐归」鐩殑渚濊禆鏍戯細

```bash
npm install --save-dev bmad-speckit-sdd-flow@latest
npx bmad-speckit-init . --agent claude-code --full --no-package-json
npx bmad-speckit-init . --agent cursor --full --no-package-json
npx bmad-speckit-init . --agent codex --full --no-package-json
npx bmad-speckit check
```

### Codex no-hooks 浜斿眰璺緞

Codex 鏄竴绛?no-hooks 瀹夸富銆傜敤鎴峰叆鍙ｄ粛鏄?`bmad-help`锛屼箣鍚庤繘鍏ュ悓涓€鏉′富 agent 浜斿眰鍏ㄦ祦绋嬶細`layer_1_intake -> layer_2_architecture -> layer_3_story -> layer_4_speckit -> layer_5_closeout`銆?
褰撲綘甯屾湜 BMAD-Speckit-SDD-Flow 鎺ョ褰撳墠璇锋眰鐨?root governed runtime control 鏃讹紝浣跨敤 `$bmad-speckit`銆乣/bmad-speckit` 鎴?`bmad-speckit`銆傜煭鍒悕 `$bmads`銆乣/bmads`銆乣bmads` 绛変环銆傛湰椤圭洰榛樿涓嶅崰鐢?`$bmad`锛屼互閬垮厤鍜屼笂娓?BMAD Method 鍐茬獊銆?
```bash
npx bmad-speckit-init . --agent codex --full --no-package-json
npx bmad-speckit check
npm run main-agent:run-loop -- --host codex
```

Codex 瀹夎鍜岃繍琛屾椂鍚堝悓瑙?`docs/how-to/codex-setup.md`銆?
### 蹇€熷紩瀵艰矾寰?
鏇村揩鐨勫紩瀵煎懡浠や粛鐒朵繚鐣欙細

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit init . --ai cursor-agent --yes
```

浣嗗簲鎶婂畠鐞嗚В鎴愪竴涓揩閫熷垵濮嬪寲鍏ュ彛锛岃€屼笉鏄畬鏁磋繍琛屾椂娌荤悊瀹夎闈㈢殑鏈€楂樼疆淇¤矾寰勩€傚鏋滀綘鍏冲績宸插彂甯冮挬瀛愩€佽繍琛屾椂绠℃帶銆佺湅鏉挎帴鍏ュ拰鍙屽涓诲榻愶紝浼樺厛浣跨敤涓婇潰鐨勬帹鑽愯矾寰勩€?
> 涓嶇‘瀹氳璧板摢鏉℃不鐞嗚矾寰勬椂锛屽湪 AI IDE 涓繍琛?`/bmad-help`銆傚畠浼氱粨鍚堟祦绋嬨€佷笂涓嬫枃鎴愮啛搴︺€佸鏉傚害鍜屽疄鐜板氨缁姸鎬佸仛鎺ㄨ崘鎴栭樆鏂€?
### 鍏朵粬瀹夎鏂瑰紡

<details>
<summary><b>閫氳繃 CI 浜х墿瀹夎鍒版秷璐归」鐩?/b></summary>
<br>
濡傛灉浣犱娇鐢?release 浜х墿锛岃€屼笉鏄洿鎺ヤ粠 npm registry 瀹夎锛?
1. 涓嬭浇 GitHub Actions 浜х墿 `npm-packages-<commit-sha>`
2. 瑙ｅ帇鍑?`bmad-speckit-sdd-flow-<version>.tgz`
3. 鎵ц锛?
   ```bash
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit version
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent claude-code --full --no-package-json
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent cursor --full --no-package-json
   ```

</details>

<details>
<summary><b>涓€閿儴缃茶剼鏈?/b></summary>
<br>

```powershell
# Windows
pwsh scripts/setup.ps1 -Target <椤圭洰璺緞>
```

```bash
# WSL / Linux / macOS
bash scripts/setup.sh -Target <椤圭洰璺緞>
```

</details>

<details>
<summary><b>瀹夊叏鍗歌浇</b></summary>
<br>
濡傛灉瑕佺Щ闄ゅ綋鍓嶉」鐩噷鐨勫彈绠″畨瑁呴潰锛?
```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit uninstall
```

瀹冨彧浼氬垹闄ゅ畨瑁呭櫒鍙楃鏉＄洰锛屼笉浼氭暣鍒?`.cursor`銆乣.claude` 鎴栧叏灞€ skills锛屼篃涓嶄細鍒犻櫎 `_bmad-output`銆?
</details>

---

## 鏋舵瀯涓庢ā鍧?
### 鏍稿績缁勪欢

| 缁勪欢                        | 璇存槑                                                                                                               |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **`_bmad/`**                | 宸ヤ綔娴佹ā鍧椼€侀挬瀛愩€佹彁绀鸿瘝銆佽矾鐢变笌瀹夸富渚ц祫浜х殑瑙勮寖婧?                                                                |
| **`packages/scoring/`**     | 璇勫垎寮曟搸銆佸氨缁紓绉昏瘎浼般€佺湅鏉挎姇褰便€佽瘖鏂緭鍏ヤ笌璁粌鏁版嵁鎻愬彇                                                           |
| **`dashboard`**             | 榛樿杩愯鏃跺彲瑙傛祴灞傦細瀹炴椂鐪嬫澘銆佽繍琛屾椂蹇収銆佽瘎鍒嗘姇褰?                                                                |
| **`runtime-mcp`**           | 鍙€夌殑 MCP 宸ュ叿鎺ュ彛锛岄€氳繃 `--with-mcp` 鏄惧紡鍚敤                                                                    |
| **`speckit-workflow`**      | Specify 鈫?Plan 鈫?GAPS 鈫?Tasks 鈫?TDD锛屽苟甯﹀己鍒跺璁″惊鐜?                                                             |
| **`bmad-story-assistant`**  | Story 鐢熷懡鍛ㄦ湡鍏ュ彛锛氫富 Agent 鍏堣 `inspect`锛屾寜闇€娲惧彂 bounded packet锛屽苟鍦?post-audit 鍚庨€氳繃 `runAuditorHost` 鏀跺彛 |
| **`bmad-bug-assistant`**    | Bug 鐢熷懡鍛ㄦ湡璺緞锛歊CA 鈫?Party Mode 鈫?BUGFIX 鈫?Implement锛屼絾鍏ㄥ眬 `inspect -> dispatch-plan -> closeout` 涓婚摼浠嶇敱涓?Agent 鎺у埗 |
| **`bmad-standalone-tasks`** | 閽堝 TASKS 鎴?BUGFIX 鏂囨。鐨勬墽琛屼粛鍏堢粡杩囦富 Agent `inspect`锛屽繀瑕佹椂 `dispatch-plan`锛屽啀杩涘叆 bounded 瀛愪唬鐞嗗疄鏂?      |

<details>
<summary><b>鏌ョ湅鐩綍缁撴瀯</b></summary>

```text
BMAD-Speckit-SDD-Flow/
鈹溾攢鈹€ _bmad/                # 鏍稿績妯″潡涓庨厤缃?鈹溾攢鈹€ packages/             # Monorepo 鍖咃紙CLI銆佽瘎鍒嗭級
鈹溾攢鈹€ scripts/              # 瀹夎涓庨儴缃插伐鍏疯剼鏈?鈹溾攢鈹€ docs/                 # Diataxis 椋庢牸鏂囨。
鈹溾攢鈹€ tests/                # 楠屾敹娴嬭瘯涓?epic 娴嬭瘯
鈹斺攢鈹€ specs/                # 鐢熸垚鐨?Story 瑙勮寖
```

</details>

---

## 鏂囨。鍏ュ彛

- [蹇€熷紑濮媇(docs/tutorials/getting-started.md)
- [涓?Agent 缂栨帓鍙傝€僝(docs/reference/main-agent-orchestration.md)
- [娑堣垂椤圭洰瀹夎鎸囧崡](docs/how-to/consumer-installation.md)
- [杩愯鏃剁湅鏉挎寚鍗梋(docs/how-to/runtime-dashboard.md)
- [杩愯鏃?MCP 瀹夎](docs/how-to/runtime-mcp-installation.md)
- [Provider 閰嶇疆](docs/how-to/provider-configuration.md)
- [Cursor 閰嶇疆](docs/how-to/cursor-setup.md)
- [Claude Code 閰嶇疆](docs/how-to/claude-code-setup.md)
- [WSL / Shell 鑴氭湰](docs/how-to/wsl-shell-scripts.md)

---

<p align="center">
  <a href="LICENSE">MIT License</a> 鈥?  <a href="https://github.com/bmad-code-org/BMAD-METHOD">BMAD-METHOD</a> 鈥?  <a href="https://github.com/github/spec-kit">Spec-Kit</a>
</p>
