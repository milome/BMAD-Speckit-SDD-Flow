# 🎉 PARTY MODE ACTIVATED 🎉

议题: 深入分析并细化 TASKS_gaps功能补充实现.md 中 GAP-B02 至 GAP-B13 全部 12 项任务，产出最终且最优的实现方案（禁止降级）
模式: 生成最终方案和最终任务列表（≥100 轮）
参与角色: ⚔️ 批判性审计员、🤖 AI 代码教练、🏗️ Winston 架构师、👩‍💻 Amelia 开发

------

【第 1 轮】 🏗️ Winston 架构师: 先建立讨论框架。12 个 GAP 按依赖关系分为 4 层：基础层（B02 版本锁定、B04 触发加载器）→ 评分扩展层（B03 评分规则、B11 四维加权）→ 分析层（B05 LLM fallback、B06 聚类、B07 SFT、B08 prompt 优化、B09 规则建议）→ 业务闭环层（B10 eval_question、B12 Bugfix 回写、B13 回退建议）。建议按层序逐个细化。

【第 2 轮】 ⚔️ 批判性审计员: 我反对将 B05 归入分析层。B05（LLM fallback 解析）是解析器的核心增强，应属于评分扩展层，因为 B03（新增阶段评分规则）和 B11（维度加权）都依赖解析器能正确提取数据。如果解析器在非标格式报告上失败，B03 和 B11 的评分结果就不可靠。

【第 3 轮】 🤖 AI 代码教练: 同意审计员的依赖分析。但我补充一个更根本的问题：当前所有解析器（`audit-prd.ts`, `audit-arch.ts`, `audit-story.ts`）的 `extractOverallGrade` 函数使用 `content.match(/总体评级:\s*([ABCD])/)` 这个硬编码正则。如果 code-reviewer 的审计报告格式稍有变化（比如用"Overall Grade"或"综合评级"），解析直接失败。B05 的 LLM fallback 解决的正是这种脆弱性。

【第 4 轮】 ⚔️ 批判性审计员: 那 B05 就不应该是"NLP 解析"了——准确地说是"结构化提取容错层"。交底书中"NLP 解析树"这个说法本身就不准确。我们需要明确：B05 的目标不是实现真正的 NLP 语法解析树，而是用 LLM 做 structured extraction fallback。任务描述必须反映这一点，否则实现方向就会偏。

【第 5 轮】 👩‍💻 Amelia 开发: 具体到代码层面，B05 的 LLM fallback 需要一个外部 API（OpenAI/Anthropic/本地模型）。这引入了网络依赖——离线环境下怎么办？正则解析在离线环境完全可用，但 LLM fallback 不行。

【第 6 轮】 🤖 AI 代码教练: 这要求 B05 的实现必须是严格的 fallback 链：正则解析 → LLM 提取 → 抛异常。当 LLM API 不可用时，退回到"正则失败即报错"的当前行为，而不是默默吞错。API 配置通过环境变量（`SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`）控制，未配置时跳过 LLM 层。

【第 7 轮】 ⚔️ 批判性审计员: 我质疑 B05 的优先级。12 个 GAP 全部实现，B05 的 LLM fallback 是投入最大但日常使用频率最低的——因为审计报告格式由 `audit-prompts.md` 模板固定，正则失败本身就是小概率事件。是否应该把 B05 放到最后实现？

【第 8 轮】 🏗️ Winston 架构师: 审计员说得对，但用户要求"非降级"——所有 GAP 必须给出最优实现方案。优先级排序影响的是执行顺序，不影响方案本身。方案必须完整，执行可以按优先级排。我建议调整讨论层级为：基础层（B02, B04）→ 核心评分层（B03, B11, B05）→ 分析层（B06, B07, B08, B09）→ 业务闭环层（B10, B12, B13）。

【第 9 轮】 🤖 AI 代码教练: 在进入各 GAP 细节前，我要确立一个全局约束：每个 GAP 的实现方案必须包含 (1) 函数签名（入参、出参、异常）、(2) 修改文件清单（精确到行号范围）、(3) 测试用例列表（每个至少 4 个用例：正常、边界、异常、集成）、(4) 与现有模块的集成点（谁调用、在哪调用）。

【第 10 轮】 ⚔️ 批判性审计员: 同意。我追加第 5 个要素：(5) 失败影响评估——如果该模块实现有 bug 或不可用，对整个 scoring pipeline 的影响是什么？是阻断还是降级？这决定了我们需要设计怎样的错误隔离。

------

### GAP-B02: 版本锁定机制

【第 11 轮】 👩‍💻 Amelia 开发: GAP-B02 的核心是 `checkPreconditionHash()`。函数签名：

export interface VersionLockResult {

  passed: boolean;

  action: 'proceed' | 'warn_and_proceed' | 'block';

  actual_hash: string;

  expected_hash: string;

  preconditionFile: string;

  reason: string;

}



export function checkPreconditionHash(

  currentStage: string,

  preconditionFile: string,

  expectedHash: string

): VersionLockResult

用 `computeContentHash()` 计算文件当前 hash，与 `expectedHash` 比对。

【第 12 轮】 ⚔️ 批判性审计员: 问题：`expectedHash` 从哪来？任务描述说"上一阶段审计记录中的 `content_hash`"，但 GAP-B01 的 `content_hash` 是审计报告内容的 hash，不是被审计文件的 hash。`parseAndWriteScore` 中的 `computeStringHash(content)` 的 `content` 是审计报告文本，不是 spec.md 或 plan.md 本身。这是一个根本性的语义错误。

【第 13 轮】 🤖 AI 代码教练: 审计员发现了关键 gap。GAP-B01 写入的 `content_hash` = SHA-256(审计报告内容)。但 B02 版本锁定需要的是 SHA-256(spec.md 内容) 或 SHA-256(plan.md 内容)——即被审计的源文档的 hash。这是两个完全不同的东西。

