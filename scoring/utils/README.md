# utils

工具函数。

## 职责

- sanitize-iteration：迭代次数字符串规范化
- hash：文件内容 SHA-256、字符串 hash、git HEAD hash

## 主 API

| API | 说明 |
|-----|------|
| `sanitizeIterationCount` | 规范化 iteration_count 字符串 |
| `computeContentHash` | 文件内容 SHA-256 |
| `computeStringHash` | 字符串 SHA-256 |
| `getGitHeadHash` | 当前 git HEAD 短 hash |
