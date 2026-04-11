# Runtime Dashboard & Training-Ready SFT Implementation Plan

> **Current path**: `runAuditorHost`
> **Legacy path**: `bmad-speckit score` / `parse-and-write-score`

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前离线 `dashboard + scoring + sft-extract` 链路升级为统一的 runtime observability 与训练就绪 SFT 数据集构建系统，交付可近实时观察的 runtime dashboard，以及符合 OpenAI / Hugging Face 规范的高质量导出与下载能力。

**Architecture:** 本方案采用“file-backed runtime events + shared projection/query core + MCP-first adapter + webserver-independent fallback + canonical SFT sample + target-specific exporters”的分层结构。`website/` 文档站点不进入 Phase 1 运行时链路；主交付物是本地共享数据/查询内核、一个 `stdio` MCP 适配层，以及一个可独立运行的本地 dashboard webserver。所有训练导出都以内部 `CanonicalSftSample` 为唯一真相源，对外分别生成 OpenAI chat、Hugging Face conversational、Hugging Face tool-calling 格式。

**Tech Stack:** TypeScript, Node.js, Vitest, AJV, existing runtime-context registry, existing scoring orchestrator, local file-backed event store, CLI commands under `packages/bmad-speckit`, local HTML/JS dashboard server, local `stdio` MCP adapter, Astro docs site only for later文档说明而非主运行时 UI。

---

## 0. Preconditions

### Source documents

- Requirements: `docs/plans/2026-03-27-runtime-dashboard-sft-requirements-analysis.md`
- SFT contracts: `docs/plans/2026-03-28-sft-canonical-schema-and-export-contracts.md`
- Existing runtime context contracts:
  - `packages/runtime-context/src/context.ts`
  - `packages/runtime-context/src/registry.ts`
  - `packages/runtime-context/src/cli.ts`
  - `scripts/emit-runtime-policy.ts`
- Existing scoring / dashboard / SFT code:
  - `packages/scoring/orchestrator/parse-and-write.ts`
  - `packages/scoring/writer/types.ts`
  - `packages/scoring/dashboard/compute.ts`
  - `packages/scoring/dashboard/format.ts`
  - `packages/scoring/dashboard/index.ts`
  - `packages/scoring/analytics/sft-extractor.ts`
  - `packages/bmad-speckit/src/commands/dashboard.js`
  - `packages/bmad-speckit/src/commands/sft-extract.js`

### Constraints

- 不破坏现有 `bmad-speckit dashboard` 与 `bmad-speckit sft-extract` 的基本兼容性。
- 继续复用现有 runtime governance CLI：`emit-runtime-policy`、`ensure-run-runtime-context`、`sync-runtime-context-from-sprint`；不为 live dashboard 重新发明治理态事实源。
- `website/` 是 Astro 文档站点，不作为 Phase 1 的 runtime dashboard 承载体。
- `.tmp` runtime context 文件不能进入 dashboard 观测结果。
- 不能继续用“直接导出 `{instruction,input,output}` 即训练就绪”的假设驱动设计。
- 所有新 schema 都必须有 AJV 或等价校验测试。
- `webserver` 与 `MCP` 必须共享同一份 projection/query/export core，禁止形成 `webserver -> MCP` 或 `MCP -> webserver` 的硬依赖。
- 当 MCP 不可用时，dashboard 展示、SFT 预览、下载、导出主路径不得整体失效。

### Validation baseline

- Root tests:
  - `npm run test:scoring`
  - `npx vitest run tests/acceptance/runtime-context*.test.ts`
  - `npx vitest run tests/acceptance/runtime-policy*.test.ts`
- CLI smoke:
  - `node packages/bmad-speckit/bin/bmad-speckit.js dashboard --help`
  - `node packages/bmad-speckit/bin/bmad-speckit.js sft-extract --help`
  - `node packages/bmad-speckit/bin/bmad-speckit.js ensure-run-runtime-context --help`

---

## 1. Delivery Strategy

### In scope

- Runtime event store and projection layer
- Shared query/export core consumed by CLI, MCP, and webserver
- MCP-first runtime adapter with health checks and fallback contract
- Near-real-time local dashboard service and UI
- Score detail drill-down projection
- Canonical SFT sample schema and candidate pipeline
- OpenAI / Hugging Face export adapters
- Preview / optimize / split / validate / bundle download
- CLI integration and regression coverage

