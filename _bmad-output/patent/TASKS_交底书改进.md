# 技术交底书改进任务列表

> **来源**: Party-Mode 审计（批判审计员 >50%，100 轮收敛，连续 3 轮无新 Gap）  
> **审计对象**: `_bmad-output/patent/技术交底书_BMAD-Speckit-SDD-Flow.md`  
> **审计依据**: 项目实际代码实现状态 vs 交底书文本声称  
> **日期**: 2026-03-05  
> **前瞻性占位布局三大前提**: (1) 如实披露状态 (2) 完整可实现技术方案 (3) 明确合规依据

---

## 致命级（必须修正，否则影响专利可信度）

### FIX-01: 模块 6 整体描述为已实现 → 实际几乎全未实现

**问题所在行**: L81-84（模块 6 全段）  
**交底书原文**:
> "能力短板定位与聚类分析：系统后台脚本定期扫描持久化的 jsonl 审计记录。提取评分为 C/D 级的用例及频发的一票否决项事件...应用 NLP 聚类算法将其映射为模型特定能力维度的短板。"
> "微调数据集与优化建议自动生成：系统从真实业务（real_dev）及评估（eval_question）双场景中...自动拼装生成高质量对比代码块，输出可直接用于大模型 SFT（监督微调）的结构化数据集..."

**实际状态**:
- `NLP 聚类算法`: 不存在。无 sklearn/spacy/nltk 等任何 NLP/ML 代码
- `SFT 数据集自动生成`: 不存在。无提取 bad/good code pair 的代码
- `prompt 模板自动优化`: 不存在。无自动生成 prompt 补丁的代码
- `后台脚本定期扫描`: 不存在。无 cron/scheduler/定时任务
- `eval_question` 场景: schema 支持，但实际从未使用（所有 accept 脚本均用 `real_dev`）
- AI Coach (`scoring/coach/diagnose.ts`): 已实现，但仅做阈值判定（score < 70 → weak_area），不做聚类分析

**修正方案**: 将模块 6 改写为「前瞻性扩展实施例」，具体改法：
1. 在模块 6 段首增加标注：`[当前架构已预留数据接口，以下为基于既有审计数据的前瞻性扩展实施例，尚未落地为可执行代码]`
2. 保留技术方案描述（NLP 聚类、SFT 提取等），但改用"可进一步实现"、"预留扩展接口"等表述
3. 将已实现的 AI Coach 部分单独作为"已落地的基础能力短板诊断"描述，与前瞻性部分明确区分
4. 在 4.3 有益技术效果中，模块 6 对应的效果需标注为"预期效果"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L81-84, L91

---

### FIX-02: 技术效果数据缺乏实证支撑

**问题所在行**: L88-92（4.3 有益技术效果全段）  
**交底书原文**:
> "因架构偏离造成的返工率降低了至少 40%"
> "评审结论与打分可复现率达到 100%"
> "消除了高达 90% 级别的大模型幻觉式验收"
> "将深层次（如并发、锁竞争边界态等）架构级 Gap 的发现并修复率从不足 65% 提升至接近 100%"

**实际状态**:
- 无任何数据采集机制来统计"返工率"
- AI 响应本质非确定性，"100% 可复现"在技术上不成立
- "90% 幻觉消除"和"65%→100% Gap 修复率"均无实证数据

**修正方案**:
1. 将具体数值改为定性描述 + 机制支撑：如"通过前置规范锁定机制，有效降低了因架构偏离造成的返工概率"
2. "100% 可复现率"改为"在相同配置和相同输入条件下，系统评审流程的确定性步骤（工具硬校验、规则匹配、分值计算）100% 可复现"（将可复现性限定在确定性部分）
3. "90% 幻觉消除"改为"通过工具退出码强制前置校验，有效阻断了大模型幻觉式验收通过"
4. "65%→100%"改为"多角色辩论机制显著提升了深层架构级 Gap 的发现率"
5. 或者补充实际落地案例的对比数据来支撑（推荐在实际使用后补充）

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L88-92

---

## 严重级（必须修正，影响技术方案准确性）

### FIX-03: commit_hash 版本锁定描述需更新为实际实现方案 ⚠️ 部分解决

