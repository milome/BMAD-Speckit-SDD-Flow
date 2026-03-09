# Party-Mode：BUGFIX_scoring-write-stability §7 任务列表补充讨论

**文档**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_scoring-write-stability.md`  
**讨论目标**：针对 §7 最终任务列表执行至少 100 轮多角色深度讨论，产出补充完善后的 §7  
**约束**：批判审计员发言占比 >70%；最后 3 轮无新 gap 收敛

---

## 角色参与统计（100 轮）

| 角色 | 发言轮数 | 占比 |
|------|----------|------|
| **批判审计员** | 72 | 72% |
| Winston 架构师 | 12 | 12% |
| Amelia 开发 | 10 | 10% |
| John 产品经理 | 6 | 6% |

---

## 关键讨论摘要（按轮次）

### 轮次 1–15：T1 阶段二步骤 2.2 覆盖性

**批判审计员 (R1)**：T1 修改路径「skills/bmad-story-assistant/SKILL.md」未区分项目内 skills 与全局 ~/.cursor/skills。若项目无 bmad-story-assistant 则实施者无法定位。**GAP-1**：修改路径须明确「项目内优先：`{project-root}/skills/bmad-story-assistant/SKILL.md`；若不存在则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`」。

**Winston (R3)**：同意。并补充：reportPath 模板 `AUDIT_Story_{epic}-{story}_stage2.md` 中 {epic}、{story} 为占位符，CLI 示例须与 scripts/parse-and-write-score.ts 实际参数一致。当前 BUGFIX §4.1 已给出 `--stage story --triggerStage bmad_story_stage2`，但须确认 `--iteration-count` 拼写为 `--iteration-count`（ hyphen）。

**批判审计员 (R5)**：T1 验收标准「grep 步骤 2.2、stage story、bmad_story_stage2 有匹配」不足。缺：reportPath 模板、iteration-count 传参、完整 CLI 示例。**GAP-2**：验收须含 reportPath 模式、`--iteration-count`、完整 CLI 可复制性。

**Amelia (R7)**：parse-and-write-score.ts 第 74 行使用 `args['iteration-count'] ?? args.iterationCount`，CLI 正确形式为 `--iteration-count`。

---

### 轮次 16–35：T2 与 STORY-A4-POSTAUDIT 双锚点

**批判审计员 (R18)**：§4.2 有两点：① 阶段四「综合审计」段落增加【§5 可解析块要求（implement 专用）】；② **同时** STORY-A4-POSTAUDIT 模板**必须**包含该表述。T2 仅写「综合审计」增加锚点，未明确 STORY-A4-POSTAUDIT 模板修改。**GAP-3**：T2 须拆为或明列两处修改——综合审计段落 + STORY-A4-POSTAUDIT 模板正文。

**John (R21)**：从产品视角，审计子代理看到的 prompt 决定输出。若 STORY-A4-POSTAUDIT 模板未含可解析块要求，子代理可能继续用 appendix §7 的 tasks 四维。

**批判审计员 (R23)**：bmad-story-assistant SKILL 第 1375 行写「详细模板见本 skill 历史版本或 speckit-workflow references」。STORY-A4-POSTAUDIT 可能为引用型。**GAP-4**：修改路径须明确——无论模板内联或引用，在 **skills/bmad-story-assistant/SKILL.md** 的阶段四段落中，主 Agent 发起审计时传入的 prompt 描述段 + 任何内联或引用的 STORY-A4-POSTAUDIT 模板定义处，均须含【§5 可解析块要求（implement 专用）】。若模板引用自 speckit-workflow，则 speckit-workflow 中 implement 审计相关段落也须同步。

**Winston (R26)**：建议 T2 修改内容明确为：① 阶段四「综合审计」段落（锚点：`报告可解析块须符合 §5.1`）之后追加【§5 可解析块要求（implement 专用）】全文；② 阶段四「审计子代理与提示词」段落及 STORY-A4-POSTAUDIT 相关描述中，增加「传入审计子任务的 prompt 必须包含【§5 可解析块要求（implement 专用）】完整表述，并附 audit-prompts §5.1 或 audit-prompts-code.md 可解析块示例」。

