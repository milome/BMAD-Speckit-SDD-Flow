# tasks-E1-S2：eval-system-storage-writer 任务列表

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.2  
**输入**：IMPLEMENTATION_GAPS-E1-S2.md、plan-E1-S2.md

---

## 任务与 Story §6、AC 对应

| Task ID | 描述 | 产出 | 验收方式 | Story §6 | AC |
|---------|------|------|----------|----------|-----|
| T1 | 定义 WriteMode 类型与 RunScoreRecord 类型；实现写入接口 writeScoreRecordSync(record, mode)，入参校验（schema）后按 mode 分发 | scoring/writer 类型与主接口 | 单测：合法 record + 各 mode 调用不抛错；非法 record 抛错或拒写 | T1 | AC-3, AC-7 |
| T2 | 实现单文件写入：ensureDataDir() + 写 getScoringDataPath()/{run_id}.json，覆盖语义 | 单文件写入逻辑 | 单测：写入后文件存在、内容为 record JSON；同 run_id 再次写入则覆盖 | T2 | AC-1, AC-5, AC-6 |
| T3 | 实现 JSONL 追加：向 getScoringDataPath()/scores.jsonl 追加一行 JSON + \n | JSONL 追加逻辑 | 单测：多次追加后行数递增，每行可 JSON.parse | T3 | AC-2 |
| T4 | 实现双模式分发：mode single_file → 仅单文件；jsonl → 仅 JSONL；both → 先单文件再 JSONL | 分支逻辑（可合并在 T1） | 单测：三种 mode 仅目标文件被创建/更新 | T4 | AC-3 |
| T5 | 保证 check_items 序列化与 §8.2 一致；写入前创建 scoring/data（ensureDataDir） | 目录创建 + check_items 不篡改 | 单测：无 data 目录时写入成功且目录与文件存在；check_items 原样写入 | T5 | AC-4, AC-5 |
| T6 | 编写 Story 1.2 验收脚本 scripts/accept-e1-s2.ts，覆盖 AC-1～AC-7 | accept-e1-s2.ts | 运行脚本全部通过；AC-1 单文件内容一致；AC-2 行数递增；AC-3 三模式；AC-4 check_items 结构；AC-5 目录创建；AC-6 覆盖语义；AC-7 schema 校验 | T6 | AC-1～AC-7 |

---

## 实施顺序（TDD 红绿灯）

1. **T1** [TDD-RED] 写测试：writeScoreRecordSync 存在、接受合法 record + 各 mode；非法 record 拒写。 [TDD-GREEN] 实现类型、schema 校验、接口骨架与分发。
2. **T2** [TDD-RED] 写测试：单文件写入、同 run_id 覆盖。 [TDD-GREEN] 实现 ensureDataDir、单文件写入。
3. **T3** [TDD-RED] 写测试：JSONL 追加、行数递增、每行合法。 [TDD-GREEN] 实现 JSONL append。
4. **T4** [TDD-GREEN] 在 T1 分发中区分三种 mode，补测仅目标文件更新。
5. **T5** [TDD-RED] 写测试：无 data 目录时创建；check_items 原样。 [TDD-GREEN] 已由 T2 ensureDataDir 与序列化保证，补测即可。
6. **T6** 编写 accept-e1-s2.ts，覆盖 AC-1～AC-7；运行通过。

---

## 验收命令

- 单测：`npm test -- --run scoring/__tests__/writer` 或等价路径。
- 验收脚本：`npx ts-node scripts/accept-e1-s2.ts` 或 `npm run accept:e1-s2`（若已配置）。

---

## 依赖与约束

- 复用 getScoringDataPath()、run-score-schema.json。
- 写入 payload 符合 run-score-schema；与 scoring/core 无循环依赖。
- 单文件同一 run_id 为覆盖；check_items 为数组，项含 item_id、passed、score_delta、note（可选）。
