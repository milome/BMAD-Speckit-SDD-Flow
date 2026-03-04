# scoring/parsers

## Story 2.1: 规则解析

- rules.ts: YAML 评分规则加载
- types.ts: PhaseScoringYaml、GapsScoringYaml 等类型

## Story 3.2: 审计报告解析（Layer 1–3 同机解析）

### 支持的报告路径

| 类型 | 路径或约定 |
|------|------------|
| prd | config/eval-lifecycle-report-paths.yaml 中 prd.report_path；由 code-reviewer prd 模式产出 |
| arch | config/eval-lifecycle-report-paths.yaml 中 arch.report_path；由 code-reviewer arch 模式产出 |
| story | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md` |

### 解析入口

```ts
import { parseAuditReport } from './scoring/parsers';

const record = await parseAuditReport({
  reportPath: 'path/to/AUDIT_Story_3-1.md',
  stage: 'story',
  runId: 'run-001',
  scenario: 'real_dev',
});
```

### 输出结构

符合 run-score-schema.json：run_id、scenario、stage、phase_score、phase_weight、check_items、timestamp、iteration_count、iteration_records、first_pass。

### item_id 映射（BUGFIX）

check_items 中的 item_id 优先从 `config/audit-item-mapping.yaml` 查找，与 code-reviewer-config 的 dimensions.checks 对齐：

- **映射规则**：问题描述（note）包含映射表中 text 或 patterns 任一关键词时，产出对应标准 item_id（如 `prd_traceability_req_id`、`arch_security_threat_model`）。
- **fallback**：无匹配时保留 `prd-issue-N`、`arch-issue-N`、`story-issue-N` 等序号格式，保证向后兼容。
- **空清单**：问题清单为空或「从维度评分提取」时，使用 `prd_overall`、`arch_overall`、`story_overall` 等（若映射表有定义）。
