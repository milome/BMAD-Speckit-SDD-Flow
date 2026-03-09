# Spec E12-S3: Skill 发布

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.3 - Skill 发布  
**输入**: 12-3-skill-publish.md, PRD §5.10/§5.12/§5.12.1, ARCH SkillPublisher

---

## 1. 概述

本 spec 定义 Story 12.3（Skill 发布）的技术规格，覆盖：

- **SkillPublisher 模块**：从 `_bmad/skills/`（或 worktree 共享模式下 `bmadPath` 指向目录的 `skills/`）按所选 AI 的 configTemplate.skillsDir 同步到对应全局目录；目标路径支持 `~` 展开；目标目录不存在时自动创建
- **initLog 扩展**：`skillsPublished` 含已发布 skill 名称列表；`skippedReasons` 在 AI 不支持 skill、用户指定 `--no-ai-skills` 时记录
- **--ai-skills / --no-ai-skills**：默认执行 skill 发布；`--no-ai-skills` 时跳过并记录 skippedReasons
- **无子代理支持 AI 提示**：configTemplate.subagentSupport 为 `none` 或 `limited` 时，init 完成、check 输出含子代理支持等级及全流程兼容性提示

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| PRD §5.10 | skills 从 _bmad/skills/ 发布到 configTemplate.skillsDir | §3.1, §3.2, §3.3 | ✅ |
| PRD §5.10 | worktree 共享：bmadPath 记录，skills 源从 bmadPath 读取 | §3.4 | ✅ |
| PRD §5.12 | 发布目标映射：cursor-agent→~/.cursor/skills、claude→~/.claude/skills 等 | §3.2 | ✅ |
| PRD §5.12 | initLog：timestamp、selectedAI、templateVersion、skillsPublished、skippedReasons | §4 | ✅ |
| PRD §5.12 | 若 AI 不支持全局 skill，initLog skippedReasons 记录并跳过 | §4.2 | ✅ |
| PRD §5.2 表 | --ai-skills 默认执行、--no-ai-skills 跳过 | §5 | ✅ |
| PRD §5.12.1 | configTemplate 含 subagentSupport；无子代理时 init/check 提示 | §6 | ✅ |
| Story AC-1 | 有 skillsDir 的 AI、worktree 共享、目标目录不存在 | §3.2, §3.3, §3.4 | ✅ |
| Story AC-2 | skillsPublished、skippedReasons、initLog 结构 | §4 | ✅ |
| Story AC-3 | 默认执行、显式启用、显式跳过 | §5 | ✅ |
| Story AC-4 | init/check 时无子代理 AI 的 stdout 提示 | §6 | ✅ |
| Story AC-5 | 发布内容、按 configTemplate 禁止写死 .cursor/skills | §3.2 | ✅ |
| ARCH | SkillPublisher：按 configTemplate.skillsDir 同步、initLog | §3, §4 | ✅ |

---

## 3. SkillPublisher 同步逻辑

### 3.1 模块职责与接口

| 方法 | 签名 | 说明 |
|------|------|------|
| publish | `publish(projectRoot, selectedAI, options)` | 按 configTemplate.skillsDir 将 skills 源同步到全局目录；options 含 `bmadPath?: string`、`noAiSkills?: boolean`；返回 `{ published: string[], skippedReasons: string[] }` |

**实现位置**：`packages/bmad-speckit/src/services/skill-publisher.js`（新建）

### 3.2 同步映射规则（禁止写死 .cursor/skills）

| configTemplate 字段 | 目标路径 | 示例 |
|---------------------|----------|------|
| skillsDir | 全局或项目内 skills 目录 | cursor-agent→`~/.cursor/skills`、claude→`~/.claude/skills` |
| 无 skillsDir 或空 | 不执行同步，返回 skippedReasons | copilot、codex 等无 skillsDir |

**约束**：skillsDir 若含 `~`，须展开为实际用户主目录（os.homedir()）；禁止硬编码 `.cursor/skills` 或其他单一 AI 目录。

### 3.3 同步行为

| 场景 | 行为 |
|------|------|
| configTemplate.skillsDir 存在且非空 | 递归复制 skills 源下全部子目录到目标，保持目录结构（如 speckit-workflow、bmad-bug-assistant） |
| 目标目录不存在 | 使用 fs.mkdirSync(dest, { recursive: true }) 创建目标及必要父目录，再执行复制 |
| configTemplate 无 skillsDir 或 skillsDir 为空 | 不执行复制，返回 skippedReasons 含「该 AI 不支持全局 skill」 |
| options.noAiSkills 为 true | 不执行复制，返回 skippedReasons 含「用户指定 --no-ai-skills 跳过」 |
| 源目录不存在或为空 | 返回 published 为空数组，不抛错 |