### Out of scope

- Hosted multi-user SaaS dashboard
- Remote database / queue / event bus
- Replatforming the `website/` docs site into the runtime app
- Preference / DPO / RFT dataset support in this batch

### Phase order

1. Freeze contracts and add new schemas
2. Build runtime events and projections
3. Add shared query/export core for CLI, MCP, and webserver
4. Add MCP adapter and fallback contract
5. Add live dashboard data APIs and local UI
6. Build canonical SFT pipeline
7. Add target-specific exporters and bundles
8. Wire CLI, docs, and regression tests

### Runtime access boundaries

```text
runtime governance CLI (existing)
  -> runtime store / registry / activeScope
      -> shared projection/query/export core
          -> MCP adapter (preferred for agent tool access)
          -> local webserver (preferred for human visualization)
          -> compatibility CLI snapshot/export commands
```

- **Reuse existing CLI**: `emit-runtime-policy`, `ensure-run-runtime-context`, `sync-runtime-context-from-sprint`, plus legacy `dashboard` / `sft-extract` compatibility commands.
- **Must be implemented as shared core**: run projection, score detail query, SFT candidate preview, target-specific export, bundle metadata.
- **Must be exposed via webserver API**: live dashboard panels, score drill-down, SFT preview page data, bundle download, SSE/WebSocket updates.
- **MCP is preferred but not exclusive**: agent/runtime integrations优先走 MCP；若 MCP 未启动，则 skills 或 CLI 可直接走 webserver API 或兼容 CLI，而非整体失败。

### Fault degradation matrix

| MCP | Webserver | Shared Core | Expected behavior | Forbidden behavior |
|---|---|---|---|---|
| Up | Up | Up | 全功能：agent 走 MCP，用户看 live dashboard，下载与导出正常 | 任一入口绕过 shared core 自己组装状态 |
| Down | Up | Up | dashboard UI、SFT 预览/下载继续可用；skills/CLI 改走 HTTP 或本地兼容命令 | 因 MCP 不可用直接让 dashboard/SFT 主功能全部失败 |
| Up | Down | Up | agent 仍可通过 MCP 查询摘要、触发导出；无浏览器 live UI | MCP 对 webserver 有强依赖导致全部不可用 |
| Down | Down | Up | 回退到现有 CLI 快照/导出模式；治理态 CLI 继续可用 | runtime governance CLI 与数据导出一起失效 |
| Any | Any | Down | 显式报错，指出 shared core / projection 故障 | 静默降级为错误数据或陈旧数据 |

---

## 2. Task Breakdown

### Task 1: Freeze new data contracts and schema boundaries

**Files:**
- Create: `packages/scoring/runtime/types.ts`
- Create: `packages/scoring/runtime/schema/runtime-event.schema.json`
- Create: `packages/scoring/runtime/schema/runtime-run-projection.schema.json`
- Create: `packages/scoring/analytics/schema/canonical-sft-sample.schema.json`
- Create: `packages/scoring/analytics/schema/dataset-bundle-manifest.schema.json`
- Modify: `packages/scoring/package.json`
- Test: `tests/acceptance/runtime-dashboard-schema-contract.test.ts`
- Test: `packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts`

**Step 1: Write the failing schema tests**

Add tests that assert:

- runtime event records validate against `runtime-event.schema.json`
- run projections validate against `runtime-run-projection.schema.json`
- canonical SFT samples validate against `canonical-sft-sample.schema.json`
- dataset bundle manifest validates against `dataset-bundle-manifest.schema.json`

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-schema-contract.test.ts packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts
```

Expected:
- FAIL because the new schema files and types do not exist yet

**Step 3: Add minimal schema and type definitions**

Define at minimum:

- `RuntimeEvent`
- `RuntimeRunProjection`
- `CanonicalSftSample`
- `DatasetBundleManifest`

Use explicit fields for:

- provenance
- quality flags
- split assignment
- target export compatibility
- rejection reasons

**Step 4: Export the new runtime module surface**

Update `packages/scoring/package.json` exports so the new runtime and analytics schema modules can be imported from tests and CLI code.

**Step 5: Run tests to verify the schemas pass**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-schema-contract.test.ts packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add packages/scoring/runtime packages/scoring/analytics/schema packages/scoring/package.json tests/acceptance/runtime-dashboard-schema-contract.test.ts packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts
git commit -m "feat: add runtime and canonical SFT schemas"
```

