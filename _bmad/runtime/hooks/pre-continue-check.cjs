#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  buildGovernanceStageRerunResultEvent,
  persistGovernanceStageRerunResultEvent,
} = require('./governance-stage-event-emitter.cjs');
const {
  resolveRuntimeStepState,
  persistRuntimeStepState,
} = require('./runtime-step-state.cjs');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', reject);
  });
}

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

function loadContinueGateRouting(projectRoot) {
  const routingPath = path.join(projectRoot, '_bmad', '_config', 'continue-gate-routing.yaml');
  if (!fs.existsSync(routingPath)) return null;
  return readYaml(routingPath);
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
  const evidenceKeywords = defaults.evidence_keywords || {};

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

  const keywordGroups = rule.required_keywords || {};
  const scopedSectionNames = Array.isArray(rule.section_scope) ? rule.section_scope : [];
  const scopedText = scopedSectionNames.length > 0
    ? scopedSectionNames.map((sectionName) => sections.get(sectionName) || '').join('\n')
    : [...sections.values()].join('\n');
  for (const [keywordGroup, expectedKeywords] of Object.entries(keywordGroups)) {
    const normalizedKeywords = Array.isArray(expectedKeywords) && expectedKeywords.length > 0
      ? expectedKeywords
      : evidenceKeywords[keywordGroup] || [];
    const hit = normalizedKeywords.some((keyword) => scopedText.includes(keyword));
    if (!hit) {
      failures.push(
        `${rule.name}: missing ${keywordGroup.replace(/_/g, ' ')} evidence (${normalizedKeywords.join(', ')})`
      );
    }
  }

  return failures;
}

function resolveWorkflowAndStep(argv, runtimeContext) {
  const explicitWorkflow = argv[2] || process.env.BMAD_PRECONTINUE_WORKFLOW || runtimeContext?.workflow || runtimeContext?.templateId || '';
  const explicitStep = argv[3] || process.env.BMAD_PRECONTINUE_STEP || runtimeContext?.step || runtimeContext?.stage || '';
  return {
    workflow: explicitWorkflow.trim(),
    step: explicitStep.trim() || 'workflow',
  };
}

function resolveDynamicState(projectRoot, argv) {
  const runtimeContext = loadRuntimeContext(projectRoot);
  const resolved = resolveWorkflowAndStep(argv, runtimeContext);
  return {
    runtimeContext,
    workflow: resolved.workflow,
    step: resolved.step,
    artifactPath: runtimeContext?.artifactPath || null,
    branch: branchName(projectRoot),
    epicId: runtimeContext?.epicId || null,
    storyId: runtimeContext?.storyId || null,
    route: null,
    rerunGate: null,
    flow: runtimeContext?.flow || null,
    stage: runtimeContext?.stage || null,
  };
}

function resolveRoute(routingConfig, workflow, step) {
  if (!routingConfig || !Array.isArray(routingConfig.routes)) return null;
  for (const route of routingConfig.routes) {
    const aliases = Array.isArray(route.aliases) ? route.aliases : [];
    if (route.workflow === workflow || aliases.includes(workflow)) {
      const gate = route.steps && route.steps[step];
      const workflowGate = route.steps && route.steps.workflow;
      return {
        workflow: route.workflow,
        flow: route.flow,
        stage: route.stage,
        rerunGate: gate || workflowGate || null,
        step: gate ? step : workflowGate ? 'workflow' : step,
      };
    }
  }
  return null;
}

function writeResult(result) {
  process.stdout.write(JSON.stringify(result));
}

