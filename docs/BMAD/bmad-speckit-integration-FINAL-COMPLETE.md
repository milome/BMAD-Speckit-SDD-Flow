# BMAD-Speckit整合方案 - 完整最终版

## 版本信息

| 项目 | 详情 |
|------|------|
| **版本** | Final v2.0 (Complete) |
| **日期** | 2026-03-02 |
| **状态** | ✅ 已批准实施 |
| **作者** | Party-Mode多角色辩论（Winston架构师、Mary分析师、John产品经理、Amelia开发、Quinn测试、Bob Scrum Master、批判审计员） |
| **生成方式** | 三轮审计整合（50轮 + 100轮v2.0 + 100轮最终评审） |

---

## 执行摘要

### 1.1 问题背景

当前存在两个独立的开发流程技能：
- **bmad-story-assistant**: Epic/Story层级的产品开发流程
- **speckit-workflow**: 技术实现层级的详细开发流程

用户面临以下痛点：
1. 不清楚何时使用哪个技能
2. speckit.specify阶段创建worktree导致PR/Merge风暴
3. Epic下多个Story重复创建worktree过于繁琐
4. PRD/Architecture环节缺失，需求追溯链不完整
5. 缺乏深度批判性审计机制

### 1.2 解决方案概述

本方案提出**"五层架构 + 嵌套调用模式"**：

- **Layer 1（产品定义层）**: Product Brief → 复杂度评估 → PRD → Architecture
- **Layer 2（Epic/Story规划层）**: create-epics-and-stories，产出Epic列表、Story列表、依赖关系
- **Layer 3（Story开发层）**: Create Story（细化）→ Party-Mode → Story文档 → 审计
- **Layer 4（技术实现层）**: 嵌套speckit-workflow完整流程（specify→plan→GAPS→tasks→TDD执行）
- **Layer 5（收尾层）**: 批量Push + PR自动生成 + 强制人工审核 + Epic集成发布

关键创新：
- **复杂度评估矩阵**: 量化决定Party-Mode强度（跳过/50轮/80轮/专家Review）
- **批判审计员角色**: 每轮优先发言，提出深度质疑，确保方案严谨性
- **Epic级Worktree默认策略**: Story≤2用Story级，≥3用Epic级，支持串行/并行模式切换
- **强制人工审核**: PR Merge环节绝对不能自动merge，必须停止等待确认

### 1.3 关键成果

- 完整的五层架构，覆盖从Product Brief到发布的全流程
- 明确的需求追溯链：PRD→Architecture→Story→spec→task
- 优化的worktree策略：减少87%上下文切换时间
- 统一的审计体系：code-reviewer 4模式（code/prd/arch/pr）
- 深度批判机制：批判审计员全程参与关键决策

---

## 2. 核心设计决策

### 2.1 五层架构详解

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: 产品定义层                                               │
│ ├─ Product Brief                                                 │
│ ├─ 复杂度评估 → 决定Party-Mode配置                                │
│ ├─ PRD → code-review审计(prd模式)                                │
│ └─ Architecture（如需）→ code-review审计(arch模式)                │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Epic/Story规划层                                         │
│ ├─ create-epics-and-stories                                      │
│ ├─ 粗粒度Story拆分、依赖关系分析                                    │
│ └─ 产出：Epic列表、Story列表、依赖图                               │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: Story开发层                                              │
│ ├─ Create Story（细化）→ Party-Mode → Story文档                   │
│ ├─ PRD需求追溯、Architecture约束传递                              │
│ └─ 产出：详细Story文档、验收标准                                   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4: 技术实现层（嵌套speckit）                                 │
│ ├─ specify → plan → GAPS → tasks → TDD执行                       │
│ ├─ 每层code-review审计（§1-§5）                                   │
│ ├─ 需求映射：PRD→Story→spec→task                                  │
│ └─ 产出：spec.md, plan.md, tasks.md, 可运行代码                    │
├─────────────────────────────────────────────────────────────────┤
│ Layer 5: 收尾层                                                   │
│ ├─ 批量Push + PR自动生成（pr-template-generator）                  │
│ ├─ 强制人工审核（绝对不能自动merge）                                │
│ └─ Epic集成测试、发布                                             │
└─────────────────────────────────────────────────────────────────┘
```

**设计原则**:
- bmad聚焦Epic/Story定义和产品视角
- speckit聚焦技术实现和执行细节
- 单向依赖：bmad引用speckit，反之不成立
- 每层都有明确的输入、输出和审计点

### 2.2 复杂度评估与Party-Mode触发

#### 2.2.1 三维复杂度评估问卷（Layer 1执行）

```yaml
业务复杂度 (1-5分):
  - 领域知识: [熟悉(1分)/部分新(3分)/全新(5分)]
  - 利益相关方数量: [≤2(1分)/3-5(3分)/>5(5分)]
  - 合规要求: [无(1分)/一般(3分)/严格(5分)]

技术复杂度 (1-5分):
  - 技术栈: [现有(1分)/部分新(3分)/全新(5分)]
  - 架构挑战: [无(1分)/中等(3分)/高并发大数据(5分)]
  - 集成难度: [独立(1分)/少量依赖(3分)/复杂网络(5分)]

影响范围 (1-5分):
  - [单个Story(1分)/单个模块(3分)/跨模块(4分)/全系统(5分)]
