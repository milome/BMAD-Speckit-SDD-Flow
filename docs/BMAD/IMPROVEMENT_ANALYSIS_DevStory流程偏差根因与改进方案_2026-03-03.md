# Dev Story 流程偏差根因与改进方案

**文档版本**: 1.0  
**创建日期**: 2026-03-03  
**问题类型**: 流程合规性偏差  
**涉及技能**: bmad-story-assistant、speckit-workflow、ralph-method  

---

## 执行摘要

Dev Story 执行时未完全按照 speckit-workflow 的 specify → plan → GAPS → tasks → 执行 顺序进行，仅生成了 spec 文档后即跳转至 ralph prd/progress 并开始实施。本文档通过 party-mode 多角色辩论识别根因、技能冲突点，并提出具体改进方案。

---

## §1 问题根因分析

### 1.1 偏差事实

| 预期产出 | 实际状态 | 路径/说明 |
|----------|----------|------------|
| spec-E0-S1.md | ✓ 已生成 | specs/epic-0/story-1-*/ |
| plan-E0-S1.md | ✗ 未生成 | 应位于 spec 子目录 |
| IMPLEMENTATION_GAPS-E0-S1.md | ✗ 未生成 | 应位于 spec 子目录 |
| tasks-E0-S1.md（speckit 产出） | ✗ 未生成 | 应位于 spec 子目录 |
| TASKS（BMAD party-mode 产出） | ✓ 存在 | docs/BMAD/TASKS_*.md |
| prd / progress（ralph） | ✓ 已创建并执行 | _bmad-output/implementation-artifacts/ |
| 直接进入实施 | ✗ 违规 | 跳过 plan/GAPS/tasks 三阶段 |

### 1.2 根因归纳

#### 根因 1：双轨 TASKS 概念混淆（主因）

**现象**：bmad-story-assistant 与 speckit-workflow 中存在两套「任务」概念，未在 prompt 中明确区分：

| 概念 | 来源 | 路径 | 用途 |
|------|------|------|------|
| TASKS_{epic}-{story}-{slug}.md | BMAD Create Story / party-mode | _bmad-output/... 或 docs/BMAD/ | 高层任务清单，供 party-mode 共识 |
| tasks-E{epic}-S{story}.md | speckit-workflow §4 | specs/epic-{epic}/story-{story}-{slug}/ | 可执行任务列表，含需求映射、验收标准 |

**后果**：subagent 收到主 Agent 传入的「TASKS 文档路径」时，可能将 BMAD TASKS 误认为 speckit tasks，认为「任务已具备」而跳过 plan → GAPS → tasks 三阶段。

#### 根因 2：STORY-A3-DEV 模板缺乏显式阶段门控

**现象**：STORY-A3-DEV 仅写「必须嵌套执行 speckit-workflow 完整流程：specify → plan → GAPS → tasks → 执行」，未提供：

- 各阶段**必须产出的文件名**清单
- **阶段门控**：进入下一阶段前必须验证上一阶段产出存在且通过审计
- **禁止提前进入 ralph** 的显式约束

**后果**：subagent 可自由解释「完整流程」，在 specify 完成后即认为可进入「执行」，将 ralph prd/progress 视为执行入口。

#### 根因 3：ralph-method 与 speckit 的时序未绑定

**现象**：ralph-method 规定「Before implementation starts, you MUST create both tracking files (prd, progress)」，但未说明：

- 在 BMAD/speckit 上下文中，「implementation」的起点是 speckit 执行阶段（即 tasks-E{epic}-S{story}.md 审计通过后）
- prd 的 userStories 应来源于 **speckit tasks-E{epic}-S{story}.md**，而非 BMAD TASKS 或 Story 文档的直接拆解

**后果**：subagent 可能从 Story 文档或 BMAD TASKS 直接拆解为 US，创建 prd/progress 后即开始编码，完全绕过 speckit plan/GAPS/tasks。

