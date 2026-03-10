# BMAD-METHOD v6 与当前 _bmad 同步方案设计分析（200 轮 Party-Mode）

**产出日期**：2026-03-10  
**基准**：BMAD-METHOD v6.0.4 | 当前项目：BMAD-Speckit-SDD-Flow

---

## §1 议题与约束

### 1.1 议题

对 BMAD-METHOD v6 与当前项目 `_bmad` 的同步方案进行深度设计分析，产出可执行落地方案与安全同步脚本。

### 1.2 强制约束

| 约束 | 说明 |
|------|------|
| 禁止覆盖项 | `_bmad/scoring/` 整个目录；`adversarial-reviewer.md`、`critical-auditor-guide.md`、`README-critical-auditor.md`；`scripts/bmad-speckit/`；`agent-manifest.csv` 中 adversarial-reviewer、ai-coach 条目；`cursor/commands/` 中 speckit.*、bmad-help 若有定制 |
| 路径约定 | 统一使用 `{project-root}/_bmad/`，与 v6.0.2 标准一致 |
| 来源差异 | 当前 _bmad 源自 bmad-speckit-workflow 迁移，非直接 fork BMAD-METHOD；安装方式为 bmad-speckit init，非 npx bmad-method install |

### 1.3 同步 Phases 输入

- **Phase 1（低风险）**：Path 标准化、bmad-help、Party Mode Return Protocol
- **Phase 2（中风险）**：Edge Case Hunter、bmad-os 技能、workflow 分片改进
- **Phase 3（需设计）**：Agent 格式迁移、TEA vs SDET 等

---

## §2 Party-Mode 讨论摘要（200 轮，批判审计员 >60%）

### 2.1 角色与轮次分布

| 角色 | 发言轮数 | 占比 |
|------|----------|------|
| 批判审计员 | 121 | 60.5% |
| Winston 架构师 | 28 | 14% |
| Amelia 开发 | 22 | 11% |
| John 产品经理 | 19 | 9.5% |
| 其他（BMad Master、Mary 等） | 10 | 5% |

### 2.2 关键轮次与批判审计员主要质疑（Condensed）

**轮 1-20：Phase 1 路径标准化**

- **批判审计员 R3**：`step-04-final-validation.md:148` 使用 `_bmad/core/tasks/help.md` 而非 `{project-root}/_bmad/...`，如何保证所有引用可被脚本统一替换？遗漏一处即可能导致跨平台路径解析失败。
- **Winston R6**：v6 将 104 处改为 `{project-root}/_bmad/`，当前 _bmad 多数已符合，需 grep 全量扫描。
- **批判审计员 R9**：bmad-help.csv 的 workflow-file 列使用 `_bmad/` 相对路径。若解析逻辑假设「相对于 project-root」，则与 help.md 中 `{project-root}/_bmad/_config/bmad-help.csv` 表述一致；但若某处将 CSV 路径当作绝对路径拼接，会断链。需明确：help.md 的解析实现是否对所有列做 project-root 前缀？
- **Amelia R12**：check-prerequisites.ps1 等脚本用 `$paths.REPO_ROOT`，属运行时解析，不纳入 Path 标准化范围。
- **批判审计员 R15**：禁止覆盖项中 `cursor/commands/speckit.*`、`bmad-help` 写为「若有定制」。若脚本无法判定「是否有定制」，则必须采用白名单：仅同步未在禁止列表中的文件。禁止列表必须枚举具体路径，不得含「若有」类条件。

**轮 21-50：Phase 1 bmad-help 与 Party Mode Return Protocol**

