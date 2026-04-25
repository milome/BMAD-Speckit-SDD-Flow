import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('how-to main-agent cleanup', () => {
  it('keeps consumer installation on the accepted main-agent path', () => {
    const doc = readFileSync('docs/how-to/consumer-installation.md', 'utf8');

    expect(doc).toContain('最高优先级：另一台没有本仓库源码的机器');
    expect(doc).toContain('非侵入式安装');
    expect(doc).toContain('main-agent-orchestration');
    expect(doc).toContain('runtime-policy-inject.cjs');
    expect(doc).toContain('pre-continue-check.cjs');
    expect(doc).toContain('安装校验或排障 fallback');
    expect(doc).toContain('不代表治理或 post-audit 主路径需要人工触发');
    expect(doc).not.toContain('background worker 自动吃队列');
  });

  it('keeps cursor and claude setup guides on the accepted main-agent path', () => {
    const cursor = readFileSync('docs/how-to/cursor-setup.md', 'utf8');
    const claude = readFileSync('docs/how-to/claude-code-setup.md', 'utf8');

    expect(cursor).toContain('main-agent-orchestration');
    expect(cursor).toContain('runtime-policy-inject.cjs');
    expect(cursor).not.toContain('background worker started / skipped');

    expect(claude).toContain('main-agent-orchestration');
    expect(claude).toContain('runtime-policy-inject.cjs');
    expect(claude).not.toContain('background worker started / skipped');
  });

  it('treats bmad-story-assistant handoff fields as compatibility fallback instead of the primary truth source', () => {
    const doc = readFileSync('docs/how-to/bmad-story-assistant.md', 'utf8');

    expect(doc).toContain('必须先读 surface');
    expect(doc).toContain('compatibility summary');
    expect(doc).toContain('仅当 surface 不可用时');
  });
});
