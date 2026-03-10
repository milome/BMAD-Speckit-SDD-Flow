# Gaps 功能补充实现任务列表（Party-Mode 细化版 v2）

> **来源**: Party-Mode 深度讨论（批判审计员 + AI 代码教练各 >30%，113 轮收敛，最后 3 轮无新 Gap）  
> **目的**: 所有 GAP 均给出最终最优实现方案，禁止降级  
> **日期**: 2026-03-05  
> **版本**: v2.1（修复 code-reviewer 三轮审计发现的全部问题，终审通过）  
> **原则**: 每项任务明确到函数签名、文件路径、测试用例，禁止"可选""可考虑""后续""酌情"等模糊表述

---

## 全局 Schema 变更汇总

以下字段统一在 `scoring/writer/types.ts` 的 `RunScoreRecord` 和 `scoring/schema/run-score-schema.json` 中新增：

| 字段 | 类型 | 来源 GAP | 语义 |
|------|------|---------|------|
| `base_commit_hash` | `string?` | B01 ✅ | 评分时 git HEAD 的 commit hash（修改前基线），由 `getGitHeadHash()` 自动采集 |
| `content_hash` | `string?` | B01 ✅ | 传入 `parseAndWriteScore` 的 `content` 参数（审计报告文本）的 SHA-256。**注意**：这是审计报告内容的 hash，不是被审计源文件的 hash |
| `source_hash` | `string?` | B02 | 被审计的源文件（如 `spec.md`、`plan.md`）的 SHA-256 指纹，用于跨阶段版本锁定校验。由 `ParseAndWriteScoreOptions.sourceHashFilePath` 参数传入的文件路径计算 |
| `source_path` | `string?` | B07 | 触发本次评分的源文档路径（如 BUGFIX 文档路径），用于 SFT 提取时关联 BUGFIX 文档。由 `ParseAndWriteScoreOptions.artifactDocPath` 参数传入 |
| `dimension_scores` | `DimensionScore[]?` | B11 | 各维度子分数数组 `{dimension, weight, score}`，维度解析成功时填充 |

> **命名区分**：`sourceHashFilePath`（B02）= 计算 `source_hash` 的被审计源文件路径；`artifactDocPath`（B07）= 记录到 `source_path` 的触发文档路径。两者语义不同，传入的文件也不同。

> **`phase_weight` 语义说明**：`phase_weight` 是每个 stage 记录的基准权重标签（当前全部为 0.2），不是"该记录在总分中的占比"。同一 run 下多条记录的 `phase_weight` 之和可能超过 1.0。当前 AI Coach 的 `buildWeakAreas` 仅使用 `phase_score` 做阈值判定，不使用 `phase_weight` 做加权求和。

所有新增字段均为可选（`?`），不影响现有数据兼容性，`required` 数组不变。

B03 还需更新 `run-score-schema.json` 的 `stage` enum：新增 `"spec"`（`plan` 和 `tasks` 已存在于现有 enum 中）。

---

## GAP-B01: RunScoreRecord 版本追溯字段 ✅ 已实现

**实现日期**: 2026-03-05  
**实现路径**: 路径 C（base_commit_hash + content_hash 双字段方案）  
**详情**: 见历史版本。129 个测试全部通过，零回归。

> **审计修正**：`content_hash` 的 JSDoc 需从当前的"被审计文件内容的 SHA-256 指纹"更新为"传入 parseAndWriteScore 的审计报告内容的 SHA-256（非源文件 hash）"。此更新在 B02 实施中优先执行。

---

## GAP-B02: 版本锁定机制（前置阶段 hash 校验）

### 问题

无代码在 specify→plan→GAPS→tasks 流转时校验前置文档 hash。交底书声称"若版本不匹配，系统将拦截流转指令"（L55）。

### Party-Mode 关键决策

1. GAP-B01 的 `content_hash` 是审计报告内容的 hash，不是被审计源文件的 hash。版本锁定需要的是源文件 hash → 新增 `source_hash` 字段
2. `checkPreconditionHash` 需要读取上一阶段的 scoring record → 新增 `loadLatestRecordByStage` 函数
3. 校验异常（函数内部 error）时 action 为 `warn_and_proceed`，不阻断流程。校验失败（hash 不匹配）时 action 为 `block`
4. 上一阶段无记录（首次运行场景）→ `warn_and_proceed`

### 实现方案

**修改文件 1**: `scoring/writer/types.ts`

- 更新 `content_hash` 的 JSDoc 为：`传入 parseAndWriteScore 的审计报告内容的 SHA-256（非源文件 hash）`
- `RunScoreRecord` 新增 `source_hash?: string`，JSDoc：`被审计的源文件的 SHA-256 指纹，用于跨阶段版本锁定校验`

**修改文件 2**: `scoring/schema/run-score-schema.json`

- `properties` 新增 `"source_hash": { "type": "string", "description": "SHA-256 of audited source file for cross-stage version lock" }`

**修改文件 3**: `scoring/orchestrator/parse-and-write.ts` 的 `parseAndWriteScore` 函数

- `ParseAndWriteScoreOptions` 新增 `sourceHashFilePath?: string`
- 在函数体内：如 `sourceHashFilePath` 非空，调用 `path.isAbsolute` resolve 路径后调用 `computeContentHash(resolvedPath)` 写入 `source_hash`

**修改文件 4**: `scripts/parse-and-write-score.ts` 的 `main` 函数

- 新增 `--sourceHashFilePath` CLI 参数

