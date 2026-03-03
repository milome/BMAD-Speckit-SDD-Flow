# Speckit Plan "Waiting for Review" 状态解决方案

## 📋 问题描述

在执行 `/speckit.plan` 命令时，可能会遇到命令卡在 "waiting for review" 状态，无法继续执行。

## 🔍 原因分析

`/speckit.plan` 命令在以下情况下会等待用户确认或报错：

1. **Constitution Check 有违规项且未说明**（最常见）：
   - 当 Constitution Check 部分检测到违反项目规范的情况
   - **关键**：命令要求 "Evaluate gates (ERROR if violations unjustified)"
   - 如果违规项未在 Complexity Tracking 表格中说明，命令会报错或等待
   - 需要用户填写 Complexity Tracking 表格说明违规原因

2. **存在 NEEDS CLARIFICATION 标记**：
   - Technical Context 中有未解决的技术选型问题
   - 需要用户提供更多信息或做出决策
   - 这些标记必须在 Phase 0 的 research.md 中解决

3. **设计决策需要确认**：
   - 某些关键设计选择需要用户明确确认
   - 架构决策需要用户批准
   - Project Structure 中的选项需要用户选择

4. **关于 `.speckit.plan` 文件**：
   - 注意：命令应该生成 `plan.md` 文件，而不是 `.speckit.plan`
   - `.speckit.plan` 可能是历史命名约定或特殊情况下的文件名
   - 如果看到 `.speckit.plan` 文件，内容应该与 `plan.md` 相同

## ✅ 解决方案

### 方案 1：检查并完成 Constitution Check（最重要）

**步骤**：

1. **查看生成的文件**（可能是 `plan.md` 或 `.speckit.plan`）：
   ```bash
   # 在功能目录下
   ls -la plan.md .speckit.plan
   cat plan.md  # 或 cat .speckit.plan
   ```

2. **找到 Constitution Check 部分**：
   查看是否有未通过的检查项（标记为 ❌ 或显示为违规），例如：
   ```markdown
   ## Constitution Check
   
   ❌ **文件大小限制**: 某个文件预计 > 500 行
   ❌ **测试覆盖率**: 预计测试覆盖率 < 95%
   ```

3. **填写 Complexity Tracking 表格**（如果有违规）：
   - 在 `plan.md` 或 `.speckit.plan` 中找到 "Complexity Tracking" 部分
   - **关键**：即使只有一个违规项，也必须填写表格说明原因
   - 填写格式：
     ```markdown
     | Violation | Why Needed | Simpler Alternative Rejected Because |
     |-----------|------------|-------------------------------------|
     | 文件超过 500 行 | 需要完整的实现逻辑 | 拆分会导致过度耦合 |
     ```

4. **保存文件并继续执行命令**：
   - 保存修改后的文件
   - 在 AI 助手中明确回复：
     ```
     已检查 Constitution Check，违规项已在 Complexity Tracking 中说明，请继续生成完整的 plan.md
     ```
   - 或者如果所有检查都通过：
     ```
     Constitution Check 全部通过，无违规项，请继续生成 plan.md
     ```

**重要提示**：
- 命令要求 "ERROR if violations unjustified" - 如果有违规但未说明，命令会一直等待
- 即使只有一个 ❌ 标记，也必须填写 Complexity Tracking
- 如果所有检查都通过（全部是 ✅），则无需填写 Complexity Tracking

### 方案 2：解决 NEEDS CLARIFICATION 标记

**步骤**：

1. **查看 `plan.md` 中的 Technical Context**：
   ```markdown
   ## Technical Context
   
   **Language/Version**: NEEDS CLARIFICATION
   **Primary Dependencies**: NEEDS CLARIFICATION
   ```

2. **提供明确的技术选型**：
   在 AI 助手中回复，例如：
   ```
   Technical Context 确认：
   - Language/Version: Python 3.10+
   - Primary Dependencies: pandas, numpy
   - Testing: pytest
   - Target Platform: Windows, Linux, macOS
   
   请继续生成 plan.md
   ```

3. **或者让 AI 自动解决**：
   ```
   请根据项目上下文和最佳实践，自动解决所有 NEEDS CLARIFICATION 标记，然后继续
   ```

### 方案 3：确认设计决策

**步骤**：

1. **查看 AI 助手的问题或提示**：
   通常 AI 会显示类似：
   ```
   需要确认：是否采用模块化架构？
   - Option A: 单文件实现
   - Option B: 模块化设计（推荐）
   ```

2. **明确回复选择**：
   ```
   选择 Option B: 模块化设计
   ```
   或者：
   ```
   已确认设计决策，请继续
   ```

### 方案 4：手动继续（如果以上都不适用）

**步骤**：

1. **检查当前状态**：
   - 查看 `plan.md` 文件，看哪些部分已完成，哪些部分缺失
   - 查看 AI 助手的最后一条消息，看它在等待什么

2. **明确指示继续**：
   ```
   请继续完成 plan.md 的生成，包括：
   - Phase 0: research.md
   - Phase 1: data-model.md, contracts/, quickstart.md
   - Phase 2: 完整的 plan.md
   ```

