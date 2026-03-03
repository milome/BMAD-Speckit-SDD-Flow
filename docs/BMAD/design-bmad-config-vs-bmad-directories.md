# 为何用 .bmad-config？当前价值与诚实结论（已采用方案 B）

**问题**：BMAD 已有 `_bmad` 和 `_bmad-output`，为何还多一个 `.bmad-config`？且 _bmad-output 里也放 PRD、epics、implementation readiness 等「配置/输入」，为何配置不一起放进去？.bmad-config 除了存 slug 还有什么价值？

**已采用**：**方案 B**——将 epic 配置迁到 **`_bmad-output/config/`** 内（如 `_bmad-output/config/epic-{id}.json`），与 PRD、epics 等统一放在 _bmad-output 下。**全局配置**（如 worktree_granularity）也统一为 **`_bmad-output/config/settings.json`**（TASKS 中原 `echo '...' > .bmad-config` 已改为写入该路径）。脚本与文档已按此更新；项目根下不再使用 `.bmad-config` 目录或文件。

---

## 1. 之前解释为什么牵强

- **_bmad-output 里已经放「配置/输入」**：PRD、epics.md、implementation-readiness-report 等都在 `_bmad-output/planning-artifacts/`，它们既是上一阶段的「产出」，也是下一阶段的「输入」。所以用「_bmad-output = 产出，配置不能放进去」来区分并不成立——**规划类配置已经放在 _bmad-output 里了**。
- 若把 epic 的 JSON 配置放在 `_bmad-output/config/` 或 `_bmad-output/epic-config/`，与 PRD、epics 同属「BMAD 运行时状态」，在语义上是一致的。**不复用 _bmad-output 的「设计理由」并不充分**。

---

## 2. 当前本仓库里 .bmad-config 的实际用途

| 用途 | 是否已实现 | 说明 |
|------|------------|------|
| **Epic/Story slug 推导** | ✅ 已用 | create-new-feature.ps1 会读 **`_bmad-output/config/epic-{N}.json`** 的 `slug`、`stories[].slug`/`title`。但**同一信息可从 epics.md 解析得到**，脚本已支持 epics.md 兜底，故 **slug 不依赖该 config 目录**。 |
| **epic_id, story_count, stories[], mode** | ❌ 仅 TASKS 设计 | TASKS 约定 `load_epic_config(epic_id)` 从 **`_bmad-output/config/epic-{id}.json`** 读（已与方案 B 统一），用于 worktree 创建、story 数量等。**本仓库没有实现该 Python 集成层**，故当前无代码读这些字段。 |
| **epic-{id}-branches.json（分支状态）** | ❌ 仅 TASKS 设计 | 分支/合并状态存 **`_bmad-output/config/epic-{id}-branches.json`**。同样**未在本仓库实现**。 |

**结论**：**在当前代码库中，.bmad-config 的唯一实际用途就是「可选地提供 slug」**，而 slug 已可由 epics.md 完全覆盖。因此**目前 .bmad-config 没有不可替代的独特价值**。

---

## 3. .bmad-config 的「设计意图」价值（未来）

在 TASKS 的设计里，.bmad-config 的**预定**价值是：

- 为**后续 BMAD 集成**（Python/自动化）提供**机器可读的 Epic 配置**：epic_id、story_count、stories[]、mode（serial/parallel），以及分支状态 JSON。
- epics.md 是人读的 Markdown；epic-{id}.json 是给脚本/工具用的结构化数据。若将来实现「按配置创建 worktree、冲突检测、合并跟踪」等，使用**统一路径** **`_bmad-output/config/epic-{id}.json`**（方案 B 已采用）。

---

## 4. 可选方案（减少牵强、统一目录）

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A. 不推 .bmad-config** | 本仓库只依赖 epics.md 推导 slug；.bmad-config 视为可选，文档中说明「仅当未来实现 TASKS 的集成层时才需要」。 | 与现状一致，不增加目录；逻辑简单。 | 若以后做集成，再决定配置放哪。 |
| **B. 配置并入 _bmad-output** ✅ **已采用** | Epic 配置放在 **`_bmad-output/config/epic-{id}.json`**，与 PRD、epics 同属「BMAD 运行时状态」。create-new-feature.ps1 已改为优先读该路径，无则退回到 epics.md。 | 不再新增项目根目录；与「PRD/epics/readiness 已在 _bmad-output」一致。 | — |
| **C. 保留 .bmad-config 仅作预留** | （未采用） | — | — |

---

## 5. 诚实小结

- **_bmad-output 里已经放 PRD、epics、implementation readiness**，说「配置不能放 _bmad-output」的理由不成立；之前那套「配置 vs 产出」的区分对当前结构来说**确实牵强**。
- **目前 .bmad-config 在本仓库里除了（可选的）slug 外，没有其它被用到的价值**；slug 又完全可以由 epics.md 提供，所以**现阶段没有不可替代的 benefit**。
- **当前约定**：Epic 配置与分支状态 JSON 统一放在 **`_bmad-output/config/`**（方案 B），脚本与 TASKS 已按此路径更新。项目根下不再使用 `.bmad-config` 目录存放 epic 配置。

（本文档替代此前「为何不复用 _bmad/_bmad-output」的牵强解释，并记录已采用方案 B。）
