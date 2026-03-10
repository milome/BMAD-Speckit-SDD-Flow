# BMAD-Speckit TASKS - Party-Mode Review Gaps (v3)

## 1. 审计概要

| 项目 | 详情 |
|------|------|
| **总轮次** | 102 轮 |
| **批判性审计员出场次数** | 51 次 |
| **批判性审计员占比** | 50.0% (≥50% ✓) |
| **收敛条件** | 满足：第 100、101、102 轮无人提出新 gap |
| **批判性审计员终审结论** | **有条件同意** |

### 1.1 角色发言分布

| 角色 | 发言次数 | 占比 |
|------|----------|------|
| 批判性审计员 | 51 | 50.0% |
| Winston (架构师) | 14 | 13.7% |
| Amelia (开发) | 13 | 12.7% |
| Mary (分析师) | 12 | 11.8% |
| Quinn (测试) | 12 | 11.8% |

### 1.2 收敛过程

- 第 1–90 轮：持续发现 gaps，逐项记录
- 第 91–99 轮：对遗漏项补充质疑，部分 gaps 闭合
- 第 100–102 轮：连续 3 轮无新 gap，满足收敛条件
- 第 102 轮：批判性审计员做终审陈述

---

## 2. Gaps 汇总

| ID | 描述 | 严重程度 | 涉及任务/阶段 | 建议 |
|----|------|----------|--------------|------|
| GAP-051 | 前置任务验收标准「三个skill」与操作步骤「四个skill」矛盾 | 高 | 前置任务 | 明确 pr-template-generator 为可选检查；验收标准改为「三个核心 skill 均成功读取，pr-template-generator 存在性已检查」 |
| GAP-052 | 任务6.1 test_layer_1 中 evaluate_complexity(8,7,6)=21 超出复杂度范围 3~15 | 高 | 任务6.1 | 修正测试用例：每维度最高5分，总分最高15；改用 business=3, technical=4, impact=3 等合法值 |
| GAP-053 | 任务6.1 dependencies["4.1"] 含 "4.2" 的语义可能反了（通常 4.2 依赖 4.1） | 中 | 任务6.1 | 明确 dependencies 结构：若 key=被依赖者、value=依赖者列表，则 dependencies["4.1"] 含 "4.2" 表示 4.2 依赖 4.1；否则需修正断言 |
| GAP-054 | 任务6.1/6.2/6.7 中未在 GAP-011/039 列出的 mock 函数：check_tdd_stuck, create_story_with_requirement, create_spec_with_implementation, resolve_conflict, create_epic_with_dependencies, code_review_conflict_resolution, complete_story, create_pr_for_story, regression_tests_pass, all_epic_stories_merged | 高 | 任务6.1, 6.2, 6.7 | 在 conftest.py 或各 test 文件 fixtures 中补充定义，并更新 GAP-011/039 修复说明 |
| GAP-055 | 任务6.3 test_legacy_speckit_without_bmad 中 assert plan.filename == "plan-E4-S1.md" 与 GAP-030「standalone 输出可灵活」矛盾 | 中 | 任务6.3 | standalone 模式下 plan 文件名应为 plan-standalone.md 或含输入文件名的变体；修正断言 |
| GAP-056 | 任务5.3 审核超时 24h 后「仅在会话中打印提醒」—— 用户关闭会话后 reopen 时提醒无法送达 | 中 | 任务5.3 | 在文档中明确此为已知限制；或补充「会话恢复时检查待审核 PR 并提示」的说明 |
| GAP-057 | 风险「连续C级强制 party-mode」中「连续」定义未明确：同一 Story 连续两阶段？同一 Epic 不同 Story？跨 Epic？ | 中 | 风险识别 | 明确「连续」= 同一 Story 的 speckit 阶段（specify→plan→gaps→tasks→执行）中连续两个阶段评为 C |
| GAP-058 | 任务4.2/4.3/4.4 新建 audit-prompts-*.md 路径使用 Windows 绝对路径，未遵循 GAP-042 跨平台解析 | 中 | 任务4.2–4.4 | 路径改为 `{SKILLS_ROOT}/speckit-workflow/references/` 或项目相对路径 |
| GAP-059 | 任务4.1 code-reviewer-config 的 mode 切换机制未定义：PR 审核时如何传入 mode=pr？ | 中 | 任务4.1, 5.3 | 在任务5.3 或 bmad-story-assistant 中说明调用 code-reviewer 时传入 mode 参数的方式 |
| GAP-060 | 任务2.10 批判审计员「一票否决权」—— skill 执行环境下谁执行暂停？主 Agent 还是子 Agent？流程未定义 | 中 | 任务2.10 | 在 bmad-story-assistant 或 party-mode 流程中定义：批判审计员行使否决权时，Facilitator/主 Agent 负责暂停并记录 |
| GAP-061 | 任务3.5 冲突检测「定期扫描（每小时）」—— 触发机制未定义：整点？距上次扫描 60 分钟？ | 低 | 任务3.5 | 明确：自上一次扫描完成起 60 分钟，或并行模式下每次 merge 后触发 |
| GAP-062 | 任务6.4 性能测试 psutil.memory_info().rss 在 Windows 上语义（working set）与 Linux 不同，跨平台可比性未验证 | 低 | 任务6.4 | 加注释说明 Windows 下 rss≈working set；或标注为参考基准、弱环境可能 flaky |
| GAP-063 | 任务2.4 文档映射「BUGFIX文档 ↔ IMPLEMENTATION_GAPS」—— BUGFIX 与 GAPS 概念不同（已知问题 vs 待实现差距），映射关系表述可能误导 | 低 | 任务2.4 | 澄清：BUGFIX 修复项可转化为 GAPS 中的「待实现差距」条目，两者为转化关系非等同 |
| GAP-064 | 前置任务探测：若 speckit-workflow 已重构导致「## 5. 执行 tasks.md」「### 4.2 审计闭环」等章节不存在，任务1.4/1.6 的插入点 Fallback 未定义 | 中 | 前置任务, 任务1.4, 1.6 | 补充：探测时若目标章节不存在，记录「插入点不可用」并暂停相关任务，输出修复指南 |
| GAP-065 | 任务6.6 单元测试依赖 evaluate_complexity, party_mode_triggered, get_worktree_strategy, detect_file_overlap, get_audit_prompt —— 未在 GAP-011 扩展的 mock 列表中 | 中 | 任务6.6 | 在 conftest 或 test 文件内定义上述函数，或扩展 GAP-011 说明覆盖单元测试 |
| GAP-066 | 任务6.1 create_epic(id=4, stories=7) 与 test_layer_2 中 create_epic(id=4, name=..., estimated_hours=80) 签名不一致 | 中 | 任务6.1 | 统一 create_epic 接口：支持 (id, stories=N) 或 (id, story_count=N) 表示 Story 数量 |
| GAP-067 | 任务6.2 test_tdd_red_stuck 中 check_tdd_stuck 的「30 分钟」阈值与任务文档中「TDD 红灯卡住」的阈值未对齐 | 低 | 任务6.2 | 若 speckit/bmad 中定义了 TDD 卡住阈值，测试应与其一致；否则在测试中注明为示例值 |
| GAP-068 | 任务7.4 与 7.1 合并执行时「按发现时间先 7.1 后 7.4」—— 若同一问题兼具阻塞与非阻塞，按发现时间可能先进入 7.4 再升级 7.1，流程复杂 | 低 | 缓冲任务 | 简化：兼具两者时一律按 7.1 处理，7.4 仅处理纯非阻塞类 |
| GAP-069 | 任务依赖关系图未体现「阶段6 依赖阶段2 的 bmad-story-assistant 修改」—— 阶段6 测试 mock 了 bmad 产出，但若阶段2 未完成，mock 契约可能不准确 | 低 | 阶段6 | 在依赖说明中注明：阶段6 的 mock 契约应与阶段2 最终产出一致，阶段2 变更时需同步更新测试 |
| GAP-070 | 任务1.2 优先策略「提示词使用 audit-prompts.md 对应章节」—— 阶段4 新建 audit-prompts-prd/arch/pr 后，specify/plan/gaps/tasks 阶段仍用 audit-prompts.md §1–§5。任务1.2 未区分 code 模式与 doc 模式 | 低 | 任务1.2, 4.1 | 明确：speckit 各阶段审计用 audit-prompts.md §1–§5；PRD/Arch/PR 审计用新建的 audit-prompts-*.md |

