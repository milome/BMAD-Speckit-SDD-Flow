# BMAD-Speckit-SDD-Flow

> **BMAD Method** (agile, party-mode, multi-agent) + **Spec-Driven Development** (specify → plan → GAPS → tasks → TDD)

## Project Overview

BMAD-Speckit-SDD-Flow combines the BMAD Method's agile workflows with Spec-Driven Development to create a rigorous, auditable AI-assisted development process.

### Core Principles

- **Five-layer architecture**: Product Brief → PRD → Architecture → Epic/Story → speckit specify/plan/GAPS/tasks → TDD implement → PR + human review
- **Mandatory audit loops**: Each stage requires code-review pass before proceeding
- **Critical Auditor**: Dedicated challenger role with >60% share in party-mode
- **Scoring system**: Multi-stage weighted scores, one-vote veto, AI Coach diagnosis
- **SFT extraction**: Instruction-response pairs from low-score runs for fine-tuning

---

## Quick Start

```bash
# Initialize in current directory
npx bmad-speckit init . --ai cursor-agent --yes

# Verify installation
npx bmad-speckit check
```

Or use the setup script:
```powershell
# Windows
pwsh scripts/setup.ps1 -Target <project-path>
```

---

## Directory Structure

```
BMAD-Speckit-SDD-Flow/
├── _bmad/                      # BMAD core modules
│   ├── core/                   # Core BMAD functionality
│   ├── bmm/                    # BMAD Method Manager
│   ├── bmb/                    # BMAD Method Base
│   ├── cis/                    # CI/CD integration
│   ├── tea/                    # Test & Evaluation
│   ├── scoring/                # Scoring system
│   ├── scripts/                # Utility scripts
│   └── _config/                # Configuration files
├── _bmad-output/               # Generated output (gitignored)
├── scoring/                    # Scoring extensions
│   ├── parse-score.ts          # Parse audit reports
│   ├── write-score.ts          # Persist scores
│   ├── coach.ts                # AI Coach diagnosis
│   └── dashboard.ts            # Dashboard generation
├── scripts/                    # CLI entry points
│   ├── parse-and-write-score.ts
│   ├── coach-diagnose.ts
│   ├── sft-extract.ts
│   └── accept-*.test.ts        # Acceptance tests
├── skills/                     # AI IDE Skills
│   ├── speckit-workflow/       # Speckit SDD workflow
│   ├── bmad-story-assistant/   # Story-level BMAD workflow
│   ├── bmad-bug-assistant/     # Bug fixing workflow
│   └── bmad-standalone-tasks/  # Standalone task execution
├── .claude/agents/             # Claude Code agent definitions
│   ├── layers/                 # Layer 4 agents (speckit phases)
│   │   ├── bmad-layer4-speckit-specify.md
│   │   ├── bmad-layer4-speckit-plan.md
│   │   ├── bmad-layer4-speckit-gaps.md
│   │   ├── bmad-layer4-speckit-tasks.md
│   │   └── bmad-layer4-speckit-implement.md
│   ├── auditors/               # Auditor agents
│   │   ├── auditor-spec.md
│   │   ├── auditor-plan.md
│   │   ├── auditor-tasks.md
│   │   └── auditor-implement.md
│   └── bmad-master.md          # Master orchestrator
├── specs/                      # Story specifications (generated)
│   └── epic-*/
│       └── story-*/
│           ├── spec.md
│           ├── plan.md
│           ├── IMPLEMENTATION_GAPS.md
│           └── tasks.md
├── docs/                       # Documentation
│   ├── BMAD/                   # BMAD method documentation
│   ├── guide/                  # User guides
│   └── QUICKSTART.md           # 5-minute quickstart
├── .speckit-state.yaml         # Speckit state machine
└── package.json
```

---

## Development Workflows

### 1. Speckit Workflow (Spec-Driven Development)

**Purpose**: Technical implementation of stories

**Phases** (must pass audit before proceeding):

