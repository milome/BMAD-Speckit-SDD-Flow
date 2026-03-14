# BMAD Story Assistant 审计粒度配置设计方案

## 1. 当前审计触发点分析

### 1.1 全流程审计触发点映射

```
BMAD Story 4阶段工作流：

Stage 1: Create Story (Layer 3)
  └─→ Story文档审计 (story_audit) ←── 触发点1

Stage 2: Story审计 (Layer 3)
  └─→ 通过后进入 Layer 4

Stage 3: Dev Story / Layer 4 技术实现 (嵌套 speckit-workflow)
  ├─→ specify → AUDIT_spec ←───────── 触发点2
  ├─→ plan    → AUDIT_plan ←───────── 触发点3
  ├─→ gaps    → AUDIT_GAPS ←───────── 触发点4
  ├─→ tasks   → AUDIT_tasks ←──────── 触发点5
  └─→ implement → AUDIT_implement ←── 触发点6

Stage 4: Post Audit (实施后审计)
  └─→ Stage 4审计 ←────────────────── 触发点7
```

### 1.2 各阶段审计触发机制

| 阶段 | Agent文件 | 审计触发位置 | 审计类型 |
|------|-----------|--------------|----------|
| story_create | bmad-story-create.md | Stage 1输出后 | story文档审计 |
| story_audit | bmad-story-audit.md | Stage 2 | story级审计 |
| specify | bmad-layer4-speckit-specify.md | Step 4: 审计循环 | 阶段审计 |
| plan | bmad-layer4-speckit-plan.md | Step 4: 审计循环 | 阶段审计 |
| gaps | bmad-layer4-speckit-gaps.md | Step 3: 审计循环 | 阶段审计 |
| tasks | bmad-layer4-speckit-tasks.md | Step 4: 审计循环 | 阶段审计 |
| implement | bmad-layer4-speckit-implement.md | Step 5: 最终审计 | 阶段审计 + Stage 4 |

## 2. 三种粒度模式设计

### 2.1 粒度模式定义

```yaml
audit_granularity:
  # full: 当前实现，所有阶段都做审计 (7个触发点全部启用)
  # story: 只在创建story和实施完story做审计 (触发点1、7启用，2-6跳过)
  # epic: 只在epic创建和整个epic完成后做审计 (需要新的Epic级审计机制)
```

### 2.2 各模式下的审计策略

#### Mode: full (当前默认)
```
Stage 1 ──审计──┐
Stage 2 ──审计──┤
specify ──审计──┤
plan ─────审计──┤──→ 所有阶段严格审计
gaps ─────审计──┤
tasks ────审计──┤
implement ─审计─┘
```

#### Mode: story
```
Stage 1 ──审计──┐
specify ────────┤
plan ───────────┤──→ 中间阶段不做审计
                │    但仍需生成文档
Stage 3 ────────┤    仅做基本验证
gaps ───────────┤
tasks ──────────┤
Stage 4 ──审计──┘──→ 实施后审计必须执行
```

#### Mode: epic
```
Epic创建 ─────审计──┐
Story 1 ───────────┤
Story 2 ───────────┤──→ Story级不做审计
Story N ───────────┤    所有中间文档生成但不审计
Epic完成 ────审计──┘──→ Epic级综合审计
```

## 3. 配置方案设计

### 3.1 配置文件位置与结构

建议配置文件：`config/bmad-story-config.yaml`

