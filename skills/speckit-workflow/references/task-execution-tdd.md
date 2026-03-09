# Tasks 执行规则：TDD 红绿灯模式（详细参考）

执行 tasks.md（或 tasks-v*.md）中的未完成任务时必须遵守本文件的全部规则。

**执行顺序**：WRITE test → RUN → ASSERT FAIL → WRITE code → RUN → ASSERT PASS → REFACTOR。禁止先写生产代码再补测试。

**【TDD 红绿灯阻塞约束】** 每个涉及生产代码的任务执行顺序为：
1. 先写/补测试并运行验收 → 必须得到失败结果（红灯）
2. 立即在 progress 追加 [TDD-RED] <任务ID> <验收命令> => N failed
3. 再实现并通过验收 → 得到通过结果（绿灯）
4. 立即在 progress 追加 [TDD-GREEN] <任务ID> <验收命令> => N passed
5. 若有重构，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>
禁止在未完成步骤 1–2 之前执行步骤 3。禁止所有任务完成后集中补写 TDD 记录。

---

## 1. TDD 红灯-绿灯-重构循环

### 1.1 红灯阶段（编写测试）

- 阅读当前任务的需求追溯，检索并阅读相关需求文档章节。
- 编写或补充覆盖当前任务验收标准的测试用例。
- 运行测试，**确认测试失败**（红灯），验证测试的有效性。
- 若测试直接通过，说明测试无效或功能已存在，需修正测试或确认后跳过该测试。

### 1.2 绿灯阶段（最小实现）

- 编写**最少量**生产代码使测试通过。
- 运行测试，确认全部通过（绿灯）。
- 此阶段不追求代码质量，仅追求测试通过。

### 1.3 重构阶段（代码优化）

- 在测试保护下优化代码：命名、解耦、消除重复、改善可读性。
- 对照业界最佳实践审视实现：SOLID 原则、设计模式、性能优化。
- 每次重构后运行测试，确保仍全部通过。
- **重构至符合最佳实践后方可结束本阶段**，不得跳过重构。

---

## 2. 进度追踪与状态更新

### 2.0 progress 模板预填 TDD 槽位

生成 progress 时，对每个 US 预填以下占位行；模型执行时将 `_pending_` 替换为实际结果：

**涉及生产代码的 US**：
```
# US-001: Create user entity
[TDD-RED]   _pending_
[TDD-GREEN] _pending_
[TDD-REFACTOR] _pending_
---
```

**仅文档/配置的 US**：
```
# US-002: Add config value
[DONE] _pending_
---
```

替换格式示例：`[TDD-RED] T1 pytest tests/test_xxx.py -v => N failed`

### 2.1 TodoWrite 追踪

- 开始执行前，使用 TodoWrite 创建所有未完成任务的追踪列表。
- 每个任务开始时标记 `in_progress`，完成时标记 `completed`。
- 同一时间仅一个任务处于 `in_progress` 状态。

### 2.2 tasks.md 复选框更新

- 任务完成后**立即**更新 tasks.md（或 tasks-v*.md）中的复选框 `[ ]` → `[x]`。
- 禁止批量延迟更新；每完成一个任务即更新一次。

### 2.3 长时间脚本处理

- pytest、构建脚本等长时间运行的命令使用 `block_until_ms: 0` 后台运行。
- 启动后轮询 `terminals/` 目录检查结果文件。
- 使用指数退避策略轮询（2s → 4s → 8s → 16s...），根据命令预估时长调整。
- 等待 `exit_code` 出现后读取完整输出判断结果。

---

## 3. 执行约束（15 条铁律）

### 第一类：架构与需求忠实性

1. **严格按文档技术架构实施**：必须严格按照文档中记录的技术架构和选型进行实施，禁止擅自修改实施的技术架构和选型。
2. **严格按文档需求范围实施**：必须严格按照文档中记录的需求范围和功能范围进行实施，禁止擅自修改需求范围和功能范围，禁止以先实施最小实现为由擅自偏离用户的真正需求和意图。

### 第二类：禁止伪实现

