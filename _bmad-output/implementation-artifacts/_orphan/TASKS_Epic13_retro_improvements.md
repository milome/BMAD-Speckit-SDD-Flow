# Epic 13 Retrospective 改进任务——修改方案与实现步骤

**来源**：epic-13-retro-2026-03-09.md 行动项 #1、#2  
**起草日期**：2026-03-09

---

## 改进一：项目级 npm test 超时失败用例

### §1.1 现象与根因

| 用例 | 文件 | 行号 | 超时值 | 根因假设 |
|------|------|------|--------|----------|
| `content_hash is deterministic for same content (GAP-B01)` | scoring/orchestrator/__tests__/parse-and-write.test.ts | 221 | 5000ms（默认） | 两次 `parseAndWriteScore` 调用（含文件 I/O、hash 计算），冷启动或 CI 环境下超时 |
| `(5) CLI 无完整 Story 时输出含「Epic N 下无完整 Story」` | scoring/__tests__/integration/dashboard-epic-aggregate.test.ts | 92 | 5000ms（默认） | `execSync('npx ts-node scripts/dashboard-generate.ts ...')` 冷启动 ts-node 耗时；或 fixture 加载、输出路径写入较慢 |

### §1.2 修改方案（三选一或组合）

| 方案 | 说明 | 适用 | 风险 |
|------|------|------|------|
| **A：延长 timeout** | 为两个用例单独设置 `it('...', async () => {...}, 15000)` 或 20000 | 首选，改动最小 | 若根因是逻辑错误，延长 timeout 无法根本解决 |
| **B：正式排除** | 将用例加入 `EXCLUDED_TESTS_*.md` 或 vitest exclude | 仅当确认为环境/非功能问题 | 需用户批准；会降低回归覆盖 |
| **C：优化用例本身** | content_hash：mock 或减少 I/O；dashboard：预 warm ts-node 或拆为不调 CLI 的单元测 | 根除慢因 | 工作量大，可能改变测试语义 |

**推荐**：方案 A（延长 timeout）为首发；若仍超时，再考虑 C 或 B。

### §1.3 实现步骤

#### Step 1.1：parse-and-write content_hash 用例

1. **文件**：`scoring/orchestrator/__tests__/parse-and-write.test.ts`
2. **位置**：第 221 行 `it('content_hash is deterministic for same content (GAP-B01)', async () => {`
3. **修改**：在 `it` 中传入 timeout 配置（二选一）：
   - Vitest 推荐：`it('content_hash...', { timeout: 15000 }, async () => { ... });`
   - Jest 兼容：`it('content_hash...', async () => { ... }, 15000);`

   **实际操作**：将第 221 行的 `it('content_hash is deterministic...', async () => {` 改为 `it('content_hash is deterministic...', { timeout: 15000 }, async () => {`（在 `async` 前插入 `{ timeout: 15000 }, `）。

#### Step 1.2：dashboard-epic-aggregate CLI 用例

1. **文件**：`scoring/__tests__/integration/dashboard-epic-aggregate.test.ts`
2. **位置**：第 92 行 `it('(5) CLI 无完整 Story 时输出含「Epic N 下无完整 Story」', () => {`
3. **修改**：在 `it` 中传入 timeout（sync 测试同样支持）：
   - 将第 92 行的 `it('(5) CLI 无完整 Story...', () => {` 改为 `it('(5) CLI 无完整 Story...', { timeout: 15000 }, () => {`

#### Step 1.3：验收

- 在项目根执行：`npm test`
- 预期：两个用例均通过，无 timeout 错误
- 若仍超时：将 15000 调整为 20000 或 30000，或进入方案 C/B

---

## 改进二：spec 审计标记自动追加

### §2.1 现象与根因

- **现象**：`check_speckit_prerequisites.py` 检查 spec/plan/GAPS/tasks **文档本身**是否含 `<!-- AUDIT: PASSED by code-reviewer -->` 或等价标记；若无则判「未通过审计」。
- **当前流程**：审计子代理通过时仅「保存审计报告至 reportPath」并「执行 parse-and-write-score」，**不修改被审文档**。
- **根因**：audit-prompts §1～§4 的【审计后动作】未要求子代理在**被审文档**末尾追加审计标记；标记依赖主 Agent 或人工补加。

### §2.2 修改方案

在 audit-prompts.md 的 **§1、§2、§3、§4** 各【审计后动作】段落中，**新增**一条强制动作：

> **审计通过时，你（审计子代理）必须在被审文档末尾追加一行**：`<!-- AUDIT: PASSED by code-reviewer -->`。若文档末尾已存在该行（或 `<!-- AUDIT: PASSED` 前缀），则不必重复追加。追加后，再进行报告保存与 parse-and-write-score 执行。

**被审文档路径**（与 artifactDocPath 一致）：

- §1 spec：`specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md`
- §2 plan：`specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md`
- §3 GAPS：`specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/IMPLEMENTATION_GAPS-E{epic}-S{story}.md`
- §4 tasks：`specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md`

### §2.3 实现步骤

#### Step 2.1：确定 audit-prompts 修改位置

