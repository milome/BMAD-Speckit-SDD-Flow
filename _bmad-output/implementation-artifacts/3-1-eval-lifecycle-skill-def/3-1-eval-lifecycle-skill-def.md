# Story 3.1：eval-lifecycle-skill-def

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.1  
**描述**：定义全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle），引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules，编排逻辑（触发时机、stage 映射、解析规则）

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **全链路 Skill 编排与触发**
   - 定义全链路 Code Reviewer Skill（如 bmad-code-reviewer-lifecycle），作为 BMAD 工作流中可调用的 Skill 入口
   - 引用既有 code-reviewer、audit-prompts、code-reviewer-config 及 scoring/rules，在 Skill 定义中声明依赖与调用关系
   - 编排逻辑：触发时机（在哪些 BMAD 阶段/步骤后触发）、stage 与 Layer/环节的映射关系
   - 解析规则在编排层面的约定：哪些 stage 产出哪些审计报告、报告路径约定（为 Story 3.2、3.3 的解析与写入提供契约）

2. **Skill 与 stage 的映射表**
   - 表 A（BMAD Layer → 阶段）与表 B（阶段 → 评分环节）在本 Skill 中的使用方式；stage 到评分环节的映射在 Skill 定义或配置中可查

### 1.2 本 Story 不包含

- 从审计报告解析出评分记录的具体实现（由 Story 3.2 实现）
- 解析后写入 scoring 存储、与 speckit-workflow/bmad-story-assistant 的协同调用（由 Story 3.3 实现）
- 评分规则 YAML 的具体内容与解析器（由 Story 2.1 实现）
- 一票否决、多次迭代阶梯式扣分（由 Story 4.1 实现）

---

## 2. 验收标准

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 全链路 Skill 定义存在且可被 BMAD 工作流或 Cursor 引用；Skill 中声明对 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules 的引用 | 文档或 Skill 描述文件/目录可被工具链解析，引用关系明确 |
| AC-2 | 触发时机与 stage 映射文档化或配置化：给定 stage，可确定是否触发本 Skill 以及对应的评分环节 | 文档或配置表；验收时对至少 3 个 stage 验证映射正确 |
| AC-3 | 各 stage 对应的审计报告路径或命名约定已定义，供 3.2、3.3 解析与写入使用 | 在 Story 文档或共享配置中写出约定，且与 3.2 的 AUDIT_Story_{epic}-{story}.md 等约定一致 |

---

## 3. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.12~3.17 | 全链路 Code Reviewer Skill、与 BMAD 阶段/环节的编排、触发时机与 stage 映射 |
| REQ-2.1~2.2 | 表 A/表 B 在 Skill 编排中的使用，阶段与评分环节的对应关系 |

---

## 7. 依赖

- **前置 Story**：Story 1.2（eval-system-storage-writer）、Story 2.1（eval-rules-yaml-config）。依赖 1.2 的写入能力与 2.1 的 rules 配置；Skill 编排不实现解析与写入，但约定与 3.2、3.3 的接口。
- 依赖 Architecture 中全链路 Skill、audit-prompts、code-reviewer-config 的组件描述。

---

*本 Story 定义全链路 Skill 编排与触发契约，为 Story 3.2、3.3 的解析与写入提供阶段与报告路径约定。*
