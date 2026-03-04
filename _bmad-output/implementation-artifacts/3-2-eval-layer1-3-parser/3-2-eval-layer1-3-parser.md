# Story 3.2：eval-layer1-3-parser

Status: ready-for-dev

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.2  
**Slug**：eval-layer1-3-parser

---

## Story

As a 全链路 Code Reviewer Skill 编排者，  
I want 实现 Layer 1（prd/arch）、Layer 3（story）审计产出的同机解析，从 audit-prompts 对应报告与 Create Story 审计报告提取维度并映射到环节 1 检查项，  
so that Story 3.3 可将解析结果直接写入 scoring 存储，完成审计→解析→写入的闭环。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **Layer 1 审计报告解析（prd、arch）**
   - 从 PRD 阶段审计报告（audit-prompts-prd.md 对应）解析出可映射到环节 1（需求拆解与方案设计）的维度与检查项结果
   - 从 Architecture 阶段审计报告（audit-prompts-arch.md 对应）解析出可映射到环节 1 补充、环节 2 设计侧的维度与检查项
   - 报告路径遵循 Story 3.1 与 config/eval-lifecycle-report-paths.yaml 约定；prd/arch 路径由 code-reviewer 对应模式产出，本 Story 按约定读取

2. **Layer 3 Create Story 审计报告解析**
   - 从 Create Story 审计报告解析出 story 阶段的可评分维度，映射到环节 1 检查项
   - 报告路径：`_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`（与 config/eval-lifecycle-report-paths.yaml、Story 3.1 一致）

3. **同机解析与输出结构**
   - 在同一执行环境中读取审计报告文件，解析为结构化数据
   - 产出符合 Story 1.1 存储 schema 的评分记录或中间结构（phase_score、phase_weight、check_items 等），供 Story 3.3 写入
   - check_items 含 item_id、passed、score_delta、note，与 Architecture §8.2 一致；item_id 可含 veto 类标识（veto_core_logic、veto_owasp_high、veto_cwe798 等），与 scoring/rules、code-reviewer-config 中 veto_items 对应，供 Story 4.1 消费

4. **解析器实现与路径约定落地**
   - 实现解析逻辑，支持 prd、arch、story 三类输入
   - 文档或代码中明确支持的报告路径列表，与 3.1 约定一致

### 1.2 本 Story 不包含

- **解析结果的持久化写入**：由 Story 3.3 实现。本 Story 仅产出结构化数据，3.3 调用本 Story 解析并调用 Story 1.2 写入。
- **全链路 Skill 的编排与触发定义**：由 Story 3.1 实现。本 Story 依赖 3.1 的 stage 与报告路径约定。
- **与 speckit-workflow、bmad-story-assistant 的协同与触发模式表**：由 Story 3.3 实现。本 Story 不涉及触发与协同逻辑。
- **一票否决、多次迭代阶梯式扣分**：由 Story 4.1 实现。

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 给定 Layer 1 审计报告（prd 或 arch），解析器产出环节 1 的评分相关结构（phase_score、phase_weight、check_items 等），且与 Story 1.1 schema 兼容 | 单元测试：注入样本报告，断言输出结构及必填字段存在 |
| AC-2 | 给定 Layer 3 Create Story 审计报告（符合 AUDIT_Story_{epic}-{story}.md 约定路径），解析器产出环节 1 的评分相关结构 | 单元测试或验收脚本：样本报告路径与解析结果校验 |
| AC-3 | 解析逻辑与 3.1 约定的报告路径、命名一致；文档或代码中明确支持的报告路径列表（prd、arch、story 三类） | 文档或常量表；测试覆盖约定路径 |
| AC-4 | 解析输出包含 phase_score、phase_weight、check_items（item_id、passed、score_delta、note），与 Architecture §8.1、§8.2 一致 | Schema 校验或类型断言 |

---

## 3. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-2.1~2.5 | 表 A 阶段与审计产出的对应；从审计报告提取维度并映射到环节 1 |
| REQ-3.12 | Code Reviewer Skill 与需求整合：输出与 scoring 存储 schema 衔接；解析产出须写入 §3.6 schema |
| REQ-3.13 | 全链路 Skill 引用 audit-prompts；本 Story 从 audit-prompts 对应的审计报告提取 |
| REQ-3.15 | 解析规则与环节 1 映射；维度换算与 check_items 与 scoring/rules 配置一致 |
| REQ-3.16 | 全链路 Skill 引用组件；本 Story 作为解析层，产出供 3.3 写入 |
| REQ-3.17 | 解析输出格式与 schema 衔接 |

---

## 4. Architecture 约束

| 组件/约束 | 说明 |
|-----------|------|
| Architecture §2.1 | scoring/rules 解析规则从 audit-prompts 对应审计报告提取；本 Story 实现该提取逻辑 |
| Architecture §5 | 审计产出→评分环节映射表：prd→环节 1、arch→环节 1 补充与环节 2 设计侧、story→环节 1 补充；各阶段可解析 |
| Architecture §6 | Layer 1–3 同机解析：Layer 1 prd/arch 对应 audit-prompts-prd/arch、code-reviewer-config；Layer 3 story 对应 AUDIT_Story_{epic}-{story}.md |
| Architecture §8.1、§8.2 | 解析输出须包含 run_id、scenario、stage、phase_score、phase_weight、check_items、timestamp 等；check_items 含 item_id、passed、score_delta、note |
| config/stage-mapping.yaml | 表 A、表 B：prd/arch/story 均映射环节 1；解析时按 stage 确定 phase_weight |
| config/eval-lifecycle-report-paths.yaml | 报告路径约定：story 为 _bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md；prd/arch 与 code-reviewer 产出路径一致 |