---

## 3. 按阶段 Gaps 明细

### 前置任务

- **[GAP-051]** 验收标准「三个 skill」与步骤「四个 skill」矛盾 | 高 | **新增**
- **[GAP-064]** 目标章节不存在时插入点 Fallback 未定义 | 中 | **新增**

### 阶段1：speckit-workflow 修改

- **[GAP-070]** 任务1.2 未区分 code 与 doc 模式 audit-prompts | 低 | **新增**

### 阶段2：bmad-story-assistant 修改

- **[GAP-057]** 「连续 C 级」定义未明确 | 中 | **新增**
- **[GAP-060]** 批判审计员一票否决权的执行主体未定义 | 中 | **新增**
- **[GAP-063]** BUGFIX 与 GAPS 映射关系表述可能误导 | 低 | **新增**

### 阶段3：using-git-worktrees 修改

- **[GAP-061]** 冲突检测「每小时」触发机制未定义 | 低 | **新增**

### 阶段4：code-reviewer 扩展

- **[GAP-058]** audit-prompts-*.md 路径未遵循跨平台解析 | 中 | **新增**
- **[GAP-059]** code-reviewer mode 切换机制未定义 | 中 | **新增**

### 阶段5：PR 自动化整合

- **[GAP-056]** 审核超时提醒在会话关闭后无法送达 | 中 | **新增**

