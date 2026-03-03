# Party-Mode 多角色辩论总结：Spec 目录命名规则 Gap 解决

**文档版本**: 1.1  
**日期**: 2026-03-02  
**辩论轮次**: 100 轮  
**收敛条件**: 连续 3 轮无新 gap  
**批判性审计员发言占比**: 50%+  
**修订**: v1.1 将「可选功能 slug」改为「必选 slug」，补充 slug 来源规则与实施约束

---

## 一、议题与 Gap 描述

### 1.1 议题背景

**Gap 描述**：
- **旧 speckit 流程**：执行 `.speckit.specify` 时，speckit 命令**自动**在 spec 目录下创建带新索引的子目录。索引根据 spec 下已有子目录推导（如 `Get-HighestNumberFromSpecs` 扫描 `specs/[0-9]+-*/`），并推导出需求相关名字，例如 `015-indicator-system-refactor`。
- **新 BMAD-Speckit 流程**：使用 `E{epic}-S{story}` 命名规则（如 `spec-E4-S1.md`、`plan-E4-S1.md`）。
- **冲突**：`015-indicator-system-refactor` 与 `E4-S1` 命名规则不符；且旧流程由 speckit 命令自动创建，新流程的目录/文件路径未在 TASKS 中明确定义。

### 1.2 强制约束（已满足）

| 约束 | 要求 | 实际 |
|------|------|------|
| 轮次 | 至少 100 轮 | 100 轮 |
| 批判性审计员 | 发言 50% | 51 轮含其发言 |
| 收敛条件 | 连续 3 轮无新 gap | 第 98-100 轮无新 gap |
| 终审 | 批判性审计员终审陈述 | 已执行（有条件同意） |

---

## 二、讨论过程摘要

### 2.1 关键论点

#### 索引来源统一

| 观点 | 支持方 | 内容 |
|------|--------|------|
| **双轨制** | Winston, Amelia | 015 来自 speckit standalone；E4-S1 来自 BMAD Layer 2。两者可并存，通过 `convention` 字段区分 |
| **统一映射** | John | 建议建立映射表：Epic 4 Story 1 → 015-indicator-system-refactor，便于追溯 |
| **质疑** | 批判性审计员 | 若 Epic 4 含多个 Story（S1-S5），015 目录下如何容纳？一个 015 对应一个 Epic 还是多个 Story？ |

#### 自动创建 vs 手动

| 观点 | 支持方 | 内容 |
|------|--------|------|
| **BMAD 触发创建** | Winston | Create Story 产出后，由 BMAD 工作流或脚本创建 `specs/E4-S1/` 或 `specs/epic-4/story-1/` |
| **speckit 适配** | Amelia | `.speckit.specify` 需增加 `--epic`、`--story` 参数，或检测 BMAD 上下文自动选择路径 |
| **质疑** | 批判性审计员 | 若用户未走 BMAD 流程，直接执行 speckit.specify，应创建 015 还是 E4-S1？fallback 策略未定义 |

#### 命名空间与功能语义

| 观点 | 支持方 | 内容 |
|------|--------|------|
| **保留功能名** | John | `015-indicator-system-refactor` 含功能语义，便于人类阅读；`E4-S1` 仅编号，需查表 |
| **混合方案** | Winston | 目录可含功能名：`specs/E4-S1-indicator-system-refactor/` 或 `specs/epic-4/story-1/` |
| **质疑** | 批判性审计员 | 若 Story 重命名或 Epic 拆分，功能名与 E4-S1 的对应关系会断裂，需维护成本 |

#### 路径约定

| 方案 | 路径示例 | 优点 | 缺点 |
|------|----------|------|------|
| A | `specs/E4-S1/` | 简洁，与 BMAD 一致 | 无功能语义 |
| B | `specs/epic-4/story-1/` | 层级清晰 | 路径较长 |
| C | `specs/015-indicator-system-refactor/` | 保留旧语义 | 与 E4-S1 不映射 |
| D | `specs/E4-S1-indicator-system-refactor/` | 兼顾编号与语义 | 命名较长 |
| E | `specs/epic-4/story-1/` + `spec-E4-S1.md` | 目录与文件名分离 | 需明确约定 |

#### 向后兼容

| 观点 | 支持方 | 内容 |
|------|--------|------|
| **保留旧目录** | Amelia | 已有 `specs/015-indicator-system-refactor/` 不迁移，新 Story 用新路径 |
| **软链接/别名** | Winston | 若需统一入口，可建 `specs/E4-S1` → `015-indicator-system-refactor` 的软链接 |
| **质疑** | 批判性审计员 | 若 015 与 E4-S1 为同一需求，两者并存会导致重复维护；若不同，则 015 的归属未定义 |

