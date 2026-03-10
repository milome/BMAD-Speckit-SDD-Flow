# Story 13.3: upgrade 子命令

Status: ready-for-dev

<!-- 验证：运行 validate-create-story 进行质量检查后再执行 dev-story。 -->

## Story

**As a** 团队 Tech Lead，  
**I want** 在已 init 的项目目录内运行 `upgrade` 更新模板版本，支持 `--dry-run`（仅检查不执行）、`--template <tag>`（指定目标版本），且更新后 `templateVersion` 正确写入配置，  
**so that** 我能获取最新模板而不破坏已有配置。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.5 | upgrade 子命令：检查并拉取模板最新版本，更新项目内 _bmad 与 _bmad-output 结构；支持 --dry-run、--template；须在已 init 目录内执行 |
| PRD | US-10 | upgrade 须在已 init 目录内执行，否则报错；--dry-run 仅检查不执行；--template 指定目标版本并执行更新；更新后 templateVersion 正确反映新版本 |
| ARCH | §3.2 | UpgradeCommand：拉取最新模板、更新项目内 _bmad；支持 --dry-run、--template |
| Epics | 13.3 | upgrade：已 init 目录内执行、--dry-run、--template、templateVersion 更新 |

## 本 Story 范围

- **upgrade 子命令**：在已 init 项目目录内执行；未 init 时报错退出。
- **--dry-run**：仅检查并输出可升级版本信息，不执行任何文件写入或覆盖。
- **--template \<tag\>**：指定目标版本（如 `latest`、`v1.0.0`），拉取该版本模板并执行更新；未传时默认使用 `latest`。
- **--offline**：仅使用本地 cache，不发起网络请求；与 Story 11.2、init 行为一致；cache 缺失时退出码 5。
- **templateVersion 更新**：升级完成后将 `_bmad-output/config/bmad-speckit.json` 的 `templateVersion` 更新为实际使用的版本。
- **worktree 共享模式（bmadPath）**：当 `bmad-speckit.json` 含 `bmadPath` 时，项目内无本地 `_bmad`；upgrade 仅更新 `templateVersion` 至目标版本，不覆盖外部共享 `_bmad`（共享 _bmad 由用户或维护方另行升级）。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 退出码 2（--ai 无效）、3（网络/模板）、4（路径不可用）、5（离线 cache 缺失） | Story 13.2、Story 11.2 | 本 Story 复用 Story 13.2 约定的退出码与错误提示格式；网络拉取失败退出码 3；调用 TemplateFetcher 时传入 `networkTimeoutMs`（从配置链解析，Story 13.2 GAP-1.2 约定）。 |
| 模板拉取、cache、--offline | Story 11.1、11.2 | 由 Story 11.1 负责 TemplateFetcher；本 Story 调用 `fetchTemplate` 拉取模板，支持 `--offline` 复用 cache；`--offline` 且 cache 缺失时退出码 5 由 Story 11.2 约定。 |
| config 子命令 get/set/list | Story 13.4 | 由 Story 13.4 负责。 |
| check、version、feedback | Story 13.1、13.5 | 由 Story 13.1、13.5 负责。 |

## Acceptance Criteria

### AC-1: 须在已 init 目录内执行

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 未 init 目录 | 当前目录不存在 `_bmad-output/config/bmad-speckit.json` | 执行 `upgrade` | 退出码 1；stderr 输出明确错误信息（含「未 init」或等价表述），提示用户先执行 `init` |

### AC-2: --dry-run

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 检查可升级版本 | 已 init 目录，当前 templateVersion 为 v1.0.0 | 执行 `upgrade --dry-run` | 输出可升级到的版本信息（如 latest 对应的 tag 或当前版本 vs 最新版本）；不写入任何文件、不覆盖 _bmad；退出码 0 |
| 2 | 指定目标版本检查 | 已 init 目录 | 执行 `upgrade --dry-run --template v1.2.0` | 输出目标版本 v1.2.0 的信息；不执行更新；退出码 0 |

### AC-3: --template 与执行更新

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 默认 latest | 已 init 目录（无 bmadPath） | 执行 `upgrade` 或 `upgrade --template latest` | 拉取 latest 模板，覆盖项目内 `_bmad`（含 `core/`、`cursor/`、`speckit/`、`skills/` 等），按需更新 `_bmad-output` 中来自模板的结构；退出码 0 |
| 2 | 指定 tag | 已 init 目录（无 bmadPath） | 执行 `upgrade --template v1.2.0` | 拉取 v1.2.0 模板，覆盖 `_bmad`；退出码 0 |
| 3 | 拉取失败 | 网络超时或 404 | 执行 `upgrade` | 退出码 3；stderr 输出含「网络超时」或等价表述，建议 `--offline` 或检查网络 |

### AC-4: templateVersion 更新

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 更新后持久化 | upgrade 成功完成（无 bmadPath） | 检查 `_bmad-output/config/bmad-speckit.json` | `templateVersion` 字段已更新为实际使用的版本（如 `latest` 解析后的 tag 或 `v1.2.0`） |
| 2 | worktree 模式 | `bmad-speckit.json` 含 `bmadPath` | 执行 `upgrade` | 仅更新 `templateVersion` 至目标版本；不覆盖 `bmadPath` 指向的外部 `_bmad`；退出码 0 |
| 3 | 已有配置合并 | `bmad-speckit.json` 已含 defaultAI、networkTimeoutMs 等 | upgrade 成功完成 | 仅更新 `templateVersion`，不覆盖其他字段（与 Story 11.2 已有配置合并语义一致） |

