# Story 3.3 协同点文档

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.3

---

## 1. 调用时机

在 speckit-workflow 的审计闭环中，各 stage 完成且审计报告产出后，可触发「解析并写入」：

| speckit 阶段 | 审计完成时机 | 调用 parseAndWriteScore 时机 |
|-------------|-------------|----------------------------|
| §1.2 spec 审计通过 | spec 审计报告产出 | spec 审计通过后（若有报告） |
| §2.2 plan 审计通过 | plan 审计报告产出 | plan 审计通过后（若有报告） |
| §3.2 GAPS 审计通过 | GAPS 审计报告产出 | 通常无单独报告，可跳过 |
| §4.2 tasks 审计通过 | tasks 审计报告产出 | 通常无单独报告，可跳过 |
| §5.2 执行后审计通过 | 实施后审计报告产出 | 实施后审计通过后 |

**注意**：prd/arch/story 审计报告由 code-reviewer 或 bmad 工作流产出，路径见 config/eval-lifecycle-report-paths.yaml。

---

## 2. 入参约定

| 参数 | 类型 | 说明 | 来源 |
|------|------|------|------|
| reportPath | string? | 审计报告文件路径 | 工作流或从 epic、story、slug 解析 |
| content | string? | 报告内容（与 reportPath 二选一） | 工作流读取后传入 |
| stage | 'prd' \| 'arch' \| 'story' | 审计阶段 | 当前执行的 stage |
| runId | string | 运行 ID，用于写入文件名 | 工作流生成，如 `run-{timestamp}` |
| scenario | 'real_dev' \| 'eval_question' | 场景 | 工作流上下文 |
| writeMode | 'single_file' \| 'jsonl' \| 'both' | 写入模式 | 见 config/scoring-trigger-modes.yaml |
| dataPath | string? | 写入目录，默认 scoring/data | 可选覆盖 |

---

## 3. 报告路径公式

- **story 阶段**：`_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`
- 可由 epic、story、slug 解析：
  - `implementation-artifacts/${epic}-${story}-${slug}/AUDIT_Story_${epic}-${story}.md`

---

## 4. 可调用入口

| 入口 | 路径 | 用途 |
|------|------|------|
| 导出函数 | scoring/orchestrator/parse-and-write.ts | import { parseAndWriteScore } from './scoring/orchestrator' |
| CLI 脚本 | scripts/parse-and-write-score.ts | 接收命令行参数 |
| 验收脚本 | scripts/accept-e3-s3.ts | npm run accept:e3-s3 |

---

## 5. 与 bmad-story-assistant 协同

bmad-story-assistant 在执行 Dev Story 实施后审计（STORY-A4-POSTAUDIT）时，可调用 parseAndWriteScore 将实施后审计报告解析并写入 scoring 存储，完成「审计→解析→写入」闭环。