**问题所在行**: L55（模块 1）, L130/131/132（附图 1）, L174/186（附图 2）, L264（附图 3）  
**交底书原文**:
> "系统强制读取 spec.md 节点经审计落盘后对应的 commit 哈希版本。若版本不匹配...系统将拦截流转指令"
> 附图 1 中 `R -->|锁定 commit_hash| S`
> 附图 3 中 `scores.jsonl (包含 timestamp 和 commit_hash)`

**GAP-B01 已实现（2026-03-05）**: 
- `RunScoreRecord` 新增 `base_commit_hash`（git HEAD 短 hash）和 `content_hash`（审计内容 SHA-256）
- `parseAndWriteScore` 默认自动采集两个字段
- 路径 C 方案：审计阶段代码通常未提交，`base_commit_hash` 记录修改前基线，`content_hash` 记录审计内容指纹

**仍需修正的交底书描述**:
1. 交底书中 `commit_hash` 应改为 `base_commit_hash + content_hash` 双字段方案的准确描述
2. 附图 1 `|锁定 commit_hash|` 改为 `|记录 base_commit_hash + content_hash|`
3. 附图 3 `(包含 timestamp 和 commit_hash)` 改为 `(包含 timestamp、base_commit_hash 和 content_hash)`
4. L55 "若版本不匹配...系统将拦截流转指令"：版本锁定校验机制（GAP-B02）尚未实现，此句仍需标注为前瞻性或待实现
5. 附图 2 中 L171/L183 的 `记录当前文件哈希` 描述现在已有代码支撑（`computeStringHash`），可保留

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L55, L130-132, L171, L174, L183, L186, L264

---

### FIX-04: "NLP 解析树" 描述不实

**问题所在行**: L59（模块 2）  
**交底书原文**:
> "解析引擎通过正则表达式及 NLP 解析树，根据配置的权重提取..."

**实际状态**:
- 解析器 (`scoring/parsers/audit-prd.ts`, `audit-arch.ts`, `audit-story.ts`) 100% 基于正则表达式
- 无任何 NLP 库引入（无 spacy, nltk, transformers 等）
- 无语法解析树（parse tree）构建

**修正方案**: 将"正则表达式及 NLP 解析树"改为"正则表达式与模式匹配规则"。如果后续实现 NLP，可再补充。

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L59, L239（附图 3 participant `NLP as 正则与 NLP 提取器` 改为 `NLP as 正则提取器`）, L318（附图 5 `B[调用 NLP 聚类及正则特征提取]` 改为 `B[调用正则表达式特征提取]`）

---

### FIX-05: "主控制器挂起大模型访问权限" 描述不实

**问题所在行**: L71（模块 4）  
**交底书原文**:
> "审计事件触发时，主控制器挂起大模型访问权限，首先调度系统 Shell 调用 pytest、jest 或 eslint"

**实际状态**:
- 无"主控制器"程序。流程由 Skill markdown 指令（如 speckit-workflow SKILL.md 的 TDD 规则）指导 AI 先运行测试
- AI 的访问权限无法被程序化"挂起"——这是 Skill 文本约束，非代码强制
- "调度系统 Shell 调用"实际上是 AI Agent 根据 prompt 指令执行 shell 命令

**修正方案**: 改写为准确描述实际机制：
> "系统通过预定义的审计 Prompt 模板（audit-prompts.md §5），强制要求 Agent 在评审环节优先执行系统 Shell 命令（如 pytest、jest），并以工具退出码（Exit Code）作为强制前提判据。当退出码非 0 时，Prompt 模板中的硬约束规则禁止 Agent 给出通过结论。"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L71, L235（附图 3 participant `Ctrl as 主控制器中枢` 改为 `Ctrl as 流程调度中枢`）

---

### FIX-06: "系统监听 IDE 终端输出" 描述不实

**问题所在行**: L65（模块 3）  
**交底书原文**:
> "系统监听 IDE 终端输出或版本库钩子，当侦测到'测试失败'或特定错误关键字时，暂停主状态机..."

