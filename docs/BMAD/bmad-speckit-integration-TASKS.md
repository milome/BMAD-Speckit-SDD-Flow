# BMAD-Speckit整合方案 - 实施任务列表

## 文档信息

| 项目 | 详情 |
|------|------|
| **版本** | v1.1 |
| **日期** | 2026-03-02 |
| **来源** | bmad-speckit-integration-FINAL-COMPLETE.md |
| **总工时** | 100小时（12工作日，含约5h管理/协调；各阶段工时之和95h+5h） |
| **任务总数** | 48个（前置1+阶段1~6共42+缓冲5） |
| **技能路径** | 全局skills：`C:\Users\milom\.cursor\skills\`（**GAP-042 修复**：Windows 示例路径；非 Windows 使用 `$HOME/.cursor/skills/` 或环境变量 `CURSOR_SKILLS_PATH`） |

---

## 依赖清单

| 依赖项 | 用途 | 安装方式 |
|--------|------|----------|
| pytest | 集成测试、单元测试 | `pip install pytest` |
| factory_boy | 测试数据工厂（任务6.5） | `pip install factory_boy`（**GAP-085 修复**：需兼容 post_generation，建议 factory_boy>=3.0） |
| psutil | 性能测试内存占用（任务6.4） | `pip install psutil`（**GAP-085 修复**：建议 psutil>=5.0） |

---

## 风险识别

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **权限不足** | 无法创建worktree、无法push | 前置检查：`git status`、`git remote -v`、推送权限验证；失败时明确提示用户 |
| **文件锁定** | 多进程/多worktree并发时文件被占用 | 串行模式默认；并行模式需文件范围预测无重叠；冲突时提示用户 |
| **上下文丢失** | 长时间任务或会话中断导致进度丢失 | 使用checkpoint标签、TodoWrite追踪、progress.md记录；支持/bmad-resume-story恢复 |
| **Party-Mode未强制** | 关键决策未经充分讨论 | 复杂度评估矩阵触发规则；**GAP-057 修复**：「连续C级」= 同一 Story 的 speckit 阶段（specify→plan→gaps→tasks→执行）中连续两个阶段评为 C；D级必须复盘 |

---

## 前置任务：文件结构探测

**执行时机**：阶段1开始前必须执行

**路径解析（GAP-042 修复）**：技能根路径 = `os.environ.get("CURSOR_SKILLS_PATH")` 或 `$HOME/.cursor/skills/`（Linux/macOS）或 `%USERPROFILE%\.cursor\skills\`（Windows）；文档中 `C:\Users\milom\.cursor\skills\` 为 Windows 示例，实施时替换为上述解析结果。

**操作步骤**：
1. 读取 `{SKILLS_ROOT}/speckit-workflow/SKILL.md`，记录实际章节标题和顺序（SKILLS_ROOT 见路径解析）
2. 读取 `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`，记录实际章节标题和顺序
3. 读取 `{SKILLS_ROOT}/using-git-worktrees/SKILL.md`，记录实际章节标题和顺序
4. 读取 `{SKILLS_ROOT}/pr-template-generator/SKILL.md`（GAP-027 修复：前置探测中增加 pr-template-generator 存在性检查，用于阶段5）
5. 将以下任务中的"具体位置"描述与探测结果对照，确认插入点存在

**GAP-064 修复**：若 speckit-workflow 等已重构导致「## 5. 执行 tasks.md」「### 4.2 审计闭环」等目标章节不存在，探测时记录「插入点不可用」并暂停相关任务（**GAP-078 修复**：含 1.4、1.5、1.6 等）；任务1.5 Fallback：若「## 5. 执行 tasks.md」不存在，则插入到文档末尾新建该章节。

**异常分支（GAP-001 修复）**：若任一 skill 文件不存在（如用户未安装）：
- 输出故障排查指南：检查 `{SKILLS_ROOT}` 下是否存在对应目录；若缺失，提示用户安装或从项目 `_bmad` 引用
- 暂停后续阶段，不得继续执行阶段1及以后任务
- 在探测结果中记录缺失文件清单

**产出**：`_bmad-output/planning-artifacts/skill-structure-probe-result-2026-03-02.md`，包含各skill的章节列表。**插入点候选列格式（GAP-016 修复）**：| 章节标题 | 插入点候选（行号或「标题后第一个---」）| 引用任务 |

**验收标准（GAP-031 修复；GAP-051 修复）**：
- [ ] 三个核心 skill（speckit-workflow、bmad-story-assistant、using-git-worktrees）均成功读取；pr-template-generator 存在性已检查（若不存在，仅记录「不存在」并继续，不触发异常分支）；或异常分支已执行
- [ ] 章节列表完整记录
- [ ] 任务 1.2、1.4、1.6 引用探测结果中的插入点确定具体位置

---

## 任务总览

### 按阶段分组

| 阶段 | 任务数 | 工时 | 依赖 |
|------|--------|------|------|
| 前置任务：文件结构探测 | 1个 | 1h | - |
| 阶段1：speckit-workflow修改 | 8个 | 12h | 前置任务 |
| 阶段2：bmad-story-assistant修改 | 13个 | 20h | 阶段1 |
| 阶段3：using-git-worktrees修改 | 8个 | 10h | 阶段1 |
| 阶段4：code-reviewer扩展 | 4个 | 8h | -（GAP-036：可与阶段1-3并行，但须在阶段6前完成） |
| 阶段5：PR自动化整合 | 3个 | 6h | 阶段3 |
| 阶段6：集成测试 | 7个 | 18h | 阶段2,4,5（**GAP-080 修复**：阶段2 依赖阶段1，故阶段1 为间接依赖；阶段4 可独立完成时 mock 契约需与阶段2 产出一致） |
| 缓冲 | 5个 | 21h | - |

---

## 任务 X：阶段 1–3 完成后执行 bmad-customization-backup 备份

**执行时机**：阶段 1（speckit-workflow）、阶段 2（bmad-story-assistant）、阶段 3（using-git-worktrees）修改完成后执行。

**操作步骤**：
1. 确认 `{project-root}/_bmad` 存在
2. 运行备份脚本：
   ```bash
   python {SKILLS_ROOT}/bmad-customization-backup/scripts/backup_bmad.py --project-root "{project-root}"
   ```
   Windows：`{SKILLS_ROOT}` = `%USERPROFILE%\.cursor\skills\`；或在项目根下执行（脚本以 cwd 为 project-root）
3. 备份输出至 `_bmad-output/bmad-customization-backups/YYYY-MM-DD_HH-MM-SS_bmad/`

**验收标准**：
- [ ] 备份目录已创建且包含 _bmad 完整镜像
- [ ] manifest.txt 与 BACKUP_README.md 已生成

---

## 阶段1：speckit-workflow修改（12小时）

### 任务1.1：新增快速决策指引章节

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置（GAP-017 修复）**: 在「# Speckit 开发流程完善」标题之后、**标题后第一个水平分隔线（`---`）**之前插入。若文件结构不同，以「本 skill 定义」段落之后为插入点。

**修改内容**:
```markdown
## 快速决策指引

### 何时使用本技能
- 已明确技术实现方案，需要详细执行计划
- 已有Story文档，需要转换为技术规格
- 需要TDD红绿灯模式指导开发

### 何时使用bmad-story-assistant
- 需要从Product Brief开始完整流程
- 需要PRD/Architecture深度生成
- 需要Epic/Story规划和拆分
- 不确定技术方案，需要方案选择讨论

### 两者关系
本技能是bmad-story-assistant的技术实现层嵌套流程。
当bmad-story-assistant执行到"阶段三：Dev Story实施"时，会触发本技能的完整流程。
```

**验收标准**:
- [ ] 新增章节包含在上述指定位置
- [ ] 章节包含"何时使用本技能"小节
- [ ] 章节包含"何时使用bmad-story-assistant"小节
- [ ] 章节包含"两者关系"说明

---

### 任务1.2：修改code-review调用为优先/回退策略

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置（GAP-002 修复）**: 在「§0 技能依赖：code-review 调用约定」章节内，定位「### 0.1 调用方式」小节，将该小节的调用方式表格替换为下述优先/回退策略内容。**Fallback**：若该小节不存在（speckit-workflow 已重构），则新建「### 0.1 调用方式」小节并插入优先/回退策略内容。

**修改内容**:
将原有的单一code-review调用方式修改为：

```markdown
### Code-Review调用策略

**优先策略**:
1. 检查 `.cursor/agents/code-reviewer.md` 与 `.claude/agents/code-reviewer.md`；**GAP-041 修复**：当两者并存时，优先使用 `.cursor`
2. 若存在，使用 Cursor Task调度code-reviewer进行审计
3. 提示词使用 `audit-prompts.md` 对应章节；（**GAP-070 修复**：speckit 各阶段审计用 audit-prompts.md §1–§5；PRD/Arch/PR 审计用新建的 audit-prompts-prd/arch/pr.md）

**回退策略**:
1. 若code-reviewer不可用，使用 `mcp_task` + `subagent_type: generalPurpose`
2. 将 `audit-prompts.md` 对应章节内容作为prompt传入
3. 要求子代理按审计清单逐项检查

**注意**: mcp_task的subagent_type目前仅支持generalPurpose、explore、shell，不支持code-reviewer。
```

**验收标准**:
- [ ] 原「0.1 调用方式」的调用逻辑被替换为优先/回退策略
- [ ] 新增"优先策略"小节，描述Cursor Task调度方式
- [ ] 新增"回退策略"小节，描述mcp_task调用方式
- [ ] 保留对audit-prompts.md的引用

---

### 任务1.3：新增plan阶段可选party-mode说明

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置**: 在「## 2. 执行 plan 之后（plan.md）」章节内，「### 2.2 审计闭环」小节之后插入新小节。

**修改内容**:
```markdown
### Plan阶段可选Party-Mode

当以下情况出现时，可在plan阶段启动party-mode：
1. 用户明确要求深入讨论技术方案
2. Create Story阶段未能充分解决的技术争议
3. 涉及重大架构决策（如数据库选型、服务拆分）

**启动命令**:
```
进入party-mode讨论技术方案，建议50轮
```

**角色设定**:
- Winston (架构师)
- Amelia (开发)
- Quinn (测试)
- 批判审计员 (新增，强制参与)

**收敛条件**:
1. 所有角色达成共识
2. 近3轮无新的技术gap提出
3. 辩论轮次达到最少要求（50轮）
```

**验收标准**:
- [ ] 新增小节标题为"Plan阶段可选Party-Mode"
- [ ] 包含明确的触发条件列表（至少3条）
- [ ] 包含启动命令示例
- [ ] 包含角色设定（必须包含批判审计员）
- [ ] 包含收敛条件

---

### 任务1.4：新增TDD记录格式统一说明

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置**: 在「## 5. 执行 tasks.md 中的任务（TDD 红绿灯模式）」章节内，「### 5.1 执行流程」之后插入新小节。若该章节有「### 5.2」等后续小节，则插入在 5.1 与 5.2 之间。

**修改内容**:
```markdown
### TDD红绿灯记录格式（与bmad-story-assistant统一）

**统一格式模板**:
```markdown
## Task X: 实现YYY功能

**红灯阶段（YYYY-MM-DD HH:MM）**
[TDD-RED] TX pytest tests/test_xxx.py -v => N failed
[错误信息摘要]

**绿灯阶段（YYYY-MM-DD HH:MM）**
[TDD-GREEN] TX pytest tests/test_xxx.py -v => N passed
[实现要点摘要]

**重构阶段（YYYY-MM-DD HH:MM）**
[TDD-REFACTOR] TX [重构操作描述]
[优化点摘要]

**更新ralph-method进度**
- prd.md: US-00X passes=true
- progress.md: 添加TDD记录链接
```

**必填字段**:
1. `[TDD-RED]` - 标记红灯阶段开始
2. `[TDD-GREEN]` - 标记绿灯阶段完成
3. `[TDD-REFACTOR]` - 标记重构阶段
4. `TX` - 时间戳前缀
5. 测试命令和结果
6. ralph-method进度更新

**禁止事项**:
- 跳过红灯阶段直接绿灯
- 省略重构阶段
- 不更新ralph-method进度
```

**验收标准**:
- [ ] 新增小节标题为"TDD红绿灯记录格式（与bmad-story-assistant统一）"
- [ ] 包含完整的格式模板（含代码块）
- [ ] 包含"必填字段"列表（至少6项）
- [ ] 包含"禁止事项"列表（至少3项）

---

### 任务1.5：修改流程小结增加bmad对应列

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置（GAP-018 修复）**: 查找文档中已有的「流程小结」或「阶段对应」类表格（通常在各阶段描述之后）。**若无现成表格**，则在「## 5. 执行 tasks.md」章节**末尾**新建流程小结表格，表头与任务1.5修改内容中的完整表格一致。

**修改内容**:
将原有流程小结表格从：
```markdown
| 阶段 | 产出 | 审计依据 |
|-----|------|---------|
| specify | spec.md | audit-prompts.md §1 |
| plan | plan.md | audit-prompts.md §2 |
...
```

修改为：
```markdown
| speckit阶段 | 产出 | 审计依据 | bmad对应阶段 | 说明 |
|------------|------|---------|-------------|------|
| specify | spec-E{epic}-S{story}.md | audit-prompts.md §1 | Layer 4开始 | 技术规格化Story内容；文件名必含Epic/Story序号 |
| plan | plan-E{epic}-S{story}.md | audit-prompts.md §2 | Layer 4继续 | 制定实现方案；文件名必含Epic/Story序号 |
| GAPS | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | audit-prompts.md §3 | Layer 4继续 | 识别实现差距；文件名必含Epic/Story序号 |
| tasks | tasks-E{epic}-S{story}.md | audit-prompts.md §4 | Layer 4继续 | 拆解执行任务；文件名必含Epic/Story序号 |
| 执行 | 可运行代码 | audit-prompts.md §5 | Layer 4结束 | TDD红绿灯开发 |

**文档命名规则**：产出文件名必须包含 Epic 序号、Story 序号；Epic 名称（如 feature-metrics-cache）在路径或文档元数据中体现。示例：Epic 4 Story 1 → spec-E4-S1.md、plan-E4-S1.md。
```

**验收标准**:
- [ ] 表格增加"bmad对应阶段"列
- [ ] 表格增加"说明"列
- [ ] 产出列使用 `spec-E{epic}-S{story}.md` 等格式，文件名必含 Epic/Story 序号
- [ ] 新增文档命名规则说明（含示例）
- [ ] 每一行都有明确的bmad对应阶段
- [ ] 每一行都有简要说明

---

### 任务1.6：新增任务分批执行机制

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置（GAP-003 修复）**: 在「## 4. 执行 tasks 或生成 tasks 相关 md 时（tasks.md）」章节的「### 4.2 审计闭环」之后**首先**插入本小节（任务分批执行机制）。任务1.7 紧随其后插入。

**修改内容**:
```markdown
### 任务分批执行机制

当tasks-E{epic}-S{story}.md中的任务数量超过20个时，必须分批执行：（**GAP-044 修复**：20 为经验阈值，兼顾单批可管理性与审计成本；可通过配置覆盖）

**分批规则**:
- 每批最多20个任务
- 每批执行完毕后进行code-review审计
- 审计通过后才能开始下一批

**执行流程**:
```
Batch 1: Task 1-20 → 执行 → code-review审计 → 通过
Batch 2: Task 21-40 → 执行 → code-review审计 → 通过
...
Batch N: Task ... → 执行 → code-review审计 → 通过
```

**检查点审计内容**:
1. 本批任务是否全部完成
2. 测试是否全部通过
3. 是否有遗留问题影响下一批
4. 是否需要调整后续批次计划

**异常处理**:
- 如果某批审计未通过，修复后重新审计该批
- 如果连续两批审计未通过，暂停并评估整体方案
```

**验收标准**:
- [ ] 新增小节标题为"任务分批执行机制"
- [ ] 明确分批阈值（20个任务）
- [ ] 包含执行流程图示
- [ ] 包含检查点审计内容列表（至少4项）
- [ ] 包含异常处理规则

---

### 任务1.7：新增审计质量评级说明

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置（GAP-003 修复）**: 在「## 4. 执行 tasks 或生成 tasks 相关 md 时」章节的「### 4.2 审计闭环」之后、**紧随任务1.6「任务分批执行机制」之后**插入（顺序：4.2 审计闭环 → 1.6 任务分批 → 1.7 审计质量评级）

**修改内容**:
```markdown
### 审计质量评级（A/B/C/D）

由于speckit各阶段不强制要求party-mode，通过审计质量评级补偿质量保证：

| 评级 | 含义 | 处理方式 |
|-----|------|---------|
| **A级** | 优秀，完全符合要求 | 直接进入下一阶段 |
| **B级** | 良好，minor问题 | 记录问题，**在本阶段审计闭环内完成修复**后进入下一阶段；禁止使用「后续」「待定」等模糊表述 |
| **C级** | 及格，需修改 | 必须修改后重新审计 |
| **D级** | 不及格，严重问题 | 退回上一阶段重新设计 |

**评级维度**:
1. 完整性（30%）：是否覆盖所有需求点
2. 正确性（30%）：技术方案是否正确
3. 测试验证（25%）：生产代码集成测试验证、**GAP-087 修复**：「新增代码」= 本 Story 或本批任务新增/修改的代码；新增代码覆盖率≥85%；
4. 质量（15%）：代码/文档质量是否达标

