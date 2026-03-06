# Spec E7-S2：SFT 提取 Command（/bmad-sft-extract）

*Story 7.2 技术规格*  
*Epic E7 eval-ux-dashboard-and-sft*

---

## 1. 概述

本 spec 将 Story 7.2 的实现范围固化为可执行技术规格，覆盖 `/bmad-sft-extract` Command、SFT 提取 CLI 脚本、phase_score 阈值筛选、git diff 失败 fallback、去重、输出摘要，以及 JSONL 格式输出到 `scoring/data/sft-dataset.jsonl`。

**前置假设**：本 spec 假定 `scoring/analytics/sft-extractor.ts` 已存在且含 `SftEntry`、`extractSftDataset`、`extractBugfixSections`、`gitDiffBetween`、phase_score≤60 筛选。本 Story 在此基础上增强 fallback、去重、摘要、阈值可配置，并新增 CLI 与 Command。

**输入来源**：
- Story 7.2（7-2-sft-extract-command.md）
- prd.eval-ux-last-mile.md §5.4（REQ-UX-4.1～4.6）
- scoring/analytics/sft-extractor.ts、scoring/constants/path.ts

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| REQ-UX-4.1 | 无参数运行即可提取 | spec §3.1, §3.5 | ✅ |
| REQ-UX-4.2 | phase_score≤阈值筛选；阈值可配置 | spec §3.2, §3.3 | ✅ |
| REQ-UX-4.3 | git diff 失败 fallback 为 instruction-only | spec §3.4 | ✅ |
| REQ-UX-4.4 | 输出摘要：共 N 条、覆盖 M Story、跳过 K 条 | spec §3.6 | ✅ |
| REQ-UX-4.5 | 去重：source_run_id+base_commit_hash+source_path | spec §3.5 | ✅ |
| REQ-UX-4.6 | JSONL 格式：instruction、input、output；has_code_pair:false 时 input/output 可为空 | spec §3.7 | ✅ |
| AC-1～AC-6 | 各验收场景 | spec §3.8 | ✅ |

---

## 3. 功能规格

### 3.1 Command 与入口

| 项目 | 规格 |
|------|------|
| Command 文档 | `commands/bmad-sft-extract.md`，定义 `/bmad-sft-extract` 触发 |
| 脚本入口 | `scripts/sft-extract.ts` |
| 参数 | 无参数运行即可；支持 `--output`、`--threshold` 或 env `SFT_THRESHOLD` |

### 3.2  phase_score 阈值筛选

- 默认阈值：60
- 配置优先级：CLI `--threshold N` > env `SFT_THRESHOLD` > 默认 60
- 筛选规则：仅保留 `phase_score <= threshold` 的记录参与提取

### 3.3 阈值可配置（AC-2）

| 来源 | 格式 | 示例 |
|------|------|------|
| 环境变量 | `SFT_THRESHOLD` | `SFT_THRESHOLD=50` |
| CLI | `--threshold N` | `npx ts-node scripts/sft-extract.ts --threshold 50` |
| 默认 | 60 | 无指定时 |

### 3.4 git diff 失败 fallback（AC-3）

- **条件**：某记录在 `gitDiffBetween` 或后续 parse 时无法生成有效代码对（如 diff 为空、commit 无效）
- **行为**：fallback 为 instruction-only；`SftEntry` 含 `has_code_pair: false`；`input`、`output` 为空字符串；`instruction` 仍为 §1+§4
- **禁止**：不再 skip 该记录；必须输出到 JSONL

### 3.5 去重（AC-5）

- **键**：`source_run_id` + `base_commit_hash` + `source_path`（三者拼接后作为唯一键）
- **规则**：同一键仅保留最先出现的一条
- **时机**：在写入 JSONL 前对所有 entries 去重

### 3.6 输出摘要（AC-4）

- **格式**：`共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）`
- **N**：写入 JSONL 的 entry 数量（去重后）
- **M**：去重后 entries 中 source_path 或 run_id 可解析出的唯一 Story 数量（可用 `parseEpicStoryFromRecord` 或等价逻辑）
- **K**：被跳过的记录数（无 source_path、无 base_commit_hash、source_path 不存在、无法读取、无 §1/§4、base_commit_hash 不可验证 等）
- **原因**：简要列出 skip 原因（如「无 source_path」「git diff 失败且已 fallback」不计入 K，因为 fallback 仍输出）

### 3.7 JSONL 格式（AC-6）

- **每行**：`instruction`、`input`、`output`、`source_run_id`、`base_commit_hash`、`has_code_pair`（新增）
- **has_code_pair**：`true` 表示有代码对；`false` 表示 instruction-only（fallback）
- **has_code_pair: false** 时 `input`、`output` 可为空字符串

### 3.8 验收用例

| 场景 | 命令/条件 | 预期 |
|------|----------|------|
| AC-1 无参数运行 | `npx ts-node scripts/sft-extract.ts` | 输出到 scoring/data/sft-dataset.jsonl（或 getScoringDataPath 下 sft-dataset.jsonl） |
| AC-2 阈值可配置 | `--threshold 50` 或 `SFT_THRESHOLD=50` | 使用 50 筛选 phase_score |
| AC-3 git diff 失败 | 某记录 git diff 失败 | fallback instruction-only；has_code_pair: false；仍写入 JSONL |
| AC-4 输出摘要 | 提取完成 | stdout 含「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」 |
| AC-5 去重 | 重复 source_run_id+base_commit_hash+source_path | 仅保留一条 |
| AC-6 JSONL 格式 | 任意 | 每行含 instruction、input、output、has_code_pair；false 时 input/output 可为空 |

---

## 4. 非本 Story 范围

| 功能 | 负责 | 说明 |
|------|------|------|
| SFT 自然语言触发（「提取微调数据集」） | Story 7.3 | 本 Story 仅实现 Command 与 CLI |
| 仪表盘生成器 | Story 7.1 | /bmad-dashboard |
| Coach discovery scenario 过滤 | Story 7.4 | 归属 Epic 7 |

---

## 5. 产出物路径

| 产出 | 路径 |
|------|------|
| Command 文档 | `commands/bmad-sft-extract.md` |
| CLI 脚本 | `scripts/sft-extract.ts` |
| 核心模块（增强） | `scoring/analytics/sft-extractor.ts` |
| 输出文件 | `scoring/data/sft-dataset.jsonl`（可 --output 覆盖） |

---

## 6. 测试要求

- **单元测试**：sft-extractor 的 fallback、去重、摘要计算；阈值筛选；has_code_pair 判定
- **集成/端到端**：`npx ts-node scripts/sft-extract.ts` 在有数据/无数据/部分 git diff 失败时符合 AC；输出 JSONL 格式正确；摘要信息准确
