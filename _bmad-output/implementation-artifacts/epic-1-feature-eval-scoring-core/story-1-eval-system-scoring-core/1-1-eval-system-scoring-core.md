# Story 1.1：eval-system-scoring-core

**Epic**：E1 feature-eval-scoring-core  
**Story ID**：1.1  
**描述**：实现 AI 代码评测体系评分核心——四层架构、六环节权重、存储 schema、目录结构、表 A/B 映射

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **四层架构实现**
   - 第一层：六环节分项评分（满分 100，按权重分配）
   - 第二层：四能力维度聚合
   - 第三层：综合百分制
   - 第四层：L1–L5 能力等级

2. **六环节与权重**
   - 环节 1：需求拆解与方案设计（20 分）
   - 环节 2：代码生成与工程规范（25 分）
   - 环节 3：测试用例与质量保障（25 分）
   - 环节 4：调试与 bug 修复（15 分）
   - 环节 5：跨模块/存量项目集成（10 分）
   - 环节 6：端到端全流程交付（5 分）

3. **四能力维度聚合公式**
   - 需求与设计能力（环节 1）
   - 代码与工程能力（环节 2+5 加权）
   - 质量与闭环能力（环节 3+4 加权）
   - 端到端交付能力（环节 6）

4. **L1–L5 等级定义**
   - L5 专家级：90–100
   - L4 资深级：80–89
   - L3 进阶级：60–79
   - L2 入门级：40–59
   - L1 玩具级：0–39

5. **存储 schema**
   - run_id、scenario、stage、path_type、phase_score、phase_weight、check_items、timestamp、model_version、question_version、iteration_count、iteration_records、first_pass
   - check_items 明细：item_id、passed、score_delta、note

6. **目录结构**
   - scoring/rules/（可版本化、可插拔）
   - scoring/data/（或 _bmad-output/scoring/，可配置）
   - scoring/docs/（权威文档目录）

7. **表 A：BMAD Layer → 阶段列表**
   - Layer 1：prd, arch
   - Layer 2：epics
   - Layer 3：story
   - Layer 4：specify, plan, gaps, tasks, implement
   - Layer 5：post_impl, pr_review

8. **表 B：阶段 → 评分环节**
   - 完整映射表实现

### 1.2 本 Story 不包含

- 评分规则 YAML 具体配置（由 Story 2.1 实现）
- 审计产出解析与写入逻辑（由 Story 1.2、3.x 实现）
- 一票否决、多次迭代阶梯式扣分（由 Story 4.1 实现）
- 全链路 Skill、AI 代码教练（由 Story 3.x、4.2 实现）

---

## 2. 验收标准

### 2.1 四层架构

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1.1 | 六环节分项评分可计算，权重 20/25/25/15/10/5 | 给定环节得分，可正确计算综合分 |
| AC-1.2 | 四能力维度聚合公式正确 | 需求与设计=环节1；代码与工程=环节2+5；质量与闭环=环节3+4；端到端=环节6 |
| AC-1.3 | 综合得分 = Σ(环节得分 × 对应权重)，0–100 分 | 公式实现并验证 |
| AC-1.4 | L1–L5 等级与得分区间固定：L5 90–100、L4 80–89、L3 60–79、L2 40–59、L1 0–39 | 给定综合分，可正确映射等级 |

### 2.2 存储 schema

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-2.1 | 必存字段完整：run_id、scenario、stage、phase_score、phase_weight、check_items、timestamp、iteration_count、iteration_records、first_pass | Schema 定义或 TypeScript/JSON schema 可验证 |
| AC-2.2 | scenario 枚举为 real_dev \| eval_question | 类型约束 |
| AC-2.3 | stage 枚举为 prd \| arch \| epics \| story \| specify \| plan \| gaps \| tasks \| implement \| post_impl \| pr_review | 类型约束 |
| AC-2.4 | check_items 含 item_id、passed、score_delta、note | 结构定义 |

### 2.3 目录结构

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-3.1 | scoring/rules/ 目录存在，支持 default 等子目录 | 目录创建 |
| AC-3.2 | scoring/data/ 或 _bmad-output/scoring/ 可配置 | 配置项或路径常量 |
| AC-3.3 | scoring/docs/ 目录存在 | 目录创建 |

### 2.4 表 A 表 B

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-4.1 | 表 A（BMAD Layer → 阶段）完整实现，可被权威文档或代码引用 | 文档或常量表 |
| AC-4.2 | 表 B（阶段 → 评分环节）完整实现，含 gaps 双轨说明 | 文档或常量表 |

---

## 3. PRD 需求追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-1.1 | 全体系评分评级：四层架构、六环节、L1–L5 |
| REQ-1.4 | scenario 字段区分 real_dev/eval_question |
| REQ-2.1 | 表 A：BMAD Layer → 阶段列表 |
| REQ-2.2 | 表 B：阶段 → 评分环节 |
| REQ-3.1 | 设计原则中的工业级权重、可追溯可优化、可对标可认证 |
| REQ-3.2 | 四层架构、Epic 综合评分基础（单 Story 综合分公式） |
| REQ-3.10 | 版本追溯与存储 schema |

---

## 4. Architecture 约束

| 约束项 | 说明 |
|--------|------|
| 存储位置 | scoring/data/ 或 _bmad-output/scoring/（可配置） |
| 文件格式 | 优先 JSON/JSONL；CSV 导出由 Story 1.2（eval-system-storage-writer）实现 |
| stage 字段 | 必须与 Architecture §3 表 A 一致 |
| 环节权重 | 必须与 Architecture、需求 §3.2 一致 |
| 四能力维度 | 必须与需求 §3.2 第二层定义一致 |
| 目录结构 | 必须与 Architecture §9.1 一致 |

---

## 5. 禁止词表合规

本 Story 文档及产出物禁止使用以下表述：

- 可选
- 后续
- 待定
- 酌情
- 视情况
- 先实现
- 或后续扩展

---

## 6. 实施任务分解

| Task ID | 任务描述 | 产出物 |
|---------|----------|--------|
| T1 | 定义四层架构计算逻辑（环节得分→综合分→等级） | 模块或函数 |
| T2 | 定义存储 schema（TypeScript 类型或 JSON schema） | schema 定义文件 |
| T3 | 创建 scoring/rules/、scoring/data/、scoring/docs/ 目录结构 | 目录及 .gitkeep 或占位 |
| T4 | 实现表 A 表 B 常量或配置 | 常量表或 YAML |
| T5 | 编写本 Story 对应的单元测试或验收脚本 | 测试文件 |

---

## 7. 依赖

- 无前置 Story 依赖。
- 依赖需求文档 §1、§2.1、§3.2、§3.6 的完整定义。

---

*本 Story 为 Epic 1 的首个 Story，奠定评分核心与存储基础。*
