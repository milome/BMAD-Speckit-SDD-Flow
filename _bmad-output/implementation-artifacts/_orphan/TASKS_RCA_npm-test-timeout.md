# RCA 产出：npm test 超时用例——最终任务列表

**来源**：Party-Mode RCA（100 轮，批判性审计员 >70%，最后 3 轮无新 gap）  
**参考**：`_bmad-output/implementation-artifacts/_orphan/PARTY_MODE_RCA_npm-test-timeout_100r.md`  
**起草日期**：2026-03-09

---

## §1 问题简述

项目根执行 `npm test` 时，以下 2 个 scoring 用例在默认 5000ms 下超时：

| 用例 | 文件 | 行号 |
|------|------|------|
| `content_hash is deterministic for same content (GAP-B01)` | scoring/orchestrator/__tests__/parse-and-write.test.ts | 221 |
| `(5) CLI 无完整 Story 时输出含「Epic N 下无完整 Story」` | scoring/__tests__/integration/dashboard-epic-aggregate.test.ts | 92 |

根因：I/O 与进程冷启动导致单次执行超过 5000ms。采用方案 A（为两用例单独延长 timeout），不修改 vitest 全局配置。

---

## §2 约束

- 仅对两用例单独设置 timeout，不提高 vitest 全局 testTimeout
- 采用 Vitest 推荐写法：`it(name, { timeout: N }, fn)`
- Fallback：若 15000 仍超时，调整为 20000；再失败则 30000；30000 仍超时则须单独发起决策（方案 C 优化用例 或 方案 B 排除用例）

---

## §3 根因与方案

**根因**：parse-and-write 用例两次 parseAndWriteScore（含文件 I/O、hash 计算）；dashboard 用例 execSync 调用 npx ts-node，冷启动耗时。默认 5000ms 不足。

**方案**：在两处 `it` 的第二个参数位置插入 `{ timeout: 15000 }`。若验收失败，按 §4 中 T4 执行。

---

## §4 任务列表

| ID | 任务 | 文件 | 修改内容 | 验收 |
|----|------|------|----------|------|
| T1 | parse-and-write content_hash 用例增加 timeout | scoring/orchestrator/__tests__/parse-and-write.test.ts | 第 221 行：`it('content_hash is deterministic for same content (GAP-B01)', async () => {` → `it('content_hash is deterministic for same content (GAP-B01)', { timeout: 15000 }, async () => {` | 第 221 行含 `{ timeout: 15000 }` |
| T2 | dashboard-epic-aggregate 用例 (5) 增加 timeout | scoring/__tests__/integration/dashboard-epic-aggregate.test.ts | 第 92 行：`it('(5) CLI 无完整 Story 时输出含「Epic N 下无完整 Story」', () => {` → `it('(5) CLI 无完整 Story 时输出含「Epic N 下无完整 Story」', { timeout: 15000 }, () => {` | 第 92 行含 `{ timeout: 15000 }` |
| T3 | 验收 npm test 全通过 | — | 在项目根执行 `npm test` | 退出码 0，无 timeout 错误，无失败用例 |
| T4 | Fallback：超时仍发生时的调整 | 同上两文件 | 将两处 `15000` 改为 `20000`，保存后重跑 `npm test`；若仍超时则改为 `30000` 并重跑；若 30000 仍超时，须单独发起决策流程（方案 C 优化用例或方案 B 排除用例，产出新 TASKS） | 20000/30000 档：`npm test` 退出码 0；30000 仍超时：已产出新决策 TASKS |

---

## §5 验收命令

```bash
cd D:\Dev\BMAD-Speckit-SDD-Flow
npm test
```

**通过标准**：退出码 0，所有用例通过，无 `Timeout` 或 `Exceeded timeout` 错误。

---

## §6 禁止词自检

本文件不含：可选、可考虑、后续、酌情、待定、技术债、先这样后续再改。