**强制升级规则**:
- 连续两个阶段评为C级，第三阶段强制进入party-mode
- 任一阶段评为D级，必须复盘并考虑回到Layer 3重新Create Story
```

**验收标准**:
- [ ] 新增小节标题为"审计质量评级（A/B/C/D）"
- [ ] 包含评级表格（4个等级）
- [ ] B级处理方式明确为「本阶段审计闭环内完成修复」，禁止「后续」「待定」等模糊表述
- [ ] 包含评级维度及权重（4个维度，含测试验证与新增代码覆盖率≥85%）
- [ ] 包含强制升级规则（至少2条）

---

### 任务1.8：新增enforcement说明

**修改路径**: `C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**具体位置**: 在「## 6. Agent 执行规则」章节的「禁止事项」列表及「必须事项」列表之后、「Ralph-Wiggum 法则」之前插入

**修改内容**:
```markdown
### Enforcement说明（禁止事项检查责任）

**各阶段禁止事项及检查责任人**:

| 阶段 | 禁止事项 | 检查责任人 | 检查方式 |
|-----|---------|-----------|---------|
| specify | 伪实现 | code-reviewer | 代码审查 |
| specify | 范围蔓延 | code-reviewer | 对比Story文档 |
| plan | 无测试计划 | code-reviewer | 检查plan-E{epic}-S{story}.md |
| plan | 过度设计 | code-reviewer | 架构合理性评估 |
| GAPS | 遗漏关键差距 | code-reviewer | 完整性检查 |
| tasks | 任务不可执行 | code-reviewer | 可行性评估 |
| 执行 | 跳过TDD红灯 | bmad-story-assistant | 检查TDD记录 |
| 执行 | 省略重构 | bmad-story-assistant | 检查TDD记录 |

**违规处理**:
1. 首次违规：警告并要求立即修正
2. 重复违规：暂停执行，返回上一阶段
3. 严重违规：记录并上报给BMad Master

**豁免条件**:
- 经party-mode讨论一致同意
- 有明确的ADR记录决策理由
- 获得批判审计员认可
```

**验收标准**:
- [ ] 新增小节标题为"Enforcement说明（禁止事项检查责任）"
- [ ] 包含禁止事项表格（至少8项）
- [ ] 包含违规处理规则（3级）
- [ ] 包含豁免条件（3条）

---

## 阶段2：bmad-story-assistant修改（20小时）

### 任务2.1：新增快速决策指引章节

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 在「# BMAD Story 助手」标题之后、「本 skill 定义」段落之前插入

**修改内容**:
```markdown
## 快速决策指引

### 五层架构概览
```
Layer 1: 产品定义层 (Product Brief → 复杂度评估 → PRD → Architecture)
Layer 2: Epic/Story规划层 (create-epics-and-stories)
Layer 3: Story开发层 (Create Story → Party-Mode → Story文档)
Layer 4: 技术实现层 (嵌套speckit-workflow: specify→plan→GAPS→tasks→TDD)
Layer 5: 收尾层 (批量Push + PR自动生成 + 强制人工审核 + 发布)
```

### 何时使用本技能
- 需要从Product Brief开始完整的产品开发流程
- 需要PRD/Architecture的深度生成和Party-Mode讨论
- 需要进行Epic/Story的规划和拆分
- 需要在Story级别进行方案选择和设计决策

### 何时使用speckit-workflow
- 已明确技术实现方案，只需要详细执行
- 已有Story文档，需要转换为技术规格和代码
- 不需要产品层面的讨论和决策

### 两者关系
本技能包含speckit-workflow作为Layer 4的嵌套流程。
当执行到"阶段三：Dev Story实施"时，会自动触发speckit-workflow的完整流程。
```

**验收标准**:
- [ ] 新增章节包含五层架构图示
- [ ] 包含"何时使用本技能"小节
- [ ] 包含"何时使用speckit-workflow"小节
- [ ] 包含"两者关系"说明

---

### 任务2.2：新增阶段零（Layer 1产品定义层）

**阶段零命名说明**（避免与展示名检查混淆）：
- **阶段零-前置**：展示名检查与自动优化（bmad-story-assistant 中已有）
- **阶段零（Layer 1）**：产品定义层（本任务新增）

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 在阶段零-前置（展示名检查）之后、现有阶段一之前插入

**修改内容**:
```markdown
## 阶段零（Layer 1）：产品定义层

在用户明确要创建新Epic或重大功能时，首先执行产品定义层。

### Step 1: Product Brief
创建或读取Product Brief文档，包含：
- 产品概述和目标
- 目标用户群体
- 核心价值和差异化
- 成功指标

### Step 2: 复杂度评估
填写三维复杂度评估问卷：
```yaml
业务复杂度 (1-5分):
  - 领域知识: [熟悉(1分)/部分新(3分)/全新(5分)]
  - 利益相关方数量: [≤2(1分)/3-5(3分)/>5(5分)]
  - 合规要求: [无(1分)/一般(3分)/严格(5分)]

技术复杂度 (1-5分):
  - 技术栈: [现有(1分)/部分新(3分)/全新(5分)]
  - 架构挑战: [无(1分)/中等(3分)/高并发大数据(5分)]
  - 集成难度: [独立(1分)/少量依赖(3分)/复杂网络(5分)]

影响范围 (1-5分):
  - [单个Story(1分)/单个模块(3分)/跨模块(4分)/全系统(5分)]
```

**聚合公式（GAP-019 修复；GAP-071 修复）**：每维度取子项**最高分**（默认保守）或**平均分**（四舍五入）；**选择条件**：默认取最高分；若用户显式选择「乐观模式」则取平均分；总分 = 业务 + 技术 + 影响，范围 3~15。

### Step 3: PRD生成
根据总分决定PRD生成方式（GAP-004 修复：边界值归属规则）：

| 总分 | PRD处理 | Architecture处理 | 说明 |
|------|---------|------------------|------|
| ≤6分（含 6） | 直接生成PRD | 直接生成 | 简单增强/bugfix |
| 7-10分（含 7、10） | 50轮Party-Mode后生成 | 可选30轮 | 中等复杂度 |
| 11-15分（含 11、15） | 80轮Party-Mode后生成 | 80轮Party-Mode | 高复杂度 |
| 15分（满分） | 80轮Party-Mode + 外部专家Review | 80轮Party-Mode + 外部专家Review | **GAP-081 修复**：总分范围 3~15，无 >15；满分 15 时触发；**GAP-038 修复**：专家来源可为项目内资深架构师或外部顾问，输出格式为「Review 意见 + 通过/有条件通过/不通过」 |

PRD必须包含：
- 详细需求列表（带ID）
- 验收标准
- 优先级排序
- 依赖关系

### Step 4: Architecture生成（如需）
当总分≥7分时，需要生成Architecture文档：
- 技术架构图
- 模块划分和接口定义
- 技术选型及Tradeoff分析（使用ADR格式）
- 安全和性能考量

Architecture Party-Mode角色（GAP-020 修复：与 Plan Party-Mode 差异说明）：
- 系统架构师、性能工程师、安全架构师、运维工程师、成本分析师、批判审计员
- Plan 阶段偏技术方案，Architecture 阶段偏架构决策，角色可复用；若项目有专门架构师可扩展

### 阶段零（Layer 1）产出
- Product Brief文档
- 复杂度评估结果
- PRD文档（含需求追溯表）
- Architecture文档（如需要）
```

**验收标准**:
- [ ] 新增"阶段零（Layer 1）：产品定义层"章节
- [ ] 包含Step 1-4的详细说明
- [ ] 包含完整的三维复杂度评估问卷
- [ ] 包含Party-Mode触发规则表格
- [ ] 包含Architecture Party-Mode角色列表
- [ ] 明确阶段零（Layer 1）产出物列表

---

### 任务2.3：新增阶段一之前（Layer 2 Epic/Story规划层）

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 在阶段零（Layer 1）之后，原阶段一（Create Story）之前

**修改内容**:
```markdown
## Layer 2 Epic/Story规划层

在执行Create Story之前，先进行Epic/Story规划。

### create-epics-and-stories

基于PRD和Architecture文档，执行以下步骤：

1. **Epic定义**
   - 确定Epic边界和范围
   - 命名规范：`feature-{domain}-{capability}`
   - 估算Epic总体工作量

2. **Story拆分**
   - 按功能模块拆分Story
   - 每个Story可独立交付
   - 命名规范：`{epic_num}.{story_num} {description}`

3. **依赖关系分析**
   - 识别Story间的依赖关系
   - 生成依赖图（文本或图形）
   - 确定执行顺序

4. **粗粒度估算**
   - 每个Story的初步工作量估算
   - 识别高风险Story
   - 标记需要Spike的Story

### 产出物

1. **Epic列表**
   ```markdown
   | Epic ID | 名称 | 描述 | 预估工时 | 优先级 |
   |---------|------|------|---------|--------|
   | 4 | feature-metrics-cache | 指标缓存优化 | 80h | P0 |
   ```

2. **Story列表（粗粒度）**
   ```markdown
   | Story ID | 所属Epic | 描述 | 依赖 | 预估工时 | 风险 |
   |----------|---------|------|------|---------|------|
   | 4.1 | 4 | 基础缓存类实现 | 无 | 8h | 低 |
   | 4.2 | 4 | TTL机制实现 | 4.1 | 12h | 中 |
   ```

3. **依赖图**
   ```
   Story 4.1 ─┐
              ├─→ Story 4.3 ─→ Story 4.5
   Story 4.2 ─┘
   ```

### 进入阶段一的条件
- Epic和Story列表已完成
- 依赖关系已明确
- 已获得用户确认
```

**验收标准**:
- [ ] 新增"Layer 2 Epic/Story规划层"章节
- [ ] 包含4个步骤的详细说明（Epic定义、Story拆分、依赖分析、粗粒度估算）
- [ ] 包含Epic列表示例表格
- [ ] 包含Story列表示例表格
- [ ] 包含依赖图示例
- [ ] 明确进入阶段一的条件

---

### 任务2.4：新增文档映射关系章节

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 阶段二（Story Audit）之后

**修改内容**:
```markdown
## 文档映射关系（与speckit-workflow）

### 文档对应矩阵

| bmad产出 | speckit产出 | 映射关系 | 阶段对应 |
|---------|------------|---------|---------|
| Product Brief | - | 源头文档 | Layer 1起点 |
| PRD | - | 需求规格 | Layer 1产出 |
| Architecture | - | 技术架构 | Layer 1产出 |
| Epic/Story列表 | - | 功能拆分 | Layer 2产出 |
| Story文档 | spec-E{epic}-S{story}.md | Story功能章节 ↔ spec功能规格章节 | Layer 3 → Layer 4 specify |
| plan + tasks（实现方案与任务列表） | plan-E{epic}-S{story}.md + tasks-E{epic}-S{story}.md | 功能清单 ↔ 任务列表 | Layer 3 → Layer 4 plan/tasks |
| BUGFIX文档 | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | **GAP-063 修复**：BUGFIX 修复项可转化为 GAPS 中的「待实现差距」条目，两者为转化关系非等同 | Layer 3 → Layer 4 GAPS |
| progress.md | TDD记录 | 执行进度 ↔ 测试记录 | Layer 4执行 → 记录 |

### 需求追溯链

**扩展映射表格式**（必须在Story文档中包含）：

| PRD需求ID | PRD需求描述 | Architecture组件 | Story | spec章节 | task | 状态 |
|----------|------------|-----------------|-------|---------|------|------|
| REQ-001 | 用户登录 | AuthService | 4.1 | §2.1 | Task 1 | 已覆盖 |
| REQ-002 | JWT刷新 | AuthService | 4.1 | §2.2 | Task 2 | 推迟 |

**追溯要求**：
1. 每个PRD需求必须映射到至少一个Story
2. 每个Architecture组件必须映射到至少一个task
3. 每个Story必须包含PRD需求追溯章节
4. 每个spec-E{epic}-S{story}.md必须包含Architecture约束章节

### 时序关系

```
Layer 1: Product Brief → PRD → Architecture
              ↓
Layer 2: create-epics-and-stories → Epic/Story列表
              ↓
Layer 3: Create Story → 产出Story文档
              ↓
Layer 4: specify → 产出spec-E{epic}-S{story}.md（技术规格化Story内容）
              ↓
         plan → 产出plan-E{epic}-S{story}.md（实现方案）
              ↓
         Story文档审计（依据包含plan-E{epic}-S{story}.md）
```

### 变更管理

当PRD或Architecture发生变更时：
1. 标记受影响的Story
2. 更新Story文档的需求追溯章节
3. 通知相关开发人员
4. 重新审计受影响的部分
```

**验收标准**:
- [ ] 新增"文档映射关系（与speckit-workflow）"章节
- [ ] 包含完整的文档对应矩阵表格（8行）
- [ ] 包含需求追溯链说明和示例表格
- [ ] 包含时序关系图示
- [ ] 包含变更管理流程（4步）

---

### 任务2.5：修改阶段三（Dev Story实施）

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 原有"阶段三：Dev Story实施"章节

**修改内容**:
将原有阶段三内容替换为：

```markdown
## 阶段三：Dev Story实施（增强版）

审计通过后，执行 **/bmad-bmm-dev-story** 等价工作流，对 Story `{epic_num}-{story_num}` 进行开发实施。

### 前置检查

在开始实施前，必须确认以下检查项：
- [ ] PRD需求追溯章节已补充（列出本Story涉及的所有PRD需求ID）
- [ ] Architecture约束已传递到Story文档（列出相关的Architecture组件和约束）
- [ ] 复杂度评估已完成（确认本Story的复杂度分数）
- [ ] Epic/Story规划层的依赖分析已确认（确认前置Story已完成）

### Dev Story实施流程

**必须嵌套执行 speckit-workflow 完整流程**，按以下顺序：

1. **specify** → 生成 spec-E{epic}-S{story}.md → code-review审计（迭代直至通过）
   - 输入：Story文档
   - 输出：spec-E{epic}-S{story}.md（技术规格，文件名必含Epic/Story序号）
   - 审计：code-review §1，必须通过A/B级

2. **plan** → 生成 plan-E{epic}-S{story}.md → code-review审计（迭代直至通过，必要时可进入party-mode 50轮）
   - 输入：spec-E{epic}-S{story}.md
   - 输出：plan-E{epic}-S{story}.md（实现方案）
   - 审计：code-review §2，必须通过A/B级
   - 可选：如有技术争议，启动50轮party-mode

3. **GAPS** → 生成 IMPLEMENTATION_GAPS-E{epic}-S{story}.md → code-review审计（迭代直至通过）
   - 输入：plan-E{epic}-S{story}.md + 现有代码
   - 输出：IMPLEMENTATION_GAPS-E{epic}-S{story}.md（实现差距）
   - 审计：code-review §3，必须通过A/B级

4. **tasks** → 生成 tasks-E{epic}-S{story}.md → code-review审计（迭代直至通过）
   - 输入：GAPS + plan
   - 输出：tasks-E{epic}-S{story}.md（执行任务列表）
   - 审计：code-review §4，必须通过A/B级
   - 注意：如任务数>20，启用分批执行机制

5. **执行** → TDD红绿灯模式（红灯→绿灯→重构）→ code-review审计（迭代直至通过）
   - 输入：tasks-E{epic}-S{story}.md
   - 输出：可运行代码 + TDD记录
   - 审计：code-review §5，必须通过A/B级
   - 要求：严格按照[TDD-RED]→[TDD-GREEN]→[TDD-REFACTOR]格式记录

### Worktree策略（修订版）

**story_count 来源（GAP-005 修复；GAP-072 修复）**：按优先级取 (1) Epic 配置 `epic.story_count`；(2) Story 列表 `len(epic.stories)`；(3) 用户输入 `--story-count N`。**冲突处理**：若 (1) 与 (2) 不同，记录警告并采用 (1)。**story_count=0 时（GAP-022 修复）**：禁止创建 worktree，提示用户先完成 Epic/Story 规划；或采用 story-level 占位策略（单 Story 占位）。

**自动检测逻辑**：
```python
if story_count <= 2:
    worktree_type = "story-level"
    path = f"{worktree_base}/{repo_name}-story-{epic_num}-{story_num}"
elif story_count >= 3:
    worktree_type = "epic-level"
    path = f"{worktree_base}/{repo_name}-feature-epic-{epic_num}"
    branch = f"story-{epic_num}-{story_num}"
```

**Story级worktree**（Story数≤2）：
- 路径：`{父目录}/{repo名}-story-{epic_num}-{story_num}`
- 每个Story独立worktree
- 完全隔离，适合强依赖或高风险Story

**Epic级worktree**（Story数≥3）：
- 路径：`{父目录}/{repo名}-feature-epic-{epic_num}`
- 在Epic worktree内创建Story分支
- 分支名：`story-{epic_num}-{story_num}`
- 减少87%上下文切换时间

**串行/并行模式切换**：
```bash
# 切换到并行模式（需满足文件范围无重叠）
/bmad-set-worktree-mode epic=4 mode=parallel

# 切换到串行模式（默认）
/bmad-set-worktree-mode epic=4 mode=serial

# 回退到Story级
/bmad-set-worktree-mode epic=4 mode=story-level
```

### 需求追溯要求

**spec-E{epic}-S{story}.md必须包含**（文件名必含Epic/Story序号）：
```markdown
## 需求追溯

| PRD需求ID | PRD需求描述 | 对应spec章节 | 实现状态 |
|----------|------------|-------------|---------|
| REQ-001 | XXX | §2.1 | 已实现 |
```

**tasks-E{epic}-S{story}.md必须包含**（文件名必含Epic/Story序号）：
```markdown
## Architecture约束

