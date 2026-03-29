# Training-Ready SFT Export 使用说明

这条链路的目标不是“再导一份 JSONL”，而是稳定地产出可以直接给 LLM 训练使用的 bundle。当前唯一真相源是 `CanonicalSftSample`。

## CanonicalSftSample 是什么

`CanonicalSftSample` 是训练数据的标准中间层。每个样本都会带上：

- `sample_id`
- `sample_version`
- `source`
- `messages`
- `tools`
- `metadata`
- `quality`
- `provenance`
- `split`
- `redaction`
- `export_compatibility`

这意味着 OpenAI / Hugging Face 的导出不再各自拼装逻辑，而是统一从 canonical sample 下压。

## 当前支持的导出目标

- `openai_chat`
- `hf_conversational`
- `hf_tool_calling`

兼容说明：

- `openai_chat`：OpenAI chat-style rows
- `hf_conversational`：Hugging Face conversational rows
- `hf_tool_calling`：Hugging Face tool-calling rows
- `legacy_instruction_io`：只保留给旧版 `sft-extract` 兼容，不是 training-ready bundle 主路径

## 先看预览，再做导出

推荐顺序：

1. `sft-preview`
2. `sft-validate`
3. `sft-bundle`

### 预览候选集

```bash
npx bmad-speckit sft-preview --target openai_chat
```

输出是 JSON，重点看：

- accepted
- rejected
- downgraded
- by_split

### 校验 schema 和目标兼容性

```bash
npx bmad-speckit sft-validate --target hf_tool_calling
```

输出会给出：

- `schema_valid`
- `invalid_samples`
- `rejected_samples`
- `accepted`
- `rejected`
- `downgraded`

`hf_tool_calling` 比另外两个目标更严格。没有 tool schema、tool call 对不上、或目标兼容性被判定为 false 时，样本会被拒绝。

## 写出 training-ready bundle

```bash
npx bmad-speckit sft-bundle --target hf_conversational --bundle-dir _bmad-output/datasets
```

bundle 会写到：

```text
_bmad-output/datasets/<bundle_id>/
```

其中固定包含：

- `train.<target>.jsonl`
- `validation.<target>.jsonl`
- `test.<target>.jsonl`
- `manifest.json`
- `stats.json`
- `validation-report.json`
- `validation-report.md`
- `rejection-report.json`

最重要的三个文件是：

- `manifest.json`：bundle_id、target、counts、split seed、artifact 路径
- `validation-report.json`：accepted / rejected / downgraded 与 rejected sample 列表
- `rejection-report.json`：被拒样本的 reason 聚合明细

## 常用参数

```bash
npx bmad-speckit sft-preview --target openai_chat --min-score 90 --split-seed 42 --max-tokens 8192
npx bmad-speckit sft-validate --target hf_tool_calling --drop-no-code-pair
npx bmad-speckit sft-bundle --target openai_chat --bundle-dir _bmad-output/datasets
```

关键参数：

- `--min-score`：最低分数阈值
- `--split-seed`：固定 train / validation / test 划分
- `--max-tokens`：限制超长样本
- `--drop-no-code-pair`：没有代码对的样本直接拒绝

## 和 `sft-extract` 的关系

`bmad-speckit sft-extract` 现在分两条路：

- `--target legacy_instruction_io`：旧版兼容 JSONL
- `--target openai_chat|hf_conversational|hf_tool_calling`：内部复用 canonical bundle writer

所以如果你的目标是训练数据，优先使用：

- `bmad-speckit sft-preview`
- `bmad-speckit sft-validate`
- `bmad-speckit sft-bundle`

只有必须兼容旧格式时，才退回 `sft-extract`.

## 与 dashboard 的关系

live dashboard 的 SFT tab 与 CLI 走的是同一套 shared core。你在 UI 里看到的：

- accepted / rejected / downgraded
- target availability
- rejection reasons
- last bundle

本质上都来自同一批 `CanonicalSftSample` 计算结果，而不是额外维护一份展示专用数据。

## Rollout guardrails

在把 bundle 交给训练链路前，至少做这几步：

1. 先跑 `bmad-speckit sft-preview`
2. 再跑 `bmad-speckit sft-validate`
3. 确认目标是 `openai_chat`、`hf_conversational` 或 `hf_tool_calling`
4. 检查 `manifest.json`、`validation-report.json`、`rejection-report.json`
5. 如果只是为了旧系统兼容，才使用 `legacy_instruction_io`
