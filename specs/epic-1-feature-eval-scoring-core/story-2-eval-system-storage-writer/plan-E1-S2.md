# plan-E1-S2：eval-system-storage-writer 实现方案

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.2  
**输入**：spec-E1-S2.md

---

## 1. 目标与约束

- 实现单条评分记录的持久化写入，支持单文件、JSONL 追加、双写三种模式。
- 写入 payload 符合 `scoring/schema/run-score-schema.json`；复用 `getScoringDataPath()`。
- 与 scoring/core 无循环依赖；writer 仅依赖 constants/path、schema 文件（或类型）。

---

## 2. 模块划分

| 模块 | 路径 | 职责 |
|------|------|------|
| 写入入口 | scoring/writer/index.ts（或 scoring/core/writer.ts） | 对外导出 `writeScoreRecord(record, mode)`，按 mode 分发到单文件/JSONL/双写 |
| 单文件写入 | scoring/writer/single-file.ts | 将单条记录写入 `{dataPath}/{run_id}.json`，覆盖已有文件 |
| JSONL 追加 | scoring/writer/jsonl-append.ts | 向 `{dataPath}/scores.jsonl` 追加一行 JSON，UTF-8 换行 |
| 路径与目录 | 复用 scoring/constants/path.ts | getScoringDataPath()；writer 内封装「不存在则创建目录」逻辑 |

**选型**：writer 放在 `scoring/writer/` 下，与 `scoring/core`、`scoring/constants` 平级，避免 core 依赖 writer 形成循环。

---

## 3. 写入接口设计

### 3.1 写入模式枚举

```ts
export type WriteMode = 'single_file' | 'jsonl' | 'both';
```

- `single_file`：仅写 `{run_id}.json`（覆盖）。
- `jsonl`：仅在 `scores.jsonl` 末尾追加一行。
- `both`：先写单文件，再追加 JSONL。

### 3.2 主接口

```ts
export function writeScoreRecord(
  record: RunScoreRecord,
  mode: WriteMode,
  options?: { dataPath?: string }
): Promise<void>;
```

- `record`：符合 run-score-schema 的对象（TypeScript 类型与 schema 一致，或从 schema 生成）。
- `mode`：上述三种之一。
- `options.dataPath`：可选，不传则使用 `getScoringDataPath()`。便于单测注入临时目录。

### 3.3 RunScoreRecord 类型

与 `scoring/schema/run-score-schema.json` 一致：run_id、scenario、stage、phase_score、phase_weight、check_items、timestamp、iteration_count、iteration_records、first_pass 必填；path_type、model_version、question_version 可选。check_items 每项含 item_id、passed、score_delta、note（可选）。不在此 plan 中重复完整字段表，见 spec §2.1 与 run-score-schema.json。

---

## 4. 单文件写入

- 路径：`getScoringDataPath()/{record.run_id}.json`（若传入 options.dataPath 则用其替代）。
- 行为：将 `record` 序列化为 JSON（格式化，便于人工查看），整文件写入；若文件已存在则覆盖。
- 前置：若目录不存在，先 `fs.mkdirSync(path, { recursive: true })`，再写文件。

---

## 5. JSONL 追加

- 路径：`{dataPath}/scores.jsonl`。
- 行为：将 `record` 序列化为单行 JSON（无换行符），末尾加 `\n`，以 append 方式写入。编码 UTF-8。
- 前置：同上，目录不存在则创建；若 scores.jsonl 不存在则创建新文件再追加。

---

## 6. 双模式分发（仅单文件 / 仅 JSONL / 同时写入）

- 在 `writeScoreRecord` 内根据 `mode` 分支：
  - `single_file`：只调单文件写入。
  - `jsonl`：只调 JSONL 追加。
  - `both`：先调单文件写入，再调 JSONL 追加。
- 目录创建在单文件与 JSONL 内部各做一次（幂等），或抽成共用 `ensureDataDir(dataPath)` 在入口调一次即可。

---

## 7. 与 run-score-schema 的兼容

- 写入前不强制在 writer 内做 schema 校验；caller 保证传入合法 record。验收脚本与单测中可用 AJV 校验写入后的文件内容，满足 AC-7。
- 本方案采用「caller 保证 + 验收脚本校验」以保持 writer 简单。

---

## 8. 目录创建

- 在首次写入前（单文件或 JSONL）调用 `ensureDataDir(dataPath)`：若 `dataPath` 不存在则 `fs.mkdirSync(dataPath, { recursive: true })`。
- 单文件与 JSONL 内部均可调用，或由 `writeScoreRecord` 在分支前统一调用一次。

---

## 9. 文件清单（产出物）

| 文件 | 说明 |
|------|------|
| scoring/writer/index.ts | 导出 writeScoreRecord、WriteMode、ensureDataDir（若导出）；调用 single-file 与 jsonl-append |
| scoring/writer/single-file.ts | 单文件写入实现 |
| scoring/writer/jsonl-append.ts | JSONL 追加实现 |
| scoring/writer/types.ts | RunScoreRecord、WriteMode 等类型（或从 schema 生成） |
| scoring/__tests__/writer/*.test.ts | 单测：单文件覆盖、JSONL 追加行数、三模式、目录创建、同一 run_id 覆盖、schema 校验 |
| scripts/accept-e1-s2.ts | 验收脚本：AC-1～AC-7 |

---

## 10. 与 Story 1.1 的衔接

- 使用 `scoring/schema/run-score-schema.json` 做校验（验收脚本）及类型参考。
- 使用 `getScoringDataPath()` 获取根路径；不重复实现路径解析。
- 单文件同一 run_id 多次写入：覆盖语义，在 index.ts 或 single-file.ts 注释中写明。

---

## 11. 禁止词表

本文未使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。
