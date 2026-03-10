# AUDIT §5：TASKS_sprint-planning-gate 第 2 轮审计报告

**被审计文档**：`_bmad-output/implementation-artifacts/_orphan/TASKS_sprint-planning-gate.md`  
**产出日期**：2026-03-04  
**审计依据**：audit-prompts §5 精神（逐条检查、严苛验证、明确结论）；第 1 轮审计报告的 6 项修改建议

---

## §1 审计依据与范围

### 1.1 审计依据

| 依据 | 内容 |
|------|------|
| audit-prompts §5 精神 | 逐条检查、严苛验证、明确结论；禁止模糊表述 |
| 第 1 轮修改建议 | 6 项：T6 可修改性、§4 依赖图、Greenfield 路径、T4 主 Agent 前置、Challenger 映射、T8 场景 6a/7/BMM |
| 批判审计员占比 | 报告 §2、§3 批判审计员裁定须占篇幅 >50% |

### 1.2 审计范围

- **覆盖**：第 1 轮 6 项修改的逐项落实核查；新引入歧义/遗漏/矛盾检查
- **结论形式**：是否「完全覆盖、验证通过」；若通过，仍须第 3 轮复验（连续 3 轮无 gap 方可收敛）

---

## §2 逐项核查（第 1 轮 6 项修改）

### 2.1 修改 1：T6 明确 bmad-help.csv 可修改性判定与回退

**第 1 轮建议**：将「若可编辑」明确为「若 `_bmad/_config/bmad-help.csv` 存在且项目可修改，则...；若不存在或不可修改，则仅在 commands 文档中补充，并在验收中注明」。

**当前文档核查**（T6 描述，L183-185）：

> 若 `_bmad/_config/bmad-help.csv` 存在且项目可修改，则在其 Create Story、Dev Story 对应行的 description 中补充 sprint-planning 前置说明；若不存在或不可修改，则仅在 commands 文档中补充，并在验收中注明

**验收标准**（L191）：

> bmad-help.csv：可修改则补充；不可修改则在验收中注明「已检查，不可修改，仅 commands 已更新」

**批判审计员裁定**：描述与验收标准已明确「可修改/不可修改」双分支及回退路径。「并在验收中注明」提供了可追溯的验收证据。**落实 ✓**。保留一项边际质疑：「项目可修改」的判定（如：只读、被 BMAD 覆盖、子模块锁定）未在文档中枚举——作为实施时需澄清项可接受，不作为本轮 gap。

---

### 2.2 修改 2：§4 依赖图 T1→T2 标注为可选，增加图注

**第 1 轮建议**：在 §4 依赖图中将 T1→T2 标注为「可选」，或增加图注说明。

**当前文档核查**（§4，L224-243）：

```text
T1 ──┬── T2 (可选*)
     ...
```

图注：

> *T1→T2 为可选：若 T2 复用 check-sprint-ready 则依赖 T1；若 T2 直接在 instructions 中检查文件存在性则可不依赖 T1。

**批判审计员裁定**：图中 T2 旁已标注「(可选*)」，图注明确两种实现路径与依赖关系。实施者可据此判断 T2 是否必须等待 T1。**落实 ✓**。

---

### 2.3 修改 3：T2/T6 补充 Greenfield story docs path；T8 增加 6a、7 场景

**第 1 轮建议**：T2 补充 story docs path 分支在 sprint-status 缺失时的行为；T6 单独说明 greenfield 路径；T8 增加 greenfield 场景（6a）与直接 BUGFIX 场景（7）。

**当前文档核查**：

| 位置 | 内容 | 验证 |
|------|------|------|
| T2 验收标准 L124-125 | 若 instructions.xml 含「提供 story docs path」分支，需在验收中说明该分支在 sprint-status 缺失时的行为（放行/提示/门控）——见 Challenger GAP-SPG-002 | ✓ |
| T2 验证 L128 | 若有 story docs path 分支，验证 greenfield 路径行为 | ✓ |
| T6 描述 L186 | **Challenger GAP-SPG-002**：若 greenfield「story docs path」路径存在，在文档中单独说明其与 sprint-planning 的关系 | ✓ |
| T6 验收标准 L193 | 若 create-story 含「提供 story docs path」分支，文档中单独说明该路径在 sprint-status 缺失时的行为（放行/提示/门控） | ✓ |
| T8 场景 6a L217 | 若有 greenfield「story docs path」路径，sprint-status 缺失时该路径行为符合 §2.2 豁免（放行） | ✓ |
| T8 场景 7 L218 | 直接 BUGFIX 实施（如通过 bmad-bug-assistant，不经过 standalone-tasks）→ 不受影响 | ✓ |

