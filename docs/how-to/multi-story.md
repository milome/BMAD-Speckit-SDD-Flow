# BMAD Multi-Story Support

> **Current path**: 多个 Story 共存时，主 Agent 仍然先读 `main-agent-orchestration inspect`，必要时才执行 `dispatch-plan`，子代理只执行 `bounded packet`，`runAuditorHost` 仅负责 post-audit close-out。
> **Legacy / archive**: 旧的 `.claude/state/*` 布局、`@bmad-master list stories` 口令和 `scripts/bmad-state.ts` API 保留在本文后半段，作为历史实现证据，不再是当前 accepted runtime path。

## Overview

BMAD 的多 Story 支持，重点不是“同时开几个 state 文件”，而是让每个 Story 都走同一条 authoritative main-agent surface：

1. 选择要继续的 Story
2. 主 Agent 执行 `inspect`
3. 只有 surface 要求 materialize packet 时才执行 `dispatch-plan`
4. 子代理消费 `bounded packet`
5. 审计通过后由 `runAuditorHost` 做 close-out
6. close-out 完成后，主 Agent 再次回到 `inspect`

这意味着多 Story 并行时，真正的全局分支选择仍由主 Agent 负责，而不是由某个子代理、后台 worker 或旧 handoff prose 决定。

## Current Runtime Path

### 推荐操作顺序

```bash
npm run main-agent-orchestration -- --cwd <project-root> --action inspect
```

如果 `inspect` 明确显示“下一步需要 materialize packet”，再执行：

```bash
npm run main-agent-orchestration -- --cwd <project-root> --action dispatch-plan
```

然后按 main-agent surface 返回的 packet 生命周期推进：

- 主 Agent claim / dispatch / complete / invalidate packet
- 子代理只执行 `bounded packet`
- 审计通过后，`runAuditorHost` 做 post-audit close-out
- close-out 结束后，主 Agent 重新 `inspect`

### 多 Story 时的实践建议

- 每次继续某个 Story 前，都重新读取一次 `inspect`
- 不要因为另一个 Story 的审计 prose 是 PASS，就跳过当前 Story 的 surface 检查
- 不要把 `dispatch-plan` 当成固定第二步；只有 surface 明确需要时才运行
- 不要让子代理决定切换到哪一个 Story；子代理只返回 packet result
- 不要把 `runAuditorHost` 当成多 Story 调度入口；它只是 post-audit close-out

## Story Switching

用户入口仍然可以是 `bmad-story-assistant` 或宿主等价入口，但运行时主链保持不变。

示例：

```text
请使用 bmad-story-assistant 继续 E001-S001
```

```text
请使用 bmad-story-assistant 继续 E001-S002 --continue
```

上面的请求只负责告诉主 Agent“你想继续哪一个 Story”。真正是否可继续、是否要派发 packet、是否需要 close-out，仍以 `main-agent-orchestration inspect` 为准。

## Legacy / Archive Reference

以下内容保留为历史实现证据，帮助理解早期多 Story state/lock 设计。它们不是当前用户应优先依赖的 accepted runtime path。

### Legacy Directory Structure

```text
.claude/state/
├── bmad-progress.yaml              # Global state: active stories list
├── stories/                        # Story-specific states
│   ├── E001-S001-progress.yaml
│   ├── E001-S002-progress.yaml
│   └── E002-S001-progress.yaml
└── locks/                          # Story-level locks
    ├── E001-S001.lock
    ├── E001-S002.lock
    └── E002-S001.lock
```

### Legacy Prompt Examples

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
```

```text
@bmad-master 继续 E001-S001
```

```text
@bmad-master 切换到 E001-S002
```

```text
@bmad-master list stories
```

### Legacy State Shape

```yaml
version: '2.0'
active_stories:
  - epic: 'E001'
    story: 'S001'
    stage: 'implement_passed'
    status: 'active'
    created_at: '2026-03-13T10:00:00Z'
    updated_at: '2026-03-13T12:00:00Z'
  - epic: 'E001'
    story: 'S002'
    stage: 'plan_passed'
    status: 'active'
current_context:
  epic: 'E001'
  story: 'S001'
```

### Legacy Lock Example

```yaml
locked: true
owner: 'session-uuid'
epic: 'E001'
story: 'S001'
acquired_at: '2026-03-13T12:00:00Z'
expires_at: '2026-03-13T13:00:00Z'
type: 'write'
```

### Legacy API Reference

历史实现里，每个 Story 都有独立 state，且 `scripts/bmad-state.ts` 暴露过下面这些 API：

```typescript
const story = createStory('E001', 'S001', 'email-validator');
const state = getStoryState('E001', 'S001');
const updated = updateStoryState('E001', 'S001', { stage: 'plan_passed' });
completeStory('E001', 'S001');

const stories = listActiveStories();
const context = getCurrentContext();
setCurrentContext('E001', 'S002');

acquireLock('E001', 'S001', 'agent-1');
releaseLock('E001', 'S001', 'agent-1');
```

这些 API 仍可作为仓库内实现参考，但当前用户文档应优先遵循前面的 main-agent orchestration 主链。

## Related Validation

```bash
npx vitest run tests/acceptance/accept-multi-story.test.ts
npx vitest run tests/acceptance/main-agent-orchestration-consumer.test.ts
```
