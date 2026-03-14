# BMAD Story Assistant 跨平台兼容性分析

## 执行环境差异对比

| 特性 | Cursor | Claude Code CLI |
|------|--------|-----------------|
| **Subagent调用工具** | `mcp_task` | `Agent` |
| **Subagent类型参数** | `subagent_type: generalPurpose` | `subagent_type: general-purpose` |
| **支持类型** | generalPurpose, explore, shell | general-purpose (统一) |
| **审计执行体调用** | Cursor Task 或 mcp_task | Agent 工具 |
| **Skill目录** | `.cursor/skills/` | `.claude/skills/` |
| **Agent目录** | `.cursor/agents/` 或 `.claude/agents/` | `.claude/agents/` |
| **配置读取方式** | 文件系统 + MCP | 文件系统 + 原生工具 |

## 跨平台配置方案

### 方案1: 统一配置文件 + 环境适配层（推荐）

```yaml
# config/bmad-story-config.yaml
# 这个文件对 Cursor 和 Claude 完全一致

version: "1.0"

# 审计粒度配置 - 两个环境共享
audit_granularity:
  mode: "story"  # full | story | epic

  # 各模式详细配置
  modes:
    full:
      stages:
        story_create: { audit: true, strictness: "standard" }
        specify:      { audit: true, strictness: "standard" }
        plan:         { audit: true, strictness: "standard" }
        gaps:         { audit: true, strictness: "standard" }
        tasks:        { audit: true, strictness: "standard" }
        implement:    { audit: true, strictness: "strict" }
        post_audit:   { audit: true, strictness: "strict" }

    story:
      stages:
        story_create: { audit: true, strictness: "standard" }
        specify:      { audit: false, generate_doc: true, validation: "basic" }
        plan:         { audit: false, generate_doc: true, validation: "basic" }
        gaps:         { audit: false, generate_doc: true, validation: "basic" }
        tasks:        { audit: false, generate_doc: true, validation: "basic" }
        implement:    { audit: false, generate_doc: true, validation: "test_only" }
        post_audit:   { audit: true, strictness: "strict" }

    epic:
      stages:
        epic_create:     { audit: true, strictness: "standard" }
        story_create:    { audit: false, generate_doc: true }
        specify:         { audit: false, generate_doc: true }
        plan:            { audit: false, generate_doc: true }
        gaps:            { audit: false, generate_doc: true }
        tasks:           { audit: false, generate_doc: true }
        implement:       { audit: false, generate_doc: true }
        epic_complete:   { audit: true, strictness: "strict" }

# 环境特定配置（可选覆盖）
environment_overrides:
  cursor:
    # Cursor 特定配置
    subagent_tool: "mcp_task"
    default_subagent_type: "generalPurpose"

  claude:
    # Claude Code CLI 特定配置
    subagent_tool: "Agent"
    default_subagent_type: "general-purpose"
```

### 方案2: 环境检测与适配代码

```typescript
// scripts/bmad-config-loader.ts
// 跨平台配置加载器

export interface EnvironmentConfig {
  platform: 'cursor' | 'claude';
  subagentTool: 'mcp_task' | 'Agent';
  subagentType: 'generalPurpose' | 'general-purpose';
  skillsRoot: string;
  agentsRoot: string;
}

export function detectEnvironment(): EnvironmentConfig {
  // 检测当前运行环境

  // 方法1: 检查全局变量或上下文
  if (typeof window !== 'undefined' && window.cursor) {
    return {
      platform: 'cursor',
      subagentTool: 'mcp_task',
      subagentType: 'generalPurpose',
      skillsRoot: '.cursor/skills',
      agentsRoot: '.claude/agents'  // Cursor 也可以访问 .claude/agents
    };
  }

  // 方法2: 检查 process.env
  if (process.env.CLAUDE_CODE_CLI === 'true') {
    return {
      platform: 'claude',
      subagentTool: 'Agent',
      subagentType: 'general-purpose',
      skillsRoot: '.claude/skills',
      agentsRoot: '.claude/agents'
    };
  }

  // 方法3: 检查配置文件位置
  if (fs.existsSync('.cursor/skills')) {
    return {
      platform: 'cursor',
      subagentTool: 'mcp_task',
      subagentType: 'generalPurpose',
      skillsRoot: '.cursor/skills',
      agentsRoot: '.cursor/agents'
    };
  }

  // 默认假设为 Claude Code CLI
  return {
    platform: 'claude',
    subagentTool: 'Agent',
    subagentType: 'general-purpose',
    skillsRoot: '.claude/skills',
    agentsRoot: '.claude/agents'
  };
}

export function loadConfig(): BmadStoryConfig {
  const env = detectEnvironment();
  const configPath = 'config/bmad-story-config.yaml';

  // 读取统一配置
  const baseConfig = yaml.load(fs.readFileSync(configPath, 'utf8'));

  // 应用环境特定覆盖
  const override = baseConfig.environment_overrides?.[env.platform];

  return {
    ...baseConfig,
    ...override,
    _environment: env  // 内部使用
  };
}

// 获取适配后的 subagent 调用参数
export function getSubagentParams(config: BmadStoryConfig) {
  const env = config._environment;

  return {
    tool: env.subagentTool,
    subagent_type: env.subagentType,
    // 其他通用参数...
  };
}
```

