# Requirements Authoring Runtime Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 requirements authoring 收敛为“确定性编译 + 每个 semantic hash 一次独立 Judge + 原子确认发布”的单一生产状态机，删除旧三轮 Critical Auditor，修正语义身份，消除重复 payload，并为 repair 与临时文件建立硬预算和可验证 GC。

**Architecture:** 以 canonical Semantic IR 作为唯一语义权威，将 source binding、derived projections、render outputs 和 transport receipts 从 semantic identity 中分离。同步编译阶段只生成一个 content-addressed build；Judge 只绑定 semantic hash 与审计策略版本；确认后原子提升 active build，并通过 mark-and-sweep 清理不可达 staging、attempt 和 quality artifacts。

**Tech Stack:** TypeScript、Node.js filesystem APIs、Vitest、JSON Schema、现有 `bmad-speckit` CLI、现有 atomic write/CAS helpers。

---

## 1. Problem Statement

当前 requirements authoring 同时保留两套不一致的审计协议：旧 `authoring-repair` lane 要求三个 current-hash Critical Auditor no-gap receipts，新 production author action 则通过一次 Judge 形成独立语义审计。两套协议共享部分 artifact 和入口，却使用不同身份、不同收敛条件和不同持久化模型，导致同一需求被重复审计、派生文件的非语义变化触发重审、失败 repair 在确认无进展前写出完整 CP00-08 文件集。

真实 RequirementRecord 已出现以下放大结果：

- 正式源为 62,424 bytes、533 行。
- repair draft 为 978,864 bytes、24,551 行，其中 inline `implementationConfirmation` 为 914,934 bytes、24,009 行。
- `intake-receipt.json` 为 16,753,703 bytes，`intent-lineage-ledger.json` 为 16,257,301 bytes。
- authoring 目录累计 1,338 个文件、231.23 MiB、22 个 CATX transaction。
- 当前真实记录的 material root 数量为 `R=109`，但 24,441 条 excluded 行仍逐条保存 path、content/hash、decision hash、classification hash、rule 和 reason。`109` 仅是本次回归样本值，不是运行时常量。
- 一个 closed attempt 约写出 34 个 attempt-local 文件；Judge packet、projection payload 和 final render 形成 17 至 20 份物理 payload 副本。

这些数据证明增长来自反规范化、逐行证明、重复内嵌和永久保存临时 transaction，不来自业务语义规模。

## 2. Required End State

生产链必须收敛为：

```text
InputAdapter
  -> ImmutableSourceBlob
  -> SemanticCompiler
  -> CanonicalSemanticRevision
  -> DeterministicValidation
  -> RiskPolicy
  -> JudgeOncePerAuditBinding
  -> ReviewCandidate
  -> ExplicitConfirmation
  -> AtomicBuildPromotion
  -> BoundedGarbageCollection
```

状态机只允许以下公共 lifecycle：

```text
needs_input | validating | audit_pending | ready_to_confirm | confirmed | blocked
```

审计与 repair 预算固定为：

- 每个 `auditBindingHash` 最多一次 accepted Judge invocation；active operation 固定一个 `auditPolicyHash`，普通 resume 不得因部署后的 prompt/policy 变化创建新 binding。
- 一次 authoring operation 最多一次自动 repair。
- repair 只有在 `afterSemanticHash !== beforeSemanticHash` 时才能触发第二次 Judge。
- 第二次 Judge 仍失败时进入 `blocked`，不得自动创建后继 CATX、request 或 repair workspace。
- deterministic compile 和 validation 可重跑，但不得创建 Critical Auditor round、no-gap receipt 链或新的 semantic revision。

持久化预算固定为：

- 一个 canonical source blob。
- 一个 active canonical semantic revision。
- 一个 active source binding。
- 一个 active content-addressed build 和一个 immediate predecessor。
- 一个最终 Judge request/response/decision identity 集。
- 一个最终 promotion receipt。
- 一个最新失败摘要；失败 payload 不永久复制。
- 每个 RequirementRecord durable artifacts 硬上限 32 MiB；达到 24 MiB 时拒绝创建新的非必要 projection 并运行 GC，达到 32 MiB 时 fail closed。

## 3. Scope

本计划修改以下责任域：

1. semantic、binding、projection、transport 四类 hash 的边界和 schema。
2. 新 production author action 与 legacy `authoring-repair` 的审计权威统一。
3. Critical Auditor 三轮协议、renderer/reverse-audit 依赖和旧 fixture 的删除。
4. file intake、excerpt、lineage exclusion 的紧凑表示。
5. Judge packet 与 build artifact 的 content-addressed 引用化。
6. repair preflight、no-progress 检测、operation-level budget。
7. `authoring/builds/<buildHash>` durable layout、真正的 `.staging`、终态清理与 orphan GC。
8. install surface、generated Skill surface、schema、CLI 和 consumer migration。

## 4. Non-Goals

- 不改变业务 MUST、task、target、command、trace、evidence 或 acceptance 的含义。
- 不放宽 Judge unavailable、Judge non-pass、CAS conflict、source-binding mismatch 的 fail-closed 行为。
- 不删除显式用户确认。
- 不把 renderer、HTML 或 Markdown 重新定义为 semantic authority。
- 不保留旧三轮协议作为兼容 fallback；兼容层只能读取旧 receipt，不能继续生成新 receipt。
- 不以 gzip 或压缩归档掩盖重复存储；必须先消除重复 ownership 和重复 payload。
- 不通过提高 32 MiB 上限处理增长；上限是熔断器，不是容量目标。

## 5. Success Budgets

以下预算是验收条件，不是观测指标：

| Dimension | Required budget |
|---|---:|
| Accepted Judge invocations per unchanged audit binding | 1 |
| Automatic repair per operation | 1 |
| Judge calls after one semantic repair | 1 additional call |
| New Critical Auditor round receipts | 0 |
| Source body copies per RequirementRecord | 1 |
| Judge audit packet payload copies | 1 canonical blob |
| Durable builds | active + immediate predecessor |
| Durable failed attempts | latest compact failure summary only |
| Orphan staging retention | 24 hours maximum |
| Standard user-visible actions without unresolved decisions | author + confirm |
| Durable record warning threshold | 24 MiB |
| Durable record hard limit | 32 MiB |

对于当前 62 KiB、`R=109` 的真实回归 fixture，迁移后的 target budget 为 durable artifacts 小于 8 MiB。运行时必须接受动态 `R`，不得依赖或断言 `R=109`。32 MiB 仅用于阻止异常放大，不能作为正常规模。

## 6. File Ownership Map

| Responsibility | Primary files |
|---|---|
| Production author/repair state machine | `packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts` |
| Retired requirements-authoring surface deletion and unsupported-version rejection | `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts` |
| Canonical semantic identity | `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline.ts` |
| Judge lifecycle and request identity | `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle.ts`, `requirements-contract-judge-request-identity.ts`, `requirements-contract-production-judge-pipeline.ts` |
| Intake and lineage compaction | `requirements-contract-file-intake-receipt.ts`, `requirements-contract-entry-authority-facade.ts`, `requirements-contract-intent-lineage.ts` |
| Projection/build publication | `requirements-contract-cp05-cp08.ts`, `requirements-contract-authoring-manifest.ts`, `requirements-contract-authority-publication-committer.ts` |
| Confirmation promotion | `requirements-contract-confirmation-acceptance.ts` |
| Retention and limits | new focused modules under `packages/bmad-speckit/src/main-agent/source-authority/scripts/` |
| Canonical skill contract | `_bmad/skills/requirements-contract-authoring/` and generated mirrors |
| Regression coverage | `tests/acceptance/`, `tests/e2e/`, `tests/performance/` |

The implementation must keep each new module under one responsibility. GC, budget evaluation, semantic hashing and audit reuse must not be added as new blocks inside the existing 1.6 MiB legacy orchestration file.

## 7. Identity Model

Identity 必须按职责分域，禁止一个 hash 同时承担语义身份、文件完整性、缓存键和审计失效判定。

| Identity | Canonical input | Must exclude | Consumer |
|---|---|---|---|
| `scopeSemanticHash` | normalized requirements, atoms, action, oracle, dependencies, constraints, evidence semantics | path, offsets, language, timestamps, renderer, projection refs | semantic revision, Judge binding |
| `sourceBindingHash` | source blob hash, source IDs, offsets/ranges, binding relationships | absolute path, createdAt | source rebinding and locator validation |
| `projectionSetHash` | role + schema + canonical projection content hash | output path, timestamps | deterministic projection cache |
| `buildHash` | semantic hash + binding hash + compiler identity + sorted artifact blob refs | attempt ID, staging path, createdAt | durable build address |
| `auditPolicyHash` | Judge prompt hash + rubric hash + response schema hash | provider, transport attempt, token reserve, timestamp | explicit audit-policy version |
| `judgeInputSemanticHash` | canonical Semantic IR identity + sorted semantic audit-slice hashes + required coverage semantics + Judge protocol version | content refs, paths, raw bytes hashes, renderer output | identity of the semantic packet actually reviewed |
| `auditBindingHash` | judge input semantic hash + audit policy hash | source location, build path, renderer, language, timestamps | Judge once/reuse key |
| `judgeRequestHash` | canonical transport request | createdAt and transport retry metadata | request/response integrity |
| `contentHash` | raw SHA-256 of exact bytes | none | content-object path, physical deduplication and readback |
| `artifactBytesHash` | role + media type + raw content hash | paths and timestamps | logical artifact/media binding, never object addressing |

### Task 1: Make semantic hashes content-complete

**Files:**

- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-identity.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-authoring-identity.schema.json`
- Create: `tests/acceptance/requirements-contract-semantic-hash-boundaries.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-metamorphic.test.ts`

- [ ] **Step 1: Write a failing metamorphic test for semantic identity**

Add a fixture builder that returns one canonical semantic payload and explicitly mutate one variable per assertion:

```ts
it('changes only for semantic mutations', () => {
  const baseline = semanticFixture();
  const baselineHash = scopeSemanticHash(baseline.semanticPayload);

  expect(scopeSemanticHash(withAction(baseline, 'Persist order atomically.')))
    .not.toBe(baselineHash);
  expect(scopeSemanticHash(withOracle(baseline, 'Readback equals committed bytes.')))
    .not.toBe(baselineHash);
  expect(scopeSemanticHash(withDependencies(baseline, ['MUST-002-A1'])))
    .not.toBe(baselineHash);

  expect(scopeSemanticHash(withLanguage(baseline, 'zh-CN'))).toBe(baselineHash);
  expect(scopeSemanticHash(withSourcePath(baseline, 'docs/moved.md'))).toBe(baselineHash);
  expect(scopeSemanticHash(withCreatedAt(baseline, '2030-01-01T00:00:00Z')))
    .toBe(baselineHash);
  expect(scopeSemanticHash(withDerivedView(baseline, 'VIEW-RENDER-002')))
    .toBe(baselineHash);
});
```

- [ ] **Step 2: Run the semantic boundary test and verify it fails**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-semantic-hash-boundaries.test.ts --reporter=dot
```

Expected: FAIL because the current test fixture cannot project an explicit semantic allowlist and non-semantic mutations still enter confirmation identity.

- [ ] **Step 3: Add explicit hash domains and canonical projectors**

Extend `REQUIREMENTS_AUTHORING_HASH_DOMAINS` and export domain functions. Do not add another recursive denylist.

```ts
export const REQUIREMENTS_AUTHORING_HASH_DOMAINS = {
  ...existingDomains,
  projectionSetHash: 'requirements-projection-set/v2',
  buildHash: 'requirements-authoring-build/v2',
  auditPolicyHash: 'requirements-audit-policy/v1',
  auditBindingHash: 'requirements-audit-binding/v1',
} as const;

export function buildHash(payload: {
  scopeSemanticHash: string;
  sourceBindingHash: string;
  compilerIdentity: string;
  artifacts: Array<{ role: string; schemaVersion: string; blobHash: string }>;
}): string {
  return requirementsContractDomainHash(
    REQUIREMENTS_AUTHORING_HASH_DOMAINS.buildHash,
    {
      ...payload,
      artifacts: [...payload.artifacts].sort((a, b) => a.role.localeCompare(b.role)),
    }
  );
}
```

The canonical semantic projector must use an allowlist already owned by `RequirementsContractSemanticIr.semanticPayload`. It must reject physical keys through the existing `PHYSICAL_KEYS` check instead of deleting them after hashing.

- [ ] **Step 4: Delete retired packet identity and compatibility readers**

Delete `packetHash`, `packetSemanticHash`, historical envelope hashing and every requirements-authoring compatibility reader. Current v3 compilation derives semantic identity only from the canonical `RequirementsContractSemanticIr.semanticPayload`; source location remains isolated in `sourceBindingHash`. A record with a retired top-level schema version fails at the record boundary with `requirements_authoring_record_version_unsupported` before any nested receipt, checkpoint or CATX artifact is opened.

