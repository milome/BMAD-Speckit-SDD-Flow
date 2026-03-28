import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('training-ready sft docs contract', () => {
  it('documents canonical samples, exporter targets, validation, and bundle outputs', () => {
    const sftGuide = readRepoFile('docs/how-to/training-ready-sft-export.md');
    const cliReference = readRepoFile('docs/reference/speckit-cli.md');
    const sourceReference = readRepoFile('docs/reference/source-code.md');

    expect(sftGuide).toContain('CanonicalSftSample');
    expect(sftGuide).toContain('openai_chat');
    expect(sftGuide).toContain('hf_conversational');
    expect(sftGuide).toContain('hf_tool_calling');
    expect(sftGuide).toContain('bmad-speckit sft-preview');
    expect(sftGuide).toContain('bmad-speckit sft-validate');
    expect(sftGuide).toContain('bmad-speckit sft-bundle');
    expect(sftGuide).toContain('manifest.json');
    expect(sftGuide).toContain('validation-report.json');
    expect(sftGuide).toContain('rejection-report.json');

    expect(cliReference).toContain('sft-validate');
    expect(cliReference).toContain('sft-bundle');
    expect(cliReference).toContain('openai_chat');
    expect(cliReference).toContain('hf_conversational');
    expect(cliReference).toContain('hf_tool_calling');

    expect(sourceReference).toContain('packages/scoring/analytics/candidate-builder.ts');
    expect(sourceReference).toContain('packages/scoring/analytics/bundle-writer.ts');
    expect(sourceReference).toContain('packages/scoring/analytics/exporters/openai-chat.ts');
    expect(sourceReference).toContain('packages/scoring/analytics/exporters/hf-conversational.ts');
    expect(sourceReference).toContain('packages/scoring/analytics/exporters/hf-tool-calling.ts');
    expect(sourceReference).toContain('packages/bmad-speckit/src/runtime-client.js');
  });
});
