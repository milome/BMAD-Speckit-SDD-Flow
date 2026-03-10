/**
 * Story 5.5 B09: rule-suggestion 单测
 * AC-B09-1, AC-B09-2, AC-B09-3, AC-B09-4
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generateRuleSuggestions,
  formatRuleSuggestionsYaml,
  type RuleSuggestion,
  type WeaknessCluster,
} from '../rule-suggestion';
import type { RunScoreRecord } from '../../writer/types';

describe('rule-suggestion', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `rule-suggest-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('T4-1: suggests increase_deduct when failure_rate>50% and deduct<8 (AC-B09-1)', () => {
    const rulesPath = path.join(tempDir, 'rules');
    fs.mkdirSync(rulesPath, { recursive: true });
    fs.writeFileSync(
      path.join(rulesPath, 'tasks-scoring.yaml'),
      `items:
  - id: item_a
    deduct: 6
`,
      'utf-8'
    );

    const clusters: WeaknessCluster[] = [
      {
        cluster_id: 'c1',
        primary_item_ids: ['item_a'],
        frequency: 6,
        keywords: ['test'],
        severity_distribution: {},
        affected_stages: [],
      },
    ];
    const records: RunScoreRecord[] = [];
    for (let i = 0; i < 10; i++) {
      records.push(makeRecord('r' + i, [
        { item_id: 'item_a', passed: i < 4, score_delta: -8 },
      ]));
    }

    const suggestions = generateRuleSuggestions(clusters, records, rulesPath);
    const inc = suggestions.find((s) => s.action === 'increase_deduct');
    expect(inc).toBeDefined();
    expect(inc!.item_id).toBe('item_a');
    expect(inc!.current_deduct).toBe(6);
    expect(inc!.suggested_deduct).toBe(8);
    expect(inc!.evidence_count).toBe(6);
    expect(inc!.evidence_total).toBe(10);
  });

  it('T4-2: suggests promote_to_veto when failure_rate>80% (AC-B09-2)', () => {
    const rulesPath = path.join(tempDir, 'rules');
    fs.mkdirSync(rulesPath, { recursive: true });
    fs.writeFileSync(
      path.join(rulesPath, 'x-scoring.yaml'),
      `items:
  - id: item_v
    deduct: 10
`,
      'utf-8'
    );

    const clusters: WeaknessCluster[] = [
      {
        cluster_id: 'c2',
        primary_item_ids: ['item_v'],
        frequency: 9,
        keywords: ['critical'],
        severity_distribution: {},
        affected_stages: [],
      },
    ];
    const records: RunScoreRecord[] = [];
    for (let i = 0; i < 10; i++) {
      records.push(makeRecord('r' + i, [
        { item_id: 'item_v', passed: i === 0, score_delta: -10 },
      ]));
    }

    const suggestions = generateRuleSuggestions(clusters, records, rulesPath);
    const veto = suggestions.find((s) => s.action === 'promote_to_veto');
    expect(veto).toBeDefined();
    expect(veto!.item_id).toBe('item_v');
  });

  it('T4-3: suggests add_new_item when keywords do not match existing items (AC-B09-3)', () => {
    const rulesPath = path.join(tempDir, 'rules');
    fs.mkdirSync(rulesPath, { recursive: true });
    fs.writeFileSync(
      path.join(rulesPath, 'y-scoring.yaml'),
      `items:
  - id: existing_item
    deduct: 8
`,
      'utf-8'
    );

    const clusters: WeaknessCluster[] = [
      {
        cluster_id: 'c3',
        primary_item_ids: ['nonexistent_xyz'],
        frequency: 3,
        keywords: ['obscure', 'unique_pattern'],
        severity_distribution: {},
        affected_stages: [],
      },
    ];
    const records: RunScoreRecord[] = [
      makeRecord('r1', [
        { item_id: 'nonexistent_xyz', passed: false, score_delta: -5 },
      ]),
    ];

    const suggestions = generateRuleSuggestions(clusters, records, rulesPath);
    const addNew = suggestions.find((s) => s.action === 'add_new_item');
    expect(addNew).toBeDefined();
    expect(addNew!.item_id).toContain('new_');
  });

  it('T4-4: skips item when evidence_total===0; output YAML is valid (AC-B09-3)', () => {
    const rulesPath = path.join(tempDir, 'rules');
    fs.mkdirSync(rulesPath, { recursive: true });
    fs.writeFileSync(
      path.join(rulesPath, 'z-scoring.yaml'),
      `items:
  - id: orphan_item
    deduct: 6
`,
      'utf-8'
    );

    const clusters: WeaknessCluster[] = [
      {
        cluster_id: 'c4',
        primary_item_ids: ['orphan_item'],
        frequency: 5,
        keywords: ['x'],
        severity_distribution: {},
        affected_stages: [],
      },
    ];
    const records: RunScoreRecord[] = [];

    const suggestions = generateRuleSuggestions(clusters, records, rulesPath);
    expect(suggestions.filter((s) => s.item_id === 'orphan_item')).toHaveLength(0);

    const withData: RuleSuggestion[] = [
      {
        item_id: 'item_x',
        current_deduct: 6,
        suggested_deduct: 8,
        action: 'increase_deduct',
        reason: 'test',
        evidence_count: 5,
        evidence_total: 10,
      },
    ];
    const yamlOut = formatRuleSuggestionsYaml(withData);
    expect(yamlOut).toContain('item_x');
    expect(yamlOut).toContain('increase_deduct');
  });
});

function makeRecord(
  runId: string,
  checkItems: { item_id: string; passed: boolean; score_delta: number }[]
): RunScoreRecord {
  return {
    run_id: runId,
    scenario: 'real_dev',
    stage: 'prd',
    phase_score: 80,
    phase_weight: 0.2,
    check_items: checkItems,
    timestamp: new Date().toISOString(),
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
  };
}
