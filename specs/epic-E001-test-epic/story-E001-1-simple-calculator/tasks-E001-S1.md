# Tasks E001-S1: 验证 Story 开发流程（含代码实现）

**Epic**: E001-test-epic
**Story**: E001-1-simple-calculator
**创建时间**: 2026-03-15
**审计粒度**: story（中间阶段基础验证，实施后完整审计）

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1-T6 | Story 文档 | AC-4 | 代码实现成功 |
| T1 | spec 文档 | §2.2.2 | add 函数 |
| T2 | spec 文档 | §2.2.2 | subtract 函数 |
| T3 | spec 文档 | §2.2.2 | multiply 函数 |
| T4 | spec 文档 | §2.2.2, §2.3 | divide 函数 + 除零检查 |
| T5 | spec 文档 | §2.4 | 测试实现 |
| T6 | spec 文档 | §3.2 | 质量验收 |

---

## Gaps → 任务映射（按需求文档章节）

**核对规则**: IMPLEMENTATION_GAPS.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| 功能实现 | GAP-4.1 | ✓ 有 | T1 |
| 功能实现 | GAP-4.2 | ✓ 有 | T2 |
| 功能实现 | GAP-4.3 | ✓ 有 | T3 |
| 功能实现 | GAP-4.4, GAP-DN.1 | ✓ 有 | T4 |
| 测试实现 | GAP-4.5, GAP-SP.4, GAP-SP.5 | ✓ 有 | T5 |
| 文件结构 | GAP-SP.1, GAP-PL.1 | ✓ 有 | T1 (前置) |
| 流程执行 | GAP-PL.2-PL.6 | ✓ 有 | T1-T6 |

---

## 任务列表

### Phase 0: 环境准备

- [x] **T0: 创建文件结构**
  - **描述**: 创建实现文件和测试文件的空文件
  - **验收标准**:
    - `src/calculator.ts` 存在（可为空或仅有注释）
    - `test/calculator.test.ts` 存在（可为空或仅有注释）
  - **执行命令**: `New-Item -ItemType File -Force -Path "src/calculator.ts", "test/calculator.test.ts"`
  - **Gap 映射**: GAP-SP.1, GAP-PL.1

---

### Phase 1: add 函数（TDD）

- [x] **T1.1: 编写 add 测试用例** [红灯]
  - **描述**: 编写 add 函数的测试用例，覆盖正数、负数、小数、零场景
  - **验收标准**:
    - 测试文件包含 add 函数测试 describe 块
    - 包含至少 5 个测试场景
    - 运行测试**失败**（红灯），确认测试有效
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.1, GAP-PL.2

- [x] **T1.2: 实现 add 函数** [绿灯]
  - **描述**: 实现 add 函数使测试通过
  - **验收标准**:
    - `src/calculator.ts` 导出 add 函数
    - 所有 add 测试通过（绿灯）
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.1, GAP-PL.2

- [x] **T1.3: 重构 add 相关代码** [重构]
  - **描述**: 检查并优化 add 函数代码质量
  - **验收标准**:
    - 代码符合项目 ESLint 规则
    - 无冗余代码
    - 测试仍然通过
  - **执行命令**: `npx eslint src/calculator.ts`
  - **Gap 映射**: GAP-PL.2

---

### Phase 2: subtract 函数（TDD）

- [x] **T2.1: 编写 subtract 测试用例** [红灯]
  - **描述**: 编写 subtract 函数测试用例
  - **验收标准**:
    - 包含至少 5 个测试场景
    - 测试运行失败（红灯）
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.2, GAP-PL.3

- [x] **T2.2: 实现 subtract 函数** [绿灯]
  - **描述**: 实现 subtract 函数
  - **验收标准**:
    - 函数导出正确
    - 所有测试通过（绿灯）
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.2, GAP-PL.3

- [x] **T2.3: 重构 subtract 相关代码** [重构]
  - **描述**: 代码质量检查
  - **验收标准**: ESLint 无错误，测试通过
  - **执行命令**: `npx eslint src/calculator.ts`
  - **Gap 映射**: GAP-PL.3

---

### Phase 3: multiply 函数（TDD）

- [x] **T3.1: 编写 multiply 测试用例** [红灯]
  - **描述**: 编写 multiply 函数测试用例
  - **验收标准**:
    - 包含至少 5 个测试场景（含零、负负得正）
    - 测试运行失败（红灯）
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.3, GAP-PL.4

- [x] **T3.2: 实现 multiply 函数** [绿灯]
  - **描述**: 实现 multiply 函数
  - **验收标准**:
    - 函数导出正确
    - 所有测试通过（绿灯）
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.3, GAP-PL.4

- [x] **T3.3: 重构 multiply 相关代码** [重构]
  - **描述**: 代码质量检查
  - **验收标准**: ESLint 无错误，测试通过
  - **执行命令**: `npx eslint src/calculator.ts`
  - **Gap 映射**: GAP-PL.4

