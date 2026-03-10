---
title: Cursor Subagent 与 BMAD Agent 对比与关联
description: feature-architect、mcp_task generalPurpose、code-reviewer、bmad-architect 等组件的区别、模型配置及使用建议
date: 2026-02-26
---

<!-- markdownlint-disable MD025 MD060 -->

# Cursor Subagent 与 BMAD Agent 对比与关联

本文档记录 Cursor 中子代理（subagent）、BMAD 角色型 Agent、以及 `mcp_task` 等组件的区别、模型配置与使用关联，供团队查阅与选型参考。

---

## 一、feature-architect 与 mcp_task generalPurpose 的区别

### 1.1 本质差异

| 维度 | feature-architect | mcp_task generalPurpose |
|------|-------------------|-------------------------|
| **类型** | 自定义 subagent（领域专用） | 通用子任务执行器 |
| **预置内容** | 有五阶段预置 prompt（Discovery、Ideation、Analysis、Prioritization、Specification） | 无预置 prompt，空白画布 |
| **模型配置** | 可配置 model（如 sonnet） | 需在 prompt 中说明 |
| **专业性** | 自带领域专业性与工作流 | 专业性与流程需全部写在 prompt 中 |
| **每次调用** | 基于已有阶段与约束执行 | 需在 prompt 中传入完整任务说明 |

**简要结论**：feature-architect 自带功能设计领域的专业工作流；generalPurpose 是通用空白画布，所有内容依赖 prompt 编写。

### 1.2 适用场景

| 场景 | 推荐使用 |
|------|----------|
| 功能设计、方案规划、需求梳理 | feature-architect |
| 多步调研、实施、脚本执行等任意任务 | mcp_task generalPurpose |
| 需要可复现的领域工作流 | feature-architect |
| 需要灵活定制、临时任务 | generalPurpose |

---

## 二、.claude/agents/code-reviewer 与 model 指定

### 2.1 Cursor 子代理的 model 配置

Cursor 自定义 subagent 可在 YAML frontmatter 中指定 model：

| 取值 | 含义 |
|------|------|
| `inherit` | 继承父 Agent 模型 |
| `fast` | 使用快速模型 |
| 具体 model ID | 使用指定模型（如 sonnet、opus 等） |

### 2.2 mcp_task 与 code-reviewer 的关系

| 组件 | subagent_type 支持 | 说明 |
|------|--------------------|------|
| mcp_task | generalPurpose、explore、shell | 不支持 code-reviewer 类型 |
| Cursor Task | 从 `.claude/agents/` 或 `.cursor/agents/` 发现并调度 code-reviewer | 支持自定义审计子代理 |

**审计步骤建议**：

1. **优先**：通过 Cursor Task 调度 code-reviewer（从 `.claude/agents/` 或 `.cursor/agents/` 发现）
2. **回退**：若 Cursor Task 调度失败，使用 `mcp_task generalPurpose` 执行审计逻辑

### 2.3 已知问题与注意事项

- **社区 bug**：子代理可能继承父 Agent 模型而非配置的 model
- **Max Mode**：需开启 Max Mode 才能使用指定 model
- **文档引用**：审计逻辑可引用 `audit-prompts.md §5` 等规范

---

## 三、feature-architect 与 bmad-architect（Winston 架构师）的关联

### 3.1 定位对比

| 维度 | bmad-architect（Winston） | feature-architect |
|------|---------------------------|-------------------|
| **调用方式** | BMAD 命令（`/bmad-agent-bmm-architect`） | Cursor subagent，主 Agent 委托 |
| **交互模式** | 交互式，有菜单（Create Architecture、Implementation Readiness、Party Mode 等） | 一次性执行，无菜单 |
| **Persona 侧重** | 技术架构（分布式、云、API、系统设计） | 产品与 UX（Product Strategist、功能设计） |
| **使用时机** | 需用户参与、多轮对话 | 自动委托、单次跑完 workflow |

### 3.2 人设差异

