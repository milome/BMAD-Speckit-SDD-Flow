import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/canonical-hash';

export function materializeGoalRunExecutionAdapter(
  outRoot: string,
  input: { adapterId?: string; executableSource?: string; timeoutMs?: number } = {}
) {
  const adapterRoot = path.join(path.resolve(outRoot), 'goal', 'execution-adapter');
  const executableBytes = Buffer.from(
    input.executableSource ??
      [
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  JSON.parse(input);',
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: [] }));",
        '});',
        '',
      ].join('\n'),
    'utf8'
  );
  const executableHash = `sha256:${createHash('sha256').update(executableBytes).digest('hex')}`;
  const payload = {
    schemaVersion: 'GoalRunExecutionAdapterAuthority/v1',
    adapterId: input.adapterId ?? 'activation-fixture-noop',
    protocol: 'GoalRunMutationProtocol/v1',
    executableRef: { path: 'executor.cjs', hash: executableHash },
    args: [],
    timeoutMs: input.timeoutMs ?? 30_000,
  };
  const authority = {
    ...payload,
    adapterAuthorityHash: hashControlPlaneValue(payload),
  };
  mkdirSync(adapterRoot, { recursive: true });
  writeFileSync(path.join(adapterRoot, 'executor.cjs'), executableBytes);
  writeFileSync(
    path.join(adapterRoot, 'authority.json'),
    `${stableControlPlaneStringify(authority)}\n`,
    'utf8'
  );
  return authority;
}
