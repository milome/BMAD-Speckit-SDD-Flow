import { describe, expect, it } from 'vitest';
import {
  readBmadHelpExecutionPlan,
  readBmadHelpRoutingModel,
  readBmadHelpTasksPlan,
} from './helpers/bmad-help-doc-helpers';

describe('bmad-help implementation block behavior', () => {
  it('prevents implementation-first recommendations when readiness is not clean or repair-closed', () => {
    const routingModel = readBmadHelpRoutingModel();
    const tasksPlan = readBmadHelpTasksPlan();
    const executionPlan = readBmadHelpExecutionPlan();

    expect(routingModel).toContain(
      '只要 `implementationReadinessStatus` 不是 `ready_clean` 或 `repair_closed`，实施入口不得是 `recommended`。'
    );
    expect(routingModel).toContain('- `blocked`: 直接 `Dev Story`');
    expect(routingModel).toContain('- `blocked`: 直接修复实现');
    expect(routingModel).toContain(
      '帮助层只要看到这两类前置尚未通过，就不得把实现入口判成 `recommended`。'
    );

    expect(tasksPlan).toContain('T014');
    expect(tasksPlan).toContain('T016');
    expect(tasksPlan).toContain('不得首推 implement');

    expect(executionPlan).toContain(
      '`T014` and `T016` are present as explicit pre-implementation blockers'
    );
    expect(executionPlan).toContain(
      'Do not begin product code implementation before the frozen Wave 4 tests stay green'
    );
  });
});
