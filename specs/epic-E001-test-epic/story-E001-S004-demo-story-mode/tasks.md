# Tasks: E001-S004 Demo Story Mode

## Story ID
- **Epic**: E001
- **Story**: S004
- **Slug**: demo-story-mode

## User Story 列表

### US-001: 配置读取器工厂函数
**描述**: 实现 `createConfigReader` 工厂函数
**AC**:
- [ ] 接受 `ConfigReaderOptions` 参数
- [ ] 返回 `ConfigReader` 实例
- [ ] 文件不存在时抛出 `ConfigNotFoundError`

**TDD 阶段**:
1. RED: 编写工厂函数测试（预期失败）
2. GREEN: 实现最简工厂函数
3. REFACTOR: 优化接口定义

---

### US-002: get 方法实现
**描述**: 实现配置值读取方法
**AC**:
- [ ] 支持简单键读取
- [ ] 支持点符号访问嵌套属性（如 "database.host"）
- [ ] 键不存在时返回默认值
- [ ] 无默认值且键不存在时返回 `undefined`

**TDD 阶段**:
1. RED: 编写 get 方法测试（预期失败）
2. GREEN: 实现最简 get 方法
3. REFACTOR: 提取辅助函数

---

### US-003: 错误类实现
**描述**: 实现自定义错误类
**AC**:
- [ ] `ConfigNotFoundError` 类定义
- [ ] `ConfigParseError` 类定义
- [ ] 错误消息包含文件路径

**TDD 阶段**:
1. RED: 编写错误类测试（预期失败）
2. GREEN: 实现错误类
3. REFACTOR: 优化错误消息

---

### US-004: 缓存机制
**描述**: 实现配置缓存
**AC**:
- [ ] 首次读取后缓存配置
- [ ] 再次访问返回缓存值
- [ ] `reload()` 方法清除缓存

**TDD 阶段**:
1. RED: 编写缓存测试（预期失败）
2. GREEN: 实现缓存逻辑
3. REFACTOR: 优化缓存实现

---

## 任务优先级

```
US-003 (错误类) → US-001 (工厂函数) → US-002 (get方法) → US-004 (缓存)
```

## 依赖关系

- US-001 依赖 US-003
- US-002 依赖 US-001
- US-004 依赖 US-001

## 估算

| US | 估算时间 |
|----|---------|
| US-001 | 20 min |
| US-002 | 30 min |
| US-003 | 15 min |
| US-004 | 20 min |
| **总计** | **85 min** |

## 测试要求

每个 US 必须遵循 TDD:
1. 先写测试 → 运行 → 确认失败
2. 实现代码 → 运行 → 确认通过
3. 重构 → 运行 → 确认仍通过
