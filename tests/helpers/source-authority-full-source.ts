import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { encodeGoalSemanticDictionary } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';

type Json = Record<string, unknown>;
export const SOURCE_HASH = '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a';
export const EXPECTED_HASH = 'ed319186e6d12ed7fbfa8c94aaf807cbb432733f677c5af0dcc07ae3faea0f86';
export const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export const BUNDLE_SCHEMA = 'requirements-contract-authority-bundle/v2';
const fixtureTools = createRequire(import.meta.url)(
  '../../packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-full-fixture.cjs'
);

export function writeJson(root: string, relative: string, value: Json) {
  const bytes = Buffer.from(JSON.stringify(value));
  assert.ok(bytes.length <= 1048576, 'Test input must respect the unchanged per-file byte budget');
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, bytes, { flag: 'wx' });
  return bytes.length;
}

export function bundleEntry(relative: string) {
  return {
    path: relative,
    rootClass: 'source_bundle',
    proposedAuthorityClass: 'source_authority',
    bodySchemaVersion: BUNDLE_SCHEMA,
  };
}

export function typedChild(id: string, role: string, text: string, extra: Json = {}) {
  return {
    sourceRootId: id,
    rootClass: 'typed_source_node',
    proposedAuthorityClass: 'source_authority',
    bodySchemaVersion: 'requirements-contract-source-node/v2',
    semanticBody: {
      schemaVersion: 'requirements-contract-source-node/v2',
      executionRole: role,
      text,
      polarity: 'required',
      normativeStrength: 'must',
      conditions: [],
      scope: { kind: 'source_section' },
      declaredIds: [],
      ...extra,
    },
  };
}

export function createSmallBundle(count = 129) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'test-only-source-bundle-'));
  const sourceRoots = Array.from({ length: count }, (_, index) =>
    typedChild(
      `REQ-CHILD-${index + 1}`,
      index === 0 ? 'action' : 'boundary',
      `Exact source declaration ${index + 1}.`,
      {
        polarity: index === 0 ? 'required' : 'forbidden',
        ...(index > 0 ? { scope: { kind: 'task', ownerId: 'REQ-CHILD-1' } } : {}),
      }
    )
  );
  const raw = Buffer.from(sourceRoots.map((node) => node.semanticBody.text).join('\n'));
  mkdirSync(path.join(root, 'inputs'), { recursive: true });
  writeFileSync(path.join(root, 'inputs/raw-source.md'), raw, { flag: 'wx' });
  let cursor = 0;
  for (const child of sourceRoots as Json[]) {
    const byteEnd = cursor + Buffer.byteLength(child.semanticBody.text);
    child.sourceBinding = { sourceArtifactRef: 'raw-source', byteStart: cursor, byteEnd };
    cursor = byteEnd + 1;
  }
  writeJson(root, 'inputs/authority.json', {
    schemaVersion: BUNDLE_SCHEMA,
    sourceRoots,
    sourceRelations: [],
    sourceArtifact: {
      artifactId: 'raw-source',
      path: 'inputs/raw-source.md',
      bytes: raw.length,
      sha256: hash(raw),
    },
  });
  const authoritySources = [bundleEntry('inputs/authority.json')];
  const intakeSource = path.join(root, 'intake.json');
  writeJson(root, 'intake.json', { evidenceClass: 'test-only-not-confirmation', authoritySources });
  return { root, intakeSource, authoritySources, sourceRoots };
}

function clauseRole(block: Json, clause: Json): string {
  if (clause.polarity === 'descriptive') return 'guidance';
  if (
    ['association', 'scope_declaration', 'input_declaration', 'command_declaration'].includes(
      block.disposition
    )
  )
    return 'binding';
  if (clause.polarity === 'forbidden') return 'boundary';
  if (/assertion|criterion|evidence/u.test(block.fieldRole || '')) return 'acceptance';
  if (clause.polarity === 'permitted') return 'guidance';
  return 'requirement';
}

function withTechnicalDeclarationMetadata(command: Json, relations: Json[]): Json {
  const conditional = relations.some(
    (relation) => relation.kind === 'conditional_command_selection' && relation.from === command.id
  );
  const commandRole = String(command.role);
  const commandDeclarationClass =
    commandRole === 'source_command_set'
      ? conditional
        ? 'conditional_selector'
        : 'source_command_set'
      : 'executable_expression';
  const executionMode =
    commandDeclarationClass === 'conditional_selector'
      ? 'conditional_selection'
      : commandDeclarationClass === 'source_command_set'
        ? 'declaration_set'
        : commandRole === 'command_template'
          ? 'template'
          : commandRole === 'prohibited_command'
            ? 'prohibited'
            : 'executable';
  return {
    ...command,
    commandDeclarationClass,
    commandRole,
    executionMode,
  };
}

function separatePhysical(value: unknown, fieldRef: string, bindings: Json[]): unknown {
  if (Array.isArray(value))
    return value.map((child, index) => separatePhysical(child, `${fieldRef}/${index}`, bindings));
  if (!value || typeof value !== 'object') return value;
  const result: Json = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    if (
      ['source', 'sourceLine', 'lineStart', 'lineEnd', 'byteStart', 'byteEnd'].includes(key) ||
      (['start', 'end'].includes(key) && typeof child === 'number')
    ) {
      bindings.push({ fieldRef: `${fieldRef}/${key}`, value: child });
    } else result[key] = separatePhysical(child, `${fieldRef}/${key}`, bindings);
  }
  return result;
}