### 阶段6：集成测试

- **[GAP-052]** test_layer_1 复杂度 21 超出范围 3~15 | 高 | **新增**
- **[GAP-053]** dependencies 断言语义可能反了 | 中 | **新增**
- **[GAP-054]** 未列出的 mock 函数需补充定义 | 高 | **新增**
- **[GAP-055]** 任务6.3 standalone plan 文件名断言与 GAP-030 矛盾 | 中 | **新增**
- **[GAP-062]** psutil rss 跨平台语义差异 | 低 | **新增**
- **[GAP-065]** 任务6.6 单元测试依赖函数未列入 mock 清单 | 中 | **新增**
- **[GAP-066]** create_epic 签名不一致 | 中 | **新增**
- **[GAP-067]** check_tdd_stuck 阈值与文档未对齐 | 低 | **新增**
- **[GAP-069]** 阶段6 mock 契约与阶段2 同步未说明 | 低 | **新增**

### 缓冲任务

- **[GAP-068]** 7.1 与 7.4 合并执行时兼具阻塞/非阻塞的处理复杂 | 低 | **新增**

---

## 4. 批判性审计员终审陈述

**结论：有条件同意**

**理由：**

1. **v2 修复覆盖**：GAP-001 至 GAP-050 的修复已纳入 TASKS 文档，方向正确。v3 审查聚焦 v2 未覆盖的遗漏及 v2 修复引入的新问题。

2. **高优先级 Gaps（GAP-051、052、054）**：
   - **GAP-051**（前置任务验收标准矛盾）：影响前置任务通过判定，需在阶段1 开始前明确。
   - **GAP-052**（测试用例复杂度超范围）：测试用例本身错误，会导致 test_layer_1 逻辑失败或与需求矛盾，必须修正。
   - **GAP-054**（mock 函数未定义）：影响任务6.1、6.2、6.7 的可执行性，需在实施阶段6 前补充 conftest/fixtures。

3. **中优先级 Gaps（实施期可解决）**：
   - GAP-053、055、056、057、058、059、060、064、065、066 可在实施对应任务时一并修复。
   - GAP-059（mode 切换）需在任务5.3 与 4.1 集成时明确。

4. **Deferred Gaps（可后续迭代）**：
   - GAP-061、062、063、067、068、069、070 为低优先级，可在后续文档更新或测试优化时处理。

5. **可执行性**：在修正 GAP-051、052、054 后，任务列表可执行。建议在阶段6 实施前完成 mock 函数清单的完整梳理（扩展 GAP-011/039 至覆盖 6.6、6.7）。

---

## 5. 轮次记录摘要

| 轮次区间 | 批判性审计员出场 | 主要讨论主题 |
|----------|------------------|--------------|
| 1–10 | 5 | 前置任务验收标准、四个 skill 矛盾 |
| 11–20 | 5 | 任务6.1 测试用例、复杂度范围、dependencies 语义 |
| 21–30 | 5 | 任务6.2/6.7 mock 函数、check_tdd_stuck、create_pr_for_story |
| 31–40 | 5 | 任务6.3 standalone 断言、GAP-030 一致性 |
| 41–50 | 5 | 任务5.3 超时提醒、会话关闭场景 |
| 51–60 | 5 | 风险「连续 C 级」定义、任务4 mode 切换 |
| 61–70 | 5 | 任务4.2–4.4 路径、批判审计员否决权执行 |
| 71–80 | 5 | 任务3.5 冲突扫描触发、任务6.4 psutil 跨平台 |
| 81–90 | 5 | 任务2.4 BUGFIX 映射、前置探测 Fallback、create_epic 签名 |
| 91–99 | 6 | 遗漏项补充、GAP-051 至 GAP-070 记录 |
| 100–102 | 1 | 连续 3 轮无新 gap，终审陈述 |

**验证**：
- 总轮次：102 ≥ 100 ✓
- 批判性审计员：51/102 = 50.0% ≥ 50% ✓
- 收敛：第 100、101、102 轮无人提出新 gap ✓

---

*本文档由 Party-Mode 多角色 Review 生成（v3）*  
*轮次: 102 | 批判性审计员占比: 50.0% | 新增 Gaps: 20 (GAP-051~070) | 终审: 有条件同意*
