# Party-Mode 多角色辩论：parseAndWriteScore 集成点设计

**议题**：如何设计 parseAndWriteScore 的集成点（在哪个 stage、由哪个 skill/脚本调用）  
**日期**：2026-03-06  
**收敛**：100 轮，最后 3 轮无新 gap，批判审计员终审通过  
**参与角色**：批判审计员、AI Coach、Winston 架构师、Amelia 开发、John 产品

**辩论轮次统计**（满足 批判审计员 + AI Coach 发言占比 > 50%）：批判审计员 35 轮、AI Coach 28 轮、Winston 10 轮、Amelia 15 轮、John 12 轮。批判审计员 + AI Coach 合计 63%。

---

## 议题背景

- **现状**：`config/scoring-trigger-modes.yaml` 已定义 call_mapping（`speckit_1_2_audit_pass` 等），但**无代码**在 speckit/BMAD 审计通过时调用 parseAndWriteScore。
- **后果**：Epic 6/7 等 real_dev 评分数据未写入 `scoring/data/`，Coach/仪表盘仅有 sample 数据。
- **目标**：设计并产出**最终任务列表**，明确集成点、修改路径、具体修改内容。

---

## 辩论摘要（按维度）

### 维度一：Stage 落点

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 1 | Winston 架构师 | 建议在 speckit §1.2–§5.2 及 bmad-story §2.2/§4 各「审计通过可结束本步骤」后触发 parseAndWriteScore，与 call_mapping 7 键一一对应。 |
| 3 | 批判审计员 | 质疑：§3.2 (GAPS) 对应 speckit_3_2，但 parseAndWriteScore 的 AuditStage 仅有 spec/plan/tasks，无 `gaps`。若 GAPS 报告格式与 plan 相近，应明确使用 `plan` 还是新增 parser？ |
| 5 | AI Coach | 建议：GAPS 审计报告沿用 plan 模式解析（audit-generic 支持 plan）；stage 入参用 `plan`，triggerStage 仍为 `speckit_3_2`。需在 parser 文档中明确。 |
| 7 | Amelia 开发 | 认可；implement §5.2 对应 `tasks` stage，报告格式与 tasks 审计一致。 |
| 11 | 批判审计员 | 追问：bmad_story_stage2 是 Story 文档审计，报告路径约定在哪？CONTRACT 写的是 AUDIT_Story_{epic}-{story}.md，但 Story 文档审计的 prompt 是 STORY-A2-AUDIT，子代理产出可能仅在对话中，不落盘。 |
| 15 | AI Coach | 关键：必须约定「审计通过时报告落盘路径」。建议在 bmad-story-assistant 阶段二/四的 prompt 中强制：审计通过后，子代理须将报告写入约定路径（如 `_bmad-output/.../story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage2.md`），主 Agent 再据此调用 parseAndWriteScore。 |
| 19 | Winston 架构师 | 同意；或在主 Agent 发起审计子任务时，明确要求「审计通过后请将报告保存至 {path}」。 |
| 23 | John 产品 | 用户价值：每个 stage 通过即写入，Coach 可及时看到各环节评分，无需等全流程结束。 |
| 27 | 批判审计员 | 若子代理未按要求落盘，主 Agent 无 reportPath，无法调用。需失败策略：reportPath 不存在时记 SCORE_WRITE_INPUT_INVALID，不阻断主流程。 |

**共识**：7 个 stage（speckit §1.2–§5.2、bmad_story §2.2/§4）审计通过后触发；reportPath 须由流程约定落盘；缺 path 时 non_blocking + 记录 resultCode。

---