---

### Task 2: Implement runtime event store and projection engine

**Files:**
- Create: `packages/scoring/runtime/path.ts`
- Create: `packages/scoring/runtime/event-store.ts`
- Create: `packages/scoring/runtime/projection.ts`
- Create: `packages/scoring/runtime/index.ts`
- Test: `packages/scoring/runtime/__tests__/event-store.test.ts`
- Test: `packages/scoring/runtime/__tests__/projection.test.ts`

**Step 1: Write the failing runtime unit tests**

Add tests for:

- append-only runtime event writes
- ignoring `*.tmp` files in runtime loaders
- projection rebuild from mixed event sequence
- partial-run projection without score record
- projection status transitions (`pending/running/passed/failed/vetoed`)

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run packages/scoring/runtime/__tests__/event-store.test.ts packages/scoring/runtime/__tests__/projection.test.ts
```

Expected:
- FAIL because runtime store/projection modules do not exist yet

**Step 3: Implement file-backed runtime event store**

Write append/read helpers that use `_bmad-output/runtime/events/` as the event root and explicitly ignore:

- `*.tmp`
- malformed JSON
- unknown event type versions

**Step 4: Implement deterministic projection rebuild**

Projection must produce a normalized `RuntimeRunProjection` from event sequences and retain:

- run identity
- current stage
- active scope
- stage history
- score refs
- artifact refs
- dataset candidate refs

**Step 5: Run unit tests**

Run:
```bash
npx vitest run packages/scoring/runtime/__tests__/event-store.test.ts packages/scoring/runtime/__tests__/projection.test.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add packages/scoring/runtime
git commit -m "feat: add runtime event store and projection engine"
```

---

### Task 3: Emit runtime and scoring events from existing production paths

**Files:**
- Modify: `packages/runtime-context/src/cli.ts`
- Modify: `packages/runtime-context/src/context.ts`
- Modify: `packages/scoring/orchestrator/parse-and-write.ts`
- Modify: `packages/scoring/dashboard/index.ts`
- Test: `tests/acceptance/runtime-dashboard-event-wiring.test.ts`
- Test: `tests/acceptance/runtime-dashboard-score-projection.test.ts`

**Step 1: Write failing acceptance tests for production wiring**

Cover these scenarios:

- `ensure-run-runtime-context` creates run-scoped events
- stage changes generate `stage.started` / `run.scope.changed`
- `parseAndWriteScore` generates `score.written`
- projection can correlate runtime context with score records

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-event-wiring.test.ts tests/acceptance/runtime-dashboard-score-projection.test.ts
```

Expected:
- FAIL because production paths do not yet emit runtime events

**Step 3: Instrument runtime-context CLI**

Emit events when:

- run is created
- active scope changes
- lifecycle stage is set

Preserve current file outputs and registry behavior.

**Step 4: Instrument scoring write path**

Emit `score.written` after record validation and write completion, including references to:

- `run_id`
- `stage`
- `source_path`
- `base_commit_hash`
- `content_hash`

**Step 5: Rebuild projection in acceptance tests**

Verify that projection can reconstruct one coherent run view from the emitted event and score stream.

**Step 6: Run acceptance tests**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-event-wiring.test.ts tests/acceptance/runtime-dashboard-score-projection.test.ts
```

Expected:
- PASS

**Step 7: Commit**

```bash
git add packages/runtime-context/src packages/scoring/orchestrator packages/scoring/dashboard/index.ts tests/acceptance/runtime-dashboard-event-wiring.test.ts tests/acceptance/runtime-dashboard-score-projection.test.ts
git commit -m "feat: wire runtime and score event emission"
```

---

### Task 4: Add dashboard data query layer and snapshot writer

**Files:**
- Create: `packages/scoring/dashboard/runtime-query.ts`
- Create: `packages/scoring/dashboard/snapshot.ts`
- Modify: `packages/scoring/dashboard/index.ts`
- Modify: `scripts/dashboard-generate.ts`
- Modify: `packages/bmad-speckit/src/commands/dashboard.js`
- Test: `packages/scoring/dashboard/__tests__/runtime-query.test.ts`
- Test: `packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts`

**Step 1: Write failing tests for runtime-aware dashboard projection**

Add tests for:

- latest active run resolution
- snapshot generation with runtime context + score detail + trend
- graceful fallback when runtime events exist but no scores exist
- graceful fallback when scores exist but no runtime events exist

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run packages/scoring/dashboard/__tests__/runtime-query.test.ts packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts
```

