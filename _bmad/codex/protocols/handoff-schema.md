# Handoff Schema

闃舵闂翠氦鎺ユ暟鎹牸寮忋€?
## Required Fields

- `layer`: number 鈥?褰撳墠灞?(1-5)
- `stage`: string 鈥?褰撳墠闃舵 (specify | plan | tasks | implement | assure)
- `artifactDocPath`: string 鈥?浜х墿鏂囨。璺緞
- `auditReportPath`: string 鈥?瀹¤鎶ュ憡璺緞
- `next_action`: string 鈥?鎺ㄨ崘涓嬩竴姝ュ姩浣?- `ready`: boolean 鈥?鏄惁鍑嗗濂借嚜鍔ㄧ户缁?(鍙€夛紝榛樿 false)
- `mainAgentNextAction`: string 鈥?涓?Agent 鍏煎鎽樿瀛楁锛屼緵鏃?handoff consumer 璇诲彇
- `mainAgentReady`: boolean 鈥?涓?Agent 鍏煎鎽樿瀛楁锛屼緵鏃?handoff consumer 璇诲彇

## Preferred Main-Agent Surface

interactive 妯″紡涓嬶紝涓?Agent 鐨勬潈濞佺紪鎺掗潰涓嶆槸 handoff 瀛楁鏈韩锛岃€屾槸 repo-native `main-agent-orchestration` surface銆?
涓?Agent 鍦ㄥ喅瀹氫笅涓€姝ュ墠锛屽繀椤讳紭鍏堟墽琛岋細

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect
```

蹇呰鏃跺啀鎵ц锛?
```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan
```

涓?Agent 搴斾紭鍏堟秷璐逛互涓嬪瓧娈碉細

- `orchestrationState`
- `pendingPacketStatus`
- `pendingPacket`
- `continueDecision`
- `mainAgentNextAction`
- `mainAgentReady`

鍏朵腑 `mainAgentNextAction` / `mainAgentReady` 鍦?handoff 涓粎浣滀负 compatibility summary锛涚湡姝ｆ潈濞佺姸鎬佸缁堟槸 `orchestrationState + pendingPacket + continueDecision`銆?
## Example

```yaml
layer: 4
stage: specify
artifactDocPath: specs/epic-1/story-1/spec.md
auditReportPath: reports/spec-audit.md
next_action: proceed_to_plan
ready: true
mainAgentNextAction: dispatch_implement
mainAgentReady: true
```

## Transition Rules

- specify 鈫?plan: 闇€ spec 瀹¤ PASS
- plan 鈫?tasks: 闇€ plan 瀹¤ PASS
- tasks 鈫?implement: 闇€ tasks 瀹¤ PASS
- implement 鈫?assure: 闇€ implement 瀹¤ PASS

## Main Agent Rule

- `next_action` / `ready` 浠嶅彲淇濈暀涓洪樁娈典骇鍑鸿涔?- interactive 妯″紡涓嬪繀椤诲厛璇诲彇 `main-agent-orchestration` surface锛屽啀鍐冲畾鍏ㄥ眬鍒嗘敮
- handoff 閲岀殑 `mainAgentNextAction` / `mainAgentReady` 鍙綔涓?compatibility summary
- 鑻?repo-native orchestration surface 鍙敤锛屽垯浠ヨ surface 涓哄噯
- 浠呭綋 repo-native orchestration surface 涓嶅彲鐢ㄦ椂锛屾墠鍥為€€鍒?handoff 涓殑 `mainAgentNextAction` / `mainAgentReady`