```

**总分计算**: 业务复杂度 + 技术复杂度 + 影响范围 = 总分（范围3-15分）

#### 2.2.2 Party-Mode触发规则

| 总分 | PRD处理 | Architecture处理 | Create Story处理 |
|------|---------|------------------|------------------|
| ≤6分 | 直接生成 | 直接生成 | 标准流程 |
| 7-10分 | 50轮Party-Mode | 可选30轮 | 标准流程 |
| 11-15分 | 80轮Party-Mode | 80轮Party-Mode | 可选Party-Mode |
| >15分 | 80轮+专家Review | 80轮+专家Review | 强制Party-Mode |

#### 2.2.3 PRD Party-Mode角色设定

```yaml
roles:
  - name: "产品经理"
    focus: ["用户价值", "市场定位", "竞品分析"]
    
  - name: "业务分析师"
    focus: ["需求完整性", "边界条件", "验收标准"]
    
  - name: "用户研究员"
    focus: ["用户画像", "使用场景", "痛点分析"]
    
  - name: "技术架构师"
    focus: ["技术可行性", "约束条件", "依赖关系"]
    
  - name: "合规专员"
    focus: ["法规要求", "安全合规", "数据隐私"]
    
  - name: "批判审计员"
    focus: ["逻辑漏洞", "假设验证", "风险识别"]
    style: "不接受模糊答案，要求具体数据支撑"
    power: ["暂停权", "记录权", "否决权"]
```

#### 2.2.4 Architecture Party-Mode角色设定

```yaml
roles:
  - name: "系统架构师"
    focus: ["整体架构", "模块划分", "接口设计"]
    
  - name: "性能工程师"
    focus: ["吞吐量", "延迟", "资源利用率"]
    
  - name: "安全架构师"
    focus: ["威胁建模", "安全控制", "数据保护"]
    
  - name: "运维工程师"
    focus: ["部署策略", "监控告警", "故障恢复"]
    
  - name: "成本分析师"
    focus: ["基础设施成本", "人力成本", "ROI分析"]
    
  - name: "批判审计员"
    focus: ["Tradeoff分析", "过度设计", "技术债务"]
    questions: 
      - "这个设计是否过度工程化？"
      - "是否有更简单的替代方案？"
      - "未来3年的扩展性如何？"
```

#### 2.2.5 Tradeoff分析框架（Architecture必需）

每个Architecture决策必须明确记录：

```markdown
## 决策记录 ADR-{XXX}

### 背景
[决策上下文]

### 考虑的选项
| 选项 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| A. xxx | ... | ... | ... |
| B. xxx | ... | ... | ... |

### 决策
选择：[选项X]

### 理由
1. [关键理由1]
2. [关键理由2]

### 后果
- 正面：[...]
- 负面：[...]
- 缓解措施：[...]

### 相关方确认
- [ ] 产品经理
- [ ] 技术负责人
- [ ] 运维负责人
```

### 2.3 Worktree策略（修订版）

#### 2.3.1 核心原则

```yaml
Story数 ≤ 2: Story级worktree（简化流程）
Story数 ≥ 3: Epic级worktree（完整流程）
```

#### 2.3.2 Epic级Worktree执行模型

```
{父目录}/{repo名}-feature-epic-4/    # Epic级worktree（只创建1次，与项目根平级）
├── .git/                                  # 指向原仓库
├── Story 4.1 (本地分支: story-4-1)       
│   ├── 开发 → commit → PR #123 → merge
├── Story 4.2 (本地分支: story-4-2)
│   ├── 开发 → commit → PR #124 → merge
└── Story 4.3 (本地分支: story-4-3)
    └── 开发 → commit → PR #125 → merge
```

**关键约束**:
- 每个Story仍独立PR，保证Code Review质量
- Story间切换需commit/stash未提交变更
- 按依赖顺序执行Story

#### 2.3.3 执行模式

**串行模式（默认）**：
```
Story 4.1 → merge到feature-epic-4
    ↓
Story 4.2（基于merge后的feature-epic-4）→ merge
    ↓
Story 4.3 → ...
```

**并行模式（可选）**：
```
Story 4.1 ─┐
           ├─→ 并行开发 → 逐个merge + 冲突解决审计
Story 4.2 ─┘
```

#### 2.3.4 模式切换命令

```bash
# 切换到并行模式
/bmad-set-worktree-mode epic=4 mode=parallel

# 切换到串行模式
/bmad-set-worktree-mode epic=4 mode=serial

