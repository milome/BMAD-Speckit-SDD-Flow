# BUGFIX：审计报告解析器 item_id 与 scoring/rules、code-reviewer-config 未对齐

**日期**：2026-03-04  
**发现场景**：Story 3.2 实施后审计 §5 可优化项  
**文档路径**：`_bmad-output/implementation-artifacts/3-2-eval-layer1-3-parser/BUGFIX_eval-parser-item-id-mapping.md`  
**关联 Story**：3.2 eval-layer1-3-parser  
**严重程度**：低（非阻断，可优化项）

---

## §1 现象/问题描述

### 1.1 现象

spec-E3-S2.md §3.2 要求「**item_id 引用与 scoring/rules、code-reviewer-config 一致**」。当前实现中，解析器产出的 check_items 使用**解析生成的 ID**（如 `prd-issue-1`、`arch-tradeoff-1`、`story-overall`），问题清单为自由文本解析，未与 scoring/rules、code-reviewer-config 中预定义的维度/检查项 ID 建立映射。

### 1.2 复现/发现场景

1. 执行 Story 3.2 实施后审计（audit-prompts §5）
2. 审计报告「可优化项」指出：item_id 与 scoring/rules、code-reviewer-config 的严格映射尚未实现
3. 查阅 `scoring/parsers/audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`：check_items 的 item_id 由正则或序号生成（`prd-issue-N`、`arch-issue-N` 等）

### 1.3 预期行为

- item_id 应引用 config/code-reviewer-config.yaml 中 prd/arch/story 模式的 dimensions.checks
- item_id 应与 scoring/rules 中定义的 veto_items、check_items 可追溯
- 同一维度/检查项在多次审计中应产出一致的 item_id，便于聚合与追溯

### 1.4 当前行为

| 解析器 | 当前 item_id 格式 | 来源 |
|--------|-------------------|------|
| audit-prd.ts | `prd-issue-{N}` | 问题清单序号 |
| audit-arch.ts | `arch-tradeoff-{N}`、`arch-issue-{N}` | Tradeoff/问题清单序号 |
| audit-story.ts | `story-overall`、`story-issue-{N}` | 总体评级或问题序号 |

问题清单内容为自由文本，存入 `note`，无预定义 item_id 枚举。

### 1.5 路径读取说明（非问题）

解析器接受 `reportPath` 入参，调用方（如 Story 3.3）负责从 config/eval-lifecycle-report-paths.yaml 读取路径并传入。设计上职责清晰，**无需修改**。

---

## §2 根因分析

### 2.1 根因结论

**实现优先 vs. 规范对齐**：Story 3.2 实施时为缩短工期，采用「解析生成 ID」的快速实现；spec §3.2 的「与 scoring/rules、code-reviewer-config 一致」未在首轮实现中落地，留作可优化项。

### 2.2 根因链条

| 层级 | 问题 | 后果 |
|------|------|------|
| spec §3.2 | 要求 item_id 与 config 一致，但未给出具体映射表或实现指引 | 实施者采用自研 ID 格式 |
| code-reviewer-config | dimensions.checks 为自然语言描述（如「覆盖所有用户场景」），无稳定 item_id | 解析器难以将报告内容映射到预定义 ID |
| scoring/rules | 主要为 veto_items（如 veto_core_unmapped），与 prd/arch 维度结构不同 | 映射关系需另行设计 |
| 首轮实现 | 以「能解析、能写入」为目标，未建立映射逻辑 | 产出可用但不满足 spec 严格对齐 |

### 2.3 证据与引用

| 依据 | 路径 / 引用 |
|------|-------------|
| spec-E3-S2.md §3.2 | 「item_id 引用与 scoring/rules、code-reviewer-config 一致」 |
| config/code-reviewer-config.yaml | prd/arch/story 模式的 dimensions.checks 为自然语言，无 id 字段 |
| scoring/rules/gaps-scoring.yaml | veto_items 含 id（如 veto_core_unmapped），与 audit 报告结构差异大 |
| scoring/parsers/audit-prd.ts | extractCheckItemsFromPrd 产出 `prd-issue-{i}` |
| AUDIT_REPORT_Story3.2 实施产出 | 可优化项：「item_id 与 config 映射」 |

---

## §3 依据/参考

