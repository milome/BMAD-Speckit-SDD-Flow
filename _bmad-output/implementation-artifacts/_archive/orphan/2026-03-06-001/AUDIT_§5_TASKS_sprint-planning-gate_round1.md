# AUDIT §5：TASKS_sprint-planning-gate 第 1 轮审计报告

**被审计文档**：`_bmad-output/implementation-artifacts/_orphan/TASKS_sprint-planning-gate.md`  
**产出日期**：2026-03-04  
**审计依据**：audit-prompts §5 精神（逐条检查、严苛验证、明确结论）

---

## §1 审计依据与范围

### 1.1 审计依据

| 依据 | 内容 |
|------|------|
| audit-prompts §5 精神 | 逐条检查、严苛验证、明确结论；禁止模糊表述 |
| 需求来源 | TASKS §1–§2：5 个实施入口、sprint-planning 前置目标、策略 A–F 共识、豁免规则 |
| 批判审计员占比 | 报告 §3 批判审计员裁定须占篇幅 >50% |

### 1.2 审计范围

- **覆盖文档**：TASKS_sprint-planning-gate.md 全文（§1 背景、§2 共识方案、§3 任务列表 T1–T8、§4 依赖关系、Challenger Final Review）
- **审计项**：覆盖完整性、任务可操作性、依赖正确性、豁免与边界、Challenger 终审、误伤与漏网

---

## §2 逐项核查

### 2.1 审计项 1：覆盖完整性

**核查内容**：5 个入口及策略 A–F 是否被 TASKS 完全覆盖。

| 入口 | 策略 | 对应任务 | 验证 |
|------|------|----------|------|
| create-story | A | T2、T6 | T2 收紧缺失分支；T6 文档更新 |
| dev-story | B | T3、T6 | T3 移除 Non-sprint discovery；T6 文档 |
| bmad-story-assistant | C | T4、T7 | T4 前置检查；T7 SKILL 文档 |
| speckit.implement | §1.2 不适用 | T8 场景 5 | 回归验证「不受影响」 |
| bmad-standalone-tasks | §1.2 不适用 | T8 场景 6 | 回归验证「不受影响」 |
| check-prerequisites | D（有条件） | T5 | 可选，-RequireSprintStatus |
| 统一脚本 | E | T1 | check-sprint-ready.ps1 |
| 规则与文档 | F | T6、T7 | 相关 SKILL、commands、README |

**结果**：5 个入口均已覆盖；策略 A、B、C、E、F 有对应任务；策略 D 有 T5（可选）。✓

---

### 2.2 审计项 2：任务可操作性

**核查内容**：T1–T8 每项是否有明确、可验收的验收标准；是否存在「酌情」「待定」「后续」等模糊表述。

| 任务 | 验收标准数量 | 模糊表述检查 | 问题 |
|------|--------------|--------------|------|
| T1 | 4 条 + 验证命令 | 无 | 「或等价」出现在路径描述，可接受 |
| T2 | 4 条 + 验证 | 无 | ✓ |
| T3 | 4 条 + 验证 | 无 | ✓ |
| T4 | 5 条 + 验证 | 无 | 「可按现有逻辑执行」为边界说明，非模糊 |
| T5 | 4 条 + 验证 | 无 | ✓ |
| T6 | 2 条 + 验证 | 「若可编辑」 | 见 §3 |
| T7 | 3 条 + 验证 | 无 | ✓ |
| T8 | 6 场景 | 无 | ✓ |

---

### 2.3 审计项 3：依赖正确性

**核查内容**：§4 依赖图与任务描述的依赖是否一致；是否存在循环依赖或遗漏。

**§4 依赖图**：
```
T1 ──┬── T2, T4, T5
T2 ──┬── T6, T8
T3 ──┬── T6, T8
T4 ──┬── T7, T8
T5 ── T8
T6 ── T8
T7 ── T8
```

**任务描述中的依赖**：
- T1：无
- T2：T1（可选）
- T3：无
- T4：T1
- T5：T1
- T6：T2, T3
- T7：T4
- T8：T2, T3, T4, T5?, T6, T7

