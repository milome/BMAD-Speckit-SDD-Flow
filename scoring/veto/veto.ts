/**
 * Story 4.1 T1: 环节级 veto 判定
 * 从 loadPhaseScoringYaml、loadGapsScoringYaml 获取 veto_items，解析 ref 构建 vetoItemIds
 */
import type { CheckItem } from '../writer/types';
import { loadPhaseScoringYaml, loadGapsScoringYaml } from '../parsers/rules';

const REF_ITEM_ID_PATTERN = /^code-reviewer-config#([a-zA-Z0-9_]+)$/;

/**
 * 检查 check_items 中是否存在 veto 类 item_id 且 passed=false
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
 * 从 loadPhaseScoringYaml(2/3/4)、loadGapsScoringYaml 的 veto_items 解析 ref，
 * 取 ref 目标 item_id 构建集合
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

  const gaps = loadGapsScoringYaml(rulesDir ? { rulesDir } : undefined);
  for (const v of gaps.veto_items ?? []) {
    const itemId = extractItemIdFromRef(v.ref);
    if (itemId) ids.add(itemId);
  }

  return ids;
}
