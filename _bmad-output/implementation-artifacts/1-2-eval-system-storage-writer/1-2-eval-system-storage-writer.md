# Story 1.2：eval-system-storage-writer

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.2  
**描述**：实现评分写入逻辑，支持 JSON/JSONL 追加模式，单次运行单文件与 scores.jsonl 双模式，check_items 明细结构

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **评分写入逻辑**
   - 接收符合 Story 1.1 定义的存储 schema 的评分记录
   - 将单条记录持久化到指定存储路径
   - 与 Story 1.1 的 schema（run_id、scenario、stage、phase_score、check_items 等）一致

2. **JSON/JSONL 追加模式**
   - JSON：单条记录完整写入或覆盖单文件
   - JSONL：每行一条 JSON，追加写入，不重写已有行

3. **单次运行单文件与 scores.jsonl 双模式**
   - 单文件模式：单次运行产出 `scoring/data/{run_id}.json`，包含该 run_id 下该次写入或聚合后的记录
   - 双模式：同一运行可配置为仅写单文件、仅追加 scores.jsonl、或同时写入两种目标

4. **check_items 明细结构**
   - 写入时保证 check_items 为数组，每项含 item_id、passed、score_delta、note
   - 与 Architecture §8.2 及 Story 1.1 的 check_items 结构一致

5. **存储路径与文件命名**
   - 单文件：`scoring/data/{run_id}.json`
   - 追加文件：`scoring/data/scores.jsonl`
   - 路径与 Architecture §8.3、§9.1 一致，与 Story 1.1 的目录结构衔接

### 1.2 本 Story 不包含

- 评分规则 YAML 配置与解析（由 Story 2.1 eval-rules-yaml-config 实现）
- 从审计报告解析出评分记录的逻辑（由 Story 3.2、3.3 实现）
- 一票否决、多次迭代阶梯式扣分计算（由 Story 4.1 实现）
- CSV 导出（本 Story 不实现；PRD/Architecture 中 CSV 导出由其他 Story 或独立任务明确）
- 全链路 Skill 编排与触发（由 Story 3.1、3.3 实现）

---

## 2. 验收标准

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 单条评分记录可按 Story 1.1 schema 写入 JSON 文件 | 给定一条合法记录，调用写入接口，检查 `scoring/data/{run_id}.json` 存在且内容一致 |
| AC-2 | 支持 JSONL 追加：每次写入在 scores.jsonl 末尾追加一行 JSON，不覆盖已有行 | 多次调用追加接口，检查 scores.jsonl 行数递增、每行可独立解析为合法 JSON |
| AC-3 | 支持「仅单文件」「仅 scores.jsonl」「同时写入」三种模式，由配置或入参决定 | 分别以三种模式调用，验证仅目标文件被创建/更新 |
| AC-4 | check_items 写入格式为数组，每项含 item_id、passed、score_delta、note | 写入后读取文件，校验 check_items 结构符合 Architecture §8.2 |
| AC-5 | 写入前目录不存在时自动创建 scoring/data | 在无 scoring/data 环境下执行写入，验证目录与文件均生成 |
| AC-6 | 单文件模式下同一 run_id 多次写入的行为明确（覆盖或聚合）并在文档/接口中约定 | 文档或代码注释明确；单测覆盖同一 run_id 的写入语义 |
| AC-7 | 与 Story 1.1 的 TypeScript 类型或 JSON schema 兼容，写入内容可被 1.1 的 schema 校验通过 | 使用 1.1 的 schema 校验写入产出文件 |

---

## 3. PRD 需求追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.10 | 版本追溯与存储：run_id、scenario、stage、phase_score、check_items、iteration_count、iteration_records、first_pass 等 schema 的持久化写入；§3.6 完整 schema 的写入实现 |
| REQ-1.2 | 各阶段审计通过且得分写入后视为该阶段迭代结束——本 Story 提供「得分写入」的写入能力 |

---

## 4. Architecture 约束

| 约束项 | 说明 |
|--------|------|
| 存储路径 | scoring/data/（或与 Story 1.1 一致的可配置根路径）；单文件 `{run_id}.json`，追加文件 `scores.jsonl` |
| Schema | 必存字段及 check_items 结构与 Architecture §8.1、§8.2 一致，与 Story 1.1 定义无冲突 |
| 与 Story 1.1 衔接 | 写入的 payload 使用 Story 1.1 的存储 schema；不引入新字段；若 1.1 使用 TypeScript 类型或 JSON schema，本 Story 写入前校验或生成时依赖同一类型定义 |
| 数据流 | 本 Story 不实现「审计报告→解析→记录」；仅实现「已构造好的记录→持久化」，解析与触发由 Story 3.x 负责 |

---

## 5. 禁止词表合规

本 Story 文档及产出物禁止使用以下表述：

- 可选
- 后续
- 待定
- 酌情
- 视情况
- 先实现
- 或后续扩展

---

## 6. 实施任务分解

| Task ID | 任务描述 | 产出物 |
|---------|----------|--------|
| T1 | 实现写入接口：入参为单条符合 schema 的评分记录 + 模式（单文件 / jsonl / 双写） | 写入模块或函数，可被 Node/TS 或脚本调用 |
| T2 | 实现单文件写入：生成或覆盖 `scoring/data/{run_id}.json`，内容为合法 JSON | 单文件写入逻辑 + 单测 |
| T3 | 实现 JSONL 追加：向 `scoring/data/scores.jsonl` 追加一行，保证原子追加与编码正确 | JSONL 追加逻辑 + 单测 |
| T4 | 实现双模式分发：根据配置/入参选择仅单文件、仅 jsonl、或两者都写 | 模式分支与集成 |
| T5 | 保证 check_items 序列化与 §8.2 一致；写入前创建 scoring/data 目录 | 结构校验或类型约束 + 目录创建逻辑 |
| T6 | 编写本 Story 的验收脚本或单测（覆盖 AC-1～AC-7） | 测试文件或验收脚本 |

---

## 7. 依赖

- **前置 Story**：Story 1.1（eval-system-scoring-core）。依赖 1.1 的存储 schema、目录结构及表 A/B 约定；写入的 payload 与 1.1 的 schema 一致。
- 依赖 Architecture §8.1、§8.2、§8.3、§9.1 的存储约定。

---

*本 Story 在 Story 1.1 的评分核心与存储 schema 基础上，实现评分结果的持久化写入，为全链路 Skill（Story 3.3）提供写入能力。*
