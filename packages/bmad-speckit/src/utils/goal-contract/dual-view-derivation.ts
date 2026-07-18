const { createHash } = require('node:crypto');

const IMPLEMENTATION_REQUIRED_FIELDS = Object.freeze([
  'tasks',
  'traceSlices',
  'productionSymbols',
  'allowedPaths',
  'commands',
  'dependencies',
  'commitPolicy',
  'closeConditions',
  'synchronizationObligations',
]);

const FORBIDDEN_IMPLEMENTATION_FIELDS = Object.freeze([
  'acceptanceEvidenceView',
  'acceptanceView',
  'otherView',
  'reconciliationFindings',
  'sharedResponse',
  'sharedResponseId',
]);

const ACCEPTANCE_EVIDENCE_REQUIRED_FIELDS = Object.freeze([
  'acceptanceItems',
  'negativeControls',
  'productionEntryPoints',
  'manualScenarios',
  'expectedEvidence',
  'antiCheatRules',
  'stopConditions',
]);

const FORBIDDEN_ACCEPTANCE_EVIDENCE_FIELDS = Object.freeze([
  'implementationView',
  'otherView',
  'reconciliationFindings',
  'sharedResponse',
  'sharedResponseId',
]);

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function normalizeLineEndings(value) {
  return String(value ?? '').replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function failure(failureClass, extra = {}) {
  const error = new Error(failureClass);
  Object.assign(error, { failureClass, ...extra });
  return error;
}

function normalizeRepoPath(value) {
  return String(value || '').replace(/\\/gu, '/');
}

function sourcePlanSnapshot(input) {
  if (!input.sourcePath || !Buffer.isBuffer(input.rawBytes)) {
    throw failure('source_snapshot_invalid');
  }
  const content = input.rawBytes.toString('utf8');
  const contentHash = sha256(input.rawBytes);
  const sourcePath = normalizeRepoPath(input.sourcePath);
  return deepFreeze({
    schemaVersion: 'goal-contract-source-snapshot/v1',
    sourceType: 'source_plan',
    snapshotId: `source-plan:${contentHash}`,
    sourcePath,
    aggregateHash: contentHash,
    segments: [
      {
        segmentId: 'SEG-001',
        role: 'source_plan',
        content,
        contentHash,
        boundary: { sourcePath, byteLength: input.rawBytes.length },
      },
    ],
  });
}

function conversationSnapshot(input) {
  if (!input.sourceId || !Array.isArray(input.segments) || input.segments.length === 0) {
    throw failure('source_snapshot_invalid');
  }
  const segments = input.segments.map((segment, index) => {
    const content = normalizeLineEndings(segment.content);
    return {
      segmentId: `SEG-${String(index + 1).padStart(3, '0')}`,
      role: String(segment.role || ''),
      content,
      contentHash: sha256(Buffer.from(content, 'utf8')),
      boundary: structuredClone(segment.boundary || {}),
    };
  });
  const aggregateHash = sha256(
    Buffer.from(
      stableStringify({
        sourceId: input.sourceId,
        segments,
      }),
      'utf8'
    )
  );
  return deepFreeze({
    schemaVersion: 'goal-contract-source-snapshot/v1',
    sourceType: 'conversation',
    snapshotId: `conversation:${input.sourceId}:${aggregateHash}`,
    sourceId: input.sourceId,
    aggregateHash,
    segments,
  });
}

function buildSourceSnapshot(input) {
  if (input?.sourceType === 'source_plan') return sourcePlanSnapshot(input);
  if (input?.sourceType === 'conversation') return conversationSnapshot(input);
  throw failure('source_snapshot_type_unsupported');
}

function validateImplementationView(view) {
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    return {
      decision: 'block',
      failureClass: 'implementation_view_incomplete',
      missingFields: IMPLEMENTATION_REQUIRED_FIELDS,
    };
  }
  const missingFields = IMPLEMENTATION_REQUIRED_FIELDS.filter((field) => {
    const value = view[field];
    if (Array.isArray(value)) {
      return field === 'dependencies' ? false : value.length === 0;
    }
    if (field === 'commands') {
      return (
        !value ||
        typeof value !== 'object' ||
        !['direct', 'impacted', 'integration', 'regression'].every(
          (kind) => Array.isArray(value[kind]) && value[kind].length > 0
        )
      );
    }
    return typeof value !== 'string' || value.trim() === '';
  });
  if (missingFields.length > 0) {
    return {
      decision: 'block',
      failureClass: 'implementation_view_incomplete',
      missingFields,
    };
  }
  const forbiddenFields = FORBIDDEN_IMPLEMENTATION_FIELDS.filter(
    (field) => Object.prototype.hasOwnProperty.call(view, field)
  );
  if (forbiddenFields.length > 0) {
    return {
      decision: 'block',
      failureClass: 'view_isolation_violation',
      forbiddenFields,
    };
  }
  return {
    decision: 'pass',
    taskCount: view.tasks.length,
    traceCount: view.traceSlices.length,
    allowedPathCount: view.allowedPaths.length,
  };
}

