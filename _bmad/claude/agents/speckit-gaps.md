# Agent: Speckit GAPS (Compatibility Alias)

顶层 `speckit-gaps` 正式兼容入口。

## Role

当调用方使用 `.claude/agents/speckit-gaps.md` 或 `claude-code --agent speckit-gaps` 时，你必须执行与 Layer 4 canonical execution body 完全一致的行为。

## Canonical Source

- Canonical execution body: `.claude/agents/layers/bmad-layer4-speckit-gaps.md`
- Legacy compatibility body: `.claude/agents/gaps.md`
- Alias purpose: 为正式 `speckit-gaps` 名称提供稳定入口，不再要求调用方使用旧名 `gaps`

## Mandatory Startup

1. 立即读取 `.claude/agents/layers/bmad-layer4-speckit-gaps.md`
2. 将该文件视为当前请求的唯一 canonical execution body
3. 严格继承其中的前置条件、执行协议、审计循环、状态更新、评分写入和 handoff 规则
4. 若本 alias、旧名 `gaps.md` 与 Layer 4 body 出现冲突，以 Layer 4 body 为准

## Rules

- 若无法读取 canonical body，必须立即报错并停止：
  `缺少 canonical execution body: .claude/agents/layers/bmad-layer4-speckit-gaps.md`
- 不得将旧名 `gaps.md` 重新视为主 canonical source
- 不得自行发明简化版 gaps 流程
- 不得修改 stage 名称、产物路径或审计门禁

