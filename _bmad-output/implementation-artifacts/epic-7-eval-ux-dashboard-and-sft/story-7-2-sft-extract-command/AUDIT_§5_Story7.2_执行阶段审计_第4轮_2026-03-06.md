# §5 执行阶段审计：Story 7.2 SFT 提取 Command（第 4 轮）

**审计日期**：2026-03-06  
**审计轮次**：第 4 轮（本轮按 audit-prompts §5 完整要求执行，含 TDD 三项强制检查）  
**被审对象**：
- 实施依据：story-7-2-sft-extract-command/7-2-sft-extract-command.md
- 任务文档：specs/epic-7-eval-ux-dashboard-and-sft/story-2-sft-extract-command/tasks-E7-S2.md
- 实施产物：commands/bmad-sft-extract.md、scripts/sft-extract.ts、scoring/analytics/sft-extractor.ts
- 追踪文件：prd.tasks-E7-S2.json、progress.tasks-E7-S2.txt

**审计依据**：audit-prompts.md §5 执行阶段审计（含第 (4) 项 ralph-method + TDD 三项强制检查）、批判审计员 >50%

---

## 1. §5 六项复核

### 1.1 任务是否真正实现（无预留/占位/假完成）

| 任务 | 核查 | 结果 |
|------|------|------|
| T1.1 commands/bmad-sft-extract.md | 存在；含验收命令、--threshold/--output | ✅ |
| T1.2 scripts/sft-extract.ts | 解析参数、getScoringDataPath、调用 extractSftDataset | ✅ |
| T2.1～T2.5 | SftEntry 含 has_code_pair、source_path?；threshold、fallback、dedupe、formatSummary、JSONL | ✅ |
| T3.1、T3.2 | 验收命令可执行；.cursor/commands 同步 | ✅ |
| T4.1、T4.2 | sft-extractor.test.ts 10 用例；npm test 23 passed | ✅ |

**结论**：无占位、无假完成。

---

### 1.2 生产代码是否在关键路径

| 环节 | 核查 |
|------|------|
| Command → CLI | bmad-sft-extract.md 指定 npx ts-node scripts/sft-extract.ts |
| 脚本 → 核心 | sft-extract.ts 调用 extractSftDataset(dataPath, outputPath, { threshold }) |
| 输出 | formatSummary 由 sft-extractor 导出并调用 |

**结论**：关键路径完整。

---

### 1.3 需实现的项是否有实现与测试/验收覆盖

| GAP/AC | 实现 | 测试/验收 |
|--------|------|----------|
| GAP-E7-S2-1,7 / AC-1 | sft-extract.ts main()；extractSftDataset 默认输出 | 验收通过 |
| GAP-E7-S2-2～6 / AC-2～6 | threshold、fallback、去重、摘要、JSONL | 10 单测 + 验收 |
| GAP-E7-S2-8 / T3 | 验收命令、.cursor 同步 | 已执行 |
| GAP-E7-S2-9 / T4 | 单测 10 用例、集成 | npm test 23 passed |

**结论**：AC、GAP 均有实现与覆盖。

---

### 1.4 验收表/验收命令是否已执行并填写

| 验收命令 | 本轮执行结果 |
|----------|--------------|
| npx ts-node scripts/sft-extract.ts | 退出码 0；输出「共提取 0 条，覆盖 0 个 Story；跳过 1 条（原因：无 source_path: 1）」 |
| npm test -- scoring/analytics | 23 tests passed（4 files，含 10 个 sft-extractor） |

progress.tasks-E7-S2.txt 记录 T1～T4 完成、验收命令、产出物；prd 全部 US passes: true。

**结论**：验收已执行并填写。

---

### 1.5 是否遵守 ralph-method（prd/progress + TDD 三项）【重点】

audit-prompts §5 第 (4) 项要求：

> 是否已创建并维护 ralph-method 追踪文件（prd.json、progress.txt），且每完成一个 US 有对应更新（prd 中 passes=true、progress 中带时间戳的 story log，**且涉及生产代码的每个 US 须在其对应段落内各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少一行**（审计须逐 US 检查；[TDD-REFACTOR] 允许写"无需重构 ✓"，但禁止省略）；**若未创建或未按 US 更新，必须作为未通过项列出**。

#### 1.5.1 prd.tasks-E7-S2.json

- 存在 ✅
- US-001～US-004 均为 passes: true ✅

#### 1.5.2 progress.tasks-E7-S2.txt

- 存在 ✅
- 含完成状态清单、验收命令、产出物表 ✅
- **逐 US 检查 TDD 三项**：

