---
name: bmad-sft-extract
description: SFT 寰皟鏁版嵁闆嗘彁鍙栵細浠?phase_score>=minScore 鐨勮瘎鍒嗚褰曟彁鍙?instruction+浠ｇ爜瀵癸紝杈撳嚭 JSONL
---

# /bmad-sft-extract

瑙﹀彂 SFT 寰皟鏁版嵁闆嗘彁鍙栵紝鍩轰簬 `scoring/data/`锛堟垨 `getScoringDataPath()`锛変笅璇勫垎璁板綍锛岀瓫閫?phase_score>=minScore 鐨勬潯鐩紙榛樿 90锛夛紝鎻愬彇 BUGFIX 搂1+搂4 浣滀负 instruction锛実it diff 浣滀负 input/output 浠ｇ爜瀵癸紝杈撳嚭鍒?`scoring/data/sft-dataset.jsonl`銆?
## 瑙﹀彂鏂瑰紡

- Codex command锛歚/bmad-sft-extract`
- CLI锛歚npx bmad-speckit sft-extract`

## 璋冪敤妯″紡

| 妯″紡 | 鍛戒护 | 杈撳嚭 |
|------|------|------|
| 榛樿 | `npx bmad-speckit sft-extract` | sft-dataset.jsonl 鑷?scoring/data/锛沵inScore 90 |
| 鑷畾涔?minScore | `npx bmad-speckit sft-extract --min-score 95` | 浠?phase_score>=95 鍙備笌锛圢 涓嶅彲浣庝簬 90锛?|
| 鑷畾涔夎緭鍑?| `npx bmad-speckit sft-extract --output /path/to/out.jsonl` | 鍐欏叆鎸囧畾璺緞 |

## 鍙傛暟

- `--min-score N`锛氭渶浣?phase_score锛堥粯璁?90锛屼笉鍙綆浜?90锛夛紱phase_score>=N 鐨勮褰曟墠鍙備笌鎻愬彇锛涜嫢 N<90 浼氭姤閿欐彁绀洪噸鏂拌缃?- `--output PATH`锛氳緭鍑?JSONL 璺緞锛堥粯璁?scoring/data/sft-dataset.jsonl锛?
## 杈撳嚭鏍煎紡

- JSONL锛氭瘡琛屽惈 instruction銆乮nput銆乷utput銆乻ource_run_id銆乥ase_commit_hash銆乭as_code_pair銆乻ource_path锛堝彲閫夛級
- has_code_pair: false 鏃?input/output 涓虹┖锛坓it diff 澶辫触 fallback 涓?instruction-only锛?- 鎽樿锛歚鍏辨彁鍙?N 鏉★紝瑕嗙洊 M 涓?Story锛涜烦杩?K 鏉★紙鍘熷洜锛氣€︼級`

## 楠屾敹鍛戒护

```bash
npx bmad-speckit sft-extract
npx bmad-speckit sft-extract --min-score 95
npx bmad-speckit sft-extract --output scoring/data/sft-dataset.jsonl
```
