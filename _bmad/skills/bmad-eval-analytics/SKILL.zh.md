---
name: bmad-eval-analytics
description: |
  bmad-eval-analytics：通过自然语言触发 Coach 诊断或 SFT 提取。
  Coach：当用户说「帮我看看短板」「最近一轮的 Coach 报告」「诊断一下」「看看评分短板」等时，Agent 应执行 `npx bmad-speckit coach` 获取 Coach 诊断输出。与 /bmad-coach Command 共用该脚本。
  SFT：当用户说「提取微调数据集」「生成 SFT 训练数据」「生成 SFT 数据」等时，Agent 应执行 `npx bmad-speckit sft-extract` 提取 SFT 训练数据并展示摘要。与 /bmad-sft-extract Command 共用该脚本。
  Use when users ask to see their weak points, Coach report for the latest run, diagnose their scoring, extract SFT/fine-tuning dataset, or generate SFT training data.
---

# bmad-eval-analytics Skill

本 Skill 使 Agent 在用户用自然语言询问评测短板、Coach 报告或 SFT 数据集提取时，执行相应脚本并展示结果。

## When to use

**Coach 诊断**（当用户说出以下任一短语时，触发 Coach 诊断）：

- 「帮我看看短板」
- 「最近一轮的 Coach 报告」
- 「诊断一下」
- 「看看评分短板」

等价或相似表述（如「分析一下评分」「给我看看最近一轮的诊断」）也可触发。

**SFT 提取**（当用户说出以下任一短语时，触发 SFT 提取）：

- 「提取微调数据集」
- 「生成 SFT 训练数据」
- 「生成 SFT 数据」

等价或相似表述（如「提取 SFT 数据」「做一下 SFT 提取」）也可触发。

## 执行指引

1. **识别触发**：用户消息匹配 Coach 短语或 SFT 短语。
2. **Coach 分支**：若匹配 Coach 短语 → 运行 `npx bmad-speckit coach` → 将输出（Markdown 或 JSON）展示给用户。
3. **SFT 分支**：若匹配 SFT 短语 → 运行 `npx bmad-speckit sft-extract` → 将脚本输出（摘要）展示给用户。

**复用说明**：
- 本 Skill 不实现 discovery、coach 或 SFT 逻辑；全部复用 `scripts/coach-diagnose.ts` 与 `scripts/sft-extract.ts`。
- Coach：无 `--run-id` 时，脚本内部调用 `discoverLatestRunId` 取 timestamp 最近一轮；默认仅诊断 `scenario=real_dev`；与 `/bmad-coach` Command 共用逻辑。若需诊断 eval_question 样本，需显式传 `--scenario eval_question`。
- SFT：与 `/bmad-sft-extract` Command 共用 `npx bmad-speckit sft-extract`；支持 `--output`、`--min-score`（默认 90，不可低于 90）。

## 验收

**Coach**：
- 有评分数据时：输出 Coach 诊断报告（Markdown 格式）。
- 无评分数据时：输出「暂无评分数据，请先完成至少一轮 Dev Story」。

**SFT**：
- 执行 `npx bmad-speckit sft-extract` 可成功运行；输出含「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」或等价摘要。
