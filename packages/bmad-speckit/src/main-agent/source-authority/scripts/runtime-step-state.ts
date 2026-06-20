/* eslint-disable @typescript-eslint/no-var-requires */

import * as fs from 'node:fs';
import * as path from 'node:path';

const runtimeStepStatePathCandidates = [
  path.resolve(__dirname, '..', '_bmad', 'runtime', 'hooks', 'runtime-step-state.cjs'),
  path.resolve(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'runtime-step-state.cjs'),
];
const runtimeStepStatePath =
  runtimeStepStatePathCandidates.find((candidate) => fs.existsSync(candidate)) ||
  runtimeStepStatePathCandidates[0];

const runtimeStepState = require(runtimeStepStatePath) as {
  resolveRuntimeStepState: (
    projectRoot: string,
    options?: {
      argv?: string[];
      env?: NodeJS.ProcessEnv;
      workflow?: string;
      step?: string;
      artifactPath?: string;
      hookInput?: unknown;
    }
  ) => RuntimeStepState;
  persistRuntimeStepState: (projectRoot: string, state: RuntimeStepState) => RuntimeStepState;
};

export interface RuntimeStepState {
  workflow: string;
  step: string;
  flow: string | null;
  stage: string | null;
  rerunGate: string | null;
  artifactPath: string | null;
  artifactRoot: string | null;
  branch: string | null;
  epicId: string | null;
  storyId: string | null;
  route?: Record<string, unknown> | null;
  frontmatter?: Record<string, unknown> | null;
  registry?: Record<string, unknown>;
  runtimeContext?: Record<string, unknown>;
  activeContextPath?: string;
  projectContextPath?: string;
  contextScope?: string;
  persistedContext?: Record<string, unknown>;
}

export function resolveRuntimeStepState(
  projectRoot: string,
  options?: Parameters<typeof runtimeStepState.resolveRuntimeStepState>[1]
): RuntimeStepState {
  return runtimeStepState.resolveRuntimeStepState(projectRoot, options);
}

export function persistRuntimeStepState(
  projectRoot: string,
  state: RuntimeStepState
): RuntimeStepState {
  return runtimeStepState.persistRuntimeStepState(projectRoot, state);
}
