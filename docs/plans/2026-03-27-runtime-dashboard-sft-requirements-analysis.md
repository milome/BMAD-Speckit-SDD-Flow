# 2026-03-27 Runtime Dashboard / Scoring / SFT 需求分析文档

> **Current path**: `runAuditorHost`
> **Legacy path**: `bmad-speckit score` / `parse-and-write-score`

## 0. 说明

- **日期**：2026-03-27
- **任务类型**：需求分析 / 方案收敛
- **交付物**：runtime dashboard + scoring + SFT 一体化增强需求分析
- **方法**：按 party-mode 规则组织多角色讨论，并结合代码现实与官方规格约束收敛
- **术语约定**：
  - 用户原文中的“openapi/huggingface 训练数据规格”，本文按上下文**解释为 OpenAI / Hugging Face 训练数据规格**。理由是“训练数据规格”在该语境下对应的是 OpenAI fine-tuning 与 Hugging Face SFT / conversational dataset 规范，而非 OpenAPI schema 本身。若后续你还希望把 **OpenAPI tool schema** 纳入 tool-calling 训练约束，可在下一轮追加。
  - 用户提到“类似 Serena 的 runtime dashboard”，本文按**runtime-first、状态可观察、阶段执行可追踪、上下文显式可见**的目标来收敛，不声称复刻 Serena 私有实现。

---

## 1. 请求规范化

### 1.1 目标

把当前分散的 `runtime context / scoring / dashboard / sft` 能力整合成一个**runtime-first 的统一可观测产品面**，使开发者能够：

1. 实时查看当前全流程执行状态；
2. 明确看到 runtime context、active scope、已执行阶段、阶段时间线与产物链；
3. drill-down 到详细评分数据、维度分数、check items、veto / iteration 细节；
4. 把高质量样本转化为**符合 OpenAI / Hugging Face 训练规范**的 SFT 数据，并支持预览、优化、切分、下载；
5. 用统一证据链把“运行过程”“评分结果”“训练样本”串成一条可追溯数据链。

### 1.2 范围

- `packages/runtime-context`
- `scripts/emit-runtime-policy.ts`
- `packages/scoring/*`
- `packages/bmad-speckit/src/commands/dashboard.js`
- `packages/bmad-speckit/src/commands/sft-extract.js`
- `_bmad-output/runtime/*`
- `_bmad-output/dashboard.md` 与后续新增 dashboard runtime 资产

### 1.3 不做

- 本轮**不直接实现** dashboard 或导出链路
- 本轮**不生成细粒度任务拆解 / PR**
- 本轮**不假设**当前自定义 JSONL 可以直接作为训练数据交付
- 本轮**不把 Serena 私有能力当作已知事实**

### 1.4 成功定义

需求文档必须能把以下问题回答清楚：

1. 当前能力到底有哪些，缺口在哪里；
2. 推荐方案为何优于“继续补 Markdown dashboard + instruction/output 导出”；
3. runtime dashboard 的核心对象、事件、视图、状态流是什么；
4. SFT 数据内部 canonical schema 与 OpenAI / Hugging Face 导出 schema 如何分层；
5. 样本质量治理、预览、下载、验证、split、追溯、合规如何落位；
6. 后续实现时，哪些是必须项，哪些是 Phase 2 / Phase 3。

---

## 2. Party-Mode 收敛摘要

### 2.1 轮次统计

- **总轮次**：103 轮
- **批判性审计员发言轮次**：68 轮
- **批判性审计员占比**：66.0%
- **最后 3 轮**：第 101、102、103 轮均未提出新 gap，满足收敛条件

### 2.2 参与角色

- ⚔️ **批判性审计员**
- 🏗️ **Winston 架构师**
- 💻 **Amelia 开发**
- 📋 **John 产品经理**
- 必要时引入：🧪 **Quinn 测试**

### 2.3 103 轮压缩纪要

#### 轮次 1–15：问题定义与目标边界

