import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(import.meta.dirname, '..', '..');

describe('consumer installation docs contract', () => {
  it('makes the off-repo consumer scenario explicit and treats tgz/root package install as the verified path', () => {
    const gettingStarted = readFileSync(path.join(ROOT, 'docs', 'tutorials', 'getting-started.md'), 'utf8');
    const consumerInstall = readFileSync(path.join(ROOT, 'docs', 'how-to', 'consumer-installation.md'), 'utf8');
    const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');

    expect(gettingStarted).toContain('最高优先级场景：另一台没有本仓库源码的机器');
    expect(gettingStarted).toContain('bmad-speckit-sdd-flow-<version>.tgz');
    expect(gettingStarted).toContain('已验证路径');
    expect(consumerInstall).toContain('最高优先级：另一台没有本仓库源码的机器');
    expect(consumerInstall).toContain('bmad-speckit-sdd-flow-<version>.tgz');
    expect(consumerInstall).toContain('off-repo 场景下的最高优先级默认方案');
    expect(readme).toContain('Consumer Installation Guide');
    expect(readme).toContain('verified off-repo path');
  });
});
