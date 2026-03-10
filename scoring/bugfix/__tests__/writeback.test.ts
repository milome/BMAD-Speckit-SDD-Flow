import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { writebackBugfixToStory, ParseError } from '../writeback';

const TMP = path.join(process.cwd(), 'scoring', 'data', 'e5s1-writeback-tmp');

describe('writeback', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP)) {
      fs.rmSync(TMP, { recursive: true });
    }
    fs.mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    if (fs.existsSync(TMP)) {
      fs.rmSync(TMP, { recursive: true });
    }
  });

  it('BUGFIX §7 正确解析已完成任务（- [x] 格式）', () => {
    const bugfixPath = path.join(TMP, 'bugfix.md');
    fs.writeFileSync(
      bugfixPath,
      `# BUGFIX
## §7 最终任务列表
- [x] 修复登录逻辑
- [ ] 未完成项
- [x] 添加单元测试
`,
      'utf-8'
    );
    const progressPath = path.join(TMP, 'progress.txt');
    const r = writebackBugfixToStory(bugfixPath, progressPath, 'br-1', '5.1');
    expect(r.success).toBe(true);
    expect(r.appendedLines).toHaveLength(2);
    expect(r.appendedLines[0]).toContain('修复登录逻辑');
    expect(r.appendedLines[1]).toContain('添加单元测试');
  });

  it('progress.txt 不存在 → 创建并写入', () => {
    const bugfixPath = path.join(TMP, 'bugfix.md');
    fs.writeFileSync(
      bugfixPath,
      `# BUGFIX
## §7 最终任务列表
- [x] 任务1
`,
      'utf-8'
    );
    const progressPath = path.join(TMP, 'subdir', 'progress.txt');
    const r = writebackBugfixToStory(bugfixPath, progressPath, 'br-1', '5.1');
    expect(r.success).toBe(true);
    expect(fs.existsSync(progressPath)).toBe(true);
  });

  it('progress.txt 已存在 → 追加写入', () => {
    const bugfixPath = path.join(TMP, 'bugfix.md');
    fs.writeFileSync(
      bugfixPath,
      `# BUGFIX
## §7 最终任务列表
- [x] 新任务
`,
      'utf-8'
    );
    const progressPath = path.join(TMP, 'progress.txt');
    fs.writeFileSync(progressPath, 'existing line\n', 'utf-8');
    const r = writebackBugfixToStory(bugfixPath, progressPath, 'br-1', '5.1');
    expect(r.success).toBe(true);
    const content = fs.readFileSync(progressPath, 'utf-8');
    expect(content).toContain('existing line');
    expect(content).toContain('新任务');
  });

  it('BUGFIX 文档无 §7 标题 → 抛 ParseError', () => {
    const bugfixPath = path.join(TMP, 'bugfix.md');
    fs.writeFileSync(bugfixPath, '# BUGFIX\n\n## §1 问题\n无 §7', 'utf-8');
    const progressPath = path.join(TMP, 'progress.txt');
    expect(() => writebackBugfixToStory(bugfixPath, progressPath, 'br-1', '5.1')).toThrow(
      ParseError
    );
  });

  it('回写行格式正确（时间戳 + branchId + storyId + 摘要）', () => {
    const bugfixPath = path.join(TMP, 'bugfix.md');
    fs.writeFileSync(
      bugfixPath,
      `# BUGFIX
## §7 最终任务列表
- [x] 摘要内容
`,
      'utf-8'
    );
    const progressPath = path.join(TMP, 'progress.txt');
    const r = writebackBugfixToStory(bugfixPath, progressPath, 'br-99', '5.2');
    expect(r.appendedLines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
    expect(r.appendedLines[0]).toContain('BUGFIX(br-99)');
    expect(r.appendedLines[0]).toContain('Story(5.2)');
    expect(r.appendedLines[0]).toContain('摘要内容');
  });

  it('Markdown checkbox 变体支持（[X]、* [x]、缩进、有序）', () => {
    const bugfixPath = path.join(TMP, 'bugfix.md');
    fs.writeFileSync(
      bugfixPath,
      `# BUGFIX
## §7 最终任务列表
- [X] 大写X
* [x] 星号
  1. [x] 有序列表
`,
      'utf-8'
    );
    const progressPath = path.join(TMP, 'progress.txt');
    const r = writebackBugfixToStory(bugfixPath, progressPath, 'br-1', '5.1');
    expect(r.appendedLines.length).toBeGreaterThanOrEqual(3);
    expect(r.appendedLines.some((l) => l.includes('大写X'))).toBe(true);
    expect(r.appendedLines.some((l) => l.includes('星号'))).toBe(true);
    expect(r.appendedLines.some((l) => l.includes('有序列表'))).toBe(true);
  });
});
