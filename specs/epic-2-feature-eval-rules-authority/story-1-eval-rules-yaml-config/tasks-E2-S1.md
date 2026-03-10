# tasks-E2-S1：eval-rules-yaml-config 任务列表

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.1  
**来源**：plan-E2-S1.md、IMPLEMENTATION_GAPS-E2-S1.md、Story 2.1 §6

---

## Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止仅初始化对象而不在关键路径中使用
4. ❌ 禁止用「预留」「占位」等词规避实现

**必须事项**:
1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验证命令确认功能启用
3. ✅ 遇到无法完成的情况，应报告阻塞而非自行延迟
4. ✅ 功能/规则相关任务实施前必须先检索并阅读需求文档相关章节
5. ✅ 需求追溯（实施前必填）：问题关键词、检索范围、相关章节、既有约定摘要、方案是否与需求一致

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Architecture | §9.1 | scoring/rules/default/ 含 implement、test、bugfix |
| T2 | Architecture, REQUIREMENTS | §9.2, §3.11 | 环节 2/3/4 的 YAML schema（version、weights、items、veto_items） |
| T3 | Architecture | §9.1 | gaps-scoring.yaml、iteration-tier.yaml 置于 rules 根目录 |
| T4 | Architecture | §2, §9.2 | ref 解析，code-reviewer-config 扩展 |
| T5 | plan | §3 | YAML 解析器、resolveRef |
| T6 | Story 2.1 | §6 | 单元测试、验收脚本 AC-1～AC-7 |

---

## Gaps → 任务映射

| Gap ID | 本任务表行 | 对应任务 |
|--------|------------|----------|
| G1 | ✓ 有 | T1 |
| G2, G3 | ✓ 有 | T2 |
| G4, G5 | ✓ 有 | T3 |
| G6, G7, G8 | ✓ 有 | T4, T5 |
| G9 | ✓ 有 | T5 |
| G10, G11 | ✓ 有 | T6 |

---

## 任务列表

### T1：创建 scoring/rules/default/ 目录与环节 2/3/4 YAML 骨架

**产出物**：scoring/rules/default/implement-scoring.yaml、test-scoring.yaml、bugfix-scoring.yaml

**验收标准**：
- AC-7：文件存在，分别对应环节 2、3、4
- 每个文件含 version、stage、link_stage、link_环节、weights（base、bonus）、items、veto_items
- items 每项含 id、ref（格式 code-reviewer-config#item_id）、deduct
- veto_items 每项含 id、ref（格式 code-reviewer-config#veto_*）、consequence

**验证命令**：
```bash
test -f scoring/rules/default/implement-scoring.yaml && test -f scoring/rules/default/test-scoring.yaml && test -f scoring/rules/default/bugfix-scoring.yaml && echo "OK"
```

---

- [x] **T1.1** 创建 scoring/rules/default/ 目录
- [x] **T1.2** 实现 implement-scoring.yaml（环节 2），含 weights、items、veto_items 及 ref 字段，ref 指向 config 中存在的 item_id
- [x] **T1.3** 实现 test-scoring.yaml（环节 3）
- [x] **T1.4** 实现 bugfix-scoring.yaml（环节 4）

---

### T2：实现 gaps-scoring.yaml 与 iteration-tier.yaml

**产出物**：scoring/rules/gaps-scoring.yaml、scoring/rules/iteration-tier.yaml

**验收标准**：
- AC-4：gaps-scoring.yaml 可解析，产出前置 40%、后置 implement/post_impl 权重
- AC-5：iteration-tier.yaml 可解析，产出 iteration_tier（1→1.0、2→0.8、3→0.5、4→0）、severity_override

**验证命令**：
```bash
test -f scoring/rules/gaps-scoring.yaml && test -f scoring/rules/iteration-tier.yaml && echo "OK"
```

---

- [x] **T2.1** 实现 scoring/rules/gaps-scoring.yaml，含 spec_coverage 40%、后置 implement/post_impl 权重结构
- [x] **T2.2** 实现 scoring/rules/iteration-tier.yaml，含 iteration_tier（1:1.0、2:0.8、3:0.5、4:0）、severity_override（fatal:3、serious:2）

---

### T3：扩展 code-reviewer-config 的 items、veto_items

**产出物**：config/code-reviewer-config.yaml 更新

