# Tasks E12-S3: Skill 发布

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.3 - Skill 发布  
**输入**: IMPLEMENTATION_GAPS-E12-S3.md, plan-E12-S3.md, spec-E12-S3.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.6 | Story 12-3, spec §3 | AC-1, AC-5 | SkillPublisher、configTemplate.skillsDir、bmadPath 源、~ 展开 |
| T2–T2.5 | Story 12-3, spec §4、§5, plan Phase 2 | AC-2, AC-3 | InitCommand 集成 SkillPublisher、initLog 扩展、--no-ai-skills |
| T3–T3.2 | Story 12-3, spec §6, plan Phase 3 | AC-4 | init/check 子代理支持提示 |
| T4–T4.4 | Story 12-3, plan §3.3 | AC-1–5 | 单元、集成、E2E 测试 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS-E12-S3.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §3 | GAP-1.1, 1.2, 1.3, 1.4 | ✓ | T1.1–T1.6 |
| spec §4、plan Phase 2 | GAP-2.1, 2.3 | ✓ | T2.1–T2.4 |
| spec §5、plan Phase 2 | GAP-2.2, GAP-3.3 | ✓ | T2.1, T2.5 |
| spec §6、plan Phase 3 | GAP-3.1, GAP-3.2 | ✓ | T3.1–T3.2 |

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

### T1: SkillPublisher 实现（AC-1, AC-5）

- [ ] **T1.1** 新建 `packages/bmad-speckit/src/services/skill-publisher.js`，实现 publish(projectRoot, selectedAI, options)
  - **验收**：函数存在且可调用；options 含 bmadPath（可选）、noAiSkills（可选）；返回 `{ published: string[], skippedReasons: string[] }`；**集成验证**：该模块被 init 关键路径调用，由 T4.3 覆盖
  - **生产代码**：skill-publisher.js、publish

- [ ] **T1.2** 从 AIRegistry.getById(selectedAI) 获取 configTemplate；bmadPath 存在时从 bmadPath/skills 读源，否则从 projectRoot/_bmad/skills
  - **验收**：源路径解析正确；bmadPath 优先级高于 _bmad；按 spec §3.4 path.resolve(projectRoot, bmadPath)
  - **生产代码**：skill-publisher.js 源路径逻辑
  - **单元测试**：skill-publisher 源路径切换

- [ ] **T1.3** 按 configTemplate.skillsDir 解析目标路径；skillsDir 含 `~` 时用 os.homedir() 展开；禁止硬编码 .cursor/skills
  - **验收**：cursor-agent→~/.cursor/skills、claude→~/.claude/skills 等正确解析
  - **生产代码**：skill-publisher.js 目标路径逻辑
  - **单元测试**：~ 展开、各 selectedAI 目标路径

- [ ] **T1.4** 递归复制 skills 源下全部子目录到目标，保持目录结构；目标目录不存在时 fs.mkdirSync(dest, { recursive: true })；收集已复制目录名为 published 列表
  - **验收**：speckit-workflow、bmad-bug-assistant 等子目录正确同步
  - **生产代码**：skill-publisher.js 复制逻辑
  - **单元测试**：空目录、单目录、多级目录、目标不存在

- [ ] **T1.5** configTemplate 无 skillsDir 或 skillsDir 为空时返回 skippedReasons 含「该 AI 不支持全局 skill」；options.noAiSkills 为 true 时返回 skippedReasons 含「用户指定 --no-ai-skills 跳过」
  - **验收**：copilot、codex 等无 skillsDir 时 skippedReasons 正确；noAiSkills 时跳过
  - **生产代码**：skill-publisher.js 条件逻辑
  - **单元测试**：无 skillsDir、noAiSkills 场景

- [ ] **T1.6** 源目录不存在或为空时返回 { published: [], skippedReasons: [] }，不抛错
  - **验收**：_bmad/skills 不存在时不报错
  - **生产代码**：skill-publisher.js 存在性检查
  - **单元测试**：缺失源目录跳过

### T2: InitCommand 集成与 initLog 扩展（AC-1, AC-2, AC-3）

- [ ] **T2.1** 在 runNonInteractiveFlow、runWorktreeFlow、runInteractiveFlow 中，SyncService.syncCommandsRulesConfig 完成后、writeSelectedAI 之前调用 SkillPublisher.publish
  - **验收**：init 后目标 skills 目录存在且含预期子目录；**集成验证**：init 流程中 SkillPublisher 被调用，由 T4.3 覆盖
  - **生产代码**：init.js 调用 SkillPublisher
  - **集成测试**：init --ai cursor-agent --yes 后 ~/.cursor/skills 含 speckit-workflow 等

