<!-- AUDIT: PASSED by code-reviewer -->

# plan-E4-S2：eval-ai-coach 实现方案

**Epic**：E4 feature-eval-coach-veto-integration  
**Story ID**：4.2  
**输入**：spec-E4-S2.md、Story 4-2

---

## 1. 目标与约束

- 实现 AI 代码教练模块：输入 run_id，输出综合诊断报告（含 summary、phase_scores、weak_areas、recommendations、iteration_passed）。
- 消费 Story 4.1 的 applyTierAndVeto、evaluateEpicVeto；消费 scoring 存储（RunScoreRecord）。
- 支持 fallback：全链路 Skill 不可用时，仅解读既有 scoring 数据。
- 与 scoring/veto 无循环依赖；教练单向依赖 veto。

---

## 2. 模块设计

### 2.1 实现路径

**主模块**：`scoring/coach/`

**目录结构**：
```
scoring/
  coach/
    index.ts         # 导出 coachDiagnose、CoachDiagnosisReport、formatToMarkdown
    diagnose.ts     # coachDiagnose 核心逻辑
    loader.ts       # loadRunRecords(runId) 从 scoring 存储加载
    forbidden.ts    # 禁止词校验、禁止词表加载
    format.ts       # formatToMarkdown(report) 将 report 转为 Markdown 文本
    types.ts        # CoachDiagnosisReport、CoachDiagnoseOptions
    config.yaml     # 或引用 config/coach-trigger.yaml
```

**可选 Skill 位置**：`_bmad/skills/bmad-ai-coach/`（若需独立 Skill 定义）；本 Story 以 scoring/coach 为核心实现。

### 2.2 依赖关系

```
scoring/coach
  ├── scoring/veto (applyTierAndVeto, evaluateEpicVeto)
  ├── scoring/writer/types (RunScoreRecord, CheckItem, IterationRecord)
  ├── scoring/writer (路径、读文件；无 write 依赖)
  └── fs/path (Node 内置)
```

**禁止**：coach 不依赖 scoring/parsers、scoring/orchestrator（避免循环）；veto 不依赖 coach。

---

## 3. 核心 API 设计

### 3.1 主入口

| 函数 | 签名 | 职责 |
|------|------|------|
| coachDiagnose | `(runId: string, options?: CoachDiagnoseOptions) => Promise<CoachDiagnosisReport \| { error: string }>` | 加载 run_id 数据；调用 veto；输出诊断；run_id 不存在时返回 `{ error: 'run_not_found' }` 或抛错（实现时二选一并在文档约定） |

**CoachDiagnosisReport**：
```ts
interface CoachDiagnosisReport {
  summary: string;
  phase_scores: Record<string, number>;  // stage -> score
  weak_areas: string[];
  recommendations: string[];
  iteration_passed: boolean;
}
```

**输出格式**：支持 JSON 与 Markdown（与 spec §2.5 一致）。默认 JSON；CLI 通过 `--format=markdown` 输出 Markdown。`formatToMarkdown(report)` 将 report 转为可读 Markdown 文本。

### 3.2 数据加载

| 函数 | 签名 | 职责 |
|------|------|------|
| loadRunRecords | `(runId: string, dataPath?: string) => RunScoreRecord[]` | 从 scoring/data 加载：先读 `{runId}.json`；若不存在则读 scores.jsonl 过滤 run_id；返回按 stage 排序的记录数组 |

**存储约定**：single_file 模式下同一 run_id 多次写入覆盖；jsonl 模式保留多记录。loader 兼容两种格式。

### 3.3 禁止词校验

| 函数 | 签名 | 职责 |
|------|------|------|
| validateForbiddenWords | `(text: string, options?: { warnOnly?: boolean }) => { passed: boolean; violations: string[] }` | 主导表述命中→passed=false（报错）；模糊表述命中→warnings，passed 可 true |
| loadForbiddenWords | `() => {主导: string[]; 模糊: string[]}` | 从 scoring/coach/forbidden-words.yaml 或默认列表加载 |

### 3.4 iteration_passed 判定

逻辑（与 spec §2.6 一致）：

1. 将 loadRunRecords 结果按 stage 分组；对每条 record 调用 applyTierAndVeto，得到 veto_triggered、phase_score。
2. 构建 EpicVetoInput（storyRecords 为 record 列表，每项含 veto_triggered、phase_score、iteration_count、first_pass、iteration_records、check_items）；调用 evaluateEpicVeto。
3. `iteration_passed = !epicVeto.triggered && 所有 record 的 veto_triggered 均 false && 无 phase_score 经阶梯后为 0 的致命情况`。

---

## 4. 配置

| 文件 | 键 | 说明 |
|------|-----|------|
| config/coach-trigger.yaml | auto_trigger_post_impl: boolean | 默认 false；post_impl 完成后是否自动触发教练 |

---

## 5. CLI 与触发

| 入口 | 说明 |
|------|------|
| scripts/coach-diagnose.ts | `npx ts-node scripts/coach-diagnose.ts --run-id=xxx [--format=json\|markdown]`；默认 format=json |
| package.json | 新增 script：`coach:diagnose` |