#### 根因 4：GAPS 阶段无独立命令的可见性不足

**现象**：speckit-workflow §3 规定 GAPS 无独立命令，由「模型自动深度分析」或用户要求「生成 IMPLEMENTATION_GAPS」触发。

**后果**：在 Dev Story 子任务上下文中，subagent 可能未意识到需要主动执行 GAPS 分析；且 plan 未生成时，GAPS 的输入（plan + 需求 + 当前实现）不完整，进一步降低 GAPS 被触发的概率。

#### 根因 5：子任务 prompt 未强制加载 speckit-workflow 技能

**现象**：STORY-A3-DEV 写「请读取 ralph-method 技能与 speckit-workflow 技能」，但未强制要求：

- 在开始任何实施动作前，**先**读取 speckit-workflow 并解析 §8 命令索引
- 按 §8 顺序逐阶段执行，每阶段完成后自检产出是否存在

**后果**：subagent 可能依赖自身对「Dev Story」的理解，而非严格遵循 speckit-workflow 的 0→1→2→3→4→5 顺序。

---

## §2 技能冲突与歧义点

### 2.1 bmad-story-assistant vs speckit-workflow

| 冲突点 | 描述 | 影响 |
|--------|------|------|
| 产出路径 | bmad: TASKS 在 _bmad-output；speckit: tasks 在 specs 子目录 | 两套 tasks 易混淆 |
| 阶段命名 | bmad 称「plan + tasks」；speckit 称 plan → GAPS → tasks | 子 agent 可能合并或跳过 |
| 输入文档 | STORY-A3-DEV 传入「BUGFIX/TASKS 文档路径」 | 易被理解为「任务已就绪」 |

### 2.2 speckit-workflow vs ralph-method

| 冲突点 | 描述 | 影响 |
|--------|------|------|
| 任务来源 | speckit: tasks 来自 plan + GAPS；ralph: userStories 来自 prd | 未规定 prd.userStories 必须映射自 tasks-E{epic}-S{story}.md |
| 实施起点 | speckit: 执行阶段 = tasks 审计通过后；ralph: implementation = 创建 prd 后 | 时序歧义 |
| 进度追踪 | speckit: tasks.md 复选框；ralph: progress.txt | 两套进度可能不同步 |

### 2.3 歧义汇总

1. **「执行」的起点**：是「tasks-E{epic}-S{story}.md 审计通过后」还是「prd/progress 创建后」？
2. **「TASKS」的语义**：主 Agent 传入的 TASKS 是 BMAD 高层任务还是 speckit 可执行任务？
3. **ralph 的适用时机**：ralph prd/progress 应在 speckit 哪一阶段之后创建？

---

## §3 改进方案

### 3.1 bmad-story-assistant 修改建议

#### 3.1.1 增强 STORY-A3-DEV 模板（阶段门控 + 产出清单）

在 STORY-A3-DEV prompt 中，在「必须嵌套执行 speckit-workflow 完整流程」之后，增加以下**强制检查清单**（子 agent 必须逐项验证，未通过不得进入下一阶段）：

```markdown
**【阶段门控】进入下一阶段前必须验证：**

1. **specify 完成后**：确认 `specs/epic-{epic}/story-{story}-{slug}/spec-E{epic}-S{story}.md` 存在且已通过 code-review §1。
2. **plan 完成后**：确认 `plan-E{epic}-S{story}.md` 存在且已通过 code-review §2。
3. **GAPS 完成后**：确认 `IMPLEMENTATION_GAPS-E{epic}-S{story}.md` 存在且已通过 code-review §3。
4. **tasks 完成后**：确认 `tasks-E{epic}-S{story}.md` 存在且已通过 code-review §4。
5. **禁止提前进入 ralph**：在 plan、GAPS、tasks 三阶段全部完成且审计通过之前，**禁止**创建 prd/progress，**禁止**开始任何生产代码编写。

**【文档区分】**
- `TASKS_{epic}-{story}-{slug}.md`（主 Agent 可能传入）：来自 BMAD party-mode，为高层任务清单，**不可**替代 speckit 的 `tasks-E{epic}-S{story}.md`。
- 可执行任务列表必须以 speckit 产出的 `tasks-E{epic}-S{story}.md` 为准；prd 的 userStories 必须从该文件映射生成。
```

