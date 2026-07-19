import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { resolveRequirementsContractProjectProfile } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile-resolver';

let identityOrdinal = 0;

function nextRef(prefix: string): string {
  identityOrdinal += 1;
  return `${prefix}-${String(identityOrdinal).padStart(3, '0')}`;
}

describe('requirements contract project profile resolver', () => {
  it('resolves each supported project kind from one hash-bound authority', () => {
    for (const kind of [
      'install_manifest',
      'registered_architecture_record',
      'decision_receipt',
    ] as const) {
      const ref = nextRef(kind.toUpperCase());
      const authorityHash = sha256Stable({ kind, ref });
      const diagramPolicyRegistryHash = sha256Stable({ ref, registry: 'diagram-policy' });
      const projectKind =
        kind === 'install_manifest'
          ? 'consumer_product'
          : kind === 'registered_architecture_record'
            ? 'governance_framework'
            : 'hybrid';
      const owningSystem = nextRef('SYSTEM');
      const governanceFramework = nextRef('FRAMEWORK');

      const result = resolveRequirementsContractProjectProfile({
        projectKind,
        owningSystem,
        governanceFramework,
        classificationAuthority: {
          kind,
          ref,
          hash: authorityHash,
        },
        diagramPolicyRegistryHash,
      });

      expect(result.profile).toMatchObject({
        projectKind,
        owningSystem,
        governanceFramework,
        classificationAuthority: {
          kind,
          ref,
          hash: authorityHash,
        },
        diagramPolicyRegistryHash,
      });
      expect(result.projectProfileHash).toBe(sha256Stable(result.profile));
    }
  });

  it('rejects heading-keyword scope inference instead of converting it into profile authority', () => {
    const headingRef = nextRef('HEADING');

    expect(() =>
      resolveRequirementsContractProjectProfile({
        projectKind: 'governance_framework',
        owningSystem: nextRef('SYSTEM'),
        governanceFramework: nextRef('FRAMEWORK'),
        classificationAuthority: {
          kind: 'heading_keyword' as never,
          ref: headingRef,
          hash: sha256Stable({ headingRef }),
        },
        diagramPolicyRegistryHash: sha256Stable({ registry: headingRef }),
      })
    ).toThrow('project_profile_authority_kind_invalid');
  });
});
