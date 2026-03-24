#!/usr/bin/env npx ts-node --transpile-only
/**
 * Sync runtime context and registry from sprint-status.yaml.
 * Run after sprint-planning to update _bmad-output/runtime/.
 */
import * as path from 'node:path';
import {
  buildProjectRegistryFromSprintStatus,
  writeRuntimeContextRegistry,
} from './runtime-context-registry';
import { writeRuntimeContextFromSprintStatus } from './runtime-context';

const root = process.cwd();
const sprintPath = path.join(root, '_bmad-output/implementation-artifacts/sprint-status.yaml');
const registry = buildProjectRegistryFromSprintStatus(root, sprintPath);
writeRuntimeContextRegistry(root, registry);
writeRuntimeContextFromSprintStatus(root, sprintPath);
console.log('OK: registry and project context synced from sprint-status.yaml');
console.log('activeEpicIds:', registry.project.activeEpicIds);
console.log('activeStoryIds count:', registry.project.activeStoryIds.length);