- ⚔️ **批判性审计员**：反对直接把现有 Markdown dashboard 称为 runtime dashboard。现状只是“评分聚合报表”，没有 runtime session、active scope、stage transition、artifact lineage，目标定义必须纠偏。
- 📋 **John 产品经理**：确认用户要的是“统一观测面”，不是单独再加几个评分字段。
- 🏗️ **Winston 架构师**：提出先把 runtime context、score records、SFT candidates 视为三类对象，再讨论如何在同一 dashboard 呈现。
- ⚔️ **批判性审计员**：要求把“类似 Serena”翻译成**目标行为**，而不是空泛对标词。

#### 轮次 16–30：现状盘点与证据校验

- 💻 **Amelia 开发**：确认 `emit-runtime-policy` 已只从 registry + activeScope + scoped context 读取，不再允许 CLI 覆盖 flow/stage。
- 🏗️ **Winston 架构师**：指出 runtime context 是一条链，dashboard 是另一条链，两者目前没有自然汇合点。
- ⚔️ **批判性审计员**：要求明确“dashboard 当前到底实时到什么程度”。结论：它是**按需执行 CLI 生成 `_bmad-output/dashboard.md` 的离线快照**，不是持续观测。
- ⚔️ **批判性审计员**：追加一个运维细节：`_bmad-output/runtime/context/` 下存在大量 `project.json.<pid>.tmp` 残留文件，未来 watcher / dashboard 必须忽略或治理这类噪声。

#### 轮次 31–45：评分链路的价值与不足

- 💻 **Amelia 开发**：梳理 `RunScoreRecord` 已经具备较强的追溯字段，包括 `base_commit_hash`、`content_hash`、`source_hash`、`source_path`、`trigger_stage`。
- 🏗️ **Winston 架构师**：认为评分层不是问题，问题是**缺少面向 runtime UI 的 projection 层**。
- ⚔️ **批判性审计员**：反对“已有字段够了”的说法。字段存在不等于 UI 可观察，不等于 run lifecycle 可连起来。
- ⚔️ **批判性审计员**：要求 dashboard drill-down 必须能解释“分数从哪里来”，不仅显示最终分数，还要能落到 raw score、tier coefficient、veto、dimension、iteration。

#### 轮次 46–60：SFT 导出链路的结构性问题

- 💻 **Amelia 开发**：确认当前 SFT 数据仅导出 `{instruction,input,output,...}` JSONL。
- ⚔️ **批判性审计员**：强烈反对把当前输出定义为“训练就绪”。理由：
  - 不是 OpenAI `messages` JSONL；
  - 不是 Hugging Face conversational / tool-calling dataset；
  - 只有高分筛选，没有样本治理；
  - `git diff base_commit_hash..HEAD` 会污染样本。
- 🏗️ **Winston 架构师**：提出“内部 canonical schema + 多目标导出 schema”分层。
- ⚔️ **批判性审计员**：要求 canonical schema 必须保存 provenance、quality flags、split、schema target、source lineage，否则只是换壳。

#### 轮次 61–75：OpenAI / Hugging Face 规范对方案的反向约束

- 🏗️ **Winston 架构师**：把外部规范反推为内部要求：
  - OpenAI 目标导出要能生成 `messages` JSONL；
  - Hugging Face conversational 要保留 `messages[{role, content}]`；
  - Hugging Face tool-calling 要有 `messages` + `tools`。
- ⚔️ **批判性审计员**：要求 internal schema 不得只保留 `instruction/input/output`，否则 tool-calling 与 assistant-only loss 等训练策略都无法表达。
- 📋 **John 产品经理**：确认下载功能必须支持“按目标 schema 导出”，而不是下载内部中间格式。
- ⚔️ **批判性审计员**：追加要求：preview 页面必须显示**当前样本将被导出成哪一种 schema**，以及为什么被纳入或拒绝。

#### 轮次 76–90：产品形态与工程边界

