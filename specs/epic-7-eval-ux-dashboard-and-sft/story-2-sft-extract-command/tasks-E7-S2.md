# Tasks: SFT 提取 Command（/bmad-sft-extract）(E7-S2)

**Input**：`spec-E7-S2.md`、`plan-E7-S2.md`、`IMPLEMENTATION_GAPS-E7-S2.md`  
**Scope**：Story 7.2 全部（Command、sft-extract 脚本、sft-extractor 增强、测试）  
**执行方式**：按 T1 → T2 → T3 → T4 顺序推进，TDD 红绿灯模式

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 7.2, GAPS | §3.1, GAP-E7-S2-1, 7 | commands/bmad-sft-extract.md；scripts/sft-extract.ts 骨架 |
| T2 | Story 7.2, GAPS | §3.2～§3.7, GAP-E7-S2-2～6 | sft-extractor 增强：阈值、fallback、去重、摘要、has_code_pair |
| T3 | Story 7.2, GAPS | §3.8, AC | 验收命令、.cursor/commands 可选同步 |
| T4 | spec §6, GAPS | GAP-E7-S2-9 | 单元测试、集成 |

---

## 2. Phase 1：Command 文档与脚本骨架（T1）

**AC**：GAP-E7-S2-1, 7；AC-1, AC-2  
**集成验证**：运行脚本可调用 extractSftDataset（含默认参数）

- [x] **T1.1** 新建 `commands/bmad-sft-extract.md`：定义 `/bmad-sft-extract` 触发；无参数运行；支持 `--output`、`--threshold`；验收命令 `npx ts-node scripts/sft-extract.ts`
- [x] **T1.2** 新建 `scripts/sft-extract.ts`：解析 `--output`、`--threshold`；env `SFT_THRESHOLD` fallback；getScoringDataPath()；调用 extractSftDataset(dataPath, outputPath, { threshold })；无 extractSftDataset 选项时先传空对象占位，待 T2 实现

---

## 3. Phase 2：sft-extractor 增强（T2）

**AC**：GAP-E7-S2-2～6；AC-3～AC-6  
**集成验证**：有 phase_score≤60 记录时输出含 has_code_pair、去重、摘要的 JSONL

- [x] **T2.1** 扩展 `SftEntry`：新增 `has_code_pair: boolean`；若去重需 source_path，则新增 `source_path?: string`
- [x] **T2.2** `extractSftDataset(dataPath?, outputPath?, options?: { threshold?: number })`：threshold 默认 60；筛选 `phase_score <= (options?.threshold ?? 60)`；git diff 失败时 fallback：push `{ instruction, input: '', output: '', has_code_pair: false, source_run_id, base_commit_hash, source_path? }`，不 skip
- [x] **T2.3** 去重：写入前按 `source_run_id|base_commit_hash|source_path` 去重，保留首次
- [x] **T2.4** 输出摘要：计算 N（写入条数）、M（唯一 Story 数，parseEpicStoryFromRecord 或 source_path 解析）、K（skip 数及原因）；返回 `{ entries, summary: { n, m, k, skipReasons } }` 或等价；脚本 stdout 输出「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」
- [x] **T2.5** JSONL 写入：每行含 instruction、input、output、source_run_id、base_commit_hash、has_code_pair（及可选 source_path）

---

## 4. Phase 3：验收命令与同步（T3）

**AC**：GAP-E7-S2-8  
**集成验证**：验收命令可执行且输出符合 AC

- [x] **T3.1** 验收命令：`npx ts-node scripts/sft-extract.ts`；有数据时输出 sft-dataset.jsonl、摘要正确；无数据时摘要「共提取 0 条...」；`--output /path` 时写入指定路径；`--threshold 50` 或 SFT_THRESHOLD=50 生效
- [x] **T3.2** 若存在 `.cursor/commands/` 目录，同步 `commands/bmad-sft-extract.md` 到 `.cursor/commands/bmad-sft-extract.md`

---

## 5. Phase 4：测试与回归（T4）

**AC**：GAP-E7-S2-9  
**集成验证**：单测通过；sft-extract 验收命令符合 AC

- [x] **T4.1** 新增或扩展 `scoring/analytics/__tests__/sft-extractor.test.ts`：fallback（git diff 失败时 has_code_pair: false）、去重（重复键仅一条）、摘要计算、阈值筛选、has_code_pair 判定
- [x] **T4.2** 集成：`npx ts-node scripts/sft-extract.ts` 在有数据/无数据/部分 git diff 失败时输出符合 AC；`npm test -- scoring/analytics` 通过（若项目有此脚本）

---

## 6. 验收命令汇总

| 命令 | 覆盖 |
|------|------|
| `npx ts-node scripts/sft-extract.ts` | T1, T2, T3, AC-1 |
| `npx ts-node scripts/sft-extract.ts --threshold 50` | AC-2 |
| `SFT_THRESHOLD=50 npx ts-node scripts/sft-extract.ts` | AC-2 |
| `npx ts-node scripts/sft-extract.ts --output /path/to/out.jsonl` | 输出路径 |
| git diff 失败 fixture | AC-3 |
| 重复 key fixture | AC-5 |
| `npm test -- scoring/analytics` | T4 |

---

## 7. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1 | GAP-E7-S2-1, 7 | ✓ 有 | T1.1, T1.2 |
| Story §3.2～§3.7 | GAP-E7-S2-2～6 | ✓ 有 | T2.1～T2.5 |
| AC | GAP-E7-S2-8 | ✓ 有 | T3 |
| spec §6 | GAP-E7-S2-9 | ✓ 有 | T4 |

---

## 8. 完成判定标准

- T1～T4 全部任务完成并勾选。
- AC-1～AC-6 均有可追溯任务与验收命令结果。
- sft-extract 可执行且输出 JSONL 与摘要符合 AC。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。
