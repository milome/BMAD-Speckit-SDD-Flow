# Tasks E12-S2: 引用完整性

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.2 - 引用完整性  
**输入**: IMPLEMENTATION_GAPS-E12-S2.md, plan-E12-S2.md, spec-E12-S2.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.6 | Story 12-2, spec §3 | AC-1, AC-2, AC-5 | SyncService、configTemplate 映射、vscodeSettings、worktree 源 |
| T2–T2.4 | Story 12-2, spec §5, plan Phase 2 | AC-1, AC-4, AC-5 | InitCommand 集成 SyncService、移除硬编码 |
| T3–T3.5 | Story 12-2, spec §4 | AC-3, AC-4 | CheckCommand selectedAI 验证、bmadPath 验证、无 bmadPath 时 _bmad 验证 |
| T4–T4.4 | Story 12-2, plan §3.3 | AC-1–5 | 单元、集成、E2E 测试 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS-E12-S2.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §3 | GAP-1.1, 1.2, 1.3, 1.4, 1.5, 1.6 | ✓ | T1.1–T1.6 |
| spec §5 | GAP-2.1, 2.2, 2.3 | ✓ | T2.1–T2.4 |
| spec §4 | GAP-3.1, 3.2, 3.3, 3.5 | ✓ | T3.1–T3.5 |

---

## 3. Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止仅初始化对象而不在关键路径中使用
4. ❌ 禁止用「预留」「占位」等词规避实现

**必须事项**:
1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验证命令确认功能启用
3. ✅ 遇到无法完成的情况，应报告阻塞而非自行延迟
4. ✅ 实施前检索需求文档相关章节
5. ✅ TDD 红绿灯：红灯 → 绿灯 → 重构，禁止跳过

---

## 4. 任务列表

### T1: SyncService 实现（AC-1, AC-2, AC-5）

- [x] **T1.1** 新建 `packages/bmad-speckit/src/services/sync-service.js`，实现 syncCommandsRulesConfig(projectRoot, selectedAI, options)
  - **验收**：函数存在且可调用；options 含 bmadPath（可选）；**集成验证**：该模块被 init 关键路径调用，由 T4.3 覆盖
  - **生产代码**：sync-service.js、syncCommandsRulesConfig
  - **单元测试**：tests/sync-service.test.js

- [x] **T1.2** 从 AIRegistry.getById(selectedAI) 获取 configTemplate；bmadPath 存在时从 bmadPath/cursor/ 读源，否则从 projectRoot/_bmad/cursor/
  - **验收**：源路径解析正确；bmadPath 优先级高于 _bmad
  - **生产代码**：sync-service.js 内源路径逻辑
  - **单元测试**：sync-service 源路径切换

- [x] **T1.3** 按 configTemplate.commandsDir、rulesDir 映射：cursor/commands → commandsDir、cursor/rules → rulesDir；禁止硬编码 .cursor/
  - **验收**：opencode 同步到 .opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands
  - **生产代码**：sync-service.js 映射逻辑
  - **单元测试**：各 selectedAI 映射正确性

- [x] **T1.4** 按 configTemplate.agentsDir 或 configDir 同步 cursor/config；configDir 为单文件（如 .codex/config.toml）时按 spec §3.3 处理
  - **验收**：agentsDir 时复制目录内容；configDir 单文件时写入目标
  - **生产代码**：sync-service.js config 同步
  - **单元测试**：config 同步场景

- [x] **T1.5** 若 configTemplate.vscodeSettings 存在，深度合并到 projectRoot/.vscode/settings.json；.vscode 不存在时创建；同键 configTemplate 优先
  - **验收**：新建、合并、无 vscodeSettings 时跳过
  - **生产代码**：sync-service.js vscodeSettings 逻辑
  - **单元测试**：vscodeSettings 合并

- [x] **T1.6** 源目录不存在时跳过，不抛错
  - **验收**：cursor/commands 不存在时不报错，跳过
  - **生产代码**：sync-service.js 存在性检查
  - **单元测试**：缺失源目录跳过

### T2: InitCommand 集成（AC-1, AC-4, AC-5）

- [x] **T2.1** 在 runNonInteractiveFlow、runWorktreeFlow、runInteractiveFlow 中，generateSkeleton 或 createWorktreeSkeleton 完成后调用 SyncService.syncCommandsRulesConfig
  - **验收**：init 后 AI 目标目录存在且内容正确；**集成验证**：init 流程中 SyncService 被调用，由 T4.3 覆盖
  - **生产代码**：init.js 调用 SyncService
  - **集成测试**：init --ai cursor-agent --yes 后 check 通过

