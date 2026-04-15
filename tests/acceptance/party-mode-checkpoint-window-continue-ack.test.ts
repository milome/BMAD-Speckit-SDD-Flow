import { describe, expect, it } from 'vitest';
import {
  buildContinueImmediateAcknowledgement,
  evaluateCheckpointWindowInput,
} from '../../scripts/party-mode-runtime';

describe('party-mode checkpoint window continue ack', () => {
  it('returns the canonical acknowledgement for immediate continue', () => {
    expect(buildContinueImmediateAcknowledgement()).toBe('已确认继续，立即进入下一批');
    expect(evaluateCheckpointWindowInput('C', true).acknowledgement).toBe(
      '已确认继续，立即进入下一批'
    );
  });
});