- [ ] **Step 5: Update authoring identity schema**

The identity artifact must carry separate fields:

```ts
interface RequirementsContractAuthoringIdentityV2 {
  schemaVersion: 'requirements-contract-authoring-identity/v2';
  scopeSemanticHash: string;
  sourceBindingHash: string;
  projectionSetHash: string;
  buildHash: string;
  judgeInputSemanticHash: string;
  auditPolicyHash: string;
  auditBindingHash: string;
}
```

No field in this object may contain a filesystem path or timestamp.

- [ ] **Step 6: Run identity and metamorphic tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-semantic-hash-boundaries.test.ts tests/acceptance/requirements-contract-authoring-metamorphic.test.ts tests/acceptance/requirements-contract-authoring-identity-lifecycle.test.ts --reporter=dot
```

Expected: all tests PASS; semantic mutations change identity, physical/renderer metadata does not.

- [ ] **Step 7: Commit the identity split**

```powershell
git add packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains.ts packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir.ts packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-identity.ts packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-authoring-identity.schema.json tests/acceptance/requirements-contract-semantic-hash-boundaries.test.ts tests/acceptance/requirements-contract-authoring-metamorphic.test.ts
git commit -m "refactor(requirements): 分离语义与构建身份"
```

### Task 2: Enforce one Judge decision per audit binding

**Files:**

- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-binding.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-decision-store.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-decision.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-policy-upgrade.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-audit-policy-upgrade.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts`
- Modify: `packages/bmad-speckit/src/main-agent/runtime.ts`
- Modify: `_bmad/_schemas/requirement-record.schema.json`
- Create: `tests/acceptance/requirements-contract-judge-semantic-reuse.test.ts`
- Create: `tests/acceptance/requirements-contract-audit-policy-upgrade.test.ts`
- Modify: `tests/e2e/requirements-contract-authoring-confirmation.e2e.test.ts`

- [ ] **Step 1: Write the failing Judge reuse tests**

Cover these cases with a provider request counter:

```ts
it.each([
  ['language', mutateLanguage],
  ['source path', mutateSourcePath],
  ['render output', mutateRenderer],
  ['projection metadata', mutateProjectionMetadata],
])('reuses the Judge decision after %s changes', async (_label, mutate) => {
  const first = await runAuditedAuthoring(fixture());
  const second = await runAuditedAuthoring(mutate(first.fixture));
  expect(second.providerRequestCount).toBe(1);
  expect(second.decision.auditBindingHash).toBe(first.decision.auditBindingHash);
  expect(second.decision.reused).toBe(true);
});

it('invokes Judge once for a changed semantic hash', async () => {
  const first = await runAuditedAuthoring(fixture());
  const second = await runAuditedAuthoring(mutateOracle(first.fixture));
  expect(second.providerRequestCount).toBe(2);
  expect(second.decision.auditBindingHash).not.toBe(first.decision.auditBindingHash);
});
```

- [ ] **Step 2: Run the reuse test and verify it fails**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-judge-semantic-reuse.test.ts --reporter=dot
```

Expected: FAIL because current request identity embeds build/audit packet payload and has no semantic decision index.

- [ ] **Step 3: Implement stable audit policy and binding identities**

```ts
export interface RequirementsContractAuditBinding {
  schemaVersion: 'requirements-contract-audit-binding/v1';
  scopeSemanticHash: string;
  judgeInputSemanticHash: string;
  auditPolicyHash: string;
  auditBindingHash: string;
}

export function createRequirementsContractAuditBinding(input: {
  scopeSemanticHash: string;
  semanticAuditSlices: Array<{
    role: string;
    schemaVersion: string;
    semanticHash: string;
  }>;
  mandatoryDimensionIds: string[];
  coverageSemanticHash: string;
  judgeProtocolVersion: string;
  systemPromptHash: string;
  rubricHash: string;
  responseSchemaHash: string;
}): RequirementsContractAuditBinding {
  const auditPolicyHash = requirementsContractDomainHash(
    'requirements-audit-policy/v1',
    {
      systemPromptHash: input.systemPromptHash,
      rubricHash: input.rubricHash,
      responseSchemaHash: input.responseSchemaHash,
    }
  );
  const judgeInputSemanticHash = requirementsContractDomainHash(
    'requirements-judge-input-semantic/v1',
    {
      scopeSemanticHash: input.scopeSemanticHash,
      semanticAuditSlices: [...input.semanticAuditSlices].sort((a, b) =>
        `${a.role}\0${a.schemaVersion}\0${a.semanticHash}`.localeCompare(
          `${b.role}\0${b.schemaVersion}\0${b.semanticHash}`
        )
      ),
      mandatoryDimensionIds: [...input.mandatoryDimensionIds].sort(),
      coverageSemanticHash: input.coverageSemanticHash,
      judgeProtocolVersion: input.judgeProtocolVersion,
    }
  );
  const payload = { judgeInputSemanticHash, auditPolicyHash };
  return {
    schemaVersion: 'requirements-contract-audit-binding/v1',
    scopeSemanticHash: input.scopeSemanticHash,
    ...payload,
    auditBindingHash: requirementsContractDomainHash(
      'requirements-audit-binding/v1',
      payload
    ),
  };
}
```

Provider selection, retry ordinal, token reserve, path, binding hash, build hash and render metadata must not enter `auditPolicyHash` or `judgeInputSemanticHash`. Derived render/projection artifacts are not Judge input. If the Judge consumes an audit slice, its path-free semantic hash must enter `semanticAuditSliceHashes`.

- [ ] **Step 4: Implement the content-addressed Judge decision store**

Persist one normalized decision at:

```text
quality/semantic-decisions/<auditBindingHash-without-prefix>/decision.json
```

The stored core is:

```ts
interface RequirementsContractJudgeDecisionV1 {
  schemaVersion: 'requirements-contract-judge-decision/v1';
  scopeSemanticHash: string;
  judgeInputSemanticHash: string;
  auditPolicyHash: string;
  auditBindingHash: string;
  verdict: 'audited_pass' | 'audited_fail';
  judgeRequestRef: { path: string; hash: string };
  judgeResponseRef: { path: string; hash: string };
  aggregateRef: { path: string; hash: string };
  decisionHash: string;
}
```

`createdAt`, provider diagnostics and retry evidence stay in an envelope outside `decisionHash`.

The decision store has a CAS lifecycle at the same binding path:

```ts
type JudgeDispatchState =
  | { state: 'prepared'; dispatchIdempotencyKey: string }
  | { state: 'dispatched'; dispatchIdempotencyKey: string; attemptRef: string }
  | { state: 'response_received'; dispatchIdempotencyKey: string; responseRef: string }
  | { state: 'terminal'; decision: RequirementsContractJudgeDecisionV1 };
```

`dispatchIdempotencyKey` equals `auditBindingHash`. Adapters that support idempotency must pass it to the provider. If a non-idempotent adapter crashes in `dispatched` state before a response is recorded, resume returns `judge_dispatch_recovery_required`; it must not call the provider again automatically.

- [ ] **Step 5: Reuse before publishing a request**

`runRequirementsContractProductionJudgePipeline` must resolve `auditBindingHash` before creating `quality/active-request.json`. If a verified decision exists, return its terminal result without writing request, dispatch attempt, response, aggregate or remediation artifacts.

```ts
const reusable = readVerifiedRequirementsContractJudgeDecision({
  recordRoot: input.recordRoot,
  binding,
});
if (reusable) return terminalResultFromDecision(reusable, { reused: true });
```

The request self-hash remains a transport integrity check. It must not be used as the Judge reuse key.

- [ ] **Step 6: Make policy upgrades explicit**

One active authoring operation pins one `auditPolicyHash`. A prompt/rubric/schema upgrade uses a user-authorized `rejudge-policy-upgrade` package action with this lifecycle:

```ts
type AuditPolicyUpgradeState = 'requested' | 'audit_pending' | 'terminal' | 'blocked';

interface RequirementsAuditPolicyUpgrade {
  operationId: string;
  fromPolicyVersion: number;
  fromAuditPolicyHash: string;
  toPolicyVersion: number;
  toAuditPolicyHash: string;
  scopeSemanticHash: string;
  supersedesDecisionHash: string;
  state: AuditPolicyUpgradeState;
  operationHash: string;
}
```

Register the action in `runtime.ts`; persist `pinnedAuditPolicyHash` and `pinnedAuditPolicyVersion` in RequirementRecord state. Start requires `toPolicyVersion > fromPolicyVersion` and CAS of the current pin. Resume is idempotent and reuses the new binding decision. Downgrade/equal version returns `requirements_audit_policy_upgrade_not_monotonic`. Ordinary resume, render, binding refresh and repair never change the pin.

Add tests for ordinary resume after a deployed prompt change, one explicit upgrade invocation, repeated upgrade resume, CAS conflict and downgrade rejection.

- [ ] **Step 7: Run Judge lifecycle and E2E tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-judge-semantic-reuse.test.ts tests/acceptance/requirements-contract-audit-policy-upgrade.test.ts tests/acceptance/requirements-contract-judge-lifecycle.test.ts tests/e2e/requirements-contract-authoring-confirmation.e2e.test.ts --reporter=dot
```

Expected: all tests PASS; the confirmation E2E observes one accepted Judge invocation. Fault injection at `prepared`, `dispatched`, `response_received` and `terminal` proves resume never creates a second accepted decision for the same binding.

- [ ] **Step 8: Commit Judge reuse**

```powershell
git add packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-binding.ts packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-decision-store.ts packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-decision.schema.json packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline.ts packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle.ts packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity.ts tests/acceptance/requirements-contract-judge-semantic-reuse.test.ts tests/e2e/requirements-contract-authoring-confirmation.e2e.test.ts
git commit -m "fix(requirements): 按语义复用Judge结论"
```

## 8. Remove the Three-Round Critical Auditor Protocol

The hard cut applies to execution, schemas, generated Skill surfaces, renderer language and tests. Reducing three rounds to one round is explicitly forbidden because it preserves two independent-audit authorities.

After this task:

- deterministic gates prove structure, referential integrity, materialization and renderability;
- one production Judge proves semantic quality for the active `auditBindingHash`;
- renderer and confirmation gates consume the verified Judge decision;
- historical three-round artifacts have no reader, migration adapter or diagnostic compatibility path in v3;
- an unsupported record version is rejected from top-level metadata before any nested receipt, checkpoint or CATX artifact is opened;
- internal automatic repair runs inside the production resume action; public `authoring-repair` and `authoring_repair` aliases return `requirements_authoring_legacy_action_removed` and cannot enter production repair.

### Task 3: Hard-cut the legacy Auditor loop and make Judge the only audit authority

**Files:**

- Modify: `packages/bmad-speckit/src/main-agent/runtime.ts`
- Modify: `packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`
- Modify: `_bmad/skills/requirements-contract-authoring/SKILL.md`
- Modify: `_bmad/skills/requirements-contract-authoring/references/contract-template.md`
- Modify: `_bmad/skills/requirements-contract-authoring/references/implementation-confirmation-reference.md`
- Modify: `_bmad/skills/requirements-contract-authoring/references/html-confirmation-renderer-spec.md`
- Modify: `_bmad/skills/requirements-contract-authoring/references/reverse-audit-gate.md`
- Modify: `_bmad/skills/requirements-contract-authoring/references/semantic-checkpoint-workflow.md`
- Modify: `_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js`
- Modify: `_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts`
- Modify: `_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js`
- Delete: `_bmad/skills/requirements-contract-authoring/scripts/write-critical-auditor-no-new-gap-response.js`
- Delete after reference scan: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-critical-auditor-judge-request.schema.json`
- Create: `tests/acceptance/requirements-contract-no-three-round-authority.test.ts`
- Create: `tests/e2e/requirements-contract-authoring-repair-single-judge.e2e.test.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-gate-registry.ts`
- Create: `tests/acceptance/requirements-contract-authoring-gate-preservation.test.ts`
- Modify: `tests/acceptance/requirements-contract-cp02-no-auditor.test.ts`
- Modify or delete three-round cases: `tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-skill-contract.test.ts`
- Modify: `tests/acceptance/render-requirements-confirmation-html.test.ts`
- Modify: `tests/acceptance/reverse-audit-contract.test.ts`

- [ ] **Step 1: Write a static hard-cut test**

The test must inspect canonical sources, not generated mirrors, and fail on executable or contractual three-round identifiers:

```ts
const forbidden = [
  'runCriticalAuditorReceiptLoop',
  'consecutiveNoNewGapRounds',
  'consecutiveNoNewValidGapRounds',
  'critical-auditor-round-request-',
  'critical-auditor-round-response-',
  'critical-auditor-receipt-round-',
  'critical_auditor_less_than_three_no_new_gap_rounds',
  'restart the three-round loop',
];