1. **constitution** (`/speckit.constitution`)
   - Establish project principles
   - Define tech stack, coding standards, architecture constraints
   - Output: `constitution.md`

2. **specify** (`/speckit.specify`)
   - Convert requirements to technical spec
   - Create requirements mapping table
   - Output: `spec.md`
   - Audit: §1.2 with code-review skill

3. **plan** (`/speckit.plan`)
   - Create implementation plan
   - Define integration/E2E test requirements
   - Output: `plan.md`
   - Audit: §2.2 with code-review skill

4. **GAPS** (`/speckit.gaps` or auto-generated)
   - Deep analysis for implementation gaps
   - Output: `IMPLEMENTATION_GAPS.md`
   - Audit: §3.2 with code-review skill

5. **tasks** (`/speckit.tasks`)
   - Generate executable tasks from plan + GAPS
   - Batch execution (max 20 tasks per batch)
   - Output: `tasks.md`
   - Audit: §4.2 with code-review skill

6. **implement** (`/speckit.implement`)
   - Execute tasks using TDD Red-Green-Refactor
   - 15 ironclad rules (see §5)
   - Audit: §5.2 with code-review skill

### 2. BMAD Story Assistant (Five-Layer Architecture)

**Purpose**: Full story lifecycle from Epic to implementation

**Commands**:
- `/bmad-bmm-create-story` - Create story from Epic
- `/bmad-bmm-dev-story` - Develop story (triggers speckit workflow)

**Layers**:
1. Product Brief
2. PRD
3. Architecture
4. Epic/Story
5. Speckit phases → TDD → PR + human review

### 3. BMAD Bug Assistant

**Purpose**: Structured bug fixing with Party-Mode

**Flow**: Bug description → Party-Mode → BUGFIX doc → Generate tasks → TDD fix

### 4. Standalone Tasks

**Purpose**: Execute existing TASKS/BUGFIX documents

**Command**: `/bmad 按 TASKS_xxx.md 中的未完成任务实施`

---

## Testing & Acceptance

### Test Commands

```bash
# Run all tests
npm test

# Scoring tests
npm run test:scoring

# BMAD acceptance tests
npm run test:bmad

# Cursor regression tests
npm run test:cursor-regression

# Claude isolation tests
npm run test:claude-isolation
```

### Acceptance Test Scripts

Located in `scripts/accept-*.test.ts`:
- `accept-bmad-*.test.ts` - BMAD protocol tests
- `accept-layer4-*.test.ts` - Layer 4 agent tests
- `accept-extensions.test.ts` - Extension tests
- `accept-e1-s1.ts` through `accept-e4-s3.ts` - Epic/Story acceptance

### TDD Requirements

**15 Ironclad Rules for Implementation**:

1. Architecture fidelity - follow plan.md architecture
2. No placeholder implementations
3. Active regression testing
4. TodoWrite for task tracking
5. Strict TDD: RED → GREEN → IMPROVE
6. No skipping refactoring
7. Verify before marking complete
8. One test failure at a time
9. Incremental implementation
10. Proper error handling
11. Input validation at boundaries
12. No hardcoded values
13. Functions < 50 lines
14. Files < 800 lines
15. No mutation (immutable patterns)

---

## Agent System

### Layer 4 Agents (Speckit Phases)

| Agent | Purpose | File |
|-------|---------|------|
| bmad-layer4-speckit-specify | Spec generation | `.claude/agents/layers/bmad-layer4-speckit-specify.md` |
| bmad-layer4-speckit-plan | Plan generation | `.claude/agents/layers/bmad-layer4-speckit-plan.md` |
| bmad-layer4-speckit-gaps | GAPS analysis | `.claude/agents/layers/bmad-layer4-speckit-gaps.md` |
| bmad-layer4-speckit-tasks | Tasks generation | `.claude/agents/layers/bmad-layer4-speckit-tasks.md` |
| bmad-layer4-speckit-implement | Task execution | `.claude/agents/layers/bmad-layer4-speckit-implement.md` |