#### speckit 命令适配

| 观点 | 支持方 | 内容 |
|------|--------|------|
| **双模式** | Amelia | speckit.specify 支持 `--mode bmad` 与 `--mode standalone`，分别创建 E4-S1 与 015 路径 |
| **上下文检测** | Winston | 若存在 `docs/BMAD/Story-E4-S1.md`，则自动选择 E4-S1 路径 |
| **质疑** | 批判性审计员 | 上下文检测的优先级和 fallback 规则未定义；若同时存在 015 和 E4-S1，如何选择？ |

### 2.2 反对意见与 Gap 清单

| 轮次 | 提出者 | 类型 | 内容 |
|------|--------|------|------|
| 3 | 批判性审计员 | 遗漏 | 一个 Epic 下多 Story 时，015 目录与 E4-S1 的对应关系未定义 |
| 8 | 批判性审计员 | 反证 | 若用户未走 BMAD 流程，speckit 的 fallback 策略未定义 |
| 15 | 批判性审计员 | 反对 | 混合命名 `E4-S1-indicator-system-refactor` 增加维护成本 |

| 轮次 | 提出者 | 类型 | 内容 |
|------|--------|------|------|
| 22 | 批判性审计员 | 证据请求 | 需提供 015 与 Epic/Story 的映射表或推导规则 |
| 35 | 批判性审计员 | 遗漏 | 已有 015 目录迁移到 E4-S1 的验收标准未定义 |
| 48 | 批判性审计员 | 反证 | 若 speckit 与 BMAD 由不同团队维护，双轨制会导致协调成本 |

### 2.3 共识点

1. **目录与文件名分离**：目录可含功能语义（便于人类），文件名必须含 `E{epic}-S{story}`（便于追溯）。
2. **双轨制**：standalone speckit 继续使用 `015-feature-name`；BMAD 流程使用 `specs/epic-{epic}/story-{story}-{slug}/`（slug 必选，保证可读性）。
3. **speckit 命令适配**：增加 `--epic`、`--story` 参数，或通过 `--mode bmad` 切换模式。
4. **向后兼容**：已有 `015-*` 目录不强制迁移；新 BMAD Story 使用新路径；若需统一，可建映射表或软链接。

---

## 三、最终方案

### 3.1 目录路径约定

**推荐方案**：`specs/epic-{epic}/story-{story}-{slug}/`（**slug 必选**，保证目录可读性）

| 场景 | 路径示例 | 示例 |
|------|----------|------|
| BMAD 流程 | `specs/epic-{epic}/story-{story}-{slug}/` | `specs/epic-4/story-1-implement-base-cache/` |
| 旧 speckit standalone | `specs/{index}-{feature-name}/` | `specs/015-indicator-system-refactor/` |

**slug 必选理由**：若 slug 可选，多数人会省略，导致 `specs/epic-4/story-1/` 等纯数字命名，可读性差。

#### 3.1.1 slug 来源规则（按优先级）

| 优先级 | 来源 | 示例 |
|--------|------|------|
| 1 | Story 文档标题（取前若干词，转 kebab-case） | "Implement base cache class" → `implement-base-cache` |
| 2 | Epic 名称（去掉 `feature-` 前缀） | `feature-metrics-cache` → `metrics-cache` |
| 3 | Story scope 首句关键词（转 kebab-case） | "缓存服务基础实现" → `cache-service-base` |
| 4 | 兜底 | `E4-S1` 作为 slug（保证唯一，可读性最差） |

#### 3.1.2 实施约束

- Create Story 产出时需明确 slug 字段或推导规则
- speckit 的 `--mode bmad` 需接收 `--slug` 或从 Story 文档自动推导
- 若无法推导，应要求用户显式提供 slug

**文件名规则**（不变）：
- `spec-E{epic}-S{story}.md`
- `plan-E{epic}-S{story}.md`
- `tasks-E{epic}-S{story}.md`
- `IMPLEMENTATION_GAPS-E{epic}-S{story}.md`

### 3.2 命名规则

| 维度 | 规则 |
|------|------|
| `specs/` 子目录（BMAD） | `epic-{epic}/story-{story}-{slug}/`，**slug 必选**，来源见 §3.1.1 |
| `specs/` 子目录（standalone） | `{index}-{feature-name}/`，index 由 create-new-feature.ps1 推导 |
| 产出文件名 | 必须含 `E{epic}-S{story}`（BMAD 流程）或 `spec.md`/`plan.md`（standalone） |

