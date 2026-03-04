# Story 3.1：eval-lifecycle-skill-def

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a BMAD 工作流编排者，  
I want 定义全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle）并明确其引用关系、触发时机与 stage 映射，  
so that Story 3.2、3.3 可依此契约实现解析与写入，实现审计→解析→scoring 存储的闭环。

## Acceptance Criteria

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 全链路 Skill 定义存在且可被 BMAD 工作流或 Cursor 引用；Skill 中声明对 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules 的引用 | 文档或 Skill 描述文件/目录可被工具链解析，引用关系明确 |
| AC-2 | 触发时机与 stage 映射文档化或配置化：给定 stage，可确定是否触发本 Skill 以及对应的评分环节 | 文档或配置表；验收时对至少 3 个 stage 验证映射正确 |
| AC-3 | 各 stage 对应的审计报告路径或命名约定已定义，供 Story 3.2、3.3 解析与写入使用 | 在 Story 文档或共享配置中写出约定，且与 Story 3.2 的 AUDIT_Story_{epic}-{story}.md 等约定一致 |

## Tasks / Subtasks

- [x] **T1** 定义全链路 Skill 标识与引用声明（AC: #1）
  - [x] T1.1 确定 Skill 标识为 `bmad-code-reviewer-lifecycle`（或架构文档规定的等效命名）
  - [x] T1.2 在 Skill 描述中显式声明引用：code-reviewer、audit-prompts、code-reviewer-config、scoring/rules
  - [x] T1.3 输出引用关系表或 SKILL.md，与 Architecture §2.2、§10.2 一致
- [x] **T2** 实现触发时机与 stage 映射（AC: #2）
  - [x] T2.1 实现或文档化触发模式表：stage 审计产出完成、Story 状态变更、MR 创建、Epic 待验收、用户显式请求
  - [x] T2.2 实现 stage → 评分环节（1–6）映射，与 Architecture 表 A、表 B 一致
  - [x] T2.3 对 prd、arch、story、implement、post_impl 至少 3 个 stage 验证映射正确
- [x] **T3** 定义各 stage 审计报告路径约定（AC: #3）
  - [x] T3.1 定义 prd、arch 阶段审计报告路径约定（与 audit-prompts-prd/arch 对应）
  - [x] T3.2 定义 Layer 3 Create Story 审计报告路径：`AUDIT_Story_{epic}-{story}.md`
  - [x] T3.3 将路径约定写入共享配置或 Story 文档，供 Story 3.2、3.3 引用
- [x] **T4** 输出与 Story 3.2、3.3 的接口契约（AC: #1,#2,#3）
  - [x] T4.1 文档化「本 Story 产出」：编排逻辑、stage 映射表、报告路径约定
  - [x] T4.2 明确 Story 3.2 依赖：报告路径、命名格式、可解析性声明
  - [x] T4.3 明确 Story 3.3 依赖：触发时机、调用入口约定、与 speckit-workflow/bmad-story-assistant 的协同点

## Scope（范围）

### 本 Story 包含

1. **全链路 Skill 编排与触发**
   - 定义全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle），作为 BMAD 工作流中可调用的 Skill 入口
   - 引用既有 code-reviewer、audit-prompts、code-reviewer-config 及 scoring/rules，在 Skill 定义中声明依赖与调用关系
   - 编排逻辑：触发时机（在哪些 BMAD 阶段/步骤后触发）、stage 与 Layer/环节的映射关系
   - 解析规则在编排层面的约定：哪些 stage 产出哪些审计报告、报告路径约定（为 Story 3.2、3.3 的解析与写入提供契约）

2. **Skill 与 stage 的映射表**
   - 表 A（BMAD Layer → 阶段）与表 B（阶段 → 评分环节）在本 Skill 中的使用方式；stage 到评分环节的映射在 Skill 定义或配置中可查

### 本 Story 不包含

- 从审计报告解析出评分记录的具体实现由 Story 3.2 负责：实现 Layer 1（prd/arch）、Layer 3（story）审计产出的同机解析，从 audit-prompts-prd/arch、Create Story 审计报告提取维度，映射环节 1 检查项。
- 解析后写入 scoring 存储、与 speckit-workflow/bmad-story-assistant 的协同调用由 Story 3.3 负责：全链路 Skill 在 stage 审计通过后调用解析并写入 scoring 存储，与 speckit-workflow、bmad-story-assistant 协同，触发模式表实现。
- 评分规则 YAML 的具体内容与解析器由 Story 2.1 实现。
- 一票否决、多次迭代阶梯式扣分由 Story 4.1 实现。

## PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.12 | 评分规则版本与目录：与 code-reviewer-config 通过 ref 衔接；本 Story 在 Skill 编排中声明对 scoring/rules、code-reviewer-config 的引用 |
| REQ-3.15 | Code Reviewer Skill 与需求整合：6 阶段↔六环节、触发时机、维度换算、输出与 scoring 存储衔接； Epic 综合报告六部分结构、触发模式表 |
| REQ-3.16 | 全链路 Code Reviewer Skill 独立与引用关系：引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules；与 speckit-workflow、bmad-story-assistant 协同 |
| REQ-2.1~2.2 | 表 A/表 B 在 Skill 编排中的使用，阶段与评分环节的对应关系 |

## Architecture 约束

| 组件 | 约束 |
|------|------|
| 全链路 Skill | 编排层：触发时机、stage 映射、解析产出、scoring 写入；引用下层组件；命名 bmad-code-reviewer-lifecycle（或等效） |
| 引用关系 | 按 Architecture §2.2：scoring/rules ref → code-reviewer-config#item_id；全链路 Skill 引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules |
| 触发模式表 | 与 Architecture §10.3、REQUIREMENTS §3.12 一致：stage 审计产出完成→自动；Story 状态变更/MR 创建→自动（可配置）；Epic 待验收→手动或自动；用户显式请求→手动 |
| 6 阶段↔六环节 | 与 Architecture §10.1 一致：需求拆解与方案设计 20、代码开发 25、测试保障 25、Bug 修复 15、跨模块集成 10、Story 交付验收 5 |
| 报告路径 | Layer 1–3 同机解析：prd/arch 对应 audit-prompts-prd/arch；story 对应 AUDIT_Story_{epic}-{story}.md（Architecture §6） |

## 与 Story 3.2、3.3 的接口契约

### 本 Story 向 3.2 提供

- **报告路径约定**：prd/arch 阶段审计报告路径（与 audit-prompts-prd.md、audit-prompts-arch.md 对应）；Layer 3 Create Story 审计报告路径 `AUDIT_Story_{epic}-{story}.md`。
- **stage → 环节映射**：给定 stage，可确定对应评分环节（1–6），便于 3.2 解析时映射 phase_score、phase_weight。
- **可解析性声明**：各 stage 对应审计产出的可解析性（Architecture §5 表）。

### 本 Story 向 3.3 提供

- **编排逻辑**：触发时机、stage 完成后的调用入口约定。
- **触发模式表**：事件类型→触发方式→对应 stage/环节，供 3.3 实现「解析并写入」的触发链。
- **与 speckit-workflow、bmad-story-assistant 协同点**：stage 完成 → 调用全链路 Skill 的「解析并写入」逻辑（Architecture §7.3）。

### 依赖方向

- Story 3.2 依赖本 Story 的路径约定与 stage 映射。
- Story 3.3 依赖本 Story 的编排逻辑、触发模式、以及 3.2 的解析输出。

## Dev Notes

- **技术栈**：本 Story 主要为定义与文档产出；Skill 描述可采用 SKILL.md 或 YAML 配置格式，与 Cursor/BMAD 技能体系一致。
- **源树组件**：`_bmad/`、`config/`、`scoring/rules/` 的引用路径须与 Architecture 一致；新增 Skill 描述文件位置需与 BMAD 技能目录约定一致。
- **测试标准**：验收以文档可解析性、至少 3 个 stage 映射验证为主；若有自动化校验脚本，可纳入验收。

### Project Structure Notes

- Skill 描述建议位于 `_bmad/` 或项目内约定的 skills 目录；与 `docs/BMAD/`、`config/code-reviewer-config.yaml` 路径对齐。
- 共享配置（如 stage 映射表）可置于 `scoring/` 或 `config/` 下，供 3.2、3.3 读取。

### References

- [Source: _bmad-output/planning-artifacts/dev/architecture.ai-code-eval-system.md#10]
- [Source: docs/BMAD/REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md#3.12, #3.13]
- [Source: _bmad-output/planning-artifacts/dev/epics.md]
- [Source: _bmad-output/implementation-artifacts/3-2-eval-layer1-3-parser/3-2-eval-layer1-3-parser.md]
- [Source: _bmad-output/implementation-artifacts/3-3-eval-skill-scoring-write/3-3-eval-skill-scoring-write.md]

## 依赖

- **前置 Story**：Story 1.2（eval-system-storage-writer）、Story 2.1（eval-rules-yaml-config）。依赖 1.2 的写入能力与 2.1 的 rules 配置；Skill 编排不实现解析与写入，但约定与 Story 3.2、3.3 的接口。
- **Architecture**：依赖全链路 Skill、audit-prompts、code-reviewer-config 的组件描述（Architecture §2、§10）。

---

*本 Story 定义全链路 Skill 编排与触发契约，为 Story 3.2、3.3 的解析与写入提供阶段与报告路径约定。*

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
