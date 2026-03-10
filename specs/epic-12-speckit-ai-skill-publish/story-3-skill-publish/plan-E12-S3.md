# Plan E12-S3: Skill 发布实现方案

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.3 - Skill 发布  
**输入**: spec-E12-S3.md, 12-3-skill-publish.md, PRD, ARCH

---

## 1. 概述

本 plan 定义 Story 12.3（Skill 发布）的实现方案：新建 SkillPublisher 按 configTemplate.skillsDir 将 `_bmad/skills/` 同步到所选 AI 全局目录；扩展 initLog 含 skillsPublished、skippedReasons；支持 --ai-skills/--no-ai-skills；init/check 在所选 AI 无子代理支持时输出提示。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| PRD §5.10 | spec §3 | Phase 1 | ✅ |
| PRD §5.12 | spec §3、§4 | Phase 1、Phase 2 | ✅ |
| PRD §5.12.1 | spec §6 | Phase 3 | ✅ |
| PRD §5.2 表 | spec §5 | Phase 2 | ✅ |
| ARCH SkillPublisher | spec §3、§4 | Phase 1、Phase 2 | ✅ |
| Story AC-1 | spec §3.2–3.4 | Phase 1、集成测试 | ✅ |
| Story AC-2 | spec §4 | Phase 2、单元/集成测试 | ✅ |
| Story AC-3 | spec §5 | Phase 2、集成测试 | ✅ |
| Story AC-4 | spec §6 | Phase 3、集成测试 | ✅ |
| Story AC-5 | spec §3.2 | Phase 1、集成测试 | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| SkillPublisher | `src/services/skill-publisher.js` | publish(projectRoot, selectedAI, options)；按 configTemplate.skillsDir 同步 skills；返回 { published, skippedReasons } |
| InitCommand | `src/commands/init.js` | 在 SyncService.syncCommandsRulesConfig 之后、writeSelectedAI 之前调用 SkillPublisher（按 --no-ai-skills 决定）；传入 bmadPath、noAiSkills；将 publish 返回值写入 initLog |
| init-skeleton | `src/commands/init-skeleton.js` | writeSelectedAI 扩展 initLog 结构：skillsPublished、skippedReasons（由 init 传入或 SkillPublisher 返回值） |
| CheckCommand | `src/commands/check.js` | 增加「子代理支持等级」段；subagentSupport 为 none/limited 时输出提示 |

### 3.2 数据流

```
init 流程:
  SyncService.syncCommandsRulesConfig(...)
       ↓
  SkillPublisher.publish(projectRoot, selectedAI, { bmadPath, noAiSkills })
       ↓ 从 AIRegistry.getById 获取 configTemplate
       ↓ 源：bmadPath/skills 或 projectRoot/_bmad/skills
       ↓ 目标：configTemplate.skillsDir（~ 展开）
       ↓ 返回 { published: string[], skippedReasons: string[] }
       ↓
  writeSelectedAI(..., initLogExt: { skillsPublished, skippedReasons })
       ↓
  initLog 含 skillsPublished、skippedReasons
       ↓
  若 subagentSupport 为 none/limited：stdout 输出子代理提示
       ↓
  post-init 引导

check 流程:
  读取 bmad-speckit.json (selectedAI)
       ↓
  从 AIRegistry 获取 configTemplate.subagentSupport
       ↓
  输出「子代理支持等级」
       ↓
  若 subagentSupport 为 none/limited：输出提示文本
```

### 3.3 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| **SkillPublisher 单元测试** | 空目录、单目录、多级目录；目标不存在；configTemplate 无 skillsDir；noAiSkills 跳过；bmadPath 源切换；~ 展开 | 断言 published、skippedReasons、目标目录存在 |
| **集成测试** | init --ai cursor-agent --yes 后 ~/.cursor/skills/ 含 speckit-workflow、bmad-bug-assistant；initLog.skillsPublished 正确 | 执行 init，检查目标目录、bmad-speckit.json |
| **集成测试** | init --ai cursor-agent --yes --no-ai-skills 后 skills 未同步，initLog.skippedReasons 含对应说明 | 同上 |
| **集成测试** | init --ai copilot --yes（无 skillsDir）后 initLog.skippedReasons 含「AI 不支持全局 skill」 | 同上 |
| **集成测试** | init --bmad-path <path> --ai cursor-agent --yes 后 skills 从 bmadPath/skills 正确同步 | 同上 |
| **集成测试** | init --ai tabnine --yes 后 stdout 含子代理提示 | 断言 stdout 含提示文本 |
| **集成测试** | check 在 selectedAI 为 tabnine 时输出子代理支持等级及提示 | 执行 check，断言输出 |
| **端到端** | 完整 init→check 流程，skill 发布、initLog、子代理提示 | 覆盖至少 2 种 selectedAI（有 skillsDir、无 skillsDir） |

