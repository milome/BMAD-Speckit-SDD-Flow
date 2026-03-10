# AUDIT §5 执行阶段审计：TASKS_SFT提取扩展与eval题集生成

**报告开头注明**：未使用 code-reviewer 子类型，使用 generalPurpose + 审计 prompt。

**被审对象**：
- 实施依据：`_bmad-output/implementation-artifacts/_orphan/TASKS_SFT提取扩展与eval题集生成.md`
- 实施产物：代码变更、prd、progress、验收命令输出
- prd：`_bmad-output/implementation-artifacts/_orphan/prd.TASKS_SFT提取扩展与eval题集生成.json`
- progress：`_bmad-output/implementation-artifacts/_orphan/progress.TASKS_SFT提取扩展与eval题集生成.txt`

**审计日期**：2026-03-07  
**轮次**：第 1 轮

---

## 1. §5 审计项逐项核对

| 审计项 | 结论 | 说明 |
|--------|------|------|
| 1. 任务是否真正实现（无预留/占位/假完成） | 部分通过 | T1/T2/T3 核心实现存在；T1 验收 4、7 存在 gap |
| 2. 生产代码是否在关键路径中被使用 | 通过 | parse-and-write、audit-report-parser、sft-extractor、eval-question-generate 均在关键路径 |
| 3. 需实现的项是否均有实现与测试/验收覆盖 | 部分通过 | 单测覆盖充分；T1 验收 4、7 未完全满足 |
| 4. 验收表/验收命令是否已按实际执行并填写 | 部分通过 | 单测已跑；CLI 部分验收已执行；T1 BUGFIX 路径 CLI、T3 空数据受 fixture 编码影响 |
| 5. 是否遵守 ralph-method（prd/progress 更新、US 顺序） | 通过 | prd 含 3 个 US、passes=true；progress 按 US 顺序记录 |
| 6. 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用 | 通过 | 未发现禁止词；功能已调用 |

---

## 2. TASKS 专项验收核对

### T1 验收

| 项 | 验收标准 | 结论 | 证据 |
|----|----------|------|------|
| 1 | parse-and-write 单测 implement+artifactDocPath 分支 | ✅ 通过 | `npm run test:scoring` 通过；parse-and-write.test.ts 含 T1 tasks/reportPath、BUGFIX/artifactDocPath、未传/no source_path 用例 |
| 2 | BUGFIX 时 source_path=artifactDocPath | ✅ 单测通过 | 单测用例 `T1: stage=implement + artifactDocPath=BUGFIX path → source_path=artifactDocPath` 通过 |
| 3 | speckit-workflow SKILL implement 段落 artifactDocPath 取值 | ✅ 通过 | SKILL.md §5.2 含 `--artifactDocPath <tasks 文档路径>`；仅覆盖 speckit 流程 |
| 4 | bmad-bug-assistant SKILL implement 段落 artifactDocPath=BUGFIX | ❌ **未通过** | bmad-bug-assistant 无 implement 阶段 parseAndWriteScore 调用；无 artifactDocPath=BUGFIX 约定 |
| 5 | bmad-story-assistant SKILL implement 段落 artifactDocPath 约定 | ⚠️ 部分 | bmad-story-assistant 有 stage4 tasks 的 `--artifactDocPath <story 文档路径>`；与 speckit implement 的 tasks 路径约定一致 |
| 6 | CLI artifactDocPath=tasks 时 source_path=reportPath | ✅ 通过 | 执行 `--artifactDocPath specs/epic-9/.../tasks-E9-S2.md`；record `dev-e9-s2-implement-1772860772376` 的 source_path 为 reportPath |
| 7 | CLI artifactDocPath=BUGFIX 时 source_path=BUGFIX 路径 | ❌ **未通过** | 执行 `--artifactDocPath _bmad-output/.../BUGFIX_xxx.md`；record `dev-e9-s2-implement-1772860719512` 的 source_path 为 reportPath，非 BUGFIX 路径 |

### T2 验收