- **bmad-architect**：偏技术架构，关注分布式、云、API、实现可行性
- **feature-architect**：偏产品与 UX，关注功能设计、优先级、规格说明

### 3.3 关联方案

| 方案 | 描述 |
|------|------|
| **引用 persona** | 在 feature-architect 中引用 architect.md 的 Winston persona，增强技术视角 |
| **按场景选择** | 交互式需求用 bmad-architect；自动委托、单次执行用 feature-architect |

---

## 四、使用 mcp_task generalPurpose 执行 bmad-architect 的效果

### 4.1 设计差异

- **bmad-architect**：交互式设计，依赖菜单与多轮对话
- **mcp_task**：单次调用返回，无菜单交互

### 4.2 实现方式与效果

| 方式 | 实现 | 效果 |
|------|------|------|
| **跳过菜单** | 在 prompt 中让 generalPurpose 扮演 Winston，并直接执行 Create Architecture workflow | 可单次跑完架构工作流 |
| **完全等效** | 不可能 | 无法还原完整菜单交互与多轮选择 |

**结论**：通过 prompt 可实现「单次跑完 Create Architecture」，但无法完全替代 bmad-architect 的菜单交互。

---

## 五、审计子任务与模型选择信息展示

### 5.1 建议做法

在 code-reviewer 等审计子代理的报告**开头**增加「模型选择信息」表格：

| 列 | 说明 |
|----|------|
| 配置来源 | 如 YAML frontmatter、mcp_task 参数 |
| 指定模型 | 实际使用的 model 名称或 ID |
| 选择依据 | 继承 / 显式指定 / 回退等 |

### 5.2 价值

便于用户在子代理输出中直接看到 model 选择过程，方便复现与排查。

---

## 六、audit-prompts 路径与子代理优先顺序

### 6.1 audit-prompts 查找路径

| 优先级 | 路径 |
|--------|------|
| 首选 | 全局 skills：`~/.cursor/skills/speckit-workflow/` |
| 备选 | 项目内：`docs/speckit/skills/speckit-workflow/` |

### 6.2 审计子代理调度顺序

| 顺序 | 方式 | 说明 |
|------|------|------|
| 1 | Cursor Task 调度 code-reviewer | 从 `.claude/agents/` 或 `.cursor/agents/` 发现 |
| 2 | mcp_task generalPurpose | 当 Cursor Task 调度失败时回退 |

---

## 七、实践建议

### 7.1 选型原则

1. **功能设计、产品规划**：优先使用 feature-architect
2. **代码审计、规范验证**：优先 Cursor Task 调度 code-reviewer，失败则 generalPurpose
3. **交互式架构讨论**：使用 bmad-architect（`/bmad-agent-bmm-architect`）
4. **一次性架构输出**：可用 generalPurpose 扮演 Winston，在 prompt 中指定 workflow
5. **任意多步任务**：使用 mcp_task generalPurpose

### 7.2 模型配置

- 需要指定模型时，确保开启 Max Mode
- 子代理 model 若异常，优先检查 YAML frontmatter 与 Cursor Task 配置
- 审计报告建议包含「模型选择信息」表格

### 7.3 路径与回退

- audit-prompts 优先从全局 skills 查找
- 审计子代理：code-reviewer 优先，generalPurpose 作为回退

---

## 八、快速对照表

| 需求 | 推荐方式 | 备选 |
|------|----------|------|
| 功能设计、方案规划 | feature-architect | generalPurpose + 详细 prompt |
| 代码审计 | Cursor Task → code-reviewer | mcp_task generalPurpose |
| 交互式架构讨论 | bmad-architect | — |
| 单次架构输出 | generalPurpose 扮演 Winston | bmad-architect（需手动交互） |
| 调研、实施、脚本 | mcp_task generalPurpose | — |
| audit-prompts 引用 | `~/.cursor/skills/speckit-workflow/` | `docs/speckit/skills/speckit-workflow/` |

---

## 九、修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-02-26 | 1.0 | 初版，基于讨论主题汇总整理 |