export function createFullSourceBundle() {
  const materialized = fixtureTools.materializeFullFixture();
  let raw: Buffer;
  let expectedBytes: Buffer;
  try {
    raw = readFileSync(materialized.legacySourcePath);
    expectedBytes = readFileSync(materialized.expectedOraclePath);
  } finally {
    rmSync(materialized.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
  assert.equal(raw.length, 214296);
  assert.equal(hash(raw), SOURCE_HASH);
  assert.equal(hash(expectedBytes), EXPECTED_HASH);
  new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const expected = JSON.parse(expectedBytes.toString('utf8'));
  const root = mkdtempSync(path.join(os.tmpdir(), 'test-only-full-source-bundle-'));
  mkdirSync(path.join(root, 'inputs'), { recursive: true });
  copyFileSync(`${prefix}.md`, path.join(root, 'inputs/raw-source.md'));
  const authoritySources: ReturnType<typeof bundleEntry>[] = [];
  const sourceRoots: Json[] = [];
  const sourceRelations: Json[] = [];
  const declaredIds: string[] = [];
  const fileBytes: number[] = [];
  for (const [sectionIndex, section] of expected.sections.entries()) {
    const roots: Json[] = [];
    section.commands = section.commands.map((command: Json) =>
      withTechnicalDeclarationMetadata(command, section.relations)
    );
    for (const work of section.works) {
      const heading = section.blocks.find(
        (block: Json) => block.source.lineStart === work.start && block.kind === 'heading'
      );
      assert.ok(
        heading,
        'Each independent WORK declaration must bind to its original source heading'
      );
      const child = typedChild(work.id, 'action', heading.text, {
        declaredIds: [work.id],
        sourceBlockId: heading.id,
        sourceDisposition: 'work_declaration',
        scope: { kind: 'work', owner: work.id },
      }) as Json;
      child.sourceBinding = { sourceArtifactRef: 'raw-source', ...heading.source };
      roots.push(child);
      declaredIds.push(work.id);
    }
    for (const block of section.blocks) {
      if (block.definedId) {
        declaredIds.push(block.definedId);
        roots.push(
          typedChild(
            block.definedId,
            /^WORK-/u.test(block.definedId) ? 'action' : 'definition',
            block.text,
            {
              declaredIds: [block.definedId],
              sourceBlockId: block.id,
              sourceDisposition: block.disposition,
              scope: block.scope,
              ...(/^WORK-/u.test(block.definedId)
                ? {}
                : { polarity: 'descriptive', normativeStrength: 'descriptive' }),
            }
          )
        );
        roots.at(-1)!.sourceBinding = { sourceArtifactRef: 'raw-source', ...block.source };
      }
      for (const clause of block.semantics) {
        assert.equal(raw.subarray(clause.byteStart, clause.byteEnd).toString('utf8'), clause.text);
        roots.push(
          typedChild(
            `SOURCE-${clause.id.replace(':', '-')}`,
            clauseRole(block, clause),
            clause.text,
            {
              sourceClauseId: clause.id,
              sourceBlockId: block.id,
              declaredIds: block.definedId ? [block.definedId] : [],
              sourceDisposition: clause.disposition,
              polarity: clause.polarity,
              normativeStrength:
                clause.polarity === 'permitted'
                  ? 'may'
                  : clause.polarity === 'descriptive'
                    ? 'descriptive'
                    : 'must',
              conditions: clause.conditions,
              scope: clause.scope,
              expectedOutcome: clause.expectedOutcome,
            }
          )
        );
        roots.at(-1)!.sourceBinding = {
          sourceArtifactRef: 'raw-source',
          byteStart: clause.byteStart,
          byteEnd: clause.byteEnd,
        };
      }
    }
    const relative = `inputs/section-${String(sectionIndex).padStart(2, '0')}.json`;
    const sourceContextBindings: Json[] = [];
    for (const child of roots) {
      const semanticBindings: Json[] = [];
      child.semanticBody = separatePhysical(child.semanticBody, '', semanticBindings);
      if (semanticBindings.length) child.sourceBinding.semanticLocators = semanticBindings;
    }
    const context = {
      sourceBlocks: section.blocks.map(({ semantics: _semantics, ...block }: Json) => block),
      commandDeclarations: section.commands,
      workDeclarations: section.works,
      scenarioDeclarations: section.scenarios,
      fixDeclarations: section.fixes,
      sections: [{ id: section.id, scope: section.scope, orderedPosition: sectionIndex }],
    };
    const payload = {
      sourceRoots: roots,
      sourceRelations: section.relations,
      ...separatePhysical(context, '', sourceContextBindings),
      sourceContextBindings,
    };
    fileBytes.push(
      writeJson(root, relative, {
        schemaVersion: BUNDLE_SCHEMA,
        evidenceClass: 'test-only-independent-expected-not-confirmation',
        sourceArtifact: {
          artifactId: 'raw-source',
          path: 'inputs/raw-source.md',
          bytes: raw.length,
          sha256: SOURCE_HASH,
        },
        payloadDictionary: encodeGoalSemanticDictionary(payload),
      })
    );
    authoritySources.push(bundleEntry(relative));
    sourceRoots.push(...roots);
    sourceRelations.push(...section.relations);
  }
  writeJson(root, 'intake.json', { evidenceClass: 'test-only-not-confirmation', authoritySources });
  return {
    root,
    intakeSource: path.join(root, 'intake.json'),
    authoritySources,
    sourceRoots,
    sourceRelations,
    declaredIds,
    fileBytes,
    expected,
  };
}