**实际状态**:
- 实际机制：Cursor Rule `.cursor/rules/bmad-bug-auto-party-mode.mdc`（`alwaysApply: true`）
- 触发条件：**用户消息**中包含错误关键词（测试失败、test failed、AssertionError、traceback、bug 等）
- 不是"监听 IDE 终端输出"，不是"版本库钩子"，不是程序化侦测

**修正方案**: 改写为：
> "系统通过常驻规则文件（alwaysApply 规则），在 IDE 会话中对用户输入进行关键词匹配。当用户消息中出现错误相关关键词（如'测试失败'、'traceback'、'AssertionError'等预定义模式）时，系统自动触发独立的 Bugfix 工作流..."

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L65

---

### FIX-07: "规则自动优化"描述为已实现 → 实际未实现

**问题所在行**: L92（4.3 第 5 条效果）  
**交底书原文**:
> "系统能够从底层审计库的错误分布中，自动推演出对规范要求集的补充更新（例如将高频漏洞列为自动化防呆检查项）"

**实际状态**:
- 无代码实现规则自优化
- AI Coach (`scoring/coach/diagnose.ts`) 输出 recommendations，但这些是阈值驱动的静态建议，不会自动更新 YAML 规则文件

**修正方案**:
1. 标注为前瞻性能力："[基于 AI Coach 的诊断输出，系统架构已预留规则自优化接口；当前版本中，AI Coach 输出人工可操作的改进建议，规则的实际更新由开发者确认后手动执行]"
2. 或改写效果描述为已实现部分："AI Coach 模块基于评分数据自动输出短板诊断和改进建议，为规则优化提供数据驱动的依据"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L92

---

## 中等级（建议修正，提升准确性）

### FIX-08: "一票否决字典树" → 实际是 YAML pattern matching

**问题所在行**: L61（模块 2）  
**交底书原文**:
> "配置引擎中定义了如 veto_core_logic...等一票否决字典树。解析引擎在审计日志全文检索，一旦匹配到字典树特定节点..."

**实际状态**:
- `scoring/veto/veto.ts` 中 `isVetoTriggered()` 使用 `buildVetoItemIds()` 从 check_items 提取 veto item_id
- `config/audit-item-mapping.yaml` 使用 `text/patterns` 做字符串 `includes()` 匹配
- 不是"字典树"（Trie），是简单的 pattern list 遍历匹配

**修正方案**: 将"字典树"改为"否决项配置表"或"否决项模式匹配规则库"，改"匹配到字典树特定节点"为"匹配到预定义的否决项标识"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L61, L322（附图 5 `E[并行进入 Veto 字典树检索]` 改为 `E[进入 Veto 否决项匹配]`）

---

### FIX-09: "审查 Agent 与代码 Agent 物理隔离" 表述夸大

**问题所在行**: L72（模块 4）  
**交底书原文**:
> "系统架构上严格区分'代码实现 Agent'与'代码审查 Agent'。审查 Agent 被剥离写代码权限"

**实际状态**:
- 隔离方式：Skill markdown 指令（`bmad-story-assistant SKILL.md` 规定"主 Agent 禁止直接修改生产代码"，审计通过 subagent 执行）
- 非"系统架构上"的物理隔离，是 prompt 层面的角色约束
- Agent 权限无法在 Cursor 平台层被程序化"剥离"

**修正方案**: 改为：
> "系统通过 Skill 配置文件严格约束角色边界：代码实现任务仅允许通过指定子 Agent 执行，审计任务通过独立的 code-reviewer Agent 处理。主控 Agent 被规则禁止直接修改生产代码，实现逻辑层面的评审与生成解耦。"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L72, L391（创新点 4 中 "审查 Agent 与代码 Agent 物理隔离" 改为 "审查 Agent 与代码 Agent 逻辑隔离"）

---

### FIX-10: scoring-trigger-modes.yaml 的"程序化控制流"表述不实

**问题所在行**: L78（模块 5）  
**交底书原文**:
> "系统在落盘前执行硬逻辑判断：验证 config/scoring-trigger-modes.yaml 的 call_mapping 中是否存在当前节点；判断字段 scoring_write_control.enabled 是否为 true"