**新增文件 1**: `scoring/gate/version-lock.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { computeContentHash } from '../utils/hash';
import type { RunScoreRecord } from '../writer/types';

export interface VersionLockResult {
  passed: boolean;
  action: 'proceed' | 'warn_and_proceed' | 'block';
  actual_hash: string;
  expected_hash: string;
  preconditionFile: string;
  reason: string;
}

/**
 * 校验前置阶段源文件的 hash 是否与上一阶段审计记录中的 source_hash 一致。
 * hash 匹配→proceed；不匹配→block；异常→warn_and_proceed。
 */
export function checkPreconditionHash(
  currentStage: string,
  preconditionFile: string,
  expectedHash: string
): VersionLockResult

/**
 * 从 scoring/data/ 目录中查找指定 stage 的最新记录。
 * 扫描逻辑：
 * 1. 读取 dataPath 下所有 *.json 文件（排除 scores.jsonl）
 * 2. 解析每个文件为 RunScoreRecord
 * 3. 按 record.stage === stage 过滤
 * 4. 按 record.timestamp 降序排列
 * 5. 返回第一条（最新），无匹配则返回 null
 */
export function loadLatestRecordByStage(
  stage: string,
  dataPath?: string
): RunScoreRecord | null
```

**典型调用编排**（CLI 或 Skill 中的使用方式）：

```typescript
const priorRecord = loadLatestRecordByStage('spec', dataPath);
if (priorRecord?.source_hash) {
  const lockResult = checkPreconditionHash('plan', 'path/to/spec.md', priorRecord.source_hash);
  if (lockResult.action === 'block') {
    console.error(`版本锁定失败：${lockResult.reason}`);
    process.exit(1);
  }
  if (lockResult.action === 'warn_and_proceed') {
    console.warn(`版本锁定警告：${lockResult.reason}`);
  }
}
// 继续执行 parseAndWriteScore...
```

**新增文件 2**: `scoring/gate/__tests__/version-lock.test.ts`

测试用例（7 个）：

1. hash 匹配 → `{ passed: true, action: 'proceed' }`
2. hash 不匹配 → `{ passed: false, action: 'block' }`
3. 源文件不存在 → `{ passed: false, action: 'block', reason: 'file not found: ...' }`
4. 上一阶段无记录 → `{ passed: true, action: 'warn_and_proceed', reason: 'no prior record' }`
5. 多条同 stage 记录取最新（按 timestamp）
6. 函数内部异常（如 dataPath 不可读）→ `{ passed: true, action: 'warn_and_proceed', reason: 'internal error: ...' }`
7. **集成测试**：`loadLatestRecordByStage` + `checkPreconditionHash` 联动——先写入一条含 `source_hash` 的记录，再校验成功

**失败影响**: 校验异常 → warn_and_proceed + console.warn（不阻断流程）；校验失败 → block（阻断流转）。`loadLatestRecordByStage` 扫描 `scoring/data/` 目录下所有 JSON 文件，文件数量级通常 < 100，性能开销可忽略。

---

## GAP-B03: spec/plan/tasks 阶段评分规则补充

### 问题

`spec-scoring.yaml`、`plan-scoring.yaml`、`tasks-scoring.yaml` 均为 3 行占位符。交底书声称"对每个细粒度开发节点实行 100% 程序化的分数制裁"（L59）。

### 实现方案

**修改文件 1**: `scoring/rules/spec-scoring.yaml`

```yaml
version: "1.0"
stage: spec
link_stage: [specify]
link_环节: 1

weights:
  base:
    demand_coverage: 35
    clarity: 25
    verifiability: 25
    consistency: 15

items:
  - id: spec_demand_coverage
    name: "需求映射完整性"
    description: "原始需求全部映射到 spec"
    deduct: 10
  - id: spec_ambiguity_free
    name: "描述无歧义"
    description: "无模糊、待定表述"
    deduct: 5
  - id: spec_testable
    name: "验收标准可验证"
    description: "每条需求有可执行的验收标准"
    deduct: 8
  - id: spec_terminology
    name: "术语一致"
    description: "术语定义统一无矛盾"
    deduct: 3

veto_items:
  - id: veto_core_unmapped
    ref: code-reviewer-config#veto_core_unmapped
    consequence: gaps_pre_0_veto
```

**修改文件 2**: `scoring/rules/plan-scoring.yaml`

```yaml
version: "1.0"
stage: plan
link_stage: [plan]
link_环节: 1

weights:
  base:
    module_coverage: 30
    dependency_analysis: 25
    gaps_actionability: 25
    test_strategy: 20

items:
  - id: plan_module_coverage
    name: "模块覆盖度"
    description: "plan 覆盖 spec 中所有模块"
    deduct: 10
  - id: plan_dependency_clear
    name: "依赖分析清晰"
    description: "模块间依赖关系明确"
    deduct: 5
  - id: plan_gaps_actionable
    name: "GAPS 可操作"
    description: "每个 GAP 有明确的技术方案"
    deduct: 8
  - id: plan_test_integrated
    name: "测试策略含集成测试"
    description: "测试计划包含集成测试和端到端测试"
    deduct: 5

veto_items:
  - id: veto_plan_no_test_strategy
    name: "完全无测试策略"
    consequence: stage_0_level_down
```

**修改文件 3**: `scoring/rules/tasks-scoring.yaml`

```yaml
version: "1.0"
stage: tasks
link_stage: [tasks]
link_环节: 1

weights:
  base:
    executability: 30
    gaps_mapping: 25
    acceptance_criteria: 25
    granularity: 20

items:
  - id: tasks_executable
    name: "任务可执行"
    description: "每个任务有明确的输入输出"
    deduct: 8
  - id: tasks_gaps_mapped
    name: "GAPS 完全映射"
    description: "所有 GAP 有对应任务"
    deduct: 10
  - id: tasks_acceptance_defined
    name: "验收标准明确"
    description: "每个任务有可执行的验收命令"
    deduct: 8
  - id: tasks_granularity_ok
    name: "粒度合理"
    description: "任务粒度 2-8 小时"
    deduct: 3

veto_items:
  - id: veto_tasks_no_acceptance
    name: "核心任务无验收标准"
    consequence: stage_0_level_down
```

