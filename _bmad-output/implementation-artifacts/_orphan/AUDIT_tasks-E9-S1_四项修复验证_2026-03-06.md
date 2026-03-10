# 审计报告：tasks-E9-S1 四项修复验证

**审计对象**：`specs/epic-9/story-1-scoring-full-pipeline/tasks-E9-S1.md`  
**审计日期**：2026-03-06  
**审计类型**：批判审计（四项未通过项逐条验证）

---

## §1 审计范围与四项未通过项

| 项目 | 上一轮问题 | 本轮待验证 |
|------|------------|------------|
| 1 | T9/T10 缺生产路径验收 | 是否补充 grep getLatestRunRecordsV2 |
| 2 | T1–T3、T7 无集成/E2E | 是否补充最低可行 E2E（人工验收清单）|
| 3 | T10/T11 fixture 可执行性 | 是否约定 --dataPath 或 scoring/data 复制+清理 |
| 4 | §4 验收表未体现生产路径验证 | 是否补充生产路径验证列/行 |

---

## §2 批判审计员逐条分析（占比≥50%）

### 2.1 项目 1：T9/T10 生产路径验收

**检索结果**：文档中共 6 处涉及 `getLatestRunRecordsV2` 或 `aggregateByEpicStoryTimeWindow`。

**T10 验收（L107）**：
> ② **grep `getLatestRunRecordsV2` 或 `aggregateByEpicStoryTimeWindow` scripts/dashboard-generate.ts 有匹配**（生产路径验证）

**批判审计员意见**：  
- ✅ **通过**。T10 已显式将 grep 生产路径纳入验收，且与 T9 的聚合函数形成闭环（T9 实现、T10 调用）。  
- §3 集成测试表（L131）有「§4.4 | 生产路径 | grep dashboard-generate 调用 getLatestRunRecordsV2」；§4 验收表 GAP-4.1～4.2、GAP-4.3～4.4 均含生产路径验证要点。  
- **风险**：grep 仅验证符号存在，不验证调用链与参数正确性；可在实施阶段通过单测/集成测补充。

---

### 2.2 项目 2：T1–T3、T7 集成/E2E

**检索结果**：
- **T1（L40）**：含「**最低可行 E2E**：人工验收清单——模拟 Dev Story 阶段四通过后，确认 parse-and-write-score 被触发（**可选**）」
- **T7（L85）**：含「**最低可行 E2E**：人工验收清单——模拟阶段四通过后，确认 check-story-score-written 被执行（**可选**）」
- **T2（L42–46）**：仅有 grep 验收，无 E2E 或人工验收清单
- **T3（L47–52）**：仅有「SKILL 文档明确上述逻辑及边界条件」，无 E2E 或人工验收清单

**批判审计员意见**：  
- ❌ **部分通过**。T1、T7 已补充最低可行 E2E；**T2、T3 仍无集成/E2E 或人工验收清单**。  
- 原始问题为「T1–T3、T7 无集成/E2E」，明确覆盖 T2、T3。T2 为路径约定、T3 为 reportPath 解析与 SCORE_WRITE_SKIP；二者均涉及运行时行为，仅靠 grep/doc 不足以验证实际执行路径。  
- **建议补充**：  
  - T2：最低可行 E2E（可选）——人工验收：执行一次 stage4 审计，确认报告保存至约定路径。  
  - T3：最低可行 E2E（可选）——人工验收：当 reportPath 不存在时，确认 SCORE_WRITE_SKIP 被记录且不阻断。  
- **关于「可选」**：T1/T7 的 E2E 标记为「可选」会削弱可验证性；若需严格闭环，建议将至少一项列为必验或明确「可选」的适用条件。

---

### 2.3 项目 3：T10/T11 fixture 可执行性

**检索结果（L109–112）**：
> - **内容**：二选一实现：① dashboard-generate 新增 `--dataPath`，集成测试指定 fixture 路径；② fixture 置于 `scoring/data/__fixtures-dashboard-epic-story/`，测试前复制、**测试后清理**
> - **验收**：对已知 fixture 断言总分、四维与预期一致（±1）；fixture 可执行（**--dataPath 可用或 scoring/data 复制+清理流程明确**）

**批判审计员意见**：  
- ✅ **通过**。已约定二选一：--dataPath 或 scoring/data 复制+清理，且验收条件明确「--dataPath 可用或 scoring/data 复制+清理流程明确」。  
- **遗留风险**：「复制+清理流程」未指定文档位置（如 README、CI 脚本或测试说明），实施时可能产生歧义；建议在 T11 或 T8 文档中明确「复制+清理」的步骤与责任方。

---

### 2.4 项目 4：§4 验收表生产路径验证

**检索结果（L144–150）**：

| Gap ID | 集成测试要求 / 生产代码实现要点 |
|--------|----------------------------------|
| GAP-4.1～4.2 | 单测；**生产路径**：dashboard-generate 调用 getLatestRunRecordsV2 |
| GAP-4.3～4.4 | 集成+fixture 断言；**grep getLatestRunRecordsV2 scripts/dashboard-generate.ts** |

**批判审计员意见**：  
- ✅ **通过**。§4 验收表已在 GAP-4.1～4.2、GAP-4.3～4.4 行中显式体现生产路径验证（dashboard-generate 调用 getLatestRunRecordsV2、grep 命令）。  
- 与 §3 集成测试表、T10 验收形成一致追溯。

---

## §3 结论

| 项目 | 状态 | 说明 |
|------|------|------|
| 1. T9/T10 生产路径验收 | ✅ 通过 | grep getLatestRunRecordsV2 已补充于 T10、§3、§4 |
| 2. T1–T3、T7 集成/E2E | ⚠️ 部分通过 | T1、T7 已补充；**T2、T3 仍缺最低可行 E2E** |
| 3. T10/T11 fixture 可执行性 | ✅ 通过 | --dataPath 或 scoring/data 复制+清理已约定 |
| 4. §4 验收表生产路径 | ✅ 通过 | GAP-4.1～4.2、GAP-4.3～4.4 已体现生产路径验证 |

**总体结论**：**未完全覆盖**。四项中有三项已修复，**项目 2（T2、T3 无最低可行 E2E）未完全修复**。建议在 tasks-E9-S1.md 中为 T2、T3 补充最低可行 E2E（人工验收清单），再行复验。

---

## §4 可解析评分块

```yaml
# AUDIT_SCORING_BLOCK - tasks-E9-S1 四项修复验证 2026-03-06
audit:
  target: specs/epic-9/story-1-scoring-full-pipeline/tasks-E9-S1.md
  date: "2026-03-06"
  type: critical-review-four-items

items:
  - id: item_1
    name: T9/T10 生产路径验收
    status: pass
    evidence: "T10 L107 grep; §3 L131; §4 L148-149"
  - id: item_2
    name: T1-T3/T7 集成E2E
    status: partial
    evidence: "T1/T7 有最低可行 E2E; T2/T3 无"
    gap: "T2、T3 缺最低可行 E2E（人工验收清单）"
  - id: item_3
    name: T10/T11 fixture 可执行性
    status: pass
    evidence: "T11 L111-112 二选一与验收条件"
  - id: item_4
    name: §4 验收表生产路径
    status: pass
    evidence: "GAP-4.1～4.2、GAP-4.3～4.4 行"

summary:
  overall: "未完全覆盖"
  pass_count: 3
  partial_count: 1
  fail_count: 0
  required_action: "为 T2、T3 补充最低可行 E2E 后复验"
```
