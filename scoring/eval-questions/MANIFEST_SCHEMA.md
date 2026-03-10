# 题库 manifest 与题目模板（E8 实施前提）

**版本**：1.0  
**状态**：已定稿  
**生效**：E8（REQ-UX-5）实施前  
**对齐**：PRD §5.5、REQUIREMENTS_Refined §3.5、epics.md Story 8.1

---

## 1. 目录结构

```
scoring/eval-questions/
├── v1/
│   ├── manifest.yaml          # 题目清单（本 schema）
│   ├── q001-refactor-scoring.md
│   ├── q002-bugfix-veto-logic.md
│   └── ...
├── v2/
│   ├── manifest.yaml
│   └── ...
└── README.md                  # 本目录说明（可选）
```

- 每个版本目录（v1、v2）独立，内含 `manifest.yaml` 与题目 `.md`。
- 题目 id 在版本内唯一；不同版本可有相同 id（如 v1/q001 与 v2/q001 为不同题目）。

---

## 2. manifest.yaml Schema

```yaml
# 题目清单；顶层键固定为 questions
questions:
  - id: string           # 必填，如 q001、q002；版本内唯一
    title: string        # 必填，人类可读标题
    path: string         # 必填，相对当前 manifest 的题目文件路径，如 q001-refactor-scoring.md
    difficulty?: string  # 可选，如 easy | medium | hard
    tags?: string[]      # 可选，如 [refactor, veto, scoring]
```

### 2.1 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✓ | 题目唯一标识，建议 `q001` 格式；用于 `run --id q001` |
| title | string | ✓ | 题目标题，用于 list 展示 |
| path | string | ✓ | 相对 manifest 所在目录的文件路径；与 `id` 可不同名 |
| difficulty | string | | easy / medium / hard 等 |
| tags | string[] | | 标签数组，用于筛选或分类 |

### 2.2 示例

```yaml
questions:
  - id: q001
    title: 重构评分逻辑
    path: q001-refactor-scoring.md
    difficulty: medium
    tags: [refactor, scoring]
  - id: q002
    title: BUGFIX Veto 逻辑
    path: q002-bugfix-veto-logic.md
    difficulty: hard
    tags: [bugfix, veto]
```

---

## 3. 题目文档模板（与 parser 输入格式兼容）

题目 `.md` 为**审计报告格式**，与 `scoring/parsers` 的输入一致，供 `parseAndWriteScore` 解析。

### 3.1 最小模板（generic/spec 类）

```markdown
# {题目标题} 审计报告

审计对象: {题目 id 或描述}
审计日期: {日期}
场景: eval_question

总体评级: A|B|C|D

维度评分:
1. {维度名}: {等级} ({分数}/{满分})
2. ...

问题清单:
1. [严重程度:高|中|低] 描述

通过标准:
- 总体评级A或B: 通过
```

### 3.2 与 parser 的兼容性

- **stage**：题目执行时，根据题目类型选择 prd/arch/story/spec/plan/tasks 之一；`/bmad-eval-questions run` 根据题目内容或配置决定 stage。
- **parseGenericReport**：适用于 spec/plan/tasks 格式；需包含 `总体评级`、`维度评分`、`问题清单` 等可解析结构。
- **parsePrdReport / parseArchReport / parseStoryReport**：若题目模拟 PRD/Arch/Story 审计，需符合对应 parser 的输入格式。

### 3.3 题目模板占位符

`/bmad-eval-questions add --title "xxx"` 生成模板时，建议：

- 文件名：`q00X-{slug}.md`，slug 由 title 生成（如 "refactor-scoring" → `q001-refactor-scoring.md`）
- 内容：使用 §3.1 最小模板，填入 id、title

---

## 4. 与 parser 的衔接

| 环节 | 说明 |
|------|------|
| 加载题目 | 从 manifest 的 path 读取 .md 内容 |
| 执行评审 | 调用 code-reviewer 或等效 Skill 产出审计报告；或题目本身即为预设报告（离线评测） |
| 解析写入 | `parseAndWriteScore`(content, stage, runId=`eval-q{id}-{version}-{ts}`, scenario=`eval_question`, question_version=`v1`) |
| 数据隔离 | scenario=eval_question + question_version 实现 v1/v2 隔离 |

---

## 5. 校验规则

- manifest.yaml 存在且可解析
- questions 为数组，每项含 id、title、path
- path 指向的文件存在
- id 在版本内唯一

---

## 6. 参考

- **实现**：`scoring/eval-questions/manifest-loader.ts`（EvalQuestionEntry、EvalQuestionManifest、loadManifest）
- PRD：`prd.eval-ux-last-mile.md` §5.5、§7
- REQ-UX-5.2：manifest schema
- REQ-UX-5.9：题目与 parser 输入格式兼容
- `scoring/parsers/__tests__/fixtures/sample-eval-question-report.md`：示例报告格式
