# audit-prompts §5 适配审计 第 3 轮：DEBATE_parseAndWriteScore_集成点设计_100轮共识

**审计对象**：`_bmad-output/implementation-artifacts/_orphan/DEBATE_parseAndWriteScore_集成点设计_100轮共识.md`  
**审计范围**：§7 任务列表（INT-01～INT-12）、§1 共识方案  
**第 2 轮后修改**：§1.2 调用链已由 `npx tsx` 改为 `npx ts-node`  
**审计日期**：2026-03-06

---

## 一、逐项审计结果

### 1. 任务路径、落点、修改内容、验收命令是否明确且可操作

| 任务 | 路径 | 落点 | 修改内容 | 验收命令 | 结论 |
|------|------|------|----------|----------|------|
| INT-01 | `scripts/parse-and-write-score.ts` | 明确 | parseArgs 支持 --epic/--story；runId 逻辑；Usage | npx ts-node ... --epic 6 --story 3；检查 run_id | ✅ 明确 |
| INT-02 | speckit-workflow/SKILL.md | 「可结束本步骤」之后、「若未通过」之前 | 新增触发子段；branch_id=speckit_1_2_audit_pass | rg 有匹配 | ✅ 锚点可定位 |
| INT-03～INT-06 | 同上 | 同上（§2.2～§5.2） | 各 stage 对应 branch_id、路径、stage | rg 各 branch_id | ✅ 明确 |
| INT-07 | bmad-story-assistant/SKILL.md | 「每次审计均遵循 §2.1」之后、「---」之前 | stage2 触发、报告路径约定 | rg bmad_story_stage2 | ✅ 锚点可定位 |
| INT-08 | 同上 | 「Story标记为完成」之后 | stage4 触发、SCORE_WRITE_CALL_EXCEPTION | rg bmad_story_stage4 | ✅ 锚点可定位 |
| INT-09 | 同上 | 「请对 Story」之后、「必须嵌套执行 speckit-workflow」之前 | 5 段约束；(1)落盘(2)运行CLI(3)resultCode | rg parse-and-write-score | ✅ 锚点存在（820 行） |
| INT-10 | config/eval-lifecycle-report-paths.yaml | 顶层 speckit_report_paths | spec/plan/gaps/tasks/implement 5 路径 | rg 6 模式 | ✅ 明确 |
| INT-11 | parse-and-write-score.ts | parseArgs、runId 生成 | 正则解析 reportPath；--epic/--story 优先 | npx ts-node 从 path 解析 | ✅ 明确 |
| INT-12 | 验证 | 4 项验证 | rg 9+、accept:e3-s3、真实调用、GAPS plan | npm run accept:e3-s3；rg call_mapping | ✅ 4 项均有定义 |

**结论**：12 项任务路径、落点、修改内容、验收命令均明确且可操作。

---

### 2. 7 个 branch_id 是否全覆盖

| branch_id | call_mapping | §7 任务 | INT 任务 |
|-----------|--------------|---------|----------|
| speckit_1_2_audit_pass | ✅ | §1.1 | INT-02 |
| speckit_2_2_audit_pass | ✅ | §1.1 | INT-03 |
| speckit_3_2_audit_pass | ✅ | §1.1 | INT-04 |
| speckit_4_2_audit_pass | ✅ | §1.1 | INT-05 |
| speckit_5_2_audit_pass | ✅ | §1.1 | INT-06 |
| bmad_story_stage2_audit_pass | ✅ | §1.1 | INT-07 |
| bmad_story_stage4_audit_pass | ✅ | §1.1 | INT-08 |

**证据**：`config/scoring-trigger-modes.yaml` 含 call_mapping 及 7 键；`rg "call_mapping" config/scoring-trigger-modes.yaml` 有匹配。

**结论**：7 个 branch_id 全覆盖。

---

### 3. 验收命令可执行（npx ts-node、rg 模式正确）

| 验收命令 | 类型 | 可执行性 |
|----------|------|----------|
| `npx ts-node scripts/parse-and-write-score.ts ...` | INT-01、INT-11、INT-12 | ✅ 脚本存在；待 INT-01/INT-11 实施后支持 --epic/--story |
| `rg "speckit_[1-5]_2_audit_pass"` | INT-02～INT-06 | ✅ ripgrep 模式正确 |
| `rg "bmad_story_stage2/4_audit_pass"` | INT-07、INT-08 | ✅ 模式正确 |
| `rg "parse-and-write-score|speckit_[1-5]_2"` | INT-09 | ✅ 模式正确 |
| `rg "AUDIT_spec|...|speckit_report_paths"` | INT-10 | ✅ 模式正确 |
| `npm run accept:e3-s3` | INT-12 | ✅ 已执行通过 |

