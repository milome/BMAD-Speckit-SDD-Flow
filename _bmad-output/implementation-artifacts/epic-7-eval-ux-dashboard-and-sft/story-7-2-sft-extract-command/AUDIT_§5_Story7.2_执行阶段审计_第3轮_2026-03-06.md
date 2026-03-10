# Story 7.2 实施后 §5 执行阶段审计（第 3 轮）

**审计日期**：2026-03-06  
**审计类型**：audit-prompts §5 执行阶段审计  
**被审对象**：
- 实施依据：`story-7-2-sft-extract-command/7-2-sft-extract-command.md`
- 任务文档：`specs/epic-7-eval-ux-dashboard-and-sft/story-2-sft-extract-command/tasks-E7-S2.md`
- 实施产物：`commands/bmad-sft-extract.md`、`scripts/sft-extract.ts`、`scoring/analytics/sft-extractor.ts`  
**验收命令**：`npx ts-node scripts/sft-extract.ts`  
**前提**：第 1、2 轮审计均为「本轮无新 gap」

---

## 一、§5 六项逐项复核

### §5.1 实现是否完全覆盖 Story、plan、GAPS、tasks（无预留/占位/假完成）

| 需求/任务 | 实现位置 | 验证 |
|-----------|----------|------|
| AC-1 无参数运行 | sft-extract.ts main()；extractSftDataset 默认输出 | ✓ |
| AC-2 阈值可配置 | getThreshold(args)；env SFT_THRESHOLD；CLI --threshold | ✓ |
| AC-3 git diff 失败 fallback | sft-extractor.ts 237–253 行 instruction-only + has_code_pair: false | ✓ |
| AC-4 输出摘要 | formatSummary；「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」 | ✓ |
| AC-5 去重 | dedupeEntries(source_run_id\|base_commit_hash\|source_path) | ✓ |
| AC-6 JSONL 格式 | 每行含 instruction、input、output、has_code_pair | ✓ |
| T1.1–T1.2 Command/CLI | commands/bmad-sft-extract.md、scripts/sft-extract.ts | ✓ |
| T2.1–T2.5 核心增强 | has_code_pair、threshold、fallback、dedupeEntries、formatSummary | ✓ |
| T3.1–T3.2 验收与同步 | 验收命令可执行；.cursor/commands 已同步 | ✓ |
| T4.1–T4.2 单测与集成 | sft-extractor.test.ts 10 用例；npm test scoring/analytics 23 通过 | ✓ |

**§5.1 结论**：✅ 完全覆盖，无占位、无假完成。

---

### §5.2 是否已执行集成/端到端测试

| 测试类型 | 命令/覆盖 | 本次执行结果 |
|----------|-----------|--------------|
| 单测 | sft-extractor.test.ts 10 用例（fallback、去重、阈值、formatSummary 等） | `npm test -- scoring/analytics` → 23 tests passed（含 10 个 sft-extractor） |
| 端到端 | npx ts-node scripts/sft-extract.ts | 退出码 0；输出「共提取 0 条，覆盖 0 个 Story；跳过 1 条（原因：无 source_path: 1）」 |
| --threshold | npx ts-node scripts/sft-extract.ts --threshold 50 | 退出码 0；阈值生效 |
| --output | npx ts-node scripts/sft-extract.ts --output scoring/data/sft-test-out.jsonl | 退出码 0 |

**§5.2 结论**：✅ 集成与端到端测试已执行，验收通过。

---

### §5.3 关键路径是否完整（无孤岛模块）

**关键路径**：`/bmad-sft-extract` → `commands/bmad-sft-extract.md` → `scripts/sft-extract.ts` → `scoring/analytics/sft-extractor.ts`

| 环节 | 验证 |
|------|------|
| Command → CLI | bmad-sft-extract.md 指定 npx ts-node scripts/sft-extract.ts | ✓ |
| 脚本 → 核心 | sft-extract.ts 第 56 行 extractSftDataset(dataPath, outputPath, { threshold }) | ✓ |
| 数据路径 | getScoringDataPath() 传入 extractSftDataset | ✓ |
| 输出 | formatSummary(summary) 由 sft-extractor 导出并在脚本中调用 | ✓ |

**§5.3 结论**：✅ 关键路径完整，无孤岛模块。

---

### §5.4 prd/progress 是否已维护，TDD 记录是否完整

| 产出 | 路径 | 状态 |
|------|------|------|
| prd | prd.tasks-E7-S2.json | ✅ US-001～004 均 passes: true |
| progress | progress.tasks-E7-S2.txt | ✅ T1～T4 已勾选；验收命令、产出物清单已列 |

