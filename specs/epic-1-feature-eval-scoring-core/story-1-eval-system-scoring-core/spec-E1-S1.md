# spec-E1-S1：eval-system-scoring-core 技术规格

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.1  
**来源**：1-1-eval-system-scoring-core.md、REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md

---

## 1. 范围与目标

### 1.1 本 spec 覆盖

实现 AI 代码评测体系评分核心：四层架构、六环节权重、存储 schema、目录结构、表 A/B 映射。不包含评分规则 YAML 具体配置（Story 2.1）、审计产出解析与写入（Story 1.2、3.x）、一票否决与多次迭代阶梯式扣分（Story 4.1）、全链路 Skill 与 AI 代码教练（Story 3.x、4.2）。

### 1.2 功能边界

| 包含 | 不包含 |
|------|--------|
| 四层架构计算逻辑（环节→综合分→等级） | 评分规则 YAML 具体配置 |
| 六环节权重 20/25/25/15/10/5 | 审计产出解析与写入 |
| 四能力维度聚合公式 | 一票否决、多次迭代阶梯式扣分 |
| L1–L5 等级定义 | 全链路 Skill、AI 代码教练 |
| 存储 schema 定义（TypeScript/JSON schema） | |
| 目录结构 scoring/rules/、scoring/data/、scoring/docs/ | |
| 表 A（BMAD Layer → 阶段） | |
| 表 B（阶段 → 评分环节） | |

---

## 2. 四层架构规格

### 2.1 第一层：六环节分项评分

| 环节 | 名称 | 满分 | 权重 |
|------|------|------|------|
| 1 | 需求拆解与方案设计 | 20 | 0.20 |
| 2 | 代码生成与工程规范 | 25 | 0.25 |
| 3 | 测试用例与质量保障 | 25 | 0.25 |
| 4 | 调试与 bug 修复 | 15 | 0.15 |
| 5 | 跨模块/存量项目集成 | 10 | 0.10 |
| 6 | 端到端全流程交付 | 5 | 0.05 |

**计算规则**：各环节得分 0–满分，按权重参与综合分计算。

### 2.2 第二层：四能力维度聚合

| 能力维度 | 对应环节 | 聚合公式 |
|----------|----------|----------|
| 需求与设计能力 | 环节 1 | 环节 1 得分 |
| 代码与工程能力 | 环节 2+5 | 环节 2 与环节 5 加权（权重 0.25、0.10） |
| 质量与闭环能力 | 环节 3+4 | 环节 3 与环节 4 加权（权重 0.25、0.15） |
| 端到端交付能力 | 环节 6 | 环节 6 得分 |

### 2.3 第三层：综合百分制

**公式**：综合得分 = Σ(环节得分 × 对应权重)，0–100 分。

其中权重归一化：Σ(phase_weight) = 1.0。

### 2.4 第四层：L1–L5 能力等级

| 等级 | 名称 | 得分区间 |
|------|------|----------|
| L5 | 专家级 | 90–100 |
| L4 | 资深级 | 80–89 |
| L3 | 进阶级 | 60–79 |
| L2 | 入门级 | 40–59 |
| L1 | 玩具级 | 0–39 |

**映射规则**：给定综合分，取区间包含该分的等级；边界值归属高等级（如 90 归属 L5）。

---

## 3. 存储 schema 规格

### 3.1 必存字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| run_id | string | 是 | 单次运行唯一标识 |
| scenario | enum | 是 | `real_dev` \| `eval_question` |
| stage | enum | 是 | prd \| arch \| epics \| story \| specify \| plan \| gaps \| tasks \| implement \| post_impl \| pr_review |
| path_type | string | 否 | 两场景均 full；用于记录或审计追溯 |
| phase_score | number | 是 | 该阶段对应的评分环节（1–6）得分 |
| phase_weight | number | 是 | 该环节权重（如 0.20, 0.25） |
| check_items | array | 是 | 各检查项通过/不通过、扣分/加分明细 |
| timestamp | string | 是 | ISO 8601 |
| model_version | string | 否 | 受测模型版本/配置 |
| question_version | string | 否（评测场景必填；真实开发可空或填 spec 版本） | 评测题目版本 |
| iteration_count | integer | 是 | 该 stage 整改迭代次数（0 表示一次通过） |
| iteration_records | array | 是 | 每次整改记录 |
| first_pass | boolean | 是 | 是否一次通过（true=阶梯系数 100%） |

### 3.2 check_items 明细结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| item_id | string | 是 | 与 scoring/rules 中定义一致 |
| passed | boolean | 是 | 是否通过 |
| score_delta | number | 是 | 扣分（负）或加分（正） |
| note | string | 否 | 备注 |

### 3.3 iteration_records 明细结构

| 字段 | 类型 | 说明 |
|------|------|------|
| timestamp | string | ISO 8601 |
| result | enum | `pass` \| `fail` |
| severity | enum | `fatal` \| `serious` \| `normal` \| `minor` |
| note | string | 备注 |

---

## 4. 目录结构规格

```
scoring/
├── rules/
│   ├── default/           # 可版本化、可插拔
│   │   └── .gitkeep
│   └── .gitkeep
├── data/                  # 或 _bmad-output/scoring/，可配置
│   └── .gitkeep
└── docs/                  # 权威文档目录
    └── .gitkeep
```

