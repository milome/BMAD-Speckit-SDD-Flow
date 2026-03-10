# IMPLEMENTATION_GAPS E10-S5：--bmad-path worktree 共享

**Epic**：10 - Speckit Init Core  
**Story**：10.5 - --bmad-path worktree 共享  
**输入**：plan-E10-S5.md、10-5-worktree-bmad-path.md、spec-E10-S5.md  
**对照基准**：当前代码（packages/bmad-speckit）

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| AC-1、AC-4、plan Phase 1 | GAP-1.1 | init 解析 --bmad-path；须与 --ai、--yes 配合；否则报错 | 未实现 | bin 无 --bmad-path 选项；init.js 无 options.bmadPath 解析与校验 |
| AC-4、plan Phase 1 | GAP-1.2 | 结构验证共享：validateBmadStructure(rootPath)，core/cursor/speckit/skills 至少其二，cursor 含 commands/rules | 未实现 | 无 src/utils/structure-validate.js 或等价；无共享结构验证逻辑 |
| AC-4、plan Phase 1 | GAP-1.3 | 在创建 _bmad-output 前校验 path 存在且结构符合；不通过则退出码 4，错误信息明确 | 未实现 | init 无 --bmad-path 分支，故无该校验；exit-codes 已有 TARGET_PATH_UNAVAILABLE(4) |
| AC-1、plan Phase 2 | GAP-2.1 | worktree 分支：不复制 _bmad，仅创建 _bmad-output；commands、rules、skills 从 bmadPath 指向目录同步 | 未实现 | init 始终走 fetchTemplate + generateSkeleton，会复制 _bmad；无「仅 _bmad-output + 从 path 同步」分支 |
| AC-1、plan Phase 2 | GAP-2.2 | initLog、selectedAI、templateVersion 仍写入 bmad-speckit.json（与 10.4 一致） | 已实现 | writeSelectedAI 已通过 ConfigManager.setAll 写入；worktree 分支需在同一流程写入并追加 bmadPath |
| AC-2、plan Phase 3 | GAP-3.1 | 将 bmadPath（规范绝对路径）经 ConfigManager 写入项目级 bmad-speckit.json；合并已有键 | 未实现 | 无 bmadPath 写入逻辑；ConfigManager.set/setAll 已支持，仅需在 worktree 分支调用 |
| AC-3、plan Phase 4 | GAP-4.1 | check 子命令：读取项目级配置，若 bmadPath 存在则验证指向目录存在且结构符合 | 未实现 | bin 未注册 check 命令；无 src/commands/check.js；check 与 version 等在描述中出现但未实现 |
| AC-3、plan Phase 4 | GAP-4.2 | check 验证 bmadPath 失败时退出码 4（或 1）；与 init 一致采用 4 | 未实现 | 无 check 实现 |
| AC-4、plan Phase 5 | GAP-5.1 | init 与 check 在 path/bmadPath 不可用时使用 TARGET_PATH_UNAVAILABLE(4)；错误信息含「路径不存在」或「结构不符合」及缺失项 | 部分 | exit-codes 已有 4；init 未在 --bmad-path 分支报错；check 未实现 |
| plan Phase 6、§4 | GAP-6.1 | 单元测试：validateBmadStructure；init --bmad-path 与 --ai、--yes；ConfigManager 写入 bmadPath | 未实现 | 无 structure-validate 与 worktree 相关测试 |
| plan Phase 6、§4 | GAP-6.2 | 集成/E2E：init --bmad-path 有效/无效、check 在 bmadPath 存在时通过/失败 | 未实现 | 无对应用例 |
| plan §4.2 | GAP-6.3 | 生产路径：init worktree 分支调用 validateBmadStructure、ConfigManager；check 调用 structure-validate、读取配置 | 未实现 | 上述模块与分支尚未存在 |

---

## 2. 需求映射（Gaps ↔ 原始需求）

| 原始文档章节 | 对应 Gap ID | 说明 |
|-------------|-------------|------|
| Story 范围 --bmad-path worktree | GAP-1.1, 1.2, 1.3, 2.1, 2.2 | init 解析、校验、worktree 分支不复制 _bmad |
| AC-2 bmadPath 写入 | GAP-3.1 | 经 ConfigManager 写入 bmadPath |
| AC-3 check 验证 bmadPath | GAP-4.1, 4.2 | check 子命令及 bmadPath 验证、退出码 4 |
| AC-4 退出码 4 | GAP-1.3, 5.1 | init/check 失败时退出码 4 与错误信息 |
| plan Phase 6、§4 集成与 E2E | GAP-6.1, 6.2, 6.3 | 单元/集成/E2E、生产路径验证 |

---

## 3. 当前实现摘要

| 位置 | 当前行为 | 与需求差异 |
|------|----------|------------|
| bin/bmad-speckit.js | 仅 init 命令；无 --bmad-path；无 check 命令 | 需增加 --bmad-path、注册 check |
| init.js | 无 options.bmadPath；始终 fetchTemplate + generateSkeleton | 需 worktree 分支：校验 path、不拉模板、不复制 _bmad、创建 _bmad-output 并从 bmadPath 同步、写入 bmadPath |
| init-skeleton.js | generateSkeleton 复制 _bmad 与 _bmad-output；writeSelectedAI 经 ConfigManager 写 selectedAI/templateVersion/initLog | 需支持 worktree 路径：仅创建 _bmad-output 并从 bmadPath 同步 AI 目录；writeSelectedAI 或调用方需追加 bmadPath |
| config-manager.js | get/set/setAll/list；项目级路径 _bmad-output/config/bmad-speckit.json | 可复用；仅需 init 在 worktree 分支调用 set('bmadPath', resolvedPath) 或 setAll 合并 |
| exit-codes.js | TARGET_PATH_UNAVAILABLE: 4 | 已满足 |
| src/commands/ | 无 check.js；无 structure-validate | 需新增 check.js、structure-validate.js（或 services 下） |

<!-- AUDIT: PASSED by code-reviewer -->