3. **禁止标记完成但功能未实际调用**：任务标记为完成时，对应功能必须已在生产代码的关键路径中被实际调用。
4. **禁止仅初始化对象而不在关键路径中使用**：创建的对象、类、模块必须在生产代码路径中被真正使用，不得仅存在于初始化阶段。
5. **禁止用「预留」「占位」等词规避实现**：所有功能必须完整实现，不得用占位符、TODO 注释或预留接口代替真实实现。
6. **禁止假完成、禁止伪实现**：所有任务必须有真实的功能实现和可验证的运行结果。

### 第三类：测试与回归

7. **主动修复测试脚本**：必须主动进行测试脚本的修复，禁止以测试用例与本次开发无关为由逃避修复。发现的测试问题无论来源均需修复。
8. **主动回归测试**：必须主动进行回归测试，应尽早发现功能回退问题，禁止掩盖问题。每完成一个任务后运行相关测试套件，每完成一个检查点后运行全量回归。

### 第四类：重构标准

9. **主动重构至最佳实践**：如果生成的代码不符合最佳实践，应该在红绿灯的重构阶段主动进行重构，直到符合最佳实践为止。审视标准包括：SOLID 原则、DRY、清晰命名、适当抽象层次、错误处理、性能考量。

### 第五类：流程完整性

10. **禁止提前停止**：禁止在所有未完成任务真正实现并完成之前擅自停止开发工作。必须持续推进直到所有任务完成或遇到不可解决的阻塞。
11. **检查点前验证前置任务**：遇到检查点时验证所有前置任务已完成。列出前置任务清单，逐一确认状态为 completed，运行检查点要求的全部验证命令。
12. **查阅前置文档**：如需参考设计，查看前置相关的需求文档/plan文档/IMPLEMENTATION_GAPS文档。实施前执行需求追溯（见下 §5）。

### 第六类：进度追踪

13. **TodoWrite 追踪进度**：使用 TodoWrite 追踪进度，每个任务标记 `in_progress` / `completed`。
14. **立即更新复选框**：完成任务后立即更新 tasks.md（或 tasks-v*.md）中的复选框 `[ ]` → `[x]`。
15. **长时间脚本后台运行**：pytest/长时间脚本使用 `block_until_ms: 0` 后台运行，然后轮询 `terminals/` 检查结果。

---

## 4. 检查点验证流程

遇到任务检查点（Checkpoint）时：

1. 列出所有前置任务，确认 TodoWrite 状态均为 `completed`，tasks.md 中复选框均为 `[x]`。
2. 运行该检查点要求的所有验证命令。
3. 执行全量回归测试（`pytest` 相关测试目录），确保无功能回退。
4. 仅当所有验证通过后方可继续后续任务。
5. 若验证失败，回退修复问题任务，修复后重新运行验证直至通过。

---

## 5. 需求追溯（每个任务实施前必填）

每个任务开始实施前，须完成需求追溯：

- **问题关键词**: 当前任务涉及的核心概念（如 DuckDB、副图叠加、SharedMemory）
- **检索范围**: specs/ 下相关需求文档、设计文档
- **相关章节**: 需求文档中的具体章节编号（如 §3.1, §4.2）
- **既有约定摘要**: 已有设计决策和约定（如技术选型、数据结构定义）
- **方案是否与需求一致**: 是 / 否（若否，说明原因及是否需要更新需求）

---

## 6. 单任务执行伪代码

```
FOR EACH uncompleted_task IN tasks_md:
    TodoWrite(task.id, status="in_progress")

    # 需求追溯
    READ related requirement docs (specs/, plan.md, IMPLEMENTATION_GAPS.md)
    FILL requirement traceability fields

    # 红灯
    WRITE test cases covering acceptance criteria
    RUN tests → ASSERT tests FAIL (red)

    # 绿灯
    WRITE minimum production code
    RUN tests → ASSERT tests PASS (green)

    # 重构
    WHILE code does NOT meet best practices:
        REFACTOR code (SOLID, DRY, naming, decoupling, performance)
        RUN tests → ASSERT tests STILL PASS
    END WHILE

    # 回归
    RUN regression tests for related modules
    IF regression failure:
        FIX regression → RE-RUN until all pass
    END IF

    # 更新进度
    UPDATE tasks_md checkbox [ ] → [x]
    TodoWrite(task.id, status="completed")

    # 检查点（如有）
    IF task is checkpoint:
        VERIFY all prerequisite tasks completed
        RUN full regression suite
        ASSERT all pass before continuing
    END IF
END FOR
```
