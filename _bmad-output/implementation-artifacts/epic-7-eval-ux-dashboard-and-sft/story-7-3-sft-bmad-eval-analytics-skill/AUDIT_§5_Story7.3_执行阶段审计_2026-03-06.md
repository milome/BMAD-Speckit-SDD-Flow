# §5 执行阶段审计：Story 7.3 SFT 纳入 bmad-eval-analytics Skill

**审计日期**：2026-03-06  
**被审对象**：实施完成后的 Story 7.3 结果  
**审计依据**：audit-prompts §5、Story 7.3、tasks-E7-S3.md、IMPLEMENTATION_GAPS-E7-S3.md  

---

## 1. 被审对象清单

| 类型 | 路径 |
|------|------|
| 实施依据 | story-7-3-sft-bmad-eval-analytics-skill/7-3-sft-bmad-eval-analytics-skill.md |
| 任务文档 | specs/epic-7-eval-ux-dashboard-and-sft/story-3-sft-bmad-eval-analytics-skill/tasks-E7-S3.md |
| 实施产物 | skills/bmad-eval-analytics/SKILL.md（已扩展 SFT 触发） |
| prd | prd.tasks-E7-S3.json |
| progress | progress.tasks-E7-S3.txt |

---

## 2. §5 审计项逐条检查

### 2.1 任务是否真正实现（无预留/占位/假完成）

| 任务 | 实现证据 | 结论 |
|------|----------|------|
| T1.1 | SKILL.md description 含 Coach 与 SFT 双分支；When to use 含「提取微调数据集」「生成 SFT 训练数据」「生成 SFT 数据」及等价表述 | ✅ 真正实现 |
| T1.2 | SKILL.md 执行指引含 SFT 分支：匹配 SFT 短语 → 运行 `npx ts-node scripts/sft-extract.ts` → 展示摘要；Coach 分支保留 | ✅ 真正实现 |
| T2.1 | 运行 `npx ts-node scripts/sft-extract.ts` 成功，输出格式为「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」 | ✅ 已执行验证 |
| T2.2 | progress 已勾选；人工 Cursor 验收（依赖 Agent 识别 Skill） | ✅ 按既定方式完成 |
| T2.3 | progress 已勾选；回归验证 Coach 触发保留 | ✅ 按既定方式完成 |

**结论**：无预留、占位或假完成。

---

### 2.2 生产代码是否在关键路径（Skill 指引执行 sft-extract）

| 检查项 | 证据 | 结论 |
|--------|------|------|
| Skill 文档位置 | `skills/bmad-eval-analytics/SKILL.md`，符合 Cursor skills 目录约定 | ✅ |
| 关键路径 | 用户说「提取微调数据集」→ Agent 加载 Skill → 匹配 When to use → 执行指引要求运行 `npx ts-node scripts/sft-extract.ts` | ✅ |
| 脚本存在与可执行 | `scripts/sft-extract.ts` 存在（Story 7.2 交付），本次审计已执行，输出正确格式 | ✅ |
| 孤岛模块风险 | 本 Story 无新增代码模块；仅扩展 Skill 文档，复用既有脚本；脚本已在 Story 7.2 关键路径（/bmad-sft-extract）中 | ✅ 无孤岛 |

**结论**：Skill 文档在生产关键路径中正确指引执行 sft-extract；无孤岛模块。

---

### 2.3 需实现的项是否有实现与测试/验收覆盖

| GAP | 对应任务 | 实现状态 | 测试/验收 |
|-----|----------|----------|-----------|
| GAP-E7-S3-1 | T1.1 | description 已含 SFT 描述 | 文档审查 + T2 验收 |
| GAP-E7-S3-2 | T1.1 | When to use 已含 SFT 短语列表 | 文档审查 + T2 验收 |
| GAP-E7-S3-3 | T1.2 | 执行指引已含 SFT 分支 | 文档审查 + T2 验收 |
| GAP-E7-S3-4 | T2 | 脚本可执行；Cursor 触发已验收 | T2.1 命令执行；T2.2/T2.3 人工验收 |

**说明**：sft-extractor 模块（Story 7.2）已有单元测试；本 Story 不新增可测代码，验收以命令执行与人工 Cursor 为主。

**结论**：需实现项均有实现；验收覆盖完整。

---

### 2.4 验收表/验收命令是否已执行并填写

| 验收项 | 命令/操作 | 执行证据 | 填写状态 |
|--------|-----------|----------|----------|
| T2.1 | `npx ts-node scripts/sft-extract.ts` | 本次审计执行：exit 0，输出「共提取 0 条，覆盖 0 个 Story；跳过 1 条（原因：无 source_path: 1）」 | progress 已勾选 |
| T2.2 | Cursor 说「提取微调数据集」 | 人工验收，progress 已勾选 | ✅ |
| T2.3 | Cursor 说「帮我看看短板」 | 回归验收，progress 已勾选 | ✅ |

**结论**：验收命令已执行并填写。

---

### 2.5 是否遵守 ralph-method（prd/progress）

| 检查项 | 证据 | 结论 |
|--------|------|------|
| prd 存在 | `prd.tasks-E7-S3.json` 存在，含 US-001、US-002，passes=true | ✅ |
| progress 存在 | `progress.tasks-E7-S3.txt` 存在，含验收命令、完成状态、产出物清单 | ✅ |
| 每 US 更新 | prd 中两 US 均 passes=true；progress 中 T1.1/T1.2/T2.1/T2.2/T2.3 均勾选 | ✅ |
| [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] | progress 中无上述标记 | **适用性说明** |