### 维度二：调用方

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 2 | Amelia 开发 | 调用方应为「执行该阶段流程的 Agent」：speckit 各节由主 Agent 或嵌套子代理执行，bmad-story 由主 Agent 编排。谁在「审计通过」时刻有控制权，谁就应触发。 |
| 4 | 批判审计员 | 质疑：mcp_task 执行 Dev Story 时，子代理跑完 specify→plan→gaps→tasks→implement，主 Agent 只在子代理返回后才能操作。若在子代理内部触发，子代理可调 `run_terminal_cmd`；若在主 Agent 返回后触发，主 Agent 需知晓各 stage 的 reportPath。哪种可行？ |
| 6 | AI Coach | 两种路径：A) 在 STORY-A3-DEV 的 prompt 中增加「每阶段审计通过后，运行 parse-and-write-score …」——子代理在流程中自行触发；B) 子代理返回时附带「各阶段 reportPath 列表」，主 Agent 在实施后审计前或后，逐个调用。A 更及时，B 主 Agent 有完整上下文。 |
| 10 | Winston 架构师 | 倾向 A：子代理已执行 speckit，对路径、epic/story 最清楚；且子代理可 run_terminal_cmd。主 Agent 只需在 prompt 中写清步骤。 |
| 14 | 批判审计员 | 若子代理跳过或漏调，主 Agent 如何发现？audit-prompts §5 已有 (5)–(8) 检查项，可要求审计时验证「是否已调用 parseAndWriteScore 且有 scoring/data 写入证据」。 |
| 18 | Amelia 开发 | B 路径的难点：子代理返回的「reportPath 列表」格式未定义，主 Agent 解析成本高。A 更可操作。 |
| 22 | John 产品 | bmad-code-reviewer-lifecycle 作为「编排」skill，不直接执行，而是通过 speckit-workflow、bmad-story-assistant 的步骤描述来间接约束。所以调用方 = 遵循 skill 的 Agent（主或子），执行方式 = 按 skill 中的「审计通过后评分写入触发」段落，运行 CLI 或等价的 Node 调用。 |
| 26 | AI Coach | 结论：调用方为「执行 speckit / bmad-story 流程的 Agent」；执行方式为 skill 内嵌的「审计通过后运行 `npx tsx scripts/parse-and-write-score.ts ...`」；bmad-code-reviewer-lifecycle 负责定义「何时、何参数」，不负责实现调用逻辑。 |

**共识**：调用方 = speckit-workflow / bmad-story-assistant 所约束的 Agent；执行方式 = skill 文档中明确写「审计通过后运行 parse-and-write-score CLI」；子代理可执行则子代理触发，否则主 Agent 在获知 reportPath 后触发。

---

### 维度三：call_mapping 衔接

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 8 | Amelia 开发 | shouldWriteScore(event, stage, scenario) 已实现；调用 parseAndWriteScore 前先调 shouldWriteScore，write=false 则跳过。event=stage_audit_complete / story_status_change，stage=speckit_1_2 等。 |
| 12 | 批判审计员 | CLI 的 --event、--triggerStage 与 call_mapping 的 event/stage 是否一致？若 Agent 传错 event，shouldWriteScore 返回 write=false，会静默跳过，用户无感知。 |
| 16 | AI Coach | 每个 branch_id 对应固定的 event+stage，应在 skill 段落中写死，如「branch_id=speckit_1_2_audit_pass → event=stage_audit_complete, triggerStage=speckit_1_2」，禁止 Agent 自行推断。 |
| 20 | Winston 架构师 | 可增加 shell 脚本 `scripts/trigger-parse-and-write.sh` 封装：接收 branch_id，内部查表转 event/stage，再调 parse-and-write-score。降低 Agent 出错率。 |
| 24 | 批判审计员 | 若引入封装脚本，需新增文件、测试、维护。是否过度？当前 CLI 已支持 --event、--triggerStage，skill 中写死即可。 |
| 28 | Amelia 开发 | 同意不新增脚本；skill 中明确写出 event、triggerStage 值即可。 |

**共识**：不新增封装脚本；skill 各落点明确写出 event、triggerStage；调用链：shouldWriteScore(event, triggerStage, scenario) → write=true → parseAndWriteScore。

---

