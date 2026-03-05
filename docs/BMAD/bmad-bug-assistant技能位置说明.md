# bmad-bug-assistant 与 bmad-story-assistant 技能位置说明

## 结论：两个 BMAD 助手技能均仅在全局维护

- **bmad-bug-assistant**：**Cursor 全局技能**  
  `{SKILLS_ROOT}\bmad-bug-assistant\SKILL.md`  
  所有改进（禁止词表、审计模板、首句角色定位等）都写在这个文件里。

- **bmad-story-assistant**：**Cursor 全局技能**  
  `{SKILLS_ROOT}\bmad-story-assistant\SKILL.md`

- **bmad-customization-backup**：**Cursor 全局技能**  
  `{SKILLS_ROOT}\bmad-customization-backup\SKILL.md`（含 scripts、references 子目录）

- **项目内不再维护上述技能的 SKILL 副本**：  
  本项目 `.cursor/skills/` 下不再保留上述 BMAD 相关 skill，统一使用全局 skill，避免重复维护。

## 为什么可能「看到两个」？

1. **名字相似**：列表里会同时出现「bmad-bug-assistant」和「bmad-story-assistant」，容易混淆。
2. **Cursor 技能来源**：Cursor 会同时显示「全局技能」和「项目 .cursor/skills 下的技能」。两者均只存在于**全局**，若在界面看到重复，可能是同一全局技能被展示了两次（例如按来源分组）。
3. **项目 skills 目录**：`.cursor/skills/` 下不再保留 bmad-bug-assistant、bmad-story-assistant、bmad-customization-backup，三者均仅在全局维护。

## 如何区分哪一个是改进过的全局 skill？

- **看路径**：改进过的、应使用的只有这一处：  
  `{SKILLS_ROOT}\bmad-bug-assistant\SKILL.md`  
  （在 Cursor 里看技能详情/路径时，以是否指向该路径为准。）
- **看内容**：该文件应包含：§ 禁止词表、BUG-A1-AUDIT/BUG-A2-UPDATE 等模板 ID、首句角色定位（如「本任务以以下 BMAD 角色…」「你是一位非常严苛的代码/文档审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）」等）。  
  若某处「bmad-bug-assistant」没有这些内容，就不是改进版。

## 可以只保留全局 skill 吗？

**可以，且建议只保留全局 skill。**

- **保留**：`{SKILLS_ROOT}\bmad-bug-assistant\SKILL.md`（全局）。
- **不要**在本项目 `.cursor/skills/` 下创建 `bmad-bug-assistant` 或复制一份 SKILL.md，否则会出现「两个 bmad-bug-assistant」，且容易改错文件。
- **项目内只需保留 rules**（规则为项目级，无全局目录）：  
  - `.cursor/rules/bmad-bug-assistant.mdc`：使用 bmad-bug-assistant 时先自检再发起子任务  
  - `.cursor/rules/bmad-story-assistant.mdc`：使用 bmad-story-assistant 时先自检再发起子任务  
  上述 rules 引用**全局** skill，项目内不需要 SKILL 副本。

## 若 Cursor 里仍显示两条「bmad-bug-assistant」

1. 在 Cursor 设置/技能列表中查看两条分别对应的路径，确认是否都指向 `{SKILLS_ROOT}\bmad-bug-assistant\`。
2. 若一条指向全局、一条指向项目且项目路径下没有该技能，多半是残留配置，可删除指向项目的那条或忽略项目侧条目。
3. 确保只启用/挂载**全局**的 bmad-bug-assistant，即可只保留并只使用改进过的全局 skill。
