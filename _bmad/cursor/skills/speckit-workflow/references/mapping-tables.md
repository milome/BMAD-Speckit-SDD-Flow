# 映射表列名与结构（固定模板，可复制）

以下为各阶段需求映射清单的**表头与列名**固定模板，可直接复制到 spec.md / plan.md / IMPLEMENTATION_GAPS.md / tasks.md 中使用。

---

## 1. spec.md：需求映射清单（spec ↔ 原始需求文档）

```markdown
## 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| §1 概述     | （简述）    | spec §...        | ✅ / ❌   |
| §2 ...      | ...         | spec §...        | ✅ / ❌   |
```

**说明**：原始需求文档的每一章、每一条须在 spec.md 中有明确对应并标注覆盖状态。

---

## 2. plan.md：需求映射清单（plan ↔ 需求文档 + spec）

```markdown
## 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| §1          | spec §...   | plan Phase 1 / §... | ✅ / ❌ |
| §2          | spec §...   | plan §...   | ✅ / ❌   |
```

**说明**：需求文档与 spec.md 的每一章、每一条须在 plan.md 中有明确对应。

---

## 2A. plan.md：Deferred Gap Architecture Mapping

```markdown
## Deferred Gap Architecture Mapping

| Gap ID | 来源 | Architecture Refs | Work Item Refs | Journey Refs | Production Path Refs | 状态 |
|--------|------|-------------------|----------------|--------------|----------------------|------|
| J04-Smoke-E2E | readiness | `architecture.md#checkout` | `T021,T022` | `J04` | `src/app/checkout/page.tsx` | mapped |
```

**说明**：active Deferred Gaps 在 plan 阶段必须至少映射到 architecture/work item；若影响真实功能可用性，还必须显式写出 `Journey Refs` 与 `Production Path Refs`。

---

## 3. IMPLEMENTATION_GAPS.md：Gap 列表表头（按需求文档章节）

```markdown
## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| 第 N 章     | GAP-x.y | （简述） | 已实现/部分/未实现 | ... |
```

**说明**：按原始需求文档逐章节列出每条 Gap，注明实现状态与缺失/偏差。

---

## 3A. IMPLEMENTATION_GAPS.md：Deferred Gap Lifecycle Classification

```markdown
## Deferred Gap Lifecycle Classification

| Gap ID | Gap Origin | Lifecycle Classification | Gap Type | 说明 |
|--------|------------|--------------------------|----------|------|
| J04-Smoke-E2E | inherited | inherited_open | journey runnable gap | smoke proof 仍未形成 |
| J07-Async-Proof | new | new_gap | evidence gap | 新发现的 acceptance evidence 缺口 |
```

**说明**：这里必须把 inherited gap 和 new gap 分开；`Gap Type` 还必须区分 `definition gap`、`implementation gap`、`journey runnable gap`、`evidence gap`。

---

## 4. tasks.md：本批任务 ↔ 需求追溯

```markdown
## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| Txxxx–Txxxx | （需求文档文件名） | §N, §M | （简要要点） |
```

**说明**：任务 ID 可为单任务或范围；需求文档、章节、要点须可追溯到具体需求。

---

## 5. tasks.md：Gaps → 任务映射（按需求文档章节）

```markdown
## Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| 第 N 章 | GAP-x.y | ✓ 有 | Txxxx, Txxxx |
```

---

## 6. tasks.md：Gaps → 任务映射（四类汇总，如 D/S/I/M）

```markdown
## Gaps → 任务映射（四类汇总）

| 类别 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| 数据加载 | D1, D2, ... | ✓ 有 | Txxxx, ... |
| 数据共享 | S1, S2, ... | ✓ 有 | Txxxx, ... |
```

**说明**：若 IMPLEMENTATION_GAPS 使用「按章节 + 四类汇总」双视角，则两表均需存在且无遗漏。

---

## 6A. tasks.md：Deferred Gap Task Binding

```markdown
## Deferred Gap Task Binding