| Architecture组件 | 约束描述 | 对应task | 验证方式 |
|-----------------|---------|---------|---------|
| CacheService | 必须支持TTL | Task 2 | 单元测试 |
```

### 冲突处理和回退

**如果发现Story文档与spec/plan冲突**：
1. 尝试在speckit阶段内解决（修改spec/plan）
2. 如无法解决，回退到Create Story重新澄清
3. 如涉及重大方案变更，重新进入party-mode

**回退命令**：
```
/bmad-bmm-correct-course epic=4 story=1 reason="需求冲突"
```
```

**验收标准**:
- [ ] 阶段三标题改为"阶段三：Dev Story实施（增强版）"
- [ ] 包含"前置检查"小节（至少4个检查项）
- [ ] 包含5个步骤的详细Dev Story实施流程
- [ ] 包含Worktree策略修订版（含自动检测逻辑代码块）
- [ ] 包含串行/并行模式切换命令
- [ ] 包含需求追溯要求（spec-E{epic}-S{story}.md 和 tasks-E{epic}-S{story}.md 的必须包含内容）
- [ ] 包含冲突处理和回退机制

---

### 任务2.6：修改阶段四（实施后审计）

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 原有"阶段四：实施后审计"章节

**修改内容**:
将原有阶段四内容替换为：

```markdown
## 阶段四：实施后审计（增强版）

### 前置检查

在进行实施后审计前，必须确认：
- [ ] speckit specify阶段code-review审计已通过（§1）
- [ ] speckit plan阶段code-review审计已通过（§2）
- [ ] speckit GAPS阶段code-review审计已通过（§3）
- [ ] speckit tasks阶段code-review审计已通过（§4）
- [ ] speckit执行阶段code-review审计已通过（§5）
- [ ] TDD记录完整（包含RED/GREEN/REFACTOR三个阶段）
- [ ] ralph-method进度文件已更新

如有任何一项未通过，必须先完成该项审计。

### 综合审计

使用 `audit-prompts.md §5` 进行综合验证：

**审计维度**：
1. 需求覆盖度：是否实现了Story文档中的所有需求
2. 测试完整性：单元测试、集成测试是否充分
3. 代码质量：是否符合项目编码规范
4. 文档一致性：Story文档、spec、plan、代码是否一致
5. 可追溯性：PRD需求→Story→spec→task→代码的链路是否完整

**审计方式**：
- 优先：Cursor Task调度code-reviewer
- 回退：mcp_task generalPurpose + audit-prompts.md §5内容

### 审计结论处理

**通过（A/B级）**：
- Story标记为完成
- 提供完成选项（见下文）

**有条件通过（C级）**：
- 列出必须修复的问题
- 修复后重新审计

**不通过（D级）**：
- 列出重大问题
- 可能需要回退到Layer 3重新Create Story
- 或回退到speckit特定阶段重新执行

### 完成后选项

当Story审计通过后，提供以下选项：

**[0] 提交代码**
- 询问是否将当前改动提交到本地仓库
- 若选择是，自动调用 auto-commit-utf8 技能生成中文 commit message 并提交

**[1] 开始下一个Story**
- 在同一Epic worktree内切换到下一个Story分支
- 自动检测并处理跨Story依赖

**[2] 创建PR并等待review**
- 推送当前Story分支到远程
- 创建PR（调用pr-template-generator生成描述）
- 进入强制人工审核流程

**[3] 批量Push所有Story分支**
- 推送Epic下所有已完成的Story分支
- 为每个Story创建PR
- 进入批量人工审核流程

**[4] 保留分支稍后处理**
- 保持当前分支状态
- 允许稍后继续

### Epic完成检查

当Epic下所有Story都完成后：
1. 验证所有Story的PR都已merge到feature-epic-{num}分支
2. 执行Epic级集成测试
3. 创建Epic级别的PR（合并到main）
4. 再次进入强制人工审核
5. 清理Epic worktree（可选）；（**GAP-045 修复**：清理条件：Epic PR 已 merge 且无未决问题；保留时长：建议 7 天；恢复：从 main 重新 checkout feature-epic-{num} 分支）；（**GAP-086 修复**：由用户选择是否清理；或系统建议后用户确认）
```

**验收标准**:
- [ ] 阶段四标题改为"阶段四：实施后审计（增强版）"
- [ ] 包含"前置检查"小节（至少7个检查项）
- [ ] 包含"综合审计"小节（5个审计维度）
- [ ] 包含审计结论处理规则（通过/有条件通过/不通过）
- [ ] 包含完成后5个选项的详细说明（含 [0] 提交代码，调用 auto-commit-utf8）
- [ ] 包含Epic完成检查流程（5步）

---

### 任务2.7：修改引用与路径章节

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 在bmad-story-assistant SKILL.md中，查找「引用」「路径」「参考」或「code-reviewer」相关章节，在其后追加

**修改内容**:
在原有引用说明基础上增加：

```markdown
### speckit-workflow引用约束

当本技能执行到"阶段三：Dev Story实施"时，必须遵循以下约束：

1. **流程约束**
   - 必须按顺序执行：specify → plan → GAPS → tasks → 执行
   - 每个阶段必须通过code-review审计才能进入下一阶段
   - 严禁跳过任何阶段或审计

2. **文档约束**
   - Story文档必须包含PRD需求追溯章节
   - spec-E{epic}-S{story}.md必须引用Story文档的功能描述
   - plan-E{epic}-S{story}.md必须包含测试计划
   - tasks-E{epic}-S{story}.md必须包含Architecture组件约束

3. **TDD约束**
   - 必须使用统一的[TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR]格式
   - 必须更新ralph-method进度文件
   - 严禁跳过红灯阶段或重构阶段

4. **审计约束**
   - 优先使用Cursor Task调度code-reviewer
   - code-reviewer不可用时使用mcp_task回退
   - 所有审计必须达到A/B级才能继续

5. **Worktree约束**
   - Story数≤2使用Story级worktree
   - Story数≥3使用Epic级worktree
   - Story分支切换时必须commit/stash未提交变更

**违规处理**：
- 发现违规立即暂停执行
- 记录违规事项和原因
- 根据严重程度决定：警告/返回上一阶段/重新Create Story
```

**验收标准**:
- [ ] 新增"speckit-workflow引用约束"小节
- [ ] 包含5个约束类别（流程、文档、TDD、审计、Worktree）
- [ ] 每个约束类别至少3条具体约束
- [ ] 包含违规处理规则（3级）

---

### 任务2.8：新增回退机制说明

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 文档末尾

**修改内容**:
```markdown
## 回退机制

当在实施过程中发现重大问题，允许回退到之前的阶段。

### 回退场景和命令

**场景1：speckit阶段发现Story文档不清晰**
- 症状：specify/plan阶段反复审计不通过，原因是需求不明确
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="需求不清晰"`
- 回退目标：Layer 3 Create Story阶段
- 操作：重新进入party-mode澄清需求，更新Story文档

**场景2：发现技术方案有重大缺陷**
- 症状：plan阶段发现技术方案不可行，需要重新设计
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="技术方案缺陷"`
- 回退目标：Layer 3 Create Story阶段
- 操作：重新进入party-mode讨论技术方案

**场景3：TDD执行发现架构问题**
- 症状：执行阶段发现需要修改架构才能通过测试
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="架构问题"`
- 回退目标：speckit plan阶段
- 操作：修改plan-E{epic}-S{story}.md，必要时回到Create Story

**场景4：PRD/Architecture需要变更**
- 症状：实施过程中发现PRD或Architecture有遗漏或错误
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="PRD变更"`
- 回退目标：Layer 1产品定义层
- 操作：更新PRD/Architecture，重新评估影响范围

### 回退数据保留

回退时保留以下数据：
- 原Story文档（备份为`story-{epic}-{story}-v{N}.md`）
- 已生成的spec/plan（用于参考）
- TDD记录（如有）
- 审计历史记录

### 回退限制（GAP-006 修复：与回滚区分）

- **回退**（correct-course）：回到 Create Story/speckit 等阶段，按 **Story** 计；同一 Story 最多回退 3 次，超过需要 BMad Master 介入
- **回滚**（rollback-worktree）：worktree 从 Epic 级回到 Story 级，按 **Epic** 计；同一 Epic 最多回滚 2 次（见任务 3.6）
- **BMad Master 介入（GAP-037 修复）**：回退>3 次或回滚>2 次时，需用户或项目负责人确认；审批步骤：记录原因 → 用户确认「继续」或「终止」→ 若继续则重置计数
- 回退到 Layer 1 会重置整个 Epic 的规划
- 回退/回滚操作必须记录原因和决策过程
```

**验收标准**:
- [ ] 新增"回退机制"章节
- [ ] 包含至少4个回退场景（含症状、命令、目标、操作）
- [ ] 包含回退数据保留说明（至少4项）
- [ ] 包含回退限制（至少2条）

---

### 任务2.9：新增自检清单

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 主Agent传递规则之后

**修改内容**:
```markdown
### 主Agent发起子任务前自检清单

在发起任何子任务（mcp_task或Cursor Task）前，必须完成以下检查：

**准备阶段检查**:
- [ ] 已读取相关skill文件获取最新内容
- [ ] 已确认当前处于正确的阶段（Layer 1/2/3/4/5）
- [ ] 已准备好所有必要的上下文信息
- [ ] 已确认前一阶段已完成并通过审计

**子任务配置检查**:
- [ ] subagent_type设置正确（generalPurpose/explore/shell）
- [ ] prompt包含完整的背景信息和具体要求
- [ ] 引用了正确的audit-prompts.md章节（如适用）
- [ ] 设置了合理的超时时间

**审计相关检查**:
- [ ] 已确认code-reviewer可用性或准备了回退方案
- [ ] 已准备好audit-prompts.md对应章节内容
- [ ] 已明确审计通过标准（A/B/C/D级）
- [ ] 已规划审计失败后的处理流程

**禁止事项自查**:
- [ ] 没有直接修改生产代码（必须通过子任务）
- [ ] 没有跳过必要的审计步骤
- [ ] 没有使用模糊的指令（如"考虑一下"、"看看能不能"）
- [ ] 没有遗漏需求映射或追溯

**自检确认**：
以上所有检查项完成后，在回复中明确声明：
"自检完成，所有检查项已通过，现在发起子任务。"
```

**验收标准**:
- [ ] 新增"主Agent发起子任务前自检清单"章节
- [ ] 包含4个检查类别（准备阶段、子任务配置、审计相关、禁止事项）
- [ ] 每个类别至少4个检查项
- [ ] 包含自检确认声明模板

---

### 任务2.10：新增批判审计员角色定义

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**具体位置**: 角色配置章节（新建或在现有角色后追加）

**修改内容**:
```markdown
## 角色配置

### 批判审计员（Critical Auditor）

**角色定位**：
独立的批判性思维专家，专注于发现方案漏洞、质疑假设、挑战设计决策。
在所有Party-Mode讨论中，批判审计员必须每轮首先发言。

**核心职责**：
1. 在Layer 1 PRD Party-Mode阶段积极参与辩论（强制）
2. 在Layer 1 Architecture Party-Mode阶段积极参与辩论（强制）
3. 在Layer 3 Create Story Party-Mode阶段积极参与辩论（强制）
4. 对每个关键决策提出至少5个深度质疑
5. 记录所有未解决的gap和假设
6. 在方案未达成共识前持续挑战，不轻易妥协
7. 确保审计清单（audit-prompts.md）被严格执行

**权力与权限**：
1. **暂停权**：发现重大漏洞时，可要求暂停流程
2. **记录权**：所有质疑必须被记录并追踪
3. **复验权**：可要求对修改后的方案再次审计
4. **一票否决权**：当发现致命缺陷时，可否决方案进入下一阶段；（**GAP-060 修复**：skill 执行环境下，批判审计员行使否决权时，由 Facilitator/主 Agent 负责暂停并记录，不得进入下一阶段）

**介入阶段**：
1. **Layer 1 PRD Party-Mode**（强制）：质疑需求完整性、用户价值、市场定位
2. **Layer 1 Architecture Party-Mode**（强制）：质疑技术可行性、tradeoff合理性、过度设计
3. **Layer 3 Create Story Party-Mode**（强制）：质疑方案选择、范围界定、验收标准
4. **speckit.plan阶段**（按需）：用户明确要求或技术争议时介入
5. **审计阶段**（强化）：与code-review协同工作

**退出标准**：
1. 所有质疑都得到满意回应
2. 达到收敛条件（共识 + 近3轮无新gap）
3. 用户明确接受风险并继续
4. 记录完整的质疑清单和解决状态

**能力要求**：
1. 熟悉审计清单（audit-prompts.md）
2. 具备批判性思维和逻辑分析能力
3. 了解技术架构和实现约束
4. 有丰富的项目经验和风险识别能力

**典型质疑问题**：
- "这个需求的用户价值是什么？有数据支撑吗？"
- "这个技术方案是否过度工程化？有更简单的替代吗？"
- "这个范围界定是否清晰？边界条件考虑了吗？"
- "这个验收标准是否可测试？如何验证？"
- "未来3年的扩展性如何？技术债务会在哪里积累？"
```

**验收标准**:
- [ ] 新增"批判审计员（Critical Auditor）"角色定义
- [ ] 包含角色定位说明
- [ ] 包含7条核心职责
- [ ] 包含4项权力与权限
- [ ] 包含5个介入阶段
- [ ] 包含4条退出标准
- [ ] 包含4项能力要求
- [ ] 包含5个典型质疑问题示例

---

## 阶段3：using-git-worktrees修改（10小时）

### 任务3.1：新增Adaptive Worktree说明

**修改路径**: `C:\Users\milom\.cursor\skills\using-git-worktrees\SKILL.md`

**具体位置**: 在「## Overview」之后、「## Directory Selection Process」之前插入

**修改内容**:
```markdown
### Adaptive Worktree策略

本技能支持两种worktree粒度，根据Epic特征自动选择：

**Story级worktree**：
- 路径：`{父目录}/{repo名}-story-{epic_num}-{story_num}`
- 适用：Story数≤2的Epic
- 特点：完全隔离，适合强依赖或高风险Story

**Epic级worktree**：
- 路径：`{父目录}/{repo名}-feature-epic-{epic_num}`
- 适用：Story数≥3的Epic
- 特点：共享worktree，Story以分支形式管理
- 优势：减少87%上下文切换时间

**story_count 来源（GAP-005 修复；GAP-072 修复）**：`story_count = epic.story_count or len(epic.stories) or user_input`；若 epic.story_count 与 len(epic.stories) 均存在且不同，记录警告并采用 epic.story_count。默认 0。

**自动检测逻辑**：
```python
def determine_worktree_strategy(epic):
    story_count = epic.story_count or len(epic.stories) or 0
    
    if story_count <= 2:
        return {
            "type": "story-level",
            "path": f"{worktree_base}/{repo_name}-story-{epic.id}-{story.id}",
            "branch": f"feature-story-{epic.id}-{story.id}"
        }
    else:
        return {
            "type": "epic-level",
            "path": f"{worktree_base}/{repo_name}-feature-epic-{epic.id}",
            "branch": f"story-{epic.id}-{story.id}"
        }
```

**手动覆盖**：
用户可通过命令行参数强制指定worktree类型：
```bash
/bmad-create-worktree epic=4 story=1 type=story-level  # 强制Story级
/bmad-create-worktree epic=4 story=1 type=epic-level   # 强制Epic级
```
```

**验收标准**:
- [ ] 新增"Adaptive Worktree策略"小节
- [ ] 包含Story级和Epic级的详细说明（路径、适用、特点）
- [ ] 包含自动检测逻辑代码块
- [ ] 包含手动覆盖命令示例

---

### 任务3.2：新增Epic级worktree创建逻辑

**修改路径**: `C:\Users\milom\.cursor\skills\using-git-worktrees\SKILL.md`

**具体位置**: 在「## Safety Verification」之后、「## Creation Steps」之前插入

**修改内容**:
```markdown
### Epic级worktree创建流程

当检测到Story数≥3时，执行以下创建流程：

**步骤1：检测Epic特征（GAP-007 修复：Epic 配置 schema）**
```python
# Epic 配置路径：_bmad-output/config/epic-{epic_id}.json（与 PRD、epics 等统一放在 _bmad-output 下）
# Schema: { "epic_id": int, "story_count": int, "stories": [...], "mode": "serial"|"parallel" }
epic_info = load_epic_config(epic_id)  # 从 _bmad-output/config/epic-{epic_id}.json 读取
story_count = epic_info.story_count or len(epic_info.stories or [])
# GAP-075 修复：branches.json 为分支状态快照；epic 主配置的 stories 数组在分支 merge 后由 Phase 5 流程更新，非实时同步
existing_worktrees = list_worktrees()
```

**步骤2：检查现有worktree**
- 如果已存在Epic级worktree，跳过创建，直接使用
- 如果已存在Story级worktree，提示用户是否迁移

**步骤3：创建Epic级worktree**
```bash
# 创建Epic级worktree目录
git worktree add -b feature-epic-{epic_id} {父目录}/{repo名}-feature-epic-{epic_id}

# 验证创建成功
cd {父目录}/{repo名}-feature-epic-{epic_id}
git status
```

**步骤3.5：迁移 _bmad 定制（可选）**
- 若 `_bmad-output/bmad-customization-backups/` 存在备份，在新 worktree 中运行：
  ```bash
  python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{最新备份路径}" --project-root "{新worktree根}"
  ```
  最新备份路径：`_bmad-output/bmad-customization-backups/` 下按时间戳排序取最新目录
- 若无备份，跳过；用户可在主 worktree 完成 _bmad 修改后执行任务 X 备份，再手动迁移

**前置条件**：阶段 1–3 完成后，在主 worktree 执行任务 X（backup）

**步骤4：初始化Epic工作区**
- 安装依赖（如有package.json/requirements.txt）
- 运行初始构建验证环境正常
- 创建Story分支模板

**步骤5：记录元数据**
```json
{
  "epic_id": 4,
  "worktree_type": "epic-level",
  "path": "{父目录}/{repo名}-feature-epic-4",
  "created_at": "2026-03-02T10:00:00Z",
  "stories": [],
  "mode": "serial"
}
```

**创建后检查**：
- [ ] worktree目录存在且非空
- [ ] git状态正常，分支正确
- [ ] 可以正常执行git命令
- [ ] 元数据文件已创建
```

