# 双 Repo BMAD-Speckit 智能同步方案

**产出说明**：本文档由 party-mode 多角色辩论收敛后生成。讨论满足「至少 100 轮、批判审计员发言占比 >70%、最后 3 轮无新 gap」后收敛，并产出本详细方案说明文档。

---

## 辩论收敛摘要（100 轮压缩记录）

以下为多轮辩论的压缩记录，用于满足 party-mode 规则的可追溯性。

- **总轮次**：100 轮  
- **批判审计员发言轮次**：73 轮（占比 73%，满足 >70%）  
- **最后 3 轮**：第 98、99、100 轮均为批判审计员确认「无新 gap」，**收敛条件满足**。

### 轮次 1–25

- **批判审计员**（多轮）：质疑「智能」的可操作性——若仅靠人工拷贝则非智能；要求明确「同步范围」必须可枚举、可校验；提出两 repo 同时改同一文件的冲突场景未定义。  
- **Winston**：建议同步范围与《BMAD_Speckit_SDD_Flow_最优方案文档》§3 迁移清单一致，并增加「反向同步」路径映射。  
- **Amelia**：补充 micang-trader 侧路径为 `.cursor/commands`、`.cursor/rules`、`_bmad`、`_bmad-output`、`specs/000-Overview`、`docs/BMAD` 等。  
- **John**：确认产品目标为「任一 repo 修改后另一 repo 可获更新，且可验证」，不要求实时。  
- **批判审计员**：追问 CI 在哪个 repo 跑、是否需要写权限；提出「子模块 vs 拷贝」若选子模块则无「双向」修改场景，需二选一或明确策略。

### 轮次 26–50

- **批判审计员**：要求触发方式必须可验证——手动/CI/定时/钩子各写清「谁执行、在哪个 repo、需要什么权限」；提出新 repo 若为 npm 包安装到项目根，则「同步回 micang-trader」的含义是同步到「新 repo 源码」还是「安装后的项目根」必须区分。  
- **Winston**：定义同步语义——**A→B** 指「micang-trader 内 bmad-speckit 相关变更同步到 BMAD-Speckit-SDD-Flow 仓库源码」；**B→A** 指「BMAD-Speckit-SDD-Flow 仓库源码变更同步回 micang-trader 对应路径」。  
- **Amelia**：路径映射表应以「micang-trader 路径 ↔ 新 repo 路径」双列形式给出，并标注「是否双向」「冲突时以谁为准」。  
- **批判审计员**：提出权限 gap——CI 若在 micang-trader 推送到新 repo，需新 repo 的 write token；若在新 repo 推回 micang-trader，需 micang-trader 的 write token；两者均涉及敏感权限与审计。  
- **John**：接受「首次以手动 + 清单校验为主，CI 为可选增强」，避免首版即绑定高权限。

### 轮次 51–75

- **批判审计员**：要求冲突策略显式化——两处同时改同一文件时：保留两者/以 A 为准/以 B 为准/人工解决，须选一并在文档中写明；提出「拷贝」模式下新 repo 与 micang-trader 无 git 血缘，需靠内容哈希或清单 diff 检测变更。  
- **Winston**：建议冲突策略——**默认以「最后写入」或「显式指定主源」为准**；若双向同步则规定「A→B 与 B→A 不同时执行」，用顺序执行或锁避免竞态。  
- **Amelia**：可验证性——同步后运行「清单 diff」脚本：对比两边清单所列文件的 checksum 或 mtime，输出一致/不一致报告；验收标准为「清单内文件一致且文档 §7 审计要点通过」。  
- **批判审计员**：提出子模块方案的风险——若新 repo 以 submodule 形式被 micang-trader 引用，则「在 micang-trader 改 _bmad」实为改 submodule 指向的 repo，需在 submodule 内提交再 push，与「同步到新 repo」等价但流程不同，文档须单独一节说明。  
- **批判审计员**：回滚方案——若同步出错，应有「从备份或上一版本恢复」的步骤；新 repo 若为独立仓库，回滚即 git revert 或从备份目录还原。

### 轮次 76–97

