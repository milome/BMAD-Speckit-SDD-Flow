# Specification: E001-S004 Demo Story Mode

## Story ID
- **Epic**: E001
- **Story**: S004
- **Slug**: demo-story-mode

## 功能规格

### 概述
实现一个配置读取工具函数，支持从 JSON 配置文件读取指定键值，支持默认值回退机制。

### 接口定义

```typescript
interface ConfigReaderOptions {
  // 配置文件路径（相对于项目根目录）
  configPath: string;
  // 是否缓存配置内容
  cache?: boolean;
}

interface ConfigReader {
  // 读取指定键的配置值，不存在时返回默认值
  get<T>(key: string, defaultValue?: T): T | undefined;
  // 重新加载配置（清除缓存）
  reload(): void;
}

// 工厂函数
function createConfigReader(options: ConfigReaderOptions): ConfigReader;
```

### 功能需求

1. **FR-001**: 读取 JSON 配置文件并解析
2. **FR-002**: 支持点符号访问嵌套属性（如 "database.host"）
3. **FR-003**: 键不存在时返回默认值
4. **FR-004**: 支持缓存机制提升性能
5. **FR-005**: 文件不存在时抛出明确错误

### 错误处理

| 场景 | 行为 |
|------|------|
| 配置文件不存在 | 抛出 `ConfigNotFoundError` |
| JSON 解析失败 | 抛出 `ConfigParseError` |
| 键不存在且无默认值 | 返回 `undefined` |

### 非功能需求

- 100% 单元测试覆盖率
- 支持 TypeScript 类型推断
- 零外部依赖（仅使用 Node.js 内置模块）

## 验收标准

1. [ ] `createConfigReader` 函数正确创建配置读取器
2. [ ] `get` 方法支持点符号访问嵌套属性
3. [ ] `get` 方法在无值时返回默认值
4. [ ] 缓存机制正常工作
5. [ ] 错误场景抛出正确异常

## 依赖

- Node.js `fs` 模块
- Node.js `path` 模块

## 输出位置

- 实现: `src/utils/config-reader.ts`
- 测试: `src/utils/config-reader.test.ts`