**实际状态**:
- `parseAndWriteScore` 函数本身不读取 `scoring-trigger-modes.yaml`
- 调用决策由 AI Agent 根据 Skill 文本（speckit-workflow SKILL.md）的指令决定
- `scoring_write_control.enabled` 由 AI 读取配置判断，非程序化校验

**修正方案**: 改为：
> "Agent 在触发落盘前，依据预定义的触发模式配置文件（scoring-trigger-modes.yaml）中的 call_mapping 和 scoring_write_control.enabled 字段判断是否调用 parseAndWriteScore。写入模块内置场景约束校验（scoring/writer/validate.ts 的 validateScenarioConstraints），如 eval_question 场景强制要求 question_version 字段，校验失败则抛出异常阻止非法数据写入。"

> **审计修正说明**：原方案中 "SCORE_WRITE_INPUT_INVALID" 为 Skill 文本中的协议标识符，非代码中的实际异常名；校验逻辑位于 `scoring/writer/validate.ts` 而非 `parseAndWriteScore` 函数本身。已修正为准确描述。

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L78

---

### FIX-11: spec/plan/tasks 评分规则仅为占位符

**问题所在行**: L59（模块 2 声称"每个细粒度开发节点"评分）  
**交底书原文**:
> "对每个细粒度开发节点实行 100% 程序化的分数制裁"

**实际状态**:
- `scoring/rules/spec-scoring.yaml`: 3 行占位符
- `scoring/rules/plan-scoring.yaml`: 3 行占位符
- `scoring/rules/tasks-scoring.yaml`: 3 行占位符
- 仅 implement、bugfix、gaps 阶段有完整规则

**修正方案**:
1. 将"每个细粒度开发节点"改为"关键开发节点（实现、修复、差距分析等）"
2. 或标注："[spec/plan/tasks 阶段的评分规则已预留维度定义，待后续迭代补充完整规则]"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L59, L389

---

## 轻微级（建议修正）

### FIX-12: "三、背景技术" 章节标题重复

**问题所在行**: L22-23  
**交底书原文**: `## 三、背景技术` 出现了两次（L22 和 L23）

**修正方案**: 删除 L23 的重复行

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L23

---

### FIX-13: "计算机层面的状态机" 表述需精确化

**问题所在行**: L52（模块 1）  
**交底书原文**:
> "本模块通过定义计算机层面的状态机，将 Speckit-SDD 规范驱动开发作为标准流程..."

**实际状态**:
- 无可执行的状态机代码（如 xstate、自定义 FSM 类等）
- 流程由 Skill markdown 定义的节点顺序 + 审计闭环 + Cursor command 序列实现
- 附图 2 的状态图是 Mermaid 描述性图示，非运行时状态机

**修正方案**: 改为：
> "本模块通过预定义的工作流配置文件和审计闭环规则，将 Speckit-SDD 流程作为强制顺序执行的标准化子流程..."
> 或补充说明："状态机逻辑通过 Skill 配置文件（speckit-workflow SKILL.md）和审计 Prompt 模板联合实现节点顺序强制与准入准出控制"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L52, L388（创新点 1 中 "标准化为不可逆的状态机节点序列" 改为 "标准化为不可逆的顺序节点序列"）

---

## 审计补充：遗漏 Gap（code-reviewer 审计发现）

### FIX-14 [新增]: 附图 5 "Git 强制回退" 无代码实现

**问题所在行**: L350（附图 5）  
**交底书原文**:
> `M2["执行 Git 强制回退至上一稳定态"]`

**实际状态**:
- 代码中零 git 操作（scoring/ 目录无 `git reset`/`git revert` 相关代码）
- `stage_0_level_down` 仅为 `implement-scoring.yaml` 中的 consequence 字符串标记，无代码读取并执行 git 回退
- 附图 5 将 "Git 强制回退" 标注为 D 级熔断后的自动操作步骤，与实际完全不符

**修正方案**: 将 L350 `M2["执行 Git 强制回退至上一稳定态"]` 改为 `M2["通知开发者：建议回退至上一稳定态"]`，或 `M2["记录异常阻断事件，由开发者决定回退策略"]`

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L350

---

### FIX-15 [新增]: 模块 2 "四维加权计算" 实际为等级映射

