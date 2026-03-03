# Speckit Specs 目录使用指南

## 📋 概述

本指南详细说明如何在 `specs` 目录下使用 Speckit 工作流创建带索引的功能子目录，并触发完整的 Speckit 开发流程，生成标准化的规范文档结构。

**适用场景**：

- 创建新的功能开发规范
- 管理跨模块的大型功能需求
- 使用标准化的文档结构指导 AI 助手开发
- 维护项目级别的功能规划文档

## 🎯 核心目标

通过 Speckit 工作流，你可以：

1. ✅ **自动创建带索引的子目录**：系统自动检测下一个可用编号（如 015）
2. ✅ **生成完整的功能规范文档**：从需求描述到实施计划的完整文档链
3. ✅ **标准化开发流程**：遵循统一的文档结构和开发规范
4. ✅ **AI 助手友好**：生成的文档可直接用于指导 AI 助手进行开发

## 📁 目录结构说明

### Specs 目录组织

```text
specs/
├── 000-Overview/                    # Speckit 配置和模板目录
│   ├── .cursor/
│   │   └── commands/                 # Speckit 命令定义
│   │       ├── speckit.specify.md   # 创建功能规格命令
│   │       ├── speckit.plan.md      # 生成实施计划命令
│   │       └── speckit.tasks.md     # 生成任务清单命令
│   └── .specify/                     # Speckit 配置目录
│       ├── memory/
│       │   └── constitution.md       # 项目宪章
│       └── templates/                # 文档模板
│           ├── spec-template.md
│           ├── plan-template.md
│           └── tasks-template.md
│
└── 015-feature-name/                 # 功能目录（自动创建）
    ├── .speckit.specify/             # Speckit 配置（plan 阶段生成）
    │   ├── memory/
    │   │   └── constitution.md       # 功能专用宪章
    │   └── templates/
    ├── spec.md                       # 功能规格说明（specify 阶段生成）
    ├── plan.md                       # 实施计划（plan 阶段生成）
    ├── tasks.md                      # 任务清单（tasks 阶段生成）
    ├── research.md                   # 研究文档（plan 阶段生成）
    ├── data-model.md                 # 数据模型（plan 阶段生成）
    ├── quickstart.md                 # 快速开始（plan 阶段生成）
    ├── constitution.md               # 功能开发宪法（plan 阶段生成）
    ├── checklists/
    │   └── requirements.md           # 质量检查清单（specify 阶段生成）
    └── contracts/                    # API 契约（plan 阶段生成）
        └── *.md
```

**说明**：自动化脚本已迁移至 `_bmad/scripts/bmad-speckit/powershell/`，请在该路径下执行（如 create-new-feature.ps1、setup-plan.ps1），不再位于 specs/000-Overview/.specify 或功能目录下。

## 🚀 完整工作流程

### 阶段 1：创建功能规格（Specify）

**执行位置**：`specs/000-Overview/` 目录

**命令格式**：

```bash
/speckit.specify <功能描述>
```

**功能描述要求**：

- 清晰描述要开发的功能
- 包含关键的业务价值和技术要点
- 可以是中文或英文

**示例**：

```bash
/speckit.specify 优化多周期图表渲染性能，减少内存占用和提升帧率，支持实时数据更新
```

**自动完成的工作**：

1. **搜索相关设计文档**（新增功能）：
   - 自动搜索以下位置的相关设计文档：
     - `specs/000-Overview/*.md` - Overview 目录下的设计文档
     - `specs/TBD - */*.md` - TBD 目录下的设计文档
     - `poc/*/*.md` - POC 目录下的相关文档
     - `docs/*.md` - 文档目录下的相关文件
   - 使用关键词匹配和相关性评分算法
   - 返回最相关的文档（最多 10 个）
   - 如果找到相关文档，会在生成 `spec.md` 时：
     - 提取关键信息（设计决策、架构、需求、约束）
     - 在 `spec.md` 末尾添加"参考文档"部分
     - 引用这些文档，便于后续查阅