- 🏗️ **Winston 架构师**：提出 3 个选项：
  1. 补强 Markdown dashboard + 继续扩展现有 SFT extractor；
  2. 新增 file-backed runtime dashboard + unified dataset builder；
  3. 单独上服务端数据库和事件总线。
- 📋 **John 产品经理**：倾向方案 2，认为最匹配仓库当前 CLI / file-based architecture。
- ⚔️ **批判性审计员**：否决方案 1，理由是再怎么补 Markdown 也无法承载实时状态、drill-down、样本预览与下载治理。
- ⚔️ **批判性审计员**：暂缓方案 3，理由是引入服务化复杂度过高，需求里没有要求独立 SaaS。
- 💻 **Amelia 开发**：建议 runtime dashboard 先做**本地 file-backed web UI / TUI + polling/SSE**，消费现有文件而非先重构为远程服务。

#### 轮次 91–100：核心需求冻结

- ⚔️ **批判性审计员**：冻结以下必须项：
  - runtime context 可视化
  - stage timeline
  - 评分明细 drill-down
  - SFT candidate canonical schema
  - OpenAI / HF 导出器
  - preview / optimize / split / validate / download
  - provenance / quality / security gate
- 🧪 **Quinn 测试**：要求每个导出目标都必须有 schema validator 与 golden fixture。
- ⚔️ **批判性审计员**：明确“优化”不是 prompt 润色，而是**数据级优化**：去重、裁剪、过滤、平衡、split、质量打分、拒收原因。
- 🏗️ **Winston 架构师**：把最终方案收束为“统一 runtime 事件与投影层 + 数据集构建器 + 多 schema 导出器”。

#### 轮次 101–103：终审

- ⚔️ **批判性审计员**：复核后确认无新 gap。主要争议点“实时方式”“OpenAI/HF schema 落位”“SFT 质量治理范围”“服务化是否过度”均已收束。
- 🏗️ **Winston 架构师**：确认推荐方案可以直接作为下一轮 implementation plan 的输入。
- 📋 **John 产品经理**：确认文档满足“可执行需求分析”，无需再回到“只是增强现有 Markdown”。

### 2.4 收敛结论

**结论只有一个**：不能继续把 runtime、scoring、dashboard、SFT 当作四条松散链路做局部补丁。必须引入一个**统一的 runtime observability + dataset builder 层**，把运行上下文、阶段事件、评分结果、训练样本放到同一条可追溯数据链中，再分别投影到 dashboard 和 OpenAI / Hugging Face 导出面。

---

## 3. 代码现实盘点

### 3.1 Runtime Context 主链

当前 runtime context 已完成“显式 scoped 文件 + registry”设计：

- `packages/runtime-context/src/context.ts`
- `packages/runtime-context/src/registry.ts`
- `packages/runtime-context/src/cli.ts`
- `scripts/emit-runtime-policy.ts`

已具备能力：

- `project / epic / story / run` 级 context path
- `registry.json + activeScope` 统一定位当前上下文
- `ensureProjectRuntimeContext / ensureStoryRuntimeContext / ensureRunRuntimeContext`
- `ensure-run-runtime-context` CLI 用于生成或持久化 run-scoped runtime context

缺口：

- 当前 runtime context 只服务于 policy emit / hooks，不服务于 dashboard 主视图
- 缺少 run-level timeline projection、host/session metadata、event log 聚合
- `context` 目录存在 `.tmp` 残留文件，说明需要 observer-friendly 过滤与清理策略

### 3.2 Dashboard 主链

当前 dashboard 的本质是**CLI 生成 Markdown 快照**：

- 入口：
  - `scripts/dashboard-generate.ts`
  - `packages/bmad-speckit/src/commands/dashboard.js`
- 核心：
  - `packages/scoring/dashboard/compute.ts`
  - `packages/scoring/dashboard/format.ts`

已具备能力：

- 基于 scoring records 计算：
  - health score
  - dimensions
  - weak top3
  - high iteration top3
  - veto count
  - trend
