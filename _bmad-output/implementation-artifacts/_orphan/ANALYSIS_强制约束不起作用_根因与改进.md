# 强制约束不起作用：根因分析与改进方案

## §1 现象

执行 speckit-workflow 的提示词中已声明约束：

- ralph-method：prd 与 progress 须在 story 目录
- TDD：红灯 → 绿灯 → 重构
- 禁止伪实现

但在「生成 speckit 文档后直接执行 tasks」时，约束未被遵守，表现为：

- 未创建 prd / progress
- 未按 TDD 红绿灯模式执行

---

## §2 根因分析

### 2.1 约束未嵌入执行步骤（主因）

用户提示词结构类似：

```text
第一阶段：产出 speckit 文档
1. specify → spec
2. plan → plan
3. GAPS → IMPLEMENTATION_GAPS
4. tasks → tasks

第二阶段：执行 tasks
5. 按 tasks 实施
6. 运行验收命令

约束
- ralph-method：...
- TDD：...
```

问题：约束在末尾单独列出，而步骤 5、6 仅写「按 tasks 实施」「运行验收命令」，未在步骤内部重复 ralph-method 与 TDD 要求。模型会把约束视为「背景性指导」，而非「必须按序执行的检查点」，从而在执行时忽略。

### 2.2 未加载 speckit.implement 命令

- `commands/speckit.implement.md` 中有 ralph-method 和 TDD 的强制步骤（步骤 3.5、6、8）。
- 用户提示词未要求执行 `/speckit.implement` 或「加载 commands/speckit.implement.md」。
- 模型在阶段二直接按 tasks 编码，不加载 implement 命令，因此不会执行其中的 prd/progress 与 TDD 步骤。

### 2.3 speckit.tasks handoff 提示词过于简略

`speckit.tasks.md` 的 handoff 为：

```yaml
handoffs: 
  - label: Implement Project
    agent: speckit.implement
    prompt: Start the implementation in phases
    send: true
```

`"Start the implementation in phases"` 没有引用 ralph-method、prd/progress、TDD。接手方可能只按泛化「执行实现」理解，而不会按 implement 命令的完整流程执行。

### 2.4 同一会话内连续执行

阶段一、二在同一请求或同一会话中连续执行时：

- 模型完成阶段一（产出文档）后直接进入阶段二
- 不会重新加载 implement 命令或 speckit-workflow skill
- 阶段二完全依赖当前上下文，而该上下文中未嵌入「执行前创建 prd/progress」和「TDD 三行记录」等硬性要求

---

## §3 改进方案

### 3.1 在用户提示词中把约束写进执行步骤（推荐）

把 ralph-method 与 TDD 直接写进第二阶段的每一步，而不是单独放在「约束」小节。

示例：

```markdown
第二阶段：执行 tasks

5. 按 tasks 实施（必须遵守以下顺序）：
   5.1 【ralph-method 强制前置】在 story-7-1-dashboard-generator 目录下创建 prd.tasks-E7-S1.json 与 progress.tasks-E7-S1.txt；若已存在则跳过。禁止在未创建前开始编码。
   5.2 逐任务执行 TDD 循环：
       - 红灯：为当前任务写/补测试，运行验收命令，确认失败
       - 绿灯：实现最少量代码使测试通过
       - 重构：在 progress 追加 [TDD-REFACTOR] 一行（无重构可写「无需重构 ✓」）
   5.3 每完成一 US：立即更新 prd（passes=true）、progress（story log + TDD 三行）
6. 运行验收命令验证
```

### 3.2 明确要求加载 implement 命令

在第二阶段开头加一条硬性要求：

```markdown
第二阶段开始前：必须执行 `/speckit.implement` 命令，或完整加载 commands/speckit.implement.md 并按其中步骤 1–9（含 3.5、6、8）执行，禁止跳过 prd/progress 创建与 TDD 记录。
```

### 3.3 强化 speckit.tasks handoff 提示词

修改 `.cursor/commands/speckit.tasks.md` 的 handoff prompt，由：

```yaml
prompt: Start the implementation in phases
```

改为更明确、包含 ralph-method 与 implement 命令引用的版本，例如：

```yaml
prompt: |
  Execute /speckit.implement in full: create prd & progress before any coding (step 3.5),
  follow TDD red-green-refactor per task (steps 6, 8), update prd/progress per US.
  Load commands/speckit.implement.md if not already loaded.
```

或在 `speckit.implement.md` 顶部加一段说明，说明 handoff 时也必须完整执行 implement 流程。

### 3.4 使用 bmad-story-assistant 或 /speckit.implement

若使用 bmad-story-assistant，其 STORY-A3-DEV 模板已包含：

- 前置检查（含 prd/progress 存在性）
- 「必须嵌套执行 speckit-workflow」：specify → plan → GAPS → tasks → 执行
- implement 执行约束（加载 speckit-workflow、ralph-method 或至少遵守 implement 步骤 3.5、6、8）

若直接用 speckit，建议在阶段二明确写出：**执行 `/speckit.implement`**，而不是泛泛地说「按 tasks 实施」。

---

## §4 小结

| 根因 | 改进 |
|------|------|
| 约束只写在「约束」小节，未嵌入执行步骤 | 把 prd/progress 与 TDD 写进步骤 5 的子步骤 |
| 未加载 implement 命令 | 在阶段二开头要求执行 `/speckit.implement` 或加载 implement 命令 |
| speckit.tasks handoff 过简 | 把 handoff prompt 改为引用 implement 步骤 3.5、6、8 |
| 同一会话连续执行 | 在阶段一结束后显式要求「加载 implement 后再执行阶段二」 |

建议优先采用 **3.1（把约束嵌入执行步骤）** 和 **3.2（明确要求加载 implement）**，两条同时使用效果最好。
