# audit-prompts §5 精神：DEBATE_gap收敛机制_质量效率平衡 改进方案审计报告（第 1 轮）

**审计对象**：`_bmad-output/implementation-artifacts/_orphan/DEBATE_gap收敛机制_质量效率平衡_100轮.md`  
**审计范围**：§1 问题与背景、§2 共识与争议、§3 推荐方案、§4 分阶段实施建议、§5 最终任务列表（GAP-CONV-01～12）  
**审计依据**：audit-prompts.md §5 适配（改进方案文档审计）、bmad-standalone-tasks 可实施化要求  
**日期**：2026-03-06

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 一、逐项验证结果

### 1. 方案完整性（§1～§4）

| 检查项 | 要求 | 验证结果 |
|--------|------|----------|
| §1 问题与背景 | 覆盖问题、共识、分级策略、实施阶段 | ✅ §1.1 描述质量不均、标准不一、效率担忧；§1.2 覆盖 party-mode、bmad-standalone-tasks、audit-prompts、bmad-story-assistant |
| §2 共识与争议 | 6 条共识、争议已收敛 | ✅ 2.1 六条共识；2.2 争议表已给出结论 |
| §3 推荐方案 | strict/standard/simple 定义明确 | ✅ 表 3.1 定义各审计类型严格度、批判审计员、收敛条件 |
| §4 分阶段实施 | Phase 1～4 与任务对应 | ⚠️ Phase 4 第 11 点「3 轮进行中用户提示」无对应 §5 任务 |

### 2. 任务列表覆盖度（§5 vs §4）

| Phase | §4 内容 | §5 对应任务 | 覆盖 |
|-------|---------|-------------|------|
| Phase 1 | 新建 appendix、更新 audit-prompts §1–§5、新建 audit-post-impl-rules | GAP-CONV-01, 02, 03 | ✅ |
| Phase 2 | bmad-story 阶段四/二、speckit §5.2/§1.2–§4.2、bmad-standalone 引用 | GAP-CONV-04～08 | ✅ |
| Phase 3 | 配置、scoring/progress 记录、文档化 | GAP-CONV-09, 10, 11 | ⚠️ |
| Phase 4 | 报告格式校验、3 轮进行中用户提示 | GAP-CONV-12 | ❌ 仅覆盖第 10 项；第 11 项「3 轮进行中用户提示」无任务 |

### 3. 任务可落地性（验收标准、路径、引用）

| ID | 验收标准 | 路径/引用 | 问题 |
|----|----------|------------|------|
| GAP-CONV-01 | 文件存在；内容符合约定 | 「或等价路径」模糊；Phase 1 与辩论中路径不一（`_bmad/references/` vs speckit-workflow references） | ⚠️ 路径未定 |
| GAP-CONV-02 | `rg "批判审计员\|critical-auditor" audit-prompts.md` 有匹配 | 验收命令 | ❌ rg 正则中 `\|` 表示字面 `|`，会匹配「批判审计员\|critical-auditor」字面串，而非 alternation；正确应为 `批判审计员|critical-auditor` |
| GAP-CONV-03 | 文件存在；被三处引用 | 路径未指定；`_bmad/references/` 在项目中不存在 | ⚠️ 路径未定；引用目标未列路径 |
| GAP-CONV-04～08 | 描述含关键词 | 技能路径为全局 `~/.cursor/skills/`，项目内可能无对应文件 | 需明确技能所在位置 |
| GAP-CONV-09 | 可检索到明确说明 | 目标文档「bmad-story-assistant 或新建 FAQ」二选一未定 | ⚠️ 目标未闭环 |
| GAP-CONV-10 | 配置生效；simple 项目级不可设 | 验收方式未说明 | ⚠️ 如何验证「项目级不可设」未定义 |
| GAP-CONV-11 | **可选实施** | 与可落地性要求冲突 | ❌ 占位/未闭环 |
| GAP-CONV-12 | 校验脚本或主 Agent 逻辑 | 未指定实现位置 | ⚠️ 可操作但落点模糊 |

### 4. 无占位/模糊

| 发现 | 位置 |
|------|------|
| 「或等价路径」 | GAP-CONV-01 |
| 「可选实施」 | GAP-CONV-11 验收 |
| 「bmad-story-assistant 或新建 FAQ」 | GAP-CONV-09 |

### 5. 路径与引用验证

| 路径/引用 | 项目内实际 | 结论 |
|-----------|------------|------|
| audit-prompts.md | `skills/speckit-workflow/references/audit-prompts.md` 存在 | ✅ |
| audit-prompts-critical-auditor-appendix | 不存在（待建） | 路径未定 |
| audit-post-impl-rules | 不存在（待建）；`_bmad/references/` 不存在 | 路径未定 |
| code-reviewer-config | `.cursor/agents/code-reviewer-config.yaml` 存在；引用 audit-prompts-code.md 等 | 与 audit-prompts §1–§5 关系未在任务中覆盖 |

