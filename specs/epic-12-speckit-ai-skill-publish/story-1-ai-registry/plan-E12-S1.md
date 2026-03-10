# Plan E12-S1: AI Registry 实现方案

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.1 - AI Registry  
**输入**: spec-E12-S1.md, 12-1-ai-registry.md, PRD, ARCH

---

## 1. 概述

本 plan 定义 Story 12.1（AI Registry）的实现方案，实现 AIRegistry 模块、19+ 内置 configTemplate、registry 文件加载与合并、generic 校验与退出码 2，供 init 与 check 使用。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| PRD §5.3、§5.9 | spec §3 | Phase 1、Phase 2 | ✅ |
| PRD §5.3.1、§5.12、§5.12.1 | spec §4 | Phase 2、Phase 3 | ✅ |
| ARCH §3.2、§4.2 | spec §6 | Phase 1、Phase 2 | ✅ |
| Story AC-1 | spec §3 | Phase 1、集成测试 | ✅ |
| Story AC-2 | spec §4 | Phase 2、单元/集成测试 | ✅ |
| Story AC-3 | spec §4.1 | Phase 3、单元测试 | ✅ |
| Story AC-4 | spec §5 | Phase 4、集成测试 | ✅ |
| Story AC-5 | spec §6 | Phase 1、单元/集成测试 | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| AIRegistry | `src/services/ai-registry.js` | load()、getById()、listIds()；内置 + 全局 + 项目合并 |
| ai-registry-builtin | `src/constants/ai-registry-builtin.js` | 19+ AI 完整 configTemplate（新建） |
| ai-builtin | `src/constants/ai-builtin.js` | 保留 id/name/description 简化列表；或由 ai-registry-builtin 取代 |
| init.js | `src/commands/init.js` | 引用 AIRegistry 替代 aiBuiltin；generic 校验、退出码 2 |
| check.js | `src/commands/check.js` | 引用 AIRegistry；check --list-ai 使用 listIds() |

### 3.2 数据流

```
ai-registry-builtin.js (22 条内置)
        ↓
AIRegistry.load({ cwd })
   → 读取 ~/.bmad-speckit/ai-registry.json（存在则解析）
   → 读取 <cwd>/_bmad-output/config/ai-registry.json（存在则解析）
   → 合并：项目 > 全局 > 内置
        ↓
init / check 使用 getById、listIds
```

### 3.3 集成点

| 调用方 | 使用方式 |
|--------|----------|
| init 非交互 flow | `AIRegistry.getById(ai, { cwd })` 校验 --ai；`AIRegistry.listIds({ cwd })` 无效时提示 |
| init 交互 flow | `AIRegistry.load({ cwd })` 获取列表供选择器 |
| check --list-ai | `AIRegistry.listIds({ cwd })` |
| generic 校验 | `getById('generic', { cwd })` + 检查 aiCommandsDir 或 options.aiCommandsDir |

---

## 4. 实现阶段（Phases）

### Phase 1: AIRegistry 模块与 load 逻辑

**目标**：实现 `src/services/ai-registry.js`，load()、getById()、listIds()。

**实现要点**：
1. 新建 `ai-registry.js`，无状态；`load({ cwd })` 每次重新读取文件
2. 全局路径：`path.join(os.homedir(), '.bmad-speckit', 'ai-registry.json')`
3. 项目路径：`path.join(cwd || process.cwd(), '_bmad-output', 'config', 'ai-registry.json')`
4. 文件不存在 → 空数组；JSON 解析失败 → throw Error 含路径
5. 支持两种文件格式：`{ "ais": [...] }` 或 `[...]`
6. 合并：内置为底，全局覆盖，项目覆盖；按 id 去重；configTemplate 深度合并
7. `getById(id, { cwd })`：从 load 结果中查找
8. `listIds({ cwd })`：返回 load 结果的 id 数组

**产出**：`src/services/ai-registry.js`

### Phase 2: 19+ 内置 configTemplate

**目标**：新建 `ai-registry-builtin.js`，22 条完整 configTemplate。

**实现要点**：
1. 新建 `src/constants/ai-registry-builtin.js`，导出 22 条数组
2. 每条含 id、name、description、configTemplate（含 commandsDir、rulesDir、skillsDir、agentsDir/configDir、vscodeSettings、subagentSupport）
3. 严格按 spec §4.3 表填充；opencode 用 `.opencode/command`，auggie 仅 `.augment/rules`
4. AIRegistry 在 load 时引入内置列表作为底稿

**产出**：`src/constants/ai-registry-builtin.js`

### Phase 3: registry 文件格式与 configTemplate 校验

**目标**：解析 `{ "ais": [...] }` 与 `[...]`；用户/项目 registry 自定义 AI 时校验 configTemplate。

**实现要点**：
1. 解析顶层：若为数组直接使用；若为对象则取 `ais`
2. 单条目支持 id、name、description、configTemplate、rulesPath、detectCommand、aiCommandsDir（见 spec §4.1，后四者可选）
3. 用户/项目 registry 新增 id（非覆盖内置）时，configTemplate 必填；缺则 throw 含文件路径
4. 校验：commandsDir 与 rulesDir 至少其一；agentsDir 与 configDir 二选一；skillsDir 按 PRD 表判定

**产出**：集成到 `ai-registry.js` load 逻辑

### Phase 4: generic 校验与 init/check 集成