#### 3.1.2 增加子任务发起前自检项

在「主 Agent 发起子任务前自检清单」中增加：

- [ ] 已向子任务 prompt 注入完整的 speckit 阶段门控与产出清单
- [ ] 已明确区分 BMAD TASKS 与 speckit tasks-E{epic}-S{story}.md，避免子 agent 混淆

#### 3.1.3 阶段四实施后审计前置条件强化

在「阶段四：实施后审计」的「前置检查」中，将 speckit 产出存在性检查改为**强制且可验证**：

```markdown
在进行实施后审计前，**必须**确认以下文件存在（否则审计结论为未通过）：
- [ ] specs/epic-{epic}/story-{story}-{slug}/spec-E{epic}-S{story}.md
- [ ] specs/epic-{epic}/story-{story}-{slug}/plan-E{epic}-S{story}.md
- [ ] specs/epic-{epic}/story-{story}-{slug}/IMPLEMENTATION_GAPS-E{epic}-S{story}.md
- [ ] specs/epic-{epic}/story-{story}-{slug}/tasks-E{epic}-S{story}.md
```

### 3.2 speckit-workflow 修改建议

#### 3.2.1 增加「BMAD 嵌套模式」专门说明

在 §1.0 或 §8 后增加小节：

```markdown
**§8.1 BMAD 嵌套模式（bmad-story-assistant 触发时）**

当 speckit 由 bmad-story-assistant 阶段三 Dev Story 嵌套触发时：
1. 输入为 Story 文档 +（可选的）BMAD TASKS 文档；BMAD TASKS 仅作参考，**不可**替代 plan/GAPS/tasks 产出。
2. 必须严格按 1→2→3→4→5 顺序执行（constitution 若已存在可跳过 0）。
3. 产出路径：`specs/epic-{epic}/story-{story}-{slug}/` 下，文件名必须含 `E{epic}-S{story}`。
4. 在 tasks-E{epic}-S{story}.md 审计通过之前，**禁止**创建 ralph prd/progress 或开始编码。
```

#### 3.2.2 GAPS 触发条件显式化

在 §3 触发方式中增加：

```markdown
**BMAD 嵌套模式下的 GAPS 触发**：当 plan-E{epic}-S{story}.md 已生成且通过 §2.2 审计后，子 agent **必须**主动执行深度分析（对照 plan、Story 文档、当前实现），生成 IMPLEMENTATION_GAPS-E{epic}-S{story}.md。不得等待用户显式要求。
```

### 3.3 ralph-method 修改建议

#### 3.3.1 增加「BMAD/speckit 上下文」约束

在 Mandatory Execution Rules 之后增加：

```markdown
**When used in BMAD/speckit context:**

- `implementation` starts **only after** speckit `tasks-E{epic}-S{story}.md` exists and has passed code-review §4.
- `prd.userStories` MUST be derived from `tasks-E{epic}-S{story}.md` (or equivalent speckit tasks output), not from Story document or BMAD TASKS alone.
- Creating prd/progress before speckit tasks are audit-passed is a **violation** of the speckit-workflow.
```

#### 3.3.2 命名规则扩展

在 Tracking File Naming Rules 中增加 BMAD 场景：

| Scenario | prd file | progress file |
|----------|-----------|----------------|
| Speckit tasks (e.g. tasks-E0-S1.md) | `prd.tasks-E0-S1.json` | `progress.tasks-E0-S1.txt` |

当 reference document 为 `tasks-E{epic}-S{story}.md` 时，使用其 stem 作为 prd/progress 后缀。