---

## 二、批判审计员结论（强制，占比 >70%）

### 2.1 speckit batch 间审计（GAP）

**发现**：辩论轮 92–93 明确约定「batch 间审计可用 standard；仅最后总审计 strict」。speckit-workflow SKILL.md 第 262–287 行定义任务分批执行机制，每批执行完毕后进行 code-review 审计。当前 §4、§5 未区分：

- **batch 间审计**（中间检查点）→ standard
- **最后总审计**（§5.2 执行阶段结束）→ strict

GAP-CONV-06 仅写「§5.2 改为 strict」，未说明「batch 间审计保持 standard、仅最终 §5.2 为 strict」。若将 §5.2 统一改为 strict，则每批审计均需 3 轮无 gap，与辩论共识矛盾。

**修改建议**：GAP-CONV-06 拆为或补充子任务：明确 batch 间审计 = standard；仅全部 tasks 执行完毕后的最终 §5.2 审计 = strict。

---

### 2.2 code-reviewer-config 与 audit-prompts-* 覆盖（GAP）

**发现**：code-reviewer-config.yaml 引用 `audit-prompts-code.md`、`audit-prompts-prd.md`、`audit-prompts-arch.md`、`audit-prompts-pr.md`。辩论轮 52–54 明确「若项目有独立 prd/arch 审计文件，也需注入批判审计员」「被所有 audit-prompts* 引用」。

GAP-CONV-02 仅要求「更新 audit-prompts.md §1–§5」。未涵盖：

- audit-prompts-code.md（code 模式对应 §5）
- audit-prompts-prd.md、audit-prompts-arch.md、audit-prompts-pr.md

若仅改 audit-prompts.md，code-reviewer 在 code/prd/arch/pr 模式下使用的模板无批判审计员要求，改进方案不完整。

**修改建议**：GAP-CONV-02 扩展为「audit-prompts.md §1–§5 及 audit-prompts-code/prd/arch/pr.md（若存在）均增加批判审计员引用」，或新增任务覆盖上述文件。

---

### 2.3 GAP-CONV-02 验收命令 rg 模式（GAP）

**发现**：验收命令为 `rg "批判审计员\|critical-auditor" audit-prompts.md`。在 ripgrep 正则中，`|` 为 alternation，`\|` 为字面 `|`。因此该模式匹配的是字面串 `批判审计员|critical-auditor`，而非「批判审计员」或「critical-auditor」。实施后若 audit-prompts 仅含「批判审计员」一词，该命令可能无匹配，导致误判未通过。

**修改建议**：验收命令改为 `rg "批判审计员|critical-auditor" audit-prompts.md`（无反斜杠）。若考虑 PowerShell 转义，可写为 `rg '批判审计员|critical-auditor' audit-prompts.md`（单引号避免 shell 转义）。

---

### 2.4 audit-post-impl-rules 与 audit-prompts 引用关系（GAP）

**发现**：GAP-CONV-03 要求新建 audit-post-impl-rules.md 并被 bmad-standalone-tasks、bmad-story、speckit 引用。但未明确：

1. audit-post-impl-rules 与 audit-prompts §5 的关系：是补充、替换还是被 §5 引用？
2. 当前 audit-prompts §5 为执行阶段审计提示词；audit-post-impl-rules 定义「3 轮无 gap、批判审计员 >50%」流程规则。二者应为互补，但任务未描述如何衔接。

bmad-standalone-tasks 已内置 3 轮无 gap 逻辑，引用 audit-prompts §5。补充 audit-post-impl-rules 后，三处 skill 应引用「同一规则源」，避免 drift。任务未说明 audit-post-impl-rules 的章节结构及被引用方式（全文引用 vs 章节引用）。

**修改建议**：GAP-CONV-03 验收增补「文档含与 audit-prompts §5 的引用关系说明」；或新建 GAP-CONV-03b 要求在各 skill 中显式引用 audit-post-impl-rules 的路径与章节。

---

### 2.5 路径与目录失效（GAP）

**发现**：辩论中多次提到 `_bmad/references/audit-post-impl-rules.md`、`_bmad/references/audit-critical-auditor-appendix.md`。项目内 `_bmad` 下无 `references` 子目录（glob 检索 `_bmad/**/references/*.md` 返回 0）。若按该路径实施，需先创建目录，任务未写。

**修改建议**：GAP-CONV-01、03 明确路径。建议统一为 `skills/speckit-workflow/references/`（与现有 audit-prompts 同目录），或新建 `_bmad/references/` 并在任务中注明「若目录不存在则创建」。

---

### 2.6 simple 项目级禁止的可验证性（GAP）

**发现**：辩论 85–86、GAP-CONV-10 要求「simple 仅 CLI 可选；项目 config 不允许 audit_convergence: simple」。验收写「simple 项目级不可设」，但未说明验证方式：