---

### Phase 4: divide 函数（TDD，含除零检查）

- [x] **T4.1: 编写 divide 测试用例** [红灯]
  - **描述**: 编写 divide 函数测试用例，**必须包含除零错误测试**
  - **验收标准**:
    - 包含至少 5 个正常场景测试
    - 包含除零错误测试：`expect(() => divide(5, 0)).toThrow('Division by zero is not allowed')`
    - 测试运行失败（红灯）
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.4, GAP-DN.1, GAP-PL.5

- [x] **T4.2: 实现 divide 函数（含除零检查）** [绿灯]
  - **描述**: 实现 divide 函数，包含除零检查
  - **验收标准**:
    - 函数导出正确
    - 除零时抛出 `Error("Division by zero is not allowed")`
    - 所有测试通过（绿灯）
  - **执行命令**: `npx vitest run test/calculator.test.ts`
  - **Gap 映射**: GAP-4.4, GAP-DN.1, GAP-PL.5

- [x] **T4.3: 重构 divide 相关代码** [重构]
  - **描述**: 代码质量检查
  - **验收标准**: ESLint 无错误，测试通过
  - **执行命令**: `npx eslint src/calculator.ts`
  - **Gap 映射**: GAP-PL.5

---

### Phase 5: 验证与清理

- [x] **T5.1: 运行完整测试套件**
  - **描述**: 运行所有测试，确认全部通过
  - **验收标准**: 所有测试通过
  - **执行命令**: `npx vitest run`
  - **Gap 映射**: GAP-PL.6

- [x] **T5.2: 检查测试覆盖率**
  - **描述**: 生成覆盖率报告
  - **验收标准**: 覆盖率 ≥ 80%
  - **执行命令**: `npx vitest run --coverage`
  - **Gap 映射**: GAP-4.5, GAP-SP.5, GAP-PL.6

- [x] **T5.3: 运行 Lint 检查**
  - **描述**: ESLint 检查
  - **验收标准**: 无错误、无警告
  - **执行命令**: `npx eslint src/calculator.ts test/calculator.test.ts`
  - **Gap 映射**: GAP-PL.6

- [x] **T5.4: 运行类型检查**
  - **描述**: TypeScript 类型检查
  - **验收标准**: 无类型错误
  - **执行命令**: `npx tsc --noEmit`
  - **Gap 映射**: GAP-PL.6

---

## 验收表头（按 Gap 逐条验证）

### 按需求文档章节

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| GAP-4.1 | T1.1-T1.3 | src/calculator.ts: add(a, b) => a + b | test/calculator.test.ts: describe('add') / 5+ cases / vitest run / all pass | [ ] 待执行 | [ ] |
| GAP-4.2 | T2.1-T2.3 | src/calculator.ts: subtract(a, b) => a - b | test/calculator.test.ts: describe('subtract') / 5+ cases / vitest run / all pass | [ ] 待执行 | [ ] |
| GAP-4.3 | T3.1-T3.3 | src/calculator.ts: multiply(a, b) => a * b | test/calculator.test.ts: describe('multiply') / 5+ cases / vitest run / all pass | [ ] 待执行 | [ ] |
| GAP-4.4, GAP-DN.1 | T4.1-T4.3 | src/calculator.ts: divide(a, b) 含除零检查 | test/calculator.test.ts: describe('divide') / 含除零测试 / vitest run / all pass | [ ] 待执行 | [ ] |
| GAP-4.5, GAP-SP.5 | T5.2 | 覆盖率检查 | vitest run --coverage / 覆盖率 ≥ 80% | [ ] 待执行 | [ ] |

---

## 检查点

| 检查点 | 前置任务 | 验证内容 |
|--------|----------|----------|
| CP-1 | T1.3 | add 函数实现完成，测试通过，lint 无错 |
| CP-2 | T2.3 | subtract 函数实现完成，测试通过 |
| CP-3 | T3.3 | multiply 函数实现完成，测试通过 |
| CP-4 | T4.3 | divide 函数实现完成，含除零检查 |
| CP-5 | T5.4 | 全部验收通过，覆盖率达标 |

---

## 参考文档

- [Spec 文档](./spec-E001-S1.md)
- [Plan 文档](./plan-E001-S1.md)
- [GAPS 文档](./IMPLEMENTATION_GAPS-E001-S1.md)
- [Story 文档](../../../_bmad-output/implementation-artifacts/epic-E001-test-epic/story-E001-1-simple-calculator/E001-1-simple-calculator.md)

---

<!-- BASIC_REVIEW: PASSED -->
<!-- 验证时间: 2026-03-15 -->
<!-- 验证模式: story (中间阶段基础验证) -->
<!-- 检查项: document_exists, task_list_complete - 全部通过 (共 20 个子任务, 5 个检查点) -->