```yaml
# BMAD Story Assistant 配置
version: "1.0"

# 审计粒度配置
audit_granularity:
  # 可选值: full | story | epic
  # 优先级: CLI参数 > 项目配置 > 默认(full)
  mode: "full"

  # 各粒度模式详细配置
  modes:
    full:
      name: "全流程审计"
      description: "所有阶段都执行严格审计"
      stages:
        story_create:    { audit: true,  strictness: "standard" }
        story_audit:     { audit: true,  strictness: "standard" }
        specify:         { audit: true,  strictness: "standard" }
        plan:            { audit: true,  strictness: "standard" }
        gaps:            { audit: true,  strictness: "standard" }
        tasks:           { audit: true,  strictness: "standard" }
        implement:       { audit: true,  strictness: "strict" }
        post_audit:      { audit: true,  strictness: "strict" }

    story:
      name: "Story级轻量审计"
      description: "仅在Story创建和实施后执行审计，中间阶段只做验证"
      stages:
        story_create:    { audit: true,  strictness: "standard" }
        story_audit:     { audit: true,  strictness: "standard" }
        # 中间阶段: 生成文档但不触发审计agent
        specify:         { audit: false, generate_doc: true, validation: "basic" }
        plan:            { audit: false, generate_doc: true, validation: "basic" }
        gaps:            { audit: false, generate_doc: true, validation: "basic" }
        tasks:           { audit: false, generate_doc: true, validation: "basic" }
        # implement阶段需要特殊处理: 执行代码+测试但不触发审计
        implement:       { audit: false, generate_doc: true, validation: "test_only" }
        post_audit:      { audit: true,  strictness: "strict" }

    epic:
      name: "Epic级综合审计"
      description: "仅在Epic创建和完成后执行审计，Story级只做文档生成"
      stages:
        epic_create:     { audit: true,  strictness: "standard" }
        # Story级所有阶段都不做审计
        story_create:    { audit: false, generate_doc: true }
        specify:         { audit: false, generate_doc: true }
        plan:            { audit: false, generate_doc: true }
        gaps:            { audit: false, generate_doc: true }
        tasks:           { audit: false, generate_doc: true }
        implement:       { audit: false, generate_doc: true }
        # Epic级实施后审计
        epic_complete:   { audit: true,  strictness: "strict" }

# 验证级别配置 (用于 audit: false 的阶段)
validation_levels:
  basic:
    description: "基础验证"
    checks:
      - document_exists    # 文档存在性检查
      - schema_valid       # 基本结构检查
      - required_sections  # 必需章节检查

  test_only:
    description: "仅测试验证"
    checks:
      - all_tests_pass     # 所有测试通过
      - lint_no_errors     # Lint无错误
      - document_exists    # 文档存在

# 审计收敛配置 (与现有 audit-config-schema.md 兼容)
audit_convergence:
  default: "standard"
  strict:
    rounds: 3
    no_gap_required: true
    critical_auditor_ratio: 0.5
  standard:
    rounds: 1
    no_gap_required: false
    critical_auditor_ratio: 0.5
```

### 3.2 配置优先级设计

```yaml
# 配置来源优先级 (从高到低)
config_priority:
  1: "CLI参数: --audit-granularity=story"
  2: "环境变量: BMAD_AUDIT_GRANULARITY=story"
  3: "项目配置: config/bmad-story-config.yaml"
  4: "用户全局配置: ~/.claude/bmad-story-config.yaml"
  5: "skill默认值: full"
```

## 4. Skill集成方案

### 4.1 bmad-story-assistant SKILL.md 修改

需要在 skill 入口添加配置读取逻辑：

```markdown
## 配置系统

### 审计粒度配置

skill 支持三种审计粒度模式：
- `full`: 全流程审计（默认）
- `story`: Story级轻量审计
- `epic`: Epic级综合审计

### 配置方式

1. **CLI参数**: `/bmad-story-assistant --audit-granularity=story`
2. **项目配置**: 创建 `config/bmad-story-config.yaml`
3. **环境变量**: `BMAD_AUDIT_GRANULARITY=story`

### 各模式行为差异

| 模式 | Story创建审计 | 中间阶段审计 | 实施后审计 | Epic审计 |
|------|--------------|-------------|-----------|---------|
| full | ✓ | ✓ (全部) | ✓ | - |
| story | ✓ | ✗ (跳过) | ✓ | - |
| epic | ✗ | ✗ (跳过) | ✗ | ✓ (Epic级) |

### 配置示例

```yaml
# config/bmad-story-config.yaml
audit_granularity:
  mode: "story"
```
```

### 4.2 阶段Agent的审计条件判断

需要在每个 Layer 4 agent 中添加审计开关检查：

```typescript
// 在每个agent的 Mandatory Startup 步骤中添加

// 1. 读取配置
const config = await readAuditConfig();
const stageConfig = config.audit_granularity.modes[config.mode].stages[currentStage];

// 2. 根据配置决定是否执行审计
if (stageConfig.audit) {
  // 执行完整审计流程
  await executeAuditCycle(strictness: stageConfig.strictness);
} else if (stageConfig.validation) {
  // 执行轻量验证
  await executeBasicValidation(level: stageConfig.validation);
} else {
  // 仅生成文档，不做任何检查
  await generateDocumentOnly();
}
```

## 5. 实现详细设计

### 5.1 配置读取模块