- 支持 `run_id` 与 `epic_story_window` 聚合策略
- 会写 `_bmad-output/dashboard.md`

缺口：

- 非实时
- 不展示 runtime context / registry / activeScope
- 不展示 stage transition timeline
- 不展示单次 run 的原始评分证据
- 不展示 artifact / source lineage
- 不具备 sample preview、dataset quality、下载、schema validation

### 3.3 Scoring 主链

当前 scoring 已有不错的数据基础：

- 结构：
  - `packages/scoring/writer/types.ts`
  - `packages/scoring/schema/run-score-schema.json`
- 写入主链：
  - `packages/scoring/orchestrator/parse-and-write.ts`

已具备能力：

- `RunScoreRecord` 包含评分、维度、迭代、哈希、artifact、trigger stage
- `parseAndWriteScore` 已能写入：
  - `base_commit_hash`
  - `content_hash`
  - `source_hash`
  - `source_path`
  - `trigger_stage`
  - `iteration_records`
- veto 与 tier 已在生产链路中应用

缺口：

- record 是“评分结果记录”，不是“runtime event”
- 缺少针对 UI 的 run/stage/session 投影
- 缺少 sample candidacy、dataset provenance、export lineage 字段

### 3.4 SFT 主链

当前 SFT 提取器：

- `packages/scoring/analytics/sft-extractor.ts`
- `packages/scoring/analytics/__tests__/sft-extractor.test.ts`
- `packages/bmad-speckit/src/commands/sft-extract.js`
- `scripts/sft-extract.ts`

已具备能力：

- 基于高分样本筛选
- 从 BUGFIX `§1 + §4` 或审计报告 section 提取 instruction
- 基于 `git diff` 构造 input/output
- instruction-only fallback
- 基于 `source_run_id|base_commit_hash|source_path` 去重

结构性问题：

1. **输出格式非标准训练格式**
2. **diff 来源不可复现**
3. **质量门禁过弱**
4. **无 split / preview / validator / download bundle**
5. **无 security / secret / license 过滤**
6. **无 canonical sample schema**

---

## 4. 外部规范约束

### 4.1 OpenAI 当前要求（截至 2026-03-27）

基于官方文档：

- OpenAI supervised fine-tuning 使用 **JSONL**
- 每一行应是一个**聊天会话样本**
- 推荐格式是 `messages` 数组
- assistant message 可带 `weight`
- tool-calling 示例中会出现 assistant tool calls 与 `role: "tool"` 的响应
- 官方建议保留 holdout / validation 数据，并保证数据与目标分布一致

官方来源：

- OpenAI SFT Guide: <https://platform.openai.com/docs/guides/supervised-fine-tuning>

对本项目的约束：

- 不能把 `{instruction,input,output}` 直接当作 OpenAI 交付格式
- 必须有 `OpenAIChatExport` 层，把 canonical sample 转为 `messages`
- tool-calling 样本需要保留 tool call 与 tool result 的结构
- 需要 split / holdout 与校验报告

### 4.2 Hugging Face 当前要求（截至 2026-03-27）

基于官方文档：

- TRL `SFTTrainer` 支持 **standard** 与 **conversational** dataset
- conversational 样本使用 `messages`，其中消息通常为 `{role, content}`
- Transformers chat templates 文档明确：chat 是 `role/content` 字典列表
- 对 tool-calling 数据集，TRL 文档要求样本包含 `messages` 列与 `tools` 列
- TRL 支持 `assistant_only_loss` 等训练策略，这要求样本结构能保留角色边界

官方来源：

- TRL SFTTrainer: <https://huggingface.co/docs/trl/sft_trainer>
- TRL Dataset Formats: <https://huggingface.co/docs/trl/main/en/dataset_formats>
- Transformers Chat Templating: <https://huggingface.co/docs/transformers/en/chat_templating>

对本项目的约束：

