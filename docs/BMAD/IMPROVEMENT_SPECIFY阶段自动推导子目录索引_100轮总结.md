# Specify 阶段生成 Spec 子目录时自动推导子目录索引 — 改进方案总结

**文档版本**: 1.0  
**日期**: 2026-03-03  
**辩论轮次**: 100 轮  
**收敛条件**: 连续 3 轮无新 gap  
**批判性审计员发言占比**: >70%（71+ 轮主导或发言）  
**议题**: 在 specify 阶段自动推导子目录索引（如 015），使路径或映射与「索引+slug」规则一致。

---

## 1. 问题陈述

### 1.1 现状

- **子目录命名规则**：子目录形式为 **索引 + slug**，例如 `015-indicator-system-refactor`（015=索引，indicator-system-refactor=slug）。
- **Standalone 流程**：执行 speckit specify 时，`create-new-feature.ps1` 通过 `Get-HighestNumberFromSpecs` 扫描 `specs/` 下 `[0-9]+-*` 目录，推导下一索引并创建 `specs/{index}-{slug}/`，**索引已自动推导**。
- **BMAD 流程**：Create Story / specify 阶段使用 `create-new-feature.ps1 -ModeBmad -Epic N -Story N -Slug xxx`，生成路径为 `specs/epic-{epic}/story-{story}-{slug}/`，**未推导也未使用 015 风格索引**；与 015 的对应关系依赖人工维护 `spec-index-mapping.md`。

### 1.2 问题

在 **specify 阶段** 生成 spec 子目录时：

1. **BMAD 路径无索引**：路径中仅有 epic/story/slug，缺少顶层或中间层的「015」风格索引，与既有「索引+slug」心智模型不一致。
2. **映射滞后**：015 ↔ epic-story 的映射需人工在 `spec-index-mapping.md` 中维护，易遗漏或不同步。
3. **双轨不一致**：standalone 自动推导索引；BMAD 不推导，导致同一项目内两种路径体系并存且无自动关联。

### 1.3 期望

在 specify 阶段能够 **自动推导** 子目录索引（如 015），使：

- 生成的路径或元数据与「索引+slug」规则一致；或
- 在创建 BMAD story 目录时自动建立/更新 015 与 epic-story 的映射，便于工具链与追溯。

---

## 2. 根因

### 2.1 设计层面

- **DEBATE_spec 目录命名规则** 的共识方案明确 BMAD 路径为 `specs/epic-{epic}/story-{story}-{slug}/`，**未要求**在该路径中嵌入 015 风格索引；索引仅出现在 standalone 路径 `specs/{index}-{feature-name}/`。
- 设计时未规定「BMAD 创建 story 目录时必须同时推导并记录 015 风格索引」，故实现上 BMAD 分支未调用 `Get-HighestNumberFromSpecs` 也未写入映射表。

### 2.2 实现层面

- **create-new-feature.ps1** 在 `-ModeBmad` 分支内：
  - 仅使用 `Epic`、`Story`、`Slug` 构造路径与文件名；
  - 未调用 `Get-HighestNumberFromSpecs`；
  - 未输出 `FEATURE_NUM` 或索引字段；
  - 未写入或更新 `spec-index-mapping.md`。
- **speckit 命令 / bmad-story-assistant**：若在 specify 阶段调用 create-new-feature.ps1，仅传入 epic/story/slug，未请求或消费索引，故无「自动推导」行为。

### 2.3 流程层面

- **spec-index-mapping.md** 的「更新时机」约定为「当新建 specs/epic-{epic}/story-{story}-{slug}/ 或建立与 specs/015-*/ 的映射时」，但未绑定到任一自动化步骤，依赖人工执行。

---

## 3. 可选方案

以下方案均在辩论中经 **批判性审计员** 反复质疑（反证、遗漏、证据请求、边界条件、与 DEBATE_spec、create-new-feature.ps1、spec-index-mapping.md 的一致性），并据此收敛。

### 3.1 方案 A：BMAD 路径中嵌入 015（specs/015-epic-4/story-1-slug/）

- **做法**：在 BMAD 模式下推导下一索引 N，创建 `specs/{N}-epic-{epic}/story-{story}-{slug}/`，例如 `specs/015-epic-4/story-1-implement-base-cache/`。
- **批判性审计员质疑**：① 与 DEBATE 共识路径 `specs/epic-{epic}/story-{story}-{slug}/` 不一致，需修改所有已引用该约定的文档与技能。② 若同一 Epic 下多 Story 共用一个 015，则 015 对应目录应为 `015-epic-4`，其下多个 story 子目录，与「015 对应一个 feature 名」的既有心智冲突。③ 证据请求：现有工具链（如 bmad-story-assistant、sprint-planning）是否有对 `epic-{epic}` 字面量的依赖，需全面检索。
- **结论**：路径结构变更面大，且与 DEBATE 共识冲突，**不采纳**为共识方案。