**验收标准**:
- [ ] 新增"Epic级worktree创建流程"小节
- [ ] 包含6个步骤的详细说明（含步骤3.5：迁移 _bmad 定制）
- [ ] 包含代码块示例（Python和bash）
- [ ] 包含创建后检查清单（至少4项）

---

### 任务3.3：新增Story分支管理

**修改路径**: `C:\Users\milom\.cursor\skills\using-git-worktrees\SKILL.md`

**具体位置**: 在「## Creation Steps」的「### 5. Report Location」之后、「## Quick Reference」之前插入

**修改内容**:
```markdown
### Story分支管理（Epic级worktree内）

在Epic级worktree中，每个Story作为一个分支管理。

**创建Story分支**：
```bash
# 进入Epic worktree
cd {父目录}/{repo名}-feature-epic-4

# 确保基于最新的feature-epic-4分支
git checkout feature-epic-4
git pull origin feature-epic-4

# 创建Story分支
git checkout -b story-4-1

# 推送分支到远程（可选）
git push -u origin story-4-1
```

**切换Story分支**：
```bash
# 检查当前状态（必须clean才能切换）
git status

# 如果有未提交变更，先stash或commit
if has_uncommitted_changes():
    print("警告：有未提交变更，请先commit或stash")
    return

# 切换到另一个Story分支
git checkout story-4-2

# 如果需要基于其他Story的最新代码
# 先merge那个Story到feature-epic-4，再rebase
git rebase feature-epic-4
```

**合并Story分支**：
```bash
# Story开发完成，合并到feature-epic-4
git checkout feature-epic-4
git merge --no-ff story-4-1 -m "Merge Story 4.1: description"

# 删除已合并的Story分支（可选）
git branch -d story-4-1
```

**分支命名规范**：
- 格式：`story-{epic_num}-{story_num}`
- 示例：`story-4-1`, `story-4-2`
- 禁止：使用特殊字符或空格

**分支状态跟踪（GAP-024 修复：存储路径 `_bmad-output/config/epic-{epic_id}-branches.json`）**：
```json
{
  "epic_id": 4,
  "branches": [
    {"name": "story-4-1", "status": "merged", "pr": 123},
    {"name": "story-4-2", "status": "active", "pr": null},
    {"name": "story-4-3", "status": "pending", "pr": null}
  ]
}
```
```

**验收标准**:
- [ ] 新增"Story分支管理（Epic级worktree内）"小节
- [ ] 包含创建Story分支的完整命令
- [ ] 包含切换Story分支的流程（含检查）
- [ ] 包含合并Story分支的命令
- [ ] 包含分支命名规范
- [ ] 包含分支状态跟踪JSON示例

---

### 任务3.4：新增串行/并行模式切换章节

**修改路径**: `C:\Users\milom\.cursor\skills\using-git-worktrees\SKILL.md`

**具体位置**: 新增章节（在Epic级worktree相关内容之后）

**修改内容**:
```markdown
## 串行/并行模式切换

Epic级worktree支持两种执行模式：串行（默认）和并行。

### 串行模式（默认）

**执行流程**：
```
Story 4.1 → 开发 → commit → PR → merge到feature-epic-4
    ↓
Story 4.2（基于merge后的feature-epic-4）→ 开发 → commit → PR → merge
    ↓
Story 4.3 → ...
```

**特点**：
- 每个Story基于前一个Story合并后的代码
- 自动处理跨Story依赖
- 适合强依赖的Story序列

**启用命令**：
```bash
/bmad-set-worktree-mode epic=4 mode=serial
```

### 并行模式

**执行流程**：
```
Story 4.1 ─┐
           ├─→ 并行开发 → 各自PR → 逐个merge + 冲突解决审计
Story 4.2 ─┘
```

**触发条件**：
1. 文件范围预测显示无重叠（或用户接受风险）
2. 用户显式确认启用并行模式
3. Story间无强依赖关系

**启用命令**：
```bash
/bmad-set-worktree-mode epic=4 mode=parallel
```

**冲突处理**：
当并行Story同时修改同一文件时：
1. 第一个Story正常merge
2. 第二个Story merge时出现冲突
3. 提示用户解决冲突
4. 冲突解决后触发code-review审计
5. 审计通过后才能继续

### 模式切换逻辑

```python
def set_worktree_mode(epic_id, mode):
    epic_config = load_epic_config(epic_id)
    
    if mode == "parallel":
        # 检查是否可以切换到并行模式
        if has_story_dependencies(epic_id):
            raise Error("存在Story依赖，不能切换到并行模式")
        
        if has_file_overlap(epic_id):
            warn("检测到文件范围重叠，建议保持串行模式")
            if not user_confirm("确定要切换到并行模式？"):
                return
    
    epic_config.mode = mode
    save_epic_config(epic_id, epic_config)
    
    print(f"Epic {epic_id} 已切换到{mode}模式")
```

### 模式查询

```bash
/bmad-get-worktree-mode epic=4
# 输出: serial 或 parallel
```
```

**验收标准**:
- [ ] 新增"串行/并行模式切换"章节
- [ ] 包含串行模式的执行流程图示和特点
- [ ] 包含并行模式的触发条件（3条）
- [ ] 包含两种模式的启用命令
- [ ] 包含冲突处理流程（5步）
- [ ] 包含模式切换逻辑代码块
- [ ] 包含模式查询命令

---

### 任务3.5：新增冲突检测和解决审计触发机制

**修改路径**: `C:\Users\milom\.cursor\skills\using-git-worktrees\SKILL.md`

**具体位置**: 新增章节（在串行/并行模式切换之后）

**修改内容**:
```markdown
## 冲突检测和解决审计

### 冲突检测机制

**自动检测时机（GAP-008 修复）**：
1. Story分支merge到feature-epic-4时
2. 切换Story分支前（检查未提交变更）
3. **仅在并行模式下**：定期扫描（**GAP-061 修复**：「每小时」= 自上一次扫描完成起 60 分钟，或并行模式下每次 merge 后触发）；串行模式下无意义，不执行

**检测内容**：
```python
def detect_conflicts(epic_id):
    conflicts = []
    
    # 获取所有活跃Story分支
    branches = get_active_story_branches(epic_id)
    
    for i, branch1 in enumerate(branches):
        for branch2 in branches[i+1:]:
            # 检查两个分支是否有文件修改重叠
            overlap = check_file_overlap(branch1, branch2)
            if overlap:
                conflicts.append({
                    "branches": [branch1, branch2],
                    "files": overlap,
                    "severity": calculate_severity(overlap)
                })
    
    return conflicts
```

**冲突分级**：
| 级别 | 条件 | 处理方式 |
|-----|------|---------|
| 警告 | 文件重叠但修改区域不冲突 | 提示用户，继续执行 |
| 中等 | 文件重叠且可能冲突 | 要求用户确认，建议串行模式 |
| 严重 | 已发生merge冲突 | 必须解决后才能继续 |

### 冲突解决流程

**步骤1：暂停执行**
```
⚠️  检测到冲突！
Epic: 4
冲突分支: story-4-1, story-4-2
冲突文件: src/cache/base.py, src/config/settings.py

已暂停执行，请解决冲突后继续。
```

**步骤2：引导用户解决**
```bash
# 切换到目标分支
git checkout story-4-2

# 尝试merge feature-epic-4（包含story-4-1的变更）
git merge feature-epic-4

# 解决冲突（手动编辑冲突文件）
# 冲突标记格式：
# <<<<<<< HEAD
# Story 4.2的代码
# =======
# Story 4.1的代码（来自feature-epic-4）
# >>>>>>> feature-epic-4

# 标记冲突已解决
git add <冲突文件>
git commit -m "Merge feature-epic-4 into story-4-2, resolve conflicts"
```

**步骤3：触发冲突解决审计**
冲突解决后，必须触发code-review审计：
```markdown
## 冲突解决审计请求

**冲突信息**：
- Epic: 4
- 分支: story-4-1, story-4-2
- 文件: src/cache/base.py, src/config/settings.py

**审计重点**：
1. 冲突解决是否正确保留了双方的功能
2. 是否有代码重复或逻辑错误
3. 测试是否仍然通过
4. 是否引入了新的bug

**审计方式**：
- 优先：Cursor Task调度code-reviewer
- 回退：mcp_task generalPurpose

**通过标准**：A/B级
```

**步骤4：审计通过后继续**
只有冲突解决审计通过后，才能继续执行后续操作。

### 冲突预防建议

1. **Story规划阶段**：尽量将修改不同文件的Story并行执行
2. **定期同步**：频繁将feature-epic-4的变更merge到Story分支
3. **及时沟通**：团队内同步正在修改的文件范围
4. **小步提交**：频繁commit，减少单次变更范围

### 冲突统计和报告

记录每次冲突的信息：
```json
{
  "epic_id": 4,
  "conflicts": [
    {
      "timestamp": "2026-03-02T14:30:00Z",
      "branches": ["story-4-1", "story-4-2"],
      "files": ["src/cache/base.py"],
      "resolution_time_minutes": 15,
      "audit_result": "A级"
    }
  ],
  "total_conflicts": 1,
  "avg_resolution_time": 15
}
```

当冲突频率超过阈值（如每小时>3次），建议切换回串行模式。
```

**验收标准**:
- [ ] 新增"冲突检测和解决审计"章节
- [ ] 包含3个自动检测时机
- [ ] 包含冲突检测代码块
- [ ] 包含冲突分级表格（3级）
- [ ] 包含冲突解决4步骤流程
- [ ] 包含冲突解决审计请求模板
- [ ] 包含4条冲突预防建议
- [ ] 包含冲突统计JSON示例

---

### 任务3.6：新增回滚到Story级机制

**修改路径**: `C:\Users\milom\.cursor\skills\using-git-worktrees\SKILL.md`

**具体位置**: 新增章节（在冲突检测之后）

**修改内容**:
```markdown
## 回滚到Story级机制

当Epic级worktree出现严重问题（如频繁冲突、性能问题），可以回滚到Story级。

### 回滚场景

**场景1：Epic刚开始，第一个Story未完成**
```bash
# 1. 保存当前工作（如有）
git stash

# 2. 删除Epic worktree
git worktree remove {父目录}/{repo名}-feature-epic-4

# 3. 清理配置
rm _bmad-output/config/epic-4.json

# 4. 恢复Story级配置（全局配置统一放在 _bmad-output/config/）
echo '{"worktree_granularity": "story-level"}' > _bmad-output/config/settings.json

# 5. 重新执行当前Story（使用Story级worktree）
/bmad-create-worktree epic=4 story=1 type=story-level
```

**场景2：Epic进行中，多个Story已完成**
```bash
# 1. 推送所有Story分支到远程
cd {父目录}/{repo名}-feature-epic-4
for branch in $(git branch --list 'story-4-*'); do
    git checkout $branch
    git push origin $branch
done

# 2. 推送feature-epic-4分支
git checkout feature-epic-4
git push origin feature-epic-4

# 3. 返回主工作区
cd ../../..

# 4. 获取远程分支
git fetch origin

# 5. 切换到Story级模式（全局配置统一放在 _bmad-output/config/）
echo '{"worktree_granularity": "story-level"}' > _bmad-output/config/settings.json

# 6. 继续下一个Story（使用Story级worktree）
/bmad-create-worktree epic=4 story=N type=story-level  # GAP-084 修复：N 为下一个未完成 Story 编号，或由用户输入指定

# 7. 清理Epic worktree（确认所有分支已推送后）
git worktree remove {父目录}/{repo名}-feature-epic-4
```

**场景3：系统自动建议回滚**
当系统检测到以下情况时，主动建议回滚：
- 1小时内冲突次数>5次
- 平均冲突解决时间>30分钟
- 用户连续3次拒绝冲突解决方案

```
⚠️  建议回滚到Story级worktree

检测到Epic 4的worktree使用状况不佳：
- 过去1小时冲突次数: 6次
- 平均解决时间: 35分钟
- 建议切换为Story级以提高隔离性

[1] 立即回滚到Story级（推荐）
[2] 继续Epic级（风险自负）
[3] 暂停，人工评估
```

### 回滚数据迁移

回滚时需要迁移的数据：
1. **代码变更**：已push到远程的分支无需迁移
2. **配置文件**：_bmad-output/config/epic-*.json 需要更新
3. **元数据**：冲突历史、审计记录需要保留
4. **未提交变更**：需要stash或commit后push

### 回滚后验证

回滚完成后，验证以下事项：
- [ ] Story级worktree创建成功
- [ ] 可以正常切换分支
- [ ] 历史提交记录完整
- [ ] 配置文件正确更新

### 回滚限制（GAP-006 修复：与回退区分）

- **回滚**（rollback-worktree）：worktree 级别，按 Epic 计；**回退**（correct-course）为阶段级别，按 Story 计（见任务 2.8）
- 同一 Epic 最多回滚 2 次，超过需要 BMad Master 审批
- 回滚操作不可逆（一旦回到Story级，不能自动回到Epic级）
- 回滚必须记录原因和决策过程
```

**验收标准**:
- [ ] 新增"回滚到Story级机制"章节
- [ ] 包含3个回滚场景的详细命令
- [ ] 包含系统自动建议回滚的触发条件（3条）
- [ ] 包含回滚数据迁移说明（4项）
- [ ] 包含回滚后验证清单（4项）
- [ ] 包含回滚限制（3条）

---

### 任务3.7：更新触发时机说明

**修改路径**: `C:\Users\milom\.cursor\skills\using-git-worktrees\SKILL.md`

**具体位置**: 原有触发时机描述章节（开头部分）

**修改内容**:
在原有触发时机基础上增加：

```markdown
### BMAD-Speckit整合场景触发

在BMAD-Speckit整合方案中，本技能在以下场景被触发：

**Layer 3 Create Story阶段**：
- 触发命令：`/bmad-bmm-dev-story epic={num} story={num}`
- 自动检测Epic的Story数量
- Story数≤2：创建Story级worktree
- Story数≥3：创建Epic级worktree（如不存在）或复用已有Epic级worktree

**Story切换时**：
- 触发命令：`/bmad-switch-story epic={num} from={num} to={num}`
- 在Epic级worktree内切换Story分支
- 自动检查未提交变更
- 自动处理跨Story依赖

**模式切换时**：
- 触发命令：`/bmad-set-worktree-mode epic={num} mode={serial/parallel}`
- 修改Epic的执行模式
- 验证切换条件（如并行模式检查文件重叠）

**回滚时**：
- 触发命令：`/bmad-rollback-worktree epic={num} target={story-level}`
- 执行回滚到Story级的操作
- 迁移必要数据
```

**验收标准**:
- [ ] 新增"BMAD-Speckit整合场景触发"小节
- [ ] 包含Layer 3 Create Story阶段的触发说明
- [ ] 包含Story切换时的触发说明
- [ ] 包含模式切换时的触发说明
- [ ] 包含回滚时的触发说明

---

### 任务3.8：集成 bmad-customization-backup 迁移步骤

**修改路径**: `{SKILLS_ROOT}/using-git-worktrees/SKILL.md`

**修改内容**: 确保「Epic级worktree创建流程」步骤 3 之后包含步骤 3.5（见任务 3.2 修改内容）。若 using-git-worktrees 已实施任务 3.2 且含步骤 3.5，本任务可视为已完成。

**验收标准**:
- [ ] Epic级worktree创建流程包含步骤 3.5：迁移 _bmad 定制（可选）
- [ ] 步骤 3.5 引用 bmad-customization-backup 的 apply_bmad_backup.py

---

## 阶段4：code-reviewer扩展（8小时）

### 任务4.1：创建code-reviewer多模式配置文件

**修改路径**: 新建 `.cursor/agents/code-reviewer-config.yaml` 或 `.claude/agents/code-reviewer-config.yaml`（**GAP-041 修复**：两者并存时优先使用 `.cursor`）

