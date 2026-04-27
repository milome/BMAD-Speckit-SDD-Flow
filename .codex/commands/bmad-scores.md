---
name: bmad-scores
description: 璇勫垎姹囨€伙細鍏ㄩ儴鎽樿銆佹寜 Epic 鎴?Story 绛涢€夛紝杈撳嚭 Markdown 琛ㄦ牸
---

# /bmad-scores

瑙﹀彂璇勫垎姹囨€伙紝鍩轰簬 `scoring/data/`锛堟垨 `getScoringDataPath()`锛変笅璇勫垎璁板綍锛岃緭鍑?Markdown 琛ㄦ牸鏍煎紡鐨勬眹鎬汇€?
## 瑙﹀彂鏂瑰紡

- Codex command锛歚/bmad-scores`
- CLI锛歚npx bmad-speckit scores`

## 璋冪敤妯″紡

| 妯″紡 | 鍛戒护 | 杈撳嚭 |
|------|------|------|
| 鍏ㄩ儴鎽樿 | `npx bmad-speckit scores` | 鏈€杩?100 鏉¤瘎鍒嗚褰曪紙琛ㄦ牸锛?|
| Epic 姹囨€?| `npx bmad-speckit scores --epic 3` | Epic 3 鍚?Story 璇勫垎 |
| Story 鏄庣粏 | `npx bmad-speckit scores --story 3.3` | Story 3.3 鍚勯樁娈佃瘎鍒嗘槑缁?|

## 鍙傛暟

- `--epic N`锛氫粎灞曠ず Epic N 鍚?Story 鐨勮瘎鍒嗭紙N 涓烘鏁存暟锛?- `--story X.Y`锛氫粎灞曠ず Story X.Y 鍚勯樁娈垫槑缁嗭紙瑙ｆ瀽涓?epicId=X, storyId=Y锛?- `--epic` 涓?`--story` 浜掓枼

## 杈撳嚭鏍煎紡

- Markdown 琛ㄦ牸锛涙棤鏁版嵁鏃惰緭鍑恒€屾殏鏃犺瘎鍒嗘暟鎹紝璇峰厛瀹屾垚鑷冲皯涓€杞?Dev Story銆?- 鏃犲彲瑙ｆ瀽 Epic/Story 鏃惰緭鍑恒€屽綋鍓嶈瘎鍒嗚褰曟棤鍙В鏋?Epic/Story锛岃纭 run_id 绾﹀畾銆?- 鏃犲彲绛涢€夋暟鎹椂杈撳嚭銆屾棤鍙瓫閫夋暟鎹€?
## 楠屾敹鍛戒护

```bash
npx bmad-speckit scores
npx bmad-speckit scores --epic 3
npx bmad-speckit scores --story 3.3
```