**修改文件 4**: `scoring/parsers/audit-index.ts`（注意：`AuditStage` 定义在此文件，非 `index.ts`）

- 扩展 `AuditStage` 类型：`'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks'`
- `parseAuditReport` 函数的 `switch` 中新增 3 个 case 分支：
  - `case 'spec':` → 调用 `parseGenericReport({ ...input, stage: 'spec', phaseWeight: PHASE_WEIGHTS_SPEC })`
  - `case 'plan':` → 调用 `parseGenericReport({ ...input, stage: 'plan', phaseWeight: PHASE_WEIGHTS_PLAN })`
  - `case 'tasks':` → 调用 `parseGenericReport({ ...input, stage: 'tasks', phaseWeight: PHASE_WEIGHTS_TASKS })`

**修改文件 5**: `scoring/parsers/index.ts`

- re-export 新增的 `AuditStage` 扩展类型

**修改文件 6**: `scoring/schema/run-score-schema.json`

- `stage` enum 新增 `"spec"`（`plan` 和 `tasks` 已存在于现有 enum 中）

**修改文件 7**: `scripts/parse-and-write-score.ts` 的 `main` 函数

- L27 的 stage 类型断言从 `'prd' | 'arch' | 'story'` 更新为 `AuditStage`（import from parsers）

**新增文件 1**: `scoring/parsers/audit-generic.ts`

```typescript
import type { RunScoreRecord, CheckItem } from '../writer/types';

/**
 * 从 audit-prd.ts 提升为 export 的共享函数。
 * 实现方式：将 audit-prd.ts 中的 extractOverallGrade 和 extractCheckItemsFromPrd
 * 提取到本模块并 export，audit-prd.ts 改为 import 调用。
 */
export function extractOverallGrade(content: string): string | null;
export function extractCheckItems(content: string, stage: string): CheckItem[];

export async function parseGenericReport(input: {
  content: string;
  stage: string;
  runId: string;
  scenario: 'real_dev' | 'eval_question';
  phaseWeight: number;
}): Promise<RunScoreRecord>
```

- `extractOverallGrade` 和 `extractCheckItems` 从 `audit-prd.ts` 迁移到本模块并 export
- `audit-prd.ts` 改为从本模块 import（保持向后兼容）
- B05 的 LLM fallback 也在本模块的 `extractOverallGrade` 失败时触发（LLM fallback 接入点在此）

**修改文件 8**: `scoring/parsers/audit-prd.ts` 的 `extractOverallGrade` 和 `extractCheckItemsFromPrd` 函数

- 将这两个私有函数体迁移到 `audit-generic.ts`，本文件改为 import 调用

**修改文件 9**: `scoring/constants/weights.ts`

- 新增 spec/plan/tasks 的 phase_weight = 0.2

**新增测试 fixtures**: `sample-spec-report.md`, `sample-plan-report.md`, `sample-tasks-report.md`

**新增测试**: `scoring/parsers/__tests__/audit-generic.test.ts`

测试用例（9 个，每阶段 3 个）：

1. spec 阶段正常解析 + stage='spec' + phaseWeight=0.2
2. spec 阶段提取 check_items（含 spec_demand_coverage 等 item_id）
3. spec 阶段等级缺失 → ParseError
4. plan 阶段正常解析 + stage='plan' + phaseWeight=0.2
5. plan 阶段提取 check_items
6. plan 阶段等级缺失 → ParseError
7. tasks 阶段正常解析 + stage='tasks' + phaseWeight=0.2
8. tasks 阶段提取 check_items
9. tasks 阶段等级缺失 → ParseError

---

## GAP-B04: scoring-trigger-modes.yaml 程序化加载器

### 问题

`config/scoring-trigger-modes.yaml` 存在完整配置，但无代码读取它来决定是否调用 `parseAndWriteScore`。

### Party-Mode 关键决策

1. `shouldWriteScore` 作为独立函数，不嵌入 `parseAndWriteScore`（单一职责原则 + 避免测试回归）
2. 首次读取 YAML 后缓存到 module-level 变量，提供 `resetTriggerConfigCache()` 用于测试。缓存是进程内变量，多进程场景各进程独立缓存，无竞争
3. config 文件不存在时抛异常（config 是必需文件）

### 实现方案

**新增文件 1**: `scoring/trigger/trigger-loader.ts`

```typescript
export interface TriggerConfig {
  scoring_write_control: {
    enabled: boolean;
    fail_policy: string;
    call_mapping: Record<string, { event: string; stage: string }>;
  };
  event_to_write_mode: Record<string, Record<string, string>>;
}

export interface TriggerDecision {
  write: boolean;
  writeMode: WriteMode;
  reason: string;
}

export function loadTriggerConfig(configPath?: string): TriggerConfig;
export function resetTriggerConfigCache(): void;

/**
 * 判断是否应写入评分记录。
 * event 和 stage 的合法值与 scoring-trigger-modes.yaml 的 call_mapping 一致：
 * - event: 'stage_audit_complete' | 'story_status_change' | 'mr_created' | 'epic_pending_acceptance' | 'user_explicit_request'
 * - stage: 'speckit_1_2' | 'speckit_2_2' | ... | 'bmad_story_stage2' | 'bmad_story_stage4'
 * 匹配逻辑：遍历 call_mapping 的所有条目，查找 entry.event === event && entry.stage === stage 的条目。
 */
export function shouldWriteScore(
  event: string,
  stage: string,
  scenario: 'real_dev' | 'eval_question',
  configPath?: string
): TriggerDecision;
```