# 回退到Story级
/bmad-set-worktree-mode epic=4 mode=story-level
```

#### 2.3.5 性能对比

| 指标 | Story级(10个Story) | Epic级(10个Story) | 改善 |
|-----|-------------------|------------------|-----|
| Worktree创建 | 10次 × 15分钟 = 150分钟 | 1次 × 15分钟 = 15分钟 | -90% |
| 上下文切换 | 10次 × 3分钟 = 30分钟 | 9次分支切换 × 1分钟 = 9分钟 | -70% |
| **总计** | **180分钟** | **24分钟** | **-87%** |

### 2.4 Party-Mode定位（增强版）

| 阶段 | Party-Mode | 轮次要求 | 触发条件 |
|-----|-----------|---------|---------|
| Layer 1 PRD | **强制**（按分数） | 跳过/50轮/80轮 | 复杂度评估结果 |
| Layer 1 Architecture | **强制**（按分数） | 跳过/30轮/80轮 | 复杂度评估结果 |
| Layer 3 Create Story | **强制** | 最少100轮 | 涉及方案选择或设计决策 |
| speckit.plan | 可选 | 建议50轮 | 用户明确要求或技术争议 |
| speckit其他阶段 | 不强制 | 无 | - |

**理由**:
- Layer 1解决产品需求和架构设计（需要充分论证）
- Create Story解决功能方案选择（需要充分论证）
- speckit阶段解决技术执行（需要高效执行）

### 2.5 TDD红绿灯统一

**职责分工**:
- **speckit-workflow**: 提供方法论（红灯→绿灯→重构）
- **bmad-story-assistant**: 提供记录格式
- **ralph-method**: 提供进度管理（prd/progress文件）

**统一记录格式**:
```markdown
## Task X: 实现YYY功能

**红灯阶段（2026-03-02 10:00）**
[TDD-RED] TX pytest tests/test_xxx.py -v => 1 failed

**绿灯阶段（2026-03-02 10:15）**
[TDD-GREEN] TX pytest tests/test_xxx.py -v => 1 passed

**重构阶段（2026-03-02 10:20）**
[TDD-REFACTOR] TX 优化命名，提取公共逻辑

**更新ralph-method**
- prd.md: US-00X passes=true
- progress.md: 添加TDD记录
```

### 2.6 审计机制统一（增强版）

#### 2.6.1 完整审计链

| 审计点 | 审计依据 | 审计方式 | 通过标准 |
|-------|---------|---------|---------|
| PRD | Product Brief | code-review (prd模式) | 完全覆盖 |
| Architecture | PRD | code-review (arch模式) | 完全覆盖 |
| Story文档(1st) | PRD/Architecture/Epic | audit-prompts.md | 无禁止词、范围清晰 |
| spec.md | Story文档 | code-review (§1) | A/B级 |
| plan.md | Story+spec | code-review (§2) | A/B级 |
| GAPS.md | 需求+实现 | code-review (§3) | A/B级 |
| tasks.md | 全部前置 | code-review (§4) | A/B级 |
| 执行后 | tasks+前置 | code-review (§5) | A/B级 |
| 实施后(2nd) | 全部产出 | audit-prompts §5 | 完全覆盖、验证通过 |

#### 2.6.2 Code-Review调用统一

**优先/回退策略**:
1. **优先**: Cursor Task调度code-reviewer（若`.claude/agents/code-reviewer.md`或`.cursor/agents/code-reviewer.md`存在）
2. **回退**: `mcp_task` + `subagent_type: generalPurpose`（当code-reviewer不可用时）

**说明**: mcp_task的subagent_type目前仅支持generalPurpose、explore、shell，不支持code-reviewer。

#### 2.6.3 批判审计员工作流程

```yaml
批判审计员工作流程:

1. 介入时机:
   - Layer 1 PRD Party-Mode（强制）
   - Layer 1 Architecture Party-Mode（强制）
   - Layer 3 Create Story party-mode（强制）
   - speckit.plan争议时（按需）

2. 每轮必做:
   - 提出至少1个深度质疑
   - 检查需求映射完整性
   - 验证假设合理性

3. 退出条件:
   - 所有质疑得到回应
   - 近3轮无新gap
   - 明确声明"认可"或"有条件认可"

4. 权力边界:
   - 暂停权: 发现致命缺陷时可暂停流程
   - 记录权: 所有质疑必须被记录并追踪
   - 复验权: 可要求对修改后的方案再次审计
   - 一票否决权: 可否决进入下一阶段（需说明理由）
```

### 2.7 需求映射表格统一（增强版）

**扩展映射表格式**:

| PRD需求ID | PRD需求描述 | Architecture组件 | Story | spec章节 | task | 状态 | 备注 |
|----------|------------|-----------------|-------|---------|------|------|------|
| REQ-001 | XXX | AuthService | Story 4.1 | §2.1 | Task 1 | 已覆盖 | - |
| REQ-002 | YYY | AuthService | Story 4.2 | §2.2 | Task 2 | 推迟 | 由Story 4.3负责 |

**特点**:
- 纵向追溯：需求→实现章节逐条对应（speckit风格）
- 横向归属：跨Story的功能分配清晰（bmad风格）
- 完整链路：PRD→Architecture→Story→spec→task

### 2.8 需求变更管理机制

新增机制:
1. **版本追踪**: PRD/Architecture文档版本化
2. **变更检测**: Create Story时检查版本差异
3. **影响评估**: 标记受影响的Story状态
4. **同步机制**: 更新Story文档、spec.md、tasks.md

---

## 3. 文档映射关系

### 3.1 文档对应矩阵

| bmad-story-assistant产出 | speckit-workflow产出 | 映射关系 | 阶段对应 |
|-------------------------|---------------------|---------|---------|
| Product Brief | - | 源头文档 | Layer 1起点 |
| PRD | - | 需求规格 | Layer 1产出 |
| Architecture | - | 技术架构 | Layer 1产出 |
| Epic/Story列表 | - | 功能拆分 | Layer 2产出 |
| Story文档 | spec.md | Story文档功能章节 ↔ spec.md功能规格章节 | Layer 3 → Layer 4 specify |
| TASKS文档 | plan.md + tasks.md | TASKS功能清单 ↔ tasks.md任务列表 | Layer 3 → Layer 4 tasks |
| BUGFIX文档 | IMPLEMENTATION_GAPS.md | BUGFIX修复项 ↔ GAPS差距项 | Layer 3 → Layer 4 GAPS |
| progress.md | TDD记录 | 执行进度 ↔ 测试记录 | Layer 4执行 → 记录 |

### 3.2 文档关系说明

**时序关系**:
```
Layer 1: Product Brief → PRD → Architecture
              ↓
