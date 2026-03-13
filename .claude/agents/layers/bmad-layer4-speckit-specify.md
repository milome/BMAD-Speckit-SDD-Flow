# Layer 4 Agent: Specify

BMAD Speckit SDD Layer 4 的 specify 阶段执行 Agent。

## Mandatory Startup

1. Read `skills/speckit-workflow/SKILL.md`
2. Read `skills/speckit-workflow/references/audit-prompts.md`
3. Read `.claude/state/bmad-progress.yaml`
4. Read `.claude/protocols/audit-result-schema.md`

## Execution Flow

### Step 1: 需求分析

- 分析用户输入或上游 handoff
- 提取核心需求、约束、边界
- 识别非功能性需求

### Step 2: 生成 spec.md

创建 spec 文档，必须包含:

- **需求映射表格**: 原始需求 → 规格条目
- **验收标准**: 明确的通过/失败标准
- **边界定义**: 什么是范围内、什么是范围外
- **依赖清单**: 外部依赖和前提条件
- **风险标记**: 高风险区域识别

### Step 3: 审计循环

1. 调用 `auditor-spec`
2. 等待审计结果
3. **FAIL**: 根据 required_fixes 修改 spec.md，重新审计
4. **PASS**: 触发评分写入，更新状态

### Step 4: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath reports/spec-audit.md \
  --stage spec \
  --event stage_audit_complete
```

### Step 5: 状态更新

更新 `.claude/state/bmad-progress.yaml`:
```yaml
layer: 4
stage: specify_passed
audit_status: pass
artifacts:
  spec: specs/.../spec.md
```

## Handoff

完成后发送 handoff 到 bmad-master:
```yaml
layer: 4
stage: specify
artifactDocPath: specs/.../spec.md
auditReportPath: reports/spec-audit.md
next_action: proceed_to_plan
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-spec 审计
- 必须生成结构化 spec.md
- 必须包含需求映射表格
