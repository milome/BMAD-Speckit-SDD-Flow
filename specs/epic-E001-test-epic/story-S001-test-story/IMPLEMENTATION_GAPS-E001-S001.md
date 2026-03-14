# Implementation Gaps E001-S001: BMAD 工作流验证模块实现差距分析

## 元信息

| 字段 | 值 |
|------|-----|
| Epic | E001 |
| Story | S001 |
| 版本 | 1.0.0 |
| 创建日期 | 2026-03-14 |
| 技术栈 | TypeScript 5.0+ |
| 状态 | draft |

---

## 1. 差距分析概述

本文档基于 Spec (spec-E001-S001.md) 和 Plan (plan-E001-S001.md) 对比分析，识别出以下实现差距和潜在风险。

**分析范围**: Story 状态管理模块（StoryStateManager, StageValidator, AuditLogger）
**分析目标**: 识别实现难点、边界条件、集成风险

---

## 2. Gap 列表

### Gap-001: Result 类型实现模式不明确

**风险等级**: 中等

**描述**: Spec 中定义了 `Result<T, E>` 类型用于替代 throw，但未明确具体实现方式：
- 是手动实现每个方法的 Result 包装？
- 还是使用函数式编程库（如 fp-ts）？
- 错误处理的边界情况如何统一处理？

**影响**: 可能导致不同类之间 Result 处理模式不一致

**缓解策略**:
1. 在 `types.ts` 中统一实现 `ok()` 和 `err()` 辅助函数
2. 所有公共方法统一返回 `Result<T, Error>` 类型
3. 编写 Result 类型使用示例供参考

**相关验收标准**: AC-001~005 中涉及返回 Result 的所有场景

---

### Gap-002: StageValidator 与 StoryStateManager 集成边界

**风险等级**: 高

**描述**: Plan 中显示 StoryStateManager 内部调用 StageValidator，但 Spec 中两者职责边界存在模糊地带：
- StoryStateManager.advanceStage() 是否直接调用 StageValidator？
- 还是通过 ValidationContext 对象解耦？
- StageValidator 是 StoryStateManager 的依赖注入，还是内部创建？

**影响**: 可能导致循环依赖或测试困难

**缓解策略**:
1. StoryStateManager 构造函数接收 StageValidator 实例（依赖注入）
2. ValidationContext 作为独立对象传递，不直接持有 StageValidator 引用
3. 在单元测试中使用 mock StageValidator

**相关验收标准**: AC-006~009

---

### Gap-003: AuditLogger 单例 vs 实例化

**风险等级**: 中等

**描述**: Spec 未明确 AuditLogger 的生命周期管理方式：
- 是全局单例（所有 Story 共享日志存储）？
- 还是每个 StoryStateManager 持有独立 Logger 实例？
- 内存日志的并发访问是否需要考虑？

**影响**: 影响测试隔离性和日志查询的正确性

**缓解策略**:
1. AuditLogger 设计为可实例化类（非单例），由 StoryStateManager 持有
2. 内存日志存储在 AuditLogger 实例内部，确保测试隔离
3. 提供 `clearLogs()` 方法用于测试清理

**相关验收标准**: AC-010~013

---

### Gap-004: 时间戳精度与时区处理

**风险等级**: 低

**描述**: Spec 使用 `Date` 类型，但未明确：
- 时间戳是 UTC 还是本地时间？
- `duration` 计算精度（毫秒级是否足够）？
- `enteredAt` 和 `completedAt` 是否可能相同（瞬时完成）？

**影响**: 可能影响日志准确性，尤其在跨时区场景

**缓解策略**:
1. 使用 `Date.now()` 获取时间戳，存储为 UTC
2. duration 计算使用毫秒级精度
3. 在文档中明确时间戳处理规范

**相关验收标准**: AC-011, LOG-004

---

### Gap-005: StageEntry 状态同步问题

**风险等级**: 高

**描述**: StoryState 中的 `stageHistory` 和 AuditLogger 的日志条目存在数据冗余：
- 两者都记录阶段生命周期信息
- 如何确保数据一致性？
- 如果 AuditLogger 调用失败，状态变更是否需要回滚？

**影响**: 可能导致状态不一致，难以调试

**缓解策略**:
1. StoryStateManager 作为协调者，先更新状态，再记录日志
2. 日志记录失败不阻止状态变更（但记录错误）
3. 提供一致性检查工具（可选）

**相关验收标准**: AC-003, INT-003

---

### Gap-006: ValidationError details 字段类型安全

**风险等级**: 中等

**描述**: `ValidationError.details` 定义为 `Record<string, unknown>`，缺乏类型安全：
- 不同错误类型的 details 结构不一致
- 调用者难以安全地访问 details 字段
- 缺少运行时类型检查

**影响**: 开发者体验差，可能引入运行时错误

**缓解策略**:
1. 为不同错误代码定义明确的 details 结构
2. 提供类型守卫函数（type guards）用于安全访问
3. 文档中说明每种错误代码的 details 结构

**相关验收标准**: AC-009

---

### Gap-007: 测试覆盖率边界定义

**风险等级**: 低

**描述**: 要求 80% 覆盖率但未明确：
- 是否包含类型定义文件？
- 错误类的分支覆盖率如何计算？
- 集成测试是否计入覆盖率？

**影响**: 可能导致覆盖率计算争议