- [ ] **T2.2** 解析 options.noAiSkills 或 options['no-ai-skills']；为 true 时传入 noAiSkills: true 或直接跳过 SkillPublisher 调用，构造 skippedReasons 传入 writeSelectedAI
  - **验收**：init --no-ai-skills 后 skills 未同步，initLog.skippedReasons 含对应说明
  - **生产代码**：init.js 参数解析
  - **集成测试**：init --ai cursor-agent --yes --no-ai-skills

- [ ] **T2.3** 扩展 writeSelectedAI 签名接收 initLogExt（skillsPublished、skippedReasons）；将 publish 返回值传入 writeSelectedAI
  - **验收**：writeSelectedAI 可接收 initLogExt；initLog 含 skillsPublished、skippedReasons
  - **生产代码**：init-skeleton.js writeSelectedAI、init.js 传参
  - **集成测试**：init 后读取 bmad-speckit.json 验证 initLog 结构

- [ ] **T2.4** writeSelectedAI 或 ConfigManager.setAll 写入 initLog：timestamp、selectedAI、templateVersion、skillsPublished（来自 publish 或 []）、skippedReasons（存在时写入，否则可省略）
  - **验收**：initLog 结构符合 spec §4.1
  - **生产代码**：init-skeleton.js writeSelectedAI
  - **集成测试**：init 后 bmad-speckit.json 含完整 initLog

- [ ] **T2.5** 在 bin/bmad-speckit.js 中注册 --ai-skills、--no-ai-skills 选项，传入 init 流程
  - **验收**：bmad-speckit init --help 含 --ai-skills、--no-ai-skills；init --no-ai-skills 生效
  - **生产代码**：bin/bmad-speckit.js
  - **集成测试**：init --no-ai-skills 跳过 skill 发布

### T3: 无子代理支持 AI 的 init/check 提示（AC-4）

- [ ] **T3.1** 在 init 完成、输出 post-init 引导前，若 configTemplate.subagentSupport 为 `none` 或 `limited`，stdout 输出提示文本（含子代理支持等级及全流程兼容性说明）
  - **验收**：init --ai tabnine --yes 后 stdout 含提示
  - **生产代码**：init.js 三流程中 init 完成处
  - **集成测试**：init --ai tabnine --yes 断言 stdout

- [ ] **T3.2** 在 check 输出中增加「子代理支持等级」段；当 selectedAI 对应 subagentSupport 为 none 或 limited 时，输出与 init 一致的提示文本
  - **验收**：check 在 selectedAI 为 tabnine 时输出子代理等级及提示
  - **生产代码**：check.js
  - **集成测试**：init --ai tabnine 后 check 断言输出

### T4: 单元、集成、E2E 测试（AC-1–5）

- [ ] **T4.1** 单元测试：SkillPublisher 对空目录、单目录、多级目录、目标不存在、configTemplate 无 skillsDir、noAiSkills、bmadPath 源切换、~ 展开
  - **验收**：node --test 或 vitest 通过
  - **测试代码**：tests/skill-publisher.test.js

- [ ] **T4.2** 单元测试：publish 返回值 published、skippedReasons 正确性
  - **验收**：各场景返回值符合 spec
  - **测试代码**：tests/skill-publisher.test.js

- [ ] **T4.3** 集成测试：init --ai cursor-agent --yes 后 ~/.cursor/skills 含 speckit-workflow、bmad-bug-assistant；initLog.skillsPublished 正确；执行 check 验证输出含子代理支持等级；init --ai cursor-agent --yes --no-ai-skills 后 skills 未同步、skippedReasons 含说明；init --ai copilot --yes 后 skippedReasons 含「AI 不支持全局 skill」，执行 check 验证输出含子代理支持等级；**端到端**：覆盖 cursor-agent（有 skillsDir）与 copilot（无 skillsDir）的完整 init→check 流程
  - **验收**：npm run test:bmad-speckit 或 e2e 通过
  - **测试代码**：packages/bmad-speckit/tests/e2e/ 或 init-e2e.test.js

- [ ] **T4.4** 集成测试：init --bmad-path 后 skills 从 bmadPath/skills 正确同步；init --ai tabnine 后 stdout 含子代理提示；check 输出子代理支持等级
  - **验收**：worktree 模式、子代理提示流程通过
  - **测试代码**：packages/bmad-speckit/tests/e2e/

<!-- AUDIT: PASSED by code-reviewer -->