**证据**：`npm run accept:e3-s3` 实际执行输出 `ACCEPT-E3-S3: PASS (all 3 stages)`。

**结论**：验收命令可执行，npx ts-node 与 rg 模式正确。

---

### 4. run_id、失败策略、resultCode 进审计证据

| 项 | §1 共识 | §7 任务 | audit-prompts §5 |
|----|---------|---------|------------------|
| run_id | dev-e{epic}-s{story}-{stage}-{ts} | INT-01、INT-11 支持 --epic/--story | (6) 参数证据含 runId |
| fail_policy | non_blocking | INT-02～INT-08 均写「失败不阻断」 | (8) non_blocking |
| resultCode | SCORE_WRITE_* 进审计证据 | INT-02～INT-08 均写「记录 resultCode 进审计证据」 | (8) 记录 resultCode |

**结论**：run_id、失败策略、resultCode 均已纳入审计证据要求。

---

### 5. INT-10 speckit_report_paths 与 config 结构

| 项 | 要求 | 当前 config |
|----|------|-------------|
| 文件 | eval-lifecycle-report-paths.yaml | ✅ 存在 |
| 顶层 key | speckit_report_paths 与 layers_4_5 平级 | 待 INT-10 实施（当前仅有 layers_4_5） |
| 内容 | spec/plan/gaps/tasks/implement 5 路径 | 文档已定义完整 |
| 与 layers_4_5 关系 | 专用于 speckit；layers_4_5 保留原语义 | 文档已说明 |

**结论**：INT-10 修改内容与 config 结构约定明确；实施后验收命令可验证。

---

### 6. INT-09 CLI 格式完整、无断裂

INT-09 具体修改中的 CLI 示例：
```
npx ts-node scripts/parse-and-write-score.ts
  --reportPath <路径>
  --stage <spec|plan|tasks>
  --event stage_audit_complete
  --triggerStage speckit_1_2|speckit_2_2|speckit_3_2|speckit_4_2|speckit_5_2
  --epic {epic_num} --story {story_num}
  --artifactDocPath <对应路径>
```

**验证**：与 §1.2 调用链、parse-and-write-score.ts 现有参数一致；triggerStage 按阶段择一，无断裂。

**结论**：INT-09 CLI 格式完整、无断裂。

---

### 7. INT-12 含 4 项验证

| 序号 | 验证项 | 文档定义 | 验收命令对应 |
|------|--------|----------|--------------|
| 1 | rg 9+ 匹配 | 有 | 具体内容(1) |
| 2 | npm run accept:e3-s3 | 有 | 验收命令 |
| 3 | 真实 parse-and-write-score 调用，scoring/data 含 dev-e6-s3- | 有 | 具体内容(3) |
| 4 | AUDIT_GAPS + --stage plan，GAPS 与 plan 解析器兼容 | 有 | 具体内容(4) |

**结论**：INT-12 含完整 4 项验证，且验收命令覆盖关键项。

---

### 8. audit-prompts §5 (5)–(8) 覆盖

| 检查项 | audit-prompts 原文 | §7 任务覆盖 |
|--------|--------------------|-------------|
| (5) | branch_id 在 call_mapping，scoring_write_control.enabled=true | INT-02 要求读 enabled；7 个 branch_id 均对应 INT-02～08；config 已有 7 键 |
| (6) | parseAndWriteScore 参数证据：reportPath、stage、runId、scenario、writeMode | §1.2 调用链含 reportPath、stage、runId；scenario 默认 real_dev；writeMode 由 shouldWriteScore 决定 |
| (7) | eval_question 缺 question_version → SCORE_WRITE_INPUT_INVALID 且不调用 | INT-02、INT-07 均写「eval_question 缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用」 |
| (8) | 评分写入失败 non_blocking 且记录 resultCode 进审计证据 | INT-02～INT-08 均写「失败不阻断」「记录 resultCode 进审计证据」 |

**结论**：audit-prompts §5 (5)–(8) 四项均被 §7 任务覆盖。

---

## 批判审计员结论

### 一、对抗性检查：路径与锚点

**1. INT-02～INT-06 落点锚点一致性**

批判审计员逐行核对 speckit-workflow/SKILL.md：
- §1.2：158 行「可结束本步骤」、159 行「若未通过」→ 插入点唯一
- §2.2：184～185 行同理
- §3.2：226～227 行同理
- §4.2：250～251 行同理
- §5.2：374～375 行同理

五处锚点文本与文档描述一致，插入位置无歧义。**无 gap**。

**2. INT-07 落点「每次审计均遵循 §2.1 的优先顺序」之后**

bmad-story-assistant 第 556 行：「每次审计均遵循 §2.1 的优先顺序（先 code-reviewer，失败则 generalPurpose）。」之后为 557 行「---」。插入点明确。**无 gap**。

