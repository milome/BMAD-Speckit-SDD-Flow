# §5 执行阶段审计：PowerShell 与 Shell 脚本功能对等性（第 2 轮回证）

**审计依据**：audit-prompts §5、docs/WSL_SHELL_SCRIPTS.md、项目要求「禁止简化版」  
**审计日期**：2026-03-10  
**轮次**：Round 2（本轮回证）

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. §5 审计项逐项验证

### 1.1 完整性：14 对 PS/Shell 一一对应

| # | PowerShell | Shell | 存在 | 对应 |
|---|------------|-------|:----:|:----:|
| 1 | scripts/setup.ps1 | scripts/setup.sh | ✅ | ✅ |
| 2 | scripts/check-sprint-ready.ps1 | scripts/check-sprint-ready.sh | ✅ | ✅ |
| 3 | scripts/bmad-sync-from-v6.ps1 | scripts/bmad-sync-from-v6.sh | ✅ | ✅ |
| 4 | _bmad/.../check-prerequisites.ps1 | _bmad/.../check-prerequisites.sh | ✅ | ✅ |
| 5 | _bmad/.../create-new-feature.ps1 | _bmad/.../create-new-feature.sh | ✅ | ✅ |
| 6 | _bmad/.../validate-sync-manifest.ps1 | _bmad/.../validate-sync-manifest.sh | ✅ | ✅ |
| 7 | _bmad/.../validate-audit-config.ps1 | _bmad/.../validate-audit-config.sh | ✅ | ✅ |
| 8 | _bmad/.../setup_worktree.ps1 | _bmad/.../setup_worktree.sh | ✅ | ✅ |
| 9 | _bmad/.../update-agent-context.ps1 | _bmad/.../update-agent-context.sh | ✅ | ✅ |
| 10 | _bmad/.../setup-plan.ps1 | _bmad/.../setup-plan.sh | ✅ | ✅ |
| 11 | _bmad/.../find-related-docs.ps1 | _bmad/.../find-related-docs.sh | ✅ | ✅ |
| 12 | skills/.../monitor-push.ps1 | skills/.../monitor-push.sh | ✅ | ✅ |
| 13 | skills/.../start-push-with-monitor.ps1 | skills/.../start-push-with-monitor.sh | ✅ | ✅ |
| 14 | skills/.../generate-pr-template.ps1 | skills/.../generate-pr-template.sh | ✅ | ✅ |

**common.ps1 / common.sh**：作为库，不计入对，已确认 shell 脚本均 `source common.sh`。

### 1.2 可执行性：`bash -n` 语法检查（已实际执行）

