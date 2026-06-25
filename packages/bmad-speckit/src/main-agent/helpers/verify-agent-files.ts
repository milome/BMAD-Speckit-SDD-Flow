const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_AGENTS = [
  { name: 'bmad-master', path: '.claude/agents/bmad-master.md' },
  { name: 'bmad-story-create', path: '.claude/agents/bmad-story-create.md' },
  { name: 'bmad-story-audit', path: '.claude/agents/bmad-story-audit.md' },
  { name: 'bmad-layer4-speckit-specify', path: '.claude/agents/layers/bmad-layer4-speckit-specify.md' },
  { name: 'bmad-layer4-speckit-plan', path: '.claude/agents/layers/bmad-layer4-speckit-plan.md', expectedPrerequisite: 'specify_passed' },
  { name: 'bmad-layer4-speckit-gaps', path: '.claude/agents/layers/bmad-layer4-speckit-gaps.md', expectedPrerequisite: 'plan_passed' },
  { name: 'bmad-layer4-speckit-tasks', path: '.claude/agents/layers/bmad-layer4-speckit-tasks.md', expectedPrerequisite: 'gaps_passed' },
  { name: 'bmad-layer4-speckit-implement', path: '.claude/agents/layers/bmad-layer4-speckit-implement.md', expectedPrerequisite: 'tasks_passed' },
];

const REQUIRED_SPECKIT_ALIASES = [
  { name: 'speckit-specify', path: '.claude/agents/speckit-specify.md' },
  { name: 'speckit-plan', path: '.claude/agents/speckit-plan.md' },
  { name: 'speckit-gaps', path: '.claude/agents/speckit-gaps.md' },
  { name: 'speckit-tasks', path: '.claude/agents/speckit-tasks.md' },
];

const REQUIRED_AUDITORS = [
  { name: 'auditor-spec', path: '.claude/agents/auditors/auditor-spec.md' },
  { name: 'auditor-plan', path: '.claude/agents/auditors/auditor-plan.md' },
  { name: 'auditor-gaps', path: '.claude/agents/auditors/auditor-gaps.md' },
  { name: 'auditor-tasks', path: '.claude/agents/auditors/auditor-tasks.md' },
  { name: 'auditor-implement', path: '.claude/agents/auditors/auditor-implement.md' },
  { name: 'auditor-document', path: '.claude/agents/auditors/auditor-document.md' },
  { name: 'auditor-bugfix', path: '.claude/agents/auditors/auditor-bugfix.md' },
];

function checkAgentGroup(root, groupName, entries) {
  const checks = [];
  for (const agent of entries) {
    const filePath = path.join(root, agent.path);
    const exists = fs.existsSync(filePath);
    const issues = [];
    if (!exists) {
      issues.push('missing');
    } else if (agent.expectedPrerequisite && !fs.readFileSync(filePath, 'utf8').includes(agent.expectedPrerequisite)) {
      issues.push(`prerequisite_missing:${agent.expectedPrerequisite}`);
    }
    checks.push({
      group: groupName,
      name: agent.name,
      path: agent.path,
      passed: issues.length === 0,
      issues,
    });
  }
  return checks;
}

function verifyAgentFiles(options = {}) {
  const root = path.resolve(options.cwd || process.cwd());
  const checks = [
    ...checkAgentGroup(root, 'required_agents', REQUIRED_AGENTS),
    ...checkAgentGroup(root, 'speckit_aliases', REQUIRED_SPECKIT_ALIASES),
    ...checkAgentGroup(root, 'auditors', REQUIRED_AUDITORS),
  ];
  const failed = checks.filter((item) => !item.passed);
  return {
    schemaVersion: 'verify-agent-files-result/v1',
    cwd: root,
    checks,
    passed: failed.length === 0,
    exitCode: failed.length === 0 ? 0 : 1,
  };
}

function main(argv = process.argv.slice(2)) {
  const cwdIndex = argv.indexOf('--cwd');
  const cwd = cwdIndex >= 0 ? argv[cwdIndex + 1] : process.cwd();
  const result = verifyAgentFiles({ cwd });
  console.log(JSON.stringify(result, null, 2));
  if (require.main === module) process.exit(result.exitCode);
  return result.exitCode;
}

module.exports = {
  verifyAgentFiles,
  REQUIRED_AGENTS,
  REQUIRED_SPECKIT_ALIASES,
  REQUIRED_AUDITORS,
  main,
};
