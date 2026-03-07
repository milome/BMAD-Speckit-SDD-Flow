# audit-prompts §5 执行阶段审计：TASKS_sprint-planning-gate

**审计日期**：2026-03-04  
**被审对象**：TASKS_sprint-planning-gate 实施完成后的结果  
**审计轮次**：第 1 轮  
**审计依据**：`_bmad-output/implementation-artifacts/_orphan/TASKS_sprint-planning-gate.md`

---

## §5 审计项逐项结论

### 1. 任务是否真正实现（无预留/占位/假完成）

| 任务 | 结论 | 依据 |
|-----|------|------|
| T1 | ✅ 已实现 | `scripts/check-sprint-ready.ps1` 存在且完整，支持 `-Json`、`-RepoRoot`，输出 `SPRINT_READY`/`SPRINT_STATUS_PATH`/`MESSAGE`，含 development_status/epics 检测 |
| T2 | ⚠️ 部分实现 | create-story instructions.xml 含门控逻辑（继续/force/bypass），但存在**结构级 bypass 漏洞**（见批判审计员结论） |
| T3 | ✅ 已实现 | dev-story instructions.xml 在 sprint_status 不存在时移除 Non-sprint discovery，仅接受 story_path 或选项 3 路径，输出正确提示 |
| T4 | ✅ 已实现 | bmad-story-assistant SKILL 阶段一 §1.0 含 sprint-status 前置检查，自检清单含 sprint-status 检查项 |
| T5 | ✅ 已实现 | check-prerequisites.ps1 含 `-RequireSprintStatus`，BMAD 模式逻辑完整；speckit.implement.md 步骤 1 已传入该参数 |
| T6 | ✅ 已实现 | bmad-bmm-create-story.md、bmad-bmm-dev-story.md 含 sprint-planning 前置表述；bmad-help.csv Create Story、Dev Story 行已补充 |
| T7 | ✅ 已实现 | bmad-story-assistant 示例 1、3 注明 sprint-status 要求；阶段一前置检查清单含 sprint-status |
| T8 | ⚠️ 未完全覆盖 | progress 标注「实施已完成」但**无场景 1–7、6a 的实际执行记录与结果**，属延迟/假完成 |

### 2. 生产代码是否在关键路径中被使用

| 产出 | 关键路径使用情况 |
|-----|------------------|
| check-sprint-ready.ps1 | **bmad-story-assistant** 明确要求调用；create-story、dev-story **未调用**（instructions 内嵌逻辑），符合 TASKS「T1 可选依赖」约定 |
| check-prerequisites -RequireSprintStatus | speckit.implement 步骤 1 调用，**在 implement 阶段关键路径** ✅ |
| create-story 门控 | instructions 内嵌逻辑，在「sprint_status 不存在」分支内；但**首条 check 可绕过**（见下） |
| dev-story 门控 | instructions 内嵌逻辑，sprint_status 不存在时正确生效 ✅ |

### 3. 需实现的项是否均有实现与测试/验收覆盖

- **T1**：验证命令已执行，`./scripts/check-sprint-ready.ps1 -Json` 输出 `SPRINT_READY: true`（有 sprint-status 时）✅  
- **T2**：未执行人工或模拟 create-story 回归验证；且存在 bypass 漏洞  
- **T3**：未执行 dev-story 回归验证  
- **T4**：未执行 bmad-story-assistant 端到端验证  
- **T5**：check-prerequisites 因项目无 `specs/dev` 结构在早期步骤失败，无法验证 `-RequireSprintStatus` 完整路径；代码审查确认逻辑正确  
- **T6**：grep 验证通过（create-story、dev-story、bmad-help、speckit.implement 含 sprint-planning 表述）✅  
- **T7**：人工检查 SKILL 文档通过 ✅  
- **T8**：**无场景 1–7、6a 的验收输出或记录**，仅有「需通过 BMM 命令…人工或集成测试验证，实施已完成」的声明，未满足「按上述场景执行并记录结果」

### 4. 验收表/验收命令是否已按实际执行并填写

