# Spec E001-S2: String Utilities Module

**Epic**: E001-test-epic
**Story**: E001-2-string-utils
**状态**: draft
**创建时间**: 2026-03-15
**审计粒度**: story（中间阶段基础验证，实施后完整审计）

---

## 1. 概述

### 1.1 目的

本 Story 旨在通过实现一个字符串工具模块来验证 BMAD Story 流程在 Layer 4 阶段的完整性和正确性，包括：
- Story 创建与审计
- 中间阶段（specify/plan/gaps/tasks）的基础验证（story 模式）
- 代码实现（TDD 红绿灯）
- 实施后完整审计与评分写入

### 1.2 范围

**包含**：
- TypeScript 字符串工具模块实现（`src/string-utils.ts`）
- Vitest 测试文件（`test/string-utils.test.ts`）
- 字符串处理函数：camelCase, kebab-case, truncate, isEmpty
- 输入验证与错误处理

**不包含**：
- UI 界面
- 持久化存储
- 正则表达式复杂处理

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
│   └── string-utils.ts      # 字符串工具模块（新增）
├── test/
│   └── string-utils.test.ts # 测试文件（新增）
└── ...
```

#### 2.2.2 函数签名

```typescript
// src/string-utils.ts

/**
 * 将字符串转换为 camelCase
 * @param str - 输入字符串
 * @returns camelCase 格式的字符串
 * @example camelCase("hello world") => "helloWorld"
 * @example camelCase("hello-world") => "helloWorld"
 * @example camelCase("hello_world") => "helloWorld"
 */
export function camelCase(str: string): string;

/**
 * 将字符串转换为 kebab-case
 * @param str - 输入字符串
 * @returns kebab-case 格式的字符串
 * @example kebabCase("hello world") => "hello-world"
 * @example kebabCase("helloWorld") => "hello-world"
 * @example kebabCase("Hello World") => "hello-world"
 */
export function kebabCase(str: string): string;

/**
 * 截断字符串，超过指定长度时添加省略号
 * @param str - 输入字符串
 * @param length - 最大长度
 * @returns 截断后的字符串
 * @example truncate("hello world", 5) => "he..."
 * @example truncate("hello", 10) => "hello"
 */
export function truncate(str: string, length: number): string;

/**
 * 检查字符串是否为空（null, undefined, 空字符串或仅空白字符）
 * @param str - 输入字符串
 * @returns 是否为空
 * @example isEmpty("") => true
 * @example isEmpty("  ") => true
 * @example isEmpty("hello") => false
 */
export function isEmpty(str: string | null | undefined): boolean;
```

### 2.3 错误处理

| 场景 | 处理方式 |
|------|----------|
| 非字符串参数 | TypeScript 类型系统约束（运行时返回原值或空字符串） |
| 负数长度 | truncate 函数返回原字符串 |

### 2.4 测试策略

#### 2.4.1 单元测试覆盖

每个函数需覆盖以下场景：

| 函数 | 测试场景 |
|------|----------|
| camelCase | 空格分隔、连字符分隔、下划线分隔、大写开头、单字、空字符串 |
| kebabCase | 驼峰命名、空格分隔、大驼峰、单字、空字符串 |
| truncate | 超过长度、恰好长度、不足长度、负数长度、空字符串 |
| isEmpty | null、undefined、空字符串、空白字符串、有效字符串 |

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

- 代码文件仅用于流程验证
- 遵循 TDD 红绿灯流程
- 遵循项目 ESLint 规则

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 边界条件遗漏 | 功能缺陷 | 明确测试空字符串、null、undefined |
| 测试覆盖率不达标 | 审计失败 | 每个函数编写充足测试用例 |

---

## 需求映射清单（spec.md ↔ Story 文档）

| Story 文档章节 | Story 需求要点 | spec.md 对应位置 | 覆盖状态 |
|----------------|----------------|------------------|----------|
| Story 目的 | 验证 BMAD Story 流程 | spec §1.1 | ✅ |
| AC-1 | Story 创建成功 | spec §3.1 | ✅ |
| AC-2 | Story 审计通过 | spec §3.1 | ✅ |
| AC-3 | 中间阶段基础验证 | spec §1.1, §3.1 | ✅ |
| AC-4 | 代码实现成功 | spec §2, §3.1 | ✅ |
| AC-4.1 | camelCase 函数 | spec §2.2.2 | ✅ |
| AC-4.2 | kebabCase 函数 | spec §2.2.2 | ✅ |
| AC-4.3 | truncate 函数 | spec §2.2.2 | ✅ |
| AC-4.4 | isEmpty 函数 | spec §2.2.2 | ✅ |
| AC-4.5 | 测试覆盖率 ≥ 80% | spec §2.4.2 | ✅ |
| AC-5 | 实施后完整审计 | spec §3.1 | ✅ |
| AC-6 | 流程端到端可追溯 | spec §3.1 | ✅ |
| Dev Notes | TypeScript + Vitest | spec §2.1 | ✅ |
| Dev Notes | 测试策略 | spec §2.4 | ✅ |

---

## 参考文档

- [Story 文档](../../../_bmad-output/implementation-artifacts/epic-E001-test-epic/story-E001-2-string-utils/E001-2-string-utils.md)
- [Epic 文档](../epic.md)
- [审计粒度配置](../../../config/bmad-story-config.yaml)

---

<!-- BASIC_REVIEW: PASSED -->
<!-- 验证时间: 2026-03-15 -->
<!-- 验证模式: story (中间阶段基础验证) -->
<!-- 检查项: document_exists, schema_valid, required_sections - 全部通过 -->
