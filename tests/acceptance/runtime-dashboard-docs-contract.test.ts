import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('runtime dashboard docs contract', () => {
  it('documents MCP-first runtime access, web fallback, and runtime snapshot inspection', () => {
    const runtimeGuide = readRepoFile('docs/how-to/runtime-dashboard.md');
    const cliReference = readRepoFile('docs/reference/speckit-cli.md');
    const sourceReference = readRepoFile('docs/reference/source-code.md');

    expect(runtimeGuide).toContain('bmad-speckit runtime-mcp');
    expect(runtimeGuide).toContain('bmad-speckit dashboard-live');
    expect(runtimeGuide).toContain('MCP-first');
    expect(runtimeGuide).toContain('fallback');
    expect(runtimeGuide).toContain('/api/snapshot');
    expect(runtimeGuide).toContain('runtime_context');
    expect(runtimeGuide).toContain('stage_timeline');
    expect(runtimeGuide).toContain('score_detail');
    expect(runtimeGuide).toContain('sft_summary');

    expect(cliReference).toContain('runtime-mcp');
    expect(cliReference).toContain('dashboard-live');
    expect(cliReference).toContain('sft-preview');
    expect(cliReference).toContain('sft-bundle');

    expect(sourceReference).toContain('packages/scoring/dashboard/live-server.ts');
    expect(sourceReference).toContain('packages/scoring/dashboard/mcp-server.ts');
    expect(sourceReference).toContain('packages/scoring/dashboard/runtime-query.ts');
    expect(sourceReference).toContain('packages/bmad-speckit/src/commands/runtime-mcp.js');
    expect(sourceReference).toContain('packages/bmad-speckit/src/commands/dashboard-live.js');
  });
});