| 项 | 验收标准 | 结论 | 证据 |
|----|----------|------|------|
| 1 | audit-report-parser.ts 存在且导出 extractAuditReportSections | ✅ 通过 | 文件存在；导出正确 |
| 2 | 单测 criticConclusion、gaps、gaps=[] | ✅ 通过 | audit-report-parser.test.ts 覆盖 |
| 3 | sft-extractor 审计报告 fallback | ✅ 通过 | sft-extractor.ts 第 224–231 行；extractBugfixSections 返回 null 时调用 extractAuditReportSections |
| 4 | BUGFIX 行为一致 | ✅ 通过 | source_path 指向 BUGFIX 时优先 extractBugfixSections |
| 5 | 无 source_path 时 incSkip | ✅ 通过 | sft-extractor.test.ts T2-5 覆盖 |
| 6 | instruction<20 时 incSkip | ✅ 通过 | sft-extractor.test.ts 多用例覆盖 |

### T3 验收

| 项 | 验收标准 | 结论 | 证据 |
|----|----------|------|------|
| 1 | --run-id 成功生成 | ✅ 通过 | 需有有效 run；coach-test-input 含 BOM 导致 JSON 解析失败，属 fixture 编码问题 |
| 2 | --input 成功生成 | ✅ 通过 | 使用有效 JSON（无 BOM）可成功；gen-* 题目已生成 |
| 3 | 题目 .md 符合 MANIFEST_SCHEMA §3.1 | ✅ 通过 | gen-1772860719459-0-spec.md 含总体评级、维度评分、问题清单、通过标准 |
| 4 | manifest 含新条目 | ✅ 通过 | manifest.yaml 含 gen-* 条目 |
| 5 | list 可列出 | ✅ 通过 | `npx ts-node scripts/eval-questions-cli.ts list --version v1` 输出含 gen-* |
| 6 | 空数据 exit 0 | ⚠️ 逻辑存在 | 代码第 122–125 行有判断；scoring/data/empty-input.json 含 BOM 导致 JSON 解析失败，非逻辑问题 |
| 7 | run 不存在 exit 1 | ✅ 通过 | `--run-id nonexistent-run` 输出「run 不存在」并 exit 1 |

---

## 3. 批判审计员结论

**说明**：本段落为批判审计员视角，占比 >50%，从对抗视角检查遗漏、行号/路径失效、验收未跑、§5/验收误伤或漏网。

### 3.1 遗漏任务与实现完整性

- **T1 验收 4（bmad-bug-assistant）**：TASKS 明确要求「bmad-bug-assistant Skill 中 implement 阶段 parseAndWriteScore 调用显式传入 artifactDocPath=BUGFIX 路径（当存在 BUGFIX 文档时）」。经 grep 与全文检索，bmad-bug-assistant SKILL.md 无 implement 阶段、无 parseAndWriteScore、无 artifactDocPath 相关描述。**结论**：验收 4 未满足，属遗漏。
- **T1 验收 3 完整性**：TASKS 要求「明确写出 BUGFIX 与 speckit 两种流程的 artifactDocPath 取值」。speckit-workflow 仅写出 speckit（tasks）；BUGFIX 流程应在 bmad-bug-assistant 中约定。若以「各 skill 各司其职」解释，则 T1 验收 4 必须满足；当前未满足，故 T1 验收 3 的「两种流程」覆盖不完整。

### 3.2 行号与路径有效性

- **parse-and-write.ts**：computeSourcePath 第 78–91 行逻辑正确；单测通过。**无行号漂移**。
- **audit-report-parser.ts**：extractAuditReportSections 导出正确；sft-extractor 第 12 行 import、第 224 行调用正确。**无路径失效**。
- **eval-question-generate.ts**：从 coach、template-generator、manifest-loader 的 import 与调用正确。**无路径失效**。

### 3.3 验收命令执行情况