Expected:
- FAIL

**Step 3: Implement runtime-aware query API**

Expose functions that return:

- overview panel model
- runtime context panel model
- stage timeline
- score detail payload
- SFT candidate summary

These functions become the only read/query surface used by:

- legacy CLI snapshot generation
- MCP tools
- webserver JSON endpoints

**Step 4: Update snapshot writer**

Modify the current Markdown generator to also write a machine-readable snapshot, for example:

- `_bmad-output/dashboard/runtime-dashboard.json`

Keep `_bmad-output/dashboard.md` for backwards compatibility.

**Step 5: Add CLI options without breaking old usage**

Extend `dashboard` command to support:

- `--json`
- `--output-json <path>`
- `--include-runtime`

Do not remove current Markdown behavior.

**Step 6: Run tests**

Run:
```bash
npx vitest run packages/scoring/dashboard/__tests__/runtime-query.test.ts packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts
node packages/bmad-speckit/bin/bmad-speckit.js dashboard --json
```

Expected:
- Tests PASS
- Command writes or prints runtime-aware JSON snapshot

**Step 7: Commit**

```bash
git add packages/scoring/dashboard scripts/dashboard-generate.ts packages/bmad-speckit/src/commands/dashboard.js packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts
git commit -m "feat: add runtime-aware dashboard query and snapshot output"
```

---

### Task 5: Implement MCP adapter plus local live dashboard server and UI

**Files:**
- Create: `packages/scoring/dashboard/mcp-server.ts`
- Create: `packages/scoring/dashboard/live-server.ts`
- Create: `packages/scoring/dashboard/ui/index.html`
- Create: `packages/scoring/dashboard/ui/app.js`
- Create: `packages/scoring/dashboard/ui/styles.css`
- Create: `packages/bmad-speckit/src/commands/runtime-mcp.js`
- Create: `packages/bmad-speckit/src/commands/dashboard-live.js`
- Modify: `packages/bmad-speckit/bin/bmad-speckit.js`
- Test: `tests/acceptance/runtime-dashboard-mcp-server.test.ts`
- Test: `tests/acceptance/runtime-dashboard-mcp-fallback.test.ts`
- Test: `tests/acceptance/runtime-dashboard-live-server.test.ts`
- Test: `tests/acceptance/runtime-dashboard-live-api.test.ts`

**Step 1: Write failing acceptance tests for MCP + live server**

Cover:

- MCP server boots over stdio and exposes runtime tools
- MCP tools read from shared query/export core, not directly from UI files
- webserver remains usable when MCP process is absent
- local server boots on an ephemeral port
- `/api/overview`
- `/api/runtime-context`
- `/api/stage-timeline`
- `/api/score-detail`
- `/api/sft-summary`
- static UI loads

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-mcp-server.test.ts tests/acceptance/runtime-dashboard-mcp-fallback.test.ts tests/acceptance/runtime-dashboard-live-server.test.ts tests/acceptance/runtime-dashboard-live-api.test.ts
```

Expected:
- FAIL

**Step 3: Implement MCP adapter**

Use a small local `stdio` MCP server that consumes the shared query/export core. The tool surface should be intentionally summary-first:

- `get_current_run_summary`
- `get_stage_status`
- `get_score_gate_result`
- `preview_sft`
- `export_sft`
- `open_dashboard`
- `get_runtime_service_health`

Do not return full raw logs or full dataset payloads by default.

**Step 4: Implement local server**

Use a small Node HTTP server, not the `website/` Astro docs app. The server should:

- serve static UI assets
- expose JSON endpoints backed by the dashboard snapshot/query layer
- support polling refresh
- support optional SSE if it can be added without extra framework complexity
- remain independently bootable when MCP is not running

**Step 5: Implement UI**

Minimum UI tabs:

- Overview
- Runtime Context
- Stage Timeline
- Score Detail
- SFT Builder Summary

The UI must clearly surface:

- active scope
- current stage
- timeline states
- veto / iteration / raw vs adjusted score
- accepted vs rejected candidate counts

**Step 6: Add CLI entrypoints**

Add a new command:

```bash
bmad-speckit runtime-mcp
bmad-speckit dashboard-live
```

Optional flags:

- `runtime-mcp --dashboard-url <url>`
- `runtime-mcp --dashboard-port <n>`
- `--port <n>`
- `--host <host>`
- `--open`

`runtime-mcp` may probe or start the local dashboard for convenience, but the dashboard must still work if `runtime-mcp` is never started.

**Step 7: Run acceptance tests**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-mcp-server.test.ts tests/acceptance/runtime-dashboard-mcp-fallback.test.ts tests/acceptance/runtime-dashboard-live-server.test.ts tests/acceptance/runtime-dashboard-live-api.test.ts
node packages/bmad-speckit/bin/bmad-speckit.js runtime-mcp --help
node packages/bmad-speckit/bin/bmad-speckit.js dashboard-live --port 43123
```

