# Story 3.1 与 Story 3.2、3.3 的接口契约

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.1  
**产出**：本 Story 定义的编排逻辑、stage 映射表、报告路径约定，供 3.2、3.3 依赖

---

## 1. 本 Story 产出

| 产出 | 路径/说明 |
|------|------------|
| Skill 描述 | _bmad/skills/bmad-code-reviewer-lifecycle/SKILL.md |
| 表 A（BMAD Layer→阶段） | config/stage-mapping.yaml |
| 表 B（阶段→评分环节） | config/stage-mapping.yaml |
| 触发模式表 | config/stage-mapping.yaml |
| 报告路径约定 | config/eval-lifecycle-report-paths.yaml |
| 引用关系 | SKILL.md、Architecture §2.2、§10.2 |
| 编排逻辑 | stage 审计通过 → 调用全链路 Skill 的「解析并写入」逻辑（Architecture §7.3） |

---

## 2. Story 3.2 依赖

| 依赖项 | 说明 | 路径/格式 |
|--------|------|-----------|
| 报告路径约定 | prd/arch 对应 audit-prompts-prd/arch；story 对应 AUDIT_Story_{epic}-{story}.md | config/eval-lifecycle-report-paths.yaml |
| stage→环节映射 | 给定 stage，可确定对应评分环节（1–6），便于解析时映射 phase_score、phase_weight | config/stage-mapping.yaml stage_to_phase |
| 可解析性声明 | 各 stage 对应审计产出的可解析性（Architecture §5 表） | Architecture §5；prd/arch/story 可解析 |
| story 报告路径 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md` | 与 3.2 约定一致 |

---

## 3. Story 3.3 依赖

| 依赖项 | 说明 | 路径/格式 |
|--------|------|-----------|
| 编排逻辑 | 触发时机、stage 完成后的调用入口约定 | Architecture §7.3；stage 完成 → 解析并写入 |
| 触发模式表 | 事件类型→触发方式→对应 stage/环节 | config/stage-mapping.yaml trigger_modes |
| 协同点 | speckit-workflow、bmad-story-assistant | stage 完成 → 调用全链路 Skill 的「解析并写入」 |
| 报告路径 | 触发时传入报告路径，供 3.2 解析 | 同 3.2 |
| 依赖 3.2 | 3.3 调用 3.2 的解析输出，写入 scoring 存储 | 3.2 解析器产出 |

---

## 4. 依赖方向

- **Story 3.2** 依赖本 Story 的路径约定与 stage 映射。
- **Story 3.3** 依赖本 Story 的编排逻辑、触发模式，以及 3.2 的解析输出。
