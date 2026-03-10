# BUGFIX: showBanner ASCII 艺术显示问题

## §1 现象/问题描述

用户报告以下问题：
1. **SPECKIT 显示错误**：ASCII 字符与 TAAG 输出不匹配
2. **间距问题**：BMAD 与 SPECKIT 之间的分隔符间距不足
3. **渐变色问题**：用户要求使用 24 位真彩色，当前使用 16 色 ANSI

### 复现步骤
```powershell
npx bmad-speckit init --help
```

### 预期结果
- BMAD 和 SPECKIT 字符与 TAAG ANSI Shadow 输出精确匹配
- 分隔符 `═` 位于 BMAD 和 SPECKIT 之间，间距适当
- 渐变色从深蓝渐变到青色再到浅灰（24 位真彩色）

### 实际结果
- SPECKIT 字符串空格数量与 TAAG 输出不一致
- 分隔符硬编码在 BMAD 第 3 行末尾，导致对齐问题
- 渐变色使用 16 色 ANSI，而非 24 位真彩色

---

## §2 根因分析

### 2.1 当前代码与 TAAG SPECKIT 精确对比

**当前代码第 181 行**：
```javascript
'██████╗ ███╗   ███╗ █████╗ ██████╗      ███████╗██████╗ ███████╗ ██████╗██╗ ██╗██╗████████╗'
```

**拆解 BMAD 部分**（前 37 字符）：
```
██████╗ ███╗   ███╗ █████╗ ██████╗
```
✅ BMAD 第 1 行与 TAAG 匹配

**拆解 SPECKIT 部分**（从第 43 字符开始）：
```
███████╗██████╗ ███████╗ ██████╗██╗ ██╗██╗████████╗
```

**TAAG SPECKIT 第 1 行**：
```
███████╗██████╗ ███████╗ ██████╗██╗  ██╗██╗████████╗
```

**差异定位**：
| 位置 | TAAG | 当前代码 | 差异 |
|------|------|----------|------|
| `███╗██████╗` 后 | `██████╗ ███████╗` | `██████╗ ███████╗` | ✓ |
| `█████╗` 后 | `██╗  ██╗` (两个空格) | `██╗ ██╗` (一个空格) | ❌ 空格数量 |

**根因修正**：问题不是"缺少 `███`"，而是 **空格数量不一致**。SPECKIT 第 1 行的 `██╗` 后应有 **两个空格**，当前代码只有 **一个空格**。

### 2.2 分隔符位置完整分析

**当前代码各行的 BMAD-SPECKIT 分隔情况**：

| 行号 | 分隔内容 | 问题 |
|------|----------|------|
| 1 | 6 个空格 `      ` | 无分隔符 |
| 2 | 5 个空格 `     ` | 无分隔符 |
| 3 | `  ═══  ` (含 `═` 分隔符) | 分隔符硬编码在 BMAD 第 3 行末尾 |
| 4 | 5 个空格 `     ` | 无分隔符 |
| 5 | 5 个空格 `     ` | 无分隔符 |
| 6 | 6 个空格 `      ` | 无分隔符 |

**问题汇总**：
1. 分隔符 `═` 仅出现在第 3 行，其他行无视觉分隔
2. 各行空格数量不一致（5-6 个不等）
3. 分隔符硬编码在 BMAD 字符串内部，违反关注点分离原则

### 2.3 渐变色实现问题

**当前实现**：
```javascript
const styles = [chalk.blue, chalk.blueBright, chalk.cyan, chalk.cyan, chalk.white, chalk.gray];
```

**用户需求**：24 位真彩色渐变（深蓝 → 青 → 浅灰）

**Windows PowerShell 兼容性**：
- PowerShell 7+ 支持 24 位真彩色
- Windows Terminal 支持 24 位真彩色
- 旧版 PowerShell (5.1) 可能回退到 16 色

**解决方案**：使用 `chalk.rgb()` 实现 24 位渐变，并提供终端检测回退机制。

### 2.4 行宽不一致

**BMAD 行宽**：所有行 37 字符（一致）

**SPECKIT 行宽分析**：
| 行号 | 字符数 | TAAG 输出 |
|------|--------|-----------|
| 1 | 51 | `███████╗██████╗ ███████╗ ██████╗██╗  ██╗██╗████████╗` |
| 2 | 51 | `██╔════╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝██║╚══██╔══╝` |
| 3 | 48 | `███████╗██████╔╝█████╗  ██║     █████╔╝ ██║   ██║` |
| 4 | 48 | `╚════██║██╔═══╝ ██╔══╝  ██║     ██╔═██╗ ██║   ██║` |
| 5 | 51 | `███████║██║     ███████╗╚██████╗██║  ██╗██║   ██║` |
| 6 | 51 | `╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝` |

**问题**：SPECKIT 行宽不一致（48-51 字符），这是 ANSI Shadow 字体的特性，需在拼接时保持对齐。

---

## §3 依据/参考

