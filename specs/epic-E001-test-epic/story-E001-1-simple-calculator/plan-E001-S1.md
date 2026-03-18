# Plan E001-S1: 验证 Story 开发流程（含代码实现）

**Epic**: E001-test-epic
**Story**: E001-1-simple-calculator
**状态**: draft
**创建时间**: 2026-03-15
**审计粒度**: story（中间阶段基础验证，实施后完整审计）

---

## 1. 实施概述

本计划定义实现简单计算器模块的详细步骤，遵循 TDD 红绿灯流程。

### 1.1 实施策略

- **方法论**: TDD（测试驱动开发）
- **执行顺序**: 红灯 → 绿灯 → 重构
- **验证方式**: Vitest 测试 + 覆盖率报告

---

## 2. Phase 分解

### Phase 1: 环境准备

| 任务 | 描述 | 预估 |
|------|------|------|
| 1.1 | 确认 Vitest 配置正确 | 5min |
| 1.2 | 确认 TypeScript 配置正确 | 5min |
| 1.3 | 创建 `src/calculator.ts` 空文件 | 2min |
| 1.4 | 创建 `test/calculator.test.ts` 空文件 | 2min |

### Phase 2: 实现 add 函数

| 任务 | 描述 | TDD 阶段 |
|------|------|----------|
| 2.1 | 编写 add 测试用例（正数、负数、小数、零） | 红灯 |
| 2.2 | 实现 add 函数使测试通过 | 绿灯 |
| 2.3 | 检查代码质量，必要时重构 | 重构 |

### Phase 3: 实现 subtract 函数

| 任务 | 描述 | TDD 阶段 |
|------|------|----------|
| 3.1 | 编写 subtract 测试用例 | 红灯 |
| 3.2 | 实现 subtract 函数 | 绿灯 |
| 3.3 | 检查代码质量 | 重构 |

### Phase 4: 实现 multiply 函数

| 任务 | 描述 | TDD 阶段 |
|------|------|----------|
| 4.1 | 编写 multiply 测试用例 | 红灯 |
| 4.2 | 实现 multiply 函数 | 绿灯 |
| 4.3 | 检查代码质量 | 重构 |

### Phase 5: 实现 divide 函数（含除零检查）

| 任务 | 描述 | TDD 阶段 |
|------|------|----------|
| 5.1 | 编写 divide 测试用例（含除零错误测试） | 红灯 |
| 5.2 | 实现 divide 函数含除零检查 | 绿灯 |
| 5.3 | 检查代码质量 | 重构 |

### Phase 6: 验证与清理

| 任务 | 描述 |
|------|------|
| 6.1 | 运行完整测试套件 |
| 6.2 | 检查测试覆盖率 ≥ 80% |
| 6.3 | 运行 lint 检查 |
| 6.4 | 运行类型检查 |

---

## 3. 测试计划

### 3.1 单元测试

#### 3.1.1 add 函数测试用例

```typescript
describe('add', () => {
  it('should add two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  
  it('should add two negative numbers', () => {
    expect(add(-2, -3)).toBe(-5);
  });
  
  it('should add positive and negative numbers', () => {
    expect(add(5, -3)).toBe(2);
  });
  
  it('should add decimal numbers', () => {
    expect(add(0.1, 0.2)).toBeCloseTo(0.3);
  });
  
  it('should handle zero', () => {
    expect(add(0, 5)).toBe(5);
    expect(add(5, 0)).toBe(5);
  });
});
```

#### 3.1.2 subtract 函数测试用例

```typescript
describe('subtract', () => {
  it('should subtract two positive numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });
  
  it('should subtract two negative numbers', () => {
    expect(subtract(-5, -3)).toBe(-2);
  });
  
  it('should return negative result when minuend < subtrahend', () => {
    expect(subtract(3, 5)).toBe(-2);
  });
  
  it('should subtract decimal numbers', () => {
    expect(subtract(0.5, 0.2)).toBeCloseTo(0.3);
  });
  
  it('should handle zero', () => {
    expect(subtract(5, 0)).toBe(5);
    expect(subtract(0, 5)).toBe(-5);
  });
});
```

