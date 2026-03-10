# plan-E10-S2：非交互式 init 实现方案

**Epic**：E10 speckit-init-core  
**Story ID**：10.2  
**输入**：spec-E10-S2.md、10-2-non-interactive-init.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story 陈述 | §1 概述 | Phase 1–5 | ✅ |
| AC-1 --ai 跳过选择器 | spec §3 AC-1 | Phase 2 | ✅ |
| AC-2 --yes 使用默认值 | spec §3 AC-2 | Phase 3 | ✅ |
| AC-3 TTY 检测 | spec §3 AC-3 | Phase 1 | ✅ |
| AC-4 环境变量 | spec §3 AC-4 | Phase 4 | ✅ |
| AC-5 --modules 非交互 | spec §3 AC-5 | Phase 5 | ✅ |
| 本 Story 范围 | spec §2.1 | Phase 1–5 | ✅ |
| 架构约束 | spec §4 | Phase 1–5 依赖说明 | ✅ |
| CLI 参数扩展 | spec §5 | Phase 2, 3 | ✅ |

---

## 2. 目标与约束

- **目标**：在 InitCommand 上增加 `--ai`、`--yes`、TTY 检测、环境变量、`--modules` 非交互校验，使 `init --ai cursor --yes` 在 CI/CD 中无阻塞执行
- **约束**：复用 Story 10.1 的 InitCommand、tty.js、ai-builtin、TemplateFetcher；ConfigManager 若 10.4 未完成则 defaultAI 仅用内置第一项
- **必须包含**：集成测试与 E2E（init 命令非交互执行、退出码、输出验证）

---

## 3. 实施分期

### Phase 1：TTY 检测与 internalYes（AC-3）

1. **init.js**：在 `initCommand` 流程入口，调用 `ttyUtils.isTTY()`；当 `!ttyUtils.isTTY() && !options.ai && !options.yes` 时设置 `internalYes = true`（或等效逻辑，使后续流程跳过交互）
2. **bin/bmad-speckit.js**：init 命令已解析 options，需确保 `options.ai`、`options.yes` 在 initCommand 调用前可用
3. **验收**：非 TTY 环境（如 `echo | node bin/bmad-speckit.js init --ai cursor-agent`）下不进入 inquirer，直接使用 cursor-agent

### Phase 2：--ai 参数处理（AC-1）

1. **bin/bmad-speckit.js**：init 命令增加 `.option('--ai <name>', 'Non-interactive AI selection')`
2. **init.js**：解析 `options.ai`；若存在则跳过 AI 选择步骤，直接使用该值
3. **init.js**：校验 `options.ai` 是否在 ai-builtin 的 id 列表中（若 registry 已实现则一并校验）；若无效，输出可用 AI 列表（或提示 `check --list-ai`），`process.exit(exitCodes.AI_INVALID)`（2）
4. **验收**：`init --ai cursor-agent --yes` 跳过选择器；`init --ai invalid-ai --yes` 退出码 2，输出含可用 AI 或 check --list-ai 提示

### Phase 3：--yes 与默认 AI（AC-2）

1. **bin/bmad-speckit.js**：init 命令增加 `.option('-y, --yes', 'Skip all prompts, use defaults')`
2. **init.js**：解析 `options.yes`；若存在或 `internalYes` 为 true，跳过所有 inquirer 交互
3. **init.js**：实现默认 AI 来源逻辑：尝试 ConfigManager 读取 `defaultAI`（若 10.4 未完成则 try/catch 或条件加载）；否则使用 `aiBuiltin[0].id`
4. **init.js**：非交互模式下路径使用 targetPath，模板版本使用 `latest`
5. **验收**：`init --yes` 无阻塞；有 defaultAI 时使用 defaultAI；无 defaultAI 时使用内置第一项

### Phase 4：环境变量支持（AC-4）