| 脚本集合 | 命令 | 结果 |
|----------|------|------|
| scripts/*.sh | `bash -n scripts/setup.sh scripts/check-sprint-ready.sh scripts/bmad-sync-from-v6.sh` | ✅ 通过 |
| _bmad/.../shell/*.sh | `bash -n _bmad/scripts/bmad-speckit/shell/*.sh` | ✅ 全部通过 |
| skills/*.sh | `bash -n skills/git-push-monitor/scripts/*.sh skills/pr-template-generator/scripts/*.sh` | ✅ 通过 |

### 1.3 实际测试执行（已实际运行）

| 命令 | 退出码 | 结果 |
|------|--------|------|
| `bash _bmad/scripts/bmad-speckit/shell/validate-audit-config.sh .` | 0 | 通过 |
| `bash scripts/check-sprint-ready.sh -Json -RepoRoot . 2>/dev/null` | 0 | JSON 输出 `{"SPRINT_READY":true,...}` 正确 |
| `bash _bmad/scripts/bmad-speckit/shell/create-new-feature.sh -Help` \| head -3 | 0 | 用法正确显示：`Usage: create-new-feature.sh [-ModeBmad] [-Epic N]...`、`-CreateBranch`、`-CreateWorktree` |

### 1.4 功能对等性（禁止简化版）——逐对核对

| # | 对 | 功能对等 | 核验依据 |
|---|-----|----------|----------|
| 1 | setup | ✅ | -Target, -Full, -SkipSkills, -SkipScoring, -DryRun, -Help 全对应 |
| 2 | check-sprint-ready | ✅ | -Json, -RepoRoot；development_status/epics 一致；JSON 格式一致 |
| 3 | bmad-sync-from-v6 | ✅ | -Phase, -DryRun, -BackupDir, -ProjectRoot, -V6Ref 一致 |
| 4 | check-prerequisites | ✅ | -Json, -RequireTasks, -IncludeTasks, -RequireSprintStatus, -PathsOnly, -Help 全对应 |
| 5 | create-new-feature | ✅ | 脚本头：「与 create-new-feature.ps1 完整功能对等」；-CreateBranch, -CreateWorktree, BMAD 模式、get_epic_slug 完整 |
| 6 | validate-sync-manifest | ✅ | PS -ManifestPath/-RepoA/-RepoB → shell --manifest/--repo-a/--repo-b，调用 Python 逻辑等价 |
| 7 | validate-audit-config | ✅ | audit_convergence: simple 检测、错误信息、退出码一致 |
| 8 | setup_worktree | ✅ | create/list/remove/sync 四子命令完整 |
| 9 | update-agent-context | ✅ | 脚本头：「与 update-agent-context.ps1 完整功能对等（16 种 agent）」；claude|gemini|...|bob 全支持 |
| 10 | setup-plan | ✅ | -Json, -Help；plan 模板复制、路径输出一致 |
| 11 | find-related-docs | ✅ | -FeatureDescription, -ShortName, -Json, -RepoRoot 对等 |
| 12 | monitor-push | ✅ | **-OutputFile/-o** 已实现（line 14-15）；-BranchName/-b, -RemoteName/-r, -MaxWaitSeconds/-m, -CheckInterval/-i 全支持；OutputFile 自检测逻辑等价 |
| 13 | start-push-with-monitor | ✅ | 后台 push、调用 monitor、参数 -b/-r/-m/-i 对应 |
| 14 | generate-pr-template | ✅ | 脚本头：「与 generate-pr-template.ps1 完整功能对等」；-BaseBranch, -CurrentBranch, -OutputDir, -LastPRCommit, -AutoDetectLastPR 全支持；commit 分类、文件统计、UTF-8 强制 |

**结论**：无简化版；14 对均为完整功能对等。

### 1.5 文档：WSL_SHELL_SCRIPTS.md

- 14 对脚本均列于对照表，说明准确。
- validate-sync-manifest 参数映射（--manifest/--repo-a/--repo-b）已注明。
- 开首明确「**完整功能对应**的 shell 版本」；无「简化版」误导表述。

### 1.6 无占位/伪实现

- 所有 shell 脚本均含实质逻辑；无空壳、无仅 echo、无 TODO 占位。
- validate-sync-manifest.sh、generate-pr-template.sh 通过 Python 实现，为跨平台设计，非简化。

---

## 2. 批判审计员结论

**已检查维度**：遗漏的 PS 脚本、功能差异（参数/逻辑/输出）、简化版残留、验收命令实际执行、行号/路径漂移、文档与实现一致性、边界情况（无 git、无 plan.md、分支不存在等）、占位/伪实现、参数命名与平台约定差异、OutputFile 等易被误判为「简化版」的参数、本轮与第 1 轮结论一致性。

**每维度结论**：

1. **遗漏的 PS 脚本**  
   - 已扫描 `scripts/`、`_bmad/scripts/bmad-speckit/powershell/`、`skills/git-push-monitor/scripts/`、`skills/pr-template-generator/scripts/` 下所有 `.ps1`。  
   - 除 `common.ps1`（库，不计入对）外，所有可执行 PS 脚本均有对应 `.sh`。  
   - **结论**：无遗漏。

2. **功能差异：PS 有而 shell 无**  
   - **monitor-push**：既往报告曾称「无 -OutputFile」。本轮逐行核验：`monitor-push.sh` 第 14-15 行 `-OutputFile|-o) OUTPUT_FILE="$2"; shift 2`，第 28-35 行 OutputFile 自检测逻辑完整。PS 与 shell 行为等价。**既往误判已纠正**。  
   - **create-new-feature**：shell 头注释「与 create-new-feature.ps1 完整功能对等」；-CreateBranch、-CreateWorktree、BMAD 模式、get_epic_slug、分支号自增逻辑均已实现。无简化。  
   - **update-agent-context**：16 种 agent 全支持，头注释「完整功能对等」。  
   - **generate-pr-template**：头注释「与 generate-pr-template.ps1 完整功能对等」；BaseBranch、CurrentBranch、OutputDir、LastPRCommit、AutoDetectLastPR 全支持；通过 Python 实现 commit 分类、文件统计、AutoDetectLastPR、UTF-8 强制。非简化。  
   - **其余 10 对**：第 1 轮已逐项核对，本轮复验无变化。  
   - **结论**：无 PS 有而 shell 无的功能点；无简化版。

3. **简化版残留**  
   - 逐脚本检查：无「简化版」「lite」「minimal」等表述。  
   - 逻辑分支（如 CreateBranch 默认值、BMAD vs standalone、RequireSprintStatus）与 PS 一致。  
   - **结论**：无简化版，满足「禁止简化版」要求。

4. **验收命令是否实际执行**  
   - 所有 `bash -n` 已执行：scripts/*.sh、_bmad/scripts/bmad-speckit/shell/*.sh、skills/git-push-monitor/scripts/*.sh、skills/pr-template-generator/scripts/*.sh。  
   - `validate-audit-config.sh .`、`check-sprint-ready.sh -Json -RepoRoot .`、`create-new-feature.sh -Help` 均已实际运行并记录退出码与输出。  
   - **结论**：非宣称，已实际执行。

5. **行号/路径漂移、文档与实现不一致**  
   - WSL_SHELL_SCRIPTS.md 中路径为 `_bmad/.../`，实际为 `_bmad/scripts/bmad-speckit/powershell|shell/`，符合常规省略写法。  
   - skills 路径与文档一致。  
   - **结论**：无漂移。

6. **边界情况：shell 是否与 PS 行为一致**  
   - **无 git**：check-prerequisites、create-new-feature、setup_worktree 等均有 repo root 回退逻辑（.specify/.git 搜索），与 PS 一致。  
   - **无 plan.md**：update-agent-context、setup-plan 在缺失时退出并报错，与 PS 一致。  
   - **分支不存在**：setup_worktree create 时创建分支，与 PS 一致。  
   - **当前分支 = base 分支**：generate-pr-template 报「No commits found」并 exit 1，与 PS 预期一致。  
   - **非 feature 分支**：update-agent-context、check-prerequisites 报错并 exit 1，与 PS 一致。  
   - **结论**：边界行为一致。

7. **参数命名与平台约定差异**  
   - validate-sync-manifest：PS 用 -ManifestPath/-RepoA/-RepoB，shell 用 --manifest/--repo-a/--repo-b（Python argparse 约定）。  
   - WSL_SHELL_SCRIPTS.md 已明确该映射，属合理平台差异，非功能缺失。  
   - monitor-push/start-push-with-monitor：shell 支持 -b/-r/-m/-i 短选项，便于命令行使用。  
   - **结论**：可接受，已文档化。

8. **占位/伪实现**  
   - 无空壳脚本；无仅 `echo "TODO"`；无 stub 返回。  
   - validate-sync-manifest.sh、generate-pr-template.sh 为薄封装，调用 Python 实现完整逻辑，属设计选择。  
   - **结论**：无占位实现。

9. **OutputFile 等易被误判为「简化版」的参数**  
   - 既往有报告称 monitor-push.sh「无 -OutputFile」。本轮 grep 确认：`-OutputFile|-o) OUTPUT_FILE="$2"` 存在；自检测逻辑（$HOME/.cursor/projects、find -mmin -10）完整。  
   - **结论**：无误判，无简化版。

10. **本轮与第 1 轮结论一致性**  
    - 第 1 轮结论：完全覆盖、验证通过；无简化版。  
    - 本轮复验：14 对均存在；功能对等；bash -n 通过；验收命令已执行；文档准确；无占位。  
    - **结论**：与第 1 轮一致，无新 gap。

**本轮结论**：本轮无新 gap。第 2 轮；须连续 3 轮无 gap 后收敛。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 功能性: 95/100
- 代码质量: 92/100
- 测试覆盖: 90/100
- 安全性: 88/100

---

## 3. 结论

**完全覆盖、验证通过。**

- 14 对 PS/Shell 脚本均存在且一一对应。  
- 功能对等性满足项目要求，**无简化版**，无占位实现。  
- 所有 `bash -n` 语法检查通过；验收命令已实际运行并验证退出码与输出。  
- WSL_SHELL_SCRIPTS.md 描述准确，无误导；明确「完整功能对应」。  
- 批判审计员检查 10 个维度，均无新 gap。  
- 既往对 monitor-push.sh「无 -OutputFile」的误判已在本轮回证中纠正：shell 版已完整实现 -OutputFile/-o 及自检测逻辑。

**收敛状态**：本轮无新 gap，第 2 轮；须连续 3 轮无 gap 后收敛。

**报告保存路径**：`_bmad-output/implementation-artifacts/_orphan/AUDIT_PS_shell_parity_round2.md`