Layer 2: create-epics-and-stories → Epic/Story列表
              ↓
Layer 3: Create Story (bmad) → 产出Story文档
              ↓
Layer 4: specify (speckit) → 产出spec.md（技术规格化Story内容）
              ↓
         plan (speckit) → 产出plan.md（实现方案）
              ↓
         Story文档审计（bmad，依据包含plan.md）
```

---

## 4. 实施指南

### 4.1 技能文件修改清单

#### 4.1.1 bmad-story-assistant SKILL.md（10处修改）

| 序号 | 章节/位置 | 类型 | 修改内容 |
|-----|----------|-----|---------|
| 1 | **头部信息区域** | 新增 | 快速决策指引章节：说明五层架构和何时使用各技能 |
| 2 | **阶段零** | 新增 | Layer 1产品定义层：Product Brief → 复杂度评估 → PRD → Architecture |
| 3 | **阶段一之前** | 新增 | Layer 2 Epic/Story规划层：create-epics-and-stories |
| 4 | **阶段二之后** | 新增 | 文档映射关系章节：详细说明与speckit文档的对应关系 |
| 5 | **阶段三：Dev Story实施** | 修改 | 明确嵌套speckit流程：列出specify→plan→GAPS→tasks→执行的完整步骤 |
| 6 | **阶段四：实施后审计** | 修改 | 增加前置检查：确认speckit各阶段code-review审计已通过 |
| 7 | **引用与路径章节** | 修改 | speckit引用增加说明：明确Dev Story需遵循speckit-workflow约束 |
| 8 | **文档末尾** | 新增 | 回退机制说明：若speckit阶段发现Story文档问题，允许回退到阶段一 |
| 9 | **主Agent传递规则后** | 新增 | 自检清单：发起审计前必须完成的检查项 |
| 10 | **角色配置章节** | 新增 | 批判审计员角色定义：职责、权力、介入时机、退出条件 |

**Prompt模板示例**（阶段三修改）：
```yaml
## 阶段三：Dev Story实施（增强版）

审计通过后，执行 **/bmad-bmm-dev-story** 等价工作流，对 Story `{epic_num}-{story_num}` 进行开发实施。

**前置检查**:
- [ ] PRD需求追溯章节已补充
- [ ] Architecture约束已传递到Story文档
- [ ] 复杂度评估已完成

**Dev Story实施需嵌套执行 speckit-workflow 完整流程**，按以下顺序：
1. specify → 生成 spec.md → code-review审计（迭代直至通过）
2. plan → 生成 plan.md → code-review审计（迭代直至通过，必要时可进入party-mode 50轮）
3. GAPS → 生成 IMPLEMENTATION_GAPS.md → code-review审计（迭代直至通过）
4. tasks → 生成 tasks.md → code-review审计（迭代直至通过）
5. 执行 → TDD红绿灯模式（红灯→绿灯→重构）→ code-review审计（迭代直至通过）

**Worktree策略**（修订版）：
- Story数 ≤ 2: Story级worktree `{父目录}/{repo名}-story-{epic_num}-{story_num}`
- Story数 ≥ 3: Epic级worktree `{父目录}/{repo名}-feature-epic-{epic_num}`
  - 在Epic worktree内创建 `story-{epic_num}-{story_num}` 分支
- 支持串行/并行模式切换

