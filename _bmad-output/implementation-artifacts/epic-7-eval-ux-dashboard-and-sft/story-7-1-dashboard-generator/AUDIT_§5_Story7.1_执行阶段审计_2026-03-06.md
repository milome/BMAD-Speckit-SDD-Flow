# Story 7.1 仪表盘生成器 — §5 执行阶段审计报告

**审计日期**：2026-03-06  
**审计类型**：audit-prompts §5 执行阶段审计（实施完成验证）  
**被审对象**：实施依据 7-1-dashboard-generator.md；任务文档 tasks-E7-S1.md；实施产物 commands/bmad-dashboard.md、scripts/dashboard-generate.ts、scoring/dashboard/、_bmad-output/dashboard.md

---

## §1 逐项验证（§5 审计项）

### 1.1 任务是否真正实现（无预留/占位/假完成）

| 任务 ID | 内容 | 验证方式 | 结果 |
|---------|------|----------|------|
| T1.1 | commands/bmad-dashboard.md | 文件存在，含验收命令 | ✅ |
| T1.2 | scripts/dashboard-generate.ts 骨架 | 代码完整；loadAndDedupeRecords + filter；空数据输出并写入 | ✅ |
| T2.1 | groupByRunId, getLatestRunRecords, getRecentRuns, computeHealthScore | compute.ts 实现；单测覆盖 | ✅ |
| T2.2 | getDimensionScores | 实现完整；无 dimension_scores 返回「无数据」 | ✅ |
| T2.3 | getWeakTop3 | 实现；含 parseEpicStoryFromRecord | ✅ |
| T2.4 | countVetoTriggers | buildVetoItemIds + 遍历 check_items | ✅ |
| T2.5 | getTrend | 最近 5 run，升/降/持平 | ✅ |
| T2.6 | formatDashboardMarkdown | format.ts 含全部分区 | ✅ |
| T2.7 | scoring/dashboard/index.ts + 脚本调用 compute→format | 链条完整 | ✅ |
| T3.1 | 验收命令可执行 | 已执行 `npx ts-node scripts/dashboard-generate.ts`，输出符合 AC | ✅ |
| T3.2 | .cursor/commands 同步 | .cursor/commands/bmad-dashboard.md 存在 | ✅ |
| T4.1 | compute.test.ts | 12 tests 覆盖 groupByRunId、getLatestRunRecords、computeHealthScore、getDimensionScores、getWeakTop3、countVetoTriggers、getTrend | ✅ |
| T4.2 | format.test.ts | 2 tests 覆盖 formatDashboardMarkdown | ✅ |
| T4.3 | 集成/E2E | 验收命令已跑；npm test scoring/dashboard 通过 | ✅ |

**结论**：无占位、无预留、无假完成；任务均已落地。

### 1.2 生产代码是否在关键路径中被使用

**关键路径**：dashboard-generate → scoring/dashboard → scoring/query

| 环节 | 实现 | 说明 |
|------|------|------|
| dashboard-generate.ts | 入口 | 导入 getScoringDataPath、loadAndDedupeRecords、scoring/dashboard |
| 数据加载 | scoring/query/loader.loadAndDedupeRecords | 直接调用，非占位 |
| 过滤 | filter scenario !== 'eval_question' | 等价 queryByScenario('real_dev') |
| 计算 | scoring/dashboard (compute, format) | computeHealthScore、getDimensionScores、getWeakTop3、countVetoTriggers、getTrend、formatDashboardMarkdown |
| parseEpicStoryFromRecord | scoring/query (compute.ts 内 import) | 用于短板 Top 3 的 epic.story 解析 |
| buildVetoItemIds | scoring/veto | 用于 countVetoTriggers |

**结论**：关键路径完整，生产代码在脚本与 scoring 模块间正确串联。

### 1.3 需实现的项是否均有实现与测试/验收覆盖

