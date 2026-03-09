# Spec E13-S4: config 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.4 - config 子命令  
**原始需求文档**: 13-4-config.md

---

## 1. 概述

本 spec 定义 config 子命令的 CLI 层实现：在已 init 项目内或任意目录执行 `bmad-speckit config get <key>`、`bmad-speckit config set <key> <value>`、`bmad-speckit config list`，支持项目级优先、`--global`（仅 set）、`--json` 输出。本 Story 实现 CLI 层并调用 Story 10.4 的 ConfigManager；ConfigManager 模块本身由 Story 10.4 负责，本 Story 不修改。

---

## 2. 功能范围

### 2.1 本 Story 范围

| 功能点 | 描述 | 边界条件 |
|--------|------|----------|
| config get \<key\> | 按 key 读取配置值；项目级优先于全局 | 调用 ConfigManager.get(key, { cwd })；key 不存在时 stderr 含「不存在」或等价，退出码 1；networkTimeoutMs 均无时输出 30000 |
| config set \<key\> \<value\> | 按作用域写入配置 | 已 init 目录且无 --global：写入项目级；未 init 或有 --global：写入全局；networkTimeoutMs 解析为 Number |
| config list | 输出合并后的键值对 | 调用 ConfigManager.list({ cwd })；可读格式或 --json |
| --global | 仅对 set 有效 | set 时强制写入全局配置；get、list 始终按配置链合并 |
| --json | get、list 支持 | stdout 输出合法 JSON |
| 支持 key | defaultAI、defaultScript、templateSource、templateVersion、networkTimeoutMs | 与 ConfigManager 及 Story 10.4 一致 |

### 2.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| ConfigManager 模块（get/set/setAll/list、路径解析、优先级） | Story 10.4 | 本 Story 仅调用 ConfigManager |
| check、version、upgrade、feedback | Story 13.1、13.3、13.5 | - |
| 退出码 2/3/4/5 | Story 13.2、11.2 | config 子命令无上述场景时退出码 0/1 |

---

## 3. 验收标准（AC）技术规格

### AC-1: config get \<key\>

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 读取单 key | 项目级或全局配置含 defaultAI | 执行 `config get defaultAI` | stdout 输出该 key 的值；退出码 0 |
| key 不存在 | 全局与项目级均无该 key | 执行 `config get unknownKey` | stderr 含「不存在」或等价；退出码 1 |
| networkTimeoutMs 默认 | 全局与项目级均无 networkTimeoutMs | 执行 `config get networkTimeoutMs` | stdout 输出 30000（ConfigManager 默认）；退出码 0 |
| --json 输出 | 项目级含 defaultAI | 执行 `config get defaultAI --json` | stdout 输出合法 JSON（如 `{"defaultAI":"cursor-agent"}` 或 `{"key":"defaultAI","value":"cursor-agent"}`）；退出码 0 |

**实现要点**：调用 `ConfigManager.get(key, { cwd })`；key 不存在时 stderr 输出错误、exit 1；`--json` 时 JSON.stringify 输出对象。

### AC-2: config set \<key\> \<value\>

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 已 init 目录默认项目级 | 当前目录为已 init 项目根（存在 `_bmad-output/config/bmad-speckit.json`） | 执行 `config set defaultAI cursor-agent` | 写入项目级 bmad-speckit.json；退出码 0 |
| 未 init 目录写全局 | 当前目录非已 init 项目根 | 执行 `config set defaultAI cursor-agent` | 写入全局 `~/.bmad-speckit/config.json`；退出码 0 |
| --global 强制全局 | 当前目录为已 init 项目根 | 执行 `config set defaultAI cursor-agent --global` | 写入全局配置，不写入项目级；退出码 0 |
| networkTimeoutMs 数值 | 任意 | 执行 `config set networkTimeoutMs 60000` | 写入数值 60000（非字符串）；退出码 0 |
| 合并已有配置 | 项目级 bmad-speckit.json 已含 selectedAI | 执行 `config set defaultAI bob` | 仅更新 defaultAI，保留 selectedAI；退出码 0 |