## Skill文件同步策略

### 策略1: 完全同步（推荐）

保持 `.cursor/skills/bmad-story-assistant/SKILL.md` 和 `.claude/skills/bmad-story-assistant/SKILL.md` 完全一致，只在工具调用语法处使用条件判断。

```markdown
## 跨平台执行适配

### 环境检测

skill 启动时自动检测运行环境：
- **Cursor**: 使用 `mcp_task` 工具
- **Claude Code CLI**: 使用 `Agent` 工具

### 条件执行示例

```typescript
// 伪代码展示
const env = detectEnvironment();

if (env.platform === 'cursor') {
  // Cursor 环境
  await mcp_task({
    subagent_type: 'generalPurpose',
    // ...
  });
} else {
  // Claude Code CLI 环境
  await Agent({
    subagent_type: 'general-purpose',
    // ...
  });
}
```

### 审计粒度配置读取

配置读取逻辑在两个环境中完全一致：

```typescript
// 两个环境使用相同的配置加载逻辑
const config = await loadConfig('config/bmad-story-config.yaml');
const stageConfig = config.audit_granularity.modes[config.mode].stages[currentStage];

// 根据配置决定是否执行审计
if (stageConfig.audit) {
  await executeAudit(env);  // env 自动适配工具调用
}
```
```

### 策略2: 共享配置 + 独立执行文件

```
config/
├── bmad-story-config.yaml          # 共享配置
└── bmad-executors/                 # 执行器适配
    ├── cursor-executor.ts          # Cursor 专用执行器
    └── claude-executor.ts          # Claude 专用执行器

.cursor/skills/bmad-story-assistant/
└── SKILL.md                        # 引用 cursor-executor

.claude/skills/bmad-story-assistant/
└── SKILL.md                        # 引用 claude-executor
```

## 审计粒度配置的跨平台实现

### 配置定义（平台无关）

```yaml
# config/bmad-story-config.yaml
# 两个环境完全一致

audit_granularity:
  mode: "story"

  modes:
    story:
      stages:
        specify:
          audit: false
          generate_doc: true
          validation: "basic"
```

### Cursor 环境实现

```markdown
### Stage 3: Dev Story 执行

读取配置并执行条件审计：

```typescript
// 1. 加载配置（平台无关）
const config = loadYaml('config/bmad-story-config.yaml');
const stageConfig = config.audit_granularity.modes.story.stages.specify;

// 2. 生成文档（始终执行）
await generateSpecifyDoc();

// 3. 根据配置决定后续操作
if (stageConfig.audit) {
  // 完整审计 - Cursor 方式
  await mcp_task({
    description: "审计 specify 阶段",
    subagent_type: 'generalPurpose',
    prompt: buildAuditPrompt('specify')
  });
} else if (stageConfig.validation === 'basic') {
  // 基础验证（不调用审计 agent）
  await runBasicValidation();
  await markStageAsPassed('specify');
}
```
```

### Claude Code CLI 环境实现

```markdown
### Stage 3: Dev Story 执行

读取配置并执行条件审计：

```typescript
// 1. 加载配置（平台无关）
const config = loadYaml('config/bmad-story-config.yaml');
const stageConfig = config.audit_granularity.modes.story.stages.specify;

// 2. 生成文档（始终执行）
await generateSpecifyDoc();

// 3. 根据配置决定后续操作
if (stageConfig.audit) {
  // 完整审计 - Claude 方式
  await Agent({
    description: "审计 specify 阶段",
    subagent_type: 'general-purpose',
    prompt: buildAuditPrompt('specify')
  });
} else if (stageConfig.validation === 'basic') {
  // 基础验证（不调用审计 agent）
  await runBasicValidation();
  await markStageAsPassed('specify');
}
```
```

## 关键差异处理

### 1. 工具调用语法差异

| 操作 | Cursor | Claude |
|------|--------|--------|
| 调用 subagent | `mcp_task({subagent_type: 'generalPurpose'})` | `Agent({subagent_type: 'general-purpose'})` |
| 读取文件 | `readFile` (MCP) | `Read` (原生) |
| 写入文件 | `writeFile` (MCP) | `Write` (原生) |

**解决方案**: 使用抽象层封装工具调用

```typescript
// scripts/bmad-executor.ts
export async function invokeSubagent(params: SubagentParams) {
  const env = detectEnvironment();

  if (env.platform === 'cursor') {
    return await mcp_task({
      ...params,
      subagent_type: 'generalPurpose'
    });
  } else {
    return await Agent({
      ...params,
      subagent_type: 'general-purpose'
    });
  }
}
```

