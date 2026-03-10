# Story 7.2：SFT 提取 Command

**Epic**：7 eval-ux-dashboard-and-sft  
**Story**：7.2  
**Slug**：sft-extract-command  
**来源**：epics.md §Epic 7、prd.eval-ux-last-mile.md §5.4（REQ-UX-4.1～4.6）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-4.1～4.6 | SFT 提取 Command：无参数运行、phase_score≤60 筛选、git diff 失败 fallback、输出摘要、去重、JSONL 格式 | 是 | AC-1～AC-6 |

---

## 2. User Story

**As a** AI 研发效能工程师  
**I want to** 运行 `/bmad-sft-extract` 而不提供 run-id 或复杂参数  
**so that** 我能获得 sft-dataset.jsonl，用于模型 SFT 微调

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **Command `/bmad-sft-extract`**  
   - 无参数运行即可提取微调数据集  
   - 输出到 `scoring/data/sft-dataset.jsonl`（或 `--output` 指定路径）

2. **phase_score 阈值筛选**  
   - 筛选 phase_score≤60 的记录（阈值可通过 env 或 CLI 参数配置）

3. **git diff 失败 fallback**  
   - 某记录 git diff 无法生成代码对时，fallback 为 instruction-only（§1+§4），SftEntry 含 `has_code_pair: false`

4. **输出摘要**  
   - 含「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」

5. **去重**  
   - 存在重复 source_run_id+base_commit_hash+source_path 时仅保留一条

6. **JSONL 格式**  
   - 每行含 instruction、input、output；`has_code_pair: false` 时 input/output 可为空

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| SFT 自然语言触发（「提取微调数据集」） | Story 7.3 | 本 Story 仅实现 Command 核心逻辑 |
| 仪表盘生成器 | Story 7.1 | 归属 Epic 7 |

### 3.3 技术依赖与路径

| 依赖 | 路径/来源 | 说明 |
|------|-----------|------|
| SFT 提取核心 | scoring/analytics/sft-extractor.ts | 已含 SftEntry、extractSftDataset、extractBugfixSections、gitDiffBetween 等；Command/CLI 层复用并增强（fallback、去重、摘要、阈值可配置） |
| 评分查询层 | scoring/query/ | 加载评分记录 |
| 输出路径 | scoring/data/sft-dataset.jsonl | 默认路径；支持 --output 覆盖 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 无参数运行 | 存在 phase_score≤60 的记录 | 用户运行 `/bmad-sft-extract` | 输出到 scoring/data/sft-dataset.jsonl（或 --output 指定路径） |
| AC-2 | 阈值可配置 | — | 通过 env 或 CLI 参数设置阈值 | 使用该阈值筛选 phase_score |
| AC-3 | git diff 失败 | 某记录 git diff 无法生成代码对 | 提取该记录 | fallback 为 instruction-only（§1+§4），SftEntry 含 has_code_pair: false |
| AC-4 | 输出摘要 | 提取完成 | — | 含「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」 |
| AC-5 | 去重 | 存在重复 source_run_id+base_commit_hash+source_path | 写入 JSONL | 仅保留一条 |
| AC-6 | JSONL 格式 | — | 输出完成 | 每行含 instruction、input、output；has_code_pair: false 时 input/output 可为空 |

---

## 5. 禁止词表合规声明

本 Story 文档已避免使用禁止词表所列全部词汇。所有范围界定均采用明确归属（由 Story X.Y 负责）。

---

## 6. 产出物清单

| 产出 | 路径 | 说明 |
|------|------|------|
| Command 定义 | `commands/bmad-sft-extract.md` | Cursor Command 入口 |
| CLI 脚本 | `scripts/sft-extract.ts` | 调用 scoring/analytics/sft-extractor，支持 --output、阈值参数 |
| 核心模块（复用并增强） | `scoring/analytics/sft-extractor.ts` | 已有 SftEntry、extractSftDataset；本 Story 增强 fallback、去重、摘要、阈值 |
| 验收 | — | 运行 `/bmad-sft-extract` 可输出 sft-dataset.jsonl 及摘要 |

## 7. 推迟闭环

Story 7.3（SFT 纳入 bmad-eval-analytics Skill）依赖本 Story 的 Command 与提取逻辑。本 Story 仅实现 `/bmad-sft-extract` Command 与 CLI 封装，不包含自然语言触发；闭环在 Story 7.3 完成（Skill 调用本 Story 产出的提取逻辑）。