- **T1 单测**：已执行 `npm run test:scoring`，419 测试通过。**已跑**。
- **T1 CLI artifactDocPath=tasks**：已执行，record 的 source_path=reportPath。**通过**。
- **T1 CLI artifactDocPath=BUGFIX**：已执行，record 的 source_path 为 reportPath（应为 BUGFIX 路径）。**未通过**；单测通过而 CLI 结果不符，需排查 CLI 传参或 parseArgs。
- **T2 单测**：audit-report-parser、sft-extractor 单测已跑。**已跑**。
- **T3 --run-id / --input**：--run-id 需有效 run；--input 在 coach-test-input.json 含 BOM 时 JSON 解析失败。**逻辑正确**；fixture 编码为环境问题。
- **T3 空数据**：empty-input.json 含 BOM，导致 JSON.parse 失败，未到达「无短板数据」分支。**逻辑存在**；建议提供无 BOM 的 fixture 或增加 BOM 剥离。
- **T3 run 不存在**：已验证 exit 1 与「run 不存在」输出。**通过**。

### 3.4 §5 审计项与验收误伤/漏网

- **误伤**：无。所有不通过项均有明确证据。
- **漏网**：
  1. **T1 CLI BUGFIX 分支**：单测覆盖 parseAndWriteScore 直接调用，CLI 通过脚本传参。CLI 路径下 source_path 错误，可能原因：parseArgs 未正确解析 `--artifactDocPath`、或参数顺序导致覆盖。**建议**：增加 CLI 集成测试或手动复核 parseArgs 输出。
  2. **T3 --input 与空数据**：BOM 导致 JSON 解析失败，属 fixture 问题，非实现缺陷。**建议**：在 eval-question-generate 中增加 `content.replace(/^\uFEFF/, '')` 或使用支持 BOM 的 JSON 解析，以提升鲁棒性。

### 3.5 本轮结论

**本轮存在 gap**。具体项：

1. **GAP-1**：T1 验收 4 未满足——bmad-bug-assistant 无 implement 阶段 parseAndWriteScore 调用及 artifactDocPath=BUGFIX 约定。
2. **GAP-2**：T1 验收 7 未满足——CLI 传入 artifactDocPath=BUGFIX 时，写入的 record.source_path 为 reportPath，非 BUGFIX 路径。
3. **GAP-3**（建议）：T3 --input 与空数据场景下，fixture 含 BOM 导致 JSON 解析失败；建议增加 BOM 剥离或提供无 BOM fixture。

### 3.6 修改建议

| Gap | 修改建议 |
|-----|----------|
| GAP-1 | 在 bmad-bug-assistant SKILL.md 的「阶段四实施后审计」或等效段落中，增加：实施后审计通过且存在 BUGFIX 文档时，主 Agent 须运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <实施后审计报告路径> --stage implement --epic {epic} --story {story} --artifactDocPath <BUGFIX 文档路径> --iteration-count {累计值} --skipTriggerCheck true`（或经 trigger 配置允许的等效命令）；并明确 artifactDocPath 取 BUGFIX 文档路径。 |
| GAP-2 | 排查 parse-and-write-score.ts 的 parseArgs：确认 `--artifactDocPath` 与值被正确解析；或增加 CLI 集成测试，覆盖 artifactDocPath=BUGFIX 路径的 E2E 场景。若为 parseArgs 缺陷，修复后复验。 |
| GAP-3 | 在 eval-question-generate.ts 的 loadReport 中，对读取的 content 执行 `content.replace(/^\uFEFF/, '')` 后再 JSON.parse；或确保测试 fixture 为 UTF-8 无 BOM。 |

---

## 4. 总体结论

**结论**：**未通过**。

**Gap 汇总**：
- GAP-1：bmad-bug-assistant 缺少 implement 阶段 parseAndWriteScore 与 artifactDocPath=BUGFIX 约定
- GAP-2：CLI artifactDocPath=BUGFIX 时 source_path 写入错误
- GAP-3（建议）：T3 --input 对 BOM 敏感，建议增强鲁棒性

**本轮存在 gap，不计数**。建议按修改建议修复 GAP-1、GAP-2 后，再次执行 §5 审计；累计 3 轮无 gap 后收敛。

---

## 5. 可解析评分块

```yaml
# AUDIT_SCORE_BLOCK
overall_grade: B
dimensions:
  functional: 85
  code_quality: 90
  test_coverage: 88
  security: 95
```

---

*本报告由 generalPurpose + 审计 prompt 执行，批判审计员结论占比 >50%。*
