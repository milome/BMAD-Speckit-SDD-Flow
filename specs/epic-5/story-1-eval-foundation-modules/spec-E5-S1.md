# Spec E5-S1：eval-foundation-modules

*Story 5.1 技术规格*
*Epic E5 feature-eval-scoring-enhancement*

---

## 1. 概述

本 spec 将 Story 5.1（eval-foundation-modules）的需求转化为可执行的技术规格，涵盖：B02 版本锁定校验、B04 触发加载器、B10 eval_question E2E、B12 Bugfix 回写、B13 Git 回退建议。

---

## 2. 功能范围

### 2.1 B02 版本锁定校验

| 需求要点 | 技术规格 |
|----------|----------|
| specify→plan 流转时比对 `source_hash` | `checkPreconditionHash(currentStage, preconditionFile, expectedHash)`：hash 匹配→proceed；不匹配→block；异常→warn_and_proceed |
| 上一阶段无记录时返回 warn_and_proceed | `loadLatestRecordByStage(stage, dataPath?)`：扫描 scoring/data/*.json（排除 scores.jsonl），按 timestamp 降序取最新 |
| source_hash 来源 | `ParseAndWriteScoreOptions.sourceHashFilePath` 非空时，计算该文件 hash 写入 record.source_hash |

**接口**：

```ts
interface VersionLockResult {
  passed: boolean;
  action: 'proceed' | 'warn_and_proceed' | 'block';
  actual_hash: string;
  expected_hash: string;
  preconditionFile: string;
  reason: string;
}
function checkPreconditionHash(currentStage: string, preconditionFile: string, expectedHash: string): VersionLockResult;
function loadLatestRecordByStage(stage: string, dataPath?: string): RunScoreRecord | null;
```

**验收**：hash 匹配→proceed；hash 不匹配→block；上一阶段无记录→warn_and_proceed；内部异常→warn_and_proceed。

---

### 2.2 B04 触发加载器

| 需求要点 | 技术规格 |
|----------|----------|
| scoring-trigger-modes.yaml 程序化加载 | `loadTriggerConfig(configPath?)`：读取 YAML，首次后缓存；`resetTriggerConfigCache()` 供测试 |
| 判断是否写入评分 | `shouldWriteScore(event, stage, scenario, configPath?)`：enabled=true 且 call_mapping 有 event+stage 匹配→write=true；否则 write=false |
| parse-and-write 前置检查 | 新增 `--event`、`--skipTriggerCheck` CLI 参数；调用 parseAndWriteScore 前调用 shouldWriteScore |

**接口**：

```ts
interface TriggerDecision { write: boolean; writeMode: WriteMode; reason: string; }
function loadTriggerConfig(configPath?: string): TriggerConfig;
function resetTriggerConfigCache(): void;
function shouldWriteScore(event: string, stage: string, scenario: 'real_dev'|'eval_question', configPath?: string): TriggerDecision;
```

**验收**：enabled=true + 注册 stage→write=true；enabled=false 或未注册 stage→write=false；config 不存在→抛异常。

---

### 2.3 B10 eval_question E2E

| 需求要点 | 技术规格 |
|----------|----------|
| parse→write→coach diagnose 全链路 | fixture + E2E 测试：用 sample-eval-question-report.md 执行 parseAndWriteScore + coachDiagnose |
| content_hash、base_commit_hash 正确 | E2E 断言 record 含 content_hash、base_commit_hash |
| question_version 参数 | scripts/parse-and-write-score.ts 新增 `--questionVersion` |

**接口**：无新模块接口，使用现有 `parseAndWriteScore`、`coachDiagnose`。

**验收**：eval-question-flow.test.ts 3 个 E2E 测试通过；记录正确写入；coach 诊断成功。

---

### 2.4 B12 Bugfix 回写

| 需求要点 | 技术规格 |
|----------|----------|
| BUGFIX §7 已完成任务回写 progress.txt | `writebackBugfixToStory(bugfixDocPath, storyProgressPath, branchId, storyId)` |
| checkbox 变体支持 | 正则 `/^\s*[-*+]?\s*\d*\.?\s*\[(x|X)\]\s+(.+)$/` 解析 |
| progress.txt 不存在则创建 | mkdirSync + writeFileSync；存在则 appendFileSync |

**接口**：

```ts
interface WritebackResult { success: boolean; appendedLines: string[]; progressPath: string; }
function writebackBugfixToStory(bugfixDocPath: string, storyProgressPath: string, branchId: string, storyId: string): WritebackResult;
```

**验收**：§7 正确解析；progress 不存在→创建；存在→追加；无 §7→抛 ParseError；checkbox 变体支持。

---

### 2.5 B13 Git 回退建议

| 需求要点 | 技术规格 |
|----------|----------|
| D 级熔断后输出回退建议 | `suggestRollback(stage, lastStableCommit?)`：不自动执行 git，仅返回建议 |
| message 含告警前缀 | `⚠️ 以下回退命令仅供参考，请确认后手动执行：` |
| commands | lastStableCommit 存在：`['git stash','git reset --hard <commit>']`；不存在：`['git stash']` |

**接口**：

```ts
interface RollbackSuggestion { action: 'suggest_rollback'; stage: string; lastStableCommit?: string; message: string; commands: string[]; }
function suggestRollback(stage: string, lastStableCommit?: string): RollbackSuggestion;
```

**验收**：有 lastStableCommit→含 git reset；无→仅 git stash；message 含 ⚠️；不执行任何 git 命令。

---

## 3. 接口与依赖

### 3.1 从现有模块接收

- `computeContentHash`、`computeStringHash`、`getGitHeadHash`：`scoring/utils/hash.ts`
- `parseAndWriteScore`、`ParseAndWriteScoreOptions`：`scoring/orchestrator/parse-and-write.ts`
- `coachDiagnose`：`scoring/coach/diagnose.ts`
- `RunScoreRecord`、`WriteMode`：`scoring/writer/types.ts`
- `scoring-trigger-modes.yaml`：`config/scoring-trigger-modes.yaml`

### 3.2 新增导出

- `scoring/gate/version-lock.ts`：`checkPreconditionHash`、`loadLatestRecordByStage`
- `scoring/gate/rollback.ts`：`suggestRollback`
- `scoring/trigger/trigger-loader.ts`：`loadTriggerConfig`、`shouldWriteScore`、`resetTriggerConfigCache`
- `scoring/bugfix/writeback.ts`：`writebackBugfixToStory`

---

## 4. 需求映射清单（spec ↔ Story 5.1）

| Story AC | spec 对应 |
|----------|-----------|
| AC-B02-1 | §2.1 接口与验收 |
| AC-B02-2 | §2.1 loadLatestRecordByStage 无匹配 |
| AC-B04-1 | §2.2 enabled + 注册 stage |
| AC-B04-2 | §2.2 enabled=false 或未注册 |
| AC-B10-1 | §2.3 全链路 E2E |
| AC-B10-2 | §2.3 content_hash、base_commit_hash |
| AC-B12-1 | §2.4 writebackBugfixToStory |
| AC-B12-2 | §2.4 checkbox 变体 |
| AC-B13-1 | §2.5 suggestRollback |
| AC-B13-2 | §2.5 不自动执行 git |

---

## 5. 本 Story 不包含

- B03 评分规则 YAML（Story 5.2）
- B05 LLM fallback（Story 5.3）
- B06 能力短板聚类（Story 5.4）
- B07/B08/B09（Story 5.5）

---

## 6. Dev Notes

| 要点 | 规格 |
|------|------|
| 实现路径 | scoring/gate/、scoring/trigger/、scoring/bugfix/ |
| 测试标准 | B02:7、B04:7、B10:3、B12:6、B13:4 共 27 个用例 |
| 禁止词表 | 禁止：可选、可考虑、后续、待定、酌情、技术债 |

<!-- AUDIT: PASSED by code-reviewer -->
