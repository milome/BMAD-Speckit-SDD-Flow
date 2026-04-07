#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

function enqueuePreContinueEvent(projectRoot, payload, result) {
  const pendingDir = path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue', 'pending');
  fs.mkdirSync(pendingDir, { recursive: true });
  const id = `pre-continue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const file = path.join(pendingDir, `${id}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        id,
        type: 'governance-pre-continue-check',
        timestamp: new Date().toISOString(),
        payload,
        result,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function loadRuntimeContext(projectRoot) {
  const runtimeContextPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
  if (!fs.existsSync(runtimeContextPath)) return null;
  return readJson(runtimeContextPath);
}

function branchName(projectRoot) {
  const headPath = path.join(projectRoot, '.git', 'HEAD');
  if (!fs.existsSync(headPath)) return 'dev';
  const raw = fs.readFileSync(headPath, 'utf8').trim();
  const match = /^ref: refs\/heads\/(.+)$/.exec(raw);
  return match ? match[1] : 'dev';
}

function collectSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = new Map();
  let current = null;
  let buffer = [];
  for (const line of lines) {
    const match = /^(#{2,4})\s+(.*)$/.exec(line);
    if (match) {
      if (current) sections.set(current, buffer.join('\n').trim());
      current = match[2].trim();
      buffer = [];
      continue;
    }
    if (current) buffer.push(line);
  }
  if (current) sections.set(current, buffer.join('\n').trim());
  return sections;
}

function isPlaceholder(value, allowMarkers) {
  const normalized = value.trim();
  if (!normalized) return true;
  if (/^\{\{.*\}\}$/.test(normalized)) return true;
  if (/^\[.*\]$/.test(normalized)) return true;
  return allowMarkers.some((marker) => normalized.includes(marker));
}

function resolveGateConfig(config, workflowName) {
  const sets = config.gate_sets || {};
  for (const [key, value] of Object.entries(sets)) {
    const workflowKeys = value.workflow_keys || [];
    if (workflowKeys.includes(workflowName)) {
      return { key, value };
    }
  }
  return null;
}

function resolveArtifactPath(projectRoot, defaults, runtimeContext) {
  const branch = branchName(projectRoot);
  const planningArtifacts = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  const candidates = (defaults.artifact_resolver && defaults.artifact_resolver.candidates) || [];
  const expanded = candidates.map((candidate) =>
    candidate
      .replace('{planning_artifacts}', planningArtifacts.replace(/\\/g, '/'))
      .replace('{branch}', branch)
  );
  if (runtimeContext && runtimeContext.artifactRoot) {
    expanded.unshift(path.join(projectRoot, runtimeContext.artifactRoot, 'architecture.md').replace(/\\/g, '/'));
  }
  return expanded.find((candidate) => fs.existsSync(candidate)) || null;
}

function containsVersion(content, versionKeywords) {
  return versionKeywords.some((keyword) => content.includes(keyword));
}

function containsExample(content, exampleKeywords) {
  return exampleKeywords.some((keyword) => content.includes(keyword));
}

function evaluateRule(rule, stepName, sections, defaults, config) {
  const failures = [];
  const allowMarkers = defaults.allow_markers || [];
  const keywordRoot = config.rule_keywords || {};
  const versionKeywords = keywordRoot.version_keywords || [];
  const exampleKeywords = keywordRoot.example_keywords || [];

  for (const sectionName of rule.required_sections || []) {
    const content = sections.get(sectionName) || '';
    if (isPlaceholder(content, allowMarkers)) {
      failures.push(`${rule.name}: missing section content: ${sectionName}`);
    }
  }

  for (const sectionName of rule.required_version_sections || []) {
    const content = sections.get(sectionName) || '';
    if (!content) {
      failures.push(`${rule.name}: missing section content: ${sectionName}`);
      continue;
    }
    if (!containsVersion(content, versionKeywords)) {
      failures.push(`${rule.name}: missing version detail: ${sectionName}`);
    }
    if (!containsExample(content, exampleKeywords)) {
      failures.push(`${rule.name}: missing example detail: ${sectionName}`);
    }
  }

  return failures;
}

function resolveWorkflowAndStep(argv, runtimeContext) {
  const explicitWorkflow = argv[2] || process.env.BMAD_PRECONTINUE_WORKFLOW || runtimeContext?.workflow || '';
  const explicitStep = argv[3] || process.env.BMAD_PRECONTINUE_STEP || runtimeContext?.step || '';
  return {
    workflow: explicitWorkflow.trim(),
    step: explicitStep.trim() || 'workflow',
  };
}

function writeResult(result) {
  process.stdout.write(JSON.stringify(result));
}

function main() {
  const projectRoot = process.cwd();
  const runtimeContext = loadRuntimeContext(projectRoot);
  const { workflow, step } = resolveWorkflowAndStep(process.argv, runtimeContext);

  if (!workflow) {
    writeResult({ ok: true, skipped: true, reason: 'no-workflow' });
    return;
  }

  const configPath = path.join(projectRoot, '_bmad', '_config', 'architecture-gates.yaml');
  if (!fs.existsSync(configPath)) {
    writeResult({ ok: true, skipped: true, reason: 'no-config' });
    return;
  }

  const config = readYaml(configPath);
  const defaults = config.defaults || {};
  const gateConfig = resolveGateConfig(config, workflow);
  if (!gateConfig) {
    writeResult({ ok: true, skipped: true, reason: 'workflow-not-governed', workflow, step });
    return;
  }

  const gate = gateConfig.value;
  const stepConfig = gate.steps && gate.steps[step];
  if (!stepConfig) {
    writeResult({ ok: true, skipped: true, reason: 'step-not-governed', workflow, step, gate: gate.runtime?.gate || gateConfig.key });
    return;
  }

  const artifactPath = resolveArtifactPath(projectRoot, defaults, runtimeContext);
  if (!artifactPath) {
    const result = {
      ok: false,
      skipped: false,
      gate: gate.runtime?.gate || gateConfig.key,
      workflow,
      step,
      artifactPath: null,
      scope: {
        branch: branchName(projectRoot),
        epicId: runtimeContext?.epicId || null,
        storyId: runtimeContext?.storyId || null,
      },
      failures: ['missing governed artifact'],
    };
    writeResult(result);
    process.stderr.write('GateFailure\n- missing governed artifact\nRemediationPlan\n- create or sync the governed artifact before Continue.\n');
    process.exitCode = 2;
    return;
  }

  const sections = collectSections(fs.readFileSync(artifactPath, 'utf8'));
  const failures = [];
  for (const rule of stepConfig.gate_rules || []) {
    failures.push(...evaluateRule(rule, step, sections, defaults, config));
  }

  const result = {
    ok: failures.length === 0,
    skipped: false,
    gate: gate.runtime?.gate || gateConfig.key,
    workflow,
    step,
    artifactPath,
    scope: {
      branch: branchName(projectRoot),
      epicId: runtimeContext?.epicId || null,
      storyId: runtimeContext?.storyId || null,
    },
    failures,
  };
  enqueuePreContinueEvent(projectRoot, {
    projectRoot,
    workflow,
    step,
    artifactPath,
    branch: branchName(projectRoot),
    epicId: runtimeContext?.epicId || null,
    storyId: runtimeContext?.storyId || null,
    gate: gate.runtime?.gate || gateConfig.key,
    status: failures.length === 0 ? 'pass' : 'fail',
    rerunGate: gate.runtime?.gate || gateConfig.key,
    sourceGateFailureIds: failures.map((_, index) => `${(gate.runtime?.gate || gateConfig.key).toUpperCase()}-${index + 1}`),
    failures,
  }, result);
  writeResult(result);

  if (failures.length > 0) {
    process.stderr.write(`GateFailure\n${failures.map((issue) => `- ${issue}`).join('\n')}\nRemediationPlan\n- repair the listed governed sections or mark them explicitly deferred before Continue.\n`);
    process.exitCode = 2;
  }
}

main();