**目标**：`--ai generic` 时校验 aiCommandsDir；退出码 2；init/check 接入 AIRegistry。

**实现要点**：
1. init：在 runNonInteractiveFlow、runWorktreeFlow、runInteractiveFlow 中，当 ai===generic 时检查：`--ai-commands-dir` 已传 或 `getById('generic').aiCommandsDir` 存在
2. 均不满足 → process.exit(exitCodes.AI_INVALID)（退出码 2），输出提示
3. check：若需在 check 中校验 generic，同理
4. init 的 ai 校验：用 `AIRegistry.getById(ai, { cwd })` 替代 `aiBuiltin` 查找；无效时用 `listIds()` 提示
5. check --list-ai：用 `AIRegistry.listIds({ cwd })` 输出

**产出**：修改 `init.js`、`check.js`；bin 增加 `--ai-commands-dir` 选项

### Phase 5: 测试与跨平台验证

**目标**：单元测试、集成测试、端到端测试；跨平台路径验证。

**实现要点**：见 §5 测试计划。

---

## 5. 集成测试与端到端功能测试计划

### 5.1 单元测试（必要补充）

| 测试文件 | 用例 | 验证内容 |
|----------|------|----------|
| `tests/ai-registry.test.js` | load 空文件 | 全局/项目文件不存在时返回内置列表 |
| | load 全局覆盖 | 全局 registry 覆盖同 id 内置 |
| | load 项目覆盖 | 项目 registry 覆盖同 id 全局/内置 |
| | load 合并顺序 | 同 id 时项目 > 全局 > 内置 |
| | load JSON 失败 | 解析失败时 throw，含路径 |
| | getById 存在/不存在 | 返回条目或 null |
| | listIds | 返回 id 数组 |
| | configTemplate 深度合并 | 项目级字段覆盖同名字段 |
| | 两种文件格式 | `{ "ais": [...] }` 与 `[...]` 均支持 |
| | 自定义 AI configTemplate 缺失 | 抛出错误含路径 |

### 5.2 集成测试（必须）

| 测试文件 | 用例 | 验证内容 |
|----------|------|----------|
| `tests/ai-registry-integration.test.js` | init 使用 AIRegistry | init --ai cursor --yes 时 AI 来自 AIRegistry.load |
| | check --list-ai 使用 AIRegistry | check --list-ai 输出与 listIds() 一致 |
| | init 接入生产代码路径 | grep init.js 含 require('ai-registry') 或 require('../services/ai-registry') 或等效 |
| | check 接入生产代码路径 | grep check.js 含 require('ai-registry') 或 require('../services/ai-registry') 或等效（当本 Story 实现 check --list-ai 或 generic 校验时） |
| | generic 无 aiCommandsDir 退出码 2 | init --ai generic --yes 无 --ai-commands-dir 且 registry 无 aiCommandsDir → exit 2 |
| | generic 有 --ai-commands-dir 通过 | init --ai generic --yes --ai-commands-dir ./fixtures/commands → 通过 |
| | --ai 无效时提示 listIds | init --ai invalid-ai --yes → 输出可用 AI 列表或 check --list-ai 提示 |

**验证方式**：在 packages/bmad-speckit 目录执行 `node --test tests/ai-registry*.test.js` 或根目录 `npm run test:bmad-speckit`，全部通过。

### 5.3 端到端功能测试（必须）

| 测试文件 | 用例 | 验证内容 |
|----------|------|----------|
| `tests/e2e/init-e2e.test.js` | e2e init --ai cursor | init 完成后 bmad-speckit.json 含 selectedAI: cursor |
| | e2e init --ai generic --ai-commands-dir | 指定目录后 init 成功 |
| | e2e check --list-ai | 输出包含内置 22 项及自定义（若有） |
| | e2e 全局 registry 覆盖 | 创建 ~/.bmad-speckit/ai-registry.json，init 后列表含自定义 AI |

**验证方式**：在临时目录执行 init、check，验证输出与文件变更；确认 AIRegistry 在生产代码关键路径被调用。

### 5.4 跨平台路径验证

- 使用 `path.join`、`os.homedir()` 解析路径
- 在 Windows / macOS / Linux（或 CI 可用的平台）运行测试，无硬编码 `/` 或 `\`

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| ai-builtin 与 ai-registry-builtin 重复 | 方案：ai-registry-builtin 为单一数据源；ai-builtin 可保留为向后兼容的简化导出，或移除由 AIRegistry 统一暴露 |
| check 命令尚无 --list-ai | 若 check 尚未实现 --list-ai，本 Story 实现 listIds() 供后续 Story 13.1 集成 |
| init 多处引用 aiBuiltin | 替换为 `AIRegistry.load()` / `getById()` / `listIds()`，逐处修改 |

---

## 7. 验收检查点

- [ ] AIRegistry 模块可独立 import，load/getById/listIds 行为符合 spec
- [ ] 19+ 内置 configTemplate 与 spec §4.3 表一致
- [ ] init --ai cursor --yes 使用 AIRegistry 获取 AI 列表
- [ ] init --ai generic --yes 无 aiCommandsDir 时退出码 2
- [ ] init --ai generic --yes --ai-commands-dir ./x 通过
- [ ] check --list-ai 输出与 listIds() 一致（若已实现）
- [ ] 单元 + 集成 + 端到端测试全部通过
