# §5 执行阶段审计报告：TASKS_installation-improvement

> **审计对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_installation-improvement.md` 及当前实现状态  
> **审计轮次**：第 1 轮  
> **日期**：2026-03-05  
> **结论**：**未完全覆盖、验证未通过**（需修复后进入下一轮）

---

## 一、逐项验证表

### §1 安装流程碎片化 → 统一安装脚本

| 任务 | 可操作性 | 可验证性 | 路径有效性 | 验收标准明确性 | 实现状态 |
|------|----------|----------|------------|----------------|----------|
| T-INSTALL-1 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-INSTALL-2 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-INSTALL-3 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施**（归属 T-INSTALL-2） |
| T-INSTALL-4 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施**（归属 T-INSTALL-2） |
| T-INSTALL-5 | ✅ 是 | ✅ 是 | ✅ 是 | ⚠️ 缺 `setup:full` 参数说明 | ❌ **未实施** |

**T-INSTALL-1 证据**：`scripts/init-to-root.js` 第 13–14 行仍为 `const DIRS = ['_bmad', '_bmad-output', 'commands', 'rules'];`，无 `--full` 参数、无 `CORE_DIRS`/`FULL_DIRS`、无 `.cursor/` 同步逻辑。

**T-INSTALL-2 证据**：`scripts/setup.ps1` 不存在（glob 搜索 0 结果）。

**T-INSTALL-5 证据**：`package.json` 的 `files` 仅包含 `_bmad`、`_bmad-output`、`commands`、`rules`、`scripts`；`scripts` 中无 `setup`、`setup:full`；`bin` 中无 `bmad-speckit-setup`。

---

### §2 commands/ 与 .cursor/ 同步

| 任务 | 可操作性 | 可验证性 | 路径有效性 | 验收标准明确性 | 实现状态 |
|------|----------|----------|------------|----------------|----------|
| T-SYNC-1 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施**（合入 T-INSTALL-1） |
| T-SYNC-2 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-SYNC-3 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |

**T-SYNC-2 证据**：`.cursor/commands/` 下无 speckit.*.md 文件（grep `speckit\.(analyze|checklist|...)` 返回 0 结果）。`commands/` 下有 9 个 speckit 命令，未复制到 `.cursor/commands/`。

**T-SYNC-3 证据**：
- `config/code-reviewer-config.yaml`：204 行，含 `items:`（约 152 行起）、`veto_items:`（约 191 行起）
- `.cursor/agents/code-reviewer-config.yaml`：144 行，**无** `items` 与 `veto_items` 段，为截断版

---

### §3 快速上手指南

| 任务 | 可操作性 | 可验证性 | 路径有效性 | 验收标准明确性 | 实现状态 |
|------|----------|----------|------------|----------------|----------|
| T-QUICKSTART-1 | ✅ 是 | ⚠️ 「5 分钟内看到 spec.md」主观 | ✅ 是 | ⚠️ 依赖 T-INSTALL-2 | ❌ **未实施** |

**T-QUICKSTART-1 证据**：`docs/QUICKSTART.md` 不存在。

---

### §4 跨平台路径统一

| 任务 | 可操作性 | 可验证性 | 路径有效性 | 验收标准明确性 | 实现状态 |
|------|----------|----------|------------|----------------|----------|
| T-XPLAT-1 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-XPLAT-2 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-XPLAT-3 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-XPLAT-4 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-XPLAT-5 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-XPLAT-6 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-XPLAT-7 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-XPLAT-8 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |

**T-XPLAT-1 证据**：`docs/PATH_CONVENTIONS.md` 不存在。

**T-XPLAT-2 证据**：`config/coach-trigger.yaml` 第 1–2 行仍为 `required_skill_path: "%USERPROFILE%/.cursor/skills/..."`，未改为 `{SKILLS_ROOT}`。

**T-XPLAT-3 证据**：`scoring/coach/config.ts` 第 7 行仍为 `process.env.USERPROFILE || process.env.HOME`，第 32–34 行仅处理 `%USERPROFILE%`，未实现 `{SKILLS_ROOT}` 展开。

**T-XPLAT-4 证据**：`skills/README.md` 第 16、22、25 行仍含 `%USERPROFILE%`、`$HOME/.cursor/skills/`，未统一为 `{SKILLS_ROOT}`。

**T-XPLAT-5 证据**：`skills/bmad-customization-backup/SKILL.md` 第 11、27–31、55–58 行仍为 `~/.cursor/` 与 `%USERPROFILE%\.cursor\` 混用。

**T-XPLAT-6 证据**：`skills/git-push-monitor/SKILL.md` 第 14–16 行仍含 `%USERPROFILE%`、`C:\Users\<用户名>`。

**T-XPLAT-7 证据**：`scoring/coach/README.md` 仍含 `%USERPROFILE%`、`~/.cursor/skills/`，未替换为 `{SKILLS_ROOT}`。

**T-XPLAT-8 证据**：`docs/BMAD/bmad-speckit-integration-TASKS.md` 约 30 处 `C:\Users\milom`；`docs/BMAD/bmad-bug-assistant技能位置说明.md` 约 6 处。

---

### §5 init-to-root.js 与 README 更新

| 任务 | 可操作性 | 可验证性 | 路径有效性 | 验收标准明确性 | 实现状态 |
|------|----------|----------|------------|----------------|----------|
| T-README-1 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |
| T-README-2 | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | ❌ **未实施** |

**T-README-1 证据**：`README.md` 第 5 行后无「一键安装」段，未引用 `setup.ps1`。

**T-README-2 证据**：`docs/INSTALLATION_AND_MIGRATION_GUIDE.md` §3.2 无「推荐：一键安装」块；§3.6 无「若使用 setup.ps1 安装，验证已内置。手动安装的验证步骤如下：」前缀。

---

## 二、批判审计员专项（>60% 发言占比）

### 质疑 1：Phase 1 任务为何未优先执行？

**质疑点**：TASKS 明确将 T-SYNC-2、T-SYNC-3 列为「Phase 1 — 立即可执行（无依赖）」，但 `.cursor/commands/` 仍缺 9 个 speckit 命令，`.cursor/agents/code-reviewer-config.yaml` 仍为截断版。

**风险**：Phase 1 不完成会导致依赖链断裂；新用户按当前文档手动安装时，`.cursor/` 下 speckit 命令不可用。

**建议验证方式**：执行 `Copy-Item "commands\speckit.*.md" ".cursor\commands\" -Force` 及 `Copy-Item "config\code-reviewer-config.yaml" ".cursor\agents\code-reviewer-config.yaml" -Force` 后，验证 `.cursor/commands/speckit.specify.md` 存在且 `.cursor/agents/code-reviewer-config.yaml` 行数 ≥200。

