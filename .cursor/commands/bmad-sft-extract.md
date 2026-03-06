---
name: bmad-sft-extract
description: SFT 微调数据集提取：从 phase_score≤阈值 的评分记录提取 instruction+代码对，输出 JSONL
---

# /bmad-sft-extract

触发 SFT 微调数据集提取，基于 `scoring/data/`（或 `getScoringDataPath()`）下评分记录，筛选 phase_score≤阈值 的条目，提取 BUGFIX §1+§4 作为 instruction，git diff 作为 input/output 代码对，输出到 `scoring/data/sft-dataset.jsonl`。

## 触发方式

- Cursor Command：`/bmad-sft-extract`
- CLI：`npx ts-node scripts/sft-extract.ts`

## 调用模式

| 模式 | 命令 | 输出 |
|------|------|------|
| 默认 | `npx ts-node scripts/sft-extract.ts` | sft-dataset.jsonl 至 scoring/data/；阈值 60 |
| 自定义阈值 | `npx ts-node scripts/sft-extract.ts --threshold 50` | 仅 phase_score≤50 参与 |
| 自定义输出 | `npx ts-node scripts/sft-extract.ts --output /path/to/out.jsonl` | 写入指定路径 |
| 环境变量阈值 | `SFT_THRESHOLD=50 npx ts-node scripts/sft-extract.ts` | 使用 env 阈值 |

## 参数

- `--threshold N`：phase_score 筛选阈值（默认 60；CLI 优先于 env）
- `--output PATH`：输出 JSONL 路径（默认 scoring/data/sft-dataset.jsonl）
- `SFT_THRESHOLD`：环境变量，阈值 fallback（CLI 未指定时）

## 输出格式

- JSONL：每行含 instruction、input、output、source_run_id、base_commit_hash、has_code_pair、source_path（可选）
- has_code_pair: false 时 input/output 为空（git diff 失败 fallback 为 instruction-only）
- 摘要：`共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）`

## 验收命令

```bash
npx ts-node scripts/sft-extract.ts
npx ts-node scripts/sft-extract.ts --threshold 50
npx ts-node scripts/sft-extract.ts --output scoring/data/sft-dataset.jsonl
```