- `shouldWriteScore` 逻辑：
  1. 加载 config（从缓存或文件）
  2. 检查 `scoring_write_control.enabled`，false → `{ write: false, reason: 'scoring disabled' }`
  3. 遍历 `call_mapping` 的所有条目，查找 `entry.event === event && entry.stage === stage`，无匹配 → `{ write: false, reason: 'stage not registered' }`
  4. 从 `event_to_write_mode[event][scenario]` 解析 writeMode，fallback 到 `event_to_write_mode[event].default`
  5. 返回 `{ write: true, writeMode, reason: 'matched' }`

**修改文件 1**: `scripts/parse-and-write-score.ts` 的 `main` 函数

- 新增 `--event` 参数
- 在调用 `parseAndWriteScore` 前调用 `shouldWriteScore`
- 新增 `--skipTriggerCheck` 参数用于跳过 trigger 检查

**新增测试**: `scoring/trigger/__tests__/trigger-loader.test.ts`

测试用例（7 个）：

1. enabled=true + event='stage_audit_complete' + stage='speckit_1_2' → `write: true`
2. enabled=false → `write: false`
3. stage 未注册（如 stage='nonexistent'）→ `write: false`
4. real_dev 和 eval_question 返回不同 writeMode（验证 `event_to_write_mode` 分支）
5. config 文件不存在 → 抛异常
6. 二次调用不重读文件（mock fs.readFileSync 验证调用次数）
7. `resetTriggerConfigCache` 后重新读文件

**失败影响**: config 文件不存在 → 抛异常阻断。config 解析错误 → 抛异常阻断。

---

## GAP-B05: LLM 结构化提取 fallback

### 问题

解析器 100% 基于正则表达式，非标格式的审计报告无法解析。

### Party-Mode 关键决策

1. 准确名称是"LLM 结构化提取 fallback"，非"NLP 解析树"
2. 严格 fallback 链：正则 → LLM → 抛异常
3. 无 API key 时跳过 LLM 层，退回正则失败行为
4. LLM schema 校验失败后重试 1 次，第二次失败则抛错
5. API 超时通过 `SCORING_LLM_TIMEOUT_MS` 环境变量配置，默认 30000ms

### ⚠️ 数据安全警告

`llmStructuredExtract` 会将审计报告全文发送至外部 LLM API。审计报告可能包含项目内部代码片段、安全漏洞描述等敏感信息。

安全措施：
- 环境变量 `SCORING_LLM_API_KEY` 未配置时，LLM fallback 完全跳过，不发送任何数据
- system prompt 中包含指令："仅返回 JSON 结构，不要包含或引用输入文本中的代码片段"
- 使用前应确认 LLM API 提供方的数据处理协议符合项目安全要求

### 实现方案

**新增文件 1**: `scoring/parsers/llm-fallback.ts`

```typescript
export interface LlmExtractionResult {
  grade: 'A' | 'B' | 'C' | 'D';
  issues: Array<{ severity: '高' | '中' | '低'; description: string }>;
  veto_items: string[];
}

/**
 * System prompt 固化为代码中的常量 LLM_SYSTEM_PROMPT，内容如下：
 * "你是一个审计报告结构化提取器。从提供的审计报告中提取以下信息，
 *  仅返回 JSON 格式，不要返回任何其他内容：
 *  { "grade": "A"|"B"|"C"|"D", "issues": [{"severity":"高"|"中"|"低","description":"..."}], "veto_items": ["item_id",...] }
 *  仅返回 JSON 结构，不要包含或引用输入文本中的代码片段。"
 */
export const LLM_SYSTEM_PROMPT: string;

export async function llmStructuredExtract(
  reportContent: string,
  stage: string
): Promise<LlmExtractionResult>
```

- 环境变量：`SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`（默认 `https://api.openai.com/v1`）、`SCORING_LLM_MODEL`（默认 `gpt-4o-mini`）、`SCORING_LLM_TIMEOUT_MS`（默认 `30000`）
- 使用 Node.js 内置 `fetch` 发送 `/v1/chat/completions` 请求，设置 `AbortSignal.timeout(SCORING_LLM_TIMEOUT_MS)`
- 对返回 JSON 做结构校验：grade 必须为 `'A'|'B'|'C'|'D'`，issues 为数组且每项 severity 必须为 `'高'|'中'|'低'`
- 校验失败重试 1 次（最多 2 次调用）
- API 超时或网络错误 → 抛 ParseError

**修改文件 1**: `scoring/parsers/audit-prd.ts` 的 `parsePrdReport` 函数

- `extractOverallGrade`（从 `audit-generic.ts` import）返回 null 时：
  - 检查 `process.env.SCORING_LLM_API_KEY` 是否存在
  - 存在 → 调用 `llmStructuredExtract(content, 'prd')`，将结果的 `grade` 映射为 `GRADE_TO_SCORE`，`issues` 映射为 `CheckItem[]`
  - 不存在 → 抛原始 ParseError（与当前行为一致）

**修改文件 2**: `scoring/parsers/audit-arch.ts` 的 `parseArchReport` 函数

- 在 `extractOverallGrade` 返回 null 时，插入与 audit-prd.ts 相同的 LLM fallback 逻辑

**修改文件 3**: `scoring/parsers/audit-story.ts` 的 `parseStoryReport` 函数

- 在 `extractOverallGrade` 返回 null 时，插入与 audit-prd.ts 相同的 LLM fallback 逻辑

**修改文件 4**: `scoring/parsers/audit-generic.ts` 的 `parseGenericReport` 函数（B03 新增）

- 在 `extractOverallGrade` 返回 null 时，同样插入 LLM fallback 逻辑（B05 与 B03 共享 fallback 接入点）

**新增测试**: `scoring/parsers/__tests__/llm-fallback.test.ts`

测试用例（6 个，mock global.fetch）：

