import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(import.meta.dirname, '..', '..');

describe('consumer installation docs contract', () => {
  it('makes project-local install the durable off-repo runtime path', () => {
    const gettingStarted = readFileSync(
      path.join(ROOT, 'docs', 'tutorials', 'getting-started.md'),
      'utf8'
    );
    const consumerInstall = readFileSync(
      path.join(ROOT, 'docs', 'how-to', 'consumer-installation.md'),
      'utf8'
    );
    const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');

    expect(gettingStarted).toContain('普通消费项目不需要 clone 本仓库');
    expect(gettingStarted).toContain(
      'npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest'
    );
    expect(gettingStarted).toContain('npm ls bmad-speckit-sdd-flow --depth=0');
    expect(gettingStarted).toContain('npx --no-install bmad-speckit init');
    expect(gettingStarted).toContain('bmad-speckit-sdd-flow-<version>.tgz');
    expect(gettingStarted).toContain('npx --yes --package');
    expect(gettingStarted).toContain(
      '只适合一次性 CLI 执行、smoke test 或 CI artifact 检查'
    );
    expect(consumerInstall).toContain('最高优先级：另一台没有本仓库源码的机器');
    expect(consumerInstall).toContain(
      'npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest'
    );
    expect(consumerInstall).toContain('npm ls bmad-speckit-sdd-flow --depth=0');
    expect(consumerInstall).toContain('npx --no-install bmad-speckit init');
    expect(consumerInstall).toContain('bmad-speckit-sdd-flow-<version>.tgz');
    expect(consumerInstall).toContain('项目本地安装');
    expect(consumerInstall).toContain('npx --yes --package');
    expect(consumerInstall).toContain('只适合 smoke test、CI artifact 检查或一次性 bootstrap');
    expect(readme).toContain('Installation Matrix');
    expect(readme).toContain('Consumer Installation Guide');
    expect(readme).toContain('project-local install');
    expect(readme).toContain('npx --no-install');
  });
});