---

### 质疑 2：T-INSTALL-5 的 `setup:full` 参数语义不清

**质疑点**：TASKS 中 `"setup:full": "pwsh scripts/setup.ps1 --full"`，但 setup.ps1（T-INSTALL-2）的参数表仅列 `-Target`、`-SkipSkills`、`-SkipScoring`、`-DryRun`、`-Help`，无 `--full`。

**风险**：`setup:full` 与 init-to-root 的 `--full` 含义可能混淆；若 setup.ps1 内部调用 `init-to-root.js --full`，则 `npm run setup:full` 的 `--full` 会传给 setup.ps1 而非 init-to-root，导致行为未定义。

**建议验证方式**：在 TASKS 或 setup.ps1 设计中明确：`setup:full` 表示「对 -Target 执行完整部署（含 init-to-root --full）」，且参数传递链条清晰。

---

### 质疑 3：T-INSTALL-4 验证项与 INSTALLATION_AND_MIGRATION_GUIDE §3.6 不一致

**质疑点**：T-INSTALL-4 要求 20 项验证（含 `.cursor\commands\speckit.specify.md`、`.cursor\agents\code-reviewer-config.yaml` 等），而 INSTALLATION_AND_MIGRATION_GUIDE §3.6 的 `$checks` 数组仅含 14 项（含 `.cursor\commands\bmad-bmm-create-story.md`，但**不含** `.cursor\commands\speckit.specify.md`）。

**风险**：两处验证逻辑不一致，安装后可能出现「T-INSTALL-4 报 [MISSING] 而 §3.6 脚本显示 [OK]」的矛盾。

**建议验证方式**：统一 T-INSTALL-4 与 §3.6 的验证清单，或在 setup.ps1 中引用单一权威清单。

---

### 质疑 4：T-XPLAT-2 与 scoring/coach 的依赖方向