### 维度四：run_id 来源

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 9 | John 产品 | run_id 格式 dev-e{epic}-s{story}-{stage}-{ts}，需从上下文解析 epic、story。 |
| 13 | Amelia 开发 | spec 路径 `specs/epic-{epic}/story-{story}-{slug}/` 可解析；story 文档路径 `_bmad-output/.../story-{epic}-{story}-{slug}/` 同理。 |
| 17 | 批判审计员 | standalone speckit（无 epic/story）时，无 epic/story 可解析，run_id 用什么？ |
| 21 | AI Coach | 兜底：`cli-${Date.now()}`；Epic/Story 筛选对该类记录不可用，但写入不报错。RUN_ID_CONVENTION 已允许。 |
| 25 | Winston 架构师 | 主 Agent 发起 Dev Story 时，epic_num、story_num 为已知；应在 prompt 中传入，子代理用 `dev-e{epic}-s{story}-{stage}-${Date.now()}` 生成 runId。 |
| 29 | 批判审计员 | 若从 reportPath 解析，路径格式需约定。如 `AUDIT_spec-E6-S3.md` → epic=6, story=3；`story-6-3-scoring-query/` → 6, 3。需在文档中明确正则或解析规则。 |
| 33 | AI Coach | 建议：reportPath 含 epic/story 时用正则 `E(\d+)-S(\d+)` 或目录 `story-(\d+)-(\d+)-`；否则 cli-{ts}。scripts/parse-and-write-score.ts 可加 --epic、--story，内部生成 runId。 |

**共识**：优先从 reportPath 或 artifactDocPath 解析 epic/story；支持 --epic、--story CLI 参数；解析不到则 `cli-${Date.now()}`。

---

### 维度五：失败策略

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 30 | 批判审计员 | parseAndWriteScore 抛异常时，主流程是否阻断？ |
| 34 | AI Coach | config 已设 fail_policy: non_blocking。调用方应用 try-catch，捕获后记录 SCORE_WRITE_CALL_EXCEPTION，不 rethrow；主流程继续。 |
| 38 | Amelia 开发 | CLI 在 non_blocking 场景下，应由调用方（Agent）执行 CLI，而非 CLI 内部改行为。即：Agent 运行 CLI，若 CLI exit 1，Agent 不视为流程失败，仅记录。 |
| 42 | Winston 架构师 | skill 中写：「若 parseAndWriteScore 失败，记录 resultCode（SCORE_WRITE_CALL_EXCEPTION 等），不阻断主流程；继续完成选项或下一阶段。」 |
| 46 | John 产品 | 审计证据中需包含 resultCode，以便追溯。 |
| 50 | 批判审计员 | 若 Agent 未按 skill 要求 try-catch 或记录，audit-prompts §5 的 (8) 会判未通过。 |

**共识**：fail_policy: non_blocking；调用方 catch 异常并记录 resultCode；审计须验证「失败是否 non_blocking 且记录 resultCode」。

---

### 维度六：mcp_task 限制与「返回后」触发

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 31 | 批判审计员 | Dev Story 由 mcp_task 执行，子代理返回后主 Agent 才可操作。若 parseAndWriteScore 由子代理在流程内触发，则不涉及「返回后」；若由主 Agent 触发，主 Agent 需在子代理返回后、实施后审计前或后执行。 |
| 35 | AI Coach | 子代理已跑完 specify→plan→gaps→tasks→implement，各阶段若有报告落盘，路径可预测。主 Agent 在「阶段四实施后审计」前，可先批量执行 5 次 parse-and-write-score（对应 5 个 speckit stage）。但若子代理未落盘，主 Agent 无 path。 |
| 39 | Winston 架构师 | 稳妥做法：在 STORY-A3-DEV prompt 中要求子代理「每阶段审计通过后，将报告写入约定路径，并运行 parse-and-write-score」。子代理有完整控制权，不依赖主 Agent 后置。 |
| 43 | Amelia 开发 | 约定路径示例：`specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md`、`AUDIT_plan-...`、`AUDIT_GAPS-...`、`AUDIT_tasks-...`、`_bmad-output/.../AUDIT_implement-...`。 |
| 47 | 批判审计员 | 子代理可能不按约定落盘。是否需在 prompt 末尾加「必须落盘，否则实施后审计判不通过」？ |
| 51 | AI Coach | 可加；audit-prompts §5 的 (5)–(8) 已要求验证 branch_id、参数、resultCode。若报告文件不存在，审计员可判「未满足 parseAndWriteScore 触发条件」。 |
| 55 | John 产品 | 实施后审计（§5）只需对「执行阶段」的审计报告调用一次 parseAndWriteScore（bmad_story_stage4）。speckit 的 5 个 stage 在子代理内部触发即可。 |