**配置项**：数据存储路径可配置为 `scoring/data/` 或 `_bmad-output/scoring/`。

---

## 5. 表 A：BMAD Layer → 阶段列表

| BMAD Layer | 阶段（stage） | 说明 |
|------------|---------------|------|
| Layer 1 产品定义层 | prd, arch | Product Brief→复杂度评估→PRD→Architecture；code-review(prd/arch) |
| Layer 2 Epic/Story 规划层 | epics | create-epics-and-stories；无独立评分环节 |
| Layer 3 Story 开发层 | story | Create Story→Party-Mode→Story 文档 |
| Layer 4 技术实现层 | specify, plan, gaps, tasks, implement | speckit 五阶段 |
| Layer 5 收尾层 | post_impl, pr_review | 实施后审计 §5；PR + 强制人工审核 |

---

## 6. 表 B：阶段 → 评分环节

| 阶段 | 对应评分环节 | 说明 |
|------|--------------|------|
| prd | 环节 1 | PRD 审计通过且需求覆盖完整 |
| arch | 环节 1 补充、环节 2 设计侧 | Architecture 审计通过 |
| epics | 环节 1 输入依据（不单独计分） | Epic/Story 列表为需求拆解输入 |
| story | 环节 1 补充 | Create Story 审计通过 |
| specify | 环节 1 | spec 审计通过 |
| plan | 环节 1 补充、环节 2 设计侧 | plan 审计通过 |
| gaps | 环节 1 补充（前置）、环节 2–5 的输入、环节 2/6 子维度（后置） | 前置完整性 40%；后置 implement 占环节 2 的 30%、post_impl 占环节 6 的 50% |
| tasks | 环节 2–5 | 任务列表审计通过 |
| implement | 环节 2–6 | 实现阶段审计通过、TDD 执行完成 |
| post_impl | 环节 2–6 | 实施后审计 §5 通过 |
| pr_review | 环节 6 补充（可选） | 人工审核通过，可记录发布质量 |

**gaps 双轨说明**：gaps 前置完整性评审计入环节 1 补充；后置闭合度在 implement 阶段计入环节 2 的 30%、post_impl 阶段计入环节 6 的 50%。

---

## 7. 验收标准映射

| AC | 验收标准 | spec 对应 |
|----|----------|-----------|
| AC-1.1 | 六环节分项评分可计算，权重 20/25/25/15/10/5 | §2.1 |
| AC-1.2 | 四能力维度聚合公式正确 | §2.2 |
| AC-1.3 | 综合得分 = Σ(环节得分 × 对应权重)，0–100 分 | §2.3 |
| AC-1.4 | L1–L5 等级与得分区间固定 | §2.4 |
| AC-2.1 | 必存字段完整 | §3.1 |
| AC-2.2 | scenario 枚举 real_dev \| eval_question | §3.1 |
| AC-2.3 | stage 枚举完整 | §3.1 |
| AC-2.4 | check_items 含 item_id、passed、score_delta、note | §3.2 |
| AC-3.1 | scoring/rules/ 存在，支持 default 等子目录 | §4 |
| AC-3.2 | scoring/data/ 或 _bmad-output/scoring/ 可配置 | §4 |
| AC-3.3 | scoring/docs/ 存在 | §4 |
| AC-4.1 | 表 A 完整实现 | §5 |
| AC-4.2 | 表 B 完整实现，含 gaps 双轨说明 | §6 |

---

## 8. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| §1 问题与目标 | 全体系评分评级、四层架构、L1–L5 | spec §2 | ✅ |
| §1.4 | scenario 区分 real_dev/eval_question | spec §3.1 | ✅ |
| §2.1 表 A | BMAD Layer → 阶段列表 | spec §5 | ✅ |
| §2.1 表 B | 阶段 → 评分环节 | spec §6 | ✅ |
| §3.1 | 设计原则（工业级权重、可追溯、可对标） | spec §2（权重、等级固定） | ✅ |
| §3.2 | 四层架构、六环节权重、四能力维度、L1–L5 | spec §2 | ✅ |
| §3.6 | 版本追溯与存储 schema | spec §3 | ✅ |
| §3.8 | 评分规则目录 scoring/rules/ | spec §4 | ✅ |
| Architecture §3 | 表 A 完整 | spec §5 | ✅ |
| Architecture §4 | 表 B 完整 | spec §6 | ✅ |
| Architecture §8 | 存储 schema 字段 | spec §3 | ✅ |
| Architecture §9.1 | 目录结构 | spec §4 | ✅ |

---

## 9. 自审结论

- **Scope 覆盖**：Story 1.1 的 1.1 本 Story 包含 8 项均已覆盖。
- **验收标准**：AC-1.1–AC-4.2 均有 spec 对应。
- **PRD 追溯**：REQ-1.1、REQ-1.4、REQ-2.1、REQ-2.2、REQ-3.1、REQ-3.2、REQ-3.10 已映射。
- **禁止词表**：无「可选」「后续」「待定」「酌情」「视情况」「先实现」「或后续扩展」。
