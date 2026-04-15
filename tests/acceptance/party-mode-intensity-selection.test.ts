import { describe, expect, it } from 'vitest';
import {
  inferGateProfileId,
  requestsQuickProbe,
  requiresHighConfidenceFinalOutputs,
} from '../../scripts/party-mode-runtime';

describe('party-mode intensity selection', () => {
  it('defaults ordinary RCA and option analysis prompts to decision_root_cause_50', () => {
    expect(inferGateProfileId('请做一次根因分析，并比较两个修复方案的取舍')).toBe(
      'decision_root_cause_50'
    );
  });

  it('selects quick_probe_20 only when quick probe intent is explicit', () => {
    const quickProbePrompt = 'Please run quick_probe_20 as a quick probe for this issue';

    expect(requestsQuickProbe(quickProbePrompt)).toBe(true);
    expect(inferGateProfileId(quickProbePrompt)).toBe('quick_probe_20');
    expect(inferGateProfileId('请每 20 轮输出一次 checkpoint，然后做普通 RCA')).toBe(
      'decision_root_cause_50'
    );
  });

  it('selects final_solution_task_list_100 for high-confidence final-output requests', () => {
    const finalOutputPrompt = 'Run party-mode-facilitator for BUGFIX final solution and §7 task list';

    expect(requiresHighConfidenceFinalOutputs(finalOutputPrompt)).toBe(true);
    expect(inferGateProfileId(finalOutputPrompt)).toBe('final_solution_task_list_100');
  });
});