【第 14 轮】 🏗️ Winston 架构师: 解决方案：在 `RunScoreRecord` 中增加第三个 hash 字段 `source_hash`，记录被审计的源文档的 content hash。或者更好的方案：在 `ParseAndWriteScoreOptions` 中增加 `sourceFilePath` 参数，`parseAndWriteScore` 自动计算源文件的 hash 并写入 `source_hash` 字段。

【第 15 轮】 ⚔️ 批判性审计员: 我反对在 `RunScoreRecord` 中继续堆字段。已经有 `base_commit_hash` 和 `content_hash`，再加 `source_hash`，字段语义容易混淆。建议重命名：`content_hash` → `report_hash`（审计报告的 hash），新增 `source_hash`（被审计文件的 hash）。这样三个 hash 字段语义完全清晰：`base_commit_hash`（git 基线）、`report_hash`（审计报告指纹）、`source_hash`（源文档指纹）。

【第 16 轮】 🤖 AI 代码教练: 审计员的命名改进是正确的。但重命名 `content_hash` → `report_hash` 会破坏向后兼容——GAP-B01 刚实现，已经有 129 个测试通过的 `content_hash` 字段。建议：保留 `content_hash` 作为已有字段（语义是"传给 parseAndWriteScore 的 content 参数的 hash"），新增 `source_hash`。在文档中明确记录三个字段的语义区别。

【第 17 轮】 ⚔️ 批判性审计员: 我接受保留 `content_hash` 的理由（向后兼容），但要求在 `types.ts` 的 JSDoc 注释中明确标注 `content_hash` 的语义是"审计报告内容的 SHA-256"，避免后续开发者误解为"源文档的 hash"。新增 `source_hash` 的注释必须说明"被审计的源文件的 SHA-256，用于跨阶段版本锁定校验"。

【第 18 轮】 👩‍💻 Amelia 开发: 确认实现方案：

1. `types.ts` 新增 `source_hash?: string`
2. `run-score-schema.json` 新增 `source_hash` 属性
3. `ParseAndWriteScoreOptions` 新增 `sourceFilePath?: string`
4. `parseAndWriteScore()` 中：如 `sourceFilePath` 不为空，调用 `computeContentHash(sourceFilePath)` 写入 `source_hash`
5. `checkPreconditionHash()` 读取上一阶段 record 的 `source_hash` 与当前文件 hash 比对

【第 19 轮】 🤖 AI 代码教练: B02 的 `checkPreconditionHash` 需要读取上一阶段的 scoring record。这要求一个新函数：`loadLatestRecordByStage(stage: string, runIdPrefix?: string, dataPath?: string): RunScoreRecord | null`——从 `scoring/data/` 目录中查找指定 stage 的最新记录。

【第 20 轮】 ⚔️ 批判性审计员: `loadLatestRecordByStage` 的"最新"是按什么排序？timestamp？文件修改时间？如果同一 stage 有多条记录（迭代审计），应该取 `iteration_count` 最大的那条？还是 `first_pass=true` 的？必须明确。

【第 21 轮】 🏗️ Winston 架构师: 按 `timestamp` 降序取第一条。理由：迭代审计中，最终通过的那条记录的 `source_hash` 才是锁定的版本。如果 `first_pass=false` 说明经过了修改和重审，最终通过的记录自然是时间最新的。

【第 22 轮】 ⚔️ 批判性审计员: 但如果时间戳精度不够（同秒内写入多条），或者系统时钟有问题呢？建议用文件名排序（`{run_id}.json` 按字母序）作为兜底，因为 run_id 通常包含时间戳。

【第 23 轮】 🤖 AI 代码教练: 实际上 `loadRunRecords` 在 `scoring/coach/loader.ts` 中已经实现了——它通过 `run_id` 前缀过滤。B02 需要的是按 stage 过滤而非 run_id。建议新增 `loadLatestRecordByStage` 在 `scoring/gate/` 目录下，与 version-lock 模块内聚。按 `timestamp` 降序排列。

【第 24 轮】 👩‍💻 Amelia 开发: 最终 B02 文件清单：

- 新增 `scoring/gate/version-lock.ts`：`checkPreconditionHash()` + `loadLatestRecordByStage()`
- 修改 `scoring/writer/types.ts`：新增 `source_hash?: string`
- 修改 `scoring/schema/run-score-schema.json`：新增 `source_hash`
- 修改 `scoring/orchestrator/parse-and-write.ts`：新增 `sourceFilePath` 参数
- 修改 `scripts/parse-and-write-score.ts`：新增 `--sourceFilePath` CLI 参数
- 新增 `scoring/gate/__tests__/version-lock.test.ts`

【第 25 轮】 ⚔️ 批判性审计员: B02 的失败影响评估？如果 `checkPreconditionHash` 本身有 bug（总是返回 passed=false），会阻断所有流转。建议：该函数异常时 action 为 `warn_and_proceed`，不阻断流程，但在返回值中写入 error reason。即"校验失败是阻断，校验异常是告警"。

【第 26 轮】 🤖 AI 代码教练: 测试用例确认：(1) hash 匹配→proceed (2) hash 不匹配→block (3) 源文件不存在→block+具体 error (4) 上一阶段无记录→warn_and_proceed（首次运行场景） (5) 多条同 stage 记录取最新 (6) 函数内部异常→warn_and_proceed。6 个用例。

------

### GAP-B04: scoring-trigger-modes.yaml 程序化加载器

【第 27 轮】 🏗️ Winston 架构师: B04 的核心：将 `scoring-trigger-modes.yaml` 的配置转化为程序化判断。函数签名：

export interface TriggerDecision {

  write: boolean;

  writeMode: WriteMode;

  reason: string;

}



export function shouldWriteScore(

  event: string,

  stage: string,

  scenario: 'real_dev' | 'eval_question'

): TriggerDecision

【第 28 轮】 ⚔️ 批判性审计员: 我质疑 `shouldWriteScore` 的集成点。任务描述说"在 `parseAndWriteScore` 入口处调用"。但 `parseAndWriteScore` 的职责是"解析并写入"——在它内部判断"是否应该写入"违反了单一职责原则。调用者应该在调 `parseAndWriteScore` 之前先调 `shouldWriteScore`，而不是让 `parseAndWriteScore` 内部判断。

