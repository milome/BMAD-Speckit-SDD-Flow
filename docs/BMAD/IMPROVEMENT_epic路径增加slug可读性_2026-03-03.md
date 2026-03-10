# Epic 路径增加 Slug 可读性（改进说明）

**日期**: 2026-03-03  
**状态**: 提议  
**关联**: BMAD 全流程 PRD → Architecture → Epic-Story；DEBATE_spec目录命名规则Gap解决

---

## 1. 问题

- **当前约定**：BMAD spec 路径为 `specs/epic-{epic}/story-{story}-{slug}/`，epic 层仅用数字（如 `epic-4`）。
- **上下文**：BMAD 全流程为 PRD → Architecture → Epic-Story，Epic 已有 PRD/Arch 等前置上下文。
- **痛点**：
  1. **可读性不足**：目录列表中 `epic-4` 无法直观看出主题，需查表或打开文档。
  2. **易重复/歧义**：不同项目或不同时期的「epic-4」可能对应不同主题；多 repo、多 worktree 时易混淆。

Story 层已通过 **story-{story}-{slug}** 解决可读性，Epic 层目前未做同等处理。

---

## 2. 提议

- **路径格式**（BMAD）：由 `epic-{epic}/` 扩展为 **`epic-{epic}-{epic_slug}/`**。
- **示例**：`specs/epic-4-indicator-system-refactor/story-1-implement-base-cache/`。
- **epic_slug 来源**（与现有上下文一致，按优先级）：
  | 优先级 | 来源 | 示例 |
  |--------|------|------|
  | 1 | Epic 文档标题或名称（kebab-case） | "Indicator system refactor" → `indicator-system-refactor` |
  | 2 | PRD/Architecture 中该 Epic 对应模块或主题名 | 从 PRD 章节或 Arch 模块名推导 |
  | 3 | 兜底 | 省略 epic_slug，保持 `epic-{epic}`（向后兼容） |

- **向后兼容**：
  - 已有目录 `epic-4/` 或 `epic-4-*/` 可保留；脚本优先复用已存在的 epic 目录，再创建新目录时默认带 slug（推导失败时仍用 `epic-{epic}/`）。
  - 与 Story 一致：**不新增选项**，epic_slug 由脚本**默认推导**（与 Story 的 -Slug 可选、未传时用 E4-S1 兜底一致）。

---

## 3. 实现要点

### 3.1 脚本 `create-new-feature.ps1`（无新增参数）

- **不新增 `-EpicSlug` 参数**；epic 段目录名由脚本**默认推导**，与 Story 的 `-Slug` 可选、未传时兜底一致。
- **推导顺序**（与 BMAD 前置上下文一致）：
  1. **`_bmad-output/config/epic-{Epic}.json`**：若存在且含 `slug` 或 `name` 字段，取之并转为 kebab-case 作为 epic_slug。
  2. **`_bmad-output/planning-artifacts/{branch}/epics.md`**：若存在，解析 `## Epic N: Title`，将 Title 转为 kebab-case 作为 epic_slug（branch 为当前 git branch，与 DEBATE 约定一致）。
  3. **兜底**：无法推导时使用 `epic-{Epic}`（与当前行为一致）。
- **目录复用**：若 `specs/epic-{Epic}/` 或 `specs/epic-{Epic}-*/` 已存在，优先使用该目录，避免重复创建。
- **最终 epic 目录名**：新建时优先 `epic-{Epic}-{epic_slug}`，推导失败则 `epic-{Epic}`。

### 3.2 约定与文档

- **speckit-workflow** §1.0（spec 目录路径约定）：
  - BMAD 路径格式补充为：`specs/epic-{epic}[-{epic_slug}]/story-{story}-{slug}/`，说明 epic_slug 由脚本**默认推导**（_bmad-output/config、epics.md），推导失败时用 `epic-{epic}`。
- **spec-index-mapping.md**：
  - 表头/示例中可展示带 epic_slug 的路径示例（如 `epic-4-indicator-system-refactor/story-1-*`），与现有 015 映射并存。
- **bmad-story-assistant / Create Story**：无需产出 epic_slug 参数；脚本自行从 BMAD 前置产出推导。

### 3.3 不强制改写已有路径

- 已有 `specs/epic-4/` 无需批量重命名；脚本优先复用已存在的 epic 目录。
- 工具链需同时支持「仅 epic 数字」与「epic-数字-slug」两种目录名（按目录存在性解析即可）。

---

## 4. 验收要点

- [ ] create-new-feature.ps1 **不新增参数**；BMAD 模式下默认从 _bmad-output/config 或 epics.md 推导 epic_slug，失败时使用 `epic-{epic}`。
- [ ] 若 `specs/epic-{Epic}/` 或 `specs/epic-{Epic}-*/` 已存在，脚本使用该目录而非新建。
- [ ] speckit-workflow §1.0 写明 `epic-{epic}[-{epic_slug}]` 及 epic_slug 默认推导来源。

---

## 5. 小结

在 BMAD 全流程（PRD → Arch → Epic-Story）下，Epic 已有足够上游上下文，仅显示 `epic-{epic}` 可读性不足且易重复。通过**默认推导** **epic_slug**（不新增选项，与 Story 的 -Slug 可选一致），扩展为 **epic-{epic}-{epic_slug}**；推导失败或复用已有目录时仍为 `epic-{epic}`，在不破坏现有行为的前提下提升可读性并降低歧义。
