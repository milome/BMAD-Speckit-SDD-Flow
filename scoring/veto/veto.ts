/**
 * Story 4.1 T1: 环节级 veto 判定
 * 从 loadPhaseScoringYaml、loadGapsScoringYaml 获取 veto_items，解析 ref 构建 vetoItemIds
 */
import type { CheckItem } from '../writer/types';
import { loadPhaseScoringYaml, loadStageScoringYaml, loadGapsScoringYaml } from '../parsers/rules';

const REF_ITEM_ID_PATTERN = /^code-reviewer-config#([a-zA-Z0-9_]+)$/;

/**
 * Check if any check_item has veto item_id and passed=false.
 * @param {CheckItem[]} checkItems - Check items from parsed report
 * @param {Set<string>} vetoItemIds - Set of veto item_ids from scoring rules
 * @returns {boolean} true if veto triggered
 */
export function isVetoTriggered(checkItems: CheckItem[], vetoItemIds: Set<string>): boolean {
  return checkItems.some(
    (c) => vetoItemIds.has(c.item_id) && c.passed === false
  );
}

function extractItemIdFromRef(ref: string): string | null {
  const m = ref.match(REF_ITEM_ID_PATTERN);
  return m ? m[1] : null;
}

/**
 * Build veto item_id set from phase/stage/gaps scoring YAML veto_items.
 * @param {{ rulesDir?: string }} [options] - rulesDir for YAML lookup
 * @param {string} [options.rulesDir] - Optional rules directory path
 * @returns {Set<string>} Set of veto item_ids
 */
export function buildVetoItemIds(options?: { rulesDir?: string }): Set<string> {
  const ids = new Set<string>();
  const rulesDir = options?.rulesDir ?? undefined;

  for (const phase of [2, 3, 4] as const) {
    const yaml = loadPhaseScoringYaml(phase, rulesDir ? { rulesDir } : undefined);
    for (const v of yaml.veto_items ?? []) {
      const itemId = extractItemIdFromRef(v.ref);
      if (itemId) ids.add(itemId);
    }
  }

  for (const stage of ['spec', 'plan', 'tasks'] as const) {
    const yaml = loadStageScoringYaml(stage, rulesDir ? { rulesDir } : undefined);
    for (const v of yaml.veto_items ?? []) {
      const itemId = extractItemIdFromRef(v.ref);
      if (itemId) ids.add(itemId);
    }
  }

  const gaps = loadGapsScoringYaml(rulesDir ? { rulesDir } : undefined);
  for (const v of gaps.veto_items ?? []) {
    const itemId = extractItemIdFromRef(v.ref);
    if (itemId) ids.add(itemId);
  }

  return ids;
}