| 依据 | 说明 |
|------|------|
| spec-E3-S2.md §3.2 | item_id 与 scoring/rules、code-reviewer-config 一致 |
| Architecture §8.2 | check_items 含 item_id、passed、score_delta、note |
| config/code-reviewer-config.yaml | prd/arch/story 维度与 checks 定义 |
| scoring/rules/*.yaml | 评分规则与 veto_items |
| Story 3.2 实施后审计报告 | 可优化项识别与建议 |

---

## §4 修复方案

### 4.1 原则

- **增量映射**：在现有解析逻辑上增加「报告内容 → 标准 item_id」的映射层
- **向后兼容**：若无映射匹配，保留当前 `prd-issue-N` 等作为 fallback，不破坏现有产出
- **配置驱动**：映射表置于 config 或 scoring/rules，便于扩展

### 4.2 修改项

| 位置 | 修改内容 |
|------|----------|
| config/ 或 scoring/rules/ | 新增 audit-item-mapping.yaml（或扩展现有 rules）：定义 audit 报告维度/检查项 → 标准 item_id 的映射 |
| config/code-reviewer-config.yaml | 为 dimensions.checks 增补 id 字段（可选，便于映射） |
| scoring/parsers/audit-prd.ts | 解析时优先按映射表查找 item_id，无匹配时用 prd-issue-N |
| scoring/parsers/audit-arch.ts | 同上，arch 维度映射 |
| scoring/parsers/audit-story.ts | 同上，story 维度映射 |
| scoring/parsers/README.md | 文档化 item_id 映射规则与 fallback 行为 |

### 4.3 映射表设计示例

```yaml
# config/audit-item-mapping.yaml（示例）
version: "1.0"
prd:
  dimensions:
    - name: "需求完整性"
      checks:
        - text: "覆盖所有用户场景"
          item_id: "prd_req_completeness_scenarios"
        - text: "边界条件明确"
          item_id: "prd_req_completeness_boundary"
arch:
  dimensions:
    - name: "技术可行性"
      checks:
        - text: "技术选型合理"
          item_id: "arch_tech_feasibility_choice"
story:
  overall: "story_overall"
  checks:
    - text: "覆盖需求与 Epic"
      item_id: "story_coverage_req"
```

### 4.4 禁止词约束

- 映射逻辑须明确：匹配到则用标准 item_id，未匹配则 fallback；禁止「酌情」「视情况」等模糊表述
- 若某维度暂不建立映射，须在文档中写明「由 Story X.Y 负责」或「当前采用 fallback，映射待补充」

---

## §5 流程/建议流程（可选）

### 5.1 建议执行顺序

1. 盘点 code-reviewer-config 中 prd/arch/story 的 dimensions.checks，列出可稳定映射的检查项
2. 设计并编写 config/audit-item-mapping.yaml
3. 在 audit-prd/arch/story 解析器中集成映射查找逻辑
4. 单元测试：注入含已知维度的报告，断言产出 item_id 与映射表一致
5. 回归验收：`npm run accept:e3-s2` 仍通过

### 5.2 与 Story 3.3、4.1 的衔接

- Story 3.3 写入时依赖 check_items 结构，不依赖 item_id 具体值；本修复不改 schema，无影响
- Story 4.1 一票否决、阶梯扣分可能依赖 item_id 判定；对齐后便于后续接入

---

## §6 验收标准（AC）

| AC | 描述 | 验证方式 |
|----|------|----------|
| AC-1 | 存在 config/audit-item-mapping.yaml（或等效）映射表，覆盖 prd/arch/story 主要维度 | 文件存在，YAML 结构合法 |
| AC-2 | 解析器优先按映射表查找 item_id，匹配到则产出标准 ID | 单元测试：样本报告含已知维度，断言 item_id 符合映射 |
| AC-3 | 无匹配时保留 prd-issue-N 等 fallback，不破坏现有产出 | 单元测试 + accept:e3-s2 回归 |
| AC-4 | README 或文档说明 item_id 映射规则与 fallback 行为 | grep 文档含「item_id」「映射」「fallback」 |

---

## §7 最终任务列表

| 任务 ID | 描述 | 产出/验证 |
|---------|------|----------|
| T1 | 盘点 code-reviewer-config 中 prd/arch/story dimensions.checks，输出可映射清单 | 清单文档或注释 |
| T2 | 设计并编写 config/audit-item-mapping.yaml | 文件存在，结构符合 §4.3 |
| T3 | 修改 audit-prd.ts：集成映射查找，优先标准 item_id，fallback prd-issue-N | 代码 + 单元测试 |
| T4 | 修改 audit-arch.ts：同上 | 代码 + 单元测试 |
| T5 | 修改 audit-story.ts：同上 | 代码 + 单元测试 |
| T6 | 更新 scoring/parsers/README.md：文档化 item_id 映射 | 文档含映射说明 |
| T7 | 回归：npm run accept:e3-s2 通过 | 验收脚本 PASS |

---

*本 BUGFIX 为 Story 3.2 实施后审计可优化项的规范化记录，非阻断项。*
