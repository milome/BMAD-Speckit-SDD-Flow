# plan-E6-S5：bmad-eval-analytics Skill 实现方案

**Epic**：E6 eval-ux-coach-and-query  
**Story ID**：6.5  
**输入**：`spec-E6-S5.md`、Story 6.5、`prd.eval-ux-last-mile.md` §5.1、`scripts/coach-diagnose.ts`

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1 REQ-UX-1.7 | spec §3.1, §3.2 | Phase 1, §3 | ✅ |
| Story §1 REQ-UX-1.7 | spec §3.3, §3.4 | §4（复用 coach-diagnose） | ✅ |
| Story §3.1(1)-(4) | spec §3.2 | Phase 1 | ✅ |
| Story §4 AC-1～AC-3 | spec §3.5 | Phase 2, §5 | ✅ |

---

## 2. 目标与约束

- 新建 `skills/bmad-eval-analytics/SKILL.md`。
- 当用户说「帮我看看短板」「最近一轮的 Coach 报告」等短语时，Skill 指引 Agent 执行 `npx ts-node scripts/coach-diagnose.ts`（与 /bmad-coach 共用逻辑）。
- 不新建 discovery 或 coach 逻辑；全部复用现有 `scripts/coach-diagnose.ts`。

---

## 3. 实施分期

### Phase 1：新建 Skill 文档

1. 新建 `skills/bmad-eval-analytics/SKILL.md`：
   - `description`：说明本 Skill 用于通过自然语言触发 Coach 诊断。
   - `when to use`：明确列出触发短语，如「帮我看看短板」「最近一轮的 Coach 报告」「诊断一下」「看看评分短板」。
   - 指引内容：当用户说出上述短语时，Agent 应执行 `npx ts-node scripts/coach-diagnose.ts` 获取 Coach 诊断输出；无 `--run-id` 时脚本内部调用 discoverLatestRunId 取 timestamp 最近一轮。

### Phase 2：验收

1. 验证 `npx ts-node scripts/coach-diagnose.ts` 可执行（有数据时输出诊断，无数据时输出「暂无评分数据...」）。
2. 验收方式：在 Cursor 中加载本 Skill 后，说「帮我看看短板」或「最近一轮的 Coach 报告」，Agent 应执行 coach-diagnose 并展示输出。

---

## 4. 模块与文件改动设计

### 4.1 新增文件

| 文件 | 责任 | 对应需求 |
|------|------|----------|
| `skills/bmad-eval-analytics/SKILL.md` | Skill 定义、触发短语、执行指引 | spec §3.1, §3.2, §3.5 |

### 4.2 修改文件

无。本 Story 不修改 coach-diagnose 或 scoring/coach。

### 4.3 复用关系

| 复用项 | 路径 | 说明 |
|--------|------|------|
| discoverLatestRunId | 经 coach-diagnose 间接调用 | 无参时内部 discovery 最新 run_id |
| coachDiagnose | 经 coach-diagnose 间接调用 | 输出诊断报告 |

---

## 5. 验收命令

| 场景 | 命令/操作 | 预期 |
|------|-----------|------|
| 底层可执行 | `npx ts-node scripts/coach-diagnose.ts` | 有数据时输出 Markdown 诊断；无数据时「暂无评分数据...」 |
| 自然语言触发 | 在 Cursor 中说「帮我看看短板」 | Agent 执行 coach-diagnose 并展示诊断 |
| 最近一轮 | 在 Cursor 中说「最近一轮的 Coach 报告」 | 同上；以 timestamp 最近为准 |

---

## 6. 执行准入标准

- 生成 tasks-E6-S5.md 后，所有任务须具备明确文件路径与验收命令。
- Skill 文档无禁止词（可选、待后续、待定等）。
- 通过验收命令验证。
