# Plan E13-S4: config 子命令实现方案

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.4 - config 子命令  
**输入**: spec-E13-S4.md, 13-4-config.md, PRD, ARCH

---

## 1. 概述

本 plan 定义 Story 13.4（config 子命令）的实现方案：新建 ConfigCommand 模块实现 `config get <key>`、`config set <key> <value>`、`config list`；支持 `--global`（仅 set）、`--json` 输出；复用 Story 10.4 的 ConfigManager；已 init 判定与 check、upgrade 一致。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| PRD US-11, ARCH §3.2 ConfigCommand | spec §2.1, §3 | Phase 1, Phase 2, Phase 3 | ✅ |
| Story AC-1 | spec §3 AC-1 | Phase 2 | ✅ |
| Story AC-2, AC-4 | spec §3 AC-2, AC-4 | Phase 3 | ✅ |
| Story AC-3 | spec §3 AC-3 | Phase 2 | ✅ |
| Epics 13.4 | spec §2.1 | Phase 1–3 | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| ConfigCommand | `src/commands/config.js`（新建） | configCommand 入口；解析子命令 get/set/list；调用 ConfigManager |
| config-manager | `src/services/config-manager.js` | 已有；get、set、list、getProjectConfigPath |
| bin | `bin/bmad-speckit.js` | 注册 config 子命令及 get/set/list 子子命令；--global、--json 选项 |

### 3.2 数据流

```
config get <key>:
  1. 解析 key、options.json
  2. value = ConfigManager.get(key, { cwd })
  3. 若 value === undefined → stderr 含「不存在」或等价，exit 1
  4. 若 options.json → stdout JSON.stringify({ [key]: value } 或 { key, value })，exit 0
  5. 否则 stdout 输出 value，exit 0

config set <key> <value>:
  1. 解析 key、value、options.global
  2. 已 init 判定：fs.existsSync(ConfigManager.getProjectConfigPath(cwd))
  3. 若已 init 且 !options.global → scope='project'
  4. 否则 → scope='global'
  5. 若 key === 'networkTimeoutMs' → value = Number(value)
  6. ConfigManager.set(key, value, { scope, cwd })
  7. exit 0

config list:
  1. obj = ConfigManager.list({ cwd })
  2. 若 options.json → stdout JSON.stringify(obj)，exit 0
  3. 否则人类可读（每行 key: value），exit 0
```

### 3.3 bin 注册结构

参考 upgrade 的 Commander 用法；config 需子命令嵌套：

```javascript
program
  .command('config')
  .description('Get/set/list bmad-speckit config')
  .option('--global', 'Force global scope (set only)')
  .option('--json', 'Output as JSON')
  .addCommand(
    new Command('get <key>').action((key, opts) => configGetCommand(process.cwd(), { key, json: opts.parent.json }))
  )
  .addCommand(
    new Command('set <key> <value>').action((key, value, opts) => configSetCommand(process.cwd(), { key, value, global: opts.parent.global }))
  )
  .addCommand(
    new Command('list').action((opts) => configListCommand(process.cwd(), { json: opts.parent.json }))
  );
```

或使用 `.command('config get <key>')` 等单层结构，由 Commander 解析。

---

## 4. 实现阶段（Phases）

### Phase 1: ConfigCommand 骨架与 bin 注册

**目标**：新建 `src/commands/config.js`，实现 configCommand 入口及 get/set/list 子命令逻辑；bin 注册 config。

**实现要点**：
1. config.js 导出 `configGetCommand`、`configSetCommand`、`configListCommand` 或统一 `configCommand` 根据子命令分发
2. require ConfigManager（get、set、list、getProjectConfigPath）
3. bin/bmad-speckit.js 添加 .command('config')，子命令 get/set/list，选项 --global、--json

**产出**：`src/commands/config.js`、bin 修改

### Phase 2: get 与 list

**目标**：实现 get、list 子命令；key 不存在时 exit 1；支持 --json。

**实现要点**：
1. get：ConfigManager.get(key, { cwd })；undefined → stderr「不存在」或等价，exit 1；--json 时 JSON 对象，否则纯值
2. list：ConfigManager.list({ cwd })；--json 时 JSON.stringify，否则每行 `key: value`
3. networkTimeoutMs 默认 30000 由 ConfigManager 处理

**产出**：config.js get、list 分支

### Phase 3: set 与作用域规则

**目标**：实现 set 子命令；已 init 判定；--global 强制全局。

**实现要点**：
1. 已 init：`fs.existsSync(getProjectConfigPath(cwd))`
2. 已 init 且无 --global：ConfigManager.set(key, value, { scope: 'project', cwd })
3. 未 init 或有 --global：ConfigManager.set(key, value, { scope: 'global' })
4. networkTimeoutMs 的 value 解析为 Number(value)
5. set 后 exit 0（可 stdout 确认或静默）

**产出**：config.js set 分支

### Phase 4: 测试与回归

**目标**：单元/集成测试覆盖 get/set/list、项目级/全局/--global/--json；已 init 判定；回归 init、check、upgrade。

**实现要点**：
1. 测试：mock 或临时目录；config get 存在/不存在；config set 项目级/全局/--global；config list 合并/--json
2. 回归：init、check、upgrade 不受影响；ConfigManager 调用正确

**产出**：tests/config*.test.js 或集成到现有测试

---

## 5. 测试计划

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| 单元/集成 | config get 存在 key → stdout 值、exit 0 | 断言 stdout、exitCode |
| 单元/集成 | config get 不存在 key → stderr 含「不存在」、exit 1 | 断言 stderr、exitCode |
| 单元/集成 | config get networkTimeoutMs 默认 → 30000 | 断言 stdout |
| 单元/集成 | config get --json → 合法 JSON | 断言 stdout 可 JSON.parse |
| 集成 | config set 已 init 目录 → 写入项目级 bmad-speckit.json | 检查文件内容 |
| 集成 | config set 未 init 目录 → 写入全局 ~/.bmad-speckit/config.json | 检查全局文件 |
| 集成 | config set --global 已 init → 写入全局，不写入项目级 | 检查两处文件 |
| 集成 | config set networkTimeoutMs 60000 → 数值写入 | 检查 JSON 中为 number |
| 集成 | config set 更新单 key 时保留其他 key（AC-2#5 合并已有配置） | 项目级已含 selectedAI 时 set defaultAI；检查 selectedAI 仍存在 |
| 集成 | config list 合并视图、--json | 断言输出格式 |
| 回归 | init、check、upgrade 不受 config 影响 | 现有测试通过 |

---

## 6. 与 ConfigManager 的集成验证

**生产代码关键路径**：bin/bmad-speckit.js 注册 config → 用户执行 `bmad-speckit config get defaultAI` → config.js 被调用 → ConfigManager.get 被调用。测试计划必须验证：
1. config 子命令在 bin 中注册且可执行
2. config get/set/list 调用 ConfigManager 的正确方法（get、set、list）
3. 写入目标（项目级/全局）与已 init 判定一致

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_plan-E13-S4.md
