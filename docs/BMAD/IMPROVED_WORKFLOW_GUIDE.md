# Speckit 改进后流程指南

本文档说明 Speckit 改进后的正确执行顺序、审计要求、自检命令与状态文件约定，便于开发者按步骤执行并避免常见错误。

---

## 1. 正确流程概览

完整流程必须按以下顺序执行，**每一阶段必须经 code-review 审计通过后才能进入下一阶段**：

```
constitution（宪章/约定）
    → specify（需求规格）
    → plan（计划）
    → GAPS（实现缺口 / IMPLEMENTATION_GAPS）
    → tasks（任务列表）
    → 执行（implement）
```

### 各阶段要点

| 阶段 | 产出物 | 审计要求 |
|------|--------|----------|
| **constitution** | 项目/Epic 约定、规范 | 审计通过后再进入 specify |
| **specify** | spec-E{Epic}-S{Story}.md | 审计通过后再进入 plan |
| **plan** | plan-E{Epic}-S{Story}.md | 审计通过后再进入 GAPS |
| **gaps** | IMPLEMENTATION_GAPS-E{Epic}-S{Story}.md | 审计通过后再进入 tasks |
| **tasks** | tasks-E{Epic}-S{Story}.md | 审计通过后再进入 implement |
| **implement** | 代码与测试 | 实施后审计 |

**铁律**：不得跳过 plan、GAPS、tasks 或审计步骤；不得在「只写完 spec」的情况下直接按 ralph-method 或其它方式执行开发。

---

## 2. 错误示例（Before）

以下做法均为**错误**，会导致需求与实现脱节、任务边界不清、审计缺失：

- **只写 spec 就按 ralph-method 执行**  
  未生成 plan、IMPLEMENTATION_GAPS、tasks，直接分解或开发，违反 speckit 完整流程。

- **跳过 plan / GAPS / tasks**  
  未产出 plan.md、IMPLEMENTATION_GAPS.md、tasks.md，缺少设计与任务拆解，无法做阶段审计。

- **跳过审计**  
  各阶段文档未经 code-reviewer 审计即进入下一阶段，无法保证「完全覆盖、验证通过」。

- **未运行自检脚本**  
  进入执行阶段前未运行 `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py`，可能遗漏缺失文档或未通过审计的文档。

正确做法见下一节。

---

## 3. 正确示例（After）

### 3.1 按完整 Speckit 流程执行

1. **constitution**：完成宪章/约定，审计通过。
2. **specify**：编写 spec-E{Epic}-S{Story}.md，审计通过（含审计标记）。
3. **plan**：编写 plan-E{Epic}-S{Story}.md，审计通过。
4. **GAPS**：编写 IMPLEMENTATION_GAPS-E{Epic}-S{Story}.md，审计通过。
5. **tasks**：编写 tasks-E{Epic}-S{Story}.md，审计通过。
6. **执行前自检**：运行 `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py`，确认四类文档存在且均已审计通过。
7. **implement**：按 tasks 执行开发（建议 TDD 红绿灯模式），实施后进行实施后审计。

### 3.2 执行前自检

在进入「执行」阶段前，必须运行自检脚本，确保 spec、plan、GAPS、tasks 均存在且包含审计通过标记。

**自检命令示例**（Epic 4、Story 1）：

```bash
python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic 4 --story 1
```

指定项目根目录时：

```bash
python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic 4 --story 1 --project-root /path/to/project
```

- **退出码 0**：所有前置条件满足，可以继续执行。
- **退出码 1**：存在文档缺失或未通过审计，需先完成对应阶段并审计通过后再执行。

---

## 4. 状态文件说明

状态文件用于记录当前 Story 所处阶段与各阶段审计状态，便于恢复与审计追踪。模板路径：

**`_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`**

使用方式：复制该模板为 `.speckit-state.yaml`（或项目约定的状态文件名），按当前 Story 与阶段填写。

### 4.1 主要字段说明

| 字段 | 用途 |
|------|------|
| **story_id** | 当前执行的 Story 编号，格式为 `"Epic-Story"`，例如 `"4-1"` 表示 Epic 4 的 Story 1。 |
| **current_phase** | 当前所处阶段。可选值：`constitution`、`specify`、`plan`、`gaps`、`tasks`、`implement`。 |
| **completed_phases** | 已完成的阶段列表（与 current_phase 可选值一致），用于记录流程进度与恢复。 |
| **audit_status** | 各阶段的审计状态。key 为阶段名，value 为 `PASSED` 或 `PENDING`。未列出的阶段视为 PENDING。 |
| **last_updated** | 状态文件最后更新时间，建议使用 ISO8601 格式（带时区），例如 `2026-03-03T10:00:00+08:00`。 |

通过维护该文件，可明确当前处于哪一阶段、哪些阶段已审计通过，避免跳过阶段或遗漏审计。

---

## 5. 审计标记约定

各阶段文档在通过 code-review 审计后，**必须在文档中保留可被识别的审计通过标记**，以便自检脚本与人工检查确认。

### 5.1 支持的标记形式

以下两种形式均可（自检脚本会识别）：

1. **HTML 注释格式**  
   ```html
   <!-- AUDIT: PASSED by code-reviewer -->
   ```

2. **中文结论格式**  
   ```text
   结论：完全覆盖、验证通过
   ```

### 5.2 使用建议

- 在文档末尾或「审计结论」小节中保留上述任一标记。
- 审计未通过时不要添加或保留 PASSED/完全覆盖 标记；通过后再更新文档并写入标记。
- 自检脚本 `check_speckit_prerequisites.py` 会检查 spec、plan、GAPS、tasks 四类文档是否包含上述标记，未包含则视为未通过审计。

---

## 6. 小结

- **正确流程**：constitution → specify → plan → GAPS → tasks → 执行；每阶段 code-review 审计通过后再进入下一阶段。
- **错误示例**：只写 spec 就按 ralph-method 执行、跳过 plan/GAPS/tasks/审计。
- **正确示例**：按完整 speckit 流程执行，并在执行前运行 `python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic <Epic> --story <Story>` 进行自检。
- **状态文件**：参考 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`，维护 `story_id`、`current_phase`、`audit_status`、`last_updated`（及 `completed_phases`）以追踪阶段与审计状态。
- **审计标记**：文档通过审计后须包含 `<!-- AUDIT: PASSED by code-reviewer -->` 或 `结论：完全覆盖、验证通过`，以便自动化与人工核查。

遵循本指南可保证需求→设计→任务→实现链路完整、可审计、可复现。
