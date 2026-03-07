# §5 执行阶段审计报告：TASKS_installation-improvement（第 2 轮）

> **审计对象**：Phase 1 修复验证 + 剩余 16 任务及第 1 轮质疑复核  
> **审计轮次**：第 2 轮  
> **日期**：2026-03-05  
> **结论**：**Phase 1 验证通过**；整体仍**未完全覆盖、验证未通过**（剩余 16 任务未实施）；**第 2 轮无新 gap**，需继续第 3 轮

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 一、Phase 1 实施验证结果

### T-SYNC-2：9 个 speckit 命令同步 — ✅ 验证通过

| 验证项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| 文件数量 | 9 | 9 | ✅ |
| 文件名 | speckit.{analyze,checklist,clarify,constitution,implement,plan,specify,tasks,taskstoissues}.md | 全部存在 | ✅ |
| 内容一致性 | 与 commands/ 对应文件一致 | 逐文件比对：9/9 MATCH | ✅ |

**验证命令与输出**：
```
Glob .cursor/commands/speckit.*.md → 9 files
逐文件 Get-Content -Raw 比对 commands/ vs .cursor/commands/ → MATCH: 全 9 个
```

---

### T-SYNC-3：code-reviewer-config.yaml 完整版同步 — ✅ 验证通过

| 验证项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| 源与目标内容一致 | config/ ≈ .cursor/agents/ | IDENTICAL（字节级一致） | ✅ |
| 含 items: 段 | 第 152 行起 | 存在，行号 152 | ✅ |
| 含 veto_items: 段 | 第 193 行起 | 存在，行号 193 | ✅ |
| 行数 | TASKS 写 211 | 实际 204 | ⚠️ 非阻塞（文档偏差） |

**说明**：TASKS 写「211 行完整版」与当前 config 实际 204 行存在偏差，可能为历史版本差异。实质验收「包含 items: 和 veto_items: 段」已满足，内容完全一致，不构成阻塞。

---

## 二、批判审计员专项（>60% 发言占比）

### 【批判审计员】对剩余 16 个未实施任务的深度质疑

#### 2.1 T-INSTALL-1 / T-SYNC-1（合入）

**质疑**：init-to-root.js 的 `.cursor/` 同步逻辑（T-SYNC-1）与 `--full` 模式（T-INSTALL-1）的触发关系未在 TASKS 中明确。若默认模式（无 `--full`）也执行 `.cursor/` 同步，则与 TASKS「不修改默认行为」矛盾；若仅 `--full` 时同步，则新用户 `npm install` 后 postinstall 运行的 init-to-root 不会同步 .cursor/，与 Phase 1 已手动补齐的 .cursor/commands/ 形成「双轨」—— 源仓库有 .cursor/，但通过 npm 安装到新项目的目标项目无 .cursor/。

**风险**：实施时必须明确：默认模式是否执行 .cursor 同步？若否，则 npm 安装用户仍需手动执行 Phase 1 的复制步骤，setup.ps1 的「一键」价值才能体现。

---

#### 2.2 T-INSTALL-2（setup.ps1）

**质疑**：前置条件检查「Node.js ≥18、Python ≥3.8、PowerShell ≥7、Git ≥2.x」的检测方式未在 TASKS 中定义。是 `node -v`/`python -V` 解析版本号，还是仅 `Test-Path` 存在？若解析不当，可能误报或漏报。

**风险**：setup.ps1 实施时若未统一检测逻辑，不同环境表现不一致。

**复核第 1 轮质疑 1**：Phase 1 已修复，质疑 1 已闭环。✅

---

#### 2.3 T-INSTALL-4 与 §3.6 验证清单不一致（第 1 轮质疑 3）

**质疑**：T-INSTALL-4 列出 20 项检查（含 `.cursor\commands\speckit.specify.md`、`.cursor\agents\code-reviewer-config.yaml`），而 INSTALLATION_AND_MIGRATION_GUIDE §3.6 的 `$checks` 为 14 项，且不含 speckit.specify.md。Phase 1 补齐后，§3.6 的脚本若单独运行，仍不会检查 speckit 命令，导致「安装验证脚本未覆盖 speckit 命令」的缺口。

**风险**：新用户按 §3.6 验证时可能漏检 speckit 命令；setup.ps1 内置验证若与 §3.6 不一致，两套标准并存会造成混淆。

**复核**：第 1 轮质疑 3 仍未解决，建议在实施 T-INSTALL-4 时同步更新 §3.6 或明确「setup.ps1 为权威，§3.6 仅作参考」。

---

