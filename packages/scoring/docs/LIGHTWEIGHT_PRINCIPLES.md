# 轻量化三原则

与 REQUIREMENTS §1.5、Story 4.3 一致；确保评分体系**增强**而非拖沓真实开发流程。

---

## 1. 三原则释义

| 原则 | 释义 | 可验证检查项 |
|------|------|--------------|
| **同机执行** | 评分写入与各阶段审计同机执行；审计通过即从既有审计报告与验收表解析并写入；无额外人工填写、无新增必填表单 | 无新增必填表单；解析逻辑从既有 audit 报告路径读取 |
| **按配置启用** | 全体系评分可按项目或按运行配置关闭；未启用时，各阶段迭代结束标准与现有 BMAD+Speckit 完全一致，无任何新增步骤 | config/scoring-trigger-modes.yaml 或等效支持「关闭评分」；未启用时无解析/写入步骤 |
| **最小侵入** | 不修改现有审计闭环的输入输出格式；仅增加「解析既有产出并写入评分存储」的配置化后置步骤；现有 progress、artifacts、_bmad-output 结构保持不变 | 无修改 audit-prompts 输出格式；parseAndWriteScore 为后置步骤；progress/artifacts 结构不变 |

---

## 2. 按配置关闭评分的实现方式

**config/scoring-trigger-modes.yaml**（Story 3.3 产出）为触发模式表，定义各事件（如 stage_audit_complete）下 real_dev、eval_question 的默认 writeMode。

**关闭评分的逻辑**：

- **不调用 parseAndWriteScore**：调用方（如 speckit-workflow、bmad-story-assistant、全链路 Skill）按项目配置决定是否在 stage 审计通过后调用 parseAndWriteScore。若不调用，则无解析与写入，评分完全关闭。
- **环境变量或项目配置**：可在 `config/coach-trigger.yaml` 或项目级配置中增加 `scoring_enabled: false`；全链路 Skill 或工作流读取后跳过 parseAndWriteScore 调用。
- **结果**：未启用时，各阶段迭代结束标准与现有 BMAD+Speckit 完全一致，无任何新增步骤。