1. **TAAG ANSI Shadow**：https://www.patorjk.com/software/taag/#p=display&f=ANSI%20Shadow&t=BMAD-SPECKIT
2. **specify-cn BANNER**：https://github.com/Linfee/spec-kit-cn/blob/main/src/specify_cli/__init__.py
3. **Chalk 文档**：https://github.com/chalk/chalk#256-and-truebit-color-support

---

## §4 修复方案

### 4.1 架构重构

**目标**：分离 BMAD、分隔符、SPECKIT 为独立模块。

```javascript
/**
 * 构建 banner 行（纯函数，可测试）
 * @returns {string[]} 6 行 banner 字符串数组
 */
function buildBannerLines() {
  // BMAD (TAAG ANSI Shadow 精确输出)
  const bmadLines = [
    '██████╗ ███╗   ███╗ █████╗ ██████╗',
    '██╔══██╗████╗ ████║██╔══██╗██╔══██╗',
    '██████╔╝██╔████╔██║███████║██║  ██║',
    '██╔══██╗██║╚██╔╝██║██╔══██║██║  ██║',
    '██████╔╝██║ ╚═╝ ██║██║  ██║██████╔╝',
    '╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝',
  ];

  // SPECKIT (TAAG ANSI Shadow 精确输出 - 空格数量已修正)
  const speckitLines = [
    '███████╗██████╗ ███████╗ ██████╗██╗  ██╗██╗████████╗',  // 注意：██╗  ██╗ 有两个空格
    '██╔════╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝██║╚══██╔══╝',
    '███████╗██████╔╝█████╗  ██║     █████╔╝ ██║   ██║',
    '╚════██║██╔═══╝ ██╔══╝  ██║     ██╔═██╗ ██║   ██║',
    '███████║██║     ███████╗╚██████╗██║  ██╗██║   ██║',
    '╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝',
  ];

  const separator = '   ═══   '; // 可配置分隔符（3 空格 + 3 个双线字符 + 3 空格）

  return bmadLines.map((bmad, i) => bmad + separator + speckitLines[i]);
}
```

### 4.2 渐变色实现（含错误处理）

```javascript
/**
 * 应用渐变色到 banner 行
 * @param {string[]} lines - 6 行 banner 字符串
 * @param {object} chalk - chalk 实例
 * @returns {string[]} 带颜色的行
 */
function applyGradient(lines, chalk) {
  // 参数校验
  if (!chalk || typeof chalk.rgb !== 'function') {
    return lines; // 回退到无颜色
  }
  // 24 位真彩色渐变：深蓝 → 青 → 浅灰
  const colors = [
    { r: 21, g: 101, b: 192 },   // 深蓝 #1565c0
    { r: 30, g: 136, b: 229 },   // 蓝色
    { r: 0, g: 172, b: 193 },    // 青色 #00acc1
    { r: 77, g: 208, b: 225 },   // 浅青
    { r: 176, g: 190, b: 197 },  // 浅灰 #b0bec5
    { r: 224, g: 224, b: 224 },  // 灰白 #e0e0e0
  ];

  return lines.map((line, i) => {
    const c = colors[i];
    try {
      return chalk.rgb(c.r, c.g, c.b)(line);
    } catch (err) {
      // 回退到无颜色（可能原因：终端不支持 24 位色或 chalk 版本不兼容）
      if (process.env.DEBUG) {
        console.error('[bmad-speckit:debug] chalk.rgb() failed:', err.message);
      }
      return line;
    }
  });
}
```

### 4.3 终端兼容性检测（扩展覆盖）

```javascript
/**
 * 检测终端是否支持 24 位真彩色
 * @returns {boolean}
 */
function supportsTrueColor() {
  // 检查 COLORTERM 环境变量
  if (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit') {
    return true;
  }
  // Windows Terminal
  if (process.env.WT_SESSION) {
    return true;
  }
  // VSCode 终端
  if (process.env.TERM_PROGRAM === 'vscode') {
    return true;
  }
  // JetBrains 终端
  if (process.env.TERMINAL_EMULATOR === 'JetBrains') {
    return true;
  }
  // iTerm2
  if (process.env.TERM_PROGRAM === 'iTerm2') {
    return true;
  }
  // Alacritty
  if (process.env.TERM === 'alacritty') {
    return true;
  }
  // ConEmu
  if (process.env.ConEmuPID) {
    return true;
  }
  // Cmder
  if (process.env.CMDER_ROOT) {
    return true;
  }
  // 默认回退到 16 色
  return false;
}
```

### 4.4 重构后的 showBanner 函数

**模块导入说明**：
```javascript
// 在 init.js 文件顶部，这些函数应作为模块导出
// module.exports = { initCommand, showBanner, buildBannerLines, applyGradient, supportsTrueColor };
```