2. **编号检测**：

   - 检查 Git 远程分支：`git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+-.*'`
   - 检查本地分支：`git branch | grep -E '^[* ]*[0-9]+-.*'`
   - 检查 specs 目录：扫描 `specs/[0-9]+-*/` 目录
   - 自动选择下一个可用编号（如 015）

3. **短名称生成**：

   - 从功能描述中提取关键词
   - 生成 2-4 词的短名称（如 `chart-performance-optimization`）
   - 使用 kebab-case 格式

4. **目录创建**：
   - 自动创建：`specs/015-chart-performance-optimization/`
   - 创建 `checklists/` 子目录

4. **文档生成**：
   - 生成 `spec.md` - 功能规格说明
     - 包含用户场景、功能需求、成功标准等
     - 使用模板 `.specify/templates/spec-template.md`
   - 生成 `checklists/requirements.md` - 质量检查清单
     - 验证规格说明的完整性和质量
     - 处理需要澄清的问题（最多 3 个）

5. **Git 分支**（如果使用 Git）：
   - 创建并切换到新分支：`015-chart-performance-optimization`

**输出文件**：

```text
specs/015-chart-performance-optimization/
├── spec.md                          # 功能规格说明（包含参考文档部分）
└── checklists/
    └── requirements.md               # 质量检查清单
```

**参考文档功能说明**：

如果系统找到了相关的设计文档，`spec.md` 会自动包含一个"参考文档"部分，例如：

```markdown
## Reference Documents

The following design documents were referenced during specification creation:

- [多周期图表性能优化设计文档](../000-Overview/多周期图表性能优化设计文档.md) - Comprehensive design document covering architecture and implementation details
- [多周期图表性能问题分析](../000-Overview/多周期图表性能问题分析.md) - Problem analysis and root cause identification
```

**如何利用已有设计文档**：

1. **在 POC 或讨论阶段**：
   - 将设计文档放在 `specs/000-Overview/` 目录
   - 或放在 `specs/TBD - <功能名称>/` 目录
   - 文档名称应包含关键词，便于自动匹配

2. **文档命名建议**：
   - 包含功能关键词（如"图表"、"性能"、"优化"）
   - 使用描述性名称（如"设计文档"、"分析报告"、"方案"）
   - 示例：`多周期图表性能优化设计文档.md`

3. **自动引用机制**：
   - 系统会根据功能描述和短名称自动搜索相关文档
   - 使用关键词匹配和相关性评分
   - 最相关的文档（评分 > 10）会被引用
   - 文档内容会被用于补充功能规格，但不会包含实现细节

