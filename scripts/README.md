# scripts

CLI 脚本目录，提供 scoring、coach、dashboard、eval-questions 等入口。

## 脚本用途表

| 脚本 | 用途 | 典型调用 |
|------|------|----------|
| `parse-and-write-score.ts` | 解析审计报告并写入 scoring 存储 | `npx ts-node scripts/parse-and-write-score.ts --reportPath path --stage prd --runId r1` |
| `dashboard-generate.ts` | 生成项目健康度仪表盘 | `npx ts-node scripts/dashboard-generate.ts --epic 2` |
| `sft-extract.ts` | 从 scoring 提取 SFT 训练数据 | `npx ts-node scripts/sft-extract.ts --threshold 50` |
| `eval-questions-cli.ts` | 评测题库 list/add/run | `npx ts-node scripts/eval-questions-cli.ts run --id q001 --version v1` |
| `eval-question-generate.ts` | 从 coach 诊断生成 eval 题目 | `npx ts-node scripts/eval-question-generate.ts --run-id r1` |
| `check-story-score-written.ts` | 检查 epic/story 是否有评分记录 | `npx ts-node scripts/check-story-score-written.ts --epic 2 --story 1` |
| `coach-diagnose.ts` | Coach 短板诊断 | `npx ts-node scripts/coach-diagnose.ts` |
| `init-to-root.js` | 部署 _bmad、commands、rules 到项目根 | `node scripts/init-to-root.js` |
| `accept-e2-s1.ts` / `accept-e2-s2.ts` / `accept-e4-s3.ts` 等 | 端到端验收脚本 | `npx ts-node scripts/accept-e2-s1.ts` |

## 与 scoring / bmad-speckit 关系

- **scoring**：`parse-and-write-score`、`dashboard-generate`、`sft-extract`、`eval-questions-cli`、`eval-question-generate`、`check-story-score-written`、`coach-diagnose` 均调用 `scoring/` 模块。
- **bmad-speckit**：`init-to-root.js` 部署 bmad-speckit 模板；其他脚本与 bmad-speckit CLI 互补（如 coach 诊断由 `scripts/coach-diagnose.ts` 执行）。
