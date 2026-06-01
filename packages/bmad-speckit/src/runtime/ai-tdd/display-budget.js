const DISPLAY_BUDGETS = ['compact', 'route', 'expanded', 'full'];

const BUDGET_DETAILS = {
  compact: {
    projectionRows: 3,
    secondaryRecords: 1,
    skillDetails: false,
    crossEntryLines: 3,
  },
  route: {
    projectionRows: 6,
    secondaryRecords: 2,
    skillDetails: true,
    crossEntryLines: 5,
  },
  expanded: {
    projectionRows: 12,
    secondaryRecords: 10,
    skillDetails: true,
    crossEntryLines: 7,
  },
  full: {
    projectionRows: Number.POSITIVE_INFINITY,
    secondaryRecords: Number.POSITIVE_INFINITY,
    skillDetails: true,
    crossEntryLines: Number.POSITIVE_INFINITY,
  },
};

function resolveDisplayBudget(value, fallback = 'route') {
  const normalized = String(value || fallback || 'route').trim().toLowerCase();
  const name = DISPLAY_BUDGETS.includes(normalized) ? normalized : fallback;
  return {
    name,
    ...BUDGET_DETAILS[name],
    preservesPrimaryOutput: true,
    preservesPrimarySafetyRoute: true,
  };
}

function applyLimit(items, limit) {
  if (!Array.isArray(items)) return [];
  if (!Number.isFinite(limit)) return [...items];
  return items.slice(0, limit);
}

module.exports = {
  DISPLAY_BUDGETS,
  resolveDisplayBudget,
  applyLimit,
};
