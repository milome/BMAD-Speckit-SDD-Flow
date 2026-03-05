# plan-E3-S1：eval-lifecycle-skill-def 实现方案

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.1  
**输入**：spec-E3-S1.md

---

## 1. 目标与约束

- 定义全链路 Skill（bmad-code-reviewer-lifecycle），产出 Skill 描述、stage 映射表、报告路径约定、触发模式表。
- 本 Story 主要为定义与文档产出，无生产代码解析/写入逻辑；Skill 描述须可被 BMAD 工作流或 Cursor 解析。
- 产出须与 Architecture §2、§5、§6、§10 及 Story 3.2、3.3 的接口契约一致。

---

## 2. Skill 描述格式设计

### 2.1 采用 SKILL.md 格式

- 与 Cursor/BMAD 技能体系一致，便于 Agent 或工作流加载
- 位置：`%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md`（全局 skill）或项目内 `skills/`、`_bmad/skills/`

### 2.2 SKILL.md 必备章节

| 章节 | 内容 |
|------|------|
| name | bmad-code-reviewer-lifecycle |
| description | 全链路 Code Reviewer Skill 编排与触发 |
| when_to_use | BMAD 工作流各 stage 审计通过后触发；speckit-workflow、bmad-story-assistant 协同 |
| references | code-reviewer、audit-prompts、code-reviewer-config、scoring/rules 的路径与职责 |

### 2.3 引用关系表

- 在 SKILL.md 或独立文档中列出：引用方、被引用方、引用方式（与 spec §2.2 一致）
- 可选：YAML 配置作为补充（如 `config/eval-lifecycle-skill.yaml`），供脚本或 3.3 读取

---

## 3. stage 映射与触发模式

### 3.1 表 A、表 B 落地形式

| 产出 | 位置 | 格式 |
|------|------|------|
| 表 A（BMAD Layer→阶段） | config/stage-mapping.yaml 或 SKILL.md 内嵌 | YAML 或 Markdown 表格 |
| 表 B（阶段→评分环节） | 同上 | 同上 |
| 触发模式表 | 同上 | 同上 |

### 3.2 可解析性要求

- 若有验收脚本或 3.3 需读取，采用 YAML 便于程序解析
- 若仅文档引用，Markdown 表格即可

### 3.3 验收：至少 3 个 stage 映射验证

- prd、arch、story 三个 stage 的 stage→环节映射可被验收脚本或人工核查验证
- prd→环节 1；arch→环节 1 补充、环节 2 设计侧；story→环节 1 补充

---

## 4. 报告路径约定

### 4.1 共享配置结构

| 路径 | 说明 |
|------|------|
| config/eval-lifecycle-report-paths.yaml | 可选：stage 与报告路径的映射 |
| 或 SKILL.md / Story 文档内章节 | 路径约定写入文档 |

### 4.2 必须约定的路径

| stage | 路径约定 | 说明 |
|-------|----------|------|
| prd | 与 audit-prompts-prd.md 对应；产出路径由 code-reviewer 或 bmad 约定 | spec §4.1 |
| arch | 与 audit-prompts-arch.md 对应；同上 | spec §4.1 |
| story | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md` | spec §4.2，与 3.2 一致 |

### 4.3 Layer 4–5 报告路径

- specify、plan、gaps、tasks、implement、post_impl 由 speckit-workflow、audit-prompts.md §1–§5 约定
- 本 Story 在文档中列出 stage 与路径的对应关系，供 3.2、3.3 引用

---

## 5. 目录与文件布局

| 路径 | 说明 |
|------|------|
| bmad-code-reviewer-lifecycle/SKILL.md | Skill 主描述（全局 skill 或项目 skills） |
| config/stage-mapping.yaml | 表 A、表 B、触发模式表（可选） |
| config/eval-lifecycle-report-paths.yaml | 报告路径约定（可选；也可在 SKILL 或 Story 文档中） |
| _bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def/ | 契约文档、stage 映射表（与 Story 产出同目录） |
| scripts/accept-e3-s1.ts | 验收脚本 AC-1～AC-3 |

---

## 6. 集成测试与端到端测试计划

| 测试类型 | 覆盖 | 验证方式 |
|----------|------|----------|
| 验收脚本 | AC-1：Skill 定义存在、引用声明可解析 | scripts/accept-e3-s1.ts 检查 SKILL.md 或 YAML 存在且含引用 |
| 验收脚本 | AC-2：≥3 stage 映射正确 | 脚本加载 stage-mapping，断言 prd/arch/story→环节映射 |
| 验收脚本 | AC-3：报告路径约定与 AUDIT_Story 一致 | 脚本检查路径约定文档含 AUDIT_Story_{epic}-{story}.md 格式 |
| 集成验证 | 工具链可解析 Skill 描述 | 若 Cursor/BMAD 有解析入口，可运行加载测试 |
| 文档一致性 | 与 Story 3.2、3.3 契约一致 | 人工或脚本比对路径、stage 映射与 3.2、3.3 文档 |

说明：本 Story 主要为文档/配置产出，生产代码关键路径为「Skill 描述被工作流/Agent 加载」；验收以文档存在性、可解析性、约定一致性为主。若有 `scripts/accept-e3-s1.ts`，须覆盖 AC-1～AC-3。

---

## 7. 与 Story 3.2、3.3 的衔接

| 产出 | 3.2 使用 | 3.3 使用 |
|------|----------|----------|
| 报告路径约定 | 解析时定位 prd/arch/story 报告文件 | 触发时传入报告路径 |
| stage→环节映射 | 解析时映射 phase_score、phase_weight | 触发时确定环节 |
| 触发模式表 | — | 实现触发链与协同点 |
| 编排逻辑 | — | 调用解析+写入的入口约定 |

---

## 8. 需求映射清单（plan ↔ spec）

| spec § | 要点 | plan 对应 |
|--------|------|-----------|
| §2 Skill 定义与引用 | 标识、引用声明、输出形式 | §2、§5 |
| §3 触发与 stage 映射 | 表 A、表 B、触发模式表、≥3 stage 验证 | §3、§5 |
| §4 报告路径约定 | prd/arch/story、AUDIT_Story 格式 | §4、§5 |
| §5 接口契约 | 向 3.2、3.3 提供 | §7 |
| AC-1～AC-3 | 全部 | §6、accept-e3-s1 |

---

## 9. 禁止词表合规

本 plan 及后续 GAPS/tasks 禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。

---

## 审计标记

- [x] **§2.2 plan 审计**：已完成（执行阶段补审）
- 审计依据：audit-prompts.md §2
