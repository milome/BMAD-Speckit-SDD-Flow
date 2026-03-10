# Plan E12-S2: 引用完整性实现方案

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.2 - 引用完整性  
**输入**: spec-E12-S2.md, 12-2-reference-integrity.md, PRD, ARCH

---

## 1. 概述

本 plan 定义 Story 12.2（引用完整性）的实现方案：新建 SyncService 按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录（禁止写死 .cursor/）；支持 vscodeSettings 深度合并；增强 CheckCommand 按 selectedAI 验证目标目录、bmadPath 验证（退出码 4）；init 流程集成 SyncService。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| PRD §5.10 | spec §3 | Phase 1、Phase 2 | ✅ |
| PRD §5.11 | spec §4、§5 | Phase 2、Phase 3 | ✅ |
| PRD §5.5 | spec §4.2 | Phase 3 | ✅ |
| PRD §5.2 | spec §4.3 | Phase 3 | ✅ |
| PRD §5.3.1 | spec §3.4 | Phase 1 | ✅ |
| ARCH §3.2、§3.3 | spec §3、§5 | Phase 1、Phase 2 | ✅ |
| Story AC-1 | spec §3.2 | Phase 1、集成测试 | ✅ |
| Story AC-2 | spec §3.4 | Phase 1、单元/集成测试 | ✅ |
| Story AC-3 | spec §4.2 | Phase 3、集成测试 | ✅ |
| Story AC-4 | spec §4.3 | Phase 3、集成测试 | ✅ |
| Story AC-5 | spec §3.5 | Phase 1、Phase 2、集成测试 | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| SyncService | `src/services/sync-service.js` | syncCommandsRulesConfig(projectRoot, selectedAI, options)；按 configTemplate 映射 commands/rules/config；vscodeSettings 深度合并 |
| InitCommand | `src/commands/init.js` | 在 generateSkeleton/createWorktreeSkeleton 后调用 SyncService；传入 bmadPath |
| init-skeleton | `src/commands/init-skeleton.js` | 移除硬编码 .cursor/ 同步逻辑；保留 writeSelectedAI、createWorktreeSkeleton 骨架创建，同步逻辑委托 SyncService |
| CheckCommand | `src/commands/check.js` | 读取 bmad-speckit.json；bmadPath 验证（退出码 4）；selectedAI 目标目录验证；无 bmadPath 时验证 _bmad + selectedAI |
| structure-validate | `src/utils/structure-validate.js` | 保留 validateBmadStructure；可选：新增 validateSelectedAITargets(cwd, selectedAI) |

### 3.2 数据流

```
init 流程:
  generateSkeleton / createWorktreeSkeleton (骨架)
       ↓
  SyncService.syncCommandsRulesConfig(projectRoot, selectedAI, { bmadPath })
       ↓ 从 AIRegistry.getById 获取 configTemplate
       ↓ 源：bmadPath/cursor 或 projectRoot/_bmad/cursor
       ↓ 目标：configTemplate.commandsDir、rulesDir、agentsDir/configDir（项目根下）
       ↓ 若有 vscodeSettings：深度合并 .vscode/settings.json
       ↓
  writeSelectedAI

check 流程:
  读取 bmad-speckit.json (selectedAI, bmadPath)
       ↓
  若 bmadPath：validateBmadStructure(bmadPath) → 失败 exit 4
       ↓
  若 selectedAI：validateSelectedAITargets(cwd, selectedAI) → 失败 exit 1
       ↓
  成功 exit 0
```

### 3.3 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| **SyncService 单元测试** | commands/rules/config 映射正确性（cursor-agent、claude、opencode、bob、shai、codex）；vscodeSettings 新建/合并/无 vscodeSettings 时跳过 | 断言目录存在、文件内容正确 |
| **SyncService 单元测试** | bmadPath 作为源 vs 默认 projectRoot/_bmad/cursor | 断言同步源切换正确 |
| **集成测试** | init --ai cursor-agent --yes 后 check 通过 | 执行 init，再执行 check，exit 0 |
| **集成测试** | init --ai opencode --yes 后 .opencode/command 存在且 check 通过 | 断言 .opencode/command 存在，check exit 0 |
| **集成测试** | init --ai bob --yes 后 .bob/commands 存在且 check 通过 | 同上 |
| **集成测试** | init --bmad-path /tmp/shared/_bmad --ai cursor-agent --yes 后 bmadPath 正确记录，check 验证 bmadPath 通过 | 断言 bmad-speckit.json 含 bmadPath；check exit 0 |
| **集成测试** | bmadPath 指向无效路径时 check 退出码 4 | 手动设 bmadPath 为不存在的路径，check exit 4 |
| **端到端** | 各 selectedAI 完整 init→check 流程 | 覆盖 cursor-agent、claude、opencode、bob、shai、codex 至少 3 种 |

