import { describe, expect, it } from 'vitest';
import { parseCsvLine, readAgentManifestRow } from '../../scripts/i18n/agent-manifest';

describe('agent manifest parser', () => {
  it('parses quoted csv fields with commas correctly', () => {
    const cells = parseCsvLine(
      '"architect","Winston","Architect","🏗️","distributed systems, cloud infrastructure","role"'
    );
    expect(cells).toStrictEqual([
      'architect',
      'Winston',
      'Architect',
      '🏗️',
      'distributed systems, cloud infrastructure',
      'role',
    ]);
  });

  it('reads an agent row from the project manifest', () => {
    const row = readAgentManifestRow(process.cwd(), 'architect');
    expect(row).toBeDefined();
    expect(row?.displayName).toBe('Winston');
    expect(row?.title).toBe('Architect');
    expect(row?.icon).toBe('🏗️');
  });
});