Expected:
- PASS
- MCP tools resolve
- local dashboard opens and serves JSON + UI even if MCP is not running

**Step 8: Commit**

```bash
git add packages/scoring/dashboard packages/bmad-speckit/src/commands/runtime-mcp.js packages/bmad-speckit/src/commands/dashboard-live.js packages/bmad-speckit/bin/bmad-speckit.js tests/acceptance/runtime-dashboard-mcp-server.test.ts tests/acceptance/runtime-dashboard-mcp-fallback.test.ts tests/acceptance/runtime-dashboard-live-server.test.ts tests/acceptance/runtime-dashboard-live-api.test.ts
git commit -m "feat: add runtime MCP adapter and local live dashboard"
```

---

### Task 6: Build canonical SFT candidate pipeline and quality gates

**Files:**
- Create: `packages/scoring/analytics/canonical-sample.ts`
- Create: `packages/scoring/analytics/candidate-builder.ts`
- Create: `packages/scoring/analytics/quality-gates.ts`
- Create: `packages/scoring/analytics/redaction.ts`
- Create: `packages/scoring/analytics/split.ts`
- Modify: `packages/scoring/analytics/sft-extractor.ts`
- Modify: `packages/scoring/analytics/README.md`
- Test: `packages/scoring/analytics/__tests__/candidate-builder.test.ts`
- Test: `packages/scoring/analytics/__tests__/quality-gates.test.ts`
- Test: `packages/scoring/analytics/__tests__/redaction.test.ts`
- Test: `packages/scoring/analytics/__tests__/split.test.ts`

**Step 1: Write failing tests for canonical samples**

Cover:

- legacy high-score record becomes `CanonicalSftSample`
- candidate rejected when provenance is incomplete
- `.tmp` and malformed source artifacts are ignored
- high-score-but-vetoed sample is rejected or flagged
- deterministic split assignment

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run packages/scoring/analytics/__tests__/candidate-builder.test.ts packages/scoring/analytics/__tests__/quality-gates.test.ts packages/scoring/analytics/__tests__/redaction.test.ts packages/scoring/analytics/__tests__/split.test.ts
```

Expected:
- FAIL

**Step 3: Implement canonical sample builder**

Canonical sample must preserve:

- role-aware `messages`
- optional `tools`
- provenance (`run_id`, `stage`, `artifact`, `hashes`)
- quality fields
- split
- acceptance / rejection reason

**Step 4: Implement quality gates**

At minimum, gate on:

- `phase_score`
- `veto_triggered`
- `iteration_count`
- `has_code_pair`
- token estimate
- secret / PII redaction result
- export target compatibility

**Step 5: Replace direct-output extractor path**

Refactor `sft-extractor.ts` so it becomes a legacy compatibility wrapper over the canonical pipeline instead of the primary source of truth.

**Step 6: Run analytics tests**

Run:
```bash
npx vitest run packages/scoring/analytics/__tests__/candidate-builder.test.ts packages/scoring/analytics/__tests__/quality-gates.test.ts packages/scoring/analytics/__tests__/redaction.test.ts packages/scoring/analytics/__tests__/split.test.ts packages/scoring/analytics/__tests__/sft-extractor.test.ts
```

Expected:
- PASS

**Step 7: Commit**

```bash
git add packages/scoring/analytics
git commit -m "feat: add canonical SFT candidate pipeline"
```

---

### Task 7: Add target-specific exporters, validators, and bundle writer

**Files:**
- Create: `packages/scoring/analytics/exporters/openai-chat.ts`
- Create: `packages/scoring/analytics/exporters/hf-conversational.ts`
- Create: `packages/scoring/analytics/exporters/hf-tool-calling.ts`
- Create: `packages/scoring/analytics/exporters/index.ts`
- Create: `packages/scoring/analytics/validation-report.ts`
- Create: `packages/scoring/analytics/bundle-writer.ts`
- Modify: `packages/scoring/analytics/index.ts` (create if missing)
- Test: `packages/scoring/analytics/__tests__/openai-chat-export.test.ts`
- Test: `packages/scoring/analytics/__tests__/hf-conversational-export.test.ts`
- Test: `packages/scoring/analytics/__tests__/hf-tool-calling-export.test.ts`
- Test: `packages/scoring/analytics/__tests__/bundle-writer.test.ts`

**Step 1: Write failing exporter tests**

Cover:

- OpenAI export uses JSONL with `messages`
- OpenAI tool-calling preserves tool responses
- HF conversational export preserves `messages[{role, content}]`
- HF tool-calling export writes `messages` + `tools`
- rejected samples do not enter train/validation/test output

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run packages/scoring/analytics/__tests__/openai-chat-export.test.ts packages/scoring/analytics/__tests__/hf-conversational-export.test.ts packages/scoring/analytics/__tests__/hf-tool-calling-export.test.ts packages/scoring/analytics/__tests__/bundle-writer.test.ts
```

Expected:
- FAIL

**Step 3: Implement exporters**

Each exporter must consume `CanonicalSftSample[]`, not raw score records.

Each exporter must produce only schema-valid outputs and emit a machine-readable validation result.

**Step 4: Implement bundle writer**

Write dataset bundles under a stable output root such as:

- `_bmad-output/datasets/<dataset-id>/train.jsonl`
- `_bmad-output/datasets/<dataset-id>/validation.jsonl`
- `_bmad-output/datasets/<dataset-id>/test.jsonl`
- `_bmad-output/datasets/<dataset-id>/manifest.json`
- `_bmad-output/datasets/<dataset-id>/stats.json`
- `_bmad-output/datasets/<dataset-id>/validation-report.md`
- `_bmad-output/datasets/<dataset-id>/rejection-report.json`

**Step 5: Run exporter tests**

Run:
```bash
npx vitest run packages/scoring/analytics/__tests__/openai-chat-export.test.ts packages/scoring/analytics/__tests__/hf-conversational-export.test.ts packages/scoring/analytics/__tests__/hf-tool-calling-export.test.ts packages/scoring/analytics/__tests__/bundle-writer.test.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add packages/scoring/analytics
git commit -m "feat: add OpenAI and Hugging Face dataset exporters"
```

---

### Task 8: Extend CLI for preview, optimize, validate, and bundle download

**Files:**
- Modify: `packages/bmad-speckit/src/commands/sft-extract.js`
- Modify: `packages/bmad-speckit/bin/bmad-speckit.js`
- Create: `packages/bmad-speckit/src/runtime-client.js`
- Create: `packages/bmad-speckit/src/commands/sft-preview.js`
- Create: `packages/bmad-speckit/src/commands/sft-validate.js`
- Create: `packages/bmad-speckit/src/commands/sft-bundle.js`
- Test: `packages/bmad-speckit/tests/runtime-client.test.js`
- Test: `packages/bmad-speckit/tests/sft-preview.test.js`
- Test: `packages/bmad-speckit/tests/sft-validate.test.js`
- Test: `packages/bmad-speckit/tests/sft-bundle.test.js`
- Test: `tests/acceptance/sft-dataset-cli-regression.test.ts`

**Step 1: Write failing CLI tests**

Cover:

- runtime client prefers MCP and falls back to HTTP/CLI when unavailable
- preview command returns accepted/rejected sample summary
- validate command emits schema and rejection report
- bundle command writes dataset directory
- legacy `sft-extract` remains usable

