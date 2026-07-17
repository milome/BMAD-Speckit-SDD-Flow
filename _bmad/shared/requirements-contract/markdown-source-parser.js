'use strict';

const crypto = require('node:crypto');

const PARSER_SCHEMA_VERSION = 'requirements-contract-markdown-source-ast/v1';
const PARSER_VERSION = 'requirements-contract-markdown-source-parser/v1';

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function lineEndingOf(value) {
  const crlfCount = (value.match(/\r\n/g) || []).length;
  const withoutCrLf = value.replace(/\r\n/g, '');
  const lfCount = (withoutCrLf.match(/\n/g) || []).length;
  const crCount = (withoutCrLf.match(/\r/g) || []).length;
  const kinds = [crlfCount > 0, lfCount > 0, crCount > 0].filter(Boolean).length;
  if (kinds > 1) return 'mixed';
  if (crlfCount > 0) return 'crlf';
  if (crCount > 0) return 'cr';
  if (lfCount > 0) return 'lf';
  return 'none';
}

function normalizeSource(value) {
  const hadBom = value.charCodeAt(0) === 0xfeff;
  const withoutBom = hadBom ? value.slice(1) : value;
  return {
    hadBom,
    sourceText: withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
  };
}

function normalizeCell(value) {
  return value.trim().replace(/\\\|/g, '|');
}

function splitTableLine(line) {
  const input = line.trim();
  const cells = [];
  let current = '';
  let escaped = false;
  let codeDelimiterLength = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (escaped) {
      current += character === '|' ? '|' : `\\${character}`;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '`') {
      let runLength = 1;
      while (input[index + runLength] === '`') runLength += 1;
      current += '`'.repeat(runLength);
      if (codeDelimiterLength === 0) {
        codeDelimiterLength = runLength;
      } else if (codeDelimiterLength === runLength) {
        codeDelimiterLength = 0;
      }
      index += runLength - 1;
      continue;
    }
    if (codeDelimiterLength === 0) {
      if (character === '[') bracketDepth += 1;
      if (character === ']' && bracketDepth > 0) bracketDepth -= 1;
      if (character === '(') parenDepth += 1;
      if (character === ')' && parenDepth > 0) parenDepth -= 1;
      if (character === '|' && bracketDepth === 0 && parenDepth === 0) {
        cells.push(normalizeCell(current));
        current = '';
        continue;
      }
    }
    current += character;
  }
  if (escaped) current += '\\';
  cells.push(normalizeCell(current));

  if (input.startsWith('|') && cells[0] === '') cells.shift();
  if (input.endsWith('|') && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isTableSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function fenceMap(lines, issues, sourcePath) {
  const ignored = new Array(lines.length).fill(false);
  let activeFence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!activeFence) {
      const opening = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (!opening) continue;
      activeFence = {
        marker: opening[1][0],
        length: opening[1].length,
        startLine: index + 1,
      };
      ignored[index] = true;
      continue;
    }
    ignored[index] = true;
    const closing = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
    if (
      closing &&
      closing[1][0] === activeFence.marker &&
      closing[1].length >= activeFence.length
    ) {
      activeFence = null;
    }
  }
  if (activeFence) {
    issues.push({
      code: 'unclosed_fenced_block',
      message: 'Markdown fenced block is not closed.',
      sourcePath,
      startLine: activeFence.startLine,
      endLine: lines.length,
      refs: [],
    });
  }
  return ignored;
}

function frontMatterRange(lines) {
  if (lines[0] !== '---') return null;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') return { start: 0, end: index };
  }
  return null;
}

function headingPaths(lines, ignored, frontMatter) {
  const paths = [];
  const headings = [];
  const current = [];
  for (let index = 0; index < lines.length; index += 1) {
    const inFrontMatter =
      frontMatter && index >= frontMatter.start && index <= frontMatter.end;
    if (!ignored[index] && !inFrontMatter) {
      const heading = lines[index].match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const level = heading[1].length;
        const text = heading[2].trim();
        current.splice(level - 1);
        current[level - 1] = text;
        headings.push({ level, text, startLine: index + 1, endLine: index + 1 });
      }
    }
    paths[index] = current.filter(Boolean);
  }
  return { headings, paths };
}

function yamlAuthorityBlocks(lines, ignored, authorityRootKeys, sourcePath, issues) {
  const allowed = new Set(authorityRootKeys || []);
  const firstByKey = new Map();
  const blocks = [];
  if (allowed.size === 0) return blocks;

  for (let index = 0; index < lines.length; index += 1) {
    if (ignored[index]) continue;
    const match = lines[index].match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(?:#.*)?$/);
    if (!match || !allowed.has(match[1])) continue;
    const next = lines[index + 1] || '';
    if (next && !/^\s+/.test(next)) continue;

    let endIndex = index;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (ignored[cursor]) break;
      if (line.trim() === '' || /^\s+/.test(line)) {
        endIndex = cursor;
        continue;
      }
      break;
    }

    const key = match[1];
    const firstLine = firstByKey.get(key);
    if (firstLine) {
      issues.push({
        code: 'duplicate_yaml_root_block',
        message: `Duplicate top-level YAML authority root: ${key}.`,
        sourcePath,
        startLine: index + 1,
        endLine: endIndex + 1,
        refs: [key, String(firstLine)],
      });
    } else {
      firstByKey.set(key, index + 1);
    }
    blocks.push({
      key,
      startLine: index + 1,
      endLine: endIndex + 1,
      rawText: lines.slice(index, endIndex + 1).join('\n'),
    });
    index = endIndex;
  }
  return blocks;
}