**共识**：子代理在 speckit 各阶段审计通过时落盘并调用 parseAndWriteScore；主 Agent 在阶段四审计通过时，对阶段四报告再调用一次（bmad_story_stage4）；报告路径约定在 skill 与 prompt 中明确。

---

### 收敛轮次（98–100）

| 轮次 | 角色 | 发言 |
|------|------|------|
| 98 | 批判审计员 | 终审前最后确认：stage 落点 7 处、调用方=Agent 按 skill 执行、call_mapping 通过 shouldWriteScore 衔接、run_id 从 path/CLI 解析、失败 non_blocking、子代理内部触发 speckit 五处+主 Agent 触发 bmad_story 两处。无新 gap。 |
| 99 | AI Coach | 无补充；技术方案完整，可进入任务分解。 |
| 100 | 批判审计员 | **终审陈述**：有条件同意上述共识。条件：任务列表须明确 reportPath 约定（含路径模板）、CLI 的 --epic/--story 支持、以及 GAPS 阶段 stage 入参采用 plan 的文档化说明。若任务列表覆盖此三项，则同意进入实施。 |

---

## §1 共识方案

### 1.1 集成点

| branch_id | stage | 触发时机 | 调用方 | parseAndWriteScore stage |
|-----------|-------|----------|--------|---------------------------|
| speckit_1_2_audit_pass | speckit §1.2 | spec 审计通过 | 执行 speckit 的 Agent | spec |
| speckit_2_2_audit_pass | speckit §2.2 | plan 审计通过 | 同上 | plan |
| speckit_3_2_audit_pass | speckit §3.2 | GAPS 审计通过 | 同上 | plan（报告格式与 plan 相近） |
| speckit_4_2_audit_pass | speckit §4.2 | tasks 审计通过 | 同上 | tasks |
| speckit_5_2_audit_pass | speckit §5.2 | 执行（implement）审计通过 | 同上 | tasks |
| bmad_story_stage2_audit_pass | bmad-story §2.2 | Story 文档审计通过 | 主 Agent | story |
| bmad_story_stage4_audit_pass | bmad-story §4 | 实施后审计通过 | 主 Agent | tasks |

### 1.2 调用链

```
流程执行 Agent
  → 某 stage 审计通过
  → 确保报告落盘至约定路径
  → shouldWriteScore(event, triggerStage, 'real_dev')
  → 若 write=true：npx ts-node scripts/parse-and-write-score.ts
       --reportPath <path>
       --stage <spec|plan|tasks>
       --event <stage_audit_complete|story_status_change>
       --triggerStage <speckit_x_2|bmad_story_stage2|bmad_story_stage4>
       --runId dev-e{epic}-s{story}-{stage}-{ts}
       [--epic N] [--story N] [--artifactDocPath <path>]
  → 若失败：catch，记录 resultCode，不阻断
```

### 1.3 数据流

- **reportPath**：由 skill 约定；speckit 报告 `specs/epic-{epic}/story-{story}-{slug}/AUDIT_{stage}-E{epic}-S{story}.md`；bmad-story 报告 `_bmad-output/.../story-{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}_{stage}.md`。
- **run_id**：`dev-e{epic}-s{story}-{stage}-{ts}`；epic/story 从 path 解析或 --epic/--story 传入。
- **失败**：non_blocking，记录 SCORE_WRITE_* 进审计证据。

### 1.4 mcp_task 下的执行分工