---

## §4 验证与回归检查清单

### 4.1 改进实施后验证

| 检查项 | 验证方式 | 通过标准 |
|--------|----------|----------|
| STORY-A3-DEV 含阶段门控 | 读取 bmad-story-assistant SKILL.md | 模板中含 5 阶段门控 + 禁止提前 ralph |
| BMAD TASKS vs speckit tasks 已区分 | 同上 | 模板中含文档区分说明 |
| speckit-workflow 含 BMAD 嵌套说明 | 读取 speckit-workflow SKILL.md | §8.1 或等效小节存在 |
| ralph-method 含 BMAD 约束 | 读取 ralph-method SKILL.md | 含「implementation 起点」与「prd 来源」约束 |

### 4.2 回归测试场景

| 场景 | 预期行为 | 验证命令/方法 |
|------|----------|---------------|
| 新 Dev Story 执行 | 依次生成 spec → plan → GAPS → tasks，再创建 prd/progress | 检查 specs 子目录下 4 个文件存在且有时间顺序 |
| 仅传入 BMAD TASKS | 子 agent 仍执行 plan → GAPS → tasks | 不应出现「TASKS 已足够」而跳过 |
| 实施后审计 | 若 plan/GAPS/tasks 任一缺失，审计不通过 | 前置检查清单触发失败 |

### 4.3 监控指标（可选）

- 每次 Dev Story 执行后，统计 `specs/epic-*/story-*-*/` 下 plan、GAPS、tasks 文件的生成率
- 若连续 2 次以上出现「仅有 spec 无 plan」即告警

---

## §5 附录：party-mode 关键轮次摘要

### 角色设定

- **批判审计员**：发言 >60%，每轮首先发言，质疑漏洞、挑战假设
- **Amelia 开发**：实施视角
- **Winston 架构师**：流程架构
- **BMad Master**：协调与总结

---

### 第 1 轮

**批判审计员**：问题很清楚：spec 有了，plan/GAPS/tasks 全没生成，直接上 ralph。根因是什么？我怀疑 subagent 根本不知道要生成这三个文档，或者认为「有 TASKS 就够了」。需要查 STORY-A3-DEV 的 prompt 是否明确要求产出 plan、GAPS、tasks 三个文件。

**Amelia 开发**：从实施角度看，如果主 Agent 传入了 TASKS 路径，我可能会认为任务已经拆好了，直接转成 prd 的 userStories 就能开工。这是很自然的推理。

**Winston 架构师**：流程上，bmad-story-assistant 明确说「必须嵌套执行 speckit-workflow 完整流程：specify → plan → GAPS → tasks → 执行」。但「完整流程」四个字可能被理解为「从某处开始执行」，而不是「必须依次产出四个文档」。

**BMad Master**：共识：需要更显式的阶段定义和产出清单。

---

### 第 2 轮

**批判审计员**：我进一步质疑：speckit-workflow 里 GAPS 是「无独立命令，模型自动深度分析」。在子任务上下文中，模型会不会根本不知道要「自动」做这件事？而且 plan 都没有，GAPS 的输入（plan + 需求 + 实现）不完整，自动分析从何谈起？

**Amelia 开发**：对，如果 plan 没生成，GAPS 的触发条件就不满足。所以根因链是：plan 被跳过 → GAPS 无法触发 → tasks 无法生成（因为 tasks 依赖 GAPS）。

**Winston 架构师**：所以关键是：为什么 plan 被跳过？可能 subagent 认为 specify 之后就可以「执行」了。需要查 ralph-method 和 speckit 对「执行」的定义是否一致。

**BMad Master**：根因链初步形成：plan 跳过 → GAPS 不触发 → tasks 不生成 → 直接 ralph。

---

### 第 3 轮

