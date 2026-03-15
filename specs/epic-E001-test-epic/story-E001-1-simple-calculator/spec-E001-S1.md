# Spec E001-S1: 验证 Story 开发流程（含代码实现）

**Epic**: E001-test-epic
**Story**: E001-1-simple-calculator
**状态**: draft
**创建时间**: 2026-03-15
**审计粒度**: story（中间阶段基础验证，实施后完整审计）

---

## 1. 概述

### 1.1 目的

本 Story 旨在通过实现一个简单的计算器模块来验证 BMAD Story 流程的完整性和正确性，包括：
- Story 创建与审计
- 中间阶段（specify/plan/gaps/tasks）的基础验证
- 代码实现（TDD 红绿灯）
- 实施后完整审计与评分写入

### 1.2 范围

**包含**：
- TypeScript 计算器模块实现（`src/calculator.ts`）
- Vitest 测试文件（`test/calculator.test.ts`）
- 四则运算函数：add, subtract, multiply, divide
- 除零检查与错误处理

**不包含**：
- UI 界面
- 持久化存储
- 高级数学运算

---

## 2. 技术规格

### 2.1 技术栈

| 组件 | 选型 | 版本 |
|------|------|------|
| 语言 | TypeScript | 5.x |
| 测试框架 | Vitest | 已配置 |
| 包管理器 | npm | - |
| 代码风格 | ESLint | 项目规则 |

### 2.2 模块设计

#### 2.2.1 文件结构

```
project-root/
├── src/
│   └── calculator.ts      # 计算器模块（新增，不提交）
├── test/
│   └── calculator.test.ts # 测试文件（新增，不提交）
└── ...
```

#### 2.2.2 函数签名

```typescript
// src/calculator.ts

/**
 * 两数相加
 * @param a - 第一个操作数
 * @param b - 第二个操作数
 * @returns 两数之和
 */
export function add(a: number, b: number): number;

/**
 * 两数相减
 * @param a - 被减数
 * @param b - 减数
 * @returns 差值
 */
export function subtract(a: number, b: number): number;

/**
 * 两数相乘
 * @param a - 第一个操作数
 * @param b - 第二个操作数
 * @returns 乘积
 */
export function multiply(a: number, b: number): number;

/**
 * 两数相除
 * @param a - 被除数
 * @param b - 除数
 * @returns 商
 * @throws Error 当除数为 0 时抛出错误
 */
export function divide(a: number, b: number): number;
```

### 2.3 错误处理

| 场景 | 处理方式 |
|------|----------|
| 除数为 0 | 抛出 `Error("Division by zero is not allowed")` |
| 非数字参数 | TypeScript 类型系统约束（运行时行为依赖 JS） |

### 2.4 测试策略

#### 2.4.1 单元测试覆盖

每个函数需覆盖以下场景：

| 函数 | 测试场景 |
|------|----------|
| add | 正数相加、负数相加、正负数混合、小数、零 |
| subtract | 正数相减、负数相减、结果为负、小数、零 |
| multiply | 正数相乘、负数相乘（结果正/负）、含零、小数 |
| divide | 正数相除、负数相除、小数、**除零错误** |

#### 2.4.2 测试覆盖率要求

- 最低覆盖率：80%
- 目标覆盖率：85%+

---

## 3. 验收标准

### 3.1 功能验收

| AC | 描述 | 验证方式 |
|----|------|----------|
| AC-1 | Story 创建成功 | 检查 Story 文档存在且结构完整 |
| AC-2 | Story 审计通过 | 审计报告显示通过 |
| AC-3 | 中间阶段使用基础验证 | 检查各阶段有 `<!-- BASIC_REVIEW: PASSED -->` 标记 |
| AC-4 | 代码实现成功 | 所有测试通过 + 覆盖率 ≥ 80% |
| AC-5 | 实施后审计执行完整审计 | 审计报告含评分维度 |
| AC-6 | 流程端到端可追溯 | 状态文件完整 |

### 3.2 质量验收

| 维度 | 要求 |
|------|------|
| 测试覆盖率 | ≥ 80% |
| Lint | 无错误、无警告 |
| 类型检查 | 无 TypeScript 错误 |

---

## 4. 依赖与约束

### 4.1 依赖

- 项目已配置 Vitest 测试框架
- 项目已配置 ESLint
- 项目已配置 TypeScript

### 4.2 约束

- 代码文件仅用于流程验证，**不提交到版本库**
- 遵循 TDD 红绿灯流程
- 遵循项目 ESLint 规则

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 测试覆盖率不达标 | 审计失败 | 每个函数编写充足测试用例 |
| 除零处理遗漏 | 功能缺陷 | 明确测试除零场景 |

---

## 需求映射清单（spec.md ↔ Story 文档）

| Story 文档章节 | Story 需求要点 | spec.md 对应位置 | 覆盖状态 |
|----------------|----------------|------------------|----------|
| Story 目的 | 验证 BMAD Story 流程 | spec §1.1 | ✅ |
| AC-1 | Story 创建成功 | spec §3.1 | ✅ |
| AC-2 | Story 审计通过 | spec §3.1 | ✅ |
| AC-3 | 中间阶段基础验证 | spec §1.1, §3.1 | ✅ |
| AC-4 | 代码实现成功 | spec §2, §3.1 | ✅ |
| AC-4.1 | add 函数 | spec §2.2.2 | ✅ |
| AC-4.2 | subtract 函数 | spec §2.2.2 | ✅ |
| AC-4.3 | multiply 函数 | spec §2.2.2 | ✅ |
| AC-4.4 | divide 函数 + 除零检查 | spec §2.2.2, §2.3 | ✅ |
| AC-4.5 | 测试覆盖率 ≥ 80% | spec §2.4.2 | ✅ |
| AC-5 | 实施后完整审计 | spec §3.1 | ✅ |
| AC-6 | 流程端到端可追溯 | spec §3.1 | ✅ |
| Dev Notes | TypeScript + Vitest | spec §2.1 | ✅ |
| Dev Notes | 错误处理约定 | spec §2.3 | ✅ |
| Dev Notes | 测试策略 | spec §2.4 | ✅ |

---

## 参考文档

- [Story 文档](../../../_bmad-output/implementation-artifacts/epic-E001-test-epic/story-E001-1-simple-calculator/E001-1-simple-calculator.md)

---

<!-- BASIC_REVIEW: PASSED -->
<!-- 验证时间: 2026-03-15 -->
<!-- 验证模式: story (中间阶段基础验证) -->
<!-- 检查项: document_exists, schema_valid, required_sections - 全部通过 -->
- [Epic 文档](../epic.md)
- [审计粒度配置](../../../config/bmad-story-config.yaml)