**比对**：
- T6 依赖 T2、T3 ✓
- T7 依赖 T4 ✓
- T8 依赖 T2、T3、T4、T5（若实施）、T6、T7 ✓
- **潜在不一致**：T2 写「T1（可选复用）」，图中 T1→T2 为硬依赖；若 T2 不调用 check-sprint-ready 而仅检查文件存在性，则 T2 可不依赖 T1。图中未区分「可选」关系。

---

### 2.4 审计项 4：豁免与边界

**核查内容**：§2.2 豁免规则是否与任务实现一致；是否有矛盾或漏网。

| 豁免规则 | 任务实现一致性 |
|----------|----------------|
| Standalone：speckit、bmad-standalone-tasks、BUGFIX 不施加门控 | T8 场景 5、6 验证「不受影响」✓ |
| 显式 story_path 放行 | T3 仅接受 (a) 显式 story_path 或 (b) 选项 3 后路径 ✓ |
| 强制继续：用户显式确认 | T2、T4 均要求「继续」「force」等显式确认 ✓ |
| Greenfield：提供 story docs path 路径保留 | Challenger GAP-SPG-002 指出未细化；T6 未要求单独说明 ⚠️ |

---

### 2.5 审计项 5：Challenger 终审

**核查内容**：Conditions 与 Deferred Gaps 是否被任务列表妥善处理或记录。

| 项目 | 处理情况 |
|------|----------|
| Condition 1：T2、T3 显式确认 wording（继续、force、bypass） | T2 验收标准已列出 `继续`、`force` ✓ |
| Condition 2：T4 集成方式（主 Agent 前置 vs 子任务内部） | T4 未明确；Challenger 建议主 Agent 前置 ⚠️ |
| Condition 3：T5 可选，可延后 | T5 已标注可选 ✓ |
| GAP-SPG-001：跨 worktree 路径 | 列入 Deferred，建议后续改进 ✓ |
| GAP-SPG-002：greenfield story docs path | 建议 T6 单独说明；T6 未补充 ⚠️ |

---

### 2.6 审计项 6：误伤与漏网

**核查内容**：speckit.implement、bmad-standalone-tasks 是否被误伤；是否遗漏应覆盖的入口或场景。

- **误伤检查**：§1.2 明确不适用；T8 场景 5、6 验证不受影响 ✓
- **漏网检查**：直接 BUGFIX 实施（§1.2 提及）未在 T8 回归场景中显式列出；T8 场景 6 为 bmad-standalone-tasks，通常含 BUGFIX，但「直接 BUGFIX」作为独立入口未单独验证 ⚠️

---

## §3 批判审计员裁定（占比 >50%）

### 3.1 覆盖完整性与策略映射

**批判审计员**：5 个入口的「行为」与「策略」映射存在隐含假设。create-story 和 dev-story 的行为来自 BMM 工作流，而 T2、T3 修改的是 `instructions.xml`。**质疑**：BMM 工作流是否唯一通过 instructions.xml 驱动？若存在其他入口（如直接调用 workflow.yaml 的脚本），instructions.xml 的修改可能无法完全覆盖 create-story、dev-story 的实际执行路径。

**证据请求**：实施前需确认 `_bmad/bmm/workflows/4-implementation/create-story/` 与 `dev-story/` 目录下，instructions.xml 是否为唯一或主控的流程定义；workflow.yaml 如何引用 instructions。

**裁定**：在当前文档范围内，T2、T3 针对 instructions.xml 的修改与 §1 表格中「create-story」「dev-story」的 BMM 入口一致。若项目存在多入口调用，应在 T8 回归中增加「通过 BMM 命令触发」的显式场景。

---

### 3.2 任务可操作性：T6「若可编辑」歧义

**批判审计员**：T6 验收标准涉及 `_bmad/_config/bmad-help.csv` 中 create-story、dev-story 的 description，「若可编辑」属于模糊表述。**质疑**：何为「可编辑」？若 CSV 为只读或由 BMAD 安装时覆盖，则实施者可能误判为「不可编辑」而跳过，导致文档门控信息未写入 help 系统。

**证据请求**：bmad-help.csv 在本项目中的角色——是否由 BMAD 核心提供、是否允许项目覆盖。当前项目存在 `_bmad/_config/bmad-help.csv`（由 grep 结果可知），说明该文件可被项目访问。

