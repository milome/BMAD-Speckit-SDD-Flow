# tasks-E10-S2：非交互式 init

**Epic**：E10 speckit-init-core  
**Story ID**：10.2  
**输入**：spec-E10-S2.md、plan-E10-S2.md、IMPLEMENTATION_GAPS-E10-S2.md、10-2-non-interactive-init.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | 10-2-non-interactive-init | AC-3, T1 | TTY 检测，非 TTY 且无 --ai/--yes 时 internalYes |
| T2 | spec-E10-S2 | §3 AC-1 | --ai 跳过选择器，无效时退出码 2 |
| T3 | spec-E10-S2 | §3 AC-2 | --yes 跳过交互，defaultAI > 内置第一项 |
| T4 | spec-E10-S2 | §3 AC-4 | SDD_AI、SDD_YES，优先级低于 CLI |
| T5 | spec-E10-S2 | §3 AC-5 | --modules 非交互校验 |
| T6 | plan-E10-S2 | §4 | 集成测试与 E2E |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| AC-3 | GAP-1 | ✓ 有 | T1 |
| AC-1 | GAP-2 | ✓ 有 | T2 |
| AC-2 | GAP-3 | ✓ 有 | T3 |
| AC-4 | GAP-4 | ✓ 有 | T4 |
| AC-5 | GAP-5 | ✓ 有 | T5 |
| plan §4 | GAP-6 | ✓ 有 | T6 |
| plan §4.2 | GAP-7 | ✓ 有 | T1–T5（生产路径）、T6（grep 验证） |

---

## 3. 任务列表

### Phase 1：TTY 检测（GAP-1）

- [x] **T1.1** [P] 使用 utils/tty.js 的 isTTY()（Story 10.1 已实现），init.js 已导入，无需重复实现
  - **验收**：grep 确认 init.js 导入 ttyUtils 且调用 isTTY()
- [x] **T1.2** InitCommand 在流程入口检测 TTY：当 `!ttyUtils.isTTY() && !options.ai && !options.yes` 时设置 `internalYes=true`
  - **验收**：非 TTY 下 `init`（无 --ai/--yes）不退出，进入非交互流程
  - **生产代码**：init.js 修改 82-86 行逻辑，由 exit 改为设置 internalYes 并分支到 runNonInteractiveFlow

### Phase 2：--ai 参数处理（GAP-2）

- [x] **T2.1** bin/bmad-speckit.js：init 命令增加 `.option('--ai <name>', 'Non-interactive AI selection')`
  - **验收**：`node bin/bmad-speckit.js init --help` 含 --ai
- [x] **T2.2** init.js：解析 options.ai；若存在则跳过 AI 选择，直接使用该值
  - **验收**：`init --ai cursor-agent --yes` 跳过 inquirer AI 选择
- [x] **T2.3** init.js：校验 options.ai 是否在 ai-builtin 的 id 列表中；若无效，输出可用 AI 列表或提示 `check --list-ai`，`process.exit(exitCodes.AI_INVALID)`（2）
  - **验收**：`init --ai invalid-ai --yes` 退出码 2，stderr 含可用 AI 或 check --list-ai

### Phase 3：--yes 与默认 AI（GAP-3）

- [x] **T3.1** bin/bmad-speckit.js：init 命令增加 `.option('-y, --yes', 'Skip all prompts, use defaults')`
  - **验收**：`node bin/bmad-speckit.js init --help` 含 --yes、-y
- [x] **T3.2** init.js：解析 options.yes；若存在或 internalYes，跳过所有 inquirer 交互
  - **验收**：`init --yes` 无阻塞
- [x] **T3.3** init.js：实现默认 AI 来源逻辑：尝试 ConfigManager 读取 defaultAI（若 10.4 未完成则 try/catch 或条件加载）；否则使用 aiBuiltin[0].id
  - **验收**：无 defaultAI 时使用 aiBuiltin[0]；有 defaultAI 时使用 defaultAI
- [x] **T3.4** init.js：非交互模式下路径使用 targetPath，模板版本使用 latest
  - **验收**：`init --yes` 使用当前目录、latest 模板

### Phase 4：环境变量支持（GAP-4）

- [x] **T4.1** init.js：在解析 CLI 后读取 process.env.SDD_AI、process.env.SDD_YES
  - **验收**：SDD_AI=claude init --yes 使用 claude
