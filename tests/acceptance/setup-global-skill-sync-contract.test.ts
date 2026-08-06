import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKILL_NAME = 'goal-contract-partition-orchestrator';

function expectCanonicalSkillFiles(): void {
  const skillRoot = path.join(ROOT, '_bmad', 'skills', SKILL_NAME);
  expect(fs.existsSync(path.join(skillRoot, 'SKILL.md'))).toBe(true);
  expect(fs.existsSync(path.join(skillRoot, 'references', 'partition-protocol.md'))).toBe(true);
  expect(fs.existsSync(path.join(skillRoot, 'agents', 'openai.yaml'))).toBe(true);
}

describe('setup global skill sync contract', () => {
  it('PowerShell setup removes existing global skill directories before copying to avoid nested stale installs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'scripts', 'setup.ps1'), 'utf8');
    const optionalBlock = content.match(/\$OPTIONAL_SKILLS\s*=\s*@\(([\s\S]*?)\)/u)?.[1] ?? '';
    const optionalSkills = [...optionalBlock.matchAll(/'([^']+)'/gu)].map((match) => match[1]);

    expect(content).toContain("'npm-public-release'");
    expect(content).toContain("'requirements-contract-authoring'");
    expect(content).toContain("'req-trace-matrix-prompt-generator'");
    expect(optionalSkills).toContain(SKILL_NAME);
    expect(content).toContain('if (Test-Path $dest)');
    expect(content).toContain('Remove-Item -Path $dest -Recurse -Force');
    expect(content).toContain('Copy-Item -Path $src -Destination $dest -Recurse -Force');
    expectCanonicalSkillFiles();
  });

  it('shell setup removes existing global skill directories before copying to avoid nested stale installs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'scripts', 'setup.sh'), 'utf8');
    const optionalBlock = content.match(/^OPTIONAL_SKILLS=\(([^)]*)\)$/mu)?.[1] ?? '';
    const optionalSkills = optionalBlock.trim().split(/\s+/u);

    expect(content).toContain('npm-public-release');
    expect(content).toContain('requirements-contract-authoring');
    expect(content).toContain('req-trace-matrix-prompt-generator');
    expect(optionalSkills).toContain(SKILL_NAME);
    expect(content).toContain('$PKG_ROOT/_bmad/skills/$skill_name');
    expect(content).toContain('rm -rf "$DEST"');
    expect(content).toContain('cp -Rf "$SRC" "$DEST"');
    expectCanonicalSkillFiles();
  });
});
