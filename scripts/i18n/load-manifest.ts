/**
 * Load audit template manifest YAML from `_bmad/i18n/manifests/{id}.yaml`.
 */
import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type { TemplateManifest } from './validate-template-manifest';

export function getDefaultManifestRoot(): string {
  return path.join(process.cwd(), '_bmad', 'i18n', 'manifests');
}

/**
 * @param id - Manifest id without extension (e.g. `speckit.audit.spec`)
 * @param manifestRoot - Optional root directory; defaults to `_bmad/i18n/manifests` under cwd
 */
export function loadManifest(id: string, manifestRoot: string = getDefaultManifestRoot()): TemplateManifest {
  const filePath = path.join(manifestRoot, `${id}.yaml`);
  if (!existsSync(filePath)) {
    throw new Error(`Manifest not found: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf8');
  const parsed = yaml.load(raw) as TemplateManifest;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid manifest YAML: ${filePath}`);
  }
  return parsed;
}