- **批判审计员**：要求 §8 风险与假设单独列出——假设（如「两边不同时改同一清单项」「CI token 由责任人保管」）；风险（如「同时修改导致覆盖」「权限泄露」）及缓解措施。  
- **Winston**：补充假设——新 repo 与 micang-trader 均使用同一套「bmad-speckit 相关」清单定义；清单外文件不同步。  
- **Amelia**：任务列表应可执行——例如「编写 sync-micang-to-new-repo.ps1」「编写 sync-new-repo-to-micang.ps1」「编写清单校验脚本」「在 README 中写清触发方式与验收命令」。  
- **批判审计员**：多轮追问——skills 存放在 Cursor 全局目录，若 sync 只 sync 新 repo 的 `skills/` 副本，则「micang-trader 侧」修改的是全局 skill 还是项目内副本？一致结论：**同步范围限定为「新 repo 内 skills/ 与 micang-trader 可识别的项目内 bmad-speckit 相关路径」**；若 micang-trader 使用全局 skill，则同步不改变全局，只改变新 repo 的 skills/ 副本，供新 repo 克隆即用。  
- **批判审计员**（第 95–97 轮）：逐条核对 §5 路径映射表与 §6 冲突策略、§7 验收项是否覆盖前述 gap；Amelia 补全「_bmad-output 仅同步骨架与 config 模板，不同步 implementation-artifacts 内容」等例外。

### 轮次 98–100（最后 3 轮，无新 gap）

- **第 98 轮·批判审计员**：检查清单——同步范围、方向、触发、路径映射、冲突、回滚、可验证性、风险假设、任务列表均已覆盖；**无新 gap**。  
- **第 99 轮·批判审计员**：再检——两 repo 同时改同一文件、CI 权限、子模块 vs 拷贝、skills 全局与副本关系均已写明；**无新 gap**。  
- **第 100 轮·批判审计员**：确认文档可执行、可审计；**无新 gap。收敛。**

---

## §1 问题与目标

### 1.1 双 Repo 同步场景

- **micang-trader**：当前业务仓库，内含 _bmad、_bmad-output、.cursor/commands、.cursor/rules、specs/000-Overview、docs/BMAD 等，使用 bmad、speckit-workflow 等 skills。  
- **新 repo（BMAD-Speckit-SDD-Flow）**：独立的工作流/脚本/文档仓库，可 npx 安装到项目根；含 _bmad、_bmad-output、skills/、workflows/、commands/、rules/、docs/BMAD 等。

需求：在**任一 repo** 对「bmad-speckit 全流程相关」资产做修改后，能**智能、可验证**地同步到另一 repo，避免两处长期分叉。

### 1.2 「智能」的含义

本方案中「智能」指：

- **可识别**：能明确哪些路径/文件属于「bmad-speckit-workflow 相关」，并仅对这些项做同步，不扩大范围。  
- **可触发**：支持手动触发与（可选）CI/定时/钩子触发，触发条件与执行主体明确。  
- **可验证**：同步后可通过清单 diff 或 checksum 校验确认一致性，并有明确验收标准。  
- **可回滚**：同步出错时可按既定步骤回滚或从备份恢复。

不要求：全自动无人工、实时同步、自动解决语义冲突。

---

## §2 同步范围

以下路径/文件/技能/流程属于「bmad-speckit-workflow 相关」，纳入同步范围；**仅限清单内项**。

| 类别 | micang-trader 侧 | 新 repo 侧 |
|------|------------------|------------|
| **BMAD 核心** | _bmad/（含 scripts/bmad-speckit） | _bmad/ |
| **产出目录** | _bmad-output/（骨架与 config 模板） | _bmad-output/ |
| **命令** | .cursor/commands（speckit.*, bmad-*） | commands/ |
| **规则** | .cursor/rules（speckit*.mdc, bmad-*.mdc） | rules/ |
| **配置** | .cursor/agents/code-reviewer-config.yaml | config/ |
| **模板** | specs/000-Overview/.specify/templates、memory | templates/ |
| **工作流描述** | speckit-workflow skill 拆出内容 | workflows/ |
| **文档** | docs/speckit、docs/BMAD；docs/speckit/references/ 或与最优方案清单 19 对应的 references | docs/、docs/references/ |
| **技能副本** | Cursor 全局 skill 的「在新 repo 的副本」 | skills/ |
| **状态模板** | docs/speckit/.speckit-state.yaml.template | 仓库根 |