| US | 涉及生产代码 | [TDD-RED] | [TDD-GREEN] | [TDD-REFACTOR] |
|----|-------------|-----------|-------------|----------------|
| US-001 | 是（T1.2 scripts/sft-extract.ts） | ❌ 无 | ❌ 无 | ❌ 无 |
| US-002 | 是（T2.1～T2.5 sft-extractor.ts） | ❌ 无 | ❌ 无 | ❌ 无 |
| US-003 | 否（验收与同步） | — | — | — |
| US-004 | 是（T4.1 sft-extractor.test.ts） | ❌ 无 | ❌ 无 | ❌ 无 |

**grep 验证**：`grep -E "TDD-RED|TDD-GREEN|TDD-REFACTOR" progress.tasks-E7-S2.txt` → 无匹配。

**结论**：progress 完全缺少 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录。按 audit-prompts §5 (4)，**必须作为未通过项列出**。

---

### 1.6 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

- 代码与文档中无「后续」「TODO」「占位」等 ✅
- extractSftDataset、formatSummary 均在脚本中真实调用 ✅

**结论**：无不当延迟表述，无假完成。

---

## 2. 批判审计员结论（占比 >50%）

### 2.1 对 TDD 三项缺失的裁定

此前第 1～3 轮审计将「TDD 标记缺失」判为「可接受」「tasks §8 合规性，非 §5 阻断」。该裁定**与 audit-prompts §5 第 (4) 项明文要求相悖**。

audit-prompts §5 (4) 明确规定：

- 涉及生产代码的**每个 US** 须在其对应段落内各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少一行
- **若未创建或未按 US 更新，必须作为未通过项列出**

因此，不得以「tasks 规范」「可选」「可后续补充」等理由豁免 TDD 三项检查。涉及生产代码的 US-001、US-002、US-004 均缺 TDD 三项，**必须判为未通过**。

### 2.2 对抗性检查（10 项）

| # | 检查项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 任务假完成 | 无 | 实施为真实代码 |
| 2 | 关键路径失效 | 无 | sft-extract → sft-extractor 调用完整 |
| 3 | 孤岛模块 | 无 | 模块均在关键路径 |
| 4 | 验收未跑 | 无 | 本轮重跑验收通过 |
| 5 | prd/progress 缺失 | 无 | 文件存在 |
| 6 | **TDD 三项缺失** | **有** | progress 无 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] |
| 7 | 延迟表述 | 无 | 无「后续」「TODO」等 |
| 8 | 标记完成但未调用 | 无 | 功能均已调用 |
| 9 | 测试覆盖率 | 通过 | 10 单测 + 集成 |
| 10 | 回归退化 | 无 | npm test 23 passed |

### 2.3 批判审计员综合结论

**本轮存在 1 个 gap：GAP-TDD**。

- **GAP-TDD**：progress.tasks-E7-S2.txt 中涉及生产代码的 US-001、US-002、US-004 均缺少 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录，违反 audit-prompts §5 第 (4) 项。
- 修复要求：在 progress 中为 US-001、US-002、US-004 各补充至少一行 [TDD-RED]、一行 [TDD-GREEN]、一行 [TDD-REFACTOR]（REFACTOR 可写「无需重构 ✓」）。
- 此前轮次将此项判为「可接受」属审计解释偏差，已记录于 `_bmad-output/implementation-artifacts/_orphan/ANALYSIS_TDD三项审计回退_根因.md`。

---

## 3. 审计结论

### 3.1 总体结论

**「未通过」**

### 3.2 未通过原因

| Gap | 严重性 | 描述 |
|-----|--------|------|
| GAP-TDD | 高 | progress 中 US-001、US-002、US-004 缺少 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录，违反 audit-prompts §5 (4) |

### 3.3 修复建议

在 `progress.tasks-E7-S2.txt` 中补充 TDD 三项记录，示例格式：

```text
[TDD-RED] US-001 sft-extract: npm run … => FAIL (脚本不存在)
[TDD-GREEN] US-001 sft-extract: 实现后 => 通过
[TDD-REFACTOR] US-001 sft-extract: 无需重构 ✓

[TDD-RED] US-002 sft-extractor: npm test -- sft-extractor => FAIL (模块不存在)
[TDD-GREEN] US-002 sft-extractor: 实现后 => N passed
[TDD-REFACTOR] US-002 sft-extractor: 抽取函数便于 mock / 无需重构 ✓

[TDD-RED] US-004 sft-extractor.test: 用例尚未实现 => 0 passed
[TDD-GREEN] US-004 sft-extractor.test: 实现后 => 10 passed
[TDD-REFACTOR] US-004: 无需重构 ✓
```

补充完成后重新执行 §5 审计。

### 3.4 轮次说明

**本轮存在 1 个 gap（GAP-TDD），第 4 轮。**

建议：修复 GAP-TDD 后再次审计，累计至 3 轮无 gap 后再收敛。

---

*本报告由批判审计员按 audit-prompts §5 执行阶段审计编制，批判审计员结论占比 >50%。*