it.each(canonicalAuthoringSources)('%s has no three-round authority', (file) => {
  const source = readFileSync(file, 'utf8');
  for (const token of forbidden) expect(source).not.toContain(token);
});
```

There is no allowlist for historical fields. The hard-cut test must assert that no requirements-authoring source, dist bundle or packed consumer contains a legacy audit reader, migration action, retired receipt schema, round writer or compatibility export. Generic Story/Speckit audit assets are outside this prohibition but must use neutral audit-triad naming rather than requirements-authoring protocol names.

- [ ] **Step 2: Freeze the deterministic gate baseline before deleting runtime code**

Extract the explicit current non-round gate IDs and blocking issue codes into the gate registry and commit the failing preservation test before removing any orchestration code. The baseline excludes only round request/response/receipt existence, minimum/consecutive count and round restart checks.

Add a table-driven fail-closed test: inject one blocker for every gate family and assert `provider.requests.length === 0`, no Judge decision, no review candidate and no authority promotion.

- [ ] **Step 3: Write an E2E test through the normal resume/automatic-repair path**

Create a source that receives one Judge failure followed by one repair success. Continue through `resume-author-confirmation-ready-source`; do not call a legacy repair alias. Assert:

```ts
expect(provider.requests).toHaveLength(2);
expect(first.semanticHash).not.toBe(second.semanticHash);
expect(record.lifecycle).toBe('ready_to_confirm');
expect(findFiles(recordRoot, /critical-auditor|round-(request|response|receipt)/u))
  .toEqual([]);
expect(findDirectories(recordRoot, /^CATX-/u)).toEqual([]);
```

The first request is the initial semantic revision; the second is the single permitted changed-semantic repair. A pass-first fixture must observe exactly one provider request.

- [ ] **Step 4: Run the new tests and verify they fail**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-no-three-round-authority.test.ts tests/acceptance/requirements-contract-authoring-gate-preservation.test.ts tests/e2e/requirements-contract-authoring-repair-single-judge.e2e.test.ts --reporter=dot
```

Expected: FAIL on canonical Skill text, legacy orchestration symbols and repair routing.

- [ ] **Step 5: Keep repair internal and reject legacy public aliases**

Implement one internal repair transition in `source-authority-orchestration.ts`:

```ts
async function continueAutomaticRequirementsRepair(context) {
  return resumeAuthorConfirmationReadySourceAction({
    ...context,
    args: { ...context.args, operation: 'repair' },
  });
}
```

Remove both legacy spellings from executable action maps. Public calls return a removal error:

```ts
{
  status: 'requirements_authoring_legacy_action_removed',
  issueCode: 'requirements_authoring_legacy_action_removed',
  nextAction: 'resume-author-confirmation-ready-source',
}
```

`--legacy-orchestration` must not re-enable the retired repair implementation.

- [ ] **Step 6: Delete the executable legacy round implementation**

Remove the CATX round dispatcher, request/response/receipt builders, consecutive-round counters, stale round archive, the `authoring-repair` action branch and every historical parser from `main-agent-orchestration.ts`. Preserve unrelated generic audit-triad workflows only after renaming their protocol, modules and symbols to neutral audit-triad/Judge terminology. Do not retain a throwing compatibility stub, deprecated export, schema alias or read-only summary API.

- [ ] **Step 7: Replace round convergence with the Judge decision at gates**

`pre_render_must_decomposition_gate.js` must continue checking atom/task closure, packet/source consistency and projection integrity, but remove all round receipt scanning. Renderer and reverse audit receive:

```ts
{
  auditBindingHash,
  judgeDecisionHash,
  verdict: 'audited_pass'
}
```

They must reject missing, corrupt, non-pass or semantic-hash-mismatched Judge decisions. They must not count receipts.

- [ ] **Step 8: Remove three-round fields from generated confirmation views**

Delete these fields and labels from templates and renderers:

```text
criticalAuditor
minimumRounds
consecutiveNoNewGapRounds
consecutiveNoNewValidGapRounds
latestReceiptHash
convergenceVerdict
Critical Auditor Convergence
```

Replace the user-visible audit section with one compact `Independent Semantic Audit` row containing semantic hash, audit policy hash, verdict and decision hash.

- [ ] **Step 9: Rewrite the canonical Skill contract**

The Skill must say:

```text
One independent production Judge decision is required for the active semantic hash.
Deterministic compile and validation gates may rerun without producing audit rounds.
An unchanged audit binding reuses the verified Judge decision.
One automatic repair may produce one changed semantic hash and one additional Judge call.
```

Remove instructions to create/archive/restart round request, response, receipt or dry-run files.

- [ ] **Step 10: Regenerate repository-local Skill surfaces**

Run:

```powershell
node _bmad/skills/requirements-contract-authoring/scripts/verify-requirements-contract-authoring-skill-sync.js --repo-only --sync
node _bmad/skills/requirements-contract-authoring/scripts/verify-requirements-contract-authoring-skill-sync.js --repo-only
```

Expected: synchronization reports all four repository-local surfaces current: `.codex`, `.claude`, `.cursor`, and `packages/bmad-speckit/_bmad`.

- [ ] **Step 11: Run hard-cut, gate-preservation, renderer and reverse-audit tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-no-three-round-authority.test.ts tests/acceptance/requirements-contract-authoring-gate-preservation.test.ts tests/acceptance/requirements-contract-cp02-no-auditor.test.ts tests/acceptance/requirements-contract-authoring-skill-contract.test.ts tests/acceptance/render-requirements-confirmation-html.test.ts tests/acceptance/reverse-audit-contract.test.ts tests/e2e/requirements-contract-authoring-repair-single-judge.e2e.test.ts --reporter=dot
```

Expected: all tests PASS; pass-first uses one Judge, one changed-semantic repair uses two total, and no new CATX/round artifacts exist.

- [ ] **Step 12: Commit the audit hard cut**

Stage the canonical source, generated surfaces, runtime and tests after reviewing `git diff --cached --name-only` against the file list above.

```powershell
git commit -m "refactor(requirements): 删除三轮审计协议"
```

## 9. Compact Source Intake and Intent Lineage

The source body is immutable data and must be stored once. Intake and lineage describe locations and decisions; they must never duplicate source text.

The v2 representation is:

```ts
interface RequirementsContentRef {
  schemaVersion: 'requirements-content-ref/v1';
  contentHash: `sha256:${string}`;
  byteLength: number;
  mediaType: string;
  recordRelativePath: string;
}

interface RequirementsSourceRange {
  startUtf8Byte: number;
  endUtf8ByteExclusive: number;
  startLine: number;
  endLine: number;
  contentHash: `sha256:${string}`;
}
```

`sourcePath` occurs once at the receipt top level. A material excerpt contains `sourceId + sourceRange`; it contains no `content`, no repeated path and no nested boundary object.

### Task 4: Store source bytes once and replace per-line excerpts with material ranges

**Files:**

- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-content-ref.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-file-intake-receipt.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-file-intake-receipt.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-entry-authority-facade.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-full-source-bundle.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-consumer-authority-scanner.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-compiler.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-authoring-limits.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-authoring-limits.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-source-binding.schema.json`
- Create: `tests/acceptance/requirements-contract-content-store.test.ts`
- Create: `tests/acceptance/requirements-contract-file-intake-range.test.ts`
- Create: `tests/acceptance/requirements-contract-scanner-resource-budget.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-source-normalization.test.ts`

- [ ] **Step 1: Write failing content-store tests**

Cover idempotence, tampering and path confinement:

```ts
it('publishes identical bytes once', () => {
  const first = publishRequirementsContentObject({
    recordRoot,
    role: 'source',
    mediaType: 'text/markdown; charset=utf-8',
    bytes: sourceBytes,
  });
  const second = publishRequirementsContentObject({
    recordRoot,
    role: 'source',
    mediaType: 'text/markdown; charset=utf-8',
    bytes: sourceBytes,
  });
  expect(second).toEqual(first);
  expect(inventoryContentObjects(recordRoot)).toHaveLength(1);
});

it('deduplicates identical bytes across roles and media bindings', () => {
  const source = publishObject({ role: 'source', mediaType: 'text/markdown', bytes });
  const candidate = publishObject({ role: 'review_candidate', mediaType: 'text/markdown', bytes });
  expect(candidate.contentHash).toBe(source.contentHash);
  expect(inventoryContentObjects(recordRoot)).toHaveLength(1);
});

it('blocks a tampered object', () => {
  const ref = publishSource();
  overwriteContentObject(ref.recordRelativePath, 'changed');
  expect(() => readRequirementsContentObject({ recordRoot, ref }))
    .toThrow('requirements_content_object_hash_mismatch');
});
```

- [ ] **Step 2: Write failing range-receipt tests**

Use CRLF, emoji, CJK, no-final-newline and overlapping declared roots. Assert that ranges slice exact UTF-8 bytes and that serialized receipt JSON does not contain the source body or repeat `sourcePath`:

```ts
expect(serialized.match(/sourcePath/gu)).toHaveLength(1);
expect(serialized).not.toContain(sourceText);
expect(receipt.materialExcerpts.every((excerpt) => !('content' in excerpt))).toBe(true);
expect(reconstructRanges(receipt, blob)).toEqual(expectedMaterialText);
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-content-store.test.ts tests/acceptance/requirements-contract-file-intake-range.test.ts --reporter=dot
```

Expected: FAIL because the content store and v2 range receipt do not exist.

- [ ] **Step 4: Implement the record-local content store**

Objects live at:

```text
authoring/objects/sha256/<first-two-hex>/<remaining-hex>
```

The publisher must normalize neither bytes nor media type. It computes raw `sha256(bytes)` for `contentHash` and object addressing, writes to a same-directory temporary file, verifies readback, and uses no-clobber rename. Role/media-specific `artifactBytesHash` is computed by the artifact manifest and never changes physical object identity. If the object already exists, the store verifies exact bytes and returns the same ref without writing.

```ts
export function publishRequirementsContentObject(input: {
  recordRoot: string;
  role: string;
  mediaType: string;
  bytes: Buffer;
}): RequirementsContentRef;

export function readRequirementsContentObject(input: {
  recordRoot: string;
  ref: RequirementsContentRef;
}): Buffer;

export function verifyRequirementsContentRef(input: {
  recordRoot: string;
  ref: RequirementsContentRef;
}): void;
```

Reject symlinks, junction escape, path traversal, byte-length mismatch and hash mismatch.

- [ ] **Step 5: Publish file intake receipt v2**

```ts
interface RequirementsContractFileIntakeReceiptV2 {
  schemaVersion: 'requirements-contract-file-intake-receipt/v2';
  entrySource: FileIntakeEntrySource;
  sourceId: string;
  sourcePath: string;
  sourceBlobRef: RequirementsContentRef;
  sourceBytesHash: string;
  lineCount: number;
  materialExcerpts: Array<{
    excerptId: string;
    sourceRootId: string;
    range: RequirementsSourceRange;
  }>;
  materialExcerptSetHash: string;
}
```

Generate `materialExcerpts` after source-root scanning, not by iterating every physical line. For dynamic material-root count `R`, the receipt creates exactly `R` material excerpt rows regardless of physical line count. The current 24,551-line regression fixture uses `R=109`; production code must not contain or assert that value.

- [ ] **Step 6: Build the UTF-8 line index once in memory**

Add a pure helper used by scanner, source compiler and range validation:

```ts
interface Utf8LineIndex {
  byteLength: number;
  lineStartOffsets: Uint32Array;
}

export function buildUtf8LineIndex(bytes: Buffer): Utf8LineIndex;
export function lineRangeToByteRange(
  index: Utf8LineIndex,
  startLine: number,
  endLine: number
): { startUtf8Byte: number; endUtf8ByteExclusive: number };
```

Do not persist the line index. Do not call `Buffer.from(sourceContent)` once per MUST candidate.

- [ ] **Step 7: Replace the scanner's fixed 128-candidate cap with shared resource budgets**

Remove the scanner-local fixed `128` candidate/root limit. Pass `RequirementsAuthoringLimits` into scanning and account each discovered root through the shared `maxSemanticNodes`, `maxSourceSpans`, source-byte and durable-byte budgets. Do not introduce another fixed material-root count.

```ts
it.each([1, 109, 129, 1_000])(
  'accepts R=%i material roots when shared budgets allow it',
  (rootCount) => {
    const result = scanWithLimits(fixture(rootCount), {
      maxSemanticNodes: rootCount + 10,
      maxSourceSpans: rootCount + 10,
    });
    expect(result.sourceRootCandidates).toHaveLength(rootCount);
  }
);

it('blocks by configured semantic-node budget rather than fixed root count', () => {
  expect(() => scanWithLimits(fixture(129), {
    maxSemanticNodes: 128,
    maxSourceSpans: 256,
  })).toThrow('requirements_semantic_node_count_exceeded');
});
```