【第 29 轮】 🤖 AI 代码教练: 审计员说得对。如果把 `shouldWriteScore` 嵌入 `parseAndWriteScore`，那所有现有测试中直接调用 `parseAndWriteScore` 的场景都会被 trigger config 过滤掉——因为测试环境可能没有正确的 config 文件。这会导致大量测试回归。

【第 30 轮】 👩‍💻 Amelia 开发: 修正方案：`shouldWriteScore` 作为独立导出函数，不嵌入 `parseAndWriteScore`。调用链：CLI/Skill → `shouldWriteScore()` → 如返回 write=true → `parseAndWriteScore()`。CLI 脚本（`parse-and-write-score.ts`）中加入 `--skipTriggerCheck` 参数用于测试场景。

【第 31 轮】 ⚔️ 批判性审计员: `shouldWriteScore` 读取 YAML 文件。每次调用都读文件系统吗？如果在一个审计会话中多次调用，会有性能问题。建议加缓存：首次读取后缓存到内存，提供 `clearTriggerCache()` 函数用于测试。

【第 32 轮】 🤖 AI 代码教练: 性能在当前场景不是问题——`parseAndWriteScore` 每次审计最多调一次。但缓存有另一个好处：测试时可以注入 mock config 而不依赖文件系统。建议用 `loadTriggerConfig(configPath?: string)` + module-level cache 变量 + `resetTriggerConfigCache()` export。

【第 33 轮】 🏗️ Winston 架构师: B04 完整签名：

export function loadTriggerConfig(configPath?: string): TriggerConfig;

export function resetTriggerConfigCache(): void;

export function shouldWriteScore(

  event: string,

  stage: string,

  scenario: 'real_dev' | 'eval_question',

  configPath?: string

): TriggerDecision;

【第 34 轮】 ⚔️ 批判性审计员: `event` 参数的合法值是什么？`scoring-trigger-modes.yaml` 的 `call_mapping` 中的 key 是 `speckit_1_2_audit_pass` 等，而 `event` 字段是 `stage_audit_complete`。这两个是什么关系？调用者传入的是 key 还是 event？

【第 35 轮】 🤖 AI 代码教练: 从 YAML 结构看，调用者应传入 `event`（如 `stage_audit_complete`）和 `stage`（如 `speckit_1_2`）。`shouldWriteScore` 在 `call_mapping` 中查找 `event` 和 `stage` 同时匹配的条目。如果找到，从 `event_to_write_mode` 中解析 `writeMode`。如果 `scoring_write_control.enabled=false`，直接返回 `write: false`。

【第 36 轮】 👩‍💻 Amelia 开发: 文件清单：

- 新增 `scoring/trigger/trigger-loader.ts`：`loadTriggerConfig`, `resetTriggerConfigCache`, `shouldWriteScore`
- 新增 `scoring/trigger/__tests__/trigger-loader.test.ts`
- 修改 `scripts/parse-and-write-score.ts`：增加 `--event` 参数 + trigger 检查

【第 37 轮】 ⚔️ 批判性审计员: 测试用例：(1) enabled=true + 匹配 stage → write=true (2) enabled=false → write=false (3) stage 未注册 → write=false (4) scenario 切换 writeMode (5) config 文件不存在 → 抛异常 (6) 缓存验证（二次调用不重读文件） (7) resetCache 后重新读文件。7 个用例。

------

### GAP-B03: spec/plan/tasks 阶段评分规则

【第 38 轮】 🏗️ Winston 架构师: B03 是工作量最大的 GAP。需要：(1) 填充 3 个 YAML 规则文件 (2) 扩展 `AuditStage` 类型 (3) 新增/扩展解析器。参照 `implement-scoring.yaml` 格式，每个 YAML 需要 `weights`、`items`（含 `ref`、`deduct`）、`veto_items`。

【第 39 轮】 ⚔️ 批判性审计员: 等一下。`implement-scoring.yaml` 中的 `items` 的 `ref` 指向 `code-reviewer-config#functional_correctness` 等。但 spec/plan/tasks 的检查项与 code review 的检查项完全不同。`code-reviewer-config.yaml` 的 `items` 和 `veto_items` 中没有 spec/plan/tasks 对应的条目。那 spec-scoring.yaml 的 items 应该 ref 指向哪里？

【第 40 轮】 🤖 AI 代码教练: 需要在 `code-reviewer-config.yaml` 的 `items` 和 `veto_items` 中扩展新条目，对应 spec/plan/tasks 三个阶段的检查维度。或者更好的方案：每个阶段的检查项定义在各自的 scoring YAML 中，不依赖 `code-reviewer-config.yaml` 的 `items`——因为 spec 审计和 code review 是不同的审计模式。

【第 41 轮】 ⚔️ 批判性审计员: 如果 spec-scoring.yaml 的 items 不用 `ref` 引用 `code-reviewer-config`，那 `ref-resolution.test.ts` 中的 ref 解析逻辑就不适用于这些新规则文件。需要确认解析器是否兼容两种模式（有 ref 和无 ref）。

【第 42 轮】 👩‍💻 Amelia 开发: 查看 `scoring/__tests__/rules/ref-resolution.test.ts`——ref 解析是通过 `resolveRef()` 实现的，当 item 没有 `ref` 字段时直接使用 item 自身的 `name`/`description`。所以无 ref 模式已经兼容。建议 spec/plan/tasks 的 items 自包含定义（直接写 name 和 description），不用 ref。

【第 43 轮】 🤖 AI 代码教练: `spec-scoring.yaml` 的具体内容——参照 `code-reviewer-config.yaml` 中 `prd` mode 的 dimensions：

version: "1.0"

stage: spec

link_stage: [specify]

link_环节: 1



weights:

  base:

​    demand_coverage: 35

​    clarity: 25

​    verifiability: 25