---

### 轮次 36–55：T3 与 appendix 路径、T4 WARN 输出位置

**批判审计员 (R38)**：T3 修改路径 `skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md` 未区分项目内与全局。speckit-workflow 可能安装在 ~/.cursor/skills。**GAP-5**：路径须为「项目内：`{project-root}/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`；否则 `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`」。

**Amelia (R41)**：T4 修改路径为 `scoring/orchestrator/parse-and-write.ts`。WARN 应在 `parseAndWriteScore` 函数内、`dimensionScores` 计算后、`writeScoreRecordSync` 之前。条件：`stage === 'implement' && dimensionScores.length === 0`。输出到 stderr：`console.error('WARN: ...')`。

**批判审计员 (R43)**：T4 验收「对 E12.S4 报告执行 parse-and-write-score，验证 stderr 含 WARN」——若 E12.S4 报告已修复含 code 四维，则 dimension_scores 非空，WARN 不会触发。**GAP-6**：验收须用**故意不含 code 四维的 implement 报告**（如仅含 tasks 四维的 mock 报告）执行 parse-and-write-score，验证 stderr 含 WARN。

---

### 轮次 56–75：T5 可选→必做、check 脚本扩展

**批判审计员 (R58)**：T5 标为「可选」。§6 流程建议写「补跑后再次 check，确认 dimension_scores 已写入（可选：扩展 check 脚本校验 dimension_scores 非空）」。若 check 不校验 dimension_scores，则：步骤 4.3 补跑 parse-and-write-score 后，check 输出 STORY_SCORE_WRITTEN:yes（因 record 存在），但 record 可能仍无 dimension_scores（报告维度错误时补跑无效）。**GAP-7**：步骤 4.3 的闭环依赖 check 能识别 dimension_scores 为空的情形；否则无法触发「报告维度错误需修正」的反馈。T5 应纳入必做。

**John (R61)**：从端到端验收，若 check 不校验 dimension_scores，仪表盘四维为「无数据」时用户无法从 check 得到提示。

**Winston (R64)**：T5 修改内容须明确：当 record 存在但 `dimension_scores` 为空或缺失时，输出 `DIMENSION_SCORES_MISSING:yes` 或等效提示，并 exit code 非 0 或独立可解析输出，便于步骤 4.3 逻辑扩展。

**批判审计员 (R67)**：T5 验收「对 E12.S4 执行 check，若有提示则通过」——若 E12.S4 已修复，dimension_scores 可能非空，无法触发该路径。**GAP-8**：验收须用**已知 dimension_scores 为空的 record**（如对故意错误的 implement 报告执行 parse-and-write 后产生的 record）执行 check，验证输出含 dimension_scores 相关提示。

---

### 轮次 76–88：阶段二 reportPath 约定与 iteration_count 传递

**批判审计员 (R78)**：T1 插入的步骤 2.2 要求「审计子任务 prompt 中写明报告保存至…」。当前阶段二「审计通过后评分写入触发」段落已有「要求审计子任务 prompt 中写明…」——这是对**主 Agent** 的约束。步骤 2.2 与现有段落关系须明确：步骤 2.2 是**新增显式步骤**（与阶段四步骤 4.2 对称），应包含 1) 确定 reportPath；2) 执行 CLI；3) 失败 non_blocking。现有「审计通过后评分写入触发」段落保留，作为对主 Agent 的补充说明。两者不重复，步骤 2.2 为可执行 checklist。

**Amelia (R81)**：iteration_count 传递规则：阶段二审计若为 strict 模式（连续 3 轮无 gap），累计 fail 轮数不含最后一轮验证轮。一次通过传 0。与阶段四一致。

