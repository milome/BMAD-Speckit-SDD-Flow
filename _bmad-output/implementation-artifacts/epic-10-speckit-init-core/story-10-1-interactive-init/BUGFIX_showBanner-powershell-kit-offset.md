# BUGFIX: PowerShell 终端 KIT 部分水平偏移

## §1 问题描述

### 现象

SPECKIT 的 KIT 部分在 PowerShell 终端渲染后出现水平偏移（阶梯状错位），K、I、T 依次向右偏移。BMAD 部分和 SPECKIT 的 SPEC 部分对齐正常，仅 KIT 部分错位。

### 复现步骤

```powershell
npx bmad-speckit init --help
```

### 环境

- Windows PowerShell（含 5.1 及 7.x）
- 代码中 TAAG 生成的 ASCII 艺术源字符串正确，问题仅出现在 PowerShell 终端显示时

### 预期 vs 实际

| 项目 | 预期 | 实际 |
|------|------|------|
| BMAD | 对齐 | 对齐 |
| SPEC | 对齐 | 对齐 |
| KIT | 对齐 | 阶梯状右偏 |

---

## §2 根因分析

### 根因结论（一段话）

**Windows PowerShell（尤其使用 ConHost 渲染时）对 Unicode 块体字符（█ U+2588、║ U+2551、═ U+2550、╔ U+2554、╚ U+255A 等）的显示宽度与逻辑 1 列不一致，导致光标位置累积漂移；KIT 位于每行末尾，累积误差最大，故阶梯状错位最明显。**

### 分析依据

1. **字符分布**：SPECKIT 第 1 行结构为 `███████╗██████╗ ███████╗ ██████╗██╗  ██╗██╗████████╗`，KIT 部分（`██╗  ██╗██╗████████╗`）位于行尾，前面已有大量块体字符。
2. **Unicode 规范**：U+2588 FULL BLOCK 的 East Asian Width 为 Neutral，理论上 1 列，但 ConHost 在 CJK 或特定字体下可能按 2 列渲染。
3. **累积效应**：若每个 █ 或 ║ 被多算 0.5~1 列，行首到行尾的偏移会累积，KIT 位于末尾故最明显。
4. **BMAD/SPEC 正常**：BMAD 与 SPEC 在行首/行中，或字符组合不同，累积误差相对较小；KIT 在行尾，累积误差最大。

---

## §3 影响范围

- **受影响环境**：Windows PowerShell 5.1、PowerShell 7.x（使用 ConHost 时）
- **不受影响**：Windows Terminal、VSCode 终端、ConEmu、Cmder 等（通常使用不同渲染引擎）
- **影响功能**：`bmad-speckit init --help` 及所有调用 `showBanner()` 的命令
- **影响文件**：`packages/bmad-speckit/src/commands/banner.js`、`packages/bmad-speckit/src/commands/init.js`

---

## §4 修复方案

### 4.1 策略

在检测到「可能使用 ConHost 的 Windows 环境」时，使用 ASCII-only 回退 banner，避免 Unicode 块体/制表符；其他环境继续使用现有 Unicode banner。

### 4.2 环境检测逻辑

在 `banner.js` 中新增 `shouldUseAsciiFallback()`：

- 条件：`process.platform === 'win32'` 且以下均不成立：
  - `process.env.WT_SESSION` 存在（Windows Terminal）
  - `process.env.TERM_PROGRAM === 'vscode'`（VSCode 终端）
  - `process.env.ConEmuPID` 存在（ConEmu）
  - `process.env.CMDER_ROOT` 存在（Cmder）
- 满足条件时返回 `true`，使用 ASCII 回退。

### 4.3 ASCII 回退 banner 设计

使用纯 ASCII 字符（`#`、`=`、`|`、`-`）构造 BMAD-SPECKIT 等效视觉，保持 6 行结构，风格与 TAAG ANSI Shadow 近似，确保在 ConHost 下对齐正确。

### 4.4 实现位置

- `banner.js`：新增 `ASCII_BMAD_LINES`、`ASCII_SPECKIT_LINES`、`buildAsciiBannerLines()`、`shouldUseAsciiFallback()`
- `buildBannerLines()` 或调用方：根据 `shouldUseAsciiFallback()` 选择 Unicode 或 ASCII 版本
- `init.js` 的 `showBanner()`：无需修改调用方式，由 `banner.js` 内部切换

---

## §5 验收标准

| ID | 验收项 | 通过条件 |
|----|--------|----------|
| AC-1 | PowerShell 5.1（ConHost） | `npx bmad-speckit init --help` 显示 banner，KIT 无阶梯错位 |
| AC-2 | PowerShell 7（ConHost） | 同上 |
| AC-3 | Windows Terminal | 继续使用 Unicode banner，显示正常 |
| AC-4 | VSCode 终端（Windows） | 继续使用 Unicode banner，显示正常 |
| AC-5 | 单元测试 | `buildAsciiBannerLines()`、`shouldUseAsciiFallback()` 有测试覆盖，`npm test` 通过 |

---

## §7 最终任务列表

| 任务 ID | 任务描述 | 验收标准 | 优先级 |
|---------|----------|----------|--------|
| TASK-1 | 设计并实现 ASCII 回退 banner（6 行，BMAD-SPECKIT 等效） | 视觉与 Unicode 版近似，纯 ASCII | P0 |
| TASK-2 | 实现 `shouldUseAsciiFallback()` 环境检测 | 在 ConHost 下返回 true，WT/VSCode/ConEmu/Cmder 下返回 false | P0 |
| TASK-3 | 在 `banner.js` 中根据检测结果切换 Unicode/ASCII | `buildBannerLines()` 或等价入口返回对应版本 | P0 |
| TASK-4 | 编写 `buildAsciiBannerLines()` 单元测试 | 断言 6 行、纯 ASCII、无块体字符 | P0 |
| TASK-5 | 编写 `shouldUseAsciiFallback()` 单元测试 | 覆盖 win32+ConHost、win32+WT、非 win32 | P0 |
| TASK-6 | 在 PowerShell 5.1（ConHost）中手动验收 | AC-1 通过 | P0 |
| TASK-7 | 在 Windows Terminal 中手动验收 | AC-3 通过 | P0 |
| TASK-8 | 运行 `npm test` 确保无回归 | 全部通过 | P0 |

---

**文档版本**: 1.0  
**创建日期**: 2026-03-08  
**创建者**: Party-Mode 多角色辩论（批判审计员、Winston 架构师、Mary 分析师、Amelia 开发、Quinn 测试、John 产品经理）