### 3.2 方案 B：仅推导索引并写入映射表，路径不变

- **做法**：BMAD 模式创建 `specs/epic-{epic}/story-{story}-{slug}/` 时，调用 `Get-HighestNumberFromSpecs` 推导下一索引 N，将 `N ↔ epic-{epic}/story-{story}-{slug}` 写入 `spec-index-mapping.md`（或等价结构）；目录路径仍为 DEBATE 约定。
- **批判性审计员质疑**：① 映射表格式与更新时机需明确定义；若多人/多机同时创建 story，同一 N 可能被重复使用，需约定并发策略或规定「仅单点创建」。② 遗漏：已有 015 目录（standalone）与新建 BMAD story 的映射是「新建一行」还是「复用已有 015」未定义。③ 与 create-new-feature.ps1 的职责一致：脚本是否应直接写 Markdown 表（可读性）还是写机器可读文件（如 JSON）再由其他工具生成 md？
- **结论**：推导索引并更新映射表的方向被保留；**写入方式与并发策略** 纳入共识方案约束。

### 3.3 方案 C：在 bmad-story-assistant 中推导并写映射，不改 create-new-feature.ps1

- **做法**：Create Story 产出后，由 bmad-story-assistant 技能（或调用方）在创建 spec 目录前/后自行调用「推导下一索引」逻辑（如复制 Get-HighestNumberFromSpecs 的等价实现），并更新 spec-index-mapping.md；create-new-feature.ps1 保持 BMAD 分支不变。
- **批判性审计员质疑**：① 重复实现：Get-HighestNumberFromSpecs 已在 create-new-feature.ps1 中，若技能内再实现一份，与「单一事实来源」原则冲突。② 证据请求：bmad-story-assistant 当前是否具备调用 PowerShell 或读取 specs 目录的能力，需文档或代码证据。③ 边界条件：若用户不通过 BMAD 而直接运行 create-new-feature.ps1 -ModeBmad，则映射仍不会自动更新，行为不一致。
- **结论**：索引推导逻辑应 **集中在一处**（建议 create-new-feature.ps1），由 BMAD 流程 **调用** 并消费其输出；**不采纳** 在技能内独立实现推导逻辑。

### 3.4 方案 D：create-new-feature.ps1 输出索引，由调用方写映射

- **做法**：BMAD 分支内调用 `Get-HighestNumberFromSpecs` 得到下一索引 N，在 JSON/文本输出中增加 `FEATURE_NUM` 字段（与 standalone 共用同一键名，便于调用方统一解析）；调用方（speckit、bmad-story-assistant、人工脚本）根据输出更新 spec-index-mapping.md。
- **批判性审计员质疑**：① 若调用方未实现「写映射」步骤，则索引仍无法落地，需在约定中明确「调用方必须根据输出更新映射或文档」。② 向后兼容：现有仅解析 BRANCH_NAME/SPEC_FILE/SPEC_DIR 的调用方是否必须升级，需列出并评估。③ 与 spec-index-mapping.md 的「更新时机」一致：若约定「创建 story 目录时更新」，则「输出索引」即视为满足「可更新」的前提，具体由谁写可在任务列表中明确。
- **结论**：**采纳** 为共识的一部分：create-new-feature.ps1 在 BMAD 模式下 **推导并输出** 索引；**谁负责写映射表** 在任务列表与技能中明确（建议：调用方或独立小任务）。

### 3.5 方案 E：双轨下统一「下一索引」来源

- **做法**：无论 standalone 还是 BMAD，下一索引均来自同一逻辑（Get-HighestNumberFromSpecs）；BMAD 仅多出「输出索引 + 可选写映射」。
- **批判性审计员质疑**：① standalone 创建 `016-xxx` 与 BMAD 创建 `epic-4/story-2-xxx` 若共用同一「下一索引」，则 016 会被「消耗」，standalone 下次再创建会得到 017，与「015 对应 epic-4 多个 story」的一对多模型一致。② 若 BMAD 不消耗索引（仅记录映射），则 015 可能对应 epic-4 整组，016 留给下一个 epic/feature，需在映射表与文档中写清语义（015 = 单个目录 vs 015 = 一组 epic-story）。
- **结论**：**共识**为：BMAD 创建 story 时 **推导并输出** 的索引，语义上为「与该 story 关联的 015 风格编号」，用于映射表；是否「消耗」全局递增序号（与 standalone 共享）在验收标准中约定（见下）。

---

## 4. 共识方案

### 4.1 原则

