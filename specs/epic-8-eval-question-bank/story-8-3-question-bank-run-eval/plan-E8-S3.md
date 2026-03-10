# Plan E8-S3：题库 run 命令与 eval_question 集成实现方案

**Epic**：8 eval-question-bank  
**Story**：8.3 question-bank-run-eval  
**前置**：spec-E8-S3.md 已通过审计

---

## 1. 实现概述

在 eval-questions-cli.ts 中新增 run 子命令，复用 loadManifest 加载题目，按 id 查 path，读取报告内容，生成 runId，调用 parseAndWriteScore 注入 scenario=eval_question、question_version；实现 question_version 校验与失败路径处理。

---

## 2. Phase 1：run 命令入口与参数

### 2.1 任务

- 在 eval-questions-cli.ts 中增加 `run` 子命令分支。
- 解析 --id、--version、--reportPath。
- 校验 --id、--version 必填；version ∈ {v1, v2}；版本目录存在。

### 2.2 技术选型

- 复用现有 parseArgs 逻辑；getVersionDir 与 list/add 共用。
- 新增 cmdRun(id, version, reportPath?)。

### 2.3 验收

- `run --id q001 --version v1` 可解析；缺参时输出用法并退出。

---

## 3. Phase 2：题目加载与报告来源

### 3.1 任务

- 调用 loadManifest(versionDir)，根据 id 在 questions 中查找。
- 未找到：输出「题目 {id} 在版本 {version} 中不存在」，退出码 1。
- 报告路径：reportPath ?? path.join(versionDir, entry.path)。
- 校验报告文件存在；不存在则输出明确错误。

### 3.2 stage 选择

- 报告格式由 scoring/parsers 支持；eval 题目常用 story 或 prd。
- 默认 stage=story；若报告含 prd 格式可尝试 prd；实现时可根据报告内容或固定 story。

### 3.3 验收

- run --id q001 --version v1 能加载 v1 下 q001；q999 不存在时输出明确错误。

---

## 4. Phase 3：runId 生成与 parseAndWriteScore 调用

### 4.1 runId

- 格式：`eval-q{id}-{version}-{timestamp}`
- id 用 --id 原值（如 q001）；timestamp = Date.now()。

### 4.2 question_version 校验

- 调用 parseAndWriteScore 前：若 scenario=eval_question 且 question_version 未传，throw 明确错误。
- parseAndWriteScore options 传入 question_version: version。

### 4.3 调用

- parseAndWriteScore({ reportPath, stage, runId, scenario: 'eval_question', question_version: version, writeMode: 'single_file' })。
- 使用 content 或 reportPath；reportPath 需转为绝对路径。
- writeMode 可读 config 或默认 single_file。

### 4.4 验收

- 写入记录含 scenario=eval_question、question_version、run_id 符合 eval-q*-*-* 格式。

---

## 5. Phase 4：失败路径与测试

### 5.1 失败路径

- 题目不存在、报告不存在、解析失败：捕获错误，输出明确信息，process.exit(1)。
- question_version 缺失：throw 后由 main catch 输出。

### 5.2 单元测试

- runId 生成符合 `eval-q{id}-{version}-{timestamp}` 格式。
- scenario=eval_question 且 question_version 缺失时 throw。
- 使用 Vitest。

### 5.3 集成测试

- run --id q001 --version v1 端到端（需 fixture 报告或真实 v1 题目）。
- 题目不存在、解析失败时输出明确错误。
- v1、v2 各 run 一次，run_id 与 question_version 可区分。

### 5.4 验收命令

```bash
npx ts-node scripts/eval-questions-cli.ts run --id q001 --version v1
npx vitest run scoring/eval-questions
```

---

## 6. 需求映射清单（plan ↔ spec）

| spec 章节 | plan 对应 |
|-----------|-----------|
| §2 run 命令 | Phase 1 |
| §3 题目加载与报告 | Phase 2 |
| §4 parseAndWriteScore | Phase 3 |
| §5 失败路径 | Phase 4 |
| §6 版本隔离 | Phase 4 集成测试 |

---
