# Claude Code CLI BMAD 适配实施计划 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 BMAD-Speckit-SDD-Flow 建立一套在 Claude Code CLI 下可执行、可审计、可恢复、可阻止未审计提交的最小适配闭环，先跑通 Layer 4，再扩展到 standalone tasks、bug assistant 与 reviewer lifecycle。

**Architecture:** 采用 `bmad-master + 分层执行 Agent + auditor + protocol + minimal hooks/worker` 的组合式架构。`bmad-master` 负责阶段门控、状态追踪与 commit 放行；Layer 4 执行 Agent 负责文档产出与阶段推进；auditor 负责严格审计与评分触发；hooks/worker 只负责观测、checkpoint 和恢复，不承担最终裁决。

**Tech Stack:** TypeScript、Node.js、Claude Code CLI、`.claude/agents`、`.claude/protocols`、`.claude/state`、`scripts/parse-and-write-score.ts`、`skills/speckit-workflow/references/audit-prompts.md`、Vitest、ESLint

---

## Execution Strategy

本计划按 **contract-first → behavior-next → pilot-last** 三层推进：

1. **Contract tests**：先验证状态文件、协议文件、Agent/auditor 模板中是否包含不可缺失的硬约束。
2. **Behavior tests**：再验证状态推进、审计结果解析、commit gate、queue 流转、checkpoint 恢复是否真实生效。
3. **Pilot validation**：最后用一个最小 dry-run 和一个真实 Story 跑通闭环。

第一阶段不追求完整自动化运行时，只先建立可验证控制骨架；不要在 MVP 阶段引入数据库、多 worker 并发或复杂评分模型。

## Preconditions

在开始实施前，先确认以下事实：

- 现有评分入口：`scripts/parse-and-write-score.ts`
- 现有 master 参考：`.claude/commands/bmad-agent-bmad-master.md` → `_bmad/core/agents/bmad-master.md`
- 现有 workflow 引擎参考：`_bmad/core/tasks/workflow.xml`
- 现有审计规则来源：`skills/speckit-workflow/references/audit-prompts.md`
- 现有工程脚本入口：`package.json`
- 本仓库 Windows worktree 会因超长路径失败，因此执行时不要把“必须在 worktree 中完成”当成阻断条件

## Runtime Entry Decision

`bmad-master` 的运行入口在本计划中固定为三层：

- **主入口**：`.claude/agents/bmad-master.md`
- **兼容入口**：`.claude/commands/bmad-agent-bmad-master.md`
- **参考来源**：`_bmad/core/agents/bmad-master.md`

约束：
- Claude Code 运行时以 `.claude/agents/bmad-master.md` 为准。
- `.claude/commands/bmad-agent-bmad-master.md` 仅保留兼容与迁移桥接，不再作为未来唯一真相。
- `_bmad/core/agents/bmad-master.md` 仅作为参考语义来源，不直接承担 Claude Code CLI 运行时门控。

### bmad-master Minimal I/O Contract

**Inputs**
- `current_state`: 来自 `.claude/state/bmad-progress.yaml`
- `requested_action`: 用户请求或上游 handoff 指定动作，如 `run_specify`、`run_plan`、`run_tasks`、`commit_request`
- `latest_audit_result`: 来自结构化审计报告解析结果
- `handoff_payload`: 来自 `.claude/protocols/handoff-schema.md` 约定字段

**Outputs**
- `next_stage`: 下一阶段名，或 `blocked`
- `allowed_action`: `allow | deny | iterate | audit_required`
- `state_patch`: 应写回 `bmad-progress.yaml` 的最小变更
- `denial_reason`: 当 `allowed_action=deny` 时必须给出
- `follow_up`: 下一步应调用的 agent / auditor / runtime action

## Hook Failure Policy

hooks / worker 的失败策略固定如下：

- SessionStart / PostToolUse / Stop hooks 默认 **non-blocking**
- worker 处理单条事件失败时，事件写入 `queue/failed/`
- checkpoint 生成失败时只记录告警，不阻断主流程
- 只有 `bmad-master` 的阶段门控与 commit gate 允许 hard-block
- 不允许把 hook 失败解释为阶段失败或审计失败

