import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime write-context script contract', () => {
  it('documents explicit target file usage and no longer presents root runtime-context.json as the target model', () => {
    const root = process.cwd();
    const script = readFileSync(path.join(root, 'scripts', 'write-runtime-context.cjs'), 'utf8');

    expect(script).toContain('Usage: node write-runtime-context.cjs <targetFile>');
    expect(script).toContain("const targetFileArg = process.argv[2]");
    expect(script).toContain('[workflow] [step] [artifactPath]');
    expect(script).toContain('payload.workflow = String(workflowArg).trim()');
    expect(script).toContain('payload.step = String(stepArg).trim()');
    expect(script).toContain('payload.artifactPath = String(artifactPathArg).trim()');
    expect(script).not.toContain('Write `.bmad/runtime-context.json`');
    expect(script).not.toContain("const root = process.argv[2]");
  });

  it('keeps the published runtime-emit write script aligned with workflow/step/artifactPath support', () => {
    const root = process.cwd();
    const script = readFileSync(path.join(root, 'packages', 'runtime-emit', 'write-runtime-context.cjs'), 'utf8');

    expect(script).toContain('Usage: node write-runtime-context.cjs <targetFile>');
    expect(script).toContain('[workflow] [step] [artifactPath]');
    expect(script).toContain('payload.workflow = String(workflowArg).trim()');
    expect(script).toContain('payload.step = String(stepArg).trim()');
    expect(script).toContain('payload.artifactPath = String(artifactPathArg).trim()');
    expect(script).not.toContain('.bmad/runtime-context.json');
  });
});
