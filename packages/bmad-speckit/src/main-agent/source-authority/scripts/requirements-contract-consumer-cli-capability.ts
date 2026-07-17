import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

type JsonRecord = Record<string, unknown>;

export async function requirementsContractConsumerCliCapabilityObserveCommand(options: {
  cwd?: string;
  json?: boolean;
}): Promise<number> {
  try {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const profilePath = path.join(
      cwd,
      '_bmad-output',
      'runtime',
      'context',
      'consumer-project-profile.json'
    );
    const schemaPath = path.resolve(
      __dirname,
      '..',
      'schemas',
      'requirements-contract-consumer-cli-capability.schema.json'
    );
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as JsonRecord;
    const observation = {
      schemaVersion: 'requirements-contract-consumer-cli-capability/v1',
      executionHost: profile.executionHost,
      goalCommandAvailable:
        profile.executionHost === 'codex' || profile.executionHost === 'claude-code',
    };
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
    );
    if (!validate(observation)) throw new Error(JSON.stringify(validate.errors ?? []));
    process.stdout.write(`${JSON.stringify(observation)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
