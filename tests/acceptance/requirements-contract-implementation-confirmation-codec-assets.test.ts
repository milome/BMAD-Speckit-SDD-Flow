import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const requireForTest = createRequire(import.meta.url);
const root = process.cwd();
const scriptDir = path.join(
  root, 'packages/bmad-speckit/src/main-agent/source-authority/scripts'
);
const codecPath = path.join(
  scriptDir, 'requirements-contract-implementation-confirmation-codec.ts'
);
const projectorPath = path.join(
  scriptDir, 'requirements-contract-implementation-confirmation-projector.ts'
);
const preRenderHashHelperPath = path.join(
  root,
  '_bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown_lib.js'
);

async function load(file: string) {
  expect(existsSync(file), `missing ${file}`).toBe(true);
  if (!existsSync(file)) return null;
  return import(/* @vite-ignore */ pathToFileURL(file).href) as Promise<Record<string, any>>;
}

describe('implementation confirmation codec and composition assets', () => {
  it('owns deterministic inline extraction and rejects duplicate or fenced blocks', async () => {
    const codec = await load(codecPath);
    if (!codec) return;
    const source = [
      '# Source', '',
      'implementationConfirmation:',
      '  contractSchemaVersion: 1',
      '  status: draft',
      '  recordId: REQ-AMEND-13',
      '',
      '## Next',
    ].join('\n');
    const parsed = codec.extractRequirementsContractImplementationConfirmation(source);
    const serialized = codec.serializeRequirementsContractImplementationConfirmation(parsed.value);
    const reparsed = codec.extractRequirementsContractImplementationConfirmation(serialized);
    expect(reparsed.value).toEqual(parsed.value);
    expect(codec.implementationConfirmationHashFor(reparsed.value))
      .toBe(codec.implementationConfirmationHashFor(parsed.value));
    expect(codec.serializeRequirementsContractImplementationConfirmation(reparsed.value))
      .toBe(serialized);

    expect(() => codec.extractRequirementsContractImplementationConfirmation(
      `${source}\nimplementationConfirmation:\n  contractSchemaVersion: 1\n`
    )).toThrow(/duplicate/u);
    expect(() => codec.extractRequirementsContractImplementationConfirmation(
      '```yaml\nimplementationConfirmation:\n  contractSchemaVersion: 1\n```\n'
    )).toThrow(/fenced/u);
  });

  it('hashes equivalent LF, CRLF, BOM, and Unicode source text identically', async () => {
    const codec = await load(codecPath);
    if (!codec) return;
    const lfSource = [
      '# Caf\u00E9',
      '',
      'implementationConfirmation:',
      '  contractSchemaVersion: 1',
      '  status: draft',
      '  recordId: REQ-HASH-DOMAIN',
      '',
      '## Next',
      '',
    ].join('\n');
    const crlfSource = `\uFEFF${lfSource
      .replace('Caf\u00E9', 'Cafe\u0301')
      .replace(/\n/gu, '\r\n')}`;
    const lf = codec.extractRequirementsContractImplementationConfirmation(lfSource);
    const crlf = codec.extractRequirementsContractImplementationConfirmation(crlfSource);

    expect(codec.sourceDocumentHashFor(lfSource, lf.blockText, lf.value)).toBe(
      codec.sourceDocumentHashFor(crlfSource, crlf.blockText, crlf.value)
    );
    expect(codec.implementationConfirmationHashFor({
      z: 'Cafe\u0301\r\n',
      a: 1,
    })).toBe(codec.implementationConfirmationHashFor({
      a: 1,
      z: 'Caf\u00E9\n',
    }));
  });

  it('keeps the pre-render gate helper in the canonical codec hash domain', async () => {
    const codec = await load(codecPath);
    if (!codec) return;
    const preRenderHashHelper = requireForTest(preRenderHashHelperPath) as {
      extractImplementationConfirmation(sourceText: string): {
        blockText: string;
        confirmation: Record<string, unknown>;
      };
      sourceDocumentHashFor(
        sourceText: string,
        blockText: string,
        confirmation: Record<string, unknown>
      ): string;
      implementationConfirmationHashFor(confirmation: Record<string, unknown>): string;
    };
    const lfSource = [
      '# Caf\u00E9',
      '',
      'implementationConfirmation:',
      '  contractSchemaVersion: 1',
      '  recordId: REQ-HASH-PARITY',
      '  status: draft',
      '  productBehavior: "Persist Caf\u00E9 value"',
      '  observedAt: 2026-07-21T01:02:03.000Z',
      '  hashOrderingProbe:',
      '    _boundary: canonical',
      '    AIContract: enabled',
      '    acceptanceContract: enabled',
      '',
    ].join('\n');
    const crlfSource = `\uFEFF${lfSource
      .replaceAll('Caf\u00E9', 'Cafe\u0301')
      .replace(/\n/gu, '\r\n')}`;

    for (const source of [lfSource, crlfSource]) {
      const codecExtraction =
        codec.extractRequirementsContractImplementationConfirmation(source);
      const gateExtraction = preRenderHashHelper.extractImplementationConfirmation(source);
      expect(
        preRenderHashHelper.implementationConfirmationHashFor(gateExtraction.confirmation)
      ).toBe(codec.implementationConfirmationHashFor(codecExtraction.value));
      expect(
        preRenderHashHelper.sourceDocumentHashFor(
          source,
          gateExtraction.blockText,
          gateExtraction.confirmation
        )
      ).toBe(codec.sourceDocumentHashFor(source, codecExtraction.blockText, codecExtraction.value));
    }
  });

  it('declares the exact five-member composition and keeps non-codec production parsers at zero', async () => {
    const projector = await load(projectorPath);
    if (!projector) return;
    expect(projector.CONFIRMATION_PROJECTION_CONTRACT.members.map(
      (member: { assetId: string }) => member.assetId
    )).toEqual([
      'implementation_confirmation_schema',
      'implementation_confirmation_projector',
      'confirmation_render_input_schema',
      'confirmation_renderer',
      'implementation_confirmation_reference',
    ]);
    expect(projector.CONFIRMATION_PROJECTION_CONTRACT.supportingAssets).toHaveLength(4);

    const nonCodecPaths = [
      projectorPath,
      path.join(scriptDir, 'requirements-contract-implementation-confirmation-validator.ts'),
      path.join(scriptDir, 'requirements-contract-confirmation-render-input.ts'),
    ];
    const directParserPatterns = [
      /from ['"]js-yaml['"]/u,
      /\byaml\.(?:load|dump)\s*\(/u,
      /\^implementationConfirmation:/u,
    ];
    const directParserCount = nonCodecPaths.flatMap((file) => {
      if (!existsSync(file)) return [`missing:${file}`];
      const source = readFileSync(file, 'utf8');
      return directParserPatterns.filter((pattern) => pattern.test(source)).map(String);
    }).length;
    expect(directParserCount).toBe(0);
  });

  it('documents reference and renderer authority as none without promoting the transitional template', () => {
    const referencePath = path.join(
      root,
      '_bmad/skills/requirements-contract-authoring/references/implementation-confirmation-reference.md'
    );
    const specPath = path.join(
      root,
      '_bmad/skills/requirements-contract-authoring/references/html-confirmation-renderer-spec.md'
    );
    expect(existsSync(referencePath), `missing ${referencePath}`).toBe(true);
    if (!existsSync(referencePath)) return;
    const reference = readFileSync(referencePath, 'utf8');
    const spec = readFileSync(specPath, 'utf8');
    expect(reference).toContain('authority: none');
    expect(reference).toContain('contract-template.md');
    expect(reference).toMatch(/must not.*machine schema authority/iu);
    expect(spec).toContain('authority: none');
    expect(spec).toContain('requirements-contract-implementation-confirmation-codec.ts');
  });
});