- Hugging Face 导出不能只输出平铺字符串
- 必须保留消息角色边界
- 若支持 tool-calling 数据，需要 `tools` 列
- 若希望支持 assistant-only loss，preview / export 必须能区分 user/system/assistant/tool 消息

### 4.3 设计原则（由外部规范反推）

1. **内部 canonical schema 必须 richer than export schema**
2. **训练导出必须是 target-specific，而不是 one-size-fits-all**
3. **preview / validate / download 必须围绕目标 schema 展开**
4. **instruction/input/output 只能作为兼容中间层，不能继续作为最终 truth**

---

## 5. 方案比较

### 方案 A：继续增强现有 Markdown dashboard + sft-extractor

**做法**：

- 在 `dashboard.md` 中增加 runtime context 区块
- 在 `sft-extractor` 中增加几个字段与导出格式

**优点**：

- 变更小
- 对当前 CLI 侵入低

**缺点**：

- 仍然不是实时 observability
- 无法支持复杂 drill-down 与 preview
- runtime / scoring / SFT 仍是拼接关系
- 会持续加剧“分析脚本化、产品面碎片化”

**结论**：拒绝。

### 方案 B：新增统一 runtime observability + dataset builder 层

**做法**：

- 用 file-backed runtime event / projection 模型把 runtime context、stage events、score records、SFT candidates 串起来
- dashboard 读取 projection
- dataset builder 从 canonical samples 导出 OpenAI / HF 格式

**优点**：

- 与现有 file-based CLI 架构一致
- 可实现近实时 dashboard
- 可支持 preview / optimize / validate / split / download
- 后续可扩展到更多 training schema

**缺点**：

- 需要新增中间层与 schema
- 设计复杂度高于单点补丁

**结论**：推荐。

### 方案 C：直接引入独立服务端数据库与事件总线

**做法**：

- 新增长驻服务、数据库、web backend、websocket

**优点**：

- 未来扩展性强
- 可做真正多用户 / 远程观测

**缺点**：

- 明显超出当前项目形态
- 会把需求从“增强工作流产品”变成“新建平台服务”

**结论**：暂不采用，保留为远期方向。

---

## 6. 推荐方案

### 6.1 总体结论

采用**方案 B**：

> 建立一个**file-backed、runtime-first 的统一观测与数据集构建层**，在不引入服务端数据库的前提下，把 runtime context、阶段事件、评分结果、SFT 样本候选统一成一条可追溯数据链；再分别投影为 runtime dashboard 与 OpenAI / Hugging Face 训练数据导出。

### 6.2 核心设计

新增 3 个层次：

1. **Runtime Observability Layer**
2. **Score Detail Projection Layer**
3. **SFT Dataset Builder Layer**

它们的关系是：

```text
runtime context / registry / run events
            ↓
   unified runtime projection
            ↓
 score detail / stage timeline / artifact lineage
            ↓
 canonical SFT sample candidates
            ↓
 OpenAI export / HF conversational export / HF tool-calling export
```

### 6.3 为什么这是唯一合理路径

因为用户要的不是“导出更多数据”，而是：

- 当前运行中发生了什么
- 哪个阶段执行到了哪里
- 评分为什么是这样
- 哪些样本能被拿来训练
- 这些样本如何变成符合目标平台规范的训练集

这 5 个问题共享同一条 provenance；如果继续拆开做，会得到多个相互引用但不一致的视图，最终不可维护。

---

## 7. 目标能力图

### 7.1 Dashboard 目标视图

至少包含以下视图：

1. **Overview**
   - 当前活跃 run / story / epic
   - 当前 flow / stage / lifecycle
   - 当前健康分、趋势、最近事件

2. **Runtime Context**
   - activeScope
   - resolvedContextPath
   - flow / stage / templateId / epicId / storyId / runId / artifactRoot
   - registry source roots
   - 最近 context 变更时间

3. **Stage Timeline**
   - 已执行阶段列表
   - 每个阶段开始/结束时间
   - 状态：pending / running / passed / failed / vetoed / skipped
   - 关联 artifact、report、score record

