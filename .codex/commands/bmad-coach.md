---
name: bmad-coach
description: AI Coach 璇婃柇锛氬熀浜庢渶杩戜竴杞瘎鍒嗘暟鎹緭鍑?phase_scores銆亀eak_areas銆乺ecommendations
---

# /bmad-coach

瑙﹀彂 AI Coach 璇婃柇锛屽熀浜?`scoring/data/`锛堟垨 `getScoringDataPath()`锛変笅鏈€鏂拌瘎鍒嗚褰曪紝杈撳嚭 Markdown 璇婃柇鎶ュ憡銆?
## 瑙﹀彂鏂瑰紡

- Codex command锛歚/bmad-coach`
- CLI锛歚npx bmad-speckit coach` 鎴?`npm run coach:diagnose`

## 璋冪敤娴佺▼锛堟棤鍙傛暟锛?
1. **Discovery**锛氭壂鎻?`getScoringDataPath()` 涓?`*.json`锛堜粎璇勫垎 schema锛変笌 `scores.jsonl`锛屾寜 `timestamp` 鍙栨渶鏂?N 鏉★紙榛樿 100锛?2. **绌烘暟鎹?*锛氳嫢鏃犺瘎鍒嗚褰曪紝杩斿洖銆屾殏鏃犺瘎鍒嗘暟鎹紝璇峰厛瀹屾垚鑷冲皯涓€杞?Dev Story銆?3. **璇婃柇**锛氬彇鏈€鏂?run_id 鈫?璋冪敤 `coachDiagnose(runId)` 鈫?`formatToMarkdown`
4. **鎴柇鎻愮ず**锛氭暟鎹噺瓒呰繃 N 鏃讹紝鍦ㄦ姤鍛婂墠闄勫姞銆屼粎灞曠ず鏈€杩?N 鏉°€?
## 杈撳嚭鏍煎紡

- 榛樿 Markdown锛氬惈 phase_scores銆亀eak_areas銆乺ecommendations
- `--format=json` 鏃惰緭鍑?JSON

## 鍙€夊弬鏁?
- `--run-id <id>`锛氭寚瀹?run_id锛岃烦杩?discovery
- `--scenario real_dev|eval_question|all`锛歞iscovery 鏃舵寜 scenario 杩囨护锛涢粯璁?`real_dev`锛堜粎璇婃柇鐪熷疄 Dev Story锛夛紱`all` 琛ㄧず涓嶈繃婊?- `--epic N`锛氫粎璇婃柇 Epic N 鐩稿叧鏁版嵁锛圫tory 6.2锛?- `--story X.Y`锛氫粎璇婃柇 Story X.Y锛堣В鏋愪负 epicId=X, storyId=Y锛夛紱涓?`--epic` 浜掓枼
- `--format json|markdown`锛氶粯璁?markdown
- `--limit N`锛歞iscovery 鏈€澶氳€冭檻 N 鏉★紙榛樿 100锛夛紱鐜鍙橀噺 `COACH_DISCOVERY_LIMIT` 鍙鐩?
## 楠屾敹鍛戒护

```bash
npx bmad-speckit coach
npx bmad-speckit coach --epic 3
npx bmad-speckit coach --story 3.3
```

鏈夋暟鎹椂杈撳嚭璇婃柇鎶ュ憡锛涚┖鐩綍鏃惰緭鍑恒€屾殏鏃犺瘎鍒嗘暟鎹紝璇峰厛瀹屾垚鑷冲皯涓€杞?Dev Story銆嶃€俙--epic`銆乣--story` 鏃犲尮閰嶆椂杈撳嚭鏄庣‘鍙嶉锛堝銆屾棤鍙瓫閫夋暟鎹€嶏級銆?