**验收标准**：
- AC-6：ref 指向的 item_id 在 config 中存在
- rules 中所有 ref 对应的 item_id 或 veto_* 均在 config 中定义

**验证命令**：解析器加载 rules 并解析 ref，不抛 RefResolutionError

---

- [x] **T3.1** 在 config/code-reviewer-config.yaml 中添加 items 节（或 check_items），定义 implement/test/bugfix 环节所需 item_id
- [x] **T3.2** 添加 veto_items 节，定义 rules 中 ref 指向的 veto_* 检查项

---

### T4：实现 YAML 解析器与 ref 解析

**产出物**：scoring/parsers/rules.ts（或 scoring/rules/parser.ts）、scoring/parsers/types.ts

**验收标准**：
- AC-1：合法 YAML 解析成功；违反 schema 的 YAML 解析报错
- AC-2、AC-3：items、veto_items 结构校验
- AC-6：ref 解析；item_id 不存在时抛出明确错误（RefResolutionError）

**验证命令**：
```bash
npm test -- --run scoring/__tests__/rules
```

---

- [x] **T4.1** 定义 PhaseScoringYaml、GapsScoringYaml、IterationTierYaml 类型
- [x] **T4.2** 实现 loadPhaseScoringYaml(phase: 2|3|4)、loadGapsScoringYaml、loadIterationTierYaml
- [x] **T4.3** 实现 resolveRef(ref, configPath)：加载 code-reviewer-config，按 item_id 查找；不存在则抛 RefResolutionError
- [x] **T4.4** 解析环节 2/3/4 YAML 时对 items、veto_items 的 ref 调用 resolveRef 校验
- [x] **T4.5** 产出结构化配置供 calculator 或 Story 3.x 使用（导岀类型与函数）

---

### T5：编写单元测试与验收脚本

**产出物**：scoring/__tests__/rules/*.test.ts、scripts/accept-e2-s1.ts

**验收标准**：
- 单元测试覆盖 AC-1～AC-6（解析、schema 校验、ref 解析、非法 YAML 报错）
- 验收脚本覆盖 AC-1～AC-7，运行全部通过

**验证命令**：
```bash
npm test -- --run scoring/__tests__/rules
npx ts-node scripts/accept-e2-s1.ts
```

---

- [x] **T5.1** 编写 scoring/__tests__/rules/parser.test.ts：解析环节 2/3/4、gaps、iteration-tier；非法 YAML 报错
- [x] **T5.2** 编写 scoring/__tests__/rules/ref-resolution.test.ts：resolveRef 存在时返回、不存在时抛错
- [x] **T5.3** 编写 scripts/accept-e2-s1.ts：AC-1 合法 YAML 解析成功；AC-2 items 结构；AC-3 veto_items 结构；AC-4 gaps 解析；AC-5 iteration-tier 解析；AC-6 ref 解析；AC-7 三个 YAML 文件存在且 schema 通过

---

## 验收执行规则

- **生产代码**：逐条核对「文件 / 类 / 方法 / 实现细节」是否与表中描述一致。
- **集成测试**：必须运行表中「执行命令」，根据实际结果填写「执行情况」；未运行或失败则不得标记任务完成。
- **验证通过**：仅当「生产代码实现」与「集成测试」均满足，且执行情况为「通过」时，方可标记任务完成。
- **阻塞处理**：若某条任务因依赖或平台限制无法完全满足，须报告阻塞并注明原因，不得标记完成。

---

## TDD 红绿灯执行顺序

1. **T1** [TDD-RED] 写测试：三个 YAML 文件存在且可被解析器读取。 [TDD-GREEN] 创建 default/、实现三个 YAML。
2. **T2** [TDD-RED] 写测试：gaps、iteration-tier 可解析且结构正确。 [TDD-GREEN] 实现 gaps-scoring.yaml、iteration-tier.yaml。
3. **T3** [TDD-RED] 写测试：resolveRef 可解析 config 中的 item_id。 [TDD-GREEN] 扩展 code-reviewer-config。
4. **T4** [TDD-RED] 写测试：loadPhaseScoringYaml、loadGapsScoringYaml、loadIterationTierYaml、resolveRef；非法 ref 抛错。 [TDD-GREEN] 实现解析器。
5. **T5** 编写单测与 accept-e2-s1.ts；运行全部通过。