### 5.1 Manifest 入驻与路由防御（新增）

基于 `AI_COACH_ROLE_ANALYSIS.md §4`，补充 AI Coach 入驻 BMAD agent 体系的实施任务：

| Task | 实施文件 | 计划动作 |
|------|----------|----------|
| Task 1 | `_bmad/_config/agent-manifest.csv` | 新增 `ai-coach` 条目，`module=scoring`（或 `eval`），并限制 `capabilities` 为 scoring 数据分析/短板诊断/改进建议；禁止 code review 与 audit 执行能力 |
| Task 2 | `_bmad/scoring/agents/ai-coach.md` | 创建 agent persona 文件；从 `scoring/coach/AI_COACH_DEFINITION.md` 同步 role/identity/communication_style/principles 与防御性原则 |
| Task 3 | `scoring/coach/diagnose.ts` | 增加 persona 加载器：优先从 manifest 或 `ai-coach.md` 获取 persona，避免硬编码整段 prompt |
| Task 4 | `_bmad/core/agents/bmad-master.md`（及相关路由） | 增加路由隔离：`scoring` module agent 不进入常规 `/bmad ask` 列表，仅在显式指定或 `coachDiagnose` 专属链路中可用 |

---

## 6. 集成与端到端测试计划

### 6.1 单元测试

| 模块 | 用例 | 命令 |
|------|------|------|
| loader.ts | loadRunRecords：run_id 存在返回记录；不存在返回 [] 或抛错 | `npm test -- scoring/coach` |
| forbidden.ts | validateForbiddenWords：命中主导表述 passed=false；命中模糊表述警告 | 同上 |
| diagnose.ts | coachDiagnose：给定 mock 数据，输出含 iteration_passed、summary、weak_areas；iteration_passed 与 veto 一致 | 同上 |

### 6.2 集成测试

| 场景 | 验证方式 |
|------|----------|
| coachDiagnose 调用 applyTierAndVeto、evaluateEpicVeto | 给定含 veto 的 scoring 数据，断言教练输出 iteration_passed=false 与 veto 判定一致 |
| fallback 路径 | mock 全链路 Skill 不可用（如移除或 stub），断言教练仍可基于既有 scoring 数据输出 |
| 生产代码关键路径 | grep 验证 scoring/coach 被 scripts/coach-diagnose.ts 导入；CLI 可执行 |

### 6.3 端到端验收

- `scripts/accept-e4-s2.ts`：调用 coachDiagnose，给定 sample-run.json 或构造数据，校验输出 schema（summary、phase_scores、weak_areas、recommendations、iteration_passed）；验证禁止词校验通过；**验收 JSON 与 Markdown 两种格式**（断言 formatToMarkdown 产出含上述字段的可读文本）。

---

## 7. 文档产出

- **AI_COACH_DEFINITION.md**：路径 `scoring/coach/AI_COACH_DEFINITION.md` 或 `scoring/docs/AI_COACH_DEFINITION.md`
- **内容**：定位、职责、人格、与全链路 Skill 的关系；与 REQUIREMENTS §3.14 逐项对照；禁止词表说明
- **人格格式**：人格定义须参照 BMAD agent 的 persona 结构（`_bmad/core/agents/adversarial-reviewer.md`、`_bmad/bmm/agents/architect.md`），包含 **role**、**identity**、**communication_style**、**principles** 四维，与批判审计员等角色格式一致，便于后续 Party Mode 或 agent 集成

---

## 8. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1 Scope 1.1(1) | spec §2.1 | plan §7 文档 | ✅ |
| Story §1 Scope 1.1(2) | spec §2.2 | plan §7 | ✅ |
| Story §1 Scope 1.1(3) | spec §2.3 | plan §1 fallback、§4 配置、§6.2 fallback 集成测试 | ✅ |
| Story §1 Scope 1.1(4) | spec §2.4 | plan §3.1、§3.2、§3.4、§5 | ✅ |
| Story §1 Scope 1.1(5) | spec §2.5 | plan §3.1 CoachDiagnosisReport | ✅ |
| Story §1 Scope 1.1(6) | spec §2.6 | plan §3.4 | ✅ |
| Story §1 Scope 1.1(7) | spec §2.7 | plan §3.3 | ✅ |
| AI_COACH_ROLE_ANALYSIS §4 Task 1~4 | spec §2.8 | plan §5.1 | ✅ |
| spec §4.2 测试约束 | spec §4.2 | plan §6 | ✅ |
| AC-1 ~ AC-6 | spec §5 | plan §2–§7 | ✅ |

---

## 9. 集成测试与端到端测试计划（专项）

**必须**：plan 须包含完整集成测试与端到端功能测试计划。

| 测试类型 | 计划内容 | plan 位置 |
|----------|----------|-----------|
| 单元测试 | loader、forbidden、diagnose 输出格式与 iteration_passed | §6.1 |
| 集成测试 | coachDiagnose 与 veto 一致；fallback 路径；CLI 导入与执行 | §6.2 |
| 端到端 | accept-e4-s2.ts 验收脚本 | §6.3 |

**严禁**：仅依赖单元测试；模块实现完整但未被 CLI/生产代码关键路径导入和调用。
