---
name: bmad-eval-questions
description: 题库 list/add 命令：查看题目清单、新增题目模板
---

# /bmad-eval-questions

题库管理命令，支持 `list` 与 `add` 子命令。

## 触发方式

- Codex command：`/bmad-eval-questions`
- CLI：`npx bmad-speckit eval-questions <subcommand> [options]`

## 子命令

| 子命令 | 说明 |
|--------|------|
| list | 返回当前版本题目清单（id、title、path） |
| add | 新增题目模板到当前版本目录 |

## 参数

- `--version v1\|v2`：指定版本目录，缺省为 v1
- `--title "xxx"`：add 时必填，题目标题

## 用法示例

```bash
# list（缺省 v1）
npx bmad-speckit eval-questions list
npx bmad-speckit eval-questions list --version v2

# add
npx bmad-speckit eval-questions add --title "refactor-scoring"
npx bmad-speckit eval-questions add --title "refactor-scoring" --version v2
```

## 验收命令

```bash
npx bmad-speckit eval-questions list
npx bmad-speckit eval-questions list --version v2
npx bmad-speckit eval-questions add --title "refactor-scoring"
npx bmad-speckit eval-questions add --title "refactor-scoring" --version v2
```

Codex command 内部等价调用上述脚本。
