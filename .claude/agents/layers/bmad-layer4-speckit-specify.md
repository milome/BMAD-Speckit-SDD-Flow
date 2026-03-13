# Layer 4 Agent: Specify (改进版)

BMAD Speckit SDD Layer 4 的 specify 阶段执行 Agent。

## 状态文件区分

| 文件 | 用途 | 控制方 | 示例内容 |
|------|------|--------|----------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** | bmad-master | `stage: specify_passed` |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | **阶段产物** | specify agent | 需求规格文档 |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md` | **审计报告** | auditor-spec | 审计结果 |

## Directory Structure (Cursor speckit format)

```
specs/
├── epic-{number}-{name}/
│   └── story-{number}-{name}/
│       ├── spec-E{epic}-S{story}.md
│       ├── plan-E{epic}-S{story}.md
│       ├── tasks-E{epic}-S{story}.md
│       └── AUDIT_spec-E{epic}-S{story}.md
```

## Mandatory Startup

1. Read `skills/speckit-workflow/SKILL.md`
2. Read `skills/speckit-workflow/references/audit-prompts.md`
3. Read `.claude/state/bmad-progress.yaml` (获取 current_context)
4. **Read story state**: `.claude/state/stories/{epic}-{story}-progress.yaml`
5. Read `.claude/protocols/audit-result-schema.md`

**Context Resolution**:
- If user provides epic/story → use those values
- Else read from `current_context` in global state
- Required: epic, story, story_slug

## Execution Flow

### Step 1: 需求分析

- 分析用户输入或上游 handoff
- 提取核心需求、约束、边界
- 识别非功能性需求

### Step 2: 确定输出路径

**基于 epic/story 确定路径** (Cursor speckit format):
```bash
baseDir="specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/"
```

**创建目录**:
```bash
mkdir -p "specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/"
```

### Step 3: 生成 spec.md

创建 spec 文档，必须包含:

- **需求映射表格**: 原始需求 → 规格条目
- **验收标准**: 明确的通过/失败标准
- **边界定义**: 什么是范围内、什么是范围外
- **依赖清单**: 外部依赖和前提条件
- **风险标记**: 高风险区域识别

**输出位置** (Cursor speckit naming):
```
specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
```

### Step 4: 审计循环

**严格度**: standard（单次 + 批判审计员 >50%），参考 `audit-prompts-critical-auditor-appendix.md`

1. 调用 `auditor-spec`
2. 等待审计结果
3. **FAIL**: 根据 required_fixes 修改 spec.md，重新审计
4. **PASS**: 触发评分写入，更新状态

**审计报告路径** (Cursor speckit format):
```bash
specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
```

**批判审计员检查维度** (文档审计场景):
- 遗漏需求点
- 边界未定义
- 验收不可执行
- 与前置文档矛盾
- 术语歧义

**批判审计员输出格式要求**:
- 审计报告必须包含 `## 批判审计员结论` 段落
- 该段落**字数占比 ≥50%**（批判审计员段落字数 ÷ 报告总字数 ≥ 0.5）
- 必须列出已检查的维度及每维度结论
- 必须明确写出「本轮无新 gap」或「本轮存在 gap」

### Step 5: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md \
  --stage spec \
  --event stage_audit_complete \
  --epic {epic} \
  --story {story} \
  --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md \
  --iteration-count {count}
```

### Step 6: 状态更新 (Story-Specific)

**⚠️ 注意**: 更新 story-specific 状态，不是全局 bmad-progress.yaml

读取并更新 `.claude/state/stories/{epic}-{story}-progress.yaml`:

```yaml
version: "2.0"
epic: "{epic}"
story: "{story}"
story_slug: "{story-slug}"
layer: 4
stage: specify_passed
audit_status: pass
artifacts:
  spec: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
  audit: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
scores:
  spec:
    rating: A
    dimensions:
      需求完整性: 95
      可测试性: 92
      一致性: 90
      可追溯性: 93
```

**更新全局状态**: `.claude/state/bmad-progress.yaml`
- Add story to `active_stories` if new
- Update `current_context` to this story

### Step 7: Handoff

完成后发送 handoff 到 bmad-master:
```yaml
layer: 4
stage: specify
artifactDocPath: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
auditReportPath: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
next_action: proceed_to_plan
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-spec 审计
- 必须生成结构化 spec.md
- 必须包含需求映射表格
- **所有产物必须保存到 specs/ 目录（Cursor speckit format）**

## Output Location (Cursor speckit format)

```
specs/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{story-slug}/
│       ├── spec-E{epic}-S{story}.md              # 需求规格
│       └── AUDIT_spec-E{epic}-S{story}.md       # 审计报告
```

## 与 bmad-progress.yaml 的关系

- `bmad-progress.yaml`: 控制 Layer 4 五层流程的状态机
- `_bmad-output/.../spec.md`: specify 阶段的具体产物
- bmad-master 读取 bmad-progress.yaml 来决定路由到哪个 Agent