**修改内容**:
```yaml
# code-reviewer多模式配置文件
# GAP-009 修复：prompt_template 路径规则
# GAP-076 修复：prompt_template 路径解析优先级：(1) 相对于 config 文件所在目录；(2) 若不存在则 {SKILLS_ROOT}/speckit-workflow/references/
# GAP-025 修复：audit-prompts-*.md 为新建独立文件，与 speckit-workflow/references/audit-prompts.md 关系：
#   - audit-prompts.md §1-§5 对应 spec/plan/gaps/tasks/执行 审计；code 模式可复用或新建 audit-prompts-code.md
# GAP-048 修复：audit-prompts-code.md 与 audit-prompts.md 映射：code 模式对应 audit-prompts.md §5（执行 tasks 后审计）；若新建 audit-prompts-code.md 则其内容须覆盖 §5 要点
#   - prd/arch/pr 模式使用新建的 audit-prompts-prd.md、audit-prompts-arch.md、audit-prompts-pr.md
# GAP-026 修复：Cursor 通过读取本 config 按 mode 切换；若不支持多模式则降级为单一 code 模式+文档说明

modes:
  code:
    name: "代码审计"
    description: "审计代码文件的质量、规范、安全性"
    prompt_template: "audit-prompts-code.md"
    pass_criteria:
      A: "优秀，完全符合要求，可直接merge"
      B: "良好，minor问题，须在本阶段审计闭环内完成修复"
      C: "及格，需修改后重新审计"
      D: "不及格，严重问题，拒绝merge"
    dimensions:
      - name: "功能性"
        weight: 30
        checks:
          - "是否实现了需求"
          - "边界条件处理"
          - "错误处理"
      - name: "代码质量"
        weight: 30
        checks:
          - "命名规范"
          - "代码复杂度"
          - "注释完整性"
      - name: "测试覆盖"
        weight: 20
        checks:
          - "单元测试"
          - "集成测试"
          - "边界测试"
      - name: "安全性"
        weight: 20
        checks:
          - "输入验证"
          - "敏感数据处理"
          - "常见漏洞检查"

  prd:
    name: "PRD审计"
    description: "审计产品需求文档的完整性和准确性"
    prompt_template: "audit-prompts-prd.md"
    pass_criteria:
      完全覆盖: "所有维度均满足"
      部分覆盖: "关键维度满足，次要可后续补充"
      不通过: "关键维度缺失"
    dimensions:
      - name: "需求完整性"
        weight: 40
        checks:
          - "覆盖所有用户场景"
          - "边界条件明确"
          - "异常流程考虑"
      - name: "可测试性"
        weight: 30
        checks:
          - "验收标准明确"
          - "可验证"
          - "测试场景清晰"
      - name: "一致性"
        weight: 30
        checks:
          - "与Product Brief一致"
          - "内部逻辑自洽"
          - "术语统一"

  arch:
    name: "架构审计"
    description: "审计架构设计文档的技术可行性和合理性"
    prompt_template: "audit-prompts-arch.md"
    pass_criteria:
      完全覆盖: "所有维度均满足，Tradeoff记录完整"
      部分覆盖: "关键维度满足，Tradeoff基本完整"
      不通过: "关键维度缺失或Tradeoff未记录"
    dimensions:
      - name: "技术可行性"
        weight: 30
        checks:
          - "方案可实现"
          - "技术选型合理"
          - "资源需求明确"
      - name: "扩展性"
        weight: 25
        checks:
          - "未来3年可持续"
          - "水平扩展能力"
          - "向后兼容"
      - name: "安全性"
        weight: 25
        checks:
          - "威胁建模完整"
          - "安全控制措施"
          - "数据保护"
      - name: "成本效益"
        weight: 20
        checks:
          - "ROI合理"
          - "运维成本可控"
          - "人力成本估算"

  pr:
    name: "PR审计"
    description: "审计Pull Request的合并就绪性"
    prompt_template: "audit-prompts-pr.md"
    pass_criteria:
      A: "所有维度优秀，可直接merge"
      B: "基本满足，minor问题须在本阶段审计闭环内完成修复"
      C: "存在问题，需修改后重新审计"
      D: "严重问题，拒绝merge"
    dimensions:
      - name: "CI状态"
        weight: 30
        checks:
          - "所有检查通过"
          - "无编译错误"
          - "测试通过率100%"
      - name: "代码审查"
        weight: 30
        checks:
          - "符合项目规范"
          - "无安全漏洞"
          - "性能影响评估"
      - name: "测试覆盖"
        weight: 20
        checks:
          - "新增代码有测试"
          - "覆盖率不下降"
          - "边界测试充分"
      - name: "影响评估"
        weight: 20
        checks:
          - "影响范围明确"
          - "兼容性考虑"
          - "回滚方案"

default_mode: "code"
```

**验收标准**:
- [ ] 创建code-reviewer-config.yaml文件
- [ ] 包含4种模式配置（code/prd/arch/pr）
- [ ] 每种模式包含name/description/prompt_template/pass_criteria/dimensions
- [ ] 每种模式至少4个dimensions，每个dimension有weight和checks
- [ ] 包含default_mode设置

---

### 任务4.2：创建PRD审计专用提示词文件

**修改路径**: 新建 `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-prd.md`（**GAP-058 修复**：遵循跨平台路径解析）

**修改内容**:
```markdown
# PRD审计提示词

## 审计对象
Product Requirements Document (PRD)

## 审计目标
验证PRD的完整性、准确性、可测试性，确保需求清晰且无遗漏。

## 审计维度

### 1. 需求完整性（40%）

**检查项**：
- [ ] PRD是否覆盖了Product Brief中的所有核心需求
- [ ] 是否考虑了主要用户场景
- [ ] 是否考虑了边界条件和异常情况
- [ ] 是否明确了非功能性需求（性能、安全、可用性）
- [ ] 是否考虑了国际化/本地化需求（如适用）

**评分标准**：
- A: 所有检查项通过，无遗漏
- B: 大部分检查项通过，minor遗漏
- C: 部分检查项未通过，重要遗漏
- D: 大量检查项未通过，严重遗漏

### 2. 可测试性（30%）

**检查项**：
- [ ] 每个需求都有明确的验收标准
- [ ] 验收标准是可验证的（可量化或可演示）
- [ ] 测试场景清晰，覆盖正向和反向案例
- [ ] 提供了测试数据要求（如需要）

**评分标准**：
- A: 所有需求都有清晰可验证的验收标准
- B: 大部分需求有验收标准，部分可优化
- C: 部分需求缺少验收标准或不可验证
- D: 大量需求缺少验收标准

### 3. 一致性（30%）

**检查项**：
- [ ] PRD与Product Brief的目标和范围一致
- [ ] PRD内部逻辑自洽，无矛盾
- [ ] 术语使用统一，有明确的术语表
- [ ] 需求优先级合理且有依据

**评分标准**：
- A: 完全一致，逻辑严密
- B: 基本一致，minor不一致
- C: 存在明显不一致
- D: 严重不一致或矛盾

## 输出格式

```
PRD审计报告
============

审计对象: [PRD文件名]
审计日期: [YYYY-MM-DD]

总体评级: [A/B/C/D]

维度评分:
1. 需求完整性: [A/B/C/D] ([得分]/40)
   - [具体问题描述]
   
2. 可测试性: [A/B/C/D] ([得分]/30)
   - [具体问题描述]
   
3. 一致性: [A/B/C/D] ([得分]/30)
   - [具体问题描述]

问题清单:
1. [严重程度:高/中/低] [问题描述] [建议修改]
2. ...

通过标准:
- 总体评级A或B: 通过，可进入下一阶段
- 总体评级C: 有条件通过，必须修复高/中 severity问题
- 总体评级D: 不通过，需要重大修改

下一步行动:
[具体建议]
```

## 特殊检查

### 复杂度评估验证
- [ ] PRD的复杂度评估是否合理
- [ ] Party-Mode触发条件是否正确应用
- [ ] 评估结果与实际需求是否匹配

### 需求追溯准备
- [ ] PRD中的需求是否有唯一ID
- [ ] 需求描述是否足够详细以便追溯
- [ ] 是否明确了与其他需求的依赖关系
```

**验收标准**:
- [ ] 创建audit-prompts-prd.md文件（**GAP-058 修复**：路径中 SKILLS_ROOT 与前置任务/GAP-042 路径解析一致）
- [ ] 包含审计对象和目标说明
- [ ] 包含3个审计维度（需求完整性/可测试性/一致性）
- [ ] 每个维度包含检查项列表（至少4项）和评分标准
- [ ] 包含输出格式模板
- [ ] 包含特殊检查（复杂度评估验证/需求追溯准备）

---

### 任务4.3：创建Architecture审计专用提示词文件

**修改路径**: 新建 `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-arch.md`（**GAP-058 修复**）

**修改内容**:
```markdown
# Architecture审计提示词

## 审计对象
Architecture Design Document (架构设计文档)

## 审计目标
验证架构设计的技术可行性、扩展性、安全性，确保设计合理且无重大缺陷。

## 审计维度

### 1. 技术可行性（30%）

**检查项**：
- [ ] 技术选型有充分的理由和依据
- [ ] 架构可以在给定的时间和资源内实现
- [ ] 所需技术和工具是成熟且可获得的
- [ ] 团队具备实施该架构的技术能力

**评分标准**：
- A: 技术方案成熟可行，风险可控
- B: 基本可行，有部分风险需要关注
- C: 可行性存疑，有明显风险
- D: 不可行或风险过高

### 2. 扩展性（25%）

**检查项**：
- [ ] 架构支持未来3-5年的业务增长
- [ ] 可以水平扩展以应对流量增长
- [ ] 新功能可以在不影响现有功能的情况下添加
- [ ] 向后兼容性考虑充分

**评分标准**：
- A: 优秀的扩展性，充分考虑未来需求
- B: 良好的扩展性，基本满足未来需求
- C: 扩展性有限，可能需要中期重构
- D: 缺乏扩展性考虑，很快会遇到瓶颈

### 3. 安全性（25%）

**检查项**：
- [ ] 进行了威胁建模并记录了主要威胁
- [ ] 针对每个威胁有相应的安全控制措施
- [ ] 数据传输和存储的安全性考虑
- [ ] 身份认证和授权机制设计合理
- [ ] 敏感数据处理符合合规要求

**评分标准**：
- A: 全面的安全设计，威胁建模完整
- B: 良好的安全设计，主要威胁已覆盖
- C: 安全设计有遗漏，存在中等风险
- D: 安全设计严重不足，存在高风险

### 4. 成本效益（20%）

**检查项**：
- [ ] 基础设施成本估算合理
- [ ] 运维成本（人力、工具）可控
- [ ] ROI分析支持该架构投资
- [ ] 有成本优化的备选方案

**评分标准**：
- A: 成本效益优秀，投资回报明确
- B: 成本效益良好，基本合理
- C: 成本偏高，需要优化
- D: 成本过高或ROI不明确

## Tradeoff分析审计

每个重大架构决策必须有ADR（Architecture Decision Record）：

**ADR检查项**：
- [ ] 决策背景描述清晰
- [ ] 考虑了至少2个备选方案
- [ ] 每个方案的优缺点分析到位
- [ ] 决策理由充分且有数据支撑
- [ ] 决策后果（正面和负面）分析完整
- [ ] 相关方确认签字（产品经理、技术负责人等）

**评分标准**：
- A: 所有重大决策都有完整的ADR
- B: 大部分决策有ADR，部分可补充
- C: 部分决策缺少ADR或分析不充分
- D: 大量决策无ADR或分析严重不足

## 输出格式

```
Architecture审计报告
====================

审计对象: [Architecture文档名]
审计日期: [YYYY-MM-DD]

总体评级: [A/B/C/D]

维度评分:
1. 技术可行性: [A/B/C/D] ([得分]/30)
   - [具体问题描述]
   
2. 扩展性: [A/B/C/D] ([得分]/25)
   - [具体问题描述]
   
3. 安全性: [A/B/C/D] ([得分]/25)
   - [具体问题描述]
   
4. 成本效益: [A/B/C/D] ([得分]/20)
   - [具体问题描述]

Tradeoff分析审计:
- ADR覆盖率: [X/Y] 个重大决策
- ADR质量评级: [A/B/C/D]
- [具体问题描述]

问题清单:
1. [严重程度:高/中/低] [问题描述] [建议修改]
2. ...

通过标准:
- 总体评级A或B: 通过，可进入下一阶段
- 总体评级C: 有条件通过，必须修复高/中 severity问题
- 总体评级D: 不通过，需要重大修改

下一步行动:
[具体建议]
```

## 特殊检查

### 复杂度评估验证
- [ ] Architecture的复杂度评估是否合理
- [ ] Party-Mode触发条件是否正确应用
- [ ] 评估结果与实际架构复杂度是否匹配

### 与PRD的一致性
- [ ] 架构设计是否满足PRD中的所有需求
- [ ] 架构约束是否传递到下游文档
- [ ] 技术方案与业务目标是否对齐
```

**验收标准**:
- [ ] 创建audit-prompts-arch.md文件
- [ ] 包含4个审计维度（技术可行性/扩展性/安全性/成本效益）
- [ ] 每个维度包含检查项列表（至少4项）和评分标准
- [ ] 包含Tradeoff分析审计（ADR检查项）
- [ ] 包含输出格式模板
- [ ] 包含特殊检查（复杂度评估验证/与PRD一致性）

---

### 任务4.4：创建PR审计专用提示词文件

**修改路径**: 新建 `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-pr.md`（**GAP-058 修复**）

**修改内容**:
```markdown
# PR审计提示词

## 审计对象
Pull Request (合并请求)

## 审计目标
验证PR的合并就绪性，确保代码质量、测试覆盖、影响评估都符合标准。

## 审计维度

### 1. CI状态（30%）

**检查项**：
- [ ] 所有CI检查通过（构建、测试、lint等）
- [ ] 无编译错误或警告
- [ ] 单元测试通过率100%
- [ ] 集成测试通过率100%
- [ ] 代码覆盖率不低于基线（或提升）

**评分标准**：
- A: 所有检查通过，覆盖率提升
- B: 所有检查通过，覆盖率持平
- C: 有检查失败或覆盖率下降
- D: 多项检查失败

### 2. 代码审查（30%）

**检查项**：
- [ ] 代码符合项目编码规范
- [ ] 命名清晰，注释充分
- [ ] 无明显的安全漏洞（SQL注入、XSS等）
- [ ] 无性能明显问题（N+1查询、内存泄漏等）
- [ ] 代码复杂度在合理范围内

**评分标准**：
- A: 代码优秀，无明显问题
- B: 代码良好，有minor问题
- C: 代码有中等问题需要修复
- D: 代码有严重问题

### 3. 测试覆盖（20%）

**检查项**：
- [ ] 新增代码有对应的单元测试
- [ ] 关键路径有集成测试
- [ ] 边界条件和异常情况有测试覆盖
- [ ] 测试用例设计合理，易于维护

**评分标准**：
- A: 测试覆盖全面，质量高
- B: 测试覆盖基本完整
- C: 测试覆盖有遗漏
- D: 测试覆盖严重不足

### 4. 影响评估（20%）

**检查项**：
- [ ] PR描述清晰，说明了改动内容和原因
- [ ] 影响范围明确（哪些模块受影响）
- [ ] 向后兼容性考虑（API变更等）
- [ ] 数据库迁移脚本（如需要）
- [ ] 回滚方案（如需要）

**评分标准**：
- A: 影响评估全面，风险可控
- B: 影响评估基本完整
- C: 影响评估有遗漏
- D: 影响评估严重不足

## 输出格式

```
PR审计报告
==========

PR: #[PR编号] [PR标题]
作者: [作者名]
分支: [源分支] → [目标分支]
审计日期: [YYYY-MM-DD]

总体评级: [A/B/C/D]

维度评分:
1. CI状态: [A/B/C/D] ([得分]/30)
   - [具体问题描述]
   
2. 代码审查: [A/B/C/D] ([得分]/30)
   - [具体问题描述]
   
3. 测试覆盖: [A/B/C/D] ([得分]/20)
   - [具体问题描述]
   
4. 影响评估: [A/B/C/D] ([得分]/20)
   - [具体问题描述]

统计数据:
- 新增代码行数: [N]
- 删除代码行数: [N]
- 修改文件数: [N]
- 测试用例数: [N]
- 覆盖率变化: [+/-X%]

问题清单:
1. [严重程度:高/中/低] [问题描述] [建议修改]
2. ...

建议操作:
- [ ] 批准并Merge（评级A或B）
- [ ] 要求修改（评级C）
- [ ] 拒绝（评级D）

备注:
[其他信息]
```

## 强制人工审核提示

**重要**：根据BMAD-Speckit整合方案，PR Merge环节必须停止等待人工确认。

本审计只是辅助决策，**绝对不能自动merge**。

审计通过后，向用户展示：
```
🔒 PR审核完成

PR: #123 Story 4.1: metrics cache fix
评级: A级 ✅

📊 统计:
- CI状态: ✅ 全部通过
- 代码质量: ✅ 优秀
- 测试覆盖: +2.3%
- 影响文件: 12个

❓ 请选择操作：
[1] ✅ 批准并Merge（需人工确认）
[2] ❌ 拒绝，返回修改
[3] 👀 查看详细diff
[4] ⏭️  跳过此PR
```

等待用户明确选择[1]并确认后，才能执行merge操作。
```

**验收标准**:
- [ ] 创建audit-prompts-pr.md文件
- [ ] 包含4个审计维度（CI状态/代码审查/测试覆盖/影响评估）
- [ ] 每个维度包含检查项列表（至少4项）和评分标准
- [ ] 包含输出格式模板（含统计数据）
- [ ] 包含强制人工审核提示（强调不能自动merge）

---

## 阶段5：PR自动化整合（6小时）

### 任务5.1：整合pr-template-generator到Phase 5

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**GAP-074 修复**：前置条件增加「pr-template-generator 已安装或已在前置探测中确认」；若不存在，输出安装指引并跳过 PR 描述生成（或使用占位模板）。

**具体位置**: 阶段五（收尾层）章节

**修改内容**:
```markdown
## Phase 5: 收尾与集成（增强版）

当所有Story完成后，提供以下选项：

### 选项 [0] 提交代码
- 询问是否将当前改动提交到本地仓库
- 若选择是，自动调用 auto-commit-utf8 技能生成中文 commit message 并提交

### 选项 [1] 继续下一个Story
- 在同一Epic worktree内切换到下一个Story分支
- 自动检测并处理跨Story依赖
- 如果前置Story未完成，提示等待

### 选项 [2] 创建PR并等待review
- 推送当前Story分支到远程
- **自动调用pr-template-generator生成PR描述**
- 创建PR并进入强制人工审核流程

**pr-template-generator调用**：
```bash
# 分析当前分支的commits
analyze_commits(story_branch)