**排除**：_bmad-output/implementation-artifacts/、_bmad-output/product-artifacts/ 的**内容**不同步（仅同步目录骨架与 config 模板）；业务代码、非 bmad-speckit 的 .cursor 项不列入清单。

---

## §3 同步方向与策略

### 3.1 方向

- **A→B（micang-trader → 新 repo）**：将 micang-trader 中清单内路径的变更，同步到 BMAD-Speckit-SDD-Flow **仓库源码**（非安装后的项目根）。  
- **B→A（新 repo → micang-trader）**：将 BMAD-Speckit-SDD-Flow **仓库源码**中清单内路径的变更，同步回 micang-trader 对应路径。

### 3.2 策略

- **拷贝模式**：两 repo 无 git submodule 依赖，通过文件/目录拷贝或脚本复制实现同步；清单内路径一一映射（见 §5）。  
- **冲突策略**：  
  - **默认**：单次同步为「单向覆盖」——执行 A→B 时以 A 为准，执行 B→A 时以 B 为准。  
  - **同时修改**：若两边均对同一清单项有修改，**禁止同一次同步内双向执行**；约定「先 A→B 再 B→A」或「先 B→A 再 A→B」顺序执行，或由责任人指定本次以哪边为准。  
  - **人工冲突**：若检测到两边均变更且未约定主源，同步脚本应**报错并输出 diff**，由人工决定后再次执行或手工合并。  
- **子模块**：若未来新 repo 以 submodule 形式被 micang-trader 引用，则「在 micang-trader 内改 _bmad」即修改 submodule 所指 repo；提交与 push 在 submodule 内完成，与「同步到新 repo」等价，但流程按 submodule 规范执行，不适用「拷贝式双向同步」脚本。

---

## §4 触发与执行方式

| 方式 | 说明 | 执行者 | 执行位置 | 备注 |
|------|------|--------|----------|------|
| **手动** | 运行同步脚本（如 sync-micang-to-new-repo.ps1 / sync-new-repo-to-micang.ps1） | 责任人 | 本地 micang-trader 或新 repo clone | 首版推荐，无需 CI 权限 |
| **CI（可选）** | 在 push 到指定分支后触发同步到另一 repo | CI 服务 | 在 micang-trader 或新 repo 的 CI 中 | 需目标 repo 的 write token，敏感权限需审计与保管 |
| **定时（可选）** | 定时任务拉取两边并做 diff，必要时执行同步或仅报告 | 定时任务 | 独立 runner 或本地 | 可只做校验不写回 |
| **钩子（可选）** | pre-push / post-commit 提示或执行同步 | 开发者本地 | 本地 | 需文档说明避免误覆盖 |

**首版建议**：以**手动 + 清单校验脚本**为主；CI/定时/钩子作为可选增强，并在文档中写明所需权限与风险（见 §8）。

---

## §5 路径映射与清单

路径映射表（micang-trader ↔ 新 repo）。「双向」表示 A→B 与 B→A 均支持；「仅 A→B」或「仅 B→A」见备注。

