# TASKS：sprint-planning 前置门控（Sprint Planning Gate）

**文档路径**：`_bmad-output/implementation-artifacts/_orphan/TASKS_sprint-planning-gate.md`  
**产出日期**：2026-03-04  
**来源**：Party-Mode 100 轮讨论（批判性审计员发言占比 >70%，收敛条件满足）

---

## §1 背景与目标

### 1.1 背景

当前存在 5 个实施入口可启动 Story 级开发或实施流程：

| 入口 | 行为 | sprint-status 检查 |
|------|------|-------------------|
| create-story (BMM) | 创建 Story 文档 | 缺失时可被用户通过「提供 epic-story 编号」绕过 |
| dev-story (BMM) | 执行 Story 开发 | 缺失时有「Non-sprint story discovery」回退，可 bypass |
| bmad-story-assistant | Create Story → 审计 → Dev Story → 实施后审计 | 不检查 sprint-status |
| speckit.implement | specify→plan→GAPS→tasks→执行 | 不检查 sprint-status |
| bmad-standalone-tasks | 按 TASKS/BUGFIX 文档实施 | 不检查 sprint-status |

**问题**：sprint-planning 产出的 sprint-status.yaml 是 BMAD 实施阶段（Layer 4）的权威跟踪源。若用户或流程可从多个入口绕过 sprint-planning，则：

1. sprint-status 与实际情况脱节
2. Epic/Story 顺序与依赖无法保证
3.  retrospectives、sprint-status 汇总等后续流程失效
4. 与 BMAD 方法论中「sprint-planning 启动实施阶段」的约定不一致

### 1.2 目标

在全流程中**强制 sprint-planning 前置**，使以下入口在 sprint-status 缺失时不得直接进入 Story 创建或开发，除非用户显式确认「已知绕过」或存在合理豁免场景。

**适用范围**：仅限 **BMAD Epic/Story 流程**（create-story、dev-story、bmad-story-assistant 的 Story 创建与开发路径）。以下入口**不适用**本门控：

- **speckit.implement**：可由 standalone spec 驱动，无 Epic/Story 上下文
- **bmad-standalone-tasks**：按 TASKS/BUGFIX 文档执行，与 sprint 无关
- **直接 BUGFIX 实施**：无 sprint 概念

---

## §2 共识方案摘要

### 2.1 策略选择（100 轮讨论结论）

| 策略 | 结论 | 说明 |
|------|------|------|
| **A 收紧 create-story** | ✅ 采用 | sprint-status 缺失时，即使用户提供 epic-story 编号，也须提示「建议先运行 sprint-planning」；可提供「强制继续」但需显式确认 |
| **B 收紧 dev-story** | ✅ 采用 | 移除或严格限制 Non-sprint discovery；sprint-status 缺失时仅接受显式 story_path，不自动搜索 |
| **C bmad-story-assistant 前置检查** | ✅ 采用 | 阶段一 Create Story 前检查 sprint-status；缺失且用户仅提供 epic-story 时，要求先 sprint-planning 或显式确认 |
| **D check-prerequisites BMAD 模式** | ✅ 采用 | 在 check-prerequisites.ps1 中增加 `-RequireSprintStatus`；BMAD 模式下（_bmad-output 存在时）调用须传入，speckit.implement 在 implement 阶段传入 |
| **E 统一 check-sprint-ready 脚本** | ✅ 采用 | 创建 `scripts/check-sprint-ready.ps1`（或等价），供 create-story、dev-story、bmad-story-assistant 复用，集中逻辑 |
| **F 规则与文档** | ✅ 采用 | 更新相关 SKILL、workflow instructions、README，明确 sprint-planning 为前置条件 |

### 2.2 豁免与边界

- **Standalone 流程**：speckit 纯 spec 驱动、bmad-standalone-tasks、BUGFIX 实施——不施加 sprint 门控
- **显式 story 路径**：用户直接提供 `story_path` 或完整 Story 文件路径时，视为「用户已知目标」，可放行（但仍建议检查 sprint-status 是否存在以决定是否更新）
- **强制继续**：用户显式确认「已知 sprint-status 缺失，继续」时，允许进入，但须记录或提示
- **Greenfield 项目**：无 epics/stories 时，sprint-planning 本身可能尚未产出 sprint-status；此时 create-story 的「提供 story docs path」路径保留，作为合法入口

### 2.3 Party-Mode 讨论概要（浓缩）