1. 正则成功 → 不调用 LLM（fetch 未被调用）
2. 正则失败 + LLM 返回合法 JSON → 正确映射为 grade + checkItems
3. 正则失败 + LLM 首次返回非法 JSON + 重试成功 → 返回重试结果
4. 正则失败 + LLM 两次均失败 → 抛 ParseError
5. 无 API key（`process.env.SCORING_LLM_API_KEY` 未设置）→ 跳过 LLM，抛原始 ParseError
6. API 超时（mock fetch 延迟 > timeout）→ 抛 ParseError

**失败影响**: LLM 不可用 → 退回正则失败行为。LLM API 超时（默认 30s）会导致 `parseAndWriteScore` 延迟至多 60s（2 次调用）——调用者应预期此延迟。

---

## GAP-B06: 能力短板聚类分析

### 问题

AI Coach 仅做 `score < 70` 阈值判定。交底书声称"应用聚类算法将其映射为模型特定能力维度的短板"。

### Party-Mode 关键决策

1. 对短文本做 TF-IDF + K-Means 效果差。采用两层分析：item_id 频率统计 + note 关键词提取聚合
2. `minFrequency` 默认值 = 2（至少出现 2 次才纳入聚类）
3. 零外部 ML 依赖（不引入 scikit-learn / ml-kmeans），使用正则分词 + 停用词过滤

### 实现方案

**新增文件 1**: `scoring/analytics/cluster-weaknesses.ts`

```typescript
export interface WeaknessCluster {
  cluster_id: string;
  primary_item_ids: string[];
  frequency: number;
  keywords: string[];
  severity_distribution: Record<string, number>;
  affected_stages: string[];
}

/**
 * 由调用者传入 records（从 scoring/data/ 加载的 RunScoreRecord 数组）。
 * CLI 脚本负责加载数据并传入。
 */
export function clusterWeaknesses(
  records: RunScoreRecord[],
  minFrequency?: number  // 默认 2
): WeaknessCluster[]
```

- 层 1：按 `item_id` 聚合 `passed=false` 的 check_items，统计频率
- 层 2：对 note 文本按空格/标点分词，过滤停用词（中英文），提取 top-5 关键词
- `severity_distribution` 从 `check_items.score_delta` 反向映射：`score_delta ≤ -10` → '高'，`-10 < score_delta ≤ -5` → '中'，`score_delta > -5` → '低'
- 按 `frequency` 降序排列输出

**修改文件 1**: `scoring/coach/diagnose.ts` 的 `coachDiagnose` 函数

- `buildWeakAreas` 函数保留，继续填充 `weak_areas: string[]`（向后兼容）
- 在 `buildWeakAreas` 调用后，额外调用 `clusterWeaknesses(records)` 填充 `report.weakness_clusters`

**修改文件 2**: `scoring/coach/types.ts`

- `CoachDiagnosisReport` 新增 `weakness_clusters?: WeaknessCluster[]` 字段（向后兼容）

**新增 CLI**: `scripts/analytics-cluster.ts`

```typescript
// 加载数据逻辑：
// 1. 读取 dataPath 下所有 *.json 文件，解析为 RunScoreRecord[]
// 2. 读取 scores.jsonl（如存在），逐行解析追加到 records 数组
// 3. 调用 clusterWeaknesses(records, minFrequency)
// 4. 默认 JSON.stringify 输出到 stdout；指定 --output <path> 时写入文件
```

- `npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2`

**新增测试**: `scoring/analytics/__tests__/cluster-weaknesses.test.ts`

测试用例（5 个）：

1. 多条记录有相同 item_id 失败 → 聚合为一个 cluster
2. 低频 item_id（频率 < minFrequency）→ 不纳入结果
3. 空记录 → 返回空数组
4. 关键词提取正确（从 note 中提取）
5. severity_distribution 统计正确

**失败影响**: 分析模块独立于评分流水线，失败不影响 scoring pipeline

---

## GAP-B07: SFT 微调数据集提取

### 问题

无 SFT 数据集提取逻辑。交底书声称"自动拼装生成 SFT 结构化数据集"。

### Party-Mode 关键决策

1. 需要 `source_path` 字段关联 BUGFIX 文档路径（从 score record 找到 BUGFIX 文档）→ 使用 `artifactDocPath` 参数名避免与 B02 的 `sourceHashFilePath` 混淆
2. git diff 操作抽象为独立函数，便于测试 mock
3. `base_commit_hash` 字段保持短 hash（8 位，向后兼容）。SFT 提取器在执行 git diff 时使用 `getGitHeadHashFull`（完整 40 位 hash），并在 diff 前通过 `git rev-parse --verify <short-hash>` 验证短 hash 唯一性

### 实现方案

**修改文件 1**: `scoring/writer/types.ts`

- `RunScoreRecord` 新增 `source_path?: string`，JSDoc：`触发本次评分的源文档路径（如 BUGFIX 文档路径），用于 SFT 提取时关联。由 artifactDocPath 参数传入`

**修改文件 2**: `scoring/schema/run-score-schema.json`

- `properties` 新增 `"source_path": { "type": "string", "description": "Path to source artifact that triggered this scoring" }`

**修改文件 3**: `scoring/orchestrator/parse-and-write.ts` 的 `parseAndWriteScore` 函数

- `ParseAndWriteScoreOptions` 新增 `artifactDocPath?: string`
- 写入 record 时附加 `source_path: options.artifactDocPath`

**引用依赖**: `scoring/utils/hash.ts` 的 `getGitHeadHashFull`（已存在，无需修改）

- SFT 提取器使用 `getGitHeadHashFull`（40 位完整 hash）执行 git diff，确保唯一性
- `base_commit_hash` 字段本身保持短 hash（向后兼容）
- 提取器在 git diff 前验证短 hash 唯一性：`git rev-parse --verify <short-hash>` 返回唯一 commit 才继续

**新增文件 1**: `scoring/analytics/sft-extractor.ts`

