# 实施后审计提示词（§5）

当用户要求对**实施完成后的结果**（代码、prd、progress）审计时使用。被审对象为实现产物，非文档。

## 与文档审计的区别

| 维度 | 文档审计 (§4/TASKS 适配) | 实施后审计 (§5) |
|------|--------------------------|-----------------|
| 被审对象 | TASKS_*.md、tasks-E*.md | 代码、prd、progress |
| 发现 gap 时 | 审计子代理直接修改文档 | 实施子代理修改代码 |
| 收敛规则 | audit-document-iteration-rules | audit-post-impl-rules |

## 提示词来源

完整 §5 提示词见：`.codex/skills/speckit-workflow/references/audit-prompts.md` 第 5 节。

核心审计项：任务真正实现、生产代码在关键路径、实现与测试覆盖、验收已执行、ralph-method 遵守、无延迟表述。
