# AI 代码评测体系 — 架构文档

**版本**：1.0  
**来源**：REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md  
**覆盖范围**：§2.1 表 A/B、§2.3、§2.4、§3.6、§3.8、§3.11、§3.12、§3.13

---

## 1. 技术架构总览

### 1.1 架构分层

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI 代码教练（消费层）                                  │
│  解读评分、定位短板、优化方案设计、iteration_passed 一票否决                │
└─────────────────────────────────────────────────────────────────────────┘
                                      ↑
┌─────────────────────────────────────────────────────────────────────────┐
│              全链路 Code Reviewer Skill（编排层）                          │
│  触发时机、stage 映射、解析产出、scoring 写入；引用下层组件                  │
└─────────────────────────────────────────────────────────────────────────┘
                                      ↑
┌─────────────────────────────────────────────────────────────────────────┐
│              审计执行层（code-reviewer / audit-prompts / config）          │
│  各 stage 审计、检查项通过/不通过、审计报告产出                             │
└─────────────────────────────────────────────────────────────────────────┘
                                      ↑
┌─────────────────────────────────────────────────────────────────────────┐
│              评分规则与存储层（scoring/rules、scoring/data）                │
│  YAML 规则、解析逻辑、JSON/JSONL/CSV 存储、权威文档                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件

