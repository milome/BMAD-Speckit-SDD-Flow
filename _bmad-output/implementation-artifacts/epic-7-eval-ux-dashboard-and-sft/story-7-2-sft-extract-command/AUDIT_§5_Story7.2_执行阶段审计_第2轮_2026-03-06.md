# §5 执行阶段审计：Story 7.2 SFT 提取 Command（第 2 轮）

**审计日期**：2026-03-06  
**审计轮次**：第 2 轮（第 1 轮结论「本轮无新 gap」）  
**被审对象**：
- commands/bmad-sft-extract.md
- scripts/sft-extract.ts
- scoring/analytics/sft-extractor.ts
- prd.tasks-E7-S2.json
- progress.tasks-E7-S2.txt
- specs/epic-7-eval-ux-dashboard-and-sft/story-2-sft-extract-command/tasks-E7-S2.md

**审计依据**：audit-prompts.md §5 执行阶段审计、六项复核、批判审计员 >50% 占比

---

## 1. §5 六项复核（复验）

### 1.1 任务是否真正实现（无预留/占位/假完成）

| 任务 | 本轮核查 | 结果 |
|------|----------|------|
| T1.1 commands/bmad-sft-extract.md | 文件存在；含验收命令、--threshold/--output 说明；与 .cursor/commands 同步 | ✅ |
| T1.2 scripts/sft-extract.ts | 解析 --output、--threshold（含 `--key=val` 形式）；getScoringDataPath()；调用 extractSftDataset(..., { threshold }) | ✅ |
| T2.1～T2.5 | SftEntry 含 has_code_pair、source_path?；threshold 入参；git diff 失败 fallback；dedupeEntries；formatSummary；JSONL 含 instruction/input/output/has_code_pair | ✅ |
| T3.1、T3.2 | 验收命令已执行；.cursor/commands/bmad-sft-extract.md 存在且与 commands/ 一致 | ✅ |
| T4.1、T4.2 | sft-extractor.test.ts 10 用例；npm test -- scoring/analytics 23 通过 | ✅ |

**结论**：无占位、无假完成，任务均为真实实现。

---

### 1.2 生产代码是否在关键路径

| 环节 | 核查 |
|------|------|
| Command → CLI | bmad-sft-extract.md 指定 npx ts-node scripts/sft-extract.ts |
| 脚本 → 核心 | sft-extract.ts 第 56 行 extractSftDataset(dataPath, outputPath, { threshold }) |
| 数据路径 | getScoringDataPath() 传入 |
| 输出 | formatSummary(summary) 由 sft-extractor 导出并调用 |

**结论**：关键路径完整，无短路或旁路。

---

### 1.3 需实现的 Gap 是否均有实现与测试覆盖

| GAP/AC | 实现 | 测试/验收 |
|--------|------|-----------|
| GAP-E7-S2-1,7 / AC-1 | sft-extract.ts main()；extractSftDataset 默认输出 | 验收命令通过 |
| GAP-E7-S2-2～6 / AC-2～6 | threshold、fallback、去重、摘要、JSONL | T2-4～T2-10；验收命令 |
| GAP-E7-S2-8 / T3 | 验收命令、.cursor 同步 | 已执行 |
| GAP-E7-S2-9 / T4 | 单测 10 用例、集成 | npm test 通过 |

**结论**：AC-1～AC-6、GAP 均有对应实现与测试/验收覆盖。

---

### 1.4 验收表是否已按实际运行结果填写

| 验收命令 | 本次审计执行结果 |
|----------|------------------|
| npx ts-node scripts/sft-extract.ts | 退出码 0；输出「共提取 0 条，覆盖 0 个 Story；跳过 1 条（原因：无 source_path: 1）」 |
| npx ts-node scripts/sft-extract.ts --threshold 50 | 退出码 0；阈值生效 |
| npx ts-node scripts/sft-extract.ts --output scoring/data/sft-test-out.jsonl | 退出码 0 |
| npm test -- scoring/analytics | 23 tests passed（4 files，含 10 个 sft-extractor） |

progress.tasks-E7-S2.txt 已记录 T1～T4 完成、验收命令、产出物清单；prd.tasks-E7-S2.json 全部 US passes: true。

**结论**：验收已执行；progress/prd 已正确填写。

---

### 1.5 是否遵守 15 条铁律（架构忠实、禁止伪实现、测试与回归）

