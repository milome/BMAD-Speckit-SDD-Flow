# TASKS_RCA_banner-three-parts-ansi

三部分拼接 + ANSI 光标定位方案：Banner 显示 SPECKIT 从第 82 列起对齐、消除错位。

---

## §1 问题简述

在用户终端下，Banner 由 BMAD、分隔符（或空格）、SPECKIT 三块组成。若仅靠「按显示宽度算空格再拼接 SPECKIT」而不使用 ANSI 列定位，终端列计数与代码中 `getRenderWidth()` 的假设不一致，导致 SPECKIT 竖线错位。需采用「三部分边界明确 + 每部分可单独测试 + ANSI 光标定位保证 SPECKIT 从第 82 列起」的方案，既消除对填充空格数量的依赖，又保证 SPECKIT 不错位。

---

## §2 根因

（引用用户给出的根因）

在用户终端下，仅靠「按显示宽度算空格再拼接 SPECKIT」无法保证光标在显示列 82；终端列计数与 `getRenderWidth()` 假设不一致，去掉 `\x1b[82G` 后 SPECKIT 必然错位。

---

## §3 约束与不回退条件

- **目标列**：SPECKIT 从终端第 82 列（1-based）开始显示，与 BMAD 竖线对齐。
- **不回退**：实现后不得移除 ANSI 列定位而仅依赖空格填充；Unicode 分支必须使用 `\x1b[82G` 在输出 SPECKIT 前将光标移至第 82 列。
- **兼容**：ASCII 回退分支逻辑不变，不引入 ANSI 列定位；梯度着色在拼接后的整行上应用，不破坏 ANSI 序列。

---

## §4 最终方案

### 4.1 三部分定义

- **Part1（BMAD）**  
  - 第 i 行内容：`BMAD_LINES[i]`，无前缀或后缀空格。  
  - 渲染宽度：以现有 `getRenderWidth(BMAD_LINES[i])` 为准，即 `BMAD_RENDER_WIDTHS[i]`，最大 69。

- **Part2（中间）**  
  - 第 i 行内容：当 `i === 2` 时为 `SEPARATOR`（`'   ═══   '`），否则为 `SPACING`（9 个 ASCII 空格）。  
  - Part2 与 Part1 之间无插入空格；Part2 与 Part3 之间不填任何空格，由 ANSI 定位到第 82 列后直接输出 Part3。

- **Part3（SPECKIT）**  
  - 第 i 行内容：`SPECKIT_LINES[i]`。  
  - 输出前必须通过 ANSI 序列 `\x1b[82G` 将光标移至第 82 列，再输出 Part3，保证 SPECKIT 从第 82 列起显示。

### 4.2 每部分单独测试策略

- **Part1**  
  - 用例 1：对每行索引 i，取 Part1(i) 等于 `BMAD_LINES[i]`，断言与 `getExpectedBmadLines()[i]` 逐字一致。  
  - 用例 2：对每行 i，断言 `getRenderWidth(Part1(i)) === BMAD_RENDER_WIDTHS[i]`。  

- **Part2**  
  - 用例 1：Part2(2) 等于 `SEPARATOR`，断言与 `getSeparator()` 一致且 `getRenderWidth(Part2(2)) === SEPARATOR_RENDER_WIDTH`。  
  - 用例 2：对 i !== 2，Part2(i) 为 9 个空格，断言长度为 9。  

- **Part3**  
  - 用例 1：对每行 i，Part3(i) 等于 `SPECKIT_LINES[i]`，断言与 `getExpectedSpeckitLines()[i]` 逐字一致。  

- **拼接与 ANSI**  
  - 用例 1：Unicode 分支下 `buildBannerLines({ forceUnicode: true })` 返回的每行均包含子序列：Part1 + Part2 + `\x1b[82G` + Part3（顺序不可颠倒）。  
  - 用例 2：每行中 `\x1b[82G` 出现且仅出现一次，且位于 Part2 与 Part3 之间。  
  - 用例 3：Part2 与 Part3 之间除 ANSI 序列外无额外空格（消除多余空格）。

### 4.3 ANSI 定位方式

- 每行输出顺序：**Part1 → Part2 → `\x1b[82G` → Part3**。  
- Part1 从当前行首输出；Part2 紧接 Part1 输出；随后输出 `\x1b[82G` 将光标移至第 82 列（1-based）；再输出 Part3。  
- 不在 Part2 后追加任何空格；SPECKIT 列对齐完全由 `\x1b[82G` 保证，不依赖 Part1+Part2 的显示宽度计算。

