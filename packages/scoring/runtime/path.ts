import * as path from 'path';

export function resolveRuntimeRoot(root: string = process.cwd()): string {
  return path.join(root, '_bmad-output', 'runtime');
}

export function resolveRuntimeEventsPath(root: string = process.cwd()): string {
  return path.join(resolveRuntimeRoot(root), 'events');
}