​    consistency: 15



items:

  \- id: spec_demand_coverage

​    name: "需求映射完整性"

​    description: "原始需求全部映射到 spec"

​    deduct: 10

  \- id: spec_ambiguity_free

​    name: "描述无歧义"

​    description: "无模糊、待定表述"

​    deduct: 5

  \- id: spec_testable

​    name: "验收标准可验证"

​    description: "每条需求有可执行的验收标准"

​    deduct: 8

  \- id: spec_terminology

​    name: "术语一致"

​    description: "术语定义统一无矛盾"

​    deduct: 3



veto_items:

  \- id: veto_core_unmapped

​    ref: code-reviewer-config#veto_core_unmapped

​    consequence: gaps_pre_0_veto

【第 44 轮】 ⚔️ 批判性审计员: `spec_demand_coverage` 的 `deduct: 10` 扣分太重还是太轻？`implement-scoring.yaml` 中 `func_correct` 也是 `deduct: 10`——但需求映射缺失比功能缺陷在严重性上不一定对等。建议 spec 阶段的扣分采用更细的梯度：致命（全缺失）= 一票否决，部分缺失 = deduct 8，minor 遗漏 = deduct 3。

【第 45 轮】 🤖 AI 代码教练: 审计员的质疑合理。但 `deduct` 是每个检查项的固定扣分值，不是梯度。致命情况由 `veto_items` 处理（`veto_core_unmapped`）。`deduct` 反映的是"该项不通过时扣多少分"。10 分扣分对于 100 分制来说是合理的——一个不通过就扣 10%，两个就扣 20%。保持 `deduct: 10` 用于高权重项，`deduct: 3-5` 用于低权重项。

【第 46 轮】 👩‍💻 Amelia 开发: `plan-scoring.yaml` 内容：

version: "1.0"

stage: plan

link_stage: [plan]

link_环节: 1



weights:

  base:

​    module_coverage: 30

​    dependency_analysis: 25

​    gaps_actionability: 25

​    test_strategy: 20



items:

  \- id: plan_module_coverage

​    name: "模块覆盖度"

​    description: "plan 覆盖 spec 中所有模块"

​    deduct: 10

  \- id: plan_dependency_clear

​    name: "依赖分析清晰"

​    description: "模块间依赖关系明确"

​    deduct: 5

  \- id: plan_gaps_actionable

​    name: "GAPS 可操作"

​    description: "每个 GAP 有明确的技术方案"

​    deduct: 8

  \- id: plan_test_integrated

​    name: "测试策略含集成测试"

​    description: "测试计划不仅有单元测试"

​    deduct: 5



veto_items:

  \- id: veto_plan_no_test_strategy

​    name: "完全无测试策略"

​    consequence: stage_0_level_down

【第 47 轮】 ⚔️ 批判性审计员: `tasks-scoring.yaml` 的 veto_items 应该包含"核心任务无验收标准"。任务列表如果没有验收标准，实施时根本无法判断是否完成。

【第 48 轮】 🤖 AI 代码教练: `tasks-scoring.yaml` 内容：

version: "1.0"

stage: tasks

link_stage: [tasks]

link_环节: 1



weights:

  base:

​    executability: 30

​    gaps_mapping: 25

​    acceptance_criteria: 25

​    granularity: 20



items:

  \- id: tasks_executable

​    name: "任务可执行"

​    description: "每个任务有明确的输入输出"

​    deduct: 8

  \- id: tasks_gaps_mapped

​    name: "GAPS 完全映射"

​    description: "所有 GAP 有对应任务"

​    deduct: 10

  \- id: tasks_acceptance_defined

​    name: "验收标准明确"

​    description: "每个任务有可执行的验收命令"

​    deduct: 8

  \- id: tasks_granularity_ok

​    name: "粒度合理"

​    description: "任务粒度 2-8 小时"

​    deduct: 3



veto_items:

  \- id: veto_tasks_no_acceptance

​    name: "核心任务无验收标准"

​    consequence: stage_0_level_down

【第 49 轮】 ⚔️ 批判性审计员: 3 个 YAML 都定义好了，但解析器呢？当前 `AuditStage` 类型在 `scoring/parsers/index.ts` 中只支持 `'prd' | 'arch' | 'story'`。需要扩展为 `'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks'`。而且每个新 stage 需要对应的解析函数。

【第 50 轮】 🤖 AI 代码教练: 分析现有解析器代码结构：`audit-prd.ts`/`audit-arch.ts`/`audit-story.ts` 逻辑高度相似——都是提取 `总体评级: A/B/C/D` + 问题清单。差异仅在 `PHASE_WEIGHT` 和 `stage` 字符串。建议：不新建 3 个解析器文件，而是将 `parsePrdReport` 泛化为一个 通用解析函数，由 stage 参数决定 phase_weight 和 stage 标签。

【第 51 轮】 ⚔️ 批判性审计员: 泛化解析器是合理的，但 `PHASE_WEIGHTS` 数组 index 需要对应新 stage。当前 `scoring/constants/weights.ts` 只有 6 个环节的权重。spec/plan/tasks 属于环节 1（BMAD Story Stage 3），它们的 phase_weight 应该怎么分配？

【第 52 轮】 🏗️ Winston 架构师: spec/plan/tasks 都属于 Speckit SDD 子流程，对应 BMAD 的环节 1（Story 定义到任务分解）。建议给三者分配相同的 phase_weight = `PHASE_WEIGHTS[0]`（与 prd 相同），因为它们是同一层级的子节点。或者更精确：将环节 1 的权重 0.2 在 spec/plan/tasks 之间等分（各 0.067）。

【第 53 轮】 🤖 AI 代码教练: 等分权重会让单个阶段的评分影响力太小（0.067 意味着满分 100 分也只贡献总分 6.7 分）。建议保持 spec/plan/tasks 各自独立的 phase_weight = 0.2，与 prd/arch/story 平级。总权重超过 1.0 的问题由上层加权计算（非本模块职责）处理——当前系统中 `phase_weight` 是每条记录的属性，最终加权汇总由 AI Coach 负责，不是 parseAndWriteScore 的职责。

