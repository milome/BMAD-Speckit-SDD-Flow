#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const UPSTREAM_COMMIT = process.env.BMAD_HELP_UPSTREAM_COMMIT || '2646672a';
const ALLOWED_PROJECT_EXTENSIONS = new Set([
  'core|RG|Runtime Governance',
  'core|BA|Bug Assistant',
  'core|ST|Standalone Tasks',
]);
const ALLOWED_ADAPTATION_FIELDS = new Set([
  'workflow-file',
  'command',
  'description',
]);
const ROUTING_CONTROL_FIELDS = new Set([
  'phase',
  'sequence',
  'required',
  'output-location',
]);

function gitShow(spec) {
  return execFileSync('git', ['show', spec], { encoding: 'utf8' });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCatalog(csv) {
  const lines = csv.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0] || '');
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] || '']));
  });
}

function itemKey(item) {
  return `${item.module}|${item.code}|${item.name}`;
}

function moduleCounts(items) {
  return items.reduce((counts, item) => {
    counts[item.module] = (counts[item.module] || 0) + 1;
    return counts;
  }, {});
}

function diffItem(upstream, current) {
  const fields = new Set([...Object.keys(upstream), ...Object.keys(current)]);
  return [...fields].flatMap((field) => {
    const upstreamValue = upstream[field] || '';
    const currentValue = current[field] || '';
    if (upstreamValue === currentValue) {
      return [];
    }

    return [{
      field,
      risk: ROUTING_CONTROL_FIELDS.has(field) ? 'high-routing' : 'adaptation',
      allowed: ALLOWED_ADAPTATION_FIELDS.has(field),
      upstream: upstreamValue,
      current: currentValue,
    }];
  });
}

function workflowFlags(markdown) {
  return {
    routingRules: markdown.includes('ROUTING RULES') || markdown.includes('Routing Rules'),
    displayRules: markdown.includes('DISPLAY RULES') || markdown.includes('Display Rules'),
    moduleDetection: markdown.includes('MODULE DETECTION') || markdown.includes('Module Detection'),
    inputAnalysis: markdown.includes('INPUT ANALYSIS') || markdown.includes('Input Analysis'),
    execution: markdown.includes('EXECUTION') || markdown.includes('Execution'),
    officialExecutionPaths: markdown.includes('OFFICIAL EXECUTION PATHS') || markdown.includes('Official Execution Paths'),
    mainAgent: markdown.includes('MAIN-AGENT') || markdown.includes('main-agent'),
    codexFiveLayer: markdown.includes('CODEX / MAIN-AGENT FIVE-LAYER') || markdown.includes('layer_5_closeout'),
    recommendedSkillLabel: markdown.includes('Recommended skill'),
  };
}

function main() {
  const currentCatalogPath = path.resolve('_bmad', '_config', 'bmad-help.csv');
  const currentWorkflowPath = path.resolve('_bmad', 'core', 'skills', 'bmad-help', 'workflow.md');
  const upstreamCatalog = parseCatalog(gitShow(`${UPSTREAM_COMMIT}:_bmad/_config/bmad-help.csv`));
  const currentCatalog = parseCatalog(fs.readFileSync(currentCatalogPath, 'utf8'));
  const upstreamWorkflow = gitShow(`${UPSTREAM_COMMIT}:_bmad/core/skills/bmad-help/workflow.md`);
  const currentWorkflow = fs.readFileSync(currentWorkflowPath, 'utf8');

  const upstreamByKey = new Map(upstreamCatalog.map((item) => [itemKey(item), item]));
  const currentByKey = new Map(currentCatalog.map((item) => [itemKey(item), item]));
  const added = currentCatalog.filter((item) => !upstreamByKey.has(itemKey(item)));
  const removed = upstreamCatalog.filter((item) => !currentByKey.has(itemKey(item)));
  const changed = currentCatalog.flatMap((item) => {
    const upstream = upstreamByKey.get(itemKey(item));
    if (!upstream) {
      return [];
    }

    const changes = diffItem(upstream, item);
    if (changes.length === 0) {
      return [];
    }

    return [{
      key: itemKey(item),
      module: item.module,
      name: item.name,
      code: item.code,
      changes,
      allowed: changes.every((change) => change.allowed),
      highRiskRoutingFields: changes
        .filter((change) => ROUTING_CONTROL_FIELDS.has(change.field))
        .map((change) => change.field),
    }];
  });
  const workflowUpstreamFlags = workflowFlags(upstreamWorkflow);
  const workflowCurrentFlags = workflowFlags(currentWorkflow);
  const disallowedAdded = added.filter((item) => !ALLOWED_PROJECT_EXTENSIONS.has(itemKey(item)));
  const disallowedChanged = changed.filter((item) => !item.allowed);
  const missingWorkflowCoreFlags = [
    'routingRules',
    'displayRules',
    'moduleDetection',
    'inputAnalysis',
    'execution',
  ].filter((flag) => workflowUpstreamFlags[flag] && !workflowCurrentFlags[flag]);
  const forbiddenWorkflowPollution = [
    workflowCurrentFlags.mainAgent ? 'mainAgent' : '',
    workflowCurrentFlags.codexFiveLayer ? 'codexFiveLayer' : '',
  ].filter(Boolean);
  const validation = {
    status: (
      removed.length === 0 &&
      disallowedAdded.length === 0 &&
      disallowedChanged.length === 0 &&
      missingWorkflowCoreFlags.length === 0 &&
      forbiddenWorkflowPollution.length === 0
    ) ? 'pass' : 'fail',
    upstreamCorePreserved: removed.length === 0,
    projectExtensionsAllowed: disallowedAdded.length === 0,
    changedRowsWithinAllowedFields: disallowedChanged.length === 0,
    workflowCoreRulesPreserved: missingWorkflowCoreFlags.length === 0,
    noForbiddenWorkflowPollution: forbiddenWorkflowPollution.length === 0,
    allowedProjectExtensions: [...ALLOWED_PROJECT_EXTENSIONS],
    allowedAdaptationFields: [...ALLOWED_ADAPTATION_FIELDS],
    forbiddenRoutingControlFields: [...ROUTING_CONTROL_FIELDS],
    disallowedAdded: disallowedAdded.map((item) => itemKey(item)),
    disallowedChanged: disallowedChanged.map((item) => ({
      key: item.key,
      disallowedFields: item.changes
        .filter((change) => !change.allowed)
        .map((change) => change.field),
    })),
    missingWorkflowCoreFlags,
    forbiddenWorkflowPollution,
  };

  const report = {
    upstreamCommit: UPSTREAM_COMMIT,
    validation,
    catalog: {
      upstreamRows: upstreamCatalog.length,
      currentRows: currentCatalog.length,
      upstreamModuleCounts: moduleCounts(upstreamCatalog),
      currentModuleCounts: moduleCounts(currentCatalog),
      added: added.map((item) => ({
        module: item.module,
        name: item.name,
        code: item.code,
        phase: item.phase,
        command: item.command,
      })),
      removed: removed.map((item) => ({
        module: item.module,
        name: item.name,
        code: item.code,
        phase: item.phase,
        command: item.command,
      })),
      changedCount: changed.length,
      changed,
    },
    workflow: {
      upstream: workflowUpstreamFlags,
      current: workflowCurrentFlags,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