**Step 2: Run tests to verify they fail**

Run:
```bash
cd packages/bmad-speckit && node --test tests/runtime-client.test.js tests/sft-preview.test.js tests/sft-validate.test.js tests/sft-bundle.test.js
npx vitest run tests/acceptance/sft-dataset-cli-regression.test.ts
```

Expected:
- FAIL

**Step 3: Add new commands**

Recommended command surface:

- `bmad-speckit sft-preview`
- `bmad-speckit sft-validate`
- `bmad-speckit sft-bundle`

Keep `bmad-speckit sft-extract` as compatibility wrapper with target selection:

- `--target openai_chat|hf_conversational|hf_tool_calling|legacy_instruction_io`

**Step 4: Add runtime client fallback policy**

Implement one small runtime client abstraction for future skills/CLI integrations:

- try MCP first
- if MCP health check fails, try local webserver API
- if webserver is unavailable, fall back to compatibility CLI / shared core invocation

The fallback policy must be explicit and test-covered; do not leave each command to invent its own transport behavior.

**Step 5: Implement optimize controls**

At minimum support flags for:

- `--min-score`
- `--split-seed`
- `--max-tokens`
- `--drop-no-code-pair`
- `--target`
- `--bundle-dir`

**Step 6: Run CLI tests**

Run:
```bash
cd packages/bmad-speckit && node --test tests/runtime-client.test.js tests/sft-preview.test.js tests/sft-validate.test.js tests/sft-bundle.test.js
node bin/bmad-speckit.js sft-preview --help
node bin/bmad-speckit.js sft-bundle --target openai_chat
```

Expected:
- PASS

**Step 7: Commit**

```bash
git add packages/bmad-speckit/src/runtime-client.js packages/bmad-speckit/src/commands packages/bmad-speckit/bin/bmad-speckit.js packages/bmad-speckit/tests tests/acceptance/sft-dataset-cli-regression.test.ts
git commit -m "feat: add training-ready SFT dataset CLI workflow"
```

---

### Task 9: Wire MCP, dashboard, and SFT builder together

**Files:**
- Modify: `packages/scoring/dashboard/runtime-query.ts`
- Modify: `packages/scoring/dashboard/mcp-server.ts`
- Modify: `packages/scoring/dashboard/live-server.ts`
- Modify: `packages/scoring/dashboard/ui/app.js`
- Modify: `packages/scoring/analytics/candidate-builder.ts`
- Test: `tests/acceptance/runtime-dashboard-sft-tab.test.ts`

**Step 1: Write failing end-to-end dashboard/SFT integration test**

Verify that the live dashboard can display:

- accepted candidate count
- rejected candidate count
- last bundle id
- export target availability

**Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

Expected:
- FAIL

**Step 3: Add SFT summary endpoint and tab integration**

Dashboard API must expose dataset builder state, not just raw score data.

MCP preview/export tools must read the same dataset builder state as the dashboard tab.

**Step 4: Run test**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add packages/scoring/dashboard packages/scoring/analytics tests/acceptance/runtime-dashboard-sft-tab.test.ts
git commit -m "feat: surface SFT builder state in runtime dashboard"
```

---

### Task 10: Documentation, regression matrix, and rollout guardrails

**Files:**
- Modify: `docs/reference/source-code.md`
- Modify: `docs/reference/speckit-cli.md`
- Create: `docs/how-to/runtime-dashboard.md`
- Create: `docs/how-to/training-ready-sft-export.md`
- Modify: `scripts/run-fresh-regression-matrix.ts`
- Test: `tests/acceptance/runtime-dashboard-docs-contract.test.ts`
- Test: `tests/acceptance/training-ready-sft-docs-contract.test.ts`

**Step 1: Write failing docs-contract tests**

Require docs to mention:

- new dashboard live command
- runtime snapshot JSON
- canonical sample concept
- exporter targets
- bundle outputs

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-docs-contract.test.ts tests/acceptance/training-ready-sft-docs-contract.test.ts
```

Expected:
- FAIL

**Step 3: Update docs**

Write operator-facing docs for:

- how MCP-first runtime access works
- what happens when MCP is unavailable
- how to start the dashboard
- how to inspect runtime context
- how to preview and validate SFT samples
- how to export and download dataset bundles

**Step 4: Extend fresh regression matrix**

Add smoke entries for:

- `bmad-speckit runtime-mcp --help`
- `bmad-speckit dashboard-live --help`
- `bmad-speckit sft-preview --help`
- `bmad-speckit sft-bundle --help`

**Step 5: Run docs and regression tests**

Run:
```bash
npx vitest run tests/acceptance/runtime-dashboard-docs-contract.test.ts tests/acceptance/training-ready-sft-docs-contract.test.ts
npx ts-node --transpile-only scripts/run-fresh-regression-matrix.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add docs/reference docs/how-to scripts/run-fresh-regression-matrix.ts tests/acceptance/runtime-dashboard-docs-contract.test.ts tests/acceptance/training-ready-sft-docs-contract.test.ts
git commit -m "docs: add runtime dashboard and training-ready SFT guides"
```

---

## 3. Cross-Cutting Risks

### Risk 1: Mixing docs site and runtime dashboard too early

Mitigation:

- Keep `website/` out of Phase 1 runtime delivery
- Use local file-backed server and static UI assets inside the scoring/dashboard stack

### Risk 2: Reusing `git diff base_commit_hash..HEAD` as final provenance

Mitigation:

- Treat it as a temporary compatibility fallback only
- Record unstable provenance in `quality` and reject for strict export targets where needed

### Risk 3: Projection drift between runtime events and score records

Mitigation:

- Add acceptance tests that rebuild one run from both sources
- Fail loudly on missing or contradictory `run_id/stage` mappings

### Risk 4: Exporters hard-coding platform assumptions

Mitigation:

- Keep exporters target-specific and shallow
- Keep canonical schema richer than all export targets

### Risk 5: MCP-first implementation accidentally creates a single point of failure

Mitigation:

- Keep all read/query/export logic in shared core modules, never inside MCP transport handlers
- Add acceptance tests for `MCP down / webserver up` and `webserver down / MCP up`
- Require docs and CLI help to spell out fallback behavior

---

## 4. Recommended Validation Sequence

Run this sequence at the end of each major phase:

```bash
npm run test:scoring
npx vitest run tests/acceptance/runtime-dashboard-schema-contract.test.ts
npx vitest run tests/acceptance/runtime-dashboard-event-wiring.test.ts
npx vitest run tests/acceptance/runtime-dashboard-mcp-server.test.ts tests/acceptance/runtime-dashboard-mcp-fallback.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-server.test.ts
npx vitest run tests/acceptance/runtime-dashboard-sft-tab.test.ts
cd packages/bmad-speckit && node --test tests/runtime-client.test.js tests/sft-preview.test.js tests/sft-validate.test.js tests/sft-bundle.test.js
node packages/bmad-speckit/bin/bmad-speckit.js dashboard --help
node packages/bmad-speckit/bin/bmad-speckit.js runtime-mcp --help
node packages/bmad-speckit/bin/bmad-speckit.js dashboard-live --help
node packages/bmad-speckit/bin/bmad-speckit.js sft-preview --help
node packages/bmad-speckit/bin/bmad-speckit.js sft-bundle --help
```

Expected:

- all tests PASS
- all new CLI commands resolve
- `runtime-mcp` and `dashboard-live` can fail independently without taking down the other surface
- legacy `dashboard` and `sft-extract` remain functional

---

## 5. Done Definition

The implementation is complete only when all of the following are true:

- Runtime event store and projection exist and are wired into production paths
- Shared projection/query/export core is the only source consumed by CLI, MCP, and webserver
- MCP is the preferred runtime adapter, but dashboard and export flows still work when MCP is absent
- Local live runtime dashboard works against file-backed projections
- Score drill-down surfaces raw/adjusted score, veto, iteration, dimension, provenance
- `CanonicalSftSample` is the only internal truth for training exports
- OpenAI and Hugging Face export targets produce schema-valid outputs
- Preview, validate, split, optimize, and bundle download flows exist
- Docs and regression matrix cover the new commands and outputs
- Existing `dashboard` / `sft-extract` usage has a documented compatibility path

---

Plan complete and saved to `docs/plans/2026-03-27-runtime-dashboard-sft-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
