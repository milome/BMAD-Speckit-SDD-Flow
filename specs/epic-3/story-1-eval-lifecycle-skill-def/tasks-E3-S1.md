# tasks-E3-S1：eval-lifecycle-skill-def 任务列表

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.1  
**来源**：plan-E3-S1.md、IMPLEMENTATION_GAPS-E3-S1.md、Story 3.1

---

## Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止用「预留」「占位」等词规避实现
4. ❌ 禁止报告路径约定与 Story 3.2 的 AUDIT_Story 格式不一致

**必须事项**:
1. ✅ 必须运行验证命令确认 AC-1～AC-3
2. ✅ 遇到无法完成的情况，应报告阻塞
3. ✅ 实施前必须先检索并阅读 spec §2～§5、Architecture §2/§5/§6/§10
4. ✅ 需求追溯：T1～T4 与 Story 任务、Gaps 逐一对应

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 3.1 | T1 | 定义全链路 Skill 标识与引用声明（AC-1） |
| T2 | Story 3.1 | T2 | 实现触发时机与 stage 映射（AC-2） |
| T3 | Story 3.1 | T3 | 定义各 stage 审计报告路径约定（AC-3） |
| T4 | Story 3.1 | T4 | 输出与 Story 3.2、3.3 的接口契约 |
| T5 | plan §6 | 验收脚本 | scripts/accept-e3-s1.ts 覆盖 AC-1～AC-3 |

---

## Gaps → 任务映射

| Gap ID | 本任务表行 | 对应任务 |
|--------|------------|----------|
| GAP-1.1、GAP-1.2、GAP-AC1 | ✓ 有 | T1 |
| GAP-2.1、GAP-2.2、GAP-2.3、GAP-AC2 | ✓ 有 | T2 |
| GAP-3.1、GAP-3.2、GAP-3.3、GAP-AC3 | ✓ 有 | T3 |
| GAP-4.1 | ✓ 有 | T4 |
| GAP-5.1 | ✓ 有 | T5 |

---

## 任务列表

### T1：定义全链路 Skill 标识与引用声明（AC-1）

**产出物**：bmad-code-reviewer-lifecycle/SKILL.md（全局 `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\` 或项目 skills），含 name、description、references；引用关系表与 Architecture §2.2、§10.2 一致

**验收标准**：
- Skill 标识为 bmad-code-reviewer-lifecycle
- 显式声明引用：code-reviewer、audit-prompts、code-reviewer-config、scoring/rules
- 文件可被工具链解析（如 Cursor 技能目录加载）
- 引用关系表或 SKILL 内章节与 Architecture §2.2、§10.2 一致

**验证命令**：
```bash
# 全局 skill 路径；~/.cursor/skills/（Unix）或 %USERPROFILE%\.cursor\skills\（Windows）
SKILL_PATH="$HOME/.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md"
test -f "$SKILL_PATH" || SKILL_PATH="${USERPROFILE:-$HOME}/.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md"
test -f "$SKILL_PATH" && grep -E "code-reviewer|audit-prompts|code-reviewer-config|scoring/rules" "$SKILL_PATH" | head -5
```

---

- [x] **T1.1** 创建 bmad-code-reviewer-lifecycle/ 目录（全局 skill 或项目 skills）
- [x] **T1.2** 创建 SKILL.md，含 name: bmad-code-reviewer-lifecycle、description、when_to_use
- [x] **T1.3** 在 SKILL 中显式声明引用：code-reviewer、audit-prompts、code-reviewer-config、scoring/rules
- [x] **T1.4** 输出引用关系表（SKILL 内嵌或独立文档），与 Architecture §2.2、§10.2 一致

---

### T2：实现触发时机与 stage 映射（AC-2）

**产出物**：config/stage-mapping.yaml（或 SKILL 内嵌），含表 A（BMAD Layer→阶段）、表 B（阶段→评分环节）、触发模式表；至少 prd、arch、story 三个 stage 的映射可验证

**验收标准**：
- 表 A 含 prd、arch、epics、story、specify、plan、gaps、tasks、implement、post_impl、pr_review
- 表 B 含 stage→环节 1–6 映射；prd→环节 1；arch→环节 1 补充、环节 2 设计侧；story→环节 1 补充
- 触发模式表含：stage 审计产出完成→自动；Story 状态变更/MR 创建→自动（可配置）；Epic 待验收→手动或自动；用户显式请求→手动
- 验收脚本或人工可验证 prd、arch、story 映射正确

**验证命令**：
```bash
test -f config/stage-mapping.yaml && grep -E "prd|arch|story" config/stage-mapping.yaml | head -6
```

---

- [x] **T2.1** 创建 config/stage-mapping.yaml，含表 A（BMAD Layer→阶段）
- [x] **T2.2** 在 stage-mapping.yaml 中含表 B（阶段→评分环节），与 Architecture §4 一致
- [x] **T2.3** 在 stage-mapping.yaml 中含触发模式表，与 Architecture §10.3 一致
- [x] **T2.4** 确保 prd、arch、story 的 stage→环节映射可被验收脚本加载并断言

---

### T3：定义各 stage 审计报告路径约定（AC-3）

**产出物**：config/eval-lifecycle-report-paths.yaml 或 _bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/ 下文档，约定 prd/arch/story 报告路径；story 对应 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`

