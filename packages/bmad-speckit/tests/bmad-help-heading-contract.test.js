const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildBmadHelpOutput, renderBmadHelp } = require('../src/runtime/bmad-help-renderer');
const { DISPLAY_BUDGETS } = require('../src/runtime/ai-tdd/display-budget');
const {
  HEADING_SCHEMAS,
  schemaHeading,
} = require('../src/runtime/markdown-sections');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const HELP_HEADINGS = HEADING_SCHEMAS.bmadHelp;

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-heading-'));
  fs.cpSync(path.join(PROJECT_ROOT, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  return root;
}

function headings(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^#{1,3}\s+/u.test(line))
    .map((line) => line.trim());
}

describe('bmad-help heading contract', () => {
  it('renders Official Execution Paths as a stable H3 section by default', () => {
    const root = makeRoot();
    try {
      const text = renderBmadHelp(buildBmadHelpOutput({ projectRoot: root }));
      const renderedHeadings = headings(text);
      const officialExecutionPaths = schemaHeading(HELP_HEADINGS, 'officialExecutionPaths');
      const upstreamWorkflowGuidance = schemaHeading(HELP_HEADINGS, 'upstreamWorkflowGuidance');

      assert.match(text, new RegExp(`^${officialExecutionPaths}$`, 'm'));
      assert.ok(
        renderedHeadings.indexOf(officialExecutionPaths) >
          renderedHeadings.indexOf(upstreamWorkflowGuidance)
      );
      assert.match(text, /bmad-story-assistant/);
      assert.match(text, /bmad-standalone-tasks/);
      assert.match(text, /bmad-bug-assistant/);
      assert.match(text, /^## See also: bmads$/m);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves H1/H2/H3 hierarchy across display budgets', () => {
    const root = makeRoot();
    try {
      const expectedHeadings = headings(
        renderBmadHelp(buildBmadHelpOutput({ projectRoot: root }))
      );

      for (const budget of DISPLAY_BUDGETS) {
        const text = renderBmadHelp(buildBmadHelpOutput({ projectRoot: root, budget }));
        assert.deepEqual(headings(text), expectedHeadings);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