#### 2.4 T-INSTALL-5 的 setup:full 参数（第 1 轮质疑 2）

**质疑**：`"setup:full": "pwsh scripts/setup.ps1 --full"` 中的 `--full` 会作为 setup.ps1 的位置参数传入。若 setup.ps1 未声明 `--full`，PowerShell 可能将其误解析为 `-Target` 的值（若 `-Target` 为下一个参数）。TASKS 未定义 setup.ps1 的 `--full` 语义。

**风险**：`npm run setup:full` 可能无法正确触发「完整部署」行为。

**复核**：第 1 轮质疑 2 仍待 T-INSTALL-2 实施时一并澄清。建议在 TASKS 中补一句：「setup:full 即 setup.ps1 -Target <cwd> 且内部调用 init-to-root.js --full」。

---

#### 2.5 T-XPLAT-2 / T-XPLAT-3 原子性（第 1 轮质疑 4）

**质疑**：T-XPLAT-2 将 coach-trigger.yaml 改为 `{SKILLS_ROOT}` 后，若 T-XPLAT-3 未完成，scoring/coach 加载配置时会得到字面量 `{SKILLS_ROOT}/...`，path 解析失败。两任务必须同阶段实施并同时验收。

**风险**：分步实施会导致 coach 功能损坏。

**复核**：第 1 轮质疑 4 仍有效，实施 Phase 2 时须将 T-XPLAT-2 与 T-XPLAT-3 放在同一 PR/提交中。

---

#### 2.6 T-XPLAT-8 可操作文件边界（第 1 轮质疑 5）

**质疑**：TASKS 列了 bmad-speckit-integration-TASKS.md 与 bmad-bug-assistant技能位置说明.md，排除项未明确写 prd.*.json、progress.*.txt。实施者可能误改这些文件。

**风险**：prd/progress 为 ralph-method 产出，修改路径可能破坏工作流。

**复核**：第 1 轮质疑 5 仍有效，建议在 TASKS T-XPLAT-8 中补一句：「排除：prd.*.json、progress.*.txt、AUDIT_*.md、DEBATE_*.md」。

---

#### 2.7 ralph-method 追踪文件（第 1 轮质疑 7）

**质疑**：Phase 1 已执行 T-SYNC-2、T-SYNC-3，但 `_orphan` 下仍无 `prd.TASKS_installation-improvement.json`、`progress.TASKS_installation-improvement.txt`。按 speckit-workflow，执行 tasks 前应创建，每完成 US 应更新。

**风险**：若后续 16 任务执行时仍未创建，将违反 §5 审计要求。

**复核**：第 1 轮质疑 7 仍有效。建议在进入 Phase 2 前补建 prd/progress，并在 progress 中记录「Phase 1 T-SYNC-2、T-SYNC-3 已于 2026-03-05 完成」。

---

#### 2.8 T-QUICKSTART-1 与 T-INSTALL-2 依赖（第 1 轮质疑 6）

**质疑**：T-QUICKSTART-1 依赖 setup.ps1。若 Phase 5 实施时 T-INSTALL-2 未完成，QUICKSTART 会引用不存在的脚本。执行顺序已明确（Phase 3→5），但需在进度跟踪中强制校验。

**复核**：第 1 轮质疑 6 仍有效，属执行顺序约束，无需修改 TASKS。

---

#### 2.9 T-INSTALL-3 的 code-review 技能名（第 1 轮质疑 9）

**质疑**：skills/ 下存在 `code-review/` 目录，与 T-INSTALL-3 的 `$REQUIRED_SKILLS` 中的 `code-review` 一致。第 1 轮质疑 9 可闭环。

**复核**：项目内技能名为 `code-review`，无 requesting-code-review 歧义。质疑 9 可标为已澄清。✅

---

#### 2.10 验收命令环境假设（第 1 轮质疑 10）

**质疑**：验收命令使用 `D:\Dev\test-project`、`D:\Dev\new-project`，在 macOS/Linux/CI 中不可直接复现。属文档完善项，非实施阻塞。

**复核**：第 1 轮质疑 10 仍有效，建议在 TASKS 末尾补充「验收可选：使用 `$env:TEMP\test-project` 或 `mktemp -d`」。

---

### 【批判审计员】本轮新发现的潜在风险

**风险 A**：Phase 1 仅补齐了 speckit 命令，未补齐 commands/ 下的 bmad-* 等命令。TASKS T-SYNC-2 仅要求 speckit 9 个，与「commands/ 全量同步」不同。若未来有「commands/ 全量 → .cursor/commands/」的需求，需单独任务。

