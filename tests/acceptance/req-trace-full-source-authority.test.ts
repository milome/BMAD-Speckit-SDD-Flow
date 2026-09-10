import * as fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFullSourceBundle, hash, SOURCE_HASH, EXPECTED_HASH } from '../helpers/source-authority-full-source';
import { scanRequirementsContractConsumerAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-consumer-authority-scanner';
import { deriveRequirementsTypedSourceConfirmationSemantics } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-compiler';
import { resolveTypedSourceAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { resolveTypedTechnicalDeclarations } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-technical-planning-capability';
import { stableStringify } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateTypedModelPacket } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-model-packet';
import { materializeFullSourceReqTraceFixture, stripOracleLocations } from '../helpers/req-trace-full-source';
import { runGenerator, QUARTET } from '../helpers/req-trace-budget-publication';

const { startIoMeter } = createRequire(import.meta.url)('../helpers/req-trace-full-source-io.cjs');
const EVIDENCE = path.resolve('.artifacts/standalone-goal-full-repair/run-2026-09-05T11-17-06-349Z');
const byteHash = (value: unknown) => hash(stableStringify(value));
const sorted = (values: string[]) => [...values].sort();

describe('complete frozen real-source req-trace authority', () => {
  let fixture: ReturnType<typeof createFullSourceBundle>;
  let scanned: ReturnType<typeof scanRequirementsContractConsumerAuthority>;
  let confirmation: Record<string, any>;
  let meter: ReturnType<typeof startIoMeter>;
  let fullConfirmation: ReturnType<typeof materializeFullSourceReqTraceFixture>;
  let childWrittenBytes = 0;
  let childReadBytes = 0;
  const projectionMetrics: Array<Record<string, unknown>> = [];

  beforeAll(() => {
    meter = startIoMeter();
    fixture = createFullSourceBundle();
    expect(fixture.fileBytes.reduce((sum, bytes) => sum + bytes, 0)).toBeLessThan(8 * 1024 * 1024);
    scanned = scanRequirementsContractConsumerAuthority({ cwd: fixture.root, intakeSource: fixture.intakeSource,
      authoritySources: fixture.authoritySources });
    confirmation = deriveRequirementsTypedSourceConfirmationSemantics(scanned.typedSourceAuthority!);
  }, 120_000);

  afterAll(() => {
    const io = meter.stop();
    fs.mkdirSync(EVIDENCE, { recursive: true });
    const out = path.join(EVIDENCE, `req-trace-full-source-${process.env.REQ_TRACE_BUDGET_RUN_ID || Date.now()}-io.json`);
    fs.writeFileSync(out, `${JSON.stringify({ testOnly: true, fullRepairAccepted: false, sourceHash: SOURCE_HASH,
      expectedHash: EXPECTED_HASH, ...io, childWrittenBytes, childReadBytes,
      cumulativeWrittenBytes: io.writtenBytes + childWrittenBytes, cumulativeReadBytes: io.readBytes + childReadBytes,
      fixtureFileBytes: fixture?.fileBytes ?? [] })}\n`, { flag: 'wx' });
    fs.writeFileSync(out.replace('-io.json', '-projections.json'), `${JSON.stringify({ testOnly: true,
      fullRepairAccepted: false, projectionMetrics })}\n`, { flag: 'wx' });
    if (fixture) fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  });

  it('retains every independently enumerated clause, declared identity and action before confirmation projection', () => {
    const graph = resolveTypedSourceAuthority(scanned.typedSourceAuthority!);
    expect(graph.sourceNodes.length).toBe(2534);
    expect(graph.sourceRelations.length).toBe(2778);
    expect(graph.commandDeclarations.length).toBe(97);
    expect(graph.sourceNodes.filter((row) => row.executionRole === 'action').map((row) => row.sourceRootId).sort())
      .toEqual(fixture.expected.sections.flatMap((section: any) => section.works.map((work: any) => work.id)).sort());
    const actual = new Map(graph.sourceNodes.map((row) => [row.sourceRootId, row]));
    for (const expected of fixture.sourceRoots) {
      const row = actual.get(expected.sourceRootId)!;
      expect(row, expected.sourceRootId).toBeDefined();
      for (const field of ['text', 'executionRole', 'polarity', 'normativeStrength', 'conditions', 'scope', 'declaredIds']) {
        expect(byteHash(row[field]), `${expected.sourceRootId}.${field}`).toBe(byteHash(expected.semanticBody[field]));
      }
    }
    expect(confirmation.must.map((row: any) => row.id)).toEqual(graph.sourceNodes
      .filter((row) => row.executionRole === 'action').map((row) => row.sourceRootId));
    expect(confirmation.implementationTasks).toHaveLength(16);
    expect(confirmation.traceRows).toHaveLength(16);
    const commands = fixture.expected.sections.flatMap((section: any) => section.commands);
    const expectedCommands = new Map(commands.map((row: any) => [row.id, stripOracleLocations(row)]));
    for (const row of graph.commandDeclarations) expect(byteHash(row), String(row.id)).toBe(byteHash(expectedCommands.get(row.id)));
    const relations = graph.sourceRelations.map(({ relationId: _relationId, ...row }) => byteHash(stripOracleLocations(row))).sort();
    expect(byteHash(relations)).toBe(byteHash(fixture.sourceRelations.map((row) => byteHash(stripOracleLocations(row))).sort()));
  });

  it('projects only source-applicable mandatory command declarations into each complete trace', () => {
    const commands = resolveTypedTechnicalDeclarations(scanned.typedSourceAuthority!)
      .filter((entry) => entry.kind === 'CMD' && entry.modality === 'required' && entry.applicableSourceRefs!.length > 0);
    expect(commands.length).toBeGreaterThan(0);
    expect(sorted((confirmation.requiredCommands ?? []).map((row: any) => row.id)))
      .toEqual(sorted(commands.map((row) => row.id)));
    for (const command of commands) {
      const actual = confirmation.requiredCommands.find((row: any) => row.id === command.id);
      expect(actual.command, command.id).toBe(command.value);
    }
    for (const trace of confirmation.traceRows) {
      const wanted = commands.filter((command) => command.applicableSourceRefs!.some((id) => trace.covers.includes(id))).map((command) => command.id);
      expect(sorted([...trace.contractValidationCommandRefs, ...trace.deliveryEvidenceCommandRefs]), trace.id).toEqual(sorted(wanted));
    }
    expect(confirmation.traceRows.some((trace: any) => trace.deliveryEvidenceCommandRefs.length > 0)).toBe(true);
  });

  it.each(['req_trace_direct', 'main_agent_compile'])('%s preserves the complete confirmed graph without graph fanout', (entry) => {
    fullConfirmation ??= materializeFullSourceReqTraceFixture(
      fixture.root,
      scanned,
      confirmation,
      fixture.expected
    );
    const outDir = path.join(fixture.root, `test-only-${entry}`);
    const childIoPath = path.join(fixture.root, `${entry}-io.json`);
    const savedReceipt = process.env.REQ_TRACE_FULL_IO_RECEIPT;
    const savedLimit = process.env.REQ_TRACE_FULL_IO_LIMIT;
    process.env.REQ_TRACE_FULL_IO_RECEIPT = childIoPath;
    process.env.REQ_TRACE_FULL_IO_LIMIT = String(24 * 1024 * 1024 - meter.snapshot().writtenBytes - childWrittenBytes);
    let result: ReturnType<typeof runGenerator>;
    try {
      result = runGenerator({ label: `full-source-${entry}`, entry, outDir,
        fixture: fullConfirmation.fixture, preload: path.resolve('tests/helpers/req-trace-full-source-io.cjs') });
    } finally {
      if (savedReceipt === undefined) delete process.env.REQ_TRACE_FULL_IO_RECEIPT;
      else process.env.REQ_TRACE_FULL_IO_RECEIPT = savedReceipt;
      if (savedLimit === undefined) delete process.env.REQ_TRACE_FULL_IO_LIMIT;
      else process.env.REQ_TRACE_FULL_IO_LIMIT = savedLimit;
    }
    const childIo = fs.existsSync(childIoPath) ? JSON.parse(fs.readFileSync(childIoPath, 'utf8')) : null;
    childWrittenBytes += childIo?.writtenBytes ?? 0;
    childReadBytes += childIo?.readBytes ?? 0;
    expect(meter.snapshot().writtenBytes + childWrittenBytes).toBeLessThanOrEqual(24 * 1024 * 1024);
    const artifacts = QUARTET.filter((name) => fs.existsSync(path.join(outDir, name)))
      .map((name) => ({ name, bytes: fs.statSync(path.join(outDir, name)).size }));
    projectionMetrics.push({ entry, exitCode: result.status, sourceBytes: fullConfirmation.sourceBytes,
      authorityBytes: Buffer.byteLength(JSON.stringify(scanned.typedSourceAuthority)), artifacts, childIo });
    expect(result.status, `${result.stdout.slice(0, 2000)}\n${result.stderr.slice(0, 500)}`).toBe(0);
    expect(artifacts).toHaveLength(4);
    const packet = JSON.parse(fs.readFileSync(path.join(outDir, 'model_packet.json'), 'utf8'));
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));
    expect(byteHash(packet.typedSourceAuthority)).toBe(byteHash(scanned.typedSourceAuthority));
    expect(packet.traceOrder).toEqual(confirmation.traceRows.map((row: any) => row.id));
    expect(byteHash(packet.atomicImplementationTaskList)).toBe(byteHash(confirmation.implementationTasks));
    expect(packet.contractExecutionManifest.typedSourceAuthority).toBeUndefined();
    expect(packet.contractExecutionManifest.typedSourceAuthorityRef.graphHash).toBe(scanned.typedSourceAuthority!.graphHash);
    expect(validateTypedModelPacket(packet, receipt, fullConfirmation.confirmed)).toEqual([]);
    for (const name of ['human_prompt.txt', 'goal_execution.md']) {
      const text = fs.readFileSync(path.join(outDir, name), 'utf8');
      expect(text.includes(scanned.typedSourceAuthority!.graphHash), name).toBe(true);
    }
    projectionMetrics.at(-1)!.manifestBytes = Buffer.byteLength(JSON.stringify(packet.contractExecutionManifest));
    for (const change of ['trace-order', 'source-graph-hash', 'trace-command']) {
      const damaged = structuredClone(packet);
      if (change === 'trace-order') damaged.traceOrder.reverse();
      if (change === 'source-graph-hash') damaged.typedSourceAuthority.graphHash = `sha256:${'0'.repeat(64)}`;
      if (change === 'trace-command') {
        const trace = damaged.contractExecutionManifest.traceRows.find((row: any) => row.deliveryEvidenceCommandRefs?.length > 0);
        expect(trace).toBeDefined();
        trace.deliveryEvidenceCommandRefs = [];
      }
      expect(byteHash(damaged)).not.toBe(byteHash(packet));
      expect(validateTypedModelPacket(damaged, receipt, fullConfirmation.confirmed).length, change).toBeGreaterThan(0);
    }
  }, 120_000);
});