**批判审计员**：再问一个尖锐问题：主 Agent 传入的「TASKS 文档路径」到底是什么？是 docs/BMAD/TASKS_xxx.md 还是 specs 下的 tasks-E0-S1.md？如果传的是前者，subagent 会认为「任务文档已就绪」，自然跳过 speckit 的 tasks 生成。这是**概念混淆**导致的跳过。

**Amelia 开发**：确实。bmad-story-assistant 的文档映射表里写：Story文档 + plan + tasks 对应 spec + plan + tasks。但 TASKS 来自 party-mode，和 speckit 的 tasks 不是同一个东西。技能里没有明确说「两者不可互相替代」。

**Winston 架构师**：文档映射关系表写的是「plan + tasks（实现方案与任务列表）↔ plan-E{epic}-S{story}.md + tasks-E{epic}-S{story}.md」。但 TASKS 来自 Create Story，是 party-mode 的产出，和 speckit 的 plan/tasks 是不同层级的产物。需要显式区分。

**BMad Master**：共识：双轨 TASKS 概念混淆是主因之一，需在技能中明确区分。

---

### 第 4 轮

**批判审计员**：ralph-method 说「Before implementation starts, you MUST create both tracking files」。这里的 implementation 是什么？如果 subagent 理解为「写代码就是 implementation」，那在 specify 完成后就可以创建 prd/progress，因为「马上就要写代码了」。ralph 没有说「implementation 必须等 speckit tasks 完成」。

**Amelia 开发**：ralph 的规则是通用的，没有 BMAD/speckit 的上下文。在纯 ralph 场景下，用户可能直接给一个 BUGFIX 或 REQ 文档，拆成 US 就开工。但在 BMAD 场景下，应该等 speckit 的 tasks 出来再拆 US。

**Winston 架构师**：需要在 ralph-method 中增加「当与 speckit 联用时」的约束，明确 implementation 的起点是 speckit 执行阶段，prd 的 userStories 必须来源于 tasks-E{epic}-S{story}.md。

**BMad Master**：共识：ralph-method 需增加 BMAD/speckit 上下文约束。

---

### 第 5 轮

**批判审计员**：STORY-A3-DEV 的 prompt 有没有强制子 agent 先读 speckit-workflow？只写「请读取 ralph-method 技能与 speckit-workflow 技能」可能不够。如果子 agent 的上下文有限，可能只读了 ralph，没读 speckit，或者读了但没按 §8 的命令顺序执行。

**Amelia 开发**：从实现角度，更好的做法是在 prompt 里直接贴出 speckit §8 的命令索引和顺序，而不是依赖子 agent 自己去读。这样即使没加载技能，也能按顺序执行。

**Winston 架构师**：同意。可以在 STORY-A3-DEV 中增加「阶段门控」：每完成一个阶段，必须检查产出文件是否存在，再进入下一阶段。这样即使子 agent 理解有偏差，也会被门控拦住。

**BMad Master**：共识：增加显式阶段门控和产出清单，减少对「子 agent 自觉读技能」的依赖。

---

### 第 6 轮

**批判审计员**：阶段四实施后审计的前置检查里，有没有验证 plan、GAPS、tasks 三个文件存在？如果没有，即使漏了这三个，审计也可能「通过」，因为审计依据可能只看了 spec 和代码。

**Amelia 开发**：bmad-story-assistant 的阶段四前置检查确实列了「speckit specify/plan/GAPS/tasks 各阶段 code-review 已通过」，但这是「通过」的状态检查，不是「文件存在」的检查。如果阶段三根本没生成这些文件，阶段四的审计可能无法发现，因为审计员可能只看了已有的 spec。

**Winston 架构师**：应该把「文件存在」作为硬性前置条件。若 plan-E{epic}-S{story}.md 不存在，直接判审计不通过，并回退到阶段三重新执行。

**BMad Master**：共识：阶段四前置检查需增加「文件存在性」验证。

---

### 第 7 轮

