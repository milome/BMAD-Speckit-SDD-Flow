# IMPLEMENTATION_GAPS-E10-S2：非交互式 init

**Epic**：E10 speckit-init-core  
**Story ID**：10.2  
**输入**：spec-E10-S2.md、plan-E10-S2.md、10-2-non-interactive-init.md、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| AC-3 TTY 检测 | GAP-1 | 非 TTY 且无 --ai/--yes 时自动视为 --yes，使用默认 AI | 未实现 | init.js 82-86：非 TTY 时直接 `process.exit(exitCodes.GENERAL_ERROR)`，未设置 internalYes 或进入非交互流程 |
| AC-1 --ai | GAP-2 | --ai 跳过选择器，无效时退出码 2 | 未实现 | bin 无 --ai 选项；init.js 无 --ai 解析与校验；无 ai-builtin 无效分支 |
| AC-2 --yes | GAP-3 | --yes 跳过交互，defaultAI > 内置第一项 | 未实现 | bin 无 --yes 选项；init.js 无非交互分支；无 ConfigManager/defaultAI 读取 |
| AC-4 环境变量 | GAP-4 | SDD_AI、SDD_YES，优先级低于 CLI | 未实现 | init.js 未读取 process.env.SDD_AI、SDD_YES |
| AC-5 --modules 非交互 | GAP-5 | --modules 须与 --ai/--yes 配合，非 TTY 时 internalYes 自动 | 未实现 | 依赖 GAP-1～4；当前 --modules 仅在交互流程中生效 |
| plan §4 集成测试 | GAP-6 | init --ai cursor-agent --yes、退出码 2、SDD_AI、SDD_YES、TTY 检测、--modules 非交互 | 部分实现 | init-e2e.test.js 中 E2E-1/2/3/6/7 因 TTY 跳过；无非交互 init 用例 |
| plan §4.2 生产路径 | GAP-7 | ConfigManager / getDefaultAI 在 init 流程中被引用 | 未实现 | 无 config-manager 或 getDefaultAI；Story 10.4 未完成时可条件加载 |

---

## 2. 需求映射清单（GAPS ↔ spec + plan）

| spec 章节 | plan 对应 | Gaps 覆盖 | 覆盖状态 |
|-----------|----------|----------|----------|
| §3 AC-1 | Phase 2 | GAP-2 | ✅ |
| §3 AC-2 | Phase 3 | GAP-3 | ✅ |
| §3 AC-3 | Phase 1 | GAP-1 | ✅ |
| §3 AC-4 | Phase 4 | GAP-4 | ✅ |
| §3 AC-5 | Phase 5 | GAP-5 | ✅ |
| plan §4 | 集成/E2E | GAP-6 | ✅ |
| plan §4.2 | 生产路径 | GAP-7 | ✅ |

---

## 3. 当前实现摘要

| 模块/文件 | 当前状态 | 与本 Story 相关 |
|----------|----------|-----------------|
| bin/bmad-speckit.js | 有 init 命令，无 --ai、--yes | 需增加选项 |
| src/commands/init.js | 交互式流程；非 TTY 时退出 | 需 TTY 检测分支、非交互流程 |
| src/utils/tty.js | isTTY() 已实现 | 复用 |
| src/constants/ai-builtin.js | 19+ AI 列表 | 复用，--ai 校验 |
| src/constants/exit-codes.js | AI_INVALID=2 | 复用 |
| src/services/template-fetcher.js | 模板拉取 | 复用 |
| ConfigManager | 不存在（Story 10.4 未完成） | 条件加载或 getDefaultAI 占位 |
| tests/e2e/init-e2e.test.js | 多数因 TTY 跳过 | 需增加非交互用例 |
