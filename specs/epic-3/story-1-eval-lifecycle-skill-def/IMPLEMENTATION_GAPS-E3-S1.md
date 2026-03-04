# IMPLEMENTATION_GAPS-E3-S1：eval-lifecycle-skill-def

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.1  
**输入**：plan-E3-S1.md、当前代码库 _bmad/、config/、Story 3.1

---

## 1. 现状摘要

- **已有**：Architecture 文档定义全链路 Skill 概念、表 A/B、触发模式表、报告路径（AUDIT_Story_{epic}-{story}.md）；Story 3.2、3.3 文档描述对 3.1 的依赖；config/code-reviewer-config.yaml、scoring/rules/ 存在；spec、plan 已产出。
- **缺失**：bmad-code-reviewer-lifecycle 的 Skill 描述文件（SKILL.md 或等效）；stage 映射表（表 A、表 B）的落地配置/文档；触发模式表的落地；报告路径约定的共享配置或文档；与 3.2、3.3 的接口契约文档；验收脚本 accept-e3-s1.ts；≥3 stage 映射验证。

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §2 / T1 | GAP-1.1 | Skill 标识 bmad-code-reviewer-lifecycle、引用声明（code-reviewer、audit-prompts、code-reviewer-config、scoring/rules） | 未实现 | 无 _bmad/skills/bmad-code-reviewer-lifecycle/SKILL.md 或等效；引用关系未在 Skill 中显式声明 |
| spec §2 / T1 | GAP-1.2 | 引用关系表或 SKILL.md 与 Architecture §2.2、§10.2 一致 | 未实现 | 无引用关系表产出 |
| spec §3 / T2 | GAP-2.1 | 表 A（BMAD Layer→阶段）、表 B（阶段→评分环节）落地 | 未实现 | 表 A、表 B 仅在 Architecture 文档中，无 config/stage-mapping.yaml 或 SKILL 内嵌 |
| spec §3 / T2 | GAP-2.2 | 触发模式表落地（stage 审计产出完成、Story 状态变更、MR 创建、Epic 待验收、用户显式请求） | 未实现 | 触发模式表仅在 Architecture §10.3，无落地配置 |
| spec §3 / T2 | GAP-2.3 | 至少 3 个 stage（prd、arch、story）映射验证 | 未实现 | 无验收脚本或验证逻辑 |
| spec §4 / T3 | GAP-3.1 | prd、arch 阶段审计报告路径约定（与 audit-prompts-prd/arch 对应） | 未实现 | 路径约定未写入共享配置或文档 |
| spec §4 / T3 | GAP-3.2 | Layer 3 Create Story 审计报告路径 AUDIT_Story_{epic}-{story}.md | 未实现 | 路径格式在 Architecture/Story 中提及，但未在 3.1 产出的共享配置/文档中正式约定 |
| spec §4 / T3 | GAP-3.3 | 路径约定写入共享配置或 Story 文档，供 3.2、3.3 引用 | 未实现 | 无 config/eval-lifecycle-report-paths.yaml 或等效 |
| spec §5 / T4 | GAP-4.1 | 与 3.2、3.3 的接口契约文档（编排逻辑、stage 映射表、报告路径、触发模式、协同点） | 未实现 | 无正式契约文档产出 |
| plan §6 | GAP-5.1 | 验收脚本 scripts/accept-e3-s1.ts 覆盖 AC-1～AC-3 | 未实现 | 脚本不存在 |
| AC-1 | GAP-AC1 | Skill 定义存在且可被工具链解析；引用声明 | 未实现 | 见 GAP-1.1、GAP-1.2 |
| AC-2 | GAP-AC2 | 触发时机与 stage 映射；≥3 stage 验证 | 未实现 | 见 GAP-2.1、GAP-2.2、GAP-2.3 |
| AC-3 | GAP-AC3 | 报告路径约定与 Story 3.2 的 AUDIT_Story 一致 | 未实现 | 见 GAP-3.1、GAP-3.2、GAP-3.3 |

---

## 3. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §2 | GAP-1.1、GAP-1.2、GAP-AC1 | ✓ 有 | T1 |
| spec §3 | GAP-2.1、GAP-2.2、GAP-2.3、GAP-AC2 | ✓ 有 | T2 |
| spec §4 | GAP-3.1、GAP-3.2、GAP-3.3、GAP-AC3 | ✓ 有 | T3 |
| spec §5 | GAP-4.1 | ✓ 有 | T4 |
| plan §6 | GAP-5.1 | ✓ 有 | T5（验收脚本） |

---

## 4. 与 plan 的对应关系

- **GAP-1.x**：创建 _bmad/skills/bmad-code-reviewer-lifecycle/SKILL.md（或项目约定 skills 目录），含 name、description、references；引用关系表与 Architecture §2.2、§10.2 一致。
- **GAP-2.x**：创建 config/stage-mapping.yaml（或 SKILL 内嵌）含表 A、表 B、触发模式表；验收脚本验证 prd/arch/story→环节映射。
- **GAP-3.x**：创建 config/eval-lifecycle-report-paths.yaml 或等同文档，约定 prd/arch 报告路径、story 对应 AUDIT_Story_{epic}-{story}.md。
- **GAP-4.1**：在 _bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/ 产出接口契约文档，明确向 3.2、3.3 提供的内容。
- **GAP-5.1**：创建 scripts/accept-e3-s1.ts，覆盖 AC-1～AC-3。

---

## 5. 非差距（无需本 Story 实现）

- 审计报告解析（Story 3.2）；解析后写入 scoring 存储、触发链实现（Story 3.3）；评分规则 YAML 内容（Story 2.1）；一票否决、阶梯扣分（Story 4.1）。Architecture、Story 3.2、3.3 文档已存在，本 Story 不修改。

---

## 6. 闭合条件

- bmad-code-reviewer-lifecycle SKILL.md 存在且含引用声明；stage 映射表、触发模式表、报告路径约定已落地；与 3.2、3.3 的接口契约文档已产出；scripts/accept-e3-s1.ts 存在且 AC-1～AC-3 全部通过。

---

## 审计标记

- [x] **§3.2 GAPS 审计**：已完成（执行阶段补审）
- 审计依据：audit-prompts.md §3