- [x] **T4.2** init.js：优先级 CLI > 环境变量；SDD_YES=1 或 true（不区分大小写）时视为非交互
  - **验收**：SDD_AI=claude init --ai cursor-agent --yes 使用 cursor-agent；SDD_YES=1 init 视为非交互

### Phase 5：--modules 非交互校验（GAP-5）

- [x] **T5.1** init.js：当 options.modules 指定且为非交互模式（options.yes 或 internalYes 或 options.ai）时，允许执行
  - **验收**：`init --modules bmm,tea --ai cursor-agent --yes` 仅初始化 bmm、tea，无交互
- [x] **T5.2** init.js：非 TTY 下仅传 --modules 时，internalYes 自动，可执行
  - **验收**：非 TTY 下 `init --modules bmm,tea` 退出码 0，仅 bmm、tea

### Phase 6：集成测试与 E2E（GAP-6、GAP-7）

- [x] **T6.1** tests/e2e/init-e2e.test.js：增加非交互 init 用例
  - init --ai cursor-agent --yes（临时目录）→ 退出码 0，目录含 _bmad
  - init --ai invalid-ai --yes → 退出码 2，stderr 含可用 AI 或 check --list-ai
  - init --yes（无 defaultAI）→ 退出码 0
  - SDD_AI=claude init --yes → 使用 claude
  - SDD_YES=1 init（非 TTY 或 TTY）→ 视为非交互
  - 非 TTY 下 init（无 --ai/--yes）→ 自动默认 AI，无阻塞
  - init --modules bmm,tea --ai cursor-agent --yes → 仅 bmm、tea
  - 非 TTY 下 init --modules bmm,tea（无 --ai/--yes）→ internalYes 自动，退出码 0，仅 bmm、tea（plan §4.1 第 8 条）
- [x] **T6.2** 生产代码关键路径 grep 验证：initCommand 被 bin 调用；isTTY 在 init 入口调用；aiBuiltin 在 --ai 无效分支使用；ConfigManager 或 getDefaultAI 在 --yes 且无 --ai 时引用
  - **验收**：T6.1 用例通过；grep 验证脚本或 T029 扩展通过

---

## 4. 需求映射清单（tasks ↔ plan + GAPS）

| plan 章节 | Gaps | tasks 对应 | 覆盖状态 |
|-----------|------|------------|----------|
| Phase 1 TTY | GAP-1 | T1.1, T1.2 | ✅ |
| Phase 2 --ai | GAP-2 | T2.1, T2.2, T2.3 | ✅ |
| Phase 3 --yes | GAP-3 | T3.1–T3.4 | ✅ |
| Phase 4 环境变量 | GAP-4 | T4.1, T4.2 | ✅ |
| Phase 5 --modules | GAP-5 | T5.1, T5.2 | ✅ |
| plan §4 集成测试 | GAP-6 | T6.1 | ✅ |
| plan §4.2 生产路径 | GAP-7 | T6.2, T1–T5 | ✅ |

---

## 5. 验收表头（按 Gap 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| GAP-1 | T1.1, T1.2 | init.js：internalYes 逻辑，非 TTY 分支 | init-e2e 非 TTY init 用例 | [x] 通过 | [x] |
| GAP-2 | T2.1–T2.3 | bin --ai；init.js --ai 解析、校验、exit 2 | init --ai invalid-ai --yes 退出码 2 | [x] 通过 | [x] |
| GAP-3 | T3.1–T3.4 | bin --yes；init.js 非交互、defaultAI、路径/模板 | init --yes 无阻塞 | [x] 通过 | [x] |
| GAP-4 | T4.1, T4.2 | init.js SDD_AI、SDD_YES 读取与优先级 | SDD_AI/SDD_YES 用例 | [x] 通过 | [x] |
| GAP-5 | T5.1, T5.2 | init.js --modules 非交互分支 | --modules 非交互用例 | [x] 通过 | [x] |
| GAP-6 | T6.1 | init-e2e.test.js 新增用例 | node tests/e2e/init-e2e.test.js | [x] 通过 | [x] |
| GAP-7 | T6.2, T1–T5 | grep 验证 initCommand、isTTY、aiBuiltin、ConfigManager | T029 或 grep 脚本 | [x] 通过 | [x] |
