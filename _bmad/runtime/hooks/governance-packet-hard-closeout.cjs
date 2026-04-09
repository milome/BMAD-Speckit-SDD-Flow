#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function nowIso() {
  return new Date().toISOString();
}

function resolveYamlModule() {
  const candidates = [
    'js-yaml',
    path.join(process.cwd(), 'node_modules', 'js-yaml'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'js-yaml'),
    path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'js-yaml'),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }

  return null;
}

function resolveRunnerModule(projectRoot) {
  const candidates = [
    path.join(
      projectRoot,
      'node_modules',
      '@bmad-speckit',
      'runtime-emit',
      'dist',
      'governance-remediation-runner.cjs'
    ),
    path.join(
      projectRoot,
      'node_modules',
      'bmad-speckit',
      'node_modules',
      '@bmad-speckit',
      'runtime-emit',
      'dist',
      'governance-remediation-runner.cjs'
    ),
    path.join(
      projectRoot,
      'node_modules',
      'bmad-speckit-sdd-flow',
      'packages',
      'runtime-emit',
      'dist',
      'governance-remediation-runner.cjs'
    ),
  ];

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }

  return null;
}

function extractWritePath(event) {
  if (!event || typeof event !== 'object') {
    return '';
  }
  const nested =
    event.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
  const direct = typeof event.file_path === 'string' ? event.file_path : '';
  const nestedPath = typeof nested.file_path === 'string' ? nested.file_path : '';
  return direct || nestedPath || '';
}

function deriveArtifactPath(projectRoot, writePath) {
  if (!writePath) {
    return null;
  }
  const absolutePath = path.resolve(projectRoot, writePath);
  const normalized = absolutePath.replace(/\\/g, '/');

  if (
    /\.((cursor|claude|codex)-packet)\.md$/i.test(normalized) &&
    /implementation-readiness-remediation-/i.test(normalized)
  ) {
    return absolutePath.replace(/\.(cursor|claude|codex)-packet\.md$/i, '.md');
  }

  if (
    /implementation-readiness-remediation-/i.test(normalized) &&
    normalized.toLowerCase().endsWith('.md')
  ) {
    return absolutePath;
  }

  return null;
}

function parseTableValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\|\\s*\\*\\*${escaped}\\*\\*\\s*\\|\\s*([^|]+?)\\s*\\|$`, 'mi').exec(
    markdown
  );
  return match ? match[1].trim() : null;
}

function parseBulletValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^-\\s*${escaped}:\\s*(.+)$`, 'mi').exec(markdown);
  return match ? match[1].trim() : null;
}

function parseTargetArtifacts(markdown) {
  const tableValue = parseTableValue(markdown, 'Target Artifacts');
  if (tableValue) {
    return tableValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^-\s*Target Artifact\(s\):\s*$/i.test(line));
  if (headingIndex >= 0) {
    const values = [];
    for (let index = headingIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^-\s+/.test(line)) {
        values.push(line.replace(/^-\s+/, '').trim());
        continue;
      }
      if (line.trim() === '') {
        continue;
      }
      break;
    }
    if (values.length > 0) {
      return values;
    }
  }

  return ['prd.md', 'architecture.md', 'epics.md'];
}

function parsePrioritizedSignals(markdown) {
  const fromRouting = parseBulletValue(markdown, 'Prioritized Signals');
  if (fromRouting && fromRouting !== '(none)') {
    return fromRouting
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const sectionMatch = /## Journey Contract Remediation Hints([\s\S]*?)(\n## |\n---|\n$)/i.exec(
    markdown
  );
  if (!sectionMatch) {
    return [];
  }

  return sectionMatch[1]
    .split(/\r?\n/)
    .map((line) => {
      const match = /^-\s*([a-z0-9_.-]+):/i.exec(line.trim());
      return match ? match[1] : null;
    })
    .filter(Boolean);
}