- 项目 config 格式（如 `.speckit/config.yaml`）是否定义 schema 禁止 simple？
- 是否有校验脚本在检测到项目级 simple 时报错？
- 还是仅文档化「不鼓励」，无强制校验？

**修改建议**：GAP-CONV-10 验收增补可执行验证方式，例如「项目 config 中若存在 `audit_convergence: simple` 则 CI 或校验脚本报错」，或「文档明确禁止且 skill 解析 config 时拒绝 simple」。

---

### 2.7 GAP-CONV-11「可选实施」与 bmad-standalone-tasks 对齐（GAP）

**发现**：GAP-CONV-11 验收写「可选实施」，与 audit-prompts §5「可落地实施」及 bmad-standalone-tasks「任务须有明确验收」冲突。若为可选，应移至「Deferred」或 P2，并在 §5 中标注「可选，不阻断收敛」；否则应给出明确验收标准（如 parseAndWriteScore 增加 audit_mode 参数并写入 record）。

**修改建议**：二选一：(a) 将 GAP-CONV-11 明确标为可选，验收改为「若实施则 parseAndWriteScore 或 progress 可记录 audit_mode」；或 (b) 若为 P1 必做，则删除「可选实施」，给出具体验收命令/检查点。

---

### 2.8 Phase 4 第 11 点「3 轮进行中用户提示」漏任务（GAP）

**发现**：§4 Phase 4 列两项：10. 审计报告格式校验；11. 3 轮进行中用户提示「第 N 轮审计通过，继续验证…」。§5 仅 GAP-CONV-12 对应第 10 项。第 11 项无对应任务，实施时易遗漏。

**修改建议**：新增 GAP-CONV-13（或合并入 GAP-CONV-04/06）：「主 Agent 在发起第 2、3 轮审计前输出『第 N 轮审计通过，继续验证…』」，验收为「bmad-story、speckit、bmad-standalone-tasks 审计流程描述中含该提示要求」。

---

### 2.9 行号/路径失效与 appendix 引用格式

**发现**：GAP-CONV-02 要求 audit-prompts 各段末尾增加「输出格式见 [appendix]」。未指定 appendix 的引用格式：Markdown 链接路径、相对路径、还是占位符？若 appendix 与 audit-prompts 同目录，应写 `[批判审计员格式](audit-prompts-critical-auditor-appendix.md)` 等可解析形式。

**修改建议**：GAP-CONV-01 或 02 的验收中增补「appendix 引用路径可解析」，避免实施时使用死链接或占位符。

---

### 2.10 批判审计员结论汇总

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | speckit batch 间 vs 最终审计未区分 strict/standard | 高 |
| 2 | audit-prompts-code/prd/arch/pr 未纳入 GAP-CONV-02 | 高 |
| 3 | GAP-CONV-02 rg 验收命令 `\|` 导致匹配错误 | 高 |
| 4 | audit-post-impl-rules 与 audit-prompts 引用关系未闭环 | 中 |
| 5 | `_bmad/references/` 路径不存在，任务未说明 | 中 |
| 6 | simple 项目级禁止的验证方式未定义 | 中 |
| 7 | GAP-CONV-11「可选实施」与可落地冲突 | 中 |
| 8 | Phase 4 第 11 点无对应任务 | 中 |
| 9 | appendix 引用格式未指定 | 低 |

**本轮结论**：**本轮存在 gap**，不计数。上述 9 项需在文档中修正或补充任务后，方可进入下一轮审计。

---

## 三、结论

### 3.1 审计结论

**未通过**。存在以下 gap 与修改建议：

1. **任务列表**：补充 Phase 4 第 11 点「3 轮进行中用户提示」对应任务；明确 batch 间 vs 最终 §5.2 的 strict/standard 区分。
2. **GAP-CONV-02**：修正验收命令为 `rg "批判审计员|critical-auditor"`（无 `\|`）；扩展至 audit-prompts-code/prd/arch/pr（若存在）。
3. **GAP-CONV-01、03**：明确路径（建议 `skills/speckit-workflow/references/` 或新建 `_bmad/references/` 并注明创建目录）。
4. **GAP-CONV-03**：补充 audit-post-impl-rules 与 audit-prompts §5 的引用关系说明。
5. **GAP-CONV-10**：补充 simple 项目级禁止的可验证方式。
6. **GAP-CONV-11**：删除「可选实施」或明确为 Deferred，并给出若实施时的验收标准。
7. **GAP-CONV-09**：明确目标文档（bmad-story-assistant vs 新建 FAQ）。
8. **GAP-CONV-01/02**：指定 appendix 引用格式。

### 3.2 收敛状态

**本轮存在 gap，不计数**。建议修改 DEBATE 文档 §4、§5 后，重新发起第 2 轮审计。累计 3 轮无 gap 后收敛。

---

*本报告由 code-reviewer 子代理按 audit-prompts §5 精神执行，批判审计员结论占比 >70%。*