## Audit Convergence Rule

所有正式审计（文档审计、实现审计、扩展流程审计）默认启用**批判审计员主导模式**：

- 批判审计员为主审角色，审计结论与 gap 清单以批判审计员意见为准
- 审计重点优先覆盖：关键路径接入、TDD 证据、集成测试/E2E、lint、评分触发、commit 门控、状态一致性
- 单轮出现任一 gap，即判定该轮不通过，不得以“方向正确”“可后续补充”豁免
- 只有在**连续 3 轮无 gap**时，才能判定收敛并给出“完全覆盖、验证通过”
- 任一轮新增 gap，连续计数重置为 0

---

### Task 1: 建立状态与 runtime 目录骨架

**Files:**
- Create: `.claude/state/bmad-progress.yaml`
- Create: `.claude/state/bmad-lock.yaml`
- Create: `.claude/state/runtime/events/.gitkeep`
- Create: `.claude/state/runtime/queue/pending/.gitkeep`
- Create: `.claude/state/runtime/queue/processing/.gitkeep`
- Create: `.claude/state/runtime/queue/failed/.gitkeep`
- Create: `.claude/state/runtime/queue/done/.gitkeep`
- Create: `.claude/state/runtime/checkpoints/.gitkeep`
- Create: `.claude/state/runtime/projections/.gitkeep`
- Create: `.claude/state/runtime/startup-context/.gitkeep`
- Create: `scripts/accept-e4-s1.ts`

**Test type:** Contract test

**Step 1: Write the failing test**

新增 acceptance test，断言以下路径存在且 `bmad-progress.yaml` 初始字段完整：

```ts
import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

describe('bmad state skeleton', () => {
  it('creates progress and runtime skeleton', () => {
    expect(existsSync('.claude/state/bmad-progress.yaml')).toBe(true);
    expect(existsSync('.claude/state/bmad-lock.yaml')).toBe(true);
    const progress = yaml.load(readFileSync('.claude/state/bmad-progress.yaml', 'utf8')) as Record<string, unknown>;
    expect(progress).toMatchObject({
      layer: null,
      stage: null,
      audit_status: 'pending',
      artifacts: {},
      git_control: { commit_allowed: false },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-s1.ts
```

Expected: FAIL，提示状态文件或字段不存在。

**Step 3: Write minimal implementation**

创建最小 YAML：

```yaml
layer: null
stage: null
audit_status: pending
artifacts: {}
git_control:
  commit_allowed: false
  last_commit_request: null
runtime:
  active_run_id: null
  last_checkpoint: null
```

创建 lock 文件最小结构：

```yaml
locked: false
owner: null
timestamp: null
```

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-s1.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/state scripts/accept-e4-s1.ts
git commit -m "feat: add bmad state skeleton"
```

---

### Task 2: 定义审计结果与交接协议

**Files:**
- Create: `.claude/protocols/audit-result-schema.md`
- Create: `.claude/protocols/handoff-schema.md`
- Create: `.claude/protocols/commit-protocol.md`
- Modify: `docs/plans/2026-03-13-claude-code-cli-bmad-implementation-checklist.md`
- Create: `scripts/accept-e4-s2.ts`

**Test type:** Contract test

**Step 1: Write the failing test**

新增测试，断言协议文档包含关键字段：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('protocol documents', () => {
  it('defines audit result schema and commit request contract', () => {
    const auditSchema = readFileSync('.claude/protocols/audit-result-schema.md', 'utf8');
    const handoff = readFileSync('.claude/protocols/handoff-schema.md', 'utf8');
    const commitProtocol = readFileSync('.claude/protocols/commit-protocol.md', 'utf8');

    expect(auditSchema).toContain('status');
    expect(auditSchema).toContain('PASS');
    expect(auditSchema).toContain('FAIL');
    expect(handoff).toContain('artifactDocPath');
    expect(commitProtocol).toContain('commit_request');
    expect(commitProtocol).toContain('Only bmad-master can approve commit');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-s2.ts
```

Expected: FAIL，提示协议文件缺失。

**Step 3: Write minimal implementation**