**R1–20：需求与范围澄清**  
- 批判性审计员（71+ 轮发言）：质疑「强制」的边界——若 standalone 也强制，会误伤 BUGFIX/TASKS 流程；共识为仅 BMAD Epic/Story 流程适用。  
- Winston 架构师：建议统一 check-sprint-ready 脚本，避免各入口重复实现。  
- John 产品经理：用户提供 epic-story 编号本身是合理入口，不应完全禁止，可改为「建议 + 显式确认」。

**R21–50：方案细化与反证**  
- 批判性审计员：dev-story 的 Non-sprint discovery 若移除，是否有合法场景依赖？结论——用户可显式提供 story_path，故可移除自动搜索。  
- Amelia 开发：create-story instructions.xml 中「user provides epic-story number」分支需增加 sprint-status 存在性检查与提示。  
- 批判性审计员：check-prerequisites 若默认 -RequireSprintStatus 会破坏 speckit standalone；结论为参数由调用方传入；当项目含 _bmad-output 时（BMAD 模式），speckit.implement 须传入 -RequireSprintStatus。

**R51–80：任务分解与可验收性**  
- 批判性审计员：每项任务须有明确验收标准，禁止「酌情」「待定」。  
- Bob Scrum Master：check-sprint-ready 脚本应输出 JSON（SPRINT_READY=true|false, MESSAGE=...）供 workflow 解析。  
- Paige 技术写作：文档更新须列出具体文件与修改点。

**R81–100：收敛与终审**  
- 最后 3 轮无新 gap。  
- 批判性审计员终审：有条件同意，见 §Challenger Final Review。

---

## §3 最终任务列表

任务按依赖顺序编号，含验收标准与依赖关系。

### T1：创建 check-sprint-ready 脚本

**描述**：在 `_bmad/scripts/bmad-speckit/powershell/check-sprint-ready.ps1` 或项目 `scripts/` 下创建等价脚本，集中实现 sprint-status 存在性与基本有效性检查。

**验收标准**：
- 脚本接受 `-Json` 输出 JSON：`{ "SPRINT_READY": boolean, "SPRINT_STATUS_PATH": string, "MESSAGE": string }`
- `SPRINT_READY=true` 当且仅当 `_bmad-output/implementation-artifacts/sprint-status.yaml` 存在且可解析，且含可识别的 sprint 跟踪结构（如 `development_status`、`epics`，或项目约定的等效字段）；若使用非标准结构，须在脚本文档中说明支持的字段
- 项目根可由 `-RepoRoot` 或环境推断
- 文档说明用法及被调用场景（create-story、bmad-story-assistant 等）

**验证命令**：
```powershell
# 有 sprint-status 时
./scripts/check-sprint-ready.ps1 -Json
# 输出应含 "SPRINT_READY": true

# 无 sprint-status 时（可临时重命名测试）
# 输出应含 "SPRINT_READY": false
```

**依赖**：无

---

### T2：收紧 create-story 的 sprint-status 缺失分支

**描述**：修改 `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`，在「sprint status file does NOT exist」且「user provides epic-story number」时，增加门控逻辑。**实施前须检查** instructions.xml 是否含「提供 story docs path」分支；若含，则须在验收中说明该分支在 sprint-status 缺失时的行为；若不含，则 T2、T6 中相关验收项标注为 N/A，T8 场景 6a 跳过。

**验收标准**：
- 在 GOTO step 2a 之前，输出明确提示：「⚠️ sprint-status.yaml 不存在。建议先运行 `sprint-planning` 初始化 sprint 跟踪。若确需继续，请显式输入 `继续` 或 `force`。」
- 仅当用户输入 `继续`、`force` 或 `bypass` 时，才执行 GOTO step 2a；否则 HALT 并重复提示（**Challenger Condition 1**：使用明确 token，避免 LLM 误判）
- 若 instructions.xml 含「提供 story docs path」分支，需在验收中说明该分支在 sprint-status 缺失时的行为（放行 / 提示 / 门控）——见 Challenger GAP-SPG-002
- 保留「user chooses '1'」→ HALT 建议 sprint-planning 的行为
- 文档或注释中说明此门控的目的

**验证**：人工或模拟执行 create-story，sprint-status 缺失且用户输入 epic-story 编号，确认提示与门控生效；输入 `继续` 后能进入 step 2a；若有 story docs path 分支，验证 greenfield 路径行为。

**依赖**：T1（可选；若 T2 仅检查文件存在性可不依赖 T1）

---

### T3：收紧 dev-story 的 Non-sprint discovery