**关键脚本**：
- `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

**注意事项**：
- 必须在 `specs/000-Overview/` 目录执行
- 功能描述不能为空
- 如果存在需要澄清的问题，系统会提示（最多 3 个）
- 编号检测会考虑所有三个来源（远程分支、本地分支、specs 目录）

---

### 阶段 2：生成实施计划（Plan）

**执行位置**：新创建的功能目录（如 `specs/015-chart-performance-optimization/`）

**命令格式**：

```bash
/speckit.plan
```

**自动完成的工作**：

1. **上下文加载**：

   - 读取 `spec.md` 文件
   - 读取 `.specify/memory/constitution.md`（项目宪章）
   - 加载实施计划模板

2. **技术上下文生成**：

   - 填写技术栈、依赖、约束条件
   - 执行 Constitution Check（规范检查）
   - 标记需要澄清的部分（NEEDS CLARIFICATION）

3. **Phase 0：研究阶段**：

   - 生成 `research.md` 文件
   - 研究技术选型、最佳实践
   - 解决所有 NEEDS CLARIFICATION 标记
   - 记录决策和替代方案

4. **Phase 1：设计阶段**：
   - 生成 `data-model.md` - 数据模型设计
     - 实体名称、字段、关系
     - 验证规则
     - 状态转换（如适用）
   - 生成 `contracts/` 目录 - API 契约定义
     - 每个用户操作 → 端点
     - 使用标准 REST/GraphQL 模式
     - OpenAPI/GraphQL schema
   - 生成 `quickstart.md` - 快速开始指南
     - 测试场景
     - 使用示例
   - 生成 `constitution.md` - 功能开发宪法
     - 功能特定的开发规范
     - 技术约束和标准
   - 更新 AI 助手上下文文件
     - 运行 `_bmad/scripts/bmad-speckit/powershell/update-agent-context.ps1`

5. **Phase 2：计划阶段**：
   - 生成 `plan.md` - 完整的实施计划
     - 技术方案
     - 阶段划分
     - 任务分解
     - 工作量估算

6. **Speckit 配置创建**：
   - 创建 `.speckit.specify/` 目录结构
   - 复制模板和脚本到功能目录
   - 创建功能专用的宪章文件

**输出文件**：

```text
specs/015-chart-performance-optimization/
├── .speckit.specify/                 # Speckit 配置（新增）
│   ├── memory/
│   │   └── constitution.md
│   └── templates/
├── plan.md                           # 实施计划（新增）
├── research.md                       # 研究文档（新增）
├── data-model.md                     # 数据模型（新增）
├── quickstart.md                     # 快速开始（新增）
├── constitution.md                   # 功能开发宪法（新增）
└── contracts/                        # API 契约（新增）
    └── *.md
```

上述输出目录中不再包含脚本；自动化脚本位于 `_bmad/scripts/bmad-speckit/powershell/`，请在该路径下执行。

**关键脚本**：
- `_bmad/scripts/bmad-speckit/powershell/setup-plan.ps1`
- `_bmad/scripts/bmad-speckit/powershell/update-agent-context.ps1`

**注意事项**：
- 必须在功能目录执行（不是 000-Overview 目录）
- 需要先完成 specify 阶段（存在 spec.md）
- 如果存在 NEEDS CLARIFICATION，会在 research.md 中解决
- Constitution Check 会验证是否符合项目规范

---

### 阶段 3：生成任务清单（Tasks）

**执行位置**：功能目录

**命令格式**：

```bash
/speckit.tasks
```

**自动完成的工作**：

1. **前置检查**：

   - 运行 `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1`
   - 验证所需文档是否存在

2. **设计文档加载**：

   - **必需**：`plan.md`（技术栈、库、结构）、`spec.md`（用户故事及优先级）
   - **可选**：`data-model.md`（实体）、`contracts/`（API 端点）、`research.md`（决策）、`quickstart.md`（测试场景）

3. **任务生成**：
   - 从 `plan.md` 提取技术栈、库、项目结构
   - 从 `spec.md` 提取用户故事及其优先级（P1, P2, P3...）
   - 如果存在 `data-model.md`：提取实体并映射到用户故事
   - 如果存在 `contracts/`：映射端点到用户故事
   - 如果存在 `research.md`：提取决策用于设置任务
   - 按用户故事组织任务
   - 生成依赖关系图
   - 创建并行执行示例
   - 验证任务完整性

4. **任务清单生成**：
   - 使用 `.specify/templates/tasks-template.md` 作为结构
   - 填写正确的功能名称（从 plan.md）
   - **Phase 1**：设置任务（项目初始化）
   - **Phase 2**：基础任务（所有用户故事的阻塞先决条件）
   - **Phase 3+**：每个用户故事一个阶段（按 spec.md 中的优先级顺序）
   - 每个阶段包括：故事目标、独立测试标准、测试（如请求）、实施任务
   - **最终阶段**：完善和跨领域关注点
   - 所有任务必须遵循严格的清单格式

**输出文件**：

```text
specs/015-chart-performance-optimization/
└── tasks.md                          # 任务清单（新增）
```

**任务格式要求**：

每个任务必须严格遵循以下格式：

```markdown
- [ ] [TaskID] [P?] [Story?] Description with file path
```

**格式组件**：

1. **Checkbox**：始终以 `- [ ]` 开头（markdown checkbox）
2. **Task ID**：顺序编号（T001, T002, T003...）按执行顺序
3. **[P] 标记**：仅在任务可并行化时包含（不同文件，不依赖未完成的任务）
4. **[Story] 标签**：仅用户故事阶段任务需要
   - 格式：[US1], [US2], [US3] 等（映射到 spec.md 中的用户故事）
   - 设置阶段：无故事标签
   - 基础阶段：无故事标签
   - 用户故事阶段：必须有故事标签
   - 完善阶段：无故事标签
5. **描述**：清晰的操作说明，包含确切的文件路径

**示例**：

- ✅ 正确：`- [ ] T001 Create project structure per implementation plan`
- ✅ 正确：`- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
- ✅ 正确：`- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- ✅ 正确：`- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ❌ 错误：`- [ ] Create User model`（缺少 ID 和 Story 标签）
- ❌ 错误：`T001 [US1] Create model`（缺少 checkbox）
- ❌ 错误：`- [ ] [US1] Create User model`（缺少 Task ID）
- ❌ 错误：`- [ ] T001 [US1] Create model`（缺少文件路径）