【第 54 轮】 ⚔️ 批判性审计员: 如果 spec/plan/tasks 各自 phase_weight=0.2，加上 prd/arch/story/implement/post_impl 的权重，总权重远超 1.0。AI Coach 的 `buildWeakAreas` 只做 `score < 70` 阈值判定，根本不使用 `phase_weight` 做加权。所以 phase_weight 目前只是一个元数据标签，不参与计算。我接受各自 0.2 的方案，但要在文档中标注 phase_weight 当前仅作为记录属性，未参与加权汇总。

【第 55 轮】 👩‍💻 Amelia 开发: B03 完整文件清单：

1. 修改 `scoring/rules/spec-scoring.yaml`（用上面确定的内容替换占位符）
2. 修改 `scoring/rules/plan-scoring.yaml`（同上）
3. 修改 `scoring/rules/tasks-scoring.yaml`（同上）
4. 修改 `scoring/parsers/index.ts`：扩展 `AuditStage` 类型，新增 spec/plan/tasks 分支
5. 新增 `scoring/parsers/audit-generic.ts`：通用审计报告解析器（可被 spec/plan/tasks 共用）
6. 修改 `scoring/constants/weights.ts`：新增 spec/plan/tasks 的 phase_weight
7. 新增测试 fixtures：`sample-spec-report.md`、`sample-plan-report.md`、`sample-tasks-report.md`
8. 新增测试：`scoring/parsers/__tests__/audit-generic.test.ts`

------

### GAP-B11: 四维加权评分

【第 56 轮】 🏗️ Winston 架构师: B11 要实现真正的维度加权计算。当前解析器只提取 A/B/C/D 等级映射为固定分数。需要额外解析审计报告中各维度的子评分，然后用 `code-reviewer-config.yaml` 中的权重加权计算。

【第 57 轮】 ⚔️ 批判性审计员: 核心问题：审计报告中有没有各维度子分数？如果 code-reviewer 的审计报告只给出一个综合等级 A/B/C/D 而不给出各维度分数，那解析器从哪提取维度分数？这不是解析器的问题，而是审计报告模板的问题。

【第 58 轮】 🤖 AI 代码教练: 查看 `audit-prompts.md` 的模板——审计报告确实没有要求 reviewer 输出各维度的具体分数。reviewer 给出的是综合评级 + 问题清单。如果要实现维度加权，需要两步：(1) 修改审计 prompt 模板，要求 reviewer 输出各维度等级 (2) 修改解析器提取各维度等级。

【第 59 轮】 ⚔️ 批判性审计员: 修改审计 prompt 模板属于配置变更，不是代码变更。而且修改 prompt 后，现有的审计报告 fixtures 全部失效——测试中的 `sample-prd-report.md` 等不包含维度分数，会导致维度解析返回空。

【第 60 轮】 🏗️ Winston 架构师: 方案：分离两个层面。(1) 解析层：新增 `parseDimensionScores()` 函数，从审计报告中用正则提取维度评分。如果报告中没有维度评分（旧格式），返回空数组——此时 fallback 到现有的 `GRADE_TO_SCORE` 映射。(2) 配置层：新增 `audit-report-template.md` 示例，包含维度评分格式供 reviewer 参考。(3) 计算层：当维度评分可用时，`finalScore = Σ(dimension_score × weight)`；不可用时，`finalScore = GRADE_TO_SCORE[grade]`。

【第 61 轮】 🤖 AI 代码教练: 具体正则模式——审计报告中维度评分的格式建议标准化为：

维度评分:

\- 功能性: B (80/100)

\- 代码质量: A (95/100)

\- 测试覆盖: C (60/100)

\- 安全性: B (85/100)

解析器提取 `维度名: 等级 (分数/100)` 模式。

【第 62 轮】 ⚔️ 批判性审计员: 分数用括号里的数值还是等级映射？如果 reviewer 写的是 `B (80/100)` 但实际评估的是 75 分对应 B 级，括号里的数字和等级就矛盾了。建议只提取数值分数，忽略等级字母。因为数值更精确，且不需要再做等级→分数的映射。

【第 63 轮】 🤖 AI 代码教练: 接受。正则改为提取数值：`/[-*]\s*(.+?):\s*(\d+)\s*[\/／]\s*100/`。函数签名：

export interface DimensionScore {

  dimension: string;

  weight: number;

  score: number;

}



export function parseDimensionScores(

  content: string,

  mode: string,

  configPath?: string

): DimensionScore[]

【第 64 轮】 👩‍💻 Amelia 开发: B11 文件清单：

1. 新增 `scoring/parsers/dimension-parser.ts`：`parseDimensionScores()`
2. 修改 `scoring/writer/types.ts`：`RunScoreRecord` 增加 `dimension_scores?: DimensionScore[]`
3. 修改 `scoring/schema/run-score-schema.json`：新增 `dimension_scores` 属性定义
4. 修改 `scoring/orchestrator/parse-and-write.ts`：当维度解析结果非空时，用加权分数替代 `GRADE_TO_SCORE` 映射分数
5. 新增测试 fixture：`sample-prd-report-with-dimensions.md`
6. 新增测试：`scoring/parsers/__tests__/dimension-parser.test.ts`

【第 65 轮】 ⚔️ 批判性审计员: 如果维度解析结果非空，加权分数替代了 `GRADE_TO_SCORE` 映射分数——那 `applyTierAndVeto` 的输入 `raw_phase_score` 是加权分数还是映射分数？替代后不会影响 tier coefficient 计算吗？

【第 66 轮】 🤖 AI 代码教练: `applyTierAndVeto` 接收 `raw_phase_score` 并根据 tier rules 打折。无论分数来源是等级映射还是加权计算，`applyTierAndVeto` 的逻辑不变（它只看数值）。所以不影响。但需要确保加权分数的范围仍然是 0-100。

------