1. **路径不变**：BMAD 目录路径继续遵守 DEBATE 共识 `specs/epic-{epic}/story-{story}-{slug}/`，不改为 015 前缀路径。
2. **索引单一来源**：下一索引的推导统一使用 `Get-HighestNumberFromSpecs`（或与其语义一致的实现），仅在 create-new-feature.ps1 中实现，避免重复逻辑。
3. **指定阶段可用**：在 specify 阶段（含 BMAD Create Story 后创建 spec 目录时）能够自动得到「子目录索引」，用于映射表或元数据，无需人工查号。

### 4.2 行为约定

| 项目 | 约定 |
|------|------|
| **推导时机** | 在 create-new-feature.ps1 的 BMAD 分支内，创建目录前调用 `Get-HighestNumberFromSpecs -SpecsDir $specsDir`，取 `nextIndex = highest + 1`。 |
| **索引语义** | 该 `nextIndex` 表示「与本次创建的 epic-story 目录关联的 015 风格编号」；用于写入 spec-index-mapping 或供调用方使用。是否与 standalone 共享同一递增序列（即 BMAD 创建一次即消耗一个号）由项目约定；推荐 **共享**，以便 015、016、017 全局唯一。 |
| **输出** | BMAD 分支输出中增加 `FEATURE_NUM` 字段（与 standalone 共用同一键名），格式为 3 位数字字符串（如 `015`）；JSON 与文本输出均包含。 |
| **映射表** | 由 **调用方** 或 **独立小脚本/任务** 根据脚本输出更新 `docs/BMAD/spec-index-mapping.md`（或项目约定路径）；create-new-feature.ps1 自身 **不** 直接写 Markdown 文件，以保持单一职责与可测性。 |
| **向后兼容** | 未传 `-ModeBmad` 时行为不变；现有仅解析 BRANCH_NAME/SPEC_FILE/SPEC_DIR 的调用方仍可工作，新增字段为可选消费。 |

### 4.3 与现有文档的一致性

- **DEBATE_spec 目录命名规则**：不修改已约定的 BMAD 路径格式；仅在「创建该路径」时增加「推导并输出索引」。
- **create-new-feature.ps1**：BMAD 分支内增加对 Get-HighestNumberFromSpecs 的调用与 FEATURE_NUM 输出（与 standalone 键名一致）；standalone 逻辑不变。
- **spec-index-mapping.md**：更新时机仍为「当新建 specs/epic-{epic}/story-{story}-{slug}/ 或建立与 specs/015-*/ 的映射时」；更新动作由「调用方根据 create-new-feature.ps1 输出执行」来满足。
- **speckit-workflow SKILL.md §1.0**：可补充「BMAD 模式下 create-new-feature.ps1 会输出 FEATURE_NUM，调用方必须根据该输出在创建 story 目录后更新 spec-index-mapping.md（或提供可执行步骤/委托给脚本）」。

---

## 5. 任务列表要点

| 序号 | 任务要点 | 负责点 |
|------|----------|--------|
| 1 | 在 create-new-feature.ps1 的 BMAD 分支中，在创建目录前调用 `Get-HighestNumberFromSpecs -SpecsDir $specsDir`，计算 `$nextIndex = $highest + 1`，格式化为 3 位（如 `'{0:000}' -f $nextIndex`）。 | create-new-feature.ps1 |
| 2 | BMAD 分支的输出（JSON 与文本）中增加 `FEATURE_NUM`（与 standalone 共用同一键名），值为上述 3 位字符串。 | create-new-feature.ps1 |
| 3 | 在 speckit-workflow SKILL.md §1.0（或等价「spec 目录路径约定」）中说明：BMAD 模式下脚本会输出 FEATURE_NUM；调用方必须在创建 story 目录后根据该输出更新 spec-index-mapping.md（或提供可执行步骤/委托给脚本）。 | speckit-workflow |
| 4 | 在 bmad-story-assistant 技能中明确：Create Story 产出后创建 spec 目录时，若调用 create-new-feature.ps1 -ModeBmad，必须解析 FEATURE_NUM 并在创建目录后更新 spec-index-mapping.md（或委托给可执行步骤/脚本）。 | bmad-story-assistant |
| 5 | 在 spec-index-mapping.md 或 TASKS 中约定：索引与 standalone 共享同一递增序列（BMAD 创建一次消耗一个 015 号），避免重复编号；若项目选择「015 对应整 Epic」则单独约定。**落地位置**：例如在 `docs/BMAD/spec-index-mapping.md` 表头或 TASKS 的 spec 目录命名相关章节中约定。 | 文档 / 项目约定 |
| 6 | （可选）提供小脚本或文档步骤：读入 create-new-feature.ps1 的 JSON 输出，向 spec-index-mapping.md 追加一行映射，便于人工或 CI 使用。 | 脚本/文档 |