```typescript
export interface SftEntry {
  instruction: string;
  input: string;    // bad code
  output: string;   // good code
  source_run_id: string;
  base_commit_hash: string;
}

/**
 * 抽象 git diff 操作，便于测试 mock。
 * 异常处理：git 命令失败 → 抛 Error
 */
export function gitDiffBetween(
  hash1: string,
  hash2: string,
  cwd?: string
): string

/**
 * 提取 SFT 数据集。
 * 异常处理策略：
 * - source_path 指向的文件不存在 → 跳过该记录 + console.warn
 * - base_commit_hash 对应的 commit 不存在（已被 GC）→ 跳过该记录 + console.warn
 * - git diff 命令失败 → 跳过该记录 + console.warn
 * - 函数返回成功提取的 entries + 在 console.warn 中输出跳过的记录数
 */
export async function extractSftDataset(
  dataPath?: string,
  outputPath?: string  // 默认 scoring/data/sft-dataset.jsonl
): Promise<SftEntry[]>
```

- 读取 `scoring/data/*.json` 中 `phase_score ≤ 60` 的记录（C/D 级）
- 提取 `base_commit_hash` 和 `source_path`
- 验证短 hash 唯一性后，从 `source_path` 读取 BUGFIX 文档的 `## §1`(问题) + `## §4`(方案) 作为 `instruction`
- 调用 `gitDiffBetween(base_commit_hash, 'HEAD')` 获取代码变更
- 将 diff 中的 `-` 行作为 `input`，`+` 行作为 `output`
- 写入 JSONL 文件

**新增 CLI**: `scripts/analytics-sft-extract.ts`

- `npx ts-node scripts/analytics-sft-extract.ts --dataPath scoring/data --output scoring/data/sft-dataset.jsonl`

**新增测试**: `scoring/analytics/__tests__/sft-extractor.test.ts`

测试用例（7 个）：

1. C/D 级记录正确提取
2. A/B 级记录被过滤
3. BUGFIX 文档 §1/§4 正确解析为 instruction
4. git diff mock 返回正确的 bad/good code 拆分
5. 输出 JSONL 格式正确
6. source_path 不存在 → 跳过 + warn（不抛异常）
7. git 不可用（非 git 仓库环境）→ 跳过 + warn（不抛异常）

**失败影响**: 独立于评分流水线，失败不影响 scoring pipeline

---

## GAP-B08: Prompt 模板优化建议生成

### 问题

无代码生成 prompt 模板优化建议。交底书声称"生成针对系统 Prompt 模板的更新补丁"。

### 实现方案

**新增文件 1**: `scoring/analytics/prompt-optimizer.ts`

```typescript
export interface PromptSuggestion {
  target_file: string;    // Skill/Rule 文件路径
  section: string;        // 建议修改的章节
  suggestion: string;     // 具体修改建议
  evidence: string;       // 来源聚类数据
  priority: 'high' | 'medium' | 'low';
}

export function generatePromptSuggestions(
  clusters: WeaknessCluster[],
  skillsDir?: string  // 默认 skills/
): PromptSuggestion[]
```

- 匹配算法：遍历 `skills/` 和 `.cursor/rules/` 目录下的所有 `.md` 文件，读取文件内容，计算 `cluster.keywords` 与文件内容的关键词交集（忽略大小写）。交集大小 ≥ 2 则判定为匹配，该 Skill/Rule 文件列为 `target_file`
- priority 规则：cluster.frequency ≥ 5 → 'high'；≥ 3 → 'medium'；其他 → 'low'
- 输出 Markdown 文件：`scoring/data/prompt-optimization-suggestions.md`

**新增 CLI**: `scripts/analytics-prompt-optimize.ts`

**新增测试**: `scoring/analytics/__tests__/prompt-optimizer.test.ts`

测试用例（4 个）：

1. 高频 cluster（frequency ≥ 5）→ 生成 high priority 建议
2. 低频 cluster → 生成 low priority 建议
3. 空 cluster → 空建议列表
4. 输出 Markdown 格式正确

**失败影响**: 独立于评分流水线，失败不影响 scoring pipeline

---

## GAP-B09: 规则自优化反馈机制

### 问题

AI Coach 输出建议但不自动更新规则文件。交底书声称"基于审计数据自动优化管控规则"。

### Party-Mode 关键决策

1. 输出建议列表（YAML 格式），不直接修改规则文件（避免无人审核的规则变更）
2. 与 B08 分离——受众不同（B08 面向 Skill 开发者，B09 面向 scoring 管理员）

### 实现方案

**新增文件 1**: `scoring/analytics/rule-suggestion.ts`

```typescript
export interface RuleSuggestion {
  item_id: string;
  current_deduct: number;
  suggested_deduct: number;
  action: 'increase_deduct' | 'promote_to_veto' | 'add_new_item';
  reason: string;
  evidence_count: number;  // 失败次数
  evidence_total: number;  // 总审计次数
}

/**
 * 读取现有规则文件中 item 的 deduct 值：
 * 使用 `js-yaml` 库的 `yaml.load` 解析 YAML 文件，提取 items 数组中每个 item 的 deduct 值。
 */
export function generateRuleSuggestions(
  clusters: WeaknessCluster[],
  rulesDir?: string  // 默认 scoring/rules
): RuleSuggestion[]
```

- 统计高频失败 `item_id`
- 读取 `rulesDir` 下所有 `*-scoring.yaml` 文件，解析每个 item 的当前 `deduct` 值
- 如失败率 > 50% 且当前 deduct < 8 → 建议 `increase_deduct`（suggested_deduct = current_deduct + 2）
- 如失败率 > 80% → 建议 `promote_to_veto`
- 如聚类关键词不匹配任何现有 item_id → 建议 `add_new_item`
- 输出 YAML 文件：`scoring/data/rule-upgrade-suggestions.yaml`

**新增 CLI**: `scripts/analytics-rule-suggest.ts`