```typescript
// scripts/bmad-config.ts
export interface AuditGranularityConfig {
  mode: 'full' | 'story' | 'epic';
  modes: {
    [key: string]: {
      name: string;
      description: string;
      stages: {
        [stage: string]: {
          audit: boolean;
          strictness?: 'strict' | 'standard';
          generate_doc?: boolean;
          validation?: 'basic' | 'test_only' | null;
        }
      }
    }
  }
}

export function loadAuditConfig(): AuditGranularityConfig {
  // 1. 尝试从CLI参数读取
  const cliMode = process.env.BMAD_CLI_AUDIT_GRANULARITY;

  // 2. 尝试从环境变量读取
  const envMode = process.env.BMAD_AUDIT_GRANULARITY;

  // 3. 尝试从项目配置读取
  const projectConfig = readProjectConfig();

  // 4. 使用默认值
  const mode = cliMode || envMode || projectConfig?.mode || 'full';

  return mergeWithDefaults(mode);
}
```

### 5.2 各Agent的条件审计实现

以 `bmad-layer4-speckit-specify.md` 为例：

```markdown
## 条件审计执行

### Step 4: 审计/验证循环

读取配置判断是否执行审计：

```typescript
const config = loadAuditConfig();
const stageConfig = config.modes[config.mode].stages.specify;

if (stageConfig.audit) {
  // 执行完整审计 (原有 Step 4 逻辑)
  await executeFullAudit(strictness: stageConfig.strictness);
} else if (stageConfig.validation === 'basic') {
  // 执行基础验证
  await executeBasicValidation();
} else {
  // audit: false 且无 validation，直接标记为通过
  markStageAsPassedWithoutAudit();
}
```

### 基础验证流程 (用于 story/epic 模式)

当 `audit: false` 但 `validation: basic` 时：

1. **文档存在性检查**: 验证 spec.md 已生成
2. **结构检查**: 验证包含必需章节
3. **前置文档引用检查**: 验证正确引用 plan.md
4. **直接通过**: 不生成 AUDIT_报告，直接更新状态
```

### 5.3 状态文件适配

在 `story-{epic}-{story}-progress.yaml` 中记录审计模式：

```yaml
version: "2.0"
epic: "E001"
story: "S001"
audit_config:
  mode: "story"  # 记录当前使用的审计粒度
  applied_at: "2026-03-14T10:00:00Z"
stages:
  specify:
    status: completed
    audit_skipped: true  # 标记该阶段审计被跳过
    validation: "basic"   # 记录执行的验证级别
```

## 6. 各粒度模式详细行为

### 6.1 Full Mode (默认)

与当前实现完全一致：
- 所有 7 个审计触发点都执行完整审计
- 每个阶段必须通过审计才能进入下一阶段
- 生成完整的 AUDIT_ 报告链

### 6.2 Story Mode

**关键行为变更：**

1. **Stage 1 (Create Story)**: 正常审计 ✓
2. **Stage 2 (Story Audit)**: 正常审计 ✓
3. **Layer 4 中间阶段 (specify/plan/gaps/tasks)**:
   - 生成文档 ✓
   - 执行基础验证 (文档结构、必需章节)
   - 跳过审计 agent 调用
   - 不生成 AUDIT_ 报告
   - 直接标记为 passed
4. **Implement 阶段**:
   - 执行代码实现和测试
   - 执行 TDD 循环
   - 但不触发 implement 审计
5. **Stage 4 (Post Audit)**: 正常执行严格审计 ✓

**风险评估：**
- 优点: 减少中间阶段审计开销，加速开发流程
- 风险: 中间阶段质量问题可能在最后才发现
- 缓解: Stage 4 审计采用 strict 模式，连续3轮确保质量

### 6.3 Epic Mode

**关键行为变更：**

1. **Epic 创建阶段**:
   - 创建 Epic 文档
   - 执行 Epic 级审计
2. **Story 级所有阶段**:
   - 生成所有中间文档
   - 不做任何审计
   - 不做基础验证
   - 仅追踪进度
3. **Epic 完成阶段**:
   - 收集所有 Story 产物
   - 执行综合审计:
     - 跨 Story 一致性检查
     - Epic 级集成测试
     - 整体架构符合度
     - 全量代码审计

**新增 Epic 级审计 Agent**:

需要创建 `bmad-epic-audit.md`:

```markdown
# Epic 级综合审计 Agent

## 触发时机
- Epic 创建后
- Epic 所有 Story 完成后

## 审计范围
1. **跨 Story 一致性**: 检查各 Story 文档间的一致性
2. **架构符合度**: 检查实现是否符合 Epic 级架构设计
3. **集成完整性**: 检查 Story 间的集成点
4. **代码质量**: 全量代码审计
5. **测试覆盖**: Epic 级测试覆盖检查
```

## 7. 实施计划

### Phase 1: 配置系统 (1-2天) ✅ 已完成

1. ✅ 创建 `config/bmad-story-config.yaml` 模板
   - 实际文件: `config/bmad-story-config.example.yaml` (完整模板)
   - 实际文件: `config/bmad-story-config.yaml` (使用配置)

