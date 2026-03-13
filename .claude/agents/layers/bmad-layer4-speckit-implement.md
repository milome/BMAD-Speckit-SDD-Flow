# Layer 4 Agent: Implement (改进版)

BMAD Speckit SDD Layer 4 的 implement 阶段执行 Agent。

## 重要区分

| 文件 | 用途 | 示例 |
|------|------|------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** (Layer 1-5) | `stage: tasks_passed` → `stage: implement_passed` |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md` | **tasks 阶段产物** | 任务清单 |
| `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json` | **ralph-method US 追踪** | US-001 passes: true/false |
| `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt` | **ralph-method TDD 记录** | `[TDD-RED] ... [TDD-GREEN] ... [TDD-REFACTOR] ...` |

## Directory Structure (Cursor speckit format)

```
specs/
├── epic-{number}-{name}/
│   └── story-{number}-{name}/
│       ├── tasks-E{epic}-S{story}.md
│       └── AUDIT_implement-E{epic}-S{story}.md

_bmad-output/implementation-artifacts/
├── epic-{number}-{name}/
│   └── story-{number}-{name}/
│       ├── prd.tasks-E{epic}-S{story}.json      # ralph-method US 追踪
│       └── progress.tasks-E{epic}-S{story}.txt  # ralph-method TDD 记录
```

## Prerequisites

- `tasks` 阶段已 PASS
- Story state: `stage: tasks_passed`
- **必须存在**:
  - `_bmad-output/.../prd.tasks-E{epic}-S{story}.json`
  - `_bmad-output/.../progress.tasks-E{epic}-S{story}.txt`

**⚠️ 禁止开始**: 若 prd/progress 不存在，**立即停止**，回退到 tasks 阶段创建。

## Mandatory Startup

1. Read `.claude/state/bmad-progress.yaml` (获取 current_context)
2. **Read story state**: `.claude/state/stories/{epic}-{story}-progress.yaml`
3. Read tasks.md (从 story state 读取路径)
4. Read `_bmad-output/.../prd.tasks-E{epic}-S{story}.json` (ralph-method US)
5. Read `_bmad-output/.../progress.tasks-E{epic}-S{story}.txt` (ralph-method TDD 记录)
6. Read `skills/speckit-workflow/references/audit-prompts.md` §5

## Execution Flow

### Step 1: Ralph-Method 前置验证

**必须验证以下文件存在**:

```bash
prdPath="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json"
progressPath="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt"
tasksPath="specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md"
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
  tasksPath: "specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md"
  prdPath: "_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json"
  progressPath: "_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt"
  mode: "bmad"
  epic: "{epic}"
  story: "{story}"
  epicSlug: "{epic-slug}"
  storySlug: "{story-slug}"
```

**Speckit-Implement 执行 TDD 红绿灯** (完整执行流程):

#### 2.1 逐 US 执行 TDD 循环

每个涉及生产代码的 US 必须**独立完整执行** RED→GREEN→REFACTOR，禁止跳过。

**RED 阶段**:
1. 更新 TodoWrite: 当前任务标记 `in_progress`
2. 阅读需求追溯: 读取 plan.md、IMPLEMENTATION_GAPS.md 相关章节
3. 编写/补充覆盖当前任务验收标准的测试用例（单元测试 + 集成测试）
4. 运行测试并确认**测试失败**（验证测试有效性）
5. 记录 progress:
   ```markdown
   [TDD-RED] US-00X YYYY-MM-DD HH:MM pytest tests/test_xxx.py -v => N failed
   [错误摘要: 具体错误信息]
   ```

**GREEN 阶段**:
1. 编写**最少量生产代码**使测试通过
2. 运行测试确认通过
3. 记录 progress:
   ```markdown
   [TDD-GREEN] US-00X YYYY-MM-DD HH:MM pytest tests/test_xxx.py -v => N passed
   [实现摘要: 添加了XXX类，实现了YYY方法]
   ```
4. 更新 tasks.md: `[ ]` → `[x]`

**REFACTOR 阶段** (禁止省略):
1. 在测试保护下优化:
   - SOLID 原则检查
   - 命名优化
   - 消除重复
   - 改善可读性
2. 每次重构后运行测试确保仍通过
3. 记录 progress:
   ```markdown
   # 有重构:
   [TDD-REFACTOR] US-00X YYYY-MM-DD HH:MM 提取XXX工具函数，优化方法命名
   [重构摘要: 具体优化点]

   # 无重构必要:
   [TDD-REFACTOR] US-00X YYYY-MM-DD HH:MM 无需重构 ✓
   ```

#### 2.2 实时更新 Ralph-Method 文件

每完成一个 US:
1. **更新 prd.json**: 将 US 的 `passes` 设为 `true`
2. **添加 TDD 记录**:
   ```json
   {
     "tddRecords": [
       {"phase": "RED", "timestamp": "...", "command": "pytest ...", "result": "3 failed"},
       {"phase": "GREEN", "timestamp": "...", "result": "3 passed"},
       {"phase": "REFACTOR", "timestamp": "...", "note": "提取工具函数"}
     ]
   }
   ```

#### 2.3 15 条铁律执行清单

**第一类：架构与需求忠实性**
- [ ] **铁律 1**: 严格按文档技术架构实施，禁止擅自修改
- [ ] **铁律 2**: 严格按文档需求范围实施，禁止以最小实现为由偏离需求

**第二类：禁止伪实现**
- [ ] **铁律 3**: 禁止标记完成但功能未实际调用
- [ ] **铁律 4**: 禁止仅初始化对象而不在关键路径中使用
- [ ] **铁律 5**: 禁止用「预留」「占位」等词规避实现
- [ ] **铁律 6**: 禁止假完成、伪实现

**第三类：测试与回归**
- [ ] **铁律 7**: 主动修复测试脚本，禁止以无关为由逃避
- [ ] **铁律 8**: 主动进行回归测试，禁止掩盖功能回退

**第四类：TDD 红绿灯**
- [ ] **铁律 9**: 禁止未完成 RED 直接 GREEN
- [ ] **铁律 10**: 禁止仅对首个 US 执行 TDD，后续跳过
- [ ] **铁律 11**: 禁止所有任务完成后集中补写 TDD 记录
- [ ] **铁律 12**: 禁止跳过重构阶段

**第五类：流程完整性**
- [ ] **铁律 13**: pytest 等长时间脚本使用轮询检查
- [ ] **铁律 14**: 参考设计时必须查看前置文档
- [ ] **铁律 15**: 所有任务真正实现前禁止停止

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

**严格度**: strict（连续 3 轮无 gap + 批判审计员 >50%），参考 `audit-prompts-critical-auditor-appendix.md`

**调用 auditor-implement**:

```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md \
  --stage implement \
  --event stage_audit_complete \
  --epic {epic} \
  --story {story} \
  --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md \
  --iteration-count {累计失败轮数}