**质疑点**：T-XPLAT-2 修改 `config/coach-trigger.yaml` 为 `{SKILLS_ROOT}`，T-XPLAT-3 修改 `scoring/coach/config.ts` 支持展开。若仅完成 T-XPLAT-2 而未完成 T-XPLAT-3，coach 加载时会得到未展开的 `{SKILLS_ROOT}/...` 字符串，导致路径无效。

**风险**：T-XPLAT-2 与 T-XPLAT-3 必须原子完成，否则会引入运行时错误。

**建议验证方式**：在 T-XPLAT-3 完成后运行 `npm run coach:diagnose -- --run-id=sample-run --format=json`，确认 required_skill_path 展开为实际绝对路径。

---

### 质疑 5：T-XPLAT-8 的「可操作文件」边界模糊

**质疑点**：TASKS 称「仅修改可操作文件，不修改历史审计报告」，但 `docs/BMAD/prd.*.json`、`progress.*.txt` 等亦含 `C:\Users\milom`，未明确是否在「可操作」范围内。

**风险**：若修改 prd/progress，可能影响既有工作流；若不修改，文档内路径仍不一致。

**建议验证方式**：在 TASKS 中补充：T-XPLAT-8 修改范围**仅限** `bmad-speckit-integration-TASKS.md` 与 `bmad-bug-assistant技能位置说明.md`，明确排除 `prd.*.json`、`progress.*.txt`、`AUDIT_*.md`、`DEBATE_*.md`。

---

### 质疑 6：T-QUICKSTART-1 与 T-INSTALL-2 的循环依赖

**质疑点**：T-QUICKSTART-1 要求「运行 pwsh scripts/setup.ps1 -Target <路径>」，但若 T-INSTALL-2 未完成，则需写「手动 3 步」。T-QUICKSTART-1 的执行顺序在 Phase 5，晚于 T-INSTALL-2（Phase 3），故理论上可依赖 setup.ps1。但若实施顺序错乱（先写 QUICKSTART 再写 setup.ps1），会出现文档引用不存在的脚本。

**风险**：QUICKSTART 发布后 setup.ps1 仍未就绪，新用户会执行失败。

**建议验证方式**：在 T-QUICKSTART-1 实施前确认 T-INSTALL-2 已通过验收。

---

### 质疑 7：ralph-method 追踪文件缺失

**质疑点**：§5 审计要求「是否已创建并维护 ralph-method 追踪文件（prd.json、progress.txt），且每完成一个 US 有对应更新」。`_orphan` 目录下无 `prd.installation-improvement*.json`、`progress.installation-improvement*.txt`。

**风险**：TASKS 标注「状态：待实施」，表明尚未开始执行；但按 speckit-workflow 要求，**开始执行 tasks 前**应创建 prd/progress。当前既未执行也未创建，符合「待实施」状态，但若执行时跳过创建，将违反审计要求。

**建议验证方式**：在首次执行任一 T-INSTALL-/T-SYNC-/T-XPLAT- 任务前，于 `_bmad-output/implementation-artifacts/_orphan/` 创建 `prd.TASKS_installation-improvement.json` 与 `progress.TASKS_installation-improvement.txt`，并记录 Phase 1 首个任务的启动。

---

### 质疑 8：package.json `files` 追加后 npm 包体积与发布影响

**质疑点**：T-INSTALL-5 要求 `files` 追加 `config`、`templates`、`workflows`。当前 npm 包未包含这些目录，追加后 `npm pack` 产物的内容会显著增加。

**风险**：若这些目录含大文件或敏感路径，可能影响发布策略；若用户通过 `npm install` 安装，需确认 postinstall 是否仍仅运行 `init-to-root.js`（默认 4 目录），而 `config`/`templates`/`workflows` 是否需通过 `--full` 单独触发。

**建议验证方式**：执行 `npm pack` 检查产物，确认 `config`、`templates`、`workflows` 被正确包含，且无不应发布的文件。

---

### 质疑 9：T-INSTALL-3 的 code-review 技能与清单不一致

**质疑点**：T-INSTALL-3 的 `$REQUIRED_SKILLS` 含 `code-review`，而 skills/README.md 及部分文档写「code-review / requesting-code-review」，存在命名歧义。Cursor 全局目录下实际技能名可能为 `requesting-code-review` 或 `code-review`。

