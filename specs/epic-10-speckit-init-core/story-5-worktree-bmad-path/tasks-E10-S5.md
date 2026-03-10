# tasks-E10-S5：--bmad-path worktree 共享

**Epic**：E10 speckit-init-core  
**Story ID**：10.5  
**输入**：spec-E10-S5.md、plan-E10-S5.md、IMPLEMENTATION_GAPS-E10-S5.md、10-5-worktree-bmad-path.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | 10-5-worktree-bmad-path, spec §3 AC-1、AC-4 | T1.1–T1.3 | init 解析 --bmad-path；须与 --ai、--yes 配合；path 存在且结构符合，否则退出码 4 |
| T2 | spec §3 AC-1, plan Phase 2 | T2.1–T2.3 | worktree 分支仅创建 _bmad-output、从 bmadPath 同步 commands/rules/skills；initLog/selectedAI/templateVersion 仍写入 |
| T3 | spec §3 AC-2, plan Phase 3 | T3.1–T3.3 | bmadPath 规范绝对路径经 ConfigManager 写入项目级；合并已有键 |
| T4 | spec §3 AC-3, plan Phase 4 | T4.1–T4.4 | check 子命令：若 bmadPath 存在则验证指向目录存在且结构符合；退出码 0/4 |
| T5 | spec §3 AC-4, plan Phase 5 | T5.1–T5.2 | init/check 失败时 TARGET_PATH_UNAVAILABLE(4)；错误信息明确 |
| T6 | plan §4、§4.2 | T6.1–T6.2 | 集成测试与 E2E、生产代码关键路径验证 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| AC-1、AC-4、plan Phase 1 | GAP-1.1, 1.2, 1.3 | ✓ 有 | T1 |
| AC-1、plan Phase 2 | GAP-2.1, 2.2 | ✓ 有 | T2 |
| AC-2、plan Phase 3 | GAP-3.1 | ✓ 有 | T3 |
| AC-3、plan Phase 4 | GAP-4.1, 4.2 | ✓ 有 | T4 |
| AC-4、plan Phase 5 | GAP-5.1 | ✓ 有 | T5 |
| plan Phase 6、§4 | GAP-6.1, 6.2, 6.3 | ✓ 有 | T6 |

---

## 3. 任务列表

### Phase 1：结构验证共享与 init --bmad-path 解析与前置校验（GAP-1.1, 1.2, 1.3）

- [x] **T1.1** 新增 `packages/bmad-speckit/src/utils/structure-validate.js`：实现 `validateBmadStructure(rootPath)`，校验 rootPath 存在且为目录、可读；校验含 core/、cursor/、speckit/、skills/ 至少其二；若 cursor 存在则校验含 commands/、rules/；返回 `{ valid, missing }` 或等价。
  - **验收**：单元测试传入存在且符合的目录 => valid: true；传入不存在路径或空目录 => valid: false，missing 列出缺失项。

- [x] **T1.2** bin/bmad-speckit.js：init 命令增加 `.option('--bmad-path <path>', 'Shared _bmad path (worktree mode)')`。
  - **验收**：`node bin/bmad-speckit.js init --help` 含 --bmad-path。

- [x] **T1.3** init.js：解析 options.bmadPath；若存在则校验须与 --ai、--yes 配合（或 nonInteractive 已为 true）；否则报错「--bmad-path requires --ai and --yes for non-interactive use」并退出。
  - **验收**：`init --bmad-path /some/path`（TTY，无 --ai --yes）=> 报错并退出。

- [x] **T1.4** init.js：在 worktree 分支创建 _bmad-output 前，将 path 解析为 path.resolve(bmadPath)；调用 validateBmadStructure(resolvedPath)；若路径不存在或 valid 为 false，输出明确错误（路径不存在或列出 missing），process.exit(exitCodes.TARGET_PATH_UNAVAILABLE)。
  - **验收**：`init --bmad-path /nonexistent --ai cursor-agent --yes` => 退出码 4；`init --bmad-path <空目录> --ai cursor-agent --yes` => 退出码 4 并列出缺失项。

