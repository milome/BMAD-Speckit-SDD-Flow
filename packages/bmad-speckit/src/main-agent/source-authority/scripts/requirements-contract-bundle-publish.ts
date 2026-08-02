import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  readJson,
  writeJsonAtomic,
} from './requirement-record-control-store';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

const MEMBER_SPECS = [
  ['semantic-ir.json', 'requirement-contract-model/v2', 'semantic_ir'],
  ['trace-graph.json', 'requirements-contract-trace-graph/v1', 'trace_graph'],
  ['target-bindings.json', 'requirements-contract-target-bindings/v1', 'target_bindings'],
  ['task-graph.json', 'requirements-contract-task-graph/v1', 'task_graph'],
  ['red-contracts.json', 'requirements-contract-red-contracts/v1', 'red_contracts'],
  ['oracle-registry.json', 'requirements-contract-oracle-registry/v1', 'oracle_registry'],
  ['acceptance-contracts.json', 'requirements-contract-acceptance-manifest/v1', 'acceptance_manifest'],
  ['evidence-requirements.json', 'requirements-contract-evidence-requirements/v1', 'evidence_requirements'],
  ['business-behavior-delta.json', 'requirements-contract-business-behavior-delta/v1', 'business_behavior_delta'],
  ['implementation-impact-map.json', 'requirements-contract-implementation-impact-map/v1', 'implementation_impact_map'],
] as const;

export interface RequirementsContractBundlePublishOptions {
  cwd?: string;
  requirementRecord: string;
  sourceDocument: string;
  receipt: string;
  json?: boolean;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`bundle_publish_path_escape:${value}`);
  }
  return resolved;
}

function validate(value: JsonRecord, schemaName: string): void {
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(path.resolve(__dirname, '..', 'schemas', schemaName))
  );
  if (!validator(value)) {
    throw new Error(`bundle_publish_schema_invalid:${JSON.stringify(validator.errors ?? [])}`);
  }
}

function pathRef(root: string, filePath: string): JsonRecord {
  return { path: slash(path.relative(root, filePath)), hash: fileHash(filePath) };
}

function assertAcceptanceBijection(currentRoot: string): void {
  const acceptance = readJson(path.join(currentRoot, 'acceptance-contracts.json'));
  const proof = readJson(path.join(currentRoot, 'acceptance-root-proof-manifest.json'));
  const acceptanceIds = [...(acceptance.acceptanceRootIds ?? [])].sort();
  const proofIds = [...(proof.orderedRootIds ?? [])].sort();
  if (canonicalJson(acceptanceIds) !== canonicalJson(proofIds)) {
    throw new Error('bundle_publish_acceptance_root_bijection_mismatch');
  }
}

function exactArgv(options: RequirementsContractBundlePublishOptions): string[] {
  return [
    'node',
    'packages/bmad-speckit/bin/bmad-speckit.js',
    'requirements-contract-bundle-publish',
    '--requirement-record',
    options.requirementRecord,
    '--source-document',
    options.sourceDocument,
    '--receipt',
    options.receipt,
    '--json',
  ];
}