**新增测试**: `scoring/analytics/__tests__/rule-suggestion.test.ts`

测试用例（4 个）：

1. 高失败率 item → `increase_deduct` 建议
2. 极高失败率 → `promote_to_veto` 建议
3. 新模式（关键词不匹配现有 item_id）→ `add_new_item` 建议
4. 输出 YAML 格式正确

**失败影响**: 独立于评分流水线，失败不影响 scoring pipeline

---

## GAP-B10: eval_question 场景端到端验证

### 问题

schema/validation 支持 `eval_question`，但无真实端到端验证。

### 实现方案

**新增文件 1**: `scoring/parsers/__tests__/fixtures/sample-eval-question-report.md`

- 一个 eval_question 场景的审计报告样本

**新增文件 2**: `scoring/__tests__/e2e/eval-question-flow.test.ts`

- 端到端测试：parse → write → coach diagnose 全链路

测试用例（3 个）：

1. eval_question + question_version → 完整写入 + coach 诊断成功
2. eval_question + writeMode=jsonl → 正确追加到 scores.jsonl
3. eval_question 记录的 content_hash 和 base_commit_hash 正确

**修改文件 1**: `scripts/parse-and-write-score.ts` 的 `main` 函数

- 新增 `--questionVersion` 参数

**新增文件 3**: `scoring/data/eval-question-sample.json`

- 一个 eval_question 场景的示例评分记录

**失败影响**: 独立测试场景，失败不影响 scoring pipeline

---

## GAP-B11: 四维加权评分的程序化实现

### 问题

解析器使用 GRADE_TO_SCORE 等级映射（A→100/B→80/C→60/D→40），`code-reviewer-config.yaml` 的四维权重未被代码使用。

### Party-Mode 关键决策

1. 审计报告模板需要标准化维度评分格式：`- 维度名: 分数/100`
2. 解析器提取维度分数使用正则 `/[-*]\s*(.+?):\s*(\d+)\s*[\/／]\s*100/`
3. 维度解析结果为空时（旧格式报告）→ fallback 到 GRADE_TO_SCORE 映射
4. 维度加权分数范围 0-100，不影响 applyTierAndVeto 的逻辑

### 实现方案

**新增文件 1**: `scoring/parsers/dimension-parser.ts`

```typescript
export interface DimensionScore {
  dimension: string;
  weight: number;
  score: number;
}

/**
 * stage → mode 映射函数。
 * 映射规则：
 * - 'prd' | 'spec' | 'plan' | 'tasks' → 'prd' mode（使用 prd 模式的维度定义）
 * - 'arch' → 'arch' mode
 * - 'story' | 'implement' | 'post_impl' → 'code' mode
 * - 'pr_review' → 'pr' mode
 */
export function stageToMode(stage: string): 'code' | 'prd' | 'arch' | 'pr';

export function parseDimensionScores(
  content: string,
  mode: 'code' | 'prd' | 'arch' | 'pr',
  configPath?: string   // 默认 config/code-reviewer-config.yaml
): DimensionScore[]
```

- 从报告内容中用正则提取 `维度名: 数值/100` 格式
- 从 `code-reviewer-config.yaml` 读取对应 mode 的维度权重
- 按名称匹配维度，填充 weight
- 计算加权总分：`Σ(score × weight / 100)`

**修改文件 1**: `scoring/writer/types.ts`

- `RunScoreRecord` 新增 `dimension_scores?: DimensionScore[]`

**修改文件 2**: `scoring/schema/run-score-schema.json`

- 新增 `dimension_scores` 属性定义：`{ "type": "array", "items": { "type": "object", "properties": { "dimension": {"type":"string"}, "weight": {"type":"number"}, "score": {"type":"number"} } } }`

**修改文件 3**: `scoring/orchestrator/parse-and-write.ts` 的 `parseAndWriteScore` 函数

- 在解析 record 后，调用 `parseDimensionScores(content, stageToMode(stage))`
- 如结果非空且长度 > 0：用加权总分替代 `GRADE_TO_SCORE` 映射分数，附加 `dimension_scores` 到 record
- 如结果为空：保持现有 `GRADE_TO_SCORE` 逻辑（向后兼容）

**新增测试 fixture**: `sample-prd-report-with-dimensions.md`

**新增测试**: `scoring/parsers/__tests__/dimension-parser.test.ts`

测试用例（6 个）：

1. 报告包含维度分数 → 正确解析和加权计算
2. 报告无维度分数（旧格式）→ 返回空数组
3. 部分维度缺失 → 仅返回已解析的维度
4. 权重加载正确（从 config YAML 读取）
5. 加权总分计算正确（`Σ(score × weight / 100)` 范围 0-100）
6. config 文件不存在 → 返回空数组（fallback 到等级映射，不抛异常）

**失败影响**: 维度解析失败 → fallback 到等级映射（不影响评分流水线）

---

## GAP-B12: Bugfix 数据回写到主 Story

### 问题

无代码实现 BUGFIX 修复结论回写到主 Story 的 progress.txt。

### 实现方案

**新增文件 1**: `scoring/bugfix/writeback.ts`

```typescript
export interface WritebackResult {
  success: boolean;
  appendedLines: string[];
  progressPath: string;
}

/**
 * Markdown checkbox 解析支持以下格式变体：
 * - `- [x]`、`- [X]`、`* [x]`、`* [X]`、`+ [x]`、`+ [X]`
 * - 缩进变体：`  - [x]`（任意前导空格）
 * - 有序列表：`1. [x]`
 * 正则模式：/^\s*[-*+]?\s*\d*\.?\s*\[(x|X)\]\s+(.+)$/
 */
export function writebackBugfixToStory(
  bugfixDocPath: string,
  storyProgressPath: string,
  branchId: string,
  storyId: string
): WritebackResult
```

