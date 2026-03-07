# Spec E8-S3：题库 run 命令与 eval_question 集成

**Epic**：8 eval-question-bank  
**Story**：8.3 question-bank-run-eval  
**来源**：8-3-question-bank-run-eval.md、prd.eval-ux-last-mile.md §5.5–5.8、RUN_ID_CONVENTION.md §2.2

---

## 1. 概述

本 spec 定义 run 子命令接口、题目加载与执行链路、scenario/question_version 注入、run_id 约定及失败路径处理，实现 eval_question 场景下的评分写入与 v1/v2 版本隔离。

**范围**：run 命令入口、loadManifest 复用、评审/报告来源、parseAndWriteScore 调用、question_version 校验；不包含 list/add 或 manifest 结构变更。

---

## 2. run 命令接口

### 2.1 子命令

| 命令 | 说明 |
|------|------|
| `run --id <questionId> --version <version>` | 执行指定题目并写入评分 |

### 2.2 必填参数

| 参数 | 类型 | 说明 |
|------|------|------|
| --id | string | 题目 id（如 q001），版本内唯一 |
| --version | string | 版本（v1、v2），对应 scoring/eval-questions/v1、v2 |

### 2.3 可选参数

| 参数 | 类型 | 说明 |
|------|------|------|
| --reportPath | string | 审计报告路径；未传时使用题目 path 作为报告来源 |

### 2.4 校验规则

- --id、--version 不可为空；version 须为 v1 或 v2。
- version 须对应已存在的版本目录（scoring/eval-questions/v1 或 v2）。

---

## 3. 题目加载与报告来源

### 3.1 加载

- 调用 `loadManifest(versionDir)`（Story 8.1 产出）。
- versionDir = `scoring/eval-questions/{version}`（如 v1 → v1 目录绝对路径）。
- 根据 manifest.questions 按 id 查找匹配项；未找到则输出明确错误并退出。

### 3.2 报告来源

- **有 --reportPath**：使用该路径读取报告内容。
- **无 --reportPath**：使用题目 path（相对 versionDir）作为报告文件；即 `path.join(versionDir, entry.path)`。
- 题目 .md 文件须为与 scoring/parsers 兼容的审计报告格式（含 总体评级、维度评分 可解析块）；若格式不合法，parseAndWriteScore 将抛错，run 捕获并输出「题目解析失败：<原因>」。

### 3.3 评审调用说明

- 规范上 run 应调用 code-reviewer 或等价流程产出报告；CLI 环境下以「报告文件已存在」为前提。
- Cursor Command 可编排：加载题目 → 调用 code-reviewer → 产出报告 → 调用 run（或 run --reportPath）。
- CLI 直接调用时，报告须已就绪（题目文件即报告或 --reportPath 指向报告）。

---

## 4. parseAndWriteScore 调用约定

### 4.1 参数映射

| 参数 | 值 | 说明 |
|------|-----|------|
| reportPath / content | 报告路径或内容 | 题目 path 或 --reportPath |
| stage | story / prd / spec / plan / tasks 之一 | 与报告格式一致；eval 题目常用 story 或 prd |
| runId | `eval-q{id}-{version}-{timestamp}` | 见 RUN_ID_CONVENTION §2.2 |
| scenario | eval_question | 固定 |
| question_version | --version 值（如 v1） | 必填 |
| writeMode | single_file / jsonl / both | 按 config 或默认 single_file |

### 4.2 run_id 格式

- 格式：`eval-q{id}-{version}-{timestamp}`
- id：--id 参数值（如 q001），去 q 前缀则用完整 id。
- version：--version 值（v1、v2）。
- timestamp：毫秒级 `Date.now()`。
- 示例：`eval-q001-v1-1730812345`。

### 4.3 question_version 校验

- scenario=eval_question 时 question_version 必填。
- 写入前校验：若缺失则 throw 明确错误，不调用 write。
- writer/validate.ts 已实现；run 命令须在调用 parseAndWriteScore 前确保传入。

---

## 5. 失败路径

| 场景 | 行为 |
|------|------|
| 题目不存在 | 输出「题目 {id} 在版本 {version} 中不存在」并退出 |
| 报告文件不存在 | 输出「报告文件不存在：{path}」并退出 |
| 解析失败 | 捕获 parseAndWriteScore 或解析器抛错，输出「题目解析失败：<原因>」并退出 |
| question_version 缺失 | throw 明确错误，不写入 |

---

## 6. 版本隔离

- v1 与 v2 的 run 分别写入不同 run_id（含 version 字段）。
- 记录含 question_version，query 层可按 version 筛选。
- 同一 id 在 v1、v2 下视为不同题目，评分独立存储。

---

## 7. 需求映射清单（spec ↔ 原始需求）

| 原始文档章节 | 需求要点 | spec 对应 |
|-------------|----------|-----------|
| Story §3.1 run 命令 | --id、--version 必填 | spec §2 |
| Story §3.1 题目加载 | loadManifest、按 id 找 path | spec §3.1 |
| Story §3.1 评审调用 | 题目→报告→parseAndWriteScore | spec §3.2、§3.3 |
| Story §3.1 scenario 注入 | scenario=eval_question、question_version | spec §4.1 |
| Story §3.1 run_id | eval-q{id}-{version}-{ts} | spec §4.2 |
| Story §3.1 question_version 校验 | 缺失 throw | spec §4.3 |
| Story §3.1 失败路径 | 题目不存在、解析失败明确错误 | spec §5 |
| REQ-UX-5.5 | run --id q001 --version v1 | spec §2 |
| REQ-UX-5.6 | 失败时明确错误 | spec §5 |
| REQ-UX-5.7 | run_id 含 version | spec §4.2 |
| REQ-UX-5.8 | question_version 必填，缺则 throw | spec §4.3 |

---