**注意事项**：
- 任务必须按用户故事组织，以支持独立实施和测试
- 测试是可选的：仅在功能规格中明确请求或用户要求 TDD 方法时生成测试任务
- 每个用户故事应该是一个完整、独立可测试的增量

---

## 📝 完整示例

### 示例 1：创建图表性能优化功能

```bash
# ============================================
# 步骤 1：创建功能规格
# ============================================
# 位置：specs/000-Overview/
# 命令：
/speckit.specify 优化多周期图表渲染性能，减少内存占用和提升帧率，支持实时数据更新

# 结果：
# ✅ 自动创建 specs/015-chart-performance-optimization/
# ✅ 生成 spec.md
# ✅ 生成 checklists/requirements.md
# ✅ 创建 Git 分支 015-chart-performance-optimization

# ============================================
# 步骤 2：生成实施计划
# ============================================
# 位置：specs/015-chart-performance-optimization/
# 命令：
/speckit.plan

# 结果：
# ✅ 生成 plan.md
# ✅ 生成 research.md
# ✅ 生成 data-model.md
# ✅ 生成 quickstart.md
# ✅ 生成 constitution.md
# ✅ 生成 contracts/
# ✅ 创建 .speckit.specify/ 目录结构

# ============================================
# 步骤 3：生成任务清单
# ============================================
# 位置：specs/015-chart-performance-optimization/
# 命令：
/speckit.tasks

# 结果：
# ✅ 生成 tasks.md
```

### 示例 2：创建 HKFE 周期重构功能

```bash
# ============================================
# 步骤 1：创建功能规格
# ============================================
# 位置：specs/000-Overview/
# 命令：
/speckit.specify 重构 HKFE 周期计算系统，统一标量实现和向量化实现，实现配置驱动的周期计算

# 结果：
# ✅ 自动创建 specs/013-hkfe-period-refactor/
# ✅ 生成 spec.md
# ✅ 生成 checklists/requirements.md

# ============================================
# 步骤 2：生成实施计划
# ============================================
# 位置：specs/013-hkfe-period-refactor/
# 命令：
/speckit.plan

# 结果：
# ✅ 生成完整的 speckit 目录结构
# ✅ 生成所有设计文档

# ============================================
# 步骤 3：生成任务清单
# ============================================
# 位置：specs/013-hkfe-period-refactor/
# 命令：
/speckit.tasks

# 结果：
# ✅ 生成 tasks.md
```

---

## 🔍 工作流程详解

### 编号自动检测机制

`create-new-feature.ps1` 脚本会从三个来源检测已使用的编号：