**风险 B**：config 与 .cursor/agents 的 code-reviewer-config 现已一致，但 init-to-root.js（T-SYNC-1）实施后，会对**目标项目**的 config/ 复制后再同步到 .cursor/agents/。当前是**源仓库**内两者一致；目标项目侧的逻辑将在 T-INSTALL-1 中实现，需确保「先复制 config/ 到目标，再执行 .cursor 同步」的顺序正确。

---

## 三、剩余 16 任务状态复核

| 任务 | 状态 | 备注 |
|------|------|------|
| T-INSTALL-1 | 未实施 | 合入 T-SYNC-1 |
| T-INSTALL-2 | 未实施 | 依赖 T-INSTALL-1 |
| T-INSTALL-3 | 未实施 | 归属 T-INSTALL-2 |
| T-INSTALL-4 | 未实施 | 归属 T-INSTALL-2 |
| T-INSTALL-5 | 未实施 | 依赖 T-INSTALL-2 |
| T-SYNC-1 | 未实施 | 合入 T-INSTALL-1 |
| T-SYNC-2 | ✅ **已实施** | Phase 1 验证通过 |
| T-SYNC-3 | ✅ **已实施** | Phase 1 验证通过 |
| T-QUICKSTART-1 | 未实施 | Phase 5 |
| T-XPLAT-1～8 | 未实施 | Phase 2/4 |
| T-README-1 | 未实施 | Phase 5 |
| T-README-2 | 未实施 | Phase 5 |

---

## 四、第 1 轮 10 条质疑复核结论

| 质疑 | 状态 | 说明 |
|------|------|------|
| 1. Phase 1 未执行 | ✅ 已闭环 | Phase 1 已实施并验证通过 |
| 2. setup:full 参数 | ⚠️ 未决 | 待 T-INSTALL-2 实施时澄清 |
| 3. T-INSTALL-4 vs §3.6 | ⚠️ 未决 | 验证清单不一致，待统一 |
| 4. T-XPLAT-2/3 原子性 | ⚠️ 未决 | 实施时须同提交 |
| 5. T-XPLAT-8 边界 | ⚠️ 未决 | 建议 TASKS 补充排除清单 |
| 6. T-QUICKSTART 依赖 | ⚠️ 未决 | 执行顺序约束，已明确 |
| 7. ralph-method 缺失 | ⚠️ 未决 | 建议 Phase 2 前创建 |
| 8. package.json files | ⚠️ 未决 | 待 T-INSTALL-5 实施时评估 |
| 9. code-review 技能名 | ✅ 已澄清 | 项目内为 code-review |
| 10. 验收环境假设 | ⚠️ 未决 | 文档完善建议 |

---

## 五、本轮 Gap 分析

### 本轮是否存在新 gap？

**结论：第 2 轮无新 gap**

- Phase 1（T-SYNC-2、T-SYNC-3）实施正确，文件存在、内容一致、结构完整。
- 行数 204 vs TASKS 211 为文档偏差，实质验收已满足，不视为新 gap。
- 第 1 轮已知的 16 个未实施任务及 8 条未决质疑仍存在，但非本轮新发现。
- 批判审计员本轮提出的「风险 A」「风险 B」属前瞻性提醒，非实施缺陷。

---

## 六、结论与收敛状态

### 结论

| 维度 | 结论 |
|------|------|
| Phase 1（T-SYNC-2、T-SYNC-3） | **完全覆盖、验证通过** ✅ |
| 全量 18 任务 | **未完全覆盖、验证未通过**（剩余 16 任务未实施） |
| 本轮新 gap | **无** |
| 收敛条件 | 需**连续 3 轮无新 gap** |

### 收敛状态

- **第 1 轮**：发现 gap，已修复 Phase 1。
- **第 2 轮**：Phase 1 验证通过，**第 2 轮无新 gap**。
- **下一轮**：需执行**第 3 轮**审计。若第 3 轮仍无新 gap，则满足「连续 3 轮无新 gap」，可宣布本轮审计收敛。

### 第 3 轮审计建议重点

1. 若实施 Phase 2（T-INSTALL-1、T-XPLAT-2、T-XPLAT-3）：验证 init-to-root.js `--full` 与 .cursor 同步、coach-trigger 与 config.ts 的 `{SKILLS_ROOT}` 展开。
2. 若未实施新任务：复核 ralph-method 是否已创建、第 1 轮未决质疑是否有更新。
3. 持续跟踪：T-INSTALL-4 与 §3.6 清单统一、setup:full 参数澄清、T-XPLAT-8 排除清单补充。