# 生成PR模板
pr_template = generate_pr_template(
    story_id="4.1",
    story_title="metrics cache fix",
    commits=commit_history,
    files_changed=changed_files,
    tests_added=test_files
)

# PR模板内容包括：
# - Story背景和目的
# - 主要改动点（基于commit message）
# - 测试覆盖情况
# - 影响范围
# - 回滚方案
```

### 选项 [3] 批量Push所有Story分支（新增）
- 推送Epic下所有已完成的Story分支到远程
- **为每个Story自动创建PR（使用pr-template-generator）**
- 进入批量人工审核流程

**批量处理流程**：
```
For each completed_story in epic.stories:
    1. Push story_branch to origin
    2. Generate PR template using pr-template-generator
    3. Create PR with generated template
    4. Add to batch_review_queue

Display batch review summary:
- Total PRs created: N
- Epic: feature-epic-4
- Ready for review
```

### 选项 [4] 保留分支稍后处理
- 保持当前分支状态
- 允许稍后继续
- 记录当前进度到元数据

### 强制人工审核流程

无论选择哪个选项，PR Merge环节**绝对不能自动merge**：

**单PR审核界面**：
```
╔════════════════════════════════════════════════════════════╗
║                    🔒 PR审核请求                            ║
╠════════════════════════════════════════════════════════════╣
║  Epic: feature-epic-4 (用户管理系统重构)                    ║
║  PR: #123 Story 4.1: metrics cache fix                     ║
╟────────────────────────────────────────────────────────────╢
║  📊 CI状态:        ✅ 全部通过                              ║
║  📈 覆盖率变化:    +2.3%                                   ║
║  🔍 代码审查:      ✅ 已通过 code-reviewer（**GAP-059 修复**：调用时传入 mode=pr，从 code-reviewer-config 读取 pr 模式提示词）                 ║
║  📁 影响文件:      12个                                    ║
║  📝 PR描述:        [由pr-template-generator生成]           ║
║                                                            ║
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准并Merge                                        ║
║  [2] ❌ 拒绝，返回修改                                      ║
║  [3] 👀 查看详细diff                                       ║
║  [4] ⏭️  跳过此PR                                          ║
╚════════════════════════════════════════════════════════════╝
```

**批量审核界面**：
```
╔════════════════════════════════════════════════════════════╗
║                 🔒 批量PR审核请求                           ║
╠════════════════════════════════════════════════════════════╣
║  Epic: feature-epic-4                                       ║
║  待审核PR: 3个                                              ║
╟────────────────────────────────────────────────────────────╢
║  [#123] Story 4.1 - ✅ CI通过 - ✅ 审计A级                  ║
║  [#124] Story 4.2 - ✅ CI通过 - ✅ 审计B级                  ║
║  [#125] Story 4.3 - ✅ CI通过 - ⚠️  审计C级（需关注）       ║
╟────────────────────────────────────────────────────────────╢
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准全部并逐个Merge                                ║
║  [2] ✅ 批准部分（选择）                                   ║
║  [3] ❌ 拒绝全部，返回修改                                 ║
║  [4] 👀 逐个查看详情                                       ║
╚════════════════════════════════════════════════════════════╝
```

**重要约束**：
- 必须等待用户明确选择[1]并确认后才能merge
- 严禁自动merge
- 审核不通过的PR不能merge
```

**验收标准**:
- [ ] Phase 5包含5个选项（提交代码/继续下一个Story/创建PR/批量Push/保留分支）
- [ ] 选项[2]和[3]明确调用pr-template-generator
- [ ] 包含pr-template-generator调用流程说明
- [ ] 包含批量处理流程
- [ ] 包含单PR审核界面示例
- [ ] 包含批量审核界面示例
- [ ] 强调"绝对不能自动merge"的约束

---

### 任务5.2：实现批量Push功能

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**修改内容**:
在Phase 5的"选项[3] 批量Push所有Story分支"中增加详细实现：

```markdown
### 批量Push实现细节

**前置条件检查**：
```python
def batch_push_precheck(epic_id):
    # 1. 检查所有Story是否已完成
    incomplete_stories = get_incomplete_stories(epic_id)
    if incomplete_stories:
        warn(f"以下Story未完成: {incomplete_stories}")
        if not user_confirm("是否只推送已完成的Story？"):
            return False
    
    # 2. 检查远程仓库连接
    if not test_remote_connection():
        error("无法连接到远程仓库")
        return False
    
    # 3. 检查权限
    if not has_push_permission():
        error("没有推送权限")
        return False
    
    return True
```

**批量推送流程**：
```python
def batch_push_stories(epic_id):
    results = []
    
    for story in get_completed_stories(epic_id):
        try:
            # 1. 切换到Story分支
            checkout_branch(f"story-{epic_id}-{story.num}")
            
            # 2. 拉取最新代码（避免冲突）
            pull_latest()  # GAP-082 修复：pull 失败（如冲突）时默认 skip 该 Story 继续下一 Story 并记录；可选「提示用户解决」模式

            # 3. 推送到远程
            push_to_remote(f"story-{epic_id}-{story.num}")
            
            # 4. 生成PR模板
            pr_template = generate_pr_template(story)
            
            # 5. 创建PR
            pr_url = create_pull_request(
                title=f"Story {epic_id}.{story.num}: {story.title}",
                body=pr_template,
                head=f"story-{epic_id}-{story.num}",
                base=f"feature-epic-{epic_id}"
            )
            
            results.append({
                "story": story.num,
                "status": "success",
                "pr_url": pr_url
            })
            
        except Exception as e:
            results.append({
                "story": story.num,
                "status": "failed",
                "error": str(e)
            })
    
    return results
```

**错误处理**：
- 单个Story推送失败不影响其他Story
- 记录失败的Story和原因
- 提供重试机制

**进度显示**：
```
批量推送中...
[1/7] Story 4.1: 推送中... ✅ 完成，PR #123
[2/7] Story 4.2: 推送中... ✅ 完成，PR #124
[3/7] Story 4.3: 推送中... ❌ 失败（网络错误）
[4/7] Story 4.4: 推送中... ✅ 完成，PR #125
...

推送完成：6/7 成功
失败：Story 4.3
是否重试失败的Story？[Y/n]
```
```

**验收标准**:
- [ ] 包含前置条件检查（3项）
- [ ] 包含批量推送流程代码块
- [ ] 包含错误处理说明
- [ ] 包含进度显示示例

---

### 任务5.3：实现强制人工审核界面

**修改路径**: `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**修改内容**:
在Phase 5中增加强制人工审核界面的详细实现：

```markdown
### 强制人工审核界面实现

**核心原则**：绝对不能自动merge，必须停止等待人工确认。

**单PR审核界面**：
```python
def show_pr_review_interface(pr_info):
    # 获取PR详细信息
    ci_status = get_ci_status(pr_info.id)
    coverage_change = get_coverage_change(pr_info.id)
    code_review_result = get_code_review_result(pr_info.id)
    affected_files = get_affected_files(pr_info.id)
    
    # 显示审核界面
    display(f"""
╔════════════════════════════════════════════════════════════╗
║                    🔒 PR审核请求                            ║
╠════════════════════════════════════════════════════════════╣
║  Epic: {pr_info.epic_name}                                  ║
║  PR: #{pr_info.id} {pr_info.title}                         ║
╟────────────────────────────────────────────────────────────╢
║  📊 CI状态:        {ci_status.emoji} {ci_status.text}       ║
║  📈 覆盖率变化:    {coverage_change}                        ║
║  🔍 代码审查:      {code_review_result.emoji} {code_review_result.grade}级 ║
║  📁 影响文件:      {len(affected_files)}个                  ║
║  📝 PR描述:        [由pr-template-generator生成]           ║
║                                                            ║
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准并Merge                                        ║
║  [2] ❌ 拒绝，返回修改                                      ║
║  [3] 👀 查看详细diff                                       ║
║  [4] ⏭️  跳过此PR                                          ║
╚════════════════════════════════════════════════════════════╝
    """)
    
    # 等待用户输入（轮询模式，24h超时）
    # GAP-010 修复：Cursor/Claude 无现成 wait_for_user_input_with_polling API，需自行实现
    # 实现建议：输出 prompt 后结束本轮；用户在下条消息回复 1/2/3/4
    # 超时/提醒：仅在会话中打印提示信息，暂不集成邮件/Slack 等外接
    # 以下为伪代码，实际需根据运行环境实现
    choice = wait_for_user_input_with_polling(
        timeout_hours=24,
        poll_interval_minutes=30,
        on_timeout=lambda: print(f"[超时提醒] PR #{pr_info.id} 待审核已超过24小时。请尽快完成审核，或选择跳过/拒绝。")
    )
    
    if choice == "1":
        # 再次确认
        confirm = ask("确定要批准并Merge此PR？ [yes/no]: ")
        if confirm.lower() == "yes":
            merge_pull_request(pr_info.id)
            return "merged"
        else:
            return "cancelled"
    elif choice == "2":
        reason = ask("拒绝原因: ")
        reject_pull_request(pr_info.id, reason)
        return "rejected"
    elif choice == "3":
        show_diff(pr_info.id)
        return show_pr_review_interface(pr_info)  # 递归显示
    elif choice == "4":
        return "skipped"
```

**批量审核界面**：
```python
def show_batch_review_interface(epic_id, pr_list):
    # 获取所有PR的状态
    pr_statuses = [get_pr_status(pr) for pr in pr_list]
    
    display(f"""
╔════════════════════════════════════════════════════════════╗
║                 🔒 批量PR审核请求                           ║
╠════════════════════════════════════════════════════════════╣
║  Epic: {epic_id}                                            ║
║  待审核PR: {len(pr_list)}个                                 ║
╟────────────────────────────────────────────────────────────╢
""")
    
    for i, (pr, status) in enumerate(zip(pr_list, pr_statuses), 1):
        display(f"║  [#{pr.id}] Story {pr.story_id} - {status.ci_emoji} CI{status.ci_status} - {status.review_emoji} 审计{status.grade}级")
    
    display("""
╟────────────────────────────────────────────────────────────╢
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准全部并逐个Merge                                ║
║  [2] ✅ 批准部分（选择）                                   ║
║  [3] ❌ 拒绝全部，返回修改                                 ║
║  [4] 👀 逐个查看详情                                       ║
╚════════════════════════════════════════════════════════════╝
    """)
    
    choice = wait_for_user_input_with_polling(timeout_hours=24, poll_interval_minutes=30)  # 见 GAP-010 实现说明
    
    if choice == "1":
        confirm = ask(f"确定要批准全部{len(pr_list)}个PR并逐个Merge？ [yes/no]: ")
        if confirm.lower() == "yes":
            for pr in pr_list:
                merge_pull_request(pr.id)
            return "all_merged"
    elif choice == "2":
        # GAP-046 修复：select_prs_to_merge 伪代码及边界
        # def select_prs_to_merge(pr_list):
        #   display(pr_list with indices 1..n)
        #   raw = input("输入序号，逗号或范围，如 1,3,5 或 1-3: ")
        #   indices = parse_indices(raw, max_n=len(pr_list))  # 空输入→[]；非法格式→提示重输；越界→忽略（**GAP-088 修复**：在 bmad-story-assistant Phase 5 实现中补充上述 UI 交互细节）
        #   return [pr_list[i-1] for i in indices if 1<=i<=len(pr_list)]
        selected = select_prs_to_merge(pr_list)
        for pr in selected:
            merge_pull_request(pr.id)
        return f"{len(selected)}_merged"
    # ... 其他选项
```

**审核提醒机制**（仅在会话中打印，暂不集成邮件/Slack）：（**GAP-056 修复**：已知限制——用户关闭会话后 reopen 时提醒无法送达；可补充「会话恢复时检查待审核 PR 并提示」）
```python
# 如果用户长时间未响应，仅在当前会话中打印提示
if time_since_last_activity() > timedelta(hours=24):
    print(f"[提醒] Epic {epic_id} 有待审核PR，共 {pending_pr_count} 个已超过24小时，请尽快处理。")
```

**审核SLA约定**（建议）：
- P0 PR：4小时内响应
- P1 PR：24小时内响应
- P2 PR：72小时内响应
```

**验收标准**:
- [ ] 包含单PR审核界面的Python实现代码块
- [ ] 包含批量审核界面的Python实现代码块
- [ ] 包含审核提醒机制（仅在会话中打印提示，暂不集成外接）
- [ ] 包含审核SLA约定建议
- [ ] 包含 select_prs_to_merge 的 UI 交互验收：空输入→[]；非法格式→提示重输；越界→忽略（**GAP-088 修复**）
- [ ] 使用轮询超时（24h）替代无限期等待；超时后在会话中打印提醒

---

## 阶段6：集成测试（18小时）

### 任务6.1：编写端到端测试用例（metrics-cache-fix场景）

**修改路径**: 新建 `tests/integration/test_bmad_speckit_integration.py`

**修改内容**:
```python
"""
BMAD-Speckit整合方案端到端测试
测试场景：metrics-cache-fix（Epic 4, 7个Story）

GAP-011 修复：以下函数为 mock/stub，需在 conftest.py 或本文件 fixtures 中定义：
- create_product_brief, evaluate_complexity, generate_prd, generate_architecture
- create_epic, split_stories, analyze_dependencies, determine_worktree_strategy
- create_story, load_story, run_specify, run_plan, run_gaps, run_tasks, run_tests, code_review, run_speckit_integration（GAP-028）
GAP-054 修复：扩展 mock 清单，含 check_tdd_stuck, create_story_with_requirement, create_spec_with_implementation, resolve_conflict, create_epic_with_dependencies, code_review_conflict_resolution, complete_story, create_pr_for_story, regression_tests_pass, all_epic_stories_merged
GAP-014 修复：mock 范围 = Layer 1-3 产出；真实依赖 = 阶段 4、5 的 code-reviewer、speckit 流程
GAP-029 修复：任务 6.1 依赖 2.5（Worktree 策略）、4.1（code-reviewer-config）、5.3（审核界面）的产出物；测试中 mock 上述产出
GAP-069 修复：阶段6 的 mock 契约应与阶段2 最终产出一致，阶段2 变更时需同步更新测试
GAP-043 修复：增加 test_stage4_parallel_with_stage1_3 用例，验证阶段4 可独立于阶段1-3 完成（mock 阶段1-3 产出，仅执行阶段4 配置）
GAP-047 修复：conftest.py 放共享 fixtures（create_product_brief 等跨测试文件）；各 test 文件内放本文件专用 fixtures（如 test_error_handling 的 handle_audit_failure mock）
"""

import pytest
from datetime import datetime, timedelta

class TestBmadSpeckitIntegration:
    """BMAD-Speckit整合方案端到端测试套件"""
    
    def test_layer_1_product_definition(self):
        """测试Layer 1产品定义层"""
        # 模拟创建Product Brief
        product_brief = create_product_brief(
            title="Metrics Cache Optimization",
            goal="Improve metrics query performance by 50%"
        )
        assert product_brief is not None
        
        # 执行复杂度评估（GAP-052 修复：每维度最高5分，总分3~15；此处用高值触发双80轮）
        complexity_score = evaluate_complexity(
            business=5,  # 部分新领域，多利益相关方
            technical=5,  # 部分新技术，中等架构挑战
            impact=5      # 跨模块影响
        )
        assert complexity_score == 15  # 5+5+5，在合法范围内
        assert complexity_score >= 15  # 触发双80轮Party-Mode
        
        # 生成PRD（模拟Party-Mode后）
        prd = generate_prd(product_brief, complexity_score)
        assert "REQ-001" in prd  # 需求有ID
        assert "acceptance_criteria" in prd  # 有验收标准
        
        # 生成Architecture（模拟Party-Mode后）
        arch = generate_architecture(prd, complexity_score)
        assert "CacheService" in arch  # 有组件定义
        assert "ADR-001" in arch  # 有决策记录
    
    def test_layer_2_epic_story_planning(self):
        """测试Layer 2 Epic/Story规划层"""
        # 创建Epic
        epic = create_epic(
            id=4,
            name="feature-metrics-cache",
            estimated_hours=80
        )
        assert epic.id == 4
        
        # 拆分Story
        stories = split_stories(epic, count=7)
        assert len(stories) == 7
        assert stories[0].id == "4.1"
        assert stories[6].id == "4.7"
        
        # 分析依赖
        dependencies = analyze_dependencies(stories)  # GAP-053 修复：dependencies[key]=依赖 key 的 Story 列表，故 dependencies["4.1"] 含 "4.2" 表示 4.2 依赖 4.1
        assert "4.2" in dependencies["4.1"]  # 4.2依赖4.1
        
        # 检测Story数>=3，触发Epic级worktree
        worktree_strategy = determine_worktree_strategy(len(stories))
        assert worktree_strategy == "epic-level"
    
    def test_layer_3_create_story(self):
        """测试Layer 3 Create Story"""
        # 模拟Create Story流程
        story = create_story(
            epic_id=4,
            story_num=1,
            title="Implement base cache class"
        )
        
        # 验证Story文档包含PRD追溯
        assert "PRD追溯" in story.document
        assert "REQ-001" in story.document
        
        # 验证Story文档包含Architecture约束
        assert "Architecture约束" in story.document
        assert "CacheService" in story.document
        
        # 验证Party-Mode完成（模拟100轮）
        assert story.party_mode_rounds >= 100
    
    def test_layer_4_speckit_nesting(self):
        """测试Layer 4 speckit嵌套流程"""
        story = load_story(epic_id=4, story_num=1)
        
        # Step 1: specify
        spec = run_specify(story)
        assert spec.filename == "spec-E4-S1.md"  # 文件名必含Epic/Story序号
        assert code_review(spec, section="§1") in ["A", "B"]
        
        # Step 2: plan
        plan = run_plan(spec)
        assert plan.filename == "plan-E4-S1.md"  # 文件名必含Epic/Story序号
        assert code_review(plan, section="§2") in ["A", "B"]
        
        # Step 3: GAPS
        gaps = run_gaps(plan)
        assert gaps.filename == "IMPLEMENTATION_GAPS-E4-S1.md"  # 文件名必含Epic/Story序号
        assert code_review(gaps, section="§3") in ["A", "B"]
        
        # Step 4: tasks
        tasks = run_tasks(gaps)
        assert tasks.filename == "tasks-E4-S1.md"  # 文件名必含Epic/Story序号
        assert code_review(tasks, section="§4") in ["A", "B"]
        
        # Step 5: 执行（TDD）
        for task in tasks:
            # 红灯
            red_result = run_tests(task)
            assert red_result.status == "failed"
            record_tdd(task, phase="RED")
            
            # 绿灯
            implement(task)
            green_result = run_tests(task)
            assert green_result.status == "passed"
            record_tdd(task, phase="GREEN")
            
            # 重构
            refactor(task)
            record_tdd(task, phase="REFACTOR")
        
        # 最终审计
        final_review = code_review(tasks, section="§5")
        assert final_review in ["A", "B"]
    
    def test_epic_level_worktree(self):
        """测试Epic级worktree功能"""
        # 创建Epic级worktree
        worktree = create_epic_worktree(epic_id=4)
        assert worktree.path.endswith("feature-epic-4") or "feature-epic-4" in worktree.path
        assert worktree.type == "epic-level"
        
        # 创建Story分支
        branch1 = create_story_branch(worktree, epic_id=4, story_num=1)
        assert branch1.name == "story-4-1"
        
        branch2 = create_story_branch(worktree, epic_id=4, story_num=2)
        assert branch2.name == "story-4-2"
        
        # 切换分支
        switch_to_branch(branch2)
        assert get_current_branch() == "story-4-2"
        
        # 验证上下文切换时间减少
        switch_time = measure_switch_time(branch1, branch2)
        assert switch_time < 60  # 少于1分钟
    
    def test_stage4_parallel_with_stage1_3(self):
        """GAP-043 修复：验证阶段4 可独立于阶段1-3 完成"""
        # mock 阶段1-3 产出（speckit-workflow、bmad-story-assistant、using-git-worktrees 修改）
        mock_spec = {"filename": "spec-E4-S1.md"}
        mock_plan = {"filename": "plan-E4-S1.md"}
        mock_worktree_config = {"epic_id": 4, "type": "epic-level"}
        # 仅执行阶段4：code-reviewer 配置
        config = load_code_reviewer_config()
        assert config is not None
        assert "code" in config.get("modes", {})
        assert "prd" in config.get("modes", {})
    
    def test_serial_parallel_mode_switch(self):
        """测试串行/并行模式切换"""
        epic_id = 4
        
        # 默认串行模式
        mode = get_worktree_mode(epic_id)
        assert mode == "serial"
        
        # 切换到并行模式（无依赖、无文件重叠）
        set_worktree_mode(epic_id, "parallel")
        assert get_worktree_mode(epic_id) == "parallel"
        
        # 尝试切换到并行模式（有依赖）应该失败
        epic_with_deps = create_epic_with_dependencies()
        with pytest.raises(Error):
            set_worktree_mode(epic_with_deps.id, "parallel")
    
    def test_conflict_detection_and_resolution(self):
        """测试冲突检测和解决"""
        epic_id = 4
        
        # 模拟两个Story修改同一文件
        story1 = load_story(epic_id=4, story_num=1)
        story2 = load_story(epic_id=4, story_num=2)
        
        # 检测冲突
        conflicts = detect_conflicts(story1.branch, story2.branch)
        assert len(conflicts) > 0
        
        # 解决冲突
        resolve_conflicts(conflicts)
        
        # 触发冲突解决审计
        audit_result = code_review_conflict_resolution(conflicts)
        assert audit_result in ["A", "B"]
    
    def test_mandatory_manual_review(self):
        """测试强制人工审核"""
        pr = create_pull_request(
            epic_id=4,
            story_num=1,
            title="Story 4.1: metrics cache fix"
        )
        
        # 验证不能自动merge
        with pytest.raises(AutoMergeForbidden):
            auto_merge(pr)
        
        # 模拟人工审核界面
        review_interface = show_pr_review_interface(pr)
        assert "🔒" in review_interface  # 锁定图标
        assert "[1] ✅ 批准并Merge" in review_interface
        
        # 模拟用户选择批准
        user_approve(pr)
        
        # 再次确认
        confirm = user_confirm("确定要Merge？")
        assert confirm is True
        
        # 现在可以merge
        merge_pull_request(pr)
        assert pr.status == "merged"
    
    def test_rollback_to_story_level(self):
        """测试回滚到Story级"""
        epic_id = 4
        
        # 创建Epic级worktree
        epic_worktree = create_epic_worktree(epic_id)
        
        # 完成一个Story
        complete_story(epic_id, story_num=1)
        
        # 回滚到Story级
        rollback_to_story_level(epic_id)
        
        # 验证Story级worktree创建成功
        story_worktree = create_story_worktree(epic_id, story_num=2)
        assert story_worktree.type == "story-level"
        assert story_worktree.path.endswith("story-4-2") or "story-4-2" in story_worktree.path
    
    def test_end_to_end_full_flow(self):
        """测试完整端到端流程"""
        # Layer 1
        complexity = evaluate_complexity(business=5, technical=5, impact=5)  # GAP-052：合法范围 3~15
        prd = generate_prd(complexity=complexity)
        arch = generate_architecture(complexity=complexity)
        
        # Layer 2
        epic = create_epic(id=4, stories=7)  # GAP-066 修复：create_epic 支持 (id, stories=N) 或 (id, story_count=N)；与 test_layer_2 的 (id, name, estimated_hours) 为不同重载

        # Layer 3-4 for each story
        for story_num in range(1, 8):
            story = create_story(epic_id=4, story_num=story_num)
            
            # Nest speckit workflow
            spec = run_specify(story)
            assert code_review(spec) in ["A", "B"]
            
            plan = run_plan(spec)
            assert code_review(plan) in ["A", "B"]
            
            gaps = run_gaps(plan)
            assert code_review(gaps) in ["A", "B"]
            
            tasks = run_tasks(gaps)
            assert code_review(tasks) in ["A", "B"]
            
            # Execute with TDD
            execute_tasks(tasks)
            
            # Post-implementation audit
            assert post_audit(story) in ["A", "B"]
        
        # Layer 5: Batch push and manual review
        prs = batch_push_all_stories(epic_id=4)
        for pr in prs:
            user_approve(pr)
            merge_pull_request(pr)
        
        # Verify all stories merged
        assert all_stories_merged(epic_id=4)
```

**验收标准**:
- [ ] 创建test_bmad_speckit_integration.py文件
- [ ] 包含TestBmadSpeckitIntegration测试类
- [ ] 包含10个测试方法（覆盖所有关键功能）
- [ ] 每个测试方法有清晰的docstring说明测试目标
- [ ] 使用pytest框架

---

### 任务6.2：编写错误处理场景测试

**修改路径**: 新建 `tests/integration/test_error_handling.py`

**GAP-039 修复**：以下函数需在 conftest 或本文件 fixtures 中定义：`handle_audit_failure`, `detect_document_conflict`, `enter_party_mode`（可 mock）
**GAP-047 修复**：上述 stub 放本文件 fixtures（错误处理场景专用）；共享 fixtures 放 conftest.py

**修改内容**:
```python
"""
错误处理场景测试
验证各种异常情况的处理
"""

import pytest
from unittest.mock import Mock, patch

class TestErrorHandling:
    """错误处理场景测试"""
    
    def test_speckit_specify_audit_failure(self):
        """测试speckit.specify审计失败场景"""
        story = create_story(epic_id=4, story_num=1)
        spec = run_specify(story)
        
        # 模拟审计失败（C级）
        with patch('code_review', return_value="C"):
            result = handle_audit_failure(spec, stage="specify")
            
            # 应该提供修改选项
            assert "options" in result
            assert "modify" in result["options"]
            assert "rollback" in result["options"]
    
    def test_story_document_conflict_with_spec(self):
        """测试Story文档与spec冲突场景"""
        story = create_story_with_requirement(requirement="Support Redis cache")
        spec = create_spec_with_implementation(impl="Local cache only")
        
        # 检测冲突
        conflict = detect_document_conflict(story, spec)
        assert conflict is not None
        assert "Redis" in conflict.description
        
        # 应该触发party-mode
        with patch('enter_party_mode') as mock_party:
            resolve_conflict(conflict)
            mock_party.assert_called_once()
    
    def test_tdd_red_stuck(self):
        """测试TDD红灯长时间不通过场景"""
        task = create_task("Implement concurrent cache")
        
        # 模拟多次红灯失败
        for _ in range(5):
            result = run_tests(task)
            record_tdd(task, phase="RED", result="failed")
        
        # 应该检测到卡住并提供选项
        with patch('time.time', side_effect=[0, 1800]):  # GAP-067 修复：30分钟为示例值；若 speckit/bmad 定义了 TDD 卡住阈值，测试应与其一致
            alert = check_tdd_stuck(task)
            assert alert is not None
            assert "options" in alert
            assert "continue" in alert["options"]
            assert "skip" in alert["options"]
            assert "rollback" in alert["options"]
    
    def test_code_reviewer_unavailable(self):
        """测试code-reviewer不可用场景"""
        document = create_document()
        
        # 模拟code-reviewer不可用
        with patch('cursor_task_code_reviewer', side_effect=Exception("Not found")):
            # 应该回退到mcp_task
            with patch('mcp_task_general_purpose') as mock_mcp:
                result = audit_document(document)
                mock_mcp.assert_called_once()
                # 验证传入了audit-prompts内容
                assert "audit-prompts" in mock_mcp.call_args[1]["prompt"]
    
    def test_epic_worktree_conflict_threshold_exceeded(self):
        """测试Epic级worktree冲突阈值超限场景"""
        epic_id = 4
        
        # 模拟6次冲突（阈值5）
        for i in range(6):
            record_conflict(epic_id, story1=i, story2=i+1)
        
        # 应该触发回滚建议
        suggestion = check_conflict_threshold(epic_id)
        assert suggestion["action"] == "suggest_rollback"
        assert suggestion["reason"] == "conflict_threshold_exceeded"
    
    def test_worktree_creation_failure(self):
        """测试worktree创建失败场景"""
        with patch('git_worktree_add', side_effect=Exception("Permission denied")):
            with pytest.raises(WorktreeCreationError):
                create_epic_worktree(epic_id=4)
            
            # 应该提供故障排除指南
            assert "troubleshooting" in str(WorktreeCreationError)
    
    def test_pr_merge_without_approval(self):
        """测试未经批准的PR merge尝试"""
        pr = create_pull_request(epic_id=4, story_num=1)
        
        # 尝试自动merge（应该被拒绝）
        with pytest.raises(AutoMergeForbidden):
            auto_merge(pr)
        
        # 验证PR状态未变
        assert pr.status == "open"
    
    def test_dependency_cycle_detection(self):
        """测试循环依赖检测"""
        # 创建循环依赖：Task 1 -> Task 2 -> Task 3 -> Task 1
        tasks = {
            "Task 1": ["Task 2"],
            "Task 2": ["Task 3"],
            "Task 3": ["Task 1"]  # 循环！
        }
        
        with pytest.raises(DependencyCycleError):
            topological_sort(tasks)
    
    def test_batch_push_partial_failure(self):
        """测试批量推送部分失败场景（**GAP-089 修复**：mock 需与 batch_push 实际调用顺序一致；或使用更精确的 mock 如 per-story patch）"""
        epic_id = 4
        stories = [1, 2, 3]
        
        # 模拟Story 2推送失败
        with patch('push_to_remote', side_effect=[True, Exception("Network"), True]):
            results = batch_push_stories(epic_id, stories)
            
            assert results[0]["status"] == "success"
            assert results[1]["status"] == "failed"
            assert results[2]["status"] == "success"
            
            # 应该提供重试选项
            assert "retry_option" in results[1]
```

**验收标准**:
- [ ] 创建test_error_handling.py文件
- [ ] 包含9个错误处理场景测试
- [ ] 使用unittest.mock进行模拟
- [ ] 每个测试验证特定的错误处理逻辑

---

### 任务6.3：编写回归测试

**修改路径**: 新建 `tests/regression/test_backward_compatibility.py`

**修改内容**:
```python
"""
向后兼容性回归测试
确保新功能不影响原有流程
"""

import pytest

class TestBackwardCompatibility:
    """向后兼容性测试"""
    
    def test_legacy_story_level_worktree_still_works(self):
        """测试原有Story级worktree流程仍然可用"""
        # 使用旧配置（无adaptive设置）
        config = {"worktree_granularity": "story-level"}
        
        # 创建Story级worktree
        worktree = create_worktree(
            epic_id=4,
            story_num=1,
            config=config
        )
        
        # 验证是Story级
        assert worktree.type == "story-level"
        assert "story-4-1" in worktree.path
    
    def test_legacy_bmad_without_layer_1(self):
        """测试不使用Layer 1的旧流程仍然可用"""
        # 直接从Create Story开始（跳过Layer 1和2）
        story = create_story_directly(
            epic_id=4,
            story_num=1,
            title="Legacy story"
        )
        
        # 验证可以正常执行
        assert story.document is not None
        
        # 验证可以嵌套speckit
        spec = run_specify(story)
        assert spec is not None
    
    def test_legacy_speckit_without_bmad(self):
        """测试不嵌套在bmad中的speckit仍然可用（GAP-030 修复：standalone 输入 requirements.md 时输出可灵活）"""
        # 直接调用speckit workflow
        spec = run_specify_standalone(
            input_file="requirements.md"
        )
        # standalone 无 Epic/Story 时，输出可为 spec-standalone.md 或含输入文件名的变体；有 Epic/Story 时用 spec-E{epic}-S{story}.md
        assert spec.filename is not None and "spec" in spec.filename
        
        plan = run_plan_standalone(spec)
        # GAP-055 修复：standalone 无 Epic/Story 时输出可为 plan-standalone.md 或含输入文件名的变体
        assert plan.filename is not None and "plan" in plan.filename
    
    def test_existing_projects_not_affected(self):
        """测试现有项目不受影响"""
        # 模拟已有项目（无新配置文件）
        project = load_existing_project()
        
        # 验证原有命令仍然可用
        result = run_legacy_command("/bmad-bmm-dev-story epic=1 story=1")
        assert result.success is True
        
        # 验证没有创建新的配置文件
        assert not file_exists("_bmad-output/config/epic-1.json")
    
    def test_gradual_migration_path(self):
        """测试渐进式迁移路径"""
        # 第一步：保持原有行为
        config = {}  # 空配置
        assert get_default_worktree_strategy(config) == "story-level"
        
        # 第二步：启用adaptive（显式配置）
        config["worktree_granularity"] = "adaptive"
        assert get_default_worktree_strategy(config) == "adaptive"
        
        # 第三步：可以临时覆盖
        worktree = create_worktree(
            epic_id=4,
            story_num=1,
            config=config,
            override_type="story-level"  # 临时覆盖
        )
        assert worktree.type == "story-level"
```

**验收标准**:
- [ ] 创建test_backward_compatibility.py文件
- [ ] 包含5个向后兼容性测试
- [ ] 验证原有流程不受影响
- [ ] 验证渐进式迁移路径

---

### 任务6.4：编写性能基准测试

**修改路径**: 新建 `tests/performance/test_worktree_performance.py`

**修改内容**:
```python
"""
Worktree性能基准测试
验证Epic级worktree的性能优势
"""

import pytest
import time
from statistics import mean

class TestWorktreePerformance:
    """Worktree性能测试"""
    
    def test_epic_vs_story_level_creation_time(self):
        """测试Epic级vs Story级worktree创建时间"""
        # Story级：10个Story，每个单独创建
        story_times = []
        for i in range(10):
            start = time.time()
            create_story_worktree(epic_id=4, story_num=i)
            story_times.append(time.time() - start)
        
        avg_story_time = mean(story_times)
        total_story_time = sum(story_times)
        
        # Epic级：1个Epic worktree
        start = time.time()
        epic_worktree = create_epic_worktree(epic_id=5)
        epic_time = time.time() - start
        
        # 创建10个Story分支
        branch_times = []
        for i in range(10):
            start = time.time()
            create_story_branch(epic_worktree, epic_id=5, story_num=i)
            branch_times.append(time.time() - start)
        
        total_epic_time = epic_time + sum(branch_times)
        
        # GAP-012 修复：改为相对比较，弱环境下可能 flaky；加容差或标注为参考基准
        # 验证Epic级更快（至少快30%，容差 0.7；或标注为参考基准非硬性断言）
        assert total_epic_time < total_story_time * 0.7, "Epic级应快于Story级（参考基准，非硬性）"
        print(f"Story级总时间: {total_story_time:.2f}s")
        print(f"Epic级总时间: {total_epic_time:.2f}s")
        print(f"改善: {(1 - total_epic_time/total_story_time)*100:.1f}%")
    
    def test_context_switch_time(self):
        """测试上下文切换时间"""
        # Story级：切换worktree
        story_worktrees = [create_story_worktree(epic_id=4, story_num=i) for i in range(3)]
        
        story_switch_times = []
        for i in range(10):  # 切换10次
            start = time.time()
            switch_worktree(story_worktrees[i % 3])
            story_switch_times.append(time.time() - start)
        
        avg_story_switch = mean(story_switch_times)
        
        # Epic级：切换分支
        epic_worktree = create_epic_worktree(epic_id=5)
        branches = [create_story_branch(epic_worktree, epic_id=5, story_num=i) for i in range(3)]
        
        branch_switch_times = []
        for i in range(10):
            start = time.time()
            switch_branch(branches[i % 3])
            branch_switch_times.append(time.time() - start)
        
        avg_branch_switch = mean(branch_switch_times)
        
        # GAP-012 修复：加容差或标注为参考基准
        # GAP-073 修复：参考基准断言失败时使用 pytest.warns 或 pytest.mark.xfail(strict=False)；或 skipif 弱环境
        assert avg_branch_switch < avg_story_switch * 0.7, "分支切换应快于worktree切换（参考基准）"
        print(f"Worktree切换平均: {avg_story_switch:.2f}s")
        print(f"分支切换平均: {avg_branch_switch:.2f}s")
    
    def test_memory_usage(self):
        """测试内存占用"""
        import psutil
        
        # Story级：10个worktree（**GAP-062 修复**：Windows 下 rss≈working set，与 Linux 语义略有差异；标注为参考基准，弱环境可能 flaky）
        process = psutil.Process()
        mem_before = process.memory_info().rss
        
        story_worktrees = [create_story_worktree(epic_id=4, story_num=i) for i in range(10)]
        mem_story = process.memory_info().rss - mem_before
        
        # 清理
        for wt in story_worktrees:
            delete_worktree(wt)
        
        # Epic级：1个worktree + 10个分支
        mem_before = process.memory_info().rss
        epic_worktree = create_epic_worktree(epic_id=5)
        branches = [create_story_branch(epic_worktree, epic_id=5, story_num=i) for i in range(10)]
        mem_epic = process.memory_info().rss - mem_before
        
        # Epic级内存占用应该更少
        assert mem_epic < mem_story
        print(f"Story级内存: {mem_story / 1024 / 1024:.2f} MB")
        print(f"Epic级内存: {mem_epic / 1024 / 1024:.2f} MB")
        
        # GAP-040 修复：teardown 清理 Epic worktree 及分支
        for b in branches:
            delete_branch(b)
        delete_worktree(epic_worktree)
```

**验收标准**:
- [ ] 创建test_worktree_performance.py文件
- [ ] 包含3个性能测试（创建时间/切换时间/内存占用）
- [ ] 验证Epic级比Story级快（参考基准，容差 0.7；见 GAP-012）；（**GAP-073 修复**：参考基准断言统一使用 `pytest.mark.xfail(strict=False)`，失败时标记为 xfail 不阻塞）
- [ ] 使用statistics计算平均值

---

### 任务6.5：编写测试数据工厂

**修改路径**: 新建 `tests/factories.py`

**修改内容**:
```python
"""
测试数据工厂
用于生成测试所需的各类数据对象

GAP-013 修复：验证 factory_boy 版本（支持 post_generation）；factory.List 可能需改为
factory.LazyFunction(lambda: []) 或使用 factory.SubFactory 链；with_stories 需与 post_generation 签名兼容
"""

import factory
from datetime import datetime

class EpicFactory(factory.Factory):
    """Epic数据工厂"""
    class Meta:
        model = dict
    
    id = factory.Sequence(lambda n: n)
    name = factory.LazyAttribute(lambda obj: f"feature-test-{obj.id}")
    description = "Test epic description"
    estimated_hours = 80
    stories = factory.LazyFunction(list)  # GAP-013: 替代 factory.List([])，兼容性更好
    
    @factory.post_generation
    def with_stories(obj, create, extracted, **kwargs):
        if extracted:
            obj["stories"] = [
                StoryFactory.build(epic_id=obj["id"], num=i)
                for i in range(1, extracted + 1)
            ]

class StoryFactory(factory.Factory):
    """Story数据工厂"""
    class Meta:
        model = dict
    
    epic_id = 4
    num = factory.Sequence(lambda n: n)
    id = factory.LazyAttribute(lambda obj: f"{obj.epic_id}.{obj.num}")
    title = factory.LazyAttribute(lambda obj: f"Story {obj.id}")
    description = "Test story description"
    status = "pending"
    document = factory.LazyAttribute(lambda obj: f"""
# Story {obj.id}: {obj.title}

## PRD追溯
| PRD需求ID | 描述 | 状态 |
|-----------|------|------|
| REQ-00{obj.num} | Test requirement | 已覆盖 |

## Architecture约束
| 组件 | 约束 | 对应task |
|------|------|---------|
| TestService | Must be scalable | Task {obj.num} |
""")

class PRDFactory(factory.Factory):
    """PRD数据工厂"""
    class Meta:
        model = dict
    
    title = "Test PRD"
    version = "1.0"
    created_at = factory.LazyFunction(datetime.now)
    requirements = factory.List([
        {"id": "REQ-001", "description": "Test req 1", "priority": "P0"},
        {"id": "REQ-002", "description": "Test req 2", "priority": "P1"},
    ])
    complexity_score = 10

class ArchitectureFactory(factory.Factory):
    """Architecture数据工厂"""
    class Meta:
        model = dict
    
    title = "Test Architecture"
    components = factory.List([
        {"name": "TestService", "type": "microservice"},
        {"name": "TestDB", "type": "database"},
    ])
    decisions = factory.List([
        {"id": "ADR-001", "title": "Use microservices", "status": "accepted"},
    ])

class WorktreeFactory(factory.Factory):
    """Worktree数据工厂"""
    class Meta:
        model = dict
    
    epic_id = 4
    type = "epic-level"  # or "story-level"
    path = factory.LazyAttribute(lambda obj: 
        f"{repo_name}-feature-epic-{obj.epic_id}" 
        if obj.type == "epic-level" 
        else f"{repo_name}-story-{obj.epic_id}-1"
    )
    created_at = factory.LazyFunction(datetime.now)

# 便捷函数
def create_test_epic_with_stories(story_count=7):
    """创建测试Epic和Story"""
    return EpicFactory(with_stories=story_count)

def create_test_prd(complexity_score=10):
    """创建测试PRD"""
    return PRDFactory(complexity_score=complexity_score)

def create_test_worktree(worktree_type="epic-level"):
    """创建测试worktree"""
    return WorktreeFactory(type=worktree_type)
```

**验收标准**:
- [ ] 创建factories.py文件
- [ ] 包含5个Factory类（Epic/Story/PRD/Architecture/Worktree）
- [ ] 包含3个便捷函数
- [ ] 使用factory_boy库风格

---

### 任务6.6：编写单元测试

**修改路径**: 新建 `tests/unit/test_speckit_integration_units.py`

**GAP-065 修复**：以下函数需在 conftest 或本文件 fixtures 中定义：evaluate_complexity, party_mode_triggered, get_worktree_strategy, detect_file_overlap, get_audit_prompt

**修改内容**:
```python
"""
BMAD-Speckit整合方案单元测试
覆盖各模块的独立逻辑，不依赖端到端流程
"""

import pytest

class TestComplexityEvaluation:
    """复杂度评估单元测试"""
    
    def test_complexity_score_calculation(self):
        """测试复杂度分数计算"""
        score = evaluate_complexity(business=3, technical=4, impact=2)
        assert score == 9
        assert party_mode_triggered(score) == "50轮"  # 7-10分
    
    def test_party_mode_trigger_rules(self):
        """测试Party-Mode触发规则"""
        assert party_mode_triggered(6) is None  # ≤6跳过
        assert party_mode_triggered(8) == "50轮"  # 7-10
        assert party_mode_triggered(12) == "80轮"  # 11-15

class TestWorktreeStrategy:
    """Worktree策略单元测试"""
    
    def test_story_count_to_strategy(self):
        """测试Story数量到策略的映射"""
        assert get_worktree_strategy(story_count=2) == "story-level"
        assert get_worktree_strategy(story_count=5) == "epic-level"
    
    def test_file_overlap_detection(self):
        """测试文件重叠检测"""
        story1_files = {"a.py", "b.py"}
        story2_files = {"b.py", "c.py"}
        overlap = detect_file_overlap(story1_files, story2_files)
        assert overlap == {"b.py"}

class TestCodeReviewerIntegration:
    """Code-reviewer集成单元测试"""
    
    def test_audit_prompt_section_resolution(self):
        """测试审计提示词章节解析"""
        prompt = get_audit_prompt(section=5)
        assert "执行 tasks.md" in prompt
        assert "完全覆盖、验证通过" in prompt
```

**验收标准**:
- [ ] 创建test_speckit_integration_units.py
- [ ] 覆盖复杂度评估、worktree策略、code-reviewer集成等独立逻辑
- [ ] 每个测试验证单一职责，无依赖

---

### 任务6.7：metrics-cache-fix端到端验证场景

**修改路径**: 在 `tests/integration/test_bmad_speckit_integration.py` 中新增或补充

**GAP-079 修复**：6.7 侧重 metrics-cache-fix 场景的端到端验证（Epic 4 专用）；6.1 的 test_end_to_end_full_flow 为通用流程；两者互补，6.7 为 6.1 的专项扩展。

**修改内容**:
```python
def test_metrics_cache_fix_validation_scenario(self):
    """
    metrics-cache-fix场景端到端验证
    审计要求：metrics-cache-fix验证场景必须作为独立任务纳入
    """
    # Epic 4: feature-metrics-cache, 7个Story
    epic_id = 4
    story_count = 7
    
    # 1. 创建Epic级worktree
    worktree = create_epic_worktree(epic_id)
    assert worktree.type == "epic-level"
    
    # 2. 依次完成Story 4.1-4.7
    for story_num in range(1, 8):
        story = load_story(epic_id, story_num)
        # 执行speckit嵌套：specify→plan→gaps→tasks→TDD
        run_speckit_integration(story)
        assert story.status == "completed"
    
    # 3. 验证PR创建与审核流程
    prs = [create_pr_for_story(epic_id, s) for s in range(1, 8)]
    assert len(prs) == 7
    for pr in prs:
        with pytest.raises(AutoMergeForbidden):
            auto_merge(pr)
        # 模拟人工批准后merge
        user_approve(pr)
        merge_pull_request(pr)
    
    # 4. 验证最终产出
    assert all_epic_stories_merged(epic_id)
    assert regression_tests_pass()
```

**验收标准**:
- [ ] metrics-cache-fix（Epic 4, 7 Story）作为独立验证场景
- [ ] 覆盖worktree创建→Story完成→PR审核→merge全流程
- [ ] 验证强制人工审核（AutoMergeForbidden）

---

## 缓冲任务（21小时，含7.1~7.3共14h+意外预留7h）

### 任务7.1：处理实施过程中的意外问题

**预留工时**: 8小时

**说明**: 用于处理实施过程中出现的未预期问题，如：
- 技能文件结构差异导致修改困难
- 依赖库版本冲突
- 测试环境配置问题
- 性能优化需求

**GAP-015 修复：问题记录模板**（每遇到问题须按此格式记录）：
```markdown
| 问题 | 根因 | 解决方案 | 影响任务 |
|------|------|----------|----------|
| [简短描述] | [根本原因] | [采取的措施] | [受影响的任务ID]（**GAP-077 修复**：多任务时列出所有 ID 逗号分隔，或仅列最主要任务） |
```

**验收标准**:
- [ ] 记录所有遇到的问题（使用上述模板）
- [ ] 记录解决方案
- [ ] 更新文档反映实际情况

---

### 任务7.2：文档更新和同步

**预留工时**: 4小时

**说明**: 根据实际实施情况更新文档：
- 修正行号引用
- 补充实际遇到的边界情况
- 更新工作量估算（如有偏差）
- 完善示例代码

**验收标准**:
- [ ] 所有文档与实际代码一致
- [ ] 示例代码经过验证可运行
- [ ] 常见问题FAQ补充完整

---

### 任务7.3：团队培训和知识转移

**预留工时**: 2小时

**说明**: 为使用新流程的团队成员提供培训：
- 五层架构概念讲解
- 新命令和工具使用演示
- 最佳实践分享
- Q&A答疑

**交付物**:
- [ ] 培训幻灯片或文档
- [ ] 录制演示视频（可选）
- [ ] FAQ文档

---

### 任务7.4：意外预留（7小时）

**预留工时**: 7小时

**说明**: 处理实施过程中发现的未预见问题（对应缓冲21h中的「意外预留7h」）。可与7.1合并执行，单独列出以明确工时归属。（**GAP-049 修复**：合并执行时**主规则**为按问题类型——7.1 处理阻塞类，7.4 处理非阻塞类；**GAP-068 修复**：若同一问题兼具阻塞与非阻塞，一律按 7.1 处理，7.4 仅处理纯非阻塞类）

**交付物**:
- [ ] 问题记录与解决清单（如有）

---

### 任务7.5：弹性缓冲

**预留工时**: 0小时（可被挤压或挪用）

**说明**: 冲刺末期调整用，无固定工时；可吸收范围蔓延或用于提前完成时的缓冲。

**交付物**:
- [ ] 无（按需使用）

---

## 任务依赖关系图

```
阶段1 (speckit-workflow)
├── 任务1.1 (快速决策指引)
├── 任务1.2 (code-review调用策略)
├── 任务1.3 (plan阶段party-mode)
├── 任务1.4 (TDD记录格式)
├── 任务1.5 (流程小结bmad对应)
├── 任务1.6 (任务分批执行)
├── 任务1.7 (审计质量评级)
└── 任务1.8 (enforcement说明)
    │
    ▼
阶段2 (bmad-story-assistant) ◄── 依赖阶段1
├── 任务2.1 (快速决策指引)
├── 任务2.2 (阶段零-Layer 1)
├── 任务2.3 (Layer 2规划)
├── 任务2.4 (文档映射关系)
├── 任务2.5 (修改阶段三)
├── 任务2.6 (修改阶段四)
├── 任务2.7 (引用约束)
├── 任务2.8 (回退机制)
├── 任务2.9 (自检清单)
└── 任务2.10 (批判审计员角色)
    │
    ▼
阶段3 (using-git-worktrees) ◄── 依赖阶段1
├── 任务3.1 (Adaptive Worktree)
├── 任务3.2 (Epic级创建逻辑)
├── 任务3.3 (Story分支管理)
├── 任务3.4 (串并行模式切换)
├── 任务3.5 (冲突检测审计)
├── 任务3.6 (回滚机制)
├── 任务3.7 (触发时机更新)
└── 任务3.8 (bmad-customization-backup 迁移)
    │
    ▼
阶段4 (code-reviewer扩展) ──┐
├── 任务4.1 (多模式配置)    │
├── 任务4.2 (PRD提示词)     │
├── 任务4.3 (Arch提示词)    │
└── 任务4.4 (PR提示词)      │
                            │
阶段5 (PR自动化) ◄──────────┼── 依赖阶段3
├── 任务5.1 (整合pr-template)
├── 任务5.2 (批量Push)
└── 任务5.3 (强制人工审核)
                            │
阶段6 (集成测试) ◄──────────┴── 依赖阶段2,4,5
├── 任务6.1 (端到端测试)
├── 任务6.2 (错误处理测试)
├── 任务6.3 (回归测试)
├── 任务6.4 (性能测试)
├── 任务6.5 (测试数据工厂)
├── 任务6.6 (单元测试)
└── 任务6.7 (metrics-cache-fix验证场景)

缓冲任务
├── 任务7.1 (意外问题)
├── 任务7.2 (文档更新)
├── 任务7.3 (团队培训)
├── 任务7.4 (意外预留7h)
└── 任务7.5 (弹性缓冲)
```

---

## 验收标准汇总

### P0 - 必须完成（阻塞上线）

**GAP-050 修复**：P0 阻塞上线；P1 不阻塞但影响体验；任务 6.2（错误处理测试）失败不阻塞上线，但须记录并纳入 7.1 意外问题处理。
**GAP-083 修复**：任务 6.1 中 test_layer_1~4、test_end_to_end_full_flow、test_stage4_parallel 为 P0 必须通过；其余为 P1。

- [ ] 任务1.1-1.8完成（speckit-workflow修改）
- [ ] 任务2.1-2.10完成（bmad-story-assistant修改）
- [ ] 任务3.1-3.8完成（using-git-worktrees修改）
- [ ] 任务 X 完成（阶段1-3 后执行 bmad-customization-backup 备份）
- [ ] 任务4.1-4.4完成（code-reviewer扩展）
- [ ] 任务5.1-5.3完成（PR自动化整合）
- [ ] 任务6.1完成（端到端测试通过）
- [ ] 任务6.6完成（单元测试通过）
- [ ] 任务6.7完成（metrics-cache-fix验证场景通过）
- [ ] 所有P0测试用例通过

### P1 - 应该完成（影响体验）

- [ ] 任务6.2完成（错误处理测试通过）
- [ ] 任务6.3完成（回归测试通过）
- [ ] 任务6.4完成（性能基准测试通过）
- [ ] 任务6.5完成（测试数据工厂可用）
- [ ] 任务7.1完成（意外问题处理完毕）

### P2 - 可以延后（锦上添花）

- [ ] 任务7.2完成（文档更新）
- [ ] 任务7.3完成（团队培训）
- [ ] 任务7.4完成（意外预留按需使用）
- [ ] 任务7.5完成（弹性缓冲按需使用）
- [ ] 性能优化（如测试发现瓶颈）

---

*本文档由BMAD-Speckit整合方案Final v2.0生成*（**GAP-090 修复**：TASKS 版本 v1.1 为本文档迭代版本；来源「Final v2.0」为 FINAL-COMPLETE 方案版本，两者独立）
*版本: v1.1 | 日期: 2026-03-02 | 任务数: 48 | 总工时: 100小时*