1. **Git 远程分支**：
   ```powershell
   git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+-.*'
   ```

2. **Git 本地分支**：
   ```powershell
   git branch | grep -E '^[* ]*[0-9]+-.*'
   ```

3. **Specs 目录**：
   ```powershell
   Get-ChildItem -Path $SpecsDir -Directory | Where-Object { $_.Name -match '^(\d+)-' }
   ```

**编号选择逻辑**：
- 从所有三个来源提取编号
- 找到最高编号 N
- 使用 N+1 作为新功能的编号
- 如果未找到任何编号，从 001 开始

**短名称匹配**：
- 脚本会匹配具有相同短名称的分支/目录
- 例如：如果存在 `015-chart-performance`，新功能 `chart-performance-optimization` 会使用 016

### 文档生成流程

#### Specify 阶段文档生成

1. **解析用户描述**：
   - 提取关键概念：参与者、操作、数据、约束
   - 识别需要澄清的方面

2. **生成功能规格**：
   - 使用 `spec-template.md` 模板
   - 填写用户场景、功能需求、成功标准
   - 最多标记 3 个需要澄清的问题

3. **质量验证**：
   - 创建 `checklists/requirements.md`
   - 验证规格完整性
   - 处理澄清问题

#### Plan 阶段文档生成

1. **Phase 0：研究**：
   - 提取技术上下文中的未知项
   - 研究技术选型、最佳实践
   - 解决所有 NEEDS CLARIFICATION
   - 生成 `research.md`

2. **Phase 1：设计**：
   - 从功能规格提取实体 → `data-model.md`
   - 从功能需求生成 API 契约 → `contracts/`
   - 创建快速开始指南 → `quickstart.md`
   - 更新 AI 助手上下文

3. **Phase 2：计划**：
   - 生成完整实施计划 → `plan.md`
   - 包含技术方案、阶段划分、任务分解

#### Tasks 阶段文档生成

1. **加载设计文档**：
   - 必需：`plan.md`, `spec.md`
   - 可选：`data-model.md`, `contracts/`, `research.md`, `quickstart.md`

2. **任务组织**：
   - 按用户故事组织（主要组织方式）
   - 从用户故事映射组件（模型、服务、端点）
   - 标记故事依赖关系

3. **生成任务清单**：
   - Phase 1：设置任务
   - Phase 2：基础任务
   - Phase 3+：用户故事阶段（按优先级）
   - 最终阶段：完善和跨领域关注点

---

## 🔍 参考文档功能详解

### 工作原理

当执行 `/speckit.specify` 时，系统会：

1. **自动搜索**：
   - 从功能描述中提取关键词
   - 在指定目录中搜索包含这些关键词的文档
   - 计算每个文档的相关性评分

2. **相关性评分**：
   - 文件名匹配关键词：+10 分
   - 文件内容匹配关键词：+5 分
   - 短名称匹配：+20 分
   - 设计文档标识符（设计、分析、方案等）：+15 分

3. **文档引用**：
   - 选择评分最高的 3-5 个文档
   - 提取关键信息（业务需求、用户需求、成功标准）
   - 在 `spec.md` 末尾添加"参考文档"部分

### 搜索位置

系统会在以下位置搜索相关文档：

1. **`specs/000-Overview/*.md`**：
   - 存放项目级别的设计文档
   - 示例：`多周期图表性能优化设计文档.md`

2. **`specs/TBD - */*.md`**：
   - 存放待开发功能的设计文档
   - 示例：`specs/TBD - 多周期图表性能问题/*.md`

3. **`poc/*/*.md`**：
   - 存放概念验证相关的文档
   - 示例：`poc/smartstop/README.md`

4. **`docs/*.md`**：
   - 存放项目文档
   - 示例：`docs/speckit/*.md`

### 最佳实践

