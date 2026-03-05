# plan-E1-S1：eval-system-scoring-core 实现方案

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.1  
**来源**：spec-E1-S1.md、Story 1.1、Architecture

---

## 1. 技术选型

| 选型项 | 决策 | 理由 |
|--------|------|------|
| 实现语言 | **TypeScript** | 与 BMAD/Speckit 生态一致；类型安全；JSON schema 可生成 TS 类型 |
| Schema 定义 | **JSON Schema** | 需求 §3.6 明确；可验证、可生成 TS 类型；与 scoring 存储格式一致 |
| 目录结构 | 按 Architecture §9.1 | scoring/rules/default/、scoring/data/、scoring/docs/ |
| 数据路径配置 | 环境变量或 config | `SCORING_DATA_PATH` 默认 `scoring/data/`，可覆盖为 `_bmad-output/scoring/` |

---

## 2. 目录结构

```
scoring/
├── rules/
│   ├── default/
│   │   └── .gitkeep
│   └── .gitkeep
├── data/
│   └── .gitkeep
├── docs/
│   └── .gitkeep
├── schema/
│   ├── run-score-schema.json      # 完整 schema（替换现有占位）
│   └── check-item-schema.json     # check_items 子 schema
├── constants/
│   ├── table-a.ts                 # BMAD Layer → 阶段
│   ├── table-b.ts                 # 阶段 → 评分环节
│   └── weights.ts                 # 六环节权重、L1–L5 区间
├── core/
│   ├── calculator.ts              # 四层架构计算逻辑
│   └── index.ts
└── package.json                   # 若项目无则创建；含 ts-node、ajv 等
```

---

## 3. 实现 Phase

### Phase 1：Schema 与常量

| 任务 | 产出 | 验收 |
|------|------|------|
| 定义 run-score-schema.json | 含 run_id、scenario、stage、phase_score、check_items、iteration_count、iteration_records、first_pass 等 | ajv 验证通过 |
| 定义 check_item、iteration_record 子结构 | item_id、passed、score_delta、note；timestamp、result、severity、note | 与 spec §3.2、§3.3 一致 |
| 实现 table-a.ts | BMAD_LAYER_TO_STAGES 常量 | 与 spec §5 一致 |
| 实现 table-b.ts | STAGE_TO_PHASE 常量，含 gaps 双轨说明 | 与 spec §6 一致 |
| 实现 weights.ts | PHASE_WEIGHTS、LEVEL_RANGES | 20/25/25/15/10/5；L5 90–100 等 |

### Phase 2：四层架构计算逻辑

| 任务 | 产出 | 验收 |
|------|------|------|
| 实现 calculator.ts | `computeCompositeScore(phaseScores)`, `aggregateFourDimensions(phaseScores)`, `scoreToLevel(score)` | 给定环节得分可正确计算综合分、四维度、等级 |
| 导出 core/index.ts | 对外 API | 生产代码可 import 并调用 |

### Phase 3：目录与配置

| 任务 | 产出 | 验收 |
|------|------|------|
| 创建 scoring/rules/default/、data/、docs/ | 目录及 .gitkeep | 目录存在 |
| 实现数据路径配置 | getScoringDataPath()，默认 scoring/data/，可配置 | 环境变量或 config 可覆盖 |

### Phase 4：集成与端到端测试

| 任务 | 产出 | 验收 |
|------|------|------|
| 集成测试：calculator 与 schema 联动 | 构造合法 run-score 对象，经 schema 验证后传入 calculator | 验证通过 |
| 集成测试：table-a/table-b 与 calculator 联动 | 用 table-b 映射 stage→phase，用 table-a 校验 stage 合法性 | 验证通过 |
| 端到端：从 JSON 文件读取 → 计算 → 输出 | 脚本读取 scoring/data 样例 → 计算综合分与等级 → 输出 | 可运行脚本验证 |

---

## 4. 集成测试与端到端测试计划

### 4.1 集成测试

| 测试用例 | 描述 | 验证点 |
|----------|------|--------|
| `test_calculator_with_valid_phase_scores` | 给定六环节得分 [18,22,20,12,8,4]，计算综合分、四维度、等级 | 综合分≈84，等级 L4，四维度正确 |
| `test_schema_validates_run_score` | 构造含 run_id、scenario、stage、check_items、iteration_records 的对象 | ajv 验证通过 |
| `test_schema_rejects_invalid_stage` | stage 为非法值 | 验证失败 |
| `test_schema_rejects_invalid_scenario` | scenario 非 real_dev/eval_question | 验证失败 |
| `test_table_a_b_consistency` | table-b 中所有 stage 均在 table-a 的某 Layer 下 | 无遗漏 |
| `test_calculator_imported_in_production_path` | 生产代码（如验收脚本）import core/calculator | 可被调用，无孤岛 |

### 4.2 端到端测试

| 测试用例 | 描述 | 验证点 |
|----------|------|--------|
| `e2e_acceptance_script` | 运行 `node scripts/accept-e1-s1.js` 或等效 | 读取样例 JSON → 计算 → 输出综合分与等级；脚本通过 |
| `e2e_production_import_chain` | 验收脚本 import scoring/core → 调用 calculator | 模块在生产代码关键路径中被导入并调用 |

### 4.3 测试文件布局

```
scoring/
├── __tests__/
│   ├── calculator.test.ts
│   ├── schema.test.ts
│   ├── constants.test.ts
│   └── integration/
│       ├── calculator-schema.test.ts
│       └── table-calculator.test.ts
scripts/
└── accept-e1-s1.ts              # 端到端验收脚本
```

---

## 5. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| §1 问题与目标 | spec §2 | Phase 2 calculator | ✅ |
| §1.4 scenario | spec §3.1 | Phase 1 schema | ✅ |
| §2.1 表 A | spec §5 | Phase 1 table-a.ts | ✅ |
| §2.1 表 B | spec §6 | Phase 1 table-b.ts | ✅ |
| §3.1 设计原则 | spec §2 | Phase 2 calculator | ✅ |
| §3.2 四层架构 | spec §2 | Phase 2 calculator | ✅ |
| §3.6 存储 schema | spec §3 | Phase 1 schema | ✅ |
| §3.8 目录结构 | spec §4 | Phase 3 目录 | ✅ |
| Architecture §9.1 | spec §4 | Phase 3 目录 | ✅ |
| Architecture §8 | spec §3 | Phase 1 schema | ✅ |
| AC-1.1–AC-4.2 | spec §7 | Phase 1–4 全部 | ✅ |

---

## 6. 验收脚本设计

**脚本**：`scripts/accept-e1-s1.ts`（或 `.js`）

**输入**：`scoring/data/sample-run.json`（样例数据，含 run_id、stage、phase_score、check_items 等）

**流程**：
1. 读取 sample-run.json
2. 使用 ajv 校验 schema
3. 提取六环节得分（或从 check_items 汇总）
4. 调用 `computeCompositeScore`、`scoreToLevel`
5. 输出：综合分、等级、四维度

**验收通过条件**：脚本执行无报错，输出符合预期（如综合分 84、等级 L4）。

---

## 7. 禁止事项

- 禁止伪实现、占位实现
- 禁止模块仅单元测试通过但从未被生产代码关键路径导入
- 禁止验收仅依赖单元测试；必须包含集成测试与端到端脚本