### 4.4 与现有逻辑的关系

- Unicode 分支：`buildBannerLines` 改为按三部分拼接并在 Part2 与 Part3 之间插入 `\x1b[82G`；不再根据 `speckitCol - endCol` 计算 padding 空格。  
- ASCII 分支：保持 `buildAsciiBannerLines()` 不变，不加入 ANSI 列定位。  
- 梯度：`applyGradient(lines, chalk)` 在 `buildBannerLines` 返回的每行（已含 ANSI）上应用，不剥离或破坏 `\x1b[82G`。

---

## §5 最终任务列表

| 序号 | 修改路径 | 位置/行号 | 内容要点 | 验收标准 |
|------|----------|-----------|----------|----------|
| 1 | `packages/bmad-speckit/src/commands/banner.js` | `buildBannerLines` 函数（约 99–114 行） | 重写 Unicode 分支：每行返回 Part1(i) + Part2(i) + `\x1b[82G` + Part3(i)；移除基于 gap 的 padding 计算与拼接。 | 调用 `buildBannerLines({ forceUnicode: true })` 时每行包含且仅包含一次 `\x1b[82G`，且 Part2 与 Part3 之间无空格。 |
| 2 | `packages/bmad-speckit/src/commands/banner.js` | Part2 逻辑（同上函数内） | Part2(i)：i===2 时为 `SEPARATOR`，否则为 `SPACING`；不在此后追加任何空格。 | 与 §4.1 Part2 定义一致；单元测试 Part2 内容与长度通过。 |
| 3 | `packages/bmad-speckit/tests/banner.test.js` | 原「每行不得包含 \x1b[82G」用例（约 64–72 行） | 删除或改写：Unicode 分支改为断言每行包含且仅包含一次 `\x1b[82G`，且位于 Part2 与 Part3 之间。 | 新用例通过；与 §4.2 拼接与 ANSI 用例 1、2 一致。 |
| 4 | `packages/bmad-speckit/tests/banner.test.js` | 新增 describe 或 it | 增加 Part1 单独测试：Part1(i) 与 `getExpectedBmadLines()[i]` 一致，`getRenderWidth(Part1(i)) === BMAD_RENDER_WIDTHS[i]`。 | 覆盖 §4.2 Part1 两条用例。 |
| 5 | `packages/bmad-speckit/tests/banner.test.js` | 同上 | 增加 Part2 单独测试：Part2(2) 与 `getSeparator()` 一致且 `getRenderWidth(Part2(2)) === SEPARATOR_RENDER_WIDTH`；i!==2 时 Part2(i) 为 9 个空格。 | 覆盖 §4.2 Part2 两条用例。 |
| 6 | `packages/bmad-speckit/tests/banner.test.js` | 同上 | 增加 Part3 单独测试：Part3(i) 与 `getExpectedSpeckitLines()[i]` 一致。 | 覆盖 §4.2 Part3 用例。 |
| 7 | `packages/bmad-speckit/tests/banner.test.js` | 原「无多余空格」用例（约 92–111 行） | 改写：断言 Part2 与 Part3 之间除 ANSI 外无空格（即无 padding 字符）；可保留「82 列」语义的断言但以「存在 \x1b[82G 且 Part3 紧接其后」为主。 | 与 §4.2 拼接与 ANSI 用例 3 一致；测试通过。 |
| 8 | `packages/bmad-speckit/src/commands/banner.js` | 导出（若需） | 若测试需直接测 Part1/Part2/Part3，则导出 `buildPart1`/`buildPart2`/`buildPart3` 或等价可测接口；否则通过 `buildBannerLines` 返回行解析断言。 | 能对三部分分别做 §4.2 的单独测试。 |

---

## §6 验收命令

- 单元测试（项目根执行）：  
  `node --test packages/bmad-speckit/tests/banner.test.js`  
  或在 `packages/bmad-speckit` 下执行 `npm test`，确保 banner 相关用例全部通过。  
  要求：全部通过，且无跳过与三部分/ANSI 相关的用例。

- 手工验收：在支持 ANSI 的终端（如 Windows Terminal、VS Code 集成终端）中执行：  
  `node packages/bmad-speckit/bin/bmad-speckit.js init --help`  
  要求：Banner 中 SPECKIT 竖线与 BMAD 竖线对齐，SPECKIT 从第 82 列起显示，无阶梯错位。