| 验收项 | 执行情况 | 记录位置 |
|--------|----------|----------|
| T1 有/无 sprint-status 输出 | ✅ 有 sprint-status 时已执行并得正确 JSON | progress、本审计 |
| T1 无 sprint-status 输出 | ❌ 未执行（未临时重命名测试） | — |
| T2 模拟 create-story | ❌ 未执行 | — |
| T3 dev-story 无 story_path | ❌ 未执行 | — |
| T5 check-prerequisites 无 sprint-status exit 1 | ❌ 未执行（需临时移走 sprint-status） | — |
| T6 grep | ✅ 已执行 | progress |
| T8 场景 1–7、6a | ❌ 未执行并记录 | progress 仅声明「实施已完成」 |

**结论**：验收表/验收命令**未按实际执行完整**；progress 中有多项声明为 PASSED 但无对应验收输出佐证。

### 5. 是否遵守 ralph-method（prd/progress 更新、US 顺序）

- **prd.TASKS_sprint-planning-gate.json**：存在，含 US-001～US-008，`passes` 均为 true；与 TASKS 映射一致 ✅  
- **progress.TASKS_sprint-planning-gate.txt**：存在，含 8 条 story log，按 US-001～US-008 顺序；格式符合 ralph-method ✅  
- **每 US 完成即更新**：progress 显示逐项完成，符合「每 US 完成即更新」的要求 ✅  

**结论**：prd/progress 结构遵守 ralph-method；但部分 US 的 `passes` 与实际验收执行情况不一致（见 §5.4）。

### 6. 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

| 检查项 | 结果 |
|--------|------|
| 「将在后续迭代」等延迟表述 | progress 中 T8 称「需通过 BMM 命令…人工或集成测试验证，实施已完成」——隐含将**实际回归执行**推迟至人工/集成阶段，属**延迟表述** |
| 标记完成但未调用 | T8 标记 PASSED 但**未实际执行**场景 1–7、6a 并记录结果；T2 门控存在 bypass，实际调用路径可能未达预期 |

---

## 批判审计员结论

> **第 1 轮；批判审计员发言占比 >50%**

### 1. create-story 结构级 bypass 漏洞（GAP-§5-001）

**现象**：instructions.xml step 1 中，**首条 check**（约 L21–24）为：

```xml
<check if="{{story_path}} is provided by user or user provided the epic and story number such as 2-4 or 1.6...">
  <action>Parse... GOTO step 2a</action>
</check>
```

当用户**在初始输入中**提供 epic-story（如「create story 2-4」）时，该 check 先行匹配，直接 GOTO step 2a，**完全绕过** sprint_status 检查及 T2 门控逻辑。  
T2 门控仅存在于 `sprint status file does NOT exist` 分支内，而该分支仅在**首条 check 未匹配**时才会进入（即用户未在初始输入提供 story_path 或 epic-story）。

**可复现**：sprint-status 不存在时，用户运行 create-story 并附带「2-4」→ 预期应触发门控 → 实际若 workflow 将「2-4」视为首条 check 的输入，则直接进入 step 2a。

**判定**：本轮存在 gap；需将 sprint_status 检查**提前于**或**融入**首条 story_path/epic-story check，确保在 sprint-status 不存在时，即使用户提供 epic-story，也须经过门控。

### 2. T8 回归验证未执行且无记录（GAP-§5-002）

TASKS §3 T8 明确要求：「按上述场景执行并记录结果」「触发方式：通过 BMM 命令…触发 create-story、dev-story 的回归」。

progress 仅写：「场景 1–7、6a：需通过 BMM 命令…人工或集成测试验证，实施已完成」。  
**未包含**：
- 各场景是否已执行
- 各场景通过/失败
- 验收命令的实际输出或摘要

**判定**：T8 属「标记完成但未调用」；不符合 §5 审计项 3、4、6。须在 progress 或单独验收记录中补充场景 1–7、6a 的执行结果。

### 3. 验收命令未实际运行（GAP-§5-003）

下列验收命令在 progress 或实施过程中**未找到**执行证据：

- T1 无 sprint-status 时：`./scripts/check-sprint-ready.ps1 -Json` 预期 `SPRINT_READY: false`（需临时重命名 sprint-status 测试）
- T2：create-story 在 sprint-status 缺失 + 用户输入 epic-story 时的提示与门控
- T3：dev-story 在 sprint-status 缺失 + 无 story_path 时的不自动发现行为
- T5：`check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks -RequireSprintStatus` 在 BMAD 项目无 sprint-status 时 exit 1

