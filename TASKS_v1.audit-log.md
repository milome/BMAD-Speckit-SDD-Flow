# TASKS_v1 Audit Log

> 用途：执行 `TASKS_v1.md` 时的持续审计记录。  
> 规则：每完成一个任务（T*）立即追加一条记录；未通过 Gate 的任务不得标记完成。
>
> 统一引用（single source）：
> - 策略层：`_bmad/_config/orchestration-governance.contract.yaml`
> - 事实层：`_bmad-output/runtime/governance/user_story_mapping.json`

---

## 0. Run Metadata

- Run ID:
- Start Time:
- Owner:
- Branch:
- Environment (Cursor/Claude/no-hooks):
- Reference:
  - `TASKS_v1.md`
  - `TASKS_v1.audit.md`
- Governance Sources:
  - Contract: `_bmad/_config/orchestration-governance.contract.yaml`
  - Index: `_bmad-output/runtime/governance/user_story_mapping.json`
- Single-Source Boundary Check (required):
  - contract: rules only
  - mapping: facts only
  - runtimePolicy: session params only + contractHash + mappingHash
  - orchestration entrypoint: inspect surface only
  - CI single-source tests: pass required
- Field Whitelist Check (required):
  - whitelist ref: `TASKS_v1.md` §0.1.2
  - contract whitelist: pass/fail
  - mapping whitelist: pass/fail
  - runtimePolicy whitelist: pass/fail
  - inspect-surface-only decision path: pass/fail
- 编排时序图（现状 / 目标态 / Host parity 泳道）：见 `TASKS_v1.md` 第 **0.3** 节（含 **0.3.3**）。

---

## 1. Status Board

| Task ID | Status (todo/in_progress/pass/partial/fail) | Last Update | Owner | Notes |
| --- | --- | --- | --- | --- |
| T1.1 | todo | - | - | - |
| T1.2 | todo | - | - | - |
| T1.3 | todo | - | - | - |
| T1.4 | todo | - | - | - |
| T1.5 | todo | - | - | - |
| T1.6 | todo | - | - | - |
| T1.7 | todo | - | - | - |
| T1.8 | todo | - | - | - |
| T1.9 | todo | - | - | - |
| T1.10 | todo | - | - | - |
| T1.11 | todo | - | - | - |
| T1.12 | todo | - | - | - |
| T1.13 | todo | - | - | - |
| T1.14 | todo | - | - | - |
| T1.15 | todo | - | - | - |
| T1.16 | todo | - | - | - |
| T2.1 | todo | - | - | - |
| T2.2 | todo | - | - | - |
| T3.1 | todo | - | - | - |
| T3.2 | todo | - | - | - |
| T3.3 | todo | - | - | - |
| T4.1 | todo | - | - | - |
| T4.2 | todo | - | - | - |
| T5.1 | todo | - | - | - |
| T5.2 | todo | - | - | - |
| T5.3 | todo | - | - | - |

---

## 2. Audit Entries

> 复制以下模板，每个任务至少 1 条记录；若修复后重审，可对同一 Task ID 增加多条。

### Entry Template

```md
### Audit Record - <Task ID> - <YYYY-MM-DD HH:mm>

- Owner:
- Scope:
- Change Summary:

#### Evidence
- Commands:
  - `<command>`
  - `<command>`
- Output Summary:
  - `<key result>`
  - `<key result>`
- Artifacts:
  - `<file path>`
  - `<file path>`

#### Gates
- G0 (完整性): pass | partial | fail
- G1 (主循环契约): pass | partial | fail
- G2 (状态机恢复): pass | partial | fail
- G3 (Host Parity): pass | partial | fail
- G4 (Closeout): pass | partial | fail
- G5 (Contract/Index): pass | partial | fail

#### Adaptive Intake Gate Evidence
- Match Scoring:
  - domain_fit:
  - dependency_fit:
  - sprint_fit:
  - risk_fit:
  - readiness_fit:
- Consistency Checks:
  - mapping_consistency: pass | partial | fail
  - lifecycle_consistency: pass | partial | fail
  - sprint_consistency: pass | partial | fail
- Verdict:
  - pass | warn | block

#### Contract/Index Evidence
- Contract Version:
  - `<version>`
- Contract Path:
  - `_bmad/_config/orchestration-governance.contract.yaml`
- Index Snapshot:
  - `<path + checksum>`
- Index Path:
  - `_bmad-output/runtime/governance/user_story_mapping.json`
- Runtime Policy Snapshot:
  - `<path + checksum>`
- Hash Binding:
  - contractHash: `<value>`
  - mappingHash: `<value>`
- Inspect Surface Entry:
  - `<inspect output path/summary>`
- Field Whitelist Evidence:
  - contract keys: `<actual keys>`
  - mapping item keys: `<actual keys>`
  - runtimePolicy keys: `<actual keys>`
  - whitelist verdict: `<pass/fail + note>`
- Source-of-Truth Check:
  - `<pass/fail + note>`

#### Verdict
- Final: pass | partial | fail
- Blockers:
  - `<none or blocker>`
- Next Action:
  - `<next step>`
```