Add generated property cases with random `R` and line counts. The same input and limits must produce the same roots independent of batching.

- [ ] **Step 8: Remove embedded source content from typed candidates**

Replace `sourceContent` on each `ProductionSemanticSourceRoot` with `sourceBlobRef` and `sourceRange`. Resolve bytes once at compiler entry and pass a read-only source view to candidate compilation.

Write `sourceBlobRef` into the active source-binding capsule and schema. The binding must expose a traversable content ref, not only a source bytes hash, so GC can mark the active source object.

- [ ] **Step 9: Keep v1 read-only migration support**

`readRequirementsContractFileIntakeReceipt` accepts v1 and v2. A v1 receipt is verified against its reconstructed source once, converted in memory to v2 and persisted only when a new build is committed. New writers must reject `schemaVersion: .../v1`.

- [ ] **Step 10: Run source normalization, scanner-budget and intake tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-content-store.test.ts tests/acceptance/requirements-contract-file-intake-range.test.ts tests/acceptance/requirements-contract-scanner-resource-budget.test.ts tests/acceptance/requirements-contract-authoring-source-normalization.test.ts tests/acceptance/requirements-contract-authoring-session-prompt-intake.test.ts --reporter=dot
```

Expected: all tests PASS; Unicode byte ranges and current source-range reads are lossless.

- [ ] **Step 11: Commit source compaction**

```powershell
git commit -m "refactor(requirements): 单份存储需求源正文"
```

### Task 5: Store material lineage and aggregate excluded ranges

硬规则：持久化 `R` 个实际 material roots；当前回归 fixture 使用 `R=109`。运行时、schema 和 gate 不得依赖或断言 `R=109`。root 容量只服从可配置的 semantic-node、source-span、source-byte 和 durable-byte resource budget。

**Files:**

- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-intent-lineage.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-intent-lineage-ledger.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-entry-authority-facade.ts`
- Create: `tests/acceptance/requirements-contract-intent-lineage-range.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-authority-grounding.test.ts`

- [ ] **Step 1: Write failing range aggregation tests**

Required cases:

```ts
it('coalesces ten thousand excluded lines into one range', () => {
  const ledger = createLineageFor(excludedLineFixture(10_000));
  expect(ledger.materialRoots).toHaveLength(0);
  expect(ledger.excludedRanges).toHaveLength(1);
});

it.each([1, 109, 129, 1_000])('keeps R=%i roots without per-line classifications', (R) => {
  const ledger = createLineageFor(realScaleFixture({ roots: R, lines: 24_551 }));
  expect(ledger.materialRoots).toHaveLength(R);
  expect(ledger).not.toHaveProperty('classifications');
  expect(JSON.stringify(ledger)).not.toContain('classificationHash');
});
```

Also cover alternating exclusion reasons, overlapping material roots, byte gaps, invalid offsets and multibyte boundaries.

- [ ] **Step 2: Run the range lineage test and verify it fails**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-intent-lineage-range.test.ts --reporter=dot
```

Expected: FAIL because the current ledger requires one classification per excerpt.

- [ ] **Step 3: Define intent-lineage v2**

```ts
interface RequirementsContractIntentLineageLedgerV2 {
  schemaVersion: 'requirements-contract-intent-lineage-ledger/v2';
  sourceId: string;
  sourceBlobRef: RequirementsContentRef;
  materialRoots: Array<{
    sourceRootId: string;
    disposition: 'source_root' | 'duplicate' | 'superseded' | 'rejected';
    sourceRange: RequirementsSourceRange;
    semanticNodeRefs: string[];
    decisionReceiptRef?: string;
  }>;
  excludedRanges: Array<{
    startUtf8Byte: number;
    endUtf8ByteExclusive: number;
    startLine: number;
    endLine: number;
    exclusionRuleRef: string;
    reasonCode: string;
  }>;
  coverageHash: string;
  ledgerHash: string;
}
```

There is one ledger hash and one coverage hash. Do not generate `decisionHash` and `classificationHash` for every excluded range.

- [ ] **Step 4: Implement interval-sweep classification**

Sort material ranges once, compute their union, then derive the excluded complement. Coalesce adjacent excluded ranges only when `exclusionRuleRef` and `reasonCode` match.

```ts
export function coalesceIntentLineageRanges(
  ranges: readonly ExcludedRange[]
): ExcludedRange[];

export function validateIntentLineageCoverage(input: {
  sourceByteLength: number;
  materialRanges: readonly RequirementsSourceRange[];
  excludedRanges: readonly ExcludedRange[];
}): void;
```

Validation must prove that the union of material and excluded bytes covers `[0, sourceByteLength)` with no illegal excluded/material overlap.

- [ ] **Step 5: Add v1-to-v2 migration**

`migrateIntentLineageV1ToV2` verifies all old classifications first, retains material/duplicate/superseded/rejected facts, and collapses old excluded rows. It must not copy old `classificationHash` values into v2.

- [ ] **Step 6: Add a serialized-size regression**

For any fixture with `R` material roots and `X` coalesced excluded ranges:

```ts
const controlBytes = Buffer.byteLength(JSON.stringify(receipt) + JSON.stringify(ledger));
expect(controlBytes).toBeLessThanOrEqual(65_536 + R * 1_024 + X * 512);
```

This proves control metadata grows as `O(R + X)`, not with physical line count, and prevents reintroducing a 33 MiB receipt/ledger through new field names. The current regression case binds `R=109`; runtime code remains generic.

- [ ] **Step 7: Run lineage and grounding tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-intent-lineage-range.test.ts tests/acceptance/requirements-contract-authoring-authority-grounding.test.ts --reporter=dot
```

Expected: all tests PASS; 10,000 identical exclusions become one range and source-root grounding remains exact.

- [ ] **Step 8: Commit lineage compaction**

```powershell
git commit -m "refactor(requirements): 聚合意图谱系排除范围"
```

## 10. Make Checkpoints Resumable Without Duplicating Payloads

CP00-08 remain durable semantic checkpoints because atomic decomposition, source grounding and projection planning can be interrupted. Removing their persistence would recreate the timeout and stream-loss failure that checkpointing was introduced to solve.

The repair is to make checkpoints small and referential:

- every semantic payload is written once to the content store;
- each checkpoint atomically replaces one fixed-name state manifest containing content refs;
- a long checkpoint may persist bounded root batches and replace its progress state after each batch;
- unchanged inputs reuse the existing checkpoint state;
- downstream invalidation starts at the first affected checkpoint, not CP00;
- no checkpoint creates per-artifact receipts, path/timestamp hash chains or full payload copies;
- the final build manifest aggregates the terminal refs and validation decisions.

### Task 6: Publish resumable content-addressed checkpoints and one final build

**Files:**

- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-build-manifest.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-authoring-checkpoint-manifest.schema.json`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-checkpoint-store.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-semantic-checkpoint-state.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp05-cp08.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authority-publication-committer.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-artifact-resolver.ts`
- Create: `tests/acceptance/requirements-contract-content-addressed-build.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-manifest-contract.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-compiler-invariant-closure.test.ts`

- [ ] **Step 1: Write a failing cross-attempt deduplication test**

Interrupt after CP03, resume, and compile the same semantic input under two operation IDs. Assert completed work is reused and every payload has one physical copy:

```ts
const interrupted = await compileUntil({ operationId: 'OP-A', stopAfter: 'cp03', source });
const resumed = await resumeCompile({ operationId: interrupted.operationId });
const second = await compileAndPublish({ operationId: 'OP-B', source });

expect(resumed.executedCheckpointIds).toEqual(['cp04', 'cp05', 'cp06', 'cp07', 'cp08']);
expect(second.buildHash).toBe(resumed.buildHash);
expect(second.artifacts).toEqual(resumed.artifacts);
expect(uniqueContentObjectCount(recordRoot)).toBe(resumed.uniqueArtifactCount);
expect(findFiles(recordRoot, /receipt.*cp\d+|\d+-cp\d+/u)).toEqual([]);
expect(totalCheckpointStateBytes(recordRoot)).toBeLessThanOrEqual(65_536 + R * 512);
```

Add a sentinel action/oracle string and assert identical full payload hashes map to one object. Separately assert non-render projections store `semanticNodeRefs` instead of repeating the sentinel text; the canonical Semantic IR and user-facing review candidate are allowed to contain it.

- [ ] **Step 2: Run the build deduplication test and verify it fails**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-content-addressed-build.test.ts --reporter=dot
```

Expected: FAIL because current CP00-08 publication writes attempt-local payloads and chained checkpoint receipts, while resume cannot reuse compact ref-only state.

- [ ] **Step 3: Define build manifest v2**

```ts
interface RequirementsAuthoringArtifactEntryV2 {
  role: RequirementsAuthoringArtifactRole;
  schemaVersion: string;
  semanticHash: string;
  contentRef: RequirementsContentRef;
}

interface RequirementsContractBuildManifestV2 {
  schemaVersion: 'requirements-contract-build-manifest/v2';
  scopeSemanticHash: string;
  sourceBindingHash: string;
  compilerIdentity: string;
  projectionSetHash: string;
  checkpointSummary: {
    checkpointIds: string[];
    terminalStateHashes: string[];
    checkpointSummaryHash: string;
  };
  validationSummary: {
    decision: 'pass';
    checkIds: string[];
    validationHash: string;
  };
  artifactEntries: RequirementsAuthoringArtifactEntryV2[];
  buildHash: string;
}
```

`authoringAttemptId`, target paths, input paths and timestamps belong to an operation envelope and are excluded from `buildHash`. Terminal checkpoint state hashes are included only through the stable `checkpointSummaryHash`.

- [ ] **Step 4: Define fixed-name semantic checkpoint state**

```ts
interface RequirementsSemanticCheckpointState {
  schemaVersion: 'requirements-semantic-checkpoint-state/v1';
  operationId: string;
  checkpointId: 'cp00' | 'cp01' | 'cp02' | 'cp03' | 'cp04' | 'cp05' | 'cp06' | 'cp07' | 'cp08';
  semanticInputHash: string;
  planHash: string;
  completedUnits: Array<{
    unitId: string;
    unitInputHash: string;
    compilerVersion: string;
    outputRefs: RequirementsContentRef[];
  }>;
  pendingUnitIds: string[];
  validatorVersion: string;
  decision: 'in_progress' | 'passed' | 'blocked';
  stateHash: string;
}
```

Persist exactly one file per stage at `authoring/operations/<operationId>/checkpoints/<checkpointId>.json`. Updating progress atomically replaces that file; it does not append another receipt/version. `stateHash` excludes path and time. The parent operation manifest supplies `updatedAt` and `leaseExpiresAt` for recovery/GC.

- [ ] **Step 5: Persist bounded work inside long semantic stages**

CP01/CP02 decomposition processes material roots in deterministic batches. After a batch, publish changed root results as content objects and replace the checkpoint state:

```ts
await saveRequirementsSemanticCheckpoint({
  recordRoot,
  expectedStateHash,
  nextState: {
    ...current,
    completedUnits: mergeCompletedUnits(current.completedUnits, batch.units),
    pendingUnitIds: current.pendingUnitIds.filter((id) => !batch.rootIds.includes(id)),
    decision: remaining.length === 0 ? 'passed' : 'in_progress',
  },
});
```

On reconnect, verify `planHash`, every `unitInputHash`, compiler version and referenced object, then continue from `pendingUnitIds`. A plan/compiler/input mismatch invalidates that unit and its dependent suffix; stale fragments are never accepted by position alone.

- [ ] **Step 6: Return compile outputs and checkpoint them before the next phase**

Replace stage publication with one result:

```ts
interface RequirementsContractCompiledBuild {
  semanticIr: unknown;
  sourceBinding: unknown;
  resolvedEvidenceIndex: unknown;
  projections: Array<{
    role: RequirementsAuthoringArtifactRole;
    schemaVersion: string;
    mediaType: string;
    value: unknown;
  }>;
  validationSummary: RequirementsValidationSummary;
}
```

`prepareRequirementsContractCp04FreezeStage` and CP05-08 projectors may keep their existing names during migration. They return canonical values; the orchestrator publishes unique objects and commits the current checkpoint state before starting the next phase. Remove payload duplication from `publishAttemptCoreSnapshots`, not checkpoint persistence.

Non-render CP05-08 projections must use semantic row references (`semanticNodeRefs`, constraint refs, evidence refs) and hydrate text from Semantic IR only at display/export time. They must not persist another action/oracle body merely because it appears in a trace, per-MUST bundle or diagram.

- [ ] **Step 7: Publish unique objects and one final manifest**

Serialize each final artifact canonically, publish it through `publishRequirementsContentObject`, then create a sorted build manifest. Do not copy an object into the build directory; store only `contentRef`.

```ts
const entries = compiled.projections.map((projection) => {
  const bytes = Buffer.from(canonicalRequirementsJson(projection.value), 'utf8');
  return {
    role: projection.role,
    schemaVersion: projection.schemaVersion,
    semanticHash: requirementsContractDomainHash(
      `requirements-projection:${projection.role}/v1`,
      projection.value
    ),
    contentRef: publishRequirementsContentObject({
      recordRoot,
      role: projection.role,
      mediaType: projection.mediaType,
      bytes,
    }),
  };
});
```

- [ ] **Step 8: Add one artifact resolver**

All consumers must call:

```ts
export function resolveRequirementsAuthoringArtifact(input: {
  recordRoot: string;
  entry: RequirementsAuthoringArtifactEntryV2;
}): unknown;
```

The resolver verifies `contentRef`, parses the declared media type, validates schema and checks `semanticHash`. Direct reads from attempt-relative projection paths are forbidden in new code.

- [ ] **Step 9: Invalidate only the affected checkpoint suffix**

Map input domains to the first affected checkpoint. A renderer-only change starts at CP05; a source-binding relocation starts at CP03; an action/oracle change starts at CP01. Reuse all earlier states whose `semanticInputHash` and content refs still verify.

- [ ] **Step 10: Keep v1 manifests read-only**

The manifest reader supports v1 for inspect and migration. The v1 writer and checkpoint-manifest writer are removed. A resumed v1 active record recompiles into a v2 build before any write, Judge or confirmation action.

- [ ] **Step 11: Run checkpoint, manifest and compiler tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-content-addressed-build.test.ts tests/acceptance/requirements-contract-authoring-manifest-contract.test.ts tests/acceptance/requirements-contract-authoring-compiler-invariant-closure.test.ts --reporter=dot
```

