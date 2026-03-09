# Tasks E13-S4: config 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.4 - config 子命令  
**输入**: IMPLEMENTATION_GAPS-E13-S4.md, plan-E13-S4.md, spec-E13-S4.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.3 | Story 13-4, spec §4 | AC-1～AC-4 | ConfigCommand 骨架、bin 注册、ConfigManager 调用 |
| T2–T2.3 | Story 13-4, spec §3 AC-1, AC-3 | get、list | get key 存在/不存在、--json；list 合并/--json |
| T3–T3.5 | Story 13-4, spec §3 AC-2, AC-4 | set | 作用域规则、--global、networkTimeoutMs Number、合并写入 |
| T4–T4.3 | Story 13-4, plan §5 | 测试 | 单元/集成、回归 init/check/upgrade |

---

## 2. Gaps → 任务映射

| 章节 | Gap ID | 对应任务 |
|------|--------|----------|
| spec §4 | GAP-1.1, 1.2 | T1.1–T1.3 |
| spec §3 AC-1, AC-3 | GAP-2.1, 2.2 | T2.1–T2.3 |
| spec §3 AC-2, AC-4 | GAP-3.1, 3.2, 3.3 | T3.1–T3.5 |
| plan Phase 1–4 | GAP-4.1 | T4.1–T4.3 |

---

## 3. Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止伪实现、占位
4. ❌ 禁止跳过 TDD 红灯阶段

**必须事项**:
1. ✅ TDD 红绿灯：红灯 → 绿灯 → 重构
2. ✅ 必须运行验收命令确认功能
3. ✅ 创建 prd.tasks-E13-S4.json、progress.tasks-E13-S4.txt
4. ✅ ralph-method：每完成一 US 更新 prd、progress

---

## 4. 任务列表

### T1: ConfigCommand 骨架与 bin 注册（AC-1～AC-4）

- [x] **T1.1** 新建 `packages/bmad-speckit/src/commands/config.js`，实现 configGetCommand、configSetCommand、configListCommand（或统一 configCommand 分发）；require ConfigManager（get、set、list、getProjectConfigPath）
  - **验收**：函数存在且可调用；ConfigManager 正确 require；**集成验证**：bin 注册后执行 `bmad-speckit config --help` 有输出
  - **生产代码**：config.js
  - **TDD**：先写验收测试（config get 不存在 key → exit 1），红灯后实现

- [x] **T1.2** 在 `bin/bmad-speckit.js` 注册 config 子命令，添加子命令 `config get <key>`、`config set <key> <value>`、`config list`，选项 `--global`、`--json`
  - **验收**：`bmad-speckit config --help` 显示 get/set/list；`bmad-speckit config get defaultAI` 可执行（存在时输出，不存在时 exit 1）
  - **生产代码**：bin/bmad-speckit.js
  - **集成测试**：config get 在 mock 或临时目录下验证调用 ConfigManager

- [x] **T1.3** 确保 config 子命令在 bin 中被生产代码关键路径导入并调用；执行 `bmad-speckit config list` 时 configListCommand 被实际调用
  - **验收**：grep 验证 bin 中 require config.js；执行 config list 有输出或空对象
  - **生产代码**：bin/bmad-speckit.js、config.js

### T2: config get 与 list（AC-1、AC-3）

- [x] **T2.1** 实现 config get：调用 ConfigManager.get(key, { cwd })；value 存在时 stdout 输出值，exit 0；value 为 undefined 时 stderr 含「不存在」或等价，exit 1
  - **验收**：config get defaultAI 存在→stdout 值；config get unknownKey→stderr、exit 1
  - **生产代码**：config.js get 分支
  - **集成测试**：临时目录设置 config，执行 get 验证