---

## 4. 实现阶段（Phases）

### Phase 1: SyncService 实现

**目标**：新建 `src/services/sync-service.js`，实现 syncCommandsRulesConfig。

**实现要点**：
1. 从 AIRegistry.getById(selectedAI, { cwd: projectRoot }) 获取 configTemplate
2. 解析源根：options.bmadPath 存在则 `path.resolve(bmadPath)/cursor`，否则 `path.join(projectRoot, '_bmad', 'cursor')`
3. 按 configTemplate.commandsDir、rulesDir、agentsDir、configDir 逐项同步：
   - commandsDir：复制 cursor/commands → projectRoot/commandsDir
   - rulesDir：复制 cursor/rules → projectRoot/rulesDir
   - agentsDir：复制 cursor/config/* → projectRoot/agentsDir
   - configDir（无 agentsDir 时）：将 cursor/config 内容写入 configDir；单文件时按 spec §3.3 处理（如 codex 的 .codex/config.toml）
4. vscodeSettings：若 configTemplate.vscodeSettings 存在，读取其内容（可为 JSON 对象或路径），深度合并到 projectRoot/.vscode/settings.json；同键 configTemplate 优先
5. 使用 fs-extra 或 fs 递归复制；path.join 跨平台
6. 源不存在时跳过，不抛错

**产出**：`src/services/sync-service.js`

### Phase 2: InitCommand 集成

**目标**：init 流程调用 SyncService，移除 init-skeleton 中的硬编码 .cursor/ 同步。

**实现要点**：
1. 在 runNonInteractiveFlow、runWorktreeFlow、runInteractiveFlow 中，generateSkeleton 或 createWorktreeSkeleton 完成后、writeSelectedAI 之前或之后，调用 `SyncService.syncCommandsRulesConfig(targetPath, selectedAI, { bmadPath: options.bmadPath || null })`
2. createWorktreeSkeleton：不再复制 cursor→.cursor、claude→.claude；仅创建 _bmad-output 目录结构，同步全权交给 SyncService
3. generateWorktreeSkeleton：同理，移除 .cursor 硬编码复制，由 SyncService 接管
4. 普通 init（有 _bmad 复制）：generateSkeleton 后也须调用 SyncService，将 _bmad/cursor 按 configTemplate 同步到所选 AI 目标

**产出**：修改 `init.js`、`init-skeleton.js`

### Phase 3: CheckCommand 结构验证

**目标**：check 按 selectedAI 验证目标目录；bmadPath 验证退出码 4；无 bmadPath 时验证 _bmad + selectedAI。

**实现要点**：
1. 读取 `_bmad-output/config/bmad-speckit.json`（通过 ConfigManager 或直接 fs.readFile）
2. **bmadPath 存在**：调用 validateBmadStructure(path.resolve(bmadPath))；invalid 则 console.error 列出缺失项，process.exit(exitCodes.TARGET_PATH_UNAVAILABLE)
3. **selectedAI 存在**：从 AIRegistry.getById(selectedAI, { cwd }) 获取 configTemplate，按 spec §4.2 验证：
   - cursor-agent：.cursor 存在，commands/、rules/、agents/ 至少其一
   - claude：.claude 存在，commands/ 或 rules/ 至少其一
   - opencode：.opencode 存在，command/ 存在
   - bob：.bob 存在，commands/ 存在
   - shai：.shai 存在，commands/ 存在
   - codex：.codex 存在，commands/ 存在
   - 其他：按 configTemplate.commandsDir、rulesDir 解析根目录验证
4. 结构验证失败：exit 1，列出缺失项
5. **无 bmadPath**：若项目内 _bmad 存在，验证 _bmad 结构；selectedAI 存在时验证目标目录
6. **无 selectedAI**：跳过 AI 目标目录验证，或验证 .cursor 向后兼容（与 Story 13.1 约定）

**产出**：修改 `check.js`；可选扩展 `structure-validate.js` 新增 validateSelectedAITargets

---

## 5. 测试策略

| 层级 | 覆盖 |
|------|------|
| 单元 | SyncService 各映射、vscodeSettings 合并、源路径切换 |
| 集成 | init + check 组合；各 selectedAI；--bmad-path |
| 端到端 | 完整用户流程：init → check 通过 |

---

## 6. 依赖与约束

- **依赖**：Story 12.1 AIRegistry、ai-registry-builtin 含 configTemplate
- **约束**：禁止写死 .cursor/；跨平台 path.join/path.resolve