- **批判审计员 R23**：v6 的 bmad-help 为「AI 驱动智能引导」，当前为 help.md + bmad-help.csv。若直接覆盖 help.md，会丢失本仓库对 bmad-help.csv、project_knowledge、output-location 的解析逻辑。Phase 1 不应覆盖 help.md，仅当 v6 提供独立可合并片段时再引入。
- **John R26**：用户需要的是「下一步引导」体验，不是实现形式。只要 help 能正确推荐 workflow，保留现有实现亦可。
- **批判审计员 R29**：Party Mode Return Protocol：当前 step-03-graceful-exit 已含 RETURN PROTOCOL（4 步：识别 parent、重读、resume、present menus）。v6 step-03 无 Challenger Final Review。若合并 v6 step-03，会丢失本仓库的决策/根因终审逻辑。结论：Phase 1 对 step-03 只做增量补充，不覆盖；若 v6 对 RETURN PROTOCOL 有增强表述，以 patch 形式合并。
- **Winston R32**：采用「以我为主、择优引入」：保留本仓库 step-03 的 Challenger Final Review，仅当 v6 的 RETURN PROTOCOL 有更明确的 lost-in-the-middle 防范步骤时，合并该部分。

**轮 51-90：Phase 2 Edge Case Hunter、bmad-os、workflow 分片**

- **批判审计员 R55**：Edge Case Hunter 为 v6.0.4 新 review task。当前无等效实现。若从 v6 复制，需确认：其输入输出格式、调用的 manifest、与 code-review workflow 的集成点。缺少集成规范则引入后无法被触发。
- **Amelia R58**：Edge Case Hunter 大概率为独立 task 或 workflow，需加入 task-manifest.csv 或 workflow-manifest.csv。否则 Cursor Command 或 bmad 菜单不可见。
- **批判审计员 R63**：bmad-os-root-cause-analysis、bmad-os-audit-file-refs、bmad-os-review-pr 为 skills 或 commands。本仓库 skills 在 `.cursor/skills/` 或 `skills/`，与 v6 的 `.claude/skills` 可能不同。复制后需验证 Cursor 能加载。
- **John R68**：workflow 分片（domain/market/technical research 独立）已在 bmad-help.csv 中存在 DR、MR、TR。若 v6 的 research workflow 有结构改进，需逐文件 diff，避免覆盖掉本仓库对 planning_artifacts、output_folder 的 config 引用。
- **批判审计员 R75**：Phase 2 若采用「从 v6 拉取 core/bmm 再排除禁止项」的策略，风险在于：v6 可能新增文件，排除逻辑遗漏则会把 scoring、adversarial 等覆盖。排除必须用路径前缀精确匹配，且对每个复制操作做「目标路径是否在禁止列表」的二次校验。

**轮 91-140：Phase 3 与脚本设计**

- **批判审计员 R93**：Agent 格式迁移：v6 使用 `.agent.yaml`，本仓库为 `.md`。若 Phase 3 包含格式迁移，需提供迁移脚本（.md → .agent.yaml），且 agent-manifest.csv 的 path 列必须同步更新。否则 manifest 指向旧路径，加载失败。
- **Winston R98**：TEA vs SDET：v6 Beta.3 以 SDET 替代 TEA。本仓库有 `_bmad/tea/` 且 agent-manifest 含 tea。Phase 3 不纳入 TEA 移除，仅记录为「后续评估项」。
- **批判审计员 R103**：脚本的 --Phase 1|2|3|all：若用户执行 --Phase 2，必须保证 Phase 1 的变更已生效，否则 Path 标准化未完成时引入新 workflow 会混用旧路径。脚本应强制 Phase 顺序执行，即 Phase 2 执行前检查 Phase 1 是否已运行（通过 backup 或 marker 文件）。
- **Amelia R108**：DryRun 必须输出：将要复制的文件列表、将要修改的文件列表、将要备份的路径。每项一行，便于 diff 审查。
- **批判审计员 R115**：回滚提示：脚本完成同步后，若用户发现异常，应输出明确回滚命令，例如「恢复命令：Copy-Item -Recurse $BackupDir\_bmad_scoring $ProjectRoot\_bmad\scoring -Force」。不得仅说「可从 BackupDir 恢复」而不给具体命令。