async function main() {
  const projectRoot = process.cwd();
  const hookInput = await readStdin();
  let dynamic;
  try {
    const resolved = resolveRuntimeStepState(projectRoot, {
      argv: process.argv,
      env: process.env,
      hookInput,
    });
    const persisted = persistRuntimeStepState(projectRoot, resolved);
    dynamic = {
      runtimeContext: persisted.persistedContext || persisted.runtimeContext || loadRuntimeContext(projectRoot),
      workflow: persisted.workflow,
      step: persisted.step,
      artifactPath: persisted.artifactPath,
      branch: persisted.branch,
      epicId: persisted.epicId,
      storyId: persisted.storyId,
      route: persisted.route || null,
      rerunGate: persisted.rerunGate || null,
      flow: persisted.flow || null,
      stage: persisted.stage || null,
    };
  } catch {
    dynamic = resolveDynamicState(projectRoot, process.argv);
  }
  const runtimeContext = dynamic.runtimeContext;
  const workflow = dynamic.workflow;
  const step = dynamic.step;

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
  const routingConfig = loadContinueGateRouting(projectRoot);
  const defaults = config.defaults || {};
  const route = dynamic.route || resolveRoute(routingConfig, workflow, step);
  const routedWorkflow = route && route.workflow ? route.workflow : workflow;
  const routedStep = dynamic.step || (route && route.step ? route.step : step);
  const gateConfig = resolveGateConfig(config, routedWorkflow);
  if (!gateConfig) {
    writeResult({ ok: true, skipped: true, reason: 'workflow-not-governed', workflow: routedWorkflow, step: routedStep });
    return;
  }

  const gate = gateConfig.value;
  const stepConfig = gate.steps && (gate.steps[routedStep] || gate.steps.workflow);
  if (!stepConfig) {
    writeResult({ ok: true, skipped: true, reason: 'step-not-governed', workflow: routedWorkflow, step: routedStep, gate: gate.runtime?.gate || gateConfig.key });
    return;
  }

  const artifactPath = dynamic.artifactPath || resolveArtifactPath(projectRoot, defaults, runtimeContext);
  if (!artifactPath) {
    const result = {
      ok: false,
      skipped: false,
      gate: gate.runtime?.gate || gateConfig.key,
      workflow: routedWorkflow,
      step: routedStep,
      artifactPath: null,
      scope: {
        branch: dynamic.branch || branchName(projectRoot),
        epicId: dynamic.epicId || runtimeContext?.epicId || null,
        storyId: dynamic.storyId || runtimeContext?.storyId || null,
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
    workflow: routedWorkflow,
    step: routedStep,
    artifactPath,
    scope: {
      branch: dynamic.branch || branchName(projectRoot),
      epicId: dynamic.epicId || runtimeContext?.epicId || null,
      storyId: dynamic.storyId || runtimeContext?.storyId || null,
    },
    failures,
  };
  enqueuePreContinueEvent(projectRoot, {
    projectRoot,
    workflow: routedWorkflow,
    step: routedStep,
    artifactPath,
    branch: dynamic.branch || branchName(projectRoot),
    epicId: dynamic.epicId || runtimeContext?.epicId || null,
    storyId: dynamic.storyId || runtimeContext?.storyId || null,
    flow: dynamic.flow || route?.flow || gate.runtime?.flow || null,
    stage: dynamic.stage || route?.stage || gate.runtime?.stage || null,
    gate: gate.runtime?.gate || gateConfig.key,
    status: failures.length === 0 ? 'pass' : 'fail',
    rerunGate: dynamic.rerunGate || (route && route.rerunGate) || gate.runtime?.gate || gateConfig.key,
    sourceGateFailureIds: failures.map((_, index) => `${(gate.runtime?.gate || gateConfig.key).toUpperCase()}-${index + 1}`),
    failures,
  }, result);

  if (failures.length > 0) {
    persistGovernanceStageRerunResultEvent(
      buildGovernanceStageRerunResultEvent({
        projectRoot,
        sourceEventType: 'governance-pre-continue-check',
        runnerInput: {
          projectRoot,
          outputPath: artifactPath,
          promptText: `GateFailure for ${routedWorkflow} ${routedStep}: ${failures.join('; ')}`,
          stageContextKnown: true,
          gateFailureExists: true,
          blockerOwnershipLocked: true,
          rootTargetLocked: true,
          equivalentAdapterCount: 1,
          attemptId: `pre-continue-${Date.now()}`,
          sourceGateFailureIds: failures.map((_, index) => `${(gate.runtime?.gate || gateConfig.key).toUpperCase()}-${index + 1}`),
          capabilitySlot: `${routedWorkflow}.${routedStep}`,
          canonicalAgent: 'Governance Gate Runner',
          actualExecutor: 'pre-continue-check',
          adapterPath: '_bmad/runtime/hooks/pre-continue-check.cjs',
          targetArtifacts: artifactPath ? [artifactPath] : [],
          expectedDelta: 'repair governed contract sections before Continue',
          rerunOwner: 'PM',
          rerunGate: dynamic.rerunGate || (route && route.rerunGate) || gate.runtime?.gate || gateConfig.key,
          outcome: 'blocked',
          hostKind: 'claude',
        },
        rerunGateResult: {
          gate: dynamic.rerunGate || (route && route.rerunGate) || gate.runtime?.gate || gateConfig.key,
          status: 'fail',
          blockerIds: failures.map((_, index) => `${(gate.runtime?.gate || gateConfig.key).toUpperCase()}-${index + 1}`),
          summary: failures.join('; '),
          updatedArtifacts: artifactPath ? [artifactPath] : [],
        },
      })
    );
  }
  writeResult(result);

  if (failures.length > 0) {
    process.stderr.write(`GateFailure\n${failures.map((issue) => `- ${issue}`).join('\n')}\nRemediationPlan\n- repair the listed governed sections or mark them explicitly deferred before Continue.\n`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