Expected: all tests PASS; interrupted work resumes from the next incomplete checkpoint, checkpoint state remains bounded, and identical operations share content refs.

- [ ] **Step 12: Commit resumable build compaction**

```powershell
git commit -m "refactor(requirements): 合并编译检查点产物"
```

### Task 7: Store one Judge packet and reference it from requests

**Files:**

- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-packet.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-audit-packet.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-request.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation.ts`
- Create: `tests/acceptance/requirements-contract-judge-ref-packet.test.ts`
- Modify: `tests/acceptance/requirements-contract-production-judge-pipeline.test.ts`

- [ ] **Step 1: Write failing Judge reference tests**

```ts
it('persists refs and hydrates only for provider invocation', async () => {
  const result = await prepareJudgeFixture();
  const request = readJson(result.requestPath);
  expect(request).not.toHaveProperty('auditPacket');
  expect(request).not.toHaveProperty('auditPacketArtifactManifest');
  expect(request.auditPacketRef).toEqual(result.auditPacketRef);
  expect(await hydrateForInvocation(request)).toEqual(result.expectedPayload);
});

it('blocks missing or tampered packet refs before provider dispatch', async () => {
  const fixture = await prepareJudgeFixture();
  tamper(fixture.auditPacketRef);
  await expect(dispatch(fixture.request)).rejects
    .toThrow('requirements_judge_audit_packet_ref_mismatch');
  expect(fixture.provider.requests).toHaveLength(0);
});
```

- [ ] **Step 2: Run the Judge ref test and verify it fails**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-judge-ref-packet.test.ts --reporter=dot
```

Expected: FAIL because Judge request v2 embeds the packet and artifact manifest.

- [ ] **Step 3: Define audit packet v3 as refs**

```ts
interface RequirementsContractJudgeAuditPacketV3 {
  schemaVersion: 'requirements-contract-judge-audit-packet/v3';
  judgeProtocolVersion: 'requirements-judge-protocol/v1';
  scopeSemanticHash: string;
  judgeInputSemanticHash: string;
  semanticIrRef: RequirementsContentRef;
  semanticAuditSliceRefs: Array<{
    role: string;
    schemaVersion: string;
    semanticHash: string;
    contentRef: RequirementsContentRef;
  }>;
  mandatoryDimensionIds: string[];
  coverageSemanticHash: string;
  packetHash: string;
}
```

The packet contains no embedded Semantic IR and no projection payload group. `semanticAuditSliceRefs` contains only path-free semantic slices actually reviewed by Judge; renderer/projection metadata remains outside Judge input. Recompute and verify `judgeInputSemanticHash` after hydration from `{role, schemaVersion, semanticHash}` tuples, sorted `mandatoryDimensionIds`, `coverageSemanticHash` and `judgeProtocolVersion`.

- [ ] **Step 4: Define Judge request v3**

Replace `auditPacket` and `auditPacketArtifactManifest` with:

```ts
auditBinding: RequirementsContractAuditBinding;
auditPacketRef: RequirementsContentRef;
```

`judgeRequestHash` still protects the exact request envelope. `auditBindingHash` remains the reuse key.

- [ ] **Step 5: Hydrate once immediately before invocation**

```ts
const packet = readRequirementsContentObject({ recordRoot, ref: request.auditPacketRef });
const resolved = hydrateRequirementsContractJudgeAuditPacket({
  recordRoot,
  packet: JSON.parse(packet.toString('utf8')),
});
assertJudgePayloadBudget(resolved);
return invokeRequirementsContractJudge({ request, auditPacket: resolved });
```

Hydrated payload is transient memory. It is never written into dispatch attempts, request copies, snapshots or evidence directories.

- [ ] **Step 6: Remove the three-copy publication path**

Delete CP08 packet copy, attempt-root canonical packet copy and `judge-request.json.auditPacket`. The content store object is the only durable packet body.

- [ ] **Step 7: Run Judge packet and pipeline tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-judge-ref-packet.test.ts tests/acceptance/requirements-contract-production-judge-pipeline.test.ts tests/acceptance/requirements-contract-judge-payload-budget.test.ts --reporter=dot
```

Expected: all tests PASS; provider receives the same semantic payload while durable storage contains one packet body.

- [ ] **Step 8: Commit Judge packet references**

```powershell
git commit -m "refactor(requirements): 引用化Judge审计包"
```

## 11. Make Repair Bounded, Resumable and Preflight-First

Repair is a semantic transformation, not another audit campaign. Deterministic projection defects must be fixed before Judge. A Judge failure can trigger one automatic semantic transformation; that transformation must change `scopeSemanticHash` before any active build or authority is published.

Complex repair reasoning is checkpointed through the same ref-only semantic checkpoint store. Candidate root batches may be persisted and resumed, but remain unreachable from active authority until final preflight passes. A no-progress or blocked repair immediately removes those operation refs and leaves only the compact failure summary.

### Task 8: Checkpoint repair work and enforce pre-publication budgets

**Files:**

- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-preflight.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-operation-budget.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-authoring-operation-budget.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-delta-finalizer.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-storage.ts`
- Create: `tests/acceptance/requirements-contract-remediation-preflight.test.ts`
- Create: `tests/acceptance/requirements-contract-authoring-repair-budget.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-auto-repair-loop.test.ts`
- Modify: `tests/e2e/requirements-contract-authoring-negative.e2e.test.ts`

- [ ] **Step 1: Write failing no-write preflight tests**

Snapshot the record tree before repair and verify a semantic no-op creates no authoring attempt:

```ts
it('blocks semantic no-progress before publishing artifacts', async () => {
  const before = inventoryRecordFiles(recordRoot);
  const result = await runRepair({ remediation: semanticNoOpPlan() });
  const after = inventoryRecordFiles(recordRoot);

  expect(result).toMatchObject({
    status: 'blocked',
    issueCode: 'judge_remediation_no_semantic_progress',
  });
  expect(diffAuthoringPayloads(before, after)).toEqual([]);
  expect(findDirectories(recordRoot, /repair-work|CATX|\.staging/u)).toEqual([]);
});
```

The only allowed write is atomic replacement of `quality/failures/latest.json` with a compact failure summary.

- [ ] **Step 2: Write failing budget tests**

```ts
it('permits one repair and two total Judge calls', async () => {
  const result = await runFailRepairFail();
  expect(result.providerRequestCount).toBe(2);
  expect(result.operationBudget).toMatchObject({
    judgeInvocationCount: 2,
    automaticRepairCount: 1,
    terminalStatus: 'blocked',
  });
  expect(result.successorTransactions).toEqual([]);
});

it('does not count provider transport retry as another Judge', async () => {
  const result = await runWithOneTransportRetry();
  expect(result.operationBudget.judgeInvocationCount).toBe(1);
  expect(result.transportAttempts).toBe(2);
});

it('cannot reset exhausted repair by changing operation id', async () => {
  const blocked = await runFailRepairFail({ operationId: 'OP-1' });
  const retried = await resumeRepair({ operationId: 'OP-2',
    triggeringAuditBindingHash: blocked.triggeringAuditBindingHash });
  expect(retried.status).toBe('blocked');
  expect(retried.providerRequestCount).toBe(2);
  expect(retried.automaticRepairCount).toBe(1);
});
```

- [ ] **Step 3: Run preflight and budget tests and verify they fail**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-remediation-preflight.test.ts tests/acceptance/requirements-contract-authoring-repair-budget.test.ts --reporter=dot
```

Expected: FAIL because current repair publishes CP00-08 before checking projection no-progress and budgets are request-local.

- [ ] **Step 4: Add resumable remediation materialization**

The orchestrator opens `authoring/operations/<operationId>/checkpoints/repair.json`, processes deterministic root batches, publishes candidate fragments to the content store and atomically replaces progress after each batch. Resume verifies `expectedBeforeHash` and continues from pending operations.

```ts
interface RequirementsRemediationWorkState {
  operationId: string;
  beforeSemanticHash: string;
  triggeringAuditBindingHash: string;
  triggeringJudgeDecisionHash: string;
  remediationPlanHash: string;
  completedFindings: Array<{
    findingId: string;
    expectedBeforeHash: string;
    compilerVersion: string;
    candidateFragmentRefs: RequirementsContentRef[];
  }>;
  pendingFindingIds: string[];
  state: 'in_progress' | 'ready_for_preflight' | 'blocked';
  stateHash: string;
}
```

This state is recovery evidence, not audit evidence. It contains no Judge verdict and creates no receipt chain. Resume must re-verify the triggering decision is still active; a superseded decision/policy blocks the old repair state.

Before publishing each candidate fragment batch, reserve its exact new bytes through the record storage budget CAS. `publishRequirementsContentObject` requires a valid reservation token; duplicate existing objects consume zero reservation.

- [ ] **Step 5: Implement pure final remediation preflight**

```ts
export interface RequirementsRemediationPreflightResult {
  decision: 'publish' | 'no_progress' | 'blocked';
  beforeSemanticHash: string;
  afterSemanticHash: string | null;
  changedSemanticNodeIds: string[];
  candidateSemanticIr: RequirementsContractSemanticIr | null;
  candidateSourceBinding: RequirementsContractSourceBinding | null;
  candidateBuild: RequirementsContractCompiledBuild | null;
  plannedUniqueBytes: number;
  issueCodes: string[];
}