1. **init.js**：在解析 CLI 后、决定非交互前，读取 `process.env.SDD_AI`、`process.env.SDD_YES`
2. **优先级**：CLI `--ai` > `SDD_AI`；CLI `--yes` > `SDD_YES`
3. **SDD_YES**：`1` 或 `true`（不区分大小写）时视为非交互
4. **验收**：`SDD_AI=claude init --yes` 使用 claude；`SDD_AI=claude init --ai cursor-agent --yes` 使用 cursor-agent

### Phase 5：--modules 非交互校验（AC-5）

1. **init.js**：当 `options.modules` 指定时，若非交互模式（`options.yes` 或 `internalYes` 或 `options.ai`），则允许执行
2. **init.js**：若 TTY 且仅传 `--modules` 无 `--ai`/`--yes`，则进入交互流程（现有行为，本 Story 不修改）
3. **验收**：`init --modules bmm,tea --ai cursor-agent --yes` 仅初始化 bmm、tea，无交互

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 init 命令非交互执行

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 集成 | init --ai cursor-agent --yes | `node packages/bmad-speckit/bin/bmad-speckit.js init --ai cursor-agent --yes`（临时目录） | 退出码 0，目录含 _bmad |
| 集成 | init --ai invalid-ai --yes | 同上 `--ai invalid-ai` | 退出码 2，stderr 含可用 AI 或 check --list-ai |
| 集成 | init --yes 默认 AI | `init --yes`（无 defaultAI 环境） | 退出码 0，使用 aiBuiltin[0] |
| 集成 | SDD_AI 环境变量 | `SDD_AI=claude init --yes` | 使用 claude |
| 集成 | SDD_YES=1 非交互 | `SDD_YES=1 init`（非 TTY 或 TTY） | 视为非交互，使用默认 |
| 集成 | TTY 检测自动 --yes | 非 TTY 下 `init`（无 --ai/--yes） | 自动使用默认 AI，无阻塞 |
| 集成 | --modules 非交互 | `init --modules bmm,tea --ai cursor-agent --yes` | 仅 bmm、tea 模块 |
| 集成 | 非 TTY + --modules 仅传（AC-5 场景 2） | 非 TTY 下 `init --modules bmm,tea`（无 --ai/--yes） | internalYes 自动，退出码 0，仅 bmm、tea |

### 4.2 生产代码关键路径验证

- **init.js**：bin/bmad-speckit.js 的 init 命令 action 调用 initCommand；验收：grep 确认 initCommand 被调用
- **tty.js**：init.js 导入 ttyUtils.isTTY；验收：grep 确认 isTTY 在 init 流程入口被调用
- **ai-builtin.js**：init.js 校验 --ai 时引用；验收：grep 确认 aiBuiltin 在 --ai 无效分支被使用
- **ConfigManager / getDefaultAI**：init.js 在 --yes 且无 --ai 时调用；验收：grep 确认 config-manager 或 getDefaultAI 在 init 流程中被引用

---

## 5. 模块与文件改动设计

### 5.1 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| packages/bmad-speckit/bin/bmad-speckit.js | 增加 --ai、--yes 选项 | init 命令 options |
| packages/bmad-speckit/src/commands/init.js | TTY 检测、--ai/--yes 分支、环境变量、defaultAI、非交互流程 | 核心逻辑 |

### 5.2 新增文件（可选）

| 文件 | 说明 |
|------|------|
| packages/bmad-speckit/tests/e2e/init-non-interactive-e2e.test.js | 非交互 init 集成/E2E 测试（与现有 tests/e2e/init-e2e.test.js 结构一致） |

### 5.3 依赖关系

- Phase 1 先行（TTY 检测为其他非交互逻辑前置）
- Phase 2、3 可并行设计，但实现时建议 2→3（--ai 与 --yes 均影响 AI 选择）
- Phase 4 依赖 Phase 2、3 的 options 解析
- Phase 5 依赖 Phase 1–4 的非交互判定

---

## 6. ConfigManager 占位

若 Story 10.4 未完成，ConfigManager 可能不存在。建议：

- 使用 `try { require('../services/config-manager') } catch { null }` 或条件 require
- 或创建 `getDefaultAI()` 辅助函数：优先 ConfigManager?.get('defaultAI')，否则 aiBuiltin[0].id