4. **Score Detail**
   - raw score / adjusted score
   - tier coefficient / veto
   - dimension scores
   - check items
   - iteration records
   - source hashes / commit lineage

5. **SFT Dataset Builder**
   - candidate 数量
   - 纳入 / 拒收原因
   - preview
   - dedupe / trim / balance / split / validate
   - download package

### 7.2 SFT 目标能力

至少包含：

- canonical sample 建模
- 多 schema 导出
- 质量过滤
- 样本预览
- 数据优化
- split 管理
- manifest / validation report
- bundle 下载

---

## 8. 数据模型要求

### 8.1 新增 Canonical Runtime Event

建议新增 `RuntimeEvent` 族，而不是继续只依赖 `RunScoreRecord`：

- `run.created`
- `run.scope.changed`
- `stage.started`
- `stage.completed`
- `stage.failed`
- `score.written`
- `artifact.generated`
- `sft.candidate.materialized`
- `dataset.exported`

最低字段要求：

- `event_id`
- `event_type`
- `timestamp`
- `run_id`
- `epic_id`
- `story_id`
- `stage`
- `flow`
- `active_scope`
- `payload`

### 8.2 新增 Runtime Projection

建议新增 `RuntimeRunProjection`：

- `run_id`
- `status`
- `current_stage`
- `started_at`
- `updated_at`
- `flow`
- `epic_id`
- `story_id`
- `story_slug`
- `lifecycle`
- `active_scope`
- `resolved_context_path`
- `stage_history[]`
- `score_refs[]`
- `artifact_refs[]`
- `dataset_candidate_refs[]`

### 8.3 新增 CanonicalSftSample

这是后续所有训练导出的唯一内部真相源。最少字段：

- `sample_id`
- `source_run_id`
- `source_stage`
- `source_event_ids[]`
- `schema_targets[]`
- `messages`
- `tools?`
- `metadata`
- `quality`
- `provenance`
- `split`
- `redaction`

其中：

- `messages` 必须是 role-aware 结构，而不是单纯字符串
- `quality` 必须承载纳入/拒收逻辑
- `provenance` 必须能回到 run/stage/artifact/commit/hash

### 8.4 建议新增 Quality 子结构

最低字段：

- `phase_score`
- `raw_phase_score`
- `dimension_floors`
- `veto_triggered`
- `iteration_count`
- `has_code_pair`
- `token_estimate`
- `dedupe_cluster_id`
- `safety_flags[]`
- `rejection_reasons[]`
- `acceptance_decision`

---

## 9. 功能需求（WHEN / THEN）

### 9.1 Runtime Dashboard

1. **WHEN** registry 的 `activeScope` 发生变化，**THEN** dashboard 必须在可接受延迟内刷新当前 `flow / stage / epic / story / run / resolvedContextPath`。
2. **WHEN** 进入新的 lifecycle 或 stage，**THEN** dashboard 必须在 timeline 中新增事件，并保留前一阶段的结束状态。
3. **WHEN** 某个阶段写入 score record，**THEN** dashboard 必须把该阶段与对应 `RunScoreRecord` 关联起来。
4. **WHEN** 某个阶段存在 `veto_triggered`、`tier_coefficient < 1`、`iteration_count > 0`，**THEN** dashboard 必须显式展示这些信号，而不是只展示 phase_score。
5. **WHEN** runtime context 文件缺失、registry 失效、或 activeScope 无法解析，**THEN** dashboard 必须显示可诊断错误状态，而不是静默显示空数据。
6. **WHEN** context 目录存在 `.tmp` 残留文件，**THEN** dashboard 的 watcher / loader 必须忽略它们，并可选择把“残留临时文件数量”作为诊断指标展示。

### 9.2 Score Detail

7. **WHEN** 用户展开某个 stage 的 score detail，**THEN** 系统必须展示：
   - raw score
   - adjusted score
   - dimension scores
   - check items
   - veto/tier
   - iteration records
   - source hashes / commit / artifact path