**批判审计员**：GAPS 无独立命令，在 BMAD 嵌套模式下，谁负责触发？是主 Agent 在发起子任务时明确说「请执行 GAPS 分析」，还是子 agent 在 plan 完成后自动执行？speckit-workflow 说「模型必须自动执行深度分析」，但子 agent 可能不知道自己是「模型」在这个上下文中的执行者。

**Amelia 开发**：建议在 STORY-A3-DEV 的流程描述中，把 GAPS 写成一个显式步骤：「3. GAPS：在 plan 审计通过后，必须对照 plan、Story、当前实现生成 IMPLEMENTATION_GAPS-E{epic}-S{story}.md」。这样就不依赖「自动」了。

**Winston 架构师**：speckit-workflow 的 §3 可以增加「BMAD 嵌套模式下，子 agent 必须在 plan 审计通过后主动执行 GAPS 分析」的表述，避免「自动」被理解为「系统自动」而非「agent 主动」。

**BMad Master**：共识：GAPS 在 BMAD 嵌套模式下需显式触发要求。

---

### 第 8 轮

**批判审计员**：主 Agent 发起 Dev Story 子任务时，有没有做自检？自检清单里有没有「确认子任务 prompt 包含完整的 speckit 阶段门控」？如果主 Agent 只是复制了模板但没检查，可能模板本身就有漏洞。

**Amelia 开发**：自检清单目前侧重「占位符替换」「审计可用性」等，没有「prompt 内容完整性」的检查。建议增加：子任务 prompt 必须包含阶段门控、产出清单、禁止提前 ralph 等关键约束。

**Winston 架构师**：主 Agent 的自检应该包括「子任务 prompt 是否足以让 subagent 无歧义地执行 speckit 全流程」。这需要把关键约束写进自检清单。

**BMad Master**：共识：主 Agent 自检清单需增加 prompt 内容完整性检查。

---

### 第 9 轮

**批判审计员**：如果子 agent 的 token 预算有限，会不会在读完 Story、spec、ralph、speckit 之后，已经没空间再执行 plan/GAPS/tasks 生成了？或者为了「完成任务」，优先做了「可见」的编码工作，跳过了「文档」工作？

**Amelia 开发**：有可能。子 agent 可能倾向于做「产出代码」这种明确可交付的工作，而把 plan/GAPS/tasks 视为「可选文档」。需要在 prompt 中强调：plan、GAPS、tasks 是**强制产出**，缺一不可，否则视为任务失败。

**Winston 架构师**：可以在阶段门控中写「若在未生成 plan/GAPS/tasks 的情况下开始编码，视为严重违规，必须立即停止并补全文档」。

**BMad Master**：共识：强调 plan/GAPS/tasks 的强制性，避免被当作可选。

---

### 第 10 轮

**批判审计员**：改进方案里，我们建议修改三个技能。但修改后，如何确保 subagent 真的会按新规则执行？如果 subagent 的 prompt 没有更新，或者主 Agent 没有用新模板发起子任务，改进就无效。

**Amelia 开发**：改进方案需要配合「主 Agent 必须使用最新模板」的约束。可以在 bmad-story-assistant 的版本或变更日志里记录，当 STORY-A3-DEV 模板更新时，主 Agent 必须使用新版本。或者用模板 ID + 版本号，在自检时验证。

**Winston 架构师**：更根本的是，改进后的模板要「自包含」——即使子 agent 没读 speckit-workflow，仅凭 STORY-A3-DEV 的内容也能正确执行。这样对子 agent 的依赖最小。

**BMad Master**：共识：改进方案以「模板自包含」为目标，减少对子 agent 主动加载技能的依赖。

---

### 第 11 轮

**批判审计员**：验证清单里，我们说要「检查 specs 子目录下 4 个文件存在且有时间顺序」。时间顺序怎么验证？如果 plan 是后来补的，文件修改时间可能晚于 tasks，但逻辑上 plan 应在 tasks 之前。