---

## 5. Tasks / Subtasks

- [ ] **T1** 实现 Layer 1 prd 审计报告解析器（AC: #1）
  - [ ] T1.1 定义 prd 报告输入格式与解析规则（基于 audit-prompts-prd.md 对应结构）
  - [ ] T1.2 实现从 prd 报告提取 phase_score、check_items 的逻辑，映射环节 1 检查项
  - [ ] T1.3 单元测试：注入样本 prd 报告，断言输出与 Story 1.1 schema 兼容

- [ ] **T2** 实现 Layer 1 arch 审计报告解析器（AC: #1）
  - [ ] T2.1 定义 arch 报告输入格式与解析规则（基于 audit-prompts-arch.md 对应结构）
  - [ ] T2.2 实现从 arch 报告提取 phase_score、check_items 的逻辑，映射环节 1 补充与环节 2 设计侧
  - [ ] T2.3 单元测试：注入样本 arch 报告，断言输出与 schema 兼容

- [ ] **T3** 实现 Layer 3 story 审计报告解析器（AC: #2）
  - [ ] T3.1 约定 Create Story 审计报告路径：AUDIT_Story_{epic}-{story}.md（与 eval-lifecycle-report-paths.yaml 一致）
  - [ ] T3.2 实现从 Create Story 报告提取 phase_score、check_items 的逻辑，映射环节 1 补充
  - [ ] T3.3 单元测试或验收脚本：给定报告路径与样本，校验解析结果

- [ ] **T4** 统一解析输出与路径约定文档化（AC: #3、#4）
  - [ ] T4.1 确保解析输出含 phase_score、phase_weight、check_items（item_id、passed、score_delta、note）
  - [ ] T4.2 在代码或文档中明确支持的报告路径列表（prd、arch、story 三类）
  - [ ] T4.3 验证与 Story 3.1、config 约定的路径一致

- [ ] **T5** 与 Story 3.3 的接口契约（AC: #4）
  - [ ] T5.1 提供可被 3.3 调用的解析入口（函数或脚本），输入为报告路径与 run_id/scenario/stage
  - [ ] T5.2 输出结构可直接供 Story 1.2 写入接口使用，无需二次转换

---

## 6. 与 Story 3.1、3.3 的接口约定

### 6.1 本 Story 从 3.1 接收

- **报告路径约定**：prd/arch 阶段由 config/eval-lifecycle-report-paths.yaml 与 code-reviewer 约定；story 阶段为 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`
- **stage → 环节映射**：config/stage-mapping.yaml 表 B；prd→环节 1、arch→环节 1 与 2、story→环节 1
- **可解析性**：Architecture §5 声明 prd、arch、story 均可解析

### 6.2 本 Story 向 3.3 提供

- **解析入口**：给定报告路径、run_id、scenario、stage，返回符合 Story 1.1 schema 的评分记录（或中间结构）
- **输出结构**：phase_score、phase_weight、check_items、timestamp 等，可直接传入 Story 1.2 写入接口

### 6.3 依赖方向

- 本 Story 依赖 Story 3.1 的路径约定与 stage 映射
- Story 3.3 依赖本 Story 的解析输出

---

## 7. 依赖

- **前置 Story**：Story 3.1（eval-lifecycle-skill-def）。依赖 3.1 的 stage 与报告路径约定、环节映射。
- **Schema 依赖**：Story 1.1 的存储 schema（解析输出与之对齐）；不依赖 Story 1.2 的写入实现。

---

## 8. Dev Notes

- **技术栈**：解析逻辑可用 TypeScript/Node 或 Python，与项目现有 scripts 一致；读取文件、解析 Markdown 或结构化输出。
- **源树组件**：解析器可置于 `scoring/` 或 `scripts/` 下；报告路径从 `config/eval-lifecycle-report-paths.yaml`、`config/stage-mapping.yaml` 读取。
- **测试标准**：单元测试覆盖 prd、arch、story 三类样本；验收脚本可验证路径约定与解析输出。

### Project Structure Notes

- 与 `config/stage-mapping.yaml`、`config/eval-lifecycle-report-paths.yaml` 路径对齐。
- 解析输出与 `scoring/rules` 的 item_id 引用一致，便于与 code-reviewer-config 衔接。

### References

- [Source: _bmad-output/planning-artifacts/dev/architecture.ai-code-eval-system.md#5, #6, #8]
- [Source: docs/BMAD/REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md#3.12, #3.13]
- [Source: config/stage-mapping.yaml]
- [Source: config/eval-lifecycle-report-paths.yaml]
- [Source: _bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/3-1-eval-lifecycle-skill-def.md]
- [Source: _bmad-output/implementation-artifacts/3-3-eval-skill-scoring-write/3-3-eval-skill-scoring-write.md]
- [Source: _bmad-output/implementation-artifacts/1-1-eval-system-scoring-core/1-1-eval-system-scoring-core.md]

---

*本 Story 实现从审计报告解析出评分记录（Layer 1–3 同机解析），为 Story 3.3 的写入提供结构化输入。*

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