function parseJourneyContractHints(markdown) {
  const sectionMatch = /## Journey Contract Remediation Hints([\s\S]*?)(\n## |\n---|\n$)/i.exec(
    markdown
  );
  if (!sectionMatch) {
    return [];
  }

  return sectionMatch[1]
    .split(/\r?\n/)
    .map((line) => {
      const match = /^-\s*([a-z0-9_.-]+):\s*(.+)$/i.exec(line.trim());
      if (!match) {
        return null;
      }
      return {
        signal: match[1],
        recommendation: match[2],
      };
    })
    .filter(Boolean);
}

function readRuntimeContext(projectRoot) {
  const contextPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
  if (!fs.existsSync(contextPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  } catch {
    return null;
  }
}

function readPacketHosts(projectRoot) {
  const configPath = path.join(projectRoot, '_bmad', '_config', 'governance-remediation.yaml');
  if (!fs.existsSync(configPath)) {
    return ['cursor', 'claude'];
  }
  const yaml = resolveYamlModule();
  if (!yaml || typeof yaml.load !== 'function') {
    return ['cursor', 'claude'];
  }

  try {
    const parsed = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const packetHosts =
      parsed && Array.isArray(parsed.packetHosts) ? parsed.packetHosts : ['cursor', 'claude'];
    return [...new Set(packetHosts.filter((host) => ['cursor', 'claude'].includes(host)))];
  } catch {
    return ['cursor', 'claude'];
  }
}

function sanitizeToken(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSyntheticLoopState(artifactPath, metadata) {
  const targetArtifacts = metadata.targetArtifacts;
  const loopStateId = sanitizeToken(
    `${metadata.rerunGate}--${metadata.capabilitySlot}--${targetArtifacts.join('-') || 'artifacts'}`
  );
  const timestamp = nowIso();
  return {
    version: 1,
    loopStateId,
    rerunGate: metadata.rerunGate,
    capabilitySlot: metadata.capabilitySlot,
    canonicalAgent: metadata.canonicalAgent,
    targetArtifacts,
    maxAttempts: 3,
    maxNoProgressRepeats: 1,
    attemptCount: metadata.currentAttemptNumber,
    noProgressRepeatCount: 0,
    status: 'awaiting_rerun',
    lastGateResult: null,
    lastStopReason: metadata.stopReason,
    executorRouting: null,
    remediationAuditTraceSummaryLines: [],
    rerunChain: [],
    rerunStageIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: [
      {
        attemptNumber: metadata.currentAttemptNumber,
        attemptId: metadata.attemptId,
        outputPath: artifactPath,
        outcome: metadata.outcome,
        createdAt: timestamp,
        sourceGateFailureIds: metadata.sourceGateFailureIds,
      },
    ],
  };
}

function parseArtifactMetadata(markdown, artifactPath) {
  const targetArtifacts = parseTargetArtifacts(markdown);
  const prioritizedSignals = parsePrioritizedSignals(markdown);
  const journeyContractHints = parseJourneyContractHints(markdown);
  const routingMode = parseBulletValue(markdown, 'Routing Mode') || 'generic';
  const executorRoute =
    parseBulletValue(markdown, 'Executor Route') || 'default-gate-remediation';
  const packetStrategy =
    parseBulletValue(markdown, 'Packet Strategy') || 'default-remediation-packet';
  return {
    attemptId: parseTableValue(markdown, 'Attempt ID') || path.basename(artifactPath, '.md'),
    capabilitySlot: parseTableValue(markdown, 'Capability Slot') || 'qa.readiness',
    canonicalAgent:
      parseTableValue(markdown, 'Canonical Agent') || 'PM + QA / readiness reviewer',
    rerunGate: parseTableValue(markdown, 'Rerun Gate') || 'implementation-readiness',
    outcome: parseTableValue(markdown, 'Outcome') || 'needs_work',
    sourceGateFailureIds: (parseTableValue(markdown, 'Source GateFailure IDs') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    targetArtifacts,
    currentAttemptNumber: Number(parseBulletValue(markdown, 'Current Attempt Number') || '1') || 1,
    stopReason: parseBulletValue(markdown, 'Stop Reason') || null,
    executorRouting: {
      routingMode: routingMode === 'targeted' ? 'targeted' : 'generic',
      executorRoute:
        executorRoute === 'journey-contract-remediation'
          ? 'journey-contract-remediation'
          : 'default-gate-remediation',
      prioritizedSignals,
      packetStrategy:
        packetStrategy === 'journey-contract-remediation-packet'
          ? 'journey-contract-remediation-packet'
          : 'default-remediation-packet',
      reason:
        parseBulletValue(markdown, 'Routing Reason') ||
        'normalized from remediation artifact write event',
    },
    journeyContractHints,
  };
}

function normalizeGovernancePacketsForArtifactPath(projectRoot, artifactPath) {
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return { normalized: false, reason: 'artifact-missing' };
  }
  const runnerModule = resolveRunnerModule(projectRoot);
  if (
    !runnerModule ||
    typeof runnerModule.createGovernanceExecutorPacket !== 'function' ||
    typeof runnerModule.writeGovernanceExecutorPacket !== 'function'
  ) {
    return { normalized: false, reason: 'runner-module-unavailable' };
  }

  const artifactMarkdown = fs.readFileSync(artifactPath, 'utf8');
  const metadata = parseArtifactMetadata(artifactMarkdown, artifactPath);
  const loopState = buildSyntheticLoopState(artifactPath, metadata);
  const runtimeContext = readRuntimeContext(projectRoot);
  const packetHosts = readPacketHosts(projectRoot);
  const packetPaths = {};

  for (const hostKind of packetHosts) {
    const packet = runnerModule.createGovernanceExecutorPacket({
      hostKind,
      runtimeContext,
      runtimePolicy: null,
      loopState,
      currentAttemptNumber: metadata.currentAttemptNumber,
      rerunGate: metadata.rerunGate,
      artifactMarkdown,
      journeyContractHints: metadata.journeyContractHints,
      rerunDecision: {
        mode: metadata.executorRouting.routingMode,
        signals: metadata.executorRouting.prioritizedSignals,
        reason: metadata.executorRouting.reason,
      },
      executorRouting: metadata.executorRouting,
    });
    packetPaths[hostKind] = runnerModule.writeGovernanceExecutorPacket(artifactPath, packet);
  }

  return {
    normalized: true,
    artifactPath,
    packetPaths,
  };
}

function normalizeRecentReadinessArtifacts(projectRoot) {
  const planningRoots = [
    path.join(projectRoot, '_bmad-output', 'planning-artifacts'),
  ];
  const artifactPaths = [];

  for (const root of planningRoots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (
          entry.isFile() &&
          /implementation-readiness-remediation-.*\.md$/i.test(entry.name) &&
          !/\.(cursor|claude|codex)-packet\.md$/i.test(entry.name)
        ) {
          artifactPaths.push(fullPath);
        }
      }
    }
  }

  const normalized = [];
  for (const artifactPath of artifactPaths) {
    const result = normalizeGovernancePacketsForArtifactPath(projectRoot, artifactPath);
    if (result && result.normalized) {
      normalized.push(result);
    }
  }

  return {
    normalized: normalized.length > 0,
    count: normalized.length,
    artifacts: normalized.map((entry) => entry.artifactPath),
  };
}

function maybeNormalizeGovernancePackets(projectRoot, event) {
  const writePath = extractWritePath(event);
  if (!writePath) {
    return { normalized: false, reason: 'no-write-path' };
  }
  const artifactPath = deriveArtifactPath(projectRoot, writePath);
  if (!artifactPath) {
    return { normalized: false, reason: 'not-readiness-remediation' };
  }
  return normalizeGovernancePacketsForArtifactPath(projectRoot, artifactPath);
}

module.exports = {
  maybeNormalizeGovernancePackets,
  normalizeGovernancePacketsForArtifactPath,
  normalizeRecentReadinessArtifacts,
};