**风险**：复制时 `skills/code-review/` → `$env:USERPROFILE\.cursor\skills\code-review\`，若源仓库只有 `requesting-code-review` 而无 `code-review`，会报错或复制失败。

**建议验证方式**：列出 `skills/` 下实际子目录名，确认 `code-review` 存在；若为 `requesting-code-review`，则更新 T-INSTALL-3 清单或建立别名复制逻辑。

---

### 质疑 10：验收命令的可执行性与环境假设

**质疑点**：T-INSTALL-1 验收写「node scripts/init-to-root.js D:\Dev\test-project」，假设存在 `D:\Dev\test-project`；T-INSTALL-2 验收写「pwsh scripts/setup.ps1 -Target D:\Dev\new-project」。在 CI 或非 Windows 环境中，这些路径可能不存在或不可写。

**风险**：验收标准依赖特定本地路径，难以在自动化流水线中复现。

**建议验证方式**：在 TASKS 或验收脚本中补充：可使用 `$env:TEMP` 或 `os.tmpdir()` 下的临时目录进行验收，或标注「需在 Windows 开发机上执行」。

---

## 三、§5 专项检查（scoring 相关）

| 检查项 | 适用性 | 结论 |
|--------|--------|------|
| (5) branch_id 在 scoring-trigger-modes call_mapping 且 enabled | N/A | TASKS 不涉及 scoring 集成 |
| (6) parseAndWriteScore 参数证据 | N/A | 同上 |
| (7) eval_question 时 question_version 必填 | N/A | 同上 |
| (8) 评分写入失败 non_blocking 且记录 resultCode | N/A | 同上 |

**说明**：本 TASKS 为安装流程改进，与 scoring 写入无关，上述 4 项标为 N/A。

---

## 四、Gap 汇总

### 未通过项（实施层面）

1. **全部 18 个任务未实施**：TASKS 状态为「待实施」，与审计结果一致。
2. **Phase 1 未执行**：T-SYNC-2、T-SYNC-3 本可独立完成，当前仍未执行。
3. **ralph-method 未创建**：无 prd/progress，执行开始前需补建。

### 遗漏项（文档/设计层面）

1. **T-INSTALL-5**：`setup:full` 与 setup.ps1 参数关系未在 TASKS 中说明。
2. **T-INSTALL-4 vs §3.6**：验证清单不一致，需统一。
3. **T-XPLAT-8**：可操作文件边界需在 TASKS 中明确排除清单。
4. **T-INSTALL-3**：`code-review` vs `requesting-code-review` 需确认。

### 模糊项

1. **T-QUICKSTART-1**：「5 分钟内看到 spec.md」为主观验收，建议补充客观检查（如 `Test-Path specs/001-my-first-feature/spec.md`）。
2. **验收环境**：Windows 路径 `D:\Dev\*` 的假设需在 TASKS 中说明。

---

## 五、结论与下一轮审计重点

### 结论：**未完全覆盖、验证未通过**

- **任务文档质量**：18 个任务均可操作、可验证，路径有效，依赖关系与推荐执行顺序合理。
- **实现状态**：0/18 任务已完成；TASKS 标注「待实施」与当前状态一致。
- **收敛条件**：本轮发现多处 gap，**未满足「连续 3 轮无新 gap」**，需修复后进入下一轮。

### 建议的修复顺序

1. **立即可修复（Phase 1）**：执行 T-SYNC-2、T-SYNC-3，无需等待其他任务。
2. **文档补全**：在 TASKS 中补充 T-INSTALL-5 `setup:full` 说明、T-INSTALL-4 与 §3.6 的清单对齐、T-XPLAT-8 可操作文件边界、T-INSTALL-3 技能名确认。
3. **执行前准备**：创建 `prd.TASKS_installation-improvement.json`、`progress.TASKS_installation-improvement.txt`。

### 下一轮审计重点

1. 验证 T-SYNC-2、T-SYNC-3 实施后的文件存在性与内容正确性。
2. 验证 T-INSTALL-1（含 T-SYNC-1）实施后 `init-to-root.js --full` 与 `.cursor/` 同步行为。
3. 验证 setup.ps1 创建后的前置条件检查、DryRun、验收逻辑。
4. 确认 ralph-method 文件已创建且随任务推进更新。

---

**轮次与收敛**：本轮为第 1 轮，存在 gap，**需修复后进入下一轮**；连续 3 轮无新 gap 后方可宣布收敛。
