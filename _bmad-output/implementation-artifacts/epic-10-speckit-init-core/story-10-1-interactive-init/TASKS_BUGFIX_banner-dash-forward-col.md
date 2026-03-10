# TASKS: BUGFIX Banner 分隔符改为 dash 且 SPECKIT 列号往前推进

基于讨论结论：分隔符改为无空格 dash；SPECKIT 目标列按公式计算，实现「往前推进」以缩小空隙。

---

## §1 方案摘要

- **Part2（分隔符）**：Unicode 分支由 `'   ═══   '` / 9 空格改为**无空格 dash** `'-'`（1 列），整行逻辑为「BMAD-SPECKIT」一个整体，技术上仍用 ANSI 保证 SPECKIT 对齐。
- **SPECKIT 列号**：不再写死 82。公式为 `speckitCol = BMAD_MAX_RENDER_WIDTH + 1 + getRenderWidth(Part2)`。Part2 为 `'-'` 时，`speckitCol = 69 + 1 + 1 = 71`，实现往前推进，缩小「分隔符与 SPECKIT 之间」空隙（最长 BMAD 行上可无空隙）。
- **每行输出**：`Part1 + "-" + \x1b[71G + Part3`（或 `\x1b[${speckitCol}G`）。

---

## §2 约束与不回退条件

- **禁止回退**：不得移除 SPECKIT 前的 ANSI 列定位；不得恢复「仅用空格填充、不用 ANSI」的实现（会导致错位）。
- **必须保持**：BMAD、SPECKIT 内容与显示正确；`buildAsciiBannerLines()`、`shouldUseAsciiFallback()`、`forceUnicode` 逻辑不变；ASCII 回退分支仍可使用原有 `ASCII_SEPARATOR`（`'   ===   '`），仅 Unicode 分支改用 dash。
- **验收**：`npm test` 全部通过；`npx bmad-speckit init --help` 目视 SPECKIT 竖线对齐（从第 71 列起）、BMAD 与 dash 正确、无 SPECKIT 错位。

---

## §3 最终任务列表

| # | 修改路径 | 位置/行号及内容要点 | 验收标准 |
|---|----------|----------------------|----------|
| 1 | `packages/bmad-speckit/src/commands/banner.js` | **常量**（约 33–36 行）：新增 Unicode 分支分隔符常量，例如 `const DASH = '-'`；可保留原 `SEPARATOR`/`SPACING` 供 ASCII 或测试引用，或仅保留 `DASH` 与 `DASH_RENDER_WIDTH = 1`。 | 存在 DASH（或等价）常量，渲染宽度为 1。 |
| 2 | `packages/bmad-speckit/src/commands/banner.js` | **buildBannerLines**（约 96–116 行）：Unicode 分支改为三部分拼接 + ANSI。计算 `speckitCol = BMAD_MAX_RENDER_WIDTH + 1 + getRenderWidth(DASH)`（= 71）；每行返回 `bmad + DASH + '\x1b[' + speckitCol + 'G' + SPECKIT_LINES[i]`。删除基于 `endCol`、`gap`、`padding` 的逻辑。注释中写明列号公式及「往前推进」含义。 | 每行包含 `\x1b[71G`；Part2 为 `'-'`；SPECKIT 从第 71 列起对齐；无 gap/padding 计算。 |
| 3 | `packages/bmad-speckit/src/commands/banner.js` | **getSeparator()**（约 155 行）：若测试或外部依赖当前返回 `'   ═══   '`，改为返回 Unicode 分支实际使用的分隔符（即 `DASH`），或新增 `getUnicodeSeparator()` 返回 `'-'` 并在测试中使用。 | 测试能通过；对外语义与「Unicode 分隔符为 dash」一致。 |
| 4 | `packages/bmad-speckit/tests/banner.test.js` | **TASK-1 中「只有第 3 行应包含分隔符 "   ═══   "」**（约 49–60 行）：改为断言每行均包含 dash `'-'`（Unicode 分支）；若保留 ASCII 分支测试，则 ASCII 分支仍可断言第 3 行包含 `ASCII_SEPARATOR`。 | Unicode 分支每行包含 `'-'`；不错误断言「仅第 3 行有分隔符」为 ═══。 |
| 5 | `packages/bmad-speckit/tests/banner.test.js` | **describe「buildBannerLines() Unicode 分支无 ANSI 列定位」**（约 63–72 行）：删除或改写。改为断言 Unicode 分支每行**包含** ANSI 列定位且列号为 71（例如每行包含 `\x1b[71G`）。 | 测试要求每行包含 `\x1b[71G`（或等价），与实现一致。 |
| 6 | `packages/bmad-speckit/tests/banner.test.js` | **TASK-2「每行应包含 BMAD + 分隔符/空格 + SPECKIT」**（约 74–88 行）：更新为每行包含 BMAD、dash `'-'`、ANSI 列定位、SPECKIT；分隔符断言改为 dash。 | 每行包含 EXPECTED_BMAD_LINES[i]、`'-'`、EXPECTED_SPECKIT_LINES[i] 及 ANSI。 |
| 7 | `packages/bmad-speckit/tests/banner.test.js` | **describe「buildBannerLines() 无多余空格（SPECKIT 从第 82 列起）」**（约 92–113 行）：改写为「SPECKIT 从第 71 列起」；断言 Part2（dash）与 Part3 之间仅含 ANSI 序列（如 `\x1b[71G`），无空格；或断言每行包含 `\x1b[71G` 且 SPECKIT 内容紧接其后。 | 无「82 列」「gap 数量」等旧假设；与 dash + 71 列方案一致。 |
| 8 | `packages/bmad-speckit/tests/banner.test.js` | **TASK-3「SPECKIT 第一行 ██╗  ██╗ 应有两个空格」**（约 80–94 行）：若当前用 `bmadLength + 9` 等取 SPECKIT 部分，改为不依赖固定偏移（例如用 `indexOf(EXPECTED_SPECKIT_LINES[0])` 或断言整行包含 `'██╗  ██╗'` 且包含 EXPECTED_SPECKIT_LINES[0]）。 | TASK-3 仍验证 SPECKIT 第一行两个空格；不因 Part2 改为 1 字符而断言失败。 |

**禁止表述**：任务列表中不得出现「可选」「可考虑」「后续」「酌情」「待定」。

---

## §4 验收命令

1. **单元测试**：在 `packages/bmad-speckit` 或项目根执行 `npm test`（或 `node --test tests/banner.test.js`），全部通过。
2. **目视**：执行 `npx bmad-speckit init --help`，确认 banner 为 BMAD + dash + SPECKIT，SPECKIT 竖线从第 71 列起对齐、无错位，BMAD 与 dash 显示正确。
3. **禁止回退**：确认 Unicode 分支仍使用 ANSI 列定位（\x1b[71G）；未恢复「仅空格填充、无 ANSI」的实现。

---

## §5 参考（讨论结论）

- 82 来源于「BMAD 最大宽度 69 + 1 + 分隔符宽度 12」；分隔符改为 1 列 dash 后，列号应改为 71，实现「往前推进」。
- 公式 `speckitCol = BMAD_MAX_RENDER_WIDTH + 1 + getRenderWidth(Part2)` 保证 Part2 变更时列号一致、空隙最小。