**Amelia 开发**：时间顺序可以作为辅助验证，不是硬性条件。更关键的是「四个文件都存在」。时间顺序可以用于人工复盘，判断是否有人事后补文档。

**Winston 架构师**：验证的重点应是「存在性」和「审计通过」。时间顺序可作为可选的高级检查，不必写进强制清单。

**BMad Master**：共识：验证以存在性为主，时间顺序为辅助。

---

### 第 12 轮

**批判审计员**：ralph-method 的修改是增加「BMAD/speckit 上下文」约束。但 ralph-method 是通用技能，可能被用在非 BMAD 场景。增加 BMAD 约束会不会影响其他场景？

**Amelia 开发**：可以写成「When used in BMAD/speckit context」的条件分支。非 BMAD 场景下，这些约束不适用，原有规则照旧。

**Winston 架构师**：ralph-method 的 description 已经提到「planning work for autonomous AI-assisted coding loops」，与 speckit 有交集。增加条件分支是合理的，不会破坏通用性。

**BMad Master**：共识：用条件分支「When used in BMAD/speckit context」限定约束范围。

---

### 第 13 轮

**批判审计员**：我们讨论了子 agent 为什么会跳过，但主 Agent 在子任务返回后有没有做「产出完整性检查」？如果主 Agent 在子任务完成后，主动检查 plan/GAPS/tasks 是否存在，发现缺失时立即要求子 agent 补全，也能兜底。

**Amelia 开发**：好主意。可以在「3.3.1 子任务返回后兜底 cleanup」之后，增加「3.3.2 子任务返回后产出完整性检查」：检查 plan、GAPS、tasks 是否存在；若缺失，发起补全子任务，不得直接进入阶段四。

**Winston 架构师**：这是双重保险：子任务内用阶段门控防止跳过，主 Agent 在返回后用完整性检查兜底。两层防护更稳妥。

**BMad Master**：共识：增加主 Agent 的子任务返回后产出完整性检查。

---

### 第 14 轮

**批判审计员**：speckit 的 constitution 阶段（§0.5）在 BMAD 嵌套模式下要不要执行？如果项目已有 constitution，可以跳过；如果没有，子 agent 要不要先建 constitution 再 specify？这会影响流程的起点。

**Amelia 开发**：bmad-story-assistant 的 Dev Story 流程里没有提 constitution。speckit-workflow §8 说「0→1→2→3→4→5，不可跳过」，但 constitution 若已存在可理解为「已完成」。建议在 STORY-A3-DEV 中写：若项目/spec 目录下已有 constitution，可跳过；否则先执行 constitution 再 specify。

**Winston 架构师**：对于 BMAD 项目，通常已有项目规范，constitution 可能已存在。可以设为可选检查：若存在则跳过，若不存在则提示子 agent 先完成 constitution。

**BMad Master**：共识：constitution 在 BMAD 嵌套模式下可设为「若已存在则跳过」，避免重复劳动。

---

### 第 15 轮

**批判审计员**：改进方案文档本身要不要经过审计？我们提出了对三个技能的修改建议，这些修改会不会引入新的冲突或遗漏？

**Amelia 开发**：建议在实施改进后，用 code-reviewer 对三个技能的修改进行审计，确保与现有流程一致，无新冲突。

**Winston 架构师**：改进方案文档可以作为 ADR（Architecture Decision Record）或流程改进记录保存，后续实施时按 §3 逐项修改，修改后再审计。

**BMad Master**：共识：改进实施后需对修改后的技能进行审计。

---

### 第 16 轮

**批判审计员**：我们说了「prd 的 userStories 必须从 tasks-E{epic}-S{story}.md 映射生成」。但 tasks 的格式和 ralph 的 userStories 格式可能不同。映射规则是什么？需要写进 ralph-method 还是 bmad-story-assistant？