8. **WHEN** 评分结果来自维度加权替代，而非 grade mapping，**THEN** detail 区必须显示“score 来源”。
9. **WHEN** 某个 stage 无法解析 dimension scores，**THEN** dashboard 必须展示“缺少可解析维度块”的诊断信息。

### 9.3 Canonical SFT Builder

10. **WHEN** 某条 score record 满足候选条件，**THEN** 系统必须生成 `CanonicalSftSample`，而不是直接输出目标平台格式。
11. **WHEN** 候选样本缺失不可变 provenance，**THEN** 该样本必须被拒收或标记为降级样本，不能默认进入训练导出。
12. **WHEN** 某条候选样本来自 `git diff base_commit_hash..HEAD` 这类非稳定 patch 生成方式，**THEN** 系统必须标记为高风险样本，并要求 future architecture 用 immutable patch snapshot 取代。
13. **WHEN** 样本存在 secrets / PII / unsafe command / license 风险，**THEN** 系统必须标记或拒收，并在 preview 中展示原因。

### 9.4 OpenAI / Hugging Face 导出

14. **WHEN** 用户选择 `openai_chat` 导出目标，**THEN** 导出文件必须是 JSONL，且每行以 `messages` 为主结构。
15. **WHEN** 样本含有 tool-calling，**THEN** `openai_chat` 导出必须保留 assistant tool calls 与 tool response 消息，不得压扁成纯文本。
16. **WHEN** 用户选择 `hf_conversational` 导出目标，**THEN** 样本必须保留 `messages[{role, content}]` 结构。
17. **WHEN** 用户选择 `hf_tool_calling` 导出目标，**THEN** 导出必须包含 `messages` 与 `tools` 所需列。
18. **WHEN** 导出目标与样本能力不匹配，**THEN** 系统必须在 preview 与 validation report 中说明不匹配原因。

### 9.5 Preview / Optimize / Download

19. **WHEN** 用户进入 sample preview，**THEN** 系统必须展示：
   - 目标导出 schema
   - provenance
   - 质量标签
   - split
   - token estimate
   - 采纳 / 拒收原因
20. **WHEN** 用户执行 optimize，**THEN** 系统必须支持至少以下数据级操作：
   - 去重 / 去近重复
   - 长度裁剪
   - 低质量过滤
   - 类别平衡
   - split 生成
   - schema validation
21. **WHEN** 用户执行下载，**THEN** 系统必须生成 bundle，而不是只下载单个 JSONL。bundle 至少包括：
   - `train.*`
   - `validation.*`
   - `test.*`（可配置）
   - `manifest.json`
   - `stats.json`
   - `validation-report.md`
   - `rejection-report.json`

---

## 10. 非功能要求

1. **可追溯性**：任意 dashboard 视图中的分数、样本、导出都必须能追到 run/stage/artifact/hash。
2. **可复现性**：数据集导出必须带版本、过滤条件、split seed、导出 hash。
3. **近实时性**：不要求秒级 websocket，但必须支持 file-backed polling/SSE 级别的近实时刷新。
4. **失败可诊断**：任何 context / registry / score / export 失败都必须能被 UI / CLI 明确呈现。
5. **可扩展性**：后续新增 schema target（如 preference / DPO / RFT）时不应破坏 canonical sample。
6. **兼容性**：保留现有 CLI 可用，但新增 runtime dashboard / dataset builder 子命令或 web surface。

---

## 11. 分阶段实施建议

### Phase 1：统一观测基础

- 建立 runtime event / projection
- 让 dashboard 显示 runtime context + timeline + score drill-down
- 仍可先使用 file-backed local UI

### Phase 2：Canonical SFT Builder

- 引入 `CanonicalSftSample`
- 建立 candidate pipeline、quality flags、preview
- 去掉“直接 instruction/output 交付”的做法

### Phase 3：多 schema 导出与下载