**TDD 三项标记适用性**：  
Story 7.3 为**文档扩展类 Story**：扩展 `SKILL.md`，无新增 TypeScript/JS 生产代码。sft-extract 脚本为 Story 7.2 交付。§5 要求「涉及生产代码的**每个 US** 须各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]」——本 Story 的 US 仅涉及 Markdown 文档修改与验收，不涉及可单元测试的代码实现，故 TDD 红绿灯标记**不适用**。不记为 gap。

**结论**：遵守 ralph-method；TDD 标记 N/A。

---

### 2.6 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

| 检查项 | 证据 | 结论 |
|--------|------|------|
| Story 文档 | 推迟闭环仅列出 Story 7.2 已交付项及本 Story 范围界定，无「将在后续迭代」 | ✅ |
| tasks | 无延迟表述；T1/T2 全部勾选 | ✅ |
| progress | 无延迟表述 | ✅ |
| 标记完成但未调用 | Skill 文档已更新并位于 `skills/`，Cursor 会加载；脚本可执行，无占位调用 | ✅ |

**结论**：无延迟表述；无假完成。

---

### 2.7 §5 专项：scoring 相关（本 Story 不涉及）

| 检查项 | 适用性 |
|--------|--------|
| scoring-trigger-modes.yaml call_mapping | 本 Story 不涉及评分写入，N/A |
| parseAndWriteScore 参数 | N/A |
| scenario=eval_question、question_version | N/A |
| 评分写入失败 non_blocking | N/A |

---

## 3. 批判审计员结论（占比 >50%）

### 3.1 对抗视角检查

**遗漏风险**

1. **T2.2/T2.3 无自动化回放**  
   - 批判：Cursor 说「提取微调数据集」触发、Coach 回归，均依赖人工在 Cursor 中验证，无自动化测试或回放脚本。  
   - 判定：Story 7.3 验收方式即为人工 Cursor 验收；progress 已勾选，且任务文档明示「依赖 Agent 识别 Skill」。不作为阻断性 gap，但建议后续 Epic 若有批量 Skill 验收需求，可考虑验收脚本或录制回放。

2. **Skill 加载与触发依赖 Cursor/Agent 行为**  
   - 批判：Skill 文档仅提供指引，实际是否触发取决于 Cursor 的 skill 加载与 Agent 的上下文使用，存在行为不确定性。  
   - 判定：本 Story 范围是「扩展 Skill 文档使 Agent 能识别 SFT 触发」，而非实现 Cursor 的 skill 引擎。文档已完整，路径清晰，不记为 gap。

**路径失效风险**

3. **scripts/sft-extract.ts 与 skills/ 的链路**  
   - 批判：Skill 要求执行 `npx ts-node scripts/sft-extract.ts`，若脚本路径或工作目录变更，可能失效。  
   - 判定：脚本路径与 Story 7.2 一致，本次审计已执行并成功；Skill 使用相对路径 `scripts/sft-extract.ts`，在项目根执行时有效。当前无路径失效证据。

4. **formatSummary 输出格式与 AC-1 一致**  
   - 批判：AC-1 要求「输出含摘要（如『共提取 N 条，覆盖 M 个 Story；跳过 K 条...』或等价）」  
   - 判定：sft-extractor 的 `formatSummary` 输出格式完全符合；本次运行输出为「共提取 0 条，覆盖 0 个 Story；跳过 1 条（原因：无 source_path: 1）」。✅

**验收未跑风险**

5. **T2.1 命令是否在实施后实际执行**  
   - 批判：progress 勾选不代表命令曾成功执行。  
   - 判定：本次审计已执行 `npx ts-node scripts/sft-extract.ts`，exit 0，输出格式正确。补充了执行证据。

6. **prd US 与 tasks 映射**  
   - 批判：prd 仅 2 个 US（Skill 文档扩展、验收），与 tasks 的 T1/T2 对应；需确认无遗漏。  
   - 判定：T1.1、T1.2 → US-001；T2.1、T2.2、T2.3 → US-002。映射正确，无遗漏。

**TDD 与 ralph-method 严格性**

7. **progress 无 [TDD-RED/GREEN/REFACTOR]**  
   - 批判：§5 要求「涉及生产代码的每个 US 须各含」上述标记，缺则未通过。  
   - 判定：Story 7.3 的 US 仅涉及 SKILL.md 文档扩展，无新增可单元测试的代码。SKILL.md 为 Markdown 配置类 artifact，非传统「生产代码」。TDD 红绿灯针对代码实现，此处不适用。不记为 gap。

**Gap 汇总（批判审计员）**

- 经逐项对抗检查：**未发现阻断性 gap**。
- T2.2/T2.3 无自动化证据为既定验收方式的局限，非实现缺陷。
- 其余路径、格式、prd/progress、ralph-method 均满足要求。

### 3.2 批判审计员结论

**本轮无新 gap。**

所有 §5 审计项均满足；TDD 标记对本 Story 不适用；验收方式与 Story 设计一致；无孤岛模块、无假完成、无延迟表述。

---

## 4. 审计结论

### 4.1 结论

**「完全覆盖、验证通过」**

### 4.2 收敛说明

本轮无新 gap，**第 1 轮**；建议累计至 3 轮无 gap 后收敛。

### 4.3 建议（非阻断）

1. 若 Epic 7 或后续 Epic 有批量 Skill 验收需求，可考虑编写验收脚本或录制回放，以提供自动化证据。
2. 本 Story 的 Skill 与 `/bmad-sft-extract` Command 共享脚本，后续若脚本接口变更，需同步更新 Skill 执行指引。
