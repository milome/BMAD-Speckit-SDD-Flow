# epics.md 格式约定（slug 推导契约）

**用途**：保证 BMAD-speckit 全流程中，`create-new-feature.ps1` 与相关 skills 能正确从 `epics.md` 推导 epic/story 的目录 slug。

**读者**：create-epics-and-stories 各 step、bmad-story-assistant、speckit-workflow、以及任何写入或解析 `epics.md` 的 workflow。

---

## 0. 路径与可选性说明

- **`_bmad-output/config/`**
  - 路径为 `{project-root}/_bmad-output/config/`，其下文件为 `epic-{N}.json`（与 PRD、epics、readiness 等统一放在 _bmad-output 下）。
  - **该目录为可选**：若**不存在**或对应 `epic-{N}.json` 不存在，脚本会跳过此项，仅用 epics.md 推导。无需事先建此目录即可使用 epics.md 推导。

- **`_bmad-output/planning-artifacts/{branch}/epics.md`**  
  - 同一 branch 下**只有一个** epics.md，其中包含**多个 Epic**（如 `## Epic 1: ...`、`## Epic 2: ...`、…）。  
  - 脚本按**当前要创建的 Epic 编号 N**（及 Story N.M）在文件中匹配**对应段落**的标题，因此「同一 branch 生成多个 epic」时，每个 Epic/Story 使用**各自**的 `## Epic N: Title` / `### Story N.M: Title`，结果正确、互不冲突。

---

## 1. 脚本解析依赖的格式

`create-new-feature.ps1`（BMAD 模式）在**未传 `-Slug`** 时，按顺序尝试：

- **Epic slug**  
  - 先试：`{project-root}/_bmad-output/config/epic-{N}.json`（若存在）的 `slug` 或 `name`。  
  - 再试：`_bmad-output/planning-artifacts/{branch}/epics.md` 中匹配行 `## Epic {N}: {Title}`，将 `Title` 转 kebab-case。  
  - 目录示例：`specs/epic-N-{epic_slug}/`
- **Story slug**  
  - 先试：同上 JSON 的 `stories[]` 第 M 项的 `slug` 或 `title`。  
  - 再试：同上 epics.md 中匹配行 `### Story {N}.{M}: {Title}`，将 `Title` 转 kebab-case。  
  - 目录示例：`story-M-{slug}/`

因此 **epics.md 必须严格使用上述标题格式**，否则脚本无法从 epics.md 推导 slug，会回退到 `epic-N`、`E{N}-S{M}`。

---

## 2. 标题书写约定（slug 友好）

为便于转成可读的 kebab-case 目录名，create-epics-and-stories 的 step 提示词中已约定：

| 类型 | 约定 | 示例（好） | 示例（避免） |
|------|------|------------|--------------|
| **Epic 标题** | 简洁、以字母数字和空格为主，转 kebab 后作为目录名 | "Indicator system refactor", "Metrics cache" | "Feature X: Do Y"（冒号）、过长句子 |
| **Story 标题** | 简洁、动作导向，无冒号等特殊符号 | "Implement base cache class", "User registration with email" | "Story: Do something (phase 1)" |

Skills 在生成或更新 epics.md 时，应遵守上述格式与标题约定，以便全流程中无需再手传 `-Slug` 即可得到可读的 spec 路径。

---

## 3. 与 create-new-feature.ps1 的推导顺序

| 来源 | Epic slug | Story slug |
|------|-----------|------------|
| 1（可选） | `{project-root}/_bmad-output/config/epic-{N}.json` 的 `slug` 或 `name`（**目录不存在则跳过**） | 同上文件中 `stories[]` 第 M 项的 `slug` 或 `title` |
| 2 | `_bmad-output/planning-artifacts/{branch}/epics.md` 中 **匹配编号 N 的** `## Epic N: Title` | 同上文件中 **匹配 N.M 的** `### Story N.M: Title`（同一文件内多 Epic 时按 N、N.M 区分） |
| 3（兜底） | 无 slug，目录为 `epic-N` | 无 slug，目录为 `story-M-E{N}-S{M}` |

---

## 4. 相关文件

- **生成 epics.md**：`_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/`（step-02-design-epics.md、step-03-create-stories.md）已加入 slug 友好与格式要求。
- **解析**：`_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`（Get-EpicSlugOrDefault、Get-StorySlugOrDefault）。
- **约定引用**：speckit-workflow SKILL.md §1.0、bmad-story-assistant 中可引用本文档作为 epics.md 格式与标题约定的集中说明。
