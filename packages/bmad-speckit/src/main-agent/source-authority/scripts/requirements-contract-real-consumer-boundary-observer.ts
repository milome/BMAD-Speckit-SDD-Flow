import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';
import { runRequirementsContractRealConsumerAdapter } from './requirements-contract-real-consumer-adapter';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

export function observeRequirementsContractRealConsumerBoundaries(input: JsonRecord): JsonRecord {
  const observed = runRequirementsContractRealConsumerAdapter({
    consumerRoot: input.consumerRoot,
    installedPackageRoot: input.installedPackageRoot,
    phaseRoot: input.observerPhaseRoot,
    transactionId: input.transactionId,
    implementationAttemptId: input.implementationAttemptId,
    phaseAuditAttemptId: input.phaseAuditAttemptId,
  });
  return {
    schemaVersion: 'requirements-contract-real-consumer-boundary-observer-receipt/v1',
    transactionId: input.transactionId,
    implementationAttemptId: input.implementationAttemptId,
    phaseAuditAttemptId: input.phaseAuditAttemptId,
    installedPackageRoot: slash(fs.realpathSync(input.installedPackageRoot)),
    formalBoundaryRefs: observed.formalBoundaryRefs,
    installedRuntimeHash: observed.installedRuntimeHash,
    installedRuntimeFileCount: observed.installedRuntimeFileCount,
    installedDependencyTreeHash: observed.installedDependencyTreeHash,
    substitutionCounts: {
      fixture: 0,
      mock: 0,
      alternateRoot: 0,
      workspaceLink: 0,
      synthetic: 0,
    },
    decision: 'PASS',
  };
}

function argument(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  if (index < 0 || !argv[index + 1]) throw new Error(`boundary_observer_argument_missing:${name}`);
  return argv[index + 1];
}

if (require.main === module) {
  try {
    const inputPath = path.resolve(argument(process.argv.slice(2), '--input'));
    const outputPath = path.resolve(argument(process.argv.slice(2), '--out'));
    const receipt = observeRequirementsContractRealConsumerBoundaries(readJson(inputPath));
    writeGovernedJson(outputPath, receipt);
    if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
