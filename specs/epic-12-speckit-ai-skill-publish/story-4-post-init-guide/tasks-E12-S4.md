# Tasks E12-S4: Post-init 引导

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.4 - Post-init 引导  
**输入**: IMPLEMENTATION_GAPS-E12-S4.md, plan-E12-S4.md, spec-E12-S4.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.3 | Story 12-4, spec §3.1 | AC-1, AC-4 | Post-init 引导 stdout 输出、文案与 PRD 一致 |
| T2–T2.2 | Story 12-4, spec §3.2 | AC-2 | 模板含 bmad-help 命令 |
| T3–T3.1 | Story 12-4, spec §3.3 | AC-3 | 模板含 speckit.constitution 命令 |
| T4–T4.3 | Story 12-4, plan Phase 4 | AC-1–4 | E2E、模板验收、 InitCommand 注释 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS-E12-S4.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §3.1、PRD | GAP-1.1 | ✓ | T1.1–T1.3 |
| spec §3.2、AC-2 | GAP-2.1, GAP-2.2 | ✓ | T2.1–T2.2 |
| spec §3.3、AC-3 | GAP-3.1, GAP-3.2 | ✓ | T3.1 |
| plan Phase 4 | GAP-4.1, GAP-4.2, GAP-4.3 | ✓ | T4.1–T4.3 |

---

## 3. Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止用「预留」「占位」等词规避实现

**必须事项**:
1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验证命令确认功能启用
3. ✅ TDD 红绿灯：涉及生产代码的 US 须独立 RED→GREEN→REFACTOR，禁止跳过

---

## 4. 任务列表

### T1: Post-init 引导 stdout 输出（AC-1, AC-4, GAP-1.1）

- [x] **T1.1** 在 init.js 中定义 Post-init 引导文案常量（或内联），与 PRD §5.2、§5.13 一致：「Init 完成。建议在 AI IDE 中运行 `/bmad-help` 获取下一步指引，或运行 `speckit.constitution` 开始 Spec-Driven Development。」
  - **验收**：文案含 /bmad-help、speckit.constitution；使用 chalk.gray 输出
  - **生产代码**：init.js
  - **集成验证**：该引导被 init 成功路径调用，由 T4.1 覆盖

- [x] **T1.2** 在 runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 三处成功完成点，将现有 `console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));` 替换为上述完整引导文案
  - **验收**：三处均输出完整文案；引导仅在 try 块正常完成时执行；catch 块不输出引导
  - **生产代码**：init.js 三处替换
  - **集成测试**：init --ai cursor --yes 后 stdout 含 /bmad-help、speckit.constitution

- [x] **T1.3** 确保 init 失败（catch 块）时不输出 Post-init 引导
  - **验收**：模拟 init 失败（如网络错误）时 stdout 不含引导；仅输出错误信息
  - **生产代码**：init.js catch 块逻辑（无需修改，验证现有逻辑）
  - **集成测试**：失败场景断言无引导输出

### T2: 模板含 bmad-help 命令（AC-2, GAP-2.1, GAP-2.2）

- [x] **T2.1** 创建 `_bmad/cursor/commands/` 目录（若不存在）；创建 `_bmad/cursor/commands/bmad-help.md`，内容引用 bmad-help 流程或 `_bmad/core/tasks/help.md`
  - **验收**：_bmad/cursor/commands/bmad-help.md 存在；SyncService 可将该文件同步到所选 AI 目标目录
  - **生产代码**：模板文件 _bmad/cursor/commands/bmad-help.md（新建）
  - **集成验证**：init 后 .cursor/commands/ 或所选 AI commandsDir 存在 bmad-help 命令文件，由 T4.2 覆盖

- [x] **T2.2** --modules 场景：若模板按模块拆分，确保 bmad-help 在公共 commands（即 _bmad/cursor/commands/）或所选模块 commands 中；本模板为单体结构时，cursor/commands 为公共，--modules 过滤不影响 commands 部署
  - **验收**：init --modules bmm,tea --ai cursor --yes 后 commands 仍含 bmad-help
  - **文档/验证**：与 Story 12.2 SyncService --modules 逻辑对齐；若当前模板为单体则记录约定

### T3: 模板含 speckit.constitution 命令（AC-3, GAP-3.1, GAP-3.2）

- [x] **T3.1** 创建 `_bmad/cursor/commands/speckit.constitution.md`，内容触发 Spec-Driven Development 宪章阶段（可引用 speckit-workflow skill 或 constitution 流程）
  - **验收**：_bmad/cursor/commands/speckit.constitution.md 存在；init 后目标 commands 含 speckit.constitution；命令可被 AI IDE 识别执行
  - **生产代码**：模板文件 _bmad/cursor/commands/speckit.constitution.md（新建）
  - **集成验证**：init 后 .cursor/commands/ 存在 speckit.constitution，由 T4.2 覆盖

### T4: 验收与文档（AC-1–4, GAP-4.1, GAP-4.2, GAP-4.3）

- [x] **T4.1** E2E 验收：`bmad-speckit init --ai cursor --yes` 成功完成后 stdout 含 /bmad-help、speckit.constitution 提示；非交互模式同样输出
  - **验收**：执行 init，断言 stdout 含预期文案；init 失败时不含引导
  - **测试代码**：packages/bmad-speckit/tests/e2e/init-e2e.test.js 或等效

- [x] **T4.2** 验收模板：init 后目标项目 .cursor/commands/（或所选 AI 对应 configTemplate.commandsDir）存在 bmad-help、speckit.constitution 命令文件
  - **验收**：init 后检查目标 commands 目录；--modules bmm,tea 场景（若适用）同样验证
  - **测试代码**：e2e 或集成测试

- [x] **T4.3** 更新 InitCommand 相关注释，说明 Post-init 引导的触发时机与输出内容
  - **验收**：init.js 在引导输出处或文件头含注释
  - **文档**：init.js 注释