**缓解策略**:
1. 配置 Vitest 排除类型定义和索引文件
2. 将集成测试配置为不计入单元测试覆盖率
3. 在 CI 中明确覆盖率计算范围

**相关验收标准**: NFR-002

---

### Gap-008: StoryState 深拷贝实现

**风险等级**: 中等

**描述**: Plan 中 `getCurrentState()` 返回"深拷贝"，但未明确实现方式：
- 使用 `JSON.parse(JSON.stringify())`？（丢失 Date 对象）
- 手动实现深拷贝逻辑？（复杂且易错）
- 使用不可变数据结构库？

**影响**: 可能导致状态泄露，外部修改影响内部状态

**缓解策略**:
1. 手动实现 StoryState 的深拷贝方法
2. 冻结返回对象（Object.freeze）作为额外保护
3. 在测试中验证深拷贝行为

**相关验收标准**: AC-001

---

## 3. 风险汇总矩阵

| Gap ID | 风险等级 | 影响范围 | 缓解难度 | 优先级 |
|--------|----------|----------|----------|--------|
| Gap-001 | 中 | 代码一致性 | 低 | P1 |
| Gap-002 | **高** | 架构设计 | 中 | **P0** |
| Gap-003 | 中 | 测试隔离 | 低 | P1 |
| Gap-004 | 低 | 功能正确性 | 低 | P2 |
| Gap-005 | **高** | 数据一致性 | 中 | **P0** |
| Gap-006 | 中 | 类型安全 | 低 | P1 |
| Gap-007 | 低 | 测试度量 | 低 | P2 |
| Gap-008 | 中 | 状态安全 | 低 | P1 |

---

## 4. 实现建议

### 4.1 高风险优先处理

**Gap-002 和 Gap-005** 需要在实现开始前明确：

1. **组件关系图**（更新）:
```
┌─────────────────────────────────────────┐
│           StoryStateManager             │
│  ┌─────────────────────────────────┐    │
│  │  - stageValidator: StageValidator│   │
│  │  - auditLogger: AuditLogger      │   │
│  │  - state: StoryState             │   │
│  └─────────────────────────────────┘    │
│              │         │                │
│              ▼         ▼                │
│     ┌────────────┐ ┌────────────┐       │
│     │StageValidator│ │AuditLogger│      │
│     └────────────┘ └────────────┘       │
└─────────────────────────────────────────┘
```

2. **数据一致性保证**:
   - StoryStateManager.advanceStage() 原子操作：
     1. 调用 stageValidator.validateEntry()
     2. 更新内部 state
     3. 调用 auditLogger.logStageEntered()
     4. 返回 Result.ok(newState)

### 4.2 中等风险标准处理

**Gap-001, Gap-003, Gap-006, Gap-008** 按标准模式实现：
- 统一 Result 类型和辅助函数
- AuditLogger 实例化模式
- 定义标准错误 details 结构
- 实现深拷贝工具函数

### 4.3 低风险文档说明

**Gap-004, Gap-007** 在代码注释和 README 中说明即可。

---

## 5. 验收标准调整建议

### 5.1 新增验收标准

| 标准 ID | 描述 | 理由 |
|---------|------|------|
| AC-014 | getCurrentState() 返回的对象修改不影响内部状态 | 验证深拷贝正确性 |
| AC-015 | ValidationError.details 包含预期的结构化数据 | 验证错误信息完整性 |
| AC-016 | AuditLogger 实例间相互隔离（独立日志存储） | 验证测试隔离性 |

### 5.2 调整现有标准

| 标准 ID | 原描述 | 调整建议 |
|---------|--------|----------|
| AC-009 | 错误信息包含明确的前置阶段要求和当前状态 | 增加：错误 details 包含结构化数据（{ required: StoryStage, current: StoryStage }）|

---

## 6. 实现检查清单

### 6.1 前置确认

- [ ] 确认 StoryStateManager 依赖注入模式（Gap-002）
- [ ] 确认 AuditLogger 实例化策略（Gap-003）
- [ ] 确认 Result 类型使用规范（Gap-001）

### 6.2 实现关注

- [ ] 处理 StoryState 深拷贝（Gap-008）
- [ ] 处理数据一致性边界（Gap-005）
- [ ] 定义 ValidationError details 结构（Gap-006）

### 6.3 测试关注

- [ ] 测试实例隔离性（Gap-003）
- [ ] 测试返回对象不可变性（Gap-008）
- [ ] 验证覆盖率计算范围（Gap-007）

---

## 7. 可追踪性

| Gap ID | 相关需求 | 相关文件 | 相关测试 |
|--------|----------|----------|----------|
| Gap-001 | NFR-001 | types.ts | - |
| Gap-002 | FR-001, FR-002 | StoryStateManager.ts | STM-001~008, VAL-001~008 |
| Gap-003 | FR-003 | AuditLogger.ts | LOG-001~008 |
| Gap-004 | FR-003 | AuditLogger.ts | LOG-004 |
| Gap-005 | FR-001, FR-003 | StoryStateManager.ts, AuditLogger.ts | INT-003 |
| Gap-006 | FR-002 | StageValidator.ts | VAL-007, VAL-008 |
| Gap-007 | NFR-002 | *.test.ts | 覆盖率报告 |
| Gap-008 | FR-001 | StoryStateManager.ts | STM-001 |

---

## 8. 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-03-14 | 初始创建 | bmad-layer4-speckit-gaps |

---

*本文档由 bmad-layer4-speckit-gaps Agent 生成*