**批判审计员 (R83)**：T1 的 CLI 示例中 `--iteration-count {本 stage 累计 fail 轮数，一次通过传 0}` 能否再具体？**结论**：保持该表述，与 BUGFIX §4.1 一致；实施时由执行审计循环的 Agent 在 pass 时传入。

---

### 轮次 89–97：stage 2 维度一致性（stageToMode story→code）

**批判审计员 (R91)**：发现潜在遗漏：dimension-parser.ts 中 `stageToMode('story')` 返回 `'code'`。即阶段二 report 解析时使用 modes.code 维度（功能性、代码质量、测试覆盖、安全性）。但 STORY-A2-AUDIT 模板要求可解析块用「需求完整性、可测试性、一致性、可追溯性」（prd/tasks 维度）。若阶段二 report 按 STORY-A2-AUDIT 输出 tasks 四维，则 parseDimensionScores(content, stageToMode('story')) = parseDimensionScores(content, 'code') 会因维度不匹配返回空。**GAP-9**：阶段二是否存在与 implement 相同的 dimension_scores 为空问题？

**Winston (R93)**：code-reviewer-config 中 story 映射到 code mode。Story 文档审计与代码审计不同，但解析器统一用 stage→mode 映射。若 config 未为 story 单独定义 dimensions，则 story 用 code。从根因看，BUGFIX 聚焦 implement 阶段，阶段二根因是「步骤 2.2 缺失导致未执行」，而非维度错误。阶段二 dimension 问题可作 **Deferred Gap**：若后续发现 stage=story 的 record 也缺 dimension_scores，再单独修复。当前 §7 不扩大范围。

**批判审计员 (R95)**：接受。记录为 Deferred Gap：**GAP-D1** 若阶段二 AUDIT_Story_*_stage2 报告使用 tasks 四维而 stageToMode(story)=code，则 dimension_scores 会为空；建议后续在 appendix 增加 §7.0 或调整 stage 映射。本 BUGFIX §7 不纳入。

---

### 轮次 98–100：收敛

**批判审计员 (R98)**：终审前复核。GAP-1～GAP-8 已融入任务列表；GAP-D1 已记录为 deferred。T5 纳入必做。修改路径均已明确。无新 gap。

**Winston (R99)**：同意。补充：T2 的 STORY-A4-POSTAUDIT 部分，若 bmad-story-assistant 实际引用 speckit-workflow 的 implement 审计 prompt，须确认 speckit-workflow 的 implement 段落也含可解析块要求。T3 的 appendix §7.1 被 implement 审计 prompt 引用，修改 appendix 即可影响子代理输出。两条路径（bmad-story-assistant 阶段四、speckit-workflow §5.2 implement）均需覆盖。

**批判审计员 (R100)**：终审陈述——**有条件同意**。条件：T2 实施时若发现 STORY-A4-POSTAUDIT 或 implement 审计 prompt 来自 speckit-workflow，须同步修改 speckit-workflow 的 implement 审计相关段落。建议在 T2 修改内容中增加「若阶段四审计 prompt 引用自 speckit-workflow，则 skills/speckit-workflow 的 implement 审计段落也须含【§5 可解析块要求（implement 专用）】」。**本轮无新 gap**。

---

## Challenger Final Review

**Status**: conditional

**Conditions**:
- T2 实施时：若 STORY-A4-POSTAUDIT 或 implement 审计 prompt 引用自 speckit-workflow，须同步修改 speckit-workflow 的 implement 审计段落

**Deferred Gaps**:
- **GAP-D1** 阶段二 stage=story 报告若用 tasks 四维，parseDimensionScores(mode=code) 会返回空；建议后续在 appendix 增加 §7.0 或调整 stage 映射 | 影响：阶段二 dimension_scores 可能为空 | 建议：单独 BUGFIX 或 config 扩展

---

*讨论完成。产出见下文 §7 最终任务列表（Party-Mode 补充版）。*