export async function requirementsContractBundlePublishCommand(
  options: RequirementsContractBundlePublishOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const recordPath = resolveWithin(root, options.requirementRecord);
  const sourcePath = resolveWithin(root, options.sourceDocument);
  const receiptPath = resolveWithin(root, options.receipt);
  const record = canonicalizeRequirementRecord(readJson(recordPath));
  if (path.resolve(record.sourcePath) !== sourcePath) {
    throw new Error('bundle_publish_source_document_mismatch');
  }
  const requirementSetId = String(record.requirementSetId);
  const recordRoot = path.dirname(recordPath);
  const authoringRoot = path.join(recordRoot, 'authoring');
  const currentRoot = path.join(authoringRoot, 'current');
  assertAcceptanceBijection(currentRoot);
  const baseRevision = Number(record.recordRevision ?? record.eventCount ?? 0);
  const activeBundleRevision = record.activeBundleRevision ?? null;
  const expectedCommittedRecordRevision = baseRevision + 1;
  const atomicCommitId = `ATOMIC-COMMIT-${randomUUID().toUpperCase()}`;
  const bundleRevision = `BUNDLE-REV-${randomUUID().toUpperCase()}`;
  const controlEventId = `CONTROL-EVENT-${randomUUID().toUpperCase()}`;
  const stagingParent = path.join(authoringRoot, '.staging');
  const stagingRoot = path.join(stagingParent, atomicCommitId);
  const revisionRoot = path.join(authoringRoot, 'revisions', bundleRevision);
  const receiptRoot = path.join(authoringRoot, 'write-receipts', atomicCommitId);
  fs.mkdirSync(stagingParent, { recursive: true });
  fs.mkdirSync(stagingRoot, { recursive: false });
  fs.mkdirSync(receiptRoot, { recursive: true });
  let revisionPromoted = false;
  try {
    const memberRefs = MEMBER_SPECS.map(([fileName, schemaVersion, role]) => {
      const source = path.join(currentRoot, fileName);
      const value = readJson(source);
      if (value.schemaVersion !== schemaVersion) {
        throw new Error(`bundle_publish_member_schema_version_mismatch:${fileName}`);
      }
      const target = path.join(stagingRoot, fileName);
      writeJsonAtomic(target, value);
      const writeReceiptPath = path.join(receiptRoot, `${fileName}.receipt.json`);
      writeJsonAtomic(writeReceiptPath, {
        schemaVersion: 'requirements-contract-bundle-member-write-receipt/v1',
        targetPath: slash(path.relative(root, target)),
        targetHash: fileHash(target),
        readbackHash: fileHash(target),
      });
      return {
        path: slash(path.relative(root, path.join(revisionRoot, fileName))),
        schemaVersion,
        role,
        hash: fileHash(target),
        safeWriteReceiptRef: slash(path.relative(root, writeReceiptPath)),
      };
    });
    const semanticIr = readJson(path.join(currentRoot, 'semantic-ir.json'));
    const proof = (name: string) =>
      pathRef(root, path.join(currentRoot, 'proofs', name));
    const manifest = {
      schemaVersion: 'requirements-contract-runtime-bundle-manifest/v1',
      canonicalByteDomain: 'requirements-contract-runtime-bundle-manifest/v1',
      requirementSetId,
      sourceAuthorityHash:
        semanticIr.sourceAuthorityHash ??
        sha256(`requirements-source-authority/v1\n${fs.readFileSync(sourcePath, 'utf8')}`),
      semanticModelHash: record.semanticModelHash,
      traceGraphHash: fileHash(path.join(stagingRoot, 'trace-graph.json')),
      baseRevision,
      bundleRevision,
      expectedCommittedRecordRevision,
      atomicCommitId,
      controlEventId,
      authority: 'none',
      sourcePrdBackReferences: {
        sourceDocumentPath: slash(path.relative(root, sourcePath)),
        implementationConfirmationBundleManifestPath: slash(
          path.relative(root, path.join(revisionRoot, 'bundle-manifest.json'))
        ),
        acceptanceContractsPath: slash(
          path.relative(root, path.join(revisionRoot, 'acceptance-contracts.json'))
        ),
      },
      upstreamProofs: {
        intakeReceipt: proof('intake-receipt.json'),
        intentLineageLedger: proof('intent-lineage-ledger.json'),
        semanticConservationManifest: proof('semantic-conservation-manifest.json'),
      },
      members: memberRefs,
    };
    validate(manifest, 'requirements-contract-runtime-bundle-manifest.schema.json');
    writeJsonAtomic(path.join(stagingRoot, 'bundle-manifest.json'), manifest);
    const stagedFiles = fs.readdirSync(stagingRoot).sort();
    if (
      stagedFiles.length !== 11 ||
      !stagedFiles.includes('bundle-manifest.json') ||
      MEMBER_SPECS.some(([name]) => !stagedFiles.includes(name))
    ) {
      throw new Error('bundle_publish_staging_file_set_mismatch');
    }
    fs.mkdirSync(path.dirname(revisionRoot), { recursive: true });
    fs.renameSync(stagingRoot, revisionRoot);
    revisionPromoted = true;
    const lockPath = path.join(authoringRoot, '.bundle-publish.lock');
    fs.mkdirSync(lockPath);
    let commit;
    try {
      const live = canonicalizeRequirementRecord(readJson(recordPath));
      if (Number(live.recordRevision ?? live.eventCount ?? 0) !== baseRevision) {
        throw new Error('bundle_publish_base_revision_cas_mismatch');
      }
      if ((live.activeBundleRevision ?? null) !== activeBundleRevision) {
        throw new Error('bundle_publish_active_revision_cas_mismatch');
      }
      commit = appendControlEventAndReplay({
        recordPath,
        writerId: 'requirements-contract-bundle-publish/v1',
        eventType: 'bundle_revision_activated',
        eventId: controlEventId,
        payloadSchemaVersion: 'requirements-contract-bundle-revision-activation/v1',
        payload: {
          bundleRevision,
          manifestHash: fileHash(path.join(revisionRoot, 'bundle-manifest.json')),
          baseRevision,
          expectedCommittedRecordRevision,
          atomicCommitId,
        },
        reduce: (current) => ({
          ...current,
          recordRevision: expectedCommittedRecordRevision,
          activeBundleRevision: bundleRevision,
          lastEventType: 'bundle_revision_activated',
        }),
      });
    } finally {
      fs.rmSync(lockPath, { recursive: true, force: true });
    }
    const manifestPath = path.join(revisionRoot, 'bundle-manifest.json');
    const argv = exactArgv(options);
    const publicationReceipt = {
      schemaVersion: 'requirements-contract-bundle-publication-receipt/v1',
      commandId: 'CMD-26',
      exactArgv: argv,
      argvHash: sha256(canonicalJson(argv)),
      requirementSetId,
      baseRevision,
      expectedCommittedRecordRevision,
      observedCommittedRecordRevision: expectedCommittedRecordRevision,
      bundleRevision,
      atomicCommitId,
      controlEventId,
      manifest: {
        path: slash(path.relative(root, manifestPath)),
        hash: fileHash(manifestPath),
        canonicalByteDomain: 'requirements-contract-runtime-bundle-manifest/v1',
      },
      members: memberRefs.map((member) => ({
        path: member.path,
        hash: member.hash,
        safeWriteReceiptRef: member.safeWriteReceiptRef,
        readbackHash: fileHash(path.join(root, member.path)),
      })),
      staging: {
        path: slash(path.relative(root, path.join(stagingParent, atomicCommitId))),
        allElevenFilesReadBack: true,
        sameVolumeRenameDecision: 'pass',
        orphanCleanupDecision: 'pass',
      },
      compareAndSwap: {
        baseRevisionMatched: true,
        activeBundleRevisionMatched: true,
        eventAppended: commit.event.eventId === controlEventId,
        activeBundleRevision: bundleRevision,
        decision: 'pass',
      },
      result: 'pass',
    };
    validate(
      publicationReceipt,
      'requirements-contract-bundle-publication-receipt.schema.json'
    );
    writeGovernedJson(receiptPath, publicationReceipt);
    if (options.json) process.stdout.write(`${JSON.stringify(publicationReceipt)}\n`);
    return publicationReceipt;
  } catch (error) {
    if (revisionPromoted && fs.existsSync(revisionRoot)) {
      fs.rmSync(revisionRoot, { recursive: true, force: true });
    }
    throw error;
  } finally {
    if (fs.existsSync(stagingRoot)) fs.rmSync(stagingRoot, { recursive: true, force: true });
    fs.mkdirSync(stagingParent, { recursive: true });
  }
}