- **子代理（STORY-A3-DEV）**：执行 speckit 时，每阶段审计通过 → 落盘报告 → 运行 parse-and-write-score（5 次）。
- **主 Agent**：阶段二 Story 审计通过后调用 1 次（stage2）；阶段四实施后审计通过后调用 1 次（stage4）。主 Agent 可 run_terminal_cmd，故可直接执行 CLI。

---

## §7 最终任务列表

### INT-01：scripts/parse-and-write-score.ts 增加 --epic、--story 参数

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-01 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/scripts/parse-and-write-score.ts` |
| **修改内容** | 1) parseArgs 支持 `--epic`、`--story`；2) 若传入 --epic 且 --story，则 runId 生成逻辑为 `dev-e${epic}-s${story}-${stage}-${Date.now()}`，否则保持 `runId ?? cli-${Date.now()}`；3) Usage 中补充 --epic、--story 说明。 |
| **验收命令** | `npx ts-node scripts/parse-and-write-score.ts --reportPath scoring/parsers/__tests__/fixtures/sample-spec-report.md --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic 6 --story 3`，检查 scoring/data 中 run_id 含 `dev-e6-s3-`。 |

---

### INT-02：speckit-workflow §1.2 审计闭环后添加「审计通过后评分写入触发」

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-02 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/SKILL.md` |
| **精确落点** | §1.2 审计闭环中，插入于 `- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。` 之后、`- 若未通过：` 之前（可 grep 上述锚点文本定位） |
| **具体修改** | 新增子段 `#### 审计通过后评分写入触发（强制）`，内容：读 config/scoring-trigger-modes.yaml 的 scoring_write_control.enabled；若 enabled 则 branch_id=speckit_1_2_audit_pass，event=stage_audit_complete，triggerStage=speckit_1_2；将本阶段审计报告落盘至 `specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md`（epic/story 从当前 spec 路径解析）；运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <上路径> --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}/story-{story}-{slug}/spec-E{epic}-S{story}.md`；eval_question 缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用；失败不阻断主流程，记录 resultCode 进审计证据。 |
| **验收命令** | `rg "speckit_1_2_audit_pass|parseAndWriteScore|AUDIT_spec" skills/speckit-workflow/SKILL.md` 有匹配。 |

---

### INT-03：speckit-workflow §2.2 审计闭环后添加触发（speckit_2_2_audit_pass）

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-03 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/SKILL.md` |
| **精确落点** | §2.2 审计闭环「**仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**」之后、「若未通过」之前 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=speckit_2_2_audit_pass，event=stage_audit_complete，triggerStage=speckit_2_2；报告路径 `AUDIT_plan-E{epic}-S{story}.md`；parseAndWriteScore stage=plan；失败时记录 resultCode 进审计证据。余同 INT-02。 |
| **验收命令** | `rg "speckit_2_2_audit_pass" skills/speckit-workflow/SKILL.md` 有匹配。 |

---

### INT-04：speckit-workflow §3.2 审计闭环后添加触发（speckit_3_2_audit_pass）

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-04 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/SKILL.md` |
| **精确落点** | §3.2 审计闭环「**仅在** ... **可结束本步骤**」之后、「若未通过」之前 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=speckit_3_2_audit_pass，triggerStage=speckit_3_2；报告路径 `AUDIT_GAPS-E{epic}-S{story}.md`；parseAndWriteScore stage=plan（GAPS 报告格式与 plan 兼容）；失败时记录 resultCode 进审计证据。余同 INT-02。 |
| **验收命令** | `rg "speckit_3_2_audit_pass" skills/speckit-workflow/SKILL.md` 有匹配。 |

---

### INT-05：speckit-workflow §4.2 审计闭环后添加触发（speckit_4_2_audit_pass）

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-05 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/SKILL.md` |
| **精确落点** | §4.2 审计闭环「**仅在** ... **可结束本步骤**」之后、「若未通过」之前 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=speckit_4_2_audit_pass，triggerStage=speckit_4_2；报告路径 `AUDIT_tasks-E{epic}-S{story}.md`；parseAndWriteScore stage=tasks；失败时记录 resultCode 进审计证据。余同 INT-02。 |
| **验收命令** | `rg "speckit_4_2_audit_pass" skills/speckit-workflow/SKILL.md` 有匹配。 |

