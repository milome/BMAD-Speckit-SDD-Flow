import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const BUGFIX_PROMPT_FILES = [
  path.join(ROOT, '_bmad', 'cursor', 'skills', 'bmad-bug-assistant', 'SKILL.zh.md'),
  path.join(ROOT, '.cursor', 'skills', 'bmad-bug-assistant', 'SKILL.zh.md'),
];

const STORY_PROMPT_FILES = [
  path.join(ROOT, '_bmad', 'cursor', 'skills', 'bmad-story-assistant', 'SKILL.zh.md'),
  path.join(ROOT, '.cursor', 'skills', 'bmad-story-assistant', 'SKILL.zh.md'),
];

describe('cursor party-mode document path contract', () => {
  it('requires BUGFIX root-cause prompt templates to carry an explicit canonical BUGFIX document path', () => {
    for (const filePath of BUGFIX_PROMPT_FILES) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('**BUGFIX 文档路径**：{主 Agent 填入 BUGFIX 文档路径}');
      expect(content).toContain('`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md`');
      expect(content).toContain('`_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md`');
      expect(content).toMatch(/必须.*BUGFIX 文档直接写入上述「BUGFIX 文档路径」/u);
      expect(content).not.toContain('保存至 _bmad-output/ 或 bugfix/');
    }
  });

  it('requires Create Story prompt templates to carry an explicit canonical Story document output path', () => {
    for (const filePath of STORY_PROMPT_FILES) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('输出 Story 文档到 {project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md');
      expect(content).toContain('Story 文档通常保存在：`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`。');
    }
  });
});