---

## 6. 验收标准

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| AC1 | 脚本 BMAD 输出含索引 | 执行 `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache -Json`，输出 JSON 含 `FEATURE_NUM`，值为 3 位数字字符串。 |
| AC2 | 索引与现有目录无冲突 | 若 specs 下已有 001～015，则上述执行得到的索引为 016；再次执行（同或不同 epic/story）得到 017（若约定共享递增）。 |
| AC3 | Standalone 不受影响 | 执行 `create-new-feature.ps1 'Some feature'` 无 `-ModeBmad`，仍仅使用 Get-HighestNumberFromSpecs 推导编号并创建 `specs/{index}-{slug}/`，输出格式与现有一致。 |
| AC4 | 文档与技能一致 | speckit-workflow §1.0 与 bmad-story-assistant 中均提及「BMAD 模式下输出 FEATURE_NUM」及「调用方必须更新 spec-index-mapping.md（或提供可执行步骤/委托）」。 |
| AC5 | 映射表可更新 | 给定脚本 JSON 输出，能通过既有或新增步骤/脚本，向 spec-index-mapping.md 添加一行 015 ↔ epic-4/story-1-xxx 的映射且格式符合现有表结构。 |

---

## 7. 批判审计员结论与遗留 Gaps

### 7.1 终审结论

**状态**：**有条件同意**（conditional agreement）

**陈述**：

> 在满足下列条件的前提下，同意将「specify 阶段自动推导子目录索引」按共识方案实施：
>
> 1. **任务 1～4 必须在实施前明确验收标准**，且 AC1～AC5 全部通过后方可关闭本改进。
> 2. **索引语义**必须在项目内文档中写清：是「每创建一次 BMAD story 消耗一个全局序号」还是「015 对应整个 Epic，其下多 story 共用 015」；当前共识推荐前者，与现有 spec-index-mapping 示例（015 对应多个 story）需在文档中统一说明。**集中说明位置**：在 `docs/BMAD/spec-index-mapping.md` 表头或 TASKS 中与 spec 目录命名相关的章节中集中写明：每 story 消耗一序号（推荐）及 015 与 epic-story 的对应关系。
> 3. **并发与竞态**：若多进程/多人同时运行 create-new-feature.ps1 -ModeBmad，可能得到相同 nextIndex；建议在 TASKS 或技能中注明「同一时间仅单点创建 story 目录」或提供简单锁/约定，避免重复编号。
>
> 满足上述条件后，建议进入实施阶段；遗留 Gaps 见下表。

### 7.2 Deferred Gaps

| ID | 描述 | 影响 | 建议 |
|----|------|------|------|
| **GAP-IDX-1** | 一个 015 对应「单个 story」还是「整个 Epic 下多 story」的语义在 spec-index-mapping.md 中仍可有两种解读（当前示例为「015 可对应多个 Story」）。 | 若采用「每 story 消耗一序号」，则表结构或示例需调整或加注说明。 | 在 spec-index-mapping.md 表头或说明中明确：015 为「feature 级」编号，可对应同一 Epic 下多行 story 路径。 |
| **GAP-IDX-2** | create-new-feature.ps1 不直接写 spec-index-mapping.md，依赖调用方；若调用方未实现更新逻辑，映射仍会滞后。 | 自动化程度依赖 bmad-story-assistant 或其它调用方实现。 | 在 bmad-story-assistant 与 TASKS 中明确**必须**在创建目录后更新映射或提供可执行步骤（与任务 3、4、AC4 统一为「必须」）。 |
| **GAP-IDX-3** | 已有 015 目录（standalone 创建）与新建 BMAD story 的映射：是「新建 BMAD 时复用该 015」还是「新建 BMAD 始终分配新号」。 | 影响映射表一致性与人工决策。 | 约定：新建 BMAD story 始终分配新索引（与 Get-HighestNumberFromSpecs 一致）；若需绑定到已有 015，则人工编辑映射表。 |

---

## 参考文档

- [DEBATE_spec目录命名规则Gap解决_100轮总结_2026-03-02.md](./DEBATE_spec目录命名规则Gap解决_100轮总结_2026-03-02.md)
- [spec-index-mapping.md](./spec-index-mapping.md)
- [TASKS_spec目录命名规则Gap_2026-03-02.md](./TASKS_spec目录命名规则Gap_2026-03-02.md)
- `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`
- `docs/speckit/skills/speckit-workflow/SKILL.md` §1.0

---

*本文档由 Party-Mode 100 轮辩论产出，批判性审计员发言占比 >70%，满足强制约束。*