1. **文件**：`skills/speckit-workflow/references/audit-prompts.md`（或项目内等效路径，如 `docs/speckit/skills/speckit-workflow/references/audit-prompts.md`）
2. **修改点**：§1、§2、§3、§4 各自的【审计后动作】段落

#### Step 2.2：§1 spec 审计后动作（精确修改）

**文件**：`skills/speckit-workflow/references/audit-prompts.md`  
**行号**：约第 17 行

**替换前**：
```text
【审计后动作】审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath
```

**替换后**：
```text
【审计后动作】审计通过时，**你（审计子代理）必须**：① 在被审文档（artifactDocPath 所指 spec-E{epic}-S{story}.md）末尾追加一行 `<!-- AUDIT: PASSED by code-reviewer -->`，若文档末尾已含该行或 `<!-- AUDIT: PASSED` 则跳过；② 将完整报告保存至调用方在本 prompt 中指定的 reportPath
```

（后续「并在结论中注明保存路径...」「parse-and-write-score」「禁止」「审计未通过时」等保持不变。）

#### Step 2.3：§2 plan、§3 GAPS、§4 tasks 审计后动作

对 §2（约第 25 行）、§3（约第 35 行）、§4（约第 72 行）做**相同结构**的修改：

- **§2**：`artifactDocPath 所指 plan-E{epic}-S{story}.md`
- **§3**：`artifactDocPath 所指 IMPLEMENTATION_GAPS-E{epic}-S{story}.md`
- **§4**：`artifactDocPath 所指 tasks-E{epic}-S{story}.md`

**统一的替换前**（每段均以该句开头）：
```text
【审计后动作】审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath
```

**统一的替换后**（仅 artifactDocPath 所指文件名不同）：
```text
【审计后动作】审计通过时，**你（审计子代理）必须**：① 在被审文档（artifactDocPath 所指 <plan|IMPLEMENTATION_GAPS|tasks>-E{epic}-S{story}.md）末尾追加一行 `<!-- AUDIT: PASSED by code-reviewer -->`，若文档末尾已含该行或 `<!-- AUDIT: PASSED` 则跳过；② 将完整报告保存至调用方在本 prompt 中指定的 reportPath
```

#### Step 2.4：可选——bmad-story-assistant 中 speckit 子任务 prompt 强化

若发起 speckit specify/plan/GAPS/tasks 的子任务时，prompt 由 bmad-story-assistant 或 speckit-workflow 定义，可在该 prompt 中**显式提醒**：

> 审计通过时，除保存报告与执行 parse-and-write-score 外，**必须在被审文档末尾追加** `<!-- AUDIT: PASSED by code-reviewer -->`，否则 check_speckit_prerequisites 会判未通过。

确保子代理加载的 audit-prompts 已含上述修改，或主 Agent 传入的 prompt 已包含此要求。

#### Step 2.5：验收

1. 新起一个 Story（或复用已有 Story），执行 speckit specify→plan→GAPS→tasks 四阶段。
2. 审计子代理在每阶段通过时，应自动在被审文档末尾追加标记。
3. 运行：`python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic {N} --story {M} --project-root {root}`
4. 预期：四个文档均「存在 + 审计通过」，退出码 0。

---

## §3 任务清单（可直接作为 TASKS 执行）

| ID | 任务 | 文件 | 验收 |
|----|------|------|------|
| T1 | parse-and-write content_hash 用例增加 timeout 15000 | scoring/orchestrator/__tests__/parse-and-write.test.ts | `npm test` 通过，无 timeout |
| T2 | dashboard-epic-aggregate 用例 (5) 增加 timeout 15000 | scoring/__tests__/integration/dashboard-epic-aggregate.test.ts | `npm test` 通过 |
| T3 | audit-prompts §1 审计后动作：审计通过时追加标记到 spec 文档末尾 | skills/speckit-workflow/references/audit-prompts.md | grep 含「追加」「AUDIT: PASSED」「被审文档」 |
| T4 | audit-prompts §2 审计后动作：同上，plan 文档 | 同上 | 同上 |
| T5 | audit-prompts §3 审计后动作：同上，IMPLEMENTATION_GAPS 文档 | 同上 | 同上 |
| T6 | audit-prompts §4 审计后动作：同上，tasks 文档 | 同上 | 同上 |
| T7 | （可选）bmad-story-assistant 中 speckit 子任务 prompt 增加「追加标记」提醒 | skills/bmad-story-assistant/SKILL.md | 子任务 prompt 含该提醒 |
| T8 | 回归：`npm test` 全通过；check_speckit_prerequisites 对新 Story 通过 | — | 两项均通过 |

---

## §4 依赖与注意事项

- **改进一**：不依赖改进二，可独立实施。
- **改进二**：修改 audit-prompts 后，需确保**所有**调用 speckit 审计的子任务（含 mcp_task、Cursor Task）使用的 prompt 来源为更新后的 audit-prompts；若项目内有多份拷贝，须统一更新。
- **兼容性**：追加标记为 append，不改变文档正文语义；已含标记的文档（如 Story 13-4、13-5 的 spec 等）追加时为幂等，可跳过。

---

*文档由 Epic 13 回顾行动项起草，供实施参考。*