- [x] **T2.2** 移除 init-skeleton.js 中 createWorktreeSkeleton 的硬编码 .cursor/、.claude/ 复制逻辑；仅创建 _bmad-output 目录，同步由 SyncService 完成
  - **验收**：createWorktreeSkeleton 不再复制到 .cursor/；SyncService 负责同步
  - **生产代码**：init-skeleton.js 修改
  - **集成测试**：init --bmad-path 后按 selectedAI 正确同步

- [x] **T2.3** 普通 init（有 _bmad 复制）在 generateSkeleton 后调用 SyncService
  - **验收**：非 worktree 模式 init 后也按 configTemplate 同步
  - **生产代码**：init.js runNonInteractiveFlow
  - **集成测试**：init（无 --bmad-path）--ai opencode 后 .opencode/command 存在

- [x] **T2.4** 传入 bmadPath 到 SyncService（worktree 模式）
  - **验收**：createWorktreeSkeleton 后 SyncService 收到 bmadPath，从 bmadPath 读源
  - **生产代码**：init.js 传 options.resolvedBmadPath
  - **集成测试**：init --bmad-path 后 check 验证 bmadPath 通过

### T3: CheckCommand 结构验证（AC-3, AC-4）

- [x] **T3.1** 读取 _bmad-output/config/bmad-speckit.json 的 selectedAI、bmadPath（通过 ConfigManager 或 fs.readFile）
  - **验收**：能正确读取 selectedAI、bmadPath
  - **生产代码**：check.js
  - **单元测试**：check 读取逻辑

- [x] **T3.2** 若 bmadPath 存在：validateBmadStructure(bmadPath)；invalid 时 exit 4，列出缺失项
  - **验收**：bmadPath 无效时 exit 4（已部分实现，确认完整）
  - **生产代码**：check.js
  - **集成测试**：bmadPath 指向无效路径时 check exit 4

- [x] **T3.3** 若 selectedAI 存在：从 AIRegistry 获取 configTemplate，按 spec §4.2 验证目标目录（cursor-agent、claude、opencode、bob、shai、codex 显式）
  - **验收**：目录缺失时 exit 1，列出缺失项；成功时 exit 0
  - **生产代码**：check.js、可选 structure-validate.js validateSelectedAITargets
  - **集成测试**：init --ai opencode 后 check 通过；手动删 .opencode/command 后 check exit 1

- [x] **T3.4** 无 selectedAI 时跳过 AI 目标目录验证（或验证 .cursor 向后兼容）
  - **验收**：无 selectedAI 时 check 不因 AI 目录失败
  - **生产代码**：check.js
  - **集成测试**：无 selectedAI 的 bmad-speckit.json 下 check 行为

- [x] **T3.5** 无 bmadPath 时：若 _bmad 存在则验证 _bmad 结构；selectedAI 存在时验证目标目录
  - **验收**：标准 init 项目（无 bmadPath）check 验证 _bmad + selectedAI 目标
  - **生产代码**：check.js 逻辑分支
  - **集成测试**：标准 init 后 check 通过

### T4: 单元、集成、E2E 测试（AC-1–5）

- [x] **T4.1** 单元测试：SyncService 对 cursor-agent、claude、opencode、bob、shai、codex 的映射正确性
  - **验收**：node --test 或 vitest 通过
  - **测试代码**：tests/sync-service.test.js

- [x] **T4.2** 单元测试：vscodeSettings 合并逻辑（新建、合并、无 vscodeSettings 时跳过）
  - **验收**：三场景测试通过
  - **测试代码**：tests/sync-service.test.js

- [x] **T4.3** 集成测试：init --ai cursor-agent --yes 后 check 通过；init --ai opencode --yes 后 .opencode/command 存在且 check 通过；init --ai bob --yes 后 .bob/commands 存在且 check 通过
  - **验收**：npm run test:bmad-speckit 或 e2e 通过；**端到端**：覆盖 cursor-agent、opencode、bob（至少 3 种 selectedAI）的 init→check 流程
  - **测试代码**：packages/bmad-speckit/tests/e2e/ 或 init-e2e.test.js

- [x] **T4.4** 集成测试：init --bmad-path 后 bmadPath 正确记录，check 验证通过；bmadPath 无效时 check exit 4
  - **验收**：worktree 模式 init+check、无效 bmadPath exit 4
  - **测试代码**：packages/bmad-speckit/tests/e2e/