| 需求/AC | 实现 | 测试/验收 |
|---------|------|-----------|
| AC-1 有数据输出总分、四维、短板、Veto、趋势 | compute + format | 单测 + 验收命令 |
| AC-2 无数据友好提示 | 脚本空数组分支 | 验收命令（需空目录验证，未在本轮显式执行） |
| AC-3 无 dimension_scores 时「无数据」 | getDimensionScores | compute.test.ts |
| AC-4 输出路径与展示 | _bmad-output/dashboard.md + stdout | 验收命令已确认文件存在且内容与 stdout 一致 |

**GAP-E7-S1 映射**：GAP-1～10 均有对应任务与实现，无遗漏。

### 1.4 验收表/验收命令是否已按实际执行并填写

| 验收命令 | 执行结果 | 填写位置 |
|----------|----------|----------|
| `npx ts-node scripts/dashboard-generate.ts` | 成功；输出含总分、四维、短板、Veto、趋势 | progress.tasks-E7-S1.txt T3 PASSED |
| 有数据时输出 | 已跑；_bmad-output/dashboard.md 存在且与 stdout 一致 | 本次审计复现通过 |
| `npm run test -- scoring/dashboard` | 14 tests passed | progress.tasks-E7-S1.txt T4 PASSED |

**结论**：验收命令已执行并记录于 progress；本轮复现验收命令与单测均通过。

### 1.5 是否遵守 ralph-method（prd/progress 更新）

| 产出 | 状态 | 说明 |
|------|------|------|
| progress.tasks-E7-S1.txt | ✅ 存在 | 记录 T1～T4 完成、验收命令、输出路径 |
| prd.tasks-E7-S1.json | ❌ 缺失 | Epic 7 Story 7.1 下无 prd.tasks 文件；Epic 6 同层级有 prd 示例 |

**结论**：progress 已更新；prd.tasks 缺失，与 ralph-method 要求存在差距。

### 1.6 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

| 检查项 | 结果 |
|--------|------|
| 实施产物中的「后续」「待定」等 | 未在 commands/bmad-dashboard.md、scripts/dashboard-generate.ts、scoring/dashboard/ 中发现 |
| 标记完成但未调用 | T1～T4 均已勾选，对应实现已存在且验收通过 |

**结论**：实施代码无延迟表述；任务完成状态与实现一致。

---

## 批判审计员结论（>50%）

### 一、路径与依赖核查

1. **关键路径完整性**  
   dashboard-generate.ts 依赖 scoring/query/loader、scoring/dashboard、scoring/constants/path。compute.ts 依赖 scoring/veto、scoring/query（parseEpicStoryFromRecord）。调用链无断点，无 stub 或 mock 替代生产实现。**无 gap**。

2. **数据源与 scenario 过滤**  
   脚本使用 `loadAndDedupeRecords(dataPath).filter(r => r.scenario !== 'eval_question')`，等价于仅取 real_dev。与 Story 要求一致。**无 gap**。

### 二、规范符合性

3. **spec §3.2.1 phase_weight 为 0 时的 fallback**  
   spec 要求：「若 record 无 phase_weight 或为 0：使用 PHASE_WEIGHTS 中对应 stage 的权重（需建立 stage 到 phase 索引的映射）」。当前 computeHealthScore 对 phase_weight ≤ 0 的 record 直接跳过，未使用 PHASE_WEIGHTS fallback。  
   但 plan §5.2 明确允许「或跳过该 record」。实施选择「跳过」与 plan 一致，与 spec 的 fallback 要求有偏差。在现有数据（phase_weight 均由解析器写入）下行为正确，但若未来出现 phase_weight=0 的 record，可能与 spec 的「优先用 PHASE_WEIGHTS」有歧义。**低优先级 gap**：建议在 spec 与 plan 间统一，或后续补充 fallback。

4. **T1.2 与 process.exit(0)**  
   tasks-E7-S1 T1.2 要求「console.log 后 process.exit(0)」。脚本在空数据分支使用 `return`，有数据分支依赖脚本自然退出，未显式调用 process.exit(0)。对 Node CLI 而言行为等价，exit code 为 0。**可接受偏差**。