**描述**：修改 `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`，当 sprint_status 文件不存在时，移除或严格限制「Non-sprint story discovery」自动搜索逻辑。

**验收标准**：
- 当 `sprint_status` 不存在时，**不得**自动搜索 implementation_artifacts 中的 ready-for-dev 故事文件
- 仅接受：(a) 用户显式提供的 story_path，或 (b) 用户选择选项 3 后提供的路径
- 输出提示：「sprint-status.yaml 不存在。请运行 `sprint-planning` 或提供要开发的 Story 文件路径。」
- 保留 sprint_status 存在时的正常分支逻辑

**验证**：sprint-status 缺失时运行 dev-story，确认不会自动发现故事；提供 story_path 后可继续。

**依赖**：无（可与 T1 联动输出提示信息）

---

### T4：bmad-story-assistant 前置检查

**描述**：在 bmad-story-assistant SKILL.md 的阶段一 Create Story 之前，增加「sprint-status 检查」步骤。

**验收标准**：
- **Challenger Condition 2**：检查动作由**主 Agent** 在发起 Create Story 子任务**之前**执行；可调用 check-sprint-ready 或等价逻辑；子任务 prompt 可附带「sprint-status 已确认」标志以简化子任务逻辑
- 当用户通过 epic_num/story_num（或「4、1」等形式）指定 Story 时，在发起 Create Story 子任务前检查 sprint-status 是否存在
- 若不存在：提示「sprint-status.yaml 不存在，建议先运行 sprint-planning」；要求用户显式确认「已知绕过，继续」或先执行 sprint-planning
- 若用户从 sprint-status 解析下一 Story（示例 3），则仅在 sprint-status 存在时可行；缺失时同样提示
- 若用户明确「已通过 party-mode 且审计通过，跳过 Create Story」并仅请求 Dev Story，可按现有逻辑执行（Dev Story 子任务内部由 dev-story 流程门控）
- 在 SKILL 的「阶段一」章节中显式增加此检查步骤描述

**验证**：按 SKILL 执行，sprint-status 缺失且用户提供 epic-story 时，确认主 Agent 前置提示与门控；确认后能继续。

**依赖**：T1（可调用 check-sprint-ready 或等价逻辑）

---

### T5：check-prerequisites BMAD 模式（必做）

**描述**：在 `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1` 中增加参数 `-RequireSprintStatus`。当传入时，若 sprint-status 不存在则报错并 exit 1。speckit.implement 在 implement 阶段（使用 -RequireTasks 时）须传入 `-RequireSprintStatus`；当项目含 `_bmad-output/implementation-artifacts` 时即视为 BMAD 模式，参数生效；standalone 项目无此目录时，传入亦不报错（或脚本内检测 BMAD 结构后按需强制）。

**验收标准**：
- 新增参数 `-RequireSprintStatus`，默认不启用（$false）
- 启用时：若 `_bmad-output/implementation-artifacts` 存在（BMAD 模式），则要求 sprint-status.yaml 存在，缺失则输出错误并 exit 1；若该目录不存在（standalone），则跳过检查
- 不启用时：现有行为不变
- `commands/speckit.implement.md` 步骤 1：在调用 check-prerequisites 时传入 `-RequireSprintStatus`（使 BMAD 项目在 implement 阶段强制 sprint-planning 前置）

**验证**：BMAD 项目无 sprint-status 时，`check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks -RequireSprintStatus` 应 exit 1；有 sprint-status 时正常；standalone 项目（无 _bmad-output）传入时不受影响。

**依赖**：T1

---

### T6：更新 create-story / dev-story 相关文档

**描述**：在以下位置补充 sprint-planning 前置说明：
- `commands/bmad-bmm-create-story.md` 或等效说明
- `commands/bmad-bmm-dev-story.md` 或等效说明
- 若 `_bmad/_config/bmad-help.csv` 存在且项目可修改，则在其 Create Story、Dev Story 对应行的 description 中补充 sprint-planning 前置说明；若不存在或不可修改，则仅在 commands 文档中补充，并在验收中注明
- **Challenger GAP-SPG-002**：若 greenfield「story docs path」路径存在，在文档中单独说明其与 sprint-planning 的关系（该路径在 sprint-status 缺失时为合法入口）

