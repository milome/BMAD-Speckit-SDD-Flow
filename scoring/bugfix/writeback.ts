/**
 * B12: Bugfix 数据回写到主 Story 的 progress.txt
 */
import * as fs from 'fs';
import * as path from 'path';

export interface WritebackResult {
  success: boolean;
  appendedLines: string[];
  progressPath: string;
}

const SECTION_7_REGEX = /^##\s*§7\s+[^\n]*/im;
const CHECKBOX_REGEX = /^\s*[-*+]?\s*\d*\.?\s*\[(x|X)\]\s+(.+)$/;

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * 解析 BUGFIX §7 下已完成的 checkbox 任务。
 * 支持 - [x]、* [X]、  - [x]、1. [x] 等变体。
 */
function extractCompletedTasks(content: string): string[] {
  const sectionMatch = content.match(SECTION_7_REGEX);
  if (!sectionMatch) return [];
  const startIdx = content.indexOf(sectionMatch[0]);
  const afterSection = content.slice(startIdx + sectionMatch[0].length);
  const nextSection = afterSection.match(/\n##\s+/);
  const sectionContent = nextSection
    ? afterSection.slice(0, nextSection.index)
    : afterSection;
  const lines = sectionContent.split(/\r?\n/);
  const result: string[] = [];
  for (const line of lines) {
    const m = line.match(CHECKBOX_REGEX);
    if (m) result.push(m[2].trim());
  }
  return result;
}

/**
 * BUGFIX §7 已完成任务回写到 progress.txt。
 * progress.txt 不存在则创建；存在则追加。
 */
export function writebackBugfixToStory(
  bugfixDocPath: string,
  storyProgressPath: string,
  branchId: string,
  storyId: string
): WritebackResult {
  const resolvedBugfix = path.isAbsolute(bugfixDocPath)
    ? bugfixDocPath
    : path.resolve(process.cwd(), bugfixDocPath);
  const resolvedProgress = path.isAbsolute(storyProgressPath)
    ? storyProgressPath
    : path.resolve(process.cwd(), storyProgressPath);

  if (!fs.existsSync(resolvedBugfix)) {
    throw new ParseError(`BUGFIX document not found: ${resolvedBugfix}`);
  }
  const content = fs.readFileSync(resolvedBugfix, 'utf-8');
  if (!content.includes('## §7') && !/^##\s*§7\s/im.test(content)) {
    throw new ParseError('BUGFIX document has no ## §7 section');
  }

  const tasks = extractCompletedTasks(content);
  const appendedLines: string[] = [];
  const ts = new Date().toISOString();
  for (const task of tasks) {
    const line = `[${ts}] BUGFIX(${branchId}) → Story(${storyId}): ${task}`;
    appendedLines.push(line);
  }

  const dir = path.dirname(resolvedProgress);
  fs.mkdirSync(dir, { recursive: true });
  const lineContent = appendedLines.map((l) => l + '\n').join('');
  if (fs.existsSync(resolvedProgress)) {
    fs.appendFileSync(resolvedProgress, lineContent, 'utf-8');
  } else {
    fs.writeFileSync(resolvedProgress, lineContent, 'utf-8');
  }

  return {
    success: true,
    appendedLines,
    progressPath: resolvedProgress,
  };
}