- 解析 BUGFIX.md 的 `## §7` 标题下的 checkbox 列表
- 提取已完成任务（`[x]` 或 `[X]` 标记）和修复结论
- 格式化为 progress.txt 追加行：`[{ISO timestamp}] BUGFIX({branchId}) → Story({storyId}): {修复摘要}`
- 如 `storyProgressPath` 不存在则创建（`mkdirSync` + `writeFileSync`）
- 如已存在则追加（`appendFileSync`）

**新增测试**: `scoring/bugfix/__tests__/writeback.test.ts`

测试用例（6 个）：

1. BUGFIX §7 正确解析已完成任务（`- [x]` 格式）
2. progress.txt 不存在 → 创建并写入
3. progress.txt 已存在 → 追加写入
4. BUGFIX 文档格式异常（无 §7 标题）→ 抛 ParseError
5. 回写行格式正确（时间戳 + branchId + storyId + 摘要）
6. Markdown checkbox 变体支持（`- [X]`、`* [x]`、缩进 `  - [x]`、有序 `1. [x]`）

**失败影响**: progress.txt 写入失败 → 抛异常，不影响 scoring pipeline

---

## GAP-B13: Git 回退建议（D 级熔断后）

### 问题

`implement-scoring.yaml` 的 `stage_0_level_down` 仅为字符串标记，无代码执行或建议 git 操作。

### Party-Mode 关键决策

1. 不自动执行 `git reset --hard`（风险过高）
2. 输出回退建议 + 命令列表，由开发者确认后执行
3. `message` 字段固定包含告警前缀：`⚠️ 以下回退命令仅供参考，请确认后手动执行：`

### 实现方案

**新增文件 1**: `scoring/gate/rollback.ts`

```typescript
export interface RollbackSuggestion {
  action: 'suggest_rollback';
  stage: string;
  lastStableCommit: string | undefined;
  message: string;
  commands: string[];
}

export function suggestRollback(
  stage: string,
  lastStableCommit?: string
): RollbackSuggestion
```

- 如 `lastStableCommit` 存在：`commands = ['git stash', 'git reset --hard <commit>']`
- 如不存在：`commands = ['git stash']`，message 中提示"无已知稳定提交，请手动确认回退目标"
- `message` 格式：`⚠️ 以下回退命令仅供参考，请确认后手动执行：\n{commands.join('\n')}`

**新增测试**: `scoring/gate/__tests__/rollback.test.ts`

测试用例（4 个）：

1. 有 lastStableCommit → 生成 git reset 命令
2. 无 lastStableCommit → 仅生成 git stash
3. message 包含告警前缀 `⚠️`
4. action 固定为 'suggest_rollback'

**失败影响**: 纯建议输出，无副作用，失败不影响任何流程

---

## 执行优先级与依赖关系

### 依赖拓扑

```
B01 ✅ → B02 (source_hash)
         B07 (source_path, base_commit_hash)
B03 (独立) ← B05 需要在 B03 的 audit-generic.ts 中预留 LLM fallback 接入点
B04 (独立)
B05 依赖 B03（B05 修改 audit-generic.ts 的 parseGenericReport 中插入 LLM fallback）
B06 (独立，可处理现有 prd/arch/story 的 check_items 数据；B03 补充的 spec/plan/tasks 记录扩大数据源)
B07 不直接调用 B06 的输出，可独立实现（B07 从 scores.jsonl 直接读取 C/D 级记录）
B08 依赖 B06（聚类结果作为输入）
B09 依赖 B06（聚类结果作为输入）
B10 (独立)
B11 (独立)
B12 (独立)
B13 (独立)
```

### 建议执行批次

| 批次 | GAP | 说明 | 预计工期 |
|------|-----|------|---------|
| 批次 1（基础 + 独立） | B02, B04, B10, B12, B13 | 无依赖，可并行 | 14-28h |
| 批次 2（评分扩展） | B03, B11 | B03 先行（B05 依赖 audit-generic.ts） | 20-36h |
| 批次 3（解析增强） | B05 | 依赖 B03 的 audit-generic.ts | 16-24h |
| 批次 4（分析核心） | B06 | 独立，但 B08/B09 依赖它 | 8-12h |
| 批次 5（分析扩展） | B07, B08, B09 | B08/B09 依赖 B06；B07 独立但放最后 | 20-36h |

> **B05 与 B03 的实施顺序**：B03 先实施（创建 `audit-generic.ts` 并迁移 `extractOverallGrade`），B05 再实施（在 `audit-generic.ts` 和现有解析器中插入 LLM fallback）。在同一批次内实施时，B03 的 `audit-generic.ts` 需先 merge。

**总计新增测试用例**: 68 个（B02:7 + B03:9 + B04:7 + B05:6 + B06:5 + B07:7 + B08:4 + B09:4 + B10:3 + B11:6 + B12:6 + B13:4）  
**总计新增文件**: 33 个（实现 11 + 测试 12 + fixture 6 + CLI 4）  
**总计修改文件**: 约 15 个

---

## Challenger Final Review

**Status**: conditional

**前提条件**（已在讨论中达成共识并反映在方案中）:

1. `content_hash` 字段的 JSDoc 注释在 B02 实施中优先更新
2. B02 的 `sourceHashFilePath` 与 B07 的 `artifactDocPath` 命名已区分
3. B05 的 LLM fallback 包含 API 超时配置（`SCORING_LLM_TIMEOUT_MS`，默认 30000）和数据安全警告
4. B06 的 `minFrequency` 默认值为 2
5. B03 的 `extractOverallGrade` 从 `audit-prd.ts` 迁移到 `audit-generic.ts` 并 export
6. B11 的 `stageToMode` 映射函数定义在 `dimension-parser.ts` 中
7. B07 的 SFT 提取器在 git diff 前验证短 hash 唯一性

**Deferred Gaps**: 无
