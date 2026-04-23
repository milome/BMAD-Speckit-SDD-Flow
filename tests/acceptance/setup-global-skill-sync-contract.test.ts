import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('setup global skill sync contract', () => {
  it('PowerShell setup removes existing global skill directories before copying to avoid nested stale installs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'scripts', 'setup.ps1'), 'utf8');
    expect(content).toContain("'npm-public-release'");
    expect(content).toContain('if (Test-Path $dest)');
    expect(content).toContain('Remove-Item -Path $dest -Recurse -Force');
    expect(content).toContain('Copy-Item -Path $src -Destination $dest -Recurse -Force');
  });

  it('shell setup removes existing global skill directories before copying to avoid nested stale installs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'scripts', 'setup.sh'), 'utf8');
    expect(content).toContain('npm-public-release');
    expect(content).toContain('$PKG_ROOT/_bmad/skills/$skill_name');
    expect(content).toContain('rm -rf "$DEST"');
    expect(content).toContain('cp -Rf "$SRC" "$DEST"');
  });
});
