# BMAD Multi-Story Support

## Overview

BMAD now supports managing multiple stories concurrently with proper isolation and locking.

## Directory Structure

```
.claude/state/
├── bmad-progress.yaml              # Global state: active stories list
├── stories/                         # Story-specific states
│   ├── E001-S001-progress.yaml
│   ├── E001-S002-progress.yaml
│   └── E002-S001-progress.yaml
└── locks/                           # Story-level locks
    ├── E001-S001.lock
    ├── E001-S002.lock
    └── E002-S001.lock
```

## Usage

### Start New Story
```
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
```

### Continue Existing Story
```
@bmad-master 继续 E001-S001
```

### Switch Story
```
@bmad-master 切换到 E001-S002
```

### List Active Stories
```
@bmad-master list stories
```

## Architecture Changes

### 1. Global State (bmad-progress.yaml)

```yaml
version: "2.0"
active_stories:
  - epic: "E001"
    story: "S001"
    stage: "implement_passed"
    status: "active"
    created_at: "2026-03-13T10:00:00Z"
    updated_at: "2026-03-13T12:00:00Z"
  - epic: "E001"
    story: "S002"
    stage: "plan_passed"
    status: "active"
current_context:
  epic: "E001"
  story: "S001"
```

### 2. Story-Specific State

Each story has its own state file: `.claude/state/stories/{epic}-{story}-progress.yaml`

### 3. Story-Level Locking

Locks prevent concurrent modifications to the same story:

```yaml
# .claude/state/locks/E001-S001.lock
locked: true
owner: "session-uuid"
epic: "E001"
story: "S001"
acquired_at: "2026-03-13T12:00:00Z"
expires_at: "2026-03-13T13:00:00Z"
type: "write"
```

## API

### State Management (scripts/bmad-state.ts)

```typescript
// Story lifecycle
const story = createStory('E001', 'S001', 'email-validator');
const state = getStoryState('E001', 'S001');
const updated = updateStoryState('E001', 'S001', { stage: 'plan_passed' });
completeStory('E001', 'S001');

// Context management
const stories = listActiveStories();
const context = getCurrentContext();
setCurrentContext('E001', 'S002');

// Locking
acquireLock('E001', 'S001', 'agent-1');
releaseLock('E001', 'S001', 'agent-1');
```

## Testing

```bash
# Run multi-story tests
npx vitest run scripts/accept-multi-story.test.ts

# Run all tests
npx vitest run scripts/accept-layer4.test.ts scripts/accept-multi-story.test.ts
```

## Migration from Single-Story

Old state file backed up to: `.claude/state/bmad-progress-v1-backup.yaml`

New stories automatically use multi-story structure.

## Features

✅ Multiple concurrent stories
✅ Story-level state isolation
✅ Story-level locking (prevents concurrent modifications)
✅ Context switching between stories
✅ Automatic lock expiration (1 hour)
✅ Story completion tracking