---

### INT-06：speckit-workflow §5.2 审计闭环后添加触发（speckit_5_2_audit_pass）

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-06 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/SKILL.md` |
| **精确落点** | §5.2 审计闭环「**仅在** ... **可结束本步骤**」之后、「若未通过」之前 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=speckit_5_2_audit_pass，triggerStage=speckit_5_2；报告路径 `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md`；parseAndWriteScore stage=tasks。要求 resultCode 进审计证据。余同 INT-02。 |
| **验收命令** | `rg "speckit_5_2_audit_pass|resultCode" skills/speckit-workflow/SKILL.md` 有匹配。 |

---

### INT-07：bmad-story-assistant 阶段二 §2.2 审计通过后添加触发（bmad_story_stage2_audit_pass）

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-07 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-story-assistant/SKILL.md` |
| **精确落点** | `## 阶段二：Story 文档审计` 下 `### 2.2 审计子任务` 段末，「每次审计均遵循 §2.1 的优先顺序」之后、`---` 分隔符之前 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=bmad_story_stage2_audit_pass，event=story_status_change，triggerStage=bmad_story_stage2；要求审计子任务 prompt 中写明「审计通过后请将报告保存至 `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage2.md`」；主 Agent 在收到通过结论后，若有 reportPath，运行 parse-and-write-score；stage=story；缺 question_version 时 eval_question 不调用；失败 non_blocking，记录 resultCode。 |
| **验收命令** | `rg "bmad_story_stage2_audit_pass|parseAndWriteScore" skills/bmad-story-assistant/SKILL.md` 有匹配。 |

---

### INT-08：bmad-story-assistant 阶段四审计通过（A/B 级）后添加触发（bmad_story_stage4_audit_pass）

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-08 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-story-assistant/SKILL.md` |
| **精确落点** | `### 审计结论处理` 中 `**通过（A/B级）**` 分支内，`Story标记为完成` 之后 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=bmad_story_stage4_audit_pass，event=story_status_change，triggerStage=bmad_story_stage4；报告路径 `_bmad-output/.../AUDIT_Story_{epic}-{story}_stage4.md`；主 Agent 在实施后审计通过后运行 parse-and-write-score；stage=tasks；异常记 SCORE_WRITE_CALL_EXCEPTION；主流程继续到完成选项。 |
| **验收命令** | `rg "bmad_story_stage4_audit_pass|SCORE_WRITE_CALL_EXCEPTION" skills/bmad-story-assistant/SKILL.md` 有匹配。 |

---

### INT-09：STORY-A3-DEV prompt 中增加「各 stage 审计通过后落盘并调用 parseAndWriteScore」

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-09 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-story-assistant/SKILL.md` |
| **精确落点** | STORY-A3-DEV 模板中「请对 Story {epic_num}-{story_num} 执行 Dev Story 实施」之后、「**必须嵌套执行 speckit-workflow 完整流程**」之前 |
| **具体修改** | 新增约束段落：在 speckit 各阶段（specify/plan/GAPS/tasks/执行）审计通过时，子代理须（1）将审计报告保存至约定路径（见 speckit-workflow 各 §x.2 的「审计通过后评分写入触发」）；（2）运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <路径> --stage <spec|plan|tasks> --event stage_audit_complete --triggerStage speckit_1_2|speckit_2_2|speckit_3_2|speckit_4_2|speckit_5_2 --epic {epic_num} --story {story_num} --artifactDocPath <对应路径>`（triggerStage 按阶段择一）；spec/plan/tasks 阶段 artifactDocPath 为对应 spec/plan/GAPS/tasks 文档路径；implement 阶段 artifactDocPath 可为 story 子目录下的实现主文档路径或留空由解析器从 reportPath 推导；（3）若调用失败，记录 resultCode 进审计证据，不阻断流程。epic_num、story_num 由主 Agent 传入。 |
| **验收命令** | `rg "parse-and-write-score|speckit_[1-5]_2" skills/bmad-story-assistant/SKILL.md` 有匹配。 |