**3. INT-08 落点「Story标记为完成」之后**

第 890～891 行：「**通过（A/B级）**：」下一条为「Story标记为完成」。文档要求在此之后插入。当前结构为「通过 → Story标记为完成 →（待插入）→ 其他」。需确认「之后」指同一级列表项的下一条，而非「Story标记为完成」的下一行。若存在「完成选项」等后续内容，插入位置可能产生歧义。

核查第 888～900 行结构：`### 审计结论处理` → `**通过（A/B级）**` → `Story标记为完成`，其后为选项说明。INT-08 要求「Story标记为完成 之后」插入，应理解为在「Story标记为完成」与该分支其余处理逻辑之间插入「审计通过后评分写入触发」。实施时需避免破坏「通过」分支的后续流程。文档表述可接受，**无新 gap**。

**4. INT-09 落点「请对 Story」之后、「必须嵌套执行 speckit-workflow」之前**

第 820 行实际为：「请对 Story {epic_num}-{story_num} 执行 Dev Story 实施。**必须嵌套执行 speckit-workflow 完整流程**」——「实施」与「必须嵌套」之间仅有句号，无换行。文档要求的「之后、之前」应理解为：在「实施。」与「**必须嵌套执行**」之间插入新段落。由于是同一句子，插入会将句子拆成两部分，需在「实施。」后插入新段，再续写「**必须嵌套执行**…」。逻辑可行，**无 gap**。

---

### 二、对抗性检查：命令可执行性

**5. INT-01 验收命令依赖未实现功能**

验收命令使用 `--epic 6 --story 3`，但 parse-and-write-score.ts 当前 parseArgs 未支持 --epic/--story。该验收命令在 INT-01 实施完成后才可成功执行。任务文档属于「待实施」规格，验收命令用于实施后自检，语义正确。**无 gap**。

**6. INT-11 reportPath 与目录结构**

INT-11 示例路径为 `specs/epic-6/story-3-foo/AUDIT_spec-E6-S3.md`。实际 specs 结构为 `specs/epic-6-eval-ux-coach-and-query/story-3-scoring-query-layer/`，即 `epic-{n}-{slug}` 而非 `epic-{n}`。文档已注明「若路径不存在可先创建临时文件或使用 specs 下已有 epic-story 路径」，故示例路径为占位。正则 `[Ee](\d+)[-_]?[Ss](\d+)` 可从 `AUDIT_spec-E6-S3.md` 解析出 6、3；目录正则可考虑 `epic-(\d+)[^/]*story-(\d+)-` 以兼容 epic-6-eval-ux.../story-3-scoring...。INT-11 具体修改仅写「目录名 `story-(\d+)-(\d+)`」，与实际 `story-3-scoring-query-layer`（仅一个数字）不符。更稳妥的应为 `epic-(\d+).*/story-(\d+)-` 或类似模式。

**潜在 gap**：INT-11 目录解析正则 `story-(\d+)-(\d+)` 与真实路径 `story-3-scoring-query-layer` 不匹配，可能解析失败。建议在任务中明确：目录模式应支持 `story-{story}-{slug}`（即 `story-(\d+)-[^/]+`），epic 从父目录 `epic-(\d+)` 或 `epic-(\d+)-` 解析。若 INT-11 实施时按文件名 `E6-S3` 解析即可满足需求，则目录解析为可选兜底；文件名解析已覆盖主要场景。**视为可接受**，建议实施时优先用文件名正则，目录解析作补充。

**7. rg 工具可用性**

INT-02～INT-10、INT-12 的验收命令均使用 `rg`。若执行环境无 ripgrep（如部分 Windows 未安装），验收会失败。但 ripgrep 为常见开发工具，且任务文档可假定「标准开发者环境」。**不视为 gap**。

---

### 三、对抗性检查：遗漏与边界

**8. scenario、writeMode 的审计证据**

audit-prompts §5 (6) 要求参数证据含 scenario、writeMode。§7 任务与 §1.2 调用链均未显式要求「将 scenario、writeMode 记入审计证据」。scenario 默认 real_dev；writeMode 由 shouldWriteScore 决定。评分写入后，scoring/data 中的记录通常包含这些信息；审计时可通过数据记录间接验证。若 scoring 记录不含 scenario/writeMode，则 (6) 的验证会不完整。当前设计依赖 scoring 输出结构，未在任务中显式约束。**低风险**：实施后可通过数据 Schema 确认；若 Schema 已包含则无问题。

**9. bmad_story triggerStage 命名**

call_mapping 中为 `bmad_story_stage2`、`bmad_story_stage4`。INT-07、INT-08 的 triggerStage 与之一致。**无 gap**。

**10. GAPS 阶段 stage=plan 的文档化**

