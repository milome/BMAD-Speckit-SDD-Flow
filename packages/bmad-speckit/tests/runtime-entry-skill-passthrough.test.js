const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROJECT_AI_SURFACES = [
  { ai: 'codex', root: '.codex' },
  { ai: 'claude', root: '.claude' },
  { ai: 'cursor-agent', root: '.cursor' },
];
const GLOBAL_SURFACES = [
  path.join(os.homedir(), '.codex', 'skills'),
  path.join(os.homedir(), '.claude', 'skills'),
  path.join(os.homedir(), '.cursor', 'skills'),
];
const SOURCE_SKILLS = [
  path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmad-speckit', 'SKILL.md'),
  path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmads', 'SKILL.md'),
  path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmad-help', 'SKILL.md'),
  path.join(PROJECT_ROOT, '_bmad', 'core', 'skills', 'bmad-help', 'SKILL.md'),
];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assertStrictPassthroughRules(file) {
  const text = read(file);
  assert.match(text, /Strict stdout passthrough is required/);
  assert.match(text, /final answer must contain only the renderer stdout/);
  assert.match(
    text,
    /no agent-authored summary, translation, truncation, reordering, field deletion, code-span removal/
  );
  assert.match(text, /Preserve every section body, field, list item, code span, and line order/);
  assert.match(text, /do not summarize it yourself/);
  assert.match(text, /Final: paste the renderer stdout exactly/);
}

function withPublishedProjectSurfaces(callback) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-entry-skills-'));
  const SkillPublisher = require('../src/services/skill-publisher');
  try {
    for (const { ai } of PROJECT_AI_SURFACES) {
      const result = SkillPublisher.publish(projectRoot, ai, {
        bmadPath: path.join(PROJECT_ROOT, '_bmad'),
      });
      for (const skill of ['bmad-speckit', 'bmads', 'bmad-help']) {
        assert.ok(
          result.published.includes(skill),
          `${ai} publish should include ${skill}; published=${result.published.join(',')}`
        );
      }
    }
    callback(projectRoot);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

describe('runtime entry skill passthrough contract', () => {
  it('source bmad-speckit, bmads, and bmad-help skills require strict stdout passthrough', () => {
    for (const file of SOURCE_SKILLS) {
      assertStrictPassthroughRules(file);
    }
  });

  it('published project Codex, Claude, and Cursor skill surfaces carry the same passthrough rules', () => {
    withPublishedProjectSurfaces((projectRoot) => {
      for (const { root } of PROJECT_AI_SURFACES) {
        for (const skill of ['bmad-speckit', 'bmads', 'bmad-help']) {
          const file = path.join(projectRoot, root, 'skills', skill, 'SKILL.md');
          assertStrictPassthroughRules(file);
        }
      }
    });
  });

  it('global Codex, Claude, and Cursor skill surfaces carry the same passthrough rules when present', () => {
    for (const root of GLOBAL_SURFACES) {
      if (!fs.existsSync(root)) continue;
      for (const skill of ['bmad-speckit', 'bmads', 'bmad-help']) {
        const file = path.join(root, skill, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        assertStrictPassthroughRules(file);
      }
    }
  });

  it('bmads-style entry skills explicitly forbid replacing full records or panorama with summaries', () => {
    for (const file of [
      path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmad-speckit', 'SKILL.md'),
      path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmads', 'SKILL.md'),
    ]) {
      const text = read(file);
      assert.match(text, /Never replace the full `Six Mental Model Panorama`/);
      assert.match(text, /Never shorten `Current Actionable Requirement Records` to record IDs only/);
    }
  });

  it('bmads-style entry automatically compiles the governed dispatch packet at passing readiness', () => {
    const rootSkill = read(
      path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmad-speckit', 'SKILL.md')
    );
    const aliasSkill = read(path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmads', 'SKILL.md'));
    const command = read(path.join(PROJECT_ROOT, '_bmad', 'commands', 'bmads.md'));

    for (const text of [rootSkill, aliasSkill, command]) {
      assert.match(text, /automatically execute the controlled `dispatch-plan`/);
      assert.match(text, /implementation_readiness=pass/);
      assert.match(text, /compiled packet is missing or unusable/);
      assert.match(text, /--record-id <primary\.recordId>/);
      assert.match(text, /--requirement-set-id <primary\.requirementSetId>/);
      assert.doesNotMatch(text, /--recordId <primary\.recordId>/);
      assert.doesNotMatch(text, /--requirementSetId <primary\.requirementSetId>/);
      assert.match(text, /re-render the BMADS runtime console/);
      assert.match(text, /must not execute `dispatch_implement`/);
      assert.match(text, /must not start the implementation run loop/);
    }
  });

  it('bmad-help entry skills explicitly forbid replacing workflow sections with summaries', () => {
    for (const file of [
      path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmad-help', 'SKILL.md'),
      path.join(PROJECT_ROOT, '_bmad', 'core', 'skills', 'bmad-help', 'SKILL.md'),
    ]) {
      const text = read(file);
      assert.match(text, /Never replace rendered BMAD Help workflow sections with a prose summary/);
      assert.match(
        text,
        /Never drop `Runtime Cross-Entry`, `Upstream Workflow Guidance`, `Official Execution Paths`, or `See also`/
      );
    }
  });
});