### GAP-B05: LLM 结构化提取 fallback

【第 67 轮】 🏗️ Winston 架构师: B05 的核心：当正则解析失败时，用 LLM 做结构化提取。架构：`parseAuditReport()` → 正则解析 → 如失败 → `llmStructuredExtract()` → schema 校验 → 返回结果。

【第 68 轮】 ⚔️ 批判性审计员: 什么算"正则解析失败"？当前 `extractOverallGrade()` 返回 null 就抛 `ParseError`。应该是：正则返回 null 时不抛错，而是调 LLM fallback。只有 LLM 也失败时才抛错。

【第 69 轮】 🤖 AI 代码教练: LLM API 调用的实现细节：使用 `fetch` 发送 JSON 请求到 OpenAI-compatible API（`/v1/chat/completions`），system prompt 要求返回 `{ grade: "A"|"B"|"C"|"D", issues: [{severity, description}], veto_items: string[] }` JSON。对返回的 JSON 做 schema 校验（用 `ajv` 或手动校验）。超时设置 30 秒。

【第 70 轮】 ⚔️ 批判性审计员: LLM 返回的 JSON 可能不符合 schema（幻觉输出）。校验失败后怎么办？重试一次？还是直接报错？重试有成本（API 费用 + 延迟），但能提高成功率。建议：最多重试 1 次，第二次失败则报错。

【第 71 轮】 👩‍💻 Amelia 开发: B05 文件清单：

1. 新增 `scoring/parsers/llm-fallback.ts`：`llmStructuredExtract()`
2. 修改 `scoring/parsers/audit-prd.ts`（及 arch, story）：正则失败时调用 LLM fallback
3. 新增 `scoring/parsers/__tests__/llm-fallback.test.ts`
4. 环境变量：`SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`、`SCORING_LLM_MODEL`

【第 72 轮】 🤖 AI 代码教练: 测试策略：不依赖真实 LLM API。mock fetch 返回预定义 JSON 响应。测试用例：(1) 正则成功→不调 LLM (2) 正则失败+LLM 成功→返回 LLM 结果 (3) 正则失败+LLM schema 校验失败+重试成功 (4) 正则失败+LLM 全部失败→抛错 (5) 无 API key→跳过 LLM 直接抛原始 ParseError (6) API 超时→抛错。6 个用例。

------

### GAP-B06: 能力短板聚类分析

【第 73 轮】 🏗️ Winston 架构师: B06 是模块 6 的核心。当前 AI Coach 只做 `score < 70` 阈值。需要实现基于 check_items 失败模式的聚类分析。技术选型：Node.js 生态中的 `ml-kmeans` 库 + 自实现的简化 TF-IDF。

【第 74 轮】 ⚔️ 批判性审计员: 用 Node.js 做 NLP/ML 聚类？`ml-kmeans` 只有 k-means，没有 HDBSCAN。而且 TF-IDF 需要分词——中英文混合的审计报告怎么分词？Node.js 的中文分词库（如 `nodejieba`）有原生依赖，安装复杂。这会显著增加项目复杂度。

【第 75 轮】 🤖 AI 代码教练: 核心问题是：聚类的输入是什么？是 `check_items[].note` 字符串。这些 note 是短文本（通常一句话），内容是"问题描述"。对短文本做 TF-IDF + K-Means 效果很差。更实用的方案：基于 `item_id` 做频率统计，而不是对 note 文本做 NLP。`item_id` 本身就是结构化的标签（如 `func_correct`、`exception_handling`），按 item_id 聚合失败次数，远比对 note 文本做聚类更可靠。

【第 76 轮】 ⚔️ 批判性审计员: 那这还算"NLP 聚类"吗？交底书声称的是 NLP 聚类，不是频率统计。但用户要求的是"最优解决方案"——如果频率统计在实际效果上优于对短文本的 NLP 聚类，那频率统计才是最优方案。

【第 77 轮】 🤖 AI 代码教练: 折中方案：两层分析。第一层：item_id 频率统计（零依赖，确定性输出）。第二层：对 note 文本做关键词提取（不需要分词库，用正则按空格/标点分词 + 停用词过滤），然后按关键词共现做简单聚合。这比 K-Means 更轻量，也比纯频率统计更深入。

【第 78 轮】 🏗️ Winston 架构师: 最终方案：

export interface WeaknessCluster {

  cluster_id: string;

  primary_item_ids: string[];

  frequency: number;

  keywords: string[];

  severity_distribution: Record<string, number>;

  affected_stages: string[];

}



export function clusterWeaknesses(

  records: RunScoreRecord[],

  minFrequency?: number

): WeaknessCluster[]

【第 79 轮】 ⚔️ 批判性审计员: `minFrequency` 默认值是多少？如果设太低（1），所有单次失败都会成为一个"cluster"，噪声太大。建议默认 `minFrequency = 2`——至少出现 2 次才值得分析。

【第 80 轮】 👩‍💻 Amelia 开发: B06 文件清单：

1. 新增 `scoring/analytics/cluster-weaknesses.ts`：`clusterWeaknesses()`
2. 新增 `scoring/analytics/__tests__/cluster-weaknesses.test.ts`
3. 新增 CLI：`scripts/analytics-cluster.ts`
4. 修改 `scoring/coach/diagnose.ts`：`buildWeakAreas` 替换为调用 `clusterWeaknesses`
5. 修改 `package.json`：新增 `analytics:cluster` script

------

### GAP-B07: SFT 微调数据集提取

【第 81 轮】 🏗️ Winston 架构师: B07 需要从 C/D 级记录中提取 bad/good 代码对。流程：读取 scores.jsonl → 过滤 C/D 级 → 提取 `base_commit_hash` → 查找关联 BUGFIX 文档 → git diff 获取代码变更 → 组装 SFT 数据。

【第 82 轮】 ⚔️ 批判性审计员: 关键依赖：如何从 score record 找到关联的 BUGFIX 文档？record 中没有 `bugfix_doc_path` 字段。`run_id` 的格式是 `cli-{timestamp}`，无法关联到具体的 BUGFIX 文件路径。这是一个数据链路断裂。