function validateAcceptanceEvidenceView(view) {
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    return {
      decision: 'block',
      failureClass: 'acceptance_evidence_view_incomplete',
      missingFields: ACCEPTANCE_EVIDENCE_REQUIRED_FIELDS,
    };
  }
  const missingFields = ACCEPTANCE_EVIDENCE_REQUIRED_FIELDS.filter(
    (field) => !Array.isArray(view[field]) || view[field].length === 0
  );
  if (missingFields.length > 0) {
    return {
      decision: 'block',
      failureClass: 'acceptance_evidence_view_incomplete',
      missingFields,
    };
  }
  const forbiddenFields = FORBIDDEN_ACCEPTANCE_EVIDENCE_FIELDS.filter(
    (field) => Object.prototype.hasOwnProperty.call(view, field)
  );
  if (forbiddenFields.length > 0) {
    return {
      decision: 'block',
      failureClass: 'view_isolation_violation',
      forbiddenFields,
    };
  }
  return {
    decision: 'pass',
    acceptanceCount: view.acceptanceItems.length,
    evidenceCount: view.expectedEvidence.length,
    negativeControlCount: view.negativeControls.length,
  };
}

function assertNoCrossViewInput(request, viewType) {
  const forbidden =
    viewType === 'implementation'
      ? ['acceptanceEvidenceView', 'acceptanceView', 'otherView', 'sharedResponse']
      : ['implementationView', 'otherView', 'sharedResponse'];
  const forbiddenFields = forbidden.filter((field) =>
    Object.prototype.hasOwnProperty.call(request || {}, field)
  );
  if (forbiddenFields.length > 0) {
    throw failure('view_isolation_violation', { viewType, forbiddenFields });
  }
}

function assertViewIsolation(implementationResult, acceptanceEvidenceResult) {
  const implementationReceipt = implementationResult?.receipt;
  const acceptanceReceipt = acceptanceEvidenceResult?.receipt;
  const violations = [];
  if (implementationReceipt?.viewType !== 'implementation') {
    violations.push('implementation_view_type');
  }
  if (acceptanceReceipt?.viewType !== 'acceptance_evidence') {
    violations.push('acceptance_evidence_view_type');
  }
  if (
    !implementationReceipt?.inputHash ||
    implementationReceipt.inputHash !== acceptanceReceipt?.inputHash
  ) {
    violations.push('snapshot_hash_mismatch');
  }
  if (
    !implementationReceipt?.sessionIdentity ||
    implementationReceipt.sessionIdentity === acceptanceReceipt?.sessionIdentity
  ) {
    violations.push('provider_session_not_isolated');
  }
  if (
    implementationReceipt?.persistedViewAuthorityFiles !== 0 ||
    acceptanceReceipt?.persistedViewAuthorityFiles !== 0
  ) {
    violations.push('persisted_view_authority');
  }
  if (violations.length > 0) {
    throw failure('view_isolation_violation', { violations });
  }
  return {
    decision: 'pass',
    snapshotHash: implementationReceipt.inputHash,
    persistedViewAuthorityFiles: 0,
  };
}

class StandaloneViewProvider {
  constructor(adapter = {}) {
    this.adapter = adapter;
    this.sessionIdentities = new Set();
  }

