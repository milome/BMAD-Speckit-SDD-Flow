---
name: bmad-sft-extract
description: SFT 微调数据集提取：从 phase_score>=minScore 的评分记录提取 instruction+代码对，输出 JSONL
---

# /bmad-sft-extract

触发 SFT 微调数据集提取，基于 `scoring/data/`（或 `getScoringDataPath()`）下评分记录，筛选 phase_score>=minScore 的条目（默认 90），提取 BUGFIX §1+§4 作为 instruction，git diff 作为 input/output 代码对，输出到 `scoring/data/sft-dataset.jsonl`。

## 触发方式

- Cursor Command：`/bmad-sft-extract`
- CLI：`npx bmad-speckit sft-extract`

## 调用模式

| 模式 | 命令 | 输出 |
|------|------|------|
| 默认 | `npx bmad-speckit sft-extract` | sft-dataset.jsonl 至 scoring/data/；minScore 90 |
| 自定义 minScore | `npx bmad-speckit sft-extract --min-score 95` | 仅 phase_score>=95 参与（N 不可低于 90） |
| 自定义输出 | `npx bmad-speckit sft-extract --output /path/to/out.jsonl` | 写入指定路径 |

## 参数

- `--min-score N`：最低 phase_score（默认 90，不可低于 90）；phase_score>=N 的记录才参与提取；若 N<90 会报错提示重新设置
- `--output PATH`：输出 JSONL 路径（默认 scoring/data/sft-dataset.jsonl）

## 输出格式

- JSONL：每行含 instruction、input、output、source_run_id、base_commit_hash、has_code_pair、source_path（可选）
- has_code_pair: false 时 input/output 为空（git diff 失败 fallback 为 instruction-only）
- 摘要：`共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）`

## 验收命令

```bash
npx bmad-speckit sft-extract
npx bmad-speckit sft-extract --min-score 95
npx bmad-speckit sft-extract --output scoring/data/sft-dataset.jsonl
```