5. **prd.tasks 缺失**  
   ralph-method 要求 prd/progress 更新。progress.tasks-E7-S1.txt 存在，prd.tasks-E7-S1.json 不存在。与 Epic 6 部分 Story 的 ralph 产出相比，存在缺失。**Gap**：建议补充 prd.tasks-E7-S1.json，或明确 Epic 7 采用轻量 progress-only 流程。

### 三、测试与验收

6. **countVetoTriggers 单测强度**  
   compute.test.ts 中 countVetoTriggers 仅断言 `expect(count).toBeGreaterThanOrEqual(0)`，未验证 veto 配置内 item_id 的真实计数。若 buildVetoItemIds 变更或 item_id 命名变化，可能漏检。**Gap**：建议增加使用已知 veto item_id 的 fixture，断言 count === 1 或具体值。

7. **AC-2 无数据场景的显式验收**  
   progress 与本次审计均以「有数据」场景为主。AC-2 要求空目录或无 real_dev 时输出「暂无数据...」。脚本逻辑正确，但未在文档中记录「空目录运行」的显式验收结果。**低优先级 gap**：建议在 progress 或验收表中补充一次空目录运行记录。

8. **E2E 无数据路径**  
   T4.3 要求「npx ts-node scripts/dashboard-generate.ts 在有数据/无数据时输出符合 AC」。有数据路径已验证；无数据路径依赖代码审查与逻辑推断，未在本次审计中实际跑空目录。**建议**：在回归或发布前补跑一次空目录 E2E。

### 四、产出物与一致性

9. **产出物路径与内容**  
   commands/bmad-dashboard.md、.cursor/commands/bmad-dashboard.md 存在且内容一致。_bmad-output/dashboard.md 已生成，格式含总分、四维、短板、Veto、趋势。与 Story 要求一致。**无 gap**。

10. **禁止词与延迟表述**  
    实施代码（commands、scripts、scoring/dashboard）中未发现「可选」「后续」「待定」等禁止词或延迟表述。**无 gap**。

### 五、批判审计员综合结论

**本轮存在 gap**：

| # | Gap | 严重程度 | 建议 |
|---|-----|----------|------|
| G1 | prd.tasks-E7-S1.json 缺失 | 中 | 补全 prd 或明确 Epic 7 流程例外 |
| G2 | countVetoTriggers 单测仅 assert >=0，未验证具体计数 | 低 | 增加基于已知 veto item_id 的断言 |
| G3 | spec §3.2.1 phase_weight=0 fallback 未实现 | 低 | 按 spec/plan 统一或后续实现 |
| G4 | AC-2 无数据场景未在验收记录中显式跑过 | 低 | 补跑空目录验收并记录 |

**可接受偏差**：T1.2 process.exit(0) 以 return/隐式退出替代，对 CLI 行为无影响。

**无 gap 项**：任务实现完整性、关键路径、有数据验收、产出物路径、禁止词合规、.cursor 同步。

---

## §2 汇总与最终结论

| §5 审计项 | 结果 |
|-----------|------|
| ① 任务真正实现（无占位） | ✅ |
| ② 生产代码在关键路径中使用 | ✅ |
| ③ 实现与测试/验收覆盖 | ⚠️ countVetoTriggers 单测可加强 |
| ④ 验收命令已执行并填写 | ✅ |
| ⑤ ralph-method | ⚠️ progress 有，prd 缺失 |
| ⑥ 无延迟表述、无假完成 | ✅ |

---

## 结论

**结论：未通过。**

**Gap 列表**：
1. **prd.tasks-E7-S1.json 缺失**（ralph-method）
2. **countVetoTriggers 单测未验证具体 veto 计数**
3. **AC-2 无数据场景未在验收记录中显式执行**

**建议**：补齐 prd.tasks、增强 countVetoTriggers 单测、补跑并记录 AC-2 空目录验收后，可重新提请 §5 审计。若采用「轻量 progress-only」作为 Epic 7 约定，则需明确文档化，并仅保留 G2、G4 为可选改进。

---

*审计执行：audit-prompts §5；批判审计员视角占比 >50%。*