```javascript
function showBanner() {
  const pkg = require('../../package.json');
  const pad = ' '.repeat(16);

  // 构建 banner 行
  const lines = buildBannerLines();

  // 应用渐变色
  let coloredLines;
  if (supportsTrueColor()) {
    coloredLines = applyGradient(lines, chalk);
  } else {
    // 回退到 16 色（与当前实现一致：chalk.cyan 作为第 4 个颜色）
    const fallbackStyles = [chalk.blue, chalk.blueBright, chalk.cyan, chalk.cyan, chalk.white, chalk.gray];
    coloredLines = lines.map((line, i) => fallbackStyles[i](line));
  }

  // 添加左侧缩进
  const paddedLines = coloredLines.map((line) => pad + line);

  // 输出
  const subtitle = chalk.hex('#ff9800')('BMAD-Speckit - 规范驱动开发工具包');
  const version = chalk.gray(`v${pkg.version}`);

  console.log('');
  console.log(paddedLines.join('\n'));
  console.log('');
  console.log(pad + ' '.repeat(20) + subtitle);
  console.log(pad + ' '.repeat(24) + version);
  console.log('');
}
```

---

## §5 流程/建议流程

### 开发流程

1. **测试先行**：先编写测试用例验证 `buildBannerLines()` 返回值
2. **逐步重构**：从纯函数开始，逐步重构 `showBanner()`
3. **终端验证**：在 Windows Terminal 和 PowerShell 中验证显示效果
4. **回归测试**：运行完整测试套件确保无破坏

### 验证命令

```powershell
# 在 Windows Terminal 中
npx bmad-speckit init --help

# 在 PowerShell 7+ 中
pwsh -c "npx bmad-speckit init --help"

# 在 PowerShell 5.1 中（回退测试）
powershell -c "npx bmad-speckit init --help"
```

---

## §7 最终任务列表

| 任务 ID | 任务描述 | 验收标准 | 优先级 |
|---------|---------|---------|--------|
| TASK-1 | 编写测试用例：验证 `buildBannerLines()` 返回 6 行字符串 | 1. 断言返回数组长度为 6<br>2. 断言每行包含分隔符 `═`<br>3. 断言每行与预期字符串完全匹配 | P0 |
| TASK-2 | 编写测试用例：验证 BMAD 每行与 TAAG 输出精确匹配 | 测试定义完成，断言每行字符精确匹配 | P0 |
| TASK-3 | 编写测试用例：验证 SPECKIT 第一行包含 `██╗  ██╗`（两个空格） | 测试定义完成 | P0 |
| TASK-4 | ~~编写测试用例：验证每行包含分隔符 `═`~~（已合并到 TASK-1） | 已合并 | - |
| TASK-5 | 编写测试用例：验证 `supportsTrueColor()` 检测逻辑 | 测试定义完成，覆盖多种终端环境变量 | P1 |
| TASK-6 | 实现 `buildBannerLines()` 纯函数 | 测试通过 | P0 |
| TASK-7 | 实现 `applyGradient()` 渐变色函数（含错误处理） | 测试通过 | P0 |
| TASK-8 | 实现 `supportsTrueColor()` 终端检测函数 | 测试通过 | P1 |
| TASK-9 | 重构 `showBanner()` 使用新函数 | 测试通过 | P0 |
| TASK-10 | 集成测试：Windows Terminal 验证显示正常 | 截图确认 | P0 |
| TASK-11 | 集成测试：PowerShell 5.1 验证回退到 16 色 | 截图确认 | P1 |
| TASK-12 | 删除旧代码中硬编码的分隔符 | 无残留 | P0 |
| TASK-13 | 运行 `npm test` 确保所有现有测试通过 | 测试通过 | P0 |
| TASK-14 | Grep 搜索确认无其他文件硬编码 banner 格式 | 无其他依赖 | P1 |
| TASK-15 | 导出预期 banner 字符串常量供测试使用 | 常量导出完成 | P1 |

---

## 附录：TAAG 精确输出参考

### BMAD (ANSI Shadow)
```
██████╗ ███╗   ███╗ █████╗ ██████╗
██╔══██╗████╗ ████║██╔══██╗██╔══██╗
██████╔╝██╔████╔██║███████║██║  ██║
██╔══██╗██║╚██╔╝██║██╔══██║██║  ██║
██████╔╝██║ ╚═╝ ██║██║  ██║██████╔╝
╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝
```

### SPECKIT (ANSI Shadow) - 空格精确标记
```
███████╗██████╗ ███████╗ ██████╗██╗  ██╗██╗████████╗
██╔════╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝██║╚══██╔══╝
███████╗██████╔╝█████╗  ██║     █████╔╝ ██║   ██║
╚════██║██╔═══╝ ██╔══╝  ██║     ██╔═██╗ ██║   ██║
███████║██║     ███████╗╚██████╗██║  ██╗██║   ██║
╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝
```

**注意空格细节**：
- 第 1 行：`██╗  ██╗` 有 **两个空格**
- 第 3 行：`█████╗  ██║` 有 **两个空格**
- 第 3 行：`██║     █████` 有 **五个空格**

---

**文档版本**: 2.0 (审计修正版)
**创建日期**: 2026-03-08
**创建者**: Party-Mode 多角色讨论（批判审计员、Winston 架构师、Amelia 开发、John 产品）
**审计状态**: 第一轮审计发现 10 个 Gap，已修正