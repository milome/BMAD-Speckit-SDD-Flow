---
name: bmad-standalone-tasks-doc-review
description: |
  Strict audit for TASKS/TASKS-like documents (TASKS_*.md, tasks-E*.md) with 批判审计员 >70%, 3-round no-gap convergence, and audit subagent directly modifying the document when gaps are found. Use when: (1) User requests audit of a TASKS document with strict convergence, (2) "对 {文档路径} 发起审计子任务" or "TASKS 文档审计", (3) Pre-implementation document quality gate. Supports code-reviewer (Cursor Task) or mcp_task generalPurpose fallback. Follows audit-document-iteration-rules.
---

# BMAD Standalone Tasks 文档审计

对 TASKS_*.md、tasks-E*.md 等任务文档发起严格审计，要求批判审计员 >70%、连续 3 轮无 gap 收敛，审计子代理在发现 gap 时直接修改被审文档。

**Orphan TASKS doc-review closeout contract**：当被审文档位于 `_orphan/` 路径时，结构化审计报告必须显式提供 `stage=standalone_tasks`、`artifactDocPath`、`reportPath`。缺失任一字段、仍返回 `stage=document`、或仅写 PASS 文本时，不得视为 authoritative closeout。

## 适用场景

- 用户指定文档路径并要求发起审计子任务
- TASKS 文档实施前的质量门控
- 需「完全覆盖、验证通过」且 3 轮无 gap 收敛的文档审计

## 主 Agent 编排面（强制）

交互模式下，本 skill 必须以 repo-native `main-agent-orchestration` 作为唯一编排权威。`runAuditorHost` 只负责审计后的 close-out，不能替代主 Agent 的下一步分支决策。

在发起任何审计子任务、修复子任务或其他 bounded execution 前，主 Agent 必须：

1. 执行 `npm run main-agent-orchestration -- --cwd {project-root} --action inspect`
2. 读取 `orchestrationState`、`pendingPacketStatus`、`pendingPacket`、`continueDecision`、`mainAgentNextAction`、`mainAgentReady`
3. 若下一分支可派发但尚无可用 packet，执行 `npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan`
4. 仅依据返回的 packet / instruction 派发子代理，不得只凭审计 prose 或 doc-review 结论继续推进
5. 每次子代理返回后，以及每次 `runAuditorHost` 收口后，都再次 `inspect`，再决定下一全局分支

`mainAgentNextAction / mainAgentReady` 仅为 compatibility summary；真正权威状态始终是 `orchestrationState + pendingPacket + continueDecision`。

## 强制约束

| 约束 | 说明 |
|------|------|
| 批判审计员 | 必须出场，发言占比 **>70%** |
| 收敛条件 | **连续 3 轮无 gap**（针对被审文档） |
| 发现 gap 时 | **审计子代理须在本轮内直接修改被审文档**，禁止仅输出建议 |
| 子代理类型 | 优先 code-reviewer；若无效则 mcp_task generalPurpose |

## 工作流

1. **解析文档路径**：从用户输入获取 `{文档路径}`（如 `_bmad-output/implementation-artifacts/_orphan/TASKS_xxx.md`）
2. **确定需求依据**：若 TASKS 文档头部有「参考」字段，读取该文档作为需求依据；否则以 TASKS 自身为自洽依据（此时 `{需求依据路径}` 填被审文档路径）
3. **发起审计**：将 [references/audit-prompt-tasks-doc.md](references/audit-prompt-tasks-doc.md) 完整 prompt 复制，替换 `{文档路径}`、`{需求依据路径}`、`{项目根}`、`{报告路径}`、`{轮次}`；**报告保存部分须为「每轮报告（无论通过与否）均须保存至 {报告路径}」**，与步骤 7 一致（若模板为「审计通过时」则须覆盖）
4. **子代理选择**：优先 Cursor Task 调度 code-reviewer；若 code-reviewer 不可用（如 Cursor Task 不存在、调用失败或超时），使用 `mcp_task` + `subagent_type: generalPurpose`
5. **收敛检查**：收到报告后，若结论「通过」且批判审计员注明「本轮无新 gap」→ `consecutive_pass_count + 1`；若「未通过」或存在 gap → 置 0。**通过判定**：报告结论含「完全覆盖、验证通过」或「通过」；批判审计员段落含「本轮无新 gap」「无新 gap」或「无 gap」。
6. **迭代**：未达 3 轮无 gap 时，发起下一轮审计（审计上一轮修改后的文档）。**禁止死循环**：`consecutive_pass_count >= 3` 时**立即结束**，不再发起审计；**最大轮次上限 10 轮**，超过则强制结束并输出「已达最大轮次，请人工检查」。
7. **报告落盘**：每轮报告（无论通过与否）均须保存至 `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_{slug}_§4_round{N}.md`；主 Agent 发起审计时须在 prompt 中明确此要求。**注意**：报告保存是子代理职责，主 Agent 收到报告后**仅做收敛检查**，通过则结束，未通过则发起下一轮；**不得**因「保存报告」而重复发起审计。

## 引用

- **audit-document-iteration-rules**：`.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md`
- **audit-prompts §4**：`.cursor/skills/speckit-workflow/references/audit-prompts.md` §4（主流程 TASKS 文档审计）
- **audit-prompts §5**：`.cursor/skills/speckit-workflow/references/audit-prompts.md` §5（模式 B 实施后审计）
- **audit-prompts-critical-auditor-appendix**：`.cursor/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
- **audit-post-impl-rules**：`.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`（模式 B 收敛规则）

## 可解析评分块（强制）

主流程（TASKS 文档审计）报告结尾须含：

```markdown
## 可解析评分块（供 parseAndWriteScore）
总体评级: [A|B|C|D]
维度评分:
- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

模式 B（实施后审计）的可解析评分块维度见 audit-prompts §5.1（功能性、代码质量、测试覆盖、安全性），与主流程四维不同。

## 模式 B：实施后审计（§5）

当用户要求对**实施完成后的结果**（代码、prd、progress）审计时，使用 audit-prompts §5。此时：
- 被审对象为代码/实现，非文档
- 发现 gap 时由**实施子代理**修改代码，非审计子代理
- 收敛规则见 `.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`

详见 [references/audit-prompt-impl.md](references/audit-prompt-impl.md)。