**Amelia 开发**：tasks 通常是带 ID、描述、验收标准的列表；ralph 的 userStories 有 id、title、description、acceptanceCriteria、priority、passes 等。映射规则可以是：tasks 的每个 task → 一个 US，task 的验收标准 → acceptanceCriteria。可以写在 bmad-story-assistant 的「需求追溯要求」或 ralph-method 的 BMAD 约束里。

**Winston 架构师**：映射规则不必过于复杂，关键是「来源必须是 tasks-E{epic}-S{story}.md」，具体字段对应可以灵活处理。只要保证追溯链不断即可。

**BMad Master**：共识：映射规则可简化，重点约束「来源」而非「格式」。

---

### 第 17 轮

**批判审计员**：如果用户说「跳过 Create Story，直接 Dev Story」，这时没有 Story 文档，只有 TASKS。这种情况下，spec 的输入是什么？没有 Story 文档，specify 怎么做？

**Amelia 开发**：bmad-story-assistant 的示例 4 说，用户明确「已通过 party-mode 且审计通过」时可跳过 Create Story，直接 Dev Story，传入 Story 文档路径和 TASKS 路径。所以 Story 文档应该还是存在的，只是跳过了「创建」步骤。如果连 Story 文档都没有，那 Dev Story 的输入不完整，应该拒绝执行。

**Winston 架构师**：跳过 Create Story 的前提是「Story 文档已存在」。所以不会有「只有 TASKS 没有 Story」的合法场景。若出现，应报错并要求先完成 Create Story。

**BMad Master**：共识：Dev Story 的输入必须包含 Story 文档，TASKS 为可选补充。

---

### 第 18 轮

**批判审计员**：改进方案里提到「主 Agent 在子任务返回后做产出完整性检查」。但子任务可能超时或失败，返回时可能没有完整输出。主 Agent 怎么知道是「子任务没做完」还是「子任务故意跳过」？

**Amelia 开发**：无论哪种情况，只要 plan/GAPS/tasks 缺失，主 Agent 都应发起补全。如果是超时，补全子任务可以从缺失的阶段继续；如果是故意跳过，补全子任务会强制生成。所以主 Agent 不需要区分原因，只做存在性检查即可。

**Winston 架构师**：同意。完整性检查是结果导向的，不关心原因。缺了就补，补完再进入阶段四。

**BMad Master**：共识：主 Agent 的完整性检查不区分原因，缺即补。

---

### 第 19 轮

**批判审计员**：我们给子 agent 的 prompt 加了很多约束，会不会导致 prompt 过长，子 agent 反而抓不住重点？有没有更简洁的方式？

**Amelia 开发**：可以用分层方式：核心约束用简短 bullet 列出，详细说明放在「若需更多细节请读 speckit-workflow §8」的引用里。这样既保证关键约束在场，又控制长度。

**Winston 架构师**：阶段门控可以用表格形式，一行一个阶段，列清「产出文件」「通过标准」「禁止事项」。表格比长段落更易解析。

**BMad Master**：共识：用表格和 bullet 精简表述，详细内容用引用。

---

### 第 20 轮

**批判审计员**：总结一下，我们识别了 5 个根因、3 个技能的冲突点，提出了 3.1～3.3 的改进方案，以及 §4 的验证清单。还有没有遗漏？

**Amelia 开发**：我觉得可以补充「培训/文档」：在 AGENTS.md 或项目 README 中简要说明 Dev Story 的正确流程，让人类开发者也能监督。这样即使 AI 出错，人也能发现。

**Winston 架构师**：可以增加「回退流程」：当发现 plan/GAPS/tasks 缺失时，主 Agent 如何发起补全子任务？是重新发起完整的 Dev Story，还是只发起「从 plan 阶段开始」的子任务？建议写清补全的 prompt 模板。

**BMad Master**：共识：补充「补全子任务」的 prompt 模板或指引，以及人类可读的流程文档。改进方案可据此定稿。

---

## 修订历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-03-03 | party-mode 多角色辩论 | 初版：根因分析、技能冲突、改进方案、验证清单、20 轮辩论摘要 |