**需求追溯要求**:
- spec.md必须包含PRD需求ID映射
- tasks.md必须包含Architecture组件约束
```

#### 4.1.2 speckit-workflow SKILL.md（8处修改）

| 序号 | 位置 | 类型 | 修改内容 |
|-----|------|-----|---------|
| 1 | 第10行后 | 新增 | 快速决策指引章节：说明何时使用本技能vs bmad-story-assistant |
| 2 | 28-35行 | 修改 | code-review调用统一为优先/回退策略 |
| 3 | 75行后 | 新增 | plan阶段可选party-mode说明：用户明确要求时启动，建议50轮 |
| 4 | 135-165行后 | 新增 | TDD记录格式统一：与bmad格式保持一致 |
| 5 | 217-226行 | 修改 | 流程小结增加bmad对应列：说明各阶段与bmad流程的对应关系 |
| 6 | 230行后 | 新增 | 任务分批执行机制：超过20个任务时分批执行，每批检查点审计 |
| 7 | 230行后 | 新增 | 审计质量评级（A/B/C）说明：应对无强制party-mode的质量补偿 |
| 8 | 192行后 | 新增 | enforcement说明：明确各阶段禁止事项的检查责任人 |

#### 4.1.3 using-git-worktrees SKILL.md（5处修改）

| 序号 | 位置 | 类型 | 修改内容 |
|-----|------|-----|---------|
| 1 | 第14行后 | 新增 | Adaptive Worktree说明：支持Epic级和Story级自动选择 |
| 2 | 76行后 | 新增 | Epic级worktree创建逻辑：检测Epic特征，自动选择粒度 |
| 3 | 144行后 | 新增 | Story分支管理：在同一Epic worktree内创建/切换Story分支 |
| 4 | 新增章节 | 新增 | 串行/并行模式切换命令和逻辑 |
| 5 | 新增章节 | 新增 | 冲突检测和解决审计触发机制 |

#### 4.1.4 code-reviewer扩展（新增skill或修改现有）

| 模式 | 审计对象 | 专用提示词 |
|------|---------|-----------|
| code | 代码文件 | audit-prompts.md §1-§5 |
| prd | PRD文档 | 新增专用提示词（见附录） |
| arch | Architecture文档 | 新增专用提示词（见附录） |
| pr | Pull Request | 新增专用提示词（见附录） |

### 4.2 实施顺序

**阶段1：下层技能稳定（speckit-workflow）**
- 修改code-review调用方式
- 增加TDD记录格式统一
- 增加可选party-mode
- **预计**: 12小时（含调试和回归测试）

**阶段2：上层技能适配（bmad-story-assistant）**
- 增加Layer 1和Layer 2流程
- 增加文档映射章节
- 修改阶段三/四触发逻辑
- 增加Epic worktree检测
- 增加批判审计员角色
- **预计**: 20小时（含调试和回归测试）

**阶段3：worktree技能增强（using-git-worktrees）**
- 增加Epic级支持
- 增加自动检测逻辑
- 增加串行/并行模式切换
- **预计**: 10小时（含调试和回归测试）

**阶段4：code-reviewer扩展**
- 实现4种审计模式
- 编写专用提示词
- **预计**: 8小时（含调试）

**阶段5：PR自动化整合**
- 整合pr-template-generator
- 实现批量Push
- 实现强制人工审核界面
- **预计**: 6小时（含调试）

**阶段6：集成测试**
- 走通metrics-cache-fix示例
- 验证错误处理场景
- 验证回滚方案
- **预计**: 13小时（含问题修复）

**缓冲**: 14小时（应对意外问题）

**总计**: 83小时（约10工作日）

### 4.3 向后兼容策略

- 保留现有Story级worktree作为可选行为
- Epic级worktree通过配置启用：`worktree_granularity = "adaptive"`
- 用户可通过命令行参数覆盖自动选择
- 原有流程不受影响，新功能渐进式启用

### 4.4 回滚方案

如果Epic级worktree在实践中出现问题，按以下步骤回滚到Story级：

**场景1：Epic刚开始，第一个Story未完成**
```bash
# 1. 删除Epic worktree
git worktree remove {父目录}/{repo名}-feature-epic-4

# 2. 恢复Story级配置（全局配置统一放在 _bmad-output/config/）
echo '{"worktree_granularity": "story-level"}' > _bmad-output/config/settings.json

# 3. 重新执行当前Story（使用Story级worktree）
/bmad-bmm-dev-story epic=4 story=1
```

**场景2：Epic进行中，多个Story已完成**
```bash
# 1. 推送所有Story分支到远程
cd {父目录}/{repo名}-feature-epic-4
git checkout story-4-1 && git push origin story-4-1
git checkout story-4-2 && git push origin story-4-2
# ... 以此类推

# 2. 在main worktree中继续开发
cd ../../..
git fetch origin

# 3. 切换到Story级模式并继续下一个Story（全局配置统一放在 _bmad-output/config/）
echo '{"worktree_granularity": "story-level"}' > _bmad-output/config/settings.json
/bmad-bmm-dev-story epic=4 story=N

# 4. 可选：清理Epic worktree（确认所有分支已推送后）
git worktree remove {父目录}/{repo名}-feature-epic-4
```

**场景3：发现文件冲突频繁，决定提前切换**
```bash
# 系统检测到冲突阈值超过5次，提示用户
⚠️  检测到Epic 4中Story间文件冲突频繁（6次）
    建议切换为Story级worktree以提高隔离性。
    
    [1] 立即切换（推荐）
    [2] 继续Epic级（风险自负）
    [3] 暂停，人工评估

