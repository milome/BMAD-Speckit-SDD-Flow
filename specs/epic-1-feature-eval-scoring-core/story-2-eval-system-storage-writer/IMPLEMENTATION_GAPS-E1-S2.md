# IMPLEMENTATION_GAPS-E1-S2：eval-system-storage-writer

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.2  
**输入**：plan-E1-S2.md、当前代码库 scoring/

---

## 1. 现状摘要

- **已有**：scoring/core（calculator、index）、scoring/constants（path.ts、weights、table-a、table-b）、scoring/schema/run-score-schema.json、scoring/__tests__（calculator、path、schema 等）。无 writer 相关代码。
- **路径**：getScoringDataPath() 已实现；scoring/data/ 存在且含 sample-run.json、sample-composite.json。

---

## 2. 差距列表

| Gap ID | 描述 | plan 对应 | 优先级 |
|--------|------|-----------|--------|
| G1 | writer 模块缺失：无 scoring/writer/ 目录及写入入口 | plan §2、§3 | P0 |
| G2 | 单文件写入未实现：无 single-file.ts，无法写 {run_id}.json | plan §4 | P0 |
| G3 | JSONL 追加未实现：无 jsonl-append.ts，无法追加 scores.jsonl | plan §5 | P0 |
| G4 | 写入模式与分发未实现：无 WriteMode、writeScoreRecord 分支逻辑 | plan §3、§6 | P0 |
| G5 | RunScoreRecord 类型未在 writer 侧使用：需 types.ts 或从 schema 对齐 | plan §3.3 | P1 |
| G6 | 目录创建逻辑未实现：ensureDataDir 或等价逻辑缺失 | plan §8 | P0 |
| G7 | writer 单测缺失：无 scoring/__tests__/writer/*.test.ts | plan §9 | P0 |
| G8 | Story 1.2 验收脚本缺失：无 scripts/accept-e1-s2.ts，AC-1～AC-7 未自动化验证 | plan §9、Story §6 | P0 |

---

## 3. 与 plan 的对应关系

- **G1–G4、G6**：实现 scoring/writer（index、single-file、jsonl-append、types）及目录创建。
- **G5**：types.ts 中定义或引用与 run-score-schema 一致的 RunScoreRecord。
- **G7**：单测覆盖单文件覆盖、JSONL 行数递增、三模式、目录创建、同一 run_id 覆盖、schema 校验。
- **G8**：accept-e1-s2.ts 覆盖 AC-1～AC-7：单文件写入、JSONL 追加、三模式、check_items 结构、目录创建、同一 run_id 行为、schema 校验。

---

## 4. 非差距（无需本 Story 实现）

- 评分规则 YAML 解析、审计报告解析、run-score-schema.json 与 path.ts 已存在；writer 仅消费 schema 与 path。

---

## 5. 闭合条件

- scoring/writer/ 下实现 index、single-file、jsonl-append、types；writeScoreRecord(record, mode) 可调；目录自动创建；单测与 accept-e1-s2.ts 通过。