#### 3.1.3 multiply 函数测试用例

```typescript
describe('multiply', () => {
  it('should multiply two positive numbers', () => {
    expect(multiply(2, 3)).toBe(6);
  });
  
  it('should multiply two negative numbers (positive result)', () => {
    expect(multiply(-2, -3)).toBe(6);
  });
  
  it('should multiply positive and negative numbers (negative result)', () => {
    expect(multiply(2, -3)).toBe(-6);
  });
  
  it('should handle zero', () => {
    expect(multiply(0, 5)).toBe(0);
    expect(multiply(5, 0)).toBe(0);
  });
  
  it('should multiply decimal numbers', () => {
    expect(multiply(0.1, 0.2)).toBeCloseTo(0.02);
  });
});
```

#### 3.1.4 divide 函数测试用例

```typescript
describe('divide', () => {
  it('should divide two positive numbers', () => {
    expect(divide(6, 2)).toBe(3);
  });
  
  it('should divide two negative numbers (positive result)', () => {
    expect(divide(-6, -2)).toBe(3);
  });
  
  it('should divide positive by negative (negative result)', () => {
    expect(divide(6, -2)).toBe(-3);
  });
  
  it('should divide decimal numbers', () => {
    expect(divide(0.6, 0.2)).toBeCloseTo(3);
  });
  
  it('should throw error when dividing by zero', () => {
    expect(() => divide(5, 0)).toThrow('Division by zero is not allowed');
  });
});
```

### 3.2 集成测试

由于计算器是纯函数模块，单元测试即为集成测试。需验证：

- 所有函数正确导出
- 模块可在其他模块中正确导入和调用

```typescript
// 集成验证示例
import * as calculator from '../src/calculator';

describe('Calculator module integration', () => {
  it('should export all functions', () => {
    expect(calculator.add).toBeDefined();
    expect(calculator.subtract).toBeDefined();
    expect(calculator.multiply).toBeDefined();
    expect(calculator.divide).toBeDefined();
  });
});
```

### 3.3 端到端测试

本 Story 不涉及 UI 或服务，端到端测试为运行完整测试套件并验证覆盖率。

---

## 4. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 浮点数处理 | toBeCloseTo | 避免 JavaScript 浮点精度问题 |
| 除零错误 | throw Error | 明确错误消息，便于调试 |
| 导出方式 | named export | 支持按需导入 |

---

## 5. 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| 浮点精度问题 | 使用 toBeCloseTo 匹配器 |
| 覆盖率不达标 | 每函数至少 5 个测试场景 |
| TDD 流程遗漏 | 使用 progress 文件记录每个阶段 |

---

## 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|--------------|--------------|--------------|----------|
| Story 目的 | spec §1.1 | plan §1 | ✅ |
| AC-4 代码实现 | spec §2 | plan §2 (Phase 2-5) | ✅ |
| add 函数 | spec §2.2.2 | plan Phase 2 | ✅ |
| subtract 函数 | spec §2.2.2 | plan Phase 3 | ✅ |
| multiply 函数 | spec §2.2.2 | plan Phase 4 | ✅ |
| divide 函数 + 除零检查 | spec §2.2.2, §2.3 | plan Phase 5 | ✅ |
| 测试覆盖率 ≥ 80% | spec §2.4.2 | plan §3, Phase 6 | ✅ |
| TDD 流程 | spec §4.2 | plan §1.1 | ✅ |

---

## 参考文档

- [Spec 文档](./spec-E001-S1.md)
- [Story 文档](../../../_bmad-output/implementation-artifacts/epic-E001-test-epic/story-E001-1-simple-calculator/E001-1-simple-calculator.md)

---

<!-- BASIC_REVIEW: PASSED -->
<!-- 验证时间: 2026-03-15 -->
<!-- 验证模式: story (中间阶段基础验证) -->
<!-- 检查项: document_exists, schema_valid, required_sections - 全部通过 -->