**验收标准**：
- 明确写出「sprint-planning 为 create-story / dev-story 的前置条件；sprint-status.yaml 缺失时需先运行 sprint-planning 或显式确认 bypass」
- 至少一处指向 sprint-planning 命令或文档
- **bmad-help.csv 可修改性判定**：实施时尝试在 bmad-help.csv 中修改 Create Story、Dev Story 对应行；若文件只读或受版本控制保护无法提交，则判定为不可修改，仅在 commands 文档中补充，并在验收中注明「已检查，不可修改，仅 commands 已更新」；若可修改，则补充 description 并提交
- 若 create-story 含「提供 story docs path」分支，文档中单独说明该路径在 sprint-status 缺失时的行为（放行 / 提示 / 门控）

**验证**：grep 检索，确认相关文档包含 sprint-planning 前置表述。

**依赖**：T2, T3

---

### T7：更新 bmad-story-assistant SKILL 文档

**描述**：在 bmad-story-assistant SKILL.md 的「使用示例」「阶段一」等章节中，补充 sprint-status 检查的说明。

**验收标准**：
- 示例 1、示例 3 中注明「若 sprint-status 不存在，须先运行 sprint-planning 或显式确认」
- 阶段一前置检查清单中增加「sprint-status 存在（或用户已确认 bypass）」
- 与 T4 实现保持一致

**验证**：人工检查 SKILL 文档。

**依赖**：T4

---

### T8：回归验证

**描述**：端到端验证修改后的行为符合预期。

**验收标准**：
- 场景 1：sprint-status 存在，create-story 无用户输入 → 自动发现 backlog story，正常执行
- 场景 2：sprint-status 缺失，create-story 用户输入 epic-story → 提示门控，输入「继续」后执行
- 场景 3：sprint-status 缺失，dev-story 无 story_path → 不自动发现，提示提供路径或 sprint-planning
- 场景 4：bmad-story-assistant，sprint-status 缺失，用户提供 4、1 → 主 Agent 前置提示门控，确认后继续
- 场景 5：speckit.implement（standalone，无 sprint）→ 不受影响
- 场景 6：bmad-standalone-tasks 按 TASKS 文档实施 → 不受影响
- 场景 6a：若有 greenfield「story docs path」路径，sprint-status 缺失时该路径行为符合 §2.2 豁免（放行）
- 场景 7：直接 BUGFIX 实施（如通过 bmad-bug-assistant，不经过 standalone-tasks）→ 不受影响
- 触发方式：通过 BMM 命令（/bmad-bmm-create-story、/bmad-bmm-dev-story）触发 create-story、dev-story 的回归

**验证**：按上述场景执行并记录结果。

**依赖**：T2, T3, T4, T5, T6, T7

---

## §4 任务依赖关系

```
T1 ──┬── T2 (可选*)
     ├── T4
     └── T5
T2 ──┬── T6
     └── T8
T3 ──┬── T6
     └── T8
T4 ──┬── T7
     └── T8
T5 ── T8
T6 ── T8
T7 ── T8
```

*T1→T2 为可选：若 T2 复用 check-sprint-ready 则依赖 T1；若 T2 直接在 instructions 中检查文件存在性则可不依赖 T1。

**建议执行顺序**：T1 → T2, T3, T4, T5 (可并行) → T6, T7 → T8

---

## Challenger Final Review

**Status**: conditional（有条件同意）

**Conditions**:
1. T2、T3 的「显式确认」 wording 须在实施时具体化，避免 LLM 将模糊表达误判为确认；建议使用明确的 token 如 `继续`、`force`、`bypass`。
2. T4 在 bmad-story-assistant 中的集成方式须明确：是主 Agent 在发起子任务前执行 check-sprint-ready，还是子任务内部检查？建议主 Agent 前置检查，子任务 prompt 中可附带「sprint-status 已确认」标志以简化子任务逻辑。
3. ~~T5 为可选~~ T5 已改为必做；T1–T8 均为必做。

**Deferred Gaps**:
- **GAP-SPG-001**：跨 worktree 场景下 sprint-status 路径可能不同；若项目支持多 worktree，check-sprint-ready 与 implementation_artifacts 路径解析需在文档或实现中约定。建议列入后续改进。
- **GAP-SPG-002**：create-story 的「提供 story docs path」路径（greenfield）与 sprint-planning 的关系未在本次任务中细化；若该路径常用，建议在 T6 文档中单独说明。

**建议**：进入实施阶段，T2–T4 实施时优先澄清上述 Conditions；GAP-SPG-001、GAP-SPG-002 可在后续 Story 或改进中处理。

---

*本 TASKS 文档经 party-mode 100 轮讨论产出，批判性审计员发言占比 >70%，最后 3 轮无新 gap 收敛。*
