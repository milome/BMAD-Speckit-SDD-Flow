# Layer 4 Agent: Specify (改进版)

BMAD Speckit SDD Layer 4 的 specify 阶段执行 Agent。

## 状态文件区分

| 文件 | 用途 | 控制方 | 示例内容 |
|------|------|--------|----------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** | bmad-master | `stage: specify_passed` |
| `_bmad-output/{story}/spec.md` | **阶段产物** | specify agent | 需求规格文档 |
| `_bmad-output/{story}/AUDIT_spec-*.md` | **审计报告** | auditor-spec | 审计结果 |

## Mandatory Startup

1. Read `skills/speckit-workflow/SKILL.md`
2. Read `skills/speckit-workflow/references/audit-prompts.md`
3. Read `.claude/state/bmad-progress.yaml` (检查当前 stage)
4. Read `.claude/protocols/audit-result-schema.md`

## Execution Flow

### Step 1: 需求分析

- 分析用户输入或上游 handoff
- 提取核心需求、约束、边界
- 识别非功能性需求

### Step 2: 确定输出路径

**基于 epic/story 确定路径**:
```bash
baseDir="_bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/"
```

**创建目录**:
```bash
mkdir -p "_bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/"
```

### Step 3: 生成 spec.md

创建 spec 文档，必须包含:

- **需求映射表格**: 原始需求 → 规格条目
- **验收标准**: 明确的通过/失败标准
- **边界定义**: 什么是范围内、什么是范围外
- **依赖清单**: 外部依赖和前提条件
- **风险标记**: 高风险区域识别

**输出位置**:
```
_bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec.md
```

### Step 4: 审计循环

1. 调用 `auditor-spec`
2. 等待审计结果
3. **FAIL**: 根据 required_fixes 修改 spec.md，重新审计
4. **PASS**: 触发评分写入，更新状态

**审计报告路径**:
```bash
_bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
```

### Step 5: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md \
  --stage spec \
  --event stage_audit_complete \
  --epic {epic} \
  --story {story} \
  --artifactDocPath _bmad-output/.../spec.md \
  --iteration-count {count}
```

### Step 6: 状态更新 (bmad-progress.yaml)

**⚠️ 注意**: 这是五层架构状态，不是 ralph-method。

更新 `.claude/state/bmad-progress.yaml`:
```yaml
layer: 4
stage: specify_passed
audit_status: pass
epic: "{epic}"
story: "{story}"
artifacts:
  spec: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec.md
  audit: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
scores:
  spec:
    rating: A
    dimensions:
      需求完整性: 95
      可测试性: 92
      一致性: 90
      可追溯性: 93
```

### Step 7: Handoff

完成后发送 handoff 到 bmad-master:
```yaml
layer: 4
stage: specify
artifactDocPath: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec.md
auditReportPath: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
next_action: proceed_to_plan
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-spec 审计
- 必须生成结构化 spec.md
- 必须包含需求映射表格
- **所有产物必须保存到 _bmad-output/**

## Output Location

```
_bmad-output/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{story-slug}/
│       ├── spec.md                              # 需求规格
│       └── AUDIT_spec-E{epic}-S{story}.md       # 审计报告
```

## 与 bmad-progress.yaml 的关系

- `bmad-progress.yaml`: 控制 Layer 4 五层流程的状态机
- `_bmad-output/.../spec.md`: specify 阶段的具体产物
- bmad-master 读取 bmad-progress.yaml 来决定路由到哪个 Agent