# 选择[1]后的自动处理流程...
```

---

## 5. 风险评估与缓解

### 5.1 风险登记表

| 风险 | 可能性 | 影响 | 缓解措施 | 责任人 |
|-----|-------|------|---------|--------|
| Epic级worktree文件冲突 | 中 | 高 | Story开始前自动检测文件重叠；强制commit切换；冲突解决审计 | Amelia开发 |
| Story依赖管理复杂 | 中 | 中 | bmad自动检测依赖，按顺序执行；显式依赖声明；依赖图可视化 | Mary分析师 |
| 大Epic的Code Review疲劳 | 低 | 中 | 强制Story级独立PR；CI全量回归测试；批量审核模式 | Quinn测试 |
| 技能修改引入regression | 中 | 高 | 完整端到端测试；分阶段发布；灰度试点 | Winston架构师 |
| 用户困惑新流程 | 低 | 低 | 头部增加决策指引；提供示例walkthrough；分层文档 | John产品经理 |
| code-reviewer不可用 | 中 | 高 | 准备纯prompt-based审计方案；建立code-reviewer技能本地副本；使用audit-prompts.md直接作为子任务prompt | Winston架构师 |
| Epic级策略实践失败 | 低 | 中 | 配置快速回滚到Story级；数据迁移方案；清理和恢复流程 | Amelia开发 |
| PRD/Architecture Party-Mode耗时过长 | 中 | 中 | 复杂度评估准确；允许分段进行；设置时间上限 | Bob Scrum Master |
| 人工审核成为瓶颈 | 中 | 高 | 批量审核模式；审核提醒通知；审核SLA约定 | John产品经理 |

### 5.2 关键假设

1. **团队规模**: Epic级worktree适合单人或小团队（2-3人），多人协作建议Story级
2. **测试覆盖**: 假设项目有充分的自动化测试，能捕获Story间的相互影响
3. **开发者纪律**: 假设开发者会及时commit，避免长时间持有未提交变更
4. **CI/CD支持**: 假设CI系统支持Story分支的快速验证
5. **决策者可用性**: 假设PR审核决策者能在合理时间内响应（建议SLA：24小时）

---

## 6. 实际使用示例

### 6.1 场景：metrics-cache-fix（Epic 4, Story 1）

**前置条件**:
- Epic编号：4
- Story编号：4.1
- Epic包含7个Story（触发Epic级worktree）

**执行流程**:

```bash
# 用户触发
$ /bmad-bmm-dev-story epic=4 story=1

# 系统响应
> 检测到Epic 4包含7个Story
> 策略：Epic级worktree（7个Story > 阈值3）
> 创建worktree: {父目录}/{repo名}-feature-epic-4
> 创建Story分支: story-4-1
> 开始执行...

# Layer 1: Product Brief → 复杂度评估 → PRD → Architecture
[复杂度评估]
业务复杂度: 8分 | 技术复杂度: 7分 | 影响范围: 6分
总分: 21分 (>15分，强制双80轮Party-Mode)

[PRD Party-Mode 80轮]
角色: 产品经理、业务分析师、用户研究员、技术架构师、合规专员、批判审计员
产出: _bmad-output/product-artifacts/prd-metrics-cache-fix.md

[Architecture Party-Mode 80轮]
角色: 系统架构师、性能工程师、安全架构师、运维工程师、成本分析师、批判审计员
产出: _bmad-output/product-artifacts/arch-metrics-cache-fix.md

# Layer 2: create-epics-and-stories
产出: Epic列表、Story列表（粗粒度）、依赖图

# Layer 3: Create Story（主工作区）
[party-mode辩论100轮]
产出: _bmad-output/implementation-artifacts/4-1-metrics-cache-fix.md

# Layer 3: Story文档审计（第一遍）
审计依据: PRD/Architecture/Epic文档
结论: 通过

# Layer 4: 触发Speckit嵌套流程（在Epic worktree的story-4-1分支上）
Step 1: specify → spec.md → code-review审计(A级)
Step 2: plan → plan.md → code-review审计(B级, minor修改后通过)
Step 3: GAPS → IMPLEMENTATION_GAPS.md → code-review审计(A级)
Step 4: tasks → tasks.md → code-review审计(A级)

# TDD红绿灯执行
Task 1: [TDD-RED] pytest tests/metrics/test_cache.py => 1 failed
       [TDD-GREEN] pytest tests/metrics/test_cache.py => 1 passed
       [TDD-REFACTOR] 优化命名
       更新prd.md: US-001 passes=true

# Layer 5: 实施后审计（第二遍）
前置检查: speckit各阶段审计已通过 ✓
综合审计: audit-prompts.md §5
结论: 通过

# Layer 5: 完成选项
Story 4.1已完成。如何继续？
[1] 开始Story 4.2（在同一Epic worktree）
[2] 创建PR并等待review
[3] 批量Push所有Story分支
[4] 保留分支稍后处理

# 用户选择[2]，创建PR
> 正在创建PR...
> 调用pr-template-generator分析commits...
> PR #123已创建: "Story 4.1: metrics cache fix"
> 
> 🔒 PR审核请求
> Epic: feature-epic-4
> PR: #123
> CI状态: ✅ 全部通过
> 覆盖率变化: +2.3%
> 
> [1] ✅ 批准并Merge
> [2] ❌ 拒绝，返回修改
> [3] 👀 查看详细diff

# 用户选择[1]，但系统阻止自动merge
> ⚠️  根据强制人工审核机制，不能自动merge
> 请等待人工审核者批准...
```

### 6.2 错误处理场景示例

#### 场景A：speckit.specify审计未通过
```bash
# 执行speckit.specify后审计
> spec.md审计结果：未通过（B级）
> 问题：缺少与REQ-003的需求映射
> 
> [1] 立即修改spec.md
> [2] 回退到Create Story重新澄清需求
> [3] 忽略并继续（不推荐）

# 选择[1]：在Epic worktree中修改spec.md
> 正在修改spec.md...
> 补充REQ-003需求映射
> 重新提交审计...
> 审计通过（A级），继续下一步
```

#### 场景B：发现Story文档与spec冲突
```bash
# 执行speckit.plan时发现技术方案与Story文档冲突
> ⚠️  plan.md中的技术方案与Story文档冲突
>     Story文档要求"支持Redis缓存"
>     plan.md建议"仅本地缓存"
>     
> [1] 修改plan.md遵循Story文档
> [2] 回退到Create Story修改范围
> [3] 发起party-mode重新讨论方案