---

## 3. Task-Specific Log Sections

### T1.1 - Host Parity 回归矩阵

<!-- 在此追加 Audit Record -->

### T1.2 - State 幂等与重入

<!-- 在此追加 Audit Record -->

### T1.3 - Gates Loop 异常补偿

<!-- 在此追加 Audit Record -->

### T1.4 - Contract/Index 收敛接入

<!-- 在此追加 Audit Record -->

### T1.5 - StageName 对齐治理合同

<!-- 在此追加 Audit Record -->

### T1.6 - 返工闭环自动续跑

<!-- 在此追加 Audit Record -->

### T1.7 - Release Gate 总控脚本

<!-- 在此追加 Audit Record -->

### T1.8 - 代码质量退化硬阈值

<!-- 在此追加 Audit Record -->

### T1.9 - 审计状态自动回写

<!-- 在此追加 Audit Record -->

### T1.10 - 故障注入与恢复验收

<!-- 在此追加 Audit Record -->

### T1.11 - P0 硬校验（validate-single-source-whitelist）

<!-- 在此追加 Audit Record -->

### T1.12 - P0 闭环校验（main-agent-rerun-gate-e2e-loop）

<!-- 在此追加 Audit Record -->

### T1.13 - P0 总门禁（main-agent:release-gate）

<!-- 在此追加 Audit Record -->

### T1.14 - P0 写入前置闭环（sprint-status 资格令牌）

<!-- 在此追加 Audit Record -->

### T1.15 - P0 真用户路径 E2E（双宿主 Claude/Codex）

<!-- 在此追加 Audit Record -->

### T1.16 - P0 反旁路硬门禁（sprint-status 写路径）

<!-- 在此追加 Audit Record -->

### T2.1 - Long-Run Runtime Policy

<!-- 在此追加 Audit Record -->

### T2.2 - Soak Test (>=8h)

<!-- 在此追加 Audit Record -->

### T3.1 - Churn-in 路由评分器

<!-- 在此追加 Audit Record -->

### T3.2 - Sprint Epic/Story Queue 自动联动

<!-- 在此追加 Audit Record -->

### T3.3 - Adaptive Intake Governance Gate

<!-- 在此追加 Audit Record -->

### T4.1 - Parallel Planner + Write Scope Lock

<!-- 在此追加 Audit Record -->

### T4.2 - PR Topology Orchestration

<!-- 在此追加 Audit Record -->

### T5.1 - ADR Drift Guard

<!-- 在此追加 Audit Record -->

### T5.2 - 三向追踪矩阵

<!-- 在此追加 Audit Record -->

### T5.3 - Single Source Guard

<!-- 在此追加 Audit Record -->

---

## 4. Milestone Checkpoints

### M1 Checkpoint
- Date:
- Overall Verdict:
- Open Risks:
- Go/No-Go:

### M2 Checkpoint
- Date:
- Overall Verdict:
- Open Risks:
- Go/No-Go:

### M3 Checkpoint
- Date:
- Overall Verdict:
- Open Risks:
- Go/No-Go:

### M4 Checkpoint
- Date:
- Overall Verdict:
- Open Risks:
- Go/No-Go:

### M5 Checkpoint
- Date:
- Overall Verdict:
- Open Risks:
- Go/No-Go:

---

## 5. Final Closeout

- Closeout Date:
- Final Result: pass | partial | fail
- Acceptance Summary:
  - [ ] P0 全部通过
  - [ ] 8h soak 达标
  - [ ] 并行冲突治理达标
  - [ ] closeout 语义严格执行
- Residual Risks:
  - `<none or risks>`
- Follow-up Plan:
  - `<actions>`

