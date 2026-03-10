# 第三轮执行阶段审计报告：Specify 阶段自动推导子目录索引 改进方案

**审计对象**：`docs/BMAD/IMPROVEMENT_SPECIFY阶段自动推导子目录索引_100轮总结.md`  
**审计轮次**：Round 3（执行阶段审计，audit-prompts.md §5 精神）  
**审计视角**：批判审计员占比 >50%  
**目的**：确认连续 3 轮无新 gap 收敛。

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 逐项核对结果

### 1.1 问题陈述、根因、共识

| 核对项 | 结果 | 说明 |
|--------|------|------|
| 1.1 现状（standalone 自动推导 / BMAD 未推导、依赖人工 spec-index-mapping） | ✅ 一致 | 与 create-new-feature.ps1 行为一致：BMAD 分支（约 294–310 行）仅输出 BRANCH_NAME/SPEC_FILE/SPEC_DIR，未调用 Get-HighestNumberFromSpecs |
| 1.2 问题（路径无索引、映射滞后、双轨不一致） | ✅ 一致 | 与 DEBATE 及 spec-index-mapping.md「更新时机」描述一致 |
| 2.1 设计层面根因 | ✅ 一致 | DEBATE 共识路径为 epic-{epic}/story-{story}-{slug}/，未要求嵌入 015 |
| 2.2 实现层面根因 | ✅ 一致 | 脚本 BMAD 分支未调用 Get-HighestNumberFromSpecs、未输出索引、未写映射表 |
| 2.3 流程层面根因 | ✅ 一致 | spec-index-mapping.md 更新时机未绑定自动化步骤 |
| 4.1 原则（路径不变、索引单一来源、指定阶段可用） | ✅ 一致 | 与 DEBATE_spec 及 create-new-feature.ps1 职责划分一致 |

### 1.2 任务 1～6 与 AC1～AC5

| 编号 | 核对内容 | 结果 |
|------|----------|------|
| 任务 1 | BMAD 分支创建目录前调用 Get-HighestNumberFromSpecs，nextIndex 格式化 3 位 | ✅ 表述完整，落地点 create-new-feature.ps1 |
| 任务 2 | 输出增加 SPEC_INDEX 或 FEATURE_NUM，JSON 与文本均包含 | ✅ 见下文「批判项」键名二选一 |
| 任务 3 | speckit-workflow §1.0 说明 BMAD 输出 SPEC_INDEX、调用方应更新映射 | ✅ 与 AC4 一致；SKILL.md §1.0 当前仅 standalone 提及 index |
| 任务 4 | bmad-story-assistant 须解析 SPEC_INDEX 并更新映射（或委托） | ✅ 见下文「批判项」强制程度用词 |
| 任务 5 | 索引与 standalone 共享递增序列等约定；落地位置 spec-index-mapping.md 表头或 TASKS | ✅ 文档已写明落地位置与集中说明位置 |
| 任务 6 | 可选小脚本/文档步骤 | ✅ 明确可选 |
| AC1～AC5 | 与任务、行为约定、Deferred Gaps 无冲突 | ✅ 一致 |

### 1.3 Deferred Gaps 与文档一致性

| ID | 描述 | 与改进方案一致性 |
|----|------|------------------|
| GAP-IDX-1 | 015 对应单个 story 还是整 Epic 的语义 | ✅ 终审条件 2 与任务 5 约定在 spec-index-mapping.md/TASKS 中集中说明；建议与表头「一个 015 可对应多个 Story」统一表述 |
| GAP-IDX-2 | 调用方未实现更新则映射滞后 | ✅ 任务 4、AC4、GAP 建议「必须」在技能/TASKS 中明确 |
| GAP-IDX-3 | 已有 015 与新建 BMAD 的映射策略 | ✅ 约定「新建 BMAD 始终分配新索引；若绑定已有 015 则人工编辑」 |

### 1.4 与 DEBATE / create-new-feature.ps1 / spec-index-mapping 的一致性

| 引用 | 核对结果 |
|------|----------|
| DEBATE_spec 目录命名规则 | 改进方案不改 BMAD 路径，仅增加「推导并输出索引」，与 DEBATE 共识路径一致 |
| create-new-feature.ps1 | 已核实：BMAD 分支无 Get-HighestNumberFromSpecs、无索引输出；standalone 有 FEATURE_NUM（约 424/431 行） |
| spec-index-mapping.md | 更新时机与 4.3「更新动作由调用方根据脚本输出执行」一致；当前无「每 story 消耗一序号」表述（属任务 5 实施范围） |