### 3.4 同步源路径（worktree vs 默认）

| 场景 | 源根路径 |
|------|----------|
| options.bmadPath 存在 | `path.join(path.resolve(projectRoot, bmadPath), 'skills')`；`path.resolve(projectRoot, bmadPath)` 对相对路径以 projectRoot 为基准、对绝对路径返回 bmadPath 本身 |
| 否则 | `path.join(projectRoot, '_bmad', 'skills')` |

---

## 4. initLog 扩展

### 4.1 结构定义

initLog 写入 `_bmad-output/config/bmad-speckit.json`，与 Story 10.4 基础结构兼容，本 Story 扩展：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timestamp | string | 是 | ISO 8601 格式 |
| selectedAI | string | 是 | 所选 AI 的 id |
| templateVersion | string | 是 | 模板版本 |
| skillsPublished | string[] | 是 | 已发布 skill 名称列表（如 `["speckit-workflow","bmad-bug-assistant"]`）；无发布时为空数组 |
| skippedReasons | string[] | 条件 | 存在跳过时记录；成功无跳过时可省略 |

### 4.2 skippedReasons 取值

| 场景 | skippedReasons 条目 |
|------|---------------------|
| AI 无 skillsDir 或 skillsDir 为空 | 「该 AI 不支持全局 skill」或等价描述 |
| 用户指定 --no-ai-skills | 「用户指定 --no-ai-skills 跳过」或等价描述 |
| 成功发布 | 不写入 skippedReasons 或空数组 |

---

## 5. --ai-skills 与 --no-ai-skills

| 场景 | 行为 |
|------|------|
| 未传 --no-ai-skills | 执行 skill 发布（默认）；initLog 含 skillsPublished 或 skippedReasons |
| 传 --ai-skills | 执行 skill 发布（与默认一致） |
| 传 --no-ai-skills | 不执行 skill 发布；initLog 中 skillsPublished 为空数组或省略；skippedReasons 含「用户指定 --no-ai-skills 跳过」 |

**实现**：init 解析 options.noAiSkills 或 options['no-ai-skills']；为 true 时调用 SkillPublisher.publish 传入 noAiSkills: true，或直接跳过调用并写入 skippedReasons。

---

## 6. 无子代理支持 AI 的 init/check 提示

### 6.1 判定规则

从 AIRegistry.getById(selectedAI) 获取 configTemplate.subagentSupport；若为 `none` 或 `limited`，则视为无子代理或仅部分支持。

### 6.2 init 提示

在 init 完成、输出 post-init 引导前，若 subagentSupport 为 `none` 或 `limited`，stdout 输出：

> 所选 AI 不支持或仅部分支持子代理，BMAD/Speckit 全流程（party-mode、code-reviewer、mcp_task 等）可能无法正常运行；建议使用支持子代理的 AI（如 cursor-agent、claude）

### 6.3 check 提示

`check` 输出中增加「子代理支持等级」段；当 selectedAI 对应 subagentSupport 为 `none` 或 `limited` 时，输出与 init 一致的提示文本。

---

## 7. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| configTemplate 含 skillsDir、subagentSupport | Story 12.1 | 本 Story 消费 AIRegistry |
| commands/rules/config 同步 | Story 12.2 | SyncService 已实现 |
| check 按 selectedAI 验证目标目录 | Story 12.2 | 本 Story 仅增加子代理提示输出 |

---

## 8. 跨平台与实现约束

- **路径**：使用 `path.join`、`path.resolve`；`~` 使用 `os.homedir()` 展开
- **依赖**：AIRegistry（Story 12.1）、ConfigManager、fs、path、os

---

## 9. 术语

| 术语 | 定义 |
|------|------|
| skillsDir | configTemplate 中全局 skills 目标路径，如 `~/.cursor/skills` |
| skillsPublished | initLog 中已成功发布的 skill 名称列表 |
| skippedReasons | initLog 中跳过 skill 发布的原因列表 |
| subagentSupport | configTemplate 子代理支持等级：native | mcp | limited | none |

<!-- AUDIT: PASSED by code-reviewer -->
