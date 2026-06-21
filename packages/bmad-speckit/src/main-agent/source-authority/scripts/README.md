# scripts

部署与开发便利脚本目录。

> **Scoring 相关脚本已整合进 `bmad-speckit` CLI**。目标项目应使用 `npx bmad-speckit score/coach/dashboard/sft-extract/scores/check-score`。`scripts/*.ts` 保留为源仓库开发便利入口，不再是推荐调用方式。

## CLI 子命令对应关系

| 旧脚本 | CLI 子命令 |
|--------|-----------|
| `parse-and-write-score.ts` | `npx bmad-speckit score` |
| `check-story-score-written.ts` | `npx bmad-speckit check-score` |
| `coach-diagnose.ts` | `npx bmad-speckit coach` |
| `dashboard-generate.ts` | `npx bmad-speckit dashboard` |
| `sft-extract.ts` | `npx bmad-speckit sft-extract` |
| `scores-summary.ts` | `npx bmad-speckit scores` |
| `verify-score-auto-scoped-bundle.cjs` | 最小非-vitest 验证 `score -> scoped bundle -> dashboard last_bundle` |

## 脚本用途表

| 脚本 | 用途 | 典型调用 |
|------|------|----------|
| `init-to-root.js` | 部署 _bmad、commands、rules 到项目根 | `node scripts/init-to-root.js` |
| `eval-questions-cli.ts` | 评测题库 list/add/run | `npx ts-node scripts/eval-questions-cli.ts run --id q001 --version v1` |
| `eval-question-generate.ts` | 从 coach 诊断生成 eval 题目 | `npx ts-node scripts/eval-question-generate.ts --run-id r1` |
| `accept-e2-s1.ts` / `accept-e2-s2.ts` / `accept-e4-s3.ts` 等 | 端到端验收脚本 | `npx ts-node scripts/accept-e2-s1.ts` |

## 与 scoring / bmad-speckit 关系

- **scoring**：`packages/scoring/` 是 TypeScript 源码包，编译产物被 `packages/bmad-speckit/` 作为依赖导入。
- **bmad-speckit**：`init-to-root.js` 部署 bmad-speckit 模板；scoring 功能已通过 CLI 子命令提供（`npx bmad-speckit score` 等）。
- **workspace/dist 优先**：`packages/bmad-speckit/src/scoring-runtime.js` 现在优先直接加载仓库内 `packages/scoring/dist/**`，仅在 workspace 构建产物不存在时才回退到 `@bmad-speckit/scoring/*`。这样本地开发不再依赖手工覆盖 `packages/bmad-speckit/node_modules` 中的 scoring 副本。