在三个协议文档中至少明确：

- `audit-result-schema.md`
  - `status: PASS | FAIL`
  - `summary`
  - `findings[]`
  - `required_fixes[]`
  - `reportPath`
  - `score_trigger`
  - `iteration_count`
- `handoff-schema.md`
  - `layer`
  - `stage`
  - `artifactDocPath`
  - `auditReportPath`
  - `next_action`
- `commit-protocol.md`
  - 执行 Agent 禁止直接 `git commit`
  - 只允许发 `commit_request`
  - 只有 `bmad-master` 可根据 `audit_status` 放行

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-s2.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/protocols scripts/accept-e4-s2.ts docs/plans/2026-03-13-claude-code-cli-bmad-implementation-checklist.md
git commit -m "feat: define bmad audit and handoff protocols"
```

---

### Task 3: 实现审计结果解析辅助函数

**Files:**
- Create: `scripts/parse-bmad-audit-result.ts`
- Create: `scripts/accept-e4-audit-parser.ts`
- Read: `.claude/protocols/audit-result-schema.md`
- Read: `skills/speckit-workflow/references/audit-prompts.md`

**Test type:** Behavior test

**Step 1: Write the failing test**

新增测试，验证结构化报告可以被可靠解析：

```ts
import { describe, expect, it } from 'vitest';
import { parseBmadAuditResult } from './parse-bmad-audit-result';