export function evaluateRequirementsContractRemediationCandidate(input: {
  currentSemanticIr: RequirementsContractSemanticIr;
  currentSourceBinding: RequirementsContractSourceBinding;
  materializedCandidate: RequirementsRemediationWorkState;
}): RequirementsRemediationPreflightResult;
```

The final evaluator is pure: no filesystem, clock, random ID, provider call or receipt write. It resolves already-checkpointed candidate fragments, verifies every repair step, assembles canonical semantic nodes, recompiles deterministic projections and computes exact hashes.

- [ ] **Step 6: Reject non-materializable remediation plans**

The current implementation records `repairSteps` after regeneration without applying them to Semantic IR. Replace that behavior with an explicit materialization contract:

```ts
interface RequirementsSemanticRepairOperation {
  findingId: string;
  operation: 'replace_atom' | 'split_atom' | 'rebind_constraint' | 'replace_oracle';
  targetNodeId: string;
  expectedBeforeHash: string;
  replacement: unknown;
}
```

Unknown operation, missing node, before-hash mismatch or a plan that only changes derived projections returns `blocked` with `requirements_remediation_not_materializable`.

- [ ] **Step 7: Define one operation-level budget**

```ts
interface RequirementsAuthoringOperationBudget {
  schemaVersion: 'requirements-contract-authoring-operation-budget/v1';
  operationId: string;
  initialSemanticHash: string;
  auditPolicyHash: string;
  triggeringAuditBindingHash: string;
  triggeringJudgeDecisionHash: string;
  judgeInvocationCount: 0 | 1 | 2;
  automaticRepairCount: 0 | 1;
  terminalStatus: 'active' | 'ready_to_confirm' | 'blocked';
}
```

The budget and terminal exhaustion are stored in the RequirementRecord through the existing CAS control store, keyed by triggering binding/decision rather than `operationId`. A new operation ID cannot reset a consumed repair or permit a third Judge. Only user-authorized new semantic input or explicit policy upgrade creates a new binding budget. Do not create one budget receipt per transition.

- [ ] **Step 8: Move every authority/build write after preflight**

The repair order is fixed:

```text
read active authority
-> read verified Judge failure
-> check operation budget
-> resume/apply semantic repair through ref-only checkpoints
-> assemble and validate the candidate
-> compare semantic hashes
-> inventory planned unique bytes
-> publish content objects and build
-> CAS active authority
-> invoke Judge for new semantic hash
```

Any failure before `publish content objects and build` leaves no active/durable build. Candidate checkpoint refs are swept immediately on terminal no-progress/blocked outcomes; interrupted refs remain recoverable for at most 24 hours.

- [ ] **Step 9: Replace versioned failures with one compact latest summary**

`quality/failures/latest.json` contains only:

```ts
{
  schemaVersion: 'requirements-contract-failure-summary/v1';
  scopeSemanticHash: string;
  auditBindingHash: string;
  judgeDecisionHash: string;
  issueCodes: string[];
  remediationDecision: 'not_materializable' | 'no_progress' | 'budget_exhausted' | 'judge_failed';
  summaryHash: string;
}
```

Do not retain failed provider prose, full packet copies, dry runs or one directory per failure.

- [ ] **Step 10: Enforce terminal behavior**

- Initial Judge pass: `ready_to_confirm`, one Judge call, zero repairs.
- Initial Judge fail + changed semantic repair + pass: `ready_to_confirm`, two Judge calls, one repair.
- Initial Judge fail + no semantic progress: `blocked`, one Judge call, zero published repair attempts.
- Initial Judge fail + repair + second fail: `blocked`, two Judge calls, one repair, no third request.
- Resume after terminal state: return the same terminal result without writes or provider calls.
- Resume with a different `operationId` but the same exhausted triggering binding: return the same blocked result without creating repair state or a third request.

- [ ] **Step 11: Add interruption recovery assertions**

Interrupt after each materialized repair batch. Resume must verify each keyed completed finding, reuse its candidate fragment refs, continue pending findings, and produce the same final semantic hash as an uninterrupted run. Change the remediation plan, compiler version and one expected-before hash in separate cases and assert only the affected suffix is invalidated. No test may accept restart-from-zero behavior.

- [ ] **Step 12: Run repair regression and E2E tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-remediation-preflight.test.ts tests/acceptance/requirements-contract-authoring-repair-budget.test.ts tests/acceptance/requirements-contract-authoring-auto-repair-loop.test.ts tests/e2e/requirements-contract-authoring-negative.e2e.test.ts --reporter=dot
```

Expected: all tests PASS and provider request counts are exactly 1 or 2 according to the matrix above.

- [ ] **Step 13: Commit bounded repair**

```powershell
git commit -m "fix(requirements): 前置修复进展与预算检查"
```

## 12. Promote Durable Builds and Garbage-Collect Runtime State

The word `staging` must mean disposable, unreachable transaction data. No active authority field may point into a staging directory.

Durable layout:

```text
authoring/
  objects/sha256/...
  sources/<sourceBytesHash>.json
  semantic-revisions/<semanticRevisionId>/semantic-ir-ref.json
  source-bindings/<bindingRevisionId>/source-binding-ref.json
  builds/<buildHash>/manifest.json
  operations/<operationId>/operation.json
  operations/<operationId>/checkpoints/...
  .staging/<operationId>/...
quality/
  semantic-decisions/<auditBindingHash>/decision.json
  failures/latest.json
confirmation/
  current-promotion.json
```

### Task 9: Atomically promote builds and separate review candidates from confirmed targets

**Files:**

- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-durable-build-store.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authority-publication-committer.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-active-authoring-attempt-pointer.ts`
- Modify: `packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance.ts`
- Modify: `_bmad/_schemas/requirement-record.schema.json`
- Create: `tests/acceptance/requirements-contract-authoring-attempt-promotion.test.ts`
- Modify: `tests/acceptance/requirements-contract-confirmation-acceptance.test.ts`

- [ ] **Step 1: Write failing promotion crash tests**

Inject failures at three points:

```ts
it.each([
  'before_build_rename',
  'after_build_rename_before_authority_cas',
  'after_authority_cas',
])('recovers %s without an active staging path', async (failurePoint) => {
  await expect(runWithFailure(failurePoint)).rejects.toThrow();
  const resumed = await resumeOperation();
  expect(resumed.activeAuthority.activeBuildManifestPath)
    .toMatch(/^authoring\/builds\/[a-f0-9]{64}\/manifest\.json$/u);
  expect(resumed.activeAuthority.activeBuildManifestPath).not.toContain('staging');
});
```

Also assert that identical `buildHash` promotion is idempotent and does not create another build directory.

- [ ] **Step 2: Write a failing confirmation boundary test**

Before explicit user confirmation, the final target path must remain unchanged:

```ts
const candidate = await advanceToUserConfirmable();
expect(readFileSync(finalTarget, 'utf8')).toBe(originalTargetBytes);
expect(candidate.confirmation.candidateRef.contentHash).toBeDefined();

await confirmScope(candidate.confirmation.exactConfirmationText);
expect(readFileSync(finalTarget, 'utf8')).toBe(candidate.expectedMarkdown);
expect(findDirectories(recordRoot, /confirmation[\\/]staging/u)).toEqual([]);
```

- [ ] **Step 3: Run promotion tests and verify they fail**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-authoring-attempt-promotion.test.ts tests/acceptance/requirements-contract-confirmation-acceptance.test.ts --reporter=dot
```

Expected: FAIL because active build currently points to `authoring/staging/<attempt>/contract-build-manifest.json` and review rendering writes the final target before confirmation.

- [ ] **Step 4: Implement durable build publication**

```ts
export function publishRequirementsContractDurableBuild(input: {
  recordRoot: string;
  operationId: string;
  manifest: RequirementsContractBuildManifestV2;
  expectedActiveAuthorityHash: string;
}): {
  buildHash: string;
  manifestPath: string;
  reused: boolean;
};
```

The implementation order is:

1. create `authoring/.staging/<operationId>` with `recursive:false`;
2. write only `manifest.json`, because payloads already live in the content store;
3. validate schema and every referenced content object;
4. verify the staged manifest readback hash;
5. rename staging to `authoring/builds/<buildHash>` on the same volume;
6. CAS active authority to the durable manifest path;
7. if the build already exists, verify it and delete the redundant staging directory;
8. if CAS fails, leave an unreachable build for bounded recovery/GC and do not change authority.

- [ ] **Step 5: Replace attempt pointer with active/previous build roots**

The RequirementRecord active authority stores:

```ts
{
  activeSemanticRevisionId,
  activeScopeSemanticHash,
  activeBindingRevisionId,
  activeSourceBindingHash,
  activeBuildHash,
  activeBuildManifestPath,
  previousBuildHash,
  previousBuildManifestPath,
}
```

Do not store `activeAuthoringAttemptId` as durable authority. Operation ID remains transient recovery metadata.

- [ ] **Step 6: Render a record-scoped review candidate**

`renderAndPromoteRequirementsContractConfirmation` becomes two operations:

```ts
renderRequirementsContractReviewCandidate(...) -> RequirementsContentRef
promoteConfirmedRequirementsContractTarget(...) -> PromotionReceipt
```

The first publishes Markdown as a content object and returns `user_confirmable`. HTML is rendered on demand and is not a durable authority artifact. The second runs only after exact confirmation, re-verifies the active tuple and Judge decision, writes the final target atomically, then deletes confirmation staging.

- [ ] **Step 7: Run promotion and confirmation tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-authoring-attempt-promotion.test.ts tests/acceptance/requirements-contract-confirmation-acceptance.test.ts tests/e2e/requirements-contract-authoring-confirmation.e2e.test.ts --reporter=dot
```

Expected: all tests PASS; target bytes change only at explicit confirmation and no active path contains `.staging`.

- [ ] **Step 8: Commit durable promotion**

```powershell
git commit -m "refactor(requirements): 原子提升持久构建"
```

### Task 10: Add bounded mark-and-sweep GC and storage budgets

**Files:**

- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-storage.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-gc.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-retention-policy.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-retention-policy.schema.json`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-operation-manifest.ts`
- Create: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-operation-manifest.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-authoring-limits.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-authoring-limits.schema.json`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store.ts`
- Modify: `packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts`
- Create: `tests/acceptance/requirements-contract-record-gc.test.ts`
- Create: `tests/acceptance/requirements-contract-storage-budget.test.ts`

- [ ] **Step 1: Write failing GC root-safety tests**

```ts
it('never deletes reachable authority or open audit data', () => {
  const plan = planRequirementsRecordGc({ recordRoot, now });
  expect(plan.deletions).not.toContain(activeBuildPath);
  expect(plan.deletions).not.toContain(previousBuildPath);
  expect(plan.deletions).not.toContain(openJudgeRequestPath);
  expect(plan.deletions).not.toContain(currentPromotionPath);
  expect(plan.deletions).not.toContain(activeOperationManifestPath);
  expect(plan.deletions).not.toContain(terminalJudgeResponsePath);
});

it('deletes only unreachable staging older than 24 hours', () => {
  const plan = planRequirementsRecordGc({ recordRoot, now });
  expect(plan.deletions).toContain(orphanOlderThan24Hours);
  expect(plan.deletions).not.toContain(orphanYoungerThan24Hours);
});
```

GC tests must cover symlink/junction escape, changed root set between plan/apply, interrupted delete and idempotent rerun.

An operation manifest contains `status`, checkpoint refs, `updatedAt` and `leaseExpiresAt`. Time fields are excluded from semantic/checkpoint identity, but included in the GC root-set hash. An active or interrupted unexpired operation is a root.

- [ ] **Step 2: Write failing storage-budget boundary tests**

Use injected small limits for fixtures and separately assert production constants:

```ts
expect(DEFAULT_RETENTION_POLICY).toMatchObject({
  warningBytes: 24 * 1024 * 1024,
  maxDurableBytes: 32 * 1024 * 1024,
  orphanTtlMs: 24 * 60 * 60 * 1000,
  retainedPredecessorBuilds: 1,
  retainedFailureSummaries: 1,
  maxJudgeInvocationsPerOperation: 2,
  maxAutomaticRepairsPerOperation: 1,
});
```

Test `limit - 1`, `limit`, `limit + 1`, duplicate content objects adding zero unique bytes, and GC reclaim followed by successful re-evaluation.

- [ ] **Step 3: Run GC and budget tests and verify they fail**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-record-gc.test.ts tests/acceptance/requirements-contract-storage-budget.test.ts --reporter=dot
```

Expected: FAIL because no record-level inventory, reachability plan or durable byte limit is enforced.

- [ ] **Step 4: Implement storage inventory and mutation planning**

```ts
export function inventoryRequirementsRecordStorage(recordRoot: string): {
  durableBytes: number;
  objectBytes: number;
  metadataBytes: number;
  stagingBytes: number;
};

export function assertRequirementsRecordStorageBudget(input: {
  current: StorageInventory;
  plannedUniqueObjectBytes: number;
  plannedMetadataBytes: number;
  plannedReclaimedBytes: number;
  policy: RequirementsContractRetentionPolicy;
}): 'within_budget' | 'gc_required';

export function reserveRequirementsRecordStorage(input: {
  recordRoot: string;
  operationId: string;
  expectedInventoryHash: string;
  requestedUniqueBytes: number;
  requestedMetadataBytes: number;
}): StorageReservation;
```

If projected durable bytes reach 24 MiB, run GC and recompute. If projected bytes exceed 32 MiB after GC, fail before writing with `requirements_record_durable_bytes_exceeded`. Existing CAS objects contribute zero planned bytes. Every content-store publish requires a CAS-valid reservation covering the exact new object bytes; the final-build check is not a substitute for per-batch reservation.

- [ ] **Step 5: Compute the mark root set**

Roots are exactly:

- active semantic revision, source binding and build;
- the source blob ref traversed from the active source-binding capsule;
- one immediate predecessor build and its referenced objects;
- the active audit binding's terminal Judge decision and recursively referenced request, response, aggregate and packet objects;
- any open Judge dispatch state and its request/response refs;
- active or interrupted unexpired operation manifests, checkpoint refs, storage reservations and remediation before/after refs;
- current review candidate and promotion evidence;
- latest failure summary;
- explicitly confirmed decision receipts.

No timestamped archive directory is a root.

- [ ] **Step 6: Implement CAS-protected sweep**

```ts
interface RequirementsRecordGcPlan {
  rootSetHash: string;
  expectedActiveAuthorityHash: string;
  retainedPaths: string[];
  deletionPaths: string[];
  reclaimBytes: number;
  planHash: string;
}
```

Plan is in memory by default. Apply re-reads active authority, operation leases and Judge decision roots, then recomputes `rootSetHash`; mismatch returns `requirements_record_gc_root_set_changed` without deletion. Every deletion path must resolve inside the record root and must not be a symlink/junction escape.

