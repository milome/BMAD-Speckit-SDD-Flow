# spec-E1-S2：eval-system-storage-writer 技术规格

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.2  
**来源**：1-2-eval-system-storage-writer.md、Story 1.1 spec、Architecture §8、§9.1

---

## 1. 范围与目标

### 1.1 本 spec 覆盖

实现评分写入逻辑：接收符合 Story 1.1 存储 schema 的单条评分记录，按配置模式持久化到指定路径。包含单文件写入、JSONL 追加、三种写入模式（仅单文件、仅 JSONL、双写）、check_items 数组结构保证、目录自动创建、与 run-score-schema 的兼容校验。不包含评分规则 YAML 解析（Story 2.1）、审计报告解析与触发（Story 3.x）、一票否决与阶梯扣分（Story 4.1）、CSV 导出、全链路 Skill 编排。

### 1.2 功能边界

| 包含 | 不包含 |
|------|--------|
| 单条记录写入接口（入参：记录 + 模式） | 评分规则 YAML 配置与解析 |
| 单文件 `scoring/data/{run_id}.json` 写入/覆盖 | 从审计报告解析出评分记录 |
| JSONL 追加 `scoring/data/scores.jsonl` | 一票否决、多次迭代阶梯式扣分 |
| 三种模式：仅单文件、仅 JSONL、同时写入 | CSV 导出 |
| check_items 数组（item_id、passed、score_delta、note） | 全链路 Skill 编排与触发 |
| 写入前创建 scoring/data 目录 | |
| 写入 payload 与 Story 1.1 run-score-schema 一致 | |
| 复用 getScoringDataPath()、run-score-schema.json | |

---

## 2. 与 Story 1.1 / Architecture 的衔接

### 2.1 Schema 与类型

- **存储 schema**：写入的 payload 必须符合 `scoring/schema/run-score-schema.json` 定义。
- **必存字段**：run_id、scenario、stage、phase_score、phase_weight、check_items、timestamp、iteration_count、iteration_records、first_pass；可选 path_type、model_version、question_version。
- **check_items**：数组，每项必含 item_id、passed、score_delta；可含 note。与 Architecture §8.2、Story 1.1 spec §3.2 一致。

### 2.2 路径与目录

- **根路径**：使用现有 `getScoringDataPath()`（`scoring/constants/path.ts`），默认 `scoring/data/`，可由环境变量 `SCORING_DATA_PATH` 覆盖。
- **单文件**：`{getScoringDataPath()}/{run_id}.json`。
- **追加文件**：`{getScoringDataPath()}/scores.jsonl`。
- 与 Architecture §8.3、§9.1 及 Story 1.1 目录结构一致。

### 2.3 依赖关系

- 依赖 Story 1.1：run-score-schema、目录约定、getScoringDataPath。
- 不依赖 scoring/core 计算逻辑；writer 与 core 无循环依赖。
- 写入内容可被 Story 1.1 的 schema 校验通过（如 AJV 校验产出文件）。

---

## 3. 写入模式规格

| 模式 | 行为 | 产出文件 |
|------|------|----------|
| 仅单文件 | 仅写入或覆盖 `{run_id}.json` | `scoring/data/{run_id}.json` |
| 仅 JSONL | 仅在 scores.jsonl 末尾追加一行 JSON | `scoring/data/scores.jsonl` |
| 同时写入 | 既写单文件又追加 JSONL | 两者均更新 |

模式由**入参或配置**决定，接口设计在 plan 阶段细化。

---

## 4. 单文件模式下同一 run_id 的语义

- **约定**：同一 run_id 的多次写入采用**覆盖**语义。即每次调用写入单文件时，将当前记录完整写入 `{run_id}.json`，不合并历史。
- 文档与代码注释中明确此约定；单测覆盖同一 run_id 连续写入的覆盖行为。

---

## 5. check_items 与目录创建

- **check_items**：写入前不改变 caller 传入的结构；保证序列化后为数组，每项含 item_id、passed、score_delta、note（可选）。若 caller 传入已符合 schema，则原样写入。
- **目录创建**：在写入任一文件前，若 `getScoringDataPath()` 指向的目录不存在，则先创建该目录（含父级），再执行写入。

---

## 6. 验收标准映射

| AC | 验收标准 | spec 对应 |
|----|----------|-----------|
| AC-1 | 单条评分记录可按 Story 1.1 schema 写入 JSON 文件 | §2.1、§2.2 |
| AC-2 | JSONL 追加：每次在 scores.jsonl 末尾追加一行，不覆盖已有行 | §3 仅 JSONL / 同时写入 |
| AC-3 | 三种模式（仅单文件、仅 scores.jsonl、同时写入）由配置或入参决定 | §3 |
| AC-4 | check_items 为数组，每项含 item_id、passed、score_delta、note | §2.1、§5 |
| AC-5 | 写入前目录不存在时自动创建 scoring/data | §5 |
| AC-6 | 单文件模式下同一 run_id 多次写入为覆盖，文档/接口约定 | §4 |
| AC-7 | 写入内容可被 Story 1.1 的 schema 校验通过 | §2.1 |

---

## 7. PRD 需求追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.10 | 版本追溯与存储：run_id、scenario、stage、phase_score、check_items、iteration_count、iteration_records、first_pass 等 schema 的持久化写入；§3.6 完整 schema 的写入实现 |
| REQ-1.2 | 各阶段审计通过且得分写入后视为该阶段迭代结束——本 Story 提供「得分写入」的写入能力 |

---

## 8. 需求映射清单（spec ↔ Story 文档）

| Story § | 要点 | spec 对应 |
|---------|------|-----------|
| §1.1 评分写入逻辑 | 接收 schema 记录、持久化、与 1.1 一致 | §1.1、§2 |
| §1.1 JSON/JSONL | 单文件完整写入、JSONL 追加 | §3 |
| §1.1 单次运行单文件与双模式 | 单文件 + 三种模式 | §3、§4 |
| §1.1 check_items | 数组、item_id/passed/score_delta/note | §2.1、§5 |
| §1.1 存储路径与命名 | run_id.json、scores.jsonl | §2.2 |
| §2 验收标准 AC-1～AC-7 | 全部 | §6 |
| §4 Architecture 约束 | 路径、schema、与 1.1 衔接 | §2 |

---

## 9. 禁止词表合规

本 spec 及后续 plan/GAPS/tasks 禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。

---

## 10. 自审结论

- **Scope**：Story 1.2 §1.1 五项均已覆盖。
- **验收标准**：AC-1～AC-7 均有 spec 对应。
- **PRD 追溯**：REQ-3.10、REQ-1.2 已映射。
- **与 Story 1.1 衔接**：schema、路径、getScoringDataPath 已明确。
- **禁止词表**：已合规。