  reserveSessionIdentity(role) {
    const sessionIdentity = this.adapter.createSessionIdentity(role);
    if (!sessionIdentity) {
      throw failure('BLOCKED_ENVIRONMENT', {
        unavailableCapability: 'isolated_provider_session',
      });
    }
    if (this.sessionIdentities.has(sessionIdentity)) {
      throw failure('view_isolation_violation', {
        role,
        violations: ['provider_session_reused'],
      });
    }
    this.sessionIdentities.add(sessionIdentity);
    return String(sessionIdentity);
  }

  async deriveImplementationView(request) {
    assertNoCrossViewInput(request, 'implementation');
    const { snapshot, repositoryFacts = {} } = request || {};
    if (
      typeof this.adapter.deriveImplementationView !== 'function' ||
      typeof this.adapter.createSessionIdentity !== 'function'
    ) {
      throw failure('BLOCKED_ENVIRONMENT', {
        unavailableCapability: 'isolated_implementation_view_provider',
      });
    }
    if (!snapshot?.aggregateHash || !Object.isFrozen(snapshot)) {
      throw failure('source_snapshot_not_frozen');
    }
    const sessionIdentity = this.reserveSessionIdentity('implementation_view');
    const providerInput = deepFreeze({
      snapshot,
      snapshotHash: snapshot.aggregateHash,
      repositoryFacts: structuredClone(repositoryFacts),
      roleContract: 'implementation_view/v1',
    });
    const rawView = await this.adapter.deriveImplementationView(providerInput);
    const validation = validateImplementationView(rawView);
    if (validation.decision !== 'pass') {
      throw failure(validation.failureClass, validation);
    }
    const view = deepFreeze(structuredClone(rawView));
    return {
      view,
      validation,
      receipt: deepFreeze({
        schemaVersion: 'goal-contract-view-provider-receipt/v1',
        viewType: 'implementation',
        providerIdentity: String(this.adapter.providerIdentity || 'unknown'),
        sessionIdentity: String(sessionIdentity),
        inputHash: snapshot.aggregateHash,
        outputHash: sha256(Buffer.from(stableStringify(view), 'utf8')),
        completedAt: new Date().toISOString(),
        persistedViewAuthorityFiles: 0,
      }),
    };
  }

  async deriveAcceptanceEvidenceView(request) {
    assertNoCrossViewInput(request, 'acceptance_evidence');
    const { snapshot, repositoryFacts = {} } = request || {};
    if (
      typeof this.adapter.deriveAcceptanceEvidenceView !== 'function' ||
      typeof this.adapter.createSessionIdentity !== 'function'
    ) {
      throw failure('BLOCKED_ENVIRONMENT', {
        unavailableCapability: 'isolated_acceptance_evidence_view_provider',
      });
    }
    if (!snapshot?.aggregateHash || !Object.isFrozen(snapshot)) {
      throw failure('source_snapshot_not_frozen');
    }
    const sessionIdentity = this.reserveSessionIdentity(
      'acceptance_evidence_view'
    );
    const providerInput = deepFreeze({
      snapshot,
      snapshotHash: snapshot.aggregateHash,
      repositoryFacts: structuredClone(repositoryFacts),
      roleContract: 'acceptance_evidence_view/v1',
    });
    const rawView =
      await this.adapter.deriveAcceptanceEvidenceView(providerInput);
    const validation = validateAcceptanceEvidenceView(rawView);
    if (validation.decision !== 'pass') {
      throw failure(validation.failureClass, validation);
    }
    const view = deepFreeze(structuredClone(rawView));
    return {
      view,
      validation,
      receipt: deepFreeze({
        schemaVersion: 'goal-contract-view-provider-receipt/v1',
        viewType: 'acceptance_evidence',
        providerIdentity: String(this.adapter.providerIdentity || 'unknown'),
        sessionIdentity,
        inputHash: snapshot.aggregateHash,
        outputHash: sha256(Buffer.from(stableStringify(view), 'utf8')),
        completedAt: new Date().toISOString(),
        persistedViewAuthorityFiles: 0,
      }),
    };
  }
}

module.exports = {
  StandaloneViewProvider,
  assertViewIsolation,
  buildSourceSnapshot,
  validateAcceptanceEvidenceView,
  validateImplementationView,
};
