import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { auditRequirementsContractDirectParserBypass } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-direct-parser-bypass-audit';

describe('requirements contract direct parser bypass audit', () => {
  it('passes consumers that call only the canonical parser facade', () => {
    const result = auditRequirementsContractDirectParserBypass({
      files: [
        {
          path: `src/consumer-${randomUUID()}.ts`,
          source:
            "import { parseRequirementsContractSourceText } from './requirements-contract-source-parser';\n" +
            'export const parse = parseRequirementsContractSourceText;\n',
        },
      ],
    });

    expect(result.decision).toBe('pass');
    expect(result.findings).toEqual([]);
  });

  it('blocks raw table parsing, direct confirmation extraction, and local heading authority', () => {
    const result = auditRequirementsContractDirectParserBypass({
      files: [
        {
          path: `src/raw-table-${randomUUID()}.ts`,
          source: "const cells = line.split('|');\n",
        },
        {
          path: `src/direct-confirmation-${randomUUID()}.ts`,
          source: "const block = text.match(/implementationConfirmation:[\\s\\S]*/u);\n",
        },
        {
          path: `src/local-headings-${randomUUID()}.ts`,
          source: "const REQUIRED_HEADINGS = ['## Requirements'];\n",
        },
      ],
    });

    expect(result.decision).toBe('block');
    expect(new Set(result.findings.map((finding) => finding.code))).toEqual(
      new Set([
        'raw_pipe_table_parser',
        'direct_confirmation_parser',
        'local_required_heading_registry',
      ])
    );
  });
});
