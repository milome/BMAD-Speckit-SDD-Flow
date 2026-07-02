import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CONTRACT_TEMPLATE = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'references',
  'contract-template.md'
);
const RENDERER = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'render-requirements-confirmation-html.ts'
);
const requireForRenderer = createRequire(import.meta.url);
const {
  extractImplementationConfirmation,
  sourceDocumentHashFor,
  implementationConfirmationHashFor,
} = requireForRenderer(
  path.join(
    ROOT,
    '_bmad',
    'skills',
    'requirements-contract-authoring',
    'scripts',
    'pre_render_definition_drilldown_lib.js'
  )
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-contract-gold-render-'));
});

afterEach(() => {
  if (process.env.KEEP_REQ_CONTRACT_GOLD_TEMP === '1') return;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function fixedHash(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function extractGoldYamlBlock(): string {
  const template = fs.readFileSync(CONTRACT_TEMPLATE, 'utf8');
  const match = template.match(/```yaml\s*\n(implementationConfirmation:[\s\S]*?)\n```/u);
  expect(match, 'contract-template.md must expose one renderer-backed gold YAML block').not.toBeNull();
  return match![1];
}

function writeGoldSource(): string {
  const source = path.join(tempDir, 'gold-contract-source.md');
  fs.writeFileSync(
    source,
    [
      '# Renderer Backed Gold Contract Source',
      '',
      'This fixture proves the canonical contract template can render a complete confirmation HTML.',
      '',
      extractGoldYamlBlock(),
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeValidDrilldownGateReport(source: string): string {
  const reportPath = path.join(tempDir, 'pre-render-must-decomposition-gate-report.json');
  const sourceText = fs.readFileSync(source, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
        verdict: 'PASS',
        confirmability: 'confirmable',
        sourceDocumentHash: sourceDocumentHashFor(
          sourceText,
          extracted.blockText,
          extracted.confirmation
        ),
        implementationConfirmationHash: implementationConfirmationHashFor(extracted.confirmation),
        semanticKernelRef: {
          path: path.join(tempDir, 'semantic-kernel.json'),
          hash: fixedHash('b'),
        },
        mustDecompositionPacketRef: {
          path: path.join(tempDir, 'must_decomposition_packet.json'),
          hash: fixedHash('a'),
          status: 'synchronized',
        },
        criticalAuditor: {
          minimumRounds: 3,
          consecutiveNoNewGapRounds: 3,
          latestReceiptHash: fixedHash('c'),
          convergenceVerdict: 'bounded_no_new_gap',
        },
        packetSourceReconciliation: {
          reportPath: path.join(tempDir, 'must_packet_source_reconciliation_report.json'),
          verdict: 'pass',
        },
        failedChecks: [],
        blockingIssues: [],
      },
      null,
      2
    ),
    'utf8'
  );
  return reportPath;
}

function writeMockMermaidBundle(): string {
  const bundle = path.join(tempDir, 'mock-mermaid.min.js');
  fs.writeFileSync(
    bundle,
    `window.mermaid={initialize:function(){},render:async function(id,source){return {svg:'<svg data-mock-mermaid="true" viewBox="0 0 640 320"><text x="0" y="24">'+String(source).slice(0,32).replace(/[<>&]/g,'')+'</text></svg>'};}};`,
    'utf8'
  );
  return bundle;
}

describe('requirements contract canonical gold template rendering', () => {
  it('renders contract-template.md as confirmable high-quality confirmation HTML', () => {
    const source = writeGoldSource();
    const out = path.join(tempDir, 'confirmation.html');
    const result = spawnSync(
      process.execPath,
      [
        RENDERER,
        '--source',
        source,
        '--out',
        out,
        '--mermaid-bundle',
        writeMockMermaidBundle(),
        '--language',
        'zh-CN',
        '--record-id',
        'REQ-EXAMPLE-001',
        '--entry-flow',
        'story',
        '--drilldown-gate-report',
        writeValidDrilldownGateReport(source),
        '--json',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(
      fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8')
    );

    expect(report.confirmability).toBe('confirmable');
    expect(report.blockingIssues).toEqual([]);
    expect(report.renderedSections).toEqual(
      expect.arrayContaining([
        'business-visuals',
        'governance-visuals',
        'trace-matrix',
        'current-target',
        'target-modification-paths',
        'ai-tdd-contract-manifest',
        'pre-confirmation-semantic-drilldown',
      ])
    );
    expect(report.targetModificationPathCoverage.ready).toBe(true);
    expect(report.currentTargetSchemaIssues).toEqual([]);
    expect(html).toContain('业务需求可视化区');
    expect(html).toContain('目标修改路径清单');
    expect(html).toContain('现状 vs 目标态对比区');
    expect(html).toContain('Trace Matrix');
    expect(html).toContain('Pre-Confirmation Semantic Drilldown');
    expect(html).toContain('Validation');
  });
});