| Gap ID | Task Binding Status | Task IDs | Smoke Task IDs | Closure Task ID | Explicit Defer Reason | Next Checkpoint |
|--------|---------------------|----------|----------------|-----------------|----------------------|-----------------|
| J04-Smoke-E2E | planned | T021,T022 | T023 | CLOSE-J04 |  | Sprint Review |
| J09-Full-E2E | explicitly_deferred |  |  |  | Nightly suite owned by QA backlog | Epic 3 Planning |
```

**说明**：active Deferred Gap 必须二选一：要么绑定 task，要么写 `Explicit Defer Reason`。若 gap 影响某条 Journey，必须同时写 `Smoke Task IDs` 与 `Closure Task ID`。

---

## 7. tasks.md：验收表头（按 Gap 逐条验证）

```markdown
### 按需求文档章节（GAP-x.y）

表头说明：**生产代码实现要点**须列出文件、类、方法、代码实现细节；**集成测试要求**须列出测试文件、用例名、执行命令、预期结果；**执行情况**验收时必填（待执行/通过/失败及原因）；仅当两者满足且执行情况为通过时可勾选**验证通过**。

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| GAP-x.y | Txxxx | ... | ... | [ ] 待执行 / [x] 通过 / [ ] 失败（原因） | [ ] / [x] |
```

---

## 8. tasks.md：四类汇总验收表头

```markdown
### 四类汇总（D/S/I/M）

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| D1 | Txxxx, ... | ... | ... | [ ] / [x] 通过 / [ ] 失败 | [ ] / [x] |
```

---

## 9. tasks.md：Journey -> Task -> Test -> Closure 映射

```markdown
## Journey -> Task -> Test -> Closure 映射

| Journey ID | Invariant IDs | Task IDs | Smoke Proof | Full E2E | Closure Note |
|------------|---------------|----------|-------------|----------|--------------|
| J01 | INV-01, INV-02 | T021, T022, T023 | `tests/e2e/smoke/...` | `tests/e2e/full/...` 或 deferred reason | `closure-notes/J01.md` |
| J02 | INV-03 | T024, T025 | `tests/e2e/smoke/...` | `N/A`（写明原因） | `closure-notes/J02.md` |
```

**说明**：每条 `P0 journey` 都必须能从 `journey -> task -> test -> closure` 一路追溯，禁止只列模块任务而无 smoke proof / closure 收口。

---

## 9A. Journey Runtime Proof Mapping

```markdown
## Journey Runtime Proof Mapping

| Journey ID | Production Path | Smoke Proof | Full E2E / defer reason | Closure Note | Acceptance Evidence |
|------------|-----------------|-------------|--------------------------|--------------|--------------------|
| J01 | `src/app/checkout/page.tsx` | `tests/e2e/smoke/checkout.spec.ts` | `tests/e2e/full/checkout.spec.ts` | `closure-notes/J01.md` | `reports/checkout-proof.md` |
| J02 | `src/server/orders/create-order.ts` | `tests/e2e/smoke/order.spec.ts` | deferred: nightly owned by QA | `closure-notes/J02.md` | `reports/order-proof.md` |
```

**说明**：这一表专门防“任务完成但 Journey 不 runnable”。`Production Path`、`Smoke Proof`、`Closure Note`、`Acceptance Evidence` 缺任一项，Journey 都不能宣称完成。

---

## 10. Gap 分类：Definition Gap vs Implementation Gap

```markdown
## Definition Gap vs Implementation Gap

| Gap Type | Source | Current Handling | Owner | Next Gate |
|----------|--------|------------------|-------|----------|
| Definition Gap | spec / plan / readiness / audit | clarify / re-readiness / contract patch | PM / Architect / Owner | clarify / readiness |
| Implementation Gap | tasks / implement / verification / audit | code change / test fix / closure note | Dev / QA / Owner | implement / audit |
```

**说明**：
- `Definition Gap` 指需求、完成态、权限边界、fixture / environment、依赖语义等定义层缺口。
- `Implementation Gap` 指代码路径、生产接线、smoke/full 证据、closure note 等实现层缺口。
- 两类 gap **必须分开记录**，不得在一条“开发任务”里混写后直接宣称功能已跑通。