2. ✅ 实现配置读取模块 `scripts/bmad-config.ts`
   - 完整实现跨平台配置加载
   - 支持环境检测 (Cursor vs Claude)
   - 提供 shouldAudit(), shouldValidate(), getSubagentParams() API

3. ✅ 添加 CLI 参数解析支持
   - 通过环境变量 BMAD_PLATFORM 支持
   - 通过 BMAD_AUDIT_GRANULARITY 配置模式

**实现详情:**
- 代码行数: ~400 lines (bmad-config.ts)
- 测试覆盖: 19 tests (bmad-config.test.ts)
- 测试状态: ✅ 全部通过

### Phase 2: Story Mode (2-3天) ⏳ 进行中

1. ⏳ 修改 bmad-story-assistant skill 添加配置读取
2. ⏳ 修改各 Layer 4 agent 支持条件审计
3. ⏳ 实现基础验证流程
4. ⏳ 更新状态文件格式

### Phase 3: Epic Mode (2-3天) ✅ 已完成

1. ✅ 创建 bmad-epic-audit.md agent
   - 实际文件: `.claude/agents/bmad-epic-audit.md`
   - 包含 Epic 创建审计和完成审计
   - 六维度审计定义完整

2. ✅ 设计 Epic 级综合审计流程
3. ✅ 实现 Epic 级状态追踪
   - 模板文件: `.claude/state/epics/TEMPLATE-epic-progress.yaml`

4. ⏳ 添加 Epic 完成检查点

### Phase 4: 测试与验证 (2天)

1. ⏳ 各模式下的全流程测试
2. ⏳ 配置切换测试
3. ⏳ 向后兼容性测试

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 中间阶段跳过审计导致质量问题 | 高 | Stage 4 采用 strict 模式；Epic 级综合审计 |
| 配置复杂度增加 | 中 | 提供清晰的默认值；完善的文档 |
| 向后兼容性 | 中 | 默认保持 full 模式；渐进式启用 |
| 调试困难 | 中 | 在状态中记录审计模式；详细的日志 |

## 9. 向后兼容性

- **默认行为**: 保持 `full` 模式，与当前实现完全一致
- **配置可选**: 不配置时完全不影响现有流程
- **渐进式采用**: 用户可逐个 Story 或 Epic 启用新模式

## 10. 示例配置

```yaml
# config/bmad-story-config.yaml
version: "1.0"

# 开发团队可以根据项目阶段调整粒度
audit_granularity:
  # 快速原型阶段使用 story 模式
  mode: "story"

  # 发布前切换回 full 模式进行全面审计
  # mode: "full"

# 各模式详细配置可根据需要覆盖
modes:
  story:
    stages:
      # 甚至可以单独调整某个阶段的严格度
      post_audit:
        strictness: "strict"  # 发布后审计必须严格

# 通知配置
notifications:
  when_audit_skipped: true  # 当审计被跳过时通知用户
```

---

## 11. 实现状态

### 11.1 已完成的文件

| 文件 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 配置加载器 | `scripts/bmad-config.ts` | ✅ 完成 | ~400行，支持3种模式 |
| 配置测试 | `scripts/bmad-config.test.ts` | ✅ 完成 | 19个测试全部通过 |
| 配置模板 | `config/bmad-story-config.example.yaml` | ✅ 完成 | 完整配置示例 |
| Epic审计Agent | `.claude/agents/bmad-epic-audit.md` | ✅ 完成 | ~500行，六维度审计 |
| Epic状态模板 | `.claude/state/epics/TEMPLATE-epic-progress.yaml` | ✅ 完成 | Epic级状态追踪 |

### 11.2 API 使用示例

```typescript
import { shouldAudit, shouldValidate, getSubagentParams } from './bmad-config';

// 检查 specify 阶段是否需要审计
const needAudit = shouldAudit('specify');
// 根据配置返回 true (full模式) 或 false (story/epic模式)

// 获取子代理调用参数
const params = getSubagentParams();
// Claude环境: { tool: 'Agent', subagent_type: 'general-purpose' }
// Cursor环境: { tool: 'mcp_task', subagent_type: 'generalPurpose' }
```

### 11.3 测试验证

```bash
# 运行配置加载器测试
npx vitest run scripts/bmad-config.test.ts

# 结果: ✓ 19 tests passed
```

### 11.4 待完成工作

- [ ] Phase 2: Story Mode - Layer 4 agents条件审计支持
- [ ] Phase 4: 全流程集成测试
- [ ] Layer 4各agent文档更新 (specify/plan/gaps/tasks/implement)