【第 83 轮】 🤖 AI 代码教练: 解决方案：在 `RunScoreRecord` 中新增 `artifact_path?: string` 字段，记录触发本次评分的源文档路径（如 BUGFIX 文档路径或 Story 文档路径）。`parseAndWriteScore` 新增 `artifactPath` 参数。这样 SFT 提取器就能通过 `artifact_path` 找到 BUGFIX 文档。

【第 84 轮】 ⚔️ 批判性审计员: 又新增一个字段？`RunScoreRecord` 已经有 `base_commit_hash`、`content_hash`、`source_hash`（B02 新增），现在又加 `artifact_path`。需要评估 schema 膨胀的风险——字段越多，维护成本越高，填写遗漏的可能性越大。

【第 85 轮】 🤖 AI 代码教练: `artifact_path` 和 `source_hash` 解决的是同一类问题（关联源文档）。建议合并：保留 `source_hash`（B02），新增 `source_path?: string`（记录源文档路径），删掉独立的 `artifact_path`。`source_path` 同时服务于 B02（版本锁定校验的文件路径）和 B07（SFT 提取的 BUGFIX 文档查找）。

【第 86 轮】 👩‍💻 Amelia 开发: B07 文件清单：

1. 修改 `scoring/writer/types.ts`：新增 `source_path?: string`
2. 修改 `scoring/schema/run-score-schema.json`：新增 `source_path`
3. 修改 `scoring/orchestrator/parse-and-write.ts`：新增 `sourcePath` 参数
4. 新增 `scoring/analytics/sft-extractor.ts`：`extractSftDataset()`
5. 新增 `scoring/analytics/__tests__/sft-extractor.test.ts`
6. 新增 CLI：`scripts/analytics-sft-extract.ts`

【第 87 轮】 ⚔️ 批判性审计员: `extractSftDataset` 需要调用 `git diff`。测试中如何 mock git？建议：将 git 操作抽象为 `gitDiffBetween(hash1: string, hash2: string, cwd?: string): string` 函数，测试时 mock 该函数。

------

### GAP-B08, B09: Prompt 优化 & 规则建议

【第 88 轮】 🏗️ Winston 架构师: B08 和 B09 高度相关——都是基于聚类结果（B06）生成改进建议。B08 生成 prompt 模板修改建议，B09 生成 scoring 规则修改建议。建议合并为一个 `scoring/analytics/improvement-advisor.ts` 模块。

【第 89 轮】 ⚔️ 批判性审计员: 反对合并。Prompt 优化和规则建议的受众不同——prompt 优化面向 Skill 开发者（修改 prompt 文本），规则建议面向 scoring 管理员（修改 YAML 规则）。合并会让输出格式混乱。保持分离。

【第 90 轮】 🤖 AI 代码教练: 接受分离方案。但两者共享输入数据（聚类结果），建议共享一个 `loadClusterResults()` 辅助函数。B08 的 `generatePromptSuggestions()` 输出 Markdown 文件。B09 的 `generateRuleSuggestions()` 输出 YAML 文件。

【第 91 轮】 👩‍💻 Amelia 开发: B08 文件清单：

1. 新增 `scoring/analytics/prompt-optimizer.ts`：`generatePromptSuggestions()`
2. 新增测试 + CLI

B09 文件清单：

1. 新增 `scoring/analytics/rule-suggestion.ts`：`generateRuleSuggestions()`
2. 新增测试 + CLI

【第 92 轮】 ⚔️ 批判性审计员: B09 的 `generateRuleSuggestions` 输出什么格式？如果输出的是修改后的完整 YAML 文件，风险太大（可能覆盖正确的规则）。建议输出diff 格式或建议列表，由人工确认后应用。

【第 93 轮】 🤖 AI 代码教练: 确认：B09 输出格式为 YAML 建议列表，不直接修改规则文件：

suggestions:

  \- item_id: exception_handling

​    current_deduct: 4

​    suggested_deduct: 6

​    reason: "最近 10 次审计中失败 7 次，当前扣分不足以驱动修复"

  \- item_id: veto_no_regression_test

​    action: promote_to_veto

​    reason: "回归测试缺失在最近 5 次中导致生产事故"

------

### GAP-B10: eval_question 端到端验证

【第 94 轮】 🏗️ Winston 架构师: B10 需要一个完整的 `eval_question` 场景验证——从审计报告输入到 score record 写入到 AI Coach 诊断。

【第 95 轮】 ⚔️ 批判性审计员: 当前测试中 `eval_question` 唯一的覆盖是 `parse-and-write.test.ts` 的 question_version 校验。但 AI Coach 的 `coachDiagnose` 函数是否能正确处理 `eval_question` 场景的记录？需要验证。

【第 96 轮】 🤖 AI 代码教练: B10 文件清单：

1. 新增 fixture：`sample-eval-question-report.md`
2. 新增端到端测试：`scoring/__tests__/e2e/eval-question-flow.test.ts`——覆盖 parse → write → coach diagnose 全链路
3. 新增示例数据：`scoring/data/eval-question-sample.json`
4. 修改 `scripts/parse-and-write-score.ts`：增加 `--questionVersion` 参数

------

### GAP-B12, B13: Bugfix 回写 & 回退建议

【第 97 轮】 🏗️ Winston 架构师: B12 的 `writebackBugfixToStory` 需要解析 BUGFIX 文档的 §7 任务列表。BUGFIX 文档格式是 Markdown，§7 通常是 `## §7 最终任务列表` 标题下的 checkbox 列表。