**TDD 标记**：第 1 轮已记录为 tasks 规范符合性项，非 §5 阻断。本 Story 涉及生产代码的 US 其单测与集成均已覆盖，progress 含验收命令与完成状态。

**§5.4 结论**：✅ 符合 ralph-method。

---

### §5.5 验收命令执行结果

| 验收命令 | 本次审计执行 | 退出码 |
|----------|--------------|--------|
| npx ts-node scripts/sft-extract.ts | 已执行 | 0 |
| 输出格式 | 「共提取 0 条，覆盖 0 个 Story；跳过 1 条（原因：无 source_path: 1）」 | 符合 AC-4 |
| npm test -- scoring/analytics | 已执行 | 23 tests passed |

**§5.5 结论**：✅ 验收命令已执行并通过。

---

### §5.6 是否无延迟表述、无标记完成但未调用

| 检查项 | 结果 |
|--------|------|
| sft-extractor.ts、sft-extract.ts | 无「将在后续」「TODO」「FIXME」「占位」 |
| Story §7 推迟闭环 | 「Story 7.3 依赖本 Story」—— 为范围界定，非实现延迟 |
| extractSftDataset、formatSummary | 均在脚本中真实调用 |

**§5.6 结论**：✅ 无不当延迟表述，无标记完成但未调用。

---

**§5 (5)～(8) scoring 相关项**：本 Story 不涉及 parseAndWriteScore、scoring_write_control、branch_id、question_version、resultCode 等，**N/A**。

---

## 二、批判审计员对抗检查

### 2.1 遗漏检查

1. **默认输出路径**：未指定 --output 时，extractSftDataset 使用 basePath/sft-dataset.jsonl，basePath 来自 getScoringDataPath()（scoring/data）。与 Story §3.1 一致。**无遗漏**。
2. **空数据集**：deduped 为空时不写文件；摘要仍输出到 stdout，符合 AC-4。**无遗漏**。
3. **SFT_THRESHOLD Windows**：第 1 轮建议补充 env 验收记录；属可选增强，非阻断。**维持可接受**。

### 2.2 路径失效检查

4. **sft-extract.ts 导入**：getScoringDataPath、extractSftDataset、formatSummary 路径正确。**无路径失效**。
5. **parseEpicStoryFromRecord**：sft-extractor 用于 countUniqueStories 计算 M；scoring/query 已实现并导出。**无路径失效**。

### 2.3 验收未跑检查

6. **T3.1 验收命令**：本次审计独立重跑 npx ts-node scripts/sft-extract.ts，退出码 0，输出符合 AC-4。**验收已跑**。
7. **T4.2 集成**：npm test -- scoring/analytics 已执行，23 测试通过。**验收已跑**。

### 2.4 回归与退化检查

8. **第 1、2 轮已识别项**：SFT_THRESHOLD Windows 验证、TDD 标记记录——均为可选增强，第 1 轮已判定不改变通过结论。**无退化**。
9. **实现完整性**：extractSftDataset、dedupeEntries、formatSummary、git diff fallback 等逻辑与第 1 轮审计一致，无回退或破坏。**无退化**。

---

## 三、批判审计员结论

**对抗性检查结果**：遗漏、路径失效、验收未跑、回归退化四类检查均未发现新问题。第 1、2 轮已识别的可选增强项（SFT_THRESHOLD Windows、TDD 标记）维持为可接受，不构成 §5 未通过条件。

**批判审计员裁定**：**本轮无新 gap**。

---

## 四、审计结论

### 4.1 总体结论

**「完全覆盖、验证通过」**

### 4.2 轮次说明

**本轮无新 gap，第 3 轮；连续 3 轮无 gap，收敛。**

### 4.3 六项汇总

| §5 审计项 | 判定 |
|-----------|------|
| §5.1 实现覆盖 Story/plan/GAPS/tasks | ✅ |
| §5.2 集成/端到端测试已执行 | ✅ |
| §5.3 关键路径完整、无孤岛 | ✅ |
| §5.4 prd/progress 已维护 | ✅ |
| §5.5 验收命令已执行 | ✅ |
| §5.6 无延迟表述、无假完成 | ✅ |

Story 7.2（SFT 提取 Command）实施结果满足 audit-prompts §5 执行阶段审计全部要求。验收命令 `npx ts-node scripts/sft-extract.ts` 本次审计独立重跑并通过。**第 3 轮审计通过，连续 3 轮无 gap，正式收敛。**