1. **文档组织**：
   ```
   specs/
   ├── 000-Overview/
   │   ├── 多周期图表性能优化设计文档.md    # 完整设计文档
   │   └── 多周期图表性能问题分析.md        # 问题分析
   └── TBD - 多周期图表性能问题/
       └── 多周期图表性能问题分析.md         # 详细分析
   ```

2. **文档命名**：
   - ✅ 好的命名：`多周期图表性能优化设计文档.md`
   - ✅ 好的命名：`图表渲染性能分析报告.md`
   - ❌ 不好的命名：`设计.md`（太通用）
   - ❌ 不好的命名：`文档1.md`（无意义）

3. **文档内容**：
   - 包含功能关键词
   - 包含设计决策和架构说明
   - 包含业务需求和用户需求
   - 避免只包含实现细节

### 示例场景

**场景 1：已有完整设计文档**

```bash
# 1. 在 specs/000-Overview/ 目录下已有设计文档
#    多周期图表性能优化设计文档.md

# 2. 执行 speckit.specify
/speckit.specify 优化多周期图表渲染性能，减少内存占用和提升帧率

# 3. 系统自动发现并引用设计文档
#    生成的 spec.md 会包含：
#    ## Reference Documents
#    - [多周期图表性能优化设计文档](../000-Overview/多周期图表性能优化设计文档.md)
```

**场景 2：TBD 目录中的设计文档**

```bash
# 1. 在 specs/TBD - 多周期图表性能问题/ 目录下有分析文档
#    多周期图表性能问题分析.md

# 2. 执行 speckit.specify
/speckit.specify 优化多周期图表渲染性能

# 3. 系统会自动发现 TBD 目录中的相关文档
```

## ⚠️ 常见问题

### Q1: 在哪里执行 `/speckit.specify` 命令？

**A**: 必须在 `specs/000-Overview/` 目录执行。脚本会从该目录查找 `.specify/` 配置目录。

### Q2: 编号检测失败怎么办？

**A**: 
- 确保 Git 仓库已初始化
- 检查网络连接（如果需要获取远程分支）
- 可以手动指定编号：脚本支持 `-Number N` 参数

### Q3: 短名称生成不符合预期怎么办？

**A**: 
- 可以在命令中手动指定短名称：`-ShortName "custom-name"`
- 短名称应该是 2-4 个词，使用 kebab-case

### Q4: `/speckit.plan` 提示缺少文件？

**A**: 
- 确保先执行了 `/speckit.specify`
- 确保在功能目录（不是 000-Overview）执行
- 检查 `spec.md` 文件是否存在

### Q5: 如何跳过某个阶段？

**A**: 
- `specify` 阶段是必需的（创建目录和基础文档）
- `plan` 阶段是推荐的（生成设计文档）
- `tasks` 阶段是可选的（如果需要详细任务清单）

### Q6: 如何修改已生成的文档？

**A**: 
- 可以直接编辑生成的文档
- 重新运行命令会覆盖现有文档（注意备份）
- 建议在生成后手动调整以满足特定需求

### Q7: 如何让系统自动引用已有的设计文档？

**A**: 
- 将设计文档放在以下位置之一：
  - `specs/000-Overview/` 目录
  - `specs/TBD - <功能名称>/` 目录
  - `poc/` 目录
- 文档名称应包含功能关键词
- 系统会在执行 `/speckit.specify` 时自动搜索并引用相关文档
- 参考文档会在 `spec.md` 的末尾列出

### Q8: `/speckit.plan` 一直卡在 "waiting for review" 状态怎么办？

**A**: 
- 这通常是因为需要用户确认某些内容（Constitution Check 违规、技术选型、设计决策）
- 查看生成的 `plan.md` 文件，找到需要确认的部分
- 提供所需信息或确认，然后明确指示 AI 继续
- 详细解决方案请参考：[speckit-plan-waiting-for-review-解决方案.md](./speckit-plan-waiting-for-review-解决方案.md)

### Q9: 如何查看完整的 speckit 目录结构示例？