```

**审计维度** (code 模式):
- 功能性: 是否实现需求
- 代码质量: 命名、复杂度
- 测试覆盖: 单元/集成测试
- 安全性: 输入验证

**批判审计员检查维度** (10项，必须全部检查):
1. 遗漏需求点
2. 边界未定义
3. 验收不可执行
4. 与前置文档矛盾
5. 孤岛模块（模块内部完整但未被生产代码关键路径导入调用）
6. 伪实现/占位
7. TDD 未执行（缺 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] 任一项）
8. 行号/路径漂移
9. 验收一致性
10. lint 未通过或未配置

**批判审计员输出格式要求**:
- 审计报告必须包含 `## 批判审计员结论` 段落
- 该段落**字数占比 ≥50%**（批判审计员段落字数 ÷ 报告总字数 ≥ 0.5）
- 必须列出已检查的10个维度及每维度结论
- 必须明确写出「本轮无新 gap」或「本轮存在 gap」

**严格模式收敛条件**:
- 必须**连续 3 轮**结论均为「完全覆盖、验证通过」
- 每轮批判审计员段落均注明「本轮无新 gap」
- 任一轮为「存在 gap」则从下一轮重新计数

### Step 6: 状态更新 (Story-Specific)

**更新 story state**: `.claude/state/stories/{epic}-{story}-progress.yaml`

```yaml
version: "2.0"
epic: "{epic}"
story: "{story}"
story_slug: "{story-slug}"
layer: 4
stage: implement_passed
audit_status: pass
artifacts:
  spec: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md
  plan: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md
  tasks: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md
  prd: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt
  # 源代码路径相对于项目根目录, 不在 _bmad-output/ 下
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

**更新全局状态** `.claude/state/bmad-progress.yaml`:
- Update story stage in `active_stories`

### Step 7: Handoff 到 Commit Gate

完成后发送 handoff 到 bmad-master:

```yaml
layer: 4
epic: "{epic}"
story: "{story}"
stage: implement
artifacts:
  tasks: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md
  prd: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt
  audit: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md
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
- **审计报告保存到 specs/ 目录, ralph文件保存到 _bmad-output/implementation-artifacts/**

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| prd/progress 不存在 | **停止**，回退到 tasks 阶段 |
| 测试无法失败（RED） | 检查测试有效性 |
| 测试无法通过（GREEN） | 记录阻塞，报告 bmad-master |
| Lint 失败 | 修复后才能继续 |
| 审计未通过 | 修复后重新审计 |
| TDD 记录缺失 | 标记该 US 未完成 |

## Output Location (Cursor speckit format)

**BMAD 产物** (文档、审计、追踪文件):
```
specs/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{slug}/
│       ├── tasks-E{epic}-S{story}.md
│       └── AUDIT_implement-E{epic}-S{story}.md

_bmad-output/implementation-artifacts/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{slug}/
│       ├── prd.tasks-E{epic}-S{story}.json      # ralph-method US 追踪
│       └── progress.tasks-E{epic}-S{story}.txt  # ralph-method TDD 记录
```

**项目源代码** (遵循项目自身目录结构, 非 BMAD 产物):
```
<project-root>/
├── src/                    # 生产代码 (由 speckit-implement 生成/修改)
├── tests/                  # 测试代码
├── package.json
└── ...                     # 其他项目文件
```

**⚠️ 重要**: _bmad-output/ 仅用于 BMAD 执行过程中产生的文档和追踪文件, 不保存项目源代码。源代码直接写入开发项目自身的目录结构中。

## Reference

- TDD 执行详情: `speckit-implement.md`
- 审计规则: `audit-prompts.md` §5
- 15 条铁律: `speckit-implement.md` 第 242-321 行
