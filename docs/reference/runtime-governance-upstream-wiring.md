# Runtime Governance：upstream 接线参考

> **Current path**: `runAuditorHost`（post-audit automation）
> **Legacy path**: Story assistant 中手工串联 post-audit 两条命令
> **Retired context note**: 本页记录旧 `sync-runtime-context-from-sprint` / `ensure-run-runtime-context` 接线，不再定义目标态控制输入。目标态 active Requirement 解析必须走 Active Requirement Resolver / `ResolvedRuntimeContext`。

本文档集中列出 E15 Story 1 任务文件中「upstream 修改汇总表」第 3 节全文，与 `tasks-E15-S1.md` 保持一致。

## legacy upstream 修改汇总表

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

## legacy 命令子串

旧工作流与 Skill 正文曾要求出现可执行的同步入口：`npx bmad-speckit sync-runtime-context-from-sprint`。该要求仅用于解释历史 E15 接线和旧测试来源；目标态不得继续把该命令作为主控、恢复、门禁或 closeout 输入。当前目标态应由 Active Requirement Resolver 定位 active Requirement，并输出只读 `ResolvedRuntimeContext`。