**裁定**：**存在模糊表述**。建议 T6 修改为：「若 `_bmad/_config/bmad-help.csv` 存在且项目可修改，则在其 Create Story、Dev Story 对应行的 description 中补充 sprint-planning 前置说明；若不存在或不可修改，则仅在 commands 文档中补充，并在验收中注明。」

---

### 3.3 依赖图：T2 与 T1 的「可选」关系

**批判审计员**：T2 描述写「T1（可选复用 check-sprint-ready；或直接在 instructions 中检查文件存在性）」，但 §4 依赖图将 T1→T2 画为实线，未标注可选。**质疑**：若实施者按图理解，会认为 T2 必须等待 T1 完成；若 T2 选择「直接检查文件存在性」，则可不依赖 T1，此时依赖图会产生误导。

**裁定**：**建议修正**。在 §4 依赖图中将 T1→T2 标注为「可选」或虚线，或在图注中说明「T2 可独立于 T1 实现，若复用 check-sprint-ready 则依赖 T1」。

---

### 3.4 豁免规则与 Greenfield 路径漏网

**批判审计员**：§2.2 豁免规则中「Greenfield 项目：create-story 的『提供 story docs path』路径保留，作为合法入口」与 T2 的验收标准存在潜在冲突。**质疑**：T2 要求在「sprint status file does NOT exist」且「user provides epic-story number」时增加门控。但 Greenfield 场景下，用户可能提供的是「story docs path」而非「epic-story number」。若 instructions.xml 中「story docs path」与「epic-story number」走不同分支，则 Greenfield 路径可能未被 T2 覆盖，也未在 T2 验收中显式验证。

**证据请求**：create-story instructions.xml 中是否存在「提供 story docs path」的独立分支；该分支在 sprint-status 缺失时的行为是否已在 T2 中考虑。

**裁定**：**存在漏网风险**。GAP-SPG-002 已指出「create-story 的『提供 story docs path』路径与 sprint-planning 的关系未细化」。T2 任务描述未明确区分「epic-story 编号」与「story docs path」两路径；T8 回归场景也未单独覆盖 Greenfield「story docs path」路径。建议 T2 补充：若存在「story docs path」分支，需在验收中说明该分支在 sprint-status 缺失时的行为（放行 / 提示 / 门控）。

---

### 3.5 T4 集成方式未明确

**批判审计员**：Challenger Condition 2 要求明确 T4 在 bmad-story-assistant 中的集成方式——主 Agent 发起子任务前执行 check-sprint-ready，还是子任务内部检查。**质疑**：T4 验收标准仅写「在发起 Create Story 子任务前检查 sprint-status 是否存在」，未指定检查动作的执行主体。若主 Agent 不调用 check-sprint-ready 而依赖子任务内部检查，则子任务 prompt 需增加检查逻辑，与「主 Agent 前置检查」的架构建议不一致。

**裁定**：**需补充**。T4 验收标准应增加一条：「检查动作由主 Agent 在发起 Create Story 子任务之前执行；可调用 check-sprint-ready 或等价逻辑；子任务 prompt 可附带『sprint-status 已确认』标志以简化子任务逻辑。」否则实施时会产生歧义。

---

### 3.6 Conditions 与 Deferred Gaps 的任务映射

**批判审计员**：Challenger 建议「T2–T4 实施时优先澄清上述 Conditions」；GAP-SPG-002 建议「在 T6 文档中单独说明」greenfield 路径。**质疑**：Conditions 与 GAP 的「建议」未被纳入任务验收标准。实施者可能认为这些是「可选建议」而忽略，导致终审条件在实施阶段未被满足。

**裁定**：**需显式映射**。建议在 T2、T4 的验收标准或「实施注意」中增加对 Challenger Conditions 的引用；在 T6 中增加验收项：「若 greenfield『story docs path』路径存在，在文档中单独说明其与 sprint-planning 的关系。」

---

### 3.7 直接 BUGFIX 实施入口的回归覆盖

**批判审计员**：§1.2 将「直接 BUGFIX 实施」列为不适用本门控的入口之一，但 T8 场景 6 仅覆盖「bmad-standalone-tasks 按 TASKS 文档实施」。**质疑**：bmad-standalone-tasks 执行的是 TASKS/BUGFIX 文档，而「直接 BUGFIX 实施」可能指用户通过 bmad-bug-assistant 或其它流程直接执行 BUGFIX，不经过 standalone-tasks 技能。两者是否等价？若不等价，则「直接 BUGFIX」入口未被 T8 显式验证。