### 2. Agent 文件位置差异

**Cursor** 可以访问 `.cursor/agents/` 和 `.claude/agents/`
**Claude** 只能访问 `.claude/agents/`

**解决方案**: 统一使用 `.claude/agents/` 存放共享 agent 文件

```
.claude/agents/
├── bmad-story-create.md
├── bmad-story-audit.md
├── layers/
│   ├── bmad-layer4-speckit-specify.md
│   ├── bmad-layer4-speckit-plan.md
│   └── ...
```

### 3. Skill 引用路径差异

**Cursor**: `~/.cursor/skills/`
**Claude**: `~/.claude/skills/` 或项目内 `.claude/skills/`

**解决方案**: 使用相对路径引用项目内 skill

```markdown
# 两个环境都使用项目内路径
read: .claude/skills/bmad-story-assistant/SKILL.md
```

## 实施建议

### Phase 1: 配置系统（跨平台）✅ 已完成

1. ✅ 创建 `config/bmad-story-config.yaml`（平台无关）
   - 实际文件: `config/bmad-story-config.example.yaml`

2. ✅ 创建 `scripts/bmad-config.ts`（跨平台配置加载器）
   - 实现环境检测: `detectEnvironment()`
   - 支持 Cursor/Claude 自动识别
   - 通过 BMAD_PLATFORM 环境变量或目录检测

3. ✅ 跨平台执行器封装
   - 实际文件: `scripts/bmad-config.ts` 中的 `getSubagentParams()`
   - 返回适配的工具参数

**实现状态:**
- ✅ 配置加载器: 已实现并测试通过 (19 tests)
- ✅ 环境检测: 支持 Cursor/Claude 自动识别
- ✅ 跨平台 API: `shouldAudit()`, `shouldValidate()`, `getSubagentParams()`

### Phase 2: Skill 适配

1. 更新 `.claude/skills/bmad-story-assistant/SKILL.md`
2. 同步更新 `.cursor/skills/bmad-story-assistant/SKILL.md`
3. 确保两个文件在配置读取逻辑上一致

### Phase 3: Agent 适配

1. 更新 `.claude/agents/layers/*.md` 添加条件审计逻辑
2. 确保 agent 文件使用抽象执行层

### Phase 4: 测试验证

1. 在 Cursor 环境测试 `full` 和 `story` 模式
2. 在 Claude Code CLI 环境测试 `full` 和 `story` 模式
3. 验证配置文件在两个环境中被正确读取

## 结论

**是的，这个方案可以同时在 Cursor 和 Claude Code CLI 中生效。**

关键成功因素：

1. **统一配置文件**: `config/bmad-story-config.yaml` 是平台无关的
2. **抽象执行层**: 封装工具调用差异
3. **环境检测**: 运行时自动检测并适配
4. **共享 Agent**: 统一存放在 `.claude/agents/`
5. **文档同步**: 保持两个环境的 skill 文档在配置逻辑上一致

**推荐做法**: 优先在 Claude Code CLI 中实现和验证，然后同步到 Cursor 环境（如果需要在 Cursor 中使用）。由于 Cursor 可以通过 MCP 访问文件系统，配置读取逻辑完全兼容。

---

## 实现状态

### 已完成的实现

| 组件 | 文件路径 | 状态 |
|------|----------|------|
| 配置加载器 | `scripts/bmad-config.ts` | ✅ 完成 (400+ lines) |
| 配置测试 | `scripts/bmad-config.test.ts` | ✅ 19 tests passing |
| 环境检测 | `detectEnvironment()` | ✅ 支持 Cursor/Claude 识别 |
| 子代理参数 | `getSubagentParams()` | ✅ 自动适配平台 |
| Epic审计Agent | `.claude/agents/bmad-epic-audit.md` | ✅ 完成 (~500 lines) |

### API 验证

```typescript
// 环境检测
const env = detectEnvironment();
// Cursor: { platform: 'cursor', subagentTool: 'mcp_task', ... }
// Claude: { platform: 'claude', subagentTool: 'Agent', ... }

// 子代理参数
const params = getSubagentParams();
// 自动返回适配当前平台的参数
```

### 测试验证

```bash
# 运行配置系统测试
npx vitest run scripts/bmad-config.test.ts

# 结果
✓ scripts/bmad-config.test.ts (19 tests)
✓ Environment Detection
✓ Default Configuration
✓ Mode: full
✓ Validation Checks
✓ Report Path Formatting
✓ Configuration Validation
✓ Subagent Parameters
```

### 待完成工作

- [ ] Phase 2: Skill 适配 - 更新 SKILL.md 配置读取逻辑
- [ ] Phase 3: Agent 适配 - Layer 4 agents 条件审计支持
- [ ] Phase 4: 跨平台集成测试
