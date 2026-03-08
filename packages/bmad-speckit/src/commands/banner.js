/**
 * Banner module - BMAD-SPECKIT ASCII 艺术显示
 * BUGFIX_showBanner-ascii-art: 分离 BMAD、分隔符、SPECKIT 为独立模块
 * BUGFIX_showBanner-powershell-kit-offset: Windows 终端块体字符宽度修正
 *
 * 核心问题：Windows 终端对 Unicode 块体字符（█、═、║）渲染为 2 列宽，
 * 导致累积误差使 SPECKIT 出现阶梯状错位。
 *
 * 解决方案：使用 ANSI 光标定位（\x1b[<col>G）确保分隔符和 SPECKIT 从固定列开始，
 * 避免依赖字符宽度累积。列数基于 BMAD 最大渲染宽度 69。
 */
const chalk = require('chalk').default ?? require('chalk');

// BMAD 行（TAAG ANSI Shadow 精确输出）
const BMAD_LINES = [
  '██████╗ ███╗   ███╗ █████╗ ██████╗',
  '██╔══██╗████╗ ████║██╔══██╗██╔══██╗',
  '██████╔╝██╔████╔██║███████║██║  ██║',
  '██╔══██╗██║╚██╔╝██║██╔══██║██║  ██║',
  '██████╔╝██║ ╚═╝ ██║██║  ██║██████╔╝',
  '╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝',
];

// SPECKIT 行（TAAG ANSI Shadow 精确输出）
const SPECKIT_LINES = [
  '███████╗██████╗ ███████╗ ██████╗██╗  ██╗██╗████████╗',
  '██╔════╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝██║╚══██╔══╝',
  '███████╗██████╔╝█████╗  ██║     █████╔╝ ██║   ██║',
  '╚════██║██╔═══╝ ██╔══╝  ██║     ██╔═██╗ ██║   ██║',
  '███████║██║     ███████╗╚██████╗██║  ██╗██║   ██║',
  '╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝',
];

// 分隔符（3 空格 + 3 个双线字符 + 3 空格），供 ASCII 或测试引用
const SEPARATOR = '   ═══   ';
const SEPARATOR_RENDER_WIDTH = 12;  // ═ 渲染为 2 列
const SPACING = '         ';        // 9 个空格，渲染宽度 9

// Unicode 分支分隔符：无空格 dash，渲染宽度 1（TASKS_BUGFIX_banner-dash-forward-col）
const DASH = '-';
const DASH_RENDER_WIDTH = 1;

// ASCII 回退版本
const ASCII_BMAD_LINES = [
  ' #####  #   #  #   #   ###   #####',
  ' #   #  ##  #  #   #  #   #  #   #',
  ' #####  # # #  #   #  #####  #####',
  ' #   #  #  ##  #   #  #   #  #   #',
  ' #####  #   #   ###   #   # #####',
  ' =====  ===   =====  ===   =====',
];

const ASCII_SPECKIT_LINES = [
  ' #####  #####  #####   ###   #  #  #  #####',
  ' #   #  #   #  #   #  #   #  #  #  #  #   #',
  ' #####  #####  #####  #     #  #  #  #####',
  '     #  #   #  #   #  #   #  #  #  #  #   #',
  ' #####  #####  #####   ###   ###   #  #  #',
  ' =====  =====  =====  =====  ===   ===  ===',
];

const ASCII_SEPARATOR = '   ===   ';

/**
 * 计算字符串在终端中的实际渲染宽度
 * Windows 终端下 Unicode 块体字符（█、═、║ 等）渲染为 2 列宽
 */
function getRenderWidth(str) {
  let width = 0;
  for (const c of str) {
    const code = c.charCodeAt(0);
    // U+2580-U+259F: 块体字符
    // U+2500-U+257F: 制表符
    if ((code >= 0x2580 && code <= 0x259F) || (code >= 0x2500 && code <= 0x257F)) {
      width += 2;
    } else if (code < 128) {
      width += 1;
    } else {
      width += 1;
    }
  }
  return width;
}

// BMAD 各行的渲染宽度
const BMAD_RENDER_WIDTHS = BMAD_LINES.map(getRenderWidth);
const BMAD_MAX_RENDER_WIDTH = Math.max(...BMAD_RENDER_WIDTHS);

function shouldUseAsciiFallback(platform = process.platform, env = process.env) {
  return false;
}

function buildAsciiBannerLines() {
  return ASCII_BMAD_LINES.map((bmad, i) => {
    const separator = i === 2 ? ASCII_SEPARATOR : '         ';
    return bmad + separator + ASCII_SPECKIT_LINES[i];
  });
}

/**
 * 构建 banner 行
 * Unicode 分支：Part1(BMAD) + Part2(DASH) + ANSI 列定位 + Part3(SPECKIT)。
 * speckitCol = BMAD_MAX_RENDER_WIDTH + 1 + getRenderWidth(Part2)，Part2 为 DASH 时 = 71，实现「往前推进」。
 */
function buildBannerLines(opts = {}) {
  const useAscii = !opts.forceUnicode && shouldUseAsciiFallback();
  if (useAscii) {
    return buildAsciiBannerLines();
  }

  const speckitCol = BMAD_MAX_RENDER_WIDTH + 1 + getRenderWidth(DASH);  // 69 + 1 + 1 = 71
  const ansiGoto = '\x1b[' + speckitCol + 'G';

  return BMAD_LINES.map((bmad, i) => {
    return bmad + DASH + ansiGoto + SPECKIT_LINES[i];
  });
}

function applyGradient(lines, chalkInstance) {
  if (!chalkInstance || typeof chalkInstance.rgb !== 'function') {
    return lines;
  }

  const colors = [
    { r: 21, g: 101, b: 192 },
    { r: 30, g: 136, b: 229 },
    { r: 0, g: 172, b: 193 },
    { r: 77, g: 208, b: 225 },
    { r: 176, g: 190, b: 197 },
    { r: 224, g: 224, b: 224 },
  ];

  return lines.map((line, i) => {
    const c = colors[i];
    try {
      return chalkInstance.rgb(c.r, c.g, c.b)(line);
    } catch (err) {
      return line;
    }
  });
}

function supportsTrueColor() {
  if (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit') return true;
  if (process.env.WT_SESSION) return true;
  if (process.env.TERM_PROGRAM === 'vscode') return true;
  if (process.env.TERMINAL_EMULATOR === 'JetBrains') return true;
  if (process.env.TERM_PROGRAM === 'iTerm2') return true;
  if (process.env.TERM === 'alacritty') return true;
  if (process.env.ConEmuPID) return true;
  if (process.env.CMDER_ROOT) return true;
  return false;
}

function getExpectedBmadLines() { return [...BMAD_LINES]; }
function getExpectedSpeckitLines() { return [...SPECKIT_LINES]; }
/** Unicode 分支实际使用的分隔符（dash） */
function getSeparator() { return DASH; }
function getUnicodeSeparator() { return DASH; }

module.exports = {
  buildBannerLines,
  buildAsciiBannerLines,
  shouldUseAsciiFallback,
  applyGradient,
  supportsTrueColor,
  getExpectedBmadLines,
  getExpectedSpeckitLines,
  getSeparator,
  getUnicodeSeparator,
  getRenderWidth,
  BMAD_MAX_RENDER_WIDTH,
  BMAD_RENDER_WIDTHS,
  DASH,
  DASH_RENDER_WIDTH,
};