describe('parseBmadAuditResult', () => {
  it('extracts pass/fail, report path and iteration count', () => {
    const result = parseBmadAuditResult(`
status: PASS
reportPath: reports/spec.md
iteration_count: 2
required_fixes_count: 0
score_trigger_present: true
artifactDocPath: specs/epic-1/story-1/spec.md
converged: false
summary: ok
`);

    expect(result).toEqual({
      status: 'PASS',
      reportPath: 'reports/spec.md',
      iterationCount: 2,
      requiredFixesCount: 0,
      scoreTriggerPresent: true,
      artifactDocPath: 'specs/epic-1/story-1/spec.md',
      converged: false,
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-audit-parser.ts
```

Expected: FAIL，提示解析函数不存在或字段不完整。

**Step 3: Write minimal implementation**

实现一个最小纯函数，至少解析并返回：
- `status`
- `reportPath`
- `iterationCount`
- `requiredFixesCount`
- `scoreTriggerPresent`
- `artifactDocPath`
- `converged`

```ts
export function parseBmadAuditResult(input: string) {
  const status = input.match(/status:\s*(PASS|FAIL)/)?.[1] as 'PASS' | 'FAIL' | undefined;
  const reportPath = input.match(/reportPath:\s*(.+)/)?.[1]?.trim();
  const iterationCountRaw = input.match(/iteration_count:\s*(\d+)/)?.[1];
  const requiredFixesCountRaw = input.match(/required_fixes_count:\s*(\d+)/)?.[1];
  const scoreTriggerPresentRaw = input.match(/score_trigger_present:\s*(true|false)/)?.[1];
  const artifactDocPath = input.match(/artifactDocPath:\s*(.+)/)?.[1]?.trim();
  const convergedRaw = input.match(/converged:\s*(true|false)/)?.[1];

  return {
    status,
    reportPath,
    iterationCount: iterationCountRaw ? Number(iterationCountRaw) : 0,
    requiredFixesCount: requiredFixesCountRaw ? Number(requiredFixesCountRaw) : 0,
    scoreTriggerPresent: scoreTriggerPresentRaw === 'true',
    artifactDocPath,
    converged: convergedRaw === 'true',
  };
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-audit-parser.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/parse-bmad-audit-result.ts scripts/accept-e4-audit-parser.ts
git commit -m "feat: add bmad audit result parser"
```

---

### Task 4: 实现 bmad-master 最小门控 Agent

**Files:**
- Create: `.claude/agents/bmad-master.md`
- Read: `.claude/commands/bmad-agent-bmad-master.md`
- Read: `_bmad/core/agents/bmad-master.md`
- Modify: `.claude/state/bmad-progress.yaml`
- Create: `scripts/accept-e4-master.ts`

**Test type:** Contract test

**Step 1: Write the failing test**

新增测试，校验 `bmad-master.md` 明确包含：

```ts
expect(masterAgent).toContain('.claude/state/bmad-progress.yaml');
expect(masterAgent).toContain('commit_request');
expect(masterAgent).toContain('auditor-spec');
expect(masterAgent).toContain('auditor-plan');
expect(masterAgent).toContain('auditor-tasks');
expect(masterAgent).toContain('禁止在未通过审计时放行 commit');
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-master.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

在 `.claude/agents/bmad-master.md` 中写出最小控制面：

- 启动读取 `.claude/state/bmad-progress.yaml`
- 根据 stage 路由 `specify / plan / tasks`
- 使用 `scripts/parse-bmad-audit-result.ts` 解析审计结果
- 仅当 `auditor-implement` PASS 且 `git_control.commit_allowed=true` 时允许提交
- 对 `commit_request` 返回 allow / deny

建议结构片段：

```md
## Mandatory startup
1. Read `.claude/state/bmad-progress.yaml`
2. Read `.claude/protocols/audit-result-schema.md`
3. Read `.claude/protocols/handoff-schema.md`
4. Read `.claude/protocols/commit-protocol.md`

## Responsibilities
- Route current stage to the correct Layer 4 agent
- Verify audit report exists and status is PASS
- Update `bmad-progress.yaml`
- Deny any direct commit attempt before implementation audit passes
```

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-master.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/agents/bmad-master.md scripts/accept-e4-master.ts .claude/state/bmad-progress.yaml scripts/parse-bmad-audit-result.ts
git commit -m "feat: add bmad master gatekeeper agent"
```

---

### Task 5: 实现 auditor-spec / auditor-plan / auditor-tasks / auditor-implement

**Files:**
- Create: `.claude/agents/auditors/auditor-spec.md`
- Create: `.claude/agents/auditors/auditor-plan.md`
- Create: `.claude/agents/auditors/auditor-tasks.md`
- Create: `.claude/agents/auditors/auditor-implement.md`
- Read: `skills/speckit-workflow/references/audit-prompts.md`
- Read: `scripts/parse-and-write-score.ts`
- Create: `scripts/accept-e4-auditors.ts`

**Test type:** Contract test

**Step 1: Write the failing test**

新增测试，逐个断言 auditor：

```ts
expect(specAuditor).toContain('audit-prompts.md');
expect(specAuditor).toContain('parse-and-write-score.ts');
expect(specAuditor).toContain('PASS');
expect(specAuditor).toContain('FAIL');
expect(implementAuditor).toContain('--stage implement');
expect(tasksAuditor).toContain('--stage tasks');
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-auditors.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

每个 auditor 模板都必须包含：

- 启动读取 `audit-prompts.md`
- 读取对应 artifact
- 输出结构化报告，结论仅允许 `PASS` / `FAIL`
- 每轮审计必须输出：
  - `round`
  - `gap_count`
  - `reportPath`
  - `required_fixes_count`
- PASS 时调用评分脚本，例如：

```bash
npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage spec --event stage_audit_complete
```

`auditor-implement.md` 额外必须检查：
- 集成测试 / E2E / lint
- 生产关键路径引用
- TDD RED/GREEN/REFACTOR 证据
- commit 前置审计完成

**Round ownership rules**
- `auditor-*` 负责输出本轮的 `round`、`gap_count`、`reportPath`、`required_fixes_count`
- `bmad-master` 负责维护各 stage 的 `consecutive_no_gap_rounds`
- 当某轮 `gap_count=0` 时，`consecutive_no_gap_rounds += 1`
- 当某轮 `gap_count>0` 时，`consecutive_no_gap_rounds = 0`
- 只有 `consecutive_no_gap_rounds === 3` 时，`bmad-master` 才能写入 `converged=true` 并允许阶段收敛
- 单个 `auditor-*` 不得自行宣布最终收敛，只能报告本轮结果

**State mapping into `bmad-progress.yaml`**
- `state.current.stage <- next_stage`
- `state.current.allowed_action <- allowed_action`
- `state.current.last_denial_reason <- denial_reason`
- `state.current.follow_up <- follow_up`
- `state.current.latest_audit_round <- round`
- `state.current.latest_gap_count <- gap_count`
- `state.current.consecutive_no_gap_rounds <- bmad-master` 维护值

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-auditors.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/agents/auditors scripts/accept-e4-auditors.ts
git commit -m "feat: add standardized bmad auditors"
```

---

### Task 6: 实现 Layer 4 specify Agent

**Files:**
- Create: `.claude/agents/layers/bmad-layer4-speckit-specify.md`
- Read: `skills/speckit-workflow/references/audit-prompts.md`
- Read: `skills/speckit-workflow/SKILL.md`
- Modify: `.claude/state/bmad-progress.yaml`
- Create: `scripts/accept-e4-specify-agent.ts`

**Test type:** Contract test

**Step 1: Write the failing test**

断言 specify agent 包含：

```ts
expect(agent).toContain('Read `skills/speckit-workflow/SKILL.md`');
expect(agent).toContain('auditor-spec');
expect(agent).toContain('禁止自行 commit');
expect(agent).toContain('bmad-progress.yaml');
expect(agent).toContain('需求映射表格');
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-specify-agent.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

在 agent 中写出固定顺序：
1. 读取 skill
2. 读取 `audit-prompts.md`
3. 读取 `bmad-progress.yaml`
4. 生成 `spec.md`
5. 调 `auditor-spec`
6. FAIL 则修改并重审
7. PASS 则触发评分写入
8. 更新状态到 `stage: specify_passed`

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-specify-agent.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/agents/layers/bmad-layer4-speckit-specify.md scripts/accept-e4-specify-agent.ts .claude/state/bmad-progress.yaml
git commit -m "feat: add layer4 specify agent"
```

---

### Task 7: 实现 Layer 4 plan Agent

**Files:**
- Create: `.claude/agents/layers/bmad-layer4-speckit-plan.md`
- Read: `skills/speckit-workflow/references/audit-prompts.md`
- Modify: `.claude/state/bmad-progress.yaml`
- Create: `scripts/accept-e4-plan-agent.ts`

**Test type:** Contract test

**Step 1: Write the failing test**

断言 plan agent：

```ts
expect(agent).toContain('auditor-plan');
expect(agent).toContain('集成测试');
expect(agent).toContain('端到端功能测试');
expect(agent).toContain('禁止自行 commit');
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-plan-agent.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

固定顺序：
1. 校验上阶段 `specify` 已 PASS
2. 生成 `plan.md`
3. 明确集成测试 / E2E 测试计划
4. 调 `auditor-plan`
5. PASS 后写评分并更新状态

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-plan-agent.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/agents/layers/bmad-layer4-speckit-plan.md scripts/accept-e4-plan-agent.ts .claude/state/bmad-progress.yaml
git commit -m "feat: add layer4 plan agent"
```

---

### Task 8: 实现 Layer 4 tasks Agent

**Files:**
- Create: `.claude/agents/layers/bmad-layer4-speckit-tasks.md`
- Read: `skills/speckit-workflow/references/audit-prompts.md`
- Modify: `.claude/state/bmad-progress.yaml`
- Create: `scripts/accept-e4-tasks-agent.ts`

**Test type:** Contract test

**Step 1: Write the failing test**

断言 tasks agent：

```ts
expect(agent).toContain('auditor-tasks');
expect(agent).toContain('TDD');
expect(agent).toContain('RED');
expect(agent).toContain('GREEN');
expect(agent).toContain('REFACTOR');
expect(agent).toContain('Lint');
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-tasks-agent.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

固定顺序：
1. 校验 `plan` 已 PASS
2. 生成 `tasks.md`
3. 每个任务显式包含 RED/GREEN/REFACTOR
4. 包含 lint、集成测试、E2E、生产关键路径验证任务
5. 调 `auditor-tasks`
6. PASS 后写评分并更新状态

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-tasks-agent.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/agents/layers/bmad-layer4-speckit-tasks.md scripts/accept-e4-tasks-agent.ts .claude/state/bmad-progress.yaml
git commit -m "feat: add layer4 tasks agent"
```

---

### Task 9: 接入 commit gate 与提交请求流程

**Files:**
- Modify: `.claude/agents/bmad-master.md`
- Modify: `.claude/protocols/commit-protocol.md`
- Modify: `.claude/state/bmad-progress.yaml`
- Create: `scripts/can-bmad-commit.ts`
- Create: `scripts/accept-e4-commit-gate.ts`
- Create: `scripts/accept-e4-state-transition.ts`

**Test type:** Behavior test

**Step 1: Write the failing test**

新增测试模拟两种情况：

```ts
expect(canCommit({ audit_status: 'fail', commit_allowed: false })).toBe(false);
expect(canCommit({ audit_status: 'pass', commit_allowed: true })).toBe(true);
```

并增加状态迁移断言：

```ts
expect(resolveNextStage({
  currentStage: 'specify',
  auditStatus: 'PASS',
})).toEqual({
  next_stage: 'specify_passed',
  allowed_action: 'allow',
});

expect(resolveNextStage({
  currentStage: 'specify',
  auditStatus: 'FAIL',
})).toEqual({
  next_stage: 'blocked',
  allowed_action: 'iterate',
});
```

以及文档断言：

```ts
expect(commitProtocol).toContain('deny direct git commit');
expect(masterAgent).toContain('Only approve commit when implement audit passed');
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-commit-gate.ts
rtk vitest run scripts/accept-e4-state-transition.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

实现最小 gating 与状态迁移规则：

```ts
export function canCommit(input: { audit_status: string; commit_allowed: boolean }) {
  return input.audit_status === 'pass' && input.commit_allowed === true;
}

export function resolveNextStage(input: { currentStage: string; auditStatus: string }) {
  if (input.currentStage === 'specify' && input.auditStatus === 'PASS') {
    return { next_stage: 'specify_passed', allowed_action: 'allow' };
  }

  if (input.auditStatus === 'FAIL') {
    return { next_stage: 'blocked', allowed_action: 'iterate' };
  }

  return { next_stage: 'blocked', allowed_action: 'audit_required' };
}
```

并在 protocol / master 文档中写明：
- 所有执行 Agent 只能发 `commit_request`
- 未通过 implement 审计一律 deny
- FAIL 时不得推进 stage，只能 iterate
- 失败要记录原因

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-commit-gate.ts
rtk vitest run scripts/accept-e4-state-transition.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/agents/bmad-master.md .claude/protocols/commit-protocol.md .claude/state/bmad-progress.yaml scripts/can-bmad-commit.ts scripts/accept-e4-commit-gate.ts scripts/accept-e4-state-transition.ts
git commit -m "feat: enforce bmad commit gate and state transitions"
```

---

### Task 10: 增加 minimal hooks 与 single worker

**Files:**
- Create: `.claude/hooks/session-start.js`
- Create: `.claude/hooks/post-tool-use.js`
- Create: `.claude/hooks/stop.js`
- Create: `scripts/bmad-runtime-worker.ts`
- Modify: `.claude/settings.local.json`
- Create: `scripts/accept-e4-runtime.ts`

**Test type:** Behavior test

**Step 1: Write the failing test**

新增测试，断言：

```ts
expect(worker).toContain('pending');
expect(worker).toContain('processing');
expect(worker).toContain('done');
expect(worker).toContain('failed');
expect(settings).toContain('SessionStart');
expect(settings).toContain('PostToolUse');
expect(settings).toContain('Stop');
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-runtime.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

worker 最小职责：
- 扫描 pending queue
- 处理后移动到 done/failed
- 更新 `current-run.json`
- 写 `checkpoints/latest.md`

hooks 最小职责：
- SessionStart 注入最近 checkpoint 摘要
- PostToolUse 记录高价值事件
- Stop 生成 checkpoint
- 默认失败不阻断主流程

`.claude/settings.local.json` 最小注册示例：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "command": "node .claude/hooks/session-start.js"
      }
    ],
    "PostToolUse": [
      {
        "command": "node .claude/hooks/post-tool-use.js"
      }
    ],
    "Stop": [
      {
        "command": "node .claude/hooks/stop.js"
      }
    ]
  }
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-runtime.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/hooks scripts/bmad-runtime-worker.ts .claude/settings.local.json scripts/accept-e4-runtime.ts
git commit -m "feat: add bmad runtime hooks and worker"
```

---

### Task 11: 先做一个最小 dry-run 验证骨架

**Files:**
- Create: `docs/plans/2026-03-13-bmad-claude-code-cli-dry-run-checklist.md`
- Modify: `.claude/state/bmad-progress.yaml`
- Create: `scripts/accept-e4-dry-run.ts`

**Test type:** Behavior test

**Purpose boundary:** dry-run 只验证框架流转，不生成真实业务 artifact，不进入真实 Story 文档生成，不要求产出正式 spec/plan/tasks 业务内容。

**Step 1: Write the failing test**

新增 dry-run checklist：

```md
- [ ] state skeleton 可读写
- [ ] master 能读取 stage 并决定下一动作
- [ ] audit parser 能解析 PASS/FAIL
- [ ] commit gate 对 fail 场景返回 deny
- [ ] hooks 失败不阻断主流程
```

并写测试断言 checklist 初始存在。

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-dry-run.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

按 dry-run checklist 逐项补齐最小框架问题，不进入真实 Story 文档生成。

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-dry-run.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-13-bmad-claude-code-cli-dry-run-checklist.md .claude/state scripts/accept-e4-dry-run.ts
git commit -m "test: add bmad claude cli dry run validation"
```

---

### Task 12: 用真实 Story 做端到端试点

**Files:**
- Create: `docs/plans/2026-03-13-bmad-claude-cli-pilot-story-checklist.md`
- Modify: `.claude/state/bmad-progress.yaml`
- Modify: `.claude/state/runtime/checkpoints/latest.md`
- Modify: `_bmad-output/...`（按真实 Story 运行产生）
- Test: 使用现有 acceptance 脚本 + 一次真实手工验证

**Test type:** Pilot validation

**Purpose boundary:** pilot 必须选择一个真实 Story，必须生成真实 artifact、审计报告、checkpoint 与状态更新证据；pilot 不是 dry-run 的别名。

**Step 1: Write the failing test**

新增 checklist 文档，先把验收项写为未完成：

```md
- [ ] specify 阶段生成文档并审计通过
- [ ] plan 阶段生成文档并审计通过
- [ ] tasks 阶段生成文档并审计通过
- [ ] 实现后审计通过前 commit 被阻止
- [ ] 会话中断后可恢复
```

**Step 2: Run trial to verify it currently fails**

Run one real Story through the new flow.

Expected: 至少有一项未通过，暴露缺口。

**Step 3: Write minimal implementation/fixes**

按试点暴露的问题修复最小缺口，不新增 MVP 外能力。

**Step 4: Re-run trial to verify it passes**

Run:
```bash
rtk npm run accept:e4-s1 && rtk npm run accept:e4-s2 && rtk vitest run scripts/accept-e4-*.ts
```

Expected: 相关 acceptance tests PASS，试点 checklist 全部勾选完成。

**Step 5: Commit**

```bash
git add docs/plans/2026-03-13-bmad-claude-cli-pilot-story-checklist.md .claude/state _bmad-output scripts/accept-e4-*.ts
git commit -m "test: validate bmad claude cli pilot story flow"
```

---

### Task 13: 第二阶段扩展 standalone tasks / doc review / bug assistant / reviewer lifecycle

**Files:**
- Create: `.claude/agents/layers/bmad-standalone-tasks.md`
- Create: `.claude/agents/auditors/auditor-tasks-doc.md`
- Create: `.claude/agents/layers/bmad-bug-agent.md`
- Create: `.claude/agents/auditors/auditor-bugfix.md`
- Create: `.claude/agents/layers/bmad-code-reviewer-lifecycle.md`
- Modify: `.claude/agents/bmad-master.md`
- Create: `scripts/accept-e4-extensions.ts`

**Test type:** Contract + behavior mix

**Step 1: Write the failing test**

断言新增 agent 都遵循同一协议：

```ts
for (const content of extensionAgents) {
  expect(content).toContain('bmad-progress.yaml');
  expect(content).toContain('audit-result-schema.md');
  expect(content).toContain('禁止自行 commit');
}
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-e4-extensions.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

扩展顺序必须是：
1. `bmad-standalone-tasks`
2. `auditor-tasks-doc`
3. `bmad-bug-agent`
4. `auditor-bugfix`
5. `bmad-code-reviewer-lifecycle`

每个扩展都只复用 MVP 已定义协议，不另起新状态格式。

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-e4-extensions.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .claude/agents scripts/accept-e4-extensions.ts
git commit -m "feat: extend bmad claude flow to standalone and bug workflows"
```

---

## Extension Workflow Mapping

| Workflow | Reuse | Extra fields |
|---|---|---|
| `bmad-standalone-tasks` | `audit-result-schema.md`, `handoff-schema.md`, `commit-protocol.md` | `task_doc_type`, `task_scope` |
| `bmad-standalone-tasks-doc-review` | `audit-result-schema.md` | `doc_scope`, `doc_review_round` |
| `bmad-bug-assistant` | `audit-result-schema.md`, `handoff-schema.md`, `commit-protocol.md` | `bug_id`, `root_cause_status`, `fix_verdict` |
| `bmad-code-reviewer-lifecycle` | `audit-result-schema.md`, `handoff-schema.md` | `review_round`, `review_verdict`, `reopen_reason` |

## Verification Checklist

- [ ] `bmad-progress.yaml` 是唯一业务真相，runtime projections 不覆盖它
- [ ] Layer 4 三阶段都有显式 skill 读取、auditor 调用、评分触发、状态更新
- [ ] commit gate 明确只接受 `commit_request`
- [ ] implement 审计通过前无法提交
- [ ] hooks 只做观测与恢复，不承担最终放行裁决
- [ ] 至少先完成一次 dry-run，再完成一个真实 Story 闭环
- [ ] standalone tasks / bug assistant / reviewer lifecycle 在第二阶段复用同一协议扩展

## Test Commands

```bash
rtk vitest run scripts/accept-e4-s1.ts
rtk vitest run scripts/accept-e4-s2.ts
rtk vitest run scripts/accept-e4-audit-parser.ts
rtk vitest run scripts/accept-e4-master.ts
rtk vitest run scripts/accept-e4-auditors.ts
rtk vitest run scripts/accept-e4-specify-agent.ts
rtk vitest run scripts/accept-e4-plan-agent.ts
rtk vitest run scripts/accept-e4-tasks-agent.ts
rtk vitest run scripts/accept-e4-commit-gate.ts
rtk vitest run scripts/accept-e4-runtime.ts
rtk vitest run scripts/accept-e4-dry-run.ts
rtk vitest run scripts/accept-e4-extensions.ts
rtk npm run accept:e4-s1
rtk npm run accept:e4-s2
rtk lint
```

## Notes for the implementer

- 不要把 `_bmad/core/tasks/workflow.xml` 原样搬进 Claude Code；这里只把它当参考，不当执行引擎。
- 不要让 hooks 直接判断阶段通过与否。
- 不要允许任何执行 Agent 直接 `git commit`。
- 不要在 MVP 阶段引入数据库、并发 worker、复杂评分模型。
- 所有新增流程都要复用 `.claude/protocols/*.md`，不要另起一套状态字段。

## Changelog from Review Incorporation

- 明确所有新增测试文件为 `Create`，去掉“或新建”的模糊表达
- 增加 `Execution Strategy`，区分 contract tests / behavior tests / pilot validation
- 新增 `Runtime Entry Decision`，明确 `bmad-master` 在 Claude Code 中的主入口与兼容入口
- 新增 `Hook Failure Policy`，明确 hooks/worker 失败不阻断主流程
- 新增 `Task 3` 审计结果解析辅助函数，避免 master 直接依赖自然语言审计结论
- 在真实 Story 试点前新增 dry-run 阶段
- 新增 `Extension Workflow Mapping`，明确四类扩展流程复用协议与额外字段

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-13-bmad-claude-code-cli-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?