**验收标准**：
- prd、arch 阶段报告路径与 audit-prompts-prd/arch 对应
- Layer 3 story 报告路径为 `AUDIT_Story_{epic}-{story}.md`，与 Story 3.2 一致
- 路径约定写入共享配置或 Story 产出目录，供 3.2、3.3 引用

**验证命令**：
```bash
grep -E "AUDIT_Story|audit-prompts" config/eval-lifecycle-report-paths.yaml 2>/dev/null || grep -E "AUDIT_Story|audit-prompts" _bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/*.md 2>/dev/null | head -5
```

---

- [x] **T3.1** 定义 prd、arch 阶段审计报告路径约定（与 audit-prompts-prd.md、audit-prompts-arch.md 对应）
- [x] **T3.2** 定义 Layer 3 Create Story 审计报告路径：`AUDIT_Story_{epic}-{story}.md`，目录 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`
- [x] **T3.3** 将路径约定写入 config/eval-lifecycle-report-paths.yaml 或 3-1 产出目录下的共享文档

---

### T4：输出与 Story 3.2、3.3 的接口契约（AC-1,#2,#3）

**产出物**：_bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md（或等效），文档化本 Story 产出、3.2 依赖、3.3 依赖

**验收标准**：
- 文档化「本 Story 产出」：编排逻辑、stage 映射表、报告路径约定
- 明确 Story 3.2 依赖：报告路径、命名格式、可解析性声明
- 明确 Story 3.3 依赖：触发时机、调用入口约定、与 speckit-workflow/bmad-story-assistant 的协同点

**验证命令**：
```bash
test -f _bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md && grep -E "3\.2|3\.3|报告路径|触发" _bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md | head -5
```

---

- [x] **T4.1** 文档化本 Story 产出：编排逻辑、stage 映射表、报告路径约定
- [x] **T4.2** 明确 Story 3.2 依赖：报告路径、命名格式、可解析性声明
- [x] **T4.3** 明确 Story 3.3 依赖：触发时机、调用入口约定、与 speckit-workflow/bmad-story-assistant 的协同点

---

### T5：编写 scripts/accept-e3-s1.ts 验收脚本

**产出物**：scripts/accept-e3-s1.ts

**验收标准**：
- AC-1：Skill 定义存在且含引用声明（code-reviewer、audit-prompts、code-reviewer-config、scoring/rules）
- AC-2：stage 映射表存在且 prd/arch/story→环节映射正确
- AC-3：报告路径约定含 AUDIT_Story_{epic}-{story}.md 格式
- 运行 `npx ts-node scripts/accept-e3-s1.ts` 全部 PASS

**验证命令**：
```bash
npx ts-node scripts/accept-e3-s1.ts
```

---

- [x] **T5.1** [TDD-RED] 编写 accept-e3-s1.ts 骨架，覆盖 AC-1～AC-3 检查逻辑，运行确认失败（文件不存在时）
- [x] **T5.2** [TDD-GREEN] 完成 T1～T4 产出后，运行脚本确认 PASS
- [x] **T5.3** [TDD-REFACTOR] 优化脚本结构，确保可维护

---

## 验收汇总

**运行验收**：`npx ts-node scripts/accept-e3-s1.ts` 或 `npm run accept:e3-s1`（若已配置）

**产出路径**：
- bmad-code-reviewer-lifecycle/SKILL.md（全局 %USERPROFILE%\.cursor\skills\ 或项目 skills）
- config/stage-mapping.yaml
- config/eval-lifecycle-report-paths.yaml（或 3-1 产出目录下等效）
- _bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md
- scripts/accept-e3-s1.ts

---

## 审计标记

- [x] **§4.2 tasks 审计**：已完成（执行阶段补审）
- 审计依据：audit-prompts.md §4