---

## 2. 批判审计员严格检查（>50% 视角）

### 2.1 SPEC_INDEX 与 FEATURE_NUM 键名选择

- **文档现状**：4.2、任务 2、AC1 均采用「SPEC_INDEX（或 FEATURE_NUM）」或「含 SPEC_INDEX 或 FEATURE_NUM」，未在文档中**最终二选一**。
- **风险**：standalone 已使用 `FEATURE_NUM`；若 BMAD 实现采用 `SPEC_INDEX`，则同一脚本两模式键名不一致，调用方需兼容两键，增加解析与文档负担。
- **结论**：**未定义项**——键名未在方案中最终确定，存在双键名并存与实现分歧风险。

### 2.2 调用方「必须」更新映射的强制程度

- **文档现状**：任务 4 用「**须**解析 SPEC_INDEX 并在适当时机更新」；4.3 与 AC4 用「**应**据此更新」；GAP-IDX-2 建议「明确**必须**」。
- **风险**：「须」与「应」在中文约定中常被区分（须=强制，应=推荐），混用会导致实施时对是否强制更新理解不一。
- **结论**：**未定义项**——强制程度用词不统一（须/应/必须），实施前需在文档中统一为一种表述并明确约束力。

### 2.3 并发约定

- **文档现状**：终审条件 3 与方案 B 结论要求「同一时间仅单点创建 story 目录」或简单锁/约定；任务 5 负责「索引与 standalone 共享递增」等，未重复写并发。
- **结论**：**无遗漏**——并发由终审条件与 TASKS 约定覆盖，与改进方案无冲突。

### 2.4 其他

- 任务 5 落地位置、终审条件 2 集中说明位置已在文档中明确，无冲突。
- 未发现与 DEBATE、create-new-feature.ps1、spec-index-mapping 的实质性冲突。

---

## 3. 本轮新 Gap 判定

在「改进方案文档」可实施性及「执行阶段审计」前提下，以下两项属实施前应消除的**遗漏/未定义项**，计为**本轮新 gap**：

| 编号 | 描述 | 建议修复 |
|------|------|----------|
| **R3-GAP-1** | **键名未最终确定**：SPEC_INDEX 与 FEATURE_NUM 二选一未在文档中固定，存在双键名并存与实现分歧风险。 | 在 4.2 行为约定与任务 2 中明确采用单一键名（建议与 standalone 统一为 `FEATURE_NUM`），AC1/AC4 同步改为单一键名。 |
| **R3-GAP-2** | **强制程度用词不统一**：调用方更新 spec-index-mapping 的约束力在「须」「应」「必须」间混用。 | 在任务 4、4.3、AC4、GAP-IDX-2 建议中统一为一种表述（例如「调用方必须在创建 story 目录后根据输出更新 spec-index-mapping.md」），并注明是否允许「委托给文档/脚本步骤」作为满足方式。 |

---

## 4. 结论与声明

### 4.1 完全覆盖、验证通过？

- **结论**：**有条件通过**。  
- 问题陈述、根因、共识、任务 1～6、AC1～AC5、Deferred Gaps、与 DEBATE/create-new-feature.ps1/spec-index-mapping 的对应关系**均已逐项核对且一致**；**但**存在上述 2 项未定义/不一致（键名、强制程度用词），在按 audit-prompts.md §5 精神做执行阶段审计时，**建议在实施前修复 R3-GAP-1、R3-GAP-2 后再判定为「完全覆盖、验证通过」**。

### 4.2 本轮新 gap 数量

- **本轮新 gap 数量**：**2**（R3-GAP-1、R3-GAP-2）。

### 4.3 连续 3 轮无新 gap、收敛达成？

- **声明**：**未达成**。  
- **原因**：本轮发现 2 个新 gap（键名未最终确定、调用方更新映射的强制程度用词不统一），故不满足「连续 3 轮无新 gap」的收敛条件。建议在改进方案文档中按 3 节建议修复后，再执行第四轮审计以确认收敛。

---

*审计执行：第三轮；批判审计员视角 >50%。*
