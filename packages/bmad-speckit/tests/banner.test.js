/**
 * BMAD-Speckit Banner 显示测试 (BUGFIX_showBanner-ascii-art)
 * TDD 测试：验证 buildBannerLines, applyGradient, supportsTrueColor
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

// 导入被测函数（需要先在 init.js 中导出）
let bannerModule;

try {
  bannerModule = require('../src/commands/banner.js');
} catch (e) {
  // banner.js 尚未创建，测试中处理
  bannerModule = null;
}

// 预期 BMAD 行（TAAG ANSI Shadow 精确输出）
// 来源: BUGFIX_showBanner-ascii-art.md 附录
const EXPECTED_BMAD_LINES = [
  '██████╗ ███╗   ███╗ █████╗ ██████╗',
  '██╔══██╗████╗ ████║██╔══██╗██╔══██╗',
  '██████╔╝██╔████╔██║███████║██║  ██║',
  '██╔══██╗██║╚██╔╝██║██╔══██║██║  ██║',
  '██████╔╝██║ ╚═╝ ██║██║  ██║██████╔╝',
  '╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝',
];

// 预期 SPECKIT 行（TAAG ANSI Shadow 精确输出）
// 注意第 1 行：██╗  ██╗ 有两个空格（BUGFIX 文档强调的 bug 修复点）
const EXPECTED_SPECKIT_LINES = [
  '███████╗██████╗ ███████╗ ██████╗██╗  ██╗██╗████████╗',
  '██╔════╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝██║╚══██╔══╝',
  '███████╗██████╔╝█████╗  ██║     █████╔╝ ██║   ██║',
  '╚════██║██╔═══╝ ██╔══╝  ██║     ██╔═██╗ ██║   ██║',
  '███████║██║     ███████╗╚██████╗██║  ██╗██║   ██║',
  '╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝',
];

// 正式行为：仅中间一行(i===2)有 SEPARATOR(═══)，其余行无 Part2；SPECKIT 从第 SPECKIT_COL(62) 列起
const MIDDLE_LINE_INDEX = 2;
const ANSI_GOTO_62 = '\x1b[62G';

describe('TASK-1: buildBannerLines() 返回 6 行字符串', () => {
  it('应返回包含 6 行的数组', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines = bannerModule.buildBannerLines({ forceUnicode: true });
    assert.strictEqual(lines.length, 6, '应返回 6 行');
  });

  it('Unicode 分支仅中间一行包含分隔符 ═══，其余行无 dash', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines = bannerModule.buildBannerLines({ forceUnicode: true });
    const sep = bannerModule.SEPARATOR; // '   ═══   '
    for (let i = 0; i < lines.length; i++) {
      if (i === MIDDLE_LINE_INDEX) {
        assert.ok(lines[i].includes(sep), `第 ${i + 1} 行（中间行）应包含分隔符 ═══`);
      } else {
        assert.ok(!lines[i].includes(sep), `第 ${i + 1} 行不应包含分隔符 ═══`);
        assert.ok(!lines[i].includes('-'), `第 ${i + 1} 行不应包含 dash`);
      }
    }
  });
});

describe('buildBannerLines() Unicode 分支每行包含 ANSI 列定位 \\x1b[62G', () => {
  it('每行应包含 \\x1b[62G（SPECKIT 从第 62 列起对齐）', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines = bannerModule.buildBannerLines({ forceUnicode: true });
    for (let i = 0; i < lines.length; i++) {
      assert.ok(lines[i].includes(ANSI_GOTO_62), `第 ${i + 1} 行应包含 ANSI \\x1b[62G`);
    }
  });
});

describe('TASK-2: buildBannerLines() 返回正确结构', () => {
  it('每行应包含 BMAD + ANSI 列定位 + SPECKIT；仅中间行另有分隔符 ═══', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines = bannerModule.buildBannerLines({ forceUnicode: true });
    const sep = bannerModule.SEPARATOR;

    for (let i = 0; i < 6; i++) {
      assert.ok(lines[i].includes(EXPECTED_BMAD_LINES[i]), `第 ${i + 1} 行应包含 BMAD 部分`);
      assert.ok(lines[i].includes(ANSI_GOTO_62), `第 ${i + 1} 行应包含 ANSI \\x1b[62G`);
      assert.ok(lines[i].includes(EXPECTED_SPECKIT_LINES[i]), `第 ${i + 1} 行应包含 SPECKIT 部分`);
      if (i === MIDDLE_LINE_INDEX) {
        assert.ok(lines[i].includes(sep), `第 ${i + 1} 行（中间行）应包含分隔符 ═══`);
      }
    }
  });
});

describe('buildBannerLines() SPECKIT 从第 62 列起（Part2 与 Part3 之间仅 ANSI）', () => {
  it('每行应包含 \\x1b[62G 且 SPECKIT 内容紧接其后', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines = bannerModule.buildBannerLines({ forceUnicode: true });

    for (let i = 0; i < 6; i++) {
      assert.ok(lines[i].includes(ANSI_GOTO_62), `第 ${i + 1} 行应包含 \\x1b[62G`);
      const speckitIdx = lines[i].indexOf(EXPECTED_SPECKIT_LINES[i]);
      assert.ok(speckitIdx >= 0, `第 ${i + 1} 行应包含 SPECKIT 内容`);
      const after62G = lines[i].split(ANSI_GOTO_62)[1] || '';
      assert.ok(after62G.includes(EXPECTED_SPECKIT_LINES[i]), `第 ${i + 1} 行 \\x1b[62G 后应包含 SPECKIT`);
    }
  });
});

describe('TASK-3: SPECKIT 第一行包含两个空格', () => {
  it('SPECKIT 第一行 ██╗  ██╗ 应有两个空格', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines = bannerModule.buildBannerLines({ forceUnicode: true });
    const firstLine = lines[0];

    // 不依赖固定偏移：用 SPECKIT 首行已知内容定位
    const speckitStart = firstLine.indexOf(EXPECTED_SPECKIT_LINES[0]);
    assert.ok(speckitStart >= 0, '第一行应包含 SPECKIT 首行内容');
    const speckitPart = firstLine.substring(speckitStart);

    // BUGFIX: 验证 ██╗  ██╗ 有两个空格（原始代码只有一个空格，这是 bug）
    assert.ok(speckitPart.includes('██╗  ██╗'), 'SPECKIT 第一行应包含 "██╗  ██╗"（两个空格）');
  });
});

describe('TASK-5: supportsTrueColor() 终端检测逻辑', () => {
  it('应正确检测 24 位真彩色支持', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    assert.strictEqual(typeof bannerModule.supportsTrueColor, 'function', 'supportsTrueColor 应为函数');
  });

  it('应检测 COLORTERM=truecolor', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');

    const originalColorTerm = process.env.COLORTERM;
    process.env.COLORTERM = 'truecolor';

    const result = bannerModule.supportsTrueColor();
    assert.strictEqual(result, true, 'COLORTERM=truecolor 时应返回 true');

    process.env.COLORTERM = originalColorTerm;
  });

  it('应检测 COLORTERM=24bit', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');

    const originalColorTerm = process.env.COLORTERM;
    process.env.COLORTERM = '24bit';

    const result = bannerModule.supportsTrueColor();
    assert.strictEqual(result, true, 'COLORTERM=24bit 时应返回 true');

    process.env.COLORTERM = originalColorTerm;
  });

  it('应检测 WT_SESSION (Windows Terminal)', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');

    const originalWtSession = process.env.WT_SESSION;
    delete process.env.COLORTERM;
    process.env.WT_SESSION = 'some-session-id';

    const result = bannerModule.supportsTrueColor();
    assert.strictEqual(result, true, 'WT_SESSION 存在时应返回 true');

    if (originalWtSession === undefined) {
      delete process.env.WT_SESSION;
    } else {
      process.env.WT_SESSION = originalWtSession;
    }
  });
});

describe('TASK-6: buildBannerLines() 纯函数实现', () => {
  it('应返回纯函数（多次调用返回相同结果）', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines1 = bannerModule.buildBannerLines({ forceUnicode: true });
    const lines2 = bannerModule.buildBannerLines({ forceUnicode: true });
    assert.deepStrictEqual(lines1, lines2, '多次调用结果应相同');
  });
});

// BUGFIX_showBanner-powershell-kit-offset (TASK-4, TASK-5): buildAsciiBannerLines + shouldUseAsciiFallback 单元测试
describe('buildAsciiBannerLines() ASCII 回退 banner', () => {
  it('应存在并返回 6 行', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    assert.strictEqual(typeof bannerModule.buildAsciiBannerLines, 'function', 'buildAsciiBannerLines 应为函数');
    const lines = bannerModule.buildAsciiBannerLines();
    assert.strictEqual(lines.length, 6, '应返回 6 行');
  });

  it('每行应为纯 ASCII，无 Unicode 块体字符', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const lines = bannerModule.buildAsciiBannerLines();
    const blockChars = ['█', '║', '═', '╔', '╚', '╝', '╗'];
    for (let i = 0; i < lines.length; i++) {
      for (const c of blockChars) {
        assert.ok(!lines[i].includes(c), `第 ${i + 1} 行不应包含块体字符 "${c}"`);
      }
      for (let j = 0; j < lines[i].length; j++) {
        assert.ok(lines[i].charCodeAt(j) < 128, `第 ${i + 1} 行第 ${j + 1} 字符应为 ASCII`);
      }
    }
  });
});

// BUGFIX_showBanner-powershell-kit-offset (TASK-5): shouldUseAsciiFallback() 单元测试
describe('shouldUseAsciiFallback() 环境检测', () => {
  it('应存在 shouldUseAsciiFallback 函数', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    assert.strictEqual(typeof bannerModule.shouldUseAsciiFallback, 'function', 'shouldUseAsciiFallback 应为函数');
  });

  // 当前策略：不使用 ASCII 回退，使用空格填充修正宽度问题
  it('当前策略：始终返回 false（使用 Unicode + 空格填充）', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const env = {};
    const result = bannerModule.shouldUseAsciiFallback('win32', env);
    assert.strictEqual(result, false, '当前策略返回 false');
  });

  it('非 win32 应返回 false', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    const result = bannerModule.shouldUseAsciiFallback('darwin', {});
    assert.strictEqual(result, false, 'darwin 时应返回 false');
  });
});

describe('TASK-7: applyGradient() 渐变色函数', () => {
  it('应存在 applyGradient 函数', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');
    assert.strictEqual(typeof bannerModule.applyGradient, 'function', 'applyGradient 应为函数');
  });

  it('应接受 lines 和 chalk 参数', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');

    const mockChalk = {
      rgb: (r, g, b) => (str) => `[${r},${g},${b}]${str}[/color]`,
    };

    const lines = ['line1', 'line2'];
    const result = bannerModule.applyGradient(lines, mockChalk);

    assert.ok(Array.isArray(result), '应返回数组');
    assert.strictEqual(result.length, 2, '应返回相同数量的行');
  });

  it('参数无效时应返回原数组', () => {
    assert.ok(bannerModule, 'banner.js 模块应存在');

    const lines = ['line1', 'line2'];
    // 传入 null chalk
    const result = bannerModule.applyGradient(lines, null);
    assert.deepStrictEqual(result, lines, 'chalk 无效时应返回原数组');
  });
});
