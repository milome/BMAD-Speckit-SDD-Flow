# Claude / Cursor 共享 i18n 发布目录

本目录为 **双语 manifest、field-meta 等 i18n 资产的权威发布源**（与 `docs/plans/UNIFIED_RUNTIME_2026-03-19.md`、`2026-03-19-bilingual-skill-workflow-template-runtime.md` §11.1 一致）。

## 同步约定

| 消费者 | 路径 | 方式 |
|--------|------|------|
| Claude Code | 项目根 `.claude/i18n/**` | `npm run init:claude`（`init-to-root.js --agent claude-code`） |
| Cursor | 项目根 `.cursor/i18n/**` | `npm run init:cursor`（从本目录 **镜像**，见 `scripts/init-to-root.js` Cursor profile） |

源目录不存在时，init **跳过** 复制，不报错；一旦有 `manifests/`、`field-meta.yaml` 等文件，双宿主应得到 **同源树**。

## 验收

阶段 3 宣称完成前：在干净 clone 上执行 **`npm run test:ci:dual`**（先后 `init:claude`、`init:cursor`，再跑 vitest + `test:bmad-speckit`），并确认本目录有内容时 **`.claude/i18n` 与 `.cursor/i18n` 一致**。
