---
name: "ralph-method"
description: "⚠️ **重要限制**: 本技能只能在tasks.md生成后使用！"
---

# Ralph Wiggum Method

The Ralph Wiggum Method is an autonomous AI coding loop that ships features while you sleep. It breaks complex tasks into atomic user stories that can each be completed in a single AI iteration.

## Mandatory Execution Rules (Hard Requirements)

These rules are mandatory. Do not skip them.

1. Before implementation starts, you MUST create both tracking files (see naming rules below).
2. You MUST NOT begin coding any user story until both files exist.
3. After each completed user story (US), you MUST update prd file:
   - Set the corresponding story `passes` to `true`
   - Keep other story states accurate (`false` for incomplete stories)
4. After each completed user story (US), you MUST update progress file:
   - Append one timestamped story log line for that US
   - Update `Current story` and `Completed` counters
5. If either tracking file is missing during execution, recreate it immediately and continue tracking from the current state.
6. Standard artifact location rule:
   - When the user provides a requirement document or BUGFIX document path, you MUST create and maintain tracking files in the same directory as that document.
   - Do not place these files in unrelated directories unless the user explicitly requests a different location.

## Script-Enforced Subset

In this repository, the following subset is enforced by first-party scripts and should be treated as runtime guarantees rather than prompt-only guidance:

1. `create/prepare tracking files`
   - `npx bmad-speckit ralph prepare --tasksPath <path>`
2. `record TDD-RED/TDD-GREEN/TDD-REFACTOR phase traces`
   - `npx bmad-speckit ralph record-phase --tasksPath <path> --userStoryId <US-ID> --title "<US title>" --phase TDD-RED|TDD-GREEN|TDD-REFACTOR|DONE --detail "<phase detail>"`
3. `final compliance verification`
   - `npx bmad-speckit ralph verify --tasksPath <path>`

Prompt-enforced only (not yet fully script-enforced): TodoWrite discipline, choosing the exact test/lint commands, definition-gap vs implementation-gap judgment, and broader journey-closure reasoning.

### Tracking File Naming Rules

File names depend on whether a reference document is provided:

| Scenario | prd file | progress file |
|----------|----------|---------------|
| No reference document | `prd.json` | `progress.txt` |
| With reference document (e.g. `BUGFIX_foo_bar.md`) | `prd.BUGFIX_foo_bar.json` | `progress.BUGFIX_foo_bar.txt` |

**Rules:**

- When the user provides a reference document path (e.g. `BUGFIX_*.md`, `REQ_*.md`, or any named spec), extract the **stem** (filename without extension) and embed it between the base name and extension: `prd.{stem}.json`, `progress.{stem}.txt`.
- This prevents file conflicts when multiple agents execute different tasks concurrently in the same directory.
- If the user provides multiple reference documents, use the **primary** (first mentioned) document's stem.
- Example: reference document `BUGFIX_offline_task_progress_stuck.md` → files are `prd.BUGFIX_offline_task_progress_stuck.json` and `progress.BUGFIX_offline_task_progress_stuck.txt`.

## Core Principles

1. **One iteration = One story = One commit**
2. Each story must be completable in a single AI iteration (5-30 minutes of work)
3. Stories are ordered by dependency (infrastructure first, consumers last)
4. Every story ends with build/test verification
5. The loop runs autonomously until all stories pass

## Story Atomicity Rules

A story is atomic when:

- It can be committed independently without breaking the build
- It leaves the codebase in a working state
- It has clear, verifiable "done" criteria
- It doesn't require human intervention mid-way
- It can be code-reviewed as a single logical change

## Story Decomposition Patterns

### API Endpoint
| Priority | Story | Purpose |
|----------|-------|---------|
| 1 | Create schema/types | Define data structures |
| 2 | Create service layer | Business logic |
| 3 | Create route handler | HTTP interface |
| 4 | Add integration test | Verification |