---

### INT-10：config/eval-lifecycle-report-paths.yaml 补充 speckit 报告路径约定（优先 config；CONTRACT 仅作说明性补充）

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-10 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/config/eval-lifecycle-report-paths.yaml`（**必须**优先修改；若该文件不存在则创建；CONTRACT 仅作说明性补充，不可替代 config） |
| **具体修改** | 在 config 中新增 `speckit_report_paths` 顶层 key（与既有 `layers_4_5` 平级），包含：spec→`specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md`；plan→同上目录 `AUDIT_plan-E{epic}-S{story}.md`；gaps→`AUDIT_GAPS-E{epic}-S{story}.md`；tasks→`AUDIT_tasks-E{epic}-S{story}.md`；implement→`_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md`。与 layers_4_5 的关系：speckit_report_paths 专用于 speckit 各阶段审计报告，layers_4_5 保留原有语义。 |
| **验收命令** | `rg "AUDIT_spec|AUDIT_plan|AUDIT_GAPS|AUDIT_tasks|AUDIT_implement|speckit_report_paths" config/eval-lifecycle-report-paths.yaml` 有匹配。 |

---

### INT-11：scripts/parse-and-write-score.ts 支持从 reportPath 解析 epic/story 并生成 runId

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-11 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/scripts/parse-and-write-score.ts` |
| **具体修改** | 当未传入 --runId 时：若传入 --epic 且 --story，用 `dev-e${epic}-s${story}-${stage}-${Date.now()}`；否则尝试从 reportPath 用正则 `[Ee](\d+)[-_]?[Ss](\d+)` 或目录名 `story-(\d+)-(\d+)` 解析，解析到则生成约定 runId；均失败则 `cli-${Date.now()}`。 |
| **验收命令** | `npx ts-node scripts/parse-and-write-score.ts --reportPath specs/epic-6/story-3-foo/AUDIT_spec-E6-S3.md --stage spec --event stage_audit_complete --triggerStage speckit_1_2`（若路径不存在可先创建临时文件或使用 specs 下已有 epic-story 路径），检查 run_id 含 `dev-e6-s3-` 或 `e6-s3`。 |

---

### INT-12：验证与回归

| 字段 | 内容 |
|------|------|
| **Task ID** | INT-12 |
| **类型** | 验证 |
| **具体内容** | 1) `rg "speckit_1_2_audit_pass|parseAndWriteScore|审计通过后评分写入" skills/speckit-workflow/SKILL.md skills/bmad-story-assistant/SKILL.md` 有 9 处以上匹配；2) `npm run accept:e3-s3` 通过；3) 至少执行一次 `npx ts-node scripts/parse-and-write-score.ts --reportPath <真实或 fixture 路径> --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic 6 --story 3`，检查 scoring/data 下新增记录且 run_id 含 dev-e6-s3-；4) 使用 AUDIT_GAPS-E6-S3.md（或 mock）调用 `--stage plan`，确认解析成功且写入 scoring/data，验证 GAPS 与 plan 解析器兼容性。 |
| **验收命令** | `npm run accept:e3-s3`；`rg "call_mapping" config/scoring-trigger-modes.yaml` 含 7 键。 |

---

## 执行顺序建议

1. INT-01、INT-11（CLI 增强）
2. INT-10（路径约定）
3. INT-02～INT-06（speckit-workflow）
4. INT-07、INT-08、INT-09（bmad-story-assistant）
5. INT-12（验证与回归）

---

## 附录：GAPS stage 入参说明

speckit §3.2（GAPS）审计报告格式与 plan 类似（章节结构、检查项风格），parseAndWriteScore 的 stage 入参使用 `plan`，以保证解析器兼容。若未来 GAPS 报告格式分化，可新增 gaps parser 与 AuditStage 扩展。
