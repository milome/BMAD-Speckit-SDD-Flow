# Development Plan: E001-S004 Demo Story Mode

## Story ID
- **Epic**: E001
- **Story**: S004
- **Slug**: demo-story-mode

## 实施计划

### 阶段概述

本计划遵循 ralph-method TDD 流程，严格执行 RED → GREEN → REFACTOR 循环。

### Phase 1: 测试先行 (RED)

**目标**: 编写失败的测试用例

| 任务 | 描述 | 估计时间 |
|------|------|---------|
| T1.1 | 创建测试文件 `src/utils/config-reader.test.ts` | 5 min |
| T1.2 | 编写 `createConfigReader` 基础测试 | 10 min |
| T1.3 | 编写 `get` 方法点符号访问测试 | 10 min |
| T1.4 | 编写默认值回退测试 | 5 min |
| T1.5 | 编写缓存机制测试 | 10 min |
| T1.6 | 编写错误处理测试 | 10 min |
| T1.7 | **运行测试 - 预期全部失败** | 2 min |

**验收**: 所有测试运行且失败（RED 状态确认）

### Phase 2: 最小实现 (GREEN)

**目标**: 编写最简代码使所有测试通过

| 任务 | 描述 | 估计时间 |
|------|------|---------|
| T2.1 | 创建实现文件 `src/utils/config-reader.ts` | 5 min |
| T2.2 | 实现 `ConfigNotFoundError` 类 | 5 min |
| T2.3 | 实现 `ConfigParseError` 类 | 5 min |
| T2.4 | 实现 `createConfigReader` 工厂函数 | 15 min |
| T2.5 | 实现 `get` 方法（支持点符号） | 15 min |
| T2.6 | 实现 `reload` 方法 | 5 min |
| T2.7 | **运行测试 - 预期全部通过** | 2 min |

**验收**: 所有测试通过（GREEN 状态确认）

### Phase 3: 重构 (REFACTOR)

**目标**: 在不改变行为的前提下优化代码

| 任务 | 描述 | 估计时间 |
|------|------|---------|
| T3.1 | 提取辅助函数 `getNestedValue` | 10 min |
| T3.2 | 优化错误消息格式 | 5 min |
| T3.3 | 添加 JSDoc 注释 | 10 min |
| T3.4 | 检查代码覆盖率 | 5 min |
| T3.5 | **运行测试 - 确保仍全部通过** | 2 min |

**验收**: 代码质量提升，测试仍全部通过

### 任务依赖图

```
T1.1 → T1.2 → T1.7
T1.3 → T1.7
T1.4 → T1.7
T1.5 → T1.7
T1.6 → T1.7
       ↓
      T2.1 → T2.2 → T2.7
      T2.3 → T2.7
      T2.4 → T2.7
      T2.5 → T2.7
      T2.6 → T2.7
           ↓
          T3.1 → T3.5
          T3.2 → T3.5
          T3.3 → T3.5
          T3.4 → T3.5
```

### 文件结构

```
src/
└── utils/
    ├── config-reader.ts       # 主实现
    ├── config-reader.test.ts  # 测试文件
    └── __fixtures__/
        └── test-config.json   # 测试用配置
```

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 文件系统权限问题 | 低 | 中 | 使用临时目录进行测试 |
| JSON 解析边缘情况 | 中 | 低 | 增加边界测试用例 |

### 时间估算

- Phase 1 (RED): 52 min
- Phase 2 (GREEN): 52 min
- Phase 3 (REFACTOR): 32 min
- **总计**: ~2.5 hours