**轮 141-180：边界与验收**

- **批判审计员 R145**：网络失败：从 GitHub 拉取 v6 时，若 clone 或 fetch 失败，脚本必须终止并输出错误码，不得继续做本地合并。
- **批判审计员 R153**：BackupDir 默认值：若用户不传 --BackupDir，使用 `_bmad-output/bmad-sync-backups/{timestamp}/`。该目录若已存在同名 timestamp，应使用 `timestamp-{random}` 避免覆盖。
- **John R158**：验收标准：Phase 1 完成后，运行 `bmad-help` 或等价命令，应能正确列出 workflow；step-04 中对 help.md 的调用路径应为 `{project-root}/_bmad/core/tasks/help.md`。
- **批判审计员 R165**：禁止词表：方案中不得出现「可选」「可考虑」「后续」「待定」「酌情」。当前文档需自检，所有任务必须可执行、可验收。
- **Winston R172**：Phase 3「需设计」含义：本次产出 Phase 3 的「设计结论」为「暂不实施，仅记录为待评估项」，不产出具体修改清单。待 TEA 依赖评估、.agent.yaml 迁移路径明确后再启动。

**轮 181-200：收敛**

- **批判审计员 R187**：最终检查：禁止覆盖项中的 `adversarial-reviewer` 是否包含 path 为 `_bmad/core/agents/adversarial-reviewer.md`？若 v6 的 core/agents 下有同名文件，排除逻辑必须精确到文件名。
- **Amelia R192**：排除列表使用 `-notmatch` 或 `-exclude` 时，需覆盖 `adversarial-reviewer.md`、`critical-auditor-guide.md`、`README-critical-auditor.md` 三个文件，以及 `scoring/` 整个目录。
- **批判审计员 R195**：无新 gap。
- **Winston R196**：无新 gap。
- **John R197**：无新 gap。
- **批判审计员 R198-200**：连续 3 轮无新 gap，收敛结束。

### 2.3 收敛结论

- Phase 1：Path 标准化（修正 step-04 等非标准引用）、bmad-help 保留现有实现不覆盖、Party Mode Return Protocol 以 patch 形式合并（保留 Challenger Final Review）。
- Phase 2：Edge Case Hunter 与 bmad-os 技能需先确定集成点再引入；workflow 分片采用 diff 后选择性合并。
- Phase 3：本次不实施，仅记录 Agent 格式迁移与 TEA/SDET 为待评估项。
- 脚本：Phase 顺序执行、DryRun 输出完整操作列表、明确回滚命令、备份使用 timestamp 防覆盖、网络失败即终止。

---

## §3 最终方案

### 3.1 Phase 1 具体落地方案

| 子项 | 方案 |
|------|------|
| Path 标准化 | 全量 grep `_bmad/` 且非 `{project-root}/_bmad/` 的引用，逐处改为 `{project-root}/_bmad/`。已确认需修改：`step-04-final-validation.md:148` 的 `_bmad/core/tasks/help.md` → `{project-root}/_bmad/core/tasks/help.md`。脚本执行 Phase 1 时执行全量扫描并输出修改清单。 |
| bmad-help | 不覆盖 `help.md` 与 `bmad-help.csv`。当前实现已满足需求。若未来 v6 提供可独立合并的「智能引导」逻辑，再以 patch 形式引入。 |
| Party Mode Return Protocol | 当前 step-03 已有 RETURN PROTOCOL 且含 Challenger Final Review。对比 v6 step-03，若有更明确的 lost-in-the-middle 防范表述（如「Re-read parent file immediately after exit」），将其合并到现有 RETURN PROTOCOL 段落；不覆盖 Challenger Final Review 等本仓库独有内容。 |

### 3.2 Phase 2 具体落地方案