### Auditor Agents

| Agent | Purpose | File |
|-------|---------|------|
| auditor-spec | Spec audit | `.claude/agents/auditors/auditor-spec.md` |
| auditor-plan | Plan audit | `.claude/agents/auditors/auditor-plan.md` |
| auditor-tasks | Tasks audit | `.claude/agents/auditors/auditor-tasks.md` |
| auditor-implement | Implementation audit | `.claude/agents/auditors/auditor-implement.md` |
| auditor-tasks-doc | Standalone tasks audit | `.claude/agents/auditors/auditor-tasks-doc.md` |
| auditor-bugfix | Bugfix audit | `.claude/agents/auditors/auditor-bugfix.md` |

### Master Orchestrator

- **bmad-master**: State machine, routing, and gate execution
- **bmad-story-create**: Story creation from Epic
- **bmad-story-audit**: Story-level audit
- **bmad-epic-audit**: Epic-level audit

---

## Skills

### Core Skills

1. **speckit-workflow** (`skills/speckit-workflow/SKILL.md`)
   - Constitution → Specify → Plan → GAPS → Tasks → Implement
   - Mandatory audit loops
   - TDD Red-Green-Refactor

2. **bmad-story-assistant** (`skills/bmad-story-assistant/SKILL.md`)
   - Create Story → Audit → Dev Story
   - Five-layer architecture
   - Party-mode execution

3. **bmad-bug-assistant**
   - Party-mode bug fixing
   - BUGFIX document generation
   - Root cause analysis

4. **bmad-standalone-tasks**
   - Execute TASKS/BUGFIX documents
   - Subagent dispatch
   - Progress tracking

---

## Key Files Reference

### Configuration
- `.speckit-state.yaml` - Speckit state machine
- `_bmad/_config/*.yaml` - BMAD configuration

### Documentation
- `README.md` - Project overview
- `docs/QUICKSTART.md` - 5-minute quickstart
- `docs/guide/claudecode/bmad-story-assistant.md` - Claude Code guide
- `docs/guide/cursor/bmad-story-assistant.md` - Cursor guide

### Scripts
- `scripts/parse-and-write-score.ts` - Score parsing
- `scripts/coach-diagnose.ts` - AI Coach diagnosis
- `scripts/sft-extract.ts` - SFT data extraction
- `scripts/init-to-root.js` - Project initialization

---

## Best Practices & Conventions

### Code Style

- **Immutability**: Always create new objects, never mutate existing ones
- **File organization**: Many small files > few large files (200-400 lines typical, 800 max)
- **Error handling**: Handle errors explicitly at every level
- **Input validation**: Validate at system boundaries

### Git Workflow

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Audit Requirements

- Each stage MUST call code-review skill
- No self-approval allowed
- Iteration required if audit fails
- Only proceed after explicit "验证通过"

### State Management

- Use `.speckit-state.yaml` for speckit phases
- Use `TodoWrite` for task tracking
- Use handoff documents for stage transitions

---

## Common Commands

```bash
# Initialize BMAD in a project
npx bmad-speckit init <path> --ai cursor-agent

# Check prerequisites
pwsh _bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1

# Run acceptance tests
npm run accept:e1-s1  # Epic 1, Story 1
npm run accept:e3-s1  # Epic 3, Story 1

# Generate coach diagnosis
npm run coach:diagnose

# Verify audit granularity
npm run verify:cursor-audit-granularity
```

---

## Troubleshooting

### Common Issues

1. **Audit loop not completing**
   - Check code-review skill is available
   - Verify audit-prompts.md exists
   - Ensure subagent_type is correct

2. **TDD violations**
   - Use TodoWrite for tracking
   - Follow RED → GREEN → IMPROVE strictly
   - Run tests after each phase

3. **State machine errors**
   - Check `.speckit-state.yaml` format
   - Verify phase transitions are valid

---

## License

MIT License — see [LICENSE](LICENSE) for details.