- [ ] **Step 7: Run GC automatically at terminal boundaries**

- After successful confirmation: mark the current operation terminal, remove its operation/checkpoint/staging data, then sweep unreachable attempts/objects, superseded quality requests and stale confirmation candidates.
- After blocked repair: mark the current operation terminal, remove only its unpublished build/checkpoint/staging data, and retain `quality/failures/latest.json`.
- After process interruption: retain the unexpired operation manifest, checkpoints and referenced objects for at most 24 hours; the next inspect/resume renews or expires the lease before GC.
- After binding refresh: retain active build plus one predecessor, then sweep older bindings and builds.

Write one replace-in-place `runtime/gc-summary.json` containing counts, reclaimed bytes and final inventory. Do not retain one GC receipt per run.

- [ ] **Step 8: Run GC, budget and promotion regression tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-record-gc.test.ts tests/acceptance/requirements-contract-storage-budget.test.ts tests/acceptance/requirements-contract-authoring-attempt-promotion.test.ts --reporter=dot
```

Expected: all tests PASS; root changes block deletion and terminal operations leave no unreachable staging.

- [ ] **Step 9: Commit retention and limits**

```powershell
git commit -m "feat(requirements): 增加有界存储与自动清理"
```

## 13. Reject Retired Records and Preserve the Full Deterministic Gate Suite

Version 3 is a true hard cut. It has no requirements-authoring legacy reader, inspector, migration action, migration schema, CLI command, alias or artifact upgrader. Historical files remain user-owned bytes on disk, but no v3 runtime path parses, traverses, hashes, copies, promotes or garbage-collects their nested receipt/checkpoint/CATX contents.

The change is released as `3.0.0`. It must not be bundled into the existing `2.2.3` patch because public CLI arguments, persisted schemas, install surfaces and confirmation evidence change incompatibly.

### Task 11: Delete legacy compatibility and reject unsupported record versions

**Files:**

- Modify: `packages/bmad-speckit/src/main-agent/runtime.ts`
- Modify: `packages/bmad-speckit/bin/bmad-speckit.js`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-package-runtime-action-binding-manifest.ts`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry.ts`
- Create: `tests/acceptance/requirements-contract-retired-record-hard-cut.test.ts`
- Create: `tests/e2e/requirements-contract-fresh-v3-record.e2e.test.ts`
- Delete if present: `packages/bmad-speckit/src/main-agent/actions/migrate-requirements-authoring-record.ts`
- Delete if present: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-legacy-audit-reader.ts`
- Delete if present: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-migration.ts`
- Delete if present: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-migration-operation.ts`
- Delete if present: `packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-migration-operation.schema.json`

- [ ] **Step 1: Write a failing source/dist/package hard-cut test**

Assert that canonical source, built dist and the packed consumer contain none of these requirements-authoring compatibility surfaces:

```text
requirements-contract-legacy-audit-reader
migrate-requirements-authoring-record
requirements-contract-record-migration
requirements-contract-migration-operation
requirements-contract-legacy-audit-summary
requirements-contract-legacy-record-inspection
legacy_requirements_audit_read_only
requirements migrate
```

The test must inspect exported action names, CLI help, canonical asset manifests and package contents. It must not add an exclusion file or rename an old reader behind a neutral facade.

- [ ] **Step 2: Write a failing unsupported-version boundary test**

Create a record whose top-level metadata declares a retired schema version and whose nested artifact path is a sentinel that fails the test if opened. Assert:

```ts
await expect(openRequirementsRecord(recordRoot)).rejects.toMatchObject({
  issueCode: 'requirements_authoring_record_version_unsupported',
});
expect(sentinelNestedArtifact.readCount).toBe(0);
expect(inventoryWrites(recordRoot)).toEqual([]);
```

The response contains only the unsupported top-level version and the instruction to author a fresh v3 record from the formal source. It exposes no receipt counts, historical hashes, pass/convergence fields, migration state or next-action migration alias.

- [ ] **Step 3: Delete every compatibility implementation and export**

Remove reader/migration modules, schemas, CLI commands, action bindings, manifests, adapters, tests and documentation. Delete old public exports instead of restoring them as throwing stubs. The generic top-level record decoder may compare the declared schema version to the current version; it must fail before loading any generation-specific child path.

- [ ] **Step 4: Prove fresh v3 authoring is independent of retired artifacts**

Author a fresh v3 record from the formal source in a clean record root and run all deterministic gates plus one Judge. A different path containing retired artifacts must not be scanned, imported, copied or deleted. Reusing a path that already contains an unsupported record fails closed; the runtime does not attempt in-place migration.

- [ ] **Step 5: Run hard-cut tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-retired-record-hard-cut.test.ts tests/acceptance/requirements-contract-judge-consumer-migration-boundary.test.ts tests/e2e/requirements-contract-fresh-v3-record.e2e.test.ts --reporter=dot
```

Expected: all tests PASS; no source, dist or consumer exposes a legacy reader/migration surface, and unsupported records are rejected without nested artifact reads or writes.

- [ ] **Step 6: Commit the compatibility hard cut**

```powershell
git commit -m "refactor(requirements)!: 删除旧记录兼容链"
```

### Task 12: Remove only three-round audit state and preserve every lint/gate

**Files:**

- Rewrite: `_bmad/skills/requirements-contract-authoring/SKILL.md`
- Modify and preserve:
  - `_bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/projection_quality_gate.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/target_modification_path_coverage.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/assess_contract_authoring_scale.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/confirm-requirements-scope.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts`
  - `_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_stage_common.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/audit_contract_confirmability.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/audit_implementation_readiness.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/audit_closeout_integrity.js`
  - `_bmad/skills/requirements-contract-authoring/scripts/audit_delivery_verification.js`
- Modify and preserve:
  - `_bmad/skills/requirements-contract-authoring/references/semantic-checkpoint-workflow.md`
  - `_bmad/skills/requirements-contract-authoring/references/reverse-audit-gate.md`
  - `_bmad/skills/requirements-contract-authoring/references/html-confirmation-renderer-spec.md`
  - `_bmad/skills/requirements-contract-authoring/references/contract-template.md`
  - `_bmad/skills/requirements-contract-authoring/references/implementation-confirmation-reference.md`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-gate-registry.ts`
- Create: `tests/acceptance/requirements-contract-authoring-gate-preservation.test.ts`
- Modify: `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`
- Modify: `packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry.ts`
- Modify: `_bmad/_config/governance-remediation.yaml`
- Modify: `_bmad/shared/requirements-contract/judge-prompts/requirements-contract-critical-auditor.prompt.md`
- Modify Judge/effective-pass schemas to remove round convergence fields while retaining the existing independent Judge role identity
- Modify: `package.json`
- Modify: `packages/bmad-speckit/package.json`
- Modify: release notes/changelog used by the repository release process

- [ ] **Step 1: Write an install-surface hard-cut test**

Extend `tests/acceptance/requirements-contract-judge-hard-cut.test.ts` so source, dist and packed consumer prohibit only the retired round protocol:

```text
runCriticalAuditorReceiptLoop
critical-auditor-round-request
critical-auditor-round-response
critical-auditor-receipt-round
consecutiveNoNewGapRounds
bounded_no_new_gap
critical_auditor_provider_mode_required
write-critical-auditor-no-new-gap-response
```

Do not prohibit the independent Judge role, generic Critical Auditor assets used by Story/Speckit review, or any deterministic requirements lint/gate.

- [ ] **Step 2: Freeze the complete gate registry before changing orchestration**

Create an explicit registry containing every existing deterministic requirements-authoring check. The required families are:

```text
source PRD instance lint
scale assessment and routing
semantic checkpoint validation
definition drilldown
MUST decomposition and atomicity
packet/source reconciliation
projection quality and per-MUST mapping
target modification path coverage
global consistency and renderability
HTML/Markdown renderer blockers
reverse audit stages
confirmability, implementation readiness, closeout and delivery audit wrappers
```

The registry records stable gate ID, implementation owner, input hash domains and blocking issue codes. Capture the current non-round gate IDs before production edits; the post-change registry must be set-equal.

- [ ] **Step 3: Remove round dependencies without deleting gate behavior**

Each preserved gate replaces `criticalAuditor` round count/latest receipt inputs with `scopeSemanticHash`, stable checkpoint/build refs and the verified Judge decision when an independent semantic verdict is required. All other validations, issue codes and fail-closed behavior remain intact.

`requirements-contract-authoring-gate-preservation.test.ts` must assert:

```ts
expect(afterGateIds).toEqual(beforeGateIds);
expect(afterBlockingIssueCodes).toEqual(beforeBlockingIssueCodes);
expect(executedGateIds).toEqual(afterGateIds);
expect(executedGateIds).not.toContain('critical_auditor_three_round_convergence');
```

The baseline sets exclude only round request/response/receipt existence, minimum-round count, consecutive-round count and round-restart issue codes.

- [ ] **Step 4: Keep checkpoint and gate persistence compact**

Gate reports are canonical content objects referenced by the current semantic checkpoint and final build. Rerunning a gate with the same stable inputs reuses the existing report. No gate report hash includes path, timestamp or another receipt hash, and no gate produces a receipt-of-receipt chain.

- [ ] **Step 5: Rewrite the Skill as the complete production gate guide**

The Skill documents:

```text
author -> decision batches -> resumable deterministic gates -> Judge -> user_confirmable -> confirm
```

It lists the complete gate registry and makes clear that Judge replaces only the three no-gap rounds, not any lint/gate.

- [ ] **Step 6: Version Judge and EffectivePass schemas**

New writer schemas bind `auditBindingHash`, `scopeSemanticHash`, Judge request/response hashes and decision hash. Retired three-round receipt schemas are neither read nor accepted by v3.

- [ ] **Step 7: Remove retired public round parameters**

These arguments return `requirements_authoring_legacy_argument_removed` with the canonical action; they are never silently ignored:

```text
--critical-auditor-provider-mode
--critical-auditor-response-file
--critical-auditor-response-dir
--max-critical-auditor-rounds
```

The user-facing lifecycle does not expose `authoring-repair`; main-agent owns the single bounded repair transition.

- [ ] **Step 8: Regenerate surfaces and dist**

Run:

```powershell
node _bmad/skills/requirements-contract-authoring/scripts/verify-requirements-contract-authoring-skill-sync.js --repo-only --sync
npm run build:main-agent-dist
```

The sync helper, deterministic gate scripts and large-document promotion helper remain installed. Only the no-gap response writer and round-only schema/fixtures are deleted.

- [ ] **Step 9: Set package version to 3.0.0**

Update only the root package and `bmad-speckit` package, then regenerate the lockfile:

```powershell
npm pkg set version=3.0.0
npm pkg set version=3.0.0 --workspace bmad-speckit
npm install --package-lock-only --ignore-scripts
```

Do not change the independently versioned `@bmad-speckit/*` support workspaces. Release notes must state:

- old three-round records are unsupported and must be re-authored from the formal source into a fresh v3 record;
- v3 contains no legacy receipt reader, migration action or artifact upgrader;
- new record storage is content-addressed and bounded;
- old authoring parameters and Skill-local runtime are removed.

- [ ] **Step 10: Run gate-preservation, install and packed-consumer tests**

Run:

```powershell
npm run build:main-agent-dist
npm exec -- vitest run tests/acceptance/requirements-contract-authoring-gate-preservation.test.ts tests/acceptance/requirements-contract-judge-hard-cut.test.ts tests/acceptance/accept-pack-bmad-speckit.test.ts tests/acceptance/accept-install-consumer-cli.test.ts --reporter=dot
npm run test:consumer-runtime-final
npm run test:consumer-install-final
```

Expected: all tests PASS, every deterministic gate executes, and packed consumers contain no retired three-round writer/runtime.

- [ ] **Step 11: Commit the breaking surface**

```powershell
git commit -m "refactor(requirements)!: 硬切单Judge审计链"
```

## 14. Dependency Order and Pull Request Topology

The task numbers group responsibilities. Implementation follows this dependency order so every merged PR keeps one working production path:

1. **PR A - Identity and source storage:** Task 1, Task 4, Task 5.
2. **PR B - Resumable checkpoints and content-addressed builds:** Task 6, Task 7, Task 9.
3. **PR C - Judge reuse, storage reservations and bounded repair:** Task 2, Task 10, Task 8.
4. **PR D - Retired compatibility hard cut:** Task 11.
5. **PR E - Audit hard-cut and gate-preserving public surface update:** Task 3, Task 12.

Each PR must pass its targeted tests, `npm run build:main-agent-dist`, lint and encoding checks before the next PR starts. Dual-write is allowed only inside a PR's tests; no merged production path may write both old and new artifact families.

### Integration Task A: Prove checkpoint recovery without payload growth

**Files:**

