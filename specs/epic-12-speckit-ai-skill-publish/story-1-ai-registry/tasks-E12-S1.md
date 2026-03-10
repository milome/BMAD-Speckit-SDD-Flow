# Tasks E12-S1: AI Registry

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.1 - AI Registry  
**输入**: IMPLEMENTATION_GAPS-E12-S1.md, plan-E12-S1.md, spec-E12-S1.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.4 | Story 12-1, spec §3, §6 | AC-1, AC-5 | AIRegistry 模块、load/getById/listIds、路径、合并 |
| T2–T2.4 | Story 12-1, spec §4 | AC-2 | 19+ 内置 configTemplate、条件约束、subagentSupport、spec-kit 对齐 |
| T3–T3.3 | Story 12-1, spec §4.1 | AC-3 | registry 文件格式、configTemplate 校验、detectCommand |
| T4–T4.2 | Story 12-1, spec §5 | AC-4 | generic 校验、退出码 2、--ai-commands-dir |
| T5–T5.3 | Story 12-1, plan Phase 5 | AC-1–5 | 集成、单元测试、E2E、跨平台 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS-E12-S1.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §3 | GAP-1.1, 1.2, 1.3, 1.4 | ✓ | T1.1, T1.2, T1.3 |
| spec §4 | GAP-2.1, 2.2, 2.3 | ✓ | T2.1–T2.4 |
| spec §4.1 | GAP-3.1, 3.2, 3.3 | ✓ | T3.1–T3.3 |
| spec §5 | GAP-4.1, 4.2 | ✓ | T4.1, T4.2 |
| spec §6 | GAP-5.1–5.7 | ✓ | T1, T4, T5 |

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

### T1: AIRegistry 模块（AC-1, AC-5）

- [x] **T1.1** 新建 `packages/bmad-speckit/src/services/ai-registry.js`，实现 load()、getById()、listIds()
  - **验收**：load({ cwd }) 返回合并后 AI 列表；getById(id, { cwd }) 返回条目或 null；listIds({ cwd }) 返回 id 数组；**集成验证**：该模块在生产代码关键路径中被导入并调用，由 T5.1 覆盖
  - **生产代码**：ai-registry.js、load、readGlobalRegistry、readProjectRegistry、mergeByPriority、deepMergeConfigTemplate
  - **集成测试**：tests/ai-registry.test.js，node --test tests/ai-registry.test.js

- [x] **T1.2** load() 读取 `~/.bmad-speckit/ai-registry.json`、`<cwd>/_bmad-output/config/ai-registry.json`；使用 path.join、os.homedir() 跨平台
  - **验收**：文件不存在不报错；路径解析正确
  - **生产代码**：ai-registry.js 内路径解析逻辑
  - **集成测试**：tests/ai-registry.test.js load 空文件、路径解析