**判定**：验收表存在多项未执行项；与 §5 审计项 4 不符。

### 4. story docs path 分支（GAP-SPG-002）处理未显式验收

TASKS Challenger 与 T6 要求：若 create-story 含「提供 story docs path」分支，需在文档中说明其与 sprint-planning 的关系；T8 场景 6a 要求 greenfield 路径行为符合 §2.2 豁免。

create-story instructions L66–69 有 `user provides story docs path` → 直接 GOTO step 2a（放行）。  
progress 与文档中**未**明确记录：
- 该分支在 sprint-status 缺失时是否按豁免放行
- 是否在 T6 文档中单独说明
- 场景 6a 是否已执行

**判定**：GAP-SPG-002 相关验收未闭合；建议在 T6 文档中增补说明，并在 T8 中记录场景 6a 结果。

### 5. check-sprint-ready 与 create-story/dev-story 未集成

T1 说明 check-sprint-ready 供 create-story、dev-story、bmad-story-assistant 复用。  
实际：create-story 与 dev-story 的 instructions **未调用** check-sprint-ready，仅使用内嵌的文件存在性检查。  
TASKS 允许 T2 不依赖 T1（若 T2 仅检查文件存在性），故不算违反规格，但存在**逻辑重复**与**未来维护分歧**风险。建议在文档或注释中明确「create-story/dev-story 采用内嵌检查，bmad-story-assistant 调用 check-sprint-ready」。

### 6. 行号与路径有效性

- TASKS 中引用的路径与脚本位置一致：`scripts/check-sprint-ready.ps1`、`_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1`、create-story/dev-story instructions 等均存在且可访问。  
- 未见失效行号或路径。

### 7. §5/验收误伤与漏网

- **误伤**：未发现将正确实现误判为未通过的情况。  
- **漏网**：  
  - create-story 首条 check 导致的 bypass（§5 审计项 1、2 漏网）  
  - T8 未执行与未记录（§5 审计项 3、4、6 漏网）  
  - 部分验收命令未运行（§5 审计项 4 漏网）

---

## 批判审计员总结

**本轮存在 gap，不计数。**

| 编号 | 描述 | 严重程度 |
|------|------|----------|
| GAP-§5-001 | create-story 首条 check 允许 epic-story 绕过 sprint 门控 | 高 |
| GAP-§5-002 | T8 场景 1–7、6a 未执行且无记录 | 高 |
| GAP-§5-003 | 多项验收命令未实际运行 | 中 |
| GAP-SPG-002 | story docs path 与 sprint-planning 关系未在文档中显式说明并验收 | 中 |

---

## 最终结论

**未通过**

**未通过原因**：
1. create-story 存在**结构级 bypass**，sprint 门控可被 epic-story 初始输入绕过（GAP-§5-001）。  
2. T8 回归验证未实际执行并记录，属「标记完成但未调用」（GAP-§5-002）。  
3. 多项验收命令未运行，验收表不完整（GAP-§5-003）。  
4. GAP-SPG-002 相关验收未闭合。

**修改建议**：
1. **GAP-§5-001**：调整 create-story instructions step 1 的评估顺序，将 sprint_status 检查提前，或在首条 story_path/epic-story check 中增加「若 sprint_status 不存在，须先经门控」的分支，确保 epic-story 无法绕过门控。  
2. **GAP-§5-002**：在 progress 或单独验收文档中补充场景 1–7、6a 的执行结果（通过/失败、命令输出摘要）；或明确标注哪些场景为「待人工/集成执行」并说明原因。  
3. **GAP-§5-003**：补跑 T1 无 sprint-status、T2、T3、T5 的验收命令，将输出或结论记入 progress 或验收表。  
4. **GAP-SPG-002**：在 T6 相关文档中说明「story docs path」分支在 sprint-status 缺失时为合法 greenfield 入口；在 T8 中记录场景 6a 的验证结果。

---

*本报告符合 audit-prompts §5 执行阶段审计要求，批判审计员结论段落占比 >50%，结论明确为「未通过」及具体 gap 与修改建议。*