**批判审计员裁定**：T2、T6、T8 均按第 1 轮建议补充；greenfield 与直接 BUGFIX 的边界均已覆盖。场景 6a 与 §2.2 豁免（放行）一致，无矛盾。**落实 ✓**。

---

### 2.4 修改 4：T4 验收标准增加「主 Agent 前置检查」

**第 1 轮建议**：验收标准增加「检查动作由主 Agent 在发起 Create Story 子任务之前执行；可调用 check-sprint-ready 或等价逻辑；子任务 prompt 可附带『sprint-status 已确认』标志」。

**当前文档核查**（T4 验收标准 L150-151）：

> **Challenger Condition 2**：检查动作由**主 Agent** 在发起 Create Story 子任务**之前**执行；可调用 check-sprint-ready 或等价逻辑；子任务 prompt 可附带「sprint-status 已确认」标志以简化子任务逻辑

**批判审计员裁定**：验收标准第一条即为 Challenger Condition 2，明确执行主体（主 Agent）、时机（发起子任务之前）及可选实现方式。可消除「主 Agent 前置 vs 子任务内部」歧义。**落实 ✓**。

---

### 2.5 修改 5：T2、T4、T6 显式引用 Challenger Conditions 与 GAP-SPG-002

**第 1 轮建议**：T2、T4、T6 显式引用 Challenger Conditions 与 GAP-SPG-002。

**当前文档核查**：

| 任务 | 引用内容 | 位置 |
|------|----------|------|
| T2 | Challenger Condition 1（明确 token 继续、force、bypass） | L122 |
| T2 | Challenger GAP-SPG-002（story docs path 分支） | L125 |
| T4 | Challenger Condition 2（主 Agent 前置检查） | L150 |
| T6 | Challenger GAP-SPG-002（greenfield story docs path） | L186, L193 |

**批判审计员裁定**：Conditions 与 GAP 已映射到具体任务验收标准，实施者无法将其视为「可选建议」而忽略。**落实 ✓**。注：T3 的 Condition 1 适用范围为「显式确认」wording——T3 场景为用户提供 story_path，无「继续/force/bypass」类 token，与 T2 区分合理，无需在 T3 重复标注 Condition 1。

---

### 2.6 修改 6：T8 增加场景 7（直接 BUGFIX）、6a（greenfield）、BMM 触发方式说明

**第 1 轮建议**：T8 增加场景 7（直接 BUGFIX）；澄清与 standalone-tasks 关系；注明通过 BMM 命令触发。

**当前文档核查**（T8，L209-222）：

- 场景 6a：greenfield story docs path，sprint-status 缺失时放行 ✓
- 场景 7：直接 BUGFIX 实施（如通过 bmad-bug-assistant，不经过 standalone-tasks）→ 不受影响 ✓
- 触发方式：通过 BMM 命令（/bmad-bmm-create-story、/bmad-bmm-dev-story）触发 create-story、dev-story 的回归 ✓

**批判审计员裁定**：场景 6a、7 已补充；场景 7 明确区分「bmad-bug-assistant 直接实施」与「bmad-standalone-tasks 按文档实施」。BMM 触发方式已注明，满足第 1 轮对「通过 BMM 命令触发」的显式要求。**落实 ✓**。

---

## §3 批判审计员：新引入歧义、遗漏与矛盾检查

### 3.1 歧义检查

**批判审计员**：逐项审查修改后的表述，是否存在新歧义。

| 检查项 | 结论 |
|--------|------|
| T6「项目可修改」 | 较「若可编辑」已有明确分支与回退；「项目可修改」的具体判定（只读、覆盖、子模块）未枚举，属于实施时澄清范围，不视为本轮歧义 |
| T2/T6/T8 的「若有...路径」 | 条件表述一致；该路径不存在时相关验收/场景为 N/A，逻辑清晰 |
| T8「如通过 bmad-bug-assistant」 | 示例性表述，不排除其他直接 BUGFIX 入口；回归时可覆盖典型入口，足够 |

**裁定**：未发现新的实质性歧义。

---

### 3.2 遗漏检查