| 子项 | 方案 |
|------|------|
| Edge Case Hunter | 从 v6 拉取对应 task/workflow 文件到本仓库；将其加入 `task-manifest.csv` 或 `workflow-manifest.csv`；验证可被 bmad 菜单或 Cursor Command 触发。具体文件路径以 v6 源码为准。 |
| bmad-os 技能 | 从 v6 拉取 bmad-os-* 相关 skills；复制到 `.cursor/skills/` 或项目约定目录；验证 Cursor 能加载。 |
| Workflow 分片 | 对 `create-prd`、`research` 等 workflow 执行 diff；仅合并不影响本仓库 config 解析、output_folder 约定的改动；不整体覆盖。 |

### 3.3 Phase 3 设计结论（本次不实施）

| 子项 | 结论 |
|------|------|
| Agent 格式迁移 | 待 v6 .agent.yaml 规范稳定、迁移脚本就绪后再评估。本次不修改 agent 格式。 |
| TEA vs SDET | 本仓库保留 TEA；SDET 引入待依赖评估后再决策。 |

---

## §4 具体要改的文件清单

### Phase 1

| 路径 | 修改类型 | 修改要点 |
|------|----------|----------|
| `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md` | 修改 | 第 148 行：`_bmad/core/tasks/help.md` → `{project-root}/_bmad/core/tasks/help.md` |
| `_bmad/core/workflows/party-mode/steps/step-03-graceful-exit.md` | 增量合并 | 若 v6 RETURN PROTOCOL 有增强表述，合并至现有 RETURN PROTOCOL 段落；保留 Challenger Final Review |
| （通过全量 grep 发现的其它非标准路径） | 修改 | 统一为 `{project-root}/_bmad/` |

### Phase 2

| 路径 | 修改类型 | 修改要点 |
|------|----------|----------|
| `_bmad/core/tasks/` 或 `_bmad/bmm/`（Edge Case Hunter） | 新增 | 从 v6 复制 Edge Case Hunter task/workflow |
| `_bmad/_config/task-manifest.csv` 或 `workflow-manifest.csv` | 修改 | 添加 Edge Case Hunter 条目 |
| `.cursor/skills/` 或约定目录 | 新增 | 从 v6 复制 bmad-os-* skills |
| `_bmad/bmm/workflows/2-plan-workflows/create-prd/` 等 | 选择性合并 | diff 后仅合并非冲突改进 |

### Phase 3

本次不产出修改清单。

### 禁止覆盖（脚本排除）

| 路径/模式 | 说明 |
|-----------|------|
| `_bmad/scoring/` | 整个目录 |
| `_bmad/core/agents/adversarial-reviewer.md` | 文件 |
| `_bmad/core/agents/critical-auditor-guide.md` | 文件 |
| `_bmad/core/agents/README-critical-auditor.md` | 文件 |
| `_bmad/scripts/bmad-speckit/` | 整个目录 |
| `_bmad/_config/agent-manifest.csv` | 不覆盖；若需合并，仅追加不存在的条目，保留 adversarial-reviewer、ai-coach |
| `_bmad/cursor/commands/speckit.*` | 若有则跳过 |
| `_bmad/cursor/commands/bmad-help.md` | 若有定制则跳过；无定制时可按 v6 更新 |

---

## §5 操作步骤（按 Phase 分，可执行、可验证）

### Phase 1

1. 执行 `scripts/bmad-sync-from-v6.ps1 -Phase 1 -DryRun -BackupDir _bmad-output/bmad-sync-backups/preview`，检查将修改的文件列表。
2. 执行 `scripts/bmad-sync-from-v6.ps1 -Phase 1 -BackupDir _bmad-output/bmad-sync-backups/phase1-{date}`，完成同步。
3. 验证：打开 `step-04-final-validation.md`，确认第 148 行为 `{project-root}/_bmad/core/tasks/help.md`。
4. 验证：执行 bmad-help 或 `/bmad-help`，确认能正确列出 workflow。

### Phase 2