**裁定**：**存在漏网可能**。若「直接 BUGFIX 实施」与「bmad-standalone-tasks 按 BUGFIX 文档」为同一流程，则场景 6 可覆盖；若为不同流程，建议 T8 增加场景 7：「直接 BUGFIX 实施（如通过 bmad-bug-assistant）→ 不受影响」。

---

### 3.8 sprint-status 路径一致性

**批判审计员**：T1 验收标准写 `_bmad-output/implementation-artifacts/sprint-status.yaml`，且「项目根可由 -RepoRoot 或环境推断」。**质疑**：sprint-status 的实际路径在不同项目中可能不同（如 implementation-artifacts 子目录结构）；GAP-SPG-001 指出跨 worktree 场景下路径可能不同。T1 是否应支持可配置路径？当前验收标准将路径写死，可能限制后续跨 worktree 扩展。

**裁定**：GAP-SPG-001 已列入 Deferred，当前轮次不强制要求。T1 路径写死为「先实现再扩展」的合理选择。**通过**，但建议在 T1 文档说明中注明「路径可通过后续改进支持 -SprintStatusPath 参数」。

---

### 3.9 批判审计员汇总结论

| 序号 | 问题类型 | 严重程度 | 修改建议 |
|------|----------|----------|----------|
| 1 | T6「若可编辑」模糊 | 中 | 明确 bmad-help.csv 可修改性判定与回退 |
| 2 | §4 依赖图 T1→T2 未标可选 | 低 | 图或图注中标注可选 |
| 3 | Greenfield story docs path 未覆盖 | 中 | T2/T6 补充；T8 增加场景 |
| 4 | T4 集成方式未明确 | 中 | T4 验收标准增加「主 Agent 前置」 |
| 5 | Conditions/GAP 未映射到任务 | 中 | T2、T4、T6 引用 Challenger 建议 |
| 6 | 直接 BUGFIX 回归场景可能漏网 | 低 | 澄清与场景 6 关系或增加场景 7 |

---

## §4 误伤与漏网检查

### 4.1 误伤检查

| 入口 | 是否施加门控 | 任务影响 | 结论 |
|------|--------------|----------|------|
| speckit.implement | 否 | T8 场景 5 验证不受影响 | ✓ 无误伤 |
| bmad-standalone-tasks | 否 | T8 场景 6 验证不受影响 | ✓ 无误伤 |
| 直接 BUGFIX | 否 | 未单独验证 | 见 §3.7 |

### 4.2 漏网检查

| 潜在漏网 | 说明 | 结论 |
|----------|------|------|
| Greenfield story docs path | §2.2 豁免但 T2/T8 未显式覆盖 | 漏网 |
| 直接 BUGFIX 实施 | §1.2 不适用但 T8 无专门场景 | 待澄清 |
| BMM 多入口 | instructions.xml 外是否还有其他入口 | 建议 T8 注明通过 BMM 命令触发 |

---

## §5 最终结论

### 5.1 是否「完全覆盖、验证通过」

**结论：未通过。**

### 5.2 未通过项与修改建议

1. **T6 模糊表述**：将「若可编辑」明确为可判定、可回退的验收标准。
2. **§4 依赖图**：T1→T2 标注为可选，或增加图注说明。
3. **Greenfield 路径**：T2 或 T6 补充对「story docs path」分支的说明；T8 增加 greenfield 场景（若该路径存在）。
4. **T4 集成方式**：验收标准中明确「主 Agent 前置检查」。
5. **Challenger 映射**：T2、T4、T6 显式引用 Conditions 与 GAP-SPG-002 的建议。
6. **直接 BUGFIX**：澄清与 bmad-standalone-tasks 的关系；若为不同流程，T8 增加场景 7。

### 5.3 迭代建议

完成上述修改后，进行第 2 轮审计（round2），直至连续 3 轮「完全覆盖、验证通过」且无新 gap 方可收敛。

---

*本报告由 audit-prompts §5 风格审计产出，批判审计员裁定占比 >50%。*