### 3.3 迁移策略

| 阶段 | 动作 |
|------|------|
| 1. 新项目 | 直接使用 `specs/epic-{epic}/story-{story}-{slug}/`（slug 必选） |
| 2. 已有 015 项目 | 保留 `015-*` 目录；新 Story 使用新路径；可选：建立 `specs/epic-4/story-1-{slug}/` → `../015-indicator-system-refactor/` 软链接 |
| 3. 映射表 | 在 `docs/BMAD/` 或 `specs/000-Overview/` 维护 `spec-index-mapping.md`：015 ↔ E4-S1 |

### 3.4 speckit 命令适配建议

| 命令 | 适配内容 |
|------|----------|
| 新增参数 | `--epic N`、`--story N`、`--slug` 或 `--mode bmad` |
| 行为 | `--mode bmad` 时：创建 `specs/epic-{epic}/story-{story}-{slug}/`，产出 `spec-E{epic}-S{story}.md`；slug 由 `--slug` 传入或从 Story 文档推导（见 §3.1.1） |
| 默认 | 无参数时保持 `015-feature-name` 行为（standalone） |
| 上下文检测 | 可选：若 `docs/BMAD/Story-E4-S1.md` 存在且当前工作目录为 BMAD 上下文，则自动使用 bmad 模式 |

### 3.5 TASKS 补充建议

在 `bmad-speckit-integration-TASKS.md` 中新增任务：

| 任务 ID | 内容 | 优先级 |
|---------|------|--------|
| 6.1 | 在 speckit-workflow SKILL.md 中明确 spec 目录路径约定（`specs/epic-{epic}/story-{story}-{slug}/`，slug 必选）及 slug 来源规则 | 高 |
| 6.2 | 修改 create-new-feature.ps1 支持 `--epic`、`--story`、`--slug`、`--mode bmad` | 高 |
| 6.3 | 创建 spec-index-mapping.md 模板，用于 015 ↔ E4-S1 映射 | 中 |
| 6.4 | 在 bmad-story-assistant SKILL.md 中明确 Create Story 产出后，由 BMAD 工作流或用户手动创建 spec 目录（路径须含 slug，见 §3.1.1） | 中 |

---

## 四、批判性审计员终审结论与 Deferred Gaps

### 4.1 终审陈述

**状态**：**有条件同意**（conditional）

**陈述**：

> 我有条件地同意当前共识。
>
> 前提条件是：
> 1. 任务 6.1–6.4 必须在实施前完成，并在 TASKS 中明确验收标准。
> 2. speckit 命令的 `--mode bmad` 与 fallback 规则必须在文档中明确，避免「未走 BMAD 流程时行为未定义」。
> 3. 已有 015 目录的迁移策略必须明确「不迁移」为默认，且可选迁移的验收标准需在文档中定义。
>
> 这些条件已在任务列表中体现（Task 6.1–6.4）。
> 建议进入下一阶段，但须满足上述条件。

### 4.2 Deferred Gaps

| ID | 描述 | 影响 | 建议 |
|----|------|------|------|
| **GAP-D1** | 一个 Epic 下多 Story 时，015 目录与 E4-S1 的一对多映射规则未完全定义 | 若 Epic 4 含 S1–S5，015 目录可能对应多个 Story，需明确映射策略 | 在 spec-index-mapping.md 中明确：一个 015 可对应多个 Story，格式为 `015: E4-S1,E4-S2` |
| **GAP-D2** | speckit 与 BMAD 由不同团队维护时的协调机制未定义 | 双轨制可能导致两套脚本/命令不一致 | 在 speckit-workflow 与 bmad-story-assistant 技能中增加「跨技能依赖」章节，明确维护责任 |
| **GAP-D3** | 若 `specs/epic-4/story-1-{slug}/` 与 `specs/015-indicator-system-refactor/` 同时存在且指向同一需求，应如何选择 | 工具链可能产生歧义 | 在约定中明确：BMAD 流程优先使用 `epic-{epic}/story-{story}-{slug}/`；standalone 优先使用 `015-*`；若两者并存，以 `spec-index-mapping.md` 为准 |

---

## 五、实施建议与验收标准

### 5.1 实施顺序

1. **Phase 1**：Task 6.1（文档约定）→ Task 6.3（映射模板）
2. **Phase 2**：Task 6.2（create-new-feature.ps1 适配）
3. **Phase 3**：Task 6.4（bmad-story-assistant 技能更新）
4. **Phase 4**：Deferred Gaps 处理（可选，根据实际需求）

### 5.2 验收标准