| 检查项 | 结果 |
|--------|------|
| 架构忠实 | sft-extract 仅封装调用，复用 scoring/analytics/sft-extractor；无架构偏离 |
| 禁止伪实现 | 无 mock-only、无占位 return、无 TODO 实现 |
| 测试与回归 | 10 单测覆盖 fallback、去重、阈值、formatSummary；npm test 全量通过 |
| prd/progress | 存在且一致，符合 ralph-method |

**结论**：遵守铁律。

---

### 1.6 是否无「将在后续迭代」等延迟表述

| 检查项 | 结果 |
|--------|------|
| sft-extractor.ts、sft-extract.ts、bmad-sft-extract.md | 无「后续」「TODO」「FIXME」「占位」 |
| Story §7 推迟闭环 | 明确归属 Story 7.3，为范围界定非实现延迟 |
| 标记完成但未调用 | extractSftDataset、formatSummary 均在脚本中真实调用 |

**结论**：无不当延迟表述。

---

## 2. 批判审计员对抗检查（第 2 轮，占比 >50%）

### 2.1 第 1 轮已识别项的复验

| 第 1 轮项 | 本轮裁定 | 说明 |
|-----------|----------|------|
| SFT_THRESHOLD Windows 验证 | 维持可接受 | 非阻断；progress 可后续补充 |
| TDD 标记缺失 | 维持可接受 | tasks §8 合规性，非 §5 阻断 |
| 空数据集不写文件 | 维持可接受 | 摘要仍输出，AC-4 满足 |

### 2.2 本轮新增对抗检查

**（1）parseArgs 对 `--output=path` 形式**

sft-extract.ts parseArgs 含 `arg.includes('=')` 分支：`args[arg.slice(2, idx)] = arg.slice(idx + 1)`。故 `--output=scoring/data/out.jsonl` 可正确解析。**无 gap**。

**（2）相对路径 output 解析**

脚本中 `path.isAbsolute(output) ? output : path.resolve(process.cwd(), output)`，相对路径按 cwd 解析。**无 gap**。

**（3）threshold=0 边界**

getThreshold 允许 `n >= 0`。phase_score≤0 的记录极少，逻辑正确。**无 gap**。

**（4）dedupeEntries 键构造**

`${e.source_run_id}|${e.base_commit_hash}|${e.source_path ?? ''}`，source_path 缺省时用空串，多记录不会误合并。**无 gap**。

**（5）commands 与 .cursor/commands 一致性**

两处 bmad-sft-extract.md 内容一致（含 frontmatter、触发方式、参数、验收命令）。T3.2「若存在 .cursor/commands/ 目录，同步」已满足。**无 gap**。

**（6）extractSftDataset 默认输出路径**

outputPath 为 undefined 时使用 `path.join(basePath, 'sft-dataset.jsonl')`，basePath 来自 dataPath 或 `scoring/data`。与 Story §3.1 一致。**无 gap**。

**（7）loadRecordsFromDataPath 与 scores.jsonl**

目录中逐个 .json 加载，且单独读取 scores.jsonl，排除 `e.name === 'scores.jsonl'` 避免重复。**无 gap**。

**（8）countUniqueStories 与 parseEpicStoryFromRecord 返回 null**

无法解析的 record 不计入 M，M≤N 可接受。**无 gap**。

**（9）验收命令独立性**

本轮独立执行四条验收命令，均退出码 0、输出符合 AC。**验证有效**。

**（10）prd US 与 tasks 对应**

prd US-001～004 对应 T1～T4，passes 与 progress 勾选一致。**无 gap**。

### 2.3 批判审计员第 2 轮结论

经六项复核与 10 项对抗检查，**未发现第 1 轮未覆盖的新 gap**。实施物与 tasks、Story、plan、GAPS 一致，验收命令已在本轮独立重跑并通过，prd/progress 符合 ralph-method。

---

## 3. 审计结论

### 3.1 总体结论

**「完全覆盖、验证通过」**

### 3.2 轮次说明

**本轮无新 gap，第 2 轮。**

### 3.3 后续建议

1. 累计至 **3 轮无 gap** 后可正式收敛。
2. 可选：progress 中补充 SFT_THRESHOLD 在 Windows 下的验收记录。
3. 可选：按 tasks §8 为 T1～T4 补充 TDD 标记记录。

---

*本报告由批判审计员按 audit-prompts §5 执行阶段审计编制，批判审计员结论占比 >50%。*
