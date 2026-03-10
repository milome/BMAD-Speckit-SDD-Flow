# tasks-E1-S1：eval-system-scoring-core 任务列表

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.1  
**来源**：plan-E1-S1.md、IMPLEMENTATION_GAPS-E1-S1.md、Story 1.1 §6

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
4. ✅ 功能/数据路径相关任务实施前必须先检索并阅读需求文档相关章节
5. ✅ 需求追溯（实施前必填）：问题关键词、检索范围、相关章节、既有约定摘要、方案是否与需求一致

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | REQUIREMENTS | §3.2 | 四层架构、六环节权重、四能力维度、L1–L5 |
| T2 | REQUIREMENTS | §3.6 | 存储 schema、check_items、iteration_records |
| T3 | Architecture | §9.1 | scoring/rules/default/、data/、docs/ |
| T4 | REQUIREMENTS | §2.1 | 表 A、表 B |
| T5 | Story 1.1 | §6 | 单元测试、验收脚本 |

---

## Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| §2.1 | GAP-2.1.1, GAP-2.1.2 | ✓ 有 | T4 |
| §3.2 | GAP-3.2.1–3.2.4 | ✓ 有 | T1 |
| §3.6 | GAP-3.6.1–3.6.3, GAP-T2 | ✓ 有 | T2 |
| §3.8 | GAP-3.8.1–3.8.3 | ✓ 有 | T3 |
| Architecture | GAP-A.1 | ✓ 有 | T3 |
| Story T1–T5 | GAP-T1–T5 | ✓ 有 | T1–T5 |

---

## 任务列表

### T1：定义四层架构计算逻辑（环节得分→综合分→等级）

**产出物**：scoring/core/calculator.ts、scoring/constants/weights.ts、scoring/core/index.ts

**验收标准**：
- AC-1.1：六环节分项评分可计算，权重 20/25/25/15/10/5
- AC-1.2：四能力维度聚合公式正确
- AC-1.3：综合得分 = Σ(环节得分 × 对应权重)，0–100 分
- AC-1.4：L1–L5 等级与得分区间固定；边界值 90 归属 L5
- 集成验证：该模块在生产代码关键路径（accept-e1-s1 验收脚本）中被 import 并调用

**验证命令**：
```bash
npx ts-node -e "const c=require('./scoring/core').default; console.log(c.computeCompositeScore([18,22,20,12,8,4])); console.log(c.scoreToLevel(84));"
```
预期：综合分≈84，等级 L4

**集成测试**：scoring/__tests__/calculator.test.ts、scoring/__tests__/integration/calculator-schema.test.ts

---

- [x] **T1.1** 创建 scoring/constants/weights.ts，定义 PHASE_WEIGHTS（20/25/25/15/10/5）、LEVEL_RANGES（L5 90–100 等）
- [x] **T1.2** 创建 scoring/core/calculator.ts，实现 computeCompositeScore(phaseScores)、aggregateFourDimensions(phaseScores)、scoreToLevel(score)
- [x] **T1.3** 创建 scoring/core/index.ts，导出 calculator 与 weights
- [x] **T1.4** 编写 calculator.test.ts，覆盖 AC-1.1–AC-1.4 及边界值（90→L5）

---

### T2：定义存储 schema（TypeScript 类型或 JSON schema）

**产出物**：scoring/schema/run-score-schema.json、check-item-schema.json（或内嵌）

**验收标准**：
- AC-2.1：必存字段完整
- AC-2.2：scenario 枚举 real_dev | eval_question
- AC-2.3：stage 枚举 prd|arch|epics|story|specify|plan|gaps|tasks|implement|post_impl|pr_review
- AC-2.4：check_items 含 item_id、passed、score_delta、note
- 集成验证：schema 在 accept-e1-s1 中被 ajv 用于校验 sample-run.json

**验证命令**：
```bash
npx ajv validate -s scoring/schema/run-score-schema.json -d scoring/data/sample-run.json
```

**集成测试**：scoring/__tests__/schema.test.ts

---

- [x] **T2.1** 重写 scoring/schema/run-score-schema.json，含 run_id、scenario、stage、path_type、phase_score、phase_weight、check_items、timestamp、model_version、question_version、iteration_count、iteration_records、first_pass
- [x] **T2.2** 定义 check_items 结构（item_id、passed、score_delta、note）与 iteration_records 结构（timestamp、result、severity、note）
- [x] **T2.3** 编写 schema.test.ts，验证合法/非法数据