**A**: 
- 参考 `specs/013-hkfe-period-refactor/` 目录
- 参考 `specs/014-chart-performance-optimization/` 目录
- 这些目录展示了完整的 speckit 目录结构

---

## 🎯 最佳实践

### 1. 功能描述编写

**好的描述**：
- ✅ 清晰描述业务价值
- ✅ 包含关键功能点
- ✅ 说明技术约束（如适用）
- ✅ 长度适中（1-3 句话）

**示例**：
```
优化多周期图表渲染性能，减少内存占用和提升帧率，支持实时数据更新，确保在低端设备上也能流畅运行
```

**不好的描述**：
- ❌ 过于简短："优化图表"
- ❌ 过于技术化："使用 WebGL 渲染"
- ❌ 包含实现细节："重构 ChartWidget 类"

### 2. 编号管理

- **建议**：让系统自动检测编号
- **特殊情况**：如果需要特定编号，可以手动指定
- **注意**：编号应该连续，避免跳号（除非有特殊原因）

### 3. 文档维护

- **及时更新**：功能演进时及时更新文档
- **版本控制**：所有文档纳入 Git 版本控制
- **文档同步**：确保 `spec.md`、`plan.md`、`tasks.md` 保持一致

### 4. 澄清问题处理

- **限制数量**：最多 3 个澄清问题
- **优先级**：范围 > 安全/隐私 > 用户体验 > 技术细节
- **及时解决**：在 `plan` 阶段的 `research.md` 中解决所有澄清问题

### 5. 任务清单使用

- **按阶段执行**：遵循 Phase 1 → Phase 2 → Phase 3+ 的顺序
- **独立测试**：每个用户故事阶段应该是独立可测试的
- **并行机会**：利用 [P] 标记的任务进行并行开发

---

## 📚 相关文档

- [Speckit 多模块开发最佳实践](./speckit多模块开发最佳实践.md)
- [如何结合 OpenSpec 和 Speckit 开发功能需求](../如何结合OpenSpec和Speckit开发功能需求.md)
- [Speckit Plan "Waiting for Review" 状态解决方案](./speckit-plan-waiting-for-review-解决方案.md)
- [项目宪章](../speckit.constitution)

---

## 🔗 参考实现

### 完整示例目录

1. **HKFE 周期重构**：
   - 目录：`specs/013-hkfe-period-refactor/`
   - 特点：完整的 speckit 目录结构，包含所有阶段文档

2. **图表性能优化**：
   - 目录：`specs/014-chart-performance-optimization/`
   - 特点：标准化的文档结构，包含设计文档

### 脚本位置

- **创建新功能脚本**：
  `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

- **设置计划脚本**：
  `_bmad/scripts/bmad-speckit/powershell/setup-plan.ps1`

- **检查前置条件脚本**：
  `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1`

- **更新 AI 上下文脚本**：
  `_bmad/scripts/bmad-speckit/powershell/update-agent-context.ps1`

- **搜索相关文档脚本**：
  `_bmad/scripts/bmad-speckit/powershell/find-related-docs.ps1`

---

## 📝 总结

通过遵循本指南，你可以：

1. ✅ 在 `specs/000-Overview/` 目录执行 `/speckit.specify <功能描述>` 自动创建带索引的子目录
2. ✅ 在新创建的功能目录执行 `/speckit.plan` 生成完整的设计文档
3. ✅ 在功能目录执行 `/speckit.tasks` 生成详细的任务清单
4. ✅ 获得标准化的文档结构，便于 AI 助手理解和执行开发任务

**关键要点**：
- 必须在正确的目录执行命令
- 按顺序执行三个阶段（specify → plan → tasks）
- 系统会自动处理编号检测和目录创建
- 生成的文档可以直接用于指导开发工作

---

**最后更新**：2026-01-14  
**维护者**：项目团队  
**反馈**：如有问题或建议，请提交 Issue 或 PR