- [x] **T1.3** 文件不存在返回空数组；JSON 解析失败抛出含路径错误
  - **验收**：无效 JSON 时 throw Error，message 含文件路径
  - **生产代码**：try/catch JSON.parse，throw new Error(\`Invalid JSON: ${filePath}\`)
  - **集成测试**：tests/ai-registry.test.js load JSON 失败

- [x] **T1.4** 合并：项目 > 全局 > 内置；按 id 去重；configTemplate 深度合并
  - **验收**：同 id 时项目覆盖全局覆盖内置；configTemplate 字段深度合并
  - **生产代码**：mergeByPriority、deepMergeConfigTemplate
  - **集成测试**：tests/ai-registry.test.js 合并顺序、深度合并

### T2: 19+ 内置 configTemplate（AC-2）

- [x] **T2.1** 新建 `packages/bmad-speckit/src/constants/ai-registry-builtin.js`，定义 22 条完整 configTemplate
  - **验收**：每条含 id、name、description、configTemplate（commandsDir、rulesDir、skillsDir、agentsDir/configDir、subagentSupport）；**集成验证**：该模块被 AIRegistry.load 引入并在 init 关键路径使用，由 T5.1 覆盖
  - **生产代码**：ai-registry-builtin.js 导出数组
  - **集成测试**：tests/ai-registry-builtin.test.js 或 ai-registry.test.js 校验条数与字段

- [x] **T2.2** 按 PRD §5.12、spec §4.3 表填充 commandsDir、rulesDir、skillsDir、agentsDir/configDir
  - **验收**：opencode→.opencode/command；auggie→.augment/rules；bob→.bob/commands；shai→.shai/commands；codex→.codex/commands
  - **生产代码**：ai-registry-builtin.js 各条目
  - **集成测试**：断言 opencode、auggie、bob、shai、codex 的 configTemplate 符合 spec

- [x] **T2.3** 按 PRD §5.12.1 填充 subagentSupport：native|mcp|limited|none
  - **验收**：每 AI 含 subagentSupport，与 spec §4.2.2 表一致
  - **生产代码**：ai-registry-builtin.js
  - **集成测试**：断言 subagentSupport 枚举值合法

- [x] **T2.4** AIRegistry load 时引入 ai-registry-builtin 作为内置底稿
  - **验收**：load 无文件时返回内置 22 条
  - **生产代码**：ai-registry.js require ai-registry-builtin
  - **集成测试**：tests/ai-registry.test.js load 空文件返回内置

### T3: registry 文件格式与校验（AC-3）

- [x] **T3.1** 支持两种文件格式：`{ "ais": [...] }` 与 `[...]`；单条目支持 id、name、description、configTemplate、rulesPath、detectCommand、aiCommandsDir（spec §4.1，后四者可选）
  - **验收**：两种格式均能正确解析；单条目含 rulesPath、detectCommand、aiCommandsDir 时能正确读取；**集成验证**：解析逻辑在 load 中被调用，由 T5.1 覆盖
  - **生产代码**：ai-registry.js parseRegistryFile
  - **集成测试**：tests/ai-registry.test.js 两种格式解析、可选字段解析

- [x] **T3.2** 用户/项目 registry 自定义 AI 时 configTemplate 必填；缺失时 load 抛错含路径
  - **验收**：自定义 id 无 configTemplate 时 throw
  - **生产代码**：ai-registry.js 校验逻辑
  - **集成测试**：tests/ai-registry.test.js 自定义 AI 缺 configTemplate

- [x] **T3.3** 校验 configTemplate：commandsDir/rulesDir 至少其一；agentsDir/configDir 二选一
  - **验收**：违反约束时 load 抛错
  - **生产代码**：ai-registry.js validateConfigTemplate
  - **集成测试**：tests/ai-registry.test.js configTemplate 校验

### T4: generic 校验与 init 集成（AC-4）

- [x] **T4.1** bin 增加 `--ai-commands-dir <path>` 选项；init 当 --ai generic 时校验：--ai-commands-dir 已传 或 registry 中 generic 含 aiCommandsDir
  - **验收**：均不满足时退出码 2，输出提示
  - **生产代码**：bin/bmad-speckit.js、init.js、resolveGenericAiCommandsDir
  - **集成测试**：tests/ai-registry-integration.test.js 或 e2e：init --ai generic --yes 无 --ai-commands-dir → exit 2

- [x] **T4.2** init 使用 AIRegistry 替代 aiBuiltin；--ai 无效时用 listIds() 提示
  - **验收**：init --ai cursor --yes 使用 AIRegistry.getById；无效时输出 listIds 或 check --list-ai 提示
  - **生产代码**：init.js require ai-registry，替换 aiBuiltin 引用
  - **集成测试**：grep init.js 含 require('../services/ai-registry')；init --ai cursor --yes 成功；init --ai invalid --yes → exit 2

### T5: 集成与测试（AC-1–5）

- [x] **T5.1** 将 AIRegistry 接入 init 的 AI 选择逻辑；runNonInteractiveFlow、runWorktreeFlow、runInteractiveFlow 均使用 AIRegistry
  - **验收**：init 交互/非交互/worktree 均从 AIRegistry 获取 AI 列表；grep init.js 含 require('../services/ai-registry') 或等效
  - **生产代码**：init.js 各 flow 中 AIRegistry.load、getById、listIds
  - **集成测试**：tests/ai-registry-integration.test.js init 使用 AIRegistry；init-e2e 验证生产路径

- [x] **T5.2** 单元测试 + 集成测试：load 空/全局/项目、合并顺序、configTemplate 校验、generic 校验
  - **验收**：node --test tests/ai-registry*.test.js 全部通过；tests/ai-registry-integration.test.js 全部通过
  - **生产代码**：无新增，仅测试
  - **集成测试**：npm run test 或 node --test tests/

- [x] **T5.3** 端到端功能测试（plan §5.3）+ 跨平台路径
  - **验收**：e2e init --ai cursor → bmad-speckit.json 含 selectedAI: cursor；e2e init --ai generic --ai-commands-dir <path> → 成功；e2e check --list-ai → 输出含内置 22 项（若本 Story 实现 check --list-ai）；e2e 全局 registry 覆盖 → 创建 ~/.bmad-speckit/ai-registry.json 后 init 含自定义 AI；无硬编码 `/` 或 `\`
  - **生产代码**：ai-registry.js 路径解析（path.join、os.homedir()）
  - **集成测试**：tests/e2e/init-e2e.test.js 或等效；代码审查 + 多平台测试（若可行）

---

## 5. Gaps → 任务映射（四类汇总）

| 类别 | Gap ID | 对应任务 |
|------|--------|----------|
| 数据模块 | GAP-2.1, 2.2, 2.3 | T2.1–T2.4 |
| AIRegistry 服务 | GAP-1.1–1.4, GAP-5.1–5.3, GAP-5.7 | T1.1–T1.4, T2.4 |
| Registry 解析 | GAP-3.1, 3.2, 3.3 | T3.1–T3.3 |
| init 集成 | GAP-4.1, 4.2, GAP-5.4, 5.5 | T4.1, T4.2, T5.1 |
| check 集成 | GAP-5.6 | （本 Story 可选；check --list-ai 可由 Story 13.1 实现，本 Story 提供 listIds 即可） |

---

## 6. 按 Gap 验收表（生产代码 + 集成测试）

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|-------------|----------|----------|
| GAP-1.1–1.4 | T1.1–T1.4 | ai-registry.js load、路径、合并 | node --test tests/ai-registry.test.js | [ ] 待执行 | [ ] |
| GAP-2.1–2.3 | T2.1–T2.4 | ai-registry-builtin.js 22 条 | tests 断言 configTemplate、subagentSupport | [ ] 待执行 | [ ] |
| GAP-3.1–3.3 | T3.1–T3.3 | ai-registry.js 解析、校验 | tests 两种格式、configTemplate 校验 | [ ] 待执行 | [ ] |
| GAP-4.1, 4.2 | T4.1, T4.2 | bin --ai-commands-dir、init generic 校验 | init --ai generic 无 dir → exit 2 | [ ] 待执行 | [ ] |
| GAP-5.1–5.5 | T1, T4, T5 | init 使用 AIRegistry | grep、init e2e | [ ] 待执行 | [ ] |

---

## 7. TDD 红绿灯执行规则

- **红灯**：先写/补测试，运行确认失败
- **绿灯**：写最少量生产代码使测试通过
- **重构**：在测试保护下优化；无重构时记录「无需重构 ✓」
- **进度**：每完成 US 更新 prd.{stem}.json、progress.{stem}.txt；涉及生产代码的 US 含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]
