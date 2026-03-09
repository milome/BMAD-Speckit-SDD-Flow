# IMPLEMENTATION_GAPS E12-S3: Skill 发布

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.3 - Skill 发布  
**输入**: plan-E12-S3.md, spec-E12-S3.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `src/services/`：存在 sync-service.js、ai-registry.js、config-manager.js、template-fetcher.js；**无 skill-publisher.js**
- `init.js`：runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 调用 SyncService.syncCommandsRulesConfig、writeSelectedAI；**无 SkillPublisher 调用**；**无 --no-ai-skills 解析**；**无 subagentSupport 提示**
- `init-skeleton.js`：writeSelectedAI 仅写入 initLog.timestamp；**无 skillsPublished、skippedReasons**
- `check.js`：validateSelectedAITargets、bmadPath 验证；**无「子代理支持等级」段**；**无 subagentSupport 为 none/limited 时提示**
- `bin/bmad-speckit.js`：**无 --ai-skills、--no-ai-skills 选项注册**

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1 | GAP-1.1 | SkillPublisher.publish(projectRoot, selectedAI, options) | 未实现 | 无 skill-publisher.js 模块 |
| spec §3.2 | GAP-1.2 | 按 configTemplate.skillsDir 映射，禁止写死 .cursor/skills；~ 展开 | 未实现 | 无 skills 同步逻辑 |
| spec §3.3 | GAP-1.3 | 递归复制全部子目录、目标不存在时创建、无 skillsDir 时 skippedReasons、noAiSkills 跳过 | 未实现 | 无 SkillPublisher |
| spec §3.4 | GAP-1.4 | bmadPath 存在时从 bmadPath/skills 读源；否则从 projectRoot/_bmad/skills | 未实现 | 无 SkillPublisher |
| spec §4 | GAP-2.1 | initLog 含 skillsPublished、skippedReasons | 部分实现 | writeSelectedAI 仅 timestamp，无 skillsPublished、skippedReasons |
| spec §5 | GAP-2.2 | --ai-skills 默认执行、--no-ai-skills 跳过 | 未实现 | Commander 无该选项；init 未解析 |
| plan Phase 2 | GAP-2.3 | init 流程 SyncService 完成后调用 SkillPublisher，将返回值传入 writeSelectedAI | 未实现 | init 未调用 SkillPublisher |
| spec §6、plan Phase 3 | GAP-3.1 | init 完成时 subagentSupport 为 none/limited 则 stdout 输出提示 | 未实现 | init 无该逻辑 |
| spec §6 | GAP-3.2 | check 输出「子代理支持等级」段；none/limited 时输出提示 | 未实现 | check 无该输出 |
| plan Phase 2 | GAP-3.3 | Commander 注册 --ai-skills、--no-ai-skills | 未实现 | bin/bmad-speckit.js 无该选项 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **SkillPublisher** | GAP-1.1–1.4 | skill-publisher.js 新建，按 configTemplate.skillsDir 同步、bmadPath 源、~ 展开 |
| **Init 集成与 initLog** | GAP-2.1, GAP-2.2, GAP-2.3 | init 调用 SkillPublisher；writeSelectedAI 扩展；--no-ai-skills |
| **子代理提示** | GAP-3.1, GAP-3.2 | init/check 输出 subagentSupport 提示 |
| **CLI 选项** | GAP-3.3 | Commander 注册 --ai-skills、--no-ai-skills |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|-------------|----------|------|
| Phase 1 | GAP-1.1–1.4 | SkillPublisher 实现 |
| Phase 2 | GAP-2.1, GAP-2.2, GAP-2.3, GAP-3.3 | InitCommand 集成、initLog 扩展、Commander 选项 |
| Phase 3 | GAP-3.1, GAP-3.2 | init/check 子代理提示 |

---

## 5. 实施顺序建议

1. Phase 1：新建 skill-publisher.js，实现 publish
2. Phase 2：Commander 注册 --ai-skills/--no-ai-skills；init 调用 SkillPublisher；扩展 writeSelectedAI 接收并写入 skillsPublished、skippedReasons
3. Phase 3：init 完成时、check 输出时增加 subagentSupport 提示

<!-- AUDIT: PASSED by code-reviewer -->
