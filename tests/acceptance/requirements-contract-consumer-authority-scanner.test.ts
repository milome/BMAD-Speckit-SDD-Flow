import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempRoot, removeTempRoot } from './helpers/requirements-contract-authoring-fixture';
import { scanRequirementsContractConsumerAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-consumer-authority-scanner';

describe('requirements contract consumer authority scanner', () => {
  it('reads only the intake source and explicitly declared authority sources', () => {
    const root = createTempRoot('requirements-authority-scanner-');
    try {
      mkdirSync(path.join(root, 'docs'), { recursive: true });
      const intakeSource = path.join(root, 'requirements.md');
      const declared = path.join(root, 'docs', 'functional.json');
      writeFileSync(intakeSource, '# Requirements\n', 'utf8');
      writeFileSync(declared, JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'MUST-FR-001',
        semanticBody: { text: 'System MUST persist decisions.' },
      }), 'utf8');
      writeFileSync(path.join(root, 'docs', 'undeclared.json'), '{not-json', 'utf8');

      const result = scanRequirementsContractConsumerAuthority({
        cwd: root,
        intakeSource,
        authoritySources: [{
          path: 'docs/functional.json',
          rootClass: 'functional_requirement',
          proposedAuthorityClass: 'source_authority',
          bodySchemaVersion: 'requirement-contract-requirement/v2',
        }],
      });

      expect(result.sourceList.entries.map((entry) => entry.path)).toEqual([
        'docs/functional.json',
      ]);
      expect(result.sourceRootCandidates).toHaveLength(1);
      expect(result.sourceRootCandidates[0]).toMatchObject({
        sourceRootId: 'MUST-FR-001',
        rootClass: 'functional_requirement',
        proposedAuthorityClass: 'source_authority',
      });
      expect(result.conflicts).toEqual([]);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects path escape and forbidden consumer roots before reading them', () => {
    const root = createTempRoot('requirements-authority-scanner-reject-');
    try {
      const intakeSource = path.join(root, 'requirements.md');
      writeFileSync(intakeSource, '# Requirements\n', 'utf8');
      const scan = (sourcePath: string) => scanRequirementsContractConsumerAuthority({
        cwd: root,
        intakeSource,
        authoritySources: [{
          path: sourcePath,
          rootClass: 'functional_requirement',
          proposedAuthorityClass: 'source_authority',
          bodySchemaVersion: 'requirement-contract-requirement/v2',
        }],
      });
      expect(() => scan('../outside.json')).toThrow('requirements_authority_path_escape');
      expect(() => scan('node_modules/authority.json')).toThrow(
        'requirements_authority_forbidden_root'
      );
    } finally {
      removeTempRoot(root);
    }
  });
});
