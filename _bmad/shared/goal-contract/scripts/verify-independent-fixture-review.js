const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020').default;

const ASSET_ROOT = path.resolve(__dirname, '..');
const AUDIT_SCHEMA = path.join(ASSET_ROOT, 'independent-fixture-audit.schema.json');
const DISPOSITION_SCHEMA = path.join(
  ASSET_ROOT,
  'independent-fixture-audit-disposition.schema.json'
);
const ROLE_BY_PERSPECTIVE = Object.freeze({
  source_coverage: 'independent_source_coverage_auditor',
  semantic_mapping: 'independent_semantic_mapping_auditor',
  executable_verification: 'independent_executable_verification_auditor',
});
const ZERO_EVENT_HASH = 'sha256:' + '0'.repeat(64);
const REPORT_EVENT_TYPE = 'independent_fixture_audit_report_ingested';
const DISPOSITION_EVENT_TYPE = 'independent_fixture_audit_disposition_ingested';

function invariant(condition, code) {
  if (!condition) throw new Error(code);
}

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function controlStoreHash(value, omittedField) {
  const payload = structuredClone(value);
  if (omittedField) delete payload[omittedField];
  return sha256(Buffer.from(JSON.stringify(payload), 'utf8'));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalHash(value, omittedField) {
  const payload = structuredClone(value);
  if (omittedField) delete payload[omittedField];
  return sha256(Buffer.from(JSON.stringify(canonicalize(payload)), 'utf8'));
}

function readSchema(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateAudit = ajv.compile(readSchema(AUDIT_SCHEMA));
const validateDisposition = ajv.compile(readSchema(DISPOSITION_SCHEMA));

function safeProjectPath(projectRoot, relativePath, code) {
  invariant(typeof relativePath === 'string' && relativePath.length > 0, code);
  invariant(!path.isAbsolute(relativePath), code);
  const normalized = relativePath.replace(/\\/gu, '/');
  invariant(!normalized.split('/').includes('..') && normalized !== '.', code);
  const resolved = path.resolve(projectRoot, ...normalized.split('/'));
  const prefix = `${path.resolve(projectRoot)}${path.sep}`;
  invariant(resolved.startsWith(prefix), code);
  return { normalized, resolved };
}

function fileIdentity(projectRoot, relativePath, missingCode) {
  const safe = safeProjectPath(projectRoot, relativePath, 'independent_fixture_path_unsafe');
  invariant(fs.existsSync(safe.resolved), missingCode);
  const bytes = fs.readFileSync(safe.resolved);
  return { path: safe.normalized, bytes: bytes.length, sha256: sha256(bytes) };
}

function normalizeArtifacts(projectRoot, artifacts) {
  invariant(Array.isArray(artifacts) && artifacts.length > 0, 'independent_fixture_artifact_set_missing');
  const normalized = artifacts.map((artifact) => ({
    path: safeProjectPath(projectRoot, artifact.path, 'independent_fixture_artifact_path_unsafe').normalized,
    bytes: artifact.bytes,
    sha256: artifact.sha256,
  })).sort((left, right) => left.path.localeCompare(right.path));
  invariant(new Set(normalized.map((artifact) => artifact.path)).size === normalized.length,
    'independent_fixture_artifact_path_duplicate');
  for (const expected of normalized) {
    const actual = fileIdentity(projectRoot, expected.path, 'independent_fixture_artifact_missing');
    invariant(actual.bytes === expected.bytes && actual.sha256 === expected.sha256,
      'independent_fixture_artifact_binding_stale');
  }
  return normalized;
}

function readJsonBinding(projectRoot, relativePath, missingCode) {
  const identity = fileIdentity(projectRoot, relativePath, missingCode);
  return {
    identity,
    document: JSON.parse(fs.readFileSync(
      safeProjectPath(projectRoot, relativePath, 'independent_fixture_path_unsafe').resolved,
      'utf8'
    )),
  };
}

function readProvenanceFile(projectRoot, relativePath) {
  const safe = safeProjectPath(projectRoot, relativePath, 'independent_fixture_provenance_path_unsafe');
  invariant(fs.existsSync(safe.resolved), 'independent_fixture_provenance_missing');
  return { path: safe.normalized, resolved: safe.resolved };
}

function resolveProvenancePath(projectRoot, value) {
  const candidate = String(value || '');
  if (!path.isAbsolute(candidate)) return path.resolve(projectRoot, candidate);
  const normalized = candidate.replace(/\\/gu, '/');
  const marker = '/.artifacts/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) return path.resolve(projectRoot, candidate);
  return path.resolve(projectRoot, normalized.slice(markerIndex + 1));
}

function readControlEvents(eventLogPath) {
  invariant(fs.existsSync(eventLogPath), 'independent_fixture_provenance_journal_missing');
  const content = fs.readFileSync(eventLogPath, 'utf8').trim();
  invariant(content.length > 0, 'independent_fixture_provenance_journal_empty');
  return content.split(/\r?\n/u).map((line) => JSON.parse(line));
}

function verifyControlledProvenance(input, reportIdentities, dispositionIdentity, artifactSetHash) {
  const provenance = input.provenance;
  invariant(provenance && typeof provenance === 'object', 'independent_fixture_provenance_missing');
  const recordFile = readProvenanceFile(input.projectRoot, provenance.recordPath);
  const record = JSON.parse(fs.readFileSync(recordFile.resolved, 'utf8'));
  const journal = readProvenanceFile(input.projectRoot, provenance.eventLogPath);
  const receiptRoot = readProvenanceFile(input.projectRoot, provenance.receiptDir);
  const events = readControlEvents(journal.resolved);
  const eventIds = new Set();
  const eventHashes = new Set();
  let previous = ZERO_EVENT_HASH;
  for (const [index, event] of events.entries()) {
    invariant(event && typeof event === 'object', 'independent_fixture_provenance_event_invalid');
    invariant(typeof event.eventId === 'string' && event.eventId.length > 0 && !eventIds.has(event.eventId),
      'independent_fixture_provenance_event_duplicate');
    invariant(typeof event.eventHash === 'string' && event.eventHash === controlStoreHash(event, 'eventHash') &&
      !eventHashes.has(event.eventHash), 'independent_fixture_provenance_event_hash_invalid');
    invariant(event.previousEventHash === previous, `independent_fixture_provenance_chain_invalid:${index}`);
    invariant(event.payloadHash === controlStoreHash(event.payload), 'independent_fixture_provenance_payload_hash_invalid');
    eventIds.add(event.eventId);
    eventHashes.add(event.eventHash);
    previous = event.eventHash;
  }
  const controlStore = record && typeof record.controlStore === 'object' ? record.controlStore : {};
  const recordEventLog = typeof controlStore.eventLogPath === 'string'
    ? resolveProvenancePath(input.projectRoot, controlStore.eventLogPath)
    : '';
  const recordHead = record.eventChainHead ?? controlStore.eventChainHead;
  const recordCount = record.eventCount ?? controlStore.eventCount;
  const recordLastEventId = record.lastAppliedEventId ?? controlStore.lastEventId;
  const recordLastEventHash = record.lastAppliedEventHash ?? controlStore.lastEventHash;
  invariant(recordEventLog === journal.resolved && recordHead === previous &&
    recordLastEventHash === previous && recordLastEventId === events.at(-1).eventId &&
    recordCount === events.length, 'independent_fixture_provenance_record_anchor_invalid');
  if (record.controlledIngestWriterRegistryRequired === true) {
    const writers = Array.isArray(record.controlledIngestWriterRegistry)
      ? record.controlledIngestWriterRegistry
      : [];
    invariant(writers.length > 0, 'independent_fixture_provenance_writer_registry_missing');
    for (const event of events) {
      const writer = writers.find((candidate) => candidate && candidate.writerId === event.writerId);
      invariant(writer && Array.isArray(writer.allowedEventTypes) &&
        writer.allowedEventTypes.includes(event.eventType),
      'independent_fixture_provenance_writer_unauthorized');
    }
  }
  const receiptFor = (event) => {
    const receiptPath = path.join(receiptRoot.resolved, `${String(event.eventId).replace(/[^a-z0-9_.-]/giu, '_')}.json`);
    invariant(fs.existsSync(receiptPath), `independent_fixture_provenance_receipt_missing:${event.eventId}`);
    const bytes = fs.readFileSync(receiptPath);
    const receipt = JSON.parse(bytes.toString('utf8'));
    invariant(receipt.receiptType === 'control_event_committed' && receipt.eventId === event.eventId &&
      receipt.eventHash === event.eventHash && receipt.eventType === event.eventType &&
      receipt.writerId === event.writerId && receipt.recordId === event.recordId &&
      receipt.requirementSetId === event.requirementSetId &&
      resolveProvenancePath(input.projectRoot, String(receipt.eventLogPath)) === journal.resolved &&
      receipt.beforeRecordHash === event.beforeRecordHash && receipt.afterRecordHash === event.afterRecordHash,
    'independent_fixture_provenance_receipt_binding_invalid');
    return { path: path.relative(input.projectRoot, receiptPath).replace(/\\/gu, '/'), hash: sha256(bytes), eventHash: event.eventHash };
  };
  const reportEvents = events.filter((event) => event.eventType === REPORT_EVENT_TYPE);
  const dispositionEvents = events.filter((event) => event.eventType === DISPOSITION_EVENT_TYPE);
  invariant(reportEvents.length === reportIdentities.length && reportEvents.length === 3 && dispositionEvents.length === 1,
    'independent_fixture_provenance_event_set_invalid');
  const reportRows = [];
  const producerIds = new Set();
  const producerOwners = new Set();
  const producerSessions = new Set();
  for (const identity of reportIdentities) {
    const matches = reportEvents.filter((event) => event.payload?.reportPath === identity.path);
    invariant(matches.length === 1, 'independent_fixture_provenance_report_path_binding_invalid');
    const event = matches[0];
    const payload = event.payload;
    invariant(payload.reportBytes === identity.bytes && payload.reportSha256 === identity.sha256 &&
      payload.reviewEpoch === input.reviewEpoch && payload.artifactSetHash === artifactSetHash &&
      typeof payload.perspective === 'string' && ROLE_BY_PERSPECTIVE[payload.perspective] === payload.auditorRole,
    'independent_fixture_provenance_payload_binding_stale');
    const producer = payload.producerExecutionIdentity;
    invariant(producer && typeof producer.executionId === 'string' && typeof producer.owner === 'string' &&
      typeof producer.sessionId === 'string' && !producerIds.has(producer.executionId) &&
      !producerOwners.has(producer.owner) && !producerSessions.has(producer.sessionId),
    'independent_fixture_provenance_producer_duplicate');
    producerIds.add(producer.executionId);
    producerOwners.add(producer.owner);
    producerSessions.add(producer.sessionId);
    const receipt = receiptFor(event);
    reportRows.push({ perspective: payload.perspective, eventId: event.eventId, eventHash: event.eventHash, receiptPath: receipt.path, receiptHash: receipt.hash, producerExecutionIdentity: producer });
  }
  const dispositionEvent = dispositionEvents[0];
  const dispositionPayload = dispositionEvent.payload;
  invariant(dispositionPayload.dispositionPath === dispositionIdentity.path &&
    dispositionPayload.dispositionBytes === dispositionIdentity.bytes &&
    dispositionPayload.dispositionSha256 === dispositionIdentity.sha256 &&
    dispositionPayload.reviewEpoch === input.reviewEpoch && dispositionPayload.artifactSetHash === artifactSetHash,
  'independent_fixture_provenance_disposition_binding_stale');
  const dispositionProducer = dispositionPayload.producerExecutionIdentity;
  invariant(dispositionProducer && typeof dispositionProducer.executionId === 'string' &&
    typeof dispositionProducer.owner === 'string' && typeof dispositionProducer.sessionId === 'string' &&
    !producerIds.has(dispositionProducer.executionId) && !producerOwners.has(dispositionProducer.owner) &&
    !producerSessions.has(dispositionProducer.sessionId), 'independent_fixture_provenance_disposition_producer_invalid');
  const expectedBindings = [...reportRows].sort((left, right) => left.perspective.localeCompare(right.perspective))
    .map((row) => ({ perspective: row.perspective, receiptHash: row.receiptHash }));
  const actualBindings = Array.isArray(dispositionPayload.reportReceiptBindings)
    ? dispositionPayload.reportReceiptBindings
    : Array.isArray(dispositionPayload.reportReceiptHashes)
      ? dispositionPayload.reportReceiptHashes.map((receiptHash, index) => ({ perspective: expectedBindings[index]?.perspective, receiptHash }))
      : [];
  invariant(canonicalHash([...actualBindings].sort((left, right) => String(left.perspective).localeCompare(String(right.perspective)))) ===
    canonicalHash(expectedBindings), 'independent_fixture_provenance_disposition_report_binding_stale');
  const dispositionReceipt = receiptFor(dispositionEvent);
  const declaredReportEventIds = Array.isArray(provenance.reportEventIds)
    ? provenance.reportEventIds.map((id) => String(id))
    : [];
  invariant(declaredReportEventIds.length === 3 && new Set(declaredReportEventIds).size === 3 &&
    canonicalHash([...declaredReportEventIds].sort()) ===
      canonicalHash(reportRows.map((row) => row.eventId).sort()),
  'independent_fixture_provenance_event_duplicate');
  invariant(String(provenance.dispositionEventId) === dispositionEvent.eventId,
    'independent_fixture_provenance_disposition_event_binding_invalid');
  return {
    recordPath: recordFile.path,
    eventLogPath: journal.path,
    receiptDir: receiptRoot.path,
    reportEventIds: [...reportRows]
      .sort((left, right) => left.perspective.localeCompare(right.perspective))
      .map((row) => row.eventId),
    dispositionEventId: dispositionEvent.eventId,
    reportEvents: reportRows.sort((left, right) => left.perspective.localeCompare(right.perspective)),
    dispositionEvent: {
      eventId: dispositionEvent.eventId,
      eventHash: dispositionEvent.eventHash,
      receiptPath: dispositionReceipt.path,
      receiptHash: dispositionReceipt.hash,
      producerExecutionIdentity: dispositionProducer,
    },
  };
}

function schemaInvariant(validate, document, code) {
  invariant(validate(document), `${code}:${ajv.errorsText(validate.errors, { separator: '|' })}`);
}

function bindIndependentFixtureReview(input) {
  const projectRoot = path.resolve(input.projectRoot);
  const artifacts = normalizeArtifacts(projectRoot, input.artifacts);
  const artifactSetHash = canonicalHash(artifacts);
  const seenPerspectives = new Set();
  const reports = input.reportPaths.map((reportPath) => {
    const bound = readJsonBinding(projectRoot, reportPath, 'independent_fixture_audit_report_missing');
    const report = bound.document;
    schemaInvariant(validateAudit, report, 'independent_fixture_audit_schema_invalid');
    invariant(!seenPerspectives.has(report.perspective),
      'independent_fixture_audit_perspective_duplicate');
    seenPerspectives.add(report.perspective);
    invariant(ROLE_BY_PERSPECTIVE[report.perspective] === report.auditorRole,
      'independent_fixture_audit_role_invalid');
    invariant(report.subject.reviewEpoch === input.reviewEpoch &&
      report.subject.artifactSetHash === artifactSetHash &&
      canonicalHash([...report.subject.artifacts].sort((left, right) => left.path.localeCompare(right.path))) ===
        artifactSetHash,
    'independent_fixture_audit_stale');
    invariant(report.verdict === 'PASS' && report.blockerCount === 0 &&
      report.importantFindingCount === 0 && report.checks.every((check) => check.status === 'PASS'),
    'independent_fixture_audit_not_pass');
    return { report, identity: bound.identity };
  });
  invariant(reports.length === 3 && Object.keys(ROLE_BY_PERSPECTIVE).every((perspective) =>
    seenPerspectives.has(perspective)), 'independent_fixture_audit_perspective_set_invalid');

  const dispositionBinding = readJsonBinding(
    projectRoot,
    input.dispositionPath,
    'independent_fixture_disposition_missing'
  );
  const disposition = dispositionBinding.document;
  schemaInvariant(validateDisposition, disposition, 'independent_fixture_disposition_schema_invalid');
  invariant(disposition.dispositionHash === canonicalHash(disposition, 'dispositionHash'),
    'independent_fixture_disposition_hash_invalid');
  invariant(disposition.reviewEpoch === input.reviewEpoch && disposition.artifactSetHash === artifactSetHash,
    'independent_fixture_disposition_stale');
  const expectedReportBindings = reports.map(({ report, identity }) => ({
    perspective: report.perspective,
    ...identity,
  })).sort((left, right) => left.perspective.localeCompare(right.perspective));
  const dispositionReports = [...disposition.reports]
    .sort((left, right) => left.perspective.localeCompare(right.perspective));
  invariant(canonicalHash(dispositionReports) === canonicalHash(expectedReportBindings),
    'independent_fixture_disposition_report_binding_stale');
  const provenance = verifyControlledProvenance(
    input,
    reports.map(({ identity }) => identity),
    dispositionBinding.identity,
    artifactSetHash
  );

  const review = {
    schemaVersion: 'StandaloneSourcePlanFixtureReview/v1',
    reviewEpoch: input.reviewEpoch,
    reviewPolicy: {
      latestHashRequired: true,
      perspectiveCount: 3,
      readOnly: true,
      productionActualMayDefineExpected: false,
      postGenerationProductionComparisonAllowed: true,
    },
    bindings: input.bindings ?? { artifactSetHash },
    artifactSet: { artifactSetHash, artifacts },
    independentAuditReports: expectedReportBindings,
    perspectives: reports
      .sort((left, right) => left.report.perspective.localeCompare(right.report.perspective))
      .map(({ report }) => ({
        perspectiveId: report.perspective,
        reviewerRole: report.auditorRole,
        verdict: report.verdict,
        blockerCount: report.blockerCount,
        importantFindingCount: report.importantFindingCount,
        auditedAt: report.auditedAt,
      })),
    mainSessionDisposition: {
      path: dispositionBinding.identity.path,
      bytes: dispositionBinding.identity.bytes,
      sha256: dispositionBinding.identity.sha256,
      decision: disposition.decision,
      dispositionHash: disposition.dispositionHash,
      disposedAt: disposition.disposedAt,
    },
    provenance,
    reviewStatus: 'confirmed',
    reviewHash: '',
  };
  review.reviewHash = canonicalHash(review, 'reviewHash');
  return review;
}

function verifyBoundIndependentFixtureReview(input) {
  invariant(input.review?.reviewHash === canonicalHash(input.review, 'reviewHash'),
    'fixture_review_self_hash_invalid');
  const rebuilt = bindIndependentFixtureReview({
    projectRoot: input.projectRoot,
    reviewEpoch: input.review.reviewEpoch,
    artifacts: input.review.artifactSet?.artifacts,
    reportPaths: (input.review.independentAuditReports ?? []).map((entry) => entry.path),
    dispositionPath: input.review.mainSessionDisposition?.path,
    bindings: input.review.bindings,
    provenance: input.review.provenance,
  });
  invariant(canonicalHash(rebuilt) === canonicalHash(input.review), 'fixture_review_external_binding_stale');
  return rebuilt;
}

module.exports = {
  bindIndependentFixtureReview,
  canonicalHash,
  verifyBoundIndependentFixtureReview,
};
