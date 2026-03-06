# IMPLEMENTATION_GAPS-E7-S2：SFT 提取 Command 实现差距

**Epic**：E7 eval-ux-dashboard-and-sft  
**Story ID**：7.2  
**分析基准**：plan-E7-S2.md、spec-E7-S2.md、Story 7.2、scoring/analytics/sft-extractor.ts 当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §3.1(1), REQ-UX-4.1 | GAP-E7-S2-1 | 新建 commands/bmad-sft-extract.md；/bmad-sft-extract 触发；无参运行 | 未实现 | commands/bmad-sft-extract.md 不存在 |
| Story §3.1(2), REQ-UX-4.2 | GAP-E7-S2-2 | 阈值可配置：env SFT_THRESHOLD、CLI --threshold；默认 60 | 未实现 | sft-extractor 硬编码 60，无参数 |
| Story §3.4, REQ-UX-4.3 | GAP-E7-S2-3 | git diff 失败 fallback 为 instruction-only；has_code_pair: false | 部分实现 | 当前 git diff 失败时 skip，无 fallback |
| Story §3.6, REQ-UX-4.4 | GAP-E7-S2-4 | 输出摘要：共 N 条、覆盖 M Story、跳过 K 条（原因） | 未实现 | 无摘要输出 |
| Story §3.5, REQ-UX-4.5 | GAP-E7-S2-5 | 去重：source_run_id+base_commit_hash+source_path | 未实现 | 无去重逻辑 |
| Story §3.7, REQ-UX-4.6 | GAP-E7-S2-6 | SftEntry 含 has_code_pair；JSONL 每行含该字段 | 未实现 | SftEntry 无 has_code_pair |
| Story §3.5 | GAP-E7-S2-7 | CLI 脚本 scripts/sft-extract.ts；--output、--threshold | 未实现 | scripts/sft-extract.ts 不存在 |
| AC-1～AC-6 | GAP-E7-S2-8 | 验收：无参运行、阈值、fallback、摘要、去重、JSONL | 未实现 | 依赖 GAP-1～7 |
| spec §6, plan §6 | GAP-E7-S2-9 | 单元测试、集成/E2E | 未实现 | 无 sft-extractor 增强相关测试 |

---

## 2. Gaps → 任务映射（按章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1 | GAP-E7-S2-1, 7 | ✓ 有 | T1.1, T1.2 |
| Story §3.2～§3.4 | GAP-E7-S2-2, 3 | ✓ 有 | T2.1, T2.2 |
| Story §3.5～§3.7 | GAP-E7-S2-4, 5, 6 | ✓ 有 | T2.3, T2.4, T2.5 |
| AC | GAP-E7-S2-8 | ✓ 有 | T3 |
| spec §6 | GAP-E7-S2-9 | ✓ 有 | T4 |

---

## 3. 四类汇总

| 类别 | Gap ID | 说明 | 对应任务 |
|------|--------|------|----------|
| Command/脚本 | GAP-E7-S2-1, 7 | bmad-sft-extract.md、sft-extract.ts | T1.1, T1.2 |
| 核心增强 | GAP-E7-S2-2～6 | 阈值、fallback、去重、摘要、has_code_pair | T2.1～T2.5 |
| 验收 | GAP-E7-S2-8 | 验收命令、同步 .cursor/commands | T3 |
| 测试 | GAP-E7-S2-9 | 单测、集成 | T4 |

---

## 4. 当前实现快照

| 模块 | 路径 | 状态 |
|------|------|------|
| Command | commands/bmad-sft-extract.md | ❌ 不存在 |
| 脚本 | scripts/sft-extract.ts | ❌ 不存在 |
| 核心模块 | scoring/analytics/sft-extractor.ts | ✅ 存在；含 SftEntry、extractSftDataset、phase_score≤60；缺 has_code_pair、fallback、去重、摘要、阈值参数 |
| 输出 | scoring/data/sft-dataset.jsonl | ✅ 由 extractSftDataset 写入 |
| getScoringDataPath | scoring/constants/path.ts | ✅ 已实现 |
| parseEpicStoryFromRecord | scoring/query | ✅ 已实现；用于摘要 M 计算 |
