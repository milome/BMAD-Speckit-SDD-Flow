# Spec 索引映射表

**用途**：维护 015 风格目录与 BMAD Epic/Story 路径的对应关系，便于追溯与工具链选择。

**更新时机**：当新建 `specs/epic-{epic}/story-{story}-{slug}/` 或建立与 `specs/015-*/` 的映射时。

---

## 映射表

| 015 目录 | Epic-Story 路径 | 说明 |
|----------|-----------------|------|
| 015-indicator-system-refactor | epic-4/story-1-*, epic-4/story-2-*, ... | 一个 015 可对应多个 Story，逗号分隔 |
| （示例） | epic-4/story-1-implement-base-cache | 新 BMAD Story 路径 |

---

## 选择规则

- **BMAD 流程**：优先使用 `specs/epic-{epic}/story-{story}-{slug}/`
- **standalone**：优先使用 `specs/015-*/`
- **两者并存**：以本表为准，工具链根据本表解析
