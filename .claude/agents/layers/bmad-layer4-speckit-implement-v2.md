# Layer 4 Agent: Implement (改进版)

BMAD Speckit SDD Layer 4 的 implement 阶段执行 Agent。

## 重要区分

| 文件 | 用途 | 示例 |
|------|------|------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** (Layer 1-5) | `stage: tasks_passed` → `stage: implement_passed` |
| `_bmad-output/{story}/prd.{stem}.json` | **ralph-method US 追踪** | US-001 passes: true/false |
| `_bmad-output/{story}/progress.{stem}.txt` | **ralph-method TDD 记录** | `[TDD-RED] ... [TDD-GREEN] ... [TDD-REFACTOR] ...` |

## Prerequisites

- `tasks` 阶段已 PASS
- `.claude/state/bmad-progress.yaml` 中 `stage: tasks_passed`
- **必须存在**:
  - `_bmad-output/.../prd.tasks-E{epic}-S{story}.json`
  - `_bmad-output/.../progress.tasks-E{epic}-S{story}.txt`

**⚠️ 禁止开始**: 若 prd/progress 不存在，**立即停止**，回退到 tasks 阶段创建。

## Mandatory Startup

1. Read `.claude/state/bmad-progress.yaml` (bmad-master 状态)
2. Read tasks.md
3. Read `_bmad-output/.../prd.tasks-E{epic}-S{story}.json` (ralph-method US)
4. Read `_bmad-output/.../progress.tasks-E{epic}-S{story}.txt` (ralph-method TDD 记录)
5. Read `skills/speckit-workflow/references/audit-prompts.md` §5

## Execution Flow

### Step 1: Ralph-Method 前置验证

**必须验证以下文件存在**:

```bash
prdPath="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json"
progressPath="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt"
```

**若不存在**:
- **停止执行**
- 发送 handoff 到 bmad-master: `rollback_to_tasks`
- 原因: "ralph-method 追踪文件未创建"

### Step 2: 加载 Speckit-Implement Agent

**委托执行**: 调用 `speckit-implement.md` Agent

```yaml
delegate_to: speckit-implement
inputs:
  tasksPath: "_bmad-output/.../tasks.md"
  prdPath: "_bmad-output/.../prd.tasks-E{epic}-S{story}.json"
  progressPath: "_bmad-output/.../progress.tasks-E{epic}-S{story}.txt"
  mode: "bmad"
  epic: "{epic}"
  story: "{story}"
  epicSlug: "{epic-slug}"
  storySlug: "{story-slug}"
```

**Speckit-Implement 执行 TDD 红绿灯**:
- 逐 US 执行 RED → GREEN → REFACTOR
- 实时更新 prd.json (passes: true)
- 实时更新 progress.txt ([TDD-XXX] 记录)
- 严格执行 15 条铁律

### Step 3: TDD 执行证据检查

**从 progress.txt 提取**:

| US ID | [TDD-RED] | [TDD-GREEN] | [TDD-REFACTOR] | passes |
|-------|-----------|-------------|----------------|--------|
| US-001 | ✅ | ✅ | ✅ | true |
| US-002 | ✅ | ✅ | ✅ | true |
| ... | ... | ... | ... | ... |

**验证规则**:
- 每个涉及生产代码的 US 必须有 RED/GREEN/REFACTOR 三行
- prd.json 中 passes 必须为 true
- 禁止先写代码再补测试
- 禁止跳过重构

### Step 4: 代码质量检查

**Lint 执行** (强制):
```bash
pnpm lint
pnpm type-check
```

**必须无错误**。

### Step 5: 最终审计 §5.2

**调用 auditor-implement**:

```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md \
  --stage implement \
  --event stage_audit_complete \
  --epic {epic} \
  --story {story} \
  --artifactDocPath _bmad-output/.../tasks.md \
  --iteration-count {累计失败轮数}
```

**审计维度** (code 模式):
- 功能性: 是否实现需求
- 代码质量: 命名、复杂度
- 测试覆盖: 单元/集成测试
- 安全性: 输入验证

### Step 6: 状态更新

**更新 bmad-progress.yaml** (五层架构状态):
```yaml
layer: 4
stage: implement_passed
audit_status: pass
artifacts:
  spec: _bmad-output/.../spec.md
  plan: _bmad-output/.../plan.md
  tasks: _bmad-output/.../tasks.md
  prd: _bmad-output/.../prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/.../progress.tasks-E{epic}-S{story}.txt
  code:
    - src/...
    - tests/...
scores:
  implement:
    rating: A
    dimensions:
      功能性: 95
      代码质量: 92
      测试覆盖: 100
      安全性: 90
git_control:
  commit_allowed: true  # ← 允许提交
```

### Step 7: Handoff 到 Commit Gate

完成后发送 handoff 到 bmad-master:

```yaml
layer: 4
stage: implement
artifacts:
  tasks: _bmad-output/.../tasks.md
  prd: _bmad-output/.../prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/.../progress.tasks-E{epic}-S{story}.txt
  audit: _bmad-output/.../AUDIT_implement-E{epic}-S{story}.md
tddSummary:
  totalUS: N
  passedUS: N
  failedUS: 0
next_action: commit_gate
```

## Constraints

- **禁止自行 commit**
- **必须先有 prd/progress 才能开始编码**
- **必须严格执行 TDD 红绿灯** (RED → GREEN → REFACTOR)
- **禁止先写代码再补测试**
- **禁止跳过重构阶段**
- **必须通过 auditor-implement 审计**
- **审计报告必须保存到 _bmad-output/**

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| prd/progress 不存在 | **停止**，回退到 tasks 阶段 |
| 测试无法失败（RED） | 检查测试有效性 |
| 测试无法通过（GREEN） | 记录阻塞，报告 bmad-master |
| Lint 失败 | 修复后才能继续 |
| 审计未通过 | 修复后重新审计 |
| TDD 记录缺失 | 标记该 US 未完成 |

## Output Location

所有产物必须放在 `_bmad-output/` 下:

```
_bmad-output/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{slug}/
│       ├── tasks.md
│       ├── prd.tasks-E{epic}-S{story}.json      # ralph-method US
│       ├── progress.tasks-E{epic}-S{story}.txt  # ralph-method TDD
│       ├── AUDIT_implement-E{epic}-S{story}.md  # 审计报告
│       └── src/                                  # 源代码
│           └── ...
```

## Reference

- TDD 执行详情: `speckit-implement.md`
- 审计规则: `audit-prompts.md` §5
- 15 条铁律: `speckit-implement.md` 第 242-321 行