- [x] **T2.2** config get --json：输出合法 JSON（如 `{"defaultAI":"cursor-agent"}` 或 `{"key":"defaultAI","value":"cursor-agent"}`）
  - **验收**：config get defaultAI --json 输出可 JSON.parse
  - **生产代码**：config.js get 分支
  - **集成测试**：--json 时 stdout 可解析为 JSON

- [x] **T2.3** 实现 config list：调用 ConfigManager.list({ cwd })；无 --json 时人类可读（每行 key: value）；--json 时 JSON.stringify 输出对象
  - **验收**：config list 输出合并键值对；config list --json 输出合法 JSON 对象
  - **生产代码**：config.js list 分支
  - **集成测试**：项目级+全局均有 config 时 list 输出项目级覆盖全局

### T3: config set 与作用域规则（AC-2、AC-4）

- [x] **T3.1** 已 init 判定：`fs.existsSync(getProjectConfigPath(cwd))`；已 init 且无 --global → scope='project'；未 init 或有 --global → scope='global'
  - **验收**：已 init 目录 config set defaultAI x → 写入项目级 bmad-speckit.json；未 init 目录 → 写入全局；--global → 写入全局
  - **生产代码**：config.js set 分支
  - **集成测试**：三场景分别验证写入目标路径

- [x] **T3.2** 调用 ConfigManager.set(key, value, { scope, cwd })；scope='project' 时 cwd 必传；scope='global' 时 cwd 可空
  - **验收**：set 后文件内容正确；project 时项目级更新；global 时全局更新
  - **生产代码**：config.js set 分支

- [x] **T3.3** networkTimeoutMs 的 value 解析为 Number(value)；其余 key 保持字符串
  - **验收**：config set networkTimeoutMs 60000 后 JSON 中为 number 类型
  - **生产代码**：config.js set 分支 value 解析
  - **集成测试**：检查写入 JSON 中 networkTimeoutMs 为 number

- [x] **T3.4** 合并已有配置：set 单 key 不删除其他 key（ConfigManager.set 已支持 merge）
  - **验收**：项目级已含 selectedAI，config set defaultAI bob 后 selectedAI 仍存在
  - **生产代码**：config.js 正确调用 ConfigManager.set
  - **集成测试**：plan §5 AC-2#5 场景

- [x] **T3.5** set 后 exit 0；可 stdout 确认或静默
  - **验收**：config set 成功 exit 0
  - **生产代码**：config.js set 分支

### T4: 测试与验收

- [x] **T4.1** 单元/集成测试：config get 存在/不存在 key、networkTimeoutMs 默认、--json；config list 合并视图、仅全局（无项目级）、--json
  - **验收**：npm test 或等效命令通过；覆盖 plan §5 get 4 项、list 2 项；覆盖 spec AC-3#3 仅全局场景
  - **测试文件**：packages/bmad-speckit/tests/config*.test.js 或集成到现有 test 文件

- [x] **T4.2** 集成测试：config set 已 init/未 init/--global、networkTimeoutMs 数值、合并已有配置
  - **验收**：覆盖 plan §5 set 5 项
  - **测试文件**：同上

- [x] **T4.3** 回归：init、check、upgrade 不受 config 影响；ConfigManager 调用正确
  - **验收**：现有 init、check、upgrade 测试通过；grep 验证 config.js 正确 require 并调用 ConfigManager
  - **测试文件**：现有 E2E 或集成测试

---

## 5. 验收命令

| 任务 | 验收命令 |
|------|----------|
| T1 | `cd packages/bmad-speckit && npx bmad-speckit config --help` => 有 get/set/list 输出 |
| T2 | `npx bmad-speckit config get defaultAI`、`config get unknownKey`、`config get defaultAI --json`、`config list`、`config list --json` |
| T3 | `cd <已init目录> && npx bmad-speckit config set defaultAI x`、`cd <未init目录> && npx bmad-speckit config set defaultAI x`、`config set defaultAI x --global` |
| T4 | `cd packages/bmad-speckit && npm test` |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_tasks-E13-S4.md
