const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const {
  bindIndependentFixtureReview,
  canonicalHash,
  resolveProvenancePath,
} = require(path.join(
  REPO_ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'scripts',
  'verify-independent-fixture-review.js'
));

const PERSPECTIVES = [
  ['source_coverage', 'independent_source_coverage_auditor'],
  ['semantic_mapping', 'independent_semantic_mapping_auditor'],
  ['executable_verification', 'independent_executable_verification_auditor'],
];

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function controlStoreHash(value, omittedField) {
  const payload = structuredClone(value);
  if (omittedField) delete payload[omittedField];
  return sha256(Buffer.from(JSON.stringify(payload), 'utf8'));
}

function writeJson(filePath, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
  return { path: path.relative(path.dirname(filePath), filePath), bytes: bytes.length, sha256: sha256(bytes) };
}

function fixture() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'independent-fixture-review-'));
  const artifactPaths = ['fixture/source.md', 'fixture/manifest.json', 'fixture/expected.json'];
  const artifacts = artifactPaths.map((relativePath, index) => {
    const filePath = path.join(projectRoot, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `artifact-${index}\n`, 'utf8');
    const bytes = fs.readFileSync(filePath);
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
  }).sort((left, right) => left.path.localeCompare(right.path));
  const reviewEpoch = 'phase5-independent-test';
  const artifactSetHash = canonicalHash(artifacts);
  const reportPaths = PERSPECTIVES.map(([perspective, auditorRole]) => {
    const relativePath = `audit/${perspective}.json`;
    const filePath = path.join(projectRoot, ...relativePath.split('/'));
    writeJson(filePath, {
      schemaVersion: 'IndependentFixtureAudit/v1',
      perspective,
      auditorRole,
      auditedAt: '2026-09-09T00:00:00.000Z',
      subject: { reviewEpoch, artifactSetHash, artifacts },
      checks: [{ id: `${perspective}_check`, status: 'PASS', evidence: 'test-only evidence' }],
      blockerCount: 0,
      importantFindingCount: 0,
      verdict: 'PASS',
      conclusion: 'test-only independent audit fixture',
    });
    return relativePath;
  });
  const reports = reportPaths.map((relativePath, index) => {
    const bytes = fs.readFileSync(path.join(projectRoot, ...relativePath.split('/')));
    return { perspective: PERSPECTIVES[index][0], path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const dispositionPath = 'audit/main-session-disposition.json';
  const disposition = {
    schemaVersion: 'IndependentFixtureAuditDisposition/v1',
    reviewEpoch,
    artifactSetHash,
    actorRole: 'main_session',
    decision: 'confirm_fixture_review',
    blockerCount: 0,
    importantFindingCount: 0,
    reports,
    disposedAt: '2026-09-09T00:01:00.000Z',
    basis: 'Test-only disposition fixture.',
    dispositionHash: '',
  };
  disposition.dispositionHash = canonicalHash(disposition, 'dispositionHash');
  writeJson(path.join(projectRoot, ...dispositionPath.split('/')), disposition);
  return buildControlledProvenance({ projectRoot, reviewEpoch, artifacts, reportPaths, dispositionPath });
}

function bind(value) {
  return bindIndependentFixtureReview({
    projectRoot: value.projectRoot,
    reviewEpoch: value.reviewEpoch,
    artifacts: value.artifacts,
    reportPaths: value.reportPaths,
    dispositionPath: value.dispositionPath,
    provenance: value.provenance,
  });
}

function mutateJson(root, relativePath, mutate) {
  const filePath = path.join(root, ...relativePath.split('/'));
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  mutate(value);
  writeJson(filePath, value);
}

function buildControlledProvenance(value, options = {}) {
  const journalPath = path.join(value.projectRoot, 'controlled', 'control-events.jsonl');
  const receiptDir = path.join(value.projectRoot, 'controlled', 'receipts');
  fs.mkdirSync(receiptDir, { recursive: true });
  const events = [];
  const reportReceiptBindings = [];
  let previousEventHash = `sha256:${'0'.repeat(64)}`;
  const producerIds = options.producerIds ?? PERSPECTIVES.map((_, index) => `producer-${index + 1}`);
  const append = (eventType, payload, eventId) => {
    const unsigned = {
      eventId,
      eventType,
      eventSchemaVersion: 'control-event-envelope/v1',
      payloadSchemaVersion: `${eventType}/v1`,
      writerId: 'independent-fixture-audit-ingest',
      recordId: 'independent-fixture-review-test',
      requirementSetId: 'independent-fixture-review-test',
      recordedAt: '2026-09-09T00:02:00.000Z',
      previousEventHash,
      beforeRecordHash: sha256(Buffer.from(`before-${events.length}`)),
      afterRecordHash: sha256(Buffer.from(`after-${events.length}`)),
      payloadHash: controlStoreHash(payload),
      payload,
    };
    const event = { ...unsigned, eventHash: controlStoreHash(unsigned) };
    const receipt = {
      receiptType: 'control_event_committed',
      transactionId: `TX-${eventId}`,
      eventId,
      eventHash: event.eventHash,
      eventType,
      writerId: event.writerId,
      recordId: event.recordId,
      requirementSetId: event.requirementSetId,
      eventLogPath: path.relative(value.projectRoot, journalPath).replace(/\\/gu, '/'),
      beforeRecordHash: event.beforeRecordHash,
      afterRecordHash: event.afterRecordHash,
      schemaGate: { ok: true, errorCount: 0 },
      committedAt: event.recordedAt,
    };
    const receiptPath = path.join(receiptDir, `${eventId}.json`);
    const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    fs.writeFileSync(receiptPath, receiptBytes);
    events.push(event);
    previousEventHash = event.eventHash;
    return { event, receipt, receiptPath, receiptHash: sha256(receiptBytes) };
  };
  value.reportPaths.forEach((reportPath, index) => {
    const bytes = fs.readFileSync(path.join(value.projectRoot, ...reportPath.split('/')));
    const report = JSON.parse(bytes.toString('utf8'));
    const receipt = append('independent_fixture_audit_report_ingested', {
      reportPath,
      reportBytes: bytes.length,
      reportSha256: sha256(bytes),
      reviewEpoch: value.reviewEpoch,
      artifactSetHash: value.artifacts && canonicalHash(value.artifacts),
      perspective: report.perspective,
      auditorRole: report.auditorRole,
      producerExecutionIdentity: {
        executionId: producerIds[index],
        owner: producerIds[index],
        sessionId: `session-${producerIds[index]}`,
      },
      ingestedAt: '2026-09-09T00:02:00.000Z',
    }, `report-${index + 1}`);
    reportReceiptBindings.push({ perspective: report.perspective, receiptHash: receipt.receiptHash });
  });
  const dispositionBytes = fs.readFileSync(path.join(value.projectRoot, ...value.dispositionPath.split('/')));
  const dispositionReceipt = append('independent_fixture_audit_disposition_ingested', {
    dispositionPath: value.dispositionPath,
    dispositionBytes: dispositionBytes.length,
    dispositionSha256: sha256(dispositionBytes),
    reviewEpoch: value.reviewEpoch,
    artifactSetHash: canonicalHash(value.artifacts),
    reportReceiptBindings: reportReceiptBindings.sort((left, right) => left.perspective.localeCompare(right.perspective)),
    producerExecutionIdentity: {
      executionId: options.dispositionProducerId ?? 'main-session-producer',
      owner: options.dispositionProducerId ?? 'main-session-producer',
      sessionId: options.dispositionSessionId ?? 'main-session-session',
    },
    ingestedAt: '2026-09-09T00:03:00.000Z',
  }, 'disposition-1');
  fs.writeFileSync(journalPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
  const recordPath = path.join(value.projectRoot, 'controlled', 'requirement-record.json');
  writeJson(recordPath, {
    schemaVersion: 'requirement-record/v1',
    recordId: 'independent-fixture-review-test',
    requirementSetId: 'independent-fixture-review-test',
    status: 'running',
    confirmationHistory: [{ status: 'user_confirmed' }],
    controlledIngestWriterRegistryRequired: false,
    controlStore: {
      schemaVersion: 'control-store/v1',
      eventLogPath: path.relative(value.projectRoot, journalPath).replace(/\\/gu, '/'),
      lastEventId: events.at(-1).eventId,
      lastEventHash: events.at(-1).eventHash,
      eventChainHead: events.at(-1).eventHash,
      eventCount: events.length,
    },
  });
  value.provenance = {
    recordPath: path.relative(value.projectRoot, recordPath).replace(/\\/gu, '/'),
    eventLogPath: path.relative(value.projectRoot, journalPath).replace(/\\/gu, '/'),
    receiptDir: path.relative(value.projectRoot, receiptDir).replace(/\\/gu, '/'),
    reportEventIds: events.slice(0, 3).map((event) => event.eventId),
    dispositionEventId: dispositionReceipt.event.eventId,
  };
  return value;
}

describe('independent fixture review binding', () => {
  it('anchors Windows absolute artifact paths to the project root on every host', () => {
    const value = fixture();
    const resolved = resolveProvenancePath(
      value.projectRoot,
      'D:/historical-run/.artifacts/controlled/control-events.jsonl'
    );
    assert.equal(
      resolved,
      path.join(value.projectRoot, '.artifacts', 'controlled', 'control-events.jsonl')
    );
  });

  it('confirms only three exact latest-hash PASS reports plus an independent disposition', () => {
    const value = fixture();
    const review = bind(value);
    assert.equal(review.reviewStatus, 'confirmed');
    assert.equal(review.perspectives.length, 3);
    assert.equal(review.independentAuditReports.length, 3);
    assert.equal(review.mainSessionDisposition.decision, 'confirm_fixture_review');
  });

  it('fails closed for FAIL and stale reports', () => {
    const failed = fixture();
    mutateJson(failed.projectRoot, failed.reportPaths[0], (report) => { report.verdict = 'FAIL'; report.blockerCount = 1; });
    assert.throws(() => bind(failed), /independent_fixture_audit_not_pass/u);
    const stale = fixture();
    mutateJson(stale.projectRoot, stale.reportPaths[1], (report) => { report.subject.artifactSetHash = `sha256:${'0'.repeat(64)}`; });
    assert.throws(() => bind(stale), /independent_fixture_audit_stale/u);
  });

  it('fails closed for duplicate perspectives and unknown roles', () => {
    const duplicate = fixture();
    mutateJson(duplicate.projectRoot, duplicate.reportPaths[1], (report) => {
      report.perspective = 'source_coverage';
      report.auditorRole = 'independent_source_coverage_auditor';
    });
    assert.throws(() => bind(duplicate), /independent_fixture_audit_perspective_duplicate/u);
    const unknown = fixture();
    mutateJson(unknown.projectRoot, unknown.reportPaths[2], (report) => { report.auditorRole = 'unknown_auditor'; });
    assert.throws(() => bind(unknown), /independent_fixture_audit_schema_invalid|independent_fixture_audit_role_invalid/u);
  });

  it('fails closed when disposition is missing or its report hash is stale', () => {
    const missing = fixture();
    fs.rmSync(path.join(missing.projectRoot, ...missing.dispositionPath.split('/')));
    assert.throws(() => bind(missing), /independent_fixture_disposition_missing/u);
    const stale = fixture();
    mutateJson(stale.projectRoot, stale.dispositionPath, (disposition) => {
      disposition.reports[0].sha256 = `sha256:${'1'.repeat(64)}`;
      disposition.dispositionHash = canonicalHash(disposition, 'dispositionHash');
    });
    assert.throws(() => bind(stale), /independent_fixture_disposition_report_binding_stale/u);
  });

  it('fails closed when controlled provenance is missing', () => {
    const value = fixture();
    delete value.provenance;
    assert.throws(() => bind(value), /independent_fixture_provenance_missing/u);
  });

  it('fails closed for duplicate producer identities and event ids', () => {
    const value = fixture();
    const duplicateOwner = fixture();
    buildControlledProvenance(duplicateOwner, { producerIds: ['same', 'same', 'same'] });
    assert.throws(() => bind(duplicateOwner), /independent_fixture_provenance_producer_duplicate/u);
    value.provenance.reportEventIds[1] = value.provenance.reportEventIds[0];
    assert.throws(() => bind(value), /independent_fixture_provenance_event_duplicate/u);
  });

  it('fails closed for receipt swaps, journal chain breaks, and stale artifact sets', () => {
    const swapped = fixture();
    const receiptA = path.join(swapped.projectRoot, swapped.provenance.receiptDir, 'report-1.json');
    const receiptB = path.join(swapped.projectRoot, swapped.provenance.receiptDir, 'report-2.json');
    const bytesA = fs.readFileSync(receiptA);
    fs.writeFileSync(receiptA, fs.readFileSync(receiptB));
    fs.writeFileSync(receiptB, bytesA);
    assert.throws(() => bind(swapped), /independent_fixture_provenance_receipt_binding_invalid/u);
    const broken = fixture();
    const journalPath = path.join(broken.projectRoot, broken.provenance.eventLogPath);
    const events = fs.readFileSync(journalPath, 'utf8').trim().split(/\r?\n/u).map(JSON.parse);
    events[1].previousEventHash = `sha256:${'f'.repeat(64)}`;
    fs.writeFileSync(journalPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
    assert.throws(() => bind(broken), /independent_fixture_provenance_chain_invalid|independent_fixture_provenance_event_hash_invalid/u);
    const stale = fixture();
    const staleJournal = path.join(stale.projectRoot, stale.provenance.eventLogPath);
    const staleEvents = fs.readFileSync(staleJournal, 'utf8').trim().split(/\r?\n/u).map(JSON.parse);
    staleEvents[0].payload.artifactSetHash = `sha256:${'0'.repeat(64)}`;
    fs.writeFileSync(staleJournal, `${staleEvents.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
    assert.throws(() => bind(stale), /independent_fixture_provenance_event_hash_invalid|independent_fixture_provenance_payload_binding_stale/u);
  });

  it('fails closed when disposition provenance self-ingests or swaps report receipt hashes', () => {
    const selfIngest = fixture();
    const journalPath = path.join(selfIngest.projectRoot, selfIngest.provenance.eventLogPath);
    const events = fs.readFileSync(journalPath, 'utf8').trim().split(/\r?\n/u).map(JSON.parse);
    events[3].payload.producerExecutionIdentity.executionId = events[0].payload.producerExecutionIdentity.executionId;
    fs.writeFileSync(journalPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
    assert.throws(() => bind(selfIngest), /independent_fixture_provenance_disposition_producer_invalid|independent_fixture_provenance_event_hash_invalid/u);
    const swapped = fixture();
    const swappedPath = path.join(swapped.projectRoot, swapped.provenance.eventLogPath);
    const swappedEvents = fs.readFileSync(swappedPath, 'utf8').trim().split(/\r?\n/u).map(JSON.parse);
    swappedEvents[3].payload.reportReceiptBindings.reverse();
    fs.writeFileSync(swappedPath, `${swappedEvents.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
    assert.throws(() => bind(swapped), /independent_fixture_provenance_event_hash_invalid|independent_fixture_provenance_disposition_report_binding_stale/u);
  });
});
