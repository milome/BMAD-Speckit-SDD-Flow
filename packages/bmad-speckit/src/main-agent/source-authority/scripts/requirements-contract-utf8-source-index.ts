import { sourceBytesHash } from './requirements-contract-hash-domains';

export interface Utf8LineIndex {
  byteLength: number;
  lineStartOffsets: number[];
}

export function buildUtf8LineIndex(bytes: Buffer): Utf8LineIndex {
  if (!Buffer.isBuffer(bytes)) throw new Error('requirements_utf8_source_bytes_invalid');
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    throw new Error('requirements_utf8_source_invalid');
  }
  const lineStartOffsets = [0];
  for (let index = 0; index < bytes.length; index += 1) {
    if (
      (bytes[index] === 0x0a || bytes[index] === 0x0d) &&
      !(bytes[index] === 0x0d && bytes[index + 1] === 0x0a) &&
      index + 1 < bytes.length
    ) {
      lineStartOffsets.push(index + 1);
    } else if (bytes[index] === 0x0a && index + 1 < bytes.length) {
      lineStartOffsets.push(index + 1);
    }
  }
  return { byteLength: bytes.length, lineStartOffsets };
}

export function lineRangeToByteRange(
  index: Utf8LineIndex,
  startLine: number,
  endLine: number
): { startUtf8Byte: number; endUtf8ByteExclusive: number } {
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine ||
    endLine > index.lineStartOffsets.length
  ) {
    throw new Error('requirements_utf8_line_range_invalid');
  }
  return {
    startUtf8Byte: index.lineStartOffsets[startLine - 1]!,
    endUtf8ByteExclusive:
      endLine < index.lineStartOffsets.length
        ? index.lineStartOffsets[endLine]!
        : index.byteLength,
  };
}

export function sliceAndHashSourceRange(
  bytes: Buffer,
  range: { startUtf8Byte: number; endUtf8ByteExclusive: number }
): string {
  const slice = bytes.subarray(range.startUtf8Byte, range.endUtf8ByteExclusive);
  if (
    !Number.isSafeInteger(range.startUtf8Byte) ||
    !Number.isSafeInteger(range.endUtf8ByteExclusive) ||
    range.startUtf8Byte < 0 ||
    range.endUtf8ByteExclusive <= range.startUtf8Byte ||
    range.endUtf8ByteExclusive > bytes.length ||
    !Buffer.from(slice.toString('utf8'), 'utf8').equals(slice)
  ) {
    throw new Error('requirements_utf8_byte_range_invalid');
  }
  return sourceBytesHash(slice);
}
