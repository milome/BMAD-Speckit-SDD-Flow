# Layer 4 Agent 改进说明

## 问题列表及修复

### 1. ✅ ralph-method 的 prd/progress.txt 必须先于开发

**问题**: tasks 阶段没有明确创建 ralph-method 追踪文件，导致 implement 阶段可能缺少前置条件。

**修复**:
- `bmad-layer4-speckit-tasks-v2.md`: 在 Step 2 明确添加 "Ralph-Method 前置准备"
- 要求每个 `[ ]` 任务对应一个 US
- 自动生成 prd.json 和 progress.txt 模板
- 设置 `involvesProductionCode: true/false` 标记

### 2. ✅ 必须使用 TDD 红绿灯模式开发

**问题**: 之前的实现没有严格区分 "先写测试" 和 "先写代码"。

**修复**:
- `bmad-layer4-speckit-tasks-v2.md`: 明确每个任务必须有 RED → GREEN → REFACTOR
- `bmad-layer4-speckit-implement-v2.md`:
  - Step 1: 验证 prd/progress 存在，否则停止
  - Step 2: 委托给 speckit-implement.md 执行 TDD
  - Step 3: 从 progress.txt 提取 TDD 证据
  - 禁止先写代码再补测试
  - 禁止跳过重构

### 3. ✅ bmad-progress.yaml 是五层架构状态控制文件

**问题**: 容易混淆 bmad-progress.yaml 和 ralph-method 的 progress.txt。

**修复**: 所有改进版 Agent 都添加了 "状态文件区分" 表格：

| 文件 | 用途 | 示例 |
|------|------|------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** (Layer 1-5) | `stage: tasks_passed` |
| `_bmad-output/{story}/prd.{stem}.json` | **ralph-method US 追踪** | US-001 passes: true/false |
| `_bmad-output/{story}/progress.{stem}.txt` | **ralph-method TDD 记录** | `[TDD-RED]...` |

### 4. ✅ 产物输出到 _bmad-output/

**问题**: 之前的输出路径是 `reports/xxx-audit.md`，应该统一为 `_bmad-output/`。

**修复**: 所有改进版 Agent 输出路径改为：

```
_bmad-output/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{story-slug}/
│       ├── spec.md                              # specify 产物
│       ├── plan.md                              # plan 产物
│       ├── tasks.md                             # tasks 产物
│       ├── prd.tasks-E{epic}-S{story}.json      # ralph-method US (新增)
│       ├── progress.tasks-E{epic}-S{story}.txt  # ralph-method TDD (新增)
│       ├── AUDIT_spec-E{epic}-S{story}.md       # 审计报告
│       ├── AUDIT_plan-E{epic}-S{story}.md       # 审计报告
│       ├── AUDIT_tasks-E{epic}-S{story}.md      # 审计报告
│       ├── AUDIT_implement-E{epic}-S{story}.md  # 审计报告
│       └── src/                                  # 源代码
│           └── ...
```

## 改进文件列表

| 文件 | 说明 |
|------|------|
| `bmad-layer4-speckit-specify-v2.md` | 统一输出到 _bmad-output，明确状态区分 |
| `bmad-layer4-speckit-plan-v2.md` | 统一输出到 _bmad-output，明确状态区分 |
| `bmad-layer4-speckit-tasks-v2.md` | 新增 Ralph-Method 前置准备，生成 prd/progress |
| `bmad-layer4-speckit-implement-v2.md` | 验证 prd/progress，强制执行 TDD，统一输出路径 |

## 使用方式

改进版 Agent 与原版并行存在：
- 原版: `bmad-layer4-speckit-*.md` (向后兼容)
- 改进版: `bmad-layer4-speckit-*-v2.md` (推荐)

切换到改进版：
1. 更新 bmad-master 的路由配置，指向 `-v2` 版本
2. 确保 `_bmad-output/` 目录存在
3. 按照新的路径规则执行

## 关键改进点总结

1. **强制执行前置条件**: implement 阶段必须先有 prd/progress
2. **TDD 证据链**: 从 progress.txt 提取 RED/GREEN/REFACTOR 记录
3. **状态文件分离**: 明确区分五层架构状态和 ralph-method 追踪
4. **统一输出路径**: 所有产物集中到 `_bmad-output/`
5. **审计报告路径**: 与代码产物在同一目录，便于追踪