function parseTables(lines, ignored, headingPathByLine, sourcePath, issues) {
  const tables = [];
  const occupied = new Set();
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if (ignored[index] || ignored[index + 1]) continue;
    if (!lines[index].includes('|') || !lines[index + 1].includes('|')) continue;
    const columns = splitTableLine(lines[index]);
    const separator = splitTableLine(lines[index + 1]);
    if (!isTableSeparator(separator)) continue;
    if (columns.length !== separator.length) {
      issues.push({
        code: 'markdown_table_header_separator_mismatch',
        message: 'Markdown table header and separator column counts differ.',
        sourcePath,
        startLine: index + 1,
        endLine: index + 2,
        refs: [String(columns.length), String(separator.length)],
      });
      continue;
    }

    const rows = [];
    let endIndex = index + 1;
    for (let cursor = index + 2; cursor < lines.length; cursor += 1) {
      if (ignored[cursor] || !lines[cursor].includes('|') || lines[cursor].trim() === '') break;
      const values = splitTableLine(lines[cursor]);
      if (values.length !== columns.length) {
        issues.push({
          code: 'markdown_table_column_count_mismatch',
          message: 'Markdown table row column count differs from the header.',
          sourcePath,
          startLine: cursor + 1,
          endLine: cursor + 1,
          refs: [String(columns.length), String(values.length)],
        });
        endIndex = cursor;
        continue;
      }
      rows.push({
        startLine: cursor + 1,
        endLine: cursor + 1,
        values,
        cells: Object.fromEntries(columns.map((column, cellIndex) => [column, values[cellIndex]])),
        rawText: lines[cursor],
      });
      endIndex = cursor;
    }
    for (let cursor = index; cursor <= endIndex; cursor += 1) occupied.add(cursor);
    tables.push({
      headingPath: headingPathByLine[index] || [],
      columns,
      startLine: index + 1,
      endLine: endIndex + 1,
      rows,
    });
    index = endIndex;
  }
  return { tables, occupied };
}

function contentBlocks(lines, ignored, frontMatter, headingPathByLine, tables, occupied, yamlBlocks) {
  const excluded = new Set(occupied);
  for (const block of yamlBlocks) {
    for (let line = block.startLine; line <= block.endLine; line += 1) excluded.add(line - 1);
  }
  if (frontMatter) {
    for (let index = frontMatter.start; index <= frontMatter.end; index += 1) excluded.add(index);
  }
  const tableRowByLine = new Map();
  for (const table of tables) {
    for (const row of table.rows) {
      tableRowByLine.set(row.startLine - 1, { table, row });
    }
  }

  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (ignored[index]) continue;
    const tableRow = tableRowByLine.get(index);
    if (tableRow) {
      blocks.push({
        kind: 'table_row',
        startLine: index + 1,
        endLine: index + 1,
        headingPath: tableRow.table.headingPath,
        rawText: tableRow.row.rawText,
        text: tableRow.row.values.join(' | '),
        table: {
          columns: tableRow.table.columns,
          values: tableRow.row.values,
          cells: tableRow.row.cells,
        },
      });
      continue;
    }
    if (excluded.has(index)) continue;
    const line = lines[index];
    if (!line.trim() || /^\s{0,3}#{1,6}\s+/u.test(line)) continue;
    const list = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/u);
    blocks.push({
      kind: list ? 'list_item' : 'paragraph',
      startLine: index + 1,
      endLine: index + 1,
      headingPath: headingPathByLine[index] || [],
      rawText: line,
      text: (list ? list[1] : line).trim(),
    });
  }
  return blocks;
}

function parseRequirementsContractMarkdown(source, options = {}) {
  const sourcePath = String(options.sourcePath || '<memory>');
  if (typeof source !== 'string') {
    return {
      ok: false,
      document: null,
      issues: [
        {
          code: 'markdown_source_type_invalid',
          message: 'Markdown source must be a string.',
          sourcePath,
          startLine: 1,
          endLine: 1,
          refs: [],
        },
      ],
    };
  }

  const issues = [];
  const lineEnding = lineEndingOf(source);
  const normalized = normalizeSource(source);
  const lines = normalized.sourceText.split('\n');
  const ignored = fenceMap(lines, issues, sourcePath);
  const frontMatter = frontMatterRange(lines);
  const headingState = headingPaths(lines, ignored, frontMatter);
  const yamlBlocks = yamlAuthorityBlocks(
    lines,
    ignored,
    options.authorityRootKeys,
    sourcePath,
    issues
  );
  const tableState = parseTables(lines, ignored, headingState.paths, sourcePath, issues);
  const blocks = contentBlocks(
    lines,
    ignored,
    frontMatter,
    headingState.paths,
    tableState.tables,
    tableState.occupied,
    yamlBlocks
  );

  if (issues.length > 0) return { ok: false, document: null, issues };
  return {
    ok: true,
    issues: [],
    document: {
      schemaVersion: PARSER_SCHEMA_VERSION,
      parserVersion: PARSER_VERSION,
      sourcePath,
      sourceHash: sha256Text(normalized.sourceText),
      hadBom: normalized.hadBom,
      lineEnding,
      lineCount: lines.length,
      headings: headingState.headings,
      tables: tableState.tables,
      yamlRootBlocks: yamlBlocks,
      blocks,
    },
  };
}

module.exports = {
  PARSER_SCHEMA_VERSION,
  PARSER_VERSION,
  parseRequirementsContractMarkdown,
  splitTableLine,
};