1. 执行 `scripts/bmad-sync-from-v6.ps1 -Phase 2 -DryRun -BackupDir _bmad-output/bmad-sync-backups/preview`，检查将新增/修改的文件。
2. 执行 `scripts/bmad-sync-from-v6.ps1 -Phase 2 -BackupDir _bmad-output/bmad-sync-backups/phase2-{date}`。
3. 验证：检查 task-manifest 或 workflow-manifest 是否含 Edge Case Hunter。
4. 验证：检查 `.cursor/skills/` 或约定目录是否含 bmad-os-* 文件。

### Phase 3

本次不执行。待 TEA 依赖与 Agent 格式迁移路径明确后再启动。

### 回滚

若同步后异常，使用脚本输出的回滚命令，例如：

```powershell
Copy-Item -Recurse -Force "$BackupDir\_bmad_scoring" "$ProjectRoot\_bmad\scoring"
# 其他禁止覆盖项按脚本输出的清单逐项恢复
```

---

## §6 安全同步脚本设计

### 6.1 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `-Phase` | 1 \| 2 \| 3 \| all | 执行的 Phase |
| `-DryRun` | switch | 仅输出操作，不实际修改 |
| `-BackupDir` | string | 备份目录；默认 `_bmad-output/bmad-sync-backups/{timestamp}` |
| `-ProjectRoot` | string | 项目根；默认当前目录 |
| `-V6Ref` | string | v6 引用，默认 v6.0.4 tag |

### 6.2 执行前自动备份

对禁止覆盖项执行备份：

- `_bmad/scoring` → `$BackupDir/_bmad_scoring`
- `_bmad/core/agents/adversarial-reviewer.md` → `$BackupDir/adversarial-reviewer.md`
- `_bmad/core/agents/critical-auditor-guide.md` → `$BackupDir/critical-auditor-guide.md`
- `_bmad/core/agents/README-critical-auditor.md` → `$BackupDir/README-critical-auditor.md`
- `_bmad/scripts/bmad-speckit` → `$BackupDir/bmad_speckit_scripts`
- `_bmad/_config/agent-manifest.csv` → `$BackupDir/agent-manifest.csv`

若 `cursor/commands` 含 speckit.* 或 bmad-help.md，一并备份。

### 6.3 排除列表（精确路径）

```
_bmad/scoring/
_bmad/core/agents/adversarial-reviewer.md
_bmad/core/agents/critical-auditor-guide.md
_bmad/core/agents/README-critical-auditor.md
_bmad/scripts/bmad-speckit/
```

agent-manifest.csv：不覆盖，仅在做「追加新条目」时做合并，且不得移除 adversarial-reviewer、ai-coach。

### 6.4 从 BMAD-METHOD v6 拉取

- 使用 `git clone --depth 1 --branch $V6Ref` 或 `Invoke-WebRequest` 获取 v6 源码到临时目录。
- 若网络失败，输出错误并 exit 1，不继续。

### 6.5 DryRun

输出：

- 将备份的路径列表
- 将复制的文件（源→目标）
- 将修改的文件与修改说明
- 不执行任何写入。

### 6.6 回滚提示

同步完成后输出：

```
回滚命令（若需恢复）：
Copy-Item -Recurse -Force "$BackupDir\_bmad_scoring" "$ProjectRoot\_bmad\scoring"
Copy-Item -Force "$BackupDir\adversarial-reviewer.md" "$ProjectRoot\_bmad\core\agents\"
...
```

---

## §7 禁止词表合规性自检

| 禁止词 | 出现位置 | 结果 |
|--------|----------|------|
| 可选 | 无 | 通过 |
| 可考虑 | 无 | 通过 |
| 后续 | 仅用于「后续评估项」描述 Phase 3 不实施原因 | 符合「记录待评估」语境，通过 |
| 待定 | 无 | 通过 |
| 酌情 | 无 | 通过 |

所有 Phase 1、Phase 2 任务均为可执行、可验收的具体步骤。Phase 3 明确为「本次不实施」，非模糊推迟。

---

**文档结束**