### Database Change
| Priority | Story | Purpose |
|----------|-------|---------|
| 1 | Create migration file | Schema change |
| 2 | Update model/entity | Code representation |
| 3 | Update seed data | Test data |
| 4 | Update consuming code | Integration |

### React Component
| Priority | Story | Purpose |
|----------|-------|---------|
| 1 | Create component skeleton | Structure |
| 2 | Add state/logic | Behavior |
| 3 | Add styling | Appearance |
| 4 | Add tests | Quality |

### Refactoring
| Priority | Story | Purpose |
|----------|-------|---------|
| 1 | Add new implementation alongside old | Parallel path |
| 2 | Migrate consumers one by one | Gradual switch |
| 3 | Remove old implementation | Cleanup |

### Configuration Change
| Priority | Story | Purpose |
|----------|-------|---------|
| 1 | Add environment variables | Define config |
| 2 | Create/update config file | Structure config |
| 3 | Update consuming code | Use config |

## prd.json Schema

```json
{
  "branchName": "ralph/feature-name",
  "taskDescription": "One-line summary of the task",
  "projectContext": {
    "framework": "e.g., Next.js, .NET",
    "testCommand": "e.g., npm test, dotnet test",
    "buildCommand": "e.g., npm run build, dotnet build"
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "Short descriptive title",
      "description": "What to implement in detail",
      "acceptanceCriteria": [
        "Specific, verifiable criterion 1",
        "Specific, verifiable criterion 2",
        "Build/test passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": "Hints, gotchas, references to existing code"
    }
  ]
}
```

### Field Descriptions

- **branchName**: Git branch for all work (format: `ralph/<feature-name>`)
- **taskDescription**: One-line summary for quick context
- **projectContext**: Build/test commands and framework info
- **userStories**: Array of atomic stories in dependency order
  - **id**: Unique identifier (US-001, US-002, etc.)
  - **title**: Short title for commit messages
  - **description**: Full implementation details
  - **acceptanceCriteria**: Verifiable conditions for "done"
  - **priority**: Execution order (1 = first)
  - **passes**: Set to true when story is complete
  - **notes**: Additional context, gotchas, file references

## Anti-Patterns to Avoid

### Vague Stories
- BAD: "Update all files"
- GOOD: "Update UserController to use new AuthService"

### Unbounded Scope
- BAD: "Fix bugs as found"
- GOOD: "Fix null reference in UserService.GetById"

### Circular Dependencies
- BAD: Story 3 depends on Story 5 which depends on Story 3
- GOOD: Linear dependency chain

### Too Large
- BAD: "Implement entire authentication system"
- GOOD: Split into: schema, service, middleware, routes, tests

### Missing Verification
- BAD: Story with no acceptance criteria
- GOOD: Every story ends with "Build succeeds" or "Tests pass"

## Story Sizing Guidelines

| Size | Time | Examples |
|------|------|----------|
| XS | 5-10 min | Add config value, create empty file, update import |
| S | 10-20 min | Create simple function, add basic test, update route |
| M | 20-30 min | Create service class, add migration, implement handler |
| L | 30+ min | TOO BIG - split into smaller stories |

## Verification Commands

Every story should end with verification. Common patterns:

```bash
# JavaScript/TypeScript
npm run build && npm test

# .NET
dotnet build && dotnet test

# Python
pytest && python -m py_compile src/*.py

# Go
go build ./... && go test ./...
```

## Progress Tracking

The `progress.txt` file tracks completed stories:

```
# Progress: feature-name
# Total stories: 5

Current story: 3
Completed: 2

---
# Story log
[2025-01-10 10:00] US-001: Create user entity - PASSED
[2025-01-10 10:15] US-002: Add user repository - PASSED
```

## Commit Message Format

```
story US-XXX: <title>

<description of what was done>
```

Example:
```
story US-001: Create user entity

Added UserEntity with id, email, and created_at fields.
Configured EF Core mapping in ApplicationDbContext.
```
