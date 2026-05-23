# 工作流完成后如何执行 legacy runtime sync

> Legacy note: 本页记录旧 `sync-runtime-context-from-sprint` / `ensure-run-runtime-context` 接线。目标态不再把这些命令产生的 context / registry 当作控制输入；active Requirement 必须通过 Active Requirement Resolver 定位，运行时上下文以只读 `ResolvedRuntimeContext` 表达。
> Current path: 审计通过后的 post-audit host runner 收口由 `runAuditorHost` 统一执行；本文下面的 legacy sync 步骤仅用于历史排障和迁移对照。

**S9 前置条件：** 执行 `create-epics-and-stories` 的 Step 4（epics 校验与保存）前，`_bmad-output/implementation-artifacts/sprint-status.yaml` **必须**已存在。该文件由 `sprint-planning` 生成。若缺失，先运行 `sprint-planning`，再从 Step 1 重跑 `create-epics-and-stories`。

## historical 命令步骤

以下步骤只用于解释旧 E15 wiring 的历史行为，不是目标态操作指南。新设计不允许通过这些命令写主控状态、恢复状态、门禁状态或 closeout 状态。

1. **sprint-planning 写完 sprint-status.yaml 后**（legacy registry / project context）
   历史执行：`npx bmad-speckit sync-runtime-context-from-sprint`
   历史期望：退出码 0；stdout 含以 `OK: registry and project context synced` 开头的行。

2. **sprint-status 在 corrections 分支写回 YAML 后**
   历史执行：`npx bmad-speckit sync-runtime-context-from-sprint`
   校验同上。

3. **create-epics-and-stories Step 4 保存 epics.md 后**
   历史执行：`npx bmad-speckit sync-runtime-context-from-sprint`
   校验同上。

4. **create-story 更新 sprint-status 并保存后**
   历史执行：`npx bmad-speckit sync-runtime-context-from-sprint --story-key <story_key>`
   `<story_key>` 与 `development_status` 中的键一致（kebab-case）。

5. **Story 审计通过后（Claude bmad-story-audit 与 Cursor bmad-story-assistant 约定）**
   历史执行：`npx bmad-speckit sync-runtime-context-from-sprint --story-key <story_key>`。

6. **dev-story：开发前生成 legacy run context**
   历史执行：`npx bmad-speckit ensure-run-runtime-context --story-key <story_key> --lifecycle dev_story`
   sprint 写回后持久化：`npx bmad-speckit ensure-run-runtime-context --story-key <story_key> --lifecycle dev_story --persist`。

7. **实施后审计（post-audit）**
   历史子任务前：`npx bmad-speckit ensure-run-runtime-context --story-key <story_key> --lifecycle post_audit`
   子任务后：`npx bmad-speckit ensure-run-runtime-context --story-key <story_key> --lifecycle post_audit --persist`。

   说明：这里的 `ensure-run-runtime-context` 只负责为 post-audit 建立和持久化 legacy run context；目标态必须由 RequirementRecord / `ResolvedRuntimeContext` / controlled ingest 承接。

## legacy upstream 修改汇总表（第 3 节全文）

| 任务                  | 文件路径                                                                                       | legacy 修改类型                              |
| --------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| S8                    | `_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md`                         | 历史 sync 调用插入点                         |
| S8                    | `_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md`                           | 历史 corrections 写入后 sync 插入点          |
| S9                    | `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md` | 历史 sync 调用与缺失文件时停止说明           |
| S10                   | 旧 `bmad-speckit sync-runtime-context-from-sprint`（`@bmad-speckit/runtime-context`）          | 历史 `--story-key` + `ensureStoryRuntimeContext` |
| S10                   | `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`                           | 历史 sync 调用插入点                         |
| S10                   | `_bmad/claude/agents/bmad-story-audit.md`                                                      | 历史 S10 sync 小节                           |
| S10                   | `_bmad/cursor/skills/bmad-story-assistant/SKILL.md`                                            | 历史审计通过后 S10 sync 接线                 |
| S11                   | 旧 `packages/runtime-context` + `bmad-speckit ensure-run-runtime-context`                      | 历史 context package / command 新建项        |
| S11                   | `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`                              | 历史 step 1 generate；step 9 persist         |
| S11                   | `_bmad/cursor/skills/bmad-story-assistant/SKILL.md`                                            | 历史 S11 post-audit host runner 收口         |
| S11                   | `_bmad/claude/skills/bmad-story-assistant/SKILL.md`                                            | 历史 S11 post-audit host runner 收口         |
| S12                   | `tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts`                              | 历史 upstream 子串断言                       |
| S13                   | `tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts`                     | 历史 upstream 子串断言                       |
| S14                   | `tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts`                       | 历史 upstream 子串断言                       |
| S16                   | `docs/design/runtime-governance-implementation-analysis.md`                                    | 更新责任矩阵                                |
| S16                   | `docs/reference/runtime-governance-upstream-wiring.md`                                         | 新建                                        |
| S16                   | `docs/how-to/runtime-sync-after-workflows.md`                                                  | 新建                                        |
| S-PACK                | `scripts/prepublish-check.js`                                                                  | 同步 bundle 到 bmad-speckit node_modules    |
| S-PACK                | `packages/bmad-speckit/package.json`                                                           | `bundleDependencies`                        |
| S-PACK                | 根目录 `package.json`                                                                          | `prepublishOnly` 含 prepublish-check        |
| S-PACK                | `packages/bmad-speckit/.npmignore`                                                             | `*.tgz`                                     |
| S-PACK                | `tests/acceptance/accept-pack-bmad-speckit.test.ts`                                            | pack → 干净安装 → 子命令                    |
| S-SYNC-V6             | `docs/explanation/upstream-relationship.md`                                                    | §4.4 + §4.1 行                              |
| S-SYNC-V6             | `scripts/bmad-sync-from-v6.ps1`                                                                | `$EXCLUDE_PATTERNS` + `$BACKUP_ITEMS`       |
| S-SYNC-V6             | `tests/acceptance/runtime-v6-sync-protected-paths.test.ts`                                     | 文档与脚本片段一致                          |
| S8-WIRING-TEST        | `tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts`                                     | 新建                                        |
| S9-WIRING-TEST        | `tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts`                                     | 新建                                        |
| S10-WIRING-TEST       | `tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts`                                    | 新建                                        |
| S8–S10-WIRING-PACKAGE | 根目录 `package.json`                                                                          | `test:bmad` 追加三文件路径                  |