# 选择[3]：进入快速party-mode（50轮）
> 启动party-mode：本地缓存 vs Redis缓存
> ...辩论中...
> 结论：采用混合方案（本地+Redis可选）
> 更新Story文档和plan.md
> 重新审计通过
```

#### 场景C：TDD红灯长时间不通过
```bash
# Task 3的TDD红灯持续失败
> [TDD-RED] T3 pytest tests/test_cache.py => 5 failed (第5次尝试)
> 
> ⚠️  红灯持续时间超过30分钟
> 可能原因：
>   - 测试用例设计不当
>   - 技术方案存在根本问题
>   - 需要重构现有代码
> 
> [1] 继续尝试（推荐咨询架构师）
> [2] 跳过此Task，标记为阻塞
> [3] 回退到plan阶段重新设计方案

# 选择[2]：标记阻塞并继续
> Task 3标记为BLOCKED
> 原因：缓存并发测试无法通过
> 备注：需要架构师评估锁策略
> 继续执行Task 4...
```

### 6.3 Story依赖管理详解

#### 依赖声明方式
在TASKS文档中显式声明依赖：
```markdown
## Task 1: 实现基础缓存类
- 无依赖
- 状态: ✅ 已完成

## Task 2: 实现缓存TTL机制
- 依赖: Task 1
- 状态: 🔄 进行中

## Task 3: 实现缓存统计指标
- 依赖: Task 1, Task 2
- 状态: ⏳ 等待中

## Task 4: 集成到主流程
- 依赖: Task 1, Task 2, Task 3
- 状态: ⏳ 等待中
```

#### 依赖检测与执行顺序
系统自动解析依赖图，按拓扑排序执行：
```python
# 依赖图解析
dependencies = {
    "Task 1": [],
    "Task 2": ["Task 1"],
    "Task 3": ["Task 1", "Task 2"],
    "Task 4": ["Task 1", "Task 2", "Task 3"]
}

# 拓扑排序结果
execution_order = ["Task 1", "Task 2", "Task 3", "Task 4"]

# 如果Task 2失败，阻塞Task 3和Task 4
blocked_tasks = get_blocked_tasks("Task 2")  # ["Task 3", "Task 4"]
```

#### 跨Story依赖处理
当Story之间存在依赖时（如Story 4.2依赖Story 4.1的代码）：
```bash
# Story 4.1完成后
> Story 4.1已完成，PR #123已merge到feature-epic-4分支
> 
> 检测到Story 4.2依赖Story 4.1：
>   - 依赖文件: src/cache/base.py
>   - Story 4.1修改了该文件
> 
> 自动操作：
>   1. 将feature-epic-4分支更新到最新（包含Story 4.1）
>   2. 基于更新后的分支创建story-4-2分支
>   3. Story 4.2可以访问Story 4.1的所有变更
>
> 开始执行Story 4.2...
```

### 6.4 验证要点

| 环节 | 验证项 | 状态 |
|-----|-------|------|
| Layer 1复杂度评估 | 评估问卷填写正确 | ✓ |
| Layer 1 PRD Party-Mode | 按分数正确触发 | ✓ |
| Layer 1 Architecture Party-Mode | Tradeoff分析完整 | ✓ |
| Layer 2 Epic/Story规划 | 依赖图生成正确 | ✓ |
| Layer 3 Create Story party-mode | 100轮辩论完成 | ✓ |
| Layer 3 Story文档审计 | 禁止词检查通过 | ✓ |
| Layer 4 speckit全流程 | specify→plan→GAPS→tasks→执行 | ✓ |
| Layer 4各阶段审计 | code-review A/B级通过 | ✓ |
| Layer 4 TDD红绿灯 | RED/GREEN/REFACTOR记录完整 | ✓ |
| Layer 5实施后审计 | 综合验证通过 | ✓ |
| Layer 5 PR自动化 | 模板生成正确 | ✓ |
| Layer 5强制人工审核 | 不能自动merge | ✓ |
| Epic级worktree | 只创建1次，Story分支切换正常 | ✓ |
| 串行/并行模式 | 切换命令可用 | ✓ |
| **错误处理** | **审计失败、冲突、阻塞场景覆盖** | **✓** |
| **依赖管理** | **跨Story依赖自动处理** | **✓** |

---

## 7. 附录

### 7.1 术语表

| 术语 | 定义 |
|-----|------|
| Epic | 大型功能集合，包含多个Story |
| Story | 用户故事，可独立交付的功能单元 |
| Worktree | Git工作树，隔离的开发环境 |
| Party-Mode | 多角色辩论模式，用于复杂决策 |
| TDD红绿灯 | 测试驱动开发的红灯→绿灯→重构循环 |
| Code-Review | 代码审查技能，执行审计闭环 |
| 批判审计员 | 独立的批判性思维专家，专注于发现方案漏洞 |
| PRD | Product Requirements Document，产品需求文档 |
| Architecture | 技术架构设计文档 |
| ADR | Architecture Decision Record，架构决策记录 |

### 7.2 参考文档

- bmad-story-assistant SKILL.md
- speckit-workflow SKILL.md
- using-git-worktrees SKILL.md
- finishing-a-development-branch SKILL.md
- pr-template-generator SKILL.md
- audit-prompts.md §1-§5
- ralph-method SKILL.md

### 7.3 变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| v1.0 | 2026-03-02 | 初始版本 | Party-Mode辩论 |
| v1.1 | 2026-03-02 | 响应第一轮审计 | Party-Mode辩论 |
| v1.2 | 2026-03-02 | 第二轮审计通过 | code-reviewer |
| v2.0 | 2026-03-02 | 整合三轮审计意见，形成完整最终版 | 100轮最终评审 |

### 7.4 PRD审计专用提示词（附录）

```markdown
# PRD审计提示词