**实现要点**：已 init 判定：`fs.existsSync(getProjectConfigPath(cwd))`；已 init 且无 --global → `ConfigManager.set(key, value, { scope: 'project', cwd })`；未 init 或有 --global → `ConfigManager.set(key, value, { scope: 'global' })`；networkTimeoutMs 的 value 解析为 Number。

### AC-3: config list

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 合并视图 | 全局与项目级均含配置 | 执行 `config list` | stdout 输出合并后的键值对（项目级覆盖全局）；可读格式；退出码 0 |
| --json 输出 | 同上 | 执行 `config list --json` | stdout 输出合法 JSON 对象；退出码 0 |
| 仅全局 | 无项目级文件 | 执行 `config list` | 输出全局配置的键值对；退出码 0 |

**实现要点**：调用 `ConfigManager.list({ cwd })`；无 --json 时人类可读（如 `key: value` 每行）；--json 时 JSON.stringify 输出对象。

### AC-4: 已 init 判定

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 已 init 判定 | 当前目录存在 `_bmad-output/config/bmad-speckit.json` | 执行 set 且未传 --global | 写入项目级 |
| 未 init 判定 | 当前目录不存在项目级 config | 执行 set | 写入全局 |

**实现要点**：与 check、upgrade 一致；项目级 config 路径为 `_bmad-output/config/bmad-speckit.json`；可复用 `ConfigManager.getProjectConfigPath(cwd)` 或等价。

---

## 4. 架构约束与依赖

### 4.1 ConfigManager 接口（Story 10.4）

| 接口 | 说明 |
|------|------|
| get(key, { cwd }) | 项目级优先于全局；networkTimeoutMs 均无时返回 30000 |
| set(key, value, { scope, cwd }) | scope: 'global' \| 'project'；project 时 cwd 必传；合并写入 |
| list({ cwd }) | 合并视图，项目级覆盖全局 |
| getProjectConfigPath(cwd) | 返回项目级配置路径，用于已 init 判定 |

### 4.2 实现位置

| 项 | 路径 |
|----|------|
| Config 命令 | `packages/bmad-speckit/src/commands/config.js`（新建） |
| bin 注册 | `packages/bmad-speckit/bin/bmad-speckit.js` 已有 config 描述（L21），需添加 .command('config') 及子命令 action |

### 4.3 子命令结构

使用 Commander 的 `.command('config')` 配合子命令：`config get <key>`、`config set <key> <value>`、`config list`；参考 version、upgrade 的注册方式。`--global`、`--json` 作为 config 层通用选项。

---

## 5. 退出码

| 场景 | 退出码 |
|------|--------|
| 成功 | 0 |
| key 不存在（get）、未分类异常 | 1 |

config 子命令无 Story 13.2 定义的退出码 2（--ai 无效）、3（网络/模板）、4（路径不可用）、5（离线 cache 缺失）场景。

---

## 6. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 陈述 | config get/set/list、项目级优先、--global、--json | §1 概述、§2.1、§3 | ✅ |
| 需求追溯 PRD US-11 | config 子命令：get/set/list 配置项 | §2.1、§3 AC-1～AC-4 | ✅ |
| 需求追溯 ARCH §3.2 ConfigCommand | VersionCommand、UpgradeCommand、ConfigCommand | §4.2 | ✅ |
| Epics 13.4 | config：get/set/list、项目级优先、--global、defaultAI/defaultScript/templateSource/networkTimeoutMs、--json | §2.1、§3 AC-1～AC-4 | ✅ |
| Story 10.4 依赖 | ConfigManager 由 Story 10.4 实现；本 Story 调用 ConfigManager | §4.1、§4.2 | ✅ |
| 本 Story 范围 | config 子命令、作用域规则、--global、--json、支持 key | §2.1、§3 | ✅ |
| AC-1～AC-4 表 | 各 Scenario Given/When/Then | §3 对应 AC 节 | ✅ |
| 非本 Story 范围 | 10.4、13.1、13.2、13.3、13.5 职责 | §2.2 | ✅ |
| Dev Notes 架构约束 | ConfigManager 路径、已 init 判定、子命令结构 | §4 | ✅ |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_spec-E13-S4.md
