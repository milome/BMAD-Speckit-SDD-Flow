import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const MODEL_PACKET_PATH =
  '_bmad-output/runtime/requirement-records/REQ-2026-05-29-MAIN-AGENT-SIX-MENTAL-MODEL-PRODUCTION-ORCHESTRATION-HARDENING/trace-execution/implement-1780118139102/model_packet.json';

describe('MUST-to-command semantic coverage gate', () => {
  it('proves every high-risk MUST atom has command-backed trace and evidence coverage in the compiled packet', () => {
    const packet = JSON.parse(fs.readFileSync(MODEL_PACKET_PATH, 'utf8')) as {
      traceSlices: Array<{
        traceId: string;
        requirementRefs: string[];
        commandRefs: string[];
        evidenceRefs: string[];
        tddProtocol?: {
          redProofPlans?: Array<{ id: string; oracle: string; redProofPlan: string }>;
        };
      }>;
      requirements: {
        must: Array<{
          id: string;
          riskLevel?: string;
          evidenceRefs?: string[];
          coveredByTraceRows?: string[];
        }>;
      };
      requiredCommands: Array<{
        id: string;
        command: string;
        oracle?: string;
        traceRows?: string[];
        evidenceRefs?: string[];
      }>;
    };
    const commandById = new Map(packet.requiredCommands.map((command) => [command.id, command]));
    for (const requirement of packet.requirements.must.filter(
      (item) => item.riskLevel === 'critical'
    )) {
      const slices = packet.traceSlices.filter((slice) =>
        slice.requirementRefs.includes(requirement.id)
      );
      expect(slices.length, `${requirement.id} must have trace slices`).toBeGreaterThan(0);
      for (const slice of slices) {
        expect(
          slice.commandRefs.length,
          `${requirement.id} ${slice.traceId} command refs`
        ).toBeGreaterThan(0);
        expect(
          slice.evidenceRefs.length,
          `${requirement.id} ${slice.traceId} evidence refs`
        ).toBeGreaterThan(0);
        expect(
          slice.tddProtocol?.redProofPlans?.length,
          `${requirement.id} ${slice.traceId} red proof`
        ).toBeGreaterThan(0);
        for (const commandRef of slice.commandRefs) {
          const command = commandById.get(commandRef);
          expect(command, `${commandRef} exists`).toBeTruthy();
          expect(command?.command.trim(), `${commandRef} command text`).toBeTruthy();
          expect(command?.traceRows).toContain(slice.traceId);
          expect(command?.evidenceRefs?.some((id) => slice.evidenceRefs.includes(id))).toBe(true);
        }
      }
    }
  });
});
