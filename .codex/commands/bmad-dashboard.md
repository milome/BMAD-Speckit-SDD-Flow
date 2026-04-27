---
name: bmad-dashboard
description: 椤圭洰鍋ュ悍搴︿华琛ㄧ洏锛氭€诲垎銆佸洓缁淬€佺煭鏉?Top 3銆乂eto 缁熻銆佽秼鍔?---

# /bmad-dashboard

瑙﹀彂椤圭洰鍋ュ悍搴︿华琛ㄧ洏鐢熸垚锛屽熀浜?`scoring/data/`锛堟垨 `getScoringDataPath()`锛変笅 real_dev 璇勫垎璁板綍锛岃緭鍑?Markdown 浠〃鐩樺埌 `_bmad-output/dashboard.md` 骞跺湪瀵硅瘽涓睍绀恒€?
## 瑙﹀彂鏂瑰紡

- Codex command锛歚/bmad-dashboard`
- CLI锛歚npx bmad-speckit dashboard`

**epic/story 杩囨护浠?epic_story_window 鏈夋晥**锛氫娇鐢?`--epic N` 鎴?`--epic N --story M` 鏃讹紝蹇呴』閰嶅悎 `--strategy epic_story_window`锛堥粯璁わ級锛沗--strategy run_id` 鏃?epic/story 鍙傛暟灏嗚蹇界暐銆?
## 璋冪敤娴佺▼锛堟棤鍙傛暟锛?
1. **鏁版嵁鍔犺浇**锛氫粠 `getScoringDataPath()` 鍔犺浇璇勫垎璁板綍锛屼粎鑰冭檻 scenario=real_dev
2. **绌烘暟鎹?*锛氳嫢鏃?real_dev 璁板綍锛岃緭鍑恒€屾殏鏃犳暟鎹紝璇峰厛瀹屾垚鑷冲皯涓€杞?Dev Story銆嶏紝浠嶅啓鍏?`_bmad-output/dashboard.md`
3. **鏈夋暟鎹?*锛氳绠楅」鐩仴搴峰害鎬诲垎銆佸洓缁撮浄杈惧浘銆佺煭鏉?Top 3銆乂eto 瑙﹀彂缁熻銆佽秼鍔匡紝鏍煎紡鍖栦负 Markdown
4. **杈撳嚭**锛氬啓鍏?`_bmad-output/dashboard.md`锛屽悓鏃?stdout 杈撳嚭渚夸簬瀵硅瘽灞曠ず

## 杈撳嚭鍐呭锛堟湁鏁版嵁鏃讹級

- 椤圭洰鍋ュ悍搴︽€诲垎锛圥HASE_WEIGHTS 鍔犳潈锛?- 鍥涚淮闆疯揪鍥炬暟鎹紙dimension_scores锛涙棤鍒欐樉绀恒€屾棤鏁版嵁銆嶏級
- 鐭澘 Top 3锛堝緱鍒嗘渶浣庣殑 3 涓樁娈?Story锛?- Veto 瑙﹀彂缁熻
- 瓒嬪娍锛堟渶杩?5 run 鍗?闄?鎸佸钩锛?
## 楠屾敹鍛戒护

```bash
npx bmad-speckit dashboard
```

鏈夋暟鎹椂杈撳嚭瀹屾暣浠〃鐩?Markdown锛涚┖鐩綍鏃惰緭鍑恒€屾殏鏃犳暟鎹紝璇峰厛瀹屾垚鑷冲皯涓€杞?Dev Story銆嶃€傝緭鍑哄悓鏃跺啓鍏?`_bmad-output/dashboard.md`銆?