### AC-5: 网络超时与配置链

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 传入 networkTimeoutMs | upgrade 调用 TemplateFetcher | 发起网络请求 | 传入从配置链解析的 `networkTimeoutMs`（SDD_NETWORK_TIMEOUT_MS > 项目级 > 全局 > 默认 30000），满足 Story 13.2 对 upgrade 的约定 |

## Tasks / Subtasks

- [ ] **Task 1**：实现 UpgradeCommand 骨架与已 init 校验（AC-1）
  - [ ] 1.1 新增 `src/commands/upgrade.js`，实现 `upgradeCommand(cwd, options)`；支持 `dryRun`、`template` 参数
  - [ ] 1.2 在 `bin/bmad-speckit.js` 注册 `upgrade` 子命令，添加 `--dry-run`、`--template <tag>`、`--offline` 选项
  - [ ] 1.3 校验已 init：读取 `_bmad-output/config/bmad-speckit.json`，不存在则输出错误并退出码 1

- [ ] **Task 2**：实现 --dry-run（AC-2）
  - [ ] 2.1 当 `dryRun` 为 true 时，调用 TemplateFetcher 获取目标版本信息（或拉取到 cache 仅读取版本）；输出可升级版本信息至 stdout
  - [ ] 2.2 不执行任何文件写入或 _bmad 覆盖；退出码 0

- [ ] **Task 3**：实现 --template 与模板拉取（AC-3、AC-5）
  - [ ] 3.1 解析 `--template`：未传时使用 `latest`；传入 tag 时使用该 tag
  - [ ] 3.2 调用 `fetchTemplate(tag, opts)`，传入 `networkTimeoutMs`（从 `resolveNetworkTimeoutMs({ cwd })` 或 ConfigManager 获取）、`templateSource`、`offline`（对应 --offline）
  - [ ] 3.3 拉取失败时输出错误，退出码 3；复用 Story 13.2 错误提示格式

- [ ] **Task 4**：实现 _bmad 覆盖与 templateVersion 更新（AC-4）
  - [ ] 4.1 无 bmadPath：使用 `generateSkeleton` 或等价逻辑，将拉取到的模板解压根目录内容覆盖项目内 `_bmad`；按需更新 `_bmad-output` 中来自模板的子结构
  - [ ] 4.2 有 bmadPath（worktree 共享）：不覆盖外部 `_bmad`；仅调用 ConfigManager 或 writeSelectedAI 等价逻辑，更新 `bmad-speckit.json` 的 `templateVersion` 至目标版本
  - [ ] 4.3 已有配置合并：读取现有 `bmad-speckit.json`，仅更新 `templateVersion` 字段，保留 defaultAI、networkTimeoutMs 等其他字段

- [ ] **Task 5**：测试与验收
  - [ ] 5.1 单元/集成测试：未 init 目录执行 upgrade → 退出码 1；已 init 目录 upgrade --dry-run → 退出码 0、无文件变更；upgrade --template latest → _bmad 更新、templateVersion 更新
  - [ ] 5.2 worktree 模式测试：bmadPath 存在时 upgrade 仅更新 templateVersion

## Dev Notes

### 架构与依赖

- **UpgradeCommand**：ARCH §3.2 定义；拉取最新模板、更新项目内 _bmad；支持 --dry-run、--template。
- **依赖 E11.1**：TemplateFetcher（`fetchTemplate`、`fetchFromGitHub`）已实现；本 Story 复用拉取与 cache 逻辑。
- **generateSkeleton**：init.js 中 `generateSkeleton(finalPath, templateDir, modules, options.force)` 可用于将模板解压根目录写入目标；upgrade 可复用或抽取共用函数，覆盖 `_bmad`。
- **writeSelectedAI / ConfigManager.setAll**：Story 11.2 中 init 使用 writeSelectedAI 写入 templateVersion；upgrade 可调用 ConfigManager 的 set 或 setAll 仅更新 templateVersion。

### 网络超时（Story 13.2 约定）

- Story 13.2 GAP-1.2 约定：upgrade 调用 TemplateFetcher 时须传入 `networkTimeoutMs`。
- 实现：通过 `resolveNetworkTimeoutMs({ cwd })`（`utils/network-timeout.js`）或 ConfigManager 获取，与 init 一致。

### 退出码

| 场景 | 退出码 | 依据 |
|------|--------|------|
| 成功 | 0 | PRD §5.2 |
| 未 init、未分类异常 | 1 | Story 13.2 AC-1 |
| 网络超时、拉取失败 | 3 | Story 13.2 AC-3 |
| --offline 且 cache 缺失 | 5 | Story 11.2 |

### Project Structure Notes

- **UpgradeCommand**：`packages/bmad-speckit/src/commands/upgrade.js`（新建）
- **bin 注册**：`packages/bmad-speckit/bin/bmad-speckit.js` 已预留 upgrade 描述，需添加 `.command('upgrade')` 及 `action(upgradeCommand)`
- **TemplateFetcher**：`src/services/template-fetcher.js`；`fetchTemplate(tag, opts)` 支持 tag、networkTimeoutMs、templateSource、offline

### References

- [Source: _bmad-output/planning-artifacts/dev/epics.md Epic 13、Story 13.3]
- [Source: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md §5.5、US-10]
- [Source: _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md §3.2 UpgradeCommand]
- [Source: _bmad-output/implementation-artifacts/epic-11-speckit-template-offline/story-11-1-template-fetch/11-1-template-fetch.md TemplateFetcher]
- [Source: _bmad-output/implementation-artifacts/epic-13-speckit-diagnostic-commands/story-13-2-exception-paths/13-2-exception-paths.md 退出码、networkTimeoutMs]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