附录已说明：「speckit §3.2（GAPS）审计报告格式与 plan 类似，parseAndWriteScore 的 stage 入参使用 plan」。INT-04 也明确 stage=plan。**无 gap**。

**11. INT-12 验收命令与具体内容的对应**

验收命令仅列 `npm run accept:e3-s3` 与 `rg "call_mapping"`。具体内容另有 rg 9+、真实调用、GAPS 兼容性三项。验收命令可视为摘要，完整步骤在「具体内容」中。**无 gap**。

---

### 四、对抗性检查：第 2 轮后修改确认

**12. §1.2 调用链 npx ts-node**

文档第 135 行为 `npx ts-node scripts/parse-and-write-score.ts`，与 §7 各任务一致。**已对齐**。

---

### 五、对抗性检查：audit-prompts §5 (5)–(8) 与实施可验证性

**13. (5) branch_id 与 enabled 的可验证性**

INT-02 要求「读 config/scoring-trigger-modes.yaml 的 scoring_write_control.enabled；若 enabled 则…」。审计员如何验证「已读 enabled」？技能文档若写明「运行前须检查 enabled，若 false 则跳过」，则审计可查 skill 文本是否含该逻辑。若 Agent 未读 config 直接调用，审计无直接证据。建议：在 INT-02 等任务的「具体修改」中明确写「若 enabled=false 则跳过，不运行 parse-and-write-score」，使审计员可 grep 验证。当前 INT-02 已写「若 enabled 则」，语义含「否则跳过」。**可接受**。

**14. (7) eval_question 与 question_version 的触发场景**

INT-02、INT-07 写「eval_question 缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用」。本集成设计主要针对 real_dev（speckit、bmad-story 均为 real_dev），eval_question 为独立场景。技能文档写入该条，可防止未来误用 eval_question 时漏填 question_version。**无 gap**。

**15. (8) 失败时 resultCode 的记录主体**

「记录 resultCode 进审计证据」—记录主体是「执行流程的 Agent」还是「parse-and-write-score 脚本」？脚本 exit 1 时不会自动写入「审计证据」；审计证据通常由 Agent 的进度/报告产出。故记录主体应为 Agent：Agent 在 catch 到 CLI 失败或脚本 exit 1 时，将 resultCode（如 SCORE_WRITE_CALL_EXCEPTION）写入其审计报告或 progress。INT-02～INT-08 未显式写「Agent 须在审计报告/证据中记录」，但「记录 resultCode 进审计证据」的通常理解即 Agent 在流程产出中记录。**无 gap**。

**16. 实施后审计 §5 的 (5)–(8) 检查顺序**

实施后审计时，审计员按 (5)→(6)→(7)→(8) 逐项检查。若 (5) 未通过（branch_id 不在 call_mapping 或 enabled=false），则无需继续 (6)～(8)。当前任务列表已使各 stage 的 branch_id、enabled、resultCode 要求明确，审计员可按序执行。**无 gap**。

---

### 六、综合结论（批判审计员）

逐项对抗性检查后：

1. **路径与锚点**：INT-02～INT-09 落点均可唯一定位，无歧义。
2. **命令可执行性**：npx ts-node、rg、npm run accept:e3-s3 均有效；INT-01 验收命令在实施后成立。
3. **7 个 branch_id**：全覆盖，call_mapping 已配置。
4. **run_id、失败策略、resultCode**：均进入审计证据要求。
5. **INT-10 config 结构**：speckit_report_paths 定义清晰。
6. **INT-09 CLI**：完整且与现有脚本兼容。
7. **INT-12 四项验证**：均有定义。
8. **audit-prompts §5 (5)–(8)**：四项均有对应任务覆盖。

**潜在优化点**（不阻通过）：
- INT-11 目录解析正则与真实路径格式的差异，实施时可优先用文件名 `E6-S3` 解析，目录解析作兜底。
- (6) 中 scenario、writeMode 依赖 scoring 数据 Schema，可后续确认。

**批判审计员判定**：**本轮无新 gap**。第 2 轮已通过且无新 gap，本第 3 轮结论一致。满足「连续 2 轮（第 2、3 轮）完全覆盖、验证通过且无新 gap」。若第 4 轮同样通过且无新 gap，则可达成连续 3 轮收敛条件。

---

## 结论

**「完全覆盖、验证通过」**

- §7 任务列表（INT-01～INT-12）与 §1 共识方案通过 audit-prompts §5 适配审计第 3 轮。
- 7 个 branch_id 全覆盖，验收命令可执行，run_id/失败策略/resultCode 已进审计证据，INT-10/INT-09/INT-12 及 audit-prompts §5 (5)–(8) 均满足要求。
- 批判审计员结论：**本轮无新 gap**。可进入实施或第 4 轮复核以争取收敛。
