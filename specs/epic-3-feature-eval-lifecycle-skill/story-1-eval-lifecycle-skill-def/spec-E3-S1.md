# spec-E3-S1：eval-lifecycle-skill-def 技术规格

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.1  
**来源**：3-1-eval-lifecycle-skill-def.md、Architecture §2、§5、§6、§10、Story 3.2、Story 3.3

---

## 1. 范围与目标

### 1.1 本 spec 覆盖

定义全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle），明确其引用关系、触发时机与 stage 映射，为 Story 3.2、3.3 提供编排契约与报告路径约定。本 Story 主要为定义与文档产出，不包含解析实现（3.2）、写入与触发链实现（3.3）。产出包括：Skill 描述（SKILL.md 或 YAML）、stage 映射表、报告路径约定、触发模式表、与 3.2/3.3 的接口契约文档。

### 1.2 功能边界

| 包含 | 不包含 |
|------|--------|
| 全链路 Skill 标识与引用声明（code-reviewer、audit-prompts、code-reviewer-config、scoring/rules） | 审计报告解析实现（Story 3.2） |
| 触发时机与 stage 映射文档/配置 | 解析后写入 scoring 存储（Story 3.3） |
| 各 stage 审计报告路径约定 | 评分规则 YAML 内容与解析器（Story 2.1） |
| 与 Story 3.2、3.3 的接口契约 | 一票否决、阶梯扣分业务逻辑（Story 4.1） |
| 至少 3 个 stage（prd、arch、story）的映射验证 | |
| 报告路径与 AUDIT_Story_{epic}-{story}.md 约定 | |

---

## 2. Skill 定义与引用关系（T1）

### 2.1 Skill 标识

- **标识**：`bmad-code-reviewer-lifecycle`（与 Architecture §1.2、§10.2 一致）
- **定位**：编排层，触发时机、stage 映射、解析产出、scoring 写入；引用下层组件。

### 2.2 引用声明（必须显式声明的组件）

| 引用组件 | 职责 | 引用方式 |
|----------|------|----------|
| code-reviewer | 执行各 stage 审计 | Cursor Task 调度，按 stage 传 mode 与 prompt_template |
| audit-prompts | 各 stage 审计提示词 | audit-prompts-prd.md、audit-prompts-arch.md 等 |
| code-reviewer-config | 多模式配置（prd/arch/code/pr） | 按 mode 读取 dimensions、pass_criteria |
| scoring/rules | 解析规则、item_id、veto_items | 用于解析审计产出并映射环节得分 |

### 2.3 输出形式

- SKILL.md 或等效 YAML 配置，与 Cursor/BMAD 技能体系一致
- 引用关系表，与 Architecture §2.2、§10.2 一致
- 位置：`_bmad/` 或项目内约定的 skills 目录；与 `config/code-reviewer-config.yaml`、`scoring/rules/` 路径对齐

---

## 3. 触发时机与 stage 映射（T2）

### 3.1 表 A：BMAD Layer → 阶段

| BMAD Layer | 阶段（stage） |
|------------|----------------|
| Layer 1 产品定义层 | prd, arch |
| Layer 2 Epic/Story 规划层 | epics |
| Layer 3 Story 开发层 | story |
| Layer 4 技术实现层 | specify, plan, gaps, tasks, implement |
| Layer 5 收尾层 | post_impl, pr_review |

### 3.2 表 B：阶段 → 评分环节

| 阶段 | 对应评分环节 | 说明 |
|------|--------------|------|
| prd | 环节 1 | 需求拆解与方案设计 |
| arch | 环节 1 补充、环节 2 设计侧 | |
| epics | 环节 1 输入依据 | 不单独计分 |
| story | 环节 1 补充 | Create Story 审计 |
| specify | 环节 1 | |
| plan | 环节 1 补充、环节 2 设计侧 | |
| gaps | 环节 1 补充（前置）、环节 2–6 后置 | |
| tasks | 环节 2–5 | |
| implement | 环节 2–6 | |
| post_impl | 环节 2–6 | |
| pr_review | 环节 6 补充 | |

### 3.3 触发模式表（Architecture §10.3）

| 事件类型 | 触发方式 | 对应 stage/环节 |
|----------|----------|-----------------|
| stage 审计产出完成 | 自动 | 该 stage 对应环节 |
| Story 状态变更 | 自动（可配置） | 环节 1–6 |
| MR 创建 | 自动（可配置） | 环节 2–6 |
| Epic 待验收 | 手动或自动 | 环节 6、Epic 综合 |
| 用户显式请求「全链路评分」 | 手动 | 全环节 |

### 3.4 验收要求

- 对 prd、arch、story 至少 3 个 stage 验证映射正确（stage → 环节 1–6）
- 触发模式表可文档化或配置化

---

## 4. 审计报告路径约定（T3，AC-3）

### 4.1 prd、arch 阶段审计报告

| stage | 报告路径约定 | 对应 audit-prompts |
|-------|--------------|-------------------|
| prd | 由 code-review prd 模式产出；路径在 config 或文档约定 | audit-prompts-prd.md |
| arch | 由 code-review arch 模式产出；路径在 config 或文档约定 | audit-prompts-arch.md |