- Create: `tests/acceptance/requirements-contract-semantic-checkpoint-recovery.test.ts`
- Modify: `tests/acceptance/requirements-contract-authoring-limits.test.ts`
- Modify: `tests/performance/requirements-contract-authoring-capacity.performance.test.ts`

- [ ] Interrupt after every CP00-08 boundary and after every bounded CP01/CP02 root batch.
- [ ] Resume and assert completed root IDs are not recomputed.
- [ ] Compare uninterrupted and resumed `scopeSemanticHash`, `sourceBindingHash`, `buildHash` and final rendered requirement rows byte-for-byte.
- [ ] Assert total checkpoint state JSON is at most `65_536 + R * 512` bytes for dynamic material-root count `R`.
- [ ] Assert one semantic payload hash maps to one content object across every resume.
- [ ] Assert checkpoint state updates replace fixed files and do not increase the checkpoint file count.
- [ ] Change one unit input, plan hash and compiler version independently; assert only the affected unit/dependent suffix is invalidated.
- [ ] Assert unexpired operation leases protect checkpoint refs from GC and expired interrupted operations are collected after 24 hours.

Run:

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-semantic-checkpoint-recovery.test.ts tests/acceptance/requirements-contract-authoring-limits.test.ts tests/performance/requirements-contract-authoring-capacity.performance.test.ts --reporter=dot
```

Expected: all tests PASS; every injected interruption resumes from the next pending unit.

### Integration Task B: Prove end-to-end size and audit budgets

**Files:**

- Create: `tests/acceptance/main-agent-requirements-authoring-compaction.test.ts`
- Create: `tests/e2e/requirements-contract-authoring-repair-budget.e2e.test.ts`

- [ ] Generate a deterministic 62 KiB regression fixture with `R=109` material roots and at least 24,000 excluded lines in the test temporary directory; also run parameterized `R=1/129/1000` and randomized `R` cases.
- [ ] Assert the source body has one physical content object.
- [ ] Assert intake plus lineage bytes are at most `sourceBytes * 4 + 65_536`.
- [ ] Assert a pass-first lifecycle makes one Judge request.
- [ ] Assert an unchanged resume makes zero additional Judge requests and writes no additional content objects.
- [ ] Assert fail-repair-pass makes exactly two Judge requests and one automatic repair.
- [ ] Assert fail-repair-fail becomes blocked with no third request and one compact latest failure summary.
- [ ] Assert the confirmed record retains active build, one predecessor, one final Judge decision and one promotion receipt.
- [ ] Assert total durable bytes are below 8 MiB for the fixture.
- [ ] Assert no active path contains `staging`, `repair-work-round`, `CATX` or Critical Auditor round names.
- [ ] For each deterministic gate family, inject one blocker and assert zero provider requests, zero Judge decisions, no candidate and no authority promotion.
- [ ] Crash Judge dispatch at `prepared`, `dispatched`, `response_received` and `terminal`; assert one terminal decision per binding and no automatic redispatch from unknown non-idempotent state.

Run:

```powershell
npm exec -- vitest run tests/acceptance/main-agent-requirements-authoring-compaction.test.ts tests/e2e/requirements-contract-authoring-repair-budget.e2e.test.ts --reporter=dot
```

Expected: all tests PASS and printed metrics remain within every stated budget.

## 15. Full Verification Matrix

### Focused correctness

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-semantic-hash-boundaries.test.ts tests/acceptance/requirements-contract-content-store.test.ts tests/acceptance/requirements-contract-file-intake-range.test.ts tests/acceptance/requirements-contract-intent-lineage-range.test.ts --reporter=dot

npm exec -- vitest run tests/acceptance/requirements-contract-content-addressed-build.test.ts tests/acceptance/requirements-contract-semantic-checkpoint-recovery.test.ts tests/acceptance/requirements-contract-judge-ref-packet.test.ts tests/acceptance/requirements-contract-judge-semantic-reuse.test.ts tests/acceptance/requirements-contract-audit-policy-upgrade.test.ts --reporter=dot

npm exec -- vitest run tests/acceptance/requirements-contract-remediation-preflight.test.ts tests/acceptance/requirements-contract-authoring-repair-budget.test.ts tests/acceptance/requirements-contract-authoring-attempt-promotion.test.ts tests/acceptance/requirements-contract-record-gc.test.ts tests/acceptance/requirements-contract-storage-budget.test.ts --reporter=dot
```

### Audit hard-cut and retired-record rejection

```powershell
npm exec -- vitest run tests/acceptance/requirements-contract-no-three-round-authority.test.ts tests/acceptance/requirements-contract-cp02-no-auditor.test.ts tests/acceptance/requirements-contract-judge-hard-cut.test.ts tests/acceptance/requirements-contract-retired-record-hard-cut.test.ts tests/acceptance/requirements-contract-judge-consumer-migration-boundary.test.ts --reporter=dot

npm exec -- vitest run tests/acceptance/requirements-contract-authoring-gate-preservation.test.ts tests/acceptance/requirements-contract-authoring-skill-contract.test.ts tests/acceptance/reverse-audit-contract.test.ts tests/acceptance/render-requirements-confirmation-html.test.ts --reporter=dot
```

### E2E

```powershell
npm exec -- vitest run tests/e2e/requirements-contract-authoring-confirmation.e2e.test.ts tests/e2e/requirements-contract-authoring-negative.e2e.test.ts tests/e2e/requirements-contract-authoring-live-judge.e2e.test.ts tests/e2e/requirements-contract-authoring-repair-single-judge.e2e.test.ts tests/e2e/requirements-contract-fresh-v3-record.e2e.test.ts --reporter=dot
```

### Build, install and consumer parity

```powershell
npm run build:main-agent-dist
npm run lint -- --quiet
node _bmad/skills/requirements-contract-authoring/scripts/verify-requirements-contract-authoring-skill-sync.js --repo-only
npm exec -- vitest run tests/acceptance/accept-pack-bmad-speckit.test.ts tests/acceptance/accept-install-consumer-cli.test.ts --reporter=dot
npm run test:bmad-speckit
npm run test:consumer-runtime-final
npm run test:consumer-install-final
npm run ci:pr-fast
```

### Encoding

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Expected: `findings=0`.

## Acceptance Criteria

| ID | Acceptance criterion | Proof |
|---|---|---|
| AC-01 | An `auditBindingHash` receives at most one accepted Judge decision; ordinary resume keeps the pinned policy and binding. | Dispatch-state fault injection and semantic decision store inventory. |
| AC-01A | Explicit policy upgrade is monotonic, user-authorized, CAS-bound, records the superseded decision and creates exactly one new binding decision; ordinary prompt deployment does not. | Audit policy upgrade lifecycle tests. |
| AC-02 | Initial fail plus one changed-semantic repair permits one additional Judge; second failure is terminal blocked. | Repair budget E2E. |
| AC-02A | Changing only `operationId` cannot reset binding-level repair exhaustion or create a third Judge request. | Operation-ID reset attack test. |
| AC-03 | Source path, timestamp, language, renderer and derived projection metadata do not change semantic identity or trigger Judge. | Metamorphic hash and reuse tests. |
| AC-04 | Action, oracle and dependency mutations change the canonical semantic hash. | Semantic boundary tests. |
| AC-04A | Any canonical semantic audit-slice, coverage semantic or required audit-policy change produces a new `judgeInputSemanticHash`/binding; path/content-ref relocation does not. | Judge input metamorphic tests. |
| AC-05 | CP00-08 and bounded root batches are durably resumable without recomputing completed work. | Interruption matrix across every checkpoint and batch. |
| AC-06 | Checkpoint persistence contains refs/progress only; state files are fixed-count and bounded by `65_536 + R * 512` bytes for dynamic material-root count `R`. | Checkpoint inventory assertions over parameterized and randomized `R`. |
| AC-06A | Every completed checkpoint/repair unit binds unit ID, unit input hash, plan/compiler version and output refs; stale units cannot be resumed. | Suffix invalidation tests. |
| AC-07 | Source bytes exist once; excerpts contain ranges/hashes and no body/path duplication. | Content-store and file-intake tests. |
| AC-08 | For dynamic `R`, all material roots remain individually traceable while excluded physical lines collapse into `X` continuous ranges; storage grows as `O(R + X)`. | Lineage range, coverage and randomized-root tests. |
| AC-09 | Judge packet body exists once; requests contain a verified content ref and hydrate only for invocation. | Judge ref packet tests and sentinel occurrence count. |
| AC-10 | Repair no-progress is detected before build/authority publication; terminal no-progress leaves no candidate checkpoint artifacts. | No-write repair inventory test. |
| AC-11 | Active authority references `authoring/builds/<buildHash>`, never staging. | Promotion crash/recovery tests. |
| AC-12 | The final source target changes only after explicit user confirmation. | Confirmation boundary test. |
| AC-13 | Success and blocked terminal paths automatically remove unreachable staging and retain only the declared root set. | GC root and terminal-state tests. |
| AC-13A | Unexpired operation/checkpoint leases and active terminal Judge decision dependencies are GC roots. | Lease and recursive Judge-root tests. |
| AC-14 | Orphan staging remains recoverable for less than 24 hours and is deleted after TTL. | Injected-clock GC tests. |
| AC-15 | 24 MiB triggers GC; projected durable bytes over 32 MiB fail before write. | Storage boundary tests. |
| AC-15A | Every new content object consumes a CAS-protected storage reservation; duplicate raw bytes across roles consume zero additional bytes. | Content-store reservation and cross-role dedup tests. |
| AC-16 | The current 62 KiB regression fixture (`R=109`) remains below 8 MiB durable storage, while additional `R=1/129/1000` and randomized cases prove the runtime contains no `109` or `128` root-count dependency. | End-to-end compaction and scanner-budget metrics. |
| AC-17 | No new source, dist, package or installed consumer contains the retired three-round requirements-authoring protocol. | Hard-cut source/dist/pack scans. |
| AC-18 | Source, dist and packed consumers contain no requirements-authoring legacy reader, inspector, migration action/schema/CLI, alias or artifact upgrader. | Retired-record hard-cut scans. |
| AC-18A | An unsupported record version is rejected from top-level metadata before any nested artifact read or write; fresh v3 authoring never scans or imports retired artifacts. | Unsupported-version sentinel and fresh-record E2E tests. |
| AC-19 | Repository-local Skill mirrors, dist runtime and packed consumer are synchronized. | Sync, build, pack and install tests. |
| AC-20 | UTF-8 integrity remains clean across source and generated surfaces. | Encoding guardian output with zero findings. |
| AC-21 | Every pre-existing deterministic requirements lint/gate and every non-round blocking issue code remains present and executes; only three-round convergence checks are removed. | Gate registry set-equality and execution coverage tests. |
| AC-22 | Public `authoring-repair` aliases return removal errors; bounded repair is reachable only through normal resume/automatic transition. | CLI action-binding and E2E tests. |

## 16. Rollout and Failure Handling

1. Merge PR A and PR B with only the current public authoring route active, while tests exercise the new store/checkpoint path directly.
2. Merge PR C and activate Judge reuse plus bounded repair for newly created v3 records.
3. Merge PR D and delete all requirements-authoring legacy reader/migration surfaces; verify unsupported records fail before nested artifact access.
4. Merge PR E, remove only the three-round writer/state, preserve and rebind the complete gate suite, regenerate dist/surfaces, then publish `3.0.0`.
5. Do not downgrade a v3 record or provide an in-place upgrader. Retired records must be re-authored from their formal source into a fresh v3 record root.
6. Unsupported records remain byte-for-byte untouched; rejection creates no migration staging, receipt, summary or compatibility artifact.
7. A failed GC never changes active authority. Root-set CAS failure aborts deletion and the next current-version operation recomputes the plan.

## 17. Plan Self-Review

- **Spec coverage:** AC-01 through AC-20 map every requested hard rule to a named task and executable proof.
- **Interruption safety:** CP00-08 and long decomposition/repair batches remain durably checkpointed; the plan removes duplicate payloads and receipt chains, not checkpoints.
- **Identity consistency:** all tasks use `scopeSemanticHash`, `sourceBindingHash`, `projectionSetHash`, `buildHash`, `auditPolicyHash` and `auditBindingHash` with one definition each.
- **Retention consistency:** active + one predecessor + latest failure summary is the only durable history; 24-hour retention applies only to interrupted orphan staging.
- **Authority consistency:** deterministic validators prove structure; one Judge proves semantic quality; user confirmation authorizes final promotion.
- **Gate preservation:** all existing lint/gate families and non-round blocker codes remain set-equal; only round-count/round-receipt checks are deleted.
- **No migration tail:** v3 has no requirements-authoring legacy reader, inspector, migrator, schema alias or artifact upgrader; retired records fail at the top-level version boundary.
- **No unbounded fixtures:** size tests generate temporary data and inject small limits; the repository does not commit 32 MiB fixtures.