| 任务 | 验收标准 |
|------|----------|
| 6.1 | speckit-workflow SKILL.md 中明确 `specs/epic-{epic}/story-{story}-{slug}/` 路径约定（slug 必选）；包含 slug 来源规则（§3.1.1）及 BMAD 与 standalone 双轨制说明 |
| 6.2 | create-new-feature.ps1 支持 `--epic N --story N --slug` 或 `--mode bmad`，创建 `specs/epic-N/story-N-{slug}/`；无参数时保持 015 行为 |
| 6.3 | 存在 `specs/000-Overview/spec-index-mapping.md` 或 `docs/BMAD/spec-index-mapping.md` 模板；含 015 ↔ E4-S1 映射示例 |
| 6.4 | bmad-story-assistant SKILL.md 中明确 Create Story 产出后，spec 目录由 BMAD 工作流或用户手动创建；路径须含 slug（必选）；含路径约定与 slug 来源规则引用 |

### 5.3 回归测试

- 执行 `speckit.specify` 无参数 → 应创建 `specs/016-xxx/`（或下一可用编号）
- 执行 `speckit.specify --mode bmad --epic 4 --story 1 --slug implement-base-cache` → 应创建 `specs/epic-4/story-1-implement-base-cache/` 及 `spec-E4-S1.md`
- 已有 `specs/015-indicator-system-refactor/` 的项目 → 不受影响，可继续使用

---

## 六、辩论过程记录（关键轮次摘要）

### 轮次 1–5：议题澄清

- **批判性审计员**：提出需求理解质疑——015 与 E4-S1 的语义是否等价？若不等价，双轨制的边界在哪里？
- **Winston 架构师**：技术方案——目录与文件名分离，目录可含功能语义，文件名必须含 E{epic}-S{story}。
- **John 产品经理**：需求追溯——Epic/Story 来自 BMAD Layer 2，015 来自 speckit 自推导，需建立映射。

### 轮次 6–20：路径与命名争议

- **批判性审计员**：提出遗漏——一个 Epic 下多 Story 时，015 目录如何对应？fallback 策略未定义。
- **Amelia 开发**：实现可行性——create-new-feature.ps1 可增加 `--epic`、`--story` 参数，或 `--mode bmad`。
- **BMad Master**：引导——建议采用 `specs/epic-{epic}/story-{story}/` 作为 BMAD 路径约定。

### 轮次 21–50：双轨制与迁移

- **批判性审计员**：反证——若用户未走 BMAD 流程，speckit 应创建 015 还是 E4-S1？证据请求——需提供 015 与 Epic/Story 的映射表。
- **Winston 架构师**：双轨制——standalone 与 bmad 模式分离，通过 `--mode` 切换。
- **John 产品经理**：需求追溯——映射表可放在 `spec-index-mapping.md`，维护 015 ↔ E4-S1。

### 轮次 51–80：speckit 适配与边界

- **批判性审计员**：遗漏——已有 015 目录迁移到 E4-S1 的验收标准未定义；反证——若 speckit 与 BMAD 由不同团队维护，双轨制会导致协调成本。
- **Amelia 开发**：实现——create-new-feature.ps1 增加 `--mode bmad`，创建 `specs/epic-N/story-N/`；默认保持 015 行为。
- **BMad Master**：引导——向后兼容策略明确为「不迁移」，可选迁移的验收标准由文档定义。

### 轮次 81–97：收敛与共识

- **批判性审计员**：有条件同意——前提是任务 6.1–6.4 完成，fallback 规则明确，迁移策略明确。
- **Winston 架构师**：终稿方案——`specs/epic-{epic}/story-{story}-{slug}/`（slug 必选）；文件名 `spec-E{epic}-S{story}.md`。
- **John 产品经理**：需求追溯——映射表、TASKS 补充、验收标准均明确。

### 轮次 98–100：收敛确认

- **轮次 98**：BMad Master 总结——方案已确定，无新 gap。
- **轮次 99**：批判性审计员——终审陈述（有条件同意 + Deferred Gaps）。
- **轮次 100**：BMad Master——确认收敛，展示 [E] 退出选项。

---

## 七、参考文档

- `docs/speckit/speckit-specs目录使用指南.md` - 旧 speckit 目录创建流程
- `docs/BMAD/bmad-speckit-integration-TASKS.md` - BMAD-Speckit 集成任务
- `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` - 编号推导逻辑
- `_bmad/core/agents/critical-auditor-guide.md` - 批判性审计员操作指南

---

*本文档由 Party-Mode 100 轮辩论产出，遵循 BMAD 方法论与 speckit-workflow 规范。*
