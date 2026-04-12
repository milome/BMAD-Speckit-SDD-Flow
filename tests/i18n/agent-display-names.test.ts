import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  readAgentDisplayNamesRegistry,
  resolveLocalizedAgentDisplayProfile,
} from '../../scripts/i18n/agent-display-names';

describe('agent display names registry', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it('loads the registry from the canonical i18n path', () => {
    const registry = readAgentDisplayNamesRegistry(process.cwd());
    expect(registry.version).toBe(1);
    expect(registry.agents.architect?.displayName?.zh).toBe('Winston 架构师');
    expect(registry.agents['adversarial-reviewer']?.displayName?.en).toBe('Critical Auditor');
  });

  it('resolves zh / en / bilingual display profiles from registry entries', () => {
    const zh = resolveLocalizedAgentDisplayProfile(process.cwd(), 'architect', 'zh');
    expect(zh).toStrictEqual({
      agentId: 'architect',
      icon: '🏗️',
      displayName: 'Winston 架构师',
      title: '架构师',
      source: 'registry',
    });

    const en = resolveLocalizedAgentDisplayProfile(process.cwd(), 'architect', 'en');
    expect(en.displayName).toBe('Winston Architect');
    expect(en.title).toBe('Architect');

    const bilingual = resolveLocalizedAgentDisplayProfile(
      process.cwd(),
      'adversarial-reviewer',
      'bilingual'
    );
    expect(bilingual.displayName).toBe('批判性审计员 / Critical Auditor');
    expect(bilingual.title).toBe('批判性审计员 / Adversarial Reviewer');
  });

  it('falls back to canonical manifest fields when the registry has no explicit entry', () => {
    const profile = resolveLocalizedAgentDisplayProfile(process.cwd(), 'tech-writer', 'en');
    expect(profile.icon).toBe('📚');
    expect(profile.displayName).toBe('Paige');
    expect(profile.title).toBe('Technical Writer');
    expect(profile.source).toBe('manifest-fallback');
  });

  it('falls back to manifest when the registry file is missing or invalid', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-display-fallback-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad', '_config', 'agent-manifest.csv'),
      'name,displayName,title,icon,capabilities,role,identity,communicationStyle,principles,module,path\n' +
        '"architect","Winston","Architect","🏗️","","","","","","bmm","_bmad/bmm/agents/architect.md"\n',
      'utf8'
    );

    const missingRegistry = resolveLocalizedAgentDisplayProfile(root, 'architect', 'en');
    expect(missingRegistry.displayName).toBe('Winston');
    expect(missingRegistry.title).toBe('Architect');
    expect(missingRegistry.source).toBe('manifest-fallback');

    fs.mkdirSync(path.join(root, '_bmad', 'i18n'), { recursive: true });
    fs.writeFileSync(path.join(root, '_bmad', 'i18n', 'agent-display-names.yaml'), 'version: [', 'utf8');

    const invalidRegistry = resolveLocalizedAgentDisplayProfile(root, 'architect', 'zh');
    expect(invalidRegistry.displayName).toBe('Winston');
    expect(invalidRegistry.title).toBe('Architect');
    expect(invalidRegistry.source).toBe('manifest-fallback');
  });

  it('treats empty localized values as missing and falls back to manifest values', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-display-empty-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
    fs.mkdirSync(path.join(root, '_bmad', 'i18n'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad', '_config', 'agent-manifest.csv'),
      'name,displayName,title,icon,capabilities,role,identity,communicationStyle,principles,module,path\n' +
        '"architect","Winston","Architect","🏗️","","","","","","bmm","_bmad/bmm/agents/architect.md"\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(root, '_bmad', 'i18n', 'agent-display-names.yaml'),
      [
        'version: 1',
        'agents:',
        '  architect:',
        '    displayName:',
        '      zh: "   "',
        '      en: "Winston Architect"',
        '    title:',
        '      zh: "   "',
        '      en: "Architect"',
      ].join('\n'),
      'utf8'
    );

    const zh = resolveLocalizedAgentDisplayProfile(root, 'architect', 'zh');
    expect(zh.displayName).toBe('Winston');
    expect(zh.title).toBe('Architect');
    expect(zh.source).toBe('registry+manifest-fallback');

    const bilingual = resolveLocalizedAgentDisplayProfile(root, 'architect', 'bilingual');
    expect(bilingual.displayName).toBe('Winston / Winston Architect');
    expect(bilingual.title).toBe('Architect / Architect');
  });
});