### Phase 2：worktree 分支仅创建 _bmad-output 与 AI 同步（GAP-2.1, 2.2）

- [x] **T2.1** init.js：当 --bmad-path 有效且通过校验后，不调用 fetchTemplate、不调用 generateSkeleton（不复制 _bmad）；仅创建 targetPath 下 _bmad-output 目录结构（含 config/）。
  - **验收**：init --bmad-path <有效_bmad 根> --ai cursor-agent --yes 后，项目内无 _bmad 目录，存在 _bmad-output/config/。

- [x] **T2.2** init-skeleton.js 或 init.js：实现 worktree 下从 bmadPath 同步 commands、rules、skills 到项目内 AI 目录（如 .cursor/commands、.cursor/rules；依 selectedAI 的 .claude 等）；与 PRD §5.10 一致。
  - **验收**：worktree init 完成后 .cursor/（或所选 AI 目录）存在且内容来自 bmadPath 的 cursor/ 等。

- [x] **T2.3** init.js/worktree 分支：仍调用 writeSelectedAI 或等价，将 selectedAI、templateVersion、initLog 写入 _bmad-output/config/bmad-speckit.json（与 10.4 一致）；并在同流程写入 bmadPath（见 T3）。
  - **验收**：worktree init 完成后 bmad-speckit.json 含 selectedAI、templateVersion、initLog。

### Phase 3：bmadPath 写入项目配置（GAP-3.1）

- [x] **T3.1** init.js 或 init-skeleton.js：在 worktree 分支成功创建 _bmad-output 后，将 bmadPath（已解析的绝对路径）通过 ConfigManager.set('bmadPath', resolvedPath, { scope: 'project', cwd: targetPath }) 或 setAll 合并写入；不覆盖已有 selectedAI、templateVersion、initLog。
  - **验收**：init --bmad-path /abs/path/to/_bmad --ai cursor-agent --yes 完成后，_bmad-output/config/bmad-speckit.json 含 bmadPath 为规范绝对路径，且含 selectedAI、templateVersion、initLog。

- [x] **T3.2** 确认写入经 ConfigManager，无独立写 bmad-speckit.json 逻辑。
  - **验收**：grep 确认 worktree 分支中 bmadPath 写入为 configManager.set 或 setAll。

### Phase 4：check 在 bmadPath 存在时验证指向目录（GAP-4.1, 4.2）

- [x] **T4.1** 新增 `packages/bmad-speckit/src/commands/check.js`：实现 checkCommand；读取项目级配置（ConfigManager.get 或读 _bmad-output/config/bmad-speckit.json）；若含 bmadPath 则跳过项目内 _bmad 存在性校验。
  - **验收**：在已 init --bmad-path 的项目根运行 check => 读取到 bmadPath。

- [x] **T4.2** check.js：若 bmadPath 存在，验证指向目录存在且可读；调用 validateBmadStructure(bmadPath)；不符合则输出错误、列出缺失项，process.exit(4)。
  - **验收**：bmadPath 指向有效且结构符合 => check 退出码 0；指向不存在 => 退出码 4；结构不符合 => 退出码 4 并列出缺失项。

- [x] **T4.3** bin/bmad-speckit.js：注册 check 子命令，action(checkCommand)。
  - **验收**：`node bin/bmad-speckit.js check` 可执行；在含 bmadPath 的项目中 check 退出码 0 或 4 依配置与路径。

- [x] **T4.4** check 与 init 复用同一套 structure-validate 逻辑；仅数据源为 bmadPath 指向路径。
  - **验收**：grep 确认 check.js 引用 structure-validate（或 require('../utils/structure-validate')）。

### Phase 5：退出码与错误信息（GAP-5.1）

- [x] **T5.1** init.js：--bmad-path 校验失败（路径不存在、结构不符合、缺 --ai/--yes）时统一使用 exitCodes.TARGET_PATH_UNAVAILABLE(4)；错误信息明确包含「路径不存在」或「结构不符合」及缺失项。
  - **验收**：stderr 输出可被脚本解析；退出码 4 与文档一致。