3. **如果卡在特定阶段**：
   ```
   跳过当前等待，直接进入 Phase 0 生成 research.md
   ```

## 🎯 最佳实践

### 预防措施

1. **在执行 `/speckit.plan` 前**：
   - 确保 `spec.md` 完整且没有过多的 NEEDS CLARIFICATION
   - 提前准备好技术选型决策

2. **在 Constitution Check 阶段**：
   - 如果预计会有违规，提前准备好 Complexity Tracking 的说明
   - 在功能描述中就说明为什么需要这些"违规"

3. **主动提供信息**：
   - 在执行 `/speckit.plan` 时，可以主动提供技术上下文：
     ```
     /speckit.plan
     
     技术上下文：
     - Language: Python 3.10+
     - Dependencies: pandas, numpy
     - Testing: pytest
     ```

### 快速恢复流程

如果遇到 "waiting for review" 状态，按以下顺序尝试：

1. **第一步**：查看 `plan.md` 文件，找到需要确认的部分
2. **第二步**：回复 AI 助手，提供所需信息或确认
3. **第三步**：如果仍卡住，明确指示："请继续完成 plan.md 的生成"
4. **第四步**：如果还是不行，可以重新执行命令，但这次主动提供所有信息

## 📝 示例场景

### 场景 1：Constitution Check 违规

**问题**：
```
Constitution Check 显示：文件大小限制违规
Waiting for review...
```

**解决**：
1. 打开 `plan.md`，找到 Complexity Tracking 部分
2. 填写：
   ```markdown
   | Violation | Why Needed | Simpler Alternative Rejected Because |
   |-----------|------------|-------------------------------------|
   | 文件超过 500 行 | 需要完整的业务逻辑实现 | 拆分会导致职责不清 |
   ```
3. 回复 AI：
   ```
   已在 Complexity Tracking 中说明违规原因，请继续
   ```

### 场景 2：技术选型未确定

**问题**：
```
Technical Context 中有 NEEDS CLARIFICATION
Waiting for review...
```

**解决**：
1. 查看 `plan.md` 的 Technical Context 部分
2. 回复 AI：
   ```
   技术选型确认：
   - Language: Python 3.10+
   - Dependencies: pandas, numpy, vnpy
   - Testing: pytest
   - Platform: Windows, Linux, macOS
   
   请更新 Technical Context 并继续
   ```

### 场景 3：设计决策待确认

**问题**：
```
需要确认架构选择：单文件 vs 模块化？
Waiting for review...
```

**解决**：
1. 根据项目需求做出选择
2. 回复 AI：
   ```
   选择模块化架构，请继续生成 plan.md
   ```

## 🔧 故障排除

### 如果以上方法都不行

1. **检查文件状态**：
   ```bash
   # 查看 plan.md 或 .speckit.plan 是否已生成
   ls -la specs/XXX-feature-name/plan.md
   ls -la specs/XXX-feature-name/.speckit.plan
   
   # 查看文件内容
   cat specs/XXX-feature-name/plan.md
   # 或
   cat specs/XXX-feature-name/.speckit.plan
   ```

2. **检查 Constitution Check 状态**：
   ```bash
   # 查看 Constitution Check 部分
   grep -A 20 "Constitution Check" specs/XXX-feature-name/plan.md
   # 或
   grep -A 20 "Constitution Check" specs/XXX-feature-name/.speckit.plan
   ```

3. **明确指示 AI 继续**：
   在 AI 助手中明确回复：
   ```
   请忽略所有等待状态，直接完成 plan.md 的生成。
   如果有 Constitution Check 违规，请在 Complexity Tracking 中自动填写说明。
   请继续执行 Phase 0、Phase 1 和 Phase 2，生成完整的 plan.md 文件。
   ```

4. **重新执行命令**：
   ```bash
   # 在功能目录下重新执行
   /speckit.plan
   ```

5. **手动完成缺失部分**：
   - 如果 `plan.md` 已部分生成，可以手动补充缺失的部分
   - 然后继续执行后续命令（如 `/speckit.tasks`）

6. **关于 `.speckit.plan` vs `plan.md`**：
   - 如果生成了 `.speckit.plan` 而不是 `plan.md`，可以重命名：
     ```bash
     mv .speckit.plan plan.md
     ```
   - 或者让 AI 助手生成 `plan.md` 文件

## 📚 相关文档

- [Speckit Specs 目录使用指南](./speckit-specs目录使用指南.md)
- [Speckit 多模块开发最佳实践](./speckit多模块开发最佳实践.md)

## 💡 提示

- **主动沟通**：如果 AI 助手在等待，主动提供所需信息
- **检查文件**：经常查看生成的文件，了解当前进度
- **明确指示**：使用明确的指令告诉 AI 继续执行
- **分步执行**：如果一次性生成有问题，可以分阶段执行

---

**最后更新**：2026-01-14  
**维护者**：项目团队