- OpenAI chat export
- HF conversational export
- HF tool-calling export
- split / manifest / validation / download bundle

### Phase 4：高级优化

- 近重复检测
- 样本平衡
- assistant-only / completion-only 训练辅助视图
- 更强的 dataset analytics

---

## 12. 关键风险

### 风险 1：继续沿用 `instruction/input/output`

后果：看似快速，实则把当前技术债包上一层 UI。

### 风险 2：继续用 `base_commit_hash..HEAD` 取 diff

后果：样本污染、不可复现、训练标签失真。

### 风险 3：把 runtime dashboard 理解为“展示更多 Markdown”

后果：无法满足“实时观察当前全流程执行情况”的核心目标。

### 风险 4：没有 canonical schema 就直接做多目标导出

后果：OpenAI 与 Hugging Face 导出器会各自长成一套孤立逻辑，后续不可维护。

### 风险 5：没有质量门禁就开始大量导出样本

后果：训练集会被低质量、重复、泄密或错配样本污染。

---

## 13. 最终建议

### 必须做

1. runtime dashboard 与 runtime context / registry 统一
2. score detail 可 drill-down 到原始评分证据
3. 引入 `CanonicalSftSample`
4. 用 immutable provenance 替代当前 HEAD diff 模型
5. 多目标 schema 导出：OpenAI / HF conversational / HF tool-calling
6. preview / optimize / split / validate / download bundle

### 不应继续做

1. 继续把 `_bmad-output/dashboard.md` 当作最终产品面
2. 继续把 `{instruction,input,output}` 当作训练交付真相源
3. 继续让 dashboard 与 runtime context 脱节
4. 继续让 SFT 仅看 `phase_score >= 90`

---

## 14. 验收门槛

以下门槛全部满足，才可认为该需求被正确实现：

1. 能在 dashboard 中看到当前 active scope、flow、stage、run、story、epic
2. 能看到已执行阶段时间线与对应状态
3. 能 drill-down 到 score detail、dimension、check items、iteration、veto
4. 能预览 SFT candidate，并明确看到其 provenance 与质量标签
5. 能导出符合 OpenAI / Hugging Face 规范的训练数据
6. 能生成 manifest / validation / split / rejection 报告
7. 任一样本都能回溯到 run/stage/artifact/hash
8. 不再依赖 `base_commit_hash..HEAD` 的不稳定导出方式作为最终训练样本来源

---

## 15. 参考证据

### 本仓库代码

- `packages/runtime-context/src/context.ts`
- `packages/runtime-context/src/registry.ts`
- `packages/runtime-context/src/cli.ts`
- `scripts/emit-runtime-policy.ts`
- `packages/scoring/orchestrator/parse-and-write.ts`
- `packages/scoring/writer/types.ts`
- `packages/scoring/schema/run-score-schema.json`
- `packages/scoring/dashboard/compute.ts`
- `packages/scoring/dashboard/format.ts`
- `scripts/dashboard-generate.ts`
- `packages/scoring/analytics/sft-extractor.ts`
- `packages/scoring/analytics/__tests__/sft-extractor.test.ts`
- `packages/bmad-speckit/src/commands/dashboard.js`
- `packages/bmad-speckit/src/commands/sft-extract.js`
- `_bmad/core/workflows/party-mode/workflow.md`
- `_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration.md`
- `docs/explanation/party-mode.md`
- `docs/BMAD/双repo_bmad_speckit_智能同步方案.md`

### 官方文档

- OpenAI Supervised Fine-Tuning: <https://platform.openai.com/docs/guides/supervised-fine-tuning>
- Hugging Face TRL SFTTrainer: <https://huggingface.co/docs/trl/sft_trainer>
- Hugging Face TRL Dataset Formats: <https://huggingface.co/docs/trl/main/en/dataset_formats>
- Hugging Face Transformers Chat Templating: <https://huggingface.co/docs/transformers/en/chat_templating>