- [x] **T5.2** check.js：bmadPath 验证失败时 process.exit(4)。
  - **验收**：check 在 bmadPath 无效时退出码 4。

### Phase 6：集成测试与 E2E（GAP-6.1, 6.2, 6.3）

- [x] **T6.1** 单元测试：structure-validate 在临时目录下覆盖「存在且符合」「缺少子目录」「路径不存在」；集成测试：init --bmad-path /nonexistent --ai cursor-agent --yes => 退出码 4；init --bmad-path <空目录> --ai cursor-agent --yes => 退出码 4；init --bmad-path <有效_bmad 根> --ai cursor-agent --yes => 退出码 0，无 _bmad，有 _bmad-output，bmad-speckit.json 含 bmadPath；check 在 bmadPath 有效 => 0，bmadPath 不存在 => 4。
  - **验收**：pytest 或项目约定测试在项目根运行通过（npm test 或 node 运行 tests/）。

- [x] **T6.2** 生产代码关键路径验证：init.js worktree 分支调用 validateBmadStructure、ConfigManager.set/setAll；check 命令在 bin 注册且调用 structure-validate、读取配置。
  - **验收**：grep 确认 init 与 check 均引用 structure-validate 与 ConfigManager（或项目级配置读取）。

---

## 4. 需求映射清单（tasks ↔ plan + GAPS）

| plan 章节 | Gaps | tasks 对应 | 覆盖状态 |
|-----------|------|------------|----------|
| Phase 1 结构验证与 init 解析校验 | GAP-1.1, 1.2, 1.3 | T1.1–T1.4 | ✅ |
| Phase 2 worktree 仅 _bmad-output 与同步 | GAP-2.1, 2.2 | T2.1–T2.3 | ✅ |
| Phase 3 bmadPath 写入 | GAP-3.1 | T3.1, T3.2 | ✅ |
| Phase 4 check 验证 bmadPath | GAP-4.1, 4.2 | T4.1–T4.4 | ✅ |
| Phase 5 退出码与错误信息 | GAP-5.1 | T5.1, T5.2 | ✅ |
| plan §4 集成/E2E、§4.2 | GAP-6.1, 6.2, 6.3 | T6.1, T6.2 | ✅ |

---

## 5. 验收表头（按 Gap 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法） | 集成测试要求（测试文件/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|----------------------------------|-------------------------------------|----------|----------|
| GAP-1.1, 1.2, 1.3 | T1.1–T1.4 | structure-validate.js；bin --bmad-path；init.js 解析、--ai/--yes 校验、validateBmadStructure、退出码 4 | init --bmad-path 不存在/空目录 => 4；有效 => 通过校验 | [x] 已执行 | [x] |
| GAP-2.1, 2.2 | T2.1–T2.3 | init worktree 分支不 fetchTemplate/generateSkeleton；仅 _bmad-output；从 bmadPath 同步；writeSelectedAI | init --bmad-path 有效 => 无 _bmad，有 _bmad-output，AI 目录来自 bmadPath | [x] 已执行 | [x] |
| GAP-3.1 | T3.1, T3.2 | ConfigManager.set/setAll(bmadPath)，合并已有键 | bmad-speckit.json 含 bmadPath 与 selectedAI 等 | [x] 已执行 | [x] |
| GAP-4.1, 4.2 | T4.1–T4.4 | check.js；读配置、bmadPath 分支、validateBmadStructure、退出码 4 | check 在 bmadPath 有效/无效 => 0/4 | [x] 已执行 | [x] |
| GAP-5.1 | T5.1, T5.2 | init/check 使用 TARGET_PATH_UNAVAILABLE(4)；错误信息明确 | stderr 含路径不存在或结构不符合及缺失项 | [x] 已执行 | [x] |
| GAP-6.1, 6.2, 6.3 | T6.1, T6.2 | 单元/集成/E2E 用例；grep 生产路径 | plan §4.1 用例 + §4.2 grep 验证 | [x] 已执行 | [x] |

<!-- AUDIT: PASSED by code-reviewer -->