【第 98 轮】 ⚔️ 批判性审计员: B12 的 `storyProgressPath` 参数——Story 的 progress.txt 在哪里？不同 Story 的路径格式是 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/progress.txt`？如果路径不存在怎么办？创建还是报错？

【第 99 轮】 🤖 AI 代码教练: B12 实现策略：路径不存在时创建（因为 progress.txt 是增量追加文件）。B13 的 `suggestRollback` 不执行 git 操作，只返回建议信息——这是第 8 轮达成的共识。输出格式：

export interface RollbackSuggestion {

  action: 'suggest_rollback';

  stage: string;

  lastStableCommit: string | undefined;

  message: string;

  commands: string[]; *// ['git stash', 'git reset --hard <commit>']*

}

【第 100 轮】 ⚔️ 批判性审计员: B13 输出 `commands` 数组包含 `git reset --hard`——这些命令不被自动执行，只是作为建议输出供开发者参考。但如果有 Agent 读取了这个输出并自动执行呢？建议在 `message` 中明确标注"以下命令仅供参考，请人工确认后执行"。

【第 101 轮】 🤖 AI 代码教练: 同意。`message` 字段内容固定包含告警前缀：`"⚠️ 以下回退命令仅供参考，请确认后手动执行："`。

------

### 全局整合与收敛

【第 102 轮】 🏗️ Winston 架构师: 汇总所有 GAP 的 schema 变更——`RunScoreRecord` 新增字段总览：B02 新增 `source_hash?: string`，B07/B12 新增 `source_path?: string`，B11 新增 `dimension_scores?: DimensionScore[]`。加上 B01 已有的 `base_commit_hash` 和 `content_hash`，总计 5 个新增可选字段。

【第 103 轮】 ⚔️ 批判性审计员: 5 个新增字段都是可选的（`?`），不影响现有数据兼容性。但 `run-score-schema.json` 的 `required` 数组不需要变。确认无破坏性变更。我接受这个 schema 扩展方案。

【第 104 轮】 🤖 AI 代码教练: 全部 12 个 GAP 的依赖关系最终确认：B02 依赖 B01（✅已完成）。B03 独立。B04 独立。B05 独立（增强解析器）。B06 依赖 B03（需要更多阶段的 check_items 数据）。B07 依赖 B01（✅）+ B06。B08 依赖 B06。B09 依赖 B06。B10 独立。B11 独立。B12 独立。B13 独立。

【第 105 轮】 ⚔️ 批判性审计员: 执行顺序建议（按依赖拓扑排序）： 批次 1（无依赖）：B02, B03, B04, B05, B10, B11, B12, B13 批次 2（依赖 B03/B06）：B06 批次 3（依赖 B06）：B07, B08, B09

B06 看似依赖 B03，但实际上 B06 只需要 `RunScoreRecord` 数据（已有的 prd/arch/story 记录就够），B03 只是增加更多数据源。所以 B06 可以和 B03 并行。修正为： 批次 1：B02, B03, B04, B05, B06, B10, B11, B12, B13 批次 2：B07, B08, B09

【第 106 轮】 🤖 AI 代码教练: 每个 GAP 的测试用例总数确认——B02: 6, B03: 9(3×3), B04: 7, B05: 6, B06: 5, B07: 5, B08: 4, B09: 4, B10: 3, B11: 5, B12: 5, B13: 4。总计 63 个新增测试用例。

【第 107 轮】 ⚔️ 批判性审计员: 检查是否存在"可选"、"可考虑"、"后续"、"酌情"等模糊表述……确认所有 GAP 的方案描述中不存在这些词汇。每个函数签名的参数和返回类型都已明确。

【第 108 轮】 🤖 AI 代码教练: 确认每个 GAP 的失败影响评估：

- B02: 校验异常→warn_and_proceed，不阻断
- B04: config 不存在→抛异常（因为 config 是必需文件）
- B05: LLM 不可用→退回正则失败行为
- B06-B09: 分析模块独立于评分流水线，失败不影响 scoring pipeline
- B10: 独立测试场景
- B11: 维度解析失败→fallback 到等级映射
- B12: progress.txt 写入失败→抛异常但不影响 scoring
- B13: 纯建议输出，无副作用

【第 109 轮】 ⚔️ 批判性审计员: 终审前最后一个问题——B02 中 `checkPreconditionHash` 返回 `warn_and_proceed` 时，调用者应如何处理？是继续执行还是记录日志？需要明确。建议：`warn_and_proceed` 时打印 `console.warn` 日志，但不阻断 `parseAndWriteScore` 的调用。warn 信息包含 actual_hash 和 expected_hash 供追溯。

【第 110 轮】 🤖 AI 代码教练: 同意。CLI 脚本中在 `shouldWriteScore` 和 `checkPreconditionHash` 调用后，根据返回的 action 打印对应级别的日志（`console.log` for proceed, `console.warn` for warn, `console.error` for block + `process.exit(1)`）。

------

### 收敛确认

【第 111 轮】 ⚔️ 批判性审计员: 回顾所有 12 个 GAP，检查是否有遗漏的 gap：

- B02: `source_hash` + `source_path` 字段需要同时加入 → ✅ 已在 B02+B07 中覆盖
- B03: 解析器泛化 → ✅ 已确定 `audit-generic.ts`
- B04: 独立于 `parseAndWriteScore` → ✅
- B05: LLM fallback 离线降级 → ✅ 通过环境变量控制
- B06-B09: 依赖链 → ✅ 已确认
- B10-B13: 独立实现 → ✅
- 无新 Gap。

【第 112 轮】 🤖 AI 代码教练: 无新 Gap。所有 GAP 的函数签名、文件清单、测试用例、集成点、失败影响已完全确定。

【第 113 轮】 ⚔️ 批判性审计员:

终审陈述: 我有条件地同意当前共识。

前提条件：

1. `content_hash` 字段的 JSDoc 注释必须更新，明确其语义为"审计报告内容的 SHA-256"
2. B02 中 `source_hash` 和 `source_path` 必须同时实现，不得只实现一个
3. B05 的 LLM fallback 必须有 API 超时配置（环境变量 `SCORING_LLM_TIMEOUT_MS`，默认 30000）
4. B06 的 `minFrequency` 默认值为 2

以上条件已在讨论中达成共识并反映在方案中。无 deferred gaps。建议进入实现阶段。