**问题所在行**: L59（模块 2）  
**交底书原文**:
> "解析引擎通过正则表达式...根据配置的权重提取：功能性(30%)、代码质量(30%)、测试覆盖(20%)、安全性(20%)等维度的得分，并由算法合成综合评分"

**实际状态**:
- 所有解析器（`audit-prd.ts` L12-17）评分逻辑为：提取 A/B/C/D 等级 → `GRADE_TO_SCORE` 映射为 100/80/60/40 固定分数
- `code-reviewer-config.yaml` 中定义的四维度权重**未被评分代码使用**
- 权重仅作为 AI Agent 审计时的参考维度，不参与程序化加权计算

**修正方案**: 将 L59 对应部分改为：
> "解析引擎通过正则表达式从审计报告中提取综合等级评定（A/B/C/D），映射为百分制基础分（A=100, B=80, C=60, D=40）。code-reviewer-config.yaml 中定义的四维度权重（功能性 30%、代码质量 30%、测试覆盖 20%、安全性 20%）作为 Agent 审计时的评分参考框架，确保审计覆盖的全面性。"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L59

---

### FIX-16 [新增]: 模块 3 "branch_id/story_id 自动回写" 无代码实现

**问题所在行**: L67（模块 3）  
**交底书原文**:
> "系统提取 BUGFIX 流水线上的变更关联键（branch_id / story_id），自动向原主干 Story 的状态文件（如 progress.txt 及审计日志）追加扣分项及修复轨迹"

**实际状态**:
- `scoring/` 目录中无 `branch_id`、`story_id`、`progress.txt` 的读写代码
- 状态回写由 AI Agent 根据 Skill 指令（bmad-bug-assistant）手动执行

**修正方案**: 将 L67 改为：
> "修复完成后，Skill 配置文件引导 Agent 将 BUGFIX 文档的修复结论和任务完成状态追加至原主干 Story 的状态追踪文件（如 progress.txt），通过关联键（branch_id / story_id）实现生命周期内的可追溯记录。"

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L67

---

### FIX-17 [新增]: 附图 3 写入目标文件名不实

**问题所在行**: L267（附图 3）  
**交底书原文**:
> `Parser->>Disk: 覆盖写入该节点的独立 sprint-status.yaml`

**实际状态**:
- `write-score.ts` 单文件写入目标为 `${record.run_id}.json`，不是 `sprint-status.yaml`
- `sprint-status.yaml` 是独立的手动维护文件

**修正方案**: 将 L267 改为 `Parser->>Disk: 覆盖写入该节点的独立评分记录文件 ({run_id}.json)`

**修改路径**: `技术交底书_BMAD-Speckit-SDD-Flow.md` L267

---

## 修正优先级排序

| 优先级 | Fix 编号 | 核心问题 |
|--------|---------|---------|
| P0 | FIX-01 | 模块 6 未实现但描述为已实现 |
| P0 | FIX-02 | 效果数据无实证 |
| P1 | FIX-03 | ⚠️ commit_hash 已实现为双字段方案，交底书描述待更新 |
| P1 | FIX-04 | NLP 不存在（含附图 3 participant + 附图 5 步骤） |
| P1 | FIX-05 | 主控制器不存在（含附图 3 participant） |
| P1 | FIX-06 | IDE 终端监听不存在 |
| P1 | FIX-07 | 规则自优化未实现 |
| P1 | FIX-14 | **[新增]** 附图 5 Git 强制回退无实现 |
| P1 | FIX-15 | **[新增]** 四维加权计算实为等级映射 |
| P1 | FIX-16 | **[新增]** branch_id/story_id 自动回写无实现 |
| P2 | FIX-08 | 字典树表述不实（含附图 5 步骤） |
| P2 | FIX-09 | Agent 隔离方式夸大（含创新点 4） |
| P2 | FIX-10 | 触发配置非程序化（异常名修正） |
| P2 | FIX-11 | 评分规则占位符 |
| P3 | FIX-12 | 标题重复 |
| P3 | FIX-13 | 状态机表述（含创新点 1） |
| P3 | FIX-17 | **[新增]** 附图 3 写入目标文件名不实 |
