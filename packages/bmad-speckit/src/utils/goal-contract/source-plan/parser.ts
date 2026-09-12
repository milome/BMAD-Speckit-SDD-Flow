const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');
const yaml = require('js-yaml');

interface SourcePlanFence {
  fenceType: 'metadata' | 'node';
  data: unknown;
  parseError: string | null;
  lineStart: number;
  lineEnd: number;
  startByte: number;
  endByteExclusive: number;
  exactTextHash: string;
  spanId: string;
}

interface ParsedStandaloneSourcePlan {
  sourceText: string;
  sourceBytes: number;
  sourceHash: string;
  sourceArtifactId: string;
  fences: SourcePlanFence[];
}

interface SourceLine {
  content: string;
  raw: string;
  lineNumber: number;
  startByte: number;
  endByteExclusive: number;
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function sourceLines(text: string): SourceLine[] {
  if (text.length === 0) {
    return [{ content: '', raw: '', lineNumber: 1, startByte: 0, endByteExclusive: 0 }];
  }
  const lines: SourceLine[] = [];
  let charOffset = 0;
  let byteOffset = 0;
  while (charOffset < text.length) {
    const newline = text.indexOf('\n', charOffset);
    const end = newline === -1 ? text.length : newline + 1;
    const raw = text.slice(charOffset, end);
    const rawBytes = Buffer.byteLength(raw, 'utf8');
    const withoutLf = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
    const content = withoutLf.endsWith('\r') ? withoutLf.slice(0, -1) : withoutLf;
    lines.push({
      content,
      raw,
      lineNumber: lines.length + 1,
      startByte: byteOffset,
      endByteExclusive: byteOffset + rawBytes,
    });
    charOffset = end;
    byteOffset += rawBytes;
  }
  return lines;
}

function parseStandaloneSourcePlan(input: {
  sourceText?: string;
  rawBytes?: Buffer;
}): ParsedStandaloneSourcePlan {
  const bytes = input.rawBytes ?? Buffer.from(input.sourceText ?? '', 'utf8');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const sourceHash = sha256(bytes);
  const lines = sourceLines(text);
  const fences: SourcePlanFence[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^```(standalone-source-plan|standalone-source-plan-node)\s*$/u.exec(
      lines[index].content
    );
    if (!opening) continue;
    let closing = index + 1;
    while (closing < lines.length && !/^```\s*$/u.test(lines[closing].content)) closing += 1;
    const hasClosing = closing < lines.length;
    const finalIndex = hasClosing ? closing : lines.length - 1;
    const exactText = lines.slice(index, finalIndex + 1).map((line) => line.raw).join('');
    const body = lines.slice(index + 1, finalIndex).map((line) => line.content).join('\n');
    let data: unknown = null;
    let parseError: string | null = hasClosing ? null : 'source_plan_fence_unclosed';
    if (hasClosing) {
      try {
        data = yaml.load(body);
      } catch (error) {
        parseError = error instanceof Error ? error.message : String(error);
      }
    }
    const startByte = lines[index].startByte;
    const endByteExclusive = lines[finalIndex].endByteExclusive;
    fences.push({
      fenceType: opening[1] === 'standalone-source-plan' ? 'metadata' : 'node',
      data,
      parseError,
      lineStart: lines[index].lineNumber,
      lineEnd: lines[finalIndex].lineNumber,
      startByte,
      endByteExclusive,
      exactTextHash: sha256(exactText),
      spanId: `SPAN-${sha256(`${sourceHash}:${startByte}:${endByteExclusive}:${exactText}`).slice(7, 23).toUpperCase()}`,
    });
    index = finalIndex;
  }

  return {
    sourceText: text,
    sourceBytes: bytes.length,
    sourceHash,
    sourceArtifactId: `source-plan:${sourceHash.slice(7, 23)}`,
    fences,
  };
}

module.exports = { parseStandaloneSourcePlan };