说明：prd/arch 审计报告由 code-reviewer 执行 audit-prompts-prd/arch 后产出，其输出路径由 code-reviewer-config 或 bmad 工作流约定；本 Story 在共享配置或文档中写出约定，供 3.2 解析时定位报告文件。

### 4.2 Layer 3 Create Story 审计报告

| stage | 报告路径 | 说明 |
|-------|----------|------|
| story | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md` | Architecture §6、Story 3.2 一致 |

- 文件名格式：`AUDIT_Story_{epic}-{story}.md`
- 示例：Story 3.1 → `AUDIT_Story_3-1.md`
- 目录：`_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`

### 4.3 Layer 4–5 审计报告（speckit §1–§5）

- specify、plan、gaps、tasks、implement、post_impl 阶段审计报告路径由 speckit-workflow、bmad-story-assistant 与 audit-prompts.md §1–§5 约定
- 本 Story 在共享配置中列出 stage 与报告路径的对应关系，供 3.2、3.3 引用

### 4.4 写入位置

- 路径约定写入共享配置（`config/` 或 `scoring/`）或 Story 文档
- 与 Story 3.2 的 AUDIT_Story_{epic}-{story}.md 约定一致

---

## 5. 与 Story 3.2、3.3 的接口契约（T4）

### 5.1 本 Story 向 3.2 提供

| 产出 | 说明 |
|------|------|
| 报告路径约定 | prd/arch 对应 audit-prompts-prd/arch；story 对应 `AUDIT_Story_{epic}-{story}.md` |
| stage → 环节映射 | 给定 stage，确定对应评分环节（1–6），便于 3.2 解析时映射 phase_score、phase_weight |
| 可解析性声明 | 各 stage 对应审计产出的可解析性（Architecture §5 表） |

### 5.2 本 Story 向 3.3 提供

| 产出 | 说明 |
|------|------|
| 编排逻辑 | 触发时机、stage 完成后的调用入口约定 |
| 触发模式表 | 事件类型→触发方式→对应 stage/环节 |
| 协同点 | speckit-workflow、bmad-story-assistant：stage 完成 → 调用全链路 Skill 的「解析并写入」逻辑（Architecture §7.3） |

### 5.3 依赖方向

- Story 3.2 依赖本 Story 的路径约定与 stage 映射
- Story 3.3 依赖本 Story 的编排逻辑、触发模式，以及 3.2 的解析输出

---

## 6. 验收标准映射

| AC | 验收标准 | spec 对应 |
|----|----------|-----------|
| AC-1 | 全链路 Skill 定义存在且可被 BMAD 工作流或 Cursor 引用；声明对 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules 的引用 | §2 |
| AC-2 | 触发时机与 stage 映射文档化或配置化；至少 3 个 stage 验证映射正确 | §3 |
| AC-3 | 各 stage 审计报告路径约定已定义，与 Story 3.2 的 AUDIT_Story_{epic}-{story}.md 一致 | §4 |

---

## 7. PRD 需求追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.12 | 评分规则版本与目录；与 code-reviewer-config 通过 ref 衔接；Skill 编排中声明对 scoring/rules、code-reviewer-config 的引用 |
| REQ-3.15 | Code Reviewer Skill 与需求整合：6 阶段↔六环节、触发时机、维度换算、输出与 scoring 存储衔接；Epic 综合报告六部分结构、触发模式表 |
| REQ-3.16 | 全链路 Code Reviewer Skill 独立与引用关系：引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules；与 speckit-workflow、bmad-story-assistant 协同 |
| REQ-2.1~2.2 | 表 A/表 B 在 Skill 编排中的使用，阶段与评分环节的对应关系 |

---

## 8. 需求映射清单（spec ↔ Story 文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story § 概述 | 定义全链路 Skill、引用关系、触发时机、stage 映射 | spec §1、§2、§3 | ✅ |
| AC-1 | Skill 定义存在、引用声明 | spec §2 | ✅ |
| AC-2 | 触发时机与 stage 映射、≥3 stage 验证 | spec §3 | ✅ |
| AC-3 | 报告路径约定、AUDIT_Story 一致 | spec §4 | ✅ |
| T1 | Skill 标识、引用声明 | spec §2 | ✅ |
| T2 | 触发模式表、stage→环节映射 | spec §3 | ✅ |
| T3 | 报告路径约定 prd/arch/story | spec §4 | ✅ |
| T4 | 与 3.2、3.3 接口契约 | spec §5 | ✅ |
| Scope 包含 | 全链路 Skill 编排、引用、stage 映射表、报告路径 | spec §2–§5 | ✅ |
| Architecture 约束 | 引用关系、触发模式表、6 阶段↔六环节、报告路径 | spec §2.2、§3、§4 | ✅ |
| 与 3.2 契约 | 报告路径、stage 映射、可解析性 | spec §5.1 | ✅ |
| 与 3.3 契约 | 编排逻辑、触发模式、协同点 | spec §5.2 | ✅ |

---

## 审计标记

- [x] **§1.2 spec 审计**：已完成（执行阶段补审）
- 审计依据：audit-prompts.md §1