---

## 4. 实现阶段（Phases）

### Phase 1: SkillPublisher 实现

**目标**：新建 `src/services/skill-publisher.js`，实现 publish。

**实现要点**：
1. 从 AIRegistry.getById(selectedAI, { cwd: projectRoot }) 获取 configTemplate
2. 若 options.noAiSkills 为 true：返回 { published: [], skippedReasons: ['用户指定 --no-ai-skills 跳过'] }
3. 若 configTemplate 无 skillsDir 或 skillsDir 为空：返回 { published: [], skippedReasons: ['该 AI 不支持全局 skill'] }
4. 解析源：options.bmadPath 存在则 `path.join(path.resolve(projectRoot, bmadPath), 'skills')`，否则 `path.join(projectRoot, '_bmad', 'skills')`
5. 解析目标：configTemplate.skillsDir 若含 `~`，用 `os.homedir()` 展开
6. 目标不存在时 fs.mkdirSync(dest, { recursive: true })
7. 递归复制 skills 源下全部子目录到目标，保持目录结构；收集已复制目录名（如 speckit-workflow）为 published 列表
8. 源不存在或为空：返回 { published: [], skippedReasons: [] }，不抛错

**产出**：`src/services/skill-publisher.js`

### Phase 2: InitCommand 集成与 initLog 扩展

**目标**：init 流程调用 SkillPublisher；扩展 writeSelectedAI 写入 initLog。

**实现要点**：
1. 在 runNonInteractiveFlow、runWorktreeFlow、runInteractiveFlow 中，SyncService.syncCommandsRulesConfig 完成后、writeSelectedAI 之前，调用 SkillPublisher.publish
2. 解析 options.noAiSkills 或 options['no-ai-skills']（Commander 通常转为 camelCase）；为 true 时传入 noAiSkills: true 或直接跳过 SkillPublisher 调用，构造 skippedReasons
3. 将 publish 返回的 { published, skippedReasons } 传入 writeSelectedAI；或扩展 writeSelectedAI 签名接收 initLogExt
4. writeSelectedAI 或 ConfigManager.setAll 写入 initLog：timestamp、selectedAI、templateVersion、skillsPublished（来自 publish 或 []）、skippedReasons（存在时写入，否则可省略）
5. init 主流程需在 Commander 中注册 --ai-skills、--no-ai-skills（若尚未注册）

**产出**：修改 `init.js`、`init-skeleton.js`（或 ConfigManager 的 writeSelectedAI 等价逻辑）

### Phase 3: 无子代理支持 AI 的 init/check 提示

**目标**：init 完成、check 输出时，subagentSupport 为 none/limited 则输出提示。

**实现要点**：
1. 在 init 完成、输出 post-init 引导前：从 AIRegistry.getById(selectedAI) 获取 configTemplate.subagentSupport；若为 `none` 或 `limited`，console.log 或 console.warn 输出提示文本（含子代理支持等级及全流程兼容性说明）
2. 在 check 输出中：增加「子代理支持等级」段落；从 AIRegistry 获取 subagentSupport，输出该值；若为 none 或 limited，输出与 init 一致的提示文本
3. 提示文本：与 spec §6.2、§6.3 一致

**产出**：修改 `init.js`、`check.js`

---

## 5. 测试策略

| 层级 | 覆盖 |
|------|------|
| 单元 | SkillPublisher 各场景：空目录、单/多目录、目标不存在、无 skillsDir、noAiSkills、bmadPath、~ 展开 |
| 集成 | init + check 组合；各 selectedAI（cursor-agent、copilot、tabnine）；--no-ai-skills；--bmad-path |
| 端到端 | 完整用户流程：init → 验证 skills 目录、initLog → check 含子代理提示 |

---

## 6. 依赖与约束

- **依赖**：Story 12.1 AIRegistry、configTemplate 含 skillsDir、subagentSupport；Story 12.2 SyncService、init 流程
- **约束**：禁止写死 .cursor/skills；跨平台 path.join、os.homedir()；skillsDir 为全局路径时需 ~ 展开

<!-- AUDIT: PASSED by code-reviewer -->