## 审计维度
1. 需求完整性：是否覆盖所有用户场景？
2. 边界条件：异常情况是否考虑？
3. 验收标准：是否可测试、可验证？
4. 优先级：是否合理？
5. 依赖关系：外部依赖是否明确？

## 通过标准
- 完全覆盖：所有维度均满足
- 部分覆盖：关键维度满足，次要维度可后续补充
- 不通过：关键维度缺失

## 输出格式
```
审计结论: [通过/有条件通过/不通过]
评分: [A/B/C/D]
问题清单:
1. [问题描述] - [严重程度] - [建议修改]
2. ...
```
```

### 7.5 Architecture审计专用提示词（附录）

```markdown
# Architecture审计提示词

## 审计维度
1. 技术可行性：方案是否可实现？
2. 扩展性：未来3年是否可持续？
3. 安全性：威胁建模是否完整？
4. 性能：是否满足SLA要求？
5. 成本：ROI是否合理？
6. Tradeoff：决策记录是否完整？

## 通过标准
- 完全覆盖：所有维度均满足，Tradeoff记录完整
- 部分覆盖：关键维度满足，Tradeoff基本完整
- 不通过：关键维度缺失或Tradeoff未记录

## 输出格式
```
审计结论: [通过/有条件通过/不通过]
评分: [A/B/C/D]
问题清单:
1. [问题描述] - [严重程度] - [建议修改]
2. ...

Tradeoff审查:
- [x] 所有重大决策都有ADR记录
- [ ] 部分决策缺少ADR，需补充
```
```

### 7.6 PR审计专用提示词（附录）

```markdown
# PR审计提示词

## 审计维度
1. CI状态：所有检查是否通过？
2. 代码质量：是否符合项目规范？
3. 测试覆盖：新增代码是否有测试？
4. 影响范围：修改是否超出预期？
5. 文档更新：相关文档是否同步？

## 通过标准
- A级：所有维度优秀，可直接merge
- B级：基本满足，minor问题可后续修复
- C级：存在问题，需修改后重新审计
- D级：严重问题，拒绝merge

## 输出格式
```
审计结论: [A级/B级/C级/D级]

CI状态: [✅/❌] [详情]
代码质量: [✅/⚠️/❌] [详情]
测试覆盖: [+%] [详情]
影响文件: [N个] [列表]

建议操作:
- [ ] 批准merge
- [ ] 要求修改: [具体问题]
- [ ] 拒绝: [原因]
```
```

---

## 8. 审计历史

### 8.1 第一轮审计（50轮）

**审计结论**: 通过，需按总结执行修订

**主要关切点解决**:
1. PRD/Architecture环节缺失 → 增加Layer 1产品定义层
2. Epic级Worktree优化 → 简化为默认Epic级+串行/并行模式

### 8.2 第二轮审计（100轮v2.0）

**审计结论**: 通过，需按总结执行修订

**四个关切点解决**:
1. PRD/Architecture的Party-Mode深度生成 → 复杂度评估矩阵+分层触发机制
2. 代码Push/PR/模板自动化整合 → Phase 5选项[3]自动批量处理
3. PR Merge强制人工审核 → 绝对不能自动merge
4. 已有审计意见整合 → 完整五层架构+Epic级worktree默认策略

### 8.3 第三轮审计（100轮最终评审）

**审计结论**: ✅ **通过，方案定稿**

**整合成果**:
- 统一了三轮审计的所有意见
- 明确了五层架构作为主干框架
- 确定了83小时工作量估算
- 形成了完整的实施指南

---

## 9. 实施启动检查清单

在开始实施前，请确认以下事项：

- [ ] 已阅读并理解本文档全部内容
- [ ] 已准备code-reviewer技能本地副本（应对不可用情况）
- [ ] 已备份现有skill文件
- [ ] 已安排10个工作日用于实施
- [ ] 已确定试点Epic用于验证（建议选择包含3-5个Story的中等规模Epic）
- [ ] 团队已了解新的五层架构和Adaptive Worktree策略
- [ ] 已配置强制人工审核的通知渠道

**实施顺序**：
1. 阶段1：speckit-workflow修改 - 12小时
2. 阶段2：bmad-story-assistant修改 - 20小时
3. 阶段3：using-git-worktrees修改 - 10小时
4. 阶段4：code-reviewer扩展 - 8小时
5. 阶段5：PR自动化整合 - 6小时
6. 阶段6：集成测试 - 13小时

**祝实施顺利！**

---

*本文档由三轮Party-Mode深度批判审计生成（50轮 + 100轮v2.0 + 100轮最终评审）*
*版本: Final v2.0 (Complete) | 日期: 2026-03-02 | 状态: 已批准实施*