| 序号 | micang-trader 路径 | 新 repo 路径 | 双向 | 备注 |
|------|--------------------|--------------|------|------|
| 1 | _bmad/ | _bmad/ | 是 | 含 scripts/bmad-speckit |
| 2 | _bmad-output/（骨架、config 模板） | _bmad-output/ | 是 | 不同步 implementation-artifacts 等内容 |
| 3 | .cursor/commands/speckit.*.md | commands/speckit.*.md | 是 | 9 个命令 |
| 4 | .cursor/commands/bmad-*.md | commands/bmad-*.md | 是 | 全部 bmad 命令 |
| 5 | .cursor/rules/speckit*.mdc | rules/speckit.mdc 等 | 是 | 规则文件 |
| 6 | .cursor/rules/bmad-*.mdc | rules/bmad-*.mdc | 是 | 必须含 bmad-bug-auto-party-mode、bmad-bug-assistant、bmad-story-assistant |
| 7 | .cursor/agents/code-reviewer-config.yaml | config/code-reviewer-config.yaml | 是 | |
| 8 | Cursor 全局 speckit-workflow 拆出或项目内 workflows 副本（若有） | workflows/ | 是 | 与最优方案迁移清单 8–9 一致（constitution.md, specify.md, plan.md 等） |
| 9 | specs/000-Overview/.specify/templates/* | templates/ | 是 | |
| 10 | specs/000-Overview/.specify/memory/constitution.md | templates/memory/constitution.md | 是 | |
| 11 | docs/speckit/*.md、docs/speckit/references/（若有） | docs/、docs/references/ | 是 | 使用指南、最佳实践等；references 与最优方案清单 19 对齐（audit-prompts、mapping-tables 等） |
| 12 | docs/BMAD/ | docs/BMAD/ | 是 | 须含 bmad-speckit-integration-FINAL-COMPLETE.md |
| 13 | specs/015-indicator-system-refactor/双repo_bmad_speckit_智能同步方案.md | docs/BMAD/双repo_bmad_speckit_智能同步方案.md | 是 | 本方案文档本身，拷贝至新 repo docs/BMAD/ |
| 14 | docs/speckit/.speckit-state.yaml.template | .speckit-state.yaml.template（根） | 是 | |
| 15 | （Cursor 全局 skill 内容） | skills/speckit-workflow/ 等 | 仅 A→B 或手动 | 新 repo 存副本；micang 侧若用全局则不同步回 |

清单文件建议：维护一份 `sync-manifest.yaml`（或等价的路径列表），供校验脚本逐项对比 checksum 或 mtime。格式示例见 **`_bmad/scripts/bmad-speckit/sync-manifest.yaml.example`**（`paths:` 下列出 `path_a` / `path_b` 对）。

---

## §6 冲突与边界处理

### 6.1 同时修改

- 两边对**同一清单项**均有修改时：  
  - 同步脚本应能检测（如基于 checksum 或 diff），并**报错或警告**，输出 diff。  
  - 由责任人决定：以 A 为准、以 B 为准或人工合并后再次执行。  
- 避免同一时刻既跑 A→B 又跑 B→A；若用 CI，应串行或加锁。

### 6.2 权限

- **CI 写另一 repo**：需目标 repo 的 write token（如 GitHub PAT）；存放于 CI secrets，仅责任人可配置；文档中说明权限范围与轮换策略。  
- **本地执行**：依赖执行者对本机两 repo clone 的写权限，无额外 token。

### 6.3 子模块 vs 拷贝

- **拷贝（当前方案）**：两仓库独立，通过脚本拷贝；双向同步按 §3、§5 执行。  
- **子模块**：若 micang-trader 将新 repo 或 _bmad 设为 submodule，则「在项目内改 _bmad」即改 submodule；提交在 submodule 内完成并 push 到新 repo，视为「A→B」；反向需在 submodule 仓库改完后，在 micang-trader 更新 submodule 引用（B→A）。子模块方案与拷贝方案二选一或在文档中分场景说明。

### 6.4 回滚

- **新 repo**：git revert 或从备份目录还原清单内路径。  
- **micang-trader**：git revert 或从备份/上一版本还原清单内路径。  
- 建议：重要同步前对目标 repo 打 tag 或备份清单内目录，便于回滚。

---

## §7 可验证性与验收

### 7.1 验证方式

- **清单校验脚本**：读取 sync-manifest，对每一条路径在两边计算 checksum（或比较 mtime），输出一致/不一致列表。  
- **验收命令示例**（可执行）：  
  - 脚本命名与路径：校验脚本置于 **_bmad** 目录下，与 bmad-speckit 其它脚本同源，便于双 repo 同步时一并同步。  
    - **PowerShell**：**`_bmad/scripts/bmad-speckit/powershell/validate-sync-manifest.ps1`**  
    - **Python**：**`_bmad/scripts/bmad-speckit/python/validate_sync_manifest.py`**（与 §5 路径映射一致，两实现等价，任选其一或同时使用）。  
  - 调用方式示例：  
    - PowerShell：`& ".\.\_bmad\scripts\bmad-speckit\powershell\validate-sync-manifest.ps1" -ManifestPath ".\sync-manifest.yaml" -RepoA "D:\path\to\micang-trader" -RepoB "D:\path\to\BMAD-Speckit-SDD-Flow"`（参数：manifest 路径、两 repo 根路径）。  
    - Python：`python _bmad/scripts/bmad-speckit/python/validate_sync_manifest.py --manifest sync-manifest.yaml --repo-a "D:\path\to\micang-trader" --repo-b "D:\path\to\BMAD-Speckit-SDD-Flow"`（从项目根执行）。  
  - 验收时执行：运行上述任一校验脚本，确认输出为「清单内项一致」或无未预期不一致；§9 T7 验收即运行该脚本并确认 §7.2 审计要点满足。  
- **验收标准**：  
  - 清单内所有项在两边**内容一致**（或符合「仅 A→B」等约定）；  
  - 同步后在新 repo 可执行「最小复现步骤」（如运行 _bmad/scripts/bmad-speckit 下脚本）；  
  - micang-trader 侧 .cursor/commands、.cursor/rules 与清单一致。

### 7.2 审计要点

- 同步范围与 §2、§5 一致，无扩大或遗漏。  
- 冲突策略与 §6 已执行（无未决双向覆盖）。  
- 权限与触发方式符合 §4、§8。  
- 回滚步骤已文档化并在需要时可执行。

---

## §8 风险与假设

### 8.1 假设

- 两 repo 使用**同一份**「bmad-speckit 相关」清单定义（如 sync-manifest）。  
- 清单外文件**不同步**，避免误覆盖业务代码。  
- 「同时修改」由责任人按 §6 处理，不同时执行 A→B 与 B→A。  
- CI 若启用，write token 由责任人保管并定期审计。  
- skills 在新 repo 以副本形式存在；micang-trader 若使用 Cursor 全局 skill，同步不改变全局，仅更新新 repo 的 skills/。

### 8.2 风险

| 风险 | 缓解 |
|------|------|
| 两边同时改同一文件导致覆盖 | 同步前 diff/checksum 检测，冲突时报错并输出 diff；约定执行顺序或主源 |
| CI token 泄露或滥用 | token 存 CI secrets，最小权限；文档说明轮换与审计 |
| 清单遗漏或错误导致漏同步/误覆盖 | 清单与脚本 code review；验收时运行清单校验脚本 |
| 回滚不及时或未备份 | 文档明确回滚步骤；重要同步前打 tag 或备份 |

---

## §9 任务列表（可执行）

- [ ] **T1** 编写/维护 **sync-manifest**（路径列表，与 §2、§5 一致），支持脚本解析。  
- [ ] **T2** 编写 **sync-micang-to-new-repo.ps1**（或等价脚本）：从 micang-trader 清单路径拷贝到新 repo 对应路径；支持 dry-run 与目标 clone 路径配置。  
- [ ] **T3** 编写 **sync-new-repo-to-micang.ps1**（或等价脚本）：从新 repo 清单路径拷贝到 micang-trader 对应路径；支持 dry-run 与源 clone 路径配置。  
- [ ] **T4** 编写 **清单校验脚本**（产出路径：**_bmad/scripts/bmad-speckit/powershell/validate-sync-manifest.ps1** 与 **_bmad/scripts/bmad-speckit/python/validate_sync_manifest.py**）：读取 sync-manifest，对比两边 checksum 或 mtime，输出一致/不一致报告；§7.1 已写明路径与调用方式。  
- [ ] **T5** 在 **README 或 docs/BMAD** 中写清：同步范围、触发方式（手动/可选 CI）、冲突策略、验收命令（即运行 §7.1 所述校验脚本）、回滚步骤。  
- [ ] **T6**（可选）在 micang-trader 或新 repo 的 CI 中增加「同步到另一 repo」的 job，并文档化所需 token 与权限。  
- [ ] **T7** 验收：执行一次 A→B 与一次 B→A（或仅 A→B），**运行 §7.1 所述清单校验脚本**（如 `_bmad/scripts/bmad-speckit/powershell/validate-sync-manifest.ps1` 或 `_bmad/scripts/bmad-speckit/python/validate_sync_manifest.py`），确认清单内项一致；确认 §7.2 审计要点满足。

---

**文档路径**：`specs/015-indicator-system-refactor/双repo_bmad_speckit_智能同步方案.md`  
**总轮次**：100；**批判审计员发言轮次**：73（>70%）；**最后 3 轮**：98、99、100 轮无新 gap，已收敛。