---

### T3：创建 scoring/rules/、scoring/data/、scoring/docs/ 目录结构

**产出物**：目录及 .gitkeep、数据路径配置

**验收标准**：
- AC-3.1：scoring/rules/ 存在，支持 default 子目录
- AC-3.2：scoring/data/ 或 _bmad-output/scoring/ 可配置
- AC-3.3：scoring/docs/ 存在
- 集成验证：getScoringDataPath() 在 accept-e1-s1 中用于解析数据路径；SCORING_DATA_PATH 覆盖时行为正确

**验证命令**：
```bash
test -d scoring/rules/default && test -d scoring/data && test -d scoring/docs && echo "OK"
```

---

- [x] **T3.1** 创建 scoring/rules/default/、scoring/data/、scoring/docs/ 及 .gitkeep
- [x] **T3.2** 实现 getScoringDataPath()（scoring/constants/path.ts 或等效），默认 scoring/data/，支持环境变量 SCORING_DATA_PATH 覆盖
- [x] **T3.3** 编写 path.test.ts，验证默认路径与 SCORING_DATA_PATH 覆盖时的返回值

---

### T4：实现表 A 表 B 常量或配置

**产出物**：scoring/constants/table-a.ts、table-b.ts

**验收标准**：
- AC-4.1：表 A 完整实现
- AC-4.2：表 B 完整实现，含 gaps 双轨说明
- 集成验证：table-b 在 accept-e1-s1 中用于 stage→phase 映射（若 sample-run 含 stage 字段）；table-a 用于校验 stage 合法性

**验证命令**：
```bash
npx ts-node -e "const {BMAD_LAYER_TO_STAGES}=require('./scoring/constants/table-a'); console.log(Object.keys(BMAD_LAYER_TO_STAGES).length);"
```

**集成测试**：scoring/__tests__/constants.test.ts、scoring/__tests__/integration/table-calculator.test.ts

---

- [x] **T4.1** 创建 scoring/constants/table-a.ts，BMAD_LAYER_TO_STAGES 与 spec §5 一致
- [x] **T4.2** 创建 scoring/constants/table-b.ts，STAGE_TO_PHASE 与 spec §6 一致，含 gaps 双轨注释

---

### T5：编写本 Story 对应的单元测试或验收脚本

**产出物**：scoring/__tests__/*.test.ts、scripts/accept-e1-s1.ts、scoring/data/sample-run.json

**验收标准**：
- 单元测试覆盖 T1–T4 核心逻辑
- 集成测试验证 calculator–schema、table–calculator 联动
- 端到端验收脚本可运行，读取 sample-run.json → 计算 → 输出综合分与等级

**验证命令**：
```bash
npm test -- --testPathPattern=scoring
npx ts-node scripts/accept-e1-s1.ts
```
（或 `node scripts/accept-e1-s1.js` 若项目有 build 步骤）

---

- [x] **T5.1** 创建 scoring/data/sample-run.json 样例数据
- [x] **T5.2** 编写 scoring/__tests__/integration/calculator-schema.test.ts、table-calculator.test.ts、**test_calculator_imported_in_production_path**（验收脚本 import scoring/core 并调用，验证无孤岛）
- [x] **T5.3** 编写 scripts/accept-e1-s1.ts：使用 getScoringDataPath() 解析路径；使用 table-b 做 stage→phase 映射（若 sample 含 stage）；使用 ajv 校验 schema；import scoring/core 调用 computeCompositeScore、scoreToLevel；输出综合分与等级
- [x] **T5.4** 在 package.json 添加 test 脚本（若缺失），确保 `npm test` 可运行 scoring 测试

---

## 验收执行规则

- **生产代码**：逐条核对「文件 / 类 / 方法 / 实现细节」是否与表中描述一致；可通过 grep、阅读源码确认。
- **集成测试**：必须运行表中「执行命令」，根据实际结果填写「执行情况」；未运行或失败则不得在「验证通过」列打勾。
- **验证通过**：仅当「生产代码实现」与「集成测试」均满足，且执行情况为「通过」时，方可标记任务完成。
- **阻塞处理**：若某条任务因依赖或平台限制无法完全满足，须**报告阻塞**并注明原因，不得标记完成。

---

## 前置依赖（实施前需完成）

- 项目需支持 TypeScript：`npm install -D typescript ts-node @types/node`
- Schema 验证：`npm install ajv`
- 测试框架：`npm install -D vitest` 或 `jest`（按项目现有选型）
