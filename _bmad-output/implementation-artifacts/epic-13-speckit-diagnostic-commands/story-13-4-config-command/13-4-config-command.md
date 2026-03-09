# Story 13.4: config 子命令

Status: placeholder（推迟闭环）

## Story

**As a** 已 init 项目的用户，  
**I want to** 通过 `bmad-speckit config` 子命令 get/set/list 配置项，支持 --global 与 --json，且在已 init 目录内默认写项目级、否则全局，  
**so that** 可查看与修改 defaultAI、defaultScript、templateSource、networkTimeoutMs 等配置。

## 本 Story 范围

- **config 子命令**：get、set、list 子命令，调用 Story 10.4 的 ConfigManager 实现读写。
- **--global**：写操作可指定写入全局配置（~/.bmad-speckit/config.json）。
- **--json**：输出支持 --json 格式。
- **作用域规则**：在已 init 目录内默认写项目级，否则写全局；--global 时强制写全局。
- **支持的 key**：defaultAI、defaultScript、templateSource、networkTimeoutMs 等（与 ConfigManager 一致）。

## 非本 Story 范围

- ConfigManager 模块实现：Story 10.4。
- check、version、upgrade、feedback：Story 13.1、13.3、13.5。

## Acceptance Criteria（简要）

| # | 验收标准 |
|---|----------|
| 1 | `config get <key>`、`config set <key> <value>`、`config list` 可用，读写通过 ConfigManager |
| 2 | 已 init 目录内执行时，set 默认写入项目级配置；未在已 init 目录内时默认写全局 |
| 3 | --global 时 set 强制写入全局配置 |
| 4 | 支持 --json 输出（list/get） |
| 5 | 支持的 key 含 defaultAI、defaultScript、templateSource、networkTimeoutMs |

## References

- [Epics 13.4](_bmad-output/planning-artifacts/dev/epics.md)：config：get/set/list、项目级优先、--global、defaultAI/defaultScript/templateSource/networkTimeoutMs、--json 输出。
- [Story 10.4]：ConfigManager 由 10.4 实现，本 Story 仅实现 CLI 层（config 子命令）并调用 ConfigManager。