| 组件 | 路径/标识 | 职责 |
|------|-----------|------|
| 评分规则 | scoring/rules/*.yaml | 环节权重、检查项、veto_items、iteration_tier |
| 权威文档 | scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md | 人类可读完整标准，与 rules 一致 |
| 评分存储 | scoring/data/ 或 _bmad-output/scoring/ | run_id、stage、phase_score、check_items 等 |
| 全链路 Skill | bmad-code-reviewer-lifecycle（或等效） | 编排、解析、写入 |
| code-reviewer-config | config/code-reviewer-config.yaml | 多模式 dimensions、pass_criteria |
| audit-prompts | audit-prompts-prd.md、audit-prompts-arch.md 等 | 各 stage 审计提示词 |

---

## 2. scoring/rules 与 code-reviewer-config、audit-prompts 的引用关系

### 2.1 引用关系图

```
scoring/rules/*.yaml
    │
    ├── ref → code-reviewer-config#item_id
    │         （检查项 ID 衔接，实现规则与审计检查的对应）
    │
    ├── 解析规则 → 从 audit-prompts 对应的审计报告提取
    │         （audit-prompts-prd.md、audit-prompts-arch.md、audit-prompts-code.md 等）
    │
    └── veto_items.ref → code-reviewer-config#veto_*
              （一票否决项与 code-reviewer 检查的衔接）
```

### 2.2 引用方式

| 引用方 | 被引用方 | 引用方式 |
|--------|----------|----------|
| scoring/rules/*.yaml | code-reviewer-config | `ref: code-reviewer-config#functional_correctness` 等 item_id |
| scoring/rules/*.yaml | audit-prompts | 实施时明确；解析规则从审计报告路径与格式提取 |
| 全链路 Skill | scoring/rules | 读取 weights、items、veto_items 用于解析与映射 |
| 全链路 Skill | code-reviewer | Cursor Task 调度，按 stage 传 mode 与 prompt_template |
| 全链路 Skill | audit-prompts | 按 stage 读取对应 prompt 文件 |
| 全链路 Skill | code-reviewer-config | 按 mode 读取 dimensions、pass_criteria |

### 2.3 _bmad-output/config 与 scoring/rules 的关系

- **scoring/rules/*.yaml**：权威规则定义（完整 check_items、veto_items、权重）。
- **_bmad-output/config 的 code-reviewer-score**：项目级覆盖，可配置 weight、block_rules、code_style、security_scan、test_coverage 等。
- **加载优先级**：优先加载 scoring/rules；若 _bmad-output/config 存在 code-reviewer-score，则覆盖对应字段；未配置字段使用 scoring/rules 默认。
- **约束**：_bmad-output/config 不得替代 scoring/rules 的完整定义。

---

## 3. 表 A：BMAD Layer → 阶段列表

| BMAD Layer | 阶段（stage） | 说明 |
|------------|---------------|------|
| Layer 1 产品定义层 | prd, arch | Product Brief→复杂度评估→PRD→Architecture；code-review(prd/arch) |
| Layer 2 Epic/Story 规划层 | epics | create-epics-and-stories→Epic 列表、Story 列表、依赖图；无独立评分环节 |
| Layer 3 Story 开发层 | story | Create Story→Party-Mode→Story 文档；第一遍审计 |
| Layer 4 技术实现层 | specify, plan, gaps, tasks, implement | speckit 五阶段；code-review §1–§5 |
| Layer 5 收尾层 | post_impl, pr_review | 实施后审计 §5；PR 生成 + 强制人工审核 |

---

## 4. 表 B：阶段 → 评分环节

| 阶段 | 对应评分环节 | 说明 |
|------|--------------|------|
| prd | 环节 1（需求拆解与方案设计） | PRD 审计通过且需求覆盖完整 |
| arch | 环节 1 补充、环节 2 设计侧 | Architecture 审计通过且架构/技术选型合理 |
| epics | 环节 1 输入依据（不单独计分） | Epic/Story 列表为需求拆解完整性检查输入 |
| story | 环节 1 补充 | Create Story 审计通过且 Story 文档满足 PRD/Arch/Epic 覆盖 |
| specify | 环节 1 | spec 审计通过且需求覆盖完整、边界与方案合理 |
| plan | 环节 1 补充、环节 2 设计侧 | plan 审计通过且架构/技术选型合理 |
| gaps | 环节 1 补充（前置）、环节 2–5 的输入、环节 2/6 子维度（后置） | 前置完整性 40%；后置 implement 占环节 2 的 30%、post_impl 占环节 6 的 50% |
| tasks | 环节 2–5 | 任务列表审计通过 |
| implement | 环节 2–6 | 实现阶段审计通过、TDD 执行完成 |
| post_impl | 环节 2–6 | 实施后审计 §5 通过 |
| pr_review | 环节 6 补充 | 人工审核通过，可记录发布质量 |

---

## 5. 审计产出 → 评分环节的输入（§2.3 映射）

| 阶段 | 主要审计产出 | 对应的评分环节 | 可解析性 |
|------|--------------|----------------|----------|
| prd | PRD 审计报告（code-review prd 模式） | 环节 1 | 可解析，audit-prompts-prd.md 对应 |
| arch | Architecture 审计报告（code-review arch 模式） | 环节 1 补充、环节 2 设计侧 | 可解析，audit-prompts-arch.md 对应 |
| epics | Epic/Story 列表、依赖图 | 环节 1 输入依据 | 当前不单独计分 |
| story | Create Story 审计报告、Story 文档 | 环节 1 补充 | 可解析，需约定报告路径 |
| specify | spec 审计报告 | 环节 1 | 可解析 |
| plan | plan 审计报告 | 环节 1 补充、环节 2 设计侧 | 可解析 |
| gaps | IMPLEMENTATION_GAPS 审计报告、gaps 前置完整性评审报告 | 环节 1 补充（前置）、环节 2/6 后置闭合度 | 可解析 |
| tasks | tasks 审计报告、各任务验收表 | 环节 2–5 | 可解析 |
| implement | 执行 tasks 后审计报告（audit-prompts §5） | 环节 2–6 | 可解析 |
| post_impl | 实施后审计 §5 报告、验收表 | 环节 2–6 实测与端到端 | 可解析 |
| pr_review | 人工审核结论 | 环节 6 补充 | 可解析 |

---

## 6. Layer 1–3 审计产出的同机解析（§2.4）

| Layer | 审计产出 | 解析规则来源 |
|-------|----------|--------------|
| Layer 1 prd | PRD 审计报告 | audit-prompts-prd.md、code-reviewer-config prd 模式 |
| Layer 1 arch | Architecture 审计报告 | audit-prompts-arch.md、code-reviewer-config arch 模式 |
| Layer 3 story | Create Story 审计报告 | 第一遍审计结论；约定报告路径 `AUDIT_Story_{epic}-{story}.md` |

---

## 7. 数据流

### 7.1 主流程（自有真实需求开发）

```
BMAD 五层各 stage 执行
    → 该 stage 审计（code-reviewer + audit-prompts + code-reviewer-config）
    → 审计报告产出
    → 全链路 Skill 解析（依据 scoring/rules）
    → 提取 check_items、phase_score
    → 追加写入 scoring/data/{run_id}.json 或 scores.jsonl
    → 该阶段迭代结束判定：审计完全覆盖 + 得分已写入
```

### 7.2 评测题目执行流程

```
题目执行（同样走 Layer 1→2→3→4→5 完整路径）
    → 每次执行产生独立 run_id
    → scenario = eval_question
    → 得分写入独立记录
    → 可与同题目版本的其他 run 对比
```

### 7.3 与 BMAD workflows 的集成点

| 集成点 | 说明 |
|--------|------|
| speckit-workflow | clarify/checklist/analyze 嵌入各审计闭环；stage 完成 → 调用全链路 Skill 的「解析并写入」逻辑 |
| bmad-story-assistant | 审计步骤调度 code-reviewer；各 stage 审计通过后触发评分解析与写入 |
| 全链路 Skill | 在上述流程的各 stage 审计通过后触发评分解析与写入；三者协同 |

---

## 8. 存储 Schema（§3.6）

### 8.1 每次评分环节的必存字段

| 字段 | 类型 | 说明 |
|------|------|------|
| run_id | string | 单次运行唯一标识 |
| scenario | enum | `real_dev` \| `eval_question` |
| stage | string | prd \| arch \| epics \| story \| specify \| plan \| gaps \| tasks \| implement \| post_impl \| pr_review |
| path_type | string | 两场景均 full；用于记录或审计追溯 |
| phase_score | int | 该阶段对应的评分环节（1–6）得分 |
| phase_weight | float | 该环节权重（如 0.20, 0.25） |
| check_items | array | 各检查项通过/不通过、扣分/加分明细 |
| timestamp | string | ISO 8601 |
| model_version | string | 受测模型版本/配置 |
| question_version | string | 评测题目版本（评测场景必填） |
| iteration_count | int | 该 stage 整改迭代次数（0 表示一次通过） |
| iteration_records | array | 每次整改记录：{timestamp, result, severity, note} |
| first_pass | bool | 是否一次通过（true=阶梯系数 100%） |

### 8.2 check_items 明细结构

| 字段 | 类型 | 说明 |
|------|------|------|
| item_id | string | 与 scoring/rules 中定义一致 |
| passed | bool | 是否通过 |
| score_delta | float | 扣分（负）或加分（正） |
| note | string | 备注 |

### 8.3 文件命名与格式

- 单次运行单文件：`scoring/data/{run_id}.json`
- 追加模式：`scoring/data/scores.jsonl`，每行一条 JSON
- CSV 导出：`scoring/data/scores.csv`，列与上表字段对应

---

## 9. 评分规则目录与版本（§3.8、§3.11）

### 9.1 目录结构

```
scoring/
├── rules/
│   ├── default/
│   │   ├── implement-scoring.yaml    # 环节 2
│   │   ├── test-scoring.yaml         # 环节 3
│   │   ├── bugfix-scoring.yaml       # 环节 4
│   │   └── ...
│   ├── gaps-scoring.yaml
│   ├── iteration-tier.yaml
│   └── algorithm-heavy/             # 可插拔多套方案
├── docs/
│   └── SCORING_CRITERIA_AUTHORITATIVE.md
└── data/
    ├── {run_id}.json
    ├── scores.jsonl
    └── scores.csv
```

### 9.2 YAML Schema 核心结构（环节 2 示例）

```yaml
version: "1.0"
stage: implement
link_stage: [tasks, post_impl]
link_环节: 2

weights:
  base: { functional_correctness: 30, code_standards: 18, ... }
  bonus: { security_compliance: 20, ... }

items:
  - id: func_correct
    ref: code-reviewer-config#functional_correctness
    deduct: 10
  - ...

veto_items:
  - id: veto_high_security
    ref: code-reviewer-config#veto_owasp_high
    consequence: stage_0_level_down
```

### 9.3 iteration_tier 配置

```yaml
iteration_tier:
  1: 1.0   # 一次通过 100%
  2: 0.8   # 两次通过 80%
  3: 0.5   # 三次通过 50%
  4: 0     # 四次及以上 0%

severity_override:
  fatal: 3    # 致命问题整改≥3 次→系数 0
  serious: 2  # 严重问题整改≥2 次→降一档
```

---

## 10. Code Reviewer Skill 与全链路 Skill（§3.12、§3.13）

### 10.1 6 阶段 ↔ 六环节对应

| Skill 6 阶段 | 需求六环节 | 权重 |
|--------------|------------|------|
| 需求拆解与方案设计 | 环节 1 | 20 |
| 代码开发 | 环节 2 | 25 |
| 测试保障 | 环节 3 | 25 |
| Bug 修复 | 环节 4 | 15 |
| 跨模块集成 | 环节 5 | 10 |
| Story 交付验收 | 环节 6 | 5 |

### 10.2 全链路 Skill 引用组件表

| 引用组件 | 职责 | 引用方式 |
|----------|------|----------|
| code-reviewer | 执行各 stage 审计 | Cursor Task 调度，按 stage 传 mode 与 prompt_template |
| audit-prompts | 各 stage 审计提示词 | audit-prompts-prd.md、audit-prompts-arch.md 等 |
| code-reviewer-config | 多模式配置（prd/arch/code/pr） | 按 mode 读取 dimensions、pass_criteria |
| scoring/rules | 解析规则、item_id、veto_items | 用于解析审计产出并映射环节得分 |

### 10.3 触发模式表

| 事件类型 | 触发方式 | 对应 stage/环节 |
|----------|----------|-----------------|
| stage 审计产出完成 | 自动 | 该 stage 对应环节 |
| Story 状态变更 | 自动（可配置） | 环节 1–6 |
| MR 创建 | 自动（可配置） | 环节 2–6 |
| Epic 待验收 | 手动或自动 | 环节 6、Epic 综合 |
| 用户显式请求「全链路评分」 | 手动 | 全环节 |

---

## 11. 与 BMAD 五层/workflows 的集成点汇总

| 集成点 | 说明 |
|--------|------|
| Layer 1 prd/arch | 审计报告 → 解析 → 环节 1 得分写入 |
| Layer 2 epics | 产出为环节 1 输入，不单独计分 |
| Layer 3 story | 审计报告 → 解析 → 环节 1 补充得分写入 |
| Layer 4 specify/plan/gaps/tasks/implement | 各 stage 审计 → 解析 → 环节 1–6 得分写入 |
| Layer 5 post_impl/pr_review | 实施后审计 → 环节 2–6 得分写入；pr_review 可记录 |
| speckit-workflow | clarify/checklist/analyze 嵌入审计闭环 |
| bmad-story-assistant | 审计步骤调度 code-reviewer |
| 全链路 Skill | stage 完成 → 解析并写入 scoring 存储 |

---

*本文档覆盖需求 §2.1 表 A/B、§2.3、§2.4、§3.6、§3.8、§3.11、§3.12、§3.13。*