**批判审计员**：检查是否有第 1 轮未覆盖且本轮应发现之遗漏。

| 检查项 | 结论 |
|--------|------|
| T3 显式确认 token | Condition 1 主要针对 create-story（T2）的用户输入确认；T3 的「显式提供 story_path」本身即为确认形式，无需增加 continue/force 类 token |
| T5 可选任务的依赖 | T5 依赖 T1，图中正确；T8 依赖「T5（若实施）」，与第 1 轮一致 |
| Challenger GAP-SPG-001 | 仍为 Deferred，未纳入本 TASKS 范围，符合第 1 轮结论 |

**裁定**：未发现新的遗漏。

---

### 3.3 矛盾检查

**批判审计员**：检查修改后各条款是否自洽。

| 检查项 | 结论 |
|--------|------|
| T2/T6/T8 对 greenfield 路径 | T2 要求验收中说明行为；T6 要求文档中单独说明；T8 场景 6a 预期为「放行」；与 §2.2 豁免规则一致，无矛盾 |
| 场景 6 与场景 7 | 场景 6：bmad-standalone-tasks 按 TASKS 文档；场景 7：直接 BUGFIX（如 bmad-bug-assistant）；两者区分清晰，无重叠矛盾 |

**裁定**：未发现矛盾。

---

### 3.4 依赖图与任务描述一致性

**批判审计员**：§4 依赖图与各任务「依赖」段落是否一致。

| 依赖关系 | 图中 | 任务描述 | 一致性 |
|----------|------|----------|--------|
| T1→T2 | 可选* | T2：T1（可选） | ✓ |
| T1→T4 | 有 | T4：T1 | ✓ |
| T1→T5 | 有 | T5：T1 | ✓ |
| T2→T6 | 有 | T6：T2, T3 | ✓ |
| T3→T6 | 有 | T6：T2, T3 | ✓ |
| T4→T7 | 有 | T7：T4 | ✓ |
| T4→T8 | 有 | T8：T2,T3,T4,T5?,T6,T7 | ✓ |
| T5→T8 | 有（若实施） | T8 含 T5（若实施） | ✓ |
| T6→T8 | 有 | T8 | ✓ |
| T7→T8 | 有 | T8 | ✓ |

**裁定**：依赖关系一致。

---

### 3.5 批判审计员汇总结论

第 1 轮 6 项修改均已正确落实；新引入歧义、遗漏与矛盾检查均通过。依赖图与任务描述一致。

**边际保留**：T6「项目可修改」的判定细节未在文档中枚举，建议在实施 T6 时于验收记录中简要注明判定依据（如：文件可写、非只读、非外部覆盖）。不作为本轮不通过项。

---

## §4 最终结论

### 4.1 是否「完全覆盖、验证通过」

**结论：✓ 通过。**

第 1 轮 6 项修改均已正确落实，且未引入新的歧义、遗漏或矛盾。

### 4.2 落实摘要

| 序号 | 第 1 轮修改项 | 落实状态 |
|------|----------------|----------|
| 1 | T6 明确 bmad-help.csv 可修改性判定与回退 | ✓ 已落实 |
| 2 | §4 依赖图 T1→T2 标注为可选，增加图注 | ✓ 已落实 |
| 3 | T2/T6 补充 Greenfield story docs path；T8 增加 6a、7 场景 | ✓ 已落实 |
| 4 | T4 验收标准增加「主 Agent 前置检查」 | ✓ 已落实 |
| 5 | T2、T4、T6 显式引用 Challenger Conditions 与 GAP-SPG-002 | ✓ 已落实 |
| 6 | T8 增加场景 7、6a，BMM 触发方式说明 | ✓ 已落实 |

### 4.3 收敛要求

按审计要求：「若通过，仍需第 3 轮复验（连续 3 轮无 gap 方可收敛）」。

- **本轮**：完全覆盖、验证通过，无新 gap
- **下一轮**：进行第 3 轮审计（round3）；若第 3 轮仍无 gap，则满足「连续 3 轮无 gap」，可收敛

### 4.4 实施建议

进入第 3 轮复验前，无需对 TASKS 文档再作修改。实施 T6 时，建议在验收记录中注明 bmad-help.csv「可修改/不可修改」的判定依据，以便可追溯。

---

*本报告由 audit-prompts §5 风格审计产出，批判审计员裁定占比 >50%。*
